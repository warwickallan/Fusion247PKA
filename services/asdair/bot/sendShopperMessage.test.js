// BUILD-015 AsdAIr bot — the outbound sender: unit tests.
// FULLY OFFLINE. Every test injects a fake fetch; nothing here touches the
// network, the filesystem or a database, and the token fixture is obviously fake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_API_BASE,
  SHOPPER_BOT_ENV,
  SHOPPER_BOT_SECRET_KEYS,
  createShopperSender,
  createShopperSenderFromEnv,
  loadSenderConfig,
  maskToken,
  maskTokenIn,
} from './sendShopperMessage.js';
import { renderReceipt } from './renderMessages.js';

// An obviously-fake token in the real shape. Never a real credential.
// Deliberately does NOT match the repo secret-scan's Telegram pattern
// ([0-9]{6,}:AA[A-Za-z0-9_-]{30,}) - the body must not begin "AA". A scanner
// cannot tell a fake token from a real one by shape, and it is right not to
// try, so the fixture is shaped to be unmistakably not-a-token while still
// exercising maskToken (which splits on the first colon).
const FAKE_TOKEN = '1234567890:TESTFIXTURE-not-a-real-telegram-token';
const REF = 'shop-2026-07-28';

/** A fake fetch that records every call and replies ok. */
function recordingFetch(reply = { ok: true, result: { message_id: 500 } }) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null });
    return { ok: true, status: 200, json: async () => reply };
  };
  impl.calls = calls;
  return impl;
}

// ── config + secret hygiene ──────────────────────────────────────────────────

test('the token is read from the environment BY NAME, and an absent token fails closed', () => {
  assert.equal(SHOPPER_BOT_ENV.SHOPPER_BOT_TOKEN, 'SHOPPER_BOT_TOKEN');
  assert.deepEqual([...SHOPPER_BOT_SECRET_KEYS], ['SHOPPER_BOT_TOKEN']);
  assert.throws(() => loadSenderConfig({}), /SHOPPER_BOT_TOKEN is required/);
  assert.throws(() => loadSenderConfig({ SHOPPER_BOT_TOKEN: '' }), /SHOPPER_BOT_TOKEN is required/);
});

test('loadSenderConfig defaults the API base and never invents a chat id', () => {
  const c = loadSenderConfig({ SHOPPER_BOT_TOKEN: FAKE_TOKEN });
  assert.equal(c.apiBase, DEFAULT_API_BASE);
  assert.equal(c.chatId, null);
});

test('maskToken keeps only the bot-id prefix; the secret body never survives', () => {
  assert.equal(maskToken(FAKE_TOKEN), '1234567890:***masked***');
  assert.equal(maskToken(''), '(unset)');
  assert.equal(maskToken(undefined), '(unset)');
  assert.equal(maskToken('nocolonhere'), '***masked***');
  assert.ok(!maskToken(FAKE_TOKEN).includes('TESTFIXTURE'));
});

test('maskTokenIn scrubs every occurrence of the token from a diagnostic string', () => {
  const leaky = `GET https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage failed (token ${FAKE_TOKEN})`;
  const masked = maskTokenIn(leaky, FAKE_TOKEN);
  assert.ok(!masked.includes(FAKE_TOKEN));
  assert.ok(!masked.includes('AAF-thisIsNot'));
});

test('describe() is log-safe: it NEVER returns the real token', () => {
  const sender = createShopperSender({ botToken: FAKE_TOKEN, fetchImpl: recordingFetch() });
  const d = JSON.stringify(sender.describe());
  assert.ok(!d.includes(FAKE_TOKEN));
  assert.ok(d.includes('***masked***'));

  const cfg = loadSenderConfig({ SHOPPER_BOT_TOKEN: FAKE_TOKEN, SHOPPER_CHAT_ID: '7' });
  const cd = JSON.stringify(cfg.describe());
  assert.ok(!cd.includes(FAKE_TOKEN));
  assert.equal(JSON.parse(cd).SHOPPER_CHAT_ID, '7');
});

