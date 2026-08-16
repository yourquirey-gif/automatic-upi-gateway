import mongoose from 'mongoose';

const gatewaySettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  settlementUpiId: { type: String, trim: true, default: '' },
  settlementName: { type: String, trim: true, default: '' },
  subscriptionPaymentLink: { type: String, trim: true, default: '' },
  defaultTransactionFeePercent: { type: Number, min: 0, max: 100, default: 0 },
  gmailPaymentVerificationEnabled: { type: Boolean, default: false },
  gmailSearchQuery: { type: String, default: 'newer_than:2d' },
  paymentVerificationMode: { type: String, enum: ['gmail', 'provider_webhook', 'manual'], default: 'gmail' },
  feeSettlementMode: { type: String, enum: ['provider_split', 'ledger', 'manual'], default: 'ledger' }
}, { timestamps: true });

export default mongoose.model('GatewaySettings', gatewaySettingsSchema);
