# Wayfinder plan — BUILD-019 Fusion247 Public Platform

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

> **Verbatim proof, executed 2026-08-02 — not asserted.** Both blocks extracted (lines 3–13 of each file), line endings normalised, compared:
> `927` bytes each · SHA-256 **`2c615931a799ce099072510e83a977b9324c7d74319b1884b3967be9b1dc4c51`** for both · `diff` exit 0.
> The comparison was then **mutation-tested** — appending a single byte made `diff` report a difference — so the identical result is a real match and not a control that always passes.
> **To re-verify after any edit to either file:**
> `diff <(sed -n '3,13p' Deliverables/2026-08-02-wayfinder-operating-reset-plan.md | tr -d '\r') <(sed -n '3,13p' Deliverables/2026-08-02-build-019-public-platform-wayfinder-plan.md | tr -d '\r')`

## SHIT TO DO — parked tangents (Warwick's rule, 2026-08-02)

**THE RULE.** When Warwick drags Larry off-plan mid-build — and he will, and he knows he does — **the tangent gets written here and the plan continues.** Larry names the current focus, parks the item, and tells him to be patient. They get worked at the **end**, not the moment they are mentioned.

This is not Larry being unhelpful. An interrupted build is how BUILD-018 happened: a request amplified into maintenance, then into a programme. The cost of a tangent is never the tangent, it is the loss of the thread. **Warwick has explicitly asked to be told to wait** — so doing it is compliance, not insubordination.

| # | Parked item | Why it is not now |
|---|---|---|
| 1 | **`Builds/INDEX.md` says BUILD-002's live proof is "pending"** — it passed 2026-07-17. Noticed during the BUILD-019 promotion, unrelated to it. Also `BUILD-010-fusion-tower/` exists on disk but has no INDEX row. | Record tidy-up, not BUILD-019 |
| 2 | **`main` on `warwickallan/fusion247-web` has no branch protection** (verified: `gh api .../branches/main/protection` → 404 "Branch not protected"). Not a defect today — the repo is empty and Larry is the only committer. Becomes real once the site is live and Vercel auto-deploys `main` to the canonical domain. | Decide at Phase 3, when `main` starts deploying real content |
| 3 | **Honcho `listMessages` pagination** returns ≤50 even at `size:500`; a session over 50 packets can surface a stale packet via `readLatest`. Carried over from the operating reset, still open. Recovery holds because the packet carries this map's path and the map is authority. | Known follow-up, inherited, not a BUILD-019 gate |
| 4 | 🟠 **THE WATCHER CANNOT BE REACHED FROM A PR — unattended review-loop operation is NOT CERTIFIED.** Bounded proof attempted on PR #90 and failed for an architectural reason: `tower-watch.js:113` watches a **ClickUp control task** (`TOWER_CLICKUP_TASK_ID`) and `checkpoint.js` says *"two blocks travel through one ClickUp comment thread"*; GitHub is evidence only, never input. The task id is not in this session's environment, the durable state file does not record it, and the only baton thread in the workspace is **`869e6859d`, CLOSED historical BUILD-010 dev proof** (last touched 2026-07-21). The watcher itself is alive (PID 38820, 14h, 68.6s CPU) and has real historical verdicts in `tower-baton-state.json`. **This is the operating-reset's parked row 19 (PR ⇄ Tower seam), not a new fault.** Next sensible action, when Warwick authorises it: either build the row-19 ingest so a PR comment becomes a checkpoint, or stand up a live BUILD-019 ClickUp control thread and export `TOWER_CLICKUP_TASK_ID` where the watcher can see it. **Neither is authorised now.** | **Manual review route (`reviewDiff.mjs --claim`) is proven and sufficient. The watcher is not to become a programme before the website exists.** |
| 5 | 🟠 **The footer goes BLIND mid-turn because nothing re-samples during a long working turn.** Fixed tonight: the STALE rung now carries the true token count, so Warwick sees `ctx 258.9k · BLIND` instead of `ctx --`. **The deeper cause is untouched** — the transcript sample is written on a hook, `STALE_AFTER_MS` is 20 minutes, so any turn longer than that renders a count that is true-as-of-sample-time with **no staleness marker in the line**. Warwick cannot tell a 30-second-old count from a 25-minute-old one. Next sensible action: either re-sample at render time from the transcript, or surface age in the line. The latter changes the frozen byte grammar in `footer.mjs`, so it is a deliberate decision, not a tweak. | Honest and useful now; **no further Governor expansion is authorised** (Warwick, beyond WO-OR-25) |

---

## 🔻 STATUS — Phase 0 COMPLETE (promotion + map). Phase 1 is the frontier.

| | |
|---|---|
| **Build** | BUILD-019 — Fusion247 Public Platform |
| **Promoted from** | IDEA-019 (Foundry), on Warwick's explicit instruction 2026-08-02 |
| **Promoted at** | Fusion247PKA `7163a32` (`origin/main`) |
| **Branch** | `build-019-public-platform-wayfinder` |
| **Current phase** | Phase 0 — promotion and mapping: **COMPLETE**. Plan **ACCEPTED IN SUBSTANCE by Warwick, 2026-08-02**, with five bounded corrections since applied. |
| **Current gate** | None outstanding. Phase 1 is authorised. |
| **Exact next action** | **Phase 1 — website skeleton in the EXISTING `warwickallan/fusion247-web` repo and EXISTING `fusion247-web` Vercel project.** Initialise Next.js + TypeScript + Tailwind, add CI, and turn the canonical-domain 404 into a real page. Nothing external, nothing paid, no account touched. |
| **Model for Phase 1** | **Routine implementation / lower-cost model** — bounded Work Order to Keel. Not Opus-high; the stack and the target are both settled. |
| **Review route** | **Manual: `reviewDiff.mjs --claim`, claim derived from the Phase 1 gate, inside the three-execution Codex budget.** The watcher cannot be reached from a PR — SHIT TO DO #4. |

