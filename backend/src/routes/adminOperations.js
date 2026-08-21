import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import Plan from '../models/Plan.js';
import SupportTicket from '../models/SupportTicket.js';
import GmailConnection from '../models/GmailConnection.js';
import GatewaySettings from '../models/GatewaySettings.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import AdminNotification from '../models/AdminNotification.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const safeSettings = s => {
  const o = s?.toObject ? s.toObject() : { ...(s || {}) };
  delete o.googleClientSecretEncrypted;
  delete o.settlementUpiId;
  o.googleClientSecretConfigured = !!s?.googleClientSecretEncrypted;
  return o;
};

async function audit(req, action, targetType = '', targetId = '', details = {}) {
  try {
    await AdminAuditLog.create({
      admin: req.user?._id || null,
      action, targetType, targetId,
      details,
      ip: req.ip || '',
      userAgent: String(req.get('user-agent') || '').slice(0, 500)
    });
  } catch (e) { console.error('Admin audit log failed:', e.message); }
}

router.get('/overview', async (_req, res, next) => {
  try {
    const [users, merchants, activeMerchants, orders, success, pending, failed, tickets, gmail, admins, plans] = await Promise.all([
      User.countDocuments({ role: 'merchant' }),
      Merchant.countDocuments(), Merchant.countDocuments({ status: 'active' }),
      Order.countDocuments(), Order.countDocuments({ status: 'SUCCESS' }),
      Order.countDocuments({ status: 'PENDING' }), Order.countDocuments({ status: 'FAILED' }),
      SupportTicket.countDocuments({ status: { $nin: ['closed', 'resolved'] } }),
      GmailConnection.countDocuments(), User.countDocuments({ role: 'admin' }), Plan.countDocuments({ active: true })
    ]);
    const [revenue] = await Order.aggregate([{ $match: { status: 'SUCCESS' } }, { $group: { _id: null, amount: { $sum: '$amount' }, fees: { $sum: '$feeAmount' } } }]);
    const successRate = orders ? Number((success / orders * 100).toFixed(2)) : 0;
    res.json({ status: true, overview: { users, merchants, activeMerchants, orders, success, pending, failed, openTickets: tickets, gmailConnections: gmail, admins, activePlans: plans, totalVolume: revenue?.amount || 0, revenue: revenue?.fees || 0, successRate } });
  } catch (e) { next(e); }
});

router.get('/health', async (_req, res, next) => {
  try {
    const [settings, gmail, pending] = await Promise.all([
      GatewaySettings.findOne({ key: 'global' }).lean(),
      GmailConnection.countDocuments(),
      Order.countDocuments({ status: 'PENDING', createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } })
    ]);
    const dbReady = mongoose.connection.readyState === 1;
    res.json({ status: true, health: {
      database: dbReady ? 'operational' : 'down',
      api: 'operational',
      gmail: settings?.gmailPaymentVerificationEnabled === false ? 'disabled' : (gmail ? 'connected' : 'attention'),
      paymentVerification: settings?.paymentVerificationMode || 'gmail',
      webhook: 'operational',
      pendingAttention: pending,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      checkedAt: new Date().toISOString()
    } });
  } catch (e) { next(e); }
});

router.get('/failures', async (_req, res, next) => {
  try {
    const orders = await Order.find({ $or: [
      { status: 'FAILED' },
      { status: 'PENDING', createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) } }
    ] }).populate('owner', 'name email userId').populate('merchant', 'name upiId').sort({ updatedAt: -1 }).limit(100).lean();
    res.json({ status: true, failures: orders.map(o => ({ id: o._id, orderId: o.orderId, status: o.status, amount: o.amount, merchant: o.merchant?.name || '', owner: o.owner?.email || o.owner?.userId || '', reason: o.verificationMessageId || o.verificationSource || (o.status === 'PENDING' ? 'Verification timeout / pending' : 'Payment failed'), createdAt: o.createdAt, updatedAt: o.updatedAt })) });
  } catch (e) { next(e); }
});

