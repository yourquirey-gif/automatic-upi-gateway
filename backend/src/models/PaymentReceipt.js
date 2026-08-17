import mongoose from 'mongoose';

const paymentReceiptSchema = new mongoose.Schema({
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
  messageId: { type: String, required: true },
  threadId: { type: String, default: null },
  utr: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  merchantUpiId: { type: String, required: true, trim: true, lowercase: true },
  payerUpiId: { type: String, default: null, trim: true, lowercase: true },
  receivedAt: { type: Date, required: true },
  consumed: { type: Boolean, default: false, index: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null }
}, { timestamps: true });

paymentReceiptSchema.index({ merchant: 1, utr: 1 }, { unique: true });
paymentReceiptSchema.index({ merchant: 1, messageId: 1 }, { unique: true });

export default mongoose.model('PaymentReceipt', paymentReceiptSchema);
