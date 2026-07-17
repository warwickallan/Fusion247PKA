// Fusion Tower — BUILD-010 WP0 STEP 6 live proof: Larry acknowledges the posted
// Codex re-review DIRECTLY FROM DURABLE TOWER STATE, with NO Warwick relay.
//
// Path proven (no human copy-paste anywhere in it):
//   durable Tower state (the staged authorised read-back of the LIVE ClickUp
//   comment) -> dispatcher dispatches ONE bounded, read-only Larry turn whose
//   bounded context points at the staged file + control task id + comment id ->
//   REAL headless `claude` reads the file and INDEPENDENTLY identifies the verdict
//   and reviewed SHA (never hard-coded into the prompt) -> returns a STRICT signed
//   ack -> the dispatcher VERIFIES the HMAC signature (fail-closed) and records it.
//
// NO second live ClickUp write is performed (the one authorised bounded write —
// the posted comment — already happened). No secret is ever printed. If `claude`
// is not invocable the turn fail-closes to a signed blocker (never a hang).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createLarryAdapter, verifyClaudeInvocable } from '../src/adapters/larryAdapter.js';
import { verifyEnvelope } from '../src/core/envelope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Proof-only HMAC secret (NOT real, NOT committed). Signature verification below
// is genuine — it just uses an in-process synthetic key.
const SYNTH_ENV = { TOWER_HMAC_SECRET_LARRY: 'proof-secret-larry-' + 'x'.repeat(24) };

// The Tower-staged read-back of the LIVE ClickUp comment (durable Tower state).
const STAGED_READBACK = path.resolve(
  process.env.TOWER_STAGED_READBACK
  ?? 'C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/99ae3521-d706-4ee5-b38f-2e0f670e0275/scratchpad/codex-review-evidence/posted-review-readback.md',
);
const CONTROL_TASK_ID = '869e5zu97';
const CLICKUP_COMMENT_ID = '90120242550572';

const trail = [];
function step(title, detail) { trail.push({ n: trail.length + 1, title, detail }); }
function shortSig(sig) { return sig ? sig.slice(0, 16) + '…(' + sig.length + ' hex)' : '(unsigned)'; }

