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
         VERITAS_HOLD  →  corrective work, resubmit a NEW exact head
         VERITAS_FAIL  →  the Work Package stays open, Larry re-plans
```

**The worker must not begin implementation until Larry explicitly accepts the read-back, or issues an
amended Work Order.** This is a gate, not a courtesy.

**The Work Package cannot be recorded as complete without a `VERITAS_PASS` receipt against the exact
integrated head** (Warwick, `GOVERNANCE-VERITAS-HIRE`, 2026-08-04). The second half of the lifecycle is
therefore not bookkeeping: `VERITAS_PENDING` is the real state of every returned-and-integrated Work
Package until [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] reviews it, and **Larry may
not write `closed` from his own assessment.** Before that receipt exists, the maximum permitted statement
is *«Integrated at "<SHA>" and submitted to Veritas for assurance.»*

**This gate fires after integration and never before implementation.** There is no Veritas pre-inspection
of a Work Order — the worker's read-back and preflight remain the only gate ahead of the build, and
challenging a defective order stays the worker's job.

**When Veritas is required but unavailable, the work is BLOCKED, not provisionally passed.** That reaches
Warwick as `unsafe-repository-state`, whose gloss already covers a genuine inability to proceed. There is
no bypass.

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
integration_owner: larry          # who integrates the returned work and submits the exact head
veritas_gate: 1                   # 1 = integrated WP · 2 = phase/vertical slice · 3 = documentation
                                  # and Git truth · `none` ONLY where Warwick has said so explicitly
document_impact: <NONE — verified> # or the exact list of ACTIVE documents requiring amendment.
                                  # MANDATORY on every order, including when the answer is none.
                                  # Larry supplies this list; VERITAS VERIFIES IT INDEPENDENTLY
                                  # at the gate, after integration — never at issue-time.
file_surface:                     # the COMPLETE writable set. Nothing else.
  - services/<svc>/src/**
  - services/<svc>/test/**
  - services/<svc>/migrations/00NN_*.sql
  - .github/workflows/<svc>-tests.yml
out_of_scope_policy: report-only

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
runbook_path: <path, required when operational_handoff: mack>
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
and who submits the exact integrated head to Veritas. It is `larry` by default and by design; a Work Order
that leaves it blank has not said who owns the seam between this WP and everything around it.

**On `veritas_gate`** — which of the three gates fires when this order's work is integrated. `none` is
permitted **only** where Warwick has explicitly said so, and the order must record where he said it. A
missing value is under-specification like any other; it is not an implied `none`.

**On `document_impact` — the contradiction-prevention control, mandatory on every order.** Value it
`NONE — verified` or list the exact **active** documents requiring amendment. `NONE — verified` is a claim
that the author went and looked, not a default to leave in place.

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
Exact integrated head:            <full 40-char SHA — resolved, not assumed>
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
