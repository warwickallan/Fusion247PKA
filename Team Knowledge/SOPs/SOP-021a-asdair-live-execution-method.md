# SOP-021a: the Node/CDP browser runner — mechanical reference

> # ⚠️ WHO SHOPS IS NOT DECIDED HERE. AsdAIr decides, and it drives.
>
> **RE-CUT 2026-08-17, Warwick's product ruling.** Canonical, and **not restated in this file**:
> `Builds/BUILD-015-asdair-durable-household-shopping-steward/BUILD-015-goal-contract.md` — the product contract
> and North Star, re-cut whole on 2026-08-17, with the supersession register (**S-5, S-7, S-8**).
> Asdair's own method and boundaries: `Team/Asdair - Household Shopping Steward/AGENTS.md`.
> Intent, policy and the proven Brand A–Z traversal: [[SOP-021-run-the-weekly-asdair-shop]].
>
> **What this file IS:** the accurate mechanical reference for the Node/CDP runner at
> `services/asdair/browser-runner/` — **an AUTHORISED executor** AsdAIr may choose to drive underneath its own
> judgement. Warwick confirmed on 2026-08-17 that the runner's exclusion had been an **internal architecture
> decision, not his**, and **lifted it**. This file is therefore operational reference, not archival.
>
> **What this file is NOT:** the decision about who writes the basket, and not a claim that CDP is the required
> mechanism. **The goal contract makes CDP `OPTIONAL, and AUTHORISED`** — AsdAIr chooses, bound by the two
> structural rules quoted at the head of [[SOP-021-run-the-weekly-asdair-shop]]: a deterministic executor may
> perform mechanical browser actions **underneath** an AI and must never be the semantic decision-maker.
>
> **⛔ SUPERSEDED — struck here where it stood, not annotated beneath a correction.** This banner previously
> stated, as standing law, under the heading ~~*"THIS IS NOT THE LIVE SHOPPING METHOD"*~~:
>
> ~~*"The Stage 1 live basket writer is Sonnet in Claude for Chrome. Not Larry. Not a Claude Code subagent. Not
> this runner. The runner is experimental, deferred, not the live default, not a blocker to Stage 1, and
> prohibited from further live-account testing without fresh authority from Warwick."*~~
>
> ~~*"Sections that describe DRIVING THE BROWSER (§3, §5.6, §5.8, §5.9, §5.10, §7.6, §8, and the browser-build
> block of the §9 checklist) describe the deferred adapter and must not be executed against the live ASDA
> account."*~~
>
> Both were ruled on 2026-08-04 (`BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`) and are **SUPERSEDED 2026-08-17** by
> goal contract **S-7** and **S-8**. **Neither is current.** `RUNTIME-DECISION.md` is a historical record of the
> 2026-08-04 ruling and is no longer an authority on who shops.
>
> **The boundaries that did NOT change, and are absolute under every mechanism:** never book a slot, never check
> out, never pay, never enter the ASDA password, never auto-substitute. This runner additionally enforces them
> **in code** (§4) — which is a reason to prefer it, not a reason to defer it.
>
> **None of the mechanical knowledge below was ever withdrawn** — the environment-variable checklist, the
> per-folder `pg` resolution trap, the full-table grant preflight, the single-poller invariant, the pipeline
> stage table, the durable-state diagnostics, and every failure mode from the live run of 2026-08-03.

- **Status:** **ACTIVE MECHANICAL REFERENCE for an AUTHORISED executor**, as at 2026-08-17. ~~*"DEFERRED / EXPERIMENTAL REFERENCE as at 2026-08-04"*~~ — superseded when Warwick lifted the CDP exclusion (goal contract S-8). *(Created 2026-08-03 as "Active", after a ~6-hour live run of `SHOP-2026-08-03` that hit ~10 distinct defects.)*
- **Companion to [[SOP-021-run-the-weekly-asdair-shop]], NOT a replacement.** SOP-021 owns the **intent and policy** — what a shop is for, the function/state split, the catalogue-grounding invariant, the learning arcs, the standing rules and the proven Brand A–Z traversal. **This file owns the mechanical reality of the Node/CDP executor** — every precondition, every command, every durable table, every failure mode and its fix. Where the two disagree on the *code*, the resolution is recorded in §8 below and the code won. **On who drives the browser, neither file decides: `BUILD-015-goal-contract.md` does, and AsdAIr drives.** ~~*"Where they disagree on who drives the browser, SOP-021 and `RUNTIME-DECISION.md` win"*~~ — superseded 2026-08-17; `RUNTIME-DECISION.md` is history.
- **Default owner:** AsdAIr (Household Shopping Steward). Larry orchestrates setup and defect repair only.
- **Why this file exists:** on 2026-08-03 the operating knowledge for a live shop lived in one Claude session's context. It cost roughly six hours and about ten distinct defects to rediscover, and none of it was written down. Warwick: *"get everything out your context and durable."* That reason is unchanged by the realignment — the knowledge below is exactly the kind that must not go back into a session's head.

---

## The reading rule for this document

> **The code is the source of truth. The prose drifted.** Every claim below was read out of the committed source on 2026-08-03 and carries its file and, where it matters, its line. Where a doc and the code disagreed, the code won and the disagreement is stated. Where something is genuinely untested, it says **NOT VERIFIED** rather than guessing.

**Standing rule (Warwick, 2026-08-03):** AsdAIr's weekly operation must be completely independent of any Claude Code / Larry session. Any model call the product needs is made by the product's own code, through `FUSION_GATEWAY_URL`, to a real OpenAI-compatible API — never by an interactive AI session standing in for it. **If a fresh instance finds itself "driving" a step of a live weekly shop by hand, that is the defect, not a normal state.** The one exception the code itself still forces is the browser plan (§7.6).

> **RE-CUT 2026-08-17, Warwick's product ruling.** The standing rule stands and is unchanged: no Claude Code / Larry session drives a live shop. **Warwick has now settled the question the 2026-08-04 note left open: unattended, autonomous operation of the live browser is IN SCOPE AND REQUIRED** (goal contract **S-2**, **S-3**, **S-4**). A mechanism that cannot be invoked by the system is **disqualified from the runtime** (**S-9**), which is precisely why a route needing a human-started browser session is no longer acceptable as the normal path. ~~*"CLARIFIED 2026-08-04 … The ruled live writer, Sonnet in Claude for Chrome, is a supervised browser session, not a headless runtime — so the basket-building step needs a Sonnet session, just never Larry's. Whether that meets the intent of 'fully automated' is Warwick's call, not a builder's, and is not asserted either way."*~~ — **SUPERSEDED**: Warwick has made that call, and the answer is that supervision is not the bar.

---

## 0. The shape of the system — four processes, not one

There is no single "AsdAIr". A live shop is four independent OS processes plus a human, all coordinated through Postgres.

| # | Process | Folder | What it is | Started how |
|---|---|---|---|---|
| 1 | **pipeline-runtime** | `services/asdair/pipeline-runtime/` | Supervisor. Holds the exclusive lock, spawns and guards the pipeline loop, reports health. | `ensure-asdair-runtime.mjs` (or the `MyPKA-AsdAIr-Runtime` logon task) |
| 2 | **pipeline loop** | `services/asdair/pipeline/runtime.js` | The deterministic advancer. Poll intake → route taps → advance every shop by **exactly one step** → drain the outbox. Repeat. | spawned by (1) |
| 3 | **browser runner** — **AUTHORISED executor (2026-08-17). Not the decision-maker.** | `services/asdair/browser-runner/runner.js` | Event-driven, claims **one** `browser_build_request`, executes an explicit allowlisted plan over CDP against a visible Chrome. Stops at basket-ready. ~~*"Prohibited from further live-account testing without fresh authority from Warwick"*~~ — **LIFTED 2026-08-17**, goal contract S-8. It runs **underneath** AsdAIr's judgement, never in place of it. | `node --env-file=… runner.js --request <id>` |
| 4 | **cockpit-api** | `services/asdair/cockpit-api/server.js` | Read-only HTTP view for the Directus cockpit, incl. the retained list photo. | its own service |
| — | **Chrome** | `C:\.fusion247\asdair\chrome-profile` | A *dedicated, visible, persistent* profile with `--remote-debugging-port=9222`. Holds the ASDA login. | launched by hand |
| — | **Warwick** | — | Sign-in, checkout, payment, slot booking, substitution toggles. | irreplaceable |

**Each has its own `package.json` and its own `node_modules`.** That is the root of failure mode §5.1. **Each takes its credentials only via `node --env-file=`;** no file in any of these folders opens, parses, prints or inspects a credentials file — they know env var *names* only.

---

## 1. Preflight — every precondition, and how to VERIFY it

