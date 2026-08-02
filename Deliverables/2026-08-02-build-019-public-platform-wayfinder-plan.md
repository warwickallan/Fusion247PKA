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

---

## 🔻 STATUS — Phase 0 COMPLETE (promotion + map). Phase 1 is the frontier.

| | |
|---|---|
| **Build** | BUILD-019 — Fusion247 Public Platform |
| **Promoted from** | IDEA-019 (Foundry), on Warwick's explicit instruction 2026-08-02 |
| **Promoted at** | Fusion247PKA `7163a32` (`origin/main`) |
| **Branch** | `build-019-public-platform-wayfinder` |
| **Current phase** | Phase 0 — promotion and mapping: **COMPLETE** |
| **Current gate** | Warwick's acceptance of this plan (`product-decision`) |
| **Exact next action** | On acceptance: begin **Phase 1 — website skeleton in the existing `warwickallan/fusion247-web` repo**. Nothing external, nothing paid, no account touched. |

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
| YouTube channel | creation started; identity review pending, ≤24h | **NOT VERIFIED — no session access** | 🔴 **FOG F1** |
| X `@Fusion247AI` | account created | **NOT VERIFIED — no session access** | 🔴 **FOG F2** |
| X developer app | planned, not proven | **NOT VERIFIED** | 🔴 **FOG F2** |
| HeyGen account/plan/avatar | needs verification | **NOT VERIFIED** | 🔴 **FOG F3** |
| BUILD-019 / IDEA-019 in this repo | — | **zero references** before this branch | ✅ nothing previously promoted |

**Conclusion: the recorded baseline is accurate everywhere it could be checked.** Domains, DNS, repository and Vercel project are real and correctly configured. **Do not recreate any of them.** The remaining unknowns are all *external accounts Larry cannot see from here*, which is precisely the human-dependency column.

---

## 6. FOG — what is genuinely unresolved

Fog is what this map exists to resolve. Each item states what is unknown, why it matters, how it gets resolved, and what may proceed while it is open.

### 🔴 F1 — YouTube channel state

**Unknown:** whether the `Human in the Poop` identity review cleared, whether the channel exists and is manageable, which handle was granted (`@humaninthepoop` or a name-preserving fallback), and whether phone verification is done (needed for long uploads, custom thumbnails, live).
**Why it matters:** the video destination is one third of the North Star. It also carries a **duplication hazard** — the recorded instruction was *do not retry, do not create duplicate channels, do not open another Google account while the review is pending*.
**Resolution:** Warwick reports the current status once. **Larry must not restart setup blindly.**
**While open:** everything in Phases 1–3 proceeds.

### 🔴 F2 — X account and developer integration

**Unknown:** account access/2FA/recovery state; whether the developer app exists; whether OAuth 2.0 flow completes; whether the *hosted* X MCP can create ordinary posts at all.
**Why it matters:** the recorded architecture says the **direct X API is the durable production boundary**, and explicitly that the hosted MCP documentation *does not list ordinary post creation*, so it must not be assumed to satisfy the publishing path. Browser automation is an emergency manual fallback only.
**Resolution:** verify against **current official X documentation at implementation time** — all endpoints, scopes, pricing and product-plan assumptions in the source pack are explicitly implementation-time verification items and can change.
**While open:** Phases 1–3 proceed; the X adapter is designed against the receipt contract with a manual fallback.

### 🔴 F3 — HeyGen entitlement

**Unknown:** current account/plan, API entitlement, avatar and voice rights, synthetic-media disclosure obligations, cost for a short proof *and* for later 9–12 minute content, retention/deletion controls, callback/polling and download behaviour.
**Why it matters:** it gates the media proof and carries **spend**, which is a Warwick gate.
**Resolution:** preflight the live account before any render. Cost-controlled short intro only.
**While open:** everything else proceeds. A media proof is late-phase by design.

### 🔴 F4 — Secrets location is outside the governed boundary *(the one that actually blocks a worker)*

