---
# --- identity and authority ---
name: Work Order authoring repair — generate the order, do not type it
work_order_id: WO-2026-08-06-18
build: BUILD-020
wp_number: WP-4A
status: draft
authorised_by: Warwick
authorised_date: 2026-08-06
owner: keel
return_to: larry
blocking_dependencies: []
tags: [build-020, wp-4a, phase-4]

# --- scope ---
outcome: >
  `tools/wo/envelope.mjs` emits a COMPLETE, ready-to-issue Work Order file — not envelope rows to
  stdout — with `contract_basis` extracted from canonical contracts, standing defaults omitted rather
  than retyped, the declared governance head verified to exist, and ceremony fields removed on the
  evidence that they never changed execution.
acceptance_property: >
  A Work Order produced by the tool at a named governance head is issuable with Larry having authored
  ONLY outcome, scope, acceptance, evidence and sequencing — and every other field is traceable to a
  canonical source file the tool read, or is an explicitly-marked authorised deviation.
integration_owner: larry
veritas_gate: 1
document_impact:
  - path: Deliverables/2026-08-04-proofline-wayfinder-plan.md
    owner: larry
  - path: Team Knowledge/Templates/work-order.md
    owner: larry
  - path: Team Knowledge/SOPs/SOP-022-work-order-preflight.md
    owner: larry

file_surface:
  - tools/wo/envelope.mjs
  - tools/wo/envelope.test.mjs
out_of_scope_policy: report-only

# --- contract and capability compatibility ---
worker_contract:
  path: Team/Keel - Implementation Engineer/AGENTS.md
  governance_sha: 9fa3169e3cc59867d3ab617a2d56d07910de65d6

contract_basis:
  - surface: tools/wo/envelope.mjs
    permitted_by: "permitted_file_surface — `tools/**`"
  - surface: tools/wo/envelope.test.mjs
    permitted_by: "permitted_file_surface — `tools/**`; 'a test suite' is named work in scope"
  - action: cut and operate branch `wo/18-envelope-route` in worktree `C:/Fusion247PKA-wo-18`
    permitted_by: "The integration role — branch and worktree operations, commits, pushes"
  - action: run `node --test` and `bash scripts/secret-scan.sh --surface tools/wo`
    permitted_by: "The integration role — test and script execution"

contract_conflicts: none

capability_evidence:
  source: executed probe
  result: >
    Larry executed `node tools/wo/envelope.mjs --owner keel --governance-head <sha>` at
    4eb5368 this session — exit 0, all fields resolved, no UNRESOLVED. Node v22.18.0 verified.

# --- authority: STANDING DEFAULTS APPLY UNCHANGED ---
# Per Templates/work-order.md authority defaults. No deviation is authorised on this order.
# (J1-3 is what removes this block from future orders; it is stated here because the tool that
#  omits it is what this order builds.)
credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none

# --- environment ---
worktree: C:/Fusion247PKA-wo-18
branch: wo/18-envelope-route

# --- inputs and handoffs ---
schema_decision: n/a
security_inputs: n/a
operational_handoff: none
---

# WO-2026-08-06-18 — Work Order authoring repair

> **This order is itself the live acceptance test of the route it repairs (map §17.1, J1-8).**
> Warwick: *"the worker must begin substantive work on first dispatch without a preventable Class-A
> refusal."* **A refusal caused by a genuine defect in this order is a legitimate outcome and must not
> be suppressed** — the measurement is of *preventable* class-A defects, and a real one found is the
> gate working. Say which.

## Why this order exists

Warwick, 2026-08-06, fixed the phase-completion contract. Map **§17.1** is canonical for it. The
established facts you are building against — **do not re-derive them**:

| # | Fact |
|---|---|
| J1-a | The tool already deterministically copies tools, surfaces, standing authority defaults, git authority, worktree state and producible-evidence constraints |
| J1-b | It correctly fails unknown fields as `UNRESOLVED` |
| J1-c | It prevents **11 of 41 scored historical defects — 27% BY DEFECT**, touching **8 of 13 affected orders — 62% BY ORDER**. **Never quote either rate without its unit** |
| J1-d | It does **not** reach acceptance-property or reasoning defects — and this order does **not** ask it to |
| J1-e | It has no automatic production caller and depends on Larry remembering to invoke it |

**The ratification boundary, and it is absolute:** the Nolan-per-order checker proposal is **PARKED and
unratified at `c2ebda4`. Do not merge, recreate, apply or reference it as authority.** No Nolan contract,
SOP-022 actor, agent-index or shim change is authorised by this order or any part of it.

## Scope — five changes, all inside `tools/wo/**`

| # | Change | Maps to |
|---|---|---|
| **S-1** | **Emit a complete order FILE, not stdout rows.** The tool writes a ready-to-issue Work Order at a caller-given path, with the variable sections present as clearly-marked authoring slots. Larry fills only outcome, scope, acceptance, evidence, sequencing | J1-1, J1-5 |
| **S-2** | **Generate `contract_basis` by extraction.** For each declared `file_surface` entry and each declared non-file action, resolve the permitting clause **from the canonical contract file** and cite its exact heading. Where no clause permits it, emit `UNRESOLVED` — the J1-b behaviour, extended to this field | J1-2 |
| **S-3** | **Stop retyping standing defaults.** Emit the standing authority block **only** where the caller passes an explicit deviation; a deviation renders with a required escalation note naming who authorised it. Absent a deviation the order carries a single line stating defaults apply | J1-3 |
| **S-4** | **Verify the declared governance head EXISTS** in the repository before emitting, and fail loudly if it does not | J1-4 |
| **S-5** | **Remove ceremony fields**, on evidence — see below | J1-7 |