**Rule: verify, never assume.** Every row below has a check you can execute. `--preflight` covers only some of them; the gaps are marked, and they are exactly what cost hours on 2026-08-03.

### 1.1 Environment variables — the full durable checklist

The SSOT for this table is `services/asdair/pipeline-runtime/README.md` §"Required configuration". Reproduced here because a live run needs one page, with the extra vars the other processes consume.

| Var | Consumed by | `--preflight` checks it? | What breaks without it |
|---|---|---|---|
| `SHOPPER_BOT_TOKEN` | intake, bot sender | **yes** | No Telegram intake at all |
| `ASDAIR_DB_URL` (role `asdair_ro`) | pipeline reads, skill/data.js, runner reads, cockpit-api | **yes** | No planning reads |
| `ASDAIR_WRITE_DB_URL` (role `asdair_rw`) | pipeline writes, runner writes | **yes** | No durable writes |
| `SHOPPER_ALLOWED_SENDER_IDS` (or `…USER_IDS`) | intake allowlist | **yes** | Default-deny — nothing is accepted |
| `ASDAIR_MEDIA_ROOT` | **cockpit-api only** (its own env-file pair) | **no** | Cockpit "Details" photo evidence silently disabled; `resolveMediaPath` returns `media_root_not_configured` |
| `FUSION_GATEWAY_URL` | the grounded vision call | **no** | **Every photo list fails at TRANSCRIBING**: `no vision-capable gateway configured` |
| `FUSION_GATEWAY_KEY` | the grounded vision call | **no** | Gateway reachable, every call 401s |
| `FUSION_MODEL_VISION` | the grounded vision call | **no** | Gateway authenticated but rejects the default alias `fusion.vision` with `Invalid model name` — **this gateway has no such alias registered.** Set a real model id from `GET {FUSION_GATEWAY_URL}/models`. Confirmed working 2026-08-03: `gpt-5-mini` |
| `SHOPPER_CHAT_ID` | outbox fallback chat | no | Cards with no shop-bound chat are abandoned ("no chat to send to") |
| `ASDAIR_HOUSEHOLD_ID` | runtime wiring | no | Defaults to `1` |
| `ASDAIR_CDP_ENDPOINT` | runner | no | Defaults to `http://127.0.0.1:9222` |
| `ASDAIR_RUNNER_ID` | runner lease | no | Auto-generated per process. **Only ever pin it for one process at a time** |
| `ASDAIR_RUNNER_STATE_DIR` | runner control channel | no | Defaults to `C:\.fusion247\asdair\runner` |

**Verify:**

```bash
cd services/asdair/pipeline-runtime
ENV='--env-file="C:\.fusion247\.env keys\shopper.env.txt" --env-file=C:\.fusion247\asdair.env'
node $ENV ensure-asdair-runtime.mjs --preflight
```

Then, because `--preflight` does **not** cover the last four gateway/media rows, verify them by hand before the first photo list of the week:

```bash
# proves the gateway is reachable, authenticated, AND that the model id exists
curl -s -H "Authorization: Bearer $FUSION_GATEWAY_KEY" "$FUSION_GATEWAY_URL/models"
```

> **Open follow-on (parked, for Keel, not urgent):** extend `--preflight` to check `ASDAIR_MEDIA_ROOT`, `FUSION_GATEWAY_URL`, `FUSION_GATEWAY_KEY` and `FUSION_MODEL_VISION`, so a missing var is caught before a shop ever reaches TRANSCRIBING rather than discovered live, mid-shop, in front of Warwick. That is precisely how it surfaced on 2026-08-03.

### 1.2 Node dependencies — per folder, not per repo

`pg` is required by `services/asdair/shop/shopStore.js`, `pipeline/deps.js`, `skill/data.js`, `browser-runner/store.cjs` and `cockpit-api/readWorkspace.js`. **Node resolves `require('pg')` by walking *up the directory tree* from the requiring file** — `shop/node_modules`, `asdair/node_modules`, `services/node_modules`, `C:\Fusion247PKA\node_modules` — and consults no `package.json` while doing it. A `pg` entry in `services/asdair/pipeline/package.json` therefore does **nothing** for a file in `services/asdair/shop/`.

**Verify (do this per process folder you are about to run):**

```bash
node -e "require.resolve('pg')" # run with cwd inside the folder, or:
node -e "console.log(require.resolve('pg'))"
```

**Fix:** `npm install --omit=dev` in **that folder**. Hit on 2026-08-03 in `pipeline-runtime`, `cockpit-api` **and** `browser-runner`.

`--preflight` does check one instance of this and refuses to start:

```
"check": "the pipeline can resolve the 'pg' driver",
"ok": false,
"detail": "MODULE_NOT_FOUND from services/asdair/shop/ - install pg for services/asdair"
```

### 1.3 Database grants — both roles, every table

Two roles. `asdair_ro` (`ASDAIR_DB_URL`) is SELECT-only and every read runs inside `BEGIN TRANSACTION READ ONLY`. `asdair_rw` (`ASDAIR_WRITE_DB_URL`) has a deliberately narrow, column-level write path.

Git carries the grants in `db/005_asdair_rw_grants.sql` (regulars/orders/order_events/rule_qa_log/rules), `006`, `008` (shop_line), `009` (pipeline_command) and — **added on 2026-08-03 in response to the live failure** — `db/010_household_and_list_grants.sql` for `households`, `budget_settings`, `shopping_lists`, `shopping_list_items`, `product_alternatives`.

> **The class, stated plainly: a grant that exists only in the live database and nowhere in git is a defect waiting for the next role rebuild.** 010's own header says it: those five tables were never mentioned in 001/005/006/008/009, so "whatever privilege has been getting the service through until now was never committed." The symptom was `permission denied for table households`, repeatedly, mid-shop.

**Verify — run a FULL-TABLE grant preflight for BOTH roles, every time, not just the table that failed:**

```sql
select r.rolname,
       t.table_name,
       has_table_privilege(r.rolname, 'asdair.'||t.table_name, 'SELECT') as sel,
       has_table_privilege(r.rolname, 'asdair.'||t.table_name, 'INSERT') as ins,
       has_table_privilege(r.rolname, 'asdair.'||t.table_name, 'UPDATE') as upd
  from information_schema.tables t
 cross join (values ('asdair_ro'),('asdair_rw')) as r(rolname)
 where t.table_schema = 'asdair'
 order by r.rolname, t.table_name;
```

Expect `asdair_ro` SELECT true on everything. Expect `asdair_rw` SELECT/INSERT on `orders`, `order_events`, `rule_qa_log`, `rules`, `shop_line`, `pipeline_command`, `shopping_lists`, `shopping_list_items`; SELECT-only on `households`, `regulars` (plus its column-level INSERT/UPDATE), `source_documents`. **`asdair_rw` deliberately has NO DELETE anywhere, no UPDATE on `regulars.active`/`.name`/`.household_id`.** That absence is the security boundary — do not "fix" a failure by widening it.

Sequences matter too: an INSERT grant without `usage on sequence` fails at runtime, not at grant time.

### 1.4 The scheduled task and the arming gate

```powershell
powershell -ExecutionPolicy Bypass -File .\install-startup-task.ps1 -Action status
```

The live poller **will not start until armed once**, because `getUpdates` is single-consumer and destructive and an unattended logon task can eat a list that was being kept:

```bash
node ensure-asdair-runtime.mjs --arm      # persists across reboots
node ensure-asdair-runtime.mjs --disarm   # does NOT stop a running runtime; use --stop
```

`--preflight` reports `live runtime is armed` and refuses live mode when it is not.

### 1.5 Exactly one poller — the invariant that cannot be relaxed

Telegram long-polling with an offset **permanently deletes** everything below that offset. There is no lease in the protocol. Two pollers do not share the stream, they race it, and the realistic failure is **the week's shopping list silently consumed and gone, with no error anywhere**.

Enforced by `runtime-lock.mjs`: `O_EXCL` creation, holder bound to **pid + OS creation time + command-line fingerprint**, atomic stale reclaim, kill-confirming stop. The launcher **refuses** rather than "starting anyway just in case."

**Verify:** `node $ENV ensure-asdair-runtime.mjs --status` — liveness comes from the **OS process table**, never from a database heartbeat (a heartbeat is a claim written by a process that may since have died, and believing one is exactly how a second poller starts).

**Check without consuming:** `node $ENV probe-pending-updates.mjs` — `getUpdates` with no offset confirms nothing.

### 1.6 Chrome and the ASDA session

```
chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\.fusion247\asdair\chrome-profile
```

