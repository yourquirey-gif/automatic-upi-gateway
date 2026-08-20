import { Router } from 'express';
import GmailConnection from '../models/GmailConnection.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { connectMerchantGmail, createVerificationOrder, testGmailAppPassword, checkStoredGmailConnection, verifyMerchantVerificationPayment, verifyPendingOrdersForAdmin } from '../services/gmailImapPaymentVerifier.js';

const router = Router();
const safeEmail = v => String(v || '').trim().toLowerCase();
const safeReturnUrl = value => { try { const candidate = String(value || '').trim(); if (!candidate) return null; const u = new URL(candidate); const allowed = [process.env.PUBLIC_WEB_BASE_URL, process.env.ADMIN_WEB_BASE_URL].filter(Boolean).map(x => new URL(String(x))); return allowed.some(x => x.origin === u.origin) ? candidate : null; } catch { return null; } };

async function getAdminSettlementContext(adminId) {
  const [admin, settings] = await Promise.all([
    User.findOne({ _id: adminId, role: 'admin' }).select('email name').lean(),
    GatewaySettings.findOne({ key: 'global' }).lean()
  ]);
  if (!admin) throw Object.assign(new Error('Administrator account not found.'), { statusCode: 404 });
  const email = safeEmail(admin.email);
  const upiId = safeEmail(settings?.settlementUpiId);
  if (!email) throw Object.assign(new Error('Administrator email is not configured.'), { statusCode: 400 });
  if (!upiId) throw Object.assign(new Error('First save Admin Settlement UPI ID in Gateway Settings.'), { statusCode: 400 });
  return { admin, settings, email, upiId };
}

async function syncAdminSettlementMerchant(adminId) {
  const ctx = await getAdminSettlementContext(adminId);
  let merchant = await Merchant.findOne({ owner: adminId, provider: 'admin_settlement' });
  if (!merchant) {
    merchant = await Merchant.create({
      owner: adminId,
      name: ctx.settings?.settlementName || 'OmniUPI Settlement',
      provider: 'admin_settlement',
      upiId: ctx.upiId,
      mobile: String(ctx.settings?.settlementMobile || '').replace(/\D/g, '').slice(0, 10),
      config: { adminPaymentProvider: ctx.settings?.settlementProvider || 'UPI / Direct UPI' },
      status: 'pending',
      verificationStatus: 'pending'
    });
  } else {
    const changed = merchant.upiId !== ctx.upiId || merchant.name !== (ctx.settings?.settlementName || merchant.name) || String(merchant.mobile || '') !== String(ctx.settings?.settlementMobile || '').replace(/\D/g, '').slice(0, 10);
    merchant.upiId = ctx.upiId;
    merchant.name = ctx.settings?.settlementName || merchant.name;
    merchant.mobile = String(ctx.settings?.settlementMobile || '').replace(/\D/g, '').slice(0, 10);
    merchant.config = { ...(merchant.config || {}), adminPaymentProvider: ctx.settings?.settlementProvider || 'UPI / Direct UPI' };
    if (changed) await merchant.save();
  }
  return { ...ctx, merchant };
}

router.post('/test', requireAuth, async (req, res, next) => { try { const result = await testGmailAppPassword(req.body.email, req.body.appPassword); res.json({ status: true, ...result, authType: 'imap_app_password' }); } catch (e) { res.status(400).json({ status: false, message: e.message || 'Gmail connection failed' }); } });

router.post('/connect-merchant', requireAuth, async (req, res, next) => { try {
  const merchant = await Merchant.findOne({ _id: req.body.merchantId, owner: req.auth.sub, provider: { $ne: 'admin_settlement' } });
  if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
  if (!merchant.upiId) return res.status(400).json({ status: false, message: 'Add the merchant UPI ID first.' });
  const result = await connectMerchantGmail({ merchant, email: req.body.email, appPassword: req.body.appPassword });
  res.json({ status: true, ...result });
} catch (e) { next(e); } });

