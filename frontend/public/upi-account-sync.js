(()=>{
const API='https://api.omniupi.in/api/v1';
let lastKey='';
const token=()=>localStorage.getItem('gateway_access_token');
async function req(path,opts={}){const t=token();if(!t)throw new Error('Not logged in');const r=await fetch(API+path,{...opts,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${t}`,...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok||d.status===false)throw new Error(d.message||`Request failed (${r.status})`);return d}
function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
function verified(m){return m?.verificationStatus==='verified' || (m?.status==='active' && m?.verificationStatus==='verified')}
function syncDashboardTable(merchants){
  const table=[...document.querySelectorAll('.merchants-card table')][0];
  if(!table)return;
  const rows=[...table.querySelectorAll('tbody tr')];
  rows.forEach(row=>{
    const cells=[...row.children];
    if(cells.length<5)return;
    const mobile=String(cells[3]?.textContent||'').replace(/\D/g,'');
    const label=String(cells[2]?.textContent||'').trim().toLowerCase();
    const type=String(cells[1]?.textContent||'').trim().toLowerCase();
    const m=(merchants||[]).find(x=>{
      const mm=String(x.mobile||'').replace(/\D/g,'');
      return (mobile&&mm&&mobile===mm) || (String(x.name||'').trim().toLowerCase()===label && String(x.provider||'').trim().toLowerCase()===type);
    });
    if(!m)return;
    const isVerified=verified(m);
    const statusCell=cells[4];
    const actionCell=cells[5];
    if(statusCell){const badge=statusCell.querySelector('span')||statusCell.firstElementChild;if(badge){badge.textContent=isVerified?'Active':'Inactive';badge.className=isVerified?'status-ok':'status-pending'}else statusCell.textContent=isVerified?'Active':'Inactive'}
    if(actionCell){const button=actionCell.querySelector('button');if(button){button.innerHTML=isVerified?'✓ Verified':'🛡 Verify';button.disabled=isVerified;button.style.opacity=isVerified?'0.85':'1';button.style.cursor=isVerified?'default':'pointer';button.classList.toggle('verified',isVerified)}}
  });
}
function render(account,merchants){const root=document.querySelector('.dash-main');if(!root)return;let box=document.getElementById('omni-upi-sync');if(!box){box=document.createElement('section');box.id='omni-upi-sync';box.style.cssText='margin:0 0 18px;padding:18px;border:1px solid #e7eaf0;border-radius:20px;background:#fff;box-shadow:0 10px 30px rgba(20,30,50,.06);position:relative;z-index:5';root.prepend(box)}const admin=account?.role==='admin';const rows=(merchants||[]).map(m=>{const isVerified=verified(m);return `<div data-mid="${esc(m._id)}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #eef1f5"><div><b>${esc(m.name||'UPI Merchant')}</b><div style="font-size:12px;color:#7b8492;margin-top:3px">${esc(m.upiId||'—')} · ${esc(m.provider||'UPI')}</div></div><div style="display:flex;align-items:center;gap:8px"><span style="padding:6px 10px;border-radius:999px;font-size:11px;font-weight:800;background:${isVerified?'#ecfbf3':'#fff7df'};color:${isVerified?'#15734f':'#856a13'}">${isVerified?'✓ Verified':'Verification required'}</span><button data-delete="${esc(m._id)}" style="border:1px solid #f0b7b1;background:#fff;border-radius:9px;padding:7px 10px;color:#b42318;font-weight:700;cursor:pointer">Delete</button></div></div>`}).join('');const adminMerchant=(merchants||[]).find(m=>m.provider==='admin_settlement');const adminText=adminMerchant?(verified(adminMerchant)?`<span style="color:#15734f">✓ Admin payment UPI is already verified.</span>`:`<span style="color:#856a13">Admin payment UPI needs Google/Gmail verification.</span>`):'No admin settlement UPI configured.';box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div style="font-size:16px;font-weight:850">UPI Verification Status</div><div style="font-size:12px;color:#7b8492;margin-top:4px">${admin?adminText:'Your connected UPI accounts and Gmail payment verification status.'}</div></div><button id="omni-upi-refresh" style="border:1px solid #dfe4ec;background:#fff;border-radius:9px;padding:7px 10px;cursor:pointer">Refresh</button></div>${rows||'<div style="padding:14px 0;color:#7b8492;font-size:12px">No connected UPI merchant found. Add a merchant from Connect Merchant.</div>'}`;box.querySelector('#omni-upi-refresh')?.addEventListener('click',load);box.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.delete;if(!confirm('Delete this UPI merchant and its Gmail verification connection?'))return;btn.disabled=true;try{await req(`/merchants/${encodeURIComponent(id)}`,{method:'DELETE'});await load();}catch(e){btn.disabled=false;alert(e.message)}}));syncDashboardTable(merchants)}
async function load(){if(!token()||!location.hash.includes('dashboard'))return;try{const [a,m]=await Promise.all([req('/account'),req('/merchants')]);const account=a.user||{};const merchants=m.merchants||[];const key=JSON.stringify({id:account._id,role:account.role,ms:merchants.map(x=>[x._id,x.verificationStatus,x.status,x.upiId,x.mobile])});if(key!==lastKey){lastKey=key;render(account,merchants)}else syncDashboardTable(merchants)}catch{}}
setInterval(load,4000);window.addEventListener('hashchange',()=>setTimeout(load,300));setTimeout(load,1200);
})();
