import { Router } from 'express';
import crypto from 'node:crypto';
import KycOrder from '../models/KycOrder.js';
import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptSecret } from '../utils/secretBox.js';

const router = Router();
router.use(requireAuth);

function makeUpiUrl({ upiId, payeeName, amount, orderId }) {
  const params = new URLSearchParams({
    pa: String(upiId).trim(),
    pn: String(payeeName || 'AutoGateway').trim(),
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tr: orderId,
    tn: `KYC Verification ${orderId}`
  });
  return `upi://pay?${params.toString()}`;
}

function validImage(value) {
  return typeof value === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(value) && Buffer.byteLength(value, 'utf8') <= 3_000_000;
}

router.get('/config', async (_req, res, next) => {
  try {
    const settings = await GatewaySettings.findOne({ key: 'global' });
    res.json({
      status: true,
      enabled: !!settings?.kycRequired,
      fee: Number(settings?.kycFee ?? 50),
      showPanField: settings?.showPanField !== false,
      showAadhaarField: settings?.showAadhaarField !== false
    });
  } catch (error) { next(error); }
});

router.get('/me', async (req, res, next) => {
  try {
    const [user, latest] = await Promise.all([
      User.findById(req.auth.sub).select('kycStatus kycVerifiedAt panNumber aadhaarNumber'),
      KycOrder.findOne({ user: req.auth.sub }).sort({ createdAt: -1 }).select('orderId amount status paidAt submittedAt verifiedAt rejectionReason')
    ]);
    res.json({ status: true, kycStatus: user?.kycStatus || 'NOT_SUBMITTED', verifiedAt: user?.kycVerifiedAt || null, latest });
  } catch (error) { next(error); }
});

router.post('/start', async (req, res, next) => {
  try {
    const settings = await GatewaySettings.findOne({ key: 'global' });
    if (!settings?.kycRequired) return res.status(400).json({ status: false, message: 'KYC is not currently required' });
    const user = await User.findById(req.auth.sub).select('kycStatus');
    if (user?.kycStatus === 'VERIFIED') return res.status(400).json({ status: false, message: 'KYC is already verified' });

    const aadhaarNumber = String(req.body.aadhaarNumber || '').replace(/\s/g, '');
    const aadhaarName = String(req.body.aadhaarName || '').trim();
    const panNumber = String(req.body.panNumber || '').trim().toUpperCase();
    const panName = String(req.body.panName || '').trim();
    if (!/^\d{12}$/.test(aadhaarNumber) || !aadhaarName) return res.status(400).json({ status: false, message: 'Valid Aadhaar number and Aadhaar name are required' });
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(panNumber) || !panName) return res.status(400).json({ status: false, message: 'Valid PAN number and PAN name are required' });
    if (!validImage(req.body.aadhaarFront) || !validImage(req.body.aadhaarBack) || !validImage(req.body.panFront) || !validImage(req.body.panBack)) {
      return res.status(400).json({ status: false, message: 'Aadhaar and PAN front/back images are required (JPG, PNG or WebP, max 3MB each)' });
    }

    const amount = Number(settings.kycFee ?? 50);
    const orderId = `AGK${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const upiId = settings.kycUpiId || settings.subscriptionUpiId;
    const upiName = settings.kycUpiName || settings.subscriptionUpiName || 'AutoGateway';
    if (!upiId) return res.status(503).json({ status: false, message: 'KYC payment UPI ID is not configured by administrator' });

    await KycOrder.updateMany({ user: req.auth.sub, status: 'PENDING_PAYMENT' }, { $set: { status: 'EXPIRED' } });
    const paymentUrl = makeUpiUrl({ upiId, payeeName: upiName, amount, orderId });
    const request = await KycOrder.create({
      user: req.auth.sub,
      orderId,
      amount,
      paymentUrl,
      aadhaarNumberEncrypted: encryptSecret(aadhaarNumber),
      aadhaarNameEncrypted: encryptSecret(aadhaarName),
      aadhaarFrontEncrypted: encryptSecret(req.body.aadhaarFront),
      aadhaarBackEncrypted: encryptSecret(req.body.aadhaarBack),
      panNumberEncrypted: encryptSecret(panNumber),
      panNameEncrypted: encryptSecret(panName),
      panFrontEncrypted: encryptSecret(req.body.panFront),
      panBackEncrypted: encryptSecret(req.body.panBack)
    });
    await User.findByIdAndUpdate(req.auth.sub, { kycStatus: 'PENDING_PAYMENT', panNumber, aadhaarNumber });
    res.status(201).json({ status: true, request: { orderId, amount, paymentUrl, status: request.status } });
  } catch (error) { next(error); }
});

router.get('/order/:orderId', async (req, res, next) => {
  try {
    const order = await KycOrder.findOne({ orderId: req.params.orderId, user: req.auth.sub }).select('orderId amount paymentUrl status paidAt submittedAt verifiedAt rejectionReason');
    if (!order) return res.status(404).json({ status: false, message: 'KYC request not found' });
    res.json({ status: true, order });
  } catch (error) { next(error); }
});

export default router;
