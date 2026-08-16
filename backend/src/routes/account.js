import { Router } from 'express';
import User from '../models/User.js';
import KycConfig from '../models/KycConfig.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [user, config] = await Promise.all([
      User.findById(req.auth.sub).select('-passwordHash'),
      KycConfig.findOneAndUpdate(
        { key: 'global' },
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    ]);

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

export default router;
