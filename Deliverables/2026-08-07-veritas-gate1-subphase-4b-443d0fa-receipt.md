---
build: BUILD-020
scope: subphase-4B-functional-rows-1-2-4
gate: 1
reviewed_sha: 443d0fa85e9e40a0483df776af037c9c8c0073b5
governance_sha: 443d0fa85e9e40a0483df776af037c9c8c0073b5
branch: build-020/phase4-automation-law
remote_reachable: true
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA-build-020-trial\e1a5349f-4c7d-4ce4-bb91-f2ea51224e07\scratchpad\export-443d0fa
worktree_head_at_start: 443d0fa85e9e40a0483df776af037c9c8c0073b5
worktree_head_at_end: 443d0fa85e9e40a0483df776af037c9c8c0073b5
worktree_status_clean: true
ci_at_reviewed_head: complete and green - all five workflows completed/success, verified independently
review_ceiling: one pass, <= ~250k tokens (dispatch-stated; not extended)
private_surface: C:\.fusion247\private\careerair\** (declared; NOT entered)
credential_scope: none
supersedes: Deliverables/2026-08-07-veritas-gate1-subphase-4b-275ec07-receipt.md (that FAIL stands as a true verdict about that head)
verdict: FAIL
receipt_sha256: 72404be41d3aab9be3a8562fae9889cf969d21e2e7012ebf2a3f816fd10ca79e
reviewed_by: veritas
reviewed_date: 2026-08-07
next_review_trigger: fresh Gate 1 dispatch at a new exact head per the final section
---

## Scope reviewed

