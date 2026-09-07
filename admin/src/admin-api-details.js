const API_BASE = String(import.meta.env?.VITE_API_BASE_URL || 'https://api.omniupi.in/api/v1').replace(/\/$/, '');

function token(){ return localStorage.getItem('gateway_admin_token') || ''; }
async function call(path, options={}){
  const headers={Accept:'application/json','Content-Type':'application/json',...(options.headers||{})};
  const t=token(); if(t) headers.Authorization=`Bearer ${t}`;
  const r=await fetch(`${API_BASE}${path}`,{...options,headers,cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.message||'Unable to complete administrator request.');
  return d;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function mask(){return '••••••••••••••••';}

let active=false;
let navObserver=null;

function panelMarkup(){
  return `<div class="om-settings-wrap">
    <div class="om-settings-head"><div><span class="om-settings-kicker">ADMIN ONLY · SECURE CONFIGURATION</span><h1>API &amp; Webhook Settings</h1><p>View your administrator API credentials and configure the existing payment webhook. Credentials are only revealed after an explicit admin action and are never stored in localStorage.</p></div><div class="om-settings-shield">🔒 Admin isolated</div></div>
    <div id="om-settings-message" class="om-settings-message" hidden></div>
    <div class="om-settings-grid">
      <section class="om-settings-card">
        <div class="om-card-title"><div><span>API CREDENTIALS</span><h3>OMNIUPI API</h3></div><b>ADMIN</b></div>
        <label>OMNIUPI API<input id="om-api-input" type="text" autocomplete="off" spellcheck="false" placeholder="Click View Credentials to reveal" readonly/></label>
        <div id="om-api-saved" class="om-saved-row"><span>Saved value</span><code>${mask()}</code></div>
        <label>OMNIUPI Instance Secret<div class="om-secret-input"><input id="om-secret-input" type="password" autocomplete="new-password" spellcheck="false" placeholder="Click View Credentials to reveal" readonly/><button type="button" id="om-secret-toggle">Show</button></div></label>
        <div id="om-secret-saved" class="om-saved-row"><span>Saved value</span><code>${mask()}</code></div>
        <div class="om-actions om-credential-actions"><button id="om-view-credentials" class="om-primary">👁 View My API &amp; Secret</button><button id="om-hide-credentials" class="om-secondary" disabled>Hide Credentials</button></div>
        <div class="om-security-note">Only the authenticated administrator can call the credential-reveal endpoint. The server decrypts the stored values only for this admin request. Do not share or screenshot the revealed credentials.</div>
      </section>
      <section class="om-settings-card">
        <div class="om-card-title"><div><span>PAYMENT NOTIFICATION</span><h3>Webhook</h3></div><b>EXISTING SYSTEM</b></div>
        <label>Webhook URL<input id="om-webhook-input" type="url" autocomplete="off" spellcheck="false" placeholder="https://example.com/webhook"/></label>
        <div class="om-webhook-rule"><strong>When will it fire?</strong><p>Only after a payment order is actually marked <b>SUCCESS</b> by the existing Gmail payment verification flow using the exact Order ID and exact amount.</p><p>It will not fire when a QR is opened/scanned, a payment page is opened, or Gmail/UPI is merely connected.</p></div>
        <div class="om-actions"><button id="om-save-settings" class="om-primary">✓ Save API Settings</button><button id="om-test-webhook" class="om-secondary">↗ Test Webhook</button><button id="om-delete-webhook" class="om-danger">🗑 Delete Webhook</button></div>
      </section>
    </div>
    <div class="om-current-config"><span>Current configuration</span><div><b>OMNIUPI API</b><code id="om-api-status">Not configured</code></div><div><b>Instance Secret</b><code id="om-secret-status">Not configured</code></div><div><b>Webhook</b><code id="om-webhook-status">Not configured</code></div></div>
  </div>`;
}

function showMessage(text,ok){const el=document.getElementById('om-settings-message');if(!el)return;el.hidden=false;el.className=`om-settings-message ${ok?'success':'failure'}`;el.textContent=`${ok?'✓':'✕'} ${text}`;}

async function loadSettings(){
  try{
    const d=await call('/auth/admin-api-settings');
    const s=d.settings||{};
    const apiStatus=document.getElementById('om-api-status'),secretStatus=document.getElementById('om-secret-status'),webhookStatus=document.getElementById('om-webhook-status');
    if(apiStatus)apiStatus.textContent=s.apiConfigured?'••••••••••••••••':'Not configured';
    if(secretStatus)secretStatus.textContent=s.instanceSecretConfigured?'••••••••••••••••':'Not configured';
    if(webhookStatus)webhookStatus.textContent=s.webhookUrl||'Not configured';
    const webhook=document.getElementById('om-webhook-input');if(webhook)webhook.value=s.webhookUrl||'';
    const del=document.getElementById('om-delete-webhook');if(del)del.disabled=!s.webhookUrl;
    const apiSaved=document.getElementById('om-api-saved');if(apiSaved)apiSaved.querySelector('code').textContent=s.apiConfigured?'••••••••••••••••':'Not configured';
    const secretSaved=document.getElementById('om-secret-saved');if(secretSaved)secretSaved.querySelector('code').textContent=s.instanceSecretConfigured?'••••••••••••••••':'Not configured';
  }catch(e){showMessage(e.message,false);}
}

async function revealCredentials(){
  const view=document.getElementById('om-view-credentials'),hide=document.getElementById('om-hide-credentials');
  if(view){view.disabled=true;view.textContent='Loading securely…';}
  try{
    const d=await call('/admin/api-settings/reveal');
    const c=d.credentials||{};
    const api=document.getElementById('om-api-input'),secret=document.getElementById('om-secret-input');
    if(api){api.value=c.omniupiApi||'';api.readOnly=false;}
    if(secret){secret.value=c.instanceSecret||'';secret.readOnly=false;}
    if(hide)hide.disabled=false;
    showMessage('Your API and Instance Secret are now visible to this admin session.',true);
  }catch(e){showMessage(e.message,false);}finally{if(view){view.disabled=false;view.textContent='👁 View My API & Secret';}}
}

function hideCredentials(){
  const api=document.getElementById('om-api-input'),secret=document.getElementById('om-secret-input');
  if(api){api.value='';api.readOnly=true;}
  if(secret){secret.value='';secret.readOnly=true;secret.type='password';}
  const toggle=document.getElementById('om-secret-toggle');if(toggle)toggle.textContent='Show';
  const hide=document.getElementById('om-hide-credentials');if(hide)hide.disabled=true;
}

async function deleteWebhook(){
  const current=document.getElementById('om-webhook-input')?.value.trim()||'';
  if(!current)return showMessage('No webhook URL is currently configured.',false);
  if(!window.confirm('Delete the current webhook URL? Payment SUCCESS notifications will stop until you configure a new webhook.'))return;
  const btn=document.getElementById('om-delete-webhook');if(btn){btn.disabled=true;btn.textContent='Deleting…';}
  try{
    await call('/admin/webhook-settings',{method:'DELETE'});
    const input=document.getElementById('om-webhook-input');if(input)input.value='';
    showMessage('Webhook URL deleted. You can now enter a new webhook URL and save it.',true);
    await loadSettings();
  }catch(e){showMessage(e.message,false);}finally{if(btn){btn.disabled=false;btn.textContent='🗑 Delete Webhook';}}
}

function wirePanel(){
  const secret=document.getElementById('om-secret-input'),toggle=document.getElementById('om-secret-toggle');
  toggle?.addEventListener('click',()=>{if(!secret)return;const showing=secret.type==='text';secret.type=showing?'password':'text';toggle.textContent=showing?'Show':'Hide';});
  document.getElementById('om-view-credentials')?.addEventListener('click',revealCredentials);
  document.getElementById('om-hide-credentials')?.addEventListener('click',hideCredentials);
  document.getElementById('om-delete-webhook')?.addEventListener('click',deleteWebhook);
  document.getElementById('om-save-settings')?.addEventListener('click',async()=>{
    const api=document.getElementById('om-api-input')?.value.trim()||'';
    const instanceSecret=document.getElementById('om-secret-input')?.value.trim()||'';
    const webhookUrl=document.getElementById('om-webhook-input')?.value.trim()||'';
    if(!api)return showMessage('Click View My API & Secret first, or enter the API manually.',false);
    if(!instanceSecret)return showMessage('Click View My API & Secret first, or enter the Instance Secret manually.',false);
    try{const u=new URL(webhookUrl);if(!['http:','https:'].includes(u.protocol))throw new Error();}catch{return showMessage('Invalid webhook URL. Use a valid HTTP/HTTPS URL.',false);}
    const btn=document.getElementById('om-save-settings');btn.disabled=true;btn.textContent='Saving…';
    try{
      await call('/auth/admin-api-settings',{method:'POST',body:JSON.stringify({omniupiApi:api,instanceSecret,webhookUrl})});
      hideCredentials();
      showMessage('API credentials and webhook URL saved securely.',true);await loadSettings();
    }catch(e){showMessage(e.message,false);}finally{btn.disabled=false;btn.textContent='✓ Save API Settings';}
  });
  document.getElementById('om-test-webhook')?.addEventListener('click',async()=>{
    const btn=document.getElementById('om-test-webhook');btn.disabled=true;btn.textContent='Testing…';
    try{const d=await call('/auth/admin-api-settings/test-webhook',{method:'POST'});showMessage(d.message||'Webhook configured',true);}catch(e){showMessage(e.message,false);}finally{btn.disabled=false;btn.textContent='↗ Test Webhook';}
  });
  loadSettings();
}

function activate(){
  const content=document.querySelector('.content');if(!content)return;
  active=true;
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('om-admin-api-settings-nav')?.classList.add('active');
  const title=document.querySelector('.topbar h2');if(title)title.textContent='API & Webhook Settings';
  content.innerHTML=panelMarkup();
  wirePanel();
}

function installNav(){
  const nav=document.querySelector('.nav');if(!nav)return false;
  if(!document.getElementById('om-admin-api-settings-nav')){
    const button=document.createElement('button');button.id='om-admin-api-settings-nav';button.type='button';button.className='nav-item';button.innerHTML='<span style="font-size:17px;width:17px;text-align:center">🔐</span><span>API & Webhook Settings</span>';button.addEventListener('click',activate);nav.appendChild(button);
  }
  return true;
}

function boot(){
  if(installNav()){
    if(navObserver)navObserver.disconnect();
    const nav=document.querySelector('.nav');
    nav.addEventListener('click',e=>{if(!e.target.closest('#om-admin-api-settings-nav'))active=false;},{capture:true});
    navObserver=new MutationObserver(()=>{installNav();});navObserver.observe(nav,{childList:true});
  }else setTimeout(boot,250);
}

const style=document.createElement('style');
style.textContent=`.om-settings-wrap{max-width:1100px;margin:0 auto}.om-settings-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:20px}.om-settings-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;color:#6269e8}.om-settings-head h1{margin:5px 0 7px;font-size:30px;color:#172033}.om-settings-head p{margin:0;max-width:760px;color:#687384;line-height:1.6;font-size:13px}.om-settings-shield{background:#edfdf8;color:#087c60;border:1px solid #ccefe5;padding:10px 13px;border-radius:12px;font-size:12px;font-weight:800;white-space:nowrap}.om-settings-message{margin:0 0 18px;padding:13px 15px;border-radius:12px;font-weight:800;font-size:13px}.om-settings-message.success{background:#ecfbf5;color:#087c60;border:1px solid #c9efdf}.om-settings-message.failure{background:#fff1f1;color:#b33a3a;border:1px solid #f3d0d0}.om-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.om-settings-card{background:#fff;border:1px solid #e7ebf1;border-radius:18px;padding:22px;box-shadow:0 8px 24px #1720330a}.om-card-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:20px}.om-card-title span{font-size:10px;letter-spacing:.1em;font-weight:900;color:#7a8596}.om-card-title h3{margin:4px 0 0;color:#172033;font-size:19px}.om-card-title>b{font-size:10px;background:#f0f2ff;color:#555fcb;border-radius:99px;padding:6px 9px}.om-settings-card label{display:block;font-size:12px;font-weight:850;color:#4f5b6d;margin:0 0 15px}.om-settings-card input{display:block;width:100%;box-sizing:border-box;margin-top:7px;border:1px solid #dfe5ed;border-radius:11px;padding:12px 13px;background:#fbfcfe;color:#172033;outline:none;font-size:13px}.om-settings-card input:focus{border-color:#7279e8;box-shadow:0 0 0 3px #7279e817}.om-settings-card input[readonly]{cursor:default}.om-secret-input{display:flex;gap:8px;margin-top:7px}.om-secret-input input{margin:0;flex:1}.om-secret-input button{border:1px solid #dfe5ed;background:#fff;border-radius:11px;padding:0 13px;font-weight:800;color:#596577;cursor:pointer}.om-saved-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#f7f9fb;border:1px solid #edf0f4;border-radius:10px;padding:9px 11px;margin:-5px 0 16px;font-size:11px;color:#7a8595}.om-saved-row code{color:#29354a;font-weight:800}.om-security-note{background:#f6f7ff;border:1px solid #e5e7ff;border-radius:11px;padding:11px;color:#626b80;font-size:11px;line-height:1.6}.om-webhook-rule{background:#f7f9fb;border-radius:12px;padding:13px;margin:8px 0 18px;color:#687384;font-size:11px;line-height:1.6}.om-webhook-rule strong{color:#263247;font-size:12px}.om-webhook-rule p{margin:6px 0 0}.om-actions{display:flex;gap:10px;flex-wrap:wrap}.om-actions button{border:0;border-radius:11px;padding:11px 15px;font-weight:850;cursor:pointer}.om-actions button:disabled{opacity:.6;cursor:wait}.om-primary{background:linear-gradient(135deg,#6269e8,#19b99a);color:#fff}.om-secondary{background:#eef1f6;color:#263247}.om-danger{background:#fff0f0;color:#b83d3d;border:1px solid #f2cccc!important}.om-current-config{margin-top:18px;background:#fff;border:1px solid #e7ebf1;border-radius:16px;padding:16px;display:grid;grid-template-columns:1.1fr 1fr 1fr 1.8fr;gap:12px;align-items:center}.om-current-config>span{font-size:11px;font-weight:900;color:#7a8595}.om-current-config>div{display:flex;flex-direction:column;gap:4px}.om-current-config b{font-size:10px;color:#7a8595}.om-current-config code{font-size:11px;color:#29354a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:850px){.om-settings-grid{grid-template-columns:1fr}.om-settings-head{flex-direction:column}.om-current-config{grid-template-columns:1fr 1fr}}@media(max-width:520px){.om-settings-head h1{font-size:24px}.om-current-config{grid-template-columns:1fr}.om-actions{flex-direction:column}.om-actions button{width:100%}}`;
document.head.appendChild(style);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
