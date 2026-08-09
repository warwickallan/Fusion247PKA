---
build: BUILD-015
scope: WP-B15-3, corrections 1–5 (all five functional requirements, unnarrowed)
gate: 1

boundary: >
  Work Package WP-B15-3 — the four defects D1–D4 proven live during the 2026-08-09 shop-7 attempt,
  and the five corrections Warwick authorised to answer them. The outcome promised: Warwick can type
  a natural reply instead of tapping buttons and have it actually count, and the household's standing
  judgement rules stop being silently discarded.

reviewed_sha: 318e0e3d9f74b74f98fe8b72e3aac006c24d6139
governance_sha: b97d0e98176f8ae8abccb85db9e36d57593a544b
branch: b15-3/integration
remote_reachability: NOT REACHABLE from any ref on origin (`git branch -r --contains 318e0e3` empty;
  `git ls-remote origin` carries no such object). Local-only, on branch `b15-3/integration`.

evidence_method: mixed — target worktree (suite re-execution, source tracing) + git archive export
  (mutation testing only) + `git show main:<path>` for baseline comparison. No live runtime inspected;
  none exists for this package.
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/3f02de53-f607-4d0d-809d-cbff59a86921/scratchpad/exp
worktree_head_at_start: b97d0e98176f8ae8abccb85db9e36d57593a544b
worktree_head_at_end: a66b7df75137ea42ca07e7cafa70be536b77cc0b
worktree_status_clean: true
worktree_head_note: >
  The reviewer's home repository HEAD moved during the review, by Larry's concurrent commit a66b7df
  ("Bank INT1's return"), not by any action of this review. The working tree was clean at start and
  at end and nothing was written to it. The governing contract blob is byte-identical at both heads
  (635653add45e741c3c8bf4fa09356f434937dc82), so no governance drift occurred. The TARGET worktree
  C:/Fusion247PKA-b153-int was at 318e0e3 with an empty `git status --porcelain` at start and at end.

verdict: HOLD
receipt_sha256: 0100e9d12118f4077378c429eeba22e9b09416f5dd9ab4c0ef764a222ccd41d2
reviewed_by: veritas
reviewed_date: 2026-08-09
review_ceiling: ~45 minutes elapsed, bounded token spend. Observed and not extended.
next_review_trigger: >
  A production caller is added for services/asdair/skill/rulebook.js (requirement 3's blocking
  finding), OR the package is pushed and the real production event is exercised. NOT a moved head,
  NOT this receipt, NOT map wording.
---

## Scope reviewed

