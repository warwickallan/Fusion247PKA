---
name: BUILD-015 Wayfinder map, and one precedence chain across every resumption-shaped document
work_order_id: WO-2026-08-04-04
build: BUILD-015
wp_number: n/a
status: draft
authorised_by: Warwick
authorised_date: 2026-08-04
owner: general-purpose
return_to: larry
blocking_dependencies: [WO-2026-08-04-03]
tags: [build-015, wayfinder, veritas-gate3]

outcome: BUILD-015 has a durable Wayfinder implementation and orientation record in Git, phased against the Veritas gates, and it is the single document that may direct the next session — with every other resumption-shaped document in `Deliverables/` explicitly non-directive and no fact stated in two places.
acceptance_property: A fresh instance, after `/clear`, can open the map alone and state the recovered map path, the goal, the current phase and gate, and one exact next action that is genuinely outstanding — without reading any other document first. Checkable by doing exactly that and confirming the stated action is not already done.
integration_owner: larry
veritas_gate: 3
document_impact:
  - path: Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md
    owner: larry
  - path: Deliverables/NEXT-ASDAIR-SESSION-brief.md
    owner: larry
  - path: Deliverables/2026-08-04-rotation-brief.md
    owner: larry
  - path: Deliverables/BUILD-015-STAGE1-continuation-brief.md
    owner: larry
  - path: Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md
    owner: larry
  - path: Builds/BUILD-015-asdair-durable-household-shopping-steward/SHIT-TO-DO.md
    owner: larry

file_surface:
  - Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md
  - Deliverables/NEXT-ASDAIR-SESSION-brief.md
  - Deliverables/2026-08-04-rotation-brief.md
  - Deliverables/BUILD-015-STAGE1-continuation-brief.md
  - Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md
out_of_scope_policy: report-only

worker_contract:
  path: AGENTS.md
  governance_sha: 66d40d38b867d76aeeb698ec89b13aff800552e5

contract_basis:
  - surface: Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md
    permitted_by: "Root `CLAUDE.md` §Wayfinder — the map is Larry's durable implementation and orientation record; cross-document reconciliation defaults to Larry per `Team Knowledge/Templates/work-order.md` §'On document_impact'. Larry delegates the mutation under Warwick's direct instruction of 2026-08-04 authorising a BUILD-015 Wayfinder map."
  - surface: Deliverables/NEXT-ASDAIR-SESSION-brief.md
    permitted_by: "As above — Larry's own resumption document."
  - surface: Deliverables/2026-08-04-rotation-brief.md
    permitted_by: "As above."
  - surface: Deliverables/BUILD-015-STAGE1-continuation-brief.md
    permitted_by: "As above."
  - surface: Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md
    permitted_by: "As above."
  - action: "read-only git and filesystem inspection across the primary checkout"
    permitted_by: "Root `AGENTS.md` — read-only reconnaissance is unrestricted."
  - action: "read-only `gh pr list`"
    permitted_by: "As above. `network: none` documents intent and is not an enforced control."
  - action: "bash scripts/secret-scan.sh --surface <declared paths>"
    permitted_by: "Root `AGENTS.md`; required evidence on every order."

contract_conflicts: none

capability_evidence:
  source: host agent roster listing delivered to Larry at session start, 2026-08-04
  result: "general-purpose advertised with the full tool set (`*`). This order requires Read, Write, Edit, Grep, Glob and read-only Bash — all advertised. No live probe available; if a required tool proves absent at read-back, REFUSE and name it."

credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none

worktree: C:/Fusion247PKA
branch: build-015/live-acceptance-recovery-2026-08-03

schema_decision: n/a
security_inputs: n/a
operational_handoff: none

veritas_source:
  receipt: Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-gate3-governance-ecfb04b.md
  reviewed_sha: ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040

veritas_findings:
  - id: D-G3-01
    disposition: already-resolved
    evidence: "Discharged by WO-2026-08-04-03 in the same uncommitted package; the directive brief carries no stale next action. This order must not regress it."
  - id: D-G3-02
    disposition: already-resolved
    evidence: "D5 recorded as an eight-row table with per-class verified status by WO-2026-08-04-03."
  - id: D-G3-03
    disposition: already-resolved
    evidence: "WO-2026-08-04-01, `.claude/agents/keel.md` reconciled."
  - id: D-G3-04
    disposition: already-resolved
    evidence: "WO-2026-08-04-02, root `CLAUDE.md` reconciled."
  - id: D-G3-05
    disposition: already-resolved
    evidence: "WO-2026-08-04-03, false completion claim rewritten."
  - id: D-G3-06
    disposition: already-resolved
    evidence: "WO-2026-08-04-03, PR list resolved by execution."
  - id: D-G3-07
    disposition: assigned-here
    reason: "WO-2026-08-04-03 established a four-document precedence chain. This order adds a fifth document and must therefore RE-SEAT the chain rather than leave it stale — otherwise it recreates D-G3-07 one day later."
  - id: D-G3-08
    disposition: returned-for-Warwick-decision
  - id: D-G3-09
    disposition: already-resolved
    evidence: "True tip `565351d5abad48d8cfd969e1616e0b81a827d8d1`. Every SHA in this package resolved through git."
  - id: D-G3-10
    disposition: already-resolved
    evidence: "Recorded as bounded evidence by WO-2026-08-04-03; live-probe criterion remains OPEN."
  - id: D-G3-11
    disposition: already-resolved
    evidence: "Rotation brief pinned to `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`."
