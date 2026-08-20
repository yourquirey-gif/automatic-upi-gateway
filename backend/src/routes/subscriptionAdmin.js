import { Router } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

router.patch('/users/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ status: false, message: 'Invalid user ID' });
    }

    const user = await User.findOne({ _id: req.params.id, role: 'merchant' });
    if (!user) return res.status(404).json({ status: false, message: 'User not found' });

    const now = new Date();
    const hasPlanId = Object.prototype.hasOwnProperty.call(req.body || {}, 'planId');
    const hasExpiry = Object.prototype.hasOwnProperty.call(req.body || {}, 'expiresAt');
    const hasDays = Object.prototype.hasOwnProperty.call(req.body || {}, 'days');

    if (hasPlanId) {
      const rawPlanId = req.body.planId;
      if (rawPlanId === null || rawPlanId === '') {
        user.plan = null;
        user.planStartedAt = null;
        user.planExpiresAt = null;
        user.planStatus = 'NONE';
      } else {
        if (!mongoose.isValidObjectId(rawPlanId)) {
          return res.status(400).json({ status: false, message: 'Invalid plan ID' });
        }
        const plan = await Plan.findOne({ _id: rawPlanId, active: true });
        if (!plan) return res.status(404).json({ status: false, message: 'Plan not found or inactive' });

        user.plan = plan._id;
        user.planStartedAt = user.planStartedAt && user.planStatus === 'ACTIVE' ? user.planStartedAt : now;
        user.trialStartedAt = null;
        user.trialEndsAt = null;

        if (!hasExpiry && !hasDays) {
          user.planExpiresAt = new Date(now.getTime() + Number(plan.durationDays) * 86400000);
        }
        user.planStatus = 'ACTIVE';
      }
    }

    if (hasExpiry) {
      const expiresAt = validDate(req.body.expiresAt);
      if (!expiresAt) return res.status(400).json({ status: false, message: 'Invalid subscription expiry date' });
      if (!user.plan) return res.status(400).json({ status: false, message: 'Select a subscription plan first' });
      user.planExpiresAt = expiresAt;
    }

    if (hasDays) {
      const days = Number(req.body.days);
      if (!Number.isFinite(days) || !Number.isInteger(days) || days < -3650 || days > 3650) {
        return res.status(400).json({ status: false, message: 'Days must be an integer between -3650 and 3650' });
      }
      if (!user.plan) return res.status(400).json({ status: false, message: 'Select a subscription plan first' });
      const currentExpiry = user.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
      user.planExpiresAt = new Date(currentExpiry.getTime() + days * 86400000);
    }

    if (user.plan) {
      user.planStatus = user.planExpiresAt && user.planExpiresAt > now ? 'ACTIVE' : 'EXPIRED';
    }

    await user.save({ validateBeforeSave: true });
    const updated = await User.findById(user._id)
      .select('-passwordHash -apiToken -instanceSecret')
      .populate('plan', 'name price durationDays transactionFeePercent features')
      .lean();

    return res.json({ status: true, message: 'Subscription updated successfully', user: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
