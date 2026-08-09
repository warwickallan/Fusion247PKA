# BUILD-015 Lane C — browser operation and ASDA shopping readiness

**Pax, 2026-08-09.** Commissioned by Warwick. **Read-only.** Governance head `d907350`.
**Scope:** the route `valid confirmed plan → durable execution packet → handoff → browser worker claim
→ ASDA session → trolley construction → progress durability → basket reconciliation → BASKET_READY`.
**Not in scope:** C1 (the stale-claim lease fix, owned elsewhere); Lane A's plan contract; any live action.

**Method.** Source enumeration at `C:\Fusion247PKA` (`services/asdair/**`, `node_modules` excluded),
plus the committed evidence documents. **I have no Bash, no git and no MCP in this context** — every
"live" claim below is either (a) quoted from a committed evidence file, or (b) supplied by the
commission. Both are labelled. Confidence: **High** (two or more independent artefacts) /
**Medium** (one primary) / **UNESTABLISHED**.

**No household personal data appears in this brief.**

---

## TL;DR

1. **The browser side cannot receive a plan today, and the gap is not the browser — it is that
   nothing produces or stores a plan artefact for it.** `stepQueueBrowserBuild`
   (`services/asdair/pipeline/runPipeline.js:688-699`) is the only production writer of a browser
   build request, and it inserts **`(shop_id, status)` and nothing else**
   (`services/asdair/shop/shopStore.js:576-580`). The request row carries no packet, no handoff, no
   list. **Confidence: High.**
2. **Every module that would carry the plan exists, is tested, and has zero non-test importers.**
   `packet/**` and `handoff/**` are complete and unreachable. Confirmed by enumeration across
   `services/` at `d907350`; `buildHandoff` appears in `pipeline/runtime.js:408` only inside a comment.
3. **The ruled Sonnet route has no way to finish.** The only non-test code that can move a shop to
   `SHOPPING` or `BASKET_READY` is `browser-runner/runner.js:382` and `:397` — the CDP runner that
   `RUNTIME-DECISION.md` excludes from the live route. **Confidence: High.**

**Earliest break inside Lane C: the packet/handoff production seam (C2).** Everything downstream is
blocked by it, and three of the five downstream breaks can be closed *now* without waiting for Lane A.

---

## The route, link by link

| # | Link | Label | Earliest break here? |
|---|---|---|---|
| 1 | valid confirmed plan → resolved lines | *(Lane A)* | out of scope — break 8 on the Wayfinder |
| 2 | resolved lines → execution packet | **BUILT NOT WIRED** | **⛔ EARLIEST LANE-C BREAK** |
| 3 | packet → durable storage | **BROKEN — no table exists** | ⛔ |
| 4 | packet → handoff artefact | **BUILT NOT WIRED** | ⛔ |
| 5 | handoff → request row / claim | **TWO COMPETING IMPLEMENTATIONS** | ⛔ |
| 6 | claim → ASDA session | **BROKEN for the ruled route** | ⛔ |
| 7 | trolley construction | **INSTRUCTIONS ONLY, and incomplete** | ⛔ |
| 8 | progress durability | **BUILT NOT WIRED** | ⛔ |
| 9 | completion report inbound | **DOES NOT EXIST** | ⛔ |
| 10 | basket reconciliation | **BUILT NOT WIRED** | ⛔ |
| 11 | → BASKET_READY | **BROKEN for the ruled route** | ⛔ |

### Link 2-4 — packet and handoff production

**WHAT EXISTS.** `packet/buildExecutionPacket.js` (pure, deterministic, deeply frozen, Brand A–Z sort,
schema-asserted), `packet/renderChecklist.js`, `packet/schemaAssert.js` (fails closed on any keyword it
does not implement), and the whole of `handoff/` — `buildHandoff.js`, `instructions.js`,
`fingerprint.js`, `renderChecklist.js`, `completion.js`, `claim.js`, `index.js`, plus
`mutation-proof.js`. Quality is high: `buildHandoff` re-verifies the actual line ordering rather than
trusting `sort_contract` (`buildHandoff.js:303-312`), recomputes both reconciliation counts
(`:314-331`), and refuses a known item routed to search (`:196-202`).

