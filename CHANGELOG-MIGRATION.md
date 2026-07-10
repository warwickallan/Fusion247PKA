# CHANGELOG-MIGRATION

This file is **machine-actionable**. An LLM reading only this file should be able to migrate any older myPKA scaffold folder to the latest version deterministically. Every section is structured for that purpose.

Per-version sections appear newest-first. To migrate, find the highest version newer than `<root>/.scaffold-version`, then apply each version's recipe in order from oldest to newest.

If `.scaffold-version` is missing, assume v1.x and apply every recipe from v1.10.0 onward.

## Why this file is structured this way

myPKA's principle is that the folder is the database. That implies the migration spec also lives in the folder, in plain markdown, readable by any LLM. The recipe uses **numbered, named steps** so an LLM running the recipe can announce "Step 3/9: creating tasks/ folders" and the user can audit. The validation script proves the migration succeeded structurally.

This is the myPKA discipline: nothing the user has to take on faith, everything inspectable.

---

## v4.0.0 (2026-06-22)

### Summary

The first non-purely-additive release. v4.0.0 introduces a real framework/user-state seam, written down as data in a new root `manifest.json`, plus the offline updater and boot-time version check that use it. This recipe is the **one-time bridge** that moves a 3.1.0 folder (which has no manifest) onto 4.0.0.

**This recipe never moves, renames, or modifies any of the member's own content.** It only lays down new framework files (the manifest, the two scripts, the slash command, the cockpit-updater SPEC), bumps the version files, and creates the `.mypka/` control folder. PKM, journals, tasks, session logs, Expansions, secrets, and databases are untouched. The breaking part is conceptual (a seam now exists), not destructive.

### Added

- `manifest.json` (root): version SSOT plus the `framework_paths` / `user_state_paths` seam as data.
- `scripts/update-scaffold.py`: offline, stdlib-only updater (dry-run by default).
- `scripts/check-version.py`: boot-time version check (announced-on, sends no user data, fail-silent offline).
- `.claude/commands/update-scaffold.md`: slash-command wrapper plus the portable "update myPKA" trigger.
- `Expansions/mypka-cockpit/scripts/UPDATE-COCKPIT.md`: SPEC for the separable cockpit-code updater (cockpit-owned; ships with the cockpit Expansion).
- `.mypka/`: control folder created by the updater on first run (backups, update log, active-manifest copy).

### Changed

- `VERSION` → `4.0.0` (now a mirror of the manifest, not the source of truth).
- `.scaffold-version` → `4.0.0` (now a mirror of the manifest).
- `CHANGELOG.md`: gains the `[4.0.0]` entry.

### Removed

- (none)

### Path mappings (3.1.0 → 4.0.0)

| Old path | New path | Migration |
|---|---|---|
| _(none: no existing file is moved or renamed)_ | | |

There are no path mappings. Every existing file stays where it is. All wikilinks continue to resolve. No `git mv` operations against existing files.

### Migration recipe

Each step is named and numbered. An LLM running this recipe should announce each step before executing it ("Step N/8: <name>") so the member can audit. Each step is idempotent: running the recipe twice produces the same result as running it once.

#### Step 1/8: Detect current scaffold version

Read `<root>/.scaffold-version` (or `<root>/manifest.json` `scaffold_version` if a manifest already exists).
- If a `manifest.json` exists with `scaffold_version` `4.0.0` or higher, this recipe is already applied. Stop.
- If the version is `3.1.0` (or below 4.0.0 and at/above 3.1.0), continue. (If it is below 3.1.0, apply the earlier recipes in order first, then return here.)

#### Step 2/8: Verify the folder is a myPKA scaffold

Check that `<root>/Team/` and `<root>/Team Knowledge/` both exist. If either is missing, this is not a myPKA scaffold: abort and surface the situation to the member.

#### Step 3/8: Surface conflicts before laying down new files

