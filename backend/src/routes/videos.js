import { Router } from 'express';
import GatewaySettings from '../models/GatewaySettings.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

function cleanVideos(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v, i) => ({
    id: String(v.id || `${Date.now()}-${i}`),
    title: String(v.title || '').trim().slice(0, 120),
    url: String(v.url || '').trim().slice(0, 500),
    active: v.active !== false,
    order: Number.isFinite(Number(v.order)) ? Number(v.order) : i
  })).filter(v => v.title && v.url);
}

router.get('/', async (_req, res, next) => {
  try {
    const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
    const videos = cleanVideos(settings?.merchantVideos).filter(v => v.active).sort((a, b) => a.order - b.order);
    res.json({ status: true, videos });
  } catch (error) { next(error); }
});

router.get('/admin', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const settings = await GatewaySettings.findOneAndUpdate({ key: 'global' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    res.json({ status: true, videos: cleanVideos(settings?.merchantVideos).sort((a, b) => a.order - b.order) });
  } catch (error) { next(error); }
});

router.put('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const videos = cleanVideos(req.body.videos);
    const settings = await GatewaySettings.findOneAndUpdate(
      { key: 'global' },
      { $set: { merchantVideos: videos } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ status: true, videos: cleanVideos(settings.merchantVideos).sort((a, b) => a.order - b.order) });
  } catch (error) { next(error); }
});

export default router;
