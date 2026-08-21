import mongoose from 'mongoose';

const adminNotificationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  type: { type: String, enum: ['info', 'success', 'warning', 'critical'], default: 'info' },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

adminNotificationSchema.index({ active: 1, createdAt: -1 });

export default mongoose.model('AdminNotification', adminNotificationSchema);
