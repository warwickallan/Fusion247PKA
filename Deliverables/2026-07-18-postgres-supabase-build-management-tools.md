---
title: "Postgres/Supabase-Backed Tables+Docs Tools for a Build-Management System of Record"
date: 2026-07-18
author: Pax
status: final
confidence_overall: Medium-High
---

# Postgres/Supabase-Backed "Tables + Docs" Tools — Replacing Flaky ClickUp

## Executive summary

The proposed architecture — **git-markdown = doc truth, Supabase Postgres = structured build-state truth, a thin agent API/MCP, and an off-the-shelf UI sitting directly on the existing Postgres** — is sound and is a well-documented pattern, not a novel risk. No single turnkey product beats this split for your specific constraint (existing Supabase Postgres with an existing `ftw` schema, existing git-markdown SSOT). **Directus** is the strongest UI-overlay candidate: it introspects an existing Postgres schema without owning it, ships a first-party MCP server with per-agent role permissions, and is free to self-host under $5M revenue. **NocoDB** is a credible fallback with a similar "connect to existing tables" model, but carries a documented catastrophic data-loss incident and a weaker (read/write-only, no schema) MCP. **Teable is disqualified** for this specific need — it owns its own Postgres instance rather than attaching to your existing schema, which would recreate the "another silo" problem you're trying to escape. **Outline is out of scope** — it's a Postgres-backed wiki that would compete with, not complement, your git-markdown SSOT.

## Key findings

