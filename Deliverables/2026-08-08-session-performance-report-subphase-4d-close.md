# Session performance report — Sub-phase 4D close, 2026-08-08

**Written by Pax as the witness. Larry did not grade himself.** Every figure below is read from an
instrument or a durable artefact. Where a figure is unavailable it is marked `UNESTABLISHED`; nothing
is estimated.

## Session identity — and a discrepancy that must be settled

| Field | Value | Source |
|---|---|---|
| `session_date` | `2026-08-08` | payload · dispatch |
| `branch` | `main` | reflog |
| **`closing_head` (banked)** | **`9de03b7c370d03ba26f8c2cdda9f7902738c70cd`** | `Deliverables/2026-08-08-session-report-payload-4d-close.json:4` |
| Closing head named in my dispatch | `b52e6da` | dispatch text |
| Actual `HEAD` while writing | `9084e0315c4677619c10ad9b9ecee5e0a7adf34f` | `.git/logs/HEAD:659` |

⚠️ **Three different heads are in play and `/rotate` step 5 requires ONE.** My dispatch named `b52e6da`;
the committed payload names `9de03b7`; three further commits (`9de03b7`, `2004612`, `9084e03`) landed
while I was working. **I have matched the payload**, as step 5 directs, and record the divergence rather
than silently picking. This is structural, not careless — step 8 (write the report pointer onto the map)
*must* move HEAD after the payload is written, so "exact closing head" is unachievable as literally
worded. `family: NONE` — no existing slug shares this cause and minting one is a judgement, not mine.

**Instrument limit, stated first because it bounds several rows.** I hold **no `Bash`, no MCP, no
network** in this dispatch — `Read`/`Grep`/`Glob` only. I therefore could not run `git diff`, `gh`, or
query Supabase. Commit facts come from `.git/logs/HEAD` (reflog), which carries SHAs, authors, epoch
timestamps and messages, but **no line counts**. CI run outcomes are taken from the Veritas receipts,
which executed `gh` — they are second-hand to me and labelled as such.

---

## ⭐ STEP 5c — WHAT LARRY WAS TOLD versus WHAT LARRY DID

### ⛔ First: the instrument itself is compromised, and that changes how every row below reads

`~/.mypka/governor/capae-opening.json` exists, so I grade rather than refuse. **But it does not carry
the brief this session opened with, and I can prove that three independent ways:**

1. **Its own timestamps.** `snapshot_at: 2026-08-08T12:16:23.125Z`, over a brief `written_at
   2026-08-08T11:10:32.557Z`. The session's first commit is `06a0a01` at **08:26:32Z**. The snapshot
   post-dates the session's start by ~3h50m and its content by ~2h44m.
2. **Two specialists proved the file did not exist.** Nolan's architecture challenge (banked `f709f38`)
   gives four independent proofs: `snapshotOpeningBrief` imported at `reorient.mjs:53` and called
   nowhere · `readOpeningBrief` has no caller · **`capae-opening.json` does not exist on disk** · the
   installed governor contained zero occurrences of the function. Pax's implementation evaluation found
   the same, and additionally read the then-live `capae-active.json` as **`ff-01 "Pilot family", cause
   null, must null`** — the repository's own unit-test fixture. **That, not these four families, is the
   closest thing to what a fresh Larry would have been handed for most of this session.**
3. **It has already been overwritten once.** Veritas's phase-check receipt (requirement 11) records the
   file on disk with `snapshot_at: 2026-08-08T11:35:35.475Z`. I read `12:16:23.125Z`. **Veritas's own
   non-blocking finding N-3 — "`snapshotOpeningBrief()` fires on every SessionStart, so a later event
   overwrites the opening snapshot" — materialised in production roughly 40 minutes after she wrote it.**

**Consequence for grading.** Question 6 ("despite being in his starting context") cannot be answered
*via this mechanism* for this session. It can still be answered on evidence, and I do answer it, because
**these four families were demonstrably in Larry's working context all session by other routes** — they
were the subject of the work, seeded in the previous session, edited at `e25aec4` (09:07Z) and rendered
in the live Cockpit he was building. The families were known. The snapshot merely fails to prove it.