async function main() {
  const config = loadConfig({ ...process.env, ...SYNTH_ENV });
  const store = createMemoryStore();

  const claudeProbe = await verifyClaudeInvocable({});
  const stagedExists = fs.existsSync(STAGED_READBACK);
  step('Environment probe', {
    claude_invocable: claudeProbe.invocable,
    claude_version: claudeProbe.version,
    staged_readback_present: stagedExists,
    staged_readback_path: STAGED_READBACK,
  });

  // ---- 1. Durable Tower state: the posted review is a Tower-generated ClickUp
  //         event (recorded, self-generated → never advances a run on its own).
  const run = await store.createRun({
    title: 'BUILD-010 WP0 STEP 6 — acknowledge posted Codex re-review',
    scope: 'acknowledge the posted independent Codex re-review',
    evidenceTaskRef: CONTROL_TASK_ID,
    maxRounds: 1,
  });
  const posted = await store.ingestEvent({
    source: 'clickup',
    sourceEventId: CLICKUP_COMMENT_ID,
    kind: 'task_comment.created',
    runId: run.run_id,
    selfGenerated: true, // Tower posted it (its Codex re-review) — the single authorised write
    payload: { task_id: CONTROL_TASK_ID, comment_id: CLICKUP_COMMENT_ID, is_self: true },
  });
  const claimable = await store.claimNextEvent({ runId: run.run_id });
  step('Durable Tower state seeded (posted review = self-generated ClickUp event)', {
    run_id: run.run_id,
    control_task_id: CONTROL_TASK_ID,
    posted_comment_event_id: posted.event.event_id,
    self_generated: posted.event.self_generated,
    claimable_for_advance: claimable ? claimable.source_event_id : null, // must be null: self events never advance
  });

  // ---- 2. Real Larry adapter; cwd = the staged file's dir so Read can open it.
  const larry = createLarryAdapter({
    config,
    cwd: path.dirname(STAGED_READBACK),
    mode: claudeProbe.invocable ? 'auto' : 'record-blocker',
  });
  const dispatcher = createDispatcher({ store, config, adapters: { larry } });

  // ---- 3. Dispatch the NEXT bounded Larry turn straight from durable state.
  const boundedContext = {
    expect: 'signed-ack',
    review_readback_path: STAGED_READBACK,
    control_task_id: CONTROL_TASK_ID,
    clickup_comment_id: CLICKUP_COMMENT_ID,
  };
  const d = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext });
  step('Dispatch bounded Larry ack turn (read-only, no merge tool)', {
    turn_id: d.turn.turn_id, ordinal: d.turn.ordinal, state: d.turn.state,
    allowed_tools: larry.allowedTools,
  });

  // ---- 4. Run the REAL headless claude turn. Larry reads the file itself.
  const outcome = await dispatcher.runTurn(d.turn.turn_id);
  const turn = await store.getTurn(d.turn.turn_id);
  const larryReal = !outcome.blocked;
  const secret = config.signingSecret('larry');
  const sigOk = turn.result_signature ? verifyEnvelope(turn.structured_result, turn.result_signature, secret) : false;
  const ack = turn.structured_result?.payload?.ack ?? null;
  step(`Larry ack turn returned (${larryReal ? 'REAL headless claude' : 'recorded blocker'})`, {
    state: turn.state,
    signer: turn.signer_principal,
    provider: turn.structured_result?.provider,
    signature: shortSig(turn.result_signature),
    signature_verified: sigOk,
    ack_fields: ack,
    blocker: turn.structured_result?.payload?.blocker ?? null,
  });

  // ---- 5. Assert the ack matches the truth Larry read out of the file.
  const asserts = {
    signer_is_larry: turn.signer_principal === 'larry',
    signature_verified: sigOk,
    reviewed_head_sha: ack?.reviewed_head_sha === '9fda8fd',
    codex_verdict: ack?.codex_verdict === 'approve',
    previous_medium_closed: ack?.previous_medium_closed === true,
    clickup_comment_id: ack?.clickup_comment_id === CLICKUP_COMMENT_ID,
    ack_true: ack?.ack === true,
  };
  step('Assertions on the recorded, signature-verified ack', asserts);

  // ---- 6. No second ClickUp write: this proof never constructs a ClickUp poster.
  const clickupWritesPerformed = 0; // no poster instantiated; the loop only spawned `claude`
  step('No second ClickUp write', {
    clickup_write_calls_this_step: clickupWritesPerformed,
    note: 'the single authorised bounded ClickUp write (the posted review) already happened; this step is READ + one Larry turn only',
    warwick_relay_required: false,
    path: 'Tower durable state → Tower-staged read → dispatcher → Larry turn → signed ack → dispatcher verify',
  });

  const verdict = {
    larry_read_posted_review: larryReal && Boolean(ack),
    ack_fields: ack,
    signature_verified: sigOk,
    signer_is_larry: asserts.signer_is_larry,
    warwick_relay_required: false,
    second_clickup_write_performed: false,
    all_assertions_pass: Object.values(asserts).every(Boolean),
    passed: larryReal && Object.values(asserts).every(Boolean),
  };

  writeTranscript({ config, run, turn, trail, verdict, ack, sigOk });
  process.stdout.write(JSON.stringify({ proof: 'wp0-step6-norelay-ack', verdict }, null, 2) + '\n');
  process.exit(verdict.passed ? 0 : 2);
}

function writeTranscript({ config, run, turn, trail, verdict, ack, sigOk }) {
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
  lines.push('# Fusion Tower — WP0 STEP 6: Larry no-relay signed ack (masked transcript)', '');
  lines.push('Parent build: [[BUILD-010-fusion-tower]]', '');
  lines.push('Generated by `services/fusion-tower/scripts/proof-norelay-ack.js`. Proves Larry');
  lines.push('receives the posted Codex re-review from DURABLE TOWER STATE and returns a strict');
  lines.push('signed acknowledgement — with NO Warwick copy-paste and NO second live ClickUp write.', '');
  lines.push(`- Tower run id: \`${run.run_id}\``);
  lines.push(`- Turn ordinal: \`${turn.ordinal}\` (signer \`${turn.signer_principal}\`, provider \`${turn.structured_result?.provider}\`)`);
  lines.push(`- Signature verified: **${sigOk ? 'YES' : 'NO'}**`);
  lines.push('- Second live ClickUp write performed: **NO** (the single authorised bounded write — the posted comment — already happened)');
  lines.push('- Warwick relay required: **NO** (path: Tower durable state → Tower-staged read → dispatcher → Larry turn → signed ack → dispatcher verify)', '');
  lines.push('## Larry ack fields (read by Larry from the staged file, not supplied in the prompt)', '');
  lines.push('```json');
  lines.push(JSON.stringify(ack, null, 2));
  lines.push('```', '');
  lines.push('## Verdict', '');
  lines.push('```json');
  lines.push(JSON.stringify(verdict, null, 2));
  lines.push('```', '');
  lines.push('## Masked config snapshot (proof of secret masking)', '');
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
  process.stderr.write(JSON.stringify({ proof: 'wp0-step6-norelay-ack', event: 'error', error: String(err?.message ?? err), stack: err?.stack }) + '\n');
  process.exit(1);
});
