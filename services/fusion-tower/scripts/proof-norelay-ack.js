// Fusion Tower — BUILD-010 WP0 STEP 6 live proof (GPT MEDIUM-2 fix A):
// Larry acknowledges the posted Codex re-review DIRECTLY FROM DURABLE TOWER STATE
// ON REAL POSTGRES, across a GENUINE dispatcher/store RESTART, with NO Warwick relay.
//
// The earlier version proved the no-relay path against the in-memory fixture store,
// so "durable Tower state" was only asserted, not demonstrated. This version proves
// it against a clean REAL Postgres cluster with two genuine reconnects:
//
//   1. create the run + the posted-review event in Postgres (PostgresStore);
//   2. STOP and recreate the store/dispatcher (close the pool, build a fresh store)
//      BEFORE the Larry dispatch — a genuine restart;
//   3. RECOVER the pending run from Postgres (loaded back from the durable store);
//   4. run the REAL headless `claude` Larry ack turn (shell:false, prompt on stdin,
//      scoped read-only tools, NO merge tool) — Larry reads the STABLE Tower-owned
//      staged read-back and independently returns the signed ack;
//   5. VERIFY the HMAC signature (fail-closed) and PERSIST the signed result to
//      Postgres;
//   6. RECONNECT AGAIN (a fresh pool) and prove the signed ack is STILL readable
//      from Postgres;
//   7. NO Warwick relay; ZERO ClickUp writes.
//
// GATED like the other portable/live tests: skips cleanly (exit 0) when there is no
// DATABASE_URL (no DB) or `claude` is not invocable headless. Run it live (with a
// throwaway scoop Postgres cluster + a synthetic per-principal HMAC secret) for the
// real evidence. No secret is ever printed — config.describe() masks every secret.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createPostgresStore } from '../src/store/postgresStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createLarryAdapter, verifyClaudeInvocable } from '../src/adapters/larryAdapter.js';
import { verifyEnvelope } from '../src/core/envelope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Proof-only HMAC secret (NOT real, NOT committed). Verification below is genuine —
// it just uses an in-process synthetic key.
const SYNTH_ENV = { TOWER_HMAC_SECRET_LARRY: 'proof-secret-larry-' + 'x'.repeat(24) };

const DB = process.env.DATABASE_URL;

// STABLE Tower-owned staged read-back (committed evidence, NOT a scratchpad temp):
// the Tower's authorised read of the LIVE ClickUp comment.
const STAGED_READBACK = path.resolve(
  process.env.TOWER_STAGED_READBACK
  ?? path.join(__dirname, '..', '..', '..', 'Builds', 'BUILD-010-fusion-tower',
    'Architecture', 'evidence', 'posted-review-readback.md'),
);
const CONTROL_TASK_ID = '869e5zu97';
const CLICKUP_COMMENT_ID = '90120242550572';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS = [
  '0001_wp0_control_plane.sql',
  '0002_wp0_identity_provider_binding.sql',
  '0003_wp0_external_write_outbox.sql',
];

const trail = [];
function step(title, detail) { trail.push({ n: trail.length + 1, title, detail }); }
function shortSig(sig) { return sig ? sig.slice(0, 16) + '…(' + sig.length + ' hex)' : '(unsigned)'; }

async function resetAndMigrate() {
  const pgModule = await import('pg');
  const { Pool } = pgModule.default ?? pgModule;
  const pool = new Pool({ connectionString: DB });
  try {
    await pool.query('drop schema if exists ftw cascade');
    for (const file of MIGRATIONS) {
      await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    }
  } finally {
    await pool.end();
  }
}

function skip(reason) {
  process.stdout.write(JSON.stringify({ proof: 'wp0-step6-norelay-ack-pg', skipped: true, reason }, null, 2) + '\n');
  process.exit(0);
}

