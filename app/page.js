'use client';
import { useEffect, useRef, useState } from 'react';

const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const WAIT = { label: 'EN ATTENTE', title: 'Aucun titre pour le moment…' };

const loadSpotify = () => new Promise((resolve) => {
  if (window.__spi) return resolve(window.__spi);
  window.onSpotifyIframeApiReady = (api) => { window.__spi = api; resolve(api); };
  const s = document.createElement('script');
  s.src = 'https://open.spotify.com/embed/iframe-api/v1';
  s.async = true;
  document.body.appendChild(s);
});

// La grille des programmes : titres + une pub toutes les N musiques
function build(P) {
  const tr = (P.tracks || []).filter((t) => t.type !== 'spotify' && t.duration > 0);
  const ads = (P.ads || []).filter((t) => t.duration > 0);
  const seq = [];
  tr.forEach((t, i) => {
    seq.push({ ...t, kind: 'track' });
    if (ads.length && P.adEvery > 0 && (i + 1) % P.adEvery === 0)
      seq.push({ ...ads[(Math.floor((i + 1) / P.adEvery) - 1) % ads.length], kind: 'ad' });
  });
  return seq;
}

// Qu'est-ce qui passe à l'instant t (heure du serveur, en ms) ?
function whereIs(seq, t) {
  const total = seq.reduce((s, x) => s + x.duration * 1000, 0);
  if (!total) return null;
  let p = t % total;
  for (const x of seq) {
    const d = x.duration * 1000;
    if (p < d) return { item: x, startMs: t - p };
    p -= d;
  }
  return null;
}

export default function Radio() {
  const [P, setP] = useState({ annonces: [], affiches: [], spotify: null });
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [info, setInfo] = useState({ label: 'ÉCOUTE LA RADIO', title: 'Clique sur play pour lancer le direct' });
  const [hist, setHist] = useState([]);

  const D = useRef({ tracks: [], ads: [], voices: [], adEvery: 3 });
  const off = useRef(0), lastJ = useRef('');
  const mu = useRef(null), cv = useRef(null);
  const began = useRef(false), userPaused = useRef(false), talk = useRef(false);
  const ctl = useRef(null), spOn = useRef(false), spHeld = useRef(false);
  const audio = useRef(), voice = useRef(), box = useRef();

  const refresh = async () => {
    try {
      const t0 = Date.now();
      const s = await (await fetch('/api/state', { cache: 'no-store' })).json();
      const t1 = Date.now();
      if (t1 - t0 < 3000) off.current = s.now + (t1 - t0) / 2 - t1; // décalage avec l'heure du serveur
      D.current = { annonces: [], affiches: [], spotify: null, ...s };
      const j = JSON.stringify([s.annonces, s.affiches, s.spotify]);
      if (j !== lastJ.current) { lastJ.current = j; setP(D.current); }
    } catch {}
  };

  const tick = () => {
    const s = D.current, now = Date.now() + off.current;
    const a = audio.current, vo = voice.current;

    // Message vocal : joué par-dessus, pour tout le monde au même moment
    const v = (s.voices || []).find((x) => x.startAt && x.duration > 0 && now >= x.startAt && now < x.startAt + x.duration * 1000);
    if (v && cv.current !== v.id) {
      cv.current = v.id;
      if (ctl.current && spOn.current) { ctl.current.pause(); spHeld.current = true; } // playlist Spotify en pause
      vo.onloadedmetadata = () => {
        vo.currentTime = Math.max(0, (Date.now() + off.current - v.startAt) / 1000);
        vo.play().catch(() => {});
      };
      vo.src = v.url;
    }
    if (!v && cv.current) {
      cv.current = null;
      vo.pause();
      if (spHeld.current) { spHeld.current = false; if (ctl.current) ctl.current.resume(); }
    }
    talk.current = !!v;
    a.volume = v ? 0.2 : 1;
    if (v && a.volume !== 0.2 && !a.paused) a.pause(); // iPhone : volume non modifiable

    // Musique
    const cur = whereIs(build(s), now);
    if (!cur) {
      if (mu.current !== 'none') { mu.current = 'none'; a.pause(); setInfo(WAIT); }
      return;
    }
    const { item, startMs } = cur, key = item.id + ':' + startMs, pos = (now - startMs) / 1000;
    if (mu.current !== key) {
      mu.current = key;
      a.onloadedmetadata = () => {
        a.currentTime = Math.max(0, (Date.now() + off.current - startMs) / 1000);
        if (!userPaused.current && !talk.current) a.play().catch(() => {});
      };
      a.src = item.url;
      setInfo({ label: item.kind === 'ad' ? 'PUBLICITÉ' : 'EN DIRECT', title: item.title });
      if (item.kind === 'track') setHist((h) => [item.title, ...h].slice(0, 6));
    } else if (!a.paused && Math.abs(a.currentTime - pos) > 2) {
      a.currentTime = pos; // recale sur le direct
    } else if (a.paused && !userPaused.current && !v && a.readyState > 0) {
      a.play().catch(() => {});
    }
  };

  const start = async () => {
    if (began.current) return;
    began.current = true;
    setStarted(true);
    if (ctl.current && spOn.current) ctl.current.pause();
    userPaused.current = false;
    [audio.current, voice.current].forEach((el) => { el.src = SILENCE; el.play().catch(() => {}); });
    await refresh();
    tick();
  };

  const toggle = () => {
    if (!began.current) return start();
    const a = audio.current;
    if (a.paused) {
      userPaused.current = false;
      if (ctl.current && spOn.current) ctl.current.pause(); // on revient au direct
      a.play().catch(() => {});
    } else { userPaused.current = true; a.pause(); }
  };

  // Lecteur de la playlist Spotify
  const spKey = P.spotify ? P.spotify.kind + P.spotify.id : '';
  useEffect(() => {
    if (!P.spotify || !box.current) return;
    let dead = false;
    box.current.innerHTML = '';
    loadSpotify().then((api) => {
      if (dead || !box.current) return;
      const el = document.createElement('div');
      box.current.appendChild(el);
      api.createController(el, { uri: 'spotify:' + P.spotify.kind + ':' + P.spotify.id, width: '100%', height: 352 }, (c) => {
        ctl.current = c;
        c.addListener('playback_update', (e) => {
          spOn.current = !e.data.isPaused;
          // la playlist démarre : on met la radio en direct en pause
          if (spOn.current && !audio.current.paused) { userPaused.current = true; audio.current.pause(); }
        });
      });
    });
    return () => { dead = true; ctl.current = null; spOn.current = false; };
  }, [spKey]);

  useEffect(() => {
    refresh();
    const r = setInterval(refresh, 3000);
    const k = setInterval(() => began.current && tick(), 500);
    return () => { clearInterval(r); clearInterval(k); };
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
        </div>

        {P.spotify && (
          <section>
            <h2>Playlist Spotify</h2>
            <div ref={box} />
            <small style={{ display: 'block', marginTop: 8 }}>
              🟢 Connecte-toi à Spotify dans ce navigateur pour l'écouter en entier (sinon, extraits de 30 s).
              Quand tu la lances, la radio en direct se met en pause : reviens avec le bouton ▶ en bas.
            </small>
          </section>
        )}

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

      <audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <audio ref={voice} />
    </div>
  );
}
