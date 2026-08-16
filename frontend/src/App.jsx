import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, Check, ChevronDown, CircleDollarSign,
  Clock3, Code2, CreditCard, Download, ExternalLink, FileText, HelpCircle, Home,
  KeyRound, Link2, LockKeyhole, LogOut, Menu, MessageSquare, Pencil, Plus,
  RefreshCw, Save, Settings2, ShieldCheck, Sparkles, Store, Trash2, TrendingUp,
  UserRound, Users, WalletCards, X, Zap
} from 'lucide-react';
import { login, logout, register } from './api';
import './auth.css';

const MERCHANT_TYPES = [
  'Paytm Business',
  'BharatPe Merchant',
  'Google Pay Business',
  'PhonePe Business',
  'FamPay wallet',
  'Slice BANK',
  'Digikhata',
  'NetBanking - Direct UPI ID',
  'UPI - Direct UPI ID',
  'Amazon Pay (coming soon)'
];

const initialMerchants = [];

function App() {
  const [auth, setAuth] = useState(null);
  const [route, setRoute] = useState(window.location.hash.replace('#', '') || 'home');

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#', '') || 'home');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (page) => {
    window.location.hash = page;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (route === 'dashboard' || route.startsWith('dashboard/')) {
    return <Dashboard route={route} go={go} />;
  }
  if (auth) return <AuthPage mode={auth} onClose={() => setAuth(null)} />;
  return <Landing onAuth={setAuth} go={go} />;
}

function Landing({ onAuth, go }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };
  return <div className="landing">
    <header className="site-header">
      <button className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span className="logo-mark">ϟ</span><span>Seox</span></button>
      <nav className={menuOpen ? 'site-nav open' : 'site-nav'}>
        <button onClick={() => scrollTo('features')}>Features</button>
        <button onClick={() => scrollTo('pricing')}>Pricing</button>
        <button onClick={() => scrollTo('security')}>Security</button>
        <button onClick={() => scrollTo('how-it-works')}>How it works</button>
        <button className="nav-login" onClick={() => onAuth('login')}>Login</button>
        <button className="nav-signup" onClick={() => onAuth('signup')}>Start Free Trial</button>
      </nav>
      <button className="mobile-menu" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">{menuOpen ? <X size={27}/> : <Menu size={27}/>}</button>
    </header>
    <main>
      <section className="hero-section"><div className="hero-glow glow-one"/><div className="hero-glow glow-two"/><div className="hero-copy"><div className="pill"><span>●</span> Modern UPI Payment Infrastructure</div><h1>UPI <em>Payments</em><br/>Gateway for Modern<br/>Businesses</h1><p>Experience the next generation of payment processing with our elite UPI gateway. Fast, secure, and designed for scale.</p><div className="hero-actions"><button className="gradient-btn" onClick={() => onAuth('signup')}><Zap size={20}/> Start Free Trial <ArrowRight size={18}/></button><button className="light-btn" onClick={() => scrollTo('demo')}><WalletCards size={18}/> Test Payment</button></div><div className="metrics"><Metric value="99.9%" label="UPTIME"/><Metric value="2M+" label="TRANSACTIONS"/><Metric value="50ms" label="PROCESSING"/></div></div><div className="payment-card-wrap" id="demo"><div className="payment-card"><div className="card-top"><span className="card-logo">ϟ</span><span>SEOX</span></div><div className="dots">•••• &nbsp; •••• &nbsp; •••• &nbsp; <b>4287</b></div><div className="card-bottom"><div><small>CARD HOLDER</small><strong>JOHN SMITH</strong></div><div><small>EXPIRES</small><strong>05/28</strong></div></div></div><div className="mini-payment"><div><span>Payment received</span><b>₹5,000.00</b></div><span className="paid">✓ Paid</span></div></div></section>
      <section className="why-section" id="features"><SectionHeading title="Why Choose" accent="Seox" text="Built for businesses that want reliable payments, powerful tools, and a simple merchant experience."/><div className="feature-grid"><FeatureCard title="Lightning Fast" text="Process payments quickly with optimized infrastructure." Icon={Zap}/><FeatureCard title="Bank-Level Security" text="Secure authentication and protected payment data." Icon={ShieldCheck}/><FeatureCard title="Smart Analytics" text="Gain insights with real-time transaction analytics." Icon={BarChart3}/></div></section>
      <section className="pricing-section" id="pricing"><SectionHeading title="Choose Your" accent="Subscription Plan" text="Select the perfect plan for your business needs."/><div className="plans-grid">{[['Basic','₹999.00','1 Month'],['Starter','₹2,999.00','3 Months'],['Business','₹5,999.00','6 Months'],['Enterprise','₹9,999.00','12 Months']].map(([n,p,d],i)=><article className={i===1?'plan-card featured':'plan-card'} key={n}>{i===1&&<div className="popular">Popular</div>}<div className="plan-icon"><CreditCard/></div><h3>{n}</h3><div className="price">{p}<small>/plan</small></div><div className="valid">Valid for {d}</div><hr/><div className="check"><Check size={18}/> Secure UPI payments</div><div className="check"><Check size={18}/> Transaction analytics</div><button className="plan-btn" onClick={() => onAuth('signup')}>Get Started</button></article>)}</div></section>
      <section className="steps-section" id="how-it-works"><SectionHeading title="Get Started in" accent="Minutes" text="Go from account creation to payment-ready infrastructure in four simple steps."/><div className="steps">{[['1','Create Account','Sign up and start your trial.'],['2','Integrate API','Use our APIs and SDKs.'],['3','Go Live','Start accepting UPI payments.'],['4','Scale & Grow','Use analytics as your business expands.']].map(([n,t,d])=><div className="step" key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></div>)}</div></section>
      <section className="security-section" id="security"><SectionHeading title="Your Security is Our" accent="Priority" text="Multiple layers of security help keep your account and transactions protected."/><div className="security-grid"><FeatureCard title="End-to-End Encryption" text="Sensitive data is protected in transit and at rest." Icon={LockKeyhole}/><FeatureCard title="Secure Authentication" text="Modern authentication protects your account." Icon={UserRound}/><FeatureCard title="Transaction Protection" text="Designed to keep payment activity controlled and visible." Icon={ShieldCheck}/></div></section>
    </main>
    <footer className="footer"><div className="footer-brand"><h2>Seox</h2><p>Modern UPI payment infrastructure for businesses.</p></div><div className="copyright">© 2026 Seox. All rights reserved.</div></footer>
  </div>;
}

