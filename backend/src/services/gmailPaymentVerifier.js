import { google } from 'googleapis';
import GmailConnection from '../models/GmailConnection.js';
import GatewaySettings from '../models/GatewaySettings.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import PaymentReceipt from '../models/PaymentReceipt.js';
import User from '../models/User.js';
import { decryptSecret, encryptSecret } from '../utils/secretBox.js';
import { sendMerchantWebhook } from './merchantWebhook.js';

async function googleOAuthConfig(purpose='gmail') {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
  const clientId = String(settings?.googleClientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = settings?.googleClientSecretEncrypted
    ? decryptSecret(settings.googleClientSecretEncrypted)
    : String(process.env.GOOGLE_CLIENT_SECRET || '');
  const publicApi = String(settings?.publicApiBaseUrl || process.env.PUBLIC_API_BASE_URL || 'https://api.omniupi.in').replace(/\/$/, '');
  const redirectUri = purpose === 'auth'
    ? String(settings?.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI || `${publicApi}/api/v1/auth/google/callback`).trim()
    : `${publicApi}/api/v1/gmail/callback`;
  if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured. Add Client ID and Client Secret in Admin > Gateway Settings.');
  return { clientId, clientSecret, redirectUri };
}

export async function createGoogleClient(purpose='gmail') {
  const c = await googleOAuthConfig(purpose);
  return new google.auth.OAuth2(c.clientId, c.clientSecret, c.redirectUri);
}

function decodeBody(data) { if (!data) return ''; return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
function flattenParts(payload, out = []) { if (!payload) return out; if (payload.body?.data) out.push(decodeBody(payload.body.data)); for (const part of payload.parts || []) flattenParts(part, out); return out; }
function extractText(payload) { return flattenParts(payload).join('\n').replace(/<[^>]+>/g, ' '); }
function normalizeUpi(value) { return String(value || '').trim().toLowerCase(); }
function extractUpiIds(text) { return [...new Set((String(text).match(/[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}/g) || []).map(normalizeUpi))]; }
function extractUtr(text) { return String(text).match(/(?:UTR|UPI\s*(?:Ref(?:erence)?|Transaction\s*ID)|Transaction\s*ID|Txn\s*ID)[^A-Za-z0-9]{0,30}([A-Za-z0-9-]{8,40})/i)?.[1] || null; }
function extractAmount(text) { const normalized = String(text).replace(/,/g, ''); const matches = [...normalized.matchAll(/(?:₹|INR|Rs\.?)[\s:]*([0-9]+(?:\.[0-9]{1,2})?)/gi)]; return matches.length ? Number(matches[0][1]) : null; }
function amountMatches(value, amount) { return Number.isFinite(value) && Math.abs(Number(value) - Number(amount)) < 0.005; }
function withinOrderWindow(date, order) { const t = new Date(date).getTime(); const start = new Date(order.createdAt).getTime() - 10 * 60 * 1000; const end = Math.min(Date.now() + 5 * 60 * 1000, new Date(order.createdAt).getTime() + 48 * 60 * 60 * 1000); return t >= start && t <= end; }

async function listPaymentMessages(gmail, settings) { const q = settings?.gmailSearchQuery || 'newer_than:2d'; const listed = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100 }); return (listed.data.messages || []).map(m => m.id).filter(Boolean); }
async function saveReceipt({ merchant, message, utr, amount, merchantUpiId, payerUpiId, receivedAt }) { if (!utr || !amount) return null; try { return await PaymentReceipt.create({ merchant: merchant._id, messageId: message.id, threadId: message.threadId || null, utr, amount, merchantUpiId: normalizeUpi(merchantUpiId), payerUpiId: payerUpiId || null, receivedAt, consumed: false }); } catch (error) { if (error?.code === 11000) return await PaymentReceipt.findOne({ merchant: merchant._id, utr }); throw error; } }

