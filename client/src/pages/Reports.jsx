import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api, download } from '../api';
import { Empty, Loading, PageHeader, Pagination, Select } from '../components/ui';
import { num } from '../utils';

const PERIODS = [['daily', 'Daily'], ['weekly', 'Weekly (7 days)'], ['monthly', 'Monthly (30 days)']];

export default function Reports() {
  const [period, setPeriod] = useState('weekly');
  const [dept, setDept] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ departments: [] });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [period, dept]);
  useEffect(() => { setData(null); api.report({ period, department: dept, page }).then(setData).catch((e) => setError(e.message)); }, [period, dept, page]);

  const params = { period, department: dept };
  const t = data?.totals;
  return (
    <div>
      <PageHeader title="Reports" subtitle={data ? `Attendance summary from ${data.from} to ${data.to}` : 'Attendance summary by employee'} />
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Select value={period} onChange={setPeriod} aria-label="Period">{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Select value={dept} onChange={setDept} aria-label="Department"><option value="">All departments</option>{meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <div className="ml-auto flex gap-2">
          <button className="btn-outline !py-2" onClick={() => download('/reports/export', { ...params, format: 'csv' }, 'trackx-report.csv')}>CSV</button>
          <button className="btn-outline !py-2" onClick={() => download('/reports/export', { ...params, format: 'xlsx' }, 'trackx-report.xlsx')}><Download className="h-4 w-4" />Export Excel</button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[['Days present', t?.present], ['Late arrivals', t?.late], ['Hours worked', t?.hours], ['Overtime hours', t?.overtime]].map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-xs font-semibold">{l}</p><p className="mt-2 text-3xl font-extrabold tracking-tight">{v == null ? '—' : num(v)}</p></div>
        ))}
      </div>
      <section className="card mt-4 overflow-hidden">
        {error && <p className="p-4 text-sm text-clay-deep">{error}</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[900px]">
          <thead className="bg-peach"><tr>{['Employee', 'Department', 'Days Present', 'Days Absent', 'Late Days', 'Avg Clock-In', 'Total Hours', 'Overtime', 'Early Departures'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-peach-100">{data?.rows.map((r) => (
            <tr key={r.employee_id} className="hover:bg-peach-50/60"><td className="td font-bold">{r.name}<span className="block text-[11px] font-normal text-ink/60">{r.code}</span></td><td className="td">{r.department}</td>
              <td className="td">{r.days_present}</td><td className="td">{r.days_absent}</td><td className="td">{r.late_days}</td><td className="td">{r.avg_clock_in}</td>
              <td className="td">{r.total_hours}</td><td className="td">{r.overtime}</td><td className="td">{r.early_departures}</td></tr>))}</tbody>
        </table>
          {!data && <Loading rows={8} />}
          {data && !data.rows.length && <Empty title="No attendance in this period" />}</div>
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="employees" />}
      </section>
    </div>
  );
}
