(()=>{
const API='https://api.omniupi.in';
const req=async(path,opts={})=>{const token=localStorage.getItem('omniupi_token');if(!token)throw new Error('Please login again.');const r=await fetch(API+path,{...opts,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`,...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok||d.status===false)throw new Error(d.message||`Request failed (${r.status})`);return d};
function toast(m){window.toast?window.toast(m):alert(m)}
window.buyPlan=async id=>{try{const d=await req('/api/v1/subscriptions/purchase',{method:'POST',body:JSON.stringify({planId:id})});location.href=`./subscription-checkout.html?order=${encodeURIComponent(d.order.orderId)}`}catch(e){toast(e.message)}};
})();