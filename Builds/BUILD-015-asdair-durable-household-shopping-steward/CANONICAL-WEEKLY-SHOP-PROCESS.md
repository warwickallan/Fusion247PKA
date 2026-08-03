# BUILD-015 — THE CANONICAL WEEKLY SHOP PROCESS

**Status:** CANONICAL. The front door. Photograph → checkout-ready basket → write-back.
**Authority:** Warwick, 2026-08-04, ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`.
**Supersedes** every conflicting description in SOP-021, SOP-021a, the Goal Contract,
Asdair's contract, the closeout work orders, the browser-runner documentation, and any
session-derived assumption.

> **Read `RUNTIME-DECISION.md` first.** It settles who writes the basket: **Sonnet in Claude
> for Chrome**, not Larry, not a Claude Code subagent, not the custom CDP runner.

---

## The acceptance question this process must answer

> *Can a fresh instance recover Warwick's proven shopping process from Git, prepare the
> correct Brand A–Z Sonnet packet using Supabase knowledge, ask only about genuinely new
> products, and persist every resulting decision and new item — without Larry supplying
> missing context?*

Anything less is not the process Warwick commissioned.

---

## A. Load the household knowledge BEFORE the photograph is interpreted

**A model call that does not include the catalogue is forbidden.**

Before any model sees the image, load from Supabase the complete household catalogue and
decision state:

| Loaded | Why it is an INPUT, not an output |
|---|---|
| every active ASDA **Regular** | identity comes from our rows, never from model prose |
| every active ASDA **Favourite** | Favourites are a distinct source view and must be represented |
| canonical product name · brand | what the item actually is |
| ASDA product reference and URL | so a known item is never free-searched |
| **every alias and historical list wording** | how "choc yazoo" and mum's shorthand resolve |
| typical quantity | so an unwritten quantity is not guessed |
| **source view: Regulars or Favourites** | drives where Sonnet finds it |
| substitution permission | per-item, honoured at basket time |
| category | ordering and disambiguation |
| **standing rules** | exclusions, maps, rotations |
| **every previous item decision** | so an answered question is never asked again |
| **every promoted rule** | the learning loop's output, fed back as input |
| previous completed order (where rotation applies) | rotation cannot be resolved without it |

Roughly **93 known products and their aliases** are context for interpretation.

**There must be exactly one photo-interpretation entry point.** Any open-ended transcription
path must be deleted, retired, or made to **fail closed**.

## B. Terra performs catalogue-CONSTRAINED interpretation, not open-ended OCR

Call the configured vision model through the product's own Fusion gateway
(`FUSION_GATEWAY_URL`). The request carries: the photograph, the complete known-product
catalogue, aliases, brands, source view, previous decisions, and the relevant rules.

For every handwritten line the model may return **only**:

1. a **known catalogue item ID** with quantity and raw reading; **or**
2. **`new_item`**.

**The model may not invent a canonical product name.** Canonical identity is looked up from
Supabase using the returned ID. Every claimed known ID must be validated to exist in the
catalogue that was actually supplied.

**Fail closed if:** the catalogue is absent or empty · the model was not given the catalogue ·
the selected model is unavailable · the output claims an unknown ID.

**Record sanitized evidence of what catalogue and decisions were supplied to the model.**
Asserting that `loadCatalogue()` was called is not evidence. This requirement exists because
on 2026-08-03 a `--dry-run` that *skipped the model call entirely* was mistaken for proof the
model path worked (`DEFECT-LEDGER.md` D-2026-08-03-04).

## C. A known product must never become a question over spelling or word order

The matcher must tolerate:

- **word-order changes** — `"yazoo choc"` ↔ stored alias `"choc yazoo"`
- **one-letter spelling errors** — `"Glouster"` / `"Glouester"` ↔ `"Gloucester"`
- punctuation and spacing
- established household shorthand
- prior aliases
- previous decisions

**Previous decisions must be consulted before any question is generated.**

Both examples above are real failures from 2026-08-03 (D-2026-08-03-15): exact-string alias
matching turned two already-known products into questions Warwick had to answer. Today's
matcher is exact-string and **does not meet this requirement** — that is an open gap, not a
description of current behaviour.

## D. Only genuinely NEW products become questions

Warwick is asked only about an item absent from **all** of: Regulars · Favourites · aliases ·
previous decisions · applicable standing rules.

- Collect all genuinely new items and **ask once, in one batch**.
- Do **not** ask about known products, spelling variants, reordered words, or decisions
  already answered previously.
- **Every answer must be written durably before the shop proceeds.**

On 2026-08-03, eleven questions were raised of which — on inspection — two were known
products defeated by matching, and two more (Nescafe Azera, toothpaste) had been **answered
in the Google Drive decisions log on 2026-07-06** and never promoted into Supabase
(D-2026-08-03-16). Under this process none of those four would be asked.

## E. Prepare the Sonnet Browser execution packet

After interpretation and new-item decisions, create **one durable execution packet**:

| Field | Notes |
|---|---|
| shop reference | |
| original list line | what mum actually wrote |
| canonical product ID and name | from our rows |
| brand | drives the sort |
| **source view: Regulars or Favourites** | tells Sonnet where to look |
| ASDA product reference | so a known item is never free-searched |
| required quantity | |
| known, or newly approved | |
| **exact approved search term** (new items only) | Warwick's approved wording, not invented |
| **expected distinct-product count** | reconciliation input |
| **expected total-unit count** | reconciliation input |

**Sort deterministically: (1) normalized brand A–Z, then (2) canonical product name A–Z.**
This is the same order Sonnet uses in ASDA — the ordering *is* the speed.

Store the packet in Postgres and expose it as: machine-readable JSON · a simple
human-readable checklist · in the Cockpit · to the Sonnet Browser handoff.

**No Claude session constructs this packet manually.** Schema:
`SONNET-BROWSER-EXECUTION-PACKET.schema.json`.

## F. Sonnet builds the basket

Per `RUNTIME-DECISION.md`. Summary: open Regulars/Favourites → **set ASDA ordering to Brand
A–Z** → follow the packet in that order → add known products via Regulars/Favourites →
**never free-search a known item** → free-search only approved new items → add → **click
ASDA's Favourite control** → capture the real ASDA product identity → stop at
checkout-ready.

Never: book a slot · check out · pay · enter a password · auto-substitute.

## G. Verify the basket, then hand back

After Sonnet finishes:

- compare **expected distinct products** against the actual basket;
- compare **expected total units** against the actual basket;
- reconcile **each product identity and quantity**;
- identify unavailable products **without substituting**;
- identify anything omitted or unexpected;
- confirm no checkout, payment or slot action occurred.

**Only after reconciliation passes**, send:

> «Basket ready for Warwick to review and order.»

**A matching headline count alone is insufficient** if the wrong product or quantity is
present.

## H. Close the learning loop

**For every genuinely new product:** persist its ASDA product reference and URL · canonical
name and brand · **the photographed wording as an alias** · the approved search wording ·
whether it belongs in Regulars or Favourites · confirm the ASDA Favourite action completed ·
make it part of **next week's interpretation catalogue**.

**For every Warwick answer:** create the durable decision event · update `rule_qa_log` ·
promote any continuing rule · add aliases where the answer establishes identity · **prevent
the same question next week**.

**Migrate every relevant answer from the Google Drive "Asda - Decisions Log" into operational
Supabase state.** Preserve the Drive document as provenance.

**No answer may remain only in:** Larry's context · a Sonnet conversation · a Google document ·
a commit message · **an unapplied local seed file.**

> The last one is live right now: `services/asdair/db/011_decisions_log_rule_notes_seed.sql`
> exists, is correctly gitignored (it carries household rows), and **has not been applied.**
> Until it is, the Azera and toothpaste decisions remain Drive-only in practice.

---

## Honest status of this process, 2026-08-04

**This document describes the process Warwick commissioned. It is not a description of what
the code does today.** Recorded plainly so no fresh instance mistakes specification for
implementation:

| Step | Implemented? |
|---|---|
| A — catalogue loaded before interpretation | **Yes** — `interpret/loadCatalogue.js`, wired via `deps.js`. The bigint-id defect that silently broke it was fixed 2026-08-03. |
| A — Favourites represented as a distinct source view | **NOT VERIFIED.** `asdair.regulars` carries a `source` column; whether Favourites vs Regulars is genuinely distinguished end-to-end is unconfirmed. |
| B — catalogue-constrained, ID-only model output | **Yes in design** (`groundedPrompt.js`, `resolveByCatalogue.js`, and `interpret-list.js`'s resolve step, which refuses an id not in our rows). |
| B — sanitized evidence of what was supplied to the model | **NO.** Not implemented. |
| B — exactly one interpretation entry point | **NO.** `interpret-list.js` (CLI) and the pipeline path both exist. |
| C — order/spelling-tolerant matching | **NO.** Exact-string. This is the open gap that cost two questions on 2026-08-03. |
| D — previous decisions consulted before asking | **PARTIAL.** Rules exist; many carry `note = null`, and the Drive decisions were never promoted. |
| E — deterministic Brand A–Z execution packet | **NO.** Does not exist. This replaces WO-C. |
| F — Sonnet as the live basket writer | **Ruled 2026-08-04.** Not yet reflected in the code or the other documents. |
| G — reconciliation against expected counts | **PARTIAL.** `services/asdair/reconcile/` exists; expected-count inputs do not. |
| H — new-item write-back | **PARTIAL.** `outcome/update-regulars.js` exists and works — six new regulars were written by hand on 2026-08-03 using it. It is not driven automatically by the shop. |

**Nothing in this file should be read as a claim that BUILD-015 implements it yet.**
