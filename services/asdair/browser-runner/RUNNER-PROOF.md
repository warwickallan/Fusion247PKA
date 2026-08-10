# RUNNER-PROOF — what was actually run, and what it actually did

**2026-07-28.** Every number below was produced by the commands shown, against the real Supabase
database and real independent OS processes. Nothing here is inferred from reading the code.

Reproduce with [`proofkit.cjs`](./proofkit.cjs):

```
node --env-file=<env file> proofkit.cjs seed SHOP-RUNNERPROOF-2026-07-28 <plan.json>
node --env-file=<env file> proofkit.cjs show 2
node --env-file=<env file> proofkit.cjs snapshot
```

The proof runs against a **synthetic** shop (`SHOP-RUNNERPROOF-2026-07-28`, shop id 2, request id 2)
created for this purpose, so no real weekly shop is disturbed. The practice-shop record from
`EXPERIMENT-RESULT.md` (shop 1, request 1) was left untouched.

---

## Offline test suite

```
$ cd services/asdair/browser-runner && node --test
# tests 65
# pass 65
# fail 0
```

No database, no Chrome, no ASDA, no network. `pg` is required lazily, so the suite runs on a box with
nothing installed.

**Honest scope.** The offline suite proves the runner's *control flow* — claim, pause, resume,
takeover, restart, basket-ready, no-duplicate — against an in-memory fake that reproduces the lease
protocol. It does **not** prove the claim statement's atomicity: that comes from Postgres
(`for update skip locked` inside a single `update … returning`), and no in-memory fake can demonstrate
it. That is proved below, against the real database, with real concurrent processes.

---

## The plan used

Four steps, two cheap distinctive items, chosen so the two counters are separable:

| step_id | command | target |
|---|---|---|
| `s1-regular-cravendale` | `add_known_product` | `489747` Cravendale Filtered Semi Skimmed 2L (`origin: regular`) |
| `s2-search-mixed-herbs` | `select_search_result` | search `mixed herbs` → `544334` COOK by ASDA Mixed Herbs 12g (`origin: searched`) |
| `s3-qty-herbs-2` | `set_quantity` | `544334` → qty 2, via the real +/− stepper |
| `s4-read-lines` | `read_basket_line_count` | read-back |

---

## A — PAUSE

`pause` was issued **before the runner even started**, to prove directives are levels rather than
edges: a directive given while the runner was down is still obeyed when it comes up.

```
$ node runnerctl.cjs pause
pause: runner will stop issuing browser commands and hold its lease; Chrome stays open and usable
written to C:\.fusion247\asdair\runner\control.json at 2026-07-28T17:09:00.243Z

$ Start-Process node -- --env-file=… runner.js --request 2 --dry-run --lease-ms 20000 --heartbeat-ms 4000
runner pid = 23280
```

Runner log:

```
17:09:01.039Z claimed request 2 (shop 2) as asdair-browser-runner@WARWICK_YOGA#23280#aed698
17:09:01.045Z reconstructed: 4 planned, 0 already done, 4 remaining
17:09:01.180Z PAUSED - issuing no browser commands; the browser stays open and usable
```

Durable state 6 seconds later:

```
status            running
claimed_by        asdair-browser-runner@WARWICK_YOGA#23280#aed698
lease.heartbeat_at  2026-07-28T17:09:05.199009+00:00     <- still beating
lease.expires_at    2026-07-28T17:09:25.199009+00:00
lease_expired       false
completed_step_ids  []                                   <- nothing executed
runner_state        paused
```

**Result: PASS.** Paused with the lease **held and heartbeating**, zero steps executed, browser left
open and usable.

### A2 — a second runner is refused while the first holds a live lease

Run from a separate process at 17:09:07, while pid 23280 was paused and holding:

```
$ node --env-file=… runner.js --request 2 --dry-run --lease-ms 20000
17:09:07.750Z REFUSING TO RUN: no claimable request (another runner holds a live lease, or nothing is queued)
{ "outcome": "refused" }
```

`claimed_by` was still `…#23280#aed698` afterwards. **Result: PASS — never two writers.** This is the
real Postgres claim statement, not the fake.

---

## B — RESUME (no duplicate item)

