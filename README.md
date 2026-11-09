# TrackX — Staff Attendance Management System
**Ojo Local Government Secretariat**

Vite + React + Tailwind CSS · Express.js · PostgreSQL

Two interfaces share one backend:

| Interface | URL (dev) | Who uses it |
|---|---|---|
| **Attendance Terminal (kiosk)** | http://localhost:5173/ | Staff, on the tablet at the secretariat entrance — clock in / out with a 4-digit PIN |
| **Admin Dashboard** | http://localhost:5173/admin | Personnel / HR officers and management — dashboard, attendance history, staff records, reports, settings |

## 1. Requirements
- Node.js 18+ (built with 22)
- PostgreSQL 14+ (or run `docker compose up -d` to start one using the included `docker-compose.yml`)

## 2. Setup
```bash
# 1. Database (skip if you use docker compose)
createdb trackx            # or create it in pgAdmin / psql

# 2. Configure
cp server/.env.example server/.env     # edit DATABASE_URL, JWT_SECRET, PIN_SECRET

# 3. Install, create tables, seed dummy data
npm run install:all
npm run db:setup           # schema + 250 staff, 10 departments, ~45 days of attendance
```

## 3. Run
```bash
npm run dev:server         # API on http://localhost:4000
npm run dev:client         # React app on http://localhost:5173 (proxies /api to :4000)
```
Production: `npm run build && npm start` — Express then serves the built React app and the API together on port 4000.

### If the API logs `ECONNREFUSED ...:5432`

That is not an app config problem: nothing is listening on the Postgres port, so the database simply is not running yet.

- Local install: start the service (`net start postgresql-x64-16` in an admin prompt on Windows, or `brew services start postgresql@16`, or `sudo systemctl start postgresql`) and check the port with `psql -h localhost -p 5432 -U postgres -d trackx`.
- Docker: `docker compose up -d`, then set `PGUSER=trackx` and `PGPASSWORD=trackx` in `server/.env` — the included compose file creates the `trackx` superuser, not `postgres`.
- Different port (e.g. a Postgres installed on 5433)? Match it with `PGPORT` in `server/.env`.

## 4. Demo logins
- **Admin:** `hr@ojolg.example` / `TrackX@2026` (pre-filled on the login page)
- **Kiosk PINs:** Folasade Adeyemi `1234`, Chukwuemeka Okafor `2345` (neither has punched yet today, so you can try Clock In → Clock Out). Every other seeded staff member has a random PIN; set or reset any PIN from *Employees → Edit*.
- `npm run db:seed` wipes and reseeds everything, including today's punches.

> Clocking out immediately after clocking in records under 4 hours worked, so it correctly shows **Half Day**.

## 5. Built for a local government secretariat
- **Staff ID** format `OJLG-0001`, generated automatically.
- **Designation / Rank** and **Grade Level (GL 01 – GL 17)** on every staff record; employment types Permanent, Contract, Temporary, NYSC / Intern.
- Ten secretariat departments pre-loaded (Administration & General Services, Finance & Supply, Works & Housing, Primary Health Care, Education & Social Services, Agriculture & Rural Development, Budget Planning & Statistics, Legal & Establishment, Environment & Sanitation, Information & Protocol). Add more under *Settings*.
- Default civil-service hours **8:00 AM – 4:00 PM, Mon–Fri, 15-minute grace period**, all editable per staff member or as defaults in *Settings*.
- White and yellow theme (`brand #F5B800`, soft yellow tints) — see `client/tailwind.config.js`.

## 6. Features
**Kiosk** — clock/date, Clock In / Clock Out, PIN keypad (touch or keyboard), confirmation screen with 10 s auto-return, error states (incorrect PIN, already clocked in/out, no clock-in found, network error), online/offline indicator, lock-out after 10 failed attempts in 5 minutes.

**Admin** — secure login (JWT, bcrypt, rate-limited) · dashboard stats + today's attendance · attendance history with date/department/status/name filters · manual correction with a mandatory reason · staff list, add, edit, profile (Overview / Attendance / Schedule / Activity), deactivate · daily / weekly / monthly reports · Excel & CSV export · settings (default rules, departments) · audit log.

**Rules** (per staff member, nothing hard-coded): on time until `expected clock-in + grace`, otherwise late; under 4 h worked = half day; clock-out before the expected time flags an early departure. Timestamps always use **server time** in `APP_TIMEZONE` (default `Africa/Lagos`).

## 7. Project structure
```
server/src
  index.js  db.js  schema.sql  initDb.js  seed.js  middleware.js
  routes/   auth · kiosk · dashboard · attendance · employees · reports · settings
  lib/      time · attendance (rules) · pin · export · audit
client/src
  pages/        Kiosk · Login · Dashboard · Attendance · Employees · EmployeeForm · EmployeeProfile · Reports · Settings
  components/   AdminLayout · ui (Avatar, StatusBadge, Pagination, Modal …)
```

## 8. Not built yet (suggested next steps)
- Public-holiday calendar (holidays are currently treated as normal working days).
- Kiosk offline queue (punches are rejected with "Connection unavailable" while the server is unreachable).
- Nightly job to mark absences and auto clock-out after N hours (today absences are seeded or set by an admin correction).
- Profile photo upload (photos are an optional URL; initials avatars are shown otherwise).
- Leave requests / approvals, multiple admin roles, password reset, payroll integration.
- Kiosk lock-down (guided-access mode on the tablet) is a device setting, not app code.
