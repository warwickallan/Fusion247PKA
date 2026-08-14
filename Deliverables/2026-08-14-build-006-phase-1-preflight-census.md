# BUILD-006 Phase 1 — preflight census

**Established by reading files and probing this machine on 2026-08-14, at `4135fd3`.** Facts only. Where
something does not exist, the search that established its absence is named. This exists so Phase 1 does not
rediscover any of it mid-build, and so the Work Order's assumptions can be checked against something
other than Larry's recollection.

---

## 0. The finding that changed the Work Order

**The BUILD-006 map's §6 F4 says "reuse `services/control-plane/worker` — do not build a second framework."
Taken literally against Warwick's 2026-08-14 Supabase ruling, that instruction cannot be followed at
Phase 1, for three independently sufficient reasons:**

1. **The worker's own DDL forbids it.** `services/control-plane/db/migrations/001_control_plane_min_schema.sql`
   lines 33–40 carry a header: *"!! DESIGN ARTIFACT — DEV SCHEMA ONLY. DO NOT APPLY TO PROD. !! … it must
   NEVER touch the `asdair` schema or any personal/entrusted data. A live apply is Larry-gated and must
   target an ISOLATED dev database."* The Supabase project is not an isolated dev database — it holds
   `asdair.*` and `session_report.*` live.
2. **There is no package boundary to import through.** No root `package.json` and no npm workspace exist
   (`ls package.json` → absent). `services/control-plane/package.json` is `@fusion247/control-plane-db`,
   `private: true`, with **no `exports` and no `main`**. `services/control-plane/worker/` has no
   `package.json` of its own. So `import … from '@fusion247/control-plane-db'` cannot resolve. The only
   two mechanisms that exist are a relative import across two services — **for which there is no precedent
   anywhere in this repo** — or copying.
3. **Phase 1 does not need a job queue.** Its gate is *intake lands a durable seed with stable identity;
   kill mid-intake and it recovers; identity survives restart.* That is a durable state machine, not a
   worker pool. The queue matters at Phase 6 (production orchestration), which is where F4's reuse
   instruction actually pays.

