// F-MED-01 — HMAC verification must FAIL CLOSED in live mode when a per-principal
// signing secret is unset (BUILD-010 WP0 remediation).
//
// In fixtures mode signing is optional (honest but unsigned envelopes are the WP0
// synthetic path). In LIVE mode (runtime-ready) a missing TOWER_HMAC_SECRET_* must
// REFUSE the turn result rather than silently accepting it unverified.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createTowerRuntime } from '../src/tower.js';
import { makeSignedResult } from '../src/core/envelope.js';

const SECRET = 'k'.repeat(48);
// A runtime-ready DATABASE_URL (never connected to — the memory store is used and
// the startup gate throws before any connect). Not a real credential.
const FAKE_DB = 'postgresql://postgres:pw@127.0.0.1:5/ftw_none';

function signingAdapter(principal, secret) {
  return {
    principal,
    async runTurn({ run, turn }) {
      const payload = { status: 'ok', summary: 'done', proposed_action: { type: 'post_comment' } };
      const { envelope, signature } = makeSignedResult({
        principal, runId: run.run_id, ordinal: turn.ordinal, payload,
      }, secret);
      return { ok: true, blocked: false, signerPrincipal: principal, structuredResult: payload, envelope, signature, tokensUsed: 1 };
    },
  };
}

// ── config helper ────────────────────────────────────────────────────────────

test('F-MED-01: requireLiveSigningSecrets — fixtures mode never requires secrets', () => {
  const cfg = loadConfig({}); // no DATABASE_URL → fixtures
  const r = cfg.requireLiveSigningSecrets();
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
});

test('F-MED-01: requireLiveSigningSecrets — live mode reports every missing signing secret (NAMES only)', () => {
  const cfg = loadConfig({ DATABASE_URL: FAKE_DB, TOWER_HMAC_SECRET_LARRY: SECRET });
  assert.equal(cfg.isRuntimeReady(), true);
  const r = cfg.requireLiveSigningSecrets();
  assert.equal(r.ok, false);
  assert.ok(r.missing.includes('TOWER_HMAC_SECRET_GPT_CODEX'));
  assert.ok(r.missing.includes('TOWER_HMAC_SECRET_TOWER'));
  assert.ok(!r.missing.includes('TOWER_HMAC_SECRET_LARRY'), 'the provisioned secret is not reported missing');
  // Reports NAMES, never values.
  for (const m of r.missing) assert.match(m, /^TOWER_HMAC_SECRET_/);
});

// ── dispatcher live fail-closed ──────────────────────────────────────────────

test('F-MED-01: live dispatcher REJECTS a larry result when TOWER_HMAC_SECRET_LARRY is unset', async () => {
  // Runtime-ready (DATABASE_URL set) but the larry signing secret is MISSING.
  const config = loadConfig({ DATABASE_URL: FAKE_DB, TOWER_HMAC_SECRET_GPT_CODEX: SECRET, TOWER_HMAC_SECRET_TOWER: SECRET });
  assert.equal(config.isRuntimeReady(), true);
  assert.equal(config.signingSecret('larry'), null, 'larry secret is genuinely unset');

  const store = createMemoryStore();
  // The adapter still "signs" with some key, but the dispatcher has no larry
  // secret to verify against — in live mode that MUST be refused, not accepted.
  const dispatcher = createDispatcher({ store, config, adapters: { larry: signingAdapter('larry', SECRET) } });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });

  await assert.rejects(
    () => dispatcher.runTurn(turn.turn_id),
    /refusing unsigned turn result.*TOWER_HMAC_SECRET_LARRY|fail-closed/,
  );
  // The turn was NOT recorded as returned — it was refused.
  assert.notEqual((await store.getTurn(turn.turn_id)).state, 'returned');
});

test('F-MED-01: live dispatcher ACCEPTS a larry result when the secret IS provisioned and the signature verifies', async () => {
  const config = loadConfig({
    DATABASE_URL: FAKE_DB,
    TOWER_HMAC_SECRET_LARRY: SECRET,
    TOWER_HMAC_SECRET_GPT_CODEX: SECRET,
    TOWER_HMAC_SECRET_TOWER: SECRET,
  });
  const store = createMemoryStore();
  const dispatcher = createDispatcher({ store, config, adapters: { larry: signingAdapter('larry', SECRET) } });
  const run = await dispatcher.createRun({ title: 't', maxRounds: 2 });
  const { turn } = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry' });
  const res = await dispatcher.runTurn(turn.turn_id);
  assert.equal(res.action.type, 'post_comment');
  assert.equal((await store.getTurn(turn.turn_id)).state, 'returned');
});

// ── startup gate ─────────────────────────────────────────────────────────────

test('F-MED-01: createTowerRuntime FAILS CLOSED at startup in live mode when a signing secret is missing', async () => {
  await assert.rejects(
    () => createTowerRuntime({
      env: { DATABASE_URL: FAKE_DB, TOWER_HMAC_SECRET_LARRY: SECRET, TOWER_HMAC_SECRET_GPT_CODEX: SECRET },
      // TOWER_HMAC_SECRET_TOWER intentionally omitted.
    }),
    /live mode requires all per-principal HMAC signing secrets.*TOWER_HMAC_SECRET_TOWER/,
  );
});

test('F-MED-01: createTowerRuntime in fixtures mode boots without any signing secret', async () => {
  const runtime = await createTowerRuntime({ env: {} }); // no DATABASE_URL → fixtures
  assert.equal(runtime.config.fixturesMode, true);
  await runtime.stop();
});
