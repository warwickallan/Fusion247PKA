# BUILD-015 — DEFECT LEDGER

**Status:** OPEN — this file is started, NOT complete. See "Completeness" at the foot.
**Created:** 2026-08-03, during the live acceptance incident for `SHOP-2026-08-03`.
**Why it exists:** Warwick, 2026-08-03: *"list every fucking bug and issue you have
encountered tonight and what the remedial action was... A commit message is evidence,
not the defect ledger."*

Every entry below was observed in a **real, live run against a real ASDA account and a
real household**, not in test. Where a field is unknown it says UNKNOWN rather than
guessing.

---

## How to read this

| Field | Meaning |
|---|---|
| **Symptom** | The literal error or observed behaviour, verbatim where possible |
| **Root cause** | What was actually wrong, established by reading code/state — not inferred |
| **Why controls missed it** | The important column. A defect that no test could have caught is a test gap, not just a bug |
| **Durable fix** | What makes it not recur. "Fixed tonight" is not the same as "cannot recur" |
| **Status** | FIXED / FIXED-NOT-VERIFIED / OPEN / ACCEPTED-RESIDUAL |

---

## D-2026-08-03-01 — `pg` driver unresolvable in three separate service folders

- **Found:** 2026-08-03, ~15:27 (pipeline-runtime), then again cockpit-api, then browser-runner.
- **Symptom:** `--status` reported `healthy: false`, `"the 'pg' driver is not installed for this folder"`. Cockpit-api returned HTTP 500 `{"ok":false,"error":"read_failed","message":"Cannot find module 'pg'"}`.
- **Component:** `services/asdair/pipeline-runtime/`, `services/asdair/cockpit-api/`, `services/asdair/browser-runner/`.
- **Severity:** HIGH — blocks the service entirely.
- **Household impact:** Cockpit showed nothing; runtime could not read pending work.
- **Root cause:** Each folder is its own npm package with its own `node_modules`. `npm install` had never been run in them on this machine. `BUILD-015`'s own `ACTIVATION-DEFERRED.md` recorded this for `services/asdair/shop/` as a known blocker and it was never closed for the siblings.
- **Why controls missed it:** CI installs per-folder; a developer machine does not. `--preflight` DOES check `pg` resolution for the pipeline — but nothing checked cockpit-api or browser-runner.
- **Remedial action tonight:** `npm install --omit=dev` in each folder. browser-runner then passed 65/65 offline tests.
- **Durable fix:** OPEN — needs a repo-level install/test command (see WO-A in the programme doc). Lock files exist but are not exercised from a clean checkout on this machine.
- **Status:** FIXED (live) / OPEN (durably)

## D-2026-08-03-02 — Cockpit evidence photo silently disabled

- **Symptom:** AsdAIr Details view: *"The photo could not be loaded."* Backend returned `{"ok":false,"error":"media_root_not_configured"}`.
- **Root cause:** `ASDAIR_MEDIA_ROOT` was never set in `C:\.fusion247\asdair.env`. `cockpit-api/server.js` documents that unset = `/asdair/media` disabled. It disabled itself silently and reported healthy.
- **Why controls missed it:** Not checked by `--preflight`; the service reports `listening ... media disabled` at startup, which reads as informational, not as a defect.
- **Remedial action:** Added `ASDAIR_MEDIA_ROOT=C:/.fusion247/asdair/shopper-media`, restarted, verified real JPEG bytes (200, image/jpeg, 123212 bytes) end-to-end through both the backend and the cockpit shell proxy.
- **Durable fix:** Documented in `services/asdair/pipeline-runtime/README.md` config checklist. **Preflight still does not check it** — see WO-B.
- **Status:** FIXED (live), preflight gap OPEN
- **Note on a shell hazard:** the first write of this line was corrupted by bash escaping (`C:\.fusion247\asdair` → `C:\.fusion247sdair`). Use forward slashes when writing Windows paths from bash.

## D-2026-08-03-03 — Cockpit AsdAIr views never wired to the read service

