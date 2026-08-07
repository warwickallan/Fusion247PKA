# Session performance report — Sub-phase 4B

**Written by Pax.** The session is not its own sole witness.

| | |
|---|---|
| **Session date** | 2026-08-07 |
| **Branch** | `build-020/phase4-automation-law` |
| **Worktree** | `C:\Fusion247PKA-build-020-trial` |
| **Governance head / closing head** | `7ba504aaec6ea61f06f8b2dea241db1fc3bf2d96` (`7ba504a`) |
| **Session start head** | `b0a1c99` — 40-char form **UNESTABLISHED**, not supplied |
| **Range** | `b0a1c99..7ba504a`, 34 commits |
| **Active map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` |
| **Payload** | `Deliverables/2026-08-07-session-report-payload-subphase-4b.json` |
| **Prior report in series** | `Deliverables/2026-08-07-session-performance-report-subphase-4a.md` (head `ccb4132`) |

**Method and its limit.** Pax had **no Bash**: no git, no process table, no CI API, no `gh`. Every measured figure below was supplied by Larry. What Pax *did* do is verify those claims against the committed record with `Read` and `Grep` — the Work Order files, the Wayfinder execution log, the workflow YAML, the source modules, the migration plan, and the ding transport log read at source. **Nothing here is estimated.** Where a figure was not supplied and could not be verified, it is marked **UNESTABLISHED** and left null.

**Same-estate review — not independently verified.** Pax is a specialist of the team whose session is reported, dispatched by its subject. This is structurally weaker than external review. The mitigation applied throughout: every unflattering claim is tied to a committed artefact rather than to reviewer judgement, and three of the sharpest findings run *against* the brief supplied.

---

## Executive summary

This was a **build** session, and it worked. Five Work Orders issued, five accepted, five integrated, after a three-order refusal streak. 2,093,268 measured subagent tokens produced 3,613 product insertions — against the prior session's 2,221,596 tokens for 214. **Eighteen times the product output per token.**

But the headline "5 of 5 accepted" is the wrong metric, and the right one is worse: **0 of 5 orders survived read-back without a binding amendment**, and a worker found a serious defect in **every single order**. What changed between the sessions was not Larry's order *correctness*; it was that the structural class of defect that causes a **REFUSE** was closed by routing every order through `tools/wo/envelope.mjs`. The substantive class — *does this order's premise hold in the real target context?* — is unchanged, and is being caught entirely by worker judgement at a cost of ~124k tokens per order.

The most expensive lesson of the session and the sharpest single defect are the same thing: **an elevation step was sequenced ahead of the migration that makes it safe**, handing Warwick a Scheduled Task pointing at a clone 183 commits behind, which killed and restarted the YouTube watcher every five minutes. Larry had personally written the warning about that exact trap into Keel's order hours earlier.

---

## 1. What was measured

### 1.1 Commit volume — reconciles exactly

| Metric | Value |
|---|---|
| Commits | 34 |
| Files changed | 30 |
| Insertions / deletions | **+5,354 / −109** |
| Doc | +1,741 / −2 |
| Product | +3,613 / −107 |
| **Doc share of insertions** | **32.5 %** |
| Files by area | Deliverables 8 · services 14 · `.github` 2 · tools 4 · other 2 |

Both splits reconcile to the totals to the line (1,741 + 3,613 = 5,354; 2 + 107 = 109; 8 + 14 + 2 + 4 + 2 = 30). **The 4A payload's finding F12 — a staged product-file list that did not reconcile with its own totals — did not recur.** That is a small, real improvement in the measurement discipline.

The doc-vs-product **file** split is not supplied, only the line split. Which of the "other 2" files is doc and which product is **UNESTABLISHED**.

### 1.2 Subagent tokens — 13 return events, 8 spawns

| Agent | Pass | Tokens |
|---|---|---|
| Explore | cockpit recon | 154,587 |
| Keel | WO-24 read-back | 113,215 |
| Keel | WO-24 build | 180,523 |
| Keel | WO-25 read-back | 137,468 |
| Keel | WO-25 build | 212,631 |
| Felix | WO-26 read-back | 126,019 |
| Felix | WO-26 build | 219,916 |
| Vera | visual gate | 131,654 |
| Felix | a11y fix pass | 175,211 |
| Keel | WO-27 read-back | 126,809 |
| Keel | WO-27 build | 216,652 |
| Keel | WO-28 read-back | 116,126 |
| Keel | WO-28 build | 182,457 |
| | **TOTAL** | **2,093,268** |

Grouped, and it reconciles to the total exactly:

| Category | Tokens | Share |
|---|---|---|
| Build passes | 1,012,179 | 48.4 % |
| **Read-back gate** | **619,637** | **29.6 %** |
| Reconnaissance | 154,587 | 7.4 % |
| Visual/a11y assurance (Vera) | 131,654 | 6.3 % |
| Repair after a failed gate (Felix) | 175,211 | 8.4 % |

**Zero tokens were burned on refused orders this session** (4A: 197,193). The read-back gate is where that cost moved, and it now buys delivered work instead of a dead end.

### 1.3 What is not established

Opening context tokens · closing context tokens · total context movement · exact elapsed minutes · parent-channel latency · host version · CI status at `7ba504a` · PR #97 status at the closing head · full 40-char start-head SHA · the doc/product **file** split. Parent context at rotation was **~543k, Warwick-reported** — a single unverified source, recorded as such. Elapsed ran **roughly 00:40 to 11:10 local, approximate by Larry's own statement**, and is not treated as a measurement anywhere below.

---

## 2. The five questions, answered

### Q1 — Five acceptances after three refusals. Real improvement, or a softer bar?

**Neither, exactly. It is a real improvement that is precisely one layer deep, and the worker bar did not move.**

Test the "softer bar" hypothesis first, because it is the one that would invalidate everything else. Evidence against it, all from the committed record:

- Keel still **refused to write a one-line check script** on his own authority when WO-28's `file_surface` gave him no file to write it in (Amendment A1: *"He was right to refuse to write it on his own authority; critical rule 1 is exactly for the 'one line would fix it' case"*). A worker with a relaxed bar does not refuse to add one line.
- Defects were still proven **by execution rather than inference** — Keel copied the modules and ran the real `moduleClosure()` rather than reasoning about the import (map §"Two findings", item 1).
- Four of five returns were **CLARIFY**, not clean ACCEPT.

**Confidence: High.** The bar held.

So what changed? The **refusal** classes in WO-22/23/24-v1 were structural: no `file_surface`, forbidden write surfaces, hand-authored without the `GENERATED by tools/wo/envelope.mjs` marker, unexecutable acceptance tests. Those make an order *un-executable*, and they were closed by a route change — WO-24 regenerated through `envelope.mjs` (Wayfinder execution log, step 4: **DONE**, *"the first Keel order in four to survive read-back, and the difference was the order, not the worker"*). Larry's own record already says it: the difference was the order.

But **CLARIFY is about order *correctness*, and that rate did not improve at all**:

| Order | Verdict | Defect the worker found in Larry's order |
|---|---|---|
| WO-24 | CLARIFY → ACCEPT | AC7 built on a **false premise** — porting `server.mjs` from the live clone would have **regressed** the branch, which already held a superset. `document_impact` was `[]` and wrong. |
| WO-25 | CLARIFY → ACCEPT | Importing `rotation-report.mjs` into `server.mjs` **holes Larry's own one-day-old control** — the module closure diverges from `SOURCE_MODULES` and `sourceHash` silently stops covering a loaded module. |
| WO-26 | ACCEPT (6 unsettled) | The gate Larry cited **cannot see the System area** — every existing `render-vm-check` scenario pins `area:'apps'`. AC8 would have gone green proving nothing, **and that green would have reached Veritas as render proof.** |
| WO-27 | CLARIFY → ACCEPT | The order's **YAML frontmatter was empty** (`---` immediately followed by `---`); every envelope field was body text. |
| WO-28 | CLARIFY → ACCEPT | `ADD CONSTRAINT` would have **aborted every subsequent `/rotate`** (no `IF NOT EXISTS` in Postgres; `populate.mjs` applies `schema.sql` every run under `ON_ERROR_STOP=1`). Plus: the order **forbade the only real proof**, and stale-row removal without an absent-vs-empty guard was a **data-loss route**. |

**The pattern says this: Larry fixed the layer that had a tool, and the layer that has no tool is unchanged.** The read-back gate is absorbing a 100 % substantive defect rate. That is the gate doing its job — and it is also the gate being used as a *substitute* for order preflight rather than as the last line behind it.

Two of those defects (WO-25 and WO-26) are worse than ordinary bugs: each would have produced **a green signal that proved nothing**, and one of those greens was on a path to Veritas as evidence.

### Q2 — The 88.3 % → 32.5 % documentation inversion. Real, or an artefact of counting?

**The inversion is real. "Product" is not what the word implies.**

Real, first: product insertions went from **+214 to +3,613** — a seventeen-fold absolute increase, not a share illusion. Documentation did not shrink much (1,620 → 1,741 insertions); product grew underneath it. The two sessions were *for* different things — 4A was assurance and closure, 4B was build — so the inversion is mostly a description of scope, not of virtue.

But the composition of that +3,613 matters. Counting the four verification scripts this session created (all confirmed as this-session artefacts from the Work Order records and the Wayfinder execution log):

| Verification script | Lines |
|---|---|
| `services/hub/youtube/capture-durability-check.mjs` | 462 |
| `tools/session-report/idempotency-check.mjs` | 431 |
| `services/cockpit/rotation-report-check.mjs` | 400 |
| `services/cockpit/provenance-check.mjs` | 195 |
| **Total** | **1,488** |

Against functional modules created in the same range — `rotation-report.mjs` 278, `ensure-youtube-watcher.mjs` 284 (grown from 23), `provenance.mjs` 181, `grants.sql` 47 — roughly 790 lines.

**So of 5,354 insertions: ~32.5 % documentation, at least ~27.8 % verification harness, and at most ~39.7 % code that does the thing.** The verification figure is a **lower bound** — it counts whole current file sizes for files believed created in-range, and Pax cannot diff without git.

This is not a criticism. Roughly two lines of proof per line of function is what this estate's rules demand. But **"we shifted from documentation to product" overstates it**: the honest sentence is *"we shifted from documentation to a roughly even split of function and the proof of function."*

**Confidence: Medium-High** — the direction is certain, the exact split is bounded rather than measured.

### Q3 — Modules that do work at import. Coincidence, or an estate property?

**Neither. It is a small, identifiable, *unclosed* residual class — and its highest-consequence member is still open.**

Established by execution against the tree:

- The guard **is** the estate idiom. `import.meta.url` / `require.main` entry guards appear **192 times across 170 files** under `services/`. The overwhelming majority of this estate's modules are import-safe.
- `services/hub/youtube/watch-captures.mjs` **was fixed this session**, and the fix carries its own history in a comment at line 371: *"CLI guard — importing this module must have NO side effect. Before WO-27 `main()` ran at the top level, so a mere import opened production Postgres and ran a full pass."* One incident, closed, with the reason recorded.
- **`services/cockpit/db.mjs` is still unguarded.** Lines 16 and 18 construct two `pg.Pool`s against production Postgres at module scope. Twenty-two lines, no guard, no lazy accessor.

So the three occurrences are not a coincidence and not a general property — **two of the three are the same still-open file.** And `db.mjs` is not merely a latent hazard: it has now **shaped design decisions in two consecutive Work Orders**. WO-24's `/api/health` could not be tested by starting the server. WO-25's architecture was *forced*, in Larry's own words: *"`server.mjs` imports `db.mjs`, which opens two production `pg` pools at module load, so any test that imports the server touches live Postgres — the identical hazard that shaped WO-24."* Both new CI gates carry comments explaining that they exist partly to prove `db.mjs` was never loaded.

**This is one file, 22 lines, dictating architecture across a phase.** It is an observation, not a Work Order — per the finding-disposition rule it is reported once for Warwick's decision.

**Confidence: High.** Directly executed against the source.

### Q4 — Larry's defect signature. Is "asserting a runner/environment capability without executing a check" right?

**Right in direction. Too narrow at the top, and it misses a second signature entirely.**

Testing the hypothesis against all nine recorded errors:

**Fits, but the class is wider than "runner/environment" (5 of 9):**

1. Registered `provenance-check.mjs` in CI without checking the runner's Node — `registerHooks` needs 22.15+, runner pinned to 20. **CI went red.**
2. Nearly registered `capture-durability-check` on ubuntu with a PowerShell/`Win32_Process` dependency. *Caught.*
3. Nearly asserted "a Postgres toolchain is known present" for `idempotency-check` having never established it. *Caught.*
4. **WO-24's false premise** — asserted the live clone held code the branch needed, when the branch already held a superset. *Caught by Keel.*
5. **The Scheduled Task on a stale clone** — asserted the target checkout carried the code the task assumes. *Not caught until it fired.*

Items 4 and 5 are not "runner capability". They are assertions about a **checkout**. The unifying element is not the environment; it is that **the code was reasoned about and the context it executes in was not**. Larry's own migration plan states the corrected form better than the hypothesis does: *"The Work Order reasoned about the code; the task points at a checkout."*

**The accurate signature: asserting a property of a TARGET CONTEXT that was never executed against.** Runner, checkout, cluster, database — all the same defect wearing different clothes.

And this is the same root defect as the previous session's, not a new one. 4A finding F6 named it *"a claim verified against a convenient proxy rather than against the destination."* **This session's signature is the execution-context special case of that.** The signature did not change; only the surface did. That continuity is the finding.

**A second, genuinely distinct signature the hypothesis misses (2 of 9):** Larry hand-assembles dispatch artefacts by concatenation, and the assembly silently produces a malformed artefact.

- WO-27's frontmatter block was empty because a generator head fragment was concatenated onto a body carrying its own `---`. **`--count-markers` returned `ready: true` anyway.**
- A dispatch prompt shipped containing a literal `$(cat)` placeholder instead of the order body.

The second one is worse than it looks. **The readiness check gave a false green on a structurally void order** — the exact class of defect the estate keeps writing rules about, occurring in the tool built to prevent it. `ready: true` on an order whose every envelope field was body text is a control measuring the wrong thing.

**Two residual errors fit neither class:** re-running `populate.mjs` and duplicating all five specialist rows (assuming one's own writer was idempotent without testing it — arguably the target-context class turned inward), and relaying a Supabase RLS advisory to Warwick before measuring it. On the second, Larry's own record is the correction and it is well written: *"a scanner advisory is a claim about a default configuration, not a measurement of this database. I passed it on before measuring it."* A grant query disproved it — `anon` holds no schema `USAGE` at all.

**Verdict on the hypothesis: substantially correct, and worth broadening. 5 of 9 fit the corrected class, with 3 caught and 2 landing. The self-diagnosis is honest and close; it just stops one abstraction short and leaves a second signature unnamed.**

### Q5 — Is the read-back gate earning its cost?

**Decisively yes, and it is not close. The dependence on it is the finding, not the cost.**

Cost: **619,637 tokens, 29.6 % of all subagent spend, ~123,927 per order.**

Bought, per order, at least one defect that would have caused material harm:

- **WO-28** alone prevented two catastrophic classes in one order: a schema statement that would have **aborted every subsequent `/rotate`**, and a stale-row deletion that without an absent-vs-empty guard was a **data-loss route** — converting a repair into a worse defect than the one it fixed.
- **WO-25** prevented a control being holed one day after it was built, and `sourceHash` silently ceasing to cover a loaded module.
- **WO-26** prevented a vacuous green reaching Veritas as render evidence.
- **WO-24** prevented a regression of the branch.
- **WO-27** prevented an order whose every field was body text from being worked as if valid.

The comparison that settles it: in 4A, **581,403 tokens (26.2 %) were spent *downstream* of preventable Larry defects** — repairing, re-reviewing, re-running. This session spent a comparable sum **upstream**, preventing rather than repairing, and delivered five integrated Work Orders instead of zero. **Same order of cost, opposite direction of travel.**

The uncomfortable part: a gate catching 5 of 5 is not a healthy gate, it is a **load-bearing** one. A last line of defence that fires every single time is functioning as the *first* line. If Larry's order preflight were doing any work at all, the gate's yield would be falling. It is not.

---

## 3. Notifications — read at source

Read directly from `C:/Users/Buggly/.mypka/governor/ding-log.jsonl`:

| id | timestamp (UTC) | outcome | exit | bytes |
|---|---|---|---|---|
| 355 | 2026-08-07T00:41:53.433Z | sent | 0 | 2,446 |
| 356 | 01:02:19.236Z | sent | 0 | 1,499 |
| 357 | 01:21:35.183Z | sent | 0 | 1,172 |
| 360 | 08:19:58.337Z | sent | 0 | 2,279 |
| 361 | 08:27:42.120Z | sent | 0 | 1,910 |
| 362 | 09:06:26.092Z | sent | 0 | 2,212 |
| 363 | 09:39:24.497Z | sent | 0 | 1,417 |

**Transport 7/7, exit 0, zero queued, zero usage errors.** Proven again.

**Three corrections to the brief, all from the log itself:**

1. **The brief lists 6 sends; the log shows 7.** Message **355 at 00:41:53Z falls inside the stated session window** (~00:40 local start) and the 4A report's window closed at 354. Excluding it would leave 355 covered by no report at all — **the exact audit gap 4A recorded as finding F13 for message 348.** This is the second consecutive boundary orphan. **The report-window convention itself produces one at every rotation.** This report claims 355 and closes the gap.
2. **Ids 358 and 359 do not appear in the log.** Telegram assigns `message_id` chat-wide, so the most likely explanation is two messages from another sender in that chat. There is **no evidence of a failed send** — every logged send has exit 0. Cause: **UNESTABLISHED.**
3. **Payload deflated, not inflated.** Mean 1,847.9 bytes across the seven, versus 4A's 2,513.8 — **down 26.5 %**. 4A's finding F8 flagged a 3.07× inflation; the direction has corrected.

**Owed-and-missed:** there is a **~7-hour silence between 357 (01:21Z) and 360 (08:19Z)**. That window contains the WO-25 and WO-26 integrations, Vera's NOT PASS on two HIGH findings, the a11y repair, and the CI going red. Judged against Rule 4a's written criteria: none of those required a Warwick decision, and all were self-corrected inside the same stretch. **The closest call is the CI red**, which the rule's phrase *"a significant failure"* arguably names. Against that, the window is overnight and a buzz Warwick cannot act on is exactly what *"never for routine progress narration"* protects.

**Verdict: no send in that window was clearly owed. Medium confidence, and it is Warwick's to rule.** The events that were unambiguously owed — the DELETE permission, the elevation bundle, the watcher incident — all fall inside the 08:19–09:39 cluster of four sends. **4A's F7 (three gate verdicts returned after the log terminated) did not recur in that form.**

**No instrument can rule on content.** The log records bytes and timestamps only. Whether any of the seven was routine narration is **UNESTABLISHED**, and only Warwick reading 355–363 can answer it.

---

## 4. Errors, breaches and the one that cost the most

### 4.1 The most expensive: sequencing an elevation ahead of its precondition

Verified verbatim in two independent committed documents — the migration plan §6(b) and the Wayfinder execution log.

`MyPKA-YouTube-Watcher-Ensure` was installed pointing at `C:\Fusion247PKA`, a clone **183 commits behind** still holding the **old 23-line unconditional-kill** `ensure-youtube-watcher.mjs`. The fix giving it true ensure semantics was integrated on `build-020` and unmerged. The task **killed and restarted the watcher every five minutes** — proven empirically, **PID 33024 → 28240 inside one cycle**, no state file written. A TubeAIR extraction is capped at 180 s and a note generation can exceed the five-minute cycle, so a long transcript could have been killed mid-flight indefinitely.

**Larry had personally written the warning about this exact trap into Keel's WO-27 order hours earlier.** Now binding as §3 precondition 5 of the migration plan. The task is `Disabled`, deliberately not unregistered; watcher alive at PID 28240.

Two things are worth saying plainly. **The failure is real and it is Larry's**, and he records it that way without softening. **And the detection was Warwick's** — his verification instruction (*"the ProcessId must be unchanged across two ticks"*) caught it inside one cycle. The check design was sound; the sequencing was not.

### 4.2 Two worker boundary breaches — self-reported, verified nil-impact, **and recorded nowhere in Git**

- **Felix ran `git stash`/`pop`** under a no-git order, popping a pre-existing repo stash and leaving conflict markers in two control-plane files. Verified: all 3 stashes intact, files byte-identical to committed blobs, nothing lost.
- **Keel imported `watch-captures.mjs` during preflight**; its top-level `main()` read the gateway env, connected to production Postgres and ran a scan pass. Breached `private_surface`, `network` and `live_authority` simultaneously. Verified: 0 rows created, 0 notifications, no secret content in any artefact.

**Both were correctly self-reported and correctly verified rather than trusted. Neither appears in the active Wayfinder, in any Deliverables document dated 2026-08-04 to 2026-08-07, or in any session log** — there are no session logs at all for 2026-08-07 despite eight spawns. *(Scope of that negative: Deliverables and `Team Knowledge/session-logs/2026/08` searched; specialist journals and Builds not searched.)*

Under *"Nothing may live only in Larry's head"*, two live-surface boundary breaches that exist only in a session about to be cleared are exactly the class the clause exists for. **This report is now their durable record — which is an argument for the report, not a substitute for the map carrying them.**

### 4.3 Learning inside the session — credit where it is due

`.github/workflows/build-002-tests.yml` deliberately leaves `idempotency-check.mjs` **unregistered**, and the comment cites the Node-20 failure **from earlier the same day** as its precedent: *"Registering it on an unverified runner is how a gate dies at import and teaches everyone to ignore a red — which already happened once in this estate today."* It then forbids the tempting repair: *"DO NOT 'FIX' IT BY SKIPPING WHEN `initdb` IS ABSENT. A check that quietly executes zero cases…"*

That is a defect converted into a durable, in-place constraint within hours, at the exact site where it would recur. It is the best process artefact of the session.

---

## 5. Work Orders — the honest scoreboard

| Order | Worker | Verdict | Amendment | Integrated |
|---|---|---|---|---|
| WO-24 cockpit provenance | Keel | CLARIFY → ACCEPT | 1 | `2829d43` |
| WO-25 rotation-report API | Keel | CLARIFY → ACCEPT | 1 | `77dbca2` |
| WO-26 System tab UI | Felix | ACCEPT, 6 unsettled | 1 | `67b0af8`, a11y repair `63380d1` after Vera **NOT PASS** on 2 HIGH |
| WO-27 YouTube durability | Keel | CLARIFY → ACCEPT | 1 | `5203cee` |
| WO-28 writer idempotency | Keel | CLARIFY → ACCEPT | 1 | `0af12e2` |

- **Accepted rather than refused: 5 of 5.**
- **Survived first dispatch with no amendment required: 0 of 5.**
- **Refusals: 0** (prior three consecutive Keel orders: all refused).
- **Amendments: 5.**

Both numbers are true and they measure different things. **Reporting only the first would be the mediocre version of this report.**

A note on engagement authority: the map records at two places that *"Felix, Vex and Vera are NOT engaged unless a specific acceptance failure demonstrates one is necessary"* (Warwick, 2026-08-04). Felix's engagement is covered — WO-26 sits under Warwick's Amendment 7. **Whether Vera's visual gate was separately authorised or taken as an ordinary technical choice is UNESTABLISHED from the record.** It produced two HIGH findings and a real repair, so it earned its 131,654 tokens; the authority trail is what is missing, not the value.

---

## 6. Open, blocked, and not to be misread

1. **No Veritas receipt covers `7ba504a`.** Gate 1 and Gate 2 both remain **HOLD** at `f0d2614`. The Sub-phase 4A PASS is bound to `c50d8cb` and confers nothing here. **No Codex eligibility. No merge readiness.**
2. **CI status at `7ba504a` is UNESTABLISHED** — no evidence supplied and Pax has no runner access. 4A's blocker B3 warned precisely against carrying a CI-green impression into the next session. **Do not carry one out of this one.**
3. **`db.mjs` still opens two production pools at module load.** Unguarded, and it has now shaped two consecutive Work Orders.
4. **WO-27's durable capture is CAPABILITY ONLY.** The map says so: *"Not durable, not automatic. Acceptance is the next real capture, unattended."* Under *"Nothing may live only in Larry's head"* it **stays on the frontier**. 98 assertions and a mutation test prove capability, not automation.
5. **`MyPKA-YouTube-Watcher-Ensure` is `Disabled` on purpose.** Re-enabling is a post-migration step gated by precondition 5.
6. **Nothing built this session reaches Warwick's phone.** The live Cockpit serves from a clone 183 commits behind. Acceptance criterion ⑨ — that the surface survives the move to canonical merged runtime — is untested by construction.
7. **The unapproved vlog draft is a `product-decision` now open across at least three sessions** — the 2026-08-04 rotation brief, the 4A closure record, and the migration plan all carry it forward. Recorded three times, decided zero. *Recommending a disposition is Larry's; deciding it is Warwick's — but carrying it silently for a third rotation is a route defect worth naming.*

**The one current next action, per the map:** dispatch **Veritas Gate 1** over the complete remaining functional scope (rows 1, 2 and 4) at a frozen head, after completing CI at that exact head.

---

## 7. Recommendations for Warwick

1. **Rule on `db.mjs`.** One file, 22 lines, has dictated architecture across two Work Orders and caused a live incident through a sibling module. A lazy accessor is small. This is a decision, not a programme — and the regrowth cap applies: it is a *change to one file*, never a new mechanism.
2. **Do not read "5 of 5 accepted" as order quality.** The truthful pair is *0 of 5 clean, 5 of 5 delivered*. The gate is carrying Larry's authoring, and its yield is not falling.
3. **`--count-markers` returned `ready: true` on an order with an empty frontmatter block.** Either that check validates the parsed envelope or it should stop reporting readiness. This is the smallest fix in the report and it closes a false-green class.
4. **Read Telegram 355–363 and rule on whether any was routine narration**, and on the overnight silence. No instrument can answer it; the byte trend (down 26.5 %) is the only detectable signal and it points the right way.
5. **Decide the vlog draft**, or explicitly park it with a date. Three rotations is long enough for it to have become invisible.
6. **The report-window convention orphans one notification per rotation.** Two consecutive reports have now recorded one. Define the window by ding id continuity rather than by session boundary.

---

## 8. Limitations

No Bash: no git, no CI, no process table, no `gh`, no ability to diff. All quantities are Larry's measurements, verified where a committed artefact existed and otherwise carried as supplied and labelled. The verification-code share in Q2 is a bounded estimate from current file sizes, not a diff. Elapsed time is approximate by the brief's own statement and is used nowhere as a measurement. Content of notifications cannot be inspected. Vera's engagement authority could not be traced. **Same-estate review — not independently verified.**

*Report written by Pax. Payload: `Deliverables/2026-08-07-session-report-payload-subphase-4b.json`.*
