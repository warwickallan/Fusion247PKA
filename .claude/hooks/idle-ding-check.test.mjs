import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

// ---------------------------------------------------------------------------
// The four properties Warwick required proving against 34d0cd0's objection.
// 34d0cd0 (2026-08-06) rejected a NAIVE Stop reminder because it would fire every turn, become
// noise and be ignored. These pin the difference between that design and this one.
// ---------------------------------------------------------------------------
import { RECENT_CONTACT_MS } from './idle-ding-check.mjs';
const MIN = 60_000;
const BASE = 1_000_000_000;

test('PROPERTY: no ding since the previous idle, and none recent → REMINDS', () => {
  assert.equal(shouldRemind({ lastDing: BASE, lastStop: BASE + 30 * MIN, now: BASE + 31 * MIN }), true);
});

test('PROPERTY: a genuine ding since the previous idle → QUIET', () => {
  assert.equal(shouldRemind({ lastDing: BASE + 40 * MIN, lastStop: BASE + 30 * MIN, now: BASE + 41 * MIN }), false);
});

test('PROPERTY (the 34d0cd0 objection): ordinary turns do NOT become wallpaper', () => {
  // Six ordinary turns a minute apart, one real ding during turn 3. Measured BEFORE the recent-
  // contact window existed: 5 of 6 fired. That is the wallpaper the earlier design was rejected for.
  let lastStop = 0, lastDing = 0, fired = 0;
  for (let turn = 1; turn <= 6; turn++) {
    const now = BASE + turn * MIN;
    if (turn === 3) lastDing = now - 1;
    if (shouldRemind({ lastDing, lastStop, now })) fired++;
    lastStop = now;
  }
  assert.ok(fired <= 2, `expected at most 2 reminders across a kept-informed exchange, got ${fired}`);
});

test('PROPERTY: but the REAL failure still fires every time — six turns, never dinged', () => {
  let lastStop = 0, fired = 0;
  for (let turn = 1; turn <= 6; turn++) {
    const now = BASE + turn * MIN;
    if (shouldRemind({ lastDing: 0, lastStop, now })) fired++;
    lastStop = now;
  }
  assert.equal(fired, 6, 'muting must never swallow a stretch with no notification at all');
});

test('MUTATION: the recent-contact window is what does the muting, and it expires', () => {
  const justInside = { lastDing: BASE, lastStop: BASE + MIN, now: BASE + RECENT_CONTACT_MS - 1 };
  const justOutside = { lastDing: BASE, lastStop: BASE + MIN, now: BASE + RECENT_CONTACT_MS + 1 };
  assert.equal(shouldRemind(justInside), false, 'inside the window it must stay quiet');
  assert.equal(shouldRemind(justOutside), true, 'outside it the reminder must return');
});

test('CAPABILITY: the hook cannot send, spawn, or invoke a model — asserted on CODE, not comments', () => {
  const src = readFileSync(new URL('./idle-ding-check.mjs', import.meta.url), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const [name, re] of Object.entries({
    network: /fetch\(|https?:\/\/|axios/,
    spawn: /child_process|spawn|exec\(/,
    model: /Agent|subagent|anthropic/i,
    send: /sendMessage|telegram|bot\d/i,
  })) assert.ok(!re.test(src), `hook must not be capable of ${name}`);
});
