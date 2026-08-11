---
title: "Independent research — Luna/Sol/Terra model family, and cross-sourced technical review of the vision-pipeline + Cockpit provenance design"
date: 2026-08-11
author: Pax (Senior Researcher)
build: BUILD-015 AsdAIr
commissioned_by: Larry, on Warwick's instruction ("Pax's report on improving the pipeline and OCR")
reviews: Deliverables/2026-08-11-cockpit-and-vision-pipeline-design.md (Parts 1 and 2)
status: RESEARCH DELIVERABLE — not a Work Order, not build authorisation. Feeds Larry's decision on
  whether/how to proceed with the design.
---

# Independent research — Luna/Sol/Terra, and cross-sourced review of the vision-pipeline design

## Executive summary

**"Sol," "Terra," and "Luna" are real, currently-shipping OpenAI models** — the three capability
tiers of the GPT-5.6 family, generally available since 9 July 2026 (Sol = flagship, Terra = balanced,
Luna = cost-efficient). This is independently confirmed across OpenAI's own announcement, AWS
Bedrock's integration docs, and four independent trade-press writeups. Warwick's recollection was
correct; the design doc's "unresolved" framing was reasonable at the time it was written but is now
resolved by public evidence. **What public sources cannot settle is why this build's own gateway
registry doesn't list `sol` or `luna` aliases** — that is a local configuration question only a live
gateway probe answers (see Finding 1).

On the pipeline design: **the core architecture holds up and is not a plausible-sounding invention —
several of its choices match documented, named patterns in real systems** (region-ID grounding is
architecturally identical to Anthropic's production Citations API; confidence-gated re-read on flagged
crops matches a documented hybrid-OCR pattern). **One real gap:** the design bundles the full page and
all numbered strips into a single multimodal call; published evidence on multi-image VLM prompting
points the other way — individually-processed crops generally outperform multiple images concatenated
into one request — and the design doesn't address the standard tiling failure mode (duplicate/split
reads at strip-boundary overlaps). **On the model question specifically:** public OCR/text-extraction
benchmarks for GPT-5.6 show only a small gap between Terra and Sol (roughly 88.8→90.7% mean similarity,
79.4→82.5% text extraction) — smaller than the swing needed to fix 9 quantity errors and 9+ missing
items on the reference photo. This is independent evidence *for* the design's own "test protocol, not a
swap" caution in Amendment 2: better input (rotation/crop/strips) is more likely to be the fix than a
model upgrade, and the design already sequenced it that way.

---

## Finding 1 — The Luna/Sol question (public-source verification)

**Confidence: High** on model existence and tier positioning (3+ independent primary/secondary
sources agreeing). **Confidence: Not verifiable from here** on whether this build's gateway currently
exposes them — that is explicitly out of scope for public research and requires the live probe the
design doc already identifies as GL-012-blocked.

### What is established

GPT-5.6 shipped as a three-tier family — **Sol** (flagship), **Terra** (balanced/everyday), **Luna**
(fast/cheap) — publicly released 9 July 2026 after a limited preview and a US Commerce Department
review, confirmed independently by OpenAI's own product pages, AWS's Bedrock integration
announcement, and OpenAI's own account on X announcing the rollout to ChatGPT, Codex and the API.
Three independent trade-press sources (Vellum, MarkTechPost, CometAPI) describe the same tier
structure and the same relative pricing shape, which is the cross-source agreement the naming claim
needed:

- **Sol** — flagship, best on agentic coding/reasoning/cybersecurity/computer-use benchmarks; supports
  "max reasoning" and parallel-agent "ultra" modes.
- **Terra** — "the balanced, everyday-use option," delivering near-Sol performance on most benchmarks
  at roughly half the cost — described by one source as the recommended default.
