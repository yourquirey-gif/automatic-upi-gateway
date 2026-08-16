import { Router } from 'express';
import jwt from 'jsonwebtoken';
import GmailConnection from '../models/GmailConnection.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createGoogleClient, verifyPendingOrdersForAdmin } from '../services/gmailPaymentVerifier.js';
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
    if (payload.purpose !== 'gmail-connect') return res.status(400).send('Invalid OAuth state');
    const client = createGoogleClient();
    const { tokens } = await client.getToken(String(req.query.code || ''));
    if (!tokens.refresh_token) return res.status(400).send('Google did not return a refresh token. Reconnect with consent.');
    client.setCredentials(tokens);
    const oauth2 = (await import('googleapis')).google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    await GmailConnection.findOneAndUpdate(
      { owner: payload.sub },
      { owner: payload.sub, email: me.data.email, refreshTokenEncrypted: encryptSecret(tokens.refresh_token), active: true },
      { upsert: true, new: true }
    );
    res.send('<h2>Gmail connected</h2><p>You can close this window and return to AutoGateway Admin.</p>');
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
