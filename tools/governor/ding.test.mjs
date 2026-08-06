// Proofs for the FusionDevBot send path (BUILD-020 WP-4B, WO-2026-08-06-19).
//
// TWO STANDING CONSTRAINTS ON THIS SUITE, both load-bearing:
//
//   1. ZERO NETWORK. Every test injects `fetchImpl`. Nothing here reaches Telegram, and a
//      real send is explicitly NOT this suite's evidence — J2-e's acceptance is one real
//      message arriving on Warwick's phone from the INSTALLED path, which is WP-4C and
//      then Warwick. Nothing below may be read as proof that a message was delivered.
//
//   2. THE REAL CREDENTIALS FILE IS NEVER OPENED. Every credential test points at a
//      throwaway fixture under the OS temp directory. `CREDENTIALS_PATH` is asserted as a
//      STRING; it is never read. That surface is closed.
//
// The fixture token below is shaped to match NEITHER secret-scan class
// (`[0-9]{6,}:AA[A-Za-z0-9_-]{30,}` and `[0-9]{8,}:[A-Za-z0-9_-]{30,}`) — six digits, and
// the character pair after the colon is not `AA`. A clean scan of this file is therefore a
// real result and not an accident of allowlisting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  CREDENTIALS_PATH,
  CREDENTIAL_NAMES,
  LOG_PATH,
  EXIT,
  makeRedactor,
  appendRecord,
  parseEnvText,
  loadCredentials,
  sendMessage,
  run,
} from './ding.mjs';

const FAKE_TOKEN = '999999:FAKE-TOKEN-FOR-KEEL-TESTS-abcdefghij';
const FAKE_CHAT_ID = '100200300';

// ---- fixtures --------------------------------------------------------------

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'ding-test-'));
  return {
    dir,
    path: (...p) => join(dir, ...p),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function credsFile(t, { token = FAKE_TOKEN, chatId = FAKE_CHAT_ID, omit = [] } = {}) {
  const lines = ['# throwaway fixture — not a real credential', ''];
  if (!omit.includes('TELEGRAM_BOT_TOKEN')) lines.push(`TELEGRAM_BOT_TOKEN=${token}`);
  if (!omit.includes('AUTHORISED_TELEGRAM_USER_ID')) lines.push(`AUTHORISED_TELEGRAM_USER_ID=${chatId}`);
  const p = t.path('creds.env');
  writeFileSync(p, lines.join('\n'), 'utf8');
  return p;
}

function msgFile(t, text = 'frontier moved to WP-4B [send_path] — needs your call') {
  const p = t.path('message.txt');
  writeFileSync(p, text, 'utf8');
  return p;
}

/** A fetch stub. Records every call; returns whatever the scenario says. */
function stubFetch(reply) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (typeof reply === 'function') return reply(url, init);
    return reply;
  };
  impl.calls = calls;
  return impl;
}

function okReply(messageId = 320) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, result: { message_id: messageId } }),
  };
}

/** Run the whole path with captured streams. */
async function invoke(opts) {
  const out = [];
  const err = [];
  const code = await run({
    now: () => '2026-08-06T12:00:00.000Z',
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
    ...opts,
  });
  return { code, stdout: out.join(''), stderr: err.join('') };
}

