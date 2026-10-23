'use client';
import { useEffect, useState } from 'react';

export default function AdminDedicaces({ pw }) {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');
  const H = { 'x-admin-password': pw, 'Content-Type': 'application/json' };

  const load = async () => {
    try {
      const r = await fetch('/api/dedicace?admin=1', { headers: H, cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [pw]);

  const update = async (id, status) => {
    const r = await fetch('/api/dedicace', {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ id, status }),
    });

    if (!r.ok) {
      setMsg('❌ Impossible de mettre à jour la dédicace');
      return;
    }

    await load();
    setMsg(status === 'approved' ? '✅ Dédicace validée' : '❌ Dédicace refusée');
  };

  const remove = async (id) => {
    const r = await fetch('/api/dedicace', {
      method: 'DELETE',
      headers: H,
      body: JSON.stringify({ id }),
    });

    if (!r.ok) {
      setMsg('❌ Impossible de supprimer la dédicace');
      return;
    }

    await load();
    setMsg('🗑️ Dédicace supprimée');
  };

  return (
    <div className="card">
      <h2>📩 Dédicaces</h2>
      {msg && <p>{msg}</p>}
      {items.length === 0 ? (
        <p>Aucune dédicace pour le moment.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id} style={{ marginBottom: 12 }}>
              <div><strong>{item.prenom} {item.nom}</strong> · {item.pour}</div>
              <div>{item.message}</div>
              <div style={{ color: '#aaa', fontSize: 12 }}>{item.type} · {item.status || 'pending'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <button onClick={() => update(item.id, 'approved')}>✅ Valider</button>
                <button onClick={() => update(item.id, 'rejected')}>❌ Refuser</button>
                <button className="d" onClick={() => remove(item.id)}>🗑 Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