**Gate 1 only**, at `443d0fa85e9e40a0483df776af037c9c8c0073b5`. The **functional** acceptance rows of § ACTIVE SESSION WORK PACKAGE in `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **rows 1, 2 and 4** — read from the map at the reviewed head, not from the dispatch summary, with Amendments 3, 5, 6, 7, 9, 10 and 11 as they fold into those rows.

**Row 3 not graded** — descoped by Amendment 4. **Rows 5–7 not graded as product requirements** — assurance/release sequence.

**Scope not narrowed.** No older product slice was substituted.

**Amendment 10 applied as written.** The pre-merge/post-merge runtime split is Warwick's decision and I do not re-litigate it. Amendment 10 ① binds this receipt: the durable YouTube capture is **reclassified MANUAL for Gate 1 evidence purposes only**. **It REMAINS AUTOMATIC as a product requirement.** It is **not** permanently manual, **not** accepted, **not** complete. Its automatic re-test against all seven of Warwick's conditions is **owed and binding at route step 18**.

**Not performed:** Gate 2 · the Amendment 8 Vex review · any Codex activity.

**Private surface.** `C:\.fusion247\private\careerair\**` was declared and **was not entered** — no path under `C:\.fusion247\**` was opened, listed, read or quoted, and no verdict below depends on one. `credential_scope: none` honoured: no credential file was read. Where the Cockpit needed credentials for my own execution I supplied a **synthetic** file in the session scratchpad pointing at `127.0.0.1:59999` — see Evidence provenance.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **1** | **BUILD-020 durability / promotion readiness.** Mechanisms correctly classified; **survives dead Larry session · worktree delete/recreate · fresh branch from current main · branch from main after #97 merges · installed-runtime restart**; replacement-machine DR not claimed; merge unit + post-merge install alignment listed. ⊕ Amendment 3 hook install/live proof (a)–(g). | **HOLD** | **⑨ governor half independently PROVEN by me at this head:** a brand-new `node ~/.mypka/governor/continuity.mjs read` process read the installed continuity state and recovered the live `focus`; nine installed modules present. **② survival scenarios corroborated:** all three repo-local gates run inside my own foreign export — `clone-portability-check` **22 assertions, 5/5 mutations caught** with the loud skip naming **my** export path, `provenance-check` **29**, `render-vm-check` **24 scenarios / 54 assertions**. `MyPKA-YouTube-Watcher-Ensure` verified **`Disabled`** by execution, correctly and on purpose. | **Blocking for this row — D-1.** Row 1's own acceptance cell still carries **Amendment 3's seven hook outcomes (a)–(g) as live requirements**, a status of **"hook half IN FLIGHT"**, and an instruction to **"reproduce rather than assume"** a return-cue defect it records as **falsifying outcomes (d) and (e)** — all of it **withdrawn by Amendment 5** ("DESCOPED AND DISABLED … **No further repair, extension or proving inside this Build**"). Read as written, row 1 cannot pass, and it directs a fresh session at descoped work. **I missed this at both prior gates; it is not new at this head.** Second residual: the **installed SERVICE half** of `installed-runtime restart` is unexecuted — I accept Larry's assignment of it to the post-merge half under Amendment 10 ②'s *"live-runtime acceptance remains binding post-merge at step 18"*, since restarting the live Cockpit or the elevation-gated supervisor **is** live runtime. Recorded as **owed**, not discharged. |
| **2** | **Gate 2 Phase 4 residuals dispositioned against current evidence.** Every old Gate 2 residual at `95f8826` returns **exactly one** of DISCHARGED · STILL OPEN · RECLASSIFIED · NOT PART OF THE PHASE. No old HOLD language copied forward. | **PASS** | **I enumerated the table by meaning, not by wording — every disposition cell checked against the four permitted values.** All **nine** `P-*` rows now resolve to exactly one: `P-JOB1`/`P-JOB2`/`P-LAW`/`P-ROTATE`/`green-populate` **DISCHARGED** · `P-CLOSE`/**`P-TOWER`** **STILL OPEN** · **`P-CUE`**/`combined cue→ding` **NOT PART OF THE PHASE**. The two re-cuts are confirmed by `git diff 275ec07 443d0fa` — exactly two lines changed, `P-CUE:47` and `P-TOWER:48`. **Larry's claim that no fourth non-conforming row remains is TRUE for that table**, and `P-TOWER` — which I did **not** name — was a real instance of the same class. The auditable coverage table (`V9-1..V9-4`, the source receipt's own labels, verified against `2026-08-06-veritas-gate2-phase4-receipt.md:147-150`) is complete at **4 of 4**, each with one primary label. | **Non-blocking only.** `V9-1` *"STILL OPEN — partially discharged"*, `V9-3` *"STILL OPEN — parked"* and `V9-4` *"DISCHARGED — as to the process gap only"* carry qualifiers of the shape `P-TOWER` was re-cut for; each errs **conservative** and misstates nothing, so it is clerical (D-3). `V9-1`'s basis still treats the combined cue→ding journey as an owed Phase-4 property while the `P-*` table now says it is not part of the phase (D-4). |
| **4** | **Live Cockpit production surface + truthful CareerAIR operational view**, ⊕ Amendment 7's nine executed criteria. Pre-merge half per Amendment 10 ②: ① ② ③ ④ ⑤ ⑦ ⑧. | **PASS — pre-merge branch-runtime half ONLY** | **D-3 from `275ec07` is CLOSED, and I closed it by my own execution, not by accepting Larry's.** I started the branch Cockpit from the clean worktree at this exact head on port **8399** against a **synthetic** credentials file (`127.0.0.1:59999`, synthetic CA), and over real HTTP: `GET /api/health` → **`{"status":"ok","build":{"version":"0.11.0","sha":"443d0fa",…},"sha":"443d0fa","dirty":false,"provenance":"clean","sourceHash":"ef9867dbe720a2f6"}`** — the WO-24 provenance fields served over HTTP, `dirty:false` and `provenance:"clean"` correctly reflecting the clean tree, and `sourceHash` **identical to the value `provenance-check.mjs` computes independently**; `GET /api/rotation-reports` → **HTTP 200 `{"ok":false,"error":"The rotation reports could not be read — nothing is listening there."}`**; `GET /api/no-such-route` → **404**; `GET /` → **200**; served `app.js` contains **`rrList` ×9**. ③④ executed via `render-vm-check` **24 scenarios / 54 assertions, 7/7 mutations caught**, 8 of them SYSTEM rotation-report scenarios. ⑤ ordering proven twice. ⑦ proven by construction and now also over the wire — no credential-shaped value appears in any served body. | **The live half is OWED, not delivered.** ⑥ ⑨ and the live `:8090` browser journey are **post-merge at route step 18** under Amendment 10 ②. **This PASS does not mean row 4 is delivered to Warwick** — the rotation-report surface is still reachable by no user, and any later document describing this as *"the Cockpit surface works"* is making a false completion claim. ① ② ⑧ rest on **Larry's executed live-Postgres run** (7 reports, 2,221,596 tokens, 88.3%, 26.2%, `elapsedMinutes: null` beside `firstDispatchSuccess: 0`), which I structurally cannot re-execute under `credential_scope: none`; accepted per contract §Method 2a as **executed evidence from an actor who can perform it**, and labelled as such rather than inferred. |

**No numbered functional row is omitted. Overall cannot be PASS while row 1 is HOLD.**

## Evidence provenance

- Isolated export of `reviewed_sha` created with `git archive 443d0fa… | tar -x -C <workspace>`, at `…/scratchpad/export-443d0fa`, outside the repository, never committed. All gate execution and all map enumeration ran **inside that export**.
- Repository `git rev-parse HEAD` at start / end — `443d0fa85e9e40a0483df776af037c9c8c0073b5` / `443d0fa85e9e40a0483df776af037c9c8c0073b5`, **identical**. `git status --porcelain` — **empty at start and empty at end** (0 lines both times, checked either side of the server run).
- `git branch -r --contains 443d0fa…` → `origin/build-020/phase4-automation-law`. **Remotely reachable.**
- Governance blob bound before reading anything: `git rev-parse 443d0fa…:"Team/Veritas …/AGENTS.md"` → `8c85fdbce3b8418d0f5640183d84ca5284ea1e1a`.
- **One declared deviation from export-only execution, and why it was required.** The HTTP probe could not run inside the export: WO-30 makes `db.mjs` resolve `pg` relative to its own clone, and the export has no `node_modules` — by design it now **fails loudly** there. I therefore ran `node services/cockpit/server.mjs` **from the repository worktree, which is clean at exactly `reviewed_sha`**, so no later or uncommitted file entered the evidence. **Zero production contact:** `COCKPIT_CREDS` pointed at a synthetic JSON in the scratchpad (`127.0.0.1:59999`, a port nothing listens on, synthetic CA), `COCKPIT_PORT=8399`, `COCKPIT_BIND=127.0.0.1`. **No credential file was read. No production database was contacted.** The live Cockpit on `:8090` answered `200` immediately before and immediately after; the test process was killed and `8399` verified with no LISTENING socket; the repository was byte-unchanged.
- `git diff --stat 275ec07 443d0fa -- . ':(exclude)Deliverables'` → **empty**. Nothing outside `Deliverables/` changed in this range, so the engineering surface is byte-identical to the head I reviewed at `275ec07`; I re-executed every gate anyway.
- The committed `275ec07` receipt was checked for tampering: recomputed body digest = **`8e7ab76fb77676b78d683bb1b0deb6ef58f9d1a63c5b9744611c02c069265b7b`**, **matching the value in its own frontmatter**. Committed verbatim.
- Mutation testing was run only inside the export, only through each gate's committed `--self-test`. No source file was mutated by hand and nothing was written into the repository.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node services/cockpit/server.mjs` (worktree, port 8399, synthetic creds) + `curl /api/health` | 0 | n/a | **200** — `sha 443d0fa`, `dirty false`, `provenance clean`, `sourceHash ef9867dbe720a2f6`. **The branch-runtime HTTP path is now executed, not inspected** |
| `curl http://127.0.0.1:8399/api/rotation-reports` | 0 | n/a | **200**, `{"ok":false,"error":"The rotation reports could not be read — nothing is listening there."}` — truthful failure, not an empty list |
| `curl http://127.0.0.1:8399/api/no-such-route` · `/` · `/app.js` | 0 | n/a | **404** · **200** · **`rrList` ×9** in the served bundle |
| `curl http://127.0.0.1:8090/api/health` before / after | 0 | n/a | **200 / 200** — live Cockpit untouched |
| `node render-vm-check.mjs` | 0 | **24 scenarios, 54 assertions** | PASS — 8 SYSTEM scenarios; no unknown rendered as a zero |
| `node render-vm-check.mjs --self-test` | 0 | **7 mutations + 2 controls** | PASS — 7/7 caught; unknown→0 mutation turns 3 of 54 RED with pre-existing detectors firing in **0** scenarios |
| `node clone-portability-check.mjs` | 0 | **22 assertions, 5 mutations** | PASS — all caught; loud skip naming **my export path** |
| `node rotation-report-check.mjs` | 0 | 117 | PASS — "NULL never became 0" |
| `node provenance-check.mjs` | 0 | 29 | PASS — `sourceHash ef9867dbe720a2f6`, matching the value served over HTTP |
| `node nav-check.mjs` · `node private-apps-check.mjs` | 0 | 41 · 245 (0 skipped) | PASS · PASS |
| `node ~/.mypka/governor/continuity.mjs read` (fresh process) | 0 | n/a | Installed continuity state read; live `focus` recovered. **⑨ governor half proven** |
| `Get-ScheduledTask` | 0 | 10 tasks | `MyPKA-YouTube-Watcher-Ensure` **`Disabled`**; nine others `Ready` |
| `gh run list --commit 443d0fa…` | 0 | 5 workflows | **All five `completed / success`** — `build-002-tests`, `cockpit-private-apps`, `control-plane-tests`, `governor-tests`, `secret-scan`. Verified by me, not taken from the dispatch |
| `git diff 275ec07 443d0fa -- …amended-wp-recon-evidence.md` | 0 | 1 hunk | Exactly the two rows claimed: `P-CUE` and `P-TOWER` |
| **UNVERIFIED (declared, not smoothed over)** | — | — | Larry's live-Postgres endpoint run, the live `cp_directus` grant, WO-28's 27→27 / 5→5 idempotency, and the fresh-session zero-false-injection observation. All need credentials or a live session I may not use. Named where relied upon; **inferred nowhere** |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | The repairs land on the right outcomes and the two properties I named at `275ec07` are genuinely closed. Row 1's accepted scope is still not reconciled with Warwick's own Amendment 5, so what row 1 promises cannot be read off the map without contradiction. |
| Design fidelity | **PASS** | Unchanged from `275ec07` and re-verified: WO-30's `createRequire` + `new URL` form is the smallest repair that does not hole `provenance.mjs`'s closure. The branch-runtime proof was obtained without importing the pool-opening module into a test and without touching live state — the constraint was respected, not routed around. |
| Functional proof | **PASS** | The production HTTP path is executed at this head, by me, end to end: wiring, provenance fields, truthful database-failure body, 404 discrimination, and the System-tab bundle actually served. The one thing it does not prove — real rotation data over HTTP — is stated as unproven by the map itself. |
| Integration | **PASS** | `server.mjs:24` → `rotation-report.mjs`, `:516` on the read pool, `:519` static health. No longer inspection: the hops answered over the wire. |
| Durability | **HOLD** | Worktree delete/recreate and fresh-branch-from-main are evidenced; the machine-global governor half of `installed-runtime restart` is now proven by execution. The installed **service** half is unexecuted and legitimately deferred to step 18 — deferred is not discharged, and the row-1 property is therefore not met at this head. |
| Test quality | **PASS** | Again the strongest work. `render-vm-check --self-test` proves the previous instrument was blind to the exact Unknown/zero collapse it existed to catch, and makes that proof permanent in CI. `clone-portability-check` skips **loudly with the missing path named** — I saw it name my own export rather than pass vacuously. |
| Git truth | **PASS** | Branch, head and scope reported exactly. Head clean, pushed, remotely reachable, CI complete and green at this exact head. The 3-file diff carries no code change and no unrelated surface. The prior receipt is committed verbatim and digest-verified. |
| Documentation truth | **FAIL** | **Amendment 6 ② class.** `D-1` and `D-2`: four active statements in § ACTIVE SESSION WORK PACKAGE still present the descoped Claude-hook install as in-scope, in-flight and repairable, inside the acceptance table of the row under review. This is the third consecutive gate at which this dimension fails, and each instance has been a different statement of the same class. |
| Residual risk | **PASS** | Every limitation I confirmed independently was already named in the map before I arrived — the unproven real-data read, the HTTP-200 truthful failure, the unproven service restart, `db.mjs`'s module-scope pools, WO-30 proving resolution but never that the Cockpit runs, the cross-checkout `sourceHash`, and the deliberately unregistered `idempotency-check`. Larry also disclosed his own two prior over-reports rather than repeating them. **On one of those: WO-30's "no evidence the Cockpit RUNS" is now partly discharged — I started it and it served HTTP.** |
| Completed automation | **PASS — Gate 1 evidence scope ONLY, by Warwick's explicit reclassification. NOT acceptance.** | Root `CLAUDE.md` § *"Nothing may live only in Larry's head"* permits two exits, and Warwick has taken the second **for this gate only**: Amendment 10 ① reclassifies the durable YouTube capture as **MANUAL for Gate 1 acceptance and evidence purposes only**. **The outcome REMAINS AUTOMATIC as a product requirement.** Verified again by execution: `MyPKA-YouTube-Watcher-Ensure` is `Disabled`, so the real production event still does not invoke it and no unattended capture has produced the automatic briefing. **All seven of Warwick's post-merge conditions — including "no manual invocation substitutes for that proof" — remain owed and binding at route step 18.** No document, including this one, may describe Amendment 9 as permanently manual, accepted or complete before that test passes. |

