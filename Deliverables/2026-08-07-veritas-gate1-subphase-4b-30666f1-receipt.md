---
build: BUILD-020
scope: sub-phase-4B — ACTIVE SESSION WORK PACKAGE functional rows 1, 2 and 4 (row 3 descoped by Amendment 4). Dimension graded afresh: enumeration / document currency.
gate: 1

reviewed_sha: 30666f1b3084dcc954271e54ce81e71741db3668
governance_sha: 30666f1b3084dcc954271e54ce81e71741db3668
branch: build-020/phase4-automation-law
remote_reachable: true  # git branch -r --contains → origin/build-020/phase4-automation-law

evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA-build-020-trial\e1a5349f-4c7d-4ce4-bb91-f2ea51224e07\scratchpad\export-30666f1
worktree_head_at_start: 30666f1b3084dcc954271e54ce81e71741db3668
worktree_head_at_end: 30666f1b3084dcc954271e54ce81e71741db3668
worktree_status_clean: true  # empty at start; at end carries only this receipt as untracked. The head did NOT move during this review.

review_ceiling: one pass, <= ~120k tokens (dispatch)
private_surface: none accessed; credential_scope none honoured; nothing under C:\.fusion247\** was opened

verdict: FAIL
receipt_sha256: 5a622113b9c3e02c38d37abba9ba6738f0980fe9981fc93971d8f0e3af5f5420
reviewed_by: veritas
reviewed_date: 2026-08-07
next_review_trigger: a new frozen exact head at which EVERY statement of gate standing in the active map — enumerated by meaning, not by remembered wording — is either the § ASSURANCE STANDING block itself or a pointer to it, with CI complete at that literal head and Gate 1 re-dispatched over rows 1, 2 and 4
---

## Scope reviewed

**Gate 1 only.** The dispatch narrowed this review to **the enumeration / document-currency dimension**, citing rows 1, 2 and 4 from the `b62a9fc` receipt on the ground that their reviewed implementation is byte-identical.

**I verified the narrowing condition myself before accepting it.** `git diff --name-only b62a9fc 30666f1` returns **four paths**: `CLAUDE.md` and three under `Deliverables/`. **No `services/**`, no `tools/**`, no `.github/**`, no test file.** The condition holds; this is **not** a narrowing to an older product slice, and no Warwick narrower-release decision was needed or claimed.

**Row 3** — descoped by Amendment 4; not graded, not owed. **Gate 2 / the phase North-Star journey** — separate receipt, not graded here. **The `CLAUDE.md` Rule 4a redline** — treated as context per the dispatch, and checked only for the one thing inside my dimension: whether it falsified any active map statement. It did not (see Evidence).

**No widening was required.** The dispatch carried every functional numbered requirement and every known residual, and forbade narrowing.

