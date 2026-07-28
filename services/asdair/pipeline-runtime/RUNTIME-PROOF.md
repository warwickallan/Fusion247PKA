# BUILD-015 AsdAIr Stage 1 — runtime recovery: what was proved, and what was not

Run on **WARWICK_YOGA**, **2026-07-28**, node **v22.18.0**, branch `build-015/runtime-recovery`.

Everything below was **executed**. Re-run it yourself:

```
cd services/asdair/pipeline-runtime
npm install --omit=dev
node --test                 # 24/24
node proof/run-proofs.mjs   # 50/50
```

Latest results: **`node --test` 24/24 pass**, **`proof/run-proofs.mjs` 50/50 checks pass**.
Machine-readable evidence is written to `.proof-run/results.json` (gitignored — it is
evidence of one run, not source).

> **Nothing in this proof touched the real ShopperBot, the household database, or any
> credentials file.** The runtime proofs run against a scratch state directory and a
> stand-in entry; the pipeline proofs run against a file-durable stand-in for Postgres
> and a file-backed stand-in for Telegram that models the destructive ack honestly.
> The one place a real credential was used is `probe-pending-updates.mjs`, which calls
> `getUpdates` with **no offset** — a call Telegram treats as confirming nothing.

---

## 0. THE HEADLINE: the 2026-07-27 list is NOT waiting on the bot

This is the first thing Larry must read, and it is not good news.

