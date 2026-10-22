'use client';
import { useEffect, useState } from 'react';

// Les infos du formulaire sont aussi envoyées par e-mail via FormSubmit.
// Change l'adresse ci-dessous si tu veux les recevoir ailleurs.
const FORMSUBMIT = 'https://formsubmit.co/ajax/team-dtk@outlook.com';

const FIELD = {
  font: 'inherit', padding: '10px 14px', borderRadius: 8, border: '1px solid #333',
  background: '#1c1c26', color: '#f2f2fa', width: '100%', marginBottom: 10,
};

export default function Dedicaces() {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ type: 'texte', prenom: '', nom: '', email: '', pour: '', message: '' });
  const [msg, setMsg] = useState('');
  const [pay, setPay] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = () =>
    fetch('/api/dedicace', { cache: 'no-store' }).then((r) => r.json()).then((j) => setItems(j.items || [])).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      // 1. Enregistrement dans le panel admin
      const r = await fetch('/api/dedicace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');

      // 2. Envoi par e-mail avec FormSubmit (sans bloquer si ça échoue)
      fetch(FORMSUBMIT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: 'Nouvelle dédicace (' + (f.type === 'direct' ? 'en direct' : 'écrite') + ') — ' + f.prenom + ' ' + f.nom,
          _template: 'table',
          _captcha: 'false',
          type: f.type === 'direct' ? 'En direct (lue à l\'antenne)' : 'Écrite (affichée sur le site)',
          prenom: f.prenom,
          nom: f.nom,
          email: f.email,
          pour: f.pour,
          message: f.message,
          paiement: '0,99 € via Revolut — note du paiement : ' + f.prenom + ' ' + f.nom,
        }),
      }).catch(() => {});

      setPay(j.payUrl);
    } catch (err) { setMsg('❌ ' + err.message); }
    setBusy(false);
  };

  return (
    <section id="dedicaces">
      <h2>💌 Dédicaces</h2>
      <p style={{ color: '#9a9ab8' }}>
        Une dédicace écrite sur le site ou lue en direct à l'antenne : 0,99 €.<br />
        ⏱️ Elle est ajoutée d'ici 48 h maximum, une fois ton paiement vérifié.
      </p>

      {pay ? (
        <div className="note">
          <b>✅ Dédicace enregistrée !</b>
          <p>Dernière étape : paie 0,99 € sur Revolut. Ton nom est déjà indiqué dans le message du paiement.</p>
          <p>⏱️ Ta dédicace sera ajoutée d'ici 48 h maximum, dès que ton paiement est vérifié.</p>
          <a className="btn" href={pay} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', textDecoration: 'none', color: '#fff' }}>💳 Payer 0,99 €</a>
        </div>
      ) : (
        <form onSubmit={send} className="note">
          <p style={{ margin: '0 0 10px' }}>
            <label style={{ marginRight: 16 }}>
              <input type="radio" name="type" checked={f.type === 'texte'} onChange={() => setF({ ...f, type: 'texte' })} /> 💬 Écrite (affichée sur le site)
            </label>
            <label>
              <input type="radio" name="type" checked={f.type === 'direct'} onChange={() => setF({ ...f, type: 'direct' })} /> 🎙️ En direct (lue à l'antenne)
            </label>
          </p>
          <input style={FIELD} placeholder="Ton prénom" value={f.prenom} onChange={set('prenom')} maxLength={40} required />
          <input style={FIELD} placeholder="Ton nom" value={f.nom} onChange={set('nom')} maxLength={40} required />
          <input style={FIELD} type="email" placeholder="Ton adresse e-mail" value={f.email} onChange={set('email')} maxLength={120} required />
          <input style={FIELD} placeholder="Pour qui ?" value={f.pour} onChange={set('pour')} maxLength={60} required />
          <textarea style={{ ...FIELD, minHeight: 90 }} placeholder="Ton message (280 caractères max)" value={f.message} onChange={set('message')} maxLength={280} required />
          <button className="btn" disabled={busy} type="submit">{busy ? 'Envoi…' : 'Continuer vers le paiement (0,99 €)'}</button>
          {msg && <p>{msg}</p>}
          <p><small style={{ color: '#9a9ab8' }}>
            Ton nom et ton e-mail servent uniquement à traiter ta dédicace (ils sont transmis par e-mail à l'équipe via FormSubmit)
            et ne sont jamais affichés. Seul ton prénom apparaît sur une dédicace écrite.
          </small></p>
        </form>
      )}

      {items.length > 0 && (
        <div className="news" style={{ marginTop: 16 }}>
          {items.map((x) => (
            <div className="note" key={x.id}>
              <b>Pour {x.pour}</b>
              <p>{x.message}</p>
              <small>— de la part de {x.de}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
