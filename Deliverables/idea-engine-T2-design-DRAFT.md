# T2 — True-Divergence Idea Engine — DESIGN (Warwick + GPT red-team AGREED core; 4 corrections folded 2026-07-26)

> **Status 2026-07-26:** core T2 architecture AGREED by Warwick + GPT red-team. Four corrections folded (do NOT
> reopen architecture generally): (1) **Neo4j = 5 core branches + a post-emit ENRICHMENT layer, not a 6th reasoning
> branch** (Larry integration call — corpus=5, degree anti-signal, no join key); enrichment runs AFTER branches emit,
> BEFORE convergence, informs BOTH directions (raise/lower/flag), never gates, never silently deletes. (2) Convergence
> distinguishes **NOVEL-INDEPENDENT** vs **CONTEXT-INDUCED** convergence — both preserved, scored honestly; a
> brief-foregrounded target is NOT worthless "prompt echo". (3) Warwick blind rating = **DEFENSIBLE? / VALUE? /
> TIMING? / SURPRISED-ME?** per candidate, origin hidden. (4) The ~75k envelope was a faculty estimate — real
> `claude -p` usage is wrapper/cache-dominated (T1 reported ~144k); **T2's real cost must be MEASURED, not asserted**
> (quality-first on Max, not optimised away). ONE Audi calibration authorised before the full six-fixture experiment.

**Core framing:** T1 already runs an 8-lens set *inside one call* — but along ONE reasoning trajectory, which
collapses to sameness (the ADHD-source finding). T2's "frames" are NOT T1's internal lenses — each frame is a
**whole isolated Transfer-Specialist pass** with a different objective function + a different B-slice, on the same
whole source, blind to the other frames. Divergence is bought by **isolation + differentiated objective +
differentiated context**, not a longer prompt.

## (A) BRANCH / FRAME ARCHITECTURE — 5 core + 1 conditional
Selection test: include a frame only if its objective is *structurally orthogonal* — it mines a region of
transfer-space the others' acceptance criteria would actively reject. Each branch = one isolated Claude call:
same whole source + same A (roster/now/problems) + same C (governance) + a **frame-tailored B-slice** +
frame-specific self-kill calibration. Branches never see each other.

1. **Mechanism / structural-transfer** (backbone; absorbs architecture/system-design) — the defensible core;
   optimises fidelity, rejects distant leaps. B: full roster + architecture priorities.
