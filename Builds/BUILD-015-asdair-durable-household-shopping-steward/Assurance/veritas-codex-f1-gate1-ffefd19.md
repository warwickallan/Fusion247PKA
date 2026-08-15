---
build: BUILD-015
scope: WO-2026-08-15-01 — Codex F-1, shop/household ownership on the shop-owned list write
gate: 1

boundary: >
  The Codex F-1 correction and the outcome it promised — a shop-owned list write REFUSES,
  changing nothing, unless the supplied `shop_id` resolves to a shop whose `household_id`
  equals the household the command already resolved, so a wrong or stale `shop_id` can never
  attach an item to a list belonging to a different shop or a different household.

reviewed_sha: ffefd1985395b3953a6758f8c13ae2f5e997f356
governance_sha: 64e9656d115f2e0004423ba002ba71d9ca8e9d85
branch: build-015/f1-shop-household-ownership
remote_reachable: true   # `git branch -r --contains ffefd19` -> origin/build-015/f1-shop-household-ownership

evidence_method: export (all execution) + read-only inspection of the canonical repository at main
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/0deb55dc-12c0-4c50-b8fb-8756fb3f0ecc/scratchpad/veritas-f1-export
worktree_head_at_start: 64e9656d115f2e0004423ba002ba71d9ca8e9d85
worktree_head_at_end: 64e9656d115f2e0004423ba002ba71d9ca8e9d85
worktree_status_clean: false   # see Evidence provenance — CHANGED BY ANOTHER ACTOR, not by Veritas

review_ceiling: "proportionate — roughly 45 minutes"
ceiling_observed: exceeded by roughly 15 minutes, entirely on the mutation probes in Defect D2

verdict: HOLD
receipt_sha256: 4c6b33fe777a4967e0882a1f98f0880a5f8bc132efaa553c116b1e34e6e463c3
reviewed_by: veritas
reviewed_date: 2026-08-15
next_review_trigger: >
  Warwick's decision on migration 290's disposition (keep in scope, or strip), plus any change
  to the guard's executable behaviour. A receipt, documentation or clerical commit is not a trigger.
---

## Scope reviewed

The six numbered acceptance criteria of `Deliverables/2026-08-15-wo-b15-f1-shop-household-ownership.md`,
graded separately, and the human outcome they serve. In scope: `asdairCommands.mjs`'s guard,
`add-list-item.dbtest.mjs`, `290_cp_worker_shop_read.sql`, the production caller chain that reaches
`execute`, and the two specific properties Larry asked to be tested rather than accepted.

**Deliberately NOT in scope, and NOT claimed:** any statement about the LIVE Supabase project.
Veritas holds no credential scope and no declared private surface, so the live grant matrix, the live
`asdair.shop` rows and the live open-shop state were **not measured**. **This receipt makes no
current-readiness claim about Tuesday's shop** and must not be read as authorising it — that is a
Gate 2 question against measured live state, and it has not been asked or answered here.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | Fail closed on mismatch or absent shop, writing nothing | **PASS** | Guard sits at `asdairCommands.mjs:286`, ahead of `pg_advisory_xact_lock` and every write; returns the same `{ok:false, error}` shape as sibling refusals, never a throw. Executed: 3 refusal cases, row counts identical before/after. | none |
| AC2 | Executed regression asserting row COUNTS before and after, not merely "no exception escaped" | **PASS** | `counts()` spans `shopping_lists`, `shopping_list_items` and `pipeline_command`; asserted at each of the 3 refusals. Ledger element is **vacuous and the test says so** — `execute()` writes no ledger row on any path, so it is a constant, not a control. Honest labelling, not a defect. | ledger assertion has no discriminating power |
| AC3 | Three cases: same-household two-shop isolation; a `shop_id` resolving to no shop; foreign-household shop in BOTH sub-cases including the reclaim | **PASS** | All four executed and independently reproduced. Foreign shop *owning a list* → refused, other household's list still holds only `B-only milk`. Foreign shop *owning no list* → refused **before** the reclaim, this household's unowned list still `owner=null`. Ghost id 1002 → `shop 1002 not found`, structured, not FK 23503. Same household, shops A1/A2 → both accepted, list 2 vs 3, qty 2 vs 5, neither clobbered. | none |
| AC4 | The reclaim-before-create behaviour Codex confirmed correct is unbroken | **PASS** | Executed: `reclaimed=4, expected=4`; exactly **1** list for that household+date; `Cockpit bread` and `Cat food` share the reclaimed list. Section 16 (h) — the original reclaim proof — all green alongside it. | concurrent SELECT/UPDATE interleaving still unexercised (pre-existing, unchanged, correctly declared) |
| AC5 | The guard is mutation-tested — made to fail, then restored | **PASS** | **Independently re-run by Veritas, not accepted from the builder.** Guard disabled (`if (shopId !== null)` → `if (false)`): exit **1**, **7 FAIL**, and the failures reproduce Codex's exact defect — `Smuggled item:9` on the other household's list, `owner=2` on this household's unowned list. Restored: exit **0**, 57/57, source sha256 identical to pre-mutation. | first mutation attempt silently no-op'd on CRLF; caught only because the run asserted the source SHA changed |
| AC6 | No scope creep | **HOLD** | The order states `schema_decision: n/a` — *"No schema change is authorised by this order… If you conclude the correct fix REQUIRES a constraint or migration, STOP and say so — do not author one"* — and AC6 itself says *"no migration… report it and stop — that is a Warwick decision, not yours or mine."* A migration (`290_cp_worker_shop_read.sql`) was authored. | See Defect D1. Additive, idempotent, grant-only, applied nowhere, and honestly labelled in its own header — but authored where the order said report-and-stop |

