import { Router } from 'express';
import crypto from 'crypto';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const SITE = 'https://omniupi.in';
const PAYMENT_PAGE = `${SITE}/pay.html`;
const TTL_MS = 5 * 60 * 1000;
const clean = (v, max = 300) => String(v ?? '').trim().slice(0, max);
const orderId = () => `${Date.now()}${crypto.randomBytes(4).toString('hex')}`.slice(0, 24);
const paymentUrlFor = id => `${PAYMENT_PAGE}?order_id=${encodeURIComponent(id)}`;

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const now = new Date();
    const orders = await Order.find({ owner: req.auth.sub })
      .populate('merchant', 'name upiId provider status verificationStatus')
      .sort({ createdAt: -1 }).limit(limit).lean();

    const links = orders.map(o => ({
      ...o,
      status: o.status === 'PENDING' && o.expiresAt && new Date(o.expiresAt).getTime() <= now.getTime() ? 'EXPIRED' : o.status,
      paymentUrl: paymentUrlFor(o.orderId)
    }));

    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ status: true, links });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ status: false, message: 'Enter a valid positive amount.' });
    }
    if (amount > 1000000) {
      return res.status(400).json({ status: false, message: 'Amount exceeds the allowed limit.' });
    }

    const ownerId = clean(req.auth?.sub, 100);
    if (!ownerId) {
      return res.status(401).json({ status: false, message: 'Admin session is invalid. Please login again.' });
    }

    // Payment links can ONLY settle into the currently active, Gmail-verified Admin Settlement UPI.
    const merchant = await Merchant.findOne({
      owner: ownerId,
      provider: 'admin_settlement',
      status: 'active',
      verificationStatus: 'verified',
      upiId: { $exists: true, $nin: ['', null] }
    }).sort({ verifiedAt: -1, createdAt: -1 }).lean();

    if (!merchant) {
      return res.status(409).json({
        status: false,
        message: 'Admin Settlement UPI is not active and verified. Verify the Admin UPI through Gmail payment verification first.'
      });
    }

    const id = clean(req.body?.orderId || req.body?.order_id, 100) || orderId();
    if (await Order.exists({ orderId: id })) {
      return res.status(409).json({ status: false, message: 'Order ID already exists.' });
    }

    const amountFixed = Number(amount.toFixed(2));
    const expiresAt = new Date(Date.now() + TTL_MS);

    const order = await Order.create({
      merchant: merchant._id,
      owner: ownerId,
      orderId: id,
      amount: amountFixed,
      customerMobile: clean(req.body?.customerMobile || req.body?.customer_mobile, 20),
      redirectUrl: clean(req.body?.redirectUrl || req.body?.redirect_url, 1000),
      remark1: clean(req.body?.remark || req.body?.remark1, 200),
      remark2: clean(req.body?.remark2, 200),
      status: 'PENDING',
      feePercent: Number(merchant.planTransactionFeePercent || 0),
      netAmount: amountFixed,
      paymentUrl: paymentUrlFor(id),
      expiresAt
    });

    return res.status(201).json({
      status: true,
      message: 'Payment link created.',
      result: {
        orderId: order.orderId,
        amount: order.amount.toFixed(2),
        paymentUrl: order.paymentUrl,
        expiresAt: order.expiresAt,
        expiresInSeconds: 300,
        merchant: { name: merchant.name, upiId: merchant.upiId }
      }
    });
  } catch (e) {
    console.error('[admin-payment-links] create failed:', e);
    return res.status(500).json({
      status: false,
      message: e?.name === 'ValidationError' ? 'Payment link data is invalid.' : 'Unable to create payment link. Please try again.'
    });
  }
});

export default router;
