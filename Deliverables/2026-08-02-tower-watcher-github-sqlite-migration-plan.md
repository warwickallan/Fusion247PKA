# Wayfinder plan — Tower watcher migration: GitHub-driven, SQLite-backed

## START / RESUME HERE — ordered by Warwick

- This Git Wayfinder is the sole route and source of truth.
- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- Read the current phase, gate and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer.
- Continue autonomously until completion or a genuine Warwick-only blocker.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate and next action.
- **Tangents go in "SHIT TO DO" below. Do not chase them.** See the rule there — it binds even when the tangent comes from Warwick.

*(Verbatim from the proven map, per standing instruction. Byte-identical: SHA-256 `2c615931a799ce099072510e83a977b9324c7d74319b1884b3967be9b1dc4c51`.)*

## SHIT TO DO — parked tangents

**THE RULE.** Tangents get written here and the plan continues. They are worked at the **end**.

| # | Parked item | Why it is not now |
|---|---|---|
| 1 | **BUILD-019 Phase 1** — website skeleton. Authorised, mapped, ready. | Warwick paused it until both acceptance journeys here pass |
| 2 | **Legacy `services/tower-baton/` (BUILD-010, ClickUp-driven)** — what happens to it once this migration lands. Retiring it is the obvious end state, but retiring a working control is its own decision with its own evidence. | Not this migration. Decide once the GitHub watcher has run unattended for real |
| 3 | **Layer-1-before-layer-2 audit gap** (README known limit): a genuinely stale comment is refused at the poller before `ingestComment.mjs` can persist it as `applied=false`, so the audit trail differs by path. Pre-existing, fails closed both ways. | Pre-existing, out of scope |

---

## 🔻 STATUS — Phases 0–2 COMPLETE and MERGED. Phase 3 (Journey A) is the frontier.

> ⚠️ **THIS BLOCK AND THE TRACKER BELOW WERE STALE UNTIL 2026-08-03.** They still said *"Phase 1 is the frontier / NOT STARTED"* while WO-TW-01 and WO-TW-02 were built, committed, merged to `main` and **running**. The map's own rule — update only at a phase boundary — was not honoured at two consecutive boundaries, so the durable record contradicted the repository for a full session. **Recorded rather than quietly overwritten**, per the Wayfinder rule on contradictions. The authority is the repository; this file was the defect.

| | |
|---|---|
| **Goal** | One persistent GitHub-polling watcher, backed by SQLite, that closes the review loop with no human invocation |
| **Branch** | `build-019-public-platform-wayfinder` — **merged**. PR #90 merged 2026-08-02T23:30:33Z, head `d6dab69` → merge commit `eb975bc`; `origin/main` is now `eb975bc`. |
| **Current phase** | Phases 0, 1 and 2 **COMPLETE**. Phase 3 — Journey A — **NOT STARTED**. |
| **Current gate** | **Journey A: one real unattended review round, the nine-step acceptance in §7.** |
| **Exact next action** | **Journey A cannot run against PR #90 — it is merged and closed.** A live PR is required as the substrate before step 1 can be executed. Settle that, then run the nine steps without manual invocation. |
| **Model** | **Opus-high** to observe and adjudicate Journey A. The build phases are done. |

### Phase 1–2 landing evidence, measured 2026-08-03 in `C:/Fusion247PKA`

| What | Evidence | How established |
|---|---|---|
| WO-TW-01 store adapter exists | `services/control-plane/tower-loop/db.mjs`, header *"WO-TW-01 … the SQLite store handle"*; `db/` holds 5 schema files (`post_schema.sql` added) | read on disk |
| WO-TW-02 trigger exists | `services/control-plane/tower-loop/run-watcher.mjs`, header *"WO-TW-02: three things about this file changed"*; commit `d6dab69` *"WO-TW-02: the persistent automatic trigger, and the verdict back onto the PR"* | `git log`, file read |
| Both merged to `main` | `gh pr view 90` → `state: MERGED`, `mergedAt 2026-08-02T23:30:33Z`, `headRefOid d6dab69`, `mergeCommit eb975bce…` | `gh`, executed |
| The tower-loop watcher is RUNNING | **PID 9616** — `node C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs`. The legacy BUILD-010 `bin\tower-watch.js` is **also** still running as **PID 39920** — two watchers, one estate. | `Win32_Process`, executed |

