# AsdAIr — Role/Boundary Assessment (SOP-001 pre-approval, ASSESSMENT ONLY)

- **Date:** 2026-07-27
- **Author:** Nolan (Talent Acquisition)
- **Commissioned by:** Larry, authorised by Warwick (IDEA-017, Experiment 1 design)
- **Status:** **ASSESSMENT ONLY. Nothing created, bound, or activated.** No file written under `Team/`, no shim under `.claude/agents/`, no row added to `Team/agent-index.md`, no git command run, no other worktree touched. SOP-001 §8 (`Team Knowledge/SOPs/SOP-001-how-to-add-a-new-specialist.md:127-129`) is Warwick's gate and it stays his.
- **SOP-001 step 2 (Pax research):** NOT run. This is a feasibility assessment of an existing capability, not a hire workup. If Warwick converts this to a hire, Pax's research pass is still mandatory (`Team/Nolan - HR/AGENTS.md:16`, `:57`).
- **Personal-data handling:** this document describes **capability and structure only**. No household, shopping, product, or personal data is quoted or reproduced anywhere in it, including from files that legitimately contain it.

---

## 0. Verdict in one paragraph

**Yes — but only half of AsdAIr is ready, and it is not the half you would guess.** The *planning* half has genuine durable function: a pure deterministic planner, a read-only adapter, a live Postgres rulebook, a documented ten-rule standing policy, and a learning loop with a schema home. That half can become an independently spawnable specialist today with a contract, a shim, and an index row — no new architecture. The *execution* half (Telegram intake → OCR → live browser drive → write-back) has **almost no durable function at all**: its entrypoint exists only in disposable per-session scratchpads and has been re-created from scratch at least twice; its operating method lives in a single machine-local Claude memory file outside the repo; and the loop is open — last night's shop was never written back to the database, so next week's instance will be strictly worse-informed than this week's was. The durable-function hypothesis is therefore **confirmed where the files exist and falsified where they do not**, which is exactly the useful result. My recommendation: hire the steward, keep the browser drive with Larry for Experiment 1, and write **one SOP** — and if Warwick only does one of those three things, make it the SOP, not the shim.

---

## 1. What durable AsdAIr capability actually exists today

### 1.1 EXISTS — committed, tested, CI-gated

| Artefact | Path | What it actually is |
|---|---|---|
| Pure planner | `services/asdair/skill/planner.js` | `planBasket({listItems, rules, products, budget}) -> {items, summary}`. No DB, no network, no fs, no clock, no randomness (`services/asdair/skill/README.md:20-24`). Same inputs → same output. |
| Read-only adapter | `services/asdair/skill/data.js` | SELECT-only, every query inside `BEGIN TRANSACTION READ ONLY` (`README.md:25-30`). |
| CLI | `services/asdair/skill/cli.js` | `node cli.js --list-date <d> --household <h>` (`README.md:103-118`). |
| List normaliser | `services/asdair/skill/listNormaliser.js` | Raw text → `{items, needs_review}`. Reused by the hub (`services/hub/shopper/shopperRoute.mjs:12`). |
| Schema | `services/asdair/db/001_asdair_schema.sql` | 13 tables incl. `households`, `rules`, `rule_qa_log`, `products`, `shopping_lists`, `shopping_list_items`, `product_alternatives`, `orders`, `order_events`, `process_suggestions` (`:20-321`). |
| Standing policy | `services/asdair/skill/README.md:72-87` | The ten rules, written down: counts not pack sizes; nothing added unless on the list; **never auto-substitute**; flag-not-block on budget band; **never checks out**; one-week exclusions never promoted. |
| Rule model | `README.md:89-101`, schema `:103-146` | Structured `directive` (`info`/`exclude`/`needs_decision`/`map`) + `match_term`/`match_category`. Free-text rows are informational only. CHECK constraint forbids a target-less actionable directive (`:145`). |
| Learning loop (schema) | schema `:153-163` | `rule_qa_log` with `applies_going_forward` + `promoted_rule_id` back-link to `rules`. |
| Tests | `services/asdair/skill/*.test.js`, `test/*.dbtest.js` | Synthetic fixtures only (`README.md:150-159`). |
| CI | `.github/workflows/asdair-tests.yml` | Two jobs: no-DB unit + throwaway-Postgres integration gated behind `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`. |
| Write seam (governed) | `services/control-plane/wp-d-proof/seed/asdair_005_cockpit_command.sql`, `asdairCommands.mjs`, `asdair-worker.mjs` | Intent queue + trusted executor. Allowlist = `add_regular_to_next_week`, `add_list_item` (`asdairCommands.mjs:13`). Insert-guard trigger, immutable core, forward-only transitions, `FOR UPDATE SKIP LOCKED`, per-household `pg_advisory_xact_lock`, unique `idempotency_key`, immutable receipts. |
| Cockpit projector | `services/control-plane/cockpit/project-shopping.mjs` | Read-only projection of `asdair.*` into `cockpit.attention_item` / `output_item`. |
| Data doctrine | `.gitignore:105-114`, schema `:113-119`, `README.md:137-148` | Seed and all real rows are gitignored; the migration ships columns, never rows. |

