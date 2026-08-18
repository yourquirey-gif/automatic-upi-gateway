import { Router } from 'express';
import jwt from 'jsonwebtoken';
import GmailConnection from '../models/GmailConnection.js';
import Merchant from '../models/Merchant.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createGoogleClient, verifyMerchantGmail, verifyPendingOrdersForAdmin } from '../services/gmailPaymentVerifier.js';
import { encryptSecret } from '../utils/secretBox.js';

const router = Router();

// Admin Gmail connection is retained for the existing admin verification tools.
router.get('/connect', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const client = await createGoogleClient('gmail');
    const state = jwt.sign({ sub: req.auth.sub, purpose: 'gmail-connect' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', state, scope: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] });
    res.json({ status: true, url });
  } catch (error) { next(error); }
});

router.get('/callback', async (req, res, next) => {
  try {
    const payload = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (!payload?.sub || !['gmail-connect', 'merchant-gmail-verify'].includes(payload.purpose)) return res.status(400).send('Invalid OAuth state');
    const client = await createGoogleClient('gmail');
    const { tokens } = await client.getToken(String(req.query.code || ''));
    if (!tokens.refresh_token) return res.status(400).send('<h2>Gmail authorization failed</h2><p>Google did not return a refresh token. Please reconnect and grant consent again.</p>');
    client.setCredentials(tokens);
    const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();

    if (payload.purpose === 'merchant-gmail-verify') {
      const merchant = await Merchant.findOne({ _id: payload.merchantId, owner: payload.sub });
      if (!merchant) return res.status(404).send('<h2>Merchant not found</h2>');
      const result = await verifyMerchantGmail({ merchant, client, email: me.data.email, refreshToken: tokens.refresh_token });
      const web = String(process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in').replace(/\/$/, '');
      const params = new URLSearchParams({ merchant_id: String(merchant._id), merchant_verified: result.verified ? '1' : '0', merchant_message: result.message || '' });
      return res.redirect(`${web}/?${params.toString()}#merchant-verification`);
    }

    // Only the dedicated administrator Gmail-connect flow requires administrator privileges.
    // Merchant verification above is intentionally authenticated by the signed OAuth state.
    const admin = await (await import('../models/User.js')).default.findOne({ _id: payload.sub, role: 'admin', status: 'active' });
    if (!admin) return res.status(403).send('Administrator accounts must use administrator login.');
    await GmailConnection.findOneAndUpdate(
      { owner: payload.sub },
      { owner: payload.sub, email: me.data.email, refreshTokenEncrypted: encryptSecret(tokens.refresh_token), active: true },
      { upsert: true, new: true }
    );
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
    res.json({ status: true, connected: !!connection, email: connection?.email || null, lastCheckedAt: connection?.lastCheckedAt || null });
  } catch (error) { next(error); }
});

export default router;
