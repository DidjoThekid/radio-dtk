import { put, list } from '@vercel/blob';

const KEY = 'radio/state.json';
const DEFAULT = {
  tracks: [],
  ads: [],
  voices: [],
  annonces: [],
  affiches: [],
  adEvery: 3,
  spotify: null,
  live: false,
  dedicaces: [],
  speakerInvite: {
    status: 'inactive',
    url: '',
    token: '',
    room: 'radio',
  },
};

let cache = null;
let cachedUrl = null;

export async function getState() {
  if (cache && Date.now() - cache.t < 1500) return cache.s;
  let url = cachedUrl;
  if (!url) {
    const { blobs } = await list({ prefix: KEY });
    if (!blobs.length) return DEFAULT;
    url = cachedUrl = blobs[0].url;
  }
  const r = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
  const s = r.ok ? { ...DEFAULT, ...(await r.json()) } : DEFAULT;
  cache = { s, t: Date.now() };
  return s;
}

export async function saveState(s) {
  const b = await put(KEY, JSON.stringify(s), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  cachedUrl = b.url;
  cache = { s, t: Date.now() };
}

export const isAdmin = (req) =>
  !!process.env.ADMIN_PASSWORD && req.headers.get('x-admin-password') === process.env.ADMIN_PASSWORD;
