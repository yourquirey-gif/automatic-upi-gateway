import React, { useEffect, useMemo, useState } from 'react';
import { Play, Search, Video, X } from 'lucide-react';
import { api } from './api';
import './video-merchant.css';

function youtubeId(url) { try { const u = new URL(url); if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0]; if (u.hostname.includes('youtube.com')) { if (u.pathname === '/watch') return u.searchParams.get('v'); const parts = u.pathname.split('/').filter(Boolean); const i = parts.findIndex(x => ['shorts','embed','live'].includes(x)); if (i >= 0) return parts[i + 1]; } } catch {} return null; }
function youtubeThumbnail(url, fallback) { const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : fallback || ''; }

export default function VideoMerchant() {
  const [videos, setVideos] = useState([]), [categories, setCategories] = useState([]), [playing, setPlaying] = useState(null), [loading, setLoading] = useState(true), [q, setQ] = useState(''), [category, setCategory] = useState('');
  useEffect(() => { api('/videos').then(d => { setVideos(d.videos || []); setCategories(d.categories || []); }).catch(() => { setVideos([]); setCategories([]); }).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => videos.filter(v => !q || [v.title,v.description,v.category,...(v.tags||[])].join(' ').toLowerCase().includes(q.toLowerCase())).filter(v => !category || v.category === category), [videos,q,category]);
  return <div className="video-merchant-page">
    <div className="video-merchant-head"><div className="video-head-icon"><Video size={28}/></div><div><span>DEVELOPER SETTING</span><h1>Merchant Video Tutorials</h1><p>Step-by-step guides for setup, payment links, API integration and troubleshooting.</p></div></div>
    <div className="video-tools"><div className="video-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search tutorials…"/></div><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
    {loading && <div className="video-loading">Loading tutorials…</div>}
    {!loading && !filtered.length && <div className="video-empty"><Video size={42}/><h2>{videos.length ? 'No tutorials match your search' : 'No tutorials available'}</h2><p>{videos.length ? 'Try another title, category or keyword.' : 'Published merchant tutorials will appear here when the administrator adds them.'}</p></div>}
    <div className="video-list">{filtered.map((video,index) => { const id=youtubeId(video.url); const thumb=youtubeThumbnail(video.url,video.thumbnail); return <article className="merchant-video-card" key={video.id || video.url || index}><button className="video-thumb" onClick={()=>id&&setPlaying({...video,id})} disabled={!id} aria-label={`Play ${video.title}`}><img src={thumb} alt={video.title} loading="lazy"/><span className="play-overlay"><Play size={26} fill="currentColor"/></span>{video.duration&&<span className="video-duration">{video.duration}</span>}</button><div className="video-card-body"><div className="video-meta"><span className="video-category">{video.category}</span><span>#{index+1}</span></div><h2>{video.title}</h2>{video.description&&<p>{video.description}</p>} {video.tags?.length>0&&<small>{video.tags.slice(0,4).join(' · ')}</small>}</div></article>; })}</div>
    {playing && <div className="video-modal" onClick={e=>e.target===e.currentTarget&&setPlaying(null)}><div className="video-modal-box"><button className="video-close" onClick={()=>setPlaying(null)}><X size={22}/></button><div className="video-frame"><iframe src={`https://www.youtube.com/embed/${playing.id}?autoplay=1&rel=0`} title={playing.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div><h2>{playing.title}</h2>{playing.description&&<p>{playing.description}</p>}</div></div>}
  </div>;
}
