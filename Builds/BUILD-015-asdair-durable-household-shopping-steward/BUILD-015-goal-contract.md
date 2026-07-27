---
name: BUILD-015 — AsdAIr Durable Household Shopping Steward
owner: larry
authority: warwick
promoted: 2026-07-27
promoted_from: IDEA-012 (AsdAIr)
tags: [build, asdair, idea-012]
---

# BUILD-015 — AsdAIr Durable Household Shopping Steward

A **Goal Contract**, not a scaffold. Promotion of an existing, already-running capability into a truthful
governance home — not a new design exercise.

## Provenance

| | |
|---|---|
| Promoted from | **IDEA-012 — AsdAIr**, an operating capability that had been running real weekly household shops without a BUILD record |
| Promoted at | Fusion247PKA `87c7ff6` (`origin/main`, the integration base for this build's branches) |
| Promoted on | 2026-07-27, by Warwick's explicit ruling |
| Why now | Tower's merge-check requires `build_ref` matching `^BUILD-\d{3}$`; AsdAIr had no BUILD number, so its code could not be independently reviewed at all. The gap was governance, not capability. |

**The historical record is NOT duplicated here.** The idea, its research and its decisions stay where they are:
`Deliverables/2026-07-27-nolan-asdair-specialist-assessment.md` (what durably existed and what did not) ·
`Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md` (the operating method) ·
`services/asdair/skill/README.md` (the ten standing rules — canonical, never restated) ·
`services/asdair/db/001_asdair_schema.sql` (the loop the schema always designed) ·
`Team/Asdair - Household Shopping Steward/AGENTS.md` (the specialist contract).

## North star

> **AsdAIr is a genuinely durable, spawnable household-shopping specialist that can orient from committed
> function plus Supabase state, plan correctly, ask for decisions when required, persist outcomes and learning
> safely, and survive fresh runtime instances.**

The failure this build exists to close: the method lived only in machine-local memory and per-session
scratchpads, and the three loop tables (`orders`, `order_events`, `rule_qa_log`) had **zero writers anywhere in
the repo, including tests**. Each week started no better informed than the last.

## Success criteria

Real acceptance evidence, not aspiration. Where already established, marked ✅.

1. ✅ **Durable method** — the operating method lives in Git (`SOP-021`), not in memory or a scratchpad. A method
   copy previously held in `asdair.skill_steps` is superseded non-destructively; Git wins.
2. ✅ **Durable read/write state paths** — two least-privilege roles: `ASDAIR_DB_URL`/`asdair_ro` (SELECT-only)
   and `ASDAIR_WRITE_DB_URL`/`asdair_rw` (SELECT+INSERT on the four loop tables, column-scoped UPDATE on
   `rule_qa_log.promoted_rule_id`, SELECT on `source_documents`). Negatively probed.
3. ✅ **Fresh-instance continuity** — instance A records a shop and promotes a decision; a separate instance B
   with no knowledge of A reads only durable state and sees both, with provenance.
4. **Regulars-aware planning** — the planner resolves against `asdair.regulars` and `aka` aliases, not just
   `products`. *(implemented; awaiting behavioural acceptance)*
5. **Correct quantity parsing** — trailing bare quantities parse (`"milk 2"` → 2), without stripping identity
   numbers (`"omega 3"`, `"milk 2L"`, `"7up"`). *(implemented; awaiting behavioural acceptance)*
6. **Safe ambiguous-item handling** — an item that cannot be confidently matched goes to `needs_decision` with
   alternatives surfaced, never silently to `add`. *(implemented; awaiting behavioural acceptance)*
7. **No forbidden automatic substitution** — standing rule 6 enforced by the code, not by the operator.
8. ✅ **Provenance-safe learning** — automatic promotion defaults to `directive='info'`; an actionable directive
   requires provenance proving the instruction was explicit, verified in the database and never asserted by the
   caller. Flag-spray proven ineffective.
9. **Outcome write-back** — a completed shop records `orders` + `order_events`; `checked_out` is a SQL literal
   `false`. *(implemented; awaiting live-shop acceptance)*
10. **Independent QA** — Tower/Codex review at the exact head. Larry's own review is not sufficient evidence.

**Behavioural acceptance gate.** A completely fresh bound Asdair instance, on a scenario containing known
Regulars, previously-ordered items, an ambiguous item, trailing-quantity syntax, a substitution case governed by
standing rules, and existing learned state, must: use what Fusion already knows · parse correctly · ask only where
a decision is genuinely needed · never invent a forbidden substitution · persist the outcome and learning.

## Non-goals

No shopping-platform redesign · no generic agent-platform work · no broader cockpit changes · no new learning
behaviour beyond what the existing design specified · no expansion of the specialist into an implementation
engineer.

## Invariants

- **Secrets out of Git.** Tokens and connection strings live only in the off-repo store. *(Shopping content is
  explicitly NOT a privacy matter — Warwick, 2026-07-27.)*
- **Function in Git, runtime state in Supabase.** Migrations ship columns, never rows. A method found in the
  database loses to `SOP-021`.
- **Warwick is the payment and checkout gate.** AsdAIr never books a slot, checks out or pays. `checked_out`
  stays false, enforced in SQL rather than by input.
- **No ad-hoc DB writes bypassing the governed AsdAIr writers.** Hence no `execute_sql` grant to the specialist.
- **Independent QA for implementation code**, consequence-appropriate.
- **The specialist defines domain correctness; engineering implements.** A specialist finding a defect does not
  acquire authority to fix it.

## Authority

**Larry** owns implementation sequencing, worker allocation, integration and all reversible technical decisions.
**Warwick** retains genuine domain and product decisions, consequential external actions, and merge-to-main.

## Open questions — Warwick's, not Larry's

1. **"substitute Banana → Strawberry"** (from the superseded method). A legitimate `map` directive, or a safety
   bug against standing rule 6 and the live hard-excludes? Both readings recorded in `SOP-021`, neither encoded.
   Interim safe default: treat any banana/strawberry line as `needs_decision`.
2. **Sort order** — `SOP-021` says A–Z; the superseded copy said BRAND A–Z.
3. **Data decisions** — Arla BOB is active in `regulars` while rule 10 says never buy BOB; `rules` 23/24 fix the
   Sure variant while `rule_qa_log` #5 says rotate it; a test row remains in a `next_week_draft` list.

## Deferred, with the claim corrected rather than the capability pretended

**Rule 7 (budget band) is structurally unevaluable** — no price column exists on `products` or `regulars`, so
`estimated_total` is null and `budget_flag` is permanently `unknown` for any real list. The rule is documented,
implemented and dead. Do not claim budget flagging works until a price source exists.

Also deferred: 70 of 91 regulars carry no `asda_product_id` (name-matching only, lower confidence) · schema drift
on `previously_ordered` and `command_request` · the browser drive stays with Larry until the Chrome-connector
tool-binding question is settled on its own.
