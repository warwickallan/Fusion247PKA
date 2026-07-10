---
agent_id: cairn
session_id: sop-016-transcript-chunk-mapping-2026-07-10
timestamp: 2026-07-10T23:50:00Z
type: end-of-session
linked_sops: [SOP-015-cairn-process-external-source, SOP-016-cairn-process-youtube-transcript]
linked_workstreams: []
linked_guidelines: [GL-008-source-classification-registry, GL-002-frontmatter-conventions]
---

# Authored SOP-016 by reconciling the old Fusion247 Brain `F247.skill.process-youtube-transcript` against my completed Hermes pilot

## What I did

Larry (via the user) surfaced an older Fusion247 Brain document, `F247.skill.process-youtube-transcript` (v0.1, owner CategorisAIr — a since-superseded agent I replaced). The brief: reconcile its useful transcript-specific mechanics against my already-completed Hermes/NetworkChuck pilot (see [[2026-07-11-04-30_cairn_hermes-transcript-pilot]]) and re-derive them into a **subordinate** procedure I own, without porting CategorisAIr's old two-agent architecture.

Wrote **[[SOP-016-cairn-process-youtube-transcript]]**, structured on SOP-015's own precedent (header block, Purpose, When to call, numbered Steps, worked example, common mistakes). It elaborates [[SOP-015-cairn-process-external-source]] Step 2 only, activating when a source classifies as GL-008's Video/Audio Transcript category and is long/structured enough to need chunk-mapping. Re-derived (not copied) five mechanics from the old skill:

1. **Single-read chunk mapping** — one sequential pass, theme-labeled chunks at natural topic boundaries, knowledge points/entities/verification-needed claims/anchor captured inline once. The chunk map becomes the working artifact; no re-read of raw text for any later step.
2. **Timestamp anchors** — `[mm:ss-mm:ss]` at chunk level, never per-sentence.
3. **Transcript-noise and normalization flags** — generalized the exact discipline I improvised by hand on the Hermes pilot (flagging "Nus Research"/"UST Research"/"Noose Research" and "OpenClaw"/"Offenclaw"/"Openclaw" rather than silently picking a spelling) into a named, repeatable step (§3): record every observed variant, state the normalized guess as a guess, give the reasoning, flag unresolved if too garbled to guess.
4. **Chunk-map coverage checking** — a checklist pass over the chunk map only (named entities, numbers/versions/commands, caveats/trade-offs, sequences, sponsor/intro/outro dropped unless substantive).
5. **Metadata validation** — check video_id/channel/URL/captured_at presence in-source; missing = flagged unknown-in-source, never invented. Explicitly deferred to SOP-015 Step 9 for the actual provenance write-up rather than duplicating it.
6. **Sequential slicing** for transcripts over ~90 minutes — carry forward only the chunk map, never raw text, across slices; run the coverage check once at the end against the assembled map.

**Deliberately did NOT port**, per the brief: the CategorisAIr handoff packet (I classify AND file in one pass, no separate deciding agent); the `pending_categorisair` review-status state (no second agent exists to await review from); the "mandatory one-note output" assumption (SOP-015 Step 5's "does this earn a note" test can and did produce zero new notes on the real pilot — SOP-016 says so explicitly in its worked example and common-mistakes list); the fixed frontmatter contract (`source_type`, `video_id`, `review_status: pending_categorisair`, etc.) — I still file into GL-002's real entity-type schemas only, no parallel schema reintroduced.

**Added the raw-source-retention gap note** the brief asked for — a short paragraph in SOP-016 (§"A note on raw-source retention") stating this is an open gap routed separately to Silas, and that SOP-016 defers entirely to SOP-015 Step 9's existing honest-flagging behavior rather than assuming a `Sources (Immutable)/`-style store exists. This is the same gap I flagged on the Hermes pilot; SOP-016 does not resolve it, just doesn't paper over it either.

## Files touched

- `Team Knowledge/SOPs/SOP-016-cairn-process-youtube-transcript.md` — new.
- `Team Knowledge/SOPs/INDEX.md` — new SOP-016 row; reserved range bumped to SOP-017 onward.
- `Team Knowledge/SOPs/SOP-015-cairn-process-external-source.md` — added SOP-016 to the References line and a one-line pointer inside Step 2 (short/clean transcripts still use Step 2 as-is; long/structured Video/Audio Transcript sources route to SOP-016). No restructuring, no duplication.
- `Team/Cairn - Knowledge Intake Specialist/AGENTS.md` — added a line inside §Method step 1 noting transcript sources needing chunk-mapping follow SOP-016; added SOP-015 and SOP-016 to §References (SOP-015 was oddly missing from References before this pass despite being the canonical procedure — added it too, since its absence was a real gap, not a redundant duplicate).
- This session log — new.

## What I did NOT touch (in scope, deliberately left alone)

- No `tsk-*` task files — out of scope per the brief, including `tsk-2026-07-10-003-categorisair-equivalent-design-proposal.md`, which looks adjacent to this work but is separate follow-up.
- SOP-015 itself stays the canonical general intake-and-filing process, unrestructured — only a cross-reference line and one pointer sentence added.
- GL-008 was not edited — no new category proposed; nothing in the old skill's content actually surfaced a classification-vocabulary gap, only a mechanics-layer one.

## Judgment call worth flagging

The old skill's Preconditions section drew a boundary against "work/client meeting" transcripts (routed to "the Bellrock project extraction skill" in the old system). I did not carry that boundary into SOP-016 as a stated precondition, because it is already fully covered by existing myPKA doctrine: Warden owns `Client Delivery/` transcripts via [[SOP-010-warden-extract-source-to-evidence-pack]], and GL-008 itself already states it does not cover `Client Delivery/` sources. Restating it in SOP-016 would have been duplicating an existing boundary rather than adding one — left it out on purpose, not by oversight.

## What the next agent must know

- SOP-016 is live. Any future Cairn (or other agent) processing a transcript classified as GL-008's Video/Audio Transcript category should check SOP-016's "When to call this" bar before defaulting to a plain SOP-015 Step 2 read.
- SOP-016 does not change classification, entity/backlink discipline, filing, provenance, or logging — those stay exactly as SOP-015 already defines them. Do not let SOP-016 accrete those responsibilities over time; if that temptation shows up, it belongs in SOP-015, not here.
- The raw-source-retention gap is still open and still routed to Silas — SOP-016 references it but does not resolve it. Same status as before this session.
