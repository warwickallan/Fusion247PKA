---
kind: issue
title: Unclear who owns data-migration cutover sign-off for full fleet rollout
engagement: meridian-pos-modernisation
status: open
severity: medium
raised_date: 2026-06-20
raised_by: elena-vasquez
owner:
target_resolution_date:
resolved_date:
linked_work_packages:
  - meridian-pos-modernisation-wp-003-go-live-milestone
source_ref: "[[Client Delivery/meridian-pos-modernisation/Sources (Immutable)/2026-06-20-steering-committee-call-notes]]"
evidence_type: unresolved-discussion
confidence: low
reread_flag: recommended
tags:
  - open-question
  - fleet-rollout
  - synthetic-engagement
  - open-question-demo
---

# Unclear who owns data-migration cutover sign-off for full fleet rollout

> **SYNTHETIC.** GL-006 schema-validation proof. **This item is the Open Questions workaround demonstration** — see `## Open-question workaround note` below.

## Description

Fleet rollout will require a one-time migration of each store's till/loyalty data onto the new POS platform. On the 2026-06-20 steering call, Priya Shah asked who signs off that a store's migrated data is correct before cutover; Elena Vasquez said she *believes* it's Meridian's IT team but was not certain, and nobody on the call could name an actual owner or process. This is the second time the underlying question of cutover sign-off has been raised without resolution — first at the 2026-04-10 kickoff (see [[meridian-pos-modernisation-wp-001-discovery]]'s linked evidence pack), again here. `evidence_type: unresolved-discussion` is correct: the source shows disagreement/uncertainty and no resolution was reached, not a stated fact. `confidence: low` and `reread_flag: recommended` follow directly from GL-006's own trigger list (low confidence on its own is a trigger).

## Impact

Without a named owner and process, the fleet rollout milestone ([[meridian-pos-modernisation-wp-003-go-live-milestone]]) cannot responsibly proceed to a go decision — a real, load-bearing blocker on the engagement's critical path, not a minor loose end.

## Reconciliation log

- 2026-06-20 — Question re-raised at steering call, still unresolved. No change from the 2026-04-10 kickoff workshop's version of the same open thread.

## Resolution

Open. Not yet resolved.

## Open-question workaround note (schema-validation finding, not a standard GL-006 body section)

This is the demonstration the task asked for: using `evidence_type: unresolved-discussion` on a Register Item to stand in for a discrete "Open Question" entity type GL-006 does not have.

**What fits cleanly:** `evidence_type: unresolved-discussion` genuinely does capture "this was discussed and not resolved" — as a classification of *how the item was established*, that part of the mapping works fine and required no distortion.

**What is lost by forcing this into `kind: issue` rather than a real Open Question entity:**
1. **This isn't really an "issue" in the same sense as [[meridian-pos-modernisation-reg-002]].** An issue is normally a problem that has already manifested (a sync failure that is happening). This is a genuinely different shape of thing — an *unanswered question blocking a future decision* — with no problem yet manifested. Filing it as `kind: issue` is the closest available fit, but it will sit in the same filtered view as real defects, diluting what "open issues" means when someone runs that filter.
2. **No `parked_with` / `unblocked_by` fields.** The live evaluation this proof was commissioned to test against (`Deliverables/2026-07-12-client-delivery-operational-schema-evaluation.md` §3, Open_Questions row) names exactly this gap in the abstract; this synthetic item makes it concrete: Elena said she'd "check internally," which is functionally "parked with Elena's IT team," and the real unblocking event is "Elena names an owner" — neither of those facts has anywhere to live except this prose paragraph. A future query for "which open questions are waiting on someone specific" cannot be run.
3. **No cross-reference back to the first time this exact question was raised.** The 2026-04-10 kickoff also surfaced this same question (see that source's Evidence Pack, `## Unresolved items`) but produced no Register Item at the time — there was nothing to link *to*. This item, created two months later, has no structured field pointing back to "this was first raised on 2026-04-10 and went unrecorded as a queryable item for two months" — that fact lives only in this prose and in the two Evidence Packs' own `## Unresolved items` sections, not in any frontmatter field on either item.
