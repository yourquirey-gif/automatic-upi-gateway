import { Router } from 'express';
import User from '../models/User.js';
import GatewaySettings from '../models/GatewaySettings.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [user, settings] = await Promise.all([
      User.findById(req.auth.sub).select('-passwordHash'),
      GatewaySettings.findOne({ key: 'global' })
    ]);
    res.json({
      status: true,
      user,
      settings: {
        kycRequired: !!settings?.kycRequired,
        kycFee: Number(settings?.kycFee ?? 50),
        showPanField: settings?.showPanField !== false,
        showAadhaarField: settings?.showAadhaarField !== false
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
