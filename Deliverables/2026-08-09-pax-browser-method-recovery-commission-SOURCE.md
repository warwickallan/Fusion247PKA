# BUILD-015 — Pax Commission: Proven Browser Shopping Method Recovery Audit

**FROM: WARWICK**

**ACTION:** Dispatch **one bounded Pax read-only investigation** to recover and classify the proven AsdAIr browser-shopping method.

This is evidence gathering only.

It must **not** interrupt WP-B15-1, widen Keel's completed surface, modify the live basket, change browser/runtime configuration, create a Work Package, or start browser automation implementation.

## Purpose

Answer one question:

> **What was the proven fast browser-shopping method that successfully built the ASDA trolley, which parts of that method were made durable, what later work bypassed or regressed it, and what exact operating method should the future production basket worker inherit?**

There is a specific concern to test:

A successful historical shop was completed quickly using a browser method that relied heavily on page structure / DOM-aware operations rather than repeatedly opening product tabs and manually driving Chrome item-by-item.

Later work appears to have regressed toward Larry operating Chrome directly, at one point leaving a separate browser tab open for many individual products.

Do not accept either account from memory alone. Reconstruct the truth from evidence.

---

## Historical sources to inspect

Search the old Google Drive brain and repository history for the original AsdAIr / ASDA basket-operation material.

At minimum inspect:

1. **ASDA Shopping Agent - Method Statement**
2. **AGENT — AsdAIr - Household Shopping Manager.md**
3. **README — AsdAIr Household Shopping (START HERE).md**
4. **Asda - Decisions Log**
5. **Asda - Order History**
6. Relevant session logs / build notes / prompt packs that describe the successful basket run
7. Git history and current AsdAIr browser / handoff / basket-related source
8. Any evidence for:
   - Claude in Chrome
   - browser computer tool usage
   - DOM / page-text / read-page interaction
   - CDP / browser debugging protocol work
   - browser runner / basket writer experiments
   - later Larry-controlled Chrome operation

Use exact artefacts where possible.

Do not assume that "Claude Chrome", "CDP", "computer", "DOM", "browser runner", or "Chrome automation" all mean the same thing.

---

## Known historical evidence to verify

The old **ASDA Shopping Agent - Method Statement** appears to record a successful workflow shaped roughly like:

**navigate → find → read_page / get_page_text → targeted computer(click) → refresh page references → inspect trolley DOM**

It also appears to record practices including:

- starting from Regulars / Favourites and using search as fallback;
- locating product quantity inputs / checkboxes through page structure;
- bulk-selecting / adding where possible;
- refreshing references after browser mutations;
- using dedicated product pages for exceptions such as unavailable items;
- checking trolley totals / item counts during execution;
- reconciling final trolley contents directly from the trolley DOM;
- never checking out / paying.

Re-establish each material claim from source evidence.

Do not turn this paragraph into fact merely because Warwick or Buzz remembered it.

---

## Critical distinction: classify the browser approaches

Identify every materially different browser-operation approach you find and classify each as one of:

### A. PROVEN SUCCESSFUL PRODUCT METHOD

Actually used in a real shopping journey and supported by executable / observed outcome evidence.

### B. DURABLE INSTRUCTION ONLY

Documented as the intended method but not independently proven in a real basket build.

### C. EXPERIMENTAL / DIAGNOSTIC

For example CDP or other low-level browser machinery that was tried or built but not accepted as the production route.

### D. LATER REGRESSION / BYPASS

A later route that ignored or replaced the proven method and produced worse product behaviour, such as excessive tab opening or slow item-by-item navigation.

### E. CURRENT PRODUCTION-CANDIDATE ROUTE

What current BUILD-015 source / Wayfinder expects to operate the basket now.

Do not collapse these categories.

Especially:

> **Do not infer that the successful historical method was CDP unless evidence proves that.**

---

## Questions Pax must answer

### 1. What actually happened in the successful shop?

Recover the strongest real successful basket run.

Establish:

- date / shop identity if available;
- approximate list size;
- approximate elapsed time if evidenced;
- browser / agent used;
- browser tools / operations actually invoked;
- how products were found;
- how quantities were set;
- whether Regulars / Favourites / category pages were used;
- whether operations were batched;
- how unavailable products / alternatives were handled;
- how trolley state was checked;
- how final reconciliation was performed;
- whether checkout was correctly left to Warwick.

If "about 15 minutes" is not supported by evidence, say so.

### 2. What made that method efficient?

Identify the actual reusable operating principles.

Test specifically whether success depended on:

- DOM / structured-page inspection rather than visual wandering;
- stable element references;
- bulk selection / batch actions;
- one coherent browser session;
- minimising tab creation;
- refreshing references after mutations;
- reconciling against the trolley DOM rather than trusting action success;
- fallback hierarchy: Regulars/Favourites/category first, search/product-page second.

Only retain principles supported by evidence.

