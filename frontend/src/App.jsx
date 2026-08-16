import { useState } from 'react';
import { Bell, ChevronDown, CreditCard, LayoutDashboard, Menu, Settings, ShieldCheck, Store, Webhook, X } from 'lucide-react';

const nav = [
  ['Dashboard', LayoutDashboard],
  ['Merchants', Store],
  ['Payment Links', CreditCard],
  ['Transactions', CreditCard],
  ['API & Webhooks', Webhook],
  ['Security', ShieldCheck],
  ['Settings', Settings]
];

function App() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('Dashboard');

  return (
    <div className="app-shell">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><span className="brand-mark">U</span><span>UPI Gateway</span><button className="close" onClick={() => setOpen(false)}><X size={19}/></button></div>
        <div className="section-label">MAIN MENU</div>
        <nav>{nav.map(([label, Icon]) => <button className={active === label ? 'nav-item active' : 'nav-item'} key={label} onClick={() => {setActive(label);setOpen(false)}}><Icon size={18}/><span>{label}</span></button>)}</nav>
        <div className="plan-card"><div className="plan-title">Starter Plan</div><div className="plan-sub">Gateway access active</div><div className="progress"><span/></div><div className="plan-foot"><span>Usage</span><b>42%</b></div></div>
      </aside>

      <main className="main">
        <header className="topbar"><button className="menu" onClick={() => setOpen(true)}><Menu size={21}/></button><div className="crumb">Merchant Panel <span>/</span> {active}</div><div className="top-actions"><button className="icon-btn"><Bell size={19}/><i/></button><button className="profile"><span className="avatar">A</span><span className="profile-copy"><b>Merchant</b><small>Active account</small></span><ChevronDown size={16}/></button></div></header>

        <section className="content">
          <div className="hero"><div><div className="eyebrow">PAYMENT INFRASTRUCTURE</div><h1>{active}</h1><p>Manage your payment gateway, merchants, orders and API integrations from one secure workspace.</p></div><button className="primary">+ Add Merchant</button></div>

          <div className="stats">
            <Stat label="Total Transactions" value="12,480" meta="+12.4% this month" />
            <Stat label="Successful Payments" value="11,936" meta="95.6% success rate" />
            <Stat label="Pending Payments" value="128" meta="Needs verification" />
            <Stat label="Active Merchants" value="08" meta="All systems normal" />
          </div>

          <div className="grid">
            <div className="panel large"><div className="panel-head"><div><h2>Payment overview</h2><p>Recent gateway activity</p></div><button className="select">Last 30 days <ChevronDown size={15}/></button></div><div className="chart"><div className="chart-line"/><div className="chart-labels"><span>01</span><span>07</span><span>14</span><span>21</span><span>30</span></div></div></div>
            <div className="panel"><div className="panel-head"><div><h2>Gateway status</h2><p>Live system health</p></div></div><div className="health"><span className="health-dot"/><div><b>All systems operational</b><small>API, webhooks and payment services</small></div></div><div className="health-row"><span>API latency</span><b>82 ms</b></div><div className="health-row"><span>Webhook delivery</span><b>99.9%</b></div></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({label,value,meta}) { return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{meta}</small></div>; }

export default App;
