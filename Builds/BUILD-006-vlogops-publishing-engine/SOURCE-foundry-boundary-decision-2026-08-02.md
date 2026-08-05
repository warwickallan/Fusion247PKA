# SOURCE — Foundry Boundary Decision: VlogOps, Public Platform and ScoutAIR

> **PROVENANCE — read this before using anything below.**
>
> - **Canonical location:** Google Drive, file ID `1TxdOJKCY3IRVNyncc1gRGOhW2Qv5F2S2`, title *"2026-08-02 — Foundry — VlogOps, Public Platform & ScoutAIR — Durable Backup.md"*, 19,351 bytes, created 2026-08-02T14:55:21Z, owner `warwickjunior2011@gmail.com`.
> - **Why this file exists here:** Warwick ruled, 2026-08-03 — *"idea 006 canonical reference material lives on Google Drive. ClickUp cannot be relied on."* The Drive document itself says the same thing in its own header: it was *"created after ClickUp rate-limited further writes."*
> - **Why it is staged into Git:** dispatched specialists have **no MCP connectors** and therefore cannot read Drive. Larry fetches at the connector boundary and stages to disk; workers read the file. This copy is a **mirror**, not an independent composition.
> - **Authority order:** the Drive original wins. If this copy and Drive disagree, Drive is right and this file is the defect.
> - **The Drive folder named `VlogOps` (`1Wh4fMU60FPpJxNsqCKBUfiD-lzoFFPAu`) is EMPTY** — a `parentId` listing returned zero children on 2026-08-03. The substance is in the file above, not in that folder. Recorded so a later session does not go hunting.
> - **ClickUp page IDs appear below and are NOT to be relied on** (Warwick's ruling). They are retained only because they are part of the source text.

---

## Executive decision

The surrounding vision resolves into **three coherent product boundaries**, not one undifferentiated mega-build:

1. **IDEA-006 — VlogOps: Publishing Engine** — durable content intake, source snapshots, source compilation, creative construction, approval, production orchestration, Cockpit state, publication requests and receipts. Contains the specialist **Scribe** capability. **Runs normally without Larry or an interactive AI session.**
2. **IDEA-019 — Fusion247 Public Platform** — website, channel model, Human in the Poop public identity, YouTube/X surfaces, reusable publishing adapters, accounts, secrets, recovery, analytics and destination receipts.
3. **IDEA-020 — ScoutAIR** — shared continuous discovery/runtime for Career, Market and Content Scout.

### Governing boundary rule

> Builds split where the durable product state, user outcome and independent acceptance test split. Shared infrastructure is reused through contracts rather than merged into one giant application.

---

## IDEA-006 — VlogOps Publishing Engine

### North Star

Given a content seed supplied through:

1. existing Flight Recorder / session / build evidence;
2. promotion from another Fusion247 output;
3. Warwick-provided free text, conversation excerpt or document;

VlogOps autonomously compiles a durable evidence pack and develops it into a recognisably Warwick creative package for the selected Fusion247 channel.

For **Human in the Poop**, the normal package contains:

- an evidence-grounded **9–12 minute video script**;
- a blog adaptation for the Fusion247 website;
- titles, thumbnail direction, chapter/visual plan and source map;
- privacy, rights, disclosure and factual exclusions;
- derivative promotional copy for configured destinations.

**Warwick approves the creative package once.** After approval, VlogOps handles the configured production path without Larry or interactive prompt choreography: article preparation/publication, HeyGen render, QA, YouTube publication, approved X derivatives, receipts and analytics references.

### Identity

Umbrella platform **Fusion247** · first channel **Human in the Poop** · premise *the human remains in the loop, usually while everything goes to shit* · application **VlogOps** · pipeline **Log2Vlog** · build strand **We Made a Thing** · creative specialist **Scribe** · presenter: Warwick's authorised HeyGen avatar/voice.

### Three intake routes

**Existing records** — select a date, period, session, build or journal thread. VlogOps snapshots the smallest sufficient evidence bundle into its own durable store.

**Promote another Fusion output** — eligible Cockpit outputs expose **Promote to VlogOps**. Promotion creates a durable Content Seed containing a source snapshot, provenance, privacy state, origin and proposed angle.

**Warwick-supplied seed** — free text, pasted conversation, attached document or supported URL, plus the angle/question. Example given verbatim in the source:

> Today I thought X was a fucking good idea. GPT and Pax told me it was shite. This is what I missed.

### Critical reliability rule

> **ClickUp is a source adapter and control surface, not VlogOps' only database or memory.**

Accepted source content must be snapshotted with timestamps, provenance and integrity metadata. **A later ClickUp search/connector failure cannot erase or reinterpret an existing run.**

### Specialist / runtime split

- **Source Compiler** — deterministic acquisition, snapshots, provenance, dedupe, chronology, bounded evidence packs.
- **Research** — Pax or equivalent, **only when current/external evidence is required**.
- **Scribe** — story question, narrative beats, master narrative, video script, blog adaptation, titles, thumbnail direction, social derivatives.
- **Verifier** — bounded independent fact, quote, privacy, rights and cross-format consistency review.
- **Production runtime** — HeyGen jobs, callbacks/polling, retries, asset versions, publication requests, receipts.
- **Larry** — builds and maintains the application; **not a normal runtime stage.**

### Scribe

Scribe is **not** a separate application or build at this stage. It is a **persistent specialist capability within VlogOps, implemented as a versioned contract/skill whose underlying model may change.**

Style: Clarkson-like strong premise, dry exaggeration and comic reversal · NetworkChuck-like accessible enthusiasm and practical explanation · Simon Whistler-like structured narration and momentum · **primarily Warwick's own accumulated voice and relationship with AI**. No verbatim imitation.

### Master Story Package

One canonical creative package produces sibling outputs: video script adapted for spoken pacing and scenes · blog adapted for reading, headings, links and richer detail · approved social derivatives.

**The blog is not a raw transcript, and the video and blog cannot drift into unrelated claims.**

### Cockpit app

Views: Seeds · Developing · Awaiting Warwick · Production · Published · Problems.

Actions: add seed · promote to VlogOps · approve · request revision · park · reject · inspect sources/risks · view outputs/receipts.

### Early proof

Live Fusion247 publication surface · Human in the Poop landing identity · short channel introduction · cost-controlled ~30 second HeyGen render where practical · real YouTube upload · corresponding website introduction/article · durable receipts.

**This proves the pipes, not full completion.**

### Full acceptance

One real seed must produce: durable source/evidence pack · recognisably Warwick Master Story Package · Warwick approval from Cockpit · website article · 9–12 minute HeyGen video · Human in the Poop YouTube publication · durable state/receipts · **idempotent retries and restart recovery** · **no interactive Larry/AI shepherding during normal runtime.**

---

## IDEA-019 — Fusion247 Public Platform (boundary, for dovetailing)

**Owns:** website and domain/public navigation · channel architecture · Human in the Poop landing/archive identity · YouTube channel creation, ownership, recovery · X identity/account decision · website/YouTube/X publishing adapters · public templates, metadata, media, feeds, analytics connectors · OAuth/secrets boundaries · recovery, manual fallback, takedown · structured **Publication Receipts**.

**Does not own:** source compilation · Scribe/story development · content approval · continuous X signal discovery · CareerAIR job discovery · autonomous outreach.

### The contract between the two builds

VlogOps sends an approved **Publication Package**: content/version identity, destinations, article, video/media, titles/descriptions/chapters, thumbnail, social derivatives, rights/disclosure/privacy state, schedule, **idempotency key**.

Public Platform returns **Publication Receipts**: destination, external ID, URL, state/visibility, timestamps, versions, warnings, reconciliation/failure state.

---

## IDEA-020 — ScoutAIR (recorded for boundary only — NOT in scope for BUILD-006)

Shared durable discovery engine: source adapters/schedules · snapshots/provenance · dedupe/correlation · classification and domain scoring · durable Signal objects · routing · observability and cost control. Domain profiles: Career Scout, Market Scout, **Content Scout** (which may produce VlogOps Content Seeds).

> Grok reads the room. Deterministic runtime holds the keys.

Grok must not own credentials, schedules, durable records, dedupe, account actions, outreach authority or canonical facts.

---

## Addendum — Tom Solid / myICOR reference model

**Source boundary:** Warwick's supplied summary from a separate GPT research conversation. **Useful external reference material, not independently re-verified.**

**Architectural conclusion:**

> Define stable specialist capability contracts first; allow one or more models/agents to fulfil them; split into separate persistent agents only where independent state, permissions, cadence or quality genuinely require it.

Durable capability map for VlogOps: **Source Compiler · Research specialist · Scribe · Visual Story/Design · Video Production · Verifier/QA · Channel Analyst · Community capability** (later, under explicit external-engagement authority).

**Initial implementation may combine several roles behind one versioned skill/runtime while preserving distinct inputs, outputs and evidence. Do not create a theatrical nine-agent meeting for every episode.**

**What the reference does NOT prove:** it did not establish that a single myICOR agent autonomously owns, deploys or operates the website. Therefore: website/channel infrastructure remains the Public Platform build; specialist agents create, review, analyse or support content; deterministic runtime owns deployment, credentials, publishing state and receipts. **"Do not create a 'Website Agent' as a substitute for a proper public-platform build."**

**Community and post-publication loop** — recorded as a future bounded capability, **not a fourth immediate build**. Any autonomous public reply, moderation action, DM or commercial engagement is outside current authority.

**MCP precedent** — a future read-only, permissioned member interface is a reasonable architectural consideration; **not required** for the first builds.

**Net change:** the three-build split remains correct. No new immediate IDEA arises from this evidence.
