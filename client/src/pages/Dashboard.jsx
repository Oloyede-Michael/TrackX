import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api, download } from '../api';
import { Avatar, Empty, Loading, Pagination, Select, StatusBadge } from '../components/ui';
import { fmtHours, num } from '../utils';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ departments: [] });
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [dept, setDept] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { api.stats().then(setStats).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    setData(null);
    api.today({ page, department: dept }).then(setData).catch((e) => setError(e.message));
  }, [page, dept]);

  const cards = stats && [
    ['Total Staff', stats.total, 'Full headcount'],
    ['Present', stats.present, `${stats.total ? ((stats.present / stats.total) * 100).toFixed(1) : 0}% on site`],
    ['Late', stats.late, 'Past grace period'],
    ['Absent', stats.absent, 'Unexcused leaves'],
    ['On Leave', stats.on_leave, 'Authorized count'],
    ['Not Clocked Out', stats.not_clocked_out, 'Missed punchout'],
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(cards || Array.from({ length: 6 })).map((c, i) => (
          <div key={i} className={`card p-4 ${c && c[0] === 'Absent' ? 'border-t-[3px] border-t-ink' : c ? 'border-t-[3px] border-t-clay/60' : ''}`}>
            {c ? <>
              <p className="text-xs font-semibold text-ink/80">{c[0]}</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight">{num(c[1])}</p>
              <p className="mt-1 text-[11px] text-ink/60">{c[2]}</p>
            </> : <div className="h-20 animate-pulse rounded-lg bg-peach-100" />}
          </div>
        ))}
      </div>

      <section className="card mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold">Today's Attendance</h2>
            {data && <span className="rounded-md bg-peach px-2 py-1 text-[11px] font-semibold text-clay-dark">{num(data.punches)} Punch Records</span>}
          </div>
          <div className="flex gap-2">
            <Select value={dept} onChange={(v) => { setDept(v); setPage(1); }} aria-label="Filter by department">
              <option value="">Filter By Department</option>
              {meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <button className="btn-outline !py-2" onClick={() => download('/attendance/export', { from: new Date().toLocaleDateString('en-CA'), to: new Date().toLocaleDateString('en-CA'), department: dept, format: 'xlsx' }, 'trackx-today.xlsx')}>
              <Download className="h-4 w-4" />Export Excel
            </button>
          </div>
        </div>
        {error && <p className="px-5 pb-3 text-sm text-clay-deep">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-peach"><tr>{['Staff Name', 'Staff ID', 'Department', 'Clock In', 'Clock Out', 'Hours Worked', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-peach-100">
              {data?.rows.map((r) => (
                <tr key={r.employee_id} className="hover:bg-peach-50/60">
                  <td className="td"><Link to={`/admin/employees/${r.employee_id}`} className="flex items-center gap-3 font-bold text-ink hover:text-clay-dark"><Avatar name={r.name} src={r.photo_url} />{r.name}</Link></td>
                  <td className="td whitespace-nowrap">{r.code}</td><td className="td">{r.department}</td>
                  <td className="td">{r.clock_in_label || '--:--'}</td><td className="td">{r.clock_out_label || '--:--'}</td>
                  <td className="td">{fmtHours(r.hours)}</td><td className="td"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && <Loading rows={8} />}
          {data && !data.rows.length && <Empty title="No staff match this filter" hint="Clear the department filter to see everyone." />}
        </div>
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="staff records" />}
      </section>
    </div>
  );
}
