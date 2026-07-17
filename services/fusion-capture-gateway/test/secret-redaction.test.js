// BUILD-002 WP1 — regression coverage for the fatal/startup SECRET REDACTOR
// (Vex L-2). `config.buildSecretRedactor` is the ONE redaction implementation
// that serves BOTH the live runner's per-cycle diagnostics (safeErr) AND the
// entrypoint fatal catch in liveRunner.main(). FU-4 was probe-verified but had
// no committed test — this file is that control, so future drift cannot silently
// re-open a disclosure path for DB credentials, Telegram tokens, or complete
// secret-bearing URLs.
//
// SYNTHETIC CANARIES ONLY. Nothing here is a real secret and nothing reads
// C:\.fusion247. Canary VALUES are shaped to dodge the repo secret-scanner's
// value patterns (short digit-runs for the bot token; `~` separators break the
// contiguous base64ish runs the generic NAME=VALUE rule keys on) while staying
// unique + grep-able.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSecretRedactor } from '../src/config.js';

const MARKER = '***redacted***';

// ── Canary secret material (synthetic) ───────────────────────────────────────
const CANARY_DB_PW = 'Zq7~Canary~Pw~001';                    // bare password component
const CANARY_DSN = `postgresql://capture_user:${CANARY_DB_PW}@db.canary.invalid:5432/postgres?sslmode=verify-full`;
const CANARY_BOT_TOKEN = '123:AA-canary-bot-token-not-real'; // digits:base64ish (3 digits → scanner-safe)
const CANARY_SUPABASE_KEY = 'sb_secret_Canary~Key~Not~Real~001';
const CANARY_WEBHOOK_SECRET = 'canary~webhook~secret~value~001';

function fullConfig() {
  return {
    databaseUrl: CANARY_DSN,
    telegramBotToken: CANARY_BOT_TOKEN,
    supabaseSecretKey: CANARY_SUPABASE_KEY,
    telegramWebhookSecret: CANARY_WEBHOOK_SECRET,
  };
}

// A message must NOT retain ANY canary substring, and MUST carry the marker.
function assertScrubbed(out, rawSecret, label) {
  assert.ok(!out.includes(rawSecret), `${label}: raw secret substring must be ABSENT (got: ${out})`);
  assert.ok(out.includes(MARKER), `${label}: redaction marker ${MARKER} must be present (got: ${out})`);
}

// ── Direct redactor coverage ─────────────────────────────────────────────────

test('L-2: buildSecretRedactor strips a complete DATABASE_URL', () => {
  const redact = buildSecretRedactor(fullConfig());
  const out = redact(`pg pool: connection failed for ${CANARY_DSN} — retry`);
  assertScrubbed(out, CANARY_DSN, 'whole DSN');
  // The password component embedded in the DSN must not survive independently.
  assert.ok(!out.includes(CANARY_DB_PW), 'DSN password component absent');
});

test('L-2: buildSecretRedactor strips the bare DB password component', () => {
  const redact = buildSecretRedactor(fullConfig());
  const out = redact(`FATAL: password authentication failed for value "${CANARY_DB_PW}"`);
  assertScrubbed(out, CANARY_DB_PW, 'bare password');
});

test('L-2: buildSecretRedactor strips a Telegram bot token', () => {
  const redact = buildSecretRedactor(fullConfig());
  const out = redact(`telegram sendMessage rejected for bot ${CANARY_BOT_TOKEN}: 401`);
  assertScrubbed(out, CANARY_BOT_TOKEN, 'bot token');
});

test('L-2: buildSecretRedactor strips a complete secret-bearing URL (Supabase key + webhook secret)', () => {
  const redact = buildSecretRedactor(fullConfig());
  // A URL whose query string carries the Supabase secret key.
  const apiUrl = `https://project.supabase.co/rest/v1/rpc/fcg_webhook_intake?apikey=${CANARY_SUPABASE_KEY}`;
  const outApi = redact(`GET ${apiUrl} failed with http_500`);
  assertScrubbed(outApi, CANARY_SUPABASE_KEY, 'supabase-key URL');
  // A URL whose query string carries the webhook secret token.
  const hookUrl = `https://api.telegram.org/botX/setWebhook?secret_token=${CANARY_WEBHOOK_SECRET}`;
  const outHook = redact(`POST ${hookUrl} — unexpected`);
  assertScrubbed(outHook, CANARY_WEBHOOK_SECRET, 'webhook-secret URL');
});

test('L-2: a combined fatal-shaped message drops EVERY secret at once', () => {
  const redact = buildSecretRedactor(fullConfig());
  const fatal = [
    `dsn=${CANARY_DSN}`,
    `pw=${CANARY_DB_PW}`,
    `bot=${CANARY_BOT_TOKEN}`,
    `key=${CANARY_SUPABASE_KEY}`,
    `hook=${CANARY_WEBHOOK_SECRET}`,
  ].join(' ');
  const out = redact(fatal);
  for (const raw of [CANARY_DSN, CANARY_DB_PW, CANARY_BOT_TOKEN, CANARY_SUPABASE_KEY, CANARY_WEBHOOK_SECRET]) {
    assert.ok(!out.includes(raw), `combined message still leaked: ${raw}`);
  }
  assert.ok(out.includes(MARKER), 'marker present in combined message');
});