function recordLines(logPath) {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

// ---- the closed exit-code set, pinned to a literal held HERE ----------------
// Held in the test, not imported from the source it checks, so a renumbering in ding.mjs
// cannot quietly redefine what the suite believes it is asserting.

test('the exit-code set is exactly the approved table, with the approved numbers', () => {
  assert.deepEqual(EXIT, {
    SENT: 0,
    TELEGRAM_REJECTED: 1,
    CREDENTIALS_UNUSABLE: 2,
    NETWORK_FAILURE: 3,
    USAGE: 4,
    SENT_BUT_UNRECORDED: 5,
    INTERNAL_ERROR: 6,
  });
});

test('the approved credentials path and credential names are the ones the order names', () => {
  // Asserted as a STRING. This file never opens it.
  assert.equal(CREDENTIALS_PATH, 'C:/.fusion247/fusion-capture-gateway.env');
  assert.deepEqual(CREDENTIAL_NAMES, ['TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID']);
});

test('the record lives in the governor state home, not in the repo', () => {
  assert.equal(LOG_PATH, join(homedir(), '.mypka', 'governor', 'ding-log.jsonl'));
});

// ---- 1. the durable record -------------------------------------------------

test('appendRecord creates its directory and appends one parseable JSON line per call', () => {
  const t = tmp();
  try {
    const logPath = t.path('nested', 'deeper', 'ding-log.jsonl');
    assert.deepEqual(appendRecord(logPath, { a: 1 }), { ok: true });
    assert.deepEqual(appendRecord(logPath, { a: 2 }), { ok: true });
    const lines = recordLines(logPath);
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map((l) => l.a), [1, 2]);
  } finally {
    t.cleanup();
  }
});

test('appendRecord returns an error instead of throwing when the record cannot be written', () => {
  const t = tmp();
  try {
    // A FILE where the record's parent directory would have to be.
    writeFileSync(t.path('blocked'), 'not a directory', 'utf8');
    const res = appendRecord(t.path('blocked', 'ding-log.jsonl'), { a: 1 });
    assert.equal(res.ok, false);
    assert.equal(typeof res.error, 'string');
    assert.ok(res.error.length > 0, 'a failed record must say why');
  } finally {
    t.cleanup();
  }
});

test('appendRecord runs the redactor over the FINAL BYTES, not over the object', () => {
  const t = tmp();
  try {
    const logPath = t.path('ding-log.jsonl');
    appendRecord(logPath, { detail: `leaked ${FAKE_TOKEN} here` }, makeRedactor([FAKE_TOKEN]));
    const raw = readFileSync(logPath, 'utf8');
    assert.ok(!raw.includes(FAKE_TOKEN), 'the token reached disk');
    assert.ok(raw.includes('***'), 'the redactor did not run');
  } finally {
    t.cleanup();
  }
});

test('makeRedactor masks long secrets, longest first, and leaves short strings alone', () => {
  const redact = makeRedactor([FAKE_TOKEN, FAKE_CHAT_ID]);
  assert.equal(redact(`a ${FAKE_TOKEN} b ${FAKE_CHAT_ID} c`), 'a *** b *** c');

  // A short secret must NOT be substring-redacted: masking "123" would rewrite an
  // unrelated message_id and corrupt the record it was meant to protect.
  const shortRedact = makeRedactor(['123']);
  assert.equal(shortRedact('{"message_id":1234}'), '{"message_id":1234}');
});

// ---- 2. the credential self-load -------------------------------------------

test('parseEnvText reads KEY=VALUE, strips quotes, and skips comments and blanks', () => {
  const parsed = parseEnvText(
    ['# a comment', '', 'PLAIN=value', 'QUOTED="quoted value"', "SINGLE='single'", 'not a pair'].join('\n'),
  );
  assert.deepEqual(parsed, {
    PLAIN: 'value',
    QUOTED: 'quoted value',
    SINGLE: 'single',
  });
});

test('parseEnvText does NOT write anything into process.env', () => {
  const marker = 'DING_TEST_MARKER_VAR';
  delete process.env[marker];
  parseEnvText(`${marker}=should-not-be-exported`);
  assert.equal(process.env[marker], undefined);
});

test('loadCredentials: a present, complete file yields both values', () => {
  const t = tmp();
  try {
    const res = loadCredentials(credsFile(t));
    assert.equal(res.ok, true);
    assert.equal(res.token, FAKE_TOKEN);
    assert.equal(res.chatId, FAKE_CHAT_ID);
  } finally {
    t.cleanup();
  }
});

