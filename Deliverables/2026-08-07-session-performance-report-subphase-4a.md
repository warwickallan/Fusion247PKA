# Session performance and process report — BUILD-020 Sub-phase 4A closure (2026-08-06 → 2026-08-07)

```yaml
session_date: 2026-08-07
branch: build-020/phase4-automation-law
session_start_head: f6ce6a12d0d864b50e8cf4e224d305187fd4525e
closing_head: ccb4132e6d13a8f2e34f80019b8fefa79cdb1a6f
closing_head_short: ccb4132
session_range: f6ce6a12d0d864b50e8cf4e224d305187fd4525e..ccb4132e6d13a8f2e34f80019b8fefa79cdb1a6f
map_path: Deliverables/2026-08-04-proofline-wayfinder-plan.md
deliverable_path: Deliverables/2026-08-07-session-performance-report-subphase-4a.md
payload_path: Deliverables/2026-08-07-session-report-payload-subphase-4a.json
author: pax
host: claude
work_order: /rotate step 5 — session performance and process report
governance_head: ccb4132e6d13a8f2e34f80019b8fefa79cdb1a6f
private_surface: none
review_ceiling: ~45 minutes (named in dispatch; not extended)
prior_report: Deliverables/2026-08-06-session-performance-report-rotate-careerair-mcp.md
```

**Labels.** **[E] ESTABLISHED** — read by me from an instrument or artefact on disk. **[E-1S] ESTABLISHED, SINGLE SOURCE** — one source only, named, not independently verifiable by me. **[I] INFERRED** — reasoned, not observed. **[U] UNESTABLISHED** — named so it is never mistaken for evidence.

**🔴 The bar applied.** No figure in this report is an estimate. Every number was read from the ding transport log, the git evidence Larry staged, a committed Veritas receipt, or a committed Deliverable — or it is marked **UNESTABLISHED**. Where I could compute a total from measured components I did the arithmetic and say so; where I could not, I left the gap open. **I reconstructed no number from narrative.**

---

## READ-BACK

| Item | Restatement |
|---|---|
| **Outcome** | A Markdown session performance report and a matching JSON payload in `Deliverables/`, both describing the same session, branch and exact closing head `ccb4132e6d13a8f2e34f80019b8fefa79cdb1a6f`, with every mandated metric present as a measured value or an explicit `UNESTABLISHED`. |
| **Plan** | Read the staged evidence; independently re-read the ding transport log at source; read the three Sub-phase 4A Veritas receipts, the WO-23 refusal record and the 4A closure record; cross-check Larry's handed facts against committed artefacts; compute only what measured components support. |
| **What the order did not settle** | Larry's own opening/closing context readings were **not** handed to me and I have no sampler → context economics are UNESTABLISHED. Wall-clock elapsed is not instrumented. Notification *content* is not exposed by the transport log, so "was this routine narration" cannot be answered from the log alone. |
| **What looks wrong** | Three things, all against Larry. (1) The staged product-file list does not reconcile with the staged product totals — one file and +112 insertions are missing. (2) Larry describes WO-24 as repeating "the same two defects"; the committed record shows **four of four** WO-23 refusal classes recurred. (3) Larry frames the surface/contract violation as new to WO-23; the prior session's own reports record **WO-22** refused on that exact class earlier the same day, making WO-24 the **third** consecutive Keel order refused on it. |

---

## 1. Executive summary

Sub-phase 4A closed with a genuine **Veritas PASS** at `c50d8cb`, and the closure record banked in Part 2 is high-quality durable evidence. That is the real product of the session.

The process cost of getting there was severe and almost entirely self-inflicted. **Every numbered Work Order issued this session was refused at read-back (0 of 2), for the third consecutive Keel order refused on the same preventable class.** **Sub-phase 4A required three assurance rounds**, the first two failing on preventable defects. **88.3% of committed insertions were documentation** [E], and of **2,221,596 measured subagent tokens** [E-1S], **5.1% went to the only specialist-delivered product change that survived the session** — the CareerAIR alert mute.

The single most useful analytical finding is not any one failure but their shared shape: **four separate times this session, a claim was verified against a proxy instead of against the destination**, and each time the proxy passed while the truth was false.

---

## 2. Mandatory metrics — every row required by `/rotate` step 5

