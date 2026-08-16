const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function adminApi(path, options = {}) {
  const token = localStorage.getItem('gateway_admin_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export async function adminLogin(email, password) {
  const data = await adminApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (data.user?.role !== 'admin') throw new Error('Administrator access required');
  localStorage.setItem('gateway_admin_token', data.token);
  return data;
}
