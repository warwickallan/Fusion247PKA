---
kind: issue
title: Pilot store transaction sync failures during peak trading hours
engagement: meridian-pos-modernisation
status: resolved
severity: critical
raised_date: 2026-04-22
raised_by: marcus-webb
owner: priya-shah
target_resolution_date: 2026-05-06
resolved_date: 2026-05-04
linked_work_packages:
  - meridian-pos-modernisation-wp-002-pilot-rollout
source_ref: "[[Client Delivery/meridian-pos-modernisation/Sources (Immutable)/2026-04-22-sync-failure-incident-email-thread]]"
evidence_type: demonstrated
confidence: high
reread_flag: not-required
tags:
  - incident
  - pilot
  - synthetic-engagement
  - write-and-verification-demo
---

# Pilot store transaction sync failures during peak trading hours

> **SYNTHETIC.** GL-006 schema-validation proof. **This item is the write-and-verification demonstration** — see `## Write-and-verification attempt` below.

## Description

From the first week of go-live, Store #14 experienced repeated transaction sync failures during lunch-rush peak load (roughly 12-1:30pm), across three separate days. `evidence_type: demonstrated`, not merely `direct-statement`: Priya Shah confirmed the defect directly from terminal logs (firmware v3.1 has no local offline queue — a failed sync call drops the transaction rather than retrying it), not just from Marcus's verbal report of symptoms.

## Impact

Lost sales data, manual re-ringing of transactions by cashiers, and — left unresolved — a direct threat to the pilot's ability to reach its done-state stability target before any decision to roll out to the other 39 stores.

## Reconciliation log

- 2026-05-04 — Firmware v3.2 (adds offline transaction queuing) deployed to all six Store #14 terminals on 2026-05-02. Zero sync failures logged over the following two trading days. Marked resolved.
- 2026-04-24 — Fix (firmware v3.2) authorized by Daniel Osei; deployment scheduled pending vendor release.
- 2026-04-23 — Root cause confirmed via terminal logs.

## Write-and-verification attempt (schema-validation finding, not a standard GL-006 body section)

This item is the concrete demonstration the proof was asked to produce for GL-006's documented "Known gap" #1 (no `created_by` / `review_status` / `reviewed_by` / `reviewed_date` field on Register Item).

**What actually happened, in real terms:** Priya Shah is both the person who *wrote* this Register Item (she diagnosed the defect and authored the extraction from the email thread) and the person who *marked it resolved* four days later, after deploying her own fix. Nobody else reviewed or verified the resolution before status moved to `resolved`.

**What I tried, concretely, to record that:** I attempted to add `created_by: priya-shah` and `reviewed_by: <someone-other-than-priya>` to this file's frontmatter, to at least show the intent even if no one had actually reviewed it. I stopped, because per Silas's own operating rule ("NEVER invent ad-hoc YAML keys... if a field doesn't exist in GL-006, edit GL-006 first") adding those keys here — even for a demonstration — would itself be exactly the violation this proof is supposed to surface, not paper over. **This task's hard boundary also explicitly forbids editing GL-006 to add them.** So the only place left to record any of this is prose, right here, in a body section GL-006 does not define a convention for.

**What that actually looks like, concretely — the gap made visible:**
- Nothing in this file's frontmatter says who wrote it. A reader (or a future query) has to trust the prose above, which is not machine-checkable, is easy to omit by accident, and is not required by any validation this schema runs.
- Nothing in this file's frontmatter says who — if anyone — reviewed the `resolved` status change. `status: resolved` moved from `open` to `resolved` in one field-level edit, with zero structural trace of who approved that transition.
- Warden's Critical rule 8 ("writer never self-verifies") is violated in substance here — Priya wrote and closed her own item — and **nothing in this schema would catch that**, today or on any future item. The only way anyone would ever notice is by reading this exact prose paragraph, which exists solely because this is a deliberate schema-validation exercise. On a real item, in a real fast-moving incident, this paragraph would almost certainly never get written.
