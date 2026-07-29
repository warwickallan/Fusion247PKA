# YouTube source pipeline — comprehension regression DIAGNOSIS (no implementation)

**Trigger:** Warwick dropped `vJEy3nP2_C8` ("Most Valuable Skill of 2026: Managing AI Agents") and did not get a
standalone brief that lets him skip watching. That is the BUILD-002 primary user outcome, and it is not being met.

## Three jobs, currently conflated

- **A · Source Intelligence** — "what did this source *say*, comprehensively enough that Warwick need not consume it."
- **B · Arc / Transfer** — "what useful transfers/ideas/implications derive from it."
- **C · Mason / Opportunity** — "what coherent opportunities emerge across the accumulated estate."

A rich Arc atom set is NOT a source reconstruction. A Mason opportunity list is NOT a source summary. The live
pipeline delivers thin B and C and **skips A entirely**.

## 1. Is the BUILD-002 source-comprehension requirement met? **NO.**

BUILD-002 CONTRACT explicitly required it (lines 61, 170, 201-204, 235-237, 323-326): the YouTube path applies
`F247.template.youtube-transcript-knowledge-note` to produce a **standalone knowledge note** that must "stand alone
without the video; capture mechanisms, workflows, tools, people and examples; separate claims from verified facts;
record uncertainty and source gaps" + "executive orientation; structured knowledge brief; key concepts and
takeaways; implications for Fusion247" — Cairn categorises + routes it to the Brain/Obsidian vault, and a
**standalone human-readable brief** is shown. Approved. It is **not delivered by the live path.**

## 2. Exact live pipeline trace (what actually happens on a dropped URL)

`Telegram link → fusion-capture-gateway (capture_envelope)` → `services/hub/youtube/watch-captures.mjs` polls →
`youtubeClassify` → **TubeAIR** (`tools/tubeair/tubeair.py`, DETERMINISTIC, no LLM — cleans the transcript into a
§7.1 "reading view" packet) → `ingest.mjs` writes the **immutable RAW** + a `cockpit.youtube_source` row with
`review_state='ai_created'`, **`note_path = NULL`**, `brief_markdown = "…standalone knowledge note **pending
in-session**…"`, `learning_count = 0`. **End of automated path.**

The knowledge note was only ever produced by **`finish-note.mjs`** — whose own header says the note *"needs a
session, not a headless API key"* and which merely **files a note body Larry authored by hand** (`--body=<path.md>`).
It was run manually, in-session, for exactly two proof videos (`pcR30j-sKxU`, `dhbcVxYhWaQ` — note the bespoke
`finish-note-solo-ai.mjs`). It is **not** wired into the watcher.

Then, separately and later, the **idea-engine** was bolted on: the Cockpit **Mine** button → **Arc** (`mine-ideas.mjs`,
T1) reads the **raw transcript** (not a knowledge note) → atoms → **Mason** (`mason-synthesise.mjs`) → opportunities.

**For `vJEy3nP2_C8` specifically:** `review_state=ai_created`, `note_path=null`, `learning_count=0` — captured,
transcript preserved, **no knowledge note, no source reconstruction.** Job A never ran.

## 3/4. Where the requirement was lost

It was **proven manually but never automated** — a "walking skeleton" that stayed a skeleton. At BUILD-002 time the
stated reason was that generating the note "needs a session, not a headless API key." That constraint is now **stale**:
`claude -p` headless Sonnet is proven throughout the idea-engine (Arc/Mason both use it). The gap is not a missing
capability; it is a **missing automated call** to the note generator. The idea-engine then grew on top of the
transcript, so the *impression* of "YouTube works" was created by B/C, masking the absent A. (Ironically, the
engine's own atoms flagged "pending_cairn knowledge-note write-up" as a HIGH backlog item — the system diagnosed
its own gap and it was never closed.)

## 5. Coverage map for `vJEy3nP2_C8` (regression fixture — source themes vs outputs)

Knowledge note: **absent**. Arc: **3 atoms**. Mason: 5 surfaced opportunities (drawn from the 3 atoms + the estate).

| Material theme in the source | Knowledge note | Arc atom | Mason |
|---|---|---|---|
| Manager-of-agents thesis (the spine) | ✗ | ✗ | ✗ |
| Cloud-agent isolation / parallelism | ✗ | ✗ | ✗ |
| Technical knowledge becomes MORE valuable | ✗ | ✗ | ✗ |
| Phone-first management | ✗ | ✗ | ✗ |
| High-stakes decision cadence (~25 min) / attention | ✗ | ✗ | ✗ |
| Production credential gating (ask-for-the-key) | ✗ | ✗ | ✗ |
| Parent-premium → cheaper child agents | ✗ | ✗ | ✗ |
| Recurring automation replacing team check-ins | ✗ | partial | partial |
| Browser testing / self-observation | ✗ | ✓ (atom) | ✓ |
| Rubric → grade → child-agent-fix self-improvement | ✗ | ✓ (atom) | ✓ |
| Production Watchdog / chief-of-staff | ✗ | ✓ (atom) | ✓ |
| Software-factory trajectory | ✗ | ✗ | ✗ |
| Vendor lock-in / independent-agent-lab warning | ✗ | ✗ | ✗ |
| Model / cost routing | ✗ | ✗ | ✗ |
| Public reputation / X / sharing learning | ✗ | ✗ | ✗ |
| Sahil Bloom reputation→opportunity example | ✗ | ✗ | ✗ |

