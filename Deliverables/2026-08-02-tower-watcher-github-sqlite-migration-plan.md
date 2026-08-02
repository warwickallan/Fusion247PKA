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

## 🔻 STATUS — Phase 0 (map) COMPLETE. Phase 1 is the frontier.

| | |
|---|---|
| **Goal** | One persistent GitHub-polling watcher, backed by SQLite, that closes the review loop with no human invocation |
| **Branch** | `build-019-public-platform-wayfinder` (the acceptance PR is #90) |
| **Current phase** | Phase 0 — mapping: **COMPLETE** |
| **Current gate** | Keel's read-back on WO-TW-01 |
| **Exact next action** | Dispatch WO-TW-01 to Keel: the SQLite store adapter behind the existing query surface. Read-back first, hold before implementing. |
| **Model** | **Opus-high** for the store adapter and the trigger design (durable state, exactly-once, restart semantics). Routine for the mechanical call-site migration once the adapter exists. |

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

| Fact | Value | How established |
|---|---|---|
| Postgres call-sites, `watcher.mjs` | **42** | `grep -c` on pg/pool/FOR UPDATE/SKIP LOCKED |
| …`loop.mjs` | 25 | same |
| …`ingestComment.mjs` | 12 | same |
| …`pollPrComments.mjs` | 5 | same |
| …`findings.mjs` | 2 | same |
| Postgres schema files | 4 — `loop_schema.sql`, `watcher_schema.sql`, `hold_schema.sql`, `comment_schema.sql` | `ls db/` |
| SQLite anywhere in the repo | **none** | repo-wide grep for `better-sqlite3` / `node:sqlite` / `sqlite3` |
| Node version | **v22.18.0** | `node -e process.version` |
| `node:sqlite` | **available, but flagged EXPERIMENTAL** | required it live; emits `ExperimentalWarning` |
| Existing test suite | 24 subtests (`W1–W8`, `P1–P6`, `T0–T7`), fails loudly on zero executed | README + `test/run-tower-loop-tests.mjs` |
| Live legacy watcher | `tower-watch.js` PID 38820, ClickUp-driven, still running | process table |

**The tests are the safety net for this migration** and they are currently Postgres-gated. Keeping them executable is a first-class requirement, not a nicety — a migration whose tests stop running looks identical to one that works.

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
| 1 — SQLite store adapter | ⬜ **NOT STARTED — the frontier** | — |
| 2 — Persistent trigger | ⬜ NOT STARTED | — |
| 3 — Journey A (unattended round) | ⬜ NOT STARTED | — |
| 4 — Journey B (footer semantics) | ⬜ NOT STARTED | — |
