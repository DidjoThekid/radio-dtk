import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

// Les invitations sont signées : pas besoin de les stocker, et impossibles à fabriquer sans les clés du serveur
const secret = () => 'invite:' + (process.env.LIVEKIT_API_SECRET || '') + (process.env.ADMIN_PASSWORD || '');
const sign = (p) => createHmac('sha256', secret()).update(p).digest('base64url');

export function makeInvite(minutes = 60) {
  const exp = Date.now() + minutes * 60000;
  const p = exp.toString(36) + '.' + randomBytes(4).toString('hex');
  return p + '.' + sign(p);
}

export function checkInvite(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  const a = Buffer.from(sign(parts[0] + '.' + parts[1]));
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return parseInt(parts[0], 36) > Date.now();
}
