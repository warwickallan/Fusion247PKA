// Fusion Tower — BUILD-010 WP0: ClickUp post-review WRITE-PATH controls.
//
// Proves the FOUR hard controls on the Tower's single bounded ClickUp write, all
// against a FAKE ClickUp client — NO live call, NO token, ever:
//   1. TARGET VALIDATION  — only task 869e5zu97 is writable; any other id refused
//                            (target substitution proven impossible).
//   2. ONE-WRITE GUARD     — at most one comment write per review (idempotent).
//   3. SELF-MARKER + SELF-LOOP PREVENTION — the posted body embeds TOWER_SELF_MARKER,
//                            and ingesting that same body as a ClickUp event does NOT
//                            advance/loop a run (recognised self_generated).
//   4. REDACTION           — a secret-shaped body is refused; nothing is posted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createClickupReviewPoster,
  assertAuthorisedTarget,
  assertNoSecret,
  scanForSecrets,
  ALLOWED_CLICKUP_TASK_ID,
} from '../src/adapters/clickupPoster.js';
import { TOWER_SELF_MARKER, normalizeClickupEvent } from '../src/adapters/eventIntake.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { loadConfig } from '../src/config.js';

// A fake ClickUp client that records every createTaskComment call — no network.
function fakeClickupClient() {
  const calls = [];
  return {
    calls,
    async createTaskComment(taskId, body) {
      calls.push({ taskId, body });
      return { id: `cmt_${calls.length}` };
    },
  };
}

const GOOD_BODY = [
  '# Fusion Tower — Codex re-review (round 2)',
  'Reviewed head 9fda8fd. Verdict: approve. Previous MEDIUM closed. New findings: 0.',
  TOWER_SELF_MARKER,
].join('\n');

// ── 1. TARGET VALIDATION ──────────────────────────────────────────────────────

test('target validation — the authorised target is exactly 869e5zu97', () => {
  assert.equal(ALLOWED_CLICKUP_TASK_ID, '869e5zu97');
  assert.doesNotThrow(() => assertAuthorisedTarget('869e5zu97'));
});

test('target validation — ANY other target id is REJECTED (substitution refused)', async () => {
  const client = fakeClickupClient();
  const poster = createClickupReviewPoster({ client });
  for (const bad of ['999zzz00', '869e5zu98', '', null, undefined, '  869e5zu97 ']) {
    await assert.rejects(
      () => poster.postReview({ taskId: bad, body: GOOD_BODY }),
      /TARGET REJECTED|not the authorised control task/,
      `target "${bad}" must be refused`,
    );
  }
  // Not a single write reached the client for any rejected target.
  assert.equal(client.calls.length, 0, 'no live comment call for a rejected target');
});

// ── 2. ONE-WRITE GUARD ────────────────────────────────────────────────────────

test('one-write guard — at most ONE comment write per review (idempotent)', async () => {
  const client = fakeClickupClient();
  const poster = createClickupReviewPoster({ client });

  const first = await poster.postReview({ taskId: '869e5zu97', body: GOOD_BODY });
  assert.equal(first.posted, true);
  assert.equal(first.commentId, 'cmt_1');

  // Re-post (retry / webhook redeliver / double tick) — guarded, NO second live call.
  const second = await poster.postReview({ taskId: '869e5zu97', body: GOOD_BODY });
  assert.equal(second.posted, false);
  assert.match(second.reason, /one-write guard/);
  assert.equal(second.commentId, 'cmt_1', 'returns the prior comment id, not a new one');

  assert.equal(client.calls.length, 1, 'exactly one live createTaskComment across two postReview calls');
});

// ── 3. SELF-MARKER + SELF-LOOP PREVENTION ────────────────────────────────────

test('self-marker — the posted body embeds TOWER_SELF_MARKER', async () => {
  const client = fakeClickupClient();
  const poster = createClickupReviewPoster({ client });
  await poster.postReview({ taskId: '869e5zu97', body: GOOD_BODY });
  assert.ok(client.calls[0].body.includes(TOWER_SELF_MARKER), 'posted body carries the self-marker');
});

