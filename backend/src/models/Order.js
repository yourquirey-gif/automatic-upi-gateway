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
  expiresAt: { type: Date, required: true, index: true },
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

// Defense in depth: no code path can transition an expired order to SUCCESS,
// including a late Gmail verification racing the five-minute deadline.
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'SUCCESS' && this.expiresAt && this.expiresAt.getTime() <= Date.now()) {
    return next(Object.assign(new Error('Payment link has expired and cannot be marked successful.'), { code: 'ORDER_EXPIRED' }));
  }
  next();
});

orderSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() || {};
  const nextStatus = update.status ?? update.$set?.status;
  if (nextStatus === 'SUCCESS') {
    const filter = this.getFilter() || {};
    this.setQuery({ ...filter, status: 'PENDING', expiresAt: { $gt: new Date() } });
  }
  next();
});

orderSchema.index(
  { merchant: 1, utr: 1 },
  { unique: true, partialFilterExpression: { utr: { $type: 'string' } } }
);

export default mongoose.model('Order', orderSchema);
