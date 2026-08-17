import { Router } from 'express';
import jwt from 'jsonwebtoken';
import GmailConnection from '../models/GmailConnection.js';
import Merchant from '../models/Merchant.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createGoogleClient, verifyMerchantGmail, verifyPendingOrdersForAdmin } from '../services/gmailPaymentVerifier.js';
import { encryptSecret } from '../utils/secretBox.js';

const router = Router();

router.get('/connect', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const client = createGoogleClient();
    const state = jwt.sign({ sub: req.auth.sub, purpose: 'gmail-connect' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', state, scope: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] });
    res.json({ status: true, url });
  } catch (error) { next(error); }
});

router.get('/callback', async (req, res, next) => {
  try {
    const payload = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    const client = createGoogleClient();
    const { tokens } = await client.getToken(String(req.query.code || ''));
    if (!tokens.refresh_token) return res.status(400).send('<h2>Gmail verification failed</h2><p>Google did not return a refresh token. Please reconnect with consent.</p>');
    client.setCredentials(tokens);
    const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();

    if (payload.purpose === 'merchant-gmail-verify' && payload.merchantId) {
      const merchant = await Merchant.findOne({ _id: payload.merchantId, owner: payload.sub });
      if (!merchant) return res.status(404).send('<h2>Merchant not found</h2>');
      const result = await verifyMerchantGmail({ merchant, client, email: me.data.email, refreshToken: tokens.refresh_token });
      if (!result.verified) {
        return res.type('html').send(`<!doctype html><html><body style="font-family:Arial;padding:32px;max-width:620px;margin:auto"><h2>Merchant verification pending</h2><p>${result.message}</p><p>Please use the Gmail account linked with this merchant/payment account, then try Verify Merchant again.</p><script>setTimeout(()=>window.close(),7000)</script></body></html>`);
      }
      return res.type('html').send('<!doctype html><html><body style="font-family:Arial;padding:32px;text-align:center"><h2 style="color:#159b77">✓ Merchant Verified</h2><p>Gmail is securely connected and the merchant is now Verified / Active.</p><script>setTimeout(()=>window.close(),1800)</script></body></html>');
    }

    if (payload.purpose !== 'gmail-connect') return res.status(400).send('Invalid OAuth state');
    if (!tokens.refresh_token) return res.status(400).send('Google did not return a refresh token. Reconnect with consent.');
    await GmailConnection.findOneAndUpdate(
      { owner: payload.sub },
      { owner: payload.sub, email: me.data.email, refreshTokenEncrypted: encryptSecret(tokens.refresh_token), active: true },
      { upsert: true, new: true }
    );
    res.send('<h2>Gmail connected</h2><p>You can close this window and return to OmniUPI Admin.</p>');
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
