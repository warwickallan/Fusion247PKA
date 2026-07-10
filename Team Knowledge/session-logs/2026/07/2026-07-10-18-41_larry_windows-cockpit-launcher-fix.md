---
agent_id: larry
session_id: windows-cockpit-launcher-fix
timestamp: 2026-07-10T17:41:00Z
type: close-session
linked_sops: [SOP-002-convert-mypka-to-sqlite]
linked_workstreams: []
linked_guidelines: []
---

# Workout-table request surfaced a real Cockpit build bug on Windows — found, fixed, merged

## Context

Warwick asked Larry to populate the Cockpit's workout tables (routes, heat
trail) via the SQLite upgrade + mirror regen. That task turned out to be
blocked two layers deep — no Python runtime, no GPX/workout source data — and
along the way surfaced and closed out a genuine, previously-unconfirmed
Cockpit build failure on Windows, running in parallel with a second Claude
Code session (Edge browser, PR #3) debugging the same underlying symptom from
a different angle.

## What we did

- Larry routed the workout-table request to Silas (owns SOP-002 / SQLite
  mirror generation).
- Silas investigated and found two blockers: no working Python on this
  machine (only Windows Store stub aliases resolve on PATH), and zero
  GPX/workout export data anywhere in the repo or common profile locations.
  Declined to create empty `health_workout`/`health_workout_route` tables and
  call it done, per the DATA-CONTRACT's honest-empty-state doctrine.
- Warwick installed Python 3.12 (landed correctly at
  `%LOCALAPPDATA%\Programs\Python\Python312`).
- Larry diagnosed a stale-PATH issue blocking `python` resolution: Windows
  "App Execution Alias" entries for `python.exe`/`python3.exe` were still On
  and shadowing the real install even after it succeeded. Warwick disabled
  them in Settings → Apps → Advanced app settings → App execution aliases.
- `python` still didn't resolve after that — traced to VS Code itself holding
  a stale PATH snapshot from before the install; new terminal tabs inside an
  already-running VS Code inherit that stale snapshot regardless of Windows
  PATH changes. A full VS Code restart fixed it. Confirmed:
  `python --version` → `Python 3.12.10`.
- In parallel, the Edge-browser session (branch `claude/cockpit-portable-node`,
  PR #3) was independently investigating a `better-sqlite3` native-build
  failure under a "corporate proxy" theory and had pushed an untested
  proxy-passthrough fix.
- Larry found this local Windows checkout already carried an uncommitted,
  **verified-working** fix predating this conversation: pinning the
  launcher's portable-Node fallback to v22.23.1, because `better-sqlite3`
  dropped prebuilt Windows binaries for Node 20's ABI (115) — a materially
  different and more precise root cause than the proxy theory. Evidence on
  disk: `.node-portable/node-v22.23.1-win-x64/` present, and
  `node_modules/better-sqlite3/build/Release/better_sqlite3.node` built.
- Relayed the finding to the Edge session, which folded it in as the real fix
  (kept proxy passthrough as harmless secondary coverage), committed
  `4711e70` to PR #3.
- Larry verified the fix end-to-end locally (build/install only, did not
  start the live server, per the Cockpit's never-auto-launch rule): clean
  `npm install`, `npm --prefix web install`, `npm --prefix web run build`
  under portable Node 22.23.1; confirmed `better-sqlite3`'s native binary
  loads and successfully queries `mypka.db`'s `journal` table under Node 22 —
  no ABI error.
- Edge session merged PR #3 into `main` (`76fcc7f`).
- Larry reconciled local git state across both sessions: discarded
  npm-lockfile metadata noise (twice — once before the merge, once after,
  caused by Larry's own `npm install` test runs), discarded an accidental
  `"mypka-cockpit": "file:.."` self-dependency that `npm --prefix web install`
  introduced into `web/package.json` as a side effect of testing, gitignored
  `.vscode/`, and fast-forwarded local `main` (which was significantly behind
  — missing PR #2 entirely) up to the merged `origin/main`.
- Confirmed final state: local `main` clean, `0` ahead / `0` behind
  `origin/main`.

## Decisions made

- **Question:** Was the `better-sqlite3` Windows build failure caused by a
  corporate proxy blocking the prebuilt-binary download, or a Node-ABI
  mismatch? **Decision:** ABI mismatch — `better-sqlite3` dropped prebuilt
  binaries for Node 20.x (ABI 115). Fix is pinning the portable-Node fallback
  to v22.x. The proxy-passthrough code stays in as harmless extra coverage
  for genuinely proxy-blocked networks, but it was not the root cause here.
- **Question:** Which branch should carry the verified Node-version fix —
  this session's local branch (`claude/windows-cockpit-launcher`, already
  merged via PR #2) or the Edge session's live PR #3 branch
  (`claude/cockpit-portable-node`)? **Decision:** PR #3 — committing to an
  already-merged branch would have orphaned the commit.
- **Question:** Track `.vscode/extensions.json` in git, or ignore it?
  **Decision:** Gitignore — editor-local config, matches the repo's
  minimal-tracked-files ethos.

## Insights

- Windows "App Execution Alias" entries (Settings → Apps → Advanced app
  settings → App execution aliases) can silently shadow a freshly-installed
  real interpreter/binary even after the installer succeeds and updates
  PATH. If a command "not found"-loops after a fresh install, check there
  before assuming the install failed.
- A parent process (e.g. VS Code) snapshots its environment/PATH at launch.
  New terminal tabs opened inside an *already-running* instance of that
  parent do **not** pick up PATH changes made after the parent started — a
  full restart of the parent app is required, not just a new terminal.
- Native Node modules (here, `better-sqlite3`) ship prebuilt binaries only
  for specific Node ABI ranges. Pinning a portable/bundled Node version below
  that range causes a silent fallback to from-source compilation, which then
  fails for an unrelated reason (no Python/build toolchain) — the real fix is
  often "bump the pinned Node version," not "fix the compile toolchain."
- Running `npm install` with a different npm version than the one that
  generated a committed lockfile can produce noisy libc-metadata diffs with
  no real dependency change — safe to discard, not worth committing.
- Running `npm --prefix web install` from a package with a sibling root
  `package.json` can cause npm to accidentally self-link the parent as a
  `file:..` dependency in `web/package.json` — watch for this stray
  dependency after installing in a workspace-adjacent subfolder.

## Realignments

- _(none — collaborative debugging session, no corrections to Larry's
  approach; Warwick's own auto-mode permission classifier blocked a couple of
  destructive `git checkout` actions until explicitly confirmed, which is
  the system working as designed, not a realignment.)_

## Open threads

- [ ] Workout-table task is still blocked. Warwick needs to locate and hand
      over real workout/GPX export data (Apple Health `export.xml`, Garmin,
      or Strava bulk export) before Silas can proceed.
- [ ] The GPX/workout → `health_workout`/`health_workout_route` ingest script
      referenced in `sqlite-extension/DATA-CONTRACT.md` §1/§6 does not exist
      yet — Silas wants to see the real export's shape before designing it
      (Apple Health XML differs significantly from Garmin/Strava per-activity
      files), rather than build it speculatively.

## Next steps

- Warwick exports real workout data and drops it under `PKM/`.
- Once available, route to Silas to design the ingest script against the
  real data shape, run `install-extensions.py --with-workouts` + the mirror
  regen, and verify routes/heat-trail render in the Cockpit.

## Cross-links

- [[2026-06-22-13-26_silas_governance-docs-mirror-tables]] — closest prior
  Cockpit/SQLite-mirror session log.
