import { AccessToken } from 'livekit-server-sdk';
import { isAdmin } from '../../../../lib/store';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!key || !secret || !url) return Response.json({ error: 'LiveKit non configuré' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const admin = !!body.admin;
  if (admin && !isAdmin(req)) return new Response('Unauthorized', { status: 401 });

  const at = new AccessToken(key, secret, {
    identity: admin ? 'animateur' : 'auditeur-' + crypto.randomUUID(),
    ttl: '4h',
  });
  // Seul l'admin peut parler ; les auditeurs ne font qu'écouter
  at.addGrant({ room: 'radio', roomJoin: true, canPublish: admin, canSubscribe: true });
  return Response.json({ token: await at.toJwt(), url });
}