test('loadCredentials: file absent entirely is distinguishable from a missing name', () => {
  const t = tmp();
  try {
    const absent = loadCredentials(t.path('nothing-here.env'));
    assert.equal(absent.ok, false);
    assert.equal(absent.outcome, 'credentials-file-absent');

    const incomplete = loadCredentials(credsFile(t, { omit: ['TELEGRAM_BOT_TOKEN'] }));
    assert.equal(incomplete.ok, false);
    assert.equal(incomplete.outcome, 'credentials-missing-names');
    assert.deepEqual(incomplete.missing, ['TELEGRAM_BOT_TOKEN']);
  } finally {
    t.cleanup();
  }
});

test('loadCredentials: an unreadable file is not reported as an absent one', () => {
  const t = tmp();
  try {
    mkdirSync(t.path('a-directory'));
    const res = loadCredentials(t.path('a-directory'));
    assert.equal(res.ok, false);
    assert.equal(res.outcome, 'credentials-file-unreadable');
  } finally {
    t.cleanup();
  }
});

test('loadCredentials reports NAMES only — never a value — when a name is blank', () => {
  const t = tmp();
  try {
    const p = t.path('blank.env');
    writeFileSync(p, `TELEGRAM_BOT_TOKEN=\nAUTHORISED_TELEGRAM_USER_ID=${FAKE_CHAT_ID}\n`, 'utf8');
    const res = loadCredentials(p);
    assert.equal(res.outcome, 'credentials-missing-names');
    assert.deepEqual(res.missing, ['TELEGRAM_BOT_TOKEN']);
    assert.ok(!JSON.stringify(res).includes(FAKE_CHAT_ID), 'a credential value escaped into the result');
  } finally {
    t.cleanup();
  }
});

// ---- 3. the send -----------------------------------------------------------

test('sendMessage POSTs plain text to sendMessage, and NEVER sets parse_mode', async () => {
  const fetchImpl = stubFetch(okReply(321));
  const res = await sendMessage({
    token: FAKE_TOKEN,
    chatId: FAKE_CHAT_ID,
    text: 'a_message [with] markdown-hostile characters',
    fetchImpl,
  });
  assert.deepEqual(res, { ok: true, message_id: 321 });

  assert.equal(fetchImpl.calls.length, 1, 'exactly one POST');
  const { url, init } = fetchImpl.calls[0];
  assert.equal(url, `https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage`);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['Content-Type'], 'application/json');

  const body = JSON.parse(init.body);
  assert.equal(body.chat_id, FAKE_CHAT_ID);
  assert.equal(body.text, 'a_message [with] markdown-hostile characters');
  assert.equal(body.disable_web_page_preview, true);
  assert.ok(!('parse_mode' in body), 'parse_mode must never be set — it mangles Larry messages');
});

test('sendMessage treats a non-2xx response as a rejection and keeps the description', async () => {
  const fetchImpl = stubFetch({
    ok: false,
    status: 403,
    text: async () => JSON.stringify({ ok: false, description: 'Forbidden: bot was blocked by the user' }),
  });
  const res = await sendMessage({ token: FAKE_TOKEN, chatId: FAKE_CHAT_ID, text: 'x', fetchImpl });
  assert.equal(res.ok, false);
  assert.equal(res.outcome, 'telegram-rejected');
  assert.match(res.detail, /403/);
  assert.match(res.detail, /blocked by the user/);
});

test('sendMessage treats HTTP 200 with ok:false as a rejection', async () => {
  const fetchImpl = stubFetch({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: false, description: 'chat not found' }),
  });
  const res = await sendMessage({ token: FAKE_TOKEN, chatId: FAKE_CHAT_ID, text: 'x', fetchImpl });
  assert.equal(res.ok, false);
  assert.equal(res.outcome, 'telegram-rejected');
});