`family: control-cannot-reach-what-it-checks` · `exposure: recurrence` — a control measured through a
file any later SessionStart destroys.

---

### ① `work-order-not-generated` — **PILOT**

1. **What Larry was told.** *"Work Order issued outside the generated envelope route."* 2 occurrences,
   `MONITORING`, 0/5 clean. Cause: *"The generation route is treated as exempt for orders that feel
   small, amendment-shaped, or urgent. The control exists, is known, and is skipped at the moment of
   dispatch."* MUST: *"Generate the envelope, read it back, then issue. No exemption for small or
   amendment-shaped orders."*
2. **Qualified exposure: `none-this-session`.** I confirm Larry's own recording.
3. **Evidence.** `wo_total: 0` in the payload, verified independently: **no `Deliverables/proofline/
   WO-2026-08-08-*` file exists** — the newest is `WO-2026-08-07-33`. The family's own definition
   (`2026-08-08-4d-capae-decision-brief-and-families.md:96`) sets the exposure unit as *"every issued
   Work Order"*, and its two prior occurrences are Keel implementation orders WO-18 and WO-24. The five
   dispatches this session were two adversarial evaluations and three assurance gates — neither is a
   Work Order under SOP-022.
4. **Prevention held?** Not testable. No exposure.
5. **`no comparable prior exposure`** this session.
6. **No.**

> ⚠️ **One genuine ambiguity, reported for Warwick's decision, not graded as an occurrence.**
> `/rotate` step 5 says the Pax session-report commission goes *"through the normal Work Order route."*
> SOP-022 §J1-1 says *every* Work Order to a specialist must carry the `GENERATED by tools/wo/
> envelope.mjs` marker, and a worker must `REFUSE` without it. **My own dispatch carries no such
> marker**, and neither did the 4C one. Either step 5's wording or the family's scope needs settling —
> otherwise the pilot family's exposure definition is quietly contested. `family: NONE`.

### ② `record-amended-body-not-recut` — **the one Larry deliberately left to me**

1. **What Larry was told.** *"A record is amended and the rows it contradicts are left standing."*
   5 occurrences, **`CHALLENGED`**, 0/5. Cause: *"Amendment-by-append with no reconciliation step.
   Writing the amendment feels like completing the change."* MUST: *"Supersede the body, or do not
   append the amendment."*
2. **Qualified exposure: `clean`.** ⭐ **The prevention held.** This is my verdict, on evidence, and it
   is the first clean exposure the estate has recorded.
3. **Evidence — four surfaces, read at the closing head, plus one independent reader.**
   - **`.claude/commands/rotate.md`.** The amendment (Pax off the blocking path) is accompanied by
     re-cuts of every row it contradicted, in the same document: step 6 (line 71, old text quoted in
     full) · step 12 (line 122, struck through and replaced with *named-and-outstanding*) · Bars line
     144, which states *"Re-cut 2026-08-08, Sub-phase 4D, **IN THE SAME COMMIT** as the steps it
     contradicted"* · Bars line 145, struck through with *"SUPERSEDED — see step 6 and step 12."*
   - **Independent confirmation.** Veritas requirement 20 → **PASS**: *"All four contradicting surfaces
     re-cut in the same document, with the superseded text struck through rather than left standing…
     Grep for residual blocking language returns only the struck-through quotations."* Two readers, one
     of whom executed the grep.
   - **The Wayfinder's 4D block.** The completion carries an explicit fenced instruction — *"⛔ THE FOUR
     ROWS BELOW ARE SUPERSEDED, NOT APPENDED TO. Re-cut in the same commit as the completion, because
     leaving them standing IS the family `record-amended-body-not-recut`"* — and all four rows carry
     strike-through plus a dated disposition. The heading moved from `🎯 THE ONE CURRENT NEXT ACTION`
     to `⛔ HISTORICAL … COMPLETE *(was "🎯 …")*`, and the frontier moved to 4E in the same block.
   - **The handover block** was re-cut, not appended: *"RE-CUT 2026-08-08 (later). The previous handover
     is SUPERSEDED, not appended to — it directed a fresh Larry to push six commits that are now on
     `origin/main`, and it named the machine policy as the cause, which was wrong."*
   - **Commit messages corroborate intent at authoring time**, not after: `09cce7e` *"the CAPAE
     comparison loop, **and the blocking contradiction re-cut**"* and `fad8b71` *"re-cut the map's
     session package."*
   - **I looked for a counter-example and found none authored this session.** No amendment written
     today leaves a contradicted row standing.