---

## What this order is

BUILD-015 has no Wayfinder map. Verified absent 2026-08-04 across `Deliverables/`, the build record, and every branch (`git log --all --diff-filter=A --name-only`). The build predates the 2026-08-02 mandate. **Warwick asked for one and authorised writing it**, for a stated reason: Wayfinder is how rotations and model switches are tracked, and with Veritas gating every integrated head, properly-phased boundaries now carry real assurance weight.

**Acceptance of the route inside the map remains Warwick's (`product-decision`).** Writing it is authorised; the route it proposes is not yet agreed. Say so in the map.

## The two failure modes that would make this order worse than not doing it

**1. A fifth competing resumption document.** Veritas held this build partly because four documents claimed to direct the next session with no recorded precedence (`D-G3-07`). A map dropped in beside them is number five. **Re-seating the precedence chain across all five is not a nicety attached to this order — it is half the order.**

**2. A map that restates the build record.** BUILD-015 already has fifteen documents including a goal contract, a 132KB defect ledger, an acceptance-and-evidence record and three assurance receipts. Root `CLAUDE.md` §Wayfinder: *"Map outcomes, dependencies, interfaces and evidence — not every file… A file-by-file IKEA manual is a different failure from a missing map, and still a failure."* **The map POINTS. It does not copy.**

## Honesty requirement, stated first because it is easy to lose

This map is written at roughly ninety percent of the build. **It is a route record for the remainder, not a plan that governed the work.** Presenting it as though it planned BUILD-015 would be a fiction, and it would be a fiction inside a documentation-truth review. Say plainly, near the top: when it was written, why, that it is retrospective for phases already passed, and that phases 0-5 below are the forward route.

## Required content — root `CLAUDE.md` §Wayfinder

Every one of these, and **the depth of each may reflect actual complexity; the presence of each may not**:

- The **startup/orientation block copied VERBATIM** from `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md` §"START / RESUME HERE — ordered by Warwick" — **all nine bullets, not reworded.** Unlike a resumption brief, every bullet is true of a map. **Bullet 9 requires a SHIT TO DO section below it**; satisfy it with a section that points at `Builds/BUILD-015-.../SHIT-TO-DO.md` as the canonical parked list rather than duplicating its contents.
- The goal contract and North Star · current reality and verified assets · the system map and product boundaries · known decisions · unresolved fog and contradictions · human dependencies and the point each is required · security, permissions, ownership and recovery boundaries · acceptance evidence · the execution route · the current frontier and next useful action · parked and non-goal work · resumable state after `/clear` or a fresh session.
- **Begin with live reconnaissance.** Verify real state before recording it, and **record contradictions rather than silently overwriting one source.**

## The phase table — phased against the Veritas gates, not against narrative progress

Warwick's stated reason for wanting the map is that phases carry assurance weight now. Each phase names its gate and the question that gate must answer. Gate 1 = integrated Work Package · Gate 2 = phase or vertical slice · Gate 3 = documentation and Git truth.

| Phase | Outcome | Gate | The question the gate answers |
|---|---|---|---|
| **0** | Gate 3 documentation and Git truth discharged | Veritas Gate 3 | Does every active document agree with the code and with Git? |
| **1** | Repository and live database reconciled — migrations 013/014 authored as artefacts, the packet table contract settled | Gate 1 per WP | Does a fresh clone reproduce the live state? |
| **2** | Execution packet durable — 015 applied, producer wired to a real production caller, persistence and restart proven | **Gate 2** | **Can Warwick's plan survive a process death?** |
| **3** | Injected end-to-end journey green with duplicate, stale-answer, mutation and restart controls | **Gate 2** | **Photograph → correctly resolved, Brand A-Z, checkout-ready basket, in the real intended context?** |
| **4** | Documentation reconciled against the implemented journey; one clean PR; CI bound to the exact head | Gate 3 | Is what we say we built what we built? |
| **5** | Codex external QA within the three-pass maximum, then Pax's final product acceptance | External, then Pax | Would an independent party accept this? |

**Phase 2's question is the one every green suite in this build has so far failed to answer** — the `RESUMABILITY` tests build a fresh deps container over the same in-memory object graph, which proves no state hides in the container, not that anything survives process death. **No row has ever been written to Postgres by this journey.** Record that in the map as the standing risk it is.

