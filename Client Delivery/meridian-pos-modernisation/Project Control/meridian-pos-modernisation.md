---
name: Meridian POS Modernisation
engagement_id: MRG-POS-001
client_org: meridian-retail-group
client_contacts:
  - elena-vasquez
  - marcus-webb
linked_stakeholders:
  - person: elena-vasquez
    role: Client Sponsor
    influence: high
    cadence: weekly
  - person: marcus-webb
    role: Flagship Store Operations Lead
    influence: medium
    cadence: biweekly
status: active
engagement_type: fixed-price
start_date: 2026-04-01
target_end_date: 2026-10-31
actual_end_date:
owner: daniel-osei
tags:
  - pos-rollout
  - synthetic-engagement
---

# Meridian POS Modernisation

> **SYNTHETIC ENGAGEMENT.** Built entirely to validate [[GL-006-client-delivery-frontmatter-conventions]] and Warden's [[SOP-010-warden-extract-source-to-evidence-pack]] through [[SOP-014-warden-consultant-summary]] against a worked example, per Warwick's authorization scoped strictly to GitHub issue #16 ([[tsk-2026-07-12-002-synthetic-client-delivery-engagement-proof]]). **Meridian Retail Group, every person named in this engagement, every meeting, and every piece of evidence are invented for this exercise.** None of it describes any real client engagement, real client, real person, or real event this team has ever worked with. This exercise does not decide anything about GL-006's schema (that is issue #17, not yet authorized) — it only produces evidence.

## Problem & intent

Meridian Retail Group is replacing its in-store point-of-sale terminals across 40 stores with a new platform, to add offline-resilient transaction handling and centralized loyalty-data sync. The engagement covers discovery, a single-store pilot, and (pending pilot success) a phased fleet rollout.

## Who this is for

Meridian's store operations function, sponsored by Elena Vasquez (VP Store Operations). The direct beneficiaries are store staff (fewer failed transactions, less manual re-ringing) and Meridian's head-office reporting team (reliable, real-time sales data).

## Definition of done

All 40 stores running the new POS platform, sync failure rate under 0.5% fleet-wide over a full trading month, and Meridian's operations team signed off on the cutover for every store.

## Out of scope

Loyalty-program redesign, payment-processor renegotiation, and any store outside Meridian's existing 40-store US footprint (no international stores are in scope).

## Business case

Meridian's current till system loses an estimated 40-60 transactions per store per month to unrecoverable sync failures during peak trading, with no offline queuing. At Meridian's average basket value, this is a material, recurring revenue leak across 40 stores, on top of the staff time spent manually reconciling failed transactions. Modernising the POS platform removes the leak and gives head office reliable, near-real-time sales data for the first time.

## Stakeholders

- **Elena Vasquez** (client, VP Store Operations) — engagement sponsor, weekly cadence, final sign-off authority on Meridian's side. Directly accountable to Meridian's own leadership for the rollout's operational impact.
- **Marcus Webb** (client, Flagship Store Operations Manager) — runs the pilot store day-to-day, first to feel any pilot-stage defect, biweekly cadence.
- **Daniel Osei** (internal, Delivery Lead) — accountable owner on our side.
- **Priya Shah** (internal, Technical Lead) — owns hardware/network assessment and configuration/firmware work.

## Benefits realization

- 2026-07-08 — Too early to measure fleet-wide benefit; pilot store (Store #14) has run six consecutive weeks post-fix with a sync failure rate of 0.1%, against the 0.5% target — a leading indicator the modernisation addresses the transaction-loss problem named in the business case above, but not yet a fleet-wide realized benefit.

## Status update

- 2026-06-20 — Steering call held. Pilot stability confirmed (six weeks stable, 0.1% failure rate). Fleet go/no-go milestone proposed for mid-September. Data-migration cutover sign-off ownership raised again, still unresolved (see [[meridian-pos-modernisation-reg-005]]). Source captured and extracted: 1 register item created/updated ([[meridian-pos-modernisation-reg-005]]), pack linked ([[2026-06-20-steering-committee-call-notes-evidence-pack]]).
- 2026-05-06 — Client agreed to a two-week pilot stability-window extension following the sync-failure incident and fix. Source captured and extracted: 3 register items created/updated ([[meridian-pos-modernisation-reg-002]], [[meridian-pos-modernisation-reg-003]], [[meridian-pos-modernisation-reg-004]]), pack linked ([[2026-04-22-sync-failure-incident-email-thread-evidence-pack]]).
- 2026-04-10 — Pilot kickoff workshop held. Pilot store (Store #14) confirmed. Legacy-switch compatibility risk raised. Source captured and extracted: 1 register item created ([[meridian-pos-modernisation-reg-001]]), pack linked ([[2026-04-10-pilot-kickoff-workshop-notes-evidence-pack]]).
- 2026-04-01 — Engagement scoped and started.
