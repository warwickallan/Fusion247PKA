// BUILD-015 AsdAIr bot — the wire format: unit tests. Fully offline, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS,
  ACTION_VALUES,
  CALLBACK_DATA_MAX_BYTES,
  CALLBACK_NAMESPACE,
  MAX_ACTION_BYTES,
  MAX_ARG_BYTES,
  MAX_CANDIDATE_INDEX,
  MAX_QUESTION_KEY_BYTES,
  MAX_SHOP_REF_BYTES,
  WORST_CASE_BYTES,
  buildAnswerArg,
  buildCallbackData,
  byteLength,
  isValidAction,
  isValidShopRef,
  parseAnswerArg,
  parseCallbackData,
} from './callbackProtocol.js';

const REF = 'shop-2026-07-28';

// ── namespace + shape ────────────────────────────────────────────────────────

test('every callback is namespaced asd: so it can never be confused with the hub decision: protocol', () => {
  for (const action of ACTION_VALUES) {
    const data = buildCallbackData({ action, shopRef: REF });
    assert.ok(data.startsWith(`${CALLBACK_NAMESPACE}:`), `${action} is not namespaced`);
    assert.equal(data, `asd:${action}:${REF}`);
  }
  assert.equal(parseCallbackData('decision:card-1:A').ok, false);
});

test('the directive-mandated actions all exist', () => {
  for (const required of [
    'build', 'review', 'cancel', 'answer', 'search', 'skip', 'basket',
    'status', 'held', 'pause', 'exceptions', 'close', 'retry',
  ]) {
    assert.ok(isValidAction(required), `missing action: ${required}`);
  }
});

// ── the 64-byte ceiling ──────────────────────────────────────────────────────

test('the declared budgets saturate Telegram\'s 64-byte limit exactly — and never exceed it', () => {
  // asd(3) + : + action(10) + : + shopRef(32) + : + arg(16) = 64
  assert.equal(MAX_ACTION_BYTES, 'exceptions'.length);
  assert.equal(
    CALLBACK_NAMESPACE.length + 1 + MAX_ACTION_BYTES + 1 + MAX_SHOP_REF_BYTES + 1 + MAX_ARG_BYTES,
    CALLBACK_DATA_MAX_BYTES,
  );
  assert.equal(WORST_CASE_BYTES, CALLBACK_DATA_MAX_BYTES);
});

test('the WORST legal payload — longest action + max-length ref + max-length arg — is exactly 64 bytes', () => {
  const longestAction = ACTION_VALUES.reduce((a, b) => (b.length > a.length ? b : a));
  const maxRef = 'r'.repeat(MAX_SHOP_REF_BYTES);
  const maxArg = 'a'.repeat(MAX_ARG_BYTES);
  const data = buildCallbackData({ action: longestAction, shopRef: maxRef, arg: maxArg });
  assert.equal(byteLength(data), CALLBACK_DATA_MAX_BYTES);
  assert.equal(parseCallbackData(data).ok, true);
});

test('EVERY action, at maximum ref and arg length, stays inside 64 bytes', () => {
  const maxRef = 'r'.repeat(MAX_SHOP_REF_BYTES);
  const maxArg = 'a'.repeat(MAX_ARG_BYTES);
  for (const action of ACTION_VALUES) {
    for (const arg of [null, maxArg]) {
      const data = buildCallbackData({ action, shopRef: maxRef, arg });
      assert.ok(byteLength(data) <= CALLBACK_DATA_MAX_BYTES, `${action} overflowed: ${byteLength(data)}B`);
    }
  }
});

test('an over-long shop ref THROWS — it is never truncated', () => {
  const tooLong = 'r'.repeat(MAX_SHOP_REF_BYTES + 1);
  assert.throws(() => buildCallbackData({ action: ACTIONS.BUILD, shopRef: tooLong }), /limit is 32B/);
  // Adversarial: a 500-char ref must not silently produce a 64-byte button.
  assert.throws(() => buildCallbackData({ action: ACTIONS.STATUS, shopRef: 'x'.repeat(500) }), /never truncates/);
  assert.equal(isValidShopRef(tooLong), false);
});

test('an over-long arg THROWS — it is never truncated', () => {
  assert.throws(
    () => buildCallbackData({ action: ACTIONS.ANSWER, shopRef: REF, arg: 'a'.repeat(MAX_ARG_BYTES + 1) }),
    /limit is 16B/,
  );
  assert.throws(
    () => buildCallbackData({ action: ACTIONS.SEARCH, shopRef: REF, arg: 'q'.repeat(400) }),
    /limit is 16B/,
  );
});

test('non-ASCII is refused, so a multi-byte character can never blow the byte budget', () => {
  // 32 emoji would be 32 CHARS but 128 BYTES — the charset check stops it dead.
  assert.throws(() => buildCallbackData({ action: ACTIONS.BUILD, shopRef: '🛒'.repeat(MAX_SHOP_REF_BYTES) }), /must match/);
  assert.throws(() => buildCallbackData({ action: ACTIONS.BUILD, shopRef: 'shop café' }), /must match/);
  assert.equal(byteLength('🛒'), 4);
});

test('no builder output ever exceeds 64 bytes, across a brute-force sweep of lengths', () => {
  for (const action of ACTION_VALUES) {
    for (let refLen = 1; refLen <= MAX_SHOP_REF_BYTES; refLen += 1) {
      for (let argLen = 0; argLen <= MAX_ARG_BYTES; argLen += 1) {
        const data = buildCallbackData({
          action,
          shopRef: 'r'.repeat(refLen),
          arg: argLen === 0 ? null : 'a'.repeat(argLen),
        });
        assert.ok(byteLength(data) <= CALLBACK_DATA_MAX_BYTES);
      }
    }
  }
});

