# Build-management system of record — consolidated recommendation

**Date:** 2026-07-18 · **Author:** Larry (synthesis) · **Inputs:** three Pax research briefs (below) · **Question:** replace flaky ClickUp with a robust, agent-writable home for build management (wiki + tables + DB).

## Verdict: ASSEMBLE — don't buy a monolith, don't crown ClickUp, don't build from scratch.
All three research angles land in the same place. There is **no turnkey product** that does wiki + real database + mature multi-agent API/MCP + a clean data-loss record all at once — every off-the-shelf option fails at least one axis. But you already own the two hard, durable layers; you're missing a thin overlay. Effort to close the gap: **~a week of focused build.**

## Why ClickUp actually fails (it's structural, not a UI gripe)
ClickUp's Docs API is **read-modify-replace with no version check** → no idempotent writes → concurrent/retried agent writes silently clobber each other and lose data. This is a *durability* defect. **Wrapping ClickUp in MCP does NOT fix it** — MCP is a translation layer, not a durability guarantee. The same whole-page read-modify-replace risk shows up in Notion's own hosted MCP, so this is a pattern, not a ClickUp-specific bug.

## The target architecture (three thin layers)
1. **Docs / prose truth = git markdown** — already have it (`Team Knowledge` / `PKM`, SSOT + wikilinks, immutable history, every agent reads/writes natively). Keep it. This is the "ObsidiWiki" spine.
2. **Structured state truth = Supabase Postgres, EVENT-SOURCED** — builds, work_packages, work_package_events, checkpoints, qa_verdicts, decisions. ACID, queryable, RLS. We already started this (the `ftw` schema).
3. **The missing 20%:**
   - **A narrow, hand-built MCP write layer** — 6–8 *named write-functions* (e.g. `record_checkpoint`, `record_verdict`, `open_decision`), **never raw SQL, never generic Postgres MCP.** Generic Postgres MCP servers (crystaldba, googleapis toolbox) are fine for human debugging but too permissive to hand an autonomous agent as its only interface.
   - **An off-the-shelf UI overlay on the SAME Postgres** — humans get an Airtable/Notion-like view over the exact tables agents write. **Directus** is the pick.

## The structural safety rule (tattoo this on the repo)
The fix is **structural, not disciplinary.** The temptation is to add one convenient `UPDATE status = ...` — that single shortcut reintroduces ClickUp's exact failure mode in a shinier package. Instead: **revoke `UPDATE`/`DELETE` grants on the event tables at the database level** so overwriting is *impossible*, not merely discouraged. Append-only + projections. (Same principle that made tonight's baton work: bake safety into the walls, not the good intentions.)

## Tool picks (from the briefs)
| Layer | Pick | Why | Avoid |
|---|---|---|---|
| Structured DB | **Supabase Postgres** (event-sourced) | already run it; ACID; RLS; auto REST via PostgREST | — |
| Tables UI overlay | **Directus** | *introspects your EXISTING Postgres without owning it*; first-party role-scoped MCP; self-host free under $5M rev | **Teable** (owns its own Postgres → recreates the silo); **NocoDB** = credible fallback but a documented data-loss incident + weaker record-only MCP |
| Docs / wiki | **git markdown** (keep) | durable, versioned, agent-native | **Confluence** (worst data-loss rep + sunsetting self-host); **Notion-as-DB** (block-graph, degrades past ~2–3K rows, 3 req/s ceiling throttles concurrent agents, no self-host) |
| Agent write access | **narrow hand-built MCP** (function-scoped, behind RLS) | durability + least privilege | bare Supabase managed MCP (**Supabase itself says not for production data**); generic Postgres MCP |

**Interesting wildcard:** *Outline* (open-source wiki) is the only candidate with a first-party vendor-shipped MCP (live Feb 2026) + 8-year mature REST API, and it runs on plain Postgres. Out of scope while git is the doc truth, but it's the one to revisit if we ever want the prose layer off git and into a queryable store.

## How this closes tonight's loop (concrete, not abstract)
The BUILD-010 baton currently posts `[LARRY→TOWER]` checkpoints and `[TOWER→LARRY]` verdicts as **ClickUp comments** — i.e. straight into the flaky read-modify-replace API. In the target architecture those become **append-only rows** in the Supabase build-state store (`checkpoints`, `qa_verdicts`), idempotent and queryable, with Directus as the human view and ClickUp/Telegram demoted to optional notification projections. **Tonight's baton is the first consumer of this system of record** — so the two efforts converge.

## Phased plan (~a week)
1. **Day 1–2:** event-sourced schema in Supabase (builds/WPs/events/checkpoints/verdicts/decisions); revoke UPDATE/DELETE; RLS. (Silas.)
2. **Day 2–3:** narrow MCP write layer — named functions only. (Mack.)
3. **Day 3–4:** point the baton at it (checkpoints/verdicts → rows, not ClickUp comments). (Mack.)
4. **Day 4–5:** stand up Directus on the same Postgres for the human UI; wire its role-scoped MCP for reads. (Mack/Silas.)
5. **Day 5:** Vex security pass (RLS, MCP least-privilege, no-secret-leak); keep git wiki for prose.

## Verify before committing (open items from the briefs)
- Confirm ClickUp's lack of write-idempotency against its own API reference (inferred, ~10-min check).
- Evaluate **GitHub Issues/Projects** as a fourth "buy" option — the repo is already the code system of record, so it may be a low-friction fit (not yet assessed).
- Short hands-on spike on Directus (and NocoDB fallback) *attaching to* the existing `ftw` Postgres before final selection; confirm Baserow/Appsmith/Budibase MCP status if they re-enter.
- Reliability evidence across the briefs is medium-confidence (aggregators, not all primary post-mortems); nothing here has been load-tested at our real multi-agent write volume.

## Source briefs
- `Deliverables/2026-07-18-agent-build-record-system-requirements.md`
- `Deliverables/2026-07-18-postgres-supabase-build-management-tools.md`
- `Deliverables/2026-07-18-system-of-record-platform-comparison.md`