4. **Prevention held? YES.** *(Scope of the claim: I verify the **end state** at the closing head across
   four surfaces. Whether each re-cut landed in the literally same commit is **UNESTABLISHED** to me —
   no `git diff`. The MUST targets the end state, and the end state is clean.)*
5. **`improved`.** The previous qualified exposure was **Amendment 14's heading** (previous session,
   same day), which asserted *"4C IS CLOSED"* over Warwick's name on Larry's inference — the fifth
   occurrence, committed in the very document that defines the family. Today the same authoring act was
   performed repeatedly and correctly.
6. **No — it is not repeating.**

> **One live contradiction survives, and it is NOT this session's occurrence.**
> `.claude/commands/close-session.md` line 89 instructs *"Promote each into the smallest correct
> canonical location"* while line 152 forbids *"it may not promote a lesson into operating law."* Same
> command, same page. It was authored in the **previous** session, **reported by Nolan this session**
> (R-6b, *"Live conflict, unrepaired, and owed regardless"*) — and at `9084e03` it still stands, and I
> can find no record parking it. `/rotate` step 2 is explicit: *"Parked is a decision and must look like
> one; silence reads as forgotten."* **A specialist finding that was neither actioned nor recorded as
> parked.** `family: NONE` — the cause is disposition-recording, not amendment-reconciliation, and the
> two do not share a prevention.

### ③ `built-tested-never-activated`

1. **What Larry was told.** *"Built, tested, committed — and never activated."* 4 occurrences,
   `MONITORING`, 0/5. Cause: *"Integration is treated as complete at the point the code is committed and
   green. The activation surface is a separate step nobody owns."* MUST: *"Do not report an integration
   done until the thing it was built to do has actually happened once."*
2. **Qualified exposure: `recurrence`.**
3. **Evidence.**
   - **`snapshotOpeningBrief`** carried a comment calling itself *"the whole of Warwick's comparison
     loop"*, was imported and never called, was not installed, and `/rotate` never referenced it —
     **four independent proofs from Nolan, corroborated by Pax.** Nolan's words: *"This is FF-05
     `built-tested-never-activated` committed inside the mechanism built to count FF-05."*
   - **`capae-check.mjs` was in no CI workflow at all** (Veritas D-2). Green locally, bound to nothing.
   - After CI steps were added at `5b20dc2`, the `CAPAE read layer` step showed **`skipped`** in run
     `31257641290`. Veritas: *"The assertion is written but has never executed in CI… a step that has
     only ever been skipped has not yet proven it can run."* It first executed at `31257962740`.
   - **The direction of error ran both ways in one day** — the map's own item 4: *"Larry asserted an
     activation state twice without executing it… optimistically for the opening-brief snapshot,
     pessimistically [for the push gate]."*
4. **Prevention held? NO for most of the session; YES by its end.** The snapshot was wired and installed
   and its output observed on disk; the CI step was made to execute (`success`, zero skipped); the Stop
   hook was observed firing in production (Veritas read the marker ~11 s after it was rewritten). **But
   the sting stands: the artefact still has not done the thing it was built to do once** — see the
   instrument section above.
5. **`unchanged`.** The comparable prior was `continuity-derive.mjs` — committed, tested, never installed
   or wired, found by Pax in the previous session. Same shape, same discovery route (a specialist, not
   Larry). What did improve: activation now happens inside the same session.