**This is a well-built, well-defended core.** The guardrails are not aspirational — they are enforced at three layers (DB grant, trigger, code assertion).

### 1.2 EXISTS BUT NOT DURABLE — the gap

| Function | Where it actually lives | Problem |
|---|---|---|
| **Telegram intake** | `…/Temp/claude/C--Fusion247PKA/<session-uuid>/scratchpad/shopper-recv.mjs` — found under **two different session UUIDs** | The entrypoint is **disposable and has been re-created at least twice**. Not in the repo. Not versioned. |
| **OCR** | Larry's vision, in-context (memory `asdair-idea012-runtime.md:20`) | Not a file. Not a script. Cannot be handed to anything. |
| **Browser add method** | `…/memory/asdair-idea012-runtime.md:32` — one paragraph | The single most valuable operational artefact AsdAIr has, and it is machine-local, unversioned, unreviewable, outside the repo. |
| **`asdair.regulars`** (live, ~91 rows) | No committed migration exists. Referenced by `services/control-plane/db/mypka/040_cockpit_grants.sql:36`, `:45`; `asdairCommands.mjs:61`; recreated ad-hoc inside `db/mypka/test/apply-teardown.test.mjs:30` | **A load-bearing live table with no schema file in the repo.** Its shape is inferable only from test stubs. |
| **`asdair.command_request`** | `services/control-plane/wp-d-proof/seed/asdair_005_cockpit_command.sql` | Real migration filed under `wp-d-proof/seed/` in a *different service*, not `services/asdair/db/`. |
| **`status='next_week_draft'`** | `asdairCommands.mjs:38`, `:41`, `:45`, `:48` | Committed schema documents `pending \| processed \| archived` (`001_asdair_schema.sql:228`). Column is unconstrained text, so no failure — but the documented contract is stale. |
| **Shopper intake route** | `services/hub/shopper/shopperRoute.mjs` | **Zero callers.** A full-repo grep finds only the file itself and its test. It is a tested library that nothing invokes. |
| **Write-back of what was actually bought** | Nowhere | Session log's own open thread: "Weekly-order capture into `asdair.shopping_lists` still to build — this week's basket was NOT written to the DB (offered, not done)" (`Team Knowledge/session-logs/2026/07/2026-07-27-19-03_larry_asdair-weekly-shop-browser-automated.md:60`). |

### 1.3 Accuracy flags found while verifying

- **Memory asserts artefacts that are not in the main tree.** `asdair-idea012-runtime.md:26` names `Deliverables/2026-07-21-asdair-{two-way-larry-interaction,fusion-app-expansion,cockpit-directus-watched-inbox}*.md`. Only two `2026-07-21-*` deliverables exist and neither is one of those. They may live in an unvisited worktree (I did not check — out of scope by instruction). **Unverified; do not cite them as existing.**
- **AsdAIr is recorded as PARKED.** `Team Knowledge/fusion-brief/current-state.md:24` — "Parked: AsdAIr / household shopping (personal-data lane)". A live weekly shop ran on 2026-07-27. The brief is stale, or the lane is unparked and unrecorded. Warwick should say which.
- **The cockpit deliberately hides shopping.** `services/cockpit/server.mjs:45` — `and source_module <> 'shopping'  -- AsdAIr parked until mum gets her own linked app`. Consistent with "parked".
- **An open task holds a contradictory disposition.** `Team Knowledge/tasks/open/tsk-2026-07-10-005-asdair-retained-external-recommendation.md:55` recommends the automation layer "stays external, not migrated into myPKA at this stage". Hiring an AsdAIr specialist partially reverses that. The task is still `status: open`, priority 4.

