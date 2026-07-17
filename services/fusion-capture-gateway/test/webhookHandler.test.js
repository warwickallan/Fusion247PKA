// BUILD-002 WP1 — unit suite for the PURE edge webhook handler
// (supabase/functions/fcg-webhook-intake/handler.js), test plan §1 U1–U11 +
// U13. U12 (golden-vector parity) lives in idempotencyParity.test.js.
//
// Hermetic: no network, no DB, no Deno. The handler's deps (rpc / telegram /
// log) are recorders; `secret` is a canary value swept for leakage in U13.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  handleTelegramWebhook,
  timingSafeEqualStrings,
  PENDING_CARD_TEXT,
  WAITING_CARD_TEXT,
  ACTION_KEYBOARD,
} from '../../../supabase/functions/fcg-webhook-intake/handler.js';
import { deriveTelegramTextKeys } from '../../../supabase/functions/fcg-webhook-intake/derive.js';
import { projectCard } from '../src/receiptProjection.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = '424242';
// Canary secrets — lowercase key names + values shaped to dodge the repo
// secret-scanner's VALUE patterns while remaining unique + grep-able.
const CANARY_SECRET = 'canary~webhook~secret~value~001';
const CANARY_BOT_TOKEN = '123:AA-canary-bot-token-not-real';

function makeDeps({ rpcOutcomes = {}, rpcError, sendMessageError, sendMessageErrorTimes = 0 } = {}) {
  const calls = { rpc: [], telegram: [], logs: [] };
  let sendFailsLeft = sendMessageErrorTimes;
  let nextMessageId = 9000;
  const deps = {
    secret: CANARY_SECRET,
    log: (e) => calls.logs.push(e),
    rpc: async (fn, args) => {
      calls.rpc.push({ fn, args });
      if (rpcError) throw rpcError;
      const outcome = rpcOutcomes[fn];
      if (typeof outcome === 'function') return outcome(args);
      return outcome ?? { outcome: 'ok' };
    },
    telegram: {
      sendMessage: async (p) => {
        calls.telegram.push({ method: 'sendMessage', payload: p });
        if (sendMessageError && sendFailsLeft !== 0) {
          if (sendFailsLeft > 0) sendFailsLeft -= 1;
          throw sendMessageError;
        }
        nextMessageId += 1;
        return { ok: true, result: { message_id: nextMessageId } };
      },
      editMessageText: async (p) => {
        calls.telegram.push({ method: 'editMessageText', payload: p });
        return { ok: true, result: true };
      },
      answerCallbackQuery: async (p) => {
        calls.telegram.push({ method: 'answerCallbackQuery', payload: p });
        return { ok: true, result: true };
      },
    },
  };
  return { deps, calls };
}

function post(update, { secret = CANARY_SECRET } = {}) {
  return {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': secret, 'content-type': 'application/json' },
    bodyText: JSON.stringify(update),
  };
}

function textUpdate(updateId, messageId, text, fromId = AUTH_ID) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      from: { id: Number(fromId) },
      chat: { id: Number(fromId) },
      date: 1752700000,
      text,
    },
  };
}

function tapUpdate(updateId, cardMessageId, action = 'SaveToBrain', fromId = AUTH_ID) {
  return {
    update_id: updateId,
    callback_query: {
      id: `cb-${updateId}`,
      from: { id: Number(fromId) },
      data: action,
      message: { message_id: cardMessageId, chat: { id: Number(fromId) } },
    },
  };
}

// ── Wording SSOT: the handler's self-contained copy MUST equal the projection.
test('card copy parity: PENDING/WAITING texts are verbatim the receiptProjection status lines', () => {
  const accepted = projectCard({ state: STATES.ACCEPTED });
  const offlineQueued = projectCard({ state: STATES.OFFLINE_QUEUED });
  assert.equal(PENDING_CARD_TEXT, accepted.status_line);
  assert.equal(WAITING_CARD_TEXT, offlineQueued.status_line);
  assert.deepEqual(
    ACTION_KEYBOARD.inline_keyboard[0].map((b) => b.callback_data),
    ['SaveToBrain', 'AskLarry', 'KeepRaw'],
    'keyboard actions match the WP0 adapters',
  );
});

