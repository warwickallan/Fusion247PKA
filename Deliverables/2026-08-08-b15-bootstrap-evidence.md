# BUILD-015 operational bootstrap — evidence of record (2026-08-08, by execution)

**Produced by Larry during the Warwick-commissioned bootstrap ("Asdair Build 001", 2026-08-08 —
continue-in-session, do not rotate). Every claim here was established by execution tonight; probes
are named. This file is Pax's staged evidence for the Step-2 bounded investigation — Pax has no
Bash and no database access, so the live facts he needs are recorded here with their provenance.**

## 1. Canonical estate shape (probes: git rev-parse / branch -a / worktree list / stash list / gh pr list)

- `main` = `origin/main` = `959a64b` at bootstrap; clean tree; zero stashes; zero open PRs.
- **One active BUILD-015 working branch:** `build-015/grounded-recognition` (worktree
  `C:/Fusion247PKA-b15`), cut from verified canonical `main`, pushed.
- `origin/build-020/4e-build-015-prep`: merged, explicitly decommissioned, deletion guard-denied —
  reference-only, harmless.
- Active Wayfinder: `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` (§10 LIVE).

## 2. Runtime convergence — PERFORMED tonight (probes: Stop-Process / Start-ScheduledTask / Win32_Process / netstat)

| Process | Before | After |
|---|---|---|
| `pipeline/runtime.js --watch` | PID 40920, running since **2026-08-03 21:31** — pre-fix bytes | **RESTARTED via the canonical scheduled-task launcher** (`MyPKA-AsdAIr-Runtime` → `ensure-asdair-runtime.mjs`): PID 13756, started 2026-08-08 21:50:55, absolute canonical entrypoint `C:\Fusion247PKA\services\asdair\pipeline\runtime.js` at source `959a64b`. Arm state persisted (no re-arm needed) |
| cockpit-api (`server.js`, port 8710) | PID 31216, since 2026-08-04 02:37 — pre-fix bytes | **RESTARTED detached**: PID 14376, started 2026-08-08 21:55:11, WorkingDirectory `C:\Fusion247PKA\services\asdair\cockpit-api`, same env-file pair; port 8710 LISTENING, HTTP answers (404 on `/`, expected for the API root). **Known liability, recorded once: cockpit-api has no launcher/task — start is manual** (`README`: "Started by `node server.js` and nothing else") |
| Cockpit web (`server.mjs`, port 8090) | restarted earlier today (12:48) | unchanged; its source untouched by recent merges |

**The stale-bytes condition is CLEARED: both AsdAIr processes now execute canonical current source
(`959a64b`), which includes all seven 2026-08-04 workstream fixes for the first time in a live
process.** First live event to watch for: the runtime poller resuming/handling shop state with
question-card code actually loaded.

## 3. CI truth (probes: gh run list / gh run view --log-failed / test source read)

- `asdair-tests.yml`: `unit` job PASSES; **`integration` job has NEVER passed in the workflow's
  recorded history** (all 12 recorded runs failed, 2026-08-05 → 2026-08-08). **Inherited baseline
  breakage — nothing from the 4E/bootstrap work.**
- Exact failure: `services/asdair/skill/test/integration.dbtest.js:266` — the clean-Postgres full
  path (`schema → seed → data.js → planner.js`) expects seeded item `widget b` (household-scoped
  term match to `HH Widget B`) to plan `add`; the planner returns **`needs_decision`**. Unit
  fixtures pass the same class of case, so the divergence lives in the **real `data.js` adapter ↔
  planner contract** (household-scope/term-match shape), not in the unit-tested planner logic
  alone. Root-cause and fix belong to routed work, not bootstrap; do not weaken the assertion —
  the test encodes the CORRECT post-defect-C behaviour.

## 4. Live database truth (probes: read-only SELECTs via `ASDAIR_DB_URL`, `asdair_ro`, from `services/asdair/pipeline`; no mutation)

