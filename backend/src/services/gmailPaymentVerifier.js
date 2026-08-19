// Compatibility bridge for legacy imports.
// The Gmail payment verifier was renamed to gmailImapPaymentVerifier.js.
export {
  testGmailAppPassword,
  createVerificationOrder,
  connectMerchantGmail,
  verifyMerchantVerificationPayment,
  verifyConnection,
  verifyPendingOrdersForAdmin,
  verifyAllConnectedGmails
} from './gmailImapPaymentVerifier.js';
