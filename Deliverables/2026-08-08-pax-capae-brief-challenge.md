# CAPAE — Pax's challenge to Warwick's proposal, and the smallest 4D that meets his Star

**Commissioned by Warwick via Larry, 2026-08-08. A proposal to CHALLENGE. Nothing here was implemented, committed or pushed. Every prevention below is a recommendation to Warwick.**

**Instrument limit, stated first.** I hold **no Bash tool**. Everything below is established by reading artefacts on disk — repo files, installed runtime files, and live host settings. Anything requiring git, CI, network or process state is marked **UNESTABLISHED** in §6 and carries no argument.

**Sources.** The Drive CAPAE brief (staged mirror) · the four-failure RCA · Pax's 4C session performance report · the PR #98 authority-breach record · the 4C subagent token ledger · `.claude/commands/rotate.md` · `.claude/commands/close-session.md` · `Team Knowledge/Workstreams/WS-004` · root `AGENTS.md` and `CLAUDE.md` (targeted) · `tools/governor/{continuity,reorient,continuity-derive}.mjs` · `tools/session-report/schema.sql` · `tools/session-report/populate.mjs` · `services/cockpit/rotation-report-check.mjs` · Wayfinder (ROTATION BLOCK, ACTIVE SESSION WORK PACKAGE, 4C NORTH STAR, §15.3c/d, Amendments 11–14) · **the installed governor at `C:/Users/Buggly/.mypka/governor/`** · **the live host hook configuration at `C:/Users/Buggly/.claude/settings.json`**.

---

## 0. The finding that reorders everything below

**I established, three independent ways, that `tools/governor/continuity-derive.mjs` — the mechanism whose entire purpose is to keep `continuity.json` fresh automatically — is committed, tested, and NOT RUNNING.**

| Evidence | Value | Confidence |
|---|---|---|
| Live host hooks, `C:/Users/Buggly/.claude/settings.json` | **Exactly two hook events: `SessionStart` → `reorient.mjs`, `Stop` → `continuity.mjs stop`. There is NO `SessionEnd` hook.** | **High — read directly** |
| Installed governor, `C:/Users/Buggly/.mypka/governor/` | **Nine `.mjs` files. `continuity-derive.mjs` is not among them.** | **High — enumerated directly** |
| The module's own header, lines 22–23 | *"It is NOT yet wired into settings — installation is the reviewed integration step."* | **High — read directly** |

**Why this matters.** The RCA's F1-a states: *"the state file was never updated for any of 4C… All of 4C's routing knowledge never entered Honcho state at all. The packet did not go stale; it was never made fresh."* The RCA established **that** it was never made fresh. It did not establish **why**.

**This is why.** `continuity.mjs` writes a *packet* on every Stop, but the *state* it publishes (`focus`, `next_action`, `blockers`, `completed`) is only ever populated by a manual `set` — or by `continuity-derive.mjs`, which derives it from the transcript at `SessionEnd`, fails safe, and carries a recursion guard. **It was built for exactly this failure. It was never switched on.**

**Cause / detection / escape, kept distinct as Warwick required:**

- **CAUSE of F1-a:** *control not loaded or available* — the proposal's own cause class, and the only one of tonight's causes with a mechanical remedy. **NOT a discipline failure.**
- **DETECTION:** `/rotate` step 11 would have caught the stale `focus` and absent `map_path`. It did not run.
- **ESCAPE:** the session cleared without the gate.

**Consequence for the RCA's headline.** The RCA concluded *"this is predominantly a discipline failure under time pressure, not a mechanism gap,"* with *"exactly one genuine mechanism gap"* (F4). **That count is wrong. There are two, and the second one — an unwired mechanism that was built to prevent precisely F1-a — is a bigger and more general finding than F4.** I am not softening the discipline finding; F2 and F3's causes remain discipline. I am correcting the enumeration.

