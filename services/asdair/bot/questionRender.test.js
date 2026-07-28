// BUILD-015 AsdAIr bot — the render contract: unit tests.
// Fully offline. No network, no database, no credentials file, no model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  FINGERPRINT_DOMAIN,
  FIRST_RENDER_VERSION,
  candidateIdOf,
  candidateIds,
  nextRenderVersion,
  persistQuestionRender,
  prepareQuestionCard,
  questionLookupFrom,
  renderFingerprint,
  sendQuestionCard,
  verifyStoredContract,
} from './questionRender.js';
import { MAX_CANDIDATE_BUTTONS } from './renderMessages.js';
import { parseAnswerArg, parseCallbackData } from './callbackProtocol.js';
import { routeAsdairUpdate } from './inboundRouter.js';

const REF = 'shop-2026-07-28';
const KEY = 'q7';

const CANDIDATES = [
  { id: 'P-1001', label: 'Yeo Valley Natural Yogurt 500g' },
  { id: 'P-1002', label: 'Arla Skyr Natural 450g' },
  { id: 'P-1003', label: 'ASDA Greek Style Natural 500g' },
];

/**
 * An in-memory stand-in for asdair.shop_question with the SAME semantics the
 * real SQL must have — in particular recordAnswer is a compare-and-set against
 * status='open', not a read-then-write.
 */
function createFakeStore() {
  const rows = [];
  let nextId = 1;
  return {
    rows,
    async getQuestionByCard({ chatId, messageId }) {
      return rows.find((r) => String(r.card_chat_id) === String(chatId)
        && String(r.card_message_id) === String(messageId)) ?? null;
    },
    async getQuestionByKey({ shopRef, questionKey }) {
      return rows.find((r) => r.shop_ref === shopRef && r.question_key === questionKey) ?? null;
    },
    async saveRender({ shopRef, questionKey, chatId, messageId, renderedCandidates, renderFingerprint: fp, renderVersion }) {
      let row = rows.find((r) => r.shop_ref === shopRef && r.question_key === questionKey);
      if (!row) {
        row = {
          id: nextId, shop_ref: shopRef, question_key: questionKey, status: 'open',
          answer_text: null, answer_source: null, callback_index: null, answered_at: null,
        };
        nextId += 1;
        rows.push(row);
      }
      row.card_chat_id = String(chatId);
      row.card_message_id = String(messageId);
      row.rendered_candidates = renderedCandidates;
      row.render_fingerprint = fp;
      row.render_version = renderVersion;
      return row;
    },
    async recordAnswer({ questionId, answerText, answerSource, callbackIndex, answeredAt }) {
      const row = rows.find((r) => r.id === questionId);
      if (!row) return { applied: false, question: null };
      if (row.status !== 'open') return { applied: false, question: row };
      row.status = 'answered';
      row.answer_text = answerText;
      row.answer_source = answerSource;
      row.callback_index = callbackIndex;
      row.answered_at = answeredAt;
      return { applied: true, question: row };
    },
  };
}

function createFakeSender({ failSend = false } = {}) {
  const sent = [];
  const edits = [];
  return {
    sent,
    edits,
    async sendMessage(chatId, message) {
      if (failSend) throw new Error('send failed');
      sent.push({ chatId, message });
      return { message_id: 100 + sent.length, chat: { id: chatId } };
    },
    async editMessageText(chatId, messageId, message) {
      edits.push({ chatId, messageId, message });
      return { message_id: messageId };
    },
    async answerCallbackQuery() { return true; },
  };
}

// ── the fingerprint definition ───────────────────────────────────────────────

test('the fingerprint is EXACTLY sha256(JSON.stringify([domain, questionKey, version, orderedIds]))', () => {
  const ids = ['P-1001', 'P-1002', 'P-1003'];
  const expected = createHash('sha256')
    .update(JSON.stringify([FINGERPRINT_DOMAIN, KEY, 1, ids]), 'utf8')
    .digest('hex');
  assert.equal(renderFingerprint({ questionKey: KEY, candidateIds: ids, renderVersion: 1 }), expected);
  assert.match(expected, /^[0-9a-f]{64}$/);
});

test('REORDERING the same candidates changes the fingerprint — the whole reason it exists', () => {
  const a = renderFingerprint({ questionKey: KEY, candidateIds: ['A', 'B', 'C'], renderVersion: 1 });
  const b = renderFingerprint({ questionKey: KEY, candidateIds: ['C', 'B', 'A'], renderVersion: 1 });
  assert.notEqual(a, b);
});