- **26 tables live in schema `asdair`; repo migrations 001–012 define 23. Live-only tables (the
  migration debt, now named): `command_request`, `previously_ordered`, `skill_steps`.** The
  "applied live but absent from repo" condition IS still true, in exactly those objects (plus any
  column-level drift not enumerated tonight). **No packet table exists — migration 015 was never
  applied**, consistent with the packet chain having no production caller.
- **Rules (40 rows by directive: exclude 3 · info 24 · map 10 · needs_decision 2 · rotate 1):**
  - Rule 32 (Sure male rotation) is now a **structured `rotate` directive WITH `match_term`** —
    changed since Pax's 2026-08-04 audit called it inert `info`.
  - Rules 36/37/38 remain `info` (multibuy/offer/out-of-stock guidance — structurally inert if the
    planner ignores `info`).
  - **Rule 10 (never Best-of-Both) remains `info` with NO `match_term` — structurally unenforced —
    while regular 69 `"Arla BOB Semi-Skimmed Milk 2L That Tastes Like Whole"` is ACTIVE.** The
    fog-2 contradiction is CONFIRMED LIVE and is a genuine product question (the regular's name
    suggests the household deliberately buys BOB; the rule says never) — for the WP, not silently
    resolved.
- **Regulars: 103 total, 103 active, `source` values = `{regular}` only.** Fog 5 RESOLVED by
  execution: Favourites is not a distinct live source; `source_view: "favourites"` still describes
  nothing live. Catalogue columns available: `name`, `brand`, `aka`, `asda_product_id`, `asda_url`,
  `typical_qty`, `category`, `high_level_category`, `substitutes_allowed`.
- **Answer history exists: `shop_question` 11 rows · `rule_qa_log` 5 rows.**

## 5. The real journey evidence — shop 6 (read-only; the single most important input to Step 2)

`asdair.shop` holds **3 rows** (ids 1, 2 from 2026-07-28 in `WAITING_FOR_BROWSER`; id 6 from
2026-08-03). Shop 6's event trail (2026-08-03): FAILED on `permission denied` (households, then
shopping_lists) → resumed → **TRANSCRIBING → PROCESSING: "interpreted 35 line(s) against a
catalogue of 97 known products"** → **NEEDS_DECISION: "11 line(s) need a human decision"** →
answers → **"every question is answered - re-planning with the answers in place" → PROCESSING at
20:10:40 — and NOT ONE EVENT SINCE.** ~~Five days stuck at the exact seam where the
execution-packet chain has no production caller (breaks 3–5).~~ **CORRECTED SAME DAY by Pax's
Step-2 investigation and re-verified live by Larry: the stall is the interpretation-confirmation
gate — shop 6 is `needs_review = true` and `pipeline_command` holds ZERO confirm commands ever;
no production surface can issue `confirmInterpretation`. The packet seam (breaks 3–5) is
downstream of a state shop 6 never reached.** See
[[Deliverables/2026-08-08-pax-b15-grounded-vision-investigation]] and the proposed WP.

**Precision on an earlier map claim:** the 2026-08-04 map's "no row has ever been written to
Postgres by this journey" was about the TEST journey (all destructive Postgres tests skipped); the
LIVE journey has real rows — written during the manually-rescued 2026-08-03 run. Both halves are
true; the sentence needed its scope stated.

**No shop_event rows have appeared since tonight's 21:50/21:55 restarts** — the alignment changed
no live shopping state (verified 22:0x).

## 6. Declared limits

- DB probing was SELECT-only through `asdair_ro`; column-level live-vs-repo drift beyond the three
  named tables was not enumerated.
- `previously_ordered` (live-only table) content not yet examined — likely relevant to Pax's
  "previous-order items absent from the recognition set" question; **Pax should request any needed
  row-level facts via Larry** (Pax has no DB access).
- The stuck shop 6 was NOT nudged, resumed or mutated tonight.
