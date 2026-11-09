export const initials = (name = '') => name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
export const fmtHours = (h) => (h == null ? '0.0 hrs' : `${Number(h).toFixed(1)} hrs`);
export const todayLabel = (opts = { month: 'short', day: 'numeric', year: 'numeric' }) => new Date().toLocaleDateString('en-US', opts);
export const num = (n) => Number(n ?? 0).toLocaleString();
