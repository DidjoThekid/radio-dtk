'use client';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';

export default function Parler() {
  const [invite, setInvite] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | connecting | live | ended
  const [muted, setMuted] = useState(false);
  const [msg, setMsg] = useState('');
  const room = useRef(null);

  useEffect(() => {
    setInvite(new URLSearchParams(window.location.search).get('i') || '');
    return () => { if (room.current) room.current.disconnect(); };
  }, []);

  const leave = (text) => {
    const r = room.current;
    room.current = null;
    document.querySelectorAll('audio[data-host]').forEach((el) => el.remove());
    if (r) r.disconnect();
    setStatus('ended');
    setMsg(text || 'Tu as quitté le direct.');
  };

  const join = async () => {
    setStatus('connecting');
    setMsg('');
    try {
      const r = await fetch('/api/live/token', { method: 'POST', body: JSON.stringify({ invite, name: name.trim() || 'Invité' }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Impossible de rejoindre le direct');
      const rm = new Room();
      // On entend l'animateur (et les autres invités)
      rm.on(RoomEvent.TrackSubscribed, (t) => {
        if (t.kind === 'audio') {
          const el = t.attach();
          el.dataset.host = '1';
          document.body.appendChild(el);
        }
      });
      rm.on(RoomEvent.TrackUnsubscribed, (t) => t.detach().forEach((el) => el.remove()));
      rm.on(RoomEvent.Disconnected, () => {
        if (room.current) { room.current = null; setStatus('ended'); setMsg('Tu as été déconnecté du direct.'); }
      });
      await rm.connect(j.url, j.token);
      rm.startAudio().catch(() => {});
      await rm.localParticipant.setMicrophoneEnabled(true);
      room.current = rm;
      setMuted(false);
      setStatus('live');
    } catch (e) {
      setStatus('idle');
      setMsg('❌ ' + e.message);
    }
  };

  const toggleMic = async () => {
    if (!room.current) return;
    const next = !muted;
    await room.current.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };

  // Si l'animateur arrête le direct, l'invité est déconnecté
  useEffect(() => {
    if (status !== 'live') return;
    const t = setInterval(async () => {
      try {
        const s = await (await fetch('/api/state', { cache: 'no-store' })).json();
        if (!s.live) leave('Le direct est terminé. Merci !');
      } catch {}
    }, 5000);
    return () => clearInterval(t);
  }, [status]);

  return (
    <div>
      <header>
        <div className="logo">📻 Ma Radio</div>
        <div className="live"><i></i>INVITÉ</div>
      </header>
      <main className="admin">
        <div className="hero">
          <h1>🎙️ Tu es invité à parler</h1>

          {!invite && <p>❌ Lien d'invitation manquant. Demande un nouveau lien à l'animateur.</p>}

          {invite && (status === 'idle' || status === 'connecting') && (
            <>
              <p>Mets un casque pour éviter l'écho, puis rejoins le direct.</p>
              <p>
                <input placeholder="Ton prénom" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </p>
              <button className="btn" onClick={join} disabled={status === 'connecting'}>
                {status === 'connecting' ? 'Connexion…' : '🎙️ Rejoindre et parler'}
              </button>
            </>
          )}

          {status === 'live' && (
            <>
              <div className="live" style={{ margin: '0 auto 14px', width: 'fit-content' }}><i></i>Tu es en direct</div>
              <p>Les auditeurs t'entendent. Tu entends l'animateur.</p>
              <p>
                <button className={muted ? 'rec' : ''} onClick={toggleMic}>{muted ? '🔇 Micro coupé (clique pour parler)' : '🎙️ Micro actif (clique pour couper)'}</button>
              </p>
              <button className="d" style={{ padding: '10px 18px' }} onClick={() => leave()}>Quitter le direct</button>
            </>
          )}

          {status === 'ended' && <p>{msg}</p>}
          {status === 'idle' && msg && <p>{msg}</p>}
        </div>
      </main>
    </div>
  );
}
