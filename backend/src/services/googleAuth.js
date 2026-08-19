import { google } from 'googleapis';
import GatewaySettings from '../models/GatewaySettings.js';
import { decryptSecret } from '../utils/secretBox.js';

async function googleOAuthConfig() {
  const settings = await GatewaySettings.findOne({ key: 'global' }).lean();
  const clientId = String(settings?.googleClientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = settings?.googleClientSecretEncrypted
    ? decryptSecret(settings.googleClientSecretEncrypted)
    : String(process.env.GOOGLE_CLIENT_SECRET || '');
  const publicApi = String(settings?.publicApiBaseUrl || process.env.PUBLIC_API_BASE_URL || 'https://api.omniupi.in').replace(/\/$/, '');
  const configured = String(settings?.googleRedirectUri || process.env.GOOGLE_REDIRECT_URI || '').trim();
  const redirectUri = configured || `${publicApi}/api/v1/auth/google/callback`;
  if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured. Add Client ID and Client Secret in Admin > Gateway Settings.');
  return { clientId, clientSecret, redirectUri };
}

export async function createGoogleClient() {
  const c = await googleOAuthConfig();
  return new google.auth.OAuth2(c.clientId, c.clientSecret, c.redirectUri);
}
