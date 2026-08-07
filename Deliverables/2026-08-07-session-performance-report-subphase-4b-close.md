# Session performance report — Sub-phase 4B CLOSE

**Written by Pax.** A session cannot be its own sole witness.

| | |
|---|---|
| **Session date** | 2026-08-07 |
| **Branch** | `build-020/phase4-automation-law` |
| **Worktree** | `C:\Fusion247PKA-build-020-trial` |
| **Host session id** | `e1a5349f-4c7d-4ce4-bb91-f2ea51224e07` *(established by execution — the session-id key under which the governor health store holds this session's telemetry, and the evidence-workspace id recorded in Veritas's own `ecfd38f` receipt frontmatter)* |
| **Opening head** | `c0cf334ae6bbc9e34edd08da1de0f30807938a68` — committed `2026-08-07T10:26:31Z` (`11:26:31 +0100`) |
| **CLOSING HEAD** | **`4bf04e29febf3c009baa23e73a50f118ecfe1a24`** (`4bf04e2`) — committed `2026-08-07T20:32:26Z` (`21:32:26 +0100`) |
| **Range** | `c0cf334..4bf04e2` — **51 commits** |
| **Active map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` |
| **Payload** | `Deliverables/2026-08-07-session-report-payload-subphase-4b-close.json` |
| **Prior report in series** | `Deliverables/2026-08-07-session-performance-report-subphase-4b.md` (head `7ba504a`) |

**Method and its limit.** Pax had **no `Bash`** — no `git`, no `gh`, no CI API, no process table, no ability to diff. **And no figures were supplied in the dispatch.** Every quantity below was read directly from an instrument on disk:

- the worktree reflog at `C:\Fusion247PKA\.git\worktrees\Fusion247PKA-build-020-trial\logs\HEAD` — heads, commit subjects and **exact commit timestamps**;
- the governor health store at `~/.mypka/governor/health/C--Fusion247PKA-build-020-trial/<session-id>.json` — context telemetry;
- the transport log at `~/.mypka/governor/ding-log.jsonl` — every notification attempt;
- the eleven committed Veritas receipts, the Work Order commit record, the sanitised Vex boundary record, the post-merge closeout and the active map.

**Nothing here is estimated.** Where a quantity could not be read from an instrument it is marked **UNESTABLISHED** and left null. All UTC times are derived from the reflog's epoch seconds. Two figures in the dispatch brief are corrected against the record, and one of Warwick's own seven hypotheses is **partly disconfirmed** — those are marked plainly.

**Same-estate review — not independently verified.** Pax is a specialist of the team whose session is reported, dispatched by its subject, running in the same runtime. Veritas's `ecfd38f` review ran under the *same host session id* as this dispatch. This is structurally weaker than external review.

**Publication constraint honoured.** This repository is public. No attack detail, probe shape or bypass mechanism from the security review appears here; the sanitised record is `Deliverables/2026-08-07-cockpit-private-api-boundary-record.md`.

---

## Executive summary

Three sentences.

**One:** the session ran **9 h 26 m 31 s of committed activity** and produced **51 commits, of which 9 (17.6 %) carry product implementation and 14 (27.5 %) are Veritas gate receipts or their direct repairs** — more commits spent on gate verdicts and their repair than on the product itself.

**Two:** **eleven Veritas verdicts were returned — ten Gate 1 and one Gate 2 — and not one was a PASS.** Seven Gate 1 FAILs, three Gate 1 HOLDs, one Gate 2 FAIL, against a **declared assurance ceiling of 2,080,000 tokens**.

**Three:** Warwick's headline claim — *every Gate 1 FAIL was documentation, not engineering* — is **true of five of the seven FAILs and false of the first two**, and that distinction is the most useful finding in this report: **the assurance loop found two real product defects at its first verdict and none at any of the ten that followed.**

---

## 1. Session identity, established by execution

The closing head was **not** supplied as a 40-character SHA and was not assumed. It was read from the final entry of the worktree reflog:

```
2bb8aa72… 4bf04e29febf3c009baa23e73a50f118ecfe1a24 … 1786134746 +0100
        commit: docs: BUILD-020 post-merge operational and estate closeout — one record
