import { Router } from 'express';
import jwt from 'jsonwebtoken';
import GmailConnection from '../models/GmailConnection.js';
import Merchant from '../models/Merchant.js';
import GatewaySettings from '../models/GatewaySettings.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createGoogleClient, verifyMerchantGmail, verifyPendingOrdersForAdmin } from '../services/gmailPaymentVerifier.js';
import { encryptSecret } from '../utils/secretBox.js';

const router = Router();

// Admin: verify the configured settlement UPI using the same Google/Gmail verification flow as merchants.
router.get('/connect', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
    const upiId = String(settings?.settlementUpiId || '').trim().toLowerCase();
    if (!upiId) return res.status(400).json({ status: false, message: 'First save the Settlement UPI ID in Gateway & Payment Settings.' });

    let merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement' });
    if (!merchant) {
      merchant = await Merchant.create({ owner: req.auth.sub, name: settings?.settlementName || 'OmniUPI Settlement', provider: 'admin_settlement', upiId, status: 'pending', verificationStatus: 'pending', verificationMessage: 'Verify this settlement UPI using the linked Google/Gmail account.' });
    } else {
      merchant.upiId = upiId;
      merchant.name = settings?.settlementName || merchant.name || 'OmniUPI Settlement';
      merchant.status = merchant.verificationStatus === 'verified' && merchant.upiId === upiId ? merchant.status : 'pending';
      merchant.verificationStatus = 'pending';
      merchant.verificationMessage = 'Verify this settlement UPI using the linked Google/Gmail account.';
      await merchant.save();
    }

    const client = await createGoogleClient('gmail');
    const state = jwt.sign({ sub: req.auth.sub, merchantId: String(merchant._id), purpose: 'admin-upi-verify' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', state, scope: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] });
    res.json({ status: true, url, upiId });
  } catch (error) { next(error); }
});

router.get('/callback', async (req, res, next) => {
  try {
    const payload = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (!payload?.sub || !['gmail-connect', 'merchant-gmail-verify', 'admin-upi-verify'].includes(payload.purpose)) return res.status(400).send('Invalid OAuth state');
    const client = await createGoogleClient('gmail');
    const { tokens } = await client.getToken(String(req.query.code || ''));
    if (!tokens.refresh_token) return res.status(400).send('<h2>Gmail authorization failed</h2><p>Google did not return a refresh token. Please reconnect and grant consent again.</p>');
    client.setCredentials(tokens);
    const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();

    if (payload.purpose === 'merchant-gmail-verify' || payload.purpose === 'admin-upi-verify') {
      const ownerFilter = payload.purpose === 'admin-upi-verify' ? { role: 'admin', status: 'active' } : {};
      const User = (await import('../models/User.js')).default;
      const owner = await User.findOne({ _id: payload.sub, ...ownerFilter });
      if (!owner) return res.status(403).send('Administrator accounts must use administrator login.');
      const merchant = await Merchant.findOne({ _id: payload.merchantId, owner: payload.sub });
      if (!merchant) return res.status(404).send('<h2>UPI verification record not found</h2>');
      const result = await verifyMerchantGmail({ merchant, client, email: me.data.email, refreshToken: tokens.refresh_token });
      const web = String(process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in').replace(/\/$/, '');
      const params = new URLSearchParams({ merchant_id: String(merchant._id), merchant_verified: result.verified ? '1' : '0', merchant_message: result.message || '' });
      return res.redirect(`${web}/?${params.toString()}#upi-verification`);
    }

    const admin = await (await import('../models/User.js')).default.findOne({ _id: payload.sub, role: 'admin', status: 'active' });
    if (!admin) return res.status(403).send('Administrator accounts must use administrator login.');
    await GmailConnection.findOneAndUpdate({ owner: payload.sub }, { owner: payload.sub, email: me.data.email, refreshTokenEncrypted: encryptSecret(tokens.refresh_token), active: true }, { upsert: true, new: true });
    res.redirect(`${String(process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in').replace(/\/$/, '')}/#admin`);
  } catch (error) { next(error); }
});

router.post('/sync', requireAuth, requireAdmin, async (req, res, next) => {
  try { res.json({ status: true, result: await verifyPendingOrdersForAdmin(req.auth.sub) }); }
  catch (error) { next(error); }
});

router.get('/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const connection = await GmailConnection.findOne({ owner: req.auth.sub, active: true });
    const merchant = await Merchant.findOne({ owner: req.auth.sub, provider: 'admin_settlement' }).lean();
    res.json({ status: true, connected: !!connection, email: connection?.email || null, lastCheckedAt: connection?.lastCheckedAt || null, upiVerification: merchant ? { upiId: merchant.upiId, status: merchant.verificationStatus, verifiedEmail: merchant.verifiedEmail || null, verifiedAt: merchant.verifiedAt || null, message: merchant.verificationMessage || '' } : null });
  } catch (error) { next(error); }
});

export default router;