- **Symptom:** Overview and Details both showed *"AsdAIr is answering, but this view is not wired to it yet."*
- **Root cause:** No app in the entire cockpit had ever had its views wired. `services/cockpit/public/app.js` rendered one universal placeholder for every non-About view. This was a genuinely missing capability, not a regression.
- **Remedial action:** Felix built `/api/asdair/workspace` + `/api/asdair/media` proxies in `server.mjs` and real Overview/Details rendering in `app.js`, scoped to `currentApp.key==='asdair'` so no other app's behaviour changed. sw.js cache bumped v23→v24.
- **Durable fix:** Committed. **Not visually verified** — see D-2026-08-03-11.
- **Status:** FIXED-NOT-VERIFIED (renders correctly per Warwick's own screenshots, but automated render-check could not run)

## D-2026-08-03-04 — No vision gateway configured; every photo list failed at TRANSCRIBING

- **Symptom (Telegram card, verbatim):** `fusion-gateway: no vision-capable gateway configured (set FUSION_GATEWAY_URL). Refusing to fall back to a text-only model for an image task.`
- **Root cause:** `FUSION_GATEWAY_URL` / `FUSION_GATEWAY_KEY` were never in `asdair.env`, though both existed in `C:\.fusion247\fusion-gateway.env` and were in live use by other services.
- **Why controls missed it:** Not checked by `--preflight`. `interpret-list.js --dry-run` **explicitly skips the model call**, so the dry-run preflight I ran earlier that evening passed while the real path was broken. That is the important lesson: *a dry-run that skips the risky step proves nothing about the risky step.*
- **Remedial action:** Copied both vars into `asdair.env`, restarted runtime.
- **Status:** FIXED (live), preflight gap OPEN

## D-2026-08-03-05 — `fusion.vision` model alias does not exist on the gateway

- **Symptom (verbatim):** `fusion-gateway vision -> 400: {"error":{"message":"/chat/completions: Invalid model name passed in model=fusion.vision. Call '/v1/models' to view available models for your key."`
- **Root cause:** `services/obsidiwikai/src/core/models.mjs` defaults `vision` to `fusion.vision`. `GET {gateway}/v1/models` returns `fusion.reason`, `fusion.query`, `fusion.extract`, `fusion.keyword`, `fusion.embed`, `gpt-5.6-terra`, `gpt-5-mini`, `gpt-5-nano`, `text-embedding-3-large`. **There is no `fusion.vision` alias registered.**
- **Why controls missed it:** Nothing validates the configured model name against the gateway's actual model list. The default was plausible and had presumably never been exercised.
- **Remedial action:** Set `FUSION_MODEL_VISION=gpt-5-mini`; verified with a REAL (non-dry-run) interpretation against the actual photo: 36 lines detected, no error.
- **Durable fix:** Preflight must call `/models` and assert the configured name is present — WO-B. Warwick's words: *"A default model name that the gateway does not provide must never survive preflight again."*
- **Status:** FIXED (live), preflight gap OPEN

## D-2026-08-03-06 — THE ROOT-CAUSE DEFECT: bigint-as-string vs Number() Map lookup

- **Symptom (verbatim, and misleading):** `runPipeline: interpreted line 1 has neither a catalogue match nor a readable raw_reading` — for a line that WAS correctly matched.
- **Component:** `services/asdair/interpret/loadCatalogue.js:107`, consumed by `services/asdair/pipeline/shopLines.js:224`.
- **Severity:** CRITICAL — silently broke every matched line of every shop.
- **Root cause:** `asdair.regulars.id` is `bigint`. node-postgres returns bigint as a **string** by default (no `setTypeParser` override exists anywhere in this codebase). `loadCatalogue` built `new Map(rows.map(r => [r.id, r]))` — string keys. `withCanonicalNames` looked up `byId.get(Number(matched_regular_id))` — a number key. `Map.get` uses SameValueZero, so **the lookup could never hit.** `canonical_name` came back null for a genuinely matched line, and `buildGroundedIntents` threw its "neither a match nor readable" error, which described the wrong thing entirely.
- **Why controls missed it:** `services/asdair/pipeline/test/harness.js` **stubs `loadCatalogue` out entirely**, returning a hand-built already-numeric catalogue. The defective module was never executed by the offline suite. There was no `loadCatalogue.test.js`. 155 tests passed over a module that could not work against a real database.
- **Discovery evidence:** Direct query of `asdair.shop_line` showed line 1 as `{"raw_reading":"3 ARLA semi skim 4pts","matched_regular_id":"4","status":"matched"}` while the pipeline claimed no match; `asdair.regulars WHERE id=4` returned a live, active, named row.
- **Failed prior diagnosis:** I first told Warwick the vision model had returned an illegible line. That was wrong — I read the error message instead of the stored data. Recorded because the wrong diagnosis nearly produced a fix for a non-existent problem.
- **Durable fix:** `Number(r.id)` in the Map build + `loadCatalogue.test.js` which stubs `client.query` to return ids as **strings**, the way Postgres actually does. Suites: pipeline 155→162, interpret 13→16. Commit `62e4b61`.
- **Status:** FIXED
- **Generalised?** PARTIALLY — see D-2026-08-03-13.

## D-2026-08-03-07 — Missing `SELECT` grants; four failures across two tables

- **Symptom:** `permission denied for table households`, then after fixing that, `permission denied for table shopping_lists`.
- **Root cause:** Migrations 005/006/008/009 carry every other grant in the schema but **never mention** `households`, `budget_settings`, `shopping_lists`, `shopping_list_items` or `product_alternatives`. Whatever privilege had been getting the service through existed **only in the live database, never in git** — the exact "provenance gap" migration 005's own header warns about.
- **Why controls missed it:** No test asserts the grant matrix. Schema-as-code and schema-as-deployed had silently diverged since WP1.
- **Failed remedial attempt:** I first granted only `asdair_ro`. It failed again because a code path reads `households` under `asdair_rw`. Recorded because "I fixed the grant" was said twice before it was true.
- **Remedial action:** Migration `010_household_and_list_grants.sql` (written by Keel, applied by me via Supabase's migration tool), covering both roles across all five tables, plus sequence usage where writes occur. Verified with Postgres's own `has_table_privilege` across 11 checks, then a full-schema sweep: all 25 tables + 1 view readable by both roles.
- **Status:** FIXED — committed `b19a097`.
- **Remaining risk:** `services/control-plane/wp-d-proof/asdair-worker.mjs` runs the same command surface under a **third role, `cp_worker`**, whose grants were not audited. The permission-denied class may not be fully closed.

## D-2026-08-03-08 — Receipt card never sent, for any shop, ever

- **Symptom:** Warwick received no "Build this shop" card after sending the list; the shop sat at `RECEIVED`/`wait:build_command` invisibly.
- **Root cause:** `runPipeline.js`'s `messageForTransition` only queues a card keyed on a transition's `to` status. `RECEIVED` is a **creation** status — nothing ever transitions *into* it — so the branch was structurally unreachable. `commands.receiveList` enqueued nothing. The renderer existed and was correct; nothing ever called it.
- **Durable fix:** Keel added a self-healing side-effect in `runPipeline()` gated on `shop.status === 'RECEIVED' && !outboxEverQueued(deps, shop.id, 'receipt')`, using the full ledger history so it recovers shops that predate the fix. Verified live: receipt row queued and `status: done` at 16:11:52.
- **Status:** FIXED

## D-2026-08-03-09 — Progress card fires once per SHOP, not once per attempt

- **Symptom:** Warwick got one "Building the basket / reading your list" card at 18:30 and then **silence through four subsequent retries**, each of which looked identical to nothing happening.
- **Root cause:** Deliberate design choice in the fix for the silence gap — `outboxEverQueued(..., 'progress')` is "ever", so a retry never re-signals.
- **Household impact:** REAL — Warwick repeatedly could not tell whether a tap had registered, and pressed "Build this shop" twice as a result.
- **Durable fix:** OPEN. Needs per-attempt idempotency (e.g. keyed on the retry/attempt count), not per-shop.
- **Status:** OPEN

## D-2026-08-03-10 — `answerCallbackQuery` always fails; every tap looks broken

- **Symptom (verbatim, recurring):** `shopper answerCallbackQuery rejected: Bad Request: query is too old and response timeout expired or query ID is invalid`, and `pass_failed` on the containing pass.
- **Household impact:** Every Telegram button press appears to fail. The underlying command **does** persist and execute — but the user cannot tell.
- **Root cause:** `routeTaps` dispatches the durable command *first*, then acks the callback. The runtime's 60s pass interval means the callback id has expired by then.
- **Why it cannot be fixed the obvious way:** Acking first would trade a cosmetic defect for a real one — acknowledging before durable persistence, which is the exact invariant that loses a shopping list. Documented in SOP-021a as "do not fix it that way."
- **Durable fix:** OPEN. Needs the ack to happen on a separate, immediate path from the durable write, not by reordering them.
- **Status:** OPEN

## D-2026-08-03-11 — `render-check.mjs` cannot run on this machine

- **Symptom:** `RENDER-CHECK FAILED — Vue did not mount`, identically against the **untouched committed baseline** and against `https://example.com`.
- **Root cause (evidenced by Keel):** Edge self-relaunches under this flag combination, spawning a **detached, unwaited** second process (carrying a `--edge-skip-compat-layer-relaunch` flag it added itself). The process the harness waits on exits clean and empty in ~193ms. Not a Chromium headless bug, not a shell artifact; consistent with a Windows compatibility-layer relaunch on this machine.
- **Ruled out with evidence:** shell quoting; PowerShell vs Bash vs Node spawn; flag ordering; isolated `--user-data-dir`; `--headless=new` vs classic; `--dump-dom` vs `--screenshot` (no file created either); enterprise `HeadlessMode` policy (absent).
- **Status:** OPEN — no safe fix found. Cockpit UI changes currently ship without automated render verification.
- **Side effect:** Keel's diagnostics left ~18 orphaned windowless Edge processes (root PIDs 33244, 42080). Cleanup was blocked by the permission system. Not touched.

## D-2026-08-03-12 — No plan builder exists; the browser step cannot run unattended

- **Severity:** CRITICAL to the product's stated goal.
- **Root cause (verified by enumeration, not inspection):** `step_id` appears in exactly 9 files, **all inside `browser-runner/`**. `stepQueueBrowserBuild` creates the `browser_build_request` row and never populates `progress.plan`. Nothing in the repository converts a resolved `shop_line` set into a runner plan.
- **Household impact:** Tonight's basket was built from **three hand-assembled plan files**. That is the single largest hand-hold of the night and it directly contradicts the standing rule that AsdAIr runs independent of any Claude Code session.
- **Status:** OPEN — this is a build, not a fix. WO-C.

## D-2026-08-03-13 — Latent second instance of the bigint-as-string class

- **Location:** `services/asdair/pipeline/shopLines.js:218-221` — the fallback branch of `withCanonicalNames` builds `new Map(regulars.map(r => [r.id, r]))` (raw id, no coercion) and then looks up with `.get(Number(...))` on line 224.
- **Currently unreachable** because `deps.js` always supplies `regularsById`. Any future caller passing a `regulars` array straight from `pg` reproduces D-06 exactly.
- **Why it survives:** `shopLines.test.js:94-97` exercises this branch with numeric ids on both sides, so it would pass whether or not the coercion exists.
- **Status:** OPEN — reported, not fixed.

## D-2026-08-03-14 — `--plan-file` silently ignored on re-run; the workaround is a trap

- **Symptom:** Running a NEW plan file against an existing request logged `reconstructed: 22 planned, 22 already done, 0 remaining` and added nothing.
- **Root cause:** `reconstruct()` only reads the plan file when `progress.plan` is empty.
- **Worse:** the obvious workaround, `proofkit.cjs seed`, **overwrites `progress` wholesale**, wiping `_completed_steps` — on a real shop that re-adds every item already in the basket.
- **Correct route (used tonight):** terminate the old request and insert a new `browser_build_request` row; `bbr_one_live_per_shop` requires the old one be terminal first.
- **Status:** DOCUMENTED (SOP-021a); no code change.

## D-2026-08-03-15 — Alias matching is exact-string; word order and typos defeat it

- **Real cost tonight:** "2 yazoo choc" did not match stored alias `choc yazoo` (word order). "Double Glouester cheese" did not match `double gloucester` (typo). Both became human questions that had already been answered.
- **Status:** OPEN — known and documented since 2026-07-28; unfixed. Order-insensitive/fuzzy matching remains the real fix.

## D-2026-08-03-16 — Google Drive decisions were never promoted into Supabase

- **Symptom:** The shop asked Warwick about Nescafe Azera and Toothpaste — **both answered in the "Asda - Decisions Log" Google Doc on 2026-07-06.**
- **Root cause:** `asdair.rules` contains stub rows (ids 12, 14, 15, 22, 23, 24, 25, 27, 29, 31) with the right `match_term` but **`note` empty** — the decision content was never carried across. Others were never created at all.
- **Additional real defect found by Silas while fixing this:** `planner.js:882` does `acc.requested_qty += normaliseQty(...)` — the planner **sums** quantities on dedupe, while the decisions log explicitly rules *"dedupe to a single line, never double-add or bump quantity."* Direct contradiction. NOT FIXED.
- **Remedial action:** Migration `011_decisions_log_rule_notes_seed.sql` written (gitignored by the sanctioned `*seed*.sql` pattern, as it carries household preference rows). **NOT YET APPLIED** — needs the admin role, since `asdair_rw` deliberately lacks UPDATE on `rules`.
- **Status:** OPEN

## D-2026-08-03-17 — SOP-021's bulk-add method was never runner code

- **Root cause:** SOP-021 §4 documents a Regulars-tab bulk-checkbox flow using `scroll_to`, `read_page`, `find` — **Claude-in-Chrome MCP tool names**, from the operating mode superseded by commit `ab3f231`. `browser-runner/` contains no bulk/checkbox/sort implementation at all.
- **Measured cost of the actual implementation:** ~13s/item happy path, ~25–30s when `locate_product` falls back to reference-search, +1.5s inter-step. **A 40-line shop is 10–20 minutes of pure runner time.** Warwick's comparison: a browser-driving session does the same shop in ~5 minutes.
- **Status:** OPEN — bulk add is an unbuilt capability. WO-D.

## D-2026-08-03-18 — Asdair's own contract was stale, and blocked the live shop

- **Symptom:** A dispatched Asdair specialist correctly refused to run `browser-runner.js`, citing its own `AGENTS.md`: *"the clicks are Larry's."*
- **Root cause:** Commit `ab3f231` (2026-07-28) proved `runner.js` needs no MCP tool and corrected SOP-021, but **the correction was never propagated into Asdair's own contract**. The specialist was right; the document was wrong.
- **Remedial action:** `Team/Asdair - Household Shopping Steward/AGENTS.md` corrected in place, commit `27f4619`.
- **Second-order defect, mine:** after the contract fix, I gave the specialist an incrementally-patched spec across several messages instead of one clean source of truth, and it correctly rejected the batch as containing items it could not verify. **Recorded as a process defect on my side, not the specialist's.**
- **Status:** FIXED (contract) / process lesson recorded

## D-2026-08-03-19 — pipeline-runtime stalls silently while reporting healthy

- **Symptom:** Twice, `--status` reported `running: true` while `last_write_at` was **an hour old**. A real retry from Warwick sat unprocessed for ~60 minutes.
- **Detection:** compare `activity.last_write_at` to wall clock. `running: true` alone is not liveness.
- **Remedial action tonight:** `--restart`.
- **Status:** OPEN — no automatic stall detection exists.

## D-2026-08-03-20 — Substitutions left ON in the delivered basket

- **Symptom:** Final basket carried ASDA's *"Allow Substitutions for all"* toggle ON, contradicting standing rule 6.
- **Root cause:** The runner is **hard-blocked** from touching substitution controls, in three independent layers: no allowlisted command; `substitut` is in `guards.DENY_TARGET` and injected into the page click helper; `forbidden.test.cjs` fails the build if the token appears in executable source. This is deliberate — same tier as checkout and payment.
- **Status:** ACCEPTED-RESIDUAL (by design) — but **it means every basket requires a human substitution pass before purchase**, and that requirement was not previously written down. Now in SOP-021a.

---

## Completeness

**This ledger currently covers 2026-08-03 only.** Warwick's directive requires backfill
from all prior BUILD-015 branches, PRs, reviews and session logs — the pre-existing
defect classes (scratchpad receiver, missing learning write-back, allowlist variable-name
mismatch, machine ledger exposed as human actions, stale tap ordering, command consumed
twice, offset-before-persist, reboot recovery unproven, and the rest). That backfill is
**NOT DONE** and is tracked as WO-E.

Nothing in this file should be read as a claim that BUILD-015 is durable.
