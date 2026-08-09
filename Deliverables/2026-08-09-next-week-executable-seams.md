# Next week starts at CODE, not rediscovery — the executable seams

**2026-08-09, session close.** Two Keel dispatches **REFUSED on process grounds and were right to** — Larry issued both without `tools/wo/envelope.mjs`, a **third recurrence** of the tracked CAPAE family in one day, driven by "move fast" pressure. **The control worked three times.** Both workers nonetheless returned the establishment Warwick asked for as the explicit fallback, and it is banked here so next week opens at implementation.

**Both need one thing before code: an envelope-generated Work Order.** Nothing else is missing.

---

## LANE C1 — browser claim lease/fencing. **The seam is ONE FILE.**

`services/asdair/shop/shopStore.js`.

1. **`CLAIM_BROWSER_REQUEST_SQL` (~line 147).** Replace `status = 'queued'` with the `CLAIMABLE` predicate from `handoff/claim.js`, and add `progress = progress || jsonb_build_object('_lease', …)` using that file's server-side `LEASE_JSON`. **Import the fragments — `claim.js` is zero-dep and injects `query`. Do not retype them.**
2. **`updateBrowserProgress` (line 628) IS ALREADY THE HEARTBEAT.** It accepts `options.claimed_by` and appends `AND claimed_by = $n`. Add the second fence term `AND progress->'_lease'->>'runner_id' = $n`, refresh `heartbeat_at`/`expires_at` from `now()` in the same statement, and throw the imported `LeaseLostError` on `rowCount 0`.
3. **`finishBrowserBuild` (line 662) carries no writer fence at all** — add the same optional fence.

**Real production event:** `shop-cli.js` `claim-build` / `progress` (lines 229/240). **The heartbeat comes from that human-paced loop, never a timer inside the store** — which is why `DEFAULT_LEASE_MS = 45_000` is wrong here. Proposed: **lease ~15 min, heartbeat ~60 s.**

**Data hazard:** `_lease` is absent on every existing row; `claim.js`'s `coalesce` fallback already covers it. **Recovery of the stranded rows 1 and 5 is a SEPARATE one-shot CLI verb, not part of the claim change.**

**Mutation plan** — mutate, `git diff` to prove it applied, run, restore from git:
`M1` drop the `expires_at` term → `claim.test.js` *"live lease not stealable"* must fail · `M2` drop the `runner_id` fence → the new progress-fence test must fail · `M3` omit `_lease` from the claim SET → the heartbeat test must fail.

**Acceptance command:** `cd services/asdair/shop && node --test` (already CI-gated, `asdair-tests.yml:100`).

> ### 🔴 HIGH, out of scope, found on the way
> **`services/asdair/handoff/**` appears in NO step of `asdair-tests.yml`.** `claim.test.js` — the proof the entire lease design rests on — **gates nothing.** Not a Work Order; a fact that should change what next week trusts.

---

## LANE D — confirmation ingress

**Defect confirmed at `a5f5b5e`:** `runtime.js:145` — `received.push(await commands.receiveList(spec, deps))`, **unconditional**. The `telegramAdapter.js:151` comment claiming the email *"becomes `submitConfirmation`"* is **false as stated**.

`commands.submitConfirmation` **exists** (`commands.js:387`, dispatch `:485`) with **zero Telegram-path callers**.

**Feasible discriminator, already present:** `runtime.js:539` loads live shops and tests `shop.status === 'BASKET_READY'`.

**Proposed `file_surface`:** `services/asdair/pipeline/runtime.js`, `services/asdair/pipeline/telegramAdapter.js`, `services/asdair/pipeline/test/**`.

**Constraint that shapes the design:** Pax's safer option (b), an explicit latch, **needs persisted state and therefore a `schema_decision`**. Without one, **only option (a) — the status discriminator — is deliverable.** Decide which before issuing the order.

**Baseline for the AC: 290 tests green** at `a5f5b5e`. *(The `d907350` figure of 205 is a different tree and does not apply.)*

> **⚠️ Worktree hazard, hit again today:** the agent's isolated worktree was **not** cut from `a5f5b5e` — `git merge-base --is-ancestor` returned NO, with a 3,044-line divergence. The worker caught it and re-cut from `a5f5b5e` itself. **Verify the base before trusting an isolated worktree.**

---

## The standing safety constraint remains

**NO live order-confirmation forwarding to ShopperBot** until Lane D's slice is integrated and proven. Forwarding one today would create a spurious shop and spend a model call.

---

## LANE B1 — answer learning. **The seam is better than the establishment it was given.**

**Line numbers re-pinned at `a5f5b5e`:** the break is `runPipeline.js:811`, **not `:641`** — Lane A moved everything ~170 lines. `applies_going_forward: false` is `:810`.

**Do NOT re-read `rendered_candidates[callback_index]`, as the establishment proposed.** `decideAnswer` has already run **three lines earlier in the same loop** (`runPipeline.js:855`), and its `shop_decision` row carries `decision_kind`, `decided_regular_id` **and** `forward_intent`. **Derive `resolution` from that row** — one call to `shopDecisions.findDecisionForQuestion`, covering the tap path **and** the Terra path with the same code. `decided_regular_id` is a real FK, so a fabricated id is refused by the database rather than by hope.

**Mutation plan.** Vehicle: `pipeline/answerJourney.test.js` — real `runPipeline`, real `recordAnswerLearning` against `test/harness.js:218`'s fake client, **only the model stubbed**. (1) tap a resolver-sourced candidate → assert an `enrichRegular … add_aka` op carrying the photographed wording and `suppression.prevents_repeat === true`; (2) mutate back to `{kind:'none'}` → must go RED, **verifying `git diff` is non-empty before trusting it**; (3) a Terra answer with `forward_intent:'no'` → assert **no** alias op and `one_week_only` set, then mutate the gate to unconditional → must go RED; (4) a label-only candidate → audit row, no alias, reason reported; (5) restore and re-run both suites.

**Baselines at `a5f5b5e`:** pipeline **290/0**, outcome **193 pass / 1 skipped**.

### 🔶 A GENUINE PRODUCT DECISION — WARWICK'S, and B1 cannot be implemented without it

**`forward_intent` can never reach the tap path.** Enumerated repo-wide: its only writer is Terra (`deps.js:498` → `runPipeline.js:898`). `shopDecisions.resolveExactCandidate` (`:294-329`) returns `decision_kind` / `decided_regular_id` / `interpreted_by` **only**, and the **16-byte `callback_data` budget is already spent**. So **every button tap has `forward_intent = NULL`, permanently.**

Warwick's constraint is that a one-off answer must **not** become a standing rule, while explicit forward intent may. A tap expresses neither. So:

- **(a)** alias on any resolved `regular_id` — reaches the acceptance criterion, but **writes durable household state from no stated intent**;
- **(b)** gate on `=== 'yes'` — only typed answers can ever teach; **taps never close B1**;
- **(c) RECOMMENDED** — gate on `!== 'no'`, and an explicit this-week-only answer additionally sets `one_week_only: true`. That flag is **already honoured** at `buildAnswerLearning.js:330` and `promoteDecision.js:264` and is **set by no caller today**. Satisfies Warwick's constraint literally, keeps taps able to teach, and **fabricates nothing.**

`applies_going_forward` stays hard `false` in all three. **Do not touch `planner.js:1091`** — that is Lane B's separate cross-week question.
