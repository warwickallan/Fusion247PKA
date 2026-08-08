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

**Every claim in a receipt is bound to the logical work boundary and the outcome it promised.** A verdict not
bound to a promised outcome is not a verdict. **The SHAs in the frontmatter are PROVENANCE — they record
which bytes were examined. They are not the identity of the gate, and neither one moving is a reason to
review anything again** (canonical: [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] §"The
job — five human questions").

## Frontmatter

```yaml
---
build: BUILD-nnn                  # or `standalone`
scope: WP-n                       # or `phase-<name>` / `<slice>`
                                  # The scope VERITAS DETERMINED — not merely the scope it was handed.
gate: 1                           # 1 = integrated WP · 2 = phase/vertical slice · 3 = documentation and Git truth

boundary: <the Build/phase/WP under review AND the outcome it promised>
                                  # THE IDENTITY OF THE GATE. The SHAs below are provenance, not identity.

# --- the two heads. PROVENANCE: which bytes were examined. ---
reviewed_sha: <full 40-char SHA>  # the product head actually inspected
governance_sha: <full 40-char SHA> # where identity, contract, template and governing rules were LOADED FROM
                                  # Usually identical to reviewed_sha; on early reviews it cannot be.
                                  # Both resolved by Veritas, never copied from the dispatch unverified.
branch: <branch the head sits on>

# --- provenance of the evidence. Prove what you did; never assert it. ---
evidence_method: <export | target checkout | live runtime | mixed — say which, per row if mixed>
evidence_workspace: <absolute path, where an export or separate workspace was used>
worktree_head_at_start: <git rev-parse HEAD in the repository>
worktree_head_at_end: <must equal worktree_head_at_start>
worktree_status_clean: true       # `git status --porcelain` unchanged start to end
                                  # Evidence gathered against an UNRECORDED or silently different state
                                  # is a HOLD — because it cannot be checked, not because a SHA moved.
                                  # Inspecting the live runtime or target checkout is PERMITTED and is
                                  # sometimes the only honest evidence for question 1.

verdict: PASS                     # PASS | HOLD | FAIL
receipt_sha256: <sha256 of this receipt's BODY, everything below the closing --- >
                                  # Veritas computes it and states it in its return. Makes the receipt
                                  # TAMPER-EVIDENT, not tamper-proof. Recompute to check.
reviewed_by: veritas
reviewed_date: YYYY-MM-DD
next_review_trigger: <the exact MATERIAL CHANGE to the promised outcome that would bring this back.
                      NEVER "the head moved" — a receipt, documentation or clerical commit is not a trigger.>
---
```

**On the two heads.** Veritas's own contract and this template first exist at a commit; a product head reviewed before it does not contain them. An instruction to load governance from the reviewed checkout is unsatisfiable in that case, and any design assuming a single SHA breaks silently whenever governance and product advance at different rates. **Where the two differ, that is a fact to record, not a defect to hide. Both are provenance; neither is the gate's identity.**

**On isolation.** Where repeatable byte-exact evidence is needed, take a clean `git archive` export in an ephemeral workspace outside the repository — never a `git worktree`, which mutates `.git` state Larry owns. Mutation testing happens only inside the export. **The reviewer works from its own stable home and goes and looks at the work where it lives; it does not move into the reviewed checkout.** Inspecting the live runtime or the target checkout is permitted and is often the only honest evidence that the promised thing works in its intended real context. **State exactly what was inspected, and never present evidence gathered against one state as evidence about another.** The repository working tree is never modified, and the receipt shows that rather than claiming it.

## Body

```markdown
## Scope reviewed
<exactly what was in scope, and what was deliberately not>
<One receipt = one gate = one overall verdict. Gate 1 WP and Gate 2 phase are SEPARATE receipts.>

## Accepted requirements
| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | <verbatim from ACTIVE SESSION WORK PACKAGE / accepted outcome> | PASS/HOLD/FAIL | <executed> | <or none> |
<MANDATORY when the accepted scope lists numbered functional requirements (ACTIVE SESSION WORK PACKAGE rows 1–N, or equivalent).>
<Every numbered functional requirement appears exactly once. Omission of a required row → overall HOLD.>
<An overall PASS cannot conceal a held mandatory requirement.>
<Assurance/release sequence steps (Codex withholding, “Veritas is reviewing”) are NOT graded here as product requirements — report them under Scope or a separate note if needed.>

## Evidence provenance
- What was inspected, and how — export at <path> / target checkout at <path> / live runtime at <where>.
- Repository `git rev-parse HEAD` at start / end — <sha> / <sha>, identical.
- Repository `git status --porcelain` — unchanged start to end.
- Mutations applied only inside an export; reverted with a digest match where mutation testing was used.
<PROVE what you did here; do not assert it. Evidence gathered against an unrecorded or silently different
state is a HOLD. A recorded live-runtime inspection is not a defect — it is often the honest answer to
question 1.>

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
| Completed automation | | <mandatory when scope claims automatic outcomes> |
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
| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
<Severity and owner on every row. A finding is an observation, not an instruction — Veritas never
issues the Work Order and never creates one from its own finding.>

## Verdict
**PASS | HOLD | FAIL** — <one sentence>
<If Accepted requirements contains any mandatory HOLD/FAIL, overall cannot be PASS.>

## Next review trigger
<the exact event>
```

## The three verdicts, as they are recorded here

- **PASS** — every mandatory property for the reviewed scope is evidenced. Minor optional improvements may
  be listed under Defects at low severity; they do not block. **Only after a PASS may Larry mark the Work
  Package or phase complete.**
- **HOLD** — required evidence, integration, durability or documentation truth is missing. Larry issues
  corrective work for the blocking findings, then ONE focused confirmation of **those findings**; a receipt
  is never amended to upgrade a verdict. **Writing or repairing this receipt does not reopen the gate.** A
  later review is justified only where the promised outcome materially changed — canonical: root
  `CLAUDE.md` §"Veritas dispatch" and the contract's §"No reviewer stands on its own receipt".
- **FAIL** — materially misses the goal, violates accepted design, creates unsafe behaviour, or contains a
  false completion claim. The scope stays open and Larry re-plans.

**There is no "PASS WITH UNKNOWN CRITICAL ITEMS."** An unknown on a mandatory acceptance property is a
`HOLD`.

## References

- [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] — the role, gates and dimensions. Canonical there.
- [[Templates/work-order]] — the `document_impact`, `acceptance_property`, `integration_owner` and
  `veritas_gate` fields this receipt verifies, and the `VERITAS_*` lifecycle states it drives.
- [[GL-001-file-naming-conventions]] — the receipt filename.
