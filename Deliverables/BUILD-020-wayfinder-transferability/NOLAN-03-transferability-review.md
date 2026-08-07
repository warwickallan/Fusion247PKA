---
name: NOLAN-03-transferability-review
type: review
author: Nolan
reviews: PAX-02-wayfinder-transferability.md
governance_head: ae3c8db
branch_read: build-020/phase4-automation-law
created: 2026-08-06
private_surface: none
status: report-and-recommendation-only
---

# NOLAN-03 — Independent review of PAX-02

**Read-only. Nothing was implemented. Nothing was written in `C:\Fusion247PKA-build-020-trial`. No canonical instruction, template, SOP, Guideline, registry, validator or hook was created. No Work Order raised.**

I am the brake. My value here is subtraction, so this review proposes no mechanism, no better design and no additional scope. Where I say "smallest correction" I mean *cut*, not *replace*.

---

## 0. Read-back

**(a) Outcome.** Test PAX-02 for accidental complexity, duplication and cargo-culting of Proofline; confirm or refute Pax's reading of my 2026-08-01 verdict; rule on the size question; spot-check causation; flag anything unsafe to codify before its evidence exists. Verdict: as written / reduced / not at all.

**(b) Plan.** Read PAX-02, my own NOLAN-02, root `CLAUDE.md` § Wayfinder, `/rotate`, and — because Pax had no `Bash` and I do — **execute** the load-bearing claims rather than accept them.

**(c) What the order failed to settle.** Nothing material. The order forbids me creating a template, SOP or Guideline; PAX-02 §7c *is* a proposal for constitutional text. I read the prohibition as binding my own recommendations, not as preventing me judging his. So I judge it and propose nothing new.

**(d) What looks wrong in the order.** Nothing that blocks.

---

## 1. Verdict up front

> **REDUCED — to roughly one-sixth of what is proposed. One word ships now. Two sentences ship only after a mutation test. Everything else is cut.**

PAX-02 is a good report. Its evidence discipline is real, its causation labels are honest, its §9a Proofline discard list is thorough and I found nothing to add to it. **The defect is concentrated in §7c — the part that becomes law.** Three clauses are proposed; on execution, one describes a mechanism incorrectly, one rests on a property that failed inside its own build, and one restates law already binding 190 lines earlier in the same file.

---

## 2. Findings

### N-1 — The remedy is **three times the size of the section it amends**. *(accidental complexity — headline)*

Measured, not estimated: `CLAUDE.md` is **271 lines**. § Wayfinder spans **lines 177–197 — 21 lines**. A "~40-line amendment" **triples that section and grows the whole constitution by ~15%**.

"40 lines, one file, no new artefact" sounds like restraint. Against this denominator it is not. This is the file every session and every specialist bootstrap loads before doing anything. My own 2026-08-01 cost test — *"a live retrieval cost, paid on every dispatch"* — now applies to the **remedy**, and the report never computes the denominator.

**Smallest correction:** cap the amendment at what genuinely cannot be said anywhere else. On my count below that is **~4 lines and one word**, not 40.

---

### N-2 — C-1 lifts a mechanism description out of live source into the constitution — **Pax's own rule, broken by Pax**. *(duplication)*

§6b item 4 states it correctly: *"a rule in two places drifts"* — Rule 4a was copied verbatim into the map, drifted, and Warwick ordered it replaced by a pointer.

C-1 does exactly that to `~/.mypka/governor/continuity.mjs`. I read the resolver in full (lines 199–334). Every mechanical fact C-1 proposes to write into `CLAUDE.md` — marker identification, branch-scoped-first recency, ambiguity → null, "there is no pointer field" — **is already in that source at far higher fidelity, with its reasoning, maintained by whoever changes it.**

And C-1's copy is **already wrong**. It says the map is *"selected by branch-scoped git recency… two equally recent maps resolve to nothing."* It **omits the repo-wide fallback** — the one live failure mode Pax names in his own §4f. `LARRY-01-fallback-misfire-EXECUTED.md` then shows the rule *itself* is defective, not merely undocumented. **Codifying C-1 as drafted would freeze an incomplete description of a defective mechanism into the constitution**, and the constitution is the surface least able to be corrected quickly.

**Smallest correction:** cut the entire mechanism description. Keep only what is operative and durable across any future resolver — two sentences:

1. the START/RESUME block's first sentence is a machine-read interface; do not reword, reformat or remove it;
2. a map is made active by **committing a change to it on the working branch** — there is no pointer field to edit.

Sentence 2 is complete as an instruction precisely because following it means the fallback never fires. Everything about *how* the resolver decides stays in the resolver.

---

