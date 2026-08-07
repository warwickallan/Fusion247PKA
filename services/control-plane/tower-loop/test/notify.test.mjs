// Pure unit tests for the Watcher notification composer (no DB, no network).
// Covers the Larry-voice change: the Tower Telegram now shows BOTH sides of the
// Larry<->Codex dialogue (Warwick: "I have no idea what you are doing in response
// to Codex"). Run: node --test test/notify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  composeMessage, composeLarryMessage, summariseLarry,
  // WO-2026-08-07-33 — the QA-started card. `notify` itself is imported for the frozen-reason
  // validation checks below: they reject BEFORE any store or network is touched, so they belong
  // in this pure suite. The DEDUP half of that contract needs a real store and lives in
  // test/run-tower-loop-tests.mjs — it is not provable here and is not claimed here.
  composeQaStartedMessage, notify, NOTIFY_REASONS,
} from '../notify.mjs';

test('summariseLarry: bounds long text and appends an ellipsis', () => {
  const long = 'x'.repeat(1000);
  const s = summariseLarry(long, 280);
  assert.ok(s.length <= 280, 'bounded to max');
  assert.ok(s.endsWith('…'), 'ellipsis appended');
});

test('summariseLarry: strips code fences and collapses whitespace', () => {
  const s = summariseLarry('do  this\n```js\nconst x = 1;\n```\n  done');
  assert.ok(s.includes('[code]'), 'code fence replaced');
  assert.ok(!s.includes('```'), 'no raw fences remain');
  assert.ok(!/\s\s/.test(s), 'whitespace collapsed');
});

test('summariseLarry: empty / absent input returns empty string', () => {
  for (const v of [null, undefined, '', '   ', '\n\n']) {
    assert.equal(summariseLarry(v), '');
  }
});

test('composeMessage: Codex message carries ONLY Codex\'s side (no Larry line)', () => {
  const msg = composeMessage({
    buildRef: 'BUILD-014', turnSeq: 14, turnId: 'abc-123', state: 'acted',
    verdict: 'correct', summary: 'drifted slightly', nextAction: 'apply fix', warwickNeeded: false,
  });
  assert.ok(msg.includes('🤖 Codex'), 'Codex header present');
  assert.ok(msg.includes('verdict: correct'), 'Codex verdict present');
  assert.ok(msg.includes('turn: abc-123'), 'turn id present');
  assert.ok(!msg.includes('🗣 Larry'), 'Larry line NOT combined into the Codex message');
});

test('composeLarryMessage: Larry message carries ONLY Larry\'s side, keyed to the same turn', () => {
  const msg = composeLarryMessage({
    buildRef: 'BUILD-014', turnSeq: 14, turnId: 'abc-123',
    larryResponse: 'Understood - I will apply the fix and re-run to confirm green.',
  });
  assert.ok(msg.includes('🗣 Larry'), 'Larry header present');
  assert.ok(msg.includes('re-run to confirm green'), 'Larry excerpt present');
  assert.ok(msg.includes('turn: abc-123'), 'same turn id — pairs with the Codex message');
  assert.ok(!msg.includes('🤖 Codex'), 'Codex verdict NOT combined into the Larry message');
});

test('composeLarryMessage: returns empty string when there is no larry_response', () => {
  for (const v of [null, undefined, '', '   ']) {
    assert.equal(composeLarryMessage({ buildRef: 'B', turnSeq: 1, turnId: 'x', larryResponse: v }), '',
      'no Larry message when there is nothing to say (then only the Codex message sends)');
  }
});

test('summariseLarry: strips leftover/unmatched code fence (F-002)', () => {
  const s = summariseLarry('start ```js const x=1 then an unmatched ``` fence tail');
  assert.ok(!s.includes('`'), 'no backticks remain');
});

// ── AC7 (WO-2026-08-07-33) — `@tower` control directives never reach Larry's card ──────────────
// The real comment shape: `ensureCheckpointTurn` stores the PR comment VERBATIM, so whatever leads
// the comment is what the card used to render. These prove the prose surfaces instead, and that
// WHERE the prose sits in the comment is irrelevant.
const HEAD_DIRECTIVE = '@tower head: a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