**WHAT IS ACTUALLY WIRED.** Nothing. Enumerated importers of `packet/**` and `handoff/**` outside their
own test files: **zero**. `pipeline/runtime.js:408` names `buildHandoff()` in a comment only.

**WHAT HAS RUN LIVE.** Nothing on this seam. **Confidence: High** — corroborated by the Wayfinder row 3
(`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:778`) and independently by the Veritas
receipt `Builds/BUILD-015-.../Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md:65`.

**WHAT IS THE EARLIEST BREAK.** `stepQueueBrowserBuild` → `requestBrowserBuild(shop.id)`. The insert is
`INSERT INTO asdair.browser_build_request (shop_id, status)` (`shopStore.js:577`). `progress` defaults
to `'{}'::jsonb` (`db/006_shop_control_surface.sql:119`). **A supervised worker claiming that row learns
the shop id and nothing else.**

**WHAT IS THE DURABLE HOME — and there isn't one.** `cockpit-api/readPacket.js:59-72` reads
`asdair.execution_packet` and `asdair.basket_reconciliation`. **Neither table is created by any migration
in `services/asdair/db/`** (enumerated; the only other hits are the interface document
`COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md:42,49` and tests). `readPacket.js` handles this correctly
and reports `not_built` rather than an error (`:329-330`). So the packet is a pure function whose output
has nowhere to live, and the reader for it is already built and waiting. **Confidence: High.**

**WHAT CAN BE REUSED.** All of it. This is the strongest asset in Lane C and none of it needs rewriting.

**WHAT IS NEEDED.** (a) the two tables; (b) a producer step between `READY_TO_SHOP` and
`WAITING_FOR_BROWSER` that builds the packet, persists it, builds the handoff, and calls `openHandoff`
instead of `requestBrowserBuild`; (c) the field mapping from durable rows — see C2 below.

### Link 5 — the claim seam has two implementations over one table

`handoff/claim.js` and `shop/shopStore.js` both own `asdair.browser_build_request`, with **different**
semantics. `claim.js` stores a handoff block in `progress.handoff` (`:102-111,148`), fences every write
on `progress->'_lease'->>'runner_id'`, and refuses to reopen a completed shop (`:162-168`).
`shopStore.js` writes no lease at all and fences only on `claimed_by` (`:639-646`). The lease key is
deliberately shared with `browser-runner/lease.cjs` (`claim.js:29-34`) — a genuine safety property —
but **`shopStore`'s claim path does not participate in it**, so the "one writer" guarantee holds only if
every writer goes through `claim.js`. Today the only production writer goes through `shopStore`.
**This is a choose-one decision, not a merge.** **Confidence: High** (both files read in full).

### Link 6 and 11 — session start and BASKET_READY

The only non-test producers of `SHOPPING` and `BASKET_READY` are `browser-runner/runner.js:382` and
`:397`. `pipeline/stages.js:85-86` records both transitions as belonging to "the supervised browser
runner" and `runPipeline.js` implements **no** step for either. `cockpit-api/commandSurface.js:38-49`
lists all ten commands: there is no command by which a supervised worker, or Warwick, can report a
built basket. **In the ruled route a shop entering `WAITING_FOR_BROWSER` can never leave it.**
**Confidence: High.**

### Link 8 — progress durability

`claim.js` provides `heartbeat`, `reportProgress`, `releaseHandoff`, `completeHandoff`, `peekHandoff`,
all lease-fenced, all zero-caller. `shopStore.updateBrowserProgress` exists and is also unused on this
route. For a *human-supervised* Sonnet session there is no process to heartbeat, so the honest shape is
probably checkpoint-on-report rather than a lease timer — **that is a design decision, not a defect**,
and it should be taken explicitly rather than inherited from the CDP runner's shape.