---

## 2. Where the knowledge and state actually live — the crux

Sorted by how well each survives a fresh session.

| Layer | Home | Survives fresh session? |
|---|---|---|
| Standing shopping policy (the ten rules) | `services/asdair/skill/README.md:72-87` | **YES** — repo, versioned, reviewed |
| Rulebook (directives, exclusions, mappings) | Supabase `asdair.rules` | **YES** — durable data, structure in `001_asdair_schema.sql:103-146` |
| Product term → product mapping | Supabase `asdair.products` | **YES** |
| The Regulars catalogue | Supabase `asdair.regulars` | **DATA yes, SCHEMA no** — no committed migration (§1.2) |
| Decision/learning history | Supabase `asdair.rule_qa_log` | **Schema yes — but see below** |
| Planning logic | `planner.js` (pure) | **YES** — determinism *is* the disposability guarantee |
| Governed write path | `asdair.command_request` + worker | **YES** |
| **Browser add method** | machine-local Claude memory only | **CONDITIONALLY** — this machine, this user profile, unversioned |
| **Intake entrypoint** | per-session scratchpad | **NO** — rebuilt from scratch each time |
| **OCR step** | Larry's in-context vision | **NO** |
| **What was actually bought this week** | nowhere | **NO** |
| **This week's learnings** (a rotation choice; an item absent from the Regulars list that the tick-pass silently skips) | session log narrative + memory prose | **NO, not as data** — they are stories, not rows the planner can read |

### The crux, stated plainly

The hypothesis says the function remembers through its files. For AsdAIr the answer splits:

1. **The rulebook remembers.** Genuinely. `rules` + `rule_qa_log` + the promotion back-link is a real learning mechanism with a real home.
2. **The procedure half-remembers.** It is written down — beautifully, in one paragraph — in a file that is not in the repo, not versioned, not reviewable, not portable to another machine, and which already contains at least one unverifiable claim (§1.3). Any specialist contract would have to point *out of the repo, into a user profile path*, to reach it. That is not a durable function; it is a durable note.
3. **The outcome does not remember at all.** The single most important fact — what actually went in the basket, at what quantity, for what price, and what got flagged — was not written back (`…19-03_larry_asdair-weekly-shop…md:60`). Every downstream capability (a self-building next-week list, "previously ordered", rotation tracking, budget trend) depends on that write. **The loop is open at the most valuable point.**

That third item is the finding. Everything else is fixable paperwork; this one is the hypothesis actually failing in production.

---

## 3. Can it cleanly become an independently spawnable specialist?

**Yes for the steward function. No for the live-execution function — and the blocker is mechanical, not philosophical.**

### 3.1 What works

- Two-layer model fits with no strain: `Team/Asdair - Household Shopping Steward/AGENTS.md` (canonical, host-agnostic) + `.claude/agents/asdair.md` (Claude Code shim). No third layer, no `CLAUDE.md` inside `Team/` (`Team/Nolan - HR/AGENTS.md:53`).
- **Claude Code is the only activated host.** `CLAUDE.md` present at root; no `GEMINI.md`, no `.cursor/rules/main.md`, no `.codex/agents/`. One shim only (SOP-001 §5 `:63-69`).
- Slug `asdair` — checked against all 15 files in `.claude/agents/` and all 16 rows of `Team/agent-index.md`. **No collision.** (Minor deviation: `Team/Nolan - HR/AGENTS.md:17` says three-to-five letters; `asdair` is six. `warden`, `charta` already are too. Not a real problem.)
- The role has a genuinely bounded, high-frequency, well-specified job with existing acceptance criteria (the ten rules) — better specified than most hires get.

### 3.2 What blocks the execution half

