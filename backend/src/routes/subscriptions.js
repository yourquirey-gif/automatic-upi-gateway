import { Router } from 'express';
import crypto from 'node:crypto';
import Plan from '../models/Plan.js';
import SubscriptionOrder from '../models/SubscriptionOrder.js';
import GatewaySettings from '../models/GatewaySettings.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await Plan.find({ active: true }).sort({ price: 1 });
    res.json({ status: true, plans });
  } catch (error) { next(error); }
});

router.post('/purchase', async (req, res, next) => {
  try {
    const plan = await Plan.findOne({ _id: req.body.planId, active: true });
    if (!plan) return res.status(404).json({ status: false, message: 'Plan not found or inactive' });
    const settings = await GatewaySettings.findOne({ key: 'global' });
    if (!settings?.settlementUpiId) return res.status(503).json({ status: false, message: 'Settlement UPI is not configured by administrator' });

    const orderId = `AGP${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const params = new URLSearchParams({ pa: settings.settlementUpiId, pn: settings.settlementName || 'AutoGateway', am: plan.price.toFixed(2), cu: 'INR', tn: orderId });
    const paymentUrl = `upi://pay?${params.toString()}`;
    const order = await SubscriptionOrder.create({ user: req.auth.sub, plan: plan._id, orderId, amount: plan.price, paymentUrl });
    res.status(201).json({ status: true, order: { id: order._id, orderId, amount: order.amount, paymentUrl, plan: plan.name, durationDays: plan.durationDays } });
  } catch (error) { next(error); }
});

router.get('/me', async (req, res, next) => {
  try {
    const user = await (await import('../models/User.js')).default.findById(req.auth.sub).populate('plan');
    const active = !!user?.plan && !!user?.trialEndsAt ? user.trialEndsAt > new Date() : !!user?.plan;
    res.json({ status: true, plan: user?.plan || null, active, expiresAt: user?.trialEndsAt || null });
  } catch (error) { next(error); }
});

export default router;