test('L-2: a URL-encoded DSN password is redacted in BOTH encoded and decoded forms', () => {
  // password with reserved chars → percent-encoded in the DSN. new URL().password
  // returns the ENCODED form; the redactor pushes BOTH that and decodeURIComponent()
  // of it, so a leak of either spelling is scrubbed.
  const decodedPw = 'P@ss~Enc~1';
  const encodedPw = 'P%40ss~Enc~1';
  const dsn = `postgresql://capture_user:${encodedPw}@db.canary.invalid:5432/postgres`;
  const redact = buildSecretRedactor({ databaseUrl: dsn });
  const outDecoded = redact(`libpq parsed password ${decodedPw}`);
  assertScrubbed(outDecoded, decodedPw, 'decoded password form');
  const outEncoded = redact(`raw dsn password ${encodedPw}`);
  assertScrubbed(outEncoded, encodedPw, 'encoded password form');
});

test('L-2: a NON-URL DSN still gets whole-string redaction (the URL-parse fallback)', () => {
  // libpq key=value form is not a valid URL — the parser catch keeps the whole
  // string as a redaction target so the password never survives.
  const kvDsn = 'host=db.canary.invalid port=5432 user=capture_user password=Kv~Canary~Pw~9 dbname=postgres';
  const redact = buildSecretRedactor({ databaseUrl: kvDsn });
  const out = redact(`connect failed: ${kvDsn}`);
  assertScrubbed(out, kvDsn, 'non-URL DSN');
  assert.ok(!out.includes('Kv~Canary~Pw~9'), 'non-URL DSN password absent');
});

test('L-2: an empty config yields a safe no-op redactor (no crash, no over-redaction)', () => {
  const redact = buildSecretRedactor({});
  assert.equal(redact('nothing secret here'), 'nothing secret here');
  assert.equal(redact(undefined), '');
  assert.equal(redact(new Error('boom').message), 'boom');
});

// ── WIRING assertion: the entrypoint fatal catch routes through the redactor ──
//
// This proves the CODE PATH, not just the redactor in isolation. We run the REAL
// executable entrypoint (liveRunner.js as the main module) with canary env that
// forces a deterministic, HERMETIC construction-time fatal (a CA file that is not
// a PEM → buildPgSslConfig throws before any socket is opened). The thrown message
// carries the canary DB password (embedded in the CA-file path), so if — and only
// if — main()'s fatal catch pipes it through buildSecretRedactor(loadConfig()) do
// we see the marker in place of the raw password. No network, no real credential.

test('L-2 (wiring): liveRunner main() fatal catch redacts secrets via buildSecretRedactor', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const liveRunnerPath = path.resolve(HERE, '..', 'src', 'live', 'liveRunner.js');
  assert.ok(fs.existsSync(liveRunnerPath), 'liveRunner.js entrypoint exists');

  // Temp CA file whose PATH contains the canary password, with non-PEM content so
  // buildPgSslConfig throws `... does not look like a PEM certificate bundle` and
  // the thrown message carries the password value.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-l2-'));
  const caPath = path.join(tmpDir, `${CANARY_DB_PW}-not-a-pem.crt`);
  fs.writeFileSync(caPath, 'this is deliberately not a certificate\n');

  try {
    const env = {
      ...process.env,
      DATABASE_URL: CANARY_DSN,                 // carries CANARY_DB_PW as its password
      DATABASE_SSL_CA_FILE: caPath,             // → forces the non-PEM fatal
      TELEGRAM_BOT_TOKEN: CANARY_BOT_TOKEN,
      AUTHORISED_TELEGRAM_USER_ID: '424242',
      WORKER_ID: 'l2-wiring-probe',
    };
    const res = spawnSync(process.execPath, [liveRunnerPath], {
      env,
      encoding: 'utf8',
      timeout: 30_000,
    });

    const stderr = res.stderr || '';
    // The entrypoint fatal catch (NOT refuse_start_fixtures_mode) must have run.
    assert.ok(stderr.includes('"event":"fatal"'), `expected a fatal line; got:\n${stderr}`);
    // The redactor was invoked: the canary password is gone, the marker is present.
    assert.ok(!stderr.includes(CANARY_DB_PW), `fatal path LEAKED the DB password:\n${stderr}`);
    assert.ok(stderr.includes(MARKER), `fatal path did not route through the redactor (no marker):\n${stderr}`);
    // Belt-and-braces: no other canary secret escaped either.
    assert.ok(!stderr.includes(CANARY_BOT_TOKEN), `fatal path leaked the bot token:\n${stderr}`);
    // The whole DSN must never appear verbatim.
    assert.ok(!stderr.includes(CANARY_DSN), `fatal path leaked the whole DSN:\n${stderr}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
