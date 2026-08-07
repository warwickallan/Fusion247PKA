---
build: BUILD-020
scope: subphase-4B-functional-row-1 (rows 2 and 4 cited from the 443d0fa receipt, narrowing verified)
gate: 1
reviewed_sha: 19fc7924ed63a787a79ac33f7208132f440f1361
governance_sha: 19fc7924ed63a787a79ac33f7208132f440f1361
governance_blob: 8c85fdbce3b8418d0f5640183d84ca5284ea1e1a
branch: build-020/phase4-automation-law
remote_reachable: true
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA-build-020-trial\e1a5349f-4c7d-4ce4-bb91-f2ea51224e07\scratchpad\exp19fc792
worktree_head_at_start: 19fc7924ed63a787a79ac33f7208132f440f1361
worktree_head_at_end: 19fc7924ed63a787a79ac33f7208132f440f1361
worktree_status_clean: true
ci_at_reviewed_head: complete and green - five distinct workflows completed/success, verified independently
review_ceiling: one pass, <= ~120k tokens (dispatch-stated; not extended; did not bind)
private_surface: C:\.fusion247\private\careerair\** (declared; NOT entered)
credential_scope: none
supersedes: Deliverables/2026-08-07-veritas-gate1-subphase-4b-443d0fa-receipt.md (that FAIL stands as a true verdict about that head)
verdict: HOLD
receipt_sha256: b54a46e1eaea00969c6269fb39a4e7524674901c06ea60a44f55e2f700170322
reviewed_by: veritas
reviewed_date: 2026-08-07
next_review_trigger: either Warwick extends the Amendment 10 pre/post-merge split to name the installed-runtime-restart SERVICE half, or that half is executed - then a fresh Gate 1 dispatch for row 1 at the exact head
---

## Scope reviewed

**Gate 1 only**, at `19fc7924ed63a787a79ac33f7208132f440f1361`.

**Row 1 graded on evidence at this head.** **Rows 2 and 4 (pre-merge branch-runtime half) cited from my own `443d0fa` receipt** under root `CLAUDE.md`'s "ancestor with no later in-scope product change" condition. **I verified that condition myself rather than accepting it:**

```
git diff --name-status 443d0fa 19fc792
M  Deliverables/2026-08-04-proofline-wayfinder-plan.md
A  Deliverables/2026-08-07-veritas-gate1-subphase-4b-443d0fa-receipt.md
```

**Two files, both documentation, no code.** `git diff --stat` = 2 files, +183/-3. The narrowing is therefore legitimate and is **not** the prohibited narrowing to an older product slice — the product slice is byte-identical.

**One correction to the dispatch, recorded not absorbed:** the dispatch states *"`443d0fa..19fc792` is ONE commit"*. It is **two** — `e5de335` (committing my `443d0fa` receipt) and `19fc792` (the row 1 re-cut). Both are documentation-only, so the conclusion holds and the narrowing stands. Non-blocking, but a Git-truth statement in a dispatch is exactly the class this gate checks.

**Row 3 not graded** — descoped by Amendment 4. **Rows 5–7 not graded as product requirements** — assurance/release sequence.

**Not performed, as instructed:** Gate 2 · the Amendment 8 Vex review · any Codex activity. **`Deliverables/2026-08-07-vex-cockpit-boundary-review-443d0fa.md` is untracked at this head, is not part of the reviewed tree, and I did not open it.** Its status is recorded in the dispatch and is Warwick's decision; noting it here only so a successor review does not treat it as an unexplained artefact.

