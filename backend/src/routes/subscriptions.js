import { Router } from 'express';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import SubscriptionOrder from '../models/SubscriptionOrder.js';
import Plan from '../models/Plan.js';
import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import GmailConnection from '../models/GmailConnection.js';
import { requireAuth } from '../middleware/auth.js';
import { requireKycIfEnabled } from '../middleware/kyc.js';
import { verifySubscriptionOrderForAdmin } from '../services/subscriptionPaymentVerifier.js';

const router = Router();
router.get('/plans', async (_req, res, next) => { try { res.json({ status: true, plans: await Plan.find({ active: true }).sort({ price: 1 }) }); } catch (error) { next(error); } });

router.get('/verification', requireAuth, async (req, res, next) => {
  try {
    if (req.auth?.role === 'admin') {
      const adminMerchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement', verificationStatus: 'verified', status: 'active', upiId: { $exists: true, $nin: ['', null] } }).sort({ verifiedAt: -1 }).lean();
      return res.json({ status: true, verified: !!adminMerchant, role: 'admin', merchant: adminMerchant ? { id: adminMerchant._id, name: adminMerchant.name, upiId: adminMerchant.upiId, provider: adminMerchant.provider, verifiedEmail: adminMerchant.verifiedEmail, verifiedAt: adminMerchant.verifiedAt } : null, message: adminMerchant ? 'Administrator payment UPI is verified and can receive subscription payments.' : 'Verify the administrator payment UPI with a matching test payment before accepting subscription payments.' });
    }
    const settings = await GatewaySettings.findOne({ key: 'global' }).lean(); const adminIds = await User.find({ role: 'admin', status: 'active' }).distinct('_id');
    const verifiedAdminMerchant = await Merchant.findOne({ owner: { $in: adminIds }, provider: 'admin_settlement', verificationStatus: 'verified', status: 'active', upiId: { $exists: true, $nin: ['', null] } }).sort({ verifiedAt: -1 }).lean();
    const pendingAdminMerchant = !verifiedAdminMerchant ? await Merchant.findOne({ owner: { $in: adminIds }, provider: 'admin_settlement', upiId: { $exists: true, $nin: ['', null] } }).sort({ createdAt: -1 }).lean() : null;
    const upiId = verifiedAdminMerchant?.upiId || pendingAdminMerchant?.upiId || settings?.subscriptionUpiId || '';
    if (!upiId) return res.json({ status: true, verified: false, merchant: null, message: 'Administrator payment UPI is not configured yet.' });
    const gmailReady = pendingAdminMerchant ? !!(await GmailConnection.findOne({ owner: pendingAdminMerchant.owner, merchant: pendingAdminMerchant._id, active: true })) : false;
    return res.json({ status: true, verified: !!verifiedAdminMerchant, paymentReady: !!pendingAdminMerchant && gmailReady, merchant: { id: verifiedAdminMerchant?._id || pendingAdminMerchant?._id || null, name: verifiedAdminMerchant?.name || pendingAdminMerchant?.name || settings?.subscriptionUpiName || 'OmniUPI', upiId, provider: 'admin_settlement', verifiedEmail: verifiedAdminMerchant?.verifiedEmail || null, verifiedAt: verifiedAdminMerchant?.verifiedAt || null }, message: verifiedAdminMerchant ? 'Administrator payment UPI is verified.' : gmailReady ? 'A test payment can be made now. We will verify the UPI from the linked Gmail notification.' : 'Administrator must connect the Gmail account linked to this payment account first.' });
  } catch (error) { next(error); }
});

function buildDynamicUpiUrl({ upiId, payeeName, amount, orderId, planName }) { const params = new URLSearchParams({ pa: String(upiId).trim(), pn: String(payeeName || 'OmniUPI').trim(), am: Number(amount).toFixed(2), cu: 'INR', tr: orderId, tn: `OmniUPI ${planName} ${orderId}` }); return `upi://pay?${params.toString()}`; }

