import { AccessToken } from 'livekit-server-sdk';
import { isAdmin, getState } from '../../../../lib/store';
import { checkInvite } from '../../../../lib/invite';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!key || !secret || !url) return Response.json({ error: 'LiveKit non configuré' }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const admin = !!body.admin;
  const guest = !admin && !!body.invite;

  if (admin && !isAdmin(req)) return new Response('Unauthorized', { status: 401 });

  if (guest) {
    if (!checkInvite(body.invite)) return Response.json({ error: 'Invitation invalide ou expirée.' }, { status: 403 });
    const s = await getState();
    if (!s.live) return Response.json({ error: "Le direct n'a pas encore commencé." }, { status: 409 });
  }

  const at = new AccessToken(key, secret, {
    identity: (admin ? 'animateur' : guest ? 'invite-' + crypto.randomUUID() : 'auditeur-' + crypto.randomUUID()),
    name: guest ? String(body.name || 'Invité').slice(0, 40) : undefined,
    ttl: guest ? '2h' : '4h',
  });
  // L'admin et les invités peuvent parler ; les auditeurs ne font qu'écouter
  at.addGrant({ room: 'radio', roomJoin: true, canPublish: admin || guest, canSubscribe: true });
  return Response.json({ token: await at.toJwt(), url });
}
