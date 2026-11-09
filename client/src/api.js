const TOKEN_KEY = 'trackx_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  return s.toString() ? `?${s}` : '';
};

async function request(path, { method = 'GET', body, params, auth = true, blob = false } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}${qs(params)}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth && getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Connection unavailable. Please try again.', 0);
  }
  if (res.status === 401 && auth && getToken()) {
    setToken(null);
    window.dispatchEvent(new Event('trackx:logout'));
  }
  if (blob && res.ok) return res.blob();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', res.status);
  return data;
}

export async function download(path, params, filename) {
  const blob = await request(path, { params, blob: true });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body, auth: false }),
  me: () => request('/auth/me'),
  health: () => request('/health', { auth: false }),
  punch: (body) => request('/kiosk/punch', { method: 'POST', body, auth: false }),
  meta: () => request('/meta'),
  stats: () => request('/dashboard/stats'),
  today: (params) => request('/dashboard/today', { params }),
  attendance: (params) => request('/attendance', { params }),
  saveAttendance: (id, body) => request(id ? `/attendance/${id}` : '/attendance', { method: id ? 'PUT' : 'POST', body }),
  employees: (params) => request('/employees', { params }),
  employee: (id) => request(`/employees/${id}`),
  nextCode: () => request('/employees/next-code'),
  createEmployee: (body) => request('/employees', { method: 'POST', body }),
  updateEmployee: (id, body) => request(`/employees/${id}`, { method: 'PUT', body }),
  deactivateEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE', body: {} }),
  report: (params) => request('/reports/summary', { params }),
  saveSettings: (body) => request('/settings', { method: 'PUT', body }),
  addDepartment: (name) => request('/departments', { method: 'POST', body: { name } }),
  audit: () => request('/audit'),
};
