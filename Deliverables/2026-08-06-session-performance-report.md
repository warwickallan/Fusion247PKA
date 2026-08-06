# Session performance and process report — BUILD-020 Phase 4, rotation of 2026-08-06

**Commission:** WO-2026-08-06-22 · **Governance head:** `875b5cb0199aa13a23cf55167af578a5ba24fcf1`
**Branch:** `build-020/phase4-automation-law` · **Author:** Pax · **Date:** 2026-08-06
**private_surface:** none · **credential_scope:** none · **Written inside `/rotate`, before `SAFE TO CLEAR`.**

**Labels.** **[E] ESTABLISHED** — I read it myself on disk, or it is stated in a Veritas receipt and corroborated by a second artefact. **[I] INFERRED** — reasoned from artefacts, not observed. **[U] UNESTABLISHED** — named so it is not mistaken for evidence.

**Methodology and its limits, stated first because they bound everything below.** I hold `Read`, `Write`, `Grep`, `Glob`, `WebFetch`, `WebSearch` and **no `Bash`**. I executed nothing. Every runtime figure is attributed to Larry or to a receipt and is **not adopted as my own**. Sources: the Wayfinder map §15.3d and §17 in full; both Phase 4 Veritas receipts; `WO-2026-08-06-18/19/20`; the Pax brief; and `~/.mypka/governor/ding-log.jsonl`, which I read directly. **The commission named `git log main..HEAD` (28 commits) as a source. I cannot open it** — that is the one mandated source missing from this report, and it is the same defect class the generator caught on WO-21 (see §3).

---

## 1. Headline — and it is good news, which is the honest finding

**Against the only measured baseline the estate has, this session's delivery tax fell sharply.** [E]

| Measure | Phase 2 baseline (§15.3d, measured 2026-08-05) | This session (Phase 4) |
|---|---|---|
| Work Orders issued | 8 | **4** (WO-18…21) |
| Amendments | **~11 — more amendments than orders** | **2** |
| Class-A Work Order **refusals** | **7, all Larry's defects** | **0** |
| Assurance holds | 1 Veritas HOLD | 2 Veritas HOLDs, **4 of 4 blocking findings discharged on re-review** |
| Historical order baseline (§17.6) | **13 class-A refusals across 15 orders** | 0 across 4 |

**No worker refused an order this session.** On the estate's own recorded history that is the largest single-session improvement in the metric Warwick named. **The generation repair is the plausible cause and n is small — do not over-read it.** [I]

**What did not improve:** the phase's own acceptance properties. `J1-1` OPEN, `AC-5` unmet, and Veritas `V5-0` blocks any Phase 4 PASS. **Larry declared all three himself before Veritas did** — Veritas records that as the strongest property of the head. [E]

---

## 2. Work Order evidence

| Order | Worker | Envelope | Verdict | Substantive work on **first** dispatch? | Round trip |
|---|---|---|---|---|---|
| **WO-18** | Keel | **hand-authored** | `CLARIFY` | **NO** | `AMENDMENT 1` — 2 material class-A, 4 minor, 1 class-B, 2 clerical; 9 findings, all accepted |
| **WO-19** | Keel | **generated** | `ACCEPT` | **YES** | none. 4 contradictions found, all non-blocking. Addendum after integration, not a rework of the order |
| **WO-20** | Mack | **hand-authored** (generator correctly refused, G-6) | `ACCEPT` **with corrections** | **NO** | **`AMENDMENT 1`** — two corrections before writing began |
| **WO-21** | Pax | **generated** | `BUILD`, conditional | **YES** | none. A class-A defect was caught **at preflight by the generator**, before issue |