function AuthPage({ mode, onClose }) {
  const [tab, setTab] = useState(mode);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (tab === 'login') await login(email, password); else await register(name, email, password);
      window.location.hash = 'dashboard';
    } catch (err) { setError(err.message || 'Unable to continue'); } finally { setLoading(false); }
  };
  return <div className="auth-page"><div className="auth-bg auth-bg-one"/><div className="auth-bg auth-bg-two"/><header className="auth-header"><button className="logo" onClick={onClose}><span className="logo-mark">ϟ</span><span>Seox</span></button><button className="back-btn" onClick={onClose}><ArrowLeft size={18}/> Back to home</button></header><div className="auth-center"><div className="auth-page-card"><div className="auth-badge">SECURE MERCHANT ACCESS</div><h1>{tab==='login'?'Welcome Back':'Start Your Free Trial'}</h1><p>{tab==='login'?'Login to access your Seox merchant dashboard.':'Create your account and get 2 days of free trial access.'}</p><div className="auth-tabs"><button className={tab==='login'?'active':''} onClick={()=>{setTab('login');setError('')}}>Login</button><button className={tab==='signup'?'active':''} onClick={()=>{setTab('signup');setError('')}}>Sign up</button></div><form onSubmit={submit} className="auth-form-page">{tab==='signup'&&<label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name" required/></label>}<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 8 characters" minLength="8" required/></label><button className="auth-main-btn" disabled={loading}>{loading?'Please wait…':tab==='login'?'Login to Dashboard':'Create Account & Start Trial'} <ArrowRight size={17}/></button></form><div className="or"><span/>or<span/></div><button className="google-btn" type="button" onClick={()=>setError('Google OAuth will be connected to the merchant verification flow.')}>G <span>{tab==='login'?'Continue with Google':'Sign up with Google'}</span></button>{error&&<div className="auth-error">{error}</div>}<small className="trial-note">{tab==='signup'?<>New accounts receive a <b>2-day free trial</b>.</>:'Your account and payment data are protected with secure authentication.'}</small></div></div></div>;
}

