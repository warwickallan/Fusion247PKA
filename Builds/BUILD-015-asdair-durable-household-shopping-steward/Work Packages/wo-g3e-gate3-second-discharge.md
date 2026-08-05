---
name: Second Gate 3 discharge — D-G3-12 through D-G3-20
work_order_id: WO-2026-08-04-05
build: BUILD-015
wp_number: n/a
status: draft
authorised_by: Warwick
authorised_date: 2026-08-04
owner: general-purpose
return_to: larry
blocking_dependencies: []
tags: [build-015, veritas-gate3, documentation-truth]

outcome: Every active document in the BUILD-015 resumption chain is true at the head it ships in, the four Work Orders cite a contract clause that exists, and the estate records Warwick's route authorisation with its provenance instead of contradicting itself about whether it happened.
acceptance_property: A fresh instance opening the Wayfinder map performs a next action that is outstanding AT THE HEAD IT IS READING, not at the head the map was drafted against; and no document in the package claims a remediation that has not been performed. Checkable by taking the stated next action and by grepping the cited clause in the document said to contain it.
integration_owner: larry
veritas_gate: 3
document_impact:
  - path: Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md
    owner: larry
  - path: Deliverables/NEXT-ASDAIR-SESSION-brief.md
    owner: larry
  - path: Builds/BUILD-015-asdair-durable-household-shopping-steward/SHIT-TO-DO.md
    owner: larry
  - path: Builds/BUILD-015-asdair-durable-household-shopping-steward/ACTIVATION-DEFERRED.md
    owner: larry
  - path: .claude/agents/thin-larry.md
    owner: nolan

file_surface:
  - Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md
  - Deliverables/NEXT-ASDAIR-SESSION-brief.md
  - Builds/BUILD-015-asdair-durable-household-shopping-steward/SHIT-TO-DO.md
  - Builds/BUILD-015-asdair-durable-household-shopping-steward/ACTIVATION-DEFERRED.md
  - Builds/BUILD-015-asdair-durable-household-shopping-steward/Work Packages/wo-g3a-keel-host-shim-reconciliation.md
  - Builds/BUILD-015-asdair-durable-household-shopping-steward/Work Packages/wo-g3b-claude-md-capability-truth.md
  - Builds/BUILD-015-asdair-durable-household-shopping-steward/Work Packages/wo-g3c-resumption-precedence-and-brief-truth.md
  - Builds/BUILD-015-asdair-durable-household-shopping-steward/Work Packages/wo-g3d-wayfinder-map-and-precedence.md
  - .claude/agents/thin-larry.md
out_of_scope_policy: report-only

worker_contract:
  path: AGENTS.md
  governance_sha: 66d40d38b867d76aeeb698ec89b13aff800552e5

contract_basis:
  - surface: Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md
    permitted_by: "Cross-document reconciliation defaults to Larry — `Team Knowledge/Templates/work-order.md` §'On document_impact', 'Default owners: … integrated build records and cross-document reconciliation → Larry'. Larry delegates the mutation."
  - surface: Deliverables/NEXT-ASDAIR-SESSION-brief.md
    permitted_by: "As above."
  - surface: Builds/BUILD-015-asdair-durable-household-shopping-steward/SHIT-TO-DO.md
    permitted_by: "As above; created 2026-08-04 at Warwick's direct instruction and owned by Larry."
  - surface: Builds/BUILD-015-asdair-durable-household-shopping-steward/ACTIVATION-DEFERRED.md
    permitted_by: "As above — an integrated build record."
  - surface: Builds/BUILD-015-asdair-durable-household-shopping-steward/Work Packages/wo-g3a-keel-host-shim-reconciliation.md
    permitted_by: "As above. NOTE the standing rule that a worker never edits its OWN Work Order; these four are other orders, already returned and closed to implementation, and this order is not among them."
  - surface: Builds/BUILD-015-asdair-durable-household-shopping-steward/Work Packages/wo-g3b-claude-md-capability-truth.md
    permitted_by: "As above."
  - surface: Builds/BUILD-015-asdair-durable-household-shopping-steward/Work Packages/wo-g3c-resumption-precedence-and-brief-truth.md
    permitted_by: "As above."
  - surface: Builds/BUILD-015-asdair-durable-household-shopping-steward/Work Packages/wo-g3d-wayfinder-map-and-precedence.md
    permitted_by: "As above."
  - surface: .claude/agents/thin-larry.md
    permitted_by: "Warwick's explicit written authorisation of 2026-08-04 opening the thin-larry and keel host shims for the minimum necessary correction, recorded in WO-2026-08-04-01 §AMENDMENTS."
  - action: "read-only git and filesystem inspection across the primary checkout"
    permitted_by: "SOP-022-work-order-preflight §'Phase 2 — the preflight' — 'Verify the order against observable reality. Read-only; nothing here writes.'"
  - action: "bash scripts/secret-scan.sh --surface <declared paths>"
    permitted_by: "SOP-022-work-order-preflight §'Phase 2 — the preflight', and the required-evidence rule in `Team Knowledge/Templates/work-order.md`."

