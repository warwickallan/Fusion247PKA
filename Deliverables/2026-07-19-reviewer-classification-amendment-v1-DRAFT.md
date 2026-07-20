# Reviewer Classification Amendment v1 — LIVE

**Status: APPROVED + LIVE (Warwick, 2026-07-19).** This amends the reviewer governing prompts (Codex, Tower-Codex, Fable). Every review packet from now on carries the three-judgement classifier + the merge rule + R1/R2 + the round-economy discipline. Origin: GPT proposal (relayed 2026-07-19) + Larry's two refinements. Supersedes the merge-decision half of the "hobby-brain threat-model bar" (see note at end). First live use: WP-D.

---

## Why this exists

The BUILD-014 WP-B and WP-C reviews exposed a **classification gap**: a single finding's *severity* was driving the *merge verdict*. On WP-C, Codex rated the `policyGate` head-staleness CRIT and Fable rated it LOW — but they actually **agreed on the facts**; they disagreed only on how one number should map to a merge decision. Severity alone is the wrong lever. The fix is to record three *independent* judgements per finding and let the **disposition**, not the severity, decide the merge.

This keeps Codex and Fable at **full defect-hunting strength** — it explicitly forbids downgrading technical impact because Fusion247 is "only a hobby system." Impact stays honest; reachability and disposition carry the merge decision.

---

## The rule — three judgements per material finding

For **every material finding**, record all three, separately:

### 1. Technical impact
`BLOCKER / HIGH / MEDIUM / LOW / NOTE`
The engineering severity **if reached** — judged on the code, never softened because the system is first-party or a hobby.

### 2. Current reachability
- **ACTIVE** — reachable in the *current authorised deployment*.
- **LATENT** — requires a *planned future capability or trust-boundary change* (e.g. a WP not yet built, a live-apply path still deferred).
- **HYPOTHETICAL** — requires an actor or path *not currently planned or authorised* (e.g. a deliberately-malicious in-process handler in a first-party, non-adversarial runtime).

### 3. Required disposition
- **BLOCKS_CURRENT_MERGE**
- **REQUIRED_BEFORE_LIVE**
- **REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS**
- **TRACKED_FOLLOWUP**
- **NOTE_ONLY**

---

## The merge verdict

**Severity alone must not determine the merge verdict.**

APPROVE is permitted when **no `BLOCKS_CURRENT_MERGE` finding remains** — even when technically HIGH (or BLOCKER-if-reached) *latent* findings are recorded against an explicit future gate.

A finding is `BLOCKS_CURRENT_MERGE` when **any** of these holds:
- it is **currently reachable** (ACTIVE), **and** materially harmful; or
- it **breaches the WP's acceptance criteria**; or
- it risks **current** data / privacy / authority / integrity; or
- it **prevents the next authorised WP from operating safely**.

Everything else routes to `REQUIRED_BEFORE_LIVE`, `REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS`, `TRACKED_FOLLOWUP`, or `NOTE_ONLY` — recorded, tracked, and **not** a merge blocker.

---

## Larry's refinements (the two things GPT's draft needs before it can drive an autonomous merge)

### R1 — Split resolution fails closed
This amendment moves the disagreement from *severity* onto *reachability/disposition*. That axis needs a tie-breaker or it is the same split in a new place.

> A **reachability or disposition split on any HIGH-or-above finding** is treated as `BLOCKS_CURRENT_MERGE` **until adjudicated on the actual code**. The adjudication is done on evidence (read the disputed code), not by averaging or trusting the APPROVE. With a human in the loop, Larry adjudicates and may then clear the block; in a fully-autonomous configuration, an unadjudicated HIGH+ split **escalates to Warwick** rather than auto-merging.

Rationale: preserves the existing "a split on a CRIT fails closed" discipline. Reachability is the *hardest* axis to get right and is exactly where the WP-C mis-classification lived (a LATENT path called ACTIVE).

### R2 — Reachability must cite a stated baseline
Reachability is only meaningful against a known deployment.

> Each reviewer must **state the assumed "current authorised deployment" baseline** and **cite why** a path is/isn't reachable against it. A reachability claim with no stated baseline is not decision-grade and defaults to fail-closed under R1.

Rationale: makes reachability **auditable** and a split **adjudicable on evidence**. Synergy with BUILD-014: the control plane (Postgres) is the natural source of truth for what is actually live, what trust boundaries exist, and what the next WP will wire — so the baseline can eventually be *supplied* to reviewers as ground truth rather than guessed.

---

## Review discipline (round economy)

- **One initial full review** per WP.
- **Delta reviews thereafter** — re-review only what changed.
- **One bounded post-core hardening pass** for cheap, contained fixes.
- **Do not reopen approved substance** for LOW / NOTE or future-only findings.
- **Further rounds require genuinely new *current material* evidence** — a new correctness, privacy, security, authority, audit-integrity, or availability defect that is ACTIVE or breaches acceptance. Not new polish.

---

## Scope of application

Applies consistently to the **direct Codex**, **Tower-Codex**, and **Fable** review packets. Each packet's preamble carries the three-judgement requirement, the merge rule, R1, R2, and the round-economy discipline.

---

## Relationship to the hobby-brain bar (supersession note)

This **replaces the merge-decision half** of `hobby-brain-threat-model-bar`. The "first-party / non-adversarial" fact is **no longer a reason to downgrade technical impact**. Instead it becomes an **input to the reachability axis**: a finding that only bites under a deliberately-malicious in-process handler classifies as **HYPOTHETICAL** under the current authorised deployment, and therefore does not block the current merge — while its technical impact is recorded honestly. Same merge outcomes as before on the cases we've seen, but the impact numbers stay truthful and the reasoning is auditable.

The parts of the hobby-brain bar that still bind unchanged: genuine **accidental** leakage of real private data, and anything touching the personal-data-never-public-repo doctrine, remain real bars regardless of reachability framing.

---

## Worked example — WP-C `policyGate` head-staleness (validates the amendment)

| Judgement | Value |
|---|---|
| Technical impact | **HIGH** (real correctness issue when reached) |
| Current reachability | **LATENT** (needs the WP-D gate-consumer / live-apply wiring, which does not exist; `evaluatePolicyGate` is test-only today) |
| Required disposition | **REQUIRED_BEFORE_LIVE** (the authoritative current-head hardening, coupled to WP-D) |

→ No `BLOCKS_CURRENT_MERGE` finding → **APPROVE**. Codex and Fable would have recorded the *same* three values and agreed, instead of landing CRIT-vs-LOW. This is the outcome Larry reached by hand-adjudicating the code.

---

## Approval

- [x] **Warwick approved** — 2026-07-19 (given repeatedly; Larry over-gated it as "draft" and has corrected that). LIVE from WP-D onward.
