import { getState, saveState } from '../../../lib/store';

export const dynamic = 'force-dynamic';

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

const generatePayUrl = (prenom, nom) => {
  const handle = process.env.REVOLUT_HANDLE || 'djordanthovafonso';
  const note = encodeURIComponent((prenom + ' ' + nom).trim().replace(/\s+/g, ' '));
  return `https://revolut.me/${handle}?currency=EUR&amount=99&note=${note}`;
};

export async function GET(req) {
  const state = await getState();
  const { searchParams } = new URL(req.url);
  const adminMode = searchParams.get('admin') === '1';
  const items = state.dedicaces || [];

  if (adminMode) return Response.json({ items });
  return Response.json({ items: items.filter((item) => item.status === 'approved') });
}

export async function POST(req) {
  const state = await getState();
  const body = await req.json().catch(() => ({}));

  const prenom = clean(body.prenom);
  const nom = clean(body.nom);
  const email = clean(body.email);
  const pour = clean(body.pour);
  const message = clean(body.message);
  const type = body.type === 'direct' ? 'direct' : 'texte';

  if (!prenom || !nom || !email || !pour || !message) {
    return Response.json({ error: 'Tous les champs sont obligatoires.' }, { status: 400 });
  }

  const item = {
    id: crypto.randomUUID(),
    type,
    prenom,
    nom,
    email,
    pour,
    message,
    de: prenom,
    createdAt: Date.now(),
    status: 'pending',
    payUrl: generatePayUrl(prenom, nom),
  };

  const dedicaces = [item, ...(state.dedicaces || [])].slice(0, 200);
  await saveState({ ...state, dedicaces });

  return Response.json({ ok: true, item, payUrl: item.payUrl });
}

export async function PATCH(req) {
  const state = await getState();
  const body = await req.json().catch(() => ({}));
  const id = body.id;
  const status = body.status;

  if (!id || !['pending', 'approved', 'rejected'].includes(status)) {
    return Response.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }

  const dedicaces = (state.dedicaces || []).map((item) => item.id === id ? { ...item, status } : item);
  await saveState({ ...state, dedicaces });

  return Response.json({ ok: true, items: dedicaces });
}

export async function DELETE(req) {
  const state = await getState();
  const body = await req.json().catch(() => ({}));
  const id = body.id;

  if (!id) {
    return Response.json({ error: 'ID manquant.' }, { status: 400 });
  }

  const dedicaces = (state.dedicaces || []).filter((item) => item.id !== id);
  await saveState({ ...state, dedicaces });

  return Response.json({ ok: true, items: dedicaces });
}