1. **Tool binding, unverified.** The 2026-07-27 shop used browser tools (`scroll_to`, `read_page`, `find`, `navigate`) from the Claude-for-Chrome connector. `.mcp.json` declares only `supabase` and `obsidiwikai-brain` — the browser connector is **not project-scoped**, so I cannot verify a subagent can reach it at all. Separately, every one of the 15 existing shims specifies a `tools:` allowlist; an allowlist that does not name a tool excludes it. Reaching browser tools would mean either naming them explicitly (names unknown, server unverified) or **omitting `tools:` entirely**, which grants everything — the direct opposite of SOP-001's minimal-tools rule (`:112`). **This is an open mechanical question, not a design preference. Do not assume it works.**
2. **The ASDA session is a singleton physical resource.** One Chrome profile, one logged-in account, one live trolley holding real money. It cannot be worktree-isolated, forked, or made concurrent. Memory `:24` also records that Larry cannot open the extension sidebar and is hard-ruled out of entering the account password.
3. **Warwick has to be there anyway.** Memory `:26` records the explicit descope: "FULLY-HANDS-OFF is DESCOPED — a HUMAN logs into Asda". A subagent that requires a human present for its core step gains little from being a subagent.

### 3.3 The honest scope for Experiment 1

**Asdair = Household Shopping Steward.** Owns: intake normalisation, resolution against the rulebook/Regulars, the basket plan, the needs-decision queue, the reconcile checklist, and the learning write-back. **Does not own the browser drive** — that stays with Larry-in-main-context until the tool-binding question in §3.2 is answered on its own.

This is not a consolation prize. The resolution + rulebook reasoning is the token-heavy, context-polluting, week-after-week part; it is exactly what Warwick wants out of Larry's conversation. **Counter-argument I owe you:** parsing a 90-item accessibility tree is *also* very heavy, so on pure contamination grounds the browser drive is the better thing to sandbox. I still recommend against it for Experiment 1 — not because it's less valuable, but because it compounds two unknowns (the durable-function hypothesis AND the MCP-in-subagent binding) into one experiment that can fail for two reasons and teach you nothing.

---

## 4. The minimum changes required

Warwick said minimal. Here is the honest floor, and where I think the floor is one file too low.

### 4.1 Minimum-viable — 3 artefacts, nothing else

1. `Team/Asdair - Household Shopping Steward/AGENTS.md` — the wiki contract.
2. `.claude/agents/asdair.md` — the Claude Code shim (pointer only, never a copy: SOP-001 `:111`).
3. One row in `Team/agent-index.md`.