All five numbered functional requirements of the ACTIVE SESSION WORK PACKAGE
(`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` §"⭐ ACTIVE SESSION WORK PACKAGE —
WP-B15-3, corrections 1–5"), at the integrated head `318e0e3` on `b15-3/integration`. No narrowing
was applied and none was authorised.

**Deliberately not in scope:** the Gate 2 phase North Star journey; estate-wide reconciliation and
convergence; CI, PR and release acceptance; the assurance/release sequence rows.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | Free text is a first-class production input — a typed natural-language reply reaches the SAME durable question → answer → `shop_decision` → recomputation spine | **HOLD** | Chain traced and real: `main()` → `realWiring` → `runOnce` (`runtime.js:889`) → `correlateTypedAnswer` (`:926`, defined `:275`) → `deps.correlateAnswer` = `realCorrelateAnswer` (`deps.js:729`), which is gateway-bound and throws rather than falling back. `commands.js:97–106` `requireAnswerSource` genuinely throws on an unrecognised present value; the coercion defect it replaces is described accurately. `ACCEPTED_ANSWER_SOURCES` is pinned as a literal, not imported from the thing it checks. Suites re-executed: pipeline 327/327, bot 165/165 | **The real production event has never run.** No live Telegram message; Terra's prompt has never met the model. `Completed automation` unsatisfied |
| 2 | Coherent question surface — unresolved questions presented together; one typed reply may answer several where the mapping can be grounded safely | **HOLD** | Same production chain. `correlateTypedAnswer` returns an array (one entry per addressed question) and only a `high` correlation is claimed; unmapped text comes back as `unmapped_text` rather than being consumed. `runtime.js:296` — `open.length === 1` claims any answer-shaped message, as declared | As declared: with exactly one open question a genuine new list would be read as an answer. Unexecuted live |
| 3 | Terra applies the prose rulebook — relevant household rules go to the reasoning consumer AS PROSE and Terra applies the judgement | **HOLD** *(blocking finding D1)* | `services/asdair/skill/rulebook.js` (723 new lines) has **ZERO production callers.** All five exports — `applyRulebook`, `buildRulebookGrounding`, `buildRulebookPrompt`, `parseRulebookReply`, `inertRules` — are reached only from `rulebook.test.js` and `ruleConsumption.test.js`. No file in `pipeline/`, `bot/`, `interpret/`, `outcome/` or `reconcile/` imports it, by static or dynamic require. `planner.js`'s only change is a 13-line comment. The one route by which household rules actually reach Terra — `runPipeline.js` `rules: inputs.rules` and `deps.js` `'Household rules that apply:'` — **already exists on `main` unchanged** (`git show main:…` confirms both lines) | See D1. The residual declared against this requirement names only price-at-plan-time gating and does not name the missing caller |
| 4 | Uncertainty is spoken, never guessed and never silently parked | **HOLD** | Five named failure classes in `runPipeline.js:965–1065` all route to a `clarification_required` decision that opens a real round-2 question; provenance stays `interpreted_by: 'rule'` where no model decided, so a failure is never dressed as a Terra decision. Exercised by the pipeline suite (327/327) | Unexecuted live. Inherits D1 for the prose-rule half of the requirement |
| 5 | Traced to the real production caller — not "a model wired to a prompt" | **HOLD** | **The strongest requirement in the package, and it survives independent tracing.** `main()` → `realWiring` sets `wiring.verificationFor = makeVerificationFor(deps)` (`runtime.js:1159`) → `runOnce` → `queueShopCards(deps, { verificationFor })` (`:996`) → invoked at `:775` → `buildBrowserHandoff` (`runPipeline.js:1284`, which calls `buildExecutionPacket`, `buildHandoff` and `openHandoff`) and `verifyBasket` (`runtime.js:1126`). None of these is a test-only call. `requestBrowserBuild` survives only in `shop/shop-cli.js` and comments, off the runtime path | **AC6(f) independently confirmed and correctly stated:** `handoff/claim.js` stores under `progress.handoff`; `browser-runner/runner.js:128` reads `this.progress.plan`. The consuming CDP arm can still ignore the payload. Unexecuted live |

**No requirement reaches PASS, and three separate mandatory properties independently prevent it:**
the head is not remotely reachable; the real production event has never been exercised for any of
the five; and requirement 3 has no production caller at all.

## Evidence provenance

- **Suites re-executed by Veritas** in the target worktree `C:/Fusion247PKA-b153-int` at `318e0e3`.
  No `node_modules` exists there, so nothing was installed and nothing was fetched; the seven
  dependency-free suites ran as-is and the `skill` suite ran with `pg` genuinely absent, which is the
  same condition Larry measured.
- **Mutation testing performed only inside a `git archive` export** at the scratchpad path above,
  never in any repository. `git archive 318e0e3 services/asdair | tar -x -C <scratchpad>`.
- **Baseline comparison** by `git show main:<path>`, read-only.
- Reviewer's home repository: `git status --porcelain` empty at start and at end. HEAD moved by
  Larry's concurrent commit, recorded in the frontmatter rather than smoothed over.
- Target worktree: `git status --porcelain` empty at start and at end. The review left it byte-clean.
- **No live runtime was inspected, because none is running this package.** That is the honest state,
  not an omission.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `cd services/asdair/pipeline && node --test` | 0 | **327** run / 327 pass / 0 fail / 0 skipped | Matches Larry's claim exactly |
| `cd services/asdair/handoff && node --test` | 0 | **114** / 114 pass | Matches |
| `cd services/asdair/packet && node --test` | 0 | **109** / 109 pass | Matches |
| `cd services/asdair/browser-runner && node --test` | 0 | **75** / 75 pass | Matches |
| `cd services/asdair/bot && node --test` | 0 | **165** / 165 pass | Matches |
| `cd services/asdair/intake && node --test` | 0 | **34** / 34 pass | Matches |
| `cd services/asdair/reconcile && node --test` | 0 | **106** / 106 pass | Matches |
| `cd services/asdair/skill && node --test` | 1 | **281** run / 272 pass / **7 fail** / 2 skipped | Matches. Failures are `lastOrder.test.js` and `schemaCompat.test.js` (`Cannot find module 'pg'`, MODULE_NOT_FOUND) plus five `assertSafeDbTarget` assertions (`ASDAIR_DB_URL is not a parseable connection string`). All are env-shaped; none of the failing files is touched by this package's diff |
| Mutation of the CRLF-repaired control: append `const _MUTANT = { directive: 'rotate' };` to `skill/rulebook.js` **inside the export**, re-run `node --test rulebook.test.js` | 1 | 29 run / 28 pass / 1 fail | `not ok 27 - AC6: the rulebook introduces no directive value, pinned to the DB CHECK constraint` — **the control is alive.** Restored; 29/29 green again. **Larry did not disarm it.** The repair changes one token (`.split('\n')` → `.split(/\r?\n/)`); the assertion, its permitted set and its migration-derived pin are untouched |
| `git branch -r --contains 318e0e3` / `git ls-remote origin` | 0 | n/a | **Empty. The head exists nowhere but this machine** |
| Static caller enumeration for `applyRulebook`, `buildRulebookGrounding`, `buildRulebookPrompt`, `parseRulebookReply`, `inertRules` across all of `services/` | 0 | n/a | **Zero non-test consumers** |
| `git show main:services/asdair/pipeline/runPipeline.js` / `deps.js` | 0 | n/a | `rules: inputs.rules` (line 1045) and `'Household rules that apply:'` (line 448) **already present on `main`** |

**Every count Larry reported was independently reproduced and every one matched.** On this package's
own history — a file that stopped loading and took its tests with it — that was worth checking, and
it held.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | Requirements 1, 2, 4 and 5 build genuinely toward "type a natural reply and have it count". Requirement 3 — the half that answers *"stop telling me which aerial every bloody week"* — has no production caller, so the half of the promised outcome about the household's standing judgement rules is not delivered by this package |
| Design fidelity | **PASS** | No directive type, grammar, registry or DSL was added; asserted against a CHECK-constraint literal held outside the module and proven live by mutation. Correlation and interpretation are kept as separate steps. `openHandoff` over `requestBrowserBuild` matches the recorded ruling |
| Functional proof | **HOLD** | Real production path proven **reachable by static trace** for 1, 2, 4, 5; **never executed** for any of them. Not proven at all for 3 |
| Integration | **HOLD** | Requirement 5's wiring is genuine and independently confirmed — this is the package's best work. Requirement 3 is unintegrated. AC6(f) is a real open seam in the consuming arm |
| Durability | **HOLD** | **The head is not on any remote.** Per contract §Method 1 a head not remotely reachable cannot receive PASS; work that has not left Larry's machine is not delivered. No kill-and-revive was possible or claimed |
| Test quality | **PASS with one recorded gap** | The AC6 control turns red when the capability is removed and green when restored — mutation-tested by Veritas, not taken on report. Test counts honest. Gap: the four new `fakePg` statement handlers carry no committed regression test (D2, non-blocking) |
| Git truth | **PASS with one recorded defect** | Branch, head, worktree and unpushed status are all reported accurately. The two commits carrying a false "orphaned worktree" premise (`a10d75d`, `6147c2d`) are corrected forward in the same reachable history at `7db892d`, and both label their content `WIP (UNVERIFIED, UNREVIEWED)`. See D3 — **it does not damage the integrity of the record** |
| Documentation truth | **HOLD** | The WP table's residual column for requirement 3 states a live behavioural consequence ("will mostly produce a reasoned question rather than a pick") that cannot occur, because nothing calls the module. A fresh session reading that row would believe the rulebook operates and is merely price-limited |
| Residual risk | **HOLD** | Four of the five requirements have honestly bounded residuals — genuinely well done, including the AC6(f) seam, which I confirmed rather than accepted. Requirement 3's residual is materially incomplete |
| Completed automation | **HOLD — MANDATORY, and unsatisfied for all five** | Root `CLAUDE.md` §"Nothing may live only in Larry's head". Green suites, a callable interface and a static caller trace evidence **capability only**. The real production event has not invoked any of it, and the outcomes are not reclassified as manual. This alone caps the package at HOLD independently of every other finding |

## Production caller and journey

**Requirement 5 — traced end to end and it holds.**
`node runtime.js --watch` → `main()` → `createDeps()` → `realWiring(deps)` sets
`verificationFor: makeVerificationFor(deps)` → `runWatch` → `runOnce` →
`queueShopCards(deps, { verificationFor })` → `verificationFor(shop)` →
`buildBrowserHandoff(deps, shop)` → `buildExecutionPacket` + `buildHandoff` + `openHandoff` →
`verifyBasket(toVerifyBasketArgs(...))`. Every hop is a real import and a real call site in
production source. None was reached only by a test.

**Requirement 1/2/4 — traced.** `main()` → `runOnce` → `correlateTypedAnswer` →
`deps.correlateAnswer` (`realCorrelateAnswer`, gateway-only, throws where no gateway is configured)
→ per-question mappings → the existing decision spine → `recordDecision`.

**Requirement 3 — there is no journey.** `skill/rulebook.js` is reached only by its own two test
files. This is the exact case the operating principle names: *"A tested function with no caller is
not a feature."*

**Where the journey stops for all five:** at the model and the wire. Nothing here has been executed
by a real Telegram message, a real shop, or a database.

## Restart and durability

`n/a` for process restart — no durable running process is claimed by this package.

**Not `n/a` for delivery durability:** `318e0e3` exists only on this machine. It is on no remote,
in no PR, and not on `main`. A disk failure or an inadvertent `git worktree remove` ends the entire
package. This is a stated property of the reviewed head, not a criticism of the work.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT / residuals:** eight residuals declared in the dispatch, all
  eight found genuine and none found to be concealment. Declaring them up front was the right call
  and made this review faster.
- **Verified independently of his list:** the AC6(f) seam (`progress.handoff` vs `progress.plan`) is
  real and correctly described. The 7 `skill` failures are genuinely env-shaped and genuinely
  untouched by the diff. The suite counts are exact. The CRLF repair is not a disarm.
- **What his list missed:** the single most consequential fact about requirement 3 — that
  `skill/rulebook.js` has no production caller of any kind, and that the household-rules-to-Terra
  path it was meant to create already existed on `main` and is unchanged. The declared residual
  ("gated on price at plan time … will mostly produce a reasoned question rather than a pick")
  describes behaviour of a module that never runs.
- **Active documents that would misdirect a fresh instance:** the WP table row 3 in
  `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`, for the reason above. Its "Delivered
  on `b15-3/integration` @ `466cba9`" column, read with its residual, asserts an operating rulebook.
- **Closure claims since the last receipt, and the receipt behind each:** none found. Larry has
  claimed no completion for this package, has stated the offline-only bar explicitly on the map, and
  has not marked WP-B15-3 complete. **That is correct conduct and is recorded as such.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D1** | **HIGH** | `services/asdair/skill/rulebook.js` and its 723 lines have **zero production callers**; all five exports are reached only from tests. Requirement 3's promised outcome — household prose rules reaching the reasoning consumer *by way of this work* — is not delivered. The route that does carry rules to Terra pre-dates this package on `main` | **blocking** — blocks any claim that requirement 3 is delivered, and blocks Gate 2 and merge for this package's requirement-3 scope. Does **not** block continued safe work on requirements 1, 2, 4, 5 or on the live-execution frontier | Larry (corrective dispatch) |
| **D2** | LOW | The four new `fakePg` statement handlers have no committed regression test; the live-writer refusal and completed-shop guard were proven only by a throwaway script | non-blocking — park to the scheduled reconciliation | Larry |
| **D3** | LOW | `a10d75d` and `6147c2d` carry a false "recovered from an orphaned worktree" premise in their messages | non-blocking. **Assessed as asked: it does not damage the integrity of the record.** Both commits label their content `WIP (UNVERIFIED, UNREVIEWED)`, the correction is committed forward at `7db892d` in the same reachable history, and no tree content is misrepresented. A reader of `git log --oneline` alone sees the false phrase; a reader of the history sees the correction. Rewriting history to erase it would be worse | Larry |
| **D4** | MEDIUM | The WP table's residual for requirement 3 asserts live behaviour ("will mostly produce a reasoned question rather than a pick") that cannot occur | non-blocking as documentation, but it is the reporting face of D1 and should be corrected in the same commit as D1's disposition, per root `CLAUDE.md` §Amendments | Larry |
| **D5** | MEDIUM | `318e0e3` is on no remote | **blocking for PASS only**, per contract §Method 1. Not blocking for continued work | Larry (Git lifecycle) |

**Nothing in this receipt meets the HOBBY BRAIN bar for interrupting Warwick.** No credential,
financial, privacy, safety, destructive-loss or irreversible-action consequence was found. D1 is a
product-completeness finding for Larry's queue, not a Warwick decision.

## Verdict

**HOLD** — four of the five corrections are genuinely built, honestly bounded and, where they claim a
production caller, traced to one that is real; but requirement 3's module has no production caller at
all, no requirement has been exercised by the real production event, and the head exists on no remote.

**What this HOLD gates:** any statement that WP-B15-3 is complete, delivered, operational or closed;
Gate 2; and Codex. **What it does not gate:** continued implementation on the live-execution frontier,
or any unrelated safe work. The frontier remains the Wayfinder's.

**Said plainly, because it is the useful sentence:** the typing half of Warwick's outcome is built
and wired and needs the wire tested; the *"stop telling me which aerial every bloody week"* half is
written and tested and connected to nothing.

## Next review trigger

A production caller for `skill/rulebook.js` (D1 corrected), **or** the real production event
exercised for the package. **One focused confirmation of the blocking findings only.** A moved head,
this receipt, a map amendment or any documentation repair is not a trigger.
