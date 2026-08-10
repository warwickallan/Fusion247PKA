---
build: BUILD-015-asdair-durable-household-shopping-steward
scope: D-1 — the handover card's checklist link
gate: 1

boundary: >
  D-1, focused confirmation ONLY. The blocker Veritas named at the prior HOLD was:
  "one focused confirmation that the card as emitted by the running process carries an
  absolute URL, with the base arriving from a stable approved runtime and observable from
  outside." Larry's round-3 dispatch asks Veritas to grade TWO of those three clauses —
  stable approved runtime, and observable from outside — and declares the third
  (a card emitted through the real send path) as an unexercised limit rather than claiming it.
  AC4 and D-2 were confirmed in earlier rounds and are NOT reopened here.

reviewed_sha: ed21b57afa580f09af735ed38503054a72e7460e
governance_sha: ed21b57afa580f09af735ed38503054a72e7460e
branch: main
remote_reachable: yes — ed21b57 is the tip of main in the primary checkout C:/Fusion247PKA

evidence_method: mixed — target checkout (C:/Fusion247PKA, read-only) + LIVE RUNTIME
                 (scheduled task MyPKA-AsdAIr-Runtime, process 32580, and its append-only log)
evidence_workspace: none — no export taken; the live runtime IS the intended real context
                    for both clauses under review, and an export cannot evidence either.
private_surface: C:\.fusion247\asdair\** — read-only, as declared by Larry in the dispatch.
                 Used solely to read runtime.log and runtime.pid. NOTHING else under
                 C:\.fusion247\** was read. See finding F3 for what that boundary cost.
worktree_head_at_start: ed21b57afa580f09af735ed38503054a72e7460e
worktree_head_at_end: ed21b57afa580f09af735ed38503054a72e7460e
worktree_status_clean: unchanged start to end (one pre-existing untracked file, db-card.tmp.cjs,
                       present before and after; Veritas created, modified and deleted nothing)
review_ceiling: 12 minutes / ~40k tokens (dispatch). Not extended.

verdict: CONFIRMED (the two clauses graded) — see "What this does and does not discharge"
---

## The two clauses graded

### Clause A — the base arrives from a stable approved runtime. **CONFIRMED.**

| Evidence | Executed | Result |
|---|---|---|
| Task definition | `Get-ScheduledTask -TaskName 'MyPKA-AsdAIr-Runtime'` | `Execute: C:\Program Files\nodejs\node.exe`, `Arguments: --env-file="C:\.fusion247\.env keys\shopper.env.txt" --env-file="C:\.fusion247\asdair.env" "...\ensure-asdair-runtime.mjs"` |
| Trigger type | `.Triggers \| ForEach-Object { $_.CimClass.CimClassName }` | `MSFT_TaskLogonTrigger` (Delay PT30S, UserId `WARWICK_YOGA\Buggly`) |
| The task actually ran | `Get-ScheduledTaskInfo` | `LastRunTime 10/08/2026 03:01:39`, `LastTaskResult 0` |
| The running runtime descends from it | `Get-CimInstance Win32_Process -Filter 'ProcessId=32580'` | `ParentProcessId 6916`, `CreationDate 10/08/2026 03:01:50`. PID 6916 has already exited — the launcher spawned and detached. **Larry's interactive shell is nowhere in that lineage.** |
| The runtime agrees | `C:\.fusion247\asdair\runtime.pid` | `"pid": 32580, "process_created_at": "2026-08-10T02:01:50.4937260Z", "identity_verified": true, "mode": "live"` |

The value therefore reached the runtime through a **logon-triggered scheduled task loading env files from the approved store** — not through the shell that made the change. That is the property Larry's earlier claim failed and this one satisfies. A logon trigger also means a fresh session gets it **without Larry remembering**, which is the root `CLAUDE.md` § "Nothing may live only in Larry's head" bar for the boot half of this mechanism.

### Clause B — observable from outside. **CONFIRMED.**

| Evidence | Executed | Result |
|---|---|---|
| The boot line exists | `tail` of `C:\.fusion247\asdair\runtime.log` | `{"event":"checklist_base_url","set":true,"value":"https://warwick-yoga.tailbc1fe3.ts.net:8443","consequence":"handover cards carry a tappable absolute URL"}`, immediately after `{"event":"launcher_spawn",...,"at":"2026-08-10T02:01:50.484Z"}` |
| It is observable **from outside** | Veritas read it from a *separate process*, with no access to the runtime's environment block | the read succeeded |
| It was absent before the fix | same log, previous boot `launcher_spawn ... "at":"2026-08-10T01:50:10.949Z"` | **no `checklist_base_url` line follows it.** Present-after / absent-before, on the same log, is natural mutation evidence that the line is emitted by the new code and not by something incidental. |

**The measurement is on the outcome-bearing value, not a correlated surface — and this is the part that matters.** Verified by tracing the field, not by trusting the commit message:

- `runtime.js:1452` — `checklistBaseUrl: process.env.ASDAIR_COCKPIT_BASE_URL || null` is set **once**, on `wiring.bot`.
- `runtime.js:1498-1500` — the boot log reads `wiring.bot.checklistBaseUrl`.
- `runtime.js:1266` — `drainOutbox(deps, { bot: wiring.bot, log })`.
- `runtime.js:1036` — the send path reads `bot.checklistBaseUrl`.