| # | Metric | Value | Label |
|---|---|---|---|
| 1 | **Opening context/token reading** | **UNESTABLISHED** — not handed to me; I hold no sampler for the parent context | [U] |
| 2 | **Closing context/token reading** | **UNESTABLISHED** — same reason | [U] |
| 3 | **Total measured context/token movement** (parent) | **UNESTABLISHED**. *Not* substitutable by the subagent ledger below, which measures a different thing | [U] |
| 4 | **Elapsed session time** | **UNESTABLISHED** as wall-clock. Two instrument spans are given in §3 and are **not** summed, because the git-log timezone offset is itself unestablished | [U] / [E] spans |
| 5 | **Per-specialist dispatch counts** | **15 dispatch instances** across **5 specialists** — Veritas 4, Pax 3, Nolan 3, Mack 3, Keel 2 | [E-1S] |
| 6 | **Per-specialist token usage** | **2,221,596 total** — full breakdown §5. Measured in Larry's transcript, handed to me, arithmetic mine | [E-1S] |
| 7 | **Evidenced allocation** (product / WO-admin / assurance / rework / waiting) | **As token share only** — assurance 29.9% · research-advisory 39.6% · product-implementation attempts 21.7% · Work-Order refusal 8.9%. **Waiting: UNESTABLISHED.** **As time share: UNESTABLISHED.** §6 | [E-1S] tokens / [U] time |
| 8 | **Parent-channel availability** | **TRUE** — 6 of 6 sends `outcome:"sent"`, `exit:0`. Zero transport failures this session | [E] |
| 9 | **Parent-channel response latency** | **UNESTABLISHED** — the log records send time only; no arrival, read or reply instrument exists | [U] |
| 10 | **Queued Warwick messages** | **0** — no queue outcome rows in the log | [E] |
| 11 | **Work Order first-dispatch success** | **Numbered Work Orders: 0 of 2.** All dispatch instances: **13 of 15** began substantive work | [E] |
| 12 | **Amendments / round trips** | **0 amended orders.** Both refusals were answered by route change or deferral, never by a corrected order — §7 | [E] |
| 13 | **Refusals** | **2** — WO-23 (Keel), WO-24 (Keel). Both `REFUSE` at read-back, both preventable, both Larry's | [E] |
| 14 | **Documentation vs product change volume**, whole range | **18 files, +1834 / −146.** Doc 13 files +1620/−47; product 5 files +214/−99. **doc share of insertions 88.3%** | [E-1S] |
| 15 | **Notification misses** | **≥1, and up to 3, owed and not sent** — three Veritas gate verdicts returned after the last logged send. §8 | [E] absence / [I] owedness |
| 16 | **Notifications sent for routine narration** | **UNESTABLISHED from the instrument** — the transport log records bytes, not content. Two indicators recorded in §8 | [U] |

---

## 3. Session span — what the clocks actually support

Two independent instruments, deliberately **not** combined.

| Instrument | Span | Reading |
|---|---|---|
| **Committed-activity span** (git log, local clock) | `9171248` 08-06 21:02 → `ccb4132` 08-07 01:26 | **4 h 24 min** between first and last commit of the session [E-1S] |
| **Notification span** (ding log, UTC) | msg 349 `20:40:13.936Z` → msg 354 `23:21:48.898Z` | **2 h 41 min** of logged send activity [E] |

**Why they are not added or reconciled.** The staged git log carries local wall-clock with no offset; the ding log carries UTC. I could not establish the offset from any artefact available to me, and two plausible offsets (UTC+0, UTC+1) both fit the interleaving. **Elapsed session time therefore remains UNESTABLISHED**, and the two spans are reported on their own clocks. *(The one conclusion that is robust to the offset is in §8: under every offset between −1 and +1, the last three commits fall after the final logged notification.)*

**Session start boundary — a recorded inconsistency, not resolved.** The staged evidence gives session start as "~20:50 local", but Larry attributes message **349** (`20:40:13Z`) to this session. Separately, message **348** (`19:49:48Z`) is covered by **no** session report: the prior report's window closed at 347, and this one opens at 349. One notification therefore falls in an audit gap between two consecutive reports. [E] — recorded once, not chased.

---

## 4. Work Order evidence — every order, its verdict, and first-dispatch behaviour

### 4a. All 15 dispatch instances

| # | Dispatch | Began substantive work on first dispatch? | Outcome |
|---|---|---|---|
| 1 | **Keel — WO-23** (hooks) | **NO** — refused at read-back, wrote nothing | **REFUSE** |
| 2 | **Veritas — Gate 1, amended WP @ `0cf70c9`** | YES | **FAIL** |
| 3 | **Pax — transferability research** | YES | delivered |
| 4 | **Nolan — transferability review** | YES | delivered |
| 5 | **Pax — operating-model reconciliation** | YES | delivered |
| 6 | **Nolan — operating-model review** | YES | delivered |
| 7 | **Mack — CareerAIR alert mute** | YES (read-back, then executed) | **delivered — the session's one surviving specialist product change** |
| 8–9 | **Mack — flashing console fix** (2 instances) | YES | **handback `permission`** — built, self-proved, rollback captured, **not applied** |
| 10 | **Pax — Sub-phase model** | YES | delivered |
| 11 | **Nolan — Sub-phase review** | YES | delivered |
| 12 | **Keel — WO-24** (Cockpit) | **NO** — refused at read-back | **REFUSE** |
| 13 | **Veritas — Sub-phase 4A @ `2cf3673`** | YES | **FAIL** |
| 14 | **Veritas — Sub-phase 4A @ `52427cd`** | YES | **FAIL** |
| 15 | **Veritas — Sub-phase 4A @ `c50d8cb`** | YES | **PASS** |

