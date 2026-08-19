import crypto from 'crypto';
import { ImapFlow } from 'imapflow';
import GmailConnection from '../models/GmailConnection.js';
import GatewaySettings from '../models/GatewaySettings.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import PaymentReceipt from '../models/PaymentReceipt.js';
import User from '../models/User.js';
import { decryptSecret, encryptSecret } from '../utils/secretBox.js';
import { sendMerchantWebhook } from './merchantWebhook.js';

const VERIFICATION_AMOUNT = 1;
const VERIFICATION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const emailOf = v => String(v || '').trim().toLowerCase();
const appPassOf = v => String(v || '').replace(/\s+/g, '').trim();
const upiOf = v => String(v || '').trim().toLowerCase();

function extractText(source) {
  return (Buffer.isBuffer(source) ? source.toString('utf8') : String(source || ''))
    .replace(/\r/g, ' ').replace(/=\r?\n/g, '').replace(/=3D/g, '=')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function extractUtr(text) {
  for (const pattern of [
    /(?:UTR|UPI\s*(?:Ref(?:erence)?|Transaction\s*(?:ID|No\.?)?)|Transaction\s*(?:ID|No\.?)|Txn\s*(?:ID|No\.?)|Reference\s*(?:ID|No\.?)?)\s*[:#\-]?\s*([A-Za-z0-9-]{8,64})/i,
    /\b(FMPI[A-Z0-9]{8,60})\b/i
  ]) { const m = String(text || '').match(pattern); if (m?.[1]) return m[1]; }
  return null;
}
function extractAmounts(text) {
  const normalized = String(text || '').replace(/,/g, '');
  return [...new Set([...normalized.matchAll(/(?:₹|INR|Rs\.?)[\s:]*([0-9]+(?:\.[0-9]{1,2})?)/gi)].map(m => Number(m[1])).filter(Number.isFinite))];
}
function amountMatches(a, b) { return Number.isFinite(a) && Math.abs(Number(a) - Number(b)) < 0.005; }
function messageMatchesOrder(text, order) {
  const id = String(order?.orderId || '').trim(); if (!id) return false;
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\b)Payment\\s+${escaped}(?:\\b|$)`, 'i').test(text) || new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, 'i').test(text);
}

async function listMailboxes(client) {
  // ImapFlow exposes LIST through client.list(); there is no listMailboxes() API.
  const boxes = await client.list();
  return [...new Set((boxes || []).map(box => ({
    path: box.path || box.name,
    flags: new Set(box.flags || [])
  })).filter(box => {
    const lower = String(box.path || '').toLowerCase();
    return box.path && !box.flags.has('\\Trash') && !box.flags.has('\\Junk') && !lower.includes('spam') && !lower.includes('trash');
  }).map(box => box.path))];
}
async function withImap(connection, fn) {
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: emailOf(connection.email), pass: decryptSecret(connection.appPasswordEncrypted) }, logger: false, socketTimeout: 30000 });
  try { await client.connect(); return await fn(client); } finally { try { await client.logout(); } catch { try { client.close(); } catch {} } }
}
export async function testGmailAppPassword(email, appPassword) {
  const e = emailOf(email), p = appPassOf(appPassword);
  if (!/^[^@\s]+@gmail\.com$/i.test(e)) throw new Error('Use a valid @gmail.com address.');
  if (p.length !== 16) throw new Error('Gmail App Password should contain exactly 16 characters after removing spaces.');
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: e, pass: p }, logger: false, socketTimeout: 20000 });
  try { await client.connect(); return { email: e, folders: (await listMailboxes(client)).length }; }
  finally { try { await client.logout(); } catch { try { client.close(); } catch {} } }
}
export async function checkStoredGmailConnection(connection) {
  if (!connection?.email || !connection?.appPasswordEncrypted) throw new Error('Gmail App Password is not connected.');
  return withImap(connection, async client => ({ email: emailOf(connection.email), folders: (await listMailboxes(client)).length, connected: true, checkedAt: new Date() }));
}

async function verificationOrder(merchant) {
  const configured = String(merchant.config?.verificationOrderId || '').trim();
  if (configured) { const existing = await Order.findOne({ merchant: merchant._id, owner: merchant.owner, orderId: configured }); if (existing) return existing; }
  const pending = await Order.findOne({ merchant: merchant._id, owner: merchant.owner, status: 'PENDING', orderId: /^VERIFY_[A-Za-z0-9]+$/ }).sort({ createdAt: -1 });
  if (pending) return pending;
  const orderId = `VERIFY_${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
  const site = String(process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in').replace(/\/$/, '');
  const order = await Order.create({ merchant: merchant._id, owner: merchant.owner, orderId, amount: VERIFICATION_AMOUNT, remark1: `Payment ${orderId}`, remark2: 'OmniUPI UPI verification payment', status: 'PENDING', feePercent: 0, feeAmount: 0, netAmount: VERIFICATION_AMOUNT, feeSettlementStatus: 'NOT_APPLICABLE', verificationSource: 'gmail', paymentUrl: `${site}/pay.html?order_id=${encodeURIComponent(orderId)}`, expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) });
  merchant.config = { ...(merchant.config || {}), verificationOrderId: order.orderId }; await merchant.save(); return order;
}
export async function createVerificationOrder(merchant) { const o = await verificationOrder(merchant); return { orderId: o.orderId, amount: o.amount, paymentUrl: o.paymentUrl, expiresAt: o.expiresAt }; }

async function claim({ merchant, order, messageId, source, receivedAt }) {
  const text = extractText(source); if (!messageMatchesOrder(text, order)) return { confirmed: false, reason: 'order_id_mismatch' };
  if (!extractAmounts(text).some(a => amountMatches(a, order.amount))) return { confirmed: false, reason: 'amount_mismatch' };
  const utr = extractUtr(text);
  if (utr) {
    if (await Order.findOne({ merchant: merchant._id, utr, status: 'SUCCESS', _id: { $ne: order._id } })) return { confirmed: false, reason: 'utr_already_used' };
    if (await PaymentReceipt.findOne({ merchant: merchant._id, utr, consumed: true, order: { $ne: order._id } })) return { confirmed: false, reason: 'utr_already_consumed' };
  }
  const existing = await PaymentReceipt.findOne({ merchant: merchant._id, messageId });
  if (existing?.consumed && String(existing.order || '') !== String(order._id)) return { confirmed: false, reason: 'message_already_consumed' };
  let receipt = existing;
  if (!receipt) { try { receipt = await PaymentReceipt.create({ merchant: merchant._id, messageId, utr: utr || null, amount: order.amount, merchantUpiId: upiOf(merchant.upiId) || null, payerUpiId: null, receivedAt, consumed: false }); } catch (e) { if (e?.code === 11000) receipt = await PaymentReceipt.findOne({ merchant: merchant._id, messageId }); else throw e; } }
  if (!receipt) return { confirmed: false, reason: 'receipt_unavailable' };
  const fee = Number((order.amount * (order.feePercent || 0) / 100).toFixed(2));
  const claimed = await Order.findOneAndUpdate({ _id: order._id, merchant: merchant._id, owner: order.owner, status: 'PENDING' }, { $set: { status: 'SUCCESS', paidAt: receivedAt, ...(utr ? { utr } : {}), feeAmount: fee, netAmount: Number((order.amount - fee).toFixed(2)), feeSettlementStatus: fee > 0 ? 'PENDING' : 'NOT_APPLICABLE', verificationSource: 'gmail', verificationMessageId: messageId, paymentReceipt: receipt._id } }, { new: true });
  if (!claimed) return { confirmed: false, reason: 'order_already_processed' };
  await PaymentReceipt.updateOne({ _id: receipt._id }, { $set: { consumed: true, order: claimed._id } });
  const user = await User.findById(claimed.owner).select('+instanceSecret webhookUrl userId'); if (user) await sendMerchantWebhook(user, claimed);
  return { confirmed: true, order: claimed, utr: utr || null };
}

async function searchMailbox(client, mailbox, order) {
  const lock = await client.getMailboxLock(mailbox); try {
    const uids = await client.search({ since: new Date(Date.now() - 365 * 86400000), text: String(order.orderId) }, { uid: true }); const out = [];
    for (const uid of uids || []) { const msg = await client.fetchOne(uid, { source: true, internalDate: true }, { uid: true }); if (msg?.source) out.push({ id: `${mailbox}:${uid}`, source: msg.source, internalDate: msg.internalDate || new Date() }); }
    return out;
  } finally { lock.release(); }
}

export async function connectMerchantGmail({ merchant, email, appPassword }) {
  const e = emailOf(email), p = appPassOf(appPassword); await testGmailAppPassword(e, p);
  await GmailConnection.findOneAndUpdate({ merchant: merchant._id }, { merchant: merchant._id, owner: merchant.owner, email: e, authType: 'imap_app_password', appPasswordEncrypted: encryptSecret(p), refreshTokenEncrypted: '', active: true, lastCheckedAt: null, lastMessageId: null }, { upsert: true, new: true });
  merchant.verifiedEmail = e; merchant.verificationStatus = 'pending'; merchant.status = 'pending'; merchant.verificationMessage = 'Gmail connected. Pay ₹1 with the verification Order ID, then click Check Payment.'; await merchant.save();
  return { connected: true, email: e, message: merchant.verificationMessage, verificationOrder: await createVerificationOrder(merchant) };
}

export async function verifyMerchantVerificationPayment({ merchant, connection }) {
  const order = await verificationOrder(merchant);
  if (order.status === 'SUCCESS') { merchant.verificationStatus = 'verified'; merchant.status = 'active'; merchant.verifiedAt = order.paidAt || new Date(); merchant.verificationMessage = 'UPI verified from Gmail using exact Order ID and exact amount.'; await merchant.save(); return { verified: true, order, message: merchant.verificationMessage }; }
  if (!connection?.appPasswordEncrypted) return { verified: false, order, message: 'Gmail App Password is not connected.' };
  const found = await withImap(connection, async client => { for (const mailbox of await listMailboxes(client)) { for (const msg of await searchMailbox(client, mailbox, order)) { const r = await claim({ merchant, order, messageId: msg.id, source: msg.source, receivedAt: msg.internalDate instanceof Date ? msg.internalDate : new Date() }); if (r.confirmed) return r; } } return null; });
  if (found?.confirmed) { const refreshed = await Order.findById(order._id); merchant.verificationStatus = 'verified'; merchant.status = 'active'; merchant.verifiedAt = refreshed?.paidAt || new Date(); merchant.verificationMessage = 'UPI verified from Gmail using exact Order ID and exact amount.'; await merchant.save(); return { verified: true, order: refreshed, message: merchant.verificationMessage }; }
  merchant.verificationStatus = 'pending'; merchant.status = 'pending'; merchant.verificationMessage = `Gmail connected. Pay ₹1 with Purpose/remark ${order.orderId}, then click Check Payment.`; await merchant.save(); return { verified: false, order, message: merchant.verificationMessage };
}

export async function verifyConnection(connection) {
  const merchant = await Merchant.findById(connection.merchant); if (!merchant || merchant.status !== 'active' || merchant.verificationStatus !== 'verified') return { checked: 0, confirmed: 0 };
  const pending = await Order.find({ merchant: merchant._id, owner: merchant.owner, status: 'PENDING', expiresAt: { $gt: new Date() } }).sort({ createdAt: 1 }).limit(500); if (!pending.length) return { checked: 0, confirmed: 0 };
  let checked = 0, confirmed = 0;
  await withImap(connection, async client => { for (const mailbox of await listMailboxes(client)) for (const order of pending) for (const msg of await searchMailbox(client, mailbox, order)) { checked++; const r = await claim({ merchant, order, messageId: msg.id, source: msg.source, receivedAt: msg.internalDate instanceof Date ? msg.internalDate : new Date() }); if (r.confirmed) { confirmed++; break; } } });
  connection.lastCheckedAt = new Date(); await connection.save(); return { checked, confirmed };
}

export async function verifyPendingOrdersForAdmin(ownerId) {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean(); if (settings?.gmailPaymentVerificationEnabled === false) return { checked: 0, confirmed: 0, reason: 'gmail_verification_disabled' };
  const connections = await GmailConnection.find({ owner: ownerId, active: true }).select('+appPasswordEncrypted'); if (!connections.length) return { checked: 0, confirmed: 0, reason: 'gmail_not_connected' };
  const total = { checked: 0, confirmed: 0 }; for (const c of connections) { try { const r = await verifyConnection(c); total.checked += r.checked; total.confirmed += r.confirmed; } catch (e) { console.error(`Gmail IMAP verification failed for ${c.email}:`, e.message); } } return total;
}
export async function verifyAllConnectedGmails() {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean(); if (settings?.gmailPaymentVerificationEnabled === false) return { connections: 0, checked: 0, confirmed: 0, reason: 'gmail_verification_disabled' };
  const connections = await GmailConnection.find({ active: true }).select('+appPasswordEncrypted'); const total = { connections: connections.length, checked: 0, confirmed: 0 }; for (const c of connections) { try { const r = await verifyConnection(c); total.checked += r.checked; total.confirmed += r.confirmed; } catch (e) { console.error(`Gmail IMAP sync failed for ${c.email}:`, e.message); } } return total;
}
