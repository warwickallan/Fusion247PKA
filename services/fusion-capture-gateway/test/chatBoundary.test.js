// BUILD-002 WP1 — the private-direct-chat boundary (GPT-BUILD-002-WP1-REVIEW-0001
// correction 3), proven on BOTH transports through the ONE shared predicate
// (supabase/functions/fcg-webhook-intake/chatBoundary.js):
//   * poll    — src/adapters/telegramMapping.js (mapTelegramUpdate / …CallbackQuery)
//   * webhook — supabase/functions/fcg-webhook-intake/handler.js
// Aligned cases + an explicit assertion that the two give the SAME verdict for
// the same chat context. Hermetic: no network, no DB, no Deno.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isPrivateDirectChat } from '../../../supabase/functions/fcg-webhook-intake/chatBoundary.js';
import { handleTelegramWebhook } from '../../../supabase/functions/fcg-webhook-intake/handler.js';
import { mapTelegramUpdate, mapTelegramCallbackQuery } from '../src/adapters/telegramMapping.js';

const AUTH_ID = '424242';
const STRANGER_ID = '999999';
const CANARY_SECRET = 'canary~webhook~secret~value~cb01';
const NOW = 1_700_000_000_000;

// ── The predicate in isolation. ──────────────────────────────────────────────
test('isPrivateDirectChat: only a private chat whose id === senderId passes', () => {
  assert.equal(isPrivateDirectChat({ chat: { id: 42, type: 'private' }, senderId: 42 }), true);
  assert.equal(isPrivateDirectChat({ chat: { id: '42', type: 'private' }, senderId: 42 }), true, 'string/number id coerced');
  assert.equal(isPrivateDirectChat({ chat: { id: 42, type: 'group' }, senderId: 42 }), false);
  assert.equal(isPrivateDirectChat({ chat: { id: 42, type: 'supergroup' }, senderId: 42 }), false);
  assert.equal(isPrivateDirectChat({ chat: { id: 42, type: 'channel' }, senderId: 42 }), false);
  assert.equal(isPrivateDirectChat({ chat: { id: -100200, type: 'private' }, senderId: 42 }), false, 'private but id != sender (spoofed) rejected');
  assert.equal(isPrivateDirectChat({ chat: undefined, senderId: 42 }), false, 'missing chat rejected');
  assert.equal(isPrivateDirectChat({ chat: {}, senderId: 42 }), false, 'malformed chat (no type/id) rejected');
  assert.equal(isPrivateDirectChat({ chat: { id: 42, type: 'private' }, senderId: undefined }), false, 'missing sender rejected');
});

// ── Fixtures shaped like the two transports. ─────────────────────────────────
function msgUpdate(chat, { fromId = AUTH_ID, text = 'private note' } = {}) {
  return { update_id: 900, message: { message_id: 51, from: { id: Number(fromId) }, chat, date: 1752700000, text } };
}
function tapUpdate(chat, { fromId = AUTH_ID } = {}) {
  return { update_id: 901, callback_query: { id: 'cb-1', from: { id: Number(fromId) }, data: 'SaveToBrain', message: { message_id: 9001, chat } } };
}

const PRIVATE = { id: Number(AUTH_ID), type: 'private' };
const GROUP = { id: -100123, type: 'group' };
const SUPERGROUP = { id: -100456, type: 'supergroup' };
const CHANNEL = { id: -100789, type: 'channel' };
const STRANGER_PRIVATE = { id: Number(STRANGER_ID), type: 'private' };

// Webhook driver: records rpc/telegram; returns a compact verdict.
function webhookDeps() {
  const calls = { rpc: [], telegram: [], logs: [] };
  const deps = {
    secret: CANARY_SECRET,
    log: (e) => calls.logs.push(e),
    rpc: async (fn, args) => {
      calls.rpc.push({ fn, args });
      if (fn === 'fcg_webhook_intake') return { outcome: 'unauthorised' }; // stranger path; overridden below for AUTH
      return { outcome: 'unauthorised' };
    },
    telegram: {
      sendMessage: async (p) => { calls.telegram.push({ method: 'sendMessage', payload: p }); return { ok: true, result: { message_id: 1 } }; },
      editMessageText: async (p) => { calls.telegram.push({ method: 'editMessageText', payload: p }); return { ok: true }; },
      answerCallbackQuery: async (p) => { calls.telegram.push({ method: 'answerCallbackQuery', payload: p }); return { ok: true }; },
    },
  };
  return { deps, calls };
}