function Dashboard({ route, go }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [merchants, setMerchants] = useState(() => { try { return JSON.parse(localStorage.getItem('seox_merchants') || '[]'); } catch { return initialMerchants; } });
  const [profileName] = useState(() => localStorage.getItem('seox_profile_name') || 'Merchant');
  const page = route.split('/')[1] || 'dashboard';

  useEffect(() => localStorage.setItem('seox_merchants', JSON.stringify(merchants)), [merchants]);

  const openPage = (p) => { setMenuOpen(false); go(`dashboard/${p}`); };
  const logoutUser = () => { logout(); go('home'); };

  return <div className="dashboard-shell">
    <header className="dash-topbar"><button className="dash-menu-btn" onClick={()=>setMenuOpen(v=>!v)}><Menu size={28}/></button><button className="dash-logo" onClick={()=>openPage('home')}><span>ϟ</span> Seox</button><div className="dash-top-actions"><div className="trial-pill"><Sparkles size={15}/> 2026-08-17 - Active</div><button className="icon-btn"><Bell size={20}/></button><button className="avatar-btn"><span>{profileName.charAt(0).toUpperCase()}</span></button></div></header>
    {menuOpen&&<><div className="dash-overlay" onClick={()=>setMenuOpen(false)}/><SideMenu openPage={openPage} logoutUser={logoutUser} profileName={profileName}/></>}
    <main className="dash-main">
      {page==='home' && <DashboardHome merchants={merchants} openPage={openPage} profileName={profileName}/>} 
      {page==='connect' && <ConnectMerchant merchants={merchants} setMerchants={setMerchants} openPage={openPage}/>} 
      {page==='transactions' && <SimplePage icon={TrendingUp} title="Transactions" text="Your transaction history will appear here."/>}
      {page==='payment-link' && <SimplePage icon={Link2} title="Payment Link" text="Create and manage payment links here."/>}
      {page==='checkout' && <SimplePage icon={Pencil} title="Edit Checkout Page" text="Customize your customer checkout experience here."/>}
      {page==='subscription' && <SimplePage icon={CreditCard} title="Subscription" text="Manage your Seox subscription here."/>}
      {page==='account' && <SimplePage icon={UserRound} title="Account & IP Whitelist" text="Manage account access and approved IP addresses."/>}
      {page==='password' && <SimplePage icon={KeyRound} title="Change Password" text="Change your dashboard password securely."/>}
      {page==='api' && <SimplePage icon={Code2} title="API Details" text="Your API credentials and integration details will appear here."/>}
      {page==='apk' && <SimplePage icon={Download} title="Merchant APK" text="Merchant application downloads will appear here."/>}
      {page==='video' && <SimplePage icon={ExternalLink} title="Video For Merchant" text="Merchant setup videos will appear here."/>}
      {page==='docs' && <SimplePage icon={FileText} title="Documentation" text="API and integration documentation will appear here."/>}
      {page==='support' && <SimplePage icon={MessageSquare} title="Support Ticket" text="Create and manage support tickets here."/>}
      {page==='faq' && <SimplePage icon={HelpCircle} title="FAQ" text="Frequently asked questions will appear here."/>}
      {page==='sdk' && <SimplePage icon={Download} title="SDK File" text="SDK files will appear here."/>}
    </main>
  </div>;
}

