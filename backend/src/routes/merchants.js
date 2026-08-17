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

router.get('/:merchantId/checkout', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub }).lean();
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    res.json({ status: true, merchantId: merchant._id, checkout: merchant.config?.checkout || {} });
  } catch (error) { next(error); }
});

router.put('/:merchantId/checkout', async (req, res, next) => {
  try {
    const merchant = await Merchant.findOne({ _id: req.params.merchantId, owner: req.auth.sub });
    if (!merchant) return res.status(404).json({ status: false, message: 'Merchant not found' });
    const body = req.body || {};
    const checkout = {
      brandName: String(body.brandName || merchant.name).trim().slice(0, 100),
      themeColor: /^#[0-9a-fA-F]{6}$/.test(String(body.themeColor || '')) ? String(body.themeColor) : '#0B95BD',
      instructions: String(body.instructions || '').slice(0, 3000),
      showQrCode: body.showQrCode !== false,
      showIntentButtons: body.showIntentButtons !== false,
      brandLogo: typeof body.brandLogo === 'string' && body.brandLogo.length <= 1500000 ? body.brandLogo : ''
    };
    merchant.config = { ...(merchant.config || {}), checkout };
    await merchant.save();
    res.json({ status: true, checkout });
  } catch (error) { next(error); }
});

export default router;
