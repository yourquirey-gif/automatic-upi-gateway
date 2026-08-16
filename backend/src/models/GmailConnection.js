import mongoose from 'mongoose';

const gmailConnectionSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  refreshTokenEncrypted: { type: String, required: true, select: false },
  lastCheckedAt: { type: Date, default: null },
  lastMessageId: { type: String, default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('GmailConnection', gmailConnectionSchema);
