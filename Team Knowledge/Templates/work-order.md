# Work Order — canonical template

> **This file is the single source of truth for the shape of a Work Order in this estate.** Copy it,
> fill it, issue it. The *procedure* a worker runs against it lives in
> [[SOP-022-work-order-preflight]] and is not restated here.
>
> **Where a filled Work Order lives:** `Builds/<BUILD-ID>/Work Packages/<wp-slug>.md` when it belongs
> to a build; `Deliverables/YYYY-MM-DD-<slug>-work-order.md` when it is standalone.
>
> **Supersedes** the shape sketched in `Deliverables/2026-07-27-nolan-engineering-hire-recommendation.md`
> §7. That is a historical reasoning document and had already drifted from Keel's contract — the two
> carried different field lists. This file reconciles them. Do not copy the shape out of §7 again.

## The lifecycle — a Work Order is not issued until a read-back is accepted, and not closed until Veritas passes

```
DRAFT  →  WORKER READ-BACK  →  LARRY ACCEPTS OR AMENDS  →  ISSUED  →  RUNNING
      →  RETURNED  →  INTEGRATED  →  VERITAS_PENDING
      →  VERITAS_PASS  →  closed
         VERITAS_HOLD  →  corrective work for the BLOCKING findings, then ONE focused delta
                          confirmation at the corrected PRODUCT head
         VERITAS_FAIL  →  the Work Package stays open, Larry re-plans
```

**A Veritas gate is bound to the WORK BOUNDARY and the outcome it promised, never to a SHA.** A head that
differs only by receipts, documentation or clerical repair does not re-open a gate; a later review is
justified only where the promised outcome materially changed. Canonical: root `CLAUDE.md` §"Veritas
dispatch" — not restated here.

**The worker must not begin implementation until Larry explicitly accepts the read-back, or issues an
amended Work Order.** This is a gate, not a courtesy.

**An amendment replaces the envelope table in place, so the order carries exactly one operative envelope.** Struck history moves below the operative envelope under a heading marked non-operative — never left inline where a live order could read as authorising it.

**The Work Package cannot be recorded as complete without a `VERITAS_PASS` receipt against that Work
Package and the outcome it promised** (Warwick, `GOVERNANCE-VERITAS-HIRE`, 2026-08-04; bound to the
boundary rather than to a SHA, 2026-08-07). The second half of the lifecycle is
therefore not bookkeeping: `VERITAS_PENDING` is the real state of every returned-and-integrated Work
Package until [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] reviews it, and **Larry may
not write `closed` from his own assessment.** Before that receipt exists, the maximum permitted statement
is *«Integrated at "<SHA>" and submitted to Veritas for assurance.»*

**This gate fires after integration and never before implementation.** There is no Veritas pre-inspection
of a Work Order — the worker's read-back and preflight remain the only gate ahead of the build, and
challenging a defective order stays the worker's job.

