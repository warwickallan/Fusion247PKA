// LIVE Telegram adapter — real Bot API request shape, secret masking, F-10
// webhook authenticity. Hermetic: INJECTED mock fetchImpl, throwaway fake token,
// NO real network.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createLiveTelegramAdapter, maskToken } from '../src/adapters/telegramLiveAdapter.js';

const AUTH_ID = 424242;
// Obviously-fake token: 3-digit prefix does NOT match the scanner's Telegram
// VALUE pattern (needs 6+ digits) — safe to keep as a literal inside a test.
const FAKE_TOKEN = '123:AA-FAKE-not-a-real-token';
const API_BASE = 'https://api.telegram.example';

// A mock fetch recording every call; returns a Telegram-shaped ok response.
function mockFetch(responder) {
  const calls = [];
  const fn = async (url, init) => {
    const body = init && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method, headers: init?.headers, body });
    const payload = (responder ? responder({ url, body }) : undefined)
      ?? { ok: true, result: { message_id: 555 } };
    return { status: 200, ok: true, json: async () => payload };
  };
  fn.calls = calls;
  return fn;
}

function adapter(fetchImpl, extra = {}) {
  return createLiveTelegramAdapter({
    botToken: FAKE_TOKEN,
    authorisedUserId: AUTH_ID,
    fetchImpl,
    apiBase: API_BASE,
    ...extra,
  });
}

test('sendCard builds a real sendMessage request with the action inline keyboard', async () => {
  const fetchImpl = mockFetch();
  const a = adapter(fetchImpl);
  const result = await a.sendCard('cap_1', { status_line: 'Saved and safe — waiting.', is_completed: false });

  assert.equal(fetchImpl.calls.length, 1);
  const call = fetchImpl.calls[0];
  assert.equal(call.method, 'POST');
  assert.equal(call.url, `${API_BASE}/bot${FAKE_TOKEN}/sendMessage`);
  assert.equal(call.body.chat_id, String(AUTH_ID));
  assert.equal(call.body.text, 'Saved and safe — waiting.');
  const buttons = call.body.reply_markup.inline_keyboard[0].map((b) => b.text);
  assert.deepEqual(buttons, ['Save to Brain', 'Ask Larry', 'Keep Raw']);
  assert.equal(result.result.message_id, 555, 'parsed Bot API result is returned');
});

test('editCard targets the tracked message_id and clears buttons when Completed', async () => {
  const fetchImpl = mockFetch();
  const a = adapter(fetchImpl);
  await a.sendCard('cap_2', { status_line: 'waiting', is_completed: false });
  await a.editCard('cap_2', { status_line: 'Completed — saved to your Brain.', is_completed: true });

  const edit = fetchImpl.calls[1];
  assert.equal(edit.url, `${API_BASE}/bot${FAKE_TOKEN}/editMessageText`);
  assert.equal(edit.body.message_id, 555, 'edits the remembered card message');
  assert.equal(edit.body.chat_id, String(AUTH_ID));
  assert.equal(edit.body.text, 'Completed — saved to your Brain.');
  assert.deepEqual(edit.body.reply_markup.inline_keyboard, [], 'completed card drops action buttons');
});

