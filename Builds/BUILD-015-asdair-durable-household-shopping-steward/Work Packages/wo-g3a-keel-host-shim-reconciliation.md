---
name: Reconcile the Keel host shim with the reconciled Keel contract (Veritas D-G3-03)
work_order_id: WO-2026-08-04-01
build: BUILD-015
wp_number: n/a
status: draft
authorised_by: Warwick
authorised_date: 2026-08-04
owner: nolan
return_to: larry
blocking_dependencies: []
tags: [build-015, veritas-gate3, governance]

outcome: `.claude/agents/keel.md` — the artefact the host actually loads when dispatching Keel — states the same git-execution boundary as `Team/Keel - Implementation Engineer/AGENTS.md` and `Team/agent-index.md`, with every unrelated boundary preserved exactly.
acceptance_property: No statement anywhere in `.claude/agents/keel.md` prohibits a git operation that the Keel contract at `7f83d4c2657b757b4aa8cbceb3274f15e0158fff` authorises, and no statement in it grants one the contract withholds. Checkable by reading the two files side by side without being told the answer.
integration_owner: larry
veritas_gate: 3
document_impact:
  - path: .claude/agents/keel.md
    owner: nolan
  - path: Team/Keel - Implementation Engineer/AGENTS.md
    owner: larry
  - path: Team/agent-index.md
    owner: larry

file_surface:
  - .claude/agents/keel.md
  - .claude/agents/thin-larry.md
out_of_scope_policy: report-only

worker_contract:
  path: Team/Nolan - HR/AGENTS.md
  governance_sha: 2eb94611f469994ede9fdd25cd600f6555b033a2

contract_basis:
  - surface: .claude/agents/keel.md
    permitted_by: "Nolan contract §6 'Draft the host subagent shim for every host the team operates in' and the never-list entry 'Ship a hire without the matching host subagent shim(s)' — the Claude Code shim path `.claude/agents/<slug>.md` is named explicitly in both."
  - surface: .claude/agents/thin-larry.md
    permitted_by: "Nolan contract §6, as for `keel.md` above — the shim path class is the same. The SPECIFIC opening of this file is Warwick's standing instruction of 2026-08-04 to resolve findings D-G3-01 through D-G3-07 rather than only the files Larry originally listed. ADDED 2026-08-04 by WO-2026-08-04-05: the read-back amendment below put this path into `file_surface` and never added the matching `contract_basis` entry the template mandates (one per surface entry) — pattern 7, 'envelope fields populated but not earned'. PROVENANCE CORRECTION, same date: Warwick's explicit written authorisation named TWO previously barred surfaces, `.claude/agents/keel.md` and root `CLAUDE.md`. `thin-larry.md` was NOT among them. The authority above is genuine but is his separate, weaker standing instruction; earlier wording in WO-2026-08-04-05 attributed it to the stronger one. The grant holds; the attribution did not."

contract_conflicts: none

capability_evidence:
  source: host agent roster listing delivered to Larry at session start, 2026-08-04
  result: "nolan advertised as Read, Write, Edit, MultiEdit, Bash, Glob, Grep. Recorded caveat carried in `.claude/agents/keel.md:4-9`: MultiEdit is NOT actually delivered to a dispatched subagent on this host, proven by Nolan's own instantiation. The capabilities this order requires are Read, Edit and Grep, all of which are both advertised and observed to be delivered."

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
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-02
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-03
    disposition: assigned-here
  - id: D-G3-04
    disposition: assigned-to
    work_order: WO-2026-08-04-02
  - id: D-G3-05
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-06
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-07
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-08
    disposition: returned-for-Warwick-decision
    reason: "Correcting the three-versus-four condition count requires editing `Team/Keel - Implementation Engineer/AGENTS.md`. The root CLAUDE.md hard rule reserves every `AGENTS.md` edit to Warwick's explicit approval, and tonight's authorisation covers only `.claude/agents/keel.md` and root `CLAUDE.md`. The other half of the discrepancy is `7f83d4c`'s commit message, which is immutable history and not an active document. Larry's recommendation is recorded in WO-2026-08-04-03."
  - id: D-G3-09
    disposition: already-resolved
    evidence: "A malformed 32-character `governance_sha` in a dispatch envelope, not a repository artefact. The true tip Veritas resolved independently is `565351d5abad48d8cfd969e1616e0b81a827d8d1`. Every SHA in this Gate 3 package was resolved through `git rev-parse` / `git log` before being written; none was recalled or reconstructed."
  - id: D-G3-10
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-11
    disposition: assigned-to
    work_order: WO-2026-08-04-03
---

## AMENDMENTS

