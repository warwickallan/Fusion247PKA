// BUILD-002 WP2 — deterministic YouTube source classification (the router's recognition step).
//
// Pure, no network: given arbitrary captured text/URL, decide whether it is a public YouTube source
// and extract the canonical 11-char video id. This is the "deterministic content recognition" tier of
// the routing order (bot/channel context → explicit command → THIS → bounded classifier → ask A/B/C).
// It never guesses: a string with no valid YouTube video id returns { isYouTube: false }.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// Host + path patterns that carry a YouTube video id.
function extractId(u) {
  let url;
  try { url = new URL(u); } catch { return null; }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const yt = host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com';
  const short = host === 'youtu.be';
  if (!yt && !short) return null;
  let id = null;
  if (short) {
    id = url.pathname.slice(1).split('/')[0];
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else {
    const m = url.pathname.match(/^\/(?:shorts|embed|v|live)\/([^/?#]+)/);
    if (m) id = m[1];
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

// Classify a captured payload. `text` may be a bare URL or free text containing one.
export function classifyYouTube(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { isYouTube: false };
  // Try the whole string as a URL, then any URL-looking token inside it.
  const candidates = [raw, ...(raw.match(/https?:\/\/[^\s<>"')]+/gi) || [])];
  for (const c of candidates) {
    const id = extractId(c);
    if (id) return { isYouTube: true, videoId: id, canonicalUrl: `https://www.youtube.com/watch?v=${id}`, source: 'youtube' };
  }
  return { isYouTube: false };
}
