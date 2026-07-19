// Tower baton — the watcher. ONE poll cycle carries the baton end to end.
//
// Cross-build by construction: everything is keyed on the checkpoint's own
// build_id / wp_id / brief_ref, so the same watcher serves ANY build, not just
// BUILD-010.
//
// A poll cycle (pollOnce):
//   (a) the caller holds the single-watcher lock (bin/tower-watch.js acquires it);
//   (b) read the thread → parse [LARRY → TOWER] checkpoints;
//   (c) dedup by checkpoint_id vs durable state AND — cold start — rebuild dedup
//       truth from the thread (already-answered checkpoint_ids). Thread is the
//       source of truth; the state file is a cache (Fable nit #2);
//   (d) resolve the approved brief (brief_ref) + WP scope;
//   (e) verify branch / exact head_sha / diff / CI via githubEvidence (fail-closed);
//   (f) load the QA skill fresh + fingerprint (SHA-256 recorded on the verdict);
//   (g) invoke Codex read-only QA with the bounded packet;
//   (h) post the [TOWER → LARRY] reply to the thread (additive comment);
//   (i) update durable state incl. the PER-CHAIN round counter (Fable nit #4;
//       max 3 → escalate DECISION_REQUIRED / BLOCKED);
//   (j) emit the milestone Telegram (review_posted / escalation / blocked).
// NO autonomous merge anywhere.

import fsDefault from 'node:fs';
import path from 'node:path';

import { parseCheckpoint, chainKey, formatResponse, answeredCheckpointIds } from './checkpoint.js';
import { loadQaSkill } from './qaSkill.js';
import { composeReviewBriefing } from './reviewVoice.js';

export const DEFAULT_MAX_ROUNDS = 3;

// Per-cycle WATCHDOG bound (WP1). A single checkpoint's processing must NEVER be able
// to hang the poll loop silently. This deadline sits OUTSIDE the codex turn timeout
// (default 8min) so that: codex reaps its own process tree first; if a cycle still
// exceeds this bound for ANY reason, the watcher ABORTS the cycle, posts a recoverable
// TOWER_RUN_FAILED verdict, and KEEPS POLLING. Default 12min > the 8min codex timeout.
export const DEFAULT_CYCLE_WATCHDOG_MS = 12 * 60 * 1000;
// The recoverable-failure post (ClickUp reply + milestone) is itself bounded so it can
// never wedge the loop it is trying to rescue. Best-effort within this deadline.
export const DEFAULT_FAILURE_POST_DEADLINE_MS = 30 * 1000;

/** Race a promise against a deadline WITHOUT ever rejecting -- resolves `onTimeout` if the
 *  deadline wins. The timer is always cleared once either side settles, so it never
 *  lingers; it is NOT unref'd, because the whole point is that the deadline must be able
 *  to FIRE even when the wrapped operation is wedged (an unref'd deadline can be skipped
 *  when nothing else keeps the loop alive). */
function withDeadline(promise, ms, onTimeout) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(onTimeout); } }, ms);
    Promise.resolve(promise).then(done, () => done(onTimeout));
  });
}

// Only these extensions are accepted as local-file briefs. A brief is staged verbatim
// into the Codex prompt, so it must be plain human-readable build text — never a binary,
// a script, or a dotfile secret store.
export const ALLOWED_BRIEF_EXT = Object.freeze(new Set(['.md', '.markdown', '.txt']));
// Hard cap on a local brief before it is read (stat-gated). A brief is documentation,
// not a data dump; anything larger is refused rather than slurped into memory/the prompt.
export const MAX_BRIEF_BYTES = 1_000_000; // 1 MB

