# WO-2026-08-05-02 — WP-2F: one canonical Tower store (SQLite)

> ## AMENDMENT 1 — 2026-08-05. Keel returned `REFUSE` on five grounds. All five are upheld.
>
> **The gravest is mine and is a GL-012 breach:** v1 declared `private_surface: C:\.fusion247\` — **the secrets-store ROOT**. GL-012 permits exactly one `private/<project>/**` subtree, never the root. It was compounded by naming two `.env` files as its purpose, which is credential material that `credential_scope: none` forbids everywhere. **Keel was contract-bound to refuse it and did.** There is no correct subtree to substitute, because **the work needs no access to that store at all** — `getEnvVal()` reads those files at CLI runtime, not the builder. **`private_surface: none`. The credential-presence check is STRUCK.**
>
> **The second most serious is a near-miss on spend and an outward action.** v1's evidence section demanded *"a real `mergeCheck` run end-to-end"*. `runMergeCheck` is not offline — it spawns a **real Codex execution** (spend, and a draw on the three-per-gate budget) and POSTs **two Telegram messages to Warwick's phone**. **I nearly authorised spend and an outward notification inside an acceptance criterion.** Resolved in Amendment 1 §C. **Neither is authorised.**
>
> Three further grounds upheld: `node_modules/` absent so **no** evidence command could execute · `tower/README.md` required by route step 6 but outside the surface · the `acceptance_property` demanded a write to the live store that `live_authority: none` forbids.
>
> **The SQLite decision stands, undisturbed by preflight.** Keel executed the one premise that could have silently sunk it — `INSERT … RETURNING` through the `db.mjs` façade — against the real dependency (better-sqlite3 13.0.2, SQLite 3.53.4, `stmt.reader === true`, row returned). It holds. **One additional fresh read-back is authorised; if Amendment 1 is sound, proceed straight to implementation.**

## Amendment 1 — envelope changes

| Field | Amended value |
|---|---|
| **private_surface** | **`none`.** Nothing under `C:\.fusion247\**`. **GL-012 NOT engaged.** The credential-presence check is struck from the order |
| **file_surface** | v1's list **PLUS**: `services/control-plane/tower/README.md` · `services/control-plane/tower/test/**` · **`services/control-plane/node_modules/**` for install only** (gitignored, never enters the diff) |
| **install authority** | **`npm ci --offline --ignore-scripts` in `services/control-plane/` is AUTHORISED.** Keel established plain `--offline` fails (better-sqlite3 falls back to node-gyp; no Visual Studio present) while `--ignore-scripts` succeeds in ~1s from cache with **no network**, shipping `prebuilds/win32-x64.node`. **`network: none` still binds for everything else** |
| **acceptance_property** | **REWRITTEN.** `mergeCheck` runs end-to-end against a **`TOWER_SQLITE_PATH` temp store**, creating and reading `tower.merge_check_run` and `merge_check_message` — **and, separately, `defaultDbPath()` is asserted to resolve to `~/.mypka/tower/tower.db` with the variable unset.** Together these prove it reaches the canonical store **without writing it.** v1's version was unsatisfiable against `live_authority: none` |

## Amendment 1 §C — how the merge-check path is proven, WITHOUT spend and WITHOUT dinging Warwick

**Explicitly forbidden: spawning a Codex execution, and sending any Telegram message.** Keel's analysis is adopted:

- **Seven of the eight SQL statements are reachable fully offline** via the fail-closed and evidence-unresolved branches. **Exercise them through the real code path.**
- **The single remaining statement** (`update … set status, rounds, head_sha, updated_at=now()`) requires a completed Codex round. **Execute that literal directly against the temp store and LABEL IT as a direct-statement test, not an end-to-end proof.** That labelling is the requirement, not a concession — this estate does not dress a narrower proof as a wider one.

## Amendment 1 — corrections to v1's own facts, from Keel's execution

| v1 said | Reality |
|---|---|
| "~24 subtests" | **41 subtests.** The runner is bespoke, prints `executed=N failures=N`, and **already exits 1 on zero executed** — so the `node --test` hazard does **not** apply to that command. It **does** apply to `test:tower-loop-unit` |
| "`test:tower-loop` is not in the `test` aggregate" | True — **but it IS in CI**: `.github/workflows/control-plane-tests.yml:120`, path-filtered on `services/control-plane/**`. **These changes will trigger it** |
| "Add `created_at`/`updated_at` to `TIMESTAMP_COLUMNS`" | **Already done** at `db.mjs:61-64`. Route step 2 is a no-op; on current evidence **`db.mjs` needs no change at all** |
| "`$1` → `?`" summarises the change | **Understates it. Two dialect defects v1 did not name**, both in surface: `tower/merge-check.mjs:193` uses `left(instruction,140)` (Postgres-only → `substr(x,1,140)`), and `ensureSchema` opens `create schema if not exists tower`, which SQLite has no concept of |

## Amendment 1 — three findings RULED, so they are not carried as open questions

1. **`accept.mjs` — leave the code untouched, and EXCLUDE it from the negative assertion.** It is Postgres-only with zero code callers, but two surfaces describe it as *"Real Codex/Telegram/Supabase acceptance — run by Warwick"*. **Scope the "no `pg` on the path" assertion to the two merge-check files only, and say so.** That two documents will then point a human at a store this order designates archive-only is a **documentation-effect finding reported once for Warwick's decision** — not this Work Order's to fix, and not a new Work Order.
2. **`tower/merge-check.mjs:22` `const REPO = 'C:/Fusion247PKA'` — report, do not change.** Keel is right that it is the same defect class, and right that changing it changes *which repository merge-check reviews*. That is a design decision and it is **out of scope for WP-2F**.
3. **Keel's framing correction is accepted and matters beyond this order:** the live watcher runs from the **main worktree** on `build-015/live-acceptance-recovery-2026-08-03`. So *"the same store the live watcher uses"* is true of the **file** and false of the **code** — this change reaches the live watcher's checkout only at integration. **Recorded in the map against S-3, because it bounds how that gate may be claimed.**

---

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
