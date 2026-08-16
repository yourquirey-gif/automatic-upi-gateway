import { google } from 'googleapis';
import GmailConnection from '../models/GmailConnection.js';
import GatewaySettings from '../models/GatewaySettings.js';
import Order from '../models/Order.js';
import SubscriptionOrder from '../models/SubscriptionOrder.js';
import User from '../models/User.js';
import { decryptSecret } from '../utils/secretBox.js';

function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}

function decodeBody(data) {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function flattenParts(payload, out = []) {
  if (!payload) return out;
  if (payload.body?.data) out.push(decodeBody(payload.body.data));
  for (const part of payload.parts || []) flattenParts(part, out);
  return out;
}

function extractText(payload) {
  return flattenParts(payload).join('\n').replace(/<[^>]+>/g, ' ');
}

function extractUtr(text) {
  return text.match(/(?:UTR|UPI\s*Ref(?:erence)?|Transaction\s*ID)[^A-Za-z0-9]{0,20}([A-Za-z0-9-]{8,40})/i)?.[1] || null;
}

function amountMatches(text, amount) {
  const normalized = text.replace(/,/g, '');
  const value = Number(amount).toFixed(2);
  return new RegExp(`(?:₹|INR|Rs\\.?)[\\s:]*${value.replace('.', '[.]')}(?!\\d)`, 'i').test(normalized) || normalized.includes(value);
}

function expiryFrom(start, days) {
  return new Date(new Date(start).getTime() + Number(days) * 86400000);
}

export async function verifyPendingOrdersForAdmin(ownerId) {
  const connection = await GmailConnection.findOne({ owner: ownerId, active: true }).select('+refreshTokenEncrypted');
  if (!connection) return { checked: 0, confirmed: 0, subscriptionsActivated: 0, reason: 'gmail_not_connected' };
  const settings = await GatewaySettings.findOne({ key: 'global' });
  if (settings?.gmailPaymentVerificationEnabled === false) return { checked: 0, confirmed: 0, subscriptionsActivated: 0, reason: 'gmail_verification_disabled' };

  const client = oauthClient();
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const listed = await gmail.users.messages.list({ userId: 'me', q: settings?.gmailSearchQuery || 'newer_than:2d', maxResults: 100 });
  const ids = (listed.data.messages || []).map((m) => m.id).filter(Boolean);
  if (!ids.length) return { checked: 0, confirmed: 0, subscriptionsActivated: 0 };

  const pending = await Order.find({ owner: ownerId, status: 'PENDING' }).limit(200);
  const subscriptions = await SubscriptionOrder.find({ status: 'PENDING', user: { $exists: true } }).populate('plan').limit(200);
  let confirmed = 0;
  let subscriptionsActivated = 0;

  for (const id of ids) {
    const message = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const text = `${message.data.snippet || ''}\n${extractText(message.data.payload)}`;
    const utr = extractUtr(text);

    for (const order of pending) {
      if (order.status !== 'PENDING' || !text.toLowerCase().includes(order.orderId.toLowerCase()) || !amountMatches(text, order.amount)) continue;
      const fee = Number((order.amount * (order.feePercent || 0) / 100).toFixed(2));
      order.status = 'SUCCESS'; order.paidAt = new Date(); order.utr = utr || order.utr;
      order.feeAmount = fee; order.netAmount = Number((order.amount - fee).toFixed(2));
      order.feeSettlementStatus = fee > 0 ? 'PENDING' : 'NOT_APPLICABLE';
      order.verificationSource = 'gmail'; order.verificationMessageId = id;
      await order.save(); confirmed += 1;
    }

    for (const sub of subscriptions) {
      if (sub.status !== 'PENDING' || !text.toLowerCase().includes(sub.orderId.toLowerCase()) || !amountMatches(text, sub.amount)) continue;
      const started = new Date();
      const expires = expiryFrom(started, sub.plan.durationDays);
      sub.status = 'SUCCESS'; sub.paidAt = started; sub.utr = utr || sub.utr;
      sub.planActivatedAt = started; sub.planExpiresAt = expires;
      sub.verificationSource = 'gmail'; sub.verificationMessageId = id;
      await sub.save();
      await User.findByIdAndUpdate(sub.user, {
        plan: sub.plan._id,
        planStartedAt: started,
        planExpiresAt: expires,
        planStatus: 'ACTIVE',
        trialStartedAt: started,
        trialEndsAt: expires
      });
      subscriptionsActivated += 1;
    }
  }

  connection.lastCheckedAt = new Date(); connection.lastMessageId = ids[0] || connection.lastMessageId;
  await connection.save();
  return { checked: ids.length, confirmed, subscriptionsActivated };
}

export function createGoogleClient() { return oauthClient(); }
