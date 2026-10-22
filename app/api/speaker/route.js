import { getState, saveState } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await getState();
  return Response.json({ ...(state.speakerInvite || { status: 'inactive', url: '', token: '', room: 'radio' }) });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const state = await getState();

  const next = {
    ...(state.speakerInvite || { status: 'inactive', url: '', token: '', room: 'radio' }),
    ...body,
  };

  await saveState({ ...state, speakerInvite: next });
  return Response.json({ ok: true, speakerInvite: next });
}
