'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function InvitePage() {
  const params = useSearchParams();
  const room = params.get('room') || 'radio';
  const speaker = params.get('speaker') || '0';
  const [status, setStatus] = useState('inactive');

  useEffect(() => {
    fetch('/api/speaker', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setStatus(data.status || 'inactive'))
      .catch(() => setStatus('inactive'));
  }, []);

  if (status === 'active') {
    return (
      <main style={{ padding: 32, fontFamily: 'sans-serif', color: '#fff', background: '#111827', minHeight: '100vh' }}>
        <h1>🎙️ Invitation active</h1>
        <p>Tu peux rejoindre le live.</p>
        <a href={`https://radio-teamdtk.vercel.app/?room=${room}&speaker=${speaker}`} style={{ color: '#ff6bd6', fontWeight: 700 }}>
          Rejoindre le live
        </a>
      </main>
    );
  }

  if (status === 'paused') {
    return (
      <main style={{ padding: 32, fontFamily: 'sans-serif', color: '#fff', background: '#111827', minHeight: '100vh' }}>
        <h1>⏸️ En pause</h1>
        <p>L’intervenant a mis l’invitation en pause.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif', color: '#fff', background: '#111827', minHeight: '100vh' }}>
      <h1>⚪ Inactif</h1>
      <p>L’invitation n’est pas active pour le moment.</p>
    </main>
  );
}