## Production caller and journey

**Row 4, branch runtime — now traced end to end and executed.** Browser-equivalent HTTP client → `server.mjs` listener → `/api/health` static handler built from `provenancePayload()` at startup → real response carrying `sha`/`dirty`/`provenance`/`sourceHash`; and → `/api/rotation-reports` → `rotationReportsResponse(q)` → `db.mjs` read pool → unreachable database → mapped human sentence in a `200 { ok:false }` body. **Every hop on the branch runtime is now executed rather than inspected.** What remains unexecuted is the same route against a **real** database, which needs credentials I may not read.

**Row 4, live runtime — unchanged and owed.** The instance Warwick reaches on `:8090` serves from `C:\Fusion247PKA` at `c1ed028`, 183 commits behind. **The rotation-report surface is reachable by no user at this head.** Under Amendment 10 ② that is owed at step 18, not denied.

**Row 1, Amendment 9 journey.** `watch-captures.mjs` → `persistCapture` → git probe → COMPLETE/DEGRADED → `larry-ding`. Every hop exists; **the journey has still never been entered by a real production event.**

**Row 1, installed runtime.** `~/.mypka/governor/*` — a genuinely fresh process reads installed continuity state and recovers `focus`. Every invocation of these modules is already a fresh process, so this is the property itself and not a proxy. The installed **services** (live Cockpit, `MyPKA-Local-Services-Live`) were not restarted and are not claimed.