1. **Directus can sit directly on your existing Supabase Postgres/`ftw` schema without owning it, self-hosted.** Directus introspects existing tables and builds its admin/API layer on top without modifying your schema; Supabase itself documents Directus as a supported integration. Directus Cloud does *not* support connecting an external database — self-hosting is required. **Confidence: High** (two independent primary sources — Supabase's own partner page and Directus community/docs — plus a third-party integration guide). [Supabase × Directus](https://supabase.com/partners/integrations/directus) · [Directus community thread](https://community.directus.io/t/connecting-to-an-existing-database-supabase/1446) · [Directus + Supabase guide](https://directus.ink/guides/directus-plus-supabase/)

2. **Directus ships a first-party MCP server with per-agent role permissions** (read + write: create/update items, manage files, respect the same role/permission model as human users). This is the cleanest "agent API" of the tools reviewed because permissions are enforced natively, not bolted on. **Confidence: High** (vendor docs corroborated by two independent third-party MCP directories). [Directus MCP docs](https://directus.com/docs/guides/ai/mcp) · [Directus MCP tools reference](https://directus.com/docs/guides/ai/mcp/tools) · [mcpmarket.com listing](https://mcpmarket.com/server/directus)

3. **NocoDB also connects to an existing external Postgres schema** ("External Data Source" / "Integrations" feature) and auto-discovers tables, FKs (as linked records), and — as of the 2026.04.5 release — Postgres ENUM columns as SingleSelect fields. Its MCP server, however, is **record-level CRUD only** — it cannot create/alter tables or fields, and officially supports only Claude Desktop, Cursor, and Windsurf as clients (a browser/OAuth path also exists). **Confidence: High** for schema introspection (NocoDB docs + community discussion agree); **Medium** for MCP client-list completeness (single vendor doc). [NocoDB data source docs](https://nocodb.com/docs/product-docs/data-sources/connect-to-data-source) · [NocoDB MCP docs](https://nocodb.com/docs/product-docs/mcp) · [2026.04.5 release notes](https://github.com/nocodb/nocodb/releases/tag/2026.04.5)

4. **NocoDB has at least one documented catastrophic self-hosted data-loss incident** (5,000+ records lost unexpectedly, reported on NocoDB's own community forum, March 2025). NocoDB's response has been to add a Record Trash and, in 2026.04.5, a **Base Trash** (recovers whole tables/views/fields). This mitigates but does not erase the track-record concern — the fix is recent relative to the incident. **Confidence: Medium** — single documented incident (no independent second report found), but it is a first-party admission (NocoDB shipped a direct feature response), which raises confidence that the underlying risk was real. [Community thread — data loss](https://community.nocodb.com/t/lost-entire-nocodb-database-unexpectedly/1752) · [2026.04.5 release (Base Trash)](https://github.com/nocodb/nocodb/releases/tag/2026.04.5)

5. **Baserow can both host external data on your own Postgres and, per an official reply, connect to and edit pre-existing external Postgres tables directly** — functionally similar to NocoDB's model, and it now ships a **native embedded MCP server** (local-first, no data leaves your infrastructure). This capability reads as newer/less battle-tested than NocoDB's equivalent in the sources found. Licensing is MIT for the free/core tier; Premium/Advanced/Enterprise self-host tiers require a paid license key. **Confidence: Medium** (official community reply confirms the capability, but no independent second source or maturity signal was found for the external-table-editing feature specifically). [Baserow external-Postgres thread](https://community.baserow.io/t/external-postgres-existing-data/6538) · [Baserow MCP docs](https://baserow.io/user-docs/mcp-server) · [Baserow self-hosted licenses](https://baserow.io/user-docs/self-hosted-licenses)

6. **Teable does not attach to a pre-existing/populated Postgres schema — it owns its own Postgres instance.** Every Teable table is a physical table Teable itself creates in a database it controls (via `PRISMA_DATABASE_URL`); its "external database connection" feature (`PUBLIC_DATABASE_PROXY`) works in the *opposite* direction from what you need — it exposes Teable's own DB **outward**, read-only, for external tools to query, rather than letting Teable ingest and manage your **existing** `ftw` tables. Pointing Teable at Supabase would mean handing it a fresh schema/project to own, which reproduces the "another silo" problem. **Confidence: High** — confirmed directly from Teable's own deployment documentation. [Teable database-connection docs](https://help.teable.ai/en/deploy/database-connection) · [Teable GitHub](https://github.com/teableio/teable)

7. **Outline is a Postgres-backed wiki (docs/users/collections in Postgres, Redis for cache/realtime), not a structured-tables tool** — it is a plausible alternative to git-markdown for docs, not a complement to it. Given your hard rule that git-markdown is the SSOT for the wiki, introducing Outline would create a second, competing doc system rather than filling the structured-tables gap. **Out of scope by design**, not by capability — flagging so it isn't reconsidered later without noting this conflict. **Confidence: High** (two independent self-hosting guides agree on architecture). [Self-hosting Outline 2026](https://ossalt.com/guides/self-hosting-guide-outline-2026) · [OneUptime Outline setup guide](https://oneuptime.com/blog/post/2026-01-15-setup-outline-wiki-ubuntu/view)

8. **Appsmith and Budibase both connect to arbitrary existing Postgres via connection string** (no DB ownership required) and are strong if the real need is a bespoke, ClickUp-style dashboard (Kanban/status pipeline/custom fields) rather than a generic spreadsheet grid over every table. Budibase's differentiator is auto-generating a full CRUD app (forms, tables, detail views) directly from an existing Postgres schema; Appsmith is more powerful but requires JavaScript for data binding. **No MCP server was confirmed for either in this research pass — treat as an open question, not a confirmed absence.** **Confidence: Medium** (vendor/comparison-site sources agree on connection model; MCP existence unverified). [Budibase](https://budibase.com/) · [Appsmith vs Budibase vs ToolJet comparison](https://blog.tooljet.com/appsmith-vs-budibase-vs-tooljet/)

9. **Supabase's own official MCP server is explicitly not recommended for production data by Supabase itself** — the docs state it is "designed for development and testing purposes" and warn never to connect it to production. This is a killer caveat if the plan was to skip a UI/API overlay tool and let agents talk to bare Supabase MCP directly against the build-state tables. Unofficial community forks (e.g., a read-write server with migration versioning) exist but are third-party and unvetted for this use. Separately, **Supabase Studio's Table Editor is functional but "minimal compared to Airtable"** per independent comparison reviews — it is not a ClickUp-replacement UI on its own. **Confidence: High** for the production-MCP warning (Supabase's own docs, a primary source); **Medium** for the Studio-UI characterization (comparison-site consensus, secondary sources). [Supabase MCP docs](https://supabase.com/docs/guides/ai-tools/mcp) · [Supabase blog — MCP server](https://supabase.com/blog/mcp-server) · [Softr: Supabase vs Airtable 2026](https://www.softr.io/blog/supabase-vs-airtable)

## Ranked recommendation

1. **Directus, self-hosted, pointed at the existing Supabase Postgres, `ftw`-adjacent schema.** Best combination of "attach without owning," native role-scoped MCP, and mature (if not OSI-approved) licensing that's free at your scale.
2. **NocoDB as a fallback/bake-off candidate** if Directus's UI or data-model fit proves worse in practice — same "attach to existing schema" story, but weigh the documented data-loss incident and keep independent backups (Supabase point-in-time recovery / `pg_dump`) regardless of which tool you pick.
3. **Budibase for a purpose-built build-tracker dashboard** (Kanban/status board over `ftw` tables) if the generic-grid UI from #1/#2 doesn't feel like a ClickUp replacement — auto-generates CRUD screens from the existing schema.
4. **Baserow** — viable, native MCP is a plus, but the specific "edit pre-existing external tables" capability reads less proven; worth a short spike before committing.
5. **Teable — do not use for this need.** It would recreate the "another silo" problem the team is trying to eliminate.
6. **Outline — do not use for this need.** It duplicates, rather than complements, the git-markdown SSOT.
7. **Bare Supabase (Studio + official MCP) alone is insufficient** — necessary substrate, not a sufficient replacement for ClickUp's human UI, and Supabase itself warns its MCP is not for production use.

## Killer caveats

- **Never point agents at Supabase's official managed MCP for production writes** — Supabase says so itself. Use a scoped service-role key behind RLS plus the overlay tool's own MCP (Directus/NocoDB/Baserow), or a self-hosted, vetted read-write Postgres MCP if you need raw SQL access.
- **Turn off "schema editing from the UI" against production tables** in whichever tool you pick — NocoDB explicitly warns this can corrupt the connected database; treat schema changes as git-reviewed SQL migrations only, UI tools for data only.
- **Namespace the overlay tool's own metadata tables separately from `ftw`** (most of these tools already default to their own schema/prefix — verify before go-live) to avoid collision.
- **Directus's license (MSCL, BSL-successor) is not OSI-approved open source**, even though self-hosting is free under $5M revenue — a fine trade for a small team, but not "true FOSS" if that matters later.

## Methodology

Web research across vendor documentation (Supabase, Directus, NocoDB, Baserow, Teable, Outline, Budibase), official community forums (community.directus.io, community.nocodb.com, community.baserow.io), GitHub release notes, and independent comparison/review sites, conducted July 2026. Searches ordered: connection-to-existing-Postgres capability → MCP/agent-API quality → licensing/cost → reliability/data-loss track record. No hands-on testing was performed; this is desk research.

## Limitations

- Budibase and Appsmith MCP-server existence could not be confirmed or ruled out in this pass — treat as an open question before final tool selection.
- Baserow's "connect to pre-existing external Postgres tables" capability is confirmed by a single official community reply; no second independent source or version/maturity detail was found — worth a short hands-on spike.
- Reliability/data-loss evidence is necessarily anecdotal (public forum threads), not a systematic incident database — directional, not statistical.
- Did not evaluate NocoBase (a name surfaced incidentally in comparison articles) — flagging as a possible follow-up if Directus/NocoDB don't fit.

## Recommendations / next questions

- Run a one-day spike: point Directus at a read-only replica or a scratch schema of the existing Supabase project, confirm MCP agent write-permissions map cleanly to your team-role model, before committing.
- Decide backup policy independent of the overlay tool's own trash/recovery features (Supabase PITR or scheduled `pg_dump`) regardless of which tool is chosen — this is a Silas-scoped follow-up.
- If a bespoke ClickUp-style board (not a generic grid) turns out to matter more than expected, run the same spike against Budibase before finalizing.
