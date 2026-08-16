import { Router } from 'express';
import Merchant from '../models/Merchant.js';

const router = Router();

// Temporary development identity. Replace with authenticated user middleware before production.
function ownerId(req) {
  return req.header('x-development-user-id') || null;
}

router.get('/', async (req, res, next) => {
  try {
    const owner = ownerId(req);
    if (!owner) return res.status(401).json({ status: false, message: 'Authentication required' });
    const merchants = await Merchant.find({ owner }).sort({ createdAt: -1 });
    res.json({ status: true, merchants });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const owner = ownerId(req);
    if (!owner) return res.status(401).json({ status: false, message: 'Authentication required' });
    const { name, provider, upiId, mobile, externalMerchantId, config } = req.body;
    if (!name || !provider) return res.status(400).json({ status: false, message: 'name and provider are required' });
    const merchant = await Merchant.create({ owner, name, provider, upiId, mobile, externalMerchantId, config });
    res.status(201).json({ status: true, merchant });
  } catch (error) { next(error); }
});

export default router;
