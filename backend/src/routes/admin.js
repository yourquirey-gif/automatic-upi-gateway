import { Router } from 'express';
import bcrypt from 'bcryptjs';
import Plan from '../models/Plan.js';
import GatewaySettings from '../models/GatewaySettings.js';
import KycOrder from '../models/KycOrder.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Merchant from '../models/Merchant.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { decryptSecret } from '../utils/secretBox.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', async (_req, res, next) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [totalUsers, todayUsers, activeUsers, totalOrders, todayOrders, successfulOrders, pendingOrders, revenue, totalMerchants, pendingKyc, adminCount] = await Promise.all([
      User.countDocuments({ role: 'merchant' }),
      User.countDocuments({ role: 'merchant', createdAt: { $gte: start } }),
      User.countDocuments({ role: 'merchant', status: 'active' }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: start } }),
      Order.countDocuments({ status: 'SUCCESS' }),
      Order.countDocuments({ status: 'PENDING' }),
      Order.aggregate([{ $match: { status: 'SUCCESS' } }, { $group: { _id: null, total: { $sum: '$amount' }, net: { $sum: '$netAmount' }, fees: { $sum: '$feeAmount' } } }]),
      Merchant.countDocuments({ status: 'active' }),
      KycOrder.countDocuments({ status: 'SUBMITTED' }),
      User.countDocuments({ role: 'admin' })
    ]);
    res.json({ status: true, stats: { totalUsers, todayUsers, activeUsers, totalOrders, todayOrders, successfulOrders, pendingOrders, totalMerchants, pendingKyc, adminCount, revenue: revenue[0] || { total: 0, net: 0, fees: 0 } } });
  } catch (error) { next(error); }
});

router.get('/users', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const q = String(req.query.search || '').trim();
    const filter = { role: 'merchant' };
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }, { userId: new RegExp(q, 'i') }];
    const users = await User.find(filter).select('name email userId mobile companyName status plan trialEndsAt planStartedAt planExpiresAt planStatus kycStatus createdAt updatedAt').populate('plan', 'name price durationDays transactionFeePercent').sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ status: true, users });
  } catch (error) { next(error); }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const allowed = ['status', 'kycStatus', 'planStatus', 'planExpiresAt'];
    const patch = Object.fromEntries(allowed.filter(k => k in req.body).map(k => [k, req.body[k]]));
    if (patch.status && !['active', 'suspended'].includes(patch.status)) return res.status(400).json({ status: false, message: 'Invalid user status' });
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'merchant' }, patch, { new: true }).select('name email userId status kycStatus planStatus planExpiresAt');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    res.json({ status: true, user });
  } catch (error) { next(error); }
});

router.get('/orders', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const q = String(req.query.search || '').trim();
    const filter = {};
    if (req.query.status && ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'].includes(req.query.status)) filter.status = req.query.status;
    if (q) filter.$or = [{ orderId: new RegExp(q, 'i') }, { customerMobile: new RegExp(q, 'i') }, { utr: new RegExp(q, 'i') }];
    const orders = await Order.find(filter).populate('owner', 'name email userId').populate('merchant', 'name upiId status').sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ status: true, orders });
  } catch (error) { next(error); }
});

router.get('/admins', async (_req, res, next) => {
  try { res.json({ status: true, admins: await User.find({ role: 'admin' }).select('name email status createdAt updatedAt').sort({ createdAt: 1 }).lean() }); }
  catch (error) { next(error); }
});

router.post('/admins', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ status: false, message: 'Name, valid email and password of at least 8 characters are required' });
    if (await User.findOne({ email })) return res.status(409).json({ status: false, message: 'Email is already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await User.create({ name, email, passwordHash, role: 'admin', status: 'active', trialStartedAt: null, trialEndsAt: null, plan: null, planStatus: 'NONE' });
    res.status(201).json({ status: true, message: 'Admin created successfully. The entered email and password can be used immediately.', admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, status: admin.status } });
  } catch (error) { next(error); }
});

router.patch('/admins/:id', async (req, res, next) => {
  try {
    const target = await User.findOne({ _id: req.params.id, role: 'admin' }).select('+passwordHash');
    if (!target) return res.status(404).json({ status: false, message: 'Admin not found' });
    if ('status' in req.body) {
      if (!['active', 'suspended'].includes(req.body.status)) return res.status(400).json({ status: false, message: 'Invalid admin status' });
      target.status = req.body.status;
    }
    if (req.body.password) {
      if (String(req.body.password).length < 8) return res.status(400).json({ status: false, message: 'Password must be at least 8 characters' });
      target.passwordHash = await bcrypt.hash(String(req.body.password), 12);
    }
    if (req.body.name) target.name = String(req.body.name).trim();
    await target.save();
    res.json({ status: true, message: 'Admin updated successfully', admin: { id: target._id, name: target.name, email: target.email, role: target.role, status: target.status } });
  } catch (error) { next(error); }
});

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await GatewaySettings.findOneAndUpdate({ key: 'global' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ status: true, settings });
  } catch (error) { next(error); }
});