- **Luna** — cheapest/fastest tier, "85% of Sol's quality at a fraction of the price," but with a
  documented weak point in long-context recall (41.3% vs Sol's 91.5% on one cited benchmark).

**Pricing (per 1M tokens, input/output) — sources disagree slightly, and the disagreement is
explained, not contradictory:** Vellum (post-30-July-2026 price cut) gives Sol $5/$30, Terra $2/$12,
Luna $0.20/$1.20. CometAPI and MarkTechPost, describing the same family without noting the cut, give
Sol $5/$30, Terra $2.50/$15, Luna $1/$6. Both are internally consistent (same ~25x spread between Sol
and Luna) and the discrepancy is fully accounted for by a stated price reduction between the two
snapshots — flagged, not silently resolved to one number.

**Technical specs, from AWS's own Bedrock integration page (the most primary source found for specs):**
all three tiers share a 272K-token context window, support text **and image** input with text output,
and expose six reasoning-effort levels (none/low/medium/high/xhigh/max). A separate source (search
snippet, OpenAI model docs) cites a larger 1.05M-token context window and 128K max output — this
conflicts with the Bedrock figure and **is flagged as unresolved rather than picked**; it's plausible
the two numbers describe different access paths (native OpenAI API vs Bedrock-mediated), but that
distinction was not independently confirmed and should not be treated as settled.

**Vision/OCR-specific benchmarks (Roboflow, a specialist vision-benchmarking blog, is the primary
source here; figures are corroborated in shape, not digit-for-digit, by a second aggregator, PoYo):**
Sol is "the best vision model OpenAI has released so far" on **detection and counting** (46.2 mAP@50
vs GPT-5.5's 13.8; counting 73.0% vs 64.9%), but on **OCR/text extraction specifically the tier gain
is small and non-monotonic**: OCR mean-similarity Sol 90.7% vs Terra 88.8% vs Luna 88.4% vs the prior
generation GPT-5.5 at 91.2% (i.e. Sol did not clearly beat its own predecessor on plain OCR); text
extraction Sol 82.5% vs Terra 79.4% vs GPT-5.5 87.6% (Sol *regressed* against GPT-5.5 on this specific
metric per this one source). The same source reports Sol handled handwritten notes well in its test
cases but struggled with small, low-contrast text (an example given: blister-pack expiry dates), and
that Sol costs roughly 10s and ~2.5¢ per image versus competitors' sub-1¢ vision calls.

### What public sources cannot settle

- **Whether this build's own LiteLLM gateway currently has `sol`/`luna` model_list entries.** The
  D-2026-08-03-05 probe (3 August 2026) found only `gpt-5.6-terra` among named models — but GPT-5.6's
  Sol/Terra/Luna family had already been GA for nearly a month by then (9 July → 3 August). Public
  research cannot explain that gap; the two live possibilities are (a) the gateway's model_list was
  configured with only the Terra alias and nobody has added Sol/Luna since, or (b) something else
  local to this deployment. **Distinguishing those requires the live re-probe the design doc already
  says is GL-012-blocked — not further web research.** I did not attempt to reach the gateway; I have
  no path to it and was told not to.
- **Exact current API pricing/availability at the moment this is read** — GPT-5.6 pricing has already
  moved once (the 30 July cut, above) in the month since release; a fresh check before any cost
  decision is cheap and worth doing at build time rather than trusting this snapshot.
- **Whether "gpt-5.6-terra" (this repo's literal alias, no vendor prefix) is a native OpenAI API model
  ID or a Bedrock-style ID (`openai.gpt-5.6-terra`) being aliased locally.** Both shapes are attested
  in different sources; which one this specific gateway actually calls is a local-config fact, not a
  public one.

**Bottom line for Amendment 2's research task:** items 1–2 of the proposed live-probe task (does
Sol/Luna exist on the roster now; what's their stated cost/capability) are now **partially
pre-answered by this research** — they exist, and their public cost/capability profile is above — but
the live probe is still the only way to confirm this specific gateway's registered aliases, current
routing, and any household-specific access limits. Items 3–5 (test-on-Terra-first, only escalate if it
fails, no cascade unless proven worthwhile) are unaffected by this research and remain the right
sequencing — see Finding 2.

---

## Finding 2 — Independent technical review of the vision-pipeline design (Part 1)

**Confidence: Medium-High**, drawing on published document-AI engineering practice, VLM-grounding
literature, and one production API precedent (Anthropic Citations), cross-sourced across 3–5
independent write-ups per claim below. This is standard-practice literature, not peer-reviewed
consensus on this exact pipeline shape — treated accordingly.

### What holds up, and against what published practice

1. **Deterministic image prep before any model call (orientation, deskew, border trim) is
   textbook.** Multiple independent sources on production document-AI pipelines converge on
   preprocessing (deskew/denoise/normalize) as the first, free, non-negotiable stage, and on checking
   image quality (DPI/sharpness/contrast) before spending model compute — exactly the design's "free,
   local, no API call" framing. No source disagreed with this step; it's uncontested.
2. **Deterministic sanity checks with no LLM in the loop, after the model call, is a documented
   defense-in-depth pattern**, not a novel idea — production VLM-OCR writeups describe multi-stage
   hallucination filtering (pre-filtering, post-processing, confidence gating) rather than trusting one
   model pass. The design's "implausible quantities / duplicates / no evidence locator" checks are a
   reasonable, if manually-scoped, instance of that pattern.
3. **Confidence-gated, batched re-read of only the uncertain crops** matches a documented pattern in
   hybrid OCR pipelines: run a cheap/fast pass, then route only low-confidence regions to a second,
   more expensive pass — "crop the low-confidence regions and run per-box re-OCR on just those crops...
   without paying N× latency on clean pages." The design's version (one batched follow-up call, never
   per-line, never open-ended) is a sensible, cost-bounded instance of this — consistent with Warwick's
   cost framing.
4. **Region-ID grounding (the model must reference an application-supplied region number, never
   assert its own coordinates) is a real, working production pattern, not this design's invention.**
   It is architecturally identical to Anthropic's live Citations API: the caller pre-chunks the source
   into indexed blocks, and the model is constrained to cite a block index rather than generate a
   free-form span or coordinate — Anthropic's own published evaluation reports this out-performs
   custom free-form-citation implementations by up to 15% on recall accuracy, specifically *because*
   closing the output space to pre-assigned IDs removes the model's ability to invent a plausible-but-
   wrong location. Separately, the general VLM-grounding literature (RAG-with-bounding-box and
   coordinate-grounding papers) independently documents that models "reliably identify relevant
   documents but struggle to localize the precise evidence span" when asked to generate the location
   themselves — the exact problem region-ID grounding sidesteps by not asking the model to generate a
   location at all. Two independent literatures (citation grounding, VLM coordinate grounding) converge
   on the same conclusion from different angles. This is the strongest-evidenced claim in the whole
   design.

### What the design gets wrong or leaves genuinely open — be skeptical here, as commissioned

1. **Bundling the full page + all numbered strips into one multimodal call is the design's weakest
   technical bet, and published evidence leans against it.** Multiple independent sources on
   multi-image VLM prompting report that processing crops/images **individually** tends to beat
   **concatenating multiple images into one prompt** — one source states this plainly for OCR
   specifically ("using bounding boxes to crop images and then processing each cropped image
   individually... is more effective than creating lengthy prompts with multiple instructions...
   reduces hallucinations and inconsistent results"), and a second, independent line of research on
   multi-page/multi-frame VLM input reports the same direction (individual processing outperforming
   single concatenated-frame processing, sometimes by a wide margin). This is not a unanimous finding —
   one countervailing source (on multi-page *document* OCR specifically, a different task shape) found
   value in giving a model the whole-document context alongside a target page — so I am not overclaiming
   a settled answer. But the balance of independent evidence says: **the design's single-call-with-
   everything choice, made explicitly for cost reasons, has a real, non-hypothetical accuracy cost that
   the design doc does not name or budget for.** This deserves an explicit tradeoff decision rather than
   being treated as a free win. Recommendation: this is exactly the kind of claim the design's own
   acceptance test (rerun against the one photograph whose correct answer is already known) should
   settle empirically before it's trusted — cheap to falsify, and falls squarely inside the design's
   existing "test protocol, not a swap" discipline.
2. **The design does not address the standard tiling failure mode: items visible in more than one
   overlapping strip.** Published tiling/sliding-window practice (from object detection, the closest
   documented analogue to overlapping-strip OCR) is explicit that overlap is deliberate *and* that it
   creates duplicate detections at the seams, requiring an explicit merge/dedup step (IoU-based fusion,
   NMS, or equivalent) — "boxes that overlap across tile borders are merged instead of duplicated" is
   treated as a required stage, not an edge case. The design's pipeline names "duplicates" as one of the
   deterministic sanity checks (item 3) but doesn't specify *how* a duplicate arising from the same
   physical line being read once in strip 2 and once in strip 3 gets reconciled — by region overlap, by
   text-similarity matching, or otherwise. This is a real, nameable gap, not a nitpick: a household
   shopping list with a genuinely repeated item (e.g., two different quantities of milk written on
   separate lines) needs to be distinguishable from the same line read twice because of strip overlap,
   and the design as written doesn't say how.
3. **Known anti-pattern the design correctly avoids, worth stating plainly because the design doesn't
   name it as a thing it's avoiding:** unconditionally escalating to a stronger, more expensive model
   ("just use Sol") without first fixing the *input* (resolution, cropping, orientation) is a documented
   trap — the vision-benchmark evidence above shows Sol's OCR/text-extraction gain over Terra is modest
   (a few points), while it costs meaningfully more and runs roughly an order of magnitude slower per
   image (~10s/image, ~2.5¢/image per the Roboflow benchmark) than the cheaper tiers. Model-swap-first
   is the mediocre version of this fix; the design's actual sequencing (fix input → test → only escalate
   model if input-fix genuinely fails) is the right order and is independently supported by the
   benchmark gap being smaller than the presenting problem.
4. **Single-source items I could not cross-verify, flagged rather than silently treated as fact:** the
   Roboflow OCR-regression figures (Sol 82.5% vs GPT-5.5 87.6% on text extraction) come from one
   specialist blog; I could not find a second independent benchmark publishing directly comparable
   numbers on the same metric in the time available. The *direction* (small, non-monotonic OCR gains
   tier-to-tier) is corroborated in shape by a second source (CometAPI/MarkTechPost's general
   benchmark writeups, which likewise don't show OCR as Sol's standout strength — its strengths are
   coding/agentic benchmarks), but the exact percentages should be treated as **Medium confidence**,
   not High, until re-verified against a primary OpenAI benchmark card if one is available at build time.

### Anti-patterns to explicitly avoid (asked for directly)

- **Model-swap as the first move** on an accuracy problem before ruling out input quality — addressed
  above; the design already avoids this, worth stating so nobody "helpfully" reintroduces it later.
- **Single-pass, no-verification OCR** — the uncontested baseline anti-pattern in every source
  surveyed; the design's deterministic sanity-check stage avoids it.
- **A model asserting its own bounding box/coordinates as "evidence"** — this is the mediocre version
  of grounding, and the specific failure the design's region-ID amendment was written to close. The
  literature backs treating it as a real anti-pattern, not caution for its own sake.
- **Treating a single specialist blog's benchmark number as settled fact** — I flagged where I could
  only find one primary source (item 4 above) rather than quietly presenting it as verified.

---

## Finding 3 — Cockpit provenance/state claims (Part 2), sanity-checked

**Confidence: High** on both claims — these are standard, well-documented software patterns, not
speculative design.

**Claim 1 — "one canonical human-facing state, computed once, consumed by both Cockpit and
Telegram."** This is the single-source-of-truth / state-machine-as-source-of-truth pattern, standard
and well-attested in general software architecture (not vision/OCR-specific, so I searched general
sources rather than AI ones): a precomputed state machine gives a single, unambiguous state that every
consuming surface reads rather than recomputes, and notification/multi-channel systems are commonly
built to deliver based on state-machine transitions rather than each channel deriving its own read of
"what's happening" from raw data. The design's stated failure mode — two pieces of status text on the
same screen contradicting each other because they were computed independently — is exactly the
symptom this pattern exists to prevent. Sound, low-risk, nothing exotic about it.

**Claim 2 — "a model can reliably be constrained to reference a caller-supplied region ID rather than
inventing coordinates."** Directly answered in Finding 2 above (region-ID grounding): yes, this is a
real, working pattern with a production precedent (Anthropic's Citations API constraining models to
cite pre-assigned block indices, not generate spans) and independent literature explaining *why* it
works (closing the output space to a known-good enum removes the failure mode of the model inventing a
plausible-but-wrong location). One caveat the design itself already states correctly and I want to
underline, not soften: **constraining the model to point at a real region proves the model didn't
invent a location out of nothing — it does not prove the model read the pixels inside that region
correctly.** That's a narrower, honest claim than "the model's read is now verified," and the design's
own wording ("this does not prove the model read the pixels correctly inside that region — it cannot")
already draws that line correctly. Worth restating here because it's the kind of distinction that
erodes if repeated informally later in the build.

---

## Methodology

Ordered: (1) read the design doc and the build's own source/defect-ledger evidence for the Terra
naming context and the D-2026-08-03-05 probe, to establish what the build already knows and what it
flagged as open; (2) WebSearch + WebFetch for the Luna/Sol/Terra question, cross-checking OpenAI's own
announcement against AWS Bedrock's integration docs and independent trade press (Vellum, MarkTechPost,
CometAPI, Roboflow, PoYo) until pricing/capability/spec claims either converged or a genuine
disagreement was found and named; (3) separate searches for each of the four named pipeline techniques
(deskew/prep, tiling/cropping, confidence-gated re-read, region-grounding-vs-hallucination), preferring
primary sources (arXiv papers, vendor documentation) over secondary blog summaries where both existed;
(4) one targeted search for the Cockpit state-model and region-grounding claims specifically, including
Anthropic's own Citations API documentation as the strongest available production precedent. No live
gateway probe was attempted — explicitly out of scope per the commission, no credentials or path
available from this context, and the GL-012 scoping question is unresolved.

## Limitations

- **No access to this build's actual gateway, live model roster, or private configuration.** Everything
  in Finding 1 about *this deployment's* current state is inference from the (now month-old) staged
  probe plus public model-family facts — not a live check. Do not read Finding 1 as confirming or
  denying whether Sol/Luna are reachable from this gateway today.
- **The context-window discrepancy (272K vs 1.05M tokens) between two sources was left unresolved**
  rather than picked, because I could not establish with confidence which access path each figure
  described in the time available.
- **The Roboflow OCR/text-extraction percentages are single-source** and flagged as such (Medium, not
  High, confidence) — a second primary benchmark should be sought before those exact numbers are used
  to justify a spend decision.
- **The multi-image-single-call finding (Finding 2, item 1) is directional, not unanimous** — one
  source pointed the other way for a differently-shaped task (multi-page document OCR with whole-
  document context). I've represented it as a real, evidence-backed concern worth testing, not as a
  settled verdict that the design is wrong.
- This review assesses the design against published general practice; it does not re-derive or dispute
  the household-specific evidence already established this session (the 38/39 vs Terra's 9-error/9-miss
  result), which I treated as given, not re-verified.

## Recommendations

1. Treat the Luna/Sol/Terra existence question as **closed** by this research; do not re-litigate it.
   Treat "are they on *this* gateway" as still open and gated on the GL-012 private-surface decision
   already recorded in the design doc.
2. Before building Amendment 2's test protocol, add one explicit line item: **test the single-call
   (page+strips-together) pipeline against a variant that sends the flagged/uncertain strips as
   separate follow-up calls**, and compare accuracy on the one photograph with a known-correct answer.
   This is cheap (the design's own acceptance test already exists) and directly resolves the one
   technical uncertainty this review couldn't resolve from literature alone.
3. Add an explicit dedup/merge rule for items appearing in more than one overlapping strip before this
   ships — by region-adjacency, or by requiring the model to name which single strip a line's "best"
   evidence came from even when it appears in two. Undocumented is a real gap, not a style note.
4. Worth a second, cheaper primary source-check on the Sol-vs-Terra OCR benchmark numbers before they
   inform a cost decision, since the finding driving the "test Terra first" sequencing currently rests
   on one specialist blog.

---

*Cross-reference: [[Deliverables/2026-08-11-cockpit-and-vision-pipeline-design]] (the design under
review), [[Deliverables/2026-08-11-list-reconciliation-blocks-browser-build]] (the "Sol" open question
this research resolves), `services/obsidiwikai/src/core/models.mjs` and
`Builds/BUILD-015-asdair-durable-household-shopping-steward/DEFECT-LEDGER.md` (D-2026-08-03-05, the
staged gateway probe this research contextualises but does not supersede).*
