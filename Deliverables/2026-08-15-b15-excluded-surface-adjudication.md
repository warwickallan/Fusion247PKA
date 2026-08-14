# BUILD-015 — excluded surfaces adjudicated against the ACTUAL live journey

**Warwick, 2026-08-15:** *"Before Codex execution 2, reconcile those excluded surfaces against the ACTUAL
current AsdAIr live journey. Anything genuinely consequential to that current journey must be represented
in the final release claim. Anything superseded, deferred or not used by the live journey may remain out,
but say why."*

**Established from the INSTALLED RUNTIME — the registered scheduled tasks and the process each actually
spawns — not from documentation prose.** Base `443cad4` → head `2fffcef`. Every size measured, not estimated.

---

## 🔴 THE FINDING THAT MATTERS MOST — a live, currently-wrong value on Warwick's own screen

**Eleven rows in the live database right now carry `status = CANCELLED, human_state = 'COMPLETE'`.**

Migration 020's backfill maps `CANCELLED → 'COMPLETE'` (`020_…sql:513`). The production mapping every
writer and reader now uses maps it the other way — `services/asdair/shop/humanState.js:86` — and says why,
in its own header:

> *"Migration 020 and the first Cockpit implementation both proposed COMPLETE. **OVERRULED** (Larry,
> 2026-08-13) … 'Complete' tells Warwick his shop is done, which for a cancelled shop implies groceries
> are coming when nothing was ordered."*

`cockpit-api/canonicalState.js:75` **prefers the stored column**, so **the Cockpit is today reporting
"Complete" for eleven cancelled shops.** `detectStateDrift` is the only thing that says otherwise, and
`canonicalState.js:88-100` names the underlying hazard plainly: *"It installs NO TRIGGER."*

**A re-apply of 020 would deterministically rewrite them back**, and would also overwrite any cancelled
shop the production path has since corrected. **This is not hypothetical and it is not a security theory —
it is his dashboard telling him a shop is done when nothing was ordered.**

---

## Verdicts — every excluded surface

| Surface | Verdict | Evidence |
|---|---|---|
| `db/020_…sql` | **LIVE-CONSEQUENTIAL (split)** | `human_state` written on every transition; provenance half is live schema with **0 rows** and no production INSERT anywhere |
| `handoff/` (`buildHandoff`, `claim`, `completion`, `instructions`, `renderChecklist`, `fingerprint`) | **LIVE-CONSEQUENTIAL** | `runPipeline.js:2069,2077,2209`; `runtime.js:2364,2388`; and the read service reaches `renderChecklist` via `readChecklist.js:52,125` |
| `handoff/index.js` · `handoffCli.js` · `mutation-proof.js` | **NOT WIRED / EVIDENCE-ONLY** | zero importers repo-wide; production imports the leaf files directly. CLI appears only inside two error-message string literals |
| `packet/buildExecutionPacket.js` | **LIVE-CONSEQUENTIAL** | `runPipeline.js:79`, called at `:2053` |
| `packet/renderChecklist.js` · `schemaAssert.js` · `committedSchema.js` | **NOT WIRED / EVIDENCE-ONLY** | stated in source at `buildExecutionPacket.js:74` — schema validation is test-only |
| `skill/` (`planner`, `rulebook`, `listNormaliser`) | **LIVE-CONSEQUENTIAL** | `deps.js:44,48`; `runPipeline.js:90` — chooses the products and applies the household rules |
| `bot/` (`renderMessages`, `resolveTap`, `inboundRouter`) | **LIVE-CONSEQUENTIAL** | `runtime.js:62,67,2395-2396` — every card Warwick sees and every tap he makes |
| `cockpit/public/shopping.js` · `app.js` | **LIVE-CONSEQUENTIAL** | `shopping.js:239-242` is one of the two submission doors; `app.js:404-424` renders the state Warwick acts on |
| `pipeline/` production | **LIVE-CONSEQUENTIAL** | `runtime.js` **is** the process `MyPKA-AsdAIr-Runtime` executes |
| `cockpit-api/` production | **LIVE-CONSEQUENTIAL** | `server.js` **is** the process `MyPKA-AsdAIr-ReadService` executes |
| **`browser-runner/`** | **DEFERRED / NOT WIRED** | **five independent searches, all negative for a production caller** — no scheduled task, no spawn (the only spawn target is `pipeline/runtime.js` per `runtime-paths.mjs:22`), no importer outside comments. `stages.js:314`: the CDP arm *"is off the live route and refuses a supervised handoff by design"*. **The ASDA session is driven by a human.** ⚠️ Caveat: `runtime-deps.mjs:56` lists `browser-runner/store.cjs` as an **AC10 BLOCKING preflight dependency**, so a broken install there refuses to start the live runtime — it **gates** the journey without **executing** on it |
| all `*.test.*`, `proof/`, `testdata/` | **EVIDENCE-ONLY** | |
| `db/016_shop_source_image.sql` | out — 020's own header records it as **"AUTHORED, NOT APPLIED"** | |

**A stale claim corrected:** several Deliverables state *"`handoff/` has zero non-test importers."* That was
true at `d907350` (2026-08-08/09) and is **false at head** — `runPipeline.js:63-79` says so itself:
*"Before these three imports … had ZERO production callers."*

## The honest minimum does NOT fit, and no amount of trimming changes that

| | bytes |
|---|---|
| the five already reviewed | 46,423 |
| **the honest minimum (28 further live-consequential files) + the five** | **1,210,955** |

**Twenty times the 60,000-byte ceiling.** `pipeline/` alone is 1,003,190; `cockpit-api/` 627,911;
`public/app.js` 270,394. **This is not a near-miss to be trimmed — a final release claim covering the whole
live journey cannot be delivered by one more Codex execution, or by three.**

### Execution 2's scope — chosen, and coherent

**`db/020_…sql` + `shop/humanState.js` + `cockpit-api/canonicalState.js` = 50,095 bytes.** Fits with 9,905
to spare. The already-reviewed five are **not** re-included — spending 46,423 of the budget re-delivering a
verdict already given would be waste.

It is coherent as one question: **the migration, the mapping that overruled it, and the reader that detects
the resulting drift** — which is precisely where eleven live rows are currently wrong.

`shop/shopStore.js` (23,432, the writer) falls outside: adding it breaks the budget, and whether 020's
backfill contradicts the agreed mapping is answerable from the mapping and the reader without it.

### What the release claim must SAY, since it cannot review it

**`handoff/`, `packet/buildExecutionPacket.js`, `skill/`, `bot/`, both UI files, `pipeline/` production and
`cockpit-api/` production are LIVE and UNREVIEWED.** They are not defensibly *out of a release claim* —
they are out of a *review pass*. **That distinction goes in the claim in those words.** It is a scoping
disclosure, not a review, and nobody may read it as coverage.