// U1 — non-POST.
test('U1: non-POST → 405, rpc never called', async () => {
  const { deps, calls } = makeDeps();
  for (const method of ['GET', 'PUT', 'DELETE', 'HEAD', undefined]) {
    const res = await handleTelegramWebhook({ method, headers: {}, bodyText: '' }, deps);
    assert.equal(res.status, 405);
  }
  assert.equal(calls.rpc.length, 0);
  assert.equal(calls.telegram.length, 0);
});

// U2 — secret-token gate.
test('U2: missing/wrong/empty secret header → 401, no rpc, secret-free log; constant-time compare is content-independent', async () => {
  const { deps, calls } = makeDeps();
  const cases = [
    { headers: {} },
    { headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong-value' } },
    { headers: { 'x-telegram-bot-api-secret-token': '' } },
    { headers: { 'X-Telegram-Bot-Api-Secret-Token': `${CANARY_SECRET}-suffixed` } },
  ];
  for (const c of cases) {
    const res = await handleTelegramWebhook(
      { method: 'POST', headers: c.headers, bodyText: JSON.stringify(textUpdate(1, 1, 'x')) },
      deps,
    );
    assert.equal(res.status, 401);
  }
  assert.equal(calls.rpc.length, 0, 'no DB touch before auth');
  // Fail-closed on missing CONFIGURED secret too (deployment fault ≠ open door).
  const { deps: noSecretDeps, calls: noSecretCalls } = makeDeps();
  noSecretDeps.secret = '';
  const res = await handleTelegramWebhook(post(textUpdate(1, 1, 'x')), noSecretDeps);
  assert.equal(res.status, 401, 'empty configured secret fails closed');
  assert.equal(noSecretCalls.rpc.length, 0);
  // Log lines carry no secret material (full sweep is U13).
  for (const line of calls.logs) {
    assert.ok(!JSON.stringify(line).includes(CANARY_SECRET));
  }
  // The compare primitive: equal→true, unequal (any length)→false.
  assert.equal(await timingSafeEqualStrings('abc', 'abc'), true);
  assert.equal(await timingSafeEqualStrings('abc', 'abd'), false);
  assert.equal(await timingSafeEqualStrings('abc', 'abcdefgh'), false);
});

// U2b — L-3: auth runs BEFORE the body is read. An unauthenticated request must
// never invoke the lazy body reader, so it cannot buffer/parse a body, touch the
// DB, send a card, or write anything durable. Proven with a readBody SPY.
test('U2b: unauthenticated request never reads the body (L-3) — readBody spy uncalled, zero rpc, zero telegram, 401', async () => {
  const unauthHeaderCases = [
    {},
    { 'X-Telegram-Bot-Api-Secret-Token': 'wrong-value' },
    { 'x-telegram-bot-api-secret-token': '' },
    { 'X-Telegram-Bot-Api-Secret-Token': `${CANARY_SECRET}-suffixed` },
  ];
  for (const headers of unauthHeaderCases) {
    const { deps, calls } = makeDeps();
    let readCalls = 0;
    const readBody = async () => {
      readCalls += 1;
      return JSON.stringify(textUpdate(1, 1, 'x'));
    };
    const res = await handleTelegramWebhook({ method: 'POST', headers, readBody }, deps);
    assert.equal(res.status, 401, `headers=${JSON.stringify(headers)} → 401`);
    assert.equal(readCalls, 0, 'the body reader MUST NOT be invoked before auth passes');
    assert.equal(calls.rpc.length, 0, 'no DB call before auth');
    assert.equal(calls.telegram.length, 0, 'no card send before auth');
  }
  // Missing CONFIGURED secret (deployment fault) also fails closed WITHOUT reading.
  {
    const { deps, calls } = makeDeps();
    deps.secret = '';
    let readCalls = 0;
    const res = await handleTelegramWebhook(
      { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': CANARY_SECRET }, readBody: async () => { readCalls += 1; return '{}'; } },
      deps,
    );
    assert.equal(res.status, 401, 'empty configured secret fails closed');
    assert.equal(readCalls, 0, 'no body read when the configured secret is missing');
    assert.equal(calls.rpc.length, 0);
  }
  // Non-POST also short-circuits before any read (method gate is first).
  {
    const { deps } = makeDeps();
    let readCalls = 0;
    const res = await handleTelegramWebhook(
      { method: 'GET', headers: {}, readBody: async () => { readCalls += 1; return '{}'; } },
      deps,
    );
    assert.equal(res.status, 405);
    assert.equal(readCalls, 0, 'non-POST never reads the body');
  }
  // POSITIVE CONTROL: an AUTHED request DOES invoke the lazy reader exactly once,
  // and the lazy path drives normal processing (this is the path index.ts uses).
  {
    const { deps, calls } = makeDeps({
      rpcOutcomes: {
        fcg_webhook_intake: { outcome: 'new', capture_id: 'cap-lazy' },
        fcg_webhook_card_ref: { outcome: 'ok' },
      },
    });
    let readCalls = 0;
    const readBody = async () => {
      readCalls += 1;
      return JSON.stringify(textUpdate(800, 40, 'lazy read works'));
    };
    const res = await handleTelegramWebhook(
      { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': CANARY_SECRET }, readBody },
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(readCalls, 1, 'authed request reads the body exactly once via the lazy reader');
    assert.equal(calls.rpc.filter((c) => c.fn === 'fcg_webhook_intake').length, 1, 'lazy path drives the intake RPC');
  }
});

// U3 — malformed JSON.
test('U3: correct token, malformed JSON body → 200 ignored, no rpc (never a retry loop on garbage)', async () => {
  const { deps, calls } = makeDeps();
  for (const bodyText of ['{not json', '', 'null', '"a string"']) {
    const res = await handleTelegramWebhook(
      { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': CANARY_SECRET }, bodyText },
      deps,
    );
    assert.equal(res.status, 200, `bodyText=${JSON.stringify(bodyText)} must not 5xx`);
    assert.equal(res.body.ignored, true);
  }
  assert.equal(calls.rpc.length, 0);
});

// U4 — unknown update kind.
test('U4: unknown update kind → 200 ignored, no rpc call (WP1 decision: do not ledger noise)', async () => {
  const { deps, calls } = makeDeps();
  const res = await handleTelegramWebhook(
    post({ update_id: 42, edited_message: { message_id: 7, text: 'edited' } }),
    deps,
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ignored, true);
  assert.equal(res.body.reason, 'unknown_update_kind');
  assert.equal(calls.rpc.length, 0);
  // Non-text message (photo): message kind, no usable text → ignored, no rpc,
  // and NO outbound notice (no existence-oracle for unverified senders).
  const res2 = await handleTelegramWebhook(
    post({ update_id: 43, message: { message_id: 8, from: { id: 5 }, photo: [{}] } }),
    deps,
  );
  assert.equal(res2.status, 200);
  assert.equal(res2.body.reason, 'unsupported_content_type');
  assert.equal(calls.rpc.length, 0);
  assert.equal(calls.telegram.length, 0);
});

// U5 — exact intake args.
test('U5: text message → exactly one fcg_webhook_intake call with the exact arg snapshot', async () => {
  const { deps, calls } = makeDeps({
    rpcOutcomes: {
      fcg_webhook_intake: { outcome: 'new', capture_id: 'cap-1' },
      fcg_webhook_card_ref: { outcome: 'ok' },
    },
  });
  const text = 'wp1 exact args';
  await handleTelegramWebhook(post(textUpdate(700, 31, text)), deps);
  const intakes = calls.rpc.filter((c) => c.fn === 'fcg_webhook_intake');
  assert.equal(intakes.length, 1, 'exactly one intake RPC per update');
  const expected = await deriveTelegramTextKeys({ senderId: AUTH_ID, messageId: 31, text });
  assert.deepEqual(intakes[0].args, {
    p_channel: 'telegram',
    p_update_id: 700,
    p_sender_principal: AUTH_ID, // bare numeric principal, as text
    p_idempotency_key: expected.idempotencyKey,
    p_capture_id: expected.captureId,
    p_recorded_intent: 'SaveToBrain',
    p_technical_source_type: 'text',
    p_payload_text: text,
    p_text_preview: text,
    p_channel_context: { chat_id: AUTH_ID, message_id: 31 },
    p_captured_at: new Date(1752700000 * 1000).toISOString(),
  });
});

// U6 — new → card → card_ref, in order.
test('U6: outcome new → sendMessage(pending copy + keyboard) then fcg_webhook_card_ref with the returned coordinates → 200', async () => {
  const { deps, calls } = makeDeps({
    rpcOutcomes: {
      fcg_webhook_intake: { outcome: 'new', capture_id: 'cap-new-1' },
      fcg_webhook_card_ref: { outcome: 'ok' },
    },
  });
  const res = await handleTelegramWebhook(post(textUpdate(701, 32, 'fresh capture')), deps);
  assert.equal(res.status, 200);
  const send = calls.telegram.find((c) => c.method === 'sendMessage');
  assert.ok(send, 'the pending card was sent');
  assert.equal(send.payload.text, PENDING_CARD_TEXT);
  assert.deepEqual(send.payload.reply_markup, ACTION_KEYBOARD);
  assert.equal(send.payload.chat_id, AUTH_ID);
  const order = [...calls.rpc.map((c) => `rpc:${c.fn}`)];
  assert.deepEqual(order, ['rpc:fcg_webhook_intake', 'rpc:fcg_webhook_card_ref'], 'intake, then card_ref — card send between them');
  const ref = calls.rpc.find((c) => c.fn === 'fcg_webhook_card_ref');
  assert.deepEqual(ref.args, { p_capture_id: 'cap-new-1', p_chat_id: AUTH_ID, p_message_id: '9001' });
});

// U7 — duplicate/existing reconciliation branches.
test('U7: duplicate/existing with has_card_ref:false → card re-sent + card_ref persisted; with true → no send; erased (null capture_id) → no send', async () => {
  for (const outcome of ['duplicate', 'existing']) {
    // (a) card missing → reconcile.
    let h = makeDeps({
      rpcOutcomes: {
        fcg_webhook_intake: { outcome, capture_id: 'cap-x', has_card_ref: false },
        fcg_webhook_card_ref: { outcome: 'ok' },
      },
    });
    let res = await handleTelegramWebhook(post(textUpdate(710, 33, 'again')), h.deps);
    assert.equal(res.status, 200);
    assert.equal(h.calls.telegram.filter((c) => c.method === 'sendMessage').length, 1, `${outcome}: reconciliation re-sends the card`);
    assert.equal(h.calls.rpc.filter((c) => c.fn === 'fcg_webhook_card_ref').length, 1, `${outcome}: card_ref persisted`);

    // (b) card already delivered → nothing to do.
    h = makeDeps({
      rpcOutcomes: { fcg_webhook_intake: { outcome, capture_id: 'cap-x', has_card_ref: true } },
    });
    res = await handleTelegramWebhook(post(textUpdate(711, 33, 'again')), h.deps);
    assert.equal(res.status, 200);
    assert.equal(h.calls.telegram.length, 0, `${outcome}: no second card when card_ref exists`);
  }
  // (c) ledger row survived an erasure (capture_id null) → honour erasure: no card.
  const h = makeDeps({
    rpcOutcomes: { fcg_webhook_intake: { outcome: 'duplicate', capture_id: null, has_card_ref: false } },
  });
  const res = await handleTelegramWebhook(post(textUpdate(712, 34, 'erased twin')), h.deps);
  assert.equal(res.status, 200);
  assert.equal(h.calls.telegram.length, 0, 'no card for an erased capture');
});

// U8 — fail-closed outcomes.
test('U8: unauthorised / rate_limited → 200, no card, secret-free log (fail-closed + no retry-spam)', async () => {
  for (const outcome of ['unauthorised', 'rate_limited']) {
    const { deps, calls } = makeDeps({ rpcOutcomes: { fcg_webhook_intake: { outcome } } });
    const res = await handleTelegramWebhook(post(textUpdate(720, 35, 'stranger danger', '666666')), deps);
    assert.equal(res.status, 200, `${outcome} must be 200 (Telegram must not retry-spam)`);
    assert.equal(calls.telegram.length, 0, `${outcome}: no card, no oracle`);
    const logged = calls.logs.find((l) => l.event === `intake_${outcome}`);
    assert.ok(logged, `${outcome}: counter-style log line present`);
    assert.ok(!JSON.stringify(calls.logs).includes(CANARY_SECRET), 'log is secret-free');
    assert.ok(!JSON.stringify(calls.logs).includes('stranger danger'), 'log never carries payload text');
  }
});

// U9 — DB down.
test('U9: rpc throws (DB down) → 500 so Telegram redelivers; nothing else attempted', async () => {
  const { deps, calls } = makeDeps({ rpcError: new Error('connection refused') });
  const res = await handleTelegramWebhook(post(textUpdate(730, 36, 'durable?')), deps);
  assert.equal(res.status, 500);
  assert.equal(calls.telegram.length, 0, 'no card on a failed commit — never a false receipt');
  // Callback path too: rpc failure → 500.
  const res2 = await handleTelegramWebhook(post(tapUpdate(731, 9001)), deps);
  assert.equal(res2.status, 500);
});

// U10 — callback outcome → answer/edit wording.
test('U10: callback outcomes map to the verbatim runner/projection wording', async () => {
  // queued → answer "Saving…" + edit to the honest waiting copy.
  let h = makeDeps({ rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'queued', capture_id: 'cap-q' } } });
  let res = await handleTelegramWebhook(post(tapUpdate(740, 9001)), h.deps);
  assert.equal(res.status, 200);
  let answer = h.calls.telegram.find((c) => c.method === 'answerCallbackQuery');
  assert.equal(answer.payload.text, 'Saving to your Brain…');
  const edit = h.calls.telegram.find((c) => c.method === 'editMessageText');
  assert.equal(edit.payload.text, WAITING_CARD_TEXT, 'waiting copy is the queued/offline status line — never a completion claim');
  assert.equal(edit.payload.message_id, 9001, 'edits the ORIGINAL card');

  // already_completed.
  h = makeDeps({ rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'already_completed', capture_id: 'cap-c' } } });
  await handleTelegramWebhook(post(tapUpdate(741, 9001)), h.deps);
  answer = h.calls.telegram.find((c) => c.method === 'answerCallbackQuery');
  assert.equal(answer.payload.text, 'Already saved to your Brain.');
  assert.ok(!h.calls.telegram.some((c) => c.method === 'editMessageText'), 'completed card is left as-is');

  // no_op (in flight) + duplicate_update (redelivered tap).
  for (const outcome of ['no_op', 'duplicate_update']) {
    h = makeDeps({ rpcOutcomes: { fcg_webhook_confirm_tap: { outcome } } });
    await handleTelegramWebhook(post(tapUpdate(742, 9001)), h.deps);
    answer = h.calls.telegram.find((c) => c.method === 'answerCallbackQuery');
    assert.equal(answer.payload.text, 'Already in progress — nothing to do.');
  }

  // not_found.
  h = makeDeps({ rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'not_found' } } });
  await handleTelegramWebhook(post(tapUpdate(743, 424)), h.deps);
  answer = h.calls.telegram.find((c) => c.method === 'answerCallbackQuery');
  assert.equal(answer.payload.text, 'No capture found for this card.');

  // unavailable_action → must-see pop-up (show_alert), capture stays pending.
  h = makeDeps({ rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'unavailable_action', action: 'KeepRaw' } } });
  await handleTelegramWebhook(post(tapUpdate(744, 9001, 'KeepRaw')), h.deps);
  answer = h.calls.telegram.find((c) => c.method === 'answerCallbackQuery');
  assert.equal(answer.payload.text, 'Not available in WP0 — your capture stays pending.');
  assert.equal(answer.payload.show_alert, true);

  // unauthorised → default-deny SILENCE (no answer at all).
  h = makeDeps({ rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'unauthorised' } } });
  res = await handleTelegramWebhook(post(tapUpdate(745, 9001, 'SaveToBrain', '666666')), h.deps);
  assert.equal(res.status, 200);
  assert.equal(h.calls.telegram.length, 0, 'no callback answer for a stranger');
});