Everything they point at already exists. **No new schema, no new service, no new worktree, no new Workstream** (none of WS-001…WS-005 involves household shopping), **no `PKM/My Life/Projects/` entry** (that is `tsk-2026-07-10-005`'s open question, not a prerequisite).

This works — on this machine — because the memory index is injected into subagent context, so an instance can find and `Read` `…/memory/asdair-idea012-runtime.md`. I verified this: I received that index myself in this invocation.

### 4.2 Minimum-honest — 4 artefacts

Add: **`Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md`** (021 is the next free number).

Not new scaffolding. **Relocation.** It moves knowledge that already exists in one machine-local memory blob into the one place the roster mechanism is designed to reach, carrying: intake → OCR → resolve against rulebook/Regulars → the add strategy (Regulars tab, sort A–Z, load-all then bulk-tick, the out-of-stock-poisons-the-batch failure) → **the mandatory line-by-line reconcile** → substitutions off → never book a slot, never check out → the write-back.

Why it earns its place:
- The contract otherwise has to cite a path under `C:/Users/<user>/.claude/…`. A wiki contract that points outside the repo is not portable and is not reviewable.
- The one rule that caught a real failure last night is the **mandatory reconcile** — it caught an item the bulk pass silently skipped (`…19-03…md:46`). That rule currently exists as prose in two narrative documents. It should be a numbered step.
- It is read by every future instance, forever. Roughly thirty minutes once.

### 4.3 What I am NOT proposing, and why

| Tempting | Verdict |
|---|---|
| A `regulars` migration in `services/asdair/db/` | **Needed, but it is Keel/Silas work, not a hiring prerequisite.** Report it; don't block on it. |
| Wiring `shopperRoute.mjs` to a live poller | Same — a Work Order, not a hire. |
| Building the write-back | Same. It is the highest-value build in this whole area (§2) but it is engineering. |
| A new Workstream | No. Nothing multi-agent recurs here yet. |
| An `asdair` MCP server / new service | No. |
| A `PKM/My Life/Projects/` entry | Not now. It also touches an unresolved open task. |

---

## 5. Boundaries

### 5.1 Against each neighbour

| Specialist | Boundary |
|---|---|
| **Penn** (Journal Writer) | Penn owns **Warwick's** personal capture into `PKM/`. Asdair owns **Mum's household shopping operations**. Hard line: **Asdair never writes anywhere under `PKM/`.** Household data is entrusted third-party data; it lives in Supabase `asdair` and nowhere else (`.gitignore:105-114`; standing personal-data doctrine). If Warwick reflects *about* the shop, that reflection is Penn's — the reflection is Warwick's life, the basket is not. |
| **Silas** (Database Architect) | Silas decides schema. Asdair **consumes** `asdair.*` and never designs, migrates, or alters it. A needed schema change is a REPORTED finding routed to Silas/Larry. Note the unresolved Silas scope contradiction already flagged in `Deliverables/2026-07-27-nolan-engineering-hire-recommendation.md` §2.3 — it applies here too and is not Asdair's to settle. |
| **Mack** (Automation Specialist) | Mack owns **the wire**: bot registration, token placement in `C:\.fusion247\.env keys\`, polling-vs-webhook, MCP registration, process supervision. Asdair **consumes an already-established channel** and never provisions a bot, rotates a token, or wires a connector. |
| **Larry** (Orchestrator) | Larry owns orchestration, integration, merge, all live actions, and — for Experiment 1 — the browser drive. Asdair **proposes**; Larry (or Warwick) **acts on the world**. |
| **Keel / engineering faculty** (proposed) | Keel implements Work Orders inside `services/**`. Asdair is a **domain operator, not a builder**. **Asdair must never write under `services/**`.** That single line is also, conveniently, the cleanest available concurrency control (§7). |
| **Pax** | No research. Product research, alternatives sourcing, market comparison → Pax. |
| **Vex** | Asdair never self-certifies anything credential- or exposure-related. |

### 5.2 What Asdair must NEVER own

1. **Checkout, payment, slot booking.** Absolute. Mum's rule, encoded three times already (`README.md:83`, `:167`; schema `:277-292` keeps `checked_out` false by construction).
2. **Substitution decisions.** Out-of-stock or ambiguous → `needs_decision`, alternatives surfaced, **never written into `matched_product`** (`README.md:80`, `:168-170`).
3. **Any credential.** No `.env`, no `C:\.fusion247\**`, no `ASDAIR_DB_URL`, no ASDA account password, no token. `credential_scope: none`.
4. **Schema changes or migrations.**
5. **Service code** under `services/**`.
6. **Any write into `PKM/`, `Team/`, `Team Knowledge/`, `.claude/`, or the repo's public tracked surface where household data could land.**
7. **Direct SQL writes to `asdair.*`.** All writes go through the governed command seam.
8. **Git.** No commit, branch, push, PR, merge, or checkout.
9. **Process lifecycle.** No starting, stopping, or restarting Directus, the worker, or any scheduled task.
10. **Declaring the shop "done".** Only Warwick closes a shop.
11. **Spawning subagents**, or proposing any gate-disabled / `--dangerously-skip-permissions` agent.

---

## 6. Tool permissions for the shim

**Proposed: `tools: Read, Bash, Glob, Grep`** — the same calibration as Arc and Mason (`.claude/agents/arc.md:4`, `mason.md:4`), which are also executor/inspector roles that author nothing.

| Tool | Justification | Honest risk |
|---|---|---|
| `Read` | Contract, SOP-021, `services/asdair/skill/README.md`, the memory runtime file, the staged payload, prior session logs. Non-negotiable. | Broad by nature. Bounded by the credential prohibition, not by the tool list. |
| `Bash` | Load-bearing: `node cli.js` / a driver invoking `planner.js` **is** the deliverable. `node --test` on the skill. Without Bash the role is a chat about shopping. | Widest grant. Not mitigated by removal — mitigated by `credential_scope: none` (nothing in env to reach), the contract prohibitions, and the returned command log. **State this to Warwick plainly; do not dress it up.** |
| `Glob` / `Grep` | Locating the rulebook, the prior week's log, the sibling convention. Read-only. | Low. |

### Deliberately withheld

| Tool | Why |
|---|---|
| **`Write`, `Edit`, `MultiEdit`** | **The strongest safety control available, and it is free.** Asdair's natural output *contains real household data* and this repo is **public**. Withhold authoring and the plan comes back in the response body to Larry, who decides whether anything lands anywhere. ⚠️ **Honest caveat: this is a speed bump, not a control** — a Bash-holding agent can redirect to a file. The real controls are the contract rule, `.gitignore:105-114`, and `scripts/secret-scan.sh`. Say so rather than implying enforcement. |
| **`mcp__supabase__execute_sql`** | ⚠️ **Never grant this.** It is write-capable and the schema holds Mum's real data. There is no read-only SQL MCP tool available as an alternative. |
| `mcp__supabase__list_tables` | Structure-only and harmless, but unnecessary if inputs are staged (below). Omit. |
| `WebFetch` / `WebSearch` | Research is Pax's. Also removes the only trivially-scriptable outbound path from a Bash-holding agent handling personal data. |
| `Task` / subagent dispatch | Boundary #11. |
| Browser tools | Out of scope for Experiment 1 (§3.2), and reachability is unverified. |

### How it reaches the data without a credential

**It doesn't. Larry stages the inputs.** Larry queries the list + rules + products + regulars, writes a payload file to the scratchpad, and hands Asdair the path; Asdair runs the pure planner over it. This is not an invention — it is the **already-proven** live-acceptance path (memory `asdair-idea012-runtime.md:16`: "Live acceptance without a DB secret: query the data via Supabase MCP, write to a scratchpad payload.json, run planner.js through a tiny driver"). It keeps `credential_scope: none` genuinely true, keeps household data off every channel except one local file, and it already works.

### Purchases and consequential external actions

Asdair may **propose** a basket. It may propose a substitution as a *flagged option for a human*. **Warwick remains the approval and payment gate for every consequential external action** — slot booking, checkout, payment, accepting a substitution, and anything that spends money or commits the ASDA account. The contract must state this as an absolute, not a default.

---

## 7. What would collide with a concurrent engineering worker

Current tree state (`git worktree list`): main tree on `idea-016/idea-engine`; `C:/Fusion247PKA-w01` on `idea-017/w01-note-structure-validator` (the engineering lane, untouched by me); a **stale AsdAIr worktree** `C:/Fusion247PKA-idea012` on `idea-012/asdair-wp1` at `b9f32bd`; eight others.

Ranked by damage, not by likelihood.

### 🔴 1. Telegram `getUpdates` offset on the shopper token — SHARPEST. Data-loss class.

`getUpdates` is a **single-consumer, destructive-ack** protocol: advancing the offset permanently discards prior updates. Memory `asdair-idea012-runtime.md:18` states the current safety argument explicitly — *"Nothing else polls it → getUpdates is safe (no 409)"*. **That is an assumption a second concurrent lane breaks by existing.** Two readers → HTTP 409 plus silently consumed updates. The realistic worst case is **Mum's weekly list is permanently lost with no error surfaced to anyone**. There is no lock, no lease, and no single-poller enforcement on this token today.

*Control:* exactly one intake consumer at a time, enforced by contract and by never running two Asdair instances. If intake ever moves into the gateway, the same rule applies across processes.

### 🔴 2. The live Chrome / ASDA session and trolley — real money, not isolatable.

One browser profile, one authenticated account, one live trolley. Two drivers interleave clicks on shared state that holds real money. Cannot be worktree-isolated. Not an AsdAIr-vs-engineering collision (Keel never touches it) but an **AsdAIr-vs-AsdAIr and AsdAIr-vs-Larry** one. This is a second, independent reason to keep the browser drive out of Experiment 1.

### 🟠 3. `services/asdair/skill/**` read under an engineering worker's feet.

If a Work Order ever declares `services/asdair/**` as its `file_surface` while an Asdair instance is running `node cli.js` from the same tree, **the planner can change mid-run** — silently, producing a plan from two different code versions. Not hypothetical: `planner.js` is exactly the kind of file an engineer would be sent to fix.

*Control:* Asdair reads the skill from a **pinned path**, and Larry never schedules an Asdair run concurrently with a Work Order whose surface includes `services/asdair/**`.

### 🟠 4. Git working tree and index.

If Asdair holds no `Write`/`Edit`, runs no git, and never touches `services/**`, **git collision is effectively zero** — the single biggest argument for that tool calibration. Break any one of those three and it races the shared tree exactly as the standing parallel-agents rule warns.

### 🟢 5. `asdair.command_request` queue — genuinely safe, and worth saying so.

`FOR UPDATE SKIP LOCKED` (`asdair-worker.mjs:45`), per-household `pg_advisory_xact_lock` (`asdairCommands.mjs:64`, `:93`), unique `idempotency_key`, effect-level upsert by `(list_id, lower(item_name))`, insert-guard + transition-guard triggers, immutable receipts. **Concurrent workers cannot double-execute.** This is the one part of the estate already built for concurrency, and it is built well. Direct writes *outside* this seam have none of that protection — hence boundary #7.

### 🟡 6. Shared advisory-lock key space.

`pg_advisory_xact_lock($householdId)` uses a bare `bigint` — for the single real household that is a very low integer. Any other subsystem in the same database taking an advisory lock on the same small integer collides. Low probability, real shared namespace. **Reported, not a blocker.**

### 🟡 7. `C:\.fusion247\**` and `wp-d-proof/.runtime-live/`.

Shared, unlocked, no per-lane isolation. A lane rewriting `directus-live.env.json` mid-run breaks another. **Entirely mitigated by `credential_scope: none`** — Asdair never opens these.

### 🟡 8. The Directus process on `:8074`, and the cockpit worktree hazard.

One process, one port. Not Asdair's to start or stop (boundary #9). Note the standing lesson that the cockpit serves directly from a worktree, so editing served assets is deploying — another reason Asdair holds no write tools.

### ⚪ 9. Scratchpad.

Per-session, so **no collision** — and also **no continuity**. That is the durability problem restated as a concurrency non-problem.

---

## 8. Does durable-function + disposable-runtime hold for AsdAIr?

**It holds for the steward half. It breaks in three specific, nameable places — and the breaks are the useful part of this assessment.**

### Where it holds

- `planner.js` is pure and deterministic. **Same inputs → same output *is* the disposability guarantee**, formally. A fresh instance handed the same payload produces the identical basket. That is the hypothesis proven, in code, with CI.
- The rulebook is data in Postgres, not context. A fresh instance loads it.
- The ten standing rules are written down and versioned.
- The learning mechanism has a real home: a decision with `applies_going_forward=true` promotes into a structured rule with a `promoted_rule_id` back-link. **The design is right.**

### Where it breaks

**(a) The entrypoint is disposable.** `shopper-recv.mjs` exists only in per-session scratchpads, found under two different session UUIDs — meaning it has been **rebuilt from scratch at least twice**. A disposable runtime with a disposable entrypoint has no function to remember. This is the cheapest fix and the most obviously correct one.

**(b) The method is durable only in machine-local memory.** `…/memory/asdair-idea012-runtime.md` is genuinely excellent — it is the best AsdAIr artefact in existence — and it is outside the repo, outside version control, outside review, unportable to another machine, one undifferentiated blob, and it already contains at least one claim I could not verify (§1.3). It is a durable *note*, not a durable *function*. §4.2 is the fix.

**(c) ⚠️ The loop is open — this is the real failure.** Last night's shop was **not written back** (`…19-03…md:60`). The learnings from it — a rotation choice to carry forward, and an item that is absent from the Regulars list and therefore silently skipped by every bulk pass — live as **prose in a session log and a memory file**, not as rows the planner can read. So next week's instance will make **the same silent-skip mistake**, because the only thing that knows about it is narrative.

That is the hypothesis failing in production, precisely. And it is fixable without new architecture: the tables exist (`shopping_lists`, `shopping_list_items`, `orders`, `order_events`, `rule_qa_log`), the governed write seam exists and is concurrency-safe, the allowlist already contains `add_list_item`. **Only the write is missing.**

**Sharpest single sentence:** AsdAIr's function currently remembers what it was *told* and forgets what it *did*.

---

## 9. Operational-cost test, and what I would push back on

### Does a durable contract reduce future effort more than it adds?

**Yes — but most of the saving comes from the SOP, not the shim.**

**Adds:** ~30 min for SOP-021, ~30 min for the contract + shim, plus Larry staging a payload per run.

**Saves:** the weekly shop is the **highest-frequency recurring task in the entire estate** — every week, indefinitely. Writing the procedure once so every future instance reads it is an unambiguous win. The reconcile rule alone caught a real dropped item last night. Context isolation is a genuine additional saving, but a smaller one.

**Therefore: if Warwick only does one thing, write the SOP.** The shim without the SOP produces an instance that must reconstruct the method from a machine-local memory blob — which is the current situation with extra steps.

### What I would push back on

1. **⚠️ SHARPEST — do not put the browser drive in Experiment 1.** Two unverified things (the durable-function hypothesis, and whether a subagent can reach the browser connector at all) would fail as one and teach you nothing. Prove the hypothesis on the half that has durable function.

2. **⚠️ Never grant `mcp__supabase__execute_sql`.** It is write-capable against a schema holding Mum's real data. There is no read-only SQL MCP alternative — which is exactly why Larry should stage the payload (§6).

3. **The name is a taxonomy mix, and I would accept it anyway.** Every other roster entry is a person-hat (Larry, Penn, Arc, Mason); "AsdAIr" is a product name (IDEA-012). Naming a specialist after a project sets a precedent. But Warwick already *says* "send that to Asdair" — that phrase **is** the stable dispatch address he asked for, and the operational cost of teaching him a new name exceeds the taxonomy benefit. Recommend: accept it, normalise the casing to `Asdair` for the folder and `asdair` for the slug (GL-001 §1), and note the precedent explicitly so the next hire doesn't cite it as licence.

4. **Two live records contradict this hire and should be settled first, in one ruling.** `Team Knowledge/fusion-brief/current-state.md:24` says AsdAIr is **parked** (and `services/cockpit/server.mjs:45` actively filters it out of the cockpit), while `tsk-2026-07-10-005` (open, priority 4) recommends the automation layer **stay external**. A live shop ran last night. Hiring into an unresolved contradiction is precisely how the service estate got orphaned the first time. **Ask Warwick to rule on both in the same breath as the hire.**

5. **`services/asdair/db/` has a missing migration and it is not cosmetic.** `asdair.regulars` is live, load-bearing, and reconstructable only from ad-hoc `create table` statements inside test files. Report it into the engineering queue; do not block the hire on it.

6. **Withhold `Write`/`Edit` — and say honestly that it is a speed bump.** It is the cheapest meaningful control on a role whose natural output is personal data in a public repo, and it costs nothing because the deliverable is a return to Larry. But a Bash-holding agent can still redirect to a file; the real controls are the contract, `.gitignore`, and `secret-scan.sh`. Do not oversell it.

7. **Resist making Asdair a builder.** The moment it "just quickly fixes" the missing write-back, it is writing under `services/**`, and every concurrency control in §7 evaporates at once. Domain operator, not builder. Defend that line the first time it is inconvenient.

---

## 10. SOP-001 completion state

| Step | State |
|---|---|
| 1 — Capture the need | ✅ Gap statement supplied by Larry; verified against the repo in §1. |
| 2 — Brief Pax | ⬜ **NOT RUN.** Mandatory if this converts to a hire (`Team/Nolan - HR/AGENTS.md:16`, `:57`). |
| 3 — Pick name/role | 🔶 **Proposed only** — `Asdair` / Household Shopping Steward / slug `asdair`, no collision. Subject to Pax per SOP-001 §3. |
| 4 — Draft the contract | ⬜ **Not drafted, not written.** Scope, boundaries and prohibitions specified in §5–§6 as inputs to a future draft. |
| 5 — Draft the shim(s) | ⬜ **Not drafted, not written.** Claude Code is the only activated host. |
| 6 — agent-index row | ⬜ **Not drafted, not written.** |
| 7 — Update Workstreams | ⬜ **No change needed** — no existing Workstream involves household shopping. |
| 8 — Confirm with Warwick | ⬜ **THE GATE. Pending.** Nothing is created until Warwick approves. |
| 9 — Log the hire | ⬜ Larry's, after approval. |