/** Resolve the approved brief from a brief_ref. Fail-closed when it cannot be read. */
export async function resolveBrief(briefRef, { fs = fsDefault, clickup = null, taskId = null, repoRoot = null } = {}) {
  if (!briefRef) return { ok: false, error: 'fail-closed: missing brief_ref' };
  // A local path (a build brief / WP doc in the repo) — but ONLY inside the governed
  // repo root. A brief_ref is attacker-influenceable (any comment on the control task),
  // its content is staged verbatim into the Codex prompt, and Codex's summary is posted
  // to ClickUp — so an unconstrained read of e.g. C:\.fusion247\*.env would exfiltrate
  // secrets. CONTAINMENT (fail-closed at every step, only when repoRoot is provided):
  //   1. LEXICAL: the resolved path must not escape repoRoot (../, absolute-external) —
  //      caught even when the target does not exist;
  //   2. extension allowlist (.md/.markdown/.txt);
  //   3. stat + size cap BEFORE reading (must exist as a real file);
  //   4. REAL-path containment: realpath BOTH sides (resolving symlinks/junctions) and
  //      require the real target to stay inside the real root — defeats a link inside
  //      the repo that points outside;
  //   5. read + 8000-char excerpt cap.
  const cuLike = /(?:clickup\.com\/t\/|^CU-)/i.test(String(briefRef));
  if (!cuLike) {
    try {
      const abs = path.resolve(repoRoot ?? process.cwd(), briefRef);

      // 1. LEXICAL containment (fires even if the target is absent).
      if (repoRoot) {
        const root = path.resolve(repoRoot);
        const rel = path.relative(root, abs);
        if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
          return { ok: false, error: `fail-closed: brief_ref resolves OUTSIDE the governed repo root — refused (${briefRef})` };
        }
      }

      // 3. stat first (size + is-file) BEFORE any read.
      let st = null;
      try { st = fs.statSync(abs); } catch { st = null; }
      if (st && st.isFile()) {
        // 2. extension allowlist.
        const ext = path.extname(abs).toLowerCase();
        if (!ALLOWED_BRIEF_EXT.has(ext)) {
          return { ok: false, error: `fail-closed: brief_ref extension "${ext || '(none)'}" is not an allowed brief type (.md/.markdown/.txt) — refused (${briefRef})` };
        }
        if (st.size > MAX_BRIEF_BYTES) {
          return { ok: false, error: `fail-closed: brief_ref file is too large (${st.size} bytes > ${MAX_BRIEF_BYTES}) — refused (${briefRef})` };
        }
        // 4. REAL-path containment (symlink/junction escape defence) — only when governed.
        if (repoRoot) {
          let realRoot;
          let realCandidate;
          try { realRoot = fs.realpathSync(path.resolve(repoRoot)); }
          catch { return { ok: false, error: `fail-closed: governed repo root does not resolve (${repoRoot})` }; }
          try { realCandidate = fs.realpathSync(abs); }
          catch { return { ok: false, error: `fail-closed: brief_ref real path does not resolve (${briefRef})` }; }
          const relReal = path.relative(realRoot, realCandidate);
          if (relReal === '' || relReal.startsWith('..') || path.isAbsolute(relReal)) {
            return { ok: false, error: `fail-closed: brief_ref real path escapes the governed repo root (symlink/junction) — refused (${briefRef})` };
          }
        }
        // 5. read + excerpt cap.
        const text = fs.readFileSync(abs, 'utf8');
        if (text && text.trim()) return { ok: true, kind: 'file', excerpt: text.slice(0, 8000), ref: briefRef };
        return { ok: false, error: `fail-closed: brief_ref file is empty (${briefRef})` };
      }
    } catch { /* not a readable path — try other shapes */ }
  }
  // A ClickUp task ref (CU-<id> / a task url) — read its description as the brief.
  const cuMatch = String(briefRef).match(/(?:clickup\.com\/t\/|CU-)([A-Za-z0-9]+)/i);
  if (cuMatch && clickup && typeof clickup.getTask === 'function') {
    try {
      const task = await clickup.getTask(cuMatch[1]);
      const desc = task?.description ?? task?.text_content ?? '';
      if (desc && desc.trim()) return { ok: true, kind: 'clickup', excerpt: desc.slice(0, 8000), ref: briefRef };
    } catch { /* fall through to fail-closed */ }
  }
  return { ok: false, error: `fail-closed: brief_ref could not be resolved (${briefRef})` };
}