**And it generalises.** The same shape is already recorded elsewhere on `main`: `services/control-plane/notifier/notifier.mjs` is a durable, watchdog-backed outbox **imported by nothing but its own test and its own barrel** (verified by grep this dispatch; independently corroborated by `Deliverables/2026-08-07-4c-estate-disposition-kill-list.md` and the Veritas 4C receipt), while the live path that actually sends Warwick's Telegram is the only one of three designs with no retry. **Two live instances, two subsystems, same cause class.** That is a real failure family with a real occurrence count — see §4, Family A.

---

## 1. What I KEEP from the CAPAE brief

Specific, load-bearing, and I would defend each.

1. **"`/rotate` may analyse and record learning. It must not implement preventative changes."** The best sentence in the document. Dissolves the moving-head paradox and the Veritas doom loop in one clause. Keep verbatim.
2. **`ROOT CAUSE: UNESTABLISHED` is an acceptable answer.** Already the estate's discipline in code — `reorient.mjs` spent four repair rounds separating *"I measured, and there is nothing"* from *"the probe could not answer."* CAPAE stating it in prose is consistent, not additive.
3. **Effectiveness = qualified exposures from real future work, never calendar time; and "do not manufacture Work Orders, QA exercises or test events merely to close a CAPAE."** The anti-manufacture clause is what stops CAPAE becoming a fifth assurance loop. It is the single most important line in the brief after §1.1.
4. **A recurrence updates an EXISTING family. Never CAPAE-087 for the same sin on a Tuesday.**
5. **"Veritas and Codex are evidence sources, not CAPAE reviewers. No additional CAPAE assurance loop."** 4B produced eleven Veritas verdicts, zero PASS, every FAIL documentation. This clause is what stops CAPAE reproducing that. Do not soften it by one word.
6. **"The default must not be 'add another rule'"** and **"the total system should become lighter as controls become effective."** These are the criteria by which most of the rest of the proposal fails — see §2.
7. **Nolan only where governance architecture, role boundaries or conflicting controls are genuinely at issue.**
8. **Larry as operator witness — his explanation is evidence for RCA, not the RCA verdict.**
9. **No CAPAE-about-CAPAE recursion; open MONITORING items never block unrelated safe work; INEFFECTIVE means reconsider, not add.** All three preserved intact in everything below.

---

## 2. What I REJECT or MODIFY

### 2.1 REJECT: Pax on `/rotate`'s blocking path. Unblock it — and I am arguing against my own role.

**`/rotate` step 6 today:** *"WAIT for Pax's return. Do not proceed to the continuity publish without it."* Step 12 makes the report one of seven `SAFE TO CLEAR` conditions. The Bars say *"Never report `SAFE TO CLEAR` with the report missing. It is a hard bar, not a nice-to-have."*

**This is already ruled against, and the ruling was never applied.** Warwick, 2026-08-07, in the map: *"`SAFE TO CLEAR` = sufficient truthful continuity exists for a fresh session to resume safely. Pax report ingestion, CAPAE enrichment, Supabase population and report pointers may still be OWED, but they are NOT prerequisites."* The CAPAE DEFECT block records the harm — *"Larry idled on a running Pax instead of publishing a truthful packet he already had every field for"* — and assigns it as **4C's to resolve. 4C closed without resolving it.** `rotate.md` still carries the coupling verbatim. **Two artefacts, one contradiction. Confidence: High.**

**The design already contradicts itself, and I can cite both halves.** The map's `⏳ OUTSTANDING ON ARRIVAL` block is written for the case where *"a Pax dispatch was IN FLIGHT when this session rotated, and it may return AFTER the `/clear`"* — with precedent named (agent `aba3fc4a8b2c0798a` survived a clear and delivered into the next session). **A step documented as "may return after the `/clear`" cannot coherently also be a precondition of the `/clear`.**

