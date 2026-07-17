// Fusion Tower — SYNTHETIC end-to-end governance-loop proof (BUILD-010 WP0 §9).
//
// Drives the whole loop against SYNTHETIC substrate (in-memory store, synthetic
// Telegram update, synthetic GitHub event, a synthetic write sink that captures
// the INTENDED GitHub/ClickUp write without performing it). The Larry turn runs a
// REAL headless `claude` when invocable; the Codex turn is a recorded blocker
// (no codex binary/key on this host). Emits ONE terminal notification and writes
// a masked transcript to Builds/BUILD-010-fusion-tower/Architecture/wp0-synthetic-proof.md.
//
// No live external write is ever performed. No secret is ever printed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createLarryAdapter, verifyClaudeInvocable } from '../src/adapters/larryAdapter.js';
import { createCodexAdapter, verifyCodexInvocable } from '../src/adapters/codexAdapter.js';
import { createTelegramControls } from '../src/adapters/telegramControls.js';
import { normalizeGithubEvent, routeResponder, TOWER_SELF_MARKER } from '../src/adapters/eventIntake.js';
import { verifyEnvelope } from '../src/core/envelope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Synthetic per-agent HMAC secrets (proof-only; NOT real, NOT committed anywhere).
const SYNTH_ENV = {
  AUTHORISED_TELEGRAM_USER_ID: '4242',
  TOWER_HMAC_SECRET_LARRY: 'proof-secret-larry-' + 'x'.repeat(24),
  TOWER_HMAC_SECRET_GPT_CODEX: 'proof-secret-codex-' + 'y'.repeat(24),
  TOWER_HMAC_SECRET_TOWER: 'proof-secret-tower-' + 'z'.repeat(24),
  // Deliberately NO CODEX_API_KEY — proves the fail-closed recorded blocker.
};

const trail = [];
function step(title, detail) { trail.push({ n: trail.length + 1, title, detail }); }
function shortSig(sig) { return sig ? sig.slice(0, 16) + '…(' + sig.length + ' hex)' : '(unsigned)'; }

