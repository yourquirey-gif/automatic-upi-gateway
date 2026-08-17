const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Admin data lives under /admin, while a few shared services intentionally
// live at their own API root. Keeping this mapping here prevents the admin
// console from silently failing its initial Promise.all load.
function resolveAdminPath(path) {
  const p = String(path || '');
  if (p.startsWith('/auth/')) return p;
  if (p.startsWith('/kyc-config')) return p;
  if (p.startsWith('/support/')) return p;
  if (p.startsWith('/videos/')) return p;
  return `/admin${p}`;
}

export async function adminApi(path, options = {}) {
  const token = localStorage.getItem('gateway_admin_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const endpoint = resolveAdminPath(path);
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

export async function adminLogin(email, password) {
  const data = await adminApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (data.user?.role !== 'admin') throw new Error('Administrator access required');
  localStorage.setItem('gateway_admin_token', data.token);
  return data;
}