**Scope of this verdict, stated deliberately.** What is proven above is that the code **landed, merged and is running**. The acceptance evidence for WO-TW-01 (`executed=24 failures=0` on SQLite) and WO-TW-02 (kill/recover, no double-processing, mutation-tested alert) is the implementing worker's, recorded in those commits — **it was not re-executed in this session and is not being re-asserted here as if it were.**

---

## 1. THE CORRECTION THAT STARTED THIS — recorded accurately

**I claimed the PR ⇄ Tower seam had never been built. That was false, and Warwick corrected it.**

What is actually true:

| Component | State | Evidence |
|---|---|---|
| PR comment → machine-readable input | ✅ **BUILT AND MERGED** | WO-OR-22, commit `73bab3f` — `ingestComment.mjs`, `db/comment_schema.sql`, `findings.mjs`, `apply.mjs`, `watcher.mjs` |
| Real GitHub comment → ingest, no hand-built payload | ✅ **BUILT AND MERGED** | WO-OR-24, commit `8a40219` — `pollPrComments.mjs`, live `gh api` hop, `fakeGh.mjs` double |
| SHA binding, two-layer head check | ✅ BUILT | Layer 1 body-vs-API head; layer 2 body-vs-turn head (stale check) |
| Finding disposition consumed by the next round | ✅ BUILT | `disposition_source='pr_comment'`, fail-closed gate rejects undisposed or stale-head findings **before** a reviewer is invoked |
| **Permanent automatic trigger** | ❌ **MISSING — the whole of this migration** | `README.md` § Known limits: *"Something must still invoke the poller."* `pollPrComments.mjs` is a one-shot command with no daemon |

**My error, stated plainly:** two Tower implementations exist — the legacy ClickUp-driven `services/tower-baton/` (BUILD-010) and the GitHub-driven `services/control-plane/tower-loop/` (Phase 7). I investigated the first, found no GitHub input path, and generalised to the estate. **A negative claim asserted without checking the newer implementation** — the exact failure mode I hold a standing rule against. The rule did not fire because I never framed it as a negative claim; I framed it as "I found the watcher" and stopped looking.

**Row 19 was not "never built". Its automatic invocation was the missing piece.** That is the accurate record and it supersedes SHIT TO DO #4 in the BUILD-019 map.

---

## 2. NORTH STAR (Warwick's architecture decision, 2026-08-02)

> **The review loop runs unattended. A checkpoint posted to a GitHub PR is detected, reviewed by Codex, answered on the PR and mirrored to TowerBot, and Larry's disposition is consumed automatically by the next round — with no human running a command, and with state that survives a restart.**

The five architectural rulings, binding:

1. **GitHub PRs and comments are the Tower conversation and control surface.**
2. **SQLite is the local durable watcher state.**
3. **TowerBot mirrors Larry and Codex messages.**
4. **ClickUp has no role except Foundry and session logging.**
5. **PostgreSQL/Supabase are NOT the live watcher store.**

**Reuse, do not rebuild:** the GitHub ingest, SHA-binding, finding-disposition gate, Codex review and TowerBot notifier all exist and work. **This migration replaces two things only — the trigger and the store.** Anything beyond that is regrowth and is out of scope.

---

## 3. Current reality — measured, not assumed

Executed 2026-08-02 at `7163a32`+:

