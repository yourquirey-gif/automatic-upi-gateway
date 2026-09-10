const API_BASE = String(import.meta.env.VITE_API_BASE_URL || 'https://api.omniupi.in/api/v1').replace(/\/$/, '');

function friendlyError(path, status, message) {
  const p = String(path || '').toLowerCase();
  if (!p.includes('/gmail')) return message || 'Request failed';
  const m = String(message || '').toLowerCase();
  if (m.includes('auth') || m.includes('authentication') || m.includes('invalid credentials') || m.includes('invalid login')) return 'Gmail authentication failed. Check the Gmail address and App Password.';
  if (m.includes('app password') || m.includes('password')) return 'Invalid Gmail App Password. Use a 16-character App Password with 2-Step Verification enabled.';
  if (m.includes('imap') || m.includes('socket') || m.includes('connect')) return 'IMAP connection failed. Check Gmail IMAP access and try again.';
  if (m.includes('network') || m.includes('timeout') || status >= 500) return 'Gmail is temporarily unavailable. Check your network and try again.';
  return 'Gmail connection failed. Please check the Gmail account settings and try again.';
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('gateway_access_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && data.code === 'SESSION_EXPIRED') { localStorage.removeItem('gateway_access_token'); location.hash = 'home'; }
    const error = new Error(friendlyError(path, response.status, data.message) || 'Request failed'); error.code = data.code; error.data = data; throw error;
  }
  return data;
}
export async function login(email, password) { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); localStorage.setItem('gateway_access_token', data.token); return data; }
export async function register(name, email, password) { const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }); localStorage.setItem('gateway_access_token', data.token); return data; }
export async function getSubscriptionPlans() { return api('/subscriptions/plans'); }
export async function getSubscriptionVerification() { return api('/subscriptions/verification'); }
export async function purchaseSubscription(planId) { return api('/subscriptions/purchase', { method: 'POST', body: JSON.stringify({ planId }) }); }
export async function getSubscriptionOrder(orderId) { return api(`/subscriptions/order/${encodeURIComponent(orderId)}`); }
export async function getMySubscription() { return api('/subscriptions/me'); }
export async function getMerchants() { return api('/merchants'); }
export async function verifyMerchant(merchantId) { return api(`/merchants/${encodeURIComponent(merchantId)}/verify`, { method: 'POST' }); }
export function logout() { localStorage.removeItem('gateway_access_token'); }
