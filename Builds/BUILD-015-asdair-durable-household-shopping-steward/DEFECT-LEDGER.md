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
- **Status:** ~~OPEN — bulk add is an unbuilt capability. WO-D.~~ **RESOLVED 2026-08-04** by Warwick's ruling
  `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`. The finding was right and was then read backwards: the
  Claude-in-Chrome tool names were evidence that SOP-021 §4 documented the **real, browser-driven process**, not
  a specification for the runner. **The proven method was Brand A–Z ordered sequential traversal, not a one-click
  bulk add** — so the capability was never missing, it was misdescribed. **WO-D is CANCELLED as live-runtime
  work.** SOP-021 §4 amended 2026-08-04; canonical: `RUNTIME-DECISION.md`. Residual honest gap: the repository
  does not independently corroborate the exact mechanism — capture evidence during the next real shop.

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

# BACKFILL — everything before 2026-08-03 (WO-E)

**Added 2026-08-03 by Pax under `WO-2026-08-03-DURABILITY-WO-E` (directive §9).**
The twenty entries above are untouched. Everything below is mined from the repository's
own committed record.

## READ THIS FIRST — the sources this backfill could and could not reach

**Warwick's directive names commit messages as the primary source. THEY WERE NOT
REACHABLE.** The agent grant that executed WO-E holds `Read / Glob / Grep` and **no
shell**, so `git log --all`, `git show` and `gh pr view` could not be run; commit objects
are zlib-packed and unreadable without git. This is a real gap in the backfill, not a
completed pass — it is recorded here rather than papered over.

| Source | Reached? |
|---|---|
| `Builds/BUILD-015-*/` (goal contract, ACCEPTANCE-AND-EVIDENCE, ACTIVATION-DEFERRED, work-order programme) | **YES** |
| `services/asdair/**` READMEs, proof documents, migrations, source comments, test names | **YES** |
| `Team Knowledge/session-logs/2026/07/`, `/08/` | **YES** |
| `SOP-021`, `SOP-021a` | **YES** |
| `Deliverables/2026-07-27-nolan-asdair-specialist-assessment.md`, `…-07-28-asdair-stage2-…` | **YES** |
| `.git/packed-refs` (branch names + head SHAs) | **YES** |
| **`git log` / commit message bodies** | **NO — no shell in this grant** |
| **PR #73 / #82 descriptions and review threads via `gh`** | **NO — no shell in this grant** |

**Consequence for the "affected commit" and "fix commit" fields:** every SHA below is one
**quoted inside a committed document**, not one read from git. They are pointers to be
verified, not verified pointers. Where a document is the only witness to a finding
(notably the Codex `TQA-PR73-*` findings, whose full text lives in `~/.codex/sessions`
and not in this repo) the entry says **SINGLE-SOURCE**.

**Field convention.** Any field from the standard set that does **not** appear on an entry
below could **not** be established from the sources above. It is NOT RECORDED — it is not
omitted for brevity, and it was not inferred. Where two sources disagree, both are
recorded and the contradiction is flagged.

**Severity convention.** Where the record grades a defect (Codex `HIGH`, the ledger's own
`CRITICAL`) that grade is quoted as fact. Where it does not, the entry says `UNGRADED in
the record` and any grade after that is marked **Pax's read — opinion, not record**.

---

## A. Before the build — 2026-07-17 to 2026-07-27

The durability gaps that existed when IDEA-012 was promoted to BUILD-015 at `87c7ff6`.
**Fifteen entries.**

### D-2026-07-17-01 — long-poll connections silently killed at ~45s by the home router

- **Found:** 2026-07-17, live. Carried into AsdAIr intake as a pre-existing constraint.
- **Symptom:** a Telegram long-poll held open ~45s is dropped by the local router with no error visible to the caller.
- **Component:** any `getUpdates` long-poll on this machine; encoded in `services/asdair/intake/`.
- **Severity:** UNGRADED in the record.
- **Root cause:** NOT RECORDED beyond *"the home router silently kills connections held open ~45s"*.
- **Durable fix:** `SHOPPER_POLL_TIMEOUT_SECONDS` defaults to `0` and is **capped at 25s** in the receiver.
- **Discovery evidence:** `services/asdair/intake/README.md` credential table.
- **Status:** FIXED (by cap).
- **Generalised?** The cap is local to this receiver. Whether other pollers in the estate carry it is NOT RECORDED.

### D-2026-07-27-01 — the weekly receiver lived only in a per-session scratchpad

- **Found:** 2026-07-27, by Nolan's assessment pass.
- **Symptom:** the entrypoint that fetches the week's list existed only as `…/Temp/claude/C--Fusion247PKA/<session-uuid>/scratchpad/shopper-recv.mjs`, and was **found under two different session UUIDs**.
- **Component:** Telegram intake (pre-`services/asdair/intake/`).
- **Severity:** UNGRADED in the record. Nolan's framing: *"A disposable runtime with a disposable entrypoint has no function to remember."*
- **Household impact:** the receiver was rebuilt from scratch at least twice; no tests, no shared behaviour, no version history.
- **Root cause:** operational capability was never committed. The shop worked *in a session*, so nothing ever forced it into Git.
- **Why controls missed it:** nothing in CI, review or the repo can see a file that is not in the repo. **There was no control — the artefact was outside every one of them by construction.**
- **Discovery evidence:** `Deliverables/2026-07-27-nolan-asdair-specialist-assessment.md` §1.2, §8(a).
- **Durable fix:** `services/asdair/intake/` — committed, tested receiver, whose README states the reason: *"It exists because the receiver used to be hand-written into a session scratchpad every week and thrown away."*
- **Fix branch:** `idea-012/asdair-shopper-intake-receiver` (`ee8476e`), landed via PR #82.
- **Regression test:** `services/asdair/intake/shopperIntake.test.js`, offline.
- **CI evidence:** added to `.github/workflows/asdair-tests.yml` — but see D-2026-07-28-20, which is the defect that the suite existed while CI did not run it.
- **Status:** FIXED.

### D-2026-07-27-02 — a real shop left no durable learning at all

- **Found:** 2026-07-27/28. **The single most important entry in this section.**
- **Symptom:** the 2026-07-27 weekly shop ran almost hands-off, built a £111.75 checkout-ready basket, and wrote **nothing** to the database — no order, no order events, no regulars, no decisions.
- **Component:** the whole write-back path. `orders`, `order_events`, `rule_qa_log` had **zero writers anywhere in the repo, including tests**.
- **Severity:** UNGRADED in the record; it is the stated reason BUILD-015 exists.
- **Household impact:** three genuinely-new items were worked out during the shop and forgotten. Next week's instance would be *strictly worse informed* than that week's was.
- **Root cause:** the tables, the governed write seam and the `add_list_item` allowlist all existed. **Only the write was missing.**
- **Why controls missed it:** every test in the estate exercised the read/plan half. **There was no test that could fail for "nothing was written", because nothing was expected to write.**
- **Discovery evidence:** the shop's own session-log open thread — *"Weekly-order capture into `asdair.shopping_lists` still to build — this week's basket was NOT written to the DB (offered, not done)"* (`2026-07-27-19-03_larry_asdair-weekly-shop-browser-automated.md:60`); Nolan §2, §8(c); Larry's session insight *"A capability can work brilliantly and be entirely undurable."*
- **Durable fix:** `services/asdair/outcome/` writers, plus a runtime caller (D-2026-07-28-05 records that the caller was itself initially missing). Learning recovered by hand on 2026-07-28: 20 harvested ASDA product IDs, 6 new regulars, 5 alias sets.
- **Status:** FIXED — with the caveat that the recovery was manual and the automatic path was only completed at `075ffdf`.
- **Remaining risk:** the same class recurred on 2026-08-03 — six new regulars were again written **by hand** (`DURABILITY-CLOSEOUT-WORK-ORDERS.md`, "Required hand-holding").
- **Generalised?** Yes, into the catalogue-grounding cycle: *"These are two arcs of one cycle. Break the write-back arc and next week's read arc degrades against a stale catalogue."* (`services/asdair/interpret/README.md`)

### D-2026-07-27-03 — the operating method lived only in a machine-local memory file

- **Found:** 2026-07-27.
- **Symptom:** the browser add method — *"the single most valuable operational artefact AsdAIr has"* — existed as one paragraph in `…/memory/asdair-idea012-runtime.md`: outside the repo, outside version control, outside review, unportable to another machine.
- **Severity:** UNGRADED in the record.
- **Why controls missed it:** a wiki contract would have had to cite a path under `C:/Users/<user>/.claude/…`. Nothing in the repo could reference, review or test it.
- **Discovery evidence:** Nolan §1.2, §2, §8(b).
- **Durable fix:** rescued into `Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md`.
- **Status:** FIXED — **but the rescued method was itself wrong in two places**; see D-2026-08-03-17 (the bulk-add method was never runner code) and D-2026-07-28-26.
- **Generalised?** Yes — Warwick, 2026-07-28: *"Nothing must live permanently in scratchpads."* Restated as a standing section in `services/asdair/interpret/README.md`.

### D-2026-07-27-04 — `asdair.regulars` was live and load-bearing with no committed migration

- **Found:** 2026-07-27.
- **Symptom:** a clean database built from git alone could not be stood up, and nothing in review could see the shape the code depended on. The table's shape was inferable **only from ad-hoc `create table` statements inside test files** (`db/mypka/test/apply-teardown.test.mjs:30`).
- **Component:** `services/asdair/db/`.
- **Severity:** UNGRADED. Nolan: *"Needed, but it is Keel/Silas work, not a hiring prerequisite. Report it; don't block on it."*
- **Root cause:** the table was created directly in the live database and never migrated.
- **Why controls missed it:** CI's integration job applies `001_asdair_schema.sql` from scratch — which does not contain `regulars`, so **nothing in CI ever needed it to exist**.
- **Discovery evidence:** Nolan §1.2, §2, §9(5).
- **Durable fix:** `services/asdair/db/004_asdair_regulars.sql`, whose header states the reason verbatim.
- **Status:** FIXED.
- **Remaining risk:** this is the **provenance-gap class**, and it recurred twice more — migration 005's header (the `asdair_rw` grants existed only live) and D-2026-08-03-07 (household/list grants existed only live). WO-G exists to close the class by enumeration rather than by instance.

### D-2026-07-27-05 — a rival copy of the operating method lived as 21 rows in `asdair.skill_steps`

- **Found:** 2026-07-27, by a fresh Asdair instance introspecting the database.
- **Symptom:** a second, conflicting copy of the weekly-shop method existed as data. A fresh instance found it and correctly reported it as an SSOT violation.
- **Root cause:** breach of the function/state split — **Git owns the METHOD, Postgres owns the STATE**.
- **Why controls missed it:** no control inspects the database for documents. The violation was only findable by an agent that went looking.
- **Discovery evidence:** `SOP-021` §"Provenance of the operational detail above".
- **Durable fix:** the useful content folded into SOP-021 on 2026-07-27; the database copy superseded **non-destructively**. SOP-021 now instructs: *"If a future instance finds a method table in the `asdair` schema, this file wins; report the table rather than following it."*
- **Status:** FIXED.
- **Note:** the two points where the copy **conflicted** were deliberately not resolved — they are D-2026-07-27-06 and D-2026-07-27-07.

### D-2026-07-27-06 — SAFETY CONFLICT: the rescued method said *"substitute Banana → Strawberry"*

- **Found:** 2026-07-27, while folding the database method copy into SOP-021.
- **Symptom:** a resolution step instructing an outright substitution, against a standing rule that forbids substitution and live rules (17 and 26) that **hard-exclude Banana Yazoo**.
- **Severity:** UNGRADED; SOP-021 marks it ⚠️ SAFETY CONFLICT.
- **Household impact:** a fresh instance trusting the database method could add an item a standing rule permanently excludes.
- **Root cause: GENUINELY UNRESOLVED, AND RECORDED AS SUCH.** Two readings, both legitimate: (a) a `map` directive — a learned "this list line means that product" — which is a *different mechanism* from an out-of-stock auto-substitution; (b) a real safety bug in the database copy. **Neither is encoded as fact.**
- **Temporary workaround:** treat any banana/strawberry line as `needs_decision` and ask.
- **Status:** **OPEN — awaiting a Warwick `product-decision`.** Raised 2026-07-27; still open in the goal contract's "Open questions" and in `SOP-021` as at 2026-08-03. **Open for seven days.**
- **Why this entry matters:** it is the model for how an unresolvable finding should be recorded — both readings kept, neither picked.

### D-2026-07-27-07 — contradiction: sort BRAND A–Z or plain A–Z?