**⚠️ The commission described WO-20 as "`ACCEPT` → `COMPLETED`". That understates it and the file contradicts it.** [E] `WO-2026-08-06-20-ding-machine-install.md:42-46` carries `AMENDMENT 1 (F1 ruling)`, adding `INSTALLED-FROM.txt` to the **`machine_surface` closed list** — Mack showed the one-file list would have forced either a breach of the closed list or the silent loss of the provenance record, *"precisely the defect §16.11 was paid for."* **That is a preventable class-A defect in the single most safety-critical field of the order**, and it landed on exactly the field `G-6` predicted would be at risk once machine-install orders must be hand-authored. The second correction is `E-3` (the "contract gap"). The order instructed a HOLD at read-back (`:131`), so no work was lost — **but Mack, not Larry, is why the closed list was right.**

**A residue I found that nobody has recorded** [E]: `WO-...-20:55` still states *"that is a KNOWN CONTRACT GAP"* in `contract_basis`, while `:59` records the correction in `contract_conflicts`. **The withdrawn claim and its retraction sit in adjacent fields of the issued order, with the withdrawn one unstruck.** A worker told to *read* a field and never infer would read `:55`. This is `G-1` recurring one order later. Non-blocking; recorded once.

---

## 3. Rework, refusals, and the AC-5 count

**Two round trips, both preventable, both on hand-authored envelopes. Zero round trips on generated envelopes.** That is the cleanest signal in the session and it is unconfounded on the variable that matters: **the two orders that needed amending are the two the tool did not produce.** [E]

### The AC-5 accounting — checked, and it is wrong in the direction opposite to the one suspected

**Larry records the streak as ONE (WO-19 only).** The commission asked whether that is flattering. **It is not. It is stale and, on the most likely reading, an under-count.** [E/I]

| Order | Counts? | Basis |
|---|---|---|
| WO-18 | **No** | amendment before substantive work — Larry's own ruling, correct |
| WO-19 | **Yes** | clean, generated |
| WO-20 | **Neither advances nor is scored** | Larry excludes it as off-route. **The stronger reason he does not give: it carried a preventable class-A defect and required an amendment.** Whether it *breaks* consecutiveness is **undefined by AC-5 and unstated by anyone** |
| WO-21 | **Yes** | generated, no refusal, no amendment, worker proceeded and returned a verdict |
| WO-22 (this report) | **Not mine to count** | self-scoring is a conflict; Larry scores it if he accepts the return |

**So at rotation the honest count is TWO, not one** — and if WO-22 is accepted, **three under the exclusion reading, two under the break reading.** **AC-5 is therefore at or one step from met, and nobody can say which, because "consecutive" has never been defined against an order the generator has no shape for.**

> **This is the one place in the record where a number should move, and it is a `product-decision` sized question, not a Larry one.** Recommended to Warwick: rule once — does a hand-authored order issued *because the generator refused* (`G-6`) break the streak or leave the denominator? **Under exclusion, AC-5 may be met tonight. Under break, it is at two.** I make no recommendation on which; I record that the ambiguity, not the count, is the defect.

**One live instance of the defect class the repair exists to prevent, found in my own order** [E]: WO-22 names `git log main..HEAD` as a required source for a worker with **no `Bash`** — the identical shape the generator caught on WO-21 (*"acceptance evidence must NOT require an executed command · command execution: NOT available"*). It is self-mitigating here (the order also states I execute nothing) and non-blocking. **Whether WO-22 was generated is [U] to me.** If it was, the generator missed a repeat; if it was hand-authored, that is the third hand-authored order of four to carry a defect the tool prevents.

---

## 4. Notification misses

**Two, both confirmed by Warwick verbatim, both correct, both Larry's.** [E]

| # | Occasion | Conditions at the time |
|---|---|---|
| 1 | Step 2 (Nolan resolution) completed — reported in chat, no ding | **Instrument GREEN. Rule fresh, self-authored, visible. ~1 hour old.** |
| 2 | Mack's WP-4C return — reported in chat, no ding | Same. **~1 hour later.** |

