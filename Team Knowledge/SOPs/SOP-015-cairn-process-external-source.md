# SOP-015 - Cairn: Process an External Source into the Wiki

- **Default owner:** Cairn
- **Reusable by any agent.** Any specialist who occasionally files an already-acquired external source into `PKM/` follows this procedure — it is not exclusive to Cairn, only usually run by Cairn.
- **Triggered by:** a source the user or team has already acquired (an article, PDF, transcript, pasted chat excerpt, course note, email) is handed to Cairn directly, or a `Team Inbox/` item is general external material rather than the user's own first-person life narrative (see [[Team/Cairn - Knowledge Intake Specialist/AGENTS]] §Boundary vs Penn).
- **Output:** (a) a recorded user-intent statement explaining why the source was added; (b) one classification decision, stated in one line, for the source; (c) a filed or updated `PKM/` entity note (or notes), or an explicit no-promotion disposition; (d) a session-log entry recording the intake.
- **References:** [[GL-008-source-classification-registry]] (the six-category classification vocabulary), [[GL-002-frontmatter-conventions]] (the eight entity-type schemas this SOP files into), [[GL-001-file-naming-conventions]] (slug rules), [[Team Knowledge/Templates/INDEX]] (starter templates), [[Team/Cairn - Knowledge Intake Specialist/AGENTS]] (the contract this SOP operationalizes), [[SOP-016-cairn-process-youtube-transcript]] (subordinate procedure elaborating Step 3 below for long/structured GL-008 Video/Audio Transcript sources — chunk mapping, not a replacement for Steps 4-11).

## Purpose

Cairn's contract (§Method) states the intake discipline in prose. This SOP is the same discipline written as an actual step-by-step procedure — one canonical process any acquisition channel (a pasted excerpt today, a future TubeAIR YouTube capture, an ICOR course-note drop, an emailed article) can hand off into. Adapters own acquisition and handoff only; they never duplicate the steps below. This SOP does not build or wire any adapter — see Cairn's contract §v1 scope.

## When to call this

- Larry routes a `Team Inbox/` item to Cairn because it's general external material, not the user's own life capture.
- The user or another specialist hands Cairn a source directly ("here's a transcript, file this properly").
- A future intake adapter hands Cairn a captured source (out of scope to build, but this SOP is what it would call once built).

## Steps

### 1. Ask why this source was added before processing it

Before reading, extracting, classifying, or promoting the source, establish Warwick's intent. If the handoff already states the purpose clearly, repeat it back in one sentence for confirmation. Otherwise ask one lightweight natural-language question:

> What made you add this, and what do you suspect it might affect? "I am not sure yet, but it felt relevant" is a valid answer.

A short free-text answer is enough. Do not turn intake into a form or require Warwick to select categories. Preserve his wording, then let Cairn map it to two optional signals:

- **Why added:** the known reason, question, concern, or opportunity behind the capture.
- **Suspected effect:** what it may influence, such as architecture, tool choice, an existing idea, something to build/test/learn, or a commercial/consultancy possibility.

Either signal may be uncertain or absent. Pattern recognition and intuition are legitimate intake intent; Cairn must not force a precise brief or manufacture certainty. Raw capture may happen before this question so evidence is not lost, but semantic processing stops here until the intent is recorded. Intent is an input to relevance assessment, not proof that the source deserves promotion.

### 2. Confirm the whole source is actually in hand

Before reading, confirm you have the complete material — not a partial paste, not a summary of it. If it's incomplete, ask for the rest before starting. Reading a partial source produces partial, uncorroborated extraction (same failure mode SOP-010 names for Warden's evidence-pack work).

### 3. Read the whole source once, before writing anything

One full pass, start to finish. Resist drafting notes mid-read. As you read, mentally (or in scratch notes) track: what kind of material is this, which named entities recur with substance (not just name-dropped once), and which claims are stated plainly versus implied/interpreted.

For a source that is (or is about to be classified as, in Step 4) GL-008's **Video/Audio Transcript** category and is long or structured enough that a single undifferentiated read would lose track of theme, sequence, or verification-needed claims, run [[SOP-016-cairn-process-youtube-transcript]] for this step instead of an unstructured read — it produces a theme-chunked, anchored chunk map that Steps 4-11 below run against unchanged. Short, clean transcripts can skip it and use this step as-is.

### 4. Classify against GL-008

Decide which of GL-008's six governed categories (Article/Written Source, Document/Report, Video/Audio Transcript, Course/Lesson Note, Chat/Conversation Excerpt, Email/Correspondence) the source is, and note GL-008's "typically maps to" guidance for that category. State the classification decision in one line — this line goes into the destination note's body (see Step 9). If the source genuinely fits none of the six, do not invent a bucket: state your reasoning per-source anyway (what it actually is) and flag the misfit in the session-log entry (Step 11). A single misfit is not grounds to extend GL-008 — that requires a second, independent recurrence per GL-008's own recurrence gate; Cairn flags, Silas decides.

### 5. Identify candidate destination entities

List every named entity (person, organization, tool, subject, event) the source substantively discusses. For each, check whether a matching note already exists under the relevant `PKM/` entity folder before assuming a new one is needed — search first, create second. Cross-check GL-008's per-category "typically maps to" guidance for the entity type each candidate most plausibly belongs to.

### 6. Apply the "does this earn a note" test, per candidate entity

A named entity earns a **new** note only if the source gives real, standalone, reusable knowledge about it — not because it was mentioned. Ask, per candidate:

- Does the source substantively inform this entity's own note (not just use its name in passing)?
- Would a future reader plausibly want to find this entity again as its own thing — i.e., does the CRM/My Life folder's own definition actually fit (People/Organizations = entities **the user interacts with**; Topics = a subject the user actively follows; the other four My Life buckets are the user's own deliberately-set operating layer, never inferred from external material per GL-008 §Note on Goal/Habit/Key Element)?
- Is there an existing entity type this candidate actually fits? GL-002's eight entity types are fixed — a tool, product, or concept that isn't a Person/Organization/Project/Goal/Habit/Topic/Key Element/Document does not get a new entity type invented for it (Cairn's Critical rule 4). It gets folded into the Topic (or other entity) it's evidence for instead.

If the answer is "just mentioned, no standalone reason" — don't create a note. Fold the material into whichever existing/warranted note it's evidence for, as plain narrative (with evidence-origin labels), not as a new file and not as a wikilink to a nonexistent target.

### 7. Label every non-obvious claim by evidence origin

Per Cairn's contract §Method step 3: directly present in the material handed to Cairn, from a preserved raw source, or `Reconstructed / Needs verification`. Do this claim-by-claim as you draft the note body, not as an afterthought. A claim the source states as fact but that is itself an unverified assertion by the source (marketing language, a narrator's opinion, a sponsored claim) is still "directly present" — the label describes where *Cairn* got the claim from, not whether the claim is true. If the claim's truth needs independent checking, say so explicitly and note it as a candidate hand-off to Pax; Cairn does not silently upgrade an unverified claim into a stated fact.

### 8. Draft each backlink and test it before creating it

For every `[[wikilink]]` you're about to write — new or inherited from a template — state the one-line, source-derived reason the target note is actually enriched by it. No stated reason, no link (Cairn's Critical rule 2). This applies even to links a template pre-populates as an example; delete example links that don't earn their place in this specific note.

### 9. File directly into the real destination

Write or update the destination note under its real `PKM/` entity folder. If creating a new note, start from the matching `Team Knowledge/Templates/` file and follow GL-001 for the slug. If enriching an existing note, add the classification line, the evidence-labeled content, and any justified backlinks directly into that note's body — never leave the source sitting in `Team Inbox/` or a staging file once processed. If the existing note is missing required GL-002 frontmatter (a pre-v1.3.0 note that predates the frontmatter mandate), bringing it up to spec while you're already editing it is in scope — filling in the entity's own defined fields is not "inventing an ad-hoc field," it's completing the schema the note was already supposed to carry.

### 10. Address raw-source provenance honestly

State, per source, whether the raw material itself is preserved anywhere, and if not, what the note relies on for provenance instead (title, author/channel, acquisition date, URL if known). Do not fabricate a URL or citation detail that isn't actually in the material handed to you. If the acquisition channel is identifiable from the source's own self-references (a transcript that names its own channel or publication), cite that as directly-present evidence, not reconstruction. If general PKM intake genuinely has no raw-evidence retention mechanism (unlike Warden's `Sources (Immutable)/`, which is scoped to `Client Delivery/` only), say so plainly in the note and in the session log rather than silently treating a citation line as equivalent to raw-source preservation — that's a real gap, not a solved one, until Silas rules on it.

### 11. Log the intake

Write a session-log entry per Cairn's contract §Session-Log Discipline: the intake intent from Step 1, what was classified (and why), where it landed or why nothing was promoted, every evidence-origin label applied, every backlink justification given, any classification misfit flagged for GL-008, and the raw-source provenance call from Step 10.

## Worked example

A pasted YouTube transcript about an AI agent tool arrives, handed directly to Cairn (not via an adapter). Full read once. Classified as **Video/Audio Transcript** per GL-008 — the source is a transcript of a published video. The transcript substantively discusses one tool at length (comparing it to a competitor) but only name-checks its maker's co-founder and a hosting sponsor in passing. Candidate entities: the tool itself (no matching GL-002 entity type — folded into the relevant Topic as narrative, not a new note); the maker company (mentioned as context, not enough standalone material to earn a CRM Organization note — the user has no relationship with it); the co-founder (quoted several times but the video is about the tool, not a profile of him — same call, no Person note); the sponsor (a passing ad mention, no note, no link). Result: one existing Topic note enriched, zero new entity notes, every claim about the tool's features labeled as directly present in the transcript, the narrator's comparative/marketing claims flagged as unverified assertions rather than restated as settled fact, and the video's own self-referenced channel name cited as the provenance line since no separate raw-transcript store exists for general PKM.

## Common mistakes to avoid

- Starting semantic processing before asking why Warwick added the source, or assuming that the topic alone reveals his intent.
- Rereading the source across multiple output passes instead of one full read before writing anything.
- Classifying against a bucket that isn't one of GL-008's six, or silently inventing a seventh category instead of flagging the misfit.
- Creating a new entity note for every named person/organization/tool a source mentions, rather than testing each one against "does this earn a note" (Step 6) — reflexive note-creation is the same anti-pattern as reflexive linking.
- Inventing a new `PKM/` entity type (e.g., a "Tool" or "Product" type) for something that doesn't fit the existing eight — fold it into the Topic or entity it's evidence for instead.
- Restating a source's own unverified or marketing claim as settled fact instead of labeling it as a claim the source makes, with its truth value unaddressed.
- Creating a backlink because a template ships it as an example, without checking it actually earns its place in this specific note.
- Leaving the processed source sitting in `Team Inbox/` or a `Deliverables/` staging file instead of filing directly.
- Treating a citation line (title, channel, date) as equivalent to raw-source retention without saying so explicitly — if there's no preserved raw copy, say that plainly rather than implying otherwise.
