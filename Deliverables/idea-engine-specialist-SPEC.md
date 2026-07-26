# Transfer Specialist — FINAL experiment spec (red-team-corrected) — nothing locked, no build

**Working name: "Transfer Specialist"** (proposed "Arc" is free — no collision found — but NOT locked; Warwick's call later).

**North star (above everything):** *Can Fusion notice that something Warwick learns over here could genuinely and
unexpectedly improve something over there — or create a worthwhile opportunity — while knowing enough about Fusion,
Warwick and current reality to tell important insight from clever noise, without wasting tokens or Warwick's attention?*

Corrections applied from GPT/Warwick red-team: (1) durable B artefact, not session memory · (2) NVFI nomenclature ·
(3) no separate Critic in T1 · (4) Pax pre-GO research waived · (5) B = labelled `curated_seed`, Honcho-swappable ·
(6) name unlocked · (7) fixture-4 acceptance relaxed.

---

## 1. CONTRACT
**Transfer Specialist** of myPKA, reports to Larry. **Single job:** given one *whole* cleaned source + a small live
A+B+C snapshot, surface a *small* set of transfers — source insight → the **exact** Fusion component it could improve —
each with reasoning exposed and its own failure-modes named, and **provisional NVFI** — then **stop**. It does NOT make
the final operational judgement, verify, or decide.

**Four verbs only:** Recognise (read the whole source; enumerate mechanisms/principles/surprising-observations/
failure-modes/causal-claims — no relevance filter) → Analogise (abstract to invariants; force divergence via a fixed
lens set) → Transfer (state the leap: this mechanism, at this exact component, does this) → Propose (provenance triple +
SPIN + **provisional NVFI** + traps + brain/cash — or legitimate **zero**).

**MUST:** consume the whole cleaned source; first-three-discard; self-critique **kill-pass** (its own quality gate — no
separate Critic in T1); name its own traps; emit the provenance triple; **return ZERO** with a one-line reason when
nothing survives; stamp `brief_hash` + `mine_id`.
**NEVER:** pre-filter the source for relevance; manufacture a connection to hit a quota; research/verify (Pax); treat its
NVFI as authoritative (they're **provisional** — Larry refines Fit+Impact for Brain); redefine global Accept; parallel-branch in T1.

**Deliberately-less-responsible:** allowed to say "this might be mad, but…". Safety is bought **downstream** (Larry
reconciliation for Brain → Warwick → optional Pax), not by timidity. A forced analogy it flags is healthy; a real
transfer it never dared surface is the expensive failure.

---

## 2. EXACT T1 PROMPT (one Claude call, Sonnet-start)
```
You are the Transfer Specialist of Fusion/myPKA. Transfer intelligence, not idea generation.
Verbs: RECOGNISE→ANALOGISE→TRANSFER→PROPOSE. You do NOT research/verify (Pax later, only if Warwick asks).
Your NVFI scores are PROVISIONAL — Larry reconciles Brain candidates against live reality and may refine Fit+Impact;
Warwick decides. Because reconciliation + a human gate follow you, you MAY say "this might be mad, but…". Boldness
with honest self-doubt is the job. There is NO separate critic — your own kill-pass (step E) is the quality gate.
MUST HOLD: (1) WHOLE-SOURCE — consider the ENTIRE source; never pre-filter for relevance; the best transfers live in
the part that does NOT obviously match Fusion. (Too large ⇒ condense by EXTRACTING every mechanism/principle/
surprising-observation/failure-mode/causal-claim WITH provenance — never a summary.) (2) NEVER MANUFACTURE — a forced
analogy is worse than none; ZERO is a correct answer.
INPUTS: {{BRIEF: A live self-model + B curated_seed Warwick context + C governance, with brief_hash}} · {{MINE_ID}} ·
        {{WHOLE CLEANED SOURCE}}
METHOD (one pass): A RECOGNISE (mechanisms w/ verbatim quote+timestamp) · B FIRST-THREE-DISCARD (bin the 3 most obvious
mappings into discarded_obvious) · C ANALOGISE via lenses [mechanism,constraint,failure-mode,incentive,structure,
inversion,scale,feedback] · D TRANSFER ("SOURCE has X(quote); invariant Y; at COMPONENT Z it does W"; name the EXACT
component from the brief; use B priorities + C governance for a PROVISIONAL Fit+Impact; flag any C breach) · E
SELF-CRITIQUE/KILL (real structural match or surface? already doing it? cost? needs evidence? drop superficial;
surviving risks→traps) · F EMIT 3–7 only if they survive E, else fewer/zero.
Each candidate: provenance triple {source_evidence{quote,timestamp,named_mechanism} → transfer_reasoning → fusion_target}
+ spin(one line) + category(brain|cash) + lens + nvfi{novelty,viability,fit,impact each 1-5, PROVISIONAL} + traps[{type,note}].
  NVFI: Novelty=is it non-obvious? · Viability=could we realistically do it? · Fit=aligns with Fusion/Warwick? ·
        Impact=if successful, how much would it MATERIALLY matter? ("clever" and "10x" are different — score them apart.)
ZERO RULE: nothing survives ⇒ candidates:[] + one-line zero_reason. Never pad.
OUTPUT: strict JSON {mine_id,brief_hash,discarded_obvious[],candidates[],zero_reason}. JSON only.
```
*Escalation (runner): Sonnet first; if only obvious-grade output AND no forced positives, re-run once on Opus before declaring barren.*

---

## 3. A+B+C LIVE BRIEF + durable B artefact + hash
Smallest **trustworthy** assembly (~2k tok), hashed per mine. The lean packet only needs enough to *discover* + score
*provisional* NVFI; Larry supplies fuller truth for Brain afterwards.

| Part | Section | Source | Provenance / freshness |
|---|---|---|---|
| **A** | Module/agent roster **seed** | hand-kept seed file (durable) | curated, stable |
| **A** | "Happening now" | **git** (branch + recent commits + active WP) — **NOT** the stale `build` table | live-derived |
| **A** | Current problems | `Deliverables/BACKLOG.md` + open `attention_item` | live |
| **B** | Warwick priorities / preferences / rejected-patterns | **durable `curated_seed` file** (see below) | `provenance: curated_seed` |
| **C** | Governance slice: privacy/personal-data, Fable hardlock, Foundry/production boundaries, decision authority, delivery principles | distilled from **`AGENTS.md` + key SOPs** | authoritative files (deterministic) |

**Durable B artefact (correction 1 & 5):** a standalone file, e.g. `Team Knowledge/fusion-brief/warwick-context.curated_seed.md`
(~8–12 lines) with a provenance header `{ provenance: curated_seed, curated_by, curated_at, version, note: "NOT Honcho-derived;
swap to Honcho when mature" }`. **It MUST NOT be assembled from Larry's session memory at runtime** — the brief-assembler
**reads the file**. Maintained later by /close-session, CuratAir, or Warwick edits. The **B slot is source-agnostic**: swapping
a live Honcho query in later changes only the assembler, **never the Specialist's contract**. *(Session-continuity — keeping
Larry's rich context across compaction — is a SEPARATE problem, recorded in BACKLOG; do NOT build it or CuratAir now.)*

**Hash:** `brief_hash = SHA-256(canonicalise(brief_text))`, stored on the mine + every candidate → reconstructs exactly
what the Specialist saw *and what we believed Fusion/Warwick were that day*, including which B provenance was used.

---

## 4. CANDIDATE SCHEMA (design, no migration)
```
mine { mine_id, source_ref(+class label, NOT contents), brief_hash, brief_snapshot, b_provenance("curated_seed"|"honcho"),
       model("sonnet"|"opus"), created_at, discarded_obvious[], zero_reason?, token_usage{input,output} }

candidate { candidate_id, mine_id(FK), brief_hash,
  source_evidence{quote,timestamp,named_mechanism}, transfer_reasoning, fusion_target,   // provenance triple, mandatory
  spin, category enum{brain,cash}, lens enum{mechanism,constraint,failure_mode,incentive,structure,inversion,scale,feedback},
  nvfi{novelty1-5, viability1-5, fit1-5, impact1-5},        // PROVISIONAL — the Specialist's own
  traps[{type enum{forced_analogy,superficial_similarity,already_doing_it,cost_prohibitive,needs_evidence,other},note}],
  // filled DOWNSTREAM (Brain only), null at emit — Larry reconciliation, NOT a separate Critic:
  larry_recon{ exists_already?, being_built?, duplicates_ref?, conflicts?, solves_live_blocker?, target_accurate?,
               refined_fit?, refined_impact?, priority_delta?, note }?,
  lifecycle_state enum{proposed,reconciled,kept,declined,later,researching,built,parked} default proposed }

candidate_event { event_id, candidate_id, ts, actor enum{specialist,larry,warwick,pax},
  event("emitted"|"reconciled"|"kept"|"declined"|"later"|"research_started"|"built"|"parked"), note }   // append-only
```
Accept-semantics scoped to THIS type only: `Keep`/`Decline`/`Later`; `Later → Research-with-Pax` is a SEPARATE explicit
Pax token-spend. Does NOT redefine global Accept. **No `critic_scores` field — Fit/Impact refinement lives in `larry_recon` (Brain).**

---

## 5. ROUTING + LARRY RECONCILIATION (no separate Critic in T1)
- **BRAIN:** `Specialist → Larry operational-reconciliation → Warwick → optional Research-with-Pax`. Larry reconciles
  against **live operational reality** and **enriches/annotates/ranks — never silently censors**: already exists? being
  built? duplicates/supersedes? conflicts with architecture/governance? solves a live blocker? is `fusion_target`
  accurate? given build state, priority/urgency delta? Larry may **refine Fit+Impact** here, writes `larry_recon{…}` +
  a `reconciled` event, re-ranks, passes the **annotated** candidate up.
- **CASH:** `Specialist → Warwick → optional Research-with-Pax`. **Larry NOT in this path** — commercial value is
  Warwick's call before research tokens.
- **No separate Critic agent in T1** — the Specialist's own kill-pass is the quality gate; we measure its transfer
  faculty *without another agent rescuing it*. A dedicated Critic / Fable-adversary remains a possible **T2** mechanism
  only if evidence justifies it.
- **Longer-term:** A → reconstructed from live sources (session-memory ≠ permanent truth); B → Honcho; C → files.

---

## 6. SCORING / PASS-FAIL (frozen fixtures — Warwick judges defensibility BLIND)
**Philosophy:** do NOT grade on recall of the GPT/Pax/Larry idea lists (exact match = "a parrot with a regression
suite"). Success = hits fixture-1's divergent-reasoning pattern + **no manufactured/surface transfers presented as
strong on any fixture** + thin controls ≈ zero + **≥1 defensible-novel idea none of us spotted** (Warwick judges "defensible").

| Fixture | Class | Good result |
|---|---|---|
| 1 `m6IXL_YGqBQ` | rich same-domain | strong transfers incl. the divergent-reasoning pattern (**miss ⇒ FAIL**) |
| 2 `MO3vBmrYyHI` | rich non-AI transferable | several *surprising legitimate* transfers; traps named |
| 3 `eW_vxrjvERk` | rich high-relevance | strong largely-direct transfers; clean triples |
| 4 `n5G26mmJ7I0` | rich **adversarial poor-obvious-fit** (Audi) | **zero OR a few genuinely defensible cross-domain transfers is SUCCESS** (a strong one, even). This tests avoidance of FORCED analogy, NOT mechanical zero. **FAIL only = manufactured/surface-similarity transfers presented as strong opportunities.** |
| 5 `Vr6FKXu8nq4` / 6 `tebWhVlxSmQ` | thin controls | **strong zero/near-zero expectation** (retained); clean `zero_reason` |

**PASS (build the Specialist as specified) — all:** fixture-1 minimum hit · thin 5/6 ≈ zero · **no forced/surface
transfers dressed as strong on any fixture** · ≥1 defensible-novel (Warwick-judged) across positives · envelope held ·
well-formed output (complete triple + SPIN + provisional NVFI + ≥1 trap-or-justified-none + category + lens + brief_hash + mine_id).
**FAIL (redesign):** any **forced/surface-similarity transfer presented as strong** (esp. on fixture 4) · thin controls
produce a shower · misses fixture-1 · can't emit a clean triple or a legitimate zero (pads) · invariant breach.
**NEEDS-T2 (escalate the experiment, not a fail):** kill-discipline holds (no forced positives) **but** positives are
only obvious/direct — no defensible-novel — even after the one Opus escalation. Only then is parallel-branch divergence
(or a dedicated Critic/Fable) justified. Carry the same briefs/hashes/event-logs forward for identical measurement.

---

## 7. ENVELOPE + T1→T2
~10–13k tokens, **ONE call** (source ~4–5k + A+B+C brief ~2k + prompt+lenses ~1.5k in; ~2–4k out), Sonnet-start /
Opus-at-most-once, on Warwick's Anthropic sub. **Larry-reconciliation (Brain) is a separate Larry step — not in the
Specialist's envelope.** **Pax pre-GO research WAIVED** (correction 4 — no unresolved external factual question blocks
us; the frozen-fixture experiment is the stronger evidence); Pax stays downstream, only after Warwick chooses Research.
**T2 (parallel branches / dedicated Critic, ~3–8×) only if §6 NEEDS-T2 triggers — don't pre-build.**

---

## GO CHECKLIST (all must be true before build)
1. ☐ Warwick + GPT approve this spec (architecture already accepted; this is detail sign-off).
2. ☐ Name decided (or "Transfer Specialist" accepted as the experiment working name).
3. ☐ Durable **B `curated_seed`** file drafted + Warwick-confirmed (content is his to own), at the defined path with provenance header.
4. ☐ Confirm: no separate Critic, Pax pre-GO waived, fixture-4 acceptance = "no forced/surface strong-transfers" (not mechanical zero).
5. ☐ Explicit **GO**.
Then (build phase, NOT now): Nolan ships the two SOP-001 artefacts + agent-index row · the T1 runner (single call, git/backlog/file/AGENTS-derived brief + hash) · `idea_candidate`/`mine`/`event` schema · the "🧠 Mine for ideas" trigger + Larry-reconciliation step · run the 6 frozen fixtures · Warwick scores blind → PASS / FAIL / NEEDS-T2.

**Nothing locked. No Nolan execution, no code, no migration, no wiring, no fixture runs until explicit GO.**
