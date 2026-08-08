# PROPOSED Active Session Work Package — WP-B15-1: the interpretation-confirmation gate gets its production surface

**Status: PROPOSAL. Not active until Warwick's Step-5 decision. Prepared 2026-08-08 from Pax's
Step-2 investigation ([[Deliverables/2026-08-08-pax-b15-grounded-vision-investigation]]) and
Larry's live verification. One WP, as commissioned ("Asdair Build 001" §8 Step 3).**

## The earliest still-broken product link, and its proof

Every photo shop is created `needs_review = true`; `planOutcome` refuses READY_TO_SHOP until a
`confirmInterpretation` command clears it; **and no production surface can issue that command** —
the Telegram adapter deliberately has no confirm action, the live Cockpit asdair proxies are
read-only, and the only UI carrying a "Confirm this reading" button is the non-running Directus
`wp-d-proof` extension. The park writes no event and queues no card.

**Verified live 2026-08-08 (read-only):** shop 6 is `PROCESSING` + `needs_review=true`, and
`asdair.pipeline_command` contains **zero** confirm commands in its entire history. Shop 6 —
35 lines interpreted, all 11 questions answered, replanned — has been parked on this invisible
gate for five days. *(This corrects the bootstrap evidence's earlier attribution of the stall to
the packet seam: breaks 3–5 sit downstream of a state shop 6 never reached.)*

This is an **eighth break**, absent from the map's seven-break table — missed in 2026-08-04
because that audit enumerated module-caller wiring, and this gate is correctly wired in code.
**The lesson it carries: enumerate the human acts a journey requires, not only the module calls.**

## The outcome this WP delivers (the visible product event)

> After Mum's photo is interpreted, **Warwick receives ONE Telegram confirmation card on
> ShopperBot showing what was read — bound visibly to the exact source photograph — taps
> Confirm (or corrects), the gate clears, replan proceeds, and the shop reaches plan-ready with
> zero Larry involvement.** Shop 6 recovers through the same mechanism with no manual insert.

## Scope — three items, the third severable

1. **Production confirm surface** — a **self-healing, once-per-shop outbox card** queued at the
   `needs_review` park (so any parked shop, including shop 6, gets its card on the next poller
   pass), plus a `confirmInterpretation` action in the existing Telegram callback protocol.
   The command, latch, gate and replan already exist; this wires the one missing human surface.
   No new service, no new framework, no Cockpit change.
2. **Exact-source binding on the card (invariant C, wrong-week protection)** — capture an
   immutable image fingerprint at intake, carry it on the shop row, and render the card so it is
   unambiguous WHICH photograph produced the reading (received timestamp + fingerprint prefix +
   physical/interpreted line counts). Requires one forward-only migration — **authored in-repo
   with the migration-debt numbering reconciled against the three live-only tables, and applied
   to the live database only under Warwick's explicit authority at implementation time.**
3. **(SEVERABLE) Invariant D retention** — stop discarding Terra's catalogue-constrained
   candidate evidence: `realInterpretPhoto` (deps.js:178–182) currently strips
   `matched_regular_id` / `confidence` / `alternatives` / `status` before `resolveAll` re-solves
   from raw text. Carry the validated evidence through (the validation logic already exists in
   the diagnostic CLI `interpret-list.js`). Severable if Warwick prefers the narrower first slice.

## Acceptance — the real production event, not a manual invocation (CAPAE bar applies)

- A photo shop (or recovered shop 6) reaches plan-ready **through the live poller and a real
  Telegram tap**, zero Larry in the path; the confirmation card demonstrably shows the exact
  source binding; the park is self-healing (kill/revive proves the card re-queues, once).
- Wrong-week control from the acceptance corpus (commission mirror §11F): a stale photograph
  cannot be confirmed without the mismatch being visible on the card.
- Every physical line represented; no invented or silently dropped lines (corpus bar).
- Suites green **and** the real event exercised; "code committed and tested" is explicitly not
  completion (§ "Nothing may live only in Larry's head").

## Explicitly NOT in scope

Packet/handoff wiring (breaks 3–5) · the basket writer (break 4) · the inherited CI
integration failure (adapter↔planner contract — separate routed work) · Cockpit changes ·
resolving the BOB rule-10 contradiction (Warwick product question) · Favourites product intent ·
any new supervisor, registry or control plane.

## Open questions FOR WARWICK at Step 5 (not blockers to reviewing this proposal)

1. Does an **approved retained photograph** exist for the §11D "what Terra actually receives"
   demonstration, and which one is it? (None is named in any staged evidence; nothing was
   substituted.)
2. The **BOB contradiction** (inert rule 10 vs ACTIVE Arla BOB regular whose name says the
   household wants it): rule, regular, or both — your call, recorded once.
3. Item 3 (candidate-evidence retention): in this WP or deferred?
4. Migration application to the live household DB when item 2 reaches it: authorise then.
