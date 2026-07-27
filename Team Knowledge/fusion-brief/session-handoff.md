---
artefact: session-handoff
provenance: curated (2026-07-27, Larry) — compact next-session resume, NOT a transcript
owner_intent: consumed by the next Larry session + Arc's A+B+C assembly. Supersede on next close.
---

# Next-session handoff (resume here)

## Where we are (terminal state, 2026-07-27)

The **idea-intelligence layer is COMPLETE, proven, reviewed, and locked** — merged to **main = `d0ad341`**,
live on the cockpit DB (`kerdinlgc`).

- **Arc** (Transfer Intelligence — generation) and **Mason** (Opportunity Synthesis — the convergent PM faculty)
  are **instantiated as real bound subagents** (`.claude/agents/arc.md`, `mason.md` + Team contracts + index)
  and **proven end-to-end**: real source → Arc → 3 provenance-bearing production atoms in the register → Mason
  → coherent opportunities. Every atom accounted, provenance traced, boundary held, no regression.
- **Mason v1** live: durable atom register (`cockpit.idea_atom`, CONTENT-hash keyed), coherence-gated synthesis,
  Opportunities lane in the cockpit, cross-run disposition persistence (Warwick's Keep/Later/Decline survives
  re-synthesis; conflict only on genuine disagreement).
- **Independent review:** Fable (Warwick-authorised substitute for Codex) reviewed T1/T2 generation + Mason
  code → all blockers fixed + re-confirmed READY.
- **Render-check gate** exists (`services/cockpit/render-check.mjs`) after an outage caused by serving
  un-render-checked cockpit assets — see memory `cockpit-serves-from-worktree-render-check`.

**The one deferral:** the cockpit **visual** check on Warwick's device is **owner-deferred** (not failed).
No material provisional implementation/QA items remain.

## What the NEXT session is about

**Promote Larry from primary builder → engineering ORCHESTRATOR, and stand up the build team
(Larry Builder Delegation).** Design already delivered, review-pending:
`Deliverables/larry-builder-delegation-DESIGN.md` — delegation loop, builder authority/tools, what Larry retains
exclusively, evidence-not-assertions reporting, and the smallest single-loop proof (delegate a bounded `--dry-run`
task end-to-end). **NOT yet GO to build** — Warwick + GPT review first.

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
- Arc runs `mine-ideas.mjs` (T1) / `t2-calibrate.mjs` (T2); Mason runs `mason-synthesise.mjs`; register seeded by
  `mason-backfill.mjs`; shared writer `atom-register.mjs`.
- Cockpit: `services/cockpit/server.mjs` (node server.mjs; tailnet `:8443` via Tailscale serve). Render-check
  before ANY cockpit UI change.
- Ding Warwick on handback: `node --env-file=C:/.fusion247/fusion-capture-gateway.env C:/.fusion247/larry-ding.mjs <msgfile>`.

## How to resume

A fresh Larry reads its memory + this handoff + `current-state.md` + `Deliverables/BACKLOG.md` +
`warwick-context.curated_seed.md`. Fusion should know itself from these, not from Larry's remembered context.
