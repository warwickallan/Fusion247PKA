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

## 4. Start — ⛔ RETIRED 2026-08-05. THIS NO LONGER STARTS ANYTHING.

> **`tower-baton` is retired.** Both entrypoints below now **refuse and exit 78**. This
> section is kept because it was the documented start path and a reader who finds it
> elsewhere must land on the truth, not on a dead command.
>
> **The current Tower is `services/control-plane/tower-loop/`, launched via
> `run-watcher.mjs`.** That is the only Tower runtime.
>
> Authorised by Warwick, 2026-08-05: *"Verify the legacy Tower is genuinely obsolete,
> then remove it so it cannot restart or confuse the current runtime."* The decision was
> to make it **refuse** rather than delete the source tree, because
> `src/clickupClient.js` is the target of a live negative control in the `tower-loop`
> test suite (`graph-probe.mjs` `control-trap`).

~~`powershell -ExecutionPolicy Bypass -File services\tower-baton\scripts\start-fusion-tower.ps1 -TaskId <clickupTaskId> -Telegram`~~ — **refuses, exit 78.**

~~`node services\tower-baton\bin\tower-watch.js`~~ — **refuses, exit 78.** This was the
real entrypoint: the launcher above only wrapped it, so guarding the `.ps1` alone would
have left the path open.

**A defect found while retiring it, worth keeping:** this launcher had **never been
runnable under the host this very line named.** `powershell -File` is Windows PowerShell
5.1, which reads a UTF-8-no-BOM file as ANSI; the committed em-dashes killed it at
*parse* time. It ran under `pwsh` 7 and was dead under 5.1. The file is now pure ASCII
and a test pins that. **The same root cause broke the Proofline launcher on 2026-08-04
(`8d130eb`) — twice in one build.**

## 5. Safe backup + restore onto the Yoga

- **Backup:** copy `C:\.fusion247\*.env` to an encrypted location (e.g. a password
  manager or an encrypted volume). These are the only irreplaceable files; state/lock/
  logs are all regenerable. Do NOT commit them; do NOT place them in the repo.
- **Restore:** recreate `C:\.fusion247\`, drop the `.env` files back, re-apply ACLs
  (§2), confirm `gh auth status` is signed in and `%USERPROFILE%\.codex\auth.json`
  exists, then run the masked health check (§3).

## 6. Scheduled Task — ⛔ RETIRED 2026-08-05. **DO NOT REGISTER THIS.**

> **This section was a documented resurrection procedure — a start path with a human in
> the loop.** Following it would have re-created the exact legacy watcher that Phase 2
> retired, and it would have survived every file deletion, because a person reading these
> lines is the mechanism.
>
> **The registration it created (`FusionTowerBatonWatcher`) has been unregistered.** Do
> not re-create it. The launcher it points at refuses with exit 78 in any case, so
> following this now yields a task that fires every ten minutes and does nothing.

~~`schtasks /Create /TN "FusionTowerBaton" /SC ONLOGON /RL LIMITED /TR "powershell … start-fusion-tower.ps1 …"`~~ — **do not run.**

**If you need Tower running, the answer is `services/control-plane/tower-loop/` via
`run-watcher.mjs` — not this.**

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
