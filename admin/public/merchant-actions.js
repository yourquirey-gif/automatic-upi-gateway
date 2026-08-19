(()=>{
const API='https://api.omniupi.in/api/v1';
const token=()=>localStorage.getItem('gateway_admin_token');
const req=async(path,opts={})=>{const t=token();if(!t)throw new Error('Administrator authentication required');const r=await fetch(API+path,{...opts,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${t}`,...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok||d.status===false)throw new Error(d.message||`Request failed (${r.status})`);return d};
const isVerified=m=>m?.verificationStatus==='verified';
function syncRows(merchants){
  const heading=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Merchants');if(!heading)return;
  const panel=heading.closest('.panel');if(!panel)return;const table=panel.querySelector('table');if(!table)return;
  const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim().toLowerCase());const upiIndex=headers.findIndex(x=>x.includes('upi id'));const verificationIndex=headers.findIndex(x=>x.includes('verification'));const statusIndex=headers.findIndex(x=>x==='status'||x.includes('status'));const actionIndex=headers.findIndex(x=>x.includes('action'));if(upiIndex<0)return;
  for(const row of table.querySelectorAll('tbody tr')){
    const cells=[...row.children];const upi=String(cells[upiIndex]?.textContent||'').trim().toLowerCase();const m=(merchants||[]).find(x=>String(x.upiId||'').trim().toLowerCase()===upi);if(!m)continue;
    const verified=isVerified(m);
    if(verificationIndex>=0){const cell=cells[verificationIndex];if(cell){const badge=cell.querySelector('span')||cell.firstElementChild;if(badge){badge.textContent=verified?'Verified':(m.verificationStatus||'pending');badge.className=verified?'badge badge-success':'badge';}else cell.textContent=verified?'Verified':(m.verificationStatus||'pending')}}
    if(statusIndex>=0){const cell=cells[statusIndex];if(cell){const badge=cell.querySelector('span')||cell.firstElementChild;if(badge){badge.textContent=verified?'Active':(m.status||'pending');badge.className=verified?'badge badge-success':'badge';}else cell.textContent=verified?'Active':(m.status||'pending')}}
    if(actionIndex>=0){const cell=cells[actionIndex];if(cell){const select=cell.querySelector('select');if(select&&verified){select.value='active';select.disabled=true;select.style.opacity='.85';select.title='Verified merchant is active'}const existing=[...cell.querySelectorAll('button')].find(b=>b.dataset.omniDelete==='1');if(!existing){const b=document.createElement('button');b.type='button';b.dataset.omniDelete='1';b.textContent='Delete';b.className='small-btn';b.style.marginLeft='6px';b.style.color='#b42318';b.style.borderColor='#f1b5b0';b.onclick=async()=>{if(!confirm(`Delete UPI ${m.upiId}? This removes its Gmail verification connection too.`))return;b.disabled=true;try{await req(`/merchants/${encodeURIComponent(m._id)}`,{method:'DELETE'});row.remove();alert('UPI deleted successfully.')}catch(e){b.disabled=false;alert(e.message)}};cell.appendChild(b)}}}
  }
}
async function addDeleteButtons(){if(!token())return;try{const {merchants=[]}=await req('/merchants?limit=200');syncRows(merchants)}catch{}}
let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;addDeleteButtons()},180)}
window.addEventListener('load',schedule);window.addEventListener('hashchange',schedule);document.addEventListener('click',schedule,true);setTimeout(schedule,700);
})();