router.put('/settings', async (req, res, next) => {
  try {
    const allowed = ['settlementUpiId', 'settlementName', 'subscriptionUpiId', 'subscriptionUpiName', 'subscriptionPaymentLink', 'defaultTransactionFeePercent', 'gmailPaymentVerificationEnabled', 'gmailSearchQuery', 'paymentVerificationMode', 'feeSettlementMode'];
    const patch = Object.fromEntries(allowed.filter((key) => key in req.body).map((key) => [key, req.body[key]]));
    const settings = await GatewaySettings.findOneAndUpdate({ key: 'global' }, patch, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ status: true, settings });
  } catch (error) { next(error); }
});

router.get('/plans', async (_req, res, next) => {
  try { res.json({ status: true, plans: await Plan.find().sort({ price: 1 }) }); } catch (error) { next(error); }
});
router.post('/plans', async (req, res, next) => {
  try {
    const { name, price, durationDays, transactionLimit, merchantLimit, apiAccess, transactionFeePercent, features, active, popular } = req.body;
    if (!name || Number(price) < 0 || Number(durationDays) < 1) return res.status(400).json({ status: false, message: 'name, price and durationDays are required' });
    const plan = await Plan.create({ name, price, durationDays, transactionLimit, merchantLimit, apiAccess, transactionFeePercent, features, active, popular });
    res.status(201).json({ status: true, plan });
  } catch (error) { next(error); }
});
router.put('/plans/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'price', 'durationDays', 'transactionLimit', 'merchantLimit', 'apiAccess', 'transactionFeePercent', 'features', 'active', 'popular'];
    const patch = Object.fromEntries(allowed.filter((key) => key in req.body).map((key) => [key, req.body[key]]));
    const plan = await Plan.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ status: false, message: 'Plan not found' });
    res.json({ status: true, plan });
  } catch (error) { next(error); }
});
router.delete('/plans/:id', async (req, res, next) => { try { await Plan.findByIdAndDelete(req.params.id); res.json({ status: true }); } catch (error) { next(error); } });

router.get('/kyc', async (_req, res, next) => {
  try {
    const requests = await KycOrder.find({ status: 'SUBMITTED' }).sort({ submittedAt: 1 }).populate('user', 'userId name email mobile companyName kycStatus').select('+aadhaarNumberEncrypted +aadhaarNameEncrypted +aadhaarFrontEncrypted +aadhaarBackEncrypted +panNumberEncrypted +panNameEncrypted +panFrontEncrypted +panBackEncrypted');
    const result = requests.map(r => ({ id: r._id, orderId: r.orderId, amount: r.amount, status: r.status, submittedAt: r.submittedAt, paidAt: r.paidAt, user: r.user, aadhaar: { number: decryptSecret(r.aadhaarNumberEncrypted), name: decryptSecret(r.aadhaarNameEncrypted), front: decryptSecret(r.aadhaarFrontEncrypted), back: decryptSecret(r.aadhaarBackEncrypted) }, pan: { number: decryptSecret(r.panNumberEncrypted), name: decryptSecret(r.panNameEncrypted), front: decryptSecret(r.panFrontEncrypted), back: decryptSecret(r.panBackEncrypted) } }));
    res.json({ status: true, requests: result });
  } catch (error) { next(error); }
});
router.post('/kyc/:id/verify', async (req, res, next) => { try { const request = await KycOrder.findById(req.params.id); if (!request) return res.status(404).json({ status: false, message: 'KYC request not found' }); request.status = 'VERIFIED'; request.verifiedAt = new Date(); request.rejectionReason = ''; await request.save(); await User.findByIdAndUpdate(request.user, { kycStatus: 'VERIFIED', kycVerifiedAt: request.verifiedAt }); res.json({ status: true, message: 'KYC verified successfully', verifiedAt: request.verifiedAt }); } catch (error) { next(error); } });
router.post('/kyc/:id/reject', async (req, res, next) => { try { const request = await KycOrder.findById(req.params.id); if (!request) return res.status(404).json({ status: false, message: 'KYC request not found' }); request.status = 'REJECTED'; request.rejectedAt = new Date(); request.rejectionReason = String(req.body.reason || 'Documents could not be verified').slice(0, 500); await request.save(); await User.findByIdAndUpdate(request.user, { kycStatus: 'REJECTED' }); res.json({ status: true, message: 'KYC rejected' }); } catch (error) { next(error); } });

export default router;
