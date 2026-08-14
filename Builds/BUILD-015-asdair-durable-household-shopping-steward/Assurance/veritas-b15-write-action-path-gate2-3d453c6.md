---
build: BUILD-015
scope: phase-write-action-path
gate: 2

boundary: >
  The completed AsdAIr write/action path as an accepted USER JOURNEY — Mum's Cockpit can send a
  shopping list and Warwick is told. Promised outcome: "The entire AsdAIr input-ingestion journey is
  working correctly end-to-end and reaches the browser stage in the real production path", plus
  "A page whose SEND button says it cannot send yet is not a finished product." Accepted functional
  scope: the four numbered feature requirements at
  Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:2371-2376, plus the two closeout
  blockers at :2305-2334 and the supervisor/recovery change Warwick directed be inspected.

reviewed_sha: 3d453c6807e794ec85f0107fd5dab427fe257081
governance_sha: 3d453c6807e794ec85f0107fd5dab427fe257081
branch: main
remote_reachable: false

evidence_method: mixed — live runtime (primary) + source read at the reviewed head. No export, no worktree.
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\6b147a85-fd06-4294-bf71-d171357401f2\scratchpad
worktree_head_at_start: 3d453c6807e794ec85f0107fd5dab427fe257081
worktree_head_at_end: 154f2ffcf9dbbf4d7f50fae86e6aeb21b3d25286
worktree_status_clean: true
head_moved_during_review: true

review_ceiling: NONE NAMED IN THE DISPATCH — contract Method 1b applied.

verdict: HOLD
receipt_sha256: d17f329f9376677a63b51992a250965177ed12cfb0853f9b9bb931cfea1c4c33
reviewed_by: veritas
reviewed_date: 2026-08-14
next_review_trigger: >
  ONE focused confirmation of the blocking findings — live display names measured at 300x512, one
  genuine submission from the Fire with the raw outcome captured, and the real ShopperBot message
  arriving. NEVER the head moving.
---

## Scope reviewed

**In scope — the scope Veritas determined, which is wider than the dispatch.** The complete AsdAIr
write/action path as an accepted USER JOURNEY: Mum opens `shopping.html` on her Fire HD 8, chooses
from her regulars, adds something else and has it sense-checked, taps SEND, sees today's date,
confirms, receives one of four settled outcomes, and Warwick is notified. Plus the two closeout
blockers the active map states may not be absent from a close (`:8710` supervision · the integrated
head reaching the remote), and the supervisor/recovery change Warwick explicitly directed be
inspected as part of this build.

**The dispatch named five Work Packages (WP-B15-48/49/50/51/52). It did not name the FOUR numbered
functional requirements that are the accepted scope** — the map's own feature table at
`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:2371-2376`, which records Warwick's four
verbatim feature requests. **Widened to those four and recorded here**, per contract §"Scope is
Veritas's to widen". The Work Packages are the means; the four requirements are the promise.

**Deliberately NOT in scope:** estate-wide Git archaeology; the vision/interpretation pipeline
upstream of `receiveList`; Codex's PR/release gate; the six superseded parallel lanes.

## Accepted requirements

Included on a Gate 2 receipt because the accepted scope carries numbered functional rows. The
user-outcome rule binds by REQUIREMENT TYPE, not by gate: every row below is stated in user-facing
terms, so none may PASS on backend or component evidence.