**The datum is not "he forgot twice". It is that the rule was written into the map by its author that morning and failed under ideal conditions within an hour.** No context pressure, nothing else failing. This is the estate's own *"compensating habits decay silently"* and *"a control bound to a person remembering is a dated liability"* — **measured, first-party, at a decay interval of one hour.** [E]

**⚠️ The observation nobody has recorded, and it is the one I would defend hardest.** [I] Both confirmed misses occurred **before** `ding-log.jsonl`'s first row at `01:30:20Z` — i.e. before the installed send path existed. Four sends then follow in 33 minutes with no recorded miss. **The tempting reading is that the mechanism fixed the attention problem. Reject it.** The send path was never the failing half — §17.7 draws that boundary correctly, and Veritas confirms it. **The far likelier cause of 33 clean minutes is that Warwick had just corrected Larry twice, which is the loudest and shortest-lived correction available.** A 33-minute post-reprimand window is evidence of nothing durable. **The next measurement that matters is the first miss after the reprimand has faded, and no mechanism currently exists to notice it.** That is the honest statement of the trade Warwick owns.

**Denominator [U].** Two misses out of an unknown number of rule-eligible moments. No artefact enumerates eligible moments, so **no miss *rate* exists and none should be quoted.**

---

## 5. Parent-channel availability and queued messages

**Read directly by me from `~/.mypka/governor/ding-log.jsonl`** [E]:

| ts | outcome | exit | message_id | bytes |
|---|---|---|---|---|
| 01:30:20.851Z | `sent` | 0 | **326** | 2310 |
| 01:44:30.260Z | `sent` | 0 | **327** | 2284 |
| 01:53:42.502Z | `sent` | 0 | **328** | 2428 |
| 02:03:14.260Z | `sent` | 0 | **329** | 2508 |

**Four sends, four successes, zero failures, zero queued, zero retries.** The absence of failure rows is **meaningful and not an artefact of success-only logging**: Veritas verified by execution that *"a row is written on every exit path including usage errors,"* proven by tests 4/5/32/35–39. **Two independent legs — my read of the file, and Veritas's test-level verification of the logging property.** [E]

**Two limits, stated exactly:**

1. **`ok:true` is not "he saw it."** Both receipts refuse this claim and so do I. Arrival is Warwick's confirmation. [E]
2. **The pre-install sends (ids 320–325) left no durable record** — the legacy path writes no log. **Durable notification evidence in this estate begins at `326`.** Everything before it is reconstructable only from Telegram, i.e. not in-repo. A minor count inconsistency survives in the map (*"three delivered dings"* §17.2 vs *"4 dings … ids 320–324"* §17.7, which spans five ids); it changes nothing and I do not propose fixing it. [E]

---

## 6. Token and context economics — measured, attributed, not adopted

| Figure | Value | Source / label |
|---|---|---|
| Context at rotation | **`ctx ~44% (444.4k/1000k) · GREEN`** | **Larry's reading of the instrument.** [E as *his* reading; I did not read the instrument] |
| Phase 2 comparator | **418,491 / 1,000,000 (42%), "still rising"** | §15.3d, measured 2026-08-05 [E] |
| `E-2` — the eyeballed figure | claimed *"roughly ten thousand tokens"*; **measured 20,056 chars ≈ 5,014 tokens → ~2× over** | map §17.7, caught by **Keel's read-back** [E] |
| Envelope composition | `git_authority` **14%** (missed), `prohibited_file_surface` **7%** (overstated) | same [E] |
| Documented churn, `89602f3..b267d55` | **5 files, +479 / −5** | Veritas re-review [E] |
| Subagent tokens **per dispatch** | — | **[U]. It lives in Larry's session record, which I cannot read.** Named rather than estimated |
| Full-phase doc-vs-product line ratio | — | **[U]. Needs `git diff --stat 4eb5368..HEAD`, which requires `Bash`** |