test('the version, the question key and the id set are all inside the hash', () => {
  const base = { questionKey: KEY, candidateIds: ['A', 'B'], renderVersion: 1 };
  const fp = renderFingerprint(base);
  assert.notEqual(fp, renderFingerprint({ ...base, renderVersion: 2 }));
  assert.notEqual(fp, renderFingerprint({ ...base, questionKey: 'q8' }));
  assert.notEqual(fp, renderFingerprint({ ...base, candidateIds: ['A', 'B', 'C'] }));
  assert.notEqual(fp, renderFingerprint({ ...base, candidateIds: ['A'] }));
});

test('the fingerprint is injection-proof: a separator inside an id cannot forge a different list', () => {
  // ['A:B','C'] and ['A','B:C'] would collide under a naive join(':').
  const a = renderFingerprint({ questionKey: KEY, candidateIds: ['A:B', 'C'], renderVersion: 1 });
  const b = renderFingerprint({ questionKey: KEY, candidateIds: ['A', 'B:C'], renderVersion: 1 });
  assert.notEqual(a, b);
});

test('the fingerprint is deterministic — same inputs, same bytes, every time', () => {
  const spec = { questionKey: KEY, candidateIds: ['P-1', 'P-2'], renderVersion: 3 };
  assert.equal(renderFingerprint(spec), renderFingerprint(spec));
});

test('renderFingerprint refuses inputs it cannot hash meaningfully', () => {
  assert.throws(() => renderFingerprint({ candidateIds: ['A'], renderVersion: 1 }), /questionKey required/);
  assert.throws(() => renderFingerprint({ questionKey: KEY, candidateIds: 'A', renderVersion: 1 }), /must be an array/);
  assert.throws(() => renderFingerprint({ questionKey: KEY, candidateIds: [''], renderVersion: 1 }), /non-empty string/);
  assert.throws(() => renderFingerprint({ questionKey: KEY, candidateIds: ['A'], renderVersion: 0 }), /integer >= 1/);
});

// ── candidate identity: fail closed ──────────────────────────────────────────

test('a BARE STRING candidate is refused — a label is not an identity', () => {
  assert.throws(() => candidateIdOf('Yeo Valley Natural 500g', 0), /bare string/);
  assert.throws(
    () => prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: ['milk'] }),
    /bare string/,
  );
});

test('a candidate with no id is refused rather than indexed by position alone', () => {
  assert.throws(() => candidateIdOf({ label: 'no id here' }, 0), /has no id/);
  assert.throws(() => candidateIdOf({ id: '   ' }, 0), /empty id/);
  assert.throws(() => candidateIdOf(null, 0), /must be an object/);
});

test('id, productId and product_id are all accepted, and coerced to a string', () => {
  assert.equal(candidateIdOf({ id: 42 }, 0), '42');
  assert.equal(candidateIdOf({ productId: 'P-9' }, 0), 'P-9');
  assert.equal(candidateIdOf({ product_id: 'P-8' }, 0), 'P-8');
  assert.deepEqual(candidateIds([{ id: 'a' }, { id: 'b' }]), ['a', 'b']);
});

// ── card and contract are built from ONE list ────────────────────────────────

test('every rendered button resolves, by index, to the contract candidate at that index', () => {
  const { message, contract } = prepareQuestionCard({
    shopRef: REF, questionKey: KEY, item: 'yogurt', candidates: CANDIDATES,
  });
  const rows = message.reply_markup.inline_keyboard;
  // The last row is Search/Skip; the candidate rows come first, one per candidate.
  const candidateRows = rows.slice(0, CANDIDATES.length);
  assert.equal(candidateRows.length, contract.renderedCandidates.length);
  candidateRows.forEach((row, i) => {
    const parsedCb = parseCallbackData(row[0].callback_data);
    assert.equal(parsedCb.ok, true);
    const parsedArg = parseAnswerArg(parsedCb.arg);
    assert.equal(parsedArg.ok, true);
    assert.equal(parsedArg.questionKey, KEY);
    assert.equal(parsedArg.candidateIndex, i);
    assert.equal(contract.renderedCandidates[i].index, i);
    assert.equal(contract.renderedCandidates[i].id, CANDIDATES[i].id);
  });
});

test('the contract records the DISPLAYED list, capped exactly as the card is capped', () => {
  const many = Array.from({ length: MAX_CANDIDATE_BUTTONS + 4 }, (_, i) => ({ id: `P-${i}`, label: `item ${i}` }));
  const { message, contract } = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: many });
  const candidateRows = message.reply_markup.inline_keyboard.length - 1; // minus the Search/Skip row
  assert.equal(candidateRows, MAX_CANDIDATE_BUTTONS);
  assert.equal(contract.renderedCandidates.length, MAX_CANDIDATE_BUTTONS);
  assert.deepEqual(contract.candidateIds, many.slice(0, MAX_CANDIDATE_BUTTONS).map((c) => c.id));
});

