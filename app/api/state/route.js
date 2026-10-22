import { getState, saveState, isAdmin } from '../../../lib/store';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ ...(await getState()), now: Date.now() });
}

export async function POST(req) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  const s = await req.json();
  const now = Date.now();
  delete s.now;
  s.voices = (s.voices || [])
    .map((v) => (v.startAt ? v : { ...v, startAt: now + 4000 }))
    .filter((v) => v.startAt > now - 600000);
  await saveState(s);
  return Response.json({ ok: true, state: s });
}