test('self-marker — a body WITHOUT the marker is refused (would risk a self-loop)', async () => {
  const client = fakeClickupClient();
  const poster = createClickupReviewPoster({ client });
  await assert.rejects(
    () => poster.postReview({ taskId: '869e5zu97', body: 'no marker here' }),
    /missing the Tower self-marker/,
  );
  assert.equal(client.calls.length, 0);
});

test('self-loop prevention — ingesting the Tower\'s OWN posted comment does NOT advance a run', async () => {
  const client = fakeClickupClient();
  const poster = createClickupReviewPoster({ client });
  const posted = await poster.postReview({ taskId: '869e5zu97', body: GOOD_BODY });
  assert.equal(posted.posted, true);
  const selfBody = client.calls[0].body;

  const store = createMemoryStore();
  const config = loadConfig({});
  const dispatcher = createDispatcher({ store, config, adapters: {} });
  const run = await dispatcher.createRun({ title: 'x', scope: 'x', maxRounds: 2 });

  // The Tower's own comment redelivers as a ClickUp event (its text carries the marker).
  const selfEvent = normalizeClickupEvent({
    webhook_id: 'wh1', event_id: 'ev-self',
    task_id: '869e5zu97',
    event: 'taskCommentPosted',
    comment: { text: selfBody },
    task: { status: { status: 'in review' } },
  });
  assert.equal(selfEvent.selfGenerated, true, 'self-marker → event flagged self_generated');
  await dispatcher.ingestAndBind(selfEvent, { runId: run.run_id });

  // Self-generated events are NEVER claimed → the run does not advance off its own output.
  const claimedSelf = await dispatcher.consumeNextEvent(run.run_id);
  assert.equal(claimedSelf, null, 'the Tower\'s own comment must not advance the run');

  // Contrast: a genuine external (human) comment WITHOUT the marker IS claimable —
  // proving the filter is meaningful, not a blanket drop.
  const humanEvent = normalizeClickupEvent({
    webhook_id: 'wh1', event_id: 'ev-human',
    task_id: '869e5zu97',
    event: 'taskCommentPosted',
    comment: { text: 'Larry: looks good, please proceed.' },
    task: { status: { status: 'in review' } },
  });
  assert.equal(humanEvent.selfGenerated, false);
  await dispatcher.ingestAndBind(humanEvent, { runId: run.run_id });
  const claimedHuman = await dispatcher.consumeNextEvent(run.run_id);
  assert.ok(claimedHuman, 'a genuine external comment still advances the run');
  assert.equal(claimedHuman.payload.task_id, '869e5zu97');
});

// ── 4. REDACTION ──────────────────────────────────────────────────────────────

test('redaction — scanForSecrets flags secret-shaped strings by NAME only', () => {
  assert.equal(scanForSecrets('clean body ' + TOWER_SELF_MARKER).clean, true);
  assert.equal(scanForSecrets('token sk-ABCDEFGHIJKLMNOPQRSTUV').clean, false);
  assert.deepEqual(scanForSecrets('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345').hits, ['github-token']);
  assert.equal(scanForSecrets('pk_12345678_ABCDEFGHIJKLMNOPQRSTUVWX').clean, false); // ClickUp token shape
  assert.equal(scanForSecrets('postgres://user:hunter2@host:5432/db').clean, false); // DB url password
});

test('redaction — a body carrying a secret is REFUSED (nothing posted)', async () => {
  const client = fakeClickupClient();
  const poster = createClickupReviewPoster({ client });
  const leaky = GOOD_BODY + '\nDATABASE_URL=postgres://u:supersecretpw@db.example:5432/ftw';
  await assert.rejects(
    () => poster.postReview({ taskId: '869e5zu97', body: leaky }),
    /redaction guard|secret-shaped/,
  );
  assert.equal(client.calls.length, 0, 'a leaky body never reaches the client');
  // The masked comment body we actually compose is clean.
  assert.doesNotThrow(() => assertNoSecret(GOOD_BODY));
});