test('the contract fingerprint matches its own ordered ids and version', () => {
  const { contract } = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES, renderVersion: 4 });
  assert.equal(contract.renderVersion, 4);
  assert.equal(
    contract.renderFingerprint,
    renderFingerprint({ questionKey: KEY, candidateIds: contract.candidateIds, renderVersion: 4 }),
  );
});

test('prepareQuestionCard enforces the callback budgets it inherits', () => {
  assert.throws(() => prepareQuestionCard({ shopRef: 'r'.repeat(40), questionKey: KEY, candidates: CANDIDATES }), /limit is 32B/);
  assert.throws(() => prepareQuestionCard({ shopRef: REF, questionKey: 'k'.repeat(20), candidates: CANDIDATES }), /limit is 12B/);
  assert.throws(() => prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES, renderVersion: 0 }), /integer >= 1/);
});

// ── persistence ──────────────────────────────────────────────────────────────

test('a first render is persisted with its ordered candidates, fingerprint and version', async () => {
  const store = createFakeStore();
  const { contract } = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES });
  const saved = await persistQuestionRender({ store, contract, chatId: 55, messageId: 100 });
  assert.equal(saved.unchanged, false);
  assert.equal(saved.version, FIRST_RENDER_VERSION);
  const row = store.rows[0];
  assert.equal(row.card_chat_id, '55');
  assert.equal(row.card_message_id, '100');
  assert.equal(row.render_version, 1);
  assert.equal(row.render_fingerprint, contract.renderFingerprint);
  assert.deepEqual(row.rendered_candidates.map((c) => c.id), ['P-1001', 'P-1002', 'P-1003']);
  assert.equal(verifyStoredContract(row).ok, true);
});

test('re-persisting the IDENTICAL card is idempotent — no version inflation, no rewrite', async () => {
  const store = createFakeStore();
  const { contract } = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES });
  await persistQuestionRender({ store, contract, chatId: 55, messageId: 100 });
  const again = await persistQuestionRender({ store, contract, chatId: 55, messageId: 100 });
  assert.equal(again.unchanged, true);
  assert.equal(again.version, 1);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].render_version, 1);
});

test('REFUSES to rebind a different candidate order to a message id already in use', async () => {
  const store = createFakeStore();
  const v1 = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES });
  await persistQuestionRender({ store, contract: v1.contract, chatId: 55, messageId: 100 });

  const reordered = [CANDIDATES[2], CANDIDATES[1], CANDIDATES[0]];
  const v2 = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: reordered, renderVersion: 2 });
  await assert.rejects(
    () => persistQuestionRender({ store, contract: v2.contract, chatId: 55, messageId: 100 }),
    /refusing to rebind .* SAME card/s,
  );
  // The v1 contract is untouched, so the buttons still on that card stay honest.
  assert.equal(store.rows[0].render_version, 1);
  assert.deepEqual(store.rows[0].rendered_candidates.map((c) => c.id), ['P-1001', 'P-1002', 'P-1003']);
});

test('a re-render on a NEW card is accepted and moves the contract to it', async () => {
  const store = createFakeStore();
  const v1 = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES });
  await persistQuestionRender({ store, contract: v1.contract, chatId: 55, messageId: 100 });

  const reordered = [CANDIDATES[2], CANDIDATES[1], CANDIDATES[0]];
  const v2 = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: reordered, renderVersion: 2 });
  await persistQuestionRender({ store, contract: v2.contract, chatId: 55, messageId: 200 });

  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].card_message_id, '200');
  assert.equal(store.rows[0].render_version, 2);
  assert.deepEqual(store.rows[0].rendered_candidates.map((c) => c.id), ['P-1003', 'P-1002', 'P-1001']);
});

test('re-rendering an ANSWERED question is refused — a settled decision is not reopened', async () => {
  const store = createFakeStore();
  const v1 = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES });
  await persistQuestionRender({ store, contract: v1.contract, chatId: 55, messageId: 100 });
  store.rows[0].status = 'answered';
  const v2 = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES, renderVersion: 2 });
  await assert.rejects(
    () => persistQuestionRender({ store, contract: v2.contract, chatId: 55, messageId: 200 }),
    /already answered/,
  );
});

test('nextRenderVersion starts at 1 and only ever climbs', () => {
  assert.equal(nextRenderVersion(null), 1);
  assert.equal(nextRenderVersion({}), 1);
  assert.equal(nextRenderVersion({ render_version: 1 }), 2);
  assert.equal(nextRenderVersion({ render_version: 9 }), 10);
});