### Link 10 — reconciliation

`reconcile/verifyBasket.js` exists. `pipeline/runtime.js:485-486,559-564` consumes it **only through an
injected `verificationFor` provider**, and `realWiring()` (`runtime.js:777-822`) **never supplies one**.
So in production `queueShopCards` always takes the `verification: null` branch with the literal reason
*"no basket verification is wired into this runtime yet"* (`runtime.js:558`). The module is honest about
its own state, which is the right failure direction. `handoff/README.md:216-220` additionally records
that `toBasketObservation` and `verifyBasket` **have never been executed together** and no integration
test spans them. **Confidence: High.**

---

## C2 — what durable plan state the packet requires

`buildExecutionPacket` takes an input line with these required fields (`packet/README.md:47-59`,
enforced at `buildExecutionPacket.js:104-111`), and `buildHandoff` re-asserts them
(`buildHandoff.js:170-224`):

| Packet field | Durable source today | Status |
|---|---|---|
| `original_list_line` | `asdair.shop_line.raw_reading` | **available** |
| `canonical_product_name` | `asdair.regulars.name` via `matched_regular_id` | **available** (never model prose — `shopLines.js:32-37`) |
| `canonical_product_id` | `shop_line.matched_regular_id` | **available** |
| `required_quantity` (int 1–99) | `shop_line.quantity` — **null means ask a human** (`shopLines.js:39-42`) | **Lane A must resolve** |
| `brand` | `regulars.brand` | available, nullable |
| `asda_product_ref` (`^[0-9]{3,12}$`, **mandatory for every `known` line**) | `regulars.asda_product_id` | **⚠️ HIGH RISK — see below** |
| `origin` (`known` \| `new_approved`) | not stored; derived from `shop_line.status` + an approval | **Lane A contract** |
| `approved_search_term` (mandatory for `new_approved`) | not stored anywhere | **Lane A contract** |
| `source_view` (`regulars` \| `favourites` \| `search`) | **no producer exists** | **⚠️ see below** |
| `held[].reason` (6-value enum) | `shop_line.status` uses a **different** 6-value vocabulary | **no mapping is defined anywhere** |

**The highest-risk coupling, and it is checkable today without Lane A.** `buildHandoff.js:208-214`
throws `KNOWN_WITHOUT_ASDA_REF` for any `known` line without a 3–12 digit ASDA reference, and
`buildExecutionPacket` rejects it independently. Two committed measurements disagree on the number but
agree on the shape: **70 of 91 regulars carry no `asda_product_id`**
(`Builds/BUILD-015-.../BUILD-015-goal-contract.md:147`) and **57 of 103 have an id, 46 without**
(`Deliverables/2026-08-08-pax-supabase-household-knowledge-audit.md:32`, marked LIVE). Either way, **a
large minority of the catalogue cannot produce a valid `known` line**, and the packet's own defence-in-
depth turns that into a hard stop for the whole weekly shop rather than a per-line hold. **This is the
single most likely first failure the moment Lane A hands over a good plan, and it needs a ruled policy
— hold the line, or downgrade it — before that happens.** **Confidence: High on the mechanism;
Medium on the exact count (two sources disagree; neither re-verifiable from this context).**

