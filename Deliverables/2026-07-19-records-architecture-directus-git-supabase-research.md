---
title: "Records Architecture Research — git + Supabase/Postgres + Directus for the myPKA agent pipeline"
author: Pax (Senior Researcher)
date: 2026-07-19
type: research-brief
decision: "Should myPKA move its multi-agent build/review record + wire OFF ClickUp onto git (signed verdicts) + Supabase/Postgres (event wire) + Directus (dashboard)?"
audience: Warwick (final gate), Larry (orchestrator), Silas (DB), Mack (integrations)
confidence_legend: "High = ≥2 independent primary sources; Medium = 1 primary + secondary; Low = single/contested"
---

# Records Architecture: git + Supabase/Postgres + Directus vs ClickUp

## Executive summary

The proposed three-layer split is **structurally sound and matches known prior art** — it is essentially event-sourcing (Postgres as the append-only source of truth) plus supply-chain provenance (signed, frozen records) plus a BI/admin read layer. The core instinct — retire ClickUp as the *wire* and the *record* — is correct: ClickUp comment threads are a fragile, non-queryable, non-signable substrate for machine-to-machine coordination.

Two important corrections to the plan: **(1) Postgres, not git, must be the authoritative store for the merge gate and live state; git holds the frozen provenance copy, not the queryable truth.** (2) **Directus is a reasonable but not obviously-best fit** — it wants to own its own permission layer and does not cleanly defer to Supabase Auth + RLS, so on a shared Supabase Postgres it creates a *second* auth/permission system rather than reusing yours. For a read-only "define exactly what I see at each stage" dashboard, **Metabase is the lower-friction choice**; Directus wins only if you want write-back human control surfaces (approve/reject buttons) editing the same tables. Grafana is wrong for this (it is time-series/observability, not record-detail BI).

Overall recommendation: **adopt the git + Postgres split; make Postgres authoritative; start the dashboard on Supabase Studio + Metabase; only bring in Directus/Budibase if and when you need a write-back control surface.** Confidence: **High** on the git+Postgres architecture, **Medium** on the specific dashboard-tool choice (depends on whether you need write-back).

---

## Q1 — Directus: hosting, licensing, connection, auth, dashboards

### Licensing (this is the sharpest gotcha) — Confidence: High
- Directus relicensed with **v12 (2026)** from BSL 1.1 to the **Monospace Sustainable Core License (MSCL)**, a source-available license derived from the **Fair Core License (FCL)**. [directus.com/resources/directus-v12-license-change] [directus.io/blog/changing-our-license-one-year-later]
- **Free and permissive** for organisations **under $5M annual revenue AND under 50 employees** ("Innovation Grant"). Above that you must contact sales / pay. [directus.com/pricing/self-hosted] [mobian.studio/directus-cms-license]
- Each version **converts to GPLv3 after 4 years** (the reason they left BSL, which would have gone GPL after 3). [Directus relicensing FAQ; corroborated by mobian.studio]
- **Flag (Medium/contested):** one secondary source (oreateai) reads the threshold as *revenue + funding combined* ("$3M revenue + $8M raised already owes"). Directus's own text frames it as revenue **and** employee count. **For myPKA this is moot today** (well under both), but if Fusion 247 ever raises funding, re-check the exact grant text before relying on "free". [oreateai.com blog vs directus.com pricing]
- Directus Cloud starts around **$99/mo** (hosting convenience); self-host is free under the grant. [mobian.studio; efficient.app]

