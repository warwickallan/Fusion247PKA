---
artifact: reviewer-classification-amendment
version: 1
status: approved
governs_live: true
owner: Warwick
approved_by: warwick
approved_at: 2026-07-19
source_of_truth: Deliverables/2026-07-19-reviewer-classification-amendment-v1-DRAFT.md (APPROVED + LIVE)
scope: reviewer governing prompts — direct Codex + Tower-Codex + Fable (and any future reviewer, e.g. Grok)
note: >
  This runtime component carries the GOVERNING TEXT of the Warwick-APPROVED-and-LIVE reviewer
  classification amendment (approved 2026-07-19). It is not new AI-authored governance — it is the
  wiring of already-ratified governance into the Tower review packet so every reviewer receives it
  verbatim on every turn. `governs_live: true` means the three-judgement classifier is approved for
  standing reviewer use; it does NOT flip the BUILD-014 role_based_readiness / auto-merge flag, which
  stays OFF and Warwick-gated. See [[reviewer-classification-amendment]], [[split-verdict-adjudicate-on-code]].
---

# Reviewer classification amendment (APPROVED + LIVE — governs every review packet)

**Every material finding carries THREE independent judgements. The DISPOSITION, not the severity,
decides the merge.** This keeps every reviewer at full defect-hunting strength: technical impact is
never softened because Fusion247 is first-party or "only a hobby" — impact stays honest; reachability
and disposition carry the merge decision.

## The three judgements — record all three, separately, for every material finding

### 1. Technical impact  — `BLOCKER | HIGH | MEDIUM | LOW | NOTE`
The engineering severity **if reached** — judged on the code, never downgraded because the system is
first-party / non-adversarial / a hobby.

### 2. Current reachability  — `ACTIVE | LATENT | HYPOTHETICAL`
- **ACTIVE** — reachable in the *current authorised deployment*.
- **LATENT** — requires a *planned future capability or trust-boundary change* (a WP not yet built, a
  live-apply path still deferred).
- **HYPOTHETICAL** — requires an actor or path *not currently planned or authorised* (e.g. a
  deliberately-malicious in-process handler in a first-party, non-adversarial runtime).

### 3. Required disposition
`BLOCKS_CURRENT_MERGE | REQUIRED_BEFORE_LIVE | REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS |
TRACKED_FOLLOWUP | NOTE_ONLY`

## The merge verdict — disposition governs, severity does not

**Severity alone must NOT determine the merge verdict.** APPROVE is permitted when **no
`BLOCKS_CURRENT_MERGE` finding remains** — even when technically HIGH (or BLOCKER-if-reached) *latent*
findings are recorded against an explicit future gate.

A finding is `BLOCKS_CURRENT_MERGE` when **any** of these holds:
- it is **currently reachable (ACTIVE)** *and* materially harmful; or
- it **breaches the WP's acceptance criteria**; or
- it risks **current** data / privacy / authority / integrity; or
- it **prevents the next authorised WP from operating safely**.

Everything else routes to `REQUIRED_BEFORE_LIVE`, `REQUIRED_BEFORE_EXTERNAL_OR_UNTRUSTED_ACCESS`,
`TRACKED_FOLLOWUP`, or `NOTE_ONLY` — recorded, tracked, and **not** a merge blocker. An
improvement/observation (NOTE_ONLY / TRACKED_FOLLOWUP) can **never** block a merge on its own.

## R1 — Split resolution fails closed

A **reachability or disposition split on any HIGH-or-above finding** is treated as
`BLOCKS_CURRENT_MERGE` **until adjudicated on the actual code** (read the disputed code — never
average, never trust the APPROVE). With a human in the loop, Larry adjudicates and may then clear the
block; in a fully-autonomous configuration an unadjudicated HIGH+ split **escalates to Warwick**
rather than auto-merging. (Preserves the standing "a split on a CRIT fails closed" discipline;
reachability is the hardest axis and exactly where mis-classification lives.)

## R2 — Reachability must cite a stated baseline

Each reviewer must **state the assumed "current authorised deployment" baseline** and **cite why** a
path is / isn't reachable against it. A reachability claim with **no stated baseline** is not
decision-grade and defaults to fail-closed under R1. (Every finding therefore carries an
`assumed_deployment_baseline`; a finding without one is malformed and fails closed.)

## Review discipline (round economy)

- One initial full review per WP; **delta reviews** thereafter (re-review only what changed).
- One bounded post-core hardening pass for cheap, contained fixes.
- Do **not** reopen approved substance for LOW / NOTE or future-only findings.
- Further rounds require genuinely new **current material** evidence — a new correctness, privacy,
  security, authority, audit-integrity, or availability defect that is ACTIVE or breaches acceptance.
  Not new polish.

## Scope

Applies consistently to the **direct Codex**, **Tower-Codex**, and **Fable** review packets (and any
future reviewer). Each packet's preamble carries the three-judgement requirement, the merge rule, R1,
R2, and the round-economy discipline.
