// BUILD-015 WP-B15-50 - cockpit-api/notifyShopper.test.js
//
// AC5 and AC6. Warwick is told when something was recorded, is NOT told when
// nothing was, and her submission survives a Telegram outage.
//
// ⛔ WHAT THIS PROVES AND WHAT IT DOES NOT. Every send here goes through an
// INJECTED fetch or an injected sender. NOTHING IN THIS FILE CONTACTS
// api.telegram.org, reads SHOPPER_BOT_TOKEN, or proves that a real message ever
// arrived on a real phone. That is the real production event, it is Larry's at
// integration, and a green run here is builder evidence of WIRING AND
// TRIGGERING ONLY.
//
// The counting matters more than the passing. Every case below asserts the
// NUMBER of sends, including the cases where the number must be zero - an
// absence of errors is not evidence that nothing was sent.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const notifyShopper = require('./notifyShopper');
const { handleRequest } = require('./httpApi');
// The startup rule for this capability is proven HERE rather than in
// serverConfig.test.js: this Work Order's surface covers server.js and this
// file, and the rule under test is the notification's, not the reader's.
const { validateConfig } = require('./server');

/** A sender that counts, records, and can be told to misbehave. */
function fakeSender(behaviour) {
  const sent = [];
  return {
    sent,
    sender: {
      async sendMessage(chatId, message) {
        sent.push({ chatId, message });
        if (behaviour === 'throw') throw new Error('shopper sendMessage rejected: Bad Gateway');
        if (behaviour === 'hang') return new Promise(() => {});
        return { message_id: 900 + sent.length };
      }
    }
  };
}

const OUTCOME_CREATED = {
  created: true, recorded_new: true, shop_ref: 'SHOP-2026-08-13',
  items: 2, extras: 1,
  rawText: '2 x Semi skimmed milk 4 pints\n1 x Hovis soft white medium\nsome of those little cakes',
  clock: { claimed: '2026-08-13', recorded: '2026-08-13', agrees: true }
};
const OUTCOME_RECORDED = Object.assign({}, OUTCOME_CREATED, { created: false, recorded_new: true });
const OUTCOME_NOTHING = Object.assign({}, OUTCOME_CREATED, { created: false, recorded_new: false });

function quiet() { return () => {}; }

// =====================================================================
// AC5 - WHEN IT FIRES, AND WHEN IT MUST NOT
// =====================================================================

test('AC5: a created shop sends EXACTLY ONE message', async () => {
  const f = fakeSender();
  const r = await notifyShopper.notifySubmission(OUTCOME_CREATED, { sender: f.sender, chatId: '55', log: quiet() });
  assert.equal(f.sent.length, 1);
  assert.deepEqual(r, { attempted: true, notified: true, error: null });
});

test('AC6: created:false + recorded_new:true sends EXACTLY ONE message - the promise kept', async () => {
  const f = fakeSender();
  const r = await notifyShopper.notifySubmission(OUTCOME_RECORDED, { sender: f.sender, chatId: '55', log: quiet() });
  assert.equal(f.sent.length, 1, 'row 2 of the contract promises Warwick was told');
  assert.equal(r.notified, true);
});

test('AC5: THE ZERO CASE - nothing recorded sends NOTHING, and says so', async () => {
  const f = fakeSender();
  const r = await notifyShopper.notifySubmission(OUTCOME_NOTHING, { sender: f.sender, chatId: '55', log: quiet() });
  // The count, not the absence of an error. A no-op ping teaches Warwick to
  // ignore the channel, and an ignored alert is worse than no alert.
  assert.equal(f.sent.length, 0);
  assert.deepEqual(r, { attempted: false, notified: false, error: null });
});

test('AC5: shouldNotify is the whole rule, and it is readable in isolation', () => {
  assert.equal(notifyShopper.shouldNotify({ created: true, recorded_new: false }), true);
  assert.equal(notifyShopper.shouldNotify({ created: false, recorded_new: true }), true);
  assert.equal(notifyShopper.shouldNotify({ created: false, recorded_new: false }), false);
  assert.equal(notifyShopper.shouldNotify({}), false);
  assert.equal(notifyShopper.shouldNotify(null), false);
  // Truthiness is not enough: only the booleans the store actually reported.
  assert.equal(notifyShopper.shouldNotify({ created: 'yes', recorded_new: 'yes' }), false);
});

// =====================================================================
// AC5 - THE MESSAGE
// =====================================================================

