import { Router } from 'express';
import { q } from '../db.js';
import { TZ_SQL, localParts } from '../lib/time.js';

const r = Router();
const HOURS_NOW = `round(GREATEST(0, extract(epoch FROM now() - a.clock_in)) / 3600, 1)`;

r.get('/stats', async (_req, res) => {
  const { date, minutes } = localParts();
  const { rows } = await q(
    `SELECT
       (SELECT count(*) FROM employees WHERE status <> 'inactive') AS total,
       count(*) FILTER (WHERE a.clock_in IS NOT NULL) AS present,
       count(*) FILTER (WHERE a.status = 'late') AS late,
       count(*) FILTER (WHERE a.status = 'absent') AS absent,
       count(*) FILTER (WHERE a.status = 'on_leave') AS on_leave,
       count(*) FILTER (WHERE a.clock_in IS NOT NULL AND a.clock_out IS NULL
                         AND (extract(hour FROM e.expected_out) * 60 + extract(minute FROM e.expected_out)) <= $2) AS not_clocked_out
     FROM attendance a JOIN employees e ON e.id = a.employee_id
     WHERE a.work_date = $1 AND e.status <> 'inactive'`,
    [date, minutes]
  );
  res.json({ date, ...rows[0] });
});

r.get('/today', async (req, res) => {
  const { date } = localParts();
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, parseInt(req.query.pageSize) || 8);
  const p = [date];
  const w = [`e.status <> 'inactive'`];
  if (req.query.department) { p.push(+req.query.department); w.push(`e.department_id = $${p.length}`); }
  if (req.query.status) {
    if (req.query.status === 'not_in') w.push('a.id IS NULL'); else { p.push(req.query.status); w.push(`a.status = $${p.length}`); }
  }
  if (req.query.q) { p.push(`%${req.query.q}%`); w.push(`((e.first_name || ' ' || e.last_name) ILIKE $${p.length} OR e.code ILIKE $${p.length})`); }
  const from = `FROM employees e LEFT JOIN departments d ON d.id = e.department_id
                LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date = $1 WHERE ${w.join(' AND ')}`;
  const total = (await q(`SELECT count(*) AS n ${from}`, p)).rows[0].n;
  const { rows } = await q(
    `SELECT e.id AS employee_id, e.code, e.first_name || ' ' || e.last_name AS name, e.photo_url, d.name AS department,
            to_char(a.clock_in AT TIME ZONE ${TZ_SQL}, 'HH12:MI AM') AS clock_in_label,
            to_char(a.clock_out AT TIME ZONE ${TZ_SQL}, 'HH12:MI AM') AS clock_out_label,
            COALESCE(a.hours, CASE WHEN a.clock_in IS NOT NULL THEN ${HOURS_NOW} END) AS hours,
            COALESCE(a.status, 'not_in') AS status
     ${from} ORDER BY e.id LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    p
  );
  const punches = (await q(`SELECT count(*) AS n FROM attendance WHERE work_date = $1 AND clock_in IS NOT NULL`, [date])).rows[0].n;
  res.json({ rows, total, page, pageSize, punches });
});

export default r;
