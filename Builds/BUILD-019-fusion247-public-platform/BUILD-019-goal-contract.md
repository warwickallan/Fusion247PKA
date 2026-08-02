---
name: BUILD-019 — Fusion247 Public Platform
owner: larry
authority: warwick
promoted: 2026-08-02
promoted_from: IDEA-019 (Fusion247 Public Platform — Website, Channels & Publishing Surfaces)
tags: [build, public-platform, fusion247-web, idea-019]
---

# BUILD-019 — Fusion247 Public Platform

The **promotion record**. The durable route, fog, dependencies and evidence live in the Wayfinder map —
this file is deliberately thin and points at it. Per the SSOT rule, nothing material is restated here.

> **Wayfinder map (the source of truth for this build):**
> [[Deliverables/2026-08-02-build-019-public-platform-wayfinder-plan]]

## Provenance

| | |
|---|---|
| Promoted from | **IDEA-019 — Fusion247 Public Platform: Website, Channels & Publishing Surfaces** (Foundry, status *Converging*) |
| Promoted at | Fusion247PKA `7163a32` (`origin/main`, the integration base for this build's branches) |
| Promoted on | 2026-08-02, on Warwick's explicit instruction |
| Promotion authority | Warwick's product-and-governance decision of 2026-08-02: *"Promote IDEA-019 to BUILD-019 and create the complete Wayfinder implementation plan before any implementation begins."* |
| Why now | The public estate — domains, DNS, repository, Vercel project — is already purchased and configured, but has no build record, no route and no durable governance home. The canonical domain serves a 404 because the repository is empty. The gap is a website and its destination adapters, not more setup. |

## North star

> **A durable, credible and extensible Fusion247 Public Platform that gives Warwick one professional public
> website and correctly owned, recoverable publication destinations for written and video content — accepting a
> versioned Publication Package and returning durable Publication Receipts, independently of who supplies it.**

BUILD-019 owns the **Public Platform and destination side** of the wider content-production programme. It
preserves the agreed boundary with VlogOps (IDEA-006) and ScoutAIR (IDEA-020) rather than absorbing their
internals, while fully mapping every interface and dependency required to reach the programme North Star.

The programme North Star itself, the exact product boundary, the three publication outputs and the VlogOps /
ScoutAIR interfaces are recorded once, in the Wayfinder map §1–§4.

## What is NOT duplicated here

The idea, its rationale and its live setup record stay where they are:

- **Boundary, goal contract and acceptance** — Google Drive `IDEA-019 — … Promotion & Wayfinder Ingestion Pack — 2026-08-02.md` (`1sjw87PZMaWSsVUPZetOmrf0xHCQDIU5g`)
- **Live setup state** — Google Drive `Fusion247 Public Platform — Brand, Website & Channel Decisions` (`1-HkjVwLEoOoQddZOa1ETB2nMlJAfDJ2ItHvG27J4EAk`)
- **The three-build split** — Google Drive `2026-08-02 — Foundry — VlogOps, Public Platform & ScoutAIR — Durable Backup.md` (`1TxdOJKCY3IRVNyncc1gRGOhW2Qv5F2S2`)
- **Foundry canonical pages** — ClickUp doc `2kxuxw3a-732`, IDEA-019 root page `2kxuxw3a-6652`; Idea task `869ectn03`
- **VlogOps interface authorities** — ClickUp pages `2kxuxw3a-6592`, `2kxuxw3a-6612`, `2kxuxw3a-6632`
- **The route, fog, dependencies, acceptance and phase status** — the Wayfinder map above

## Existing assets — verify, never recreate

Confirmed live on 2026-08-02 (evidence in the Wayfinder map §5):

- Domains `fusion247.co.uk`, `fusion247.uk`, `fusion247.ai` — purchased, DNS configured, canonical routing and all defensive 308 redirects verified working.
- Repository **`warwickallan/fusion247-web`** — exists, public, `main`, contains only `README.md`.
- Vercel team `Fusion247`, project **`fusion247-web`** — live and serving; the 404 at the canonical domain is Vercel's own `NOT_FOUND`, because the repository has no application in it.
- YouTube channel creation for **Human in the Poop** — started, identity review last recorded pending.
- X account **`@Fusion247AI`** — created.

**Do not buy domains again. Do not create another `fusion247-web` repository or Vercel project. Do not create
duplicate YouTube channels while a creation/review may be in flight. Do not create a second X account.**

## Status

**Phase 0 (promotion and mapping) complete. No implementation has begun**, per Warwick's standing rule that no
Wayfinder implementation plan means no build. The current phase, gate and exact next action are held in the
Wayfinder map's `🔻 STATUS` block, which is the only place they are maintained.
