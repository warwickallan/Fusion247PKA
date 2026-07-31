---
name: T-02-session-health-store
type: work-order
build: BUILD-018
ticket: T-02
ticket_type: implementation
status: resolved
resolved: 2026-07-31
model: Sonnet
private_surface: none
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor
---

# T-02 — Session-health store: decide location, implement atomic write

## Outcome

Decide where the ephemeral, machine-local, `session_id`-keyed session-health store lives
(F-2), and implement it with an atomic write that never yields a torn file — clearing the
way for T-03's sampler.

## Decision — store location, and GL-012 reasoning

**Default: `~/.mypka/governor/health/<projectKey>/<sessionId>.json`**, override via
`MYPKA_GOVERNOR_HEALTH_DIR`. `projectKey` is derived by replacing `:`/`\`/`/` with `-`
(`C:\Fusion247PKA` → `C--Fusion247PKA`) — matching the convention already observed in
Claude Code's own `transcript_path` in T-01's captured payload.

**Why not `C:\.fusion247\**`:** GL-012 governs the secrets store and, per §6a (read from
`recovery/2026-07-31-governor-abort-handoff` at `95c265d`, since it is not on this
branch), private-application session logs specifically. Session-health samples are
neither a secret nor a private-application log — they are non-secret operational
telemetry (context %, compaction count, timestamps) for a build whose own
`private_surface` is `none`. Routing them through the deny-by-default secrets boundary
would misapply a control designed for a different threat, and would force a spurious
`private_surface` declaration for data that isn't private. `~/.mypka/**` sits outside
GL-012's scope entirely — no declared surface required.

**Why not inside the git working tree:** AD-2 requires this store to be "NOT git", and a
governor session may run from the primary checkout or from any worktree of this same
repo — health state must resolve to one canonical location independent of which checkout
is currently active. A repo-relative path would silently fork state per checkout.

**Why not `~/.claude/projects/...`:** that directory is Claude Code's own internal,
undocumented state layout (the same caveat the map already applies to the transcript
format) — writing into it risks colliding with the host tool's own file management.
`~/.mypka/` is a Governor-owned namespace, following the same `~/.claude`-style
dotfile convention already established in this estate, without touching the host's own
directory.

## Implementation

`tools/governor/health-store.mjs`: `projectKeyFor`, `healthStoreDir`, `healthFilePath`,
`writeHealthSample`, `readHealthSample`, `deleteHealthSample`.

- **Atomic write**: each write goes to a per-writer-unique temp file
  (`<file>.tmp-<pid>-<random>`), then an atomic rename onto the target. A killed writer
  never reaches rename, so it can only ever leave a stray temp file — the target itself
  is always some previous writer's complete, valid content.
- **Read never throws on missing/corrupt state**: returns `{ ok: false, reason }` so a
  future evaluator (T-04) can treat it as `BLIND` input rather than crashing.

## Acceptance criteria

- [x] Store path settled with GL-012 reasoning written down (above).
- [x] Concurrent writes never yield a torn file.
- [x] `tools/governor/health-store.test.mjs` — 8/8 passing (`node --test`).

## Mutation tests (both passing)

- **Kill mid-write → reader still gets last good state, never a partial parse.**
  Simulated by writing a good sample, then dropping a stray truncated temp file next to
  it *without* renaming (exactly what a killed writer leaves behind) — the reader
  returns the last good state unaffected.
- **N concurrent writer processes never produce a torn file.** 12 real OS processes
  (`node --input-type=module -e ...`, not simulated in-process) write concurrently to
  the same session id; the file on disk always parses as complete, valid JSON matching
  exactly one writer's full payload, and no stray temp files are left behind.

## Handback

No surprises. GL-012 §6a's scope (private-application session logs) confirmed it does
not reach this ticket's non-secret ephemeral telemetry — checked directly against the
settled ruling text rather than assumed.
