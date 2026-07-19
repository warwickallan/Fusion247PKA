# BUILD-014 WP-D increment 1 — disposable local cockpit proof

**Status:** BUILT + PROVEN on this machine (2026-07-19). DEV-only, LOCAL-only, SYNTHETIC data only.
**Branch:** `build-014/wp-d-cockpit-proof` (off main `6eeca43`).
**Author:** Mack (Automation Specialist).

This is the throwaway proof stack for WP-D increment 1: a local Postgres control plane +
a local Directus cockpit, standing up the **two READ acceptance views** and the
**adversarial permission test**. It is deliberately disposable — not production, not hosted,
never exposed off `127.0.0.1`.

> **Hard constraints honoured**
> - **No real personal data, ever.** The shopping-list view uses SYNTHETIC/dev rows only
>   (decision #4 default). The owner label is a dev persona (`"Mum" (dev persona, not a real
>   person)`), every row carries `is_synthetic = true`, and nothing real touches Directus or
>   any committed file.
> - **Local-only.** Postgres + Directus bind to `127.0.0.1` exclusively.
> - **DEV-only.** No live apply, no public webhook, no secrets committed. All credentials live
>   in `.runtime/` (gitignored) and `directus/.env` (gitignored).

---

## 1. Feasibility on this machine

| Need | Found | Decision |
|---|---|---|
| Container runtime | **Docker NOT installed** (`docker: command not found`) | Did **not** use Docker. |
| Postgres | **PostgreSQL 17.4** — `initdb`/`pg_ctl`/`psql`/`createdb` all on PATH | **Chosen path (lowest friction).** Reuses the exact `initdb`/`pg_ctl` mechanism the hermetic db-test runner already uses (`db/test/run-db-tests.mjs`), but kept **persistent for the session** instead of torn down. |
| Node / npx | node v22.18.0, npm 10.9.3 | Directus + scripts run on this. |
| `pg` driver | already installed in `services/control-plane/node_modules` | Scripts resolve it by living inside the tree. |
| Directus | **11.17.4** installed locally via `npm install directus@11` | Clean install, no native-build blockers. |

**No blockers.** The whole stack stands up cleanly with native Postgres + npx Directus — no
Docker, no scoop, no admin rights needed. Two friction points hit and fixed during bring-up:
1. Directus rejects `.local` e-mail addresses → used `@wpd.example.com`.
2. `directus bootstrap` only creates the first admin on a **fresh** install → setup now drops
   any prior `directus_*` tables first so bootstrap always installs clean + creates the admin.

---

## 2. Architecture

```
127.0.0.1 only
┌─────────────────────────────────────────────────────────────────────┐
│ Postgres 17.4 (disposable cluster in wp-d-proof/.runtime/cluster)    │
│                                                                     │
│  ops.*   (migrations 001 + 002)  ← canonical, append-only, trigger- │
│    build / checkpoint / verdict / agent_event / merge_gate / …       │
│    • the REAL immutable ledger (agent_event: UPDATE/DELETE → 23001)  │
│                                                                     │
│  public.*  (SYNTHETIC seed)                                         │
│    lists / list_items                 ← Directus-native shopping data │
│    tower_review_log / tower_verdicts  ← read-model PROJECTIONS of ops │
│    directus_*                         ← Directus system tables        │
└─────────────────────────────────────────────────────────────────────┘
        ▲                                              ▲
        │ superuser conn (Directus)                    │ SQL (proofs)
┌───────┴───────────────┐                              │
│ Directus 11 cockpit   │  http://127.0.0.1:8074       │
│  Collections:         │                              │
│   • tower_review_log  │  "log of the Tower convos"   │
│   • tower_verdicts    │                              │
│   • lists / list_items│  "Mum's shopping lists"      │
│  Roles/policies:      │                              │
│   • Admin (full)      │                              │
│   • Cockpit Viewer    │  read shopping ONLY          │
└───────────────────────┘
```

**Why projection tables, not SQL views:** Directus needs a primary key to expose a collection;
a bare SQL view has none. The canonical evidence stays in the append-only `ops.*` tables; the
cockpit reads read-model projection tables (`public.tower_review_log`, `public.tower_verdicts`)
that carry a real PK. The immutability proof therefore targets the **real** ledger
(`ops.agent_event`) directly, not the projection.

---

## 3. Launch commands (exact, ordered)

From `services/control-plane/`:

```bash
# 1. Provision the disposable Postgres cluster + apply migrations 001/002 + seed SYNTHETIC data.
node wp-d-proof/provision.mjs
#    → cluster live on 127.0.0.1:<port>, row counts printed, descriptor at .runtime/runtime.json

# 2. Bootstrap Directus (writes .env, creates directus_* system tables + first admin).
node wp-d-proof/setup-directus.mjs

# 3. Register the four proof tables as Directus collections (Directus infers fields + PK).
node wp-d-proof/register-collections.mjs

# 4. Start the Directus cockpit (detached, localhost-only). ANNOUNCE ONLY — open the URL yourself.
node wp-d-proof/start-directus.mjs
#    → Cockpit: http://127.0.0.1:8074  (admin login in .runtime/runtime.json, gitignored)

# 5. Configure the non-privileged "Cockpit Viewer" role/policy/permissions/user.
node wp-d-proof/configure-access.mjs

# 6. Prove the two read views + the adversarial permission test.
node wp-d-proof/permission-test.mjs

