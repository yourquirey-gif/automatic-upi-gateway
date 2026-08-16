import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  email: { type: String, trim: true, lowercase: true, unique: true, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['merchant', 'admin'], default: 'merchant' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  userId: { type: String, unique: true, sparse: true, index: true },
  mobile: { type: String, trim: true, default: '' },
  companyName: { type: String, trim: true, default: '' },
  panNumber: { type: String, trim: true, default: '' },
  aadhaarNumber: { type: String, trim: true, default: '' },
  location: { type: String, trim: true, default: '' },
  whitelistedIps: { type: [String], default: [] },
  kycStatus: { type: String, enum: ['NOT_SUBMITTED', 'PENDING_PAYMENT', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED'], default: 'NOT_SUBMITTED', index: true },
  kycVerifiedAt: { type: Date, default: null },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null },
  trialStartedAt: { type: Date, default: null },
  trialEndsAt: { type: Date, default: null },
  planStartedAt: { type: Date, default: null },
  planExpiresAt: { type: Date, default: null, index: true },
  planStatus: { type: String, enum: ['NONE', 'ACTIVE', 'EXPIRED'], default: 'NONE', index: true }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
