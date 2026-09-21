# Session performance and process report: `Apps and Opps ⑂ [3d400a]`, 2026-09-21

**Written by Pax as `/rotate` step 5. Larry did not write this and is not the source for any conduct
claim in it.** Where a statement rests on Larry's own account and no artefact corroborates it, it says
so in the sentence.

**Session:** `Apps and Opps ⑂ [3d400a]`, a fork of `Apps and Opps [2762c8]`
**Branch:** `worktree-build-careerair-reconciliation`
**Worktree:** `C:/Fusion247PKA/.claude/worktrees/build-careerair-reconciliation`
**Closing head:** `2bf7ea488c7774b93403d16e88bcda8b169dca5d`
**Range:** `045c7c2..2bf7ea4`, three commits, plus non-Git work in `C:/.fusion247/private/careerair/`

**⚠ METHOD LIMIT, STATED FIRST BECAUSE IT SHAPES EVERYTHING BELOW.** This dispatch had **no Bash, no
git binary and no database access**. Every Git figure was read directly out of plaintext under
`C:/Fusion247PKA/.git/` (worktree reflog, refs, remote-tracking reflog, `COMMIT_EDITMSG`). No diff,
no `git show`, no `SELECT`. Line counts are whole-file counts, never deltas. **Row-count claims about
`careerair.application` and `application_event` are NOT verified in this report**, and the reason is
given in the relevant section rather than buried in a footnote.

---

## 1. Executive CAPAE

**The brief Larry was handed at 11:47 was twenty-six days, nineteen hours and fifty-four minutes
stale, and the estate has not populated a rotation since 25 August.** On those four families this
session splits two and two. **`built-tested-never-activated` is CLEAN, and cleanly so:** every piece
of product built today reached a real production event on the same day, including the scheduled 17:00
email run and two employer confirmation pages read back off the screen. **`control-cannot-reach-what-
it-checks` is a recurrence, and the best news in the report sits inside it:** two instances were found
and closed in the session's own new code, both by a worker, both with the failing case written into the
comment. **`work-order-not-generated` is a recurrence and it is the worst row:** fourteen subagent
returns, twelve of them to one agent doing substantive build work, and not one generated Work Order
envelope anywhere in the repository. And it recurred in a shape the family's own prevention does not
address: the envelope was **generated and then abandoned on authoring cost**, not skipped at dispatch.
`tools/wo/envelope.mjs` emits **26** author-required slots, which is exactly the number Larry gave, so
the reason is corroborated from the source rather than from him. **`record-amended-body-not-recut` is a
recurrence and it is a step backwards from the rotation immediately before it**, which was clean on
this family: `LEDGER-SETTLED.tsv` still declares three columns at its head while twenty of its rows,
including both of today's, carry eight, and a parser that documents itself as beating every derived
rule silently keys those twenty on a date. **The single thing needing Warwick is none of the above.**
It is that the two CVs actually sent to real employers today have no `cv_artifact` row describing their
bytes, because the QA chain refuses `fable` by name in a committed constraint while Warwick authorised
`fable` by name as the reviewer.

---

## 2. Measurements

### 2.1 Time

| Event | UTC | BST | Source |
|---|---|---|---|
| Session start (SessionStart snapshot) | 2026-09-21T10:47:44.732Z | 11:47:44 | `capae-opening.json` `snapshot_at` |
| Manual email intake run rendered | 10:58:31.209Z | 11:58:31 | `runtime/email-runs/careerair-email-manual-2026-09-21-11-55.json` |
| FusionDevBot notification 658 | 11:03:39.911Z | 12:03:39 | `~/.mypka/governor/ding-log.jsonl:262` |
| Scheduled 17:00 board rendered | 16:06:13.567Z | 17:06:13 | `runtime/email-runs/careerair-email-2026-09-21-17-00.json` |
| Application 1 submitted (Kingdom) | approx. 17:55Z | approx. 18:55 | `4468099206-kingdom-services/APPLICATION-STATE.md:5` |
| Worktree created | 19:35:53Z | 20:35:53 | worktree reflog line 1 |
| Commit `8dc3773` | 19:56:47Z | 20:56:47 | worktree reflog line 3 |
| Commit `bb63040` | 20:00:04Z | 21:00:04 | worktree reflog line 4 |
| **First push to origin** (carrying `bb63040`) | 20:05:23Z | 21:05:23 | `origin/worktree-...` reflog line 1 |
| Commit `2bf7ea4` (closing head) | 20:09:14Z | 21:09:14 | worktree reflog line 5 |
| Second push (carrying `2bf7ea4`) | 20:09:16Z | 21:09:16 | `origin/worktree-...` reflog line 2 |

