import { Router } from 'express';
import { q } from '../db.js';
import { audit } from '../lib/audit.js';
import { TZ } from '../lib/time.js';

const r = Router();
const KEYS = ['company_name', 'default_clock_in', 'default_clock_out', 'default_grace'];

async function getSettings() {
  const { rows } = await q('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((x) => [x.key, x.value]));
}

// Departments + defaults used by filters and forms across the dashboard
r.get('/meta', async (_req, res) => {
  const departments = (await q(
    `SELECT d.id, d.name, count(e.id) FILTER (WHERE e.status <> 'inactive') AS employees
     FROM departments d LEFT JOIN employees e ON e.department_id = d.id GROUP BY d.id ORDER BY d.name`)).rows;
  const managers = (await q(`SELECT DISTINCT manager FROM employees WHERE manager IS NOT NULL ORDER BY manager`)).rows.map((x) => x.manager);
  res.json({ departments, managers, settings: await getSettings(), timezone: TZ });
});

r.put('/settings', async (req, res) => {
  const old = await getSettings();
  for (const k of KEYS) {
    if (req.body[k] == null) continue;
    await q(`INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2`, [k, String(req.body[k])]);
  }
  const next = await getSettings();
  await audit(req.admin, { action: 'settings.update', entity: 'settings', oldValue: old, newValue: next });
  res.json(next);
});

r.post('/departments', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Enter a department name.' });
  const { rows } = await q('INSERT INTO departments (name) VALUES ($1) RETURNING *', [name]);
  await audit(req.admin, { action: 'department.create', entity: 'department', entityId: rows[0].id, newValue: rows[0] });
  res.status(201).json(rows[0]);
});

r.get('/audit', async (_req, res) => {
  const { rows } = await q(
    `SELECT id, admin_name, action, entity, entity_id, reason, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 25`);
  res.json({ rows });
});

export default r;
