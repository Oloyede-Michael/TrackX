import { Router } from 'express';
import crypto from 'crypto';
import { q } from '../db.js';
import { hashPin, isPin } from '../lib/pin.js';
import { TZ_SQL, localParts, addDays, fmt12, toMin } from '../lib/time.js';
import { audit } from '../lib/audit.js';

const r = Router();
const STATUS = ['active', 'inactive', 'on_leave'];

const BASE = `SELECT e.id, e.code, e.first_name, e.last_name, e.first_name || ' ' || e.last_name AS name, e.email, e.phone,
  e.date_of_birth, e.photo_url, e.department_id, d.name AS department, e.role, e.grade_level, e.employment_type, e.start_date, e.manager,
  e.status, e.work_schedule, to_char(e.expected_in, 'HH24:MI') AS expected_in, to_char(e.expected_out, 'HH24:MI') AS expected_out,
  e.grace_minutes, e.leave_balance
  FROM employees e LEFT JOIN departments d ON d.id = e.department_id`;

async function nextCode() {
  const { rows } = await q(`SELECT max(substring(code from 6)::int) AS n FROM employees WHERE code ~ '^OJLG-[0-9]+$'`);
  return `OJLG-${String((rows[0].n || 0) + 1).padStart(4, '0')}`;
}

async function freshPin() {
  for (let i = 0; i < 50; i++) {
    const pin = String(crypto.randomInt(0, 10000)).padStart(4, '0');
    const { rowCount } = await q('SELECT 1 FROM employees WHERE pin_hash = $1', [hashPin(pin)]);
    if (!rowCount) return pin;
  }
  throw new Error('No free PINs left');
}

r.get('/next-code', async (_req, res) => res.json({ code: await nextCode() }));

r.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, parseInt(req.query.pageSize) || 8);
  const w = [], p = [];
  if (req.query.department) { p.push(+req.query.department); w.push(`e.department_id = $${p.length}`); }
  if (STATUS.includes(req.query.status)) { p.push(req.query.status); w.push(`e.status = $${p.length}`); }
  if (req.query.q) {
    p.push(`%${req.query.q}%`);
    w.push(`((e.first_name || ' ' || e.last_name) ILIKE $${p.length} OR e.code ILIKE $${p.length} OR d.name ILIKE $${p.length} OR e.role ILIKE $${p.length})`);
  }
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const total = (await q(`SELECT count(*) AS n FROM employees e LEFT JOIN departments d ON d.id = e.department_id ${where}`, p)).rows[0].n;
  const rows = (await q(`${BASE} ${where} ORDER BY e.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, p)).rows;
  res.json({ rows, total, page, pageSize });
});

r.get('/:id', async (req, res) => {
  const id = +req.params.id;
  const emp = (await q(`${BASE} WHERE e.id = $1`, [id])).rows[0];
  if (!emp) return res.status(404).json({ error: 'Employee not found.' });
  const { date } = localParts();
  const since = addDays(date, -30);

  const stat = (await q(
    `SELECT count(*) FILTER (WHERE clock_in IS NOT NULL) AS present, count(*) FILTER (WHERE status <> 'on_leave') AS workdays,
            count(*) FILTER (WHERE status = 'late' AND date_trunc('month', work_date) = date_trunc('month', $2::date)) AS late_month,
            avg(extract(epoch FROM (clock_in AT TIME ZONE ${TZ_SQL})::time)) FILTER (WHERE clock_in IS NOT NULL) AS avg_in
     FROM attendance WHERE employee_id = $1 AND work_date > $3 AND work_date <= $2`, [id, date, since])).rows[0];
  const dept = emp.department_id ? (await q(
    `SELECT count(*) FILTER (WHERE a.clock_in IS NOT NULL) AS present, count(*) FILTER (WHERE a.status <> 'on_leave') AS workdays
     FROM attendance a JOIN employees e ON e.id = a.employee_id
     WHERE e.department_id = $1 AND a.work_date > $3 AND a.work_date <= $2`, [emp.department_id, date, since])).rows[0] : null;

  const rate = stat.workdays ? Math.round((stat.present / stat.workdays) * 1000) / 10 : null;
  const deptRate = dept?.workdays ? Math.round((dept.present / dept.workdays) * 1000) / 10 : null;
  const avgMin = stat.avg_in != null ? Math.round(stat.avg_in / 60) : null;
  const diff = avgMin != null ? toMin(emp.expected_in) - avgMin : null;

  const recent = (await q(
    `SELECT a.id, to_char(a.work_date, 'Mon DD, YYYY') AS date_label, a.status,
            to_char(a.clock_in AT TIME ZONE ${TZ_SQL}, 'HH12:MI AM') AS clock_in_label,
            to_char(a.clock_out AT TIME ZONE ${TZ_SQL}, 'HH12:MI AM') AS clock_out_label,
            CASE WHEN a.clock_out IS NULL AND a.clock_in IS NOT NULL AND a.work_date = $2::date
                 THEN round(GREATEST(0, extract(epoch FROM now() - a.clock_in)) / 3600, 1) ELSE a.hours END AS hours
     FROM attendance a WHERE a.employee_id = $1 ORDER BY a.work_date DESC LIMIT 30`, [id, date])).rows;
  const activity = (await q(
    `SELECT admin_name, action, reason, created_at FROM audit_logs
     WHERE (entity = 'employee' AND entity_id = $1) OR (entity = 'attendance' AND entity_id IN (SELECT id FROM attendance WHERE employee_id = $1))
     ORDER BY created_at DESC LIMIT 20`, [id])).rows;

  res.json({
    employee: emp, recent, activity,
    stats: {
      attendanceRate: rate, deptRate, lateCount: stat.late_month, leaveBalance: emp.leave_balance,
      avgClockIn: avgMin != null ? fmt12(avgMin) : null,
      avgNote: diff == null ? null : diff >= 0 ? `${diff} mins before schedule` : `${-diff} mins after schedule`,
    },
  });
});

function validate(b, creating) {
  const missing = ['first_name', 'last_name', 'email', 'department_id', 'role'].filter((k) => !String(b[k] ?? '').trim());
  if (missing.length) return `Please fill in: ${missing.join(', ').replace(/_/g, ' ')}.`;
  if (!/^\S+@\S+\.\S+$/.test(b.email)) return 'Enter a valid email address.';
  if (b.pin && !isPin(b.pin)) return 'PIN must be exactly 4 digits.';
  if (b.status && !STATUS.includes(b.status)) return 'Invalid status.';
  return null;
}

const val = (b, code) => [
  code, b.first_name.trim(), b.last_name.trim(), b.email.trim().toLowerCase(), b.phone || null, b.date_of_birth || null,
  b.photo_url || null, +b.department_id, b.role.trim(), b.employment_type || 'Permanent', b.start_date || new Date().toISOString().slice(0, 10),
  b.manager || null, b.status || 'active', b.work_schedule || 'Mon-Fri', b.expected_in || '09:00', b.expected_out || '17:00',
  parseInt(b.grace_minutes) || 0, b.grade_level ? +b.grade_level : null,
];

r.post('/', async (req, res) => {
  const err = validate(req.body, true);
  if (err) return res.status(400).json({ error: err });
  const pin = req.body.pin || (await freshPin());
  const code = await nextCode();
  try {
    const { rows } = await q(
      `INSERT INTO employees (code, first_name, last_name, email, phone, date_of_birth, photo_url, department_id, role, employment_type,
        start_date, manager, status, work_schedule, expected_in, expected_out, grace_minutes, grade_level, pin_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [...val(req.body, code), hashPin(pin)]);
    await audit(req.admin, { action: 'employee.create', entity: 'employee', entityId: rows[0].id, newValue: { code, name: `${req.body.first_name} ${req.body.last_name}` } });
    res.status(201).json({ id: rows[0].id, code, pin });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: /pin/.test(e.constraint || '') ? 'That PIN is already in use. Choose another.' : 'An employee with that email already exists.' });
    throw e;
  }
});

