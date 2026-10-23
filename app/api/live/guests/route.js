import { RoomServiceClient } from 'livekit-server-sdk';
import { isAdmin } from '../../../../lib/store';
export const dynamic = 'force-dynamic';

const svc = () =>
  new RoomServiceClient(
    (process.env.NEXT_PUBLIC_LIVEKIT_URL || '').replace(/^wss:/, 'https:'),
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  );

const guests = async () => {
  try {
    const list = await svc().listParticipants('radio');
    return list.filter((p) => p.identity.startsWith('invite-')).map((p) => ({ id: p.identity, name: p.name || 'Invité' }));
  } catch { return []; }
};

// Liste des invités connectés
export async function GET(req) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  return Response.json({ guests: await guests() });
}

// Couper un invité (avec { id }) ou tous les invités (sans id)
export async function POST(req) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  for (const g of await guests()) {
    if (!id || id === g.id) { try { await svc().removeParticipant('radio', g.id); } catch {} }
  }
  return Response.json({ guests: await guests() });
}