**No implementation has begun.** This map and the promotion record are the only artefacts produced so far.

---

## 1. PROGRAMME NORTH STAR (Warwick, 2026-08-02 — verbatim intent)

The destination is a durable Fusion247 content-production and publication system with **three supported Cockpit input methods** at one end:

1. existing records and evidence — the Daily Flight Recorder, session logs, build evidence and other approved durable sources;
2. an output produced by another Fusion247 application and explicitly **promoted** into VlogOps;
3. a seed supplied **directly by Warwick** — free text, a conversation extract, an uploaded document or another supported source.

From those inputs the middle of the process operates through **durable, persistent and repeatable automation**.

> **AI owns the bounded creative and analytical work. The application/runtime owns identity, state, source snapshots, orchestration, versioning, approvals, retries, recovery and receipts.**

Routine production must not depend on Larry or Warwick manually shepherding the process through an interactive session.

Warwick approves the developed creative package. The approved content then produces **three correctly adapted publication outputs**:

1. a properly formatted **written article** for the Fusion247 website;
2. a properly formatted **video** for the Human in the Poop YouTube channel;
3. a properly formatted **X/Twitter publication package** for the Fusion247 account.

All three are derived from **one approved creative truth**, adapted appropriately per medium — never three unrelated drafts.

### BUILD-019's share of that North Star

BUILD-019 owns the **Public Platform and destination side**. It preserves the agreed boundary with VlogOps and ScoutAIR rather than absorbing their internals, while **fully mapping every interface and dependency** required to reach the programme North Star.

Concretely, BUILD-019 is finished when the three publication outputs above can be produced **on demand from a versioned Publication Package**, with durable receipts, whoever or whatever supplies that package — VlogOps later, a synthetic fixture today.

---

## 2. Product and brand architecture

Four names, routinely confused, and the confusion is load-bearing — getting it wrong produces the wrong site:

| Thing | What it is | What it is NOT |
|---|---|---|
| **Fusion247** | The professional business and umbrella **website**. Explains who we are, what we do, services, who they are for, case studies and proof, apps/products, and how an SME makes contact. | Not a channel. Not the fun brand. |
| **ShAits and GAiggles** | A **fun editorial section within the Fusion247 website**. Humorous tech explainers, build stories, AI mishaps, articles and vlogs, plain-English explanations of serious subjects. Tone far stronger and more irreverent than the consulting pages. | **Not a YouTube channel. Not the whole business.** |
| **Human in the Poop** | The **first YouTube channel**, sitting inside the ShAits and GAiggles editorial family. Warwick's life, work and increasingly absurd relationship with AI — builds, mistakes, discoveries, explainers. Premise: *the human remains in the loop, usually while everything around him is going to shit.* | Not the same thing as ShAits and GAiggles. Not the website. |
| **We Made a Thing** | A possible recurring **build-story strand** within the channel. | Not a separate channel or product. |

**Commercial priority:** local and owner-managed SMEs. Homecare technology (older people, care providers) is a *possible future vertical* and **must not shape the first website**.

**Audience:** ordinary working people, not technical experts. Explain real technology without pretending Warwick is an academic computer scientist.

### Website structure (from the Brand doc §5, preserved)

Top level: Home · Services · Who We Help / For SMEs · What We Do · Case Studies / Our Work · Apps and Products · About · Contact · **ShAits and GAiggles**

Inside ShAits and GAiggles: Latest · **Human in the Poop** · Explainers · Build Stories / We Made a Thing · Articles · Videos

Larry may refine navigation and information architecture where UX genuinely improves, but **must preserve the business / editorial-family / video-channel distinction**.

### Tone

- **Fusion247 business pages:** credible, plain-English, useful, lightly humorous, suitable for owner-managed SMEs — *not generic AI consultancy sludge*.
- **ShAits and GAiggles:** personality-led, irreverent, entertaining, technically accurate.

### UX intent — design principles, not component instructions

Derived from the Tom Solid / myICOR reference model, which the Foundry addendum records as a **useful non-authoritative design precedent**. The lesson it carries is that the MVP does not need revolutionary frontend technology — it needs **strong information architecture, narrative flow and reusable content components**.

The site should have these qualities:

- a **strong narrative homepage** rather than a generic brochure;
- clear **visual sections or chapters**, with rhythm and numbering where it helps;
- **confident navigation** — sticky/dropdown where it earns its place;
- useful **cards, selectors and content surfaces**;
- **visible articles and video content**, not buried behind a blog link;
- **dated proof and examples**, and testimonials later when they exist;
- **repeated but appropriate calls to action** — present, not nagging;
- **FAQs where genuinely useful**, expandable;
- a coherent **progression: problem → method → proof → services and products → contact**.

