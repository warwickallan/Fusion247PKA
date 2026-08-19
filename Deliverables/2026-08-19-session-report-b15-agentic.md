# Session performance and process report — BUILD-015, the agentic decision path

**Author:** Pax, independent session witness. Commissioned at `/rotate` steps 5, 5b, 5c.
**⚠️ SAME-MODEL REVIEW — independent of the session and its context, not of the model. Not externally verified.**

| | |
|---|---|
| **Session** | BUILD-015 — the approved contract becomes load-bearing runtime behaviour, 2026-08-18 → 2026-08-19 |
| **Branch** | `main` |
| **Closing head** | `6f1ecd2bb658b203308c5ba60a9032592775e9d5` |
| **Active map** | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` |
| **Host at close** | claude-code **2.1.227**, model `claude-opus-5[1m]`, effort `high` — read from the sampler, not asserted |
| **Mandatory inputs used** | `Deliverables/2026-08-19-subagent-token-ledger-b15-agentic.md` · `~/.mypka/governor/capae-opening.json` (present, readable, `snapshot_at 2026-08-18T09:50:04.204Z`) |

⛔ **PAX COULD NOT COMMIT THIS FILE OR ITS PAYLOAD.** This dispatch's grant is `Read · Write · Grep · Glob · WebFetch · WebSearch` — **no Bash, no PowerShell, no git binary.** Larry must commit both, then run `populate.mjs --file` (7b) and `capae-sync.mjs` positionally (7c). **This is the FOURTH consecutive rotation in which the session witness has been dispatched without a shell**; see §12.

---

## 1. Executive summary

**The central finding is the one Larry named, and the evidence is worse than his account of it in one respect and better in another.** An approved contract, re-cut on 2026-08-17 and intact in the goal contract and on the map, never reached the specialist contract, the shim or the runtime — and **a full working day was spent dispatching well-formed Work Orders at the deterministic layer while the ruling said the model should decide.** Warwick had to say it four times. *Worse:* Veritas independently found the same shape in `SOP-021`/`SOP-021a` and graded it **blocking**, and Larry's own residual list **understated the occurrence count in both files** (he declared 4 and 6; the true figures are 6 and 8). *Better:* the propagation, once started, was complete within 26 minutes of the reviewer's receipt, and the reviewer verified all fourteen remaining occurrences struck at the next gate.

**Work Order discipline did not merely recover — it recorded the best result in the series and then paid for itself in a single measurable event.** **11 of 11 orders generated through `tools/wo/envelope.mjs`**, every one carrying a verified governance head, after last session's 0-of-3. And the generated envelope's own `live_authority: none` field stood beside an acceptance criterion demanding *"a real browser session and a built trolley"* on a lane whose production target is **Warwick's live signed-in ASDA account**. The worker refused it and delivered against a scratch profile and a locally-written fixture instead — *"nothing has touched the real ASDA site, account or trolley. No request left the machine."* **The control Larry skipped last session is the control that stopped him writing into Warwick's groceries this session.**

**And the thing that had never happened, happened.** At **2026-08-18T22:44:14Z** the semantic decision point executed on the production path for the first time in this build's history — a `decisionEvidence` row, `gpt-5.6-terra`, 109 catalogue rows, 39 rules, a 45,932-byte contract with a recorded sha256, and **seven legacy questions reduced to one**, offering *Body wipes / Toilet wipes / Baby wipes* where the deterministic planner had offered **cat food**. Warwick was notified 82 seconds later. That is `built-tested-never-activated`'s own `must` discharged by execution, and it is the first time this family has been cleared by a production event rather than by a plan to run one.

---

## 2. EXECUTIVE CAPAE

> **4 active risks were loaded into Larry at session start. All 4 had qualified exposures. 1 prevention held outright and it is the strongest single result this series has recorded — Work Order generation went from 0-of-3 to 11-of-11 and the generated field is what refused a criterion that would have written into Warwick's live grocery account. 2 recurred despite being in the brief. 1 recurred through most of the session and was then discharged by the first production execution of the decision point in this build's history. AND THE BRIEF ITSELF WAS WRONG IN THE REASSURING DIRECTION ON THREE OF ITS FOUR ROWS — it credited Larry with 3 clean exposures he did not have and withheld the 1 he had earned, because the previous rotation's `capae-sync` ran 16 minutes 21 seconds AFTER this session's SessionStart froze the snapshot. That is the third consecutive rotation of the same ordering defect, and the fix the last report recommended is already implemented, already committed, and structurally incapable of catching it: `STALE_AFTER_DAYS = 14` against a brief 0.954 days old. The defect is ORDINAL, not temporal. Assurance produced 30 defects for 31% fewer tokens than last session produced zero.**

---

## 3. The measured window

**Every timestamp is derived from `.git/logs/refs/heads/main` (lines 543–596), `.git/logs/refs/remotes/origin/main` (lines 259–311), six branch reflogs and their `origin/` counterparts, `~/.mypka/governor/ding-log.jsonl`, `session-report-populate.jsonl`, `capae-opening.json`, `capae-active.json` and two sampler files, read directly. Unix seconds converted to UTC against the anchor `2026-08-17T00:00:00Z = 1786924800`, derived from and consistent with the previous report's anchor.**

| | |
|---|---|
| **Session start (SessionStart hook)** | **2026-08-18T09:50:04.204Z** — `capae-opening.json` `snapshot_at`, 4 m 29 s after the previous session's last commit `39f5b1b` (09:45:35Z) |
| **First commit of this session** | `d4d8dc4` — "Acceptance date corrected on the map: Tuesday 25 August 2026" — **2026-08-18T09:56:24Z** |
| **Closing head** | `6f1ecd2` — "ROTATION 2026-08-19" — **2026-08-19T08:54:40Z** |
| **Head at the time of writing** | `6f1ecd2`. **Drift 0** — second consecutive rotation in which the declared closing head was still `main` when the witness began |
| **Wall clock, SessionStart → closing head** | **83,075.8 s = 1,384.60 min = 23 h 04 m 35.8 s** |
| **Wall clock, first commit → closing head** | 82,696 s = 1,378.27 min = 22 h 58 m 16 s |
| **Git-observable working span** | **265.90 min (4 h 25 m 54 s)** across 15 segments, gap threshold 30 min |
| **Git-silent gaps ≥ 30 min** | **1,112.37 min (18 h 32 m 22 s)** in 14 blocks, the largest being 365.63 min overnight (00:37:04Z → 06:42:42Z) |

### ⛔ THE GIT-OBSERVABLE SPAN HALVED WHILE DELEGATED WORK DOUBLED, AND THAT IS THE HEADLINE OF THIS SECTION

| | previous session | this session | change |
|---|---|---|---|
| Git-observable working span | 449.62 min | **265.90 min** | **−40.9 %** |
| Dispatches | 19 | **39** | **+105 %** |
| Deduplicated subagent tokens | 2,509,759 | **4,702,385** | **+87 %** |
| Subagent wall time | not reported | **524 min (8.73 h)**, concurrent | — |

**524 minutes of subagent wall time occurred inside a session whose git-observable span was 266 minutes.** Subagent execution alone exceeds Larry's own git-observable activity by **1.97 : 1**. The "git-silent" 18 h 32 m is therefore **not idle** in any straightforward sense, and I will not label it so — a large share of it is workers running while Larry has nothing to commit. **This is the delegation shift, measured for the first time in this series**, and §5.5 grades whether it bought its cost.

**What I cannot do is apportion the silence.** No instrument in this estate records when a dispatch started or finished in wall-clock terms; the ledger's per-agent wall time is a duration, not an interval. The 18 h 32 m is bounded above by the session and below by 524 min of concurrent agent work, and nothing narrows it further. **UNESTABLISHED.**

### ⚠️ A SECOND CLAUDE CODE INSTALLATION WAS LIVE INSIDE THIS SESSION — the previous report's open question, now SETTLED

The previous report found two session ids in one window on two host versions, said *"whether they ran concurrently is UNESTABLISHED"*, and recommended establishing it once. **It is established.**

| session id | last `sampled_at` | host | model | context |
|---|---|---|---|---|
| `058cb015-…` | 2026-08-18T09:49:58.191Z | 2.1.227 | `claude-opus-5[1m]` | 931,028 / 1,000,000 — 93 % |
| **`6b147a85-…`** | **2026-08-18T17:57:16.703Z** | **2.1.222** | **`claude-opus-5`** | **962,738 / 1,000,000 — 96 %** |
| `736e76e6-…` **(this session)** | 2026-08-19T08:57:53.542Z | 2.1.227 | `claude-opus-5[1m]` | 868,303 / 1,000,000 — 87 % |

**`6b147a85` was sampled at 17:57:16Z on 2026-08-18 — eight hours and seven minutes into this session.** A statusline only refreshes for a live session. The previous report saw its 23:44Z sample on 2026-08-17 and could not tell whether it was concurrent; the file has since been overwritten with a reading **inside this session's window**, on the **older host** and a **different model id**. Two Claude Code installations were live against this project at the same time.

**Grade under the hobby-brain rule.** Eight worktrees were in play this session (`-planner`, `-photoproof`, `-agentic`, `-lane`, `-grants`, `-cockpit`, plus `main`), four agents ran concurrently, and the estate's own memory records that `/clear` does not kill background workers and they keep writing. A second live session at **96 % context** holding `Bash` and `Write` against the same worktrees is a real, if modest, corruption surface for **uncommitted** state. **It does not reach "meaningfully affect Warwick's real life" — no credential, no money, no private exposure, and everything useful this session reached `main`.** My grade is unchanged from the previous report's: **record, park, do not raise a Work Order.** What has changed is that it is no longer a hypothesis, and **nothing in this session's record mentions it, so nobody looked.**

---

## 4. Token and context economics — every figure read from an instrument

### 4.1 Context and quota readings

| Reading | Value | Source |
|---|---|---|
| **Closing context occupancy** | **868,303 input tokens of a 1,000,000 window — 87 % used, 13 % remaining.** First rotation in the series to close below 90 %. `total_output_tokens: 2` is the last refresh's figure, never a session total | `~/.mypka/governor/health/C--Fusion247PKA/736e76e6-….json`, `sampled_at 2026-08-19T08:57:53.542Z`, `source: statusLine` |
| **Opening context reading** | **UNESTABLISHED — structurally unavailable, for the fourth report running.** The sampler keeps one JSON per session id and overwrites it on every refresh | verified by enumerating `health/C--Fusion247PKA/**` — 77 files, one per session id, none with history |
| **Total measured context movement** | **UNESTABLISHED.** No opening reading, therefore no delta. I will not estimate one | — |
| **⭐ Total measured QUOTA movement** | **Seven-day bucket 7 % → 34 %: +27 percentage points consumed by this single session.** This is the first genuine total-movement figure this series has been able to report, and it is not a substitute for the context delta | `058cb015` (7 % @ 2026-08-18T09:49:58Z) and `736e76e6` (34 % @ 2026-08-19T08:57:53Z), same account, same reset epoch `1787500800` |
| **Rate limits at close** | five-hour **12 %** (resets 2026-08-19T11:40:00Z); seven-day **34 %** (resets 2026-08-23T16:00:00Z) | `736e76e6` sampler |

**The binding constraint was again the context window, not quota** — 87 % occupancy against a 12 % five-hour bucket. But the seven-day figure is the one to watch: **one session took just over a quarter of the week.**

### 4.2 Subagent traffic — the ledger, independently cross-footed on all four totals

**Total A = 4,702,385 deduplicated subagent tokens across 17 agents / 39 dispatches.** I re-added all 16 measured rows independently: they sum to **4,702,385 exactly**. Dispatch counts sum to **39**. Tool uses sum to **2,036**. Wall time sums to **524 min = 8.73 h** against the ledger's stated 8.8 h (rounding). **All four totals cross-foot. This is the first ledger in the series to do so** — the previous one cross-footed on two, and the one before it carried a Total C that was wrong by one and contradicted its own prose.

**One agent is UNMEASURED, NOT ZERO:** `ab5aa89b3288aa9aa` (keel, WO-2026-08-18-05), killed by Larry mid-read on Warwick's instruction before it wrote anything. It emitted no usage block. **Every percentage below is of measured traffic**, and its cost is real and unrecorded. Its dispatch is counted in the 39.

**The cumulative-vs-per-dispatch property was RE-TESTED rather than inherited**, which `/rotate` 5b requires: `subagent_tokens` monotonic across all 11 multi-dispatch agents; `tool_uses` demonstrably not (`34, 41, 41, 9, 18, 23, 28, 32`). **Summing every return would have produced 9,431,774 — a 101 % overstatement.** Last rotation the same error was worth ~80 %; this one it would have doubled the figure. **The ledger's uncertainties section is carried into this report in full and none of it is smoothed over.**

**⛔ Larry's own context is NOT in Total A and must never be added to it.**

> **868,303 tokens of closing context occupancy (a LEVEL) against 4,702,385 tokens of delegated subagent traffic (a FLOW) — 1 : 5.42.** Previous session 1 : 2.70.
>
> **≈ 21.3 tokens of delegated work per token of Larry's own context** (4,702,385 against the ledger's ≈220,300 budget-counter movement). Previous 1 : 4.24 on the occupancy basis; the two are not comparable and both are stated.

### 4.3 Burn rate — three bases, because one is misleading on its own

| Basis | Rate | Comparison |
|---|---|---|
| Over the **265.90-min git-observable span** | 17,684 tokens/min | previous 5,582.7 — **×3.17**, but the denominator collapsed, so this is not an efficiency claim |
| Over **524 min of subagent wall time** | **8,974 tokens/min** | the honest per-minute-of-agent-work figure; no prior comparison exists |
| Over **1,384.60 min** wall clock | 3,396 tokens/min | previous 1,838.8 |

**38 measured dispatches at a mean 123,747 tokens** (previous: 19 at 132,092). **Mean traffic per agent has fallen while the number of agents has doubled** — the dispatches got smaller, not larger.

**Codex/Tower emitted nothing: ZERO Codex runs, second consecutive session.** Genuinely zero, not unmeasured — see §5.4.

---

## 5. THE HEADLINE — an approved contract that never became runtime behaviour

### 5.1 The finding, established from the artefacts rather than from Larry's account

`Deliverables/2026-08-18-approved-contract-did-not-reach-the-decision-point.md` records Warwick's own correction, and I verified every row of its trace independently:

> The failure was NOT: *"Warwick never changed the contract."*
> The failure was: **"the approved contract change did not reach the specialist/runtime decision point, while Larry reported the contract as durably changed."**

| Authority | Should carry the 2026-08-17 ruling | State at the start of this session |
|---|---|---|
| `Builds/…/BUILD-015-goal-contract.md` | ✅ canonical | **CORRECT** — re-cut `cc6d906`, 7 occurrences of the agentic language |
| Wayfinder §1 + ⚑ OPERATIONAL CONTRACT | ✅ | **CORRECT** |
| `Team/Asdair …/AGENTS.md` | ✅ the specialist's own law | ⛔ **CONTRADICTS IT** — last changed 2026-08-05, still reading *"the deterministic BUILD-015 shopping pipeline"* |
| `.claude/agents/asdair.md` | ✅ the shim a dispatch reads | ⛔ stale, 2026-08-11 |
| **The runtime itself** | ✅ the actual decision point | ⛔ **CONSUMES NO CONTRACT AT ALL** |

**The measured consequence, in Larry's own words and corroborated by the commit record:** *"A full day of 2026-08-18 was spent improving deterministic components — a word-overlap corroboration gate, an answer-binding rule, a planner word filter — because the authority a worker actually reads still said the deterministic pipeline was the architecture. Each order was well-formed. Each was aimed below the frontier. **Warwick had to say it four times.**"*

The commit record shows exactly that shape: WO-01 (10:03Z), WO-02 (10:25Z), WO-03 (11:41Z), WO-04 (12:40Z) and the abandoned WO-01-duplicate (15:46Z) are all deterministic-layer repairs. The pivot is `a33369a` at **18:39:59Z** — *"Correct 3f53532: the approved contract change did not reach the decision point"* — **eight hours and forty-four minutes after the first commit of the session.**

### 5.2 What an independent reviewer found in the same class, and it is worse than Larry's account

**Veritas Gate 2 at `a0a71f5`, defect 7, HIGH, `blocking`:**

> `SOP-021:9` and `SOP-021a:11` still instruct that the live basket writer is *"Sonnet in Claude for Chrome"*, superseded 2026-08-17. This is the named authority for requirement 7's "established shopping method" … it **misdirects the current executable journey**, which is the material-effect test in root `CLAUDE.md` §Finding disposition.

And on Larry's own residual declaration:

> The Sonnet count is **6 in `SOP-021` and 8 in `SOP-021a`** — his figures were the "Sonnet in Claude for Chrome" phrase only, and understate the total; the direction of the error is against his own interest, so it is recorded and not treated as a finding.

**Two independent surfaces, one class, and neither was found by Larry.** The specialist contract he found himself; the SOPs the reviewer found; the runtime channel was the frontier.

### 5.3 The five false measured-sounding claims — verified, and one correction to Larry's own list

Larry named five. I checked each against the artefacts, and I add a sixth he did not name.

| # | The claim | What the record shows | Corrected where |
|---|---|---|---|
| 1 | A subagent had died when it was alive | **UNESTABLISHED from the record.** No artefact carries it; it survives only in a transcript `/clear` will destroy | nowhere |
| 2 | *"The contract was never changed"* | **ESTABLISHED as false, by Larry, in a committed document.** He ran `git log` over one artefact and generalised to the decision. *"It is the same error as reconciling to a derived list instead of the source, committed twice in one day."* | `2026-08-18-approved-contract-did-not-reach-the-decision-point.md`, correcting `3f53532`'s commit message |
| 3 | *"The invention is gone"* / *"intermittent, nothing changed"* | **ESTABLISHED as false in BOTH directions**, by two commit timestamps: the invention occurred **4 h 34 m before** `prepareImage.js` existed. *"Both errors are the same error in opposite directions… Neither statement was measured before it was made."* | `2026-08-18-invention-intermittency-correction.md`, correcting `ccd3372` |
| 4 | `37/37` proved something the production path does not consume | **ESTABLISHED by the reviewer, and it is the cleanest instance of the family in this report.** `measure-known-list.js` calls `resolveByCatalogue.resolveAll` (interpret hop); the PLAN stage re-matches through `planner.matchRegular` and never reads that binding. Measured at the same head: **1 exact binding, 19 tolerant, of 37** — and lines 31 and 32 both bind to the *shampoo* a `forbid` list names | Veritas `4bc0894` § "The contradiction the dispatch declared" |
| 5 | `011` absent from the repository, relayed unchecked | **PARTIALLY ESTABLISHED and I flag it.** The map records at line 1312 that *"Migration 011 is untracked and gitignored"*, so a prior record exists; this session's related finding is that `GRANT_MATRIX` *"never folded in `012`, so 'no committed migration grants it' was **false**"*. **Whether these are the same event is UNESTABLISHED.** Confidence: Low | map §12, item on the grant check |
| **6** | **⭐ NOT NAMED BY LARRY — the Vera brief.** *"It is published now (12 names, verified live), so the enabled path is what you will see"* | **ESTABLISHED by the reviewer.** `command_names` genuinely publishes `correctAnswer` and the control **does not exist in the live DOM** because `questions.resolved: []`. Vera: *"A confident statement derived from a real measurement of a different thing."* It cost a banner at the top of a 684-line receipt so the next inspector does not walk into the same empty region | `2026-08-19-vera-cockpit-correction-control-gate.md` §9 |

**The pattern across all six is one act: a real measurement of one thing, presented as a fact about another.** That is `control-cannot-reach-what-it-checks` operating on Larry rather than on a test, and it is why §6.2 grades that family as dominant.

**⭐ And the durable half is worth naming separately, because it is the behaviour the estate wants.** Four of the six are corrected **in committed documents that sit beside the original and correct it forward**, with the wrong version quoted, the method of correction stated, and history not rewritten. That is not damage control; it is the record doing its job.

### 5.4 What assurance ran, and what did NOT

**Two Veritas gates, two receipts, on the same logical boundary, correctly commissioned:**

| Pass | Head | Verdict | Requirements graded | Defects | Blocking |
|---|---|---|---|---|---|
| 1 | `a0a71f5` | **FAIL** | 9 of 9, none narrowed | 12 (2 CRIT, 5 HIGH, 2 MED, 3 LOW) | 7 |
| 2 | `4bc0894` | **HOLD**, requirement 8 FAIL | 9 of 9, none narrowed, all 12 prior findings carried as regression targets | 8 (4 HIGH, 2 MED, 2 LOW) | 5 |

**The commissioning question was satisfied and the reviewer said so in writing**, unprompted:

> The commissioning question is satisfied. Executable behaviour at the semantic decision point changed, a load-bearing dependency (the contract read) was added, runtime wiring changed, and the runtime was restarted onto the merged bytes. **This is a new boundary, not a re-read.**

**Zero re-reviews of a receipt. Zero reviews of a head whose delta was a previous verdict. Neither gate narrowed. Both read live durable state rather than an export, and said so.** Turnaround: FAIL receipt 43 min after the reviewed head; HOLD receipt 17 min after.

**Vera ran three gates on the Cockpit correction control:** FAIL @ `2e7ff43` (3 HIGH), PASS @ `2617c59` (1 new MEDIUM), PASS @ `dbdf041` (narrow, V-10 closed). **Each gate narrowed. Each found real product defects that were fixed.** Gate 3's scope note is exemplary: *"`styles.css` is byte-identical … so the 16-pairing contrast sweep from gate 2 carries."*

> ### ⭐ THE ASSURANCE EFFICIENCY RESULT — the cleanest number in this report
>
> | | previous session | this session |
> |---|---|---|
> | Internal assurance tokens (Veritas) | 554,001 | **384,411** (−30.6 %) |
> | **Product defects found by Veritas** | **0** | **20, of which 12 blocking** |
> | Total assurance tokens (Veritas + Vera + read-only readiness) | 614,300 | 935,870 |
> | **Total defects found** | **0** | **30** |
> | Tokens per defect found | ∞ | **31,196** |
>
> **Last session, 554,001 tokens of internal assurance established four times that the evidence did not show what it was said to show, and found no product defect. This session, 31 % fewer tokens found twenty.** The difference is not the reviewer. It is that the boundary submitted was a real production run rather than a component with a capture attached.

**⛔ NO CODEX RUN OCCURRED, SECOND CONSECUTIVE SESSION, AND THE DEBT HAS GROWN SHARPLY.** 54 ref updates on `main`, 13 merge commits from 6 branches, ≥21 content-bearing product commits, and **zero PRs opened**. No artefact in this session references `@tower`, `merge-check.mjs`, `reviewDiff.mjs` or Codex.

**It is NOT a violation, and I say so plainly.** Both Veritas receipts state explicitly what they gate: *"any claim that BUILD-015's agentic runtime is delivered, complete, operational, durable, ready, accepted or closed; the phase-boundary PASS on the Wayfinder; and **Codex invocation for release QA of this scope**."* Codex is **prohibited** until Veritas PASS, and Veritas is at HOLD. The map's route names it in order: real photograph → Veritas PASS → bounded estate reconcile → **Codex** → 25 August shop. **Named-and-owed is the bar; there is no silence.** What Warwick should know without reading further: **executable state on `main` is now two full days and 6 branch merges beyond BUILD-015's last assured boundary, deliberately, with the debt recorded and the gate correctly held closed by the reviewer rather than by Larry's restraint.**

### 5.5 ⭐ Evidenced allocation — and the row that went to zero

Classified from the ledger's 16 measured agents. Denominator is **subagent token traffic**, not wall clock and not total effort.

| Class | Agents | Disp. | Tokens | % of A |
|---|---|---|---|---|
| **Product implementation** — 8 Keel streams + Felix's Cockpit correction control | 9 | 27 | **3,106,769** | **66.07 %** |
| **Assurance / evidence** — Vera ×3 gates (355,376) + Veritas ×2 (384,411) + Asdair's read-only photo-door readiness proof (196,083) | 4 | 8 | **935,870** | **19.90 %** |
| **Record / governance** — two Nolan dispatches (SOP-021 standing-law conflict; propagating the approved contract) | 2 | 2 | **334,918** | **7.12 %** |
| **Rotation reporting** — Pax, the *previous* session's witness, landing after its `/clear` as step 6 permits | 1 | 1 | **324,828** | **6.91 %** |
| **⭐ Operating the product** | **0** | **0** | **0** | **0.00 %** |
| | **16** | **38** | **4,702,385** | **100.00 %** |

> ### **DELIVERY TAX: assurance 935,870 : product 3,106,769 = 0.30 : 1.** Previous 0.64 : 1; the session before 1.18 : 1. **Best in the series by a factor of two.**
> Counting rotation reporting and record/governance as overhead too: 1,595,616 : 3,106,769 = **0.51 : 1**.

**⛔ THE NUMBER THAT MATTERS MOST IS THE ZERO.** Last session, **17.63 %** of all subagent traffic went on Asdair dispatches *operating* the product — a rescue the report correctly called *"a product failure, not a cost of delivery"* under the contract re-cut the same night. **This session that row is 0.00 %.** Asdair's single dispatch was a `BOUNDED READ-ONLY` readiness proof with an explicit prohibition on start, stop, restart, arm, disarm, deregister, Telegram, or any write. **Larry stayed out of the weekly runtime.**

**Two qualifications, stated so the zero is not over-read.** Larry did (a) restart the runtime twice — at 13:39:20Z and 21:22:43Z, each within a minute of a merge — and (b) place `ASDAIR_CHROME_PATH`, `ASDAIR_CHROME_PROFILE_DIR` and `ASDAIR_CDP_PORT` into `C:/.fusion247/asdair.env`. **Neither is a violation.** The contract's failure list prohibits *Larry in the weekly runtime*; restarting the service you are remediating, onto merged bytes, is builder work, and Veritas relied on those restarts as evidence (*"its start time is after the merged files were written, so it is provably executing these bytes"*). The env placement went into the runtime's own approved env file, which is what TEN gap 4 asks for.

**Corrective rework: NOT ZERO, and NOT fully measurable.** At least one whole dispatch (WO-2026-08-18-05, the killed Keel — **UNMEASURED**) and one REFUSE round trip inside the WO-06 agent's 459,251 tokens were caused by defects in Larry's own orders. **A token figure is UNESTABLISHED** because the REFUSE round trip is not separable from its agent's cumulative total.

**Waiting on Warwick: bounded at ≤ ~25 minutes of a 1,384-minute session — under 2 %.** The one observable Warwick-gated interval is notification 561 (12:14:39Z) → his CORRELATION POLICY ruling committed at `fd89e6c` (12:37:56Z) = **23 m 17 s**, and Gap 6 unparked 68 seconds later. Every subsequent stretch ran under his explicit *"Continue now and complete everything that does not require genuine human product input… Do not ask Warwick to supervise any of it."* **This is a bound derived from one measured interval, not an instrumented total. Precise figure: UNESTABLISHED.** It is nevertheless the metric that answers his own stated constraint — *"he wants to move on to CareerAIR, and must be able to, while this engineering closes without consuming or supervising him."*

### 5.6 THE DELEGATION-ECONOMICS JUDGEMENT — the one Larry asked me for

**The ratio bought its cost. I would not qualify that heavily, and here is the arithmetic.**

**Against:** 4,702,385 tokens is 87 % more than last session, 27 percentage points of a weekly quota went in one sitting, one dispatch (WO-05) was pure waste and is unmeasured, and **6 of 10 dispatched orders needed an amendment, a re-cut or a re-issue.** A 40 % first-dispatch rate looks bad beside the 71.4 % of six days earlier.

**For, and this is the load-bearing half:** **every one of those six round trips found a real defect in Larry's framing, and the defects are named in his own commit messages** — *"four defects, all the worker's, all mine to own"* · *"my diagnosis was wrong, and the durable rows correct it twice"* · *"the correction would have been audited and silently inert"* · *"a correct REFUSE"*. **Two of them would otherwise have shipped**, and one of those two is the acceptance criterion that would have driven a browser into Warwick's live ASDA trolley unsupervised (§7 F2). **A 40 % first-dispatch rate where 100 % of the remaining 60 % catches a real defect is strictly better than a 71 % rate where the other 29 % ships.** The read-back gate is not overhead here; it is the only control that fired on the class of defect no review would have found, because it fires *before* the work exists to be reviewed.

**And the productivity side is measured, not asserted.** Assurance found **30 defects for 31 % fewer internal-assurance tokens than last session spent finding zero**; the delivery tax halved to 0.30 : 1; the operating-the-product row went to 0.00 %; the documentation-to-product commit ratio more than halved; and the one thing this build had never done — execute its own decision point in production — happened. **Larry's git-observable activity fell 41 % while all of that occurred**, which is what the delegation rule is for: he remained available, and the estate's throughput went up rather than down.

**The number to watch, and it is the ledger's own warning:** 21.3 delegated tokens per token of Larry's context. **If that ratio inverts, delegation has stopped paying.** It went 4.24 → 21.3 in one session. The risk is not the ratio; it is that at 39 dispatches a session, **the read-back challenges live only in a transcript unless the order file records them** — and this session's order files, unlike the generator's design intent, largely do not carry the challenge back (§8).

---

## 6. CAPAE — the six questions, per family, by name

**Graded against `~/.mypka/governor/capae-opening.json` (`snapshot_at 2026-08-18T09:50:04.204Z`, content `written_at 2026-08-17T10:56:20.668Z`), never against `capae-active.json`. Vocabulary: `clean` · `recurrence` · `none-this-session` · `unmeasurable-at-this-frequency`. There is no fifth word.**

> ### ⛔ READ THIS BEFORE THE FOUR GRADINGS — THE BRIEF WAS WRONG, AND IT WAS WRONG IN THE REASSURING DIRECTION
>
> The brief Larry was handed carried content written **22 h 53 m 43 s** earlier — the sync from **two** rotations ago. The previous rotation's `capae-sync.mjs` wrote the correct figures **16 minutes 20.785 seconds after** the snapshot froze.
>
> | family | brief SAID (09:50:04Z) | TRUE 16 min later (10:06:24Z) | direction of error |
> |---|---|---|---|
> | `work-order-not-generated` | occ 5, **clean 1** | occ **6**, **clean 0** | **flattering** |
> | `control-cannot-reach-what-it-checks` | occ 4, clean 0 | occ **5**, clean 0 | **flattering** |
> | `built-tested-never-activated` | occ 6, **clean 2** | occ **8**, **clean 0** | **flattering** |
> | `record-amended-body-not-recut` | occ 6, clean 0 | occ 6, **clean 1** | pessimistic |
>
> **Larry was told he had three clean exposures banked. He had one, against a different family.** Three of four rows were wrong and three of four errors made the estate look better than it was. **This is not incidental staleness — it is systematic, because a rotation's report is precisely where recurrences are added and clean counters are reset to zero.** Full analysis and the corrected prevention at §6.5.

### 6.1 `work-order-not-generated` — **CLEAN, and the strongest single result this series has recorded**

1. **Told:** occ 5, MONITORING, clean 1 of 5. Cause: *"The generation route is treated as exempt for orders that feel small, amendment-shaped, or urgent. The control exists, is known, and is skipped at the moment of dispatch."* Must: *"Generate the envelope, read it back, then issue. No exemption for small or amendment-shaped orders."*
2. **Exposure: `clean`**, with one named completeness qualification.
3. **Evidence, from the artefacts and not from Larry's account. Eleven order files exist under `Deliverables/2026-08-1[89]-wo-*.md` and every single one opens** `<!-- GENERATED by tools/wo/envelope.mjs — DO NOT HAND-AUTHOR THIS FILE.` with a `generated_at` timestamp and `governance_head: <sha>  (verified: commit exists)`.

   | # | Order | `generated_at` | governance head | worker |
   |---|---|---|---|---|
   | 1 | `WO-2026-08-18-01` photo-path proof | 10:02:04.573Z | `d4d8dc4` | keel |
   | 2 | `WO-2026-08-18-02` photo-door readiness | 10:24:17.256Z | `434a3dc` | asdair |
   | 3 | `WO-2026-08-18-03` answer-binding repair | 10:41:10.084Z | `fc90818` | keel |
   | 4 | `WO-2026-08-18-04` audited answer correction | 12:39:29.743Z | `7950b41` | keel |
   | 5 | ⚠️ `WO-2026-08-18-01` **(DUPLICATE ID)** candidate quality | 15:46:30.758Z | `ccd3372` | **never dispatched** |
   | 6 | `WO-2026-08-18-05` AsdAIr resolves it | 18:26:19.740Z | `8950ef5` | keel — **killed mid-read** |
   | 7 | `WO-2026-08-18-06 REV 2` MODEL DECIDES | 20:35:02.668Z | `76637e3` | keel — *"re-issued after a correct REFUSE"* |
   | 8 | `WO-2026-08-18-07` board and lane | 21:39:49.071Z | `3925ac0` | keel |
   | 9 | `WO-2026-08-19-01` lane and trolley | 23:15:07.234Z | `9b6e4ef` | keel |
   | 10 | `WO-2026-08-19-03` cockpit parity | 23:15:08.083Z | `9b6e4ef` | keel |
   | 11 | `WO-2026-08-19-02` grants | 23:15:38.017Z | `9b6e4ef` | keel |

   **Every one carries `file_surface`, `live_authority`, `private_surface`, `credential_scope`, `network`, `dependency_policy`, `worktree` and `branch` as generated fields** — the two whose absence caused both of last session's refusals are present on all eleven. **Two orders record a worktree `MISMATCH` in the generated header rather than suppressing it.** Three were generated inside 31 seconds of each other for genuinely parallel work.
   **⭐ AND THE PAYOFF IS MEASURED, NOT ARGUED. See §7 F2:** `WO-2026-08-19-01`'s AC2 demanded *"a real browser session and a built trolley"* on the live-ASDA lane while the generated envelope's `live_authority` read `none`. **The worker refused the live interpretation and closed the AC against a scratch Chrome profile and a locally-written fixture.** The generated field is what made the contradiction visible and refusable.
   **The qualification, and it is real.** `build-015/cockpit-correction-control` — **Felix, 4 dispatches, 351,269 tokens, 279 tool uses, the highest tool-use count of any agent this session, merged into `main` three times** — has **no Work Order file anywhere in the repository**. A repo-wide search for the branch name returns only the Wayfinder, Vera's receipt and Vera's session log. Whether an order was generated and not committed is **UNESTABLISHED**. And `WO-2026-08-18-01` is used twice, on the one order whose `authorised_by` is a bare *"Warwick"* with no date and no quote.
4. **Prevention held: YES, 11 of 11 on the named failure.** Partially on completeness (1 builder stream unaccounted, 1 duplicate id).
5. **vs previous: `improved` — and it is the sharpest single-session reversal this series has produced, in the good direction.** 0 of 3 with two refusals → **11 of 11** with one refusal. It also beats the 7-of-7 benchmark of 2026-08-12 on volume.
6. **Still repeating despite being in Larry's starting context: NO.** It was the first family in the brief, and the prevention was executed on the first order of the session, 12 minutes in.

### 6.2 `control-cannot-reach-what-it-checks` — **RECURRENCE, ten instances, the dominant family**

1. **Told:** occ 4, **CHALLENGED**, clean 0 of 5. Cause: *"The convenient measurement is taken for the true one. A data structure that correlates with the outcome is easier to query than the outcome itself."* Must: *"Before trusting a control, make it fail on purpose. A check no test can fail is not a check."* **This is the first rotation in three in which this family reached the opening brief at all** — so the "he was not told" defence used in the last two reports is gone.
2. **Exposure: `recurrence`**, at greater volume than any family in any report in this series.
3. **Evidence — ten instances, each independently sourced.**

   | # | Instance | Source |
   |---|---|---|
   | 1 | **`37/37` measured a component the production path does not consume.** *"Both measurements are correct. They measure two different components at two different hops, and the one on the basket-building path is the wrong one."* Measured at the same head: **1 exact binding, 19 tolerant, of 37** | Veritas `4bc0894` |
   | 2 | **The Vera brief asserted what would render** from a real measurement of `command_names`. The control was **absent from the live DOM** | Vera receipt §9 |
   | 3 | **V-2 in the product:** the success guard *"tests for the absence of a specific negative instead of the presence of the positive the API publishes"* — *"the old path read `ok` as a result. This one reads not-duplicate as a result."* **It survived a mutation matrix because that matrix proved rendering and gating and never reached `asdairSubmitCorrection`** | Vera receipt §3 |
   | 4 | **`cockpitUi.test.js` tested a DEAD Directus extension** while the live Cockpit serves `services/cockpit/public/app.js` off disk. **A KNOWN LESSON** — the estate's own memory names `services/cockpit/README.md` as the SSOT for exactly this | map §12 |
   | 5 | **`GRANT_MATRIX` was a hand-maintained literal that never folded in `012`**, so *"no committed migration grants it"* was **false** | map §12 |
   | 6 | **A from-git rebuild "previously reported green across 139 assertions"** while `001`→`021` then `012` aborts on `relation "asdair.command_request" does not exist`, and three live tables are created by **no committed SQL anywhere** | map §12 item 7 |
   | 7 | **`basket_not_ready` reached the announcer and was dropped by a guard testing the wrong kind** — *"the announcement was being made and thrown away"*; and `basket_run_error` did not exist at all, so at the ceiling a request was marked permanently `failed` **naming no failure class**, which made the re-queue rule unable to resurrect it | map §12, AC5 |
   | 8 | **The reviewer's own instrument, three times in one gate.** A stale service-worker bundle reproduced V-2 falsely; a byte-length check compared **UTF-8 bytes to UTF-16 code units** and was *"nearly written up as staleness"*; and a **CRLF**-blind multi-line pattern made a mutant report SKIP while the runner printed *"AT LEAST ONE MUTANT SURVIVED"* — **conflating skipped with survived, which is a control misreporting its own coverage** | Vera receipt §10.2, §10.5 |
   | 9 | **⭐ The staleness guard in `capae-brief.mjs` cannot detect the defect it exists for.** `STALE_AFTER_DAYS = 14`; this brief was **0.954 days** old; `Math.floor` → 0; **no warning fired.** The guard is calibrated in days for a defect that is ordinal | `tools/governor/capae-brief.mjs:27,149-155` |
   | 10 | **Both Veritas receipts declare a `receipt_sha256` that does not match their own committed bytes**, checked under LF and CRLF. *"The integrity field on assurance receipts is decorative, which is worse than absent."* **Larry's disclosure, method stated; I have no shell and cannot recompute a digest. SINGLE-SOURCE, FLAGGED** | map §12, Assurance state |

   **Note the shape of instance 8, because it is the most instructive thing in the report.** Vera caught all three of her own instrument's defects **before** they became findings, recorded both halves rather than quietly fixing them, and wrote: *"a QA instrument that cannot prove which bytes it measured is the same class of defect as the control it was inspecting."* The harness now *"refuses to inspect without proof of provenance"*, with `assertFreshBundle` throwing before any assertion runs.
4. **Prevention held: NO on breadth. YES on discipline, and the discipline is materially better than last rotation.** The `must` — *make it fail on purpose* — was executed repeatedly and well: Vera ran **4 mutants at gate 2 and 3 at gate 3, all RED**, source restored under `finally` with md5 verified identical and `git status` clean; `render-vm-check.mjs` went from **zero** assertions naming the receipt fields to 12 direct calls and **284 assertions across 71 scenarios**; and gate 3's third mutant *"proves the fix did not over-correct into refusing every open-round receipt"* — **a guard in both directions, not just against the reported defect**, which is the mutation discipline done properly.
5. **vs previous: `unchanged`.** Recurrence last rotation (×4), recurrence again (×10) — at higher volume, with a materially better response, against a family whose state is already `CHALLENGED`.
6. **Still repeating despite being in Larry's starting context: YES — and for the first time in three rotations he was actually told.**

### 6.3 `built-tested-never-activated` — **RECURRENCE through the day, then the first production discharge in this build's history**

1. **Told:** occ 6, MONITORING, clean 2 of 5 *(true post-sync: occ 8, clean **0**)*. Must: *"Do not report an integration done until the thing it was built to do has actually happened once."*
2. **Exposure: `recurrence`.** I grade it a recurrence and not a clean, because the family's own bar was missed all day and cleared once at the end, and the map's own OPEN list still carries three instances.
3. **Evidence of recurrence — from the reviewer, not from Larry.** Veritas's regression table at `4bc0894` reads **CLOSED IN SOURCE** six times, and every one is paired:

   > *"CLOSED IN SOURCE. Order inverted, model bound in production deps, invariant pinned on source text. **Unexecuted in production**."* · *"CLOSED IN SOURCE … **The live rows are unchanged**."* · *"CLOSED IN SOURCE, and well … **The recording has never happened, because the decision has never run**."*

   And the dimension grades: *"213 executed subtests and a clean 37-of-37 corpus run prove the components. **Zero production executions of the decision point, zero browser executions, zero trolleys. Component proof is not the production path — the operating principle this role exists for.**"* `Completed automation` graded **FAIL** at gate 1 and **HOLD** at gate 2.

   **⛔ The sharpest instance:** the corrective work *"repaired the generator, not the artefact, and nothing regenerates it"* — seven live questions on Warwick's phone still carrying the deterministic scorer's cat food, and *"a tap on it still outranks the model by design."*
4. **⭐ Evidence of the DISCHARGE, and it is unambiguous. 2026-08-18T22:44:14Z — the first `decisionEvidence` row of its kind in the database:**

   | | |
   |---|---|
   | model | `gpt-5.6-terra`, `consulted: true` |
   | context | 109 catalogue rows · **39** rules · 37 lines |
   | contract | **45,932 bytes, sha256 recorded, per-source digests for both files** |
   | outcome | `selected [14,15,30,33]` · `searched [18,19]` · `asked [29]` · `rejected []` · `undecided []` |

   **Seven legacy questions became one.** It resolved unaided the four that failed on 17 August — sliced roast beef, the Heinz 6-pack, `Sure deodorant MALE`, plain toffees — sent Ben & Jerry's and the fruit lolly ices to a live search as genuinely new, and asked only about wet wipes, offering *Body wipes / Toilet wipes / Baby wipes* **where the old planner had offered cat food.** Warwick was notified 82 seconds later (ding 567, 22:45:36Z).

   **Three more discharged by execution the same night**, each with the property that makes it a proof rather than a demonstration:
   - **SIGKILL kill-and-revive, 11/11 against real PostgreSQL 17.4** — and *"the proof that makes it a proof: a second runner is REFUSED while the dead runner's lease is still live, and the row still shows the dead runner holding it — **a corpse, not a clean slate**."* The real schema *"earned its place in two minutes by failing the harness on a `NOT NULL`, a `CHECK` and a `FOREIGN KEY` a string-matching fake cannot have."*
   - **Real Chrome 151 launched by the shipping launcher**, all five boundaries refused on the live code path with a browser attached, including `Input.dispatchKeyEvent` — *"a process that cannot synthesise a keystroke cannot type a password or a card number"* — **while the trolley page stayed permitted, because a boundary is not a wall.**
   - **`browser_build_failed` 291 → 0.** A single line — `consume-request.cjs:152` passed a manifest **object**, `run-basket.cjs:332` read it as a **path** — had produced every one of 291 failures since 28 July.
5. **Prevention held: NO for most of the session; YES at the close, on the property that matters most.** Still open and still this family: the joined route has never run from a fresh photograph; the browser lane has touched nothing real; `shop_line_provenance` is empty across the whole database with no writer anywhere.
6. **vs previous: `improved`.** Previous: seven instances, zero discharges, graded `degraded`. This: broader recurrence in the record, and the family's own `must` satisfied by a production event for the first time in this build.
7. **Still repeating despite being in Larry's starting context: YES in the day's work, NO at the close.**

### 6.4 `record-amended-body-not-recut` — **RECURRENCE, and the recurrence was BLOCKING**

1. **Told:** occ 6, MONITORING, clean 0 of 5 *(true post-sync: clean **1** — its first, awarded by the previous report and **not shown to him**)*. Must: *"Supersede the body, or do not append the amendment."*
2. **Exposure: `recurrence`.**
3. **Evidence against — and unlike previous instances of this family, a reviewer graded it `blocking`.**
   - **Veritas Gate 2 defect 7, HIGH, `blocking`:** `SOP-021:9` and `SOP-021a:11` stated, **as standing instruction at the head of each document with no supersession banner**, that the live basket writer is *"Sonnet in Claude for Chrome"* — struck by goal contract S-5/S-7 a **full day earlier**. Graded `Documentation truth: FAIL`, blocking because *"it misdirects the current executable journey, which is the material-effect test in root `CLAUDE.md` §Finding disposition."* **Larry's own residual declaration understated it in both files (4 and 6 declared; 6 and 8 actual).**
   - **The whole §5.1 incident is this family at estate scale.** The ruling was superseded in the goal contract and the map on 2026-08-17 and left standing, contradicted, in the specialist contract (2026-08-05) and the shim (2026-08-11). **Eight hours and forty-four minutes of a working day were spent below the frontier as a result, and Warwick had to say it four times.**
   - Veritas `4bc0894` defect 5, MEDIUM, `blocking` for requirement 7's next enabling action: `CONFIGURATION.md` names `ASDAIR_CHROME_EXE`/`ASDAIR_CDP_ENDPOINT` while the production launcher requires `ASDAIR_CHROME_PATH`/`ASDAIR_CHROME_PROFILE_DIR`/`ASDAIR_CDP_PORT`. *"`RUNBOOK.md` is correct; the two disagree."*
   - Veritas `4bc0894` defect 7, LOW, clerical: an unclosed `~~` in the Wayfinder's gap-table row 4 swallows the rest of the row.
4. **Evidence FOR, and it is substantial — which is why this grades as a recurrence on the load-bearing instances rather than as a collapse of the discipline.**
   - **`7392c29` — "SOP AUTHORITY: one production browser method, struck where it stood"** — landed **26 minutes** after the FAIL receipt reached `main`, and Veritas verified independently at the next gate: *"all 14 remaining occurrences are struck through and marked SUPERSEDED with corrected law in force."*
   - **`34ead26` — "Wayfinder: supersede the body rows that still stated the superseded browser writer as active."** Larry hunted the same defect in his own map unprompted.
   - **`434a3dc` — "the session-report pointer is DISCHARGED, and the row is re-cut rather than appended to."**
   - **`85b2d54` — "Wayfinder §12: re-cut the current state whole"**, whose own text reads *"⛔ The 2026-08-18-morning block that stood here is REPLACED, not appended to"* and, in the same block, *"(This block had gone stale five times before; the discipline that failed each time was appending an amendment above a body that still contradicted it. Register entry S-12.)"*
   - **⭐ Both Veritas receipts ran an independent documentation-contradiction scan and found NO false completion claim anywhere in the Build or Wayfinder record.** Twice, at two heads, unprompted: *"No completion, PASS, closure or readiness claim was made anywhere in the current Build or Wayfinder record at this head. The merge commit message — 'the approved contract becomes load-bearing runtime behaviour' — is a true statement about source and does not claim an outcome."* **That is the half of this family with real consequence, and it is clean.**
5. **Prevention held: NO on `SOP-021`/`SOP-021a` and the specialist contract — the two that were load-bearing. YES on the Wayfinder itself, four separate times.**
6. **vs previous: `degraded`.** Previous was its first clean in five. This session it produced a **blocking** HIGH documentation defect a reviewer had to find, and a day of misdirected work.
7. **Still repeating despite being in Larry's starting context: YES.** And note the second-order cost of §6.5: the brief told him `clean: 0` when he had just earned his first clean, so **there was nothing on the record for him to protect.**

### 6.5 ⚠️ `capae-brief-snapshot-taken-before-sync` — **PROPOSED FAMILY, THIRD CONSECUTIVE RECURRENCE, and the previously recommended fix is ALREADY BUILT AND STRUCTURALLY CANNOT WORK**

1. **What Larry was told: NOTHING.** It is a proposed slug, not in the store. Re-proposed here, deliberately reusing the slug first proposed 2026-08-13, **because the same prevention addresses every occurrence.**
2. **Exposure: `recurrence`.**
3. **Evidence, measured to the second.**

   | Event | Timestamp | Source |
   |---|---|---|
   | **This session's SessionStart snapshot** | **2026-08-18T09:50:04.204Z** | `capae-opening.json` `snapshot_at` |
   | The previous rotation's step 7b (`populate.mjs`) | 2026-08-18T10:06:10.480Z | `session-report-populate.jsonl:28` |
   | The previous rotation's step 7c (`capae-sync.mjs`) | **2026-08-18T10:06:24.989Z** | `capae-active.json` `written_at` |

   > **Ordering gap: 16 minutes 20.785 seconds.** (Previous rotation: 36 m 49 s.) The brief carried `written_at: 2026-08-17T10:56:20.668Z` — the sync from **two** rotations ago, **22 h 53 m 43.5 s** stale at the moment it was frozen.

   **⛔ AND THIS ROTATION THE CONSEQUENCE IS MEASURABLE, WHICH IT NEVER WAS BEFORE.** The comparison table at the head of §6 is the finding: **three of four rows wrong, and every error but one flattering.** The mechanism is not random staleness — it is structural. **A rotation report is precisely the document that adds recurrences and resets clean counters, so a brief that predates it is systematically optimistic by construction.**
4. **⛔ THE PREVIOUSLY RECOMMENDED FIX IS ALREADY IMPLEMENTED AND CANNOT DETECT THIS DEFECT. This is the most important thing in this section and it is a correction to my own predecessor.**

   The previous report recommended, as option (b) and its stated preference: *"print the content's `written_at` in the brief so a stale one is visible on sight."* **`capae-brief.mjs:147-155` already does exactly that**, with a comment naming the failure it exists to prevent:

   > `// A STALE BRIEF SAYS SO. Presenting a fortnight-old list as current is the confident-wrong`
   > `// failure this estate keeps paying for; the age is cheap to state and the reader can discount it.`

   **It did not fire.** `STALE_AFTER_DAYS = 14`; the brief was **0.954 days** old; `Math.floor(0.954)` = **0**; `0 >= 14` is false. **A guard calibrated for a fortnight against a defect measured in minutes.** And the deeper point: **the defect is ORDINAL, not temporal.** A brief written 60 seconds before the snapshot would be equally wrong if a sync landed in between. **No day-counter, at any threshold, can detect "one sync behind."** It is itself instance 9 of `control-cannot-reach-what-it-checks` (§6.2).
5. **The prevention that would work, and it remains a sequencing decision rather than a mechanism.** At SessionStart, compare the brief's `written_at` against the newest `ts` in `session-report-populate.jsonl`; if a rotation has populated since the brief was written, **say so**. Both files already exist, both are already read by the rotation path, and `capae-brief.mjs` already reads `written_at`. **No new store, table, counter, watcher or control plane. The regrowth cap holds.** The alternative — take the snapshot after `capae-sync` — is a one-line ordering change but requires Pax to be on the blocking path, which `/rotate` step 6 deliberately forbids.
6. **A prediction of the previous report is FALSIFIED, and I record it against my predecessor rather than quietly dropping it.** It stated: *"This rotation's sync will reinstate [`acceptance-proves-mechanism-not-outcome`] as a recurrence… that is the correct mechanical outcome and it should be allowed to happen."* **It did not.** `capae-active.json` at 2026-08-18T10:06:24.989Z carries the same four slugs. `selectActive`'s **`limit = 4`** is sufficient to explain it: weights are `pilot×1000 + CHALLENGED×100 + min(occurrences,20)`, giving 6 · **105** · 8 · 6 for the incumbents, against ~3 for a MONITORING family at three occurrences. **It is crowded out.** The hypothesis the report before last offered and the last report dismissed is the correct one for *this* rotation — both were right about different rotations. **The family that recurred three-to-four times two sessions ago has now been invisible in two consecutive briefs.**

### 6.6 `rotation-close-cannot-name-its-own-closing-head` — **PROPOSED FAMILY, DID NOT RECUR, second consecutive zero-drift rotation**

The declared closing head `6f1ecd2bb658b203308c5ba60a9032592775e9d5` is exactly `.git/logs/refs/heads/main:596` and `.git/logs/refs/remotes/origin/main:311`. **Drift 0** at the moment I began. Committing this report and its payload makes it +1, the structural minimum. **Recorded as improved for the second rotation running; the proposal stands only in its template form.**

---

## 7. Findings

### F1 · `work-order-not-generated` — **CLEAN, 11 of 11**
Fully evidenced at §6.1. The sharpest reversal this series has produced, in the good direction. **Two residuals worth one line each, neither a Work Order:** Felix's Cockpit correction-control stream — the largest tool-use stream of the session — has no order file in the repository; and `WO-2026-08-18-01` is used twice.

### F2 · ⭐ **THE GENERATED ENVELOPE REFUSED AN ACCEPTANCE CRITERION THAT WOULD HAVE WRITTEN INTO WARWICK'S LIVE ASDA TROLLEY**
**This is the most consequential thing in the report and it is a POSITIVE.**

`WO-2026-08-19-01` AC2, verbatim: *"**THE LANE LAUNCHES AND EXECUTES.** … Take the lane from a queued request to **a real browser session and a built trolley**. Where a real Chrome is genuinely required, that is now available — **this AC is no longer offline-only**."* Its named boundaries are *"never book a slot, never check out, never pay, never enter the ASDA password, never auto-substitute"* — **all of which a fully built trolley in Warwick's live account satisfies.** The lane's production target is *"the authorised dedicated ASDA profile"*, signed in.

**Larry understood the risk for a different case in the same order** — its out-of-scope section rules the four terminal requests out because *"reviving them would build baskets for three-week-old lists **against Warwick's live ASDA account**"* — **and did not apply that reasoning to AC2.**

**The generated envelope's `live_authority: none` is what stood beside it.** The map records the outcome: AC2 closed with *"Real Chrome 151 launched by the shipping launcher on a **scratch** profile"* and *"⛔ **STILL OPEN: nothing has touched the real ASDA site, account or trolley.** No request left the machine — the fixture is written into the harness's own tab rather than fetched, so **the allowlist was neither used nor weakened**."*

**The control skipped last session — with two refusals for missing `file_surface` and `live_authority` — is the control that stopped him this session.** Family: **`work-order-not-generated`**, as its strongest positive evidence to date. **Not a Work Order. Not a Warwick decision.** The order-authoring lesson is already recorded on the map: *"an authority supplied in a dispatch message does not exist. It lives on the field of a generated Work Order or it is not a grant."*

### F3 · `control-cannot-reach-what-it-checks` — RECURRENCE ×10, the dominant family, with the best mutation discipline yet recorded
Fully evidenced at §6.2. **The narrow prevention Warwick may want is one sentence and it needs nothing built:** *before citing a measurement as evidence for a property, name the hop it was taken at.* Instances 1, 2, 4 and 5 are all one act — a real measurement of one component offered as a fact about another.

### F4 · `built-tested-never-activated` — RECURRENCE, then the FIRST PRODUCTION EXECUTION OF THE DECISION POINT IN THIS BUILD'S HISTORY
Fully evidenced at §6.3. **The durable output is the contract digest**, and Veritas named it before it ever ran: *"a reviewer can verify WHICH contract governed a decision instead of taking anyone's word that one did."* That is the estate's own *"rules must reach the decision point"* rule made **checkable** rather than merely asserted, and it is the structural answer to §5.1.

### F5 · `record-amended-body-not-recut` — RECURRENCE, and this time BLOCKING
Fully evidenced at §6.4. **The `SOP-021`/`SOP-021a` instance cost a working day and was found by a reviewer, not by Larry.** Against that, the Wayfinder itself was re-cut whole four times and two independent documentation scans found no false completion claim anywhere.

### F6 · `capae-brief-snapshot-taken-before-sync` — RECURRENCE ×3, now with a measured consequence and a falsified fix
Fully evidenced at §6.5. **The single most actionable item in this report**, and the fix is a sequencing decision, not a mechanism.

### F7 · ⚠️ The 125-line short merge — **LARRY'S DISCLOSURE, AND I COULD NOT LOCATE IT IN THE RECORD**
Larry disclosed: *"Larry merged a commit a worker named rather than the branch tip, so `main` was 125 lines short for four hours, **Veritas reviewed a head missing the code**, and the runtime was restarted twice onto it."*

**I checked every merge into `main` in the session range against the `origin/` remote-tracking reflog for its branch, and every one took the then-current origin tip:**

| Merge | UTC | Branch | origin tip at that instant | match |
|---|---|---|---|---|
| `ae6d8fc` | 13:38:32Z | `wo/b15-photo-path-proof` | `c907b5e0` (pushed 13:21:40Z) | ✓ |
| `4bc0894` | 21:22:17Z | `build-015/agentic-decision-path` | `b9aac0d9` (pushed 21:20:00Z) | ✓ |
| `8dbb2d8` | 21:50:12Z | same | `c8e7320` (21:24:07Z) | ✓ |
| `9b6e4ef` | 22:42:19Z | same | `01a1971` (22:28:59Z) | ✓ |
| `620f9b6` / `bb5a720` / `9d0db44` / `9daf10d` / `c0fad22` / `2e7ff43` / `53a5910` / `2617c59` / `dbdf041` | 08-18 23:54Z → 08-19 08:00Z | grants · lane-and-trolley ×4 · cockpit-parity · cockpit-correction-control ×3 | tip in every case | ✓ |

**No merge on `main` in this range carries a raw-SHA reflog message** (each reads `merge origin/<branch>`), so no merge of a named commit is visible. **Whatever happened is not reconstructible from `.git/logs`, and I have no diff capability to count 125 lines.**

**⛔ THE FINDING IS THE ABSENCE.** The most consequential Git error Larry names — a reviewer graded against a head missing the code, and a runtime restarted twice onto it — **has no durable record anywhere in the repository.** It survives only in a dispatch message and a transcript `/clear` will destroy. Under this estate's own standard that is indistinguishable from not having recorded it. Family: **`record-amended-body-not-recut`** (a correction made and the record not cut). **Confidence in Larry's account: I do not dispute it; I could not corroborate it. SINGLE-SOURCE, FLAGGED.**

**What I did measure, and it is the same risk in a form the record does show:** `build-015/lane-and-trolley` pushed four further commits to origin between 00:31:41Z and 01:04:03Z that `main` did not take until **06:42:42Z — a 6 h 16 m 09 s window**; and `build-015/cockpit-correction-control` pushed `ed03ba7` at 01:13:45Z which `main` did not take until **06:45:22Z — 5 h 31 m 37 s**. Both windows straddle a 6-hour overnight git silence, and `main` carried a *"re-cut the current state whole"* map commit at 00:37:04Z while four pushed product commits from an active worker sat outside it.

### F8 · The parent channel was NOT one-way — two message ids unaccounted for by `ding.mjs`
`~/.mypka/governor/ding-log.jsonl` runs **555 → 558**. Message ids **556 and 557 are missing.** Telegram message ids increment for every message in a chat regardless of sender, and `ding.mjs` logs a terminal outcome for every invocation including failures (all 17 entries in range read `sent`, `exit 0`). **Therefore two messages entered that chat from something other than `ding.mjs`** between 2026-08-17T18:03:59Z and 2026-08-18T10:01:51Z. The likeliest explanation is two replies from Warwick. **The window straddles this session's start (09:50:04Z), so attribution to this session is UNESTABLISHED.** Existence: confidence High. Attribution: confidence Low.
**This corrects the previous report's conclusion** that contiguous ids proved every message in the chat came from `ding.mjs`. The test was sound; the window has since produced a gap.

### F9 · A second Claude Code installation was live inside this session — the previous report's open question, SETTLED
Fully evidenced at §3. **Record and park under the hobby-brain rule, exactly as before — but it is now a fact rather than a hypothesis, and nothing in this session's record shows anyone looked.**

### F10 · The subagent ledger — no defect found, and it is the best in the series
All four totals cross-foot independently (§4.2). The cumulative-vs-per-dispatch property was **re-tested rather than inherited**, which `/rotate` 5b requires, and the re-test moved the stakes from ~80 % to **+101 %** overstatement. The one unmeasured agent is labelled UNMEASURED and not zero, and its dispatch is still counted. **Its uncertainties section names five limits without being asked to, including the one that matters most — that it is Larry-transcribed, not instrumented, so a missed return is invisible to it.** Stated positively because two of the last three reports had to state the opposite.

### F11 · The witness loop closed, and it closed in 24 minutes
The previous report's recommendation 3 — *"correct the phase-closed outcome row; '56 items, £135.02' appears in no artefact"* — was acted on at **`8bc3668`, 10:29:41Z, twenty-four minutes after the report itself was committed at `519803b` 10:05:35Z**. The map now reads: *"⚠️ CORRECTED 2026-08-18 — the figure this row carried has no artefact behind it… **Provenance UNESTABLISHED; the trolley-derived figure is the evidenced one**"*, with the original **not deleted** because it may be the checkout total Warwick actually paid.
**One note on authority, and it resolves in Larry's favour.** The commit is titled *"corrected on evidence, **not referred upward**"*, and the recommendation had said it was Warwick's call. **I grade this correct.** The applied fix is precisely the annotate-and-preserve option Pax listed, it is reversible, it deletes nothing, it labels the provenance UNESTABLISHED rather than choosing between the figures, and root `CLAUDE.md` names *"anything a safe no-action default already resolves"* as explicitly NOT a Warwick decision. **Asking would have been the acceptance failure.**
Recommendation 2 (restore the envelope route) was executed **11 of 11**. Recommendation 1 is §6.5. Recommendation 4 is §3/F9. **Recommendation 5 — add `Bash` to the Pax rotation dispatch — was NOT actioned, for the fourth consecutive rotation.**

### F12 · Three positives recorded explicitly, because a report that only counts failures stops being read
1. **The assurance shape was correct at both reviewers, and the cost/yield inverted.** Two Veritas gates, neither narrowed, all nine requirements graded twice, zero re-reviews of a receipt, the commissioning question certified in writing by the reviewer — and **30 defects for 31 % fewer internal-assurance tokens than last session's zero.**
2. **The reviewer caught three defects in her own instrument and published both halves.** Vera's stale-bundle near-miss, the UTF-8/UTF-16 byte comparison, and the CRLF-blind mutant that made "skipped" print as "survived". *"Recorded here rather than quietly fixed, because a QA instrument that cannot prove which bytes it measured is the same class of defect as the control it was inspecting."*
3. **Convergence at close is clean, and I checked it rather than accepting the map's claim.** All six working branches' origin tips are merged into `main`; `main == origin/main` at `6f1ecd2`; **53 pushes, every one a fast-forward chaining exactly to its predecessor, zero force pushes**; and the one dangling local branch (`build-015/b15-54-candidate-quality`) was created from `ccd3372` and **never committed to**, so it holds no unique line.

---

## 8. Work Order evidence

**Eleven Work Order files. Eleven generated. Eleven committed. Eleven with a verified governance head.**

| # | Order | Generated | Committed | Read-back outcome (from the commit record) | First dispatch substantive |
|---|---|---|---|---|---|
| 1 | `WO-2026-08-18-01` photo-path proof | ✅ | ✅ `e84709e` | no amendment recorded | **YES** |
| 2 | `WO-2026-08-18-02` photo-door readiness | ✅ | ✅ `e0a5c31` | **AMENDED** — `fc90818` *"four defects, all the worker's, all mine to own"* | no |
| 3 | `WO-2026-08-18-03` answer-binding repair | ✅ | ✅ `643566b` | **RE-CUT** — `05cd24b` *"my diagnosis was wrong, and the durable rows correct it twice"* | no |
| 4 | `WO-2026-08-18-04` audited answer correction | ✅ | ✅ `5eb0301` | **AMENDED** — `3567ca9` *"the correction would have been audited and silently inert"* | no |
| 5 | `WO-2026-08-18-01` **(dup id)** candidate quality | ✅ | ✅ `1dcb8a0` | **never dispatched** — diagnosis moved 12 min later | n/a |
| 6 | `WO-2026-08-18-05` AsdAIr resolves it | ✅ | ✅ `3f53532` | **worker KILLED mid-read** by Larry on Warwick's instruction; order superseded | no |
| 7 | `WO-2026-08-18-06 REV 2` MODEL DECIDES | ✅ | ✅ `6cf3dd3` | **REV 1 REFUSED** — the file's own `name` field records *"re-issued after a correct REFUSE"*; further amended at `8b5b3ff` | no |
| 8 | `WO-2026-08-18-07` board and lane | ✅ | ✅ `ed4fd88` | no amendment recorded | **YES** |
| 9 | `WO-2026-08-19-01` lane and trolley | ✅ | ✅ `1c3bfc5` | **AMENDED** — `d70ae16` *"Amend `file_surface` **ON THE FIELD**: `bot/**` added"* | no |
| 10 | `WO-2026-08-19-02` grants | ✅ | ✅ `1c3bfc5` | no amendment recorded | **YES** |
| 11 | `WO-2026-08-19-03` cockpit parity | ✅ | ✅ `1c3bfc5` | no amendment recorded | **YES** |

**Derived, from the commit record rather than from Larry's account:**

| | this session | previous | 2026-08-12 |
|---|---|---|---|
| Orders issued | 11 (10 dispatched) | 3 | 7 |
| **Generated through the envelope** | **11 of 11 (100 %)** | 0 of 3 | 7 of 7 |
| **First-dispatch substantive** | **4 of 10 = 40.0 %** | ≤1 of 3 = 33.3 % | 5 of 7 = 71.4 % |
| Amendments / re-cuts | **5** | 0 recorded | 0 |
| Refusals (`REFUSE`) | **1** | 2 | 0 |
| `CLARIFY` | **UNESTABLISHED** — Larry reports several; the verdict word is not in any artefact | — | — |
| Builder streams with no order file | **1** (Felix, cockpit-correction-control) | n/a | 0 |

**⭐ PREVENTABLE-FAILURE ANALYSIS — and it inverts the usual reading of a 40 % first-dispatch rate.**

| Defect caught | Caught by | Would it have shipped? |
|---|---|---|
| WO-02: four defects in Larry's framing | worker read-back | yes — the amendment is Larry's own *"all mine to own"* |
| WO-03: **Larry's diagnosis was wrong**, and the durable rows falsified it twice | worker read-back | **yes, and it would have built the wrong repair** |
| WO-04: the correction *"would have been audited and silently inert"* | worker read-back | **yes — a shipped feature that records an audit row and does nothing** |
| WO-06 REV 1 | worker **REFUSE** | yes — the order was re-issued, not argued with |
| WO-19-01 AC2: a built trolley against Warwick's live ASDA account | worker refusal, enabled by the envelope's `live_authority: none` | **yes, and into a real grocery order** |
| WO-19-01: `file_surface` missing `bot/**` | worker read-back | yes |
| The photo-door record's `document_impact: []` being untrue | worker read-back | yes — a parked-and-not-built row would have survived beside a ruling that overtook it |

**Seven caught defects. Zero false positives. Not one read-back was a procedural formality.** Larry's own sequencing line in `WO-2026-08-19-01` states the position and the evidence supports it: *"**READ-BACK FIRST, then HOLD. Every read-back you have given has found a real defect in my framing.**"*

**⚠️ The one durability gap, and it is the same class as last session's.** **`WO-2026-08-18-06 REV 1` does not exist in the repository** — only REV 2 does, and the REFUSE survives only in REV 2's own `name` field. The generator's design puts the challenge log inside the committed order file; here the refused revision was replaced rather than preserved. **At 39 dispatches a session, a read-back that is not written into the order file is a read-back that did not happen, as far as any future session is concerned.**

---

## 9. Parent channel — availability, latency, queued messages

**Instrument: `~/.mypka/governor/ding-log.jsonl`, entries 220–229. It records timestamp, outcome, exit code, `message_id` and byte count. It never records message bodies.**

| `message_id` | UTC | Bytes | Outcome | Nearest event |
|---|---|---|---|---|
| 558 | 2026-08-18T10:01:51.276Z | 1,105 | sent, exit 0 | orientation window; `d4d8dc4` 09:56:24Z (+5 m 27 s) |
| 559 | 10:19:37.103Z | 1,828 | sent, exit 0 | `434a3dc` 10:17:33Z (+2 m 04 s) — the previous session's Pax report landed and its pointer discharged |
| 560 | 10:23:20.854Z | **439** | sent, exit 0 | 3 m 44 s after 559. **Shortest non-trivial send; routine-narration candidate** |
| 561 | 12:14:39.591Z | 2,135 | sent, exit 0 | **precedes** Warwick's CORRELATION POLICY ruling (`fd89e6c` 12:37:56Z) by **23 m 17 s** — a decision request answered |
| 562 | 13:24:04.854Z | 2,112 | sent, exit 0 | between `05cd24b` and `ae6d8fc` |
| 563 | 13:40:20.892Z | **91** | sent, exit 0 | ⭐ **the real inbound photograph arrived at 13:42:37Z — 2 m 16 s later.** On timing this is almost certainly *"SEND THE PHOTO TO @Fusion247shopperbot"*. **Content UNESTABLISHED; confidence Medium-High** |
| 564 | 13:49:59.024Z | 1,383 | sent, exit 0 | shop reached `NEEDS_DECISION` at 13:49:22.814Z (+36 s) — the question board |
| 565 | 13:50:10.448Z | 1,608 | sent, exit 0 | **11.4 s after 564.** Two sends in twelve seconds |
| 566 | 19:30:43.184Z | 2,045 | sent, exit 0 | `d30201d` 19:30:09Z (+34 s) — **VERITAS GATE 2: FAIL.** A gate verdict, named in the criteria |
| 567 | 22:45:36.151Z | 1,880 | sent, exit 0 | ⭐ the first production `decisionEvidence` row, 22:44:14Z (**+82 s**) |

**Established:** channel **available** — **10 sends, all `exit 0`, zero `telegram-rejected`, zero transport failures, zero queued** (`ding.mjs` has no queue; every invocation logs a terminal outcome). **Send rate 10 in 1,384.60 min = 0.433/hour**, against 0.257 last session and 0.05 the session before — **the highest in three rotations, on a session in which Warwick was explicitly asked not to supervise.**

**Availability was confirmed 11 m 47 s into the session** (558 @ 10:01:51Z), which Rule 4a requires at orientation. Best of the three rotations measured.

**⭐ The two sends that discharge Rule 4a exactly:** **563** — 91 bytes, one instruction, and Warwick acted on it within 136 seconds; and **567** — the first production execution of the decision point, 82 seconds after the durable row. Rule 4a's *"a substantive outcome he would reasonably want to know immediately even when no action is required"* is answered precisely.

**⛔ THE FINDING: ZERO NOTIFICATIONS IN THE FINAL 10 h 09 m 04 s**, from 22:45:36Z on 08-18 to the closing head — and **no send had occurred at the moment I read the log** (after 08:57:53Z). Inside that silence:

| Event | UTC | Rule 4a criterion |
|---|---|---|
| Eight merges into `main` | 23:54:28Z → 08:00:29Z | **merges are named explicitly** |
| **Vera gate 1: FAIL, three HIGH** | 06:44:02Z | **a gate verdict** |
| **Vera re-gate: PASS** | 07:08:37Z | a gate verdict |
| **Vera final gate: PASS** | 08:36:42Z | a gate verdict |
| **The rotation itself** | 08:54:40Z | **`SAFE TO CLEAR` is named explicitly** |

**My grade, split, and it mostly favours Larry.** Warwick's authority quoted verbatim on both 08-19 Work Orders is *"Continue now and complete everything that does not require genuine human product input… **Do not ask Warwick to supervise any of it.**"* That is an explicit instruction, it covers the merges and the intermediate gates squarely, and the estate's own standing memory — *"NEVER ding just to check in"* — pushes the same way. **For the merges and the two intermediate Vera gates, no send was owed and not sending was correct.**

**It does not cover the rotation.** `SAFE TO CLEAR` is named explicitly in the criteria; the rotation ran after a six-hour overnight silence during which Warwick was, on the evidence, not at the keyboard; and a rotation is precisely the moment at which he needs to know he can put the phone down. **One send was owed at `6f1ecd2` and none had been made when I read the instrument.** *(If Larry sent one after 08:57:53Z it would not appear in my read; the timestamp bounds the claim.)*

**Was anything sent for routine narration?** **560 (439 bytes) is the only candidate**, and **its content is UNESTABLISHED — I will not grade a violation on a byte count.**

**Response latency: UNESTABLISHED — the log records deliveries, never replies.** One **upper bound** is derivable: notification 561 (12:14:39.591Z) → Warwick's ruling committed at `fd89e6c` (12:37:56Z) = **≤ 23 m 17 s** send-to-decision-in-Git. That is a bound including Larry's own drafting time, not a measurement of Warwick.

**Queued Warwick messages: 0** by the instrument. **See F8** — two message ids (556, 557) in that chat are unaccounted for by `ding.mjs` in a window straddling this session's start, which is the first evidence in this series of inbound traffic on the channel.

---

## 10. Documentation versus product change volume — the complete session range

**⛔ Every line count, files-changed and `--stat` figure is UNESTABLISHED. No Bash and no git binary in this grant, for the FOURTH consecutive rotation.** `.git/logs` carries SHAs, messages and timestamps and no diff content. **Commit classification below is derived from commit messages and from reading the working tree and the eleven order files at the closing head** — the second is a primary artefact I verified myself.

### On `main` — reflog lines 543–596, **54 ref updates**

| Class | Count | Note |
|---|---|---|
| **Merge commits (`ort`)** | **13** | from 6 branches; `agentic-decision-path` ×3, `lane-and-trolley` ×4, `cockpit-correction-control` ×3, plus photo-path-proof, grants, cockpit-parity |
| **Work Order files and dispatch admin** | **14** | the 11 orders plus 3 amendment commits — **the delegation instrument, not overhead** |
| **Map · record · governance · forward corrections** | **22** | including `a0a71f5` (contract + shim propagation), `7392c29` (SOP authority struck), `34ead26` and `85b2d54` (Wayfinder supersessions), and **four documents that correct an earlier commit forward** |
| **Assurance receipts** | **5** | Veritas ×2, Vera ×3 |
| **Product code committed directly to `main`** | **0** | every line of product change arrived through a branch merge |

### On branches — **≥21 content-bearing product commits**

| Branch | Commits identifiable | Merged into `main` |
|---|---|---|
| `wo/b15-photo-path-proof` | 4 | `ae6d8fc` |
| `build-015/agentic-decision-path` | 4 | `4bc0894`, `8dbb2d8`, `9b6e4ef` |
| `build-015/lane-and-trolley` | 7 | `bb5a720`, `9d0db44`, `2e7ff43`, `53a5910` |
| `build-015/cockpit-correction-control` | ≥4 (`c542062`, `0045e14`, `ed03ba7`, `c66f14c`) | `c0fad22`, `2617c59`, `dbdf041` |
| `build-015/cockpit-parity` | ≥1 | `9d0db44` |
| `build-015/grants` | ≥1 | `620f9b6` |

**This is a floor, not a count.** A push updates the remote ref to its tip only, so any push carrying more than one commit is undercounted. **Exact figure: UNESTABLISHED.**

### Ratios

> **41 non-product commits on `main` : ≥21 content-bearing product commits on branches = ≤ 1.95 : 1.**
> Previous session **5.0 : 1**; the session before **2.31 : 1**. **Best in the series, and the true figure is better than stated.**

**And the numerator is honest work, not padding.** 14 of the 41 are Work Order files — the delegation instrument that F2 shows earning its cost. 5 are reviewer receipts. Of the 22 record commits, **four are documents that correct an earlier commit forward with the wrong version quoted** (`8e5f317` correcting `ccd3372`, `a33369a` correcting `3f53532`, `76637e3` correcting an acceptance standard, `8bc3668` correcting the phase-closed row). **A forward correction is not overhead; it is the record refusing to carry a false claim.**

**Pushes to `origin/main`: 53** (reflog lines 259–311), one per commit, **every one a fast-forward chaining exactly to its predecessor. Zero force pushes. `main == origin/main` at `6f1ecd2`.**

---

## 11. UNESTABLISHED — the complete list

1. **Every line count, files-changed and `--stat` figure.** No Bash and no git binary — **fourth consecutive rotation.**
2. **The opening context reading, and therefore total measured context movement.** The sampler keeps one overwritten JSON per session id; 77 files exist for this project and none carries history. *(Partially mitigated for the first time: the seven-day quota moved a measured +27 points, §4.1.)*
3. **The apportionment of the 18 h 32 m of git-silent time.** Bounded below by 524 min of concurrent subagent wall time; no instrument records dispatch start/finish intervals.
4. **The 125-line short merge (F7).** Larry's disclosure; every merge in the range took the then-current origin tip, no raw-SHA merge appears on `main`, and no artefact records it. **Single-source.**
5. **The `receipt_sha256` mismatch on both Veritas receipts.** Larry's disclosure with a stated method; I have no shell and cannot compute a digest. **Single-source.**
6. **Whether an order file was ever generated for Felix's `cockpit-correction-control` stream.** None exists in the repository.
7. **The `CLARIFY` count.** Larry reports several; the verdict word appears in no artefact. Five amendments and one REFUSE are evidenced from commit messages.
8. **Whether the `011` claim (§5.3 row 5) is the same event as the `GRANT_MATRIX`/`012` finding.** Confidence: Low.
9. **The bodies of all ten notifications.** The ding log records bytes and outcomes, never content — so whether 560 was routine narration cannot be established, and 563's content is inferred from timing alone.
10. **Attribution of message ids 556 and 557.** Their existence outside `ding.mjs` is established; the window straddles this session's start.
11. **Parent-channel response latency.** Bounded at ≤23 m 17 s on one interval; not measured.
12. **Parent-channel availability across the final 10 h 09 m.** Never exercised, so never confirmed.
13. **The token cost of the killed Keel dispatch `ab5aa89b…`.** **UNMEASURED, NOT ZERO.** All percentages are of measured traffic.
14. **A token figure for corrective rework.** At least one whole dispatch and one REFUSE round trip; the latter is not separable from its agent's cumulative total.
15. **Precise time spent waiting on Warwick.** Bounded at ≤ ~25 min from one measured interval.
16. **Larry's own context as a FLOW.** No instrument reads it; correctly excluded from Total A.
17. **Whether the second Claude Code installation (§3, F9) wrote to any worktree.** Its liveness inside this session is now established; its actions are not.
18. **Whether `acceptance-proves-mechanism-not-outcome` is `EFFECTIVE`, absent from the store, or merely below `selectActive`'s cap.** The cap is sufficient to explain its absence; the underlying store is not readable from this grant.

---

## 12. Methodology, and its limits

**What I read, in order.** `Team/Pax - Researcher/AGENTS.md` and root `AGENTS.md` · the two mandatory inputs in full, including the ledger's uncertainties section · the previous report and payload for the comparison baseline · `.git/logs/refs/heads/main` (543–596), `.git/logs/refs/remotes/origin/main` (259–311), and **six branch reflogs with their `origin/` counterparts**, which is how F7's merge table was built · `~/.mypka/governor/{capae-opening,capae-active}.json`, `ding-log.jsonl`, `session-report-populate.jsonl`, and three sampler files under `health/C--Fusion247PKA/` · **all eleven Work Order files' generated headers and authority blocks**, and `WO-2026-08-19-01` in full · **both Veritas Gate 2 receipts in full** · **Vera's three-gate receipt in full (684 lines)** · the Wayfinder's ⚑ WORK CLASSIFICATION block, operational contract, ten gaps and §12 RESUMABLE STATE · the four forward-correction deliverables · and, **as a source rather than as a description**, `tools/governor/capae-brief.mjs`.

**Cross-source discipline.** Every load-bearing claim rests on at least two independent sources, and the exceptions are labelled in place (§11 items 4, 5, 8, 9). Specifically:

- **I did not accept Larry's self-criticisms on trust.** F7's 125-line merge is his account and **I say plainly that I could not corroborate it**, with the merge table showing what I checked.
- **I did not accept his self-credit either.** The 11-of-11 Work Order figure is from the files' own generated headers; the assurance shape is from the reviewers' own receipts; the convergence claim was re-derived from six branch reflogs rather than taken from the map's *"every branch merged with containment asserted."*
- **The `37/37` finding is taken from Veritas's receipt**, which is not Larry's writing, and the reviewer's own framing (*"the declaration rather than the resolution was the right call"*) is reported alongside it.
- **Two corrections against Larry that the commission did not name:** the Vera brief (§5.3 row 6) and the `SOP-021` understatement (§5.2), both found by reviewers, neither in his list to me.
- **One correction in his favour:** he reported the read-back gate as catching defects; the commit record shows **seven**, and one of them stopped a live grocery write.
- **Two corrections against my own predecessor**, because a witness that never corrects its predecessor is not a witness: the recommended CAPAE fix **is already built and structurally cannot work** (§6.5), and the prediction that `acceptance-proves-mechanism-not-outcome` would be reinstated is **falsified** (§6.5.6). The previous report's dismissal of the `limit = 4` hypothesis was correct for *its* rotation and wrong for this one.

**A methodology self-catch, recorded because the previous two reports recorded the same class.** `Grep` returned only three files matching `cockpit-correction-control` and I nearly wrote *"Felix's stream has no Work Order"* as a flat negative. **A grep over `*.md` is not a search of the repository.** I widened the check, confirmed the eleven order files by their generated headers, and stated the finding as *"no order file exists in the repository; whether one was generated is UNESTABLISHED."* **A negative claim requires verification, and the honest form of an unverifiable negative is a bounded one.**

**⚠️ The limit that bounds this report, now recurrent FOUR times.** **Fourth consecutive rotation with no shell and no git binary.** Everything in §10 that Warwick would most want — lines changed, files touched, real diff volume — is unavailable for the fourth time running; F7 could have been settled in one `git log --stat`; and §11 item 5 could have been settled with `sha256sum`. **The fix remains one word in the dispatch's tool grant.** `Bash` in the Pax grant would convert items 1, 4, 5 and part of 6 from UNESTABLISHED into measurements.

---

## 13. Recommendations — evidence and options, never a decision

1. **⭐ Fix the CAPAE ordering (§6.5).** Third consecutive recurrence, and this time the consequence is measured: **the brief was wrong on three of four rows and every error but one flattered the estate.** The previously recommended fix is already committed and cannot detect it — `STALE_AFTER_DAYS = 14` against a 0.954-day-old brief, guarding a defect that is ordinal rather than temporal.
   **Two options.** **(a)** At SessionStart, compare `capae-opening.json`'s `written_at` against the newest `ts` in `session-report-populate.jsonl` and say *"a rotation has synced since this brief was written"* — both files exist, both are already read by the rotation path, nothing new is built. **(b)** Take the snapshot after `capae-sync` — one line, but it puts Pax on the blocking path, which `/rotate` step 6 deliberately forbids.
   **Recommended: (a).** It degrades safely, it detects the actual failure rather than a proxy for it, and it makes the defect self-reporting. **The regrowth cap holds.**
2. **⭐ Add `Bash` to the Pax rotation dispatch (§12).** **Four consecutive reports** have gone out with documentation-versus-product volume unmeasurable, and this one additionally could not corroborate the session's most consequential Git error or verify a receipt digest. **One word in the tool grant.**
3. **Preserve the refused revision of an order (§8).** `WO-2026-08-18-06 REV 1` no longer exists; a REFUSE that caught a real defect survives only in the successor's title. **No mechanism needed** — write the revision to a new filename rather than overwriting. At 39 dispatches a session this is the difference between a read-back gate and a rumour of one.
4. **Two clerical residuals to fold into the scheduled reconciliation, not now:** the duplicate `WO-2026-08-18-01` identifier, and the missing order file for Felix's `cockpit-correction-control` stream.
5. **Establish the second-installation question once (§3, F9).** **Downgraded from the previous report's framing, because it is now a fact rather than a hypothesis and it still does not clear the hobby-brain bar.** Record, park. Not a Work Order. It rises above noise only because eight worktrees were in play and `/clear` does not kill background workers.
6. **⚠️ One send appears owed and unmade: the rotation (§9).** `SAFE TO CLEAR` is named explicitly in Rule 4a and no notification had been sent at `6f1ecd2` when I read the instrument. **Not a Work Order — a one-line correction to the turn.**
7. **Not recommended as Work Orders: nothing in this report.** **No finding meets the `BLOCKS_CURRENT_MERGE` bar**, and none of it justifies building anything. F8 and F9 are record-and-park under the hobby-brain rule. **The blocking findings that matter are the reviewers' own, and both receipts already name their owner, their disposition and what would discharge them.**
8. **For Warwick, one line and no decision required:** the exact next action on the map is *"on 20 August or later, send Warwick one message, and it says only: SEND THE PHOTO TO @Fusion247shopperbot."* **Nothing in this report changes that, and nothing in this report asks him for anything.**

---

*Pax. Cross-source verified where possible; single-source claims flagged in place; nothing estimated.*
