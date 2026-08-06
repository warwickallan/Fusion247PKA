# Watcher cold-start evidence (2026-08-06, updated)

## Journey
1. Live watcher was polling PR #97.
2. Controlled `Stop-Process` on tower-loop `watcher.mjs`.
3. **Windows-supported entrypoints** (installed runtime `~\.mypka\tower-runtime\services\control-plane\tower-loop\`):
   - **`start-watcher.mjs`** — always calls `main()` (does not depend on import.meta/argv equality).
   - **`watcher.mjs`** with `TOWER_SQLITE_PATH=%USERPROFILE%\.mypka\tower\tower.db` (direct binary).
   - `run-watcher.mjs` main-guard fixed for Windows path casing; prefer `start-watcher.mjs` on Windows.
4. `TOWER_NOTIFY_TRANSPORT=none` when shell lacks Telegram env (fail-loud otherwise — validates missing vars).
5. Post-restart: process live (e.g. PID 14968); prior run logged `watcher_up`, durable store open, `pr_poll_discovery` for PR **#97**.

## Residual
- TowerBot-enabled restart requires approved env (e.g. `tower-baton.env` TELEGRAM_*) without exposing values to model context — use `node --env-file=... start-watcher.mjs` as operator.
- Fresh-session “is watcher up?” check: `Get-CimInstance` / log tail at `~\.mypka\tower\logs\watcher.log` — no Warwick command reconstruction required once entrypoint is known.
