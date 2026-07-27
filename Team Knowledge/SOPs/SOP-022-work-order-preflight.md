# SOP-022: Work Order Preflight

- **Status:** Active (created 2026-07-27, per Warwick's ruling after the IDEA-017 delegation experiments).
- **Applies to:** every worker or specialist instance executing a bounded Work Order.
- **Owner:** the executing worker. Larry owns the quality of the order itself.
- **This is not a review ceremony. It is the first phase of execution.** It should take minutes, not a round trip.

## Why this exists

Across Work Orders W01 and W02, **Larry supplied several incorrect assumptions**:

| Defect | What Larry asserted | Reality |
|---|---|---|
| Broken definition-of-done | `node --test youtube/` was the acceptance command | That form fails on this machine's Node — repo-wide, not caused by the change |
| Wrong env var | writers should read `ASDAIR_DB_URL` | That variable is contractually **SELECT-only**, specifically so a bug *cannot* write |
| Wrong datastore | (implicit) one database | There are **two**; `CONTROL_PLANE_DEV_DATABASE_URL` does not contain the `asdair` schema |

In each case the worker **challenged reality rather than following the order blindly**, and in each case that was
the correct outcome. One of them prevented an acceptance criterion being satisfied on a false green.

> **The dangerous assumption was never "workers might disobey Larry."** On the evidence, workers have repeatedly
> protected the outcome from mistakes in Larry's instructions. The operating model must therefore assure **both
> the execution and the quality of the Work Order that commissioned it.**

## The preflight

Before writing any implementation, verify the order against observable reality:

1. **Paths and files** — does everything the order references actually exist?
2. **Commands** — do the referenced commands actually run here? Run the acceptance command *before* trusting it as
   a gate. If it fails, establish whether it fails for an untouched neighbour too, which distinguishes "my change
   broke it" from "this order is wrong."
3. **Environment variables** — do they mean what the order claims? Check the authoritative contract for the
   variable, not just its name.
4. **Datastore, schema and environment** — **establish which actual database/schema/environment the job refers
   to** before implementing. Do not infer it from a variable name.
5. **Permissions** — do the permissions the work needs actually exist? A write path with no write grant is a
   blocker, not a detail to discover at the end.
6. **Internal consistency** — do the acceptance criteria contradict each other, or the stated scope?
7. **Authoritative contracts** — does the requested behaviour contradict a README, schema comment, SOP or
   `AGENTS.md`? Those outrank the Work Order.

## Outcomes

- **Order is sound** → proceed. Note anything checked that was non-obvious.
- **Order is materially wrong or ambiguous** → **REFUSE, ESCALATE, or return PARTIAL**, naming precisely what was
  wrong and what you verified.
- **Order is sound but a constraint is unmet** (e.g. a missing grant) → implement to spec, document the tension in
  the code, and report it. Do not silently invent a workaround.

**Never:**
- game an acceptance criterion to make it pass;
- silently rewrite Larry's intent;
- work around a contradiction without reporting it;
- treat "the order said so" as authority over an authoritative repo contract.

A correct refusal is a better result than a confident wrong guess. This is explicitly wanted behaviour, not
insubordination.

## Reporting

Preflight findings come **first** in the return, before the implementation report: what was checked, what held,
what did not. A preflight that found nothing wrong is still worth one line — it tells Larry the order was sound
rather than unexamined.

## For Larry

The mirror of this SOP: **preflight your own Work Order before issuing it.** Every defect above was avoidable by
running the command, reading the variable's contract, or confirming the datastore first. On current evidence the
Work Order deserves more scrutiny than the returned work does — which is what the research predicted, pointing at
the commissioner rather than the worker.

## References

- Ambiguity is the primary driver of fabricated success (measured 20–40× risk multiplier):
  `Deliverables/2026-07-27-pax-delegation-failure-modes.md`
- Return-contract discipline: `Deliverables/2026-07-27-nolan-engineering-hire-recommendation.md`