**Private surface.** `C:\.fusion247\private\careerair\**` was declared and **was not entered**. No path under `C:\.fusion247\**` was opened, listed, read or quoted, and no verdict below depends on one. `credential_scope: none` honoured — no credential file was read, and no server was started at this head (none was needed: the engineering surface is byte-identical to `443d0fa`, where I executed it).

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **1** | **BUILD-020 durability / promotion readiness.** Mechanisms correctly classified (session-independent · machine-global install · generic repo assets in PR #97 · BUILD-020-specific); **survives dead Larry session · worktree delete/recreate · fresh branch from current main · branch from main after #97 merges · installed-runtime restart**; replacement-machine DR not claimed; merge unit + post-merge install alignment listed. *(Amendment 3's hook outcomes (a)–(g) are STRUCK at this head and were not graded.)* | **HOLD** | **The four re-cuts I named at `443d0fa` are ALL present and correct at this head, verified line by line in `git show 19fc792`, not from Larry's account:** ① row 1's requirement cell — (a)–(g) inside `~~ ~~` with an explicit *"ARE STRUCK AND ARE NOT PART OF ROW 1 ACCEPTANCE … Do not grade them, do not cite them as owed, do not reproduce or repair against them"*; ② status → *"DONE for the non-hook scope. Hook half STRUCK, not outstanding"*; ③ the evidence block prefaced by *"It directs nothing. Do not act on 'reproduce rather than assume'"*, with the defect retained as true history; ④ § OUT OF SCOPE → *"BACK OUT OF SCOPE, and permanently"* and § Parked → *"NEITHER PARKED NOR IN SCOPE: the outcome was WITHDRAWN"*, with the A/B/C product choice marked MOOT. **`D-1` and `D-2` are CLOSED.** **Classification is substantive, not a label:** the evidence pack carries a six-row boundary table naming, per boundary, the exact assets and the exact survival answer. **Survival re-confirmed from the `443d0fa` execution (code byte-identical):** worktree delete/recreate EXECUTED with all three gates re-run in the recreated worktree · fresh branch from `origin/main` `4eb5368` EXECUTED · machine-global install EXECUTED (fresh process read installed continuity state and recovered live `focus` from a checkout carrying none of this branch's assets). CI at this exact head verified by me: **five distinct workflows, all `completed / success`**. | **One property, and it is the whole HOLD — E-1.** `installed-runtime restart` is a **named row-1 survival requirement**. Its governor half is proven; its **installed SERVICE half is unexecuted**, and the map's own ⑨ states *"the row-1 property is **NOT** asserted as met."* **Warwick's Amendment 10 ② adjudication table assigns to post-merge exactly four things — Amendment 7 ⑥ and ⑨ · the live `:8090` browser journey · Amendment 9's real unattended capture · *"branch from main after #97 merges"*. `installed-runtime restart` is in NEITHER half of that accepted split.** Larry assigned it to step 18 himself; that is a reasonable reading, but it is the gated party assigning an accepted acceptance property, and my contract forbids PASS on inference where the property needs an actor I am not. Also carried: `MyPKA-YouTube-Watcher-Ensure` re-verified **`Disabled`** by execution at this head, correctly and on purpose (migration precondition 5). |
| **2** | **Gate 2 Phase 4 residuals dispositioned against current evidence.** Every old Gate 2 residual at `95f8826` returns exactly one of DISCHARGED · STILL OPEN · RECLASSIFIED · NOT PART OF THE PHASE. | **PASS — cited from `Deliverables/2026-08-07-veritas-gate1-subphase-4b-443d0fa-receipt.md`** | Not re-proven, and it did not need to be: the disposition tables live in `Deliverables/2026-08-06-amended-wp-recon-evidence.md`, which is **byte-identical between `443d0fa` and this head** (it does not appear in the diff). The `443d0fa` receipt is committed **verbatim** — I recomputed its body digest at this head: **`72404be41d3aab9be3a8562fae9889cf969d21e2e7012ebf2a3f816fd10ca79e`**, matching its own frontmatter. | Unchanged non-blockers `D-3` (qualified `V9-1`/`V9-3`/`V9-4` labels) and `D-4` (`V9-1` vs `P-*` divergence). Both still parked at this head; both still non-blocking. |
| **4** | **Live Cockpit production surface + truthful CareerAIR operational view**, ⊕ Amendment 7's nine criteria. **Pre-merge branch-runtime half only**, per Amendment 10 ②: ① ② ③ ④ ⑤ ⑦ ⑧. | **PASS — pre-merge branch-runtime half ONLY — cited from the `443d0fa` receipt** | Not re-proven; `services/**` is byte-identical to `443d0fa`, where I executed the full HTTP path myself on port 8399 against synthetic credentials with zero production contact. | **The live half is OWED, not delivered.** ⑥ ⑨ and the live `:8090` browser journey are post-merge at route step 18. **This PASS does not mean row 4 is delivered to Warwick.** Unchanged. |

**Row 3 — DESCOPED by Amendment 4. Not graded, not owed, not counted.** No numbered functional row is omitted. **Overall cannot be PASS while row 1 is HOLD.**

## MANDATORY DIMENSION — Amendment 6 ①3 enumeration

**Executed read-only over all 2,904 lines of the map at this exact head, enumerating by directive FORM and by MEANING** — every `next action` / `frontier` / `first safe action` / `current target` / `what the fresh Larry owns` statement, every `🎯` and `📌` marker, every `⬜` open item, every `IN FLIGHT` / `NOT STARTED` / `OWED` status, and every top-level heading.

**Result: every statement capable of directing a fresh Larry's next action resolves to the SAME current target** — § ACTIVE SESSION WORK PACKAGE → **`🎯 THE ONE CURRENT NEXT ACTION`** at line 2731, *"execute the pre-merge repairs, then re-dispatch Gate 1 at a new frozen head"*. That literal phrase occurs **once** as a live directive; every other occurrence is a pointer to it (lines 19, 20, 2377, 2630, 2828, 2875) or an annotated record of a past repair (2646, 2785). Historical frontier material (§12, §14.19, §16, §16.8, §17, §17.9, §2139, the spent seven-step route, the discharged `/rotate` steps) is banner-marked non-directive **in the heading**, not merely beneath it, wherever a tool would resolve it.

**The one current next action is also TRUE at this head:** items ①–⑩ are all `DONE`/`EXECUTED`, ⑪ is `OWED` and reads *"Re-freeze, complete CI, re-dispatch Gate 1"* — which is precisely what produced this review.

**Verdict on this dimension: PASS.** **No Amendment 6 ② condition is met** — nothing points a fresh Larry toward closed or superseded work, nothing competes with the real current target, nothing misstates the live Phase or next action, and nothing makes continuation unsafe. **This is the first head in this Sub-phase at which that is true**, and it is why this verdict is HOLD rather than a fourth FAIL.

### On the hunt for a fifth statement of the struck-hook class — one survives, and it is NOT in the map

**Enumerated by meaning across the active documents, not only the map.** In the map itself: **clean.** All five occurrences (row 1 requirement, row 1 status, row 1 evidence, § OUT OF SCOPE, § Parked) are re-cut, and a sixth I checked — the struck `📌 NEXT WORK PACKAGE` block at line 2898 — is inside `~~ ~~` and carries *"⛔ Struck 2026-08-07. The hook line is void."* The evidence pack's post-merge alignment row for `Claude host hooks` is also already re-cut to *"VOID … NOT PART OF THE PHASE — the outcome was withdrawn, not deferred."*

**But one remains, in a document the re-cut did not reach:**

> `Deliverables/2026-08-06-amended-wp-recon-evidence.md:178`, under `## Explicitly not done this recon slice`:
> **`- Claude host hook install (next WP)`**

**It is the same class by meaning — a withdrawn outcome recorded as deferred future work — and it sits in the document the Work Package header names as its Evidence pack.** Its directive force is materially weaker than the four that carried the `443d0fa` FAIL: it is a dated *not-done* list about a past recon slice, it says *"(next WP)"* rather than *"in scope now"*, it authorises nothing and instructs nothing, and the map — the only document permitted to state the next action — now contradicts it in four places. **Recorded once, labelled non-blocking (E-2), parked to the scheduled reconciliation.**

**Larry's instinct was right and his grep was not sufficient — again, and this is the fourth time in this Sub-phase that a class was closed everywhere the searcher remembered looking.** The corrective that worked here was searching the *whole* `Deliverables/` surface for the meaning rather than the map for the wording.

## Evidence provenance

- Isolated export of `reviewed_sha` created with `git archive 19fc7924… | tar -x -C <workspace>` at `…/scratchpad/exp19fc792`, outside the repository, never committed.
- Repository `git rev-parse HEAD` at start / end — `19fc7924ed63a787a79ac33f7208132f440f1361` / `19fc7924ed63a787a79ac33f7208132f440f1361`, **identical**. `git status --porcelain` at start and end — **one identical line both times**, `?? Deliverables/2026-08-07-vex-cockpit-boundary-review-443d0fa.md`, the untracked Vex review the dispatch declared. **No tracked file changed; I wrote nothing into the repository except this receipt.**
- `git ls-remote origin build-020/phase4-automation-law` → `19fc7924…`. **Remotely reachable, and the remote tip IS this head.**
- Governance blob bound before reading anything: `git rev-parse 19fc792:"Team/Veritas …/AGENTS.md"` → `8c85fdbce3b8418d0f5640183d84ca5284ea1e1a`.
- **⚠️ ONE ISOLATION LIMIT, MEASURED AND DECLARED RATHER THAN ASSUMED.** `core.autocrlf` is `true` on this machine, so **`git archive` CRLF-converts text files** — the export is content-identical but **not byte-identical** to the committed blobs (`cmp` differs at char 4; 33,514 bytes in the export versus 33,334 in the blob for one file). **Every digest and byte-fidelity check in this receipt was therefore computed against `git show <sha>:<path>`, not against the export**, and the export was used only for content reading and mechanism execution. A digest computed naively inside the export would have been wrong, and I first computed one that was. *(This is the same CRLF/`sourceHash` trap the map records at line ~2698 — it is real, it is machine-wide, and any successor review that verifies a receipt digest from an archive export will get a false mismatch.)*
- No mutation testing at this head — the code is byte-identical to `443d0fa`, where every gate and its `--self-test` was executed inside the export. Per contract §Method 5, re-running it would be waste, not thoroughness.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git diff --name-status 443d0fa 19fc792` | 0 | 2 files | **Documentation only.** No code, no `services/**`, no `tools/**`, no `.claude/**`. The narrowing condition is verified, not accepted |
| `git log --oneline 443d0fa..19fc792` | 0 | 2 commits | `e5de335` + `19fc792` — **two, not the one the dispatch claims**; both documentation |
| `git show 19fc792 -- …proofline-wayfinder-plan.md` | 0 | 3 hunks | All four re-cuts present, read in full and checked against the four statements I named at `443d0fa` |
| `sha256` of `git show 19fc792:…443d0fa-receipt.md` body (`tail -n +24`) | 0 | n/a | **`72404be4…`** — **matches its own frontmatter. Committed verbatim; no tampering.** |
| `gh run list --commit 19fc7924…` | 0 | 5 distinct workflows | **All `completed / success`** — `control-plane-tests`, `secret-scan`, `build-002-tests`, `governor-tests`, `cockpit-private-apps`. Verified by me, not taken from the dispatch |
| `git ls-remote origin build-020/phase4-automation-law` | 0 | n/a | `19fc7924…` — head is pushed and is the remote tip |
| `Get-ScheduledTask MyPKA-YouTube-Watcher-Ensure` | 0 | 1 task | **`Disabled`** — re-verified at this head, correctly and on purpose |
| `cat .claude/settings.json` (export) | 0 | n/a | **`{"hooks": {}}`** — the Amendment 5 descope is the committed state; all six implementations remain tracked under `.claude/hooks/` as inert source; no `.claude/state/` in the tree |
| Map enumeration, 2,904 lines, by directive form and by meaning | 0 | ~90 candidate statements | **All resolve to the same current target.** One live `🎯 THE ONE CURRENT NEXT ACTION` |
| `Deliverables/` sweep for the struck-hook class by meaning | 0 | 6 hits outside committed receipts | 5 re-cut and correct; **1 survives** — evidence pack line 178 (E-2) |
| **NOT EXECUTED (declared, not smoothed over)** | — | — | The **installed-service restart** (forbidden pre-merge by Warwick's standing constraint, and elevation-gated) · the live `:8090` journey · a real unattended YouTube capture · anything requiring live credentials. **None of these is inferred anywhere below.** |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Row 1's accepted scope can now be read off the map without contradiction. The re-cut removed acceptance criteria Warwick had killed and stated plainly what replaced them, rather than quietly deleting the history — which is the harder and better version of the repair. |
| Design fidelity | **PASS** | Unchanged and re-bound: no code moved at this head. The repair was made where the defect was — in the accepted-scope record — and not routed around by softening the grading. |
| Functional proof | **PASS** | Cited from `443d0fa`, where I executed the branch-runtime HTTP path end to end. The engineering surface is byte-identical; re-execution would prove nothing new. |
| Integration | **PASS** | Same basis. No wiring changed. |
| Durability | **HOLD** | Three of five row-1 survival scenarios are EXECUTED and one more (`branch from main after #97 merges`) is explicitly deferred by Warwick's own split. **`installed-runtime restart` is the fifth, its service half is unexecuted, and it is named in NEITHER half of that split.** The map itself says the property is not asserted as met. **Deferred is not discharged, and an unknown on a named acceptance property is a HOLD.** |
| Test quality | **PASS** | Cited. The `--self-test` mutation cases proved at `443d0fa` are permanent in CI and CI is green at this head. |
| Git truth | **PASS** | Branch, head and scope reported exactly; head clean, pushed, and the remote tip; CI complete and green at this exact head; the prior receipt committed verbatim and digest-verified. The one inaccuracy — *"ONE commit"* — is in the dispatch, not the repository, and does not change the conclusion. |
| Documentation truth | **HOLD** | **The FAIL is discharged: the four statements that carried it are gone and no active statement misdirects.** It is not yet PASS, for three factual defects that survive at this head, all conservative in direction and all non-blocking: **(E-2)** the evidence pack still lists the withdrawn hook install as *"(next WP)"*; **(E-3)** three active statements record the assurance standing as *"Gate 1 remains HOLD at `f0d2614`"* including *"NO Veritas receipt exists for ANY of this work"* — flatly false at a head that contains one, and stale by three subsequent FAILs; and the previously parked `D-3`–`D-6` are unrepaired, as the dispatch correctly states. **None of these misdirects, over-claims, or makes continuation unsafe.** |
| Residual risk | **PASS** | Again the strongest dimension. Every limitation the dispatch carried is real, is named in the map before I arrived, and errs toward under-claiming — including the survival table's stale *"NOT EXECUTED"* under-claim, `db.mjs`'s module-scope pools, WO-30's resolution-not-existence limit, and the deliberately unregistered `idempotency-check`. **Larry carried the residuals unfiltered and volunteered the one that carries this HOLD.** |
| Completed automation | **PASS — Gate 1 evidence scope ONLY, by Warwick's explicit reclassification. NOT acceptance.** | Root `CLAUDE.md` § *"Nothing may live only in Larry's head"* permits two exits, and Warwick has taken the second **for this gate only**: Amendment 10 ① reclassifies the durable YouTube capture as **MANUAL for Gate 1 acceptance and evidence purposes ONLY**. **The outcome REMAINS AUTOMATIC as a product requirement.** Re-verified by execution at this head: `MyPKA-YouTube-Watcher-Ensure` is **`Disabled`**, so the real production event still does not invoke it and no unattended capture has produced the automatic briefing. **All seven of Warwick's post-merge conditions — including *"no manual invocation substitutes for that proof"* — remain owed and binding at route step 18.** **⛔ Warwick, verbatim, and it binds this receipt: «Do not describe Amendment 9 as permanently manual, accepted, or complete before that post-merge test passes.»** |

## Production caller and journey

**Row 1, installed runtime — the property that carries the HOLD, traced honestly.**

- **Machine-global governor half — ON the journey and PROVEN.** `~/.mypka/governor/*`, nine installed modules. Every invocation is already a fresh process, so a brand-new process reading installed continuity state and recovering the live `focus` **is** the property, not a proxy for it. Executed at `443d0fa`; the installed runtime is machine-global and did not change at this head.
- **Installed SERVICE half — NOT on the journey, and not claimed to be.** The live Cockpit and the elevation-gated supervisor `MyPKA-Local-Services-Live` were not restarted. **I cannot execute this, and Warwick's standing constraint forbids anyone doing it pre-merge.** Contract §Method 2a is explicit that such a property is never PASS on inference — it needs executed evidence from a capable actor, **or Warwick's explicit acceptance recorded in the receipt. Neither exists.**

**Row 4, live runtime — unchanged and owed.** The instance Warwick reaches on `:8090` serves from `C:\Fusion247PKA` at `c1ed028`. **The rotation-report surface is reachable by no user at this head.** Owed at step 18, not denied.

**Row 1, Amendment 9 journey.** `watch-captures.mjs` → `persistCapture` → git probe → COMPLETE/DEGRADED → `larry-ding`. Every hop exists; **the journey has still never been entered by a real production event**, and with the ensure task `Disabled` it cannot be.

## Restart and durability

- **Executed and standing:** worktree delete/recreate · fresh branch from current `main` (`4eb5368`) · machine-global resolution from a checkout carrying none of this branch's assets · installed governor state read by a brand-new process.
- **Not executed, explicitly deferred by Warwick's accepted split:** *branch from main after #97 merges*.
- **Not executed, and NOT covered by that split — this is E-1:** the **installed SERVICE half** of `installed-runtime restart`.
- **Kill-and-revive of the watcher cannot presently succeed** — the ensure task is `Disabled`, re-verified by execution, and disabling it was the correct safe action.

## Documentation contradiction scan

**Larry's declared DOCUMENT IMPACT:** the four re-cut statements in § ACTIVE SESSION WORK PACKAGE, plus the assertion that no fifth statement of the class remains.

**Verified independently of his list:** all four re-cuts are present, correct, and use Amendment 4's row-3 pattern as he described. **His account is accurate in every particular I checked.**

**What his list missed:** **one fifth statement of the class, in the Evidence pack, not the map** — `2026-08-06-amended-wp-recon-evidence.md:178`, *"- Claude host hook install (next WP)"* (E-2). And **three stale assurance-standing statements** (E-3) at map lines 2605, 2827 and 2895, of which *"NO Veritas receipt exists for ANY of this work"* is flatly false at a head whose own tree contains the `443d0fa` receipt.

**Active documents that would misdirect a fresh instance: none found.** Every directive statement resolves to one target, and that target is true.

**Closure claims since the last receipt, and the receipt behind each.** Enumerated across the map, the evidence pack, the migration plan and the rotation block. The execution log still opens *"Progress only; no completion claim, and no PASS"*. The `3e4c9d9`, `275ec07` and `443d0fa` FAILs are all real verdicts about real heads; the `443d0fa` receipt is committed verbatim and digest-verified. **No phase, Work Package, service or user journey is declared complete, closed, operational, durable, ready, accepted or production-safe anywhere in this package. No suppressed receipt was detected. No false completion claim was found.** The only direction of error in this package's documentation is **under**-claiming.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **E-1** | **medium** | **`installed-runtime restart` — the installed SERVICE half is unexecuted, and it is named in NEITHER half of Warwick's Amendment 10 ② pre/post-merge split.** That table assigns to post-merge exactly: Amendment 7 ⑥ and ⑨ · the live `:8090` journey · Amendment 9's capture · *"branch from main after #97 merges"*. Larry assigned this property to step 18 himself. The map's own ⑨ states *"the row-1 property is NOT asserted as met."* | **blocking for row 1 acceptance and Gate 1 PASS ONLY.** **It blocks no action on the active route**, because the current exact next action was *"re-dispatch Gate 1 at a new frozen head"* and that has now happened. It does **not** block Gate 2, the Amendment 8 Vex review, route step 18, the merge decision pack's preparation, or any other safe work. **It is not engineering work** — the cheapest honest way to clear it is one sentence from Warwick extending the split he has already made twice. | Larry to route; **Warwick decides** |
| **E-2** | low | **The fifth statement of the struck-hook class**, surviving in `Deliverables/2026-08-06-amended-wp-recon-evidence.md:178` — *"- Claude host hook install (next WP)"* under *"Explicitly not done this recon slice"*. Amendment 5 **withdrew** that outcome; *"next WP"* records it as **deferred**. Same class as `D-1`/`D-2` by meaning, materially weaker by force: a dated not-done list, in a non-route document, contradicted in four places by the map. | **non-blocking** — it authorises nothing, instructs nothing and competes with no directive statement. Park to the scheduled reconciliation. | Larry |
| **E-3** | low | **Three active statements record a stale assurance standing:** map `:2605` *"HOLD @ `f0d2614` … (rows 1/3/4 PASS …)"*, `:2827` **"NO Veritas receipt exists for ANY of this work.** Gate 1 remains HOLD at `f0d2614`", `:2895` *"Gate 1 remains HOLD at `f0d2614`"*. Three FAILs have been returned since, and the `443d0fa` receipt is committed in this very tree. | **non-blocking** — every one errs **conservative** (it claims less assurance than exists), none can produce a false completion claim, and none competes with the frontier. But *"NO Veritas receipt exists"* is a flatly false sentence in an active block and should not survive the reconciliation. | Larry |
| **D-3 · D-4 · D-5 · D-6** | low | Carried unchanged from `443d0fa` and correctly declared unrepaired in the dispatch: qualified `V9-1`/`V9-3`/`V9-4` labels · the `V9-1` vs `P-*` divergence · the survival table's stale *"NOT EXECUTED"* under-claim for `installed-runtime restart` · item ⑪ rendering outside its table, and §13/§14 banners beneath rather than inside their headings with §13's *"Nothing here has been started"* unstruck. | **non-blocking — and I re-checked each against the blocking test at this head rather than re-asserting the old label. None has become blocking.** *(`D-5` deserves one line: the survival table under-claims a property this receipt HOLDs on. It is still an under-claim, and under-claiming is not the failure mode this gate exists to catch.)* | Larry |
| **D-7 · D-8 · D-9** | low | `db.mjs` still opens two production `pg` pools at module scope (Keel-costed, ~10 lines, no interface change) · `/api/rotation-reports` returns its truthful failure with HTTP 200 and `ok:false` in the body · the `pg` bump inside the 4B range and `watch-captures.mjs:78` / `ensure-youtube-watcher.mjs:164` still invoking the legacy `C:/.fusion247/larry-ding.mjs`. | **non-blocking** — reported once, as before. **Not Work Orders, and I do not recommend any.** | **Warwick decides** |

**No finding here is a Work Order. A finding is an observation.** Larry owns dispatch and the queue; nothing in this receipt transfers either.

## What is NOT wrong, said explicitly

**The repair Larry was asked to make, he made — completely, in the right place, and in the harder form.** He did not delete the history that embarrassed the map; he struck it, restatused it, annotated why, and stated what replaced it. **All four statements that carried the `443d0fa` FAIL are closed, and this is the first head in Sub-phase 4B at which no statement in the active map can misdirect a fresh session.** That is a real and non-trivial outcome, and it is why this receipt is a HOLD and not a fourth FAIL.

**He also carried the residual that carries this HOLD, unfiltered, in his own dispatch** — *"installed-runtime restart service half unproven"* was the first line of his residual list. **A gated party who volunteers the fact that gates him is not selecting the evidence**, which is the specific integrity property this role exists to protect.

**The one thing between this head and a row 1 PASS is a scope decision, not a defect in the work.** `installed-runtime restart` is unreachable pre-merge by Warwick's own standing constraint — precisely the structural situation he adjudicated for Amendment 7 ⑥⑨ and for Amendment 9. He resolved those two by name. **This third one was never named, and nobody noticed, because Larry's reading of the split was reasonable and mine at `443d0fa` accepted it while holding the row for a different reason.** Naming it now is the difference between a Gate 1 PASS that means something and one that quietly rests on the gated party's own interpretation of an accepted boundary.

## Verdict

**HOLD** — carried by **E-1** alone. **Row 1 HOLD · Row 2 PASS (cited from `443d0fa`) · Row 4 PASS, pre-merge branch-runtime half only (cited from `443d0fa`).** The narrowing to row 1 was legitimate and I verified it myself; **rows 2 and 4 rest on the `443d0fa` receipt at an ancestor whose product slice is byte-identical to this head.** **The mandatory Amendment 6 ①3 enumeration dimension is PASS**, and no Amendment 6 ② condition is met at this head.

**This is an upgrade from FAIL, and the reason is precise:** at `443d0fa` the artefact was *demonstrably wrong*; at `19fc792` it is *genuinely pending*. That is the exact line the contract draws between the two verdicts.

**What this gates, precisely:** Gate 1 PASS · Codex eligibility · the merge decision pack · any completion, closure, acceptance or merge-readiness claim over row 1 · any overall closing PASS for Sub-phase 4B.

**What it does not gate:** Gate 2 · the Amendment 8 Vex review · route step 18 · preparation of the merge decision pack · any other safe implementation on the active route. **The frontier remains the Wayfinder's and does not transfer to me.**

**Stated once more because Amendment 10 ① binds this receipt:** the durable YouTube capture is **reclassified MANUAL for Gate 1 acceptance and evidence purposes ONLY**. It is **not** permanently manual, **not** accepted and **not** complete. Its automatic re-test at route step 18, against all seven of Warwick's conditions, is **owed and binding**.

**Ceiling.** One pass, ≤ ~120k tokens, as dispatched. **It did not bind.** The scope was one requirement, the code was byte-identical to a head I had already executed against, and the only property I could not reach is one I am forbidden to reach — named above rather than smoothed over.

## Next review trigger

**One of two events, and only one is needed:**

1. **Warwick extends the Amendment 10 ② pre/post-merge split to name the `installed-runtime restart` SERVICE half** as post-merge-binding at route step 18, exactly as he did for Amendment 7 ⑥⑨ and Amendment 9 — recorded in the map. A fresh Gate 1 dispatch at that head may then cite this receipt for everything else and ask only for row 1's confirmation; **or**
2. **the installed-service restart is executed** by an actor permitted to touch the live runtime, and its evidence is presented at a new exact head.

Either way: **rows 2 and 4's pre-merge half do not need re-proving unless code changes**, and this receipt may be cited for them. **CI must be complete and green at the resubmitted head.** **E-2 and E-3 do not require a further assurance cycle** — they are parked to the one scheduled documentation reconciliation.
