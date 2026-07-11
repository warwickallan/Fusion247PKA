---
agent_id: cairn
session_id: wanderloots-transcript-pilot-2026-07-11
timestamp: 2026-07-11T08:00:00Z
type: end-of-session
linked_sops: [SOP-015-cairn-process-external-source, SOP-016-cairn-process-youtube-transcript]
linked_workstreams: []
linked_guidelines: [GL-008-source-classification-registry, GL-010-warwick-knowledge-value-profile, GL-011-immutable-source-retention, GL-002-frontmatter-conventions]
---

# Second real pilot run: the Wanderloots "LLM Wiki" transcript — a correct no-enrichment call

## What I did

Larry handed me T013, the second real pilot source-to-WIKI test (part of
`tsk-2026-07-11-001-absorb-independent-change-qa-doctrine`), already captured to
`Sources (Immutable)/2026/07/2026-07-11-wanderloots-llm-wiki-transcript.txt` per GL-011
(register row already written, status `pending` on handoff). The brief was explicit that
this source was chosen *because* it's conceptually adjacent to my first (Hermes/
NetworkChuck) pilot — both are "AI agent memory/knowledge layer" videos — while being a
genuinely different creator and system, specifically to test whether I can tell
"conceptually similar" from "actually redundant" rather than manufacturing a note to look
productive.

1. **Read the whole transcript once** per SOP-015 Step 3, running [[SOP-016-cairn-process-youtube-transcript]]'s
   chunk-mapping mechanics since this classifies as GL-008's Video/Audio Transcript
   category. Produced a 14-chunk map with `[mm:ss]` anchors, entities, and verification-
   needed claims.