```
$ node runnerctl.cjs resume
resume: runner will continue from the last durable checkpoint - already-completed steps are never repeated
```

```
17:09:08.459Z resuming from the last durable checkpoint
17:09:08.518Z [dry-run] s1-regular-cravendale add_known_product 489747
17:09:10.121Z [dry-run] s2-search-mixed-herbs select_search_result 544334
17:09:11.719Z [dry-run] s3-qty-herbs-2 set_quantity 544334
17:09:13.314Z [dry-run] s4-read-lines read_basket_line_count
17:09:14.975Z BASKET_READY - stopping here.
```

Final: `regulars_added=1`, `searched_added=1`, `completed_steps=4`, each step id present exactly once.

**Result: PASS.** Resumed from the durable checkpoint; no step executed twice.

---

## C — HUMAN TAKEOVER (lease released)

```
$ node runnerctl.cjs takeover "Warwick wants the browser"
takeover: runner will RELEASE the writing lease; no automated click can race your hand

$ node --env-file=… runner.js --request 2 --dry-run
17:09:58.523Z claimed request 2 (shop 2) as asdair-browser-runner@WARWICK_YOGA#36764#9d7e03
17:09:58.528Z reconstructed: 4 planned, 0 already done, 4 remaining
17:09:58.741Z RELEASED the writing lease (human takeover requested). The browser is yours -
              no automated clicks will race you. Request is back to 'queued' with all progress intact.
```

Durable state:

```
status            queued        <- the work still exists; it simply has no owner
claimed_by        null          <- the lease is genuinely gone
lease             null
released_reason   human takeover requested
completed_step_ids  []          <- and not one step was executed
runner_state      human_takeover
```

**Result: PASS.** The lease is released, not merely paused; the request and its plan survive intact;
zero browser commands were issued between claiming and releasing.

---

## D — STOP AT BASKET-READY

> ### ⚠️ SUPERSEDED BEHAVIOUR — 2026-08-10, WP-B15-12. The RUN below happened; it can no longer happen this way.
>
> **This section, §B's closing line, §E step 5 and §"Trolley restoration" all record `--dry-run`
> runs reaching `status complete` / `runner_state basket_ready` and moving a shop
> `WAITING_FOR_BROWSER → SHOPPING → BASKET_READY`. A dry run no longer does any of that.**
>
> **A rehearsal must not move real shop state.** A `--dry-run` against a real request used to mark
> it complete and transition a real shop to `BASKET_READY` **having issued not one browser
> command** — the purest instance of the thing Warwick required to be impossible: *"the browser must
> never claim BASKET_READY for an empty or unbuilt trolley."* A dry run has by definition built
> nothing.
>
> **Current behaviour:** a dry run ends `status queued`, `runner_state dry_run`, and the shop is
> left unchanged at `WAITING_FOR_BROWSER`. Separately, a REAL run whose basket read-back reports
> zero products now throws `EmptyBasketError` and parks the request `failed` rather than declaring
> a basket.
>
> **The properties these sections were written to prove are UNAFFECTED** — §B's no-duplicate
> property and §E's kill-and-recover property both still hold, and were re-proven green. Only the
> terminal line differs. §"Trolley restoration" is the one substantive change: a dry run now
> *releases* rather than *finishes*, so `finish` is no longer on the dry-run path.
>
> **The runs below are NOT rewritten.** They are a true record of what the runner did on the day,
> and history is not edited to make old bytes disappear. This banner states what changed and why, so
> a reader does not mistake a historical transcript for current behaviour.
>
> *Also stale and NOT caused by this change:* §"Offline test suite" records `# tests 65 / pass 65`.
> It was already stale at 78 before WP-B15-12 and is **92** as of this commit.

Reached at the end of run B:

```
17:09:14.975Z BASKET_READY - stopping here. The browser stays open on the trolley.
              Nothing is ordered, nothing is paid for.
```

```
status         complete
claimed_by     null            <- the lease is given back on completion
lease          null            <- and removed from the durable row
runner_state   basket_ready
```

Shop 2 moved `WAITING_FOR_BROWSER → SHOPPING → BASKET_READY` and no further. It did **not** reach
`ORDER_CONFIRMATION_RECEIVED` or any later stage, because the runner has no command that could take it
there.