| Question | Answer | Evidence |
|---|---|---|
| Is anything pending on ShopperBot? | **No — `pending_count: 0`** | `probe-pending-updates.mjs`, run twice, 2026-07-28T17:14Z and 17:15Z, identical |
| Has this receiver ever acknowledged an update? | **No** | `C:\.fusion247\asdair\shopper-intake-state.json` does not exist |
| Was any list photo downloaded? | **No** | `C:\.fusion247\asdair\shopper-media\` does not exist |
| Is there a shop in the live database from a real list? | **No** | live read-only status: the only two shops are `SHOP-PRACTICE-2026-07-28` and `SHOP-RUNNERPROOF-2026-07-28`, both other workers' synthetic proof shops |

**I did not consume it, and I can show that.** My *first* probe already returned zero, and
the probe passes no `offset`, so it cannot confirm or delete anything — run it a hundred
times and the queue is unchanged (proved by running it twice with identical output).

**The most likely explanation is Telegram's 24-hour retention.** The Bot API keeps
undelivered updates for 24 hours and no longer. A photo sent on 2026-07-27 was already
past that window by 2026-07-28T17:14Z. The alternative — that a parallel worker consumed
it earlier today through a different code path (e.g. `intake/fetch-shopper-list.js` with
its own state file) — cannot be ruled out from here, but it would have left a state file
or a media file, and neither exists.

**Larry must check this before planning live acceptance**, and Warwick will probably need
to re-send the list photo on the day.

---

## 1. A second poller refuses to start

The whole safety argument. `getUpdates` is a single-consumer, destructive-ack protocol
with no lease: two pollers do not share the stream, they race it, and the loser silently
swallows the week's list. Proved with **real processes**, not a unit test.

```
[asdair-runtime] attempt 1/3 - started pid 7124 (selftest), waiting for it to settle...
[asdair-runtime] ONLINE - pid 7124 holds the single-poller lock
[asdair-runtime] already running as pid 7124 (held) - REFUSING to start a SECOND poller
[asdair-runtime]   reason: pid 7124 is the live AsdAIr runtime
```

| Check | Result |
|---|---|
| the first launcher started a runtime and holds the lock | PASS — `{"pid":7124,"identity_verified":true}` |
| a SECOND launcher refuses rather than starting a second poller | PASS |
| the refusal did not disturb the incumbent | PASS — `{"before":7124,"after":7124}` |
| **three launchers racing from cold: exactly ONE runtime exists** | PASS — `{"started":1,"refused":2}` |
| the OS agrees: exactly one runtime process is alive | PASS — `Win32_Process count = 1` |
| the same, through the Windows task | PASS — task run twice, `0x0` both times, still exactly **1** process |

The three-way cold race is the one a naive pid file loses. The lock file is created with
`O_EXCL`, so only one racer can win; a *stale* lock is reclaimed by an atomic rename, which
likewise only one racer can win. The two losers reported
`reason: launcher pid 10384 is mid-spawn` — i.e. they saw the winner's claim, not an empty
directory.

---

## 2. Stop and restart cleanly

| Check | Result |
|---|---|
| `--stop` stops the holder and names the pid | PASS — `stopped pid 8944` |
| the lock file is removed only once the process is **provably** gone | PASS — `runtime.pid` absent |
| the stopped process is really gone | PASS — `Win32_Process count for pid 8944 = 0` |
| `--stop` on an already-stopped runtime is a clean no-op | PASS — `not running` |
| `--restart` brings it back | PASS |
| the restarted runtime is a NEW process, correctly re-identified | PASS — `{"old_pid":8944,"new_pid":14072}` |

`--stop` confirms the kill by polling the OS before clearing the lock. A failed kill
deliberately leaves the lock in place, because "lock cleared, poller still consuming" is
exactly how you end up with two.

---

## 3. A stale lock from a killed process is not a live poller

The process was hard-killed with `taskkill /F` behind the launcher's back, leaving the
lock file behind.

| Check | Result |
|---|---|
| the lock file still claims a pid after the hard kill | PASS — claims `14072` |
| status calls it **stale**, not running | PASS — *"no process with pid 14072 — a stale lock from a killed process is NOT a live poller"* |
| a start reclaims the stale lock and comes up | PASS |
| **a RECYCLED pid is not mistaken for the runtime** | PASS — *"pid 22504 exists but was created at 2026-07-28T17:06:47.5103630Z, not 1999-01-01T00:00:00.0000000Z — the pid has been REUSED"* |
| `--stop` refuses to kill the innocent process holding that recycled pid | PASS |
| …and the proof runner (which *was* that process) is still alive to say so | PASS |
| a torn / garbage lock file is stale, never believed and never fatal | PASS |

Windows recycles pids briskly. A pid-only lock fails in **both** directions: it wedges the
runtime out of ever starting, or it turns `--stop` into "kill a stranger". So the lock
binds the holder to pid **+ OS creation time + command-line fingerprint**, and all three
must match. Anything it cannot positively verify is treated as *held* — refusing to start
costs one poll interval, starting a second poller costs the list.

---

## 4. The Telegram offset survives a restart

Two genuinely separate processes, the **real** `createFileStateStore` (atomic tmp+rename),
and a Telegram stand-in that really deletes what it acks.

| Check | Result |
|---|---|
| process A handled both updates and persisted the offset | PASS — `{ "last_update_id": 102 }` on disk |
| the RESTARTED process resumed from the persisted offset | PASS — `process-A asked offset=null`, `process-B asked offset=103` |
| no update was delivered twice — nothing was reprocessed | PASS — `{"101":1,"102":1}` |
| no update was acked without being handled — **nothing silently consumed** | PASS — `{"deleted":[101,102],"handled":[101,102],"lost":[]}` |
| the restart created no second shop | PASS — one shop before, one after |

Two messages arriving on the same day are **one** week's shop by design (`shop_ref_uniq`),
so the correct answer is one shop that both messages resumed.

### 4b. A crash *before* the ack redelivers, and does not duplicate

Crash injected at the worst safe moment: work durable, offset not yet written.

| Check | Result |
|---|---|
| process A died before acknowledging update 201 | PASS — exit 137, `crashed_before_acking` |
| the offset file was therefore never written | PASS — absent |
| the fresh process was redelivered update 201 | PASS — delivered to `crash-A` and `crash-B` |
| the redelivery RESUMED the week rather than creating a second shop | PASS — `shop: 1` |
| no duplicate list, item, question, command, order or learning row | PASS |

---

## 5. FINDING 1 — a crash *after* the ack loses the list, silently

**This is a real defect, reproduced on demand. It is not in my folder, and I have not
fixed it — but it is the exact failure this work exists to prevent, arriving by a
different door.**

`runIntake` advances **and persists** the offset inside its own loop
(`services/asdair/intake/shopperIntake.js:662`), but the shop row is only written
*afterwards*, by `pollIntake` calling `commands.receiveList`
(`services/asdair/pipeline/runtime.js:125`). Between those two points the receiver has
told Telegram *"I have this message"* and has written **nothing durable**.

| Check | Result |
|---|---|
| process A acknowledged update 221, then died before writing the shop | PASS — exit 137, `crashed_after_acking_before_the_shop_row` |
| the offset file now claims 221 was handled | PASS — `{"last_update_id":221}` |
| **DEFECT REPRODUCED**: the restart created no shop, and Telegram has deleted the message | PASS — `{"shops_after_restart":0,"still_pending_on_telegram":[],"lost":[221]}` |
| …and nothing anywhere records that a list went missing | PASS — no failure event, no held offset, no error |

The window is small — milliseconds between the offset's `rename()` and the `INSERT` — but
it is precisely the window a reboot, a power cut or a `taskkill` lands in, and the loss is
**unrecoverable and silent**. The receiver's own comment claims *"belt and braces: even if
the offset file were lost … every message would RESUME its existing week"*, and that is
true — but it defends the **duplicate** direction only. There is no defence in the **loss**
direction.

The check in `run-proofs.mjs` asserts the loss, so **it will start failing the day the
ordering is fixed.** That is deliberate.

**Suggested fix (for whoever owns `intake/` and `pipeline/runtime.js`, not me):** advance
the offset only after the downstream durable write has committed — i.e. hand `runIntake` a
`commit(record)` callback it awaits before `state.write`, or move the `state.write` out of
`runIntake` and into `pollIntake` after `commands.receiveList` returns. `createOrResumeShop`'s
unique indexes already make the resulting redelivery harmless.

---

## 6. Pending work survives a restart and resumes at the right stage

Three separate processes, one file-durable database, one shop.

| Check | Result |
|---|---|
| process A created the shop and parked it at the human gate | PASS — `SHOP-2026-08-03=RECEIVED` |
| a fresh process read the pending command from durable state and advanced **one** step | PASS — `RECEIVED -> PROCESSING` |
| another fresh process resumed at the **correct next** stage, not from the beginning | PASS — `PROCESSING -> READY_TO_SHOP` |
| three restarts produced exactly ONE shop and ONE list | PASS — `{"shop":1,"shopping_lists":1,"shopping_list_items":3}` |
| the list items were written once, not once per restart | PASS — `{"after_B":3,"after_C":3}` |

The command that got the shop past the human gate went through the **same** command
surface Telegram and the Cockpit use — no back door into the state machine.

---

## 7. A FAILED shop resumes from the recorded failure boundary

Planning was made to throw, so the shop failed at a specific, real boundary.

| Check | Result |
|---|---|
| the shop is FAILED and carries a durable failure event naming where it fell over | PASS — `{"status":"FAILED","resume_from":"PROCESSING","last_error":"proof: planning deliberately failed"}` |
| **a restart does NOT auto-retry a failed shop** — it waits to be told | PASS — `step: "wait:retry"`, `stepped: false` |
| the retry resumed to EXACTLY the recorded boundary, not to the start | PASS — `{"recorded_from_status":"PROCESSING","resumed_to":"PROCESSING"}` |
| the whole failure/retry cycle still produced one shop and one list | PASS |

The resume target is read from the durable failure event, never asserted by the caller —
so a restart cannot smuggle a shop back into a stage it never reached.

---

## 8. Nothing is duplicated when the whole history is replayed

The nightmare case: the offset file is lost entirely (a restored backup, a wiped state
directory) and Telegram redelivers everything.

| Check | Result |
|---|---|
| replaying the whole history created no second shop | PASS — `{"before":1,"after":1}` |
| no duplicate list | PASS — `1` |
| no duplicate command row (the `pending_action` key index held) | PASS — `["cmd:receiveList/pending","cmd:buildShop/done","msg:plan_ready/pending"]`, all keys distinct |
| no duplicate question, order confirmation or learning row | PASS |

Across proofs 4–8 the **shop / list / item / question / answer / command / order /
learning** counts were checked after every restart. No duplicate was produced in any of
them.

---

## 9. Runtime health is visible

`node --env-file=… asdair-status.mjs` — one machine-readable document.

| Check | Result |
|---|---|
| is it running, and which process | PASS — `{"running":true,"pid":32352,"uptime_seconds":52,"identity_verified":true}` |
| where the Telegram offset has got to | PASS |
| when it last did anything, and the last error | PASS — `last_write_at`, `events_parsed:27`, `last_pass`, `last_error` |
| is there work waiting | PASS |
| a cached snapshot is written, labelled as a cache | PASS |

**Live, against the real database** (read-only, `BEGIN TRANSACTION READ ONLY`):

```json
"pending_work": {
 "available": true,
 "source": "postgres (read-only role, BEGIN TRANSACTION READ ONLY)",
 "shops_active": 2, "shops_failed": 0, "questions_open": 0,
 "commands_pending": 0, "outbox_queued": 0, "browser_requests_live": 2,
 "shops": [
  { "shop_ref": "SHOP-PRACTICE-2026-07-28",   "status": "WAITING_FOR_BROWSER" },
  { "shop_ref": "SHOP-RUNNERPROOF-2026-07-28", "status": "WAITING_FOR_BROWSER" }
 ]
}
```

### Why the health surface is assembled, not stored

The brief asked for a durable/queryable source in preference to a file. The honest answer
is that **no single source can answer all five questions**, and inventing one "runtime
status" record would create a *second* source of truth for facts that already have one. So
each fact is read from whatever already owns it, and the document says where each came
from:

| Fact | Source | Why |
|---|---|---|
| running? which pid? | **the OS process table**, cross-checked against the lock | A database heartbeat is a *claim written by a process that may since have died*. "The DB says a poller is alive" is precisely the false belief that lets a second poller start. Only the box that owns the poller can answer liveness, and only the OS can answer it truthfully. It would also have needed a migration, which Larry owns. |
| Telegram offset | **the intake's own state file** | It is already the SSOT for that number. Copying it into Postgres would give the one value that must never be wrong two homes and a window in which they disagree. |
| last activity / last error | **the runtime's own JSONL event log** | Its emissions, re-read — not re-derived. The runtime's log lines carry no timestamp, so "when" is reported as the file's `last_write_at` and labelled as exactly that. |
| **pending work** | **Postgres, read-only** | This is the durable, queryable part, and the part that genuinely belongs in a database: shops, questions, commands and the outbox survive the process and are authoritative regardless of which machine asks. |

`<state>/status.json` is written as a **cache** for cheap consumers (Cockpit, the
ShopperBot status card), stamped with `generated_at` and a `_cache` banner saying it is
not a source of truth.

---

## 10. Machine-logon recovery

The task mirrors `MyPKA-Directus-Live`, the pattern already proven to survive reboots here.

```
task               MyPKA-AsdAIr-Runtime          (TaskPath \)
execute            C:\Program Files\nodejs\node.exe
arguments          --env-file="C:\.fusion247\.env keys\shopper.env.txt"
                   --env-file="C:\.fusion247\asdair.env"
                   "C:\Fusion247PKA\services\asdair\pipeline-runtime\ensure-asdair-runtime.mjs"
