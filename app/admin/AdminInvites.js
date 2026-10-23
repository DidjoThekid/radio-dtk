'use client';
import { useEffect, useState } from 'react';

export default function AdminInvites({ pw }) {
  const [link, setLink] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [guests, setGuests] = useState([]);
  const [msg, setMsg] = useState('');
  const H = { 'x-admin-password': pw, 'Content-Type': 'application/json' };

  const loadGuests = async () => {
    try {
      const r = await fetch('/api/live/guests', { headers: H, cache: 'no-store' });
      if (r.ok) setGuests((await r.json()).guests || []);
    } catch {}
  };

  useEffect(() => {
    loadGuests();
    const t = setInterval(loadGuests, 5000);
    return () => clearInterval(t);
  }, []);

  const create = async () => {
    const r = await fetch('/api/live/invite', { method: 'POST', headers: H, body: JSON.stringify({ minutes }) });
    if (!r.ok) return setMsg('❌ Impossible de créer le lien');
    const j = await r.json();
    setLink(window.location.origin + '/parler?i=' + j.invite);
    setMsg('✅ Lien valable ' + j.minutes + ' minutes');
  };

  const copy = () => navigator.clipboard.writeText(link).then(() => setMsg('📋 Lien copié'));

  const cut = async (id) => {
    const r = await fetch('/api/live/guests', { method: 'POST', headers: H, body: JSON.stringify({ id }) });
    if (r.ok) setGuests((await r.json()).guests || []);
  };

  return (
    <div className="card">
      <h2>👥 Inviter quelqu'un à parler</h2>
      <p><small>Tu dois être en direct (bouton 🔴 ci-dessus) pour que l'invité puisse rejoindre. Envoie le lien uniquement à la personne invitée.</small></p>
      <p>Valable{' '}
        <input type="number" min="5" max="720" style={{ width: 80 }} value={minutes} onChange={(e) => setMinutes(+e.target.value)} /> minutes{' '}
        <button onClick={create}>Créer un lien</button>
      </p>
      {link && (
        <p>
          <input readOnly style={{ width: '100%' }} value={link} onFocus={(e) => e.target.select()} />
          <br /><button onClick={copy} style={{ marginTop: 8 }}>📋 Copier le lien</button>
        </p>
      )}
      {msg && <p>{msg}</p>}
      <h3 style={{ marginBottom: 4 }}>Invités connectés ({guests.length})</h3>
      <ul>
        {guests.map((g) => (
          <li key={g.id}>
            <span>🎙️ {g.name}</span>
            <button className="d" onClick={() => cut(g.id)}>Couper</button>
          </li>
        ))}
      </ul>
      {guests.length > 1 && <button className="d" onClick={() => cut(null)}>Couper tout le monde</button>}
    </div>
  );
}
