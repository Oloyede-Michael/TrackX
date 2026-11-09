import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth';
import { ErrorNote, Logo } from '../components/ui';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('hr@ojolg.example');
  const [password, setPassword] = useState('TrackX@2026');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={loc.state?.from || '/admin'} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); nav(loc.state?.from || '/admin', { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-peach p-4" style={{ backgroundImage: 'radial-gradient(60% 50% at 15% 25%, #FFFDF2 0%, transparent 70%), radial-gradient(50% 45% at 90% 85%, #FFF8D6 0%, transparent 70%)' }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-ink/80 bg-white p-8 shadow-card">
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" label={false} />
          <h1 className="mt-3 text-2xl font-extrabold">TrackX</h1>
          <p className="mt-1 text-xs text-ink/70">Staff Attendance Portal · Ojo Local Government</p>
        </div>
        <div className="mt-7 space-y-4">
          <div>
            <label htmlFor="email" className="label">Work Email</label>
            <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/70" />
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field !pl-9" autoComplete="username" /></div>
          </div>
          <div>
            <div className="flex justify-between"><label htmlFor="pw" className="label">Password</label><span className="text-[11px] font-medium text-clay">Forgot Password?</span></div>
            <div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/70" />
              <input id="pw" type={show ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} className="field !px-9" autoComplete="current-password" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/70">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </div>
          <ErrorNote>{error}</ErrorNote>
          <button disabled={busy} className="btn-primary w-full !py-3">{busy ? 'Signing in…' : 'Sign In'}</button>
          <p className="flex items-center justify-center gap-2 rounded-lg bg-peach px-3 py-2.5 text-[11px] font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-clay" />Secure session · sign-in is rate limited</p>
        </div>
      </form>
    </div>
  );
}
