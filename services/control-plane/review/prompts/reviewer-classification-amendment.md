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

### Merge-class round discipline

> **✅ RATIFIED BY WARWICK, 2026-08-08, AT COMMITTED HEAD `ef4883d529ea3145214339186cae0ddc48d2a256`**
> — for **standing live use** and for the **BUILD-020 4C merge-class review**, alongside
> `tower-qa-skill.md`, which this file is loaded and delivered with. This supersedes the earlier
> "ratification owed" note. **The commit carrying this note changes ONLY this provenance block; the
> governing text is byte-identical to `ef4883d`.**
>
> **His hash ruling applies here too:** the ratification is of the **committed wording and Git head**,
> not of one platform-specific raw-text SHA-256 — LF and CRLF checkouts yield different raw hashes for
> the same committed text. The runtime fingerprint is **delivery-integrity evidence** (loaded and
> validated bytes == bytes delivered to Codex), **not** the cross-platform identity of the
> ratification. Canonical statement in `tower-qa-skill.md`'s provenance note; not restated further.
>
> **How this subsection reached `ef4883d`**, retained because ratification does not erase authorship:
>
> 1. Added under BUILD-020 Sub-phase 4C (`WO-2026-08-07-4C-01`, Amendment 2).
> 2. **Rebased off the exact-head model** (`WO-2026-08-07-4C-03`, Amendment 1) after Warwick
>    rejected it: *"The exact-head model itself is part of the design mistake."* The gate binds to the
>    **logical product boundary** and carries his commissioning question verbatim.
> 3. The **four terms** were separated (`WO-2026-08-08-4C-09`), and the merge-class question restated
>    in the **present tense** (`WO-2026-08-08-4C-11`).
>
> **It remains NOT part of the 2026-07-19 approved text recorded in `source_of_truth` above** — that
> field records the original classification amendment's provenance and is unchanged.

**THE BOUNDARY IS LOGICAL, NEVER A SHA** (Warwick, 2026-08-07 — binding). The merge-class gate is the
**merge candidate and the outcome it promises**, not an exact head. A SHA is a **receipt recording
which bytes were examined**; it is not the identity of the gate, not the definition of its scope, and
**not a trigger for another review merely because it changed.** Binding the gate to a head made
receipts — which are themselves commits — appear to demand review of the ground they were just written
on.

**TERMS** (Warwick, 2026-08-08 — a naming correction that withdraws no obligation). **MERGE** is the
Git event: integrating the change into `main`. **RECONCILE** is the process of deciding what belongs
in the current canonical system — integrate in current-compatible form, preserve but explicitly
decommission / reference-only, already satisfied differently, or discard as superseded.
**CONVERGENCE** is the estate-wide end state. **CLOSE** requires the promised human outcome plus the
reconciliation and convergence that boundary needs.

**The merge-class question is asked in the PRESENT TENSE** (Warwick, 2026-08-08): **"is the estate, as
it exists at this merge boundary, sufficiently reconciled and free of unresolved convergence debt from
previous completed work for this merge to proceed?"** A reviewer examines the estate that **exists
now**; it never certifies a future post-merge estate, because that cannot be observed. Canonical in
`tower-qa-skill.md` §3b and not restated here.

**ONE full merge-class review of the final stable candidate.** If it finds a genuine merge blocker,
that blocker is corrected and **ONE focused delta confirmation** of that blocker follows. Then stop.

- **The delta is bounded to the named blocker.** A defect noticed just outside it is reported once, not
  converted into another round.
- **A receipt, assurance record, wording correction, historical note, formatting repair or
  non-load-bearing documentation movement does NOT reopen the gate** and does not justify another
  full pass. **A moved HEAD is not, by itself, new material evidence** — and the volume of commits
  since the last review is not evidence of anything at all.
- **A later review is justified only where the LOGICAL PRODUCT BOUNDARY materially changed** in a way
  that could change the verdict: **executable behaviour · accepted functional scope · a load-bearing
  interface or dependency · runtime wiring · an active instruction that materially alters the
  executable journey.** Nothing else qualifies.
- **A RECONCILIATION ACTION landing is not automatically a new round.** Integrating a stranded piece,
  decommissioning a superseded copy or discarding dead state changes the estate, and the commits that
  carry it move HEAD — but it reopens the gate **only if it changes the answer to the merge-class
  question.** Apply the commissioning question below to it like anything else. Where the previous
  review's blocker WAS the stranded state, the evidence that it has been reconciled is exactly the
  **one focused delta confirmation** already allowed above — not a fresh full pass.
- **Post-merge convergence work is NOT a review round, and there is NO post-merge gate.** After the
  merge, completing convergence and closing the boundary is the owner's standing lifecycle
  responsibility. **The external backstop is the NEXT merge-class review**, which sees any
  outstanding debt sitting in the then-current estate and blocks on it there. Do not add a stage.
- **No cycles for cosmetic documentation**, and no review of every implementation checkpoint.
- **You are not an iterative development partner.** Reviewing is not how the work gets built.

**THE COMMISSIONING QUESTION, applied BEFORE a review is commissioned** (Warwick's exact framing):

> **«What changed that could plausibly change the reviewer's answer to the human outcome question?»**

**If the truthful answer is "nothing", no review opens.** This is the operative test, and it replaces
any head-comparison. The older formulation still holds beneath it: *every review must have a plausible
path to changing a product or merge decision; once it does not, stop reviewing and continue delivery.*
A pass with no such path should not be commissioned, and declining one on that ground is a correct
outcome, not obstruction.

**The objective is not "fewer reviews at any cost."** It is that review effort stays proportional to a
first-party personal system and keeps a real path to changing an outcome. Measured failure this exists
to prevent (BUILD-020 Sub-phase 4B): **5h27m — 57.7% of a working phase — in assurance activity; eleven
verdicts; the first produced two Work Orders against real product defects, and verdicts #2–#11 produced
zero Work Orders and zero product change.**

## Scope

Applies consistently to the **direct Codex**, **Tower-Codex**, and **Fable** review packets (and any
future reviewer). Each packet's preamble carries the three-judgement requirement, the merge rule, R1,
R2, and the round-economy discipline.