router.post('/connect-admin', requireAuth, requireAdmin, async (req, res, next) => { try {
  const ctx = await syncAdminSettlementMerchant(req.auth.sub);
  const suppliedEmail = safeEmail(req.body.email);
  if (suppliedEmail && suppliedEmail !== ctx.email) {
    return res.status(400).json({ status: false, message: `Use the administrator Gmail address: ${ctx.email}` });
  }
  if (!req.body.appPassword) return res.status(400).json({ status: false, message: 'Enter the 16-character App Password for the administrator Gmail.' });
  const result = await connectMerchantGmail({ merchant: ctx.merchant, email: ctx.email, appPassword: req.body.appPassword });
  res.json({ status: true, ...result, merchantId: ctx.merchant._id, adminEmail: ctx.email, settlementUpiId: ctx.upiId });
} catch (e) { next(e); } });

router.post('/check-connection/:merchantId', requireAuth, async (req, res, next) => { try {
  const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub, provider: { $ne: 'admin_settlement' } });
  if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
  const connection = await GmailConnection.findOne({ merchant: merchant._id, owner: req.auth.sub, active: true }).select('+appPasswordEncrypted');
  if (!connection) return res.status(400).json({ status: false, connected: false, message: 'Gmail App Password is not connected.' });
  const result = await checkStoredGmailConnection(connection);
  connection.lastCheckedAt = result.checkedAt; await connection.save();
  res.json({ status: true, ...result, message: 'Gmail is connected and accessible.' });
} catch (e) { res.status(400).json({ status: false, connected: false, message: e.message || 'Gmail connection check failed' }); } });

router.post('/check-connection-admin', requireAuth, requireAdmin, async (req, res, next) => { try {
  const ctx = await syncAdminSettlementMerchant(req.auth.sub);
  const connection = await GmailConnection.findOne({ merchant: ctx.merchant._id, owner: req.auth.sub, active: true }).select('+appPasswordEncrypted');
  if (!connection) return res.status(400).json({ status: false, connected: false, message: `Admin Gmail App Password is not connected for ${ctx.email}.` });
  if (safeEmail(connection.email) !== ctx.email) return res.status(409).json({ status: false, connected: false, message: 'Stored Gmail connection does not match the administrator account. Reconnect the Admin Gmail.' });
  const result = await checkStoredGmailConnection(connection);
  connection.lastCheckedAt = result.checkedAt; await connection.save();
  res.json({ status: true, ...result, message: 'Admin Gmail is connected and accessible.', adminEmail: ctx.email, settlementUpiId: ctx.upiId });
} catch (e) { res.status(400).json({ status: false, connected: false, message: e.message || 'Admin Gmail connection check failed' }); } });

router.post('/check/:merchantId', requireAuth, async (req, res, next) => { try {
  const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub, provider: { $ne: 'admin_settlement' } }); if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
  const connection = await GmailConnection.findOne({ merchant: merchant._id, owner: req.auth.sub, active: true }).select('+appPasswordEncrypted'); if (!connection) return res.status(400).json({ status: false, message: 'Gmail App Password is not connected.' });
  const result = await verifyMerchantVerificationPayment({ merchant, connection }); res.json({ status: true, ...result });
} catch (e) { next(e); } });

router.post('/check-admin', requireAuth, requireAdmin, async (req, res, next) => { try {
  const ctx = await syncAdminSettlementMerchant(req.auth.sub);
  const connection = await GmailConnection.findOne({ merchant: ctx.merchant._id, owner: req.auth.sub, active: true }).select('+appPasswordEncrypted');
  if (!connection) return res.status(400).json({ status: false, verified: false, message: `Admin Gmail App Password is not connected for ${ctx.email}.` });
  if (safeEmail(connection.email) !== ctx.email) return res.status(409).json({ status: false, verified: false, message: 'Stored Gmail connection does not match the administrator account. Reconnect the Admin Gmail.' });
  const result = await verifyMerchantVerificationPayment({ merchant: ctx.merchant, connection }); res.json({ status: true, ...result, adminEmail: ctx.email, settlementUpiId: ctx.upiId });
} catch (e) { next(e); } });

