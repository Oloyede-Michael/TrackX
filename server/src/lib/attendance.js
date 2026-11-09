import { localParts, toMin } from './time.js';

/**
 * Attendance rules (configurable per employee: expected_in / expected_out / grace_minutes)
 *   clock-in  <= expected_in + grace  -> on_time (this includes early arrivals)
 *   clock-in  >  expected_in + grace  -> late
 *   worked < 4 hours                   -> half_day
 *   clock-out < expected_out           -> early_departure flag
 */
export function clockInStatus(emp, when) {
  const { minutes } = localParts(when);
  return minutes <= toMin(emp.expected_in) + emp.grace_minutes ? 'on_time' : 'late';
}

export function workedHours(clockIn, clockOut) {
  return Math.max(0, Math.round(((clockOut - clockIn) / 3600000) * 100) / 100);
}

export function clockOutResult(emp, clockIn, clockOut, currentStatus) {
  const hours = workedHours(new Date(clockIn), clockOut);
  const early = localParts(clockOut).minutes < toMin(emp.expected_out);
  const status = hours < 4 ? 'half_day' : currentStatus;
  return { hours, early, status };
}

export function greeting(when) {
  const h = Math.floor(localParts(when).minutes / 60);
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