- **Visible, never headless.** `cdp.assertVisibleBrowser()` reads `/json/version` and **throws** if `Browser` or `User-Agent` matches `/headless/i`. A supervised shop Warwick cannot watch is not supervised.
- **Dedicated profile, never Warwick's daily Chrome.** The daily profile would need closing (profile lock) and would put an automated writer inside the browser he uses for everything.
- The ASDA login persists in that profile across machine restarts.

**Verify the endpoint and the browser:**

```bash
curl -s http://127.0.0.1:9222/json/version
curl -s http://127.0.0.1:9222/json/list
```

**Verify the ASDA session is live** — do this *before* queueing a plan, not after a half-built basket:

```bash
cd services/asdair/browser-runner
node --env-file=C:/.fusion247/asdair.env proofkit.cjs snapshot
```

`snapshot` prints the page classification and, if usable, the current trolley. Look for `reauth_required: false` and `signed_in_marker: true`. The session check is deliberately **positive-evidence-based**: ASDA does not always bounce a signed-out shopper to `login.asda.com`; it will render the groceries landing page with a `Register / Sign in` header and only redirect when the trolley is touched. `PAGE_STATE` in `browser.cjs` detects that header up front, which is what stops the runner walking into a redirect halfway through a write.

### 1.7 The runner control file — a leftover directive is a silent trap

`C:\.fusion247\asdair\runner\control.json` holds one of `run | pause | resume | takeover | stop`. **Directives are LEVELS, not edges** — one issued while the runner was down is still obeyed when it comes up.

> **Hazard, unstated anywhere else:** if a previous session left `stop` or `takeover` in that file, the *next* runner will finish or release immediately, having done nothing, and the log line explaining why is easy to miss. **Check it before every batch.**

```bash
node runnerctl.cjs show     # no database access, works with everything else broken
```

---

## 2. The pipeline walk — stage by stage

`services/asdair/pipeline/stages.js` is a **pure function of durable state**: given a snapshot of what Postgres says about one shop, it returns the one next legal step. Nothing is remembered between passes. `runtime.js --once` is therefore also the unit of recovery: run it, and every shop moves on by exactly one legal step from whatever the database says.

**Every acting step ends in a guarded transition** (`AND status = <the status the step was chosen from>`), so two runners racing one shop cannot both advance it — the loser matches zero rows, rolls back, and reports `claimed: false`.

### 2.1 The stage table

| Status | What advances it | What gates it | Goes to | Waiting on |
|---|---|---|---|---|
| `RECEIVED` | `act:transcribe` (photo) / `act:interpret` (text) | **`buildShop` command** — Warwick taps *Build this shop*. Nothing spends a model call before that. | `TRANSCRIBING` / `PROCESSING` | Warwick |
| `TRANSCRIBING` | `act:interpret` | none | `PROCESSING` | — |
| `PROCESSING` | `act:plan` | if `needs_review` and not confirmed → **`confirmInterpretation`** (a LATCH) | `NEEDS_DECISION` / `READY_TO_SHOP` | Warwick |
| `NEEDS_DECISION` | `act:replan` | **zero open questions** | `PROCESSING` | Warwick answering |
| `READY_TO_SHOP` | `act:queue_browser_build` | **`requestBasketBuild`** — Warwick taps *Build ASDA basket* | `WAITING_FOR_BROWSER` | Warwick |
| `WAITING_FOR_BROWSER` | nothing in the pipeline | n/a — **a supervised runner claims it** | `SHOPPING` | the browser runner |
| `SHOPPING` | nothing in the pipeline | n/a | `BASKET_READY` | the browser runner |
| `BASKET_READY` | `act:record_confirmation` | **`submitConfirmation`** — Warwick checks out **himself** and forwards the ASDA email | `ORDER_CONFIRMATION_RECEIVED` | Warwick |
| `ORDER_CONFIRMATION_RECEIVED` | `act:reconcile` | none | `RECONCILED` | — |
| `RECONCILED` / `CANCELLED` | terminal | — | — | — |
| `FAILED` | `act:resume` | **`retryStage`** | the state it failed from | Warwick tapping *Retry* |

Three things outrank the table, in order: **`cancelShop`** (reachable from every live state), **terminal**, **`FAILED`**. Then `pauseBasketBuild`, then outstanding `correctLine` corrections, then the table.

`wait:*` is a **legal park, not an error and not a stall to be worked around.** The whole design point is that AsdAIr waits rather than guesses.

### 2.2 What each acting step actually does

- **`act:interpret`** — loads the catalogue **first** (`assertCatalogueLoaded` throws on a missing or empty one), then reads: text lists go through `shopperRoute` deterministically, photo lists take **one** grounded vision request. Identity then comes from `resolveByCatalogue.resolveAll` against `asdair.regulars` — **the model never names a product.** Persists `asdair.shop_line` rows *before* the list rows, so a crash between the two leaves the interpretation recorded rather than lost. `UNIQUE (shop_id, line_no)` means a re-read updates line 7 and never appends a second copy.
- **`act:plan`** — runs the pure `planBasket` over the durable list plus rules/products/regulars/budget/lastOrder, then opens one `asdair.shop_question` per unresolved line, keyed on the **normalised** line text so re-planning never re-asks a settled question.
- **`act:queue_browser_build`** — calls `shopStore.requestBrowserBuild(shop.id)` and transitions to `WAITING_FOR_BROWSER`. **It does NOT build a plan.** See §3.1 and §7.6.
- **`act:record_confirmation`** — parses the forwarded ASDA email, **recomputes** the plan (there is no plan table; `planBasket` is pure, so recomputation is honest rather than a guess), reconciles, persists. Idempotent on `(shop_id, content_fingerprint)`.
- **`act:reconcile`** — runs the learning arc (alias enrichment via `updateRegulars` `enrichRegular`/`add_aka`, which merges and can never destroy prior learning) and finishes the week. **Learning never fails a shop** — errors are collected and reported, not thrown.

### 2.3 Diagnosing from durable state

Everything below is read-only, safe to run mid-shop.

**Where is the shop, and how did it get there?**

```sql
select id, shop_ref, status, source_kind, needs_review, list_id, last_error, updated_at
  from asdair.shop where shop_ref = 'SHOP-2026-08-03';

select event_type, from_status, to_status, description, occurred_at
  from asdair.shop_event where shop_id = $1 order by id;
```

`shop_event` is the audit trail — `transition | milestone | failure | decision | note`. **A `FAILED` shop's `from_status` on its failure event IS the resume point**, which is why `retryStage` can put it back exactly where it was and failing twice does not decay that target.

**What is the machine waiting for?**

```sql
select id, kind, command, status, attempts, last_error, idempotency_key, created_at
  from asdair.pipeline_command
 where shop_id = $1 and status in ('pending','running') order by id;
```

`kind='command'` is a durable intent (a tap); `kind='outbox'` is a card waiting to be sent. `UNIQUE (idempotency_key)` is what makes a repeated tap or a Telegram redelivery resolve to the *same* row instead of queueing more work.

**What did we read off the page?**

```sql
select line_no, raw_reading, quantity, matched_regular_id, match_basis, status, list_item_id
  from asdair.shop_line where shop_id = $1 order by line_no;
```

Statuses: `matched | needs_confirmation | unmatched_new_item | unreadable | possible_duplicate | excluded`. A CHECK constraint enforces that a `matched` line **must** carry a real `matched_regular_id` — nothing can record a confident match to nothing. `canonical_name` is deliberately **not stored**; it is looked up from `asdair.regulars` by id (see §5.3).

**What is being asked, and was it answered?**

```sql
select question_key, question_text, status, answer_text, answer_source,
       card_chat_id, card_message_id, render_version, callback_index
  from asdair.shop_question where shop_id = $1 order by id;
```

**What did the browser do?**

```sql
select id, status, claimed_by, last_error, requested_at, claimed_at, finished_at,
       progress -> '_lease'            as lease,
       progress -> '_in_flight'        as in_flight,
       jsonb_array_length(coalesce(progress->'_completed_steps','[]')) as done,
       jsonb_array_length(coalesce(progress->'plan','[]'))            as planned,
       progress - '_completed_steps' - 'plan'                          as report
  from asdair.browser_build_request where shop_id = $1 order by id;
```

Or, without SQL: `node --env-file=… proofkit.cjs show <request-id>`, or `node --env-file=… runnerctl.cjs status <id>`.

**What could the browser not finish?**

```sql
select action_type, action_key, payload, status, note, created_at
  from asdair.pending_action where shop_id = $1 and status = 'pending';
```

---

## 3. The browser build step, in mechanical detail — the AUTHORISED Node/CDP executor

