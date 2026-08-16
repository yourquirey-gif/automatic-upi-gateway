import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, Menu, Play, Rocket, ShieldCheck, LockKeyhole, UserRoundCheck, Sparkles, BarChart3, Zap, Shield, X } from 'lucide-react';
import { login, register } from './api';

const plans = [
  { name: 'Basic', price: '₹999.00', duration: '1 Month', icon: Sparkles, featured: false },
  { name: 'Starter', price: '₹2,999.00', duration: '3 Months', icon: CreditCardIcon, featured: true },
  { name: 'Business', price: '₹5,999.00', duration: '6 Months', icon: CreditCardIcon, featured: false },
  { name: 'Enterprise', price: '₹9,999.00', duration: '12 Months', icon: BuildingIcon, featured: false }
];

const featureCards = [
  { title: 'Lightning Fast', text: 'Process payments in milliseconds with our optimized infrastructure and direct bank integrations.', icon: Zap },
  { title: 'Bank-Level Security', text: 'Strong encryption, secure authentication, and advanced fraud protection for payment data.', icon: Shield },
  { title: 'Smart Analytics', text: 'Gain valuable insights with real-time dashboards and customizable reporting tools.', icon: BarChart3 }
];

const securityCards = [
  { title: 'End-to-End Encryption', text: 'All sensitive data is encrypted in transit and at rest using modern industry-standard protocols.', icon: LockKeyhole },
  { title: '2FA & Biometrics', text: 'Multi-factor authentication and biometric verification for enhanced account security.', icon: UserRoundCheck },
  { title: 'AI Fraud Detection', text: 'AI-powered systems that detect suspicious patterns and help prevent fraudulent activity.', icon: ShieldCheck }
];

function CreditCardIcon({ size = 54 }) { return <div className="fake-icon"><span className="card-chip"/><span className="card-line"/></div>; }
function BuildingIcon() { return <div className="building-icon">▦</div>; }

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useState(null);

  const startTrial = () => setAuth('signup');
  const go = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return <div className="landing">
    <header className="site-header">
      <button className="logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Seox home">
        <span className="logo-mark">ϟ</span><span>Seox</span>
      </button>
      <nav className={menuOpen ? 'site-nav open' : 'site-nav'}>
        <button onClick={() => go('features')}>Features</button>
        <button onClick={() => go('pricing')}>Pricing</button>
        <button onClick={() => go('security')}>Security</button>
        <button onClick={() => go('how-it-works')}>How it works</button>
        <button className="nav-login" onClick={() => setAuth('login')}>Login</button>
        <button className="nav-signup" onClick={startTrial}>Start Free Trial</button>
      </nav>
      <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
        {menuOpen ? <X size={27}/> : <Menu size={27}/>} 
      </button>
    </header>

    <main>
      <section className="hero-section">
        <div className="hero-glow glow-one"/><div className="hero-glow glow-two"/>
        <div className="hero-copy">
          <div className="pill"><span>●</span> Modern UPI Payment Infrastructure</div>
          <h1>UPI <em>Payments</em><br/>Gateway for Modern<br/>Businesses</h1>
          <p>Experience the next generation of payment processing with our elite UPI gateway. Fast, secure, and designed for scale.</p>
          <div className="hero-actions">
            <button className="gradient-btn" onClick={startTrial}><Rocket size={20}/> Start Free Trial <ArrowRight size={18}/></button>
            <button className="light-btn" onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}><Play size={18}/> Test Payment</button>
          </div>
          <div className="metrics"><Metric value="99.9%" label="UPTIME"/><Metric value="2M+" label="TRANSACTIONS"/><Metric value="50ms" label="PROCESSING"/></div>
        </div>
        <div className="payment-card-wrap" id="demo">
          <div className="payment-card">
            <div className="card-top"><span className="card-logo">ϟ</span><span>SEOX</span></div>
            <div className="dots">•••• &nbsp; •••• &nbsp; •••• &nbsp; <b>4287</b></div>
            <div className="card-bottom"><div><small>CARD HOLDER</small><strong>JOHN SMITH</strong></div><div><small>EXPIRES</small><strong>05/28</strong></div></div>
          </div>
          <div className="mini-payment"><div><span>Payment received</span><b>₹5,000.00</b></div><span className="paid">✓ Paid</span></div>
        </div>
      </section>

      <section className="why-section" id="features">
        <SectionHeading title="Why Choose" accent="Seox" text="Built for businesses that want reliable payments, powerful tools, and a simple merchant experience."/>
        <div className="feature-grid">{featureCards.map(({title,text,icon:Icon}) => <FeatureCard key={title} title={title} text={text} Icon={Icon}/>)}</div>
      </section>

      <section className="pricing-section" id="pricing">
        <SectionHeading title="Choose Your" accent="Subscription Plan" text="Select the perfect plan for your business needs. All plans include secure UPI payments."/>
        <div className="plans-grid">{plans.map(plan => <PlanCard key={plan.name} plan={plan} onStart={startTrial}/>)}</div>
      </section>

      <section className="steps-section" id="how-it-works">
        <SectionHeading title="Get Started in" accent="Minutes" text="Go from account creation to payment-ready infrastructure in four simple steps."/>
        <div className="steps">{[
          ['1','Create Account','Sign up for free and start your 2-day trial in minutes.'],
          ['2','Integrate API','Use our documented APIs, SDKs, or plugins for easy integration.'],
          ['3','Go Live','Start accepting UPI payments from your customers securely.'],
          ['4','Scale & Grow','Use advanced features and analytics as your business expands.']
        ].map(([n,t,d]) => <div className="step" key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></div>)}</div>
      </section>

      <section className="security-section" id="security">
        <SectionHeading title="Your Security is Our" accent="Priority" text="We employ multiple layers of security to keep your transactions and account data protected."/>
        <div className="security-grid">{securityCards.map(({title,text,icon:Icon}) => <FeatureCard key={title} title={title} text={text} Icon={Icon}/>)}</div>
      </section>

      <section className="cta-section">
        <h2>Ready to Transform Your<br/>Payment Experience?</h2>
        <p>Join businesses using Seox to accept payments faster, safer, and more efficiently.</p>
        <button className="white-btn" onClick={startTrial}><Rocket size={19}/> Get Started Today</button>
      </section>
    </main>

    <footer className="footer">
      <div className="footer-brand"><h2>Seox</h2><p>India's modern UPI payment gateway for businesses of all sizes. Secure, fast, and reliable.</p><div className="socials"><span>𝕏</span><span>f</span><span>in</span><span>◎</span></div></div>
      <div className="footer-cols"><FooterCol title="Product" items={['Features','Pricing','Documentation']}/><FooterCol title="Company" items={['About Us','Contact','Blog']}/><FooterCol title="Support" items={['Help Center','Privacy Policy','Terms of Service']}/></div>
      <div className="copyright">© 2026 Seox. All rights reserved.</div>
    </footer>

    <button className="chat-btn" onClick={() => go('contact')}><span>◉</span> Chat with us</button>
    {auth && <AuthModal mode={auth} onClose={() => setAuth(null)} onLogin={async (email,password) => { await login(email,password); window.location.hash='dashboard'; window.location.reload(); }} onSignup={async (name,email,password) => { await register(name,email,password); window.location.hash='dashboard'; window.location.reload(); }} />}
  </div>;
}