> ⚠️ **MY FIRST FIGURES WERE MEASURED WITH THE WRONG INSTRUMENT — corrected by Keel at read-back, 2026-08-02.** I quoted `grep -ciE 'pg|pool|for update|skip locked'` as "Postgres call-sites". That counts **lines containing those letters**, including prose and comments — not database calls. **This is the fourth time I have published a confident number produced by a proxy rather than by the mechanism that matters.** The corrected table is below; the original method is recorded so the error is legible rather than tidied away.

| Fact | Value | How established |
|---|---|---|
| Real `.query(` call-sites in the 5 files I named | **32** | Keel, counting actual calls |
| …of which `pollPrComments.mjs` | **0** — it constructs a pool and hands it to `ingestPrComment` | same |
| Real `.query(` call-sites, **whole directory** | **112**, plus **16** pool/client construction sites | same |
| **Minimum migration set** | **10 modules**, not the 5 I named | see below |
| Modules I missed, all unavoidable | `apply.mjs` (4) — the schema applier, imported by nearly everything · `notify.mjs` (2) — on the watcher path · `seed.mjs` (9) — required before any round, and the only explicit transaction client · `hold.mjs` (2) · `test/run-tower-loop-tests.mjs` (31) — the suite builds its own pool and asserts in raw SQL | same |
| Postgres-specific constructs in use | **a closed set of 12 classes** — `now()` ×48, `::int` ×11, `jsonb` ×7, `on conflict` ×6, `gen_random_uuid()` ×6, `coalesce` ×5, `interval` ×8, `excluded.` ×2, `~` regex ×1, `generated always as identity` ×1, `array_agg` ×1, `for update skip locked` ×1 | same |
| **Baseline: existing suite on Postgres** | **`executed=24 failures=0`, ALL PASS, exit 0** — measured today on a throwaway cluster, then torn down | Keel, executed |
| Suite with no database | exits 1, **0 executed** — fails loudly, as designed | same |
| Driver | **`better-sqlite3@13.0.2` — SETTLED BY INSTALL.** Prebuilt binary, 6s, no compilation. SQLite 3.53.4, WAL confirmed, `RETURNING` / `ON CONFLICT DO NOTHING` / `UPDATE…LIMIT` / named CHECK / UDFs all verified | same |
| `node:sqlite` | Works (SQLite 3.50.2) but experimental. **Recorded as a fallback, not chosen** | same |
| Postgres schema files | 4 in `db/` — **but see G5: `tower.*` is bigger than these four** | `ls db/` |
| Node version | v22.18.0 | executed |
| Live legacy watcher | `tower-watch.js` PID 38820, ClickUp-driven, still running | process table |

**The tests are the safety net for this migration** and they are currently Postgres-gated. Keeping them executable is a first-class requirement, not a nicety — a migration whose tests stop running looks identical to one that works. **The bar is the literal line `executed=24 failures=0`**, reproduced on SQLite.

**One correction to my own regrowth claim, because it was overstated.** `pg` is a **devDependency**, not a runtime dependency. So this migration swaps one declared dependency for another, and swaps pure-JS for native/compiled — **the dependency count does not fall**. The real and worthwhile win is removing the Postgres *server* from the runtime and from the test path. That is a different claim and it is the accurate one.

---

## 4. FOG

### 🔴 G1 — SQLite driver choice

`node:sqlite` is built in but **experimental** ("might change at any time"), which is a poor property for durable state. `better-sqlite3` is mature and synchronous — a good fit for a single-process watcher — but is a native module needing a Windows build or a prebuilt binary for Node 22.

**Default: `better-sqlite3`, with WAL enabled.** Falls back to `node:sqlite` only if the native install genuinely fails on this machine. **Keel decides at read-back with the install actually attempted** — not from reasoning about which is likely to work. This is an ordinary technical choice and Larry's to settle; it is recorded as fog only because it must be settled by *evidence*, not preference.

### 🔴 G2 — Exactly-once without `FOR UPDATE SKIP LOCKED`

The Postgres watcher guarantees exactly-once turn claiming with a durable lease plus `FOR UPDATE SKIP LOCKED`. **SQLite has no such construct.** It is single-writer, so the answer is likely simpler, not harder — one watcher process, a lock file or a `BEGIN IMMEDIATE` transaction, and a lease column.

