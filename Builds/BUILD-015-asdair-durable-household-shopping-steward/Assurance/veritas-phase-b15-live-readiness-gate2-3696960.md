---
build: BUILD-015
scope: phase-b15-live-readiness
gate: 2

boundary: >
  The AsdAIr live-readiness vertical slice as Warwick defined it before sleeping,
  in his two questions: (1) is the runtime ready to accept a new photograph and
  produce a list that has taken into account all known rules, and (2) will the
  browser operation work as anticipated. Graded against the mandatory Gate 2
  question - can Warwick now do the thing this phase promised, in the real
  intended context.

reviewed_sha: 3696960d02204c027d1b086248621e777b67309e
governance_sha: 3696960d02204c027d1b086248621e777b67309e
branch: main

evidence_method: mixed - live runtime and live HTTP first, then target checkout for source tracing
evidence_workspace: n/a - no export taken
worktree_head_at_start: 3696960d02204c027d1b086248621e777b67309e
worktree_head_at_end: 3696960d02204c027d1b086248621e777b67309e
worktree_status_clean: true

remote_reachability: reviewed_sha resolves on origin at refs/heads/backup/2026-08-10-local-main-safety
review_ceiling: 45 minutes elapsed, ~150k tokens (shared with the Gate 1 receipt; not extended)

verdict: HOLD
receipt_sha256: aff0a416439dae4cc664e207daaff09041cac1bdcf335ce347aae489804bda02
reviewed_by: veritas
reviewed_date: 2026-08-10
next_review_trigger: ONE focused confirmation that Warwick can open the rendered checklist from a surface he reaches without being told a port. Nothing else.
---

## Scope reviewed

**The phase journey, in Warwick's own two questions, which are the Gate 2 question for this slice:**

1. *«Is the runtime ready to accept a new photograph and produce a list that has taken into account all known rules?»*
2. *«Will the browser operation work as anticipated?»*

Graded against the mandatory Gate 2 question — **«Can Warwick now do the thing this phase promised, in the real intended context?»** — for which component passes do not count.

**Deliberately NOT in this receipt:** per-AC functional truth (graded at Gate 1, same head, separate receipt — Gate 2 is not a re-run of Gate 1); estate convergence; anything requiring a live ASDA account, which Warwick's 2026-08-04 ruling prohibits without fresh authority and which I did not go near.

## Accepted requirements

| # | The journey question | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **1** | Can the runtime accept a **new photograph** and produce a list that has taken into account **all known rules**? | **PASS, with one named limit** | See below | live invocation of the reasoning consumer not independently observed |
| **2** | Will the **browser operation** work as anticipated? | **FAIL — not certifiable, and it should not be presented to Warwick as ready** | See below | — |

### Question 1 — the photograph and the rules

**The intake half is proven by the real event, not by a test.** On 2026-08-09/10 a photograph from Warwick travelled the whole chain on his real household data: three question cards delivered `status='done'`, a real tap became `shop_decision` id 1 with `interpreted_by='human'` and zero model calls, Terra refused to guess on one line and answered another, the interpretation gate was confirmed, and `SHOP-2026-08-09` reached `READY_TO_SHOP` at 00:18:02. I read that sequence from Larry's evidence document and corroborated the parts I could reach: the runtime is up on **this** code (`entry: C:\Fusion247PKA\services\asdair\pipeline\runtime.js`, pid 25288, mode `live`, armed, lock held, restarted 01:21:10), the database dependency answers in 221 ms, `pg` resolves from all seven calling folders, and the Telegram offset is being consumed (`last_poll: fetched, offset 171031155`). **The front door is open and being polled.**

**"All known rules" — the load-bearing part, and the previous D1 HOLD is DISCHARGED.** I traced it rather than accepting it:

- `runPipeline.js:97` imports `applyRulebook` from `../skill/rulebook.js`;
- `:168` calls it inside `planWithDecisions`, passing `rules: inputs.rules` — **the same array the deterministic planner was given**, so the two halves cannot disagree about what the rulebook says;
- `planWithDecisions` has **three** production call sites (`:707`, `:1599`, `:1735`) and no test-only hop;
- `consult` is bound to `realConsultRulebook` in the **real** `createDeps()` at `deps.js:784` — not in a stub;
- `inputs.rules` comes from `skill.loadRules()` via `realLoadPlanningInputs` (`deps.js:294`), **unfiltered**;
- and the module **throws loudly** when a rule speaks and nothing is bound, rather than skipping the judgement layer and leaving the shop looking planned.

The state Veritas found at `318e0e3` — `skill/rulebook.js` with zero production callers, and a 13-line comment claiming a consumer that did not exist — **no longer holds.** The consumer exists, is bound in the real container, and sits on the ordinary pass.

**The limit, stated rather than smoothed over:** I did not independently observe `realConsultRulebook` being *invoked* on a live pass. The evidence for that is the runtime log under `C:\.fusion247\**`, which GL-012 denies by default and for which this dispatch declared no `private_surface`. **Wiring, binding and reachability are proven by me; live invocation on Warwick's real basket is asserted by Larry's evidence document and is not independently confirmed here.** It does not change the verdict on question 1 — the production path is genuinely closed — but it is the difference between *"the rules will be applied"* and *"the rules were applied last night"*, and only the first is proven.

**So: yes.** Warwick can send a new photograph and get a list that has been through the deterministic planner, the household prose rulebook, his recorded decisions and his remembered choice, in that precedence order. The three defects he suffered last night are fixed at source and the runtime is running that source.

### Question 2 — the browser operation

**The honest answer is no, and Larry asked for the honest answer.**

Not because the browser method is unproven — its mechanics were proven on 2026-07-28 — and not because anything is broken. Because of three things, of which the first is the one that matters tonight:

1. **The artefact Warwick would shop from is rendered, served, and unreachable by him.** This is Gate 1 finding D-1 and it is decisive at journey scale. `renderChecklist` now has a real production caller and `GET /asdair/checklist` answers — I executed it and it returned the correct `not_handed_over` prose for `SHOP-2026-08-09`. But the handover card sends him the bare path `/asdair/checklist?shop=…`, the base URL is deferred in a code comment to *"Mack's to configure"*, and the Cockpit — the only AsdAIr surface he reaches from his phone — proxies `workspace`, `rules`, `packet` and `media` and **not** `checklist` (`server.mjs:394-397`). The Cockpit's own comment at `server.mjs:334` explains exactly why that matters: from his phone, `127.0.0.1` is his phone. **The last hop is Larry telling him the port.** That is the defect class this build has now paid for five times — a correct, tested producer that nothing a human touches calls — displaced one layer further out, and it is precisely what root `CLAUDE.md` § "Nothing may live only in Larry's head" forbids claiming as complete.

2. **No basket has ever been built by the ruled route.** The live writer is supervised Claude-in-Chrome (`RUNTIME-DECISION.md`, Warwick 2026-08-04), and there is deliberately **no** programmatic trigger for it. That is a correct design decision, not a gap — but it means the browser half of this phase has never executed end to end against this code, and cannot be said to work "as anticipated" on any evidence gathered tonight. What *has* improved is that the CDP arm now **refuses** rather than marking a shop `BASKET_READY` with an empty trolley (`runner.js:182`), which removes a false-success path that would have been far worse than an unproven one.

3. **It could not be certified tonight by anyone.** Live-account testing is prohibited without fresh authority. The ASDA session was inferred from an open Regulars page, never tested. **I did not touch ASDA, Chrome, CDP or any trolley, and no evidence in this receipt required it.**

**What Warwick would actually experience if he woke and tried to shop right now:** he opens Telegram, sees `SHOP-2026-08-09` ready, taps "Build ASDA basket", the next pass builds the packet and the handoff and stores the full payload, and he receives a card that says *"Your checklist — every line, the method, and what never to do: /asdair/checklist?shop=SHOP-2026-08-09"*. And then he stops, because that is not a link he can open. **He would have to ask Larry.** That is one configuration change away from being true, which is the good news; it is not true now, which is the verdict.

