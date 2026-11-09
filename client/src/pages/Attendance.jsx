import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Download, Pencil, Search } from 'lucide-react';
import { api, download } from '../api';
import { Avatar, Empty, ErrorNote, Field, Loading, Modal, PageHeader, Pagination, Select, StatusBadge } from '../components/ui';
import { fmtHours, num } from '../utils';

const iso = (d) => d.toLocaleDateString('en-CA');
const STATUS = [['on_time', 'On Time'], ['late', 'Late'], ['absent', 'Absent'], ['half_day', 'Half Day'], ['on_leave', 'On Leave']];

export default function Attendance() {
  const today = new Date();
  const [f, setF] = useState({ from: iso(new Date(today.getTime() - 29 * 864e5)), to: iso(today), department: '', status: '', q: '' });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ departments: [] });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const set = (k) => (v) => { setF((s) => ({ ...s, [k]: v })); setPage(1); };

  const load = () => { setData(null); api.attendance({ ...f, page }).then(setData).catch((e) => setError(e.message)); };
  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(load, f.q ? 250 : 0); return () => clearTimeout(t); }, [f, page]); // eslint-disable-line

  const s = data?.summary;
  const cards = [['Total Record Days', s?.total], ['On-Time Punches', s?.on_time], ['Punches Flagged Late', s?.late], ['Excused Leaves / Absences', s?.excused]];

  return (
    <div>
      <PageHeader title="Attendance History" subtitle="Historical punch records and shift statuses across all terminals" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(([label, v]) => (
          <div key={label} className="card p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-ink/70">{label}</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight">{v == null ? '—' : num(v)}</p></div>
        ))}
      </div>

      <div className="card mt-5 flex flex-wrap items-center gap-2 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-peach-300 px-3 py-1.5 text-sm"><Calendar className="h-4 w-4" />
          <input type="date" aria-label="From" value={f.from} max={f.to} onChange={(e) => set('from')(e.target.value)} className="bg-transparent text-sm focus:outline-none" />
          <span className="text-ink/50">–</span>
          <input type="date" aria-label="To" value={f.to} min={f.from} onChange={(e) => set('to')(e.target.value)} className="bg-transparent text-sm focus:outline-none" /></div>
        <Select value={f.department} onChange={set('department')} aria-label="Department"><option value="">Department</option>{meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <Select value={f.status} onChange={set('status')} aria-label="Status"><option value="">Status</option>{STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <div className="relative"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/60" />
          <input value={f.q} onChange={(e) => set('q')(e.target.value)} placeholder="Name or ID" aria-label="Search" className="field !w-40 !py-2 !pl-8" /></div>
        <div className="ml-auto flex gap-2">
          <button className="btn-outline !py-2" onClick={() => download('/attendance/export', { ...f, format: 'csv' }, 'trackx-attendance.csv')}>CSV</button>
          <button className="btn-outline !py-2" onClick={() => download('/attendance/export', { ...f, format: 'xlsx' }, 'trackx-attendance.xlsx')}><Download className="h-4 w-4" />Export Excel</button>
        </div>
      </div>

      <section className="card mt-4 overflow-hidden">
        {error && <div className="p-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-peach"><tr>{['Date', 'Staff Name', 'Staff ID', 'Department', 'Clock In', 'Clock Out', 'Hours Worked', 'Status', ''].map((h, i) => <th key={i} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-peach-100">
              {data?.rows.map((r) => (
                <tr key={r.id} className="hover:bg-peach-50/60">
                  <td className="td whitespace-nowrap">{r.date_label}</td>
                  <td className="td"><Link to={`/admin/employees/${r.employee_id}`} className="flex items-center gap-3 font-bold hover:text-clay-dark"><Avatar name={r.name} src={r.photo_url} />{r.name}</Link></td>
                  <td className="td whitespace-nowrap">{r.code}</td><td className="td">{r.department}</td>
                  <td className="td">{r.clock_in_label || '--:--'}</td><td className="td">{r.clock_out_label || '--:--'}</td>
                  <td className="td">{fmtHours(r.hours)}</td>
                  <td className="td"><StatusBadge status={r.status} />{r.corrected && <span className="ml-1.5 text-[10px] font-semibold text-clay" title="Manually corrected">edited</span>}</td>
                  <td className="td"><button onClick={() => setEditing(r)} aria-label={`Correct record for ${r.name}`} className="rounded-lg p-1.5 text-clay hover:bg-peach"><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && <Loading rows={10} />}
          {data && !data.rows.length && <Empty title="No records for these filters" hint="Widen the date range or clear a filter." />}
        </div>
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </section>

      {editing && <CorrectionModal rec={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function CorrectionModal({ rec, onClose, onSaved }) {
  const [v, setV] = useState({ clock_in: rec.clock_in_value || '', clock_out: rec.clock_out_value || '', status: rec.status, reason: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.saveAttendance(rec.id, { ...v, notes: rec.notes }); onSaved(); }
    catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return (
    <Modal title="Correct attendance record" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-ink/70"><b className="text-ink">{rec.name}</b> · {rec.date_label}</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Clock in"><input type="time" className="field" value={v.clock_in} onChange={(e) => setV({ ...v, clock_in: e.target.value })} /></Field>
          <Field label="Clock out" hint="Leave empty for a missed clock-out"><input type="time" className="field" value={v.clock_out} onChange={(e) => setV({ ...v, clock_out: e.target.value })} /></Field>
        </div>
        <Field label="Status"><select className="field" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>{STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Reason for correction" hint="Saved to the audit log with the original and new values"><textarea required rows={2} className="field" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder="e.g. Forgot to clock out" /></Field>
        <ErrorNote>{err}</ErrorNote>
        <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save correction'}</button></div>
      </form>
    </Modal>
  );
}