test('NO TOKEN CAN ESCAPE IN AN ERROR: every failure path is masked', async () => {
  const paths = [
    // Telegram rejects and echoes the request URL back in its description.
    async () => {
      const sender = createShopperSender({
        botToken: FAKE_TOKEN,
        fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ ok: false, description: `Unauthorized for https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage` }) }),
      });
      await sender.sendMessage(7, renderReceipt({ shopRef: REF, source: 'text' }));
    },
    // The transport throws with the full URL in the message.
    async () => {
      const sender = createShopperSender({
        botToken: FAKE_TOKEN,
        fetchImpl: async () => { throw new Error(`connect ECONNREFUSED for /bot${FAKE_TOKEN}/sendMessage`); },
      });
      await sender.sendMessage(7, renderReceipt({ shopRef: REF, source: 'text' }));
    },
    // The response body is not JSON, and the parse error carries the URL.
    async () => {
      const sender = createShopperSender({
        botToken: FAKE_TOKEN,
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error(`bad json from /bot${FAKE_TOKEN}/`); } }),
      });
      await sender.sendMessage(7, renderReceipt({ shopRef: REF, source: 'text' }));
    },
    // editMessageText and answerCallbackQuery use the same masked path.
    async () => {
      const sender = createShopperSender({
        botToken: FAKE_TOKEN,
        fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ ok: false, description: FAKE_TOKEN }) }),
      });
      await sender.editMessageText(7, 500, renderReceipt({ shopRef: REF, source: 'text' }));
    },
    async () => {
      const sender = createShopperSender({
        botToken: FAKE_TOKEN,
        fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ ok: false, description: FAKE_TOKEN }) }),
      });
      await sender.answerCallbackQuery('cbq-1');
    },
  ];

  for (const run of paths) {
    let caught = null;
    try { await run(); } catch (err) { caught = err; }
    assert.ok(caught, 'expected a failure');
    const surface = `${caught.message}\n${caught.stack}`;
    assert.ok(!surface.includes(FAKE_TOKEN), `token leaked: ${caught.message}`);
    assert.ok(!surface.includes('AAF-thisIsNot'), `token body leaked: ${caught.message}`);
  }
});

