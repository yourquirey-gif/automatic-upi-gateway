import React, { useEffect, useState } from 'react';
import { GripVertical, Play, Save, Trash2, Plus } from 'lucide-react';
import { adminApi } from './api';

function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0];
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      const i = parts.findIndex(x => x === 'shorts' || x === 'embed' || x === 'live');
      if (i >= 0) return parts[i + 1];
    }
  } catch {}
  return null;
}

const empty = () => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: '', url: '', active: true, order: 0 });

export default function VideoSettings({ onMessage }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await adminApi('/videos/admin');
      setVideos(data.videos || []);
    } catch (e) { onMessage(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const add = () => setVideos(v => [...v, { ...empty(), order: v.length }]);
  const update = (id, patch) => setVideos(v => v.map(x => x.id === id ? { ...x, ...patch } : x));
  const remove = id => setVideos(v => v.filter(x => x.id !== id).map((x, i) => ({ ...x, order: i })));

  const save = async e => {
    e.preventDefault();
    const cleaned = videos.map((v, i) => ({ ...v, order: i })).filter(v => v.title.trim() && youtubeId(v.url));
    if (cleaned.length !== videos.length) {
      onMessage('Har video me title aur valid YouTube link add karo.');
      return;
    }
    try {
      setSaving(true);
      const data = await adminApi('/videos/admin', { method: 'PUT', body: JSON.stringify({ videos: cleaned }) });
      setVideos(data.videos || []);
      onMessage('Merchant videos saved successfully');
    } catch (e) { onMessage(e.message); }
    finally { setSaving(false); }
  };

  return <section>
    <div className="section-top">
      <div>
        <h2>Video For Merchant</h2>
        <p>YouTube link add karo. Merchant panel me thumbnail automatically show hoga aur click par video play hoga.</p>
      </div>
      <button className="primary" type="button" onClick={add}><Plus size={17}/> Add Video</button>
    </div>

    {loading ? <div className="hero-admin"><h2>Loading videos…</h2></div> : <form onSubmit={save}>
      <div style={{display:'grid',gap:16}}>
        {videos.map((video, index) => {
          const id = youtubeId(video.url);
          const thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '';
          return <article key={video.id} style={{background:'#fff',border:'1px solid #e4e8ef',borderRadius:18,padding:18}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:14}}>
              <b style={{display:'flex',alignItems:'center',gap:8}}><GripVertical size={18}/> Video #{index + 1}</b>
              <button type="button" className="danger" onClick={() => remove(video.id)}><Trash2 size={15}/> Remove</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 220px',gap:18,alignItems:'start'}}>
              <div style={{display:'grid',gap:12}}>
                <label>Video title<input value={video.title} onChange={e => update(video.id, { title: e.target.value })} placeholder="How To Connect Slice Bank" required/></label>
                <label>YouTube video link<input value={video.url} onChange={e => update(video.id, { url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." required/></label>
                <label style={{display:'flex',alignItems:'center',gap:10,fontWeight:700}}><input type="checkbox" checked={video.active !== false} onChange={e => update(video.id, { active: e.target.checked })}/> Show this video to merchants</label>
                {video.url && !id && <div className="error">Invalid YouTube URL</div>}
              </div>
              <div style={{borderRadius:14,overflow:'hidden',background:'#f1f3f7',aspectRatio:'16/9',position:'relative'}}>
                {thumb ? <img src={thumb} alt="YouTube thumbnail" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e => { e.currentTarget.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`; }}/> : <div style={{height:'100%',display:'grid',placeItems:'center',color:'#7a8494'}}>Thumbnail preview</div>}
                {id && <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',pointerEvents:'none'}}><span style={{width:48,height:48,borderRadius:'50%',background:'#fff',display:'grid',placeItems:'center',boxShadow:'0 8px 25px #0003'}}><Play size={21} fill="currentColor"/></span></div>}
              </div>
            </div>
          </article>;
        })}
      </div>
      {!videos.length && <div className="hero-admin"><h2>No merchant videos yet</h2><p>Click “Add Video”, paste a YouTube URL and save.</p></div>}
      <div style={{marginTop:18}}><button className="primary" disabled={saving}><Save size={17}/> {saving ? 'Saving…' : 'Save Videos'}</button></div>
    </form>}
  </section>;
}
