import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true, required: true },
  email: { type: String, trim: true, lowercase: true, unique: true, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['merchant', 'admin'], default: 'merchant' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', default: null }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
