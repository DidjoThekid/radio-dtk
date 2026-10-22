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
  const [P, setP] = useState({ annonces: [], affiches: [] });
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [info, setInfo] = useState({ label: 'ÉCOUTE LA RADIO', title: 'Clique sur play pour lancer le direct' });
  const [hist, setHist] = useState([]);

  const D = useRef({ tracks: [], ads: [], voices: [], adEvery: 3 });
  const heard = useRef(new Set());
  const idx = useRef(0), adIdx = useRef(0), cnt = useRef(0), first = useRef(true);
  const ctl = useRef(null), began = useRef(false);
  const audio = useRef(), sp = useRef();

  const refresh = async () => {
    try {
      const s = { annonces: [], affiches: [], ...(await (await fetch('/api/state', { cache: 'no-store' })).json()) };
      if (first.current) {
        first.current = false;
        s.voices.forEach((v) => heard.current.add(v.id));
        idx.current = Math.floor(Math.random() * (s.tracks.length || 1));
      }
      D.current = s;
      setP(s);
    } catch {}
  };

  const play = (it, kind) => {
    const a = audio.current;
    a.pause();
    ctl.current = null;
    sp.current.innerHTML = '';
    if (!it) {
      setInfo({ label: 'EN ATTENTE', title: 'Aucun titre pour le moment…' });
      setTimeout(() => refresh().then(next), 10000);
      return;
    }
    setInfo({
      label: kind === 'ad' ? 'PUBLICITÉ' : kind === 'voice' ? 'MESSAGE DE LA RADIO' : 'EN COURS',
      title: it.title,
    });
    if (kind === 'track') setHist((h) => [it.title, ...h].slice(0, 6));
    if (it.type === 'spotify') {
      let done = false;
      loadSpotify().then((api) => {
        const el = document.createElement('div');
        sp.current.appendChild(el);
        api.createController(el, { uri: 'spotify:track:' + it.spotifyId, width: '100%', height: 80 }, (c) => {
          ctl.current = c;
          c.addListener('ready', () => c.play());
          c.addListener('playback_update', (e) => {
            const d = e.data;
            setPlaying(!d.isPaused);
            if (!done && d.duration && d.position >= d.duration - 800) { done = true; next(); }
          });
        });
      });
    } else {
      a.src = it.url;
      a.play().catch(() => setTimeout(next, 1000));
    }
  };

  const next = () => {
    const s = D.current;
    const v = s.voices.find((x) => !heard.current.has(x.id));
    let item = null, kind = 'track';
    if (v) { heard.current.add(v.id); item = v; kind = 'voice'; }
    else if (s.ads.length && s.adEvery > 0 && cnt.current >= s.adEvery) {
      cnt.current = 0;
      item = s.ads[adIdx.current++ % s.ads.length];
      kind = 'ad';
    } else if (s.tracks.length) {
      cnt.current++;
      item = s.tracks[idx.current++ % s.tracks.length];
    }
    play(item, kind);
  };

  const start = async () => {
    if (began.current) return;
    began.current = true;
    setStarted(true);
    await refresh();
    next();
  };

  const toggle = () => {
    if (!began.current) return start();
    if (ctl.current) ctl.current.togglePlay();
    else { const a = audio.current; a.paused ? a.play() : a.pause(); }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={playing ? 'playing' : ''}>
      <header>
        <div className="logo">📻 Ma Radio</div>
        <div className="live"><i></i>EN DIRECT</div>
      </header>

      {P.annonces.length > 0 && (
        <div className="ticker">
          <span>{P.annonces.map((x) => '📢 ' + x.title + (x.text ? ' — ' + x.text : '')).join('\u00a0\u00a0\u00a0\u00a0★\u00a0\u00a0\u00a0\u00a0')}</span>
        </div>
      )}

      <main>
        <div className="hero">
          <div className="eq"><b></b><b></b><b></b><b></b><b></b></div>
          <small>{info.label}</small>
          <h1>{info.title}</h1>
          {!started && <button className="btn" onClick={start}>▶ Écouter</button>}
          <div id="sp" ref={sp} />
        </div>

        {P.affiches.length > 0 && (
          <section>
            <h2>Affiches</h2>
            <div className="posters">
              {P.affiches.map((x) => (
                <a key={x.id} className="poster" href={x.link || x.url} target="_blank" rel="noopener noreferrer">
                  <img src={x.url} alt={x.title || ''} loading="lazy" />
                  <span>{x.title}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {P.annonces.length > 0 && (
          <section>
            <h2>Annonces</h2>
            <div className="news">
              {P.annonces.map((x) => (
                <div key={x.id} className="note"><b>{x.title}</b><p>{x.text}</p></div>
              ))}
            </div>
          </section>
        )}

        {hist.length > 1 && (
          <section>
            <h2>Derniers titres</h2>
            <ol>{hist.slice(1).map((t, i) => <li key={i}>{t}</li>)}</ol>
          </section>
        )}
      </main>

      <div className="bar">
        <button id="pp" onClick={toggle}>{playing ? '⏸' : '▶'}</button>
        <div><small>{info.label}</small><div id="btitle">{info.title}</div></div>
      </div>

      <audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={next} onError={() => setTimeout(next, 1000)} />
    </div>
  );
}
