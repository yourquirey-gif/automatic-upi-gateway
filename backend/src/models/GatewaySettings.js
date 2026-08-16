import mongoose from 'mongoose';

const gatewaySettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  settlementUpiId: { type: String, trim: true, default: '' },
  settlementName: { type: String, trim: true, default: '' },
  subscriptionUpiId: { type: String, trim: true, default: '' },
  subscriptionUpiName: { type: String, trim: true, default: '' },
  subscriptionPaymentLink: { type: String, trim: true, default: '' },
  kycRequired: { type: Boolean, default: false },
  kycFee: { type: Number, min: 0, default: 50 },
  kycUpiId: { type: String, trim: true, default: '' },
  kycUpiName: { type: String, trim: true, default: '' },
  showPanField: { type: Boolean, default: true },
  showAadhaarField: { type: Boolean, default: true },
  defaultTransactionFeePercent: { type: Number, min: 0, max: 100, default: 0 },
  gmailPaymentVerificationEnabled: { type: Boolean, default: false },
  gmailSearchQuery: { type: String, default: 'newer_than:2d' },
  paymentVerificationMode: { type: String, enum: ['gmail', 'provider_webhook', 'manual'], default: 'gmail' },
  feeSettlementMode: { type: String, enum: ['provider_split', 'ledger', 'manual'], default: 'ledger' }
}, { timestamps: true });

export default mongoose.model('GatewaySettings', gatewaySettingsSchema);