**`source_view` has no producer and cannot get one from current data.** `packet/README.md:110-123`
records, verified live 2026-08-04, that `asdair.regulars` holds only `source = 'regular'` — **no
`'favourite'` value exists in the table at all** — while the canonical process requires the two to be
distinguished end to end. The producer refuses to infer it and takes it explicitly from the caller.
So `source_view` is a **wire-point decision Lane A must settle**, and `BROWSER_METHOD` step 4 ("using
the `source_view` named on its line") depends on it.

**Do not design against a transient plan shape.** The four rows marked *Lane A contract* above are
exactly where a change to "what a resolved line means" lands. **Everything else in this brief is
independent of that.**

**What can be wired NOW, with no Lane A dependency** (all five are `READY TO IMPLEMENT`):

1. The `asdair.execution_packet` / `asdair.basket_reconciliation` migration. The shape is published, the
   reader exists, and the reader already degrades correctly while they are absent.
2. **One** owner for `browser_build_request` — `claim.js` or `shopStore.js`. Pick, retire the other path.
3. The cross-module pin test between `packet`'s `normalizeSortKey` / `identityKey` and `handoff`'s
   deliberate mirrors. Both modules export them **specifically for this test**
   (`buildHandoff.js:437-442`) and `handoff/README.md:221-226` names the obligation as open.
4. The `toBasketObservation` → `verifyBasket` integration test. Named as unproven by its own README.
5. The ASDA-reference coverage policy above.

---

## C3 — the proven browser operating method

**Five categories, kept separate** (full evidence in
`Deliverables/2026-08-09-pax-browser-method-recovery-audit.md`; not restated here):

1. **Proven successful method — NOT CDP.** Three successful runs, all browser-tool-driven:
   `navigate`, `get_page_text`, `find`, `read_page`, `form_input`, `computer (click)`,
   `javascript_tool`, `scroll_to`. Confidence: High.
2. **Durable instructions — `handoff/instructions.js`, `INSTRUCTIONS_VERSION = 1`.** `BROWSER_METHOD`
   (10 steps, `:39-50`), `PROHIBITED_ACTIONS` (5, `:59-65`, pinned against a literal in its test),
   `COMPLETION_CONTRACT` (7), `RECONCILIATION_CONTRACT` (5), `LINE_REPORT_STATUSES` (4, with no
   `substituted` member by design). **BUILT NOT WIRED.**
3. **The later CDP experiment** — `browser-runner/`, added 2026-07-28. Excluded from the live route.
4. **The later regression** — RUN-4, 2026-08-03: ~8 hours, three hand-assembled plan files,
   one dedicated product page per item.
5. **The current production candidate** — Sonnet in Claude for Chrome. No programmatic invocation
   surface exists and `handoff/README.md:14-34` deliberately does not invent one. The instruction
   wording is therefore **the entire control** (`instructions.js:17-21`).

**The finding that matters.** Of the proven efficiency behaviours, **`BROWSER_METHOD` carries only
three**: Regulars/Favourites first, Brand A–Z, work in the given order. **Seven proven behaviours are
absent from the artefact a worker actually receives** — audit the trolley before touching anything ·
re-acquire references after every mutation · verify each add from the trolley before the next line ·
one page context, never a page per product · reconcile line-by-line from the trolley DOM reading each
line's **actual quantity field** · correct quantities with the `+`/`−` steppers because **typed
quantities do not persist** · batch every open question into one message. Several of these are in
SOP-021, but SOP-021 is not what `renderChecklist` prints — `renderChecklist.js:65-67` renders
`handoff.method` and nothing else. **A fresh worker handed today's artefact does not inherit the two
most expensive lessons the household has already paid for.** **Confidence: High** (both surfaces read
in full).

`instructions.js` is a pure, versioned, test-pinned data module. **Extending it is a bounded edit with
no Lane A dependency** — the cheapest high-value item in Lane C.

---

## C4 — ASDA authentication and session durability

**WHAT EXISTS, and it works.** `browser-runner/guards.cjs:101-105` (`looksLikeAuthSurface`),
`browser.cjs:65-78` (`PAGE_STATE`, with a **positive-evidence** signed-out test, not a redirect test),
`browser.cjs:224-239` (`state()` / `assertUsable()` → `ReauthRequiredError`),
`progress.cjs:169-173` (`setReauthRequired`), `runner.js:156-159, 164-165, 413-423` (`finishReauth`:
flag, save `last_error`, write a shop failure event, stop the heartbeat, **release the lease**, log,
return `human_reauth_required`). The design point is correct and load-bearing:
`RUNNER-PROOF.md:276-282` — *"The detection fired on the signed-out header, not on a redirect… It now
reports before it begins"*, and the lease is **released** because the human is about to use that browser.

**WHAT HAS RUN LIVE — PROVEN LIVE, and it is the only proven link in the whole of Lane C.**
`RUNNER-PROOF.md:248-272` records a real, non-dry-run run against the real browser on 2026-07-28:
request 2 → `status queued`, `claimed_by null`, `human_reauth_required true`,
`released_reason human_reauth_required`, `completed_step_ids []`. Nothing was clicked, typed or added.
**Confidence: High.**

**Three things the commission should know about the live row it cited.**

- **Request 2 is a synthetic proof shop** — `SHOP-RUNNERPROOF-2026-07-28`
  (`RUNNER-PROOF.md:311-316`), deliberately left queued because that is the accurate state of the world.
  It is **not** a stalled real weekly shop.
- **The `last_error` text quoted in the commission does not match what `RUNNER-PROOF` logged.** The
  proof's reason was *"the store rendered its signed-out header on … — the ASDA session has lapsed"*
  (`browser.cjs:230`), and `finishReauth` writes the *same* string to `last_error` and to the log
  (`runner.js:416,420`). The live value is instead the generic fallback at `runner.js:165`. At
  `d907350` that fallback is **unreachable through `open_groceries()`**, because `assertUsable` always
  throws and the catch supplies a non-empty `e.message` (`browser.cjs:151, 237`; `runner.js:164`).
  **Conclusion: the live row was last written by a code state that is not `d907350` — most likely a
  later or earlier undocumented run.** **Confidence: Medium** (the live string is single-source, from
  the commission; the code paths are High). **Provenance UNESTABLISHED. Worth two minutes of `git log`
  before anyone treats that row as current-code behaviour.**
- **The durable record is weaker than the log.** Whatever produced it, the stored `last_error` carries
  the generic phrasing rather than the diagnostic one, so the durable record lost the reason. That is
  an observability defect in the reporting path, not in the detection.

**WHAT THE RULED ROUTE HAS. Almost nothing.** For a fresh Sonnet worker:

| Situation | What happens today |
|---|---|
| Already authenticated | Nothing checks. The worker starts adding. |
| Session expired mid-shop | No detector, no vocabulary. `LINE_REPORT_STATUSES` offers only `added \| not_found \| out_of_stock \| skipped` (`instructions.js:131`) and `completion.js:99-105` refuses anything else. A lapsed session is reported as a run of `skipped` lines — **indistinguishable from a genuine skip.** |
| Reauthentication required | One instruction only: `no_password_entry` — *"If ASDA asks you to log in, stop and report it"* (`instructions.js:63`). No structured field, no top-level status, no shop event, no way to reach Warwick. |

**Warwick's boundary is right and is already stated** — the worker detects and reports; he
re-authenticates. **What is missing is the reporting half.** `ingestCompletion` validates only
`packet_fingerprint`, `shop_ref` and `lines` (`completion.js:75-93`); a partial shop stopped by an
auth wall has no honest shape in the report at all.

**READY TO IMPLEMENT, no Lane A dependency:** (a) a `BROWSER_METHOD` step 0 — *confirm you are signed
in before adding anything, and report immediately if not*, mirroring the proven positive-evidence check
rather than a redirect check; (b) a top-level report field (e.g. `stopped_early` + reason) plus a
distinct line status so a stopped shop is not laundered into `skipped`; (c) reuse `progress.human_
reauth_required` as the durable flag — `shopStatus.js:179-190` already reads runner-written facts out of
`progress` and returns null rather than guessing when absent.

---

## Zero-caller modules, named explicitly

**Zero non-test importers anywhere in `services/`, at `d907350`:**
`packet/buildExecutionPacket.js` · `packet/renderChecklist.js` · `packet/schemaAssert.js` ·
`handoff/index.js` · `handoff/buildHandoff.js` · `handoff/instructions.js` · `handoff/fingerprint.js` ·
`handoff/renderChecklist.js` · `handoff/completion.js` · `handoff/claim.js`.

**Wired but never reachable in production:** `reconcile/verifyBasket.js` (injection point exists;
`realWiring` supplies nothing) · `shopStore.updateBrowserProgress` / `claimBrowserBuild` /
`finishBrowserBuild` (no production caller on the ruled route) · `cockpit-api/readPacket.js` (reads two
tables that do not exist).

**Previously reported, still true:** `browser-runner/cdp.js:33,110` exports `closeTab` with **zero
callers**, while `actions.cjs:7-15` opens a tab per invocation and closes only the websocket.
Consequence for Lane C: **the tab-leak lives in the hand-driven probe surface, not in `runner.js`** —
do not "fix" the runner for a defect it does not have.

---

## Anti-patterns — what the mediocre version of this work looks like

1. **Wiring `handoff/` to the packet without a durable home for the artefact.** The seam would work
   in one process and evaporate on restart. The Sonnet step is *supervised and human-paced* — hours may
   pass between handoff and report. **Persistence is a precondition here, not a nicety.**
2. **Building a third lifecycle over `browser_build_request`** because two already disagree. There are
   two; the correct move is to retire one.
3. **Re-deriving the browser method from a document rather than from proven runs.** That is precisely
   the 2026-08-03 failure — SOP-021 §4 was read as a specification for the runner being built. Extend
   `instructions.js` from the **run evidence**, not from prose about it.
4. **Reviving the CDP runner because it is the only thing that can reach `BASKET_READY`.** It is ruled
   out of the live route and prohibited from further live-account testing. Its *concurrency design* is
   already harvested into `claim.js`; take nothing else.
5. **Inventing a programmatic Sonnet trigger.** `handoff/README.md:14-34` refused this deliberately and
   the refusal is correct. A fake trigger is worse than no trigger.
6. **Letting a stopped shop report as `skipped` lines.** Silent degradation of a failure into a normal
   outcome is exactly the class of defect this build exists to end.
7. **Designing the `origin` / `source_view` / `approved_search_term` mapping now.** Those four fields
   are Lane A's, and building against today's transient shape is guaranteed rework.

---

## Open questions I could not resolve

1. **The exact live `browser_build_request` state.** No DB access in this context. The commission's
   `last_error` string is single-source and does not reconcile with `d907350`'s code paths (C4 above).
2. **The true ASDA-reference coverage.** Two committed measurements disagree (70/91 vs 46/103 missing)
   and both predate today. Re-measure before ruling the policy.
3. **Whether the browser worker's session is expected to be Warwick's own Chrome profile or a dedicated
   one.** `EXPERIMENT-RESULT.md:33` describes a dedicated profile where the ASDA login persists across
   machine restarts; the ruled Sonnet route says nothing about which profile. This decides whether
   "already authenticated" is the normal case or the exception. **UNESTABLISHED.**
4. **Whether a lease/heartbeat is wanted at all for a human-paced supervised step.** Inheriting the CDP
   runner's 45 s lease (`claim.js:50`) into a session a human may leave for an hour would produce
   constant spurious expiry. A `product-decision`, not a defect.
5. **Whether a partial basket may be reported.** `ingestCompletion` requires one report line per packet
   line to avoid `missingFromReport`; a shop stopped halfway has no defined outcome.

## Limitations

- **No Bash, no git, no MCP, no database.** Every current-state claim is a source claim from the
  working tree at `C:\Fusion247PKA`. "Zero callers" means zero matches by content search across
  `services/**` excluding `node_modules`, and would miss a dynamic `import()` built from a computed
  string. I found no such pattern, but I did not exhaustively exclude one.
- I did not read the in-flight worktree owned by the C1 implementer; findings about
  `handoff/**` and `browser-runner/**` describe `C:\Fusion247PKA` at `d907350` only.
- Elapsed-time and speed claims are relative (page visits, operations), never absolute — no successful
  run in the record has a measured duration.