## Evidence provenance

- **All execution ran inside a `git archive` export of `ffefd19`** at the workspace path in the
  frontmatter, outside the repository. `node_modules` was reached by two junctions into the canonical
  checkout's already-installed dependencies (`services/control-plane`, `services/asdair/pipeline`);
  no repository file was read for source and none was written.
- **Every mutation was applied inside the export only**, against a `.veritas-orig` backup, with the
  source sha256 asserted **changed** before each mutant run and asserted **identical** after restore.
  `97e0bc67…d1e8b3` pre-mutation → `20f617ef…87e453` mutated → `97e0bc67…d1e8b3` restored.
- Postgres clusters were provisioned and torn down by the committed `run-add-list-item-test.sh` on
  ports 55488–55492, inside the export directory. **Nothing touched any live database.**
- Repository `git rev-parse HEAD` at start / end — `64e9656…` / `64e9656…`, **identical**.
- Repository `git status --porcelain` — **NOT identical**. At start: 3 untracked paths. At end: those
  3 plus `Builds/BUILD-006-vlogops-publishing-engine/Assurance/`. **Veritas wrote nothing into the
  repository during the review**; that path appeared from another actor working concurrently. Recorded
  rather than smoothed over, and it does not touch any evidence above, all of which came from the export.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `PGPORT=55488 bash ./run-add-list-item-test.sh` (export, ffefd19) | 0 | 57 | **PASS — 57 passed, 0 failed**; named assertions (a)(b)(c)(d)(e)(f)(g)(h)(f1) all PASS |
| Same, guard mutated to `if (false)` | 1 | 57 | **FAIL — 50 passed, 7 failed**; foreign write ACCEPTED, `owner=2`, FK 23503 leaks out |
| Same, guard restored | 0 | 57 | **PASS — 57 passed, 0 failed**; source SHA matches pre-mutation |
| `PGPORT=55492 ASDAIR_DBTEST_WITHOUT_290=1 bash ./run-add-list-item-test.sh` | 1 | 57 | **FAIL — 56 passed, 1 failed**; `(e) cp_worker was refused: permission denied for table shop` — migration 290 is genuinely load-bearing for that lane |
| `cd services/asdair/pipeline && node --test` (export, ffefd19) | 0 | 511 | **511 passed, 0 failed** — the offline pipeline suite is GREEN at the reviewed head |
| Same, with this shell's `FUSION_MODEL_VISION=gpt-5.6-terra` left set | 1 | 511 | 1 failure, `TERRA: ROLE_ALIAS is byte-identical`. **Environmental, not this branch**: `models.mjs:20` reads `process.env.FUSION_MODEL_VISION`, byte-identical on `main`, and `services/obsidiwikai/**` is untouched by this branch |
| Guard SQL mutated to `from asdair.shopZZZ where id = $1`; pipeline suite re-run | 0 | 511 | **511 passed, 0 failed** — see Defect D2 |
| Probe counting guard reaches in the pipeline suite | — | 313 | the guard *is* executed 313 times offline, yet a nonexistent table still leaves the suite green |
| `git rev-parse f3e6ae4:…/asdairCommands.mjs ffefd19:…/asdairCommands.mjs` | 0 | — | both `8aa13edaf957438f76f856dff30180c3c4bae581` — the builder's byte-identity claim **holds**, and the suite was additionally re-run at this head, so the residual is discharged by execution, not by inference |
| LIVE Supabase grant matrix and live shop state | — | — | **UNAVAILABLE — not measured.** No credential scope, no declared private surface. Named, not assumed passed |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | The promised outcome is delivered: a wrong, foreign or stale `shop_id` is refused and writes nothing, proven by row counts on real Postgres and by a mutation that reproduces the original defect |
| Design fidelity | HOLD | Guard placement, refusal shape and the deliberate byte-unchanged `findOrCreateDraftList` / `reclaimUnownedList` are exactly right. The authored migration is outside what the order authorised — D1 |
| Functional proof | PASS | 57 assertions against a real disposable Postgres, executed by Veritas, not read about |
| Integration | PASS | Traced end to end — see Production caller and journey. The guard is at the single choke point; `findOrCreateDraftList`'s only other caller (`asdairCommands.mjs:238`, the cockpit lane) never passes a `shopId` |
| Durability | n/a | No new durable state, no new process, no restart semantics claimed. The pre-existing `uq_lists_shop` / `uq_lists_household_date_unowned` structural guarantees are unchanged |
| Test quality | HOLD | The dbtest is a genuine control — mutation-proven red, and it fails for the right reasons with the right messages. But D2 shows the offline pipeline suite provides **no** red-on-break coverage of the guard's statement, contradicting a "verified by execution" claim written into product source |
| Git truth | PASS | Branch, head and PR reported accurately; `ffefd19` reachable from `origin/build-015/f1-shop-household-ownership`; PR #106 open and unmerged; two commits, scope confined to 3 files |
| Documentation truth | PASS (with D2 noted under Test quality) | Larry's `document_impact: []` **verified independently, not audited against itself** — a repository-wide scan for documents describing this ownership contract found only `services/asdair/pipeline/README.md:253`, a routing table that states no ownership behaviour and is not falsified |
| Residual risk | PASS | The builder's four declared residuals are accurate. Two are now discharged by execution (byte-identity; offline suite green at head), one is confirmed true and independently verified (the CI path filter), one is correctly carried forward (concurrency) |
| Completed automation | n/a | The order explicitly classifies this as **NOT intended to be automatic** — a correctness fix inside an existing human-initiated write path. Correctly classified; no automation is claimed and none is owed |

