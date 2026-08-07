---
name: PAX-03-operating-model-reconciliation
type: reconciliation-commission
commission: Test Warwick's Wayfinder operating model against evidence (Larry, 2026-08-06)
author: Pax
created: 2026-08-06
governance_head: fb3a61c
branch_read: build-020/phase4-automation-law
private_surface: none
status: report-only
---

# PAX-03 — Reconciliation of Warwick's operating model against the evidence

**REPORT ONLY. Nothing implemented. No SOP, Guideline, template, registry, validator, hook or role created. `C:\Fusion247PKA-build-020-trial` was read and never written.**

> **Same-model honesty note.** Everything under review was authored by this model in earlier sessions. This is a structured read of committed evidence, not external verification. Where a claim rests on one artefact with no corroboration, it is labelled **single-source**. Where I could not establish something, I say **unestablished**.

---

## 1. HEADLINE — the crux evidence is misread, and it inverts the conclusion

Larry's table says: *"Eight Veritas gate receipts committed — none flagged the contradiction — because it was not in her remit."* He asked me to test it rather than accept it. **It does not survive the test. Three separate ways.**

### 1.1 Map integrity is already Veritas's remit, in near-identical words to Warwick's proposal

`Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md:102` — Gate 3 reviews *"the active sources affected by the boundary under review — Build Contract · Goal Contract · implementation plan · **Wayfinder map** · Work Orders · SOPs · AGENTS contracts…"*

Line 104: *"A supersession banner does not pass while the body still instructs the opposite."*
Line 105: *"Historical documents must be fully reconciled, moved to an explicitly historical/archive location, or clearly marked non-operational **throughout** — not merely at the top."*
Line 109: *"**No PASS while an active document would send a fresh Larry, specialist or user down a superseded route.**"*
Line 179: `| **Documentation truth** | Do the active documents agree with the code, the decisions, and each other? |` — a **mandatory dimension on every receipt**, all three gates.

Warwick's proposed new dimension — *map truthfully reflects complete/residual/next · obsolete instructions retired or redirected · one unambiguous next action · a fresh Larry can safely continue* — is a **paraphrase of lines 102–109 that already exist**. This is not a gap. **Confidence: High** (primary source, exact lines).

### 1.2 Veritas did flag it. She blocked on it. On 2026-08-05, by name

`Deliverables/2026-08-05-veritas-rotation-readiness-receipt.md` — verdict **HOLD**, finding **F-1, blocking**:

> *"**The map states the frontier twice, and the first statement is wrong.** §14.19:1371 claims *'This is the ONLY place in this map that states the live frontier'* — it is not… **Blocks the exact next action: the `/clear` at §14.20 step 5.** This is the identical defect class the map itself records at §12:401 as 'the most serious defect in this map'."*

And `:25`: *"**Scope Veritas determined, and it is one item wider than the dispatch.**… That block is inside the reviewed question, not adjacent to it, and it is where the blocking finding is."*

That is the enforcement owner Warwick says was absent, **exercising exactly the remit he wants to grant her, widening scope to reach it, and blocking rotation on it.** The correction at map line 19 even credits her: *"(Corrected 2026-08-05, Veritas rotation-readiness HOLD.)"*

**Warwick's hypothesis — "the rule lacked an independent enforcement owner" — is REFUTED. The owner existed, had the remit, used it, and blocked.**

### 1.3 The 2026-08-06 receipts are full of map findings. They were *parked*, correctly, under existing law

Larry's "none flagged the contradiction" is false in substance. Every `Documentation truth` row I read on 2026-08-06 engages the map:

| Receipt | Documentation truth | What it says about the map |
|---|---|---|
| `phase4-receipt.md:99` | **HOLD** | *"Two surviving statements contradict the operative one and **would misdirect the next action** (V4-2, V4-3)"* |
| `phase4-closure-fa2018f-receipt.md:93` | **HOLD** | *"**§17.0 J1-1 still 🔴 OPEN** while frontier and SOP-022 claim closed — **live contradiction**"* |
| same `:133` | — | *"A fresh reader landing on §17.0, not only the live frontier, is told J1-1 is still open."* |
| `phase4-rereview-b267d55:90` | **HOLD** | *"`V4-2`'s sweep is **incomplete** (`V5-1`)"* |
| `gate1-pass-a1e124a:82` | PASS / parked | *"Parked **V6-2/V6-3 map table drift** remains non-blocking for scheduled reconciliation"* |
| `gate2-phase4-receipt:102` | PASS (operative) | *"Parked historical table drift (§17.5 step-5…) **non-blocking if frontier is clear**"* |
| `gate1-active-wp-receipt:82` | PASS | *"Map residual language still says IN PROGRESS/PARTIAL… recorded non-blocking; **no active instruction that would misdirect** Gate 1 corrective work"* |

And the disposition rule she applied, in her own words at `gate1-pass-a1e124a:153`:

> *"`V6-2` / `V6-3` / `V6-5` remain non-blocking **unless they start misdirecting the live frontier**."*

That is root `CLAUDE.md` § Finding disposition — *"Documentation blocks according to effect"* — applied **exactly as written**. She also refused to re-run: `:44` *"Deliberately not in scope:… second documentation-only cycle for parked V6-2..V6-5 **without Warwick authority**"* — again, root `CLAUDE.md`, verbatim.

**The silence was not a remit gap. It was the estate's own disposition law working as designed, plus Warwick's own rule that a second documentation-only review needs his authority.**

> ⚠️ **Count discrepancy, recorded not resolved.** I count **sixteen** `2026-08-06-veritas-*` files in `Deliverables/`, not eight. Whether all sixteen were *committed* that day is **unestablished** (no `Bash`). The larger number strengthens the point rather than weakening it.

---

## 2. WHAT ACTUALLY FAILED — and it is not what either of you think

### 2.1 The rule is self-invalidating by construction

The rule was written **inside the section it describes**:

> map:1425 — *"**This is the ONLY place in this map that states the live frontier.** §12 is Phase 1 history and says so."*

A claim of the form *"this section is the only X"* becomes **false the instant the frontier moves**, and nothing in the shape of the rule forces its retraction. The map's succession pattern is *declare the new one live* — never *retract the old one*:

- map:1575 — *"⭐ **THIS SECTION IS NOW THE LIVE FRONTIER.** §14.19 is Phase 2, CLOSED and MERGED."* (§16)
- map:1782 — *"# 17. ⭐ PHASE-COMPLETION CONTRACT… **THIS IS NOW THE LIVE FRONTIER.**"* (§17)

Both declarations stand unstruck today. **§14.19:1425's absolute claim was never retracted.** Result, at `fb3a61c`:

| # | Frontier-shaped statement live in the map today | Status |
|---|---|---|
| a | `:19` first-read row → *"§14.19 is the SINGLE statement of the live frontier"* | **Two phases stale.** §14.19 is Phase 2 CLOSED |
| b | `:20` *"**First safe action** → §14.19"* | **Two phases stale** |
| c | `:1425` *"This is the ONLY place in this map…"* | **False** |
| d | `:1575` *"THIS SECTION IS NOW THE LIVE FRONTIER"* (§16) | **Superseded, unstruck** |
| e | `:1660` `## 16.8 Frontier` → *"Phase 3, step 1. Branch `build-020/phase3`"* | **Stale, no supersession marker.** Branch is now `build-020/phase4-automation-law` |
| f | `:1782` §17 *"THIS IS NOW THE LIVE FRONTIER"* | Live |
| g | `:2336` `## 17.4 Frontier` → ACTIVE SESSION WORK PACKAGE | Live |

**Seven frontier-shaped blocks; five stale; two unmarked.** Worse than the two events Larry's table names. **Confidence: High** (read directly at the governance head).

**And the sharpest one is (a).** The map's own *"read this first"* block, corrected under a Veritas blocking finding on 2026-08-05, now points a fresh Larry at a section that says *"Phase 2 — PASS. CLOSED."* **The repair for the frontier defect has itself become a stale frontier pointer.** No receipt names this. It is the single most navigationally consequential defect currently in the map, and it was created by fixing the previous one.

### 2.2 So what actually made the map navigable? Not the "one frontier" rule

The thing that worked has a different shape. Every 2026-08-06 receipt binds to the frontier by **fixed canonical name**, not by section number:

