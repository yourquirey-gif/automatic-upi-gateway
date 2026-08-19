import { Router } from 'express';
import QRCode from 'qrcode';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';
import GatewaySettings from '../models/GatewaySettings.js';

const router = Router();
function clean(v, max = 300) { return String(v ?? '').trim().slice(0, max); }
function normalizeUpi(v) { return String(v || '').trim().toLowerCase(); }
function upiUrl(order, merchant) { return `upi://pay?${new URLSearchParams({ pa: clean(merchant.upiId, 200), pn: clean(merchant.name || merchant.provider || 'Merchant', 80), am: Number(order.amount).toFixed(2), tr: order.orderId, cu: 'INR', tn: clean(order.remark1 || `Payment ${order.orderId}`, 80) }).toString()}`; }

router.get('/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: clean(req.params.orderId, 100) }).populate('merchant').lean();
    if (!order) return res.status(404).json({ status: false, message: 'Payment link not found' });
    if (order.status === 'PENDING' && order.expiresAt && new Date(order.expiresAt).getTime() <= Date.now()) {
      await Order.updateOne({ _id: order._id, status: 'PENDING' }, { $set: { status: 'EXPIRED' } });
      return res.status(410).json({ status: false, message: 'This payment link has expired. Please request a new payment link.' });
    }
    const merchant = order.merchant;
    if (!merchant || merchant.status !== 'active' || merchant.verificationStatus !== 'verified') return res.status(409).json({ status: false, message: 'Payment account is not verified and active' });

    // A normal merchant checkout must never use the Admin Settlement UPI.
    // Admin payment links use provider=admin_settlement and are handled separately.
    if (merchant.provider !== 'admin_settlement') {
      const settings = await GatewaySettings.findOne({ key: 'global' }).select('settlementUpiId').lean();
      const adminUpi = normalizeUpi(settings?.settlementUpiId);
      if (adminUpi && normalizeUpi(merchant.upiId) === adminUpi) {
        return res.status(409).json({ status: false, message: 'This payment account is reserved for the administrator. Merchant checkout is disabled until the merchant adds and verifies their own UPI ID.' });
      }
    }

    const c = merchant.config?.checkout || {};
    const paymentUpiUrl = upiUrl(order, merchant);
    const qrDataUrl = await QRCode.toDataURL(paymentUpiUrl, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ status: true, result: { orderId: order.orderId, amount: Number(order.amount).toFixed(2), status: order.status, expiresAt: order.expiresAt, redirectUrl: order.redirectUrl || null, merchant: { name: merchant.name, provider: merchant.provider, upiId: merchant.upiId }, checkout: { brandName: clean(c.brandName || merchant.name, 100), themeColor: /^#[0-9a-fA-F]{6}$/.test(c.themeColor || '') ? c.themeColor : '#0B95BD', instructions: clean(c.instructions || '', 3000), showQrCode: c.showQrCode !== false, showIntentButtons: c.showIntentButtons !== false, showUpiId: c.showUpiId !== false, showCopyButton: c.showCopyButton !== false, showBhim: c.showBhim !== false, brandLogo: typeof c.brandLogo === 'string' ? c.brandLogo : '' }, upiUrl: paymentUpiUrl, qrDataUrl } });
  } catch (error) { next(error); }
});

router.get('/:orderId/status', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: clean(req.params.orderId, 100) }).select('orderId amount status paidAt utr redirectUrl expiresAt').lean();
    if (!order) return res.status(404).json({ status: false, message: 'Order not found' });
    if (order.status === 'PENDING' && order.expiresAt && new Date(order.expiresAt).getTime() <= Date.now()) {
      await Order.updateOne({ _id: order._id, status: 'PENDING' }, { $set: { status: 'EXPIRED' } });
      order.status = 'EXPIRED';
    }
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ status: true, result: { txnStatus: order.status, orderId: order.orderId, amount: Number(order.amount).toFixed(2), paidAt: order.paidAt || null, utr: order.utr || null, expiresAt: order.expiresAt || null, redirectUrl: order.redirectUrl || null } });
  } catch (error) { next(error); }
});

export default router;
