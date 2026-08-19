// Compatibility bridge for legacy imports.
// The Gmail payment verifier was renamed to gmailImapPaymentVerifier.js.
import {
  testGmailAppPassword,
  createVerificationOrder,
  connectMerchantGmail,
  verifyMerchantVerificationPayment,
  verifyConnection,
  verifyPendingOrdersForAdmin,
  verifyAllConnectedGmails
} from './gmailImapPaymentVerifier.js';

// Legacy route compatibility: older checkout/check-order code imports this name.
// Supports the current object form { merchant, connection } and the common
// positional form (merchant, connection).
export async function verifyOrderWithGmail(arg1, arg2) {
  if (arg1 && typeof arg1 === 'object' && arg1.merchant) {
    return verifyMerchantVerificationPayment(arg1);
  }
  return verifyMerchantVerificationPayment({ merchant: arg1, connection: arg2 });
}

export {
  testGmailAppPassword,
  createVerificationOrder,
  connectMerchantGmail,
  verifyMerchantVerificationPayment,
  verifyConnection,
  verifyPendingOrdersForAdmin,
  verifyAllConnectedGmails
};