contract_conflicts: none

capability_evidence:
  source: host agent roster listing delivered to Larry at session start, 2026-08-04
  result: "general-purpose advertised with the full tool set (`*`). This order needs Read, Edit, Grep, Glob and read-only Bash — all advertised and all exercised by sibling dispatches today. If a required tool proves absent at read-back, REFUSE and name it."

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
  receipt: Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-gate3-documentation-d63668f.md
  reviewed_sha: d63668f653e233a22b5a28b6eb60f5fb84ecce48

veritas_findings:
  - id: D-G3-12
    disposition: assigned-here
  - id: D-G3-13
    disposition: assigned-here
    reason: "Larry ADJUDICATES this one rather than simply accepting it — see §The one finding I am partly disputing. The authorisation is real; the estate's record of it is not. Both halves are fixed here."
  - id: D-G3-14
    disposition: assigned-here
  - id: D-G3-15
    disposition: assigned-here
  - id: D-G3-16
    disposition: assigned-here
  - id: D-G3-17
    disposition: assigned-here
  - id: D-G3-18
    disposition: assigned-here
  - id: D-G3-19
    disposition: assigned-here
  - id: D-G3-20
    disposition: assigned-here
    reason: "Recording only. The mechanism is falsified and both records must widen to unexplained. No probe is to be designed."
---

## Read the receipt first. It is authority; this order is context only.

`Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-gate3-documentation-d63668f.md`, verdict **HOLD**, nine defects, three HIGH, Documentation truth **FAIL**, Integration **HOLD**. Read every finding and verify each against the repository before you touch anything. Where this order and the receipt differ, **the receipt wins and you tell me.**

## The one finding I am partly disputing — read this before you act on D-G3-13

Veritas wrote: *"No evidence of route acceptance exists anywhere in the estate."* **That is correct about the estate and incorrect about the world.** Warwick authorised the route in session on 2026-08-04, in these words: **"Yes I authorise and agree that."** — replying directly to a message containing the six-phase table now at map §9.

Veritas reviews the repository and cannot see a conversation. **Its finding is right for the right reason** and I am not overturning it. What is wrong is the estate: the authorisation happened and nothing in Git records it, while four other places still say it is outstanding because they were written before he answered and I never reconciled them.

**So the fix is to record the authorisation with its provenance — not to delete the claim.** Do not "resolve" this by making everything say outstanding. That would replace a true-but-unevidenced statement with a false one, which is worse.

Record it once, in the map, as: the route was authorised by Warwick in session on 2026-08-04; the quoted words; that the estate holds no other record of it and this line is that record. Then correct every other statement to match. **The distinct thing Warwick has NOT done is accept the built map as a document** — if you judge that worth stating separately, say so at read-back rather than inventing a status.

## The findings, and what each needs

Work from the receipt's own table. Summarised here so you can plan, not so you can skip it.

