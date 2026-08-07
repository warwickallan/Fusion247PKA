---
build: BUILD-020
scope: sub-phase-4B — ACTIVE SESSION WORK PACKAGE functional rows 1, 2 and 4 (row 3 descoped by Amendment 4)
gate: 1

reviewed_sha: b62a9fcca9eac8357b12565330fec79ea63966b4
governance_sha: b62a9fcca9eac8357b12565330fec79ea63966b4
branch: build-020/phase4-automation-law
remote_reachable: true  # git branch -r --contains → origin/build-020/phase4-automation-law

evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA-build-020-trial\e1a5349f-4c7d-4ce4-bb91-f2ea51224e07\scratchpad\export-b62a9fc
worktree_head_at_start: b62a9fcca9eac8357b12565330fec79ea63966b4
worktree_head_at_end: b62a9fcca9eac8357b12565330fec79ea63966b4
worktree_status_clean: true  # clean at start and at end; the head did NOT move during this review

review_ceiling: one pass, <= ~150k tokens (dispatch)
private_surface: none accessed; credential_scope none honoured; tower-baton.env not opened

verdict: FAIL
receipt_sha256: c11615148a12b13ef02c53e0e0c970eff85d6c5fa3446c5b94deeeb574297d93
reviewed_by: veritas
reviewed_date: 2026-08-07
next_review_trigger: a new frozen exact head at which the active map states the current assurance standing truthfully (E-1), CI complete at that literal head, Gate 1 re-dispatched over rows 1, 2 and 4
---

## Scope reviewed

**Gate 1 only.** The dispatch narrowed this review to **row 1 graded afresh** plus **the enumeration / document-currency dimension graded afresh**, with rows 2 and 4 cited from the `07aa166` receipt under Warwick's condition: *"only to the extent the intervening commits demonstrably did not change their reviewed implementation."*

**I verified that condition myself before accepting the narrowing.** `git diff --name-only 07aa166 b62a9fc` returns **six paths, every one under `Deliverables/`** — no `services/**`, no `tools/**`, no `.github/**`, no test file. The narrowing therefore holds and is **not** a narrowing to an older product slice. I nonetheless **re-executed row 4's pre-merge gates at this head** rather than citing them cold, because re-execution was cheap and citation is weaker.

**Row 3** — descoped by Amendment 4, not graded. **Replacement-machine DR** — out of scope by the row's own text, not graded. **Gate 2 / the phase North-Star journey** — separate receipt, not graded here.

**No widening was required.** The dispatch carried every functional numbered requirement and every known residual. The one item I widened to is the machine-installed `~/.mypka/tower-runtime` state, because it sits directly on row 1's own clauses; it was already inside the previous receipt's scope.

