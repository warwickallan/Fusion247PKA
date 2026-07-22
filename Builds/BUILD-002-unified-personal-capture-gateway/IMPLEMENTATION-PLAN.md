---
build_id: BUILD-002
title: Unified Fusion Hub — Implementation Plan
pack_version: v1.0-draft
doc_role: plan
lifecycle_state: draft_pending_warwick_approval
author: Larry
owner_and_final_approver: Warwick
canonical_readable_record: GitHub (this file)
approval_pack:
  - BUILD-BRIEF.md
  - BUILD-CONTRACT.md
  - IMPLEMENTATION-PLAN.md (this file)
tags:
  - build-002
  - unified-fusion-hub
  - implementation-plan
---

> **Larry's concrete technical delivery approach** for the resumed BUILD-002 Unified Fusion Hub.
> Reads with [[BUILD-BRIEF]] (the narrative) and [[BUILD-CONTRACT]] (scope, non-goals, the nine
> acceptance criteria AC1–AC9). This plan does **not** authorise implementation — Warwick approves
> the three-document pack first. WP1 (Obsidian) and WP2 (YouTube) start only once approval is
> durably recorded.

# BUILD-002 — Implementation Plan

## 0. Reconciled starting point (what already exists — verified, not assumed)

BUILD-002 is **not a greenfield build**. The durable spine and every specialist core are already merged on `main`. This plan is an **integration + thin-worker** effort, not a rebuild.

| Merged component | What it already gives us | Location |
| --- | --- | --- |
| **Capture gateway** (the hub spine) | Telegram intake, durable saga: `fcg.capture_envelope`, `fcg.raw_object` (immutable), `fcg.processing_state` (leases/retry/dead-letter), `fcg.evidence_pointer`, `fcg.idempotency_key`, `fcg.channel_identity`, `fcg.channel_poll_offset`. 101 tests, live-proofed. | `services/fusion-capture-gateway/` |
| **TubeAIR** | Deterministic YouTube URL parse + caption extraction, full **timestamped** transcript, immutable RAW preservation, Karpathy packet, Cairn handoff, hardened watcher (idempotent/atomic/anti-hammer). | merged core + `tools/tubeair/` |
| **AsdAIr** | `asdair` schema, raw-list normaliser (`needs_review`), deterministic basket planner, no-auto-substitute / no-checkout guarantees. | `services/asdair/` |
| **Control plane + cockpit** | Tower QA, live Directus, `cockpit.*` projection schema, the **write-back seam** (`command_request` intent → trusted worker applies + receipt), self-healing Directus supervisor + reboot recovery. | `services/control-plane/` |
| **Cairn** | Semantic categorisation, related-note discovery, justified-backlink decisions. | `.claude/agents/cairn.md` |
| **Governed Brain / vault** | The canonical Markdown corpus Obsidian will open. | `PKM/`, knowledge dirs |
| **WP0 (this pack)** | `cockpit.build_contract` + `cockpit.contract_command` approval seam (least-privilege verified). | `db/mypka/060–070` |

**Consequence for the plan:** the "unified hub" is mostly the **fcg spine + a router + thin specialist workers + Directus projections**. We add a routing step and per-specialist workers; we do **not** re-implement intake, idempotency, transcript extraction, planning, or the Directus/write-back machinery.

## 1. Target architecture (concrete)

```
Telegram (DevBot / ShopperBot)  ─┐
forwarded email (fixture/live)  ─┼─► fcg intake  ─►  ROUTER  ─►  specialist job (durable, leased)
voice note                      ─┘   (envelope +     (deterministic     │
Directus command  ──────────────────► raw_object,    classification,    ├─► TubeAIR worker  ─► RAW (immutable) ─► Karpathy packet
                                       correlation)    then A/B/C card    │                    ─► knowledge-note template ─► Cairn categorise + backlinks
                                                        if ambiguous)     │                    ─► learning candidates
                                                                          ├─► AsdAIr worker (shopper route)
                                                                          ├─► Cairn/Brain intake (DevBot default)
                                                                          └─► Larry/Tower (command route)
                                                                                      │
   evidence_pointer(s) ◄── every worker writes markdown path / note path / packet path / card id
                                                                                      │
   projections ──► Directus (youtube_source page, learning_candidate Accept/Decline, receipts)
              └──► Telegram card (honest status + links)   └──► Obsidian/Markdown note (ai_created)
```

