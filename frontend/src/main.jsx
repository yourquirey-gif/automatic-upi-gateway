import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Transactions from './Transactions.jsx';
import { CheckoutPage, PaymentLinkPage, PublicPaymentPage } from './CheckoutRoutesV2.jsx';
import SubscriptionPage from './SubscriptionPage.jsx';
import AccountPage from './AccountPage.jsx';
import KycPage from './KycPage.jsx';
import { api } from './api';
import './styles.css';
import './dashboard.css';

function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const onHashChange = () => setHash(window.location.hash); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange); }, []);

  if (window.location.pathname === '/auth') return <SubscriptionPage />;
  if (hash === '#dashboard/account') return <AccountPage />;
  if (hash === '#dashboard/kyc') return <KycPage />;
  if (hash === '#subscription' || hash === '#dashboard/subscription') return <KycGate><SubscriptionPage /></KycGate>;
  if (hash === '#dashboard/transactions') return <KycGate><Transactions onBack={() => { window.location.hash = 'dashboard'; }} /></KycGate>;
  if (hash === '#dashboard/checkout') return <KycGate><CheckoutPage /></KycGate>;
  if (hash === '#dashboard/payment-link') return <KycGate><PaymentLinkPage /></KycGate>;
  if (hash.startsWith('#pay?')) return <PublicPaymentPage route={hash} />;
  if (hash === '#dashboard' || hash.startsWith('#dashboard/')) return <KycGate><App /></KycGate>;
  return <App />;
}

function KycGate({ children }) {
  const [state,setState]=useState('loading'); const [error,setError]=useState('');
  useEffect(()=>{let alive=true;(async()=>{try{const [c,m]=await Promise.all([api('/kyc/config'),api('/kyc/me')]);if(!alive)return;setState(c.enabled&&m.kycStatus!=='VERIFIED'?'blocked':'ok');}catch(e){if(alive){setError(e.message);setState('ok')}}})();return()=>{alive=false}},[]);
  if(state==='loading') return <div className="kyc-gate-loading">Checking account verification…</div>;
  if(state==='blocked') return <div className="kyc-gate"><div className="kyc-gate-card"><div className="kyc-gate-icon">✓</div><h1>KYC Verification Required</h1><p>Administrator has enabled mandatory KYC. Complete your Aadhaar + PAN verification before using the gateway.</p><button onClick={()=>{window.location.hash='dashboard/kyc'}}>Complete KYC</button><small>KYC fee is configured by the administrator.</small></div></div>;
  return children;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);