**The contradiction, stated exactly:** Brand doc §18 records the X developer credentials at

```
C:\fusion247\.env keys\X Fusion247 Public Platform.env.txt
```

`GL-012-secrets-store-access-boundary` governs `C:\.fusion247\**` — **a different root** (leading dot) — is deny-by-default, and permits exactly one shape: `C:\.fusion247\private\<project>\**`. The recorded path is neither that root nor that shape.

GL-012 rule 3 forbids inferring a surface from context, and rule 2 makes `private_surface` a **mandatory** field on every Work Order. So **any Work Order touching X publishing returns `REFUSE` at read-back until this is declared.** That is correct behaviour, not an obstacle to route around.

**Larry has not touched, listed or probed that path.**

**Resolution — a genuine Warwick decision, two clean options:**
- **(a)** Warwick confirms `C:\fusion247\.env keys\**` as an explicitly declared private surface for BUILD-019, and it is written into GL-012 as a named exception; or
- **(b)** the file moves under `C:\.fusion247\private\fusion247-web\`, which needs no rule change and matches every other private surface on this machine.
**Recommended: (b)** — it removes the exception rather than documenting one, and the existing runtime already resolves that root (`--env-file=C:/.fusion247/*.env` is how every live service on this machine is started).
**Note also:** the `.env.txt` extension is *deliberate Warwick naming convention*, not a mistake. It must be used as found and **not renamed**.
**While open:** everything except X credential wiring proceeds.

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
| **YouTube review status + channel handle** | **Warwick** | **PENDING (F1)** | Phase 4 | Channel visible and manageable in Studio; handle recorded | Phases 1–3 in full | **Ask once.** Do not retry or duplicate. |
| YouTube phone verification / permissions | Warwick | Unknown | Phase 4 (long upload, custom thumbnail, API) | Studio shows verified status and ownership | Adapter built against contract + manual fallback | With F1, one ask |
| **Secrets surface declaration (F4)** | **Warwick** | **UNRESOLVED — blocks at read-back** | Phase 5 (X wiring) | A declared `private_surface` a Work Order can name | Everything except X credential wiring | **Ask once, with the two options** |
| X `@Fusion247AI` account access | Warwick | Created; access/2FA/recovery unverified | Phase 5 | Login + 2FA + recovery confirmed | Adapter + fixtures | With F2 |
| X developer app / OAuth | Warwick + Larry | Planned, not proven | Phase 5 | App configured to current official docs; token flow completes | Adapter against receipt contract | On spend or scope surprise |
| **HeyGen account / avatar / voice / plan** | **Warwick** | **Needs verification (F3)** | Phase 6 | Authorised avatar+voice, plan and API entitlement proven; cost known | All prior phases | **Before any spend** |
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

| Phase | Outcome | Gate / evidence | Blocked by |
|---|---|---|---|
| **0** | Promotion + this map | ✅ Complete; Warwick accepts the plan | — |
| **1** | **Website skeleton live.** Next.js + TypeScript + Tailwind initialised in the existing repo; CI; the 404 becomes a real page at the canonical domain. | Canonical domain returns **200** with real content; CI green on the exact head SHA | Nothing |
| **2** | **Full information architecture + content model.** All top-level routes, the ShAits and GAiggles area, the Human in the Poop landing/archive, MDX content pipeline, stable URLs. | Every route in §2 renders; content is portable and rebuildable from source | Nothing |
| **3** | **Deployment behaviour understood and documented.** Preview vs production, branch behaviour, rollback, and the operations runbook. | Documented + demonstrated preview→production promotion and a rollback | Nothing |
| **4** | **Publication contract + website adapter.** Accepts a versioned Publication Package, publishes an article deterministically, returns a receipt. Idempotency and reconciliation proven against **synthetic fixtures**. | Duplicate submission proven harmless; restart mid-publish recovers | Nothing — fixtures, not VlogOps |
| **5** | **YouTube adapter + channel configuration.** | Channel owned/recoverable; upload path proven (Private); receipt stored | **F1** (Warwick) |
| **6** | **X adapter.** Developer app to current official docs, least-privilege scopes, human-approved publish, receipt. | One approved post published; receipt durable; no credential exposure | **F2 + F4** (Warwick) |
| **7** | **Media proof + launch.** Cost-controlled HeyGen intro → YouTube (Private) with disclosure → companion article → approved X post → receipts for all three. | The three publication outputs from one approved package | **F3** + `merge-decision` + public launch approval |

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

### The watcher — 🟠 **RUNNING AND CONFIGURED; NOT PROVEN END-TO-END ON THIS BUILD**

- `bin\tower-watch.js` is running as **PID 38820**, started **2026-08-02 05:26:20**, ~14h uptime, **68.6s CPU accrued** (so it is polling, not parked), `Responding: True`.
- It reads its configuration from the same store `preflight.js` just proved READY, and it is cross-build by construction — keyed on `build_id`/`wp_id`/`brief_ref`, so it serves any build rather than one.

**What is NOT proven:** that it picks up and answers a `[LARRY → TOWER]` checkpoint **for BUILD-019 specifically**. That requires a PR thread with a real checkpoint on it, which did not exist until this branch. **Process liveness is not the same claim as loop liveness**, and I will not report the stronger claim from the weaker evidence.

**How it closes:** the first Phase 1 review posts a real checkpoint to the BUILD-019 PR. If the watcher answers, this row becomes ✅ with the reply as evidence. If it does not, that is a blocker to raise before Phase 1 closes — **not** something to discover at Phase 7.

**Honest verdict on readiness overall: 2 of 3 proven LIVE AND CONNECTED; the watcher is proven ALIVE but not proven WIRED TO THIS BUILD.** Under the standing rule that a recorded limit must move the verdict, this build is **ready to execute Phase 1**, and is **not** yet certified for unattended review-loop operation.

---

## 13. Non-goals for BUILD-019

Do **not**: build VlogOps · implement Scribe or the Master Story Package creator · ingest Flight Recorder / ClickUp / GitHub evidence automatically · build ScoutAIR or monitor X continuously · discover consultancy leads · automate DMs, replies or pitches · create multiple websites · create separate X accounts per channel · create additional YouTube channels · buy premium domains, advertising or X Premium · build a CRM · build a custom CMS unless MDX/Git provably fails · optimise analytics before basic publication works · migrate existing Fusion247 knowledge into public content · publish private/restricted material · make autonomous public editorial decisions.

---

## 14. Where this map stops

It maps **outcomes, dependencies, interfaces and evidence**. It deliberately does not prescribe files, components or a build order inside a phase — those are Larry's, and pre-deciding them is how a plan becomes an IKEA manual that reality invalidates on day one.

It is a **hypothesis about route, not law**. It gets corrected at phase boundaries with evidence, in the open.

---

## Phase status (durable — the tracker; update ONLY at a phase boundary: PASS / PARTIAL / FAILED + evidence)

| Phase | Status | Evidence |
|---|---|---|
| 0 — Promotion + Wayfinder map | ✅ **PASS** | This map @ `build-019-public-platform-wayfinder`; `Builds/BUILD-019-fusion247-public-platform/`; live recon §5 |
| 1 — Website skeleton live | ⬜ NOT STARTED | — |
| 2 — Information architecture + content model | ⬜ NOT STARTED | — |
| 3 — Deployment behaviour + runbook | ⬜ NOT STARTED | — |
| 4 — Publication contract + website adapter | ⬜ NOT STARTED | — |
| 5 — YouTube adapter | ⬜ BLOCKED (F1) | — |
| 6 — X adapter | ⬜ BLOCKED (F2, F4) | — |
| 7 — Media proof + launch | ⬜ BLOCKED (F3, launch approval) | — |

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