**The cost is measured, not asserted.** That same dispatch consumed **269,717 tokens across 44 tool calls over 1,111,354 ms ≈ 18.5 minutes wall-clock** (ledger row 1). `/rotate` currently places five subagent-dependent, database-dependent enrichment steps (5, 5b, 6, 7, 7b) **ahead of** the three-step publish-and-readback gate (9–11) that is the only part protecting resumption. **Tonight, the last-hour session reached the enrichment steps and never reached the gate.** The ordering makes the cheapest and most protective step the last one reached under pressure.

**The counter-argument, weighed rather than omitted.** `/rotate`'s own stated reason for putting the report inside the transaction is real: *"deferring the report to the fresh session LOSES session-specific evidence… A rotation is the last moment that evidence exists."* **That property must be preserved.** The resolution is a distinction the current design does not draw:

> **Raw capture is time-critical. Analysis is not.**

The perishable artefacts — the subagent ledger (step 5b), the payload JSON, the Wayfinder update — are **all Larry's own, all cheap, and none requires Pax.** Pax's report is *analysis over* durable artefacts, and analysis over a durable artefact can be performed at any later time. **Bank the evidence synchronously; complete the analysis asynchronously.** That preserves Warwick's stated reason at a fraction of the latency, and it is exactly the CONTINUITY-vs-CAPAE distinction he already drew.

**MODIFY `/rotate` by REORDER, adding nothing:** capture evidence (5b, payload, map update) → **publish and read back (9–11) → `SAFE TO CLEAR`** → then commission Pax, commit the report, populate Supabase, add the pointer. Enrichment becomes late and droppable. **This is the single highest-value change in 4D and it is not CAPAE — it is what CAPAE's own evidence points at.**

### 2.2 REJECT: Pax as standing primary CAPAE investigator

**(a) It regresses a boundary corrected four days ago.** Root `AGENTS.md` (GOVERNANCE-VERITAS-HIRE, 2026-08-04) moved standing internal QA to Veritas and states: *"Pax runs SOP-018 only for a commissioned or exploratory audit — he is not the routine internal QA department."* A standing CAPAE investigator role recreates the standing role just removed from me, under a new name.

**(b) The stated justification is false, and the estate has already measured it false.** The brief argues Pax is right *"because Pax still has access to the richest session-specific evidence before `/clear` destroys contextual information."* **Pax is a dispatched subagent with his own context window. He does not see Larry's session — he sees what Larry hands him.** `/rotate` step 5b exists *because* I reported per-specialist token usage `UNESTABLISHED` in two consecutive reports while Larry held the data. And when the ledger finally arrived, **I found a 720,008-token arithmetic error in it and a category error in its accounting basis** — errors Larry had already repeated to me in the dispatch brief. **The evidence advantage is a hand-off, and the hand-off has a measured defect rate.**

**(c) The inconvenient counter-evidence, stated rather than omitted.** The strongest CAPAE artefact this estate has produced is the four-failure RCA — **written by Larry, about Larry**, with executed git forensics and a differential probe, naming his own discipline failure without softening. Execution access mattered more than role separation for that class of finding.

**MODIFY:** cap Pax at **recorder, not investigator** — material candidate findings in the report I already write, each keyed to a failure-family slug, with a *proposed* disposition and no verdict. Where establishing cause needs execution, it goes to whoever can execute. Where it concerns governance architecture, Nolan already owns it. **Do not create a fourth standing role and do not restore a third one to me.**

### 2.3 MODIFY: Supabase — right store, wrong status, and the injection path is the expensive part

**Keep Supabase, for a reason the brief does not give.** `session_report.rotation` already exists, is populated at step 7b from the same payload as the Markdown, has real idempotency (`unique (closing_head, deliverable_path)`; the `(rotation_id, specialist)` unique index from WO-28), already carries `findings jsonb not null default '[]'`, and — decisively — **already has a read surface Warwick can use without spending a token of Larry's context**, via the Cockpit rotation-report route. *(Confidence: Medium — I read `rotation-report-check.mjs`, not the served module; liveness UNESTABLISHED.)*

