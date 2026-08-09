---
build: BUILD-015
scope: phase-wp-b15-1-live-acceptance-journey
gate: 2

boundary: >
  The WP-B15-1 vertical slice and its North Star journey — «Can Warwick's household get a
  photographed list past the interpretation-confirmation gate, in the real intended context,
  without Larry?» — graded against Warwick's own acceptance list, Asda Build 002 §11.

reviewed_sha: d90735046081420e7d97925c55871adeafd7073b
governance_sha: d90735046081420e7d97925c55871adeafd7073b
branch: main
acceptance_record: e7ab59909a82f3c082ea0d42e19784643622ebe8 (build-015/wp-b15-1-acceptance-record)

evidence_method: mixed — live runtime (PID 3704, runtime.log, status.json, Task Scheduler) + canonical checkout at main + Larry's testimony for all database rows, labelled per row
evidence_workspace: none — no export taken; the question required the real runtime, and that is recorded rather than implied
worktree_head_at_start: d90735046081420e7d97925c55871adeafd7073b
worktree_head_at_end: d90735046081420e7d97925c55871adeafd7073b
worktree_status_clean: true

review_ceiling: ~45-60 minutes elapsed (dispatch-set); not extended
verdict: HOLD
receipt_sha256: 465e084544647befe7972dc11606f865aae3013926d1339d62685f05f6127255
reviewed_by: veritas
reviewed_date: 2026-08-09
next_review_trigger: >
  Warwick's ruling on §11 "needs_review clears", OR a second live acceptance event on a
  fingerprinted photo shop exercising §11 rows 10-11, OR a restart executed across a pending
  confirmation (§11 row 12). NEVER a receipt commit, a map correction, or any documentation move.
---

## Scope reviewed

**Gate 2 — the phase/vertical-slice journey question:** *«Can Warwick's household now get a photographed
list past the interpretation-confirmation gate, in the real intended context, without Larry?»*

In scope: the live acceptance event of 2026-08-09 against the merged boundary `d907350`, graded line by
line against **Asda Build 002 §11** (`Deliverables/2026-08-08-asda-build-002-SOURCE.md:288-312`), which is
Warwick's own written acceptance list for WP-B15-1.

Deliberately NOT in scope: re-derivation of Gate 1 (PASS, `Deliverables/2026-08-08-veritas-wp-b15-1-gate1-receipt.md`),
Keel's implementation review, the learning-loop slice (Warwick's boundary 8), estate reconciliation of the
acceptance-record branch. One receipt = one gate = one overall verdict.

**Not narrowed.** Every §11 line is graded. No older product slice was substituted.

## Accepted requirements — Asda Build 002 §11, line by line

