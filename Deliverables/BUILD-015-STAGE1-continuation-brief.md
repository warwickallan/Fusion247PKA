# BUILD-015 AsdAIr Stage 1 — continuation brief

## RESUMPTION PRECEDENCE — recorded 2026-08-04, discharging Veritas `D-G3-07`

**Recorded by `WO-2026-08-04-03`, re-seated by `WO-2026-08-04-04` when this map was added. Exactly
one document may direct the next session. This is the order, and every resumption-shaped document
in `Deliverables/` carries this identical block.**

1. **`Builds/BUILD-015-asdair-durable-household-shopping-steward/`** — the build record is the
   **authority for every BUILD-015 fact, and it is not a route.** A document that disagrees with it
   is wrong.
2. **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`** — **THE Wayfinder map. The sole
   route, and the only document that may state the exact next action.**
3. **`Deliverables/NEXT-ASDAIR-SESSION-brief.md`** — **NON-DIRECTIVE.** Operational hazards and
   code-level do-not-rebuild warnings the map points at. It states no next action.
4. **`Deliverables/2026-08-04-rotation-brief.md`** — **NON-DIRECTIVE.** A dated snapshot of the
   2026-08-04 rotation, kept for its record of what changed and the traps it names. It states no
   next action.
5. **`Deliverables/BUILD-015-STAGE1-continuation-brief.md`** — **NON-DIRECTIVE. Superseded
   2026-07-28 snapshot**, kept as a historical record only.
6. **`Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md`** — **NOT a BUILD-015 resumption
   document.** A standing repository-hygiene mission; it never directs BUILD-015 work.

**This block is deliberately duplicated byte-identically across all five documents, as a recorded
exception to the SSOT Golden Rule** (root `AGENTS.md` §1), because a fresh instance may open any one
of them first and must learn from that one which document it is allowed to act on.

**The Honcho continuity brief is a POINTER, never the authority** (root `CLAUDE.md` Step 2).
**Verify by execution, not belief.**

> **SUPERSEDED 2026-07-28 SNAPSHOT — NON-DIRECTIVE, retained as a historical record. Everything below describes the estate as it stood on 2026-07-28 and is not to be acted on or corrected; the current state and the single exact next action are in `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`.**

**Written 2026-07-28 by Larry, mid-build.** Everything below is verifiable from git, `gh pr view 82`, and the
`asdair` database. Reconstruct from those, not from this file.

**Branch:** `idea-012/asdair-stage1-durability` · **PR:** #82 (*BUILD-015 AsdAIr — Stage 1*) · **Base:** `main`

> Warwick's ruling 2026-07-28: Stage 2a + 2b are REQUIRED parts of Stage 1. Only Stage 2c (persistent
> external-LLM daemon, autonomous browser, automated checkout/payment) is deferred. PR #82 is the SINGLE
> integration PR. Do not open another BUILD, IDEA, or recovery branch.

---

## 1. What is BUILT, TESTED and MERGED into the branch

| Component | Path | Tests |
|---|---|---|
| Regulars writer (aliases, product IDs, new items) | `services/asdair/outcome/{buildRegularsUpdate,updateRegulars,update-regulars}.js` | 61 |
| ShopperBot intake receiver | `services/asdair/intake/` | 22 |
| Shop state store + status projection | `services/asdair/shop/{shopState,shopStore,shopStatus,shop-cli}.js` | 91 |
| ShopperBot control surface (9 renderers, `asd:` protocol, inbound router, sender) | `services/asdair/bot/` | 77 |
| Vision transcription (one-shot, via the existing gateway) | `services/asdair/transcribe/` | 36 |
| `loadLastOrder` + variant rotation | `services/asdair/skill/{data,planner}.js` | 212 (whole suite) |
| Schema | `services/asdair/db/005,006,007*.sql` | applied live |

**All applied to the live database:** 005 (regulars learning grant), 006 (shop control surface), 007 (`rotate`
directive). Verify with `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid='asdair.rules'::regclass;`
and `\d asdair.shop`.

## 2. What is NOT built — the remaining work, in order

### 2.1 The pipeline orchestrator — THE KEYSTONE, and the reason Stage 1 is not done
Nothing yet wires the pieces together. Every component exists and is tested **in isolation**; the directive is
explicit that Stage 1 is not complete "while Larry must manually stitch scripts together". Needs a module
(suggest `services/asdair/pipeline/`) that runs, idempotently and resumably:

```
intake receiver -> createOrResumeShop -> [photo? transcribe -> human confirm]
  -> shopperRoute -> command_request intents -> asdair-worker
  -> shopping_lists + items -> normalise + plan (with lastOrder)
  -> openQuestion per unresolved line -> Telegram question cards
  -> answers -> re-plan -> READY_TO_SHOP -> browser build request
  -> supervised browser -> BASKET_READY -> confirmation -> reconcile -> learning
