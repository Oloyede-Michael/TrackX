import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, Pencil, Plus } from 'lucide-react';
import { api } from '../api';
import { Avatar, Empty, Loading, PageHeader, Pagination, Select, StatusBadge } from '../components/ui';

export default function Employees() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') || '';
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ departments: [] });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [q, dept, status]);
  useEffect(() => {
    setData(null);
    api.employees({ q, department: dept, status, page }).then(setData).catch((e) => setError(e.message));
  }, [q, dept, status, page]);

  const reset = () => { setDept(''); setStatus(''); setSp({}); };

  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage work profiles, roles, and terminal configuration"
        action={<Link to="/admin/employees/new" className="btn-primary"><Plus className="h-4 w-4" />Add New Employee</Link>} />
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Select value={dept} onChange={setDept} aria-label="Department"><option value="">Department: All Departments</option>{meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <Select value={status} onChange={setStatus} aria-label="Status"><option value="">Status: All Statuses</option><option value="active">Active</option><option value="on_leave">On Leave</option><option value="inactive">Inactive</option></Select>
        <button onClick={reset} className="px-2 text-xs font-semibold text-clay hover:text-clay-dark">Reset Filters</button>
        {q && <span className="ml-auto rounded-md bg-peach px-2 py-1 text-xs font-semibold text-clay-dark">Search: “{q}”</span>}
      </div>
      <section className="card mt-4 overflow-hidden">
        {error && <p className="p-4 text-sm text-clay-deep">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-peach"><tr>{['Staff Name', 'Staff ID', 'Department', 'Designation', 'Grade', 'Status', 'Actions'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-peach-100">
              {data?.rows.map((r) => (
                <tr key={r.id} className="hover:bg-peach-50/60">
                  <td className="td"><Link to={`/admin/employees/${r.id}`} className="flex items-center gap-3 font-bold hover:text-clay-dark"><Avatar name={r.name} src={r.photo_url} />{r.name}</Link></td>
                  <td className="td whitespace-nowrap">{r.code}</td><td className="td">{r.department}</td><td className="td">{r.role}</td><td className="td whitespace-nowrap">{r.grade_level ? `GL ${String(r.grade_level).padStart(2, '0')}` : '—'}</td>
                  <td className="td"><StatusBadge status={r.status} /></td>
                  <td className="td"><div className="flex gap-1 text-clay">
                    <Link to={`/admin/employees/${r.id}/edit`} aria-label={`Edit ${r.name}`} className="rounded-lg p-1.5 hover:bg-peach"><Pencil className="h-4 w-4" /></Link>
                    <Link to={`/admin/employees/${r.id}`} aria-label={`View ${r.name}`} className="rounded-lg p-1.5 hover:bg-peach"><Eye className="h-4 w-4" /></Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && <Loading rows={8} />}
          {data && !data.rows.length && <Empty title="No employees found" hint="Try a different search or reset the filters." />}
        </div>
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </section>
    </div>
  );
}
