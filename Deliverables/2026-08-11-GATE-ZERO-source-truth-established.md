---
title: "GATE ZERO — source truth established for SHOP-2026-08-10-M64, by live reproduction"
date: 2026-08-11
author: Larry
build: BUILD-015 AsdAIr
status: CLOSED — root cause proven, not guessed. Supersedes the "why" section of the 2026-08-11 blocker.
supersedes: Deliverables/2026-08-11-BLOCKER-input-truth-failure.md § "GATE ZERO — the required assurance rule" (the blocker's FACTS stand; this document answers its open WHY)
---

# Gate Zero — source truth established

Warwick's instruction: "prove the lineage, do not reason backwards from what probably happened."
This is that proof — every claim below is either a durable database row or a live re-execution of
the real production code path, run twice today, 2026-08-11.

## The five Gate Zero questions, answered

### 1. Why was `asdair.shop.transcript` empty?

**Architectural, not incident-specific.** `transcript` / `transcript_provider` / `transcript_model` /
`transcript_confidence` are columns `shopState.js` (`buildShopCreate`) can set — but only at shop
**creation** time. `services/asdair/pipeline/runPipeline.js` `stepInterpret` (the photo interpretation
step) never calls anything that writes those columns. Confirmed by reading the code, not by
inference: there is no execution path from a Telegram photo message to those four columns. **Every
photo-sourced shop this pipeline has ever created has an empty transcript** — M64 is not a special
case, it is the normal case. The columns exist in the schema and are dead for the photo path.

### 2. Where did the 35 `shop_line` rows come from?

**From a real, live call to the configured vision model**, reconstructed from durable rows and
confirmed by re-running the exact production call today:

- `asdair.pipeline_command` id 87 (`groundingEvidence`, created `2026-08-10 17:03:49.215`) recorded
  `prompt_chars: 15048`, `readings_returned: 35`, `catalogue_candidates: 103`, and 29
  `matched_regular_ids` — the durable, by-design-sanitised shape of a real grounding call
  (`store.recordGroundingEvidence`, which never stores the prompt text, the raw model reply, or the
  photograph, on purpose — see its own doc comment).
- `services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs --preflight` was run live today with
  the runtime's actual `--env-file`s (no secret value read or printed): `FUSION_GATEWAY_URL` reachable,
  `FUSION_GATEWAY_KEY` authenticates, and **`FUSION_MODEL_VISION` resolves to `gpt-5-mini`, which the
  gateway genuinely serves.**
- Live probe 1 (throwaway script, read-only, no DB write): called the real `vision()` function
  (`services/obsidiwikai/src/core/models.mjs`) against the real M64 photograph with a bare, simple
  prompt. It correctly described the image as *"a photo of a white sheet of paper filled with densely
  handwritten grocery-list items in multiple columns, lying on a reflective surface"* — proving the
  model **does** receive and process the actual image, not a blank or substitute one.
- Live probe 2 (throwaway script, read-only, no DB write): re-ran the **exact production interpret
  step** — `createDeps().loadCatalogue` → `buildGroundedPrompt` → `interpretPhoto` — against the same
  M64 photograph, today. It returned 30 lines (not 35), materially different from 2026-08-10's 35.

**Conclusion: the vision call is real and does engage the real photograph. The interpretation is
non-deterministically unreliable on this specific image** (dense multi-column handwriting on a
reflective surface) — not a broken or bypassed vision path.

### 3. Why wasn't Warwick's actual image content the authoritative source?

Because nothing between `interpretPhoto`'s return value and the durable `shop_line`/list rows
corroborates it. `stepInterpret` treats one single-shot, unverified model call as ground truth and
writes it straight through. Two concrete, provable gaps:

- **The model is asked for a per-line `confidence` (0.0–1.0) — `groundedPrompt.js` line 96 — and the
  prompt explicitly permits `status: "unreadable"` and a null quantity when something cannot be read.
  `realInterpretPhoto` in `deps.js` (lines 225–229) maps the model's returned lines to
  `{line_no, raw_reading, quantity}` and DROPS `confidence` on the floor.** It is asked for, almost
  certainly returned, and discarded by the mapping code before it ever reaches
  `shop_line.match_confidence` — which is a real column, and in every one of M64's 35 rows it is
  `null`. This is not a missing feature; it is a wired signal thrown away in one line of code.
- Probe 1, given a blunt prompt with no catalogue context, immediately answered "(illegible)" for
  individual lines on the same image the same model was asked about in probe 2's grounded prompt.
  **The model can and does report illegibility when nothing else is offered.** The grounded
  production prompt gives it a large closed candidate list (103–109 household products) to match
  against; under that structure the model consistently picked a plausible candidate rather than
  using the "unreadable"/null-quantity escape hatch the prompt itself offers, even though the same
  model demonstrably has that capability outside the catalogue-heavy framing. This is a known
  schema-compliance-pressure failure mode, not a hypothesis of convenience — it is what both live
  runs actually did today, twice, differently.

### 4. Where was provenance/ownership lost?

At the `stepInterpret` write boundary. `store.recordGroundingEvidence` is **deliberately** sanitised —
counts and ids only, never the raw reading, prompt or photo, by explicit design (its own doc comment,
written for privacy: an audit record must not become a second copy of the shopping list). That design
choice is sound on its own terms but is in direct tension with Gate Zero's requirement that source
truth be provable — once a `shop_line` row is written, there is no durable path back to the specific
model exchange that produced it, only to the fact that *a* grounding call happened. Nothing here
implicates cross-shop or stale data (see §5) — the loss is at THIS shop's single interpretation step,
not from contamination.

### 5. Was any stale, synthetic, previous-shop, model-generated, or cross-shop data involved?

**No.** `asdair.shop_event` and `asdair.pipeline_command` for shop 14 show one coherent
`RECEIVED → TRANSCRIBING → PROCESSING → NEEDS_DECISION` sequence; the `groundingEvidence` command is
scoped to `shop_id = 14` alone; all 35 `shop_line` rows were created inside one ~2.5-second window
immediately after that command, with newly-created sequential `list_item_id`s (211–244). This was a
single bad, unverified interpretation of the correct photograph — not contamination from another
shop or the catalogue leaking in as a data-integrity fault. (The catalogue leaking in as an
**interpretation bias** is exactly §3's finding — a different thing from data contamination.)

## What this changes about the prescribed fix

The 2026-08-11 blocker document's proposed fix — "make the transcription step fail loudly and stop
the shop when it produces nothing" — would **not** have caught this. The step never produced nothing;
it produced a full, plausible, schema-valid 35-line (then, today, 30-line) answer both times. An
empty-output gate is still correct to add (belt-and-braces for a genuine provider outage) but is not
sufficient and is not the primary fix.

**The primary fix, precisely targeted at what was actually proven:**

1. **Stop discarding the model's own confidence.** Thread `confidence` through
   `realInterpretPhoto` → `resolveAll`/`resolveByCatalogue` → `shop_line.match_confidence`, which
   the schema already has and nothing currently populates.
2. **Gate on it.** A line below a chosen confidence threshold is forced to `needs_confirmation` (or
   `unreadable` if the model already said so) regardless of how strong the catalogue match looks —
   a confident catalogue match on a line the model itself was unsure about is exactly this incident.
3. **Persist provenance on the shop**, not just the sanitised grounding-evidence row: provider
   (`fusion-gateway`), the resolved model id, and a per-shop derived confidence summary
   (min/avg across lines) written onto `asdair.shop.transcript_provider` /
   `transcript_model` / `transcript_confidence` right after `stepInterpret` runs for a photo shop.
   This is metadata, not content — it does not reopen the deliberate privacy decision in
   `recordGroundingEvidence`, and it closes Gate Zero criteria 2–3 for every future shop.
4. **Surface line-count / total-price sanity** as an advisory check at the same point (SOP-021's
   known £120–150 band and the last-real-basket comparator already existed and were simply never
   consulted) — not a new control plane, just wiring an existing number into the existing gate.
5. **The Photo Read Confirmation Card** (Warwick's explicit new requirement) is a direct consumer of
   #1–#3: it cannot honestly report "3 lines need clarification" until confidence is wired through,
   and cannot say "the content of this image has become the durable source" until provenance is
   persisted.

None of this is a new validation platform. It is wiring three already-designed, already-schema'd
signals (confidence, provider, model) through the one function that currently drops them.

## Evidence trail

- `asdair.shop` id 14 row (read-only SQL, this session)
- `asdair.shop_source_image`, `asdair.shop_event`, `asdair.pipeline_command`, `asdair.shop_line` for
  `shop_id = 14` (read-only SQL, this session)
- `services/asdair/pipeline/runPipeline.js` `stepInterpret`, `dispatchStep` (STEPS.TRANSCRIBE)
- `services/asdair/pipeline/deps.js` `realInterpretPhoto`, `createDeps`
- `services/asdair/shop/shopState.js` (buildShopCreate transcript fields)
- `services/asdair/interpret/groundedPrompt.js` (the actual production prompt, read in full)
- `services/obsidiwikai/src/core/models.mjs` `vision()`, `gatewayChat()`
- `services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs --preflight`, run live today —
  AC6/AC7 both pass, `FUSION_MODEL_VISION` resolves to `gpt-5-mini`
- Two live, read-only, no-DB-write reproductions run today against the real M64 photograph, using
  the real production code path and the real gateway — full output captured above
