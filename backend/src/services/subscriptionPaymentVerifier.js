import { google } from 'googleapis';
import GmailConnection from '../models/GmailConnection.js';
import GatewaySettings from '../models/GatewaySettings.js';
import SubscriptionOrder from '../models/SubscriptionOrder.js';
import User from '../models/User.js';
import { decryptSecret } from '../utils/secretBox.js';

function normalizeUpi(value) { return String(value || '').trim().toLowerCase(); }
function decodeBody(data) { if (!data) return ''; return Buffer.from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
function flattenParts(payload, out = []) { if (!payload) return out; if (payload.body?.data) out.push(decodeBody(payload.body.data)); for (const part of payload.parts || []) flattenParts(part, out); return out; }
function extractText(payload) { return flattenParts(payload).join('\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function extractUpiIds(text) { return [...new Set((String(text).match(/[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}/g) || []).map(normalizeUpi))]; }
function extractUtr(text) { return String(text).match(/(?:UTR|UPI\s*(?:Ref(?:erence)?|Transaction\s*(?:ID|No\.?))|Transaction\s*(?:ID|No\.? )|Txn\s*(?:ID|No\.?))[^A-Za-z0-9]{0,40}([A-Za-z0-9-]{8,40})/i)?.[1] || null; }
function extractAmounts(text) {
  const normalized = String(text).replace(/,/g, '');
  return [...new Set([...normalized.matchAll(/(?:₹|INR|Rs\.?)[\s:]*([0-9]+(?:\.[0-9]{1,2})?)/gi)].map(m => Number(m[1])).filter(Number.isFinite))];
}
function amountMatches(a, b) { return Number.isFinite(a) && Math.abs(Number(a) - Number(b)) < 0.005; }
function withinWindow(date, order) { const t = new Date(date).getTime(); const c = new Date(order.createdAt).getTime(); return t >= c - 10 * 60 * 1000 && t <= c + 30 * 60 * 1000; }
function expiryFrom(start, days) { return new Date(new Date(start).getTime() + Number(days || 0) * 86400000); }

async function activate(order, receivedAt, utr, messageId) {
  if (order.status !== 'PENDING') return false;
  const plan = order.plan;
  if (!plan) return false;
  const started = new Date(receivedAt);
  const expires = expiryFrom(started, plan.durationDays);
  order.status = 'SUCCESS';
  order.paidAt = started;
  order.utr = utr || order.utr;
  order.planActivatedAt = started;
  order.planExpiresAt = expires;
  order.verificationSource = 'gmail';
  order.verificationMessageId = messageId;
  await order.save();
  await User.findByIdAndUpdate(order.user, { plan: plan._id, planStartedAt: started, planExpiresAt: expires, planStatus: 'ACTIVE' });
  return true;
}

export async function verifySubscriptionOrderForAdmin(orderId) {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
  if (settings?.gmailPaymentVerificationEnabled === false) return { verified: false, reason: 'gmail_verification_disabled' };
  const order = await SubscriptionOrder.findOne({ orderId, status: 'PENDING' }).populate('plan');
  if (!order) return { verified: false, reason: 'order_not_pending' };
  const adminUsers = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  if (!adminUsers.length) return { verified: false, reason: 'admin_not_found' };
  const targetUpi = normalizeUpi(settings?.subscriptionUpiId);
  if (!targetUpi) return { verified: false, reason: 'subscription_upi_not_configured' };

  for (const admin of adminUsers) {
    const connection = await GmailConnection.findOne({ owner: admin._id, active: true }).select('+refreshTokenEncrypted');
    if (!connection) continue;
    try {
      const clientId = String(settings?.googleClientId || process.env.GOOGLE_CLIENT_ID || '').trim();
      const clientSecret = settings?.googleClientSecretEncrypted ? decryptSecret(settings.googleClientSecretEncrypted) : String(process.env.GOOGLE_CLIENT_SECRET || '');
      const publicApi = String(settings?.publicApiBaseUrl || process.env.PUBLIC_API_BASE_URL || 'https://api.omniupi.in').replace(/\/$/, '');
      const redirectUri = String(settings?.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI || '').trim() || `${publicApi}/api/v1/gmail/callback`;
      const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
      const gmail = google.gmail({ version: 'v1', auth: client });
      const listed = await gmail.users.messages.list({ userId: 'me', q: 'newer_than:1d', maxResults: 100 });
      for (const item of listed.data.messages || []) {
        const message = await gmail.users.messages.get({ userId: 'me', id: item.id, format: 'full' });
        const text = `${message.data.snippet || ''}\n${extractText(message.data.payload)}`;
        const upis = extractUpiIds(text);
        if (!upis.includes(targetUpi)) continue;
        const amounts = extractAmounts(text);
        if (!amounts.some(value => amountMatches(value, order.amount))) continue;
        const receivedAt = new Date(Number(message.data.internalDate || Date.now()));
        if (!withinWindow(receivedAt, order)) continue;
        const lower = text.toLowerCase();
        const orderMentioned = lower.includes(String(order.orderId).toLowerCase());
        const paymentWords = /(credited|received|payment|upi|transaction|collect)/i.test(text);
        if (!paymentWords) continue;
        // Prefer an exact order ID when the bank/Gmail notification includes the UPI transaction note.
        // If the notification omits the note, amount + destination UPI + tight time window is used.
        if (orderMentioned || amounts.some(value => amountMatches(value, order.amount))) {
          const ok = await activate(order, receivedAt, extractUtr(text), item.id);
          if (ok) {
            connection.lastCheckedAt = new Date();
            connection.lastMessageId = item.id;
            await connection.save();
            return { verified: true, status: 'SUCCESS', paidAt: order.paidAt, expiresAt: order.planExpiresAt, utr: order.utr };
          }
        }
      }
      connection.lastCheckedAt = new Date();
      await connection.save();
    } catch (error) {
      console.error(`Subscription Gmail verification failed for ${connection.email}:`, error.message);
    }
  }
  return { verified: false, reason: 'payment_not_found' };
}
