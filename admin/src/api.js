const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

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
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const endpoint = resolveAdminPath(path);
  const url = `${API_BASE}${endpoint}`;
  let response;
  try {
    response = await fetch(url, { ...options, headers, cache: 'no-store' });
  } catch {
    throw new Error(`Admin API unreachable: ${url}`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(data.message || 'Administrator authentication required');
    }
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

export async function adminLogin(email, password) {
  // Login is intentionally performed against the normal auth endpoint.
  const data = await adminApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (data.user?.role !== 'admin') throw new Error('Administrator access required');
  localStorage.setItem('gateway_admin_token', data.token);
  return data;
}
