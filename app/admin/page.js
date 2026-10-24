'use client';
import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { Room, RoomEvent } from 'livekit-client';
import { parseBlob } from 'music-metadata-browser'; // <-- Nouvelle bibliothèque
import AdminDedicaces from './AdminDedicaces';
import AdminInvites from './AdminInvites';

const EMPTY = { tracks: [], ads: [], voices: [], annonces: [], affiches: [], adEvery: 3, spotify: null, live: false };

const dur = (src) => new Promise((res) => {
  const a = new Audio();
  a.preload = 'metadata';
  a.onloadedmetadata = () => res(isFinite(a.duration) ? Math.round(a.duration * 100) / 100 : 0);
  a.onerror = () => res(0);
  a.src = src;
});
const fmt = (s) => (s ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '?');

export default function Admin() {
  const [pw, setPw] = useState('');
  const [ok, setOk] = useState(false);
  const [s, setS] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [link, setLink] = useState('');
  const [at, setAt] = useState('');
  const [ax, setAx] = useState('');
  const [rec, setRec] = useState(false);
  const [live, setLive] = useState(false);
  const sr = useRef(s); sr.current = s;
  const mr = useRef(), t0 = useRef(0), room = useRef(null);

  const save = async (n) => {
    setS(n); sr.current = n;
    const r = await fetch('/api/state', { method: 'POST', headers: { 'x-admin-password': pw }, body: JSON.stringify(n) });
    if (!r.ok) { setMsg('❌ Mot de passe incorrect ou erreur serveur'); return false; }
    const j = await r.json();
    setS(j.state); sr.current = j.state;
    return true;
  };

  const login = async () => {
    const cur = { ...EMPTY, ...(await (await fetch('/api/state', { cache: 'no-store' })).json()), live: false };
    if (await save(cur)) { setOk(true); setMsg(''); }
  };

  const updateApp = async () => {
    const pwd = sessionStorage.getItem('adminPwd') || prompt('Mot de passe admin :');
    if (!pwd) return;

    setUpdateStatus('Mise à jour en cours…');
    try {
      const r = await fetch('/api/update', {
        method: 'POST',
        headers: { 'x-admin-password': pwd },
      });
      const d = await r.json().catch(() => ({}));

      if (r.ok) {
        sessionStorage.setItem('adminPwd', pwd);
        setUpdateStatus('✅ Déploiement lancé. Les apps se mettent à jour dans ~1 min.');
      } else {
        sessionStorage.removeItem('adminPwd');
        setUpdateStatus('❌ ' + (d.error || 'Erreur'));
      }
    } catch (err) {
      setUpdateStatus('❌ Erreur réseau');
    }
  };

  const goLive = async () => {
    try {
      setMsg('Connexion au direct…');
      const r = await fetch('/api/live/token', { method: 'POST', headers: { 'x-admin-password': pw }, body: JSON.stringify({ admin: true }) });
      if (!r.ok) throw new Error(r.status === 500 ? 'LiveKit non configuré (variables Vercel)' : 'Mot de passe incorrect');
      const { token, url } = await r.json();
      const rm = new Room();
      rm.on(RoomEvent.TrackSubscribed, (t) => {
        if (t.kind === 'audio') { const el = t.attach(); el.dataset.guest = '1'; document.body.appendChild(el); }
      });
      rm.on(RoomEvent.TrackUnsubscribed, (t) => t.detach().forEach((el) => el.remove()));
      await rm.connect(url, token);
      await rm.localParticipant.setMicrophoneEnabled(true);
      room.current = rm;
      await save({ ...sr.current, live: true });
      setLive(true);
      setMsg('🔴 Tu es en direct ! Les auditeurs te rejoignent en quelques secondes.');
    } catch (err) { setMsg('❌ ' + err.message); }
  };

  const stopLive = async () => {
    if (room.current) { await room.current.disconnect(); room.current = null; }
    await save({ ...sr.current, live: false });
    setLive(false);
    setMsg('Direct terminé.');
  };

  const up = async (f) =>
    (await upload('radio/' + f.name, f, {
      access: 'public', handleUploadUrl: '/api/upload', clientPayload: pw, contentType: f.type,
    })).url;

  const addFiles = async (e, key) => {
    const input = e.target, files = [...input.files];
    const items = [...sr.current[key]];
    try {
      for (const f of files) {
        setMsg('Envoi de ' + f.name + '…');
        const item = { id: crypto.randomUUID(), type: 'file', title: f.name.replace(/\.[^.]+$/, ''), url: await up(f) };

        if (key === 'tracks') {
          try {
            setMsg('Extraction de la pochette de ' + f.name + '…');
            const metadata = await parseBlob(f);

            if (metadata.common.picture && metadata.common.picture.length > 0) {
              const picture = metadata.common.picture[0];
              const blob = new Blob([picture.data], { type: picture.format });
              const coverFile = new File([blob], `cover-${item.id}.jpg`, { type: picture.format });
              setMsg('Envoi de la pochette de ' + f.name + '…');
              item.image = await up(coverFile);
            }
          } catch (err) {
            console.warn('Pochette non trouvée ou erreur pour ' + f.name + ':', err);
          }
        }

        if (key !== 'affiches') {
          item.duration = await dur(URL.createObjectURL(f));
          if (!item.duration) throw new Error(f.name + ' : durée illisible');
        }
        items.push(item);
      }
      await save({ ...sr.current, [key]: items });
      setMsg('✅ Terminé');
    } catch (err) { setMsg('❌ ' + err.message); }
    input.value = '';
  };

  const updateCover = async (trackId, file) => {
    try {
      setMsg('Envoi de la nouvelle pochette…');
      const imageUrl = await up(file);
      const n = { ...sr.current };
      const track = n.tracks.find(t => t.id === trackId);
      if (track) {
        track.image = imageUrl;
        await save(n);
        setMsg('✅ Pochette mise à jour');
      }
    } catch (err) {
      setMsg('❌ Erreur lors de l\'envoi de la pochette: ' + err.message);
    }
  };

  const fix = async () => {
    setMsg('Mesure des durées…');
    const n = { ...sr.current };
    for (const k of ['tracks', 'ads'])
      n[k] = await Promise.all(n[k].map(async (x) => (x.type !== 'spotify' && !x.duration ? { ...x, duration: await dur(x.url) } : x)));
    await save(n);
    setMsg('✅ Durées mesurées');
  };

  const setSpotify = async () => {
    const m = link.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album)\/([A-Za-z0-9]+)/);
    if (!m) return setMsg('❌ Lien de playlist ou d’album Spotify invalide');
    let title = m[1] === 'playlist' ? 'Playlist Spotify' : 'Album Spotify';
    try {
      const d = await (await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/' + m[1] + '/' + m[2]))).json();
      if (d.title) title = d.title;
    } catch {}
    await save({ ...sr.current, spotify: { kind: m[1], id: m[2], title } });
    setLink('');
    setMsg('✅ Playlist Spotify définie');
  };

  const addAnnonce = async () => {
    if (!at.trim()) return setMsg('❌ Mets au moins un titre');
    await save({ ...sr.current, annonces: [...sr.current.annonces, { id: crypto.randomUUID(), title: at.trim(), text: ax.trim() }] });
    setAt(''); setAx(''); setMsg('✅ Annonce ajoutée');
  };

  const del = (key, id) => save({ ...sr.current, [key]: sr.current[key].filter((x) => x.id !== id) });

  const toggleRec = async () => {
    if (rec) return mr.current.stop();
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    const m = new MediaRecorder(st), chunks = [];
    m.ondataavailable = (e) => chunks.push(e.data);
    m.onstop = async () => {
      st.getTracks().forEach((t) => t.stop());
      setRec(false);
      const duration = (Date.now() - t0.current) / 1000;
      const type = (m.mimeType || 'audio/webm').split(';')[0];
      const f = new File([new Blob(chunks, { type })], 'voix-' + Date.now() + (type.includes('mp4') ? '.m4a' : '.webm'), { type });
      try {
        setMsg('Envoi du message…');
        const url = await up(f);
        await save({ ...sr.current, voices: [...sr.current.voices, { id: crypto.randomUUID(), type: 'file', title: 'Message ' + new Date().toLocaleTimeString('fr-FR'), url, duration }] });
        setMsg('✅ Message diffusé dans quelques secondes');
      } catch (err) { setMsg('❌ ' + err.message); }
    };
    m.start(); t0.current = Date.now(); mr.current = m; setRec(true);
  };

  const lab = (k, x) =>
    k === 'annonces' ? '📢 ' + x.title + (x.text ? ' — ' + x.text : '') :
    k === 'affiches' ? '🖼️ ' + x.title :
    x.type === 'spotify' ? '🟢 ' + x.title + ' (ignoré en direct)' :
    '🎵 ' + x.title + ' · ' + fmt(x.duration);

  const List = ({ k }) => (
    <ul>{s[k].map((x) => (
      <li key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {x.image && <img src={x.image} alt="cover" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: '#333' }} />}
          {lab(k, x)}
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {k === 'tracks' && (
            <>
              <input 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                id={`cover-${x.id}`}
                onChange={async (e) => {
                  if (e.target.files && e.target.files[0]) {
                    await updateCover(x.id, e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
              <button 
                onClick={() => document.getElementById(`cover-${x.id}`).click()} 
                style={{ padding: '4px 10px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 'inherit' }}
              >
                🖼️ Cover
              </button>
            </>
          )}
          <button className="d" onClick={() => del(k, x.id)}>✕</button>
        </span>
      </li>
    ))}</ul>
  );

  const missing = [...s.tracks, ...s.ads].some((x) => x.type !== 'spotify' && !x.duration);

  if (!ok) return (
    <main className="admin">
      <h1>🔒 Admin</h1>
      <input type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />{' '}
      <button onClick={login}>Connexion</button>
      <p>{msg}</p>
    </main>
  );

  return (
    <main className="admin">
      <h1>🎛️ Panel admin</h1>
      <p>{msg}</p>
      {missing && (
        <p>⚠️ Certains anciens titres n'ont pas de durée et ne passent pas en direct.{' '}
          <button onClick={fix}>🔧 Mesurer les durées</button></p>
      )}

      <div className="card">
        <h2>🔄 Mise à jour</h2>
        <button type="button" onClick={updateApp}>🔄 Mettre à jour</button>
        <span style={{ marginLeft: 10 }}>{updateStatus}</span>
      </div>

      <AdminDedicaces pw={pw} />

      <div className="card">
        <h2>🔴 Direct (appel en temps réel)</h2>
        <p>Parle dans ton micro : les auditeurs t'entendent en direct et la musique baisse. Utilise un casque pour éviter l'écho.</p>
        <button className={live ? 'rec' : ''} onClick={live ? stopLive : goLive}>
          {live ? '⏹ Arrêter le direct' : '🔴 Passer en direct'}
        </button>
      </div>

      <AdminInvites pw={pw} />

      <div className="card">
        <h2>🎵 Musiques</h2>
        <input type="file" accept="audio/*" multiple onChange={(e) => addFiles(e, 'tracks')} />
        <List k="tracks" />
      </div>

      <div className="card">
        <h2>🟢 Playlist Spotify</h2>
        {s.spotify && (
          <p>Actuelle : {s.spotify.title}{' '}
            <button className="d" onClick={() => save({ ...sr.current, spotify: null })}>✕</button></p>
        )}
        <p><input style={{ width: '65%' }} placeholder="Lien d'une playlist (ou d'un album) Spotify" value={link} onChange={(e) => setLink(e.target.value)} />{' '}
          <button onClick={setSpotify}>Définir</button></p>
      </div>

      <div className="card">
        <h2>📢 Pubs</h2>
        <input type="file" accept="audio/*" multiple onChange={(e) => addFiles(e, 'ads')} />
        <p>Une pub toutes les{' '}
          <input type="number" min="0" style={{ width: 70 }} value={s.adEvery}
            onChange={(e) => save({ ...sr.current, adEvery: +e.target.value })} /> musiques (0 = aucune)</p>
        <List k="ads" />
      </div>

      <div className="card">
        <h2>🎙️ Message enregistré</h2>
        <button className={rec ? 'rec' : ''} onClick={toggleRec}>{rec ? '⏹ Arrêter et diffuser' : '⏺ Enregistrer un message'}</button>
        <List k="voices" />
      </div>

      <div className="card">
        <h2>📰 Annonces</h2>
        <p><input style={{ width: '100%' }} placeholder="Titre" value={at} onChange={(e) => setAt(e.target.value)} /></p>
        <p><input style={{ width: '100%' }} placeholder="Texte (facultatif)" value={ax} onChange={(e) => setAx(e.target.value)} /></p>
        <button onClick={addAnnonce}>Ajouter l'annonce</button>
        <List k="annonces" />
      </div>

      <div className="card">
        <h2>🖼️ Affiches</h2>
        <input type="file" accept="image/*" multiple onChange={(e) => addFiles(e, 'affiches')} />
        <List k="affiches" />
      </div>
    </main>
  );
}