test('sendMessage refuses to claim success when ok:true carries no message_id', async () => {
  // The message id is the only proof the message left. Without it there is no success.
  const fetchImpl = stubFetch({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, result: {} }),
  });
  const res = await sendMessage({ token: FAKE_TOKEN, chatId: FAKE_CHAT_ID, text: 'x', fetchImpl });
  assert.equal(res.ok, false);
  assert.equal(res.outcome, 'telegram-rejected');
  assert.match(res.detail, /no message_id/);
});

test('sendMessage reports a transport error as a network failure, with its cause code', async () => {
  const fetchImpl = stubFetch(async () => {
    const err = new TypeError('fetch failed');
    err.cause = { code: 'ENOTFOUND' };
    throw err;
  });
  const res = await sendMessage({ token: FAKE_TOKEN, chatId: FAKE_CHAT_ID, text: 'x', fetchImpl });
  assert.equal(res.ok, false);
  assert.equal(res.outcome, 'network-failure');
  assert.match(res.detail, /ENOTFOUND/);
});

test('sendMessage bounds a hang — a request that never answers becomes a timed-out failure', async () => {
  // A hang IS a silent failure. Without the abort this test would never return.
  const fetchImpl = stubFetch(
    (url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('This operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }),
  );
  const res = await sendMessage({
    token: FAKE_TOKEN,
    chatId: FAKE_CHAT_ID,
    text: 'x',
    fetchImpl,
    timeoutMs: 25,
  });
  assert.equal(res.ok, false);
  assert.equal(res.outcome, 'network-failure');
  assert.match(res.detail, /timed out after 25ms/);
});

// ---- AC1: invoked with a message file and NOTHING else ---------------------

test('AC1 — the path loads its own credentials with no flag, no export and no shell setup', async () => {
  const t = tmp();
  try {
    const fetchImpl = stubFetch(okReply(320));
    const { code } = await invoke({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      logPath: t.path('ding-log.jsonl'),
      fetchImpl,
    });
    assert.equal(code, EXIT.SENT);
    assert.equal(fetchImpl.calls.length, 1);
    assert.ok(fetchImpl.calls[0].url.includes(FAKE_TOKEN), 'the token came from the file');
  } finally {
    t.cleanup();
  }
});

test('AC1 — credential values are never placed into process.env', async () => {
  const t = tmp();
  try {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.AUTHORISED_TELEGRAM_USER_ID;
    await invoke({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      logPath: t.path('ding-log.jsonl'),
      fetchImpl: stubFetch(okReply()),
    });
    assert.equal(process.env.TELEGRAM_BOT_TOKEN, undefined);
    assert.equal(process.env.AUTHORISED_TELEGRAM_USER_ID, undefined);
  } finally {
    t.cleanup();
  }
});

test('AC1 — an INHERITED environment value is ignored; the credentials file is authoritative', async () => {
  // Deliberate divergence from continuity.mjs loadHonchoEnv(), which lets an inherited
  // value win. Honouring one here would re-admit the shell dependence J2-c removes, and
  // would let a stray export in one operator's shell mask an unconfigured machine.
  const t = tmp();
  const decoy = 'DECOY-INHERITED-VALUE-THAT-MUST-BE-IGNORED';
  try {
    process.env.TELEGRAM_BOT_TOKEN = decoy;
    process.env.AUTHORISED_TELEGRAM_USER_ID = 'DECOY-CHAT-ID-IGNORED';
    const fetchImpl = stubFetch(okReply());
    await invoke({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      logPath: t.path('ding-log.jsonl'),
      fetchImpl,
    });
    const { url, init } = fetchImpl.calls[0];
    assert.ok(url.includes(FAKE_TOKEN), 'the file token must be used');
    assert.ok(!url.includes(decoy), 'an inherited token must never be used');
    assert.equal(JSON.parse(init.body).chat_id, FAKE_CHAT_ID);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.AUTHORISED_TELEGRAM_USER_ID;
    t.cleanup();
  }
});

test('AC1 — an inherited environment alone is NOT enough: with no file, it still fails', async () => {
  const t = tmp();
  const decoy = 'DECOY-INHERITED-VALUE-THAT-MUST-BE-IGNORED';
  try {
    process.env.TELEGRAM_BOT_TOKEN = decoy;
    process.env.AUTHORISED_TELEGRAM_USER_ID = 'DECOY-CHAT-ID-IGNORED';
    const logPath = t.path('ding-log.jsonl');
    const fetchImpl = stubFetch(okReply());
    const { code } = await invoke({
      argv: [msgFile(t)],
      envPath: t.path('absent.env'),
      logPath,
      fetchImpl,
    });
    assert.equal(code, EXIT.CREDENTIALS_UNUSABLE);
    assert.equal(fetchImpl.calls.length, 0, 'nothing may be sent on inherited credentials');
    assert.equal(recordLines(logPath)[0].outcome, 'credentials-file-absent');
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.AUTHORISED_TELEGRAM_USER_ID;
    t.cleanup();
  }
});

// ---- AC2: a success is durably recorded, with the message_id ---------------

test('AC2 — a successful send records timestamp, outcome and the Telegram message_id', async () => {
  const t = tmp();
  try {
    const logPath = t.path('ding-log.jsonl');
    const { code, stdout } = await invoke({
      argv: [msgFile(t, 'hello')],
      envPath: credsFile(t),
      logPath,
      fetchImpl: stubFetch(okReply(4242)),
    });
    assert.equal(code, EXIT.SENT);

    const lines = recordLines(logPath);
    assert.equal(lines.length, 1, 'exactly one line per invocation');
    assert.equal(lines[0].ts, '2026-08-06T12:00:00.000Z');
    assert.equal(lines[0].outcome, 'sent');
    assert.equal(lines[0].message_id, 4242);
    assert.equal(lines[0].exit, 0);
    assert.equal(lines[0].bytes, 5);

    assert.deepEqual(JSON.parse(stdout), { ok: true, why: 'sent', message_id: 4242 });
  } finally {
    t.cleanup();
  }
});

test('AC2 — the record never contains the message text', async () => {
  const t = tmp();
  try {
    const logPath = t.path('ding-log.jsonl');
    const secretish = 'CONTENT-THAT-MUST-NOT-BE-LOGGED';
    await invoke({
      argv: [msgFile(t, secretish)],
      envPath: credsFile(t),
      logPath,
      fetchImpl: stubFetch(okReply()),
    });
    assert.ok(!readFileSync(logPath, 'utf8').includes(secretish), 'message text reached the log');
  } finally {
    t.cleanup();
  }
});

test('AC2 — successive invocations append rather than overwrite', async () => {
  const t = tmp();
  try {
    const logPath = t.path('ding-log.jsonl');
    const common = { envPath: credsFile(t), logPath, fetchImpl: stubFetch(okReply()) };
    await invoke({ argv: [msgFile(t)], ...common });
    await invoke({ argv: [msgFile(t)], ...common });
    await invoke({ argv: [t.path('gone.txt')], ...common });
    assert.equal(recordLines(logPath).length, 3);
  } finally {
    t.cleanup();
  }
});

// ---- AC3: no failure is ever silent ----------------------------------------
// The load-bearing criterion. Table-driven so a NEW failure mode added later without a
// record or a non-zero exit is caught by the shape of the assertion, not by a reviewer.

const FAILURE_SCENARIOS = [
  {
    name: 'credentials file absent entirely',
    outcome: 'credentials-file-absent',
    exit: EXIT.CREDENTIALS_UNUSABLE,
    build: (t) => ({ argv: [msgFile(t)], envPath: t.path('absent.env'), fetchImpl: stubFetch(okReply()) }),
  },
  {
    name: 'credentials file unreadable',
    outcome: 'credentials-file-unreadable',
    exit: EXIT.CREDENTIALS_UNUSABLE,
    build: (t) => {
      mkdirSync(t.path('dir-not-file'));
      return { argv: [msgFile(t)], envPath: t.path('dir-not-file'), fetchImpl: stubFetch(okReply()) };
    },
  },
  {
    name: 'a required credential name is missing from the file',
    outcome: 'credentials-missing-names',
    exit: EXIT.CREDENTIALS_UNUSABLE,
    build: (t) => ({
      argv: [msgFile(t)],
      envPath: credsFile(t, { omit: ['AUTHORISED_TELEGRAM_USER_ID'] }),
      fetchImpl: stubFetch(okReply()),
    }),
  },
  {
    name: 'network failure',
    outcome: 'network-failure',
    exit: EXIT.NETWORK_FAILURE,
    build: (t) => ({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      fetchImpl: stubFetch(async () => {
        const err = new TypeError('fetch failed');
        err.cause = { code: 'ECONNREFUSED' };
        throw err;
      }),
    }),
  },
  {
    name: 'Telegram API rejection',
    outcome: 'telegram-rejected',
    exit: EXIT.TELEGRAM_REJECTED,
    build: (t) => ({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      fetchImpl: stubFetch({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ ok: false, description: 'Bad Request: chat not found' }),
      }),
    }),
  },
  {
    name: 'missing message file',
    outcome: 'usage-message-file-unreadable',
    exit: EXIT.USAGE,
    build: (t) => ({ argv: [t.path('no-such-message.txt')], envPath: credsFile(t), fetchImpl: stubFetch(okReply()) }),
  },
  {
    name: 'no message file argument at all',
    outcome: 'usage-no-message-file',
    exit: EXIT.USAGE,
    build: (t) => ({ argv: [], envPath: credsFile(t), fetchImpl: stubFetch(okReply()) }),
  },
  {
    name: 'an empty message file',
    outcome: 'usage-message-empty',
    exit: EXIT.USAGE,
    build: (t) => ({ argv: [msgFile(t, '   \n  ')], envPath: credsFile(t), fetchImpl: stubFetch(okReply()) }),
  },
];

