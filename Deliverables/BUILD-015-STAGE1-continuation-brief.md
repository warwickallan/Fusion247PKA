# BUILD-015 AsdAIr Stage 1 — continuation brief

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

### 2.3 Order reconciliation
An agent was building `services/asdair/reconcile/` when this brief was written. **Check whether branch
`build-015/order-reconciliation` exists and merge it** before assuming it is missing.

### 2.4 Live acceptance
The 16-point list in Warwick's directive. Send exactly one message — "Send last night's list to ShopperBot now."
Note the real 2026-07-27 list photo is still **unconsumed** on the bot (update `171031117`), because the receiver
has only ever been dry-run. Expected confirmation facts: 32 product lines, 47 units, £110.75 in stated line
prices, Wall's 4 Pork Sausage Rolls with **no visible price** — do NOT invent it.

### 2.5 CI, QA, merge
`.github/workflows/asdair-tests.yml` runs only the `skill` and `outcome` suites — **`intake`, `shop`, `bot`,
`transcribe` and `reconcile` are not in CI.** Add them. Then Codex/Tower review at the exact head, fix genuine
findings, merge with the expected-head guard.

## 3. The finding that changes the design — read before building the transcription step

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
