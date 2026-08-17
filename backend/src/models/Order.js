import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderId: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  customerMobile: { type: String, trim: true },
  redirectUrl: { type: String, trim: true },
  remark1: String,
  remark2: String,
  paymentUrl: String,
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'], default: 'PENDING', index: true },
  utr: { type: String, trim: true },
  paidAt: Date,
  feePercent: { type: Number, default: 0, min: 0, max: 100 },
  feeAmount: { type: Number, default: 0, min: 0 },
  netAmount: { type: Number, default: 0, min: 0 },
  feeSettlementStatus: { type: String, enum: ['NOT_APPLICABLE', 'PENDING', 'SETTLED', 'MANUAL'], default: 'NOT_APPLICABLE' },
  verificationSource: { type: String, enum: ['gmail', 'provider_webhook', 'manual'], default: 'manual' },
  verificationMessageId: { type: String, trim: true },
  paymentReceipt: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentReceipt', default: null }
}, { timestamps: true });

orderSchema.index({ merchant: 1, utr: 1 }, { unique: true, sparse: true });

export default mongoose.model('Order', orderSchema);
