import { Router } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';

const router = Router();

function getApiToken(req) {
  const authorization = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  return String(req.body?.user_token || req.body?.api_token || req.headers['x-api-key'] || '').trim();
}

async function requireApiUser(req, res, next) {
  try {
    const token = getApiToken(req);
    if (!token) return res.status(401).json({ status: false, message: 'API token is required' });
    const user = await User.findOne({ apiToken: token, status: 'active', role: 'merchant' })
      .select('+apiToken +instanceSecret webhookUrl userId name email');
    if (!user) return res.status(401).json({ status: false, message: 'Invalid or inactive API token' });
    req.apiUser = user;
    next();
  } catch (error) { next(error); }
}

function cleanString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function makeOrderId() {
  return `${Date.now()}${crypto.randomBytes(4).toString('hex')}`.slice(0, 24);
}

function buildPaymentUrl(req, order) {
  const base = String(process.env.PUBLIC_API_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return `${base}/api/payment/${encodeURIComponent(order.orderId)}`;
}

function buildUpiUrl(order, merchant) {
  const pa = cleanString(merchant.upiId, 200);
  const pn = cleanString(merchant.name || merchant.provider || 'Merchant', 80);
  const tn = cleanString(order.remark1 || `Payment ${order.orderId}`, 80);
  const params = new URLSearchParams({ pa, pn, am: Number(order.amount).toFixed(2), tr: order.orderId, cu: 'INR', tn });
  return `upi://pay?${params.toString()}`;
}

router.post('/create-order', requireApiUser, async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount);
    const customerMobile = cleanString(req.body?.customer_mobile || req.body?.customerMobile, 20);
    const redirectUrl = cleanString(req.body?.redirect_url || req.body?.redirectUrl, 1000);
    const remark1 = cleanString(req.body?.remark1, 200);
    const remark2 = cleanString(req.body?.remark2, 200);
    const requestedOrderId = cleanString(req.body?.order_id || req.body?.orderId, 100);

    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ status: false, message: 'amount must be a positive number' });
    if (amount > 1000000) return res.status(400).json({ status: false, message: 'amount exceeds the allowed limit' });
    if (redirectUrl && !/^https?:\/\//i.test(redirectUrl)) return res.status(400).json({ status: false, message: 'redirect_url must include http or https' });

    const merchantId = cleanString(req.body?.merchant_id || req.body?.merchantId, 100);
    const merchantQuery = { owner: req.apiUser._id, status: 'active' };
    if (merchantId) merchantQuery._id = merchantId;
    const merchant = await Merchant.findOne(merchantQuery).sort({ createdAt: -1 });
    if (!merchant) return res.status(400).json({ status: false, message: 'No active merchant connection found. Connect your merchant account first.' });
    if (!merchant.upiId) return res.status(400).json({ status: false, message: 'Merchant UPI ID is not configured' });

    const orderId = requestedOrderId || makeOrderId();
    if (await Order.exists({ orderId })) return res.status(409).json({ status: false, message: 'order_id already exists' });

    const feePercent = Number(merchant.planTransactionFeePercent || 0);
    const order = await Order.create({
      merchant: merchant._id,
      owner: req.apiUser._id,
      orderId,
      amount: Number(amount.toFixed(2)),
      customerMobile,
      redirectUrl,
      remark1,
      remark2,
      status: 'PENDING',
      feePercent,
      netAmount: Number(amount.toFixed(2)),
      paymentUrl: ''
    });

    order.paymentUrl = buildPaymentUrl(req, order);
    await order.save();
    const upiUrl = buildUpiUrl(order, merchant);

    res.status(201).json({
      status: true,
      message: 'Order Created Successfully',
      result: {
        txnStatus: 'PENDING',
        orderId: order.orderId,
        order_id: order.orderId,
        amount: order.amount.toFixed(2),
        paymentUrl: order.paymentUrl,
        payment_url: order.paymentUrl,
        upiUrl,
        upi_url: upiUrl,
        redirectUrl: order.redirectUrl || null,
        customerMobile: order.customerMobile || null,
        remark1: order.remark1 || null,
        remark2: order.remark2 || null
      }
    });
  } catch (error) { next(error); }
});

router.post('/check-order-status', requireApiUser, async (req, res, next) => {
  try {
    const orderId = cleanString(req.body?.order_id || req.body?.orderId, 100);
    if (!orderId) return res.status(400).json({ status: false, message: 'order_id is required' });
    const order = await Order.findOne({ orderId, owner: req.apiUser._id }).lean();
    if (!order) return res.status(404).json({ status: false, message: 'Order not found' });
    res.json({
      status: true,
      message: order.status === 'SUCCESS' ? 'Transaction Successfully' : `Transaction ${order.status}`,
      result: {
        txnStatus: order.status,
        orderId: order.orderId,
        order_id: order.orderId,
        amount: Number(order.amount).toFixed(2),
        date: order.paidAt || order.createdAt,
        utr: order.utr || null,
        customerMobile: order.customerMobile || null,
        redirectUrl: order.redirectUrl || null,
        remark1: order.remark1 || null,
        remark2: order.remark2 || null
      }
    });
  } catch (error) { next(error); }
});

router.get('/payment/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).populate('merchant').lean();
    if (!order) return res.status(404).send('<h1>Order not found</h1>');
    if (order.status === 'SUCCESS') {
      const redirect = order.redirectUrl ? `<script>location.replace(${JSON.stringify(order.redirectUrl)});</script>` : '';
      return res.type('html').send(`<!doctype html><html><body style="font-family:Arial;text-align:center;padding:40px"><h1>Payment Successful</h1><p>Order: ${order.orderId}</p>${redirect}</body></html>`);
    }
    const upiUrl = buildUpiUrl(order, order.merchant);
    const safeUpi = JSON.stringify(upiUrl);
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pay ₹${order.amount}</title></head><body style="font-family:Arial;background:#f5f7fb;padding:24px;text-align:center"><div style="max-width:440px;margin:40px auto;background:#fff;padding:28px;border-radius:20px"><h2>Complete Payment</h2><p>Amount: <b>₹${Number(order.amount).toFixed(2)}</b></p><p>Order ID: ${order.orderId}</p><a href=${safeUpi} style="display:block;background:#1677ff;color:#fff;padding:16px;border-radius:12px;text-decoration:none;font-weight:700">Pay Now with UPI</a><p style="color:#777;font-size:13px;margin-top:18px">After payment, your merchant will receive an automatic success notification when the payment is verified.</p></div><script>setTimeout(()=>{try{location.href=${safeUpi}}catch(e){}},350)</script></body></html>`);
  } catch (error) { next(error); }
});

router.get('/health', (_req, res) => res.json({ status: true, service: 'Automatic UPI Gateway Public API', version: '1.0' }));

export default router;
