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

import { parseCheckpoint, chainKey, formatResponse, formatFableResponse, terminallyAnsweredCheckpointIds, findTowerReplyFor, findFableReplyFor } from './checkpoint.js';
import { loadQaSkill } from './qaSkill.js';
import { composeReviewBriefing } from './reviewVoice.js';
import { DEFAULT_CODEX_TIMEOUT_MS } from './codexAdapter.js';
import { DEFAULT_FABLE_TIMEOUT_MS } from './fableAdapter.js';

export const DEFAULT_MAX_ROUNDS = 3;

/**
 * The MERGE-READY GATE. Merge-ready requires BOTH principals to GENUINELY APPROVE the SAME
 * head: the Codex correction-loop reviewer AND the Fable cold-final reviewer.
 *
 * HIGH C -- a `comment`/unverifiable outcome is NEVER merge-ready. deriveVerdict maps
 * verdict:'comment' + 0 findings -> APPROVE, and the reviewers are instructed to return
 * `comment` + "unverifiable" when the diff is absent/insufficient. So an empty/insufficient
 * diff could produce two DERIVED APPROVEs with NOTHING verified. The gate therefore requires
 * the RAW reviewer verdict === 'approve' for BOTH (a genuine approve), excluding
 * comment-derived approvals -- not just the derived APPROVE label.
 */
export function computeMergeReady({ codexVerdict, fableVerdict, codexRawVerdict, fableRawVerdict, codexHead, fableHead, currentHead }) {
  const bothDerivedApprove = codexVerdict === 'APPROVE' && fableVerdict === 'APPROVE';
  const bothGenuineApprove = codexRawVerdict === 'approve' && fableRawVerdict === 'approve';
  // CRIT #1 -- HEAD BINDING at the gate. merge-ready may ONLY combine a codex-approve and a
  // fable-approve that BOTH reviewed the CURRENT head. Require a NON-EMPTY currentHead AND
  // codexHead === fableHead === currentHead; a stale codex approval carried forward from an
  // earlier head can never vouch a different head.
  // HIGH #2 -- the old undefined-head ESCAPE (all three heads undefined -> headsBind=true) is
  // REMOVED: it was a latent fail-open for any future caller/test/refactor that omitted the
  // head fields. There is now no path to merge-ready without positive, matching head evidence.
  const headsBind = Boolean(currentHead) && codexHead === currentHead && fableHead === currentHead;
  return bothDerivedApprove && bothGenuineApprove && headsBind;
}

// Per-cycle WATCHDOG bound (WP1). A single checkpoint's processing must NEVER be able
// to hang the poll loop silently. This deadline sits OUTSIDE the per-turn timeouts so
// each turn reaps its own process tree first; only if a cycle STILL exceeds this bound
// for ANY reason does the watcher ABORT the cycle, post a recoverable TOWER_RUN_FAILED
// verdict, and KEEP POLLING.
//
// HIGH D -- the routed path runs codex(<=8min) + fable(<=8min) SEQUENTIALLY inside ONE
// watchdog, so the old 12min default falsely aborted a healthy slow run mid-fable (the
// real verdict fenced away, BLOCKED recorded). The watchdog MUST cover BOTH turn budgets
// plus slant: default = codexTimeout + fableTimeout + 4min slack (8+8+4 = 20min).
export const CYCLE_WATCHDOG_SLACK_MS = 4 * 60 * 1000;
export const DEFAULT_CYCLE_WATCHDOG_MS = DEFAULT_CODEX_TIMEOUT_MS + DEFAULT_FABLE_TIMEOUT_MS + CYCLE_WATCHDOG_SLACK_MS;

/**
 * Derive the per-cycle watchdog bound (finding #8). When TOWER_CYCLE_WATCHDOG_MS is set it
 * wins verbatim. Otherwise the watchdog is derived from the EFFECTIVE (possibly env-
 * overridden) turn timeouts — effectiveCodex + effectiveFable + slack — NOT the fixed
 * DEFAULT_CYCLE_WATCHDOG_MS. Without this, raising TOWER_CODEX_TIMEOUT_MS / TOWER_FABLE_
 * TIMEOUT_MS left the watchdog at the 20-min default, so a healthy-but-slow cycle whose turns
 * legitimately ran longer was falsely aborted mid-turn. Turn timeouts default to their own
 * DEFAULTs when unset, so the unset-everything case still yields DEFAULT_CYCLE_WATCHDOG_MS.
 */
