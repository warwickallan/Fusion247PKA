---
title: "🔴 TOP-LEVEL BLOCKER — the shopping list did not come from the photograph"
date: 2026-08-11
author: Larry
build: BUILD-015 AsdAIr
status: OPEN — highest-priority acceptance blocker. Nothing downstream may be accepted until this is closed.
severity: CREDIBLE FALSE SHOPPING INTENT — worse than bad OCR
---

# The shopping list did not come from the photograph

**This is not an OCR quality problem. Do not file it as one.** A bad transcription produces obvious
rubbish that somebody notices. What happened here produced a **plausible, well-formed, confidently
processed shopping list that was not derived from Warwick's photograph** — and every layer
downstream of it worked correctly on false input, which is precisely why nothing caught it.

## The measured facts

Established read-only against the live store on 2026-08-11, on `asdair.shop` id **14**
(`SHOP-2026-08-10-M64`, `source_kind = 'photo'`):

| Column | Value |
|---|---|
| `transcript` | **length 0 — EMPTY** |
| `transcript_provider` | **null** |
| `transcript_model` | **null** |
| `transcript_confidence` | **null** |
| `needs_review` | **true** |
| `raw_media_path` | present — the real photograph is on disk |

### The raw query and its output, so nobody has to take Larry's word for it

⚠️ **Pax could NOT independently verify this** — subagents receive no MCP tools, so it tried three
tool names and got "No such tool available" for each. **Until someone else with database access
re-runs this, it is a single-source measurement by Larry.** Re-run it first thing:

```sql
select id, shop_ref, source_kind, status,
       length(coalesce(transcript,''))        as transcript_len,
       coalesce(transcript_provider,'NULL')   as provider,
       coalesce(transcript_model,'NULL')      as model,
       coalesce(transcript_confidence::text,'NULL') as confidence,
       needs_review,
       (select count(*) from asdair.shop_line sl where sl.shop_id = s.id) as shop_line_rows,
       raw_media_path
from asdair.shop s where s.id = 14;
```

Output, executed 2026-08-11:

```json
{"id":14, "shop_ref":"SHOP-2026-08-10-M64", "source_kind":"photo", "status":"NEEDS_DECISION",
 "transcript_len":0, "provider":"NULL", "model":"NULL", "confidence":"NULL", "needs_review":true,
 "shop_line_rows":35,
 "raw_media_path":"C:\\.fusion247\\asdair\\shopper-media\\tg-shopper-chat-8601328832-msg-64-AQAD8xBrG5YW0FN-.jpg"}
```

**35 line rows. Zero-length transcript. No provider. No model. No confidence.**

**And yet 35 `asdair.shop_line` rows existed**, each with a plausible `raw_reading`, each carrying a
`line_no`, most resolved to a catalogue product, and 28 of them promoted to `requested` list items.

**There is no durable artefact anywhere proving what was read from that image.** No provider, no
model, no confidence, no transcript text. The rows have no provable source.

## What the rows actually contained

Larry read the source photograph directly (`Read` on the image at
`raw_media_path`) and compared it line by line. The photograph carries roughly **38–40 handwritten
lines**. The system had 35 — but not the same 35.

**On the photograph, absent from the derived list** — Asda plain toffee · Asda shortbread fingers ·
chips with skins on · mashed potato · Weetabix protein · Rustlers sausage muffins · Lurpak butter ·
Always Discreet liners · Twix choc biscuit bars · cherry cake · Asda hayfever tabs · Asda fruit lolly
ices · Febreze fabric spray · Dettol spray · Bloo toilet rim · Calgon · Loctite super glue · **and
`1 6pts ASDA SEMI SKIMMED MILK`**.

**In the derived list, nowhere on the photograph** — Andrex Ultimate Quilts · Viakal · TRESemme
shampoo · TRESemme conditioner · Smart Litter · Mars bars · Hovis.

**Garbled into a different product** — the photograph's **"2 RUSTLERS SAUSAGE MUFFINS"** became
`"PORK SAUSAGE MUSHROOMS"` and resolved to **Wall's 4 Pork Sausage Rolls 220g**.

**The invented items share a signature: they are all household Regulars.** That is the strongest
available evidence for the mechanism — with no transcription to derive from, something downstream
produced a list that looks like this household's shopping because it was shaped by catalogue and
Regulars material rather than by the image.

⚠️ **Larry's reading of a rotated handwritten photograph is itself fallible**, and individual lines
above may be off. **The magnitude and the direction are not in doubt** and were independently
confirmed by Warwick, who said of the result *"there is absolutely no way that can be correct"*.

