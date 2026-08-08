import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRemind, lastDingMs, run, REMINDER } from './idle-ding-check.mjs';

test('REMINDS when no ding has gone out since the last idle moment — the 2026-08-08 failure', () => {
  assert.equal(shouldRemind({ lastDing: 1000, lastStop: 5000 }), true);
});

test('STAYS QUIET when a ding went out after the last idle moment', () => {
  assert.equal(shouldRemind({ lastDing: 9000, lastStop: 5000 }), false);
});

test('MUTATION: a ding at exactly the last stop is NOT "since" it, so it still reminds', () => {
  // Strictly-greater, deliberately. An equal timestamp cannot prove the send came after.
  assert.equal(shouldRemind({ lastDing: 5000, lastStop: 5000 }), true);
});

test('a first-ever run with no state and no log reminds rather than assuming all is well', () => {
  assert.equal(shouldRemind({ lastDing: 0, lastStop: 0 }), true);
});

// ⚠️ THE FIXTURES BELOW ARE COPIED VERBATIM FROM ~/.mypka/governor/ding-log.jsonl.
//
// The first version of this test invented `{ok:true}` — a field `ding.mjs` has never written. The
// test passed against a hook that could NOT read the live log at all, and the hook then reported
// "no ding has ever been sent" while sitting on a log full of successful sends. It was caught only
// by running the real hook against the real file.
//
// A fixture must come from the PRODUCER, not from the consumer's assumption about the producer.
const REAL_LOG_LINES = [
  '{"ts":"2026-08-08T09:38:07.740Z","outcome":"sent","exit":0,"message_id":402,"bytes":1713}',
  '{"ts":"2026-08-08T10:53:53.153Z","outcome":"sent","exit":0,"message_id":403,"bytes":1563}',
];

test('lastDingMs reads the REAL record shape and returns the latest successful send', () => {
  assert.equal(lastDingMs(() => REAL_LOG_LINES.join('\n')), Date.parse('2026-08-08T10:53:53.153Z'));
});

test('MUTATION: the field is `outcome`, not `ok` — the assumed shape must yield nothing', () => {
  // This is the exact defect, pinned so it cannot return. If someone "simplifies" the guard back to
  // `rec.ok === true`, the line above fails and this one starts passing for the wrong reason.
  assert.equal(lastDingMs(() => '{"ok":true,"ts":"2026-08-08T10:00:00.000Z"}'), 0);
});

test('MUTATION: a failed send is NOT a notification Warwick received', () => {
  const log = [
    '{"ts":"2026-08-08T12:00:00.000Z","outcome":"failed","exit":1}',
    '{"ts":"2026-08-08T10:00:00.000Z","outcome":"sent","exit":0,"message_id":1}',
  ].join('\n');
  assert.equal(lastDingMs(() => log), Date.parse('2026-08-08T10:00:00.000Z'),
    'the later FAILED attempt must not count as the last notification');
});

test('lastDingMs survives a corrupt line, a missing file and an empty log', () => {
  assert.equal(
    lastDingMs(() => 'not json\n{"outcome":"sent","exit":0,"ts":"2026-08-08T10:00:00.000Z"}\n'),
    Date.parse('2026-08-08T10:00:00.000Z'));
  assert.equal(lastDingMs(() => { throw new Error('ENOENT'); }), 0);
  assert.equal(lastDingMs(() => ''), 0);
});

test('MUTATION: run() never throws, even when the state write fails', () => {
  assert.doesNotThrow(() => run({ now: 1, ding: 0, state: { lastStopMs: 0 }, write: false }));
});

test('the reminder points at the rule and does NOT restate its criteria', () => {
  // The criteria live in CLAUDE.md. A hook that copies them becomes a second, drifting home.
  assert.match(REMINDER, /CLAUDE\.md/);
  assert.match(REMINDER, /Rule 4a/);
  assert.doesNotMatch(REMINDER, /SAFE TO CLEAR|routine progress narration/,
    'copying the criteria here would create a duplicate that drifts from the canonical rule');
});
