# Implementation Plan — GitHub Issues as the Larry↔Tower Baton Wire (ClickUp kept as the human-readable mirror)

**Author:** Pax (Senior Researcher, myPKA) · **Date:** 2026-07-18
**Status:** DESIGN ONLY — no code. This is the plan Warwick approves before any implementation.
**Grounding:** read directly against the LIVE baton in the `C:\Fusion247PKA-baton` worktree — `services/tower-baton/src/{clickupClient,watcher,handoff,checkpoint,githubEvidence,config,runtimeConfig}.js`, `bin/tower-watch.js`, `test-helpers/fakes.js`, and `Builds/BUILD-010-fusion-tower/baton-mvp/RECOVERY-MAP.md`. Primary-source, not secondary.
**Honesty note (per SOP-018 discipline):** same-model design pass — not independently verified. External GitHub-API facts are marked with confidence and flagged for confirmation against live docs before coding.

---

## Executive summary

The exchange is already transport-agnostic by construction: `watcher.js` and `handoff.js` operate on comment **text**, parse `[LARRY → TOWER]` / `[TOWER → LARRY]` blocks (`checkpoint.js`), dedup by `checkpoint_id`, and cold-start via `reconcileFromThread` → `answeredCheckpointIds(comments)`. They only ever touch a client with the shape `{ getTaskComments(taskId), createTaskComment(taskId, body) }`. So this is **not a rewrite** — it is one new adapter that satisfies that same shape over GitHub Issue comments, plus a transport selector, plus a mirror composite. The `[LARRY→TOWER]`/`[TOWER→LARRY]` format stays byte-identical. Default stays `clickup`, so the live standing watcher never changes underneath itself until Warwick flips a config value.

**Honest framing:** ClickUp `createTaskComment` is *already* additive — it posts new comments and never edits/replaces/deletes (see the module header + `createFakeClickup`). This work is therefore **consolidation + code-adjacency** (the baton lives next to the code it reviews, in the same repo/gh auth already used for evidence), **not** the fix for an active data-loss bug. The honest win is: one system of record, no second SaaS credential on the write path, and the baton thread sitting where the diffs live.

---

## 1. The new `githubIssueClient` adapter (identical interface shape)

New module `services/tower-baton/src/githubIssueClient.js`, exporting `createGithubIssueClient({ config, runCmd })` and a `createFakeGithubIssues(...)` test double — mirroring `clickupClient.js`'s `createClickupClient` / `createFakeClickup` pair exactly.

**Interface parity (unchanged callers):**

