---
# Identity
id: tsk-2026-07-10-001
title: "Fold Fusion247 Brain / Project ManagAIr doctrine into myPKA's Warden (Client Delivery)"

# Ownership & priority
assignee: warden
priority: 2

# Status (mirrors folder location)
status: in-progress
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-10T19:15:00Z
updated: 2026-07-10T19:15:00Z
due: null

# Provenance
created_by: larry
source: user session — Fusion247Brain repo review, 2026-07-10
parent: null

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops:
  - SOP-001-how-to-add-a-new-specialist
linked_workstreams: []
linked_guidelines:
  - GL-002-frontmatter-conventions
  - GL-006-client-delivery-frontmatter-conventions
linked_my_life: []
linked_session_logs:
  - 2026-07-10-19-05_silas_client-delivery-schema
linked_journal_entries: []
linked_deliverables:
  - 2026-07-10-project-implementation-specialist-hire-research

# Tagging
tags: [client-delivery, warden, fusion247-brain, governance, multi-session]
---

# Fold Fusion247 Brain / Project ManagAIr doctrine into myPKA's Warden (Client Delivery)

## What this is

The user built a working business/client-delivery governance system by hand in a prior tool ("Fusion247 Brain," ChatGPT-orchestrated, Google Drive-based) — proven live on a real client project (Bellrock / BRK-NPL-001, NPL Concerto implementation). He wants the underlying knowledge and process — not the literal files — absorbed into myPKA as a properly hired specialist and supporting SOPs/Guidelines, kept structurally separate from personal PKM, without breaking myPKA's own rules (no hand-edited `AGENTS.md`, additive-only, SSOT). This is a multi-session build — the user has explicitly asked for a running record of decisions and a visible step-by-step plan, because his prior workflow required manually maintaining build docs with ChatGPT. This task **is** that record; update it every session rather than starting a new tracking doc.

## Context one click away

- Hire procedure: [[SOP-001-how-to-add-a-new-specialist]]
- Schema: [[GL-002-frontmatter-conventions]], [[GL-006-client-delivery-frontmatter-conventions]]
- Most recent context: [[2026-07-10-19-05_silas_client-delivery-schema]]
- Working artifacts:
  - [[2026-07-10-project-implementation-specialist-hire-research]] (Pax's hire research brief)
- Source repo (read-only reference, not migrated wholesale): `warwickallan/fusion247brain`, cloned at `/workspace/fusion247brain` this session — re-clone if a future session needs it again.

## Decisions log

Durable decisions made on this build, in order. Append, never rewrite history — if a decision is superseded, add a new line saying so rather than editing the old one.

1. **2026-07-10 — Hire a new specialist rather than expand an existing one.** No current specialist owned business/client-delivery project governance; `PKM/My Life/Projects` is personal-only and stays that way. Research via Pax, contract drafted by Nolan per SOP-001.
2. **2026-07-10 — Name: Warden, role: Delivery Manager.** Chosen from Pax's candidates (Atlas, Crane, Warden, Keel). No roster collision. Approved by user.
3. **2026-07-10 — New top-level root `Client Delivery/`, sibling to `PKM/` and `Team Knowledge/`, not nested under `PKM/`.** User explicitly wants business projects structurally separate ("separate dashboard to Tom's personal life stuff"). Validated after the fact: the user's own Fusion247 Brain PRD §8.9 ("Split Brains / Domains") had already anticipated this separation independently.
4. **2026-07-10 — `Client Delivery/` entities get a sibling Guideline (`GL-006`), not an extension of `GL-002`.** GL-002's own extension path assumes a new `PKM/` folder; `Client Delivery/` is deliberately outside PKM. GL-006 inherits GL-002's mechanical rules (snake_case, ISO dates, slug-FK convention) by reference, never duplicates them. Approved by user.
5. **2026-07-10 — Three entity types for v1: Engagement, Work Package, Register Item.** Register Item combines risk/issue/change/decision via a `kind` field rather than four separate entity types — matches Warden's own "single combined register" language literally. Engagement note *is* the Project PRD. Write-and-Verification Log and Support Handover explicitly deferred (no schema yet). Whether `Client Delivery/` ever joins a SQLite mirror is deferred, not defaulted into `SOP-002`.
6. **2026-07-10 — Nothing gets copied verbatim from Fusion247 Brain.** Every contract/Guideline/SOP re-derives the underlying principle in myPKA's own voice and layering (agent = identity/boundaries only; procedure → SOP; shared rule → Guideline; output shape → Template; recurring multi-agent flow → Workstream). This mirrors a refactor the user's own Fusion247 Brain had independently proposed (`F247.proposal.agent-skill-boundary-refactor`, 2026-07-09) before this task started.
7. **2026-07-10 — Reconciliation pass triggered mid-build.** User surfaced two more source documents from the live Fusion247 Brain: an overnight 12-phase build proposal from "Fusion" (ChatGPT) re-architecting the Bellrock project folder taxonomy, and a QA verdict on it from "Fable" (a manually-run Claude instance acting as external QA — not a myPKA agent). Fable's verdict: the proposal's principles are sound (source-tier precedence, evidence/confidence/reread-flag discipline, one-evidence-pack-not-three-VTT-rereads) but it drops the `Project Control` folder without explicitly re-homing six artifacts (business case, project brief, comms plan, benefits log, stakeholder register, document register) that a prior cleanup had fought to preserve. Fable also caught **live governance drift already happening in Fusion247 Brain itself**: a duplicated/parallel register branch, a write logged only in a project-local manifest (not the Brain's own Session Log) sitting at `pending_verification`, and an apparently-deleted (not archived) README. This is Fusion's/the user's live Drive state, out of reach and out of scope for myPKA to fix directly — but it is the negative worked example for a hard rule going into Warden's contract: never fork a register, verification never comes from the writer, every write logs centrally.
8. **2026-07-10 — Sequencing: schema enrichment now, four-skill SOPs after a second engagement exists.** Per the user's own Fusion247 Brain PRD §11.2/§15.8 ("Markdown folders before databases," "avoid sharpening the axe forever") — land the source-tier doctrine + evidence/confidence fields + the six-artifact homes into GL-006 now; build the four meeting-intelligence skills (Meeting Prep, Configuration Guide, Meeting Summary, Consultant Summary) as Warden SOPs once there's a second real workload to prove the schema isn't over-fit to Bellrock. **User overrode this on 2026-07-10: the four skills are not overkill (user saw the actual risk-register output quality from the Fusion247 Brain pilot) — build them now, not deferred.** Superseding decision — see Updates.

## Success criteria

- `GL-006` carries the source-tier precedence doctrine, evidence/confidence/reread-flag fields on Register Item, and explicit homes for all six artifacts Fable flagged (business case, project brief, comms plan, benefits log, stakeholder register, document register).
- Warden's contract carries the "never fork a register / writer never self-verifies / writes log centrally" hard rule, citing the live Fusion247 Brain incident as the worked negative example.
- The four meeting-intelligence skills exist as Warden-owned SOPs (`SOP-01x`), each with source priority, transcript-reread rules, output structure, and a QA/anti-embellishment checklist — built from the "Yet another bloody build doc" spec, re-derived in myPKA's voice, not copied.
- This task file stays the single running decisions log + step-by-step plan for the whole buildout across every future session, until the buildout is done and it closes per `SOP-close-task`.

## Updates

- 2026-07-10 19:15 (larry) — created. Captures everything decided in this session so far (decisions 1-8 above) as the durable record the user asked for.
