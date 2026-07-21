# BUILD-014 WP-D increment 2 — the write-back trust seam

**Status:** BUILT + PROVEN on this machine (2026-07-21). DEV-only, LOCAL-only, SYNTHETIC data only.
**Branch:** `build-014/wp-d-cockpit-v2` (clean, off REAL `main` `42f74e9`).
**Author:** Silas (Database Architect).
**Foundation:** increment 1's harness (READ views + read-only cockpit + 11/11 permission test),
brought forward unchanged from `build-014/wp-d-cockpit-proof`.
**Review:** independent Codex review applied — F2 fixed (worker write-scope hardened), F1
confirmed (read-models are curated), F3 tracked (§9). Permission matrix now **41/41 PASS**.

This increment adds the narrow, permission-bounded **write-back** that makes a Directus
cockpit worth running — *without* letting the cockpit become the runtime. It proves a
**request/execute trust boundary**: the control surface (Directus) may only **request**;
a separate trusted worker **executes**. Directus is a view/control surface, not the runtime.

> **Hard constraints honoured** (unchanged from increment 1, plus increment 2)
> - **SYNTHETIC/DEV only.** Every domain row carries `is_synthetic = true`; the queue guard
>   *forces* `is_synthetic = true` on insert. No real AsdAIr/household data anywhere.
> - **LOCAL-only.** Postgres + Directus + worker all bind to / connect over `127.0.0.1`.
> - **NEVER superuser at runtime.** Increment 1 connected Directus as the superuser
>   (`cp_admin`) and enforced least-privilege only at the app layer. **Increment 2 repoints
>   the Directus runtime connection to a least-privilege `cp_directus` role**, and the worker
>   runs as a second narrow `cp_worker` role. The superuser is used *only* for the one-time
>   Directus bootstrap (system-table install), never for runtime.
> - **No secrets/data committed.** Cluster, creds, `.env`, `node_modules`, logs → all under
>   `.runtime/` / gitignored.

---

## 1. One command to provision + start + seed + prove

From `services/control-plane/` (needs Postgres 17 on PATH, Node ≥ 20, and a one-time
`npm install` in both `./` and `./wp-d-proof/directus`):

```bash
node wp-d-proof/run-increment-2.mjs      # provisions, starts, seeds, runs BOTH proof suites
node wp-d-proof/stop.mjs                 # tear down (stops Directus + Postgres, deletes .runtime)
```

`run-increment-2.mjs` runs, in order: `provision` → `setup-directus` (superuser bootstrap) →
`configure-db-roles` (create `cp_directus`/`cp_worker`, repoint Directus runtime) →
`register-collections` → `start-directus` (as `cp_directus`) → `configure-access` →
`permission-test` → `outage-test`. Every step is idempotent/re-runnable.

The worker can also be driven directly:
```bash
node wp-d-proof/worker.mjs --drain   # claim+execute every queued request, then exit (default)
node wp-d-proof/worker.mjs --once    # claim+execute at most one
node wp-d-proof/worker.mjs --watch   # keep polling (Ctrl-C to stop)
```

---

## 2. What was built (files added/changed this increment)

| File | New? | Purpose |
|---|---|---|
| `seed/040_writeback_seam.sql` | new | `command_request` intent queue + `cockpit_metric` side-effect table + two guard triggers (intent-only insert; immutable request core). |
| `configure-db-roles.mjs` | new | Creates least-priv `cp_directus` + `cp_worker` LOGIN roles; reassigns `directus_*` ownership to `cp_directus`; applies the scoped GRANTs that ARE the seam; repoints `directus/.env` from `cp_admin` → `cp_directus`. |
| `worker.mjs` | new | The trusted executor. Connects as `cp_worker`; claims with `FOR UPDATE SKIP LOCKED`; runs one safe synthetic command; writes a visible receipt. |
| `outage-test.mjs` | new | Seam trace + Directus-outage independence proof (3 phases). |
| `run-increment-2.mjs` | new | One-command orchestrator (provision → … → prove). |
| `provision.mjs` | edit | Also loads `040_writeback_seam.sql`; prints queue/metric counts. |
| `register-collections.mjs` | edit | Also registers `command_request` + `cockpit_metric` collections. |
| `configure-access.mjs` | edit | Adds the increment-2 app-layer perms: `UPDATE(is_checked)` on `list_items`; `READ` + field-scoped `CREATE` on `command_request`; `READ` on `cockpit_metric`. |
| `permission-test.mjs` | edit | Adds the increment-2 acceptance/adversarial + DB-layer least-priv + guard matrix (33 assertions total). |