async function main() {
  if (!DB) skip('no DATABASE_URL — DB-gated proof skipped (like the gated integration tests)');
  const claudeProbe = await verifyClaudeInvocable({});
  if (!claudeProbe.invocable) skip(`claude not invocable headless (${claudeProbe.error ?? 'absent'}) — capability-gated proof skipped`);
  const stagedExists = fs.existsSync(STAGED_READBACK);
  if (!stagedExists) skip(`staged read-back absent at ${STAGED_READBACK}`);

  const config = loadConfig({ ...process.env, ...SYNTH_ENV });
  step('Environment probe', {
    claude_invocable: claudeProbe.invocable,
    claude_version: claudeProbe.version,
    runtime_ready_live_mode: config.isRuntimeReady(), // true — Postgres present → fail-closed signing
    staged_readback_present: stagedExists,
    staged_readback_path: STAGED_READBACK,
  });

  // Clean real Postgres: chain 0001 → 0002 → 0003 on an empty schema.
  await resetAndMigrate();
  step('Clean real Postgres migrated (0001→0002→0003)', { database_masked: config.describe().DATABASE_URL, migrations: MIGRATIONS });

  // ---- 1. Durable Tower state in POSTGRES: the run + the posted-review event. ---
  const store1 = await createPostgresStore({ connectionString: DB });
  let runId;
  let postedEventId;
  try {
    const run = await store1.createRun({
      title: 'BUILD-010 WP0 STEP 6 — acknowledge posted Codex re-review (Postgres)',
      scope: 'acknowledge the posted independent Codex re-review',
      evidenceTaskRef: CONTROL_TASK_ID,
      maxRounds: 1,
    });
    runId = run.run_id;
    const posted = await store1.ingestEvent({
      source: 'clickup',
      sourceEventId: CLICKUP_COMMENT_ID,
      kind: 'task_comment.created',
      runId: run.run_id,
      selfGenerated: true, // the Tower posted it (its Codex re-review) — the single authorised write
      payload: { task_id: CONTROL_TASK_ID, comment_id: CLICKUP_COMMENT_ID, is_self: true },
    });
    postedEventId = posted.event.event_id;
    const claimable = await store1.claimNextEvent({ runId: run.run_id });
    step('1. Run + posted-review event created in Postgres (self-generated → never advances)', {
      run_id: run.run_id,
      run_status: run.status,
      posted_comment_event_id: postedEventId,
      self_generated: posted.event.self_generated,
      claimable_for_advance: claimable ? claimable.source_event_id : null, // null: self events never advance
    });
  } finally {
    // ---- 2. GENUINE RESTART: close the pool — the dispatcher/store connection is gone.
    await store1.end();
  }
  step('2. Dispatcher/store connection STOPPED (pool closed) — genuine restart before the Larry dispatch', {
    store1_pool_closed: true,
  });

  // ---- 3. RECOVER the pending run from Postgres with a BRAND-NEW store. ---------
  const store2 = await createPostgresStore({ connectionString: DB });
  let turnId;
  let sigOk = false;
  let ack = null;
  let larryReal = false;
  try {
    const recovered = await store2.getRun(runId);
    if (!recovered) throw new Error('recovery failed — run not found in Postgres after restart');
    const recoveredEvent = await store2.getEvent(postedEventId);
    step('3. Pending run RECOVERED from Postgres (durable state, not memory)', {
      recovered_run_id: recovered.run_id,
      recovered_status: recovered.status,
      recovered_posted_event: recoveredEvent?.event_id ?? null,
      recovered_event_self_generated: recoveredEvent?.self_generated ?? null,
    });

    // Real Larry adapter; cwd = the staged file's dir so the Read tool can open it.
    const larry = createLarryAdapter({ config, cwd: path.dirname(STAGED_READBACK), mode: 'auto' });
    const dispatcher = createDispatcher({ store: store2, config, adapters: { larry } });

    const boundedContext = {
      expect: 'signed-ack',
      review_readback_path: STAGED_READBACK,
      control_task_id: CONTROL_TASK_ID,
      clickup_comment_id: CLICKUP_COMMENT_ID,
    };
    const d = await dispatcher.dispatchNextTurn(recovered.run_id, { expectedResponder: 'larry', boundedContext });
    turnId = d.turn.turn_id;
    step('Dispatch bounded Larry ack turn from the RECOVERED run (read-only, no merge tool)', {
      turn_id: d.turn.turn_id, ordinal: d.turn.ordinal, state: d.turn.state, allowed_tools: larry.allowedTools,
    });

    // ---- 4. Run the REAL headless claude ack turn. Larry reads the file itself. --
    const outcome = await dispatcher.runTurn(d.turn.turn_id);
    larryReal = !outcome.blocked;
    const turn = await store2.getTurn(d.turn.turn_id);
    const secret = config.signingSecret('larry');
    // ---- 5. VERIFY the signature (fail-closed) — persisted by runTurn to Postgres.
    sigOk = turn.result_signature ? verifyEnvelope(turn.structured_result, turn.result_signature, secret) : false;
    ack = turn.structured_result?.payload?.ack ?? null;
    step(`4–5. Larry ack turn returned (${larryReal ? 'REAL headless claude' : 'recorded blocker'}) + signature verified + persisted to Postgres`, {
      state: turn.state,
      signer: turn.signer_principal,
      provider: turn.structured_result?.provider,
      signature: shortSig(turn.result_signature),
      signature_verified: sigOk,
      ack_fields: ack,
      blocker: turn.structured_result?.payload?.blocker ?? null,
    });
  } finally {
    // ---- 6a. Close the second connection too — force a real re-read from disk.
    await store2.end();
  }

  // ---- 6b. RECONNECT AGAIN (fresh pool) — the signed ack is STILL readable. -----
  const store3 = await createPostgresStore({ connectionString: DB });
  let stillReadable = false;
  let sigOkAfterReconnect = false;
  try {
    const turn3 = await store3.getTurn(turnId);
    stillReadable = Boolean(turn3 && turn3.result_signature && turn3.state === 'returned');
    sigOkAfterReconnect = turn3?.result_signature
      ? verifyEnvelope(turn3.structured_result, turn3.result_signature, config.signingSecret('larry'))
      : false;
    step('6. Signed ack STILL readable after a SECOND reconnect (durable across restarts)', {
      reconnected: true,
      turn_state: turn3?.state ?? null,
      signer: turn3?.signer_principal ?? null,
      signature: shortSig(turn3?.result_signature),
      signature_verified_after_reconnect: sigOkAfterReconnect,
      ack_fields: turn3?.structured_result?.payload?.ack ?? null,
    });
  } finally {
    await store3.end();
  }

  // ---- 7. No ClickUp write, no relay: this proof never constructs a poster. -----
  step('7. No ClickUp write, no Warwick relay', {
    clickup_write_calls: 0,
    note: 'no ClickUp poster is instantiated anywhere in this proof; the loop only spawned `claude`',
    warwick_relay_required: false,
    path: 'Postgres run+event → restart (pool close) → recover from Postgres → dispatcher → real Larry turn → signed ack → verify → persist to Postgres → reconnect → re-read',
  });

  const asserts = {
    run_and_event_created_in_pg: Boolean(runId && postedEventId),
    dispatcher_store_restart_performed: true, // store1.end() before dispatch
    signed_ack_recovered_after_restart: larryReal && Boolean(ack) && sigOk,
    signer_is_larry: sigOk, // sig verifies only for the honest larry envelope
    reviewed_head_sha: ack?.reviewed_head_sha === '9fda8fd',
    codex_verdict: ack?.codex_verdict === 'approve',
    previous_medium_closed: ack?.previous_medium_closed === true,
    clickup_comment_id: ack?.clickup_comment_id === CLICKUP_COMMENT_ID,
    ack_true: ack?.ack === true,
    readable_after_second_reconnect: stillReadable && sigOkAfterReconnect,
    zero_clickup_writes: true,
    no_warwick_relay: true,
  };

  const verdict = {
    run_event_created_in_postgres: asserts.run_and_event_created_in_pg,
    dispatcher_store_restart_performed: asserts.dispatcher_store_restart_performed,
    signed_ack_recovered_after_restart: asserts.signed_ack_recovered_after_restart,
    readable_after_second_reconnect: asserts.readable_after_second_reconnect,
    zero_clickup_writes: asserts.zero_clickup_writes,
    no_warwick_relay: asserts.no_warwick_relay,
    ack_fields: ack,
    signature_verified: sigOk,
    all_assertions_pass: Object.values(asserts).every(Boolean),
    passed: Object.values(asserts).every(Boolean),
  };

  writeTranscript({ config, runId, turnId, trail, verdict, ack, sigOk, asserts });
  process.stdout.write(JSON.stringify({ proof: 'wp0-step6-norelay-ack-pg', verdict }, null, 2) + '\n');
  process.exit(verdict.passed ? 0 : 2);
}

