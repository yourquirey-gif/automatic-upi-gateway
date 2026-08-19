import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Merchant from '../models/Merchant.js';
import GmailConnection from '../models/GmailConnection.js';
import GatewaySettings from '../models/GatewaySettings.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { requireKycIfEnabled } from '../middleware/kyc.js';
import { createGoogleClient } from '../services/gmailPaymentVerifier.js';

const router = Router();
router.use(requireAuth, requireKycIfEnabled);

function normalizeUpi(value) { return String(value || '').trim().toLowerCase(); }

async function adminSettlementUpi() {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
  return normalizeUpi(settings?.settlementUpiId);
}

async function isAdminUser(userId) {
  const user = await User.findById(userId).select('role status').lean();
  return !!user && user.role === 'admin' && user.status === 'active';
}

router.get('/', async (req, res, next) => {
  try {
    // Admin Settlement is a private admin-only merchant and must never leak into
    // the normal merchant list even if old data was created incorrectly.
    const merchants = await Merchant.find({ owner: req.auth.sub, provider: { $ne: 'admin_settlement' } }).sort({ createdAt: -1 });
    res.json({ status: true, merchants });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, provider, upiId, mobile, externalMerchantId, config } = req.body;
    if (!name || !provider) return res.status(400).json({ status: false, message: 'name and provider are required' });

    const admin = await isAdminUser(req.auth.sub);
    const normalizedUpi = normalizeUpi(upiId);
    const adminUpi = await adminSettlementUpi();

    // Admin Settlement UPI belongs exclusively to the administrator. A normal
    // merchant can never register, verify, or receive payments on that UPI.
    if (!admin && String(provider).trim() === 'admin_settlement') {
      return res.status(403).json({ status: false, message: 'Admin Settlement UPI is reserved for the administrator.' });
    }
    if (!admin && normalizedUpi && adminUpi && normalizedUpi === adminUpi) {
      return res.status(403).json({ status: false, message: 'This UPI ID is reserved for the administrator. Enter your own merchant UPI ID.' });
    }

    const merchant = await Merchant.create({
      owner: req.auth.sub,
      name,
      provider,
      upiId: normalizedUpi,
      mobile: String(mobile || '').replace(/\D/g, ''),
      externalMerchantId,
      config,
      status: 'pending',
      verificationStatus: 'pending',
      verificationMessage: 'Please use the Gmail account linked with this merchant/payment account.'
    });
    res.status(201).json({ status: true, message: 'Merchant added. Verification is required before it can receive live payments.', merchant });
  } catch (error) { next(error); }
});

router.delete('/:merchantId', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub });
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    const wasAdminSettlement = merchant.provider === 'admin_settlement';
    await GmailConnection.deleteOne({ merchant: merchant._id });
    await merchant.deleteOne();
    if (wasAdminSettlement) {
      await GatewaySettings.findOneAndUpdate({ key: 'global' }, { $unset: { subscriptionUpiId: 1, subscriptionUpiName: 1, settlementUpiId: 1, settlementName: 1, settlementProvider: 1, settlementMobile: 1 } });
    }
    res.json({ status: true, message: wasAdminSettlement ? 'Admin payment UPI and its Gmail verification connection were removed.' : 'UPI ID removed successfully.' });
  } catch (error) { next(error); }
});

function safeReturnUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const allowed = [process.env.PUBLIC_WEB_BASE_URL, process.env.ADMIN_WEB_BASE_URL].filter(Boolean).map(x => String(x).replace(/\/$/, ''));
    return allowed.some(base => url.origin === new URL(base).origin) ? candidate : null;
  } catch { return null; }
}

router.post('/:merchantId/verify', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub });
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    if (merchant.provider === 'admin_settlement') return res.status(403).json({ status: false, message: 'Admin Settlement UPI can only be verified from the administrator panel.' });
    const admin = await isAdminUser(req.auth.sub);
    const adminUpi = await adminSettlementUpi();
    if (!admin && normalizeUpi(merchant.upiId) && normalizeUpi(merchant.upiId) === adminUpi) {
      merchant.verificationStatus = 'failed';
      merchant.status = 'paused';
      merchant.verificationMessage = 'This UPI ID belongs to the administrator and cannot be used by a merchant account.';
      await merchant.save();
      return res.status(403).json({ status: false, message: merchant.verificationMessage });
    }
    if (!merchant.upiId) return res.status(400).json({ status: false, message: 'Add the merchant UPI ID before verification.' });
    if (merchant.verificationStatus === 'verified') return res.json({ status: true, verified: true, merchant });
    const client = await createGoogleClient('gmail');
    const returnUrl = safeReturnUrl(req.body?.returnUrl || req.query?.returnUrl);
    const state = jwt.sign({ sub: req.auth.sub, merchantId: String(merchant._id), purpose: 'merchant-gmail-verify', returnUrl }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', state, scope: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] });
    merchant.verificationStatus = 'verifying';
    merchant.verificationMessage = 'Please use the Gmail account linked with this merchant/payment account.';
    await merchant.save();
    res.json({ status: true, verified: false, url, message: merchant.verificationMessage });
  } catch (error) { next(error); }
});

router.get('/:merchantId/verification', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub }).lean();
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    const gmail = await GmailConnection.findOne({ merchant: merchant._id, active: true }).lean();
    res.json({ status: true, verificationStatus: merchant.verificationStatus, merchantStatus: merchant.status, verifiedAt: merchant.verifiedAt, verifiedEmail: merchant.verifiedEmail, message: merchant.verificationMessage, gmail: gmail ? { email: gmail.email, connected: true, lastCheckedAt: gmail.lastCheckedAt } : { connected: false } });
  } catch (error) { next(error); }
});

router.get('/:merchantId/checkout', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub }).lean();
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    res.json({ status: true, merchantId: merchant._id, checkout: merchant.config?.checkout || {} });
  } catch (error) { next(error); }
});

router.put('/:merchantId/checkout', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub });
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    const body = req.body || {};
    const checkout = {
      brandName: String(body.brandName || merchant.name).trim().slice(0, 100),
      themeColor: /^#[0-9a-fA-F]{6}$/.test(String(body.themeColor || '')) ? String(body.themeColor) : '#0B95BD',
      instructions: String(body.instructions || '').slice(0, 3000),
      showQrCode: body.showQrCode !== false,
      showIntentButtons: body.showIntentButtons !== false,
      showUpiId: body.showUpiId !== false,
      showCopyButton: body.showCopyButton !== false,
      showBhim: body.showBhim !== false,
      brandLogo: typeof body.brandLogo === 'string' && body.brandLogo.length <= 1500000 ? body.brandLogo : ''
    };
    merchant.config = { ...(merchant.config || {}), checkout };
    await merchant.save();
    res.json({ status: true, checkout });
  } catch (error) { next(error); }
});

export default router;