## Restart and durability

- **Executed at this head:** worktree delete/recreate (corroborated in my own foreign export) · fresh branch from current `main` · machine-global resolution from a checkout carrying none of this branch's assets · **installed governor state read by a brand-new process**.
- **Not executed, correctly deferred by Warwick's split:** *branch from main after #97 merges* · **the installed SERVICE half of `installed-runtime restart`**.
- **Kill-and-revive of the watcher cannot presently succeed** — the ensure task is `Disabled`, verified by execution, and disabling it was the correct safe action.

## Documentation contradiction scan

**Mandatory Amendment 6 ①3 enumeration.** Executed read-only over all **2,904** lines of the map in the isolated export, **enumerating by directive form and by meaning** — every `next action` / `frontier` / `first safe action` statement, every `🎯`/`📌` marker, every `⬜` open item, every `NEXT` / `IN FLIGHT` / `NOT STARTED` / `owed` status, and every top-level heading — rather than by any remembered label. That is the specific miss the dispatch asked me to hunt, and **it produced a finding**.

**What Larry repaired, verified rather than accepted:**

- **D-1 from `275ec07` is genuinely closed.** The live action block now carries a state on **every** item ①–⑪, including the explicit **"⛔ DO NOT RAISE A WORK ORDER FOR THIS — IT IS MERGED"** on the `db.mjs` item that would have produced the duplicate. Confirmed in the diff.
- **D-2 (`P-CUE`) closed, and a third row I never named (`P-TOWER`) found and re-cut by Larry's own by-meaning enumeration.** Both confirmed in the diff. His method changed, and it worked.
- **D-5 (the sibling "accepted") closed** — the live-action-block row now reads *"all INTEGRATED. NONE ASSURED"*, and the count is corrected to **seven** Work Orders (WO-24…WO-30), which I verified is the right number.
- **The literal `🎯 THE ONE CURRENT NEXT ACTION` still resolves as a live directive exactly once**, at line 2731; entry rows 19 and 20 both point at it. Every other occurrence is a pointer or a record of a past repair.
- **Amendment 11 does not misdirect.** It says three times that it changes nothing about 4B, that 4C is *"NOT designed, scoped, planned or started"*, and that *"a fresh Larry reading this block must not treat 4C as actionable"*. §16's route line is updated consistently. **Clean.**