for (const scenario of FAILURE_SCENARIOS) {
  test(`AC3 — ${scenario.name}: exits non-zero, records the attempt, and says so loudly`, async () => {
    const t = tmp();
    try {
      const logPath = t.path('ding-log.jsonl');
      const { code, stdout, stderr } = await invoke({ ...scenario.build(t), logPath });

      assert.notEqual(code, EXIT.SENT, 'a failure must never exit 0');
      assert.equal(code, scenario.exit);

      const lines = recordLines(logPath);
      assert.equal(lines.length, 1, 'a failure must never record nothing');
      assert.equal(lines[0].outcome, scenario.outcome);
      assert.equal(lines[0].exit, scenario.exit);
      assert.equal(lines[0].message_id, null, 'a failure must never carry a message_id');

      assert.equal(JSON.parse(stdout).ok, false);
      assert.match(stderr, /ding: FAILED/, 'a failure must be loud on stderr');
    } finally {
      t.cleanup();
    }
  });
}

test('AC3 — every enumerated failure mode is covered, and none of them exits 0', () => {
  // Pinned to a literal held HERE, so deleting a scenario from the table above fails this
  // test rather than silently shrinking the proof.
  assert.deepEqual(
    FAILURE_SCENARIOS.map((s) => s.outcome).sort(),
    [
      'credentials-file-absent',
      'credentials-file-unreadable',
      'credentials-missing-names',
      'network-failure',
      'telegram-rejected',
      'usage-message-empty',
      'usage-message-file-unreadable',
      'usage-no-message-file',
    ],
  );
  assert.ok(FAILURE_SCENARIOS.every((s) => s.exit !== EXIT.SENT));
});

