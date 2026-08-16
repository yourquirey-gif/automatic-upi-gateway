import mongoose from 'mongoose';

const merchantSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  provider: { type: String, required: true, trim: true },
  upiId: { type: String, trim: true },
  mobile: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'active', 'paused', 'error'], default: 'pending', index: true },
  externalMerchantId: { type: String, trim: true },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  planActivatedAt: { type: Date, default: null },
  planExpiresAt: { type: Date, default: null },
  planTransactionFeePercent: { type: Number, default: 0, min: 0, max: 100 }
}, { timestamps: true });

export default mongoose.model('Merchant', merchantSchema);
