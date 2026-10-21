'use client';
import { useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';

const EMPTY = { tracks: [], ads: [], voices: [], adEvery: 3 };

export default function Admin() {
  const [pw, setPw] = useState('');
  const [ok, setOk] = useState(false);
  const [s, setS] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const [rec, setRec] = useState(false);
  const sr = useRef(s); sr.current = s;
  const mr = useRef();

  const save = async (n) => {
    setS(n); sr.current = n;
    const r = await fetch('/api/state', { method: 'POST', headers: { 'x-admin-password': pw }, body: JSON.stringify(n) });
    if (!r.ok) setMsg('❌ Mot de passe incorrect ou erreur serveur');
    return r.ok;
  };

  const login = async () => {
    const cur = await (await fetch('/api/state', { cache: 'no-store' })).json();
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
        items.push({ id: crypto.randomUUID(), type: 'file', title: f.name.replace(/\.[^.]+$/, ''), url: await up(f) });
      }
      await save({ ...sr.current, [key]: items });
      setMsg('✅ Terminé');
    } catch (err) { setMsg('❌ ' + err.message); }
    input.value = '';
  };

  const addSpotify = async () => {
    const r = await fetch('/api/spotify?url=' + encodeURIComponent(link));
    const d = await r.json();
    if (!r.ok) return setMsg('❌ ' + d.error);
    await save({ ...sr.current, tracks: [...sr.current.tracks, { id: crypto.randomUUID(), type: 'spotify', spotifyId: d.id, title: d.title }] });
    setLink(''); setMsg('✅ Titre Spotify ajouté');
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
      const type = (m.mimeType || 'audio/webm').split(';')[0];
      const f = new File([new Blob(chunks, { type })], 'voix-' + Date.now() + (type.includes('mp4') ? '.m4a' : '.webm'), { type });
      try {
        setMsg('Envoi du message…');
        const url = await up(f);
        await save({ ...sr.current, voices: [...sr.current.voices, { id: crypto.randomUUID(), type: 'file', title: 'Message ' + new Date().toLocaleTimeString('fr-FR'), url }] });
        setMsg('✅ Message diffusé au prochain titre');
      } catch (err) { setMsg('❌ ' + err.message); }
    };
    m.start(); mr.current = m; setRec(true);
  };

  const List = ({ k }) => (
    <ul>{s[k].map((x) => (
      <li key={x.id}>
        <span>{x.type === 'spotify' ? '🟢 ' : '🎵 '}{x.title}</span>
        <button className="d" onClick={() => del(k, x.id)}>✕</button>
      </li>
    ))}</ul>
  );

  if (!ok) return (
    <main>
      <h1>🔒 Admin</h1>
      <input type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />{' '}
      <button onClick={login}>Connexion</button>
      <p>{msg}</p>
    </main>
  );

  return (
    <main>
      <h1>🎛️ Panel admin</h1>
      <p>{msg}</p>

      <div className="card">
        <h2>🎵 Musiques</h2>
        <input type="file" accept="audio/*" multiple onChange={(e) => addFiles(e, 'tracks')} />
        <p><input style={{ width: '65%' }} placeholder="Lien Spotify d'un titre" value={link} onChange={(e) => setLink(e.target.value)} />{' '}
          <button onClick={addSpotify}>Ajouter</button></p>
        <List k="tracks" />
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
    </main>
  );
}