test('AC7 — a DIRECTIVES-ONLY comment yields \'\' (so only the Codex card sends)', () => {
  const body = [
    HEAD_DIRECTIVE,
    '@tower checkpoint: BUILD-020',
    '@tower finding 1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9: addressed — fixed in this push',
  ].join('\n');
  assert.equal(summariseLarry(body), '', 'nothing but control syntax means nothing to say');
  assert.equal(composeLarryMessage({ buildRef: 'B', turnSeq: 1, turnId: 'x', larryResponse: body }), '',
    'and composeLarryMessage sends no Larry card at all — never "Larry: (nothing)"');
});

test('AC7 — prose BEFORE directives surfaces, with no @tower text', () => {
  const body = [
    'Rebuilt the poller and re-ran the suite; 69 subtests green.',
    HEAD_DIRECTIVE,
    '@tower checkpoint: BUILD-020',
  ].join('\n');
  const s = summariseLarry(body);
  assert.ok(s.includes('Rebuilt the poller'), 'the prose surfaced');
  assert.ok(!s.includes('@tower'), 'no control syntax remains');
  assert.ok(!s.includes('a1b2c3d4e5f6'), 'and no directive payload leaked either');
});

test('AC7 — ORDERING IS IRRELEVANT: prose AFTER directives surfaces just the same', () => {
  const body = [
    HEAD_DIRECTIVE,
    '@tower checkpoint: BUILD-020',
    'Rebuilt the poller and re-ran the suite; 69 subtests green.',
  ].join('\n');
  const s = summariseLarry(body);
  assert.ok(s.includes('Rebuilt the poller'), 'trailing prose surfaced — the card is not order-dependent');
  assert.ok(!s.includes('@tower'), 'no control syntax remains');
});

test('AC7 — the strip runs BEFORE the 280-char cut, so long directives cannot crowd the prose out', () => {
  // The failure this prevents: directives eat the budget and the prose is truncated away entirely.
  // Six long directive lines comfortably exceed 280 characters on their own.
  const directives = Array.from({ length: 6 }, (_, i) =>
    `@tower finding 1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f${i}: remains_open — still reproducing this one`);
  const body = [...directives, 'The one sentence Warwick actually needs to read.'].join('\n');
  assert.ok(directives.join('\n').length > 280, 'precondition: the directives alone exceed the cap');
  const s = summariseLarry(body);
  assert.equal(s, 'The one sentence Warwick actually needs to read.', 'the prose survived intact');
});

test('AC7 — a line-prefix test only: @tower INSIDE a sentence is prose and is kept', () => {
  const s = summariseLarry('I told him to use @tower head: directives in the comment.');
  assert.ok(s.includes('@tower head:'), 'a mid-sentence mention is Larry talking, not a directive');
  // …and `\b` means a longer word is not a directive either — mirrors ingestComment.mjs:108.
  assert.ok(summariseLarry('@towerish thoughts on the design').includes('@towerish'), 'word boundary respected');
});

test('AC7 — case-insensitive: a directive form the PARSER accepts cannot leak in as prose', () => {
  // CHECKPOINT_RE and FINDING_RE in ingestComment.mjs both carry the `i` flag, so `@Tower
  // checkpoint:` really is a directive there. Stated as a deliberate widening, not an accident.
  const s = summariseLarry(['@Tower checkpoint: BUILD-020', 'Ready for review.'].join('\n'));
  assert.equal(s, 'Ready for review.');
});

test('AC7 — the pre-existing fence/whitespace/empty behaviour is unchanged by the strip', () => {
  const s = summariseLarry('do  this\n```js\nconst x = 1;\n```\n  done');
  assert.ok(s.includes('[code]') && !s.includes('```') && !/\s\s/.test(s), 'fences and whitespace still handled');
  for (const v of [null, undefined, '', '   ', '\n\n']) assert.equal(summariseLarry(v), '');
});

// ── WO-2026-08-07-33 — the "Codex QA started" card ────────────────────────────
// The head used below is a real-shaped 40-hex value. It is asserted IN FULL on purpose: the whole
// point of this card is that Warwick can tell WHAT is being reviewed, and a truncated head does
// not identify a commit.
const HEAD_40 = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

test('codex_qa_started: the reason is a member of the frozen NOTIFY_REASONS list', () => {
  assert.ok(NOTIFY_REASONS.includes('codex_qa_started'), 'the new reason is accepted');
  assert.ok(Object.isFrozen(NOTIFY_REASONS), 'the list is still frozen');
});