async function verifyConnection(connection, settings) {
  const merchant = await Merchant.findById(connection.merchant);
  if (!merchant || merchant.status !== 'active' || merchant.verificationStatus !== 'verified') return { checked: 0, confirmed: 0 };
  const client = await createGoogleClient('gmail');
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const ids = await listPaymentMessages(gmail, settings);
  if (!ids.length) return { checked: 0, confirmed: 0 };
  const pending = await Order.find({ merchant: merchant._id, owner: merchant.owner, status: 'PENDING' }).sort({ createdAt: 1 }).limit(500);
  let confirmed = 0;
  for (const id of ids) {
    const message = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    const text = `${message.data.snippet || ''}\n${extractText(message.data.payload)}`;
    const upiIds = extractUpiIds(text); const merchantUpi = normalizeUpi(merchant.upiId);
    if (!merchantUpi || !upiIds.includes(merchantUpi)) continue;
    const utr = extractUtr(text); const amount = extractAmount(text); const receivedAt = new Date(Number(message.data.internalDate || Date.now()));
    if (!utr || !amount) continue;
    const payerUpiId = upiIds.find(x => x !== merchantUpi) || null;
    const receipt = await saveReceipt({ merchant, message, utr, amount, merchantUpiId: merchantUpi, payerUpiId, receivedAt });
    if (!receipt || receipt.consumed) continue;
    const candidates = pending.filter(order => order.status === 'PENDING' && amountMatches(amount, order.amount) && withinOrderWindow(receivedAt, order));
    if (candidates.length !== 1) continue;
    const order = candidates[0]; const fee = Number((order.amount * (order.feePercent || 0) / 100).toFixed(2));
    order.status = 'SUCCESS'; order.paidAt = receivedAt; order.utr = utr; order.feeAmount = fee; order.netAmount = Number((order.amount - fee).toFixed(2)); order.feeSettlementStatus = fee > 0 ? 'PENDING' : 'NOT_APPLICABLE'; order.verificationSource = 'gmail'; order.verificationMessageId = id; order.paymentReceipt = receipt._id; await order.save();
    receipt.consumed = true; receipt.order = order._id; await receipt.save();
    const merchantUser = await User.findById(order.owner).select('+instanceSecret webhookUrl userId'); if (merchantUser) await sendMerchantWebhook(merchantUser, order); confirmed += 1;
  }
  connection.lastCheckedAt = new Date(); connection.lastMessageId = ids[0] || connection.lastMessageId; await connection.save();
  return { checked: ids.length, confirmed };
}

export async function verifyMerchantGmail({ merchant, client, email, refreshToken }) {
  client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: client });
  const listed = await gmail.users.messages.list({ userId: 'me', q: 'newer_than:30d', maxResults: 50 });
  const ids = (listed.data.messages || []).map(x => x.id).filter(Boolean); const merchantUpi = normalizeUpi(merchant.upiId); let matched = false;
  for (const id of ids) {
    const message = await gmail.users.messages.get({ userId: 'me', id, format: 'full' }); const text = `${message.data.snippet || ''}\n${extractText(message.data.payload)}`; const upis = extractUpiIds(text); const mobileMatches = merchant.mobile && String(text).replace(/\D/g, '').includes(String(merchant.mobile).replace(/\D/g, '')); const paymentWords = /(credited|received|payment|upi|transaction|collect)/i.test(text);
    if (merchantUpi && upis.includes(merchantUpi) && paymentWords && (mobileMatches || !merchant.mobile)) { matched = true; break; }
  }
  if (!matched) { merchant.verificationStatus = 'failed'; merchant.status = 'pending'; merchant.verificationMessage = 'Google authorization succeeded, but no payment email proving this Gmail account is linked to the merchant UPI account was found. Please use the Gmail account linked with this merchant/payment account.'; await merchant.save(); return { verified: false, message: merchant.verificationMessage }; }
  await GmailConnection.findOneAndUpdate({ merchant: merchant._id }, { merchant: merchant._id, owner: merchant.owner, email, refreshTokenEncrypted: encryptSecret(refreshToken), active: true }, { upsert: true, new: true });
  merchant.verificationStatus = 'verified'; merchant.status = 'active'; merchant.verifiedAt = new Date(); merchant.verifiedEmail = email; merchant.verificationMessage = 'Merchant verified successfully. Gmail payment verification is active.'; await merchant.save(); return { verified: true, message: merchant.verificationMessage };
}

export async function verifyPendingOrdersForAdmin(ownerId) {
  const connections = await GmailConnection.find({ owner: ownerId, active: true }).select('+refreshTokenEncrypted');
  if (!connections.length) return { checked: 0, confirmed: 0, reason: 'gmail_not_connected' };
  const settings = await GatewaySettings.findOne({ key: 'global' });
  if (settings?.gmailPaymentVerificationEnabled === false) return { checked: 0, confirmed: 0, reason: 'gmail_verification_disabled' };
  const totals = { checked: 0, confirmed: 0 };
  for (const connection of connections) { const result = await verifyConnection(connection, settings); totals.checked += result.checked; totals.confirmed += result.confirmed; }
  return totals;
}

export async function verifyAllConnectedGmails() {
  const settings = await GatewaySettings.findOne({ key: 'global' });
  if (settings?.gmailPaymentVerificationEnabled === false) return { connections: 0, checked: 0, confirmed: 0, reason: 'gmail_verification_disabled' };
  const connections = await GmailConnection.find({ active: true }).select('+refreshTokenEncrypted');
  const totals = { connections: connections.length, checked: 0, confirmed: 0 };
  for (const connection of connections) { try { const result = await verifyConnection(connection, settings); totals.checked += result.checked; totals.confirmed += result.confirmed; } catch (error) { console.error(`Gmail verification failed for connection ${connection.email}:`, error.message); } }
  return totals;
}
