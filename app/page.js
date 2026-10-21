'use client';
import { useEffect, useRef, useState } from 'react';

const loadSpotify = () => new Promise((resolve) => {
  if (window.__spi) return resolve(window.__spi);
  window.onSpotifyIframeApiReady = (api) => { window.__spi = api; resolve(api); };
  const s = document.createElement('script');
  s.src = 'https://open.spotify.com/embed/iframe-api/v1';
  s.async = true;
  document.body.appendChild(s);
});

export default function Radio() {
  const [on, setOn] = useState(false);
  const [now, setNow] = useState(null);
  const S = useRef({ tracks: [], ads: [], voices: [], adEvery: 3 });
  const heard = useRef(new Set());
  const idx = useRef(0), adIdx = useRef(0), cnt = useRef(0), first = useRef(true);
  const audio = useRef(), box = useRef();

  const refresh = async () => {
    try {
      const s = await (await fetch('/api/state', { cache: 'no-store' })).json();
      if (first.current) {
        first.current = false;
        s.voices.forEach((v) => heard.current.add(v.id));
        idx.current = Math.floor(Math.random() * (s.tracks.length || 1));
      }
      S.current = s;
    } catch {}
  };

  const next = () => {
    const s = S.current;
    const v = s.voices.find((x) => !heard.current.has(x.id));
    let item = null;
    if (v) { heard.current.add(v.id); item = { ...v, kind: 'voice' }; }
    else if (s.ads.length && s.adEvery > 0 && cnt.current >= s.adEvery) {
      cnt.current = 0;
      item = { ...s.ads[adIdx.current++ % s.ads.length], kind: 'ad' };
    } else if (s.tracks.length) {
      cnt.current++;
      item = { ...s.tracks[idx.current++ % s.tracks.length], kind: 'track' };
    }
    setNow(item);
    if (!item) setTimeout(() => refresh().then(next), 10000);
  };

  const start = async () => { setOn(true); await refresh(); next(); };

  useEffect(() => {
    if (!on) return;
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [on]);

  useEffect(() => {
    if (!on) return;
    const a = audio.current;
    a.pause();
    box.current.innerHTML = '';
    if (!now) return;
    if (now.type === 'spotify') {
      let done = false;
      loadSpotify().then((api) => {
        const el = document.createElement('div');
        box.current.appendChild(el);
        api.createController(el, { uri: 'spotify:track:' + now.spotifyId, width: '100%', height: 80 }, (c) => {
          c.addListener('ready', () => c.play());
          c.addListener('playback_update', (e) => {
            const d = e.data;
            if (!done && d.duration && d.position >= d.duration - 800) { done = true; next(); }
          });
        });
      });
    } else {
      a.src = now.url;
      a.play().catch(next);
    }
  }, [now]);

  const label = now?.kind === 'ad' ? 'PUBLICITÉ' : now?.kind === 'voice' ? 'MESSAGE DE LA RADIO' : 'EN COURS';

  return (
    <main>
      <h1>📻 Ma Radio</h1>
      {!on ? (
        <button className="big" onClick={start}>▶ Écouter</button>
      ) : (
        <div className="card">
          <small>{label}</small>
          <h2>{now ? now.title : 'Aucun titre pour le moment…'}</h2>
        </div>
      )}
      <audio ref={audio} onEnded={next} onError={next} />
      <div ref={box} />
    </main>
  );
}