**First-dispatch substantive-work rate: 13/15 = 86.7%** [E-1S].
**First-dispatch success on numbered Work Orders: 0/2 = 0%** [E]. *Both numbered orders issued this session were refused before any work began.*

### 4b. The refusals — class, preventability, and what each one cost

| Order | Refusal conditions | Preventable? | Cost |
|---|---|---|---|
| **WO-23** (Keel, hooks) | **R1** order targets `.claude/**`, a surface Keel's critical rule 5 permanently forbids · **R2** hand-authored, **no `GENERATED by tools/wo/envelope.mjs` marker** (SOP-022 J1-1), no `hand_authored_exception` · **R3** missing mandatory `file_surface` (+ ~17 envelope fields) · **R4** two acceptance criteria only the parent or Warwick could fire | **YES — all four, every one checkable before dispatch** | 95,281 tokens; work re-taken by Larry under the Rule 4 exception |
| **WO-24** (Keel, Cockpit) | **Same four classes recur:** no `file_surface` · **no `GENERATED by` marker** · acceptance tests unexecutable · order invited writes under `Team Knowledge/`, forbidden by the same critical rule 5 | **YES — and R2 was a repeat of an explicitly acknowledged failure with a written remedy** | 101,912 tokens; order **not** regenerated in-session, deferred to 4B step 4 |

**🔴 Correction against Larry, in the harsher direction.** The Work Order describes WO-24 as repeating "the same two defects again". The committed closure record §2.1 lists **four**: no `file_surface`, no envelope marker, unexecutable acceptance tests, and a contract-forbidden surface. **Four of WO-23's four refusal conditions recurred, not two.** [E — `2026-08-06-wo23-keel-refusal-and-findings.md` §"four refusal conditions" vs `2026-08-07-subphase-4A-closure-and-4B-handover.md` §2.1]

**🔴 The repeat is older than this session, and Larry did not hand me this.** The contract-surface violation is not new to WO-23. The prior day's reports record **WO-22 (Keel) refused for exactly this class**: *"Order assigned Keel a surface his contract permanently forbids; Work Order cannot override permanent contract"* [E — `2026-08-06-session-performance-report-gate1-pass.md`], and *"WO-22 Keel — preventable surface/contract mismatch"* [E — `2026-08-06-session-performance-report-rotate-careerair-mcp.md`]. **Three consecutive Keel Work Orders — WO-22, WO-23, WO-24 — were refused, and the surface/contract-mismatch class is present in all three.** Two independent prior reports corroborate WO-22's class. Confidence: **High**.

**The remedy was written and then not executed.** WO-23's own disposition records: *"Also accepted: R2 is a real process failure by Larry. Future Work Orders in this package go through `node tools/wo/envelope.mjs`."* The next Work Order in the same package was hand-authored. **The gap is not knowledge — the correct remedy was identified, written down and committed. The gap is that nothing binds the remedy to the event.** This is the estate's own recorded lesson *"Compensating habits decay silently — bind to an EVENT, never a habit"*, reproduced inside one session. Confidence: **High**.

### 4c. Amendments and round trips

**Zero amended Work Orders.** Neither refusal produced a corrected order in-session:

- **WO-23** → Larry took the work directly under the Rule 4 four-condition exception, stated before acting. Defensible: `.claude/**` has **no contracted owner**, so delegation overhead was not merely large but *infinite*. **This is a genuine governance gap, correctly raised once for Warwick and correctly not converted into a Work Order.** [E]
- **WO-24** → deferred whole to Sub-phase 4B step 4, with the regeneration requirements banked.

**Process observation:** the read-back gate fired twice, and on neither occasion did the estate's Work Order route produce a valid order. The gate is working; the authoring step in front of it is not. [I]

---

## 5. Token and context economics

### 5a. Parent context — UNESTABLISHED, and why

| Figure | Value | Label |
|---|---|---|
| Opening context/token reading | **UNESTABLISHED** | [U] |
| Closing context/token reading | **UNESTABLISHED** | [U] |
| Total parent context/token movement | **UNESTABLISHED** | [U] |
| Host version string | **UNESTABLISHED** | [U] |

**Why.** These were not included in the staged evidence, and I hold no instrument that samples the parent context. **The subagent ledger below is not a substitute** — it measures specialist context consumption, not the parent's, and treating one as the other would be exactly the estimate this report is forbidden to make.

