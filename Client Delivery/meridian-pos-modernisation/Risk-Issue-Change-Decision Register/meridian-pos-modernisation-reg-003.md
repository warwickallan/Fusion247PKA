---
kind: change
title: Add offline transaction queuing to POS terminal firmware
engagement: meridian-pos-modernisation
status: resolved
severity:
raised_date: 2026-04-24
raised_by: priya-shah
owner: priya-shah
target_resolution_date: 2026-05-15
resolved_date: 2026-05-04
linked_work_packages:
  - meridian-pos-modernisation-wp-002-pilot-rollout
source_ref: "[[Client Delivery/meridian-pos-modernisation/Sources (Immutable)/2026-04-22-sync-failure-incident-email-thread]]"
evidence_type: agreed-decision
confidence: high
reread_flag: not-required
tags:
  - configuration
  - firmware
  - synthetic-engagement
  - config-change-demo
---

# Add offline transaction queuing to POS terminal firmware

> **SYNTHETIC.** GL-006 schema-validation proof. **This item is the Configuration Change fit-test** — see `## Configuration-change fit note` below.

## Description

Following the sync-failure issue ([[meridian-pos-modernisation-reg-002]]), vendor Zentra Systems confirmed firmware v3.2 adds offline transaction queuing (failed syncs are held locally and retried, rather than dropped). Priya Shah proposed applying v3.2 to all six pilot-store terminals; Daniel Osei explicitly authorized it by email on 2026-04-24 ("Agreed — please proceed"), which is what makes `evidence_type: agreed-decision` correct here rather than `suggested-option`.

## Impact

Removes the root cause of [[meridian-pos-modernisation-reg-002]]. No infrastructure change required — the fix runs on Store #14's existing network segment.

## Reconciliation log

- 2026-05-04 — Deployed to all six terminals on 2026-05-02; zero sync failures logged over the following two trading days. Marked resolved.
- 2026-04-24 — Change authorized by Daniel Osei.

## Resolution

Resolved 2026-05-04. Firmware v3.2 deployed and validated stable.

## Configuration-change fit note (schema-validation finding, not a standard GL-006 body section)

This item is the exercise the task asked for: "use `kind: change` and note whether its generic shape holds up against a real configuration change's actual shape (e.g. system/environment details)."

**What a real configuration change actually needed to record, that this schema has no field for:**
- **System/component:** POS terminal firmware, vendor Zentra Systems, version 3.1 → 3.2.
- **Environment:** Store #14's existing network segment, VLAN 40 (named explicitly in the source email — Priya's 2026-04-24 message).
- **Change window / rollout mechanics:** applied to all six pilot terminals on a specific date (2026-05-02), not a range or a "when convenient" note.
- **Made by / applied by:** Priya Shah personally deployed it (distinct from `owner`, which here happens to be the same person, but would not always be — a change's `owner` is the accountable decision-owner, not necessarily the hands that actually apply it).

**Where all of that actually lives today:** entirely in this note's prose (`## Description`, this section), because Register Item's frontmatter has exactly the same six fields regardless of whether `kind` is `risk`, `issue`, `change`, or `decision` — there is no `system`, `environment`, or `applied_by` field scoped to `kind: change`. That means none of the above is queryable, filterable, or structurally distinguishable from a `change` item that has no environment details at all — a future query like "show me every configuration change touching VLAN 40" or "every change vendor Zentra Systems made" has no field to run against; it would have to grep body text and hope the environment happened to get written down in prose, which it did here only because this is a deliberate schema-validation exercise designed to test exactly this. This directly corroborates the evaluation's `adapt` disposition for Config_Changes (`Deliverables/2026-07-12-client-delivery-operational-schema-evaluation.md` §3) with a second, concrete, synthetic data point, independent of the earlier live-engagement evidence that evaluation drew on.
