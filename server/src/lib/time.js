import 'dotenv/config';

export const TZ = process.env.APP_TIMEZONE || 'Africa/Lagos';
if (!/^[A-Za-z_\/+-]+$/.test(TZ)) throw new Error('Invalid APP_TIMEZONE');
export const TZ_SQL = `'${TZ}'`;

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function raw(d) {
  const o = {};
  fmt.formatToParts(d).forEach((p) => (o[p.type] = p.value));
  return o;
}

/** Local date (YYYY-MM-DD) and minutes-since-midnight for an instant, in the company timezone */
export function localParts(d = new Date()) {
  const o = raw(d);
  return { date: `${o.year}-${o.month}-${o.day}`, minutes: (Number(o.hour) % 24) * 60 + Number(o.minute) };
}

/** Convert a local date + minutes-since-midnight to a real instant */
export function zonedToDate(dateStr, minutes) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const want = Date.UTC(y, m - 1, d, 0, minutes);
  let utc = want;
  for (let i = 0; i < 2; i++) {
    const o = raw(new Date(utc));
    const wall = Date.UTC(+o.year, +o.month - 1, +o.day, Number(o.hour) % 24, +o.minute);
    utc += want - wall;
  }
  return new Date(utc);
}

export const toMin = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };

export function fmt12(min) {
  const h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