// ── round trip ───────────────────────────────────────────────────────────────

test('round-trips build -> parse for EVERY action, with and without an arg', () => {
  for (const action of ACTION_VALUES) {
    const bare = parseCallbackData(buildCallbackData({ action, shopRef: REF }));
    assert.deepEqual(bare, { ok: true, action, shopRef: REF, arg: null });

    const withArg = parseCallbackData(buildCallbackData({ action, shopRef: REF, arg: 'q7.2' }));
    assert.deepEqual(withArg, { ok: true, action, shopRef: REF, arg: 'q7.2' });
  }
});

test('arg presence is preserved exactly — null, not absent — so a handler can tell "open the queue" from "this choice"', () => {
  const queue = parseCallbackData(buildCallbackData({ action: ACTIONS.ANSWER, shopRef: REF }));
  const choice = parseCallbackData(buildCallbackData({ action: ACTIONS.ANSWER, shopRef: REF, arg: buildAnswerArg('q7', 2) }));
  assert.equal(queue.arg, null);
  assert.ok(Object.prototype.hasOwnProperty.call(queue, 'arg'));
  assert.equal(choice.arg, 'q7.2');
});

// ── refusals ─────────────────────────────────────────────────────────────────

test('unknown and malformed payloads are refused, never guessed', () => {
  const cases = [
    ['', 'empty'],
    [null, 'null'],
    [undefined, 'undefined'],
    [42, 'a number'],
    ['asd', 'namespace only'],
    ['asd:build', 'no shop ref'],
    ['asd:build:', 'empty shop ref'],
    ['asd:notanaction:ref1', 'unknown action'],
    ['asd:build:ref:arg:extra', 'too many fields'],
    ['asd:build:ref with space', 'bad charset in ref'],
    ['asd:answer:ref:arg with space', 'bad charset in arg'],
    ['decision:card:A', 'the hub protocol'],
    ['ASD:build:ref', 'wrong-case namespace'],
    ['asdx:build:ref', 'near-miss namespace'],
    [`asd:build:${'r'.repeat(200)}`, 'over-long forged payload'],
  ];
  for (const [data, why] of cases) {
    const r = parseCallbackData(data);
    assert.equal(r.ok, false, `should have refused ${why}: ${String(data)}`);
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0);
  }
});

test('buildCallbackData refuses an unknown action and a missing ref', () => {
  assert.throws(() => buildCallbackData({ action: 'checkout', shopRef: REF }), /not one of/);
  assert.throws(() => buildCallbackData({ action: 'pay', shopRef: REF }), /not one of/);
  assert.throws(() => buildCallbackData({ action: ACTIONS.BUILD }), /shopRef required/);
  assert.throws(() => buildCallbackData({}), /not one of/);
});

// ── answer args ──────────────────────────────────────────────────────────────

test('answer args round-trip and stay inside the arg budget', () => {
  for (const [key, idx] of [['q1', 0], ['q12', 7], ['item-42', 3], ['a'.repeat(MAX_QUESTION_KEY_BYTES), MAX_CANDIDATE_INDEX]]) {
    const arg = buildAnswerArg(key, idx);
    assert.ok(byteLength(arg) <= MAX_ARG_BYTES, `${arg} is ${byteLength(arg)}B`);
    assert.deepEqual(parseAnswerArg(arg), { ok: true, questionKey: key, candidateIndex: idx });
  }
});

test('an over-long question key or an out-of-range index throws rather than truncating', () => {
  assert.throws(() => buildAnswerArg('k'.repeat(MAX_QUESTION_KEY_BYTES + 1), 1), /limit is 12B/);
  assert.throws(() => buildAnswerArg('q1', -1), /integer 0/);
  assert.throws(() => buildAnswerArg('q1', 1000), /integer 0/);
  assert.throws(() => buildAnswerArg('q1', 1.5), /integer 0/);
  assert.throws(() => buildAnswerArg('q 1', 1), /must match/);
});

test('malformed answer args are refused', () => {
  for (const bad of ['', 'q7', 'q7.', '.2', 'q7.abc', 'q7.1234', null, 7, `${'k'.repeat(20)}.1`]) {
    assert.equal(parseAnswerArg(bad).ok, false, `should have refused: ${String(bad)}`);
  }
});

// ── WP-B15-1: the `approve` action (interpretation-confirmation gate) ────────

test('approve exists, is DISTINCT from the order-email confirm, and rides the wire round-trip', () => {
  assert.ok(isValidAction('approve'), 'missing action: approve');
  assert.ok(isValidAction('confirm'), 'the pre-existing confirm action must survive untouched');
  assert.notEqual(ACTIONS.APPROVE, ACTIONS.CONFIRM, 'one tap word must never carry two meanings');
  const data = buildCallbackData({ action: ACTIONS.APPROVE, shopRef: REF });
  assert.equal(data, `asd:approve:${REF}`);
  assert.deepEqual(parseCallbackData(data), { ok: true, action: 'approve', shopRef: REF, arg: null });
});

test('approve is 7 bytes, so `exceptions` still sizes the budget and no field shrinks protocol-wide', () => {
  assert.equal(byteLength(ACTIONS.APPROVE), 7);
  assert.ok(byteLength(ACTIONS.APPROVE) <= MAX_ACTION_BYTES, 'approve must fit the existing action budget');
  assert.equal(MAX_ACTION_BYTES, 'exceptions'.length, 'adding approve must not change the longest action');
  assert.equal(WORST_CASE_BYTES, CALLBACK_DATA_MAX_BYTES, 'the 64-byte saturation arithmetic must be unchanged');
});
