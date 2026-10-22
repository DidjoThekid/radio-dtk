import { getState, saveState } from '../../../lib/store';

export const dynamic = 'force-dynamic';

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

const generatePayUrl = (prenom, nom) => {
  const handle = process.env.REVOLUT_HANDLE || 'didjothedkid';
  const ref = encodeURIComponent((prenom + ' ' + nom).trim().replace(/\s+/g, ' '));
  return `https://revolut.me/${handle}?amount=0.99&comment=${ref}`;
};

export async function GET() {
  const state = await getState();
  return Response.json({ items: state.dedicaces || [] });
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
