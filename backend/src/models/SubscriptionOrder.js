import mongoose from 'mongoose';

const subscriptionOrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  orderId: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  paymentUrl: { type: String, trim: true },
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'EXPIRED'], default: 'PENDING', index: true },
  utr: { type: String, trim: true },
  paidAt: Date,
  planActivatedAt: Date,
  planExpiresAt: Date,
  verificationSource: { type: String, enum: ['gmail', 'provider_webhook', 'manual'], default: 'manual' },
  verificationMessageId: String
}, { timestamps: true });

export default mongoose.model('SubscriptionOrder', subscriptionOrderSchema);
