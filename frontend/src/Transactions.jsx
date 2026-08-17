import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Download, Filter, List, RotateCcw, Search, XCircle } from 'lucide-react';
import './transactions.css';

const EMPTY = [];

export default function Transactions({ onBack }) {
  const [status, setStatus] = useState('All');
  const [period, setPeriod] = useState('All Time');
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState({ status: 'All', period: 'All Time', query: '' });
  const [pageSize, setPageSize] = useState('10');

  const transactions = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('seox_transactions') || '[]');
      return Array.isArray(saved) ? saved : EMPTY;
    } catch {
      return EMPTY;
    }
  }, []);

  const filtered = transactions.filter((tx) => {
    const text = `${tx.orderId || ''} ${tx.mobile || ''} ${tx.utr || ''} ${tx.customer || ''}`.toLowerCase();
    const matchesQuery = !applied.query || text.includes(applied.query.toLowerCase());
    const matchesStatus = applied.status === 'All' || String(tx.status || '').toLowerCase() === applied.status.toLowerCase();
    return matchesQuery && matchesStatus;
  });

  const reset = () => {
    setStatus('All'); setPeriod('All Time'); setQuery('');
    setApplied({ status: 'All', period: 'All Time', query: '' });
  };

  const exportCsv = () => {
    const rows = [['Order ID','Amount','UTR','Customer','Mobile','Status','Date'], ...filtered.map(t => [t.orderId || '', t.amount || '', t.utr || '', t.customer || '', t.mobile || '', t.status || '', t.date || ''])];
    const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'transactions.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const total = transactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const success = transactions.filter(t => String(t.status).toLowerCase() === 'success');
  const pending = transactions.filter(t => String(t.status).toLowerCase() === 'pending');
  const failed = transactions.filter(t => String(t.status).toLowerCase() === 'failed');

  return <div className="transactions-page">
    <header className="tx-topbar">
      <button className="tx-menu" onClick={onBack} aria-label="Back"><span></span><span></span><span></span></button>
      <div className="tx-logo"><span>ϟ</span> OmniUPI</div>
      <div className="tx-top-actions"><div className="tx-trial"><CalendarDays size={15}/> 2026-08-17 - ACTIVE</div><div className="tx-avatar">M</div></div>
    </header>

    <main className="tx-main">
      <div className="tx-heading">
        <div><h1><ArrowLeftRight size={38}/> Transactions <b>{transactions.length}</b></h1><p><Clock3 size={18}/> {new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}, {new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</p></div>
      </div>

      <section className="tx-stats">
        <StatCard title="TOTAL RECEIVED" value={`₹${total.toFixed(2)}`} sub={`${transactions.length} transactions`} icon={CircleDollarSign} tone="purple"/>
        <StatCard title="SUCCESS" value={`₹${success.reduce((s,t)=>s+Number(t.amount||0),0).toFixed(2)}`} sub={`${success.length} txns`} icon={CheckCircle2} tone="green"/>
        <StatCard title="PENDING" value={`₹${pending.reduce((s,t)=>s+Number(t.amount||0),0).toFixed(2)}`} sub={`${pending.length} txns`} icon={Clock3} tone="yellow"/>
        <StatCard title="FAILED" value={`₹${failed.reduce((s,t)=>s+Number(t.amount||0),0).toFixed(2)}`} sub={`${failed.length} txns`} icon={XCircle} tone="red"/>
      </section>

      <section className="tx-filter-card">
        <label><span><Filter size={16}/> STATUS</span><div className="select-wrap"><select value={status} onChange={e=>setStatus(e.target.value)}><option>All</option><option>Success</option><option>Pending</option><option>Failed</option></select><ChevronDown size={18}/></div></label>
        <label><span><CalendarDays size={16}/> PERIOD</span><div className="select-wrap"><select value={period} onChange={e=>setPeriod(e.target.value)}><option>All Time</option><option>Today</option><option>7 Days</option><option>30 Days</option></select><ChevronDown size={18}/></div></label>
        <label className="search-field"><span><Search size={16}/> SEARCH</span><div><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Order ID, Mobile, UTR..."/></div></label>
        <div className="filter-actions"><button className="apply-btn" onClick={()=>setApplied({status,period,query})}><Filter size={17}/> Apply</button><button className="reset-btn" onClick={reset} aria-label="Reset"><RotateCcw size={19}/></button></div>
      </section>

      <section className="tx-table-card">
        <div className="tx-table-head"><h2><List size={24}/> Transactions</h2><div><button className="export-btn" onClick={exportCsv}><Download size={18}/> Export</button><div className="page-size"><select value={pageSize} onChange={e=>setPageSize(e.target.value)}><option>10</option><option>25</option><option>50</option><option>100</option></select><ChevronDown size={17}/></div></div></div>
        <div className="tx-table-wrap"><table><thead><tr><th>#</th><th>APP</th><th>ORDER ID</th><th>AMOUNT</th><th>UTR</th><th>CUSTOMER</th><th>STATUS</th><th>DATE</th></tr></thead><tbody>{filtered.length===0?<tr><td colSpan="8"><div className="tx-empty"><ArrowDownToLine size={34}/><p>No transactions found</p><small>Your payment transactions will appear here.</small></div></td></tr>:filtered.slice(0,Number(pageSize)).map((t,i)=><tr key={t.id||i}><td>{i+1}</td><td>{t.app||'UPI'}</td><td>{t.orderId||'—'}</td><td>₹{Number(t.amount||0).toFixed(2)}</td><td>{t.utr||'—'}</td><td>{t.customer||t.mobile||'—'}</td><td><span className={`tx-status ${String(t.status||'').toLowerCase()}`}>{t.status||'Pending'}</span></td><td>{t.date||'—'}</td></tr>)}</tbody></table></div>
      </section>
    </main>
  </div>;
}

function StatCard({title,value,sub,icon:Icon,tone}) { return <article className={`tx-stat ${tone}`}><div className="tx-stat-icon"><Icon size={24}/></div><div><span>{title}</span><strong>{value}</strong><small>{sub}</small></div></article>; }
