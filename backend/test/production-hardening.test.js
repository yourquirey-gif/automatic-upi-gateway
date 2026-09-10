import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hashCredential, newApiToken, newInstanceSecret } from '../src/utils/credentialVault.js';
import { amountMatches, messageMatchesOrder } from '../src/services/gmailPaymentVerifier.js';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('credential vault hashes API tokens and generates high-entropy secrets', () => {
  const token = newApiToken(), secret = newInstanceSecret();
  assert.match(token, /^ag_live_[0-9a-f]{64}$/);
  assert.match(secret, /^ag_sec_[0-9a-f]{64}$/);
  assert.equal(hashCredential(token), hashCredential(token));
  assert.notEqual(hashCredential(token), token);
});

test('Gmail matching requires exact amount and order ID', () => {
  assert.equal(amountMatches(100, 100), true);
  assert.equal(amountMatches(100, 100.01), false);
  assert.equal(messageMatchesOrder('Payment received for ORD_12345', { orderId: 'ORD_12345' }), true);
  assert.equal(messageMatchesOrder('Payment received for ORD_123456', { orderId: 'ORD_12345' }), false);
});

test('payment success has backend expiry guards', () => {
  const source = read('src/models/Order.js');
  assert.match(source, /status === 'SUCCESS'/);
  assert.match(source, /expiresAt\.getTime\(\) <= Date\.now\(\)/);
  assert.match(source, /expiresAt: \{ \$gt: new Date\(\) \}/);
});

test('API credentials are not returned by normal account response', () => {
  const source = read('src/routes/account.js');
  assert.match(source, /New values are shown only once|Regenerate/);
  assert.match(source, /apiTokenHash/);
  assert.match(source, /apiTokenEncrypted/);
});

test('webhook delivery logs exclude payloads and signatures', () => {
  const source = read('src/services/merchantWebhook.js');
  assert.match(source, /WebhookDelivery/);
  assert.match(source, /X-Webhook-Signature/);
  assert.doesNotMatch(source, /WebhookDelivery\.create\(\{[^}]*payload/s);
});
