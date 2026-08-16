import { Router } from 'express';
import crypto from 'node:crypto';
import SubscriptionOrder from '../models/SubscriptionOrder.js';
import Plan from '../models/Plan.js';
import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await Plan.find({ active: true }).sort({ price: 1 });
    res.json({ status: true, plans });
  } catch (error) { next(error); }
});

function buildDynamicUpiUrl({ upiId, payeeName, amount, orderId, planName }) {
  const params = new URLSearchParams({
    pa: String(upiId).trim(),
    pn: String(payeeName || 'AutoGateway').trim(),
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tr: orderId,
    tn: `Subscription ${planName} ${orderId}`
  });
  return `upi://pay?${params.toString()}`;
}

router.post('/purchase', requireAuth, async (req, res, next) => {
  try {
    const plan = await Plan.findOne({ _id: req.body.planId, active: true });
    if (!plan) return res.status(404).json({ status: false, message: 'Plan not found or inactive' });

    const settings = await GatewaySettings.findOne({ key: 'global' });
    if (!settings?.subscriptionUpiId) {
      return res.status(503).json({ status: false, message: 'Subscription UPI ID is not configured by administrator' });
    }

    const orderId = `AGP${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const amount = Number(plan.price);
    const paymentUrl = buildDynamicUpiUrl({
      upiId: settings.subscriptionUpiId,
      payeeName: settings.subscriptionUpiName,
      amount,
      orderId,
      planName: plan.name
    });

    const order = await SubscriptionOrder.create({
      user: req.auth.sub,
      plan: plan._id,
      orderId,
      amount,
      paymentUrl
    });

    res.status(201).json({
      status: true,
      order: {
        id: order._id,
        orderId,
        amount: order.amount,
        paymentUrl,
        plan: plan.name,
        durationDays: plan.durationDays,
        status: order.status
      }
    });
  } catch (error) { next(error); }
});

router.get('/order/:orderId', requireAuth, async (req, res, next) => {
  try {
    const order = await SubscriptionOrder.findOne({ orderId: req.params.orderId, user: req.auth.sub }).populate('plan');
    if (!order) return res.status(404).json({ status: false, message: 'Subscription order not found' });
    const user = await User.findById(req.auth.sub).populate('plan');
    res.json({
      status: true,
      order: {
        orderId: order.orderId,
        amount: order.amount,
        plan: order.plan?.name || '',
        status: order.status,
        paidAt: order.paidAt || null,
        expiresAt: order.planExpiresAt || user?.planExpiresAt || null
      }
    });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub).populate('plan');
    const now = new Date();
    if (user?.plan && user.planExpiresAt && user.planExpiresAt <= now) {
      await SubscriptionOrder.updateMany({ user: user._id, status: 'SUCCESS', plan: user.plan._id, planExpiresAt: { $lte: now } }, { $set: { status: 'EXPIRED' } });
      user.plan = null;
      user.planStatus = 'EXPIRED';
      await user.save();
    }
    const refreshed = await User.findById(req.auth.sub).populate('plan');
    res.json({
      status: true,
      plan: refreshed?.plan || null,
      active: !!refreshed?.plan && refreshed.planStatus === 'ACTIVE' && refreshed.planExpiresAt > now,
      expired: refreshed?.planStatus === 'EXPIRED',
      startedAt: refreshed?.planStartedAt || null,
      expiresAt: refreshed?.planExpiresAt || null
    });
  } catch (error) { next(error); }
});

export default router;