async function main() {
  const config = loadConfig({ ...process.env, ...SYNTH_ENV });
  const store = createMemoryStore();

  // Probe both runtimes honestly.
  const claudeProbe = await verifyClaudeInvocable({});
  const codexProbe = await verifyCodexInvocable({});
  step('Environment probe', {
    claude_invocable: claudeProbe.invocable,
    claude_version: claudeProbe.version,
    codex_invocable: codexProbe.invocable,
    codex_error: codexProbe.error,
    codex_api_key_present: Boolean(config.codexApiKey),
  });

  // Real Larry adapter (live if claude is invocable), Codex adapter (auto → blocker).
  const larry = createLarryAdapter({ config, cwd: __dirname, mode: claudeProbe.invocable ? 'auto' : 'record-blocker' });
  const gpt_codex = createCodexAdapter({ config, cwd: __dirname, mode: 'auto' });
  const dispatcher = createDispatcher({ store, config, adapters: { larry, gpt_codex } });
  const controls = createTelegramControls({ config, dispatcher });
  dispatcher.setNotifier(controls.notifier);

  // Synthetic write sink — captures the INTENDED GitHub/ClickUp write, never live.
  const sink = [];
  function synthPost(action, { self = false } = {}) {
    const record = { ...action, marker: self ? TOWER_SELF_MARKER : undefined, performed: false, note: 'SYNTHETIC — captured, not sent live' };
    sink.push(record);
    return record;
  }

  // ---- 1. Synthetic Telegram /start ---------------------------------------
  const startUpdate = { update_id: 1, message: { text: '/start improve the BUILD-010 README wording', from: { id: 4242 }, chat: { id: 4242, type: 'private' } } };
  const started = await controls.handleUpdate(startUpdate);
  const run = started.run;
  step('Synthetic Telegram /start → run created', { authorised: started.ok, run_id: run.run_id, status: run.status, scope: run.scope });

  // ---- 2. Dispatch a bounded Larry turn -----------------------------------
  const larryCtx = { task: 'Reply with ONLY this JSON: {"summary":"README wording reviewed","proposed_action":{"type":"post_comment"},"confidence":1}' };
  const d1 = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'larry', boundedContext: larryCtx });
  step('Dispatch Larry turn (bounded, scoped, no merge tool)', { turn_id: d1.turn.turn_id, ordinal: d1.turn.ordinal, state: d1.turn.state, lease_ms: d1.turn.lease_deadline_at - d1.turn.dispatched_at });

  // ---- 3. Run the Larry turn (REAL claude when invocable) ------------------
  const r1 = await dispatcher.runTurn(d1.turn.turn_id);
  const turn1 = await store.getTurn(d1.turn.turn_id);
  const larryReal = !r1.blocked;
  const sig1Ok = turn1.result_signature ? verifyEnvelope(turn1.structured_result, turn1.result_signature, config.signingSecret('larry')) : false;
  step(`Larry turn returned (${larryReal ? 'REAL headless claude' : 'recorded blocker'})`, {
    state: turn1.state,
    signer: turn1.signer_principal,
    provider: turn1.structured_result?.provider,
    signature: shortSig(turn1.result_signature),
    signature_verified: sig1Ok,
    summary: turn1.structured_result?.payload?.summary ?? turn1.structured_result?.payload?.blocker,
    proposed_action: turn1.structured_result?.payload?.proposed_action,
  });

  // ---- 4. Post Larry's result to a SYNTHETIC target -----------------------
  if (larryReal && r1.action) {
    const posted = synthPost({ ...r1.action, repo: 'Fusion247/Fusion247PKA', body: 'README wording LGTM' }, { self: true });
    await dispatcher.ingestAndBind({ source: 'tower', sourceEventId: 'tower-comment-1', kind: 'issue_comment.created', selfGenerated: true, payload: { pr_ref: 'Fusion247/Fusion247PKA#0', is_self: true } }, { runId: run.run_id });
    step('Post Larry result to SYNTHETIC target (self-marked; self-loop recorded)', { intended_action: posted.type, performed: posted.performed, self_marker: Boolean(posted.marker) });
  }
  // Close round 1 (Larry's implementation); the run's maxRounds=2 leaves room for
  // the Codex review round.
  await store.incrementRound(run.run_id, { now: Date.now() });

  // ---- 5. Synthetic GitHub check event + dedup + self-loop -----------------
  const ghCheck = { check_suite: { head_sha: 'abc123def', conclusion: 'success', app: { slug: 'ci' } } };
  const norm = normalizeGithubEvent(ghCheck, 'gh-delivery-77');
  const e1 = await dispatcher.ingestAndBind(norm, { runId: run.run_id, boundResponder: routeResponder(norm) });
  const e1dup = await dispatcher.ingestAndBind(norm, { runId: run.run_id }); // redelivery
  const e1rerun = await dispatcher.ingestAndBind({ ...norm, sourceEventId: 'gh-delivery-99' }, { runId: run.run_id }); // same sha rerun, new id
  // The tower's own comment echo must NOT be claimable for advance.
  const claimable = await store.claimNextEvent({ runId: run.run_id });
  step('Synthetic GitHub check_suite ingested + deduped + bound', {
    kind: norm.kind, head_sha: norm.headSha, routed_to: routeResponder(norm),
    first_isNew: e1.isNew, redelivery_isNew: e1dup.isNew, sha_rerun_isNew: e1rerun.isNew,
    claimable_event: claimable?.source_event_id ?? null,
    self_events_never_claimable: claimable?.source !== 'tower',
  });
  await store.markEventProcessed(e1.event.event_id, { now: Date.now() });
  await store.setEvidence(run.run_id, { prRef: 'Fusion247/Fusion247PKA#0', commitSha: 'abc123def' }, { now: Date.now() });

  // ---- 6. Dispatch the Codex review turn -----------------------------------
  const d2 = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'gpt_codex', boundedContext: { task: 'Review the change on head abc123def', source_event_id: 'gh-delivery-77' } });
  step('Dispatch Codex review turn (honest gpt_codex = openai-codex)', { turn_id: d2.turn.turn_id, ordinal: d2.turn.ordinal, state: d2.turn.state });

  // ---- 7. Run the Codex turn (recorded blocker — no codex on this host) ----
  const r2 = await dispatcher.runTurn(d2.turn.turn_id);
  const turn2 = await store.getTurn(d2.turn.turn_id);
  const sig2Ok = turn2.result_signature ? verifyEnvelope(turn2.structured_result, turn2.result_signature, config.signingSecret('gpt_codex')) : false;
  step(`Codex turn returned (${r2.blocked ? 'recorded blocker — fail-closed' : 'REAL codex'})`, {
    state: turn2.state,
    signer: turn2.signer_principal,
    provider: turn2.structured_result?.provider,
    signature: shortSig(turn2.result_signature),
    signature_verified: sig2Ok,
    blocker: turn2.structured_result?.payload?.blocker,
  });

  // ---- 8. No-autonomous-merge guardrail demonstration ----------------------
  let mergeBlocked = false;
  try {
    const { assertNoAutonomousMerge } = await import('../src/core/guardrails.js');
    assertNoAutonomousMerge({ type: 'merge', repo: 'Fusion247/Fusion247PKA' });
  } catch (err) { mergeBlocked = /NO-AUTONOMOUS-MERGE/.test(String(err.message)); }
  step('No-autonomous-merge guardrail', { merge_attempt_rejected: mergeBlocked });

  // ---- 9. ONE terminal notification ---------------------------------------
  // Honest WP0 outcome: the review turn is a recorded blocker, so the run
  // surfaces BLOCKED with the exact codex gate as the reason. With the Warwick-
  // owned codex credential present, the SAME loop surfaces READY instead.
  let terminal;
  if (r2.blocked) {
    terminal = await dispatcher.terminate(run.run_id, 'blocked', 'blocked', `Codex review gate: ${turn2.structured_result?.payload?.blocker}`);
  } else {
    terminal = await dispatcher.surfaceReady(run.run_id, 'PR green; awaiting your merge (never auto-merged)');
  }
  const finalRun = await store.getRun(run.run_id);
  const terminalNotices = dispatcher.notices.filter((n) => ['READY', 'BLOCKED', 'TIMED_OUT', 'DECISION_REQUIRED', 'CLOSED'].includes(n.kind));
  step('ONE terminal notification emitted', {
    kind: terminal.kind, run_status: finalRun.status, terminal_outcome: finalRun.terminal_outcome,
    total_terminal_notices: terminalNotices.length,
    outbox_transport: controls.outbox.at(-1)?.transport,
  });

  // ---- verdict -------------------------------------------------------------
  const verdict = {
    larry_turn: larryReal ? 'REAL headless claude' : 'recorded blocker',
    codex_turn: r2.blocked ? 'recorded blocker (no codex credential/binary)' : 'REAL codex',
    signatures_verified: sig1Ok && (turn2.result_signature ? sig2Ok : true),
    dedup_ok: e1.isNew && !e1dup.isNew && !e1rerun.isNew,
    self_loop_filtered: claimable?.source !== 'tower',
    single_terminal_notice: terminalNotices.length === 1,
    no_autonomous_merge: mergeBlocked,
    no_live_writes: sink.every((s) => s.performed === false),
    passed: larryReal && sig1Ok && e1.isNew && !e1dup.isNew && !e1rerun.isNew && mergeBlocked && terminalNotices.length === 1,
  };

  writeTranscript({ config, trail, verdict, sink, notices: dispatcher.notices });
  process.stdout.write(JSON.stringify({ proof: 'wp0-synthetic-e2e', verdict }, null, 2) + '\n');
  process.exit(verdict.passed ? 0 : 2);
}

