// Pure unit tests for the Watcher notification composer (no DB, no network).
// Covers the Larry-voice change: the Tower Telegram now shows BOTH sides of the
// Larry<->Codex dialogue (Warwick: "I have no idea what you are doing in response
// to Codex"). Run: node --test test/notify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeMessage, summariseLarry } from '../notify.mjs';

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

test('composeMessage: shows Larry line AND Codex verdict when larryResponse present', () => {
  const msg = composeMessage({
    buildRef: 'BUILD-014', turnSeq: 14, turnId: 'abc-123', state: 'acted',
    verdict: 'correct', summary: 'drifted slightly', nextAction: 'apply fix',
    warwickNeeded: false, larryResponse: 'Understood - I will apply the fix and re-run to confirm green.',
  });
  assert.ok(msg.includes('🗣 Larry:'), 'Larry line present');
  assert.ok(msg.includes('supervisor verdict: correct'), 'Codex verdict present (legacy label unchanged)');
  assert.ok(msg.includes('turn: abc-123'), 'turn id present');
});

test('composeMessage: back-compat — absent larryResponse is BYTE-IDENTICAL to pre-change (F-001 regression)', () => {
  const msg = composeMessage({ buildRef: 'B', turnSeq: 1, turnId: 'x', state: 'reviewed', verdict: 'continue' });
  const expected = [
    '🗼 Tower B — turn #1',
    'state: reviewed',
    'supervisor verdict: continue',
    'turn: x',
  ].join('\n');
  assert.equal(msg, expected, 'absent-case output identical to the pre-change format');
  assert.ok(!msg.includes('🗣 Larry:'), 'no Larry line when absent');
});

test('summariseLarry: strips leftover/unmatched code fence (F-002)', () => {
  const s = summariseLarry('start ```js const x=1 then an unmatched ``` fence tail');
  assert.ok(!s.includes('`'), 'no backticks remain');
});
