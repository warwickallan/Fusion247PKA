// The Store's SQL is the part no other test in this folder can catch, because
// resolveTap is correct regardless of whether the store cheats. These tests
// assert on the STATEMENTS issued, against a fake client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuestionStore } from './questionStore.js';

function fake(responses = []) {
  const seen = [];
  let i = 0;
  return {
    seen,
    query: async (text, params) => {
      seen.push({ text: text.replace(/\s+/g, ' ').trim(), params });
      return responses[i++] ?? { rowCount: 0, rows: [] };
    },
  };
}

test('recordAnswer is a COMPARE-AND-SET - "and status = \'open\'" is present', async () => {
  const c = fake([{ rowCount: 1, rows: [{ id: 5 }] }, { rowCount: 1, rows: [{ id: 5, status: 'answered' }] }]);
  const s = createQuestionStore(c);
  const out = await s.recordAnswer({ questionId: 5, answerText: 'Quantum Dry', callbackIndex: 0 });
  const upd = c.seen[0].text.toLowerCase();
  assert.ok(upd.startsWith('update asdair.shop_question'));
  assert.ok(/and status = 'open'/.test(upd), 'the CAS guard must be in the UPDATE itself');
  assert.ok(!/select/.test(upd), 'must not be a read-then-write');
  assert.equal(out.applied, true);
});

test('a losing tap gets applied:false and the WINNER answer, not its own', async () => {
  const winner = { id: 5, status: 'answered', answer_text: 'Quantum Dry', shop_ref: 'SHOP-X' };
  const c = fake([{ rowCount: 0, rows: [] }, { rowCount: 1, rows: [winner] }]);
  const s = createQuestionStore(c);
  const out = await s.recordAnswer({ questionId: 5, answerText: 'Sport Cool', callbackIndex: 1 });
  assert.equal(out.applied, false, '0 rows updated means somebody answered first');
  assert.equal(out.question.answer_text, 'Quantum Dry', 'must return the winner verbatim');
});

test('getQuestionByCard matches BOTH ids EXACTLY - no LIKE, no chat-only match', async () => {
  const c = fake([{ rowCount: 1, rows: [{ id: 1, shop_ref: 'SHOP-X' }] }]);
  const s = createQuestionStore(c);
  await s.getQuestionByCard({ chatId: 123, messageId: 456 });
  const q = c.seen[0].text.toLowerCase();
  assert.ok(/q\.card_chat_id = \$1/.test(q));
  assert.ok(/q\.card_message_id = \$2/.test(q), 'message id must be part of the match');
  assert.ok(!/like|ilike|similar to/.test(q), 'a loose lookup defeats the staleness scheme');
  // Telegram ids exceed 32-bit and must be compared as text, normalised on entry.
  assert.deepEqual(c.seen[0].params, ['123', '456']);
});

test('every read joins asdair.shop so rows carry shop_ref', async () => {
  const c = fake([{ rowCount: 0, rows: [] }, { rowCount: 0, rows: [] }]);
  const s = createQuestionStore(c);
  await s.getQuestionByCard({ chatId: 1, messageId: 2 });
  await s.getQuestionByKey({ shopRef: 'SHOP-X', questionKey: 'sure' });
  for (const q of c.seen) {
    assert.ok(/join asdair\.shop s on s\.id = q\.shop_id/i.test(q.text), 'missing join -> shop-mismatch check no-ops');
    assert.ok(/s\.shop_ref/i.test(q.text));
  }
});

test('saveRender throws rather than silently binding nothing', async () => {
  const s = createQuestionStore(fake([{ rowCount: 0, rows: [] }]));
  await assert.rejects(
    () => s.saveRender({ shopRef: 'SHOP-X', questionKey: 'nope', chatId: 1, messageId: 2, renderedCandidates: [], renderFingerprint: 'f', renderVersion: 1 }),
    /no question nope on shop SHOP-X/,
  );
});

test('numeric and string Telegram ids normalise to the same card', async () => {
  const c = fake([{ rowCount: 1, rows: [{ id: 1 }] }, { rowCount: 1, rows: [{ id: 1 }] }]);
  const s = createQuestionStore(c);
  await s.getQuestionByCard({ chatId: 101, messageId: 202 });
  await s.getQuestionByCard({ chatId: '101', messageId: '202' });
  assert.deepEqual(c.seen[0].params, c.seen[1].params, 'a numeric id must not become a second card');
});
