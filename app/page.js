'use client';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import Dedicaces from './Dedicaces';
import DownloadApp from './DownloadApp';

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
  const [liveOn, setLiveOn] = useState(false);
  const [needAudio, setNeedAudio] = useState(false);

  const D = useRef({ tracks: [], ads: [], voices: [], adEvery: 3 });
  const off = useRef(0), lastJ = useRef('');
  const mu = useRef(null), cv = useRef(null);
  const began = useRef(false), userPaused = useRef(false), talk = useRef(false), wasQuiet = useRef(false);
  const ctl = useRef(null), spOn = useRef(false), spHeld = useRef(false);
  const liveRoom = useRef(null), joining = useRef(false), lastTry = useRef(0), liveAudio = useRef(false);
  const liveCnt = useRef(0);
  const audio = useRef(), voice = useRef(), box = useRef();

  const nowMs = Date.now() + off.current;
  const currentTrack = whereIs(build(P), nowMs)?.item || null;
  const coverUrl = currentTrack?.cover || currentTrack?.image || currentTrack?.art || currentTrack?.poster || currentTrack?.thumbnail || '';

  const setLA = (b) => { liveAudio.current = b; setLiveOn(b); };

  // Fait défiler la page jusqu'au formulaire de dédicace
  const goDedicace = () => {
    const el = document.getElementById('dedicace-zone');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Rejoint le direct de l'animateur et des invités (appel en temps réel)
  const joinLive = async () => {
    if (liveRoom.current || joining.current) return;
    joining.current = true;
    try {
      const r = await fetch('/api/live/token', { method: 'POST', body: '{}' });
      if (!r.ok) throw new Error('token');
      const { token, url } = await r.json();
      const room = new Room();
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.dataset.live = '1';
          document.body.appendChild(el);
          liveCnt.current++;
          setLA(true);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
        if (track.kind === Track.Kind.Audio) {
          liveCnt.current = Math.max(0, liveCnt.current - 1);
          if (liveCnt.current === 0) setLA(false);
        }
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedAudio(!room.canPlaybackAudio));
      await room.connect(url, token);
      room.startAudio().catch(() => {});
      liveRoom.current = room;
    } catch {}
    joining.current = false;
  };

  const leaveLive = () => {
    const room = liveRoom.current;
    liveRoom.current = null;
    document.querySelectorAll('audio[data-live]').forEach((el) => el.remove());
    liveCnt.current = 0;
    setLA(false);
    setNeedAudio(false);
    if (room) room.disconnect();
  };

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

    // Direct micro : on rejoint / on quitte selon l'état de la radio
    if (s.live && !liveRoom.current && Date.now() - lastTry.current > 5000) { lastTry.current = Date.now(); joinLive(); }
    if (!s.live && liveRoom.current) leaveLive();

    // Message vocal enregistré : joué pour tout le monde au même moment
    const v = (s.voices || []).find((x) => x.startAt && x.duration > 0 && now >= x.startAt && now < x.startAt + x.duration * 1000);
    if (v && cv.current !== v.id) {
      cv.current = v.id;
      vo.onloadedmetadata = () => {
        vo.currentTime = Math.max(0, (Date.now() + off.current - v.startAt) / 1000);
        vo.play().catch(() => {});
      };
      vo.src = v.url;
    }
    if (!v && cv.current) { cv.current = null; vo.pause(); }

    // La musique baisse quand quelqu'un parle (message ou direct)
    const quiet = !!v || liveAudio.current;
    talk.current = quiet;
    if (quiet && !wasQuiet.current) {
      wasQuiet.current = true;
      if (ctl.current && spOn.current) { ctl.current.pause(); spHeld.current = true; } // playlist Spotify en pause
    }
    if (!quiet && wasQuiet.current) {
      wasQuiet.current = false;
      if (spHeld.current) { spHeld.current = false; if (ctl.current) ctl.current.resume(); }
    }
    a.volume = quiet ? 0.2 : 1;
    if (quiet && a.volume !== 0.2 && !a.paused) a.pause(); // iPhone : volume non modifiable

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
    } else if (a.paused &&
