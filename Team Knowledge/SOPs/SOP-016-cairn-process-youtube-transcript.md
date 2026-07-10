# SOP-016 - Cairn: Chunk-Map a Video/Audio Transcript

- **Default owner:** Cairn
- **Reusable by any agent.** Any specialist running [[SOP-015-cairn-process-external-source]] against a transcript source follows this procedure for that source's Step 2 — it is not exclusive to Cairn, only usually run by Cairn.
- **Triggered by:** [[SOP-015-cairn-process-external-source]] Step 2 ("read the whole source once"), specifically when Step 3's classification lands on GL-008's **Video/Audio Transcript** category *and* the transcript is long or structured enough that a single undifferentiated read would lose track of theme, sequence, or verification-needed claims — a short transcript can just be read per SOP-015 Step 2 unmodified.
- **Output:** a chunk map (theme-labeled segments, each carrying its knowledge points, entities, verification-needed claims, and a `[mm:ss-mm:ss]` anchor) that SOP-015's remaining steps (3 through 10) run against directly, with no re-read of the raw transcript.
- **References:** [[SOP-015-cairn-process-external-source]] (the parent procedure this SOP elaborates one step of — classification, entity/backlink discipline, filing, provenance, and logging all stay there, unchanged), [[GL-008-source-classification-registry]] (the Video/Audio Transcript category this SOP activates on), [[GL-002-frontmatter-conventions]] (the entity schemas SOP-015 Step 8 files into), [[Team/Cairn - Knowledge Intake Specialist/AGENTS]] (the contract both SOPs operationalize).

## Purpose

A transcript is a different shape of source than an article or a document: it is long, sequential, often auto-captioned (so proper nouns and technical terms drift across the same document), and time-anchored in a way that matters for future auditability ("where in the video does it say that"). Reading it once and trying to draft directly from memory afterward loses structure — themes get flattened, anchors get lost, and inconsistent auto-caption spellings get silently "corrected" into something that looks more confident than the source actually was.

This SOP re-derives, as a named repeatable procedure, the discipline Cairn's own Hermes/NetworkChuck pilot improvised by hand under SOP-015 (see [[2026-07-11-04-30_cairn_hermes-transcript-pilot]]): segment the one read into theme-labeled chunks with anchors, flag inconsistent auto-caption spellings rather than silently normalizing them, and run the coverage check against the chunk map instead of the raw transcript. It plugs into **SOP-015 Step 2 only**. Classification (Step 3), the "does this earn a note" test (Step 5), evidence-origin labeling (Step 6), backlink justification (Step 7), filing (Step 8), provenance (Step 9), and logging (Step 10) all run exactly as SOP-015 already defines them, against the chunk map this SOP produces instead of against a re-read of the transcript.

## When to call this

- SOP-015 Step 3 has classified the source as GL-008's **Video/Audio Transcript** category, and the transcript is long enough (roughly: more than a handful of distinct topics, or long enough that mentally tracking themes/entities across one linear read is unreliable) that chunk-mapping earns its keep.
- The transcript shows auto-caption characteristics — inconsistent spelling of the same proper noun, garbled phrasing, a raw "Transcripts:"-style header — where normalization discipline (§4 below) matters.
- Do **not** call this for a short, clean transcript where a single SOP-015 Step 2 read already captures everything reliably — chunk-mapping a five-minute transcript is overhead, not discipline.

## Steps

### 1. Confirm the whole transcript is in hand, and its rough length

Before the read, confirm the material is complete (SOP-015 Step 1 already requires this — do not re-derive it here, just carry it forward). Note the transcript's approximate length or turn count. This decides whether §6 (sequential slicing) applies.

### 2. One sequential read, segmenting into theme-labeled chunks as you go

Read start to finish, once. As you read, break the material at natural topic boundaries — a chunk is one teachable idea, workflow, tool walkthrough, claim cluster, or argument, not a fixed word count or a fixed number of chunks. For each chunk, capture inline, in one pass, without re-reading:

- **Theme label** — two to five words naming what the chunk is about.
- **Knowledge points** — dense prose: facts, steps, commands, numbers, versions, trade-offs, caveats. No filler, no restated transitions.
- **Entities touched** — every person, tool, product, organization, or concept the chunk substantively discusses (not every name-drop — see SOP-015 Step 4's own "substantively discusses" bar, which the chunk map is feeding).
- **Claims needing verification** — anything stated as fact that is actually an unverified assertion the source makes (a stat, a benchmark, a superlative, a claim about a competitor) — this is raw material for SOP-015 Step 6's evidence-origin labeling, not a separate judgment made here.
- **Anchor** — `[mm:ss-mm:ss]` for the chunk's span in the source, if timestamps are present in the material. If the source has no timestamps, say so once at the top of the chunk map rather than inventing anchors.

The chunk map is the working artifact from this point forward. Do not reopen or reread the raw transcript for any later step in this SOP or in SOP-015 — if a later step seems to need something the chunk map doesn't have, that is a sign the chunk was under-captured, not a license to re-read.

### 3. Flag auto-caption and transcription-noise inconsistencies as you go (never silently normalize)

While chunking, if the same proper noun (a person, product, or organization name) appears spelled multiple different ways across the transcript — the auto-caption pattern Cairn's own pilot hit with "Nous Research" rendered as "Nus Research" / "UST Research" / "Noose Research", and a competing tool rendered "OpenClaw" / "Offenclaw" / "Openclaw" — do not pick one spelling and present it as settled. Record, in the chunk map, at the first chunk where the term appears:

- every distinct spelling observed,
- the normalized form Cairn is using going forward for readability (a best-guess reading, stated as a guess, not a correction),
- and the reasoning for that guess if one exists (phonetic pattern, independently known real-world entity, context).

This flag travels forward into the destination note's evidence-origin labeling (SOP-015 Step 6) as-is — it is not resolved or hidden by the time the note is drafted. If a name is too garbled to guess confidently, flag it as unresolved rather than forcing a normalization.

### 4. Chunk-map coverage check (run against the chunk map, never the raw transcript)

Once the read is complete and the chunk map exists, run a checklist pass over the **chunk map only**:

- Is every named tool, product, or person that recurred with substance accounted for in some chunk's entity list?
- Are numbers, versions, and commands captured verbatim where the transcript gave them?
- Are caveats and trade-offs the source itself stated present, not dropped for being inconvenient or hedgy?
- Where sequence is itself the knowledge (an install order, a workflow's steps), is that sequence intact and not silently reordered?
- Has sponsor/intro/outro boilerplate been dropped unless it's substantive (e.g. a sponsorship claim that matters as an evidence-origin caveat, per Cairn's Hermes pilot's Hostinger flag, stays; a generic "like and subscribe" does not)?

If the coverage check surfaces a gap, fix it by revisiting the chunk map's own notes and memory of the single read — never by reopening the raw transcript for a second pass (§2's "no re-read" rule holds through the coverage check too).

### 5. Metadata validation

Check whether the source material states its own video_id/channel/URL/captured_at (or equivalent — title, apparent channel, publish context). Record what is actually present. Missing metadata is flagged as **unknown-in-source** in the chunk map, never invented or guessed at with false confidence. This feeds directly into SOP-015 Step 9's raw-source-provenance handling — this SOP does not duplicate Step 9's discipline, it just makes sure the metadata Step 9 needs was actually checked for during the read rather than assumed afterward.

### 6. Sequential slicing for long transcripts (roughly 90+ minutes or equivalent length)

For a transcript long enough that a single continuous read risks losing chunk-map fidelity (rough guide: over about 90 minutes of source material, or a proportionately long written transcript), process it in sequential slices:

- Read and chunk-map one slice at a time, in source order.
- Carry forward only the chunk map from prior slices into the next slice's context — never the raw text already processed.
- Continue theme-labeling and anchoring across slice boundaries as if it were one continuous read; a theme that spans two slices is still one chunk (or a clearly linked pair) in the final map, not artificially split by the slicing mechanism.
- Run §4's coverage check once, at the end, against the complete assembled chunk map — not per slice.

### 7. Hand the chunk map to SOP-015 Steps 3–10, unchanged

This SOP's output is the chunk map. SOP-015 continues from its own Step 3 (classification — already decided, since that's what triggered this SOP) through Step 10 (logging), reading only the chunk map, never the raw transcript again. This SOP makes no filing decision, creates no note, and does not decide which entities earn a note — that is SOP-015 Step 5's "does this earn a note" test, run exactly as SOP-015 already defines it.

