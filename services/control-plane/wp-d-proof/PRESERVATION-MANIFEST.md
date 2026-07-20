# wp-d-proof — preservation manifest (BUILD-014 campaign, STEP 0)

**Created:** 2026-07-20 · **By:** Larry (myPKA orchestrator) · **Why:** Warwick's BUILD-014
completion-campaign authorization requires the untracked `services/control-plane/wp-d-proof/`
localhost Directus proof to be preserved into git **before** any branch switch / worktree clean,
so campaign evidence is never dependent on an untracked local folder.

## Preserved into git (this safety branch)
| File | sha256 | Role |
|---|---|---|
| `services/control-plane/wp-d-proof/configure-db-role.mjs` | `048291adb6915ef3e4a516b96d8ee87b2f22402bf1495efec19f956c62081104` | Least-privilege Directus DB login role (`cp_directus`): full DML on `public` synthetic projections, **no USAGE on schema `ops`** (structural ledger deny), NOSUPERUSER/NOBYPASSRLS. Reusable reference for PR-4/PR-5. |
| `services/control-plane/wp-d-proof/directus/package-lock.json` | `234086fd01e6358e2b4f089c41f100e0e84445c355084ee52c4971a93ef3b682` | Directus dependency lock (reproducibility). |

## Deliberately EXCLUDED (confirmed: no credentials, no runtime state committed)
- `wp-d-proof/directus/.env` — **credentials** (DB user/password, Directus admin secret). Already
  gitignored; never committed. Preserved only as live local state on the Yoga.
- `wp-d-proof/.runtime/` — **live/disposable runtime state**: a full local Postgres data cluster
  (`cluster/` — pg_wal, postmaster.pid, etc.), `directus.log`, `server.log`, `directus.pid`,
  `runtime.json` (holds scoped DB passwords). Disposable; must not be tracked.
- `wp-d-proof/directus/node_modules/` — ~60k reproducible dependency files (from package-lock).

## Provenance note
`configure-db-role.mjs` references sibling orchestration scripts (`provision.mjs`,
`setup-directus.mjs`, `start-directus.mjs`, `register-collections`) that did **not** survive in the
untracked folder — so this is a **reference artifact**, not a standalone runnable proof. PR-5 rebuilds
the cockpit + least-priv role properly against the approved boundary (private authenticated access,
not localhost-only). See `Deliverables/2026-07-20-build-014-tower-completion-campaign-brief.md`.
