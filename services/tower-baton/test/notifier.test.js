import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMilestoneNotifier, scrubToken, MILESTONES } from '../src/telegramNotifier.js';
import { openState } from '../src/state.js';
import { tmpPath } from '../test-helpers/fakes.js';

// A fake OUTBOUND telegram client (records sendMessage; never a live call).
function fakeClient({ ready = true } = {}) {
  const sends = [];
  return { sends, get ready() { return ready; }, async sendMessage(recipient, text) { sends.push({ recipient, text }); return { ok: true, message_id: '1' }; } };
}

test('acceptance ding is produced by Tower\'s OWN notifier via a real event', async () => {
  const client = fakeClient();
  const state = openState({ statePath: tmpPath('.json') });
  const notifier = createMilestoneNotifier({ config: { authorisedTelegramUserId: '42' }, state, client });
  const r = await notifier.notifyMilestone({ purpose: 'watcher_online', body: 'ClickUp baton watcher online', checkpointId: 'startup', extra: 't1' });
  assert.equal(r.sent, true);
  assert.equal(client.sends.length, 1);
  assert.equal(client.sends[0].text, '[TOWER] ClickUp baton watcher online');
});

test('recovered startup ding text', async () => {
  const client = fakeClient();
  const notifier = createMilestoneNotifier({ config: { authorisedTelegramUserId: '42' }, state: openState({ statePath: tmpPath('.json') }), client });
  await notifier.notifyMilestone({ purpose: 'watcher_recovered', body: 'Watcher recovered and resumed from durable checkpoint state', checkpointId: 'startup', extra: 't2' });
  assert.equal(client.sends[0].text, '[TOWER] Watcher recovered and resumed from durable checkpoint state');
});

test('milestone dedup — the same milestone never double-notifies', async () => {
  const client = fakeClient();
  const state = openState({ statePath: tmpPath('.json') });
  const notifier = createMilestoneNotifier({ config: { authorisedTelegramUserId: '42' }, state, client });
  const a = await notifier.notifyMilestone({ purpose: 'review_posted', body: 'x', checkpointId: 'cp-1' });
  const b = await notifier.notifyMilestone({ purpose: 'review_posted', body: 'x', checkpointId: 'cp-1' });
  assert.equal(a.sent, true);
  assert.equal(b.deduped, true);
  assert.equal(client.sends.length, 1);
});

test('NO notification for internal file/test chatter — non-milestone purpose is dropped', async () => {
  const client = fakeClient();
  const notifier = createMilestoneNotifier({ config: { authorisedTelegramUserId: '42' }, state: openState({ statePath: tmpPath('.json') }), client });
  const r = await notifier.notifyMilestone({ purpose: 'file_written', body: 'internal chatter', checkpointId: 'cp-1' });
  assert.equal(r.sent, false);
  assert.equal(r.skipped, 'not-a-milestone');
  assert.equal(client.sends.length, 0);
  assert.equal(MILESTONES.includes('file_written'), false);
});

test('scrubToken masks the bot token in any text (canary)', () => {
  const token = '123456789:AA-canary-secret-value';
  const out = scrubToken(`failed for bot${token}/sendMessage`, token);
  assert.equal(out.includes('canary-secret-value'), false);
  assert.match(out, /masked/);
});