test('AC5: the message names Mum, the shop reference and the item count', () => {
  const { text } = notifyShopper.renderShopperNotification(OUTCOME_CREATED);
  assert.match(text, /Mum/);
  assert.match(text, /SHOP-2026-08-13/);
  assert.match(text, /2 tapped items/);
});

test('AC5: the counts do not lie - typed extras are IN ADDITION to the tapped items', () => {
  // "1 item, 1 of them typed" was an earlier draft of this line, and it stated a
  // falsehood about a two-line list. On the recorded-not-created row this count
  // is the only one Warwick gets.
  const { text } = notifyShopper.renderShopperNotification(
    Object.assign({}, OUTCOME_CREATED, { items: 1, extras: 1 })
  );
  assert.match(text, /1 tapped item, plus 1 she typed/);
  assert.ok(!/of them typed/.test(text));
});

test('AC5: it says plainly whether this CREATED today\'s shop or CHANGED an existing one', () => {
  const created = notifyShopper.renderShopperNotification(OUTCOME_CREATED).text;
  const changed = notifyShopper.renderShopperNotification(OUTCOME_RECORDED).text;
  assert.match(created, /A new shop was created/);
  assert.match(changed, /already existed, so this does NOT change it/);
  assert.notEqual(created, changed, 'the two outcomes must not read identically');
});

test('C2: on the recorded-not-created row the message carries HER WORDS VERBATIM', () => {
  // This is the only surviving carrier: raw_* is excluded from shopStore's
  // UPDATE allowlist and the command payload holds a hash, not her words. If
  // this line goes, Felix's page promises Warwick was told and he is told
  // nothing of the sort.
  const { text } = notifyShopper.renderShopperNotification(OUTCOME_RECORDED);
  assert.match(text, /some of those little cakes/);
  assert.match(text, /2 x Semi skimmed milk 4 pints/);
  assert.match(text, /Nothing else records what she sent/);
});

test('C2: her words are not tidied, truncated or hedged on the way into the message', () => {
  const messy = Object.assign({}, OUTCOME_RECORDED, {
    rawText: '1 x Hovis soft white medium\nteh little cakes (the RED jam ones)'
  });
  const { text } = notifyShopper.renderShopperNotification(messy);
  assert.match(text, /teh little cakes \(the RED jam ones\)/);
});

test('AC5: a clock disagreement is reported to WARWICK, and only on the message', () => {
  const drifted = Object.assign({}, OUTCOME_CREATED, {
    clock: { claimed: '2026-08-12', recorded: '2026-08-13', agrees: false }
  });
  const { text } = notifyShopper.renderShopperNotification(drifted);
  assert.match(text, /her tablet said the date was 2026-08-12/);
  assert.match(text, /recorded as 2026-08-13/);
});

test('AC5: no clock claim means no note - `agrees: null` is not a disagreement', () => {
  const silent = Object.assign({}, OUTCOME_CREATED, {
    clock: { claimed: null, recorded: '2026-08-13', agrees: null }
  });
  assert.ok(!/tablet said/.test(notifyShopper.renderShopperNotification(silent).text));
});

test('AC5: a huge list is capped rather than rejected by Telegram', () => {
  const many = new Array(400).fill('1 x something').join('\n');
  const { text } = notifyShopper.renderShopperNotification(
    Object.assign({}, OUTCOME_CREATED, { rawText: many, items: 400 })
  );
  assert.ok(text.length <= notifyShopper.MAX_MESSAGE_CHARS + 4, String(text.length));
  assert.match(text, /and \d+ more lines/);
});

test('AC5: the message is plain text - no parse_mode minefield over her punctuation', () => {
  const out = notifyShopper.renderShopperNotification(OUTCOME_CREATED);
  assert.deepEqual(Object.keys(out), ['text']);
  assert.equal(typeof out.text, 'string');
});

// =====================================================================
// ⛔ AC5 - NEVER MESSAGE MUM. MECHANICALLY.
// =====================================================================

test('AC5: NO field of her request can influence the destination chat', async () => {
  const f = fakeSender();
  // Everything a hostile or careless client could put in a body, carried on the
  // outcome object itself. The destination must be the injected one regardless.
  const poisoned = Object.assign({}, OUTCOME_CREATED, {
    chatId: '111111', chat_id: '222222', to: '333333', telegram_chat_id: '444444',
    household: '555555', actor: 'cockpit:mum'
  });
  await notifyShopper.notifySubmission(poisoned, { sender: f.sender, chatId: '55', log: quiet() });
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].chatId, '55', 'the destination came from configuration, not from the request');
});