> **⚠️ RE-CUT 2026-08-17, Warwick's product ruling.** Everything in §3 describes the Node/CDP runner, which is
> **authorised** (goal contract **S-8**) and may be driven by AsdAIr against the live account. It executes
> mechanics; **it never decides meaning** — the semantic choices belong to AsdAIr, per the goal contract's two
> structural rules. The traversal policy it must follow is [[SOP-021-run-the-weekly-asdair-shop]] §4.
>
> ~~*"⚠️ 2026-08-04 … Everything in §3 describes the experimental, deferred CDP runner. It is not how the live
> weekly basket is built — that is Sonnet in Claude for Chrome … Do not run any of §3 against the live ASDA
> account without fresh authority from Warwick."*~~ — **SUPERSEDED 2026-08-17.**
>
> The runner's engineering — the fenced single-writer lease, idempotent `step_id` replay, and the three-layer
> forbidden-operation enforcement — is genuinely good work, and with the exclusion lifted it is an argument
> **for** this executor rather than a consolation prize.
>
> **Measured cost, from the code rather than assumed, and the reason for the ruling:** ~13 s per item on the happy
> path, ~25–30 s when `locate_product` falls back to reference-search, plus ~1.5 s between steps — **10 to 20
> minutes of pure runner time for a 40-line shop, before any failure.** Warwick's benchmark for the same shop
> through the proven Brand A–Z traversal is about **five minutes**. The 2026-08-03 live run took roughly eight
> hours end to end.

### 3.1 The plan contract

A request carries its plan at `browser_build_request.progress.plan`. **Whoever queues the request decides what is in it; the runner only validates and executes.**

```json
[
  { "step_id": "s1", "command": "add_known_product",    "product_ref": "489747", "origin": "regular",  "name": "Cravendale 2L" },
  { "step_id": "s2", "command": "select_search_result", "term": "mixed herbs", "product_ref": "544334", "origin": "searched" },
  { "step_id": "s3", "command": "set_quantity",         "product_ref": "544334", "qty": 2 }
]
```

- **`step_id` is mandatory and is the durable idempotency key, not a label.** Charset `[A-Za-z0-9_.:-]{1,64}`. Duplicates within one plan are rejected up front.
- `product_ref` must match `^\d{3,12}$` — an ASDA numeric product id and nothing else.
- `term` must match `^[A-Za-z0-9 &'.\-%+]+$`, max 80 chars.
- `qty` is an integer `0..24`. **`0` is legal and means "remove"** — which is why `null`/`''` are rejected *before* `Number()`, since `Number(null)` is `0`.
- `origin` is `regular | searched` and decides whether an add counts toward `regulars_added` or `searched_added`. Reporting only.
- `name` is carried through for reporting, capped at 160 chars, never executed.
- **Validation happens before any step runs**, so a plan naming anything off the allowlist is refused **whole** rather than executed partially.

### 3.2 The closed command allowlist — all 16

`commands.cjs` is the single source of truth. `runner.js` dispatches only through `assertAllowed`.

| Command | Kind | Args |
|---|---|---|
| `open_groceries` | navigate | — |
| `open_trolley` | navigate | — |
| `open_regulars` | navigate | — |
| `locate_product` | navigate | `product_ref` |
| `search` | navigate | `term` |
| **`add_known_product`** | **write** | `product_ref` |
| **`select_search_result`** | **write** | `term`, `product_ref` |
| **`set_quantity`** | **write** | `product_ref`, `qty` |
| **`add_to_favourites`** | **write** | `product_ref` |
| `read_quantity` | read | `product_ref` |
| `report_unavailable` | read | `product_ref` |
| `read_basket_line_count` | read | — |
| `read_estimated_total` | read | — |
| `pause` / `resume` / `stop_at_basket_ready` | control | — |

**Only those four writes can change the trolley.** Absent — *not disabled, absent* — are: checkout, payment, booking or changing a delivery slot, entering a password, changing payment details, **enabling substitutions**, accepting an unapproved substitute.

Three independent gates enforce it (`guards.cjs`):

1. **URL allowlist** — six exact patterns: `asda.com`, `/groceries`, `/groceries/trolley`, `/groceries/product/<…>`, `/groceries/search/<…>`, `/groceries/favourites-lists/regulars`. There is no reachable URL for any forbidden surface.
2. **Click deny-list** — every click is checked against `DENY_TARGET` (which includes `substitut`, `check-out`, `pay`, `password`, `delivery slot`, `accept (this) replacement`) **in the page as well as in Node**, built from the same regex source so the two cannot drift.
3. **No typing, ever** — `assertSafeCdpMethod` refuses any `Input.*` method. A process that cannot synthesise a keystroke cannot fill a credential field or a card field — **and cannot set a quantity by typing**, which is SOP-021's most expensive lesson made structural.

`forbidden.test.cjs` scans the folder's own executable source with comments stripped and fails the suite if any forbidden path appears anywhere other than `guards.cjs`.

### 3.3 What one `add_known_product` actually costs

Read out of `browser.cjs`, not measured:

`locate_product` → `goto(product URL)` = navigate + `Page.loadEventFired` + **6 s settle** → `READ_AVAILABILITY` → `READ_QTY` → click Add → **5 s sleep** → `READ_QTY`. Then `runner.js` sleeps `interStepMs` = **1.5 s** before the next step.

That is **~13 s minimum per item on the happy path.** If the bare `/groceries/product/<id>` URL does not resolve to a product page, `locate_product` falls back to searching *by the reference itself* and following the canonical link — a second and third navigation, each with its own 6 s settle, so **~25-30 s**. A ~20 s/item average across a real basket is consistent with the code. A 40-line shop is therefore **10-20 minutes of pure runner time**, before any human step.

`set_quantity` is worse: one stepper click at a time, **3 s** between clicks, re-reading after each, with a retry read on a stepper that did not move, capped at 40 clicks.

**This is why an unbuilt bulk-add matters (see §8.1).**

### 3.4 Running it

```bash
cd services/asdair/browser-runner
npm install --omit=dev
node --env-file=C:/.fusion247/asdair.env runner.js --request <id> [--plan-file plan.json]
```

| Switch | Meaning |
|---|---|
| `--request <id>` / `--shop <id>` | Claim a specific request (default: the oldest claimable) |
| `--plan-file <path>` | **Seed the plan only when the request carries none** — see §3.5 |
| `--dry-run` | Exercise the full durable path with no browser at all |
| `--lease-ms` / `--heartbeat-ms` | Default 45 000 / 10 000 |
| `--wait-ms` | Wait for another runner's lease to expire instead of refusing |
| `--max-pause-ms` | How long a pause may hold the lease (default 30 min) |

Exit codes: `0` for `basket_ready` / `human_takeover` / `refused` / `cancelled` / `rate_limited`; `1` for `failed`.

### 3.5 THE GOTCHA — a second batch needs a NEW request row

**Found the hard way on 2026-08-03.** `runner.js` `reconstruct()`:

```js
let rawPlan = this.progress.plan;
if ((!Array.isArray(rawPlan) || rawPlan.length === 0) && planFile) {
  rawPlan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  …
}
```

> **`--plan-file` is consulted ONLY when the request's stored plan is missing or empty.** Once a plan is on the row, a second run against the **same** `--request <id>` with a **different** `--plan-file` **silently ignores the new file**, re-loads the old plan, drops every step already in `_completed_steps`, and logs:
>
> ```
> reconstructed: N planned, N already done, 0 remaining
> ```
>
> …then walks straight to basket-ready having added nothing. **No error. No warning. Nothing added.**

Two distinct things are happening at once and both must be understood:

1. The plan file was ignored (the guard above).
2. The idempotency key did its job — the *old* steps were correctly not repeated.

**Which is exactly right, and exactly useless, for a second batch.**

**How a request even becomes re-runnable:** `lease.claim` only matches `status in ('queued','claimed','running')`. A request that reached `finishBasketReady` is `complete` and **cannot** be re-claimed at all — you get `REFUSING TO RUN: no claimable request`. The "N/N/0 remaining" symptom therefore appears when the request was **released** back to `queued` with all steps already complete: after a `takeover`, a re-auth detection, an ASDA rate limit, a `SIGINT`/`SIGTERM`, or a paused-too-long lease release.

**The correct procedure for a second batch:**

1. Confirm the previous request is terminal. `bbr_one_live_per_shop` is a **partial unique index on `shop_id` where `status in ('queued','claimed','running')`** — so a new row cannot be inserted while the old one is live. Cancel or finish it first.
2. **Insert a NEW `asdair.browser_build_request` row** carrying the new plan in `progress`:

```sql
insert into asdair.browser_build_request (shop_id, status, progress)
values ($1::bigint, 'queued', jsonb_build_object('plan', $2::jsonb))
returning id;
```

3. Run `runner.js --request <the new id>`.

