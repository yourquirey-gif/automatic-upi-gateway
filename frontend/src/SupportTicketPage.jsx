import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, MessageSquare, Plus, Send, ShieldCheck, Ticket, X } from 'lucide-react';
import { api } from './api';
import './support.css';

const categories = [['payment','Payment'],['api','API'],['kyc','KYC'],['account','Account'],['technical','Technical'],['other','Other']];

export default function SupportTicketPage(){
  const [tickets,setTickets]=useState([]),[loading,setLoading]=useState(true),[selected,setSelected]=useState(null),[showForm,setShowForm]=useState(false),[error,setError]=useState('');
  const load=async()=>{try{setLoading(true);const d=await api('/support/tickets');setTickets(d.tickets||[]);if(selected){const fresh=(d.tickets||[]).find(t=>t._id===selected._id);if(fresh)setSelected(fresh)}}catch(e){setError(e.message||'Unable to load tickets')}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  if(selected)return <TicketConversation ticket={selected} onBack={()=>{setSelected(null);load()}}/>;
  return <div className="support-page">
    <header className="support-topbar">
      <button className="support-back" onClick={()=>{window.location.hash='dashboard'}}><ArrowLeft size={18}/></button>
      <div className="support-brand-copy"><span className="support-eyebrow">OMNIUPI SUPPORT</span><b>Support Center</b></div>
      <button className="support-new-ticket" onClick={()=>setShowForm(true)}><Plus size={16}/> New Ticket</button>
    </header>
    <main className="support-wrap">
      <section className="support-hero">
        <div className="support-hero-icon"><ShieldCheck size={28}/></div>
        <div><span className="support-eyebrow">PREMIUM MERCHANT SUPPORT</span><h1>How can we help you?</h1><p>Get help with payments, API integrations, KYC, account access and other OmniUPI gateway questions.</p></div>
      </section>
      <section className="support-actions">
        <div className="support-action-card"><div className="support-action-icon"><Ticket size={20}/></div><div><b>Support tickets</b><span>Track your existing requests and replies.</span></div></div>
        <div className="support-action-card"><div className="support-action-icon"><MessageSquare size={20}/></div><div><b>Direct assistance</b><span>Reply to your ticket and keep the conversation in one place.</span></div></div>
      </section>
      {error&&<div className="support-error">{error}</div>}
      {showForm&&<NewTicket onCreated={async t=>{setShowForm(false);await load();setSelected(t)}} onCancel={()=>setShowForm(false)}/>} 
      {!showForm&&<section className="support-ticket-section"><div className="support-section-head"><div><span className="support-eyebrow">YOUR REQUESTS</span><h2>Support tickets</h2><p>Review status, priority and the latest reply from support.</p></div><button className="support-new-ticket secondary" onClick={()=>setShowForm(true)}><Plus size={16}/> Create ticket</button></div>
        {loading?<div className="support-state"><div className="support-spinner"/><b>Loading your tickets…</b><span>Please wait while we fetch your support history.</span></div>:tickets.length===0?<div className="support-state"><div className="support-empty-icon"><Ticket size={28}/></div><h3>No tickets yet</h3><span>Create a support request and our team can review it.</span><button className="support-new-ticket" onClick={()=>setShowForm(true)}><Plus size={16}/> Create First Ticket</button></div>:<div className="support-ticket-list">{tickets.map(t=><TicketCard key={t._id} ticket={t} onClick={()=>setSelected(t)}/>)}</div>}
      </section>}
    </main>
  </div>;
}

function NewTicket({onCreated,onCancel}){const[subject,setSubject]=useState(''),[category,setCategory]=useState('technical'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const submit=async e=>{e.preventDefault();setError('');if(!subject.trim()||!message.trim())return setError('Subject and message are required.');try{setBusy(true);const d=await api('/support/tickets',{method:'POST',body:JSON.stringify({subject,category,message})});onCreated(d.ticket)}catch(e){setError(e.message||'Unable to create ticket')}finally{setBusy(false)}};return <section className="support-form-card"><div className="support-section-head"><div><span className="support-eyebrow">NEW REQUEST</span><h2>Create a support ticket</h2><p>Our support team will review your request and reply in the ticket.</p></div><button className="support-back" onClick={onCancel}><X size={17}/></button></div><form onSubmit={submit} className="support-form"><label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={160} placeholder="e.g. Payment not received"/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Message<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={5000} placeholder="Explain your issue clearly…"/></label>{error&&<div className="support-form-error">{error}</div>}<button className="support-new-ticket" disabled={busy}>{busy?'Creating…':<><Send size={16}/> Create Ticket</>}</button></form></section>}

function TicketCard({ticket,onClick}){const last=ticket.messages?.[ticket.messages.length-1];return <button onClick={onClick} className="support-ticket-card"><div className="support-ticket-icon"><MessageSquare size={20}/></div><div className="support-ticket-main"><div className="support-ticket-title"><b>{ticket.subject}</b><Status status={ticket.status}/></div><div className="support-ticket-meta">{ticket.ticketId} · {ticket.category} · {ticket.priority}</div><p>{last?.text||'No messages'}</p></div><span className="support-ticket-arrow">›</span></button>}
function Status({status}){const map={pending:['Pending','pending'],open:['Open','open'],waiting_user:['Waiting for you','waiting'],resolved:['Resolved','resolved'],closed:['Closed','closed']};const [label,tone]=map[status]||map.pending;return <span className={`support-status ${tone}`}>{label}</span>}

function TicketConversation({ticket,onBack}){const[current,setCurrent]=useState(ticket),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const refresh=async()=>{const d=await api(`/support/tickets/${current._id}`);setCurrent(d.ticket)};const send=async e=>{e.preventDefault();if(!message.trim())return;try{setBusy(true);await api(`/support/tickets/${current._id}/messages`,{method:'POST',body:JSON.stringify({message})});setMessage('');await refresh()}catch(e){setError(e.message||'Unable to send message')}finally{setBusy(false)}};return <div className="support-page">
  <header className="support-topbar"><button className="support-back" onClick={onBack}><ArrowLeft size={18}/></button><div className="support-brand-copy"><span className="support-eyebrow">OMNIUPI SUPPORT</span><b>{current.subject}</b></div></header>
  <main className="support-wrap"><section className="support-conversation-head"><div><span className="support-eyebrow">TICKET {current.ticketId}</span><h1>Support conversation</h1><p>Keep your payment and gateway support discussion in one secure thread.</p></div><Status status={current.status}/></section>
    <section className="support-detail-card"><div><span>Category</span><b>{current.category}</b></div><div><span>Priority</span><b>{current.priority}</b></div><div><span>Status</span><Status status={current.status}/></div></section>
    <section className="support-messages">{(current.messages||[]).map(m=><div key={m._id} className={`support-message-row ${m.sender==='user'?'user':''}`}><div className="support-message"><div className="support-message-label">{m.sender==='user'?'You':'OmniUPI Support'}</div><div className="support-message-text">{m.text}</div><div className="support-message-time">{new Date(m.createdAt).toLocaleString()}</div></div></div>)}</section>
    {current.status!=='closed'&&current.status!=='resolved'&&<form onSubmit={send} className="support-reply"><textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a reply…" maxLength={5000}/><button className="support-new-ticket" disabled={busy}>{busy?<Clock3 size={16}/>:<Send size={16}/>}</button></form>}
    {error&&<div className="support-error">{error}</div>}
    {(current.status==='resolved'||current.status==='closed')&&<div className="support-resolved"><CheckCircle2 size={22}/><b>This ticket has been {current.status}.</b><span>Open a new ticket if you need additional help.</span></div>}
  </main>
</div>}