# Teardown (stops Directus + Postgres, deletes .runtime).
node wp-d-proof/stop.mjs
```

Steps 1–3 and 5 are idempotent/re-runnable; each `provision.mjs` rebuilds the `ops` schema and
the `public` projections from scratch (deterministic disposable dataset).

---

## 4. The two acceptance views (proven working)

### View 1 — "Can I see the log of the Tower conversations?"
Directus collection **`tower_review_log`** (a read-model of the append-only `ops.agent_event`
ledger). In the Directus Content module it renders as a chronological timeline of the
multi-model review interaction + Larry's summaries to Warwick, across two synthetic builds:

```
[13:37] BUILD-014 larry     summary.to_warwick  WP-A built: minimum Phase-0 schema …
[14:17] BUILD-014 gpt_codex review.posted       Codex correction-loop r1: REQUEST_CHANGES …
[14:37] BUILD-014 larry     review.relayed      Relayed Codex r1 findings; applying fixes …
[21:37] BUILD-014 gpt_codex review.posted       Codex correction-loop r5: APPROVE …
[21:47] BUILD-014 fable     review.posted       Fable cold-final: APPROVE — merge-ready.
[21:57] BUILD-014 larry     summary.to_warwick  WP-A merge-ready: both reviewers approve …
… (14 beats total; BUILD-010 shows a split Codex-approve / Fable-request_changes PAUSE)
```
Capture scope matches the decision: **Larry's summaries + the Tower review interaction beats +
verdicts — not the running commentary.** `tower_verdicts` is a companion collection showing the
head-bound verdict outcomes (reviewer / type / value / state / reviewed SHA).

### View 2 — "Can I see Mum's shopping lists?"
Directus collections **`lists`** + **`list_items`** (SYNTHETIC):
```
Weekly groceries (SYNTHETIC — "Mum" (dev persona, not a real person)) — 4 items
  [ ] Oat milk (2 cartons)   [ ] Bananas (1 bunch)   [x] Wholemeal bread (1 loaf)   [ ] Cheddar (400g)
Hardware store  (SYNTHETIC — "Mum" (dev persona, not a real person)) — 3 items
  [ ] AA batteries (1 pack)  [ ] Masking tape (2 rolls)  [ ] LED bulb (B22) (3)
```

Both views were verified two ways: directly in SQL against the read-models, and over the live
Directus REST API as the privileged admin (`GET /items/tower_review_log`, `GET /items/lists`).

---

## 5. Adversarial permission test — RESULT: 11/11 PASS

`node wp-d-proof/permission-test.mjs` asserts, and all pass:

| # | Assertion | Result |
|---|---|---|
| A1 | Admin can read the Tower conversations log | `GET /items/tower_review_log` → **200**, 14 rows |
| A2 | Admin can read Mum's shopping lists | `GET /items/lists` → 2, `list_items` → 7 |
| V1 | Non-priv viewer: in-scope read allowed | `GET /items/lists` → **200** |
| **V2** | **Non-priv viewer CANNOT see the ledger** | `GET /items/tower_review_log` → **403** |
| **V2b** | **Non-priv viewer CANNOT see the verdicts** | `GET /items/tower_verdicts` → **403** |
| **V3** | **Non-priv viewer CANNOT write** (read-only) | POST / PATCH / DELETE on shopping → **403** |
| **D1** | **The real ledger is immutable** | `UPDATE`/`DELETE ops.agent_event` → **SQLSTATE 23001** (append-only trigger), even as superuser |

**The security boundary is proven at two layers.** At the *app* layer, Directus default-deny
means the "Cockpit Viewer" (whose policy grants read on `lists`/`list_items` only) is denied
both reading beyond its scope (the Tower ledger, 403) and any write (403). At the *database*
layer, the append-only trigger on `ops.agent_event` rejects UPDATE and DELETE with `23001` —
so even a fully-privileged connection cannot mutate the immutable ledger.

---

## 6. Files

| File | Committed? | Purpose |
|---|---|---|
| `seed/010_tower_review_log.sql` | yes | SYNTHETIC Tower review log (ops.* review interaction + summaries). |
| `seed/020_synthetic_shopping.sql` | yes | SYNTHETIC shopping lists/items (public). |
| `seed/030_cockpit_read_models.sql` | yes | Read-model projections of ops.* for the cockpit. |
| `provision.mjs` | yes | Stand up + seed the disposable Postgres cluster. |
| `setup-directus.mjs` | yes | Bootstrap Directus against the cluster. |
| `register-collections.mjs` | yes | Register the four proof tables as Directus collections. |
| `start-directus.mjs` / `stop.mjs` | yes | Start (announce-only) / tear down the stack. |
| `configure-access.mjs` | yes | Create the least-privilege Cockpit Viewer role/policy/perms/user. |
| `permission-test.mjs` | yes | Acceptance + adversarial permission proof. |
| `directus/package.json`, `directus/.env.example` | yes | Directus dep manifest + masked env template. |
| `.runtime/`, `directus/node_modules/`, `directus/.env` | **NO (gitignored)** | Cluster data, installed deps, real secrets. |

---

## 7. Out of scope (increment 2)

Deferred per the brief: the one constrained CRUD write-back, the one safe non-merge
`command_request`, and the Directus-outage test. This increment is the two read views + the
permission test only.