**Two readings, and they point opposite ways.** [I] The 44% figure is *comparable* to Phase 2's 42% — but Phase 2's was mid-phase and rising toward what Warwick called *"half-million-context chasers"*, whereas this one is at a **planned** rotation with assurance already discharged. **Same number, materially better position.** It is not a like-for-like comparison and should not be presented as one.

**`E-2` and `E-5` are the same failure in two directions** — an eyeballed figure 2× too high, and *"context is very long, we should rotate"* asserted twice when the instrument read **~32% GREEN, CONTINUE**. **Both are Larry substituting a feeling for a reading he had the instrument to take.** §17.5a's *"read from the instrument, never estimated"* is the correct corrective and it was applied to this report — every figure above is attributed or labelled `[U]`.

---

## 7. Larry's hypothesis: confirmed in direction, **overstated in magnitude**, and the record is still not complete

**The claim:** of eleven recorded errors, nine were caught by someone else and one by Larry; therefore the read-back and the independent gate are load-bearing and Larry's self-review is near-worthless.

**Attribution, checked row by row against the receipts** [E]: Keel's read-back 2 (`E-1`, `E-2`) · Mack's read-back 1 (`E-3`) · Warwick 1 row covering 2 misses (`E-4`) · Veritas 6 (`E-6`…`E-11`, each traced to `V4-1/2/3/4/5/10` and `V5-1`) · **Larry 1 (`E-5`)**. **The attributions are accurate. Ten of eleven were caught by someone other than Larry** — the map says nine because it books Warwick separately, which is if anything harder on Larry than the arithmetic requires.

### The first half holds. The second half does not, and the reason is a counting artefact.

**⛔ The E-list counts only errors that ESCAPED.** An error Larry caught before it left his hands cannot enter the table by construction, so **the table cannot support any statement about the productivity of his self-review** — only about what happens when it fails. **At least two self-catches exist outside it, both recorded in the same map** [E, single-source and self-reported — flagged]:

- **§17.0** — the C-11 order was **stood down at preflight** because `notify-snapshot-consumers.yml` does not match the `.github/workflows/<service>-tests.yml` shape Keel's contract permits. **A class-A contract conflict caught by Larry before dispatch**, recorded as *"the preflight working."*
- **§17.5 step 1** — **Larry's own mutation of Keel's returned `ding.mjs` suite survived**; the addendum turned it red (5 red). **A real test-quality gap in a specialist's deliverable, found by Larry's review.**

**The sharper statement the evidence actually supports:** *Larry's review of **other people's** artefacts caught real defects. Larry's review of **his own** artefacts caught one thing in eleven. The read-back and the independent gate are load-bearing because they are the only reviewers of Larry's own work — not because his review is worthless in general.*

### And a third omission from a table headed "EVERY"

**§17.6 records, of `WO-20`'s failed generation: *"Larry's input was wrong."* That is a Larry error, in the same document, and it is not in the E-table.** [E] Nor are the seven of Keel's nine WO-18 findings that are not `E-1`/`E-2`. **The table is a curated selection presented as an enumeration.**

**Direction of every correction so far: worse for Larry.** Veritas `V5-2` moved it from 7-of-9 to 1-in-10; the current 9-of-11 already absorbs that; adding `G-6` makes it 11-of-12. **The record is incomplete, and it is incomplete in Larry's disfavour — the flattery risk the commission suspected is not present.** The finding is the opposite one: **the denominator is not closed, so no ratio from this table should be quoted as a rate.**

---

## 8. The pattern Veritas named — and it recurred a third time inside this report

**Two sweeps reported as exhaustive** [E, both receipts]: *"corrected in both places"* (a third live instance survived at map `:1227`, `V5-1`) and *"EVERY Larry error this session"* (one missing, `V5-2`). **Veritas: the defect is not the missed instance — it is the word "every."**

**⚠️ It happened a third time, after being named.** `V5-2` was raised specifically so the E-table would be complete *before this report was written from it*. The table was corrected for `E-10` — **and `G-6`'s "Larry's input was wrong" was still not added.** [E] **A completeness claim that has now failed three times in one session, twice after the pattern was explicitly identified, is not a lapse of attention. It is the shape of the claim.**

