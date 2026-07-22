# Tower architecture decision brief — DEV-separate vs promote-to-LIVE

**Date:** 2026-07-23 · **Author:** Larry · **Status:** decision-oriented; **no migration performed**. Warwick's approval required before any promotion.

## The choice

- **A — Stay separate:** operational Tower remains permanently in its own Supabase project (`iiqstxfqjbrbyplwwsql`, today's DEV/current project).
- **B — Promote to LIVE (recommended):** the **operational** Tower is promoted into **MyPKA LIVE** (`kerdinlgcfxnjrztwqde`) as a dedicated `tower` schema, logically isolated by its own roles/grants/append-only controls; a **MyPKA DEV** project keeps Tower development + synthetic tests. This is exactly the Task-5 target state.

## Assessment (A vs B)

| Dimension | A — separate project | B — LIVE `tower` schema (+ DEV) |
|---|---|---|
| **Simplicity for Warwick** | Two live databases to know/operate | **One** live database; Tower is "just another schema" like cockpit/asdair ✅ |
| **Reliability** | Two projects to keep alive/monitor | One live project, one health story ✅ |
| **Credentials & secrets** | Two DSNs + two secret sets | One live DSN, role-scoped (cp_*-style) ✅ |
| **Migration management** | Separate migration stream | Folds into the one MyPKA migration stream (cockpit 010–220 pattern) ✅ |
| **Backup/recovery** | Two projects' PITR/backups | One project's PITR covers Tower too ✅ |
| **Directus visibility** | Directus (on LIVE) can't natively see a *different* project's tables | Directus surfaces Tower turns/reviews **natively** (same project) ✅ |
| **BUILD / exact-head correlation** | Tower (DEV) is remote from cockpit's build records (LIVE) | Tower + cockpit **co-located** → turn↔build↔PR-head correlation is a local join ✅ |
| **TowerBot operation** | Works (own bot) | Works (own bot) — **neutral** |
| **ObsidiwAI integration** | Cross-project reach needed | Future ObsidiwAI LIVE schemas sit **beside** Tower — one hub ✅ |
| **Security / blast radius** | **Hard** project isolation ✅ | Bigger LIVE surface, but contained by dedicated roles/grants + append-only (the proven cp_directus/cp_worker least-privilege seam) — adequate for a first-party hub |
| **Cross-project event routing** | Tower↔LIVE (builds, cockpit, notifications) needs **cross-project plumbing** ❌ | Eliminated — same project, in-DB ✅ |
| **Maintenance burden** | Two live projects (creds, backups, monitoring, migrations ×2) | One ✅ |

**Where A genuinely wins:** hard, project-level blast-radius isolation, and a clean DEV/test boundary. **But B keeps the DEV/test boundary** (a MyPKA DEV project) *and* gets isolation via roles/grants — so A's only unique advantage is a harder security wall, at the cost of a second live database Warwick must operate and cross-project event plumbing.

## Recommendation

**B — promote the operational Tower into MyPKA LIVE as a dedicated `tower` schema**, DEV kept separate for development + synthetic tests. Rationale: it minimises Warwick's operational burden (one live DB), removes cross-project routing, gives Directus + future ObsidiwAI native visibility, co-locates Tower with the build/cockpit records it supervises, and folds into one migration + backup story — while dedicated roles/grants + append-only controls provide the isolation that matters for a first-party hub (Warwick never operates a second live database).

**Target state (Task 5):**
- **MyPKA DEV** — Tower development + synthetic tests (todays' `iiqstxfqjbrbyplwwsql` becomes the DEV project, or a fresh DEV).
- **MyPKA LIVE** — `fcg` · `cockpit` · `asdair` · **`tower`** · `directus_sys` · future ObsidiwAI operational schemas.
- Tower isolated in LIVE via: dedicated `tower_worker` / `tower_directus` roles (least-privilege, mirroring cp_worker/cp_directus), append-only on turns/reviews/notifications, and no grant that lets Directus mutate a review or a turn's verdict.

## Guardrails before any promotion (Warwick-gated — NOT done here)

1. Capture the live Tower DEV schema as ordered idempotent migrations first (Phase-2 item), reviewed.
2. Promote via those migrations into LIVE `tower` — never an ad-hoc copy.
3. Dedicated roles/grants + append-only, proven before cut-over.
4. Keep DEV as the test bed; TowerBot config unchanged.
5. No data migration of the 24 held historical turns until their disposition is decided.

**No migration or promotion has been performed. This brief is for Warwick's decision only.**