test('AC5: notifySubmission has no chat parameter at all - the control is structural', () => {
  // A caller cannot pass a destination even by accident: the outcome argument is
  // never consulted for one. This asserts the shape rather than the intention.
  const src = fs.readFileSync(path.join(__dirname, 'notifyShopper.js'), 'utf8');
  const lines = src.split(/\r?\n/).filter((l) => /chatId\s*=/.test(l) && !l.trim().startsWith('*'));
  for (const l of lines) {
    assert.ok(!/outcome\.|o\.chat|\bo\./.test(l),
      'a chat id must never be read off the outcome: ' + l.trim());
  }
});

test('AC5: it never polls - sendMessage is the only Telegram method it can reach', () => {
  const src = fs.readFileSync(path.join(__dirname, 'notifyShopper.js'), 'utf8');
  assert.ok(!/getUpdates/i.test(src), 'the polling method must never appear in this file');
  const calls = src.match(/sender\.\w+\(/g) || [];
  assert.deepEqual([...new Set(calls)], ['sender.sendMessage('], calls.join(','));
});

test('AC5: SHOPPER_BOT_TOKEN is never read, logged or returned by this module', () => {
  const src = fs.readFileSync(path.join(__dirname, 'notifyShopper.js'), 'utf8');
  // The name may appear in prose. What must not appear is a READ of the value.
  assert.ok(!/process\.env\.SHOPPER_BOT_TOKEN/.test(src));
  assert.ok(!/env\[['"]SHOPPER_BOT_TOKEN/.test(src));
  assert.ok(!/botToken/.test(src), 'the token value never passes through this file');
});

// =====================================================================
// ⛔ AC5 - A FAILED NOTIFICATION NEVER FAILS HER SUBMISSION, AND IS NEVER SILENT
// =====================================================================

test('AC5: a Telegram rejection is reported, not thrown', async () => {
  const f = fakeSender('throw');
  const logged = [];
  const r = await notifyShopper.notifySubmission(OUTCOME_CREATED,
    { sender: f.sender, chatId: '55', log: (code, detail) => logged.push({ code, detail }) });
  assert.deepEqual(r, { attempted: true, notified: false, error: 'notify_failed' });
  assert.equal(logged.length, 1, 'a failure must be LOUD, not swallowed');
  assert.equal(logged[0].code, 'notify_failed');
});

test('AC5: a hanging Telegram is bounded and reported as a timeout', async () => {
  const f = fakeSender('hang');
  const started = Date.now();
  const r = await notifyShopper.notifySubmission(OUTCOME_CREATED,
    { sender: f.sender, chatId: '55', timeoutMs: 40, log: quiet() });
  const elapsed = Date.now() - started;
  assert.equal(r.error, 'notify_timeout');
  assert.equal(r.notified, false);
  assert.ok(elapsed < 2000, 'her SEND button must not wait on a dead bot: ' + elapsed + 'ms');
});

test('AC5: the default budget is 5 seconds, well inside her page\'s own timeout', () => {
  assert.equal(notifyShopper.NOTIFY_TIMEOUT_MS, 5000);
});

test('AC5: a missing SHOPPER_CHAT_ID fails at CONFIG time, loudly, not silently at send time', async () => {
  const logged = [];
  const r = await notifyShopper.notifySubmission(OUTCOME_CREATED, {
    env: { SHOPPER_BOT_TOKEN: 'test-token-value' },   // token present, chat id absent
    fetchImpl: async () => ({ json: async () => ({ ok: true, result: {} }) }),
    log: (code, detail) => logged.push({ code, detail })
  });
  assert.deepEqual(r, { attempted: true, notified: false, error: 'notify_not_configured' });
  assert.equal(logged[0].code, 'notify_not_configured');
});

test('AC5: a missing token is the same - reported, never a crash', async () => {
  const r = await notifyShopper.notifySubmission(OUTCOME_CREATED, {
    env: { SHOPPER_CHAT_ID: '55' },
    fetchImpl: async () => ({ json: async () => ({ ok: true, result: {} }) }),
    log: quiet()
  });
  assert.equal(r.notified, false);
  assert.equal(r.attempted, true);
  assert.ok(r.error === 'notify_not_configured' || r.error === 'notify_failed', r.error);
});

test('AC5: no failure path can leak a credential into the reported error', async () => {
  const logged = [];
  const r = await notifyShopper.notifySubmission(OUTCOME_CREATED, {
    env: { SHOPPER_BOT_TOKEN: '123456:SUPERSECRETVALUE', SHOPPER_CHAT_ID: '55' },
    fetchImpl: async () => { throw new Error('connect ECONNREFUSED https://api.telegram.org/bot123456:SUPERSECRETVALUE/sendMessage'); },
    log: (code, detail) => logged.push({ code, detail })
  });
  assert.equal(r.notified, false);
  const everything = JSON.stringify(r) + JSON.stringify(logged);
  assert.ok(!/SUPERSECRETVALUE/.test(everything), 'the bot module masks it; this asserts it stayed masked');
});

test('AC5: the env path builds a REAL sender and sends through the INJECTED fetch', async () => {
  // The one proof that the production wiring is real rather than a test double:
  // the module goes all the way through createShopperSenderFromEnv. The fetch is
  // still injected, so nothing leaves this process.
  const calls = [];
  const r = await notifyShopper.notifySubmission(OUTCOME_CREATED, {
    env: { SHOPPER_BOT_TOKEN: '123456:test-token', SHOPPER_CHAT_ID: '778899' },
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { json: async () => ({ ok: true, result: { message_id: 7 } }) };
    },
    log: quiet()
  });
  assert.deepEqual(r, { attempted: true, notified: true, error: null });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/sendMessage$/);
  assert.equal(String(calls[0].body.chat_id), '778899');
  assert.match(calls[0].body.text, /Mum/);
});

// =====================================================================
// AC5/AC6 THROUGH THE REAL ROUTE - the submission event itself
// =====================================================================

function listDeps(receiveResult, notifyDeps) {
  return {
    now: () => '2026-08-13T09:15:00.000Z',
    commandDeps: null,
    dispatch: async () => receiveResult,
    notify: notifyDeps
  };
}

const LIST_BODY = { household: 1, items: [{ id: '13', name: 'Arla semi-skimmed 4pt', qty: 2 }], extras: ['some of those little cakes'] };

test('AC5: POST /asdair/list on a CREATED shop fires exactly one notification', async () => {
  const f = fakeSender();
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    listDeps({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 4, created: true, matched_by: 'insert', recorded: { id: 9, created: true } },
      { sender: f.sender, chatId: '55', log: quiet() })
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.created, true);
  assert.equal(res.body.recorded_new, true);
  assert.equal(res.body.notified, true);
  assert.equal(res.body.notify_error, null);
  assert.equal(f.sent.length, 1);
});

test('AC6: POST /asdair/list on created:false + recorded_new:true fires exactly one', async () => {
  const f = fakeSender();
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    listDeps({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 4, created: false, matched_by: 'shop_ref', duplicate: true, recorded: { id: 10, created: true } },
      { sender: f.sender, chatId: '55', log: quiet() })
  );
  assert.equal(res.body.created, false);
  assert.equal(res.body.recorded_new, true, 'this is the row Felix renders "I have told Warwick" on');
  assert.equal(f.sent.length, 1);
  assert.equal(res.body.notified, true);
  // And the promise has substance: her typed words are IN the message.
  assert.match(f.sent[0].message.text, /some of those little cakes/);
});