**Disposition (Larry, under §11 "decided without Warwick: application architecture … orchestration, retry,
idempotency and recovery design"):** Phase 1 builds its own `vlogops` schema in Supabase and lifts the
*durable-resumability patterns* the map already names as the best reference —
`services/asdair/pipeline`'s guarded transitions, generation-carrying idempotency keys and command ledger —
rather than importing or copying the `ops.*` queue. **F4's reuse instruction is deferred to Phase 6, not
discarded.** No second framework is built: nothing generic is created, only the tables Phase 1 needs.

---

## 1. Database connection convention

Every Postgres consumer uses the **`pg` npm driver with a DSN from an environment variable**. There is no
shared connection module, no ORM, and the Supabase JS client is not used for data access anywhere.

| Var | Read at | Role |
|---|---|---|
| `ASDAIR_DB_URL` | `services/asdair/pipeline/deps.js:109`, throws at `:111` | connects as `asdair_ro`, SELECT-only |
| `ASDAIR_WRITE_DB_URL` | `services/asdair/pipeline/deps.js:121`, throws at `:123` | connects as `asdair_rw`, narrow write, no DELETE |
| `DATABASE_URL` | `services/control-plane/worker/db.mjs:13`, fail-fast at `:15` | dev worker only |
| `CONTROL_PLANE_DEV_DATABASE_URL` | `tower-loop/accept.mjs:26` | **retired** for the tower store — `tower-loop/apply.mjs:31` states the store is now SQLite |

- Pools are **lazily** constructed so the pure surface loads with no deps installed (`deps.js:104-128`).
- Every read path wraps in `BEGIN TRANSACTION READ ONLY` (`deps.js:132-137`) — belt and braces over the grant.
- **Values live outside the repo.** `services/asdair/.env.example:14`: *"Real values live OUTSIDE this
  repository, under `C:\.fusion247\`, and are passed with `node --env-file=`. Nothing in this repo opens one."*
- Startup validation is real: `ensure-asdair-runtime.mjs --preflight` **connects and asserts which role
  answered**, with BLOCKING vs ADVISORY severity per variable.
- `SUPABASE_URL` / `SUPABASE_SECRET_KEY` appear only in `services/fusion-capture-gateway/.env.example:64-70`,
  and that file states at line 11 that `DATABASE_URL` is the only runtime secret — **the Data API keys are
  not the runtime path.** `DATABASE_SSL_CA_FILE` is the convention for pinning the Supabase CA.
- `supabase/config.toml` is **functions-only**; line 13 says *"this repo does not run `supabase start`."*

## 2. Migration convention

- **No `db/` at repo root.** Five separate migration sets, three different naming conventions.
- `services/control-plane/db/mypka/` — `NNN_snake_case.sql`, step 10, **highest = `280_youtube_note_attempts.sql`**.
- `services/asdair/db/` — `001_…` to **`021_regulars_display_name.sql`**, with gaps.
- **There is no migration runner and no ledger table in this repo.** The only thing that applies the mypka
  set is a *test*: `services/control-plane/db/mypka/test/apply-teardown-full.test.mjs:20-22` enumerates
  `/^\d{3}_.*\.sql$/`, sorts numerically, applies, re-applies for idempotency, then applies `teardown.sql`.
  Live application is manual and out-of-band.
- **The two colliding `220_` migrations both still exist** (`220_system_improvement_candidate.sql`,
  `220_youtube_extract_attempts.sql`). The comparator returns `220-220=0`, so their order falls back to
  directory order — **the ordering is incidental, not determined by the numbering.** Recorded; **not this
  build's to fix.**
- **Cross-check against the live project (Supabase MCP, 2026-08-14):** the applied-migration ledger there
  ends at `019_shopping_list_shop_identity`, while the 2026-08-14 close-session records **020 and 021 as
  applied to live**. Both can be true — but **that ledger is not a complete record of that database**, and
  no numbering may be derived from it.

## 3. Live Supabase project state (measured via MCP, 2026-08-14)

- Schemas present: **`asdair.*` (25 tables) and `session_report.*` (4 tables). `public` is empty.**
- **`ops.*` does not exist there. `tower.*` does not exist there.**
- Row counts of note: `asdair.regulars` 109, `asdair.shopping_list_items` 238, `asdair.shop_line` 155,
  `session_report.capae_occurrence` 41.
- RLS is disabled on those tables. **This is Warwick's own worked example of a PARKED finding**
  (`CLAUDE.md` § HOBBY BRAIN rule) and is recorded here only so its absence from the Work Order is
  deliberate rather than an oversight.

## 4. The reuse target — `services/control-plane/worker/`

Ten files, no subpackage, no `package.json`. Exports exactly nine names from `index.mjs:19-26`:
`createPool, requireDatabaseUrl, enqueue, HandlerRegistry, Worker, Reclaimer, appendEvent, hashPayload, createLogger`.

Facts that would bite a naive reuse:

- **`pg` is a *devDependency*** of `services/control-plane`, while `worker/db.mjs:7` imports it at runtime.
- **The idempotency key is GLOBAL across queues** (`enqueue.mjs:62-67`) — a dedupe hit whose
  `job.queue !== jobType` throws loudly. That is a real constraint on any key scheme built on it.
- **Event kinds are allowlisted** (`events.mjs:96`) and delivery-key prefixes are frozen (`events.mjs:38`),
  so adding a VlogOps kind means **editing control-plane** — reuse is not additive from outside.
- Import is inert by design: the bootstrap is gated on `import.meta.url === argv[1]`, and the former
  `WORKER_MAIN=1` ambient trigger was **removed** so an env var can never make an `import` start timers or
  DB work. Good precedent to copy.

## 5. Service shape precedent

**`services/proofline/` is the cleanest recent precedent** and the one Phase 1 should follow:
`bin/` · `src/{app,config,canonical,processor,recovery,server,store,worker}.mjs` · `test/*.test.js` +
`test/helpers/harness.mjs` · `README.md` · **`RUNBOOK.md`** · `package.json` (`private`, `type: module`,
`engines.node >=22`, **zero dependencies**, `test: "node --test"`, and a `scan` script invoking
`scripts/secret-scan.sh --surface services/proofline`).

- **Config validation precedent:** `services/proofline/src/config.mjs` — `loadConfig(env)` accumulates an
  `errors[]` and throws **one** aggregated `Error` with `err.code = 'EPROOFLINECONFIG'` (lines 54-58).
  Non-negotiables are module constants, not env: `export const HOST = '127.0.0.1'` with the comment *"no
  environment variable may widen it"*.
- **Health endpoints barely exist in this estate.** Searching `/health`, `/healthz`, `/readyz` across
  `services/` and `tools/` returns **exactly one** hit: `services/proofline/src/server.mjs:226`.
- **Test layout is split:** asdair co-locates `*.test.js` beside modules and uses a distinct `*.dbtest.js`
  suffix so `node --test` does not pick DB tests up; proofline uses a separate `test/` directory.
- **Runbooks are weakly established, not a convention** — three files repo-wide, only one service-level
  (`services/proofline/RUNBOOK.md`).

## 6. VlogOps code: absent

**No VlogOps implementation exists anywhere.** `ls services/` → `asdair cockpit control-plane
fusion-capture-gateway fusion-tower hub obsidiwikai proofline tower-baton`. A case-insensitive grep for
`vlogops|vlog_ops` across the repo returns only prose — in `Deliverables/`, `Builds/`, `Team Knowledge/`,
`Team/`, `.claude/`, `AGENTS.md` — plus four comment-only mentions in code
(`control-plane/cockpit/t2-calibrate.mjs:137`, `fusion-capture-gateway/migrations/0001_…sql:44`,
`tools/governor/continuity.mjs:190`, `tools/governor/reorient.mjs:19,758`). `find . -iname "*vlog*"` returns
three documentation paths. **Phase 1 is genuinely a greenfield service.**

## 7. CI

Twelve workflows. **Nothing would run against `services/vlogops/**` today** — every service workflow is
path-filtered to its own directory and there is no catch-all.

Two workflows deliberately carry **no** path filter, and their stated rationale is repo policy worth
obeying rather than paraphrasing:

> `secret-scan.yml:7-9` — *"deliberately NO path filter. A path-filtered workflow that stops running
> disappears from `gh run list` and leaves a wall of green over a control nobody is executing."*

> `cockpit-private-apps.yml:13-15` — *"an absent run is indistinguishable from a green one at a glance —
> this estate has already been burned by exactly that."*

And it has: `build-002-tests.yml:23-27` records a migration-only change that *"went green BY NEVER
RUNNING"* until `services/asdair/db/**` was added to the filter on 2026-08-10.

**Two existing DB-CI patterns to copy:** `control-plane-tests.yml:19` uses a Postgres service container
with `REUSE_DATABASE_URL=1`, and its runners **fail on zero executed subtests**.

⚠️ **`services/proofline/` and `services/obsidiwikai/` have NO CI workflow at all** — the most recent
service precedent shipped without one. Phase 1 does not repeat that.

## 8. Machine capability (probed 2026-08-14)

- `node` **v22.18.0**, `npm` present (`C:\Program Files\nodejs`).
- `initdb`, `postgres`, `pg_ctl`, `psql` **all on PATH** from
  `C:\Users\Buggly\scoop\apps\postgresql\current\bin`. `POSTGRES_BIN` is unset but unnecessary.
- **Therefore a disposable local Postgres cluster can be provisioned, and Phase 1 can be proven end to end
  without any connection to the live Supabase project.**

---

**Provenance:** §§1–7 from a read-only census agent working from files at `4135fd3`, every claim carrying a
`file:line` citation in its return. §3 from the Supabase MCP against the live project. §8 from a direct
probe of this machine. §0's disposition is **Larry's**, taken under the map's §11, and is the only
judgement in this document — everything else is measurement.