| # | Requirement (Warwick's four, as the map records them) | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | *"Add something else"* works, and **sense-checks against existing regulars to ensure it is genuinely new** | **HOLD** | Executed live through the real proxy: `POST /api/asdair/check-item {"text":"bananas"}` → `{"ok":true,"status":"matched","matched_name":"Bananas","matched_regular_id":60,"already_on_list":false}`. Route is on the production allowlist (`/asdair/health` lists `POST /asdair/check-item`). | **No human has performed the add on a real device.** The soft keyboard at 512×300 is unreproducible in headless Chromium by the builders' own statement. **Suite test 92 — "AC1+AC2: all 109 real regulars, each by its own alias" — SKIPPED in the submitted state** (`# SKIP SKIPPED - no disposable target`), so the sense-check has not been executed against the full real catalogue. |
| 2 | SEND shows **today's date and a confirm**, so she cannot submit by accident **and the shop gets a date** | **HOLD** | Confirm path present in the served bytes; `list_date` travels as an assertion and the server owns the date (`cockpitIntake.js:341-359,417`) — the correct resolution of the wrong-clock hazard on a Fire tablet. | **The confirm screen has never been tapped by a person.** Vera's PASS is Chromium at her viewport sizes, and Vera's own scope caveat says NOT Silk and NOT her tablet. Warwick's Fire/Silk success predates this surface. |
| 3 | **ShopperBot notification to Warwick when Mum submits** | **HOLD** | Production caller confirmed: `httpApi.js:522` dispatches `receiveList`, then `:539` calls `notifyShopper.notifySubmission` — fired by the real submission event, ordered so it can never fail her submission. No Larry in the path. | **THE REAL SEND HAS NEVER FIRED** (Larry's own label, `BUILT-NOT-VERIFIED`, upheld). Additionally: **whether the RUNNING service holds `SHOPPER_CHAT_ID` is not observable from any read-only surface available at this gate** — `/asdair/health` does not report notification configuration, and `validateConfig` starts the service both when both variables are set and when both are absent. **Which of the four outcome sentences Mum will see is therefore UNKNOWN.** |
| 4 | *"the rest of the process should be as mine"* · *"I will deal with any questions through my existing process"* | **HOLD** | Genuinely satisfied in design: `receiveList` is the same channel-neutral command Telegram uses; requirement met by not building a parallel path. Verified on the live command surface — `receiveList` present among 11 commands, `read_only:false`. | **Not established against measured current state.** Three NON-TERMINAL shops are already open for household 1 (id 26 `SHOP-2026-08-11-M93` WAITING_FOR_BROWSER · id 28 `SHOP-2026-08-11-M100` RECEIVED · id 7 `SHOP-2026-08-09` READY_TO_SHOP). Mum's submission creates a **fourth**. The current-shop rule (`readWorkspace.js:41-43` — non-terminal first, then `updated_at DESC`) will make her new shop current and **displace shop 26 from the operator surface while it sits in WAITING_FOR_BROWSER**. What "as mine" does from that state has not been exercised. |

**Closeout items the active map states may not be absent from a close:**

| # | Item | Verdict | Evidence | Residual |
|---|---|---|---|---|
| C1 | `:8710` restart/recovery is **automatic and proven** before BUILD-015 is called durable | **HOLD** | Real and independently verified: `MyPKA-Local-Services-Live` is **Enabled**, **Ready**, `LastRunTime 14/08/2026 18:02:01`, `LastTaskResult 0`, `NextRunTime 18:17:00`, repetition **every 15 minutes** plus at-logon with `PT1M30S` delay. Windows Task Scheduler is a stable approved runtime, not Larry's session. | **The supervisor script is not reviewable at this gate.** `WorkingDirectory: C:\.fusion247\private\careerair` — inside the deny-by-default secrets store, and **this dispatch declared no `private_surface`** (GL-012 §2/§3: refuse undeclared access). **That the task manages `asdair` at all rests solely on Larry's account plus the README paragraph he wrote** — the exact input §Independence makes a HOLD. No supervisor log exists outside the private store, so *"failure must never be silent"* is unverified from here. Recovery latency is **up to 15 minutes**, during which her page serves `200` and every SEND fails — an honest bound that is nowhere stated as a product fact. |
| C2 | The integrated head reaches the remote | **HOLD** | `git branch -r --contains 3d453c6` → **empty**. `git rev-list --count origin/main..HEAD` → **58**. `origin/main` stale at `371f79f`. | Independently bars PASS under contract §Method 1: *"A head that is not remotely reachable cannot receive PASS."* Not a defect in the work — the push is a `merge-decision` for Warwick. |

## Evidence provenance

- **Reviewer home:** `C:\Fusion247PKA` on `main` — my own stable canonical home. **No export was taken and no worktree was created.** Question 1 asks whether the thing works in the real context, and for a live household service the live runtime IS that context.
- **What was inspected, and how:** the **live runtime** (`127.0.0.1:8090`, `127.0.0.1:8710`, `http://warwick-yoga`, Windows Task Scheduler) by read-only HTTP and query; **source at the reviewed head** by direct read.
- `git rev-parse HEAD` at start — `3d453c6807e794ec85f0107fd5dab427fe257081`. `git status --porcelain` — clean.
- **⚠️ `git rev-parse HEAD` at end — `154f2ffcf9dbbf4d7f50fae86e6aeb21b3d25286`. THEY DO NOT MATCH.** The repository HEAD moved **under the reviewer, mid-review**. Working tree clean at both. Recorded rather than smoothed over, per §Evidence isolation.
  - The delta is exactly one commit: `154f2ff` *"LOW-5: the stated mechanism was not the measured one - it is packing, not word count"*, touching **only** `services/cockpit/public/names.js`, **comment-only** (`git diff 3d453c6 154f2ff` — 10 insertions / 2 deletions, all inside a `//` block; `LAYOUT_SAFE_NAME = 14` unchanged).
  - **This matters because I read that exact file to derive Defect 1.** My read landed on the NEWER bytes while I believed I was at `3d453c6`. I verified the difference directly: the measured sweep table my finding rests on (`20 chars 4 lines -17px FAIL`) is **byte-identical at both heads**, so **no finding changes**. But the general rule stands — evidence gathered against a silently different state is a HOLD, and this is why the state is named rather than asserted.
  - **`public/*` is served live from disk.** A commit landing there during an assurance review is in front of Mum the moment it is written. That is a sequencing observation for Larry, not a product defect.
- **No mutation testing was performed and no live state was modified.** Specifically, **I did not kill `:8710` to test the supervisor** — that is a modification of live operational state, which this role may not make.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `npm test` (services/asdair/cockpit-api) | 0 | **431 total — 415 pass, 0 fail, 16 SKIPPED** | Green, but **not `431/431` as the dispatch stated.** The 16 skipped are all DB-backed and include **test 92**, the only test exercising all 109 real regulars by alias. |
| `curl -s http://127.0.0.1:8710/asdair/health` | 0 | n/a | `ok:true`, `read_only:false`, `command_surface_bound:true`, **`receiveList` present** among 11 commands, `database ok` (28 ms). |
| `curl POST http://127.0.0.1:8090/api/asdair/check-item -d '{"text":"bananas"}'` | 0 | n/a | `matched` · `"Bananas"` · id `60`. **Dispatch claim confirmed.** |
| `curl POST http://127.0.0.1:8090/api/asdair/list -d '{"items":[]}'` | 0 | n/a | **`400 household_missing`** — *not* `400 list_empty` as the dispatch stated. `list_empty` is returned only with `{"household":1,"items":[]}`, which is what the page sends and what `services/cockpit/README.md:134` documents. Imprecision in the dispatch, not a product defect. |
| `curl GET http://127.0.0.1:8090/api/asdair/rules` | 0 | n/a | **109 regulars, 109 with `display_name`, 0 falling back.** Dispatch claim confirmed. **Max length is 21, not 20** — `"Deodorant — Quantum"`. |
| `curl GET http://127.0.0.1:8090/api/asdair/workspace` | 0 | n/a | Current durable state, 14 shop rows — see §Current readiness. |
| `curl -o /dev/null -w %{http_code} http://warwick-yoga/shopping.html` | 0 | n/a | `200` over the tailnet. |
| `Get-ScheduledTask / Get-ScheduledTaskInfo MyPKA-Local-Services-Live` | 0 | n/a | Enabled · Ready · last result `0` · every 15 min · `WorkingDirectory C:\.fusion247\private\careerair`. |
| `git branch -r --contains 3d453c6` | 0 | n/a | **empty — head not remotely reachable.** |
| **Suites pipeline 511 · shop 121 · bot 196 · interpret 36** | — | — | **NOT EXECUTED — declared, not treated as passed.** The dispatch named no review ceiling; contract §1b then limits the allowance to binding, isolation and the primary journey. Reported as unverified rather than accepted. |
| **The primary user journey (2a)** | — | — | **NOT EXECUTED BY ANYONE.** It requires Silk on the Fire HD 8 and a real human tap. Veritas cannot perform it; executing a real submission would fabricate an acceptance event, which this role may not do. **An unexecuted primary journey is a HOLD.** |
| `scripts/ensure-local-services.mjs` | — | — | **NOT INSPECTED — access refused.** Off-repo at `C:\.fusion247\private\careerair`, no `private_surface` declared in the dispatch (GL-012). |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The four requirements are the ones Warwick actually asked for, read from his verbatim words on the map — including requirement 4, correctly satisfied by building nothing, and the ruling that Mum is never asked a question. Nothing was substituted or quietly narrowed by the builders. |
| Design fidelity | **PASS** | The shared `receiveList` seam is honoured; no parallel path was grown for Mum. Server owns the date and the client's `list_date` is a checked assertion — the right call on a device class with a wrong clock. Terminal-collision handling still refuses to invent an identity (`shopState.js:321-338`), which is the 2026-08-10 ruling intact. |
| Functional proof | **HOLD** | Every hop is proven **except the two that constitute the promise**: no human submission, and no real Telegram send. Backend correctness never substitutes for the human outcome where the outcome is the requirement. |
| Integration | **PASS** | Traced end to end below. Production callers are real; nothing on the path is reachable only from a test. |
| Durability | **HOLD** | Supervision is genuinely automated and independently evidenced as *running*, but its **asdair coverage is attested only by the gated party**, its script is unreadable at this gate, and no kill-and-revive was performed by an independent party. C2 also: the head is not remotely reachable, so *"committed somewhere"* is not durable by this estate's own definition. |
| Test quality | **HOLD** | 415 executed subtests, 0 failures — real. But the dispatch reported `431/431`, and the 16 skipped include the one test that exercises the whole real catalogue. A skipped test is not a passing test. |
| Git truth | **HOLD** | Branch and head accurately named. But: unpushed commits reported as **40**, measured **57 at start / 58 at end**; and the head moved mid-review without that being part of the submission. |
| Documentation truth | **HOLD** | `services/cockpit/README.md` is a genuinely good record of an off-repo mechanism and does the job the split demands. **But the active Wayfinder carries TWO blocks both headed `⟦ACTIVE SESSION WORK PACKAGE⟧ 2026-08-13 (CURRENT) … START HERE`** (lines 2224 and 2344) with different and incompatible contents — six parallel lanes versus the four features. A fresh Larry reading the first one starts the wrong work. |
| Residual risk | **PASS** | Genuinely the strongest part of this submission. Larry declared the real Telegram send unfired, no real submission, Chromium-not-Silk, A-15 unrun, and the unpushed head — **before being asked, and each one held up under check.** Two additions found, both minor and both named below. |
| Completed automation | **HOLD** | **Two automatic outcomes claimed. Neither is discharged.** (a) The notification IS invoked by the real production event from the real route — but the real event has never occurred and the real send has never fired, so what exists is wiring, not completed automation. (b) The supervisor runs from a stable approved runtime on a real schedule — evidenced — but its coverage of `asdair` is unverifiable here, and *observable / never silent* is unproven with no log outside the private store. |

## Production caller and journey

`shopping.html` on the Fire (static, served by the **cockpit on :8090**) → `shopping.js` `HOUSEHOLD = 1`
→ `fetch('/api/asdair/check-item')` and `fetch('/api/asdair/list')` (`shopping.js:239-247, 746-751,
862-869`) → cockpit proxy on :8090 → **AsdAIr API on :8710** → `httpApi.js:522`
`dispatchList('receiveList', spec)` → `shopStore.createOrResumeShop` → `INSERT … ON CONFLICT DO
NOTHING` on `(household_id, shop_ref)` → then `httpApi.js:539` `notifyShopper.notifySubmission` →
Telegram `@Fusion247shopperbot`.

**Every hop above is a real production caller.** Nothing on this path was reached only by a test
calling it directly.

**The one structural fact that makes this build's failure mode dangerous, and it is confirmed:** her
page is served by :8090 and every AsdAIr call proxies to :8710. **:8710 dying leaves her page
returning `200` and rendering perfectly while nothing works.** That is why C1 is not clerical.

**The final hop — her finger on the glass, and Warwick's phone lighting up — has never been
traversed.**

## Restart and durability

- **Supervision, what is proven:** the scheduled task is Enabled, ran at 18:02:01 today with result
  `0`, repeats every 15 minutes, and runs from Windows Task Scheduler — independent of any Claude
  session. That is real automation infrastructure and it is more than a callable script.
- **What is NOT proven at this gate:** that the script it runs covers `asdair`; that a failure is
  observable; that kill-and-revive works. Larry's kill test and mutation test are **builder
  evidence** — he performed them, on his own claim, and this role exists because that is not
  independent. **I did not repeat them, because killing a live service Mum may use is a modification
  of live state I have no authority to make.**
- **The honest characterisation:** supervision has moved from *absent* (proven 2026-08-13) to
  *present and independently evidenced as running*. It has **not** moved to *independently proven to
  recover the AsdAIr API*.

## Current readiness — the six mandatory items

Named because the practical effect of this gate is to decide whether Warwick may be asked for a real
human action. **The verdict is HOLD, so nothing here authorises that action.** Items 1-4 are
established and are the useful part; items 5-6 are why it is a HOLD.

1. **The exact next real event:** Mum taps `YES, SEND IT` on the Fire → `POST /api/asdair/list`
   `{household:1, list_date:"2026-08-14", items:[…], extras?:[…]}`.
2. **Measured production state (read-only, today):** 14 shop rows. **No shop exists with `shop_ref`
   `SHOP-2026-08-14`** — the latest date present is 2026-08-11. Three non-terminal shops are open
   (ids 26, 28, 7). 109 regulars, all with `display_name`.
3. **The production decision that will consume it:** `createOrResumeShop` builds
   `shop_ref = 'SHOP-' + <server date>` → `insertShopRow` → **no conflict** → `created:true`,
   `matched_by:'insert'`, `superseded_terminal_ref:null` → her page renders the *sent* outcome.
4. **State-dependent collisions:** **the 2026-08-10 trap does NOT fire today.** It needs a TERMINAL
   row on the derived ref; `collisionShopRef` would then hard-fail for want of a Telegram message id
   (`shopState.js:332-337`), and every Cockpit submission has none. **There is no terminal
   `SHOP-2026-08-14`, so the admission precondition holds — for today, and for today only.** A
   cancellation of today's shop before she sends re-arms it exactly.
5. **Has the exact event been executed?** **NO.** Never, by anyone.
6. **What establishes that the current state will admit it correctly?** Items 2-4 establish
   **admission**. They establish **nothing** about the two properties that are the actual promise:
   that an 84-year-old can complete the journey on Silk on her own tablet, and that Warwick's phone
   receives a message that has never once been sent. **UNKNOWN on both ⇒ HOLD.**

**A readiness statement names the state it rests on. This one rests on there being no shop for
today's date. When the date turns over, or if today's shop is cancelled, it no longer holds.**

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** `services/cockpit/README.md` as the only in-repo record of
  the off-repo supervisor.
- **Verified independently:** it holds, and it is a good record — it names the mechanism, the
  off-repo location, the schedule, the reason the health check asks more than "did the port answer",
  and the removed `read_only:true` branch that no test could make fail. **Documenting an off-repo
  mechanism in-repo is the correct response to the split, not a workaround for it.**
- **What his list missed:**
  - **TWO blocks on the active Wayfinder both headed `⟦ACTIVE SESSION WORK PACKAGE⟧ 2026-08-13
    (CURRENT) … START HERE`** — `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:2224` and
    `:2344`. The first directs a reader into six parallel lanes that are not the current work. Under
    root `CLAUDE.md` §Finding disposition this is the blocking kind of documentation defect: it
    points the active frontier at the wrong work.
  - The same map at `:2400` still records `"bananas"` → `unmatched_new_item`. Live behaviour is now
    `matched` (WP-B15-53 closed it). Inside a superseded block — **non-blocking**, but it is the
    literal example Larry quoted to me, and a successor reading it would be misled.
- **Active documents that would misdirect a fresh instance:** the duplicated CURRENT heading above.
  Nothing else found.
- **Closure claims since the last receipt, and the receipt behind each:** the map records
  *"the write/action path is COMPLETE and LIVE"* and *"The :8710 supervision defect is CLOSED"*
  (commit `81e0a11`). **No Veritas receipt exists behind either** — `Assurance/` contains none for
  WP-B15-48/49/50/51/52 or for supervision. **This is NOT scored as a false completion claim**, and
  the reason matters: Larry declared plainly in this dispatch that *"Veritas has gated NOTHING this
  entire build"*, the map says so too, and he brought the boundary here before asking Warwick for
  acceptance. **The gap is disclosed, not suppressed. That is the difference between a FAIL and this
  HOLD.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| 1 | **HIGH** | **The geometry gate serves a committed FIXTURE, never the live catalogue** (`shopping-geometry-check.mjs:729-731` answers `/api/asdair/rules` from `rules`/`rulesLarge`) — deliberately, for determinism. So **the 109 real `display_name` values have never been measured through it.** The gate's own sweep at 300×512 (her Fire HD 8 in portrait at 200%, the viewport Vera designated) records `20 chars → 4 lines → -17px FAIL — her first tappable item is off the screen`, and its own comments prove the cliff is decided by **how the words pack**, not by length: two 20-character names differ by a whole line. **Live data contains `"Deodorant — Quantum"` (21), `"Salt & vinegar crisp"` (20), `"Malted milk biscuits"` (20)** — at and past the measured cliff, and the em dash is a wide glyph the fixtures never contained. Warwick's warning threshold is 14 and is explicitly *"a warning, not a second hard limit"*, so live data is free to exceed it and does. **Whether any of these lands on row 0 at 300×512 is UNMEASURED.** This is the third occurrence in this build of *the gate measuring a place she is not standing*. | **blocking** — gates PASS on requirement 1 and on any claim that Mum's surface is proven at her device size. It does **not** block Warwick's SEND request on safety grounds; it means the request may put a broken first screen in front of her. **Cheapest discharge: run the existing sweep against the live 109 names.** | Larry to route |
| 2 | **MEDIUM** | **The running service's notification configuration is not observable.** `/asdair/health` reports database and command surface but says nothing about `SHOPPER_CHAT_ID`, and `validateConfig` starts happily both when both variables are set and when both are absent — the loud refusal only fires on a *half* configuration. So no read-only surface can tell whether Warwick will actually be told, and therefore **which of the four outcomes Mum sees is unknown until she sends.** | **blocking** — for requirement 3 only. | Larry to route |
| 3 | **MEDIUM** | **The supervisor is unreviewable at this gate.** `WorkingDirectory C:\.fusion247\private\careerair`, no `private_surface` declared. Its coverage of `asdair` rests solely on the gated party's account. Compounding it: **no log outside the private store**, so *"failure must never be silent"* is unproven; and **up to 15 minutes** of a silently half-working product after a crash, which no user-facing document states. | **blocking** — for the durability claim and for C1 only. Not for the SEND itself. | Larry to route |
| 4 | **MEDIUM** | **Two blocks on the active Wayfinder both claim to be the CURRENT ACTIVE SESSION WORK PACKAGE** (lines 2224, 2344). Points the frontier at the wrong work. | **blocking** — gates closure of this boundary. | Larry to route |
| 5 | **LOW** | **Four evidence-precision slips in the dispatch**, none fabricated, all overstating: `431/431` (measured 415 pass / **16 skipped**) · `max length 20` (measured **21**) · `POST /asdair/list {"items":[]}` → `list_empty` (measured **`household_missing`**; `list_empty` needs `household:1`) · `40 commits unpushed` (measured **57 / 58**). | **non-blocking** — parked to the scheduled reconciliation. Recorded because a successor review checks exactly these. | Larry |
| 6 | **LOW** | **The dispatch named no review ceiling**, no governance head, no Wayfinder path, and none of the four numbered functional requirements or their residuals — four of the seven mandatory Veritas dispatch fields. Contract §1b makes a missing ceiling an independent `HOLD`. Governance head resolved by me as `3d453c6`; scope widened and recorded. | **non-blocking** as to the product; **it is one of the grounds for this HOLD.** | Larry |
| 7 | **LOW** | **A commit landed on the reviewed repository mid-review** (`154f2ff`), touching a file served live from disk. Comment-only; no finding affected. Recorded because a reviewer's start/end heads are required to match and these do not. | **non-blocking** | Larry |

## Verdict

**HOLD** — the machinery is genuinely built, genuinely wired to the real production event, and
honestly described, but the two properties that ARE the promise are unproven: **no human has ever
completed this journey on the real device, and the notification that tells Warwick has never once
been sent** — and four independent grounds each bar PASS on their own (unexecuted primary journey ·
head not remotely reachable · missing dispatch ceiling · unmeasured live display names at her
tablet's worst viewport).

**Read this as narrowly as it is meant.** This is not a finding that the work is wrong. Goal
fidelity, design fidelity and integration all PASS on executed evidence, and the residual-risk
disclosure is the most honest this build has produced — every limitation Larry declared held up
under check, and two of the three defects I added were things his own instruments were structurally
unable to see. **What is missing is not more building. It is the human evidence that only Warwick,
Mum and a real Telegram message can supply.**

**What this HOLD gates:** any claim that this boundary is complete, durable, closed or accepted; the
PASS on the phase; Codex; merge. **What it does not gate:** asking Warwick for the real acceptance
action, once Defect 1 is discharged. **Defect 1 is the only one I would fix before putting the page
in front of her** — the rest are answered BY her doing it, not before.

**Cheapest route to a PASS-able resubmission, and it is short:** run the existing geometry sweep
against the live 109 names (Defect 1) · reconcile the duplicated CURRENT heading (Defect 4) · then
the SEND itself discharges requirements 1-4 and Defect 2 in one real event. **The push (C2) is
Warwick's `merge-decision` and is not Larry's to resolve.**

## Next review trigger

**ONE focused confirmation of the blocking findings**, on evidence that: the live display names were
measured at 300×512 · one genuine submission was made from the Fire and the raw outcome she saw was
captured · the real ShopperBot message arrived. **Not the head moving.** Not a receipt, a
documentation repair, or another comment-only commit.
