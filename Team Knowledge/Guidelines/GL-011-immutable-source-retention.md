# GL-011 - Immutable source retention

## Purpose

General PKM intake needs a canonical place to preserve raw external sources before Cairn processes them. This Guideline defines that location and the capture semantics for sources handled by [[SOP-015-cairn-process-external-source]], [[SOP-016-cairn-process-youtube-transcript]], and future adapters such as TubeAIR.

Raw retention answers: "What evidence did we preserve?"

It does not answer: "What knowledge should enter the Brain?" That decision belongs to [[GL-010-warwick-knowledge-value-profile]] and SOP-015's disposition step.

## Canonical location

Use the top-level store:

```text
Sources (Immutable)/
  INDEX.md
  YYYY/
    MM/
      YYYY-MM-DD-<slug>.<ext>
```

This is deliberately outside `PKM/`. The raw source layer is evidence, not living knowledge. A single captured source may support PKM notes, Team Knowledge decisions, research outputs, or future adapters.

`Client Delivery/` keeps its own engagement-scoped `Sources (Immutable)/` pattern. This Guideline governs general PKM/team intake only.

## Public/private boundary

The repository may be public during testing. Therefore:

- `Sources (Immutable)/INDEX.md` is tracked and public by default.
- Raw payload files under `Sources (Immutable)/YYYY/MM/` are local/ignored by default.
- Do not publish raw transcripts, PDFs, uploads, or other third-party source payloads unless Warwick explicitly approves that exact publication and any rights/privacy concerns are resolved.

The public register records the mechanism and metadata. The local payload preserves the evidence.

## Register fields

`Sources (Immutable)/INDEX.md` is the register. One row per captured source file.

Required columns:

- `source_id` - stable source slug, usually the filename stem.
- `captured_at` - ISO date or datetime.
- `title` - title or apparent title.
- `category` - one of [[GL-008-source-classification-registry]]'s source categories.
- `acquisition_channel` - e.g. direct paste, TubeAIR, ICOR adapter, manual upload.
- `source_locator` - URL, video ID, original filename, or other stable locator when known.
- `hash` - content hash when practical.
- `local_file` - wikilink/path to the retained raw file.
- `status` - active, duplicate, superseded, incomplete, discarded.
- `duplicate_of` - source_id when this capture repeats an existing source.
- `supersedes` - source_id for a prior version this replaces.
- `superseded_by` - source_id for a later version.
- `destinations` - notes, tasks, or deliverables this source fed.
- `disposition` - SOP-015 disposition.
- `notes` - short provenance or handling notes.

## Capture rules

Capture before semantic processing when an adapter or agent has the raw source in hand.

Naming:

- Use `YYYY-MM-DD-<slug>.<ext>` per [[GL-001-file-naming-conventions]].
- Store under `Sources (Immutable)/YYYY/MM/`.
- Use the source's real extension where possible. Plain transcripts use `.txt` or `.md`.

Immutability:

- Never edit a captured payload in place.
- If the first capture was truncated, malformed, or missing metadata, mark the register row `incomplete` or `superseded` and capture the corrected source as a new file.

Duplicates:

- If stable locator and hash match an existing row, do not create a second payload file.
- Record the repeated acquisition in the existing row's notes.

Recaptures:

- If the same stable locator returns different content, create a new payload file.
- Set `supersedes` and `superseded_by` in the register.

Many-to-one destinations:

- One source may feed many destination notes or tasks.
- Do not duplicate the payload into destination folders.

Zero-promotion sources:

- A retained source may have no destination note if SOP-015 disposition is `Retain source only`.
- `Discard where policy permits` sources should not require a payload file unless policy or audit needs retention.

## Adapter rule

TubeAIR and any future acquisition adapter must write the raw payload and available metadata to this store before handing off to Cairn. Cairn processes from the retained source, not from transient chat scratchpad, whenever the source came through an adapter.

## SQLite status

This store does not currently feed [[SOP-002-convert-mypka-to-sqlite]]. If source analytics become necessary, Silas should design a separate source-register table from `Sources (Immutable)/INDEX.md`; raw payloads remain files.