2. **Hit a real, non-trivial raw-source-quality problem**: a ~600-line block spanning
   `[14:00]`-`[18:45]` repeats verbatim roughly fifteen times before the transcript
   resumes forward progress. This is categorically different from ordinary auto-caption
   spelling noise (the Hermes pilot's "Nous Research"/"OpenClaw" case) — it's a wholesale
   duplicated range, most plausibly an artifact of the register's own documented
   acquisition path ("Direct Google Drive fetch... + user upload, manually captured by
   Larry"). Confirmed the transcript is not truncated (reaches a clean, platform-
   boilerplate-confirmed ending at `[33:57]`, consistent with the ~34-minute video), so no
   content was lost — just materially messier to read. Did not perform a second full read
   to resolve it (SOP-016 §2/§4 discipline); the loop is self-evidently a repeat, not new
   material.
3. **Classified: Video/Audio Transcript** (GL-008), mapping to the existing
   `PKM/My Life/Topics/ai-tooling.md` per GL-008's own guidance — same destination
   candidate as the Hermes pilot.
4. **Assigned disposition: Surface for Warwick** — explicitly *not* Enrich. Reasoning
   written up in full in `Deliverables/2026-07-11-08-00-t013-wanderloots-intake-
   disposition.md`: the video's core content (a raw/wiki/schema three-layer personal
   knowledge architecture, an `agents.md`-as-constitution file, an ingest→maintain→lint
   loop, per-note front matter, templates, a catalog/index) is not new information to
   Warwick — it is, point for point, the same architecture already running as this
   myPKA (`Sources (Immutable)/` = raw layer, `PKM/` = wiki layer, `Team/AGENTS.md` +
   Guidelines + SOPs = schema layer, SOP-015/016 = ingest, Larry's Librarian pass +
   SOP-017 = lint/maintenance, `INDEX.md` files = catalog, `Team Knowledge/Templates/` =
   templates, git = the same save-point mechanism). Filing that pattern into
   `ai-tooling.md` as a "discovery" would be restating the wiki's own architecture back
   into itself — the genuinely redundant case, distinct from the Hermes pilot where the
   *content* (a specific competing product's feature set) really was new.
5. **Surfaced, not built, four tactical patterns** that are genuinely not yet part of
   myPKA and are architecture-evolution calls only Warwick should greenlight: a
   local-model draft→review-folder→approve loop (Ollama-based in the source); an explicit
   vault-write firewall/allow-list; scheduled/heartbeat automation for the ingest/
   maintain/lint loop (currently manual/on-demand in myPKA); and Web-Clipper-style raw
   capture as a lighter general-purpose analog to the still-deferred TubeAIR adapter.
   Did not build or wire any of these — that's explicitly not this role's call per my own
   Critical rule 6.
6. **Zero new entity notes, zero backlinks.** Callum/"Wanderloots" searched-for first
   (no existing Person note), rejected on the same "no standalone relationship" logic as
   the Hermes pilot's Jeffrey Carnell call — though notably he *is* cleanly
   self-identified by name in-transcript (`[00:32]`), a genuine evidence-origin
   improvement over the Hermes pilot's inferred-channel case, which didn't change the
   note-creation call. Obsidian/Codex/Python/Git/Ollama/LM Studio all rejected as tool
   mentions with no GL-002 entity type to fit and, since nothing was promoted this pass,
   nothing to fold into narrative either.
7. **`ai-tooling.md` was not touched.** No frontmatter edit, no new section — correctly
   left alone this pass.
8. **Updated the register row** (`Sources (Immutable)/INDEX.md`) — `disposition: Surface
   for Warwick`, `destinations: none`, notes updated with the full outcome summary and a
   pointer to the deliverable.

## Judgment calls worth flagging

- **The central call of this whole pass**: choosing "Surface for Warwick" over "Enrich"
  required actually naming *why* the source is redundant, not just noting it's topically
  similar to the Hermes pilot. The test wasn't "is this the same subject as before" (it
  isn't, really — one's a product comparison, one's a build-your-own-PKM tutorial) but
  "does this teach Warwick something he doesn't already have." Once I mapped the video's
  own three-layer architecture directly onto myPKA's actual existing folder/file
  structure, the redundancy became concrete and citable rather than a vague feeling.
  Worth remembering as the actual mechanism for this kind of call in future pilots: map
  the source's claims onto what already exists, specifically, before deciding.
- **"Surface for Warwick" vs. "Retain source only."** I judged flat Retain-source-only
  would undersell four real, if narrow, tactical ideas (the four listed above) that
  aren't nothing — they're legitimate candidate system-evolution items, just not
  Cairn's to decide or build. GL-010 explicitly names this disposition for exactly this
  shape of "ambiguous, high-impact, preference-sensitive" call.
- **The raw-source duplication defect** is a genuinely new failure mode I hadn't hit on
  the Hermes pilot (which had spelling noise, not structural duplication). I resolved it
  the way SOP-016 already prescribes (recognize the repeat, don't re-read, don't invent
  content to fill a gap that isn't actually there) but flagging it in both the deliverable
  and here because if the same Google-Drive-fetch-plus-manual-upload acquisition path
  gets reused, this exact failure mode may recur — worth Larry/Mack's attention on the
  acquisition side, not a Cairn-side fix.
- **Callum/Wanderloots's clean self-identification** (vs. Hermes pilot's inferred
  "NetworkChuck" channel attribution) is a good evidence-quality contrast worth noting:
  cleaner provenance on the creator's identity did not change the entity-note-creation
  call, because the "does this earn a note" test is about standalone relationship/
  reusable knowledge, not evidence cleanliness. Two different axes; don't conflate them.

## What the next agent must know

- This is a **same-model processing pass**, not an independent QA review of itself — the
  deliverable says so explicitly. T013 does not close on this pass; that's gated on a
  later, genuinely independent review, per the brief. Do not treat this session log as
  that review.
- `PKM/My Life/Topics/ai-tooling.md` is unchanged since the Hermes pilot — still only
  carries the one `## External intake` entry from that first pass.
- The four surfaced tactical ideas (local-model draft/review/approve loop, vault-write
  firewall, scheduled heartbeat automation, web-clipper-style raw capture) are recorded
  in the deliverable and this log only — they are not tasks, not tickets, not committed
  to anywhere else. If Warwick wants any of them pursued, that's a fresh routing decision
  for Larry (likely Mack for automation/connector wiring, Vex for the firewall/security
  angle), not something this pass initiated.
- The raw-payload duplication defect is real and undocumented anywhere except this log
  and the deliverable — if anyone later re-reads
  `Sources (Immutable)/2026/07/2026-07-11-wanderloots-llm-wiki-transcript.txt` and is
  confused by the repeated block, this is why, and it does not indicate missing content.
- `Sources (Immutable)/INDEX.md`'s row for this source is now fully populated
  (`disposition`, `destinations`, `notes`) — no longer `pending`.
