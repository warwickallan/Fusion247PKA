# MyPKA cockpit — versioned migrations (canonical live operational DB)

**MyPKA** (Supabase project `kerdinlgcfxnjrztwqde`) is the **canonical live operational database**
for the cockpit (architecture decision, Warwick 2026-07-21). AsdAIr already lives here; the Tower,
TubeAIR and portfolio/build-state schemas are promoted into their **own schemas in this same
project** (no cross-project federation, sync, cross-DB joins, or second Directus control plane).

This directory is the committed, reproducible home for **everything already applied to hosted MyPKA
for the cockpit layer** — captured faithfully from the live catalog, not from memory.

## Migrations (apply in order)
| File | What it creates | Reversible |
|---|---|---|
| `010_directus_sys_schema.sql` | `directus_sys` schema (Directus's ~40 system tables live here, isolated) | teardown |
| `020_cockpit_roles.sql` | least-priv login roles `cp_directus`, `cp_worker` (no password — set out-of-band) | teardown |
| `030_command_request.sql` | `asdair.command_request` write-back INTENT queue + two guard triggers | teardown |
| `040_cockpit_grants.sql` | the asymmetric least-privilege grants (revoke-then-grant, atomic, idempotent) | teardown |
| `050_cockpit_portfolio.sql` | the `cockpit` schema + portfolio/build-state records (`overall_state`, `build`, `decision`, `movement`, `domain_summary`) that drive the management view | teardown |
| `teardown.sql` | **rollback path** — reverses 010–050 (incl. dropping the `cockpit` schema); leaves the asdair data tables untouched | — |

**Secrets:** role passwords are **never** in these migrations. `020` creates the roles with no
password; the runtime provisioner sets them from the gitignored `.runtime-live/` store
(`alter role … password …`). Until then a role cannot authenticate (fail-closed).

**Relationship to Supabase migration history:** `030` is the committed canonical copy of the object
first applied to hosted as `asdair_005_cockpit_command`. The roles/grants/`directus_sys` (previously
only in gitignored provisioning scripts) are now represented here as versioned SQL.

## Tested rollback/teardown path
```bash
bash services/control-plane/db/mypka/test/run-migration-test.sh
```
Provisions a throwaway local Postgres, builds a minimal asdair stub, applies 010–040, proves the
least-privilege boundary reproduced (cp_directus request-only, cp_worker execute-only, guards fire),
then applies `teardown.sql` and asserts every cockpit object is gone and the data tables survive.
**15/15 pass.** (The driver provisions the cluster in a repo-local dir — node-spawned `initdb` under
`%TEMP%` stalls on this machine's file scanning.)

## Applying to hosted MyPKA
`010`/`020`/`030` are already applied (this is their faithful record). `040` is safe to re-apply to
the live DB — it is one atomic transaction, so a re-apply never opens a window where the running
cockpit loses its grants. Role passwords are set separately from `.runtime-live/` (never committed).
