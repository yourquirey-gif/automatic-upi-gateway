import { Router } from 'express';
import crypto from 'node:crypto';
import SubscriptionOrder from '../models/SubscriptionOrder.js';
import Plan from '../models/Plan.js';
import GatewaySettings from '../models/GatewaySettings.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/plans', async (_req, res, next) => {
  try {
    const plans = await Plan.find({ active: true }).sort({ price: 1 });
    res.json({ status: true, plans });
  } catch (error) { next(error); }
});

function buildPaymentLink(template, { amount, orderId, planName }) {
  const raw = String(template || '').trim();
  if (!raw) return '';
  const replacements = { amount: amount.toFixed(2), orderId, plan: planName };
  let link = raw.replace(/\{(amount|orderId|plan)\}/gi, (_, key) => replacements[key.toLowerCase()]);
  try {
    const url = new URL(link, 'https://autogateway.invalid');
    if (url.hostname !== 'autogateway.invalid') {
      url.searchParams.set('amount', amount.toFixed(2));
      url.searchParams.set('orderId', orderId);
      url.searchParams.set('plan', planName);
      return url.toString();
    }
  } catch {}
  return link;
}

router.post('/purchase', requireAuth, async (req, res, next) => {
  try {
    const plan = await Plan.findOne({ _id: req.body.planId, active: true });
    if (!plan) return res.status(404).json({ status: false, message: 'Plan not found or inactive' });

    const settings = await GatewaySettings.findOne({ key: 'global' });
    if (!settings?.subscriptionPaymentLink) {
      return res.status(503).json({ status: false, message: 'Subscription payment link is not configured by administrator' });
    }

    const orderId = `AGP${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const paymentUrl = buildPaymentLink(settings.subscriptionPaymentLink, {
      amount: Number(plan.price),
      orderId,
      planName: plan.name
    });
    if (!paymentUrl) return res.status(503).json({ status: false, message: 'Invalid subscription payment link configuration' });

    const order = await SubscriptionOrder.create({ user: req.auth.sub, plan: plan._id, orderId, amount: plan.price, paymentUrl });
    res.status(201).json({ status: true, order: { id: order._id, orderId, amount: order.amount, paymentUrl, plan: plan.name, durationDays: plan.durationDays, status: order.status } });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await (await import('../models/User.js')).default.findById(req.auth.sub).populate('plan');
    const active = !!user?.plan && !!user?.trialEndsAt ? user.trialEndsAt > new Date() : !!user?.plan;
    res.json({ status: true, plan: user?.plan || null, active, expiresAt: user?.trialEndsAt || null });
  } catch (error) { next(error); }
});

export default router;
