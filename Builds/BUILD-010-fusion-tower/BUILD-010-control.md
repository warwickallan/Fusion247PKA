# BUILD-010 — Fusion Tower / Governance Mode (control record)

**Status:** Active — WP0 in progress. Promoted from IDEA-010 on 2026-07-17 (Warwick authority `LRY-IDEA-010-PROMOTE-BUILD-010-0001`).
**Host:** the always-on Windows Yoga (initial control-plane host).
**Durable state:** Supabase — *operational* control-plane state only, never canonical Brain (mirrors the BUILD-002 boundary doctrine).
**Foundation:** builds on **BUILD-002 WP0** (merged to `main` @ `9d59d7c`) — the Telegram + Supabase + config/secret/migration patterns. **No dependency on BUILD-002 WP1 merging** (see Shared dependencies).

## Product outcome

Remove Warwick as the manual relay between GPT/Codex, Larry (Claude Code), and reviewers. Target loop:

> Telegram command → governance run created → durable state/event in Supabase → GitHub/ClickUp change detected → the correct agent/runtime gets the next **bounded** turn → response posted directly to GitHub/ClickUp → state advances automatically → Warwick receives **only** READY / BLOCKED / TIMED OUT / DECISION REQUIRED.

## WP0 scope (smallest reusable governed slice — not a demo)

1. **Control-plane schema** (Supabase `ftw` namespace): governance runs, events, turns, expected responder, status, round limits, dedup, timeouts, terminal outcomes, evidence links. *(Silas — `Architecture/control-plane-schema.md`, migration `services/fusion-tower/migrations/0001`.)*
2. **Fusion Tower dispatcher** — Windows-owned (not Claude-session-owned), restart-safe, Supabase-backed, event-driven where practical + short-poll fallback, 5-minute dead-man watchdog, honest offline state.
3. **Larry adapter** — invoke Claude Code non-interactively; load only the bounded run context; preserve repo/worktree isolation; capture a structured result; post to the authorised channel; **never merge autonomously**.
4. **GPT/Codex adapter spike** — prove whether Codex can be invoked unattended as the GPT governance-controller role; load durable instructions + run state; inspect GitHub/ClickUp via authorised routes; return a structured **signed** result; **record the exact blocker** if unattended invocation is not yet possible. *(Pax feasibility brief first.)*
5. **Telegram controls** — start / pause / stop / approve / hold / status; **terminal notifications only**.
6. **GitHub/ClickUp event intake** — detect meaningful PR/check/comment/task changes; dedup by source event id + head SHA; ignore self-generated loops; bind each event to the correct run + expected responder.
7. **Guardrails** — scope lock; max review rounds; token/time budget; **no autonomous merge**; no destructive production action; no secrets in logs/state; explicit Warwick decision gates; signed agent identity **honestly labelled** (the GPT/Codex controller is OpenAI — never spoof xAI/Grok).

## WP0 acceptance proof

One real documentation or low-risk code PR completes the loop with **no manual relay by Warwick**: Telegram start → Tower creates the run → Larry performs a bounded turn → result lands in GitHub/ClickUp → GPT/Codex receives the review turn without Warwick copying text → review result lands → Tower advances state → Warwick gets **one** terminal Telegram notification. Manual relay fails acceptance.

## Shared dependencies (isolation declared)

- **Reuses (from `main`, already merged):** BUILD-002 WP0 Supabase project (`kerdinlgcfxnjrztwqde`), the Telegram bot/secret/config patterns, the migration + RLS-deny-by-default house style. These are on `main`; **BUILD-010 builds on `main` and needs no BUILD-002 branch merged first.**
- **Not depended on:** BUILD-002 WP1 (unmerged cloud-intake). BUILD-010's control plane is a *separate* Supabase schema (`ftw`) from the capture `fcg` schema; they coexist in one project without coupling.
- **Genuine future overlap (not WP0):** if the Tower later wants webhook-style GitHub/ClickUp ingress, it could reuse the WP1 edge-function pattern — a post-WP0 consideration, not a blocker.
- **Merge-order requirement:** none. BUILD-010 WP0 and BUILD-002 WP1 are independent branches; either may merge first.
- **Future control surface:** the Fusion companion app (later) becomes the richer control surface; Telegram is the WP0 control surface.

## Records

- Canonical build record: `Builds/BUILD-010-fusion-tower/`
- Architecture: `Architecture/control-plane-schema.md`, `Architecture/dedup-and-timeout-contract.md` (Silas)
- Reviewer contract: [[fusion-tower-operating-instructions]] — the GPT/Codex reviewer role (identity, pointer-inputs, method, output). The [[codexAdapter]] reviewer prompt follows it.
- Host runbook + Codex dependency status: [[tower-host-runbook]], [[dependency-status]] (Mack)
- Live Codex review (spike deliverable, 2026-07-17): [[codex-review-draft-2026-07-17]] — one Tower-owned, read-only, signed turn (verdict `request_changes`); NOT posted to ClickUp (bounded write not yet authorised). Raised **F-MED** (DB CHECK enforces provider vocabulary, not the per-principal binding) — follow-up migration for Silas.
- Security (Vex WP0 delta review, 2026-07-17): `Security/wp0-security-review-2026-07-17.md` — **GREEN-WITH-CONDITIONS** (0 CRITICAL, 1 HIGH, 1 MEDIUM, 1 LOW); no committed secret, no autonomous-merge path, honest identity locked, RLS deny-by-default; gated live actions: migration-apply YES, dispatcher-live YES-with-conditions, open-PR YES, live-acceptance YES-with-conditions.
- Foundry provenance (IDEA-010 rationale + rejected options): retained in ClickUp (Foundry register), marked Promoted → BUILD-010.