test('completed editCard passes the projection parse_mode so the path renders as monospace (no auto-link)', async () => {
  const fetchImpl = mockFetch();
  const a = adapter(fetchImpl);
  await a.sendCard('cap_pm', { status_line: 'waiting', is_completed: false });
  await a.editCard('cap_pm', {
    status_line: 'Completed — saved to your Brain (`C:\\repo\\Team Inbox\\captures\\cap_pm.md`).',
    is_completed: true,
    parse_mode: 'Markdown',
  });

  const send = fetchImpl.calls[0];
  assert.equal(send.body.parse_mode, undefined, 'pending card carries NO parse_mode');
  const edit = fetchImpl.calls[1];
  assert.equal(edit.body.parse_mode, 'Markdown', 'completed card carries the projection parse_mode');
  assert.match(edit.body.text, /\(`[^`]+\.md`\)/, 'destination path is backtick-wrapped in the wire text');
});

test('sendMessage sends a plain notice — no reply_markup, no parse_mode', async () => {
  const fetchImpl = mockFetch();
  const a = adapter(fetchImpl);
  await a.sendMessage(String(AUTH_ID), 'Text only in WP0 — photos/voice arrive in a later work package.');

  assert.equal(fetchImpl.calls.length, 1);
  const call = fetchImpl.calls[0];
  assert.equal(call.url, `${API_BASE}/bot${FAKE_TOKEN}/sendMessage`);
  assert.equal(call.body.chat_id, String(AUTH_ID));
  assert.match(call.body.text, /Text only in WP0/);
  assert.equal(call.body.reply_markup, undefined, 'a plain notice has no buttons');
  assert.equal(call.body.parse_mode, undefined, 'a plain notice has no parse mode');
});

test('answerCallbackQuery: show_alert lands on the wire ONLY when asked (pop-up vs subtle toast)', async () => {
  const fetchImpl = mockFetch();
  const a = adapter(fetchImpl);
  // Default: subtle toast — NO show_alert field at all.
  await a.answerCallbackQuery('cb-1', 'Saving to your Brain…');
  // Must-see answer (live phone finding 2026-07-17: plain toasts are invisible
  // in practice): dismissable pop-up via show_alert: true.
  await a.answerCallbackQuery('cb-2', 'Not available in WP0 — your capture stays pending.', { showAlert: true });

  const subtle = fetchImpl.calls[0];
  assert.equal(subtle.url, `${API_BASE}/bot${FAKE_TOKEN}/answerCallbackQuery`);
  assert.equal(subtle.body.callback_query_id, 'cb-1');
  assert.equal(subtle.body.show_alert, undefined, 'default ack carries NO show_alert');

  const popup = fetchImpl.calls[1];
  assert.equal(popup.body.callback_query_id, 'cb-2');
  assert.equal(popup.body.show_alert, true, 'must-see answer is a dismissable pop-up');
  assert.match(popup.body.text, /Not available in WP0/);
});

test('editCard before sendCard is refused (no known message id)', async () => {
  const a = adapter(mockFetch());
  await assert.rejects(() => a.editCard('cap_unknown', { status_line: 'x' }), /no known message_id/);
});

test('the bot token is masked in diagnostics and never leaks via describe()', () => {
  const a = adapter(mockFetch());
  const d = a.describe();
  assert.equal(d.bot_token, '123:***masked***');
  assert.ok(!JSON.stringify(d).includes('FAKE-not-a-real-token'), 'token body never in describe()');
  assert.equal(maskToken(FAKE_TOKEN), '123:***masked***');
  assert.equal(maskToken(''), '(unset)');
});

test('a Bot API error masks the token in the thrown message', async () => {
  const fetchImpl = mockFetch(() => ({ ok: false, description: 'Unauthorized' }));
  const a = adapter(fetchImpl);
  await assert.rejects(
    () => a.sendCard('cap_e', { status_line: 'x', is_completed: false }),
    (err) => {
      assert.ok(/Unauthorized/.test(err.message));
      assert.ok(!err.message.includes('FAKE-not-a-real-token'), 'token body never in error');
      return true;
    },
  );
});

test('toEnvelope default-denies an unauthorised sender and logs the rejection', () => {
  const records = [];
  const a = adapter(mockFetch(), { accessLog: { authRejection: (r) => records.push(r) } });
  const denied = a.toEnvelope({ message: { message_id: 1, from: { id: 999 }, text: 'hi' } }, { now: 1000 });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'unauthorised_sender');
  assert.equal(a.rejections.length, 1);
  assert.equal(records.length, 1, 'auth rejection went to the access log');
  assert.equal(records[0].principal, '999');
});

test('toEnvelope maps an authorised sender channel-neutrally', () => {
  const a = adapter(mockFetch());
  const ok = a.toEnvelope({ message: { message_id: 7, from: { id: AUTH_ID }, chat: { id: AUTH_ID, type: 'private' }, text: 'note this' } }, { now: 2000 });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.source_channel, 'telegram');
  assert.equal(ok.value.technical_source_type, 'text');
});

test('F-10 verifyWebhook: accept on exact match, reject on mismatch and on absence', () => {
  const a = adapter(mockFetch());
  const secret = 'webhook-secret-value';
  assert.equal(a.verifyWebhook({ 'X-Telegram-Bot-Api-Secret-Token': secret }, secret), true);
  // Case-insensitive header lookup.
  assert.equal(a.verifyWebhook({ 'x-telegram-bot-api-secret-token': secret }, secret), true);
  assert.equal(a.verifyWebhook({ 'X-Telegram-Bot-Api-Secret-Token': 'wrong' }, secret), false);
  assert.equal(a.verifyWebhook({}, secret), false, 'absent header → default-deny');
  assert.equal(a.verifyWebhook({ 'X-Telegram-Bot-Api-Secret-Token': secret }, ''), false, 'no configured secret → deny');
});

test('getUpdates long-polls via the token and returns the parsed updates array', async () => {
  const fetchImpl = mockFetch(({ url }) => (url.endsWith('/getUpdates')
    ? { ok: true, result: [{ update_id: 1 }, { update_id: 2 }] }
    : { ok: true, result: {} }));
  const a = adapter(fetchImpl);
  const updates = await a.getUpdates({ offset: 10, timeout: 5 });
  assert.equal(fetchImpl.calls[0].url, `${API_BASE}/bot${FAKE_TOKEN}/getUpdates`);
  assert.equal(fetchImpl.calls[0].body.offset, 10);
  assert.equal(updates.length, 2);
});
