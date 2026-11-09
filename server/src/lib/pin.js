import crypto from 'crypto';
import 'dotenv/config';

const SECRET = process.env.PIN_SECRET || 'dev-pin-secret';

// Deterministic keyed hash so a PIN can be looked up without ever storing it in plain text
export const hashPin = (pin) => crypto.createHmac('sha256', SECRET).update(String(pin)).digest('hex');
export const isPin = (pin) => /^\d{4}$/.test(String(pin ?? ''));