- **Found:** 2026-07-27, same source as D-06.
- **Symptom:** `SOP-021` §4 says sort A–Z; the superseded database copy said sort **BRAND** A–Z, and that the resolved basket be output brand-sorted.
- **Root cause:** UNKNOWN. SOP-021 is explicit: *"These may be the same intent loosely worded, or the brand sort may be a deliberate refinement that made the single-pass tick reliable. Unknown which."*
- **Status:** ~~OPEN, **downgraded 2026-08-03 to moot** — `browser-runner` sorts nothing. It only re-acquires meaning if bulk add is ever built (WO-D). Recorded as a live contradiction, not resolved.~~ **RESOLVED 2026-08-04: BRAND A–Z**, by Warwick's ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`. The superseded database copy was right, and it applies to **both** halves the contradiction named — the ASDA grid ordering **and** the resolved output, which sorts by normalized brand A–Z then canonical product name A–Z. **The ordering is the speed.** `CANONICAL-WEEKLY-SHOP-PROCESS.md` §E. Closed in SOP-021, SOP-021a §8.5, the goal contract and `Deliverables/NEXT-ASDAIR-SESSION-brief.md`.

### D-2026-07-27-08 — the shopper intake route had zero callers, and nothing drained the intent queue

- **Found:** 2026-07-27 (zero callers), re-confirmed 2026-07-28 (worker not running).
- **Symptom:** `services/hub/shopper/shopperRoute.mjs` — *"a tested library that nothing invokes"*; a full-repo grep found only the file and its test. Separately, `services/control-plane/wp-d-proof/asdair-worker.mjs` was built and tested but **not running and not scheduled**.
- **Household impact:** a list arriving on Telegram becomes `add_list_item` intents in `asdair.command_request` that **sit there until a worker is run by hand**.
- **Severity:** UNGRADED. Larry's Stage 2 assessment calls it *"The one thing to fix first, regardless."*
- **Why controls missed it:** both modules had passing tests. **A green suite proves a module works; it says nothing about whether anything calls it.** This is the same shape as TQA-PR73-006 (D-2026-07-28-05), and it was found twice, independently, by different routes.
- **Discovery evidence:** Nolan §1.2; `Deliverables/2026-07-28-asdair-stage2-telegram-and-daemon-assessment.md` closing section; `SOP-021` "Known limitations".
- **Durable fix:** the `services/asdair/pipeline/` orchestrator + `pipeline-runtime` loop.
- **Fix branch:** `build-015/pipeline-orchestrator` (`712b2be`).
- **Status:** FIXED in code. **`SOP-021`'s "Known limitations" still asserts that nothing drains the queue** — that line was written 2026-07-28 and is now contradicted by the pipeline runtime. **CONTRADICTION FLAGGED, not resolved here** (SOP-021 is outside this Work Order's file surface).
- **Remaining risk:** `asdair-worker.mjs` runs the same command surface under a **third database role, `cp_worker`**, whose grants were never audited — the same open risk recorded at D-2026-08-03-07.

### D-2026-07-27-09 — the bulk tick-pass silently skipped an item that was not a Regular

- **Found:** 2026-07-27, live, during the real shop.
- **Symptom:** Wall's Sausage Rolls was on Mum's list, is **not** in her Regulars/Favourites, and was therefore silently skipped by the 25-item bulk tick. No error. The trolley was simply missing an item.
- **Severity:** UNGRADED in the record.
- **Household impact:** REAL — an item Mum asked for would have been absent from the delivery.
- **Root cause:** the bulk method operates over the Regulars grid only; an off-catalogue line has no checkbox to tick and produces no signal.
- **Why controls missed it:** nothing automated caught it. **It was caught by the mandatory line-by-line reconcile — a human procedure, and the only control that could have.** Nolan §4.2: *"The one rule that caught a real failure last night is the mandatory reconcile… That rule currently exists as prose in two narrative documents. It should be a numbered step."*
- **Durable fix:** the reconcile promoted to a numbered SOP-021 step. The catalogue-grounded interpretation path additionally makes an off-catalogue line an explicit `unmatched_new_item` rather than a silent absence.
- **Status:** FIXED (procedurally). The follow-up *"add Wall's 4-pack to Mum's ASDA Favourites"* became the canonical example of a genuine `pending_action` — see D-2026-07-28-14.

### D-2026-07-27-10 — a documented schema contract had gone stale (`next_week_draft`)

- **Found:** 2026-07-27.
- **Symptom:** `asdairCommands.mjs` uses `status='next_week_draft'`; the committed schema documents `pending | processed | archived` (`001_asdair_schema.sql:228`).
- **Severity:** low — the column is unconstrained text, so nothing fails.
- **Root cause:** the code moved; the documented contract did not.
- **Why controls missed it:** an unconstrained text column has no mechanism that could disagree. **A CHECK constraint would have made this impossible; a comment could only be wrong.**
- **Discovery evidence:** Nolan §1.2.
- **Status:** NOT RECORDED as fixed anywhere. **Treat as OPEN.**

### D-2026-07-27-11 — the estate's own records contradicted each other about whether AsdAIr existed

- **Found:** 2026-07-27.
- **Symptom:** three live records in disagreement on the day a real shop ran: `Team Knowledge/fusion-brief/current-state.md:24` says *"Parked: AsdAIr / household shopping"*; `services/cockpit/server.mjs:45` actively filters shopping out of the cockpit (*"AsdAIr parked until mum gets her own linked app"*); `tsk-2026-07-10-005` (open, priority 4) recommends the automation layer *"stays external, not migrated into myPKA"*.
- **Severity:** UNGRADED. Nolan: *"Hiring into an unresolved contradiction is precisely how the service estate got orphaned the first time."*
- **Root cause:** no mechanism ties a live capability's operating state to the documents that describe it.
- **Status:** the cockpit filter was superseded on 2026-08-03 when Felix wired real AsdAIr views. Whether `current-state.md` and `tsk-2026-07-10-005` were ever corrected is **NOT RECORDED**. **Treat as OPEN until checked.**

### D-2026-07-27-12 — the machine-local memory asserted deliverables that do not exist

- **Found:** 2026-07-27, while verifying the memory file.
- **Symptom:** `asdair-idea012-runtime.md:26` names three `Deliverables/2026-07-21-asdair-*` files. Only two `2026-07-21-*` deliverables exist and **neither is one of those**.
- **Root cause:** UNKNOWN. Nolan explicitly did not resolve it: *"They may live in an unvisited worktree (I did not check — out of scope by instruction). **Unverified; do not cite them as existing.**"*
- **Why it matters:** the same file was the sole home of the operating method (D-03). A durable note containing an unverifiable claim is a warning about the whole artefact class.
- **Status:** UNRESOLVED. Never revisited in any later record.

### D-2026-07-27-13 — shared advisory-lock key space

- **Found:** 2026-07-27.
- **Symptom:** `pg_advisory_xact_lock($householdId)` uses a bare `bigint`; for the single real household that is a very low integer. Any other subsystem in the same database taking an advisory lock on the same small integer collides.
- **Severity:** Nolan graded 🟡 — *"Low probability, real shared namespace. Reported, not a blocker."*
- **Status:** OPEN — reported; no fix recorded since.

### D-2026-07-27-14 — no single-poller enforcement existed on the ShopperBot token

- **Found:** 2026-07-27, as the sharpest concurrency risk in the estate.
- **Symptom:** the safety argument in memory was *"Nothing else polls it → getUpdates is safe (no 409)"*. Nolan: *"That is an assumption a second concurrent lane breaks by existing."* There was **no lock, no lease and no single-poller enforcement** on the token.
- **Severity:** Nolan graded 🔴, data-loss class.
- **Household impact:** realistic worst case — *"Mum's weekly list is permanently lost with no error surfaced to anyone."*
- **Why controls missed it:** the control was a **belief about the environment, not a mechanism**. It was true until it wasn't, and nothing would have said so.
- **Durable fix:** the `ensure-asdair-runtime.mjs` exclusive lock — `O_EXCL` create, atomic-rename stale reclaim, holder bound to **pid + OS creation time + command-line fingerprint**. Proven with real processes, including a three-way cold race (`{"started":1,"refused":2}`) and a recycled-pid case (*"pid 22504 exists but was created at … — the pid has been REUSED"*).
- **Fix branch:** `build-015/runtime-recovery` (`ee1809a`).
- **Live/proof evidence:** `services/asdair/pipeline-runtime/RUNTIME-PROOF.md` §1–3.
- **Status:** FIXED, proven against real OS processes rather than a unit test.
- **Generalised?** Yes — `services/asdair/bot/noPolling.test.js` scans the control-surface folder's own source and **fails the build** if a poll method ever appears there. The invariant is enforced by a test rather than by memory.

---

## B. Stage 1 build, review and merge — 2026-07-28

Fourteen `build-015/*` worker branches plus three `idea-012/*` branches, integrated through
PR #73 (merged `352aee7`) and PR #82 (merged at reviewed head `981a054`, squash `443cad4`).
**Forty-two entries.**

### D-2026-07-28-01 — TQA-PR73-001: `loadRegulars` queried `household_id IS NULL` against a NOT NULL column

