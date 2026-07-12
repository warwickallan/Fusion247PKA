---
kind: decision
title: Approve two-week pilot stability-window extension to absorb sync-failure diagnosis and fix time
engagement: meridian-pos-modernisation
status: accepted
severity:
raised_date: 2026-05-02
raised_by: daniel-osei
owner: daniel-osei
target_resolution_date: 2026-07-18
resolved_date: 2026-05-06
linked_work_packages:
  - meridian-pos-modernisation-wp-002-pilot-rollout
source_ref: "[[Client Delivery/meridian-pos-modernisation/Sources (Immutable)/2026-04-22-sync-failure-incident-email-thread]]"
evidence_type: agreed-decision
confidence: high
reread_flag: not-required
tags:
  - pilot
  - synthetic-engagement
  - action-mapping-demo
---

# Approve two-week pilot stability-window extension to absorb sync-failure diagnosis and fix time

> **SYNTHETIC.** GL-006 schema-validation proof. **This item is the Actions-mapping workaround demonstration** — see `## Action-mapping attempt` below.

## Description

Elena Vasquez explicitly agreed, by email on 2026-05-06, to extend the pilot's stability-window done-state by two weeks, given the time lost diagnosing and fixing [[meridian-pos-modernisation-reg-002]]. Daniel Osei confirmed the same day. `evidence_type: agreed-decision` is correct here — Elena's email states "I'm comfortable agreeing," an explicit sign-off, not a trending discussion.

## Impact

[[meridian-pos-modernisation-wp-002-pilot-rollout]]'s target date moves from an implicit earlier date to 2026-08-01. The engagement's overall timeline pressure toward the November peak season increases correspondingly.

## Reconciliation log

- 2026-05-06 — Decision confirmed by both parties by email. Status set to `accepted`.

## Resolution

Accepted 2026-05-06. Pilot stability window extended by two weeks; [[meridian-pos-modernisation-wp-002-pilot-rollout]]'s `target_date` updated accordingly.

## Action-mapping attempt (schema-validation finding, not a standard GL-006 body section)

Per [[SOP-010-warden-extract-source-to-evidence-pack]] §7's documented workaround ("treat an action item as either a `decision` register item's own follow-through... or a Work Package's `target_date`"), the actual follow-through action buried in this exchange is: **"Daniel to notify Elena and the flagship store team of the revised pilot timeline"** — Elena's own words: "please make sure the flagship store team and I are kept posted on the revised date." That action is mapped here onto this decision's `owner` (`daniel-osei`) and `target_resolution_date` (set to 2026-07-18, a placeholder date standing in for "before the next steering update," since the source names no exact date — itself a small extra distortion worth naming: the mapped `target_resolution_date` is doing double duty as both "when the decision itself was targeted to resolve" and "when the follow-through notification should happen," two different facts forced into one field).

**What this workaround concretely loses, demonstrated rather than just cited:**
1. **Only one action fits.** The same email thread actually implies at least two distinct follow-through actions — "notify the client/store team of the revised timeline" (Daniel's) and, implicitly, "update the pilot work package's own target date to reflect the extension" (which I did separately, by hand, in [[meridian-pos-modernisation-wp-002-pilot-rollout]]'s frontmatter). A decision's single `owner`/`target_resolution_date` pair cannot carry two actions arising from the same decision — the second one had to be handled as an entirely separate, manual, undocumented cross-reference rather than a tracked item in its own right.
2. **No distinct status for the action versus the decision.** The decision's own `status` is `accepted` — that's a fact about the decision, not about whether Daniel has actually notified anyone yet. There is no way to mark "the notification action itself is done" without either leaving the decision's `status` alone (so the action's completion is invisible) or repurposing the decision's status field to mean something it was never designed to mean.
3. **No action-specific title.** A query for "what does Daniel still need to do" cannot be run — this schema has no action title, only the decision's own title ("Approve two-week pilot stability-window extension..."), which does not read, on its own, as an action item at all. Anyone scanning open register items by title would not find "notify client of revised timeline" anywhere.
4. **`target_resolution_date` is overloaded, not just borrowed.** Setting it to 2026-07-18 (an invented stand-in date, since the source gives no exact deadline) means this field can no longer answer "when was this decision itself supposed to resolve" (it resolved 2026-05-06, four days after being raised) versus "when is the mapped action due" — both claims now live in one field, and the true resolution date had to be recorded separately in `resolved_date` instead, which happens to work here only because a decision item already has both fields; a genuinely different action-only entity would not need two purposes forced onto one date field like this.