**What must be preserved regardless of mechanism:** a turn is processed once; a restart mid-turn does not double-process; a crashed lease is reclaimable. **The acceptance journey tests this directly** (restart → prove no duplicate), so it cannot be asserted — it gets executed.

### 🟠 G3 — Trigger shape: daemon vs scheduled

A persistent polling process is the obvious shape and matches "the already-running watcher detects it". The alternative — a scheduled task invoking the one-shot — is weaker: it reintroduces "something must invoke it" one layer up.

**Default: one persistent process, started the same way the estate starts its other long-running services, pinned to the primary checkout — never a worktree, temp dir or scratchpad.** Poll interval a config value; a sensible default around 30–60s.

**The durability bar is the one that has bitten before:** it must survive process death, be provable by killing it and watching it recover, and fail loudly. A watcher that dies quietly is worse than no watcher, because silence reads as "nothing to review".

### 🟠 G4 — What happens to the Postgres schemas

Four schema files define the live shape. SQLite needs equivalents: type mapping (`uuid`, `timestamptz`, the `tower.git_sha` domain with its lower-case-40-hex constraint), and the `tower.` schema prefix which SQLite has no concept of.

**The `git_sha` domain constraint is load-bearing** — it is a database-enforced guarantee that a head SHA is canonical. Losing it in translation would silently weaken the SHA binding this whole seam exists to provide. **It must survive as a `CHECK` constraint, and there must be a test that proves a non-canonical SHA is still rejected.**

