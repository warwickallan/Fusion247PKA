---
build: BUILD-015-asdair-durable-household-shopping-steward
scope: pre-rotation-safety
gate: 3
boundary: >
  Pre-rotation assurance of the B15-3 converged state. The promised outcome:
  a fresh Larry, with NO access to today's ~500k-token conversation, can recover
  from durable evidence what is complete, what is not, the exact current frontier,
  and that the single next action is Warwick sending a fresh photograph for live
  B15-3 acceptance (NOT BUILD-015 closure).
reviewed_sha: c4d74d2ba53891c468149fbf6aad003f4ca6fbc8
governance_sha: a2269a1d2abc7be829689be555c1b0868bddbde4
branch: main (c4d74d2 is an ancestor; also tip of b15-3/integration, local and origin)
evidence_method: mixed — repository inspection at main, live OS process table, live runtime status probe
evidence_workspace: C:/Fusion247PKA (read-only; no export needed, no mutation performed)
worktree_head_at_start: a2269a1d2abc7be829689be555c1b0868bddbde4
worktree_head_at_end: a2269a1d2abc7be829689be555c1b0868bddbde4
worktree_status_clean: true
verdict: HOLD
receipt_sha256: (computed in the return)
reviewed_by: veritas
reviewed_date: 2026-08-10
next_review_trigger: >
  The two contradicting continuity surfaces (Wayfinder §12 lines 1788–1812, and
  ~/.mypka/governor/continuity.json) are re-cut onto the 2026-08-10 frontier.
  ONE focused confirmation of those two findings only.
---

## Scope reviewed

Rotation safety of the converged B15-3 state, per Warwick's eight questions. Read-only.
**Deliberately NOT in scope:** BUILD-015 functional acceptance, Gate 1/Gate 2 grading of the
five B15-3 corrections, estate-wide git archaeology, redesign of anything.

## Accepted requirements — Warwick's eight questions

| # | Question | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | Does `c4d74d2` contain the converged B15-3 executable work? | **PASS** | All six lane tips are ancestors of `c4d74d2` by `git merge-base --is-ancestor`: `b15-3/remembered-choice` 2aaa40b · `lane-c-browser-wiring` 8e625b4 · `free-text-and-question-surface` a61fc44 · `terra-prose-rulebook` 466cba9 · `rule37-companion` c652c30 · `build-015/browser-method-contract` b399c23. `c4d74d2` is an ancestor of `main` HEAD a2269a1; the delta a2269a1..c4d74d2 is **two files, both under `Deliverables/`** | none |
| 2 | All worktrees clean, no live workers whose state rotation would lose? | **PASS** | `git worktree list` → **15** worktrees; `git -C <each> status --porcelain` → **empty for all 15**. `Get-CimInstance Win32_Process` for `node.exe` → 16 processes, all long-lived services (bots, gateways, MCP, Tower watcher, Directus, cockpit) — **no agent/worker process**; the two `.claude/worktrees/agent-*` checkouts sit at stale branch `a5f5b5e` and are clean | none |
| 3 | Does the live runtime execute bytes of the intended converged head? | **PASS** | PID **26856**, `entry: C:\Fusion247PKA\services\asdair\pipeline\runtime.js`, `identity_verified: true`, `stalled: false`, started `2026-08-09T23:30:07.959Z`. `git reflog show main` → `main` fast-forwarded to `c4d74d2` at **00:29:19 BST**, i.e. **48 s before** the process started. `git hash-object services/asdair/pipeline/runtime.js` = `e37ffa99…` = `git rev-parse HEAD:…` = `git rev-parse c4d74d2:…`. The only two commits after `c4d74d2` touch `Deliverables/` only | none |
| 4 | Is migration 018 present and **enforcing** in the production DB? | **UNVERIFIED** | `018_remembered_choice.sql` is present and is well-formed and idempotent. **DB state could not be independently established with this grant.** `ensure-asdair-runtime.mjs --status` (no `--no-db`) returned `pending_work.available: false — "ASDAIR_DB_URL is not set (pass it with node --env-file=<env>)"`: the tool does **not** load DB credentials internally, contrary to the dispatch note. The asdair cockpit API exposes six frozen routes (`httpApi.js:50-57`), none reaching this table | **Larry's word is not accepted. Exact SQL in the Defects section.** Non-blocking for rotation |
| 5 | Does continuity material truthfully identify complete / not complete / frontier / photograph / live-acceptance-not-closure / residuals? | **HOLD** | The **ROTATION STATE — 2026-08-10** block (map lines 651–716) does all six correctly, including the three "must not conclude" items and the four off-critical-path items. **But two other durable surfaces contradict it** — see Defects 1 and 2 | **blocking** |
| 6 | Any stale statement capable of misleading a fresh Larry (8 named hazards)? | **HOLD** | 6 of 8 hazards clear. **CDP** is safe: map lines 975–988 and 1028–1033 are unambiguous — CDP transport is proven and closed, the CDP *runner architecture* is prohibited, CDP "is the ARM, not the brain, and not yet the accepted operating method". **017/018 unapplied** — no such statement survives. **New Wayfinder** — prohibited at map line 1801. **Two hazards live:** "another photograph-preparation phase" (Defect 1) and "old workers orphaned / WO housekeeping on the critical path" (Defect 2) | **blocking** |
| 7 | Can a fresh Larry get the next action AND the constraints from durable evidence alone? | **HOLD** | The ROTATION STATE block would suffice **in isolation**. It does not survive contact with §12 and Honcho, which is the exact order `CLAUDE.md` Step 2 prescribes: recover Honcho → open the map → state the four things | **blocking** |
| 8 | Is `main` ahead of `origin` a rotation-safety problem or a durability residual? | **PASS — residual only** | `git rev-list --count origin/main..main` = **82**. But `git rev-list --count HEAD --not --remotes` = **2**. Every other commit, including all product bytes at `c4d74d2`, is remotely reachable via `origin/b15-3/integration` (`git branch -r --contains c4d74d2`). The **two** genuinely unpushed commits (`6acab74`, `a2269a1`) touch `Deliverables/` **only** | Non-blocking. **Not made a blocker.** See Residuals |