function SideMenu({ openPage, logoutUser, profileName }) {
  return <aside className="side-drawer"><div className="drawer-profile"><div className="drawer-avatar">{profileName.charAt(0).toUpperCase()}</div><div><strong>{profileName}</strong><span>API Partner</span></div><button onClick={()=>openPage('home')}><X size={21}/></button></div><button className="drawer-item active" onClick={()=>openPage('home')}><Home size={21}/> Dashboard</button><div className="drawer-title">MERCHANT SETTING</div><DrawerButton icon={Link2} text="Connect Merchant" onClick={()=>openPage('connect')}/><DrawerButton icon={Link2} text="Payment Link" onClick={()=>openPage('payment-link')}/><DrawerButton icon={TrendingUp} text="Transactions" onClick={()=>openPage('transactions')}/><DrawerButton icon={Pencil} text="Edit Checkout Page" onClick={()=>openPage('checkout')}/><DrawerButton icon={CreditCard} text="Subscription" onClick={()=>openPage('subscription')}/><div className="drawer-title">ACCOUNT SETTING</div><DrawerButton icon={UserRound} text="Account & IP Whitelist" onClick={()=>openPage('account')}/><DrawerButton icon={KeyRound} text="Change Password" onClick={()=>openPage('password')}/><div className="drawer-title">DEVELOPER SETTING</div><DrawerButton icon={Code2} text="API Details" onClick={()=>openPage('api')}/><DrawerButton icon={Download} text="Merchant APK" onClick={()=>openPage('apk')}/><DrawerButton icon={ExternalLink} text="Video For Merchant" onClick={()=>openPage('video')}/><DrawerButton icon={FileText} text="Documentation" onClick={()=>openPage('docs')}/><DrawerButton icon={MessageSquare} text="Support Ticket" onClick={()=>openPage('support')}/><DrawerButton icon={HelpCircle} text="FAQ" onClick={()=>openPage('faq')}/><DrawerButton icon={Download} text="SDK File" onClick={()=>openPage('sdk')}/><button className="drawer-logout" onClick={logoutUser}><LogOut size={20}/> Logout</button></aside>;
}
function DrawerButton({icon:Icon,text,onClick}) { return <button className="drawer-item" onClick={onClick}><Icon size={21}/><span>{text}</span></button>; }

function DashboardHome({ merchants, openPage, profileName }) {
  const total = merchants.length;
  return <div className="dash-content"><div className="dash-welcome"><div><span className="eyebrow">MERCHANT DASHBOARD</span><h1>Welcome back, {profileName} 👋</h1><p>Manage your payments, merchants and account from one place.</p></div><button className="primary-action" onClick={()=>openPage('connect')}><Plus size={18}/> Connect Merchant</button></div><div className="stat-grid"><Stat title="Today Received" value="₹0.00" icon={CircleDollarSign} tone="green"/><Stat title="Success Transactions" value="0" icon={Check} tone="blue"/><Stat title="Pending Payment" value="₹0.00" icon={Clock3} tone="yellow"/><Stat title="Failed Payment" value="₹0.00" icon={X} tone="pink"/></div><div className="success-card"><div className="rate-ring">0%<small>Rate</small></div><div><h3>Success Rate <span>(7 Days)</span></h3><div className="rate-legend"><b>● 0 Success</b><b>● 0 Failed</b><span>0 Total</span></div></div></div><div className="info-strip"><div className="login-icon">↪</div><span>Secure merchant session</span><b>Online</b></div><div className="chart-card"><div className="card-heading"><div><h3>Transaction Trends</h3><p>Monitor your 7-day payment activity.</p></div><div className="range-tabs"><button className="active">7D</button><button>30D</button></div></div><div className="empty-chart"><TrendingUp size={30}/><span>No transaction data yet</span><small>Your chart will populate after the first payment.</small></div></div><div className="recent-card"><div className="card-heading"><div><h3>Recent Transactions</h3><p>Your latest payment activity.</p></div><button onClick={()=>openPage('transactions')}>View All <ArrowRight size={16}/></button></div><div className="empty-state"><WalletCards size={42}/><p>No transactions found</p></div></div><div className="merchant-preview"><div className="card-heading"><div><h3>My Merchants</h3><p>{total} merchant{total===1?'':'s'} connected</p></div><button onClick={()=>openPage('connect')}>Manage <ArrowRight size={16}/></button></div>{total===0?<div className="empty-state compact"><Store size={34}/><p>No merchants connected yet.</p></div>:merchants.slice(0,3).map(m=><div className="merchant-row" key={m.id}><div className="merchant-logo">{m.type.slice(0,1)}</div><div><strong>{m.label}</strong><span>{m.type} • {m.mobile}</span></div><span className={m.verified?'status-ok':'status-pending'}>{m.verified?'Verified':'Pending'}</span></div>)}</div></div>;
}
function Stat({title,value,icon:Icon,tone}) { return <div className={`stat-card ${tone}`}><div className="stat-icon"><Icon size={21}/></div><span>{title}</span><strong>{value}</strong><small>↑ 0%</small></div>; }