- **D-G3-12, HIGH.** Map `:358` gives the exact next action as integrating a package *"currently uncommitted in the working tree"*; all six artefacts are committed. `:417` says `git status --porcelain` shows *"four uncommitted packages in flight"*; at this head it returns seven dirty entries, **none** belonging to the package. **A fresh instance would redo completed work or commit seven unrelated files as the Gate 3 package.** Rewrite both to the reality at the head this ships in. **The next action must be true at the head that CONTAINS it** — that is the trap that produced this finding, and writing "at the previous head" again just moves it.
- **D-G3-13, HIGH.** Above. Map `:69`, `:233`, `:367`, `SHIT-TO-DO.md:45`, and `wo-g3d:124`/`:190` must end up saying one thing.
- **D-G3-14, HIGH.** All four orders still carry `permitted_by: "Root AGENTS.md — read-only reconnaissance is unrestricted."` at `wo-g3b:36`, `wo-g3c:59`, `wo-g3d:56`, and in prose at `wo-g3a:114`. **That clause does not exist.** Root `AGENTS.md` is 336 lines; `reconnaissance`, `read-only` and `unrestricted` each return **exit 1, no match** — those are the three terms actually tested, and they are the terms that matter. **Verify that yourself, and note the correction below.** Re-cite every instance to **`SOP-022-work-order-preflight` §"Phase 2 — the preflight"**, and confirm by grep that the clause you cite genuinely exists and says what you claim. Then correct `SHIT-TO-DO.md:95-100`, which records this as already remediated. **It was not, and the false remediation claim is the worse half of the finding.**

  > **Correction, 2026-08-04, recorded because this order is itself evidence in the finding it
  > describes.** An earlier revision of this bullet offered *"`grep -i "recon"` returns nothing"* as the
  > proof. **It returns two hits** — `reconcile` and `reconciled`. Larry wrote that sentence without
  > executing it, as the proof of a finding about unexecuted assertions, and Veritas's own evidence row
  > in `veritas-gate3-documentation-d63668f.md` carries the identical defect independently. **The
  > finding itself is unaffected and was confirmed by the three greps above.** This is instance five,
  > and it is recorded here rather than only in the log because an order that fabricates its own
  > evidence is the defect, not a footnote to it.

- **D-G3-15, MEDIUM.** `wo-g3d` has no `## AMENDMENTS` section, while `-a`, `-b` and `-c` do, and my dispatch asserted all four did. Add one recording its CLARIFY and the seven rulings — read them out of the order's own body and my rulings as they landed in the work; do not invent any.
- **D-G3-16, MEDIUM.** `.claude/agents/thin-larry.md:35` now claims the repository git lifecycle *"is now covered by a specialist contract"* (Keel). **Keel's contract rule 5 forbids editing `AGENTS.md`, `CLAUDE.md`, `.claude/`, `Builds/` and active Wayfinder maps under `Deliverables/**`** — every surface in this package — and Keel executed none of this work. Verify against `Team/Keel - Implementation Engineer/AGENTS.md` around `:420-422`. The truthful statement: Keel covers **service-estate** git for its assigned branch and worktree; **governance and documentation git has no contracted owner.** That matters because it is one of the routes bearing on Warwick's rebinding decision.
- **D-G3-17, MEDIUM.** `ACTIVATION-DEFERRED.md:5` — *"The build is complete and merged."* Dated and scoped to PR #82, but **the new precedence block promotes the build record to "the authority for every BUILD-015 fact"**, which turns it into an authoritative completion claim contradicting phase 0-of-5, the packet's absent production caller, "no row ever written to Postgres" and the open HOLD. **Scope the claim to what was actually true of PR #82 and date it.** Do not delete the history; make it unmistakable that it does not describe BUILD-015 today.
- **D-G3-18, LOW.** `SHIT-TO-DO.md:70` says *"Three orders issued"* above a table of four.
- **D-G3-19, LOW.** `NEXT-ASDAIR-SESSION-brief.md:115` and `:253` pin to `cd51ac0669…`, the **parent** of the head that contains the rewrite they describe. Re-pin to the head this ships in, or state the pin's meaning precisely.
- **D-G3-20, LOW, recording only.** The `CLAUDE.md` injected into Veritas's context was blob `8d865ed166c33920…`, the **`ecfb04b`** version — matching **neither** `HEAD` nor the working tree, but the **previous commit**. This **falsifies** the mechanism recorded at `SHIT-TO-DO.md:49` and map §5 item 7 (*"the injected copy matched the file at HEAD"*). **Widen both to "unexplained — three observations, three different sources, no mechanism established"**, and do not re-narrow it to a new guess. Caching or snapshotting is a hypothesis, not a finding. **Design no probe.** The live-probe criterion stays OPEN.

## Also park, do not fix

**`scripts/secret-scan.sh` exits 0 when it cannot run.** In Veritas's export with no `.git` it printed `fatal: not a git repository` and **still returned 0**; Veritas refused the exit code and substituted a manual grep. **Every "secret scan exit 0" produced outside a git working tree in this estate is unevidenced** — this is "unrun CI looks like green CI" in a control that other controls depend on. Add it to §1 PARKED TANGENTS with the evidence and a recommendation that it exit non-zero when it cannot scan. **Do not fix the script** — it is out of surface, it is a control, and a control changed in passing is how a green becomes false.