```
Each Telegram callback must **create or resume a durable command**, never do work inline.

### 2.2 Runtime service
`services/control-plane/wp-d-proof/asdair-worker.mjs` is built and tested but **NOT running and NOT scheduled**
(verified twice). The intake receiver likewise needs to run without Warwick launching a script. Follow the proven
pattern: a Windows logon scheduled task, exactly like `MyPKA-Directus-Live` (see
`[[directus-reboot-recovery-autostart]]`). **This is the point at which something unattended begins touching
household data — it needs Warwick's explicit go-ahead.**

### 2.3 Order reconciliation — ~~pending~~ **DONE, merged**
`services/asdair/reconcile/` is in the branch: `parseConfirmation.js` (pure), `reconcile.js` (pure, seven
outcomes), `recordConfirmation.js` (writer), `record-confirmation.js` (runtime caller). 79 tests.
The headline fixture parses exactly as specified — **32 lines, 47 units, £110.75 stated, Wall's unpriced
surviving as `null`/`unknown` end-to-end**. Idempotent on `(shop_id, content_fingerprint)`; an amended
confirmation is recorded as new evidence rather than swallowed. Derivation is opt-in and refused unless there is
an authoritative total, exactly one unpriced line, no non-product charges, and a non-negative residual.

### 2.4 Live acceptance
The 16-point list in Warwick's directive. Send exactly one message — "Send last night's list to ShopperBot now."
Note the real 2026-07-27 list photo is still **unconsumed** on the bot (update `171031117`), because the receiver
has only ever been dry-run. Expected confirmation facts: 32 product lines, 47 units, £110.75 in stated line
prices, Wall's 4 Pork Sausage Rolls with **no visible price** — do NOT invent it.

### 2.5 CI, QA, merge
~~CI covers only `skill` and `outcome`.~~ **CI now runs all seven suites** (`asdair-tests.yml`, one step each so
a failure names the module). Remaining: Codex/Tower review at the exact head, fix genuine findings, merge with
the expected-head guard.

**Current suite totals — 638 passing, 0 failing:**
skill 210 · outcome 123 · shop 91 · bot 77 · reconcile 79 · transcribe 36 · intake 22.

## 3a. ⚠️ THE CATALOGUE-GROUNDING INVARIANT — supersedes §3 below

**Warwick's correction, 2026-07-28, and it was right.** §3 measured the WRONG product behaviour: open-ended OCR,
asking a model to invent a product name. AsdAIr interprets a list **against the household's known catalogue**.

Re-run grounded — same photo, same model (`gpt-5.6-terra`), grounding the only change:

| Open-ended (§3's method) | Catalogue-grounded |
|---|---|
| "gourmet **coffee**" | **"3 gourmet cat food"** |
| "**camomile** cheese" | **"1 Dreamies cheese large"** |
| "**beefs** protein" | **"1 Weetabix protein"** |
| "**waffles** sausage rolls" | **"4 Walls sausage rolls"** |
| "ARLA **1 litre**" | **"3 semi skimmed Arla 4pts"** |
| invented *"fruit shoot"* | **invented nothing** |

Deterministic matching then resolved **28/31 (90%)** vs a previously measured **52%**. Misses were honest:
Stardrops (not stocked), "fruit splits" (real new item), "choc Yazoo" (alias gap, since closed).

**§3's verdict is withdrawn.** Do not reinstate "the model is unfit" without re-running the grounded comparison.
Do not claim the model alone is accurate either — the catalogue does much of the work; the product is the
combined system.

**Module:** `services/asdair/interpret/` — `loadCatalogue.js` → `groundedPrompt.js` → `resolveByCatalogue.js`
(identity). 13 regression tests pin the invariant, including that the catalogue is loaded **before** any model
call and that open-ended transcription is not the primary path.

**Authority boundary:** model READS/RANKS · catalogue DETERMINES IDENTITY · human resolves ambiguity · confirmed
outcomes ENRICH ALIASES. The model returns an **id**, never a name.

**Both arcs, or neither works:** write-back each week grounds next week's read. The 2026-07-27 shop learned three
new items in-session and persisted none — it only appeared to work because the session context held the
catalogue. That is not durability, and it is the whole reason BUILD-015 exists.

**Nothing lives permanently in a scratchpad.** At checkout-ready, flush everything that matters into Postgres:
order, new regulars, aliases, product IDs, rotation history, pending favourite actions.

---

## 3. (SUPERSEDED by 3a — retained as the record of the wrong experiment) The open-ended vision measurement

**Automatic vision transcription is NOT fit for Mum's handwriting on the currently available models.** Measured
2026-07-28 against the real photo, through the live gateway:

- `gpt-5.6-terra` read **Gourmet CAT FOOD as "gourmet coffee"**, Milky Way as "pork pie", Dreamies cheese as
  "camomile cheese", Lurpak butter as "pepper & souter"; **invented** a "fruit shoot" line; **dropped the Sure
  deodorant entirely** — mostly with `uncertain: false`.
- `gpt-5-mini` was materially worse.

The mechanism is sound (image reaches the model as a data URL, JSON parses, guards fire, `needs_review` raised).
**The model is the problem**, and no `fusion.vision` alias is bound on the gateway.

**Therefore: an automatic transcript is a DRAFT that the human confirms** (that is what the receipt's
"Review list" button is for). The confidently-wrong line is the hazard, not the uncertain one — no code guard
catches it, only a human reading the transcript. The accurate path today remains **supervised in-session
vision**, per SOP-021 step 1. Warwick has been asked to bind a capable vision model; re-test if he does.

## 4. Cross-component contracts to honour

- **Status projection keys** the browser runner must write into `browser_build_request.progress`:
  `regulars_added`, `searched_added`, `basket_product_count`, `estimated_total`. Without them
  `shopStatus` correctly returns `null` and the UI says "unknown".
- **`callback_data` carries a candidate INDEX, not a product id** — the renderer must persist the candidate list
  in render order, or a tap resolves to the wrong product.
- **`price_basis`** is `stated` | `derived` | `unknown`. A derived price may never be shown as ASDA-quoted.
- **Rotation has no auto-resolution:** rules 23/24 fix the Sure variant while `rule_qa_log` #5 says rotate.
  The planner raises `fixed_variant_conflict` -> `needs_decision`. **Warwick must answer it; do not pick.**

## 5. Hard rules — unchanged, non-negotiable

Never auto-substitute · never book a slot · never check out · never pay · never enter the ASDA password ·
`checked_out` stays false · exactly ONE consumer of the ShopperBot `getUpdates` stream · never hand-roll a
`getUpdates` snippet again · `--dry-run` every writer before the real run · consume credentials from the
environment, never inspect them.