**Amended 2026-08-04 by Larry at read-back acceptance. Recorded here because they were originally
issued verbally in the dispatch message and not written into this artefact — which is the exact
defect `contract_basis` and `file_surface` exist to prevent, and it was caught by the
WO-2026-08-04-03 worker noticing a modified file with no authorising surface. Logged in
`Builds/BUILD-015-.../SHIT-TO-DO.md` §2.**

- **`file_surface` gained `.claude/agents/thin-larry.md`.** Two items only: the stale claim at `:35`
  that no specialist contract covers repository git on Larry's behalf, now false against Keel's
  reconciled contract; and the present-tense clause at `:3` asserting the grant currently makes
  Rule 4 a capability boundary, when the grant is UNBOUND. Same withdrawn-premise defect class as
  D-G3-04, found by the WO-2026-08-04-02 worker's out-of-surface sweep. Warwick's standing
  instruction for this package is to resolve the findings, not merely the files Larry first listed.
- **`contract_basis` gains the non-file actions the template requires and this order omitted:**
  read-only `grep`; read-only `git` (`diff`, `log`, `show`, `rev-parse`);
  `bash scripts/secret-scan.sh --surface …`; and a YAML frontmatter parse. The read-only inspection
  actions are permitted by **`Team Knowledge/SOPs/SOP-022-work-order-preflight.md` §"Phase 2 — the
  preflight"** (line 121): *"Verify the order against observable reality. Read-only; nothing here
  writes."* The secret scan is required evidence per **`Team Knowledge/Templates/work-order.md`
  §"Body sections"** (line 294). **No mutating git command is permitted.**

  > **CORRECTED 2026-08-04 by `WO-2026-08-04-05` (Veritas `D-G3-14`).** This bullet previously read
  > *"All permitted by root `AGENTS.md` under unrestricted read-only reconnaissance."* **No such
  > clause exists in root `AGENTS.md`** — verified absent by grep for `reconnaissance`, `read-only`
  > and `unrestricted`, each returning **no match** across its 336 lines. The permission was never in
  > doubt; the attribution was invented. **The grant is unchanged and the citation is now to the
  > documents that actually carry it.**
- **AC2 amended.** The routing tail *"Not for … integration/merge (Larry)"* is preserved but
  sharpened to name the **decision** rather than the act, resolving the head-on collision with AC1.
- **AC3 amended.** The AC6 provenance note goes in the body, beneath the git bullet it explains, not
  in the frozen frontmatter block.
- **AC1 extended.** The shim must state the execution grant **and its matching refusals** —
  `merge-decision` precondition, expected reviewed head, force-push, branch deletion, `main` outside
  an authorised merge, explicit pathspec never `git add -A`. Authority stated without its refusals
  over-grants by omission.
- **AC5 amended to the achievable claim:** *"frontmatter parses; host load unproven from inside a
  subagent."* A dispatched subagent cannot enumerate the host's live agent roster.
- **Read-only sweep of all sibling shims under `.claude/agents/` added as report-only.**

**Verdict at read-back: CLARIFY.** Reasons logged in `SHIT-TO-DO.md` §2.

## What this order is, in one paragraph

`7f83d4c` reconciled Keel's git-execution authority in the canonical contract (`Team/Keel - Implementation Engineer/AGENTS.md`) and in `Team/agent-index.md`. It did not carry the change into `.claude/agents/keel.md`. Per root `CLAUDE.md` §"Two layers max", the shim is one of the two canonical layers — and it is the layer the host actually loads when Larry dispatches Keel. Veritas Gate 3 held `Integration` at HOLD for exactly this (`D-G3-03`, HIGH). Warwick authorised this correction explicitly on 2026-08-04.

## What the reconciled contract actually says — read it yourself, do not take this summary as authority

The receipt is authority; this order is context only. Read the contract at
`Team/Keel - Implementation Engineer/AGENTS.md`, in particular §"The integration role — durable and bounded", lines ~103-106, ~207-250, ~373-375 and ~572-575, and read the Keel row in `Team/agent-index.md`. The reconciled position, in Larry's words and to be verified against those files:

- The split is **decision versus execution**. Larry owns architecture, integration decisions, PR strategy and sequencing. Warwick alone authorises merge.
- Within the branch and worktree Larry assigns, Keel may **execute**: branch and worktree operations, commits, ordinary pushes, PR creation and maintenance, test and script execution, and an explicitly authorised merge **against the expected reviewed head**.
- Keel may **never infer** a merge decision from a green suite, a Veritas PASS, a Codex approval, Larry's enthusiasm, or the existence of an open PR.
- Force-push, branch deletion, touching `main` outside an authorised merge, and any git operation outside the assignment remain **refused**.
- The delegation exists to preserve bounded ownership, worktree isolation, orchestration capacity and accountability — **not because Larry lacks `Bash`.** Capability state is dynamic and is never inferred from a contract.