The append-only ledger immutability guarantee from increment 1 (`ops.agent_event` UPDATE/DELETE
→ SQLSTATE `23001`) is preserved and re-asserted (D1).

---

## 3. The exact permission matrix

### 3a. Directus app layer — the non-privileged "Cockpit Viewer" policy

| Collection | read | create | update | delete |
|---|---|---|---|---|
| `lists` | ✅ `*` | ❌ | ❌ | ❌ |
| `list_items` | ✅ `*` | ❌ | ✅ **`is_checked` only** | ❌ |
| `command_request` | ✅ `*` | ✅ **`requested_by,command,args,idempotency_key` only** | ❌ | ❌ |
| `cockpit_metric` | ✅ `*` | ❌ | ❌ | ❌ |
| `tower_review_log` | ❌ | ❌ | ❌ | ❌ |
| `tower_verdicts` | ❌ | ❌ | ❌ | ❌ |
| everything else | ❌ (Directus default-deny) | | | |

So the cockpit viewer can **check/uncheck an item** and **request a command** — and nothing
else. It cannot set `status`/`receipt` on a request (fields not permitted), cannot update or
delete the queue (cannot execute/complete), cannot see the Tower ledger, cannot write metrics.

### 3b. Database layer — least-privilege GRANTs (enforced even if Directus is bypassed)

| Object | `cp_directus` (cockpit runtime) | `cp_worker` (executor) |
|---|---|---|
| `public.lists` | `SELECT` | — |
| `public.list_items` | `SELECT`, **`UPDATE(is_checked)`** (column-scoped) | `SELECT` |
| `public.tower_review_log` / `tower_verdicts` | `SELECT` (curated read-models — see §3d) | — |
| `public.command_request` | `SELECT`, **`INSERT(requested_by,command,args,idempotency_key)`** | `SELECT`, **`UPDATE(status,claimed_at,completed_at,receipt)`** (column-scoped — F2) |
| `public.cockpit_metric` | `SELECT` | `SELECT`, `INSERT`, `UPDATE` |
| `directus_*` system tables | **OWNER** (runs the CMS) | — (no access) |
| schema `ops` (the ledger) | **no USAGE** — invisible | **no USAGE** — invisible |

The **asymmetry is the trust boundary**: `cp_directus` can *request* (INSERT intent) but not
*execute* (no UPDATE on the queue); `cp_worker` can *execute* (advance status + write receipt)
but not *fabricate* requests (no INSERT on the queue) and not *rewrite* what was requested —
its UPDATE is **column-scoped to `status,claimed_at,completed_at,receipt` only** (F2). Neither
role can touch the `ops.*` ledger at all.

> **F2 fix (Codex MEDIUM, applied):** increment-2 v1 gave `cp_worker` table-wide `UPDATE` on
> `command_request`, so it could rewrite `requested_by`/`command`/`args`/`is_synthetic`. Now the
> grant is **column-scoped** (above), AND the update guard (§3c) enforces valid transitions.
> The worker literally cannot rewrite the request or its provenance — proven by W6–W10 (§6).

### 3c. Belt-and-braces guards (trigger-enforced for **every** role, incl. superuser)

- **Intent-only insert:** any `command_request` INSERT with `status != 'requested'`, or a
  non-null `receipt`, or a pre-set `claimed_at`/`completed_at` → rejected `23514`.
- **Immutable request core:** any UPDATE that changes `requested_by`/`command`/`args`/
  `idempotency_key`/`requested_at` → rejected `23514`.
- **Immutable synthetic provenance (F2):** any UPDATE that flips `is_synthetic` → rejected `23514`.
- **Valid lifecycle transitions only (F2):** when `status` changes, only `requested → claimed`
  and `claimed → done|failed` are allowed; skipping the claim (`requested → done`), un-claiming,
  or any other move → rejected `23514`.
