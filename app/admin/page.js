'use client';
import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

const EMPTY = { tracks: [], ads: [], voices: [], annonces: [], affiches: [], adEvery: 3, spotify: null };

// Mesure la durée d'un fichier audio (nécessaire pour la synchronisation)
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
  const [link, setLink] = useState('');
  const [at, setAt] = useState('');
  const [ax, setAx] = useState('');
  const [rec, setRec] = useState(false);
  const sr = useRef(s); sr.current = s;
  const mr = useRef(), t0 = useRef(0);

  const save = async (n) => {
    setS(n); sr.current = n;
    const r = await fetch('/api/state', { method: 'POST', headers: { 'x-admin-password': pw }, body: JSON.stringify(n) });
    if (!r.ok) { setMsg('❌ Mot de passe incorrect ou erreur serveur'); return false; }
    const j = await r.json();
    setS(j.state); sr.current = j.state;
    return true;
  };

  const login = async () => {
    const cur = { ...EMPTY, ...(await (await fetch('/api/state', { cache: 'no-store' })).json()) };
    if (await save(cur)) { setOk(true); setMsg(''); }
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
      <li key={x.id}>
        <span>{lab(k, x)}</span>
        <button className="d" onClick={() => del(k, x.id)}>✕</button>
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
        <h2>🎙️ Parler</h2>
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
