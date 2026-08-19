import { Router } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
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
    await Order.updateMany(
      { owner: req.auth.sub, status: 'PENDING', expiresAt: { $lte: now } },
      { $set: { status: 'EXPIRED' } }
    );
    const orders = await Order.find({ owner: req.auth.sub })
      .populate('merchant', 'name upiId provider status verificationStatus')
      .sort({ createdAt: -1 }).limit(limit).lean();
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ status: true, links: orders.map(o => ({ ...o, paymentUrl: paymentUrlFor(o.orderId) })) });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ status: false, message: 'Enter a valid positive amount.' });
    if (amount > 1000000) return res.status(400).json({ status: false, message: 'Amount exceeds the allowed limit.' });

    const admin = await User.findById(req.auth.sub).select('role status');
    if (!admin || admin.role !== 'admin' || admin.status !== 'active') return res.status(403).json({ status: false, message: 'Administrator access required.' });

    const merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement', status: 'active', verificationStatus: 'verified', upiId: { $nin: ['', null] } }).sort({ createdAt: -1 });
    if (!merchant) return res.status(409).json({ status: false, message: 'Verify and activate the Admin Settlement UPI before creating payment links.' });

    const id = clean(req.body?.orderId || req.body?.order_id, 100) || orderId();
    if (await Order.exists({ orderId: id })) return res.status(409).json({ status: false, message: 'Order ID already exists.' });
    const amountFixed = Number(amount.toFixed(2));
    const expiresAt = new Date(Date.now() + TTL_MS);
    const order = await Order.create({
      merchant: merchant._id,
      owner: req.auth.sub,
      orderId: id,
      amount: amountFixed,
      customerMobile: clean(req.body?.customerMobile || req.body?.customer_mobile, 20),
      redirectUrl: clean(req.body?.redirectUrl || req.body?.redirect_url, 1000),
      remark1: clean(req.body?.remark1, 200),
      remark2: clean(req.body?.remark2, 200),
      status: 'PENDING',
      feePercent: Number(merchant.planTransactionFeePercent || 0),
      netAmount: amountFixed,
      paymentUrl: paymentUrlFor(id),
      expiresAt
    });
    res.status(201).json({ status: true, message: 'Payment link created.', result: { orderId: order.orderId, amount: order.amount.toFixed(2), paymentUrl: order.paymentUrl, expiresAt: order.expiresAt, expiresInSeconds: 300, merchant: { name: merchant.name, upiId: merchant.upiId } } });
  } catch (e) { next(e); }
});

export default router;