- **Completed rows are FINAL (F2):** any UPDATE to a row already `done`/`failed` (resurrection or
  receipt tampering) → rejected `23514`.
- **Idempotency:** `command_request.idempotency_key` is `UNIQUE` (duplicate intent rejected).

The worker may therefore ONLY: claim its own request, then stamp a receipt + terminal status.

### 3d. F1 confirmation (Codex HIGH — adjudicated NOT a defect; verified curated)

`cp_directus` has `SELECT` on `public.tower_review_log` and `public.tower_verdicts`. This is the
**intended** cockpit display (a Tower-interactions cockpit must show verdicts). Verified curated:

- The `ops.*` schema (migration 001) contains **no** `raw_output` / `staged_input` / `raw_*`
  columns at all — there is no raw reviewer payload to leak.
- The read-models expose only curated display fields:
  `tower_review_log(id, occurred_at, build_ref, actor, event_kind, summary, checkpoint_ref, classification)`
  and `tower_verdicts(id, build_ref, checkpoint_ref, reviewer, verdict_type, verdict, state, reviewed_commit_sha, created_at)`.
- `cp_directus` has **no** access to `ops.*` (no schema USAGE) — it reads only the curated public
  projections. **No curation change required.**

---

## 4. command_request → worker → receipt trace (live transcript)

Captured from `outage-test.mjs`, Phase 0 (Directus UP). The cockpit posts an intent row via
the Directus REST API as the non-privileged viewer; the worker (as `cp_worker`) claims and
executes it and writes a receipt:

```
--- PHASE 0: Directus UP — cockpit REQUESTS, worker EXECUTES ---
  PASS  cockpit inserted an INTENT row via Directus (status=requested) — id=b1e6bf1e-…, status=requested
  [seam] worker draining while Directus UP:
[worker] connected as cp_worker (least-privilege) — mode=drain
[worker] DONE recount_items (b1e6bf1e-…) -> {"ok":true,"command":"recount_items","metric":"list_items_total","value":7,"worker":"cp_worker","executed_at":"2026-07-21T01:53:38.400Z"}
[worker] drained N request(s); queue empty.
  PASS  worker completed the request (status=done + receipt written) — status=done, receipt={"ok":true,"value":7,…}
  PASS  safe command produced a visible side-effect (cockpit_metric) — list_items_total=7 by cp_worker
```

**Safe synthetic commands** the worker will execute (anything else → `status=failed`, never run):
`recount_items` (count `list_items` → `cockpit_metric['list_items_total']`), `recount_checked`
(count checked → `cockpit_metric['list_items_checked']`), `echo {message}` (no-op receipt).

---

## 5. Outage-independence transcript

`outage-test.mjs` stops **only** Directus (kills its pid; Postgres + `.runtime` stay up), shows
the worker still drains a queued request to done, then restarts Directus and shows the state intact:

```
--- PHASE 1: Directus DOWN — worker drains the queue anyway ---
  PASS  queued a 2nd request via Directus (still UP at queue time) — id=51eab7fe-…
  [outage] killed Directus pid 27244: ok
  PASS  Directus is now DOWN (control surface offline) — ping no longer answers
  PASS  the queued request survives in Postgres while Directus is down — status=requested
  [seam] worker draining while Directus is DOWN:
[worker] DONE recount_checked (51eab7fe-…) -> {"ok":true,"metric":"list_items_checked","value":1,"worker":"cp_worker",…}
  PASS  worker STILL executed it to done WHILE DIRECTUS WAS DOWN (Postgres is the runtime)

--- PHASE 2: Directus RESTARTED — completed state intact ---
  PASS  Directus came back UP — ping answers again
  PASS  the done request + receipt are visible again through the restarted cockpit — status=done

 OUTAGE-INDEPENDENCE PROVEN: Directus is a view/control surface, not the runtime.
```

---

## 6. Result — full permission matrix (41/41 PASS)

`node wp-d-proof/permission-test.mjs` → **41 passed, 0 failed.** Highlights:

