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

### Ad-hoc milestone (the sanctioned one-off ding)

```
node bin/notify-milestone.js --purpose escalation --body "one sentence" --source LARRY
```

**What it is for.** Sending a single milestone when the watcher is not running — a
handback is owed, a route is blocked, a verdict needs eyes. It is the **only**
sanctioned way to emit an ad-hoc milestone; a bespoke caller written for the occasion
is not. It drives the same `runtimeConfig` + `telegramNotifier` the watcher uses, so it
needs **no Postgres, no ClickUp and no terminal session** — the loader resolves
`TELEGRAM_BOT_TOKEN` and `AUTHORISED_TELEGRAM_USER_ID` by NAME from the secret store.
No credential is accepted on the command line, and none is ever printed.

**Vocabulary — closed, and narrower than the library's.** Available here:

| Purpose | Use it when |
| --- | --- |
| `escalation` | a decision or handback is owed |
| `blocked` | fail-closed; something must be cleared before work continues |
| `tower_unavailable` | the QA route stopped; dependent work must HALT |
| `review_posted` | a verdict is waiting to be read |

`watcher_online`, `watcher_recovered` and `clickup_token_missing` are **refused here** —
they are states the watcher observes about *itself*, and a human able to hand-fake them
is how a monitoring channel starts lying. Rejections say which of the two problems it
is: *"not a milestone"* (not in the vocabulary at all) or *"not available to this
entrypoint"* (a real milestone, machine-only).

**The ⟦GOV⟧ footer is appended automatically — by EVENT, never by memory.**

Root `CLAUDE.md` makes the footer event-driven: it appears when Warwick has something to
act on, and never as a per-reply staple. This command binds that to the milestone class
instead of to an agent remembering:

| Class | Purposes | Footer |
| --- | --- | --- |
| **handback** | `escalation`, `blocked` | **appended** — he must act |
| **routine** | `review_posted`, `tower_unavailable` | **not appended** — a footer on a message that requires nothing of him manufactures the exact interruption it exists to prevent |

The line is rendered by `tools/governor/footer.mjs` (`computeFooterLine`) and never
hand-composed: a hand-built footer one field short parses as *no* footer, which reads
exactly like a healthy reply. It goes **last**, after a blank line, because
`extractFooterLine` reads the final line and no other. Wire text: `[LARRY] <body>`, blank
line, footer.

```
node bin/notify-milestone.js --purpose escalation --body "one sentence" --source LARRY --handback merge-decision
```

- `--handback <code>` is **optional** and accepted only on `escalation`/`blocked`. The
  codes are `footer.mjs`'s frozen `HANDBACK_CODES` — the constitution's seven legitimate
  interruptions. An unrecognised code, or one passed with a routine purpose, is a **usage
  error (exit 2, nothing loaded, nothing sent)**; it is never coerced into `CONTINUE`.
- Omit it and the footer keeps `footer.mjs`'s own default control token. No code is
  invented here.
- **The footer can never cost a send.** If the renderer throws, the message goes out
  without a footer and exits 0 — a governor line is not worth a lost handback.
- **`BLIND` is a correct outcome, not a failure.** Missing or unreadable telemetry still
  renders a footer, saying `BLIND` rather than a state it did not measure. It is never
  suppressed: that would make the governor quietest exactly when it stopped measuring, and
  would withhold the one advice that is never withheld — rotate.
- **Known limitation — no session id exists in a CLI process, and no flag invents one.**
  The health sample resolves by `resolveHealthSample` rule 2: the newest sample under the
  **cwd-derived** project key, marked approximate (the `~` in `ctx ~NN%`). Run from a
  worktree, or any directory whose key holds no samples, the line honestly reads `ctx --`
  · `BLIND`. An honest approximate marker beats a flag nobody will pass.

**What it does NOT do.**

- **Not a console.** Routine progress has no purpose it can be sent under, by design.
- **No dedup, so RE-RUNNING RESENDS.** It deliberately keeps no state: the watcher's
  dedup store lives in the secrets store, and sharing that namespace would let an ad-hoc
  `escalation` silently suppress a real one. Send once, on purpose.
- **No retry, no queue, no scheduling.** One process, one attempt, one answer.
- **No inbound polling, no ClickUp, no Codex, no merge.** Outbound `sendMessage` only.
- **Does not read the body from stdin or a file.** `--body` on the command line only.

**Exit codes — a send that did not happen never exits 0.**

| Exit | Meaning |
| --- | --- |
| `0` | sent. `{"sent":true,"messageId":"…"}` on **stdout**, nothing on stderr |
| `1` | **NOT SENT** — config fail-closed, notifier not ready, dropped, deduped, or the send failed. Reason on stderr, **nothing on stdout** |
| `2` | usage error — bad/missing purpose, empty body, unknown source. Nothing was loaded and nothing was sent |

There is no output on any failure path that reads as success. That is the point of the
command: a silent failure and a quiet channel are indistinguishable to the person
waiting, so this one is never silent.

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
