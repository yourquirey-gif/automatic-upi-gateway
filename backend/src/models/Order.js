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
  paidAt: Date
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
