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
  const [guestName, setGuestName] = useState('Invité');

  useEffect(() => {
    const token = speaker && speaker !== '0' ? `?token=${encodeURIComponent(speaker)}` : '';
    fetch(`/api/speaker${token}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(async (data) => {
        setStatus(data.status || 'inactive');
        setGuestName(data.guestName || 'Invité');
      })
      .catch(() => setStatus('inactive'));
  }, [room, speaker]);

  const joinSpeaker = async () => {
    if (!speaker || speaker === '0') return;

    const r = await fetch('/api/live/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, speaker: true, token: speaker, name: guestName || 'Invité' }),
    });

    const data = await r.json();
    if (!r.ok || !data.token) {
      setStatus('inactive');
      return;
    }

    const liveRoom = new Room();
    await liveRoom.connect(data.url, data.token);
    liveRoom.localParticipant.setName(guestName || 'Invité');
    await liveRoom.localParticipant.setMicrophoneEnabled(true);
    window.location.href = `/?room=${encodeURIComponent(room)}&speaker=${encodeURIComponent(speaker)}`;
  };

  if (status === 'active') {
    return (
      <main style={{ padding: 32, fontFamily: 'sans-serif', color: '#fff', background: '#111827', minHeight: '100vh' }}>
        <h1>🎙️ Invitation active</h1>
        <p>Tu peux rejoindre le live.</p>
        <button
          onClick={joinSpeaker}
          style={{ color: '#111827', background: '#ffb3dc', border: 'none', borderRadius: 999, padding: '16px 28px', fontWeight: 800, fontSize: 20, cursor: 'pointer' }}
        >
          Rejoindre le live
        </button>
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
