import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import Order from '../models/Order.js';
import Merchant from '../models/Merchant.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Payment links must remain valid for exactly 5 minutes.
const PAYMENT_LINK_TTL_MS = 5 * 60 * 1000;
const SITE = String(process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in').replace(/\/$/, '');
const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max);

function makeOrderId() { return `ORD_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`; }
function paymentUrlFor(orderId) { return `${SITE}/pay.html?order_id=${encodeURIComponent(orderId)}`; }
function upiUrlFor(order, merchant) { return `upi://pay?${new URLSearchParams({ pa: clean(merchant.upiId,200), pn: clean(merchant.name || merchant.provider || 'Merchant',80), am: Number(order.amount).toFixed(2), tr: order.orderId, cu: 'INR', tn: clean(order.remark1 || `Payment ${order.orderId}`,80) }).toString()}`; }

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

    const ownerId = req.auth?.sub;
    if (!ownerId || !mongoose.isValidObjectId(ownerId)) return res.status(401).json({ status: false, message: 'Invalid merchant session. Please login again.' });

    const merchantQuery = { owner: ownerId, status: 'active', verificationStatus: 'verified', upiId: { $exists: true, $nin: ['', null] }, provider: { $ne: 'admin_settlement' } };
    const requestedMerchantId = clean(req.body?.merchantId || req.body?.merchant_id, 100);
    if (requestedMerchantId) {
      if (!mongoose.isValidObjectId(requestedMerchantId)) return res.status(400).json({ status: false, message: 'Invalid merchant ID. Please refresh Connect Merchant and try again.' });
      merchantQuery._id = requestedMerchantId;
    }

    const merchant = await Merchant.findOne(merchantQuery).sort({ verifiedAt: -1, createdAt: -1 }).lean();
    if (!merchant) return res.status(409).json({ status: false, message: 'No Gmail-verified active merchant UPI is available. Connect and verify the merchant first.' });

    const amountFixed = Number(amount.toFixed(2));
    let orderId = await createUniqueOrderId(req.body?.orderId || req.body?.order_id);
    const customerMobile = clean(req.body?.customerMobile || req.body?.customer_mobile, 20);
    const remark = clean(req.body?.remark || req.body?.remark1, 200);
    const remark2 = clean(req.body?.remark2, 200);
    const redirectUrl = clean(req.body?.redirectUrl || req.body?.redirect_url, 1000);
    const expiresAt = new Date(Date.now() + PAYMENT_LINK_TTL_MS);

    let order = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        order = await Order.create({ merchant: merchant._id, owner: ownerId, orderId, amount: amountFixed, customerMobile, redirectUrl, remark1: remark || `Payment ${orderId}`, remark2, status: 'PENDING', feePercent: Number(merchant.planTransactionFeePercent || 0), feeAmount: 0, netAmount: amountFixed, feeSettlementStatus: 'NOT_APPLICABLE', verificationSource: 'gmail', paymentUrl: paymentUrlFor(orderId), expiresAt });
        break;
      } catch (error) {
        if (error?.code === 11000 && attempt < 4) { orderId = makeOrderId(); continue; }
        throw error;
      }
    }
    if (!order) throw new Error('Unable to create payment order. Please try again.');

    const paymentUpiUrl = upiUrlFor(order, merchant);
    const qrDataUrl = await QRCode.toDataURL(paymentUpiUrl, { margin: 1, width: 320, errorCorrectionLevel: 'M' });

    return res.status(201).json({ status: true, message: 'Payment link created successfully.', result: { orderId: order.orderId, order_id: order.orderId, amount: order.amount.toFixed(2), status: order.status, paymentUrl: order.paymentUrl, payment_url: order.paymentUrl, expiresAt: order.expiresAt, expires_at: order.expiresAt, expiresInSeconds: 300, qrDataUrl } });
  } catch (error) {
    console.error('[orders/payment-link] create failed:', error);
    if (error?.name === 'ValidationError') return res.status(400).json({ status: false, message: `Payment order data is invalid: ${error.message}` });
    if (error?.name === 'CastError') return res.status(400).json({ status: false, message: 'Invalid merchant or order data. Please refresh and try again.' });
    next(error);
  }
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