r.put('/:id', async (req, res) => {
  const id = +req.params.id;
  const err = validate(req.body, false);
  if (err) return res.status(400).json({ error: err });
  const old = (await q(`${BASE} WHERE e.id = $1`, [id])).rows[0];
  if (!old) return res.status(404).json({ error: 'Employee not found.' });
  try {
    await q(
      `UPDATE employees SET first_name=$2,last_name=$3,email=$4,phone=$5,date_of_birth=$6,photo_url=$7,department_id=$8,role=$9,
        employment_type=$10,start_date=$11,manager=$12,status=$13,work_schedule=$14,expected_in=$15,expected_out=$16,grace_minutes=$17,grade_level=$18
       WHERE id=$1`, [id, ...val(req.body, old.code).slice(1)]);
    if (req.body.pin) await q('UPDATE employees SET pin_hash = $2 WHERE id = $1', [id, hashPin(req.body.pin)]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: /pin/.test(e.constraint || '') ? 'That PIN is already in use. Choose another.' : 'An employee with that email already exists.' });
    throw e;
  }
  await audit(req.admin, { action: 'employee.update', entity: 'employee', entityId: id, oldValue: old, newValue: { ...req.body, pin: req.body.pin ? '(changed)' : undefined } });
  res.json({ id });
});

// Deactivate rather than delete so attendance history is preserved
r.delete('/:id', async (req, res) => {
  const id = +req.params.id;
  const { rowCount } = await q(`UPDATE employees SET status = 'inactive' WHERE id = $1`, [id]);
  if (!rowCount) return res.status(404).json({ error: 'Employee not found.' });
  await audit(req.admin, { action: 'employee.deactivate', entity: 'employee', entityId: id, reason: req.body?.reason });
  res.json({ id });
});

export default r;
