import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { q } from './db.js';
import { TZ } from './lib/time.js';
import { requireAdmin } from './middleware.js';
import auth from './routes/auth.js';
import kiosk from './routes/kiosk.js';
import dashboard from './routes/dashboard.js';
import attendance from './routes/attendance.js';
import employees from './routes/employees.js';
import reports from './routes/reports.js';
import settings from './routes/settings.js';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await q('SELECT 1');
    res.json({ ok: true, time: new Date().toISOString(), timezone: TZ });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/auth', auth);
app.use('/api/kiosk', kiosk);
app.use('/api/dashboard', requireAdmin, dashboard);
app.use('/api/attendance', requireAdmin, attendance);
app.use('/api/employees', requireAdmin, employees);
app.use('/api/reports', requireAdmin, reports);
app.use('/api', requireAdmin, settings);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app in production
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()));
}

app.use((err, _req, res, _next) => {
  if (!err.status || err.status >= 500) console.error(err);
  if (err.code === '23505') return res.status(409).json({ error: 'A record with those details already exists.' });
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
});

const port = process.env.PORT || 4000;
app.listen(port, async () => {
  console.log(`TrackX API running on http://localhost:${port} (timezone ${TZ})`);
  try {
    await q('SELECT 1');
    console.log('[db] connected');
  } catch (err) {
    const detail = err.code || err.errors?.map((e) => e.message).join('; ') || err.message;
    const host = process.env.PGHOST || 'localhost';
    const pgPort = process.env.PGPORT || 5432;
    console.error(
      `[db] Cannot reach PostgreSQL at ${host}:${pgPort} (${detail}).\n` +
        '     Start the database first — `docker compose up -d` from the project root, or start\n' +
        '     the PostgreSQL service — then restart the API.'
    );
  }
});
