---
name: Pilot Store Rollout - Flagship Store
engagement: meridian-pos-modernisation
wp_number: WP-002
owner: daniel-osei
status: in-progress
done_state: New POS terminals live and stable in flagship store (Store #14) for 14 consecutive trading days with sync failure rate under 0.5%.
target_date: 2026-08-01
actual_completion_date:
linked_register_items:
  - meridian-pos-modernisation-reg-002
  - meridian-pos-modernisation-reg-003
  - meridian-pos-modernisation-reg-004
tags:
  - pilot
  - synthetic-engagement
---

# Pilot Store Rollout - Flagship Store

> **SYNTHETIC.** GL-006 schema-validation proof.

## Scope of this work package

Install and stabilize the new POS platform in Store #14 (Michigan Avenue), Meridian's chosen pilot store, ahead of any decision to roll out to the remaining 39 stores.

## Acceptance / done-state

14 consecutive trading days with sync failure rate under 0.5%, following [[meridian-pos-modernisation-reg-004]]'s two-week stability-window extension.

## Dependencies

Depends on [[meridian-pos-modernisation-wp-001-discovery]]'s completion. [[meridian-pos-modernisation-wp-003-go-live-milestone]] depends on this work package reaching `done`.

## Status update

- 2026-06-20 — Six consecutive weeks stable at 0.1% failure rate, reported at the steering call. Comfortably inside the done-state target; work package remains open pending the full 14-consecutive-trading-day formal count and sign-off.
- 2026-05-06 — Client agreed to extend the pilot stability window by two weeks following the sync-failure incident ([[meridian-pos-modernisation-reg-002]]) and its fix ([[meridian-pos-modernisation-reg-003]]); tracked via [[meridian-pos-modernisation-reg-004]].
- 2026-04-22 — Critical sync-failure issue reported during peak trading hours in the first week of go-live.