**Load-bearing invariants (inherited from the fcg saga, extended per specialist):**
- Supabase intake is the durable commit point; workers claim by lease and recover after lease expiry.
- Canonical writes (Markdown/note) are **idempotent** (check target/evidence before writing) — restart never double-writes; duplicate delivery (same `video_id`) never double-creates.
- `completed` is set **only after evidence exists**; Telegram/Directus are **retryable projections**, never the source of truth.
- Transient failure → bounded autonomous retry → `dead_letter`; an exhausted item never hammers YouTube.

**One writer abstraction for notes.** A single `VaultWriter` interface with two adapters: **Obsidian Local REST API** (production authority) and **filesystem** (test/recovery). Idempotency + provenance rules live in the interface, not the adapter, so there is exactly one write authority. Obsidian unavailable ⇒ job stays queued + reports degraded state honestly; the input is never lost.

## 2. Reuse map (do NOT rebuild)

- **Intake / idempotency / leases / dead-letter** → `fcg.*` as-is; add a `route` + a specialist-job representation (a new `fcg.specialist_job` table, or a `route`/`specialist` column on `processing_state` — chosen at WP2 build time by which keeps the saga tests green with least change).
- **Transcript extraction / packet** → TubeAIR core, invoked, never reimplemented.
- **Shopping normalise/plan** → AsdAIr core, invoked.
- **Directus projections + write-back intent seam** → the `cockpit.*` pattern from WP0 / the merged `command_request` seam; learning Accept/Decline and Directus→Larry commands are the **same intent→worker→receipt shape**.
- **Semantic filing / backlinks** → Cairn (subagent), not a new classifier.

## 3. WP → commit sequence, with dependencies and migrations

Each WP is a **vertical slice** ending in a visible proof + independent review. `[S]` = must be serial (hard dependency); `[P]` = parallelisable via worktree-isolated subagents.

| WP | Slice | New migrations / code | Depends on | Visible acceptance proof (AC) |
| --- | --- | --- | --- | --- |
| **WP0** | Contract pack + Supabase + Directus approval | `db/mypka/060–080` | verified `main` | ✅ this pack, version/hash-bound; approval-apply worker (AC1) |
| **WP1** | Obsidian install + secure localhost API + `VaultWriter` | Yoga install; secret in store; `VaultWriter` (obsidian + fs adapters) | `[S]` after approval | read/search/write/open a test note; outage queues; recovery (AC2) |
| **WP2** | YouTube URL → RAW → note → Directus → Telegram | `fcg` router + specialist_job; TubeAIR invoke; `cockpit.youtube_source`; note via `VaultWriter` | `[S]` router+schema before worker; note-write `[S]` after WP1's writer, but extraction+packet+note-gen `[P]` against fs adapter meanwhile | real URL end-to-end; duplicate + restart proofs (AC3, AC6) |
| **WP3** | Suggested-learning Accept/Decline loop | `cockpit.learning_candidate` + intent→worker apply | `[S]` after WP2 (candidates exist) | Directus Accept/Decline → durable governed decision (AC4) |
| **WP4** | Directus → Larry safe command + Telegram A/B/C | reuse contract_command shape; A/B/C on `fcg` decision | `[P]` with WP3 (independent seam) | one safe command + one A/B/C answer, both durable (AC5) |
| **WP5** | Shopper route (AsdAIr) | ShopperBot facade + controlled `asdair` write via intent | `[P]` with WP3/WP4 (own specialist) | photo/text/voice list → plan card; no auto-substitute (AC7-adjacent) |
| **WP6** | Bounded email + voice adapters | email **fixture** adapter; voice preserve+transcribe | `[P]` — email fixture-first (no human dep); live mailbox deferred | one email/fixture + one voice, metadata preserved (AC8) |
| **WP7** | Restart / duplicate / exact-head Codex merge QA | test harness + merge packet | `[S]` last | all reliability proofs green; Codex `READY_TO_MERGE` at exact head (AC6, AC9) |

