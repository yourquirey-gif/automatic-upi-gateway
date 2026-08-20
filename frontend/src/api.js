const API_BASE = String(import.meta.env.VITE_API_BASE_URL || 'https://api.omniupi.in/api/v1').replace(/\/$/, '');

export async function api(path, options = {}) {
  const token = localStorage.getItem('gateway_access_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || 'Request failed'); error.code = data.code; error.data = data; throw error; }
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

// The existing dashboard Payment Link screen historically generated a local-only
// hash link. Keep that UI intact, but intercept its Generate Link action once and
// persist the real payment as a backend Order so Gmail verification can match it.
if (typeof document !== 'undefined' && !window.__omniupiPaymentLinkBridge) {
  window.__omniupiPaymentLinkBridge = true;
  document.addEventListener('click', async event => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target || !/^⚡?\s*Generate Link$/i.test(String(target.textContent || '').trim())) return;
    if (!location.hash.includes('dashboard/payment-link')) return;

    const inputs = [...document.querySelectorAll('input')];
    const customerEl = inputs.find(x => /Enter customer name/i.test(x.placeholder || ''));
    const mobileEl = inputs.find(x => /10-digit mobile/i.test(x.placeholder || ''));
    const amountEl = inputs.find(x => /0\.00/i.test(x.placeholder || '') && x !== mobileEl && x !== customerEl);
    const remarkEl = inputs.find(x => /Gift, Deposit/i.test(x.placeholder || ''));
    if (!customerEl || !mobileEl || !amountEl) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    target.disabled = true;
    try {
      const amount = Number(amountEl.value);
      const customer = String(customerEl.value || '').trim();
      const mobile = String(mobileEl.value || '').replace(/\D/g, '').slice(0, 10);
      const remark = String(remarkEl?.value || '').trim();
      if (!customer || !/^\d{10}$/.test(mobile) || !Number.isFinite(amount) || amount < 1) throw new Error('Enter customer name, valid mobile and amount.');

      const result = await api('/orders/payment-link', {
        method: 'POST',
        body: JSON.stringify({ customerMobile: mobile, amount, remark })
      });
      const order = result.result;
      const item = {
        id: order.orderId,
        orderId: order.orderId,
        customer,
        mobile,
        amount: Number(order.amount).toFixed(2),
        remark,
        link: order.paymentUrl,
        createdAt: Date.now(),
        expires: new Date(order.expiresAt).getTime()
      };
      let links = [];
      try { links = JSON.parse(localStorage.getItem('omniupi_links') || '[]'); } catch {}
      localStorage.setItem('omniupi_links', JSON.stringify([item, ...links.filter(x => x?.orderId !== item.orderId && x?.id !== item.id)]));
      location.reload();
    } catch (error) {
      window.alert(error.message || 'Unable to create payment link.');
      target.disabled = false;
    }
  }, true);
}
