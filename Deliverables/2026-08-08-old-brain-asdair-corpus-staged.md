# OLD-BRAIN AsdAIr corpus — staged by Larry 2026-08-08 for the continuity audit

> Fetched read-only from Warwick's Google Drive via the Drive MCP text export, de-escaped
> mechanically; content unmodified. Historical intent/reference, NOT current authority (three or
> more shops have happened since). Originals preferred over "Copy of" duplicates where both exist.
> The "ASDA Regulars - Category and Name" spreadsheet was NOT fetched — request via Larry if a
> row-level comparison becomes material.

---

## DOC 1 — README — AsdAIr Household Shopping (START HERE).md
(Drive ID `1-DgfTV9W1ieUVvlTkFU7ds3zBG6MSCi3dVmQXXWp5c8`, created 2026-07-06)

Status: Active · Owner: AsdAIr

**Purpose.** Entry point for Warwick's Asda household shopping automation. AsdAIr manages the weekly Asda household shop, run through Claude in Chrome.

**Why this folder exists.** Claude in Chrome has no memory between browser sessions. This folder is the persistent memory: standing rules, the current shopping list, and a record of every week's basket.

**Folder contents.** Asda List - YYYY-MM-DD (one per week; always use the latest date) · Asda - Decisions Log (standing rules and resolved Q&A; read this first, every run) · Asda - Order History (one entry per week's run) · AGENT doc · this README.

**Current operating rule.** Only select items on the latest dated list. Only source from Favourites/Regulars. Quantities default to 1 if not written; duplicates deduped. Out-of-stock items get suggested alternatives, never auto-substitutes. Normal weekly spend £120–£150 excl. delivery. Basket must be checkout-ready; the order must never be placed by the agent.

**Weekly workflow (manual bridge until Telegram/direct capture exists).** 1. Warwick photographs Mum's handwritten list, sends to Claude chat. 2. Claude transcribes → new dated list doc. 3. Warwick runs Claude-in-Chrome against Asda pointed at the folder. 4. It reads the Decisions Log, then the latest list, builds the basket, stops short of checkout, appends to Decisions Log and Order History. 5. Warwick reviews and checks out manually.

**Notes.** Once a more direct capture route (e.g. Telegram) exists, update the intake step; the core Drive memory model (Decisions Log + Order History + dated list) should stay the same regardless of how the list gets in.

---

## DOC 2 — AGENT — AsdAIr - Household Shopping Manager.md
(Drive ID `1jH5-DaYPsgp8Hi_7veWx35CpqEasgp2o_tYLtOQOxow`, created 2026-07-06)

**Identity.** AsdAIr governs turning Mum's handwritten Asda list into a checkout-ready basket via Claude in Chrome, and keeping a durable record of standing rules and weekly order history that survives across browser sessions with no memory of their own.

**Mission.** A correct, checkout-ready basket every week with minimal Warwick intervention, while preventing basket scope creep, silent auto-substitution, **and repeat questions the system has already answered before.**

**Primary sources.** Current list: latest dated "Asda List" doc. Standing rules and Q&A history: Asda - Decisions Log. Run history: Asda - Order History.

**Operating rules (verbatim, numbered).**
1. The latest dated "Asda List" doc is the only source of what to buy. Nothing gets added that isn't on it.
2. Claude in Chrome has no persistent memory between sessions. The Decisions Log is the substitute memory and must be read in full at the start of every run, before the list is touched.
3. Quantities are always item counts. No quantity written defaults to 1. Duplicates deduped to a single line.
4. Sourcing is Favourites/Regulars only. Out-of-stock or unmatched items get alternatives suggested, never auto-substituted.
5. Normal weekly shop is £120–£150 excluding delivery; notably outside gets flagged.
6. The goal is always a checkout-ready basket. The routine must never place the order.
7. **Any new question resolved mid-run gets appended to the Decisions Log at the end of the run, using its entry template, so it never has to be asked again.**
8. Every run gets a new entry appended to Order History, whether or not the basket completed.
9. Process improvement ideas are suggested to Warwick at the end, not written into the log automatically — Warwick approves what becomes a standing rule.
10. Google Drive access must be confirmed working before relying on it; if unreachable, tell Warwick rather than silently skipping the knowledge-base steps.

**Reminder block (verbatim intent).** Before anything else: open the Asda Favourites page and the Asda Regulars page — missed in a previous run; not optional.

---

## DOC 3 — Asda - Decisions Log (FULL TEXT, de-escaped)
(Drive ID `1GF-2o3vP0GsZv1jrerK358SJqNj7ZEGJ49hsMDNFL8w`, created 2026-07-06, modified 2026-07-06)

**Purpose.** Because Claude in Chrome has no persistent memory, this log is the reference point for anything previously unsure, and where new Q&A gets added each run. Read at start of every shop; append at end of every shop.

**Rule.** Do not delete old entries. A changed decision gets a new dated superseding entry.

**Entry template.** `### YYYY-MM-DD / Question / Answer / Applies going forward: (yes/no — standing rule for future weeks?)`

**Standing rules (final updated list in the doc):**
- Quantities on the list are always item counts, not pack sizes.
- If no quantity is written, default to quantity 1.
- If the same item appears more than once on the list, dedupe to a single line.
- All items are expected to be findable in Favourites/Regulars.
- Nothing gets added to the basket unless it is explicitly on the list.
- Out-of-stock items get alternatives suggested, never auto-substituted.
- Normal weekly shop is £120–£150 excluding delivery; notably outside gets flagged.
- Goal is always a checkout-ready basket. The routine must never place the order.
- **Milk = Cravendale Arla, never BOB (BOB has short shelf life).**
- Toffees (no qualifier) = ASDA Dairy Toffee 180g; "mixed"/"assorted" only when explicitly stated.
- Nescafe = Azera only; only add if on offer, otherwise flag full price for review.
- Sure deodorant: male = any blue variant, female = any white variant (not scent-specific).
- Tomato sauce = Heinz Tomato Ketchup 910g.
- Toothpaste = Aquafresh, cheapest available size/variant (100ml doesn't exist at Asda; 75ml standard).
- Picnic Bars = Cadbury Picnic Chocolate Bar 4 Pack Multipack; saved to Favourites.
- Yazoo = never Banana flavour (Buggly dislikes it, prefers Strawberry). Defaults: Chocolate or Strawberry. Flag rather than substitute if Banana is the only option.

**Log entry 2026-07-06 (no-quantity + duplicates):** Q: items with no quantity (Richmond sausage, tissues, toothpaste…); "Fairy Max" appeared twice. A: default 1; dedupe duplicates to one line. **Applies going forward: yes.**

**Log entry 2026-07-06 session 2 (live shop Q&A batch):** Milk = Cravendale Arla (not BOB), BOB disliked due to short shelf life — always substitute Cravendale going forward; unfavourite/remove BOB where possible. · "Semi milk, Frank's (pints) x6" = ONE six-pint pack for neighbour Frank, not 6 packs. · Toffees = ASDA Dairy Toffee 180g unless "mixed"/"assorted". · Nescafe = Azera only, never plain Americano; only on offer. · Sure: male blue / female white, not scent-specific. · Vanish: "Whitener" wording = White tub; plain "Stain Remover" = Pink tub. · Richmond sausages: closest single Regulars match OK (Richmond 12 Skinless Pork Sausages 319g). · Custard & Jelly pots = ASDA-branded jelly & custard pot. · Tomato sauce = Heinz Tomato Ketchup 910g. · Hay fever = any standard antihistamine (loratadine). · Toothpaste = Aquafresh cheapest. · Picnic Bars: add + save to Favourites. **Applies going forward: yes.**

**Open item for Warwick (verbatim intent):** "Regulars" has no manual per-item remove in the Asda UI (auto-generated from order history). BOB already unfavourited; it may only disappear from Regulars once enough Cravendale orders replace it in order history — NOT a one-click removal.

**Log entry 2026-07-06 addendum (Yazoo):** Q: Should Banana Yazoo ever be ordered? A: No — Buggly dislikes Banana, prefers Strawberry. Never default to Banana on ambiguity; if Banana is the only stock, flag needs-decision. **Applies going forward: yes.**

---

## DOC 4 — Asda - Order History (FULL TEXT, de-escaped)
(Drive ID `1cw9jvB79ZGrCxbG2-gTIKFc2FE1OZAMwBeB1rDVVlCA`, created 2026-07-06, modified 2026-07-07)

**Purpose.** Running record of each week's basket; append after every run. Do not delete old entries; newest on top.

**Template.** Week of / Requested items / Added / Needs decision / Basket total / Flagged outside £120–£150? / Notes-substitutions / Checked out by Warwick?

**ONE entry exists — Week of 2026-07-06:** Requested 34 · Added 32 · Needs decision 2 · Total £119.78 · Flagged: no. Notes: Milk switched to Cravendale (not BOB) per standing preference; BOB not in Favourites (already unfavourited); Regulars has no manual remove (auto-generated from order history). · Frank's 6-pint = 1× ASDA British Milk Semi Skimmed 6 Pints. · Richmond mis-match (Heinz Baked Beans & Richmond Pork Sausages) caught and corrected to Richmond 12 Skinless 319g. · Vanish Pink vs White distinguished by "Whitener" wording. · Nescafe Azera added at FULL price £6.57 — flagged per rule. · Loratadine found via general search after Favourites showed OOS. · Picnic Bars added + saved to Favourites. · Needs-decision 1: Jelly & Custard pots OOS (three alternatives listed). · Needs-decision 2: Aquafresh 100ml doesn't exist (75ml options listed). · Checked out: no. · Same-day update: Warwick manually added 3 items not on the list (Tropicana 1.5L, ASDA Apple Slices, Always Discreet). · Warwick resolved toothpaste himself (White Renew 75ml £2.00). · Nescafe correction: wrong product (plain Americano) removed, replaced with Azera Americano Intense 140g. · New standing rule: never Banana Yazoo. · Allow-substitutes audit: 9 of 36 products ticked ON (named); other 27 off. · Final basket: 36 products, £129.58, not checked out.