## The two known instances — and why enumeration, not inspection, is the deliverable

Larry's read-only sweep found two surviving instances in the shim:

- `.claude/agents/keel.md:3` — inside `description:` — *"Never merges, pushes, opens PRs, touches live services or credentials, expands scope, performs a first live start, or declares its own work merge-ready or operationally accepted."*
- `.claude/agents/keel.md:77` — *"**Commit inside your assigned worktree/branch only.** Never push, never open a PR, never merge, never touch git state outside your worktree. You are the only writer there."*

**Do not treat that list as complete.** `7f83d4c`'s own commit message claimed "the one surviving quotation" of a withdrawn premise remained, and Veritas found three more. **Close this defect class by enumeration:** read the whole shim, and independently derive the complete set of statements in it that bear on Keel's git, push, PR, merge or execution authority. Report the set you found, including any instance not listed above, and including any you found and judged already correct.

## Acceptance criteria

AC1 — Every statement in `.claude/agents/keel.md` bearing on git, push, PR, merge or execution authority agrees with `Team/Keel - Implementation Engineer/AGENTS.md` at `7f83d4c2657b757b4aa8cbceb3274f15e0158fff` and with the Keel row of `Team/agent-index.md`. The shim states the boundary; it does not restate the contract at length. Two layers max — the shim points, it never duplicates.

AC2 — The shim's `description:` field still routes correctly for Larry ("Use proactively when…"), still names the mandatory read-back gate, still names `credential_scope: none` / `live_authority: none` / the bounded `file_surface`, still names the `runbook_path` refusal, and still names every non-git boundary it carried before: no touching live services or credentials, no scope expansion, no first live start, no self-certification of merge-readiness or operational acceptance, and the "Not for …" routing list.

AC3 — **Every unrelated boundary in the body is preserved byte-for-byte.** Specifically unchanged: the read-back gate section, the cold-start briefing rule, `file_surface` absoluteness, "Proven means EXECUTED", the whole secret-scan bullet including the three exit codes, the GL-012 / `C:\.fusion247\**` bullet, the scanner-asymmetry bullet, "Never weaken a proof or fabricate a pass", "Never edit AGENTS.md, CLAUDE.md, …", "Never expand scope, never spawn a subagent…", "Never declare acceptance, merge-readiness, or independent verification", the return format, and the YAML `tools:` line and the tool-grant comment above it.

AC4 — The shim does **not** claim Keel's authority derives from Larry lacking `Bash`, and does **not** assert any current capability state for Larry in either direction.

AC5 — The frontmatter remains valid YAML and the shim still loads as an agent definition. A malformed shim drops the specialist from the roster with no error, so this is checked, not assumed.

AC6 — A one-line dated provenance note records why the shim changed and cites `7f83d4c` and the Gate 3 receipt path, so a later well-meaning edit cannot silently restore the withdrawn wording.

## Required evidence

- `grep -n -i "push\|open a PR\|opens PR\|merge\|git " .claude/agents/keel.md` — full output pasted, with your reading of each hit.
- The complete enumerated set of authority-bearing statements you derived, and the disposition of each (changed / unchanged-and-correct).
- A diff of your change (`git diff -- .claude/agents/keel.md`) pasted verbatim. **Read-only git only. Do not stage, commit, push, or run any mutating git command.**
- Proof the YAML frontmatter still parses — state the method you used and its output.
- `bash scripts/secret-scan.sh --surface .claude/agents/keel.md` — report the exit code AND what it covered. Exit 2 is NOT SCANNED and is neither a pass nor a finding.

## Explicitly out of scope

- `Team/Keel - Implementation Engineer/AGENTS.md`, `Team/agent-index.md`, and every other `AGENTS.md`. **Do not edit any of them.** They are already reconciled; if you find a defect in one, REPORT it.
- Root `CLAUDE.md` — a separate order (WO-2026-08-04-02).
- Every other shim under `.claude/agents/`. If you notice the same defect class in a sibling shim, **report it, do not fix it.**
- All git operations. Larry serialises the single writer to this branch.
- `.claude/settings.json` — **do not create, restore or reference it as a live control.**

## The one thing that would make this order fail

Rewriting the shim into a second copy of the contract. Two layers max: the wiki contract is canonical, the shim is a thin pointer plus routing. A shim that duplicates the contract creates a third source of drift, which is the defect you were sent to close.
