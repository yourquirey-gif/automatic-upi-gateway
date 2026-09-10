import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { nextUserId } from '../utils/userId.js';
import { newApiToken, newInstanceSecret, hashCredential, encryptCredential, maskCredential } from '../utils/credentialVault.js';

const router = Router();
router.use(requireAuth, requireAdmin);
const publicApi = () => String(process.env.PUBLIC_API_BASE_URL || 'https://api.omniupi.in/api').replace(/\/$/, '');
const docsUrl = () => String(process.env.PUBLIC_DOCS_URL || 'https://omniupi.in/docs').trim();

async function ensureCredentials(admin) {
  let changed = false;
  if (!admin.userId) { admin.userId = await nextUserId(); changed = true; }
  if (!admin.apiTokenHash) { const token = admin.apiToken || newApiToken(); admin.apiTokenHash = hashCredential(token); admin.apiTokenEncrypted = encryptCredential(token); admin.apiToken = undefined; changed = true; }
  if (!admin.instanceSecretEncrypted) { const secret = admin.instanceSecret || newInstanceSecret(); admin.instanceSecretEncrypted = encryptCredential(secret); admin.instanceSecret = undefined; changed = true; }
  if (changed) await admin.save({ validateBeforeSave: false });
  return admin;
}

function response(admin) { return { userId: admin.userId, apiToken: maskCredential(admin.apiTokenHash || 'configured'), instanceSecret: maskCredential(admin.instanceSecretEncrypted || 'configured'), webhookUrl: admin.webhookUrl || '', apiBaseUrl: publicApi(), docsUrl: docsUrl(), role: 'admin' }; }

router.get('/credentials', async (req, res, next) => { try { const admin = await User.findOne({ _id: req.auth.sub, role: 'admin', status: 'active' }).select('+apiTokenHash +apiTokenEncrypted +apiToken +instanceSecretEncrypted +instanceSecret userId webhookUrl'); if (!admin) return res.status(404).json({ status: false, message: 'Administrator account not found.' }); await ensureCredentials(admin); return res.json({ status: true, credentials: response(admin) }); } catch (error) { next(error); } });

router.post('/credentials/regenerate', async (req, res, next) => {
  try {
    const type = String(req.body?.type || 'both').toLowerCase(); if (!['token', 'secret', 'both'].includes(type)) return res.status(400).json({ status: false, message: 'Invalid credential type.' });
    const admin = await User.findOne({ _id: req.auth.sub, role: 'admin', status: 'active' }).select('+apiTokenHash +apiTokenEncrypted +apiToken +instanceSecretEncrypted +instanceSecret userId webhookUrl'); if (!admin) return res.status(404).json({ status: false, message: 'Administrator account not found.' });
    await ensureCredentials(admin);
    const credentials = { userId: admin.userId };
    if (type === 'token' || type === 'both') { const token = newApiToken(); admin.apiTokenHash = hashCredential(token); admin.apiTokenEncrypted = encryptCredential(token); admin.apiToken = undefined; credentials.apiToken = token; }
    if (type === 'secret' || type === 'both') { const secret = newInstanceSecret(); admin.instanceSecretEncrypted = encryptCredential(secret); admin.instanceSecret = undefined; credentials.instanceSecret = secret; }
    await admin.save({ validateBeforeSave: false });
    return res.json({ status: true, message: 'Admin API credentials regenerated successfully. New values are shown only once.', credentials });
  } catch (error) { next(error); }
});

export default router;
