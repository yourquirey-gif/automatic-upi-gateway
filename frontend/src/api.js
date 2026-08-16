const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function api(path, options = {}) {
  const token = localStorage.getItem('gateway_access_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export async function login(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  localStorage.setItem('gateway_access_token', data.token);
  return data;
}

export async function register(name, email, password) {
  const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
  localStorage.setItem('gateway_access_token', data.token);
  return data;
}

export async function getSubscriptionPlans() { return api('/subscriptions/plans'); }
export async function purchaseSubscription(planId) { return api('/subscriptions/purchase', { method: 'POST', body: JSON.stringify({ planId }) }); }
export async function getSubscriptionOrder(orderId) { return api(`/subscriptions/order/${encodeURIComponent(orderId)}`); }
export async function getMySubscription() { return api('/subscriptions/me'); }
export function logout() { localStorage.removeItem('gateway_access_token'); }