**Do NOT reuse the old row by overwriting `progress`.** `proofkit.cjs seed` does exactly that — and it wipes `_completed_steps` along with the plan, which on a real shop means **every already-added item is added again.** `seed` is a *proof harness for synthetic shops*; it also upserts a synthetic `asdair.shop` row. Keep it away from a live week.

**Expected side effect of batch 2+:** the runner owns exactly two shop transitions, `WAITING_FOR_BROWSER → SHOPPING` and `SHOPPING → BASKET_READY`, both guarded on the current status. After batch 1 the shop is already `BASKET_READY`, so both guards match zero rows and the shop status does not move. That is benign — the batch-2 report lives on the batch-2 request row. `markShopShopping` logs `(shop status note skipped: …)` and continues.

### 3.6 Crash, resume and the in-flight window

- A step id is written to `progress._in_flight` **before** the browser action and moves to `_completed_steps` after.
- On restart, `remainingPlan()` drops every completed id.
- A step still in `_in_flight` **is resolved by READING the live quantity, never by clicking again.** Then the remaining plan is **recomputed from the durable record** — skipping that recompute is exactly how a landed click gets repeated.
- `already-in-trolley` (the product page shows a stepper rather than an Add control) is recorded as the **planned outcome**, not a failure. A retried step must converge.

### 3.7 Pause, resume, takeover, stop

```bash
node runnerctl.cjs pause | resume | takeover | stop | show
node --env-file=<env> runnerctl.cjs status [id]
```

| Command | Effect |
|---|---|
| `pause` | Stop issuing browser commands. **Lease kept** and heartbeated; Chrome stays usable. After `--max-pause-ms` (30 min) the lease is released rather than holding the trolley forever. |
| `resume` | Continue from the last durable checkpoint. Completed steps are not repeated. |
| `takeover` | **Release the writing lease.** Request returns to `queued` with progress intact — releasing is not abandoning. |
| `stop` | Stop cleanly at basket-ready, browser left open on the trolley. |
| `show` | Print the current directive. **No database access** — works when everything else is broken. |

Control goes through a local JSON file rather than the database on purpose: these four words must work in exactly the moments the database may not. A request whose database status becomes `cancelled` is also treated as a stop, so the Cockpit and Telegram keep a remote off-switch.

---

## 4. Substitutions — a confirmed, structural gap

**On 2026-08-03 the finished basket had ASDA's "Allow substitutions for all" toggle ON**, which violates standing rule 6 (*never auto-substitute*). SOP-021 §5 says to untick it and set per-item flags from each product's `substitutes_allowed`.

**Finding: `browser-runner` CANNOT do this, and never could. This is by design, in three layers.**

1. **No command exists.** The 16-entry `COMMANDS` allowlist in `commands.cjs` has nothing that touches a substitution control. A step naming one is refused by `assertAllowed` before validation finishes.
2. **The click deny-list refuses it anyway.** `guards.DENY_TARGET` includes the token `substitut`, and the same regex is injected into the page by `clickExpr`. Even a correctly-labelled toggle on the trolley page would come back `{ok:false, reason:'refused-by-deny-list'}`.
3. **The test suite enforces the absence.** `forbidden.test.cjs` scans every executable file in the folder with comments stripped; `substitut` and `replacement` are in `FORBIDDEN_TOKENS`. **Adding this capability would fail the build**, and correctly so — "enabling substitutions" is on the same list as checkout and payment.

**Therefore:**

> **Setting the substitution toggles is a HUMAN step, permanently, unless Warwick makes a deliberate product decision to move `substitutes_allowed` out of the forbidden set.** That is a `product-decision`, not an engineering fix, because it would widen a boundary that currently sits alongside "cannot pay".

> **RE-CUT 2026-08-17 — the trade-off was recorded BACKWARDS and is corrected here.** Substitutions are never automated under any mechanism. **The three layers above are a mechanical guarantee, they belong to this runner, and this runner is AUTHORISED** (goal contract **S-8**). That makes them a **STRENGTH of the CDP route and a reason to prefer it** — not, as the 2026-08-04 note framed it, an unfortunate loss accepted in exchange for speed. A mechanism bound only by instruction and supervision has **no equivalent enforcement**; that is the weaker option, and it is the one that must be justified. ~~*"UNCHANGED AND MORE IMPORTANT UNDER THE LIVE ADAPTER, 2026-08-04 … The three layers above are real, and they are specific to this deferred runner. Sonnet in Claude for Chrome has no equivalent mechanical enforcement … That is a genuine reduction in mechanical guarantee, accepted deliberately in exchange for a process that works at human speed."*~~ — **SUPERSEDED**: it stated a strengthening as a weakness, and it would have misdirected exactly the operator this SOP exists to guide. **A human still sets the substitution toggles, every week, as the last action before hand-back.**

