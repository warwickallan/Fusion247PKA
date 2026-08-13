---
title: "Session performance/process report — BUILD-015 AsdAIr, overnight: vision final, Cockpit convergence, and the 39-line list"
date: 2026-08-13
author: Pax
build: BUILD-015 AsdAIr
session_range: "4e6508d7dea0a990b1ed1a97a2a31e5db0378443 → 80b5cd3b70949fcdf2637ad24e94799ce0f2dbb8"
session_window: "2026-08-12T17:00:58Z (CAPAE opening brief written) → 2026-08-13T06:55:18Z (ledger commit 6723dfa)"
branch: main
governance_head: 6723dfaf6b84ccc1c8175263cf5a29225e2cdcb7
status: >
  Commissioned per root CLAUDE.md Rule 4a and the /rotate skill (steps 5–7c). NOT on Larry's blocking
  path to rotation. A session cannot be its own sole witness; this report exists to be the other one.
inputs_read:
  - "Deliverables/2026-08-13-subagent-token-ledger-overnight-asdair-list.md (6723dfa) — Larry's ledger, supplied as input"
  - ".git/logs/HEAD (975 entries) — the local reflog, read directly"
  - ".git/logs/refs/remotes/origin/main (161 entries) — the push record, read directly"
  - ".git/logs/refs/heads/build-015/{b15-28-agentic-vision-prototype-v2,b15-25-cockpit-backend,b15-26-cockpit-ui}"
  - "~/.mypka/governor/capae-opening.json (snapshotted 2026-08-12T17:17:56Z, BEFORE anything could overwrite it)"
  - "~/.mypka/governor/ding-log.jsonl (the real send log)"
  - "Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md (top block + ACTIVE SESSION WORK PACKAGE)"
  - "Deliverables/2026-08-13-overnight-morning-report.md"
  - "tools/session-report/{populate.mjs,capae-sync.mjs} — payload contracts read from source, not assumed"
  - "Deliverables/2026-08-12-session-report-asdair-vision-pipeline.md — the prior session's report, for trend"
tooling_limitation: >
  This dispatch's tool grant is Read/Write/WebFetch/WebSearch/Grep/Glob — no Bash, no git binary.
  Every commit, push and timing fact below was read directly out of `.git/logs/**`, which is the
  same data `git reflog` and `git log -g` render; it is primary evidence, not Larry's account.
  What CANNOT be obtained this way is diff content: line counts, file lists and `--stat` figures are
  marked UNESTABLISHED rather than estimated.
---

# Session performance report — BUILD-015 AsdAIr, 2026-08-12/13 (overnight)

## Headline verdict

**The product outcome is real and the process moved in two directions at once.** A known 39-line
photograph went through the production modules and came out as 39 products / 53 items / brand-sorted /
31 shoppable / 8 held, with accounting that closes (47 observations, 47 accounted) and an anti-phantom
mechanism that caught 3 of 3 measured inventions while losing 0 of 39 real lines. Two families of
operating defect closed clean, one of them decisively: **`work-order-not-generated` — which recurred at
the first opportunity last session — is clean across 10 orders and 7 amendments this session**, and
notification substance improved roughly ninefold against the exact defect this report raised last time.

Against that: **first-dispatch order quality collapsed from ~73% to 30%**, and the dominant cause is not
process compliance but **factual accuracy — five premises Larry wrote into his own Work Orders were false,
and one of them had already been reported to Warwick as fact before the worker falsified it**. A
review-gated constitutional change reached the public remote **10m 28s before its independent review
returned HOLD**, confirmed against the push log. And the map went **5h 43m across four completed work
packages with no commit at all**, which resets the CAPAE family that was one clean exposure from closing.

**The single most important correction in this report is to Larry's own account of his worst moment.** He
reported the review-gate stacking recurrence as happening "an hour after writing himself a note about it."
The reflog says **17 minutes 02 seconds**. His self-assessment was too generous to himself by a factor of
about 3.5 — and, separately, the recurrence was *partial*: the stacking habit repeated, the premature push
did not. Neither of those is knowable from inside the session.

---

## 1. Session identity — and a drift worth one line

| | |
|---|---|
| Session start | `4e6508d7dea0a990b1ed1a97a2a31e5db0378443` — 2026-08-12T17:03:26Z |
| CAPAE opening brief written | 2026-08-12T17:00:58Z |
| Declared closing head | `80b5cd3b70949fcdf2637ad24e94799ce0f2dbb8` — 2026-08-13T06:52:04Z |
| Governance head (ledger) | `6723dfaf6b84ccc1c8175263cf5a29225e2cdcb7` — 2026-08-13T06:55:18Z |
| **Elapsed** | **834 minutes (13h 54m)**, opening brief → ledger commit |
| Vision + Lane A | `build-015/b15-28-agentic-vision-prototype-v2` → `df18e64c6a1f581892d912487e0c08c6a1d2d29b` (2026-08-13T01:04:43Z) |
| Cockpit backend | `build-015/b15-25-cockpit-backend` → `fc1fe165ee75018a47e5a0569319a24d6a156765` (2026-08-13T00:37:32Z) |
| Cockpit UI | `build-015/b15-26-cockpit-ui` → `8a2fabfa5bd05328d9297130f74dfdb4faee412a` (2026-08-13T00:37:35Z) |