**🔴 WHAT LARRY'S LIST MISSED, AND WHAT I MISSED TWICE — the descoped Claude-hook install is still live scope inside row 1.**

Amendment 3 §3 folded the Claude hook installation and live proof **into row 1**. Amendment 5, the following day, **descoped and disabled** the whole reminder system: *"No further repair, extension or proving inside this Build."* **Row 1 was never re-cut against it.** Four active statements in § ACTIVE SESSION WORK PACKAGE still say the opposite:

1. **Row 1's requirement cell** — *"⊕ FOLDED IN BY AMENDMENT 3 — Claude hook installation and live proof (7 outcomes, Warwick's words): (a) install … (c) prove the real Claude background-specialist return-cue journey LIVE; (d) prove parent-only consumption …"* — unstruck, presented as live acceptance.
2. **Row 1's status cell** — *"**MOSTLY DONE** · hook half **IN FLIGHT**"*.
3. **Row 1's evidence cell** — *"🔴 REAL DEFECT PROVEN BY EXECUTION … (**permits repair under (g)**) … directly falsifies outcome (d) and (e). Marker was consumed and deleted before it could be captured; **reproduce rather than assume**."* An authorisation and an instruction, for work Amendment 5 forbids.
4. **§ Explicitly OUT OF SCOPE** and **§ Parked** both still record the hook install as **unparked and IN SCOPE inside row 1** (*"⊖ REMOVED by Amendment 3"*, *"⊖ UNPARKED by Amendment 3 — now inside row 1"*).

