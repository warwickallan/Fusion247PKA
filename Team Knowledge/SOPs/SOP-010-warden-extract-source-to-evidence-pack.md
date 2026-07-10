# SOP-010 - Extract a Source into an Evidence Pack

- **Default owner:** Warden
- **Reusable by any agent.** Any specialist processing a captured source under `Client Delivery/` follows this procedure — it is not exclusive to Warden, only usually run by him.
- **Triggered by:** a new raw source lands in `Sources (Immutable)/` and hasn't been extracted yet, or an existing Register Item's `reread_flag` (`recommended`/`mandatory`) fires and the source needs a further pass.
- **Output:** (a) new or updated Register Items in `Risk-Issue-Change-Decision Register/`; (b) one Evidence Pack per source in `Sources (Immutable)/Evidence Packs/`.
- **References:** [[GL-006-client-delivery-frontmatter-conventions]] (source-tier doctrine; `evidence_type` / `confidence` / `reread_flag`), [[GL-001-file-naming-conventions]], `Team Knowledge/Templates/register-item.md`.

## Purpose

This is the foundational skill everything else in the four meeting-intelligence SOPs ([[SOP-011-warden-meeting-prep]], [[SOP-012-warden-configuration-guide]], [[SOP-013-warden-meeting-summary]], [[SOP-014-warden-consultant-summary]]) depends on. A captured source (a call transcript, a client email thread, meeting notes) gets read once, in full, and that single read produces two durable outputs: the structured Register Items the source actually supports, and a companion Evidence Pack that lets every downstream skill work from a distilled record instead of reopening the raw source. This is the procedure behind "the transcript gets read once, not three times."

## When to call this

