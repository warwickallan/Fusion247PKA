# BUILD-010 — Fusion Tower / Governance Mode

Internal Fusion247 build. Governance "air-traffic control" loop that removes Warwick as the manual relay between GPT/Codex, Larry (Claude Code) and reviewers.

- **[Control record](BUILD-010-control.md)** — outcome, WP0 scope, guardrails, acceptance, shared-dependency isolation. *(canonical)*
- **Architecture/**
  - `control-plane-schema.md` — run/turn/event model + state machine *(Silas)*
  - `dedup-and-timeout-contract.md` — dedup keys, self-loop ignore, 5-min watchdog, max-rounds *(Silas)*
- **services/fusion-tower/** — migrations + dispatcher + adapters *(implementation)*

**Status:** WP0 in progress (promoted from IDEA-010, 2026-07-17). Host: always-on Yoga. Durable state: Supabase `ftw` schema (operational only). Foundation: BUILD-002 WP0 (on `main`). No dependency on BUILD-002 WP1 merging.
