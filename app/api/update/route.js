// Bouton « Mettre à jour » : redéploie le site depuis GitHub via un Deploy Hook Vercel.
// Toutes les apps (Windows, Mac, Android, iOS) chargent le site => elles se mettent à jour toutes seules.
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const pwd = req.headers.get('x-admin-password');
  if (!process.env.ADMIN_PASSWORD || pwd !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) {
    return Response.json({ error: 'VERCEL_DEPLOY_HOOK_URL manquant' }, { status: 500 });
  }
  const r = await fetch(hook, { method: 'POST' });
  if (!r.ok) return Response.json({ error: 'Le déploiement a échoué' }, { status: 502 });
  return Response.json({ ok: true });
}
