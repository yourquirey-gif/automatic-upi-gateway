import crypto from 'crypto';
import User from '../models/User.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import { decryptSecret } from '../utils/secretBox.js';

async function resolveWebhookSecret(user) {
  if (!user?._id) return '';
  const selected = user?.instanceSecretEncrypted ? user : await User.findOne({ _id: user._id, status: 'active' }).select('+instanceSecret +instanceSecretEncrypted');
  if (!selected) return '';
  if (selected.instanceSecretEncrypted) { try { return decryptSecret(selected.instanceSecretEncrypted); } catch { return ''; } }
  return String(selected.instanceSecret || '').trim();
}

export async function signWebhookPayload(user, payload) {
  const secret = await resolveWebhookSecret(user);
  if (!secret) throw Object.assign(new Error('Webhook secret is not configured.'), { code: 'WEBHOOK_SECRET_MISSING' });
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function writeDelivery(user, result) {
  try { await WebhookDelivery.create(result); } catch { /* delivery logging must never break payment verification */ }
}

export async function sendMerchantWebhook(user, order) {
  const webhookUrl = String(user?.webhookUrl || '').trim();
  if (!webhookUrl) return { sent: false, reason: 'webhook_not_configured' };
  const payload = JSON.stringify({ status: order.status, order_id: order.orderId, customer_mobile: order.customerMobile || '', amount: Number(order.amount).toFixed(2), utr: order.utr || '', remark1: order.remark1 || '', remark2: order.remark2 || '', timestamp: Math.floor(Date.now() / 1000) });
  let signature;
  try { signature = await signWebhookPayload(user, payload); } catch (error) { await writeDelivery(user, { owner: user._id, event: 'payment.success', orderId: order.orderId, success: false, retryStatus: 'not_scheduled', errorReason: error.code === 'WEBHOOK_SECRET_MISSING' ? 'Webhook secret is not configured' : 'Webhook signing failed' }); return { sent: false, reason: 'webhook_secret_missing' }; }
  const started = Date.now();
  try {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature, 'X-Webhook-Event': 'payment.success' }, body: payload, signal: controller.signal });
    clearTimeout(timeout);
    const result = { owner: user._id, event: 'payment.success', orderId: order.orderId, deliveredAt: new Date(), httpStatus: response.status, success: response.ok, retryStatus: 'not_scheduled', errorReason: response.ok ? '' : `HTTP ${response.status}`, responseTimeMs: Date.now() - started };
    await writeDelivery(user, result);
    return { sent: response.ok, statusCode: response.status, responseTimeMs: result.responseTimeMs };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'network_error';
    await writeDelivery(user, { owner: user._id, event: 'payment.success', orderId: order.orderId, deliveredAt: new Date(), success: false, retryStatus: 'not_scheduled', errorReason: reason, responseTimeMs: Date.now() - started });
    return { sent: false, reason };
  }
}

export async function sendTestWebhook(user) {
  const payload = JSON.stringify({ status: 'TEST', order_id: `TEST_${Date.now()}`, amount: '0.00', utr: '', remark1: 'OmniUPI webhook test', remark2: '', timestamp: Math.floor(Date.now() / 1000) });
  const signature = await signWebhookPayload(user, payload);
  const webhookUrl = String(user?.webhookUrl || '').trim();
  if (!webhookUrl) throw Object.assign(new Error('Configure a webhook URL before testing.'), { code: 'WEBHOOK_URL_MISSING' });
  const started = Date.now();
  try {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature, 'X-Webhook-Event': 'webhook.test' }, body: payload, signal: controller.signal });
    clearTimeout(timeout);
    const result = { statusCode: response.status, success: response.ok, responseTimeMs: Date.now() - started, message: response.ok ? 'Webhook test delivered successfully.' : `Webhook returned HTTP ${response.status}.` };
    await writeDelivery(user, { owner: user._id, event: 'webhook.test', orderId: payload.match(/TEST_[0-9]+/)?.[0] || '', deliveredAt: new Date(), httpStatus: response.status, success: response.ok, retryStatus: 'not_scheduled', errorReason: response.ok ? '' : `HTTP ${response.status}`, responseTimeMs: result.responseTimeMs });
    return result;
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'network_error';
    await writeDelivery(user, { owner: user._id, event: 'webhook.test', deliveredAt: new Date(), success: false, retryStatus: 'not_scheduled', errorReason: reason, responseTimeMs: Date.now() - started });
    return { statusCode: null, success: false, responseTimeMs: Date.now() - started, message: reason === 'timeout' ? 'Webhook request timed out.' : 'Webhook request could not be delivered.' };
  }
}