test('AC3 — nothing is sent when the credentials cannot be loaded', async () => {
  const t = tmp();
  try {
    const fetchImpl = stubFetch(okReply());
    await invoke({
      argv: [msgFile(t)],
      envPath: t.path('absent.env'),
      logPath: t.path('ding-log.jsonl'),
      fetchImpl,
    });
    assert.equal(fetchImpl.calls.length, 0);
  } finally {
    t.cleanup();
  }
});

test('AC3 — sent-but-unrecorded is exit 5: it claims neither a clean send nor a failure', async () => {
  const t = tmp();
  try {
    writeFileSync(t.path('blocked'), 'not a directory', 'utf8');
    const { code, stdout, stderr } = await invoke({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      logPath: t.path('blocked', 'ding-log.jsonl'),
      fetchImpl: stubFetch(okReply(999)),
    });
    assert.equal(code, EXIT.SENT_BUT_UNRECORDED);
    const summary = JSON.parse(stdout);
    assert.equal(summary.ok, false);
    assert.equal(summary.why, 'sent-but-unrecorded');
    assert.equal(summary.message_id, 999, 'the proof of delivery must still surface');
    assert.match(stderr, /RECORD WRITE FAILED/);
    assert.match(stderr, /WAS sent but could not be recorded/);
  } finally {
    t.cleanup();
  }
});