- `active-session-wp-receipt.md:36` — *"`…proofline-wayfinder-plan.md` § «⭐ ACTIVE SESSION WORK PACKAGE»"*
- `gate1-active-wp-0855e4e-receipt.md:30`, `gate1-active-wp-receipt.md:28`, `gate1-amended-wp-0cf70c9-receipt.md:29` — same binding.

**`ACTIVE SESSION WORK PACKAGE` is an identifier. `§14.19` was a claim of uniqueness.** Identifiers survive succession; uniqueness claims decay. Moving the frontier means moving content *into the named section*; it does not mean minting a new section and declaring it live.

**This is the load-bearing correction to PAX-02's own recommendation.** My clause C-2 — *"exactly one section may state the live frontier"* — reproduces the defect it names, because it does not say what happens when the frontier moves. **Withdraw C-2 as drafted.** The replacement is one sentence, in §7.

### 2.3 The one genuine mechanical gap: Gate 3's firing condition is circular

`Veritas AGENTS.md:102`:

> *"Fires at an integrated phase or closure boundary, or at PR preparation. It fires immediately, outside a boundary, **only when a live instruction in an active document would misdirect the CURRENT frontier — and the dispatch must name the misdirecting sentence and the exact frontier action it would misdirect.**"*

**Larry must already know the misdirecting sentence in order to trigger the gate whose job is finding misdirecting sentences.** Between boundaries, the only detector of map drift is the person whose drift it is. That is a real, small, structural defect — and it is the *only* part of Warwick's diagnosis the evidence supports.

Note the asymmetry that produced the 2026-08-05 catch: it was **not** a Gate 3 dispatch. It was a *rotation-readiness* review, and Veritas **widened scope** to reach the block (`:25`). Rotation is where it was caught. Rotation is where the model should keep it.

---

## 3. ANSWERS TO THE TEN QUESTIONS

### Q1 — Does the hierarchy describe the successful BUILD-020 method?

**Project → Build → Wayfinder → Phase → Work Package is accurate as vocabulary and useful.** "Phase, never Stage" is already the estate's word throughout. No objection.

**The «Warwick calls Work Packages» clause is REFUTED as description. Larry's reading (his point 1) is right, and understated.** The decisive counter-example is not the ones he names — it is **§14.14**:

> map:1011-1027 — *"WP-2A split along the contract seams. Keel's four class-A refusals were all correct. The work divides:"* — Larry then split one Work Package into **three owner-scoped pieces** (Keel / Mack / Larry), mid-phase, in response to a worker's refusal, and added the safety-critical sequencing note at `:1020`:
>
> *"**Mack's deletions land first; Keel's `git worktree remove` is HELD until Larry releases it.**"* — without which *"an accidental invocation stops being a takeover and becomes a **silent Tower death**."*

Warwick's involvement was `C-3` at `:999`, a routing confirmation **after** the split. **The highest-consequence work-package decision in Phase 2 was made by Larry, mid-flight, from a worker's evidence, and it was correct.** Under «Warwick calls Work Packages» read literally, that split waits for Warwick — and if it does not wait, the rule is already being broken on day one.

**Verdict: the hierarchy is descriptive; the WP-authority clause is a genuine tightening and must be presented as a change, not a description.** **Confidence: High.**

### Q2 — Is «Larry plans Phases; Warwick calls Work Packages» operationally safe and clear?

**No, not as stated.** Two failures:

1. **It has no term for what §14.14 is.** Re-shaping an in-flight package because a worker's read-back proved the original shape unsafe is neither "continuing the approved Phase" nor "opening a new WP". The rule is silent, so it will be resolved by improvisation — which is exactly what a rule of this kind exists to prevent.
2. **Larry's availability objection (his point 2) is correct and I would put it harder.** Rule 4a's core is *"Waiting in the foreground makes Larry unreachable, which is the failure Rule 4 exists to prevent."* A rule requiring Warwick to call every WP converts every package boundary into a potential stall, and stalls are indistinguishable from progress until he looks. The interrupt list is closed and has seven members; **"I need a new Work Package" is not one of them**, so the rule as written creates a class of blocked work with no legitimate way to interrupt for it.

