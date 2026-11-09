import { Router } from 'express';
import { q } from '../db.js';
import { isDate, localParts, addDays, fmt12 } from '../lib/time.js';
import { sendExport } from '../lib/export.js';
import { TZ_SQL } from '../lib/time.js';

const r = Router();

async function summary(qs) {
  const today = localParts().date;
  const period = { daily: 0, weekly: 6, monthly: 29 }[qs.period] ?? 6;
  const to = isDate(qs.to) ? qs.to : today;
  const from = isDate(qs.from) ? qs.from : addDays(to, -period);
  const p = [from, to];
  let dept = '';
  if (qs.department) { p.push(+qs.department); dept = `AND e.department_id = $3`; }
  const { rows } = await q(
    `SELECT e.id AS employee_id, e.code, e.first_name || ' ' || e.last_name AS name, d.name AS department,
       count(*) FILTER (WHERE a.clock_in IS NOT NULL) AS days_present,
       count(*) FILTER (WHERE a.status = 'absent') AS days_absent,
       count(*) FILTER (WHERE a.status = 'late') AS late_days,
       count(*) FILTER (WHERE a.early_departure) AS early_departures,
       round(coalesce(sum(a.hours), 0), 1) AS total_hours,
       round(coalesce(sum(GREATEST(0, a.hours - extract(epoch FROM (e.expected_out - e.expected_in)) / 3600)) FILTER (WHERE a.hours IS NOT NULL), 0), 1) AS overtime,
       avg(extract(epoch FROM (a.clock_in AT TIME ZONE ${TZ_SQL})::time)) FILTER (WHERE a.clock_in IS NOT NULL) AS avg_in
     FROM employees e LEFT JOIN departments d ON d.id = e.department_id
     JOIN attendance a ON a.employee_id = e.id AND a.work_date BETWEEN $1 AND $2
     WHERE e.status <> 'inactive' ${dept}
     GROUP BY e.id, d.name ORDER BY e.id`, p);
  return { from, to, rows: rows.map((x) => ({ ...x, avg_clock_in: x.avg_in != null ? fmt12(Math.round(x.avg_in / 60)) : '—' })) };
}

r.get('/summary', async (req, res) => {
  const s = await summary(req.query);
  const page = Math.max(1, parseInt(req.query.page) || 1), pageSize = 10;
  const t = s.rows.reduce((a, x) => ({ present: a.present + x.days_present, late: a.late + x.late_days, hours: a.hours + x.total_hours, overtime: a.overtime + x.overtime }),
    { present: 0, late: 0, hours: 0, overtime: 0 });
  res.json({ from: s.from, to: s.to, total: s.rows.length, page, pageSize, rows: s.rows.slice((page - 1) * pageSize, page * pageSize),
    totals: { ...t, hours: Math.round(t.hours), overtime: Math.round(t.overtime) } });
});

r.get('/export', async (req, res) => {
  const s = await summary(req.query);
  await sendExport(res, req.query.format === 'csv' ? 'csv' : 'xlsx', `trackx-report-${s.from}-to-${s.to}`, [
    { header: 'Employee', key: 'name', width: 24 }, { header: 'Employee ID', key: 'code' }, { header: 'Department', key: 'department', width: 24 },
    { header: 'Days Present', key: 'days_present' }, { header: 'Days Absent', key: 'days_absent' }, { header: 'Late Days', key: 'late_days' },
    { header: 'Average Clock-In', key: 'avg_clock_in' }, { header: 'Total Hours', key: 'total_hours' },
    { header: 'Overtime Hours', key: 'overtime' }, { header: 'Early Departures', key: 'early_departures' },
  ], s.rows);
});

export default r;