### N-3 — C-2's evidence base **failed inside its own build, and is broken at the reviewed head right now**. *(causation — the weakest claim, load-bearing)*

§1 calls the single-frontier rule *"the single highest-value thing this build produced."* §2 grades the same item *"the fix's benefit is a counterfactual."* Those are not compatible, and the report resolves the tension in favour of the stronger word.

I checked whether the property survived. It did not. At `ae3c8db`, `Deliverables/2026-08-04-proofline-wayfinder-plan.md` carries **four** frontier-shaped headings:

| Line | Heading | State |
|---|---|---|
| 421 | `## 12. Phase 1's frontier — ⛔ SUPERSEDED AND HISTORICAL` | correctly struck, correctly pointered |
| 1423 | `## 14.19 ⭐ THE CURRENT FRONTIER — single statement` | **asserts *"This is the ONLY place in this map that states the live frontier"* — now false** |
| 1660 | `## 16.8 Frontier` | **unstruck, no pointer, stale (Phase 3, step 1)** |
| 2336 | `## 17.4 Frontier` | the live one |

**The single-frontier discipline held for exactly one repair on 2026-08-05 and then decayed across two subsequent phases, inside the very document that invented it, undetected until this review.** Pax promotes it to constitutional law without checking whether it survived its own build.

This does not make C-2 *wrong*. It makes it **unproven as a durable property** — and no mechanism may enforce it (regrowth cap), so a clause is a hope written in the most expensive place. §14.19's own declaration is the control experiment: a strongly-worded in-document rule was already tried, and it failed twice.

**Smallest correction:** do not promote C-2. Record the four-heading finding for Warwick and re-test after one phase in which the property is deliberately applied. If it decays again unassisted, a louder rule is not the answer and writing one first removes the chance of learning that.

---

### N-4 — C-3 restates law that already binds **in the same file**. *(duplication — same-document, the worst kind)*

Pax: *"`CLAUDE.md` Step 2 names it four times but never defines it."* Executed count: **five** — and it is already substantially defined.

- line 42 — its contents: *"(acceptance criteria, completed items, residuals)"*
- line 46 — Larry's duty to update it when Warwick amends scope
- line 51 — its place in the authority order
- **lines 234–241, § Veritas dispatch** — the functional-vs-assurance row split, per-row PASS/HOLD/FAIL, "every dispatch derives from it", and the **prohibition on narrowing**

C-3 restates all four. Two definitions of one section, **190 lines apart in one file, both equally canonical**, is precisely the failure the commission forbids — and it is worse than a template, because with a template you can at least name the loser.

**One sentence of C-3 is genuinely new and genuinely needed:** the Work Package may be updated *outside* a phase boundary. That matters because § Wayfinder today says *"Update a map only at a phase boundary"* while line 46 requires an off-boundary update. **That contradiction is live in the constitution right now**, and Pax found it without naming it as such.

**Smallest correction:** cut C-3 entirely. Add the exception as a subordinate clause on the **existing** phase-boundary bullet — about one line. That fixes the real defect and creates no second definition.

---

### N-5 — The anti-template argument is **unsound**; its conclusion is right. *(charge #2 — tested as instructed)*

Warwick asked me to test Pax's claim that a template *"creates a second definition of a machine-read string — the highest-risk possible duplication in this estate."*

**False as stated.** By execution, the marker string already exists in **seven** places by design: the `WAYFINDER_MAP_MARKER` constant in `continuity.mjs`, plus six marker-carrying maps in `Deliverables/` —

```
2026-08-02-build-019-public-platform-wayfinder-plan.md
2026-08-02-tower-watcher-github-sqlite-migration-plan.md
2026-08-02-wayfinder-operating-reset-plan.md
2026-08-03-build-006-vlogops-publishing-engine-wayfinder-plan.md
2026-08-04-build-015-asdair-wayfinder-plan.md
2026-08-04-proofline-wayfinder-plan.md
```

Verbatim copying is **the mandated mechanism, not a defect** — the resolver depends on the copies existing. A template would be an eighth instance, not a second definition.

**The conclusion still holds, for a reason Pax already supplies and then walks past:** `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md` (631 lines) **is** the exemplar, `CLAUDE.md` already points at it by path, and a template file would be a redundant second exemplar with no owner.

**Smallest correction:** keep the conclusion, retire the argument. A wrong argument for a right answer gets re-litigated the moment someone checks it — which is what just happened.

---

### N-6 — The `focus` word is the only item that should proceed **unchanged and now**. *(verified)*

Verified in `.claude/commands/rotate.md`: step 11 compares **map path · phase/frontier · exact next action · report pointer · closing head**. `focus` is absent.

