import mongoose from 'mongoose';

const kycOrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderId: { type: String, required: true, unique: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  paymentUrl: { type: String, required: true },
  status: { type: String, enum: ['PENDING_PAYMENT', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'EXPIRED'], default: 'PENDING_PAYMENT', index: true },
  aadhaarNumberEncrypted: { type: String, select: false },
  aadhaarNameEncrypted: { type: String, select: false },
  aadhaarFrontEncrypted: { type: String, select: false },
  aadhaarBackEncrypted: { type: String, select: false },
  panNumberEncrypted: { type: String, select: false },
  panNameEncrypted: { type: String, select: false },
  panFrontEncrypted: { type: String, select: false },
  panBackEncrypted: { type: String, select: false },
  utr: { type: String, trim: true },
  paidAt: Date,
  submittedAt: Date,
  verifiedAt: Date,
  rejectedAt: Date,
  rejectionReason: String,
  verificationSource: { type: String, enum: ['gmail', 'provider_webhook', 'manual'], default: 'manual' },
  verificationMessageId: String
}, { timestamps: true });

export default mongoose.model('KycOrder', kycOrderSchema);