### Connecting to an EXISTING Postgres/Supabase DB — Confidence: High, with a caveat
- Directus is **database-first**: it introspects an existing schema at runtime via `@directus/schema`'s SchemaInspector and auto-generates the API/admin over your tables. It **can install on top of an existing database**, adding its own `directus_*` system tables. [directus.com/features/existing-database] [deepwiki.com/directus/directus] [npmjs @directus/schema]
- **Caveat (Medium):** Directus historically works against the **`public` schema** and has weak/awkward support for non-default Postgres schemas (`DB_SEARCH_PATH` workarounds, long-standing open issues #3164/#3228). If your Supabase project isolates the agent records in a **separate schema**, expect friction. [GitHub directus/directus discussions #3164, issue #3228]
- It introspects cleanly but it **writes system tables into your DB** — it does *want to own* a slice of it. Not a passive reader.

### Auth / permissions vs Supabase Auth + RLS — Confidence: High (this is the decisive Directus caveat)
- Directus has its **own application-layer roles/permissions** (field- and operation-level), enforced in the Directus API — **not** in Postgres. [socialanimal.dev; leanware.co]
- Supabase's model is **Postgres-native RLS + Postgres roles + Supabase Auth (JWT)**, enforced *in the database*. [supabase.com/docs RLS; Postgres Roles]
- **They do not automatically reconcile.** Running Directus on a shared Supabase Postgres gives you the DB, "no unified auth, no unified permissions, no unified file storage." Each system uses its own connection role and enforces its own rules independently. [github.com directus/directus discussion #17444; supabase.com/partners/integrations/directus]
- **Implication for a multi-trust-level agent system:** Directus **duplicates** rather than defers. If your security boundary (which agent can write which record) lives in Postgres RLS, Directus bypasses it via its service connection and re-implements permissions in its own layer. That is *two* places to get authorization wrong. **This is the strongest single argument against Directus** for a system where RLS is your trust boundary.

### Realtime + dashboards — Confidence: High
- Directus has **WebSocket + GraphQL subscriptions** for live create/update/delete on collections, and all data persists in your DB. Good enough to drive a live board. [directus.io/toolkit/realtime; docs/guides/realtime/subscriptions]
- **Insights** is Directus's built-in dashboard/panel builder — decent for "define exactly what I see at each stage" boards, and it can host **write-back forms** (its real differentiator vs pure-BI tools). [directus.io features]
- Read-only dashboards: fine but not best-in-class vs Metabase. Write-back control surface (approve/reject/override buttons that mutate the same tables): **this is where Directus genuinely beats Metabase/Grafana.**

### Alternatives (see table in Q4)
Metabase (read BI), Grafana (time-series/ops — wrong shape here), Retool/Appsmith/Budibase (write-back internal tools), Supabase Studio (already there, free).

---

## Q2 — Git as a signed-record store — Confidence: High

**The pattern you describe is real, named, and increasingly standard — it is software-supply-chain provenance.**

- **Signed, frozen, one-record-per-file, hash-chained** is exactly how the supply-chain security world records "who did what, when": **in-toto attestations** (signed statement = subject + predicate + type), **Sigstore/cosign** signing, **SLSA provenance**, and git's own **signed commits/tags**. in-toto is a **CNCF graduated** project (2023) alongside Sigstore and TUF — this is mature, not fringe. [slsa.dev; sbomify.com in-toto; cncf via infoq.com/news/2025/08/provenance]
- Git gives you: **immutable-once-signed** records (GitHub immutable releases lock a tag to a commit SHA and generate a verifiable release attestation), append-only transparency logs (Sigstore's Rekor), free diff/provenance/offline/human-review. [docs.github.com immutable releases; kenmuse.com gitsign; devsecopsschool.com signed commits]
- **Hard limits (all corroborated):** git is bad at **concurrent writers** (merge conflicts, no row locking), **high-frequency event streams**, and **querying** ("show me all FAIL verdicts on files touched in the last hour" is a full-repo grovel, not a SELECT). These are precisely the things a relational store is good at. [event-sourcing literature; general consensus]

**Verdict on "frozen signed verdict in git + queryable event row in Postgres pointing at it":** this is a **sound, known pattern, not an anti-pattern.** It is the standard "**artifact + index**" shape: the heavy immutable artifact lives in content-addressable/provenance storage; the database holds a **queryable row with a pointer (path + content hash)** to it. Event-sourcing systems explicitly "use an indexing layer for performant forensic queries" over an immutable log. [github quintans/eventsourcing; thecodeforge.io event-sourcing; ZitPit/artifact-policy prior art in arxiv 2604.06241 which records "verdict, evidence pointer, provenance result" as a row]

**One design rule to make it safe:** the Postgres row must store the **content hash / signature identifier** of the git record it points at, and the git record must embed the **event id + exact reviewed commit SHA**. That two-way binding is what stops the index and the artifact from silently drifting.

---

## Q3 — Supabase/Postgres as the agent wire — Confidence: High

### LISTEN/NOTIFY vs Supabase Realtime vs a real queue — Confidence: High
- **Do not build the baton on raw LISTEN/NOTIFY at scale.** NOTIFY is not persisted (a disconnected agent misses events), payloads cap at ~8KB, and **every committing NOTIFY takes a global lock that serialises commits** — explicitly called out as wrong for many concurrent writers. [nerdleveltech.com; pedroalonso.net; sequinstream.com]
- **Supabase Realtime (broadcast) alone is also wrong for hand-off**, because *multiple workers can pick up the same event* → double-execution (e.g., two agents both act on one verdict). [supabase.com/docs/guides/queues; sequinstream.com]
- **The production-safe 2026 pattern:** a **`jobs`/`events` table drained with `SELECT ... FOR UPDATE SKIP LOCKED`**, using `NOTIFY` only to *wake* idle workers — or the off-the-shelf **`pgmq`** extension (Supabase Queues), which gives durable, exactly-once-within-visibility-window delivery. [nerdleveltech.com; supabase.com/blog/supabase-queues]
- **Recommendation:** append-only `events` table = the durable record; **Supabase Queues (pgmq)** or SKIP LOCKED = the reliable hand-off; **Realtime = the dashboard's live feed only** (read-side push to the UI, where duplicate delivery is harmless).

### Concurrency / idempotency — Confidence: High
- Append-only events table with a **natural unique key** (e.g., `unique(agent, event_type, reviewed_sha)` or a client-supplied `idempotency_key`) makes duplicate writes a no-op via `ON CONFLICT DO NOTHING`. This is the standard event-store idempotency guard. [thecodeforge.io; postgresql-event-sourcing reference impl]

### RLS for multi-agent + human writers — Confidence: Medium-High
- Give **each agent its own Postgres role / JWT claim** (Larry, Codex, Fable, Tower, human-reviewer, Warwick-gate). RLS policies then enforce *who may append what* and *who may only read* — e.g., only Warwick's role can flip a `merge_gate` row to `approved`; agents can append verdicts but never mutate a frozen one. [supabase.com RLS + roles docs]
- **Keep sensitive payloads out of the public git mirror by construction:** they live only in Postgres rows protected by RLS and are **never serialised into a git artifact.** Only the *public, signable* records (verdicts, decisions) get frozen to the public repo. This cleanly honours your hard rule (personal/household data → private Supabase only, never git).

### Does a relational schema structurally prevent the "verdict not bound to the code head it reviewed" bug? — Confidence: High (partial yes)
- **Yes for the *binding*, not automatically for the *correctness*.** A `verdict` row with a **`NOT NULL` foreign-key-style column `reviewed_commit_sha`** (ideally a FK into a `commits`/`checkpoints` table) makes it **impossible to record a verdict that isn't tied to an exact head.** A `CHECK`/unique constraint can further forbid two live verdicts for the same (agent, sha). This structurally kills the *class* of "floating verdict" bug that ClickUp comments allow (a comment has no typed link to a SHA at all).
- **Caveat:** the DB guarantees the *link exists and is well-formed*; it cannot guarantee the agent *computed* the SHA correctly. That still needs the agent to read HEAD atomically at review time. So: schema prevents **unbound** verdicts; disciplined capture prevents **mis-bound** ones. The relational move is a large, real reduction of this bug class — the single strongest technical reason to leave ClickUp. [general RDBMS integrity + your own state-correlation failure history]

---

## Q4 — The overall three-layer architecture — Confidence: High

**Validated, with one authority correction.**

| Layer | Proposed role | Verdict |
|---|---|---|
| **git** | versioned artifacts + frozen, signed verdict/decision records (provenance) | **Correct.** Matches in-toto/SLSA/immutable-releases prior art. But **not authoritative for live state or the merge gate.** |
| **Supabase/Postgres** | append-only event stream + live mutable state, concurrent multi-agent writes | **Correct AND should be the system of record / authority.** This is the event-sourcing source of truth. |
| **Directus on same Postgres** | read/dashboard + optional human control surface | **Directionally fine, but reconsider the tool** (see auth caveat, Q1). |

**The one correction that matters:** decide **which store is authoritative for the merge gate** and make it **Postgres**. Git is the *provenance mirror* — the frozen, signed, human-auditable copy — but the live "is this allowed to merge?" state must be a Postgres row (queryable, RLS-guarded, constraint-checked). Then a **post-decision job freezes the immutable copy to git and writes the hash back into the row.** If you let *both* git and Postgres be "the truth", you get **SSOT drift** — the classic anti-pattern where the dashboard, the wire, and the record disagree. **One authoritative store (Postgres) → derived frozen copy (git) → derived read view (dashboard).** One direction of flow.

**Prior art for "git + relational event store + BI layer" in agent/CI systems** exists but is *emergent* rather than a single named product — it's assembled from event-sourcing (Postgres event store + projections), supply-chain provenance (git-signed attestations), and BI-on-Postgres. Confidence that each *piece* is proven: High. Confidence that this *exact trio* is a widely-documented turnkey pattern: **Medium** — you are composing best-practice parts, not copying one blueprint. That's fine, but it means you own the integration design (Silas + Mack).

**Anti-patterns to avoid explicitly:**
1. **Double-writing** the same fact to git and Postgres as two independent truths → drift. (Postgres authoritative, git derived.)
2. **Two authorization systems** (Postgres RLS *and* Directus permissions) both nominally guarding the same tables → security holes at the seam. Pick one enforcement layer; if Directus, treat RLS as belt-and-braces, not primary.
3. **Realtime broadcast as a work queue** → double-execution.
4. **git as the event stream** → concurrency/merge hell.
5. **ClickUp-style untyped links** (a comment that mentions a SHA in prose) → the state-correlation bug you're trying to kill.

**Dashboard-tool recommendation for THIS use case:**

| Tool | License/cost | Read dashboards | Write-back control surface | Auth fit w/ Supabase | Best when |
|---|---|---|---|---|---|
| **Supabase Studio** | free, already there | basic (SQL + table views) | table editor only | native (it *is* Supabase) | Day-1, zero new infra |
| **Metabase** | OSS free / $100+mo cloud | **excellent** no-code BI on Postgres | no (read BI) | separate login, reads via role | **best for "define what I see at each stage" read boards** |
| **Directus** | MSCL free <$5M/<50 staff | good (Insights) | **yes (forms)** | **duplicates** RLS/auth | you need human approve/reject editing the same tables |
| **Budibase** | OSS free | good | **yes, low-code, approval flows built-in** | separate | write-back + approval routing without JS |
| **Appsmith** | OSS free | good | yes (JS-heavy) | separate | devs comfortable in JS, custom internal tools |
| **Retool** | freemium, paid scales | good | **most mature workflows** | separate | budget for polish; fastest to a rich control panel |
| **Grafana** | OSS free | time-series/ops only | no | separate | **wrong shape** — observability, not record detail |

Sources: [modern-datatools.com; budibase.com/blog alternatives; openhelm.ai; grafana vs metabase (houseoffoss, sumboard); directus.io features]

**Bottom line on Directus:** it is a *fine* choice **if and only if** your near-term need includes a **human write-back control surface** on the same Postgres. If the immediate need is "log everything and let me *see* it per stage" (read-only), **Metabase gives you that faster with no second auth system**, and you avoid Directus writing `directus_*` tables into your Supabase DB and duplicating RLS. Confidence: **Medium** (depends on the write-back requirement, which only Warwick can settle).

---

## Q5 — Migration shape — Confidence: Medium-High

Phased, most-value-least-risk first. Each phase is independently useful, so you can stop between any two.

1. **Phase 0 — Schema + event table (highest value, lowest risk).** Silas designs the append-only `events` + `checkpoints` + `verdicts` tables in the **existing private Supabase**, with `reviewed_commit_sha` as a required typed key. **This alone kills the "evaporating verdict" and "unbound verdict" problems** — the two most painful failures — before any tool changes. Agents dual-log (ClickUp *and* Postgres) during this phase so nothing is lost.
2. **Phase 1 — Postgres becomes the wire.** Replace ClickUp comment-polling with **Supabase Queues (pgmq) / SKIP LOCKED** hand-off; Tower watches the events table instead of ClickUp. Realtime pushes to a first dashboard. ClickUp goes read-only-mirror.
3. **Phase 2 — Frozen provenance to git.** Add the post-decision job that signs + freezes each final verdict/decision to the **public** repo (one file per record, hash written back to the row). Non-sensitive only, by construction.
4. **Phase 3 — Dashboard.** Stand up **Metabase** (read) on the Supabase Postgres and design the per-stage boards ("define exactly what I see at each stage"). Add **Directus/Budibase later** *only* if a write-back control surface is wanted.
5. **Phase 4 — Retire ClickUp as the wire/record.** Keep it (if at all) only for the thing it's actually good at (below).

**What is genuinely lost by retiring ClickUp — Confidence: Medium.** ClickUp currently doubles as **lightweight human project/backlog management** (task list, statuses, mobile app, notifications, human-friendly comment UX, the Larry session-log human mirror). The new stack is a *records/wire* system, not a *human task tracker* out of the box. Honest gaps to plan for:
- **Human backlog/kanban UX + mobile.** A Metabase board is not a task manager. Either keep a thin ClickUp (or Todoist, which is already wired) purely for human backlog, or build a Budibase/Directus board to replace it — extra work.
- **Notifications** (the Telegram-ping desire in memory) must be re-implemented off Postgres events rather than ClickUp automations.
- **Zero-infra convenience.** ClickUp is hosted; this stack is yours to run and back up (Supabase handles DB; you own Directus/Metabase if self-hosted).
- **The human-readable session-log mirror** (AGENTS.md requires a ClickUp child page). If ClickUp goes, that canonical requirement needs re-homing to the dashboard — a governance change, so **flag to Warwick**, don't do it silently.

Recommendation: **don't force ClickUp fully out.** Retire it as the *machine wire and record of truth* (its worst job), and let it — or Todoist — keep doing *human backlog/notifications* until the dashboard demonstrably replaces that. Splitting "machine record" from "human task UX" is the real win, not deleting a tool.

---

## Methodology
Searched (broad → narrow): Directus licensing/pricing, existing-DB introspection, permissions-vs-RLS, realtime, dashboard-tool comparisons; git-signed-record/provenance prior art (in-toto, Sigstore, SLSA, immutable releases); Postgres LISTEN/NOTIFY vs Supabase Realtime vs Queues; event-sourcing artifact+index patterns; Appsmith/Budibase/Retool write-back tooling. Prioritised primary/official sources (Directus docs, Supabase docs, CNCF/SLSA, GitHub issues) and triangulated each load-bearing claim against ≥1 independent secondary source. Every claim tagged with confidence.

## Limitations
- **Directus threshold nuance (revenue vs revenue+funding)** is contested across secondary sources — moot for myPKA now, re-verify against the current Innovation Grant text if Fusion 247 raises funding. (Low/contested.)
- Directus v12/MSCL **exact launch date** is fuzzy in sources (May 2026 vs "v12 2026") — the license *terms* are solid; the date is not load-bearing.
- I did **not** hands-on test Directus against a live Supabase separate-schema setup; the non-`public`-schema friction is from GitHub issues, not a repro. (Medium.)
- "git + relational event store + BI" as one turnkey named pattern is **not** a single documented blueprint — each component is proven; the composition is yours to own. (Medium.)
- No cost modelling of self-hosting ops burden (backups, uptime) was done — flagged as a real Phase-4 consideration, not quantified.

## Recommendation (one paragraph)
Proceed with the split, with two edits: **make Postgres the single authoritative store** (git = derived frozen provenance mirror, dashboard = derived read view; one direction of flow), and **start the dashboard on Supabase Studio + Metabase rather than committing to Directus**, because Directus duplicates rather than defers to your Supabase Auth/RLS trust boundary and writes its own tables into your DB. Bring in Directus (or Budibase) only when a genuine human write-back control surface is needed. Sequence: schema + typed `reviewed_commit_sha` first (kills the evaporating/unbound-verdict bugs immediately), then the Postgres wire (pgmq/SKIP LOCKED), then git-freeze of signed records, then dashboards — dual-logging with ClickUp until each phase proves out, and keeping a thin human backlog tool (ClickUp or the already-wired Todoist) rather than deleting ClickUp outright.

## Sources
- Directus licensing/pricing: [directus.com/resources/directus-v12-license-change], [directus.io/blog/changing-our-license-one-year-later], [directus.com/pricing/self-hosted], [mobian.studio/directus-cms-license], [oreateai.com Directus licensing blog], [efficient.app/apps/directus]
- Directus existing-DB / introspection: [directus.com/features/existing-database], [deepwiki.com/directus/directus 3.2], [npmjs.com/package/@directus/schema], [GitHub directus/directus #3164, #3228]
- Directus auth vs Supabase RLS: [github.com directus/directus discussion #17444], [supabase.com/partners/integrations/directus], [socialanimal.dev directus-vs-supabase-2026], [leanware.co supabase-vs-directus], [supabase.com/docs RLS + Postgres Roles]
- Directus realtime/Insights: [directus.io/toolkit/realtime], [directus.io/docs/guides/realtime/subscriptions]
- git signed records / provenance: [slsa.dev/blog in-toto-and-slsa], [sbomify.com what-is-in-toto], [docs.github.com immutable-releases], [kenmuse.com gitsign], [devsecopsschool.com signed-commits], [infoq.com/news/2025/08/provenance]
- Postgres wire / LISTEN-NOTIFY / Queues: [nerdleveltech.com postgres-listen-notify-job-queue], [pedroalonso.net postgres-listen-notify], [blog.sequinstream.com all-the-ways-to-react], [supabase.com/docs/guides/queues], [supabase.com/blog/supabase-queues]
- event sourcing / artifact+index: [github.com quintans/eventsourcing], [github.com eugene-khyst/postgresql-event-sourcing], [thecodeforge.io event-sourcing-databases], [arxiv.org/pdf/2604.06241 ZitPit artifact-policy verdict rows]
- Dashboard/write-back tools: [modern-datatools.com retool-vs-appsmith-vs-budibase], [budibase.com/blog/alternatives], [openhelm.ai retool-vs-budibase-vs-appsmith], [houseoffoss.com grafana-vs-metabase], [sumboard.io grafana-vs-metabase], [queryplane.com best-internal-tool-builder-for-postgresql]