### 5b. Subagent token ledger — measured in Larry's transcript, arithmetic mine

**Source: Larry's transcript, handed to me as measured. Single-source: I cannot independently verify these figures. [E-1S]** All totals and percentages below are my arithmetic over those figures.

| Specialist | Instances | Tokens | Share |
|---|---|---|---|
| **Veritas** | 4 | **663,631** | 29.9% |
| **Pax** | 3 | **502,531** | 22.6% |
| **Mack** | 3 | **481,422** | 21.7% |
| **Nolan** | 3 | **376,819** | 17.0% |
| **Keel** | 2 | **197,193** | 8.9% |
| **TOTAL** | **15** | **2,221,596** | 100.0% |

Per-instance detail: Keel 95,281 · 101,912 — Veritas 136,306 · 143,115 · 177,124 · 207,086 — Pax 199,450 · 147,074 · 156,007 — Nolan 127,157 · 128,293 · 121,369 — Mack 113,412 · 196,137 · 171,873.

### 5c. The rework tax, computed from the ledger

| Category | Tokens | Share of all subagent tokens |
|---|---|---|
| **Veritas 4A re-review rounds 2 and 3** — exist only because rounds 1 and 2 failed on preventable defects | **384,210** | **17.3%** |
| **Keel — two refused Work Orders** | **197,193** | **8.9%** |
| **Combined spend downstream of a preventable Larry defect** | **581,403** | **26.2%** |

**Stated fairly, because the refusals were not worthless.** Keel's two preflights produced findings of real value — WO-23's F1 **refuted Larry's stated root cause** and prevented a green test that would have left the defect live; WO-24's preflight established that `/api/health` cannot be tested by starting the server without touching production Postgres. A valid order would have surfaced the same findings. **The marginal waste is the refuse-and-regenerate cycle, not the whole 197,193** — I decline to inflate the number. The Veritas 384,210 has no such offset: both failing rounds re-reviewed defects that a sentence-level self-check would have caught, and the closure record itself now says so.

### 5d. What the spend bought

| Outcome class | Tokens | Share |
|---|---|---|
| Research and advisory (Pax ×3 + Nolan ×3) | 879,350 | **39.6%** |
| Assurance (Veritas ×4) | 663,631 | **29.9%** |
| Product implementation attempts (Mack ×3) | 481,422 | **21.7%** |
| Work Order refusal (Keel ×2) | 197,193 | **8.9%** |

**🔴 The figure that matters.** Of the 21.7% spent on product implementation, the largest component — **368,010 tokens across two Mack dispatches on the flashing fix — ended in a `permission` handback with the fix built, self-proved, rollback-captured and NOT APPLIED.** The only specialist-delivered product change that survived the session is the CareerAIR alert mute at **113,412 tokens = 5.1% of measured subagent spend.**

**This triangulates with an independent instrument.** The git volume says **88.3% of insertions were documentation**. Two unrelated measurements — a token ledger and a diff — agree that this session was overwhelmingly not product work. Confidence: **High**.

---

## 6. Evidenced allocation

**Time-based allocation across product / admin / assurance / rework / waiting is UNESTABLISHED.** No timing instrument spans the session's phases. **Waiting time is entirely UNESTABLISHED** — nothing records how long the parent was blocked on a dispatch.

The **only** evidenced allocation instruments are the token ledger (§5) and the change volume (§9), and both are reported as what they are. **I did not convert either into a time percentage.**

---

## 7. Assurance rework — three rounds to close one Sub-phase

| Round | Head | Verdict | Blocking findings | Preventable by Larry? |
|---|---|---|---|---|
| 1 | `2cf3673` | **FAIL** | F1 the single claimed next action directs **descoped** work · F2 line 1576 declares merged Phase 3 "THE LIVE FRONTIER" · F3 · F4 · D-7 false completion claim · D-9 two residuals false at head | **YES** |
| 2 | `52427cd` | **FAIL** | F5 **a tenth directive survives inside its own retirement banner** · F6 `📌 ROTATION (this /rotate)` records another host's rotation | **YES** |
| 3 | `c50d8cb` | **PASS** | — | — |

**Round 1's root cause, in Veritas's words:** *"Larry's claimed enumeration verified where the arrows point; it did not verify that the destination is true. Nine rows were enumerated where twenty-four exist."* And on the control: *"`grep -c "THIS IS NOW THE LIVE FRONTIER"` returns **1**, not zero"* — because the live text read *"THIS **SECTION** IS NOW THE LIVE FRONTIER"*. **A string literal was used to discharge a semantic completeness claim.** [E]

**The map had already written the rule that was broken.** Veritas cites the active map's own line 2184: *"a completeness claim should either be mechanically enumerated or stated as 'the instances I found'."* The estate authored the guard, committed it, and then failed it in the same document. [E] — this is the single most quotable process finding of the session.