**Migration discipline:** all live Supabase migrations are additive + idempotent + reversible via `teardown.sql`, applied to the same MyPKA project (no new project, no cross-DB federation). Directus field/collection scans require a supervisor restart (self-healing) — a serial, single-instance step.

## 4. Tests & visible acceptance proofs

- **Dev/synthetic substrate first:** every worker + migration is proven on a throwaway Postgres (the existing `run-migration-test.sh` harness pattern, 19/19) and synthetic fixtures before any live touch.
- **Executed, not asserted:** proofs are CI-run subtests that fail on zero (banked lesson) — duplicate-delivery, restart-mid-processing, outage-queue, dead-letter, no-false-completion.
- **Real end-to-end** (AC3) with a genuine YouTube URL once WP1+WP2 land, captured as evidence (RAW path, note path, packet path, Telegram card id, Directus link).
- **Regression fence:** TubeAIR / AsdAIr / gateway / control-plane suites stay green; no private data in the public repo; no canonical note silently overwritten.
- **Independent review** (Codex + Fable) per slice before it counts as done; Codex merge QA at the exact head before merge.

## 5. Delivery workflow — what is OPTIMAL for Larry/Opus

This is the part that most shapes throughput, so it is explicit.

### 5.1 Waterfall vs Agile — use both, deliberately

- **Waterfall only at the human gates.** Two serialisations are *imposed by governance*, not by the tech: (1) **pack approval before substantial build**, (2) **merge to main**. These are the only genuinely waterfall moments. I minimise their count and **batch decisions** into them rather than dripping many small gates.
- **Agile / vertical everywhere else.** Inside an approved scope I work in **thin vertical slices** (WP1…WP7), each independently proven and reviewed. This matches the banked "walking-skeleton-first" lesson, de-risks each seam early, and gives Warwick a **visible working result every session** instead of a big-bang reveal. Horizontal/waterfall layering ("all schemas, then all workers, then all UI") is explicitly rejected — it delays visible value and couples review into one unreviewable lump.

### 5.2 What I (Larry/Opus) can do autonomously — the critical path I own

Author code/docs/migrations; run tests on dev/synthetic substrate; commit/push; open/update PRs; apply **additive** Supabase migrations to the live MyPKA project; register Directus collections + restart the self-healing supervisor; run workers against synthetic data; spawn **worktree-isolated** subagents for independent modules; run the Codex/Fable review loop. None of this needs Warwick in the loop.

### 5.3 Human dependencies that HALT me (and how each is de-risked)

| # | Hard gate (only Warwick can clear) | De-risk / sequencing |
| --- | --- | --- |
| 1 | **Pack approval** (now) | Batched into one approval of the three-doc pack. |
| 2 | **Merge to main** | Always Warwick; sequenced last (WP7), one decision. |
| 3 | **Tailscale login** on the Yoga (phone access) | Desktop `127.0.0.1:8074` works without it; phone access is a *review-convenience*, not a build blocker — kept off the critical path. |
| 4 | **Live mailbox credential** (email route) | Email is built **fixture-first** (contract-allowed). Live creds become a *separate* late, optional switch — never blocks WP2–WP5. |
| 5 | **Obsidian desktop install / admin clicks** | Install is authorised; scripted where possible; the `VaultWriter` **fs adapter** lets all note-generation logic be built + proven *before* Obsidian is confirmed, so the install can't stall the critical path. |
| 6 | **Directus admin credential** (stale) | In-app render verification + a fresh admin are Warwick's to set; the build is verified at the DB/grant layer meanwhile. |
| 7 | **Genuine A/B/C intent decisions** | Asked only when a safe human choice is cheaper than a guess; batched onto cards, never mid-critical-path blockers. |

### 5.4 When halted, what I switch to (a standing "non-blocked backlog")

