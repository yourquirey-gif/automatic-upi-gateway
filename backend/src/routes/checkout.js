import { Router } from 'express';
import Merchant from '../models/Merchant.js';
import Order from '../models/Order.js';

const router = Router();
const WEB = 'https://omniupi.in';

function clean(v, max = 300) { return String(v ?? '').trim().slice(0, max); }
function upiUrl(order, merchant) {
  return `upi://pay?${new URLSearchParams({ pa: clean(merchant.upiId, 200), pn: clean(merchant.name || merchant.provider || 'Merchant', 80), am: Number(order.amount).toFixed(2), tr: order.orderId, cu: 'INR', tn: clean(order.remark1 || `Payment ${order.orderId}`, 80) }).toString()}`;
}
router.get('/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: clean(req.params.orderId, 100) }).populate('merchant').lean();
    if (!order) return res.status(404).json({ status: false, message: 'Order not found' });
    const merchant = order.merchant;
    if (!merchant || merchant.status !== 'active' || merchant.verificationStatus !== 'verified') return res.status(409).json({ status: false, message: 'Merchant is not verified and active' });
    const c = merchant.config?.checkout || {};
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ status: true, result: {
      orderId: order.orderId,
      amount: Number(order.amount).toFixed(2),
      status: order.status,
      redirectUrl: order.redirectUrl || null,
      merchant: { name: merchant.name, provider: merchant.provider, upiId: merchant.upiId },
      checkout: {
        brandName: clean(c.brandName || merchant.name, 100),
        themeColor: /^#[0-9a-fA-F]{6}$/.test(c.themeColor || '') ? c.themeColor : '#0B95BD',
        instructions: clean(c.instructions || '', 3000),
        showQrCode: c.showQrCode !== false,
        showIntentButtons: c.showIntentButtons !== false,
        showUpiId: c.showUpiId !== false,
        showCopyButton: c.showCopyButton !== false,
        showBhim: c.showBhim !== false,
        brandLogo: typeof c.brandLogo === 'string' ? c.brandLogo : ''
      },
      upiUrl: upiUrl(order, merchant)
    } });
  } catch (error) { next(error); }
});

router.get('/:orderId/status', async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: clean(req.params.orderId, 100) }).select('orderId amount status paidAt utr redirectUrl').lean();
    if (!order) return res.status(404).json({ status: false, message: 'Order not found' });
    res.set('Cache-Control', 'no-store, max-age=0');
    res.json({ status: true, result: { txnStatus: order.status, orderId: order.orderId, amount: Number(order.amount).toFixed(2), paidAt: order.paidAt || null, utr: order.utr || null, redirectUrl: order.redirectUrl || null } });
  } catch (error) { next(error); }
});

export default router;
