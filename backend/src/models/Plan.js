import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  durationDays: { type: Number, required: true, min: 1 },
  transactionLimit: { type: Number, default: 0, min: 0 },
  merchantLimit: { type: Number, default: 1, min: 1 },
  apiAccess: { type: Boolean, default: true },
  transactionFeePercent: { type: Number, default: 0, min: 0, max: 100 },
  features: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  popular: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Plan', planSchema);
