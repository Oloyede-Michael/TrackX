import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, CalendarCheck, Users, BarChart3, Settings, Search, Bell, Calendar, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../auth';
import { Avatar, Logo } from './ui';
import { todayLabel } from '../utils';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  useEffect(() => setOpen(false), [loc.pathname]);

  const search = (e) => {
    e.preventDefault();
    nav(`/admin/employees${term ? `?q=${encodeURIComponent(term)}` : ''}`);
  };

  return (
    <div className="flex min-h-screen bg-peach-50">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-peach-200 bg-white p-4 transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-2 pb-6 pt-2"><Logo /><p className="mt-1.5 text-[10px] font-bold uppercase leading-tight tracking-wide text-clay">Ojo Local Government<br />Secretariat</p></div>
        <nav className="flex-1 space-y-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-peach text-clay-deep' : 'text-ink/70 hover:bg-peach-50'}`}>
              <Icon className="h-[18px] w-[18px]" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 rounded-xl border border-peach-200 p-3">
          <Avatar name={user?.name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user?.name}</p>
            <p className="truncate text-xs text-ink/60">{user?.title}</p>
          </div>
          <button onClick={() => { logout(); nav('/admin/login'); }} aria-label="Sign out" title="Sign out" className="rounded-lg p-1.5 text-clay hover:bg-peach-100"><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 px-5 py-4 sm:px-8">
          <button className="rounded-lg border border-peach-300 bg-white p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <form onSubmit={search} className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/60" />
            <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search employees, departments, or roles..." aria-label="Search employees"
              className="w-full rounded-lg border border-peach-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder:text-ink/50 focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20" />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative rounded-lg border border-peach-300 bg-white p-2.5" aria-label="Notifications"><Bell className="h-4 w-4" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" /></button>
            <div className="hidden items-center gap-2 rounded-lg border border-peach-300 bg-white px-3 py-2.5 text-sm font-medium sm:flex"><Calendar className="h-4 w-4" />Today: {todayLabel()}</div>
          </div>
        </header>
        <main className="px-5 pb-10 sm:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