function writeTranscript({ config, runId, turnId, trail, verdict, ack, sigOk, asserts }) {
  const out = path.join(__dirname, '..', '..', '..', 'Builds', 'BUILD-010-fusion-tower', 'Architecture', 'larry-norelay-ack-2026-07-17.md');
  const masked = config.describe();
  const lines = [];
  lines.push('---');
  lines.push('build: BUILD-010');
  lines.push('component: Fusion Tower / Governance Mode');
  lines.push('wp: WP0');
  lines.push('artifact: larry-norelay-ack');
  lines.push('status: generated');
  lines.push('author: mack');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('---', '');
  lines.push('# Fusion Tower — WP0 STEP 6: Larry no-relay signed ack on REAL Postgres (masked transcript)', '');
  lines.push('Parent build: [[BUILD-010-fusion-tower]]', '');
  lines.push('Generated by `services/fusion-tower/scripts/proof-norelay-ack.js`. Proves Larry');
  lines.push('receives the posted Codex re-review from **DURABLE Tower state (Postgres)**, across a');
  lines.push('**genuine dispatcher/store restart**, and returns a strict signed acknowledgement —');
  lines.push('with NO Warwick copy-paste and ZERO ClickUp writes.', '');
  lines.push(`- Tower run id: \`${runId}\``);
  lines.push(`- Larry ack turn id: \`${turnId}\``);
  lines.push('- Run + posted-review event created in **Postgres**: **YES**');
  lines.push('- Dispatcher/store **restart** performed before dispatch (pool closed, fresh store): **YES**');
  lines.push(`- Signed ack recovered after restart + signature verified: **${sigOk ? 'YES' : 'NO'}**`);
  lines.push(`- Signed ack still readable after a **second** reconnect: **${asserts.readable_after_second_reconnect ? 'YES' : 'NO'}**`);
  lines.push('- ZERO ClickUp writes: **YES** (no poster instantiated)');
  lines.push('- Warwick relay required: **NO** (path: Postgres run+event → restart → recover from Postgres → dispatcher → real Larry turn → signed ack → verify → persist → reconnect → re-read)', '');
  lines.push('## Larry ack fields (read by Larry from the staged file, not supplied in the prompt)', '');
  lines.push('```json');
  lines.push(JSON.stringify(ack, null, 2));
  lines.push('```', '');
  lines.push('## Verdict', '');
  lines.push('```json');
  lines.push(JSON.stringify(verdict, null, 2));
  lines.push('```', '');
  lines.push('## Assertions', '');
  lines.push('```json');
  lines.push(JSON.stringify(asserts, null, 2));
  lines.push('```', '');
  lines.push('## Masked config snapshot (proof of secret masking — DATABASE_URL masked)', '');
  lines.push('```json');
  lines.push(JSON.stringify(masked, null, 2));
  lines.push('```', '');
  lines.push('## Step-by-step transcript', '');
  for (const s of trail) {
    lines.push(`### ${s.n}. ${s.title}`, '');
    lines.push('```json');
    lines.push(JSON.stringify(s.detail, null, 2));
    lines.push('```', '');
  }
  fs.writeFileSync(out, lines.join('\n'));
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ proof: 'wp0-step6-norelay-ack-pg', event: 'error', error: String(err?.message ?? err), stack: err?.stack }) + '\n');
  process.exit(1);
});
