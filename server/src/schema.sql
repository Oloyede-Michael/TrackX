CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'HR Manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  photo_url TEXT,
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  grade_level INT CHECK (grade_level BETWEEN 1 AND 17),
  employment_type TEXT NOT NULL DEFAULT 'Permanent',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  manager TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','on_leave')),
  pin_hash TEXT UNIQUE,
  work_schedule TEXT NOT NULL DEFAULT 'Mon-Fri',
  expected_in TIME NOT NULL DEFAULT '08:00',
  expected_out TIME NOT NULL DEFAULT '16:00',
  grace_minutes INT NOT NULL DEFAULT 15,
  leave_balance INT NOT NULL DEFAULT 21,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  hours NUMERIC(5,2),
  status TEXT NOT NULL CHECK (status IN ('on_time','late','absent','half_day','on_leave')),
  early_departure BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  corrected BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (employee_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (work_date);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES admins(id) ON DELETE SET NULL,
  admin_name TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
