import { Router } from 'express';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import SubscriptionOrder from '../models/SubscriptionOrder.js';
import Plan from '../models/Plan.js';
import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import { requireAuth } from '../middleware/auth.js';
import { requireKycIfEnabled } from '../middleware/kyc.js';
import { verifySubscriptionOrderForAdmin } from '../services/subscriptionPaymentVerifier.js';

const router = Router();

router.get('/plans', async (_req, res, next) => {
  try { res.json({ status: true, plans: await Plan.find({ active: true }).sort({ price: 1 }) }); }
  catch (error) { next(error); }
});

router.get('/verification', requireAuth, async (req, res, next) => {
  try {
    if (req.auth?.role === 'admin') {
      const adminMerchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement', verificationStatus: 'verified', status: 'active', upiId: { $exists: true, $nin: ['', null] } }).sort({ verifiedAt: -1 }).lean();
      return res.json({ status: true, verified: !!adminMerchant, role: 'admin', merchant: adminMerchant ? { id: adminMerchant._id, name: adminMerchant.name, upiId: adminMerchant.upiId, provider: adminMerchant.provider, verifiedEmail: adminMerchant.verifiedEmail, verifiedAt: adminMerchant.verifiedAt } : null, message: adminMerchant ? 'Administrator payment UPI is verified and can receive subscription payments.' : 'Verify the administrator payment UPI before accepting subscription payments.' });
    }
    const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
    const adminIds = await User.find({ role: 'admin', status: 'active' }).distinct('_id');
    const verifiedAdminMerchant = await Merchant.findOne({ owner: { $in: adminIds }, provider: 'admin_settlement', verificationStatus: 'verified', status: 'active', upiId: { $exists: true, $nin: ['', null] } }).sort({ verifiedAt: -1 }).lean();
    const upiId = verifiedAdminMerchant?.upiId || settings?.subscriptionUpiId || '';
    if (!upiId) return res.json({ status: true, verified: false, merchant: null, message: 'Administrator payment UPI is not configured or verified yet.' });
    return res.json({ status: true, verified: !!verifiedAdminMerchant, merchant: { id: verifiedAdminMerchant?._id || null, name: verifiedAdminMerchant?.name || settings?.subscriptionUpiName || 'OmniUPI', upiId, provider: verifiedAdminMerchant?.provider || 'admin_settlement', verifiedEmail: verifiedAdminMerchant?.verifiedEmail || null, verifiedAt: verifiedAdminMerchant?.verifiedAt || null }, message: verifiedAdminMerchant ? 'Administrator payment UPI is verified.' : 'Subscription UPI exists but administrator verification is still required.' });
  } catch (error) { next(error); }
});

function buildDynamicUpiUrl({ upiId, payeeName, amount, orderId, planName }) {
  const params = new URLSearchParams({ pa: String(upiId).trim(), pn: String(payeeName || 'OmniUPI').trim(), am: Number(amount).toFixed(2), cu: 'INR', tr: orderId, tn: `OmniUPI ${planName} ${orderId}` });
  return `upi://pay?${params.toString()}`;
}

