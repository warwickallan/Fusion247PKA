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

---

## 🔻 STATUS — Phase 0 (promotion + mapping) IN PROGRESS. Phase 1 is the frontier once Warwick accepts this plan.

| | |
|---|---|
| **Build** | BUILD-006 — VlogOps Publishing Engine |
| **Promoted from** | IDEA-006 (Foundry), on Warwick's explicit instruction 2026-08-03 |
| **Programme position** | BUILD-019 Phases 1–3 → **BUILD-006 in full** → BUILD-019 Phase 4 → the real end-to-end acceptance journey. Fixed by Warwick, 2026-08-03. |
| **Current phase** | Phase 0 — promotion and mapping |
| **Current gate** | **Warwick accepts this plan** (`product-decision`). Implementation does not begin before that. |
| **Exact next action** | Warwick reads and accepts or corrects this map. Then **Phase 1 — durable seed intake and the Content Seed store.** |
| **Model for Phase 1** | **Opus-high.** Durable state, identity, provenance and idempotency are the expensive things to get wrong, and everything downstream inherits them. |
| **Depends on BUILD-019** | Only at Phase 7, and only through a **contract** — see §4. BUILD-006 develops against the accepted Publication Package contract without waiting for BUILD-019 Phases 4–7. |

**No implementation has begun.** This map and the staged canonical source are the only artefacts.

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

### Cockpit

Views: **Seeds · Developing · Awaiting Warwick · Production · Published · Problems.**
Actions: add seed · promote to VlogOps · approve · request revision · park · reject · inspect sources/risks · view outputs/receipts.

---

## 6. FOG — genuinely unresolved, with how each resolves

**Pax was dispatched on 2026-08-03 to resolve F1–F5. Findings are absorbed into this section as they land; anything still marked OPEN is genuinely unresolved and must not be guessed at.**

### 🟠 F1 — HeyGen cost and capability for a 9–12 minute render — **OPEN, and it carries spend**

The acceptance criterion names a 9–12 minute video. Unknown: API availability and plan tier · how long-form is billed · realistic cost per render · maximum duration and whether segmenting is required · rate limits · async callbacks vs polling.
**Resolves by:** Pax against current official documentation, then Warwick's account/plan reality (BUILD-019 F3 — he said he would investigate).
**While open:** Phases 1–5 proceed in full. Production orchestration is designed against the contract with a stub renderer.
**Gate:** any real spend is Warwick's, before it happens.

### 🟠 F2 — YouTube Data API upload constraints — **OPEN**

Unknown: quota cost per insert against the daily quota (i.e. real uploads/day) · whether a newly-created, unverified channel can upload via API at all · the AI/synthetic-media disclosure field · what `privacyStatus: private` permits · required OAuth scopes.
**Resolves by:** Pax against official documentation; the channel-specific half only when the identity review clears (SHIT TO DO #4).
**While open:** the adapter is BUILD-019's anyway; BUILD-006 only needs the contract.

### 🟠 F3 — What the Source Compiler can actually read today — **OPEN, and it is Phase 1's dependency**

Intake route 1 names "Flight Recorder / session / build evidence". Unknown: what those artefacts really are in this repository, their format and stability, and whether the Daily Flight Recorder is Git, Drive or ClickUp. **This decides whether the Source Compiler is a file reader or a connector problem** — a materially different build.
**Resolves by:** Pax, from the repository, with paths.
**While open:** Phase 1 designs the seed store and content identity, which are independent of source shape.

### 🟠 F4 — What durable-orchestration machinery already exists to reuse — **OPEN**

The estate has leases, idempotency, retry, outbox and a SQLite store built for the Tower loop (`services/control-plane/tower-loop/`). VlogOps needs the same shapes. **The regrowth cap binds: reuse, do not grow a second framework.**
**Resolves by:** Pax, naming concrete modules and where reuse is forced or awkward.

### 🟠 F5 — ObsidiWikAi's real state as an optional retrieval source — **OPEN**

`Deliverables/BACKLOG.md:41` records the LightRAG→graph pipeline as existing but **not wired into live capture**. A live `brain_search` on 2026-08-03 returned `personal_vault_access: false` — world encyclopedia only, personal vault unreachable.
**Resolves by:** Pax establishing built vs running vs reachable.
**Binding regardless of the answer:** it is one optional source. **It never becomes a prerequisite.**

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
| Accept this Wayfinder | **Warwick** | **PENDING** | Phase 1 | Nothing — this is the gate | `product-decision` |
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

## 10. Execution route

| Phase | Outcome | Gate / evidence | Model |
|---|---|---|---|
| **0** | Promotion + this map | Warwick accepts the plan | **Opus-high** + Warwick decision |
| **1** | **Seed intake + durable Content Seed store.** All three routes. Stable content identity, versioning, immutable snapshots, provenance, privacy state. | A seed from each route lands durably; kill mid-intake and recover; identity survives restart | **Opus-high** — identity and durable state are inherited by everything downstream |
| **2** | **Source Compiler.** Deterministic acquisition, dedupe, chronology, bounded evidence packs. | A real seed produces a bounded, provenance-complete evidence pack; a connector failure cannot alter an existing run | **Opus-high** for the snapshot/integrity design; **routine** for adapters |
| **3** | **Scribe + Master Story Package.** Versioned capability contract. Story question → beats → master narrative → script + blog + titles + thumbnail direction + derivatives. | A package a human recognises as Warwick's voice; siblings provably derived from one truth | **Opus-high** — this is the product's creative core |
| **4** | **Verification.** Independent fact, quotation, privacy, rights, cross-format consistency. Must be able to BLOCK. | Made to fail: a planted factual error, a private detail and a rights gap are each caught and each block | **Opus-high** + **independent review (Codex)** |
| **5** | **Cockpit + the single approval.** Six views, the normal actions, durable approval state. | Warwick approves once from the Cockpit and production proceeds unattended | **Mixed** — Felix + Vera for UI; senior for approval-state design |
| **6** | **Durable production orchestration.** HeyGen jobs, callbacks/polling, retries, asset versions, idempotency, recovery. | Duplicate submission harmless; killed mid-render recovers; no double-charge | **Opus-high** + **Warwick spend gate** |
| **7** | **Publication Package + the real end-to-end journey**, through BUILD-019's adapters. | The eleven acceptance criteria in §9 | **Opus-high** + **Warwick decisions throughout** |

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
| 0 — Promotion + Wayfinder map | 🟠 **IN PROGRESS** — awaiting Warwick's acceptance | Opus-high + Warwick | This map; `Builds/BUILD-006-vlogops-publishing-engine/SOURCE-foundry-boundary-decision-2026-08-02.md` staged from Drive `1TxdOJKCY3IRVNyncc1gRGOhW2Qv5F2S2` |
| 1 — Seed intake + Content Seed store | ⬜ **NOT STARTED — the frontier** | Opus-high | — |
| 2 — Source Compiler | ⬜ NOT STARTED | Opus-high / routine | — |
| 3 — Scribe + Master Story Package | ⬜ NOT STARTED | Opus-high | — |
| 4 — Verification | ⬜ NOT STARTED | Opus-high + Codex | — |
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
