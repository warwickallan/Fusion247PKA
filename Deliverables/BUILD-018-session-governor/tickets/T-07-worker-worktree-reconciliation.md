---
name: T-07-worker-worktree-reconciliation
type: work-order
build: BUILD-018
ticket: T-07
ticket_type: implementation
status: resolved
resolved: 2026-07-31
model: Sonnet
private_surface: none
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor
---

# T-07 — Worker + worktree reconciliation

## Outcome

Enumerate every git worktree of this repo, its status, and any live worker apparently
running inside it, and report a disposition per worktree. **Read-only. Never deletes,
prunes, or modifies a worktree** — this is the proof mechanism the estate boundary
requires before any future cleanup decision, not the cleanup itself.

## Implementation

`tools/governor/worktree-recon.mjs`, split pure-core / OS-adapter (mirrors the
evaluator's AD-11 pattern):

- **Pure**: `parseWorktreePorcelain`, `classifyWorktree`, `computeDisposition`,
  `matchLiveWorkers` — unit-testable without touching git or the OS.
- **Adapter**: `listWorktreesLive` (`git worktree list --porcelain`), `gitStatusFor`,
  `unpushedCountFor` (`@{u}..HEAD`, `null` — not `0` — when there is no upstream),
  `listWindowsNodeProcesses` (best-effort process scan, fails soft to `[]`).
- `reconcile()` composes all of the above into one report.

**Disposition values**: `in-progress-owned` (this build's own worktree — always, dirty
or not), `reconciled-clean`, `unreconciled-dirty`, `unreconciled-unpushed`,
`unknown-unreadable` (git status itself failed — never silently treated as clean).

## Acceptance criteria

- [x] Reports the 20 known worktrees with disposition — run live: **22 total** (20
      baseline + primary + this build's own), full result in
      `evidence/T-07-worktree-reconciliation.md`.
- [x] Never deletes anything — enforced by an automated source-scan test, not just
      design intent.
- [x] `tools/governor/worktree-recon.test.mjs` — 12/12 passing (`node --test`).

## Mutation tests (both passing)

- **Inject a fake dirty worktree → appears as unreconciled** (map's specified mutation,
  at the pure `computeDisposition` level): a dirty tree is never reported
  `reconciled-clean`.
- **Real-git mutation**: creates an actual scratch repo + a genuine `git worktree add`,
  proves it reports clean immediately after creation, then genuinely dirties a tracked
  file and proves the *live git adapter* (`gitStatusFor`, not just the pure function)
  detects it and disposition flips to `unreconciled-dirty`.

## Finding — a real bug, caught by running against the live estate, not by unit tests

The first cut matched live workers with `commandLine.includes(path)`. Because
`"C:/Fusion247PKA"` is a literal substring of `"C:/Fusion247PKA-governor"` (and `-audit`,
`-tower`, `-w01`), the primary checkout was credited with live workers that were
actually running in sibling worktrees. Synthetic unit tests didn't catch it — none paired
a prefix name with its own suffixed sibling. Fixed with a path-boundary check
(`referencesPath`) requiring the path be followed by `/`, a quote, a space, or
end-of-string; added a regression test; re-ran against the real 22-worktree estate to
confirm the fix changed the actual observed output, not just the test suite. Full detail
in the evidence file.

## Known limitation, surfaced not hidden

Live-worker detection is explicitly **best-effort** — F-7 in `02-MAP.md` remains open
RESEARCH fog and this ticket does not claim to resolve it. Command-line-text matching
has a blind spot: a process whose command line happens to embed another worktree's path
as literal text (e.g. an inline `node -e "..."` diagnostic script) can self-match against
multiple worktrees. Observed directly in this run — see evidence file finding 3. A
durable fix needs a different signal (a session/task registry) and is left to F-7.

## Handback

No scope was reopened. Worktree count (22 = 20 baseline + primary + this build's own)
matches the map exactly. Two genuinely dirty trees found (the primary checkout's known
Cairn files, and one pre-existing baseline `agent-*` worktree) — both reported, neither
touched, per the estate's standing "evidence, not cleanup permission" rule.