```

`C:\Fusion247PKA-build-020-trial\.git` is a **file**, not a directory (`gitdir: C:/Fusion247PKA/.git/worktrees/Fusion247PKA-build-020-trial`), and `HEAD` there is `ref: refs/heads/build-020/phase4-automation-law`. Branch, worktree and closing head all reconcile.

**51 commits.** The reflog holds 52 entries in range; one (`28b06df → 28b06df`) is a no-op self-checkout, not a commit.

---

## 2. Elapsed time — measured

| Measure | Value | Basis |
|---|---|---|
| **Committed-activity span** | **9 h 26 m 31 s** (566.5 min) | first in-range commit `072979e` @ `11:05:55Z` → closing head @ `20:32:26Z` |
| Span from the opening head's own commit time | **10 h 05 m 55 s** (605.9 min) | `10:26:31Z → 20:32:26Z` |
| Wall-clock session length (context open → `/clear`) | **UNESTABLISHED** | no instrument records session start |
| Waiting / idle time | **UNESTABLISHED** | no instrument measures it |

Commit timestamps come from the reflog and are exact. **They bound activity, not attention** — a gap between commits is not evidence of work or of waiting, and no such inference is made anywhere below.

---

## 3. Context and token readings — one figure recovered, one structurally unrecoverable

Read from `~/.mypka/governor/health/C--Fusion247PKA-build-020-trial/e1a5349f-4c7d-4ce4-bb91-f2ea51224e07.json`:

| Field | Value |
|---|---|
| `sampled_at` | **2026-08-07T21:04:24.427Z** — 32 min after the closing head |
| `source` | `statusLine` |
| **`total_input_tokens`** | **833,500** |
| `context_window_size` | 1,000,000 |
| **`used_percentage`** | **83** (17 % remaining) |
| `total_output_tokens` | 155 |
| `rate_limits.five_hour.used_percentage` | 6 |
| **`rate_limits.seven_day.used_percentage`** | **68** |
| `version` | **2.1.221** |
| `model` / `effort` | `claude-opus-5` / `high` |

| Mandatory output | Value |
|---|---|
| **Closing context reading** | **833,500 input tokens · 83 % of a 1,000,000 window · 17 % remaining** — MEASURED |
| **Opening context reading** | **UNESTABLISHED** |
| **Total measured movement** | **UNESTABLISHED** |

**Why the opening reading is not merely missing but structurally unrecoverable.** The health store keeps **one file per session id and overwrites it on every statusline refresh**. It is a latest-sample store, not a series. By the time any report is written the opening value has been destroyed. **The `/rotate` contract requires "token/context evidence read from the instrument, never estimated", and for the opening figure the instrument cannot satisfy that requirement after the fact.** This is the third consecutive report in this series to record opening context as UNESTABLISHED. *Recorded as evidence only; no fix is proposed — Warwick has forbidden solving 4C before rotation, and this belongs to that examination.*

**The one cross-session consumption figure available.** The previous session (`d049def8`, last sampled `10:30:34Z`) read **seven-day allowance 62 %**; this session reads **68 %** at `21:04:24Z`. **+6 percentage points of the seven-day allowance across the interval.** Measured from the same instrument at both ends. *Caveat stated rather than buried: the interval includes the tail of the previous session, so 6 points is an upper bound on this session's share.*

**`total_output_tokens: 155` is not used as a cost anywhere.** The map already records this field as an open question (§15, *"implausibly low… suggesting it is per-turn or per-sample rather than cumulative"*). It is reported because it was read, and it is relied on for nothing.

**Host version discrepancy, recorded once and parked:** the instrument reports host **2.1.221**; root `CLAUDE.md` reasons about **2.1.222**. Non-blocking, clerical, no effect on any figure here.

---

## 4. Per-specialist dispatch counts and token usage

**Token usage per specialist: UNESTABLISHED.** No figures were supplied, and no subagent token ledger exists in any committed artefact for this range. Unlike the prior report — where Larry supplied thirteen measured return-event figures — **there is no measurement to verify.** It is not estimated here.

**Dispatch counts, from the committed record only (a floor, not a total):**

| Specialist | Dispatches evidenced | Evidence |
|---|---|---|
| **Veritas** | **≥ 11** | eleven committed receipts, each frontmatter naming its own per-dispatch review ceiling |
| **Keel** | **≥ 4** | named as executing WO-30 (`relativeImports()` on both forms), WO-31, WO-32 (the `PROPFIND` measurement), WO-33 (five proofs about QA sequencing) |
| **Vex** | **2** | RED @ `443d0fa`; re-verification GREEN @ `3254c69` |
| **Mack** | **≥ 1** | `TOWER_EVIDENCE_REPO_DIR` established by execution, properties only, without exposing a value |
| **Pax** | **1** | this report |
| WO-29's worker | **not named** | neither the commit record nor the execution-log row names the worker |
| **Total** | **≥ 19** | exact count **UNESTABLISHED** |

**Declared assurance ceiling — measured, and the strongest honest cost figure available.** Read from the eleven receipt frontmatters:

| Ceiling | Receipts | Subtotal |
|---|---|---|
| ≤ 250k | `3e4c9d9`, `275ec07`, `443d0fa`, `3254c69`, `07aa166` (Gate 1) — 5 | 1,250k |
| ≤ 200k | `07aa166` (Gate 2) — 1 | 200k |
| ≤ 150k | `b62a9fc` — 1 | 150k |
| ≤ 120k | `19fc792`, `30666f1`, `3a1e670`, `ecfd38f` — 4 | 480k |
| **Total declared** | **11 dispatches** | **2,080,000 tokens** |

**A ceiling is an authorised maximum, never a measurement of consumption.** Actual assurance consumption is **UNESTABLISHED**. What the figure does establish is the size of the envelope Larry authorised for eleven verdicts that returned **zero PASS** — and every receipt records its ceiling as *"not extended"*.

---

## 5. Evidenced allocation

**Time-based allocation across product / admin / assurance / rework / waiting: UNESTABLISHED.** No instrument measures it.

**Commit-count allocation across the full range — measured, by conventional-commit type read from the reflog:**

| Category | Commits | Share |
|---|---|---|
| `docs(*)` / `docs:` — map, receipts, evidence, records | **30** | 58.8 % |
| `wo(*)` — Work Order envelopes and amendments | **11** | 21.6 % |
| `gov(CLAUDE.md)` — constitutional redline | **1** | 2.0 % |
| **`feat` / `fix` / `test` / `ci` / WO implementation — PRODUCT** | **9** | **17.6 %** |
| **Total** | **51** | 100 % |

**Of the 42 non-product commits, 14 are Veritas gate receipts or their direct repair commits — 27.5 % of the entire session, and more than the 9 product commits.**

**Limit of this measure, stated:** it counts commits, not lines. A one-line `ci(` commit and a 400-line check script each count once. **Line-level doc-versus-product volume is UNESTABLISHED** — Pax cannot diff.

---

## 6. Documentation-versus-product change volume across the complete session range

| Metric | Value |
|---|---|
| Files changed | **UNESTABLISHED** |
| Insertions / deletions | **UNESTABLISHED** |
| Doc insertions / product insertions | **UNESTABLISHED** |
| **Commit-subject split (measured proxy)** | **42 documentation/order/governance : 9 product = 82.4 % / 17.6 %** |

For contrast, the prior session in the same Sub-phase measured **32.5 % documentation by line** across 34 commits. **The direction reversed hard inside one Sub-phase.** That comparison is directionally sound but not like-for-like — one is a line measure, one a commit measure — and it is quoted nowhere else in this report as a ratio.

**The four-hour tail.** The last product-code commit is `4c557818` (WO-32) at **`16:32:14Z`**. The remaining **4 h 00 m 12 s** of the range contains **14 commits and not one product-code change**: six Veritas gate verdicts, the constitutional redline, the merge record, the post-merge operational closeout, the 4C evidence preservation and the asdair evidence canonicalisation. *Real operational work happened in that window — the live migration, the Tower re-alignment and the estate cleanup — and it landed as one record rather than as code. The window is not idle; it is uncommitted-as-product.*

---

## 7. Parent-channel availability, and the notification finding

Read at source from `~/.mypka/governor/ding-log.jsonl`. In-range sends (between the opening and closing head commit times):

| id | timestamp (UTC) | outcome | exit | bytes |
|---|---|---|---|---|
| 364 | 10:30:15.703Z | sent | 0 | 1,623 |
| 365 | 11:31:39.571Z | sent | 0 | 1,252 |
| 366 | 11:59:09.838Z | sent | 0 | 1,977 |
| 367 | 13:16:41.161Z | sent | 0 | 1,780 |
| 368 | 14:37:14.407Z | sent | 0 | 3,174 |
| 369 | 14:52:26.734Z | sent | 0 | 2,156 |
| 370 | 15:32:01.671Z | sent | 0 | 2,472 |
| 371 | 15:43:48.577Z | sent | 0 | 2,988 |
| 372 | 15:55:48.299Z | sent | 0 | 2,599 |

| Mandatory output | Value |
|---|---|
| Sends | **9** — ids **364–372, contiguous, no gap** |
| Transport success | **9 / 9, exit 0** |
| Failures / usage errors | **0** |
| **Queued Warwick messages** | **0** measurable — every invocation returned `sent`, exit 0 |
| Mean payload | **2,224.6 bytes** (prior session: 1,847.9 — **up 20.4 %**) |
| Parent-channel response latency | **UNESTABLISHED** — the log is outbound-only |
| **Last send** | **15:55:48Z** |
| **Silence to the closing head** | **4 h 36 m 38 s** |

*The prior report's boundary-orphan defect did not recur: ids 364–372 are contiguous and 363 was claimed by the prior report.*

### 7.1 Notification misses — sends owed and not made

Rule 4a's written criteria name, verbatim: *"a gate verdict, a merge, a significant failure, a recovery, `SAFE TO CLEAR`."* Measured against the transport log, **after the last send at `15:55:48Z` the following Rule-4a-named events occurred, with zero sends:**

| Event | Commit | Time (UTC) | Rule 4a category |
|---|---|---|---|
| **Veritas Gate 2 @ `07aa166` — FAIL** | `f54c4e2` | **17:09:42Z** | gate verdict |
| **Veritas Gate 1 @ `07aa166` — FAIL** | `b62a9fc` | **17:16:43Z** | gate verdict |
| **Veritas Gate 1 @ `b62a9fc` — FAIL** | `9413d89` | **17:39:48Z** | gate verdict |
| **Veritas Gate 1 @ `30666f1` — FAIL** | `3a1e670` | **18:05:52Z** | gate verdict |
| **Veritas Gate 1 @ `3a1e670` — HOLD** | `ecfd38f` | **18:26:08Z** | gate verdict |
| **Veritas Gate 1 @ `ecfd38f` — HOLD** | `28b06df` | **18:43:00Z** | gate verdict |
| **PR #97 MERGED** | `b2af412` | **19:49:12Z** | **merge** |

**Seven Rule-4a-named events. Zero sends.** Measured, not inferred: the transport log records **failures as well as successes** — it carries two `exit 4` usage errors earlier in its history — so absence from the log means `ding.mjs` was not invoked.

**And the sharpest measured fact in this report.** Commit `30666f1` at **`17:53:46Z`** is the Warwick-authorised redline strengthening Rule 4a to *"SEND, then post, then CONTINUE."* **In the 2 h 38 m 40 s between that redline landing and the closing head, three gate verdicts and one merge occurred, and not one notification was sent.** The rule was strengthened and the channel got quieter.

This is a **second, independent instance of exactly what Warwick recorded as the CAPAE evidence** — *"the correction was CORRECT, PRESENT and CANONICAL, and the behaviour regressed anyway"* — except that his instance was established from Larry's turn behaviour and this one is established from a transport log Larry does not author.

**What this report does NOT claim.** Whether Warwick was at the keyboard is **UNESTABLISHED**; he plainly authorised the merge, so he knew of it. Rule 4a's criteria are not conditioned on his presence, and the ordering rule ("SEND, then post") explicitly is not. **Whether any of the seven was genuinely owed in context is Warwick's to rule; that seven named-category events passed with zero sends is a measurement.**

**No instrument can rule on content.** The log records bytes and timestamps only. **Whether any of sends 364–372 was routine narration is UNESTABLISHED** — only Warwick reading them can answer it.

---

## 8. Veritas — eleven verdicts, zero PASS

Read from receipt frontmatter (`verdict:` field), ordered by the commit that banked each:

| # | Gate | Reviewed head | Banked (UTC) | Verdict | Rows 1/2/4 | What carried the verdict |
|---|---|---|---|---|---|---|
| 1 | 1 | `3e4c9d9` | 11:31:14Z | **FAIL** | all HOLD | *(functional rows not yet passing)* |
| 2 | 1 | `275ec07` | 13:16:14Z | **FAIL** | all HOLD | *(functional rows not yet passing)* |
| 3 | 1 | `443d0fa` | 14:37:39Z | **FAIL** | 2 PASS · 4 PASS · 1 HOLD | *"carried by **D-1 (with D-2)** … an active-map statement pointing a fresh Larry at descoped work … the engineering is in materially better condition than at either previous head"* |
| 4 | 1 | `19fc792` | 14:53:41Z | **HOLD** | — | *"the first head in this Sub-phase at which… nothing points a fresh Larry toward closed or superseded work"* |
| 5 | 1 | `3254c69` | 15:42:57Z | **FAIL** | — | *"the engineering is sound and the security repair is real… **but the active Wayfinder does not know it happened** and would send a fresh session to do it again"* |
| 6 | **2** | `07aa166` | 17:09:42Z | **FAIL** | *(phase journey)* | separate receipt |
| 7 | 1 | `07aa166` | 17:16:43Z | **FAIL** | — | *"the delivered engineering is sound… the FAIL is carried by the **active map and its companion record failing, again, to know what the last two Work Orders and the live-runtime change did**"* |
| 8 | 1 | `b62a9fc` | 17:39:48Z | **FAIL** | **all PASS** | *"carried entirely by **E-1**: the active map's statement of its own assurance standing is false in every clause"* |
| 9 | 1 | `30666f1` | 18:05:52Z | **FAIL** | **all PASS** | *"carried entirely by **E-1**: one unconverted row, in different words"* |
| 10 | 1 | `3a1e670` | 18:26:08Z | **HOLD** | **all PASS** | six document-currency findings |
| 11 | 1 | `ecfd38f` | 18:43:00Z | **HOLD** | **all PASS** | **two findings, both labelled `non-blocking`**, one of them *inside the previous repair* |

**Measured: 7 Gate 1 FAIL · 3 Gate 1 HOLD · 1 Gate 2 FAIL · 0 PASS.**

### 8.1 Two corrections to the brief, both against the record

1. **The brief and the map say "nine Gate 1 verdicts". There are ten.** All ten `2026-08-07-veritas-gate1-subphase-4b-*-receipt.md` files were committed inside this session's range, and **Veritas states it independently at `ecfd38f`: *"All ten Gate 1 receipts and both Gate 2 receipts are present on disk."*** The map's own CAPAE corroborating-facts block (`:2420`) undercounts by one. Non-blocking, recorded once.
2. **The brief says "two Gate 2 verdicts". One Gate 2 receipt was committed in this range** (`07aa166`, FAIL). The second Gate 2 receipt on disk is `2026-08-06-veritas-gate2-phase4-f0d2614-receipt.md`, from the previous day. Both statements are defensible at different scopes; the **in-range measurement is one**.

### 8.2 Veritas correcting its own verdicts — verified, twice

- **`19fc792` — a verdict upgraded from FAIL to HOLD** on re-grading the same class.
- **`ecfd38f` — an explicit self-reversal, in its own words:** *"I am correcting my own prior grading, and it matters that a successor can see it. At `3a1e670` I made `codex_qa_started` the **sole carrier** of a `Completed automation` HOLD on this gate. **Under my own contract's scope ceiling that was a widening past the accepted rows that I did not record as a widening.** Warwick's ordering does not rescue a bad verdict — it exposes one I should have caught by reading my own scope clause."*

**That second one is a reviewer catching itself breaching its own scope ceiling and saying so in the receipt. It is the strongest single piece of evidence in this session that the assurance function is honest, and it should not be lost inside a report about assurance being expensive.**

---

## 9. **The claim Warwick asked to be tested — and where it is wrong**

> *"Every Gate 1 FAIL in this Sub-phase was DOCUMENTATION, not engineering."*

**Verdict: TRUE of five of the seven FAILs. FALSE of the first two. And the exception is the most useful finding here.**

**True, and quoted at source, for FAILs 3, 5, 7, 8 and 9** — see the table above. In each, Veritas records the engineering as sound or improving and names a *statement in the map about the map* as the carrier. Four of those five (`443d0fa`, `07aa166`, `b62a9fc`, `30666f1`) returned with functional rows PASSING.

**False for FAILs 1 and 2.** At `3e4c9d9` and `275ec07` the functional rows **1, 2 and 4 were themselves HOLD**, and those two verdicts produced **two Work Orders against real defects**:

- **Veritas Defect 5 → WO-29.** The render gate the order cited could not see the System area. On integration the map records the decisive line: *"under the null-collapse mutation, **3 of 54 RED | pre-existing detectors fired in 0 scenario(s)** — drop the `rrHas` guard and `rrInt(null)` renders `"0"` because `Number(null) === 0`; template compiles, nothing throws, **and the old check passed**."* **Warwick's own Unknown / not-established / 0 distinction was collapsing inside the gate built to catch it.** That is a product defect.
- **Veritas Defect 6 → WO-30.** In the map's words: *"**The defect was worse than 'unportable'**: a Cockpit started from any other checkout **silently borrowed the live clone's dependency tree AND its live production credentials** — it did not fail, it **connected**, with credentials it had never declared. **Row 1's 'survives worktree delete/recreate' was passing only because a stray checkout quietly reached into the live clone.**"* That is a product defect with a credential-handling consequence, and it was invalidating a passing acceptance row.

### 9.1 The measurement that replaces the claim

**Gate 1 verdict #1 produced two Work Orders. Gate 1 verdicts #2 through #10, and the Gate 2 verdict, produced zero.**

Traced from commit timestamps: **WO-29** (`3288eeb`, `11:58:11Z`) and **WO-30** (`b98464a`, `12:28:57Z`) both post-date receipt #1 (`626d507`, `11:31:14Z`) and both name their Veritas defect in the commit subject. **No later Work Order cites a Gate 1 or Gate 2 finding.** The three that follow trace elsewhere:

| Order | Origin |
|---|---|
| **WO-31** | **Vex's RED** at `443d0fa` |
| **WO-32** | **Warwick's R2 ruling** |
| **WO-33** | **Warwick's Tower ruling 1** |

**So the honest sentence is not "assurance found only documentation defects." It is: the assurance loop had a productive phase and a terminal phase, and the boundary is receipt #2.**

**The terminal phase, measured:** receipts #2 through #11 span **`13:16:14Z` → `18:43:00Z` = 5 h 26 m 46 s**, which is **57.7 % of the session's committed activity span**. Across those **ten verdicts**, against a **declared ceiling of 1,830,000 tokens**, the yield was **zero product defects and zero Work Orders**.

*That distinction matters for 4C in a way the blanket claim does not: it says the mechanism works and then stops working, rather than that it never worked.*

---

## 10. Warwick's seven hypotheses, tested against evidence

| # | Hypothesis | Verdict | Measurement |
|---|---|---|---|
| **1** | assurance became admin about admin | **SUPPORTED** | 14 of 51 commits (27.5 %) are gate receipts or their repairs, versus 9 product commits (17.6 %). Five of seven FAILs carried by a statement in the map about the map. |
| **2** | Gate 1 repeatedly absorbed Gate 3 / document-currency work despite functional rows passing | **SUPPORTED, and quantified** | **Four consecutive verdicts (`b62a9fc`, `30666f1`, `3a1e670`, `ecfd38f`) at which rows 1, 2 and 4 ALL PASS and the gate still did not.** Three receipts carry the identical sentence: *"All three functional rows pass their pre-merge halves. The overall verdict is not PASS, and the reason is again not the engineering."* |
| **3** | non-blocking documentation defects repeatedly prevented progression | **SUPPORTED IN EFFECT, CORRECTED IN FORM** | The FAILs were carried by findings Veritas explicitly labelled **blocking** under its own Amendment 6 ② — so non-blockers did not cause FAIL. But at **`ecfd38f` the HOLD is carried by two findings, `D-3` and `N-7`, both labelled `non-blocking`** — one a table that may not render, one a heading claiming *less* assurance than exists. **HOLD gates PASS, closure and merge.** Accurate form: *non-blocking documentation findings did not produce FAIL, but they did produce HOLD, and HOLD blocked the route just the same.* |
| **4** | final-production acceptance properties used as prerequisites for reaching the production event that could prove them | **SUPPORTED — and Veritas names it independently** | Map `:2423`: *"**Three separate circularities** were found and had to be ruled on individually — row 4's live surface, `installed-runtime restart`, and `codex_qa_started` — all the same shape: **an acceptance property whose only proof lies beyond the gate that requires it**."* At `ecfd38f` Veritas quotes its own contract verbatim and states that *"Read at its most literal… that sentence does make Gate 1 PASS unreachable, because the acceptance event requires Gate 1 PASS."* It then declines that reading on its own scope clause. **A reviewer had to argue its way out of its own contract to make a PASS reachable at all.** |
| **5** | the Wayfinder reached ~3,000 lines and its history became an endless assurance surface | **SUPPORTED, measured** | Veritas ran structural enumerations *"over all **2,988** lines"* at `ecfd38f`. One emphasis-tolerant sweep returned **22 separate statements of gate standing** in a single document. An `awk` pass over **every table in the file** was needed to adjudicate one repair. |
| **6** | contradictory wording caused false handbacks and repeated stopping | **SUPPORTED, and independently corroborated by a second instrument** | Map `:2424`: *"A constitutional sentence (**"then yield"**) that Larry had over-translated **caused repeated false handbacks** until Warwick corrected it."* Repaired by `30666f1`. **Corroboration Warwick did not have: the transport log shows the notification silence *deepened* after that repair** (§7.1). |
| **7** | extraordinary context and specialist effort went into finding documentation defects rather than product defects | **SUPPORTED, with the §9 correction** | **2,080,000 tokens of declared assurance ceiling across 11 verdicts, 0 PASS.** Closing context **83 % of a 1 M window**. **Ten of eleven verdicts produced no work at all.** The correction: the first verdict produced two real product Work Orders, so *"rather than product defects"* is true of the terminal phase, not of the whole. |

---

## 11. Larry's failures — reported, not protected

### 11.1 The constitutional over-translation — **CONFIRMED**

Map `:2424`, Larry's own record: *"A constitutional sentence (**"then yield"**) that Larry had over-translated **caused repeated false handbacks** until Warwick corrected it."* Corrected by Warwick's authorised redline `30666f1` — *"Rule 4a — SEND, then post, then CONTINUE."*

**Number of false handbacks: UNESTABLISHED.** The record says "repeated" and no instrument counts them.

**And it did not hold.** §7.1 measures three gate verdicts and one merge after the redline with zero sends. **Warwick's own CAPAE block reaches the same conclusion from an independent observation:** *"Larry then ended a turn at exactly such a boundary — having just written 'Rotating now' — without rotating… **The remaining problem is EXECUTION / ADHERENCE, not a missing sentence.**"*

### 11.2 Verification-by-grep — **CONFIRMED, diagnosed at least three times**

- **Veritas @ `3a1e670`:** *"each repair has been **exactly as wide as the last finding**, and the next finding has been **just outside it**."*
- **Veritas @ `ecfd38f`:** *"That is the **fourth consecutive instance** of the pattern I named at `3a1e670`."*
- **The map's own record of the mechanism, `:2702`:** *"**Larry's step-11 enumeration missed it: he grepped for the label he had just repaired (`THE ONE CURRENT NEXT ACTION`) and not for the label the entry block points WITH.**"*
- **Once by markdown emphasis defeating a pattern** — confirmed: at `ecfd38f` Veritas ran an *"emphasis-tolerant enumeration… **the exact pattern class that defeated the `3a1e670` search**"*, and only then did the class come back clean (22 hits, none stale).

**The instructive detail:** the method that finally closed the class was **structural enumeration independent of wording** — every table, every heading, every gate-standing statement — not a better search string. Veritas states it explicitly: *"I did not grep for the strings Larry had just rewritten."*

### 11.3 A prescribed method that would have holed Larry's own control — **TWO ESTABLISHED, NOT THREE**

**This runs against the brief and is stated plainly.** The brief says *"three consecutive Work Orders in which Larry's prescribed method would have holed one of his own controls (`provenance.mjs`)."* The committed record establishes **two**, and the map itself says two:

> *"**🔴🔴 THE SAME THING HAPPENED AGAIN AT WO-30 — TWICE IN TWO CONSECUTIVE ORDERS, AND THAT MAKES IT A PATTERN IN LARRY, NOT LUCK IN KEEL.** Larry prescribed a two-line fix for `db.mjs`: a relative static `import` of `pg`. **Keel ran `relativeImports()` on both forms** and proved the relative specifier would pull a `node_modules` path into the closure `provenance.mjs` recomputes, break the declared `SOURCE_MODULES` and **turn `provenance-check.mjs` RED — a green CI gate, in a file outside his surface.** … **Both times the worker EXECUTED the real function; both times Larry REASONED about it.**"*

The two are **WO-25** (previous session) and **WO-30** (this session). A third order, **WO-31**, required `provenance.mjs` to gain one `SOURCE_MODULES` line — but that is a **declared** change made correctly, not a control silently holed. **Counting it as a third instance would overstate the record.**

**The corrective is Larry's own and it is the right one:** *"The corrective is not 'be more careful' — it is that **a prescribed method touching a control must be run against that control before it is prescribed**."*

### 11.4 An order demanding a fact while withholding the means — **CONFIRMED, verbatim**

From the sanitised boundary record: *"The order originally demanded Keel **establish** it while setting `network: none` and granting no web access — **that was Larry's defect and the demand was withdrawn**."*

A second instance in the same class landed in **WO-32 Amendment 1**: *"**AC5's impossible demand withdrawn**."*

### 11.5 `private_surface: none` beside a method requiring a credential-bearing file — **UNESTABLISHED IN THIS RANGE**

Pax searched the active map, the Work Order commit record, the boundary record and the eleven receipts and **could not locate this instance inside `c0cf334..4bf04e2`**. The nearest recorded instance is **WO-27 (previous session)**, whose AC1 evidence *"would have broken `private_surface`, `live_authority`, `credential_scope` AND `network` simultaneously"*, and an earlier Phase 3 instance at map `:1790`. **Stated as unestablished rather than assumed true because it was in the brief.** *(Scope of that negative: the active map, the eleven receipts, the boundary record, the closeout and the in-range commit subjects. Work Order envelope bodies under `Deliverables/proofline/` were not individually opened.)*

### 11.6 A defect reported as repaired at a head where it was not — **CONFIRMED, at least twice**

- **`ecfd38f`, D-3:** *"**The D-3 repair is not established as effective.** The header inserted at `:2823` is the **only** table header in all 2,988 lines not preceded by a blank line… the property it was meant to restore is **UNKNOWN rather than established**."* **Larry's declared DOCUMENT IMPACT listed D-3 as repaired.**
- **Map `:2750`:** *"**Route step 11 — DONE, then FAILED, then repaired.** Larry's enumeration missed the blocking defect; Veritas found it."*
- **`30666f1`:** the E-1 repair was, in the receipt's own words, a **fifth restatement** rather than a conversion.

---

## 12. Work Orders — the honest scoreboard

**Scope correction first.** The brief describes *"ten Work Orders (WO-24 … WO-33)"*. That is Sub-phase 4B **as a whole**. **Inside this session's range there are five: WO-29 … WO-33.** WO-24–28 were issued and integrated in the previous session and are scored in the prior report.

| Order | Subject | Read-back effect | Amendments | Integrated | The defect the worker found in Larry's order |
|---|---|---|---|---|---|
| **WO-29** | System-tab render coverage *(Veritas Defect 5)* | order changed at read-back | **1** | `a00e3a3` | *"three clarifications confirmed, **AC5 withdrawn as already satisfied**"* — an acceptance criterion demanding work already done |
| **WO-30** | `db.mjs` clone portability *(Veritas Defect 6)* | order changed at read-back | **1** | `5b1409f` (+ `1c633a5` CI) | **Larry's prescribed two-line fix would have turned `provenance-check.mjs` RED** — a green CI gate, in a file outside the worker's surface. Proved by executing `relativeImports()` on both forms. |
| **WO-31** | `/private-api` origin boundary *(Vex RED)* | order changed at read-back | **1** | `02c4520` (+ `3254c69` CI) | the order **demanded a fact be established while granting no means to establish it**; two surface additions were missing |
| **WO-32** | unsafe-method no-`Origin` guard *(Warwick R2)* | order changed at read-back | **1** | `4c55781` | **`AC5`'s impossible demand withdrawn**; Keel **measured** that a four-verb denylist would have left the same hole one verb to the left, so an allowlist of the HTTP-safe set was adopted instead |
| **WO-33** | TowerBot `codex_qa_started` card *(Warwick Tower ruling 1)* | order changed at read-back **twice** | **2** | `b03119c` / `f102dca` | A1: **Keel proved five ways QA never runs after checkpoint creation**, so the order's emission point would have announced runs that never start. A2: *"the deficiency is what the Larry card is FED, not the card"* — the order had diagnosed the wrong component. |

| Mandatory metric | Value |
|---|---|
| **Work Orders issued in range** | **5** |
| **First-dispatch success** — survived read-back with **no** binding amendment | **0 of 5 (0 %)** |
| **Amendments** | **6** (WO-33 took two) |
| **Refusals** | **0** |
| **Orders in which a worker found a defect in Larry's order** | **5 of 5 (100 %)** |
| Read-back token cost | **UNESTABLISHED** |

**Preventable-failure analysis.** All six amendments arose from defects in the **order**, not in the work. Three classes, measured:

1. **Asserting a property of a target the order was never executed against** — WO-30 (the module-closure regex), WO-33 A1 (the execution point). *This is the identical class the prior report named as Larry's signature: "asserting a property of a **TARGET CONTEXT** that was never executed against." **Third consecutive session, same root defect.***
2. **Demanding what the order's own envelope forbids** — WO-31, WO-32 A1. **Two instances in two consecutive orders**, both withdrawn once challenged.
3. **Requiring work already delivered** — WO-29 A1.

**Keel's read-back record — the answer to the brief's question.** The record shows **5 of 5 orders altered at read-back and 0 refused**, and **every recorded defect sits in the ORDER, not in the worker**. The map states it in Larry's own words about the earlier streak: *"the difference was **the order, not the worker**."* Across Sub-phase 4B as a whole the pattern is unbroken: **ten orders, ten amendments-or-refusals, zero clean first dispatches.** The read-back gate is not a last line of defence in this estate; it is the first one, and its yield is not falling.

---

## 13. Vex — RED, then GREEN, and the condition on the GREEN

*Sanitised. No attack detail. Full sanitised record: `Deliverables/2026-08-07-cockpit-private-api-boundary-record.md`.*

| | |
|---|---|
| Dispatch | one bounded pass, nine-item closed scope, ceiling ≤ ~120k |
| **First verdict** | **RED** at `443d0fa`, **scoped precisely** — RED applied to the `/private-api/*` bridge as written when armed; **the other eight scope items were GREEN and proven** |
| Material fact | the condition was **confirmed ARMED on the live Cockpit**, so **the exposure predated this branch** |
| Repair | **WO-31** @ `02c4520` — handler extracted to its own module (Vex F6: it had been the last live-facing handler inside `server.mjs`, *"so no gate could execute it, which is why the defect survived"*) |
| **Re-verification** | **GREEN** at `3254c69` — 124 independent assertions, 24 bypass shapes hunted, write half proven from the **upstream's own record** (0 requests, 0 bytes) |
| **Condition on the GREEN, recorded loudly** | **R1 — the GREEN is conditional on the unverified assumption that GET on the private upstream is non-mutating.** Accepted by Warwick with the condition named; verification is a **binding item at route step 18**, and the closeout records it as **HONEST PARTIAL, not discharged** — *"No side effect was observed; that is not proof."* |

**Why it could not be proven:** the upstream's source lives inside the private surface, so every route could not be enumerated. **Blocked by the GL-012 boundary, not by effort.** That is the correct outcome, recorded as a limit rather than closed over.

---

## 14. The merge — a user-authorised exception, recorded as such

Verbatim from the map, `:2780`:

> **"Warwick explicitly authorised PR #97 merge at `28b06df04509e1145b6edd18351a109b2da8c22f` before final Gate 1 PASS and without Codex, terminating the recursive assurance loop. This is a user-authorised exception, not evidence that the skipped assurance passed."**

| | |
|---|---|
| Authorised head | `28b06df04509e1145b6edd18351a109b2da8c22f` |
| Merge commit | `a2aae94693cff94aaf3fc87ded0948197b5ea0d0` |
| Canonical `main` | `bc99606daad6269554fccf0738a8f489c55be265` |
| **Assurance position** | **NO Gate 1 PASS · NO Gate 2 PASS · NO Codex · NO TowerBot production acceptance** |

**This report records the merge as an exception and nowhere describes any part of Sub-phase 4B as assured, complete or accepted.**

**Post-merge operational outcomes, from the closeout** (`Deliverables/2026-08-07-build-020-post-merge-closeout.md`) — reported, not graded:

- Live Cockpit moved to `main` @ `a2aae94`; rollback retained (144,020 files, 1.739 GB, 0 failed). `/api/rotation-reports` **`ok: true`, 8 reports**. CareerAIR overlay **GREEN** — the property WO-31 could not prove pre-merge.
- Tower re-aligned from canonical `main`, **76/76 files byte-identical**, exactly one watcher (PID 26728) outside every worktree. **The re-alignment was not a no-op:** the installed `tower-qa-skill.md` was **missing the mandatory completed-automation bar (+24 lines)** — and Tower loads that contract byte-exact into the external Codex invocation, so **the installed Tower would have injected a stale reviewer contract into Codex.**
- **A genuine unattended capture occurred** — the merged watcher's reconcile committed a stranded artefact on its own, bytes verified SHA256-identical. *This proves the Git-persistence half only; Amendment 9 remains AUTOMATIC and owed.*
- **Estate cleanup: worktrees 38 → 19; 15 BUILD-020 branches deleted, every one proven superseded by content diff, never by name.** Two catches justified the method: one branch held 34 uncommitted lines and an unbanked evidence deliverable existing nowhere else; another *looked* unique but was 1,766 lines behind.
- **Still blocked: `MyPKA-YouTube-Watcher-Ensure` is DISABLED on elevation refusal.** Ensure semantics proven by two ticks with ProcessId unchanged — **capability, not automation.**

---

## 15. What this report could not establish

`opening_context_tokens` · `total_context_token_movement` · wall-clock session length · waiting time · **all per-specialist token usage** · exact total dispatch count · WO-29's worker · line-level doc-versus-product volume · files changed · insertions/deletions · CI status at the closing head · parent-channel response latency · whether Warwick was at the keyboard during the 4 h 37 m silence · notification content · the `private_surface: none` instance in §11.5 · read-back token cost · actual (as opposed to declared-ceiling) assurance consumption.

---

## 16. For Warwick — evidence-only observations, no fixes proposed

Warwick has forbidden solving or designing 4C before rotation. **Nothing below is a proposal, a Work Order or a mechanism.**

1. **The instrument cannot supply an opening context reading after the fact.** Three consecutive reports have recorded it UNESTABLISHED. The health store is a latest-sample store, not a series.
2. **The assurance loop's productive phase ended at receipt #2.** Verdict #1 produced two real Work Orders; verdicts #2–#11 produced none, across 5 h 27 m and a declared ceiling of 1,830,000 tokens. That boundary is measurable and is more informative than *"it was all documentation."*
3. **The notification silence deepened immediately after the notification rule was strengthened** — three gate verdicts and one merge in 2 h 39 m with zero sends. A second, independent instance of the CAPAE finding, from an instrument Larry does not author.
4. **`0 of 5` clean first dispatches, third session running.** The read-back gate is functioning as the first line of order review, not the last.
5. **Two of Warwick's own factual summaries are one out** — nine Gate 1 verdicts (ten) and three `provenance.mjs` near-holes (two). Both err in the direction that makes the story tidier. **A report that repeated them would have been the mediocre version of this one.**

---

*Report written by Pax. Closing head `4bf04e29febf3c009baa23e73a50f118ecfe1a24`. Payload: `Deliverables/2026-08-07-session-report-payload-subphase-4b-close.json`.*