**≈3 of 16 material veins retained (all as *transfers*), zero source reconstruction.** That is the regression: a
comprehensive reader must retain every vein; the current pipeline retains a cherry-picked handful and reconstructs none.

## 6. Why the X / public-reputation vein was missed

It was missed because **nothing in the pipeline is trying to comprehend the source.** Arc is a *transfer* extractor:
it hunts mechanisms that map onto a Fusion *component*. "Build a public reputation on X; sharing learning opens
doors" is not a component-transfer — it is a strategic/career theme — so Arc's lens slides right past it, exactly as
it would slide past any theme that isn't a neat mechanism→target mapping. A **Source-Intelligence** step reading for
*"what did this say"* would have retained it as a first-class theme (and it is arguably the single most Warwick-
relevant vein: Fusion builds → VlogOps → X proof-of-work → authority → a withheld private capability → relationships → revenue).

## 7. Why only 3 Arc atoms (secondary, real, but NOT the primary problem)

Contributing: T1 (single Sonnet pass) compresses 7,500 words lossily; the ZERO-rule + first-three-discard + self-kill
are conservative and novelty-biased (they likely binned the *most valuable* transfers — manager-of-agents,
model-routing — as "too obvious"); and the A+B+C brief did not foreground Warwick's current priorities, so Arc
couldn't connect the source to live work. **But fixing these does not restore Job A** — a higher-recall Arc still
produces *transfers*, not a *reconstruction*. Do not mistake "more atoms" for "source comprehension."

## Ownership: Source Intelligence vs Arc vs Mason — **no new agent needed**

- **A · Source Intelligence** is **Cairn's** job and always was — Knowledge Intake, SOP-015, the
  `youtube-transcript-knowledge-note` template. The responsibility exists and is unfilled, not missing. The current
  model *can* support it; it was never wired.
- **B · Transfer** = Arc. **C · Synthesis** = Mason. Both stay exactly as they are, but move **downstream of A** —
  Arc should read the comprehension (or the transcript with the comprehension available), not the bare transcript.

## 8. Smallest correction that restores the goal (no architecture rebuild)

Wire the note generator that already conceptually exists:

1. **Automate Cairn's knowledge-note step** in the live path: after `ingest` leaves a source `note pending`, a
   headless `claude -p` (Sonnet) applies the `youtube-transcript-knowledge-note` template to the RAW transcript →
   produces the **standalone knowledge note** (the BUILD-002 section set) → `finish-note.mjs`'s existing write path
   files it through the one write authority, flips `pending→noted`, sets `note_path`/`brief_markdown`. This is the
   single missing automated call — the generator's stated "needs a session" blocker is dissolved by headless Sonnet.
2. **Make the note the PRIMARY Cockpit output for a source** — a "What this source says" brief (SPIN/section-first),
   with Arc's transfers and Mason's opportunities as *secondary* layers beneath it, not the headline.
3. **Point Arc at the comprehension** for higher recall, and add a light **source-delta** note ("what's new vs the
   estate") between Arc and Mason — but this is the *follow-on*, not the minimal fix. Minimal fix = steps 1-2.

No new agent. No new architecture. One automated LLM call filling a stage that was designed, approved, and left manual.

## 9. Acceptance / regression test (coverage against the SOURCE, not atom accounting)

"All emitted atoms accounted for" is NOT evidence of completeness — it only proves nothing the model *emitted* was
lost. Completeness must be measured against the **source**:

- **Theme-coverage fixture:** a frozen list of the material veins in `vJEy3nP2_C8` (the 16 above, authored by a human
  reader). ACCEPTANCE: the generated knowledge note covers **every** vein in substance (not the atoms — the *note*),
  with the X/reputation + Sahil-Bloom veins explicitly present. Score = veins-covered / veins-in-fixture; target 100%
  of *material* veins, with a stated confidence/gap for anything the transcript itself left thin.
- **Standalone test:** a second reader (or a fresh model) given ONLY the note can answer "what were the source's main
  claims, mechanisms, tools/people, and its argument about reputation?" without the transcript. If they can't, the
  note fails "stand alone without the video."
- **Structural test:** the note contains the BUILD-002 section set (orientation · reconstruction · mechanisms · tools/
  people/products · examples · claims+confidence · caveats/gaps · Fusion implications · takeaways · actions/questions).
- Run the fixture on `vJEy3nP2_C8` as the standing regression; extend to 1-2 more frozen sources before calling it fixed.

## Bottom line

The primary BUILD-002 outcome — *drop a URL, get a brief you can trust instead of watching* — **is not currently
delivered**; it was proven by hand and never automated, and the idea-engine's B/C output masked the missing A.
The fix is small and owned: automate Cairn's already-specified knowledge-note step with headless Sonnet and make it
the headline output, leaving Arc/Mason downstream. This is a product-outcome correction, not an architecture change.
