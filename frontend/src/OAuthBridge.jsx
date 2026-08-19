import { useEffect } from 'react';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || 'https://api.omniupi.in/api/v1').replace(/\/$/, '');

function readMerchants() {
  try {
    const value = JSON.parse(localStorage.getItem('seox_merchants') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeMerchants(merchants) {
  localStorage.setItem('seox_merchants', JSON.stringify(merchants));
}

function normalizeUpi(value) {
  return String(value || '').trim().toLowerCase();
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

  writeMerchants(updated);
  localStorage.removeItem('omniupi_oauth_pending_upi');
}

function decorateMerchantTable() {
  const table = document.querySelector('.merchants-card .merchant-table-wrap table');
  if (!table) return;

  const rows = [...table.querySelectorAll('tbody tr')];
  if (!rows.length || rows[0].querySelector('.table-empty')) return;

  const merchants = readMerchants();
  rows.forEach((row, index) => {
    const merchant = merchants[index];
    if (!merchant) return;

    const cells = row.querySelectorAll('td');
    if (cells.length < 6) return;

    const statusCell = cells[4];
    const actionCell = cells[5];
    const verified = merchant.verified === true || merchant.verificationStatus === 'verified' || merchant.status === 'active';

    statusCell.innerHTML = verified
      ? '<span class="status-ok">Active</span>'
      : '<span class="status-pending">Inactive</span>';

    const verifyButton = actionCell.querySelector('.verify-btn');
    if (verifyButton) {
      verifyButton.innerHTML = verified
        ? '<span style="display:inline-flex;align-items:center;gap:5px">✓ Verified</span>'
        : '<span style="display:inline-flex;align-items:center;gap:5px">✓ Verify</span>';
      verifyButton.disabled = false;
      verifyButton.title = verified ? 'UPI verified' : 'Verify UPI ID with Google Gmail';
    }

    // Delete is handled by the dashboard's own merchant actions.
    // Do not add DOM observers or dynamically mutate the table here.
  });
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
      const verified = params.get('merchant_verified') === '1';
      const merchantId = params.get('merchant_id') || '';
      const pendingUpi = localStorage.getItem('omniupi_oauth_pending_upi') || '';

      updateLocalMerchantVerification({
        upi: pendingUpi,
        merchantId,
        verified,
        email: params.get('verified_email') || ''
      });

      if (!verified) {
        localStorage.removeItem('omniupi_oauth_pending_upi');
      }

      window.location.hash = merchantId ? 'dashboard/connect' : 'dashboard';
      setTimeout(decorateMerchantTable, 100);
      return true;
    };

    const handleClick = (event) => {
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

      const modal = gmailButton.closest('.verify-modal');
      const upi = modal?.querySelector('.saved-upi b')?.textContent?.trim() || '';
      if (!upi) {
        window.alert('UPI ID is missing. Please enter and save the merchant UPI ID first.');
        return;
      }

      const merchants = readMerchants();
      const merchant = merchants.find((item) => normalizeUpi(item.upiId) === normalizeUpi(upi));
      const mobile = String(merchant?.mobile || '').replace(/\D/g, '');
      if (!/^\d{10}$/.test(mobile)) {
        window.alert('A valid 10-digit merchant mobile number is required.');
        return;
      }

      localStorage.setItem('omniupi_oauth_pending_upi', normalizeUpi(upi));
      window.location.href = `${API_BASE}/auth/google/merchant?upi=${encodeURIComponent(upi)}&mobile=${encodeURIComponent(mobile)}`;
    };

    const callbackHandled = handleOAuthCallback();
    if (!callbackHandled) {
      window.addEventListener('hashchange', handleOAuthCallback);
    }

    document.addEventListener('click', handleClick, true);

    // Run once after the dashboard has rendered. No MutationObserver is used,
    // because changing table cells from inside an observer creates an endless
    // mutation loop and freezes the page when the user clicks dashboard options.
    const timer = setTimeout(decorateMerchantTable, 300);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', handleOAuthCallback);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}
