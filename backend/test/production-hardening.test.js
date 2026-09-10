import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hashCredential, newApiToken, newInstanceSecret } from '../src/utils/credentialVault.js';
import { amountMatches, messageMatchesOrder } from '../src/services/gmailPaymentVerifier.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('credential vault hashes API tokens and generates high-entropy secrets', () => { const token=newApiToken(),secret=newInstanceSecret(); assert.match(token,/^ag_live_[0-9a-f]{64}$/); assert.match(secret,/^ag_sec_[0-9a-f]{64}$/); assert.notEqual(hashCredential(token),token); });
test('Gmail matching requires exact amount and order ID', () => { assert.equal(amountMatches(100,100),true); assert.equal(amountMatches(100,100.01),false); assert.equal(messageMatchesOrder('Payment received for ORD_12345',{orderId:'ORD_12345'}),true); assert.equal(messageMatchesOrder('Payment received for ORD_123456',{orderId:'ORD_12345'}),false); });
test('payment success has backend expiry guards', () => { const source=read('src/models/Order.js'); assert.match(source,/status === 'SUCCESS'/); assert.match(source,/expiresAt\.getTime\(\) <= Date\.now\(\)/); assert.match(source,/expiresAt: \{ \$gt: new Date\(\) \}/); });
test('API credentials use hashed/encrypted server storage', () => { const source=read('src/routes/account.js'); assert.match(source,/apiTokenHash/); assert.match(source,/apiTokenEncrypted/); assert.match(source,/New credential generated/); });
test('webhook logs contain outcomes but no payload field', () => { const source=read('src/services/merchantWebhook.js'); assert.match(source,/WebhookDelivery/); assert.match(source,/X-Webhook-Signature/); assert.doesNotMatch(source,/WebhookDelivery\.create\(\{[^}]*payload/s); });
