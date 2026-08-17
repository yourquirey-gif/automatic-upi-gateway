import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Merchant from '../models/Merchant.js';
import GmailConnection from '../models/GmailConnection.js';
import { requireAuth } from '../middleware/auth.js';
import { requireKycIfEnabled } from '../middleware/kyc.js';
import { createGoogleClient } from '../services/gmailPaymentVerifier.js';
import { encryptSecret } from '../utils/secretBox.js';

const router = Router();
router.use(requireAuth, requireKycIfEnabled);

router.get('/', async (req, res, next) => {
  try {
    const merchants = await Merchant.find({ owner: req.auth.sub }).sort({ createdAt: -1 });
    res.json({ status: true, merchants });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, provider, upiId, mobile, externalMerchantId, config } = req.body;
    if (!name || !provider) return res.status(400).json({ status: false, message: 'name and provider are required' });
    const merchant = await Merchant.create({
      owner: req.auth.sub,
      name,
      provider,
      upiId: String(upiId || '').trim().toLowerCase(),
      mobile: String(mobile || '').replace(/\D/g, ''),
      externalMerchantId,
      config,
      status: 'pending',
      verificationStatus: 'pending',
      verificationMessage: 'Please verify this merchant with the Gmail account linked with this merchant/payment account.'
    });
    res.status(201).json({ status: true, message: 'Merchant added. Verification is required before it can receive live payments.', merchant });
  } catch (error) { next(error); }
});

router.post('/:merchantId/verify', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub });
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    if (!merchant.upiId) return res.status(400).json({ status: false, message: 'Add the merchant UPI ID before verification.' });
    if (merchant.verificationStatus === 'verified') return res.json({ status: true, verified: true, merchant });

    const client = createGoogleClient();
    const state = jwt.sign({ sub: req.auth.sub, merchantId: String(merchant._id), purpose: 'merchant-gmail-verify' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      state,
      scope: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly']
    });
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
      brandLogo: typeof body.brandLogo === 'string' && body.brandLogo.length <= 1500000 ? body.brandLogo : ''
    };
    merchant.config = { ...(merchant.config || {}), checkout };
    await merchant.save();
    res.json({ status: true, checkout });
  } catch (error) { next(error); }
});

export default router;
