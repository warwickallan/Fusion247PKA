# Tower — bounded merge-time QA (Codex QA)

**Tower's active gate is a bounded, Larry-triggered merge-time QA check** — a *pull*, not a watcher.
The old per-turn TowerBot supervision is **off**, but the turn-by-turn **audit log is kept** (see
"The audit log" below): the watcher still runs at SessionStart purely as a silent audit record, and
Codex QA reads it as context.

## What it does
When Larry believes a deliverable is ready to merge, Larry runs `merge-check`. It:
1. Assembles a bounded packet — build/WP ref, acceptance criteria, PR diff + current-head SHA,
   CI/tests, Larry's completion claim, and recent `tower.turn` **audit-log** context.
2. Has **Codex** review it **read-only** (`codex exec --sandbox read-only`).
3. Records the Larry↔Codex exchange to **Supabase** (`tower.merge_check_run` + `tower.merge_check_message`)
   in real time — each message its own ordered `seq` under one shared `run` id.
4. **Mirrors** each message to **TowerBot** (visibility only).
5. **Returns Codex's exact reply as this command's stdout** — so it lands in Larry's current turn.
   No injection, no manual relay.

## Statuses & rules
- `READY_TO_MERGE` · `FIX_REQUIRED` · `NEEDS_WARWICK` · `BLOCKED`.
- **Max 3 rounds** per run (stable key: `--pr` or `--wp`, survives corrective commits), then it forces
  `NEEDS_WARWICK` and stops without another Codex call.
- **Codex never merges.** A non-`READY_TO_MERGE` status means do not merge. Merge stays Warwick's yes.
- **Closure-evidence gate:** Codex QA will not return READY on code quality alone — it requires a
  dedicated GitHub PR, present+passing CI, and closure records. Fail-closed on missing config/Codex/verdict.

## Usage
```bash
node --env-file=C:/.fusion247/control-plane-dev.env --env-file=C:/.fusion247/tower-baton.env \
  services/control-plane/tower/merge-check.mjs --pr <N> \
  --claim "<what I built and why it's ready>" [--wp <ref>] [--acceptance "<criteria or path>"]
```
- `--pr <N>` — reviews `gh pr diff <N>` + PR state + `gh pr checks`; run keyed on the PR (rounds survive commits).
- local mode (no `--pr`) — reviews `git diff origin/main...HEAD`; requires a stable `--wp` for the round key.
- Supabase target: the control-plane DEV project (`CONTROL_PLANE_DEV_DATABASE_URL`), co-located with the audit log.
- TowerBot token comes from `tower-baton.env`; the mirror is best-effort and never blocks the gate.

## The audit log (kept)
The turn-by-turn audit trail is **retained** — it is genuinely useful, and Codex QA reads it as context:
- `tower-loop/bridge-ingest.mjs` (`Stop` hook) records each turn to `tower.turn`.
- `tower-loop/watcher.mjs` + `ensure-watcher.mjs` still run at SessionStart as the audit recorder —
  but with `TOWER_NOTIFY_TRANSPORT=none` so they are **silent on TowerBot** (the old per-turn
  supervision noise is off; the record stays). TowerBot now only ever shows the merge-QA exchange.