**Publication constraint honoured** — no attack detail. **Private surface:** nothing under `C:\.fusion247\**` was read; `tower-baton.env` was not opened. `~/.mypka/tower-runtime/INSTALLED-FROM.txt` is machine state outside that boundary and carries no credential value.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **1** | **BUILD-020 durability / promotion readiness.** Accepted operating mechanisms correctly classified (session-independent · machine-global install · generic repo assets in PR #97 · BUILD-020-specific). Survives: dead Larry session · worktree delete/recreate · fresh branch from current main · branch from main after #97 merges · installed-runtime restart. Replacement-machine DR not claimed. **Exact merge unit + post-merge install alignment listed.** *(Amendment 3 hook outcomes struck; not graded.)* | **PASS — pre-merge branch-runtime half only** | **The three grounds that held row 1 at `07aa166` are repaired, and I verified each in the export rather than from the dispatch.** **D-2:** the alignment table's *"Propagate private-api proxy"* instruction is struck at `2026-08-06-amended-wp-recon-evidence.md:33` and replaced with `DO NOT PROPAGATE`, naming the pre-WO-31 handler, why porting it would reintroduce the exposure, and pointing at migration plan §2/§4.8 — **and the diff proves exactly one line of that file changed**, so nothing else moved under cover of the repair. **D-3:** migration plan §4 step 8 now carries item **6**, which states that a dropped `Origin` was harmless before WO-32 and now turns every browser write into a 403, that `COCKPIT_ALLOWED_ORIGINS` **cannot** rescue a no-`Origin` request, what to confirm at step 18, and that the claim *"a browser always sends `Origin`"* is **recalled, not verified**. **D-4:** the durability record §5 stale list is struck with a verified current-state table above it; the machine-installed `INSTALLED-FROM.txt` itself now carries a dated correction stating the runtime is **not** the merged-main resync, that *"installed from canonical merged source"* is **FALSE until the merge lands. Do not claim it"*, with rollback path and pre-alignment digests — **read by me on the machine, mtime 18:09:16**. **Survival properties re-proven by me at this head:** `clone-portability-check` **22 assertions, 0 failed, 5 mutations all caught** in a genuinely foreign tree (no `.git`, no `node_modules`) with the loud skip naming my export path — that is the worktree-delete/recreate property itself, not a proxy; `provenance-check` **29 assertions, 0 failed**. **Fresh-branch-from-main verified independently of Larry's account:** `git ls-tree origin/main` (`4eb5368`) shows the BUILD-020 cockpit assets **absent** and `tools/wo/envelope.mjs` **present** — exactly as row 1 claims. **Machine-global install:** nine `.mjs` modules present under `~/.mypka/governor/`; existence verified, nothing invoked. | **OWED, not discharged, and this PASS asserts none of them:** *"branch from main after #97 merges"* · `installed-runtime restart` **service half** (Amendment 12 ① routes it post-merge) · **Amendment 9's real unattended capture — reclassified MANUAL for Gate 1 acceptance and evidence purposes ONLY; it REMAINS AUTOMATIC as a product requirement, with the binding seven-condition post-merge re-test at step 18.** **Non-blocking residual E-3:** `~/.mypka/tower-runtime` is now honestly classified in three places but still appears in **no** post-merge alignment table, and the migration plan contains **zero** occurrences of "Tower". |
| **2** | **Gate 2 Phase 4 residuals dispositioned against current evidence.** Every old Gate 2 residual at `95f8826` returns exactly one of DISCHARGED · STILL OPEN · RECLASSIFIED · NOT PART OF THE PHASE. | **PASS — cited from `07aa166`, citation independently qualified** | **I did not take the citation on trust.** The disposition table lives in a file that *did* change since `07aa166`, so I diffed it: `git diff 07aa166 b62a9fc -- Deliverables/2026-08-06-amended-wp-recon-evidence.md` = **1 file changed, 1 insertion, 1 deletion**, and the changed line is the D-2 alignment row, **not** the disposition table. Row 2's reviewed artefact is therefore **byte-identical** to the head at which I enumerated it by meaning and passed it. | none blocking. |
| **4** | **Live Cockpit production surface + truthful CareerAIR operational view** — split by runtime under Amendment 10 ②. | **PASS — pre-merge branch-runtime half only; re-executed, not merely cited** | Re-run by me in the export at **this** head: `render-vm-check` **24 scenarios / 54 assertions, 0 failed**, including all three SYSTEM scenarios and *"no unknown rendered as a zero"*; `rotation-report-check` **117 assertions, 0 failed — NULL never became 0**; `nav-check` **41 assertions, 0 failed**; `origin-boundary-check` **97 assertions, 0 failed, 5 permissive fixtures all caught**; `provenance-check` **29 assertions, 0 failed**. | **The live half is OWED, not delivered. This PASS must never be described as "the Cockpit surface works".** Carried unfiltered: the `tailscale`/`Origin` write-outage risk · browser-always-sends-`Origin` is **recalled, not verified, no browser exercised** · R1's assumption that GET on the private upstream is non-mutating · CareerAIR overlay reachability unprovable in this repository. |

**All three functional rows pass their pre-merge halves. The overall verdict is not PASS, and the reason is not the engineering** — see the enumeration dimension and E-1.

## Evidence provenance

- Isolated export created with `git archive b62a9fcca9eac8357b12565330fec79ea63966b4 | tar -x -C <workspace>` at the path in the frontmatter, **outside the repository**, never committed. **No `git worktree` was created.**
- Repository `git rev-parse HEAD` at start and at end — **`b62a9fcca9eac8357b12565330fec79ea63966b4` both times, identical.** `git status --porcelain` **empty at start**; at end it carries only this receipt as untracked. **The head did not move during this review** — Larry's stated isolation held, and that is a change from the previous review, where it did not.
- Every functional command below ran **inside the export**, not in the working tree. Machine-state reads (`INSTALLED-FROM.txt`, the governor module listing, the CI query) are read-only and are labelled as machine state, taken at review time rather than at `reviewed_sha`.
- **No mutation was applied to the repository.** All mutation evidence is the gates' own built-in fixtures, executed in the export.
- No tracked file was modified by this review.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git diff --name-only 07aa166 b62a9fc` | 0 | 6 paths | **All six under `Deliverables/`.** No `services/**`, `tools/**`, `.github/**` or test file. The narrowing condition Warwick set is satisfied. |
| `git diff 07aa166 b62a9fc -- …amended-wp-recon-evidence.md` | 0 | 1 file, +1/−1 | The single changed line is the D-2 alignment row. Row 2's disposition table is byte-identical. |
| `node clone-portability-check.mjs` (export) | 0 | **22 assertions, 5 mutations** | PASS, 0 failed, **all mutations caught**. Existence check **SKIPPED and said so**, naming my export path. |
| `node provenance-check.mjs` (export) | 0 | **29 assertions** | PASS, 0 failed. `provenance: not-a-repo` in an archive export — correct and honest. |
| `node render-vm-check.mjs` (export) | 0 | **24 scenarios / 54 assertions** | PASS, 0 failed. Three SYSTEM scenarios present. |
| `node rotation-report-check.mjs` (export) | 0 | **117 assertions** | PASS, 0 failed. |
| `node nav-check.mjs` (export) | 0 | **41 assertions** | PASS, 0 failed. |
| `node origin-boundary-check.mjs` (export) | 0 | **97 assertions, 5 fixtures** | PASS, 0 failed; all permissive fixtures caught. |
| `git ls-tree origin/main` (`4eb5368`) | 0 | n/a | BUILD-020 cockpit assets **absent** from main; `tools/wo/envelope.mjs` **present**. Row 1's fresh-branch-from-main classification verified independently. |
| `gh run list` filtered to `headSha == b62a9fc…` | 0 | 7 runs | `cockpit-private-apps` + `secret-scan` **`push` / completed / success`**; all five **`pull_request` / completed / success`**. **Larry's precise statement is exactly right** — two green on `push` at the literal head tree, three only against a merge commit. |
| `git branch -r --contains b62a9fc…` | 0 | 1 | `origin/build-020/phase4-automation-law` — remotely reachable. |
| `~/.mypka/tower-runtime/INSTALLED-FROM.txt` | 0 | 81 lines | **Correction appended and correct.** Names the unmerged-branch divergence, forbids the canonical-merged-source claim, gives the rollback path and pre-alignment digests, and retires the stale `TOWER_EVIDENCE_REPO_DIR` "KNOWN GAP" with a properties-only account and an honestly retained caveat. |
| `~/.mypka/governor/*.mjs` | 0 | 9 files | Present. **Nothing invoked** — invoking `ding.mjs` would send a real message. |
| `codex_qa_started` on the **real TowerBot** | — | — | **UNVERIFIED — never observed.** Zero rows; no turn has ever existed for PR #97. |
| `Deliverables/2026-08-04-proofline-wayfinder-plan.md` ∋ `07aa166` | 1 | **0 matches** | **The active map does not mention the reviewed-and-failed head at all**, although both `07aa166` receipts are committed in this very tree. Basis of E-1. |
| `Deliverables/2026-08-07-cockpit-live-migration-and-rollback-plan.md` ∋ `Tower` | 1 | **0 matches** | Basis of E-3. |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The repairs answer the findings as written, in the right files, without adjacent expansion. D-2's repair in particular states the danger, the cause, the history of the miss, and the pointer — it is the strongest documentary repair I have seen in this Sub-phase. |
| Design fidelity | **PASS** *(cited; implementation byte-identical to `07aa166`)* | No code changed. `originDecision()` and the composed boundary rule are untouched by this delta. |
| Functional proof | **PASS** *(branch-runtime scope only)* | 97 + 117 + 54 + 41 + 29 + 22 assertions re-executed by me in isolation, all green, mutations caught. |
| Integration | **PASS** *(cited; no code changed)* | Traced at `07aa166`; nothing in this delta can have altered it. |
| Durability | **PASS — pre-merge half only** | Repo-local durability re-proven in a foreign tree. The installed-runtime divergence is now recorded in the map, the durability record and the installed artefact itself. The service half remains correctly routed post-merge and **is not asserted as met**. |
| Test quality | **PASS** *(cited; no test file changed)* | Mutations bite, counts are two-sided, and the loud skip degraded and announced rather than passing quietly. |
| Git truth | **PASS** | Branch, head, remote reachability, clean start/end state and the per-workflow CI position all verified by execution. The CI statement in the dispatch is accurate to the event, which is the correction Larry made against himself and then kept. |
| Documentation truth | **FAIL** | **The active map states an assurance standing that two receipts committed in this very head disprove.** See the enumeration section and E-1. Amendment 6 ② prescribes FAIL, not HOLD, for an active Wayfinder statement that misstates live state. |
| Residual risk | **PASS** | Every residual the dispatch carried is real, and I found the record now honest about all of them — including the ones that are uncomfortable: capability-not-automation for the card, unmerged bytes on the live estate, `sourceHash` non-comparability, the HTTP-200 truthful failure, R1's unverified assumption, and *"no browser was exercised"*. This is the dimension the package is consistently strongest on. |
| **Completed automation** | **HOLD** | **Mandatory here.** Two automatic outcomes sit in the reviewed scope. **① Amendment 9** — reclassified MANUAL by Warwick **for Gate 1 acceptance and evidence purposes ONLY**; it **REMAINS AUTOMATIC** as a product requirement, and nothing in this receipt accepts it. **② `codex_qa_started`** — never invoked by its real production event, zero rows, no turn for #97; **not reclassified by anyone.** Its only acceptance path is a real Codex run, which requires Gate 1 PASS — **the third instance of the circularity Warwick has already resolved twice, and it is not mine to route.** Recorded for him; see E-4. |

## MANDATORY DIMENSION — Amendment 6 ①3 enumeration / document currency

**Verdict: FAIL.**

I enumerated by **meaning**, not by remembered label: every `⬜` / `OWED` / `IN FLIGHT` / `NOT YET` / `Not started` / next-action marker, every state cell in the `🎯 THE ONE CURRENT NEXT ACTION` table, the START/RESUME and Frontier rows, every count-of-work-delivered statement, **and — new this pass — every statement of current assurance standing**, because the START/RESUME contract requires a fresh Larry to state *"the current phase and gate"* before doing anything.

**The four defects the previous receipt named are repaired and the repairs hold.** `⑯` now reads `APPLIED — WO-32 @ 4c55781` with a do-not-raise guard; a `⑰` row exists; the count reads **TEN** Work Orders and names all ten; the execution log carries WO-31, WO-32, WO-33 and the Tower alignment; the durability record's §5 is struck with a verified current-state table above it.

**Category-C — unsafe, misdirecting:**

| Where | The statement | Why it is false at this head |
|---|---|---|
| map `:2953` — **`Standing:`**, the map's last word on gate state | *"Gate 1's current standing is **HOLD at `19fc792`** — rows 2 and 4 PASS, row 1 HOLD on `installed-runtime restart` (service half) **pending Warwick**, **enumeration dimension PASS**. **Gate 2 remains un-dispatched.**"* | **Four clauses, all false.** Gate 1's standing is **FAIL @ `3254c69`** and then **FAIL @ `07aa166`**. Row 1's HOLD at `07aa166` was on D-2/D-3/D-4, **not** on `installed-runtime restart`, which Amendment 12 ① had already routed post-merge — so *"pending Warwick"* would invite an interrupt on a settled matter. The **enumeration dimension FAILED** at both later heads. **Gate 2 was dispatched and returned FAIL @ `07aa166`**, answering the phase question **NO** — and its receipt is committed in this very tree. |
| map `:2884` — § ROTATION, *"Assurance position"* | *"**Four Gate 1 receipts now exist** … The **current standing** is Gate 1 HOLD at `19fc792`, blocked **solely** by `installed-runtime restart` (service half) pending Warwick. **Gate 2 remains un-dispatched.**"* | **Six Gate 1 receipts exist**, and *"blocked solely"* is false. `/rotate` step 11 verifies the Honcho read-back **against this block**, so a stale block is checked against and passes. This row was itself corrected once before, at `19fc792` (finding E-3), and has gone stale again by two receipts. |
| map `:2628`–`:2630` — WP assurance rows 5 and 6 | *"**HOLD** @ `f0d2614`"* for both gates, citing the `2026-08-06` receipts | Stale by **six** Gate 1 receipts and one Gate 2 receipt. |
| map — everywhere | **The string `07aa166` does not occur in the active map.** | The map does not know that the head it was last assured against was reviewed, that Gate 1 returned **FAIL**, or that Gate 2 returned **FAIL** with the phase question answered **NO**. **The two commits that constitute this head are the commits that added those two receipts.** |

**Why this is blocking, and the exact action it makes unsafe.** The current next action is `⑪ Re-freeze, complete CI, re-dispatch Gate 1`. The WP's own Veritas dispatch law requires that dispatch to carry **every known residual** and forbids narrowing. A fresh Larry — after `/clear`, which is the condition the map exists for — would build that dispatch from `:2953` and would carry *"rows 2 and 4 PASS, row 1 HOLD pending Warwick, enumeration PASS, Gate 2 un-dispatched"*: an assurance standing that is **better than the truth in every clause**, omitting two FAIL receipts and the Gate 2 finding that **nothing in 4B is reachable on `:8090`**. The same false standing then propagates into route step 16's Codex checkpoint — which is **fail-closed on disposing every open finding** — and into route step 17's merge decision pack. **Amendment 6 ② makes this a FAIL rather than a HOLD**, and it is the only ground on which this receipt is not a PASS.

**Category-D — ambiguous, non-blocking:** map `:2685` still shows step *"5 (Amendment 7) — rotation-report surface | **IN FLIGHT**"* four rows above the same step marked `INTEGRATED` at `:2689`. Named at `07aa166`, unrepaired, still non-blocking.

**Everything else resolves correctly** to `§ ACTIVE SESSION WORK PACKAGE → 🎯 THE ONE CURRENT NEXT ACTION`. The Frontier and First-safe-action rows, the historical and spent-route banners, the struck Grok blocks and the Amendment 11 4C block are all correctly non-directive.

## The process correction — Larry asked whether the record now reflects the state, or whether this was gate preparation again

**It was gate preparation again — and the evidence is unusually clean, because it is inside the head itself.**

The two commits that make up this head each carry a Veritas receipt **and** the repairs its findings named. The repairs are genuine, specific and good; D-2's is exemplary and D-4's reaches an artefact outside the repository. But **the map was re-cut for the findings' list and not for the receipts' existence.** The verdicts were known at commit time — Larry recorded **both** of them, correctly, in the Tower durability record's new current-state table in the same tree — and the higher-authority document, the one the orientation contract and `/rotate` read, was left saying `HOLD @ 19fc792`, `enumeration PASS`, `Gate 2 un-dispatched`.

So the shape is unchanged from the previous receipt's closing observation, but sharper: **the record is now current with respect to the last review's finding list, and stale with respect to the last review's outcome.** A repair scoped to a findings table cannot make a map true, because the map's staleness is produced by the *event of moving on*, not by the *content of the last complaint*. **This is the sixth consecutive Gate 1 verdict carried by that one property.** I record it once, as an observation; the route and the repair are Larry's, and nothing here asks for a mechanism.

## Production caller and journey

Unchanged from `07aa166` — no code moved, and I re-verified that by diff rather than assuming it. The `/private-api` boundary decision still precedes the body-buffering loop and the forward. `codex_qa_started` is still emitted in `processTurn` immediately before the real Codex call, from the installed, session-independent, worktree-independent watcher. **The producer is on the journey. The card is not — no card has ever been rendered on the real TowerBot from this path.**

## Restart and durability

- **Repo-local durability — re-proven at this head** in a foreign export with no `.git` and no `node_modules`: clone portability 22 assertions / 5 mutations, provenance 29, render 24/54.
- **Machine-global governor half — holds.** Nine installed modules present; every invocation is already a fresh process.
- **Installed Tower runtime — running unmerged branch bytes, and now honestly recorded in three independent places**, including the installed artefact itself, which forbids the canonical-merged-source claim in its own words.
- **Installed service half — NOT executed**, correctly, and correctly routed post-merge. **Owed, not discharged.**

## Documentation contradiction scan

- **Larry's declared impact:** the evidence pack's alignment row (D-2), the migration plan's `Origin`-arrival obligation (D-3), the durability record's §5 (D-1), `INSTALLED-FROM.txt` (D-4).
- **Verified independently against the repository and the machine:** all four present, accurate, and durably recorded rather than asserted. The D-2 repair is confirmed by diff to have changed exactly one line, so no other content moved under cover of it.
- **What his list missed:** the map's own statements of current assurance standing — `:2953`, `:2884`, `:2628`–`:2630` — and the absence of `07aa166` anywhere in the map. **The correct current standing exists in the durability record in the same tree, so this is not a knowledge gap; it is a placement gap, in the one document whose placement matters most.**
- **Active documents that would misdirect a fresh instance:** `Deliverables/2026-08-04-proofline-wayfinder-plan.md:2953`, `:2884`, `:2628`–`:2630`, `:2685`.
- **Closure claims since the last receipt, and the receipt behind each:** **none made.** The execution log's header — *"Progress only; no completion claim, and no PASS"* — holds. **No false completion claim anywhere in the package.** All six prior Gate 1 receipts and both Gate 2 receipts are present on disk. **No suppressed receipt detected.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **E-1** | **high** | **The active map misstates the current assurance standing in every clause of its own `Standing:` sentence**, and does not mention `07aa166` at all, although both `07aa166` receipts are committed in this head. It claims Gate 1 HOLD where two FAILs stand, `enumeration dimension PASS` where that dimension has FAILed twice, a row-1 blocker *"pending Warwick"* that Amendment 12 ① already routed post-merge, and `Gate 2 un-dispatched` where Gate 2 returned FAIL and answered the phase question NO. **Blocks the current next action `⑪ Re-freeze, complete CI, re-dispatch Gate 1`**: a dispatch built from this standing omits two FAIL receipts' residuals and narrows the scope, which the WP's own dispatch law forbids — and the same false standing propagates into the fail-closed Codex checkpoint and the merge decision pack. **Amendment 6 ② → FAIL, not HOLD.** | **blocking** | Larry |
| **E-2** | **low** | Map `:2685` still shows step *"5 (Amendment 7) — rotation-report surface | IN FLIGHT"* four rows above the same step marked `INTEGRATED` at `:2689`. Named at `07aa166`; unrepaired. | **non-blocking** | Larry |
| **E-3** | **low** | **`~/.mypka/tower-runtime` appears in no post-merge alignment table**, and the migration plan that executes step 18 contains **zero** occurrences of "Tower". D-4's *classification* half is fully repaired; its *alignment-listing* half is not. Effect is generically covered by route step 18's *"align installed/runtime from canonical merged Git"* and by the INSTALLED-FROM correction, so this misdirects nobody — but the disposal of `~/.mypka/tower-backups/2026-08-07-pre-wo33-alignment/` and the provenance refresh are scheduled by nothing specific. | **non-blocking** | Larry |
| **E-4** | **medium** | **`codex_qa_started` is capability, not completed automation** — never observed on the real TowerBot, zero rows, no turn for PR #97 — **and its only acceptance path is a real Codex run, which requires Gate 1 PASS.** That is the **third** instance of the same structural circularity Warwick resolved for row 4 (Amendment 10 ②) and for `installed-runtime restart` (Amendment 12 ①). **Unlike Amendment 9 it has been reclassified by nobody**, so no Gate 1 verdict may treat it as accepted. **Not mine to route; recorded once for Warwick's decision.** | **non-blocking** | Warwick's decision |
| **E-5** | **low** | The truthful `/api/rotation-reports` failure returns **HTTP 200** with `ok:false`; a status-code-only monitor would read a failed read as success. Already reported once by Larry; I confirm it and add nothing. | **non-blocking** | Warwick's decision |

**No finding here is a Work Order.** A finding is an observation; Larry owns the repair and its routing.

## Verdict

**FAIL** — **rows 1, 2 and 4 all PASS on their pre-merge halves, and the delivered engineering is the strongest it has been at any head in this Sub-phase.** The FAIL is carried entirely by **E-1**: the active map's statement of its own assurance standing is false in every clause, and it was falsified by the two receipts committed *inside this head*.

**What this verdict does and does not do.** It gates completion claims, PASS, closure and merge for rows 1, 2 and 4. It does **not** retract those rows — they stand on the evidence recorded above and a corrected head should be able to carry them forward. It does not transfer the route or the work queue to Veritas, does not block unrelated safe implementation, and does not reopen Sub-phase 4A. **Codex remains ineligible** (Gate 1 PASS is a precondition, and Warwick's explicit authority sits on top). **Amendment 9 remains AUTOMATIC as a product requirement, and nothing in this receipt may be cited as accepting it, or as describing it as permanently manual, accepted or complete.** **Gate 1 PASS would not mean the Cockpit surface works, that durable capture is delivered, or that the TowerBot card exists.**

**Said plainly:** the work is ready and the record about the work is not. One sentence in the map is the whole distance.

## Next review trigger

A new frozen exact head on `build-020/phase4-automation-law` at which the active map states the current assurance standing truthfully — Gate 1's real standing, Gate 2's FAIL and its phase answer, and the retirement of the `19fc792` and `f0d2614` standing claims — with CI complete at that literal head and Gate 1 re-dispatched over rows 1, 2 and 4 with no narrowing.
