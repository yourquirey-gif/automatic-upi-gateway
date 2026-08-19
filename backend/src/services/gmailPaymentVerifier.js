import { google } from 'googleapis';
import crypto from 'crypto';
import GmailConnection from '../models/GmailConnection.js';
import GatewaySettings from '../models/GatewaySettings.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import PaymentReceipt from '../models/PaymentReceipt.js';
import User from '../models/User.js';
import { decryptSecret, encryptSecret } from '../utils/secretBox.js';
import { sendMerchantWebhook } from './merchantWebhook.js';

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const VERIFICATION_AMOUNT = 1;
const VERIFICATION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

async function googleOAuthConfig(purpose = 'gmail') {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
  const clientId = String(settings?.googleClientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = settings?.googleClientSecretEncrypted ? decryptSecret(settings.googleClientSecretEncrypted) : String(process.env.GOOGLE_CLIENT_SECRET || '');
  const publicApi = String(settings?.publicApiBaseUrl || process.env.PUBLIC_API_BASE_URL || 'https://api.omniupi.in').replace(/\/$/, '');
  const configured = String(settings?.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI || '').trim();
  const redirectUri = purpose === 'auth' ? (configured || `${publicApi}/api/v1/auth/google/callback`) : `${publicApi}/api/v1/gmail/callback`;
  if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured. Add Client ID and Client Secret in Admin > Gateway Settings.');
  return { clientId, clientSecret, redirectUri };
}

export async function createGoogleClient(purpose = 'gmail') {
  const c = await googleOAuthConfig(purpose);
  return new google.auth.OAuth2(c.clientId, c.clientSecret, c.redirectUri);
}

function decodeBody(data) { if (!data) return ''; return Buffer.from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
function flattenParts(payload, out = []) { if (!payload) return out; if (payload.body?.data) out.push(decodeBody(payload.body.data)); for (const part of payload.parts || []) flattenParts(part, out); return out; }
function extractText(payload) { return flattenParts(payload).join('\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalizeUpi(v) { return String(v || '').trim().toLowerCase(); }

function extractUtr(text) {
  const value = String(text || '');
  const patterns = [
    /(?:UTR|UPI\s*(?:Ref(?:erence)?|Transaction\s*(?:ID|No\.?)?)|Transaction\s*(?:ID|No\.?)|Txn\s*(?:ID|No\.?)|Reference\s*(?:ID|No\.?)?)\s*[:#\-]?\s*([A-Za-z0-9-]{8,64})/i,
    /\b(FMPI[A-Z0-9]{8,60})\b/i
  ];
  for (const pattern of patterns) { const match = value.match(pattern); if (match?.[1]) return match[1]; }
  return null;
}

function extractAmounts(text) {
  const normalized = String(text || '').replace(/,/g, '');
  return [...new Set([...normalized.matchAll(/(?:₹|INR|Rs\.?)[\s:]*([0-9]+(?:\.[0-9]{1,2})?)/gi)].map(m => Number(m[1])).filter(Number.isFinite))];
}
function amountMatches(value, expected) { return Number.isFinite(value) && Math.abs(Number(value) - Number(expected)) < 0.005; }
function containsExactOrderId(text, orderId) {
  const value = String(text || '');
  const id = String(orderId || '').trim();
  if (!id) return false;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\b)Payment\\s+${escaped}(?:\\b|$)`, 'i').test(value) || new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i').test(value);
}
function messageMatchesOrder(text, order) { return containsExactOrderId(text, order.orderId); }

async function listMessagesForOrderIds(gmail, orderIds) {
  const ids = new Set();
  const unique = [...new Set(orderIds.map(String).filter(Boolean))];
  const chunkSize = 20;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const exactTerms = chunk.map(id => `"${id.replace(/"/g, '')}"`);
    const q = `{${exactTerms.join(' ')}} newer_than:365d -in:spam -in:trash`;
    let pageToken;
    do {
      const listed = await gmail.users.messages.list({ userId: 'me', q, maxResults: 500, pageToken });
      for (const message of listed.data.messages || []) if (message.id) ids.add(message.id);
      pageToken = listed.data.nextPageToken;
    } while (pageToken);
  }
  return [...ids];
}

async function getVerificationOrder(merchant) {
  const configuredId = String(merchant.config?.verificationOrderId || '').trim();
  if (configuredId) {
    const existing = await Order.findOne({ merchant: merchant._id, owner: merchant.owner, orderId: configuredId });
    if (existing && existing.status !== 'SUCCESS') return existing;
    if (existing?.status === 'SUCCESS') return existing;
  }
  const existingPending = await Order.findOne({ merchant: merchant._id, owner: merchant.owner, status: 'PENDING', orderId: /^VERIFY_[A-Za-z0-9]+$/ }).sort({ createdAt: -1 });
  if (existingPending) return existingPending;
  const orderId = `VERIFY_${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
  const publicSite = String(process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in').replace(/\/$/, '');
  const order = await Order.create({ merchant: merchant._id, owner: merchant.owner, orderId, amount: VERIFICATION_AMOUNT, remark1: `Payment ${orderId}`, remark2: 'OmniUPI UPI verification payment', status: 'PENDING', feePercent: 0, feeAmount: 0, netAmount: VERIFICATION_AMOUNT, feeSettlementStatus: 'NOT_APPLICABLE', verificationSource: 'gmail', paymentUrl: `${publicSite}/pay.html?order_id=${encodeURIComponent(orderId)}`, expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) });
  merchant.config = { ...(merchant.config || {}), verificationOrderId: order.orderId };
  await merchant.save();
  return order;
}

export async function createVerificationOrder(merchant) {
  const order = await getVerificationOrder(merchant);
  return { orderId: order.orderId, amount: order.amount, paymentUrl: order.paymentUrl, expiresAt: order.expiresAt };
}

async function saveReceipt({ merchant, message, utr, amount, receivedAt }) {
  const normalizedUtr = String(utr || '').trim() || null;
  if (normalizedUtr) {
    const existingUtr = await PaymentReceipt.findOne({ merchant: merchant._id, utr: normalizedUtr });
    if (existingUtr) return existingUtr;
  }
  try {
    return await PaymentReceipt.create({ merchant: merchant._id, messageId: message.id, threadId: message.threadId || null, utr: normalizedUtr, amount, merchantUpiId: normalizeUpi(merchant.upiId) || null, payerUpiId: null, receivedAt, consumed: false });
  } catch (error) {
    if (error?.code === 11000) return PaymentReceipt.findOne({ merchant: merchant._id, messageId: message.id });
    throw error;
  }
}

async function verifyOrderFromMessage({ merchant, order, message }) {
  // Payment verification is intentionally based only on the exact OmniUPI order ID and exact amount.
  // The complete Gmail message is inspected. UTR is stored when available, but is not required.
  const text = `${message.data.snippet || ''}\n${extractText(message.data.payload)}`;
  if (!messageMatchesOrder(text, order)) return { confirmed: false, reason: 'order_id_mismatch' };

  const amounts = extractAmounts(text);
  if (!amounts.some(amount => amountMatches(amount, order.amount))) return { confirmed: false, reason: 'amount_mismatch' };

  const receivedAt = new Date(Number(message.data.internalDate || 0));
  const paidAt = Number.isFinite(receivedAt.getTime()) ? receivedAt : new Date();
  const utr = extractUtr(text);

  if (utr) {
    const reused = await Order.findOne({ merchant: merchant._id, utr, status: 'SUCCESS', _id: { $ne: order._id } }).select('_id orderId');
    if (reused) return { confirmed: false, reason: 'utr_already_used' };
    const receiptReused = await PaymentReceipt.findOne({ merchant: merchant._id, utr, consumed: true, order: { $ne: order._id } }).select('_id order');
    if (receiptReused) return { confirmed: false, reason: 'utr_already_consumed' };
  }

  const existingReceipt = await PaymentReceipt.findOne({ merchant: merchant._id, messageId: message.id });
  if (existingReceipt?.consumed && String(existingReceipt.order || '') !== String(order._id)) return { confirmed: false, reason: 'message_already_consumed' };
  const receipt = existingReceipt || await saveReceipt({ merchant, message, utr, amount: order.amount, receivedAt: paidAt });
  if (!receipt || (receipt.consumed && String(receipt.order || '') !== String(order._id))) return { confirmed: false, reason: 'receipt_unavailable' };

  const fee = Number((order.amount * (order.feePercent || 0) / 100).toFixed(2));
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, merchant: merchant._id, owner: order.owner, status: 'PENDING' },
    { $set: { status: 'SUCCESS', paidAt, ...(utr ? { utr } : {}), feeAmount: fee, netAmount: Number((order.amount - fee).toFixed(2)), feeSettlementStatus: fee > 0 ? 'PENDING' : 'NOT_APPLICABLE', verificationSource: 'gmail', verificationMessageId: message.id, paymentReceipt: receipt._id } },
    { new: true }
  );
  if (!claimed) return { confirmed: false, reason: 'order_already_processed' };

  await PaymentReceipt.updateOne({ _id: receipt._id }, { $set: { consumed: true, order: claimed._id } });
  const merchantUser = await User.findById(claimed.owner).select('+instanceSecret webhookUrl userId');
  if (merchantUser) await sendMerchantWebhook(merchantUser, claimed);
  return { confirmed: true, order: claimed, utr: utr || null, receivedAt: paidAt };
}

async function verifyConnection(connection) {
  const merchant = await Merchant.findById(connection.merchant);
  if (!merchant || merchant.status !== 'active' || merchant.verificationStatus !== 'verified') return { checked: 0, confirmed: 0 };
  const client = await createGoogleClient('gmail');
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const now = new Date();
  const pending = await Order.find({ merchant: merchant._id, owner: merchant.owner, status: 'PENDING', expiresAt: { $gt: now } }).sort({ createdAt: 1 }).limit(500);
  if (!pending.length) return { checked: 0, confirmed: 0 };
  const ids = await listMessagesForOrderIds(gmail, pending.map(order => order.orderId));
  let confirmed = 0;
  for (const id of ids) {
    const message = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const text = `${message.data.snippet || ''}\n${extractText(message.data.payload)}`;
    const matches = pending.filter(order => order.status === 'PENDING' && messageMatchesOrder(text, order) && extractAmounts(text).some(amount => amountMatches(amount, order.amount)));
    if (matches.length !== 1) continue;
    const result = await verifyOrderFromMessage({ merchant, order: matches[0], message });
    if (result.confirmed) confirmed++;
  }
  connection.lastCheckedAt = new Date();
  connection.lastMessageId = ids[0] || connection.lastMessageId;
  await connection.save();
  return { checked: ids.length, confirmed };
}

export async function verifyOrderWithGmail(orderId) {
  const order = await Order.findOne({ orderId: String(orderId || '').trim(), status: 'PENDING' });
  if (!order) return { found: false, confirmed: false, reason: 'order_not_pending' };
  const merchant = await Merchant.findOne({ _id: order.merchant, owner: order.owner });
  if (!merchant || merchant.status !== 'active' || merchant.verificationStatus !== 'verified') return { found: true, confirmed: false, reason: 'merchant_not_verified' };
  const connection = await GmailConnection.findOne({ merchant: merchant._id, owner: order.owner, active: true }).select('+refreshTokenEncrypted');
  if (!connection) return { found: true, confirmed: false, reason: 'gmail_not_connected' };
  const client = await createGoogleClient('gmail');
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const ids = await listMessagesForOrderIds(gmail, [order.orderId]);
  for (const id of ids) {
    const message = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const result = await verifyOrderFromMessage({ merchant, order, message });
    if (result.confirmed) return { found: true, confirmed: true, order: result.order };
  }
  connection.lastCheckedAt = new Date();
  connection.lastMessageId = ids[0] || connection.lastMessageId;
  await connection.save();
  return { found: true, confirmed: false, reason: 'payment_not_found' };
}

export async function verifyMerchantVerificationPayment({ merchant, connection }) {
  const order = await getVerificationOrder(merchant);
  if (order.status === 'SUCCESS') {
    merchant.verificationStatus = 'verified'; merchant.status = 'active'; merchant.verifiedAt = order.paidAt || new Date();
    merchant.verificationMessage = 'UPI verified using exact verification Order ID and amount matched in the Gmail payment email.';
    await merchant.save();
    return { verified: true, order, message: merchant.verificationMessage };
  }
  if (!connection?.refreshTokenEncrypted) return { verified: false, order, message: 'Gmail is connected, but its refresh token is unavailable. Reconnect Gmail.' };
  const client = await createGoogleClient('gmail');
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const ids = await listMessagesForOrderIds(gmail, [order.orderId]);
  for (const id of ids) {
    const message = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const result = await verifyOrderFromMessage({ merchant, order, message });
    if (result.confirmed) {
      const refreshed = await Order.findById(order._id);
      merchant.verificationStatus = 'verified'; merchant.status = 'active'; merchant.verifiedAt = refreshed?.paidAt || new Date();
      merchant.verificationMessage = 'UPI verified using exact verification Order ID and amount matched in the Gmail payment email.';
      await merchant.save();
      return { verified: true, order: refreshed, message: merchant.verificationMessage };
    }
  }
  merchant.verificationStatus = 'pending'; merchant.status = 'pending';
  merchant.verificationMessage = `Gmail connected. Pay ₹1 using this UPI, with Purpose/remark ${order.orderId}, then check verification again.`;
  await merchant.save();
  return { verified: false, order, message: merchant.verificationMessage };
}

export async function verifyMerchantGmail({ merchant, client, email, refreshToken, requirePaymentMatch = true }) {
  if (!refreshToken) return { verified: false, message: 'Google did not return a refresh token. Reconnect Gmail and grant consent again.' };
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return { verified: false, message: 'Google did not return a verified Gmail address.' };
  const encrypted = encryptSecret(refreshToken);
  const connection = await GmailConnection.findOneAndUpdate({ merchant: merchant._id }, { merchant: merchant._id, owner: merchant.owner, email: normalizedEmail, refreshTokenEncrypted: encrypted, active: true }, { upsert: true, new: true }).select('+refreshTokenEncrypted');
  if (!requirePaymentMatch) {
    merchant.verificationStatus = 'pending'; merchant.status = 'pending'; merchant.verifiedEmail = normalizedEmail;
    merchant.verificationMessage = 'Gmail connected. A controlled ₹1 verification payment is required before this UPI becomes active.';
    await merchant.save();
    return { verified: false, message: merchant.verificationMessage, verificationOrder: await createVerificationOrder(merchant) };
  }
  merchant.verifiedEmail = normalizedEmail;
  await merchant.save();
  return verifyMerchantVerificationPayment({ merchant, connection });
}

export async function verifyPendingOrdersForAdmin(ownerId) {
  const connections = await GmailConnection.find({ owner: ownerId, active: true }).select('+refreshTokenEncrypted');
  if (!connections.length) return { checked: 0, confirmed: 0, reason: 'gmail_not_connected' };
  const settings = await GatewaySettings.findOne({ key: 'global' });
  if (settings?.gmailPaymentVerificationEnabled === false) return { checked: 0, confirmed: 0, reason: 'gmail_verification_disabled' };
  const totals = { checked: 0, confirmed: 0 };
  for (const connection of connections) { try { const result = await verifyConnection(connection); totals.checked += result.checked; totals.confirmed += result.confirmed; } catch (error) { console.error(`Gmail verification failed for ${connection.email}:`, error.message); } }
  return totals;
}

export async function verifyAllConnectedGmails() {
  const settings = await GatewaySettings.findOne({ key: 'global' });
  if (settings?.gmailPaymentVerificationEnabled === false) return { connections: 0, checked: 0, confirmed: 0, reason: 'gmail_verification_disabled' };
  const connections = await GmailConnection.find({ active: true }).select('+refreshTokenEncrypted');
  const totals = { connections: connections.length, checked: 0, confirmed: 0 };
  for (const connection of connections) { try { const result = await verifyConnection(connection); totals.checked += result.checked; totals.confirmed += result.confirmed; } catch (error) { console.error(`Gmail verification failed for ${connection.email}:`, error.message); } }
  return totals;
}
