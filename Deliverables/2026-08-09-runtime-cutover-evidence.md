# AsdAIr runtime cutover onto the merged spine — evidence, 2026-08-09

**Executed by:** Larry · **Authority:** Warwick, explicit, this session (step 6 of the authorised cutover)
**Sequence:** migration 017 applied and V1–V7 PASS **first**, then the restart — Warwick's correction, and it was the right one.

---

## 1. What was done, and by which route

**The canonical production route was used, not a hand-typed command.** That matters: per
`CLAUDE.md` §"Nothing may live only in Larry's head", acceptance must exercise the real production
event rather than a manual invocation of the underlying script.

| Step | Command | Result |
|---|---|---|
| Baseline | `ensure-asdair-runtime.mjs --status --no-db` | PID **3704**, started `2026-08-08T23:38:42Z`, lock `held`, armed since 2026-08-03, `pg` resolvable from all 7 callers |
| Stop | `ensure-asdair-runtime.mjs --stop` | `stopped pid 3704`, exit 0 |
| Start | **`Start-ScheduledTask -TaskName 'MyPKA-AsdAIr-Runtime'`** | fired `18:16:44` local; `LastTaskResult 267009` (`0x41301` = *task currently running*, expected during the launcher's settle window) |
| Confirm | `ensure-asdair-runtime.mjs --status --no-db` | PID **29668**, started `2026-08-09T17:17:03.522Z`, lock `held`, `identity_verified: true`, not stalled |

**The scheduled task is the real production start path** — `ensure-asdair-runtime.mjs` with its own
registered `--env-file` arguments. Larry never handled a credential path.

## 2. ✅ PROVEN — the new process is running canonical merged bytes

Four facts, each executed:

1. **The old process is gone and a genuinely new one holds the lock.** 3704 → **29668**. The lock is
   bound to the child's full OS identity (`identity_verified: true`), so a recycled pid cannot
   masquerade as this runtime.
2. **The new process started AFTER the spine merged.**
   Spine merged `0731a94` @ `2026-08-09T17:14:47+01:00`. Process started `2026-08-09T17:17:03Z`
   (= `18:17:03` local). **~2 minutes after.**
3. **The bytes on disk ARE main's merged bytes** — not inferred from the path, checked by hash:

   | File | on disk | `HEAD:` |
   |---|---|---|
   | `pipeline/runPipeline.js` | `5b85f09e…` | `5b85f09e…` |
   | `pipeline/applyDecisions.js` | `cc83a391…` | `cc83a391…` |
   | `pipeline/shopDecisions.js` | `57c339b9…` | `57c339b9…` |

   `git status --porcelain services/asdair/` → **empty**. The tree is exactly `main`.
4. **The runtime is operating successfully against the 017 schema.** `pg_stat_user_tables` shows
   `asdair.shop_question` — the table 017 altered — scanned by the runtime **after** the restart
   (`seq_scan` 40 → 47, `last_seq_scan 17:18:19Z`), with no errors and no stall. The runtime reads
   the migrated table happily.

**Node loads its module graph at startup. The process started at `17:17:03Z` from a tree whose bytes
are provably `main`'s, therefore it loaded the merged bytes.** That chain rests on executed facts at
every link, not on "it's in the right folder".

## 3. ⛔ NOT PROVEN, AND NOT CLAIMED — the decision path has never executed

**This is the honest limit and it is not a caveat to be waved past.**

```
shop_decision   seq_scan = 5   last_seq_scan = 2026-08-09 17:13:27Z   (checked again at 17:19:15Z: STILL 5)
```

`17:13:27Z` is **before** the runtime restarted at `17:17:03Z`. Those five scans are **Larry's own
V1–V7 verification queries**, not the runtime. Across at least two watch ticks — during which
`shop_question` scans rose from 40 to 47 — **`shop_decision` was never touched.**

**Why, established rather than assumed:** all three shops sit in `WAITING_FOR_BROWSER`
(1 and 2 from July, `text`; 6 `photo`, `needs_review=true`, carrying an error). **No shop is in a
state that drives plan recomputation**, and plan recomputation is what calls
`applyDecisionsToPlan`. There is also **no boot-time schema assertion** in the live path — grep for
`schemaCompat|assertSchema` across `pipeline/*.js` and `pipeline-runtime/*.mjs` (excluding tests)
returns nothing, so start-up alone proves nothing about the decision code.

**Consequence, stated plainly:** the merged decision-reading code is *loaded* but has **never run**.
The first event that will drive it is a genuinely new shop from a genuinely new photograph. **That is
the fresh-photo acceptance, and it cannot be short-circuited.** Forcing a shop into a state that
triggers the path — or reviving shop 6 — would be exactly the manufactured provenance Warwick
prohibited.

`git grep -l shop_decision` at the pre-merge base `87342dc` returns **nothing**: the reading code
exists **only** in the merged spine. So when it does execute, that execution is itself proof the
merged bytes are live.

## 4. One incidental production confirmation worth recording

All 11 existing `shop_question` rows (shop 6, `status='answered'`) now carry **`question_round = 1`**
with `parent_question_id` NULL — acquired by the `not null default 1` at migration time.

**PRE-9 predicted exactly this on structural grounds and refused to write a query for it.** It is now
confirmed on real production rows, and no CHECK was violated: `_round_sane` (1 ≥ 1),
`_round_parent_agree` (NULL parent iff round 1) and `_not_own_parent` (NULL parent) all hold by
construction, as designed.

## 5. Verdict

**The runtime cutover is COMPLETE and the runtime is live on canonical merged bytes, operating
against the 017 schema without error.**

**The merged decision path remains UNEXERCISED.** Nothing may be reported as a working
answer-changes-the-shop capability until the fresh-photo journey runs it. **Shop 6 remains prohibited
as manufactured acceptance evidence.**