trigger            MSFT_TaskLogonTrigger, delay PT30S
principal          Buggly / Interactive / Limited      (no elevation needed)
multipleInstances  IgnoreNew
executionTimeLimit PT15M      restartCount 2 / PT2M
```

| Check | Result |
|---|---|
| the task registers without elevation | PASS |
| `Start-ScheduledTask` runs it | PASS — `lastRunTime 28/07/2026 18:17:23` |
| **it reports `0x0`** | PASS — `lastTaskResult : 0x0` |
| it spawned a **detached** runtime that outlives the task | PASS — child pid 32352, parent (launcher) pid 23404, `Win32_Process count for 23404 = 0` while the child kept logging |
| the lock names the child with full identity | PASS — `{"pid":32352,"process_created_at":"2026-07-28T17:17:24.9187680Z","identity_verified":true}` |
| running the task a **second** time returns `0x0` and does **not** create a second poller | PASS — still exactly 1 runtime process |

That covers Task Scheduler → node → launcher → exclusive lock → detached child that
survives its parent, which is the entire reboot-recovery chain.

### What remains UNPROVEN

**A real reboot has not been performed.** I was told not to reboot the machine, and I did
not. `Start-ScheduledTask` exercises the same action, the same principal and the same
detachment as a logon trigger, but it does **not** prove:

- that the logon trigger itself fires (only that the action works when invoked);
- that `PT30S` is enough delay for networking/DNS on this machine at logon;
- that the credentials files are readable that early in the session;
- that the runtime tolerates whatever else starts at logon (Directus also starts then).

**Larry must do one real reboot with the task enabled and armed before this is trusted.**

### The task's current state, and why

**Registered and DISABLED**, pointing at `C:\Fusion247PKA\services\asdair\pipeline-runtime\`.

A scheduled task hard-codes an absolute path, and this branch lives in a temporary git
worktree that will be deleted. Registering it against the worktree would leave a landmine
that fails at the next logon; registering it against the canonical path **enabled** would,
before the merge, run the *old* launcher — which has no arming gate and would start a live
poller unattended. Disabled is the only honest end state.

After merge, one command each:

```powershell
Enable-ScheduledTask -TaskName MyPKA-AsdAIr-Runtime
```
```
node C:\Fusion247PKA\services\asdair\pipeline-runtime\ensure-asdair-runtime.mjs --arm
```

---

## 11. FINDING 2 — the live runtime cannot start today: `pg` is unresolvable

`preflight` catches this before anything is spawned:

```
"check": "the pipeline can resolve the 'pg' driver",
"ok": false,
"detail": "MODULE_NOT_FOUND from services/asdair/shop/ - install pg for services/asdair"
```

`services/asdair/shop/shopStore.js:166` does `require('pg')`, and node resolves that from
`shop/` upward: `shop/node_modules`, `asdair/node_modules`, `services/node_modules`,
`C:\Fusion247PKA\node_modules`. **None of them exist.** `pg` is installed only under
`services/asdair/skill/node_modules`, `interpret/`, `outcome/` and `reconcile/` — which are
not on that path.

So `node runtime.js --watch` would start and then die on its first database read. That is
someone else's folder to fix (a `package.json` + install at `services/asdair/`), so I have
not touched it — but **the runtime cannot be armed until it is fixed**, and preflight will
keep refusing until then. Installing `pg` for `services/asdair/pipeline-runtime` (which I
did do, for the status surface) does **not** fix it: node resolves from the caller.

---

## 12. Honest limits of the pipeline proofs

Proofs 4–8 run the **real** `runtime.js runOnce`, `runPipeline.js`, `stages.js`,
`commands.js`, `shopStore.js` and `runIntake` — verbatim, no re-implementation. Two things
are stood in for, and the substitution matters:

- **`pg` → `pipeline/test/fakePg.js`, made durable.** That fake models the five unique
  indexes that *are* the idempotency (`shop_ref_uniq`, `shop_inbound_uniq`,
  `shop_question_key_uniq`, `bbr_one_live_per_shop`, `pending_action_key_uniq`), and here
  its tables are serialised to a file after every mutation and re-seeded on start — so
  "the state survived the process" is a fact about a file on disk. **It does not model
  transaction ROLLBACK.** These proofs therefore establish *idempotency* and
  *resumability*, not *atomicity*. Atomicity is a property of the real Postgres and of the
  real transaction boundaries in `shopStore.js`, and is not in evidence here.
- **Telegram → `proof/fake-telegram-server.mjs`**, which models the destructive ack and
  deletes what it confirms, so a lost message is detectable. Its fidelity to the real Bot
  API is my claim, not a measurement — in particular it does **not** model the 24-hour
  retention that appears to have eaten the real list.

The runtime proofs (1–3, 9, 10) use **real** OS processes, real kills, real races, the real
Windows Task Scheduler and the real state directory. Nothing is stood in for there.
