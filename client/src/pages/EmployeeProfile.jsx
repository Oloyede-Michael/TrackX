import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mail, Pencil, Phone, UserX } from 'lucide-react';
import { api } from '../api';
import { Avatar, Empty, ErrorNote, Modal, StatusBadge } from '../components/ui';
import { fmtHours } from '../utils';

const TABS = ['Overview', 'Attendance', 'Schedule', 'Activity'];

export default function EmployeeProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);

  const load = () => api.employee(id).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { setD(null); load(); }, [id]); // eslint-disable-line

  if (err && !d) return <ErrorNote>{err}</ErrorNote>;
  if (!d) return <div className="h-64 animate-pulse rounded-2xl bg-peach-100" />;
  const { employee: e, stats: s, recent, activity } = d;

  const cards = [
    ['Attendance Rate', s.attendanceRate != null ? `${s.attendanceRate}%` : '—', s.deptRate != null ? `vs ${s.deptRate}% dept avg` : 'Last 30 days'],
    ['Avg Clock-In', s.avgClockIn || '—', s.avgNote || 'No punches yet'],
    ['Late Count', `${s.lateCount} ${s.lateCount === 1 ? 'time' : 'times'}`, 'This month so far'],
    ['Leave Balance', `${s.leaveBalance} Days`, 'Paid annual leaves'],
  ];

  return (
    <div className="space-y-5">
      <section className="card flex flex-wrap items-center gap-5 p-5">
        <Avatar name={e.name} src={e.photo_url} size={84} ring />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3"><h1 className="text-2xl font-extrabold">{e.name}</h1><StatusBadge status={e.status} /></div>
          <p className="mt-1 text-sm text-ink/80">{e.role}{e.grade_level ? ` (GL ${String(e.grade_level).padStart(2, '0')})` : ''} <span className="mx-1 text-ink/40">•</span> {e.code} <span className="mx-1 text-ink/40">•</span> {e.department}</p>
        </div>
        <div className="space-y-1 text-sm text-ink/80">
          <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-clay" />{e.email}</p>
          {e.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-clay" />{e.phone}</p>}
        </div>
        <div className="flex gap-2">
          <Link to={`/admin/employees/${id}/edit`} className="btn-outline"><Pencil className="h-4 w-4" />Edit</Link>
          {e.status !== 'inactive' && <button className="btn-outline" onClick={() => setConfirm(true)}><UserX className="h-4 w-4" />Deactivate</button>}
        </div>
      </section>

      <div role="tablist" className="flex gap-6 border-b border-peach-200">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2.5 text-sm font-semibold ${tab === t ? 'border-clay text-clay-dark' : 'border-transparent text-ink/70 hover:text-ink'}`}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {cards.map(([l, v, n]) => <div key={l} className="card p-4"><p className="text-xs font-semibold">{l}</p><p className="mt-2 text-3xl font-extrabold tracking-tight">{v}</p><p className="mt-1 text-[11px] text-ink/60">{n}</p></div>)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2"><h2 className="mb-3 font-extrabold">Recent Attendance</h2><AttTable rows={recent.slice(0, 5)} /></div>
          <ShiftCard e={e} />
        </div>
      </>}
      {tab === 'Attendance' && <div className="card p-5"><h2 className="mb-3 font-extrabold">Last 30 records</h2><AttTable rows={recent} /></div>}
      {tab === 'Schedule' && <div className="grid gap-4 lg:grid-cols-3"><ShiftCard e={e} /><div className="card p-5 lg:col-span-2"><h2 className="mb-3 font-extrabold">Employment</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">{[['Employment type', e.employment_type], ['Start date', e.start_date], ['Reporting manager', e.manager || '—'], ['Date of birth', e.date_of_birth || '—']].map(([k, v]) => <div key={k}><dt className="text-xs font-semibold text-ink/60">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>)}</dl></div></div>}
      {tab === 'Activity' && <div className="card p-5"><h2 className="mb-3 font-extrabold">Admin activity</h2>
        {activity.length ? <ul className="divide-y divide-peach-100">{activity.map((a, i) => <li key={i} className="py-3 text-sm"><b>{a.admin_name}</b> · {a.action.replace('.', ' ')}{a.reason && <span className="text-ink/70"> — “{a.reason}”</span>}<span className="ml-2 text-xs text-ink/50">{new Date(a.created_at).toLocaleString()}</span></li>)}</ul> : <Empty title="No admin activity yet" hint="Corrections and profile changes will appear here." />}</div>}

      {confirm && (
        <Modal title="Deactivate employee?" onClose={() => setConfirm(false)}>
          <p className="text-sm">{e.name} will no longer be able to clock in. Their attendance history is kept.</p>
          <div className="mt-5 flex justify-end gap-2"><button className="btn-outline" onClick={() => setConfirm(false)}>Cancel</button>
            <button className="btn-primary" onClick={async () => { await api.deactivateEmployee(id); nav('/admin/employees'); }}>Deactivate</button></div>
        </Modal>
      )}
    </div>
  );
}

function AttTable({ rows }) {
  if (!rows.length) return <Empty title="No attendance yet" />;
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[480px]">
      <thead><tr className="border-b border-peach-200">{['Date', 'Clock In', 'Clock Out', 'Hours', 'Status'].map((h) => <th key={h} className="py-2 pr-4 text-left text-xs font-semibold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-peach-100">{rows.map((r) => (
        <tr key={r.id}><td className="py-3 pr-4 text-sm">{r.date_label}</td><td className="py-3 pr-4 text-sm">{r.clock_in_label || '--:--'}</td><td className="py-3 pr-4 text-sm">{r.clock_out_label || '--:--'}</td><td className="py-3 pr-4 text-sm">{fmtHours(r.hours)}</td><td className="py-3"><StatusBadge status={r.status} /></td></tr>
      ))}</tbody></table></div>
  );
}

function ShiftCard({ e }) {
  const t = (x) => { const [h, m] = x.split(':'); return `${String(((+h + 11) % 12) + 1).padStart(2, '0')}:${m} ${+h < 12 ? 'AM' : 'PM'}`; };
  return (
    <div className="card h-fit p-5"><h2 className="mb-3 font-extrabold">Expected Shift Details</h2>
      <dl className="space-y-4 text-sm">
        <div><dt className="text-[11px] font-bold text-ink/60">SHIFT RULE</dt><dd className="mt-0.5 font-bold">{e.work_schedule} · {t(e.expected_in)} – {t(e.expected_out)}</dd></div>
        <div><dt className="text-[11px] font-bold text-ink/60">TERMINAL ACCESS PROFILE</dt><dd className="mt-0.5 font-bold">Staff PIN</dd></div>
        <div><dt className="text-[11px] font-bold text-ink/60">GRACE SETTINGS</dt><dd className="mt-0.5 font-bold">{e.grace_minutes} min grace window for check-in</dd></div>
      </dl></div>
  );
}