**This is not clerical.** Read as written, row 1 records two of its own seven acceptance outcomes as **falsified** and instructs a fresh session to reproduce the defect — sending it to re-open a mechanism Warwick descoped, which is exactly what Amendment 5 and the regrowth cap forbid. It is also the reason row 1 cannot be graded PASS on its own text. **Compare Amendment 4's treatment of row 3** — struck, restatused, annotated: that is the pattern this needed and did not get.

**I record my own share plainly:** this statement was present at `3e4c9d9` and at `275ec07` and I did not name it at either gate. It is the same class as the two misses I charged Larry with, made by me.

**Two further active-map statements, non-blocking, recorded once (D-5, D-6).** The § ROW 1 ② survival table still reads `installed-runtime restart | ⬜ NOT EXECUTED at this head. Not claimed.` while ⑨ sixty lines below records the governor half as proven — an **under**-claim, not an over-claim. And item **⑪** at line 2770 sits **outside** the table it belongs to, after the ⑨ bullet list, so it renders as loose text; it still carries `⬜ OWED`, which is true.

**On §13 and §14.** Both top-level Phase 2 headings now carry `⛔ HISTORICAL … Directs nothing` — but in a **blockquote beneath the heading**, which is the exact placement D-12 condemned for §16 and which Larry corrected there by moving the banner **into** the heading. §13's next line still reads *"The fresh session owns implementation. Nothing here has been started."*, unstruck and false. **Non-blocking** — nothing points at §13/§14 as a route and the banner is immediately adjacent — but it is the same pattern one repair short of consistent.