**These are product and experience principles. They are not mandatory components, files or a layout.** Larry retains authority over implementation, and **use the principles, not a clone** — copying myICOR's structure would produce someone else's site wearing Fusion247's name. Where a principle fights the SME audience or the editorial tone, the audience wins.

### X identity

One **Fusion247 umbrella account** for the MVP — not separate accounts for ShAits and GAiggles or Human in the Poop.
Display name `Fusion247` · handle **`@Fusion247AI`** · website `https://www.fusion247.co.uk` when live.
(`@Fusion247UK` was available and rejected: it constrains the umbrella brand geographically.)

---

## 3. Exact BUILD-019 product boundary

### BUILD-019 OWNS

Domains and canonical routing · website repository / Vercel project / deployment · website navigation, templates and public content surfaces · the channel model and landing/archive pages · YouTube channel account ownership, permissions, recovery and its destination adapter · X account ownership, permissions, recovery and its destination adapter · public metadata, thumbnail/media receipt references and feeds · OAuth callback surfaces · secrets integration boundaries · manual fallback, takedown and recovery · **publication receipts and destination reconciliation** · channel-level analytics connectors.

### BUILD-019 DOES NOT OWN

VlogOps source compilation · the Daily Flight Recorder · Scribe or story development · VlogOps creative approval state · continuous X monitoring or discovery · CareerAIR job discovery · ScoutAIR signal classification · consultancy lead lifecycle · autonomous replies, DMs or pitches · Larry's general build orchestration.

### No Website Agent

Website and channel infrastructure is an **application/runtime responsibility, not a personality**. Specialist AI may assist with copy, visuals, QA and analysis. **Deterministic runtime owns deployment, credentials, publication state and receipts.** (Foundry addendum, explicit: *"do not create a 'Website Agent' as a substitute for a proper public-platform build."*)

### The MVP boundary that stops scope creep

BUILD-019 may prove publication using **manually supplied or synthetic approved packages** before VlogOps exists. It must **not** build Scribe, the Source Compiler, Flight Recorder ingestion or the VlogOps Cockpit merely to prove the destinations.

---

## 4. Interfaces — VlogOps and ScoutAIR

Read as interface authorities, not as scope: Foundry `08 — Scope Reconciliation`, `09 — GOAL CONTRACT — VlogOps`, `10 — Source, Agent & Runtime Architecture`.

**Governing boundary rule (Foundry, binding):**

> Builds split where the durable product state, user outcome and independent acceptance test split. Shared infrastructure is reused through contracts rather than merged into one giant application.

### VlogOps → Public Platform: the **Publication Package** (inbound)

BUILD-019 must accept a versioned package carrying at minimum:

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

The final schema is Larry's decision. The **contract shape** is not.

### Public Platform → VlogOps: the **Publication Receipt** (outbound, per destination)

```text
content_id                 creative_version           destination
external_id                canonical_url              visibility/status
published/scheduled timestamp                         asset/version identifiers
warnings                   latest reconciliation state
retry/failure information  takedown/correction state (where relevant)
```

### Boundary invariants that bind BUILD-019

- **A missing API capability must not cause the system to pretend publication occurred.** Every destination supports an honest manual fallback that preserves the *same* state and receipt contract.
- **A successful API request is not proof until the real destination is verified.**
- External publish operations are **idempotent**; repeating a request cannot create uncontrolled duplicates.
- **ScoutAIR:** BUILD-019 owns the X *account and publishing adapter*. It does **not** own opportunity discovery, listening or Grok interpretation. Neither VlogOps nor Public Platform waits for ScoutAIR.

---

## 5. Confirmed live state vs recorded state

Executed 2026-08-02 ~19:55 UTC from `C:/Fusion247PKA` @ `7163a32`. **Every row below was measured this session, not recalled.**

