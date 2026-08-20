import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, CheckCircle2, Copy, CreditCard, ExternalLink, Loader2, Mail, ShieldCheck, Sparkles, X } from 'lucide-react';
import QRCode from 'qrcode';
import { getMySubscription, getSubscriptionOrder, getSubscriptionPlans, getSubscriptionVerification, getMerchants, verifyMerchant, purchaseSubscription } from './api';
import './subscription.css';

export default function SubscriptionPage() {
  const [plans, setPlans] = useState([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState('');
  const [error, setError] = useState(''), [order, setOrder] = useState(null), [qr, setQr] = useState('');
  const [success, setSuccess] = useState(null), [expired, setExpired] = useState(false);
  const [verification, setVerification] = useState({ verified: false, merchant: null }), [merchants, setMerchants] = useState([]);
  const [verifyingMerchant, setVerifyingMerchant] = useState('');
  const pollRef = useRef(null), expiryRef = useRef(null), verificationPollRef = useRef(null);

  const refreshVerification = async () => { try { const [status, list] = await Promise.all([getSubscriptionVerification(), getMerchants()]); setVerification(status); setMerchants(list.merchants || []); return status; } catch (_) { return null; } };

  useEffect(() => {
    getSubscriptionPlans().then(data => setPlans(data.plans || [])).catch(err => setError(err.message || 'Unable to load plans')).finally(() => setLoading(false));
    if (localStorage.getItem('gateway_access_token')) refreshVerification();
    const checkSubscription = async () => { if (!localStorage.getItem('gateway_access_token')) return; try { const data = await getMySubscription(); if (data.expired) setExpired(true); await refreshVerification(); } catch (_) {} };
    checkSubscription(); expiryRef.current = setInterval(checkSubscription, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); if (expiryRef.current) clearInterval(expiryRef.current); if (verificationPollRef.current) clearInterval(verificationPollRef.current); };
  }, []);

  const startVerificationPolling = () => {
    if (verificationPollRef.current) clearInterval(verificationPollRef.current); let checks = 0;
    verificationPollRef.current = setInterval(async () => { checks += 1; const status = await refreshVerification(); if (status?.verified || checks >= 30) { clearInterval(verificationPollRef.current); verificationPollRef.current = null; setVerifyingMerchant(''); } }, 3000);
  };

  const connectMerchantGmail = async merchant => {
    if (!merchant?.upiId) { setError('First add the UPI ID for this merchant.'); return; }
    setError(''); setVerifyingMerchant(String(merchant._id));
    try { const data = await verifyMerchant(merchant._id); if (data.verified) { await refreshVerification(); setVerifyingMerchant(''); return; } if (data.url) { const popup = window.open(data.url, 'omniupi-gmail-verify', 'width=520,height=720,noopener,noreferrer'); if (!popup) window.location.href = data.url; startVerificationPolling(); } else setVerifyingMerchant(''); }
    catch (err) { setError(err.message || 'Unable to start Google verification'); setVerifyingMerchant(''); }
  };

  const buy = async plan => {
    if (!localStorage.getItem('gateway_access_token')) { window.location.href = '/#login'; return; }
    const current = verification.verified ? verification : await refreshVerification();
    if (!current?.verified) { setError('Google/Gmail verification is required before purchasing a subscription.'); return; }
    setBusy(plan._id); setError('');
    try { const data = await purchaseSubscription(plan._id); const q = await QRCode.toDataURL(data.order.paymentUrl, { width: 360, margin: 2, errorCorrectionLevel: 'M' }); setQr(q); setOrder(data.order); startPaymentStatusPolling(data.order.orderId); }
    catch (err) { setError(err.message || 'Unable to create payment'); if (err.code === 'MERCHANT_GMAIL_VERIFICATION_REQUIRED') await refreshVerification(); }
    finally { setBusy(''); }
  };

  const startPaymentStatusPolling = orderId => {
    if (pollRef.current) clearInterval(pollRef.current); let checks = 0;
    pollRef.current = setInterval(async () => {
      checks += 1;
      try { const data = await getSubscriptionOrder(orderId); if (data.order?.status === 'SUCCESS') { clearInterval(pollRef.current); pollRef.current = null; setOrder(null); setQr(''); setSuccess({ amount: data.order.amount, plan: data.order.plan, expiresAt: data.order.expiresAt, utr: data.order.utr }); } else if (data.order?.status === 'EXPIRED' || checks >= 120) { clearInterval(pollRef.current); pollRef.current = null; } }
      catch (_) {}
    }, 3000);
  };

  const openPayment = () => { if (order?.paymentUrl) window.location.href = order.paymentUrl; };
  const copyUpi = async () => { if (order?.upiId) { try { await navigator.clipboard.writeText(order.upiId); } catch (_) {} } };

  return <div className="subscription-page">
    <header className="subscription-header"><div className="subscription-brand"><span>ϟ</span><b>OmniUPI</b></div><a href="/" className="subscription-home">Home</a></header>
    <main className="subscription-main">
      <div className="subscription-heading"><span className="subscription-eyebrow">OMNIUPI SUBSCRIPTION</span><h1>Choose Your Plan</h1><p>Secure UPI checkout • Instant activation after payment verification</p></div>
      {error && <div className="subscription-error">{error}</div>}
      {!verification.verified && localStorage.getItem('gateway_access_token') && <section className="subscription-verification-card"><div className="subscription-verification-icon"><ShieldCheck size={27}/></div><div className="subscription-verification-copy"><span className="subscription-eyebrow">REQUIRED BEFORE PAYMENT</span><h2>Verify your UPI account</h2><p>Connect the Google account/Gmail that receives payment notifications for your UPI ID. OmniUPI uses Gmail read-only access to confirm the payment account.</p>{merchants.length ? <div className="subscription-merchant-list">{merchants.map(m => <div className="subscription-merchant-row" key={m._id}><div><b>{m.name}</b><span>{m.upiId || 'UPI ID not added'}{m.verifiedEmail ? ` • ${m.verifiedEmail}` : ''}</span></div><button onClick={() => connectMerchantGmail(m)} disabled={!m.upiId || verifyingMerchant === String(m._id)}>{verifyingMerchant === String(m._id) ? <><Loader2 className="spin" size={16}/> Verifying…</> : <><Mail size={16}/> Verify with Google</>}</button></div>)}</div> : <div className="subscription-no-merchant"><p>Add your merchant/UPI ID first.</p><a href="/#dashboard">Open Merchant Dashboard <ExternalLink size={15}/></a></div>}</div></section>}
      {verification.verified && <div className="subscription-verification-success"><CheckCircle2 size={18}/><span><b>UPI account verified</b> — your payment account is ready for secure subscription checkout.</span></div>}
      {loading ? <div className="subscription-loading"><Loader2 className="spin" /> Loading plans…</div> : <div className="subscription-grid">{plans.map((plan, index) => <article className={`subscription-card ${plan.popular || index === 1 ? 'featured' : ''}`} key={plan._id}>{plan.popular || index === 1 ? <div className="subscription-popular">Popular</div> : null}<div className="subscription-card-head"><div className="subscription-plan-icon"><CreditCard size={28}/></div><h2>{plan.name}</h2><div className="subscription-price">₹{Number(plan.price).toLocaleString('en-IN')}<small>/{plan.durationDays >= 365 ? 'yr' : 'mo'}</small></div><div className="subscription-duration"><CalendarDays size={18}/> {durationLabel(plan.durationDays)}</div></div><div className="subscription-features"><h3><Check size={18}/> Features</h3>{(plan.features || []).map((feature, i) => <div className="subscription-feature" key={`${feature}-${i}`}><Check size={18}/> <span>{feature}</span></div>)}</div><button className="subscription-buy" onClick={() => buy(plan)} disabled={!verification.verified || busy === plan._id}>{busy === plan._id ? <><Loader2 className="spin" size={18}/> Creating Payment…</> : verification.verified ? <>Get Started <ArrowRight size={19}/></> : <>Verify UPI First <ShieldCheck size={18}/></>}</button></article>)}</div>}
      {!loading && !plans.length && !error && <div className="subscription-empty">No active subscription plans are available right now.</div>}
    </main>

    {order && <div className="subscription-modal-backdrop"><div className="subscription-modal payment-modal"><button className="subscription-close" onClick={() => setOrder(null)}><X size={20}/></button><div className="payment-badge"><Sparkles size={18}/> SECURE UPI CHECKOUT</div><h2>Complete Your Payment</h2><p className="payment-plan"><b>{order.plan}</b> • ₹{Number(order.amount).toLocaleString('en-IN')}</p><div className="qr-shell">{qr ? <img src={qr} alt="UPI payment QR"/> : <Loader2 className="spin"/>}</div><p className="scan-text">Scan with any UPI app</p><div className="upi-row"><span>{order.upiId}</span><button onClick={copyUpi}><Copy size={17}/></button></div><button className="subscription-pay" onClick={openPayment}>Pay ₹{Number(order.amount).toLocaleString('en-IN')} <ArrowRight size={18}/></button><div className="payment-wait"><span className="pulse-dot"/> Waiting for payment confirmation…</div><small>After your payment reaches the admin UPI, OmniUPI automatically verifies it and activates your plan.</small></div></div>}

    {success && <div className="subscription-modal-backdrop success-backdrop"><div className="subscription-modal success-modal"><div className="success-particles"><i/><i/><i/><i/><i/><i/></div><div className="success-ring"><div className="success-ring-inner"><Check size={42}/></div></div><div className="success-label">PAYMENT SUCCESSFUL</div><h2>Plan Activated!</h2><p className="success-main">Your <b>{success.plan}</b> plan is now active.</p><div className="success-details"><div><span>Amount Paid</span><b>₹{Number(success.amount).toLocaleString('en-IN')}</b></div><div><span>Valid Until</span><b>{formatDate(success.expiresAt)}</b></div></div>{success.utr && <div className="utr-line">Transaction ID <b>{success.utr}</b></div>}<button className="subscription-pay" onClick={() => setSuccess(null)}>Continue <ArrowRight size={18}/></button></div></div>}
    {expired && <div className="subscription-modal-backdrop"><div className="subscription-modal expired-modal"><div className="expired-icon">!</div><h2>Your Plan Has Expired</h2><p>Your subscription expired. Renew a plan to continue using premium gateway features.</p><button className="subscription-pay" onClick={() => setExpired(false)}>Renew Plan <ArrowRight size={18}/></button></div></div>}
  </div>;
}

function formatDate(value) { if (!value) return '—'; return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function durationLabel(days) { const d = Number(days || 0); if (d % 365 === 0) return `${d / 365} Year${d / 365 === 1 ? '' : 's'}`; if (d % 30 === 0) return `${d / 30} Month${d / 30 === 1 ? '' : 's'}`; return `${d} Day${d === 1 ? '' : 's'}`; }