// U11 — card send failure after durable intake.
test('U11: card send fails after outcome new → 500 (Telegram redelivery is the card-retry loop)', async () => {
  const { deps, calls } = makeDeps({
    rpcOutcomes: { fcg_webhook_intake: { outcome: 'new', capture_id: 'cap-n' } },
    sendMessageError: new Error('telegram sendMessage rejected: http_502'),
    sendMessageErrorTimes: -1, // always
  });
  const res = await handleTelegramWebhook(post(textUpdate(750, 37, 'card will fail')), deps);
  assert.equal(res.status, 500, 'no ledger-consumed success without a delivered card path');
  assert.equal(calls.rpc.filter((c) => c.fn === 'fcg_webhook_card_ref').length, 0, 'card_ref not persisted for an unsent card');
  // card_ref persist failure after a successful send is ALSO a 500 (same lever).
  const h2 = makeDeps({
    rpcOutcomes: {
      fcg_webhook_intake: { outcome: 'new', capture_id: 'cap-n2' },
      fcg_webhook_card_ref: () => { throw new Error('rpc down mid-flight'); },
    },
  });
  const res2 = await handleTelegramWebhook(post(textUpdate(751, 38, 'ref will fail')), h2.deps);
  assert.equal(res2.status, 500);
});

// Projection failures on the TAP path do not 500 (state already committed).
test('tap-path projection failures (answer/edit) are swallowed with a log — the durable transition stands, 200 returned', async () => {
  const { deps, calls } = makeDeps({ rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'queued', capture_id: 'cap-q2' } } });
  deps.telegram.answerCallbackQuery = async () => { throw new Error('query is too old'); };
  deps.telegram.editMessageText = async () => { throw new Error('message is not modified'); };
  const res = await handleTelegramWebhook(post(tapUpdate(760, 9001)), deps);
  assert.equal(res.status, 200, 'a 500 here would redeliver a tap whose ledger slot is already consumed');
  assert.ok(calls.logs.some((l) => l.event === 'answer_callback_failed'));
  assert.ok(calls.logs.some((l) => l.event === 'waiting_card_edit_failed'));
});

