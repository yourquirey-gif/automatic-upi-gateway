import { google } from 'googleapis';
import GmailConnection from '../models/GmailConnection.js';
import GatewaySettings from '../models/GatewaySettings.js';
import Order from '../models/Order.js';
import { decryptSecret } from '../utils/secretBox.js';

function oauthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return client;
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

export async function verifyPendingOrdersForAdmin(ownerId) {
  const connection = await GmailConnection.findOne({ owner: ownerId, active: true }).select('+refreshTokenEncrypted');
  if (!connection) return { checked: 0, confirmed: 0, reason: 'gmail_not_connected' };

  const settings = await GatewaySettings.findOne({ key: 'global' });
  if (settings && settings.gmailPaymentVerificationEnabled === false) return { checked: 0, confirmed: 0, reason: 'gmail_verification_disabled' };

  const client = oauthClient();
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const query = settings?.gmailSearchQuery || 'newer_than:2d';
  const listed = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100 });
  const ids = (listed.data.messages || []).map((m) => m.id).filter(Boolean);
  if (!ids.length) return { checked: 0, confirmed: 0 };

  const pending = await Order.find({ owner: ownerId, status: 'PENDING' }).sort({ createdAt: 1 }).limit(200);
  let confirmed = 0;

  for (const id of ids) {
    const message = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const text = `${message.data.snippet || ''}\n${extractText(message.data.payload)}`;
    const utr = extractUtr(text);

    for (const order of pending) {
      if (order.status !== 'PENDING') continue;
      const exactId = text.toLowerCase().includes(String(order.orderId).toLowerCase());
      if (!exactId || !amountMatches(text, order.amount)) continue;

      const fee = Number((order.amount * (order.feePercent || 0) / 100).toFixed(2));
      order.status = 'SUCCESS';
      order.paidAt = new Date();
      order.utr = utr || order.utr;
      order.feeAmount = fee;
      order.netAmount = Number((order.amount - fee).toFixed(2));
      order.feeSettlementStatus = fee > 0 ? 'PENDING' : 'NOT_APPLICABLE';
      order.verificationSource = 'gmail';
      order.verificationMessageId = id;
      await order.save();
      confirmed += 1;
      break;
    }
  }

  connection.lastCheckedAt = new Date();
  connection.lastMessageId = ids[0] || connection.lastMessageId;
  await connection.save();
  return { checked: ids.length, confirmed };
}

export function createGoogleClient() {
  return oauthClient();
}
