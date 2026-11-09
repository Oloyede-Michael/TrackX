import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { q } from '../db.js';
import { JWT_SECRET, requireAdmin } from '../middleware.js';

const r = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in a few minutes.' } });

r.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Enter your work email and password.' });
  const { rows } = await q('SELECT * FROM admins WHERE lower(email) = lower($1)', [email]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash)))
    return res.status(401).json({ error: 'Incorrect email or password.' });
  const user = { id: admin.id, name: admin.name, title: admin.title, email: admin.email };
  res.json({ token: jwt.sign(user, JWT_SECRET, { expiresIn: '8h' }), user });
});

r.get('/me', requireAdmin, (req, res) => {
  const { id, name, title, email } = req.admin;
  res.json({ user: { id, name, title, email } });
});

export default r;
