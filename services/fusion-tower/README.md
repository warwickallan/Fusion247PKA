# fusion-tower

BUILD-010 WP0 — the Fusion Tower governance control-plane. A Windows-owned,
Supabase-backed, restart-safe dispatcher that drives **bounded, signed, honestly-
labelled** agent turns through a governance run, enforces guardrails centrally,
and surfaces **only** terminal outcomes to Warwick via Telegram. **No autonomous
merge, ever.**

Foundation: builds on BUILD-002 WP0 patterns from `main` (config/secret masking,
pooler + pinned-CA TLS, migration + RLS-deny-by-default house style, the two-store
fixture/Postgres pattern). It does **not** import fcg code — it mirrors the
patterns in a new tree. Separate Supabase schema (`ftw`), no coupling to `fcg`.

## Layout

| Path | Component |
|---|---|
| `migrations/0001_wp0_control_plane.sql` | Silas — the ftw schema (runs/turns/events/identity) |
| `src/config.js` | 1. Env-by-name + secret masking; fixtures + per-adapter fail-closed |
| `src/store/memoryStore.js`, `src/store/postgresStore.js`, `src/store/pgSslConfig.js` | 2. Two-store data-access over ftw |
| `src/core/states.js`, `src/core/guardrails.js`, `src/core/envelope.js` | State machines, central guardrails, HMAC-signed honest envelopes |
| `src/dispatcher.js` | 3. Control loop + watchdog + decision gates + terminal notices |
| `src/adapters/larryAdapter.js` | 4. Claude Code headless (scoped tools, no merge, fail-closed) |
| `src/adapters/codexAdapter.js` | 5. `codex exec` spike (honest gpt_codex label, fail-closed) |
| `src/adapters/telegramControls.js` | 6. Command parsing + allowlist + terminal-only notifier |
| `src/adapters/eventIntake.js` | 7. GitHub/ClickUp normalize + dedup + self-loop + routing |
| `src/host/*.ps1`, `src/tower.js`, `src/watchdog.js` | 8. Always-on registration + runtime + 5-min watchdog |
| `test/`, `scripts/proof-e2e.js` | 9. No-DB suite, gated Postgres suite, synthetic E2E proof |

## Running the tests

```bash
cd services/fusion-tower
npm install            # installs `pg` (the only dependency)
npm test               # no-DB fixtures suite (never touches pg or a database)

# Real-Postgres integration suite (gated on DATABASE_URL — throwaway cluster):
DATABASE_URL=postgresql://postgres@127.0.0.1:54333/ftw_dev node --test test/postgresStore.integration.test.js

# Secret scan (must be clean):
npm run scan

# Synthetic end-to-end governance-loop proof:
npm run proof:e2e
```

## Guardrails (non-negotiable)

- **No autonomous merge** — `merge`/push/destructive actions are forbidden in
  `core/guardrails.js`; no adapter is given a merge tool.
- **Honest identity** — `gpt_codex` is always `openai-codex`, never xAI/Grok;
  `core/envelope.js` throws on a dishonest label and the DB CHECK pins it too.
- **Scope lock, max rounds (default 2), token/time budget** — enforced centrally.
- **Terminal-only Telegram** — READY / BLOCKED / TIMED_OUT / DECISION_REQUIRED / CLOSED.
- **No secrets in logs/state** — masked via `config.describe()`; scanned in CI.

See `Builds/BUILD-010-fusion-tower/Architecture/` for the schema, dedup/timeout
contract, host runbook, and the WP0 synthetic proof transcript.