**Not in scope:** migrating existing Postgres *data*. There is no live Postgres watcher running (`CONTROL_PLANE_DEV_DATABASE_URL` is unset in Larry's shell). This is a store swap, not a data migration.

---

## 5. Scope — precisely

### IN

- A **SQLite store adapter** behind the existing query surface, so call-sites change shape, not meaning.
- **Schema translation** of the four `tower.*` schemas, preserving every constraint that carries a guarantee.
- A **persistent GitHub-polling watcher** that invokes the existing poll → ingest → gate → review → notify path on a loop.
- **Restart/recovery semantics** proven by execution.
- Keeping the **24-subtest suite executable** against the new store, and adding tests for the new trigger and recovery paths.
- **Zero ClickUp calls** on this path, proven.

### OUT — and staying out

- Rebuilding the ingest, SHA-binding, disposition gate, Codex adapter or TowerBot notifier. **They work. Reuse them.**
- Webhooks or inbound ingress. A poller is the decided shape.
- Retiring the legacy `tower-baton` (SHIT TO DO #2).
- Migrating Postgres data.
- Any new governance layer, registry, validator or store around the above. **The regrowth cap applies with full force here** — this migration is *removing* a runtime dependency, and a migration that adds two subsystems while removing one has failed.

---

## 6. Route

| Phase | Outcome | Gate / evidence | Model |
|---|---|---|---|
| **0** | This map | ✅ Complete | Opus-high |
| **1 — WO-TW-01** | **SQLite store adapter + schema translation.** Driver settled by attempted install. All four schemas translated with constraints preserved, `git_sha` canonicality included. Existing suite runs green against SQLite. | 24 subtests executing and passing on SQLite, non-zero executed count; a non-canonical SHA proven rejected | **Opus-high** |
| **2 — WO-TW-02** | **The persistent trigger.** One polling process invoking the existing path. Start/stop/restart, lease and recovery semantics. Loud failure. | Kill it mid-turn, watch it recover, no double-processing; a mutation-test proving the failure alert actually fires | **Opus-high** |
| **3 — Journey A** | **The unattended round on PR #90** | The eight-step acceptance below, executed | Opus-high to observe and adjudicate |
| **4 — Journey B** | **Footer semantics finished** | Below | Routine |

---

## 7. ACCEPTANCE — Journey A, exactly as Warwick specified

**One real unattended round on PR #90. Every step is executed and evidenced; none is asserted.**

1. Post a checkpoint to PR #90.
2. **Do not** manually run `gh api`, `pollPrComments.mjs`, or any handoff CLI.
3. The **already-running** watcher detects it.
4. Codex responds **on the PR** and **on TowerBot**.
5. Larry's disposition is **automatically consumed by the next round**.
6. **Restart the watcher.**
7. **Prove no duplicate.**
8. Post **another** checkpoint and prove it is detected.
9. **Prove zero ClickUp calls.**

**On step 9 — how it gets proven, since "I didn't call it" is not evidence:** the ClickUp client must be absent from this path's module graph, or instrumented to throw if invoked. A count of zero from a counter nobody wired is the same false green this estate has been burned by before.

**On step 3 — "already-running" is the whole point.** A watcher started specially for the test proves nothing about unattended operation. It must be running before the checkpoint is posted, and ideally have been running across a restart.

## 8. ACCEPTANCE — Journey B, the footer semantics

Already diagnosed and half-done tonight:

- ✅ **Done:** the STALE rung no longer discards a true `used_tokens`; the footer renders `ctx 258.9k · BLIND` instead of `ctx --`. Pinned by an enumerating test and mutation-proven.
- ❌ **Remaining:** nothing re-samples during a long turn, so a rendered count is true-as-of-sample-time with **no age visible in the line**. Warwick cannot distinguish a 30-second-old count from a 25-minute-old one.

**Required outcome:** either the count is fresh when rendered, or its age is honestly visible. Surfacing age changes the frozen byte grammar in `footer.mjs`, so that is a deliberate decision — and the cheaper, more honest fix is likely to **re-sample from the transcript at render time**, which changes no grammar at all.

---

## 9. Standing constraints

- **Larry orchestrates, he does not execute.** Every phase here is a Work Order to Keel, opening with a **READ-BACK** that holds before implementing.
- **`private_surface` is mandatory on every Work Order**, `none` included. This migration touches `C:\.fusion247\` only if watcher state lands there — if it does, it is a **declared** surface, never an inferred one.
- **No secret value** in Git, logs, prompts or PR comments. `gh` holds its own credential; the poller is structurally read-only and must stay so — `assertReadOnlyArgs` is not to be relaxed.
- **Codex budget: three executions per review gate.** Never a fourth.
- **Do not clear the session or resume BUILD-019 until both journeys pass** (Warwick, explicit).

## Phase status (update ONLY at a phase boundary: PASS / PARTIAL / FAILED + evidence)

| Phase | Status | Evidence |
|---|---|---|
| 0 — Map + record correction | ✅ **PASS** | This map; BUILD-019 SHIT TO DO #4 corrected on the record |
| 1 — SQLite store adapter | ✅ **PASS** — landed and merged | `tower-loop/db.mjs` + 5 `db/*.sql`; in `origin/main` via PR #90 (`eb975bc`). Suite evidence is the worker's, in-commit; not re-executed 2026-08-03. |
| 2 — Persistent trigger | ✅ **PASS** — landed, merged, running | `run-watcher.mjs` @ `d6dab69`; PID **9616** live. Kill/recover + mutation evidence is the worker's, in-commit; not re-executed 2026-08-03. |
| 3 — Journey A (unattended round) | 🟠 **NOT STARTED — the frontier, and BLOCKED on its substrate** | Cut short by Warwick's merge override. **PR #90 is merged and closed, so the specified target no longer exists as a live surface.** |
| 4 — Journey B (footer semantics) | ⬜ NOT STARTED | — |

**Two watchers are running simultaneously** — the tower-loop watcher (PID 9616) and the legacy BUILD-010 ClickUp-driven `bin\tower-watch.js` (PID 39920). Journey A step 9 requires proving **zero ClickUp calls** on the path under test; a second, ClickUp-driven watcher alive on the same estate is a confounder that must be resolved before that step can mean anything.
