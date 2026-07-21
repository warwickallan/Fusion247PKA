---
date: 2026-07-18
author: Pax
topic: multi-agent build-management system of record — requirements, prior art, build-your-own
status: final
---

# Multi-Agent Build-Management System of Record: Requirements, Prior Art, Build-Your-Own

## Executive summary

ClickUp fails as a shared agent-writable record because its Docs API is **read-modify-replace with no version check** — concurrent writes can silently clobber each other, and there is no idempotency-key mechanism to make retried agent writes safe. This is not fixable by wrapping ClickUp in an MCP server; MCP is a tool-calling shim, not a concurrency guarantee, so it inherits whatever the underlying store does. Buying a nicer PM tool (Linear, Notion's new External Agents API) does not solve the structural problem either — Notion's own hosted MCP exhibits the identical whole-page read-modify-replace risk. The right move for a solo founder with strong AI-agent leverage is **assemble, not buy or fully build**: Postgres (Supabase) as the event-sourced system of record, PostgREST for the machine API (free, comes with Supabase), a thin bespoke MCP layer exposing a handful of named write-functions (never raw SQL to agents), Supabase Studio or NocoDB for the human UI, and keep the existing git wiki exactly as-is for prose/decisions. Estimated effort: **4-6 focused days**, realistically call it one week with agent-assisted codegen.

## Key findings

**1. ClickUp specifically fails "no lost writes" and "idempotent writes" — Medium-High confidence.**
ClickUp's Docs API updates by loading the full document, modifying it, and writing the whole thing back with no optimistic-concurrency check (no ETag/version compare) — two concurrent agent sessions editing the same page can clobber each other with no warning [ClickUp Rate Limit Handler skill docs](https://mcpmarket.com/tools/skills/clickup-rate-limit-handler-1). This is corroborated as a *pattern*, not just a ClickUp-specific bug, by the identical architecture in Notion's hosted MCP: "the hosted MCP's notion-update-page tool replaces content at the page level by loading the entire page, modifying it, and writing the whole thing back... the MCP approach carries the risk of overwriting concurrent changes elsewhere in the document" ([Scalekit, Notion MCP vs Notion API](https://www.scalekit.com/blog/notion-mcp-vs-api)). Two independent tools, same failure mode — this is a structural property of REST-wrapped document APIs, not a one-off ClickUp defect. I did not find a direct primary source stating ClickUp lacks idempotency keys on task-creation retries; flagging that specific sub-claim as **inferred, not verified** — Larry/Warwick should treat it as a hypothesis to test, not a fact.

**2. Rate limits compound the concurrency problem at agent scale — High confidence, two independent sources.**
ClickUp applies per-token limits of 100 req/min (Free/Unlimited/Business), 1,000/min (Business Plus), 10,000/min (Enterprise), returning HTTP 429 on overflow ([ClickUp official docs](https://developer.clickup.com/docs/rate-limits); confirmed by [ConsultEvo's rate-limit guide](https://consultevo.com/clickup-api-rate-limits-guide/)). Three concurrent agents (Claude, Codex, Fable) polling/writing status against a 100-or-1000/min ceiling is a real constraint most teams hit long before they hit a genuine "too much data" problem.

**3. MCP does not solve concurrency or data-loss risk by itself — Medium confidence (industry-analysis sources, not benchmarked).**
The emerging 2026 architectural consensus is that session/state safety has to live in the data model layer, not the protocol layer: "session state moves to the data model layer (explicit handles backed by a shared data store), making MCP servers horizontally scalable" ([Gingerlabs, MCP 2026 Roadmap](https://gingerlabs.ai/blog/mcp-2026-roadmap-stateless-transport-agent-communication-enterprise-authentication)). Practically: an MCP server in front of ClickUp is still bound by ClickUp's write semantics; an MCP server in front of Postgres inherits whatever transactional guarantees you designed into the schema. **MCP is a translation layer, not a durability guarantee.**

**4. Git already satisfies "append-only audit trail" and "wiki links between records" — High confidence.**
This is exactly what Fusion247PKA's session-logs already do, and it matches documented industry pattern: "the audit trail is not a feature added to agents — it is an inherent property of storing agents in git... git diff shows when policies changed, git blame shows who changed them" ([Kosli, Using Git for a Compliance Audit Trail](https://www.kosli.com/blog/using-git-for-a-compliance-audit-trail/); pattern independently described for agent provenance at [Zylos Research](https://zylos.ai/research/2026-04-25-agent-identity-provenance-signed-audit-trails/)). Git is not, however, structured/queryable at scale — it has no native way to answer "show me every work-package with QA verdict = FAIL in the last 30 days" without scripting a full-repo scan. That's the gap Postgres fills; git should stay the home for prose/decisions/docs, not become the query layer.

**5. Postgres + PostgREST + a thin MCP is the dominant 2026 assemble pattern for agent-writable structured state — High confidence, multiple independent implementations exist.**
PostgREST turns schema + constraints directly into a REST API with idempotent PUT semantics enforced by the server ("PostgREST safeguards against unexpected behaviors, such as enforcing idempotent PUT requests," and relies on native Postgres constraints/RLS for integrity — [PostgREST docs](https://postgrest.org/); [GitHub](https://github.com/PostgREST/postgrest)). Supabase ships this by default and adds an MCP server with read/write support out of the box ([Supabase MCP docs](https://supabase.com/docs/guides/ai-tools/mcp); [github.com/supabase/mcp](https://github.com/supabase/mcp)). Multiple independent open-source generic Postgres MCP servers already exist and could shortcut a bespoke build entirely: [crystaldba/postgres-mcp](https://github.com/crystaldba/postgres-mcp) (configurable read/write + performance analysis), [googleapis/mcp-toolbox](https://github.com/googleapis/mcp-toolbox) (Google-maintained, prebuilt generic DB tools), [HenkDz/postgresql-mcp-server](https://github.com/HenkDz/postgresql-mcp-server) (14 consolidated tools, starts read-only, mutations require an explicit flag).

**6. Idempotency-key pattern is well-established and directly portable — High confidence, canonical primary source.**
Stripe's idempotency-key design (client sends a unique key per logical write; server deduplicates retries against it) is the reference implementation cited across the industry: [brandur.org, "Implementing Stripe-like Idempotency Keys in Postgres"](https://brandur.org/idempotency-keys) gives an actual Postgres schema for this. This maps directly onto the "no silent data loss / idempotent writes" requirement for a build-record schema.

**7. Purpose-built agent-memory products (Letta, Mem0, Zep) are solving a different, adjacent problem — Medium confidence.**
These are conversational/semantic memory systems (vector + graph + KV hybrids, temporal knowledge graphs), benchmarked on recall accuracy (Zep's Graphiti scores 63.8% vs Mem0's 49.0% on LongMemEval — [AgentMarketCap comparison](https://agentmarketcap.ai/blog/2026/04/10/agent-memory-vendor-landscape-2026-letta-zep-mem0-langmem)), not on transactional integrity of structured build records. Notably, even that category flags the exact risk relevant here: "without conflict resolution and authority rules, shared memory pools degrade as agents write inconsistent facts about the same entities" (same source). Adopting one of these for "which work-package is done" would be over-engineering — they're solving recall-under-ambiguity, not row-level consistency.

## Requirements checklist — does ClickUp meet it?

| Requirement | ClickUp today | Verdict |
|---|---|---|
| Structured + queryable | Custom Fields exist but Docs (where most agent output lands) are unstructured prose | **Partial fail** |
| Concurrency / no lost writes | Read-modify-replace on Docs, no version check | **Fail** (finding 1) |
| Append-only audit trail | Task activity history exists; Docs edit history is coarse, not a verifiable event log | **Partial fail** |
| Idempotent writes | No confirmed idempotency-key mechanism on writes | **Fail (inferred)** |
| No silent data loss | Direct consequence of concurrency fail | **Fail** |
| Wiki links between records | Dependencies/relationships exist but are task-to-task, not free-form cross-entity links | **Partial** |
| Machine API + human UI | Both exist and are genuinely good | **Pass** |
| Clean MCP exposure | Community MCP servers exist, but they expose the same flaky underlying writes | **Pass (surface) / Fail (substance)** |

## Build-your-own sketch

**Schema (Postgres/Supabase), event-sourced by design — never UPDATE, only INSERT:**

- `builds` (id, name, repo_url, created_at)
- `work_packages` (id, build_id FK, title, git_link, created_at) — identity table only
- `work_package_events` (id, work_package_id FK, event_type [status_change|note|blocked|resumed], payload jsonb, actor_agent, idempotency_key UNIQUE, created_at) — append-only; "current status" is a view: `SELECT DISTINCT ON (work_package_id) * FROM work_package_events ORDER BY work_package_id, created_at DESC`
- `checkpoints` (id, build_id FK, work_package_id FK nullable, commit_sha, session_log_path, summary, created_at) — links straight back to git
- `qa_verdicts` (id, work_package_id FK, reviewer_agent, verdict [pass|fail|partial], evidence_links jsonb, same_model_review boolean, created_at)
- `decisions` (id, build_id FK, decision, rationale, decided_by, superseded_by FK nullable, created_at) — supersede, never edit
- `links` (from_type, from_id, to_type, to_id, link_type) — the wiki-link join table, queryable both directions

Why event-sourced: this structurally eliminates the ClickUp lost-write problem. Nobody overwrites a row; every write is a new event with a unique `idempotency_key`, so a retried agent call is a no-op (`ON CONFLICT (idempotency_key) DO NOTHING`), not a duplicate or a clobber.

**Machine API:** Supabase's built-in PostgREST layer — zero extra build, comes free with the Postgres instance.

**MCP layer:** thin, bespoke, function-scoped — NOT raw SQL. Expose 6-8 named tools (`record_status_change`, `record_checkpoint`, `record_qa_verdict`, `record_decision`, `query_open_work_packages`, `query_build_health`) implemented as Postgres `SECURITY DEFINER` functions or a small Node/Python MCP server, running under a Postgres role with grants only on those functions — no direct table INSERT/UPDATE/DELETE, and the event tables have no UPDATE/DELETE grants for any role, including the agent's. This is the one place worth writing custom code rather than pulling an off-the-shelf generic Postgres MCP server (crystaldba/postgres-mcp, googleapis/mcp-toolbox) — those are excellent for ad-hoc query/debug access but too permissive to hand an autonomous agent as its only interface.

**Docs/prose:** stays in the existing git wiki exactly as it works today — no migration needed. `checkpoints.session_log_path` links the two systems.

**UI:** Supabase Studio out of the box for admin/debug views; if a friendlier human dashboard is wanted later, Directus or NocoDB can wrap the same Postgres instance without touching the schema ([Directus](https://github.com/directus/directus), [NocoDB comparison](https://www.nocobase.com/en/blog/6-no-code-tools-supporting-postgresql)).

**Effort estimate: 4-6 focused days (call it one week with buffer), given solo-founder + AI-agent codegen leverage:**

| Task | Days |
|---|---|
| Schema + migrations in Supabase | 0.5 |
| RLS policies + agent vs human roles | 0.5 |
| Idempotency-key + event-sourced write pattern, tested | 1.0 |
| Thin bespoke MCP server (6-8 tools) | 1.0-1.5 |
| Git-link wiring (session_log_path, commit_sha fields) | 0.5 |
| UI pass (Supabase Studio config, optional NocoDB view) | 0.5-1.0 |
| Concurrent-write test with real agents (Claude/Codex/Fable writing simultaneously) | 0.5 |

**Top 3 risks:**

1. **Scope creep into a full PM tool.** The temptation is to keep adding kanban boards, notifications, a mobile view — turning a record system into a second ClickUp. Mitigate by writing down explicitly: this system's only job is "agents and Larry can trust what it says happened," not "replace ClickUp's UX."
2. **Concurrency bugs reintroduced in a shinier package.** If the schema isn't genuinely append-only (i.e., someone adds a convenient `UPDATE work_packages SET status = ...`), you've rebuilt ClickUp's exact failure mode with extra steps. Mitigate structurally: revoke UPDATE/DELETE grants on event tables at the database level so it's impossible, not just discouraged.
3. **MCP tool-surface security.** Handing agents DB write access is a bigger blast radius than a task-level REST API — a bad tool call could corrupt or wipe the record if raw SQL is exposed. Mitigate by exposing only named functions via MCP, never raw SQL, matching the same discipline Vex would apply to any credential-bearing integration.

## Buy vs. assemble vs. build recommendation

**Buy ClickUp-as-is: reject.** It already demonstrably fails the concurrency/no-silent-loss requirement that is the actual pain point; an MCP wrapper around it inherits the same flaw (finding 3).

**Buy an alternative PM tool (Linear, Notion 3.6 External Agents API): not recommended as the system of record.** Linear's API/MCP is more agent-tuned than ClickUp's per independent comparisons ([Composio Linear toolkit](https://composio.dev/toolkits/linear); [eesel AI comparison](https://www.eesel.ai/blog/linear-vs-clickup)), but Notion's own newly-launched External Agents API (May-July 2026) shows the identical read-modify-replace risk (finding 1) — same category of tool, same architectural ceiling. These remain fine as a **human-facing view fed from the real record**, never as the record itself.

**Assemble (Supabase + PostgREST + a thin bespoke MCP function layer + off-the-shelf UI): recommended.** This gets the durability properties ClickUp lacks in roughly a week, using components that already exist and are maintained by others (Supabase, PostgREST, Directus/NocoDB), while reserving custom-build effort for the one place it actually matters — the MCP write-surface, which needs to be narrow and function-scoped rather than a generic SQL door.

**Build fully bespoke (a Letta/Mem0/Zep-style memory framework): not warranted at this scale.** Those products solve semantic recall under ambiguity for conversational agents; the actual requirement here — structured records, append-only, queryable, git-linked — is a textbook relational-database job, not a memory-architecture job.

**Final call:** Assemble, with the MCP write layer as the one deliberately hand-built component. Keep the git wiki exactly as-is for prose. If ClickUp is kept at all, demote it to a disposable, resyncable human-glance view populated *from* Postgres, never written to directly by agents.

## Methodology

Searched (July 2026): MCP knowledge-base/shared-state patterns, Supabase MCP + Postgres agent memory, ClickUp API rate limits/concurrency, git-as-database/append-only audit patterns, agent-memory products (Letta/Mem0/Zep/LangMem), PostgREST idempotency/concurrency, open-source admin UIs for Postgres (Directus/NocoDB/Retool), Linear vs ClickUp for AI agents, generic Postgres MCP servers, Notion API concurrency behavior. Prioritized official docs (ClickUp, PostgREST, Supabase, Notion) and primary GitHub repos over secondary blog commentary; cross-checked the ClickUp concurrency claim against an architecturally identical, independently documented Notion behavior rather than relying on a single vendor-specific source.

## Limitations

- The claim that ClickUp specifically lacks idempotency keys on write retries is **inferred**, not confirmed against ClickUp's own API reference for that exact mechanism — flagged above as unverified, worth a 10-minute API-docs check before treating as fact.
- Effort estimate is a planning estimate from patterns and component maturity, not from having built this exact system — expect ±2 days depending on how much UI polish is wanted.
- Did not evaluate GitHub Issues/Projects as a fourth "buy" option; worth a follow-up pass if Larry wants it considered given the repo is already the code system of record.

## Recommendations / next questions

1. Before building, spend 10 minutes confirming ClickUp's actual idempotency behavior via its official API reference to convert finding 1's inferred sub-claim to verified.
2. Decide the MCP tool surface (the 6-8 function names) with Vex before writing code — this is the security-relevant design decision, not the schema.
3. Worth a short follow-up: should GitHub Issues/Projects (already adjacent to the code repo) be evaluated as a fourth option, given the team already treats git as durable truth?
