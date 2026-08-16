import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Transactions from './Transactions.jsx';
import { CheckoutPage, PaymentLinkPage, PublicPaymentPage } from './CheckoutRoutesV2.jsx';
import SubscriptionPage from './SubscriptionPage.jsx';
import './styles.css';
import './dashboard.css';

function Root() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (window.location.pathname === '/auth' || hash === '#subscription' || hash === '#dashboard/subscription') {
    return <SubscriptionPage />;
  }
  if (hash === '#dashboard/transactions') {
    return <Transactions onBack={() => { window.location.hash = 'dashboard'; }} />;
  }
  if (hash === '#dashboard/checkout') {
    return <CheckoutPage />;
  }
  if (hash === '#dashboard/payment-link') {
    return <PaymentLinkPage />;
  }
  if (hash.startsWith('#pay?')) {
    return <PublicPaymentPage route={hash} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