- **Found:** 2026-07-28, by independent Codex QA at head `09bc203`. **SINGLE-SOURCE** (full text lives in `~/.codex/sessions`, not in this repo).
- **Symptom:** the loader returned **zero rows, silently** — a planner that resolves nothing while appearing to work.
- **Severity:** **HIGH** (Codex's grade).
- **Root cause:** `asdair.regulars.household_id` is `NOT NULL`, but the loader queried `IS NULL` for an unnamed run. Unlike `products` and `budget_settings`, **there is no global regular**.
- **Why controls missed it — the important part:** *"A genuine integration defect that existed only at the seam between two workers: one wrote the migration from the live table's real shape, the other wrote the loader assuming a convention that does not hold for this table. **Neither could see it alone.**"* Both workers' own suites were green.
- **Durable fix:** the loader now throws with an explanatory message; two regression guards added. Resolved by head `fab2cee`.
- **Status:** FIXED.
- **Generalised?** **PARTIALLY, AND THAT IS THE FINDING.** The identical silent-null class exists on the budget side and is **unguarded** — see D-2026-07-28-08. Larry's own insight: *"Integration is its own step. Merging two independently green branches produced a failure neither had."*

### D-2026-07-28-02 — TQA-PR73-002: the promotion guard proves citation, not content

- **Found:** 2026-07-28, Codex at head `fab2cee`. **SINGLE-SOURCE.**
- **Symptom:** an actionable promotion inherits the persisted decision's `source_document_id` and requires an authorised document type — but the system **does not** prove the promoted instruction text literally occurs in the cited document.
- **Severity:** **HIGH** (Codex). `ACCEPTANCE-AND-EVIDENCE.md` records **"Codex is correct"** — accepted, not rebutted.
- **Root cause:** `asdair.source_documents` stores a title and a pointer, not document text. Content verification would need a genuinely new capability.
- **Status:** **ACCEPTED-RESIDUAL** by Warwick's ruling, 2026-07-28.
- **Named trigger that voids the acceptance:** *"This accepted bound does not automatically survive if hard-rule promotion is ever opened to untrusted or external inputs, to materially more autonomous sources, or to higher-consequence domains."*
- **Standing instruction:** *"Do not describe this guard as 'content-proven explicitness' or any equivalent."*

### D-2026-07-28-03 — TQA-PR73-004: a dangling FK refused a decision instead of downgrading it

- **Found:** 2026-07-28, Codex at head `8729c241`. **SINGLE-SOURCE.**
- **Symptom:** the provenance null was applied to the log but **not to the rule**, so an unresolvable citation rolled the transaction back and *refused* a decision rather than downgrading it to `info`.
- **Severity:** **HIGH** (Codex). Merge-blocking.
- **Root cause:** introduced **by Larry**, when the rule began carrying its own provenance pointer. Recorded in the source as *"Larry's defect"*.
- **Why controls missed it:** *"Larry-as-sole-reviewer is not sufficient. Codex found a HIGH correctness bug Larry's careful review missed, and later a merge-blocking dangling foreign key Larry had personally introduced."*
- **Status:** FIXED.

### D-2026-07-28-04 — TQA-PR73-005: unmatched items produce an empty alternatives queue

- **Found:** 2026-07-28, by Codex **and independently, by a different route, by a fresh bound Asdair instance in the behavioural acceptance.** That convergence is what the record says makes it credible rather than pedantic.
- **Symptom:** the needs-decision queue ships with `alternatives: []`.
- **Severity:** **HIGH** (Codex).
- **Household impact:** **standing rule 6 has two clauses — never substitute AND surface alternatives. The second was performed by whichever human read the output.**
- **Root cause:** `rankAlternatives` consults `products` (11 rows) only, never `regulars`, and needs a resolvable category that an unmatched free-text line does not have.
- **Why controls missed it:** every test asserted the *first* clause of rule 6 (nothing was substituted). No test asserted the second. **The rule was half-tested and read as fully enforced.**
- **Durable fix:** confirmed fixed by Codex at head `075ffdf`.
- **Status:** FIXED.

### D-2026-07-28-05 — TQA-PR73-006: no runtime path invoked the outcome/learning writers

- **Found:** 2026-07-28, by Codex and independently by the fresh Asdair instance.
- **Symptom:** *"The writers are built, tested and proven end-to-end, but **nothing calls them**, so recording and learning happen only if a human runs them."*
- **Severity:** **HIGH** (Codex). Blocked the READY verdict; **PR #73 was NOT merged at `8729c241`** on this basis.
- **Household impact:** this is D-2026-07-27-02 arriving through a different door — the write-back existing but never firing.
- **Why controls missed it:** identical to D-2026-07-27-08. **A green module suite cannot detect an absent caller.** This class was found three separate times in this build (`shopperRoute` zero callers, the unscheduled worker, the uncalled writers) — it is the build's most-repeated defect class.
- **The record's own uncomfortable read:** *"In the supervised workflow these steps do happen — because **Larry does them by hand**… That is the same class of gap this build exists to close: it works because a session does it, not because the system does."*
- **Durable fix:** runtime caller wired; confirmed fixed by Codex at `075ffdf`.
- **Status:** FIXED.
- **Remaining risk:** on 2026-08-03 six new regulars were still written by hand. Whether the wired caller ran and was insufficient, or did not run at all, is **NOT RECORDED**. **Open question.**

### D-2026-07-28-06 — TQA-PR73-008: a `map` directive can resolve to prose, and prose reaches `add`

- **Found:** 2026-07-28, by the fresh Asdair behavioural instance first, then raised by Codex.
- **Symptom:** rule 23 maps `sure male` → *"Sure Men Anti-Perspirant Deodorant (blue variant)"* — an **instruction**, not a product. Confirmed to return `status: add, planned_qty: 1`.
- **Severity:** **HIGH** (Codex).
- **Household impact:** a line can be planned as `add` with a name nobody can put in a trolley.
- **Root cause:** *"confidently matched"* is defined as `matched_product !== null`, which a human-readable instruction satisfies.
- **Why controls missed it:** the check tests for **presence of a value**, not for **the value being a product**. There is no type distinction anywhere in the model between "a product name" and "an instruction about products".
- **Status:** **ACCEPTED-RESIDUAL** (Warwick, 2026-07-28) on the grounds that in the supervised workflow Larry reads the plan and drives the browser. **Still OPEN as code** — named in the goal contract's remaining work as *"reject prose as a `map` target"*.
- **Documented forward:** `SOP-021` "Known limitations" — *"Watch for it when driving."*

### D-2026-07-28-07 — TQA-PR73-009: no `loadLastOrder`, so rotation is structurally dead

- **Found:** 2026-07-28, by the fresh Asdair instance, then Codex.
- **Symptom:** SOP-021 §2 makes the last order a **required** planning input. There is no `loadLastOrder` and `planBasket` has **no parameter for it**, so rule 32 (rotate the Sure variant) cannot run.
- **Severity:** **HIGH** (Codex).
- **Root cause:** the rule was documented and implemented against an input that was never plumbed.
- **Why controls missed it:** the record names the class precisely — *"the same 'documented, implemented, dead' class as rule 7"* (D-2026-07-28-35). **A rule with no input path has no test that can fail; it simply never fires.**
- **Status:** **ACCEPTED-RESIDUAL** (Warwick). A `build-015/load-last-order` branch exists (`ec5a843`), so plumbing was at least begun; **whether it reached `main` is NOT ESTABLISHED from the file record.** The branch has no `origin/*` counterpart in `.git/packed-refs`, which is evidence it was never pushed — not proof it was never merged. **CONTRADICTION FLAGGED.**

### D-2026-07-28-08 — the budget-side null-household trap: configuration silently collapses catalogue scope

- **Found:** 2026-07-28, by the fresh Asdair behavioural instance. **Recorded, not fixed.**
- **Symptom:** if a household has no `budget_settings` row, `loadBudget` returns the **global** row with `household_id: null`, `planBasket` derives `household = null`, and **every household-scoped regular falls out of scope — resolving nothing while appearing to work.**
- **Severity:** UNGRADED in the record. **Pax's read: HIGH — opinion, not record.** It is the same silent-null shape Codex graded HIGH at D-01.
- **Household impact:** an entire week's list would resolve to nothing, with no error.
- **Root cause:** a global-fallback convention that is correct for `products` and `budget_settings` and **wrong for household-scoped tables**, applied without distinguishing them.
- **Why controls missed it:** *"This is the exact failure Codex caught in `loadRegulars` (TQA-PR73-001), through a different door, and it is **not** guarded."* **The fix for D-01 closed the instance and left the class open.**
- **Status:** **OPEN.** Named in the goal contract's remaining work (*"guard the budget-side null-household trap"*) and in the 2026-07-28 session log's open threads. **Open for six days.**
- **Generalised?** No — and that is the entry. This is the second of at least three same-class defects; see also D-2026-08-03-06 / D-2026-08-03-13 (bigint-as-string), which likewise had its instance fixed and its class left open.

### D-2026-07-28-09 — no governed writer for `asdair.regulars`, and no role could write it at all

- **Found:** 2026-07-28, confirmed against the live database before the writer was built.
- **Symptom:** *"**no role holds INSERT or UPDATE on `asdair.regulars`** — not `asdair_rw`, not `cp_worker`, not `cp_directus`. Only SELECT exists anywhere."*
- **Severity:** UNGRADED; the behavioural acceptance names it *"the highest-value remaining gap"* and one of three autonomy blockers.
- **Household impact:** the commonest learning of all — *"this list name means that product"*, i.e. a new `aka` alias — **could not persist at all.** *"Without a governed `regulars` writer, next week's instance asks the same six questions. That is precisely the failure this build exists to end."*
- **Root cause:** the grants had never been provisioned; the writer had never been built.
- **Why controls missed it:** no test asserts the grant matrix (the same gap that produced D-2026-08-03-07). Every write test used a fake client, **which grants everything**.
- **Durable fix:** `services/asdair/db/005_asdair_rw_grants.sql` (column-scoped INSERT/UPDATE, **no DELETE**, no UPDATE on `active`/`name`/`household_id`) plus `services/asdair/outcome/updateRegulars.js` — the **only** writer, on a strict column allowlist where *"the SET clause is generated by iterating the allowlist, not filtered against it, so a column that is not on the list has no path into the SQL at all."*
- **Fix branch:** `idea-012/asdair-intake-and-regulars-writers` (`b267385`).
- **Regression test:** `updateRegulars.test.js` bypasses the pure builder and hands the SQL builder a payload stuffed with `active`, `name`, `household_id`, `source`, `created_at` and a made-up column, asserting none reach the statement and none become bound parameters.
- **Status:** FIXED.
- **A second, real design defect caught while building it:** the table's own `UNIQUE (household_id, source, name)` is **not sufficient** — it is exact and source-scoped, so it would accept `"Arla 4pt  Milk"` beside `"arla 4pt milk"`. *"`planner.js` treats two active regulars answering one term as AMBIGUOUS and sends the line to a human — so a duplicate breaks resolution for that item, every week."* Normalised-name adoption was added for exactly that reason.

### D-2026-07-28-10 — alias matching is exact-string; measured resolution was 52%

- **Found:** 2026-07-28, measured over **73 distinct past list terms** from the household's own history: 38 add / 34 needs_decision / 1 excluded.
- **Symptom:** `matchRegular` does **exact normalised-string equality** against `name` and each `aka`, so `"yazoo strawberry"` misses the alias `"strawberry yazoo"` **on word order alone** — proven by running the reversed form, which resolves. Only 28 of 91 regulars carried any alias.
- **Severity:** UNGRADED. The acceptance verdict: *"A lane that hands back half the list every week is a triage queue, not a lane."*
- **Root cause:** the matching algorithm, not the data.
- **Why controls missed it:** unit tests used aliases in the order they were stored. **The defect is invisible to any test that writes the fixture and the query in the same word order.**
- **Partial mitigation, not a fix:** catalogue grounding raised end-to-end resolution to 90% (D-11) — *"Tonight's alias additions raise coverage but not the matching algorithm."*
- **Status:** **OPEN.** Still unfixed on 2026-08-03, where it cost two needless human questions (D-2026-08-03-15). **Open for six days.**

### D-2026-07-28-11 — open-ended vision interpretation produced confidently wrong products, and invented one

- **Found:** 2026-07-28, by measurement against the same photo, same model, same gateway, with grounding as the only variable.
- **Symptom (verbatim from the measurement table):** "Gourmet cat food" → *"gourmet **coffee**"*; "Dreamies cheese" → *"**camomile** cheese"*; "Weetabix Protein" → *"**beefs** protein"*; "Wall's sausage rolls" → *"**waffles** sausage rolls"*; "Arla 4pt" → *"ARLA **1 litre**"*; Milky Way/Mars → *"**pork pie large**"*; and, from **nothing on the page**, an invented *"bottle of fruit shoot"*.
- **Severity:** UNGRADED. **Pax's read: CRITICAL to product correctness — opinion, not record.**
- **Household impact:** wrong products, confidently named, plus an invented line nobody asked for.
- **Root cause: the task was framed wrongly.** Warwick's correction, verbatim: *"The current vision experiment tested the wrong product behaviour… The intended task is not 'read arbitrary handwriting and invent a product name.' It is 'given this household's known products and aliases, identify which of them each handwritten mark most likely refers to.'"*
- **Why controls missed it:** there was no control. The step was evaluated by reading its output, which was *fluent* — and fluent wrong output is the hardest kind to notice.
- **Durable fix:** `services/asdair/interpret/` and the mandatory invariant — *"Never interpret a shopping list without first loading the household's catalogue."* The model is **never asked to name a product**; it returns a candidate id and a raw reading, and canonical names are looked up from our own rows by id. *"A product that does not exist therefore cannot reach a basket, whatever a model claims."*
- **Measured result:** 28 of 31 lines (90%) resolved, against 52%. The three misses were honest.
- **Regression test:** `services/asdair/interpret/catalogueGrounding.test.js`, 13 tests — asserts the catalogue is loaded **before** any model call, that the model is asked for candidate IDs rather than names, and that each known reading maps to its correct live regular id.
- **CI evidence:** a dedicated step in `.github/workflows/asdair-tests.yml`, whose comment states the purpose: *"the guard against silently regressing to open-ended transcription."*
- **Status:** FIXED, with an enforced invariant.
- **Standing caution in the record:** *"Equally: do not claim the model is simply accurate. The catalogue is doing much of the useful work. The product is the combined system."*

### D-2026-07-28-12 — the wrong verdict: "the vision model is unfit for this handwriting"

- **Found:** the verdict was **recorded as a conclusion** before 2026-07-28 and **withdrawn** on 2026-07-28.
- **Symptom:** a confident, wrong diagnosis about a component, based on a test of the wrong method.
- **Severity:** UNGRADED. **This is a defect in the diagnosis, not in the code, and it is recorded deliberately.**
- **Root cause:** the model was tested doing open-ended transcription, which is not the product's method (D-11). *"The measured defect was missing catalogue context."*
- **Why controls missed it:** the experiment produced a real measurement, which made the wrong conclusion feel evidenced. **Nothing checked that the thing being measured was the thing the product does.**
- **Durable fix:** the withdrawal is written into `services/asdair/interpret/README.md` with a standing instruction — *"Do not reintroduce that conclusion without re-running the grounded comparison."*
- **Status:** WITHDRAWN / corrected.
- **Generalised?** Yes, and it is a repeat: the same shape as D-2026-07-28-26 (browser capability generalised from one mechanism's limit). Both are *one mechanism's limit stated as a product limit*.

### D-2026-07-28-13 — the behavioural acceptance ran against a worktree that lacked the contract and the SOP

- **Found:** 2026-07-28, during the acceptance itself.
- **Symptom:** the fresh bound Asdair instance **could not read its own contract or method from the worktree it was bound to.** It passed only because it went looking on another branch and recovered them by inference. *"A stricter instance would have stopped, or improvised a method."*
- **Severity:** **Disqualifying for the stated gate.** Success criterion 1 was corrected from ✅ to ⚠️.
- **Root cause:** *"Larry committed every governance artefact tonight while the main tree sat on `idea-016/idea-engine`, never noticing the branch."* SOP-021 and the specialist contract were committed **only** on that branch, absent from `main` and therefore from the build's ancestry.
- **Why controls missed it:** the acceptance was designed to test the instance, not the tree it was given. **A durability test run against a tree that is not the shipped tree measures nothing about the shipped tree.**
- **Durable fix:** contract and SOP landed in the build ancestry; confirmed by Codex at `075ffdf` — *"lands the specialist contract/SOP in this build ancestry."*
- **Status:** FIXED.
- **Note:** this is a **process defect on Larry's side**, recorded as such in the source. Same shape as the second-order defect at D-2026-08-03-18.

### D-2026-07-28-14 — the machine's own bookkeeping was shown to Warwick as chores he had to do

- **Found:** 2026-07-28, during the pipeline build.
- **Symptom:** the pipeline kept its command / resume / outbox bookkeeping in `asdair.pending_action`, namespaced `cmd:` and `msg:`. That table is what the Cockpit and the Telegram status card surface as **OUTSTANDING ACTIONS** — *"things that must never be forgotten"* — alongside genuine household chores such as *"add Wall's to ASDA Favourites"* (D-2026-07-27-09). **So internal plumbing appeared as things Warwick had to do.**
- **Component:** `asdair.pending_action`; `services/asdair/pipeline/store.js`.
- **Severity:** UNGRADED. Migration 009's header: *"working while quietly wrong."*
- **Root cause:** two different concepts sharing one home.
- **Rejected remedy — recorded because it was rejected on principle:** **filtering it in the UI was explicitly rejected** — *"that hides the symptom and leaves the confusion in the data."*
- **Durable fix:** migration `009_pipeline_command_and_question_render.sql` gives them two homes: `asdair.pipeline_command` (never shown) and `asdair.pending_action` (genuine human actions only). `store.js` reads `pending_action` in exactly one place and **writes it nowhere** — *"there is no code path left that can, and the builders that used to spell a `cmd:`/`msg:` action_type have been deleted rather than left unused."*
- **Fix branch:** `build-015/command-ledger-separation` (`585dc1f`).
- **Regression test:** `invariants.test.js` asserts it over the source; `commandLedger.test.js` runs a whole lifecycle and asserts the table stays empty (`:440` — *"a legacy plumbing row is still claiming to be an outstanding action"*).
- **Backfill path:** `migrate-command-ledger.js` — dry-run by default, `--apply` to carry pre-009 rows over, re-runnable because the legacy key is derived from the source row's id.
- **Status:** FIXED.

### D-2026-07-28-15 — question cards had no durable render contract

- **Found:** 2026-07-28.
- **Symptom:** a Telegram button carries a candidate **index**, not a product id (that is what keeps `callback_data` inside its 64-byte budget). **An index is only meaningful against the exact list that was displayed**, and that list was not recorded.
- **Severity:** UNGRADED. Migration 009: *"working while quietly wrong."*
- **Household impact (the danger, verbatim):** *"button #2 on the card still sitting in Warwick's scrollback now points at a **different product**. Nothing errors. The wrong thing is simply added to the basket, and nobody finds out until it arrives."*
- **Root cause:** a hard Telegram constraint (64 bytes) forced index-based callbacks, and the consequent persistence requirement was not implemented.
- **Why controls missed it:** **there is no error path.** A stale index resolves successfully to the wrong thing. No test can catch a defect whose signature is *a plausible success*, unless the test is written specifically to reorder candidates.
- **Durable fix:** migration 009 adds `rendered_candidates` (jsonb, in display order), `render_fingerprint`, `render_version` and `callback_index` to `asdair.shop_question`. `prepareQuestionCard()` derives the card and the contract from the **same sliced, ordered array**, so they cannot drift.
- **Fix branch:** `build-015/question-button-persistence` (`7f9c39d`).
- **Regression test:** `services/asdair/bot/questionRender.test.js`, `resolveTap.test.js`.
- **Status:** FIXED.

### D-2026-07-28-16 — a stale tap must be refusable, and re-rendering in place would have made it undetectable

- **Found:** 2026-07-28, as the direct consequence of D-15.
- **Symptom / class:** editing a question card's candidates in place *"would leave the old buttons live, addressing the new list, with no signal that anything had changed."*
- **Root cause:** the fingerprint **cannot ride in `callback_data`** — arithmetic, not oversight: the arg budget is 16 bytes and `<questionKey>.<candidateIndex>` already spends all 16 in the worst case.
- **Durable fix:** **the card itself is the render token.** `persistQuestionRender()` **throws** if asked to bind a changed candidate ordering to a `message_id` an earlier version already used. **Re-render = new card. Always.** A tap then falls into exactly one of three buckets — live render (resolve), superseded card (refuse + offer refresh), unknown card (refuse). Three further checks fail closed: the stored contract is re-hashed against its fingerprint; a caller may pin an expected version/fingerprint; **an index past the end of the stored list is treated as staleness, not as a bad tap.** *"Nowhere does `resolveTap` conclude 'probably still the same order'."*
- **What Warwick sees:** a Telegram alert he must dismiss (`show_alert: true`), not a silent toast. **Nothing is written on any refusal.**
- **Status:** FIXED.
- **Related, and NOT fixed:** the acknowledgement that carries that refusal is itself broken in live use — see D-2026-08-03-10.

### D-2026-07-28-17 — migration 009's total unique index would have silently destroyed the CONSUME contract

- **Found:** 2026-07-28, during the ledger separation. **Caught in design rather than in production — recorded because the reasoning is the valuable part.**
- **Symptom (had it shipped):** *"ask for the basket again after a pause"* and *"retry a shop that failed twice"* would both have been **silently refused**.
- **Root cause:** migration 006's index was **partial** — unique on `(household_id, action_type, action_key) WHERE status = 'pending'` — and two behaviours fell out of that shape, **both load-bearing**: a repeat *while outstanding* adopts the existing row (a double-tapped button is a no-op), and a repeat *after consumption* starts genuinely new work. Migration 009's index is **total**. *"Reusing the old key would have kept the first and silently destroyed the second."*
- **Durable fix:** the idempotency key carries a **generation**, derived from durable state — the number of rows in that family already terminal — *"never from a counter or a clock"*. Example: `command:1:requestBasketBuild:SHOP-2026-08-03#0`. While a generation is live every repeat computes the **same** key, so **the UNIQUE index decides the duplicate, not a check-then-insert**.
- **Regression test:** `commandLedger.test.js:156` — *"RE-ISSUE: a CONSUME command asked for again AFTER it was consumed is a genuinely new unit of work"*.
- **Status:** FIXED (never shipped broken).
- **On the enumerated class "a command consumed twice":** the *double-consumption* direction is defended structurally — `runtime.test.js:164` *"a repeated tap is answered honestly rather than acted on twice"*, plus the compare-and-set in `store.recordAnswer` (`and status = 'open'` is load-bearing; a losing tap that chose a different candidate is reported `conflicting: true`, **never acted on**). **No incident of a command actually being consumed twice is recorded anywhere in the sources reached.** If Warwick has one in mind from a session this backfill could not read, it is not in the file record. **NOT FOUND — flagged.**

### D-2026-07-28-18 — commands issued against a finished week would sit pending forever

- **Found:** 2026-07-28.
- **Symptom:** a command issued against a shop that has since reconciled or been cancelled *"can never be consumed — the stage table will not act on a terminal shop — so without this it would sit 'pending' in the machine ledger forever, **holding that generation of the command open**."*
- **Root cause:** no housekeeping path on a terminal shop.
- **Durable fix:** `runPipeline.abandonOutstanding()` retires them **with a reason**, never silently drops them. **LATCH commands are deliberately exempt** — `receiveList`, `confirmInterpretation`, `answerQuestion` are permanent facts about the week, and *"abandoning them would erase the record rather than tidy it."*
- **Status:** FIXED.

### D-2026-07-28-19 — a second failure would have destroyed the resume target

- **Found:** 2026-07-28.
- **Symptom / class:** the resume point is the failure event's `from_status`. A **second** failure while already `FAILED` would record `FAILED → FAILED`, and *"losing that would strand the week."*
- **Durable fix:** `shopStore.recordFailure` re-reads the resume target and records a fresh failure event carrying the **SAME** `from_status`, *"so the resume target survives any number of retries."* The transition guard additionally **refuses** `FAILED → X` without a `resume_from` read from durable state — *"a caller that could name the resume target could smuggle a shop into a stage it never reached."*
- **Fix branch:** `build-015/shop-state-store` (`acd3512`).
- **Regression test:** `runPipeline.test.js:530` *"RESUMABILITY: failing twice does NOT decay the resume target"*; `shopState.test.js:81-103`.
- **Live/proof evidence:** `RUNTIME-PROOF.md` §7 — `{"status":"FAILED","resume_from":"PROCESSING"}`; a restart does **not** auto-retry (`step: "wait:retry"`); the retry resumed to exactly the recorded boundary.
- **Status:** FIXED.

### D-2026-07-28-20 — CI silently covered only two of eleven AsdAIr modules

- **Found:** 2026-07-28, while the Stage 1 modules were being integrated.
- **Symptom, in the workflow's own words:** *"These were NOT in CI when they were built, which is exactly how a green pipeline starts lying: the suites existed and passed locally while CI silently covered only `skill/` and `outcome/`."*
- **Component:** `.github/workflows/asdair-tests.yml`.
- **Severity:** UNGRADED. **Pax's read: HIGH — opinion, not record.** A green CI badge over eight unrun suites is the worst available failure mode.
- **Root cause:** each module is its own npm package with its own suite; the workflow enumerates jobs by hand and was never extended.
- **Why controls missed it:** **the control was the thing that was broken.** CI reported green because everything it ran passed. Nothing measures the coverage of the enumeration itself.
- **Durable fix:** nine additional steps added — intake, shop, bot, transcribe, reconcile, interpret, cockpit-api, pipeline — *"Each is a separate step so a failure names the module that broke rather than 'asdair'."*
- **Status:** FIXED for the modules that existed on 2026-07-28.
- **Remaining risk — OPEN, and found by this backfill:** `services/asdair/browser-runner` (65 offline tests) and `services/asdair/pipeline-runtime` (24 tests + 50 proof checks) are **NOT in this workflow**. Verified by reading the file: neither working-directory appears in any step. **This is the same defect, still live, for the two newest modules.** WO-M (directive §13) owns it, and its acceptance already requires that *"no skipped test may disappear into a green total."*

### D-2026-07-28-21 — the Telegram offset advances before the shop row is written: a list can be lost, silently

- **Found:** 2026-07-28, **reproduced on demand** by the runtime-recovery worker. Not theorised.
- **Symptom:** process A acknowledged update 221, then died before writing the shop: `{"shops_after_restart":0,"still_pending_on_telegram":[],"lost":[221]}` — *"and nothing anywhere records that a list went missing."*
- **Component:** `services/asdair/intake/shopperIntake.js:662` (advances and persists the offset inside its own loop) vs `services/asdair/pipeline/runtime.js:125` (writes the shop afterwards, via `commands.receiveList`).
- **Severity:** the worker's own words — *"This is a real defect… it is the exact failure this work exists to prevent, arriving by a different door."* **Data-loss class, unrecoverable and silent.**
- **Household impact:** Mum's weekly list is permanently gone. Telegram has deleted the message; no failure event, no held offset, no error.
- **Root cause:** the offset `rename()` commits before the downstream `INSERT`. The window is milliseconds — *"but it is precisely the window a reboot, a power cut or a `taskkill` lands in."*
- **Why controls missed it — the sharpest lesson in this ledger:** the receiver's **own comment** claims *"belt and braces: even if the offset file were lost … every message would RESUME its existing week"*, and that is **true — but it defends the duplicate direction only. There is no defence in the loss direction.** A correct-sounding comment about the safe half was read as coverage of both halves.
- **Suggested fix (recorded by the finder, who correctly did not implement it in another owner's folder):** advance the offset only after the downstream durable write has committed — hand `runIntake` a `commit(record)` callback it awaits before `state.write`, or move `state.write` into `pollIntake` after `commands.receiveList` returns. `createOrResumeShop`'s unique indexes already make the resulting redelivery harmless.
- **Regression test AS ORIGINALLY WRITTEN:** the check in `pipeline-runtime/proof/run-proofs.mjs` **asserted the loss**, so *"it will start failing the day the ordering is fixed. That is deliberate."*

#### ⚠️ STATUS CORRECTED 2026-08-03 by Larry — THIS DEFECT IS **FIXED**, and the ledger first recorded it wrongly

**Corrected status: FIXED 2026-07-28.** The WO-E backfill pass recorded this as OPEN and
"open for six days". That was **wrong**, and the correction is recorded here rather than
silently edited away, because *how* it was got wrong is the more useful lesson.

Verified by reading the live source at correction time:

- `services/asdair/pipeline/runtime.js` (the `pollIntake` comment block, "THE
  ACKNOWLEDGEMENT BOUNDARY"): *"receiveList now runs INSIDE onRecord, so the shop is durable
  BEFORE the offset moves. If it throws, the offset is held, the batch stops, and Telegram
  redelivers."*
- `services/asdair/pipeline-runtime/proof/run-proofs.mjs`, section 5b, verbatim:
  > `// FIXED 2026-07-28 (Codex flagged it merge-blocking, and was right). The shop is now`
  > `// persisted INSIDE onRecord, before the offset is acknowledged... This check was`
  > `// inverted from asserting the LOSS to asserting SURVIVAL, which is the whole point of`
  > `// having written it as an assertion in the first place.`
  >
  > `check('NO LOSS: the shop survived the crash because it was persisted BEFORE the ack', ...)`

**Why the backfill got it wrong — the transferable lesson.** Section 5b's *heading* still
reads `FINDING: A CRASH *AFTER* THE ACK LOSES THE LIST SILENTLY`, and its comment block still
describes the defect in the **present tense**, immediately above an assertion that now checks
the exact opposite. A reader who stops at the heading concludes the defect is live. That is a
**real documentation defect in its own right** — see D-2026-08-03-21 — and it cost a false
"unrecoverable data loss is open" alarm in this very ledger.

Compounding it: the WO-E pass had **no Bash tool**, so it could not read `git log`, and
Warwick's directive named commit messages as the primary source. It reasoned from committed
prose alone. That is the known *"preflight the worker's tool grant"* failure recurring — the
order was defective, not the worker.

- **Status:** **FIXED** (2026-07-28, by the ordering change Codex required at merge). NOT in WO-N.
- **Residual:** the stale heading/comment — tracked as D-2026-08-03-21.

### D-2026-07-28-22 — `pg` unresolvable from `services/asdair/shop/`: the runtime could not start at all

- **Found:** 2026-07-28, by `preflight`, before anything was spawned.
- **Symptom (verbatim):** `"check": "the pipeline can resolve the 'pg' driver", "ok": false, "detail": "MODULE_NOT_FOUND from services/asdair/shop/ - install pg for services/asdair"`.
- **Root cause:** `shopStore.js:166` does `require('pg')`, and node resolves upward from `shop/`: `shop/node_modules`, `asdair/node_modules`, `services/node_modules`, `C:\Fusion247PKA\node_modules`. **None of them exist.** `pg` was installed only under `skill/`, `interpret/`, `outcome/` and `reconcile/`, which are not on that path.
- **Why controls missed it:** CI installs per-folder for the folders it runs; **a developer machine does not**, and no test exercises cross-folder module resolution. Installing `pg` for `pipeline-runtime` does **not** fix it — *"node resolves from the caller."*
- **Status recorded 2026-07-28:** OPEN, correctly left for the owning folder. *"The runtime cannot be armed until it is fixed, and preflight will keep refusing until then."*
- **Status now:** **never fixed; recurred on 2026-08-03 in three further folders** — see D-2026-08-03-01. This is the direct ancestor of that defect, recorded a week earlier, in this build's own proof document, and left open.
- **Generalised?** Only as of 2026-08-03, as WO-A — a repo-level install/test that must run from a **clean checkout**.

### D-2026-07-28-23 — the list photo expired off ShopperBot; the historical acceptance could not be run

- **Found:** 2026-07-28T17:14Z and 17:15Z, by two identical probes.
- **Symptom:** `pending_count: 0`. No receiver had ever acknowledged an update (`shopper-intake-state.json` did not exist); no list photo had been downloaded (`shopper-media/` did not exist); no shop in the live database came from a real list.
- **Root cause — recorded with its own uncertainty, correctly:** *"The most likely explanation is Telegram's 24-hour retention… The alternative — that a parallel worker consumed it earlier today through a different code path — **cannot be ruled out from here**, but it would have left a state file or a media file, and neither exists."*
- **Exculpatory evidence, recorded proactively:** the probe passes **no `offset`**, so it cannot confirm or delete anything; it was run twice with identical output to prove that.
- **Household impact:** `ACTIVATION-DEFERRED.md` deferred item 1 — the full real weekly-shop replay was **NOT RUN**. The photo is retained on disk, so the replay remains possible; it needs re-sending to the bot.
- **Status:** ACCEPTED / deferred. Whether the replay was ever run is **NOT RECORDED**.

### D-2026-07-28-24 — the runtime shipped registered-but-disabled and unarmed

- **Found:** 2026-07-28, at merge.
- **Symptom:** `MyPKA-AsdAIr-Runtime` registered **Disabled**; the live poller sits behind a one-off `--arm` gate. Verified at merge: task Disabled, not armed, not running.
- **Root cause: deliberate, and the reasoning is worth keeping.** The branch lived in a temporary git worktree that would be deleted — *"Registering it against the worktree would leave a landmine that fails at the next logon; registering it against the canonical path **enabled** would, before the merge, run the old launcher — which has no arming gate and would start a live poller unattended. Disabled is the only honest end state."*
- **Why the arming gate exists:** *"`getUpdates` is destructive: an unattended poller firing on a machine nobody is watching can eat a list being kept for acceptance, and no amount of later care gets it back."*
- **Status:** **ACCEPTED-DEFERRED by owner.** Whether it has since been enabled and armed is **NOT RECORDED** in the file sources. Given the 2026-08-03 run required manual restarts, treat as unresolved.

### D-2026-07-28-25 — reboot / logon recovery is UNPROVEN

- **Found:** 2026-07-28.
- **What WAS proven:** `Start-ScheduledTask` returned `0x0`, spawned a **detached** child (pid 32352) that outlived its launcher (parent 23404 gone while the child kept logging), the lock named the child with full identity, and a second run returned `0x0` and produced **no second poller**.
- **What was NOT proven — recorded explicitly, and it moved the verdict:** *"**A real reboot has not been performed.** I was told not to reboot the machine, and I did not."* Specifically untested: that the logon **trigger** fires; that `PT30S` is enough delay for networking/DNS at logon; that the credentials files are readable that early in the session; that the runtime tolerates whatever else starts at logon (Directus also starts then).
- **Status:** **OPEN.** *"Larry must do one real reboot with the task enabled and armed before this is trusted."* No record of that reboot exists.
- **Why this entry is a model:** the limit was written **and** it changed the verdict (`ACTIVATION-DEFERRED.md` item 4: NOT PROVEN). That is the correct handling of a recorded limit.

### D-2026-07-28-26 — browser capability was wrongly generalised from an MCP-subagent probe

- **Found:** the wrong conclusion was reached in an earlier session; **corrected 2026-07-28 by decisive experiment**, commit `ab3f231`.
- **Symptom:** the operating record asserted *"the browser step needs Larry"* / *"Asdair directs, Larry clicks"*.
- **Root cause of the error:** *"The earlier probe proved only that **a Claude Code subagent does not inherit host MCP tools**. It did NOT prove that independent browser operation is impossible."* One mechanism's limit was generalised into a product limit.
- **Correcting evidence:** a plain Node process (`cdp.js`, ~30 lines, zero dependencies) opened a tab, navigated to ASDA and read the DOM back — **no Claude Code, no MCP, no extension, no Playwright**. Then a full practice shop: added a Regular by product reference (Cravendale `489747`), search-added a non-Regular, used the real +/− stepper, read the basket back (3 units, £4.50, 2 products), and **restored the trolley to its exact starting state**.
- **Why controls missed it:** a **negative** capability claim is self-reinforcing — being wrong about it only makes you under-use a tool, so nothing ever fails loudly enough to correct you. It took a deliberate re-test to overturn.
- **Durable fix:** `SOP-021` "Known limitations" now carries the superseded line struck through, with its correction and a standing instruction: **"Do not re-test this — it is settled."**
- **Status:** CORRECTED.
- **Remaining risk that materialised:** the correction was **not propagated into Asdair's own specialist contract**, which blocked the live shop six days later — see D-2026-08-03-18.
- **Honest residual, from `EXPERIMENT-RESULT.md`:** *"'runs in a process Claude Code happened to start' is not the same claim as 'runs with Claude Code closed'. The first is proven; the second is expected but untested, and should be tested rather than assumed."* **Still untested as at 2026-08-03** — the closeout record states plainly: *"Not proven: that the runtime completes a shop without an active Claude Code session. Tonight it did not."*

### D-2026-07-28-27 — the injected `questionStore` compare-and-set existed only at the integration seam

- **Found:** 2026-07-28, during integration.
- **Symptom:** the `bot/` folder specifies the Store contract and requires `recordAnswer` to be a compare-and-set (`and status = 'open'`), but **injects it and never constructs it** — no module in that folder opens a database connection, and a test proves it.
- **Root cause:** the correct behaviour was specified in one folder and implemented in another.
- **Why controls missed it — recorded verbatim by Larry:** *"including implementing the injected `questionStore` (a compare-and-set **no unit test in that folder could have caught**)."*
- **Household impact if wrong:** two racing taps both see `open` and both write; the second tap of a fat-fingered pair overwrites a decision already acted on.
- **Status:** FIXED at integration.
- **Generalised?** This is the third instance of the **seam class** in this build (with D-01 and D-2026-07-28-05). The recorded lesson: *"Integration is where the real defects live."*

### D-2026-07-28-28 — the ASDA session was signed out mid-build by a rate limit, blocking live acceptance

- **Found:** 2026-07-28, live, during the runner proofs.
- **Symptom:** a burst of page loads drew a Salesforce `Too Many Requests` response, after which every groceries URL began bouncing to `login.asda.com/shopper/authorise`.
- **Household impact:** the browser half of proofs A–E could not be run against a live trolley. `ACTIVATION-DEFERRED.md` item 2 records the live Telegram → browser → reconciliation acceptance as **NOT RUN**.
- **Refused remedy, and why:** Larry **declined to sign in on Warwick's behalf** — *"entering account credentials and passing a CAPTCHA are hard limits regardless of authorisation."* Warwick offered the out; the test stayed unresolved.
- **Durable capability that came out of it:** re-auth detection fires on the **signed-out header**, not on a redirect. *"ASDA renders the groceries landing page perfectly normally with a `Register / Sign in` header and only bounces to `login.asda.com` when the trolley is touched. Detecting only the redirect would have let the runner start work and hit the auth wall **halfway through building a basket**."* The lease is **released** on re-auth rather than held, because a human is about to use that browser. Rate limiting is treated as *"come back later"* — lease released, request left **queued**, exit `rate_limited`.
- **Status:** the capability is FIXED and **live-validated** (it fired for real). The blocked acceptance is ACCEPTED-DEFERRED.

### D-2026-07-28-29 — `Yazoo Banana` appears in `previously_ordered` two days AFTER the hard-exclude was recorded

- **Found:** 2026-07-28, by the fresh Asdair behavioural instance.
- **Symptom:** a `previously_ordered` row dated 2026-07-20 for an item hard-excluded before that date. *"The planner would have excluded it; **whatever produced that row did not.**"*
- **Root cause: UNKNOWN.** The record does not identify what wrote the row. **That is the point of the entry:** there is evidence of a write path against household data that bypasses the planner's rules, and it was never traced.
- **Severity:** UNGRADED. **Pax's read: this is the only entry in the ledger pointing at an unidentified writer against household data — opinion, not record.**
- **Status:** **OPEN and UNINVESTIGATED.** Recorded 2026-07-28; never revisited.

### D-2026-07-28-30 — rule conflict: rules 23/24 fix the Sure variant, `rule_qa_log` #5 says rotate it

- **Found:** 2026-07-28.
- **Symptom:** two durable records give opposite instructions for the same product.
- **Handling — correct:** *"Real, unresolved, and surfaced by the planner as `fixed_variant_conflict → needs_decision` rather than silently decided."*
- **Status:** **OPEN — Warwick's call, explicitly not Larry's.** Still open in `ACTIVATION-DEFERRED.md` and the goal contract as at 2026-08-03. **Open for six days.**

### D-2026-07-28-31 — `Arla BOB` is an ACTIVE regular while rule 10 forbids BOB, and rule 10 cannot fire

- **Found:** 2026-07-28.
- **Symptom:** regular 69 (`Arla BOB Semi-Skimmed 2L`) is ACTIVE; rule 10 says never buy BOB. **Rule 10 is `info` with no `match_term`, so nothing enforces it.**
- **The latent trap, stated precisely:** *"`milk` resolves correctly today **only because regular 69 happens to carry no alias.** Add `milk` as an alias there and the planner would add a product a standing rule forbids."*
- **Why controls missed it:** the rule model's CHECK constraint forbids a *target-less actionable* directive — so an unenforceable rule is legal precisely because it is marked `info`. **The safety here is in the data, not in the schema.**
- **Status:** **OPEN.** Named in the goal contract's open questions as a Warwick data decision.

### D-2026-07-28-32 — exclude rules carry no reason to the human

- **Found:** 2026-07-28. **`reason` is NULL on 17 of 26 rules.**
- **Household impact:** an excluded line cannot say why it was excluded.
- **Status:** OPEN — recorded, not fixed, never revisited.

### D-2026-07-28-33 — `substitutes_allowed` is `false` on all 91 regulars

- **Found:** 2026-07-28.
- **Symptom:** the flag carries no discriminating information — *"the mechanism works, the data does not exercise it."*
- **Why it matters now:** SOP-021a's human substitution procedure (added 2026-08-03) instructs setting per-item flags **from** `substitutes_allowed`. With every value `false`, that procedure is currently a uniform "all off".
- **Status:** OPEN — recorded, not fixed.

### D-2026-07-28-34 — a stale claim in `skill/README.md`

- **Found:** 2026-07-28.
- **Symptom:** `skill/README.md` (~lines 146–149) claims `regulars` is not in a committed migration. Migration `004` now defines it.
- **Status:** NOT RECORDED as fixed. **Treat as OPEN** — a documentation defect of exactly the class that produced D-2026-07-27-10.

### D-2026-07-28-35 — rule 7 (the £120–150 budget band) is structurally inoperative

- **Found:** recorded at promotion, re-confirmed 2026-07-28.
- **Symptom:** no price column exists on `products` or `regulars`, so `estimated_total` is null and `budget_flag` is permanently `unknown` for any real list.
- **The honest framing in the record:** *"The rule is documented, implemented and dead. Do not claim budget flagging works until a price source exists."* And in `bot/README.md`: the status card renders `unknown` rather than inventing a figure, because *"'0 held' is a lie that would send Warwick to checkout with items missing."*
- **Status:** **OPEN — deferred, needs a price source.** Named in the goal contract's remaining work.
- **Note:** this is the **archetype** of the "documented, implemented, dead" class that also covers D-2026-07-28-07 (rotation).

### D-2026-07-28-36 — most regulars carry no ASDA product ID

- **Found:** at promotion — 70 of 91. **After one shop's harvesting: 56 of 97** (SOP-021, as at 2026-07-28). A further 13 were backfilled on 2026-08-03.
- **Symptom:** those regulars resolve by **name** rather than by ID, at lower confidence.
- **Status:** OPEN, improving through operational learning. Explicitly **not** a merge blocker — Warwick: *"Alias/Regular coverage improving through real shops is operational learning, NOT a merge blocker."*
- **Contradiction flagged:** the goal contract says 70 of 91; SOP-021 says 56 of 97 as at 2026-07-28. Both are recorded here; the second supersedes the first, but the first was never struck.

### D-2026-07-28-37 — the sender-allowlist environment variable name did not match the machine's credentials file

- **Found:** 2026-07-28, while committing the receiver.
- **Symptom:** the module's canonical variable is `SHOPPER_ALLOWED_SENDER_IDS`; **the pre-existing machine credentials file for this bot predates the module and uses `SHOPPER_ALLOWED_USER_IDS`.** A default-deny allowlist reading the wrong variable name finds **nothing**, and the receiver **refuses to run** — there is no allow-all.
- **Severity:** UNGRADED. **Pax's read: MEDIUM — availability, not safety, because it fails closed — opinion, not record.**
- **Root cause:** a naming convention chosen after the credentials file already existed.
- **Durable fix:** `SHOPPER_ALLOWED_USER_IDS` accepted as an explicit alias. The README is careful about what the alias is and is not: *"The canonical name wins if both are set; **the alias is a name, not a relaxation** — default-deny still applies."*
- **Regression test:** `shopperIntake.test.js:438` — *"`SHOPPER_ALLOWED_USER_IDS` is accepted as an alias for the allowlist, and is still default-deny"*; plus `:427`, config fails closed without a token or an allowlist and `describe()` masks the token.
- **Status:** FIXED.
- **Generalised?** No repo-wide configuration-name reconciliation exists. WO-B (directive §8) requires the full `.env.example` + configuration reference table covering every variable and every consuming process — that is the class fix, and it is **not built**.

### D-2026-07-28-38 — `promoteDecision` is deliberately not wired

- **Found:** 2026-07-28.
- **Symptom:** turning an answer into a standing rule is not automatic.
- **Root cause — deliberate:** *"Turning an answer into a standing rule changes every future basket, and the command surface does not yet carry the provenance that decision deserves."*
- **Status:** **OPEN by design.** Recorded so it is not mistaken for an oversight.

### D-2026-07-28-39 — `locate_product` fallback: written, unit-covered, never live-exercised

- **Found:** 2026-07-28, recorded honestly in the runner's own coverage table.
- **Symptom:** *"It is a belt-and-braces path that only runs when the primary URL fails, which it did not do in the experiment."*
- **Why it matters:** a fallback that has never run in production is a fallback with an unmeasured failure mode. It **did** run live on 2026-08-03 and cost 25–30s per item versus ~13s on the happy path — a measurement that existed only because the path was finally exercised.
- **Status:** now live-exercised; performance cost recorded at D-2026-08-03-17.

### D-2026-07-28-40 — `main` observed failing CI on an unrelated Telegram card test

- **Found:** 2026-07-28, recorded as an open thread in the session log.
- **Component:** NOT RECORDED beyond *"an unrelated Telegram card test"*.
- **Status:** **UNRESOLVED in the record.** No later entry closes it. Given D-2026-07-28-20 and the standing lesson that a path-filtered workflow which stops *running* vanishes from the branch view, this warrants a per-workflow check rather than a wall-of-green read.

### D-2026-07-28-41 — the pipeline proofs do not model transaction ROLLBACK, and the Telegram fake's fidelity is a claim

- **Found:** 2026-07-28, recorded by the worker **in its own proof document, against its own result**.
- **Symptom:** proofs 4–8 run the real `runtime.js`, `runPipeline.js`, `stages.js`, `commands.js`, `shopStore.js` and `runIntake` verbatim — but against `pipeline/test/fakePg.js`, which models the five unique indexes that *are* the idempotency and **does not model ROLLBACK**. *"These proofs therefore establish idempotency and resumability, **not atomicity**. Atomicity… is not in evidence here."*
- **Second stand-in:** `proof/fake-telegram-server.mjs` models the destructive ack — *"Its fidelity to the real Bot API is **my claim, not a measurement** — in particular it does not model the 24-hour retention that appears to have eaten the real list."*
- **Status:** ACCEPTED-RESIDUAL, correctly scoped.
- **Why it is in this ledger:** it is the standard the rest of this build should be held to — **the limit was written, and it bounded the claim rather than decorating it.**

### D-2026-07-28-42 — a `product_alternatives` primary key can be mistaken for a `regulars` id

- **Found: date NOT ESTABLISHED.** The regression test and the defensive comments live in `services/asdair/pipeline/` and `services/asdair/cockpit-api/`, both built 2026-07-28, so that is the likely window — **inferred, not established, and flagged as such.**
- **Symptom / class:** `asdair.product_alternatives` rows have their **own** primary key, which is **not** an `asdair.regulars.id`. *"Reading it as one puts an id on screen pointing at a completely different product."* A third population — `planner.rankAlternatives` / `regularCandidates` — **carries no id at all**, so *"treating a field on one of them as a regulars id would be inventing one."*
- **Severity:** UNGRADED. `assembleWorkspace.js` calls it *"the exact class of mistake this whole module exists to prevent."*
- **Durable fix:** every candidate emitted by `planCandidates` **declares its `source`**, and *"when there is no trustworthy id, the field is absent rather than populated with something that merely looks like one."* Only `resolveByCatalogue.resolveAll` may supply a `regular_id`.
- **Regression test:** `runPipeline.test.js:821` — *"CANDIDATE IDS: a `product_alternatives` row's own `id` can never be mistaken for a regulars id"*, asserting *"a product_alternatives primary key was passed off as a regulars id"*; `assembleWorkspace.test.js:239` carries the matching REGRESSION marker.
- **Status:** FIXED.
- **Whether it ever reached a live basket:** **NOT RECORDED.** The regression markers suggest it was caught in build rather than in production, but the sources reached do not say.

---

## C. Additional 2026-08-03 defects found in the record but not in the first twenty

**Four entries.**

### D-2026-08-03-21 — the CDP websocket closes at the end of every runner batch

- **Symptom:** `CDP websocket closed` or `CDP <method> timed out` in the last moments of a batch.
- **Root cause:** `runner.js`'s `finally` block calls `this.session.close()`, and `cdp.connect`'s `ws.onclose` handler rejects every still-pending call. The tab and the browser deliberately stay open.
- **Impact: cosmetic in the normal case** — progress is checkpointed durably either side of every step (`markInFlight` → save → act → `markCompleted` → save).
- **The one case that is NOT cosmetic:** if the socket dies *before* `finishBasketReady`'s `read_basket()`, that throw propagates into the catch and the request is marked `failed`. **The adds still stand; the summary is wrong.** Re-read the trolley by hand and correct the record.
- **Why it is a trap:** the console tail looks like a failure at the exact moment the work has actually completed. *"Verify with `proofkit.cjs show <id>` rather than by trusting the console tail."*
- **Status:** DOCUMENTED (SOP-021a §5.6); no code change.

### D-2026-08-03-22 — a leftover runner control directive is a silent trap

- **Symptom:** a perfectly good runner finishes or releases **instantly, having done nothing**, and the one log line explaining why is easy to miss.
- **Root cause:** `C:\.fusion247\asdair\runner\control.json` holds one of `run | pause | resume | takeover | stop`, and **directives are LEVELS, not edges** — one issued while the runner was down is still obeyed when it comes up. That property is deliberate and proven (RUNNER-PROOF §A). Its cost is that a `stop` left by a previous session persists silently.
- **Detection:** `node runnerctl.cjs show` — no database access, works with everything else broken.
- **Status:** DOCUMENTED (SOP-021a §1.7 — *"Hazard, unstated anywhere else… Check it before every batch."*). **No automated preflight check exists.** Candidate for WO-B.

### D-2026-08-03-23 — unknown whether ASDA re-enables "allow substitutions" after a later add

- **Symptom:** NOT OBSERVED. This is a **recorded unknown**, not a recorded failure.
- **Statement in the record, verbatim:** *"Re-check the global toggle after any add — **NOT VERIFIED** whether ASDA re-enables it when an item is added afterwards. Assume it might until someone checks."*
- **Household impact if true:** a human substitution pass performed before a later add would be silently undone, reproducing D-2026-08-03-20 after it had been fixed by hand.
- **Status:** **OPEN — unverified.** Cheap to settle with one observation; nobody has.

### D-2026-08-03-24 — the cockpit's new AsdAIr routes could not be made live, and the degraded copy is less accurate than what it replaced

- **Found:** 2026-08-03, by Felix, mid live shop.
- **Symptom:** `server.mjs` needs the live cockpit Node process (port 8090, plain `node server.mjs`, no watcher) **restarted** to pick up the two new `/api/asdair/*` routes. Static files apply instantly; server code does not.
- **Attempted remedy and its outcome:** `taskkill /PID … /F` was attempted and **correctly denied by the permission system** as a live-action gate.
- **Household impact, stated honestly by the finder:** until restarted, the new client branch calls `loadAsdairWorkspace()`, gets a 404 against the old server, and shows *"AsdAIr's read service is not answering…"* — **honest-shaped, but less accurate than the previous "not wired yet" copy**, since the read service genuinely is answering.
- **Why controls missed it:** none did. It was caught at read-back and reported before it could mislead — recorded as a **good** outcome of the read-back discipline.
- **Status:** **OPEN pending an authorised restart.** Restarting the cockpit does not touch the AsdAIr pipeline (separate service on 8710) or the live order.

---

## Completeness — restated after WO-E

**Eighty-one entries now: twenty from the live incident of 2026-08-03, and sixty-one
backfilled from the record** — fifteen in section A, forty-two in section B, four in
section C.

### What WO-E did NOT do, and must not be read as having done

1. **Commit messages were never read.** Warwick's directive names them as the primary
   source; the executing grant had no shell. Every SHA above is quoted from a document,
   not read from git. **A pass with `git log` will find entries this one could not.**
2. **PR #73 and #82 descriptions and review threads were never read.** The `TQA-PR73-*`
   findings above come solely from `ACCEPTANCE-AND-EVIDENCE.md`; Codex's full findings
   live in `~/.codex/sessions`, outside this repo.
3. **Nothing was verified against the live database or the live machine.** Every "still
   open" status is *open in the record*, not *observed open in the system*.
4. **Fourteen `build-015/*` worker branches and three `idea-012/*` branches exist**
   (`.git/packed-refs`). Their diffs were not examined. A branch-local defect that never
   reached a document is not here.

### Enumerated classes for which NO evidence was found — itself a finding

- **"a command consumed twice."** The *defence* against it is documented in detail
  (D-2026-07-28-17); **no incident of it actually happening appears anywhere in the
  sources reached.**

### Defects surfaced by this backfill that are still OPEN and were not tracked as such

D-2026-07-27-10 · D-2026-07-27-11 · D-2026-07-27-12 · D-2026-07-27-13 · D-2026-07-28-08 ·
**D-2026-07-28-20** (browser-runner and pipeline-runtime absent from CI —
**VERIFIED by Larry 2026-08-03**: neither working-directory appeared in any step of
`.github/workflows/asdair-tests.yml`. **FIX COMMITTED 2026-08-04** — four steps added
to the `unit` job, `npm ci` + `node --test` for each; `browser-runner` verified locally
at **65/65 pass** before the step was trusted. **NOT YET CLOSED**: a workflow edit is
not a workflow run, and this file is path-filtered, so the fix is proven only when CI
executes it at a real head — see [[unrun-ci-looks-like-green-ci]]. Re-raised as
**D-2026-08-04-07** if the first run does not go green) · D-2026-07-28-29 · D-2026-07-28-32 ·
D-2026-07-28-33 · D-2026-07-28-34 · D-2026-07-28-40 · D-2026-08-03-23.

> **RETRACTED from this list, 2026-08-03: D-2026-07-28-21.** The backfill listed the
> offset-before-persist data-loss defect as still open. **It is not — it was fixed on
> 2026-07-28** and the proof assertion was inverted from asserting loss to asserting
> survival at that time. See the correction block on that entry. The false alarm came from
> reading section 5b's stale heading and present-tense comment instead of the assertion
> beneath them; the stale text is now tracked separately as D-2026-08-03-25 (renumbered
> from D-2026-08-03-21 on 2026-08-04 — the id was in use twice).
>
> Recorded rather than quietly deleted because it is the exact failure mode this ledger
> exists to catch: **a confident status derived from prose that the code had already
> contradicted.** Two of the three highest-severity claims in the backfill were checked
> against source at correction time; this one did not survive the check, the CI one did.

### D-2026-08-03-25 — a proof section's heading and comment contradict its own assertion

> **RENUMBERED 2026-08-04, from D-2026-08-03-21.** The id was in use **twice** — this entry
> and the CDP-websocket entry in section C — so a work order citing "D-2026-08-03-21"
> resolved to whichever one the reader happened to find first. Caught at read-back by the
> WO-ZA builder, not by any control: **nothing in this ledger enforces id uniqueness.** The
> section-C entry keeps the original id; this one moves.

- **Found:** 2026-08-03, while verifying the WO-E backfill's most severe claim.
- **Component:** `services/asdair/pipeline-runtime/proof/run-proofs.mjs`, section 5b.
- **Symptom:** the heading reads `FINDING: A CRASH *AFTER* THE ACK LOSES THE LIST SILENTLY`
  and the comment block describes the data-loss defect in the **present tense**, directly
  above a `check()` that asserts the opposite (`'NO LOSS: the shop survived the crash…'`).
  The inversion is explained in an inner comment, but only *below* the misleading heading.
- **Household impact:** none directly. **Documentation impact: real and demonstrated** — it
  produced a false "unrecoverable list loss is open" entry in this ledger within hours.
- **Root cause:** when the assertion was correctly inverted at fix time, the surrounding
  narrative was not updated with it.
- **Why controls missed it:** no control exists. A passing proof file says nothing about
  whether its prose still describes reality — the same drift class as SOP-021's bulk-add
  method (D-2026-08-03-17) and Asdair's stale contract (D-2026-08-03-18). **Three instances
  of documentation outliving the code it describes, in one build.**
- **Durable fix:** OPEN — rewrite 5b's heading and comment to describe what it now proves,
  retaining the history as a "was, then fixed" note rather than a present-tense finding.
- **Status:** OPEN (low severity, high nuisance value)

**Nothing in this file should be read as a claim that BUILD-015 is durable.**

---

## D-2026-08-04-01 — three duplicate `rules` rows for one match term, all with empty notes

- **Found:** 2026-08-04, when migration 011's own Section 0b ambiguity guard aborted the transaction.
- **Symptom (verbatim):** `AMBIGUOUS MATCH - aborting. Live rule match_term "sure male" is claimed by 3 entries in this migration.`
- **Component:** `asdair.rules` — live rows **id 23** (`map`), **id 32** (`info`), **id 37** (`info`), all `match_term` ≈ "sure male", all `note = NULL`.
- **Severity:** MEDIUM. No wrong basket resulted; the guard prevented the wrong write.
- **Root cause:** duplicate rule rows exist for a single match term. Origin unknown — no record identifies which pass created id 32 and id 37 alongside id 23.
- **Why controls missed it:** nothing constrains `asdair.rules` to one row per `(household_id, match_term)`; the table has no natural key. It only became visible because a migration tried to write to it by term.
- **The guard worked, and that is the finding worth keeping:** `UPDATE ... FROM` would have picked one of the three non-deterministically and told nobody. The guard was written specifically to refuse rather than guess, and on its first real encounter with the condition it did exactly that. **It was not weakened.**
- **Compounding, unresolved decision:** the Sure deodorant rule is contradicted three ways — rules 23/24 map a **fixed** variant, `rule_qa_log` #5 says **rotate**, and the Google Drive decisions log says *"any blue / any white"*, a **family constraint** which is neither. `007_rules_rotate_directive.sql` declined to settle it; migration 011 §4b declines to settle it; this entry declines to settle it. **It is Warwick's decision.**
- **Action taken:** the two Sure entries are deleted from migration 011's run (documented in the file), so every other decision can land while Sure is held rather than silently decided.
- **Status:** OPEN — needs (a) the duplicate rows resolved, (b) Warwick's ruling on fixed-vs-rotate-vs-family.

## D-2026-08-04-02 — migration 011 remains UNAPPLIED; the Drive decisions are still not operational

- **Found:** 2026-08-04.
- **Symptom:** `permission denied for table rules` when applying as `asdair_rw`.
- **Root cause:** correct and deliberate. `005_asdair_rw_grants.sql` grants `select, insert` on `asdair.rules` and **not** `update`, by design; migration 011's sections 1, 2 and 4a are UPDATEs. It needs the admin path, exactly as its own author stated.
- **What was attempted:** the `UPDATE` privilege was granted temporarily via the admin path, the migration run was **blocked by the permission system on both attempts**, no further retries were made, and the privilege was **revoked immediately** — verified `has_table_privilege('asdair_rw','asdair.rules','UPDATE') = false`. The permission model is back exactly as it was.
- **Consequence, stated plainly:** the Nescafe Azera and toothpaste decisions — answered by Warwick on **2026-07-06** — remain operationally absent from Supabase. The 2026-08-03 shop asked him both questions again for this reason (D-2026-08-03-16), and would ask again today.
- **This is the exact failure the 2026-08-04 realignment ruling names:** *"No answer may remain only in … an unapplied local seed file."*
- **Status:** OPEN. Requires an admin-path apply that the current permission gating allows.


## D-2026-08-04-03 — RETRACTION: "the rules carry no decision content" was FALSE, and I said it to Warwick

- **Found:** 2026-08-04, when Warwick pushed back with the actual rule content from memory.
- **What I claimed:** that `asdair.rules` held only skeleton rows — right match terms, no recorded decision — because I queried `note` and found it `NULL` on all 40 rows. I told Warwick "the terms are durable, the decisions are not."
- **The truth:** the decision content lives in **`rule_text`**, which is populated on **39 of 39 active rules**. `note` is a *separate, optional* column. I checked one column, found it empty, and reported a data-loss finding that does not exist.
- **What was actually there the whole time**, verbatim from 2026-07-21:
  - **id 36** — *"OFFER RULE: if a multibuy gives >=50% off the EXTRA item(s), buy up to the offer quantity. e.g. Tropicana Smooth OJ 1=£4.28 vs any-2-for-£5 -> buy 2 (2nd is ~72p)"*
  - **id 37** — *"Sure 'any 2 for £X': round qty UP to an even number to capture every pair; add a FEMALE variant to complete the last pair (Mum 3 male -> add 1 female = 4). Combines with the rotate-variant rule"*
  - **id 32** — *"Sure male: ROTATE the variant each week - pick DIFFERENT from the previous order"*
  - **id 38** — the out-of-stock cause of failed adds, already recorded.
- **`rule_qa_log` is likewise intact** — 5 rows, each with a real question and a real answer, including the Ariel Pods answer (*"best value/wash"*) that I **guessed at during the 2026-08-03 shop** while it sat recorded in the database.

### Consequences of my error, stated plainly

1. **D-2026-08-04-01's "three-way Sure conflict" was largely my own invention.** Rules 32 and 37 are consistent and complete: rotate the male variant weekly, round up to the offer quantity, use a female as the fourth. The "conflict" came from reading stub `note` columns and the Drive doc while ignoring `rule_text`. **Warwick's ruling was never required.** The duplicate-row finding (ids 23/32/37 sharing `match_term`) is still real — but they are complementary rows, not contradictory ones.
2. **Migration 011's premise is weaker than believed.** It back-fills `note` on rows whose `rule_text` already carries the decision. Useful, not urgent — and *not* the reason Azera and toothpaste were re-asked.
3. **The real 2026-08-03 defect is worse than "the decisions weren't recorded".** They WERE recorded. Rule 12 says *"Nescafe means Azera only; add only if on offer"* and rule 25 explicitly flags the generic phrasing. The planner asked anyway. **So the failure is in consumption, not storage** — the interpretation path did not apply rules it had.

### Why this is the most important entry in the ledger

Every wrong call I made tonight has the same shape: **query one instrument, believe it, report it as fact.** The bigint Map lookup, the "illegible line", the offset-loss false alarm, and now this. Warwick's own words earlier tonight — *"everything is based on lies and false assumptions until something breaks"* — describes this mechanism exactly, and this entry is the clearest instance because the correct data was one column away and had been there for two weeks.

- **Status:** RETRACTED. `rule_text` is populated; the rulebook is durable.
- **Real open defect it exposes:** rules exist and are not being consumed by the interpretation path. Tracked as **D-2026-08-04-04**.

## D-2026-08-04-04 — the planner does not apply rules it already holds

- **Severity:** HIGH. This is the live defect behind several of 2026-08-03's questions.
- **Evidence:** rule 12 (`needs_decision`, *"Nescafe means Azera only; add only if on offer"*) and rule 25 (generic-Nescafe trigger) both existed and were active when the 2026-08-03 shop asked Warwick what "bottle Azera coffee" meant. Rule 32/37 existed when the Ariel and Sure questions were raised. `rule_qa_log` #5 already answered Ariel as *"best value/wash"*.
- **Root cause:** UNKNOWN — not yet traced. Candidates: `match_term` matching is exact-string and the photographed wording differed; or `rules` are loaded but not consulted before question generation; or the `info` directive (rules 32/36/37/38 are all `info`) is never actioned by the planner at all. **The last of those would mean every multibuy and rotation rule in the system is inert.**
- **Why controls missed it:** no test asserts "a line covered by an active rule does not become a question."
- **Status:** OPEN. Trace before building anything new — this may be the single highest-value fix in the build, and it is cheap if the cause is the `info` directive being unhandled.

## D-2026-08-04-05 — the proof harness reads and prints real household state, while asserting it does not

- **Found:** 2026-08-04, at WO-ZA read-back, by the builder — **during its own preflight, before it had established the fault**. Disclosed voluntarily, with nothing quoted.
- **Severity:** MEDIUM-HIGH. No leak off the machine; but a committed control's stated boundary is **false**, and has been on every run since it was written.
- **Component:** `services/asdair/pipeline-runtime/proof/run-proofs.mjs`, PROOF 9.
- **Symptom:** the proof overrides `ASDAIR_RUNTIME_STATE_DIR` to a scratch directory, so it *looks* fully sandboxed. It does **not** override `SHOPPER_INTAKE_STATE_FILE`. `collect()` → `readOffset()` → `intakeStateFile()` (`runtime-paths.mjs:41-48`) therefore falls through to the **real household intake state file** under `C:/.fusion247/asdair/` — and prints its contents.
- **The false claim, verbatim from the file's own header:** *"NOTHING IN THIS FILE TOUCHES … ANY CREDENTIALS FILE."*
- **Root cause:** a partial sandbox. One of several path helpers was overridden and the siblings sharing the same fall-through were not. **Overriding one env var made the harness look sandboxed, which is worse than looking unsandboxed** — the visible override is what stops anyone checking the rest.
- **Why controls missed it:** no control exists. Nothing asserts that a proof run resolves no path under `C:/.fusion247/`, and the header comment was taken as the boundary. **A declared private surface with no test is a comment**, and `private_surface: none` on the work order was true of the *code* and false of its *harness* — a distinction no field on the order can express.
- **Related standing lesson:** [[a-control-is-not-evidence-until-made-to-fail]]. This is a new variant of it — not a control that never fired, but a control whose *scope statement* had never been tested.
- **Durable fix:** WO-ZA item 5A — override the variable, **enumerate every other helper with the same fall-through rather than spot-checking**, correct the header to say what it actually touches, and add a check that fails if any proof resolves a path under `C:/.fusion247/`.
- **Status:** OPEN — fix authorised and in progress under WO-ZA. **The harness may not be run again until 5A lands**, since running it is the act that performs the read.

## D-2026-08-04-06 — the same defect id was used twice in this ledger

- **Found:** 2026-08-04, at WO-ZA read-back.
- **Symptom:** `D-2026-08-03-21` identified **two different defects** — the CDP websocket closing at the end of every runner batch (section C), and a proof section's heading contradicting its own assertion. A work order citing the id resolved to whichever the reader found first.
- **Why controls missed it:** nothing enforces id uniqueness in this file. Ids are hand-assigned.
- **Fix applied 2026-08-04:** the second entry renumbered to **D-2026-08-03-25**; the back-reference in the D-2026-07-28-21 retraction block updated. The section-C entry keeps the original id.
- **Residual risk, stated rather than closed:** the renumber fixes *this* collision. **It does not prevent the next one**, and any external document citing `D-2026-08-03-21` for the proof-narrative defect is now silently wrong. Fixing the class needs a uniqueness check in CI; that is not built, and this entry should not be read as though it were.
- **Status:** instance FIXED; **class OPEN**.

## D-2026-08-04-07 — ACCEPTED EXCEPTION: the token-leak proof needs a token-shaped fixture

- **Raised:** 2026-08-04, by the WO-Z1 builder, as the sole reason its verdict was PARTIAL.
- **Symptom:** `secret-scan.sh --surface` over `services/asdair/bot/**` **exits 1**, class `telegram-token-bare`, at `resolveTap.test.js:474` — `const TOKEN = '1234567890:TESTFIXTURE-not-a-real-telegram-token'`.
- **Pre-existing, proven:** the identical hit fires at **line 470 of untouched `HEAD`**; it moved four lines only because an import was added above it. Not introduced by that work order.
- **Why it exists:** the fixture lives inside the test *"NO token can leak into a result, a refusal, an error or the console"*. **Being token-shaped is the point of it.** It deliberately omits the real `AA` prefix to sit outside canonical class 1; the newer content class catches the looser shape.
- **Ruling (Larry, 2026-08-04): NO CHANGE to either the fixture or the scanner.**
  - The scanner **already anticipated this**: the comment above the class states tower-baton's form *"produces 3, all of them deliberate secret-shaped test fixtures"*, and content classes are excluded from default mode precisely because *"a control that red-lights the repo on day one gets switched off — which is a worse outcome than the gap it closes."*
  - An allowlist would weaken the class **repo-wide** to resolve a collision the design already priced in, and any marker it keyed on (`TESTFIXTURE`, `not-a-real`) becomes a **universal bypass string**.
  - De-shaping the fixture would gut a real proof. Editing a test to make a scanner green is the failure this ledger exists to catch.
- **Evidence of record for any surface scan touching `bot/**`:** the file-list form **excluding `resolveTap.test.js`** (exit 0), with the excluded file's hit named, shown identical at untouched `HEAD`, and explained. Coverage stated, never implied by the exit code.
- **This is a HABIT, not a mechanism — recorded as such.** Nothing prevents the next reader from re-litigating it, or from quietly de-shaping the fixture to go green. Making it mechanical would need a per-path fixture baseline, which is new machinery this build has not earned. See [[compensating-habits-decay-silently]] — dated liability, not architecture.
- **Status:** ACCEPTED EXCEPTION. Not a defect to fix; a decision to remember.

## D-2026-08-04-08 — `"shortbread".includes("bread")` — a live wrong-product path in the resolver

- **Found:** 2026-08-04, by the WO-Y/Z2 builder, as an **out-of-scope** finding it fixed anyway rather than leave.
- **Severity: HIGH.** Not a hypothetical: `interpret/resolveByCatalogue.js` pass 3 used **raw substring containment**, so a list line saying *bread* could resolve to a packet of *shortbread* — a confident, silent, wrong product with no flag raised.
- **Household impact:** **real baskets may have been wrong in ways nobody attributed to matching.** The wrongness is invisible at every downstream stage — the line resolves, the packet is valid, reconciliation passes, because every layer agrees on the wrong product.
- **Root cause:** containment used as a proxy for similarity. Every compound word in English defeats it.
- **Why controls missed it:** the alias fixtures happened to carry exact matches that short-circuited earlier passes. **The builder's own first test for this passed under mutation** — it was passing for the wrong reason, because the fixture carried an exact alias `"bread"` that never reached pass 3. It changed the fixture to `"white bread"`, and only then did the test fail without the fix. **A test that cannot fail is not a proof**, and this one could not.
- **Durable fix:** token-wise matching. Refusals now pinned as tests: `bread`/`shortbread`, `cream`/`ice cream`, `milk`/`silk`, `beans`/`beers`, `butter`/`batter`, `lemon`/`melon`, `Sure male`/`Sure female`.
- **Status:** FIXED in the working tree, unproven in the live path until integration.

## D-2026-08-04-09 — provenance written into a uniqueness key: date-stamped `regulars.source`

- **Found:** 2026-08-04, when the WO-Z4 builder flagged its own unverifiable assumption about `regulars.source` and asked for a live check. **The assumption was wrong, and the live data was worse than the assumption.**
- **My defect.** On 2026-08-03 I created six regulars (ids 108-113) by hand with `source = 'learned-2026-08-03'`.
- **Why it matters:** `asdair.regulars.source` means **which ASDA view the product is found in** (Regulars vs Favourites). It is part of `UNIQUE (household_id, source, name)` and it drives the execution packet's `source_view`. A date is **provenance**, not a view.
- **The real exposure — CORRECTED 2026-08-04, and the correction matters more than the original claim.**

  > **What I first wrote, and it was WRONG:** *"learned rows would get `learned-2026-08-04`; because the date is part of the unique key, the same product re-inserts as a SECOND active row."* The WO-Z4 builder pushed back with the code, and the code wins.
  >
  > **`updateRegulars` would NOT have duplicated.** Its dedupe guard — `FIND_REGULAR_BY_NORMALISED_NAME_SQL`, `updateRegulars.js:94-105`, **verified by reading it** — is scoped to `(household_id, NORMALISED name)` and **deliberately not to `source`**, with the reason written on it: *"the same item arriving from a different source is still the same item, and a second row for it would make the planner report the term as AMBIGUOUS every week."* A re-learn under a new stamp would have **adopted** ids 108-113 and changed nothing.
  >
  > **Why this correction is load-bearing:** if the record said "the writer would have duplicated", the next reader would either harden a guard that already handles this, or relax it believing `UNIQUE` alone suffices. **The second re-opens the hole for real.**

  **Where the exposure genuinely was:** the **hand-written INSERT** path, which has only `UNIQUE (household_id, source, name)` behind it — and a varying `source` defeats that constraint completely. **Those six rows were written by hand, so the pattern that created them is exactly the pattern with no guard.** The same hole is open for any writer that is not `updateRegulars`, and for a name variation (`100g` vs `100 g`) that slips normalisation.

- **So migration 014 is still correct, for a better reason than the one first given:** a date in `source` makes the Regulars/Favourites distinction **unrepresentable** (D-2026-08-04-10), which is the real defect. Not because the writer would have duplicated — it would not.
- **Why controls missed it:** no CHECK constraint on `source`, and no test asserts the column is a closed vocabulary. It was free text and was used as such. **The guard that does exist lives in one writer, not in the schema** — which is why a hand-written row bypassed it entirely.
- **Fix applied 2026-08-04** — migration `014`, after verifying **no name collides** with an existing row. `'regular'` chosen over `'favourite'` deliberately: **there is no evidence the ASDA Favourite control was ever clicked for those six**, and claiming otherwise would assert an unverified fact. Reversible; the six ids are named.
- **Verified after:** `select source, count(*) from asdair.regulars group by source` → `regular 103`, single value.
- **Status:** instance FIXED. **Class OPEN** — nothing stops the next free-text value.

## D-2026-08-04-10 — Favourites are not a distinct source view. They are absent entirely.

- **Found:** 2026-08-04, in the same query as D-2026-08-04-09.
- **Evidence:** after migration 014, `asdair.regulars` holds **one** distinct `source` value: `regular` (103 rows). **There is no `'favourite'` row anywhere in the table.**
- **What this closes:** `CANONICAL-WEEKLY-SHOP-PROCESS.md` has carried *"Favourites represented as a distinct source view — **NOT VERIFIED**"* since the realignment. It is now verified, and the answer is **no**. Not unconstrained — absent.
- **Consequence:** `source_view: "favourites"` in the execution packet is a **forward contract with no live data behind it**, not a description of anything that exists. Both the packet producer and the handoff correctly infer nothing from `regulars.source`, so no module is wrong — but any document implying Favourites work today is.
- **Status:** OPEN. Needs a product answer on whether Favourites are a real second view for this household, or whether the distinction should be dropped.

## D-2026-08-04-11 — `rule_qa_log` batch rows cannot be surfaced per-product

- **Found:** 2026-08-04. The WO-Y builder named this as *"the single assumption most likely to be wrong in the live path"* and asked for one query. It was right to.
- **The mechanism works; the data defeats it.** Linking a list line to a prior answer keys on the question text naming the product — and it does. **The problem is the answers.**
- **Row 5 is a BATCH row.** Question names seven products; the answer is a compound: *"Ariel=best value/wash; Sure=rotate variant weekly; Sausage Baps=Rustlers Sausage Muffin; Wall's=4-pack; perfume=So...? Honey Oud; Custard&Jelly=DISCONTINUED/ignore; Fruit Splits=ice lollies…"*. Linking `"Ariel Pods"` correctly, then surfaces **all seven households' answers on one card.**
- **Row 2 is worse — it is a pointer, not an answer:** *"Established the product-specific matching rules now recorded in asdair.rules with scope=product (rules 10-16, 18-22)."* Surfaced as a prior decision, that tells Warwick nothing and reads like a malfunction.
- **Rows 1, 3, 4 are single-topic and behave as designed.**
- **Why controls missed it:** the tests used **constructed** fixtures — realistic in shape, single-topic in content. They proved the mechanism and could not have caught the data. See [[a-green-suite-on-your-machine-is-not-green]]: the fixture, not the machine, was the wrong environment here.
- **Required:** extract the fragment keyed to the matched product; **when it cannot be isolated with confidence, say so on the card** with the raw text rather than dumping seven answers or silently dropping the link — both failure directions visible, neither a guess; and refuse to surface a pointer-answer as a decision.
- **Status:** OPEN, in progress. The five real rows are now the fixtures.

## D-2026-08-04-12 — RETRACTION: the "three-way Sure conflict" does not exist

- **Adjudicated 2026-08-04 from the live rows**, not from summaries.
- **The claim, carried since `db/007` and repeated through D-2026-08-04-01:** rules 23/24 map Sure to a **fixed** variant while rule 32 says **rotate** — a contradiction requiring Warwick's ruling.
- **The rows say otherwise.** Rule 23 maps `"Sure male"` → *"Sure Men Anti-Perspirant Deodorant **(blue variant)**"*. Rule 32 reads *"Sure male (men's **\"blue\"**): ROTATE the variant each week — pick DIFFERENT from the previous order (Sport Cool / Quantum Dry / Invisible etc.)"*. **Rule 32 opens by agreeing with rule 23.** 23 picks the family; 32 picks which scent this week; 37 rounds the quantity and completes the pair. Three rules, three levels, complementary. `rule_qa_log` #5 independently states *"Sure=rotate variant weekly (different each time)"*.
- **What it would have cost:** the WO-Y builder correctly honoured the committed `db/007` record and built a `fixed_variant_conflict` detector → `needs_decision`. Shipped as-is, **Sure would have become a question every single week** — the exact failure the work order existed to end, reintroduced by its own fix.
- **Root cause of the false conflict:** reading `note` stubs, migration prose and a Drive document instead of `rule_text`. Same mechanism as D-2026-08-04-03.
- **Action taken:** migration `013` applied — rule 32 `info` → `rotate`. Verified live: `23 map / 32 rotate / 37 info`. **The rotation code has been built, tested and unreachable for weeks** because the directive filter discarded every `info` row before matching.
- **Status:** RETRACTED. No Warwick ruling was ever required. The detector is being narrowed to a genuine clash only.

## D-2026-08-04-13 — MY defect: two Work Orders were given the same file

- **Found:** 2026-08-04, by the WO-Y builder, which raised it rather than absorbing it.
- **What I did:** `WO-ZA` grants the runtime workstream `services/asdair/interpret/interpret-list.js` (fail-close only). I separately told the rule-consumption workstream that `interpret/**` was **exclusively** theirs. **Both statements are mine**, issued hours apart, and neither was checked against the other.
- **Severity: MEDIUM, and only because it did not fire.** No byte collided — one agent touched `resolveByCatalogue.js`, the other only `interpret-list.js`. **It cost nothing by luck, not by design**, and disjoint ownership exists precisely so that luck is not load-bearing. Two agents writing one file concurrently in a shared tree is corruption, and preventing it is the orchestrator's job.
- **Why controls missed it:** nothing reconciles a new Work Order's `file_surface` against the surfaces already in flight. Every order was preflighted by its *builder* against reality; **no order was preflighted against its siblings.** See [[preflight-your-own-work-order]] — the order needs more scrutiny than the work, and this is the sibling-collision case that memory does not yet cover.
- **What made it visible:** the builder's scope discipline. It reconciled its written paths directly against its declared surface (`git diff --stat` being unusable with seven concurrent agents), noticed a modified file it had not written, and reported it. **A builder that had absorbed the diff would have hidden it.**
- **Also surfaced by the same report:** non-ASCII box-drawing characters (`─`) introduced into a previously pure-ASCII directory by the other agent. Reported, not fixed by the finder — correctly.
- **Status:** instance closed (no collision occurred). **Class OPEN** — with seven parallel surfaces there is still no cross-order check, and this will recur the moment two orders touch one file for real.