**When Veritas is required but unavailable, the affected scope is assurance-BLOCKED, not provisionally
passed — and unrelated safe work continues.** There is no bypass and no provisional PASS. The exact rule,
including the two conditions that must BOTH hold before Warwick is interrupted, is canonical in
[[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] §"When Veritas is unavailable" and is not
restated here.

**The consequence, stated so it bites:** work produced without an accepted read-back **is not accepted
work.** Larry does not review it, its evidence does not count, and it is returned `REFUSED` on process
grounds however good it is. A worker that skipped the gate has no standing to argue the order was fine —
that is precisely what the gate exists to establish, in advance, at a cost of one short round trip.

The gate is symmetrical. **Larry owes a reply.** A read-back returned and never answered has not been
accepted, and the worker holds. Silence is not consent — see [[SOP-022-work-order-preflight]] §"Larry's
half of the gate".

## Frontmatter — the dispatch envelope

Every field below is mandatory unless marked optional. **A missing mandatory field is under-specification:
the worker returns `REFUSE` at read-back, naming the field.**

```yaml
---
# --- identity and authority ---
name: <slice title>
work_order_id: WO-YYYY-MM-DD-nn
build: BUILD-nnn                  # or `standalone`
wp_number: WP-n                   # or `n/a`
status: draft                     # draft | read-back-returned | issued | running
                                  # | returned | integrated | VERITAS_PENDING
                                  # | VERITAS_PASS | VERITAS_HOLD | VERITAS_FAIL | closed
                                  # `closed` is reachable ONLY from VERITAS_PASS. Larry does not
                                  # write it from his own assessment.
authorised_by: Warwick
authorised_date: YYYY-MM-DD
owner: <specialist slug>          # keel | felix | vera | vex | ...
return_to: larry
blocking_dependencies: []
tags: [build-nnn, wp-n]

# --- scope ---
outcome: <one sentence — what is true when this is done>
acceptance_property: <the ONE property whose truth decides this WP, stated so it can be checked
                      against the repository by someone who was not told the answer>
integration_owner: larry          # who integrates the returned work and submits the completed boundary
veritas_gate: 1                   # 1 = integrated WP · 2 = phase/vertical slice · 3 = documentation
                                  # and Git truth · `none` ONLY where Warwick has said so explicitly
document_impact:                  # IDENTIFIES affected active documents. It does NOT authorise.
                                  # MANDATORY on every order, including when the answer is none
                                  # (`document_impact: []` with the check actually run).
                                  # Larry supplies it; VERITAS VERIFIES IT INDEPENDENTLY at the
                                  # gate, after integration — never at issue-time.
  - path: <exact active document path>
    owner: <larry | keel | silas | another contractually permitted owner>

file_surface:                     # the COMPLETE writable set. Nothing else.
                                  # PURE PATH DATA — git, scope checks and the secret scanner consume
                                  # these entries. Never annotate an entry, never add a parenthetical
                                  # or a citation here. Justification lives in `contract_basis` below.
  - services/<svc>/src/**
  - services/<svc>/test/**
  - services/<svc>/migrations/00NN_*.sql
  - .github/workflows/<svc>-tests.yml
out_of_scope_policy: report-only

# --- contract and capability compatibility (checked BEFORE dispatch, validated at read-back) ---
# Procedure canonical in [[SOP-022-work-order-preflight]] §"The pre-dispatch compatibility check".
worker_contract:
  path: Team/<specialist folder>/AGENTS.md
  governance_sha: <exact commit containing the contract version actually checked>

contract_basis:                   # one entry per file_surface entry AND per required non-file action
  - surface: <exact file_surface entry, copied verbatim>
    permitted_by: <exact contract heading or clause>
  - action: <required non-file action, e.g. "push the assigned branch">
    permitted_by: <exact contract heading or clause>

contract_conflicts: none          # an EARNED result, never a default placeholder. A conflict is
                                  # split, rerouted or corrected BEFORE dispatch — not dispatched
                                  # and discovered.

capability_evidence:
  source: <authoritative live inventory | executed probe | unknown>
  result: <the capabilities actually observed>
                                  # `unknown` is honest but is NOT permission. Any capability the
                                  # implementation requires must be resolved before issue.
                                  # A static contract claim NEVER substitutes for a live capability fact.

# --- authority (these are the standing defaults; any other value needs Warwick) ---
credential_scope: none
live_authority: none
network: none                     # belt-and-braces: see "On `network`" below
dependency_policy: no-new-runtime-deps
private_surface: none             # none | C:/.fusion247/private/<project>/**
                                  # MANDATORY even when `none`. The secrets store is DENIED BY DEFAULT.
                                  # Governing boundary: Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md
                                  # The worker READS this field and never infers it.

# --- environment ---
worktree: C:/Fusion247PKA-wo-<nn>   # or `n/a — not a git repo`
branch: wo/<nn>-<slug>              # or `n/a — not a git repo`

# --- inputs and handoffs ---
schema_decision: <link to Silas's decision, or `n/a`>
security_inputs: <link to Vex's findings, or `n/a`>
operational_handoff: none           # mack | none — the worker checks this field, never infers it
runbook_path: services/<service>/RUNBOOK.md   # required when operational_handoff: mack.
                                    # Must be a SERVICE-LOCAL path the implementer may actually write.
                                    # A runbook under `Builds/**` is a build/assessment record and is
                                    # NOT writable by the implementer → REFUSE.

# --- corrective orders arising from a Veritas receipt (omit entirely when not applicable) ---
veritas_source:
  receipt: Builds/BUILD-nnn/Assurance/<receipt>.md
  reviewed_sha: <full 40-char SHA>

veritas_findings:                   # EVERY finding ID from that receipt. No finding may be omitted.
  - id: D1
    disposition: assigned-here
  - id: D2
    disposition: assigned-to
    work_order: WO-YYYY-MM-DD-nn
  - id: D3
    disposition: already-resolved
    evidence: <exact SHA and path>
  - id: D4
    disposition: returned-for-Warwick-decision
  - id: D5
    disposition: disputed-and-returned-to-Veritas
    reason: <why>
---
```

**On `network: none`:** the host tool grant already withholds `WebFetch`/`WebSearch` from the shims that
need it withheld. This field documents intent; it is **not** an enforced control. Say that honestly rather
than implying enforcement.

**On `acceptance_property`** — distinct from the acceptance criteria below it. The criteria list everything
that must be checked; this field names the **one property whose truth decides whether the outcome exists at
all.** Write it so a reviewer who was never told the answer can go and check it against the repository. *"The
planner consumes rule X on the live path"* is an acceptance property. *"Tests pass"* is not — a suite can be
green over a capability nothing calls.

**On `integration_owner`** — the returned work is not the delivered work. This field names who integrates
and who submits the completed boundary and its promised outcome to Veritas. It is `larry` by default and by design; a Work Order
that leaves it blank has not said who owns the seam between this WP and everything around it.

**On `veritas_gate`** — which of the three gates fires when this order's work is integrated. `none` is
permitted **only** where Warwick has explicitly said so, and the order must record where he said it. A
missing value is under-specification like any other; it is not an implied `none`.

**On `document_impact` — it IDENTIFIES; it does not AUTHORISE.** This is the field's whole grammar, and
getting it wrong is how a compatibility conflict gets manufactured at dispatch time:

- **It never adds a path to `file_surface`**, never overrides a permanent contract, and never implies the
  implementer owns every document listed. A document can be named here and be one the implementer is
  categorically forbidden to write — that is normal, and it is why every entry carries an `owner`.
- **Default owners:** implementation-local documents → the implementer, where its contract permits ·
  schema truth and canonical schema decisions → **Silas**, where his contract permits · integrated build
  records and cross-document reconciliation → **Larry** · assurance receipts → **Veritas authors, Larry
  commits verbatim** · verification of documentation truth → **Veritas at Gate 3** · external PR and
  release review → **Codex**.
- **Larry is the default owner of cross-document reconciliation because no current contract owns the
  complete surface**, and no documentation specialist is justified. **That ownership grants him no
  completion authority whatsoever.**
- **The load-bearing carve-out.** Documents that define the acceptance of Larry's own integrated work —
  Wayfinder maps, Build Contracts, Goal Contracts, acceptance criteria — stay Gate 3 material: **Larry
  writes or reconciles them; Veritas determines whether they are true; Veritas never repairs.** The
  arrangement is safe because Larry gains nothing from an unreconciled document, and where he *would* gain
  something the acceptance gate is Warwick's. **Remove that carve-out and this default becomes unsafe the
  same day** — it is load-bearing, not incidental.

An empty list is `document_impact: []`, and it is a claim that the author went and looked, not a default to
leave in place.

**On the compatibility block — `worker_contract`, `contract_basis`, `contract_conflicts`,
`capability_evidence`.** These bind the pre-dispatch check to the artefact rather than to anyone's memory
of having done it. The procedure, and the worker's duty to validate the block rather than trust it, is
canonical in [[SOP-022-work-order-preflight]] §"The pre-dispatch compatibility check" and is not restated
here.

Two rules belong beside the fields because they are about the *shape*:

- **`file_surface` stays pure path data.** Git, the scope check and the secret scanner consume those
  entries directly. Justification goes in `contract_basis`, which references a surface entry verbatim
  rather than decorating it.
- **A populated field is not a performed check.** `contract_conflicts: none` is an earned result;
  `capability_evidence.source: unknown` is honest but is **not permission**. **If this block ever becomes
  reflexively populated ceremony, report the evidence and simplify it deliberately** — do not quietly stop
  filling it in, and do not omit it now because the issuer believes he remembers the contract.

**On `veritas_source` / `veritas_findings` — no finding disappears through summarisation.** A corrective
order arising from a receipt cites the exact receipt path, its `reviewed_sha`, **every** finding ID, and
**one explicit disposition per finding**. Splitting findings across several orders is fine; every finding
stays visible in every accounting pass. **The receipt is authority; Larry's summary is context only** — and
the executing worker reads the original receipt during preflight rather than the order's account of it. The
receipt's own IDs are the register: **there is no findings ledger, registry or database, and none is to be
built.**

It is mandatory for the same reason `private_surface` is: a control that only fires when someone remembers
it does not fire. The estate's measured failure is not that documents disagree — it is that **a document
stays quietly wrong after the decision it describes has changed**, and the next fresh instance reads it and
acts on it. Naming the impact at issue-time is what makes that checkable later.

**Larry supplies the list. [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] verifies it
independently, at the gate, after integration — never at issue-time**, because verifying an order before
implementation would be exactly the pre-inspection gate Warwick ruled out. **The value of the check is
entirely in what the list missed**, so Veritas searches the repository for withdrawn wording, superseded
process steps, stale completion claims and continuation briefs — it does not audit Larry's list against
itself.

**On `private_surface` — the standing boundary line every order carries.** This field is **mandatory on
every Work Order, including the overwhelming majority where the answer is `none`.** Omitting it is
under-specification like any other missing field: the worker returns `REFUSE` at read-back, naming it.

It is deliberately not optional-when-`none`, for one reason. **[[GL-012-secrets-store-access-boundary]]
binds every worker in this estate, but it only reaches the ones who are told about it** — a contract-bound
specialist reads it via its own contract, while an ephemeral worker commissioned in a single message
inherits it only if that message names it. Making the field mandatory means **every order copied from this
template names the boundary**, so no dispatch can quietly fall outside it. That is the whole job of the
field: `none` is not ceremony, it is the boundary being stated and found not to apply.

Values: `none`, or the one exact `C:/.fusion247/private/<project>/**` subtree the work needs. **The worker
reads this field and never infers it** — same discipline as `operational_handoff`, and for the same reason:
inference at a refuse-or-build fork produces both false refusals and a gate that quietly fails to fire.
A non-`none` value must match the corresponding entry in `file_surface`; if the two disagree, that is a
contradiction the worker names at read-back rather than resolving.

**On `file_surface` under `C:/.fusion247/`:** the secrets store is **denied by default** — see
[[GL-012-secrets-store-access-boundary]], which is canonical and is not restated here. Declaring a
surface there is not guidance the author may weigh; it is a **requirement the order must satisfy or the
worker refuses it**:

- Name **one exact project subtree**. `C:/.fusion247/private/<project>/**` is a correct surface.
- `C:/.fusion247/**`, `C:/.fusion247/private/**`, and any surface at or above a project directory are
  **not valid grants**. A worker returns `REFUSE` at read-back, naming the directory you should have
  declared instead — this is not a finding it notes and builds past.
- The declaration grants that subtree and **nothing adjacent**: not the root, not sibling projects, not
  parent directories, not undeclared files. It grants **read and write**, and it never widens
  `credential_scope: none` — credential material stays forbidden inside it.
- **Required evidence on such an order must include the surface-scoped secret scan**, and exit `2` over
  a declared private surface is **blocking at handback** (GL-012 §5). Do not write an acceptance
  criterion that a worker can only satisfy by treating an unscanned private surface as clean.
- **Where Warwick has classified the capability as having no permitted public-repository trace**
  ([[GL-009-public-private-knowledge-boundary]] § "No-public-trace classifications" — a narrow, already-
  ruled case, not a rule about private-surface work generally), do not write an acceptance criterion or
  an evidence line that can only be satisfied by naming that capability, its paths or its artefacts in
  the public repository. A required deliverable at a public path is how an order forces that disclosure.

**On `worktree` / `branch`:** a surface outside any git repository is legitimate. Say so explicitly
(`n/a — not a git repo`); their absence on such an order is **not** under-specification, and no worker
ever runs `git init` to satisfy the field.

## Body sections

```markdown
## Acceptance criteria
AC1 — <independently checkable>
AC2 — ...

## Required evidence
- <the exact command that must be EXECUTED>  → must report >0 executed subtests
- bash scripts/secret-scan.sh --surface <declared paths>  → exit 0 (exit 2 = NOT SCANNED, not a pass)
- <any additional proof command>

## Inputs supplied
- Schema decision (Silas): ...
- Security findings (Vex): ...
- Research brief (Pax): ...

## Explicitly out of scope
- ...
```

### Mandatory acceptance clause for an INTENDED-AUTOMATIC outcome (Warwick, 2026-08-06)

**Canonical: root `CLAUDE.md` § "Nothing may live only in Larry's head". Read it — this projection points
there and must not paraphrase or weaken it.**

**Where a Work Order's outcome is intended to be automatic, its acceptance criteria MUST be satisfiable
only by exercising the real production event.** An AC that a manual invocation of the delivered script
would satisfy is **under-specification** — the same class as a missing mandatory field, and the worker
returns `REFUSE` at read-back naming it.

Concretely, such an order's acceptance states: which **real event** fires it · that credentials and
configuration come from the **stable approved runtime** rather than the invoking shell · how **success and
failure are each durably observable** · and that a **fresh session** exercises it without being reminded.

**The alternative is always available and is not a failure:** state explicitly in `outcome` that the
deliverable is **manual**, and the clause does not apply. What is forbidden is an order that reads as
automatic and accepts on evidence that only proves capability.

## The read-back block — returned verbatim, before any implementation

The assigned worker returns exactly this, and nothing is written until Larry answers it:

```
WORK ORDER READ-BACK

Outcome understood:
Owned files/surfaces:
Inputs and authorities:
Acceptance evidence:
Assumptions:
Contradictions:
Missing requirements:
Refusal conditions:
Verdict:
  - ACCEPT
  - CLARIFY
  - REFUSE
```

**How to fill it — each line is a claim the worker is accountable for, not a paraphrase of the order.**

| Field | What it must contain |
|---|---|
| **Outcome understood** | The outcome in the worker's own words. Restating the order's sentence verbatim proves nothing; the value is in the paraphrase, because a misreading only becomes visible when the words change. |
| **Owned files/surfaces** | The exact paths the worker believes it may write, reconciled against `file_surface`. Any path it expects to need that is *not* listed goes under Missing requirements. |
| **Inputs and authorities** | What it was given (schema decision, security findings, briefs) and under what authority (`credential_scope`, `live_authority`, `private_surface`). **State `private_surface` back explicitly, including when it is `none`** — that line is the worker confirming it knows the secrets store is denied by default, and it is where a missing or invalid declaration becomes visible. |
| **Acceptance evidence** | The commands it will run to prove each AC — **already checked against reality**, per the preflight in [[SOP-022-work-order-preflight]]. "The order's command exits 0 having executed zero tests" belongs here, before the work, not in the final report. |
| **Assumptions** | Anything the worker had to decide for itself. **An assumption is a defect in the order.** Name it so Larry can settle it rather than discover it later. |
| **Contradictions** | Where the order fights itself, or fights an authoritative contract (README, schema comment, SOP, `AGENTS.md`). Those outrank the Work Order. |
| **Missing requirements** | The field, file, grant, permission or step the order needs and does not have. |
| **Refusal conditions** | Which of the worker's own standing refusal rules this order trips, if any. |
| **Verdict** | `ACCEPT` — sound, ready to build on Larry's word. `CLARIFY` — buildable once named points are settled; the worker holds. `REFUSE` — not actionable as written; no files written. |

**A clean read-back is still worth returning.** It tells Larry the order was examined and found sound,
rather than merely unexamined.

## The integration read-back — returned by Larry when he submits the head, not by the worker

The worker's read-back opens the order; **this one closes it.** It is Larry's, it is written after
integration, and it is what he hands to Veritas alongside the SHA. It exists because the returned work and
the integrated work are not the same artefact, and nothing in this template previously asked anyone to say
so.

```
INTEGRATION READ-BACK

Work Order:
Veritas findings disposed:        <every ID from the cited receipt, or `n/a — not a corrective order`>
Boundary and promised outcome:    <THE GATE'S IDENTITY — the WP/phase and what it promised>
Where the work lives:             <branch, worktree and/or runtime Veritas should go and look at>
Integrated head (provenance):     <full 40-char SHA — resolved, not assumed>
Branch:
Acceptance property, restated:
What was integrated, in my words:
What the worker returned that I changed at integration:
Production callers now wired:
DOCUMENT IMPACT, as integrated:   <the list, re-derived AFTER the work — not copied from the order>
What I could not verify:
Veritas gate requested:           1 | 2 | 3
```

**Three rules bind it:**

- **Resolve the SHA; never assume it.** A head named from memory is the defect this whole gate exists to
  catch.
- **Re-derive `document_impact` after the work, not before.** The issue-time list was a prediction. The
  integration list is an observation, and where the two differ, the difference is itself worth reporting.
- **"What I could not verify" is a required line, and `none` must be earned.** Handing Veritas an
  unqualified submission that later fails on something Larry already suspected is a false completion claim,
  which is a `FAIL` rather than a `HOLD`.

**Larry's maximum permitted statement between this read-back and the Veritas verdict is
«Integrated at "<SHA>" and submitted to Veritas for assurance.»** Not "done", not "complete", not "working",
not "ready".

## Why this gate exists

The measured failure mode in this estate is **the order, not the work** — see
[[SOP-022-work-order-preflight]] §"Why this exists" for the evidence, which is recorded there once and
not repeated here. The one-line version:

> **Worker pushback is valuable, but it must happen before implementation rather than rescuing a
> defective order at completion.**

## References

- [[SOP-022-work-order-preflight]] — the read-back and preflight procedure. Canonical there.
- [[GL-012-secrets-store-access-boundary]] — canonical for any `file_surface` under `C:/.fusion247/`:
  deny by default, the declared-project-subtree allowlist, and the scanner rules an order must respect.
- [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] — the internal assurance gate this
  lifecycle ends at. Canonical for the three gates, the assurance dimensions and the three verdicts.
- [[Templates/veritas-receipt]] — the receipt whose existence is the precondition of `closed`.
- [[SOP-018-independent-change-qa]] — the independent QA layer a worker's evidence feeds and never replaces.
- [[GL-001-file-naming-conventions]] — slug and filename rules for the filled Work Order.
- [[Team/Keel - Implementation Engineer/AGENTS]] — the reference implementation of a Work-Order-bound contract.
