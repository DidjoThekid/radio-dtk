'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Room } from 'livekit-client';

export const dynamic = 'force-dynamic';

function InviteContent() {
  const params = useSearchParams();
  const room = params.get('room') || 'radio';
  const speaker = params.get('speaker') || params.get('token') || '0';
  const [status, setStatus] = useState('inactive');
  const [liveToken, setLiveToken] = useState('');

  useEffect(() => {
    const token = speaker && speaker !== '0' ? `?token=${encodeURIComponent(speaker)}` : '';
    fetch(`/api/speaker${token}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(async (data) => {
        setStatus(data.status || 'inactive');
        if ((data.status || 'inactive') === 'active') {
          const r2 = await fetch('/api/live/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room, speaker: true, token: speaker }),
          });
          const d2 = await r2.json();
          if (r2.ok && d2.token) setLiveToken(d2.token);
        }
      })
      .catch(() => setStatus('inactive'));
  }, [room, speaker]);

  useEffect(() => {
    if (!liveToken || !speaker || speaker === '0') return;
    const roomInstance = new Room();
    roomInstance.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880', liveToken)
      .then(() => roomInstance.localParticipant.setMicrophoneEnabled(true).catch(() => {}))
      .catch(() => {});

    return () => {
      roomInstance.disconnect();
    };
  }, [liveToken, speaker]);

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
