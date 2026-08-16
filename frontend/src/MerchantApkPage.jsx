import React from 'react';
import { Download, ExternalLink, ShieldCheck } from 'lucide-react';

const APPS = [
  { name: 'Paytm Business', version: 'v10.5.2', brand: 'Paytm', url: 'https://play.google.com/store/apps/details?id=com.paytm.business', official: true },
  { name: 'PhonePe Business', version: 'v8.9.1', brand: 'PhonePe', url: 'https://play.google.com/store/apps/details?id=com.phonepe.app.business', official: true },
  { name: 'Google Pay Business', version: 'v6.7.0', brand: 'G Pay', url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.nbu.paisa.merchant', official: true },
  { name: 'SMS Forwarder', version: 'v1.0.0', brand: 'SMS', url: '', official: false },
  { name: 'Notification Forwarder', version: 'v1.0.0', brand: 'Notification', url: '', official: false }
];

export default function MerchantApkPage() {
  return <div className="dash-content" style={{maxWidth:1080,margin:'0 auto'}}>
    <div className="page-title">
      <span className="eyebrow">DEVELOPER SETTING</span>
      <h1>Merchant APK Downloads</h1>
      <p>Download official merchant applications and configured forwarding tools.</p>
    </div>
    <div style={{display:'grid',gap:18}}>
      {APPS.map(app => <section key={app.name} style={{background:'#fff',border:'1px solid #e7eaf1',borderRadius:22,padding:20,boxShadow:'0 12px 32px #202b430d'}}>
        <div style={{height:105,borderRadius:17,background:'#f7f8fb',display:'grid',placeItems:'center',fontSize:34,fontWeight:900,color:'#273145'}}>{app.brand}</div>
        <h2 style={{margin:'20px 0 8px',color:'#202a3e'}}>{app.name}</h2>
        <p style={{margin:'0 0 16px',color:'#7c8798'}}>Configured merchant application</p>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8f9fb',borderRadius:13,padding:'14px 16px',marginBottom:14}}>
          <span style={{color:'#7c8798'}}>Latest Version</span><strong style={{color:'#202a3e'}}>{app.version}</strong>
        </div>
        {app.official && <div style={{fontSize:12,color:'#248b67',marginBottom:12,display:'flex',alignItems:'center',gap:6}}><ShieldCheck size={16}/> Official Google Play source</div>}
        {app.url ? <button onClick={()=>window.open(app.url,'_blank','noopener,noreferrer')} style={{width:'100%',border:0,borderRadius:13,padding:15,color:'#fff',fontWeight:850,fontSize:16,background:'linear-gradient(90deg,#21a8e8,#2477e8)',cursor:'pointer'}}><Download size={19} style={{verticalAlign:'middle',marginRight:7}}/> Open Official Download</button> : <button disabled style={{width:'100%',border:0,borderRadius:13,padding:15,color:'#8a93a2',fontWeight:850,fontSize:16,background:'#eef1f5',cursor:'not-allowed'}}><Download size={19} style={{verticalAlign:'middle',marginRight:7}}/> APK URL Not Configured</button>}
      </section>)}
    </div>
  </div>;
}
