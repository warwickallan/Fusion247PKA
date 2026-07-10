# UPDATE-COCKPIT: the Cockpit-code update lifecycle (SPEC)

> **THIS IS A SPEC, NOT A WORKING UPDATER.** It documents how the Cockpit's own
> code-update path should behave. The actual working updater, the versioned DB
> migrations, and the refuse-to-start guard must be **built and security-reviewed
> by Mack, Felix, Silas, and Vex before this ships.** Nothing here runs yet. Do
> not point a member at this as if it were executable.

## Why the Cockpit updates separately from the scaffold

The myPKA scaffold is markdown on disk. The scaffold updater
(`scripts/update-scaffold.py`) swaps framework markdown safely and **never touches
Expansion code** (all of `Expansions/*/` is sacred user-state to the scaffold
updater). The Cockpit is different in kind: it is a runtime Expansion with real
source code, an `npm` build, a local SQLite database (`mypka-cockpit.db`), and an
HTTP API. Updating it is a code deploy, not a file copy, so it needs its own
lifecycle, versioned on the Cockpit's own `expansion.yaml` SemVer (not the
scaffold version).

The scaffold updater's only job here is **detection and deferral**: if it sees
the installed cockpit is behind, it prints a notice and points the member at this
updater. It does not run it.

## Versioning

- The Cockpit's version lives in `expansion.yaml` (`version:`), and
  `package.json` / `web/package.json` / `package-lock.json` mirror it.
- The Cockpit's `CHANGELOG.md` tracks `expansion.yaml`, not the scaffold version.
- A release is identified by its `expansion.yaml` SemVer. MAJOR signals a
  breaking schema or API change (see the refuse-to-start guard below).

## The update lifecycle (target behavior)

1. **Pre-flight (read-only).**
   - Read the installed cockpit `expansion.yaml` version and the latest released
     version.
   - If already current, stop and say so.
   - Detect uncommitted local edits to cockpit source and surface them before
     proceeding (back up, do not clobber a member's local change silently, same
     principle as the scaffold updater).
   - Confirm prerequisites: Node.js v20+, Python 3 with PyYAML.

2. **Fetch the new cockpit source.**
   - Either a git-pull of a managed subtree/checkout, or apply a released source
     bundle for the target version. (Engineering choice for Mack/Felix; the
     Hermes-Agent pattern of a managed checkout that pulls in place is a
     reasonable model, kept separate from user-state.)
   - The fetch replaces **code only**. It must never write
     `mypka-cockpit.db`, the member's `PKM/Fleeting Notes/`, or `Team Knowledge/.env`.

3. **Install dependencies.**
   - `npm ci` (clean, lockfile-faithful install) in `Expansions/mypka-cockpit/`.

4. **Run the versioned DB migration.**
   - Apply forward-only, versioned migrations against `mypka-cockpit.db`.
   - Each migration is numbered, idempotent, and recorded in a
     `schema_migrations` table so re-running is safe.
   - **Back up `mypka-cockpit.db` before migrating.** Never an in-place
     destructive schema change without a backup the member can fall back to.
   - Migrations must be authored and reviewed by Silas.

5. **Rebuild the UI bundle.**
   - `npm run build` to regenerate `web/dist` (which is intentionally not shipped;
     it is rebuilt on the member's machine).

6. **Prompt restart.**
   - The Cockpit does **not** auto-launch (hard scaffold rule). Tell the member
     the update is staged and ask them to restart the Cockpit (re-run their
     launcher). Announce; the member starts it.

## Refuse-to-start guard (breaking changes)

For a MAJOR cockpit release (breaking schema or API change), the Cockpit server
**must refuse to start** when it detects a database or API contract older than
the running code expects, with a clear message:

- what changed and why it is breaking,
- the exact migration command to run,
- where the pre-migration backup of `mypka-cockpit.db` lives.

This prevents a half-migrated Cockpit from serving against a schema it cannot
honor. The guard checks the `schema_migrations` high-water mark against the
code's required minimum at boot.

## Hard rules (carry over from the scaffold)

- **Never write user-state.** `mypka-cockpit.db`, `PKM/Fleeting Notes/`, and
  `Team Knowledge/.env` are off-limits to the code swap (they are migrated or
  read, never overwritten by the code fetch).
- **No silent overwrite of a member's local source edit.** Back up first.
- **No auto-launch.** The Cockpit always waits for the member to start it.
- **Fail-closed.** On any ambiguity (dirty tree, failed migration, version
  mismatch), stop and surface the situation rather than guessing.

## Before this ships (build checklist for Mack / Felix / Silas / Vex)

- [ ] Mack/Felix: implement the working updater script (fetch, `npm ci`, build,
      restart prompt) with the back-up-before-overwrite behavior.
- [ ] Silas: author the versioned, idempotent `mypka-cockpit.db` migrations and
      the `schema_migrations` bookkeeping.
- [ ] Felix: implement the refuse-to-start guard in `server/server.js`.
- [ ] Vex: security review of the fetch path (source authenticity, no arbitrary
      code execution from an untrusted bundle), the migration runner, and the
      restart flow. **Blocking before public release.**
