# Veritas Receipt — canonical template

> **This file is the single source of truth for the shape of a Veritas assurance receipt.** Copy it, fill
> it, write it. The role, the three gates, the nine assurance dimensions and the three verdicts live in
> [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] and are **not** restated here.
>
> **Where a receipt lives:** `Builds/<BUILD-ID>/Assurance/veritas-<wp-or-phase>-<sha7>.md` when it belongs
> to a build; `Deliverables/YYYY-MM-DD-veritas-<scope>-receipt.md` when the review is standalone. These two
> locations are Veritas's complete write surface.
>
> **Veritas writes it. Larry commits it verbatim** — he may not edit, summarise or excerpt it. A receipt the
> gated party is free to paraphrase is a receipt that passes through him, which is the hole this role exists
> to close.

## Discipline

**Short, structured, auditable. No essays unless a failure genuinely requires one.** A receipt is read to
find out whether something is true, not to admire the reviewing. Reuse evidence already bound to this exact
head rather than regenerating it; regeneration is what turns an assurance gate into a bottleneck.

**Every claim in a receipt is bound to the exact SHA in its frontmatter.** A verdict not bound to a head is
not a verdict.

## Frontmatter

```yaml
---
build: BUILD-nnn                  # or `standalone`
scope: WP-n                       # or `phase-<name>` / `<slice>`
gate: 1                           # 1 = integrated WP · 2 = phase/vertical slice · 3 = documentation and Git truth
reviewed_sha: <full 40-char SHA>  # resolved by Veritas, never copied from the dispatch unverified
branch: <branch the head sits on>
verdict: PASS                     # PASS | HOLD | FAIL
reviewed_by: veritas
reviewed_date: YYYY-MM-DD
next_review_trigger: <the exact event that brings this back>
---
```

## Body

```markdown
## Scope reviewed
<exactly what was in scope, and what was deliberately not>

## Evidence executed or inspected
| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| <verbatim command> | 0 | 212 | ... |
<Zero executed subtests is a FAILURE, not a pass. Name any evidence that was unavailable — never treat
an unreachable source as passed.>

## Assurance dimensions
| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS/HOLD/FAIL/n-a | ... |
| Design fidelity | | |
| Functional proof | | |
| Integration | | |
| Durability | | |
| Test quality | | |
| Git truth | | |
| Documentation truth | | |
| Residual risk | | |
<`n-a` carries a reason. A dimension is never silently omitted.>

## Production caller and journey
<The traced path from the real entry point to the effect, hop by hop. A component reached only by a
test calling it directly is NOT on the journey — say so here.>

## Restart and durability
<Required wherever durability is claimed. Kill and revive; state what survived. `n-a` with a reason
where nothing durable was claimed.>

## Documentation contradiction scan
- Larry's declared DOCUMENT IMPACT: <his list>
- Verified independently: <what held>
- **What his list missed:** <the point of the control>
- Active documents that would misdirect a fresh instance: <path — the exact wording — or "none found">

## Defects
| # | Severity | Finding | Owner |
|---|---|---|---|
<Severity and owner on every row. A finding is an observation, not an instruction — Veritas never
issues the Work Order and never creates one from its own finding.>

## Verdict
**PASS | HOLD | FAIL** — <one sentence>

## Next review trigger
<the exact event>
```

## The three verdicts, as they are recorded here

- **PASS** — every mandatory property for the reviewed scope is evidenced. Minor optional improvements may
  be listed under Defects at low severity; they do not block. **Only after a PASS may Larry mark the Work
  Package or phase complete.**
- **HOLD** — required evidence, integration, durability or documentation truth is missing. Larry issues
  corrective work and resubmits **a new exact head**; a receipt is never amended to upgrade a verdict.
- **FAIL** — materially misses the goal, violates accepted design, creates unsafe behaviour, or contains a
  false completion claim. The scope stays open and Larry re-plans.

**There is no "PASS WITH UNKNOWN CRITICAL ITEMS."** An unknown on a mandatory acceptance property is a
`HOLD`.

## References

- [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] — the role, gates and dimensions. Canonical there.
- [[Templates/work-order]] — the `document_impact`, `acceptance_property`, `integration_owner` and
  `veritas_gate` fields this receipt verifies, and the `VERITAS_*` lifecycle states it drives.
- [[GL-001-file-naming-conventions]] — the receipt filename.