router.get('/status/:merchantId', requireAuth, async (req, res, next) => { try {
  const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub, provider: { $ne: 'admin_settlement' } }).lean(); if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
  const connection = await GmailConnection.findOne({ merchant: merchant._id, owner: req.auth.sub, active: true }).lean();
  const order = merchant.config?.verificationOrderId ? await Order.findOne({ merchant: merchant._id, owner: req.auth.sub, orderId: merchant.config.verificationOrderId }).select('orderId amount status paymentUrl expiresAt paidAt utr').lean() : null;
  res.json({ status: true, merchant: { id: merchant._id, upiId: merchant.upiId, status: merchant.status, verificationStatus: merchant.verificationStatus, message: merchant.verificationMessage, verifiedEmail: merchant.verifiedEmail || null }, gmail: connection ? { connected: true, email: connection.email, authType: connection.authType, lastCheckedAt: connection.lastCheckedAt } : { connected: false }, verificationOrder: order });
} catch (e) { next(e); } });

router.post('/disconnect/:merchantId', requireAuth, async (req, res, next) => { try { const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub, provider: { $ne: 'admin_settlement' } }); if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' }); await GmailConnection.deleteOne({ merchant: merchant._id }); merchant.verificationStatus = 'pending'; merchant.status = 'pending'; merchant.verifiedEmail = null; merchant.verificationMessage = 'Gmail disconnected. Connect again with a Gmail App Password.'; await merchant.save(); res.json({ status: true, message: 'Gmail App Password connection removed.' }); } catch (e) { next(e); } });

router.post('/sync', requireAuth, requireAdmin, async (req, res, next) => { try { res.json({ status: true, result: await verifyPendingOrdersForAdmin(req.auth.sub) }); } catch (e) { next(e); } });

router.get('/status', requireAuth, requireAdmin, async (req, res, next) => { try {
  const ctx = await syncAdminSettlementMerchant(req.auth.sub);
  const connection = await GmailConnection.findOne({ merchant: ctx.merchant._id, owner: req.auth.sub, active: true }).lean();
  const order = ctx.merchant.config?.verificationOrderId ? await Order.findOne({ merchant: ctx.merchant._id, owner: req.auth.sub, orderId: ctx.merchant.config.verificationOrderId }).select('orderId amount status paymentUrl expiresAt paidAt utr').lean() : null;
  res.json({ status: true, connected: !!connection && safeEmail(connection.email) === ctx.email, email: ctx.email, adminEmail: ctx.email, settlementUpiId: ctx.upiId, settlementName: ctx.settings?.settlementName || '', authType: connection?.authType || null, lastCheckedAt: connection?.lastCheckedAt || null, upiVerification: { upiId: ctx.upiId, status: ctx.merchant.verificationStatus, merchantStatus: ctx.merchant.status, verifiedEmail: ctx.merchant.verifiedEmail || null, verifiedAt: ctx.merchant.verifiedAt || null, message: ctx.merchant.verificationMessage || '', verificationOrder: order } });
} catch (e) { next(e); } });

router.post('/admin-upi/reset', requireAuth, requireAdmin, async (req, res, next) => { try { const merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement' }); if (merchant) { await GmailConnection.deleteOne({ merchant: merchant._id }); await merchant.deleteOne(); } await GatewaySettings.findOneAndUpdate({ key: 'global' }, { $set: { settlementUpiId: '', settlementName: '', settlementProvider: 'UPI / Direct UPI', settlementMobile: '' } }, { upsert: true }); res.json({ status: true, message: 'Admin payment UPI and Gmail App Password connection removed.' }); } catch (e) { next(e); } });

export default router;
