// BUILD-002 WP2 — YouTube classifier tests (node --test). Pure, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyYouTube } from './youtubeClassify.mjs';

const ID = 'dQw4w9WgXcQ';

test('recognises the common YouTube URL shapes → same canonical id', () => {
  for (const u of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `http://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abcd`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
  ]) {
    const r = classifyYouTube(u);
    assert.equal(r.isYouTube, true, `should classify: ${u}`);
    assert.equal(r.videoId, ID, `id from: ${u}`);
    assert.equal(r.canonicalUrl, `https://www.youtube.com/watch?v=${ID}`);
  }
});

test('extracts a URL embedded in free text (Telegram paste)', () => {
  const r = classifyYouTube(`check this out https://youtu.be/${ID} it's great`);
  assert.equal(r.isYouTube, true);
  assert.equal(r.videoId, ID);
});

test('never guesses — non-YouTube / malformed returns isYouTube:false', () => {
  for (const u of [
    '', '   ', 'just some notes', 'https://vimeo.com/12345',
    'https://www.youtube.com/watch?v=tooshort', 'https://www.youtube.com/feed/subscriptions',
    'https://example.com/watch?v=' + ID, 'not a url at all',
  ]) {
    assert.equal(classifyYouTube(u).isYouTube, false, `should NOT classify: ${JSON.stringify(u)}`);
  }
});