function writeTranscript({ config, trail, verdict, sink, notices }) {
  const out = path.join(__dirname, '..', '..', '..', 'Builds', 'BUILD-010-fusion-tower', 'Architecture', 'wp0-synthetic-proof.md');
  const masked = config.describe(); // every secret masked
  const lines = [];
  lines.push('---');
  lines.push('build: BUILD-010');
  lines.push('component: Fusion Tower / Governance Mode');
  lines.push('wp: WP0');
  lines.push('artifact: wp0-synthetic-proof');
  lines.push('status: generated');
  lines.push('author: mack');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('---', '');
  lines.push('# Fusion Tower — WP0 Synthetic End-to-End Proof (masked transcript)', '');
  lines.push('Parent build: [[BUILD-010-fusion-tower]]', '');
  lines.push('Generated by `services/fusion-tower/scripts/proof-e2e.js`. Drives the whole');
  lines.push('governance loop against SYNTHETIC substrate: no live external write, no secret');
  lines.push('printed. The Larry turn runs a REAL headless `claude`; the Codex turn is a');
  lines.push('fail-closed recorded blocker (no codex binary/key on this host).', '');
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
  lines.push('## Synthetic write sink (intended writes — NONE performed live)', '');
  lines.push('```json');
  lines.push(JSON.stringify(sink, null, 2));
  lines.push('```', '');
  lines.push('## Terminal notices surfaced to Warwick', '');
  lines.push('```json');
  lines.push(JSON.stringify(notices, null, 2));
  lines.push('```', '');
  fs.writeFileSync(out, lines.join('\n'));
}

main().catch((err) => {
  process.stderr.write(JSON.stringify({ proof: 'wp0-synthetic-e2e', event: 'error', error: String(err?.message ?? err), stack: err?.stack }) + '\n');
  process.exit(1);
});
