import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import KycConfig from '../models/KycConfig.js';
import WebhookDelivery from '../models/WebhookDelivery.js';
import { requireAuth } from '../middleware/auth.js';
import { nextUserId } from '../utils/userId.js';
import { newApiToken, newInstanceSecret, hashCredential, encryptCredential, maskCredential } from '../utils/credentialVault.js';
import { sendTestWebhook } from '../services/merchantWebhook.js';

const router = Router();
router.use(requireAuth);

async function ensureApiCredentials(user) {
  let changed = false;
  if (!user.userId) { user.userId = await nextUserId(); changed = true; }
  if (!user.apiTokenHash) {
    const token = user.apiToken || newApiToken();
    user.apiTokenHash = hashCredential(token);
    user.apiTokenEncrypted = encryptCredential(token);
    user.apiToken = undefined;
    changed = true;
  }
  if (!user.instanceSecretEncrypted) {
    const secret = user.instanceSecret || newInstanceSecret();
    user.instanceSecretEncrypted = encryptCredential(secret);
    user.instanceSecret = undefined;
    changed = true;
  }
  if (changed) await user.save({ validateBeforeSave: false });
  return user;
}

router.get('/', async (req, res, next) => {
  try {
    let user = await User.findById(req.auth.sub).select('-passwordHash');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    if (!user.userId) { const generatedUserId = await nextUserId(); try { user = await User.findOneAndUpdate({ _id: user._id, $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }] }, { $set: { userId: generatedUserId } }, { new: true, runValidators: true }).select('-passwordHash'); } catch (error) { if (error?.code !== 11000) throw error; user = await User.findById(req.auth.sub).select('-passwordHash'); } }
    const config = await KycConfig.findOneAndUpdate({ key: 'global' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ status: true, user, settings: { showPanField: config?.panField !== false, showAadhaarField: config?.aadhaarField !== false, kycEnabled: !!config?.enabled, kycRequired: !!config?.required, kycFee: Number(config?.price ?? 50) } });
  } catch (error) { next(error); }
});

router.put('/', async (req, res, next) => { try { const allowed = ['name', 'mobile', 'companyName', 'panNumber', 'aadhaarNumber', 'location', 'whitelistedIps']; const patch = Object.fromEntries(allowed.filter(k => k in req.body).map(k => [k, req.body[k]])); const user = await User.findByIdAndUpdate(req.auth.sub, patch, { new: true, runValidators: true }).select('-passwordHash'); res.json({ status: true, user }); } catch (error) { next(error); } });

router.put('/password', async (req, res, next) => {
  try { const currentPassword = String(req.body?.currentPassword || ''), newPassword = String(req.body?.newPassword || ''); if (!currentPassword || !newPassword) return res.status(400).json({ status: false, message: 'Current password and new password are required' }); if (newPassword.length < 8) return res.status(400).json({ status: false, message: 'New password must be at least 8 characters' }); const user = await User.findById(req.auth.sub).select('+passwordHash'); if (!user) return res.status(404).json({ status: false, message: 'User not found' }); if (!(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(401).json({ status: false, message: 'Current password is incorrect' }); if (await bcrypt.compare(newPassword, user.passwordHash)) return res.status(400).json({ status: false, message: 'New password must be different from the current password' }); user.passwordHash = await bcrypt.hash(newPassword, 12); await user.save(); res.json({ status: true, message: 'Password changed successfully' }); } catch (error) { next(error); }
});

router.get('/api', async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub).select('+apiTokenHash +apiTokenEncrypted +apiToken +instanceSecretEncrypted +instanceSecret webhookUrl userId role');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    await ensureApiCredentials(user);
    // Existing credentials are never returned in plaintext. A regeneration
    // response is the only place a new secret is revealed to the authenticated owner.
    res.json({ status: true, credentials: { userId: user.userId || null, apiToken: maskCredential(user.apiTokenEncrypted ? 'configured' : user.apiTokenHash), instanceSecret: maskCredential(user.instanceSecretEncrypted ? 'configured' : 'configured'), webhookUrl: user.webhookUrl || '' } });
  } catch (error) { next(error); }
});

router.put('/api/webhook', async (req, res, next) => { try { const webhookUrl = String(req.body?.webhookUrl || '').trim(); if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) return res.status(400).json({ status: false, message: 'Webhook URL must include http or https' }); const user = await User.findByIdAndUpdate(req.auth.sub, { $set: { webhookUrl } }, { new: true, runValidators: true }); if (!user) return res.status(404).json({ status: false, message: 'User not found' }); res.json({ status: true, message: 'Webhook updated successfully', webhookUrl: user.webhookUrl || '' }); } catch (error) { next(error); } });

router.post('/api/regenerate', async (req, res, next) => {
  try {
    const type = String(req.body?.type || '').toLowerCase(); if (!['token', 'secret'].includes(type)) return res.status(400).json({ status: false, message: 'Invalid credential type' });
    const user = await User.findById(req.auth.sub).select('+apiTokenHash +apiTokenEncrypted +apiToken +instanceSecretEncrypted +instanceSecret userId'); if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    const generated = type === 'token' ? newApiToken() : newInstanceSecret();
    if (type === 'token') { user.apiTokenHash = hashCredential(generated); user.apiTokenEncrypted = encryptCredential(generated); user.apiToken = undefined; }
    else { user.instanceSecretEncrypted = encryptCredential(generated); user.instanceSecret = undefined; }
    await user.save({ validateBeforeSave: false });
    res.json({ status: true, message: type === 'token' ? 'API token regenerated successfully' : 'Instance secret regenerated successfully', credentials: { userId: user.userId || null, ...(type === 'token' ? { apiToken: generated } : { instanceSecret: generated }) } });
  } catch (error) { next(error); }
});

router.post('/api/test-webhook', async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub).select('_id role status webhookUrl +instanceSecretEncrypted +instanceSecret');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    const result = await sendTestWebhook(user);
    res.status(result.statusCode && !result.success ? 502 : 200).json({ status: result.success, result });
  } catch (error) { const status = error.code === 'WEBHOOK_URL_MISSING' ? 400 : 500; res.status(status).json({ status: false, message: error.code === 'WEBHOOK_URL_MISSING' ? error.message : 'Webhook test could not be completed.' }); }
});

router.get('/api/webhook/logs', async (req, res, next) => { try { const logs = await WebhookDelivery.find({ owner: req.auth.sub }).select('event orderId deliveredAt httpStatus success retryStatus errorReason responseTimeMs').sort({ deliveredAt: -1 }).limit(100).lean(); res.json({ status: true, logs }); } catch (error) { next(error); } });

export default router;
