import mongoose from 'mongoose';

const kycRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  aadhaarNumber: { type: String, required: true, select: false },
  aadhaarName: { type: String, required: true, trim: true },
  aadhaarFront: { type: String, required: true, select: false },
  aadhaarBack: { type: String, required: true, select: false },
  panNumber: { type: String, required: true, trim: true, uppercase: true },
  panName: { type: String, required: true, trim: true },
  panFront: { type: String, required: true, select: false },
  panBack: { type: String, required: true, select: false },
  livePhoto: { type: String, select: false },
  amount: { type: Number, required: true, min: 0 },
  paymentOrderId: { type: String, required: true, unique: true, index: true },
  paymentUrl: { type: String, required: true },
  paymentStatus: { type: String, enum: ['PENDING','SUCCESS','FAILED'], default: 'PENDING', index: true },
  status: { type: String, enum: ['PAYMENT_PENDING','PENDING_REVIEW','VERIFIED','REJECTED'], default: 'PAYMENT_PENDING', index: true },
  rejectionReason: { type: String, default: '' },
  utr: { type: String, default: '' }, paidAt: Date, verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
export default mongoose.model('KycRequest', kycRequestSchema);
