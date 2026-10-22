import { getState, saveState } from '../../../lib/store';

export const dynamic = 'force-dynamic';

const emptyInvite = () => ({ status: 'inactive', url: '', token: '', room: 'radio' });

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const state = await getState();
  const invites = Array.isArray(state.speakerInvites) && state.speakerInvites.length
    ? state.speakerInvites
    : (state.speakerInvite ? [state.speakerInvite] : []);

  const item = token ? invites.find((x) => x.token === token) : invites.find((x) => x.status === 'active') || invites[0] || emptyInvite();
  return Response.json(item || emptyInvite());
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const state = await getState();
  const invites = Array.isArray(state.speakerInvites) ? [...state.speakerInvites] : [];
  const action = body.action || 'update';

  if (action === 'create') {
    const invite = {
      id: body.id || crypto.randomUUID(),
      token: body.token || crypto.randomUUID(),
      room: body.room || 'radio',
      status: body.status || 'inactive',
      url: body.url || '',
      createdAt: body.createdAt || Date.now(),
    };
    invites.push(invite);
    const next = { ...state, speakerInvites: invites, speakerInvite: invite };
    await saveState(next);
    return Response.json({ ok: true, invite, speakerInvites: invites });
  }

  if (action === 'delete') {
    const token = body.token;
    const nextInvites = invites.filter((x) => x.token !== token && x.id !== body.id);
    const nextState = {
      ...state,
      speakerInvites: nextInvites,
      speakerInvite: nextInvites[0] || emptyInvite(),
    };
    await saveState(nextState);
    return Response.json({ ok: true, speakerInvites: nextInvites });
  }

  const token = body.token || body.id;
  if (!token) {
    return Response.json({ ok: false, error: 'token manquant' }, { status: 400 });
  }

  const nextInvites = invites.map((inv) => inv.token === token || inv.id === token ? { ...inv, ...body, token: inv.token || token, room: inv.room || 'radio' } : inv);
  const nextState = {
    ...state,
    speakerInvites: nextInvites,
    speakerInvite: nextInvites.find((x) => x.token === token || x.id === token) || nextInvites[0] || emptyInvite(),
  };
  await saveState(nextState);
  return Response.json({ ok: true, speakerInvites: nextInvites });
}
