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
                                  # The scope VERITAS DETERMINED — not merely the scope it was handed.
gate: 1                           # 1 = integrated WP · 2 = phase/vertical slice · 3 = documentation and Git truth

# --- the two heads. Every review stands on both. ---
reviewed_sha: <full 40-char SHA>  # the integrated PRODUCT head under review
governance_sha: <full 40-char SHA> # where identity, contract, template and governing rules were LOADED FROM
                                  # Usually identical to reviewed_sha; on early reviews it cannot be.
                                  # Both resolved by Veritas, never copied from the dispatch unverified.
branch: <branch the head sits on>

# --- provenance of the evidence. Prove isolation; never assert it. ---
evidence_workspace: <absolute path of the isolated export, outside the repository>
worktree_head_at_start: <git rev-parse HEAD in the repository>
worktree_head_at_end: <must equal worktree_head_at_start>
worktree_status_clean: true       # `git status --porcelain` unchanged start to end
                                  # A dirty checkout, a checkout at another head, or evidence gathered
                                  # against later uncommitted files is a HOLD — not a caveat.

verdict: PASS                     # PASS | HOLD | FAIL
receipt_sha256: <sha256 of this receipt's BODY, everything below the closing --- >
                                  # Veritas computes it and states it in its return. Makes the receipt
                                  # TAMPER-EVIDENT, not tamper-proof. Recompute to check.
reviewed_by: veritas
reviewed_date: YYYY-MM-DD
next_review_trigger: <the exact event that brings this back>
---
```

**On the two heads.** Veritas's own contract and this template first exist at a commit; a product head reviewed before it does not contain them. An instruction to load governance from the reviewed checkout is unsatisfiable in that case, and any design assuming a single SHA breaks silently whenever governance and product advance at different rates. **Where the two differ, that is a fact to record, not a defect to hide.**

**On isolation.** Evidence executes against a clean `git archive` export of `reviewed_sha` in an ephemeral workspace outside the repository — never a `git worktree`, which mutates `.git` state Larry owns. Mutation testing happens only inside the export. The repository working tree is never modified, and the receipt shows that rather than claiming it.

## Body

```markdown
## Scope reviewed
<exactly what was in scope, and what was deliberately not>

## Evidence provenance
- Isolated export of `reviewed_sha` at <path>, created with `git archive`.
- Repository `git rev-parse HEAD` at start / end — <sha> / <sha>, identical.
- Repository `git status --porcelain` — unchanged start to end.
- Mutations applied only inside the export; reverted with a digest match where mutation testing was used.
<PROVE isolation here; do not assert it. If any line above cannot be shown, the verdict is HOLD.>

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
- Verified against the repository, independently of his list: <what held>
- **What his list missed:** <the point of the control>
- Active documents that would misdirect a fresh instance: <path — the exact wording — or "none found">
- **Closure claims since the last receipt, and the receipt behind each:** <claim → receipt path, or
  "claimed closed with NO receipt" — which is a FAIL, being a false completion claim>

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