/**
 * Map the Codex structured result + round/finding context → the baton verdict.
 * Returns { verdict, material_findings[], next_action }.
 *   · a blocked Codex turn         → BLOCKED
 *   · a critical/security finding   → DECISION_REQUIRED (material — Warwick decides)
 *   · max rounds already spent      → DECISION_REQUIRED (escalate, don't doom-loop)
 *   · approve (or comment/no-find)  → APPROVE
 *   · request_changes / comment+find→ CORRECTIONS_REQUIRED
 */
export function deriveVerdict({ codexResult, roundsSpent, maxRounds = DEFAULT_MAX_ROUNDS }) {
  if (!codexResult || codexResult.status === 'blocked') {
    return { verdict: 'BLOCKED', material_findings: [], next_action: `Codex QA is blocked (${codexResult?.kind ?? 'fail-closed'}). Resolve the blocker (binary/credential/evidence) and re-hand off; do not proceed unsupervised.` };
  }
  const findings = Array.isArray(codexResult.findings) ? codexResult.findings : [];
  const material = pickMaterialFindings(findings);
  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasSecurityScope = findings.some((f) => /security|privacy|scope|architect/i.test(`${f.id} ${f.rationale} ${f.required_correction}`));

  if (roundsSpent >= maxRounds) {
    return { verdict: 'DECISION_REQUIRED', material_findings: material, next_action: `Max correction rounds (${maxRounds}) reached for this chain — escalating to Warwick. Do not open another autonomous round.` };
  }
  if (hasCritical || hasSecurityScope) {
    return { verdict: 'DECISION_REQUIRED', material_findings: material, next_action: 'Material issue (critical / security / scope) — escalate to Warwick for a decision before proceeding.' };
  }
  if (codexResult.verdict === 'approve' || (codexResult.verdict === 'comment' && findings.length === 0)) {
    return { verdict: 'APPROVE', material_findings: material, next_action: 'Approved against the brief + evidence. Proceed to the next WP step / final review.' };
  }
  return { verdict: 'CORRECTIONS_REQUIRED', material_findings: material, next_action: 'Apply the named corrections, push a new head, and re-hand off the new checkpoint.' };
}

/** Pick <=3 material findings — but let safety (critical) findings exceed the cap. */
export function pickMaterialFindings(findings) {
  const arr = Array.isArray(findings) ? findings : [];
  const criticals = arr.filter((f) => f.severity === 'critical');
  const rest = arr.filter((f) => f.severity !== 'critical');
  const chosen = [...criticals];
  for (const f of rest) { if (chosen.length >= 3) break; chosen.push(f); }
  return chosen.map((f) => `[${f.severity}] ${f.id}: ${String(f.required_correction ?? f.rationale ?? '').slice(0, 200)}`);
}

/**
 * Create the watcher.
 * @param {object} deps
 * @param {object} deps.config        loadConfig() result
 * @param {object} deps.clickup       ClickUp client (getTaskComments/createTaskComment[, getTask])
 * @param {object} deps.github        createGithubEvidence() result
 * @param {object} deps.codex         createCodexAdapter() result
 * @param {object} deps.notifier      createMilestoneNotifier() result
 * @param {object} deps.state         openState() result
 * @param {string} deps.taskId        the ClickUp control task id
 * @param {string} deps.qaSkillPath   path to tower-qa-skill.md
 * @param {number} [deps.maxRounds]   per-chain correction-round budget (default 3)
 * @param {object} [deps.fs]          injectable fs (brief + skill reads)
 * @param {function} [deps.now]       injectable clock () => epoch ms
 * @param {function} [deps.log]       injectable logger (redacted by the caller)
 */