router.get('/audit', async (_req, res, next) => {
  try { res.json({ status: true, logs: await AdminAuditLog.find().populate('admin', 'name email').sort({ createdAt: -1 }).limit(150).lean() }); }
  catch (e) { next(e); }
});

router.get('/notifications', async (_req, res, next) => {
  try {
    await AdminNotification.updateMany({ active: true, expiresAt: { $ne: null, $lte: new Date() } }, { $set: { active: false } });
    res.json({ status: true, notifications: await AdminNotification.find().populate('createdBy', 'name email').sort({ createdAt: -1 }).limit(100).lean() });
  } catch (e) { next(e); }
});

router.post('/notifications', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    if (!title || !message) return res.status(400).json({ status: false, message: 'Title and message are required' });
    const type = ['info', 'success', 'warning', 'critical'].includes(req.body.type) ? req.body.type : 'info';
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return res.status(400).json({ status: false, message: 'Invalid expiry date' });
    const notification = await AdminNotification.create({ title, message, type, expiresAt, createdBy: req.user?._id || null });
    await audit(req, 'notification.created', 'notification', String(notification._id), { type });
    res.status(201).json({ status: true, notification });
  } catch (e) { next(e); }
});

router.patch('/notifications/:id', async (req, res, next) => {
  try {
    const patch = {};
    if ('active' in req.body) patch.active = Boolean(req.body.active);
    if ('title' in req.body) patch.title = String(req.body.title || '').trim();
    if ('message' in req.body) patch.message = String(req.body.message || '').trim();
    const n = await AdminNotification.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!n) return res.status(404).json({ status: false, message: 'Notification not found' });
    await audit(req, 'notification.updated', 'notification', String(n._id), patch);
    res.json({ status: true, notification: n });
  } catch (e) { next(e); }
});

router.get('/settings', async (_req, res, next) => {
  try { const settings = await GatewaySettings.findOne({ key: 'global' }); res.json({ status: true, settings: safeSettings(settings) }); }
  catch (e) { next(e); }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const allowed = ['gatewayName','supportContact','maintenanceMode','publicApiBaseUrl','webhookBaseUrl','paymentExpiryMinutes','minimumPaymentAmount','maximumPaymentAmount','defaultTransactionFeePercent','gmailPaymentVerificationEnabled','gmailAutoSync','paymentVerificationMode','feeSettlementMode'];
    const patch = Object.fromEntries(allowed.filter(k => k in req.body).map(k => [k, req.body[k]]));
    if ('paymentExpiryMinutes' in patch && (Number(patch.paymentExpiryMinutes) < 1 || Number(patch.paymentExpiryMinutes) > 1440)) return res.status(400).json({ status: false, message: 'Payment expiry must be 1-1440 minutes' });
    const settings = await GatewaySettings.findOneAndUpdate({ key: 'global' }, patch, { new: true, upsert: true, runValidators: true });
    await audit(req, 'gateway.settings.updated', 'settings', 'global', patch);
    res.json({ status: true, settings: safeSettings(settings) });
  } catch (e) { next(e); }
});

router.post('/merchants/:id/force-reverify', async (req, res, next) => {
  try {
    const merchant = await Merchant.findByIdAndUpdate(req.params.id, { verificationStatus: 'verifying', status: 'pending' }, { new: true });
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    await audit(req, 'merchant.force-reverify', 'merchant', String(merchant._id));
    res.json({ status: true, merchant });
  } catch (e) { next(e); }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const from = new Date(Date.now() - days * 86400000);
    const series = await Order.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, orders: { $sum: 1 }, volume: { $sum: '$amount' }, success: { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } }, fees: { $sum: '$feeAmount' } } }, { $sort: { _id: 1 } }]);
    res.json({ status: true, days, series });
  } catch (e) { next(e); }
});

router.get('/api-usage', async (_req, res, next) => {
  try {
    const users = await User.find({ role: 'merchant' }).select('name email userId apiToken updatedAt').lean();
    const usage = users.map(u => ({ userId: u.userId, name: u.name, email: u.email, credentialed: !!u.apiToken, lastUpdated: u.updatedAt }));
    res.json({ status: true, usage });
  } catch (e) { next(e); }
});

export default router;