6. **YES — and this is the sharpest instance available.** The family was not merely in his context; it
   was the *subject of the sub-phase*, and a fresh instance of it was committed inside the mechanism
   built to count it.

### ④ `control-cannot-reach-what-it-checks`

1. **What Larry was told.** *"A control is measured through a surface merely correlated with the
   outcome."* 4 occurrences, `MONITORING`, 0/5. Cause: *"The convenient measurement is taken for the
   true one."* MUST: *"Before trusting a control, make it fail on purpose. A check no test can fail is
   not a check."*
2. **Qualified exposure: `recurrence`.** Four instances, three of them mutation-proven.
3. **Evidence.**
   - **`sourceHash` blind to the entire 4D surface.** Veritas mutated `capae.mjs` and the digest read
     `b5a1529657be5225` three times running. *"The digest whose entire purpose is 'what code is ACTUALLY
     RUNNING' is blind to the whole 4D surface. It is currently correct only by coincidence."*
   - **`capaeOverview` asserted by nothing.** Forcing `needsAttention = true` left `capae-check`,
     `render-vm-check`, `nav-check`, `render-check`, `rotation-report-check` and `template-check`
     **all exit 0**. `render-vm-check` stubbed the value it claimed to prove.
   - **The idle-ding hook tested a field that does not exist.** `.claude/hooks/idle-ding-check.mjs:74–79`
     records it in its own source: *"The first version of this line tested `rec.ok === true`, which is
     nowhere in the record `ding.mjs` actually writes… It passed its own unit test because the test fed
     it the ASSUMED shape. **This is the watched family `control-cannot-reach-what-it-checks`, hit
     inside the very control written to fix a different miss.**"*
   - **N-3 materialised** — the opening snapshot overwritten, above.
4. **Prevention held? NO before Veritas; partially YES after.** The repairs *were* mutation-proven
   (`5b20dc2` — *"repaired and mutation-proven"*; Veritas confirmed D-2 three ways, including the
   negative branch), and the new containment guard was made to fail on purpose and **names the offender**.
   What did not change is the ordering: the control was trusted first and made to fail afterwards, by
   someone else.
5. **`improved`.** Every instance was found and repaired with executed mutation proof *inside the same
   session*, before the boundary closed. Previously defects of this family survived into the estate.
6. **YES.** A control written this session to close a notification miss committed this family by name,
   in its own comments.

---

## 📊 EXECUTIVE CAPAE PARAGRAPH

**Four active risks were loaded into Larry at session start. Three had qualified opportunities. One
prevention held. Two recurred despite being in the opening brief. `record-amended-body-not-recut` —
`CHALLENGED`, five prior occurrences, and the family that most recently failed in the document defining
it — held cleanly across four surfaces and is the estate's first clean exposure; that is an
`improvement`. `built-tested-never-activated` recurred `unchanged`, and it recurred inside the mechanism
built to count it. `control-cannot-reach-what-it-checks` recurred, but `improved`: every instance was
mutation-proven and repaired within the session rather than shipped. `work-order-not-generated`, the
pilot, had no qualified opportunity — `none-this-session`, correctly recorded rather than left silent.
And the brief said to be his opening brief was written 2 h 44 m after the session began, snapshotted
3 h 50 m after it began, and had already overwritten itself once: the loop's first run cannot yet
evidence its own premise.**

---

## 🔴 THE FINDING THAT MATTERS MOST — the counters moved the wrong way at the first real rotation

`capae-active.json` was rewritten by step 7c at **13:00:12.408Z**. Compared with the opening snapshot:

| family | opening brief | after the first real sync | Δ |
|---|---|---|---|
| `work-order-not-generated` | occ **2**, clean **0** | occ **1**, clean **1** | occ −1, **clean +1** |
| `record-amended-body-not-recut` | occ 5, clean 0 | occ 5, clean 0 | — |
| `built-tested-never-activated` | occ **4**, clean 0 | occ **3**, clean 0 | occ −1 |
| `control-cannot-reach-what-it-checks` | occ **4**, clean 0 | occ **3**, clean 0 | occ −1 |