| Group | Assertions | Result |
|---|---|---|
| Acceptance (admin) | A1 Tower log, A2 shopping lists | 200 |
| Adversarial read (viewer) | V2/V2b ledger 403, V3 write 403 | pass |
| **Constrained CRUD (app)** | **C1 toggle is_checked 200; C2 other field 403** | pass |
| **Seam (app)** | **C3 request 200 (intent-only); C4 complete 403; C5 delete 403; C6 metric 403** | pass |
| Ledger immutability (DB) | D1 UPDATE/DELETE `ops.agent_event` → `23001` | pass |
| **`cp_directus` least-priv (DB)** | **DB1 is_checked ok; DB2 item_name `42501`; DB3 insert-intent ok; DB4 queue-update `42501`; DB5 ledger `42501`; DB6 lists `42501`; DB7 metric `42501`** | pass |
| **`cp_worker` least-priv (DB) — F2** | **W1 claim→complete ok; W2 queue-insert `42501`; W3 ledger `42501`; W4 shopping `42501`; W5 metric ok; W6 rewrite command `42501`; W7 rewrite requested_by `42501`; W8 flip is_synthetic `42501`; W9 skip-claim `23514`; W10 resurrect `23514`** | pass |
| **Intent + lifecycle guards (DB) — F2** | **G1 status≠requested `23514`; G2 receipt-on-insert `23514`; G3 rewrite command `23514`; G4 flip is_synthetic `23514`; G5 skip-claim `23514`; G6 resurrect completed `23514`** | pass |

---

## 7. Honest status — proven vs. partial

**Proven end-to-end on this machine (real transcripts above):**
- Constrained CRUD (check/uncheck) bounded to a single field at BOTH the Directus app layer
  and the Postgres column-grant layer.
- The `command_request` intent seam: Directus writes intent only; a separate least-priv worker
  claims (`FOR UPDATE SKIP LOCKED`), executes one safe synthetic command, writes a visible receipt.
- Directus + worker run as **least-privilege roles, never superuser** at runtime.
- Outage-independence: the worker drains the queue with Directus fully down; state survives restart.
- 41/41 permission assertions incl. fail-closed DB-layer denials for every out-of-scope write,
  and (F2) proof the worker cannot rewrite a request, flip `is_synthetic`, skip the claim, or
  resurrect a completed row.

**Scope boundaries / partial (called out honestly):**
- This is a **disposable DEV proof**, not a hosted deployment. No TLS, no reverse proxy, no
  auth hardening beyond Directus defaults — everything is `127.0.0.1`.
- `cp_directus` is **owner** of the `directus_*` system tables (it must operate the CMS). That
  is broad *within Directus's own infrastructure* but carries **zero** rights on the domain
  tables beyond the scoped grants; it has no `ops.*` access. The least-privilege claim is about
  the **domain/ledger boundary**, which is fully enforced — not a claim that Directus itself is sandboxed.
- Concurrency: `FOR UPDATE SKIP LOCKED` + the transaction is the standard exactly-once claim
  pattern and is exercised functionally (single-worker drain). A **multi-worker race** was not
  load-tested in this increment; the locking is correct by construction but not stress-proven here.
- Worker "safe commands" are a fixed synthetic allow-list; there is no general command execution
  surface (by design).
- **F3 (Codex LOW, tracked):** the worker holds the `FOR UPDATE SKIP LOCKED` row lock across
  command execution + receipt commit (one transaction). For the current safe, fast synthetic
  commands this is fine and gives the simplest exactly-once guarantee (no orphaned `claimed` rows
  on crash). If future commands become slow/external, split into a short claim txn (`requested →
  claimed`, commit) + execute + a receipt txn (`claimed → done`, commit) plus a stale-claim reaper.
  **Deliberately not changed here** — splitting now would trade a proven, orphan-free path for
  added crash-recovery surface with no current benefit.
- **Review:** independent Codex review has run against this work — F2 fixed, F1 confirmed (§3d),
  F3 tracked above. No Fable. Warwick's merge gate still sits on top; not merged.

---

## 8. Relationship to increment 1

Increment 1 (`WP-D-README.md`) delivered the two READ views + read-only cockpit + 11/11
permission test. Its section 7 listed increment 2 (constrained CRUD, one safe `command_request`,
Directus-outage test) as out of scope. **This document is that increment 2.** All increment-1
guarantees are preserved and re-asserted here.