**On the Gate 3 contract gap.** Re-confirmed at this head: the loaded contract carries only the line-109 prohibition, no enumeration deliverable. **Third consecutive proof of it** — this enumeration found a real defect only because the dispatch asked for it. Non-blocking, **not mine to fix**, and Larry is right to withhold an unapproved edit to a canonical specialist contract. Owed to Warwick in the merge decision pack.

**Closure claims since the last receipt, and the receipt behind each.** Enumerated across the map, the evidence pack, the migration plan and the rotation block. The execution log still opens *"Progress only; no completion claim, and no PASS"*; the rotation block still states *"NO Veritas receipt exists for ANY of this work"*; the `3e4c9d9` and `275ec07` FAILs are both recorded truthfully with their digests. **No phase, Work Package, service or user journey is declared complete, closed, operational, durable, ready, accepted or production-safe without a receipt. No suppressed receipt was detected, and no false completion claim was found anywhere in this package.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1** | **high** | Row 1's acceptance cell, status cell and evidence cell in § ACTIVE SESSION WORK PACKAGE still carry Amendment 3's seven Claude-hook outcomes as live requirements, a status of *"hook half IN FLIGHT"*, and *"permits repair under (g) … reproduce rather than assume"* — all withdrawn by Amendment 5. Amendment 6 ② class. | **blocking.** **The exact next action it makes unsafe: any fresh session routed to § ACTIVE SESSION WORK PACKAGE and asked to complete or grade row 1 — it would reproduce and repair a defect in the return-cue system Amendment 5 descoped, disabled and forbade further proving of.** It gates a row-1 PASS and any overall closing PASS for Sub-phase 4B. It does **not** gate the correction itself, Gate 2, the Vex dispatch, route step 18, or any other safe work. | Larry |
| **D-2** | medium | § Explicitly OUT OF SCOPE and § Parked both still record the Claude host hook install as unparked and **IN SCOPE inside row 1** (*"⊖ REMOVED by Amendment 3"* / *"⊖ UNPARKED by Amendment 3"*). Same cause as D-1; listed separately because they are different lines and a repair to row 1 alone would miss them. | **blocking for row 1 acceptance only.** | Larry |
| **D-3** | low | `V9-1` *"STILL OPEN — partially discharged"*, `V9-3` *"STILL OPEN — parked"*, `V9-4` *"DISCHARGED — as to the process gap only"* carry qualifiers of the shape `P-TOWER` was re-cut for. Each errs conservative and misstates nothing. | **non-blocking** — clerical; park to the scheduled reconciliation. | Larry |
| **D-4** | low | Within `2026-08-06-amended-wp-recon-evidence.md`, `V9-1`'s basis still treats the combined return-cue → ding journey as an owed Phase-4 property, while the `P-*` table now dispositions that journey **NOT PART OF THE PHASE**. Two granularities disagreeing about one subject. | **non-blocking** — the disagreement is conservative and blocks nothing. | Larry |
| **D-5** | low | § ROW 1 ② survival table still says `installed-runtime restart | NOT EXECUTED at this head. Not claimed.` after ⑨ proved the governor half. An under-claim. | **non-blocking** | Larry |
| **D-6** | low | Map line 2770: item ⑪ sits outside its table and renders as loose text. State (`OWED`) is correct. Also §13/§14 banners sit beneath the heading rather than inside it, and §13's *"Nothing here has been started"* is unstruck and false. | **non-blocking** — table rendering and historical-marking placement; park. | Larry |
| **D-7** | medium | `services/cockpit/db.mjs` still opens **two production `pg` pools at module scope** (lines 32, 34). `BACKLOG` C-6 correctly narrowed, not closed. Keel has costed the change (~10 lines, no interface change). **Reported once for Warwick's decision — not a Work Order, and I do not recommend one.** *(Note: it did not block the branch-runtime proof — `COCKPIT_CREDS` made a synthetic target possible without touching production.)* | **non-blocking** | Warwick decides |
| **D-8** | low | `/api/rotation-reports` returns its truthful failure with **HTTP 200** and `ok:false` in the body. Confirmed by my own execution. The UI reads the body so the surface is truthful; a status-code-only monitor would read a failed read as success. Larry reported it once and did not fix it — correct handling. | **non-blocking** | Warwick decides |
| **D-9** | low | Carried unchanged and neither re-argued nor discharged: `services/control-plane/package.json` bumped `pg` `^8.11.0 → ^8.22.0` inside the 4B range while route step 7 is marked *"NOT ESTABLISHED … Not claimed"*; and `watch-captures.mjs:78` / `ensure-youtube-watcher.mjs:164` still invoke the legacy `C:/.fusion247/larry-ding.mjs` rather than the canonical installed `~/.mypka/governor/ding.mjs`. Repository source only; no credential file was read. | **non-blocking** | Warwick decides |