And `focus` is not a minor field. `continuity.mjs:522` renders it **first**: `⟦CONTINUITY⟧ focus: … — next: …`. It is the most-read field in the brief and the only one the read-back does not check. It is free text, written at rotation, never derived from the map. Both recorded misorientations ran through it.

One word, existing file, existing step, existing route, no new mechanism, and it closes a twice-realised failure. **This is the highest value-per-byte item in the entire report. Ship it.**

---

### N-7 — §9 is big enough on Proofline, **too small on single-observation promotions**. *(charge #3)*

§9a is thorough; I have nothing to add. §9b and §9c are correct.

The cargo-culting that survives is not Proofline product — it is **promotion on one observation**:

- **N-4 (the discharge test)** and **N-5 (gate-shaped phases)** in §6a each rest on **one map** — BUILD-015 — which §4c records as *never accepted by Warwick as a document* and which has **never directed a session** under the property being praised.
- Praising a design that has never been made to fail is the same move as praising the notification hook, which §4.12 correctly records as a demonstrated negative.

**Smallest correction:** keep both as *recommendations in the report*. Do not carry either into constitutional text. §6a's list of seven "required elements" is drafted in the register of law; only N-1, N-2 and N-3 have any BUILD-020 evidence at all, and N-2's has now failed (N-3 above).

---

### N-8 — On the size cap: **NO cap. The existing rule already forbids what caused the growth.** *(charge #5)*

Verified: the map is **2,453 lines** — 5.4× the 454-line BUILD-018 map I flagged in 2026-08-01 as *"a live retrieval cost, paid on every dispatch."* My TRIM verdict was never applied. Section numbering is worse than Pax reports: §15.1–15.4 sit inside the §14 series, §14.15–14.21 follow §15.4, §14.11 follows §14.21, §13.4–13.6 follow §14.11, and §17.7/§17.6/§17.4 follow §17.9.

**And yet the answer is no cap, and not out of softness.** § Wayfinder already says: *"Update a map only at a phase boundary — PASS, PARTIAL or FAILED, with an evidence pointer."*

Executed: **46 of the 81 commits on this branch touched the map**, on a branch covering a single phase. The map grew 1,847 → 2,453 lines across those 46 touches. **The bloat is an existing rule being ignored roughly forty times, not a missing rule.** A numeric cap would be a second rule for a defect the first already forbids — duplication — and it is unenforceable by construction (no validator, no hook, by law). It would be broken exactly the way §14.19's own single-frontier declaration was broken (N-3).

**What happens to the existing oversized map: nothing. Do not rewrite it.** It is the record, and the corrections it preserves are its only durable value. If Warwick wants the retrieval cost down, the cheap move already sits in Pax's §6b — the ~700-line §17 session narrative moves to `Deliverables/` and is pointed at. **That is a Warwick decision, and I am not raising it as work.**

---

### N-9 — What is **unsafe to codify before its evidence exists**. *(charge #7)*

I executed what bears on the clauses. Pax had no `Bash`; I did.

