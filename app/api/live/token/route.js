import { AccessToken } from 'livekit-server-sdk';
import { isAdmin, getState } from '../../../../lib/store';
import { checkInvite } from '../../../../lib/invite';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  
  if (!key || !secret || !url) {
    return Response.json({ error: 'LiveKit non configuré' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const admin = !!body.admin;
  
  // Supporte à la fois l'ancien système (body.invite) et le nouveau (body.speaker + body.token)
  const guest = !admin && (!!body.invite || (!!body.speaker && !!body.token));

  if (admin && !isAdmin(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (guest) {
    const state = await getState();
    
    // Vérification du nouveau système d'invitation (via le panel admin)
    if (body.speaker && body.token) {
      const invites = Array.isArray(state.speakerInvites) ? state.speakerInvites : (state.speakerInvite ? [state.speakerInvite] : []);
      const validInvite = invites.find((x) => x.token === body.token && x.status === 'active');
      
      if (!validInvite) {
        return Response.json({ error: 'Invitation invalide, expirée ou en pause.' }, { status: 403 });
      }
      if (!state.live) {
        return Response.json({ error: "Le direct n'a pas encore commencé." }, { status: 409 });
      }
    } 
    // Vérification de l'ancien système (HMAC)
    else if (body.invite) {
      if (!checkInvite(body.invite)) {
        return Response.json({ error: 'Invitation invalide ou expirée.' }, { status: 403 });
      }
      if (!state.live) {
        return Response.json({ error: "Le direct n'a pas encore commencé." }, { status: 409 });
      }
    }
  }

  const identity = admin 
    ? 'animateur' 
    : guest 
      ? 'invite-' + (body.token || crypto.randomUUID()).slice(0, 8) 
      : 'auditeur-' + crypto.randomUUID();

  const at = new AccessToken(key, secret, {
    identity,
    name: guest ? String(body.name || 'Invité').slice(0, 40) : undefined,
    ttl: guest ? '2h' : '4h',
  });

  // L'admin et les invités peuvent parler (canPublish: true) ; les auditeurs ne font qu'écouter
  at.addGrant({ 
    room: body.room || 'radio', 
    roomJoin: true, 
    canPublish: admin || guest, 
    canSubscribe: true 
  });

  return Response.json({ token: await at.toJwt(), url });
}
