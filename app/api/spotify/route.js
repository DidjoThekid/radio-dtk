export async function GET(req) {
  const url = new URL(req.url).searchParams.get('url') || '';
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/);
  if (!m) return Response.json({ error: 'Lien de titre Spotify invalide' }, { status: 400 });
  const r = await fetch('https://open.spotify.com/oembed?url=' +
    encodeURIComponent('https://open.spotify.com/track/' + m[1]));
  const d = r.ok ? await r.json() : {};
  return Response.json({ id: m[1], title: d.title || 'Titre Spotify' });
}
