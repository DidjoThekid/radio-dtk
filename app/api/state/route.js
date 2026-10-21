import { getState, saveState, isAdmin } from '../../../lib/store';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getState());
}

export async function POST(req) {
  if (!isAdmin(req)) return new Response('Unauthorized', { status: 401 });
  await saveState(await req.json());
  return Response.json({ ok: true });
}