Mark phase 0 as the current phase, **IN PROGRESS**, not PASS. A phase boundary marked PASS additionally requires a Veritas receipt against the exact integrated head, and Larry may not record one from his own assessment. PARTIAL and FAILED are his to record; **PASS is not.**

## The precedence chain — re-seated, byte-identical, in all five documents

Replace the existing four-entry `## RESUMPTION PRECEDENCE` block in the four briefs, and carry the same block in the map. It becomes six entries. **Preserve the existing block's closing paragraphs** — the deliberate-SSOT-exception sentence, the Honcho pointer line and "Verify by execution, not belief" — and preserve its heading and its `D-G3-07` attribution, adding this order's id alongside.

The new order:

1. `Builds/BUILD-015-asdair-durable-household-shopping-steward/` — the build record, authority for every BUILD-015 fact.
2. **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` — THE Wayfinder map. The sole route, and the only document that may state the exact next action.**
3. `Deliverables/NEXT-ASDAIR-SESSION-brief.md` — **NON-DIRECTIVE.** Operational hazards and code-level do-not-rebuild warnings the map points at. It states no next action.
4. `Deliverables/2026-08-04-rotation-brief.md` — **NON-DIRECTIVE.** Dated snapshot of the 2026-08-04 rotation.
5. `Deliverables/BUILD-015-STAGE1-continuation-brief.md` — **NON-DIRECTIVE.** Superseded 2026-07-28 snapshot.
6. `Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md` — **NOT a BUILD-015 resumption document.**

## The split between the map and the brief — no fact in two places

The brief was rewritten clean hours ago; **do not gut it and do not duplicate it.** Move to the map what is **route**: phase, gate, exact next action, frontier, current state, decisions, fog, human dependencies, resumable state. Leave in the brief what is **craft and hazard**: the traps, the hard operating rules, the rejected placements that must never be rebuilt, the "components were never the problem, the joins were" lesson. Remove the brief's exact-next-action section and have it point up. Each document points at the other exactly once.

**Where you judge a thing belongs in both, it belongs in one and is linked from the other.** Say which you chose and why, in your return.

## Acceptance criteria

AC1 — The map exists, carries all twelve required content elements, and each is present rather than gestured at.

AC2 — The nine-bullet startup/orientation block is reproduced **verbatim**, and a SHIT TO DO section exists below it pointing at the canonical build-scoped list.

AC3 — Exactly one document among the six may state an exact next action, and it is the map. Prove it.

AC4 — The precedence block is byte-identical across all five files in `Deliverables/`. Prove it with a hash, one distinct value.

AC5 — The map states plainly that it is retrospective for completed phases, was written 2026-08-04 at roughly ninety percent, and that **Warwick's acceptance of the route is outstanding as a `product-decision`.**

AC6 — Phase 0 is marked IN PROGRESS. **No phase is marked PASS.** Nothing anywhere records any work package, phase, build, service or journey as complete, operational, durable, ready, accepted, production-safe or closed.

AC7 — No fact appears in both the map and a brief. Every SHA written is a full 40 characters and resolved through `git rev-parse --verify` before writing.

AC8 — Every claim unverifiable offline is labelled. `live_authority: none` — the live database, CI results and anything needing credentials are out of reach.

AC9 — **No new mechanism, registry, validator, tracker, service, specialist or governance layer.** A Wayfinder map is a record, not an execution tracker or a ticket system; using it as one is the BUILD-018 error and a mandatory map is not a licence to grow one.

AC10 — `BUILD-015-STAGE1-continuation-brief.md` and `NEXT-SESSION-MISSION-repo-worktree-hygiene.md` are changed **only** by the re-seated precedence block. Prove it with a diff.

## Required evidence

- `git rev-parse HEAD` and `git status --porcelain` at start and end.
- The hash proving AC4, one distinct value across five files.
- The greps proving AC3, scoped and explained.
- `git diff --stat` for all five files; full `git diff` for the two 2026-07-28 files.
- `bash scripts/secret-scan.sh --surface <the five declared paths>` — exit code **and** coverage. Exit 2 is NOT SCANNED and is neither a pass nor a finding.
- Your stated split decisions where content could have gone in either document.

## Explicitly out of scope

- Everything outside `file_surface`. In particular root `CLAUDE.md`, every `AGENTS.md`, `.claude/**`, and everything under `Builds/` — **including `SHIT-TO-DO.md`, which you read and point at but never write.**
- All mutating git operations. Read-only git only; Larry serialises the single writer to this branch. The tree already carries three other uncommitted packages — **touch none of them.**
- Any live database, credential or network mutation.
- Re-opening, re-litigating or "improving" the work WO-2026-08-04-01, -02 and -03 landed. If you find a defect in it, **report it; do not fix it.**