test('AC5: POST /asdair/list that recorded NOTHING fires ZERO notifications', async () => {
  const f = fakeSender();
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    listDeps({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 4, created: false, matched_by: 'shop_ref', duplicate: true, recorded: { id: 10, created: false } },
      { sender: f.sender, chatId: '55', log: quiet() })
  );
  assert.equal(res.body.created, false);
  assert.equal(res.body.recorded_new, false);
  assert.equal(f.sent.length, 0, 'Warwick must not be pinged by a no-op');
  assert.equal(res.body.notified, false);
  assert.equal(res.body.notify_error, null, 'nothing failed - nothing needed doing');
});

test('AC5: a FAILED notification still returns ok:true - her list is saved', async () => {
  const f = fakeSender('throw');
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    listDeps({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 4, created: true, matched_by: 'insert', recorded: { id: 9, created: true } },
      { sender: f.sender, chatId: '55', log: quiet() })
  );
  assert.equal(res.status, 200, 'a Telegram outage must not turn a saved shop into an error');
  assert.equal(res.body.ok, true);
  assert.equal(res.body.created, true);
  // ...and it is NOT silent.
  assert.equal(res.body.notified, false);
  assert.equal(res.body.notify_error, 'notify_failed');
});

test('AC4: recorded_new is taken from the store\'s receipt, never inferred', async () => {
  // A receipt with no `recorded` key must read as "nothing new", which
  // under-claims rather than promising a durable row that may not exist.
  const f = fakeSender();
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: LIST_BODY },
    listDeps({ ok: true, shop_ref: 'SHOP-X', shop_id: 4, created: false, matched_by: 'shop_ref' },
      { sender: f.sender, chatId: '55', log: quiet() })
  );
  assert.equal(res.body.recorded_new, false);
  assert.equal(f.sent.length, 0);
});

