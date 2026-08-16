import { Router } from 'express';
import Plan from '../models/Plan.js';
import GatewaySettings from '../models/GatewaySettings.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await GatewaySettings.findOneAndUpdate({ key: 'global' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ status: true, settings });
  } catch (error) { next(error); }
});

router.put('/settings', async (req, res, next) => {
  try {
    const allowed = ['settlementUpiId', 'settlementName', 'defaultTransactionFeePercent', 'gmailPaymentVerificationEnabled', 'gmailSearchQuery', 'paymentVerificationMode', 'feeSettlementMode'];
    const patch = Object.fromEntries(allowed.filter((key) => key in req.body).map((key) => [key, req.body[key]]));
    const settings = await GatewaySettings.findOneAndUpdate({ key: 'global' }, patch, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ status: true, settings });
  } catch (error) { next(error); }
});

router.get('/plans', async (_req, res, next) => {
  try { res.json({ status: true, plans: await Plan.find().sort({ price: 1 }) }); }
  catch (error) { next(error); }
});

router.post('/plans', async (req, res, next) => {
  try {
    const { name, price, durationDays, transactionLimit, merchantLimit, apiAccess, transactionFeePercent, features, active } = req.body;
    if (!name || Number(price) < 0 || Number(durationDays) < 1) return res.status(400).json({ status: false, message: 'name, price and durationDays are required' });
    const plan = await Plan.create({ name, price, durationDays, transactionLimit, merchantLimit, apiAccess, transactionFeePercent, features, active });
    res.status(201).json({ status: true, plan });
  } catch (error) { next(error); }
});

router.put('/plans/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'price', 'durationDays', 'transactionLimit', 'merchantLimit', 'apiAccess', 'transactionFeePercent', 'features', 'active'];
    const patch = Object.fromEntries(allowed.filter((key) => key in req.body).map((key) => [key, req.body[key]]));
    const plan = await Plan.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ status: false, message: 'Plan not found' });
    res.json({ status: true, plan });
  } catch (error) { next(error); }
});

router.delete('/plans/:id', async (req, res, next) => {
  try { await Plan.findByIdAndDelete(req.params.id); res.json({ status: true }); }
  catch (error) { next(error); }
});

export default router;