test('notify: an UNKNOWN reason is still REJECTED (the validation gate was not weakened)', async () => {
  // Rejects before the store is touched, which is why `null` is a safe pool here — and is itself
  // the property being asserted: validation happens ahead of any write.
  await assert.rejects(
    () => notify(null, { turnId: 't1', reason: 'qa_started', state: 's', message: 'm' }),
    /unknown reason 'qa_started'/,
    'a near-miss reason name is refused, not silently accepted',
  );
  await assert.rejects(
    () => notify(null, { turnId: 't1', reason: 'codex_qa_finished', state: 's', message: 'm' }),
    /unknown reason/,
    'an invented sibling reason is refused',
  );
  // The mutation check: the gate must still be the frozen list, not a permissive default. If
  // someone replaced the membership test with a truthiness check, the two rejects above would
  // still pass for `undefined` but this one would go through.
  await assert.rejects(
    () => notify(null, { turnId: 't1', reason: 'findings_raised ', state: 's', message: 'm' }),
    /unknown reason/,
    'exact membership — a trailing space is not the same reason',
  );
});

test('composeQaStartedMessage: carries the PR number and the FULL 40-hex head', () => {
  const msg = composeQaStartedMessage({
    buildRef: 'BUILD-020', turnSeq: 7, turnId: 'turn-abc-123', prNumber: 87, headSha: HEAD_40,
  });
  assert.ok(msg.includes('🤖 Codex QA started'), 'QA-started header present');
  assert.ok(msg.includes('Tower BUILD-020'), 'build ref present');
  assert.ok(msg.includes('turn #7'), 'turn sequence present');
  assert.ok(msg.includes('PR: #87'), 'the PR number is stated');
  assert.ok(msg.includes(`head: ${HEAD_40}`), 'the EXACT 40-hex head is stated');
  assert.equal(msg.split('\n').filter((l) => l.includes(HEAD_40)).length, 1, 'head stated once');
  assert.ok(msg.includes('turn: turn-abc-123'), 'turn id present — this is the dedup key');
  // Not a verdict card: it must not read as though Codex has already said something.
  assert.ok(!msg.includes('verdict:'), 'no verdict — Codex has not returned yet');
  assert.ok(!msg.includes('🗣 Larry'), 'not combined with Larry\'s message');
});

test('composeQaStartedMessage: NEVER abbreviates the head (a 12-char slice is not identity)', () => {
  const msg = composeQaStartedMessage({ buildRef: 'B', turnSeq: 1, turnId: 'x', prNumber: 5, headSha: HEAD_40 });
  const headLine = msg.split('\n').find((l) => l.startsWith('head: '));
  assert.equal(headLine, `head: ${HEAD_40}`, 'the head line is the full sha and nothing else');
  assert.equal(headLine.slice('head: '.length).length, 40, 'exactly 40 characters');
});

test('composeQaStartedMessage: says so plainly rather than inventing provenance it does not have', () => {
  // An all-origins emission point sees turns that carry no PR and no head (loop.mjs, seed.mjs,
  // bridge-ingest.mjs). Fabricating a value, or dropping the line, would produce a card that
  // READS as full provenance while carrying none — the exact failure this card exists to avoid.
  for (const pr of [null, undefined, 0, -1, 'not-a-number']) {
    const msg = composeQaStartedMessage({ buildRef: 'B', turnSeq: 1, turnId: 'x', prNumber: pr, headSha: HEAD_40 });
    assert.ok(msg.includes('PR: (not a pull-request turn)'), `absent PR stated in words (${String(pr)})`);
  }
  for (const h of [null, undefined, '', 'abc123', `${HEAD_40}0`, 'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678'.slice(0, 39)]) {
    const msg = composeQaStartedMessage({ buildRef: 'B', turnSeq: 1, turnId: 'x', prNumber: 87, headSha: h });
    assert.ok(msg.includes('head: (no canonical head recorded on this turn)'),
      `a non-canonical head is never passed off as one (${JSON.stringify(h)})`);
  }
});

test('composeQaStartedMessage: an UPPERCASE 40-hex head is normalised, not rejected', () => {
  const msg = composeQaStartedMessage({
    buildRef: 'B', turnSeq: 1, turnId: 'x', prNumber: 87, headSha: HEAD_40.toUpperCase(),
  });
  assert.ok(msg.includes(`head: ${HEAD_40}`), 'lower-cased to match how every other surface renders it');
});