**The human procedure, after the runner reports BASKET_READY** (SOP-021 §5's ordering still governs: reconcile quantities first, substitutions **last**, against the basket that actually exists):

1. Open the trolley in the same visible Chrome window.
2. **Untick "Allow substitutions for all."**
3. For each line, set the per-item flag from that product's `substitutes_allowed`:

```sql
select r.name, r.asda_product_id, r.substitutes_allowed
  from asdair.regulars r
 where r.household_id = $1 and r.active
   and r.asda_product_id is any (…the refs in this basket…)
 order by r.substitutes_allowed, r.name;
```

4. Re-check the global toggle after any add — **NOT VERIFIED** whether ASDA re-enables it when an item is added afterwards. Assume it might until someone checks.

**Do this as the last action before handing back**, and confirm it visually. A basket that is otherwise perfect but substitutes-all is a basket that can arrive wrong.

---

## 5. Known failure modes, and their fixes

All ten below were hit live on 2026-08-03 or are the directly-adjacent defect class.

### 5.1 `Cannot find module 'pg'` in a service's own folder

**Symptom:** the process starts and dies on its first database read; or `--preflight` reports `MODULE_NOT_FOUND from services/asdair/shop/`.
**Cause:** Node resolves `require('pg')` by walking up directories from the requiring file, ignoring `package.json` dependency lists. Each service folder has its own `node_modules` — or does not.
**Fix:** `npm install --omit=dev` **in that folder**. Hit in `pipeline-runtime`, `cockpit-api` and `browser-runner` on one night.
**Prevention:** run the resolve check per folder as part of §1.2 preflight, not just the one folder `--preflight` covers.

### 5.2 `permission denied for table X`

**Symptom:** `permission denied for table households` (also `shopping_lists`), repeatedly, mid-shop.
**Cause:** the grants existed only in the live database and **nowhere in git**. Migrations 001/005/006/008/009 never mention those five tables.
**Fix:** `db/010_household_and_list_grants.sql` restates them so git is the source of truth again.
**Prevention:** run the **full-table grant preflight for BOTH roles** (§1.3) before every live run. Never fix a single table in isolation — inspection has no completion condition; enumeration does.

### 5.3 The bigint-as-string Map key — a defect **class**, not an incident

**Symptom:** every matched line silently lost its canonical name. `canonical_name` came back `null` for lines that *were* matched, and `buildGroundedIntents` then threw its "neither a catalogue match nor a readable raw_reading" error. **This is what actually failed SHOP-2026-08-03.**

**Cause:** `asdair.regulars.id` is `bigint`, and **node-postgres returns a bigint column as a STRING by default** (no `pg.types.setTypeParser` override exists anywhere in this codebase). `loadCatalogue` built `regularsById` keyed by the raw string id; every consumer looked up by `Number(matched_regular_id)`. **A `Map` keyed `"41"` never answers `.get(41)`.**

**Fixed** — `loadCatalogue.js` now keys the Map `Number(r.id)`, with the whole reasoning in a comment, and `loadCatalogue.test.js` exercises the module for real with STRING ids, the way Postgres actually returns them.

**Why it was invisible:** the pipeline test harness **stubs `loadCatalogue` out entirely** with a hand-built, already-numeric catalogue. The offline suite could never have caught it.

> **THE CLASS, and the durable lesson: any `bigint` / `int8` column read through `pg` arrives as a string.** Every `Map` key, `Set` member, `===` comparison, object key or `.includes()` over an id from this database is a latent instance. Coerce at the boundary, once, and say so.

**Residual latent instance, found while writing this SOP — NOT a live failure today.** `pipeline/shopLines.js` `withCanonicalNames` has a fallback branch:

```js
const byId = catalogue.regularsById instanceof Map
  ? catalogue.regularsById
  : new Map((catalogue.regulars || []).map((r) => [r.id, r]));   // <- raw id
…
byId.get(Number(l.matched_regular_id))                            // <- Number()
```

The fallback still keys by the **raw** `r.id`. It is unreachable today because `deps.js` always supplies `regularsById`, but any caller passing a `regulars` array straight from `pg` reproduces the exact 2026-08-03 defect. **Reported for Warwick's decision, not fixed here.**

### 5.4 Vision model misreads

**Symptom:** `"Sudocrem"` read as `"Bioderma"`; `"Stardrops"` read as `"Sundries" / "standard pro"`.
**These are reading errors, not identity errors** — the architecture already prevents the model from *naming* a product: `resolveByCatalogue` decides identity from `asdair.regulars`, so a product that does not exist cannot reach a basket whatever the model claims. What a misread costs is a **failed match**, i.e. an unnecessary question or an unmatched line.

**The correction path, in order:**

1. **Check the actual photo.** `asdair.shop.raw_media_path` is always retained, unconditionally — that is why the receipt card deliberately has no "Keep raw" button. Serve it via cockpit-api `/asdair/media?shop=<id>` (needs `ASDAIR_MEDIA_ROOT`), or open the file.
2. Correct the line — `correctLine` command, or answer the question.
3. **The durable fix is a database write, not a note.** Add the item to `asdair.regulars` (or enrich the existing row) with the aliases that would have caught this reading:

```bash
cd services/asdair/outcome
node update-regulars.js --dry-run …    # ALWAYS dry-run first
```

Two operations and nothing else: `upsertRegular` (safe to re-run; an existing regular with the same normalised name is **adopted**, never duplicated — a duplicate would make the planner treat that term as AMBIGUOUS and break it every week) and `enrichRegular` (`add_aka` **merges**; prior aliases are never lost). It cannot delete, retire, rename or re-home a regular — the grant enforces that independently of the code.

> **Both arcs are mandatory.** Skip the write-back and next week's read degrades against a stale catalogue. Measured 2026-07-28, same photo and same model, grounding the only change: deterministic matching resolved **28/31 lines (90%)** grounded against **52%** ungrounded. The catalogue does much of the work; the product is the combined system.

### 5.5 Exact-string alias matching — defeated by word order and by typos

`resolveByCatalogue.resolveReading` has exactly four passes, in strongest-evidence order:

1. **Exact alias** — `normaliseTerm(alias) === term`.
2. **Exact canonical name.**
3. **Containment** — alias inside the line, or the line inside an alias, alias ≥ 4 chars.
4. **Word overlap** — words of length **> 3** only, requires **≥ 2 shared words** *and* a single clear winner.

There is **no fuzzy matching, no edit distance, no token-set comparison anywhere.** Two consequences, both real costs on 2026-08-03:

- **Word order alone defeats it.** `"yazoo choc"` against stored alias `"choc yazoo"`: pass 1 fails (not identical), pass 3 fails (neither string contains the other), pass 4 fails because a name like `"Yazoo Chocolate Milkshake"` shares only *one* significant word (`yazoo`; `choc` ≠ `chocolate` under exact word comparison) and the threshold is two.
- **A typo defeats it.** `"Glouester"` vs `"Gloucester"`: no exact match, no containment (one is not a substring of the other), and pass 4 needs two significant shared words where the term has one.

**Documented limitation. Order-insensitive (and typo-tolerant) matching remains the real fix; nothing in the repo implements it.** Until then, the mitigation is alias breadth: add the *actually-observed* word order as its own `aka` entry every time one is missed. That is a write, not a note.

**Also watch:** a `map` directive can resolve to **prose** rather than a product (rule 23 maps `sure male` to *"Sure Men Anti-Perspirant Deodorant (blue variant)"* — an instruction, not a product), and the planner treats it as confidently matched.

### 5.6 CDP websocket closing at the end of a runner batch

**Symptom:** `CDP websocket closed` or `CDP <method> timed out` in the last moments of a batch.
**Cause:** `runner.js`'s `finally` block calls `this.session.close()`, and `cdp.connect`'s `ws.onclose` handler rejects every still-pending call with `CDP websocket closed`. **The tab and the browser deliberately stay open.**
**Impact: cosmetic.** Progress is checkpointed durably *either side of every step* (`markInFlight` → save → act → `markCompleted` → save), so work already done is already committed. Verify with `proofkit.cjs show <id>` rather than by trusting the console tail.
**The one case that is not cosmetic:** if the socket dies *before* `finishBasketReady`'s `read_basket()`, that throw propagates into the catch and the request is marked `failed`. The adds still stand; the *summary* is wrong. Re-read the trolley by hand and correct the record.

### 5.7 The pipeline-runtime silently stopping or stalling

**Symptom:** nothing moves. No error anywhere. Warwick keeps waiting for a card that is never coming.

**Detect — do not infer from silence:**

```bash
node --env-file=<env> asdair-status.mjs
```

Compare `activity.last_write_at` to now. That value is the **mtime of the runtime's JSONL event log** and is honestly labelled as exactly that (the runtime's log lines carry no timestamp of their own). With a default `--interval 60`, anything older than a couple of minutes while work is outstanding means it has stopped or wedged. Cross-check `runtime.running` / `pid` / `identity_verified` — liveness comes from the **OS process table**, never from a database heartbeat.

Also check `pending_work` (read from Postgres, read-only) — outstanding work plus a stale `last_write_at` is the definition of a stall.

**Restart:**

```bash
node ensure-asdair-runtime.mjs --stop
node $ENV ensure-asdair-runtime.mjs --preflight
node $ENV ensure-asdair-runtime.mjs
```

Restarting costs at most one pass. Every pass is independent and starts from durable state; a missed interval, a pass that throws, or a reboot costs one pass, never a shop.

> **A stalled shop is worse than a failed one**, because a failure queues a card and a stall queues nothing. `runPipeline` already self-heals the two silent-gap cards (`receipt` at `RECEIVED`, `progress` at `TRANSCRIBING`) on the very next pass — but only once the process is running the code that emits them.

### 5.8 A leftover control directive

See §1.7. `node runnerctl.cjs show` before every batch. A stale `stop` makes a perfectly good runner finish instantly having done nothing.

### 5.9 The runner refuses to start

```
REFUSING TO RUN: no claimable request (another runner holds a live lease, or nothing is queued)
```

Three causes, distinguishable by `proofkit.cjs show`:

- The request is **terminal** (`complete`/`failed`/`cancelled`) — `claim` only matches `queued|claimed|running`. Queue a new row (§3.5).
- Another runner **holds a live lease** — `lease.expires_at` in the future. Wait, use `--wait-ms`, or `runnerctl.cjs takeover`.
- Nothing is queued for that shop at all.

A second runner **refuses by default and never writes.** That is correct behaviour, not a bug: two writers on one trolley means a real household paying for duplicated groceries.

### 5.10 ASDA re-authentication and rate limiting

**Re-auth:** the runner **detects and reports, never resolves.** On detection it sets `human_reauth_required: true`, records the reason, **releases the lease** so Warwick can sign in without an automated click racing him, writes a `failure` shop event, and exits. A request already flagged is not retried blind on the next start — a human has to clear it. **Warwick signs in himself, in the browser window; the runner never sees or handles what he types, and there is deliberately no command that could enter a password.**

**Rate limiting** (`Too Many Requests`): treated as *"come back later"*, not as a failure. The runner releases the lease, leaves the request **queued**, and exits `rate_limited`. Marking it failed would need a human to re-queue work that is fine.

---

## 6. The Telegram control surface

### 6.1 Wire format and the tap → command map

```
asd:<action>:<shopRef>[:<arg>]
```

Namespaced `asd:` so this and the hub's `decision:` protocol share the same phone without either router claiming the other's taps.

| Button / action | Becomes | Notes |
|---|---|---|
| `build` | `buildShop` | consumed |
| `review` | `getStatus` | a **read**; confirming what was read is a separate deliberate act |
| `cancel` | `cancelShop` | outranks everything while the shop is live |
| `answer` (no arg) | `getStatus` (view `questions`) | opens the queue |
| `answer` `<key>.<idx>` | `answerQuestion` | **LATCH** — a permanent fact about the shop |
| typed reply to a card | `answerQuestion` (`answerSource: 'typed'`) | text passed through **verbatim** |
| `skip` `<key>` | `answerQuestion` (`skip: true`) | "leave it" **is** a real answer; never re-asked |
| `basket` | `requestBasketBuild` | consumed |
| `pause` | `pauseBasketBuild` | consumed |
| `retry` | `retryStage` | consumed |
| `status` / `held` / `exceptions` | `getStatus` | non-durable; writes nothing |
| `search` | **refused** | searching ASDA is a supervised browser act, not a pipeline command |
| `confirm` | **refused** | it is a *prompt* — forward the ASDA email and it becomes `submitConfirmation` |
| `close` | **refused** | deliberately not mapped to `cancelShop`; cancelling a reconciled week would throw away the record |

