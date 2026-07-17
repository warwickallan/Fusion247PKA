---
build: BUILD-010
component: Fusion Tower / Governance Mode
wp: WP0
artifact: tower-host-runbook
status: draft-for-wp0
author: mack
created: 2026-07-17
---

# Fusion Tower — Windows Always-On Host Runbook (WP0)

Parent build: [[BUILD-010-fusion-tower]]

How the Fusion Tower dispatcher runs as an always-on service on the Windows Yoga,
plus the independent 5-minute watchdog. **Announce-don't-launch:** this runbook
and the scripts under `services/fusion-tower/src/host/` REGISTER the service and
task; nothing here auto-starts a live governance loop. Warwick starts the Tower
himself once the live gates (below) are cleared. This mirrors the BUILD-002
Cockpit doctrine: build + generate launcher + health-check, then hand the human
the start.

## 0. What runs where

| Piece | File | Host mechanism | Failure domain |
|---|---|---|---|
| Dispatcher (main loop) | `src/tower.js` | NSSM service (primary) or Scheduled Task "run whether logged on or not / At startup / Restart on failure" (fallback) | A |
| Watchdog (5-min sweep) | `src/watchdog.js` | Separate Scheduled Task, repeat every 5 min | **B (separate)** |

The two are deliberately different mechanisms so a wedge in one cannot silence the
other (Pax Item 4).

## 1. Prerequisites (Warwick-owned gates — LIVE apply only)

None of these are provisioned by the build. Each is a Warwick decision:

1. **Migration 0001 applied** to the ftw schema of the Supabase project via the
   project-scoped Supabase MCP (browser OAuth). WP0 does **not** apply it live.
2. **`.env`** at `services/fusion-tower/.env` (gitignored; ACL to the service
   account only), populated from `.env.example`. Secrets by NAME only in git.
3. **Codex**: `codex` binary installed + an OpenAI API key with a billing budget
   (Pax R1). Absent → the Codex adapter records a blocker and the loop still runs.
4. **Telegram bot decision**: WP0 must NOT start a second long-poll on BUILD-002's
   bot token (409 conflict). Either a dedicated Tower bot token or a shared-router
   decision is required before live Telegram control is enabled.
5. **GitHub / ClickUp tokens**: least-privilege, for authenticated polling + the
   gated write path. Unauthenticated read of a public repo works for the proof.

## 2. Install NSSM (primary path)

```powershell
scoop install nssm    # or download from nssm.cc
```

## 3. Register the dispatcher service

```powershell
# Elevated PowerShell. Review the script first — the nssm commands are commented
# out so nothing runs until you deliberately uncomment + execute them.
powershell -ExecutionPolicy Bypass -File services\fusion-tower\src\host\register-tower-service.ps1
```

The script sets: `AppDirectory`, `AppStdout`/`AppStderr` (rotating logs),
`Start=SERVICE_AUTO_START`, `AppRestartDelay=5000`. Secrets are read by the
service from `.env`, never embedded in the service config.

**Start only when the gates are cleared:** `nssm start FusionTower`.

## 4. Register the independent watchdog

```powershell
powershell -ExecutionPolicy Bypass -File services\fusion-tower\src\host\register-watchdog-task.ps1
```

Runs `node src/watchdog.js` every 5 minutes: one lease sweep, then exit. Uses
`-AtStartup`/`-StartWhenAvailable` and repeats — a machine that was off still
resumes the sweep on next boot.

## 5. Health check (before announcing ready)

```powershell
# Fixtures-mode smoke test — no live surfaces touched, no DATABASE_URL needed:
node services\fusion-tower\src\watchdog.js
# Expect: {"service":"fusion-tower-watchdog","event":"sweep","fixturesMode":true,"reaped":0,...}

node -e "import('./services/fusion-tower/src/tower.js')" # imports without launching main
```

A masked startup log (`config.describe()`) prints every secret as
`***set (masked)***` or `(unset)` — verify no secret value ever appears.

## 6. Announce (do NOT auto-launch)

Once registered and health-checked, tell Warwick:

> Fusion Tower is registered as a Windows service and the 5-minute watchdog task
> is in place. It is **not started**. When you have cleared the live gates
> (migration applied, `.env` populated, Telegram bot decision made), start it
> with `nssm start FusionTower`.

## 7. Stop / uninstall

```powershell
nssm stop FusionTower
nssm remove FusionTower confirm
Unregister-ScheduledTask -TaskName FusionTowerWatchdog -Confirm:$false
```

## 8. Restart-safety note

All in-flight state lives in Supabase (`ftw.*`), never in process memory. On
restart the dispatcher resumes from durable rows; a crash mid-turn re-dispatches
to the SAME `(run_id, ordinal)` (turn idempotency) and the watchdog reaps any
turn that went silent. No lost or duplicated turns across a restart.