function ConnectMerchant({ merchants, setMerchants, openPage }) {
  const [rotation, setRotation] = useState('off'); const [interval, setIntervalValue] = useState('5');
  const [type, setType] = useState(''); const [label, setLabel] = useState(''); const [mobile, setMobile] = useState('');
  const [selected, setSelected] = useState(null);
  const [verifyStep, setVerifyStep] = useState(null);
  const [upiId, setUpiId] = useState(''); const [googleBusy, setGoogleBusy] = useState(false);
  const [toast, setToast] = useState('');

  const addMerchant = () => {
    if (!type || !label.trim() || !/^\d{10}$/.test(mobile)) { setToast('Select merchant type, enter label and a valid 10-digit mobile number.'); return; }
    const m = { id: Date.now(), type, label: label.trim(), mobile, verified:false, createdAt:new Date().toISOString() };
    setMerchants(prev => [...prev, m]); setType(''); setLabel(''); setMobile(''); setToast('Merchant added. Verify it to activate.');
  };
  const verifyMerchant = (merchant) => { setSelected(merchant); setUpiId(''); setVerifyStep('upi'); };
  const saveUpi = () => { if (!/^[\w.-]+@[\w.-]+$/.test(upiId.trim())) { setToast('Enter a valid UPI ID, for example name@upi.'); return; } setMerchants(prev=>prev.map(m=>m.id===selected.id?{...m,upiId:upiId.trim()}:m)); setVerifyStep('google'); };
  const googleSignIn = async () => { setGoogleBusy(true); setToast('Google sign-in window can be connected to your OAuth client here.'); setTimeout(()=>{ setGoogleBusy(false); setVerifyStep('done'); setMerchants(prev=>prev.map(m=>m.id===selected.id?{...m,verified:true,googleConnected:true}:m)); },900); };
  const removeMerchant = (id) => { setMerchants(prev=>prev.filter(m=>m.id!==id)); };

  return <div className="dash-content connect-page"><div className="page-back" onClick={()=>openPage('home')}><ArrowLeft size={17}/> Dashboard</div><div className="page-title"><div><span className="eyebrow">MERCHANT SETTING</span><h1>Connect Merchant</h1><p>Connect your UPI merchant account and verify it with your UPI ID and Google account.</p></div></div>{toast&&<div className="dash-toast">{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
    <section className="settings-card"><div className="gradient-card-head"><Settings2 size={22}/><h2>Rotation Settings</h2></div><div className="settings-body"><select value={rotation} onChange={e=>setRotation(e.target.value)}><option value="off">⏸️ Rotation OFF</option><option value="on">▶️ Rotation ON</option></select><div className="settings-inline"><select value={interval} onChange={e=>setIntervalValue(e.target.value)}><option value="5">5 Minutes</option><option value="10">10 Minutes</option><option value="15">15 Minutes</option><option value="30">30 Minutes</option></select><button className="purple-btn"><Save size={17}/> Save Settings</button></div></div></section>
    <section className="settings-card"><div className="gradient-card-head"><Plus size={22}/><h2>Add New Merchant</h2></div><div className="add-merchant-body"><select value={type} onChange={e=>setType(e.target.value)}><option value="">Select Merchant</option>{MERCHANT_TYPES.map(x=><option key={x} value={x} disabled={x.includes('coming soon')}>{x}</option>)}</select><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Label"/><input value={mobile} onChange={e=>setMobile(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="10-digit Mobile" inputMode="numeric"/><button className="green-btn" onClick={addMerchant}><Plus size={18}/> Add Merchant</button></div></section>
    <section className="settings-card merchants-card"><div className="gradient-card-head"><Store size={22}/><h2>My Merchants</h2></div><div className="merchant-table-wrap"><table><thead><tr><th>#</th><th>Type</th><th>Label</th><th>Mobile</th><th>Status</th><th>Rotation</th><th>Priority & Limit</th><th>Used</th><th>Remaining</th><th>Added</th><th>Actions</th></tr></thead><tbody>{merchants.length===0?<tr><td colSpan="11" className="table-empty">No merchants added yet.</td></tr>:merchants.map((m,i)=><tr key={m.id}><td>{i+1}</td><td><span className="type-chip">{m.type.slice(0,2)}</span></td><td><strong>{m.label}</strong></td><td>{m.mobile}</td><td><span className={m.verified?'status-ok':'status-pending'}>{m.verified?'Active':'Inactive'}</span></td><td><span className="switch on"></span></td><td><div className="limit-box"><input defaultValue="0"/><input defaultValue="0.00"/><button><Save size={14}/></button></div></td><td className="money-red">₹0.00</td><td className="money-green">₹0.00</td><td>{new Date(m.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})}</td><td><div className="action-stack"><button className="verify-btn" onClick={()=>verifyMerchant(m)}><ShieldCheck size={15}/> {m.verified?'Verified':'Verify'}</button><button className="delete-btn" onClick={()=>removeMerchant(m.id)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div></section>
    {selected&&<div className="modal-backdrop"><div className="verify-modal">{verifyStep!=='done'&&<button className="modal-close" onClick={()=>setSelected(null)}><X size={19}/></button>}<div className="verify-brand">ϟ</div><h2>{verifyStep==='upi'?'Enter UPI ID':verifyStep==='google'?'Connect Gmail':'Merchant Verified'}</h2><p>{verifyStep==='upi'?'Enter the UPI ID linked with this merchant account.':verifyStep==='google'?'Your UPI ID was saved. Now sign in with Google to connect the merchant Gmail.':'Your merchant has been successfully verified and activated.'}</p><div className="verify-steps"><span className="done">✓</span><i/><span className={verifyStep==='google'?'current':''}>2</span><i/><span className={verifyStep==='done'?'done':''}>{verifyStep==='done'?'✓':'3'}</span></div>{verifyStep==='upi'&&<><label>UPI ID<input value={upiId} onChange={e=>setUpiId(e.target.value)} placeholder="example@upi" autoFocus/></label><button className="verify-main" onClick={saveUpi}>Save UPI ID <ArrowRight size={17}/></button></>}{verifyStep==='google'&&<><div className="saved-upi"><Check size={17}/> UPI ID saved: <b>{upiId || selected.upiId}</b></div><button className="google-connect" onClick={googleSignIn} disabled={googleBusy}><span className="google-g">G</span>{googleBusy?'Connecting…':'Sign in with Google'}<ArrowRight size={17}/></button><button className="back-link" onClick={()=>setVerifyStep('upi')}><ArrowLeft size={15}/> Back</button></>}{verifyStep==='done'&&<><div className="verified-success"><Check size={42}/><strong>{selected.label}</strong><span>UPI + Google connected successfully</span></div><button className="verify-main" onClick={()=>{setSelected(null);setVerifyStep(null)}}>Done <Check size={17}/></button></>}</div></div>}
  </div>;
}

function SimplePage({icon:Icon,title,text}) { return <div className="dash-content"><div className="simple-page"><div className="simple-icon"><Icon size={31}/></div><span className="eyebrow">SE0X MERCHANT PORTAL</span><h1>{title}</h1><p>{text}</p><div className="coming-card"><Sparkles size={22}/><span>This section is ready for the next step.</span></div></div></div>; }
function Metric({value,label}) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function SectionHeading({title,accent,text}) { return <div className="section-heading"><h2>{title} <em>{accent}</em></h2><p>{text}</p></div>; }
function FeatureCard({title,text,Icon}) { return <article className="feature-card"><div className="feature-icon"><Icon size={45}/></div><h3>{title}</h3><p>{text}</p></article>; }

export default App;
