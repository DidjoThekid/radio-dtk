'use client';
import { useEffect, useState } from 'react';

export default function SpeakerPage() {
  const [invite, setInvite] = useState('');
  const [name, setName] = useState('');
  const [muted, setMuted] = useState(false);
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const loadInvite = async () => {
      const r = await fetch('/api/speaker?token=' + encodeURIComponent(window.location.search.split('token=')[1] || ''), { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        setInvite(d.url || '');
      }
    };
    loadInvite();
  }, []);

  const join = async () => {
    setStatus('connecting');
    setMsg('Connexion…');
  };

  const leave = async () => {
    setStatus('idle');
    setMsg('Tu as quitté le direct.');
  };

  const toggleMic = async () => {
    setMuted(!muted);
  };

  return (
    <div>
      <header>
        <div className="logo">
          <img src="https://raw.githubusercontent.com/DidjoThekid/radio-dtk/main/Logo%20radio%20DTK%20avec%20%C3%A9toile%20rouge.png" alt="Radio DTK" className="brand-logo brand-logo--small" />
        </div>
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
