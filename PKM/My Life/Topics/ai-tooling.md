---
name: AI Tooling
key_element:
parent_topic:
lifecycle: exploring              # exploring | promoted | dormant (default exploring)
promoted_to:                      # Key-Element slug - set ONLY when lifecycle: promoted
tags:
  - ai
  - tooling
  - agents
---

# AI Tooling

> [!example] Seeded course sample
> This is a worked example the myICOR myPKA course walks through — it shows the canonical shape to follow. Keep it as a reference and adapt it, or replace its contents with your own.

**What it covers:** the agents, models, prompts, and workflows I use day to day. Local setups, hosted tools, the weird edge cases I hit while wiring them together.

**Why it matters to me:** my work output multiplies when the tooling is sharp. When it's dull, I waste hours fighting the tools instead of doing the work. This Topic is where I keep that signal-to-noise ratio honest.

**Current pulse:** experimenting with multi-agent delegation patterns, testing how much context I can hand off without losing quality. Watching how the [[morning-build-session]] habit changes when I let an agent take the first 20 minutes of structured thinking.

**Things I'm tracking:**
- which prompts actually shorten my [[ship-mvp-by-q3]] timeline
- where AI tooling supports [[health]] (less screen fatigue, faster decisions) versus where it hurts it
- failure modes worth writing down before I forget them
- specific tools I want to revisit in 30 days

## External intake — sources processed by Cairn

> Per [[SOP-015-cairn-process-external-source]]. Frontmatter above was backfilled to GL-002 spec by Cairn while enriching this note (it predated the frontmatter mandate) — no field invented, only the existing Topic schema's own fields filled in.

### 2026-07-10 — NetworkChuck-style transcript: Hermes vs "OpenClaw" agentic tools

**Classification (GL-008):** Video/Audio Transcript. The material is a machine-transcribed (auto-caption-style) transcript of a YouTube video — rough phrasing, inconsistent proper-noun spelling, and a self-referential "Transcripts:" header are all consistent with an auto-generated caption export rather than an edited transcript. Per GL-008's Video/Audio Transcript row, this maps to a **Topic** (the tool-ecosystem subject matter) — this Topic, specifically, since it already tracks "agents, models, prompts, and workflows."

**Provenance:** the transcript refers to itself twice as continuing "on the network Chuck Academy" (a paid follow-on course plus the full interview), and closes with a first-person "prayer for viewers" sign-off — a recognizable stylistic signature. *Directly present in the material.* This strongly points to the channel being **NetworkChuck**, though the transcript never states the channel name in one clean, unambiguous line — treating this as directly-supported, not a bare guess, but short of an explicit self-identification. Apparent video title, read from the transcript's own opening line: *"you need to use Hermes RIGHT NOW!! (goodbye OpenClaw!!)"*. No video URL appears anywhere in the material handed to me.

**What I learned, evidence-labeled:**

- Hermes is an AI agent platform positioned as a direct alternative to a competing tool the transcript's auto-captions render at least three different ways in the same document — "OpenClaw," "Offenclaw," "Openclaw." *Directly present.* **Transcription-quality flag:** the source itself never settles on one spelling; I'm normalizing to "OpenClaw" here as the most legible reading, not because the transcript did.
- Hermes was built by a company the transcript's captions render, again inconsistently, as "Nus Research," "UST Research," and "Noose Research." *Directly present, same transcription-quality issue.* Given the AI-agent-tooling context and the phonetic pattern, this most plausibly reads as **Nous Research** (an independently known AI research collective) — but that reading is my own best-guess normalization, not a clean statement from the source. Flagging rather than silently picking, per the brief.
- Per the transcript, Hermes started as an internal tool roughly 6–7 months before the competing tool's public release (used for model-training/self-improvement prototyping) and was released publicly after the competitor's traction showed appetite for something similar. *Directly present*, attributed in the transcript to "Jeff," a co-founder, in reported speech.
- Named co-founder: **Jeffrey Carnell** (named explicitly once; referred to elsewhere throughout simply as "Jeff," quoted/paraphrased extensively). *Directly present.*
- Claimed differentiators — largely the narrator restating claims attributed to Jeff, or asserted directly by the narrator: a memory system with hard character caps on two files (a "user" file capped at 1,375 characters, a "memory" file capped at 2,200 characters), automatic curation roughly every 10 conversational turns, a "skill system" where the agent authors and curates its own reusable skills, and deliberately fewer built-in integrations than the competitor by design philosophy. *Directly present*, but all narrator-asserted, not independently verified — a reasonable hand-off to Pax if the user ever wants a truth-check rather than a sponsored-review-level claim.
- Specific competitive claims — "fastest growing project on GitHub," "took first place in OpenRouter token usage, surpassing OpenClaw," and "no security incidents to date" versus the competitor's "numerous CVEs" in its skill marketplace. *Directly present source assertions whose truth is unverified.* Do not relabel these as reconstructed if repeated later; keep the distinction clear by writing "the video asserts this" unless Pax independently verifies the claims.
- **Evidence caveat (my own observation, not sourced from the transcript's factual content):** the video explicitly states it is sponsored by **Hostinger** ("the sponsor of this video," recommended as the hosting/VPS provider for installing Hermes). A sponsored video reviewing a tool favorably is a real conflict-of-interest signal worth holding onto when weighing the comparative claims above.

**Entities considered and *not* created, with reasoning (per SOP-015 §6, "does this earn a note" test):**

- **Hermes (the tool):** no new note — none of GL-002's eight entity types fit a software product. Folded into this Topic as narrative instead.
- **Nous Research (maker company):** no new Organization note. `PKM/CRM/Organizations/` is scoped to organizations the user actually interacts with; this is a company learned about secondhand via one video, not a vendor/employer/partner relationship.
- **Jeffrey Carnell (co-founder):** no new Person note. Quoted at length, but the video's subject is the tool, not a profile of him — no standalone relationship or reason yet. Worth revisiting if a future source (e.g. the full interview this transcript references) gives him independent, substantial coverage.
- **"OpenClaw" (competing tool):** no new note, same reasoning as Hermes — folded into the comparison above.
- **Hostinger (sponsor):** no note, no backlink — a passing ad mention with no knowledge-bearing content beyond the sponsorship-bias caveat already captured above.

**Backlinks created this pass:** none. No candidate target note exists for any of the five entities above (see reasoning), so per Cairn's "no stated reason, no link" rule, nothing was linked. This Topic's own pre-existing links ([[morning-build-session]], [[ship-mvp-by-q3]], [[health]]) predate this pass and are untouched.

**Raw-source provenance:** the transcript itself lives only in this session's scratchpad, not in this repo — general PKM intake has no equivalent of Warden's `Sources (Immutable)/` (that pattern is scoped to `Client Delivery/` only). For this v1 pilot I'm treating the citation above (apparent title, apparent channel, the "network Chuck Academy" self-reference, processing date) as the provenance record, but it is genuinely thinner than a preserved raw copy would be. Flagged to Silas via Larry as a real gap worth a future pass, not silently treated as equivalent to raw-source retention.
