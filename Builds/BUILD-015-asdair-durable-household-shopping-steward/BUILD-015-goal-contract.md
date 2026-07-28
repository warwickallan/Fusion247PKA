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

## The accepted acceptance bar — SUPERVISED, not fully hands-off (Warwick, 2026-07-28)

**Fully hands-off shopping was descoped by Warwick on 2026-07-21** ("a HUMAN logs into Asda"). The approved
product scope for BUILD-015 is the **supervised** workflow:

> Warwick/list -> AsdAIr resolves against Mum's durable Regulars/rules -> genuine unknowns are held and asked ->
> **Larry drives the ASDA browser using SOP-021** -> never auto-substitute -> never checkout or pay -> record the
> actual outcome -> persist learning for the next shop.

**Alias/Regular coverage improving through real shops is operational learning, NOT a merge blocker.** A recorded
verdict of "not ready for AUTONOMOUS lane" is therefore not a statement that this build failed its bar - it is a
statement about a scope Warwick has explicitly deferred.

Note also that AsdAIr is an **A+B hybrid** by design (Warwick-approved 2026-07-18): (A) the deterministic planner
drives unambiguous structured directives, exclusions and quantities; (B) an LLM instance handles fuzzy judgement
such as closest-Regulars matching. Measuring A alone understates the delivered capability - the real shop of
2026-07-27 ran largely hands-off because B was doing the resolution.

## Success criteria

Real acceptance evidence, not aspiration. Where already established, marked ✅.

1. ⚠️ **Durable method — NOT TRUE AT THIS HEAD.** SOP-021 and the Asdair specialist contract are committed only on `idea-016/idea-engine`; they are absent from `main` and therefore from this branch. The behavioural acceptance instance could not read its own contract or method from the worktree it was bound to, and recovered them by guessing another branch. **Do not mark this criterion passed until those files reach this build ancestry.** Original intent — the operating method lives in Git (`SOP-021`), not in memory or a scratchpad. A method
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

---

## Stage 1 scope — Warwick's ruling, 2026-07-28

The Stage 2a/2b split proposed in `Deliverables/2026-07-28-asdair-stage2-telegram-and-daemon-assessment.md` was
**overruled in scope**: what that report called Stage 2a and Stage 2b are **REQUIRED parts of BUILD-015 Stage 1**.

**In scope, and required.** A narrow background Telegram receiver and a deterministic queue worker are ordinary
product runtime — without them ShopperBot does not function. Likewise the question loop, Telegram status, the
supervised browser-build request, order-confirmation ingestion and reconciliation, and automatic outcome closure.
One-shot vision/model calls through the existing Fusion model gateway are permitted for transcription.

**Deferred (Stage 2c), and NOT to be built.** A persistent external-LLM AsdAIr daemon; a fully autonomous
planning daemon; an unattended ASDA browser; automated checkout; automated payment.

**The permanently human-controlled actions** — unchanged and not negotiable: the supervised live ASDA browser
session, checkout, and payment.

**Identity.** This increment is **BUILD-015 AsdAIr — Stage 1**. IDEA-012 remains provenance only. **PR #82 is the
single integration PR** for all remaining Stage 1 behaviour — no second BUILD, no second IDEA lifecycle, no
parallel recovery branch, no separate ShopperBot architecture programme.

**Completion bar.** Stage 1 is NOT complete while ShopperBot is merely a receiver, or while Larry must manually
stitch scripts together. The finished experience is: Telegram list → receipt → buttons → transcription → durable
list → planning → Telegram questions → supervised basket build → visible status → human checkout → order
confirmation → reconciliation → permanent learning for next week.

The verdict wording **READY — TELEGRAM-CONTROLLED, DURABLE, SUPERVISED ASDAIR** may only be used after live
acceptance passes and PR #82 is merged.

---

## The north star — and why Stage 1 is not a detour from it

**Warwick's target (restated 2026-07-28): send Mum's list to ShopperBot and have the shopping sorted, without
disturbing him or Larry while other work is in flight.**

Stage 1 is deliberately the supervised foundation, but it is **daemon-shaped by construction** — becoming that
target is a change of *who runs one step*, not a rewrite:

- **Channel-neutral commands.** Telegram, Cockpit and any future scheduler invoke the SAME
  `services/asdair/pipeline/commands.js`. Nothing important lives in a callback handler.
- **Durable state, not session state.** Every stage reads its input from Postgres and writes its result there.
  The pipeline advances from durable state alone and never assumes the previous step ran in this process.
- **Deterministic core.** The normaliser, planner, identity resolver and reconciler need no model at all. Only
  vision transcription and bounded fuzzy assistance do, and those are one-shot calls through the existing
  gateway.
- **Resumable and idempotent.** Restart, redelivery and repeated taps are already no-ops by structural
  constraint, which is exactly what an unattended runner requires.

So the unattended path already exists for: intake, interpretation, planning, question-raising, recording,
reconciliation and learning. **The one genuinely supervised step is building the trolley in the live ASDA
session** — a singleton holding real money, with no public API — plus checkout and payment, which stay Warwick's
permanently.

**The honest gap to close for the north star** is therefore narrow and nameable: an unattended basket-build
runner that claims `asdair.browser_build_request` and drives ASDA, still stopping at checkout-ready. That is
Stage 2c and it stays deferred until Stage 1 is proven live — but nothing in Stage 1 needs undoing to get there.