- `getTaskComments(issueNumber)` → `gh api --paginate repos/<owner>/<repo>/issues/<n>/comments`. Normalise each comment to the **same shape the watcher already consumes**:
  - `id` ← `comment.id` (stable numeric GitHub id — better than ClickUp's here)
  - `comment_text` ← `comment.body`
  - `date` ← `Date.parse(comment.created_at)` (epoch ms, so the existing `sort((a,b) => Number(a.date) - Number(b.date))` oldest-first contract holds)
  - `user` ← `comment.user.login` (or `comment.user.id` — see the author-gate note in §3)
- `createTaskComment(issueNumber, body)` → POST a **new** comment: `gh api repos/<owner>/<repo>/issues/<n>/comments -X POST --input -` with `{"body": <text>}` piped on **stdin** (NOT `-f body=…` on argv — avoids arg-length limits and PowerShell/`spawn` escaping of multi-line bodies). Return `{ id: String(res.id) }`, matching the ClickUp client's return.
- `get ready()` → whether `gh` is on PATH and auth is present (see §6 PATH risk).

**The format layer does not change at all.** `checkpoint.js` (markers, `parseCheckpoint`, `parseResponse`, `formatCheckpoint`, `formatResponse`, `correlateResponse`, `answeredCheckpointIds`) is untouched. Because reconcile/dedup work on comment **text**, they "just work" over issue comments; the stable numeric `comment.id` only *improves* the `commentId` recorded in durable state (`state.recordAnswered(..., { commentId })`).

**Runner note — do NOT reuse `githubEvidence.defaultRunCmd`.** That module's `assertReadOnlyCommand` guard **refuses** `gh api -X POST` by design (it is the structural no-autonomous-merge guarantee). The write client therefore needs its **own** bounded runner whose allowlist permits exactly one mutating shape: `gh api ... -X POST` scoped to the `/issues/<n>/comments` endpoint, and GET for reads. Everything else (merge, PR, edit, delete, any other endpoint) stays refused. This keeps the "no autonomous merge / additive-only" invariant explicit at the new write surface, exactly as `clickupClient` keeps it ("posts NEW comments; NEVER edits, replaces, or deletes").

**gh version dependency (confirm before coding):** single-array pagination wants `gh api --paginate --slurp` (gh ≥ ~2.44). If the installed gh is older, fall back to a manual `per_page=100` + `Link` header loop. Confidence: Medium — verify the pinned gh version on the Yoga.

---

## 2. Transport config `TOWER_EXCHANGE_TRANSPORT = clickup | github | both`

Add to `config.js` (a POINTER, not a secret — shown in `describe()`), read by name like the existing `GITHUB_REPO`:

- `TOWER_EXCHANGE_TRANSPORT` — `clickup` (default) | `github` | `both`. **Absent → `clickup`.** The live system does not change until Warwick sets it.
- `TOWER_GITHUB_ISSUE` — the issue number to watch/post (used when `github`/`both`).
- `GITHUB_REPO` — already loaded (`owner/repo`); reused as-is.
- `TOWER_GITHUB_AUTHORISED_AUTHOR_IDS` — GitHub author allowlist for the author gate (see §3 — GitHub logins/ids live in a different namespace than ClickUp's `222204263`).

**Selection happens only at the wiring seams** — `bin/tower-watch.js` (watcher) and `bin/handoff-to-tower.js` (Larry's handoff). Neither `watcher.js` nor `handoff.js` changes:

- `clickup` → construct `createClickupClient` (today's behaviour).
- `github` → construct `createGithubIssueClient`; pass `TOWER_GITHUB_ISSUE` as the `taskId` the watcher already threads through.
- `both` → construct a **composite transport** where **GitHub is the source of truth** and ClickUp is a best-effort mirror:
  - `getTaskComments` → **GitHub only** (truth for reconcile/dedup/reads).
  - `createTaskComment` → post to **GitHub first** (must succeed; its `{id}` is returned), then **best-effort** post the same body to ClickUp. A ClickUp mirror failure is **logged and swallowed** — it must never fail the GitHub write or crash the cycle. Warwick keeps his readable ClickUp copy; correctness never depends on it.

Because the composite satisfies the same `{ getTaskComments, createTaskComment }` shape, it serves **both** the watcher and Larry's handoff symmetrically with zero changes to either.

---

## 3. Issue keying, discovery, and dedup

**Recommendation: one GitHub issue per build (target), implemented Phase 1 as a single configured issue number so the watcher stays unchanged.**

Rationale: the live watcher watches exactly **one** control task (`TOWER_CLICKUP_TASK_ID`, currently `869e5zu97`) and reconciles that whole thread; cross-build already works because each checkpoint carries `build_id`/`wp_id`/`brief_ref` (`chainKey`). The lowest-risk parity is therefore **one issue = one thread**, selected by `TOWER_GITHUB_ISSUE`. Per-build separation is the *nicer* end-state (cleaner labels, one issue's comment history per build), but multi-issue polling would require a launcher-level loop over issues — that belongs in a **wrapper around** the watcher (Phase 2), not a change to the transport-agnostic core.

- **Labels:** `tower-baton` (all baton issues) + `build:<id>` (e.g. `build:BUILD-010`). Cheap, filterable, and the basis for Phase-2 discovery.
- **Discovery (Phase 2, optional):** `gh issue list --label tower-baton --state open --json number` → the launcher spins one watcher per issue number (each with its **own lock + state file** — see §4). Phase 1 needs no discovery: the issue number is config.
- **Dedup / reconcile:** unchanged. `reconcileFromThread` reads the issue's comments and `answeredCheckpointIds` rebuilds answered `checkpoint_id`s from the `[TOWER → LARRY]` blocks. GitHub's **stable numeric comment ids** are strictly better than ClickUp's for the `commentId` stored on each answered record; the dedup key itself remains `checkpoint_id` (text-derived), so it is transport-independent.

**Author-gate design point (must handle).** `watcher.pollOnce` enforces `config.isAuthorisedAuthor(c.user)` against `TOWER_AUTHORISED_AUTHOR_IDS` — today Warwick's ClickUp id `222204263`. Under GitHub, **every** comment (Larry's checkpoints *and* Tower's replies) is posted under the **same `gh` identity** (the keyring user — brief says `warwickallan`; `config.js` header says the interactive Buggly `gh` session — **confirm which**). Consequence: the author gate still functions (allowlist = that one GitHub login/id) but **loses the Larry-vs-other-author distinction** ClickUp gave. That is acceptable — the `[LARRY → TOWER]` marker plus repo write access is the real trust boundary — but it must be a **conscious** choice, wired via `TOWER_GITHUB_AUTHORISED_AUTHOR_IDS`, and the gate must stay **fail-closed when unconfigured** (matching today's `authorGateConfigured` logic). Flagged as open question #2.

---

## 4. Migration path — strictly additive and reversible

Nothing here touches the running standing watcher until the final config flip.

- **Phase 0 (today):** default `clickup`. Live system unchanged. New code paths are dormant.
- **Phase 1 — build in parallel (no live change):** land `githubIssueClient` + `createFakeGithubIssues` + the composite + config additions + tests. Default still `clickup`. All new; nothing existing edited except the two `bin/` wiring seams (which branch on the new config and preserve the ClickUp default exactly).
- **Phase 2 — prove on a throwaway TEST issue, ClickUp stays live:** run a **second, isolated** watcher with `TOWER_EXCHANGE_TRANSPORT=github`, `TOWER_GITHUB_ISSUE=<test issue>`, and — critically — a **separate lock + state file** (override `FUSION247_HOME`, or add a state/lock path override) so it **cannot** reclaim or clobber the LIVE watcher's single-watcher lock (`state.js` `acquireLock`). Drive a full handoff→reply cycle on the test issue and diff the posted blocks against a ClickUp run.
- **Phase 3 — flip live to `both`:** set `TOWER_EXCHANGE_TRANSPORT=both` on the live watcher (GitHub truth + ClickUp mirror). Warwick keeps his readable ClickUp copy.
- **Rollback:** set `TOWER_EXCHANGE_TRANSPORT` back to `clickup`. No code revert, no data migration — the ClickUp path was never removed.

**Acceptance criteria to flip (all must pass on the test issue):**
1. `[LARRY→TOWER]` and `[TOWER→LARRY]` blocks are **byte-identical** to the ClickUp path (same markers, keys, ordering, caps).
2. Dedup holds across a watcher restart — no double `[TOWER → LARRY]` reply for a `checkpoint_id`.
3. `reconcileFromThread` rebuilds the answered-id set purely from issue comments (cold start on a pre-seeded issue answers nothing new).
4. Per-chain round counter and the `DECISION_REQUIRED`/`BLOCKED` escalations behave identically.
5. Telegram milestones (`review_posted`/`escalation`/`blocked`/`tower_unavailable`) fire once each, deduped.
6. `gh` is reachable **under the scheduled task** (see §6), not just an interactive shell.
7. `both`-mode: a forced ClickUp mirror failure is logged and does **not** fail the GitHub write or the cycle.

---

## 5. GitHub Projects as the optional human board (Phase 2, optional)

GitHub Projects (v2) can give Warwick a kanban/board view over the baton issues — the GitHub-native analogue of ClickUp's board. **Keep it optional and out of the critical path.**

- Projects **v2 is GraphQL-only** (the REST API does not cover Projects v2) — confidence: High. Adding an issue to a project and setting a status field are GraphQL mutations (`addProjectV2ItemById`, `updateProjectV2ItemFieldValue`), i.e. extra calls and added complexity beyond the plain issue-comment REST path this plan is built on.
- It needs a token/keyring with the **`project`** scope; the current `gh` keyring may need a re-auth to grant it. That is a real setup cost for a *view*, not the wire itself.
- Recommendation: ship the wire on issues + labels first (labels already give a filterable list view for free). Treat a Project board as a **phase-2 nicety** only if Warwick misses the ClickUp board after living on `both` mode.

---

## 6. Trade-offs & risks

- **`gh` availability under the scheduled task (highest-priority risk).** Per MEMORY, the scheduled task's PATH lacks node's directory; **confirm `gh`'s directory is on the task PATH too** (and that the keyring/`GH_CONFIG_DIR` is readable as the task's user). `githubEvidence` already shells `gh api` read-only, so evidence collection proves gh *can* run in-process — but a POST comment under the scheduled-task user's keyring is a **new** live dependency and must be proven in Phase 2, not assumed. Mitigation: absolute-path `gh`, or set the task PATH/`GH_CONFIG_DIR` explicitly; `ready=false` must fail closed with a clear blocker (mirroring the `CLICKUP_TOKEN missing` pattern), never a crash.
- **Rate limits.** Authenticated GitHub REST ≈ 5,000 requests/hour (High confidence, verify against live docs). At a 30s poll: ~120 polls/hr; each poll = one paginated comments GET (1–2 requests) plus the existing `gh api` check-runs read. Comfortably under budget even at a 15s poll. `both` mode adds ClickUp calls on a **separate** quota. No concern at this volume.
- **Comment size limit.** GitHub issue comment body max ≈ 65,536 chars (High confidence). The `[TOWER → LARRY]` reply is deliberately tight (`summary` capped 600, ≤3 findings capped 240 each, `next_action` capped 400) and the **diff is never posted to the thread** — it is staged into the Codex prompt in `githubEvidence` (capped 120 KB there). So the 64 KB ceiling is never approached. No concern.
- **What we LOSE vs ClickUp.** Warwick's preferred ClickUp readability/board. **Preserved by `both`/mirror mode** — GitHub is truth, ClickUp keeps a readable copy. The only genuine loss in pure `github` mode is the ClickUp board (addressed by §5) and the ClickUp-native author identity of checkpoints (addressed by §3). CU-`brief_ref`s that resolve via `clickup.getTask` won't resolve in pure `github` mode (file-path briefs — the norm — still work); in `both` mode ClickUp is present so `getTask` still works. Open question #5.
- **Honest scope.** ClickUp comments are already additive; this is not fixing active data loss. The value is consolidation, code-adjacency, and one fewer SaaS credential on the write path — with ClickUp readability retained via mirror.

### Anti-patterns to explicitly avoid
1. **Making the exchange GitHub-specific.** The entire leverage is that `watcher.js`/`handoff.js`/`checkpoint.js` stay untouched. If a change to those is proposed, it is the wrong design.
2. **Reusing `githubEvidence.defaultRunCmd` for the POST.** Its allowlist refuses `-X POST` by design; a naive reuse fails closed. The write client gets its own bounded, endpoint-scoped runner.
3. **Posting the diff into the comment.** Blows the 64 KB limit and duplicates what already goes into the Codex prompt.
4. **Flipping the live watcher straight to `github` with no parallel proof**, or running the proof watcher **without a separate lock/state** (it would clobber the live single-watcher lock).
5. **Treating the `[LARRY → TOWER]` marker as trust.** The author gate stays required and fail-closed-when-unconfigured, even though it degrades to a single gh identity.

---

## 7. Tests & effort estimate

**Tests (extend the existing node:test suite + `test-helpers/fakes.js`):**
- `githubIssueClient.test.js` — GET maps `body/created_at/user/id` correctly and sorts oldest-first; `--paginate` assembles all pages; POST sends body on **stdin** as `{"body":…}` and returns `{id}`; `ready=false` fails closed with a clear blocker; the runner **refuses** any non-comment / non-GET-or-scoped-POST gh shape (no-autonomous-merge parity).
- **Format-parity test** — feed the same checkpoint through the ClickUp fake and the GitHub fake; assert the posted `[LARRY→TOWER]`/`[TOWER→LARRY]` bodies are **byte-identical** (this is the core guarantee).
- **Dedup/reconcile over issue comments** — seed a fake issue with an existing `[TOWER → LARRY]` reply; assert `reconcileFromThread`/`answeredCheckpointIds` skip it and no duplicate is posted (reuse the existing `watcher.test.js` scenarios against the GitHub fake).
- **`both`-mode composite** — reads come from GitHub; a write hits GitHub then ClickUp; a forced ClickUp-mirror throw is swallowed and the GitHub `{id}` still returns.
- **Config test** — `TOWER_EXCHANGE_TRANSPORT` defaults to `clickup`; `github`/`both` select the right client; author gate fail-closed when `TOWER_GITHUB_AUTHORISED_AUTHOR_IDS` unconfigured.
- **No live calls** — a new `createFakeGithubIssues` (in-memory, additive, injectable failures) mirrors `createFakeClickup`; no test touches real gh/network.

**Effort estimate (design→green tests, excludes Warwick review time):**
- `githubIssueClient` + `createFakeGithubIssues` — 0.5 day
- config additions + two `bin/` wiring seams — 0.5 day
- `both` composite transport — 0.5 day
- transport-aware author gate — 0.25 day
- tests (all above) — 0.75 day
- scheduled-task gh proof + isolated parallel live proof on a test issue — 0.5 day
- runbook/docs update — 0.25 day

**≈ 3 days** (2.5–3.5 range). No live ClickUp/GitHub change lands until the Phase-3 config flip.

### Open questions for Warwick
1. **Issue keying:** accept "one standing baton issue (Phase 1) → one-per-build (Phase 2)", or go straight to per-build with a discovery loop?
2. **Author identity:** OK that under GitHub every comment is authored by one `gh` identity, losing the ClickUp Larry-vs-Warwick author distinction (marker + repo access as the trust boundary)?
3. **Which gh keyring** runs under the scheduled task — `warwickallan` (brief) or the interactive Buggly session (`config.js` header)? Confirm before wiring the author allowlist.
4. **CU-`brief_ref`s** in pure `github` mode won't resolve (no `getTask`). Keep a read-only ClickUp handle for brief resolution, or standardise on file-path briefs?
5. **GitHub Projects board** — wanted in phase 2, or are labels + `both`-mode ClickUp readability enough?
6. Unrelated but adjacent: Tower's own bot vs FusionDevBot is still a pending identity decision (`config.js` note) — does the GitHub move change that calculus?

---

**Methodology:** read the seven live baton modules + the runner + fakes + RECOVERY-MAP as primary sources; all interface/parity claims are grounded in that code. GitHub-API facts (rate limit, comment size, Projects v2 = GraphQL, gh `--slurp` version) are from training knowledge at **Medium–High** confidence and are flagged for confirmation against current GitHub docs and the pinned gh version before implementation.
**Limitations:** no live gh/ClickUp calls were made; the scheduled-task gh-availability risk (§6) is the one item that can only be closed by an on-machine proof, not by reading code.
