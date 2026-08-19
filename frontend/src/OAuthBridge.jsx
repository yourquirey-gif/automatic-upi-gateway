import { useEffect } from 'react';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || 'https://api.omniupi.in/api/v1').replace(/\/$/, '');

function normalizeUpi(value) {
  return String(value || '').trim().toLowerCase();
}

function readMerchants() {
  try {
    const value = JSON.parse(localStorage.getItem('seox_merchants') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function updateLocalMerchantVerification({ upi, merchantId, verified, email }) {
  const pending = normalizeUpi(upi || localStorage.getItem('omniupi_oauth_pending_upi') || '');
  if (!pending && !merchantId) return;

  const merchants = readMerchants();
  const updated = merchants.map((merchant) => {
    const sameUpi = pending && normalizeUpi(merchant.upiId) === pending;
    const sameId = merchantId && String(merchant.backendId || merchant.merchantId || '') === String(merchantId);
    if (!sameUpi && !sameId) return merchant;

    if (verified) {
      return {
        ...merchant,
        verified: true,
        verificationStatus: 'verified',
        status: 'active',
        verifiedAt: Date.now(),
        ...(email ? { verifiedEmail: email } : {})
      };
    }

    return {
      ...merchant,
      verified: false,
      verificationStatus: 'failed',
      status: 'pending'
    };
  });

  try {
    localStorage.setItem('seox_merchants', JSON.stringify(updated));
    localStorage.removeItem('omniupi_oauth_pending_upi');
  } catch {}
}

export default function OAuthBridge() {
  useEffect(() => {
    let disposed = false;

    const handleOAuthCallback = () => {
      if (disposed) return;
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw.startsWith('google_token=')) return;

      const params = new URLSearchParams(raw);
      const token = params.get('google_token');
      if (!token) return;

      try {
        localStorage.setItem('gateway_access_token', token);
      } catch {}

      const verified = params.get('merchant_verified') === '1';
      const merchantId = params.get('merchant_id') || '';
      const pendingUpi = localStorage.getItem('omniupi_oauth_pending_upi') || '';

      updateLocalMerchantVerification({
        upi: pendingUpi,
        merchantId,
        verified,
        email: params.get('verified_email') || ''
      });

      window.location.hash = merchantId ? 'dashboard/connect' : 'dashboard';
    };

    const handleClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const googleLoginButton = target.closest('.google-btn');
      if (googleLoginButton) {
        event.preventDefault();
        const signup = /sign\s*up/i.test(googleLoginButton.textContent || '');
        window.location.assign(`${API_BASE}/auth/google?mode=${signup ? 'signup' : 'login'}`);
        return;
      }

      const gmailButton = target.closest('.google-connect');
      if (!gmailButton) return;

      const modal = gmailButton.closest('.verify-modal');
      const upi = modal?.querySelector('.saved-upi b')?.textContent?.trim() || '';
      if (!upi) {
        window.alert('UPI ID is missing. Please enter and save the merchant UPI ID first.');
        return;
      }

      const merchant = readMerchants().find((item) => normalizeUpi(item.upiId) === normalizeUpi(upi));
      const mobile = String(merchant?.mobile || '').replace(/\D/g, '');
      if (!/^\d{10}$/.test(mobile)) {
        window.alert('A valid 10-digit merchant mobile number is required.');
        return;
      }

      localStorage.setItem('omniupi_oauth_pending_upi', normalizeUpi(upi));
      window.location.assign(`${API_BASE}/auth/google/merchant?upi=${encodeURIComponent(upi)}&mobile=${encodeURIComponent(mobile)}`);
    };

    handleOAuthCallback();
    window.addEventListener('hashchange', handleOAuthCallback);
    document.addEventListener('click', handleClick);

    return () => {
      disposed = true;
      window.removeEventListener('hashchange', handleOAuthCallback);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}
