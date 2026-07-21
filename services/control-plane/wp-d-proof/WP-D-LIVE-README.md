# BUILD-014 — LIVE cockpit (Priority One), slice 1: real asdair regulars

**Status:** BUILT + PROVEN on this machine (2026-07-21). LOCAL-only (`127.0.0.1`), LIVE hosted data.
**Branch:** `build-014/directus-live-cockpit`.

This is the first executable slice of the morning-reset **Priority One** ("live Directus cockpit,
connected to hosted Supabase DEV data, at a stable authenticated URL"). It stands up a **local**
Directus whose data source is the **hosted MyPKA Supabase** (real `asdair` data), and proves it
serves the real 91 **Regulars** at a local authenticated URL — the walking skeleton the rest of the
cockpit hangs off.

## What it is (and the trust boundary)
```
127.0.0.1 only                                   hosted MyPKA Supabase (eu-west-1 pooler, TLS)
┌─────────────────────────────┐                  ┌───────────────────────────────────────────┐
│ Directus 11  :8074           │  cp_directus     │ role cp_directus  (LOGIN, NOINHERIT)       │
│  admin login (local)         │─────pooler──────▶│   • OWNS nothing in asdair                  │
│  collection: regulars (RO)   │   TLS, least-    │   • SELECT on asdair.regulars ONLY          │
│  system tables -> directus_sys│   privilege     │   • CREATE/USAGE on directus_sys (its own)  │
└─────────────────────────────┘                  │   • DENIED every other asdair table (42501) │
                                                  └───────────────────────────────────────────┘
```
- **Directus internals never touch the real brain schemas.** Its ~40 `directus_*` system tables are
  confined to an isolated `directus_sys` schema; `asdair` is on the search path read-only so the
  real `regulars` table (PK `id`) is discoverable.
- **Least-privilege is proven two ways:** `cp_directus` reads `asdair.regulars` (91) and is denied
  `asdair.rules` at the DB layer (SQLSTATE 42501); over the Directus API, `/items/rules` → 403 while
  `/items/regulars` → 91 real rows.
- **Personal-data doctrine holds:** real household data is reachable **only from this machine**
  (Directus binds `127.0.0.1`). **No off-loopback / phone exposure here** — that is gated by Vex's
  CRIT-1 + G1–G8, unchanged.

## Run it (from `services/control-plane/`)
```bash
node wp-d-proof/.runtime-live/gen-role-sql.mjs        # (re)generate the role SQL from the gitignored DSN
node wp-d-proof/.runtime-live/provision-and-prove.mjs # create cp_directus + PROVE least-privilege
node wp-d-proof/setup-directus-live.mjs               # bootstrap Directus (system tables in directus_sys)
node wp-d-proof/register-live.mjs                     # expose asdair.regulars as a read-only collection
node wp-d-proof/start-directus-live.mjs               # start (detached, 127.0.0.1). ANNOUNCE ONLY.
node wp-d-proof/prove-live.mjs                        # acceptance: 91 real rows at the authenticated URL
node wp-d-proof/stop-live.mjs                         # stop Directus
```
All secrets (the `cp_directus` password, the Directus admin login) live in `.runtime-live/`
(gitignored). Committed scripts read them from there — **no secret is committed**.

## Fully reversible
```sql
drop schema if exists directus_sys cascade;   -- removes all directus_* tables
drop owned by cp_directus;                     -- removes its grants + any objects
drop role if exists cp_directus;
```
This leaves the hosted MyPKA Supabase exactly as it was.

## Slice 2 — the AsdAIr write-back trust seam (authorised, synthetic-first)
Authorised by Warwick 2026-07-21: "narrow AsdAIr command-request write-back against the real
schema, using allowlisted actions, least privilege, idempotency, receipt logging and a
synthetic-first test." Built and proven:

- **One new table** on the real schema (`asdair.command_request`, migration `asdair_005_cockpit_command`)
  — additive; existing asdair tables are untouched. Two guard triggers: inserts are intent-only,
  the request core is immutable and only valid forward transitions are allowed.
- **Asymmetric least-privilege roles:** `cp_directus` (cockpit) may only INSERT the intent columns
  and SELECT — it can never execute or write shopping items. `cp_worker` (executor) claims + receipts
  the queue and performs the effect, but cannot fabricate a request. Neither can touch the rest of asdair.
- **One allowlisted command** `add_regular_to_next_week {regular_id, qty}` → the worker upserts a
  `shopping_list_item` into the regular's household `next_week_draft` list. Anything else → `failed`,
  never executed.
- **Idempotency** two ways: unique `idempotency_key` (duplicate → 23505) and effect-level upsert by
  (list, item name) so replays update rather than duplicate. **Receipts** are written to the row and
  are immutable once done.
- **Strong backstop:** because the DB grant limits `cp_directus` to intent-only, *even a Directus
  admin POST cannot execute or write items* — the DB layer holds regardless of Directus role config.
- **`is_synthetic` semantics (review F5):** it records *trusted-setup* provenance, not cockpit
  self-declaration — the cockpit is column-scoped and cannot set it, so a real cockpit/Directus
  request is `is_synthetic=false` by design (it can never lie about being "just a test"). DB-level
  synthetic test intents are marked `true` by the trusted setup. A proof's isolation therefore comes
  from the **synthetic household + `--key-prefix` scoped drain + guaranteed cleanup**, not from the
  flag; the Directus proof's rows are removed in `finally` so an interrupted run leaves nothing real.
- **Idempotent least-privilege (review F3):** `provision-writeback-live.mjs` revokes the write-back
  objects before granting, so a re-run always enforces the exact "ONLY" set. Identity-column inserts
  need no sequence grant (review F4).

Run + prove (synthetic-first; the real household id 1 is never touched):
```bash
node wp-d-proof/provision-writeback-live.mjs      # create cp_worker + the seam grants
node wp-d-proof/prove-writeback-live.mjs          # 10/10: seam, asymmetry, idempotency, allowlist, guards
node wp-d-proof/prove-writeback-directus.mjs      # 4/4: the SAME write end-to-end through the Directus API (no terminal)
node wp-d-proof/asdair-worker.mjs --drain|--watch # the trusted executor
```
Reversible: `drop table asdair.command_request cascade; drop role cp_worker;` (+ the slice-1 reversal).

**Pre-existing posture surfaced (not introduced here):** Supabase advises `asdair` has RLS disabled
on all tables. The schema is NOT exposed on the REST API (no anon reach) and the cockpit uses the
dedicated least-priv `cp_directus`/`cp_worker` logins, so this write-back does not widen exposure —
flagged for a separate decision, not auto-changed.

## Known architecture fork (Warwick's call, flagged not decided)
The four cockpit surfaces span **two** Supabase projects: `asdair` + TubeAIR + AsdAIr live in the
**MyPKA** project (`kerdinlgcfxnjrztwqde`); the **Tower** supervision timeline + HUD live in the
separate **control-plane DEV** project (`iiqstxfqjbrbyplwwsql`). Directus attaches to **one** database.
Options: (a) a second Directus for the control-plane project, (b) replicate/FDW the Tower read-models
into MyPKA so one cockpit sees everything, (c) keep Tower on its existing surface. Slice 1 does not
depend on this; the MyPKA-side surfaces can proceed while the fork is decided.
