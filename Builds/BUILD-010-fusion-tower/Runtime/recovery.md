# BUILD-010 Fusion Tower — baton MVP runtime recovery

How to stand the Tower baton watcher back up on the Yoga (Buggly) after a reboot,
sign-out, or migration — WITHOUT any terminal-session dependency and WITHOUT ever
exposing a secret value. Pair this with [[runtime-manifest.yaml]] (names + paths).

> No secret VALUE appears in this doc. Everything is names, paths, and masked checks.

## 1. Expected `C:\.fusion247` structure

```
C:\.fusion247\
  fusion-capture-gateway.env      # supplies TELEGRAM_BOT_TOKEN, AUTHORISED_TELEGRAM_USER_ID, CLICKUP_TOKEN (names only)
  tower-baton.env                 # OPTIONAL — alternate home for CLICKUP_TOKEN / TOWER_HMAC_SECRET_GPT_CODEX
  tower-baton-state.json          # durable dedup + per-chain rounds (auto-created; a cache — safe to delete)
  tower-baton.lock                # single-watcher lock (auto-created/removed; delete only if stale)
  logs\tower-baton\               # bounded rotating logs (auto-created; OUTSIDE the repo)
```

The ClickUp thread is the SOURCE OF TRUTH for what has already been reviewed; the
state file is only a cache. Deleting `tower-baton-state.json` is safe — on next start
the watcher rebuilds dedup truth by scanning the thread (cold-start reconcile).

## 2. Verify ACLs (least privilege — the Buggly user only)

The store holds live credentials; only the interactive user should be able to read it.
Inspect (does NOT print any value):

```
icacls C:\.fusion247
```

Expect the owner/`Buggly` (and SYSTEM/Administrators) with access; NO broad
`Everyone`/`Users` read. To restrict to the current user + SYSTEM if it is too open:

```
icacls C:\.fusion247 /inheritance:r /grant:r "%USERNAME%:(OI)(CI)F" "SYSTEM:(OI)(CI)F"
```

Codex OAuth (`%USERPROFILE%\.codex\auth.json`) and the `gh` keyring are per-user; a
watcher run as the SAME interactive user inherits both. A service/Scheduled Task run as
SYSTEM or another account would NOT be authenticated — run it as Buggly.

## 3. Masked health check (never prints a value)

```
node services\tower-baton\bin\preflight.js            # store + required names (masked)
node services\tower-baton\bin\preflight.js --telegram  # + masked getMe outbound self-test (GET, not getUpdates)
```

Exit 0 = ready; exit 1 = fail-closed (the masked output names the missing var). This is
the same loader (`runtimeConfig`) the watcher uses — if pre-flight is green, the watcher
will load identically.

## 4. Start (canonical launcher — the only method)

```
powershell -ExecutionPolicy Bypass -File services\tower-baton\scripts\start-fusion-tower.ps1 -TaskId <clickupTaskId> -Telegram
```

On a fresh start the watcher emits `[TOWER] ClickUp baton watcher online` via its own
notifier; after a restart with existing state it emits
`[TOWER] Watcher recovered and resumed from durable checkpoint state`. Secrets are NEVER
on the command line — the node process loads them from the store.

## 5. Safe backup + restore onto the Yoga

- **Backup:** copy `C:\.fusion247\*.env` to an encrypted location (e.g. a password
  manager or an encrypted volume). These are the only irreplaceable files; state/lock/
  logs are all regenerable. Do NOT commit them; do NOT place them in the repo.
- **Restore:** recreate `C:\.fusion247\`, drop the `.env` files back, re-apply ACLs
  (§2), confirm `gh auth status` is signed in and `%USERPROFILE%\.codex\auth.json`
  exists, then run the masked health check (§3).

## 6. Scheduled Task (session-independent, after proofs)

Register a user-level task that runs the launcher as Buggly at logon. Secrets are NOT
on the task command line — the launcher/watcher load them from the store:

```
schtasks /Create /TN "FusionTowerBaton" /SC ONLOGON /RL LIMITED ^
  /TR "powershell -ExecutionPolicy Bypass -File C:\Fusion247PKA\services\tower-baton\scripts\start-fusion-tower.ps1 -TaskId <clickupTaskId> -Telegram"
```

The single-watcher lock prevents a duplicate if both a manual run and the task fire.

## 7. Disable / uninstall

```
schtasks /End /TN "FusionTowerBaton"      # stop a running instance
schtasks /Delete /TN "FusionTowerBaton" /F # remove the task
del C:\.fusion247\tower-baton.lock         # only if a crashed watcher left a stale lock
```

Deleting the service files or the repo does not remove the credentials; to fully
decommission, also securely delete the `C:\.fusion247\*.env` files.

## 8. Which steps genuinely need Warwick

- Providing / rotating `CLICKUP_TOKEN`, `TELEGRAM_BOT_TOKEN` in the store (§1).
- The Telegram `AUTHORISED_TELEGRAM_USER_ID` (his own chat id).
- `gh auth login` and the Codex ChatGPT sign-in on the Yoga (per-user, interactive).
- Approving any change to `tower-qa-skill.md` (governing prompt).
- Any live ClickUp/Codex/Telegram proof run and any merge — Warwick-gated.
