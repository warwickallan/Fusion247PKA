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

## Known architecture fork (Warwick's call, flagged not decided)
The four cockpit surfaces span **two** Supabase projects: `asdair` + TubeAIR + AsdAIr live in the
**MyPKA** project (`kerdinlgcfxnjrztwqde`); the **Tower** supervision timeline + HUD live in the
separate **control-plane DEV** project (`iiqstxfqjbrbyplwwsql`). Directus attaches to **one** database.
Options: (a) a second Directus for the control-plane project, (b) replicate/FDW the Tower read-models
into MyPKA so one cockpit sees everything, (c) keep Tower on its existing surface. Slice 1 does not
depend on this; the MyPKA-side surfaces can proceed while the fork is decided.
