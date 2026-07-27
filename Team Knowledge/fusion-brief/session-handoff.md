---
artefact: session-handoff
provenance: curated (2026-07-27, Larry) — compact next-session resume, NOT a transcript
owner_intent: consumed by the next Larry session + Arc's A+B+C assembly. Supersede on next close.
---

# Next-session handoff (resume here)

## Where we are (terminal state, 2026-07-27 — end of session)

The **entire YouTube Source-Intelligence → Arc → Mason intelligence layer is COMPLETE, proven, independently
Codex-reviewed via Tower, and merged. Larry is PROMOTED.** Final **main = `87c7ff69`** (Arc code at `ae1ccf6`).

- **BUILD-002 Source Intelligence** — automated Cairn note (headless Sonnet reads the RAW → standalone knowledge
  note; drop-a-URL-get-a-brief-you-can-trust). MERGED `db026c82` (PR #66), live. 16/16 veins on `vJEy3nP2_C8`,
  stands-alone reader test, Audi + air-fryer fixtures. See [[build-002-unified-hub-wp0]].
- **Arc quality correction** — Arc now reads a FACTUAL source-core (SI note minus the "What this means for
  Fusion247"/"Actions" interpretation), broad transfer domains (T2 F1-F6 incl. reputation/career + strategic-
  warnings), obvious≠discard admission rule, deterministic tier (rich→T2 divergent, favour recall). Proven on
  `vJEy3nP2_C8`: **3 atoms → 24** (24/24 verbatim-verified, 15/16 veins), Mason 92-atom estate → 5 surfaced
  (every atom accounted, no landfill). **Independent Codex merge-QA via TOWER** (`mergeCheck.mjs`, 3 rounds
  f2ce5878/78928b70/9bf43627): 2 real code fixes folded (TQA-001 neo4j `--env-file-if-exists`; TQA-003
  `substanceLength()` fallback) + `arc.test.mjs` 7/7 → **APPROVE @ `02fd974`**, merged PR #70. Arc had merged
  before the Codex gate → recorded as a governance sequencing exception; gate now satisfied at the exact head.
  See [[idea-engine-agent-architecture]], [[codex-qa-is-a-tower-capability]].
- **Codex QA is a TOWER capability** (canonical, [[codex-qa-is-a-tower-capability]]) — never route Codex to
  Warwick manually because it isn't on Larry's shell PATH; run `mergeCheck.mjs`.

**Deferrals (none material):** cockpit **visual** check on Warwick's device = owner-deferred; TQA-004 (operating-
model excluded from Tower's staged diff) = non-blocking tracked follow-up. No material provisional/QA item remains.

## What the NEXT session is about

**Builder Team work** — Larry is promoted (engineering ORCHESTRATOR, not default builder). Stand up the build team
(Larry Builder Delegation): design at `Deliverables/larry-builder-delegation-DESIGN.md` — delegation loop, builder
authority/tools, what Larry retains exclusively, evidence-not-assertions reporting, smallest single-loop proof
(delegate a bounded `--dry-run` task end-to-end). Confirm scope/GO with Warwick before building.

## Locked decisions (durable — do NOT re-litigate)

- **THE IDEA ENGINE IS NOT A BACKLOG GENERATOR** — product = a small set of coherent, evidence-backed
  opportunities; atoms are evidence/substrate, not auto work-items. Weak/emerging/standalone stay durable +
  inspectable without demanding attention.
- **Roles (canonical: `Deliverables/fusion-operating-model.md`):** Arc (generate) · Mason (synthesise) ·
  Pax (research) · Silas (architecture) · Larry (orchestrator/quarterback, NOT default builder) ·
  Warwick (strategic authority + BUILD auth). Lifecycle: source→atoms→Mason→opportunity→Warwick interest→Pax→
  brief→Larry impl plan→Warwick GO→delegated build→QA→merge.
- **Path A execution** unchanged: Sonnet via `claude -p` on Warwick's Max sub; no API key / no OpenAI-LiteLLM swap.
- **Fable HARDLOCK:** only on Warwick's explicit per-use yes (Codex is default reviewer; Fable the substitute).
- **Governance gates:** merge-to-main, live-apply, Fable use = Warwick's explicit yes. Larry commits/pushes
  otherwise. Never serve un-render-checked cockpit assets live.

## Runtime pointers

- Live cockpit DB writer: `DATABASE_URL` in `C:/.fusion247/fusion-capture-gateway.env` (→ kerdinlgc). Dev sandbox:
  `CONTROL_PLANE_DEV_DATABASE_URL` in `control-plane-dev.env`.
- Arc entrypoint = `arc.mjs` (reads source-core, tiers, drives `mine-ideas.mjs` T1 / `t2-calibrate.mjs` T2 engines,
  persists atoms; cockpit "Mine" → `/api/mine` fires it with `--env-file-if-exists=neo4j.env`). Mason runs
  `mason-synthesise.mjs`; register seeded by `mason-backfill.mjs`; shared writer `atom-register.mjs`. Codex merge-QA
  = Tower `services/control-plane/tower-loop/mergeCheck.mjs` ([[codex-qa-is-a-tower-capability]]).
- Cockpit: `services/cockpit/server.mjs` (node server.mjs; tailnet `:8443` via Tailscale serve). Render-check
  before ANY cockpit UI change.
- Ding Warwick on handback: `node --env-file=C:/.fusion247/fusion-capture-gateway.env C:/.fusion247/larry-ding.mjs <msgfile>`.

## How to resume

A fresh Larry reads its memory + this handoff + `current-state.md` + `Deliverables/BACKLOG.md` +
`warwick-context.curated_seed.md`. Fusion should know itself from these, not from Larry's remembered context.