function Metric({value,label}) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function SectionHeading({title,accent,text}) { return <div className="section-heading"><h2>{title} <em>{accent}</em></h2><p>{text}</p></div>; }
function FeatureCard({title,text,Icon}) { return <article className="feature-card"><div className="feature-icon"><Icon size={45}/></div><h3>{title}</h3><p>{text}</p></article>; }
function PlanCard({plan,onStart}) { const Icon=plan.icon; return <article className={plan.featured ? 'plan-card featured' : 'plan-card'}>{plan.featured && <div className="popular">Popular</div>}<div className="plan-icon"><Icon/></div><h3>{plan.name}</h3><div className="price">{plan.price}<small>/plan</small></div><div className="valid">▦ Valid for {plan.duration}</div><hr/>{['UPI Payment Integration','Secure Payment Gateway','24/7 Customer Support','Transaction Analytics'].map(x => <div className="check" key={x}><Check size={18}/><span>{x}</span></div>)}<button className="plan-btn" onClick={onStart}>Get Started</button></article>; }
function FooterCol({title,items}) { return <div><h3>{title}</h3>{items.map(i=><button key={i}>{i}</button>)}</div>; }

function AuthModal({mode,onClose,onLogin,onSignup}) {
  const [tab,setTab]=useState(mode); const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  const submit=async e=>{e.preventDefault();setError('');setLoading(true);try{if(tab==='login') await onLogin(email,password);else await onSignup(name,email,password);}catch(err){setError(err.message||'Unable to continue');}finally{setLoading(false);}};
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="auth-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}><X size={20}/></button><div className="modal-logo">ϟ</div><h2>{tab==='login'?'Welcome back':'Start your free trial'}</h2><p>{tab==='login'?'Login to your Seox merchant account.':'Create your account and get 2 days of free trial access.'}</p><div className="auth-tabs"><button className={tab==='login'?'active':''} onClick={()=>setTab('login')}>Login</button><button className={tab==='signup'?'active':''} onClick={()=>setTab('signup')}>Sign up</button></div><form onSubmit={submit}>{tab==='signup'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" required/>}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" required/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" minLength="8" required/><button className="auth-submit" disabled={loading}>{loading?'Please wait…':tab==='login'?'Login':'Create account'}</button></form><div className="or"><span/>or<span/></div><button className="google-btn" type="button" onClick={()=>setError('Google sign-in UI is ready; connect your Google OAuth client on the backend before enabling live Google authentication.')}>G <span>Continue with Google</span></button>{error&&<div className="auth-error">{error}</div>}<small className="trial-note">New accounts receive a <b>2-day free trial</b>. No KYC is required to create the account.</small></div></div>;
}

export default App;
