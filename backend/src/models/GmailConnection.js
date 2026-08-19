import mongoose from 'mongoose';

const gmailConnectionSchema = new mongoose.Schema({
  merchant: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', sparse: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  authType: { type: String, enum: ['imap_app_password'], default: 'imap_app_password', index: true },
  appPasswordEncrypted: { type: String, required: true, select: false },
  refreshTokenEncrypted: { type: String, default: '', select: false },
  lastCheckedAt: { type: Date, default: null },
  lastMessageId: { type: String, default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

gmailConnectionSchema.index({ merchant: 1 }, { unique: true, sparse: true });

export default mongoose.model('GmailConnection', gmailConnectionSchema);