**What is safe, and is a narrower version of what Warwick wants:**

> **Larry may re-shape work inside an accepted Phase. He may not admit new scope, change an accepted outcome, or promote a parked item without Warwick.**

That draws the line at **scope**, which is decidable, rather than at **package**, which is not. And it is **already law** — `CLAUDE.md` interrupt #1: *"a genuine product decision, **including a material change to agreed scope**."* Nothing new is needed.

### Q3 — Can Larry recommend a WP without activating it, and through what surface?

**Yes, and both surfaces already exist and are already mandatory.**

- **Between rotations:** `Deliverables/BACKLOG.md` and the map's `SHIT TO DO` — non-directive by construction.
- **At rotation:** `.claude/commands/rotate.md:25` — *"Update the active Wayfinder with the truthful phase, gate, frontier, exact next action, branch and head, **and the deliberately parked residue. Parked is a decision and must look like one; silence reads as forgotten.**"*

No new surface. **A recommendation that is not visible at a rotation boundary is Larry's failure to use `/rotate` step 2, not a missing mechanism.**

### Q4 — Is "SHIT TO DO" load-bearing, and what is the minimum rule?

**Yes, load-bearing — and the name is doing real work.** Its provenance is a deliberate experiment: `2026-08-02-wayfinder-operating-reset-plan.md:21` — *"Warwick deliberately tested this with a CareerAIR tangent at 05:40… to see whether Larry would 'run off like a Labrador after a tennis ball.' Larry chased it for eight tool calls before flagging the dilution. **Hence a written rule instead of an instinct.**"* Rename it and you sever it from the incident that created it. **Keep the name.** It also appears in root `CLAUDE.md` (Codex-budget clause) and in five maps.

**The minimum non-directive rule already exists, dated, in Warwick's own words** — `2026-08-02-wayfinder-operating-reset-plan.md:223-230`:

> *"🔴 **AUTHORITY CORRECTION — WARWICK, 2026-08-02.** Larry was not authorised to decide which rows were promoted rather than completed. **He may RECOMMEND a disposition; he may not make that product decision.**… Larry did both halves — recommended and decided — which quietly converted a deferral list into his own disposition authority."*

**Nothing needs writing.** What is genuinely missing is only that this lives *in a map* rather than in law — see Q8.

### Q5 — Should rotation explicitly surface SHIT TO DO for disposition?

**Already required. `rotate.md:25` and `:91`.** Add nothing. If it is not happening, that is an execution failure at a step that already exists, and adding a second instruction to obey the first is the regrowth pattern.

**One genuine refinement, and it is a deletion not an addition:** `rotate.md:72` step-11 compares map path · phase/frontier · next action · report pointer · closing head — **but not `focus`**, the one free-text Honcho field that has misdirected a fresh Larry twice. PAX-02 recommended adding it; I still do. **One word.**

### Q6 — Should Veritas's remit formally include map integrity and transition readiness?

**Map integrity: already included** (§1.1). Formalising it again creates a second definition of Gate 3 — the exact SSOT defect this commission forbids.

**Transition readiness: partly missing, and this is worth having.** `AGENTS.md:157` requires reconstructing the claim from the Wayfinder gate; nothing asks *"is the next transition ready?"* But the honest place for it is **not** a new Veritas dimension — it is **rotation readiness**, which is where it was actually caught on 2026-08-05, by a review Veritas widened herself. That review already exists as a dispatch shape and has a receipt on disk proving it works.

**Recommendation: do not add a dimension. Make the rotation-readiness review a named recurring dispatch rather than a one-off Larry happened to commission.** That is a change to *when Larry dispatches*, costs no new text in her contract, and is grounded in the one review that demonstrably caught this class.

### Q7 — Does independent QA enforcement change the conclusion about a small `CLAUDE.md` amendment?

**No — and the evidence points the opposite way to the hypothesis.**

Warwick's premise is *"the rule lacked an independent enforcement owner."* §1 refutes it: the owner had the remit, widened scope to use it, and blocked. The rule still decayed, because **the rule's shape guaranteed it would** (§2.1). Independent enforcement of a self-invalidating rule produces exactly what we see — one catch, one repair, and the repair itself going stale.