**Round 2's root cause is a genuine method subtlety and is recorded fairly.** The survivor shared a line with struck text, so any *"ignore lines containing `~~`"* filter reads it as retired — **and Veritas's own first-pass filter made the identical mistake before finding it by reading the block.** The remedy is cheap and requires no new mechanism: re-run the sweep on the repaired file, matching by **sentence**, requiring zero unstruck survivors. [E]

**Credit where the record supports it.** Round 3 recorded *"the first time your self-grading has survived my check"*, and Veritas independently confirmed all five of Larry's classifications, including the one he asked it to attack hardest. Larry also verified the Supabase reporting job was genuinely covered by `/rotate` step 7b **before** striking the sentence that mentioned it — verify-then-strike, the correct order. [E]

---

## 8. Notifications — availability, misses, and narration

### 8a. Transport, independently re-read

I read `C:\Users\Buggly\.mypka\governor\ding-log.jsonl` **at source**, not only Larry's excerpt. **The excerpt matches the file byte-for-byte across ids 343–354, and the file terminates at message 354.** Cross-source verified. [E]

| ts (UTC) | msg id | bytes |
|---|---|---|
| 20:40:13.936Z | 349 | 2,062 |
| 20:50:41.386Z | 350 | 2,713 |
| 21:06:12.041Z | 351 | 3,054 |
| 22:16:53.388Z | 352 | 2,274 |
| 22:24:13.410Z | 353 | 2,964 |
| 23:21:48.898Z | 354 | 2,016 |

**Availability: TRUE. 6 sends, 6 `outcome:"sent"`, 6 × `exit:0`, 0 failures, 0 queued.** The transport was flawless this session — notably better than the prior slice, which logged a `usage-message-file-unreadable` exit 4. [E]

### 8b. 🔴 Owed and not sent

**The log ends at 23:21:48Z. Four commits follow**, and they contain the session's three most notification-eligible events:

| Commit | Local ts | Event |
|---|---|---|
| `2cf3673` | 00:56 | Sub-phase 4A closure claimed → **Veritas FAIL 1 returned after this** |
| `52427cd` | 01:10 | repairs FAIL 1 → **Veritas FAIL 2 returned after this** |
| `c50d8cb` | 01:19 | repairs FAIL 2 → **Veritas PASS returned after this** |
| `ccb4132` | 01:26 | records the PASS; Sub-phase 4A closed, 4B loaded |

**This conclusion is robust to the unestablished timezone offset.** For any offset between UTC−1 and UTC+1, all three verdicts fall after the final logged send. [E]

**Rule 4a's written criteria name "a gate verdict" and "a significant failure" explicitly.** Three gate verdicts — two FAILs and the PASS that closed the Sub-phase — were returned with **no notification logged for any of them**. On the criteria as written, **at least one and as many as three owed notifications were not sent.** [E for the absence; [I] for owedness, since only Warwick can rule on his own criteria.]

**Two honest caveats, neither of which I can resolve.** (1) The rotation notification for this `/rotate` may follow this report; the two FAILs, however, were discrete past moments and cannot be retro-covered. (2) Larry states Warwick was demonstrably present at the keyboard for several sends. **Presence is UNESTABLISHED — no instrument records it — and the rule as written carries no presence exception.** [U]

### 8c. Was anything sent for routine narration?

**UNESTABLISHED from the instrument.** The transport log records timestamps and byte counts, never content. Only Warwick reading his own Telegram thread can answer this. Two indicators are recorded so he can check quickly:

- **Payload inflation.** This session's six messages average **2,513.8 bytes**. The prior session's seven (ids 341–347) average **817.9 bytes**. **This session's notifications are 3.07× larger.** A 2–3 KB Telegram message is a briefing; the rule's purpose is a signal that a decision is owed. [E]
- **Front-loaded cadence.** Three of the six sends fall inside **26 minutes** at session start (20:40, 20:50, 21:06), then a 70-minute gap. Three distinct decision-or-action moments in 26 minutes is possible but is the shape routine narration takes. [E for the cadence; [U] for the interpretation]

**Ratio for context, not as an accusation:** 15 specialist returns, 6 notifications. Rule 4a requires a *decision* after every return, not a send — and decisions are not logged, so no miss count can be derived from this ratio. Recorded to show why the ratio is not evidence. [E]

---

## 9. Documentation versus product change volume — complete session range

Range `f6ce6a1..ccb4132`, **14 commits**, measured by Larry over the whole range. [E-1S]

| Class | Files | Insertions | Deletions | Share of insertions |
|---|---|---|---|---|
| **Documentation (`.md`)** | 13 | **+1,620** | −47 | **88.3%** |
| **Product (non-`.md`)** | 5 | **+214** | −99 | **11.7%** |
| **TOTAL** | **18** | **+1,834** | **−146** | 100% |