## Evidence provenance

- Inspected: the repository at `C:/Fusion247PKA` (main, `a2269a1`), read-only; the OS process table; the live AsdAIr runtime status probe; 15 worktree status calls.
- No `git archive` export was taken — no byte-exact mutation evidence was required, and no mutation was performed.
- `git rev-parse HEAD` start / end: `a2269a1d2abc7be829689be555c1b0868bddbde4` / identical.
- `git status --porcelain` start / end: **empty / empty**.
- **CRLF trap avoided as instructed**: file identity compared with `git hash-object` against `git rev-parse <sha>:<path>`, never `sha256sum` against `git show`.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | n-a | Not a functional gate; B15-3 acceptance is not graded here |
| Design fidelity | n-a | As above |
| Functional proof | n-a | Deliberately out of scope — no shop has run, and the map says so |
| Integration | PASS | Six lane branches provably converged into one executable head |
| Durability | PASS (local) / residual (remote) | Product bytes durable on `origin`; two documentation commits are local-only |
| Test quality | n-a | Suite counts not re-run — reuse of evidence, per Method 5 |
| Git truth | **PASS** | Every git claim in the dispatch verified by execution and true, with one correction: the "81 ahead" figure is **82**, and only **2** are genuinely unpushed |
| Documentation truth | **HOLD** | Two active surfaces state a next action contradicting the current frontier |
| Residual risk | PASS | Residuals are explicit and bounded; the map names its own unproven items honestly |
| Completed automation | n-a | No new automatic outcome is claimed at this boundary |

## Documentation contradiction scan

- **Active documents that would misdirect a fresh instance:** two, both named in Defects.
- **Verified independently of Larry's account:** the ROTATION STATE block's own claims about heads,
  worktrees, workers and runtime were each re-executed and each held.