**Publication constraint honoured** — no attack detail. **Private surface:** nothing under `C:\.fusion247\**` was read.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **1** | **BUILD-020 durability / promotion readiness.** Accepted operating mechanisms correctly classified (session-independent · machine-global install · generic repo assets in PR #97 · BUILD-020-specific). Survives: dead Larry session · worktree delete/recreate · fresh branch from current main · branch from main after #97 merges · installed-runtime restart. Replacement-machine DR not claimed. Exact merge unit + post-merge install alignment listed. *(Amendment 3 hook outcomes struck; not graded.)* | **PASS — pre-merge branch-runtime half only. CITED from `b62a9fc` (`sha256 c1161514…`); citation condition verified by me.** | The reviewed implementation is **byte-identical to `b62a9fc`** — the four-path diff contains no `services/**`, `tools/**`, `.github/**` or test file. At `b62a9fc` I executed `clone-portability-check` (22 assertions, 5 mutations caught, in a foreign tree with no `.git`), `provenance-check` (29), and verified fresh-branch-from-main against `git ls-tree origin/main` (`4eb5368`). **Additionally repaired at this head, and verified by me:** residual **E-3** — `~/.mypka/tower-runtime` now appears in the migration plan as **§4b** (4 occurrences of "Tower", from zero), naming the divergence, forbidding the *"installed from canonical merged source"* claim, scheduling re-alignment from canonical merged `main` at step 18 and giving a separate Tower rollback path. | **OWED, not discharged, and this PASS asserts none of them:** *"branch from main after #97 merges"* · `installed-runtime restart` **service half** (Amendment 12 ① routes it post-merge) · **Amendment 9's real unattended capture — reclassified MANUAL for Gate 1 acceptance and evidence purposes ONLY; it REMAINS AUTOMATIC as a product requirement**, with the binding seven-condition post-merge re-test at step 18. |
| **2** | **Gate 2 Phase 4 residuals dispositioned against current evidence.** Every old Gate 2 residual at `95f8826` returns exactly one of DISCHARGED · STILL OPEN · RECLASSIFIED · NOT PART OF THE PHASE. | **PASS — CITED from `b62a9fc`; citation condition verified by me.** | The disposition table lives in `Deliverables/2026-08-06-amended-wp-recon-evidence.md`, which is **not among the four changed paths**. Byte-identical to the head at which I enumerated it by meaning and passed it. | none blocking. |
| **4** | **Live Cockpit production surface + truthful CareerAIR operational view** — split by runtime under Amendment 10 ②. | **PASS — pre-merge branch-runtime half only. CITED from `b62a9fc`; citation condition verified by me.** | No `services/**` or test file changed, so `render-vm-check` (24 scenarios / 54 assertions), `rotation-report-check` (117), `nav-check` (41), `origin-boundary-check` (97 + 5 permissive fixtures caught) and `provenance-check` (29) — all re-executed by me in isolation at `b62a9fc` — stand unaltered at this head. | **The live half is OWED, not delivered. This PASS must never be described as "the Cockpit surface works".** Carried unfiltered: `tailscale`/`Origin` write-outage · browser-always-sends-`Origin` **recalled, not verified, no browser exercised** · R1's non-mutating-GET assumption · CareerAIR overlay reachability unprovable here · `db.mjs` unguarded pools · `sourceHash` cross-checkout non-comparability · `idempotency-check` unregistered · the HTTP-200 truthful failure. |

**Row 3 — DESCOPED by Amendment 4. Not graded, not owed, and its historical FAIL is not carried against this package.**

**All three functional rows pass their pre-merge halves. The overall verdict is not PASS, and the reason is again not the engineering.**

## Evidence provenance

- Isolated export created with `git archive 30666f1b3084dcc954271e54ce81e71741db3668 | tar -x -C <workspace>` at the frontmatter path, **outside the repository**, never committed. **No `git worktree` was created.**
- Repository `git rev-parse HEAD` at start and at end — **`30666f1b…` both times, identical.** `git status --porcelain` **empty at start**; at end carries only this receipt as untracked. **The head did not move during this review** — Larry's stated isolation held for a second consecutive gate.
- Every map and plan read for the enumeration was read **inside the export**. Git-history and CI queries are read-only repository/machine state, labelled as such.
- **No mutation was applied to the repository.** No tracked file was modified by this review.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git diff --name-only b62a9fc 30666f1` | 0 | **4 paths** | `CLAUDE.md` + three under `Deliverables/`. **No `services/**`, `tools/**`, `.github/**` or test.** The dispatch's narrowing condition is satisfied. |
| `git archive 30666f1b… \| tar -x -C <ws>` | 0 | n/a | Clean isolated export created. |
| `git branch -r --contains 30666f1b…` | 0 | 1 | `origin/build-020/phase4-automation-law` — **remotely reachable.** |
| `gh run list` filtered to `headSha == 30666f1…` | 0 | **7 runs** | `cockpit-private-apps` + `secret-scan` **`push` / completed / success`**; all five **`pull_request` / completed / success`**. **Larry's CI statement is exactly right**, per workflow per event. |
| map ∋ `HOLD @\|PASS @\|FAIL @\|HOLD at\|PASS at\|FAIL at` (export) | 0 | **12 hits, each read** | Eleven resolve correctly — pointer, history, or explicitly-scoped 4A/Phase-2 fact. **One does not: line 2598.** Basis of E-1. |
| map ∋ `un-dispatched` (export) | 0 | **1 hit** | Only the annotated pointer at `:2975`. Larry's *"grep for the old wording returns zero"* is **true of the old wording** — and that is precisely why it missed E-1. |
| `git diff b62a9fc 30666f1 -- <map>` ∋ `Gate 1/2 HOLD` | 1 | **0 hits** | **The Phase row was NOT touched by the SSOT repair.** |
| `git log -1 -S "Gate 1/2 HOLD at older head" -- <map>` | 0 | 1 | Authored at **`f6ce6a1`** and never re-cut since — it predates Amendments 4 and 6 and has survived **all nine** Gate 1 reviews, mine included. |
| § ASSURANCE STANDING block (export `:2729`–`:2749`) | 0 | 7 rows | **Exists, is canonical, and is CURRENT** on Gate 1, Gate 2, Codex eligibility, merge readiness and the ten Work Orders. Carries the same-commit update rule. **The fix is real.** |
| map `:2628`, `:2629`, `:2906`, `:2975` | 0 | 4 | **All four former restatements are now pointers**, each annotated with what it used to claim. Verified individually. |
| migration plan ∋ `Tower` (export) | 0 | **4 hits** | **E-3 repaired** — §4b, from zero occurrences. |
| map `:2685` (export) | 0 | 1 | **E-2 repaired** — the `IN FLIGHT` row is struck and marked `SUPERSEDED — see the INTEGRATED row below`. |
| `git diff b62a9fc 30666f1 -- CLAUDE.md` | 0 | **+2 / −2** | Exactly the two Rule 4a sentences. **Checked only for effect on my dimension:** map `:2013` already read *"then CONTINUE — stopping only for one of the seven named interruption reasons"*, and `:82` is a pointer. **No map statement was falsified by the constitutional edit; one was reconciled to it.** |
| `Deliverables/2026-08-06-veritas-gate1-amended-wp-0cf70c9-receipt.md` | 0 | frontmatter | `gate: 1`, `verdict: FAIL`. **Not listed in the new § ASSURANCE STANDING "Gate 1 — history" row.** Basis of E-2 (this receipt). |
| map ∋ `⬜ \| OWED \| NOT YET \| Not started \| 🔶` after `:2590` | 0 | **13 markers, each read** | All resolve correctly and are honestly stated. `⑪ Re-freeze, complete CI, re-dispatch Gate 1 — OWED` is **correct at commit time** and is not a defect. |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The SSOT conversion is the right shape of fix — a single canonical block plus pointers, with the same-commit update rule written into it. It is not a sixth restatement, and it is not a new mechanism. E-2 and E-3 are genuinely closed. |
| Design fidelity | **PASS** *(cited; implementation byte-identical to `b62a9fc`)* | No code changed. |
| Functional proof | **PASS** *(branch-runtime scope only; cited, condition verified by diff)* | 97 + 117 + 54 + 41 + 29 + 22 assertions re-executed by me at `b62a9fc`; nothing in this delta can have altered them. |
| Integration | **PASS** *(cited; no code changed)* | |
| Durability | **PASS — pre-merge half only** | Repo-local durability unchanged and previously re-proven in a foreign tree. The installed-runtime divergence is now recorded in **four** places including the migration plan's step 18. The service half remains correctly routed post-merge and **is not asserted as met**. |
| Test quality | **PASS** *(cited; no test file changed)* | |
| Git truth | **PASS** | Branch, head, remote reachability, clean start/end state, the four-path diff and the per-workflow CI position all verified by execution. **Every git and CI claim in the dispatch is accurate.** The head did not move under this review. |
| **Documentation truth** | **FAIL** | **A fifth restatement of gate standing survives, unconverted, in the § ACTIVE SESSION WORK PACKAGE header table's `Phase` row.** See below and E-1. **Amendment 6 ② prescribes FAIL, not HOLD, for an active Wayfinder statement that misstates the live Phase.** |
| Residual risk | **PASS** | Every residual the dispatch carried is real and is recorded honestly, including the uncomfortable ones. Unchanged in strength. |
| **Completed automation** | **HOLD** | **Mandatory here.** **① Amendment 9** — reclassified MANUAL **for Gate 1 acceptance and evidence purposes ONLY**; it **REMAINS AUTOMATIC** as a product requirement and **nothing in this receipt accepts it, or describes it as permanently manual, accepted or complete.** **② `codex_qa_started`** — never invoked by its real production event; zero rows; no turn for #97. **Warwick has ROUTED its acceptance to the real Codex run after Gate 1 PASS, and the map now records that routing verbatim at `:2746`–`:2749`. Routing is not acceptance.** It is not accepted until that real sequence is seen. |

## MANDATORY DIMENSION — Amendment 6 ①3 enumeration / document currency

**Verdict: FAIL.**

**First, what actually got fixed, because it is substantial and it is the right shape.** The § ASSURANCE STANDING block at `:2729` exists, is canonical, is **current in every row**, and carries the rule that produced the recurrence — *update it in the same commit that banks the receipt.* The four restatements I named at `b62a9fc` are all now pointers, each annotated with the false claim it used to carry. **E-2 (the `IN FLIGHT` row beside its own `INTEGRATED` successor) and E-3 (zero occurrences of "Tower" in the migration plan) are both closed.** This is a root-cause fix, not a sixth patch, and I record that plainly.

**Then, the finding Larry asked for, in the exact words he asked for it: a fifth restatement survives.**

| Where | The statement | Why it is false at this head |
|---|---|---|
| map `:2598` — the **`Phase`** row of the § ACTIVE SESSION WORK PACKAGE header table | *"BUILD-020 Phase 4 — amended WP in flight · row 3 automatic Outlook **NOT LIVE** · **Gate 1/2 HOLD at older head** · **Gate 2 re-verdict required at final head after row 3 honest acceptance**"* | **Two clauses false, one misleading.** Gate 1's standing is **FAIL @ `b62a9fc`**; Gate 2's is **FAIL @ `07aa166`**, with the phase question answered **NO**. Neither is HOLD. **"After row 3 honest acceptance"** conditions Gate 2 on a row **Amendment 4 descoped** — the map's own instruction fifteen lines below is *"do not grade it, do not cite it as owed"*, and this row cites it as a live precondition. |

**Why the SSOT repair did not catch it.** Larry converted the four places whose wording he had just read in my last receipt, and verified by grepping that wording. This row states the same fact in **different words** — `Gate 1/2 HOLD at older head` matches none of the strings he searched. It was authored at **`f6ce6a1`**, before Amendments 4 and 6 existed, and has never been re-cut. **This is the identical failure mode already recorded twice in this map** — Veritas @ `2cf3673` (*"fixing where an arrow points does not make the target true"*) and Veritas @ `275ec07` (*"he grepped for the label he had just repaired and not for the label the entry block points WITH"*). **I missed it too, at `b62a9fc` and at `07aa166`. It is recorded against both of us.**

**Why this is blocking, and the exact actions it makes unsafe.** Line `:2590`, four lines above the row, states that *"Every Work Order, **Veritas dispatch**, `/rotate` report and **merge-readiness statement** derives from here."* The row sits in that block, is unstruck and unannotated, and is read **before** the pointers at `:2628`–`:2629` and **131 lines before** the canonical block. Concretely it endangers:

- **route step 17 — the merge decision pack to Warwick** (`merge-decision`, his own decision gate). A pack derived from this row tells him the gates stand at **HOLD on an older head**, omitting that **Gate 2 answered "can Warwick do the thing this phase promised" with NO** and that nothing in 4B is reachable on `:8090`. That is a material understatement of assurance standing at the one point where Warwick, not Larry, decides.
- **route step 16's fail-closed Codex checkpoint**, which requires every open finding disposed; a standing that omits a FAIL disposes nothing.
- **any re-dispatch of Gate 1 or Gate 2** built from this block, which the WP's own dispatch law forbids narrowing.

**Amendment 6 ② is Warwick's own binding rule and it names this case exactly** — an active Wayfinder statement that *"misstates the live Phase"* returns **FAIL**, not HOLD. This is the row labelled `Phase`. **That, and not my discretion, is what sets the verdict.**

**Category-D — non-blocking:** the new § ASSURANCE STANDING *"Gate 1 — history"* row lists eight verdicts and **omits the real Gate 1 FAIL @ `0cf70c9`**, whose receipt is committed in this tree and which the map itself cites at `:2576`. The row includes the equally pre-4B `f0d2614`, so the omission is inconsistent rather than scoped. Clerical; the SSOT block's *history* half is incomplete on its first outing while its *current* half is correct.

**Second-order observation, recorded once and not a finding.** The `Gate 1 — current` cell leads with **`FAIL @ 07aa166`** in bold and reaches `b62a9fc` mid-sentence. The full truth is in the cell, but a reader skimming a row labelled "current" takes the bolded head as current. Worth a re-cut when the block is next touched; it misdirects nobody today.

**Everything else resolves correctly.** The Frontier and First-safe-action rows, route step 14's explicit pointer to the unique label, the struck Grok blocks, the historical/spent-route banners, the Amendment 11 4C block and all thirteen outstanding-state markers after `:2590` are correct and non-directive or honestly stated.

## The process question Larry asked — was this gate preparation again?

**No. This one is a genuine root-cause fix, and I say so without qualification.** SSOT plus pointers plus a same-commit update rule is the correct structural answer, and it removes the mechanism by which six verdicts were lost. **What it did not do is enumerate by meaning — it enumerated by remembered wording, which is the narrower half of the same discipline.** The block that was built to end restatement was built from a list of restatements, and a restatement that used other words was therefore invisible to it. **The fix is sound; its coverage check was the old habit.** One row, four lines below the sentence that says every merge-readiness statement derives from this block.

## Production caller and journey

Unchanged from `b62a9fc`, re-verified by diff rather than assumed — no `services/**` or `tools/**` path is in the four-path delta. `codex_qa_started` is still emitted in `processTurn` immediately before the real Codex call, from the installed, session-independent watcher. **The producer is on the journey. The card is not — no card has ever been rendered on the real TowerBot from this path.**

## Restart and durability

- **Repo-local durability** — proven at `b62a9fc` in a foreign export with no `.git` and no `node_modules`; byte-identical implementation here.
- **Machine-global governor half** — holds; every invocation is already a fresh process.
- **Installed Tower runtime** — running unmerged branch bytes; now honestly recorded in **four** independent places, and for the first time **scheduled** for re-alignment from canonical merged `main` at migration-plan step 18 with its own rollback path. **E-3 closed.**
- **Installed service half** — NOT executed, correctly, and correctly routed post-merge. **Owed, not discharged.**

## Documentation contradiction scan

- **Larry's declared impact:** a single canonical § ASSURANCE STANDING block; four restatements converted to pointers; the same-commit rule written in; E-2 and E-3 closed; two Rule 4a signposts re-cut.
- **Verified independently against the export:** all of it holds. The block is current, the four pointers are real and annotated, E-2 and E-3 are genuinely closed, and the Rule 4a signposts were already consistent with the new constitutional wording.
- **What his list missed:** **map `:2598` — the `Phase` row**, a fifth statement of gate standing in different words, inside the very block that governs Veritas dispatch and merge readiness; and the `0cf70c9` omission from the new history row.
- **Active documents that would misdirect a fresh instance:** `Deliverables/2026-08-04-proofline-wayfinder-plan.md:2598`. **No other.**
- **Closure claims since the last receipt, and the receipt behind each:** **none made.** The execution log's *"Progress only; no completion claim, and no PASS"* holds. All nine Gate 1 receipts and both Gate 2 receipts are present on disk. **No false completion claim and no suppressed receipt detected.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **E-1** | **high** | **A fifth restatement of gate standing survives the SSOT conversion**, at map `:2598` — the `Phase` row of the § ACTIVE SESSION WORK PACKAGE header table. It claims *"Gate 1/2 HOLD at older head"* where Gate 1 is **FAIL @ `b62a9fc`** and Gate 2 is **FAIL @ `07aa166`** with the phase question answered **NO**, and conditions a Gate 2 re-verdict on *"row 3 honest acceptance"* although Amendment 4 descoped row 3. Unstruck, unannotated, authored at `f6ce6a1` and never re-cut; it matched none of the strings the repair grepped for. **Blocks route step 17 (merge decision pack to Warwick) and route step 16 (fail-closed Codex checkpoint), and any Gate dispatch built from this block — all of which `:2590` states derive from here.** **Amendment 6 ② → FAIL, not HOLD.** | **blocking** | Larry |
| **E-2** | **low** | The new § ASSURANCE STANDING *"Gate 1 — history"* row omits the real **Gate 1 FAIL @ `0cf70c9`** (receipt committed in this tree; cited by the map at `:2576`) while including the equally pre-4B `f0d2614`. The block's *current* half is correct; its *history* half is incomplete. | **non-blocking** | Larry |
| **E-3** | **low** | `Gate 1 — current` leads in bold with `FAIL @ 07aa166` and reaches `b62a9fc` mid-sentence. Accurate in full, skimmable wrong. Re-cut when next touched. | **non-blocking** | Larry |
| **E-4** | **medium** | **`codex_qa_started` remains capability, not completed automation** — zero rows, no turn for PR #97. **Warwick has ROUTED its acceptance to the real post-Gate-1 Codex run and the map records that verbatim; routing is not acceptance, and no Gate 1 verdict may treat it as accepted.** Carried forward unchanged from `b62a9fc`; **not mine to route.** | **non-blocking** | Warwick's decision |
| **E-5** | **low** | The truthful `/api/rotation-reports` failure returns **HTTP 200** with `ok:false`; a status-code-only monitor would read a failed read as success. Confirmed, nothing added. | **non-blocking** | Warwick's decision |

**No finding here is a Work Order.** A finding is an observation; Larry owns the repair and its routing.

## Verdict

**FAIL** — **rows 1, 2 and 4 all PASS on their pre-merge halves**, cited from `b62a9fc` on a citation condition I verified myself by diff, and the engineering is unchanged and unweakened. **E-2 and E-3 from that receipt are genuinely closed, and the SSOT standing block is the correct structural fix rather than a sixth restatement.** The FAIL is carried entirely by **E-1**: one unconverted row, in different words, in the block the map itself says every merge-readiness statement derives from.

**What this verdict does and does not do.** It gates completion claims, PASS, closure and merge for rows 1, 2 and 4. It does **not** retract those rows. It does not transfer the route or the work queue to Veritas, does not block unrelated safe implementation, and does not reopen Sub-phase 4A. **Codex remains ineligible** (Gate 1 PASS is a precondition, and Warwick's explicit authority sits on top). **Amendment 9 remains AUTOMATIC as a product requirement, and nothing in this receipt may be cited as accepting it, or as describing it as permanently manual, accepted or complete before the post-merge test passes.** **A Gate 1 PASS would not mean the Cockpit surface works, that durable capture is delivered, or that the TowerBot card exists.**

**Said plainly:** the fix was the right one and it worked. It was verified by searching for the sentences it had just rewritten, and the one it had never read survived four lines from the sentence that makes it matter.

## Next review trigger

A new frozen exact head on `build-020/phase4-automation-law` at which **every** statement of gate standing in the active map — enumerated **by meaning**, not by remembered wording — is either the § ASSURANCE STANDING block itself or an annotated pointer to it, `:2598` included; with CI complete at that literal head and Gate 1 re-dispatched over rows 1, 2 and 4 with no narrowing.
