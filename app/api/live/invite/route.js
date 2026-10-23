import { makeInvite } from '../../../../lib/invite';
import { isAdmin } from '../../../../lib/store';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  const { minutes } = await req.json().catch(() => ({}));
  const m = Math.min(Math.max(parseInt(minutes) || 60, 5), 720);
  return Response.json({ invite: makeInvite(m), minutes: m });
}
