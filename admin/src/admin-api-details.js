const API_BASE = String(import.meta.env?.VITE_API_BASE_URL || 'https://api.omniupi.in/api/v1').replace(/\/$/, '');

function token(){ return localStorage.getItem('gateway_admin_token') || ''; }
async function call(path, options={}){
  const headers={Accept:'application/json','Content-Type':'application/json',...(options.headers||{})};
  const t=token(); if(t) headers.Authorization=`Bearer ${t}`;
  const r=await fetch(`${API_BASE}${path}`,{...options,headers,cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.message||'Unable to load administrator API details.');
  return d;
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function copy(value){if(navigator.clipboard)navigator.clipboard.writeText(value);}

function openModal(){
  if(document.getElementById('om-admin-api-modal')) return;
  const modal=document.createElement('div'); modal.id='om-admin-api-modal';
  modal.innerHTML=`<div class="om-api-backdrop"><div class="om-api-card"><div class="om-api-head"><div><span class="om-api-kicker">DEVELOPER ACCESS</span><h2>Admin API Details</h2><p>Unique API credentials for this administrator.</p></div><button class="om-api-close" data-close>×</button></div><div id="om-api-body"><div class="om-api-loading">Loading secure API credentials…</div></div></div></div>`;
  document.body.appendChild(modal);
  modal.querySelector('[data-close]').onclick=()=>modal.remove();
  modal.querySelector('.om-api-backdrop').onclick=e=>{if(e.target===e.currentTarget)modal.remove();};
  load(modal);
}

async function load(modal){
  const body=modal.querySelector('#om-api-body');
  try{
    const d=await call('/auth/admin-api-credentials'); const c=d.credentials||{};
    body.innerHTML=`<div class="om-api-grid">
      ${field('Admin User ID',c.userId,'userId')}
      ${field('API Key / Token',c.apiToken,'apiToken',true)}
      ${field('API Secret',c.instanceSecret,'instanceSecret',true)}
      ${field('API Base URL',c.apiBaseUrl,'apiBase')}
    </div>
    <div class="om-api-actions"><button class="om-api-secondary" data-regenerate>Regenerate Credentials</button><a class="om-api-primary" href="${esc(c.docsUrl||'https://omniupi.in/docs')}" target="_blank" rel="noopener">Open Documentation ↗</a></div>
    <div class="om-api-note">⚠️ Keep the API Key and Secret private. The same API documentation and endpoints used by the User Panel apply to this administrator account.</div>`;
    body.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{copy(b.dataset.copy);b.textContent='Copied ✓';setTimeout(()=>b.textContent='Copy',900);});
    body.querySelector('[data-regenerate]').onclick=async()=>{
      if(!confirm('Regenerate this administrator API token and secret? Existing integrations using the old credentials will stop working.')) return;
      const btn=body.querySelector('[data-regenerate]');btn.disabled=true;btn.textContent='Regenerating…';
      try{await call('/auth/admin-api-credentials/regenerate',{method:'POST',body:JSON.stringify({type:'both'})});await load(modal);}catch(e){alert(e.message);btn.disabled=false;btn.textContent='Regenerate Credentials';}
    };
  }catch(e){body.innerHTML=`<div class="om-api-error">${esc(e.message)}</div>`;}
}
function field(label,value,key,secret=false){return `<div class="om-api-field"><label>${esc(label)}</label><div><code>${esc(value||'Not generated')}</code><button data-copy="${esc(value||'')}">Copy</button></div></div>`;}

function inject(){
  if(document.getElementById('om-admin-api-launcher')) return;
  const style=document.createElement('style');
  style.textContent=`#om-admin-api-launcher{position:fixed;right:22px;bottom:22px;z-index:99990;border:0;border-radius:999px;padding:12px 17px;background:linear-gradient(135deg,#6269e8,#19b99a);color:#fff;font-weight:800;box-shadow:0 12px 28px #1720332b;cursor:pointer}#om-admin-api-modal{position:fixed;inset:0;z-index:100000}.om-api-backdrop{min-height:100%;display:grid;place-items:center;padding:20px;background:#1720338c}.om-api-card{width:min(680px,100%);background:#fff;border-radius:22px;box-shadow:0 25px 70px #17203355;overflow:hidden;font-family:Inter,system-ui,sans-serif}.om-api-head{display:flex;justify-content:space-between;gap:20px;padding:24px;border-bottom:1px solid #edf0f5}.om-api-kicker{font-size:11px;font-weight:900;color:#6269e8;letter-spacing:.12em}.om-api-head h2{margin:5px 0 4px;color:#172033}.om-api-head p{margin:0;color:#687384;font-size:13px}.om-api-close{border:0;background:#f3f5f8;border-radius:10px;width:38px;height:38px;font-size:25px;cursor:pointer}.om-api-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;padding:20px}.om-api-field label{display:block;font-size:11px;font-weight:800;color:#697386;margin-bottom:6px}.om-api-field>div{display:flex;gap:7px;align-items:center;background:#f7f9fb;border:1px solid #e6eaf0;border-radius:11px;padding:8px}.om-api-field code{font-size:11px;overflow:auto;white-space:nowrap;flex:1;color:#243044}.om-api-field button{border:0;background:#fff;border:1px solid #e1e5eb;border-radius:8px;padding:5px 8px;font-size:11px;cursor:pointer}.om-api-actions{display:flex;gap:10px;padding:0 20px 18px}.om-api-actions button,.om-api-actions a{border:0;border-radius:10px;padding:10px 13px;font-weight:800;text-decoration:none;font-size:12px;cursor:pointer}.om-api-primary{background:#6269e8;color:#fff}.om-api-secondary{background:#f1f3f7;color:#243044}.om-api-note,.om-api-loading,.om-api-error{margin:0 20px 20px;padding:13px;border-radius:11px;background:#f7f9fb;color:#687384;font-size:12px;line-height:1.6}.om-api-error{background:#fff0f0;color:#b43b3b}@media(max-width:650px){.om-api-grid{grid-template-columns:1fr}.om-api-actions{flex-direction:column}.om-api-card{max-height:92vh;overflow:auto}}`;
  document.head.appendChild(style);
  const button=document.createElement('button');button.id='om-admin-api-launcher';button.textContent='🔑 Admin API';button.onclick=openModal;document.body.appendChild(button);
}
window.addEventListener('load',inject,{once:true});
