# AsdAIr — live readiness evidence, 2026-08-10

**Assembled by Larry between 00:40 and 01:20 on 2026-08-10, while Warwick slept and two Keel
instances built.** Every line below was **executed**, not recalled. Where something is inference
rather than measurement, it says so.

**Why this file exists.** Warwick's instruction was *"fix all the bugs so the runtime is ready to
accept a real order… I expect to wake to a system that is ready to do a shop for real."* This is the
evidence for that claim, gathered in one place so Veritas can grade it and a fresh Larry can trust
it without re-deriving it.

---

## 1. The live journey, proven on Warwick's real household data

`SHOP-2026-08-09`, read from `asdair.pipeline_command` (`kind='outbox'`, all `status='done'`):

| Time (UTC) | Card | Generation | What it proves |
|---|---|---|---|
| 17:31:26 | `receipt` | `#0` | the photo was received |
| 17:34:34 | `progress` / `transcribing` | `#0` | interpretation started |
| 17:36:03 | `plan_ready` / `plan.q` | `#0` | a plan was produced and **needed decisions** |
| 17:36:04 | `question` ×2 | `#0` | **questions actually reached his phone** |
| 22:24:34 | `confirm_interpretation` | `#0` | the interpretation gate fired |
| 00:07:51 | `plan_ready` / `plan.q` + `question` | `#1` | **round 2**, with `parent_question_id` lineage |
| **00:18:03** | **`plan_ready` / `plan.ok`** | **`#0`** | **`READY_TO_SHOP` — the card Warwick was owed** |

**The durable decisions behind it** (`asdair.shop_decision`, shop 7):

| id | kind | item | interpreted_by | model |
|---|---|---|---|---|
| 1 | `existing_regular` | — | `human` | — (a button: **zero model calls**) |
| 2 | `clarification_required` | — | `terra` | `gpt-5.6-terra` (**it refused to guess**) |
| 3 | `new_item` | oven gloves | `terra` | `gpt-5.6-terra` |

**Provenance is truthful** — `human` for the button, `terra`/`gpt-5.6-terra` for the model. That was
a defect earlier in the day (`interpreted_by: 'terra'` was hard-coded while `reason` ran) and it is
now the real value.

## 2. The notification storm — bounded, understood, and stopped

**21 `clarification_deferred` rows, generations `#0` through `#20`**, one per pass at ~65-second
intervals, last at **00:05:42**. None since.

**The mechanism, established from the rows rather than assumed.** The full key is:

```
outbox:1:clarification_deferred:SHOP-2026-08-09:clarification_deferred.q8f8d3866#20
```

- `question_key` is `q8f8d3866` and `question_round` is **1**. `keys.js:272` returns a bare
  `q<digest>` at round 1 — **the round never appears as a literal `#N`**, and `outboxKeyFor` →
  `commandKeyFor` (`keys.js:287-302`) appends nothing either.
- **So the `#N` is the LEDGER GENERATION, and the family was stable all along.** The defect was that
  a **new generation of a stable family was minted every pass**, because each previous generation
  reached `done` and a spent generation frees the family to be issued again.

> **⚠️ This corrects Larry's own diagnosis in `WO-2026-08-10-B15-04`, which blamed "an incrementing
> round suffix on `held.question_key`". That was wrong, and it was wrong twice — once in the original
> order and once in the amendment. It was corrected to Keel with the rows above before any code was
> changed on the false premise.** *Every other card family sat at generation `#0` or `#1`. Only this
> one ran to `#20`, which is what localises the defect to the generation-minting and not to keys.*

## 3. Runtime, recovery and the surfaces the shop depends on

| Thing | State | How it was established |
|---|---|---|
| AsdAIr runtime | **running**, `live`, armed, pid 36440, lock held | `ensure-asdair-runtime.mjs --status` |
| Entry point | `C:\Fusion247PKA\services\asdair\pipeline\runtime.js` | same — **the canonical repo path, not a worktree** |
| Reboot recovery | **proven** — `MyPKA-AsdAIr-Runtime` `State: Ready`, last run 01:17:43 local, `LastResult 0` | `Get-ScheduledTaskInfo`; that task is what started the current process |
| Fusion gateway (Terra) | **reachable** — `HTTP 401` on `/v1/models` in 0.18 s | `curl`. 401 is the correct unauthenticated answer; **no model call was spent to prove it** |
| AsdAIr Chrome profile | **running**, 359 MB, CDP on `127.0.0.1:9222`, Chrome 150 | `netstat`, `/json/version` |
| ASDA session | an **ASDA Regulars page is open** — an authenticated surface | `/json/list`. **Inference, not proof:** a live login was NOT tested, because Warwick's 2026-08-04 ruling bars live-account testing without fresh authority and he was asleep |

## 4. Estate test baseline at `99a3383` — counts, not exit codes

`pipeline 371/371` · `skill 327 run, 325 pass, 0 fail` · `bot 165/165` · `handoff 114/114` ·
`packet 109/109` · `reconcile 106/106` · `browser-runner 75/75` · `intake 34/34` ·
`governor 521/521`.

*The Wayfinder recorded 7 `skill` failures from an absent `pg`; there are now **0**.*

## 5. Shops — disposed through the audited route, executed by the runtime

Cancel **intent** was recorded via `commands.cancelShop`, which *records* and lets the runner perform
the transition — the system's own "exactly one place moves a shop's status" design. **The live
runtime then executed all four**, confirmed by its own `advanced … to: CANCELLED` events.

| Shop | Was | Why |
|---|---|---|
| `SHOP-PRACTICE-2026-07-28` | `WAITING_FOR_BROWSER` | July practice relic |
| `SHOP-RUNNERPROOF-2026-07-28` | `WAITING_FOR_BROWSER` | runner-proof fixture |
| `SHOP-2026-08-03` | `WAITING_FOR_BROWSER` | abandoned; `permission denied for table shopping_lists` |
| `SHOP-2026-08-10` | `NEEDS_DECISION` | **spurious** — created from Warwick's typed *answer* also being ingested as a list |

**`SHOP-2026-08-09` was deliberately left untouched at `READY_TO_SHOP`.** Active shops: **5 → 1**.

**Parked, not fixed:** three `browser_build_request` rows remain non-terminal (`running`/`queued`) on
those cancelled shops. They are **inert** — `store.js` excludes terminal shops from the pass — and
there is no designed command to release a stale claim. Changing them would have meant hand-written
SQL against the household database at 01:00 for no gain. **Recorded for Warwick's decision.**

## 6. Convergence

**16 worktrees → 3** (`main`, plus the two live build worktrees). **No branch was deleted and no
commit was lost:** three branches carried commits existing *only on this machine* — 
`build-015/four-lane-execution-view` (9), `build-020/wo-readiness-validator` (6),
`build-020/4f-control-cost-evidence` (3) — and **all were pushed to `origin` before any worktree was
removed.**

**Local `main` was 88 commits ahead of `origin/main` and existed only on this laptop.** It is now
also on `backup/2026-08-10-local-main-safety`. **The main push and the merge remain Warwick's gate
and were not taken.**

## 7. What is NOT claimed

- **No basket has been built.** Nothing touched a trolley, ASDA, or a payment surface.
- **The browser operation itself is unproven tonight.** Its mechanics were proven on 2026-07-28
  (`browser-runner/EXPERIMENT-RESULT.md`), and the **live** route is the supervised
  Claude-in-Chrome path, not the CDP runner, which remains deferred by Warwick's ruling.
- **Nothing here is a Veritas verdict.** This is evidence submitted for assurance, and Larry does
  not grade his own work.
