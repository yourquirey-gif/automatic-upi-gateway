import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import OAuthBridge from './OAuthBridge.jsx';
import LegalPage from './LegalPages.jsx';
import Transactions from './Transactions.jsx';
import { CheckoutPage, PaymentLinkPage, PublicPaymentPage } from './CheckoutRoutesV2.jsx';
import SubscriptionPage from './SubscriptionPage.jsx';
import AccountPage from './AccountPage.jsx';
import PasswordPage from './PasswordPage.jsx';
import KycPage from './KycPage.jsx';
import ApiPage from './ApiPage.jsx';
import MerchantApkPage from './MerchantApkPage.jsx';
import VideoMerchant from './VideoMerchant.jsx';
import Documentation from './Documentation.jsx';
import SupportTicketPage from './SupportTicketPage.jsx';
import FaqPage from './FaqPage.jsx';
import HomeLegalFooter from './HomeLegalFooter.jsx';
import { api } from './api';
import './styles.css';
import './dashboard.css';
import './kyc.css';
import './video-merchant.css';

function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const onHashChange = () => setHash(window.location.hash); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange); }, []);
  const legal = {'#privacy':'privacy','#terms':'terms','#refund':'refund','#shipping':'shipping','#contact':'contact'};
  const legalPaths = {'/privacy-policy.html':'privacy','/terms.html':'terms','/refund-policy.html':'refund','/shipping-policy.html':'shipping','/contact.html':'contact'};
  if (legal[hash]) return <><OAuthBridge /><LegalPage type={legal[hash]} /></>;
  if (legalPaths[window.location.pathname]) return <><OAuthBridge /><LegalPage type={legalPaths[window.location.pathname]} /></>;
  if (window.location.pathname === '/auth') return <><OAuthBridge /><SubscriptionPage /></>;
  if (hash === '#dashboard/account') return <><OAuthBridge /><AccountPage /></>;
  if (hash === '#dashboard/password') return <><OAuthBridge /><PasswordPage /></>;
  if (hash === '#dashboard/kyc') return <><OAuthBridge /><KycPage /></>;
  if (hash === '#dashboard/api') return <><OAuthBridge /><ApiPage /></>;
  if (hash === '#dashboard/apk') return <><OAuthBridge /><MerchantApkPage /></>;
  if (hash === '#dashboard/video') return <><OAuthBridge /><KycGate><VideoMerchant /></KycGate></>;
  if (hash === '#dashboard/docs') return <><OAuthBridge /><KycGate><Documentation /></KycGate></>;
  if (hash === '#dashboard/support') return <><OAuthBridge /><SupportTicketPage /></>;
  if (hash === '#dashboard/faq') return <><OAuthBridge /><FaqPage /></>;
  if (hash === '#subscription' || hash === '#dashboard/subscription') return <><OAuthBridge /><KycGate><SubscriptionPage /></KycGate></>;
  if (hash === '#dashboard/transactions') return <><OAuthBridge /><KycGate><Transactions onBack={() => { window.location.hash = 'dashboard'; }} /></KycGate></>;
  if (hash === '#dashboard/checkout') return <><OAuthBridge /><KycGate><CheckoutPage /></KycGate></>;
  if (hash === '#dashboard/payment-link') return <><OAuthBridge /><KycGate><PaymentLinkPage /></KycGate></>;
  if (hash.startsWith('#pay?')) return <><OAuthBridge /><PublicPaymentPage route={hash} /></>;
  if (hash === '#dashboard' || hash.startsWith('#dashboard/')) return <><OAuthBridge /><KycGate><App /></KycGate></>;
  return <><OAuthBridge /><App /><HomeLegalFooter /></>;
}

function KycGate({ children }) {
  const [state,setState]=useState('loading'); const [approved,setApproved]=useState(false); const [wasBlocked,setWasBlocked]=useState(false);
  useEffect(()=>{let alive=true;const check=async()=>{try{const [c,m]=await Promise.all([api('/kyc/config'),api('/kyc/me')]);if(!alive)return;const blocked=!!c.enabled&&m.kycStatus!=='VERIFIED';setState(blocked?'blocked':'ok');if(blocked)setWasBlocked(true);if(wasBlocked&&!blocked)setApproved(true)}catch{if(alive)setState('ok')}};check();const id=setInterval(check,5000);return()=>{alive=false;clearInterval(id)}},[wasBlocked]);
  if(state==='loading') return <div className="kyc-gate-loading">Checking account verification…</div>;
  if(state==='blocked') return <div className="kyc-gate"><div className="kyc-gate-card"><div className="kyc-gate-icon">✓</div><h1>KYC Verification Required</h1><p>Administrator has enabled mandatory KYC. Complete your Aadhaar + PAN verification before using the gateway.</p><button onClick={()=>{window.location.hash='dashboard/kyc'}}>Complete KYC</button><small>KYC fee is configured by the administrator.</small></div></div>;
  return <>{children}{approved&&<div className="kyc-popup"><div><div className="kyc-gate-icon">✓</div><h2>Your KYC Verified</h2><p>Your KYC has been successfully verified. You can now use the gateway.</p><button onClick={()=>setApproved(false)}>Continue</button></div></div>}</>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);