## Evidence provenance

- **Reviewer home:** `C:/Fusion247PKA`, branch `main`, read-only. No export taken — question 1 asks whether the thing works in the intended real context, and for a running runtime that context *is* the machine.
- **Evidence method: mixed** — source and git at the target checkout; **live runtime** (`ensure-asdair-runtime.mjs --status`, pid 25288); **live HTTP** against the read service on `127.0.0.1:8710`; the Windows scheduled-task table.
- `git rev-parse HEAD` start `3696960d02204c027d1b086248621e777b67309e`, end identical. `git status --porcelain` empty at start and end. **The working tree was not modified.**
- Reviewed head is reachable from `refs/heads/backup/2026-08-10-local-main-safety` on `origin`.
- **Not read:** `C:\.fusion247\**` beyond the two `--env-file` arguments Larry's own status command passes to node. GL-012, no declared surface.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `curl http://127.0.0.1:8710/asdair/health` | 0 | n/a | `ok:true`, `read_only:true`, ten bound command names, database dependency `ok:true` at 221 ms |
| `curl "…/asdair/checklist?shop=SHOP-2026-08-09"` | 0 | n/a | `not_handed_over` prose — correct, and correctly distinguished from `artefact_absent` |
| `ensure-asdair-runtime.mjs --status` | 0 | n/a | running · `live` · armed since 2026-08-03 · lock held · pid 25288 · entry = repo path · liveness not stalled · **`healthy:false`** (stale pre-restart `pass_failed`) · `shops_active:1` (`SHOP-2026-08-09`, `READY_TO_SHOP`) · `questions_open:1` · `browser_requests_live:3` |
| `Get-ScheduledTask MyPKA-AsdAIr-ReadService` | 0 | n/a | `State: Running`, last run 02:23:43 |
| All seven AsdAIr suites (`pipeline`, `handoff`, `packet`, `cockpit-api`, `intake`, `bot`, `browser-runner`) | 0 | **1030** | 1030 pass, 0 fail — counts in the Gate 1 receipt |
| Rulebook production chain, traced in source | — | — | closed, no test-only hop |
| Cockpit proxy route table (`server.mjs:394-397`) | — | — | `workspace`, `rules`, `packet`, `media` — **no `checklist`** |
| A live basket build | — | — | **NOT EXECUTED — prohibited.** Never claimed |
| `realConsultRulebook` on a live pass | — | — | **UNVERIFIED** — evidence under a denied private surface |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | Question 1's outcome exists. Question 2's does not yet reach the human. |
| Design fidelity | **PASS** | Nothing invented a programmatic Claude-in-Chrome trigger; the supervised-writer ruling is respected; the recompute-vs-store departure is reasoned and correct. |
| Functional proof | **HOLD** | The intake-to-`READY_TO_SHOP` journey is proven on real data. The handover-to-human journey is proven to the HTTP route and no further. |
| Integration | **HOLD** | One missing hop, named exactly: the Cockpit does not proxy `/asdair/checklist` and the card carries no absolute URL. |
| Durability | **PASS** | Runtime and read service both registered as logon tasks; artefact persisted at handover; 90-minute lease with fencing; idempotency proven across twelve and twenty passes rather than one. |
| Test quality | **PASS** | The AC1/AC2 tests reproduce the production situation rather than the imagined one — the specific property the orders demanded after a green test sat on top of a failing production path. |
| Git truth | **PASS** | Head, branch and remote reachability verified by execution. |
| Documentation truth | **HOLD** | The frontier re-cut is truthful and correctly superseding. The ACTIVE SESSION WORK PACKAGE is not — Gate 1 D-2. |
| Residual risk | **PASS** | Larry declared his residuals in advance, and the evidence document says in its own words what is *not* claimed, including that no basket has been built and that nothing in it is a verdict. That is the right shape. |
| Completed automation | **FAIL** | The checklist reaching Warwick is intended to be automatic. It is not. The final hop is *"Larry tells him the port"*, and the code says so itself. This is the named clause, at the seam the order existed to close. |

