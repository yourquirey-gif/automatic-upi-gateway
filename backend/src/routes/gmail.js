import { Router } from 'express';
import GmailConnection from '../models/GmailConnection.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { connectMerchantGmail, createVerificationOrder, testGmailAppPassword, verifyMerchantVerificationPayment, verifyPendingOrdersForAdmin } from '../services/gmailImapPaymentVerifier.js';

const router = Router();
const safeEmail = v => String(v || '').trim().toLowerCase();
const safeReturnUrl = value => { try { const candidate = String(value || '').trim(); if (!candidate) return null; const u = new URL(candidate); const allowed = [process.env.PUBLIC_WEB_BASE_URL, process.env.ADMIN_WEB_BASE_URL].filter(Boolean).map(x => new URL(String(x))); return allowed.some(x => x.origin === u.origin) ? candidate : null; } catch { return null; } };

router.post('/test', requireAuth, async (req, res, next) => { try { const result = await testGmailAppPassword(req.body.email, req.body.appPassword); res.json({ status: true, ...result, authType: 'imap_app_password' }); } catch (e) { res.status(400).json({ status: false, message: e.message || 'Gmail connection failed' }); } });

router.post('/connect-merchant', requireAuth, async (req, res, next) => { try {
  const merchant = await Merchant.findOne({ _id: req.body.merchantId, owner: req.auth.sub, provider: { $ne: 'admin_settlement' } });
  if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
  if (!merchant.upiId) return res.status(400).json({ status: false, message: 'Add the merchant UPI ID first.' });
  const result = await connectMerchantGmail({ merchant, email: req.body.email, appPassword: req.body.appPassword });
  res.json({ status: true, ...result });
} catch (e) { next(e); } });

router.post('/connect-admin', requireAuth, requireAdmin, async (req, res, next) => { try {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean(); const upiId = String(settings?.settlementUpiId || '').trim().toLowerCase();
  if (!upiId) return res.status(400).json({ status: false, message: 'First save Admin Payment UPI ID.' });
  let merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement' });
  if (!merchant) merchant = await Merchant.create({ owner: req.auth.sub, name: settings?.settlementName || 'OmniUPI Settlement', provider: 'admin_settlement', upiId, mobile: String(settings?.settlementMobile || '').replace(/\D/g, '').slice(0, 10), config: { adminPaymentProvider: settings?.settlementProvider || 'UPI / Direct UPI' }, status: 'pending', verificationStatus: 'pending' });
  else { merchant.upiId = upiId; merchant.name = settings?.settlementName || merchant.name; await merchant.save(); }
  const result = await connectMerchantGmail({ merchant, email: req.body.email, appPassword: req.body.appPassword });
  res.json({ status: true, ...result, merchantId: merchant._id });
} catch (e) { next(e); } });

router.post('/check/:merchantId', requireAuth, async (req, res, next) => { try {
  const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub }); if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
  const connection = await GmailConnection.findOne({ merchant: merchant._id, owner: req.auth.sub, active: true }).select('+appPasswordEncrypted'); if (!connection) return res.status(400).json({ status: false, message: 'Gmail App Password is not connected.' });
  const result = await verifyMerchantVerificationPayment({ merchant, connection }); res.json({ status: true, ...result });
} catch (e) { next(e); } });

router.get('/status/:merchantId', requireAuth, async (req, res, next) => { try {
  const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub }).lean(); if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
  const connection = await GmailConnection.findOne({ merchant: merchant._id, owner: req.auth.sub, active: true }).lean();
  const order = merchant.config?.verificationOrderId ? await Order.findOne({ merchant: merchant._id, owner: req.auth.sub, orderId: merchant.config.verificationOrderId }).select('orderId amount status paymentUrl expiresAt paidAt utr').lean() : null;
  res.json({ status: true, merchant: { id: merchant._id, upiId: merchant.upiId, status: merchant.status, verificationStatus: merchant.verificationStatus, message: merchant.verificationMessage, verifiedEmail: merchant.verifiedEmail || null }, gmail: connection ? { connected: true, email: connection.email, authType: connection.authType, lastCheckedAt: connection.lastCheckedAt } : { connected: false }, verificationOrder: order });
} catch (e) { next(e); } });

router.post('/disconnect/:merchantId', requireAuth, async (req, res, next) => { try { const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub }); if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' }); await GmailConnection.deleteOne({ merchant: merchant._id }); merchant.verificationStatus = 'pending'; merchant.status = 'pending'; merchant.verifiedEmail = null; merchant.verificationMessage = 'Gmail disconnected. Connect again with a Gmail App Password.'; await merchant.save(); res.json({ status: true, message: 'Gmail App Password connection removed.' }); } catch (e) { next(e); } });

router.post('/sync', requireAuth, requireAdmin, async (req, res, next) => { try { res.json({ status: true, result: await verifyPendingOrdersForAdmin(req.auth.sub) }); } catch (e) { next(e); } });

router.get('/status', requireAuth, requireAdmin, async (req, res, next) => { try {
  const connection = await GmailConnection.findOne({ owner: req.auth.sub, active: true }).lean(); const merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement' }).lean();
  const order = merchant?.config?.verificationOrderId ? await Order.findOne({ merchant: merchant._id, owner: req.auth.sub, orderId: merchant.config.verificationOrderId }).select('orderId amount status paymentUrl expiresAt paidAt utr').lean() : null;
  res.json({ status: true, connected: !!connection, email: connection?.email || null, authType: connection?.authType || null, lastCheckedAt: connection?.lastCheckedAt || null, upiVerification: merchant ? { upiId: merchant.upiId, status: merchant.verificationStatus, merchantStatus: merchant.status, verifiedEmail: merchant.verifiedEmail || null, verifiedAt: merchant.verifiedAt || null, message: merchant.verificationMessage || '', verificationOrder: order } : null });
} catch (e) { next(e); } });

router.post('/admin-upi/reset', requireAuth, requireAdmin, async (req, res, next) => { try { const merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement' }); if (merchant) { await GmailConnection.deleteOne({ merchant: merchant._id }); await merchant.deleteOne(); } await GatewaySettings.findOneAndUpdate({ key: 'global' }, { $set: { settlementUpiId: '', settlementName: '', settlementProvider: 'UPI / Direct UPI', settlementMobile: '' } }, { upsert: true }); res.json({ status: true, message: 'Admin payment UPI and Gmail App Password connection removed.' }); } catch (e) { next(e); } });

export default router;