**Three occurrence counters went DOWN in a rotation that recorded three recurrences, and the pilot
family gained a clean streak from an exposure recorded `none-this-session`.** Both design authorities
say the latter is impossible: Veritas requirement 17 → PASS on *"`NONE-THIS-SESSION` and `UNMEASURABLE`
are recorded as history and move nothing (`capae-sync.mjs:130`)"*, and Pax's evaluation ⑦ reads the same
from `deriveFamily`.

**Two candidate explanations, and I cannot distinguish them without the database:**

- **(a) a live derivation defect** in `capae-sync.mjs` — recurrences decrementing, `none-this-session`
  counting as clean; or
- **(b) the pre-sync numbers were hand-written fiction now corrected** — which is exactly Pax's finding
  ③ (*"a human maintains the learning, by ad-hoc SQL, outside version control"*) materialising, and would
  mean **every CAPAE brief Larry received throughout 4D carried counts no query supported.**

**Either is material and both must be checked before the next rotation.** `UNESTABLISHED` which.
Note the shape: 14 unit tests green, `capae-check.mjs` 40 assertions green, CI `31257962740` green,
Veritas PASS on all 22 items — and the **first real production run** produced numbers that contradict
the design's own stated invariant. `family: acceptance-proves-mechanism-not-outcome` ·
`exposure: recurrence`.

**Consequence for this report:** my `clean` verdict on `record-amended-body-not-recut` is not yet in the
store — the sync ran before the witness returned. It should be applied only once the counter question is
settled, or the first clean exposure the estate has ever recorded will be written into arithmetic nobody
has verified.

> **And the sequencing defect that produced that:** `/rotate` runs step 7c (CAPAE sync) inside the
> pre-Pax banking block, while its input is step 5c/6b — **the witness's** dispositions. So three of four
> dispositions in the durable record are **Larry's self-assessment**, inside the loop built precisely so
> that *"the session cannot be its own sole witness"* (step 5). Larry was right to bank first (step 6)
> and right to withhold his own `clean`; the contract is what contradicts itself. `family: NONE`.

---

## Work Orders, rework and refusals

| Metric | Value | Source |
|---|---|---|
| Work Orders issued | **0** | `wo_total: 0`; no `WO-2026-08-08-*` exists |
| Specialist dispatches | **5** across **3** agents (pax 1 · nolan 1 · veritas 3) | subagent ledger |
| Began substantive work on first dispatch | **5 of 5** | each return carries executed evidence |
| `REFUSE` | **0** | none in any return |
| `CLARIFY` / amendment round trips | **0** | none recorded |
| Assurance round trips | **2** (HOLD → HOLD → PASS) | three receipts |

**The one preventable round trip.** Veritas's focused confirmation set an explicit trigger: *"cockpit-
private-apps GREEN… Report the CI run id. **A local exit 0 will not close this.**"* The repair at
`5b20dc2` was offered on a local `exit 0`; CI run `31257641290` was **red** — `EACCES: permission
denied, mkdir '/tools/governor'` — because the copy loop escaped the temp directory, which on Windows
succeeds wrongly and on Linux dies. Veritas: *"a local exit 0 is what produced this second cycle."* The
estate's own memory names this exact failure (*a green suite on YOUR machine is not green*).
**Measured price: one extra Veritas cycle — 25,628 incremental tokens and ~5.0 min wall.**
`family: acceptance-proves-mechanism-not-outcome` · `exposure: recurrence`.