2. **Inversion / failure-mode** — negation-derived ("source shows X failing → Fusion's Y breaks"; "invert the
   assumption"). Structurally unreachable by positive-match frames. B: current problems + rejected-patterns.
3. **Operational-leverage / Warwick-reality** (absorbs actionable UX) — indexed on Warwick's live toil/next-action
   ("kill a manual step," "blind spot"); un-clever but high-Impact. B: manual-steps + priorities + Impact lens.
4. **Commercial / cash-opportunity** — external value; routes Specialist→Warwick direct. Different objective
   entirely; internal frames under-surface it. B: Cash priorities, Bellrock/monetisation, a withheld private capability/Scout.
5. **Cross-domain / weird-but-defensible** — the high-novelty long tail ("≥1 idea none of us spotted"); optimises
   distance-under-defensibility (inverse of frame 1). B: **deliberately minimal** (starve relevance cues, lowers
   contamination). Self-kill = **harshest** (the fixture-4 garbage risk lives here).
6. **CONDITIONAL — Graph-informed contradiction/history** (only if the Neo4j audit is available) — the ONLY frame
   with Fusion's history ("we tried this in March," "already have this," "fills a known gap"). **Graph unavailable
   ⇒ branch SKIPPED not faked**; the already-exists/being-built check degrades to Larry's L3 reconciliation vs
   git+BACKLOG (as T1 today) — no correctness loss, only history-transfer forgone.

**Excluded:** standalone architecture (folds into Mechanism); standalone Warwick-UX (actionable half → frame 3;
felt/attention half is a SPIN-first *presentation* concern, not a divergence frame — a UX branch emits soft
low-defensibility "wouldn't it be nice" noise).

**Contamination vector:** all branches share A+C (must, or targets are wrong/forbidden) — that shared context is
what §B must detect. B is tailored per frame precisely to reduce it.

## (B) CONVERGENCE — one Larry-orchestrated "lead pass" (one call)
**Hard guardrail: the lead pass may NOT invent transfers not present in branch outputs** (else it re-introduces
the sameness collapse). It clusters/dedups/detects/flags/re-scores/presents only.
1. **Semantic dedup** by (fusion_target + underlying invariant), not string; keep best representative, MERGE
   provenance (record every contributing branch).
2. **Preserve conflicts** — same target, opposite recommendation → emit BOTH as a flagged `conflict` pair
   (a genuine fork for Warwick); never average.
3. **Independent-convergence** — cluster from ≥2 different frames via different reasoning → `independent_convergence`,
   confidence boost. Orthogonal frames agreeing = strongest positive signal.
4. **Two convergence types — both preserved, scored honestly (Warwick correction 2026-07-26):**
   **(A) NOVEL INDEPENDENT CONVERGENCE** — different isolated frames/mechanisms independently reach a target that was
   NOT foregrounded in shared A/B/C ⇒ strong novelty + convergence evidence.
   **(B) CONTEXT-INDUCED CONVERGENCE** — different isolated frames reach a target already prominent in A/B/C ⇒ may
   still be strong Fit/Impact/priority evidence, but NOT strong novelty evidence. **Do NOT discard B as "prompt echo".**
   Discriminator per cluster: `n_distinct_frames` · `mechanism_diversity` (diverging invariants ⇒ genuine; overlap ⇒
   same-path suspect) · `target_in_shared_brief` (the A-vs-B classifier). Novelty credit only for type A; Fit/Impact
   credit for both.
5. **Re-score NVFI** at cluster level (don't average) — Novelty may DROP if many frames found it; Impact/Viability
   confidence RISES on genuine independent convergence. Retain each branch's original NVFI in provenance.
6. **Cross-branch kill (L2 — NEW adversarial pressure)** — apply each branch's own trap-reasoning to the OTHER
   branches' clustered candidates. T1's single pass structurally cannot produce this second opinion.
7. **Full provenance + SPIN-first presentation** — source→frame→reasoning→target per contributing branch; lead with
   plain-English SPIN; machine detail behind Details; independent-convergence + conflict pairs get explicit callouts.

**NO Fable yet — structural argument:** rubbish killed at L1 (per-branch self-kill, as T1) + **L2 (cross-branch kill,
NEW — the independent second opinion T1 lacks)** + L3 (Larry reconciliation). T2 already adds the adversarial layer a
critic would fill. **Honest caveat:** L2 is the SAME model — it buys frame/context-independence, NOT
model-independence (cf. "independence must be multi-MODEL not persona"). **Falsifiable Fable trigger:** if the eval
shows forced/surface transfers still surviving as "strong" on fixture 4 after L1+L2 → model-independence required →
recommend Fable (explicit-auth always).

## (C) T1-vs-T2 EVAL PROTOCOL (same 6 frozen fixtures, same briefs/hashes)
Per-fixture measures: **T2-exclusive defensible transfers** (headline — no semantic match in T1's output, Warwick
judges defensible) · semantic diversity (on SURVIVORS) · duplicate/reword rate (raw) · forced-analogy rate (esp.
survivors-as-strong) · independent-convergence count (contamination-adjusted) · NVFI distribution (Novelty×Impact
cross-tab) · fixture-1 known-minimum hit (miss=FAIL) · thin-source restraint (5,6 → near-zero; strong survivor=FAIL)
· graph contribution (on/off delta) · raw Claude tokens · wall-clock.
**Judging standard — BETTER intelligence not MORE text:** BLIND rating (Warwick sees a merged de-labelled list;
origin revealed only after). **Per-candidate judgement (Warwick correction 2026-07-26): DEFENSIBLE? y/n · VALUE?
low/med/high · TIMING? now/later/no · SURPRISED-ME? y/n.** "Seriously-consider-now" is NOT the sole outcome — a
**high-value _Later_ idea is still successful Transfer Intelligence**; the strongest T2 evidence is a **defensible,
high-value, SURPRISING candidate T1 did not find.** Headline = **T2-exclusive defensible+high-value count**, never raw count. Anti-volume guards: (1) report high-rated-exclusive not raw; (2) signal-to-noise
= high-rated/total-emitted must NOT worsen vs T1; (3) attention-cost proxy = candidates×read-time; (4) forced-analogy
survivors count HARD against T2 (3 gems + 10 forced analogies ≠ pass). **Per-frame attribution:** tag every surviving
high-rated T2-exclusive by frame → a frame with zero high-rated exclusives across rich fixtures + non-trivial
tokens = CUT (shrink the set on evidence). Contamination audit: spot-check genuine-vs-contamination calls.
**Decision rule:** ADOPT (≥1 T2-exclusive "seriously-consider" T1 missed, no fixture-4 forced-analogy worsening, no
5/6 breakage, fixture-1 hit, signal-to-noise ≥ T1) · STAY-T1 (exclusives all clever-not-relevant, or breaks
restraint/inflates forced-analogy/worsens SNR) · TUNE (prune to value-carrying frames) · ADD-FABLE (only on the
fixture-4 trigger).

## Envelope (one T2 run vs T1)
| | Tokens | Wall-clock |
|---|---|---|
| T1 | ~12k | ~20–40s |
| T2 (5 core) | 5×~10k + ~25k convergence ≈ **~75k (~6× T1)** | branches PARALLEL (~20–40s) + convergence ≈ **~1–1.5 min** |
| T2 (6, +graph) | ≈ **~85k (~7× T1)** | ~same |
Sonnet-start throughout; Opus reserved for the convergence pass if judgement demands. Neo4j enrichment = non-Claude
query (~0 Claude tokens). Larry reconciliation outside the envelope (as T1). Optimisation target = **max useful
intelligence per Warwick decision**, not min tokens; the ~6–7× spend is justified ONLY if §C's headline clears the bar.

> **⚠️ Cost caveat (Warwick correction 2026-07-26) — the ~75k is a FACULTY/payload estimate, NOT measured Max usage.**
> Real production T1 through `claude -p` reported **~144k total Claude-Code usage per Mine** because wrapper/cache
> activity dominates. Therefore T2's real cost is **~6 wrapper-heavy `claude -p` calls** and must be **MEASURED** (see
> the Audi calibration report), not asserted as ~75k. We are deliberately quality-first on the 20× Max sub — the ask
> is honest measurement, not optimising the wrapper away.

**Reviewer should probe:** (1) is the 5-core set genuinely minimal (§C per-frame attribution is the empirical check);
(2) does the §B4 contamination discriminator actually separate genuine convergence from shared-brief echo (audited in
§C); (3) is L2 cross-branch kill real independent pressure — fixture-4 leakage is the falsifiable Fable trigger.
