import React,{useEffect,useMemo,useState} from 'react';
import {Check,Clock3,Copy,ExternalLink,Link2,Menu,ShieldCheck,Smartphone,X,Zap,Download} from 'lucide-react';

const SETTINGS_KEY='omniupi_checkout_settings_v2';
const LINKS_KEY='omniupi_payment_links_v2';
// Shared payment links remain active until the payment flow is completed/handled by the existing backend.
// Keep the timestamp for backward compatibility with already-generated links, but do not reject a link
// merely because an old client-side expiry timestamp is present.
const LINK_TTL=365*24*60*60*1000;
const DEFAULT={brandName:'OmniUPI',theme:'#0B95BD',instructions:'Pay using any supported UPI app.\nVerify the amount before completing payment.',showQr:true,showIntent:true,logo:''};

function read(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}}
function merchant(){try{const ms=JSON.parse(localStorage.getItem('seox_merchants')||'[]');return ms.find(x=>x.verified&&x.upiId)||ms.find(x=>x.upiId)||null}catch{return null}}
function settingsFor(m){const key=m?.id?`${SETTINGS_KEY}:${m.id}`:SETTINGS_KEY;return {...DEFAULT,...read(key,{})}}
function upiUrl(upi,amount,note,brand){return `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(brand||'OmniUPI')}&am=${Number(amount||0).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note||'Payment')}`}
function qr(data){return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(data)}`}
function snapshot(s){return {brandName:s.brandName||DEFAULT.brandName,theme:s.theme||DEFAULT.theme,instructions:s.instructions||'',showQr:s.showQr!==false,showIntent:s.showIntent!==false,logo:s.logo||''}}

function Page({title,children}){return <div className="cx-page"><header><button onClick={()=>{location.hash='dashboard'}}><Menu size={25}/></button><button className="brandnav" onClick={()=>{location.hash='dashboard'}}><span>ϟ</span> OmniUPI</button><b>{title}</b><span className="trial">● 2-day Trial • Active</span></header><main>{children}</main></div>}
function Field({label,children}){return <label className="field"><b>{label}</b>{children}</label>}
function Warn({children}){return <div className="warn"><ShieldCheck size={18}/>{children}</div>}
function Stat({n,t}){return <div className="stat"><small>{t}</small><strong>{n}</strong></div>}

export function PaymentLinkPageFixed(){
 const m=merchant();
 const [customer,setCustomer]=useState(''),[mobile,setMobile]=useState(''),[amount,setAmount]=useState(''),[remark,setRemark]=useState('');
 const [links,setLinks]=useState(()=>read(LINKS_KEY,[])),[toast,setToast]=useState('');
 useEffect(()=>localStorage.setItem(LINKS_KEY,JSON.stringify(links)),[links]);
 const generate=()=>{
  const n=Number(amount);
  if(!m?.upiId){setToast('Verify a merchant first. Payment will use only the verified UPI ID.');return}
  if(!customer.trim()||!/^[0-9]{10}$/.test(mobile)||!Number.isFinite(n)||n<1){setToast('Enter customer name, valid 10-digit mobile and amount.');return}
  const createdAt=Date.now(); const expires=createdAt+LINK_TTL;
  const cfg=snapshot(settingsFor(m));
  const params=new URLSearchParams({customer:customer.trim(),mobile,amount:n.toFixed(2),remark:remark.trim(),upi:m.upiId,expires:String(expires),brand:cfg.brandName,color:cfg.theme,settings:JSON.stringify(cfg)});
  const link=`${location.origin}${location.pathname}#pay?${params.toString()}`;
  const item={id:'AG'+createdAt.toString(36).toUpperCase(),customer:customer.trim(),mobile,amount:n.toFixed(2),remark:remark.trim(),upi:m.upiId,expires,createdAt,settings:cfg,link};
  setLinks(p=>[item,...p]);setCustomer('');setMobile('');setAmount('');setRemark('');setToast('Payment link generated. It can be copied and shared without expiring immediately.');
 };
 const copy=async l=>{try{await navigator.clipboard.writeText(l);setToast('Payment link copied.')}catch{setToast('Copy failed')}};
 return <Page title="Payment Link Management"><section className="cx-card"><div className="hero"><Link2 size={34}/><div><h1>Payment Link Management</h1><p>Create links that open on your OmniUPI checkout.</p></div></div>{!m&&<Warn>Connect Merchant → Verify UPI ID before generating a link.</Warn>}{toast&&<div className="toast">{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}<div className="stats"><Stat n="₹0.00" t="TODAY'S COLLECTION"/><Stat n={links.length} t="LINKS TODAY"/><Stat n="1" t="ACCOUNT"/><Stat n={links.length?'Active':'No Links'} t="STATUS"/></div><div className="form"><div className="formhead"><h2>＋ Create New Payment Link</h2><span>◷ Shareable payment link</span></div><div className="grid2"><Field label="CUSTOMER NAME"><input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Enter customer name"/></Field><Field label="MOBILE NUMBER"><input value={mobile} onChange={e=>setMobile(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit mobile"/></Field><Field label="AMOUNT (₹)"><input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></Field><Field label="REMARK (OPTIONAL)"><input value={remark} onChange={e=>setRemark(e.target.value)} placeholder="e.g. Gift, Deposit"/></Field></div><button className="primary" onClick={generate}><Zap size={18}/> Generate Link</button><p className="bind-note">This link is locked to the amount and verified UPI ID. No Auto-pay/mandate is created.</p></div><div className="form"><div className="formhead"><h2>☷ My Links</h2><span>Total: {links.length}</span></div>{!links.length?<div className="empty"><Link2 size={46}/><h3>No Links Found</h3><p>Create your first link to get started.</p></div>:links.map(l=><div className="linkrow" key={l.id}><div><b>{l.customer} • ₹{l.amount}</b><small>{l.id} • {new Date(l.createdAt).toLocaleString('en-IN')}</small><code>{l.link}</code></div><div className="actions"><button onClick={()=>copy(l.link)}><Copy size={15}/> Copy</button><button onClick={()=>window.open(l.link,'_blank')}><ExternalLink size={15}/> Open</button></div></div>)}</div></section></Page>
}