router.post('/purchase', requireAuth, requireKycIfEnabled, async (req, res, next) => {
  try {
    if (req.auth?.role === 'admin') return res.status(403).json({ status: false, message: 'Administrators have permanent free access and do not need a subscription.' });
    const adminIds = await User.find({ role: 'admin', status: 'active' }).distinct('_id');
    const adminMerchant = await Merchant.findOne({ owner: { $in: adminIds }, provider: 'admin_settlement', upiId: { $exists: true, $nin: ['', null] } }).sort({ verifiedAt: -1, createdAt: -1 }).lean();
    if (!adminMerchant) return res.status(503).json({ status: false, code: 'ADMIN_PAYMENT_UPI_NOT_CONFIGURED', message: 'Administrator payment UPI is not configured yet.' });
    const gmailConnected = !!(await GmailConnection.findOne({ owner: adminMerchant.owner, merchant: adminMerchant._id, active: true })) || !!(await GmailConnection.findOne({ owner: adminMerchant.owner, active: true }));
    if (!gmailConnected) return res.status(503).json({ status: false, code: 'ADMIN_PAYMENT_GMAIL_NOT_CONNECTED', message: 'Administrator must connect the Gmail account linked to the payment account before accepting subscription payments.' });
    const plan = await Plan.findOne({ _id: req.body.planId, active: true }); if (!plan) return res.status(404).json({ status: false, message: 'Plan not found or inactive' });
    const settings = await GatewaySettings.findOne({ key: 'global' }); const upiId = adminMerchant.upiId, upiName = adminMerchant.name || settings?.subscriptionUpiName || 'OmniUPI';
    const orderId = `AGP${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`, amount = Number(plan.price);
    const paymentUrl = buildDynamicUpiUrl({ upiId, payeeName: upiName, amount, orderId, planName: plan.name }); const qrDataUrl = await QRCode.toDataURL(paymentUrl, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
    const order = await SubscriptionOrder.create({ user: req.auth.sub, plan: plan._id, orderId, amount, paymentUrl });
    res.status(201).json({ status: true, order: { id: order._id, orderId, amount: order.amount, paymentUrl, qrDataUrl, upiId, upiName, plan: plan.name, durationDays: plan.durationDays, status: order.status, verificationPending: adminMerchant.verificationStatus !== 'verified' } });
  } catch (error) { next(error); }
});

router.get('/checkout/:orderId', requireAuth, async (req, res, next) => { try { const order = await SubscriptionOrder.findOne({ orderId: req.params.orderId, user: req.auth.sub }).populate('plan'); if (!order) return res.status(404).json({ status: false, message: 'Subscription order not found' }); const parsed = new URL(order.paymentUrl); const upiId = parsed.searchParams.get('pa') || ''; const upiName = parsed.searchParams.get('pn') || 'OmniUPI'; const qrDataUrl = await QRCode.toDataURL(order.paymentUrl, { width: 320, margin: 2, errorCorrectionLevel: 'M' }); res.json({ status: true, order: { orderId: order.orderId, amount: order.amount, plan: order.plan?.name || '', paymentUrl: order.paymentUrl, qrDataUrl, upiId, upiName, status: order.status } }); } catch (error) { next(error); } });

router.get('/order/:orderId', requireAuth, async (req, res, next) => { try { let order = await SubscriptionOrder.findOne({ orderId: req.params.orderId, user: req.auth.sub }).populate('plan'); if (!order) return res.status(404).json({ status: false, message: 'Subscription order not found' }); if (order.status === 'PENDING') { await verifySubscriptionOrderForAdmin(order.orderId); order = await SubscriptionOrder.findOne({ orderId: req.params.orderId, user: req.auth.sub }).populate('plan'); } const user = await User.findById(req.auth.sub).populate('plan'); res.json({ status: true, order: { orderId: order.orderId, amount: order.amount, plan: order.plan?.name || '', status: order.status, paidAt: order.paidAt || null, expiresAt: order.planExpiresAt || user?.planExpiresAt || null, utr: order.utr || null } }); } catch (error) { next(error); } });

router.get('/me', requireAuth, async (req, res, next) => { try { if (req.auth?.role === 'admin') return res.json({ status: true, role: 'admin', isAdmin: true, plan: null, active: true, expired: false, permanent: true, startedAt: null, expiresAt: null }); const user = await User.findById(req.auth.sub).populate('plan'); const now = new Date(); if (user?.plan && user.planExpiresAt && user.planExpiresAt <= now) { await SubscriptionOrder.updateMany({ user: user._id, status: 'SUCCESS', plan: user.plan._id, planExpiresAt: { $lte: now } }, { $set: { status: 'EXPIRED' } }); user.plan = null; user.planStatus = 'EXPIRED'; await user.save(); } const refreshed = await User.findById(req.auth.sub).populate('plan'); res.json({ status: true, role: 'merchant', isAdmin: false, plan: refreshed?.plan || null, active: !!refreshed?.plan && refreshed.planStatus === 'ACTIVE' && refreshed.planExpiresAt > now, expired: refreshed?.planStatus === 'EXPIRED', permanent: false, startedAt: refreshed?.planStartedAt || null, expiresAt: refreshed?.planExpiresAt || null }); } catch (error) { next(error); } });
export default router;