// U13 — secret-safe logging sweep across EVERY path.
test('U13: no handler path ever emits the canary secret or bot token in logs or response bodies', async () => {
  const scenarios = [
    // [request, deps overrides]
    [{ method: 'GET', headers: {}, bodyText: '' }, {}],
    [post(textUpdate(1, 1, 'x'), { secret: 'wrong' }), {}],
    [{ method: 'POST', headers: { 'x-telegram-bot-api-secret-token': CANARY_SECRET }, bodyText: '{broken' }, {}],
    [post({ update_id: 2, my_chat_member: {} }), {}],
    [post(textUpdate(3, 2, 'new capture')), { rpcOutcomes: { fcg_webhook_intake: { outcome: 'new', capture_id: 'c1' }, fcg_webhook_card_ref: { outcome: 'ok' } } }],
    [post(textUpdate(4, 3, 'dup')), { rpcOutcomes: { fcg_webhook_intake: { outcome: 'duplicate', capture_id: 'c1', has_card_ref: true } } }],
    [post(textUpdate(5, 4, 'nope', '777')), { rpcOutcomes: { fcg_webhook_intake: { outcome: 'unauthorised' } } }],
    [post(textUpdate(6, 5, 'flood')), { rpcOutcomes: { fcg_webhook_intake: { outcome: 'rate_limited' } } }],
    // rpc error message deliberately CONTAINS the canary secrets — the handler
    // must not be the layer that leaks them onward in the response body.
    [post(textUpdate(7, 6, 'err')), { rpcError: new Error(`db said ${CANARY_SECRET} and ${CANARY_BOT_TOKEN}`) }],
    [post(tapUpdate(8, 9001)), { rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'queued', capture_id: 'c1' } } }],
    [post(tapUpdate(9, 9001, 'KeepRaw')), { rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'unavailable_action' } } }],
    [post(tapUpdate(10, 9001)), { rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'already_completed' } } }],
    [post(tapUpdate(11, 9001)), { rpcOutcomes: { fcg_webhook_confirm_tap: { outcome: 'not_found' } } }],
  ];
  for (const [request, overrides] of scenarios) {
    const { deps, calls } = makeDeps(overrides);
    const res = await handleTelegramWebhook(request, deps);
    const responseText = JSON.stringify(res.body ?? {});
    assert.ok(!responseText.includes(CANARY_SECRET), `response body leaked the webhook secret (status ${res.status})`);
    assert.ok(!responseText.includes(CANARY_BOT_TOKEN), `response body leaked the bot token (status ${res.status})`);
    for (const line of calls.logs) {
      const s = JSON.stringify(line);
      assert.ok(!s.includes(CANARY_SECRET), `log line leaked the webhook secret: ${s}`);
    }
  }
});
