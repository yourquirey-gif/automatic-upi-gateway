import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import KycConfig from '../models/KycConfig.js';
import { requireAuth } from '../middleware/auth.js';
import { nextUserId } from '../utils/userId.js';

const router = Router();
router.use(requireAuth);

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

export default router;
