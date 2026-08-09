# Fresh-photo acceptance — how the three list lines were chosen

**Date:** 2026-08-09 · **By:** Larry · **Purpose:** ground the three photograph lines in the REAL
production catalogue and the REAL planner, so Warwick is not asked to invent a test fixture.

> **Method, and why it is not "fabricated from tests".** The three phrases were selected by
> **executing the production matcher** (`services/asdair/skill/termMatch.js`, via
> `planner.termMatch` and `planner._internal.normaliseTerm`) against the **live 103-row
> `asdair.regulars` catalogue** read from the household database. `regularHits` (planner.js:319–337)
> is not exported, so its exact two steps — exact-alias match, else `bestMatch(...).confident` — were
> reproduced verbatim against the real modules. **No test file was consulted for candidate
> behaviour, and no production data was modified.**

## Catalogue facts established (read-only)

103 regulars, **all active**, 46 carrying `aka` aliases, and **`substitutes_allowed` is false for all
103** — consistent with Pax's household-knowledge audit.

Matching is **whole-phrase**, not substring: the normalised line text (`trim → lowercase → collapse
whitespace`) is compared against each regular's name and each `aka` entry.

## Executed probe results

| Phrase | Match step | Outcome |
|---|---|---|
| **`ariel pods`** | **EXACT (2 hits)** | **AMBIGUOUS → `needs_decision` + ranked candidates (buttons)** |
| `pepper` · `milk` · `tea towels` · `sausage rolls` | EXACT (1 hit) | single → planned, **no question** |
| **`yazoos`** | fuzzy | **NO CANDIDATES → prose required** |
| `yazoo` · `sure` · `lucozade` · `vanish` · `nescafe` · `beans` · `walkers crisps` · `batchelors pasta` | fuzzy | NO CANDIDATES → prose required |
| **`oven gloves`** · `cat litter tray` · `birthday candles` | fuzzy | NO CANDIDATES → prose required |

**The fuzzy tier is strict:** a bare brand word does **not** confidently match its family. That is a
real property of the shipped matcher, established here by execution rather than assumed.

## The three chosen lines, and why each one is the right instrument

### 1. `Ariel pods` → the deterministic button answer

`ariel pods` is an **exact alias on TWO different regulars** — id 36 (33 capsules) and id 50
(22 capsules). Two exact hits makes `matchRegular` return **ambiguous**, which is precisely the
`needs_decision` + ranked-candidates path that renders buttons. Two genuine, grounded candidates,
distinguishable by pack size.

**Why this line specifically:** Pax's old-brain continuity audit records **Ariel Pods being re-asked
live on 2026-08-03** — it is the documented example of an answer that was written, read back and
discarded. **The line that proved the old system forgot is the line that will prove the new one
remembers.** No item was invented to create this; the ambiguity already exists in the catalogue.

### 2. `Yazoos` → the genuine prose answer, exercising the bounded Terra path

`yazoos` returns **zero candidates**, so **no button can express the answer** and prose is the only
route. But the catalogue *does* contain the family — ids 10, 15, 59 (banana, chocolate, strawberry) —
so Terra has **real grounding to reason against** and can return a truthful `existing_regular` or
`quantity_change` decision with genuine `decision_evidence`.

**This is deliberately stronger than picking an item absent from the catalogue.** An unknown item
would most likely resolve to `new_item` or `clarification_required`, which exercises the code path
while proving much less about *grounded* interpretation. A prose answer naming a flavour and a
quantity is the real Terra job.

### 3. `Oven gloves` → the deliberately unresolved line

Zero candidates, a perfectly ordinary thing to write on a shopping list, and **nothing in the
catalogue it could silently resolve to**. Left unanswered it holds the line open, which is what
proves `READY_TO_SHOP` is refused while a line is unresolved — the exact defect this Work Package
exists to end (`countOpenQuestions === 0` previously decided readiness).

## Constraints honoured

- **No production data modified.** Every query in this selection was read-only.
- **Shop 6 not reused**, and nothing pre-answered.
- **No candidate behaviour taken from tests** — the matcher was executed against live data.
- The three phrases are ordinary handwriting, carrying no engineering jargon.

## What this document does NOT establish

Selection is a **prediction of planner behaviour**, executed against the real catalogue but **not yet
against a real photograph**. Transcription, interpretation and question generation still have to run
for real. **If a line behaves differently once photographed, the observed behaviour is the truth and
this prediction is what was wrong** — it must not be "corrected" by editing production data.
