import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Dices } from 'lucide-react';
import { api } from '../api';
import { ErrorNote, Field, Modal, PageHeader } from '../components/ui';

const EMPTY = {
  first_name: '', last_name: '', email: '', phone: '', date_of_birth: '', department_id: '', role: '', employment_type: 'Permanent', grade_level: '',
  start_date: new Date().toLocaleDateString('en-CA'), manager: '', status: 'active', pin: '', work_schedule: 'Mon-Fri',
  expected_in: '08:00', expected_out: '16:00', grace_minutes: 15,
};

// Defined outside the component so inputs keep focus while typing
const Section = ({ title, children }) => (
  <section className="card p-6"><h2 className="mb-4 text-base font-extrabold">{title}</h2><div className="grid gap-4 sm:grid-cols-2">{children}</div></section>
);

export default function EmployeeForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const [v, setV] = useState(EMPTY);
  const [code, setCode] = useState('');
  const [meta, setMeta] = useState({ departments: [], managers: [], settings: {} });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  useEffect(() => {
    api.meta().then((m) => {
      setMeta(m);
      if (!editing) setV((s) => ({ ...s, expected_in: m.settings.default_clock_in || s.expected_in, expected_out: m.settings.default_clock_out || s.expected_out, grace_minutes: m.settings.default_grace ?? s.grace_minutes }));
    }).catch(() => {});
    if (editing) api.employee(id).then(({ employee: e }) => { setCode(e.code); setV({ ...EMPTY, ...e, date_of_birth: e.date_of_birth || '', phone: e.phone || '', manager: e.manager || '', grade_level: e.grade_level ?? '', pin: '' }); }).catch((x) => setErr(x.message));
    else api.nextCode().then((r) => setCode(r.code));
  }, [id, editing]);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      if (editing) { await api.updateEmployee(id, v); nav(`/admin/employees/${id}`); }
      else setCreated(await api.createEmployee(v));
    } catch (x) { setErr(x.message); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl">
      <nav className="mb-2 flex items-center gap-1 text-xs text-ink/70"><Link to="/admin/employees" className="hover:text-clay">Employees</Link><ChevronRight className="h-3 w-3" /><span className="font-semibold text-clay">{editing ? 'Edit Employee' : 'Add New Employee'}</span></nav>
      <PageHeader title={editing ? 'Edit Employee' : 'Add New Employee'} />
      <div className="space-y-5">
        <ErrorNote>{err}</ErrorNote>
        <Section title="Personal Information">
          <Field label="First Name"><input required className="field" value={v.first_name} onChange={set('first_name')} /></Field>
          <Field label="Last Name"><input required className="field" value={v.last_name} onChange={set('last_name')} /></Field>
          <Field label="Email Address"><input required type="email" className="field" value={v.email} onChange={set('email')} /></Field>
          <Field label="Phone Number"><input className="field" value={v.phone} onChange={set('phone')} placeholder="+234 …" /></Field>
          <Field label="Date of Birth"><input type="date" className="field" value={v.date_of_birth} onChange={set('date_of_birth')} /></Field>
          <Field label="Profile Photo URL (optional)"><input className="field" value={v.photo_url || ''} onChange={set('photo_url')} placeholder="https://…" /></Field>
        </Section>
        <Section title="Employment Information">
          <Field label="Staff ID (Auto-Generated)"><input readOnly className="field cursor-not-allowed opacity-70" value={code} /></Field>
          <Field label="Department"><select required className="field" value={v.department_id || ''} onChange={set('department_id')}><option value="">Select department</option>{meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Designation / Rank"><input required className="field" value={v.role} onChange={set('role')} placeholder="e.g. Administrative Officer" /></Field>
          <Field label="Grade Level"><select className="field" value={v.grade_level ?? ''} onChange={set('grade_level')}><option value="">Not set</option>{Array.from({ length: 17 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>GL {String(g).padStart(2, '0')}</option>)}</select></Field>
          <Field label="Employment Type"><select className="field" value={v.employment_type} onChange={set('employment_type')}>{['Permanent', 'Contract', 'Temporary', 'NYSC / Intern'].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Start Date"><input type="date" className="field" value={v.start_date} onChange={set('start_date')} /></Field>
          <Field label="Reporting Officer"><input list="mgrs" className="field" value={v.manager} onChange={set('manager')} /><datalist id="mgrs">{meta.managers.map((m) => <option key={m} value={m} />)}</datalist></Field>
          <Field label="Status"><select className="field" value={v.status} onChange={set('status')}><option value="active">Active</option><option value="on_leave">On Leave</option><option value="inactive">Inactive</option></select></Field>
        </Section>
        <Section title="Attendance Settings">
          <Field label="Terminal Security PIN" hint={editing ? 'Leave empty to keep the current PIN' : 'Leave empty to auto-generate a unique 4-digit PIN'}>
            <div className="flex gap-2"><input inputMode="numeric" maxLength={4} pattern="\d{4}" className="field" value={v.pin} onChange={(e) => setV({ ...v, pin: e.target.value.replace(/\D/g, '') })} placeholder="4 digits" autoComplete="off" />
              <button type="button" className="btn-outline" onClick={() => setV({ ...v, pin: String(Math.floor(Math.random() * 10000)).padStart(4, '0') })} aria-label="Generate PIN"><Dices className="h-4 w-4" /></button></div></Field>
          <Field label="Work Schedule"><select className="field" value={v.work_schedule} onChange={set('work_schedule')}><option>Mon-Fri</option><option>Mon-Sat</option></select></Field>
          <Field label="Expected Clock-In Time"><input type="time" className="field" value={v.expected_in} onChange={set('expected_in')} /></Field>
          <Field label="Expected Clock-Out Time"><input type="time" className="field" value={v.expected_out} onChange={set('expected_out')} /></Field>
          <Field label="Grace Period (Minutes)"><input type="number" min="0" max="120" className="field" value={v.grace_minutes} onChange={set('grace_minutes')} /></Field>
        </Section>
        <div className="flex justify-end gap-3"><Link to={editing ? `/admin/employees/${id}` : '/admin/employees'} className="btn-outline">Cancel</Link><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Employee Record'}</button></div>
      </div>

      {created && (
        <Modal title="Employee added" onClose={() => nav('/admin/employees')}>
          <p className="text-sm">Employee ID <b>{created.code}</b> is ready. Share this PIN with the employee — it is stored encrypted and won't be shown again.</p>
          <p className="my-5 rounded-xl bg-peach py-4 text-center text-4xl font-black tracking-[0.4em] text-clay-deep">{created.pin}</p>
          <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => nav(`/admin/employees/${created.id}`)}>View profile</button></div>
        </Modal>
      )}
    </form>
  );
}