**Rework-attributable commits: 5 of 24 (20.8 %)** — `b326b16` and `76d9531` (live Cockpit defects
introduced the same session; `b326b16`'s own message records they were *"caught by the LIVE endpoint,
not the check"*), `c13c771` (correcting `0326174`'s false hook history, 23 min later), `7afac1d`
(D-1 second attempt), `2004612` (sync SQL after a failed run).

---

## 🔔 Notification misses — measured from the ding log

**Instrument:** `~/.mypka/governor/ding-log.jsonl`, one record per invocation with `ts`, `outcome`,
`exit`, `message_id`. **10 sends this session, 0 failures.** Channel available throughout.

| # | ts (UTC) | gap since previous |
|---|---|---|
| 397 | 08:16:18 | — |
| 398 | 08:27:26 | 11 m 08 s |
| **402** | **09:38:07** | **70 m 41 s** ← ids **399, 400, 401 absent** |
| 403 | 10:53:53 | **75 m 46 s** |
| 404 | 10:59:39 | 5 m 46 s |
| 405 | 11:36:50 | 37 m 11 s |
| 406 | 11:49:49 | 12 m 59 s |
| 407 | 12:14:07 | 24 m 18 s |
| 408 | 12:38:22 | 24 m 15 s |
| 409 | 12:53:02 | 14 m 40 s |

**Miss window 1 — 08:27:26 → 09:38:07 (70 m 41 s).** Landing inside it with no notification:
`6a77ed2` (a governance control widened to every shell tool and its registration made durable),
`e25aec4` (*"Buzz's four CAPAE defects — and the three reasons the loop never ran"* — a significant
failure), `49c7314` (a new Cockpit layer), `b326b16` (two live defects the checks missed). **Exactly
three Telegram message ids were consumed in this window by messages `ding.mjs` did not send.** That is
independent corroboration of Warwick chasing three times — the ids are the load-bearing evidence; his
own account is not independent of the record. *Confidence: Medium-High.*

**Miss window 2 — 09:38:07 → 10:53:53 (75 m 46 s).** Inside it: `76d9531`, `fad8b71`, `213a199`
(settling where the live Cockpit runs from — ending a confusion the record says *"cost several
sessions"*), `d3daa64`.

**Before / after the Stop hook, measured.** The idle hook was committed `0326174` at 10:58:01Z and its
own `outcome`-field defect fixed at `c13c771` 11:21:33Z.

| | max gap | mean gap |
|---|---|---|
| Before 10:58:01 | **75 m 46 s** | 52 m 32 s (n=3) |
| After 11:21:33 | **24 m 18 s** | **19 m 03 s** (n=4) |

**Correlation, stated as correlation.** The second half of the session was assurance-dense and
naturally produced gate verdicts worth reporting, which confounds the comparison.

**How many times the Stop hook actually fired: `UNESTABLISHED`, and that is itself a finding.**
`idle-ding-check.mjs` writes only `{"lastStopMs": …}` and logs nothing when it emits the reminder. **A
control that leaves no durable record of firing can never have its own effectiveness measured** — which
is the exact bar CAPAE exists to apply. `family: NONE`; recorded for Warwick's decision.

**Dings sent for routine narration: `UNESTABLISHED`.** The log records byte counts (1,227–2,411 for this
session), never content.

---

## Token, context and time economics

**From the subagent ledger (`Deliverables/2026-08-08-subagent-token-ledger-4d-close.md`), Larry-transcribed
from each `<usage>` block — not independently instrumented.**

- **A — deduplicated subagent traffic: 541,355 tokens.** Naive column-summing gives 927,951, a **71 %**
  overstatement; `subagent_tokens` is cumulative per agent, `tool_uses`/`duration_ms` are per-dispatch,
  re-tested this session on Veritas's three returns.
- **B — peak footprint:** pax **164,764** · nolan **147,554** · veritas **229,037**.
- **C — dispatches / tool uses:** pax 1/30 · nolan 1/26 · veritas 3/93. **149 tool uses total.**
- **Larry's own context, opening and closing: `UNESTABLISHED`.** No instrument exposed to him this
  session. **No ratio is stated** — occupancy is a level, subagent traffic a flow, and one end is unmeasured.
- `tokens_in`/`tokens_out` and model-per-agent: **not exposed** by the harness. Absent, not zero.

**Elapsed.** First session commit `06a0a01` **08:26:32Z** → last `9084e03` **13:01:54Z** = **4 h 35 m 22 s**
(275.4 min). Earliest session evidence is the 08:16:18Z ding; the session-start `HEAD` `b885b4c` was
committed 08:08:39Z. **True session start and end: `UNESTABLISHED`** at finer resolution.

**Cross-session, and this is the headline Warwick will care about:**

| | 4C close (prior) | **4D close (this session)** |
|---|---|---|
| Deduplicated subagent tokens | ~2,171,361 | **541,355** (**−75.1 %**) |
| Assurance share of the working phase | 57.7 % (4B) | **≈15.5 %** |
| Veritas verdicts | 11 (4B), 0 PASS | **3, 1 PASS** |
| Product corrections from assurance | 0 from verdicts 2–11 (4B) | **3 of 3 rounds** |

Assurance share is specialist-occupied wall time — Veritas 28.6 min plus max(pax 6.8, nolan 14.1) for the
parallel pair = 42.7 min of 275.4. **If the pair ran serially it is 49.5 min / 18.0 %.**
**Veritas cost per product correction: ≈76,346 tokens.**

**Waiting time: `UNESTABLISHED`, and not equal to the figure above.** Veritas's phase-check receipt
records that Larry committed `f709f38` *during* her review — direct evidence he worked concurrently, so
specialist wall time is an upper bound on waiting, not a measure of it.

---

## Documentation versus product change volume

**Line volume: `UNESTABLISHED`** — no `git diff` in this dispatch. What I can evidence is a full
classification of the session range `06a0a01..9084e03` (**24 commits**) by conventional-commit type:

| Class | Commits | Share |
|---|---|---|
| Product (`feat` / `fix`) | **15** | **62.5 %** |
| Documentation (`docs` / `Capture`) | **9** | 37.5 % |
| — of which rotation admin (`9de03b7`, `9084e03`) | 2 | 8.3 % |
| — of which rework-attributable (subset of product) | 5 | 20.8 % |

Partial line-level evidence banked by Veritas: `83bcdec..f709f38` = 2 files, **+473 lines, both
`Deliverables/*.md`, zero product code** · `83bcdec..5b20dc2` = 8 files (3 product/harness, 1 workflow,
4 documents) · `5b20dc2..7afac1d` = 3 files (`provenance-check.mjs` +35/−11, the workflow +3/−4, one receipt).

**The 4B pattern did not repeat.** In 4B every Gate 1 FAIL was documentation and verdicts 2–11 produced
zero product change. Here all three assurance rounds produced product corrections: the provenance digest
blind to the 4D surface, an attention signal asserted by nothing, and a false coverage claim inside
product source.

---

## Evidenced allocation

Commit-classified, since no timesheet instrument exists. Windows are the intervals between commits;
this is a proxy and is labelled as one.

| Bucket | Basis | Share |
|---|---|---|
| Product implementation | 10 non-rework `feat`/`fix` commits | 41.7 % of commits |
| Rework / self-inflicted repair | 5 commits | 20.8 % |
| Assurance and evidence | 42.7 min specialist wall + `5b20dc2` | ≈15.5 % of wall |
| Documentation, map and rotation admin | 9 commits | 37.5 % of commits |
| Waiting | — | **`UNESTABLISHED`** (concurrency proven, magnitude not) |

Shares are computed on different denominators — commit count and wall time — and **do not sum to 100 %**.
Stating them on one denominator would require line counts or a time instrument, neither of which exists here.

---

## Parent-channel availability

**Available throughout.** 10 sends, `exit 0`, `outcome: sent`, zero failures on 2026-08-08 after 08:03:07Z.
No queued or deferred messages recorded. **Response latency: `UNESTABLISHED`** — the log records sends,
never Warwick's replies. Message ids 399–401 were consumed by traffic `ding.mjs` did not originate.

---

## Material findings, with family slugs (step 6b)

| # | Finding | `family` | `exposure` |
|---|---|---|---|
| 1 | The "opening brief" was snapshotted 3 h 50 m into the session and had already overwritten itself once (N-3 in production) | `control-cannot-reach-what-it-checks` | `recurrence` |
| 2 | `snapshotOpeningBrief` written, committed, reported wired, never called; `capae-check.mjs` in no CI workflow; its CI step only ever `skipped` until `7afac1d` | `built-tested-never-activated` | `recurrence` |
| 3 | Three controls trusted before being made to fail — `sourceHash` blind to 4D, `capaeOverview` asserted by nothing, the idle hook reading a field `ding.mjs` never writes | `control-cannot-reach-what-it-checks` | `recurrence` |
| 4 | D-1 repair validated on a local `exit 0` while CI was the named gate; CI red at `5b20dc2` | `acceptance-proves-mechanism-not-outcome` | `recurrence` |
| 5 | **First real sync moved three occurrence counters DOWN and awarded a clean streak on a `none-this-session` exposure** | `acceptance-proves-mechanism-not-outcome` | `recurrence` |
| 6 | Every amendment authored this session re-cut the rows it contradicted, across four surfaces | `record-amended-body-not-recut` | **`clean`** |
| 7 | No Work Order was issued; pilot family had no opportunity | `work-order-not-generated` | `none-this-session` |
| 8 | `/rotate` runs step 7c (CAPAE sync) before the witness's step-5c verdicts exist | `NONE` — not minted | — |
| 9 | `close-session.md` 89 vs 152 contradiction reported by Nolan, neither repaired nor recorded as parked | `NONE` — not minted | — |
| 10 | The Stop-hook reminder leaves no durable record of firing, so it can never be measured | `NONE` — not minted | — |
| 11 | Three closing heads in play (`b52e6da` / `9de03b7` / `9084e03`); step 8 must move HEAD after the payload | `NONE` — not minted | — |

**Findings 1–5 differ from, or add to, what was already synced at 13:00:12Z. Finding 6 is new and is not
yet in the store.** Reconciliation is Larry's; awarding or withholding is not mine to execute.

---

## `UNESTABLISHED` — the complete list

1. Larry's own opening and closing context/token readings — no instrument exposed.
2. Total measured context movement, and therefore any Larry-vs-specialist ratio.
3. `tokens_in` / `tokens_out` per specialist, and model per specialist — not exposed by the harness.
4. Documentation-versus-product **line** volume — no `git diff` in this dispatch.
5. True session start and end times at finer resolution than the first/last commit.
6. Waiting time.
7. Number of Stop-hook reminder firings — the hook logs nothing.
8. Whether dings were ever sent for routine narration — the log records bytes, not content.
9. Whether each re-cut landed in literally the same commit as its amendment (end state verified instead).
10. Whether the counter movement at 13:00:12Z is a sync defect or a correction of hand-written figures.
11. CI runs `31256686951` / `31257641290` / `31257962740` — taken from Veritas's receipts, which executed
    `gh`. Second-hand to me; `31256686951` appears in no receipt I read.

---

## Method and limits

Single pass. Read-only: `Read`, `Grep`, `Glob`. No `Bash`, no MCP, no network, no database.
Sources: `.git/logs/HEAD` (reflog, 660 entries) · the three Veritas receipts · Pax's and Nolan's
adversarial evaluations · the subagent ledger and session payload · the active Wayfinder ·
`.claude/commands/rotate.md` and `close-session.md` · `.claude/hooks/idle-ding-check.mjs` · the installed
runtime at `~/.mypka/governor/` (`capae-opening.json`, `capae-active.json`, `idle-check-state.json`,
`ding-log.jsonl`, `continuity.json`).

**Same-model review — not independently verified.** I am the same model that authored the CAPAE
implementation evaluation this session, and the same model as the subject. Genuine independence requires
a different model, runtime, or Warwick himself. **Every load-bearing claim above rests on at least two
sources or on a directly-read artefact; single-source claims are flagged in place.**

*Pax · 2026-08-08 · witness, not subject · read-only, single pass · nothing implemented, nothing changed
outside this file.*