test('AC3/AC4: the response reports the typed count and the date her tablet claimed', async () => {
  const f = fakeSender();
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: Object.assign({ list_date: '2026-08-11' }, LIST_BODY) },
    listDeps({ ok: true, shop_ref: 'SHOP-2026-08-13', shop_id: 4, created: true, matched_by: 'insert', recorded: { id: 9, created: true } },
      { sender: f.sender, chatId: '55', log: quiet() })
  );
  assert.equal(res.body.items, 1);
  assert.equal(res.body.extras, 1);
  assert.equal(res.body.list_date, '2026-08-13', 'the SERVER date is what was recorded');
  assert.equal(res.body.list_date_claimed, '2026-08-11');
  assert.equal(res.body.list_date_agrees, false);
  // And Warwick is told about the drift, on the message, not her screen.
  assert.match(f.sent[0].message.text, /her tablet said the date was 2026-08-11/);
});

test('AC3: an unusable extra fails the submission LOUDLY and notifies nobody', async () => {
  const f = fakeSender();
  const res = await handleRequest(
    { method: 'POST', path: '/asdair/list', body: { household: 1, items: LIST_BODY.items, extras: [''] } },
    listDeps({ ok: true, created: true, recorded: { id: 1, created: true } }, { sender: f.sender, chatId: '55', log: quiet() })
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'list_extra_invalid');
  assert.equal(f.sent.length, 0, 'nothing was recorded, so nobody is told');
});

// =====================================================================
// M2 - THE FAIL-LOUD STARTUP RULE
//
// The silent failure this closes: loadSenderConfig throws on a missing token
// but returns a null chatId perfectly happily, so a service started with a
// token and no chat id LOOKS configured, boots clean, accepts Mum's list, and
// finds out it has nowhere to send at the exact moment it needs one.
// =====================================================================

const READER_OK = Object.freeze({
  ASDAIR_DB_URL: 'postgresql://asdair_ro:x@127.0.0.1:55432/asdair_test'
});

function cfg(extra) {
  return validateConfig(Object.assign({}, READER_OK, extra || {}));
}

test('M2: BOTH notification variables set - the service starts and says notifications are on', () => {
  const r = cfg({ SHOPPER_BOT_TOKEN: '123456:token', SHOPPER_CHAT_ID: '778899' });
  assert.equal(r.ok, true);
  assert.equal(r.enabled.notify_shopper, true);
});

test('M2: NEITHER set - the service still starts, and says LOUDLY that Warwick will not be told', () => {
  const r = cfg({});
  assert.equal(r.ok, true, 'an unconfigured notifier must not take the read surface down');
  assert.equal(r.enabled.notify_shopper, false);
  const warning = r.warnings.find((w) => /SHOPPER_BOT_TOKEN and SHOPPER_CHAT_ID are not set/.test(w));
  assert.ok(warning, 'the operator must be told this outright, not left to infer it');
  assert.match(warning, /Warwick is NOT told/);
  // And the consequence for HER page is named, because that is the part an
  // operator would not work out for themselves.
  assert.match(warning, /may say Warwick was told when he was not/);
});