// ── send + seal ──────────────────────────────────────────────────────────────

test('sendQuestionCard sends the card and seals its contract against the returned message id', async () => {
  const store = createFakeStore();
  const sender = createFakeSender();
  const out = await sendQuestionCard({
    sender, store, chatId: 55, shopRef: REF, questionKey: KEY, item: 'yogurt', candidates: CANDIDATES,
  });
  assert.equal(sender.sent.length, 1);
  assert.equal(out.messageId, 101);
  assert.equal(out.version, 1);
  assert.equal(store.rows[0].card_message_id, '101');
  assert.equal(store.rows[0].render_fingerprint, out.contract.renderFingerprint);
});

test('a second sendQuestionCard bumps the version onto a new card automatically', async () => {
  const store = createFakeStore();
  const sender = createFakeSender();
  await sendQuestionCard({ sender, store, chatId: 55, shopRef: REF, questionKey: KEY, candidates: CANDIDATES });
  const firstFingerprint = store.rows[0].render_fingerprint;
  const second = await sendQuestionCard({
    sender, store, chatId: 55, shopRef: REF, questionKey: KEY,
    candidates: [CANDIDATES[2], CANDIDATES[0], CANDIDATES[1]],
  });
  assert.equal(second.version, 2);
  assert.equal(second.messageId, 102);
  assert.equal(store.rows[0].card_message_id, '102');
  assert.equal(store.rows[0].render_fingerprint, second.contract.renderFingerprint);
  assert.notEqual(second.contract.renderFingerprint, firstFingerprint);
});

test('a card whose contract cannot be sealed is neutralised rather than left looking live', async () => {
  const store = createFakeStore();
  store.saveRender = async () => { throw new Error('write failed'); };
  const sender = createFakeSender();
  await assert.rejects(
    () => sendQuestionCard({ sender, store, chatId: 55, shopRef: REF, questionKey: KEY, candidates: CANDIDATES }),
    /write failed/,
  );
  assert.equal(sender.edits.length, 1);
  assert.match(sender.edits[0].message.text, /not usable/);
  assert.deepEqual(sender.edits[0].message.reply_markup, { inline_keyboard: [] });
});

// ── contract integrity ───────────────────────────────────────────────────────

test('verifyStoredContract catches rendered_candidates edited without re-sealing', async () => {
  const store = createFakeStore();
  const { contract } = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES });
  await persistQuestionRender({ store, contract, chatId: 55, messageId: 100 });
  const row = store.rows[0];
  assert.equal(verifyStoredContract(row).ok, true);

  row.rendered_candidates = [row.rendered_candidates[2], row.rendered_candidates[1], row.rendered_candidates[0]];
  const bad = verifyStoredContract(row);
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /does not match/);
});

test('verifyStoredContract fails closed on a missing or unusable contract', () => {
  assert.equal(verifyStoredContract(null).ok, false);
  assert.equal(verifyStoredContract({}).ok, false);
  assert.equal(verifyStoredContract({ question_key: KEY }).ok, false);
  assert.equal(verifyStoredContract({ question_key: KEY, render_version: 1, rendered_candidates: [] }).ok, false);
  assert.equal(
    verifyStoredContract({ question_key: KEY, render_version: 1, rendered_candidates: [{ label: 'no id' }], render_fingerprint: 'x' }).ok,
    false,
  );
});

// ── the typed-reply lookup is backed by the SAME contract ────────────────────

test('questionLookupFrom gives inboundRouter a reverse lookup off the stored cards', async () => {
  const store = createFakeStore();
  const { contract } = prepareQuestionCard({ shopRef: REF, questionKey: KEY, candidates: CANDIDATES });
  await persistQuestionRender({ store, contract, chatId: 55, messageId: 100 });

  const resolveQuestionByMessage = questionLookupFrom(store.rows);
  assert.deepEqual(resolveQuestionByMessage(55, 100), { questionKey: KEY, shopRef: REF });
  assert.equal(resolveQuestionByMessage(55, 999), null);
  assert.equal(resolveQuestionByMessage(66, 100), null);

  const routed = routeAsdairUpdate({
    message: {
      message_id: 501, chat: { id: 55 }, from: { id: 9 },
      text: 'the Yeo Valley one please', reply_to_message: { message_id: 100 },
    },
  }, { resolveQuestionByMessage });
  assert.equal(routed.ok, true);
  assert.equal(routed.arg, KEY);
  assert.equal(routed.shopRef, REF);
});