## Production caller and journey

Traced from the real entry point, by enumeration rather than assertion — this is the answer to
Larry's first question, and it does not rest on the builder's inference.

1. **The path that DOES supply `shop_id`:** AsdAIr pipeline → `runPipeline.js:931` (grounded intents)
   and `:1842` (corrections), both emitting `args.shop_id = shop.id` → `deps.js:785 executeIntents`
   → `realExecuteIntents` (`deps.js:267`) → `asdairCommands.execute`. That connection is
   `ASDAIR_WRITE_DB_URL`, documented at `deps.js:20` as **`asdair_rw`** — **not `cp_worker`**.
2. **The path cp_worker serves:** `asdair-worker.mjs` drains `asdair.command_request`. Only
   `cp_directus` may insert there (`040_cockpit_grants.sql:38`). **No repository code inserts an
   `add_list_item` request at all** — `services/cockpit/**` contains no reference to `command_request`;
   the only in-repo `add_list_item` producers are `shopperRoute.mjs` (which **never** sets `shop_id`)
   and `runPipeline.js` (which is path 1). The cockpit's actual command, `add_regular_to_next_week`,
   takes `asdairCommands.mjs:238` and passes **no** `shopId`.
3. **Therefore the builder's inference is correct as far as the repository can establish it — and,
   more importantly, the no-regression claim does not depend on it.** The guard is inside
   `if (shopId !== null)`, so a `shop_id`-less command issues no new statement whatsoever. And if the
   inference were wrong on an unpatched database, the guard's `select` raises `permission denied`,
   `asdair-worker.mjs` rolls back to its `savepoint exec`, records `status=failed` with the error in
   the visible receipt, and **writes nothing** — strictly safer than the pre-fix behaviour, which
   would have written to the wrong list.

**On migration 290 being unapplied — Larry's second question.** The correction is honestly complete
without it *for the promised outcome*, and the strongest evidence is behavioural rather than
documentary: `services/asdair/shop/shopStore.js` runs on the same `ASDAIR_WRITE_DB_URL` and already
issues `SELECT … FROM asdair.shop WHERE id = $1 FOR UPDATE` (`:148`) on every live shop. If `asdair_rw`
could not read `asdair.shop`, no live shop could ever have run. `012_complete_grant_matrix.sql:116`
grants `select, insert, update on asdair.shop to asdair_rw`, and its own header records that it was
enumerated from the live matrix and grants nothing new. **290 matters only to the `cp_worker` lane,
which has no producer today and whose worst case without it is a loud refusal, not a wrong write.**
**Caveat stated plainly: I did not measure the live database.** The above is inference from production
behaviour and committed grants, which is as far as a read-only reviewer with no credential scope can go.

## Restart and durability

