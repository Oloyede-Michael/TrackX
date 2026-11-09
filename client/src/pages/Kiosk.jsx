import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, LogIn, LogOut, WifiOff, X } from 'lucide-react';
import { api } from '../api';
import { Avatar, Logo, StatusBadge } from '../components/ui';

const COMPANY = import.meta.env.VITE_COMPANY_NAME || 'OJO LOCAL GOVERNMENT SECRETARIAT';
const TERMINAL = import.meta.env.VITE_TERMINAL_ID || 'OJ-01';
const PIN_LEN = 4;
const RESULT_SECONDS = 10;

export default function Kiosk() {
  const [now, setNow] = useState(new Date());
  const [action, setAction] = useState('in');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState(null);
  const [online, setOnline] = useState(true);
  const [left, setLeft] = useState(RESULT_SECONDS);
  const errTimer = useRef();

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // Connectivity heartbeat
  useEffect(() => {
    const ping = () => api.health().then(() => setOnline(true)).catch(() => setOnline(false));
    ping();
    const t = setInterval(ping, 10000);
    return () => clearInterval(t);
  }, []);

  const showError = useCallback((msg) => {
    setError(msg); setPin(''); setShake(true);
    clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => { setError(''); setShake(false); }, 4000);
  }, []);

  const submit = useCallback(async () => {
    if (busy) return;
    if (pin.length < PIN_LEN) return showError('Enter your 4-digit PIN.');
    setBusy(true);
    try {
      const r = await api.punch({ pin, action });
      setPin(''); setError(''); setLeft(RESULT_SECONDS); setResult(r);
    } catch (e) {
      if (e.status === 0) setOnline(false);
      showError(e.message);
    } finally { setBusy(false); }
  }, [pin, action, busy, showError]);

  const press = useCallback((d) => { setError(''); setPin((p) => (p.length < PIN_LEN ? p + d : p)); }, []);
  const done = useCallback(() => { setResult(null); setPin(''); setAction('in'); }, []);

  // Physical keyboard support
  useEffect(() => {
    if (result) return;
    const h = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      else if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') setPin('');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [press, submit, result]);

  // Auto-return to home after each transaction
  useEffect(() => {
    if (!result) return;
    if (left <= 0) return done();
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [result, left, done]);

  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (result) return <Success r={result} left={left} time={time} onDone={done} />;

  return (
    <div className="flex min-h-screen select-none flex-col bg-peach p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Logo /><span className="text-sm font-semibold tracking-wide text-clay sm:text-base">{COMPANY}</span></div>
        <div className={`flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium ${online ? '' : 'text-clay-deep'}`} role="status">
          {online ? <><span className="h-1.5 w-1.5 rounded-full bg-clay" />Terminal Active</> : <><WifiOff className="h-3.5 w-3.5" />Offline · reconnecting</>}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 py-8 lg:grid-cols-2">
        <section>
          <p className="text-sm font-medium uppercase tracking-wide text-clay">{date}</p>
          <p className="mt-2 text-7xl font-black tracking-tight sm:text-8xl">{time}</p>
          <p className="mt-2 text-xs text-ink/70">Choose an action, then enter your PIN</p>
          <div className="mt-8 grid max-w-md grid-cols-2 gap-4">
            {[['in', 'Clock In', LogIn], ['out', 'Clock Out', LogOut]].map(([k, label, Icon]) => (
              <button key={k} onClick={() => { setAction(k); setError(''); }} aria-pressed={action === k}
                className={`flex h-32 flex-col items-center justify-center gap-3 rounded-2xl border border-clay text-base font-bold transition ${action === k ? 'bg-brand text-ink shadow-lg shadow-brand/40' : 'bg-white text-clay hover:bg-peach-50'}`}>
                <Icon className="h-6 w-6" />{label}
              </button>
            ))}
          </div>
        </section>

        <section className={`mx-auto w-full max-w-md rounded-3xl border border-clay/70 bg-white p-6 sm:p-8 ${shake ? 'shake' : ''}`}>
          <p className="text-center text-[11px] font-bold tracking-wider">ENTER EMPLOYEE PIN · {action === 'in' ? 'CLOCK IN' : 'CLOCK OUT'}</p>
          <div className="my-4 flex justify-center gap-2" aria-label={`${pin.length} of ${PIN_LEN} digits entered`}>
            {Array.from({ length: PIN_LEN }, (_, i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < pin.length ? 'bg-clay' : 'bg-peach-300'}`} />)}
          </div>
          <p role="alert" className={`mb-3 min-h-[2.5rem] text-center text-sm font-semibold text-clay-deep ${error ? '' : 'invisible'}`}>{error || '.'}</p>
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <Key key={d} onClick={() => press(d)}>{d}</Key>)}
            <Key onClick={() => setPin('')} small>Clear</Key>
            <Key onClick={() => press('0')}>0</Key>
            <button onClick={submit} disabled={busy} className="h-16 rounded-xl bg-brand text-sm font-bold text-ink transition hover:bg-brand-dark active:scale-95 disabled:opacity-60">{busy ? '…' : 'OK'}</button>
          </div>
        </section>
      </main>

      <footer className="flex justify-between border-t border-clay/40 pt-4 text-xs text-ink/70">
        <span>TrackX Terminal #{TERMINAL}</span>
        <span>Staff PIN required for every punch</span>
      </footer>
    </div>
  );
}

const Key = ({ children, onClick, small }) => (
  <button onClick={onClick} className={`h-16 rounded-xl bg-peach font-bold text-ink transition hover:bg-peach-300 active:scale-95 ${small ? 'text-sm text-clay-dark' : 'text-xl'}`}>{children}</button>
);

function Success({ r, left, time, onDone }) {
  const out = r.action === 'out';
  return (
    <div className="flex min-h-screen flex-col bg-white p-6 sm:p-8">
      <header className="flex items-center justify-between"><Logo /><span className="text-sm font-medium">{time}</span></header>
      <div className="grid flex-1 place-items-center">
        <div className="w-full max-w-md rounded-3xl border border-peach-200 p-8 text-center shadow-card">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-peach text-clay"><Check className="h-8 w-8" strokeWidth={2.5} /></div>
          <div className="mt-5 flex justify-center"><Avatar name={r.name} src={r.photoUrl} size={72} ring /></div>
          <p className="mt-3 text-sm font-medium text-clay">{r.greeting}</p>
          <h1 className="mt-1 text-2xl font-extrabold">{r.name}</h1>
          <p className="text-sm text-ink/70">{r.department}</p>
          <div className="my-5 border-t border-peach-200" />
          <div className="flex items-end justify-between text-left">
            <div><p className="text-[11px] font-semibold">{out ? 'CLOCKED OUT AT' : 'RECORDED TIME'}</p><p className="mt-1 text-xl font-extrabold">{r.recordedLabel}</p></div>
            {out ? (
              <div className="text-right"><p className="text-[11px] font-semibold">HOURS WORKED</p><p className="mt-1 text-xl font-extrabold">{Number(r.hours).toFixed(1)} hrs</p></div>
            ) : (
              <div className="text-right"><p className="mb-1 text-[11px] font-semibold">SHIFT STATUS</p><StatusBadge status={r.status} /></div>
            )}
          </div>
          {out && r.earlyDeparture && <p className="mt-4 text-left text-xs font-medium text-clay-dark">Left before your scheduled finish time.</p>}
          <button onClick={onDone} className="mt-6 h-12 w-full rounded-xl bg-brand font-bold text-ink hover:bg-brand-dark">Done</button>
        </div>
      </div>
      <p className="pb-4 text-center text-sm text-ink/70">Returning to home screen in <span className="font-bold text-clay">{left}s</span>…</p>
    </div>
  );
}