**Drift, minor, recorded not escalated:** at the time of this audit `origin/main` stood at
`32c6ade23cafc8aee563ef2c3812ba81a3bbe71f` — **two commits beyond the declared closing head** and one
beyond the governance head. The commission asked for exactly one session identity; the record already
carried three candidate heads before this report added to it. `80b5cd3` is used throughout as instructed.

---

## 2. Commit volume — documentation versus product, measured

Read from `.git/logs/HEAD` (main) and the three branch reflogs, filtered to commits at or after the
session-start timestamp.

| | Count | Notes |
|---|---:|---|
| **Record commits on `main`** (`4e6508d`..`80b5cd3`) | **34** | Wayfinder updates, Work Orders, Veritas receipts, ground-truth data, one `AGENTS.md` contract change |
| Plus the ledger (`6723dfa`, after the declared closing head) | 1 | **35 record commits total** |
| Abandoned on `main` | 1 | `88682bf` "Rescue the 39-line photo ground truth into Git" — `reset --hard HEAD~1` at 17:46Z; see §7 |
| **Product commits, `b15-28`** (vision + Lane A) | **18** | plus one `--amend` (`91d16f8`→`54c3b0b`) and one merge that was reset away |
| **Product commits, `b15-25`** (Cockpit backend) | **3** | |
| **Product commits, `b15-26`** (Cockpit UI) | **2** | |
| **Product commits total** | **23** | |
| **Pushes to `origin/main`** | **23** | |

**Record : product commit ratio = 35 : 23 = 1.52 : 1.** Against 10 numbered Work Orders that is roughly
3.5 record commits per work package — one order document, one dispatch note, one result, one correction.
**Fact:** `main` carries **zero product-code commits** this session; all product code lives on the three
feature branches. **Opinion, labelled as mine:** 1.52 : 1 is proportionate for a session with 10 work
packages, 7 amendments, 2 Veritas receipts, a contract redline and a rescued dataset. **The defect is not
the ratio. It is the hole in it** — see §7.

**UNESTABLISHED:** line counts, files-changed and `--stat` figures for every commit above. No Bash, no
diff access. `doc_lines_changed` and `product_lines_changed` are emitted as null, not guessed.

---

## 3. Work Order evidence — the seven upheld read-backs, and what they actually mean

**Ten numbered orders** were issued: `WO-2026-08-12-01` … `-06` and four `WO-2026-08-13-0x` orders
(WP-B15-34 vision-final, -35 Cockpit backend, -36 Cockpit UI, -37 Lane A). Every one of the seven
challenge events below is evidenced by a contemporaneous commit — Larry's words, but written at the
moment of the event, each naming a specific defect, not a retrospective summary.

| # | Commit | Time (UTC) | What the read-back found | Class |
|---|---|---|---|---|
| 1 | `657a943c…` | 8/12 18:22:31 | **REFUSE** on WO-2026-08-12-01 — *"correct on all four counts"* | Scope/method (4 defects) |
| 2 | `fcde2e05…` | 8/12 19:58:52 | *"the photograph is ROTATED, and horizontal bands would have made it worse"* | **Unverified physical premise** |
| 3 | `1d91f595…` | 8/12 20:41:45 | *"my order could not have reached its own stated outcome"* | **Premise falsified (logic)** |
| 4 | `6fbc82be…` | 8/12 21:11:47 | *"the Richmond discrepancy does not exist, and never did"* | **Premise falsified (fact)** |
| 5 | `0e84894a…` | 8/12 22:12:11 | *"two premises in my own order were false, **and one I gave Warwick**"* | **Two premises falsified** |
| 6 | `30384bc3…` | 8/12 22:55:42 | *"two of my three defects were already fixed or unfixable"* | **Premise falsified (state)** |
| 7 | `ea12b3d9…` | 8/12 23:47:45 | AMENDMENT 1 to WP-B15-35 | Scope/method |

**First-dispatch clean rate: 3 of 10 = 30%.** Prior session, by my own measurement: ~11/15 ≈ 73%.
**Order quality fell by roughly 43 percentage points.**

### The question Larry cannot answer about himself: healthy control, or unhealthy authorship?

**Both, and the split is measurable — but the honest answer is that the authorship number is the one
that matters, and it is bad.**