| Asset | Recorded (Drive, 2026-08-02) | Verified live | Verdict |
|---|---|---|---|
| `warwickallan/fusion247-web` | exists, connected to Vercel, no web app yet, **public** | exists; `public`; default `main`; created `2026-08-02T16:26:38Z`; size 0; sole file `README.md` = `# fusion247-web`; only branch `main` | ✅ **MATCHES** |
| `main` branch protection | not recorded | **404 "Branch not protected"** | ⚠️ **NEW FACT** → SHIT TO DO #2 |
| Vercel project `fusion247-web` | deployment READY, framework null, serves 404 | `https://www.fusion247.co.uk` → **HTTP 404**, `Server: Vercel`, `X-Vercel-Error: NOT_FOUND`, `X-Vercel-Id: lhr1::…` | ✅ **MATCHES** — 404 is Vercel's, so the project is live and connected; the repo is simply empty |
| `fusion247.co.uk` (apex) | 308 → canonical | **308** → `https://www.fusion247.co.uk/` | ✅ MATCHES |
| `fusion247.uk` | 308 → canonical | **308** → `https://www.fusion247.co.uk/` | ✅ MATCHES |
| `www.fusion247.uk` | 308 → canonical (was wrongly Production, corrected) | **308** → `https://www.fusion247.co.uk/` | ✅ MATCHES — correction held |
| `www.fusion247.ai` | 308 → canonical | **308** → `https://www.fusion247.co.uk/` | ✅ MATCHES |
| SSL on canonical | automatic | `Strict-Transport-Security: max-age=63072000` present | ✅ MATCHES |
| YouTube channel | creation started; identity review pending | **Warwick confirms: created as far as currently possible; review STILL PENDING** | 🟠 **F1** — recheck only at Phase 5 or on Warwick's word |
| X `@Fusion247AI` | account created | **Warwick confirms: account ready** | ✅ **CONFIRMED** — not unknown |
| X developer app | planned, not proven | **Warwick confirms: developer setup recorded in the handover** | ✅ **EXISTS** — runtime auth + publish path is what remains (F2) |
| X credential file | recorded at `C:\fusion247\.env keys\` | **that root does not exist**; real path was `C:\.fusion247\.env keys\` — record was missing a leading dot. **Moved to the governed surface** | ✅ **RESOLVED** (F4) |
| HeyGen account/plan/avatar | needs verification | Warwick investigating later tonight | 🟢 **F3** — later dependency, blocks nothing to Phase 6 |
| BUILD-019 / IDEA-019 in this repo | — | **zero references** before this branch | ✅ nothing previously promoted |

**Conclusion: the recorded baseline is accurate everywhere it could be checked.** Domains, DNS, repository and Vercel project are real and correctly configured. **Do not recreate any of them.** The remaining unknowns are all *external accounts Larry cannot see from here*, which is precisely the human-dependency column.

---

## 6. FOG — what is genuinely unresolved

Fog is what this map exists to resolve. Each item states what is unknown, why it matters, how it gets resolved, and what may proceed while it is open.

> **CORRECTED 2026-08-02 on Warwick's answers.** The handover already carried identities, handles and setup detail that the first draft of this section wrongly listed as unknown. **Do not re-ask what is already answered.** F1–F4 below now record the *actual* position; only the genuinely open parts remain fog.

### 🟢 F0 — Website assets: NOT FOG. Proceed in the existing assets

Repository, Vercel project and all domains are **ready and verified** (§5). Build inside them. **Recreate nothing.** This is closed and is recorded here only so a fresh session does not reopen it.

### 🟠 F1 — YouTube: channel started, identity review still pending

**Position (Warwick, 2026-08-02):** `Human in the Poop` creation has been completed **as far as is currently possible**. The YouTube identity review is **still pending**. All intended names and handles are already in the handover — channel `Human in the Poop`, preferred handle `@humaninthepoop`, name-preserving fallbacks `@humaninthepoop247` / `@humaninthepoopai`.

**Standing instruction: do not retry, do not duplicate the channel, do not create another Google account.**

**Still genuinely unknown:** the review outcome, the granted handle, and phone-verification state (which gates long uploads, custom thumbnails and live).

**Resolution:** recheck **only** when Phase 5 genuinely needs it, or when Warwick reports the review has cleared. Not before — a speculative recheck is how a duplicate channel gets created.
**While open:** Phases 1–4 proceed in full.

### 🟠 F2 — X: account and app CONFIRMED; the runtime path is what remains

**Position (Warwick, 2026-08-02): treat account and app existence as CONFIRMED, not unknown.** The Fusion247 account is ready, handle **`@Fusion247AI`**, and the developer setup and its details are recorded in the handover.

**What remains to prove, during the appropriate phase, is narrower than "does X work":**
- the **governed runtime authorization** — the one-time OAuth flow, with tokens held server-side as secrets;
- the **real publish path and its receipt** — a genuine post, a stored `external_id`, `canonical_url`, timestamp and outcome.

**Standing constraints, unchanged:** direct X API is the durable production boundary; the hosted X MCP is an optional operator/research surface whose documentation does **not** list ordinary post creation, so it must not be assumed to satisfy the publishing path; browser automation is emergency manual fallback only; publishing stays human-approved. Endpoints, scopes and pricing remain **implementation-time verification items** against current official documentation.

**No credential value is to be exposed, echoed, logged or reproduced — here or anywhere.**
**While open:** Phases 1–4 proceed.

### 🟢 F3 — HeyGen: a later human dependency, deliberately not now

**Position (Warwick, 2026-08-02):** Warwick will investigate the account, plan, API entitlement, avatar/voice and cost **later tonight**.

**It does not block Phases 1–6.** Keep it as a later human dependency and do not preflight it speculatively. It carries spend, so it stays a gate whenever it does arrive.

### ✅ F4 — Secrets location: RESOLVED AND EXECUTED

**What the contradiction actually was:** Brand doc §18 recorded the credentials at `C:\fusion247\.env keys\…` — a root that **does not exist on this machine**. The real path was `C:\.fusion247\.env keys\…`. **The recorded path was missing its leading dot.** A one-character error in the record, not a boundary breach — the file had been inside the governed root the whole time, just not under `private/<project>/`.

**Warwick selected the governed location.** Executed 2026-08-02:

```
C:\.fusion247\.env keys\X Fusion247 Public Platform.env.txt
      →  C:\.fusion247\private\fusion247-web\X Fusion247 Public Platform.env.txt