**Adding compliance-checking to every Veritas verdict would not have changed a single verdict on 2026-08-06.** She found the drift, named it, and parked it under the disposition rule (`gate1-pass-a1e124a:153`). To change the outcome you must change the *disposition* rule — make map staleness blocking — which is Larry's point 4, and it is correct: root `CLAUDE.md` §15.3d's whole purpose was reducing delivery tax, and this would convert ~6 correctly-parked non-blockers into HOLDs inside one day.

**A small amendment is still justified — for a different reason than Warwick gives.** The justifiable clauses are the two things with genuinely no canonical home: the machine-read marker (PAX-02 C-1) and the frontier's *canonical name* (§2.2). Neither is about enforcement ownership.

### Q8 — What belongs where?

| Rule | Already binding? | Where |
|---|---|---|
| Larry plans Phases | **Yes** — `CLAUDE.md` § Wayfinder (mandatory map, phases, gates, acceptance) | Nowhere new |
| Warwick alone materially amends scope / promotes parked items | **Yes** — `CLAUDE.md` interrupt #1 *"material change to agreed scope"*; `2026-08-02` authority correction; memory `recommend-disposition-never-decide-it` | **Only genuinely missing thing: the authority correction lives in a map (precedence rank 2, build-scoped) rather than in law (rank 3, estate-wide).** One sentence in root `CLAUDE.md` promotes it |
| Warwick alone *calls* Work Packages | **No — and it should not be adopted as written** (Q1, Q2) | Replace with the scope-boundary form, which is already law |
| SHIT TO DO durable but non-directive until promoted | **Yes**, in five maps + the authority correction | Map-level. Correct home. Leave it |
| Veritas assesses map integrity at every verdict | **Yes for Gate 3**; Documentation truth is already mandatory on all three | Nowhere new. Adding it duplicates `AGENTS.md:102-109` |
| No PASS while the map is contradictory/stale/unsafe | **Yes, verbatim** — `AGENTS.md:109`, scoped by effect via `CLAUDE.md` § Finding disposition | Nowhere new |

**Four of Warwick's five candidate clauses are already binding. One should not be adopted. The residue is one sentence of promotion.**

**What must live only inside each Wayfinder:** the phase route and gate questions · the ACTIVE SESSION WORK PACKAGE · that build's SHIT TO DO · the precedence block · the exact next action and its discharge test. All build-specific; none generalise.

### Q9 — How to stop Veritas blocking on harmless untidiness while still blocking real ambiguity?

**Already solved, already applied, and the evidence proves it.** Root `CLAUDE.md` § Finding disposition — *"Documentation blocks according to effect"* — enumerates the five blocking effects and parks the rest. Larry's point 3 asks whether it genuinely covers the map-integrity case. **It does, and I can show it firing in both directions on the same day:**

- **Blocked** where effect existed: `phase4-closure-fa2018f:93` — §17.0 claiming J1-1 OPEN while the frontier claimed closed → **HOLD**, because `:133` *"a fresh reader landing on §17.0… is told J1-1 is still open."*
- **Parked** where it did not: `gate1-pass-a1e124a:153` — *"non-blocking **unless they start misdirecting the live frontier**."*

**No new wording. Point at the clause.** Any new "map integrity" dimension that does not inherit this test will produce the delivery tax Larry fears; any that does inherit it is a duplicate.

**Caveat, stated honestly:** the test failed to catch defect (a) in §2.1 — the first-read pointer to a two-phase-stale section. That has real effect and should have blocked. **The failure was detection, not doctrine.** Doctrine got it right; nobody ran the query.

### Q10 — The smallest coherent amendment

**Two sentences added, one drafted clause withdrawn, one word changed elsewhere. Nothing else.**

**A-1 — the frontier has a canonical NAME, not a unique location.** *(New. Replaces PAX-02 C-2, which is withdrawn as self-invalidating.)*

> *A map's live frontier lives in one section with a fixed canonical name. Moving the frontier means replacing that section's contents — never declaring a different section live. A map may not contain a second block that asserts it is the live frontier, and a sentence claiming a section is the only such statement is itself a defect, because nothing retracts it when the frontier moves.*