test('AC3 — a failure whose record ALSO fails keeps its non-zero exit and shouts twice', async () => {
  const t = tmp();
  try {
    writeFileSync(t.path('blocked'), 'not a directory', 'utf8');
    const { code, stderr } = await invoke({
      argv: [msgFile(t)],
      envPath: t.path('absent.env'),
      logPath: t.path('blocked', 'ding-log.jsonl'),
      fetchImpl: stubFetch(okReply()),
    });
    assert.equal(code, EXIT.CREDENTIALS_UNUSABLE);
    assert.match(stderr, /RECORD WRITE FAILED/);
    assert.match(stderr, /ding: FAILED/);
  } finally {
    t.cleanup();
  }
});

test('AC3 — an unexpected internal error is exit 6, recorded, and never 0', async () => {
  const t = tmp();
  try {
    const logPath = t.path('ding-log.jsonl');
    const { code, stderr } = await invoke({
      argv: ['whatever'],
      envPath: credsFile(t),
      logPath,
      // A readFile that violates its contract by returning a non-string. Nothing in the
      // body guards against this, which is precisely why the outer catch has to exist.
      readFile: () => 42,
      fetchImpl: stubFetch(okReply()),
    });
    assert.equal(code, EXIT.INTERNAL_ERROR);
    const lines = recordLines(logPath);
    assert.equal(lines.length, 1, 'even a bug in this file records the attempt');
    assert.equal(lines[0].outcome, 'internal-error');
    assert.match(stderr, /ding: FAILED/);
  } finally {
    t.cleanup();
  }
});

test('AC3 — run() never throws, even when the REPORTER itself fails', async () => {
  // Found by this suite, not by inspection: a reporter that can unwind past its own caller
  // turns a loud failure into an unhandled rejection with nothing written anywhere.
  const t = tmp();
  try {
    const out = [];
    const err = [];
    const code = await run({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      logPath: t.path('ding-log.jsonl'),
      fetchImpl: stubFetch(okReply(777)),
      now: () => {
        throw new Error('clock exploded');
      },
      stdout: (s) => out.push(s),
      stderr: (s) => err.push(s),
    });
    // The message went; the record could not be confirmed. That is exactly exit 5.
    assert.equal(code, EXIT.SENT_BUT_UNRECORDED);
    assert.match(err.join(''), /REPORTING FAILED/);
  } finally {
    t.cleanup();
  }
});

test('the CLI entrypoint has a rejection handler, so no exit can be silent', () => {
  assert.ok(
    /ding: UNCAUGHT/.test(SOURCE),
    'an unhandled rejection would be the one genuinely silent exit this file exists to prevent',
  );
});

