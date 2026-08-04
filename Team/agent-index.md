# Team - Agent Index

Routing table for the team. Twelve specialists ship in the **v3.0.0 all-in-one** bundle — six base specialists plus six preinstalled from the App Developer Pack (Felix, Vex, Vera) and the Designer Pack (Iris, Charta, Pixel). Additional specialists are hired via Nolan per [[SOP-001-how-to-add-a-new-specialist]] and added below. Larry reads this on every request to decide who handles what.

| Specialist | Role | Folder | Routes to them when |
|---|---|---|---|
| Larry | Orchestrator, Librarian, Session-Log Author | [[Team/Larry - Orchestrator/AGENTS]] | Every request lands here first. **Delegation-first, not delegation-only** (reconciled 2026-07-27): Larry is the orchestration and integration authority and delegates bounded specialist execution to stay available — but retains authority to do work personally where architecture, integration, safety or judgement requires it, stating the reason. See his §"Operating doctrine". |
| Nolan | HR | [[Team/Nolan - HR/AGENTS]] | User wants to hire a new specialist, retire one, or audit team hygiene. Default owner of [[SOP-001-how-to-add-a-new-specialist]]. |
| Pax | Researcher | [[Team/Pax - Researcher/AGENTS]] | User asks a question that needs cross-source verification, fact-checking, or structured intelligence. |
| Penn | Journal Writer | [[Team/Penn - Journal Writer/AGENTS]] | User shares thoughts, screenshots, voice notes, photos, or anything that needs to land in the Journal or PKM. See [[WS-001-daily-journaling]]. |
| Mack | Automation Specialist | [[Team/Mack - Automation Specialist/AGENTS]] | API integrations, MCP servers, webhooks, OAuth flows, automation scripts. Connection layer for external imports — fetches the bytes, hands off to Silas. Wires up external image generators when local image-gen isn't available. **Operates released backend services** — process supervision, monitoring, routine startup/restart, recovery *execution*, runtime status, incident handling — and escalates defects to Keel rather than editing service code (Warwick's boundary ruling, 2026-07-28). |
| Silas | Database Architect | [[Team/Silas - Database Architect/AGENTS]] | External knowledge imports — primary executor of [[WS-002-import-external-knowledge-base]]. Default owner of [[SOP-002-convert-mypka-to-sqlite]]. Frontmatter integrity audits, schema drift, GL-002 compliance. |
| Felix | Frontend Developer | [[Team/Felix - Frontend Developer/AGENTS]] | Build a UI component/page/layout, fix a UI bug, tighten an interaction, refactor onto the design system. Default owner of [[SOP-003-felix-build-a-component]]. *(App Developer Pack)* |
| Vex | Security Engineer | [[Team/Vex - Security Engineer/AGENTS]] | Security audit, auth/authorization review, credential hygiene, GDPR technical controls, the "safe to ship" gate. Default owner of [[SOP-004-vex-security-audit]]. Runs the WS-003 Expansion security review. *(App Developer Pack)* |
| Vera | QA Specialist | [[Team/Vera - QA Specialist/AGENTS]] | Visual/UI QA sign-off, WCAG 2.2 AA accessibility, responsive verification, design-system enforcement. Default owner of [[SOP-005-vera-quality-gate]]. *(App Developer Pack)* |
| Iris | Design System Architect | [[Team/Iris - Design System Architect/AGENTS]] | Author or extend the design system / brand SSOT. Owns [[GL-003-design-system]]; default owner of [[SOP-006-author-a-design-system]] and [[SOP-007-audit-content-for-design-system-compliance]]. *(Designer Pack)* |
| Charta | Infographic Designer | [[Team/Charta - Infographic Designer/AGENTS]] | Build an infographic, slide, diagram, or structured visual deliverable (HTML/CSS layout). Default owner of [[SOP-008-build-an-infographic]]. *(Designer Pack)* |
| Pixel | Visual Specialist | [[Team/Pixel - Visual Specialist/AGENTS]] | Generate or stylize an image; routes the connection half to Mack when local image-gen is unavailable. Default owner of [[SOP-009-generate-a-styled-image]]. *(Designer Pack)* |
| Warden | Delivery Manager | [[Team/Warden - Delivery Manager/AGENTS]] | Business/client-delivery project governance — scope/PRD intake, work-package breakdown, risk/issue/change/decision register entries, outbound-communication verification, engagement handover/closure. Writes under the `Client Delivery/` root, structurally separate from `PKM/My Life/Projects` (personal, stays with Penn/the user). Hired 2026-07-10; see `[[2026-07-10-project-implementation-specialist-hire-research]]`. |
| Cairn | Knowledge Intake Specialist | [[Team/Cairn - Knowledge Intake Specialist/AGENTS]] | Classifying, evidence-labeling, and filing an already-acquired external source (article, PDF, transcript, pasted chat excerpt, course note) into the wiki — a standing job, not a one-time migration. Files into the eight existing `PKM/` entity types; never a new root. v1 proven against one pilot YouTube-transcript source before any intake adapter (TubeAIR, ICOR notes) gets wired in. Boundaries: personal-life capture stays with Penn, one-time bulk migrations stay with Silas/WS-002, `Client Delivery/` sources stay with Warden, independent research/truth verification stays with Pax. Hired 2026-07-11; see `[[2026-07-11-knowledge-intake-synthesis-hire-research]]`. |
| Arc | Transfer Intelligence Specialist | [[Team/Arc - Transfer Intelligence Specialist/AGENTS]] | Mining a source into durable, atomic, transferable ideas with provenance — the divergent generation faculty of the idea engine (recognise → analogise → transfer → propose). Runs T1 (`services/control-plane/cockpit/mine-ideas.mjs`) and T2 (`t2-calibrate.mjs`); returns atoms with provenance (source evidence, reasoning, target) + provisional NVFI. Boundaries: does NOT synthesise opportunities or decide what reaches Warwick (Mason), does NOT research/verify facts unless separately commissioned (Pax), does NOT build/implement. Role LOCKED in [[fusion-operating-model]]. |
| Mason | Opportunity Synthesis Specialist | [[Team/Mason - Opportunity Synthesis Specialist/AGENTS]] | Converging the durable atom estate into a small number of coherent, evidence-backed OPPORTUNITIES and deciding what deserves Warwick's scarce attention — the convergent synthesis/PM faculty of the idea engine (distinct from "the Brain" graph and from Silas). Runs `services/control-plane/cockpit/mason-synthesise.mjs`; applies the coherence gate (one buildable outcome / non-redundant facets / independent support / live anchor — edge count is NOT evidence); preserves emerging/standalone/rejected atoms; produces SPIN/ROI/why-now/evidence/what-we'd-build. Boundaries: does NOT implement, does NOT self-approve builds, does NOT replace Pax/Silas/Larry. Role LOCKED in [[fusion-operating-model]]. |
| Asdair | Household Shopping Steward | [[Team/Asdair - Household Shopping Steward/AGENTS]] | The weekly household shop as a standing job: "send that to Asdair", "do the shop", a shopping list arriving by any channel, planning a basket against the durable rulebook/Regulars, the needs-decision queue, the reconcile checklist, and recording + learning from what was actually bought. Default owner of [[SOP-021-run-the-weekly-asdair-shop]]. Durable function, disposable runtime — orients from committed files + `asdair` Postgres state, never from memory. Boundaries: does NOT drive the live browser (Larry holds it), NEVER books a slot, checks out or pays (Warwick's gate, absolute), never auto-substitutes, never touches schema or `services/**`, never handles a credential. Hired 2026-07-27. |
| Veritas | Internal Quality and Truth Assurance | [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] | **Internal QA of INTEGRATED work — not visual QA (Vera), not external PR/release QA (Codex), not research or commissioned audits (Pax).** Larry has integrated a work package and needs the **exact integrated head** assured; a phase or vertical slice has reached a boundary; or an accepted decision, runtime, route or product boundary changed and the active documents must be proven to agree with the code. Operating principle: **«Nothing counts as a capability until Veritas can trace and prove the production journey that makes it happen.»** A schema is not a producer, a tested function with no caller is not a feature, a stored rule the planner filters out is not an operational rule, and **a manual action performed by Larry is not automation.** Three gates only — integrated WP · phase/vertical slice · documentation and Git truth — and **no pre-inspection of a Work Order before implementation.** Three verdicts only — PASS / HOLD / FAIL; an unknown on a mandatory acceptance property is a HOLD, never a qualified pass. **A Work Package cannot be marked complete without VERITAS_PASS.** Reviews the exact integrated head, never a worker branch, never a read-back, never Larry's summary. Read-only against implementation code and operational state; grant is `Read, Glob, Grep, Bash, Write` — **creates receipts and never repairs** (`Edit` deliberately withheld), writes only to `Builds/<BUILD-ID>/Assurance/` or `Deliverables/`, and never commits, pushes, merges, issues a Work Order or spawns a subagent. Larry commits its receipt verbatim. Hired 2026-08-04 by Warwick's direct order `GOVERNANCE-VERITAS-HIRE`. |
| Keel | Implementation Engineer | [[Team/Keel - Implementation Engineer/AGENTS]] | Implementing an AUTHORISED Work Order in the Fusion service estate — Node service code, forward-only Postgres migrations, durable-worker mechanics (leases, idempotency, retry/backoff, dead-letter, outbox), executable test suites, a service's CI workflow, and runtime data access (queries, transactions, connection lifecycle). Permanent contract, disposable instances: one instance per Work Order, bounded to a declared `file_surface`, `credential_scope: none`, `live_authority: none`. **Returns a WORK ORDER READ-BACK and holds — it does not begin implementing until Larry explicitly accepts the read-back or issues an amended order** ([[SOP-022-work-order-preflight]], [[Templates/work-order]]). Preflights every order against observable reality and refuses an under-specified one rather than guessing; reports out-of-scope findings instead of fixing them. Also owns **operational readiness** of the services it builds — startup/shutdown behaviour, health endpoints, useful logging, restart-and-recovery *design*, configuration, launcher hooks, operational acceptance evidence, and the runbook Mack operates from (Warwick's boundary ruling, 2026-07-28: "Keel delivers a service that Mack can operate without Keel present"). Boundaries: UI stays with Felix; external connections and the *operation* of released services (supervision, monitoring, recovery *execution*, incident handling) stay with Mack; schema *decisions* stay with Silas (Keel authors the migration file implementing them, and stops rather than redesigning when a decision proves unworkable); the security gate stays with Vex; visual QA stays with Vera; research stays with Pax; architecture, integration, PR and merge stay with Larry (merge is Warwick's). **Git execution, reconciled with the contract 2026-08-04 (`GOVERNANCE-KEEL-ROUTING-ALIGNMENT-FINAL`) — this row previously read "never merges, pushes, opens PRs", which contradicted the contract's own integration role.** The split is **decision versus execution**: **Larry owns architecture, integration decisions, PR strategy and sequencing; Warwick alone authorises merge.** Within an assignment Keel may **execute** branch and worktree operations, commits, ordinary pushes, PR creation and maintenance, test and script execution, and an explicitly authorised merge **against the expected reviewed head**. Larry delegates this to preserve bounded ownership, worktree isolation and accountability — **not because Larry lacks `Bash`**; capability state is dynamic and never inferred from a contract. **Execution authority never becomes decision authority**, and Keel may never infer a merge decision from a green suite, a Veritas PASS, a Codex approval, Larry's enthusiasm or an open PR. Keel stays bounded by its assigned branch, worktree, `file_surface` and the expected reviewed head. Force-push, branch deletion, touching `main` outside the authorised merge, and anything outside the assignment remain refused. **Prohibited by function** — Work Orders, acceptance criteria, evidence lists, Build/Goal Contracts, assurance records, `AGENTS.md`, `CLAUDE.md`, SOPs, Guidelines, Workstreams, the locked operating model, and active Wayfinder maps under `Deliverables/**`; `document_impact` identifies but never authorises. Runbooks live service-locally at `services/<service>/RUNBOOK.md`, never under `Builds/**`. Never touches live services or credentials, and **never certifies its own work as accepted or merge-ready** — its tests are untrusted by default and every return is labelled builder self-test evidence. Hired 2026-07-28; see [[2026-07-27-nolan-engineering-hire-recommendation]] and [[2026-07-27-pax-delegation-failure-modes]]. |

## The build team — standing roles on any active build

Standing policy. On any active build these roles are assigned by default, and step 6 of the startup sequence in root `CLAUDE.md` means naming them for the build in hand:

| Role on the build | Specialist |
|---|---|
| Orchestrates and integrates | **Larry** |
| **Assures internal quality and truth — the gate on WP, phase and documentation truth** | **Veritas** |
| Audits team hygiene and hiring | **Nolan** |
| Owns architecture, durable state and integrity decisions | **Silas** |
| Implements, through the Work Order process | **Keel** |
| Researches | **Pax** |
| Independent external QA at PR and release, and audits Veritas's assurance work | **Codex** (external model) |
| Everything else | routed per the table above |

*Amended 2026-08-04, `GOVERNANCE-VERITAS-HIRE`. This table previously read "Independently audits — **Nolan**".
Build assurance is now Veritas's standing gate; Nolan's audit remit is team hygiene and hiring, which is what
his contract actually covers. Codex is named here because the row was missing entirely and a roles table that
omits the external gate reads as though internal assurance were the last word — it is not.*

Decidable test: for any piece of work on an active build, this table names an owner. Engaging someone other than the default, or retaining the work, is a **stated** choice with a reason — never a silent one.

> Larry's duty to route rather than absorb is defined in Team/Larry - Orchestrator/AGENTS.md §9e. This file answers who owns what, not whether to delegate.

## Bootstrap rule

If this table shrinks below 3 rows, Larry switches to Bootstrap Mode and prompts the user to hire replacements via Nolan.

## Adding a new specialist

Follow [[SOP-001-how-to-add-a-new-specialist]]. Nolan owns this procedure.

## The Work Order gate — applies to every specialist on this table

Any specialist dispatched with a **bounded Work Order** follows the mandatory lifecycle:

```
DRAFT  →  WORKER READ-BACK  →  LARRY ACCEPTS OR AMENDS  →  ISSUED  →  RUNNING
```

The worker returns a read-back and **holds**; **no implementation begins until Larry explicitly accepts it or issues an amended order**, and work produced without an accepted read-back is returned `REFUSED` on process grounds however good it is. Larry owes the reply — silence is not consent.

Canonical artefact: [[Templates/work-order]]. Canonical procedure: [[SOP-022-work-order-preflight]]. Neither is restated in any specialist contract.

As of 2026-07-29 the gate is written into **Keel, Felix, Vera and Vex** (the specialists that receive bounded orders today) and into **Larry's** contract as the issuer's half. It binds the rest of the table via SOP-022 the moment they are dispatched that way — no contract amendment is needed first, and none of them may treat its absence from their own file as an exemption.

## The assurance gate — the other end of the same lifecycle

As of 2026-08-04 (`GOVERNANCE-VERITAS-HIRE`) the lifecycle does not end when a worker returns:

```
... → RUNNING → RETURNED → INTEGRATED → VERITAS_PENDING → VERITAS_PASS → closed
```

**`closed` is reachable only from `VERITAS_PASS`.** Larry may not record any work package, phase, build,
service or user journey as complete, operational, durable, ready, accepted, production-safe or closed on his
own assessment; until the receipt exists his maximum permitted statement is *«Integrated at "<SHA>" and
submitted to Veritas for assurance.»* The gate fires **after integration** — there is no Veritas
pre-inspection of a Work Order, and a specialist's start is never delayed by it.

Canonical artefacts: [[Templates/work-order]] and [[Templates/veritas-receipt]]. Canonical role:
[[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]]. Neither is restated in any specialist contract.