**Verified by execution (read-only, no state written):**
- `resolveActiveMapPath()` from the BUILD-020 worktree returns `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — the resolver works.
- Six marker-carrying maps, enumerated above. **Pax's §4f contradiction is real:** `2026-08-02-tower-watcher-github-sqlite-migration-plan.md` — which the BUILD-020 map calls a stale decision record — is a live eligible candidate.
- Repo-wide recency among all six currently selects the **Proofline** map, corroborating `LARRY-01`.

**NOT verified, and load-bearing for C-1: T-3, the mutation test.** Nobody has made the marker fail. *"Changing it removes the map from discovery, silently"* is read from source and is the sole justification for C-1's strongest sentence. It is probably true. **It is not evidence**, and the estate's own lesson is that a control is not evidence until made to fail.

**Consequence:** even the two surviving sentences in N-2 wait on T-3. Pax's §10 Option A says prove-first and is right — **but Option A as drafted runs T-1, T-5 and T-7 and omits T-3**, which §8 itself calls one of the two important ones (*"T-1 without T-3 proves only that something rendered a path"*). That inconsistency is Pax's, and it matters because T-3 is the cheapest of the four, is scratch-only, and is the single test that can prove C-1 wrong.

---

## 3. Charge #4 — my own 2026-08-01 verdict

**Pax's reading is half right, and I will not let the other half stand.**

| My 2026-08-01 reason | Pax's status | My ruling |
|---|---|---|
| *"a method that would fire on perhaps one build a quarter"* — the saving is rare | VOID | ✅ **CONFIRMED VOID.** The 2026-08-02 mandate inverted the frequency premise. That limb of my argument is dead and I retract it. |
| *"an SOP is a candidate at every routing decision forever"* — retrieval burden | (folded into the above) | ⚠️ **NOT void — and it is the limb that survived.** Retrieval cost is paid whether or not the method fires. It is the argument that now defeats a 40-line constitutional amendment (N-1). Pax merged this with the frequency limb and lost it. |
| *"An SOP makes over-application easier, not harder"* | MOOT | ❌ **REFUTED.** The mandate makes the *existence* of a map compulsory and explicitly leaves *depth* to judgement: *"the depth of investigation inside a map may reflect the actual complexity and fog."* Over-application did not disappear; **it moved from "should we chart?" to "how much do we chart?" — and a 2,453-line map is the answer.** The evidence for this reason is now **stronger**, not moot. |
| *"the estate's precedent is a Template, not an SOP"* | NOW ALSO REJECTED | ✅ **Conclusion accepted; reasoning rejected** — see N-5. No template, because the proven map already is one. |
| My proposed sharper trigger test (*produce three work packages, or chart*) | — | ✅ **Void, on my own motion.** Superseded entirely by the mandate. It should not be revived. |

**Does BUILD-020 evidence change my verdict? No — it hardens it.** In 2026-08-01 I rejected two new governance artefacts partly on a frequency argument that has since evaporated. The rejection survives on the surviving limb, and BUILD-020 supplies what I did not have then: a measured instance of the over-application failure at 5.4× scale, and a measured instance (N-3) of an in-document rule failing twice with no enforcement available. **Both point the same way: less written law, not more.**

---

## 4. Verdict

> **REDUCED. Proceed with roughly one-sixth of §7c.**

### PROCEED

| # | What | When | Size |
|---|---|---|---|
| 1 | **Add `focus` to `/rotate` step 11's comparison list** | **Now.** No dependency, no gate, closes a twice-realised failure | **1 word** |
| 2 | Add the ACTIVE SESSION WORK PACKAGE **exception** to the existing "update a map only at a phase boundary" bullet — resolving a live contradiction in `CLAUDE.md` | With the normal constitutional gate | **~1 line** |
| 3 | Two sentences in § Wayfinder: the marker is a machine-read interface, do not reword it; a map is made active by committing to it on the working branch | **Only after T-3 passes.** If T-3 fails, sentence 1 is wrong and must not exist | **~2 lines** |

Total: **~4 lines and one word**, against ~40 lines and one word.

### CUT

1. **All of C-1's mechanism description** — branch-scoped recency, ambiguity→null, the resolver's selection rule. It lives in `continuity.mjs`, it is already incomplete in C-1's copy, and `LARRY-01` shows the rule it describes is itself defective. *(N-2)*
2. **All of C-2.** Not proven durable; failed twice inside its own build; unenforceable by law. *(N-3)*
3. **All of C-3** except the one-line exception promoted above. It restates § Veritas dispatch and Step 2. *(N-4)*
4. **The §7b/§7d claim that a template creates a second definition of a machine-read string.** Factually false — seven copies exist by design. Keep the no-template conclusion. *(N-5)*
5. **§6a's N-4 and N-5 as constitutional material.** Single-observation promotions from a map that never directed a session. Keep them as report recommendations. *(N-7)*
6. **Any map size cap, numeric or otherwise.** The phase-boundary rule already forbids the behaviour; a cap is duplication of an unenforceable rule with an unenforceable rule. *(N-8)*

### DO NOTHING TO

The existing 2,453-line map. Do not rewrite, do not renumber, do not trim it as part of this. *(N-8)*

### Where I agree with Pax without reservation

§9a's Proofline discard list · §9b's do-not-revive list · §3b/§3c/§3d's twelve **"None — already canonical"** rows, which are the most valuable content in the report and the least likely to be read · §4d's append-only rebaseline shape · §5's six-step switching lifecycle, every step of which runs on an existing route · **Option A over Option B** · and the honesty of §11's limitations, which is what made this review cheap.

---

## 5. What I did not do

- Nothing implemented, adopted or installed. No canonical instruction, template, SOP, Guideline, registry, validator or hook created or modified.
- Nothing written in `C:\Fusion247PKA-build-020-trial`. The BUILD-020 worktree was read and executed against read-only (`git rev-parse` / `grep` / `log`, and `resolveActiveMapPath`, which writes no state).
- `private_surface: none` — nothing under `C:\.fusion247\**` was read or written.
- **No Work Order raised.** Every finding here is an observation. What becomes work is Warwick's decision, and the four-heading finding in N-3 and the `CLAUDE.md` phase-boundary contradiction in N-4 are reported once, for him.
- No redesign, no alternative mechanism, no expanded scope. Where I disagreed with Pax I cut; I did not counter-propose.
