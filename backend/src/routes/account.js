import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import KycConfig from '../models/KycConfig.js';
import { requireAuth } from '../middleware/auth.js';
import { nextUserId } from '../utils/userId.js';

const router = Router();
router.use(requireAuth);

function newApiToken() {
  return `ag_live_${crypto.randomBytes(32).toString('hex')}`;
}

function newInstanceSecret() {
  return `ag_sec_${crypto.randomBytes(32).toString('hex')}`;
}

async function ensureApiCredentials(user) {
  let changed = false;
  if (!user.apiToken) {
    user.apiToken = newApiToken();
    changed = true;
  }
  if (!user.instanceSecret) {
    user.instanceSecret = newInstanceSecret();
    changed = true;
  }
  if (changed) await user.save({ validateBeforeSave: false });
  return user;
}

router.get('/', async (req, res, next) => {
  try {
    let user = await User.findById(req.auth.sub).select('-passwordHash');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });

    if (!user.userId) {
      const generatedUserId = await nextUserId();
      try {
        user = await User.findOneAndUpdate(
          { _id: user._id, $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }] },
          { $set: { userId: generatedUserId } },
          { new: true, runValidators: true }
        ).select('-passwordHash');
      } catch (error) {
        if (error?.code !== 11000) throw error;
        user = await User.findById(req.auth.sub).select('-passwordHash');
      }
    }

    const config = await KycConfig.findOneAndUpdate(
      { key: 'global' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      status: true,
      user,
      settings: {
        showPanField: config?.panField !== false,
        showAadhaarField: config?.aadhaarField !== false,
        kycEnabled: !!config?.enabled,
        kycRequired: !!config?.required,
        kycFee: Number(config?.price ?? 50)
      }
    });
  } catch (error) { next(error); }
});

router.put('/', async (req, res, next) => {
  try {
    const allowed = ['name', 'mobile', 'companyName', 'panNumber', 'aadhaarNumber', 'location', 'whitelistedIps'];
    const patch = Object.fromEntries(allowed.filter(k => k in req.body).map(k => [k, req.body[k]]));
    const user = await User.findByIdAndUpdate(req.auth.sub, patch, { new: true, runValidators: true }).select('-passwordHash');
    res.json({ status: true, user });
  } catch (error) { next(error); }
});

router.put('/password', async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: false, message: 'Current password and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ status: false, message: 'New password must be at least 8 characters' });
    }
    const user = await User.findById(req.auth.sub).select('+passwordHash');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) return res.status(401).json({ status: false, message: 'Current password is incorrect' });
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return res.status(400).json({ status: false, message: 'New password must be different from the current password' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ status: true, message: 'Password changed successfully' });
  } catch (error) { next(error); }
});

// Developer credentials are isolated per authenticated merchant.
router.get('/api', async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.sub).select('+apiToken +instanceSecret webhookUrl userId');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    await ensureApiCredentials(user);
    res.json({
      status: true,
      credentials: {
        userId: user.userId || null,
        apiToken: user.apiToken,
        instanceSecret: user.instanceSecret,
        webhookUrl: user.webhookUrl || ''
      }
    });
  } catch (error) { next(error); }
});

router.put('/api/webhook', async (req, res, next) => {
  try {
    const webhookUrl = String(req.body?.webhookUrl || '').trim();
    if (webhookUrl && !/^https?:\/\//i.test(webhookUrl)) {
      return res.status(400).json({ status: false, message: 'Webhook URL must include http or https' });
    }
    const user = await User.findByIdAndUpdate(
      req.auth.sub,
      { $set: { webhookUrl } },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    res.json({ status: true, message: 'Webhook updated successfully', webhookUrl: user.webhookUrl || '' });
  } catch (error) { next(error); }
});

router.post('/api/regenerate', async (req, res, next) => {
  try {
    const type = String(req.body?.type || '').toLowerCase();
    if (!['token', 'secret'].includes(type)) {
      return res.status(400).json({ status: false, message: 'Invalid credential type' });
    }
    const user = await User.findById(req.auth.sub).select('+apiToken +instanceSecret userId');
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });
    if (type === 'token') user.apiToken = newApiToken();
    else user.instanceSecret = newInstanceSecret();
    await user.save({ validateBeforeSave: false });
    res.json({
      status: true,
      message: type === 'token' ? 'API token regenerated successfully' : 'Instance secret regenerated successfully',
      credentials: {
        userId: user.userId || null,
        apiToken: user.apiToken,
        instanceSecret: user.instanceSecret
      }
    });
  } catch (error) { next(error); }
});

export default router;