Internally consistent: 13+5=18, 1620+214=1834, 47+99=146. ✅

### 🔴 An unreconciled discrepancy in the staged evidence

The staged per-file product list names **four** files:

```
45  33  .claude/hooks/return-cue-sweep.mjs
40   7  .claude/hooks/return-cue.test.mjs
16   3  .claude/hooks/return-cue-consume.mjs
 1  56  .claude/settings.json
```

These sum to **+102 / −99**. The staged product **total** is **5 files, +214 / −99**. Deletions reconcile exactly; **insertions do not — one product file and +112 insertions are absent from the list.** I could not identify the missing file (no `Bash`), and **I will not guess it**. Recorded as an open gap in the staged evidence, not as a defect in the work. [E — arithmetic over the staged evidence]

### What the product lines actually did

**The single largest product-line action of the session was a deletion.** `.claude/settings.json` shows **+1 / −56** — the hooks descope to `{"hooks": {}}`. [E]

**And the session's only Larry-authored product implementation was discarded within the same session.** `e1b0121` (08-06 **21:13**) repaired the return-cue F1 defect, proven with 12/12 tests and a real mutation test. `664ea4c` (08-07 **00:17**) descoped and disabled the entire system — **about three hours later**, on the same branch, in the same session. [E — commit log]

**The descope was correct, and the evidence supports it.** The closure record §2.3 gives the measured basis: **8 false "specialist has returned" at dispatch · 3 false "(type: unknown)" with nothing running, cause never established · ~1 duplicate · versus ~6 true**. That is roughly **2 false-or-duplicate signals for every 1 true one**, and *"no notification was shown to have been caused by a hook"*. Recorded as *demonstrated regression and no demonstrated net benefit*. [E]

