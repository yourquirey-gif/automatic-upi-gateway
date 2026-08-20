import { Router } from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Merchant from '../models/Merchant.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const PAYMENT_LINK_TTL_MS = 5 * 60 * 1000;
const SITE = String(process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in').replace(/\/$/, '');
const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max);

function makeOrderId() { return `ORD_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`; }
function paymentUrlFor(orderId) { return `${SITE}/pay.html?order_id=${encodeURIComponent(orderId)}`; }

async function createUniqueOrderId(requested) {
  let id = clean(requested, 100);
  if (!id) id = makeOrderId();
  for (let attempt = 0; attempt < 8; attempt++) {
    if (!(await Order.exists({ orderId: id }))) return id;
    id = makeOrderId();
  }
  throw new Error('Unable to generate a unique order ID. Please try again.');
}

router.post('/payment-link', async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ status: false, message: 'Enter a valid positive amount.' });
    if (amount > 1000000) return res.status(400).json({ status: false, message: 'Amount exceeds the allowed limit.' });

    const merchantQuery = { owner: req.auth.sub, status: 'active', upiId: { $exists: true, $nin: ['', null] }, provider: { $ne: 'admin_settlement' } };
    const requestedMerchantId = clean(req.body?.merchantId || req.body?.merchant_id, 100);
    if (requestedMerchantId) merchantQuery._id = requestedMerchantId;
    const merchant = await Merchant.findOne(merchantQuery).sort({ verifiedAt: -1, createdAt: -1 });
    if (!merchant) return res.status(409).json({ status: false, message: 'No active merchant UPI is available. Connect a merchant and save its UPI ID first.' });

    const amountFixed = Number(amount.toFixed(2));
    const orderId = await createUniqueOrderId(req.body?.orderId || req.body?.order_id);
    const expiresAt = new Date(Date.now() + PAYMENT_LINK_TTL_MS);
    const customerMobile = clean(req.body?.customerMobile || req.body?.customer_mobile, 20);
    const remark = clean(req.body?.remark || req.body?.remark1, 200);
    const remark2 = clean(req.body?.remark2, 200);
    const redirectUrl = clean(req.body?.redirectUrl || req.body?.redirect_url, 1000);

    const order = await Order.create({ merchant: merchant._id, owner: req.auth.sub, orderId, amount: amountFixed, customerMobile, redirectUrl, remark1: remark || `Payment ${orderId}`, remark2, status: 'PENDING', feePercent: Number(merchant.planTransactionFeePercent || 0), feeAmount: 0, netAmount: amountFixed, feeSettlementStatus: 'NOT_APPLICABLE', verificationSource: 'gmail', paymentUrl: paymentUrlFor(orderId), expiresAt });

    res.status(201).json({ status: true, message: 'Payment link created successfully.', result: { orderId: order.orderId, order_id: order.orderId, amount: order.amount.toFixed(2), status: order.status, paymentUrl: order.paymentUrl, payment_url: order.paymentUrl, expiresAt: order.expiresAt, expires_at: order.expiresAt, expiresInSeconds: 300, merchant: { id: merchant._id, name: merchant.name, upiId: merchant.upiId } } });
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const status = String(req.query.status || '').toUpperCase();
    const query = { owner: req.auth.sub };
    if (['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'].includes(status)) query.status = status;
    const [orders, total] = await Promise.all([Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Order.countDocuments(query)]);
    res.json({ status: true, orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

router.get('/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findOne({ owner: req.auth.sub, orderId: req.params.orderId }).lean();
    if (!order) return res.status(404).json({ status: false, message: 'Order not found' });
    res.json({ status: true, order });
  } catch (error) { next(error); }
});

export default router;