- **Elapsed session: 561 minutes 29 seconds (9h 21m 29.3s)**, session start to closing head.
- **Git-observable span: 12 minutes 27 seconds.** First commit to last. **2.2% of the session.**
- **Worktree lifetime: 33 minutes 21 seconds.** **5.9% of the session.** Everything before 20:35 BST
  happened in the private tree with no repository involved at all.
- **Unpushed window: 8 minutes 36 seconds.** `8dc3773` existed only inside the worktree from
  19:56:47Z to 20:05:23Z.

### 2.2 Context and tokens

| Row | Value |
|---|---|
| Opening context reading | **UNESTABLISHED.** Not read from the instrument. The committed ledger says so at its own line 86. |
| Closing context reading | **UNESTABLISHED.** No file under `~/.mypka/governor/health/C--Fusion247PKA/` matches the short id `3d400a`; and the mapping between the displayed short id and the sampler's filename is itself unverified, so absence is not proof either way. |
| Total measured context movement | **UNESTABLISHED.** Requires both readings above. |
| Total deduplicated subagent token traffic (A) | **1,045,241** |
| Peak per persistent agent (B) | **738,341** (`a27289688929ad1ff`) |
| Dispatches / tool uses (C) | **14 / 392** |
| Host version | **UNESTABLISHED.** No health file for this session id to read it from. |

### 2.3 Per-specialist dispatch and usage

Taken from the committed ledger `Deliverables/2026-09-21-subagent-token-ledger-apps-and-opps-fork.md`,
which is Larry-transcribed and says so. Not re-derived here.

| Agent | Type | Dispatches | Tool uses | Tokens (basis) |
|---|---|---|---|---|
| `a27289688929ad1ff` | careerair | 12 | 368 | 738,341 (final cumulative) |
| `ad0c9c5f18c869305` | general-purpose, `fable` override | 1 | 12 | 158,404 (single dispatch) |
| `a2cabe61a3282d775` | general-purpose, `fable` override | 1 | 12 | 148,496 (single dispatch) |
| **Total** | | **14** | **392** | **1,045,241** |