For each new framework file this recipe adds (`manifest.json`, `scripts/update-scaffold.py`, `scripts/check-version.py`, `.claude/commands/update-scaffold.md`), check whether it already exists in the target. If any already exists and differs from the 4.0.0 release copy, that is pre-existing or hand-edited work: stop and ask the member how to proceed before overwriting. If absent, proceed.

#### Step 4/8: Lay down the manifest and the update core

Copy from the 4.0.0 release:

```bash
ROOT="<scaffold-root>"
REL="<path-to-4.0.0-release>"

cp "$REL/manifest.json"                       "$ROOT/manifest.json"
mkdir -p "$ROOT/scripts"
cp "$REL/scripts/update-scaffold.py"          "$ROOT/scripts/update-scaffold.py"
cp "$REL/scripts/check-version.py"            "$ROOT/scripts/check-version.py"
mkdir -p "$ROOT/.claude/commands"
cp "$REL/.claude/commands/update-scaffold.md" "$ROOT/.claude/commands/update-scaffold.md"
```

If the cockpit Expansion is installed, also lay down the cockpit-updater SPEC (it ships with the cockpit, not the scaffold updater):

```bash
if [ -d "$ROOT/Expansions/mypka-cockpit/scripts" ]; then
  cp "$REL/Expansions/mypka-cockpit/scripts/UPDATE-COCKPIT.md" \
     "$ROOT/Expansions/mypka-cockpit/scripts/UPDATE-COCKPIT.md"
fi
```

Do NOT overwrite any file the member has hand-edited (Step 3 caught those). Skip and report.

#### Step 5/8: Create the `.mypka/` control folder

```bash
mkdir -p "$ROOT/.mypka/backups"
cp "$ROOT/manifest.json" "$ROOT/.mypka/active-manifest.json"
: > "$ROOT/.mypka/update-log.txt"
```

The updater also creates this folder on its first run, so this step is belt-and-braces. It is idempotent.

#### Step 6/8: Reconcile the manifest's Expansions block with what is installed

Open `<root>/manifest.json`, find the `expansions.items` block, and confirm each declared Expansion matches what is actually under `<root>/Expansions/` and the version in that Expansion's `expansion.yaml`. Remove entries for Expansions the member does not have; leave installed ones. This keeps the boot-time and updater Expansion notices accurate. Do NOT touch Expansion code.

#### Step 7/8: Write the version files (mirrors of the manifest)

```bash
echo "4.0.0" > "$ROOT/VERSION"
echo "4.0.0" > "$ROOT/.scaffold-version"
```

`manifest.json` is now authoritative; these two files are kept as back-compat mirrors and must read `4.0.0`.

#### Step 8/8: Append a session-log entry and validate

Append a migration session-log entry under `<root>/Team Knowledge/session-logs/<YYYY>/<MM>/` recording: version detected, files added, any conflicts skipped. Then run the validation script:

```bash
bash "$REL/validation-script.sh" "$ROOT"
```

Exit code 0 means the migration is structurally valid. Then regenerate the mirror (`mypka.db` is downstream of the markdown):

```bash
python3 "$ROOT/Team Knowledge/scripts/regen-mypka-db.py" 2>/dev/null || \
python3 "$ROOT/Expansions/mypka-cockpit/scripts/regen-mypka-db.py"
```

### Validation steps

After the recipe runs, the following must all be true:

- [ ] `<root>/manifest.json` exists, is valid JSON, and `scaffold_version` equals `4.0.0`.
- [ ] `<root>/manifest.json` contains both a `framework_paths` and a `user_state_paths` block.
- [ ] `<root>/VERSION` and `<root>/.scaffold-version` both equal `4.0.0` (trimmed).
- [ ] `<root>/scripts/update-scaffold.py` and `<root>/scripts/check-version.py` exist.
- [ ] `<root>/.claude/commands/update-scaffold.md` exists.
- [ ] `<root>/.mypka/` exists with `backups/` and `update-log.txt`.
- [ ] No file under `user_state_paths` (PKM, journals, tasks, session logs, Expansions, `.env`, databases) was modified by the recipe.
- [ ] A dry run of the updater against the 4.0.0 manifest reports "0 of your files touched" and refuses nothing it should not.

