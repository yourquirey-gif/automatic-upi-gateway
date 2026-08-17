import mongoose from 'mongoose';

const merchantVideoSchema = new mongoose.Schema({
  id: { type: String, trim: true },
  title: { type: String, trim: true, maxlength: 120 },
  url: { type: String, trim: true, maxlength: 500 },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { _id: false });

const gatewaySettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  gatewayName: { type: String, trim: true, default: 'OmniUPI' },
  supportContact: { type: String, trim: true, default: '' },
  maintenanceMode: { type: Boolean, default: false },
  logoUrl: { type: String, trim: true, default: '' },
  publicApiBaseUrl: { type: String, trim: true, default: 'https://api.omniupi.in' },
  webhookBaseUrl: { type: String, trim: true, default: '' },
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
  paymentExpiryMinutes: { type: Number, min: 1, max: 1440, default: 5 },
  minimumPaymentAmount: { type: Number, min: 0, default: 1 },
  maximumPaymentAmount: { type: Number, min: 0, default: 100000 },
  gmailPaymentVerificationEnabled: { type: Boolean, default: false },
  gmailAutoSync: { type: Boolean, default: false },
  gmailSearchQuery: { type: String, default: 'newer_than:2d' },
  paymentVerificationMode: { type: String, enum: ['gmail', 'provider_webhook', 'manual'], default: 'gmail' },
  feeSettlementMode: { type: String, enum: ['provider_split', 'ledger', 'manual'], default: 'ledger' },
  googleOAuthEnabled: { type: Boolean, default: false },
  googleClientId: { type: String, trim: true, default: '' },
  googleClientSecretEncrypted: { type: String, default: '' },
  googleRedirectUri: { type: String, trim: true, default: '' },
  merchantVideos: { type: [merchantVideoSchema], default: [] }
}, { timestamps: true });

export default mongoose.model('GatewaySettings', gatewaySettingsSchema);