## A note on raw-source retention (open gap, not resolved here)

General PKM transcript intake currently has no equivalent of Warden's `Sources (Immutable)/` — there is no standing mechanism that preserves the raw transcript text itself once processing is done. This SOP does not assume one exists, invent one, or treat a chunk map as a substitute for raw-source preservation (a chunk map is a derived working artifact, not the source). Until this is resolved, SOP-016 defers entirely to [[SOP-015-cairn-process-external-source]] Step 9's existing honest-flagging behavior: state plainly, per source, what provenance the note actually relies on (title, apparent channel, capture date, metadata per §5 above) and that it is not equivalent to a preserved raw copy. Closing this gap is a design task routed separately to Silas, not something this SOP resolves.

## Worked example

A 45-minute YouTube interview transcript about an AI agent tool arrives, auto-captioned, no clean timestamps beyond rough minute markers embedded in the text. SOP-015 Step 3 classifies it as **Video/Audio Transcript**. Because it runs long and the captions visibly garble proper nouns, SOP-016 activates for Step 2.

One sequential read produces six chunks: intro/positioning, the tool's origin story, its memory-system architecture, a feature comparison against a competitor, a claims/stats segment, and a closing sponsor mention. Each chunk gets a theme label, dense knowledge points, an entity list, an anchor (`[03:10-07:45]` style, derived from the embedded minute markers), and any verification-needed claims. The maker company's name appears three different ways across two chunks ("Nus Research," "UST Research," "Noose Research") — flagged at first occurrence with the normalized guess "Nous Research" and the reasoning (phonetic pattern, independently known collective), not silently corrected. The coverage check confirms every named tool, the memory-system's specific character caps, and the sponsor caveat are all present in the map; the "like and subscribe" outro is dropped as non-substantive. SOP-015 then runs Steps 3–10 against this six-chunk map: classification is already decided, entity candidates are pulled from the chunk entity lists (no re-read), evidence-origin labels are applied per claim using the chunk map's verification-needed flags, backlinks are tested and mostly rejected per the "does this earn a note" bar, the result is filed into the matching Topic note, and the session log records the intake plus the caption-normalization judgment calls.

## Common mistakes to avoid

- Re-reading the raw transcript during classification, entity-listing, drafting, or the coverage check — the chunk map is the artifact from the end of §2 onward; re-reading defeats the point of chunk-mapping.
- Silently picking one spelling for a garbled auto-caption name and presenting it as the source's own clean statement, instead of flagging every observed variant and stating the normalization as a guess (§3).
- Anchoring at sentence level instead of chunk level — anchors mark a chunk's span, not individual claims within it.
- Running the coverage check as a second read of the transcript instead of a checklist pass over the chunk map.
- Treating this SOP as replacing SOP-015's classification, entity/backlink, filing, provenance, or logging steps — it only ever elaborates SOP-015 Step 2. Do not duplicate SOP-015 Step 9's provenance handling here; defer to it.
- Assuming a chunk map must always produce a new note. It doesn't — SOP-015 Step 5's "does this earn a note" test runs against the chunk map exactly as it would against a plain single read, and can still land on zero new notes (see [[PKM/My Life/Topics/ai-tooling]]'s pilot pass).
- Treating a long transcript's slices (§6) as separate sources needing separate classification or separate filing — one transcript, one chunk map, one pass through SOP-015 regardless of how many read-slices it took to build the map.
