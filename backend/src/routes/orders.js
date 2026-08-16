import { Router } from 'express';
import Order from '../models/Order.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const status = String(req.query.status || '').toUpperCase();
    const query = { owner: req.auth.sub };
    if (['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'].includes(status)) query.status = status;
    const [orders, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(query)
    ]);
    res.json({ status: true, orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

router.get('/:orderId', async (req, res, next) => {
  try {
    const order = await Order.findOne({ owner: req.auth.sub, orderId: req.params.orderId }).lean();
    if (!order) return res.status(404).json({ status: false, message: 'Order not found' });
    res.json({ status: true, order });
  } catch (error) { next(error); }
});

export default router;
