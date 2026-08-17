import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, CreditCard, Loader2, X } from 'lucide-react';
import { getMySubscription, getSubscriptionOrder, getSubscriptionPlans, purchaseSubscription } from './api';
import './subscription.css';

export default function SubscriptionPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expired, setExpired] = useState(false);
  const pollRef = useRef(null);
  const expiryRef = useRef(null);

  useEffect(() => {
    getSubscriptionPlans().then(data => setPlans(data.plans || [])).catch(err => setError(err.message || 'Unable to load plans')).finally(() => setLoading(false));

    const checkSubscription = async () => {
      if (!localStorage.getItem('gateway_access_token')) return;
      try {
        const data = await getMySubscription();
        if (data.expired) {
          const key = `subscription-expired-${data.expiresAt || 'unknown'}`;
          if (localStorage.getItem('subscription-expired-popup') !== key) {
            localStorage.setItem('subscription-expired-popup', key);
            setExpired(true);
          }
        }
      } catch (_) {}
    };

    checkSubscription();
    expiryRef.current = setInterval(checkSubscription, 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, []);

  const buy = async (plan) => {
    if (!localStorage.getItem('gateway_access_token')) { window.location.href = '/#login'; return; }
    setBusy(plan._id); setError('');
    try {
      const data = await purchaseSubscription(plan._id);
      setOrder(data.order);
      startPaymentStatusPolling(data.order.orderId);
    } catch (err) { setError(err.message || 'Unable to create payment'); } finally { setBusy(''); }
  };

  const startPaymentStatusPolling = (orderId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let checks = 0;
    pollRef.current = setInterval(async () => {
      checks += 1;
      try {
        const data = await getSubscriptionOrder(orderId);
        if (data.order?.status === 'SUCCESS') {
          clearInterval(pollRef.current); pollRef.current = null; setOrder(null);
          setSuccess({ amount: data.order.amount, plan: data.order.plan, expiresAt: data.order.expiresAt });
        } else if (data.order?.status === 'EXPIRED' || checks >= 60) {
          clearInterval(pollRef.current); pollRef.current = null;
        }
      } catch (_) {}
    }, 5000);
  };

  const openPayment = () => { if (order?.paymentUrl) window.open(order.paymentUrl, '_blank', 'noopener,noreferrer'); };

  return (
    <div className="subscription-page">
      <header className="subscription-header"><div className="subscription-brand"><span>ϟ</span><b>OmniUPI</b></div><a href="/" className="subscription-home">Home</a></header>
      <main className="subscription-main">
        <div className="subscription-heading"><span className="subscription-eyebrow">SUBSCRIPTION</span><h1>Choose Your Plan</h1><p>Flexible plans for your business growth</p></div>
        {error && <div className="subscription-error">{error}</div>}
        {loading ? <div className="subscription-loading"><Loader2 className="spin" /> Loading plans…</div> : <div className="subscription-grid">
          {plans.map((plan, index) => <article className={`subscription-card ${plan.popular || index === 1 ? 'featured' : ''}`} key={plan._id}>
            {plan.popular || index === 1 ? <div className="subscription-popular">Popular</div> : null}
            <div className="subscription-card-head"><div className="subscription-plan-icon"><CreditCard size={28} /></div><h2>{plan.name}</h2><div className="subscription-price">₹{Number(plan.price).toLocaleString('en-IN')}<small>/mo</small></div><div className="subscription-duration"><CalendarDays size={18} /> {durationLabel(plan.durationDays)}</div></div>
            <div className="subscription-features"><h3><Check size={18} /> Features</h3>{(plan.features || []).map((feature, i) => <div className="subscription-feature" key={`${feature}-${i}`}><Check size={18} /> <span>{feature}</span></div>)}</div>
            <button className="subscription-buy" onClick={() => buy(plan)} disabled={busy === plan._id}>{busy === plan._id ? <><Loader2 className="spin" size={18}/> Creating Payment…</> : <>Get Started <ArrowRight size={19}/></>}</button>
          </article>)}
        </div>}
        {!loading && !plans.length && !error && <div className="subscription-empty">No active subscription plans are available right now.</div>}
      </main>

      {order && <div className="subscription-modal-backdrop"><div className="subscription-modal"><button className="subscription-close" onClick={() => setOrder(null)}><X size={20}/></button><div className="subscription-modal-icon">₹</div><h2>Payment Ready</h2><p>{order.plan} plan • <b>₹{Number(order.amount).toLocaleString('en-IN')}</b></p><div className="subscription-order">Order ID: <b>{order.orderId}</b></div><button className="subscription-pay" onClick={openPayment}>Pay ₹{Number(order.amount).toLocaleString('en-IN')} <ArrowRight size={18}/></button><small>UPI payment amount is generated automatically from this plan. After payment is verified, your subscription will activate automatically.</small></div></div>}
      {success && <div className="subscription-modal-backdrop"><div className="subscription-modal success-modal"><div className="success-check">✓</div><h2>Purchase Successful!</h2><p className="success-main">Your <b>{success.plan}</b> plan is now active.</p><div className="success-details"><div><span>Amount Paid</span><b>₹{Number(success.amount).toLocaleString('en-IN')}</b></div><div><span>Plan Expiry</span><b>{formatDate(success.expiresAt)}</b></div></div><button className="subscription-pay" onClick={() => setSuccess(null)}>Continue <ArrowRight size={18}/></button></div></div>}
      {expired && <div className="subscription-modal-backdrop"><div className="subscription-modal expired-modal"><div className="expired-icon">!</div><h2>Your Plan Has Expired</h2><p>Your subscription has expired. Please resubscribe to continue using premium gateway features.</p><button className="subscription-pay" onClick={() => setExpired(false)}>Resubscribe <ArrowRight size={18}/></button></div></div>}
    </div>
  );
}

function formatDate(value) { if (!value) return '—'; return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function durationLabel(days) { const d = Number(days || 0); if (d % 365 === 0) return `${d / 365} Year${d / 365 === 1 ? '' : 's'}`; if (d % 30 === 0) return `${d / 30} Month${d / 30 === 1 ? '' : 's'}`; return `${d} Day${d === 1 ? '' : 's'}`; }
