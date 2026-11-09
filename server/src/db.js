import 'dotenv/config';
import pg from 'pg';

// Return DATE as 'YYYY-MM-DD', and numeric / bigint as numbers
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export const pool = new pg.Pool();

// Idle clients can emit 'error' (e.g. Postgres restarting). Without a listener
// that is an unhandled event and takes the whole API process down.
pool.on('error', (err) => console.error(`[db] idle client error: ${err.message || err.code}`));

export const q = (text, params) => pool.query(text, params);