test('NOTHING logs: the sender writes nothing to stdout/stderr on success or on failure', async () => {
  const written = [];
  const origOut = process.stdout.write;
  const origErr = process.stderr.write;
  process.stdout.write = (chunk, ...rest) => { written.push(String(chunk)); return origOut.call(process.stdout, chunk, ...rest); };
  process.stderr.write = (chunk, ...rest) => { written.push(String(chunk)); return origErr.call(process.stderr, chunk, ...rest); };
  try {
    const ok = createShopperSender({ botToken: FAKE_TOKEN, fetchImpl: recordingFetch() });
    await ok.sendMessage(7, renderReceipt({ shopRef: REF, source: 'text' }));
    const bad = createShopperSender({
      botToken: FAKE_TOKEN,
      fetchImpl: async () => { throw new Error(`boom /bot${FAKE_TOKEN}/x`); },
    });
    await bad.sendMessage(7, renderReceipt({ shopRef: REF, source: 'text' })).catch(() => {});
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
  const all = written.join('');
  assert.ok(!all.includes(FAKE_TOKEN), 'a token reached a stream');
  assert.ok(!all.includes('AAF-thisIsNot'), 'a token body reached a stream');
});

// ── the three methods ────────────────────────────────────────────────────────

test('sendMessage posts the rendered text and keyboard as PLAIN TEXT (no parse_mode)', async () => {
  const fetchImpl = recordingFetch();
  const sender = createShopperSender({ botToken: FAKE_TOKEN, fetchImpl });
  const card = renderReceipt({ shopRef: REF, source: 'telegram photo' });
  const result = await sender.sendMessage(7, card);

  assert.equal(fetchImpl.calls.length, 1);
  assert.ok(fetchImpl.calls[0].url.endsWith('/sendMessage'));
  const body = fetchImpl.calls[0].body;
  assert.equal(body.chat_id, 7);
  assert.equal(body.text, card.text);
  assert.deepEqual(body.reply_markup, card.reply_markup);
  assert.ok(!('parse_mode' in body), 'parse_mode must never be set — product names are not Markdown');
  assert.equal(result.message_id, 500);
});

test('editMessageText updates a card in place, and can strip the keyboard so it cannot be answered twice', async () => {
  const fetchImpl = recordingFetch({ ok: true, result: { message_id: 500, edited: true } });
  const sender = createShopperSender({ botToken: FAKE_TOKEN, fetchImpl });
  await sender.editMessageText(7, 500, { text: 'Answered: Yeo Valley Natural 500g', reply_markup: { inline_keyboard: [] } });

  const { url, body } = fetchImpl.calls[0];
  assert.ok(url.endsWith('/editMessageText'));
  assert.equal(body.chat_id, 7);
  assert.equal(body.message_id, 500);
  assert.equal(body.text, 'Answered: Yeo Valley Natural 500g');
  assert.deepEqual(body.reply_markup, { inline_keyboard: [] });
});

test('answerCallbackQuery stops the button spinning, and caps its toast text', async () => {
  const fetchImpl = recordingFetch({ ok: true, result: true });
  const sender = createShopperSender({ botToken: FAKE_TOKEN, fetchImpl });
  await sender.answerCallbackQuery('cbq-1', { text: 'x'.repeat(500), showAlert: true });

  const { url, body } = fetchImpl.calls[0];
  assert.ok(url.endsWith('/answerCallbackQuery'));
  assert.equal(body.callback_query_id, 'cbq-1');
  assert.equal(body.text.length, 200);
  assert.equal(body.show_alert, true);
});

test('the sender exposes exactly three API methods plus describe — nothing that could order or pay', () => {
  const sender = createShopperSender({ botToken: FAKE_TOKEN, fetchImpl: recordingFetch() });
  assert.deepEqual(Object.keys(sender).sort(), ['answerCallbackQuery', 'describe', 'editMessageText', 'sendMessage']);
});

// ── refusals ─────────────────────────────────────────────────────────────────

test('the sender fails closed on a missing token, a missing fetch, and an unsendable message', async () => {
  assert.throws(() => createShopperSender({ fetchImpl: recordingFetch() }), /botToken required/);
  assert.throws(() => createShopperSender({ botToken: FAKE_TOKEN, fetchImpl: null }), /fetchImpl required/);

  const sender = createShopperSender({ botToken: FAKE_TOKEN, fetchImpl: recordingFetch() });
  await assert.rejects(() => sender.sendMessage(null, { text: 'x' }), /chatId required/);
  await assert.rejects(() => sender.sendMessage(7, null), /rendered \{ text, reply_markup \} is required/);
  await assert.rejects(() => sender.sendMessage(7, { text: '   ' }), /no text/);
  await assert.rejects(() => sender.editMessageText(7, null, { text: 'x' }), /messageId required/);
  await assert.rejects(() => sender.answerCallbackQuery(''), /callbackQueryId required/);
});

test('createShopperSenderFromEnv reads env by name and returns a masked describe()', () => {
  const { sender, chatId, describe } = createShopperSenderFromEnv(
    { SHOPPER_BOT_TOKEN: FAKE_TOKEN, SHOPPER_CHAT_ID: '7' },
    { fetchImpl: recordingFetch() },
  );
  assert.equal(chatId, '7');
  assert.ok(!JSON.stringify(describe()).includes(FAKE_TOKEN));
  assert.ok(!JSON.stringify(sender.describe()).includes(FAKE_TOKEN));
});
