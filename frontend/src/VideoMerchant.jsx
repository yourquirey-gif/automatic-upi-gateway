import React, { useEffect, useState } from 'react';
import { Play, Video, X } from 'lucide-react';
import { api } from './api';
import './video-merchant.css';

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

export default function VideoMerchant() {
  const [videos, setVideos] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/videos').then(d => setVideos(d.videos || [])).catch(() => setVideos([])).finally(() => setLoading(false));
  }, []);

  return <div className="video-merchant-page">
    <div className="video-merchant-head">
      <div className="video-head-icon"><Video size={28}/></div>
      <div><span>DEVELOPER SETTING</span><h1>Payment Gateway<br/>Merchant Connection Guide</h1><p>Follow these step-by-step video tutorials to connect your merchant account.</p></div>
    </div>

    {loading && <div className="video-loading">Loading tutorials…</div>}
    {!loading && !videos.length && <div className="video-empty"><Video size={42}/><h2>No tutorials available</h2><p>Merchant connection videos will appear here when the administrator adds them.</p></div>}

    <div className="video-list">
      {videos.map((video, index) => {
        const id = youtubeId(video.url);
        if (!id) return null;
        const thumbnail = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
        return <article className="merchant-video-card" key={video.id || id}>
          <button className="video-thumb" onClick={() => setPlaying({ ...video, id })} aria-label={`Play ${video.title}`}>
            <img src={thumbnail} alt={video.title} onError={e => { e.currentTarget.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }}/>
            <span className="play-overlay"><Play size={26} fill="currentColor"/></span>
          </button>
          <div className="video-card-body"><span className="video-number">#{index + 1}</span><h2>{video.title}</h2><button className="watch-link" onClick={() => setPlaying({ ...video, id })}>→ Click on the video to watch the tutorial</button></div>
        </article>;
      })}
    </div>

    {playing && <div className="video-modal" onClick={e => e.target === e.currentTarget && setPlaying(null)}>
      <div className="video-modal-box"><button className="video-close" onClick={() => setPlaying(null)}><X size={22}/></button><div className="video-frame"><iframe src={`https://www.youtube.com/embed/${playing.id}?autoplay=1&rel=0`} title={playing.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div><h2>{playing.title}</h2></div>
    </div>}
  </div>;
}
