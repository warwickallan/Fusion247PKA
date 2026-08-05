# Veritas — hire record

**Hired:** 2026-08-04 · **Authority:** Warwick, directly, order `GOVERNANCE-VERITAS-HIRE` · **Executed by:** Nolan
**Contract:** [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] · **Shim:** `.claude/agents/veritas.md` · **Slug:** `veritas`

This is the hire record SOP-001's definition-of-done points at. It exists so a future Nolan does not see a
missing research artefact and re-run a research pass that was deliberately not run.

## Why a permanent role did not breach the regrowth cap

Recorded because the cap is the estate's most expensive lesson and a new *role* is the one kind of growth
that can look exempt from it. It is not.

**Warwick, `GOVERNANCE-VERITAS-CORRECTION-01`, 2026-08-04:** *"A permanent role is itself part of the
operating mechanism and remains subject to the regrowth cap. Veritas earned its place because evidence
showed that no existing owner or callable procedure provided standing separation between the party
integrating and narrating work and the party deciding whether that work was true."*

So the test Veritas had to pass was the same one a new validator or store would have to pass — *does an
existing route already do this?* — and the answer was checked against each candidate rather than assumed:
**Larry** was the party being separated from; **Codex** is external and fires at PR/release, not during
delivery; **Pax** is research and was being mis-used as routine QA; **Vera** owns rendered surfaces;
**SOP-018** is a callable procedure that cannot manufacture independence when the reviewer is grading its
own work. **No existing owner or procedure supplied standing separation.** That, and not the usefulness of
the idea, is what earned the role.

## Why there is no Pax research brief — a determination, not an omission

[[SOP-001-how-to-add-a-new-specialist]] §2 makes a Pax research pass mandatory on every hire, and its stated
purpose is to stop generic, AI-flavoured specialists: *what does the best-in-world version do day to day, what
are the anti-patterns, what deliverables, what boundaries, what name candidates.*

**Nolan judged that step satisfied by Warwick's order itself, and proceeded.** The reasoning, recorded so it can
be challenged rather than merely trusted:

- Warwick specified the role exhaustively in the order — eight assurance dimensions, three named gates each with
  its own checklist, three verdicts with the "no PASS WITH UNKNOWN CRITICAL ITEMS" rule, a verbatim operating
  principle, four boundary statements against named specialists, a mandatory loop, and a token/bureaucracy
  boundary.
- **The anti-patterns SOP-001 sends Pax to find were already in the order** — *a schema is not a producer · a
  renderer is not a notification · a tested function with no caller is not a feature · a stored rule the planner
  filters out is not an operational rule · a document describing a process is not proof the product follows it ·
  a green isolated suite is not end-to-end acceptance · a manual action performed by Larry is not automation.*
  These are drawn from BUILD-015 and BUILD-018 — **this estate's own measured failures**, which is a stronger
  evidence base than external research into the role.
- The order explicitly forbids reopening whether the role is needed. A research pass into a decided question
  would have spent a dispatch to return what Nolan had already been handed.

**When this determination would NOT apply.** It is not a precedent for skipping §2 generally. It holds only where
the commissioning instruction already contains the role's day-to-day, its anti-patterns, its deliverables and its
boundaries at specification depth, and where those anti-patterns are grounded in observed failures rather than
assumed. **A one-line gap statement never meets that bar** — that is the ordinary case, and it still goes to Pax.

## What the hire changed

