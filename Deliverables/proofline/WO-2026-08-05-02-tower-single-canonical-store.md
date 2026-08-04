# WO-2026-08-05-02 — WP-2F: one canonical Tower store (SQLite)

| Field | Value |
|---|---|
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | Keel |
| **governance_head** | `c3eb1af1b93f657638fa5521a64e8361f53822bd` |
| **authorised_by / date** | Warwick, 2026-08-05 — map §14.0, direction **W-5** |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **§14.8 is the decision and its evidence. Read it before planning** |
| **branch** | `build-020/tower-canonical-store`, cut from `c3eb1af` or later on `build-020/live-trial` |
| **worktree** | Keel creates and owns one, cut from that exact SHA. **NOT from `origin/main`** (~57 commits behind) |
| **file_surface** | `services/control-plane/tower-loop/mergeCheck.mjs` · `services/control-plane/tower/merge-check.mjs` · `services/control-plane/tower-loop/apply.mjs` · `services/control-plane/tower-loop/db/` (new schema file) · `services/control-plane/tower-loop/db.mjs` (**only** if `TIMESTAMP_COLUMNS` registration requires it) · `services/control-plane/tower-loop/test/**` (tests for the above) |
| **acceptance_property** | `mergeCheck` runs end-to-end against **`~/.mypka/tower/tower.db`** — the same store the live watcher uses — creating and reading `tower.merge_check_run` and `tower.merge_check_message`, with **no `pg` connection attempted anywhere on the path** |
| **private_surface** | **`C:\.fusion247\` — READ ONLY**, and only `tower-baton.env` / `control-plane-dev.env` for credential *presence* checks. **Never write there. Never print a secret value.** GL-012 applies |
| **credential_scope** | none |
| **network** | **none required.** If any test needs a network call, that is a defect — say so |
| **live_authority** | **none.** Do NOT restart or kill the live watcher **PID 31268**. Do NOT delete or alter the Supabase `tower` schema |
| **veritas_gate** | Phase 2 gate (§14.0c) — contributes to **S-3** |
| **integration_owner** | Larry |
| **document_impact** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **owner: larry** · `services/control-plane/tower/README.md` — **owner: keel**, if it names the store |
| **out_of_scope_policy** | report-only |
| **operational_handoff** | none — change inside a released subsystem, not a service handed to Mack. **No `runbook_path` owed** |
| **blocking_dependencies** | none |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ `c3eb1af` |
| **review_ceiling** | not an assurance dispatch |

## The decision — already taken, not yours to re-open

**SQLite at `C:\Users\Buggly\.mypka\tower\tower.db` is the single canonical Tower store.** The reasoning and its counter-argument are in map §14.8. **Warwick's stated preference was Supabase and it was overridden on executed evidence** — if your preflight overturns that evidence, say so immediately rather than building.

**`cockpit.*` stays Supabase-resident and is out of scope entirely.** Verified: the 8 `cockpit/*.mjs` and `worker/*.mjs` modules contain zero `tower.*` references. **Do not touch them.**

## Outcome owed

**One store. `mergeCheck` works against the live SQLite file, and nothing on the Tower path opens Postgres.**

## Route — from executed reconnaissance, verify before trusting

1. **Add `db/merge_check_schema.sql`** + `applyMergeCheckSchema(db)` in `apply.mjs`, following the existing five-applier pattern, registered in `applyAll`. Two tables: `merge_check_run` (id uuid, pr_number int, build_ref text, wp_ref text, head_sha text, status text, rounds int, created_at, updated_at) and `merge_check_message` (id uuid, run_id uuid → run.id, seq int, sender text, round int, status text, text text, head_sha text, created_at). The DDL currently lives inline at `services/control-plane/tower/merge-check.mjs:59,65` — **read it there rather than trusting this summary.**
2. **Two known SQLite traps, both already paid for on this estate:** in DDL the schema qualifier goes on the **index** name, not the table. Add `created_at`/`updated_at` to `TIMESTAMP_COLUMNS`. **Neither table has a boolean column, so the `BOOLEAN_COLUMNS` trap does NOT apply — stated explicitly so nobody "fixes" it into existence.**
3. **Repoint two files**: `pg.Pool`/`pg.Client` → `openDb()`. `db.mjs` is already a pg-shaped façade returning `{rows, rowCount}`, so call sites mostly stand — but **the SQL literals are `$1`-style and better-sqlite3 needs `?`**. Roughly 8 statements in `mergeCheck.mjs` (~lines 61, 65, 75, 80, 84, 88, 99, 126) and a comparable handful in `tower/merge-check.mjs`. `now()` already exists as a SQLite function — `updated_at=now()` needs no change.
4. **Delete the inline DDL** in `tower/merge-check.mjs` in favour of the applier, **and drop the hard-coded `import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js'`** — an absolute path into one worktree is exactly the class of defect this phase exists to remove.
5. **`accept.mjs` — decide, do not migrate by reflex.** Establish whether it is on any live or documented route. **If it is dead, say so and leave it; report, do not remove.**
6. **Do NOT migrate the Postgres data.** Out of scope per the migration plan. The Supabase `tower` schema (922 turns, 172 reviews, 29 merge-check runs) stays as **read-only history**. Document it as such where the code names it.

## Acceptance evidence — executed, pasted

- **Establish the tower-loop baseline BEFORE changing anything.** The suite is ~24 subtests via `test/run-tower-loop-tests.mjs`. **`test:tower-loop` is NOT in the `test` aggregate in `package.json`**, so a repo-wide `npm test` would not catch a regression in exactly this subsystem. Record before and after.
- **Assert `# tests` and `# fail` — never the exit code.** `node --test` returns exit 0 on zero tests and counts non-test helpers under `test/` as passing entries that asserted nothing (P-8, measured on this estate).
- **The acceptance property proven end-to-end**: a real `mergeCheck` run creating a `merge_check_run` row and its messages in the live-shaped SQLite store, read back. Use a **throwaway DB path via `TOWER_SQLITE_PATH`** — `db.mjs` honours it — so the live `tower.db` is never written by a test.
- **A negative assertion that no Postgres connection is attempted** on the merge-check path. A static import/source assertion is acceptable **if labelled a limitation rather than a proof**, per this estate's standing rule on negative claims.
- `bash scripts/secret-scan.sh --surface <each declared path>` — **`--surface` mode only. A repo-wide green says nothing about a declared surface.**

## Read-back gate — MANDATORY

**Return a READ-BACK and HOLD.** State the outcome in your own words · your method · what this order fails to settle · what looks wrong in it. **Preflight against reality and `REFUSE` if under-specified** rather than guessing — the last two orders on this build were improved by exactly that.

`export MSYS_NO_PATHCONV=1` before any Windows command.

Git for your branch is yours to execute. You do not decide the merge.
