import { useEffect } from 'react';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || 'https://api.omniupi.in/api/v1').replace(/\/$/, '');

function updateLocalMerchantVerification() {
  const upi = localStorage.getItem('omniupi_oauth_pending_upi');
  if (!upi) return;
  try {
    const merchants = JSON.parse(localStorage.getItem('seox_merchants') || '[]');
    const updated = merchants.map(m => String(m.upiId || '').trim().toLowerCase() === upi.toLowerCase() ? { ...m, verified: true } : m);
    localStorage.setItem('seox_merchants', JSON.stringify(updated));
  } catch {}
  localStorage.removeItem('omniupi_oauth_pending_upi');
}

export default function OAuthBridge() {
  useEffect(() => {
    const handleOAuthCallback = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw.startsWith('google_token=')) return false;
      const params = new URLSearchParams(raw);
      const token = params.get('google_token');
      if (!token) return false;
      localStorage.setItem('gateway_access_token', token);
      if (params.get('merchant_verified') === '1') updateLocalMerchantVerification();
      else localStorage.removeItem('omniupi_oauth_pending_upi');
      window.location.hash = params.get('merchant_id') ? 'dashboard/connect' : 'dashboard';
      return true;
    };

    const handleClick = event => {
      const googleLoginButton = event.target.closest?.('.google-btn');
      if (googleLoginButton) {
        event.preventDefault();
        event.stopPropagation();
        const signup = /sign\s*up/i.test(googleLoginButton.textContent || '');
        window.location.href = `${API_BASE}/auth/google?mode=${signup ? 'signup' : 'login'}`;
        return;
      }

      const gmailButton = event.target.closest?.('.google-connect');
      if (!gmailButton) return;
      event.preventDefault();
      event.stopPropagation();
      const upi = gmailButton.closest('.verify-modal')?.querySelector('.saved-upi b')?.textContent?.trim() || '';
      if (!upi) {
        window.alert('UPI ID is missing. Please enter and save the merchant UPI ID first.');
        return;
      }
      let mobile = '';
      try {
        const merchants = JSON.parse(localStorage.getItem('seox_merchants') || '[]');
        const merchant = merchants.find(m => String(m.upiId || '').trim().toLowerCase() === upi.toLowerCase());
        mobile = String(merchant?.mobile || '').replace(/\D/g, '');
      } catch {}
      if (!/^\d{10}$/.test(mobile)) {
        window.alert('A valid 10-digit merchant mobile number is required.');
        return;
      }
      localStorage.setItem('omniupi_oauth_pending_upi', upi.toLowerCase());
      window.location.href = `${API_BASE}/auth/google/merchant?upi=${encodeURIComponent(upi)}&mobile=${encodeURIComponent(mobile)}`;
    };

    if (!handleOAuthCallback()) window.addEventListener('hashchange', handleOAuthCallback);
    document.addEventListener('click', handleClick, true);
    return () => {
      window.removeEventListener('hashchange', handleOAuthCallback);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}
