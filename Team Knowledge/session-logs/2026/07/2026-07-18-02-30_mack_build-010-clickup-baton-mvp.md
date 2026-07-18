---
date: 2026-07-18
specialist: mack
build: BUILD-010
wp: baton-mvp (branch build-010/wp1-clickup-baton-mvp)
worktree: C:\Fusion247PKA-baton
---

# BUILD-010 Tower — ClickUp baton MVP

Built the self-contained `services/tower-baton/` tree: the automated baton-carrier +
read-only Codex QA reviewer that replaces Warwick's copy-paste QA relay. No Supabase,
no `ftw`, no autonomous merge, no second poller, no capture-gateway change. Reusable
KEEP code (codexAdapter, telegramNotifier, envelope, ClickUp/GitHub evidence + packet
logic) was COPIED from the frozen `build-010/wp1-...` reactor into a new self-contained
tree — no import from, and no dependency on, the frozen tree or Supabase/ftw.

## Delivered

- **Formats** (`src/checkpoint.js`): `[LARRY → TOWER]` parser (fail-closed on missing
  checkpoint_id / wrong state / missing head_sha / brief_ref / build_id) + `[TOWER →
  LARRY]` formatter/parser + correlation (by checkpoint_id + reviewed_head; stale head
  rejected) + `answeredCheckpointIds` thread scan + `chainKey`.
- **ClickUp adapter** (`src/clickupClient.js`): poll comments / additive post; fail-
  closed without CLICKUP_TOKEN; injectable fake.
- **GitHub evidence** (`src/githubEvidence.js`): head/branch/diff/CI bound to the exact
  head SHA via a READ-ONLY command allowlist (mutating git/gh verbs refused → the
  no-autonomous-merge guarantee at the evidence layer); fail-closed.
- **Codex QA adapter** (`src/codexAdapter.js`): read-only `codex exec`, discovery +
  OAuth detection, strict signed honest-label verdict; child env sanitised so Codex
  NEVER receives Telegram/ClickUp secrets.
- **QA skill** (`Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md`): Warwick-
  owned, modifiable, `status: approved` + `version: 1`. Borrows the DISCIPLINE of
  Warwick's independent-QA skill (independent, read-only, checklist, findings-by-
  severity, escalate-to-Warwick) in a clean CODE-BUILD vocabulary — no Brain/Drive
  ontology. Loaded fresh per turn + SHA-256 fingerprinted onto every verdict.
- **Watcher** (`src/watcher.js` + `bin/tower-watch.js`): one poll cycle = lock →
  reconcile-from-thread (cold start) → parse checkpoints → dedup → resolve brief →
  verify evidence → load+fingerprint skill → Codex QA → post reply → update per-chain
  round counter (max 3 → escalate) → milestone Telegram. Keyed on build/wp/brief
  (cross-build). Startup dings via Tower's OWN notifier.
- **Larry handoff** (`bin/handoff-to-tower.js` + `src/handoff.js`): post + poll for the
  matching reply; re-entrant; timeout → honest TOWER_UNAVAILABLE + Telegram + HALT.
- **Runtime persistence**: single loader `src/runtimeConfig.js` (fail-closed on missing
  store/var/malformed, masked), `bin/preflight.js` (masked health check),
  `scripts/start-fusion-tower.ps1` (canonical launcher — secrets never on the command
  line), `Runtime/runtime-manifest.yaml` (names+paths), `Runtime/recovery.md`.
- **State/lock** (`src/state.js`): durable `C:\.fusion247\tower-baton-state.json`,
  single-watcher lock `C:\.fusion247\tower-baton.lock`, rotating logs in
  `C:\.fusion247\logs\tower-baton\`.

## Fable nits addressed

1. handoff re-entrancy (pre-scan the thread before posting). 2. thread is source of
truth; state file is a cache (cold-start reconcile). 3. one-watcher lockfile. 4. round
counter per checkpoint-chain (max 3 → escalate).

## Verification

`node --test` → **68/68 green** (fakes only; no live ClickUp/Codex/Telegram). Secret
scan clean (442 tracked files, 0 values). Codex-child-env test asserts no
Telegram/ClickUp secret reaches the reviewer; runtime test spawns a child with NO
inherited terminal env and loads config from the store only (masked).

## Needs a live credential before the live proof

- `CLICKUP_TOKEN` in `C:\.fusion247` (NEW — absent tonight; watcher fails closed).
- `TOWER_CLICKUP_TASK_ID` (the control task/thread).
- `gh auth login` + Codex ChatGPT sign-in on the Yoga (per-user).
- Warwick to approve any live ClickUp/Codex/Telegram run + any merge.

Did NOT push (Larry pushes). No live calls made.