*Justification: seven frontier-shaped blocks exist today, five stale, two unmarked (§2.1). The pattern that worked — every 2026-08-06 receipt binding to `§ ACTIVE SESSION WORK PACKAGE` by name — is unwritten anywhere.*

**A-2 — the marker is a machine-read interface.** Unchanged from PAX-02 C-1. Still the only clause backed by a **lost-and-restored** event (`ed5e96f`), and Larry's `LARRY-01` execution strengthened it: an ordinary map-less branch silently resolved to the Proofline map.

**A-3 — promote the 2026-08-02 authority correction from a map into law.** One sentence: *"Larry may recommend the disposition of a parked item; promoting one into active scope is Warwick's product decision."* This is Warwick's own text, dated, already obeyed — it simply lives at the wrong precedence rank.

**Plus:** add `focus` to `/rotate` step 11 (`rotate.md:72`). One word.

**Explicitly NOT in the amendment:** «Warwick calls Work Packages» (Q1/Q2) · any Veritas dimension (Q6) · any SHIT TO DO rule (Q4) · any map-integrity blocking rule (Q9) · PAX-02's C-3 (the ACTIVE SESSION WORK PACKAGE definition — **downgrade to advisory**; it is now proven in receipts and does not need constitutional force, and making it mandatory for every map imports BUILD-020's session shape into builds that will not have one).

---

## 4. WHERE I DISAGREE WITH LARRY

1. **His point 1 is right but too gentle.** He offers §14.14 as evidence Larry *proposed* WPs. It is stronger: Larry *split* one, mid-phase, on a worker's evidence, and the split carried the safety-critical sequencing that prevented a silent Tower death (`:1020`). The rule as drafted would have blocked the best decision in Phase 2.
2. **His point 5 is right, and I would extend it to his own PAX-02.** He asks how much is already law. Answer: four of five clauses. **And my own C-2 was wrong** — it reproduced the defect it was written to fix. I am withdrawing it rather than defending it.
3. **His framing of the new evidence is the biggest problem.** *"Eight receipts… none flagged the contradiction… because it was not in her remit"* is wrong on remit, wrong on flagging, and undercounted. Presented to Warwick unchallenged, it would have justified an amendment on a false premise — which is precisely the failure the estate's own doctrine (*a control is not evidence until made to fail*) exists to catch. **He asked me to test it rather than accept it. That instruction was the most valuable line in the commission.**

## 5. WHERE I DISAGREE WITH WARWICK

1. **"Nobody at the gate explicitly owned the question — does the fucking map still make sense?"** — **Somebody did, and she asked it, and she blocked on the answer, and the fix is credited to her at map line 19.** The diagnosis is wrong; the *feeling* behind it is right, because the fix went stale again and nobody noticed.
2. **«Warwick calls Work Packages» will not survive contact with a worker refusal.** It has no term for re-shaping in-flight work, and it has no interrupt code, so it will be broken quietly rather than obeyed.
3. **The proposed Veritas dimensions are a near-verbatim restatement of `AGENTS.md:102-109`.** Adopting them creates two definitions of Gate 3 — the SSOT defect Warwick himself ruled against on 2026-08-06 when he ordered Rule 4a's verbatim copy replaced by a pointer (map:80-86).

## 6. WHAT I COULD NOT ESTABLISH

- **No `Bash`.** Every claim here is read from committed artefacts at `fb3a61c`. I ran no command, no test, no resolver.
- **Whether all sixteen 2026-08-06 Veritas files were committed that day**, or how many were gate receipts versus addenda. The "eight" figure is unverified in either direction.
- **Whether any fresh session has actually been misdirected by defect (a)** — the stale first-read pointer to §14.19. The hazard is established by reading; the harm is not.
- **Whether Warwick's own experience of "the map stopped making sense" corresponds to the defects I found**, or to something I have not looked at. He described a feeling; I found seven artefacts. **They may not be the same thing**, and if they are not, the amendment above is aimed at the wrong target.
- **Fact vs judgement.** §1, §2.1 and the quoted lines throughout are sourced fact with file and line. §2.2, §3's recommendations, §4, §5 and the A-1/A-2/A-3 draft are **my judgement** built on that evidence.