The rule: **no human stall is ever allowed to idle the critical path** — every anticipated gate has parallel work queued behind a *different* dependency.

- **Stalled on pack approval (now):** I do **not** pre-empt WP1/WP2 (your instruction). Legitimate switch-to work: independent Codex/Fable review of the WP0 seam itself, evidence/docs hygiene, the dev-substrate test harness scaffolding that is generic (not YouTube/Obsidian implementation), and memory/session-log upkeep. If none remain, I **stop and wait** rather than manufacture scope.
- **Stalled on Tailscale / live mailbox / Obsidian install (later):** switch to any slice that doesn't need that dependency — YouTube extraction+packet+note-gen against the fs adapter, the learning-candidate extractor, the Directus projection config, the command/AB-C seam, the test harness, review packets. These are deliberately sequenced so a stall on one never blocks the others.

### 5.5 Linear vs parallel — the concrete cut

- **Must be serial `[S]`:** approval → build; router+specialist-job schema → YouTube worker; a slice's build → its independent review; live migrations to the same schema (never concurrent); Directus supervisor restarts (single-instance); anything mutating the **shared working tree** (banked lesson — parallel file-mutating agents *must* use worktree isolation).
- **Safely parallel `[P]`** (worktree-isolated subagents, disjoint files): the YouTube worker vs the Directus projection vs the learning-candidate extractor; test fixtures + the outage/duplicate/restart harness vs the worker; documentation/evidence capture; and **independent review dimensions** (correctness / security / reliability) run concurrently. WP4/WP5/WP6 are independent specialist seams and can progress in parallel once WP2's spine exists.
- **Usage-aware pacing:** the Codex/Fable loop is expensive (Fable especially, with availability risk) — review weight matches slice stakes, and merges are natural pause points.

### 5.6 One-paragraph summary

Serialise **only** the two governance gates (approval, merge) and the genuine tech dependencies (schema-before-worker, writer-before-note-write, build-before-review, live-migration/Directus-restart single-threading). Parallelise everything else through worktree-isolated subagents. Sequence human-gated slices late or fixture-first so a human stall never blocks the critical path, and keep a standing non-blocked backlog behind a different dependency for every anticipated gate. Deliver thin vertical slices with a visible proof each session, batch human decisions, and let independent review gate each slice before merge.

## 6. Risks & genuine Warwick decisions

- **R1 — Obsidian API reliability on the Yoga** (Directus already boots intermittently here). Mitigation: `VaultWriter` fs adapter + queue-not-lose + the supervisor/startup pattern already proven for Directus. *No decision needed.*
- **R2 — YouTube caption availability / rate limits.** Honest handling of no-captions / private / deleted / rate-limited; never hammer. *No decision needed.*
- **D-1 (Warwick):** live mailbox choice + credential for the *live* email route (fixture route needs nothing). **Deferred, optional.**
- **D-2 (Warwick):** whether phone (Tailscale) access is wanted for this build's reviews, or desktop is enough for now.
- **D-3 (Warwick):** review intensity per slice (usage vs assurance) — default: match to stakes.

## 7. Deliberate exclusions (this delivery)

Autonomous merge; Asda checkout/payment; auto-substitution; automatic permanent learning without approval; full email client; native app; full Health/CareerAIr; second Brain/duplicated vault; public/LAN/tailnet Obsidian API exposure; paid Obsidian Sync/Publish; uncontrolled plugins; generic multi-user platform; rebuilding any merged core; replacing the BUILD-014 control plane; retiring ClickUp; backlink spam; low-value stubs.

## 8. Proposed stopping point

Stop when: the three-doc pack is approved + version/hash-bound; Obsidian + localhost API operational (AC2); the YouTube walking skeleton passes end-to-end incl. duplicate + restart (AC3, AC6); learnings Accept/Decline works (AC4); Larry receives durable Telegram + Directus decisions/commands (AC5); bounded Shopper/email/voice routes meet AC7/AC8; and Codex returns `READY_TO_MERGE` at the exact head (AC9). Health, CareerAIr, browser-shopping and native-app work are separate authorised slices.
