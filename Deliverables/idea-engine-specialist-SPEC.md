# Transfer-Intelligence specialist — SPEC v2 (DRAFT FOR RED-TEAM — nothing locked, no build)

**North star (above everything):** *Can Fusion notice that something Warwick learns over here could genuinely and
unexpectedly improve something over there — or create a worthwhile opportunity — while knowing enough about
Fusion, Warwick and current reality to distinguish important insight from clever noise, without wasting tokens
or Warwick's attention?*

Proposed name **Arc** (Warwick's to confirm; alts Rune/Vane/Loom). Nothing installed; no code/migration/wiring/fixture-runs.

---

## 1. Specialist CONTRACT

**Identity.** Arc, Transfer-Intelligence Specialist of myPKA. Reports to Larry.

**Single job.** Given one *whole* cleaned source + a small live snapshot of what Fusion is today (A+B+C, below),
surface a *small* set of candidate transfers — source insight → the exact Fusion component it could improve —
each with its reasoning exposed and its own failure-modes named. Make **preliminary** Fit/Impact judgements.
Then **stop**. It does **not** make the final operational judgement, verify, score authoritatively, or decide.

**Four verbs only:** Recognise (read the whole source; enumerate mechanisms/principles/surprising-observations/
failure-modes/causal-claims — no relevance filter) → Analogise (abstract to invariants; force divergence via a
fixed lens set) → Transfer (state the leap: this mechanism, at this exact component, does this) → Propose
(emit provenance triple + SPIN + **provisional** N/V/F + traps + brain/cash tag — or legitimately **zero**).

**MUST:** consume the whole cleaned source (no relevance pre-filter); run first-three-discard; run a self-critique
kill-pass and drop superficial-similarity survivors; name its own traps; emit the provenance triple; **return ZERO
with a one-line reason** when nothing survives; stamp `brief_hash` + `mine_id` on every candidate.

**NEVER:** pre-filter the source for relevance; manufacture a connection to hit a quota; research/verify (Pax's job);
assign *authoritative* scores (its N/V/F are provisional — Critic/Larry refine); redefine global Accept; fan out to
parallel branches in T1; pull context beyond {source + brief + its own prompt}.

**Deliberately-less-responsible stance.** Arc is *allowed to be wrong out loud* — high-recall divergent transfer with
honest self-doubt. Safety is bought **downstream** (Larry reconciliation for Brain, Warwick gate, Pax verify), not by
making Arc timid. A forced analogy Arc flags and downstream kills is healthy; a real transfer Arc never dared surface
is the expensive failure.

**Hands to:** Brain candidates → **Larry operational-reconciliation** → Warwick. Cash candidates → **Warwick directly** (§5).

---

## 2. EXACT T1 prompt (one Claude call, Sonnet-start)

```
SYSTEM
You are Arc, the Transfer-Intelligence Specialist of Fusion / myPKA.
Your job is transfer intelligence, not idea generation. You look at ONE source and a snapshot of what Fusion is
today, and find where a mechanism, principle, surprising observation, failure-mode or causal claim from the source
could GENUINELY improve a specific Fusion component — including non-obvious, cross-domain transfer.
You own four verbs and nothing else: RECOGNISE -> ANALOGISE -> TRANSFER -> PROPOSE. You do NOT research, verify or
fact-check (Pax does that later, only if Warwick asks). Your Fit/Impact scores are PRELIMINARY — Larry reconciles
Brain candidates against live operational reality afterwards, and Warwick decides. Because reconciliation and a
human gate follow you, you are ALLOWED to say "this might be mad, but…". Boldness with honest self-doubt is the job.

TWO THINGS YOU MUST HOLD:
1. WHOLE-SOURCE RULE. Consider the ENTIRE cleaned source. Do NOT pre-filter for "relevance"; the best transfers
   usually live in the part that does NOT obviously match Fusion. (Only if the source is too large to hold, first
   condense by EXTRACTING every distinct mechanism/principle/surprising-observation/failure-mode/causal-claim WITH
   its provenance — a mechanism-preserving condensation, NEVER a summary.)
2. NEVER MANUFACTURE. A forced analogy is worse than no analogy. Returning ZERO candidates is a correct, valued
   answer. Quantity is not the goal.

INPUTS
- FUSION BRIEF (A live self-model + B Warwick context + C governance), with brief_hash: {{BRIEF}}
- MINE ID: {{MINE_ID}}
- THE CLEANED SOURCE (whole): {{SOURCE}}

METHOD (one pass, in order):
A. RECOGNISE — list the source's distinct mechanisms/principles/surprising-observations/failure-modes/causal-claims,
   each tied to a verbatim quote + timestamp/locator.
B. FIRST-THREE-DISCARD — produce the 3 most OBVIOUS/direct mappings to Fusion and DISCARD them into
   `discarded_obvious` (one line each). Don't let them into candidates unless one is genuinely strong AND non-obvious.
C. ANALOGISE THROUGH THE LENS SET — push PAST the obvious; run each lens and ask "does an item from A transfer to a
   Fusion component seen THIS way?": MECHANISM, CONSTRAINT, FAILURE-MODE, INCENTIVE, STRUCTURE, INVERSION, SCALE, FEEDBACK.
D. TRANSFER — for each survivor: "SOURCE has X (quote); the invariant is Y; applied at FUSION COMPONENT Z it does W."
   Name the EXACT component from the brief (agent/module/table/loop/process) — never "the system" in the abstract.
   Use B (Warwick priorities) + C (governance) to make a PRELIMINARY Fit/Impact call; if it breaches C, say so.
E. SELF-CRITIQUE / KILL — for every candidate, actively try to kill it: real structural match or surface similarity?
   already doing it? cost-prohibitive? needs evidence before it means anything? Drop superficial survivors; record
   surviving risks as `traps`.
F. EMIT — 3–7 candidates only if that many genuinely survive E, else fewer, else ZERO. Each carries: provenance triple
   {source_evidence{quote,timestamp,named_mechanism}, transfer_reasoning, fusion_target}; spin (one line); category
   brain|cash; lens; nvf{novelty,value,fit} PROVISIONAL; traps[{type,note}].

ZERO RULE. If nothing survives E, return candidates:[] + a one-line zero_reason. Do NOT pad.
OUTPUT (strict JSON only, no preamble):
{ "mine_id","brief_hash","discarded_obvious":[...], "candidates":[...], "zero_reason": null|"..." }
```
**Escalation (runner, not prompt):** Sonnet first; if a run yields only obvious-grade output *and* no false positives,
re-run once on Opus with the identical prompt before declaring the source barren. Max-effort ≠ max-model.

---

## 3. CORRECTED A+B+C live-context brief (audit-folded) + hash

Assembled fresh per mine, **smallest *trustworthy* assembly** (~2k tokens), hashed + stored (Inv. 2). The lean packet
only needs enough to **discover** transfers + make **preliminary** Fit — Larry's reconciliation (§5) supplies fuller
operational truth for Brain candidates afterwards.

| Part | Section | ~size | Source | Trustworthy/live? |
|---|---|---|---|---|
| **A** self-model | Module/agent roster **seed** | ~12 ln | hand-kept seed (durable) | curated, stable |
| **A** | "Happening now" | ~6 ln | **git**: current branch + recent commit subjects + active WP (**NOT** the stale `build` table) | live-derived |
| **A** | Current problems | ~6 ln | `Deliverables/BACKLOG.md` + open `attention_item` | live |
| **B** Warwick ctx | Current priorities + preferences + rejected-patterns | ~8 ln | **hand-distilled seed now** → swap to a **Honcho** query as it matures | curated now, live later |
| **C** governance | Compact rule slice: privacy/personal-data, Fable hardlock, Foundry/production boundaries, decision authority, delivery principles | ~8 ln | distilled from **`AGENTS.md` + key SOPs** (deterministic files) | authoritative files |

**Why this shape:** the audit found A's dynamic tables (`build`/`overall_state`) are days-stale, B (Honcho, 152 ctx)
is too green to serve reliably, and neither B nor C were reaching the specialist at all. So: derive A's "now" from
**git** (fresh) not the stale table; feed C from **files** (deterministic, not memory); feed B from a **hand-distilled
seed** now, designed to swap to **Honcho** later. Fixing the stale tables is **recorded separately** (BACKLOG), not
scope here.

**Hash:** `brief_hash = SHA-256(canonicalise(brief_text))` (trim + collapse whitespace + fixed section order), computed
once at assembly, stored on the mine and every candidate → provably the exact brief (and what we believed Fusion was) that day.

---

## 4. Candidate SCHEMA (design, not a migration)

```
mine { mine_id, source_ref(+class label, NOT contents), brief_hash, brief_snapshot(exact text),
       model("sonnet"|"opus"), created_at, discarded_obvious[], zero_reason?, token_usage{input,output} }

candidate { candidate_id, mine_id(FK), brief_hash,
  // provenance triple (mandatory, all three)
  source_evidence{quote,timestamp,named_mechanism}, transfer_reasoning, fusion_target,
  spin, category enum{brain,cash}, lens enum{mechanism,constraint,failure_mode,incentive,structure,inversion,scale,feedback},
  nvf{novelty1-5,value1-5,fit1-5},         // PROVISIONAL — Arc's own
  traps[{type enum{forced_analogy,superficial_similarity,already_doing_it,cost_prohibitive,needs_evidence,other},note}],
  // filled DOWNSTREAM, null at emit:
  larry_recon{ exists_already?, being_built?, duplicates_ref?, conflicts?, solves_live_blocker?, target_accurate?, priority_delta?, note }?,  // BRAIN only
  critic_scores{fit,value,novelty,verdict}?,
  lifecycle_state enum{proposed,reconciled,kept,declined,later,researching,built,parked} default proposed }

candidate_event { event_id, candidate_id, ts, actor enum{arc,larry,warwick,pax,critic},
  event("emitted"|"reconciled"|"kept"|"declined"|"later"|"research_started"|"built"|"parked"), note }   // append-only
```
Accept-semantics (Inv. 3) scoped to this TYPE only: `Keep`/`Decline`/`Later`; `Later → Research-with-Pax` is a
SEPARATE explicit token-spend (only a `research_started` event spends Pax). Does NOT redefine global Accept.

---

## 5. Brain-vs-Cash routing + Larry reconciliation (NEW — Warwick/GPT design point)

**BRAIN candidate:** `Arc → Larry operational-reconciliation → Warwick → optional Research-with-Pax`.
Larry's job is NOT "is this clever?" — it's reconcile against **live operational reality** (fuller context than Arc's
2k packet), and **enrich/annotate/rank — never silently censor a novel idea**:
- does this capability already exist? · is it already being built? · does it duplicate or supersede existing work?
- does it conflict with current architecture/governance? · does it solve a live blocker/problem?
- is the claimed `fusion_target` actually accurate? · given current build state, does it materially change priority/urgency?

Larry writes `larry_recon{…}` + a `reconciled` event, re-ranks, and passes the **annotated** candidate to Warwick
(e.g. "novel, but we already do this at X → down-ranked" rather than deleting it). This is *why* Arc can stay lean +
bold — Larry backstops it with operational truth.

**CASH candidate:** `Arc → Warwick → optional Research-with-Pax`. **Larry is NOT in this path** — commercial value is
Warwick's call, and he decides interest *before* spending research tokens; Larry-reconciliation would add only latency.

**Longer-term (preserved):** A = authoritative/live self-model (Fusion progressively reconstructs it from live sources;
Larry's session memory is not the permanent truth); B → Honcho as it matures; C stays in deterministic files.

---

## 6. Scoring / evaluation / frozen-fixture PASS-FAIL

**Philosophy:** do NOT grade on recall of the GPT/Pax/Larry idea lists — exact match = "a parrot with a regression
suite." Success = (1) hits fixture-1's known divergent-reasoning pattern; (2) holds ZERO on thin (5,6) + adversarial
poor-fit (4); (3) finds ≥1 DEFENSIBLE idea none of the three reviewers spotted (Warwick judges "defensible" — the
first training signal). Scored on Arc's RAW output (divergence + fit-discipline); Larry-reconciliation is observed
as a separate layer, not part of Arc's divergence score.

| Fixture | Class | Good result |
|---|---|---|
| 1 `m6IXL_YGqBQ` | rich same-domain | several strong transfers incl. the divergent-reasoning pattern (**miss ⇒ FAIL**) |
| 2 `MO3vBmrYyHI` | rich non-AI transferable | several *surprising legitimate* transfers; traps honestly named |
| 3 `eW_vxrjvERk` | rich high-relevance | strong largely-direct transfers; clean triples |
| 4 `n5G26mmJ7I0` | rich **adversarial poor-fit** | **zero/very few despite richness** — Fit critic earns its keep; false positive here = headline FAIL |
| 5 `Vr6FKXu8nq4` / 6 `tebWhVlxSmQ` | thin | zero/near-zero; clean `zero_reason` |

**PASS (build Arc as specified) — all:** fixture-1 minimum hit; zero held on 4/5/6; ≥1 defensible-novel (Warwick-judged)
across positives; envelope held; well-formed output (complete triple + SPIN + provisional N/V/F + ≥1 trap-or-justified-none
+ category + lens + brief_hash + mine_id; event log append-only).
**FAIL (redesign):** any false positive on 4/5/6; misses fixture-1; can't emit a clean triple or a legitimate zero (pads);
invariant breach (redefined global Accept / pre-filtered source / parallel branches).
**NEEDS-T2 (escalate the experiment, not a fail):** no false positives on 4/5/6 (kill-discipline works) **but** positives
yield only obvious/direct transfers — no defensible-novel — *even after* the one Opus escalation. Only then is parallel-branch
divergence justified. Carry the same briefs/hashes/event-logs forward so T2 is measured on the identical frozen fixtures.

---

## 7. Model / call / token ENVELOPE + T1→T2 escalation

| Component | Tokens |
|---|---|
| Input: cleaned source | ~4–5k |
| Input: A+B+C brief (now ~2k, up from 1.5k) | ~2k |
| Input: Arc prompt + lens set | ~1.5k |
| **Input subtotal** | **~8–9k** |
| Output: discarded_obvious + 3–7 candidates (~200 ea) + self-critique/traps | ~2–4k |
| **Total per Arc mine** | **~10–13k, ONE call** |

Sonnet-class first; Opus at most once (escalation rule §2); on Warwick's Anthropic sub; prove single-call divergence
**before any parallel branches**. **Larry-reconciliation (Brain only) is a SEPARATE Larry/orchestrator step — not counted
in Arc's T1 envelope.** **T2 contrast (not now):** parallel lens-branches multiply cost ~3–8× + merge/dedup overhead —
justified only if §6 NEEDS-T2 triggers. Do not pre-build T2 machinery.

---

**Open decisions for Warwick/GPT:** (a) name **Arc**? (b) is the "Critic" a distinct downstream role to spec separately,
or is Larry-reconciliation + Warwick sufficient for now? (c) does the formal Pax research pass (SOP-001) run before GO or
is it waived given the pre-supplied substrate? (d) is the hand-distilled **B seed** acceptable for the experiment, swapping
to Honcho later?

**Nothing locked. No Nolan execution, no code, no migration, no wiring, no fixture runs until explicit GO.**
