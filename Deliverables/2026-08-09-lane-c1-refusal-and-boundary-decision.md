# Lane C1 — Keel REFUSED the order, correctly. Finding, boundary decision, and Larry's own defect.

**2026-08-09. Governance head `d907350`.** Banked because the finding is implementation-ready and
because two of the three refusal grounds are Larry's, not the worker's.

## Verdict: REFUSE — and it was the right call

Keel refused **not on the substance**. Its words: *"the diagnosis in the order is real, the defect is
real."* It refused because the order was not produced on the required route, and because its stated
outcome is **unreachable inside the surface the order itself declared**.

## 🚨 THE FINDING — the lease mechanism is not half-built. It is FULLY built and UNWIRED.

Larry's order guessed *"the mechanism may be half-built already."* That was **half right in the wrong
direction.**

**Two complete, correct lease implementations already exist:**

- `services/asdair/handoff/claim.js` — reclaims on `progress->'_lease'->>'expires_at' < now()`, with a
  `coalesce` fallback to `claimed_at + lease_interval` then `requested_at`, so even a pre-lease legacy
  row becomes claimable. **Every write is fenced** on `claimed_by = $writer AND
  progress->'_lease'->>'runner_id' = $writer`, raising `LeaseLostError`. `expires_at` is built from the
  **database** clock, never a caller's.
- `services/asdair/browser-runner/lease.cjs` — same design, same lease key, deliberately compatible.
- `claim.test.js` already proves both halves: a live lease is **not** stealable; an expired one **is**.

**Neither is on the live path.** `handoff/claim.js` has **zero production callers** — only its own
tests, `index.js` and `mutation-proof.js`. `browser-runner/**` is excluded from the live route by
`RUNTIME-DECISION.md`.

**What actually runs in production is a SECOND, lease-less implementation** —
`pipeline/runPipeline.js:690 stepQueueBrowserBuild` → `shopStore.requestBrowserBuild` →
`services/asdair/shop/shopStore.js:148`:

```sql
UPDATE asdair.browser_build_request
SET status = 'claimed', claimed_by = $2, claimed_at = now()
WHERE shop_id = $1 AND status = 'queued'
```

**No lease. No expiry. No fencing. And `status = 'queued'` ONLY — which is exactly why rows 5 and 1,
both `running`, can never be claimed again by any code that currently runs.** `runPipeline.js:22`
admits it in its own header: *"no advisory lock, no lease and no lock file to go stale after a crash."*

**This is the estate's recurring defect pattern again: the correct thing exists, is tested, and has no
production caller — while a weaker duplicate carries the live path.**

## ⚠️ THE CUTOVER HAZARD — must be settled before any fix lands

The live path writes **no `_lease` at all** and has **no heartbeat**. Graft lease semantics onto
`shopStore.js` without simultaneously giving the real supervised runner a heartbeat and **every
genuinely-live supervised session becomes "expired" 45 seconds in and has its claim stolen** —
manufacturing the exact two-writers-on-one-trolley failure the design exists to prevent. In Keel's
framing: *"two writers on one ASDA trolley means a real household pays twice."*

**The fix must land on both sides of that seam in one change.**

## The three stranded rows — recovery must NOT be automatic

- **id 5 (shop 6) and id 1 (shop 1)** — under the `coalesce` fallback both become **instantly
  claimable** the moment lease semantics reach the live path, and would flip back to `running` under a
  new claimant while carrying six- and twelve-day-old `progress`. **The real ASDA-side trolley state
  after that long is unknown; resuming into it is unsafe.** Correct recovery returns the row to
  **`queued`** with `claimed_by = null`, preserves `progress` under a recovery marker, and records
  `last_error` naming the recovery — so re-entry is a **deliberate supervised act**.
- **id 2 (shop 2)** — **Larry's framing was wrong and Keel corrected it.** It is `queued`, so the live
  claim SQL *can* match it. It is not stranded behind a dead claim at all; it is stranded behind
  `human_reauth_required`. **Two different defects were being counted as one.**
- **Data compatibility:** rows created by `shopStore.requestBrowserBuild` insert `(shop_id, status)`
  only, so `progress` is `{}` — no `handoff` block, no `packet_fingerprint`. `completeHandoff` fences
  on `progress->'handoff'->>'packet_fingerprint'`, so it can **never complete a live-path row**. The
  two modules are **not drop-in interchangeable on existing data.**

## 🅿️ BOUNDARY DECISION — Larry's, taken 2026-08-09

**`services/asdair/shop/**` is assigned to LANE A, exclusively.** It was unassigned in both orders,
which is a collision Larry failed to prevent. Lane A needs it regardless: `shopLines.markCorrected`,
the zero-caller writer WP-B15-2 must give its first production caller, lives there.

**LANE C1 IMPLEMENTATION IS STOOD DOWN** until Lane A releases that surface. Keel established that
nothing writable inside `handoff/**` or `browser-runner/**` changes production behaviour, so there is
no honest slice to build there now. **The finding above is the design authority when C1 resumes.**
`shopStore.js:148` is explicitly **not** Lane A's to fix.

## 🔴 LARRY'S OWN DEFECT — recorded as a QUALIFIED CAPAE EXPOSURE, not glossed

**Family: "Work Order issued outside the generated envelope route."** Status at session start:
`1 occurrence · 2 of 5 clean exposures · MONITORING`. **This session is a RECURRENCE.**

Larry hand-authored **both** Work Orders (Lane A and Lane C1) without generating them through
`tools/wo/envelope.mjs` and without a `hand_authored_exception`. `SOP-022` §J1-1 makes generation
non-optional; Keel classified it **Class A — worker REFUSES**, which is exactly the control working.

**The family's recorded cause is precisely what happened:** *"The generation route is treated as
exempt for orders that feel small, amendment-shaped, or urgent."* These felt urgent — five parallel
dispatches under a directive to move fast. **The control was known, available, and skipped at the
moment of dispatch.**

Consequences beyond the refusal: the orders carried none of the envelope's mandatory fields —
`work_order_id`, `acceptance_property`, `veritas_gate`, `out_of_scope_policy`, `worker_contract`,
`## Acceptance criteria`, `## Required evidence` — and **Lane A's order went out with the same
defect**, corrected by amendment rather than by regeneration only because it was already in flight.

**No new mechanism is being built in response.** The existing route exists and works; it was not used.

## What Larry owes next

1. Regenerate the Lane C1 order through `tools/wo/envelope.mjs` **when the surface is released** — not
   before, since there is nothing deliverable meanwhile.
2. Supply, when C1 resumes, the `progress->'_lease'` content of rows 1, 2 and 5 (redacted) — Keel
   named it as materially useful and Larry did not provide it.
3. Treat the heartbeat and the claim change as **one** change spanning both sides of the seam.
