'use client';
import { useEffect, useState } from 'react';

const BASE = 'https://github.com/DidjoThekid/radio-dtk/releases/latest/download';

const LIENS = [
  { id: 'windows', label: '🪟 Windows', href: `${BASE}/Radio_DTK_Setup.exe` },
  { id: 'mac', label: '🍎 Mac (M1, M2, M3…)', href: `${BASE}/Radio_DTK_Mac.dmg` },
  { id: 'android', label: '🤖 Android', href: `${BASE}/Radio_DTK.apk` },
];

export default function DownloadApp() {
  const [os, setOs] = useState('');

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) setOs('android');
    else if (/iPhone|iPad|iPod/i.test(ua)) setOs('ios');
    else if (/Mac/i.test(ua)) setOs('mac');
    else if (/Windows/i.test(ua)) setOs('windows');
  }, []);

  const liste = [...LIENS].sort((a, b) => (b.id === os) - (a.id === os));

  return (
    <section style={{ textAlign: 'center', margin: '40px 0', padding: '0 16px' }}>
      <h2>📲 Télécharge l'app Radio DTK</h2>
      <p>Écoute la radio directement depuis ton appareil.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
        {liste.map((l) => (
          <a
            key={l.id}
            href={l.href}
            style={{
              padding: '14px 22px',
              borderRadius: 10,
              background: l.id === os ? '#e11d48' : '#333',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            {l.label}
          </a>
        ))}
      </div>
      {os === 'ios' && (
        <p style={{ marginTop: 14 }}>
          🍏 iPhone : ouvre ce site dans Safari, appuie sur Partager puis « Sur l'écran d'accueil ».
        </p>
      )}
    </section>
  );
}
