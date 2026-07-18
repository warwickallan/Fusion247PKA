# tower-baton — BUILD-010 Tower baton MVP

The automated **baton-carrier + read-only Codex QA reviewer** that replaces
Warwick's copy-paste QA relay. Larry posts a checkpoint to a ClickUp control task;
the Tower detects it, verifies the GitHub evidence bound to the **exact head SHA**,
runs a **read-only Codex QA** turn against the approved brief + a fingerprinted QA
skill, and posts a compact `[TOWER → LARRY]` reply back to the same thread. Larry
reads it and continues autonomously; Warwick is pulled in only for material
decisions / merge / live.

**No Supabase, no `ftw`, no autonomous merge.** Dedup + recovery live in a local file
outside the repo. Pure Node; zero runtime dependencies.

## Secret home (persistent, session-independent)

All secrets live under the protected store **`C:\.fusion247\`** and are read **by
NAME** at runtime through the single loader `src/runtimeConfig.js` — never off the
terminal session, never committed, never logged (masked everywhere).

| Name | Kind | Supplied by | Mandatory | Consumed by |
| --- | --- | --- | --- | --- |
| `CLICKUP_TOKEN` | secret | `C:\.fusion247\fusion-capture-gateway.env` (or `tower-baton.env`) | yes | watcher, handoff |
| `TELEGRAM_BOT_TOKEN` | secret | `C:\.fusion247\fusion-capture-gateway.env` | yes | milestone notifier |
| `AUTHORISED_TELEGRAM_USER_ID` | pointer | `C:\.fusion247\fusion-capture-gateway.env` | yes | notifier recipient |
| `GITHUB_REPO` | config | env / `.env` | optional | githubEvidence CI reads |
| `TOWER_HMAC_SECRET_GPT_CODEX` | secret | `tower-baton.env` | optional | verdict signing |

- **GitHub** auth is the `gh` CLI keyring session for the interactive Buggly user —
  NO token file. `githubEvidence` shells out to `gh api` / `git` (read-only allowlist).
- **Codex** is the installed binary (discovered under
  `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe`) + ChatGPT-OAuth
  (`%USERPROFILE%\.codex\auth.json`). Codex receives **NO** Telegram/ClickUp env
  (`sanitizeCodexEnv` strips them from the child).
- If `CLICKUP_TOKEN` is **absent**, the watcher **fails closed** with a clear
  `CLICKUP_TOKEN missing` blocker (and a Telegram blocker if Telegram is configured)
  — it never crashes.

See `Builds/BUILD-010-fusion-tower/Runtime/runtime-manifest.yaml` (names + paths) and
`.../Runtime/recovery.md` (structure, ACLs, backup/restore, uninstall).

## Run it

Canonical launcher (the only startup method — Claude Code, Codex, foreground, and the
Scheduled Task all use it):

```
powershell -ExecutionPolicy Bypass -File scripts\start-fusion-tower.ps1 -TaskId <clickupTaskId> -Telegram
```

Equivalent (same `runtimeConfig`): `node bin/tower-watch.js` (needs
`TOWER_CLICKUP_TASK_ID`). Masked health check: `node bin/preflight.js [--telegram]`
(exit 0 ready, exit 1 fail-closed; prints present/absent by NAME only, never a value).

On start the watcher emits, **via its own notifier**:
- fresh: `[TOWER] ClickUp baton watcher online`
- recovered: `[TOWER] Watcher recovered and resumed from durable checkpoint state`

### Larry's handoff command

```
node bin/handoff-to-tower.js --task <clickupTaskId> --checkpoint <checkpoint.json>
```

Posts the `[LARRY → TOWER]` checkpoint, polls the same thread for the matching
`[TOWER → LARRY]` reply (correlated by `checkpoint_id` + `reviewed_head`), and prints
it as JSON. Re-entrant (a restarted Larry resumes without duplicates). On timeout it
posts an honest `TOWER_UNAVAILABLE`, alerts Telegram, and exits **4 = HALT** (Larry
stops QA-dependent work).

## Durable state / lockfile / logs (all outside the repo)

- **State (cache):** `C:\.fusion247\tower-baton-state.json` — answered `checkpoint_id`s,
  per-chain round counters, notify dedup. The **ClickUp thread is the source of
  truth**; on cold start the watcher rebuilds dedup from the thread. Safe to delete.
- **Lockfile:** `C:\.fusion247\tower-baton.lock` — single-watcher guard (a second
  instance is refused; a stale lock is reclaimed).
- **Logs:** `C:\.fusion247\logs\tower-baton\` — bounded rotating logs (2 MB → `.1`).

## Checkpoint + reply formats

`[LARRY → TOWER]`: `state` (`READY_FOR_TOWER_REVIEW`), `checkpoint_id`, `build_id`,
`wp_id`, `brief_ref`, `branch`, `head_sha`, `base_sha`, `summary`, `tests`,
`evidence_refs[]`, `questions_or_blockers[]`.

`[TOWER → LARRY]`: `checkpoint_id`, `reviewed_head`, `prompt_fingerprint`, `verdict`
(`APPROVE | CORRECTIONS_REQUIRED | DECISION_REQUIRED | BLOCKED`), `summary`,
`material_findings` (≤3 unless safety), `next_action`. Tight — not an essay.

## Test

`npm test` (`node --test`, fakes only — no live ClickUp/Codex/Telegram). `npm run
scan` runs the repo-root secret scanner.

## The QA skill

`Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md` — Warwick-owned,
modifiable, `status: approved` + `version`. Loaded **fresh per turn** and its
**SHA-256 fingerprint** is recorded on every verdict.