## The invariant that failed

```
SOURCE PHOTO
  → DURABLE TRANSCRIPTION WITH PROVENANCE   (provider, model, confidence, text)
    → SHOP LINES DERIVED FROM THAT TRANSCRIPTION
      → RECONCILIATION BACK TO SOURCE
        → ONLY THEN planning, questions, rules, browser
```

**A downstream system MUST NOT be able to create plausible shopping intent when no durable
transcription exists proving what was read.** Tonight it could, and it did.

The failure is not that a step produced a poor result. **The failure is that a step produced NO
result, recorded nothing, and the pipeline continued anyway** — and every later stage then behaved
impeccably on top of a fiction.

## How far the fiction travelled before anyone noticed

1. 35 line rows written, 28 promoted to `requested` list items.
2. Products resolved against the catalogue, several "matched by known brand + variant".
3. **Questions were generated and asked of Warwick** about items — some of which he had never
   written down.
4. **Warwick answered them.** Those answers were durably recorded against invented lines.
5. The browser **faithfully built a trolley** from the false list — 23 products, £74.30 — including
   seven products he had never asked for.
6. **Larry reported "23 of 23 correct product AND quantity, 0 substitutions, 0 invented products."**
   That statement was true *against the derived list* and Larry **never reconciled the derived list
   against the photograph.** It is the single worst claim of the session.
7. **£74.30 was outside SOP-021 rule 7's expected £120–150 band.** The SOP requires that band be
   checked and flagged. Larry did not use that signal, and reported success instead.
8. **Warwick caught it**, by looking at the price.

**TWO in-repo signals were already sitting there and neither was consulted** (found by Pax, not by
Larry): `SOP-021` line 267 sets the **£120–150** band and instructs that anything outside it be
flagged; and `RUNTIME-DECISION.md` line 53 records the household's **last real basket at 35 products
/ £136.94**. **£74.30 across 23 items is roughly 54% of the last real shop.** Both numbers were in
the repository, in files Larry had open that evening, and the success claim was made anyway.

**Every control in the estate was green while this happened.** 1,982 unit tests, three Keel
read-back gates, two Veritas gates, a secret scanner, and a mutation-proof harness. **None of them
looks at whether the list came from the photograph**, because none of them was ever pointed at that
question.

## GATE ZERO — the required assurance rule

**For a photo-originated shop, ALL downstream assurance is invalid unless INPUT TRUTH is established
first.** Veritas must establish, before grading anything else:

1. the exact source media identity (path/hash of the image actually processed);
2. that a **durable transcription exists**;
3. that **provider / model / provenance are present** where expected;
4. that **shop lines can be traced to that transcription**;
5. that **no catalogue or Regulars material has silently become source intent**;
6. that a **source-versus-derived reconciliation** has been performed;
7. that **unresolved handwriting is surfaced as uncertainty, never invented**.

**UNKNOWN on any of these → HOLD. Rows existing without trustworthy source derivation → FAIL.**

**No future Gate 2 may PASS a photograph journey without demonstrated photograph-to-durable-list
truth.** Component greens do not substitute. Five more layers of passing tests certifying a list
nobody proved came from the image is exactly what happened tonight.

⛔ **This clause is a BAR ON CLAIMING, not a licence to build a validation platform.** The regrowth
cap applies at full force. The fix is almost certainly: make the transcription step **fail loudly and
stop the shop** when it produces nothing, and record provenance when it produces something. It is not
a new control plane.

## What must happen before AsdAIr can be accepted

**This is the highest-priority open blocker for BUILD-015.** Ahead of every remaining work package.

1. **Establish why the transcript is empty** — did the vision step never run, run and fail silently,
   or run and fail to persist? Not yet known. Do not guess; the durable rows will say.
2. **Establish where the 35 lines actually came from.** Until that is known, the defect is not
   understood, only observed.
3. **Make an absent transcription fatal to the shop**, loudly, with a card Warwick sees.
4. **Persist provider, model and confidence** on every photo shop.
5. **Add a source-versus-derived reconciliation** the operator or the gate can run.
6. Only then may a photograph acceptance journey be attempted.

## The lesson, stated once

**Weeks of engineering and extensive assurance happened before anybody checked that the derived
shopping list matched the photograph Warwick actually sent.** Every layer was tested. The input was
not. A system that is confident about the wrong groceries is more dangerous than one that admits it
cannot read the list.
