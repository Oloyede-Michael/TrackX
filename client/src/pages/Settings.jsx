import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorNote, Field, PageHeader } from '../components/ui';

export default function SettingsPage() {
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState({});
  const [dept, setDept] = useState('');
  const [logs, setLogs] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => { api.meta().then((m) => { setMeta(m); setForm(m.settings); }).catch((e) => setErr(e.message)); api.audit().then((r) => setLogs(r.rows)).catch(() => {}); };
  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault(); setErr(''); setMsg('');
    try { await api.saveSettings(form); setMsg('Settings saved. New employees will use these defaults.'); load(); } catch (x) { setErr(x.message); }
  };
  const addDept = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.addDepartment(dept); setDept(''); load(); } catch (x) { setErr(x.message); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  if (!meta) return <div className="h-48 animate-pulse rounded-2xl bg-peach-100" />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Attendance rules, departments and the admin audit trail" />
      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={save} className="card space-y-4 p-6">
          <h2 className="font-extrabold">Attendance rules</h2>
          <p className="text-sm text-ink/70">Defaults applied when adding an employee. A person is on time until their expected clock-in plus the grace period; after that they are marked late. Each employee can override these on their profile.</p>
          <Field label="Company name"><input className="field" value={form.company_name || ''} onChange={set('company_name')} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Clock-in"><input type="time" className="field" value={form.default_clock_in || ''} onChange={set('default_clock_in')} /></Field>
            <Field label="Clock-out"><input type="time" className="field" value={form.default_clock_out || ''} onChange={set('default_clock_out')} /></Field>
            <Field label="Grace (min)"><input type="number" min="0" className="field" value={form.default_grace ?? ''} onChange={set('default_grace')} /></Field>
          </div>
          <ErrorNote>{err}</ErrorNote>
          {msg && <p className="text-sm font-semibold text-clay-dark" role="status">{msg}</p>}
          <button className="btn-primary">Save settings</button>
          <p className="text-xs text-ink/60">Timestamps use server time in {meta.timezone}.</p>
        </form>

        <section className="card p-6">
          <h2 className="mb-3 font-extrabold">Departments</h2>
          <form onSubmit={addDept} className="mb-4 flex gap-2"><input className="field" placeholder="New department name" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department name" /><button className="btn-primary">Add</button></form>
          <ul className="divide-y divide-peach-100">{meta.departments.map((d) => <li key={d.id} className="flex justify-between py-2.5 text-sm"><span className="font-semibold">{d.name}</span><span className="text-ink/60">{d.employees} staff</span></li>)}</ul>
        </section>

        <section className="card p-6 lg:col-span-2">
          <h2 className="mb-3 font-extrabold">Audit log</h2>
          {logs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead className="bg-peach"><tr>{['When', 'Admin', 'Action', 'Reason'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-peach-100">{logs.map((l) => <tr key={l.id}><td className="td whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td><td className="td">{l.admin_name}</td><td className="td">{l.action}</td><td className="td">{l.reason || '—'}</td></tr>)}</tbody></table></div>
            : <p className="text-sm text-ink/60">No admin actions recorded yet. Corrections, employee changes and settings updates appear here.</p>}
        </section>
      </div>
    </div>
  );
}
