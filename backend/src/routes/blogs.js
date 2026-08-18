import { Router } from 'express';
import Blog from '../models/Blog.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 150) || `blog-${Date.now()}`;
const cleanTags = value => Array.isArray(value) ? [...new Set(value.map(x => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 20) : String(value || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).slice(0, 20);
const sanitizeHtml = html => String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<iframe[\s\S]*?<\/iframe>/gi, '').replace(/on[a-z]+\s*=\s*(["']).*?\1/gi, '').replace(/javascript:/gi, '');

async function uniqueSlug(title, currentId = null) {
  const base = slugify(title); let slug = base; let n = 2;
  while (await Blog.exists({ slug, ...(currentId ? { _id: { $ne: currentId } } : {}) })) slug = `${base}-${n++}`;
  return slug;
}

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1), limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
    const filter = { status: 'PUBLISHED', publishedAt: { $lte: new Date() } };
    if (req.query.category) filter.category = String(req.query.category).trim();
    if (req.query.featured === 'true') filter.featured = true;
    const [blogs, total] = await Promise.all([Blog.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('-contentHtml').lean(), Blog.countDocuments(filter)]);
    res.json({ status: true, blogs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
});

router.get('/categories', async (_req, res, next) => {
  try { const categories = await Blog.distinct('category', { status: 'PUBLISHED' }); res.json({ status: true, categories: categories.filter(Boolean).sort() }); }
  catch (e) { next(e); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, status: 'PUBLISHED', publishedAt: { $lte: new Date() } }).lean();
    if (!blog) return res.status(404).json({ status: false, message: 'Blog not found' });
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300'); res.json({ status: true, blog });
  } catch (e) { next(e); }
});

const admin = Router();
admin.use(requireAuth, requireAdmin);
admin.get('/', async (req, res, next) => {
  try { const blogs = await Blog.find().sort({ createdAt: -1 }).lean(); res.json({ status: true, blogs }); }
  catch (e) { next(e); }
});
admin.post('/', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim(), contentHtml = sanitizeHtml(req.body.contentHtml);
    if (!title || !contentHtml.trim()) return res.status(400).json({ status: false, message: 'Title and blog content are required' });
    const status = req.body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? (req.body.publishedAt ? new Date(req.body.publishedAt) : new Date()) : null;
    const blog = await Blog.create({ title, slug: await uniqueSlug(title), excerpt: String(req.body.excerpt || '').trim().slice(0, 500), contentHtml, featuredImage: String(req.body.featuredImage || '').trim().slice(0, 1000), category: String(req.body.category || 'General').trim().slice(0, 80), tags: cleanTags(req.body.tags), author: String(req.body.author || 'OmniUPI').trim().slice(0, 100), status, featured: Boolean(req.body.featured), metaTitle: String(req.body.metaTitle || title).trim().slice(0, 180), metaDescription: String(req.body.metaDescription || req.body.excerpt || '').trim().slice(0, 320), publishedAt });
    res.status(201).json({ status: true, blog });
  } catch (e) { next(e); }
});
admin.put('/:id', async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id); if (!blog) return res.status(404).json({ status: false, message: 'Blog not found' });
    if ('title' in req.body && String(req.body.title).trim() !== blog.title) { blog.title = String(req.body.title).trim(); blog.slug = await uniqueSlug(blog.title, blog._id); }
    if ('contentHtml' in req.body) blog.contentHtml = sanitizeHtml(req.body.contentHtml);
    for (const k of ['excerpt','featuredImage','category','author','metaTitle','metaDescription']) if (k in req.body) blog[k] = String(req.body[k] || '').trim();
    if ('tags' in req.body) blog.tags = cleanTags(req.body.tags);
    if ('featured' in req.body) blog.featured = Boolean(req.body.featured);
    if ('status' in req.body) blog.status = req.body.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    if (blog.status === 'PUBLISHED' && !blog.publishedAt) blog.publishedAt = req.body.publishedAt ? new Date(req.body.publishedAt) : new Date();
    if (blog.status === 'DRAFT') blog.publishedAt = null;
    await blog.save(); res.json({ status: true, blog });
  } catch (e) { next(e); }
});
admin.delete('/:id', async (req, res, next) => { try { const blog = await Blog.findByIdAndDelete(req.params.id); if (!blog) return res.status(404).json({ status: false, message: 'Blog not found' }); res.json({ status: true, message: 'Blog deleted' }); } catch (e) { next(e); } });

export { admin as adminBlogRoutes };
export default router;
