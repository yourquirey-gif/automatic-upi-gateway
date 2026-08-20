import './medium-typography.css';
import './support.css';
import { adminApi } from './api';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateInput = value => { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; const pad = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const money = value => `₹${Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;

let managerUsers = [];
let managerPlans = [];
let selectedUser = null;

function addSubscriptionManagerButton() {
  if (window.__omniupiSubscriptionManagerButton) return true;
  const nav = document.querySelector('.nav');
  if (!nav) return false;
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.type = 'button';
  button.innerHTML = '<span class="omni-sub-nav-icon">◷</span><span>Subscription Manager</span>';
  button.addEventListener('click', openSubscriptionManager);
  nav.appendChild(button);
  window.__omniupiSubscriptionManagerButton = button;
  return true;
}

async function openSubscriptionManager() {
  if (document.getElementById('omni-sub-manager')) return;
  const overlay = document.createElement('div');
  overlay.id = 'omni-sub-manager';
  overlay.className = 'omni-sub-overlay';
  overlay.innerHTML = '<div class="omni-sub-modal"><div class="omni-sub-head"><div><span>OMNIUPI CONTROL</span><h2>Subscription Manager</h2></div><button type="button" class="omni-sub-close" aria-label="Close">×</button></div><div id="omni-sub-body" class="omni-sub-body"><div class="omni-sub-loading">Loading users and plans…</div></div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector('.omni-sub-close').addEventListener('click', closeSubscriptionManager);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeSubscriptionManager(); });
  try {
    const [users, plans] = await Promise.all([adminApi('/users?limit=100'), adminApi('/plans')]);
    managerUsers = users.users || [];
    managerPlans = plans.plans || [];
    renderSubscriptionManager();
  } catch (error) {
    document.getElementById('omni-sub-body').innerHTML = `<div class="omni-sub-error">${escapeHtml(error.message || 'Unable to load subscription data')}</div>`;
  }
}

function closeSubscriptionManager() {
  document.getElementById('omni-sub-manager')?.remove();
  selectedUser = null;
}

function renderSubscriptionManager() {
  const body = document.getElementById('omni-sub-body');
  if (!body) return;
  const rows = managerUsers.map(user => {
    const plan = user.plan;
    const trial = user.trialEndsAt ? new Date(user.trialEndsAt).toLocaleDateString('en-IN') : '—';
    const expiry = user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString('en-IN') : '—';
    return `<div class="omni-sub-row" data-search="${escapeHtml(`${user.name} ${user.email} ${user.userId||''} ${plan?.name||''}`.toLowerCase())}"><div><b>${escapeHtml(user.name)}</b><small>${escapeHtml(user.email)} · ${escapeHtml(user.userId || '—')}</small></div><div><b>${escapeHtml(plan?.name || 'No plan')}</b><small>${escapeHtml(user.planStatus || 'NONE')} · Expiry: ${escapeHtml(expiry)} · Trial: ${escapeHtml(trial)}</small></div><button type="button" class="omni-sub-manage" data-user-id="${escapeHtml(user._id)}">Manage</button></div>`;
  }).join('');
  body.innerHTML = `<div class="omni-sub-toolbar"><input id="omni-sub-search" placeholder="Search name, email, user ID or plan…"/><span>${managerUsers.length} users</span></div><div class="omni-sub-list">${rows || '<div class="omni-sub-empty">No merchant users found.</div>'}</div>${selectedUser ? renderEditor(selectedUser) : '<div class="omni-sub-hint">Select any user to increase, decrease, assign or remove their subscription.</div>'}`;
  body.querySelector('#omni-sub-search')?.addEventListener('input', event => {
    const query = String(event.target.value || '').toLowerCase().trim();
    body.querySelectorAll('.omni-sub-row').forEach(row => { row.style.display = !query || row.dataset.search.includes(query) ? '' : 'none'; });
  });
  body.querySelectorAll('.omni-sub-manage').forEach(button => button.addEventListener('click', () => {
    selectedUser = managerUsers.find(user => String(user._id) === String(button.dataset.userId)) || null;
    renderSubscriptionManager();
  }));
  body.querySelector('.omni-sub-save')?.addEventListener('click', saveSubscription);
  body.querySelector('.omni-sub-clear')?.addEventListener('click', clearSubscription);
  body.querySelectorAll('[data-sub-days]').forEach(button => button.addEventListener('click', () => adjustSubscription(Number(button.dataset.subDays))));
}

function renderEditor(user) {
  const currentPlanId = user.plan?._id || '';
  const options = [`<option value="">No subscription plan</option>`, ...managerPlans.map(plan => `<option value="${escapeHtml(plan._id)}" ${String(plan._id) === String(currentPlanId) ? 'selected' : ''}>${escapeHtml(plan.name)} · ${money(plan.price)} · ${escapeHtml(plan.durationDays)} days</option>`)].join('');
  return `<div class="omni-sub-editor"><div class="omni-sub-editor-title"><div><span>MANAGE USER</span><h3>${escapeHtml(user.name)}</h3><small>${escapeHtml(user.email)}</small></div><button type="button" class="omni-sub-clear">Remove Subscription</button></div><label>Subscription plan<select id="omni-sub-plan">${options}</select></label><label>Exact expiry date & time<input id="omni-sub-expiry" type="datetime-local" value="${escapeHtml(dateInput(user.planExpiresAt))}"/></label><div class="omni-sub-quick"><span>Quick adjustment</span><button type="button" data-sub-days="-30">−30d</button><button type="button" data-sub-days="-7">−7d</button><button type="button" data-sub-days="7">+7d</button><button type="button" data-sub-days="30">+30d</button><button type="button" data-sub-days="90">+90d</button></div><div class="omni-sub-summary"><div><span>Current plan</span><b>${escapeHtml(user.plan?.name || 'No plan')}</b></div><div><span>Status</span><b>${escapeHtml(user.planStatus || 'NONE')}</b></div><div><span>Expires</span><b>${user.planExpiresAt ? escapeHtml(new Date(user.planExpiresAt).toLocaleString('en-IN')) : '—'}</b></div></div><button type="button" class="omni-sub-save">Save Subscription</button></div>`;
}

async function saveSubscription() {
  if (!selectedUser) return;
  const planId = document.getElementById('omni-sub-plan')?.value || '';
  const expiresAt = document.getElementById('omni-sub-expiry')?.value || '';
  const button = document.querySelector('.omni-sub-save');
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  try {
    const result = await adminApi(`/subscriptions/users/${encodeURIComponent(selectedUser._id)}`, { method: 'PATCH', body: JSON.stringify({ planId, ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) }) });
    replaceUser(result.user);
    selectedUser = managerUsers.find(user => String(user._id) === String(selectedUser._id)) || null;
    renderSubscriptionManager();
  } catch (error) {
    window.alert(error.message || 'Unable to update subscription.');
    if (button) { button.disabled = false; button.textContent = 'Save Subscription'; }
  }
}

async function clearSubscription() {
  if (!selectedUser || !window.confirm(`Remove the subscription from ${selectedUser.name}?`)) return;
  try {
    const result = await adminApi(`/subscriptions/users/${encodeURIComponent(selectedUser._id)}`, { method: 'PATCH', body: JSON.stringify({ planId: null }) });
    replaceUser(result.user);
    selectedUser = managerUsers.find(user => String(user._id) === String(selectedUser._id)) || null;
    renderSubscriptionManager();
  } catch (error) { window.alert(error.message || 'Unable to remove subscription.'); }
}

async function adjustSubscription(days) {
  if (!selectedUser || !selectedUser.plan) { window.alert('Assign a subscription plan first.'); return; }
  try {
    const result = await adminApi(`/subscriptions/users/${encodeURIComponent(selectedUser._id)}`, { method: 'PATCH', body: JSON.stringify({ days }) });
    replaceUser(result.user);
    selectedUser = managerUsers.find(user => String(user._id) === String(selectedUser._id)) || null;
    renderSubscriptionManager();
  } catch (error) { window.alert(error.message || 'Unable to adjust subscription.'); }
}

function replaceUser(user) {
  const index = managerUsers.findIndex(item => String(item._id) === String(user._id));
  if (index >= 0) managerUsers[index] = user;
}

const style = document.createElement('style');
style.textContent = `.omni-sub-nav-icon{width:17px;display:inline-grid;place-items:center;font-size:18px;font-weight:900}.omni-sub-overlay{position:fixed;inset:0;z-index:1000000;background:rgba(14,20,38,.48);backdrop-filter:blur(7px);display:grid;place-items:center;padding:18px}.omni-sub-modal{width:min(980px,100%);max-height:min(88vh,820px);overflow:auto;border:1px solid #ffffffaa;border-radius:24px;background:#f8faff;box-shadow:0 30px 100px rgba(10,20,50,.3);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.omni-sub-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid #e6eaf2;background:#ffffffef;backdrop-filter:blur(15px)}.omni-sub-head span,.omni-sub-editor-title span{font-size:9px;letter-spacing:.15em;font-weight:900;color:#6269e8}.omni-sub-head h2{margin:5px 0 0;color:#182237;font-size:22px}.omni-sub-close{width:36px;height:36px;border:0;border-radius:12px;background:#eef1f7;color:#536078;font-size:24px;cursor:pointer}.omni-sub-body{padding:18px}.omni-sub-toolbar{display:flex;gap:12px;align-items:center;margin-bottom:12px}.omni-sub-toolbar input{flex:1;min-width:0;border:1px solid #dfe4ed;border-radius:12px;padding:12px 14px;background:#fff;outline:none}.omni-sub-toolbar span{font-size:12px;color:#788397;font-weight:700;white-space:nowrap}.omni-sub-list{display:grid;gap:8px}.omni-sub-row{display:grid;grid-template-columns:1.2fr 1fr auto;gap:14px;align-items:center;padding:13px 14px;border:1px solid #e5e9f1;border-radius:14px;background:#fff}.omni-sub-row b,.omni-sub-editor b{display:block;color:#1b263c;font-size:13px}.omni-sub-row small{display:block;margin-top:3px;color:#8791a3;font-size:10px}.omni-sub-manage{border:0;border-radius:10px;padding:9px 13px;background:#6269e8;color:#fff;font-weight:800;cursor:pointer}.omni-sub-hint,.omni-sub-loading,.omni-sub-empty,.omni-sub-error{padding:20px;text-align:center;color:#7a8598}.omni-sub-error{color:#c23b52}.omni-sub-editor{margin-top:15px;padding:18px;border:1px solid #dfe5ef;border-radius:18px;background:linear-gradient(145deg,#fff,#f3f6ff)}.omni-sub-editor-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px}.omni-sub-editor-title h3{margin:4px 0 2px;color:#182237}.omni-sub-editor-title small{color:#7d8798}.omni-sub-clear{border:1px solid #f1b8c4;background:#fff5f7;color:#b52e4c;border-radius:10px;padding:8px 11px;font-size:11px;font-weight:800;cursor:pointer}.omni-sub-editor label{display:block;margin:10px 0;font-size:11px;font-weight:800;color:#59657a}.omni-sub-editor select,.omni-sub-editor input{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:11px 12px;border:1px solid #dfe4ed;border-radius:11px;background:#fff;color:#1b263c;outline:none}.omni-sub-quick{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:14px 0}.omni-sub-quick span{margin-right:3px;font-size:10px;color:#7d8798;font-weight:800}.omni-sub-quick button{border:1px solid #dce2ec;border-radius:9px;background:#fff;padding:8px 11px;color:#45526a;font-weight:800;cursor:pointer}.omni-sub-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.omni-sub-summary div{padding:11px;border-radius:11px;background:#eef2fa}.omni-sub-summary span{display:block;font-size:9px;color:#7d8798}.omni-sub-summary b{margin-top:4px}.omni-sub-save{width:100%;border:0;border-radius:12px;padding:12px;background:linear-gradient(135deg,#6269e8,#19b99a);color:#fff;font-weight:900;cursor:pointer}.omni-sub-save:disabled{opacity:.6;cursor:wait}@media(max-width:700px){.omni-sub-row{grid-template-columns:1fr}.omni-sub-manage{width:100%}.omni-sub-summary{grid-template-columns:1fr}.omni-sub-editor-title{align-items:flex-start;flex-direction:column}.omni-sub-clear{width:100%}.omni-sub-toolbar{align-items:stretch;flex-direction:column}}`;
document.head.appendChild(style);

window.addEventListener('load', () => { setTimeout(addSubscriptionManagerButton, 600); }, { once: true });
