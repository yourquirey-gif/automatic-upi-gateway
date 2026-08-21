import mongoose from 'mongoose';

const adminAuditLogSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, trim: true, maxlength: 120 },
  targetType: { type: String, trim: true, maxlength: 80, default: '' },
  targetId: { type: String, trim: true, maxlength: 160, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, trim: true, maxlength: 100, default: '' },
  userAgent: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ admin: 1, createdAt: -1 });

export default mongoose.model('AdminAuditLog', adminAuditLogSchema);
