import { put, list } from '@vercel/blob';

const KEY = 'radio/state.json';
const DEFAULT = { tracks: [], ads: [], voices: [], annonces: [], affiches: [], adEvery: 3 };

export async function getState() {
  const { blobs } = await list({ prefix: KEY });
  if (!blobs.length) return DEFAULT;
  const r = await fetch(blobs[0].url + '?t=' + Date.now(), { cache: 'no-store' });
  return r.ok ? await r.json() : DEFAULT;
}

export async function saveState(s) {
  await put(KEY, JSON.stringify(s), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60,
  });
}

export const isAdmin = (req) =>
  !!process.env.ADMIN_PASSWORD && req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
