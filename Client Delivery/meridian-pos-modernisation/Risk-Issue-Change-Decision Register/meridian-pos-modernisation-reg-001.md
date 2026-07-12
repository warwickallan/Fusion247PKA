---
kind: risk
title: Store network hardware may be incompatible with new POS terminals
engagement: meridian-pos-modernisation
status: resolved
severity: high
raised_date: 2026-04-10
raised_by: priya-shah
owner: priya-shah
target_resolution_date: 2026-04-28
resolved_date: 2026-04-28
linked_work_packages:
  - meridian-pos-modernisation-wp-001-discovery
source_ref: "[[Client Delivery/meridian-pos-modernisation/Sources (Immutable)/2026-04-10-pilot-kickoff-workshop-notes]]"
evidence_type: inference
confidence: medium
reread_flag: recommended
tags:
  - hardware
  - discovery
  - synthetic-engagement
---

# Store network hardware may be incompatible with new POS terminals

> **SYNTHETIC.** GL-006 schema-validation proof.

## Description

Six of Meridian's forty stores, including the proposed pilot store (Store #14), run a switch model ("Halcyon NX-12") that Meridian's own IT team retired from its standard build three years ago. During the 2026-04-10 kickoff workshop, Priya Shah stated the new POS terminal's spec sheet does not explicitly confirm or deny compatibility with that switch model. **This item is `evidence_type: inference`, not `direct-statement`:** nobody in the source said the hardware *is* incompatible — Priya connected the dots (old switch model + no explicit compatibility confirmation = real risk worth flagging) rather than reporting a stated fact. Per [[GL-006-client-delivery-frontmatter-conventions]]'s reread-flag trigger list, `evidence_type: inference` on its own requires `reread_flag: recommended` or `mandatory` — set to `recommended` here.

## Impact

If the switch hardware is genuinely incompatible, the pilot store rollout (and five other stores sharing the same switch model) could face connectivity failures at go-live, on top of — and potentially compounding — any transaction-sync issues.

## Reconciliation log

- 2026-04-28 — [[meridian-pos-modernisation-wp-001-discovery]]'s assessment report (a firmware-level compatibility check, not a rereopening of the 2026-04-10 workshop transcript itself) confirmed the new terminals work with the Halcyon NX-12 switch model without additional hardware changes. Severity was `high` at raise time given the number of affected stores and the total unknown; downgraded to resolved rather than left open, since the underlying inference has now been tested and confirmed rather than merely assumed. The `reread_flag: recommended` on this item was satisfied by this assessment, not by a literal reread of the workshop transcript — worth noting explicitly since GL-006's reread doctrine describes rereading *the source*, and the actual resolution path here was independent technical testing, not a second pass over the same evidence.

## Resolution

Resolved 2026-04-28. Confirmed compatible via the discovery-phase hardware/network assessment; no hardware changes required. See [[meridian-pos-modernisation-wp-001-discovery]].