### Constraints (hard)

- **No destructive moves.** This recipe only adds files and bumps version mirrors. Nothing the member created is moved, renamed, or modified.
- **Never overwrite a hand-edited framework file silently.** Step 3 surfaces conflicts; skipped files are reported.
- **Expansion code is off-limits to the scaffold migration.** Expansions update on their own version via their own updater.
- **`manifest.json` is the source of truth.** `VERSION` and `.scaffold-version` mirror it.

### Rollback

If the folder is under git, git is the rollback:

```bash
cd "$ROOT"
git status
git restore .
git clean -fd      # removes the new files/folders the recipe created
```

If the folder is not under git, the new files this recipe added (`manifest.json`, the two scripts, the slash command, `.mypka/`) can simply be deleted and `VERSION` / `.scaffold-version` reset to `3.1.0`, since the recipe is purely additive. Recipe-runners must NOT run `git restore` / `git clean` or delete files without member confirmation. Surface these as the rollback path.

### Why v4.0.0 is bridged rather than additive

Earlier releases avoided changing any shipped file so a re-download could never collide with member edits. v4.0.0 is the release where that approach reaches its limit: shipping a safe self-updater requires a written-down boundary between our files and the member's. The bridge installs that boundary (the manifest plus the control folder) without disturbing any member content, so the breaking change is the new seam, not lost data. After this one-time bridge, every later update flows through the updater and is shown as a plan before it touches anything.

---

## v1.10.0 (2026-05-10)

### Summary

Adds team-internal task management and per-agent topical journals. **Purely additive — no existing files are moved, renamed, or modified.** v1.x folders gain new directories and a few template files. No content is destroyed.

### Added

- `Team Knowledge/tasks/` — markdown-first task management. Folder is status (open / in-progress / done / cancelled). One `.md` per task. Auto-rebuilt `INDEX.md`.
- `Team Knowledge/tasks/_template.md` — starter file for new tasks. Frontmatter includes the six required cross-reference arrays.
- `Team Knowledge/tasks/INDEX.md` — auto-generated summary view.
- `Team Knowledge/tasks/{open,in-progress,done,cancelled}/.gitkeep` — placeholders so empty folders survive in git.
- `Team/<Name> - <Role>/journal/` — per-agent topical durable notes (one folder per existing specialist).
- `Team/<Name> - <Role>/journal/_template.md` — starter file for new journal entries.
- `.scaffold-version` — plain-text file at root containing `1.10.0`.
- New SOPs in `Team Knowledge/SOPs/`:
  - `SOP-create-task.md`
  - `SOP-claim-task.md`
  - `SOP-close-task.md`
  - `SOP-list-open-tasks.md`
  - `SOP-rebuild-task-index.md`
  - `SOP-write-journal-entry.md`
  - `SOP-read-own-journal.md`
  - `SOP-write-session-log.md`

### Changed

- (none — no existing structure is modified)

### Removed

- (none)

### Path mappings (v1.x → v1.10.0)

| Old path | New path | Migration |
|---|---|---|
| _(none — additive release)_ | | |

There are no path mappings. v1.x files stay where they are. Wikilinks pointing to v1.x paths continue to resolve. No `git mv` operations against existing files.

### Migration recipe

Each step is named and numbered. An LLM running this recipe should announce each step before executing it ("Step N/9: <name>") so the user can audit. Each step is idempotent — running the recipe twice produces the same result as running it once.

#### Step 1/9 — Detect current scaffold version

Read `<root>/.scaffold-version`.
- If the file exists and contains `1.10.0` or higher, this recipe is already applied. Stop.
- If the file is absent or contains a version below `1.10.0`, continue.

#### Step 2/9 — Verify the folder is a myPKA scaffold