| # | Requirement (verbatim) | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | canonical current runtime | PASS | PID 3704 cmdline `node C:\Fusion247PKA\services\asdair\pipeline\runtime.js --watch`, `CreationDate 09/08/2026 00:38:40` (Win32_Process, read by Veritas). Repo `HEAD=d907350`, `git status --porcelain` empty. Pipeline sources written `2026-08-09 00:37:59` — **before** the spawn. `launcher_spawn ... "at":"2026-08-08T23:38:40.080Z"` in `runtime.log`. `status.json`: `identity_verified:true`, `lock_state:held`, `mode:live`. `d907350` reachable from `origin/main`. | Runtime was **hand-started**; the logon-triggered path is not exercised (see Completed automation). |
| 2 | self-healing confirmation card emitted by the live production poller | PASS | Card row created `23:38:45.431Z` — **5.35 s after** PID 3704's spawn at `23:38:40.080Z` (Larry's DB testimony × Veritas's log timestamp). Two earlier runtimes (spawns at `22:55:16.885Z` and prior) passed the same shop repeatedly at step `wait:interpretation_confirmation` and queued nothing. `wait:interpretation_confirmation` predates this WP (`git log -S`, introduced `443cad4`, Stage 1), so the silent park is the old behaviour and the card is the new code's first act. No `send_failed` event anywhere in `runtime.log`. | The card row itself is Larry's DB testimony; Veritas corroborated it by timing, by five days of prior card-less passes, and by Warwick's tap arriving. |
| 3 | exactly-once/once-per-shop behaviour demonstrated | PASS | Guard `outboxEverQueued` over full outbox history, `runPipeline.js:462`. **Six** Telegram callback updates (`171031135`–`171031140`, Veritas-read from `runtime.log`) produced **one** `confirmInterpretation` row (id 22, Larry's testimony) — and one confirm-card row across five days and hundreds of passes. | The "one row" half rests on Larry's DB testimony; the "six taps" half is Veritas's own evidence. |
| 4 | real Telegram delivery | PASS | Outbox 21 `status=done`, `attempts=1`, `last_error=null`, `result={"note":"sent"}` (Larry). Zero `send_failed` in the entire 3.3 MB `runtime.log` (Veritas). A card Warwick tapped is a card that arrived. | none |
| 5 | real human tap | PASS | Six callback updates at passes 2–4, action `approve`, within 2 m 11 s of delivery; command 22 created `23:40:51.262Z`. | none |
| 6 | callback resolves through the production path | **HOLD** | **Durable half resolved; acknowledgement half failed, and the mechanism is now ESTABLISHED.** `runtime.js:285-298`: `bot.answerTap(...)` sits **inside the same `try`** as `commands.dispatch(...)`. Dispatch succeeded (proved by the gate clearing on the very next pass), then Telegram rejected the ack — so a **succeeded command was logged `tap_failed` and pushed onto `refused`**. The `catch` then calls `bot.answerTap` **again, unguarded** (`runtime.js:296-298`); its second rejection escapes `routeTaps` and fails the whole pass (`pass_failed`, passes 2 and 4). **NEW, and Larry did not have it:** this is not new to WP-B15-1 — `tap_failed … query is too old` recurs throughout `runtime.log` history under actions `build`, `retry`, `answer` (lines 511, 520, 620, 675, 880, 1095, 1286, 1305, 2020), weeks before this WP. **The human tap acknowledgement has apparently never worked in this system.** Root cause of Telegram's rejection remains UNESTABLISHED. | Blocking for this line. Household consequence: a tap never confirms visually, so a human taps repeatedly — Warwick did, six times. |
| 7 | `needs_review` clears | **HOLD** | **Not satisfied, and structurally unsatisfiable in the shipped design.** `commands.js:145-148` — set at creation, no writer afterwards, UPDATE allowlist `(status, last_error, list_id)`. The gate is cleared by `everIssued(snapshot, COMMANDS.CONFIRM_INTERPRETATION)` (`runPipeline.js:434-437`), not by the flag. Shop 6 is `READY_TO_SHOP` with `needs_review=true`. **Larry substituted the status transition for Warwick's written criterion. That substitution is Warwick's to make, not Larry's** — see Defect D1, which is the more serious half. | Blocking for this line until Warwick either accepts the substitution or orders the design changed. |
| 8 | replan occurs | PASS | `{"event":"advanced","shop_ref":"SHOP-2026-08-03","step":"act:plan","stepped":true,"to":"READY_TO_SHOP"}` — Veritas-read from `runtime.log`. Step `act:plan` means the plan actually ran; it is not a status flip. Corroborated by outbox 23 `plan_ready` `done`. | none |
| 9 | shop progresses beyond the invisible gate | PASS | Step moved from `wait:interpretation_confirmation` (held since 2026-08-03) to `act:plan` → `READY_TO_SHOP`, and has reported `wait:basket_request` on every pass since, still true at 01:02 local when Veritas read the tail of the log. | none |
| 10 | exact-source identity visible on the card | **HOLD** | `fingerprintPrefix: null`, `fingerprintAlgo: null` in the card payload (Larry). Consistent with `commands.js:163-172` — a source-image row is written only for `sourceKind==='photo'` with a supplied fingerprint, and shop 6 predates fingerprinting. The renderer's honest-absence path is by design (`runPipeline.js:475-486`). **The property is therefore unevidenced by any production event.** Veritas additionally never saw the rendered card text — even the honest absence is Larry's description. | Blocking for this line. Earliest honest proof: the next real photo shop taken after fingerprinting. |
| 11 | wrong-week comparison visible | **HOLD** | `priorShopRef: null`, `priorReceivedAt: null`, `samePhotoAsPrior: null` (Larry). `findPriorPhotoShop` returned nothing. Unevidenced in production. Note the shape of the residual: this property cannot be proven by the *first* fingerprinted shop either — it needs a **second** one. | Blocking for this line. Two further real shops are required, not one. |
| 12 | process restart/recovery does not lose the pending confirmation | **HOLD** | **Not exercised.** Veritas may not restart a live runtime. Adjacent evidence that does exist: the parked gate survived at least three process lifetimes (spawns before `22:55:16.885Z`, at `22:55:16.885Z`, at `23:38:40.080Z`) intact, and the once-per-shop guard reads full DB history so a restart cannot double-send. **What §11 names — a restart between card-sent and tap-resolved — was never performed.** A named risk found on this exact criterion: the Telegram offset advanced `171031136 → 171031140` across a pass that **failed** (`pass_failed`, pass 4), so a crash mid-batch could plausibly drop the unprocessed remainder of a fetched batch; offset-commit ordering relative to `routeTaps` was not verified within the ceiling. | Blocking for this line. |
| 13 | no Larry/manual DB command in the journey | PASS | Larry started the runtime — the one step Warwick made an explicit acceptance step (`2026-08-09-warwick-route-decision-merge-first-SOURCE.md:22`). Every row after that was written by PID 3704: card queued 5 s after spawn; command 22 written through `commands.dispatch` inside `routeTaps` (proved by the `tap_failed` catch structure, which can only be reached *after* dispatch); the transition written by `advanceAll`. | `pipeline_command.actor` was not read by Veritas. |
| 14 | no unrelated shop state corrupted | PASS (scope stated) | Veritas-read from `runtime.log`: the only other two active shops, `SHOP-PRACTICE-2026-07-28` and `SHOP-RUNNERPROOF-2026-07-28`, reported `wait:browser_runner`, `stepped:false` on every pass before, during and after the event — no transition. | Scope limit: DB-wide verification not performed (no DB access). Inactive shops are not read by the pass loop. |
| 15 | acceptance tied to the exact branch head | PASS | `HEAD=d907350` at start and end, tree clean both times; sources written `00:37:59`, runtime spawned `00:38:40`; `d907350` reachable from `origin/main`. | The acceptance **record** (`e7ab599`) is not yet on canonical main — Larry's convergence job, not a Gate 2 blocker. |
| — | *"Shop 6 is the preferred recovery proving case if safe."* | PASS | Shop 6 (`SHOP-2026-08-03`) was the case, recovered without manual intervention. | none |
| — | *"Do not manually insert the confirm command to make the evidence green."* | PASS | Command 22 is the only `confirmInterpretation` row in the table's history; created `23:40:51.262Z`, inside Warwick's tap window; the `tap_failed`-after-successful-dispatch code path independently places its authorship in the callback handler. | none |

**Nine PASS, six HOLD (rows 6, 7, 10, 11, 12 blocking their own lines), zero FAIL.**

## Evidence provenance

- **Operating home:** canonical `main` at `C:\Fusion247PKA`, `HEAD=d907350`. No export was taken: the
  question under review is whether the thing works **in the real context**, so the honest evidence is the
  live runtime and the canonical checkout, both recorded here. Contract §"Evidence isolation" expressly
  permits this and requires it be stated.
- **Live runtime inspected directly:** process table (`Win32_Process`, PID 3704), Windows Task Scheduler
  (`\MyPKA-AsdAIr-Runtime`), and `C:\.fusion247\asdair\runtime.log` + `status.json` — **read-only**, and
  named by the dispatch as the declared surface for this review.
- **Repository `git rev-parse HEAD`** — `d907350…` at start, `d907350…` at end, identical.
- **`git status --porcelain`** — empty at start and at end. The working tree was not modified.
- **No mutation testing was performed**, and no export was created. Nothing was written outside this receipt.
- **Larry's testimony, labelled as such and not as Veritas's observation:** every `shop`, `shop_event`,
  `pipeline_command` and `rule_qa_log` value in this receipt. Veritas has no MCP or database access. Where a
  row is load-bearing, Veritas corroborated it against evidence it *could* reach (log timing, process
  lifetimes, source control flow) and says so on the row.

## Evidence executed or inspected

| Command or artefact | Exit | Result |
|---|---|---|
| `git rev-parse d907350:"Team/…/AGENTS.md"` | 0 | `635653add45e741c3c8bf4fa09356f434937dc82` — contract blob bound |
| `git rev-parse HEAD` / `git status --porcelain` (start and end) | 0 | `d907350…` / empty, both times |
| `git branch -r --contains d907350` | 0 | `origin/main`, `origin/build-015/wp-b15-1-acceptance-record` — remotely durable |
| `git log -S "wait:interpretation_confirmation" -- …/stages.js` | 0 | `443cad4` (Stage 1) — the step predates this WP |
| `Get-CimInstance Win32_Process -Filter 'ProcessId=3704'` | 0 | canonical entry path, `CreationDate 09/08/2026 00:38:40` |
| `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` | 0 | 15 node processes; **PID 14376** `server.js` holding `shopper.env.txt` + `asdair.env`, started `08/08 21:55:11` |
| `schtasks /query /tn '\MyPKA-AsdAIr-Runtime' /fo LIST /v` | 0 | `Enabled`, `At logon time`, `Interactive only`, Last Run `09/08/2026 00:38:25`, Last Result `0` |
| `ls --time-style=full-iso services/asdair/pipeline/*.js` | 0 | `commands.js` / `runPipeline.js` / `telegramAdapter.js` written `00:37:59`, before the spawn |
| `runtime.log` — acceptance window and full-history `tap_failed` scan | 0 | see rows 2, 3, 6, 8, 9, 12, 14 |
| `status.json` | 0 | `identity_verified:true`, `lock_state:held`, `mode:live`, `stalled:false` |
| Live database rows | — | **UNAVAILABLE to Veritas.** Supplied as Larry's testimony and labelled on every row that uses it. |
| Rendered card text as Warwick saw it | — | **UNAVAILABLE to Veritas.** Directly why rows 10 and 11 cannot be PASS. |
| Restart between card-sent and tap-resolved | — | **NOT PERFORMED.** Live action outside Veritas's authority. Row 12 HOLD. |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | The gate that silently ate five days of a household's week was crossed by a real human tap. That is the promised outcome, and it happened. |
| Design fidelity | PASS | Distinct callback action (`approve`) not colliding with `confirm`; existing command/latch/replan path reused; no new service, framework or Cockpit surface. |
| Functional proof | HOLD | The primary journey executed end to end **once**, on a shop that cannot exercise §11 rows 10 and 11, with the acknowledgement half of row 6 failing. |
| Integration | PASS | Poller → outbox → Telegram → callback → `commands.dispatch` → ledger latch → `planOutcome` → `act:plan` → `READY_TO_SHOP` → `wait:basket_request`. Every hop reached by the production path, none by a test calling in. |
| Durability | HOLD | Row 12 not exercised; offset-advance-across-a-failed-pass is an unresolved named risk on that exact criterion. |
| Test quality | n-a | Graded at Gate 1; Gate 2 is not a re-run of Gate 1. |
| Git truth | PASS | `d907350` is what the runtime consumed and what this receipt names; remotely reachable; tree clean throughout. |
| Documentation truth | **FAIL** | Defect D1. The durable acceptance record attributes one of **Warwick's own written acceptance criteria** to Larry's framing and discharges it on that basis. |
| Residual risk | HOLD | Five §11 properties are unevidenced; the runtime's automatic start is unevidenced; a second live process holds the same bot credentials. All are now explicit — but they are not bounded, because two of them need future real shops. |
| Completed automation | HOLD | The scheduled task `\MyPKA-AsdAIr-Runtime` exists, is **Enabled**, is **At logon time**, and its last run returned `0` — better than the record claims. But this event was a **hand start**, so the production event (Warwick logs on → runtime runs → household list is served) is unexercised at this boundary; and `Logon Mode: Interactive only` means an unattended reboot serves nobody. Root `CLAUDE.md` §"Nothing may live only in Larry's head" is not yet satisfied for the runtime's own start. |

## Production caller and journey

`Task Scheduler \MyPKA-AsdAIr-Runtime` → `ensure-asdair-runtime.mjs` → spawn `pipeline/runtime.js --watch`
(PID 3704, single-poller lock held) → per-pass `advanceAll` → `runPipeline` → `planOutcome` returns
`gate.to === null` at `wait:interpretation_confirmation` → `outboxEverQueued` false → `enqueueMessage
confirm_interpretation` (id 21) → outbox sender → **Telegram, ShopperBot, Warwick's phone** → Warwick taps
"Confirm this reading" → `getUpdates` → `routeTaps` → `intentToCommand` action `approve` →
`commands.dispatch(confirmInterpretation)` writes the ledger latch (id 22) → *[`answerTap` throws here;
the pass dies]* → next pass → `everIssued(CONFIRM_INTERPRETATION)` true → `planOutcome` → `act:plan` →
`transition READY_TO_SHOP` → `plan_ready` card (id 23) → shop now parked at `wait:basket_request`.

**Every hop above was reached by the production path.** The only human in it is Warwick, tapping — plus
Larry's one hand-start of the runtime, which Warwick made an explicit acceptance step.

## Restart and durability

Required, and **not satisfied**. §11 names restart across a *pending confirmation*; that window
(`23:38:46` → `23:40:51`, 2 m 5 s) was never interrupted. What is evidenced instead is weaker and
different: the parked gate survived at least three runtime lifetimes, and the once-per-shop guard reads
durable history so a restart cannot double-send. The offset observation in row 12 pulls the other way and
is unresolved. **Do not read "the shop survived five days" as "the pending confirmation survives a
restart" — they are different states.**

## Documentation contradiction scan

- **Larry's declared residuals (7):** all seven are real, and disclosing them up front was correct.
  Residual 2's *"cause UNESTABLISHED"* is now **partly established** (row 6); residual 5 is confirmed;
  residuals 3, 4, 6, 7 hold as stated.
- **What his list missed:** (a) the `tap_failed` defect is **historic, not novel** — it predates this WP by
  weeks across three other action names; (b) the scheduled task exists, is enabled and is logon-triggered,
  which he under-claimed; (c) a second live node process (**PID 14376**) has held the ShopperBot
  credentials since `08/08 21:55` — his double-poller candidate is a **live condition**, not a hypothesis,
  though it is still not a proven cause; (d) the offset-advance-across-a-failed-pass risk; (e) **D1**.
- **Active documents that would misdirect a fresh instance:** `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`
  § "Defects and corrections observed AT the acceptance", item 2 — see D1.
- **Closure claims since the last receipt:** none. The record at `e7ab599` states *"COMPLETION IS NOT
  CLAIMED"* and *"the WP-B15-1 completion claim requires a Veritas gate against this boundary and does not
  exist yet."* **That is correct and is the reason this is a HOLD and not a FAIL.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D1 | HIGH | **The durable record misattributes Warwick's own acceptance criterion to Larry and retires it on that basis.** The map at `e7ab599` states: *"Warwick's route said 'observe `needs_review` clear'; that phrasing originated in Larry's own framing and was wrong about the design."* Searched: the phrase appears **only** in Warwick's two source mirrors — `2026-08-08-asda-build-002-SOURCE.md:300` (§11) and `2026-08-09-warwick-route-decision-merge-first-SOURCE.md:37` (verbatim, *"Nothing has been added, reordered or paraphrased"*). It appears in **no** Larry-authored artefact: not `2026-08-08-b15-proposed-aswp-01.md`, not `2026-08-08-wo-b15-01-order.md`. Warwick wrote it twice, on two days. The provenance claim is unsupported by the record, and it converts one of his acceptance criteria into Larry's own mistake — inside the very document that will orient the next session. | **blocking** — blocks the acceptance-record branch converging to main in its current wording, and blocks any PASS on §11 row 7. | Larry |
| D2 | HIGH | **A succeeded command is reported as a failed tap, and an ack failure kills the whole pass.** `runtime.js:285-298`: `answerTap` inside the dispatch `try`; the `catch` calls `answerTap` again unguarded, and that second throw escapes `routeTaps`. Compounded by the historic scan: taps have apparently **never** acknowledged in this system (`build`, `retry`, `answer`, now `approve`). For a product whose human surface is a button, this is the visible defect. | non-blocking to the phase; **blocking** for §11 row 6 | Larry (dispatch) |
| D3 | MEDIUM | **§11 rows 10 and 11 cannot be proven by shop 6 at all**, and row 11 cannot be proven by the *first* fingerprinted shop either. The earliest honest acceptance of exact-source identity is the next real photo shop; of wrong-week comparison, the one after that. This is a scheduling fact about acceptance, and it should be recorded as such rather than left to be rediscovered. | non-blocking; **blocking** for rows 10 and 11 | Larry |
| D4 | MEDIUM | **The runtime's automatic start is unproven at this boundary** and `Logon Mode: Interactive only` means no unattended recovery after a reboot without Warwick logging in. The mechanism exists and is enabled; the production event has not been exercised since the merge. | non-blocking; gates the "without Larry" half of the phase promise | Larry |
| D5 | LOW | **PID 14376 (`server.js`) has held the ShopperBot credential files since 2026-08-08 21:55.** Its script path was not resolved within the ceiling and whether it polls `getUpdates` is UNESTABLISHED. Recorded once because it is the strongest available lead on D2 — not as a conclusion. | non-blocking | Larry |
| D6 | LOW | Offset advanced `171031136 → 171031140` across a failed pass; offset-commit ordering relative to `routeTaps` unverified. Bears on §11 row 12. | non-blocking | Larry |

## Verdict

**HOLD** — shop 6 genuinely crossed the gate on the production path with no manual database command, and
that is a real first; but five of Warwick's fifteen §11 acceptance lines are unevidenced or unsatisfied,
and the acceptance record discharges one of them by attributing Warwick's own criterion to Larry.

**On the question Larry asked directly: yes.** He rationalised §11 row 7 — but the substitution is the
smaller half. The serious half is D1: the substitution was written into the durable record with a
provenance claim the record contradicts. Warwick wrote *"`needs_review` clears"* himself, in §11 on
2026-08-08 and again in his route decision on 2026-08-09. Only he can retire it. **What Larry should have
recorded is: "this criterion is unmeetable in the shipped design, here is why, and it is Warwick's call."**

**What this HOLD gates:** the WP-B15-1 completion claim, the phase PASS, and convergence of the
acceptance-record branch in its current wording. **What it does not gate:** the live runtime, shop 6's
onward progress, or Warwick's §12 handback — which should proceed, carrying these findings.

## Next review trigger

A material change to the promised outcome: Warwick's ruling on §11 row 7, **or** a second live acceptance
event on a fingerprinted photo shop that can exercise rows 10 and 11, **or** a restart executed across a
pending confirmation (row 12). **Not** a receipt commit, a map correction of D1, or any documentation move.

---

## ADDENDUM — Larry, 2026-08-09, AFTER the Gate 2 ceiling. NOT a reopened review.

**Veritas closed its receipt naming two queries it could not run, having no database reach. Larry ran
them via the Supabase connector immediately afterwards. This addendum records the answers so the
named gap does not persist. It changes NO verdict, and Veritas was NOT re-dispatched** — a receipt is
an output of a review, and correcting a gap it named does not create a new object requiring review
(root `CLAUDE.md` § "Veritas dispatch").

**Query 1 — `pipeline_command` id 22 `actor`.**
Result: **`telegram:8601328832`**. Full args: `{"note":null,"actor":"telegram:8601328832",
"command":"confirmInterpretation","shop_ref":"SHOP-2026-08-03","ledger_key":
"command:1:confirmInterpretation:SHOP-2026-08-03","household_id":"1"}`.
**Effect:** the confirm command was raised by a real Telegram principal, not a system or Larry actor.
This corroborates §11 *"real human tap"* and *"no Larry/manual DB command in the journey"* **at
database level**, where the receipt could previously rely only on Larry's testimony and the log.

**Query 2 — sweep for any `shop` or `shop_event` row touched between 23:38:00Z and 23:42:30Z outside
shop 6**, which the receipt wanted in order to close §11 row 14 at database level rather than log
level.
Result: **exactly two rows, both shop 6** — `shop` id 6 → `READY_TO_SHOP` at 23:41:55.627328+00, and
`shop_event` shop 6 → `transition READY_TO_SHOP` at the same instant. **No other shop and no other
event row changed in the window.**
**Effect:** §11 row 14 *"no unrelated shop state corrupted"* is now evidenced at database level.

**Provenance and its limit, stated plainly:** these two results are **Larry's readings via the
Supabase connector**, exactly as the receipt labels every other database row in it. They are not
Veritas's own observation, and this addendum does not convert them into one.