### S-5 is evidence-led, not taste-led

**Larry's measurement, this session, and it is the starting evidence:** the current stdout envelope for
`--owner keel` renders **roughly ten thousand tokens**, the bulk of it `prohibited_file_surface` and
`critical_rules` — **entire pages of Keel's own contract, copied into an order the worker reads the
contract for anyway.** Copying a contract into the order that cites the contract does not change
execution; it inflates every order and buries the five fields Larry actually authored.

**Your task is to establish which fields to cut using the existing replay evidence, not to accept
Larry's example.** For each field, the test is: **did its presence or absence ever change what a worker
did, or what a refusal said, across the scored historical orders?** Cut what fails that test; keep what
passes; **report anything you judge borderline rather than deciding it silently.**

**Prefer a citation to an inlined copy** where the worker's contract already carries the text — but that
is a hypothesis for you to test against the replay evidence, not an instruction to apply blind.

## Acceptance criteria

- **AC1** — Given a governance head, an owner slug, a `file_surface` and a declared action list, the tool
  writes a complete Work Order file in which **every non-variable field is traceable to a canonical source
  file the tool read**, or is marked `UNRESOLVED`, or is a marked authorised deviation.
- **AC2** — `contract_basis` is **generated by extraction** and cites exact contract headings. A surface
  with no permitting clause yields `UNRESOLVED` and **never** a plausible-looking guess.
- **AC3** — A non-existent governance head causes a **loud failure**, not a rendered order.
- **AC4** — With no deviation supplied, the emitted order contains **no retyped standing-defaults block**.
- **AC5** — Field removals under S-5 are each justified **against the replay evidence in the return**, with
  the by-defect and by-order units stated wherever a rate is quoted.
- **AC6** — `envelope.test.mjs` covers AC1–AC4 with **executed** assertions, including a negative test for
  AC2's `UNRESOLVED` path and for AC3's failure.

## Required evidence

- `node --test` from the repository root over `tools/wo/` → **report `# tests`, `# pass`, `# fail`
  explicitly. Assert the count, never the exit code** — zero tests exits 0 (map §2, verified).
- `bash scripts/secret-scan.sh --surface tools/wo` → report **exit code AND coverage**. Exit 2 is
  NOT SCANNED, not a pass.
- A **real generated order file**, pasted, produced by the tool at head `9fa3169e3cc59867d3ab617a2d56d07910de65d6`.
- A **before/after size measurement** of the emitted envelope, with the method stated.

## Explicitly out of scope — report, never fix

- **Anything outside `tools/wo/**`.** In particular `.claude/**`, `SOP-022`, `Templates/work-order.md`,
  `CLAUDE.md`, any `AGENTS.md` and the Wayfinder map are **prohibited to you by contract**. J1-1's route
  binding and J1-6's final-reread are **Larry's half and are already partly committed at `9fa3169`** —
  do not attempt them, and do not treat their absence from your surface as a defect in this order.
- **Acceptance-property and reasoning defects (J1-d).** The tool is not being asked to reach them.
- **Any Nolan-related change.**
- **Any new checker, validator, actor, service, registry or governance layer** — Warwick's standing
  prohibition, restated because this order's subject matter is the place it would regrow.

## Sequencing

1. Cut worktree `C:/Fusion247PKA-wo-18`, branch `wo/18-envelope-route`, from the tip of
   **`build-020/phase4-automation-law`** — **not** from the governance head. The two differ by exactly
   one commit and the difference is deliberate; see the note below.
2. **Return the read-back block and HOLD.** Do not implement before Larry accepts it.
3. On acceptance: S-2, S-3, S-4 first (mechanical, testable); then S-1; then S-5 last, because its
   justification depends on the emitted shape.
4. Commit by explicit pathspec. Push the branch. **Open no PR and merge nothing** — integration is
   Larry's decision and merge is Warwick's.

## Note — how J1-4 resolves, and why it looked circular

**J1-4 requires the Work Order to EXIST at the governance head it declares before dispatch.** Taken as
"the order names its own commit", that is unsatisfiable: writing the SHA into the file changes the file
and therefore the SHA. **That circularity is real and is the parked "eighth generator field" defect
(§16.11).**

**It resolves with two commits, and this order is the worked example:**

| | |
|---|---|
| **Commit A — `9fa3169`** | the **governing contracts**: root `CLAUDE.md`'s new canonical clause and its five projections, plus map §17. **This is the declared `governance_head`** |
| **Commit B — tip of `build-020/phase4-automation-law`** | **this Work Order file.** A descendant of A, so every contract at A is present at B |

**The worker cuts from B**, so the order is genuinely on disk in its worktree, at a head where the
declared governing contracts are ancestors. **Nothing is dispatched that exists only in a chat message** —
which is the defect J1-4 actually targets. **S-4 implements only the checkable half:** that the declared
head exists. **Report, do not build,** if you judge the ordering rule itself should be enforced by the
tool — that is a route decision and it is Larry's.