Check that `<root>/Team/` and `<root>/Team Knowledge/` both exist. If either is missing, this is not a myPKA scaffold — abort and surface the situation to the user.

#### Step 3/9 — Surface conflicts before destructive overlay

If `<root>/Team Knowledge/tasks/` already exists with files in it, that's pre-existing user work. Stop and ask the user how to proceed before overwriting any template.

Same check for any `<root>/Team/*/journal/` folder that already has files.

If both are absent or empty, proceed without prompting.

#### Step 4/9 — Create task folders and template files

```bash
ROOT="<scaffold-root>"
mkdir -p "$ROOT/Team Knowledge/tasks/open"
mkdir -p "$ROOT/Team Knowledge/tasks/in-progress"
mkdir -p "$ROOT/Team Knowledge/tasks/done"
mkdir -p "$ROOT/Team Knowledge/tasks/cancelled"

touch "$ROOT/Team Knowledge/tasks/open/.gitkeep"
touch "$ROOT/Team Knowledge/tasks/in-progress/.gitkeep"
touch "$ROOT/Team Knowledge/tasks/done/.gitkeep"
touch "$ROOT/Team Knowledge/tasks/cancelled/.gitkeep"
```

There is **no `blocked/` folder**. Blocked tasks live in `in-progress/` with `blocked_reason` set in their frontmatter. (See `SOP-claim-task` for the full convention.)

