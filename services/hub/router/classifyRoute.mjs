// BUILD-002 WP2 — spine-level capture router (pure).
//
// The hub is channel-neutral: a capture is just text until we route it. This is the ONE place that
// decides which specialist lane a capture takes. Today: 'youtube' (a YouTube link → transcript
// knowledge route) or 'note' (the default governed-markdown capture). Pure + deterministic so it is
// unit-testable and so the routing writer and the live gateway agree on the route with no I/O.
import { classifyYouTube } from '../youtube/youtubeClassify.mjs';

// record: an operational-store record ({ text_preview, payload_text?, ... }). We classify on whatever
// captured text is present (live envelopes carry payload_text; the fixture store carries text_preview).
export function routeFor(record) {
  const text = (record && (record.payload_text ?? record.text_preview)) || '';
  const yt = classifyYouTube(text);
  if (yt.isYouTube) return { route: 'youtube', youtube: yt };
  return { route: 'note' };
}