Sort the seven by what was found. **Three** (#1, #2, #7) are scope, surface and method defects: genuinely
hard-to-foresee coupling, exactly what a read-back gate exists to catch, and catching them is the gate
working. **Four orders carrying five falsified premises** (#3, #4, #5×2, #6) are something else entirely.
A falsified premise means Larry wrote a **factual assertion into a directive document without checking
it**, and in every one of those four cases the falsifying evidence was already in the repository at the
moment he wrote it.

**Three reasons "7 of 7 upheld = healthy control" is the wrong reading:**

1. **A gate that fires on 100% of its inputs is not discriminating.** It never saw a clean order to pass.
   At that rate the read-back is not a check on authorship; it is a second author, performed by the
   worker, at the worker's token cost.
2. **The gate does not protect Warwick, and #5 proves it.** *"Two premises in my own order were false,
   and one I gave Warwick."* The read-back fired **after** the false claim had already been reported
   upward. A control that catches an error only once it has left the building is not covering the
   exposure that matters most.
3. **It is expensive in the one currency this estate actually spends.** 27 dispatches to 15 agents means
   **12 resume events, 44.4% of all dispatches**, and the ledger attributes every resume to an amendment
   round-trip after a read-back found a defect in Larry's own order. Nearly half the dispatch budget went
   to repairing orders rather than doing work.

**The favourable half, stated with equal force, because a flattering report and a punitive one are equally
useless:** all seven were **upheld** — Larry did not argue with a single one, and two of the amendments
(#3, #5) are Larry recording in his own commit message that his order's premise was void. That is
genuinely good conduct under correction, and it is why the session still produced a working list.

**The actionable form:** the defect is not "write better orders." It is one specific, checkable habit —
**every numeric or state premise in an order is re-derived on the current instrument at the moment of
writing, or it is labelled unverified inside the order.** Four of five falsified premises would have died
at that step. Proposed family `order-premise-not-verified` (§9).

### Credit where the record shows it

- `6c148208…` (8/12 20:55:02) — *"Fix WO-2026-08-12-03: second identical UNRESOLVED slot missed, order now
  ready"*. **Larry caught this one himself, before dispatch.** It is the only pre-dispatch self-catch in
  the session and it belongs in the count.
- `3f1a7fcf…` (8/12 23:43:55) — *"G-7: the envelope table printed the standing default while the
  frontmatter deviated"*. Larry found a defect **in the Work Order generator itself**, not merely in an
  order. That is auditing the control rather than obeying it.

---

## 4. CAPAE family comparison — all four families in the opening brief, six questions each

Source: `~/.mypka/governor/capae-opening.json`, `written_at` 2026-08-12T17:00:58Z, snapshotted
17:17:56Z. **`capae-active.json` was deliberately not used for the comparison** — it is rewritten every
rotation and would judge Larry against a warning he never received. Evidence below is commits, pushes,
timestamps and the log files; **Larry's own account is used only where it is a contemporaneous commit
message, and is labelled where it is.**

### ⭐ EXECUTIVE CAPAE — Warwick's shape

> **Two clean, two not.** The Work Order envelope discipline you have been waiting five sessions to see
> hold, **held** — 10 orders, 7 amendments, not one skipped the route, and Larry audited the generator
> itself. Measurement discipline **held** and killed his own idea with his own instrument. Against that:
> he shipped a fix for your permission complaint that **could not work in the session that shipped it**,
> because that config only loads at startup — a fact already written down in this build's own map. And
> the map itself went **5h 43m and four finished work packages with no entry**, which knocks the
> record-keeping family back to zero when it was one exposure from closed. **Two families improved, one
> is unchanged, one degraded. The thing that got worse is the thing that was nearly fixed.**

### Family 1 — `work-order-not-generated` · exposure: **`clean`**

1. **What Larry was told.** 4 occurrences, clean streak **0** of 5 required, state MONITORING. Cause:
   *"the generation route is treated as exempt for orders that feel small, amendment-shaped, or urgent."*
   Must: *"Generate the envelope, read it back, then issue. No exemption for small or amendment-shaped
   orders."*
2. **Qualified exposure.** **`clean`.** Ten orders and seven amendments — abundant opportunity.
3. **What Larry actually did, from evidence.** Every order carries a canonical generated identifier:
   `488b61fb…` — *"WO-2026-08-12-01 (WP-B15-29): coverage plus grounding, **generated envelope**,
   ready"*; then `-02` (`d363a3af…`), `-03` (`6c148208…`), `-04` (`ff13eeb7…`), `-05` (`b14240af…`),
   `-06` (`41c83dfd…`), `WO-2026-08-13-04` (`4cccb3f1…`). **The exemption the family names is the one
   that did not occur:** seven amendments were issued this session and not one was refused for a missing
   envelope. Two commits go beyond compliance — `6c148208…` is Larry running the check on his own order
   pre-dispatch and finding a defect, and `3f1a7fcf…` is Larry finding a defect in the generator's own
   output table.
4. **Did the prevention hold?** **Yes**, and past the letter of it.
5. **Versus the previous qualified exposure.** **Improved.** Last session this family recurred on the
   *first* orders dispatched, immediately after being placed in Larry's starting context, and the
   prevention was re-established only by the workers refusing. This session it never fired. Streak 0 → 1.
6. **Still repeating despite being in the starting context?** **No.** This is the family's first clean
   exposure in five recorded occurrences.

### Family 2 — `built-tested-never-activated` · exposure: **`recurrence`**

1. **What Larry was told.** 5 occurrences, clean streak **0** of 5, MONITORING. Cause: *"integration is
   treated as complete at the point the code is committed and green. The activation surface is a separate
   step nobody owns."* Must: *"Do not report an integration done until the thing it was built to do has
   actually happened once."*
2. **Qualified exposure.** **`recurrence`.**
3. **What Larry actually did, from evidence.** `ea12b3d9…`, 2026-08-12T23:47:45Z — *"AMENDMENT 1 to
   WP-B15-35, **and stop asking Warwick for push permission**."* The remedy was a host-loaded permissions
   configuration change. **Host config loads once, at session start.** This is not a subtle fact and it
   was not unknown: the active map already records the identical mechanism at its line 3171 —
   *"`.claude/settings.json`, committed at `674c8a7` — **takes effect next session, not this one**"* — and
   the estate's own memory carries "Host-loaded config needs a RESTART." The fix was committed and
   reported; **it prevented zero permission prompts in the session that shipped it**, and Warwick had to
   issue the instruction a second time.
   **Counter-evidence, and it is strong.** Migration 020 is this family's exact raw shape — built, proven
   against real PostgreSQL 17.4, committed, never applied. Here the prevention **held**: Larry attempted
   the activation, a safety classifier declined, **he did not route around it**, and he made it the single
   named item requiring Warwick in both the morning report and the map's next-action block, with
   *"No acceptance is claimed — no production photograph event was exercised"* stated in terms.
4. **Did the prevention hold?** **Split, and the split is the finding.** It held on the high-consequence
   case — a live schema change on Warwick's database while he slept — and failed on the low-consequence
   one, where a remedy was reported as delivered while inert.
5. **Versus the previous qualified exposure.** **Unchanged.** Clean streak stays at 0. What changed is
   the *location*: the failure has migrated out of product code and into Larry's own operating
   configuration, which is harder to see and has no worker read-back standing in front of it.
6. **Still repeating despite being in the starting context?** **Yes** — with the aggravation that the
   inertness mechanism was already written down in this build's own map and in the estate's memory
   *before* the fix was made. This is not a lesson unlearned; it is a lesson recorded and not applied at
   the moment of action.

### Family 3 — `control-cannot-reach-what-it-checks` · exposure: **`clean`**

1. **What Larry was told.** 3 occurrences, clean streak **3** of 5 — the closest of the four to EFFECTIVE.
   Cause: *"the convenient measurement is taken for the true one."* Must: *"Before trusting a control,
   make it fail on purpose. A check no test can fail is not a check."*
2. **Qualified exposure.** **`clean`**, with four independent instances rather than an absence of failure.
3. **What Larry actually did, from evidence.**
   - `40ea646f…` — *"Correct the WP-B15-30 result table: the figures I reported were **stale-instrument
     output**."* A whole published result table retracted because the instrument moved under it.
   - `bdf8f307…` — *"WP-B15-31 step 1: **re-score every stored arm on the current instrument**, stale
     figures retained and labelled."* The correct generalisation: not "fix the wrong number" but
     "re-measure every number", keeping the stale ones visible instead of deleting the evidence.
   - `16db301c…`, 2026-08-12T23:16:16Z — *"WP-B15-34 AC1: the positional field **COSTS DETECTION** and
     loses — default flipped OFF."* **Larry's own authorised mechanism, measured through a controlled
     comparison and killed by it**: −14.8% lines per band call at permutation p = 0.0127, and its claimed
     anti-phantom benefit falsified in the opposite direction (5.7% invention in the *best*-resolved bands
     against 1.5% in the worst, both phantoms from the best band). A control was made to fail on purpose
     and it failed.
   - Vera's correction, carried in the map in her words: Larry reported *"a detector was broken and
     reporting success"* — **false**; the gate was loudly red and **nobody had executed it**, including
     under Vera's own earlier PASS, which she named as her own defect. The recorded lesson is the family's
     must, almost verbatim: *"a reported count is never evidence; the reviewer runs the gate."*
4. **Did the prevention hold?** **Yes**, repeatedly, and against Larry's own preferred conclusions —
   which is the only version of this that counts.
5. **Versus the previous qualified exposure.** **Improved / clean continuation.** Streak 3 → 4. **One
   clean exposure from EFFECTIVE.**
6. **Still repeating?** **No** — with one honest asymmetry worth naming: this family is clean precisely
   where the session concentrated its attention, while the *same underlying instinct* (asserting a figure
   without re-deriving it) survived untouched in Work Order authorship, where this family's control does
   not reach. See §3 and the proposed family in §9.

### Family 4 — `record-amended-body-not-recut` · exposure: **`recurrence`**

1. **What Larry was told.** 3 occurrences, clean streak **4** of 5 — **one clean exposure from closing.**
   Cause: *"amendment-by-append with no reconciliation step. Writing the amendment feels like completing
   the change, so the rows describing the phase are never revisited."* Must: *"Supersede the body, or do
   not append the amendment."*
2. **Qualified exposure.** **`recurrence`.**
3. **What Larry actually did, from evidence.** The closing commit is the confession, in his own
   contemporaneous words: `80b5cd3` — *"**Re-cut the map to the real post-overnight state: it was five
   work packages stale**."* The reflog gives the shape precisely. The last map commit before the morning
   report is `4cccb3f1…` at **2026-08-13T00:34:07Z**; the next is `80469625…` at **06:17:23Z**. **A
   5h 43m 16s window with no map commit at all.** Inside it, three of the four lanes reached their final
   heads — `fc1fe16` (00:37:32Z), `8a2fabf` (00:37:35Z), `df18e64` (01:04:43Z) — and WP-B15-34, -35, -36
   and -37 all completed. The map's own START/RESUME contract says *"Update this map only at meaningful
   phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer."* **Four boundaries passed
   unrecorded.** For that window the frontier rows described a state four work packages behind reality,
   and had the session been lost mid-overnight a fresh Larry would have oriented off exactly that.
   **Counter-evidence, and it is substantial.** Where amendments *were* written, the discipline is close
   to exemplary — the map carries explicit `⛔ SUPERSEDED` / `⛔ CORRECTED` headers with forward pointers
   at lines 2320, 2391, 2465, 2515, 2521, 2621, 2629, 2830, 2976 and 3256, including the model instance:
   *"the paragraph below was CONFOUNDED and is superseded by the correction under it. It is retained
   because the correction is only legible beside the claim it repairs."* **The failure is not
   amendment-by-append. It is batching** — the re-cut was correct, complete and honest, and arrived once,
   at the end, instead of at each of four boundaries.
4. **Did the prevention hold?** **Not at the boundaries that mattered.** It held perfectly for every
   amendment Larry wrote, and failed for the four boundaries at which he wrote nothing.
5. **Versus the previous qualified exposure.** **Degraded.** This is the only family to move backwards.
   It stood at 4 clean, one exposure from EFFECTIVE; the streak resets to 0.
6. **Still repeating despite being in the starting context?** **Yes, in a widened form.** The named cause
   is amendment-by-append; the observed cause is *no append at all* for 5h 43m. **The same prevention —
   "supersede the body" — addresses both**, which is the family test, so this is a widening of an existing
   family and not a new one.
   **The reading I considered and rejected, stated so Warwick can overrule me:** during an authorised
   autonomous overnight run, batching the map re-cut is defensible efficiency, Larry *did* re-cut it before
   rotating, and he flagged the staleness himself rather than concealing it. I rejected it because the
   map's purpose at those boundaries is resumability after an *unplanned* loss, and that purpose is
   defeated by a re-cut that only happens if the session survives to perform it. **This is a judgement, not
   a measurement, and it is the one finding in this report Warwick could reasonably reverse.**

**Net CAPAE picture: 2 clean · 1 unchanged · 1 degraded.** The uncomfortable pattern is that the family
that moved backwards is the one that was nearly closed, and the family that closed clean is the one that
failed most embarrassingly last session. Attention moves; it does not accumulate.

---

## 5. The review-gated push — measured against the push log, and Larry's account corrected

This is item 3 of the four things Larry could not grade himself on. It is fully evidenced from two
independent files: `.git/logs/HEAD` and `.git/logs/refs/remotes/origin/main`.

**Event 1 — the constitutional change reached the public remote before its review returned.**

| Time (UTC) | Event | SHA |
|---|---|---|
| 8/12 21:08:42 | Keel's `AGENTS.md` contract change committed | `8d9b8c95227caf1e1175c62378eea7e9d37aa02e` |
| 8/12 21:11:47 | **Unrelated WP-B15-31 amendment stacked on top** (+3m 05s) | `6fbc82be6815dc983c27160a0f329dd3f14790be` |
| **8/12 21:13:06** | **`update by push` → `origin/main` carries both** | push log line 147 |
| 8/12 21:23:34 | **Veritas returns HOLD on the amendment** | `f320b1353c3ca18e68b76516ebd92750d01fdc5f` |

**The change was public on GitHub for 10 minutes 28 seconds before its independent review returned HOLD.**
Larry reported this himself and Veritas found it independently and graded Git truth FAIL — both correct.
The mechanism is the stacking: once `6fbc82b` sat on top of `8d9b8c9`, the held commit was no longer the
tip and reverting it stopped being a one-line operation.

**Event 2 — Larry's own account of the recurrence is wrong in his own favour.**

| Time (UTC) | Event | SHA |
|---|---|---|
| 8/12 21:25:44 | F1 fix committed (awaiting confirmation) | `9d672b309623442471b575f363b607b198ecf98d` |
| 8/12 21:31:43 | **Unrelated WP-B15-30 table correction stacked on top** (+5m 59s) | `40ea646fa99dc60304b394330f9bd68bc97dfd52` |
| 8/12 21:35:29 | Veritas F1 confirmation: DISCHARGED, PASS | `ffcb702ca82709b0ff8589111fb9409687dd3977` |
| 8/12 21:36:01 | `update by push` — **after** the verdict | push log line 148 |

**Two corrections to Larry's own report, both material:**

1. **The interval was 17 minutes 02 seconds, not "an hour."** `8d9b8c9` at 21:08:42Z → `9d672b3` at
   21:25:44Z. **His self-assessment was too generous to himself by a factor of ~3.5**, and the true figure
   is worse: the recurrence happened while the first incident was still open, not after a cooling period.
2. **The recurrence was partial, and the half that improved is the half that mattered.** The *stacking*
   repeated. The *premature push* did not — the second time, Larry held the push until the verdict landed,
   21:35:29Z verdict → 21:36:01Z push, 32 seconds later. **The outward, irreversible half of the failure
   was corrected within the session; the local half was not.**

**Assessment (opinion, labelled):** this is a genuine partial improvement that Larry's own account
erased by describing the recurrence as total. It is also not fixed — the working habit that produced both
events is "keep committing on the current branch while a verdict is outstanding," and only the push
discipline was patched. Proposed family `review-gated-change-pushed-early` (§9).

**Proportionality note (HOBBY BRAIN rule, applied):** the exposure is 10m 28s of a governance document
being public on an already-public repository. **No credential, no financial account, no household data, no
irreversible action.** This is reported for the process finding, **not escalated**, and no Work Order is
recommended.

---

## 6. Notification discipline (Rule 4a) — a large improvement and one real defect

**The real send log**, `~/.mypka/governor/ding-log.jsonl`, entries 183–200, filtered to this session's
window (2026-08-12T17:00:58Z → 2026-08-13T06:55:18Z):

| | |
|---|---:|
| Send attempts | **18** |
| Delivered (`exit:0`) | **16** |
| Failed | **2** |
| Queued | **0** |
| Byte range | 745 – 3,364 |
| **Mean delivered size** | **~2,475 bytes** |

### The improvement, credited plainly

Last session I found **4 sends averaging 269 bytes** across ~15 orders, and flagged them as terse pings
rather than substantive outcome reports. This session: **16 sends averaging ~2,475 bytes** — **4× the
message count and ~9× the content per message**. That is a direct, measurable response to the exact
finding, and it is the clearest process improvement in this report. **Parent channel availability: GOOD.**
Both failures are caller-side, not channel-side; nothing queued; no delivery gap attributable to transport.

### Owed-and-not-sent: none found. Sent-for-routine-narration: none found.

The 16 sends are distributed across the session's genuine decision and outcome points, and the
**7h 19m 24s silence between 22:57:06Z and 06:16:30Z is correct, not a miss.** Warwick was asleep, the
overnight mission was authorised, and the standing memory rule ("NEVER ding just to check in — it costs
him money and attention on a phone even when he can't act on it") forbids exactly the status ping that
window would otherwise have produced. The blocker discovered in that window — migration 020 declined by a
safety classifier — was not actionable at 03:00 and was delivered at 06:17. **This is Rule 4a applied
well, including the hard part, which is staying silent.**

### ⚠️ The defect: the highest-stakes message of the session was rejected, and the retry lost 46% of it

| Time (UTC) | Outcome | Bytes |
|---|---|---:|
| 2026-08-13T06:16:30 | **`telegram-rejected` — `http 400: Bad Request: message is too long`** | **5,139** |
| 2026-08-13T06:17:03 | `sent`, message_id 524 | **2,771** |

This is the morning report — the message carrying *"MIGRATION 020 IS COMMITTED BUT NEVER APPLIED... The
whole four-way provenance model has nowhere to live"*, the one item in the entire session requiring
Warwick. **The first attempt was rejected against Telegram's 4,096-character limit. The successful retry
is 2,368 bytes smaller — 46% of the intended content did not reach the phone.**

- **What survived is UNESTABLISHED.** The log records byte counts and outcomes, never bodies. I cannot
  determine whether the migration-020 item survived the shortening.
- **The structural risk is real:** in the Git deliverable that item is **section 8 of 8, at the very end
  of the document** — the first thing a length-driven truncation removes.
- **The transport has no size guard.** `ding.mjs` failed loudly (good — this is not a silent failure) but
  there is no pre-send length check and no chunking, so recovery depends entirely on the sender noticing
  the non-zero exit and rewriting. **A Rule 4a-critical path with an unguarded hard limit is a defect in
  the one mechanism the rule exists to guarantee.**
- **Second failure, minor:** entry 184 at 17:21:42Z, `usage-message-file-unreadable` / `ENOENT` — a
  caller-side "no message file supplied" condition, not a channel fault.

**Recommendation, and it is deliberately small:** a length check plus chunk-or-refuse in `ding.mjs`.
**No Work Order.** Under the HOBBY BRAIN rule this does not meet the escalation bar — but it is the one
finding in this report I would fix opportunistically, because it degrades the channel Warwick relies on to
be able to put the phone down.

---

## 7. Two further evidenced findings

**(a) The ground-truth data flip-flopped three times in 90 minutes, including a history reset.**
`88682bf` (17:39:46Z) *"Rescue the 39-line photo ground truth into Git, labelled honestly as unverified"*
→ `reset --hard HEAD~1` at 17:46:03Z → `04b1825` (17:46:59Z) *"Recover the 39-line photo truth to the
**PRIVATE** store, not the public repo"* → `676157c` (17:52:05Z + push at 17:57:48Z) *"Put the 39-line
ground truth **back in the open**, where Warwick says it belongs."* Three positions on where household
data lives, settled only by asking Warwick. **The handling was correct** — the cautious position was taken
first, the reset happened before any push, and the reversal came from Warwick's own instruction rather
than Larry's convenience. **Recorded as evidence of good instinct under an ambiguous rule, not as a
defect.** It is worth noting only because it consumed three commits and a history reset to answer a
question a single line in `GL-012` or the personal-data memory could have settled up front.

**(b) Assurance coverage of this session's product output is zero, and Larry declared it.** Two Veritas
dispatches ran, both against the **contract amendment** boundary (HOLD `f320b13`, then DISCHARGED/PASS
`ffcb702`). **No Veritas gate was sought on WP-B15-34, -35, -36 or -37** — the map says so in terms:
*"Assurance owed and NOT met, recorded as a finding rather than papered over... Nothing overnight is
accepted, and no completion is claimed."* Vera's CONDITIONAL PASS covers the Cockpit UI alone.
**This is the correct handling of an omission** — the omission is declared, no completion is claimed, and
the next session inherits an accurate picture. The omission nonetheless stands, and 0 of 4 overnight work
packages carry an assurance verdict.

**Worth saying plainly, because it is the opposite of the failure this estate has been correcting:**
assurance consumed **10.2% of subagent token traffic** this session (§8). The measured 4B incident that
prompted the whole Veritas commissioning rule was **57.7% of a working phase producing zero product
change**. This session's problem is the other tail, and it is the safer tail to be on — but "under-gated
and honest about it" is still under-gated.

---

## 8. Token and context economics — measured, three totals kept apart

From `Deliverables/2026-08-13-subagent-token-ledger-overnight-asdair-list.md` (`6723dfa`). Its own
provenance caveat travels with these numbers: **Larry-transcribed from each `Agent` return's `<usage>`
block, not independently instrumented.** The cumulative-vs-per-dispatch test was re-run this session, not
inherited: `subagent_tokens` monotonic across 9 of 9 resumed agents; `tool_uses` **falsified four times**
(`nolan` 15→19→8; `keel/WP-B15-31` 42→56→39; `keel/WP-B15-35` 34→164→56; `felix` 206→31). Tokens
cumulative, tool-uses per-dispatch — confirmed, not assumed. **A naive sum inflates the total by ~58%
(6,027,922 vs 3,818,356).**

| Total | Figure | What it is |
|---|---:|---|
| **A — traffic** | **3,818,356 tokens** | Deduplicated subagent token traffic, 15 agents |
| **B — peak footprint** | 431,674 / 407,991 / 368,544 / 333,298 | Largest four persistent agents (`keel/WP-B15-30`, `felix`, `keel/WP-B15-35`, `keel/WP-B15-34`) |
| **C — dispatch/tool** | **27 dispatches · 15 agents · 1,608 tool uses** | Mean 1.8 dispatches/agent; 9 of 15 resumed; 59.6 tool uses per dispatch |

**A, B and C are not blended, and Larry's own context is not added to A** — occupancy is a level, traffic
is a flow, and Larry's figure is not read from an instrument. No ratio between them is asserted.

**Gateway spend is a separate, independently measured quantity and is NOT a token figure:** ~$2.61 vision
+ ~$1.02 variance + ~$0.43 + ~$0.05 probes ≈ **$4.11**.

### Evidenced allocation — by subagent token traffic, and it sums exactly

| Category | Tokens | Share of A |
|---|---:|---:|
| **Implementation** (asdair, keel ×7, felix) | 3,074,263 | **80.5%** |
| **Assurance** (veritas ×2 = 256,662; vera = 134,190) | 390,852 | **10.2%** |
| **Reconnaissance / audit** (general-purpose ×2) | 219,148 | **5.7%** |
| **Contract admin** (nolan) | 134,093 | **3.5%** |
| **Total** | **3,818,356** | **100.0%** |

**Rework, measured on a different denominator and deliberately not blended into the table above:
12 of 27 dispatches (44.4%) were resume events**, and the ledger attributes every resume to an amendment
round-trip following a read-back defect in Larry's own order.

**⛔ The limit of this allocation, stated rather than smoothed.** It measures **delegated** effort only.
**Work Order authorship, all map maintenance, all 35 record commits, every rework decision and all waiting
ran inside Larry's own context, which no instrument in this estate reads.** So *"Work Order admin, rework
and waiting as a share of TOTAL session effort"* is **UNESTABLISHED**, and the honest statement of the gap
is this: **the entire administrative and rework burden of this session is invisible to every measurement
the estate currently has.** That, not any number above, is the real finding in this section.

**Elapsed:** 834 minutes. **Wall-clock per-dispatch durations are deliberately not summed** — the ledger
records heavy overlap across three parallel lanes, so a sum would misrepresent elapsed time. Waiting time
is therefore **UNESTABLISHED**.

---

## 9. Proposed new families — for Warwick's naming decision, not auto-created

`capae-sync.mjs` reports and **skips** an unrecognised slug by design (*"naming a new family is a judgement
about cause, and a judgement is not a script"*). These three are therefore carried in the payload as
ordinary findings **without a `family` field**, so nothing is invented. They are proposals.

1. **`order-premise-not-verified`** — *Larry writes a factual premise into a Work Order without
   re-deriving it from evidence he already holds.* **5 falsified premises across 4 orders this session;
   one had already been reported to Warwick as fact.** Prevention: every numeric or state premise in an
   order is re-derived on the current instrument at the moment of writing, or is labelled unverified
   inside the order. *This is the single highest-value candidate in this report.*
2. **`review-gated-change-pushed-early`** — *a change awaiting an independent verdict becomes public
   because a later commit is stacked on it and the branch is pushed.* Prevention: a commit awaiting a
   verdict stays the branch tip until the verdict lands, or it lives on its own branch. **The push half was
   corrected within the session; the stacking half recurred 17m 02s later.**
3. **`notification-transport-has-no-size-guard`** — *the Rule 4a channel rejected the session's
   highest-stakes message and the retry dropped 46% of it.* Prevention: assert the message fits before
   sending; chunk rather than shorten. **Lowest-cost fix in this report.**

---

## 10. Explicit UNESTABLISHED

- **Line counts, files-changed and `--stat` figures for every commit.** No Bash/git binary this dispatch;
  `.git/logs/**` carries SHAs, messages and timestamps but no diff content. Emitted as null, not estimated.
- **Whether the migration-020 item survived the 2,771-byte morning-report retry** (§6). The ding log
  records bytes and outcomes, never bodies.
- **The literal content of all 16 delivered notifications** — sizes and timestamps only.
- **Warwick's second, angry permission instruction** (item 4 of the commission). The *inert-fix mechanism*
  is well evidenced (`ea12b3d9…` plus the map's own line 3171 and the estate memory); the *two-orders,
  second-time-angrily* sequence is **Larry-reported and not independently verifiable** from any artefact
  available to this dispatch — there is no transcript in my grant.
- **"Waiting" as a share of session effort** — per-dispatch durations overlap across three parallel lanes
  and the ledger explicitly forbids summing them.
- **Larry's own context occupancy** — not read from any instrument, and correctly excluded from total A.
- **Whether the 7 upheld read-backs represent a complete list of challenges** — I can evidence 7 from
  commit messages; a read-back that found nothing leaves no commit, so the *denominator* of clean
  read-backs is inferred from the 10-order count, not directly observed.
- **Independent verification of the ledger's per-agent token figures.** They are Larry-transcribed; I
  verified their internal arithmetic (the four category subtotals sum to 3,818,356 exactly) but no tool
  reproduced them.

---

## 11. Recommendations — evidence and options; the decisions are Warwick's

1. **Adopt `order-premise-not-verified` as a CAPAE family.** It is the session's dominant defect,
   it has a one-line prevention, and 4 of 5 instances would have died at that step. *(No new mechanism —
   this is a naming decision, not a build. The regrowth cap applies.)*
2. **Add a length check to `ding.mjs`.** Trivial, and it protects the one channel Rule 4a depends on.
3. **Treat the `record-amended-body-not-recut` grading as reversible.** It is the one judgement call in
   this report; if Warwick reads batched overnight map maintenance as acceptable, the exposure becomes
   `clean` and the family closes at 5/5. **I recommend `recurrence`** for the resumability reason in §4,
   but I flag it rather than settle it.
4. **Nothing here warrants a Work Order.** No finding is an ACTIVE, in-scope `BLOCKS_CURRENT_MERGE` issue
   requiring material implementation. Under the HOBBY BRAIN rule, none meets the escalation bar either.
   Record, park, fix (2) opportunistically.

---

*Prepared by Pax. Method: primary-source first — the reflog, the push log and the send log were read
directly rather than through Larry's narrative, and every load-bearing claim in §§2, 3, 5 and 6 is
verifiable against a named file and timestamp. Where only Larry's contemporaneous commit message
evidences a claim, it is labelled. Where nothing evidences it, it is in §10.*

---

## 12. ADDENDUM — the `--stat` figures Pax could not reach. **Measured by Larry, and labelled his, not Pax's.**

Pax emitted every line-count field as `null` rather than estimating it, and named the reason: that
dispatch's grant carried no Bash and no git binary, and `.git/logs` holds SHAs, messages and timestamps
but no diff content. I have a shell. These are the missing numbers.

**Measured 2026-08-13 by `git diff --shortstat`, against the same session range Pax declared**
(`4e6508d` → `80b5cd3` on `main`; each product branch against its own merge-base). The payload's
`null`s are left as they are — it has already been written to `session_report.*` under rotation id
`6c0e97a0-9af3-4be9-8c81-b298055e074a`, and re-running `populate.mjs` would mint a second row rather
than correct the first. This section is the record.

| Surface | Files | Insertions | Deletions |
|---|---:|---:|---:|
| **`main` — the record** | 22 | 5,475 | 28 |
| ├─ documentation (`*.md`) | 19 | **5,232** | 24 |
| └─ non-markdown | 3 | 243 | 4 |
| **Vision + Lane A** (`b15-28-…-v2`) | 121 | 131,859 | 87 |
| ├─ generated run evidence (`agenticVisionPrototype/runs/*`) | 31 | **105,041** | 0 |
| └─ source, excluding generated evidence | 85 | **20,479** | 87 |
| **Cockpit backend** (`b15-25`) | 27 | **3,484** | 27 |
| **Cockpit UI** (`b15-26`) | 6 | 1,729 | 289 |
| └─ code only (`.js`/`.mjs`/`.html`/`.css`) | 4 | **1,441** | 289 |

### What these figures change, and what they do not

**They invert the impression left by the commit-count ratio, and that is the useful part.** Pax measured
`record_to_product_ratio: 1.52` — 35 record commits against 23 product commits — which reads as a session
that documented itself more often than it built. **By volume it is the other way round: 5,232 documentation
lines against ~25,404 lines of hand-authored product source across the three branches, a ratio of about
1 : 4.9.** Documentation dominated commit *frequency*; product dominated commit *content*. Both figures are
true and neither is the whole picture — which is why the ratio belongs beside the commit count, not
instead of it.

**105,041 of the vision branch's 131,859 insertions are machine output** — 31 frozen run JSONs from the
variance, WP-B15-33 and WP-B15-34 arms. That is evidence, deliberately committed so the measurements
Warwick's rulings rest on can be re-derived rather than believed. **It is not work, and any figure that
counts it as work is wrong by a factor of five.** The single largest file is a 9,224-line run record.

**⚠️ The limit, stated rather than left implied: line counts are not effort, and I am not offering them as
effort.** The 20,479-line source figure includes generated fixtures and test scaffolding I have not
separated out, and says nothing about the eight held lines, the two money defects caught, or the
positional-field ruling the measurement killed — which is where the session's actual value sits.
`allocation_rework_pct` and `allocation_waiting_pct` remain **UNESTABLISHED** on purpose; nothing here
touches them, and Pax's warning against blending denominators stands unchanged.

*Larry, 2026-08-13. Discharges `unestablished` item 1 only. The other seven remain open, including the
one that matters most — whether the migration-020 item survived the truncated morning-report retry.*
