---
source_id: F3lL98Pj90o
type: source-knowledge-note
source_type: youtube_transcript
title: "/wayfinder: Nothing is too big to plan anymore"
source_url: "https://www.youtube.com/watch?v=F3lL98Pj90o"
video_id: F3lL98Pj90o
channel: Matt Pocock
published: 2026-07-30
transcript_source: auto_captions
captured_at: "2026-07-31T06:47:19+00:00"
capture_id: null
review_state: ai_created
build: BUILD-002
authored_by: cairn-sonnet
raw_evidence:
  - Sources/_raw/F3lL98Pj90o/tubeair-report.md
  - Sources/_raw/F3lL98Pj90o/manifest.json
tags:
  - youtube
  - source-knowledge
  - pending-warwick-review
---

## Executive orientation

This is a solo-creator screencast by Matt Pocock introducing "Wayfinder," a planning skill/methodology for orchestrating large, ambiguous units of work across multiple AI-agent sessions, released via his public skills repo. It matters because it addresses a specific failure mode he'd hit repeatedly: single-session AI planning tools force big, ambitious work to be artificially shrunk to fit a context window, and Wayfinder removes that ceiling by turning planning itself into a multi-session, dependency-tracked process built on pre-AI software engineering fundamentals (issue trackers, tickets, blocking relationships).

## What the source says

**The core problem Wayfinder solves.** Pocock's prior planning tools (including ones he built himself, like "grill with docs") were "too constrained, too tied to a single session." [00:00] Some work is simply too big to fit in an agent's context window, or even its "smart zone" (the portion of context where the agent reasons well). Faced with this, he'd pre-break work into small bites before starting an AI session — but would still hit unanswerable questions mid-session and get "lost in fog" while also trying to conserve tokens. [01:00] Critically, he says this constraint was distorting his actual engineering decisions: "I was kind of constraining the stuff I was building to fit AI, which doesn't feel right." [00:00] Wayfinder is explicitly designed to remove that ceiling.