router.post('/purchase', requireAuth, requireKycIfEnabled, async (req, res, next) => {
  try {
    if (req.auth?.role === 'admin') return res.status(403).json({ status: false, message: 'Administrators have permanent free access and do not need a subscription.' });
    const adminIds = await User.find({ role: 'admin', status: 'active' }).distinct('_id');
    const adminMerchant = await Merchant.findOne({ owner: { $in: adminIds }, provider: 'admin_settlement', verificationStatus: 'verified', status: 'active', upiId: { $exists: true, $nin: ['', null] } }).sort({ verifiedAt: -1 }).lean();
    if (!adminMerchant) return res.status(503).json({ status: false, code: 'ADMIN_PAYMENT_UPI_NOT_VERIFIED', message: 'Subscription payment is temporarily unavailable. Administrator must first verify the payment UPI with Google/Gmail.' });
    const plan = await Plan.findOne({ _id: req.body.planId, active: true });
    if (!plan) return res.status(404).json({ status: false, message: 'Plan not found or inactive' });
    const settings = await GatewaySettings.findOne({ key: 'global' });
    const upiId = adminMerchant.upiId, upiName = adminMerchant.name || settings?.subscriptionUpiName || 'OmniUPI';
    const orderId = `AGP${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`, amount = Number(plan.price);
    const paymentUrl = buildDynamicUpiUrl({ upiId, payeeName: upiName, amount, orderId, planName: plan.name });
    const qrDataUrl = await QRCode.toDataURL(paymentUrl, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
    const order = await SubscriptionOrder.create({ user: req.auth.sub, plan: plan._id, orderId, amount, paymentUrl });
    res.status(201).json({ status: true, order: { id: order._id, orderId, amount: order.amount, paymentUrl, qrDataUrl, upiId, upiName, plan: plan.name, durationDays: plan.durationDays, status: order.status } });
  } catch (error) { next(error); }
});

router.get('/checkout/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await SubscriptionOrder.findOne({ orderId: req.params.orderId, user: req.auth.sub }).populate('plan');
    if (!order) return res.status(404).json({ status: false, message: 'Subscription order not found' });
    const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
    const adminIds = await User.find({ role: 'admin', status: 'active' }).distinct('_id');
    const adminMerchant = await Merchant.findOne({ owner: { $in: adminIds }, provider: 'admin_settlement', verificationStatus: 'verified', status: 'active', upiId: order.paymentUrl ? { $exists: true } : { $exists: true } }).sort({ verifiedAt: -1 }).lean();
    const upiId = adminMerchant?.upiId || settings?.subscriptionUpiId;
    if (!upiId) return res.status(503).json({ status: false, message: 'Administrator payment UPI is not available.' });
    const upiName = adminMerchant?.name || settings?.subscriptionUpiName || 'OmniUPI';
    const qrDataUrl = await QRCode.toDataURL(order.paymentUrl, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
    res.json({ status: true, order: { orderId: order.orderId, amount: order.amount, plan: order.plan?.name || '', paymentUrl: order.paymentUrl, qrDataUrl, upiId, upiName, status: order.status } });
  } catch (error) { next(error); }
});

router.get('/order/:orderId', requireAuth, async (req, res, next) => {
  try {
    let order = await SubscriptionOrder.findOne({ orderId: req.params.orderId, user: req.auth.sub }).populate('plan');
    if (!order) return res.status(404).json({ status: false, message: 'Subscription order not found' });
    if (order.status === 'PENDING') { await verifySubscriptionOrderForAdmin(order.orderId); order = await SubscriptionOrder.findOne({ orderId: req.params.orderId, user: req.auth.sub }).populate('plan'); }
    const user = await User.findById(req.auth.sub).populate('plan');
    res.json({ status: true, order: { orderId: order.orderId, amount: order.amount, plan: order.plan?.name || '', status: order.status, paidAt: order.paidAt || null, expiresAt: order.planExpiresAt || user?.planExpiresAt || null, utr: order.utr || null } });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (req.auth?.role === 'admin') return res.json({ status: true, role: 'admin', isAdmin: true, plan: null, active: true, expired: false, permanent: true, startedAt: null, expiresAt: null });
    const user = await User.findById(req.auth.sub).populate('plan'); const now = new Date();
    if (user?.plan && user.planExpiresAt && user.planExpiresAt <= now) { await SubscriptionOrder.updateMany({ user: user._id, status: 'SUCCESS', plan: user.plan._id, planExpiresAt: { $lte: now } }, { $set: { status: 'EXPIRED' } }); user.plan = null; user.planStatus = 'EXPIRED'; await user.save(); }
    const refreshed = await User.findById(req.auth.sub).populate('plan');
    res.json({ status: true, role: 'merchant', isAdmin: false, plan: refreshed?.plan || null, active: !!refreshed?.plan && refreshed.planStatus === 'ACTIVE' && refreshed.planExpiresAt > now, expired: refreshed?.planStatus === 'EXPIRED', permanent: false, startedAt: refreshed?.planStartedAt || null, expiresAt: refreshed?.planExpiresAt || null });
  } catch (error) { next(error); }
});

export default router;
