import { Router } from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { nextUserId } from '../utils/userId.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const newApiToken = () => `ag_live_${crypto.randomBytes(32).toString('hex')}`;
const newInstanceSecret = () => `ag_sec_${crypto.randomBytes(32).toString('hex')}`;
const publicApi = () => String(process.env.PUBLIC_API_BASE_URL || 'https://api.omniupi.in/api').replace(/\/$/, '');
const docsUrl = () => String(process.env.PUBLIC_DOCS_URL || 'https://omniupi.in/docs').trim();

async function ensureCredentials(admin) {
  let changed = false;
  if (!admin.userId) {
    admin.userId = await nextUserId();
    changed = true;
  }
  if (!admin.apiToken) {
    admin.apiToken = newApiToken();
    changed = true;
  }
  if (!admin.instanceSecret) {
    admin.instanceSecret = newInstanceSecret();
    changed = true;
  }
  if (changed) await admin.save({ validateBeforeSave: false });
  return admin;
}

function response(admin) {
  return {
    userId: admin.userId,
    apiToken: admin.apiToken,
    instanceSecret: admin.instanceSecret,
    webhookUrl: admin.webhookUrl || '',
    apiBaseUrl: publicApi(),
    docsUrl: docsUrl(),
    role: 'admin'
  };
}

router.get('/credentials', async (req, res, next) => {
  try {
    const admin = await User.findOne({ _id: req.auth.sub, role: 'admin', status: 'active' }).select('+apiToken +instanceSecret userId webhookUrl');
    if (!admin) return res.status(404).json({ status: false, message: 'Administrator account not found.' });
    await ensureCredentials(admin);
    return res.json({ status: true, credentials: response(admin) });
  } catch (error) { next(error); }
});

router.post('/credentials/regenerate', async (req, res, next) => {
  try {
    const type = String(req.body?.type || 'both').toLowerCase();
    if (!['token', 'secret', 'both'].includes(type)) return res.status(400).json({ status: false, message: 'Invalid credential type.' });
    const admin = await User.findOne({ _id: req.auth.sub, role: 'admin', status: 'active' }).select('+apiToken +instanceSecret userId webhookUrl');
    if (!admin) return res.status(404).json({ status: false, message: 'Administrator account not found.' });
    await ensureCredentials(admin);
    if (type === 'token' || type === 'both') admin.apiToken = newApiToken();
    if (type === 'secret' || type === 'both') admin.instanceSecret = newInstanceSecret();
    await admin.save({ validateBeforeSave: false });
    return res.json({ status: true, message: 'Admin API credentials regenerated successfully.', credentials: response(admin) });
  } catch (error) { next(error); }
});

export default router;
