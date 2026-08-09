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