**And a second control defect, the same shape from the other direction — the receipt integrity
digest produces a FALSE TAMPER SIGNAL on a clean clone.** Every Veritas receipt carries
`receipt_sha256`, computed over the body. The receipts are committed as LF blobs, but this repository
runs `core.autocrlf=true` with no `.gitattributes`, **so a fresh checkout on Windows materialises them
with CRLF and the recomputed digest does not match.** Verified today at
`c9b04cfa3e74b7fb6621f720a0afeca131cfedbb`: the digest `d7dbd99320b979bd44763564361e1633f40dfae8f855a38eb8fe16b401f08d35`
reproduces exactly against the working file, the staged blob **and** the committed blob — but only
because that working file was written by Veritas in this session and has not been through a checkout.
**A future verifier cloning the repository and recomputing it will get a mismatch and may reasonably
conclude the receipt was tampered with.**

**A tamper-evidence control that fires on a clean clone is worse than no control**, because the first
false positive teaches everyone to ignore the next one — and the next one might be real.

Park it in §1 with the evidence above and this recommendation: **the digest is only meaningful against
the blob** (`git show <sha>:<path>`), never against a checked-out working file, and either the receipt
template must say so in terms or `Assurance/*.md` needs a `.gitattributes` entry pinning `eol=lf`.
**Do not do either here** — a `.gitattributes` entry changes line-ending behaviour for a whole path
class and belongs in its own change with its own proof, and the receipt template is out of surface.

**Record the pair as a pattern, because they are one failure wearing two faces:** `secret-scan.sh`
reports **success it did not earn** (exit 0 having scanned nothing); the receipt digest reports
**failure that did not happen** (mismatch with nothing wrong). *A control is not evidence until it has
been made to fail on purpose* — and neither of these two had been.

Also add a §2 challenge-log row for **`WO-2026-08-04-05`** once you know your own read-back verdict, and a paragraph recording **D-G3-14 as the fourth instance** of the same signature — with the detail that it was written into the log entry that records the lesson, two paragraphs below "an amendment issued in a message is not an amendment until it is in the artefact". **Larry wants that stated plainly, not softened.**

## Acceptance criteria

AC1 — No document in the package describes the state of a previous head as current. Every state claim resolves at the head it ships in.
AC2 — The exact next action is outstanding **at the head containing it**, and the map no longer refers to the Gate 3 package as uncommitted.
AC3 — Warwick's route authorisation is recorded once, with its provenance and quoted words, and **every** other statement about it agrees.
AC4 — No `permitted_by` anywhere in the four orders cites a clause that does not exist. Prove each surviving citation by grepping the cited document.
AC5 — `SHIT-TO-DO.md` contains no claim of a remediation that has not been performed. Re-read every entry against reality, not just the two named.
AC6 — `ACTIVATION-DEFERRED.md` no longer reads as an authoritative claim that BUILD-015 is complete.
AC7 — `thin-larry.md` states truthfully that governance and documentation git has no contracted owner.
AC8 — Both records of the injected-`CLAUDE.md` mechanism say "unexplained" and neither offers a replacement mechanism.
AC9 — Counts match their tables. Every SHA is 40 characters and resolved through `git rev-parse --verify`.
AC10 — Nothing recorded complete, operational, durable, ready, accepted, production-safe or closed. **No new mechanism, registry, validator, tracker or governance layer.**

## Required evidence

- `git rev-parse HEAD` and `git status --porcelain` at start and end.
- For **every** `permitted_by` citation left standing in the four orders: the grep proving the cited clause exists in the cited file. AC4 is the finding that recurs; prove it, do not assert it.
- The grep proving no "uncommitted" or "in flight" language survives in the map about this package.
- `git diff --stat` for all nine files.
- `bash scripts/secret-scan.sh --surface <the nine declared paths>` — exit code **and** coverage. **Given the finding above, state explicitly whether the scanner actually ran**, not merely what it returned.
- **State whether each control you rely on actually ran**, not merely what it returned. Two controls in
  this estate were found today reporting outcomes they had not earned. An exit code is a claim; say what
  ground it covered.

## Explicitly out of scope

- Everything outside `file_surface` — in particular root `CLAUDE.md`, `.claude/agents/keel.md`, every `AGENTS.md`, the three other briefs, `scripts/secret-scan.sh`, and **the Veritas receipts, which are never edited**.
- **This order itself.** You never edit your own Work Order.
- D5 classes 4-8. Still sequenced behind a Gate 3 PASS.
- All mutating git operations. Read-only git only; Larry serialises the single writer.
- Any live database, credential or network action.
