import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createClickupClient, createFakeClickup } from '../src/clickupClient.js';

test('clickup client — fail-closed when CLICKUP_TOKEN absent', async () => {
  const client = createClickupClient({ config: { clickupToken: null } });
  assert.equal(client.ready, false);
  await assert.rejects(() => client.getTaskComments('t'), /CLICKUP_TOKEN missing/);
  await assert.rejects(() => client.createTaskComment('t', 'body'), /CLICKUP_TOKEN missing/);
});

test('clickup client — token never appears in a transport error (redacted)', async () => {
  const token = 'pk_123_SECRETVALUE';
  const client = createClickupClient({
    config: { clickupToken: token, redact: (s) => String(s).split(token).join('***redacted***') },
    fetchImpl: async () => { throw new Error(`boom with ${token}`); },
  });
  await assert.rejects(() => client.getTaskComments('t'), (e) => { assert.equal(e.message.includes('SECRETVALUE'), false); return true; });
});

test('fake clickup — additive posts, oldest-first reads', async () => {
  const cu = createFakeClickup({ comments: [{ comment_text: 'first', date: '1' }] });
  await cu.createTaskComment('t', 'second');
  const comments = await cu.getTaskComments('t');
  assert.equal(comments.length, 2);
  assert.equal(comments[0].comment_text, 'first');
  assert.equal(comments[1].comment_text, 'second');
});

test('fake clickup — fail-closed when not ready', async () => {
  const cu = createFakeClickup({ ready: false });
  await assert.rejects(() => cu.getTaskComments('t'), /CLICKUP_TOKEN missing/);
});
