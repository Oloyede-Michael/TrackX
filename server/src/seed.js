import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { hashPin } from './lib/pin.js';
import { localParts, zonedToDate, addDays, toMin } from './lib/time.js';

// Small deterministic RNG so reseeding gives the same shape of data
let s = 20261022;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// Departments of the local government secretariat and typical designations in each
const DEPTS = {
  'Administration & General Services': ['Administrative Officer', 'Executive Officer', 'Clerical Officer', 'Typist'],
  'Finance & Supply': ['Accountant', 'Treasury Officer', 'Revenue Officer', 'Store Officer'],
  'Works & Housing': ['Engineer', 'Technical Officer', 'Works Superintendent', 'Draughtsman'],
  'Primary Health Care': ['Health Officer', 'Nursing Officer', 'Community Health Extension Worker', 'Environmental Health Officer'],
  'Education & Social Services': ['Education Officer', 'Social Welfare Officer', 'Youth Development Officer'],
  'Agriculture & Rural Development': ['Agricultural Officer', 'Extension Agent', 'Veterinary Officer'],
  'Budget, Planning & Statistics': ['Planning Officer', 'Statistician', 'Budget Analyst'],
  'Legal & Establishment': ['Legal Officer', 'Personnel Officer', 'Registry Officer'],
  'Environment & Sanitation': ['Sanitation Officer', 'Environmental Officer', 'Waste Management Officer'],
  'Information & Protocol': ['Information Officer', 'Protocol Officer', 'ICT Officer'],
};
const FIRST = ['Adebayo','Chinedu','Ngozi','Tunde','Folake','Emeka','Aisha','Ibrahim','Kemi','Segun','Bola','Chiamaka','Yusuf','Zainab','Femi','Ada','Obinna','Temitope','Hauwa','Seyi','Ifeoma','Kelechi','Damilola','Nkechi','Uche','Sade','Gbenga','Halima','Tobi','Lara','Wale','Grace','Daniel','Esther','Samuel','Ruth','Peter','Naomi','Victor','Linda','Moses','Funmilayo','Rasheed','Bukola'];
const LAST = ['Okafor','Adeyemi','Bello','Eze','Balogun','Nwosu','Ogunleye','Abubakar','Okonkwo','Salami','Adebayo','Ibe','Lawal','Musa','Onyeama','Fashola','Ajayi','Danjuma','Obi','Afolabi','Ogundipe','Yakubu','Chukwu','Ojo','Idowu','Oyewole','Akinola','Badmus','Ishola','Olawale'];
const MANAGERS = ['Head of Department', 'Director of Personnel Management', 'Supervisor, Administration', 'Treasurer'];

