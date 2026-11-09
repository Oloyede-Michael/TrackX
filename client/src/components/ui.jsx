import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Fingerprint } from 'lucide-react';
import { initials } from '../utils';

export function Logo({ size = 'md', label = true }) {
  const box = size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-8 w-8 rounded-lg';
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${box} grid place-items-center bg-brand text-ink`}><Fingerprint className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} /></div>
      {label && <span className={`font-extrabold tracking-tight ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>TrackX</span>}
    </div>
  );
}

const TINTS = ['#F7E07E', '#F3D457', '#FCEFB0', '#EBC93F', '#F9E89A'];
export function Avatar({ name, src, size = 32, ring = false }) {
  const tint = TINTS[(name || '').length % TINTS.length];
  const style = { width: size, height: size, background: tint, fontSize: size * 0.38 };
  return src ? (
    <img src={src} alt="" style={style} className={`rounded-full object-cover ${ring ? 'ring-2 ring-clay' : ''}`} />
  ) : (
    <div style={style} className={`grid shrink-0 place-items-center rounded-full font-bold text-clay-deep ${ring ? 'ring-2 ring-clay' : ''}`}>{initials(name)}</div>
  );
}

const BADGE = {
  on_time: ['ON TIME', 'bg-peach text-clay-dark'],
  late: ['LATE', 'bg-peach-300 text-clay-deep'],
  absent: ['ABSENT', 'bg-clay-deep text-peach'],
  half_day: ['HALF DAY', 'bg-peach text-clay-deep ring-1 ring-clay/40'],
  on_leave: ['ON LEAVE', 'bg-white text-clay-dark ring-1 ring-clay/50'],
  not_in: ['NOT IN', 'bg-peach-100 text-clay'],
  active: ['ACTIVE', 'bg-peach text-clay-dark'],
  inactive: ['INACTIVE', 'bg-peach-100 text-clay ring-1 ring-peach-300'],
};
export function StatusBadge({ status }) {
  const [label, cls] = BADGE[status] || [String(status).toUpperCase(), 'bg-peach text-clay-dark'];
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold tracking-wide ${cls}`}>{label}</span>;
}

export function Pagination({ page, pageSize, total, onPage, noun = 'records' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  const nums = Array.from({ length: Math.min(3, pages) }, (_, i) => start + i);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs text-ink/70">
      <span>Showing {from}-{to} of {total.toLocaleString()} {noun}</span>
      <div className="flex items-center gap-1.5">
        <button className="btn-outline !px-3 !py-1.5 !text-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-3.5 w-3.5" />Previous</button>
        {nums.map((n) => (
          <button key={n} onClick={() => onPage(n)} aria-current={n === page}
            className={`h-8 w-8 rounded-lg text-xs font-semibold ${n === page ? 'bg-peach text-clay-deep' : 'text-ink/70 hover:bg-peach-50'}`}>{n}</button>
        ))}
        <button className="btn-outline !px-3 !py-1.5 !text-xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink/50">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-peach-50"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Loading = ({ rows = 6 }) => (
  <div className="space-y-2 p-5" aria-busy="true">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-peach-100" />)}
  </div>
);

export const Empty = ({ title, hint }) => (
  <div className="px-6 py-14 text-center">
    <p className="font-semibold">{title}</p>
    {hint && <p className="mt-1 text-sm text-ink/60">{hint}</p>}
  </div>
);

export const ErrorNote = ({ children }) => children ? (
  <p role="alert" className="rounded-lg border border-clay/30 bg-peach-100 px-3 py-2 text-sm font-medium text-clay-deep">{children}</p>
) : null;

export function Select({ value, onChange, children, className = '', ...rest }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`field !w-auto !py-2 ${className}`} {...rest}>{children}</select>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