**The "fog of war" / map metaphor.** Big, ambitious work has a known start point and a vaguely-known destination, but the path between is "foggy" — this is true in engineering and "in many walks of life where you're planning something ambitious." [01:44] Wayfinder models this as a map: you begin with a grilling session (an AI interview to establish the basic premise), and depending on how much fog remains, you may need further sessions — prototyping, more grilling, or research. [02:11–03:09] The map maintains: a **frontier** (decisions/tickets that are currently actionable) and everything still **in fog** (not yet decidable because research/prototyping/conversation hasn't happened yet). Eventually all fog resolves and you reach the destination. [03:09–04:02]

**How it's implemented — issue tracker as the map.** Wayfinder doesn't use a bespoke database; it stores the map directly in the user's existing issue tracker (Pocock demos it in GitHub, on his public "course video manager" repo). A top-level "map" issue has ~12 sub-issues, each a decision ticket. As tickets resolve, their resolution is written back into both the sub-issue and a summarized form in the parent map issue, so the map always reflects current state. [04:27–05:00] Pocock stresses the tool is **issue-tracker agnostic** — it works with Linear, Jira, "literally whatever you like," via a small amount of setup through a "setup map skills" step. [05:00]

**Starting a Wayfinder session — worked example (CVM command palette).** He demonstrates by adding a command-palette feature (icon picker, cross-diagram search, copy-to-diagram) to his "CVM" (course video manager) app. He invoked the wayfinder skill with a plain description of what he wanted; it explored the repo, invoked the grilling skill, asked what "done" looks like, recommended producing a spec as the destination, asked a few initial questions, then created the first map plus **seven starting tickets**, of which only **three were immediately takable** (icon-name source, component storage schema, palette information architecture/keyboard). [05:54–06:57]

**Working a map — one ticket per session.** For each takable ticket, you invoke the wayfinder skill again, this time scoped to that specific ticket/ticket URL (he does this via a "handoff skill" that auto-writes a prompt and spawns a fresh sub-agent, but the essential mechanic is just calling Wayfinder on a specific ticket). So Wayfinder is called twice in different modes: once to chart/initialize the map, and repeatedly to walk each individual ticket. [06:57–07:16]

**The four ticket types (each a first-class type inside the issue tracker itself).** [07:16–08:52]
- **Research** — agent goes off (usually via a sub-agent, "you don't actually need to watch it"), finds information, and reports back.
- **Prototype** — builds a working prototype; reuses a separate "prototype skill" from an earlier video. Pocock calls prototypes "so unbelievably invaluable for really seeing things come to life as you're planning."
- **Grilling** — a discussion/interview session to resolve an implementation-detail decision.
- **Task** — real-world actions the agent can't do itself (or could do, but is intentionally scheduled behind other work).

**Dependency/blocking relationships.** Wayfinder tracks which decisions can only be made once other decisions are made — e.g., a map at "14 of 17 done" still can't finish because the core skill it depends on hasn't been built yet, and building it will reopen further tickets once it's understood how the skill behaves. Working a map is iteratively: resolve a ticket → see what new tickets/frontier movement that unlocks. [08:52–09:44]

**From completed map to implementation.** Once a map is "complete" (or dense enough), Pocock generates a spec from it via a "to spec" step — pulling the accumulated decisions into a single GitHub issue/document. In his example this initial draft **exceeded GitHub's issue character limit**, illustrating how large these maps get. [09:44–10:19] From there he follows his normal downstream flow: spec → tickets → implement each ticket → code review — meaning Wayfinder slots in as a **replacement for the "grill with docs" step**, not a wholly separate pipeline. [10:19]

**Key structural advantage over his prior "grill with docs" approach: traceability to primary sources.** Wayfinder specs are dense and link back to the original decision tickets, so a confused agent can go look at the actual primary-source discussion. He names this as a specific fix to a known weakness of grill-with-docs, where the spec was only ever "a summary of what was actually said in the meeting" and had to be trusted as the source of truth by default. [10:19–11:20]

## Mechanisms, methods & implementation detail

- **Invocation pattern:** call the `wayfinder` skill with a plain-language description of the ambitious goal to initialize a map; call `wayfinder <ticket-URL>` to work an individual ticket. [05:54, 06:57]
- **Setup for non-GitHub trackers:** a "setup map skills" configuration step adapts Wayfinder to Linear, Jira, or other trackers. [05:00]
- **Ticket typing lives in the tracker itself** (not a side database) — e.g., "wayfinder research" as an actual issue type/label. [07:16]
- **Write-back loop:** ticket resolution → written into the ticket → summarized back into the parent map issue, keeping the map a live, current reflection of state rather than a stale plan. [04:27]
- **Handoff automation (his personal setup, not core to Wayfinder itself):** a separate "handoff skill" auto-generates the prompt and spawns a fresh Claude sub-agent per ticket. [06:57]
- **Spec generation:** a "to spec" operation converts a resolved/dense map into a single destination document (a GitHub issue in his workflow), which then feeds his existing "to tickets" → implement → code-review pipeline. [09:44, 10:19]
- **Spec lifecycle — deliberately non-persistent:** once a spec's content is present in the codebase, Pocock **closes and deletes the issue containing the spec** and rarely refers to it again. [13:26]
- **Non-coding usage:** he has used Wayfinder to plan building a garden office — commissioning a site survey, researching and contacting building firms, etc. — demonstrating the method is domain-general, not coding-specific. [12:11]

## Tools, people, products & organisations

- **Wayfinder** — the skill/methodology this video introduces; available now on Pocock's public skills repo. Works with "any coding agent." [00:00, 03:09]
- **Matt Pocock** — presenter/creator; runs a public "skills repo" and the "AI Hero" site/course.
- **"Grill me" / "grill with docs"** — Pocock's earlier single-session planning skill/primitive; still described as "a super important primitive" but limited to one session. Wayfinder occupies the same pipeline slot this used to occupy. [01:00, 10:19]
- **Prototype skill** — a separate skill (subject of "a whole extra video," per Pocock) that Wayfinder's prototype-type tickets reuse. [08:03]
- **CVM (Course Video Manager)** — Pocock's own public repo/app, used as the demo project (command palette feature) and as the home of his public "Wayfinder maps." [04:27, 05:54]
- **Issue trackers supported:** GitHub (used in the demo), Linear, Jira, or "literally whatever you like" via configuration. [05:00]
- **"John"** — an unnamed-in-detail user/fan mentioned as having built his own custom harness around the Wayfinder approach, including a visual "star map" UI for taking tasks — cited as evidence of enthusiastic community adoption ("people are freaking loving this thing"). [01:00-ish region, per intro]
- **AI Hero** — Pocock's site, promoting a free seven-lesson course, "AI skills for real engineers," referenced at the end as where to learn the underlying skill-building method. [14:25]

## Examples & use cases

1. **CVM command palette (Cmd/Ctrl-K) feature** — the fully worked demo: icon picker, cross-diagram search, copy-diagram-content. Went from a one-line ask → grilling → 7 initial tickets (3 immediately takable) → per-ticket sessions → completed map → "to spec" (document too large for GitHub's issue character limit) → spec-to-tickets → implementation. [05:54–10:19]
2. **Garden office build (non-software, real-world project)** — site survey commissioning, researching/contacting building firms, general logistics — used to show Wayfinder generalizes beyond coding. [12:11]
3. **Course planning and "engineering work" generally** — mentioned briefly as other domains he's applied it to, without further detail. [14:25]

## Claims & confidence

- Single-session planning tools force artificially small scoping of ambitious work. — **[opinion]**, high confidence this reflects the presenter's genuine lived frustration, but it's a subjective framing, not a measured claim. [00:00]
- Wayfinder can plan work of "any size" by orchestrating across multiple sessions. — **[claim]**, asserted by the creator about his own tool; no independent verification given. [00:00]
- Wayfinder maps decisions, tracks a "frontier" of actionable tickets, and tracks unresolved "fog." — **[fact]** (this is a description of how the tool demonstrably works, shown live in the demo). [03:09–04:27]
- Wayfinder is issue-tracker agnostic (works with GitHub, Linear, Jira, etc.) — **[claim]**, stated but only GitHub is actually demonstrated on screen. [05:00]
- The spec generated from a completed map exceeded GitHub's character limit. — **[fact]**, directly observed/reported from his own use. [10:19]
- Wayfinder specs are more traceable than "grill with docs" specs because they link to primary-source decision tickets. — **[opinion/claim]**, a design-comparison argument made by the tool's own creator; plausible but unverified against alternatives. [10:19–11:20]
- "People are freaking loving this thing" / a user built a custom harness around it. — **[claim]**, anecdotal social proof, unsourced/unquantified (no numbers, no named survey). [01:00 region]
- Prototypes are what prevent Wayfinder's heavy upfront planning from becoming waterfall. — **[opinion]**, a specific rebuttal to an anticipated objection, argued but not independently tested in the video. [08:03]

## Caveats & source gaps

- **No technical implementation detail provided.** The video never shows the skill's actual prompt/config source, how ticket-type metadata is structured in the tracker, or how the "setup map skills" configuration works for non-GitHub trackers — these are asserted to exist but not demonstrated.
- **No failure cases or limitations discussed.** Pocock doesn't address what happens when Wayfinder mis-scopes a map, when tickets get stuck, or when the tracker/skill combination fails partway through — the video is a positive walkthrough, not a warts-and-all account.
- **"John's" custom harness** is referenced only in passing with no name, repo link, or specifics — cannot be verified or explored further from this source alone.
- **No cost/token/time data.** No indication of how many tokens, sessions, or wall-clock time a large Wayfinder map like the CVM example actually consumed.
- **Commercial framing is present but understated in the transcript itself** — the video functions in part as promotion for Pocock's "AI Hero" course and skills repo; this is a legitimate secondary thread (reputation/audience-building) but the transcript gives no numbers on reach, pricing, or business outcomes tied to Wayfinder specifically.
- **The SDD (spec-driven development) contrast is asserted, not adjudicated.** Pocock distinguishes his non-persistent-spec approach from "other approaches to spec-driven development" that keep and edit specs long-term, but doesn't name or characterize those alternative approaches beyond the label.

## What this means for Fusion247

*(Interpretation — not sourced from the video.)*

- **Direct structural parallel to myPKA's own map metaphor.** Wayfinder's "start → fog → frontier of decidable tickets → destination," implemented as parent-issue-plus-sub-issues with write-back summarization, is close in spirit to how Larry already uses `Team Knowledge/` SOPs, Work Orders, and Deliverables to sequence multi-session builds (e.g., BUILD-014's Phase-0 WP structure, or the Tower campaign's staged decisions). The concrete mechanism worth stealing is the **write-back loop**: resolved decisions get summarized back up into the parent tracking artifact automatically, so the "map" never goes stale — this is close to, but more disciplined than, how session logs and Deliverables currently get manually reconciled back to plans.
- **The "spec is a non-persistent destination document" stance is a genuine reversal worth weighing against Fusion247's SSOT doctrine.** myPKA's Golden Rule is "every fact lives in exactly one file, forever, linked via wikilink" — Pocock's model is the opposite: the spec is disposable scaffolding, deleted once implemented, with the *ticket history* (not the spec) treated as the durable primary source. This is not directly transferable (Fusion247's model favors durable canonical docs over disposable specs), but the underlying principle — that decision-record primary sources should stay linkable and shouldn't be flattened into a single summary artifact that then becomes the only version of truth — reinforces existing practice ([[write-discipline]]) rather than contradicting it.
- **Ticket-type-as-first-class-tracker-object (research/prototype/grilling/task) maps cleanly onto Larry's own specialist-dispatch categories** — a useful lens for structuring future Work Orders: explicitly tagging whether a dispatched unit of work is research (Pax-shaped), prototype/build (Felix/Vex-shaped), a grilling/decision discussion (Larry-retained per [[how-larry-works]]), or a real-world task, could sharpen Work Order preflight (SOP-022) the same way Wayfinder's typing sharpens its own tickets.
- **The "don't shrink ambition to fit a single session" critique is directly relevant to [[deliver-thin-working-slice-first]] tension.** Wayfinder's whole premise is explicitly the opposite instinct from thin-slice-first — Pocock is arguing *against* artificially bounding scope to fit a session. Worth noting this isn't actually a contradiction: Wayfinder still slices work into per-ticket sessions, it just does so via genuine dependency discovery (fog-clearing) rather than an a-priori arbitrary walking-skeleton cut. The lesson for Larry is closer to "slice by genuine decision-dependency, not by session-size convenience" — compatible with, and a refinement of, the existing thin-slice doctrine.
- **Not an immediate build candidate** — this is a single-operator's skill/workflow for his own AI-coding practice, tightly coupled to his specific skills repo and course business. No action needed beyond noting the map/frontier/fog vocabulary and the write-back mechanism as a reusable planning pattern.

## Key concepts & takeaways

- **Fog of war** — the state of not yet knowing enough to make a decision; resolved through research, prototyping, or grilling sessions, not guessed past.
- **Frontier** — the set of tickets/decisions currently actionable given what's already resolved.
- **Map** — the top-level artifact (an issue with sub-issues, in his implementation) representing the whole planned journey from start to destination.
- **Four ticket types** — research, prototype, grilling, task — each a first-class typed object inside the tracker.
- **Destination-as-spec** — a spec is just the endpoint document for a multi-session unit of work, disposable once implemented, not a persistent artifact to maintain.
- **Blocking/dependency relationships between tickets** — some decisions are only reachable once prior decisions resolve; working the map means repeatedly re-checking what the resolution of one ticket newly unlocks.
- **Prototypes as the anti-waterfall mechanism** — heavy upfront planning risks becoming waterfall; frequent, high-fidelity prototypes are what keep Wayfinder's extensive planning grounded in real feedback rather than speculative documentation.

## Actions & open questions

- No build action indicated — this is background/pattern-literacy content, not a Fusion247 build input.
- Worth privately noting (no action required) the **write-back-to-parent** mechanism and **typed-ticket-in-tracker** pattern as candidate refinements next time Larry revisits Work Order structure or SOP-022 preflight design.
- Open question if ever relevant later: how Wayfinder's issue-tracker-agnostic "setup map skills" step actually adapts to non-GitHub trackers — the video asserts this works but never demonstrates it, so it would need independent verification (e.g., via Pax or direct inspection of the skills repo) before assuming it applies to any specific non-GitHub tracker Fusion247 might use.
- Source gap: the referenced skills repo itself (where "wayfinder" is published) is not fetched or examined here — this note is transcript-only per the task; if the actual skill implementation ever becomes relevant to Fusion247, it would need a separate, deliberate fetch-and-review pass, not inference from this video alone.

---

**RAW transcript — immutable source evidence:** `Sources/_raw/F3lL98Pj90o/` — `tubeair-report.md` (sha256 `998f3953e3ca…`), `manifest.json` (sha256 `6d8d0c50c98c…`). Preserved as captured; never edited or summarised.