`n/a` — no durable state, process, scheduler or resume semantics are introduced or claimed by this
change. The list-identity guarantees it relies on (`uq_lists_shop`, `uq_lists_household_date_unowned`,
the `shopping_lists_shop_id_fkey`) are pre-existing and were exercised unchanged by assertions
(a)–(h) in the same run.

## Documentation contradiction scan

- Larry's declared DOCUMENT IMPACT: `[]`, with the claim that no active document describes this
  function's ownership contract.
- Verified independently against the repository, **not audited against his list**: scanned every
  tracked `.md` under `Deliverables/`, `Builds/` and `services/` for `add_list_item`. Twelve files
  mention it; eleven are historical build records, receipts, ledgers and decision packets.
- **What his list missed:** `services/asdair/pipeline/README.md:253` — an active document naming this
  module as the writer of `shopping_lists` / `shopping_list_items` via `add_list_item`. It states a
  routing fact only, asserts nothing about ownership, and is **not** falsified by this change.
  Non-blocking, and it does not change his conclusion.
- Active documents that would misdirect a fresh instance: **none found**.
- Closure claims since the last receipt: `n/a` at Gate 1 — that enumeration is Gate 3's.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D1 | Medium | **A migration was authored where the order said report-and-stop.** `290_cp_worker_shop_read.sql` is additive, idempotent, grant-only, column-scoped, applied to no database and honestly labelled in its own header — but `schema_decision: n/a` and AC6 both forbade authoring one and named the choice as *"a Warwick decision, not yours or mine."* The builder both authored **and** reported it, so nothing is concealed. **The decision is genuinely Warwick's: keep 290 in scope for this PR, or strip it and carry the cp_worker grant as separate work.** This gates the completion claim for this Work Order; it does **not** make the guard unsafe and does **not** block any other work. | non-blocking to the route; **gates the AC6 PASS and therefore the WP completion claim** | Warwick (decision); Larry (dispatch of whichever) |
| D2 | Medium | **A "verified by execution" claim in product source that I could not reproduce.** `asdairCommands.mjs:56–68` states that the offline pipeline double answers only the spaced `id = $1` form, that *"every `add_list_item` intent in the pipeline suite… reaches this query"*, and that written unspaced *"262 offline tests die"* — closing with *"Verified by execution BOTH ways on 2026-08-15"* and *"Do not 'tidy' the spacing."* Executed at this head: the unspaced form leaves **511/511 green**, and so does replacing the table entirely with `asdair.shopZZZ` — while a probe shows the guard **is** reached **313** times. So the offline suite provides **zero** red-on-break coverage of this statement, and the stated mechanism does not hold. The committed code is the correct spaced form and the suite is green, so there is **no functional defect** — what is wrong is an unreproducible executed-evidence claim left in source as an instruction to future maintainers. | non-blocking | Larry (report to Warwick; the correction is a comment, not code) |
| D3 | Low | **The CI blind spot is real, and independently confirmed.** `.github/workflows/asdair-tests.yml:45-51` is path-filtered to `services/asdair/**`, so PR #106 — which touches only `services/control-plane/**` — will not run the pipeline suite it could break. The builder declared this himself and called his own green run *"a habit, not a control"*; that is an accurate self-assessment. Discharged **for this head** by Veritas executing the suite directly (511/511), not by the filter being fixed. | non-blocking | Larry (park for Warwick; **do not raise a Work Order** — pre-existing, out of this order's surface) |
| D4 | Low | The AC2 ledger assertion is vacuous — `execute()` writes no ledger row on any path, so `ledger=0` is a constant. The test **says so, in terms**. Recorded because a future reader must not mistake it for coverage. | non-blocking | none — correct as written |

## Verdict

**HOLD** — AC1–AC5 are each PASS on executed evidence I generated myself, including an independent
mutation that reproduces Codex's exact defect and is restored byte-for-byte; the correction genuinely
does what it promised, and it does not depend on migration 290 being applied. AC6 is HOLD because the
order forbade authoring a migration and named that choice as Warwick's, and one was authored — a
decision to route, not a fault to re-engineer.

**What this HOLD gates:** the completion claim for WO-2026-08-15-01, and merge of PR #106. **What it
does not gate:** anything else on the active route, and it transfers no ownership of the work queue.
**One line from Warwick on D1 discharges it**, and the confirmation needed afterwards is a single
focused check of that one point.

**What this receipt does NOT say:** it makes **no** claim that Tuesday's live shop is ready. The live
database was not measured and could not be. That question belongs to Gate 2 against measured live
state, and nothing here should be quoted as answering it.

## Next review trigger

Warwick's disposition of migration 290 (keep or strip), or any change to the guard's executable
behaviour. A receipt, documentation or clerical commit is **not** a trigger.
