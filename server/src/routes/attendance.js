import { Router } from 'express';
import { q } from '../db.js';
import { TZ_SQL, isDate, localParts, zonedToDate, toMin } from '../lib/time.js';
import { clockInStatus, workedHours } from '../lib/attendance.js';
import { sendExport } from '../lib/export.js';
import { audit } from '../lib/audit.js';

const r = Router();
const STATUSES = ['on_time', 'late', 'absent', 'half_day', 'on_leave'];
const HOURS = `CASE WHEN a.clock_out IS NULL AND a.clock_in IS NOT NULL AND a.work_date = (now() AT TIME ZONE ${TZ_SQL})::date
                 THEN round(GREATEST(0, extract(epoch FROM now() - a.clock_in)) / 3600, 1) ELSE a.hours END`;

const SELECT = `SELECT a.id, a.work_date, to_char(a.work_date, 'Mon DD, YYYY') AS date_label,
  e.id AS employee_id, e.code, e.first_name || ' ' || e.last_name AS name, e.photo_url, d.name AS department,
  to_char(a.clock_in AT TIME ZONE ${TZ_SQL}, 'HH12:MI AM') AS clock_in_label,
  to_char(a.clock_out AT TIME ZONE ${TZ_SQL}, 'HH12:MI AM') AS clock_out_label,
  to_char(a.clock_in AT TIME ZONE ${TZ_SQL}, 'HH24:MI') AS clock_in_value,
  to_char(a.clock_out AT TIME ZONE ${TZ_SQL}, 'HH24:MI') AS clock_out_value,
  ${HOURS} AS hours, a.status, a.early_departure, a.notes, a.corrected
  FROM attendance a JOIN employees e ON e.id = a.employee_id LEFT JOIN departments d ON d.id = e.department_id`;

function filters(qs) {
  const w = [], p = [];
  if (isDate(qs.from)) { p.push(qs.from); w.push(`a.work_date >= $${p.length}`); }
  if (isDate(qs.to)) { p.push(qs.to); w.push(`a.work_date <= $${p.length}`); }
  if (qs.department) { p.push(+qs.department); w.push(`e.department_id = $${p.length}`); }
  if (STATUSES.includes(qs.status)) { p.push(qs.status); w.push(`a.status = $${p.length}`); }
  if (qs.employee) { p.push(+qs.employee); w.push(`e.id = $${p.length}`); }
  if (qs.q) { p.push(`%${qs.q}%`); w.push(`((e.first_name || ' ' || e.last_name) ILIKE $${p.length} OR e.code ILIKE $${p.length})`); }
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', p };
}

r.get('/', async (req, res) => {
  const { where, p } = filters(req.query);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, parseInt(req.query.pageSize) || 10);
  const rows = (await q(`${SELECT} ${where} ORDER BY a.work_date DESC, a.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, p)).rows;
  const s = (await q(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE a.status = 'on_time') AS on_time,
            count(*) FILTER (WHERE a.status = 'late') AS late,
            count(*) FILTER (WHERE a.status IN ('on_leave','absent')) AS excused
     FROM attendance a JOIN employees e ON e.id = a.employee_id ${where}`, p)).rows[0];
  res.json({ rows, total: s.total, page, pageSize, summary: s });
});

r.get('/export', async (req, res) => {
  const { where, p } = filters(req.query);
  const { rows } = await q(`${SELECT} ${where} ORDER BY a.work_date DESC, e.code LIMIT 50000`, p);
  const out = rows.map((x) => ({ ...x, status: x.status.replace('_', ' '), hours: x.hours ?? '' }));
  await sendExport(res, req.query.format === 'csv' ? 'csv' : 'xlsx', 'trackx-attendance', [
    { header: 'Date', key: 'work_date' }, { header: 'Employee', key: 'name', width: 24 }, { header: 'Employee ID', key: 'code' },
    { header: 'Department', key: 'department', width: 24 }, { header: 'Clock In', key: 'clock_in_label' },
    { header: 'Clock Out', key: 'clock_out_label' }, { header: 'Hours Worked', key: 'hours' }, { header: 'Status', key: 'status' },
    { header: 'Notes', key: 'notes', width: 30 },
  ], out);
});

// Create or correct a record. Every change is written to the audit log with a mandatory reason.
async function save(req, res, existingId) {
  const { employee_id, work_date, clock_in, clock_out, status, notes, reason } = req.body || {};
  if (!reason || String(reason).trim().length < 3) return res.status(400).json({ error: 'A reason is required for every correction.' });
  const timeOk = (t) => t == null || t === '' || /^\d{2}:\d{2}$/.test(t);
  if (!timeOk(clock_in) || !timeOk(clock_out)) return res.status(400).json({ error: 'Use HH:MM for times.' });
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  let old = null, empId = employee_id, date = work_date;
  if (existingId) {
    old = (await q('SELECT * FROM attendance WHERE id = $1', [existingId])).rows[0];
    if (!old) return res.status(404).json({ error: 'Record not found.' });
    empId = old.employee_id; date = old.work_date;
  }
  if (!empId || !isDate(date)) return res.status(400).json({ error: 'Employee and date are required.' });
  const emp = (await q('SELECT * FROM employees WHERE id = $1', [empId])).rows[0];
  if (!emp) return res.status(404).json({ error: 'Employee not found.' });

  const cin = clock_in ? zonedToDate(date, toMin(clock_in)) : null;
  const cout = clock_out ? zonedToDate(date, toMin(clock_out)) : null;
  if (cin && cout && cout <= cin) return res.status(400).json({ error: 'Clock-out must be after clock-in.' });
  const hours = cin && cout ? workedHours(cin, cout) : null;
  const finalStatus = status || (cin ? clockInStatus(emp, cin) : 'absent');
  const early = cout ? localParts(cout).minutes < toMin(emp.expected_out) : false;

  const { rows } = await q(
    `INSERT INTO attendance (employee_id, work_date, clock_in, clock_out, hours, status, early_departure, notes, corrected)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
     ON CONFLICT (employee_id, work_date) DO UPDATE SET clock_in=$3, clock_out=$4, hours=$5, status=$6, early_departure=$7, notes=$8, corrected=true
     RETURNING *`,
    [empId, date, cin, cout, hours, finalStatus, early, notes || null]
  );
  await audit(req.admin, { action: old ? 'attendance.correct' : 'attendance.create', entity: 'attendance', entityId: rows[0].id,
    oldValue: old, newValue: rows[0], reason: String(reason).trim() });
  res.json(rows[0]);
}

r.post('/', (req, res) => save(req, res, null));
r.put('/:id', (req, res) => save(req, res, +req.params.id));

export default r;
