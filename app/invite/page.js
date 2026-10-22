'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

function InviteContent() {
  const params = useSearchParams();
  const room = params.get('room') || 'radio';
  const speaker = params.get('speaker') || params.get('token') || '0';
  const [status, setStatus] = useState('inactive');

  useEffect(() => {
    const token = speaker && speaker !== '0' ? `?token=${encodeURIComponent(speaker)}` : '';
    const url = `/api/speaker${token}`;
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => setStatus((data && data.status) || 'inactive'))
      .catch(() => setStatus('inactive'));
  }, [speaker]);

  const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  if (status === 'active') {
    return (
      <main style={{ padding: 32, fontFamily: 'sans-serif', color: '#fff', background: '#111827', minHeight: '100vh' }}>
        <h1>🎙️ Invitation active</h1>
        <p>Tu peux rejoindre le live.</p>
        <a href={`${base}/?room=${encodeURIComponent(room)}&speaker=${encodeURIComponent(speaker)}`} style={{ color: '#ff6bd6', fontWeight: 700 }}>
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

export default function InvitePage() {
  return (
    <Suspense fallback={
      <main style={{ padding: 32, fontFamily: 'sans-serif', color: '#fff', background: '#111827', minHeight: '100vh' }}>
        <h1>Chargement…</h1>
      </main>
    }>
      <InviteContent />
    </Suspense>
  );
}
