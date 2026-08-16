import { Router } from 'express';
import Plan from '../models/Plan.js';
import GatewaySettings from '../models/GatewaySettings.js';
import KycOrder from '../models/KycOrder.js';
import User from '../models/User.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { decryptSecret } from '../utils/secretBox.js';

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
    const allowed = ['settlementUpiId', 'settlementName', 'subscriptionUpiId', 'subscriptionUpiName', 'subscriptionPaymentLink', 'kycRequired', 'kycFee', 'kycUpiId', 'kycUpiName', 'showPanField', 'showAadhaarField', 'defaultTransactionFeePercent', 'gmailPaymentVerificationEnabled', 'gmailSearchQuery', 'paymentVerificationMode', 'feeSettlementMode'];
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
    const { name, price, durationDays, transactionLimit, merchantLimit, apiAccess, transactionFeePercent, features, active, popular } = req.body;
    if (!name || Number(price) < 0 || Number(durationDays) < 1) return res.status(400).json({ status: false, message: 'name, price and durationDays are required' });
    const plan = await Plan.create({ name, price, durationDays, transactionLimit, merchantLimit, apiAccess, transactionFeePercent, features, active, popular });
    res.status(201).json({ status: true, plan });
  } catch (error) { next(error); }
});

router.put('/plans/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'price', 'durationDays', 'transactionLimit', 'merchantLimit', 'apiAccess', 'transactionFeePercent', 'features', 'active', 'popular'];
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

router.get('/kyc', async (_req, res, next) => {
  try {
    const requests = await KycOrder.find({ status: 'SUBMITTED' }).sort({ submittedAt: 1 }).populate('user', 'name email mobile companyName kycStatus').select('+aadhaarNumberEncrypted +aadhaarNameEncrypted +aadhaarFrontEncrypted +aadhaarBackEncrypted +panNumberEncrypted +panNameEncrypted +panFrontEncrypted +panBackEncrypted');
    const result = requests.map(r => ({ id: r._id, orderId: r.orderId, amount: r.amount, status: r.status, submittedAt: r.submittedAt, paidAt: r.paidAt, user: r.user, aadhaar: { number: decryptSecret(r.aadhaarNumberEncrypted), name: decryptSecret(r.aadhaarNameEncrypted), front: decryptSecret(r.aadhaarFrontEncrypted), back: decryptSecret(r.aadhaarBackEncrypted) }, pan: { number: decryptSecret(r.panNumberEncrypted), name: decryptSecret(r.panNameEncrypted), front: decryptSecret(r.panFrontEncrypted), back: decryptSecret(r.panBackEncrypted) } }));
    res.json({ status: true, requests: result });
  } catch (error) { next(error); }
});

router.post('/kyc/:id/verify', async (req, res, next) => {
  try {
    const request = await KycOrder.findById(req.params.id);
    if (!request) return res.status(404).json({ status: false, message: 'KYC request not found' });
    request.status = 'VERIFIED'; request.verifiedAt = new Date(); request.rejectionReason = '';
    await request.save();
    await User.findByIdAndUpdate(request.user, { kycStatus: 'VERIFIED', kycVerifiedAt: request.verifiedAt });
    res.json({ status: true, message: 'KYC verified successfully', verifiedAt: request.verifiedAt });
  } catch (error) { next(error); }
});

router.post('/kyc/:id/reject', async (req, res, next) => {
  try {
    const request = await KycOrder.findById(req.params.id);
    if (!request) return res.status(404).json({ status: false, message: 'KYC request not found' });
    request.status = 'REJECTED'; request.rejectedAt = new Date(); request.rejectionReason = String(req.body.reason || 'Documents could not be verified').slice(0, 500);
    await request.save();
    await User.findByIdAndUpdate(request.user, { kycStatus: 'REJECTED' });
    res.json({ status: true, message: 'KYC rejected' });
  } catch (error) { next(error); }
});

export default router;
