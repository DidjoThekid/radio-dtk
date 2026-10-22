'use client';
import { useRef, useState, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import { Room } from 'livekit-client';

const EMPTY = {
  tracks: [],
  ads: [],
  voices: [],
  annonces: [],
  affiches: [],
  adEvery: 3,
  spotify: null,
  live: false,
  dedicaces: [],
  speakerInvite: { status: 'inactive', url: '', token: '', room: 'radio', guestName: 'Invité' },
  speakerInvites: [],
};

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
  const [live, setLive] = useState(false);
  const [guestName, setGuestName] = useState('');
  const sr = useRef(s); sr.current = s;
  const mr = useRef(), t0 = useRef(0), room = useRef(null);

  const loadDedicaces = async () => {
    const r = await fetch('/api/dedicace', { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    const items = Array.isArray(data.items) ? data.items : [];
    setS((prev) => ({ ...prev, dedicaces: items }));
    sr.current = { ...sr.current, dedicaces: items };
  };

  const updateDedicateState = async (id, status) => {
    const r = await fetch('/api/dedicace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!r.ok) {
      setMsg('❌ Impossible de mettre à jour la dédicace');
      return;
    }
    await loadDedicaces();
    setMsg(status === 'approved' ? '✅ Dédicace validée' : status === 'rejected' ? '❌ Dédicace refusée' : '⏳ Dédicace remise en attente');
  };

  const deleteDedicate = async (id) => {
    const r = await fetch('/api/dedicace', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!r.ok) {
      setMsg('❌ Impossible de supprimer la dédicace');
      return;
    }
    await loadDedicaces();
    setMsg('🗑️ Dédicace supprimée');
  };

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
    if (!Array.isArray(cur.speakerInvites)) cur.speakerInvites = [];
    if (await save(cur)) { setOk(true); setMsg(''); await loadDedicaces(); }
  };

  const goLive = async () => {
    try {
      setMsg('Connexion au direct…');
      const r = await fetch('/api/live/token', { method: 'POST', headers: { 'x-admin-password': pw }, body: JSON.stringify({ admin: true, room: 'radio', name: 'Animateur' }) });
      if (!r.ok) throw new Error(r.status === 500 ? 'LiveKit non configuré (variables Vercel)' : 'Mot de passe incorrect');
      const { token, url } = await r.json();
      const rm = new Room();
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

  const getSpeakerInvites = () => Array.isArray(sr.current.speakerInvites) ? sr.current.speakerInvites : [];

  const createSpeakerInvite = async () => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const token = crypto.randomUUID();
    const inviteUrl = `${base}/invite?room=radio&speaker=${encodeURIComponent(token)}`;
    const invite = {
      id: token,
      token,
      room: 'radio',
      status: 'inactive',
      url: inviteUrl,
      guestName: (guestName || '').trim() || 'Invité',
      createdAt: Date.now(),
    };

    const invites = [...getSpeakerInvites(), invite];
    await save({ ...sr.current, speakerInvites: invites, speakerInvite: invite });
    setGuestName('');
    setMsg('✅ Lien d’invitation généré pour ' + invite.guestName + '.');
  };

  const setSpeakerStatus = async (token, status) => {
    const target = getSpeakerInvites().find((x) => x.token === token);
    if (!target) return;

    if (status === 'active') {
      const r = await fetch('/api/live/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: 'radio', speaker: true, token, name: target.guestName || 'Invité' }),
      });
      const data = await r.json();
      if (!r.ok || !data.token) {
        setMsg('❌ Impossible d’activer le speaker LiveKit');
        return;
      }
      target.liveToken = data.token;
      target.liveUrl = data.url;
    }

    const next = getSpeakerInvites().map((x) => x.token === token ? { ...x, status } : x);
    await save({ ...sr.current, speakerInvites: next, speakerInvite: next.find((x) => x.token === token) || next[0] || { status: 'inactive', url: '', token: '', room: 'radio', guestName: 'Invité' } });
    setMsg(status === 'active'
      ? '✅ Le mode invite est actif et l’intervenant peut parler.'
      : status === 'paused'
        ? '⏸ Le mode invite est en pause.'
        : '⚪ Le mode invite est inactif.');
  };

  const deleteSpeakerInvite = async (token) => {
    const next = getSpeakerInvites().filter((x) => x.token !== token);
    await save({ ...sr.current, speakerInvites: next, speakerInvite: next[0] || { status: 'inactive', url: '', token: '', room: 'radio', guestName: 'Invité' } });
    setMsg('✅ Lien supprimé.');
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
        <h2>📩 Dédicaces</h2>
        {(!s.dedicaces || s.dedicaces.length === 0) ? (
          <p>Aucune dédicace pour le moment.</p>
        ) : (
          <ul>
            {s.dedicaces.map((item) => (
              <li key={item.id} style={{ marginBottom: 12 }}>
                <div><strong>{item.prenom} {item.nom}</strong> · {item.pour}</div>
                <div>{item.message}</div>
                <div style={{ color: '#aaa', fontSize: 12 }}>{item.type} · {item.status || 'pending'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button onClick={() => updateDedicateState(item.id, 'approved')}>✅ Valider</button>
                  <button onClick={() => updateDedicateState(item.id, 'rejected')}>❌ Refuser</button>
                  <button className="d" onClick={() => deleteDedicate(item.id)}>🗑 Supprimer</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>🧑‍🎤 Inviter à parler</h2>
        <p>Génère plusieurs URLs de participation, que tu peux garder inactive, mettre en pause, activer ou supprimer.</p>
        <p>
          <input
            style={{ width: '100%' }}
            placeholder="Nom de la personne invitée"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />
        </p>
        <button onClick={createSpeakerInvite}>🔗 Générer un lien d’invitation</button>

        {getSpeakerInvites().length > 0 && (
          <div style={{ marginTop: 16 }}>
            {getSpeakerInvites().map((invite) => (
              <div key={invite.token} style={{ border: '1px solid #2b2b38', borderRadius: 10, padding: 12, marginTop: 10 }}>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>Nom :</strong> {invite.guestName || 'Invité'}
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  <strong>URL :</strong>{' '}
                  <a href={invite.url} target="_blank" rel="noreferrer">{invite.url}</a>
                </p>
                <p style={{ margin: '0 0 8px' }}><strong>Statut :</strong> {invite.status}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => setSpeakerStatus(invite.token, 'inactive')}>⚪ Inactif</button>
                  <button onClick={() => setSpeakerStatus(invite.token, 'paused')}>⏸ Pause</button>
                  <button onClick={() => setSpeakerStatus(invite.token, 'active')}>🟢 Actif</button>
                  <button className="d" onClick={() => deleteSpeakerInvite(invite.token)}>✕ Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>🔴 Direct (appel en temps réel)</h2>
        <p>Parle dans ton micro : les auditeurs t'entendent en direct et la musique baisse. Utilise un casque pour éviter l'écho.</p>
        <button className={live ? 'rec' : ''} onClick={live ? stopLive : goLive}>
          {live ? '⏹ Arrêter le direct' : '🔴 Passer en direct'}
        </button>
      </div>

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
