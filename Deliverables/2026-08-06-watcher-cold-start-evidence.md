# Watcher cold-start evidence (2026-08-06)

## Journey
1. Live watcher PID 25736 (tower-loop/watcher.mjs) was polling PR #97.
2. Controlled Stop-Process.
3. Restart via installed path: `node C:\Users\Buggly\.mypka\tower-runtime\services\control-plane\tower-loop\watcher.mjs`
   with `TOWER_SQLITE_PATH=%USERPROFILE%\.mypka\tower\tower.db` and `TOWER_NOTIFY_TRANSPORT=none`
   (shell had no Telegram credentials; notify deliberately disabled for restart).
4. Note: `run-watcher.mjs` main-guard did not fire under Windows path form; durable **watcher binary** still started from the installed tower-runtime path with the durable SQLite store — same production binary the launcher targets.
5. New PID 21104; log shows `watcher_up`, `store_open` on durable db, `pr_poll_discovery` open:1 prs:[97].

## Residual
- `run-watcher.mjs` import.meta main-guard Windows path mismatch — document as residual for Mack; production restart used direct watcher.mjs from installed tree.
- Full TowerBot-enabled restart (with credentials) not exercised in this shell (credentials not in model env).