test('M2: a token with NO chat id REFUSES TO START - this is the silent-failure case', () => {
  const r = cfg({ SHOPPER_BOT_TOKEN: '123456:token' });
  assert.equal(r.ok, false, 'half a destination has no honest reading');
  assert.ok(r.errors.some((x) => /SHOPPER_CHAT_ID is not set but SHOPPER_BOT_TOKEN is/.test(x)));
  assert.ok(r.errors.some((x) => /Refusing to start rather than accepting Mum's list/.test(x)));
});

test('M2: a chat id with NO token REFUSES TO START as well - the rule is symmetrical', () => {
  const r = cfg({ SHOPPER_CHAT_ID: '778899' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((x) => /SHOPPER_BOT_TOKEN is not set but SHOPPER_CHAT_ID is/.test(x)));
});

test('M2: a malformed chat id is refused at STARTUP, not at send time', () => {
  const r = cfg({ SHOPPER_BOT_TOKEN: '123456:token', SHOPPER_CHAT_ID: 'the family chat' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((x) => /SHOPPER_CHAT_ID is malformed/.test(x)));
});

test('M2: a negative chat id is valid - Telegram groups have them', () => {
  const r = cfg({ SHOPPER_BOT_TOKEN: '123456:token', SHOPPER_CHAT_ID: '-1001234567890' });
  assert.equal(r.ok, true);
});

test('M2: whitespace is not configuration - a blank token reads as absent', () => {
  const r = cfg({ SHOPPER_BOT_TOKEN: '   ', SHOPPER_CHAT_ID: '   ' });
  assert.equal(r.ok, true);
  assert.equal(r.enabled.notify_shopper, false);
});

test('M2: NO startup message can contain the token value', () => {
  // The whole point of presence-only validation. Every string this produces is
  // printed by start(), and a credential in a log is a leaked credential.
  const r = cfg({ SHOPPER_BOT_TOKEN: '123456:SUPERSECRETVALUE', SHOPPER_CHAT_ID: 'nonsense' });
  const printed = r.errors.concat(r.warnings).join(' | ');
  assert.ok(!/SUPERSECRETVALUE/.test(printed), printed);
});

test('M2: server.js never reads the token value - it only checks that one is present', () => {
  const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  // A shape check on this variable would be parsing credential material. The
  // spec entry must therefore have a presence-only check.
  assert.ok(!/SHOPPER_BOT_TOKEN[\s\S]{0,400}?check:\s*function\s*\(\s*v\s*\)/.test(src),
    'the token check must take no value argument');
});

// ─────────────────────────────────────────────────────────────────────────────
// WARWICK, 2026-08-14, AFTER THE FIRST REAL SUBMISSION.
//
// He read a 32-line list in a real Telegram message, did not spot the one line
// that was new, and told Larry "bacon added" - when the bacon was in NO durable
// row at all. The information was present and invisible, which for this message
// is the same as absent. His words: "there should be a little header or section
// in the telegram message that says new items and then lists any she has
// manually added so they are easy to see."
// ─────────────────────────────────────────────────────────────────────────────
test('WARWICK-2026-08-14: her typed items get their own named section, ABOVE the full list', () => {
  const m = notifyShopper.renderShopperNotification({
    created: false, recorded_new: true, shop_ref: 'SHOP-2026-08-14',
    items: 31, extras: 1, extraWords: ['asda bacon 10 rashers'],
    rawText: '1 x Toothpaste\n1 x asda bacon 10 rashers',
  });
  assert.match(m.text, /NEW ITEM SHE TYPED:/, 'the section is named');
  assert.match(m.text, /\* asda bacon 10 rashers/, 'her exact words are in it');
  assert.ok(m.text.indexOf('NEW ITEM SHE TYPED:') < m.text.indexOf('HER WHOLE LIST:'),
    'the new items come FIRST - that is where the eye lands, and it is the whole point');
});

test('WARWICK-2026-08-14: plural when there is more than one, and her words are never tidied', () => {
  const m = notifyShopper.renderShopperNotification({
    created: true, recorded_new: true, shop_ref: 'SHOP-X', items: 2, extras: 2,
    extraWords: ['asda bacon 10 rashers', 'some of those little cakes'],
    rawText: 'x',
  });
  assert.match(m.text, /NEW ITEMS SHE TYPED:/);
  assert.match(m.text, /\* some of those little cakes/, 'verbatim, not title-cased or corrected');
});

test('WARWICK-2026-08-14: no section at all when she typed nothing - no empty heading', () => {
  const m = notifyShopper.renderShopperNotification({
    created: true, recorded_new: true, shop_ref: 'SHOP-X', items: 3, extras: 0,
    extraWords: [], rawText: '1 x Milk',
  });
  assert.ok(!/NEW ITEM/.test(m.text), 'a heading over nothing is noise');
  assert.ok(!/HER WHOLE LIST:/.test(m.text), 'and the list needs no label when it is the only list');
});