```

Verified: **816 bytes before and after**, filename preserved exactly, old location cleared, destination directory created. **The contents were never read, displayed, copied or logged** — only the byte count and modification time were compared.

**The `.env.txt` extension is deliberate Warwick naming convention and must be used as found. Do not "fix" it.**

> ### 📌 DECLARED PRIVATE SURFACE FOR BUILD-019
> ```
> private_surface: C:\.fusion247\private\fusion247-web\**
> ```
> **This is the value every BUILD-019 Work Order touching X credentials must name.** It satisfies GL-012 without an exception: correct root, correct `private/<project>/**` shape. Work Orders that touch nothing private still declare `private_surface: none` — the field is mandatory either way.

### 🟠 F5 — Repository visibility

`warwickallan/fusion247-web` is **public**, contrary to an earlier private-repo recommendation. The source pack says treat this as a known state, not an automatically approved permanent policy, and escalate once before changing if consequences are material.

**Larry's assessment:** public is acceptable and is the safe no-action default for a marketing site — provided no secrets, no customer/employer/family material and no unreleased editorial land in it. The real consequence is that **draft editorial content becomes publicly visible before publication**, which matters once ShAits and GAiggles carries unpublished drafts. **Decision: stays public; unpublished editorial does not live in this repo.** Revisit only if that content model changes.

### 🟠 F6 — Source-precedence inverts recency

The Ingestion Pack ranks itself above the Brand doc, but the Brand doc was **edited later** (19:19 vs 18:48 on 2026-08-02) and its §17–18 exist nowhere else. So the freshest facts sit in the lower-precedence document.

**No live conflict today.** Resolved by adopting the Brand doc's own §17: **Pack = boundary, goal contract, acceptance. Brand doc = live setup state.** Recorded rather than silently resolved, per the Pack's own instruction to record contradictions.

### 🟠 F7 — YouTube ownership: the record contradicts itself

Brand doc **§11** says the channel will be owned through the **PowerLumina/Fusion247 business Google identity**, *"not Warwick's personal-name channel."* Brand doc **§12** and the Pack both record that creation was started from **Warwick's existing personal Google account**, with a future business identity added later as owner/manager.

**Operative fact:** §12 is later and the Pack is higher precedence → *personal Google account owns the separate Brand Account initially; a Fusion247 business identity may be added as an additional owner later without changing the public channel identity.* §11 is superseded but **not deleted** — recorded here so a fresh session does not "correct" the live state back to a stale decision.

---

## 7. Security, permissions, account ownership and recovery

Non-negotiable, drawn from the source pack and GL-012:

**Secrets**
- No secret value in Git, Drive, ClickUp, prompts, screenshots or public CI logs. Ever.
- Credentials live in the approved secrets store; runtime receives them as injected environment variables, never as repository files.
- OAuth user tokens and refresh tokens are created during Larry's one-time authorization flow and **remain server-side secrets**.
- Scanner/preflight evidence is accepted **only for the exact declared surface, and only redacted**.

**Permissions**
- Least privilege. The MVP X app requests **only** `tweet.read`, `tweet.write`, `users.read`, `media.write`, `offline.access`. **No DMs, likes, follows, blocks** or broad account-control scopes.
- YouTube uses **Studio channel permissions, never password sharing**. Agents and automation get the narrowest available permission and never the primary account password.

**Ownership and recovery**
- Warwick remains primary owner of every domain, channel and account.
- A **second trusted owner or recovery route** must exist before the YouTube channel becomes operationally important.
- Account recovery must not depend on one local machine or one AI session.
- Preserve account recovery and second-owner routes wherever the platform offers them.

**Spend**
- Pay-per-use / Production. **No auto-recharge.** Lowest practical spending limit. Stop for Warwick before any unexpected charge. No Premium, no advertising, no premium domains.

**Content and rights**
- Synthetic/altered-media disclosure applied wherever required (YouTube's AI-content disclosure on any realistic HeyGen avatar upload).
- Only authorised Warwick likeness/voice assets.
- Media, music, logos and third-party content require provenance and rights state.
- No customer, employer, family or private personal material on a public surface without explicit authority.

**Defaults that fail safe**
- YouTube uploads default **Private** while automation is being proven.
- Initial publishing is **human-approved**, never autonomous.
- No autonomous replies, DMs, pitches or account-management actions — at all, in this build.

---

## 8. Human dependency matrix

Per Foundry `08.1`, every promoted build carries this. **"While waiting" is the important column** — it is what stops a human gate from stalling the build.

| Dependency | Owner | Recorded state | Needed by | Ready evidence | While waiting | Escalation |
|---|---|---|---|---|---|---|
| GitHub access to `fusion247-web` | Larry | **READY** | Phase 1 | `gh` authenticated as `warwickallan`; repo metadata read live | — | — |
| Vercel project access | Warwick/Larry | Project confirmed live externally; console access unverified | Phase 3 | A deploy from `main` renders the real site at the canonical domain | Phases 1–2 build and test locally | Only if a deploy does not appear |
| Domain / DNS authority | Warwick | **COMPLETE — verified live** | Phase 3 verify | All 6 hostnames resolve as recorded (§5) | — | Only if canonical routing breaks |
| **YouTube review status + channel handle** | **Warwick** | **Created as far as possible; review STILL PENDING (F1)** | Phase 5 | Channel visible and manageable in Studio; granted handle recorded | Phases 1–4 in full | **Recheck only at Phase 5 or on Warwick's word.** Never retry or duplicate. |
| YouTube phone verification / permissions | Warwick | Unknown | Phase 5 (long upload, custom thumbnail, API) | Studio shows verified status and ownership | Adapter built against contract + manual fallback | With F1 |
| **Secrets surface** | Warwick | ✅ **RESOLVED** — `C:\.fusion247\private\fusion247-web\**` declared; file moved and verified | Phase 6 | The declared surface, named in the Work Order | — | None — closed |
| X `@Fusion247AI` account | Warwick | ✅ **CONFIRMED ready** | Phase 6 | Account confirmed by Warwick | — | None |
| X developer app / OAuth | Warwick + Larry | App exists; **governed runtime authorization + publish/receipt path unproven (F2)** | Phase 6 | One-time OAuth completes server-side; a real post returns a durable receipt | Adapter + fixtures against the receipt contract | On spend or scope surprise |
| **HeyGen account / avatar / voice / plan** | **Warwick** | Investigating later tonight (F3) | Phase 7 | Authorised avatar+voice, plan and API entitlement proven; cost known | **Everything through Phase 6** | **Before any spend** |
| Brand visual direction | Warwick | Partial | Phase 2 polish | One approved initial visual direction | Build on GL-003 tokens; Iris can propose | Only if the direction is rejected |
| **Public launch approval** | **Warwick** | **NOT granted by setup alone** | Phase 7 | Explicit launch/publication decision | Everything up to launch | **Hard gate** |
| Any recurring spend | Warwick | Not granted | Any paid step | Explicit approval | Free paths first | **Hard gate** |

---

## 9. Acceptance evidence

BUILD-019 is accepted when **all** of the following are true and evidenced. Numbering follows the source pack §10 so the two can be reconciled.

1. `fusion247-web` contains a working, maintainable website application.
2. The existing Vercel project deploys from the intended branch; preview and production behaviour is understood and documented.
3. `https://www.fusion247.co.uk` serves the real Fusion247 website over SSL. *(Today: 404 — this is the headline change.)*
4. Defensive domains redirect correctly to canonical. *(Already true — §5.)*
5. The site communicates the professional Fusion247 proposition clearly to owner-managed SMEs.
6. ShAits and GAiggles exists as a distinct editorial area within the same website.
7. Human in the Poop has a website landing/archive surface.
8. The Human in the Poop YouTube channel exists, is correctly owned and recoverable, and uses least-privilege permissions.
9. A short authorised HeyGen channel introduction (or equivalent cost-controlled media proof) is uploaded to YouTube with correct visibility and disclosure, and a durable receipt.
10. A companion website item is published and linked coherently.
11. The Fusion247 X account exists as `@Fusion247AI`, is secured, and has a verified human-approved publishing route.
12. A controlled X proof publishes an approved text/media item and stores a durable receipt **without exposing credentials**.
13. **Repeating a publish request cannot create uncontrolled duplicates.**
14. Failure / retry / reconciliation behaviour is observable.
15. Warwick can correct, unpublish or take down an item through a documented route.
16. The platform accepts a **versioned Publication Package** and returns destination receipts **independently of VlogOps implementation**.
17. Build state, evidence and next actions survive context rotation and fresh sessions through Wayfinder/Git.

**Standard of proof.** Criteria 12–15 are *behavioural* and are only met by making them fail: submit the duplicate, kill the process mid-publish, take an item down. A green test that never ran a failure path is not evidence. *(The lesson of `a-control-is-not-evidence-until-made-to-fail`.)*

---

## 10. Execution route

Each phase ends at a real evidence gate. **Phases 1–3 need nothing from Warwick and cost nothing** — that is deliberate, so the human gates never sit on the critical path.

| Phase | Outcome | Gate / evidence | Model / capability required | Blocked by |
|---|---|---|---|---|
| **0** | Promotion + this map | ✅ Complete; Warwick accepts the plan | **Senior reasoning (Opus-high)** + **Warwick decision** — cross-system synthesis and a governance change | — |
| **1** | **Website skeleton live.** Next.js + TypeScript + Tailwind initialised in the existing repo; CI; the 404 becomes a real page at the canonical domain. | Canonical domain returns **200** with real content; CI green on the exact head SHA | **Routine implementation / lower-cost model.** Standard framework scaffolding on a known stack — Keel with a bounded Work Order. No architecture decisions left open. | Nothing |
| **2** | **Full information architecture + content model.** All top-level routes, the ShAits and GAiggles area, the Human in the Poop landing/archive, MDX content pipeline, stable URLs. | Every route in §2 renders; content is portable and rebuildable from source | **Mixed.** Content model and URL/versioning design: **senior reasoning** (they are hard to change later). Route and component build-out: **routine**. Visual/UX pass: Felix + Vera, with Iris on tokens. | Nothing |
| **3** | **Deployment behaviour understood and documented.** Preview vs production, branch behaviour, rollback, and the operations runbook. | Documented + demonstrated preview→production promotion and a rollback | **Routine implementation**, plus **Warwick decision** on branch protection (SHIT TO DO #2) once `main` auto-deploys. | Nothing |
| **4** | **Publication contract + website adapter.** Accepts a versioned Publication Package, publishes an article deterministically, returns a receipt. Idempotency and reconciliation proven against **synthetic fixtures**. | Duplicate submission proven harmless; restart mid-publish recovers | **Senior reasoning (Opus-high)** for the contract, idempotency and reconciliation design — this is the interface VlogOps inherits and the expensive thing to get wrong. **Independent review** before it is called done. | Nothing — fixtures, not VlogOps |
| **5** | **YouTube adapter + channel configuration.** | Channel owned/recoverable; upload path proven (Private); receipt stored | **Routine implementation** for the adapter; **senior reasoning** for ownership/recovery and disclosure design; **Warwick decision** on channel state and any visibility change. | **F1** (Warwick) |
| **6** | **X adapter.** Governed runtime authorization, least-privilege scopes, human-approved publish, receipt. | One approved post published; receipt durable; no credential exposure | **Senior reasoning (Opus-high)** — credential handling and a live external write. **Independent review mandatory** (Codex) before any real post. **Warwick decision** on scopes and spend. | **F2** (Warwick) |
| **7** | **Media proof + launch.** Cost-controlled HeyGen intro → YouTube (Private) with disclosure → companion article → approved X post → receipts for all three. | The three publication outputs from one approved package | **Warwick decision** throughout — spend, likeness/voice, and public launch. Execution itself is **routine**; the judgement is entirely his. | **F3** + `merge-decision` + public launch approval |

**Do not default to the most expensive model.** Phases 1, 3 and most of 2 and 5 are ordinary implementation on a known stack and should be worked by a lower-cost model under a bounded Work Order. Opus-high is reserved for the places where a wrong decision is expensive to reverse: the publication contract (4), credentials and live external writes (6), and cross-system synthesis (0).

### Phase-boundary reporting — standing, not on request

**At every phase boundary the report to Warwick states, in this order:**

1. **phase outcome and evidence** (an artefact or command output, not a summary);
2. **PASS, PARTIAL or FAILED**;
3. **the next phase**;
4. **the model recommended for that next phase**;
5. **any genuine Warwick gate**.

This is part of the normal Wayfinder handback. **It must not depend on Warwick remembering to ask** — a reporting habit that lives only in Larry's attention has no failure signal, and its silence reads exactly like health.

**Sequencing rationale.** The website carries no external dependency and no spend, so it goes first and produces visible value immediately. Adapters are built against the **receipt contract with manual fallbacks**, so a pending account never blocks the code. Anything that costs money or touches a live public surface is last and individually gated.

---

## 11. Larry's authorities on this build

Decided **without** Warwick: website architecture within the existing repo/project · component, route, content and schema design · testing and CI approach · preview/production workflow · styling and responsive detail · whether content is MDX or another portable model · publication adapter implementation · receipt schema · retry/reconciliation design · module separation · worker/specialist allocation · technical sequencing and parallelisation · corrections to this plan · synthetic fixtures for end-to-end proofs · routine fixes required to satisfy the Goal Contract.

> *Prefer competent initiative over asking Warwick to choose implementation details.*

**Warwick gates** (escalate before): changing public brand/channel names · buying any service, domain or subscription, or enabling auto-recharge · changing repository visibility where material · creating or deleting public accounts/channels · using Warwick's likeness or voice outside the approved proof · making a private/unlisted item public · **any** X reply, DM, pitch or autonomous engagement · destructive account/domain/DNS changes · publishing customer/employer/family/private information · granting broad account permissions · changing the core audience or commercial proposition · replacing the existing repo/Vercel/domain architecture · final merge and public launch.

**If one path waits on Warwick, all safe independent work continues.**

---

## 12. Supporting capability readiness — live evidence

Warwick required live proof, and that *"a file existing or a previous build having used the capability is not sufficient proof of present readiness."* Each verdict below states what was executed.

### Honcho — ✅ **LIVE AND CONNECTED**

`node tools/governor/continuity.mjs read` executed this session. Returned a fresh packet **`cont-1785699313584-99-992zeh @ 2026-08-02T19:35:13.584Z`**, reading **98 packets over 1 page** — a distinct, later packet than the one the session-start hook read at 19:25:27 (`…-98-p40wb3`, 97 packets). A *new* round-trip against the live service, not a cached file.

### Tower — ✅ **LIVE AND CONNECTED**

Two independent executions:
1. `node services/tower-baton/bin/preflight.js` → **`[TOWER preflight] READY`**, secret store present, `clickupReady: true`, `telegramReady: true`, tokens masked in the output. (Recorded redacted here, per GL-012.)
2. `node services/tower-baton/bin/notify-milestone.js --purpose escalation --handback product-decision` → **`{"sent":true,"messageId":"442"}`** — a real Telegram message delivered to Warwick, with the ⟦GOV⟧ footer rendered by `footer.mjs`. The notification path is not merely configured; it carried traffic this session.

### The watcher — 🟠 **ALIVE, BUT NOT REACHABLE FROM A PR. UNATTENDED REVIEW-LOOP OPERATION IS NOT CERTIFIED.**

One bounded round-trip was attempted on PR #90, as ordered. **It could not be performed, and the reason is architectural rather than a fault.**

**What was executed and observed:**

1. `bin\tower-watch.js` is running — **PID 38820**, started 2026-08-02 05:26:20, ~14h uptime, **68.6s CPU accrued**, `Responding: True`. It is polling, not parked.
2. It has genuinely answered checkpoints before. `C:\.fusion247\tower-baton-state.json` holds real verdicts — e.g. `BUILD-010-ACCEPT-0001` → `verdict: CORRECTIONS_REQUIRED`, with a `reviewed_head` SHA and a `prompt_fingerprint`. **The loop has worked.**
3. **But the watcher does not read GitHub PRs.** `bin/tower-watch.js:113` takes `TOWER_CLICKUP_TASK_ID` and `src/checkpoint.js` states it plainly: *"Two blocks travel through one ClickUp comment thread."* GitHub is used only as **evidence** (branch, head SHA, diff, CI) — never as the input surface. **PR #90 is not a surface the watcher can see.**
4. `TOWER_CLICKUP_TASK_ID` is not present in this session's environment — it lives in the environment of the process launched 14 hours ago — and the durable state file does not record it.
5. Searching ClickUp for the control task returns exactly one baton thread: **`869e6859d` — "[CLOSED — HISTORICAL DEV PROOF] BUILD-010 Baton / ClickUp QA thread"**, status **complete**, last touched 2026-07-21. **There is no live control thread, for BUILD-019 or anything else.**

**This is a previously-recorded gap, not a discovery.** The operating-reset map's SHIT TO DO **row 19** parked exactly this: *"THE MISSING BIDIRECTIONAL SEAM: PR ⇄ Tower. A FEATURE TO BUILD LATER — explicitly NOT during Phase 5."* The instruction to prove the watcher via a PR rests on a seam that was deliberately never built.

**Verdict, stated at the strength the evidence supports:**
- the watcher **detected the BUILD-019 checkpoint** — ❌ **no.** No checkpoint could be posted, because there is no live thread and PR #90 is not an input surface.
- it **responded through the intended review loop** — ❌ **no.**
- it **produced durable evidence referenceable from this Wayfinder** — ❌ **no** for BUILD-019. The only durable evidence is historical, for BUILD-010.

**→ Parked in SHIT TO DO #4. Unattended review-loop operation is NOT CERTIFIED for BUILD-019.**

**The build proceeds using the available manual review route** — `reviewDiff.mjs --claim`, with the claim derived from the phase gate, inside the three-execution Codex budget. That route is proven and needs no watcher. **The watcher is not to become a programme before the website exists.**

**Overall readiness: 2 of 3 proven LIVE AND CONNECTED. Phase 1 is safe to execute; the review loop is manual until row 19 is built, and building it is not authorised now.**

---

## 13. Non-goals for BUILD-019

Do **not**: build VlogOps · implement Scribe or the Master Story Package creator · ingest Flight Recorder / ClickUp / GitHub evidence automatically · build ScoutAIR or monitor X continuously · discover consultancy leads · automate DMs, replies or pitches · create multiple websites · create separate X accounts per channel · create additional YouTube channels · buy premium domains, advertising or X Premium · build a CRM · build a custom CMS unless MDX/Git provably fails · optimise analytics before basic publication works · migrate existing Fusion247 knowledge into public content · publish private/restricted material · make autonomous public editorial decisions.

---

## 14. Where this map stops

It maps **outcomes, dependencies, interfaces and evidence**. It deliberately does not prescribe files, components or a build order inside a phase — those are Larry's, and pre-deciding them is how a plan becomes an IKEA manual that reality invalidates on day one.

It is a **hypothesis about route, not law**. It gets corrected at phase boundaries with evidence, in the open.

---

## Phase status (durable — the tracker; update ONLY at a phase boundary: PASS / PARTIAL / FAILED + evidence)

| Phase | Status | Model for this phase | Evidence |
|---|---|---|---|
| 0 — Promotion + Wayfinder map | ✅ **PASS** | Opus-high + Warwick | This map @ `build-019-public-platform-wayfinder`; `Builds/BUILD-019-fusion247-public-platform/`; live recon §5; Warwick accepted in substance 2026-08-02 |
| 1 — Website skeleton live | ⬜ **NOT STARTED — the frontier** | **Routine / lower-cost** | — |
| 2 — Information architecture + content model | ⬜ NOT STARTED | Mixed (senior for the content model) | — |
| 3 — Deployment behaviour + runbook | ⬜ NOT STARTED | Routine | — |
| 4 — Publication contract + website adapter | ⬜ NOT STARTED | **Opus-high + independent review** | — |
| 5 — YouTube adapter | ⬜ BLOCKED (F1) | Routine + senior for ownership/recovery | — |
| 6 — X adapter | ⬜ BLOCKED (F2) | **Opus-high + mandatory independent review** | — |
| 7 — Media proof + launch | ⬜ BLOCKED (F3, launch approval) | Warwick decision throughout | — |

---

## Source authority for this build

1. Warwick's explicit current instruction
2. **This Wayfinder map** (the durable implementation and orientation record)
3. `IDEA-019 — … Promotion & Wayfinder Ingestion Pack — 2026-08-02.md` — Drive `1sjw87PZMaWSsVUPZetOmrf0xHCQDIU5g` — *boundary, goal contract, acceptance*
4. `Fusion247 Public Platform — Brand, Website & Channel Decisions` — Drive `1-HkjVwLEoOoQddZOa1ETB2nMlJAfDJ2ItHvG27J4EAk` — *live setup state* (per F6)
5. `2026-08-02 — Foundry — VlogOps, Public Platform & ScoutAIR — Durable Backup.md` — Drive `1TxdOJKCY3IRVNyncc1gRGOhW2Qv5F2S2`
6. ClickUp Foundry IDEA-019 root `2kxuxw3a-6652` (pages 00, 01, 02, 05, 06) · Idea task `869ectn03`
7. VlogOps interface authorities — ClickUp `2kxuxw3a-6592` (scope reconciliation), `2kxuxw3a-6612` (Goal Contract), `2kxuxw3a-6632` (source/agent/runtime architecture)
8. Older IDEA-006 / Public Platform notes, where not superseded

**Handling rule:** ClickUp is a control surface, not durable memory. Drive is the human-readable fallback. **Git is the durable machine-operational record** — this map, the build record, code, tests and evidence.