function post(update) {
  return { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': CANARY_SECRET }, bodyText: JSON.stringify(update) };
}

async function webhookVerdict(update) {
  const { deps, calls } = webhookDeps();
  const res = await handleTelegramWebhook(post(update), deps);
  const refused = res.body && res.body.ignored === true && res.body.reason === 'non_private_chat';
  return { res, calls, refused, reachedRpc: calls.rpc.length > 0, sentAnything: calls.telegram.length > 0 };
}

// ── Message path: webhook. ───────────────────────────────────────────────────
test('webhook message: authorised private chat is accepted (reaches the intake RPC)', async () => {
  const { res, reachedRpc } = await webhookVerdict(msgUpdate(PRIVATE));
  assert.equal(res.status, 200);
  assert.equal(reachedRpc, true, 'a private message reaches the allowlist RPC');
});

for (const [name, chat] of [['group', GROUP], ['supergroup', SUPERGROUP], ['channel', CHANNEL], ['missing', undefined], ['malformed', {}]]) {
  test(`webhook message: ${name} chat → refused, ZERO rpc, ZERO telegram, quiet ignored`, async () => {
    const { res, refused, reachedRpc, sentAnything } = await webhookVerdict(msgUpdate(chat));
    assert.equal(res.status, 200, 'quiet 200, no retry-spam');
    assert.equal(refused, true, 'non_private_chat default-deny');
    assert.equal(reachedRpc, false, 'no DB touch: zero envelope/queue/ledger rows');
    assert.equal(sentAnything, false, 'no card, no oracle');
  });
}

test('webhook message: stranger in a private chat → passes the chat gate, refused by the RPC allowlist (layer-2 default-deny preserved)', async () => {
  const { reachedRpc, sentAnything, res } = await webhookVerdict(msgUpdate(STRANGER_PRIVATE, { fromId: STRANGER_ID, text: 'let me in' }));
  assert.equal(res.status, 200);
  assert.equal(reachedRpc, true, 'a genuine private chat still reaches the RPC — the RPC owns the sender allowlist');
  assert.equal(sentAnything, false, 'the RPC returns unauthorised → no card, zero rows');
});

// ── Callback path: webhook. ──────────────────────────────────────────────────
test('webhook callback: authorised private chat reaches the confirm RPC; non-private is refused with zero rpc/telegram', async () => {
  const okv = await webhookVerdict(tapUpdate(PRIVATE));
  assert.equal(okv.reachedRpc, true, 'private tap reaches fcg_webhook_confirm_tap');
  for (const chat of [GROUP, SUPERGROUP, CHANNEL, undefined, {}]) {
    const v = await webhookVerdict(tapUpdate(chat));
    assert.equal(v.res.status, 200);
    assert.equal(v.refused, true, 'callback from a non-private chat is refused');
    assert.equal(v.reachedRpc, false, 'no confirm RPC for a non-private callback');
    assert.equal(v.sentAnything, false, 'no answer/edit for a non-private callback');
  }
});

// ── Poll path: mapping verdict for the SAME contexts. ────────────────────────
function pollMsgVerdict(chat, fromId = AUTH_ID) {
  const r = mapTelegramUpdate({ update: msgUpdate(chat, { fromId }), now: NOW, authorisedUserId: AUTH_ID });
  return r;
}
function pollTapVerdict(chat, fromId = AUTH_ID) {
  return mapTelegramCallbackQuery({ update: tapUpdate(chat, { fromId }), now: NOW, authorisedUserId: AUTH_ID });
}

test('poll message: authorised private accepted; group/supergroup/channel/missing refused as non_private_chat', () => {
  assert.equal(pollMsgVerdict(PRIVATE).ok, true);
  for (const chat of [GROUP, SUPERGROUP, CHANNEL, undefined, {}]) {
    const r = pollMsgVerdict(chat);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'non_private_chat', 'poll path refuses non-private with zero envelope');
  }
});

test('poll: stranger in private chat → unauthorised_sender (allowlist first, no chat oracle)', () => {
  assert.equal(pollMsgVerdict(STRANGER_PRIVATE, STRANGER_ID).reason, 'unauthorised_sender');
  assert.equal(pollTapVerdict(STRANGER_PRIVATE, STRANGER_ID).reason, 'unauthorised_sender');
});

test('poll callback: authorised private accepted; non-private refused', () => {
  assert.equal(pollTapVerdict(PRIVATE).ok, true);
  for (const chat of [GROUP, SUPERGROUP, CHANNEL, undefined, {}]) {
    assert.equal(pollTapVerdict(chat).ok, false);
    assert.equal(pollTapVerdict(chat).reason, 'non_private_chat');
  }
});

// ── THE PARITY ASSERTION: poll and webhook agree per chat context. ───────────
test('poll and webhook give the SAME verdict for the same chat context (authorised sender)', async () => {
  const contexts = [
    ['private', PRIVATE, true],
    ['group', GROUP, false],
    ['supergroup', SUPERGROUP, false],
    ['channel', CHANNEL, false],
    ['missing', undefined, false],
    ['malformed', {}, false],
  ];
  for (const [name, chat, expectedAccept] of contexts) {
    const poll = pollMsgVerdict(chat).ok;
    const web = (await webhookVerdict(msgUpdate(chat))).reachedRpc;
    assert.equal(poll, expectedAccept, `poll verdict for ${name}`);
    assert.equal(web, expectedAccept, `webhook verdict for ${name}`);
    assert.equal(poll, web, `poll and webhook MUST agree for ${name}`);

    // Callback path parity too.
    const pollCb = pollTapVerdict(chat).ok;
    const webCb = (await webhookVerdict(tapUpdate(chat))).reachedRpc;
    assert.equal(pollCb, expectedAccept, `poll callback verdict for ${name}`);
    assert.equal(webCb, expectedAccept, `webhook callback verdict for ${name}`);
    assert.equal(pollCb, webCb, `poll and webhook callback MUST agree for ${name}`);
  }
});
