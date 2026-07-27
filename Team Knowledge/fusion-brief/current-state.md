---
artefact: current-state
provenance: curated_snapshot (2026-07-26, Larry); amended 2026-07-27 (Nolan) — AsdAIr unparked per Warwick's ruling
owner_intent: DERIVE from live sources (git/processes/DB) as the system matures — this hand-snapshot is a
  stopgap until then; do NOT treat as permanent truth. Feeds A (self-model) in Arc's A+B+C brief.
note: small consumer artefact — one of several (see current-state, session-handoff, warwick-context.curated_seed).
---

# Fusion — current state (what is live / built / parked / broken)

**Live & running (on the Yoga / tailnet):**
- **Cockpit** v0.10.0 — standalone first-party app, `127.0.0.1:8090` fronted by Tailscale serve at
  `https://warwick-yoga.tailbc1fe3.ts.net:8443` (Warwick's front door). MERGED to main (#60).
- **Directus** — demoted to Larry back-office only (`:8074`); not Warwick-facing.
- **Model gateway** (LiteLLM) `100.101.240.85:4000` (OpenAI gpt-5.x; the box uses it). Ideation runs on
  Warwick's Anthropic Max sub via `claude -p` (Path A), NOT this gateway.
- **Capture gateway** (Telegram→Brain) live. **Brain**: LightRAG→Neo4j on fusion247-core (Hetzner/Coolify).
- **AsdAIr / household shopping** — **ACTIVE, unparked 2026-07-27** (Warwick's ruling). The weekly shop runs live;
  method rescued into [[SOP-021-run-the-weekly-asdair-shop]]; specialist **Asdair** (Household Shopping Steward)
  hired the same day. Larry still holds the browser drive; Warwick remains the payment/checkout gate.

**Built, on-branch (NOT merged):**
- **Idea-engine T1** (Transfer-Intelligence vertical) on `idea-016/idea-engine`: Mine runner (one Sonnet call),
  `idea_mine/candidate/event` schema (migration 270), SPIN-first Ideas surface, Larry-reconciliation, idea
  Keep/Later/Decline + Research-with-Pax. Proven on a real source. `suggestions.mjs` (graph-wide) preserved untouched.
- **AsdAIr durability repair** on `idea-012/asdair-durability-repair`: the outcome/learning writers
  (`services/asdair/outcome/`) and the missing `regulars` migration. **Not in the main tree until merged** — do not
  assume those paths exist.

**Parked:** Tower (build review, proven).

**Known gaps / broken:**
- [HIGH] Auto Cairn→learn pipeline exists but is NOT a running daemon — captures say "note next session".
- Research-with-Pax queues `researching` + logs, but does NOT yet auto-dispatch Pax→deliverable (the dPax piece).
- Stale self-model tables (`cockpit.build` Jul-22, `overall_state` Jul-21) — hand-maintained, lag reality.
- Cockpit can't be self-screenshotted by Larry's automation Chrome (tailnet) — Warwick is the visual check.

**Execution cost reality (Path A, logged every Mine):** ~138k tokens / ~$0.41 per Mine on the Max sub —
FACULTY ~18k vs Claude-Code WRAPPER ~128k (scales with source length). Low-volume human-triggered only.
