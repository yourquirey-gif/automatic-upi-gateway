import crypto from 'node:crypto';
import { decryptSecret, encryptSecret } from './secretBox.js';

export function hashCredential(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

export function encryptCredential(value) {
  return encryptSecret(String(value || ''));
}

export function decryptCredential(value) {
  return decryptSecret(String(value || ''));
}

export function maskCredential(value, visible = 4) {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.length <= visible * 2) return `${raw.slice(0, visible)}••••`;
  return `${raw.slice(0, visible)}••••${raw.slice(-visible)}`;
}

export function newApiToken() {
  return `ag_live_${crypto.randomBytes(32).toString('hex')}`;
}

export function newInstanceSecret() {
  return `ag_sec_${crypto.randomBytes(32).toString('hex')}`;
}
