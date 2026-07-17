---
agent_id: mack
session_id: build-010-wp0-fusion-tower
timestamp: 2026-07-17T12:08:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# BUILD-010 WP0 — Fusion Tower core + synthetic E2E proof (Mack)

Built the whole WP0 governance control-plane runtime in the isolated worktree
`C:\Fusion247PKA-b010` (branch `build-010/wp0-fusion-tower`), on top of Silas's
`ftw` schema (migration 0001) and Pax's research brief. Never touched
`C:\Fusion247PKA` (BUILD-002's worktree). Did NOT push — Larry pushes.

## What shipped (services/fusion-tower/)

1. **config.js** — env-by-name + secret masking (fcg house style); DATABASE_URL
   core (fixtures mode when absent) + gated adapter creds that fail-closed.
2. **store** — memoryStore + postgresStore over the identical surface; pgSslConfig
   verify-full pinned-CA. All dedup/idempotency/watchdog/max-rounds invariants.
3. **dispatcher.js** — run/turn state machine, central guardrails, 5-min watchdog
   (retry-within-budget or terminal), decision gates, terminal-only notices.
4. **larryAdapter.js** — `claude -p --output-format json` headless, scoped tools,
   NO merge tool, HMAC-signed honest envelope, fail-closed blocker.
5. **codexAdapter.js** — exact `codex exec` shape (signer gpt_codex = openai-codex,
   honest); fail-closed recorded blocker (no codex on host, never installs/spends).
6. **telegramControls.js** — start/pause/stop/approve/hold/status, allowlist +
   private-chat, terminal-only notifier, synthetic outbox (no live long-poll).
7. **eventIntake.js** — GitHub/ClickUp normalize + dedup + self-loop + routing,
   ETag conditional GitHub poll (live gated).
8. **tower.js / watchdog.js / host/*.ps1 / tower-host-runbook.md** — announce-
   don't-launch NSSM + Scheduled-Task registration + 5-min independent watchdog.
9. **tests + proof** — 71 no-DB + 14 real-Postgres (throwaway scoop PG17 cluster)
   all green; synthetic E2E proof PASSED.

## Load-bearing verifications

- **`claude` IS invocable headless** on this host (2.1.212). Proved a real bounded
  JSON turn: `result`/`session_id`/`usage` parse exactly as the Larry adapter
  expects. The synthetic E2E ran a REAL Larry turn end to end.
- **`codex` is NOT installed** (not on PATH) and no OpenAI key present → the Codex
  adapter records the exact blocker and fails closed. Honest label held.
- Real-Postgres suite required a **clean Windows-only child PATH** for pg_ctl —
  the msys shim PATH crashes forked backends with STATUS_DLL_INIT_FAILED
  (0xC0000142). Fix: `PATH="<pgbin>:/c/Windows/System32:/c/Windows" pg_ctl ...`.
  Worth remembering for any future throwaway-cluster proof on this machine.

## Warwick-owned gates still open for the LIVE acceptance proof

Migration 0001 live-apply (Supabase MCP); ftw `.env` populated; OpenAI/Codex key
+ billing + `codex` binary; Telegram bot decision (dedicated Tower bot vs 409 with
BUILD-002); GitHub/ClickUp least-privilege tokens; per-principal HMAC secrets on
the host. All recorded in the host runbook §1.

Commits: 1e8d2c6, 65de26b, 95bfc9c, 63a54c5, 28d2748, d1f27da, efe9d82. Secret
scan clean (373 files, 0 secrets). Next agent: Vex security delta review, then
Larry gates the live wiring.