### 3. Was it made durable?

Find the exact documents / prompts / source that were supposed to preserve the method for a fresh Larry / browser worker.

For each important operating instruction classify:

**DURABLY RECORDED / PARTLY RECORDED / LOST / SUPERSEDED / UNESTABLISHED**

Answer whether a fresh worker could reconstruct the proven method without relying on old Larry's memory.

### 4. What did later Larry change or bypass?

Trace later browser-operation changes.

Establish, if evidence permits:

- when the route changed;
- what component / instruction was bypassed;
- whether Claude-in-Chrome was replaced by Larry-driven Chrome;
- whether a DOM-aware method was replaced by tab-heavy item-by-item navigation;
- whether a different browser runner / CDP experiment displaced the proven method;
- why the change happened, **only if evidence exists**;
- whether the change was authorised product evolution or accidental route drift.

Do not invent an RCA.

If cause is unestablished, say **CAUSE UNESTABLISHED**.

### 5. What is the current basket route?

Trace the current BUILD-015 journey from:

**confirmed Brand A–Z plan / packet → handoff → browser worker → trolley mutation → reconciliation → basket_ready**

For the browser-worker link state:

**OPEN / SOURCE FIXED—NOT LIVE / LIVE—NOT COLD-START PROVEN / FULLY CLOSED BY EXECUTABLE PRODUCT EVIDENCE**

Do not infer closure from modules, tests, commits, docs, or experiments.

### 6. What must be preserved when the basket writer is built?

Produce a short **browser-operation product contract** consisting only of proven / necessary behaviour.

It should answer:

> **What must a fresh supervised basket worker do so that it reproduces the efficient successful method rather than rediscovering Chrome badly?**

Do not design a new framework.

Do not choose implementation technology unless the evidence makes a specific constraint necessary.

The contract should be outcome/behaviour oriented, for example where supported:

- consume the confirmed plan, not reinterpret the handwritten list;
- maintain one coherent ASDA browser state;
- prefer structured page / DOM interaction over visual wandering;
- use Regulars / Favourites / categories intelligently;
- batch safe operations;
- avoid one-tab-per-item behaviour;
- refresh / reacquire page references after DOM mutations;
- verify each mutation from resulting page/trolley state;
- handle exceptions deliberately;
- reconcile complete trolley against confirmed plan;
- never checkout / pay / select irreversible financial actions.

But only include points Pax proves.

---

## Evidence hierarchy

Prefer:

1. real successful shopping-run evidence;
2. browser/session logs showing actual operations;
3. trolley-before/after evidence;
4. durable original instructions;
5. current executable source;
6. tests;
7. later narrative documents.

A document saying "this is how it works" does not prove a browser worker actually worked that way.

A module existing does not prove it was the live route.

---

## Non-interference boundary

Pax must:

- work read-only;
- not open or mutate the live ASDA trolley;
- not drive Chrome;
- not start CDP;
- not alter browser state;
- not edit current source;
- not create a new service;
- not create a Work Package;
- not change the active Wayfinder;
- not interrupt Veritas / WP-B15-1 acceptance;
- not attempt to repair the browser route during this audit.

This report is for the future packet → basket seam.

If Pax finds a fact that materially invalidates a currently claimed BUILD-015 product truth, notify Fable.

Otherwise finish and hold for the appropriate §12 / next-slice handback.

---

## Required report shape

Keep it compact and decision-useful.

### A. THE PROVEN SUCCESSFUL METHOD

What actually worked, with strongest evidence.

### B. THE DURABILITY CHECK

Which parts were successfully made durable and which were lost.

### C. THE REGRESSION

What later route replaced / bypassed the successful method, and what is actually proven about why.

### D. CURRENT STATE

What current BUILD-015 has for the browser-worker / basket-writer seam.

### E. PRESERVATION CONTRACT

The smallest evidence-backed operating contract a future basket worker must inherit.

### F. NEXT-SLICE CONSEQUENCE

Answer one question:

> **When BUILD-015 reaches the basket-writer seam, should the route revive the proven historical browser method, adapt it, or deliberately replace it?**

Give one recommendation only, grounded in evidence.

Do **not** draft the Work Package.

---

## Product Star

The destination remains:

Mum sends the real handwritten list photograph to ShopperBot.

Production:

receives exact photo  
→ binds exact source  
→ loads full household knowledge  
→ Terra interprets catalogue-grounded  
→ resolves known items safely  
→ asks genuine ambiguities once  
→ learns confirmed answers  
→ produces confirmed Brand A–Z plan  
→ creates durable handoff  
→ **efficient supervised browser worker builds the ASDA trolley using a proven durable operating method**  
→ reconciles trolley against the plan  
→ notifies checkout-ready  
→ Warwick alone handles checkout/payment/slot.

This audit exists to make sure we do not recover the brain and the plan while accidentally throwing away the one browser-driving method that actually worked.