**There is no `checkout`, no `pay`, no `order` and no `slot` action.** An action absent from the protocol cannot be put on a button, parsed off one, or reach a handler.

**Every command names a shop.** A tap that does not is refused rather than applied to "the latest" — guessing which week a button meant is exactly how you cancel the wrong shop.

### 6.2 The candidate-index contract

A question button carries a candidate **index**, not a product id, because that is the only encoding that provably fits Telegram's 64-byte `callback_data` ceiling. **An index is meaningless except against the exact list that was displayed.** So the ordered list is persisted at render time in `asdair.shop_question.rendered_candidates`, sealed by `render_fingerprint`, and a tap is resolved against **that stored list**, never a freshly computed one.

**Re-render = new card. Always.** Editing a card's candidates in place would leave the old buttons live, addressing the new list, with no signal — the precise silent misresolution this exists to stop. A tap on a superseded card is **refused with a visible alert**, and nothing is written.

**First answer wins**, enforced by a compare-and-set (`… and status = 'open'`) in the store, not a read-then-write. A losing double-tap gets the winner's answer back verbatim.

### 6.3 The known cosmetic bug: `query is too old`

**Symptom:** the tap's spinner never resolves and Telegram returns *"query is too old and response timeout expired, or query ID is invalid"*.

**Mechanism** (`pipeline/runtime.js` `routeTaps`): the durable command is dispatched **first** (`commands.dispatch`), and the tap is acknowledged **after** (`bot.answerTap`). Taps are collected by the intake poller and processed on the next pass of a loop whose default interval is **60 s** — and a pass that includes a vision call can run considerably longer. By the time `answerCallbackQuery` fires, Telegram has expired the callback query id.

**Therefore: the tap WORKED. Only the acknowledgement failed.** The durable `pipeline_command` row is already written; check `asdair.pipeline_command` rather than the spinner. This is genuinely cosmetic — but it looks identical to a dead bot, which is why it is written down. Not fixed; fixing it means acknowledging before dispatching, which trades a cosmetic defect for a real one (acknowledging work that has not been persisted). **Do not "fix" it that way** — see the standing invariant *never acknowledge before durable persist*.

---

## 7. What is NOT automated, and requires a human

Be blunt about this. Six items, five by design and one by omission.

1. **ASDA sign-in, and any CAPTCHA.** By design. The runner detects and reports; there is no command that could enter a credential, and no CDP `Input.` method is ever issued. Warwick signs in, in the visible window.
2. **Checkout.** By design, at every layer: no pipeline step, no command name, no runner command, no Telegram action.
3. **Payment.** Same.
4. **Delivery slot booking or changing.** Same — plus `delivery slot` is on the click deny-list.
5. **Substitution toggles — global and per-item.** By design and confirmed in §4. **This is the one that bit on 2026-08-03**, because the design intent (never auto-substitute) and the operational need (untick the global toggle, set the per-item flags) point in *opposite* directions, and nothing in the system closes the gap. **A human must do it, every week, as the last action before hand-back.**
6. **Building the browser plan itself. THIS IS AN OMISSION, NOT A DESIGN CHOICE.**

### 7.6 There is no plan builder

**Verified by enumeration, 2026-08-03:** the token `step_id` appears in exactly nine files, **all of them inside `services/asdair/browser-runner/`** (the runner, its allowlist, its progress model, `proofkit.cjs`, their tests and the two proof docs). Nothing in `pipeline/`, `interpret/`, `skill/`, `outcome/` or `reconcile/` emits a plan array.

`stepQueueBrowserBuild` calls `shopStore.requestBrowserBuild(shop.id)` and transitions the shop to `WAITING_FOR_BROWSER`. **It creates the request row; it does not populate `progress.plan`.**

**So the conversion from "resolved `shop_line` / list items with `asda_product_id`s" to "a validated browser-runner plan" does not exist in the repo.** On 2026-08-03 it was done **by hand**. That directly contradicts the standing rule at the head of this document — a live weekly shop currently *cannot* run without a human or a session assembling the plan.

The raw material is all there:

```sql
select sl.line_no, sl.raw_reading, sl.quantity, sl.matched_regular_id,
       r.name, r.asda_product_id, r.typical_qty, r.substitutes_allowed
  from asdair.shop_line sl
  join asdair.regulars r on r.id = sl.matched_regular_id
 where sl.shop_id = $1 and sl.status = 'matched'
 order by sl.line_no;
```

…and the mapping is mechanical: `asda_product_id` present → `add_known_product` with `origin: 'regular'`; quantity > 1 → a following `set_quantity`; no `asda_product_id` → the line needs a `search` + human-approved `select_search_result`, i.e. a question, not a guess.

> ~~**This is the single largest remaining gap in AsdAIr, and it is a build, not a fix.**~~ Recorded here so it stops being rediscovered. **Whether to build it is Warwick's decision** (`product-decision`); the note that it is missing is mine. **56 of 97 regulars still lack a captured `asda_product_id` as at 2026-07-28** — which is the same gap wearing its other hat, and is why harvesting ids while shopping still matters.

> **RE-CUT 2026-08-17.** The enumeration above is correct and still holds — no runner plan builder exists, and
> every 2026-08-03 plan was hand-written. The 2026-08-04 note took this **off** the critical path because the
> runner it feeds had been excluded; **with the exclusion LIFTED (goal contract S-8) it is back on it.** The
> right artefact is unchanged and its ownership is the point: a **durable, deterministic, Brand A–Z ordered
> execution packet produced by the product itself**, stored in Postgres and exposed as JSON, as a human-readable
> checklist and in the Cockpit. **No Claude session constructs it by hand** — which is exactly what happened
> three times on 2026-08-03. ~~*"SUPERSEDED IN PRIORITY, 2026-08-04 … no longer the largest gap and no longer on
> the critical path, because the runner it would feed is no longer the live writer … Its replacement is the
> Sonnet Browser Execution Packet (WO-P)"*~~ — **SUPERSEDED**: the packet is not Sonnet's, and the runner is not
> excluded. Schema: `SONNET-BROWSER-EXECUTION-PACKET.schema.json` *(filename retained as-is; the name is
> historical and does not designate a writer)*; process: `CANONICAL-WEEKLY-SHOP-PROCESS.md` §E.
>
> The `asda_product_id` coverage gap is **unchanged and still matters** — keep harvesting ids while shopping.

---

## 8. Contradictions with SOP-021 — resolved

### 8.1 SOP-021 §4's "Regulars tab bulk-checkbox, sort A-Z, one bulk Add selected"

**Resolution: SOP-021 §4 documents a HUMAN / Claude-in-Chrome-driven browsing method from before `browser-runner` existed. It is not, and never was, a runner capability. Bulk add is an UNBUILT capability.**

Evidence, three independent strands:

1. **Grep of `services/asdair/browser-runner/` for `checkbox|bulk|sort|Add selected|select all` returns nothing but `Array.prototype.sort()` calls.** There is no bulk-add implementation, no checkbox handling and no grid sorting anywhere in the runner.
2. **The tool names in SOP-021 §4 give it away.** It refers to `scroll_to`, `read_page` (the accessibility tree), and the `find` tool. **None of those is a `browser-runner` command** — the allowlist is the 16 in §3.2. Those are MCP / Claude-in-Chrome tool names, from the operating mode that SOP-021's own "Known limitations" section already superseded on 2026-07-28 (commit `ab3f231`): *"Asdair directs, Larry clicks" was never a valid permanent operating mode.*
3. **ASDA's control does exist.** `EXPERIMENT-RESULT.md` step 2 records `"Add selected to trolley" present` on the Regulars page — that is an *observation of ASDA's UI*, not a claim that anything drove it.

**Consequence, stated plainly:** the runner adds **one item at a time**, at ~13-30 s each (§3.3). ~~A bulk pass over the Regulars grid would be **materially faster** — plausibly the difference between minutes and tens of minutes on a 40-line shop. **It would need three new allowlisted commands** (open Regulars → read the grid → tick a named set → one bulk add) and would need `commands.cjs`, `browser.cjs` and `forbidden.test.cjs` to agree on the new surface.~~ **NOT VERIFIED** whether ASDA's bulk control tolerates being driven this way; the only recorded fact is that the control is present.