function decodeOldData(raw){try{let x=String(raw||'').replace(/-/g,'+').replace(/_/g,'/');while(x.length%4)x+='=';return JSON.parse(decodeURIComponent(escape(atob(x))))}catch{return null}}
function parseSettings(q,legacy){try{return {...DEFAULT,...JSON.parse(q.get('settings')||'{}')}}catch{return {...DEFAULT,...(legacy?.settings||{}),brandName:q.get('brand')||legacy?.settings?.brandName||DEFAULT.brandName,theme:q.get('color')||legacy?.settings?.theme||DEFAULT.theme}}}
function formatTime(ms){const total=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function IntentButtons({href}){return <div className="intents"><a href={href}>◉ <b>PayTM</b><span>Pay via app ›</span></a><a href={href}>● <b>PhonePe</b><span>Pay via app ›</span></a><a href={href}>◉ <b>Google Pay</b><span>Pay via app ›</span></a></div>}
function Instructions({text}){const rows=(text||'').split('\n').map(x=>x.trim()).filter(Boolean);return rows.length?<div className="instructions"><b>Payment Instructions</b>{rows.map((x,i)=><div key={i}>✓ {x}</div>)}</div>:null}
function QrBlock({src,amount}){return <div className="qrblock"><b>▦ Scan & Pay</b><div><img src={src} alt="UPI QR"/><div><small>Scan to pay exactly ₹{amount.toFixed(2)}</small><a href={src} target="_blank" rel="noreferrer"><Download size={15}/> Download QR</a></div></div></div>}

export function PublicPaymentPageFixed({route}){
 const q=useMemo(()=>new URLSearchParams(route.startsWith('#')?route.slice(5):route.slice(4)),[route]);
 const legacy=useMemo(()=>decodeOldData(q.get('data')), [q]);
 const p=useMemo(()=>legacy||({customer:q.get('customer')||'Customer',mobile:q.get('mobile')||'',amount:Number(q.get('amount')||0),remark:q.get('remark')||'',upi:q.get('upi')||'',expires:Number(q.get('expires')||0)}),[q,legacy]);
 const s=useMemo(()=>parseSettings(q,legacy),[q,legacy]);
 const [copied,setCopied]=useState(false);
 const invalid=!p.upi||!Number.isFinite(Number(p.amount))||Number(p.amount)<=0;
 const intent=p.upi?upiUrl(p.upi,Number(p.amount),p.remark,s.brandName):'';
 if(invalid)return <PublicShell><div className="expired"><Clock3 size={50}/><h2>Payment Link Invalid</h2><p>This payment link is missing required payment information.</p></div></PublicShell>;
 return <PublicShell><div className="public-card"><div className="public-top" style={{background:`linear-gradient(135deg,${s.theme},#6d4bc0)`}}><div className="brand">{s.logo?<img src={s.logo} alt=""/>:<span>▣</span>}<b>{s.brandName}</b><i>Active payment link</i></div><small>Amount</small><strong>₹{Number(p.amount).toFixed(2)}</strong></div><div className="public-body"><div className="request"><small>PAYMENT REQUEST</small><h2>{p.customer}</h2>{p.remark&&<p>{p.remark}</p>}</div>{s.showQr&&<QrBlock src={qr(intent)} amount={Number(p.amount)}/>} {s.showIntent&&<IntentButtons href={intent}/>}<Instructions text={s.instructions}/><div className="receiving"><small>RECEIVING UPI ID</small><b>{p.upi}</b><button onClick={async()=>{try{await navigator.clipboard.writeText(p.upi);setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{}}}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?'Copied':'Copy'}</button></div><a className="pay" href={intent}><Smartphone size={18}/> Pay ₹{Number(p.amount).toFixed(2)} via UPI App</a><p className="fixed">🔒 Secure UPI payment • Amount is fixed to this request • No Auto-pay</p></div></div></PublicShell>
}
function PublicShell({children}){return <div className="public-shell"><div className="public-logo"><span>ϟ</span><h1>OmniUPI</h1></div>{children}<small className="powered">Powered by OmniUPI</small></div>}