**The durable rule, and it costs nothing:** *a completeness claim is either **mechanically enumerated** or it is written as **"the instances I found."*** **A partial sweep labelled partial costs a reader nothing; a partial sweep labelled complete stops them looking.** This generalises well past tonight — the same shape produced the three competing frontiers §12 records.

---

## 9. Other delivery-tax findings worth carrying

| # | Finding | Label |
|---|---|---|
| 1 | **The CRLF trap, measured for the first time on a specific file**: git blob 17,454 bytes / `0f26ef16…` vs working tree 17,863 / `c318bf04…` — **409 bytes divergent while `git status` reports the tree CLEAN.** Fourth occurrence in BUILD-020, first time both hashes were produced. **Installing from the working tree would have failed AC1 while every casual check looked fine.** Mack produced this *before writing anything* | [E] |
| 2 | **The generator refused an order it could not honestly build (`G-6`) and the refusal was correct.** A tool that had "helpfully" resolved a machine path against repo patterns would have fabricated a grant. **A refusal recorded as a success is the right instinct and it is rare** | [E] |
| 3 | **The reminder hook fires at DISPATCH, not RETURN**, because a background agent's tool call completes at launch. **It lands at the one moment it is not needed and is silent at the moment that failed twice.** Reclassified MANUAL (`V4-4`), correctly, and not defended | [E] |
| 4 | **`V4-10` — committing to a branch under assurance** cost the first receipt its currency. Larry then held the Pax commission before Veritas resubmission specifically to avoid repeating it. **A lesson applied within the same session, which is worth recording as a positive** | [E] |
| 5 | **`V4-7` — `envelope.test.mjs` is not hermetic**: 31 of 60 subtests unexecutable under Veritas's mandated isolation. Veritas's own view is *keep it parked, fix inside the next WO-tooling work, not a Work Order of its own.* **It degrades every future review of the WO tooling and the cost compounds silently** | [E] |
| 6 | **`S-1`…`S-4` are builder evidence Veritas could not reproduce**, and the raw payloads are untracked and ephemeral. **The host version was never captured** — and the sub-agents page pins background behaviour to versions, so the evidence has no shelf life | [E] |

---

## 10. What I could not establish

- **`git log main..HEAD` (28 commits)** — the one mandated source I could not open. **[U]**
- **Subagent token cost per dispatch.** **[U]** — in Larry's session record only.
- **Full-phase documentation-vs-product line ratio**, the §15.3d headline metric. **[U]** — needs one `git diff --stat`.
- **Whether any notification was missed after `01:30`.** **[U]** — only Warwick can say.
- **Whether `WO-2026-08-06-22` was generated or hand-authored.** **[U]**
- **Elapsed session time.** **[U]** — no artefact I can read carries it; the ding log spans 33 minutes, which is not the session.

---

## 11. Recommendations — all are Warwick's to decide; none is a Work Order

1. **Rule once on AC-5's "consecutive"** (§3). It is the only number in the phase whose value turns on an undefined word, and it may already be met.
2. **Adopt the completeness rule** (§8): enumerate, or write *"the instances I found."* Zero mechanism, zero cost, and it is the third strike.
3. **Do not read the 33 clean minutes as the notification problem being solved** (§4). The next real measurement is the first miss after the correction fades.
4. **Retire the phrase "Larry's self-review is near-worthless"** (§7). The evidence supports a narrower and more useful statement: *he cannot review his own artefacts, and he can review other people's.* The first justifies the read-back and the gate absolutely; the second is worth keeping.
5. **`V4-7` and the `G-1` field-shape fix** ride inside the next WO-tooling work, per Veritas's own view. Not separate orders.

**Nothing in this report is a Work Order. A finding is an observation.** Verdicts, closure and PASS remain Veritas's and Warwick's.
