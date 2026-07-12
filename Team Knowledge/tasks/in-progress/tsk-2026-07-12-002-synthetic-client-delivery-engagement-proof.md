---
# Identity
id: tsk-2026-07-12-002
title: "Build a synthetic/redacted Client Delivery engagement to validate GL-006 and Warden's SOPs"

# Ownership & priority
assignee: silas
priority: 1

# Status (mirrors folder location)
status: in-progress
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-12T19:30:00Z
updated: 2026-07-12T20:00:00Z
due: null

# Provenance
created_by: larry
source: Warwick's explicit authorization, 2026-07-12, scoped strictly to GitHub issue #16 only — "Proceed with the smallest useful synthetic worked example needed to validate the current GL-006 Client Delivery structure and relevant Warden SOPs... This authorization applies only to issue #16. It does not authorize issue #17 or any permanent schema change."
parent: tsk-2026-07-11-002

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops:
  - SOP-010-warden-extract-source-to-evidence-pack
  - SOP-011-warden-meeting-prep
  - SOP-012-warden-configuration-guide
  - SOP-013-warden-meeting-summary
  - SOP-014-warden-consultant-summary
  - SOP-019-fusion-delivery-tracking
linked_workstreams: []
linked_guidelines:
  - GL-006-client-delivery-frontmatter-conventions
  - GL-009-public-private-knowledge-boundary
linked_my_life: []
linked_session_logs:
  - 2026-07-12-19-30_silas_synthetic-client-delivery-engagement-proof
linked_journal_entries: []
linked_deliverables:
  - 2026-07-12-client-delivery-operational-schema-evaluation

# Tagging
tags: [client-delivery, warden, schema, synthetic-engagement, idea-003, wp1, gl-006]
---

# Build a synthetic/redacted Client Delivery engagement to validate GL-006 and Warden's SOPs

## Context one click away