export function createWatcher({ config, clickup, github, codex, notifier, state, taskId, qaSkillPath, repoRoot = null, maxRounds = DEFAULT_MAX_ROUNDS, fs = fsDefault, now = Date.now, log = () => {}, cycleWatchdogMs = DEFAULT_CYCLE_WATCHDOG_MS, failurePostDeadlineMs = DEFAULT_FAILURE_POST_DEADLINE_MS } = {}) {
  let reconciled = false;
  // Re-entrancy guard: a Codex turn (~60s) is far longer than the poll interval (~15s),
  // so overlapping setInterval ticks would each start a duplicate Codex turn on the SAME
  // checkpoint before any records "answered" (observed in the live proof: 4 duplicate
  // reviews + 4 posted replies). One cycle at a time.
  let polling = false;

  /** Cold-start: rebuild dedup truth from the thread (Fable nit #2). Idempotent. */
  async function reconcileFromThread() {
    const comments = await clickup.getTaskComments(taskId);
    const ids = answeredCheckpointIds(comments);
    state.mergeAnsweredIds([...ids]);
    reconciled = true;
    return { rebuiltFromThread: [...ids] };
  }

  /**
   * Process ONE parsed checkpoint end to end. Returns a result record. Never posts a
   * merge. Fail-closed at each gate (bad head, missing brief, malformed skill,
   * Codex blocked) → a BLOCKED reply is still posted so Larry always gets an answer.
   */
  async function processCheckpoint(checkpoint, progress = { stage: 'start' }) {
    const cpId = checkpoint.checkpoint_id;
    // (c) dedup — already answered?
    if (state.isAnswered(cpId)) return { checkpointId: cpId, skipped: 'already-answered' };

    const ck = chainKey(checkpoint);

    // (d) resolve the approved brief + WP scope. Fail-closed + repo-root-contained.
    progress.stage = 'resolve_brief';
    const brief = await resolveBrief(checkpoint.brief_ref, { fs, clickup, taskId, repoRoot });

    // (f) load the QA skill fresh + fingerprint. Fail-closed.
    progress.stage = 'load_skill';
    const skill = loadQaSkill({ path: qaSkillPath, fs });

    // (e) verify branch / exact head / diff / CI. Fail-closed.
    progress.stage = 'collect_evidence';
    const evidence = await github.collect({
      branch: checkpoint.branch, headSha: checkpoint.head_sha, baseSha: checkpoint.base_sha, repo: config?.githubRepo,
    });

    // Assemble the fail-closed blockers (any one blocks the QA turn).
    const gateBlockers = [];
    if (!brief.ok) gateBlockers.push(brief.error);
    if (!skill.ok) gateBlockers.push(skill.error);
    if (!evidence.ok) gateBlockers.push(evidence.error);
    // Branch binding is EXPLICIT — no silent null-permissiveness:
    //   · DEFAULT (branch-bound): the branch MUST resolve AND its head MUST equal
    //     head_sha. Drift (resolves, wrong head) → fail closed; unresolvable branch →
    //     fail closed (use an explicit review_mode: pinned_sha for a pinned-SHA review).
    //   · review_mode: pinned_sha: head existence + diff are still bound to the exact
    //     SHA (already verified by evidence.ok); branch resolution is skipped BY DESIGN.
    if (evidence.ok) {
      const pinnedSha = checkpoint.review_mode === 'pinned_sha';
      if (!pinnedSha) {
        if (evidence.headMatchesBranch === false) {
          gateBlockers.push(`fail-closed: head_sha ${checkpoint.head_sha} is not the current head of ${checkpoint.branch} (branch is at ${evidence.branchHeadSha}) — a new head invalidates this checkpoint`);
        } else if (evidence.headMatchesBranch === null || evidence.branchResolved === false) {
          gateBlockers.push(`fail-closed: branch ${checkpoint.branch} could not be resolved — a branch-bound checkpoint requires a resolvable branch; set an explicit "review_mode: pinned_sha" checkpoint for a pinned-SHA-only review`);
        }
      }
    }

    const roundsSpent = state.roundCount(ck);
    let codexResult = null;
    let signed = null;
    const promptFingerprint = skill.fingerprint ?? null;

    let derived;
    if (gateBlockers.length) {
      // Do NOT invoke Codex when a gate is closed — respond BLOCKED with the reasons.
      derived = { verdict: 'BLOCKED', material_findings: gateBlockers.slice(0, 3).map((b) => `[gate] ${b}`), next_action: 'Resolve the fail-closed gate(s) above, then re-hand off. Do not proceed unsupervised.' };
    } else if (roundsSpent >= maxRounds) {
      // (i) round budget exhausted for this chain → escalate WITHOUT another Codex turn.
      derived = { verdict: 'DECISION_REQUIRED', material_findings: [], next_action: `Max correction rounds (${maxRounds}) reached for this chain — escalating to Warwick.` };
    } else {
      // (g) invoke Codex read-only QA.
      const packet = {
        checkpoint_id: checkpoint.checkpoint_id ?? null, build_id: checkpoint.build_id ?? null, wp_id: checkpoint.wp_id ?? null,
        repo: config?.githubRepo ?? null, branch: checkpoint.branch, head_sha: evidence.headSha,
        base_sha: checkpoint.base_sha ?? null, diff_range: evidence.diffRange, changed_files: evidence.changedFiles,
        diff_text: evidence.diffText ?? null, diff_truncated: Boolean(evidence.diffTruncated),
        brief_ref: checkpoint.brief_ref, brief_excerpt: brief.excerpt ?? null,
        summary: checkpoint.summary ?? null, tests: checkpoint.tests ?? null,
        evidence_refs: checkpoint.evidence_refs ?? [],
        ci_checks: (evidence.checks ?? []).map((c) => `${c.name}:${c.conclusion ?? c.status}`).join(', ') || (evidence.checksError ?? 'none'),
      };
      progress.stage = 'codex_turn';
      const turn = await codex.runTurn({ checkpoint, packet, skillText: skill.text, promptFingerprint });
      codexResult = turn.structuredResult ?? null;
      signed = { envelope: turn.envelope, signature: turn.signature };
      derived = deriveVerdict({ codexResult, roundsSpent, maxRounds });
    }

    // (h) compose + post the [TOWER → LARRY] reply (additive comment).
    const responseObj = {
      checkpoint_id: cpId,
      reviewed_head: evidence.headSha ?? checkpoint.head_sha,
      prompt_fingerprint: promptFingerprint ?? '(skill-unavailable)',
      verdict: derived.verdict,
      summary: codexResult?.summary ?? (derived.verdict === 'BLOCKED' ? 'Review blocked at a fail-closed gate — see material_findings.' : 'Escalated for a human decision.'),
      material_findings: derived.material_findings,
      next_action: derived.next_action,
    };
    // Redact any known secret VALUE before it can reach a ClickUp comment (defence in
    // depth behind brief_ref containment — the reply is public in the thread).
    const body = config?.redact ? config.redact(formatResponse(responseObj)) : formatResponse(responseObj);
    progress.stage = 'post_reply';
    let posted = null;
    try {
      posted = await clickup.createTaskComment(taskId, body);
    } catch (err) {
      // A post failure is not a merge risk; surface it, do not crash the cycle.
      log(`processCheckpoint: post failed for ${cpId}: ${config?.redact ? config.redact(err?.message ?? String(err)) : (err?.message ?? String(err))}`);
      return { checkpointId: cpId, verdict: derived.verdict, posted: false, error: 'post-failed', response: responseObj };
    }

    // (i) durable state: mark answered + advance the per-chain round counter.
    progress.stage = 'record_state';
    state.recordAnswered(cpId, { reviewedHead: responseObj.reviewed_head, verdict: derived.verdict, promptFingerprint, commentId: posted.id, now: now() });
    if (derived.verdict === 'CORRECTIONS_REQUIRED') state.incrementRound(ck);

    // (j) milestone Telegram — one per outcome, deduped by checkpoint_id.
    // SAME purpose/trigger/dedup/frequency as before (Warwick uses these for UAT) --
    // only the CONTENT and the logical source change: review outcomes now speak in
    // the CODEX adviser voice (a human briefing) instead of a terse status string.
    const milestonePurpose = derived.verdict === 'BLOCKED' ? 'blocked'
      : derived.verdict === 'DECISION_REQUIRED' ? 'escalation'
      : 'review_posted';
    const briefing = composeReviewBriefing({ checkpoint, codexResult, derived, reviewedHead: responseObj.reviewed_head });
    // Redact any known secret VALUE from the briefing before it can reach Telegram
    // (defence in depth -- same discipline as the ClickUp reply body above).
    const notifyBody = config?.redact ? config.redact(briefing) : briefing;
    progress.stage = 'notify';
    await notifier.notifyMilestone({
      purpose: milestonePurpose, logicalSource: 'CODEX',
      body: notifyBody,
      checkpointId: cpId,
    });

    progress.stage = 'done';
    return { checkpointId: cpId, verdict: derived.verdict, posted: true, commentId: posted.id, response: responseObj, signed, chainKey: ck };
  }

  /**
   * WP1 -- recoverable-failure reply. When a cycle is ABORTED by the watchdog (silent
   * hang) or THROWS, post a structured [TOWER -> LARRY] verdict so Larry's handoff gets
   * an ANSWER (recoverable) instead of a silent 15-min timeout HALT. Uses the EXISTING
   * verdict vocabulary (BLOCKED) + reply format; the run-failure detail rides in
   * summary / material_findings. Every step is BOUNDED + best-effort so this rescue path
   * can never itself wedge the loop.
   *   evidence carried: checkpoint_id, reviewed_head, stage it failed at, elapsed ms, reason.
   */
  async function postRunFailure({ checkpoint, progress, kind, reason, startedAt }) {
    const cpId = checkpoint?.checkpoint_id ?? '(unknown)';
    const stage = progress?.stage ?? 'unknown';
    const elapsedMs = Math.max(0, now() - (startedAt ?? now()));
    const shortReason = String(reason ?? '').slice(0, 240);
    const responseObj = {
      checkpoint_id: cpId,
      reviewed_head: checkpoint?.head_sha ?? '(unknown)',
      prompt_fingerprint: '(run-failed)',
      // TOWER_RUN_FAILED is the run-state; the wire VERDICT stays in the existing
      // vocabulary (BLOCKED = recoverable, do-not-proceed) so nothing downstream breaks.
      verdict: 'BLOCKED',
      summary: `TOWER_RUN_FAILED (${kind}): the review cycle did not complete. state=TOWER_RUN_FAILED stage=${stage} elapsed_ms=${elapsedMs}. ${shortReason}`.trim(),
      material_findings: [
        `[${kind}] cycle aborted at stage "${stage}" after ${elapsedMs} ms`,
        `reason: ${shortReason || '(no detail)'}`,
      ],
      next_action: 'Recoverable failure -- the watcher aborted this cycle and kept polling (no HALT). Check for a wedged reviewer/process, confirm the head still resolves, then re-hand off a fresh checkpoint. Do not proceed unsupervised.',
    };
    const body = config?.redact ? config.redact(formatResponse(responseObj)) : formatResponse(responseObj);

    // BOUNDED post -- a hung ClickUp write must not re-wedge the loop it is rescuing.
    let posted = null;
    try {
      posted = await withDeadline(clickup.createTaskComment(taskId, body), failurePostDeadlineMs, null);
    } catch (err) {
      log(`postRunFailure: post failed for ${cpId}: ${config?.redact ? config.redact(err?.message ?? String(err)) : (err?.message ?? String(err))}`);
    }
    // Mark answered so a late resolution / the next poll does NOT reprocess (recovery,
    // not a slow retry loop). Best-effort.
    try {
      state.recordAnswered(cpId, { reviewedHead: responseObj.reviewed_head, verdict: 'BLOCKED', promptFingerprint: null, commentId: posted?.id ?? null, now: now() });
    } catch { /* best-effort */ }
    // BOUNDED milestone -- same "blocked" purpose the existing BLOCKED path uses.
    try {
      const ding = config?.redact ? config.redact(`BLOCKED - Tower run failed (${kind}) at stage ${stage} after ${elapsedMs} ms.`) : `BLOCKED - Tower run failed (${kind}) at stage ${stage} after ${elapsedMs} ms.`;
      await withDeadline(notifier.notifyMilestone({ purpose: 'blocked', logicalSource: 'CODEX', body: ding, checkpointId: cpId }), failurePostDeadlineMs, { sent: false });
    } catch { /* best-effort */ }

    return { checkpointId: cpId, verdict: 'BLOCKED', posted: Boolean(posted), runFailed: true, kind, stage, elapsedMs, response: responseObj };
  }

  /**
   * WP1 -- run ONE checkpoint under the outer cycle WATCHDOG. Guarantees the loop
   * recovers: whichever of {completion, error, watchdog-deadline} lands first wins, and
   * a deadline or a throw is converted into a recoverable-failure reply. The underlying
   * processing promise is abandoned on a watchdog abort (a genuinely wedged run never
   * resolves); the tightened codex tree-kill is what makes that abandonment clean.
   */
  async function processCheckpointGuarded(checkpoint) {
    const startedAt = now();
    const progress = { stage: 'start', checkpointId: checkpoint?.checkpoint_id ?? null, startedAt };
    const WATCHDOG = Symbol('watchdog');
    let timer = null;
    // The watchdog timer is intentionally NOT unref'd: it must be able to FIRE and rescue
    // a wedged cycle even if the wedged work is the only other thing pending. It is
    // always cleared in the finally below, so it never lingers past a completed cycle.
    const watchdog = new Promise((resolve) => {
      timer = setTimeout(() => resolve(WATCHDOG), cycleWatchdogMs);
    });
    try {
      const raced = await Promise.race([
        processCheckpoint(checkpoint, progress).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e })),
        watchdog,
      ]);
      if (raced === WATCHDOG) {
        log(`processCheckpointGuarded: cycle watchdog fired for ${progress.checkpointId} at stage "${progress.stage}" after ${Math.max(0, now() - startedAt)}ms -- aborting cycle, loop continues`);
        return await postRunFailure({ checkpoint, progress, kind: 'run_timeout', reason: `cycle exceeded the watchdog bound (${cycleWatchdogMs}ms) at stage "${progress.stage}"`, startedAt });
      }
      if (raced.ok) return raced.r;
      // The cycle THREW -- convert to a recoverable failure reply (never crash the loop).
      const msg = config?.redact ? config.redact(raced.e?.message ?? String(raced.e)) : (raced.e?.message ?? String(raced.e));
      log(`processCheckpointGuarded: cycle threw for ${progress.checkpointId} at stage "${progress.stage}": ${msg}`);
      return await postRunFailure({ checkpoint, progress, kind: 'run_error', reason: msg, startedAt });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    reconcileFromThread,
    processCheckpoint,

    /** One full poll cycle. Returns { processed[], skipped[], reconciled }. */
    async pollOnce() {
      if (polling) return { processed: [], skipped: [], reconciled, busy: true }; // a prior cycle is still in flight
      polling = true;
      try {
        if (!reconciled) await reconcileFromThread(); // cold-start rebuild (once per process)
        const comments = await clickup.getTaskComments(taskId);
        const processed = [];
        const skipped = [];
        for (const c of comments) {
          const parsed = parseCheckpoint(c.comment_text ?? c.text ?? '');
          if (!parsed.ok) continue; // not a checkpoint (or malformed → ignored on the read side)
          const cp = parsed.checkpoint;
          if (state.isAnswered(cp.checkpoint_id)) { skipped.push({ checkpointId: cp.checkpoint_id, reason: 'already-answered' }); continue; }
          // AUTHOR GATE (defence in depth over the [LARRY → TOWER] text marker): only an
          // allowlisted ClickUp author may trigger a Codex turn. The marker alone is NOT
          // trust — anyone can type it into a comment.
          //   · missing allowlist config → FAIL CLOSED for standing operation (refuse,
          //     do NOT default-open);
          //   · comment from an unauthorised author → IGNORED (no Codex, no reply), logged
          //     with the author id only (no secret).
          if (!config?.authorGateConfigured) {
            log(`pollOnce: TOWER_AUTHORISED_AUTHOR_IDS not configured — refusing checkpoint ${cp.checkpoint_id} (fail-closed; no review, no reply)`);
            skipped.push({ checkpointId: cp.checkpoint_id, reason: 'author-allowlist-unconfigured' });
            continue;
          }
          if (!config.isAuthorisedAuthor(c.user)) {
            log(`pollOnce: checkpoint ${cp.checkpoint_id} from unauthorised author "${c.user ?? '(unknown)'}" — ignored (no review, no reply)`);
            skipped.push({ checkpointId: cp.checkpoint_id, reason: 'unauthorised-author' });
            continue;
          }
          const r = await processCheckpointGuarded(cp);
          if (r.skipped) skipped.push({ checkpointId: r.checkpointId, reason: r.skipped });
          else processed.push(r);
        }
        return { processed, skipped, reconciled };
      } finally {
        polling = false;
      }
    },
  };
}
