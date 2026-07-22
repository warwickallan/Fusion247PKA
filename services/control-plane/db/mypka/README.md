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
| `060_build_contract.sql` | BUILD-002 build-acceptance layer: `cockpit.build_contract` (approved-version record + readable projection) + `cockpit.contract_command` (approval INTENT queue) + guard triggers | teardown |
| `070_build_contract_grants.sql` | least-privilege grants for the contract layer (cp_directus render+request-only; cp_worker execute-only; atomic revoke-then-grant) | teardown |
| `080_build_contract_pack.sql` | evolves `build_contract` to the three-document PACK model: adds `documents` jsonb + `pack_content_hash`; guard v2 freezes them once set | teardown |
| `090_build_contract_doc.sql` | `cockpit.build_contract_doc` — readable Markdown BODY + Git identity per pack member (Brief/Contract/Plan); append-only; cp_directus SELECT | teardown |
| `seed/build-002-contract-draft.sql` | seeds the interim single-doc v0.1-draft row (now superseded) | — |
| `seed/build-002-contract-pack-v1.sql` | the v1.0-draft pack seed (now superseded by v1.1) | — |
| `teardown.sql` | **rollback path** — reverses 010–090 (the `cockpit`-schema cascade drops the 060/080/090 objects + guards; `drop owned by cp_*` clears the 070 grants); leaves the asdair data tables untouched | — |

**Reproducible pack population** (GPT review): the live pack row + readable doc bodies are loaded from Git by the committed `services/control-plane/wp-d-proof/load-contract-pack.mjs` (`node load-contract-pack.mjs --version=v1.1-draft`) — no manual live-row editing. Directus collections + the `body_markdown` Markdown interface are registered by `register-contract-collections.mjs`. The approval-apply worker runs operationally via `ensure-contract-worker.mjs` (watch loop) + `apply-contract-command.mjs --watch`.

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
Provisions a throwaway local Postgres, builds a minimal asdair stub, applies 010–050, proves the
least-privilege boundary reproduced (cp_directus request-only, cp_worker execute-only, guards fire),
then applies `teardown.sql` and asserts every cockpit object — including the `cockpit` schema
(migration 050) — is gone and the data tables survive.
**19/19 pass.** (The driver provisions the cluster in a repo-local dir — node-spawned `initdb` under
`%TEMP%` stalls on this machine's file scanning.)

## Applying to hosted MyPKA
`010`/`020`/`030` are already applied (this is their faithful record). `040` is safe to re-apply to
the live DB — it is one atomic transaction, so a re-apply never opens a window where the running
cockpit loses its grants. Role passwords are set separately from `.runtime-live/` (never committed).