- Procedure: [[SOP-010-warden-extract-source-to-evidence-pack]], [[SOP-011-warden-meeting-prep]], [[SOP-012-warden-configuration-guide]], [[SOP-013-warden-meeting-summary]], [[SOP-014-warden-consultant-summary]], [[SOP-019-fusion-delivery-tracking]]
- Guideline: [[GL-006-client-delivery-frontmatter-conventions]], [[GL-009-public-private-knowledge-boundary]]
- Working artifacts:
  - [[2026-07-12-client-delivery-operational-schema-evaluation]] — the evaluation this proof directly tests (§6's recommended next proof, in substance; this task builds the synthetic engagement §8 said the whole recommendation depends on)
  - `Client Delivery/meridian-pos-modernisation/` — the synthetic engagement itself (fictional "Meridian Retail Group"/"Meridian POS Modernisation," code `MRG-POS-001`; one Engagement, three Work Packages, five Register Items covering all four kinds, three synthetic Sources + Evidence Packs)
- Touched by: [[2026-07-12-19-30_silas_synthetic-client-delivery-engagement-proof]]
- Parent: [[tsk-2026-07-11-002-migration-closure-audit-remaining-blockers]] — this task resolves that task's long-tracked "confirmed merge blocker": one real or synthetic `Client Delivery/` engagement to validate GL-006/Warden's schema.
- GitHub: issue #16 (`[IDEA-003][WP1] Synthetic/redacted Client Delivery engagement proof`), tracked via `fusion-build`/`idea-003`/`wp-01`/`type-delivery` labels; branch `idea-003/wp1/869e3mw1z-synthetic-engagement-proof`.
- ClickUp: task `869e3mw1z` (list WP1, folder IDEA-003).

## What this is

Warwick's explicit, narrowly-scoped authorization to build the smallest useful **entirely synthetic/redacted** Client Delivery engagement needed to test GL-006's actual schema and Warden's actual SOPs against a worked example — the exact validation gate `tsk-2026-07-11-002` has tracked as a confirmed merge blocker since 2026-07-11, and the proof [[2026-07-12-client-delivery-operational-schema-evaluation]] §6 recommended.

**This is not authority to add permanent schema, build SQLite/Cockpit/controlled actions, or touch issue #17 (the later schema-acceptance decision).** This task produces evidence only.

## Required content (per Warwick's authorization, verbatim scope)

Build one synthetic Engagement under `Client Delivery/` with:
- One synthetic Engagement (entirely fictional organisation/people — never NPL, never Bellrock, never any real client name or detail)
- At least two Work Packages
- Representative Register Items covering all four kinds: risk, issue, change, decision
- Evidence/source references (`Sources (Immutable)/INDEX.md`, at least one synthetic captured source, `source_ref` used on Register Items)
- Realistic ownership, dates, and status handling across the above
- Explicit exercise of the current documented mappings/gaps for: Actions (SOP-010/011's "action = a decision's own follow-through" workaround), Milestones (no home at all — genuinely new gap per the evaluation), Open Questions (`evidence_type: unresolved-discussion` workaround), Configuration Changes (`kind: change`, generic fit)
- Explicit demonstration of the current write-and-verification limitation (GL-006 "Known gaps" #1 — no `created_by`/`review_status`/`reviewed_by`/`reviewed_date` fields exist; show what this looks like in practice, don't just cite it)

## Hard boundaries — do not

- Add any permanent field or entity type to GL-006. If a gap is evidenced, record it as a finding — do not schema it in.
- Build SQLite tables, Cockpit views, or any controlled-write/action layer.
- Create or populate a real NPL engagement, or use any real NPL people, meetings, evidence, contractual details, or operational data.
- Let synthetic data read as if it could be live operational data — label it as synthetic prominently and use an obviously fictional organisation/engagement name.
- Touch GitHub issue #17 or authorize/imply any schema-acceptance decision.

## Required output

- The synthetic engagement itself, fully built per GL-006's actual folder map (read it directly, don't take this task's summary as complete) and Warden's actual SOP-010–014 conventions.
- A findings note (as part of the session log / PR description) recording: what worked cleanly against the existing schema, what required an awkward workaround (with the specific evidence, e.g. "Action X had to be represented as a decision's `owner`/`target_resolution_date` because no Action entity exists — here's exactly how that looked and what was lost"), and what genuine schema gaps this exercise evidenced beyond what the evaluation already named.
- A short recommendation of what issue #17 (schema decision) should weigh — this task does not decide anything, it hands over evidence.

## Success criteria

- Synthetic engagement exists, builds cleanly against GL-006's actual schema (verified directly, not assumed).
- All four Register Item kinds represented with realistic frontmatter.
- Actions/Milestones/Open-Questions/Configuration-Changes workarounds and the write-and-verification limitation are all concretely exercised, not just described abstractly.
- Zero real client data anywhere in the committed content — verified directly (grep for NPL, Bellrock, Concerto, and any other real identifiers before commit).
- No GL-006 edit, no SQLite/Cockpit file touched, no issue #17 content decided.
- Lands on `idea-003/wp1/869e3mw1z-synthetic-engagement-proof`; PR opened, linked to issue #16 and ClickUp task `869e3mw1z`; not self-merged.

## Updates

- 2026-07-12 19:30 (larry) — created, per Warwick's explicit authorization scoped to GitHub issue #16 only. Dispatching to Silas with instruction to read GL-006 and Warden's SOPs directly rather than relying on this task's summary.
- 2026-07-12 20:00 (larry) — Silas delivered the synthetic engagement (`Client Delivery/meridian-pos-modernisation/`). Verified directly, not on Silas's summary alone: read the Engagement note, the write-and-verification demo item (reg-002), the Action-mapping demo (reg-004), the Milestone-workaround demo (wp-003), and the Sources index in full; confirmed GL-006/SOP-002/Cockpit untouched via `git status`; re-ran the zero-real-data grep myself across every created file (one legitimate hit found — meta-commentary in the session log naming the real engagement's approved code, `NPL`, in a methodology comparison, not client data — left as-is per GL-006 v1.5's own naming-convention ruling that the code itself is not sensitive). Quality is genuinely high: every workaround is concretely demonstrated with specific evidence, not asserted abstractly, and every hard boundary (no GL-006 edit, no ad-hoc frontmatter keys, no SQLite/Cockpit touch, no real NPL data, no issue #17 decision) was respected, including one place (reg-002) where Silas started to add an ad-hoc `created_by`/`reviewed_by` field, caught itself against its own no-invented-keys rule and this task's boundary, and backed out — documenting the attempt in prose instead. Committed; PR being opened against issue #16 next.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