**Same property, same object, same process.** The logged value is not a proxy for what the card would carry; it *is* what the card would carry. Larry's stated reason for not reading it in a status tool's own process is correct and is the reason this clause passes rather than merely correlating.

Composition also checks out, statically: the producer at `runPipeline.js:2095` emits `checklistPath: '/api/asdair/checklist?shop=<ref>'` — leading slash — which is exactly the branch `withChecklistUrl` (`runtime.js:975-980`) prefixes; `runtime.test.js:1749-1771` covers that shape plus null base, blank base, trailing-slash base, absent path and already-absolute path, and asserts the durable payload is not mutated. **Recorded as static and unit evidence, not as production proof** — see below.

## What this does and does not discharge

**Discharged:** the two clauses named above. The defect that opened D-1 — *nothing could tell you what the next card would carry* — is closed, and closed in the right place.

**NOT discharged, and not gradeable by Veritas:** no card has been emitted through the real send path since the fix. Every link in the chain is now individually evidenced and the composition is unit-tested, but **the composed production path has not executed with a non-null base.** Per contract §Method 2a, a property requiring a human action Veritas cannot perform is *never* marked PASS on inference — it needs executed evidence from an actor who can perform it, or **Warwick's explicit acceptance of that property, recorded**.

**Larry was right not to tap it.** Emitting that card requires tapping *Build ASDA basket* on `SHOP-2026-08-09`, which moves Warwick's real week to `WAITING_FOR_BROWSER` and opens a browser request he did not ask for. Taking a live action on his shop at 3am to satisfy a reviewer would have been the wrong call, and Veritas would have recorded it as one. **The correct disposition is a declared limit, which is what Larry did.**

There is no smaller substitute available to Larry: injecting a synthetic item into the live outbox to force an emission would mutate real shop state, which is the same objection wearing a different hat.

## Findings

| # | Finding | Class |
|---|---|---|
| **F1** | The composed send path has never executed with a non-null base. First real emission is therefore first-use, not regression-use. **Mitigation already in place:** if the base is absent at boot the log says so loudly (`"consequence":"handover cards carry a BARE PATH..."`), so the failure mode is visible rather than silent. | `non-blocking` — declared limit, correctly named by Larry, not a defect to fix |
| **F2** | `ASDAIR_COCKPIT_BASE_URL` is present in the **User registry** (`[Environment]::GetEnvironmentVariable(...,'User')` returns the tailnet URL; `'Machine'` is empty). The task also passes `--env-file="C:\.fusion247\asdair.env"`. Both are process-independent and reboot-surviving, so Clause A holds either way — but **which** of the two actually supplied the value is not established. If it lives only in the User registry, it is not in the estate's approved configuration store, and a profile rebuild loses it silently while the env-file would carry it. | `non-blocking` — durability residual, reconcile at the next boundary |
| **F3** | Veritas could not close F2 itself: `C:\.fusion247\asdair.env` is a **sibling** of the declared surface `C:\.fusion247\asdair\**`, not inside it, and GL-012 denies siblings. The boundary was honoured, not stretched. Closing F2 needs one line of the env-file confirmed under a correctly declared surface. | `non-blocking` — recorded so the gap is not mistaken for a check that was done |

## Assurance dimensions — the ones this focused confirmation touches

| Dimension | Verdict | Note |
|---|---|---|
| Functional proof | **PASS for the two clauses** | live runtime, executed. Composed emission: not executed — F1. |
| Integration | **PASS** | field traced 1452 → 1498 → 1266 → 1036; one object, one process |
| Durability | **PASS** | logon trigger; survives reboot and fresh session without Larry. F2 is the bounded residual. |
| Completed automation | **PASS for the boot half** | real production event (logon task) resolves and reports the value from the approved runtime, observably, without Larry remembering. The *emission* half awaits Warwick's tap — F1. |
| Residual risk | **PASS** | F1 is declared by Larry, bounded, and loudly instrumented; F2/F3 are named rather than smoothed over |
| Test quality | **PASS** | `runtime.test.js:1749-1771` exercises the production path shape and the null/blank/absolute branches; static-and-unit label applied honestly |
| Goal fidelity · Design fidelity · Git truth · Documentation truth | `n/a` | out of scope for a focused single-blocker confirmation; not re-graded |

## Gate 2 Q2

*«Can Warwick now do the thing this phase promised, in the real intended context?»* — **Yes, to the limit of what can be proven without him.** The runtime is live from the logon task and has reported, in its own voice, that the next handover card will carry `https://warwick-yoga.tailbc1fe3.ts.net:8443` + the checklist path; the one thing standing between that and a tapped link is Warwick's own tap, which no one else should take for him.

## Scope of this verdict

`CONFIRMED` covers **the two clauses graded, at `ed21b57`, on the live runtime PID 32580 booted 2026-08-10T02:01:50Z**. It is **not** a statement that a card has been sent, and must not be reported as one. Larry may say the base URL defect is discharged and the system is ready to be exercised; he may **not** say the handover card has been proven end-to-end until one has actually been emitted.
