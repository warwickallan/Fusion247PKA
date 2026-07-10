---
agent_id: cairn
session_id: hermes-transcript-pilot-2026-07-11
timestamp: 2026-07-11T04:30:00Z
type: end-of-session
linked_sops: [SOP-015-cairn-process-external-source]
linked_workstreams: []
linked_guidelines: [GL-008-source-classification-registry, GL-002-frontmatter-conventions, GL-001-file-naming-conventions]
---

# First real pilot run: authored SOP-015, processed the Hermes/NetworkChuck transcript end-to-end

## What I did

Larry briefed me with two things: (1) author my own minimal pilot-processing SOP, per my
contract's deferred "Cross-references" item, and (2) actually run it against a real pilot
source — a YouTube transcript about an AI agent tool called Hermes, provisioned at
`/tmp/.../scratchpad/pilot-hermes-transcript.txt` (Larry's own extraction from the source
system's original CategorisAIr pilot test source).

1. **Wrote [[SOP-015-cairn-process-external-source]]**, structured on SOP-010's precedent
   (header block, Purpose, When to call this, numbered Steps, worked example, common
   mistakes). Ten steps mapping my contract's six-step §Method onto concrete decision
   points — most load-bearing addition beyond what §Method already said in prose: an
   explicit **Step 5 "does this earn a note" test** (search-first, then a real test per
   candidate entity: does the source give standalone reusable knowledge, does the entity
   type actually exist in GL-002's eight, does the folder's own definition — e.g. CRM =
   "the user interacts with" — actually fit) and an explicit **Step 9 raw-source
   provenance** step, since my own contract never actually addressed what to do when no
   raw-evidence-retention mechanism exists (general PKM has nothing like Warden's
   `Sources (Immutable)/`). Registered in `Team Knowledge/SOPs/INDEX.md`, next free slot
   bumped SOP-015 → SOP-016.

2. **Read the full Hermes transcript once**, then ran SOP-015 against it for real.
   - **Classified: Video/Audio Transcript** (GL-008). The transcript reads as
     auto-generated YouTube captions — rough phrasing, garbled sentences, inconsistent
     proper-noun spelling throughout, and a literal "Transcripts:" header — not an edited
     transcript. Maps to a Topic per GL-008's guidance for this category.
   - **Destination found by searching first, not assuming**: `PKM/My Life/Topics/ai-tooling.md`
     already exists as the seeded course-sample Topic, and its own definition ("the
     agents, models, prompts, and workflows I use day to day... hosted tools, the weird
     edge cases I hit while wiring them together") is a near-exact match for this
     source's subject matter. No new Topic created — enriched the existing one.
   - **Entity test run for real, five candidates, zero new notes created:** Hermes (the
     tool), Nous Research (maker company — transcript's captions render it "Nus
     Research"/"UST Research"/"Noose Research"), Jeffrey Carnell (named co-founder,
     quoted extensively), "OpenClaw" (competing tool, rendered "Offenclaw"/"Openclaw" in
     the same transcript), and Hostinger (video sponsor). None earned a new note — see
     §Judgment calls below.
   - **Evidence-origin labels applied** on every substantive claim pulled from the
     transcript: most content labeled `Directly present` (the narrator/company said it),
     with an explicit split between "directly present as a fact I'm recording" and
     "directly present as an unverified claim the source itself makes" — e.g. "fastest
     growing project on GitHub" and "no security incidents to date" are recorded as
     things the video asserts, not restated as settled truth, and flagged
     `Reconstructed / Needs verification` if anyone later treats them as fact without a
     check. One caveat (the sponsorship-bias note) is explicitly marked as my own
     observation, not sourced from the transcript's content, so it doesn't get
     mislabeled as evidence-origin-tagged source material.
   - **Zero backlinks created.** Tested all five candidate entities against the "does
     this earn a note" bar; none passed, so there was nothing to link to. This Topic's
     three pre-existing links (`morning-build-session`, `ship-mvp-by-q3`, `health`)
     predate this pass and were left untouched.
   - **Frontmatter gap found and fixed opportunistically.** `ai-tooling.md` had no YAML
     frontmatter at all — it predates GL-002's frontmatter mandate. Since I was already
     editing the note, I backfilled the Topic schema's own fields (`name`,
     `key_element`, `parent_topic`, `lifecycle: exploring`, `promoted_to`, `tags`) per
     SOP-015 §8 — this fills in fields the schema already defines, it doesn't invent
     anything new.

## Judgment calls (worth flagging, per the brief)

- **"Nus Research"/"UST Research"/"Noose Research" → Nous Research.** Normalized to
  "Nous Research" as the most plausible reading (a real, independently known AI research
  collective, phonetically consistent with the captions' garbling), but stated this is my
  own best-guess normalization, not a clean read from the source — flagged explicitly in
  the note rather than silently picking one spelling and presenting it as fact.
- **"OpenClaw"/"Offenclaw"/"Openclaw" → OpenClaw.** Same call, same reasoning, same
  explicit flag. I do not actually know what real-world product this transcript is
  obliquely referring to, and said so rather than guessing further.
- **Channel identity ("NetworkChuck").** The transcript never states its own channel name
  cleanly — I inferred it from two self-references ("network Chuck Academy" as where the
  full interview/course will be released) plus a recognizable stylistic tell (the
  first-person "prayer for viewers" closing). Labeled this as directly-supported-but-not-
  explicit rather than either `Directly present` (too strong — the source never says
  "this is NetworkChuck" in one clean line) or `Reconstructed` (too weak — there's real
  self-referential textual support, not memory/inference).
- **Jeffrey Carnell — closest call in the whole pass.** He's quoted/paraphrased more than
  anyone else in the transcript besides the narrator, which made "he earns a Person note"
  genuinely tempting. I held the line on "no note" because the video's actual subject is
  the tool, not a profile of him, and — per CRM's own definition — the user has no
  relationship with him; he's a secondhand quote in someone else's product review. If a
  future source gives him substantial independent coverage (e.g. the full interview this
  transcript references), that's the point to revisit, not this pass.
- **Raw-source provenance — my honest call, not a dodge.** I concluded citation (title,
  apparent channel, self-referenced follow-on, processing date) is workable-but-thinner
  provenance for this v1 pilot, and said so explicitly in the note rather than implying
  it's equivalent to a preserved raw copy. **Flagging this to Silas via Larry as a real
  gap**: general PKM intake has no `Sources (Immutable)/`-equivalent, and Cairn will hit
  this on every future intake pass, not just this one. Worth a real design decision at
  some point — even something lightweight (a per-note citation convention, or a shared
  `Sources/` folder under `PKM/` scoped the way `Client Delivery/`'s is) would close a gap
  that currently depends entirely on the processing note itself being accurate, with no
  way to check it against anything if the note's memory of the source ever drifts.

## What felt awkward or underspecified in my own contract, doing this for real

- My contract's §Method step 3 says evidence-origin labels are "directly present /
  preserved raw source / reconstructed" — but it doesn't address the case I actually hit
  most: a claim that is *directly present in the source* but is itself an *unverified
  assertion the source makes* (marketing language, a narrator's opinion, a sponsored
  claim). Neither "directly present" nor "reconstructed" cleanly describes "the source
  said this, but the source itself might be wrong or biased." I resolved it by treating
  "directly present" as describing *where I got the claim from*, not *whether it's true*,
  and adding an explicit sub-note when a claim needed a truth-value caveat. This felt like
  the right call but it's not spelled out anywhere in my contract or GL-008 — worth a
  possible refinement if this recurs (per GL-008's own two-occurrence bar, not a
  first-pass edit).
- My contract's §Method never actually says what to do when there's no raw-source
  retention mechanism at all for general PKM (see above) — I had to reason it out from
  first principles (SOP-010's `Sources (Immutable)/` precedent, explicitly scoped away
  from me) rather than follow an existing instruction. SOP-015 §9 now covers this, but
  it's a gap I had to notice and fill myself on a live pilot, not something the contract
  anticipated.
- The "does this earn a note" test (SOP-015 §5) also didn't exist anywhere before this
  pass — my contract's Core philosophy 3 covers backlinks earning existence, but never
  explicitly extended the same discipline to *note creation itself*. I judged this was the
  same principle one layer up and wrote it into SOP-015 rather than improvising it fresh
  on a future source.

## Files touched

- `Team Knowledge/SOPs/SOP-015-cairn-process-external-source.md` — new.
- `Team Knowledge/SOPs/INDEX.md` — new SOP-015 row, reserved range bumped to SOP-016.
- `PKM/My Life/Topics/ai-tooling.md` — backfilled GL-002 frontmatter, added
  `## External intake — sources processed by Cairn` section with the full pass.
- This session log — new.

## What the next agent must know

- SOP-015 is live and is the canonical procedure for any future Cairn intake pass — do
  not re-derive the method from scratch, wikilink to it.
- The raw-source-provenance gap flagged above is real and unresolved — if Silas or the
  user wants to close it, that's a schema/doctrine decision, not something I can decide
  unilaterally (matches my own "never invent ad-hoc fields, never unilaterally restructure
  a root" boundary).
- `PKM/My Life/Topics/ai-tooling.md` now has frontmatter; if any future automation assumed
  it didn't (unlikely, but worth a sanity check if something breaks), that assumption is
  now stale.
- No `Team Inbox/` cleanup was needed this pass — the source was handed to me directly by
  Larry, never staged there.