- A new file lands under `Sources (Immutable)/` and has no matching Register Items or Evidence Pack yet.
- A `reread_flag: mandatory` or `reread_flag: recommended` trigger fires on an existing Register Item (see GL-006's trigger list) and someone needs to go back to the source to resolve it. Treat this as a **reread pass** on an existing source — append to its Evidence Pack, don't create a second one.

## Steps

### 1. Confirm the source is captured and indexed

Check the source already sits in `Sources (Immutable)/`, untouched since capture, and has a row in that engagement's `Sources (Immutable)/INDEX.md` document register (title, capture date, source tier, one-line description, wikilink). If it isn't indexed yet, add the row now — assign the tier per GL-006's source-tier doctrine (transcripts/emails/meeting notes are typically tier 3; a contract or SOW is tier 1; signed-off requirements are tier 2).

### 2. Read the whole source once, before writing anything

One full pass, start to finish. Resist the urge to start drafting Register Items mid-read — a partial read produces partial, uncorroborated extraction. As you read, note an **anchor** for every extractable item: who said it (if named), and roughly where in the source (timestamp, paragraph, line). This anchor is what makes every later reread targeted instead of full — without it, SOP-011 through SOP-014 have no way to jump straight to the right spot.

### 3. Extract with discipline, not enthusiasm

While reading:

- Capture only what the source actually supports. If you find yourself filling a gap because "that's probably what they meant," that's an `assumption`, not a `direct-statement` — say so.
- Keep fact and interpretation separate at the point of capture. Don't blend "X said the go-live date is at risk" with "which means the whole milestone is probably going to slip" — the second sentence is interpretation and belongs in a summary skill (SOP-014), not in the extraction.
- Preserve speaker attribution wherever the source names who said what. An unattributed "it was agreed" is not evidence of agreement.
- Note apparent conflicts against any tier-1/tier-2 baseline material already captured for this engagement (contract, SOW, signed-off requirements). Flag it — do not resolve it. Resolving a tier conflict is a scope/risk-acceptance call that belongs to the user via Larry, not to an extraction pass.

### 4. Decide `evidence_type` for each item

Walk through GL-006's enum in order and stop at the first one that genuinely fits — don't default to `direct-statement` because it's first:

- `direct-statement` — someone stated it plainly.
- `demonstrated` — observed in action (a system behaviour shown, a deadline actually missed), not just stated.
- `agreed-decision` — explicit sign-off from someone with the authority to decide. Reserve this one. If the source shows discussion trending toward agreement but no one actually says "agreed," "confirmed," or equivalent, this is not `agreed-decision` — it's `suggested-option` or `unresolved-discussion`.
- `suggested-option` — raised as a possibility, not committed to.
- `assumption` — filled in because nothing in the source said otherwise.
- `inference` — you connected dots the source didn't state directly.
- `unresolved-discussion` — the source shows disagreement, or an open thread with no resolution reached.

### 5. Decide `confidence` for each item

Named band, with the reason written into the item's `## Description` or `## Reconciliation log` — never a manufactured percentage:

- `high` — direct or demonstrated evidence, one clear source, no contradiction elsewhere.
- `medium` — real but indirect evidence (an inference, a single unconfirmed statement, some ambiguity).
- `low` — an assumption, a disputed point, a single uncorroborated mention, or something that contradicts another source.

### 6. Decide `reread_flag` for each item

Use GL-006's trigger list exactly — don't invent new trigger categories. Set `recommended` or `mandatory`, and record which trigger applied in the item's `## Reconciliation log`, whenever:

- `confidence: low`.
- Attribution is disputed.
- The source shows contradictory discussion.
- `evidence_type: inference`.
- The item, or anything built from it, intends to state something was **"agreed."**
- A possible conflict with a tier-1 artifact — always at least `recommended`, `mandatory` if resolution depends on which side is right.

(SOP-012 adds one more downstream-facing check tied to this same list — "configuration instructions incomplete" — but that's a trigger for *reopening the source during configuration-guide work*, not a new item you assign here. Leave the field at whatever GL-006's list above produces.)

### 7. Write or update the Register Items

One file per item under `Risk-Issue-Change-Decision Register/`, from `Team Knowledge/Templates/register-item.md`, next sequential `NNN` for the engagement. If the item already exists (this is a reread pass), append a dated line to its `## Reconciliation log` — never overwrite prior fields silently. If `evidence_type`, `confidence`, or `reread_flag` changes as a result of the reread, log why in the same entry.

**Note on "actions":** GL-006's Register Item schema has no discrete `action` kind (risk, issue, change, decision only). Treat an action item as either a `decision` register item's own follow-through (tracked via its `owner` and `target_resolution_date`) or a Work Package's `target_date`. Don't invent an `action` kind to work around this — flag it to Silas via Larry if a real engagement later shows this mapping isn't holding up.

### 8. Build or extend the Evidence Pack

One Evidence Pack per source. See §Evidence Pack shape below for contents, location, and the tier reasoning behind that location.

### 9. Surface contradictions, low-confidence items, and unresolved threads

List them explicitly in the pack's own sections (§Contradictions, §Low-confidence items, §Unresolved items) so SOP-011 through SOP-014 don't have to re-derive them from the Register.

### 10. Log the pass

Add a one-line dated entry to the Engagement note's `## Status update` ("source extracted, N register items created/updated, pack linked") and write a session-log entry per Warden's Session-Log Discipline. This is what keeps the extraction discoverable centrally, per Warden's Critical rule 8 — a pass that only lives inside the Evidence Pack, with no trace in the Engagement note or session log, is exactly the "logged only in a project-local file" failure mode that rule exists to prevent.

## Evidence Pack shape

**Location:** `Client Delivery/<engagement-slug>/Sources (Immutable)/Evidence Packs/<source-slug>-evidence-pack.md`

**Tier reasoning (why here, and why this isn't itself tier 3):** the Evidence Pack is not raw evidence — it's a processed distillation of a read of raw evidence, so per GL-006's source-tier precedence doctrine it is properly **tier 4 (structured project knowledge)**, the same tier as the Register Items it links to, not tier 3. It lives physically next to its source, inside `Sources (Immutable)/`, for the same reason GL-006 already tolerates one processed artifact there — the document-register `INDEX.md` — living alongside raw captures: 1:1 discoverability with what it describes matters more here than folder purity. To keep the raw/processed distinction legible despite that proximity, it sits in a named subfolder, `Evidence Packs/`, never loose among the raw captures themselves. And unlike a raw capture, the pack is **not immutable in the same sense** — a reread pass appends a new dated section to the pack's own `## Reread log` rather than silently rewriting the prior read, the same append-only discipline GL-006 already requires of a Register Item's `## Reconciliation log`.

**No frontmatter.** Plain structured markdown, same shape as the Work Package Catalogue and Comms Plan — a rollup/synthesis document, not an individually foreign-keyed entity. Register Items link back to the *source* via `source_ref`, not to the pack; the pack is a reading aid, not a new thing other entities point at.

**Contents:**

- `## Source metadata` — title, capture date, source tier, attendees/participants (if a meeting), approximate duration/length, wikilink to the raw file, wikilink to its `Sources (Immutable)/INDEX.md` row.
- `## Structured summary` — 3-8 sentences, factual recap only, no interpretation.
- `## Speaker / topic index` — table of speaker-or-topic, anchor(s), what they covered. Skip if the source has no discrete speakers (e.g. a single email).
- `## Key extracts` — short quotes or near-verbatim extracts with anchors, for the items most likely to need a future targeted reread.
- `## Register items produced` — table: register-item wikilink, `kind`, `evidence_type`, `confidence`, `reread_flag` — one row per item this pass produced or touched.
- `## Contradictions` — anything the source said that conflicts with another source or with itself.
- `## Low-confidence items` — wikilinks to `confidence: low` items, one-line reason each.
- `## Unresolved items` — open threads the source raised but did not resolve.
- `## Reread log` — dated entries, one per further pass of this same source. Append-only.

## Worked example

Source: `2026-04-02-ptw-workshop-transcript.vtt` lands in `Client Delivery/bellrock-npl-implementation/Sources (Immutable)/`. Warden indexes it (tier 3) in that folder's `INDEX.md`, reads it once, extracts eleven items — three `risk`, two `issue`, four `change`, two `decision` — writing `bellrock-npl-implementation-reg-014` through `-024`. One item (permit-expiry notification ownership) is `evidence_type: assumption`, `confidence: low`, `reread_flag: recommended` because attribution of who owns notification config is disputed between two speakers. Warden builds `Sources (Immutable)/Evidence Packs/2026-04-02-ptw-workshop-evidence-pack.md`, logs the pass in the Engagement's `## Status update`, and writes a session log. SOP-011 through SOP-014 later read the pack; none reopen the VTT except a targeted check on the disputed-attribution item.

## Common mistakes to avoid

- Rereading the source three separate times across SOP-011 through SOP-014 instead of building the pack once — defeats the entire point of this SOP.
- Skipping anchor capture during the first read — without anchors, a later "targeted reread" is really a full reread in disguise.
- Marking `evidence_type: agreed-decision` because the discussion trended toward agreement, without an explicit sign-off statement in the source.
- Drafting Register Items before finishing the full read — produces partial, uncorroborated extraction.
- Filing the Evidence Pack loose in `Sources (Immutable)/` instead of in `Evidence Packs/` — blurs the raw/processed distinction the tier reasoning above depends on.
- Not logging the pass in the Engagement's `## Status update` or a session log — leaves the extraction discoverable only inside the pack itself, which is the project-local-logging failure this SOP exists partly to prevent (Warden's Critical rule 8).
- Inventing an `action` kind or a new `reread_flag` trigger not on GL-006's list — route real gaps to Silas via Larry instead.
