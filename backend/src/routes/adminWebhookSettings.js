import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.delete('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.auth.sub, role: 'admin', status: 'active' });
    if (!user) return res.status(403).json({ status: false, message: 'Administrator access required' });
    user.webhookUrl = '';
    await user.save({ validateBeforeSave: false });
    return res.json({ status: true, message: 'Webhook URL deleted successfully', webhookUrl: '' });
  } catch (error) {
    next(error);
  }
});

export default router;