**One agent carried 70.6% of all measured traffic and 93.9% of all tool uses.** The ledger's one
unresolved anomaly (return #6 reading below return #5 on a cumulative model) is carried forward as
unresolved and is not smoothed here either. Model for the careerair agent: **UNESTABLISHED**.

### 2.4 Evidenced allocation

Shares of **measured subagent token traffic** (A = 1,045,241). Not shares of wall clock, and not of
total session effort. Derived from the ledger's cumulative deltas, so the two rows spanning the
anomaly are less firm than the rest.

| Lane | Tokens | % of A | Basis |
|---|---|---|---|
| Operating the product (composing and submitting two applications) | 607,333 | **58.10%** | returns #1 to #10, cumulative through close-out |
| Assurance and evidence (two adversarial reviews) | 306,900 | **29.36%** | returns #13, #14 |
| Product implementation (reconciliation and role-shape build) | 131,008 | **12.53%** | returns #11 to #12, delta from #10 |
| Record, admin and governance | 0 measured | **0.00%** | Larry wrote the ledger and the command file himself, unmeasured |
| Corrective rework | **>= 87,653 (8.39%), floor** | | returns #3 and #8, both "rewrite after external review FAIL". Floor rises to 105,219 (10.07%) if return #4, the artefact row refused by the guard, is counted as rework |
| Waiting on Warwick | **UNESTABLISHED** | | No instrument records it. One weak bound exists and is not worth quoting |

**⛔ READ THE FIRST ROW CORRECTLY, BECAUSE THE PREVIOUS REPORT IN THIS SERIES SAYS THE OPPOSITE ABOUT
THE SAME ROW.** On 2026-08-19 "operating the product" was 17.63% and that report correctly called every
token in it a product failure, because the session's job was to *build* Asdair, not to *run* it. **Here
58.10% on that row is the session doing exactly what it was for.** The branch base commit `045c7c2`
states it in its own subject line: *"CareerAIR is the active frontier, and the goal is applications
going out, not a wired runtime."* A future reader comparing the two rows without this paragraph would
draw precisely the wrong conclusion.

### 2.5 Parent channel

| Row | Value |
|---|---|
| Available | **YES.** One send, `outcome: sent`, `exit: 0` |
| Sends in window | **1.** message_id 658, 641 bytes, 2026-09-21T11:03:39.911Z |
| Time from session start to availability confirmation | **15 minutes 55 seconds.** Rule 4a requires it at orientation and it happened inside the orientation window |
| Content | **UNESTABLISHED.** `ding-log.jsonl` records bytes, never bodies |
| Latency | **UNESTABLISHED.** No reply instrument exists |
| Queued messages | **UNESTABLISHED.** No queue instrument exists |

**One notification across a 561-minute session in which two live ATS submissions were made.** That is
not graded a Rule 4a failure and the reason is evidential rather than charitable: the durable records
of both submissions describe Warwick making decisions inside the act itself (`"Tick, go to next"` on
the Cornerstone NDA, the salary and email corrections, the discipline-stretch call). A notification
exists to reach a man who has put the phone down. He had not.

### 2.6 Work Orders

| Row | Value |
|---|---|
| Work Orders issued | **0** |
| Generated envelopes committed | **0.** `Deliverables/2026-09-*` contains exactly one file, the token ledger. The newest `wo-` file in `Deliverables/` is dated 2026-08-19 |
| First-dispatch success | **N/A.** No orders to measure |
| Amendments | **N/A** |
| Refusals | **0 worker refusals.** One database refusal (ledger return #4, "v2 artefact row refused by guard") which is a control working, not a worker declining |
| Read-backs observed | **1.** Ledger return #1, "CV work-order read-back, held" |
| Preventable failures | **1 prevented, 1 not.** See findings F4 and F6 |

### 2.7 Documentation versus product change

**In the Git range: 271 lines across 2 files in 3 commits. 100% documentation. 0 lines of product.**

| File | Lines | Class |
|---|---|---|
| `.claude/commands/careerair.md` | 184 | new, documentation and routine |
| `Deliverables/2026-09-21-subagent-token-ledger-apps-and-opps-fork.md` | 87 | new, record |

**Every line of product change this session landed outside version control**, in
`C:/.fusion247/private/careerair/`, which is deliberate under GL-012 and is not a defect. Whole-file
counts, because no diff was available:

| File | Lines | Status |
|---|---|---|
| `src/gate/prior-work.mjs` | 155 | new |
| `src/gate/role-shape.mjs` | 83 | new |
| `src/email/links.mjs` | 790 | modified, delta UNESTABLISHED |
| `src/journey/assessment-run.mjs` | modified at 485 to 494 | delta UNESTABLISHED |
| `runtime/applications/HOW-TO-APPLY.md` | 200 | modified, delta UNESTABLISHED |

**The ratio of record to product in Git is undefined because the denominator is zero.** That is a true
statement about where the work lives, not a criticism of it.

---

## 3. The CAPAE comparison

**Source: `C:/Users/Buggly/.mypka/governor/capae-opening.json`.** Present and readable.
`snapshot_at 2026-09-21T10:47:44.732Z`, content `written_at 2026-08-25T14:53:45.378Z`.
**Staleness at the moment it was frozen: 26 days, 19 hours, 53 minutes, 59.4 seconds.**

The cause is different from the last three rotations and it is worth naming precisely. Previous reports
found an **ordering** defect: the snapshot was taken before that rotation's own `capae-sync`. **This
time there is no ordering gap at all, because no rotation has populated since 25 August.**
`session-report-populate.jsonl` ends at `2026-08-25T14:53:24.632Z`, twenty seconds before the brief's
content was written, and carries no later entry. **The brief is not one sync behind. It is the last
sync there was.**

**And the guard would have fired this time.** `~/.mypka/governor/capae-brief.mjs:27` still sets
`STALE_AFTER_DAYS = 14`; line 151 computes `Math.floor(26.83) = 26`, and `26 >= 14` is true. The three
previous reports recorded that guard as structurally unable to detect the defect it exists for. On
these two timestamps it is arithmetically satisfied. **Whether it actually rendered is UNESTABLISHED**,
because SessionStart output is not durable.

### Family 1: `work-order-not-generated`

1. **What Larry was told.** Occurrences 7, state MONITORING, clean 0 of 5 required. Cause: *"The
   generation route is treated as exempt for orders that feel small, amendment-shaped, or urgent. The
   control exists, is known, and is skipped at the moment of dispatch."* Must: *"Generate the envelope,
   read it back, then issue. No exemption for small or amendment-shaped orders."*
2. **Exposure: `recurrence`.**
3. **What Larry actually did, from evidence.** Fourteen subagent returns are recorded in the committed
   ledger, twelve of them to one persistent agent whose work includes *"reconciliation built and
   proven"* at 48 tool uses. A repository-wide glob of `Deliverables/2026-09-*` returns **one** file,
   the ledger itself. A glob of `Deliverables/*wo*` returns 71 files, **none dated later than
   2026-08-19**. So: substantive bounded build work was dispatched twelve times against zero generated
   envelopes. Larry's stated reason, that a generated envelope wanted 26 authored slots, is
   **corroborated from the source rather than from him**: `tools/wo/envelope.mjs` lines 1089 to 1206
   emit exactly **26** `AUTHOR REQUIRED` markers (24 when `worktree` and `branch` are supplied, as they
   would have been here).
4. **Prevention held: NO.**
5. **Versus previous qualified exposure: no comparable prior exposure at the adjacent rotation**, which
   graded `none-this-session` on zero Work Orders and zero dispatches of this kind. Against the last
   comparable exposure in the series, 2026-08-19 at 11 of 11 generated and graded clean, it is
   **degraded**.
6. **Still repeating despite being in the starting context: YES.** It was the first family in the
   brief.

> **⚑ AND IT RECURRED IN A SHAPE THE PREVENTION DOES NOT COVER.** The brief's cause says the control is
> *"skipped at the moment of dispatch"*. That is not what happened. **The control was invoked, its cost
> was seen, and it was abandoned.** "Generate the envelope, read it back, then issue" has nothing to say
> about a generated envelope that is too expensive to author. **That is a gap in the must, not an excuse
> for the miss.** Recorded under the existing slug because the same prevention target addresses both;
> no new slug is minted.

### Family 2: `control-cannot-reach-what-it-checks`

1. **What Larry was told.** Occurrences 7, state **CHALLENGED**, clean 0 of 5. Cause: *"The convenient
   measurement is taken for the true one. A data structure that correlates with the outcome is easier to
   query than the outcome itself."* Must: *"Before trusting a control, make it fail on purpose. A check
   no test can fail is not a check."*
2. **Exposure: `recurrence`.** Three fresh instances, two of them found and closed inside the session.
3. **What Larry actually did, from evidence.**
   - **Found and closed, in shipped code.** `src/gate/prior-work.mjs:99-108`, verbatim: *"An earlier
     draft skipped it as 'itself' and the control silently never fired: opportunity 1620 (Medable)
     scored 8 and PROCEEDED with an application already on the row. A guard that makes the check pass by
     examining nothing is the failure this whole exercise exists to end."* That is the family, named as
     the family, caught before it shipped, by a worker.
   - **Found and closed, in shipped code.** `src/email/links.mjs:179-186`: across all 126 stored Indeed
     digests, `/rc/clk/dl` carried 357 URLs, 357 with a 16-hex `jk`, **206 distinct jobs**, while
     `/pagead/clk/dl` carried 759 URLs and **zero** with a `jk` of any shape. *"Before this rule existed
     those 126 messages produced exactly ZERO opportunities between 2026-08-28 and 2026-09-21, while the
     collector and the processor both reported healthy."* Health was measured through a surface merely
     correlated with the outcome, for twenty-four days, and the loss was silent.
   - **Open, and not noticed.** `scripts/build-application-ledger.mjs:42` reads
     `const [folder, status, why] = line.split('\t')` against `runtime/applications/LEDGER-SETTLED.tsv`.
     Rows 114 to 133 of that file, **twenty rows including both of this session's**, are eight columns
     and **date-keyed**, so `folder` resolves to `2026-09-16` through `2026-09-21` and matches no
     application folder that exists. The guard `if (folder && status)` passes, so nothing warns. The
     file's own line 3 states it is *"Read FIRST by scripts/build-application-ledger.mjs and beats every
     derived rule in it."* **That is untrue for twenty of its rows, silently.** Graded `non-blocking`:
     the live gate reads `careerair.application` in Postgres, not this file, so no current journey is
     misdirected.
   - **Minor, record and park.** `src/journey/assessment-run.mjs:489-490` comments *"A failure here must
     never silently re-open the gate, and must never be invisible"*, and the catch sets `blocked: false`,
     which does re-open it. It is loud (warning plus `error: true`), so the comment's word *silently* is
     honoured and its spirit is not.
4. **Prevention held: PARTIALLY, and better than the raw count suggests.** The must, *make it fail on
   purpose*, was executed twice on the session's own new code, and in both cases the failing case was
   written into the comment where the next reader will find it.
5. **Versus previous qualified exposure: improved.** 2026-08-19 recorded ten instances with *"prevention
   held: NO on breadth"*. Here two of three were caught and closed in-session, in product code.
6. **Still repeating: YES**, on the ledger parser.

### Family 3: `built-tested-never-activated`

1. **What Larry was told.** Occurrences 9, state MONITORING, clean 1 of 5. Cause: *"Integration is
   treated as complete at the point the code is committed and green. The activation surface is a
   separate step nobody owns."* Must: *"Do not report an integration done until the thing it was built
   to do has actually happened once."*
2. **Exposure: `clean`.**
3. **What Larry actually did, from evidence.** Every piece of product built today reached a real
   production event on the same day, and the artefacts are the production ones rather than test output.
   - **The repaired link rule ran through the scheduler, not a manual invocation.**
     `runtime/email-runs/careerair-email-2026-09-21-17-00.json`, `runRef
     careerair-email:2026-09-21:17:00`, `slot 17:00`, `status succeeded`, rendered
     `2026-09-21T16:06:13.567Z`: 4 messages processed, 8 new opportunities, 7 scored, 0 failures. A
     board was published at `runtime/board/careerair-email-2026-09-21-17-00.md`.
   - **The prior-work gate is wired into the live path, not parked beside it.**
     `src/journey/assessment-run.mjs:485-494` calls `checkPriorWork` and folds both it and
     `shape.shapeOk` into `proceedAfterPriorWork`, which is what the returned object's `proceed` is set
     from.
   - **It ran on a real advert and produced a real result.**
     `4468676759-cornerstone-ondemand/FORK-NOTES.md:16-34`: *"Re-application check: CLEAN, and it found
     something worth recording"*, checked on advert id, surfacing the 2026-09-01 Educe gate on the same
     product and then distinguishing it correctly from the advert body.
   - **Both applications reached an employer confirmation page, quoted.** Kingdom: *"APPLICATION
     COMPLETE. Thank you, your application has been successfully received by Kingdom"*, with
     `WorkEligible=True`, `FailedKillerQuestions=False`, `FailedQuestions=False`. Cornerstone: *"Thank
     you! Thanks for applying!"* with the URL advancing to the confirmation step. CV byte counts were
     checked before the click rather than asserted after it (251,126 and 251,444).
4. **Prevention held: YES.**
5. **Versus previous qualified exposure: improved.** The adjacent rotation graded `none-this-session`
   with zero repo commits. The last comparable exposure, 2026-08-19, was a recurrence with a late
   discharge at the close.
6. **Still repeating: NO.**

> **⚠ ONE QUALIFICATION, STATED BECAUSE IT IS THIS FAMILY'S OWN BAR.** The headline figure is a
> **recovery proof against stored bytes, not a production recovery.** 206 distinct jobs are proven
> *recoverable* from the 126 stored digests. The 17:00 production run created **8** opportunities. **The
> backlog has not been recovered and that is the outstanding half of this work.** The distinction is
> exactly the one the family exists to police, so it belongs in the clean grade rather than beside it.

### Family 4: `record-amended-body-not-recut`

1. **What Larry was told.** Occurrences 8, state MONITORING, clean 1 of 5. Cause: *"Amendment-by-append
   with no reconciliation step. Writing the amendment feels like completing the change, so the rows
   describing the phase are never revisited."* Must: *"Supersede the body, or do not append the
   amendment."*
2. **Exposure: `recurrence`.**
3. **What Larry actually did, from evidence.**
   - **Against.** `runtime/applications/LEDGER-SETTLED.tsv` lines 4 to 6 declare *"Three tab-separated
     columns: folder `<TAB>` status `<TAB>` why"* and a status vocabulary of *"SUBMITTED · REJECTED ·
     NOT-SENT-GATED · READY · WITHDRAWN"*. Rows 114 to 133 carry eight columns, key on a date, and use
     `INTERVIEW`, `STALE`, `PASSED`, `RESPONDED` and `DUPLICATE-DO-NOT-APPLY`. **The drift began at row
     114 on 2026-09-17, before this session. This session appended rows 132 and 133 in the divergent
     shape and did not re-cut the header.** Extending a contradiction is the family, in its mildest
     form.
   - **For, and it is substantial.**
     `4468099206-kingdom-services/APPLICATION-STATE.md:50-59` corrects two stored facts **in place**,
     with the superseded reading quoted and closed: *"The FORK-NOTES recorded this as an open
     contradiction to verify; it is now settled. Do not re-raise it."*
     `src/email/links.mjs:101-103` supersedes the module's own header in place: *"THE INDEED ALERT
     SENDER IS NO LONGER ON THAT LIST. It was named here as unevidenced, which was true when written."*
     That is the required behaviour, executed twice, unprompted, on the two records that were
     load-bearing.
4. **Prevention held: MIXED.** Held on both load-bearing product records. Failed on the ledger header.
5. **Versus previous qualified exposure: degraded.** The rotation immediately before this one graded
   this family **clean**, on exactly the "superseded in place, not appended-to" behaviour.
6. **Still repeating: YES**, on the ledger header.

---

## 4. Findings, against the leads rather than repeating them

### F1. The screen produced a reason and the board did not print it

**This is the most consequential finding in the report and it explains Warwick's own words.**

`runtime/board/careerair-email-2026-09-21-17-00.md`, the production artefact a human reads, carries
`Recommendation: apply` on:

- item 3, *Workday Advanced Compensation Architect/Consultant*, Kognitiv, 8/10
- item 5, *Software Solutions Project Manager (A12DD3B)*, Referment, 8/10, LinkedIn id **4468848313**
- item 6, *Workday Integrations Manager*, Cognizant, 7/10
- item 8, *Salesforce Delivery Manager*, Inardua, 7/10

`LEDGER-SETTLED.tsv:124` records **4468848313 as SUBMITTED on 2026-09-18**, three days earlier.
`src/gate/role-shape.mjs:24` matches `Workday` and `Salesforce` by name in the `named-platform` gate.

**The gates are not absent. They rank rather than bin, deliberately**, on Warwick's own 2026-08-29
amendment quoted at `role-shape.mjs:10-14`: *"I would much rather a prospect was scored too high and
became an opportunity than scored too low and binned."* A blocker is therefore *"a REASON carried
alongside the row, never a delete."*

**And the board template does not render the reason.** So on the page Warwick actually reads, a role
carrying a `named-platform` blocker is typographically identical to one carrying none. **A
rank-don't-bin screen whose reasons are invisible on the artefact the human reads is indistinguishable
from no screen at all.** That is the family `control-cannot-reach-what-it-checks` in its purest form:
the control reaches the row and does not reach the reader.

**UNESTABLISHED, and it matters:** whether `prior-work.mjs` and `role-shape.mjs` were live at
16:06:13Z. I cannot date the deployment without a shell. The finding stands either way, because if they
were live the reasons were dropped, and if they were not then the board was produced by the unscreened
path the session was built to replace.

### F2. The two CVs that were actually sent have no artefact row describing their bytes

**This is the one item on this page that needs Warwick.**

`migrations/017-careerair-cv-qa-review.sql:152-154` defines the CHECK constraint `cv_qa_review_no_fable`
with the comment *"Fable is excluded BY NAME (Warwick's standing hardlock + SOP Rule 2). Substring, not
equality, so no versioned variant passes."* Lines 225 to 307 define the trigger function
`cv_artifact_qa_chain_guard`, installed at 304 to 307 as
`cv_artifact_qa_chain_guard_trg before insert or update on careerair.cv_artifact`.

The session's two adversarial reviews were run **under an explicit `fable` model override that Warwick
authorised by name** (committed ledger, line 83). Both returned FAIL and both were actioned: ledger
returns #3 and #8 are *"rewrite after external review FAIL"*, and both sent CVs are recorded as the
post-rewrite versions (`APPLICATION-STATE.md:37`, `LEDGER-SETTLED.tsv:133`).

**The consequence, quoted from the durable record rather than inferred:** *"The `cv_qa_review` row and
the version 2 `cv_artifact` row remain BLOCKED by the `cv_qa_review_no_fable` CHECK constraint and the
`cv_artifact_qa_chain_guard` trigger, pending Warwick's ruling. Neither was attempted again.
Consequence to carry: `cv_artifact 290` still describes the pre-rewrite bytes, so no `cv_artifact` row
describes the file that was actually sent."*

**Graded honestly on both sides.** The control worked and was not worked around, which is the correct
behaviour and is the strongest single act of the session against family 2's `must`. And the standing
state is that **documents sent to two real employers today have QA provenance only in prose**, while the
schema built to carry that provenance refuses the reviewer Warwick chose. That is a genuine conflict
between an authorisation and a committed constraint, and it is his to settle.

This is **not** a hobby-brain escalation. It touches no credential, no money and no private exposure. It
is reported because it is the kind of gap that is invisible until somebody asks *which reviewer passed
the CV you sent*, and the answer is a sentence in a markdown file.

### F3. The abandoned envelope left nothing behind

Whatever `tools/wo/envelope.mjs` generated and Larry abandoned exists **nowhere in the repository**.
`Deliverables/2026-09-*` holds one file and it is the token ledger. Under this estate's own standard, a
read-back not written into the order file did not happen as far as any future session is concerned, and
the same applies here. **The decision to abandon may well have been right. The absence of any record of
it is not.**

### F4. The negative assertion and the two guards: the class is confirmed, the instance is not

The lead is that Larry asserted *"nothing blocks it"* having checked only CHECK constraints and missed
a trigger. **The surface genuinely carries two independent guards**, a CHECK constraint and a `before
insert or update` trigger, in the same migration, which is exactly the shape in which "I checked the
constraints" is an incomplete negative. The durable record names both. **Whether Larry made that
specific assertion has no artefact and is his disclosure alone.** What is established is that a worker's
catch, not Larry's check, is what stands in the record.

### F5. The relayed worker claim: no durable record found

Searched the private tree's application records, the committed range and the session's own artefacts.
**Nothing carries it.** The disposition is the same one the 2026-08-19 report reached on the 125-line
short merge: **the finding is the absence.** An error that survives only in a transcript is, by this
estate's own standard, indistinguishable from one that was never recorded. I do not dispute the account;
I could not corroborate it. **Single-source, flagged.**

### F6. The em-dash lead is partially refuted, and the scope conflict underneath it is the real item

**Measured.** `runtime/applications/HOW-TO-APPLY.md` is 200 lines and contains **7** em dashes, at lines
1, 17, 30, 49, 50, 57 and 149. **Lines 49 and 50 are the line that states the rule**: *"Run the
mechanical gate on the file bytes — em dashes 0, en dashes 0, smart quotes 0, forbidden patterns 0 —
and report MEASURED counts."*

**Refuted, in part.** The file is not under version control, so individual line ages cannot be
established. Six of the seven sit in the older body. **The only em dash inside a section this session
demonstrably added, line 149, sits inside a verbatim quotation of superseded text preserved on
purpose** (*"The superseded text, quoted so nobody reinstates it from memory"*). **"Twice in the
session" is UNESTABLISHED.** And the committed `/careerair` command file contains **zero** em dashes,
which is compliance rather than breach.

**The item worth carrying is the scope conflict.** The executable rule carries `applies_to=application`
and `src/writing/checks/punctuation.mjs:22-35` sets the maximum to zero **for application artefacts**,
with its own incident recorded at lines 3 to 6. But statement A-01 in
`canonical/tier1/warwick-careerair-writing-and-claims-rules.md:132` quotes Warwick as *"Anti-AI writing
pack applies to every artifact: no em dashes"*. **On the executable scope an internal rules file is not
in breach. On A-01's wording it is. Nothing reconciles the two**, and that is why this lead can be
argued both ways by two honest readers.

### F7. `206`, not `207`

The dispatch brief states the intake repair was proven *"0 to 207 recoverable"*. `src/email/links.mjs`
line 180 records the measurement as **206 DISTINCT jobs** from 357 URLs. **One apart, flagged and not
resolved.** It may be 206 Indeed plus one from another source; the artefact says 206 and the artefact is
what a future session will read.

### F8. The row counts I was asked to verify, and could not

The brief states `careerair.application` went **4 to 56** and `application_event` **0 to 16**. **This
dispatch has no database access and no shell. Neither figure is verified here.**

What corroborates a materially larger table, indirectly and without establishing any count: the Kingdom
record names `careerair.application` **119** and the Cornerstone fork notes name `application_id` **120**,
`cv_artifact 294` and `assessment_id 279`. **Those are sequence-allocated identifiers, not counts**, and
they are offered as consistency evidence only. No reconciliation script exists in `scripts/` under that
name, so the reconciliation appears to have been performed as ad-hoc SQL, which leaves no artefact
either. **Whoever next has a shell should re-run the two counts before the figures are quoted again.**

---

## 5. What went right, stated as plainly as the failures

- **Two applications out, both confirmed by the employer's own page, both quoted, both with CV byte
  counts checked before the click rather than asserted after it.** That is the session's stated goal and
  it was met.
- **Two adversarial reviews, both FAIL, both actioned into the bytes that were actually sent.** A
  reviewer that returns FAIL twice and changes the product twice is a reviewer earning its tokens, at
  29.4% of measured traffic.
- **An intake channel that had been silently yielding nothing for twenty-four days was found, measured
  against real stored bytes, and repaired with the deliberate refusal recorded beside the rule**:
  `/pagead/clk` is left unmatched and counted, with the reason written down, rather than widened into a
  duplicate storm.
- **The prior-work module encodes both failure directions.** It blocks the same advert, warns on the
  same employer, and refuses fuzzy employer matching with the reason on the page: *"'EY' once scored
  against 'Keyloop', and 'Apex Systems' is a different company from 'apexanalytix'."*
- **`/careerair` refuses to be a platform.** Its own text: *"This is a WRAPPER over scripts that already
  exist. Do not build a service, a store, a register or a new screen. If you find yourself writing one,
  you have misread this file."* Under a standing regrowth cap that has been breached before, that is the
  right instinct written into the artefact.

---

## 6. Open questions

1. **`fable` is authorised as a reviewer and refused by name in the schema.** Which moves: the
   authorisation, the constraint, or neither, with provenance staying in prose? **Warwick's, and the
   only one on this page that is.**
2. **Is `scripts/build-application-ledger.mjs` still live?** If it is, twenty settled rows are invisible
   to it. If it is dead, the TSV's line 3 should say so. Either fix is one line; choosing between them
   is not mine.
3. **Were `prior-work.mjs` and `role-shape.mjs` live at 16:06:13Z?** Not answerable without a shell, and
   it decides which of F1's two readings is the true one.
4. **206 or 207.**
5. **Opening and closing context.** Fourth consecutive rotation with no opening reading; first in the
   series where the closing one is also missing.

## 7. Recommendations, and no mechanism is proposed for any of them

- **Print the blocker reasons on the board.** F1 is a rendering gap, not a screening gap. The reasons
  already exist on the row.
- **Re-cut the header of `LEDGER-SETTLED.tsv` to the shape twenty of its rows already use**, or split
  the two shapes into two files. Supersede the body, or do not append.
- **When an envelope is abandoned, commit the abandoned envelope.** The record of a decision not taken
  costs one file and is the difference between a judgement and an absence.
- **Do not build a Work Order generator that authors itself.** The 26-slot cost is real and the
  regrowth cap applies at full force. If the number is wrong, the fix is fewer required fields, decided
  once by Warwick, not a tool that fills them in.

---

**Method.** Git figures read from `C:/Fusion247PKA/.git/worktrees/build-careerair-reconciliation/logs/HEAD`,
`.../COMMIT_EDITMSG`, `.../ORIG_HEAD`, `.../CLAUDE_BASE`, `.../locked`,
`C:/Fusion247PKA/.git/refs/heads/worktree-build-careerair-reconciliation`,
`.../refs/remotes/origin/worktree-build-careerair-reconciliation` and its reflog. Unix seconds converted
against the anchor `2026-09-21T00:00:00Z = 1789948800`, derived from `2026-01-01T00:00:00Z = 1767225600`
plus 263 days. Governor figures from `capae-opening.json`, `ding-log.jsonl`,
`session-report-populate.jsonl` and `capae-brief.mjs`. Product evidence read directly from the declared
private surface `C:/.fusion247/private/careerair/**`, read-only, no writes, nothing quoted that carries
a credential. Subagent usage taken from the committed ledger and not re-derived.

**Independence.** Same model, separate context, separate dispatch, no access to Larry's transcript.
Not external verification, and nothing here should be read as such.