**No finding here is a Work Order.** A finding is an observation. Larry owns dispatch and the queue; nothing in this receipt transfers either.

## What is NOT wrong, said explicitly

**Every engineering repair claimed in the dispatch is real, and both properties I named at `275ec07` are genuinely closed — one of them by my own execution, which is the strongest form.** The branch-runtime HTTP path was obtained with **zero production contact**, and Larry's account of how (static handler, non-connecting `Pool` construction, synthetic credentials, live instance untouched) is accurate in every particular I could check. The `P-TOWER` row he found by changing his method from wording to meaning is a real instance I had missed. His disclosure that he had over-claimed twice, and his refusal to claim the service-restart half, are both borne out. **Rows 2 and 4's pre-merge half are the first two rows in this Sub-phase to reach PASS, and they did so on evidence, not on softening.**

**The defect that carries this verdict is not a new mistake — it is an old statement nobody enumerated, including me, twice.** That is worth saying plainly, because the corrective is the one Larry already discovered for the disposition table: **enumerate the class by meaning, then apply it to every table, not only the one the last receipt named.**

## Verdict

**FAIL** — carried by **D-1 (with D-2)** under Amendment 6 ②, which makes an active-map statement pointing a fresh Larry at descoped work a FAIL rather than a HOLD. **Row 1 HOLD · Row 2 PASS · Row 4 PASS (pre-merge branch-runtime half only).** No false completion claim was found anywhere in this package, and the engineering is in materially better condition than at either previous head.

**What this gates, precisely:** Gate 1 PASS · Codex eligibility · the merge decision pack · any completion, closure, acceptance or merge-readiness claim over row 1 · any overall closing PASS for Sub-phase 4B.

**What it does not gate:** the repair of D-1 and D-2 · the Gate 2 dispatch · the Amendment 8 Vex review · route step 18 · any other safe implementation on the active route. **The frontier remains the Wayfinder's and does not transfer to me.**

**Stated once more because Amendment 10 ① binds this receipt:** the durable YouTube capture is **reclassified MANUAL for Gate 1 evidence** only. It is **not** permanently manual, **not** accepted and **not** complete. Its automatic re-test at route step 18, against all seven of Warwick's conditions, is owed and binding.

**Ceiling.** One pass, ≤ ~250k tokens, as dispatched. **The ceiling did not bind.** The only properties I could not reach are ones I am forbidden to reach (live credentials) or that do not exist yet (the live surface), and each is named above rather than smoothed over.

## Next review trigger

A fresh Gate 1 dispatch at a new exact head at which **D-1** and **D-2** are repaired — row 1's requirement, status and evidence cells reconciled against Amendment 5 in the way Amendment 4 reconciled row 3, and the two scope lines re-cut so nothing in § ACTIVE SESSION WORK PACKAGE still records the descoped hook install as in scope — with CI complete and green at that head. **Rows 2 and 4's pre-merge half do not need re-proving unless the code changes**; a re-dispatch may cite this receipt for them and ask only for row 1.
