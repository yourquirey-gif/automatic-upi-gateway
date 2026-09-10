import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search, Video } from 'lucide-react';
import { api } from './api';
import './video-merchant.css';

function youtubeId(url) { try { const u = new URL(url); if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0]; if (u.hostname.includes('youtube.com')) { if (u.pathname === '/watch') return u.searchParams.get('v'); const parts = u.pathname.split('/').filter(Boolean); const i = parts.findIndex(x => ['shorts','embed','live'].includes(x)); if (i >= 0) return parts[i + 1]; } } catch {} return null; }
function youtubeThumbnail(url, fallback) { const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : fallback || ''; }
function youtubeWatchUrl(url) { const id = youtubeId(url); return id ? `https://www.youtube.com/watch?v=${id}` : url; }

export default function VideoMerchant() {
  const [videos, setVideos] = useState([]), [categories, setCategories] = useState([]), [loading, setLoading] = useState(true), [q, setQ] = useState(''), [category, setCategory] = useState('');
  useEffect(() => { api('/videos').then(d => { setVideos(d.videos || []); setCategories(d.categories || []); }).catch(() => { setVideos([]); setCategories([]); }).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => videos.filter(v => !q || [v.title,v.description,v.category,...(v.tags||[])].join(' ').toLowerCase().includes(q.toLowerCase())).filter(v => !category || v.category === category), [videos,q,category]);
  const openYouTube = (url) => { const target = youtubeWatchUrl(url); if (target) window.open(target, '_blank', 'noopener,noreferrer'); };
  return <div className="video-merchant-page">
    <div className="video-merchant-head"><div className="video-head-icon"><Video size={24}/></div><div><span>DEVELOPER SETTING</span><h1>Merchant Video Tutorials</h1><p>Step-by-step guides for setup, payment links, API integration and troubleshooting.</p></div></div>
    <div className="video-tools"><div className="video-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search tutorials…"/></div><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
    {loading && <div className="video-loading">Loading tutorials…</div>}
    {!loading && !filtered.length && <div className="video-empty"><Video size={42}/><h2>{videos.length ? 'No tutorials match your search' : 'No tutorials available'}</h2><p>{videos.length ? 'Try another title, category or keyword.' : 'Published merchant tutorials will appear here when the administrator adds them.'}</p></div>}
    <div className="video-list">{filtered.map((video,index) => { const id=youtubeId(video.url); const thumb=youtubeThumbnail(video.url,video.thumbnail); return <article className="merchant-video-card" key={video.id || video.url || index} onClick={()=>id&&openYouTube(video.url)} role={id?'button':undefined} tabIndex={id?0:undefined} onKeyDown={e=>{if(id&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openYouTube(video.url)}}}><div className="video-thumb"><img src={thumb} alt={video.title} loading="lazy"/><span className="youtube-open"><ExternalLink size={17}/></span>{video.duration&&<span className="video-duration">{video.duration}</span>}</div><div className="video-card-body"><div className="video-meta"><span className="video-category">{video.category}</span></div><h2>{video.title}</h2>{video.description&&<p>{video.description}</p>} {video.tags?.length>0&&<small>{video.tags.slice(0,3).join(' · ')}</small>}<span className="watch-youtube">Watch on YouTube <ExternalLink size={13}/></span></div></article>; })}</div>
  </div>;
}