**Result: PASS.**

---

## E — KILL THE PROCESS, RESTART IT INDEPENDENTLY

The full sequence, in one run.

**1. Start, let it get partway through:**

```
runner-1 pid = 13264
17:10:01.511Z claimed request 2 (shop 2) as asdair-browser-runner@WARWICK_YOGA#13264#feef53
17:10:01.520Z reconstructed: 4 planned, 0 already done, 4 remaining
17:10:01.676Z [dry-run] s1-regular-cravendale add_known_product 489747
17:10:03.294Z [dry-run] s2-search-mixed-herbs select_search_result 544334
17:10:04.884Z [dry-run] s3-qty-herbs-2 set_quantity 544334
```

**2. `Stop-Process -Force` (SIGKILL equivalent — no graceful release, no cleanup):**

```
runner-1 alive? False
```

**3. Durable state immediately after the kill — a dead runner still holds a LIVE lease:**

```
status              running
claimed_by          asdair-browser-runner@WARWICK_YOGA#13264#feef53
lease.expires_at    2026-07-28T17:10:19.674284+00:00
lease_expired       false
completed_step_ids  [s1-regular-cravendale, s2-search-mixed-herbs, s3-qty-herbs-2]
regulars_added      1
searched_added      1
last_successful_browser_step  set_quantity:544334
```

**4. An independent restart BEFORE the lease expires is REFUSED** — this is the important half. A
dead process must not be *assumed* dead:

```
17:10:07.378Z REFUSING TO RUN: no claimable request (another runner holds a live lease, or nothing is queued)
{ "outcome": "refused" }
```

**5. After the bounded lease elapses, a fresh independent process recovers it and continues:**

```
17:10:20.195Z claimed request 2 (shop 2) as asdair-browser-runner@WARWICK_YOGA#32708#a3e55f
17:10:20.199Z reconstructed: 4 planned, 3 already done, 1 remaining     <- reloaded from the row alone
17:10:20.331Z [dry-run] s4-read-lines read_basket_line_count
17:10:21.974Z BASKET_READY - stopping here.
```

Final state:

```
status              complete
completed_step_ids  [s1-regular-cravendale, s2-search-mixed-herbs, s3-qty-herbs-2, s4-read-lines]
regulars_added      1      <- still 1, NOT 2
searched_added      1      <- still 1, NOT 2
completed_steps     4
```

**Result: PASS.** A different process, told nothing but the request id, reconstructed the work from the
durable row, skipped the three completed steps, executed only the fourth, and the counters were not
re-incremented. The bounded lease made recovery possible **without ever permitting two writers**: 6
seconds after the kill it was still refused; 19 seconds after it was recovered.

---

## Re-authentication, proved against the real browser

Detected during this build, not simulated: the AsdAIr Chrome profile signed itself out of ASDA
mid-session (a burst of page loads drew a Salesforce `Too Many Requests` response, after which every
groceries URL began bouncing to `login.asda.com/shopper/authorise`).

A real, non-dry-run runner against the real browser:

```
$ node --env-file=… runner.js --request 2 --lease-ms 30000
17:10:57.184Z claimed request 2 (shop 2) as asdair-browser-runner@WARWICK_YOGA#27804#e047cb
17:10:57.402Z [browser] attached to Chrome/150.0.7871.129 tab DF16C504754FD64B6C8E70E3310F308A
17:11:22.044Z HUMAN RE-AUTHENTICATION REQUIRED: the store rendered its signed-out header on
              https://www.asda.com/groceries - the ASDA session has lapsed
17:11:22.044Z The runner has released the lease and will not proceed. Warwick signs in himself,
              in the browser window; the runner never sees or handles what he types.
```

```
status                 queued
claimed_by             null                     <- lease released so no click can race a human
human_reauth_required  true
released_reason        human_reauth_required
completed_step_ids     []                       <- nothing was clicked, typed or added
```

Two things worth noting:

* The detection fired on the **signed-out header**, not on a redirect. ASDA renders the groceries
  landing page perfectly normally with a `Register / Sign in` header and only bounces to
  `login.asda.com` when the trolley is touched. Detecting only the redirect would have let the runner
  start work and hit the auth wall **halfway through building a basket**. It now reports before it
  begins.
* The lease is **released** on re-auth rather than held, because the human is about to use that
  browser.

---

## Trolley restoration

**Starting state, recorded before anything:** the trolley was already empty — `0 items, £0.00` — as
left by the practice shop in `EXPERIMENT-RESULT.md` step 12.

**State now:** unchanged. Every proof above ran in `--dry-run`, which exercises the full durable path
(claim, lease, heartbeat, checkpoint, pause, resume, release, finish) and issues **no browser command
at all**. The only real-browser run was the re-authentication proof, which by definition added nothing:
it stopped before the first step, with `completed_step_ids: []`.

The runner also closed the 13 stale tabs the original experiment had left open, leaving one tab on the
profile.

**Nothing needs restoring, because nothing was changed.**

---

## State left behind

| Thing | State |
|---|---|
| Trolley | empty, `0 items £0.00` — exactly as found |
| Chrome | still running, **visible**, on the dedicated profile, port 9222 |
| Tabs | tidied from 13 stale tabs to 2 (`/groceries` and an ASDA login page) |
| Shop 1 / request 1 | untouched — the practice-shop record from `EXPERIMENT-RESULT.md` |
| Shop 2 (`SHOP-RUNNERPROOF-2026-07-28`) | `WAITING_FOR_BROWSER` — synthetic, created for this proof |
| Request 2 | `queued`, `human_reauth_required: true`, no lease held |

Request 2 is deliberately left queued rather than cancelled: that *is* the accurate state of the world
— there is a browser build request waiting on a human sign-in. Any runner that picks it up will detect
the lapsed session, report it, release the lease and stop, which is the behaviour proved above.

## Which browser actions are live-validated, and which are not

Being straight about this, because a green test suite says nothing about ASDA's DOM.

| Behaviour | Status |
|---|---|
| CDP attach to the visible dedicated profile, tab reuse, navigation, DOM read-back | **live-validated in this build** |
| Signed-out / re-authentication detection | **live-validated in this build** (it fired for real) |
| Headless refusal, URL allowlist, click deny-list, no-typing invariant | **enforced and unit-tested**; the allowlist blocked nothing legitimate in live use |
| Add by product reference, the real +/− stepper, trolley read-back | **proved in `EXPERIMENT-RESULT.md`** against the live logged-in site; the selectors here are the same ones. Not re-exercised in this build, because the session lapsed. |
| Search-and-add of an approved result | same — proved in the experiment, not re-exercised here |
| The `locate_product` fallback (find by reference through search when the bare-id URL does not resolve) | **written, unit-covered, NOT live-exercised.** It is a belt-and-braces path that only runs when the primary URL fails, which it did not do in the experiment. |

## What is NOT yet proved — and exactly what it needs

> **BLOCKED ON ONE HUMAN STEP.** The ASDA session lapsed before the live trolley proof could run.
> The runner cannot resolve that, by design.

The five scenarios above are proved at the **durable-state** level: real Postgres, real concurrent OS
processes, real kill -9, real recovery. What is **not** yet proved is those same five scenarios with
the live trolley actually changing underneath them — the browser half of A–E.

To finish it:

1. In the Chrome window on the AsdAIr profile
   (`--user-data-dir=C:\.fusion247\asdair\chrome-profile`, port 9222), **Warwick signs in to ASDA
   once.** The runner never sees or handles it, and there is deliberately no command that could.
2. Then, exactly as above but without `--dry-run`:

```
node --env-file=<env file> proofkit.cjs snapshot                    # record the starting trolley
node --env-file=<env file> proofkit.cjs seed SHOP-RUNNERPROOF-2026-07-28 <plan.json>
node --env-file=<env file> runner.js --request 2                    # A-E, driving the real trolley
node --env-file=<env file> proofkit.cjs snapshot                    # confirm, then restore to the
                                                                    # recorded starting numbers with an
                                                                    # explicit set_quantity plan
```

Restoration uses the same audited `set_quantity` path as the build, so the restore is recorded in the
same durable row rather than done by hand.
