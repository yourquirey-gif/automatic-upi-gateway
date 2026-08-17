import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { google } from 'googleapis';
import User from '../models/User.js';
import GatewaySettings from '../models/GatewaySettings.js';
import { nextUserId } from '../utils/userId.js';
import { decryptSecret } from '../utils/secretBox.js';

const router = Router();

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ sub: user._id.toString(), role: user.role }, secret, { expiresIn: '7d' });
}

function trialDates() {
  const started = new Date();
  const ends = new Date(started.getTime() + 2 * 24 * 60 * 60 * 1000);
  return { started, ends };
}

function createApiCredentials() {
  return {
    apiToken: `ag_live_${crypto.randomBytes(32).toString('hex')}`,
    instanceSecret: `ag_sec_${crypto.randomBytes(32).toString('hex')}`
  };
}

async function googleConfig() {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
  const clientId = String(settings?.googleClientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = settings?.googleClientSecretEncrypted ? decryptSecret(settings.googleClientSecretEncrypted) : String(process.env.GOOGLE_CLIENT_SECRET || '');
  const redirectUri = String(settings?.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI || `${process.env.PUBLIC_API_BASE_URL || 'https://api.omniupi.in'}/api/v1/auth/google/callback`).trim();
  return { enabled: settings?.googleOAuthEnabled === true && !!clientId && !!clientSecret, clientId, clientSecret, redirectUri };
}

function googleClient(config) {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

router.get('/google/config', async (_req, res, next) => {
  try {
    const config = await googleConfig();
    res.json({ status: true, enabled: config.enabled });
  } catch (error) { next(error); }
});

router.get('/google', async (_req, res, next) => {
  try {
    const config = await googleConfig();
    if (!config.enabled) return res.status(404).send('Google sign-up is currently disabled.');
    const client = googleClient(config);
    const state = jwt.sign({ purpose: 'merchant-google-signup' }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'select_account', state, scope: ['openid', 'email', 'profile'] });
    res.redirect(url);
  } catch (error) { next(error); }
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const payload = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (payload.purpose !== 'merchant-google-signup') return res.status(400).send('Invalid OAuth state');
    const config = await googleConfig();
    if (!config.enabled) return res.status(503).send('Google sign-up is disabled.');
    const client = googleClient(config);
    const { tokens } = await client.getToken(String(req.query.code || ''));
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const profile = await oauth2.userinfo.get();
    const email = String(profile.data.email || '').trim().toLowerCase();
    const googleId = String(profile.data.id || '').trim();
    const name = String(profile.data.name || email.split('@')[0] || 'Merchant').trim();
    if (!email || !googleId) return res.status(400).send('Google account did not provide a verified email.');

    let user = await User.findOne({ $or: [{ email }, { googleId }] }).select('+passwordHash');
    if (user?.role === 'admin') return res.status(403).send('Administrator accounts must use administrator login.');
    if (user) {
      if (user.status !== 'active') return res.status(403).send('This account is suspended.');
      user.googleId = googleId;
      user.authProvider = 'google';
      await user.save({ validateBeforeSave: false });
    } else {
      const { started, ends } = trialDates();
      const userId = await nextUserId();
      const { apiToken, instanceSecret } = createApiCredentials();
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      user = await User.create({ name, email, passwordHash, authProvider: 'google', googleId, userId, apiToken, instanceSecret, webhookUrl: '', trialStartedAt: started, trialEndsAt: ends });
    }
    const token = signToken(user);
    const destination = `${process.env.PUBLIC_WEB_BASE_URL || 'https://omniupi.in'}/#oauth?token=${encodeURIComponent(token)}`;
    res.redirect(destination);
  } catch (error) { next(error); }
});

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8) {
      return res.status(400).json({ status: false, message: 'Name, valid email and password of at least 8 characters are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ status: false, message: 'Email is already registered' });
    const passwordHash = await bcrypt.hash(password, 12);
    const { started, ends } = trialDates();
    const userId = await nextUserId();
    const { apiToken, instanceSecret } = createApiCredentials();
    const user = await User.create({ userId, name: name.trim(), email: normalizedEmail, passwordHash, authProvider: 'password', apiToken, instanceSecret, webhookUrl: '', trialStartedAt: started, trialEndsAt: ends });
    const token = signToken(user);
    res.status(201).json({ status: true, token, trial: { active: true, startedAt: started, endsAt: ends, durationDays: 2 }, user: { id: user._id, userId: user.userId, name: user.name, email: user.email, role: user.role } });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() }).select('+passwordHash');
    if (!user || user.status !== 'active' || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ status: false, message: 'Invalid email or password' });
    }
    const token = signToken(user);
    if (user.role === 'admin') {
      return res.json({ status: true, token, trial: { active: false, endsAt: null }, subscription: { required: false, active: true, permanent: true }, user: { id: user._id, userId: user.userId || null, name: user.name, email: user.email, role: 'admin' } });
    }
    const trialActive = !!user.trialEndsAt && user.trialEndsAt.getTime() > Date.now() && !user.plan;
    res.json({ status: true, token, trial: { active: trialActive, endsAt: user.trialEndsAt }, subscription: { required: true, active: !!user.plan && user.planStatus === 'ACTIVE', permanent: false }, user: { id: user._id, userId: user.userId || null, name: user.name, email: user.email, role: user.role } });
  } catch (error) { next(error); }
});

export default router;