- **Closure claims since the last receipt:** none found. The map explicitly refuses to call B15-3
  complete, and refuses to call RULES CRUD delivered. No unbacked closure claim was detected.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| 1 | **HIGH** | **Wayfinder §12 contradicts the ROTATION STATE block on the exact next action.** `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:1809-1812` reads: *"⚠️ What a fresh Larry must NOT conclude: that the fresh-photo acceptance is the remaining step. It ran on 2026-08-09 and it FAILED on the human-interaction layer… The acceptance is blocked behind B15-3, not behind Warwick taking a photograph."* This is now **false**. §12 is titled "RESUMABLE STATE AFTER `/clear` OR A FRESH SESSION" and opens *"Say these four things before touching a tool"* — it is precisely the section that answers the START/RESUME instruction at map line 26. Line 1799's "Exact next action" also still points at executing B15-3 rather than waiting for the photograph, and line 1788's phase/gate paragraph is the WP-B15-2 text (017 only; **no mention of 018 or of convergence**) | **blocking** — it blocks the photograph by sending a fresh Larry to look for more B15-3 implementation | Larry |
| 2 | **HIGH** | **The Honcho continuity brief is a day stale and names the wrong next action.** `C:/Users/Buggly/.mypka/governor/continuity.json`, `updated_at: 2026-08-09T19:21:47Z`. `immediate_objective`: *"Check whether the two named workers returned; bank and reconcile if so, re-dispatch from the committed orders if not."* `next_action` items (2) and (3): reconcile the shared pipeline files, and *"in parallel build the Work Order readiness validator"*. `blockers` still lists both worker returns as OUTSTANDING. `MUST NOT CONCLUDE: merged is not wired — buildHandoff, execution packet and verifyBasket still have NO production caller` is **contradicted** by map line 1178 (Lane C `8e625b4` gave all three production callers). `notes` names CLOSING HEAD `8bc5340`, now 3 commits stale. **Mitigation, and it is real:** `focus` and `next_action` both route to the map's ROTATION STATE block, which is correct — so Honcho alone probably self-corrects. It is listed as blocking because it lands **first** in the `CLAUDE.md` Step 2 order and it compounds Defect 1 rather than countering it | **blocking** | Larry |
| 3 | MEDIUM | **Migration 018's application to the production database is UNVERIFIED by Veritas.** Not disputed — **unverified**. The dispatch's stated route does not work: `ensure-asdair-runtime.mjs --status` reports `ASDAIR_DB_URL is not set`. No repo tool within my grant reaches the DB without a credential from the denied `C:/.fusion247` surface | **non-blocking** for rotation — if 018 were absent the photograph journey would fail loudly at insert time, which is visible, not silent | Larry |
| 4 | LOW | The `<details>` collapse wrapping the superseded 2026-08-09 rotation block is opened inside one blockquote (map line ~654) and closed in a **separate** blockquote after a blank line (line ~852). Markdown ends the blockquote at the blank line, so the superseded block may render **expanded**. Its own heading carries *"(superseded by the block above)"*, so the label survives regardless | **non-blocking** — clerical, park to reconciliation | Larry |
| 5 | LOW | Dispatch said `main` is 81 commits ahead of `origin`; it is **82**. Immaterial | **non-blocking** | Larry |

### The exact SQL that would settle Defect 3

```sql
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='asdair' AND table_name='remembered_choice')            AS columns_expect_12,
  (SELECT count(*) FROM pg_constraint
     WHERE conrelid='asdair.remembered_choice'::regclass AND contype='c')       AS checks_expect_8,
  (SELECT count(*) FROM pg_constraint
     WHERE conrelid='asdair.remembered_choice'::regclass AND NOT convalidated)  AS not_valid_expect_0,
  (SELECT count(*) FROM pg_constraint
     WHERE conname='remembered_choice_decision_fk')                             AS composite_fk_expect_1,
  has_table_privilege('asdair_rw','asdair.remembered_choice','UPDATE')          AS rw_update_expect_false,
  has_table_privilege('asdair_rw','asdair.remembered_choice','DELETE')          AS rw_delete_expect_false,
  has_table_privilege('asdair_rw','asdair.remembered_choice','INSERT')          AS rw_insert_expect_true;
```

## Verdict

**HOLD** — the converged head, the worktrees, the absence of workers and the live runtime are all
independently proven true exactly as claimed; but **two active continuity surfaces still tell a fresh
Larry that the photograph is not the next step**, which is the one thing rotation must carry.

## Next review trigger

Wayfinder §12 (lines 1788–1812) and `~/.mypka/governor/continuity.json` re-cut onto the 2026-08-10
frontier. ONE focused confirmation of those two findings only — nothing else reopens.
