import { Router } from 'express';
import Merchant from '../models/Merchant.js';
import { requireAuth } from '../middleware/auth.js';
import { requireKycIfEnabled } from '../middleware/kyc.js';

const router = Router();
router.use(requireAuth, requireKycIfEnabled);

router.get('/', async (req, res, next) => {
  try {
    const merchants = await Merchant.find({ owner: req.auth.sub }).sort({ createdAt: -1 });
    res.json({ status: true, merchants });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, provider, upiId, mobile, externalMerchantId, config } = req.body;
    if (!name || !provider) return res.status(400).json({ status: false, message: 'name and provider are required' });
    const merchant = await Merchant.create({ owner: req.auth.sub, name, provider, upiId, mobile, externalMerchantId, config });
    res.status(201).json({ status: true, merchant });
  } catch (error) { next(error); }
});

export default router;
