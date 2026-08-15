# Wayfinder plan — BUILD-006 VlogOps Publishing Engine

## START / RESUME HERE — ordered by Warwick

- This Git Wayfinder is the sole route and source of truth.
- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- Read the current phase, gate and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer.
- Continue autonomously until completion or a genuine Warwick-only blocker.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate and next action.
- **Tangents go in "SHIT TO DO" below. Do not chase them.** See the rule there — it binds even when the tangent comes from Warwick.

*(The block above is copied VERBATIM from `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md`, the proven map, on Warwick's explicit instruction. It must stay byte-identical so a fresh Larry, Honcho, the watcher and Tower all orient the same way. Do not "improve" it.)*

> **To verify this block is byte-identical after any edit to either file:**
> `diff <(sed -n '3,13p' Deliverables/2026-08-02-wayfinder-operating-reset-plan.md | tr -d '\r') <(sed -n '3,13p' Deliverables/2026-08-03-build-006-vlogops-publishing-engine-wayfinder-plan.md | tr -d '\r')`
> Exit 0 means identical. **Mutation-test it once** — append a byte to a copy and confirm `diff` reports a difference — so an identical result is a real match and not a control that always passes.

## SHIT TO DO — parked tangents (Warwick's rule, 2026-08-02)

**THE RULE.** When Warwick drags Larry off-plan mid-build — and he will, and he knows he does — **the tangent gets written here and the plan continues.** Larry names the current focus, parks the item, and tells him to be patient. They get worked at the **end**, not the moment they are mentioned.

This is not Larry being unhelpful. An interrupted build is how BUILD-018 happened: a request amplified into maintenance, then into a programme. The cost of a tangent is never the tangent, it is the loss of the thread. **Warwick has explicitly asked to be told to wait** — so doing it is compliance, not insubordination.

| # | Parked item | Why it is not now |
|---|---|---|
| 1 | **The Drive folder `VlogOps` (`1Wh4fMU60FPpJxNsqCKBUfiD-lzoFFPAu`) is EMPTY** — zero children, verified 2026-08-03. All IDEA-006 substance lives in the single Durable Backup file. Not a defect, but a trap for a future session that goes looking in the obvious place. | Record hygiene, not a build gate |
| 2 | **The ClickUp IDEA-006 record is incomplete by its own admission.** The source document states ClickUp returned a 108-minute write rate limit mid-write; pages 08/09/10 landed, several IDEA-020 pages and the IDEA-006 task status update did not. **Warwick's ruling, 2026-08-03: ClickUp cannot be relied on; Drive is canonical.** | Superseded by the Drive authority. Do not "fix" ClickUp as part of this build |
| 3 | **IDEA-020 ScoutAIR is unpromoted**, and Content Scout would eventually feed VlogOps seeds. | A later intake source. **Not a BUILD-006 dependency** — the three accepted intake routes do not include it |
| 4 | **The `Human in the Poop` YouTube identity review is still pending** (BUILD-019 F1). Standing instruction: do not retry, do not duplicate the channel, do not create another Google account. | Recheck only when a phase genuinely needs it, or on Warwick's word |
| 5 | **Post-publication community capability** — the Foundry addendum records it as a real future boundary spanning Public Platform, ScoutAIR and VlogOps. | Explicitly **not a fourth build** and not in BUILD-006 |
| 6 | **Honcho silently truncates `notes` at `FIELD_CAP = 600`.** Measured 2026-08-03: a 666-character `notes` was delivered as 600 (599 + `…`), losing 67 characters mid-sentence. `tools/governor/continuity.mjs:139` — `s.slice(0, FIELD_CAP - 1) + '…'`. **The `write` result DID report `"truncated": ["notes"]`, so the control is honest — but the operator only learns *that* it happened, never *what was lost*.** Nothing resumption-critical was lost on that occasion; the casualty was a remedy pointer. **The durable fix is one of: raise the cap for `notes`, or have the writer print the dropped tail so the operator can re-home it. Not a new mechanism — a one-line change to an existing, working module.** ⚠️ **The real hazard is habit, not the cap:** a long `notes` is where a session's loose ends go, so silent loss lands precisely on the things nobody wrote down anywhere else. Prefer the structured fields (`blockers`, `accepted_decisions`, `completed`) — they are capped at `LIST_CAP = 8` **items**, not characters. | Warwick, 2026-08-03. Governor work, not BUILD-006. **No further Governor expansion is authorised** beyond fixing this. Do not build a truncation-reporting subsystem |

---

## ▶️ PHASE 1 IS ACTIVE AND UNDER IMPLEMENTATION — **superseded 2026-08-15. The reconciliation below is HISTORY, kept for provenance.**

**Live state, established by execution:** Phase 1 is **ACTIVE**. Keel is implementing **WP-1**
(`WO-2026-08-14-01`) on branch `build-006/b6-01-content-seed-store` in worktree
`C:/Fusion247PKA-vlogops`. **Draft PR #105 is open and unmerged.** `services/vlogops` **exists** —
schema, identity, all three intake routes, tests and CI, committed at `d55965a`, `ae318a0`, `71d9627`.
Keel returned **PARTIAL** on the implementation: ten of ten acceptance criteria met with executed
evidence, held back from complete because **CI is built but has never been observed running**.

**The next boundary is NOT another dispatch.** It is: the real three-route Content Seed goal
**demonstrated** → **Veritas** Gate 1 → **Codex** external merge-class QA → **Warwick's** merge decision
(§9.2). **PR #105 stays draft until that route is satisfied.**

### *(historical — the pre-implementation reconciliation of 2026-08-14)*

**Warwick, 2026-08-14: BUILD-006 is the NEXT ACTIVE BUILD.** Before dispatching, this map was reconciled
against `main` — **only far enough to check that the night's estate reconciliation had not moved a
prerequisite or already delivered part of Phase 1.** *No product decision in this map was reopened.*

| checked by execution | result |
|---|---|
| `services/vlogops` on `main` | **ABSENT** — Phase 1 genuinely not begun *(true on 2026-08-14; superseded 2026-08-15 — it now exists on `build-006/b6-01-content-seed-store`, PR #105)* |
| the staged canonical source (§Source authority #3) | **present** — `Builds/BUILD-006-…/SOURCE-foundry-boundary-decision-2026-08-02.md` |
| the superseded 2026-08-01 plan | **correctly marked** — carries its own ⛔ *"Do not follow this document. It is history"* and points here |
| `services/control-plane/worker/` (§6 F4's reuse target) | **present and intact** |
| estate | `main == origin/main`, clean, **primary worktree only**, 0 stashes, 0 open PRs |

**✅ RAISED AND SETTLED, 2026-08-14 — §6 F4's store choice is no longer fog.** It was put to Warwick at the
top of the Phase 1 session, as this map required, and he ruled:

> **Warwick, 2026-08-14: *"supabase for this"***

**The durable Content Seed store is the managed Supabase Postgres project.** This honours his recorded
boundary (*"do NOT substitute SQLite for Postgres as a side project"*) rather than sitting against it, and
it removes the dependency on an unset `CONTROL_PLANE_DEV_DATABASE_URL`. See §6 F4, superseded in place.

**Programme order, unchanged and fixed by Warwick:** BUILD-019 Phases 1–3 ✅ → **BUILD-006 in full ← HERE**
→ BUILD-019 Phase 4 → real end-to-end publication acceptance. **BUILD-006 CREATES the Publication Package;
BUILD-019 CONSUMES it and returns Publication Receipts.** The website stays paused so Phase 4 resumes with
a **real** producer and a **real** package rather than another synthetic fixture.

## 🔻 STATUS — Phase 0 ✅ PASS (accepted by Warwick). **Phase 1 — seed intake + the durable Content Seed store — IS THE FRONTIER.**

| | |
|---|---|
| **Build** | BUILD-006 — VlogOps Publishing Engine. **THE ACTIVE BUILD.** |
| **Promoted from** | IDEA-006 (Foundry), on Warwick's explicit instruction 2026-08-03 |
| **Programme position** | BUILD-019 Phases 1–3 ✅ done → **BUILD-006 in full ← YOU ARE HERE** → BUILD-019 Phase 4 → the real end-to-end acceptance journey. Fixed by Warwick, 2026-08-03. |
| **Current phase** | **Phase 1 — seed intake and the durable Content Seed store. ACTIVE, under implementation.** Phase 0 is PASS. |
| **Live WP state** | **WP-1 `WO-2026-08-14-01` with Keel** — branch `build-006/b6-01-content-seed-store`, worktree `C:/Fusion247PKA-vlogops`, **draft PR #105 open and unmerged**. Implementation returned **PARTIAL** (all ten ACs evidenced; CI built but never observed running). |
| **Exact next action (2026-08-15)** | **NOT another dispatch.** Demonstrate the real three-route Content Seed goal → **Veritas** Gate 1 → **Codex** external merge-class QA → **Warwick's** merge decision. See §9.2. |
| **Current gate** | **All three intake routes land a durable Content Seed with stable identity; kill mid-intake and it recovers; identity survives restart.** (§10, Phase 1 row.) |
| **Exact next action** *(SUPERSEDED 2026-08-15 by the row above — this dispatch HAPPENED; kept for the route detail it carries)* | ~~**Dispatch Phase 1 as a bounded Work Order.**~~ Build the Content Seed store and the three intake routes to the detail in §5 — Route 1 *smallest sufficient* evidence bundle · Route 2's five-field promotion contract · Route 3's seed-plus-angle. **Read §6 F3 first: the streams the North Star names are INTERMITTENT — whole days carry zero session logs while being dense with other evidence — so `Deliverables/` and git history are first-class intake, not fallback.** §6 F4 names the orchestration substrates to reuse — **reuse, do not build a second framework.** |
| **Model for Phase 1** | **Opus-high.** Durable state, identity, provenance and idempotency are the expensive things to get wrong, and everything downstream inherits them. |
| **Depends on BUILD-019** | Only at Phase 7, and only through a **contract** — see §4. BUILD-006 develops against the accepted Publication Package contract without waiting for BUILD-019 Phases 4–7. |
| **Open Warwick gates** | **None blocking Phase 1.** The §6 F4 store decision was raised and **SETTLED by Warwick on 2026-08-14 — Supabase.** Later: **spend** before any HeyGen render (§6 F1). |
| **Assurance route — MANDATORY** | **§9.2.** Functional goal DEMONSTRATED → **Veritas** internal → **Codex** external merge-class QA → **Warwick's** merge decision. **Veritas does not replace Codex; Warwick's authority does not replace Codex; a green suite replaces neither.** The Codex gate does **not** disappear because work reached the boundary by a route that created no PR. **WP-1's PR #105 stays draft and unmerged until the route is satisfied.** |
| **Store — settled** | **Supabase Postgres** (Warwick, 2026-08-14). Live state established the same day: the project holds `asdair.*` and `session_report.*`; there is **no `ops.*` schema in it**, so reusing `services/control-plane/worker` means applying its DDL to Supabase, not pointing at an existing live queue. |

> **✅ WARWICK ACCEPTED THIS PLAN IN SUBSTANCE, 2026-08-03.** Phase 0 is closed. **Implementation of Phase 1 is authorised and IS UNDER WAY** — dispatched to Keel 2026-08-14 as `WO-2026-08-14-01`, draft PR #105. *(This line read "has not begun" until 2026-08-15; it was true when written and is superseded by execution.)*

---

## 1. NORTH STAR (from the canonical Foundry record, 2026-08-02)

Given a content seed supplied through one of **three routes** — existing Flight Recorder / session / build evidence · promotion from another Fusion247 output · Warwick-provided free text, conversation excerpt or document — **VlogOps autonomously compiles a durable evidence pack and develops it into a recognisably Warwick creative package for the selected Fusion247 channel.**

For **Human in the Poop**, the normal package contains an evidence-grounded **9–12 minute video script**, a blog adaptation for the Fusion247 website, titles, thumbnail direction, chapter/visual plan and source map, privacy/rights/disclosure and factual exclusions, and derivative promotional copy.

**Warwick approves the creative package once.** After that single approval, VlogOps runs the configured production path — article publication, HeyGen render, QA, YouTube publication, approved X derivatives, receipts and analytics references — **without Larry or interactive prompt choreography.**

> **The division that defines this build.** The application/runtime owns identity, state, source snapshots, sequencing, versions, retries, idempotency, approvals, callbacks, recovery and receipts. **AI specialists own bounded interpretation, research, creative construction and verification.** Normal operation must not depend on Larry, Warwick or an interactive session shepherding each stage.

**If this build ends with a pipeline that needs a human to nudge it between stages, it has failed its North Star regardless of output quality.**

---

## 2. Identity — fixed, not open

| Thing | Value |
|---|---|
| Umbrella platform | **Fusion247** |
| First channel | **Human in the Poop** — *the human remains in the loop, usually while everything goes to shit* |
| Application | **VlogOps** |
| Pipeline | **Log2Vlog** |
| Build strand | **We Made a Thing** |
| Creative specialist | **Scribe** |
| Presenter | Warwick's authorised HeyGen avatar/voice |

---

## 3. Product boundary

### BUILD-006 OWNS

Seeds and the three intake routes · **immutable source snapshots and provenance** · stable content identity and versioning · the **Source Compiler** · bounded research dispatch · **Scribe** and the **Master Story Package** · independent verification (fact, quotation, privacy, rights, cross-format consistency) · **Warwick's single creative approval** · durable production orchestration · the outbound **Publication Package** · VlogOps state and the Cockpit experience.

### BUILD-006 DOES NOT OWN

The Fusion247 website or domains · YouTube and X **accounts** · the publication **adapters** · public URLs · destination **receipts** and reconciliation. **All of those are BUILD-019's**, and BUILD-006 reaches them only through the contract in §4.

### Scribe — a constraint, not a preference

Scribe is **not** a separate application or build. It is a **persistent specialist capability within VlogOps, implemented as a versioned contract/skill whose underlying model may change.** **Do not replace it with a generic one-off drafting agent.** Its voice is primarily Warwick's own accumulated voice and relationship with AI, informed by — never imitating — Clarkson's strong premise and comic reversal, NetworkChuck's accessible enthusiasm, and Simon Whistler's structured narration. **No verbatim imitation.**

### ObsidiWikAi (IDEA-007) — an optional source, never a prerequisite

May be considered as **one evidence or retrieval source where useful**. It is **not the VlogOps product** and **must not become an automatic prerequisite or a substitute for the Source Compiler, Scribe or durable VlogOps state.** Its real current state is fog — see F5.

### The critical reliability rule, carried verbatim from the source

> **ClickUp is a source adapter and control surface, not VlogOps' only database or memory.**

Accepted source content must be snapshotted with timestamps, provenance and integrity metadata. **A later ClickUp search or connector failure cannot erase or reinterpret an existing run.** This is a hard architectural constraint, and Warwick's 2026-08-03 ruling that ClickUp cannot be relied on makes it sharper, not softer.

---

## 4. The dovetail with BUILD-019 — the contract, stated once

**BUILD-006 produces the Publication Package. BUILD-019 consumes it and returns Publication Receipts.** Neither build reaches into the other.

### Outbound — the versioned Publication Package

```text
content_id                 creative_version           channel_id
destinations[]             publication_mode/schedule
article_title              article_slug               article_body
video_asset / video_source video_title                video_description
chapters                   thumbnail_asset            social_derivatives[]
media_assets[]             rights_state               disclosure_state
privacy_approval           approved_by                approved_at
idempotency_key            expected version/checksum
```

### Inbound — the Publication Receipt, per destination

```text
content_id                 creative_version           destination
external_id                canonical_url              visibility/status
published/scheduled timestamp                         asset/version identifiers
warnings                   latest reconciliation state
retry/failure information  takedown/correction state (where relevant)
```

### Invariants binding both builds

- **A missing API capability must not cause the system to pretend publication occurred.** Every destination supports an honest manual fallback preserving the *same* state and receipt contract.
- **A successful API request is not proof until the real destination is verified.**
- External publish operations are **idempotent**; repeating a request cannot create uncontrolled duplicates.

### How the two builds proceed without blocking each other

**BUILD-006 develops against this contract using a local stub of the BUILD-019 adapter.** It does not wait for BUILD-019 Phases 4–7. When BUILD-019 Phase 4 resumes, it does so with **a real producer and a real package behind it, not a synthetic fixture as the final product** — which is precisely why the programme order was changed.

---

## 5. The durable middle — the pipeline this build must deliver

```text
three seed routes
  → stable content identity
  → immutable source snapshots + provenance
  → Source Compiler (deterministic; dedupe, chronology, bounded evidence pack)
  → bounded research, ONLY where current/external evidence is genuinely required
  → Scribe (story question → beats → master narrative → script + blog + titles + thumbnail direction)
  → Master Story Package
  → independent verification (fact · quotation · privacy · rights · cross-format consistency)
  → Warwick's SINGLE creative approval, from the Cockpit
  → durable production orchestration (HeyGen render, callbacks/polling, retries, asset versions)
  → versioned Publication Package
  → BUILD-019 destination adapters
  → website article · Human in the Poop video · Fusion247 X output
  → durable receipts, recovery and reconciliation
```

**The Master Story Package is one canonical creative truth with sibling adaptations.** The blog is not a raw transcript; the video and blog cannot drift into unrelated claims.

### The three intake routes, in the detail Phase 1 needs

Carried from the canonical source, because Phase 1 is the frontier and "three routes" alone is not implementable.

**Route 1 — existing records.** Warwick selects a date, period, session, build or journal thread. **VlogOps snapshots the smallest sufficient evidence bundle into its own durable store.** *"Smallest sufficient"* is the design constraint — not everything in range.
→ **See F3: the streams this route names are INTERMITTENT or outside Git** *(corrected 2026-08-14 — the earlier "dry" reading was measured false; the consequence is unchanged)*. `Deliverables/` and git history must be first-class here, not fallback.

**Route 2 — promote another Fusion247 output.** Eligible Cockpit outputs expose a **Promote to VlogOps** action. **Promotion creates a durable Content Seed containing: a source snapshot · provenance · privacy state · origin · proposed angle.** Those five fields are the contract for this route.

**Route 3 — Warwick-supplied seed.** Free text, a pasted conversation, an attached document, or a supported URL — **plus the angle or question he wants taken.** The angle is part of the seed, not something inferred from it. The source's own example, kept because it sets the register:

> *Today I thought X was a fucking good idea. GPT and Pax told me it was shite. This is what I missed.*

**All three routes converge on one durable Content Seed with stable identity**, and every one of them snapshots with timestamps, provenance and integrity metadata — see the critical reliability rule in §3.

### Cockpit

Views: **Seeds · Developing · Awaiting Warwick · Production · Published · Problems.**
Actions: add seed · promote to VlogOps · approve · request revision · park · reject · inspect sources/risks · view outputs/receipts.

---

## 6. FOG — genuinely unresolved, with how each resolves

**Pax researched F1–F5 on 2026-08-03 and the findings are absorbed below. A later session does not need to repeat this research.** Every figure is dated and sourced. **What is still OPEN is genuinely open and must not be guessed at.**

### 🔴 F1 — HeyGen — **cost RESOLVED. A new hard blocker found: the script does not fit.**

**RESOLVED (Pax, official docs, 2026-08-03; two sources reconcile arithmetically):** no subscription tier needed — the API is standalone **pay-as-you-go from $5**, prepaid USD wallet, balance at `GET /v3/users/me`. Billed **per second of output, identical for 720p and 1080p**. Max **30 minutes and 50 scenes per video**, so a 9–12 minute video needs no duration segmenting. **PAYG cap: 10 concurrent jobs**; `429` carries `Retry-After`. Async is well-shaped for us: persistent webhooks or per-request `callback_url` + `callback_id`, events `avatar_video.success`/`.fail`, and **`Heygen-Event-Id` is the documented replay-defence header** — it maps straight onto an idempotent inbound handler.

**Cost of one 9–12 minute render — and the 4× spread is the gate:**

| Engine / avatar type | $/min | 9–12 min |
|---|---|---|
| **Avatar III — Digital Twin / Studio** | $1.00 | **$9.02 – $12.02** |
| Avatar IV / V — Digital Twin | $4.00 | **$36.02 – $48.02** |

**Do not write a single number into a Work Order.** Which applies turns entirely on **which engine Warwick's authorised avatar is bound to** — still unknown, and it is BUILD-019 F3.

> #### 🔴 THE BLOCKER: **`Script text: Maximum 5,000 characters.`**
> A 9–12 minute script is **~1,260–1,680 words ≈ 7,200–9,600 characters**, using this estate's own measured spoken rate (`Deliverables/2026-08-01-vlogops-wayfinder-plan.md:48`). **A 9–12 minute script does not fit in 5,000 characters.**
> **Unresolved: is the limit per VIDEO or per SCENE?** The usage-limits page files it under "Avatar Input"; the v2 `video_inputs[].voice.input_text` shape implies per-scene. That is the difference between *"split the script across scenes in one render"* and *"you cannot render 9–12 minutes in one call."*
> **Resolved by:** reading the current `POST /v3/videos` request schema, or **one ~$1 Avatar III test render** with a >5,000-character script. **DO NOT GUESS IT.** With 50 scenes allowed per video, per-scene is the likely answer — and "likely" is exactly the word that has cost this estate repeatedly.

**Assume a retried render is charged again.** Nothing in the docs indicates vendor-side deduplication. **The idempotency must live on our side of the seam** — this is a design constraint on Phase 6, not a footnote.

### 🟠 F2 — YouTube — **quota RESOLVED and it is a non-issue. The real gate is an audit, not code.**

**The widely-known numbers are stale.** `videos.insert` no longer costs 1,600 units: it is **1 unit in a dedicated Video Uploads bucket, ~100 calls/day** (changed 2025-12-04; buckets separated 2026-06-01). Uploads no longer compete with reads. **Quota is not a constraint for VlogOps.**

**The actual blocker:** *"All videos uploaded via the `videos.insert` endpoint from unverified API projects created after 28 July 2020 will be restricted to private viewing mode."* Lifting it requires a **YouTube API Services compliance audit** — separate from, and additional to, the channel's identity review. **Consequence: an unaudited project can upload, and the video is permanently locked private — it cannot be made public by API or in Studio.** So the map's "default Private while proving" posture is **free**; going public is gated on an **audit with lead time**, not a code change. That is a Warwick decision to start early, not a research finding.

**Also resolved:** `status.containsSyntheticMedia` (boolean) exists and a realistic HeyGen avatar is squarely in scope · the unverified-channel duration cap is **15 minutes**, so 9–12 minutes is under it · **phone verification is NOT needed for upload length — it IS needed for custom thumbnails**, which the Master Story Package explicitly produces. *(This narrows BUILD-019 F1: the pending review gates the thumbnail and publication, not the upload.)* · `youtube.upload` is least-privilege for upload alone; confirm per-method before fixing the scope set, since `videos.update` and thumbnails likely need broader.

**`privacyStatus: private` is not link-shareable.** If Warwick needs to view a proof render on his phone, **`unlisted` is the correct value**, not `private`.

### 🔴 F3 — Source Compiler — **RESOLVED, and the answer is worse than "file reader or connector"**

**File-reader-shaped, and stable, for:** session logs at `Team Knowledge/session-logs/YYYY/MM/…md` (7-key frontmatter, verified identical five weeks apart; parse `type` permissively — one legacy value is outside the template enum) · `Builds/BUILD-NNN-*/**.md` (freeform, no frontmatter) · `Deliverables/YYYY-MM-DD-*.md`. Close-session entries are contractually required to carry `## VlogOps / story signals` (`AGENTS.md:182`) — **a purpose-built editorial channel already exists in the schema.**

**Connector-shaped, and now unreliable, for:** the **Daily Flight Recorder**, which lives as a **ClickUp Docs page** (`Team Knowledge/session-logs/2026/07/2026-07-15-16-00_larry_…md:47,53`). **Warwick's 2026-08-03 ruling makes ClickUp unreliable, and dispatched specialists have no MCP connectors, so a worker cannot read it at all.**

> #### 🟠 THE FINDING THAT MATTERS MOST — **CORRECTED BY MEASUREMENT, 2026-08-14. The stream is NOT dry. The requirement it produced survives anyway.**
>
> **As written on 2026-08-03 this said: "There are ZERO session logs in `Team Knowledge/session-logs/2026/08/`. Newest is `2026-07-30-23-16`." That was TRUE THE DAY IT WAS WRITTEN and is FALSE NOW.** Measured at `4135fd3` by `git ls-tree`: **16 session logs in that directory, earliest `2026-08-03-16-34`, latest `2026-08-14-21-00`.** Caught by Keel at the WP-1 read-back, against a Work Order in which **Larry had restated the stale claim as current fact** — he had collapsed two different true statements (this one, written eleven days ago, and last night's honest gap in *Larry's own close-session* entries for 11–13 August) into one false one.
>
> **What survives, and it is the part that mattered:** individual windows genuinely carry **zero** session logs while being dense with other evidence. Measured the same day: **2026-08-01, 2026-08-02, 2026-08-05 and 2026-08-07 each have zero session logs** — and 2026-08-05 alone carries **164 commits and 6 deliverables**. A Source Compiler reading only the stream the North Star names would still find nothing on those days.
>
> **Therefore the requirement is unchanged: `Deliverables/` and git history are FIRST-CLASS intake, not fallback.** What changes is the reason — not *"the stream is dry"*, but *"the stream is intermittent, and intermittence is indistinguishable from absence on any single window."*
>
> That same draft records the workaround it was forced into: the evidence window was rebuilt *"from git history, `Deliverables/`, the audits and the programme record — **not** from the stream the pipeline is designed around."*
>
> **A Source Compiler built against the streams the North Star names would be a compiler with nothing to compile.** The stream that actually carried today's real episode was `Deliverables/` **plus git history** — which is not on the list.
>
> **Phase 2 must therefore treat `Deliverables/` and git history as first-class intake, not as fallback.** Whether the session-log gap is a habit failure or a four-day anomaly is **one sentence from Warwick**, and it changes whether Phase 2 also needs to fix the stream or merely read around it.

### ✅ F4 — Orchestration — **RESOLVED on what exists. The store choice is now RESOLVED TOO — Supabase (Warwick, 2026-08-14).**

**Nothing needs building.** The outbox, idempotency-key, lease/claim, attempt-budget and dead-letter shapes exist and are tested **three times over**:

1. **`services/control-plane/worker/` — the generic durable job queue** (Postgres `ops.*`). Closest fit and domain-neutral: `enqueue.mjs` (job + event in one transaction, `idempotency_key` UNIQUE, returns `{job, deduped}`) · `worker.mjs` (`claim_job` with `FOR UPDATE SKIP LOCKED`, completion guarded by `status='leased' AND lease_owner=worker` so a reclaimed worker's effect rolls back) · **a real outbox** with claim-then-send, backoff, dead-letter and a `SendingWatchdog` for crash-mid-send. Has its own suites.
2. **`services/control-plane/tower-loop/` — SQLite, WAL.** Reusable *shapes* (lease, notification dedup, heartbeat, deterministic turn key, verdict-post outbox with an invisible marker for the crash window) but **every table is `tower.*` and every module is coupled to review turns and PR comments.**
3. **`services/asdair/pipeline/` — the best *pattern* reference:** guarded transition as mutual exclusion, generation-carrying idempotency keys, command ledger separated from the human to-do list, invariants asserted in tests. Its resumability contract is the doctrine VlogOps needs.

Plus two **directly liftable, zero-dependency** modules: `services/fusion-capture-gateway/src/core/idempotency.js` and `retryPolicy.js`.

> **✅ THE STORE IS SETTLED — Supabase. Warwick, 2026-08-14, raised at the top of the Phase 1 session exactly as this map required: *"supabase for this"*.**
>
> *The fog as it stood, kept for provenance:* the generic queue needs a **Postgres server**, and `CONTROL_PLANE_DEV_DATABASE_URL` is unset in a normal session (`Deliverables/BACKLOG.md:28`); Tower *just removed* Postgres (WO-TW-01, PR #90 → `eb975bc`); but `BACKLOG.md:28` also records Warwick's boundary verbatim: ***"do NOT substitute SQLite for Postgres as a side project."*** **The ruling lands on the side of that boundary and dissolves the unset-dev-database problem — the managed project is always there.**
>
> **What the decision costs, established by execution against the live project on 2026-08-14 and NOT to be discovered again mid-build:** the Supabase project contains **`asdair.*` and `session_report.*` only — there is no `ops.*` schema and no `tower.*` schema in it.** So "reuse `services/control-plane/worker`" means **taking its shapes and its DDL to Supabase**; it does not mean connecting to a queue that is already live. **The applied-migration ledger there ends at `019_shopping_list_shop_identity`, while the 2026-08-14 close-session records 020 and 021 as applied to live — so the ledger is NOT a complete record of that database, and no Phase 1 numbering may be derived from it without checking the repo's own migration directory.**

**Also:** neither queue is packaged (`private: true`, no `exports`) — reuse means cross-directory import or copying; there is no shared library boundary today. Two `220_` migrations collide in `db/mypka/` (cosmetic). **No HeyGen or YouTube adapter exists anywhere in the repository** — both are new code, and both are BUILD-019's.

### ✅ F5 — ObsidiWikAi — **RESOLVED, and the answer settles it permanently**

**`personal_vault_access: false` is not a degradation — it is a frozen design constant.** `services/obsidiwikai/src/core/brainAccess.mjs:21-25` declares `RESPONSE_SCOPE = Object.freeze({ knowledge_domain: 'world', surface: 'encyclopedia', personal_vault_access: false })`. **There is no flag to flip.** The Brain is by construction a read-only retrieval surface over **learned external sources** — it was never a route into MyPKA session logs or build evidence, and making it one would be a different build.

**Therefore, stated once so it is never re-litigated:**
- **For intake route 1 — Warwick's own session and build evidence — ObsidiWikAi is NOT a source at all.** Not today, not with work.
- **For external corroboration inside a script** — what a video actually said, with citations back to source — it is **available today**, read-only, already wired into Larry's runtime via `.mcp.json`.

The service is live (LightRAG 1.5.4 + Neo4j 5.26) but **unmerged** (draft PR #59) — a governance state, not a runtime one. **The learn pipeline is not running as a daemon** (`BACKLOG.md:39-44`), so new material does not enter the graph automatically. **VlogOps must treat a Brain miss as normal** — with `personal_vault_access: false`, a miss on Warwick's own material is the *expected* answer, not a fault. `C:/.fusion247/lightrag.env` is a **denied private surface** — any Work Order touching it must declare it.

---

## 7. Security, privacy, rights and spend

- **No secret value** in Git, Drive, prompts, screenshots or public CI logs. Credentials live in the approved store and reach the runtime as injected environment variables.
- **Privacy is a first-class pipeline stage, not a review afterthought.** Seeds drawn from session logs and journals can contain private, client, employer or family material. The Source Compiler must carry privacy state on every snapshot, and verification must be able to **block** a package.
- **Rights and provenance** on every media asset. **Synthetic-media disclosure** wherever required — any realistic HeyGen avatar upload.
- **Only authorised Warwick likeness and voice assets.**
- **Spend is Warwick's, every time.** HeyGen rendering is the first real recurring cost this programme incurs. No auto-recharge, lowest practical limit, stop before any unexpected charge.
- **Defaults fail safe:** YouTube uploads default **Private** while automation is being proven; publication is human-approved; no autonomous replies, DMs or outreach at all in this build.

---

## 8. Human dependency matrix

| Dependency | Owner | State | Needed by | While waiting | Escalation |
|---|---|---|---|---|---|
| Accept this Wayfinder | **Warwick** | ✅ **ACCEPTED in substance, 2026-08-03** (see §STATUS). Row corrected 2026-08-14 — it had read PENDING against an acceptance already recorded twelve lines above it | Phase 1 | — | — |
| **Store choice — Postgres vs SQLite (§6 F4)** | **Warwick** | ✅ **SETTLED 2026-08-14 — Supabase** | Phase 1 | — | — |
| **HeyGen account / plan / API entitlement / avatar / voice / cost** | **Warwick** | Unknown (F1) | Phase 6 | Phases 1–5 in full, stub renderer | **Before any spend** |
| YouTube identity review + handle | Warwick | **Still pending** (BUILD-019 F1) | Phase 7 | Everything to Phase 6 | Never retry or duplicate |
| Creative approval of a Master Story Package | **Warwick** | Not yet applicable | Phase 5 | Build the approval surface | Hard gate — the single approval is the product |
| Website copy/visual approval + public launch | **Warwick** | **PENDING** (BUILD-019 Phase 3) | Phase 7 | Everything before publication | Hard gate |
| Any recurring spend | Warwick | Not granted | Phase 6+ | Free paths first | Hard gate |

---

## 9. Acceptance evidence

**The programme acceptance journey spans both builds.** BUILD-006 is accepted when **one real seed** produces all of this, evidenced:

1. a durable **source/evidence pack** with timestamps, provenance and integrity metadata;
2. a recognisably **Warwick Master Story Package**;
3. **verification** having genuinely run — fact, quotation, privacy, rights, cross-format consistency;
4. **Warwick's approval from the Cockpit**, once;
5. a real **Fusion247 website article**;
6. a **9–12 minute Human in the Poop video**;
7. a real **Fusion247 X output**;
8. **durable receipts** for all three destinations;
9. **idempotent retries** — repeating a request creates no duplicate;
10. **restart recovery** — kill it mid-production and it resumes correctly;
11. **no interactive Larry/AI shepherding at any point in normal runtime.**

**Standard of proof.** Criteria 9, 10 and 11 are *behavioural* and are met only by making them fail: submit the duplicate, kill the process mid-render, and run a complete cycle with nobody watching. **A green test that never ran a failure path is not evidence.**

> **The lesson this build must not repeat.** Tower's five failures all shared one shape: *the acceptance test supplied, at test time, the exact binding that production supplies once and never refreshes.* **A VlogOps test that hands the pipeline its seed and then confirms the pipeline processes that seed proves nothing about unattended operation.** Prove the stages work when nothing has told them what to do.

---

## 9.1 THE REVIEW LADDER — how human-facing work gets reviewed (Warwick, 2026-08-03)

**This governs every review stage in this build — Phase 4 verification, Phase 5 approval, Phase 7 publication — and it governs BUILD-019's website equally. It is the rule, stated in Warwick's words:**

> **Human-facing work is reviewed first from source, then from a rendered non-production environment, then promoted publicly only after approval. Authentication failure by an agent is not evidence that the review environment does not exist.**

Three rungs, in order, and none of them is production:

| Rung | Surface | What it is for |
|---|---|---|
| **1** | **Source** — the copy, the script, the article, the Master Story Package, in the pull request or the Cockpit | Read the words before anything renders them |
| **2** | **A rendered non-production environment** — the protected preview | See the thing as a human will see it |
| **3** | **Public promotion** | **Only after approval. Never as a review step.** |

### Why this is written down here, in this build's map

**Because I got it wrong on 2026-08-03 and the failure was instructive.** A worker's `curl` against the Vercel preview returned `302 → vercel.com/sso-api`. I recorded that correctly as *"no public unauthenticated 200 is possible"* — and then let it become *"the site has never been seen rendering, therefore Phase 3 needs a production deploy to prove itself."*

**That inference was wrong.** The preview existed, rendered and was reachable — by the account owner, logged in. **An agent's inability to authenticate is a fact about the agent, not about the environment.** Warwick had to stop a Work Order that would have published unapproved copy to a live public domain to satisfy a review step that a login would have satisfied.

### And the second half, which matters more

Warwick, 2026-08-03, on what happened next:

> *"He is astonishingly capable when solving a real bounded problem. Then the moment you ask him to make the capability durable, he starts attempting to build the Ministry of Website Observation, complete with constitutional court and a subcommittee for redirects."*
>
> *"The durable lesson does not need another programme."*
>
> *"The build itself is excellent for a first pass. The process around reviewing it briefly became much stupider than the thing being reviewed."*

**That is the regrowth cap in its most precise form yet, and it is aimed at exactly this section.** The response to getting a review step wrong is **not** a review framework, a promotion gate service, an environment registry or a verification programme. It is the four lines in the table above.

**Binding consequences for BUILD-006:**

- **Phase 4 verification reviews the Master Story Package from source first.** A verifier that cannot read the words has not verified anything, and rendering is not a precondition for reading.
- **Phase 5's single approval is taken on rung 1 and rung 2 together** — Warwick reads the package and sees it rendered — and **production is downstream of his approval, never a step within it.**
- **Phase 7 publishes only what has passed both.** A destination adapter is not a preview.
- **When a check fails, establish which rung failed and why before changing anything.** An auth failure, a 302, a protected URL and a missing environment are four different facts. Treating them as one is how a review step turns into a public deployment.

---

## 9.2 THE ASSURANCE ROUTE — Veritas then Codex then Warwick (Warwick, 2026-08-14)

**§9.1 governs how human-facing CONTENT is reviewed. This section governs how WORK reaches a completion,
closure or merge claim. They are different axes and neither substitutes for the other.**

**The settled chain, and no step may be skipped or swapped:**

```
builder/team → the actual functional Work Package outcome, DEMONSTRATED
             → Veritas internal Work Package / phase assurance
             → Codex external PR/release merge-class QA
             → Warwick's consequential merge/release decision
```

**The distinctions are mandatory, in Warwick's own framing:**

- **VERITAS is INTERNAL assurance. CODEX is independent, different-model, EXTERNAL PR/release QA.**
- **Veritas does NOT replace Codex.**
- **Warwick's merge authority does NOT replace Codex.** Authority answers whether *he permits* a
  consequential merge. Codex independently answers whether *the actual release state should pass external
  QA.* **One is never a substitute for the other.**
- **A green test suite replaces NEITHER.**
- **A Work Package that has not met its functional goal is NOT thrown at Codex because its tests are green.**

### The defect this closes — and it is narrow

> **A required Codex release/merge-class gate must NOT disappear merely because work reached an integration
> boundary through a route that happens not to create the usual PR-shaped trigger** — direct lane
> integration, a locally-performed merge, `/reconcile`, or standing merge authority.

**This is a rule about the OBLIGATION, not a new mechanism.** No tracker, no counter, no control plane, no
checker exists to administer it, and building one is the diagnosis Warwick has already rejected.

### The canonical route, established by execution 2026-08-14 — never re-derived from memory

| | |
|---|---|
| **Reviewer-facing law** | `services/control-plane/review/prompts/tower-qa-skill.md` (v3, ratified, `governs_live: true`) **+** `reviewer-classification-amendment.md`, delivered together. **This is the single reviewer-facing contract. `CLAUDE.md` is NEVER injected into Codex.** |
| **Bounded manual review** | `services/control-plane/tower-loop/reviewDiff.mjs --repo --base --head --claim <claim.json>` — **refuses without a real claim.** This is the route `CLAUDE.md` already names. |
| **PR merge-class route** | `services/control-plane/tower-loop/mergeCheck.mjs` and `tower-loop/watcher.mjs` |
| **⚠️ NOT the route** | `services/control-plane/tower/merge-check.mjs` — live-capable, loads **no ratified contract**, builds its own inline prompt, and uses a **different verdict vocabulary**. It is outside the contract's own declared scope list. **Never invoke it for an assurance gate.** Recorded as a finding for Warwick; not this build's to repair. |
| **Verdicts** | `APPROVE · CORRECTIONS_REQUIRED · DECISION_REQUIRED · BLOCKED` — Codex returns a **technical** verdict; Warwick retains merge and final acceptance |
| **Budget** | **Three executions per gate, never a fourth** — initial, one after genuine `BLOCKS_CURRENT_MERGE` corrections, one final confirmation |
| **Authority to run** | **Warwick's explicit authority is required before any Codex run.** Unchanged. |

**What Codex confirms about Veritas receipts** (contract §4, quoted not paraphrased): that the applicable
committed receipt **exists**, that its verdict is **PASS**, that its **assured scope actually covers the
thing being closed**, and that **no later material in-scope change invalidated it** without a newer
applicable PASS. A missing, non-PASS, scope-mismatched or superseded receipt behind a closure claim is an
active `BLOCKS_CURRENT_MERGE` finding.

> ✅ **SETTLED BY WARWICK, 2026-08-15. The question is closed and must not be reopened.** He was shown the
> diff in which he himself removed the `reviewed_sha` sub-check on 2026-08-07, and ruled:
>
> > *"The reviewed_sha decision is settled: retain the current scope-not-SHA model. reviewed_sha is
> > provenance; assurance remains valid where its scope covers the claimed outcome and no later material
> > in-scope change invalidates it. Do not restore exact SHA equality."*
>
> **The contract was never modified and needs no change.** Four receipt properties bind — exists · PASS ·
> covers the claimed scope · not invalidated by later material in-scope change — and **SHA equality is
> explicitly NOT a fifth.**

### Enforcement, stated honestly

**None of this is mechanically enforced, and no reply may imply otherwise.** Measured 2026-08-14: the Tower
watcher is running and polling, but its **only** automatic trigger requires an **open PR carrying a
hand-written `@tower … head:` comment**; there is **no branch protection on `main`**; no workflow, git hook
or scheduled task notices work that reaches `main` without a PR; and the session-side ingest hook writes to
a store the watcher does not read. **Nine days of continuous operation produced zero review events.** The
obligation above therefore rests on discipline — which is exactly why it is written on the map a fresh
Larry is required to open, rather than left in his head.

### Applied to this build, concretely

- **WP-1 (Phase 1) may not be reported complete, closed or merge-ready on a green suite.** The route is:
  the three-route Content Seed goal **actually demonstrated** → **Veritas Gate 1** on the integrated
  outcome → **Codex external QA** on the consequential PR/release state → **Warwick's merge decision**.
- **PR #105 stays DRAFT and UNMERGED until that route is satisfied** (Warwick, 2026-08-14).
- **Every later phase boundary inherits this**, and a phase marked **PASS** additionally requires the
  Veritas receipt the §Wayfinder rules already demand.
- **If the answer to a review problem is to build something, the diagnosis was rejected.** Same rule as everywhere else in this file; it simply gets broken here most often, because review feels like governance and governance is the thing this estate grows when it is anxious.

---

## 10. Execution route

| Phase | Outcome | Gate / evidence | Model |
|---|---|---|---|
| **0** | Promotion + this map | Warwick accepts the plan | **Opus-high** + Warwick decision |
| **1** | **Seed intake + durable Content Seed store.** All three routes. Stable content identity, versioning, immutable snapshots, provenance, privacy state. | A seed from each route lands durably; kill mid-intake and recover; identity survives restart | **Opus-high** — identity and durable state are inherited by everything downstream |
| **2** | **Source Compiler.** Deterministic acquisition, dedupe, chronology, bounded evidence packs. | A real seed produces a bounded, provenance-complete evidence pack; a connector failure cannot alter an existing run | **Opus-high** for the snapshot/integrity design; **routine** for adapters |
| **3** | **Scribe + Master Story Package.** Versioned capability contract. Story question → beats → master narrative → script + blog + titles + thumbnail direction + derivatives. | A package a human recognises as Warwick's voice; siblings provably derived from one truth | **Opus-high** — this is the product's creative core |
| **4** | **Verification.** Independent fact, quotation, privacy, rights, cross-format consistency. Must be able to BLOCK. **Reviews from SOURCE — §9.1 rung 1.** | Made to fail: a planted factual error, a private detail and a rights gap are each caught and each block | **Opus-high** + **independent review (Codex)** |
| **5** | **Cockpit + the single approval.** Six views, the normal actions, durable approval state. **The approval is taken on §9.1 rungs 1 and 2 together — source plus a rendered non-production view. Production is downstream of it, never inside it.** | Warwick approves once from the Cockpit and production proceeds unattended | **Mixed** — Felix + Vera for UI; senior for approval-state design |
| **6** | **Durable production orchestration.** HeyGen jobs, callbacks/polling, retries, asset versions, idempotency, recovery. | Duplicate submission harmless; killed mid-render recovers; no double-charge | **Opus-high** + **Warwick spend gate** |
| **7** | **Publication Package + the real end-to-end journey**, through BUILD-019's adapters. **Publishes only what passed both review rungs — §9.1 rung 3.** | The eleven acceptance criteria in §9 | **Opus-high** + **Warwick decisions throughout** |

**Do not default to the most expensive model.** Adapters, Cockpit build-out and routine wiring are ordinary implementation. Opus-high is for durable identity (1), snapshot integrity (2), the creative contract (3), verification (4) and orchestration/recovery (6).

### Phase-boundary reporting — standing, not on request

**At every phase boundary the report to Warwick states, in this order:**

1. **phase outcome and evidence** (an artefact or command output, not a summary);
2. **PASS, PARTIAL or FAILED**;
3. **the next phase**;
4. **the model recommended for that next phase**;
5. **any genuine Warwick gate.**

**It must not depend on Warwick remembering to ask** — a reporting habit that lives only in Larry's attention has no failure signal, and its silence reads exactly like health.

---

## 11. Larry's authorities on this build

**Decided without Warwick:** application architecture and module separation · durable store choice and schema · the Content Seed and Master Story Package schemas · Source Compiler implementation · Scribe's contract shape and versioning mechanism · verification implementation · Cockpit routes and components · orchestration, retry, idempotency and recovery design · testing and CI approach · worker/specialist allocation · technical sequencing and parallelisation · corrections to this plan · synthetic fixtures for proofs.

**Warwick gates:** accepting this plan · **any spend, including the first HeyGen render** · creative approval of any Master Story Package · publishing anything to a public surface · using his likeness or voice outside an approved proof · changing the channel identity, premise or brand names · publishing customer, employer, family or private material · the final merge and public launch.

**If one path waits on Warwick, all safe independent work continues.**

---

## 12. Non-goals for BUILD-006

Do **not**: build the website or touch domains (BUILD-019) · build YouTube or X **adapters** (BUILD-019) · build ScoutAIR or any continuous discovery · make ObsidiWikAi a prerequisite · build a CRM · automate replies, DMs or outreach · create additional channels or accounts · buy premium services without a spend gate · build a generic agent framework · **grow a governance layer around this build** (the BUILD-018 failure) · replace Scribe with a one-off drafting agent.

---

## 13. Superseded execution guidance — DO NOT FOLLOW

**`Deliverables/2026-08-01-vlogops-wayfinder-plan.md` is SUPERSEDED as execution guidance.** It records the 2026-08-01 *"draft one script and see what happens"* planning trial. That approach predates the Foundry boundary decision of 2026-08-02 and the accepted goal contract, and it plans a manual scripting exercise rather than the durable engine this build is.

**It is retained, not deleted** — it holds real thinking and the record of how the approach changed. **A fresh Larry finding it must treat it as history, and this map as the route.**

Likewise **superseded**: the ClickUp `06 — Converged Brief` and `07A — Historical Proposed Build Plan`, both already marked superseded in the source record.

---

## 14. Where this map stops

It maps **outcomes, dependencies, interfaces and evidence**. It deliberately does not prescribe files, components or a build order inside a phase — those are Larry's, and pre-deciding them is how a plan becomes an IKEA manual that reality invalidates on day one.

It is a **hypothesis about route, not law**. It gets corrected at phase boundaries with evidence, in the open.

---

## Phase status (durable — update ONLY at a phase boundary: PASS / PARTIAL / FAILED + evidence)

| Phase | Status | Model | Evidence |
|---|---|---|---|
| 0 — Promotion + Wayfinder map | ✅ **PASS** — **Warwick accepted in substance, 2026-08-03** | Opus-high + Warwick | This map; `Builds/BUILD-006-vlogops-publishing-engine/SOURCE-foundry-boundary-decision-2026-08-02.md` staged from Drive `1TxdOJKCY3IRVNyncc1gRGOhW2Qv5F2S2`; START/RESUME block proven byte-identical (927 bytes, sha256 `2c615931…dc4c51`, `diff` exit 0, mutation-tested exit 1); Pax findings F1–F5 absorbed into §6 |
| 1 — Seed intake + Content Seed store | 🔵 **IMPLEMENTED · VERITAS GATE 1 PASS (all ten ACs) · NOT YET PASS AS A PHASE.** Row re-cut 2026-08-15 — it read "NOT STARTED — THE FRONTIER" while three other sections of this same map recorded Phase 1 active at PR #105. Caught by Veritas (D-3), not by its author. **Phase PASS is withheld deliberately: the store is Supabase by Warwick's decision and migration 001 has never been applied to the live project, so this is capability completely proven, not yet the human outcome.** | **Opus-high** | `Builds/BUILD-006-vlogops-publishing-engine/Assurance/veritas-wp-1-c35e4f9.md` · PR #105 (draft) · `services/vlogops/DEMONSTRATION.md` · CI `31852566925` green at the reviewed head, POSIX SIGKILL delivered, 45 executed subtests |
| 2 — Source Compiler | 🔵 **IMPLEMENTED · VERITAS GATE 1 PASS (all nine ACs) · NOT YET PASS AS A PHASE** — same reason as Phase 1: migration 002 has never been applied to the live project. | Opus-high / routine | `Builds/BUILD-006-vlogops-publishing-engine/Assurance/veritas-wp-2-86e498d.md` · PR #107 (draft, based on Phase 1's branch) · commit `86e498d9` · CI green, **71 executed subtests** |
| 3 — Scribe + Master Story Package | 🔵 **IMPLEMENTED · VERITAS GATE 1 PASS (all nine ACs) — BUT ONLY HALF THE GATE.** Traceability is enforced by foreign keys: an uncited sibling, or one asserting what its master does not, is UNWRITABLE — confirmed by the reviewer WRITING the attacks, with positive controls proving the constraints discriminate rather than merely refuse. ⚠️ **The voice half — *"a package a human recognises as Warwick's voice"* — is UNGRADED and ungradeable here: no model has ever been called, every word is `deterministic-stub-v1`. It remains entirely open at Phase 5. Reading this PASS as covering it is reading it wrongly.** | Opus-high | `…/Assurance/veritas-wp-3-1a6ba97.md` · PR #109 (draft) · `1a6ba978` · CI green, **122 executed subtests** · the committed sample reproduced BYTE-IDENTICALLY on the reviewer's own cluster |
| 4 — Verification | 🔵 **IMPLEMENTED — awaiting assurance.** Three planted defects (factual error, private detail, rights gap) each caught and each blocking, with only the planted dimension objecting in every case; a clean package passes and advances. Blocking is a durable state surviving process AND database restart. | Opus-high + Codex | PR #110 (draft, based on Phase 3's branch) · commit `594d976a` · CI green, **178 executed subtests** |
| 5 — Cockpit + single approval | ⬜ NOT STARTED | Mixed | — |
| 6 — Production orchestration | ⬜ BLOCKED (F1 spend) | Opus-high + Warwick | — |
| 7 — Publication Package + end-to-end | ⬜ BLOCKED (F1, F2, BUILD-019 Phase 4) | Opus-high + Warwick | — |

---

## Programme position — where BUILD-019 sits

**BUILD-019 is paused after Phase 3, deliberately.** Its Phase 4 (publication contract + website adapter) was specified against a *synthetic fixture*. Warwick's ruling of 2026-08-03 changed the order so that Phase 4 resumes with **a real producer and a real package** behind it.

- **BUILD-019 resumes at Phase 4**, after BUILD-006 produces a real Publication Package.
- **Model for BUILD-019 Phase 4: Opus-high, with mandatory independent review** — it is the interface VlogOps inherits and the expensive thing to get wrong.
- **BUILD-019's map:** `Deliverables/2026-08-02-build-019-public-platform-wayfinder-plan.md`.

---

## Source authority for this build

1. Warwick's explicit current instruction
2. **This Wayfinder map** — the durable implementation and orientation record
3. **`Builds/BUILD-006-vlogops-publishing-engine/SOURCE-foundry-boundary-decision-2026-08-02.md`** — mirrored from Google Drive `1TxdOJKCY3IRVNyncc1gRGOhW2Qv5F2S2`. **Drive is canonical; if the mirror and Drive disagree, Drive wins and the mirror is the defect.**
4. `Deliverables/2026-08-02-build-019-public-platform-wayfinder-plan.md` — the destination build and the contract counterparty
5. Pax research findings, absorbed into §6 as they land

**Handling rule:** **ClickUp is NOT durable memory and NOT a reliable authority** (Warwick, 2026-08-03 — the source record itself documents an incomplete write). **Drive is the canonical human-readable source. Git is the durable machine-operational record** — this map, the staged source, code, tests and evidence.