| Deliverable | Where it landed |
|---|---|
| 1 — specialist contract | `Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md` |
| 2 — agent index and routing | `Team/agent-index.md`, root `AGENTS.md`, Larry's routing cheatsheet |
| 3 — Larry's self-certification authority removed | `Team/Larry - Orchestrator/AGENTS.md` §"Completion authority — REMOVED", `CLAUDE.md` |
| 4 — Work Order and integration templates | `Templates/work-order.md` — `acceptance_property`, `integration_owner`, `document_impact`, `veritas_gate`, and the integration read-back block |
| 5 — `VERITAS_*` lifecycle states | `Templates/work-order.md` status enum; `Team/agent-index.md` |
| 6 — close procedures gated | `Templates/work-order.md` (WP), `CLAUDE.md` §Wayfinder (phase), Larry's contract (vocabulary) |
| 7 — Codex preserved | stated in the contract, `agent-index.md`, root `AGENTS.md`, `fusion-operating-model.md` |
| 8 — receipt template | `Team Knowledge/Templates/veritas-receipt.md` |
| 9 — cold-start recovery | contract §"Cold-start recovery"; shim §"On every invocation" |
| 10 — no new service or framework | honoured — no code, no store, no registry; clauses added to files that already existed |

## Deliberate non-actions, so a later reader does not read them as oversights

- **No new SOP.** WP close, phase close and build close had no owning SOP; the gates bind in the artefacts that
  already govern each — the Work Order template, `CLAUDE.md` §Wayfinder, and Larry's contract. A new SOP would
  have been a third place to look.
- **`Templates/work-package.md` untouched** — verified as Warden's `Client Delivery/` engagement template, not a
  Fusion build Work Package. Editing it would have been scope contamination.
- **`Team Knowledge/INDEX.md` untouched** — it is a hub that enumerates no templates; the real registration point
  is `Team Knowledge/Templates/INDEX.md`.
- **`SOP-001` untouched** — nothing about how the team hires changed.
- **`Team Knowledge/Guidelines/**` untouched** — Silas holds it; he landed the GL-009 ruling in the same session.
- **`tools/**` untouched** — Codex's added duty to audit Veritas's assurance work lands in the review route and is
  Larry's to schedule, not Nolan's to implement.
- **No handback code added, renamed or removed.** Veritas-unavailable binds to the existing
  `unsafe-repository-state`, whose gloss already covers a genuine inability to proceed. The seven names are
  mirrored in a frozen literal in `tools/governor/footer.mjs`.

## Correction pass — `GOVERNANCE-VERITAS-CORRECTION-01`, 2026-08-04

Warwick ordered an independent challenge of six proposed corrections rather than blind implementation. The
outcomes worth carrying forward:

- **Three "overbroad standing rules" were reported as having leaked into the governance at `66d40d3`. They
  had not.** Verified by search across the contract, shim, receipt template and hire record: rule A absent
  (the contract already stated the compliant form), rule B **zero matches**, rule C matching only a
  pre-existing 2026-07-12 line on an unrelated subject. The correction was therefore **additive**, and the
  premise is recorded as tested rather than accepted.
- **Rule C was REJECTED for the estate.** It governs how Larry handles Warwick repeating a decision —
  memory-level discipline whose estate analogue already exists, in the place it actually bit:
  [[GL-009-public-private-knowledge-boundary]] §"The rule that governs how this rule is read". A third
  statement would have been regrowth and an SSOT breach.
- **The committed contract forbade the method that makes its own evidence trustworthy.** It declared the two
  receipt locations Veritas's "complete write surface", while trustworthy evidence requires an isolated
  export written elsewhere. The first receipt did the right thing (`git archive` to scratchpad) and was
  therefore out of contract. Fixed by an explicit, bounded carve-out.
- **A prior integrity argument was withdrawn.** "An uncommitted receipt is visible" was wrong — visible to
  Larry, and to nobody else. Suppression is now partly closed by Gate 3 enumeration and made tamper-evident
  by `receipt_sha256`; **the residual hole is recorded rather than papered over.**
- **`CLAUDE.md` Rule 4 was false and is corrected to `UNBOUND — deliberately, by Warwick`.** A fresh Larry
  holding `Bash`/`Edit`/`Write` is the expected state, not a failed binding.

## References

- [[Team/Veritas - Internal Quality and Truth Assurance/AGENTS]] — the contract.
- [[Templates/veritas-receipt]] — the receipt shape.
- [[SOP-001-how-to-add-a-new-specialist]] — the hiring procedure this record documents a determination against.