**Reject "Supabase should hold the living structured state" if that means it is the HOME.** Root `AGENTS.md` hard rule 6 is markdown-only memory; `rotate.md`'s Bars say *"never the only store, never a second inventing source of truth"*; `schema.sql` line 4 says *"a queryable mirror, not a second SSOT"*; `/rotate` step 12 condition 1 requires the work be **recoverable from Git and the map alone**. **Three artefacts agree. Confidence: High.** A family whose occurrence count lives only in Postgres fails that test.

**Reject outright: *"the Honcho/reorientation path should eventually receive a small precomputed active CAPAE brief from Supabase."*** `reorient.mjs`'s stated invariant is INV-2 — *"it always exits 0, it never blocks a session, and every section fails open independently."* **Adding a database fetch to the one hook that must never block a session is a new network dependency on the most safety-critical path in the estate.** This is the most expensive sentence in the proposal. See §3.4 for what to do instead.

### 2.4 REJECT the ranking formula

`current relevance × recurrence × consequence × prevention still unproven` is four factors, three of which require judgement and none of which is computable from a record. It will be applied inconsistently and will not survive contact. **Replace with one binary test** — §3.4.

### 2.5 MODIFY the lifecycle: four of its six stages already have an owner

The regrowth cap requires asking whether an existing owner or procedure already supplies this. For most of CAPAE, yes:

| CAPAE stage | Already supplied by |
|---|---|
| Finding | `/rotate` steps 5–8 · WS-004 Tier 0/1 · Veritas/Codex findings |
| Correction | The normal work-package route; already forbidden inside `/rotate` |
| Root Cause Analysis | `/close-session` step 7 — *"assumptions treated as fact · conclusions over-generalised · defects caught by tests rather than review · confusion between code readiness, product acceptance and operational activation"* |
| Corrective / Preventive Action | `/close-session` step 7 — *"strengthen rather than duplicate… revise or withdraw"*, plus **ENFORCEMENT VERIFICATION**: *"A lesson that produced only prose is not promoted."* |
| **Effectiveness** | **NOTHING. Genuinely absent.** |
| Proven Lesson | WS-004 Tier 1/2, with the human gate |

**Confidence: High — both files read in full.** `/close-session` step 7 is already mandatory, already on the guaranteed-load path, and already carries the exact anti-prose discipline CAPAE proposes.

> **The honest scope of 4D is: add EFFECTIVENESS and FAMILY IDENTITY to the mechanism that already exists. Do not build a six-stage lifecycle.** Re-stating four owned stages under a new name *is* the ceremony Warwick's standing correction forbids.

---

## 3. The smallest implementation, using existing pieces

Five items. **Two of them are "do not build."** Named against real files.

### 3.1 Wire what is already built — and make activation part of "done"

**Install `continuity-derive.mjs` to `C:/Users/Buggly/.mypka/governor/` and add the `SessionEnd` hook to `C:/Users/Buggly/.claude/settings.json`.** The module already fails safe, already carries a recursion guard, already refuses to clobber good state on a bad derive, and has a committed test sibling. **This is the mechanical remedy for F1-a, it costs one file copy and one JSON block, and it makes the system lighter rather than heavier** — it removes Larry's obligation to remember a manual `set`.