Copy these files from the v1.10.0 release `templates/` directory:
- `templates/tasks/_template.md` → `<root>/Team Knowledge/tasks/_template.md`
- `templates/tasks/INDEX.md` → `<root>/Team Knowledge/tasks/INDEX.md`
- `templates/tasks/open/EXAMPLE-tsk-2026-05-10-001-welcome-to-tasks.md` → `<root>/Team Knowledge/tasks/open/tsk-<TODAY>-001-welcome-to-tasks.md` (rename the date prefix to today's date so it sorts correctly)

#### Step 5/9 — Create per-agent journal folders

For each subdirectory of `<root>/Team/` that follows the `<Name> - <Role>` pattern AND contains an `AGENTS.md`:

```bash
for AGENT in "$ROOT/Team/"*/; do
  [ -f "$AGENT/AGENTS.md" ] || continue
  mkdir -p "$AGENT/journal"
  cp "<release>/templates/journal/_template.md" "$AGENT/journal/_template.md"
done
```

Do NOT create journal folders for `agent-index.md` or any non-agent subdirectory.

#### Step 6/9 — Copy the new SOPs

```bash
cp <release>/sops/SOP-create-task.md          "$ROOT/Team Knowledge/SOPs/"
cp <release>/sops/SOP-claim-task.md           "$ROOT/Team Knowledge/SOPs/"
cp <release>/sops/SOP-close-task.md           "$ROOT/Team Knowledge/SOPs/"
cp <release>/sops/SOP-list-open-tasks.md      "$ROOT/Team Knowledge/SOPs/"
cp <release>/sops/SOP-rebuild-task-index.md   "$ROOT/Team Knowledge/SOPs/"
cp <release>/sops/SOP-write-journal-entry.md  "$ROOT/Team Knowledge/SOPs/"
cp <release>/sops/SOP-read-own-journal.md     "$ROOT/Team Knowledge/SOPs/"
cp <release>/sops/SOP-write-session-log.md    "$ROOT/Team Knowledge/SOPs/"
```

If any of these SOP filenames already exist in the target, do NOT overwrite. Surface the conflict to the user.

#### Step 7/9 — Write the version file

```bash
echo "1.10.0" > "$ROOT/.scaffold-version"
```

#### Step 8/9 — Append a session-log entry recording the migration

Path: `<root>/Team Knowledge/session-logs/<YYYY>/<MM>/<YYYY-MM-DD-HH-MM>_<actor>_migrated-to-v1.10.0.md`

Where `<actor>` is the agent or LLM running the migration (e.g. `larry`, `claude`, `gpt`).

Frontmatter:
```yaml
---
agent_id: <actor>
session_id: <YYYY-MM-DD>-migration-v1.10.0
timestamp: <RFC3339-UTC>
type: end-of-session
linked_sops: [SOP-create-task, SOP-write-journal-entry]
linked_workstreams: []
linked_guidelines: []
linked_tasks: []
linked_journal_entries: []
---
```

Body should describe: what version was detected, what was added, any conflicts encountered.

#### Step 9/9 — Run the validation script

The release ships `validation-script.sh`. Run it against the migrated folder:

```bash
bash <release>/validation-script.sh "$ROOT"
```

Exit code 0 means the migration is structurally valid. Non-zero means something is missing or malformed — read the script's output and fix.

### Validation steps

After the recipe runs, the following must all be true. The validation script (`validation-script.sh`) checks each.

- [ ] `<root>/.scaffold-version` exists and equals `1.10.0` (trimmed).
- [ ] `<root>/Team Knowledge/tasks/{open,in-progress,done,cancelled}/` all exist as directories.
- [ ] `<root>/Team Knowledge/tasks/INDEX.md` exists.
- [ ] `<root>/Team Knowledge/tasks/_template.md` exists.
- [ ] Every `<root>/Team/<Name> - <Role>/AGENTS.md` has a sibling `journal/` directory.
- [ ] Each journal directory has a `_template.md`.
- [ ] All eight new SOPs exist in `<root>/Team Knowledge/SOPs/`.
- [ ] No file named `tsk-*.md` exists outside `<root>/Team Knowledge/tasks/` (catch accidental spillage).
- [ ] No wikilinks of the form `[[tasks/<status>/...]]` exist anywhere — links must be by basename only.
- [ ] Every task file has the six required `linked_*` arrays in frontmatter (validation script checks task files for `linked_sops`, `linked_workstreams`, `linked_guidelines`, `linked_my_life`, `linked_session_logs`, `linked_journal_entries`).

### Constraints (hard)

- **No destructive moves without explicit user OK.** This recipe is additive. No destructive moves in v1.10.0.
- **All file moves preserve git history.** Use `git mv`, not `cp + rm`. (Not applicable in v1.10.0 since nothing is moved.)
- **Wikilinks must be patched in the same commit as the move that broke them.** (Not applicable in v1.10.0.)
- **Templates are never overwritten if a file with the same name already exists.** Surface the conflict; let the user decide.

### Rollback

Git is the rollback. Before running the migration, the recipe instructs the user to commit. If anything goes wrong:

```bash
cd "$ROOT"
git status                # see what changed
git restore --staged .    # if anything was staged
git restore .             # discard unstaged changes
git clean -fd             # remove the new directories the recipe created
```

Recipe-runners must NOT run `git restore`/`git clean` themselves without user confirmation. Surface these commands as the rollback path.

### Why v1.10.0 is additive

The brief required v1.x folders to keep working unchanged. v1.10.0 is a capability addition (tasks, journals, version tracking, migration spec) layered on top of the existing scaffold. Anything that would have required moving or renaming existing content was deferred to a later major version where the breaking change is named and isolated.

This keeps the upgrade trivially reversible and the user's existing wikilinks intact.

---

## Notes for LLMs reading this file

- Versions are listed newest-first in this file. Apply recipes in chronological order (oldest first) when migrating from below the current `.scaffold-version`.
- Each recipe is **idempotent**. Re-running has no negative effect. If you're uncertain whether a recipe completed, run it again.
- When a step says "if X is missing, abort," abort means: stop the migration, do not proceed to the next step, surface the situation in plain language to the user.
- When a step says "do not overwrite," that means: skip the operation for that file specifically; continue with the rest of the recipe; report the skipped file at the end.
- Never invent steps not in the recipe. If you think a step is needed that isn't here, surface it as a question to the user before acting.

The `.scaffold-version` file is the single source of truth for what migration applies. Read it first. Always.
