import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { q } from '../db.js';
import { hashPin, isPin } from '../lib/pin.js';
import { localParts, fmt12 } from '../lib/time.js';
import { clockInStatus, clockOutResult, greeting } from '../lib/attendance.js';

const r = Router();

// Brute-force protection: only failed attempts (HTTP >= 400) count towards the limit
const failLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, max: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many failed attempts. Please wait a few minutes.' },
});

const fail = (status, error) => Object.assign(new Error(error), { status });

r.post('/punch', failLimiter, async (req, res) => {
  const { pin, action } = req.body || {};
  if (!['in', 'out'].includes(action)) throw fail(400, 'Choose Clock In or Clock Out first.');
  if (!isPin(pin)) throw fail(400, 'Enter your 4-digit PIN.');

  const { rows } = await q(
    `SELECT e.*, d.name AS department FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE e.pin_hash = $1`,
    [hashPin(pin)]
  );
  const emp = rows[0];
  if (!emp || emp.status === 'inactive') throw fail(401, 'Incorrect PIN. Please try again.');
  if (emp.status === 'on_leave') throw fail(403, 'You are marked as on leave today. Please contact your administrator.');

  const now = new Date(); // always server time
  const { date } = localParts(now);
  const existing = (await q('SELECT * FROM attendance WHERE employee_id = $1 AND work_date = $2', [emp.id, date])).rows[0];
  const base = {
    name: `${emp.first_name} ${emp.last_name}`, firstName: emp.first_name, department: emp.department,
    photoUrl: emp.photo_url, action, recordedAt: now.toISOString(), recordedLabel: fmt12(localParts(now).minutes),
  };

  if (action === 'in') {
    if (existing?.clock_in) throw fail(409, 'You have already clocked in today.');
    const status = clockInStatus(emp, now);
    await q(
      `INSERT INTO attendance (employee_id, work_date, clock_in, status) VALUES ($1,$2,$3,$4)
       ON CONFLICT (employee_id, work_date) DO UPDATE SET clock_in = EXCLUDED.clock_in, status = EXCLUDED.status
       WHERE attendance.clock_in IS NULL AND attendance.status = 'absent'`,
      [emp.id, date, now, status]
    );
    return res.json({ ...base, status, greeting: `${greeting(now)}, ${emp.first_name}!` });
  }

  if (!existing?.clock_in) throw fail(404, 'No clock-in record found for today. Please contact your administrator.');
  if (existing.clock_out) throw fail(409, 'You have already clocked out today.');
  const out = clockOutResult(emp, existing.clock_in, now, existing.status);
  await q('UPDATE attendance SET clock_out=$1, hours=$2, early_departure=$3, status=$4 WHERE id=$5',
    [now, out.hours, out.early, out.status, existing.id]);
  res.json({ ...base, status: out.status, hours: out.hours, earlyDeparture: out.early, greeting: `Goodbye, ${emp.first_name}!` });
});

export default r;
