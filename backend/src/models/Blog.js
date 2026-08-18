import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
  excerpt: { type: String, trim: true, maxlength: 500, default: '' },
  contentHtml: { type: String, required: true, default: '' },
  featuredImage: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, maxlength: 80, default: 'General' },
  tags: { type: [String], default: [] },
  author: { type: String, trim: true, maxlength: 100, default: 'OmniUPI' },
  status: { type: String, enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT', index: true },
  featured: { type: Boolean, default: false, index: true },
  metaTitle: { type: String, trim: true, maxlength: 180, default: '' },
  metaDescription: { type: String, trim: true, maxlength: 320, default: '' },
  publishedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

blogSchema.index({ status: 1, publishedAt: -1 });

export default mongoose.model('Blog', blogSchema);