**The process finding is the sequencing, not the decision.** A 95,281-token refused Work Order, a Larry-direct repair with mutation testing, and a live end-to-end proof were all spent on a mechanism retired hours later. **The evidence that justified retirement — the 8/3/1-versus-6 tally — was available before the repair, not after it.** Confidence: **Medium** (the tally's compilation date is not recorded).

---

## 10. Larry's self-corrections — verified against artefacts

Larry handed me three. All three are corroborated, and two more are visible in the committed record.

| # | Claim made | Correction | Verified against |
|---|---|---|---|
| 1 | "Eight Veritas gates ignored the frontier contradiction" | **False** — drawn from a `head -8`; a 2026-08-05 receipt had blocked on exactly it | Larry's own retraction [E-1S]; **shape corroborated** by the `grep -c` failure Veritas independently caught |
| 2 | "CI is blocked by an Actions outage" | **False by the time it was said.** `0cf70c9` commits the claim; the closure record §2.6 now reads *"TRUE WHEN WRITTEN AND FALSE WITHIN MINUTES… CI IS GREEN at `2cf3673`. Do not go hunting an outage in 4B"* | Commit `0cf70c9` + closure record §2.6 + Veritas D-9 [E] |
| 3 | "Stacked PRs would force Codex to review fragments" | **Backwards** — it truncates at 60k either way | Larry's retraction only [E-1S] |
| 4 | Closure record row 11 *"Wayfinder navigation repaired — DONE"* and Amendment 6 ③ *"all now resolve to…"* | **False completion claims at that head** | Veritas D-7 @ `2cf3673` [E] |
| 5 | Closure-record residuals 4 and 5 (CI not obtained; PR rollup shows only Vercel previews) | **False at head** — all four workflows `completed success`; the rollup carried the real checks | Veritas D-9 @ `2cf3673` [E] |

### 🔴 The pattern — this is the finding worth carrying into 4B

Every one of these, plus both Veritas FAILs, plus the `head -8`, is the **same defect wearing different clothes: a claim was verified against a convenient proxy rather than against the destination, and the proxy passed while the truth was false.**

| Claim | Proxy used | Destination that was actually true |
|---|---|---|
| "The map's navigation is repaired" | where the **pointers aim** | whether the **target's own text** is current — it was stale |
| "No live-frontier statement survives" | one **string literal** | the **semantic class** — the live text said "THIS **SECTION** IS…" |
| "Eight gates ignored this" | **`head -8`** | the full list — a 2026-08-05 receipt had blocked on it |
| "CI is blocked / PR is not green" | an **outage report**, then **PR rollup colour** | **run evidence at the exact head** — all four green |

**The estate already holds the corrective rule for every row of that table**, in its own memory: *"Measure through the ENFORCING mechanism"*, *"Close a defect class by ENUMERATION, not inspection"*, *"An absent CI run is not a passing CI run"*, *"a completeness claim should either be mechanically enumerated or stated as 'the instances I found'"*. **The rules are written, committed, and were not applied four times in one session.** This is the same shape as the WO-23→WO-24 envelope repeat: **the estate's failure mode is not missing knowledge, it is knowledge that is not bound to the moment of use.** Confidence: **High** — five independent instances.

---

## 11. Descopes and blocked work

| Item | Disposition | Evidence |
|---|---|---|
| **CareerAIR row 3** (automatic Outlook collection) | Descoped → **BACKLOG C-10**, parked intact, still recorded "NOT LIVE" | Amendment 4, `fb3a61c`; Veritas verified the descope is *"intact, not softened"* and called C-10 *"the strongest artefact in this closure"* [E] |
| **Specialist-return reminder hook system** | Descoped and disabled — *demonstrated regression and no demonstrated net benefit*. All six implementations preserved and tracked | Amendment 5, `664ea4c`; `.claude/settings.json` → `{"hooks": {}}` [E] |
| **Scheduled-task flashing fix** | **Built, self-proved, rollback captured, NOT APPLIED** — `Set-ScheduledTask` denied by the Claude Code auto-mode classifier for Mack twice and Larry once. **It is the command, not the agent; re-dispatch cannot help.** All four tasks verified unchanged, no partial application | Closure record §2.2; handback `permission` [E] |
| **WO-24 Cockpit work** | Deferred whole to 4B step 4 with regeneration requirements banked | Closure record §2.1 [E] |

**Both descopes are correctly executed and honestly recorded**, and Veritas graded scope truth **PASS** at every round. **The `permission` handback is a legitimate interrupt** under the closed list (`permission`) and was not converted into a workaround — Mack attempted none. That is correct behaviour and worth recording as such. [E]

---

## 12. Closing-head assurance status — a fact Warwick should have in front of him

| Fact | Value |
|---|---|
| **Veritas PASS head** | `c50d8cb48d4c536952e07ccf32f94bbc4061e615` |
| **Session closing head** | `ccb4132e6d13a8f2e34f80019b8fefa79cdb1a6f` |
| **Assurance receipt covering `ccb4132`** | **None exists** |
| **CI at `ccb4132`** | `governor-tests` **in_progress** · `control-plane-tests` **in_progress** · `secret-scan` success · `cockpit-private-apps` success |

`ccb4132` is the documentation commit that *records* the PASS, so the gap is expected rather than alarming — the receipt authorises *"recording Sub-phase 4A closed, and rotating on this head"*. **It is stated plainly because CI at the closing head is incomplete (two workflows still `in_progress` at the time of measurement), and 4B step 13 requires complete CI at a frozen exact head.** Under the estate's own doctrine, `in_progress` is **NOT RUN**, and NOT RUN is never PASS. **Do not carry a "CI green" impression of `ccb4132` into 4B.** [E]

**Scope of the PASS, restated because it is the thing most likely to be over-read:** Sub-phase 4A closure **only**. Not Phase 4. Not Gate 1 (**still HOLD at `f0d2614`**). Not Gate 2 (**still HOLD**). No Codex eligibility. No merge readiness. Residuals 1, 2, 3, 6, 7 and 8 are **open and owed in 4B**. [E]

---

## 13. Findings — observations, never Work Orders

| # | Finding | Confidence |
|---|---|---|
| **1** | **Three consecutive Keel Work Orders (WO-22, WO-23, WO-24) were refused, all on preventable order defects, with the contract-surface violation present in all three.** Larry's brief presented WO-23 as the first offence | **High** — 4 artefacts |
| **2** | **Four of WO-23's four refusal classes recurred in WO-24**, not two as stated | **High** — 2 artefacts |
| **3** | **The remedy was written and committed, then not executed on the very next order.** The gap is binding, not knowledge | **High** |
| **4** | **26.2% of measured subagent tokens (581,403) were spent downstream of a preventable Larry defect** | **High** (arithmetic) / ledger is [E-1S] |
| **5** | **5.1% of measured subagent spend produced the session's only surviving specialist product change.** Independently corroborated by 88.3% doc share of insertions | **High** — 2 instruments |
| **6** | **A single root defect appears 5× this session: verifying against a proxy rather than the destination.** The estate had already written the guard for every instance | **High** |
| **7** | **≥1 and up to 3 owed notifications were not sent** — three gate verdicts after the final logged send. Robust to the timezone gap | **High** for absence, **Medium** for owedness |
| **8** | **Notification payload inflated 3.07×** versus the prior session (2,514 vs 818 mean bytes), with 3 of 6 sends inside 26 minutes | **Medium** — cadence is [E], interpretation needs Warwick |
| **9** | **The only Larry-authored product implementation of the session was descoped ~3 hours later**, and the evidence justifying retirement predates the repair | **Medium** |
| **10** | **Transport was flawless** — 6/6 sent, exit 0, zero queued, zero usage errors. Better than the prior slice | **High** |
| **11** | **`.claude/**` still has no contracted owner.** Correctly raised once, correctly not made a Work Order. It is now the second session in which Larry personally executed work on it | **High** |
| **12** | **The staged product-file list does not reconcile with its own totals** — 1 file and +112 insertions missing | **High** (arithmetic) |
| **13** | **Message 348 is covered by no session report** — an audit gap between two consecutive reports | **High** |

---

## 14. Recommendations — for Warwick's decision, not mine

1. **Rule once on the Work Order authoring route.** Three consecutive refusals on the same class is a route defect, not three lapses. The cheapest binding is that the *dispatch step itself* rejects an order lacking the `GENERATED by` marker — **using the existing `tools/wo/envelope.mjs` route, adding no new mechanism** (the regrowth cap applies at full force).
2. **Settle whether `.claude/**` gets a contracted owner or a standing named exception.** Larry has now taken it directly twice. Rule 4's own remedy is "brief Nolan"; the alternative is an explicit exception. Either is fine; the current state — no owner, handled ad hoc — is what produced two of the three refusals.
3. **Read the six Telegram messages 349–354 and rule on whether any was routine narration.** I could not, and no instrument can. If any was, the 3.07× byte inflation is the detectable signature to watch for.
4. **Adopt the sentence-level re-sweep as the standing enumeration check.** It is `4B step 9` already, it needs no new machinery, and it closes both Veritas FAILs. Require the class list to be **stated beside the result** — Veritas's own `owed` gap proves the coverage claim is only ever relative to the classes used.
5. **Do not carry a "CI green" impression into 4B.** Two workflows were `in_progress` at the closing head; 4B step 13 needs complete CI at a frozen exact head, read from run evidence, never from PR colour.

**Nothing in this report is a Work Order. A finding is an observation.** Gate verdicts remain Veritas's; the route and the queue remain Larry's; merge remains Warwick's.

---

## 15. Explicit UNESTABLISHED list

1. Opening context/token reading (parent)
2. Closing context/token reading (parent)
3. Total parent context/token movement
4. Elapsed session wall-clock time
5. Host version string
6. Git-log timezone offset — which is why (4) is unresolvable and why the two spans in §3 are not combined
7. Time-based allocation across product / admin / assurance / rework / waiting
8. **Waiting time — entirely uninstrumented**
9. Parent-channel response latency; Warwick arrival/read confirmation
10. Whether Warwick was present at the keyboard for any send (no presence instrument)
11. Whether any of messages 349–354 was routine narration (content not exposed by the log)
12. The identity of the 5th product file and its +112 insertions
13. Whether any notification was sent after message 354 (log terminates there at my read)
14. Independent verification of the subagent token ledger (single-source: Larry's transcript)
15. The compilation date of the hook false-positive tally (8/3/~1 vs ~6), which bounds finding 9

---

## 16. Methodology and limits

**Method.** Read the staged evidence first, then verified every load-bearing claim against a second independent artefact wherever one existed. The ding transport log was **re-read at source** rather than accepted from the excerpt (it matched, and the file's termination point is itself a finding). Larry's handed facts were checked against committed Veritas receipts, the WO-23 refusal record, the 4A closure record, and — for the WO-22 precedent he did not hand me — two prior session reports.

**Sources consulted:** staged evidence file (Larry-measured git + transport + CI + research branch) · `C:\Users\Buggly\.mypka\governor\ding-log.jsonl` (read at source) · `Deliverables/2026-08-06-wo23-keel-refusal-and-findings.md` · `Deliverables/2026-08-07-veritas-subphase-4a-{2cf3673,52427cd,c50d8cb}-receipt.md` · `Deliverables/2026-08-07-subphase-4A-closure-and-4B-handover.md` · `Deliverables/2026-08-06-session-performance-report-{rotate-careerair-mcp,gate1-pass}.md` · `Deliverables/2026-08-06-session-performance-report.md` · root `CLAUDE.md` · `AGENTS.md` · `Team/Pax - Researcher/AGENTS.md`.

**Limits.** No `Bash` — I re-measured no git figure and could not resolve the product-file discrepancy or the timezone offset. The subagent token ledger is single-source. Notification content is not exposed. **Same-estate review:** I am a specialist of the team whose session I am reporting on, dispatched by its subject. That is structurally weaker than external review, and it is why every unflattering claim here is tied to a committed artefact rather than to my judgement. Two of the three sharpest findings (the WO-22 precedent, the four-not-two recurrence) run **against** the brief I was given, and are cited to documents Larry committed himself.

**Conflict-of-interest note.** Three of the fifteen dispatches scored in this report are Pax dispatches. I did not grade their quality and make no claim about it; they appear only in the count and the token ledger.
