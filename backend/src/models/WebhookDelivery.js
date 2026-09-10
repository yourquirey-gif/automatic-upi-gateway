import mongoose from 'mongoose';

const webhookDeliverySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  event: { type: String, required: true, maxlength: 100 },
  orderId: { type: String, default: '', maxlength: 160, index: true },
  deliveredAt: { type: Date, default: Date.now, index: true },
  httpStatus: { type: Number, default: null },
  success: { type: Boolean, default: false, index: true },
  retryStatus: { type: String, default: 'not_scheduled', maxlength: 60 },
  errorReason: { type: String, default: '', maxlength: 500 },
  responseTimeMs: { type: Number, default: null }
}, { timestamps: true });

webhookDeliverySchema.index({ owner: 1, deliveredAt: -1 });

export default mongoose.model('WebhookDelivery', webhookDeliverySchema);
