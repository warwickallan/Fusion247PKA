---
name: Fleet Rollout Go-Live Milestone
engagement: meridian-pos-modernisation
wp_number: WP-003
owner: daniel-osei
status: not-started
done_state: Go/no-go decision made and communicated to all 40 stores for full fleet rollout.
target_date: 2026-09-15
actual_completion_date:
linked_register_items:
  - meridian-pos-modernisation-reg-005
tags:
  - milestone
  - schema-workaround-demo
  - synthetic-engagement
---

# Fleet Rollout Go-Live Milestone

> **SYNTHETIC — and a deliberate schema-fit test.** This "work package" is really a milestone (a date-bound decision checkpoint), forced into the Work Package shape because GL-006 has no discrete Milestone entity. See `## Workaround note` below for exactly what is lost by doing this, written for this proof, not part of the standard body-section convention.

## Scope of this work package

There is no real "scope of work" here in the sense every other Work Package in this engagement has one (a defined set of tasks someone executes). This entry exists only to hold a date and a go/no-go decision gate for the full 39-store fleet rollout, contingent on the pilot's success.

## Acceptance / done-state

A go/no-go decision is made, and — per Elena Vasquez's explicit request on the 2026-06-20 steering call — communicated to all 40 store managers, not only the pilot store's manager.

## Dependencies

Depends on [[meridian-pos-modernisation-wp-002-pilot-rollout]] reaching `done`. Depends on [[meridian-pos-modernisation-reg-005]] (data-migration cutover sign-off ownership) being resolved before the fleet rollout that follows this milestone can actually begin — the milestone itself is just the decision gate, not the migration work.

## Status update

- 2026-06-20 — Milestone gate proposed for mid-September at the steering call; not yet formally scheduled or authorized as a project checkpoint (no formal record of "milestone committed to" beyond this prose entry — see workaround note below).

## Workaround note (schema-validation finding, not a standard GL-006 body section)

Attempting to represent a milestone as a Work Package surfaces concrete loss, not just a documentation nicety:

1. **`owner` means the wrong thing here.** On every other Work Package in this engagement, `owner` is the person accountable for *executing* a defined scope of work. A milestone doesn't have an executing owner in that sense — it has a **committer** (whoever's authority the go/no-go date and decision actually rest on, arguably a joint Elena/Daniel steering-committee call, not one person). Naming Daniel as `owner` here is the closest available field, but it silently misrepresents a shared governance decision as one person's individually-owned deliverable.
2. **`done_state` is being asked to describe two different things at once** — the *decision itself* being made, and the *separate act* of communicating it to 40 stores. A real milestone schema would want these as two distinct, separately-trackable facts (decision made vs. decision communicated); jammed into one `done_state` string, "made and communicated" reads as one event, but Elena's own request on 2026-06-20 makes clear these could slip independently (a decision could be made on 2026-09-15 and communication could lag by days without a fixed status to catch that).
3. **No conditional/dependency logic.** A real milestone is often explicitly conditional ("go" only if the pilot's 14-day stability run holds, and only if the cutover sign-off question is resolved) — GL-006 gives no structured way to express "this milestone is contingent on these named conditions" beyond free-text prose in `## Dependencies`, which nothing enforces or checks.
4. **No distinction from a superseded/cancelled Work Package.** If Meridian instead decided to abandon fleet rollout entirely, this entity would sit at `status: cancelled` indistinguishable in kind from any other cancelled unit of work — there's no way to query "milestones that were missed" separately from "work packages that were cancelled," because a milestone isn't tagged as a different *kind* of thing at all, only as a `tags: [milestone]` label that carries no schema weight (nothing validates or requires it).