// ---- AC4: no credential value is ever emitted ------------------------------

test('AC4 — a token echoed back by Telegram is redacted everywhere it could surface', async () => {
  const t = tmp();
  try {
    const logPath = t.path('ding-log.jsonl');
    const { stdout, stderr } = await invoke({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      logPath,
      fetchImpl: stubFetch({
        ok: false,
        status: 401,
        // The nastiest realistic case: the upstream error quotes the request URL back.
        text: async () =>
          JSON.stringify({
            ok: false,
            description: `Unauthorized for https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage`,
          }),
      }),
    });
    const record = readFileSync(logPath, 'utf8');
    for (const [surface, text] of [['record', record], ['stdout', stdout], ['stderr', stderr]]) {
      assert.ok(!text.includes(FAKE_TOKEN), `the token leaked to ${surface}`);
      assert.ok(!text.includes(FAKE_CHAT_ID), `the chat id leaked to ${surface}`);
    }
    assert.ok(record.includes('***'), 'the redaction did not run over the record');
  } finally {
    t.cleanup();
  }
});

test('AC4 — the request URL is never recorded or printed on a successful send', async () => {
  const t = tmp();
  try {
    const logPath = t.path('ding-log.jsonl');
    const { stdout, stderr } = await invoke({
      argv: [msgFile(t)],
      envPath: credsFile(t),
      logPath,
      fetchImpl: stubFetch(okReply()),
    });
    const all = readFileSync(logPath, 'utf8') + stdout + stderr;
    assert.ok(!all.includes('api.telegram.org'), 'the token-bearing URL surfaced');
    assert.ok(!all.includes(FAKE_TOKEN));
    assert.ok(!all.includes(FAKE_CHAT_ID));
  } finally {
    t.cleanup();
  }
});

test('AC4 — the credentials failure path names the missing variable but not any value', async () => {
  const t = tmp();
  try {
    const logPath = t.path('ding-log.jsonl');
    const { stdout, stderr } = await invoke({
      argv: [msgFile(t)],
      envPath: credsFile(t, { omit: ['TELEGRAM_BOT_TOKEN'] }),
      logPath,
      fetchImpl: stubFetch(okReply()),
    });
    const all = readFileSync(logPath, 'utf8') + stdout + stderr;
    assert.ok(all.includes('TELEGRAM_BOT_TOKEN'), 'the missing NAME must be reported');
    assert.ok(!all.includes(FAKE_CHAT_ID), 'the value that WAS present must not be reported');
  } finally {
    t.cleanup();
  }
});

// ---- AC5: getMe is not acceptance, so it does not exist here ---------------

const SOURCE = readFileSync(fileURLToPath(new URL('./ding.mjs', import.meta.url)), 'utf8');

test('AC5 — the send path contains no getMe call of any kind', () => {
  const code = SOURCE.split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
  assert.ok(!/getMe/i.test(code), 'getMe proves bot identity only and must not appear in the send path');
});

test('AC5 — the only Telegram endpoint this path calls is sendMessage', () => {
  const endpoints = [...SOURCE.matchAll(/api\.telegram\.org[^\s`'"]*/g)].map((m) => m[0]);
  assert.deepEqual(endpoints, ['api.telegram.org/bot${token}/sendMessage']);
});

test('the CLI sits behind the house entrypoint guard', () => {
  assert.ok(
    SOURCE.includes("if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)"),
    'the CLI must be behind the house import.meta.url entrypoint guard',
  );
});

test('no trigger, hook, daemon or scheduler was built into the send path', () => {
  // Warwick, 2026-08-06: the decision to ding stays with Larry and is not mechanised.
  const code = SOURCE.split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  for (const forbidden of ['setInterval', 'cron', 'chokidar', 'watchFile', 'SessionStart']) {
    assert.ok(!code.includes(forbidden), `${forbidden} has no business in a send path`);
  }
});
