import { Router } from 'express';
import GatewaySettings from '../models/GatewaySettings.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const CATEGORIES = ['Getting Started','Merchant Setup','Payment Links','API Integration','Webhooks','Troubleshooting','Advanced'];
function cleanVideos(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v, i) => ({
    id: String(v.id || `${Date.now()}-${i}`),
    title: String(v.title || '').trim().slice(0, 120),
    description: String(v.description || '').trim().slice(0, 500),
    category: CATEGORIES.includes(v.category) ? v.category : 'Getting Started',
    tags: Array.isArray(v.tags) ? v.tags.map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 20) : [],
    thumbnail: String(v.thumbnail || '').trim().slice(0, 500),
    url: String(v.url || '').trim().slice(0, 500),
    duration: String(v.duration || '').trim().slice(0, 30),
    publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : null,
    active: v.active !== false,
    published: v.published !== false,
    order: Number.isFinite(Number(v.order)) ? Number(v.order) : i
  })).filter(v => v.title && v.url);
}

router.get('/', async (req, res, next) => {
  try {
    const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const videos = cleanVideos(settings?.merchantVideos)
      .filter(v => v.active && v.published)
      .filter(v => !category || v.category === category)
      .filter(v => !q || [v.title, v.description, v.category, ...v.tags].join(' ').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0) || a.order - b.order);
    res.json({ status: true, categories: CATEGORIES, videos });
  } catch (error) { next(error); }
});

router.get('/admin', requireAuth, requireAdmin, async (_req, res, next) => {
  try { const settings = await GatewaySettings.findOneAndUpdate({ key: 'global' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(); res.json({ status: true, categories: CATEGORIES, videos: cleanVideos(settings?.merchantVideos).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0) || a.order - b.order) }); } catch (error) { next(error); }
});

router.put('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const videos = cleanVideos(req.body.videos).map((v, i) => ({ ...v, publishedAt: v.publishedAt || (v.published ? new Date().toISOString() : null), order: i }));
    const settings = await GatewaySettings.findOneAndUpdate({ key: 'global' }, { $set: { merchantVideos: videos } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    res.json({ status: true, categories: CATEGORIES, videos: cleanVideos(settings.merchantVideos).sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0) || a.order - b.order) });
  } catch (error) { next(error); }
});

export default router;