## Production caller and journey

**Question 1, end to end, all production:** Telegram photo → `pollIntake` → `shopperIntake.runIntake` → `buildShop` → pass → `runPipeline` → `planWithDecisions` → `planBasket` → **`applyRulebook` + `realConsultRulebook`** → `applyDecisionsToPlan` → `resolveRememberedChoices` → question cards → `confirmInterpretation` → `READY_TO_SHOP`. **Closed.**

**Question 2:** `READY_TO_SHOP` → *[Warwick taps "Build ASDA basket" — by design, `stages.js:89`]* → `stepQueueBrowserBuild` → `buildBrowserHandoff` → `openHandoff` (full payload persisted) → `WAITING_FOR_BROWSER` → handover card with `checklistPath` → **[NO REACHABLE SURFACE]** → `GET /asdair/checklist` → `renderChecklist`. **Open at one hop, and it is the hop the human stands on.**

## Restart and durability

Both halves of the runtime are now machine-registered rather than hand-started: `MyPKA-AsdAIr-Runtime` (proven — it started the current process) and `MyPKA-AsdAIr-ReadService` (registered tonight, state Running, installer committed rather than left in a scratchpad). **A reboot was not performed**, so the read service's survival is inferred from its trigger and its sibling's proven behaviour. Recorded, not claimed.

## Documentation contradiction scan

- The evidence document's §7 *"What is NOT claimed"* and §8 addendum are **accurate and unusually honest** — including the self-report of the governor exploit and the correction of Larry's own twice-wrong AC1 diagnosis. Nothing in it overstates.
- **What it now understates:** §8.2 still reads *"`renderChecklist` has ZERO production callers"*. True when written at 01:20; false at this head. Non-blocking — it is a dated evidence record, not an active instruction.
- Active documents that would misdirect a fresh instance: **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` lines 1172-1218** — Gate 1 D-2, blocking there and repeated here because it is the map a fresh session orients on.
- **Closure claims since the last receipt, and the receipt behind each: none.** No phase is marked PASS, no Work Package is marked closed, and `f3fd8d4` states in its own body that it is not a gate verdict. **No false completion claim found.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **J-1** | **HIGH** | The browser step cannot be certified: the checklist is rendered and served but has no surface Warwick can reach (Gate 1 D-1). **Blocks:** telling Warwick the shop is ready to run, and any claim that *"nothing is left to do his side except the browser operation."* | **blocking** | Larry |
| **J-2** | MEDIUM | No basket has been built by the ruled supervised route against this code, and none can be without fresh live-account authority from Warwick. This is a **limit to declare**, not work to dispatch. | non-blocking — declare, do not fix | Warwick's decision |
| **J-3** | LOW | Live invocation of the prose-rulebook reasoning consumer is asserted, not independently verified, because the evidence sits under a denied private surface. If Warwick wants that closed, the dispatch needs a declared `private_surface`. | non-blocking | Larry |

## Verdict

**HOLD** — **question 1 is YES**: the runtime accepts a new photograph and produces a list that has been through the household's prose rulebook, and the previously-held D1 finding is genuinely discharged on a traced production chain. **Question 2 is NOT YET**: the checklist he would shop from is rendered and served but has no surface he can reach, so the phase promise *"nothing left to do but the browser operation"* is still false by exactly one hop.

**This is the "not yet, here is why" Larry said he would rather wake Warwick to.** The remaining work is a Cockpit proxy route and an absolute URL on the card — small, bounded and well understood. Nothing here suggests the design is wrong; it suggests it stops one hop short of a person.

**Queue effect:** gates the phase PASS, closure and any "ready to shop" message to Warwick. Does **not** block safe continuation, and does not transfer the frontier.

## Next review trigger

**ONE focused confirmation that Warwick can open the rendered checklist from a surface he reaches without being told a port** — and nothing else. A receipt commit, a documentation repair or a further clerical correction is not a trigger.