> **CORRECTED AND EXTENDED, 2026-08-04 (`BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`).** Strand 2 above was right for
> the right reason and then read backwards. The Claude-in-Chrome tool names **were** the evidence that SOP-021 §4
> had been documenting the **real, browser-driven process** all along — **not** a specification for the thing
> being built. The build had been extending a slower, unproven mechanism while the proven one sat documented in
> the SOP, misread. *That* is the error the ruling corrects. (`DEFECT-LEDGER.md` D-2026-08-03-17.)
>
> **Two further corrections follow:**
>
> 1. **The proven process was Brand A–Z ordered sequential traversal, NOT a one-click bulk add.** Warwick's
>    first-hand account is authoritative here. Do not describe or build it as mass checkbox selection unless
>    evidence proves that was the action — the speed came from *ordering and sequence*. Honestly recorded: the
>    repository does **not** independently corroborate the exact mechanism, and `EXPERIMENT-RESULT.md` records
>    only that the bulk control *exists*. That gap should be closed by capturing evidence during the next real
>    shop.
> 2. **WO-D — "build bulk add as a performance feature" — is CANCELLED as live-runtime work.** It rested on the
>    description Warwick has now corrected. The three-new-allowlisted-commands sketch above is struck through for
>    the same reason: it was scoping a feature on the strength of a mechanism that may never have existed.
>    *(The word "deferred" stood here for the adapter and is struck — the exclusion was lifted 2026-08-17, goal
>    contract S-8. The cancellation rests on the corrected mechanism claim, not on the adapter's standing.)*

**Also carried forward from SOP-021 §4 and still believed** (a human-browser fact, not a runner one): *the real cause of a failed bulk add is a single OUT-OF-STOCK item silently rejecting the WHOLE batch* — not batch size, and not an expired delivery slot (that theory was tested and is wrong). Split only to isolate and **drop** the out-of-stock item. Dropping is the action; never auto-substitute.

### 8.2 SOP-021 §5's "set the per-item substitution flag"

**Resolution: correct as an instruction to a HUMAN, impossible for the runner.** See §4. SOP-021 §5 is not wrong about *what must happen* — it is silent about *who can do it*. This file supplies that.

### 8.3 SOP-021 §4's typed-quantity warning

**Resolution: still true, and now structural.** "Fix quantities with the +/− STEPPER buttons; typing into the quantity text field does NOT persist server-side" was SOP-021's costliest lesson. It is now enforced by construction: the runner issues no CDP `Input.` method at all, so it *cannot* type a quantity even if a future step tried to.

### 8.4 SOP-021's "browser drive needs Larry" limitation

**Already superseded 2026-07-28, commit `ab3f231`.** `runner.js` is a plain zero-dependency Node/CDP process started like any other service. **Do not re-test this — it is settled.** What is *not* settled, and is stated honestly in `EXPERIMENT-RESULT.md`, is the literal "close Larry's window and watch it run" demonstration: *"runs in a process Claude Code happened to start" is not the same claim as "runs with Claude Code closed."* The first is proven; the second is expected but **NOT VERIFIED**.

> **RE-CUT 2026-08-17, Warwick's product ruling.** The technical finding stands and is still not to be re-tested. What it establishes is narrow: it retired *"the browser step needs Larry"*. **Who writes the basket is settled elsewhere and settled differently: AsdAIr does, and it chooses its own mechanism; the CDP runner is authorised** (goal contract **S-5, S-7, S-8**). ~~*"SUPERSEDED IN CONSEQUENCE, 2026-08-04 … Warwick has now ruled that it is not. The live writer is Sonnet in Claude for Chrome."*~~ — **SUPERSEDED 2026-08-17.**

### 8.5 SOP-021's open question on sort order (BRAND A-Z vs plain A-Z)

~~**Moot for the runner** — it does not sort anything. The question only re-acquires meaning if bulk add is built (§8.1). Left open in SOP-021, where it belongs.~~

**RESOLVED 2026-08-04 (`BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`): BRAND A–Z.** It applies to both halves the old question asked about — the ASDA grid ordering **and** the order of the prepared execution packet, which sorts deterministically by **(1) normalized brand A–Z, then (2) canonical product name A–Z**. The superseded database copy was right. Still moot for this runner, which sorts nothing; it is now settled for the live path. `CANONICAL-WEEKLY-SHOP-PROCESS.md` §E.

---

## 9. The live-run checklist

Run top to bottom. Every line has a verification, not an assumption.

**Before anything**

- [ ] `--preflight` passes, **and** the four unchecked env vars verified by hand (`GET {FUSION_GATEWAY_URL}/models` returns the id in `FUSION_MODEL_VISION`) — §1.1
- [ ] `require.resolve('pg')` succeeds from every folder you will run — §1.2
- [ ] Full-table grant preflight, both roles, all `asdair` tables — §1.3
- [ ] Runtime **armed**; exactly one holder; `last_write_at` fresh — §1.4, §1.5, §5.7
- [ ] Chrome up, **visible**, dedicated profile, port 9222 answering — §1.6
- [ ] `proofkit.cjs snapshot` shows `reauth_required: false` **and** records the starting trolley — §1.6
- [ ] `runnerctl.cjs show` says `run` — §1.7

**Through the pipeline**

- [ ] List received; receipt card sent; Warwick taps *Build this shop*
- [ ] Interpretation reviewed against the actual photo before it is confirmed — §5.4
- [ ] Every question answered; a correction is a **write** (alias/regular), not a note — §5.4, §5.5
- [ ] Plan ready; Warwick taps *Build ASDA basket*

**The browser build — the AUTHORISED Node/CDP executor (re-cut 2026-08-17).**

> The runner is authorised (goal contract **S-8**) and the four lines below are its operating checklist. The **traversal policy it must follow — Brand A–Z ordered sequential traversal — is [[SOP-021-run-the-weekly-asdair-shop]] §4**, and the semantic decisions remain AsdAIr's. ~~*"⚠️ DEFERRED ADAPTER ONLY (2026-08-04). NOT the live route. The live route is Sonnet in Claude for Chrome … Do not run the four lines below against the live ASDA account without fresh authority from Warwick."*~~ — **SUPERSEDED 2026-08-17.** The never-book-a-slot / never-check-out / never-pay / never-enter-the-password / never-auto-substitute boundaries are unchanged and absolute.

- [ ] Plan assembled from `shop_line` × `regulars.asda_product_id` (**by hand today** — §7.6), validated by `validatePlan` before it goes near the database
- [ ] Plan written into a **new** `browser_build_request.progress.plan`; previous request terminal — §3.5
- [ ] `runner.js --request <new id>` — watch the `reconstructed: X planned, Y done, Z remaining` line, and **stop if Z is 0 when it should not be**
- [ ] `proofkit.cjs show <id>` after the batch: `_completed_steps`, `failed_actions`, `unavailable_items`, `held_items`, `pending_favourite_actions`

**Before hand-back (human, in the browser)**

- [ ] Line-by-line quantity reconcile on the trolley — **read the quantity field, never infer it from price**
- [ ] **Untick "Allow substitutions for all"**; set per-item flags from `substitutes_allowed` — §4
- [ ] Harvest any new `asda_product_id`s seen while shopping into `regulars` — they are only obtainable there
- [ ] `enrichRegular` / `upsertRegular` for everything the week taught us, `--dry-run` first
- [ ] Ping: **"You are ready to check out at Asda!"** (or, at any stuck point, **"Larry is stuck in Asda!"**)

**Never**

- [ ] Never book a slot, check out, or pay. Never enter the account password. Never auto-substitute. Never leave the week's knowledge in a scratchpad.

---

## References

- **WHO WRITES THE LIVE BASKET — canonical, 2026-08-04, and it is NOT this runner:**
  `Builds/BUILD-015-asdair-durable-household-shopping-steward/RUNTIME-DECISION.md`
- **The end-to-end canonical process, 2026-08-04:**
  `Builds/BUILD-015-asdair-durable-household-shopping-steward/CANONICAL-WEEKLY-SHOP-PROCESS.md`
- Intent, policy, standing rules, the loop, learning arcs, **and the live Brand A–Z execution method**: [[SOP-021-run-the-weekly-asdair-shop]]
- The ten standing shopping rules (canonical): `services/asdair/skill/README.md` §"Standing rules the planner implements"
- The runner's guarantees and proof: `services/asdair/browser-runner/README.md`, `RUNNER-PROOF.md`, `EXPERIMENT-RESULT.md`
- The runtime's proof and its two named blockers: `services/asdair/pipeline-runtime/RUNTIME-PROOF.md`
- The full env checklist (SSOT): `services/asdair/pipeline-runtime/README.md` §"Required configuration"
- The control-surface wire format and render contract: `services/asdair/bot/README.md`
- Schema: `services/asdair/db/001`, `004`, `006`, `008`, `009`, `010`
- Grants: `services/asdair/db/005_asdair_rw_grants.sql`, `010_household_and_list_grants.sql`
- **Shopping data is explicitly NOT a privacy matter** (Warwick, 2026-07-27). Baskets, items, brands, quantities and preferences may be reported plainly. Only **secrets** stay out: tokens, connection strings, credentials.