export function deriveCycleWatchdogMs({ override, effectiveCodexTimeoutMs, effectiveFableTimeoutMs, slackMs = CYCLE_WATCHDOG_SLACK_MS } = {}) {
  if (Number(override) > 0) return Number(override);
  const codex = Number(effectiveCodexTimeoutMs) > 0 ? Number(effectiveCodexTimeoutMs) : DEFAULT_CODEX_TIMEOUT_MS;
  const fable = Number(effectiveFableTimeoutMs) > 0 ? Number(effectiveFableTimeoutMs) : DEFAULT_FABLE_TIMEOUT_MS;
  return codex + fable + slackMs;
}
// The recoverable-failure post (ClickUp reply + milestone) is itself bounded so it can
// never wedge the loop it is trying to rescue. Best-effort within this deadline.
export const DEFAULT_FAILURE_POST_DEADLINE_MS = 30 * 1000;
// Per-cycle READ deadline (WP1 MAJOR). The per-checkpoint watchdog only bounds the
// per-checkpoint processing; the poll cycle ALSO makes unbounded ClickUp reads BEFORE
// that (reconcileFromThread + getTaskComments). A wedged read would hold polling=true
// forever and silently stop the watcher. Every ClickUp read in a poll cycle is bounded
// by this single deadline; on a wedge the cycle ABORTS and the loop keeps polling (the
// polling flag is ALWAYS released in the finally). Default 60s -- a ClickUp read is a
// few seconds in practice; anything past this is a wedge, not a slow read.
export const DEFAULT_POLL_READ_DEADLINE_MS = 60 * 1000;

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
export async function resolveBrief(briefRef, { fs = fsDefault, clickup = null, taskId = null, repoRoot = null, readDeadlineMs = DEFAULT_POLL_READ_DEADLINE_MS } = {}) {
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
      // BOUND the ClickUp read (finding #7): a wedged getTask must not run unbounded (only
      // the 20-min cycle watchdog covered it before). A read that exceeds the deadline is
      // treated as fail-closed, never a hang that silently eats the whole cycle budget.
      const WEDGE = Symbol('brief-read-wedge');
      const task = Number(readDeadlineMs) > 0
        ? await withDeadline(clickup.getTask(cuMatch[1]), readDeadlineMs, WEDGE)
        : await clickup.getTask(cuMatch[1]);
      if (task === WEDGE) return { ok: false, error: `fail-closed: brief_ref ClickUp read exceeded ${readDeadlineMs}ms — refused (${briefRef})` };
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
 * @param {object} deps.codex         createCodexAdapter() result (correction-loop reviewer)
 * @param {object} [deps.fable]       createFableAdapter() result (cold-final reviewer). When
 *                                    present, a Codex APPROVE auto-routes into a Fable
 *                                    cold-final pass; merge-ready needs BOTH to APPROVE.
 *                                    Absent → codex-only behaviour (unchanged).
 * @param {object} deps.notifier      createMilestoneNotifier() result
 * @param {object} deps.state         openState() result
 * @param {string} deps.taskId        the ClickUp control task id
 * @param {string} deps.qaSkillPath   path to tower-qa-skill.md
 * @param {number} [deps.maxRounds]   per-chain correction-round budget (default 3)
 * @param {object} [deps.fs]          injectable fs (brief + skill reads)
 * @param {function} [deps.now]       injectable clock () => epoch ms
 * @param {function} [deps.log]       injectable logger (redacted by the caller)
 */
export function createWatcher({ config, clickup, github, codex, fable = null, notifier, state, taskId, qaSkillPath, repoRoot = null, maxRounds = DEFAULT_MAX_ROUNDS, fs = fsDefault, now = Date.now, log = () => {}, cycleWatchdogMs = DEFAULT_CYCLE_WATCHDOG_MS, failurePostDeadlineMs = DEFAULT_FAILURE_POST_DEADLINE_MS, pollReadDeadlineMs = DEFAULT_POLL_READ_DEADLINE_MS } = {}) {
  let reconciled = false;
  // When a Fable adapter is wired, a Codex APPROVE alone is NOT a terminal answer -- the
  // cold-final (Fable reply) is. reconcile + resume detection are mode-aware on this flag.
  const fableEnabled = Boolean(fable);
  // REPLY-AUTHOR TRUST (#5): only a reply authored by the Tower's OWN posting identity is
  // trusted to record answered/merge_ready or to drive a resume. config.isTrustedReplyAuthor
  // returns true for everyone when TOWER_SELF_AUTHOR_IDS is unset (legacy trust-all), so an
  // install that has not configured its self-id runs unchanged; configuring it activates the
  // gate. A forged [TOWER→LARRY]/[FABLE→LARRY] reply from any other author is ignored.
  const isTrustedReplyAuthor = (userId) => (typeof config?.isTrustedReplyAuthor === 'function' ? config.isTrustedReplyAuthor(userId) : true);
  // Generation token for reconcile (MAJOR F): a reconcile whose read wedged past the poll
  // read-deadline is ABANDONED by boundRead but keeps running; if it later resolves it must
  // NOT mutate state behind a newer cycle. Each reconcile captures a generation and no-ops
  // its mutations if a newer reconcile has since started.
  let reconcileGen = 0;
  // Re-entrancy guard: a Codex turn (~60s) is far longer than the poll interval (~15s),
  // so overlapping setInterval ticks would each start a duplicate Codex turn on the SAME
  // checkpoint before any records "answered" (observed in the live proof: 4 duplicate
  // reviews + 4 posted replies). One cycle at a time.
  let polling = false;

  /** Cold-start: rebuild dedup truth from the thread (Fable nit #2). Idempotent + generation-fenced. */
  async function reconcileFromThread() {
    const gen = ++reconcileGen; // this run's generation
    const comments = await clickup.getTaskComments(taskId);
    // MAJOR F: if a NEWER reconcile started while this one's read was in flight (e.g. this
    // read wedged past the deadline and was abandoned, and the next poll started a fresh
    // reconcile), do NOT mutate state -- the newer generation owns the rebuild.
    if (gen !== reconcileGen) return { superseded: true };
    // CRIT #1 -- HEAD-AWARE reconcile. Build the CURRENT head per live checkpoint_id from the
    // [LARRY -> TOWER] checkpoints on the thread so a terminal reply only dedups a checkpoint
    // when it reviewed the CURRENT head. A reused checkpoint_id at a NEW head B carrying only a
    // head-A terminal reply is therefore NOT marked answered -- it gets a FRESH review at B.
    const checkpointHeads = new Map();
    for (const c of comments ?? []) {
      const parsed = parseCheckpoint(c?.comment_text ?? c?.text ?? c?.body ?? '');
      if (parsed.ok && parsed.checkpoint.checkpoint_id) checkpointHeads.set(parsed.checkpoint.checkpoint_id, parsed.checkpoint.head_sha);
    }
    // Mode-aware terminal dedup: with Fable enabled a codex APPROVE without a fable reply
    // is NOT terminal, so it stays reviewable (its cold-final resumes) rather than being
    // silently marked answered from the codex reply alone (MEDIUM G #b).
    const ids = terminallyAnsweredCheckpointIds(comments, { fableEnabled, isTrustedAuthor: isTrustedReplyAuthor, checkpointHeads });
    state.mergeAnsweredIds([...ids]);
    reconciled = true;
    return { rebuiltFromThread: [...ids] };
  }

  /**
   * Process ONE parsed checkpoint end to end. Returns a result record. Never posts a
   * merge. Fail-closed at each gate (bad head, missing brief, malformed skill,
   * Codex blocked) → a BLOCKED reply is still posted so Larry always gets an answer.
   */
  async function processCheckpoint(checkpoint, progress = { stage: 'start' }, fence = { active: true }, { comments = [] } = {}) {
    const cpId = checkpoint.checkpoint_id;
    // FENCE (WP1 CRITICAL): the outer watchdog can ABORT this cycle (Promise.race) while
    // this run is still alive. If codex/evidence/ClickUp later resolves, an abandoned run
    // must NEVER post a (contradictory) verdict, overwrite the answered state, increment
    // the round counter, or notify. Before EVERY externally-visible side effect we check
    // we are still the ACTIVE generation; if the watchdog already fired/superseded us, we
    // no-op and log. The watchdog abort flips fence.active in processCheckpointGuarded.
    const stillActive = (where) => {
      if (fence.active) return true;
      log(`processCheckpoint: ${cpId} superseded (watchdog already fired) -- suppressing late side effect at "${where}"`);
      return false;
    };
    // (c) dedup — already answered AT THIS HEAD? CRIT #1 (durable-cache arm): the dedup is
    // HEAD-BOUND, so a checkpoint_id genuinely answered at an EARLIER head does not short-circuit
    // a REUSE of that id at the CURRENT head -- it runs a fresh review. A re-post at the SAME head
    // is still deduped. (Mirrors the head-bound pollOnce short-circuit below; both gates agree.)
    if (state.isAnswered(cpId, checkpoint.head_sha)) return { checkpointId: cpId, skipped: 'already-answered' };

    const ck = chainKey(checkpoint);

    // RESUME / IDEMPOTENCY from the thread (MEDIUM G). The ClickUp thread is the source of
    // truth; a durable in-progress marker is a fast-path hint behind it.
    const priorFable = fableEnabled ? findFableReplyFor(comments, cpId, { isTrustedAuthor: isTrustedReplyAuthor }) : null;
    const priorTower = findTowerReplyFor(comments, cpId, { isTrustedAuthor: isTrustedReplyAuthor });
    const inProgress = state.getInProgress ? state.getInProgress(cpId) : null;

    if (priorFable && priorFable.reviewed_head && priorFable.reviewed_head === checkpoint.head_sha) {
      // The cold-final terminal already landed on the thread for THIS EXACT head (e.g. a
      // crash/timeout right AFTER the fable post but BEFORE recordAnswered). Record it
      // answered idempotently -- never re-run codex/fable, never post a duplicate reply.
      // CRIT #1 -- HEAD BIND: this idempotency path is ONLY valid when the fable reply
      // reviewed the CURRENT checkpoint head. A merge-ready fable reply for a DIFFERENT head
      // (a reused checkpoint_id at a NEW head B while a head-A fable reply exists on the
      // thread) must NOT record answered and must NOT import merge_ready -- so we fall through
      // to a FRESH review at the current head (the same way the resume path discards a stale
      // approval). merge_ready is only ever trusted from a reply for the MATCHING head.
      state.recordAnswered(cpId, { reviewedHead: priorFable.reviewed_head, verdict: priorFable.verdict, promptFingerprint: priorFable.prompt_fingerprint, commentId: priorFable.comment_id, now: now(), mergeReady: priorFable.merge_ready === 'yes' });
      return { checkpointId: cpId, skipped: 'already-answered-thread' };
    }

    // Resume at the FABLE step when codex has already APPROVE-posted for this head but the
    // cold-final has not run yet (MEDIUM G #a fable-post-failure, #b crash between posts).
    // Sourced from the durable marker OR, crash-safe, inferred from the thread's codex
    // APPROVE reply. On resume codex is NEVER re-run and its [TOWER -> LARRY] reply is NOT
    // re-posted.
    // CRIT #1 -- HEAD-BINDING on resume. The stored codex approval (durable marker OR the
    // [TOWER→LARRY] APPROVE on the thread) is only resumable when the head it reviewed EQUALS
    // the CURRENT checkpoint head. Without this bind, reusing a checkpoint_id at a NEW head B
    // (after codex approved head A and the Fable post failed) would resume-to-Fable on B while
    // ONLY Fable ever reviewed B -- a single-reviewer merge-ready, breaking the CRIT-2 invariant.
    // On a mismatch we do NOT resume: we discard the stale approval and fall through to a FRESH
    // codex turn on the current head (skipCodexPost stays false, codex.runTurn runs).
    const storedReviewedHead = inProgress?.reviewed_head ?? priorTower?.reviewed_head ?? null;
    const resumeHeadBinds = Boolean(storedReviewedHead) && storedReviewedHead === checkpoint.head_sha;
    const resumeFable = fableEnabled && !priorFable && resumeHeadBinds
      && (inProgress?.stage === 'awaiting_fable' || (priorTower && priorTower.verdict === 'APPROVE'));
    const resumeMeta = resumeFable
      ? {
        reviewedHead: storedReviewedHead,
        promptFingerprint: inProgress?.prompt_fingerprint ?? priorTower?.prompt_fingerprint ?? null,
        codexCommentId: inProgress?.codex_comment_id ?? priorTower?.comment_id ?? null,
        // RAW codex verdict is only known from the durable marker; a crash-only resume (no
        // marker) cannot confirm a GENUINE approve, so merge_ready fails closed (raw=null).
        codexRawVerdict: inProgress?.codex_verdict ?? null,
      }
      : null;

    // (d) resolve the approved brief + WP scope. Fail-closed + repo-root-contained.
    progress.stage = 'resolve_brief';
    const brief = await resolveBrief(checkpoint.brief_ref, { fs, clickup, taskId, repoRoot, readDeadlineMs: pollReadDeadlineMs });

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
    // The bounded review packet -- hoisted to the cycle scope so the Fable cold-final turn
    // can review the SAME head/diff/pointers Codex reviewed (built only on the codex-invoke
    // path; a gate-block/round-exhaust never reaches an APPROVE and so never routes to Fable).
    let packet = null;
    const promptFingerprint = skill.fingerprint ?? null;

    // Build the bounded review packet from evidence (used by codex on the fresh path AND
    // by fable on both fresh + resume paths). Only meaningful once the evidence gate is open.
    const buildPacket = () => ({
      checkpoint_id: checkpoint.checkpoint_id ?? null, build_id: checkpoint.build_id ?? null, wp_id: checkpoint.wp_id ?? null,
      repo: config?.githubRepo ?? null, branch: checkpoint.branch, head_sha: evidence.headSha,
      base_sha: checkpoint.base_sha ?? null, diff_range: evidence.diffRange, changed_files: evidence.changedFiles,
      diff_text: evidence.diffText ?? null, diff_truncated: Boolean(evidence.diffTruncated),
      brief_ref: checkpoint.brief_ref, brief_excerpt: brief.excerpt ?? null,
      summary: checkpoint.summary ?? null, tests: checkpoint.tests ?? null,
      evidence_refs: checkpoint.evidence_refs ?? [],
      ci_checks: (evidence.checks ?? []).map((c) => `${c.name}:${c.conclusion ?? c.status}`).join(', ') || (evidence.checksError ?? 'none'),
    });

    let derived;
    // skipCodexPost: on a resume the codex [TOWER -> LARRY] reply is already on the thread,
    // so we neither re-run codex NOR re-post its reply -- we go straight to the fable step.
    let skipCodexPost = false;
    let codexRawVerdict = null;
    // The head codex reviewed (for the merge-ready head-binding gate). On a fresh turn this is
    // the current evidence head; on a resume it is the stored reviewed head (already bound to
    // the current head above + re-verified against evidence below).
    let codexReviewedHead = null;
    // CRIT #1 -- RE-VERIFY the resume against the LIVE evidence head (defence in depth beyond
    // the checkpoint.head_sha bind): only resume when the stored codex head still equals the
    // head evidence actually resolved. Any divergence -> discard the stale approval.
    const resumeReverified = resumeFable && resumeMeta?.reviewedHead === (evidence.headSha ?? checkpoint.head_sha);
    if (gateBlockers.length) {
      // Do NOT invoke Codex when a gate is closed — respond BLOCKED with the reasons. This
      // also correctly supersedes a resume whose head has since drifted (gate now closed).
      derived = { verdict: 'BLOCKED', material_findings: gateBlockers.slice(0, 3).map((b) => `[gate] ${b}`), next_action: 'Resolve the fail-closed gate(s) above, then re-hand off. Do not proceed unsupervised.' };
    } else if (resumeReverified) {
      // RESUME (MEDIUM G): codex already reviewed + APPROVED this exact head; its reply is on
      // the thread. Rebuild the packet and jump to the Fable cold-final without re-running codex.
      packet = buildPacket();
      derived = { verdict: 'APPROVE', material_findings: [], next_action: 'Resuming the cold-final: codex already approved this head; running the Fable adversarial pass.' };
      codexRawVerdict = resumeMeta?.codexRawVerdict ?? null; // null on a crash-only resume -> merge_ready fails closed
      codexReviewedHead = resumeMeta?.reviewedHead ?? null;
      skipCodexPost = true;
    } else if (roundsSpent >= maxRounds) {
      // (i) round budget exhausted for this chain → escalate WITHOUT another Codex turn.
      derived = { verdict: 'DECISION_REQUIRED', material_findings: [], next_action: `Max correction rounds (${maxRounds}) reached for this chain — escalating to Warwick.` };
    } else {
      // (g) invoke Codex read-only QA. FENCE (#6 gap): mirror the fable_turn fence -- if the
      // watchdog already aborted this cycle, do not even START a codex turn (no wasted spawn).
      if (!stillActive('codex_turn')) return { checkpointId: cpId, superseded: true };
      packet = buildPacket();
      progress.stage = 'codex_turn';
      const turn = await codex.runTurn({ checkpoint, packet, skillText: skill.text, promptFingerprint });
      codexResult = turn.structuredResult ?? null;
      codexRawVerdict = codexResult?.verdict ?? null;
      codexReviewedHead = evidence.headSha ?? checkpoint.head_sha; // codex reviewed the current head
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
    let posted = null;
    if (skipCodexPost) {
      // RESUME: the codex [TOWER -> LARRY] reply is already on the thread -- do NOT re-post
      // it. Carry the existing comment id forward for the return record.
      posted = { id: resumeMeta?.codexCommentId ?? null };
    } else {
      // FENCE before the FIRST externally-visible side effect (the ClickUp post): if the
      // watchdog already aborted this cycle, do not post -- the recovery path owns the reply.
      if (!stillActive('post_reply')) return { checkpointId: cpId, superseded: true };
      progress.stage = 'post_reply';
      try {
        posted = await clickup.createTaskComment(taskId, body);
      } catch (err) {
        // A post failure is not a merge risk; surface it, do not crash the cycle.
        log(`processCheckpoint: post failed for ${cpId}: ${config?.redact ? config.redact(err?.message ?? String(err)) : (err?.message ?? String(err))}`);
        return { checkpointId: cpId, verdict: derived.verdict, posted: false, error: 'post-failed', response: responseObj };
      }
    }

    // (j) milestone Telegram — one per outcome, deduped by checkpoint_id.
    // SAME purpose/trigger/dedup/frequency as before (Warwick uses these for UAT) --
    // only the CONTENT and the logical source change: review outcomes now speak in
    // the CODEX adviser voice (a human briefing) instead of a terse status string.
    const codexMilestonePurpose = derived.verdict === 'BLOCKED' ? 'blocked'
      : derived.verdict === 'DECISION_REQUIRED' ? 'escalation'
      : 'review_posted';
    const codexBriefing = composeReviewBriefing({ checkpoint, codexResult, derived, reviewedHead: responseObj.reviewed_head });
    // Redact any known secret VALUE from the briefing before it can reach Telegram
    // (defence in depth -- same discipline as the ClickUp reply body above).
    const codexNotifyBody = config?.redact ? config.redact(codexBriefing) : codexBriefing;

    // TWO-MODE ROUTING. Codex is the CORRECTION-LOOP reviewer (above). A Codex APPROVE is
    // NOT merge-ready on its own: when a Fable adapter is wired, the SAME head auto-routes
    // into a FABLE COLD-FINAL (adversarial, whole-change) pass, and only Codex APPROVE +
    // Fable APPROVE yields a merge-ready signal. Absent a Fable adapter, behaviour is the
    // unchanged codex-only path.
    const routeToFable = Boolean(fable) && derived.verdict === 'APPROVE';

    if (!routeToFable) {
      // ---- CODEX-ONLY OUTCOME (unchanged): non-APPROVE, or no Fable adapter wired ----
      // FENCE before mutating durable state: the watchdog may have fired DURING the post.
      if (!stillActive('record_state')) return { checkpointId: cpId, superseded: true, posted: true, commentId: posted.id };
      // (i) durable state: mark answered + advance the per-chain round counter.
      progress.stage = 'record_state';
      state.recordAnswered(cpId, { reviewedHead: responseObj.reviewed_head, verdict: derived.verdict, promptFingerprint, commentId: posted.id, now: now() });
      if (derived.verdict === 'CORRECTIONS_REQUIRED') state.incrementRound(ck);

      // FENCE before the notification: a superseded run must not send a late milestone.
      if (!stillActive('notify')) return { checkpointId: cpId, superseded: true, posted: true, commentId: posted.id, response: responseObj, chainKey: ck };
      progress.stage = 'notify';
      await notifier.notifyMilestone({ purpose: codexMilestonePurpose, logicalSource: 'CODEX', body: codexNotifyBody, checkpointId: cpId });

      progress.stage = 'done';
      return { checkpointId: cpId, verdict: derived.verdict, posted: true, commentId: posted.id, response: responseObj, signed, chainKey: ck };
    }

    // ---- ROUTE TO FABLE COLD-FINAL (Codex APPROVE + Fable adapter wired) ----
    // First, the Codex approve milestone (attributed to CODEX, correction-loop stage). The
    // checkpoint is NOT marked answered yet: the FINAL outcome is Fable's cold-final verdict.
    if (!stillActive('notify_codex')) return { checkpointId: cpId, superseded: true, posted: true, commentId: posted.id, response: responseObj, chainKey: ck };
    progress.stage = 'notify_codex';
    await notifier.notifyMilestone({ purpose: codexMilestonePurpose, logicalSource: 'CODEX', body: codexNotifyBody, checkpointId: cpId });

    // DURABLE TWO-MODE MARKER (MEDIUM G): the codex reply is now on the thread; record that
    // the codex step is DONE so a crash/failure BEFORE the fable terminal resumes at the
    // FABLE step (never re-runs codex, never re-posts the codex reply). On a resume the
    // marker already exists -- leave its RAW codex verdict intact rather than overwrite it.
    // FENCE (#6 gap) before persisting the durable awaiting_fable marker: a superseded run
    // must not (re)open an in-progress marker after the watchdog aborted the cycle. The
    // recordInProgress store itself also refuses once the checkpoint is answered (state.js).
    if (!stillActive('record_in_progress')) return { checkpointId: cpId, superseded: true, posted: true, commentId: posted.id, response: responseObj, chainKey: ck };
    progress.stage = 'record_in_progress';
    if (!skipCodexPost) {
      try { state.recordInProgress?.(cpId, { stage: 'awaiting_fable', codexVerdict: codexRawVerdict, reviewedHead: responseObj.reviewed_head, promptFingerprint, codexCommentId: posted?.id ?? null, chainKey: ck }); } catch { /* best-effort */ }
    }

    // The Fable turn runs INSIDE this cycle, so ALL WP1 protections wrap it: the outer
    // per-cycle watchdog reaps a stuck Fable turn (recoverable failure posted), the fence
    // suppresses a late-resolving abandoned run, and the read-deadlines bound the reads.
    if (!stillActive('fable_turn')) return { checkpointId: cpId, superseded: true, posted: true, commentId: posted.id, response: responseObj, chainKey: ck };
    progress.stage = 'fable_turn';
    const fableTurn = await fable.runTurn({ checkpoint, packet, skillText: skill.text, promptFingerprint });
    const fableResult = fableTurn.structuredResult ?? null;
    const fableSigned = { envelope: fableTurn.envelope, signature: fableTurn.signature };
    // Derive Fable's verdict on ITS OWN findings (roundsSpent:0 -- the correction-round
    // budget is a Codex-loop concept, not a cold-final concept).
    const fableDerived = deriveVerdict({ codexResult: fableResult, roundsSpent: 0, maxRounds });
    // HIGH C: merge-ready needs BOTH the derived APPROVE AND the RAW reviewer verdict to be a
    // genuine 'approve' -- a `comment`/unverifiable (empty/insufficient diff) is never merge-ready.
    const mergeReady = computeMergeReady({
      codexVerdict: derived.verdict, fableVerdict: fableDerived.verdict,
      codexRawVerdict, fableRawVerdict: fableResult?.verdict ?? null,
      // CRIT #1 -- both principals must have reviewed the CURRENT head. codexReviewedHead is
      // the head codex actually reviewed (fresh turn = current; resume = the re-verified stored
      // head); fable always reviews packet.head_sha (== the current evidence head).
      codexHead: codexReviewedHead,
      fableHead: packet?.head_sha ?? evidence.headSha ?? checkpoint.head_sha,
      currentHead: evidence.headSha ?? checkpoint.head_sha,
    });

    // Post the [FABLE -> LARRY] cold-final reply (distinct principal, merge_ready gate).
    const fableResponseObj = {
      checkpoint_id: cpId,
      reviewed_head: responseObj.reviewed_head,
      prompt_fingerprint: promptFingerprint ?? '(skill-unavailable)',
      verdict: fableDerived.verdict,
      merge_ready: mergeReady,
      summary: fableResult?.summary ?? (fableDerived.verdict === 'BLOCKED' ? 'Cold-final review blocked at a fail-closed gate -- see material_findings.' : 'Cold-final adversarial review.'),
      material_findings: fableDerived.material_findings,
      next_action: mergeReady
        ? 'MERGE-READY: Codex (correction-loop) and Fable (cold-final) both APPROVE this exact head. Larry may proceed under the human merge gate.'
        : fableDerived.next_action,
    };
    const fableBody = config?.redact ? config.redact(formatFableResponse(fableResponseObj)) : formatFableResponse(fableResponseObj);
    if (!stillActive('post_fable_reply')) return { checkpointId: cpId, superseded: true, posted: true, commentId: posted.id, response: responseObj, chainKey: ck };
    progress.stage = 'post_fable_reply';
    let fablePosted = null;
    try {
      fablePosted = await clickup.createTaskComment(taskId, fableBody);
    } catch (err) {
      log(`processCheckpoint: fable post failed for ${cpId}: ${config?.redact ? config.redact(err?.message ?? String(err)) : (err?.message ?? String(err))}`);
      return { checkpointId: cpId, verdict: derived.verdict, fableVerdict: fableDerived.verdict, mergeReady, reviewStage: 'cold_final', posted: true, commentId: posted.id, fablePosted: false, error: 'fable-post-failed', response: responseObj, fableResponse: fableResponseObj };
    }

    // FENCE before durable state: record the FINAL (cold-final) outcome, not the codex one.
    if (!stillActive('record_state')) return { checkpointId: cpId, superseded: true, posted: true, commentId: posted.id, fableCommentId: fablePosted.id };
    progress.stage = 'record_state';
    state.recordAnswered(cpId, { reviewedHead: responseObj.reviewed_head, verdict: fableDerived.verdict, promptFingerprint, commentId: fablePosted.id, now: now(), mergeReady });
    // A Fable CORRECTIONS outcome sends Larry back to fix + re-hand off (Codex then Fable),
    // so it advances the SAME per-chain round budget that bounds the loop.
    if (fableDerived.verdict === 'CORRECTIONS_REQUIRED') state.incrementRound(ck);

    // Fable milestone -- a DISTINCT extra ('cold_final') so it does not dedup against the
    // CODEX ding for the same checkpoint; attributed to FABLE (the notifier owns [FABLE]).
    const fableMilestonePurpose = fableDerived.verdict === 'BLOCKED' ? 'blocked'
      : fableDerived.verdict === 'DECISION_REQUIRED' ? 'escalation'
      : 'review_posted';
    const fableBriefing = composeReviewBriefing({ checkpoint, codexResult: fableResult, derived: fableDerived, reviewedHead: responseObj.reviewed_head });
    const fableNotifyBody = config?.redact ? config.redact(fableBriefing) : fableBriefing;
    if (!stillActive('notify_fable')) return { checkpointId: cpId, superseded: true, posted: true, commentId: posted.id, fableCommentId: fablePosted.id, response: responseObj, fableResponse: fableResponseObj, chainKey: ck };
    progress.stage = 'notify_fable';
    await notifier.notifyMilestone({ purpose: fableMilestonePurpose, logicalSource: 'FABLE', body: fableNotifyBody, checkpointId: cpId, extra: 'cold_final' });

    progress.stage = 'done';
    return { checkpointId: cpId, verdict: derived.verdict, fableVerdict: fableDerived.verdict, mergeReady, reviewStage: 'cold_final', posted: true, commentId: posted.id, fableCommentId: fablePosted.id, response: responseObj, fableResponse: fableResponseObj, signed, fableSigned, chainKey: ck };
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
  async function postRunFailure({ checkpoint, progress, kind, reason, startedAt, comments = [], wedgeStage = null }) {
    const cpId = checkpoint?.checkpoint_id ?? '(unknown)';
    // #6: use the SNAPSHOTTED wedge stage (captured atomically when the watchdog fired) so the
    // recovery message reports the stage the cycle actually wedged at, not a stage the
    // abandoned run may have advanced progress.stage to after supersession.
    const stage = wedgeStage ?? progress?.stage ?? 'unknown';
    const elapsedMs = Math.max(0, now() - (startedAt ?? now()));
    const shortReason = String(reason ?? '').slice(0, 240);
    // A failure in a FABLE stage is attributed to FABLE on the milestone wire (J); the
    // recovery REPLY block itself stays a [TOWER -> LARRY] (Tower owns the recovery reply).
    const failureSource = /fable/i.test(stage) ? 'FABLE' : 'CODEX';

    // #2 -- DO NOT CLOBBER A COMPLETED TERMINAL. If the genuine APPROVE/merge-ready (or any
    // terminal) reply already posted and recorded, a watchdog that fires DURING a post-terminal
    // notify (or a notify that throws) must NOT post a contradictory TOWER_RUN_FAILED BLOCKED
    // nor recordAnswered over it (which would downgrade merge_ready:true -> BLOCKED). Guard on
    // BOTH the answered flag AND a post-terminal stage (the reply+record already happened).
    //
    // MAJOR #3 -- 'record_state' is DELIBERATELY NOT in this set. progress.stage is advanced to
    // 'record_state' BEFORE state.recordAnswered persists; if that durable write THROWS, the
    // checkpoint is NOT actually answered (isAnswered === false) yet the stage reads
    // 'record_state'. Treating that stage as terminal here would silently no-op the recovery and
    // leave the checkpoint unanswered forever. The genuine F2 protection is preserved by the
    // isAnswered(cpId) guard: once recordAnswered SUCCEEDS the checkpoint is answered, so a
    // wedge/throw at the following notify/notify_fable/done stages is still guarded (both by
    // isAnswered AND by those stages remaining in the set).
    const POST_TERMINAL_STAGES = new Set(['notify', 'notify_fable', 'done']);
    if (state.isAnswered(cpId) || POST_TERMINAL_STAGES.has(stage)) {
      log(`postRunFailure: ${cpId} already terminal (answered=${state.isAnswered(cpId)}, stage="${stage}") -- NOT posting/recording a contradictory run-failure`);
      const ans = state.getAnswered?.(cpId) ?? null;
      return { checkpointId: cpId, verdict: ans?.verdict ?? null, mergeReady: ans?.merge_ready ?? undefined, posted: false, answered: state.isAnswered(cpId), runFailed: true, kind, stage, elapsedMs, noop: true };
    }

    // IDEMPOTENCY (MAJOR F #b): a prior recovery attempt that timed out LOCALLY may have
    // actually landed on the thread server-side; on the next poll we must NOT post a
    // duplicate recovery comment. If a TOWER_RUN_FAILED recovery reply for this checkpoint
    // is already on the thread, record answered from it and return -- no second post.
    // Reply-author trust (#5): only the Tower's own recovery reply counts as idempotent proof.
    const priorRecovery = findTowerReplyFor(comments, cpId, { isTrustedAuthor: isTrustedReplyAuthor });
    if (priorRecovery && /TOWER_RUN_FAILED/.test(String(priorRecovery.summary ?? ''))) {
      try { state.recordAnswered(cpId, { reviewedHead: priorRecovery.reviewed_head, verdict: 'BLOCKED', promptFingerprint: null, commentId: priorRecovery.comment_id, now: now() }); } catch { /* best-effort */ }
      log(`postRunFailure: recovery reply for ${cpId} already on the thread -- idempotent skip (no duplicate post)`);
      return { checkpointId: cpId, verdict: 'BLOCKED', posted: true, answered: true, runFailed: true, kind, stage, elapsedMs, idempotent: true };
    }
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

    // HIGH-2 DURABLE PENDING-FAILURE OUTBOX: persist the failure record (checkpoint_id, stage,
    // kind, reason, elapsed, operation-id) to durable state BEFORE the ClickUp post is
    // attempted, marked delivered:false. A crash between this write and a confirmed publish
    // therefore leaves a RECOVERABLE pending record on disk -- the failure evidence is never
    // lost in the gap. operationId ties the later delivered-mark to exactly THIS attempt.
    const operationId = `runfail-${cpId}-${now()}`;
    try { state.recordPendingFailure?.(cpId, { stage, kind, reason: shortReason, elapsedMs, operationId, reviewedHead: responseObj.reviewed_head, now: now() }); } catch { /* best-effort */ }

    // BOUNDED post -- a hung ClickUp write must not re-wedge the loop it is rescuing. But
    // SUCCESS, TIMEOUT and FAILURE must be DISTINGUISHED (WP1 MAJOR): withDeadline()
    // collapses both a rejection and a timeout into the same value, which made the old
    // `catch` unreachable AND recorded the checkpoint ANSWERED even when the recovery
    // [TOWER -> LARRY] verdict never actually posted -- a silent unanswered handoff again.
    // We race explicitly so we only mark answered on a CONFIRMED post.
    const POST_TIMEOUT = Symbol('post-timeout');
    let posted = null;
    let postConfirmed = false;
    {
      let timer = null;
      const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(POST_TIMEOUT), failurePostDeadlineMs); });
      try {
        const raced = await Promise.race([
          Promise.resolve(clickup.createTaskComment(taskId, body)).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e })),
          deadline,
        ]);
        if (raced === POST_TIMEOUT) {
          log(`postRunFailure: recovery post for ${cpId} timed out after ${failurePostDeadlineMs}ms -- NOT marking answered (next poll retries)`);
        } else if (raced.ok && raced.r) {
          posted = raced.r; postConfirmed = true;
        } else {
          const emsg = raced.e?.message ?? String(raced.e);
          log(`postRunFailure: recovery post for ${cpId} FAILED: ${config?.redact ? config.redact(emsg) : emsg} -- NOT marking answered (next poll retries)`);
        }
      } finally { if (timer) clearTimeout(timer); }
    }
    // Mark answered ONLY when the recovery verdict post is CONFIRMED on the thread. If it
    // did not post (timeout/failure), LEAVE the checkpoint unanswered so the next poll
    // re-attempts the recovery -- never a silently-swallowed handoff.
    if (postConfirmed) {
      try {
        state.recordAnswered(cpId, { reviewedHead: responseObj.reviewed_head, verdict: 'BLOCKED', promptFingerprint: null, commentId: posted?.id ?? null, now: now() });
      } catch { /* best-effort */ }
      // HIGH-2: the recovery reply is CONFIRMED on the thread -- mark the durable outbox record
      // delivered (only for THIS attempt's operation id) so it is no longer a pending failure.
      try { state.markFailureDelivered?.(cpId, operationId, now()); } catch { /* best-effort */ }
    }
    // BOUNDED milestone -- same "blocked" purpose the existing BLOCKED path uses. Telegram
    // is best-effort and does NOT gate the answered-state (fires regardless of post result).
    try {
      const ding = config?.redact ? config.redact(`BLOCKED - Tower run failed (${kind}) at stage ${stage} after ${elapsedMs} ms.`) : `BLOCKED - Tower run failed (${kind}) at stage ${stage} after ${elapsedMs} ms.`;
      await withDeadline(notifier.notifyMilestone({ purpose: 'blocked', logicalSource: failureSource, body: ding, checkpointId: cpId }), failurePostDeadlineMs, { sent: false });
    } catch { /* best-effort */ }

    return { checkpointId: cpId, verdict: 'BLOCKED', posted: postConfirmed, answered: postConfirmed, runFailed: true, kind, stage, elapsedMs, response: responseObj };
  }

  /**
   * WP1 -- run ONE checkpoint under the outer cycle WATCHDOG. Guarantees the loop
   * recovers: whichever of {completion, error, watchdog-deadline} lands first wins, and
   * a deadline or a throw is converted into a recoverable-failure reply. The underlying
   * processing promise is abandoned on a watchdog abort (a genuinely wedged run never
   * resolves); the tightened codex tree-kill is what makes that abandonment clean.
   */
  async function processCheckpointGuarded(checkpoint, comments = []) {
    const startedAt = now();
    const progress = { stage: 'start', checkpointId: checkpoint?.checkpoint_id ?? null, startedAt };
    // FENCE (WP1 CRITICAL): the generation token for THIS run. processCheckpoint captures
    // it and no-ops every side effect once it goes inactive. A watchdog abort flips it so
    // the abandoned-but-alive processCheckpoint can never post/overwrite/notify late.
    const fence = { active: true };
    const WATCHDOG = Symbol('watchdog');
    let timer = null;
    // The watchdog timer is intentionally NOT unref'd: it must be able to FIRE and rescue
    // a wedged cycle even if the wedged work is the only other thing pending. It is
    // always cleared in the finally below, so it never lingers past a completed cycle.
    //
    // J -- CLOSE THE FENCE-FLIP WINDOW: flip fence.active=false INSIDE the timer callback,
    // ATOMICALLY with (before) resolving the watchdog. Previously the flip happened only in
    // the race handler, one microtask AFTER the timer resolved -- a side effect scheduled in
    // that window would still see fence.active===true and slip through. Flipping it in the
    // timer callback suppresses any side effect from the moment the deadline fires.
    const watchdog = new Promise((resolve) => {
      timer = setTimeout(() => { fence.active = false; resolve(WATCHDOG); }, cycleWatchdogMs);
    });
    try {
      const raced = await Promise.race([
        processCheckpoint(checkpoint, progress, fence, { comments }).then((r) => ({ ok: true, r }), (e) => ({ ok: false, e })),
        watchdog,
      ]);
      if (raced === WATCHDOG) {
        // fence.active was already set false in the timer callback (window closed). Keep the
        // redundant assignment for clarity; it is a no-op if the timer already flipped it.
        fence.active = false;
        // #6: SNAPSHOT the wedge stage NOW (synchronously, before any await) so the recovery
        // message reports where the cycle actually wedged -- the abandoned run can advance
        // progress.stage on a late-resolving await after this point.
        const wedgeStage = progress.stage;
        log(`processCheckpointGuarded: cycle watchdog fired for ${progress.checkpointId} at stage "${wedgeStage}" after ${Math.max(0, now() - startedAt)}ms -- aborting cycle, loop continues`);
        return await postRunFailure({ checkpoint, progress, kind: 'run_timeout', reason: `cycle exceeded the watchdog bound (${cycleWatchdogMs}ms) at stage "${wedgeStage}"`, startedAt, comments, wedgeStage });
      }
      if (raced.ok) return raced.r;
      // The cycle THREW -- convert to a recoverable failure reply (never crash the loop).
      const msg = config?.redact ? config.redact(raced.e?.message ?? String(raced.e)) : (raced.e?.message ?? String(raced.e));
      log(`processCheckpointGuarded: cycle threw for ${progress.checkpointId} at stage "${progress.stage}": ${msg}`);
      return await postRunFailure({ checkpoint, progress, kind: 'run_error', reason: msg, startedAt, comments });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Bound a single ClickUp READ in a poll cycle (WP1 MAJOR). A wedged read (one that never
  // settles) is converted to { timedOut: true } so the cycle can abort and RELEASE polling
  // -- otherwise polling stays true forever and the watcher silently stops. A genuine read
  // REJECTION is preserved (rethrown) so real errors keep their existing behaviour (logged
  // by the caller, loop continues) rather than being masked as a wedge.
  async function boundRead(promise, deadlineAt = Date.now() + pollReadDeadlineMs) {
    const READ_TIMEOUT = Symbol('read-timeout');
    let timer = null;
    // MAJOR #7: the budget is the REMAINING time to the ONE whole-cycle deadline, not a fresh
    // full pollReadDeadlineMs per read. Sequential reads (reconcile + comment read) therefore
    // share a single deadline and cannot together exceed it (two ~full reads could before).
    const ms = Math.max(0, deadlineAt - Date.now());
    const deadline = new Promise((resolve) => { timer = setTimeout(() => resolve(READ_TIMEOUT), ms); });
    try {
      const raced = await Promise.race([
        Promise.resolve(promise).then((v) => ({ ok: true, v }), (e) => ({ ok: false, e })),
        deadline,
      ]);
      if (raced === READ_TIMEOUT) return { timedOut: true };
      if (!raced.ok) throw raced.e; // preserve genuine read errors
      return { value: raced.v };
    } finally { if (timer) clearTimeout(timer); }
  }

  return {
    reconcileFromThread,
    processCheckpoint,

    /** One full poll cycle. Returns { processed[], skipped[], reconciled }. */
    async pollOnce() {
      if (polling) return { processed: [], skipped: [], reconciled, busy: true }; // a prior cycle is still in flight
      polling = true;
      try {
        // MAJOR #7: ONE absolute read deadline for the WHOLE poll cycle, computed at cycle
        // start. reconcile + comment read each get the REMAINING budget (via boundRead) so two
        // sequential reads cannot together exceed this single deadline.
        const readDeadlineAt = Date.now() + pollReadDeadlineMs;
        if (!reconciled) {
          // cold-start rebuild (once per process) -- BOUNDED so a wedged read cannot hang.
          const rec = await boundRead(reconcileFromThread(), readDeadlineAt);
          if (rec.timedOut) {
            log(`pollOnce: reconcile read wedged (> ${pollReadDeadlineMs}ms whole-cycle budget) -- aborting cycle, loop keeps polling`);
            return { processed: [], skipped: [], reconciled, aborted: 'reconcile-timeout' };
          }
        }
        const commentsRead = await boundRead(clickup.getTaskComments(taskId), readDeadlineAt); // BOUNDED (shared deadline)
        if (commentsRead.timedOut) {
          log(`pollOnce: comment read wedged (> ${pollReadDeadlineMs}ms) -- aborting cycle, loop keeps polling`);
          return { processed: [], skipped: [], reconciled, aborted: 'comments-timeout' };
        }
        const comments = commentsRead.value;
        const processed = [];
        const skipped = [];
        for (const c of comments) {
          const parsed = parseCheckpoint(c.comment_text ?? c.text ?? '');
          if (!parsed.ok) continue; // not a checkpoint (or malformed → ignored on the read side)
          const cp = parsed.checkpoint;
          // CRIT #1 (durable-cache arm): HEAD-BOUND dedup. This is the FIRST-hit dedup gate in
          // the runtime path (it runs before processCheckpoint), so it MUST also be head-aware --
          // otherwise a durable answer at an earlier head short-circuits a reused id at the
          // current head here and the processCheckpoint gate is never reached. A thread-rebuild
          // (null-head) record still dedups for any head (see state.isAnswered's carve-outs).
          if (state.isAnswered(cp.checkpoint_id, cp.head_sha)) { skipped.push({ checkpointId: cp.checkpoint_id, reason: 'already-answered' }); continue; }
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
          const r = await processCheckpointGuarded(cp, comments);
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
