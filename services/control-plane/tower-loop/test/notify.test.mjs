// Pure unit tests for the Watcher notification composer (no DB, no network).
// Covers the Larry-voice change: the Tower Telegram now shows BOTH sides of the
// Larry<->Codex dialogue (Warwick: "I have no idea what you are doing in response
// to Codex"). Run: node --test test/notify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeMessage, composeLarryMessage, summariseLarry } from '../notify.mjs';

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