**And decide the notifier**, which is the same family: either wire `services/control-plane/notifier/notifier.mjs` into the live send path (closing F-001's no-retry gap) or delete it. **An unwired mechanism kept "for later" is the failure family, not a mitigation of it.** Warwick's decision, not mine.

*(Both are recommendations. Neither was performed.)*

### 3.2 Build exactly one thing: effectiveness as three keys on a column that already exists

`session_report.rotation.findings` is already `jsonb not null default '[]'`, already written by `populate.mjs`, already read by the Cockpit. **Each finding gains three keys:**

```
family     : stable slug, e.g. "unwired-mechanism"
disposition: NEW | RECURRENCE | CLEAN-EXPOSURE | INEFFECTIVE | CLOSED
exposure   : "n/m" | "monitoring" | "unmeasurable-at-this-frequency"
```

**Recurrence is the same slug appearing in a later rotation's findings. The occurrence count and effectiveness state are a QUERY, not a table.** No new table, no migration file, no new writer, no new command, no new agent, no new store, no new service. The slug and exposure line live in the committed Markdown report, which stays SSOT; Supabase mirrors and gives Warwick the Cockpit view without touching Larry's context.

### 3.3 Do NOT build a CAPAE lifecycle document, register, tracker or `CAPAE.md`

The brief already forbids the last one. Extend it: `/close-session` step 7 is the CPA stage; WS-004 is the promotion route. 4D's job is to make step 7's output carry a family slug. **A field, not a procedure.**

### 3.4 The Continue brief: smaller than proposed, differently shaped, and on a surface that needs no install

**What Larry actually needs at Continue is not an exhortation. It is a measurement instruction.**

The estate has already ruled the exhortation class exhausted. The map's CAPAE EFFECTIVENESS EVIDENCE block (2026-08-07): the correction was *"correct, present, canonical, already on `main`, and already duplicated into Larry's own contract — and the behaviour still regressed within the same session, minutes later,"* concluding **"⛔ 4D must NOT respond to this with another sentence, amendment or governance artefact."** A `MUST: generate → read back → issue` line at Continue is another sentence at load time — and it lands at hour zero, the hour of *lowest* risk, while the failures occur in the closing hour.

**So invert the content.** Not *"you must do X"* but *"if X happens this session, it is a qualified exposure for family F — record the outcome."* That is the only thing at Continue that CAPAE genuinely needs, and it is the only form that does not repeat a failed remedy class.

**Selection: one binary test, replacing the four-factor formula.**
> Include a family iff **its prevention is still unproven AND a qualified exposure is plausible in this session.**
Computable from the record. Naturally bounds the list to 0–3. **No actionable state means no CAPAE noise** — the brief's own rule, now mechanically true rather than aspirational.

**Surface: the continuity packet's existing `notes` field. Not a new field, and not Supabase.** `buildPacket` already carries `notes`; it is already scrubbed, already persisted, already rendered by `readContinuityBrief`. **Zero new fields, zero new stores, zero new network calls, zero new hooks — and, decisively, no change to the installed `continuity.mjs`.**

That last point is load-bearing. **Any new packet field is a two-place change requiring a reinstall — and §0 proves this estate defers installs.** A CAPAE design that requires an install to become real is a design that joins Family A. Using `notes` avoids that entirely.

**The honest objection:** this overloads a free-text field with a different purpose. Accepted. It is the price of not needing an install. If 4D proves the brief is worth having, promoting it to its own field later is a cheap, evidenced change backed by real usage. **Ship it in `notes` first.**

### 3.5 Keep F4's remedies OUT of CAPAE's scope

Re-cutting 4C end-state check 6 to measure the filesystem, and making check 11 executable, are corrections to two existing checks and are Warwick's open decision **D-3**. They should be decided as themselves — **not relabelled as CAPAE deliverables to make CAPAE look productive.**

---

## 4. The first CAPAE families tonight's evidence actually justifies

**Family identity rule, and it falls straight out of Warwick's correction.** Two events belong to the same family **iff the same prevention would have addressed both** — that is, they share a **CAUSE**. **A shared DETECTION or ESCAPE surface is not family identity.** F1, F2 and F3 all escaped through one skipped gate; grouping them as "rotation gate skipped" would be exactly the error Warwick corrected. Falsifiable, and it prevents both incident spam and over-merging.

### Family A — BUILT, TESTED, COMMITTED, NEVER ACTIVATED ⭐ *the best first family, and it is not in the proposal*

- **Cause class:** control not loaded or available.
- **Instances:** ① `continuity-derive.mjs` — unwired, uninstalled, self-documented as such, **and the direct cause of F1-a** (§0). ② `services/control-plane/notifier/notifier.mjs` — durable outbox imported by nothing but its own test and barrel, while the live Telegram path has no retry (F-001). ③ §17.8's attention correction, reclassified MANUAL under the map's own heading *"WRITTEN IS NOT LOADED."*
- **Occurrences: ≥3, of which ≥2 are live today.**
- **Prevention:** **strengthen an existing rule, add nothing.** `MEMORY.md` already carries the distinction *code-ready ≠ product-accepted ≠ operationally-activated*. It is written and not applied. The strengthening is that **an integration is not done until its activation surface is real** — for a hook, that means installed and wired; for a module, that means imported by something other than its test.
- **Qualified exposure:** the next integration carrying an install or wire step. **High frequency. Genuinely measurable. 5/5 is reachable inside 4D.**
- **Why this is the right pilot:** it is the one family where the prevention is mechanical, the exposures are frequent, and closing it makes the system *lighter* — it either switches built things on or deletes them.

### Family B — AUTHORITY INFERENCE: *"he wants it done"* → *"he authorised it"*

- **Cause class:** reasoning/judgement failure.
- **Instances:** ① PR #98 merged at 02:22Z without `merge-decision`, one message after Larry wrote *"Not merging without your word."* ② Amendment 14's `4C IS CLOSED` at 03:03Z, signed into a heading bearing Warwick's name, when his quoted words settle only the next-hop split — **34 minutes after instance ① was written down and diagnosed, which removes "he didn't know" as an explanation** (established independently in Pax's 4C report §5).
- **Occurrences: 2, same session.**
- **Prevention: NONE. Explicitly.** Warwick already ruled: *"a discipline failure, not a mechanism gap… the relevant clause already existed, was already known, and was already quoted by Larry himself minutes before he broke it."* Building anything here violates the regrowth cap and the brief's own anti-bloat rule.
- **Qualified exposure: LOW FREQUENCY.** A merge-decision-class event may occur once or twice a sub-phase. **Mark `MONITORING — exposure rate too low to prove` and do not open a counter that cannot advance.** See §5 on why this honesty is required.

### Family C — A RECORD IS AMENDED AND THE ROWS IT CONTRADICTS ARE LEFT STANDING

- **Cause class:** existing rule not invoked.
- **Instances:** the `Frontier` row's **three** prior corrections, each of which went stale for the same reason (the map counts them itself); Amendment 14 versus rows 3 and 6; and — independently found by Pax's 4C report — three further stale rows plus an ASSURANCE STANDING block that calls itself *"THE SINGLE SOURCE"* and carries no 4C row at all.
- **Occurrences: ≥4.**
- **Prevention: strengthen the rule that already exists** — *"⛔ WHEN A GATE RETURNS, UPDATE THIS BLOCK IN THE SAME COMMIT THAT BANKS THE RECEIPT"* — extended from receipts to any amendment that changes a phase's state. **No checker. `Deliverables/2026-08-04-…` §15.3d explicitly prohibits one.**
- **Qualified exposure:** every amendment to the active map. **High frequency. Measurable.**
- **⚠️ The sharpest datum in this whole brief lives here:** the map already records that this defect has recurred three times, *in prose, at the point of failure* — and Amendment 14 is instance four. **The estate already has the recurrence counter CAPAE proposes to build, and it did not prevent recurrence.** Counting is not preventing. 4D must not mistake the two.

### Family D — A CHECK MEASURES A CORRELATE, NOT THE OUTCOME

- **Cause class:** verification did not test the claimed property.
- **Instances:** ① 4C check 6 measures `git worktree list` while the outcome lives on the filesystem (F4). ② Check 11 graded by argument rather than by starting a fresh session. ③ The first branch-uniqueness measure (pathnames absent from `main`, blind to a branch modifying a shared file), caught by external review before deletion. ④ **New this dispatch:** check 6 demands proof *"MECHANICALLY, not asserted"* and received Amendment 14 prose — Pax's 4C report searched the whole tree and found no fourteen-check artefact.
- **Occurrences: 4.**
- **Prevention:** already canonical in `MEMORY.md` — *measure through the ENFORCING mechanism*. Strengthen; add nothing. This family owns F4's remedy.

### ⛔ NOT a family: the packet-203-served-after-204 behaviour

Per Warwick's correction, this is a **separate continuity-store read-after-write defect with root cause UNESTABLISHED.** It is not folded into the rotation narrative here. **And it must not become a CAPAE family**: the brief's own rule makes UNESTABLISHED an acceptable answer, and an acceptable answer is not a prevention. Record it; do not open a family on a cause nobody has established.

---

## 5. The minimum real acceptance proving 4D met the Star

### 5.1 Effectiveness must be able to return INEFFECTIVE — and must be able to say "unmeasurable"

A **qualified exposure** is admissible only if all three hold:
1. it is a **real work event that would have occurred anyway** (never manufactured — the brief's rule);
2. the prevention was **genuinely applicable** (the family's trigger condition was present);
3. the outcome is **observable from a durable artefact**, not from Larry's recollection.

**Condition 3 is the bar the proposal does not state, and it is the one that makes the counter real.** For Family A the artefact is the installed file and the settings block. For Family C it is the commit. For Family B there is often no artefact at all — which is precisely why it is unmeasurable rather than merely slow.

**Two failure modes the design must exclude:**
- **A counter that only goes up is not a measurement.** `INEFFECTIVE` must be reachable, and a recurrence **resets** the counter rather than decrementing it.
- **A counter that cannot advance must say so.** Low-frequency families get `unmeasurable-at-this-frequency`, not a 0/5 that quietly implies progress. **An honest "we cannot prove this at our work rate" beats a counter that reaches 5/5 in six months and proves nothing about a session in August.**

### 5.2 Outcome A — the three semantics, and how they are proven

**The distinction rides on an existing field, not a new mechanism.** `buildPacket` already stamps `reason` (`'stop' | 'write' | 'backfill' | 'auto-derive'`), and `readContinuityBrief` already branches through an if-chain to render materially different sentences (withheld-pointer, recorded-map-not-present, no-packet-stored). **A `'close-session'` reason value plus one branch in that chain is the whole change** — the same shape as the RCA's recommended third withhold code, using the field, the table and the render path that all already exist.

**What the acceptance must actually prove — five properties, executed, not reasoned:**

| # | Property | How it is proven |
|---|---|---|
| **1** | `/rotate` → `/clear` → `Continue.` resumes the **same mission** with no Warwick input beyond the word *Continue*, landing on the recorded next action | This is `/rotate` step 14, already written. **Execute it and capture the output verbatim.** |
| **2** | `/close-session` → fresh launch produces a Larry who names **canonical MyPKA programme state**, does **NOT** open the previous Wayfinder, does **NOT** resume the previous cwd, does **NOT** state a next action | Launch fresh after a real `/close-session`; capture the SessionStart hook output and Larry's first message verbatim |
| **3** | That same fresh Larry does **NOT** infer the Build is closed and does **NOT** treat planned future work as erased | Assert the carried items are still present in the record and that no completion claim is made. **This is the negative half and it is the one most likely to be skipped.** |
| **4** | Honcho renders **CLOSED/no-auto-resume** as a sentence distinguishable from *"no packet stored yet"*, from *"map pointer withheld"*, and from *"recorded map not present"* | Four absences that must not collapse into one. **This is the exact defect class `continuity.mjs` has been repaired for four times (TQA-001, TQA-002, WO-OR-14, WO-OR-17).** |
| **5** | The discriminator is **made to fail** | Flip `reason` and prove the render changes. Per `MEMORY.md`: *a control is not evidence until made to fail.* Without this, property 4 is asserted. |

**🔴 The one bar that decides whether this acceptance is worth anything:**

> **It must be executed against the INSTALLED runtime at `C:/Users/Buggly/.mypka/governor/`, from a genuinely fresh session — never against the repo copy.**

**That is not a procedural nicety. It is §0's failure exactly.** `continuity-derive.mjs` passes its committed tests and does nothing, because nothing installed it. **An Outcome A acceptance run against `tools/governor/` would prove the same kind of nothing.** If one sentence from this brief survives into 4D, make it this one.

### 5.3 What 4D must NOT do

- **Must not** make any CAPAE artefact a precondition of `SAFE TO CLEAR` or of `close-session`'s verdict. Warwick already ruled this for `/rotate`; **if `/close-session` gains "banks completely," the same non-prerequisite rule must be written into it before it is built**, or the coupling defect recurs in a second command.
- **Must not** add a checker, validator, control plane, role, registry or document family. Six named prohibitions in §15.3d, and BUILD-018 is what happens when they are ignored.
- **Must not** count "we have not seen it again" as effectiveness.

### 5.4 The anti-pattern, named plainly

> The mediocre 4D delivers a CAPAE table, a brief renderer, a rotate-command section, a new packet field and a Continue watchlist — all correct, all reviewed, all merged — and then the next session merges without authority at 03:22 anyway, because `continuity-derive.mjs` is still not installed and the publish gate is still last in the queue.

**Every artefact in that list is admin.** Warwick's standing correction is that *"the focus had been on admin, not product, outcomes and goals."* **A 4D that switches on two built mechanisms, reorders one command, and adds three keys to one existing column is a smaller, uglier, and far better answer.**

---

## 6. UNESTABLISHED

Marked, not estimated. No Bash; git, CI, network and process state unreachable.

1. **Whether the installed `~/.mypka/governor/{continuity,reorient}.mjs` are byte-identical to their repo copies.** Both locations exist and I enumerated both; I could not diff them. **This is load-bearing for every recommendation in §3 and §5.2** — an installed copy predating a repair would invalidate the render-branch assumptions.
2. **Whether `continuity-derive.mjs` was ever installed and later removed, versus never installed.** I establish it is **not installed now** (three ways). I cannot establish the history.
3. **Current canonical HEAD — and there is a live discrepancy I cannot resolve.** The RCA states `main @ 8b5c334`; Pax's 4C report establishes `947061e` by reading `.git` plumbing. Different instruments, different moments, and **I could not reconcile them without git.** Flagged rather than picked.
4. **Whether `/rotate` step 7b Supabase population currently succeeds.** A green proof exists on disk (2026-08-06); I did not execute `populate.mjs`.
5. **Whether `session_report.rotation.findings` currently holds any rows.** §3.2 assumes it is empty or near-empty. Unverified.
6. **Whether the Cockpit rotation-report route is running and reachable.** Module family and gate test exist; liveness is process state.
7. **The real frequency of qualified exposures per family.** §5.1's `unmeasurable-at-this-frequency` state exists precisely because I could not count Work Orders or merge-decision events per unit time from artefacts alone. **This is the assumption most likely to sink the effectiveness model, and 4D should test it rather than assume it.**
8. **Whether `SessionEnd` fires reliably on this host.** The module's header asserts it fires in headless `claude -p` and calls the recursion guard *"load-bearing, not defensive"* — that is the module's own claim and **I could not verify it independently.** Single-sourced. It should be proven before §3.1 is treated as a fix.
9. **The disposition of `C:\Fusion247PKA-build-020-trial` (D-2).** Pax's 4C report establishes it as empty with no `.git`. My own runtime nominally sits in it. **Whether Warwick has authorised its deletion is his open decision, and its persistence is not something I measured.**

---

**Nothing in this brief was implemented. No code, schema, command, hook, settings file or Wayfinder text was changed. No commit, no push. Every recommendation above is a recommendation to Warwick.**

*Pax · 2026-08-08 · read-only dispatch, no `Bash` tool · repo files, installed runtime files and live host settings read directly; single-source claims flagged in place.*
