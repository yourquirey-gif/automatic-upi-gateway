import { useState } from 'react';
import { Bell, ChevronDown, CreditCard, LayoutDashboard, Menu, Settings, ShieldCheck, Store, Webhook, X, Link2, Receipt, Plus, Copy, CheckCircle2 } from 'lucide-react';

const nav = [
  ['Dashboard', LayoutDashboard], ['Merchants', Store], ['Payment Links', Link2],
  ['Transactions', Receipt], ['API & Webhooks', Webhook], ['Security', ShieldCheck], ['Settings', Settings]
];

const txns = [
  ['TXN-10482','₹1,499.00','success','Today, 03:42 PM'], ['TXN-10481','₹799.00','success','Today, 03:18 PM'],
  ['TXN-10480','₹2,250.00','pending','Today, 02:57 PM'], ['TXN-10479','₹349.00','failed','Today, 02:31 PM'],
  ['TXN-10478','₹999.00','success','Today, 01:48 PM']
];

function App() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('Dashboard');
  const [copied, setCopied] = useState(false);

  const select = (page) => { setActive(page); setOpen(false); };
  const copyKey = async () => { await navigator.clipboard?.writeText('pk_live_demo_7H3K9P2'); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return <div className="app-shell">
    <aside className={open ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark">U</span><span>UPI Gateway</span><button className="close" onClick={() => setOpen(false)}><X size={19}/></button></div>
      <div className="section-label">MAIN MENU</div>
      <nav>{nav.map(([label, Icon]) => <button className={active === label ? 'nav-item active' : 'nav-item'} key={label} onClick={() => select(label)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="plan-card"><div className="plan-title">Starter Plan</div><div className="plan-sub">Gateway access active</div><div className="progress"><span/></div><div className="plan-foot"><span>Usage</span><b>42%</b></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="menu" onClick={() => setOpen(true)}><Menu size={21}/></button><div className="crumb">Merchant Panel <span>/</span> {active}</div><div className="top-actions"><button className="icon-btn"><Bell size={19}/><i/></button><button className="profile"><span className="avatar">A</span><span className="profile-copy"><b>Merchant</b><small>Active account</small></span><ChevronDown size={16}/></button></div></header>
      <section className="content">
        {active === 'Dashboard' && <Dashboard onAdd={() => select('Merchants')} />}
        {active === 'Merchants' && <Page title="Merchants" eyebrow="ACCOUNT MANAGEMENT" action="+ Add Merchant"><div className="table-panel"><div className="panel-head"><div><h2>Connected merchants</h2><p>Manage your connected payment accounts</p></div><button className="primary"><Plus size={15}/> Add Merchant</button></div><div className="merchant-list"><Merchant name="Primary Store" email="store@example.com" status="Connected"/><Merchant name="Demo Shop" email="demo@example.com" status="Pending"/></div></div></Page>}
        {active === 'Payment Links' && <Page title="Payment Links" eyebrow="CHECKOUT TOOLS" action="+ Create Link"><div className="table-panel"><div className="panel-head"><div><h2>Your payment links</h2><p>Create shareable checkout URLs for customers</p></div><button className="primary"><Plus size={15}/> Create Link</button></div><div className="link-card"><div><b>Demo Product</b><small>₹999.00 · Active</small></div><code>pay.example.com/l/demo-product</code><button className="icon-btn" onClick={copyKey}>{copied ? <CheckCircle2 size={18}/> : <Copy size={18}/>}</button></div><div className="link-card"><div><b>Premium Plan</b><small>₹1,499.00 · Active</small></div><code>pay.example.com/l/premium</code><button className="icon-btn"><Copy size={18}/></button></div></div></Page>}
        {active === 'Transactions' && <Page title="Transactions" eyebrow="PAYMENT ACTIVITY"><div className="table-panel"><div className="panel-head"><div><h2>Recent transactions</h2><p>All payment activity from your gateway</p></div></div><div className="txn-table"><div className="txn-row head"><span>ID</span><span>Amount</span><span>Status</span><span>Time</span></div>{txns.map(t => <div className="txn-row" key={t[0]}><span>{t[0]}</span><b>{t[1]}</b><span className={'badge '+t[2]}>{t[2]}</span><small>{t[3]}</small></div>)}</div></div></Page>}
        {active === 'API & Webhooks' && <Page title="API & Webhooks" eyebrow="DEVELOPER SETTINGS"><div className="settings-grid"><Setting title="API key" text="Use this key for server-side API requests."><div className="secret"><code>pk_live_demo_7H3K9P2</code><button onClick={copyKey}>{copied ? 'Copied' : 'Copy'}</button></div></Setting><Setting title="Webhook endpoint" text="Receive signed payment status events."><div className="input-like">https://merchant.example.com/api/webhooks</div><button className="secondary">Save endpoint</button></Setting></div></Page>}
        {active === 'Security' && <Page title="Security" eyebrow="PROTECTION"><div className="settings-grid"><Setting title="Account security" text="Keep your merchant account protected."><Toggle label="Two-factor authentication" on/><Toggle label="Login notifications" on/></Setting><Setting title="Webhook signing" text="Requests should be verified using your webhook secret."><div className="health"><span className="health-dot"/><div><b>Signature verification enabled</b><small>Server-side verification recommended</small></div></div></Setting></div></Page>}
        {active === 'Settings' && <Page title="Settings" eyebrow="ACCOUNT PREFERENCES"><div className="settings-grid"><Setting title="Business profile" text="Basic information shown in your merchant account."><div className="input-like">Merchant account</div><div className="input-like">merchant@example.com</div><button className="secondary">Save changes</button></Setting><Setting title="Notifications" text="Choose which gateway events you receive."><Toggle label="Successful payments" on/><Toggle label="Failed payments" on/><Toggle label="Weekly reports"/></Setting></div></Page>}
      </section>
    </main>
  </div>;
}

function Dashboard({onAdd}) { return <><div className="hero"><div><div className="eyebrow">PAYMENT INFRASTRUCTURE</div><h1>Dashboard</h1><p>Manage your payment gateway, merchants, orders and API integrations from one secure workspace.</p></div><button className="primary" onClick={onAdd}><Plus size={15}/> Add Merchant</button></div><div className="stats"><Stat label="Total Transactions" value="12,480" meta="+12.4% this month"/><Stat label="Successful Payments" value="11,936" meta="95.6% success rate"/><Stat label="Pending Payments" value="128" meta="Needs verification"/><Stat label="Active Merchants" value="08" meta="All systems normal"/></div><div className="grid"><div className="panel large"><div className="panel-head"><div><h2>Payment overview</h2><p>Recent gateway activity</p></div><button className="select">Last 30 days <ChevronDown size={15}/></button></div><div className="chart"><div className="chart-line"/><div className="chart-labels"><span>01</span><span>07</span><span>14</span><span>21</span><span>30</span></div></div></div><div className="panel"><div className="panel-head"><div><h2>Gateway status</h2><p>Live system health</p></div></div><div className="health"><span className="health-dot"/><div><b>All systems operational</b><small>API, webhooks and payment services</small></div></div><div className="health-row"><span>API latency</span><b>82 ms</b></div><div className="health-row"><span>Webhook delivery</span><b>99.9%</b></div></div></div></>; }
function Page({title,eyebrow,action,children}) { return <><div className="hero"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>Manage your {title.toLowerCase()} securely from your merchant workspace.</p></div>{action && <button className="primary">{action}</button>}</div>{children}</>; }
function Stat({label,value,meta}) { return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{meta}</small></div>; }
function Merchant({name,email,status}) { return <div className="merchant-row"><div className="merchant-avatar">{name[0]}</div><div><b>{name}</b><small>{email}</small></div><span className={'badge '+(status === 'Connected' ? 'success' : 'pending')}>{status}</span><button className="secondary">Manage</button></div>; }
function Setting({title,text,children}) { return <div className="panel setting"><h2>{title}</h2><p>{text}</p>{children}</div>; }
function Toggle({label,on}) { const [checked,setChecked] = useState(!!on); return <div className="toggle-row"><span>{label}</span><button className={checked ? 'toggle on' : 'toggle'} onClick={() => setChecked(!checked)}><i/></button></div>; }
export default App;