// Named staff. Folasade & Chukwuemeka have no punch today so you can try the kiosk straight away.
const NAMED = [
  ['Folasade', 'Adeyemi', 'OJLG-0012', 'Administration & General Services', 'Administrative Officer', 'active', '1234', 9],
  ['Chukwuemeka', 'Okafor', 'OJLG-0034', 'Finance & Supply', 'Accountant', 'active', '2345', 10],
  ['Ibrahim', 'Bello', 'OJLG-0051', 'Works & Housing', 'Technical Officer', 'active', '3456', 8],
  ['Rasheed', 'Ogunleye', 'OJLG-0063', 'Information & Protocol', 'ICT Officer', 'inactive', '4567', 9],
  ['Aisha', 'Musa', 'OJLG-0078', 'Primary Health Care', 'Environmental Health Officer', 'active', '5678', 12],
  ['Tunde', 'Balogun', 'OJLG-0085', 'Budget, Planning & Statistics', 'Planning Officer', 'on_leave', '6789', 10],
  ['Ngozi', 'Eze', 'OJLG-0092', 'Legal & Establishment', 'Personnel Officer', 'active', '7890', 13],
  ['Blessing', 'Nwosu', 'OJLG-0104', 'Education & Social Services', 'Social Welfare Officer', 'on_leave', '8901', 8],
];
const DEMO_NO_PUNCH = new Set(['OJLG-0012', 'OJLG-0034']);
const TOTAL_STAFF = 250;

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('TRUNCATE audit_logs, attendance, employees, departments, admins, settings RESTART IDENTITY CASCADE');

  await client.query(`INSERT INTO admins (name, email, password_hash, title) VALUES ($1,$2,$3,$4)`,
    ['Amina Bello', 'hr@ojolg.example', await bcrypt.hash('TrackX@2026', 10), 'Head of Personnel Management']);
  for (const [k, v] of Object.entries({ company_name: 'Ojo Local Government Secretariat', default_clock_in: '08:00', default_clock_out: '16:00', default_grace: '15' }))
    await client.query('INSERT INTO settings VALUES ($1,$2)', [k, v]);

  const deptId = {};
  for (const name of Object.keys(DEPTS)) deptId[name] = (await client.query('INSERT INTO departments (name) VALUES ($1) RETURNING id', [name])).rows[0].id;

  // ---- staff ----
  const usedPins = new Set(NAMED.map((n) => n[6]));
  const people = NAMED.map(([f, l, code, dept, role, status, pin, gl]) => ({ f, l, code, dept, role, status, pin, gl }));
  const used = new Set(NAMED.map((n) => n[2]));
  let n = 0;
  while (people.length < TOTAL_STAFF) {
    n += ri(1, 2);
    const code = `OJLG-${String(n).padStart(4, '0')}`;
    if (used.has(code)) continue;
    used.add(code);
    const dept = pick(Object.keys(DEPTS));
    let pin; do { pin = String(ri(0, 9999)).padStart(4, '0'); } while (usedPins.has(pin));
    usedPins.add(pin);
    const status = people.length < 24 ? 'on_leave' : rnd() < 0.02 ? 'inactive' : 'active';
    people.push({ f: pick(FIRST), l: pick(LAST), code, dept, role: pick(DEPTS[dept]), status, pin, gl: ri(3, 16) });
  }
  // keep roughly 15 staff on leave
  let leaveCount = people.filter((p) => p.status === 'on_leave').length;
  for (const p of people) if (leaveCount > 15 && p.status === 'on_leave' && !NAMED.some((x) => x[2] === p.code)) { p.status = 'active'; leaveCount--; }

  const emp = [];
  let idx = 0;
  for (const p of people) {
    idx++;
    const late = rnd() < 0.1;               // 10% work 9:00–17:00 (e.g. support units)
    const expIn = late ? '09:00' : '08:00', expOut = late ? '17:00' : '16:00';
    const type = rnd() < 0.86 ? 'Permanent' : rnd() < 0.7 ? 'Contract' : 'Temporary';
    const { rows } = await client.query(
      `INSERT INTO employees (code, first_name, last_name, email, phone, date_of_birth, department_id, role, grade_level, employment_type,
         start_date, manager, status, pin_hash, work_schedule, expected_in, expected_out, grace_minutes, leave_balance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Mon-Fri',$15,$16,15,$17) RETURNING id`,
      [p.code, p.f, p.l, `${p.f}.${p.l}${idx}@ojolg.example`.toLowerCase(), `+234 80${ri(10000000, 99999999)}`,
       `${ri(1965, 2000)}-${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`, deptId[p.dept], p.role, p.gl, type,
       `${ri(2005, 2025)}-${String(ri(1, 12)).padStart(2, '0')}-${String(ri(1, 28)).padStart(2, '0')}`,
       pick(MANAGERS), p.status, hashPin(p.pin), expIn, expOut, ri(10, 30)]);
    emp.push({ id: rows[0].id, ...p, expIn: toMin(expIn), expOut: toMin(expOut), grace: 15 });
  }

  // ---- attendance: last 45 days of weekdays ----
  const today = localParts().date;
  const rowsOut = [];
  const push = (e, date, status, inMin, outMin) => {
    const cin = inMin != null ? zonedToDate(date, inMin) : null;
    const cout = outMin != null ? zonedToDate(date, outMin) : null;
    const hours = cin && cout ? Math.round(((cout - cin) / 3600000) * 100) / 100 : null;
    rowsOut.push([e.id, date, cin, cout, hours, status, outMin != null && outMin < e.expOut]);
  };
  for (let back = 45; back >= 0; back--) {
    const date = addDays(today, -back);
    const dow = new Date(date + 'T12:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const isToday = back === 0;
    for (const e of emp) {
      if (e.status === 'inactive') continue;
      if (isToday) {
        if (DEMO_NO_PUNCH.has(e.code)) continue;
        if (e.status === 'on_leave') { push(e, date, 'on_leave'); continue; }
      }
      const roll = rnd();
      if (!isToday && e.status === 'on_leave' && back < 10) { push(e, date, 'on_leave'); continue; }
      if (roll < 0.03) { push(e, date, 'absent'); continue; }
      if (roll < 0.05) { push(e, date, 'on_leave'); continue; }
      if (isToday && roll < 0.09) continue; // has not punched in yet
      const isLate = roll > 0.89;
      const inMin = isLate ? e.expIn + e.grace + ri(1, 70) : e.expIn - ri(0, 35) + ri(0, 10);
      const status = isLate ? 'late' : 'on_time';
      const half = roll > 0.86 && roll <= 0.89;
      if (half) { push(e, date, 'half_day', inMin, inMin + ri(200, 235)); continue; }
      if (isToday) push(e, date, status, inMin, null);
      else push(e, date, status, inMin, e.expOut + ri(-12, 75));
    }
  }
  for (let i = 0; i < rowsOut.length; i += 500) {
    const chunk = rowsOut.slice(i, i + 500);
    const cols = [[], [], [], [], [], [], []];
    chunk.forEach((r) => r.forEach((v, c) => cols[c].push(v)));
    await client.query(
      `INSERT INTO attendance (employee_id, work_date, clock_in, clock_out, hours, status, early_departure)
       SELECT * FROM unnest($1::int[], $2::date[], $3::timestamptz[], $4::timestamptz[], $5::numeric[], $6::text[], $7::boolean[])`, cols);
  }
  await client.query('COMMIT');
  console.log(`Seeded ${emp.length} staff, ${rowsOut.length} attendance rows, 1 admin.`);
  console.log('Admin login:  hr@ojolg.example / TrackX@2026');
  console.log('Kiosk demo PINs (no punch yet today): Folasade Adeyemi 1234, Chukwuemeka Okafor 2345');
} catch (e) {
  await client.query('ROLLBACK');
  console.error(e);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
