---
build: BUILD-015
scope: WP-B15-08 — "An answer is not a shopping list" (AC1, AC4, AC5, AC10, AC6, AC7, AC8). AC2 and AC3 removed from scope at read-back by Larry; recorded and reported, not endorsed.
gate: 1

boundary: WP-B15-08 and the outcome it promised — that Warwick can answer a question card in free text without that answer also becoming a shopping list; that a card never claims it has no candidates while printing candidates; that a trailing pack size is never taken as the order quantity; and (AC10, amended in by Larry) that a control the system refuses is not drawn, and a refusal in our own namespace is not silently journaled.

reviewed_sha: e0667dc95134856494a4a3c95aaf22721e3fcb89
governance_sha: 37c9aef2d00e3f895f8c31ee8c3c0db7b697776b
branch: main (local only — see Evidence provenance; on no ref of the canonical remote)

evidence_method: mixed — repository working tree (read-only, suite execution), `git archive` export outside the repository (mutation testing), and a raw Telegram capture supplied as interface evidence. Live production state was NOT available and is declared unavailable by name.
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/a8a4a211-d8c2-42c1-8bb3-d7d87ba2540f/scratchpad/vx
worktree_head_at_start: 37c9aef2d00e3f895f8c31ee8c3c0db7b697776b
worktree_head_at_end: 37c9aef2d00e3f895f8c31ee8c3c0db7b697776b
worktree_status_clean: true

review_ceiling: 60 minutes elapsed across Gate 1 and Gate 2, set by the dispatch. Not extended.
remote_reachability: NOT REACHABLE — `e0667dc` is contained by no ref on `origin`. §Method 1 caps this verdict at HOLD independently of every other finding.

verdict: HOLD
receipt_sha256: d3c00e273e53943e191cede4d293ccf18b5a4da31bd5a6f2a2a9e141d97ded61
reviewed_by: veritas
reviewed_date: 2026-08-10
next_review_trigger: ONE focused confirmation of D-1, D-2 and D-3 — a real Telegram reply and a real rendered card observed through the fixed bytes, a refusal that reaches Warwick, and AC2 either delivered or durably reclassified by Warwick. NOT a moved HEAD, NOT this receipt being written or committed, NOT the push of e0667dc.
---

## Scope reviewed

**WP-B15-08 — "An answer is not a shopping list"** (`Deliverables/2026-08-10-WO-B15-08-answer-is-not-a-list.md`),
integrated at `e0667dc` on local `main`, plus Larry's AC10 amendment delivered by message and recorded
in the integration commit body.

**Graded:** AC1, AC4, AC5, AC10, AC6, AC7, AC8.

**Not graded, and why:** AC2 and AC3 were removed from scope at read-back by Larry. That removal is
recorded, but it is **not** neutral and is reported below as a blocking finding — the Work Order's own
single `acceptance_property` contains AC2 verbatim ("*and a shop created for a new inbound list is
bound to a list containing only that list's items*"), so half of the one property that was declared to
decide this Work Package was withdrawn rather than satisfied. Veritas does not widen this Gate 1 into
implementing AC2; it records that the WP's stated `outcome` and `acceptance_property` are not met.

**Scope the dispatch did not narrow:** the dispatch named every functional row and forbade narrowing.
No narrowing occurred. Gate 2 is a separate receipt.

**Requirement type.** AC1, AC4 and AC10 are stated in USER-FACING terms — what Warwick types, what he
sees on a card, and what happens when he presses a control. Under §"THE USER-OUTCOME RULE BINDS BY
REQUIREMENT TYPE, NOT BY GATE" they are graded here subject to §"GATE 2 IS NOT GATE 1 AT WIDER SCOPE"
in full. AC5, AC6, AC7 and AC8 are engineering rows and are graded on engineering evidence.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | A typed answer is never also a shopping list — a claimed reply produces exactly one durable effect and creates no shop row and no list item | **HOLD** | Engineering evidence is strong and was re-executed independently: `node --test` in the export at `e0667dc`, named test `AC1 A TYPED REPLY TO A CARD CREATES NO SHOP - the live 2026-08-10 defect` passes; mutating `if (msg.reply_to_message) {` → `if (false && msg.reply_to_message) {` in the export drove exactly that test RED (`not ok 12`, "his ANSWER was ingested as a shopping list"), restored byte-identical `656c56f1313a933095c09861349e72088c71938d2eb7d67ba28c38b93a2c85f6`. Three sibling tests pin the dangerous directions (answer still lands verbatim; uncorrelatable reply still becomes a list; reply to a settled card is not swallowed) | **BLOCKING: no real Telegram reply has traversed the fixed path.** The user-facing outcome — Warwick types an answer and does *not* receive a "Shopping list received" card — has not been observed. The integration commit states this itself ("NOT PROVEN: the real production event"). A user-facing row may not PASS on component tests, however good. §Method 2a governs the discharge |
| AC4 | A card must not contradict itself — it may not say "No candidate products found." while printing suggestions | **HOLD** | `renderMessages.js:205` now emits the "none found" line only when there are neither buttons nor a note; the Note wording switches "Also suggested" → "Suggested" when there are no buttons (`runtime.js:869-874`); three named tests in `renderMessages.test.js:546-566` including one that pins the both-absent-and-present impossibility. Bot suite 170/170 | **BLOCKING: no card rendered by the fixed code has reached Warwick.** The only rendered artefacts durably persisted for `SHOP-2026-08-10-M64` are the eight PRE-fix cards in the raw capture. Evidence of the human outcome is therefore absent, not merely thin |
| AC5 | A trailing pack size is not an order quantity (photographed path only) | **PASS** | `trailingPackSize` / `withoutTrailingPackSizes` (`runPipeline.js:497-539`), applied once at the point both source kinds converge (`:597`). Proven end-to-end through the real `runPipeline` transcribe+interpret to durable rows: `AC5 END TO END: a photographed pack size never reaches the list as a quantity` asserts `shop_line.quantity === null`, `raw_reading` preserved verbatim, `requested_qty === 1`, and that the leading-quantity line `"3 gourmet cat food"` still carries 3. Two boundary tests pin the rule's edges. Independently mutation-tested by Veritas: deleting `readings = withoutTrailingPackSizes(readings);` in the export drove `AC5 END TO END` RED (`not ok 19`), restored byte-identical `e2da098819df33fd6d200cca4363202ce8f6b4ad3a20c328f5aab6ea34de0902` | Non-blocking: no real photograph has traversed the fixed path. Non-blocking, reported once — **the TYPED path is unchanged and still defective for this case**: `skill/listNormaliser.js` reaches the opposite default, so a typed list containing `"ARIEL 4in1 PODS 33"` still orders 33. Keel named this and it was outside the granted surface. It is a money-consequence residual and belongs in Warwick's decision queue, not in this WP |
| AC10 | A control the system refuses must not be drawn; a refusal in our own namespace must not be silently journaled | **HOLD** | Half (a): `Search ASDA` withdrawn from every question card (`renderMessages.js:230`); two named tests, one asserting every card remains answerable. Half (b): `isOurCallback()` decides on the `asd:` NAMESPACE, not an action list — the right axis; `AC10 a refused callback in OUR namespace is REPORTED, not merely journaled` and its foreign-namespace twin both pass | **BLOCKING, and it is a shortfall of substance, not of evidence — see Defect D-2.** Half (b) moves the refusal from the journal into the pass report. Both are invisible to Warwick. The branch at `runtime.js:591-594` still `continue`s **without calling `acknowledge`**, which is the only thing in `routeTaps` that puts text on Warwick's phone (compare `:645`, which does call it). Its own test's failure message says "Warwick pressed it and nothing happened" — and after this fix, he still would. Half (a) additionally does not reach the eight cards already sitting in his chat, which still carry the dead button |
| AC6 | Regressions first, RED before green | **PASS** | For AC1 and AC5 the binding of test to fix is established directly by Veritas's own mutation runs above (a test that goes RED when the fix is removed is the property AC6 exists to buy). AC2's share of AC6 is void with AC2 | Non-blocking: Keel's original red-before-green transcript was not inspected; the mutation evidence supersedes it for the two surviving rows |
| AC7 | Mutation-proven, byte-identical restore, sha256 both sides | **PASS** | Two mutations executed by Veritas inside a `git archive` export, never in the repository: AC1 (`runtime.js`, named test RED, digest `656c56f1…` identical before and after) and AC5 (`runPipeline.js`, named test RED, digest `e2da0988…` identical before and after). Both export digests equal the repository's current bytes. The AC1 digest independently corroborates the digest Larry and Keel quoted. AC2's mutation is void with AC2 | none |
| AC8 | Nothing written to the live store | **PASS** | The entire delta is 7 files (`git diff --stat 0658290 e0667dc`), none of which opens a connection; `live_authority: none`, `credential_scope: none`, `private_surface: none`. `bash scripts/secret-scan.sh --surface <the 7 files>` → exit 0, 26 detection classes, 7 files scanned, 0 secret values | Non-blocking, stated honestly: Veritas can prove the *artefact* touched no live store; it cannot audit what a shell did during the worker's session. Larry's cancellation of the four junk shops was his own action through the product route and is outside this row |

**Not graded — removed from scope at read-back (recorded, not endorsed):** AC2 (a new shop never
inherits a dead shop's list) and AC3 (a non-item line can be dropped through a supported route).

## Evidence provenance

- **Reviewer home:** the repository working tree `C:/Fusion247PKA`, read-only. **Evidence workspace:**
  `…/scratchpad/vx`, a `git archive e0667dc | tar -x` export outside the repository. No `git worktree`
  was created; no branch, ref or `.git` state was touched.
- Repository `git rev-parse HEAD` at start and end: `37c9aef2d00e3f895f8c31ee8c3c0db7b697776b` / same.
  `git status --porcelain` — 0 lines at start and at end.
- **Recorded honestly:** the repository HEAD is `37c9aef`, one commit *above* the reviewed
  `e0667dc`; `37c9aef` adds only `Deliverables/2026-08-10-warwick-telegram-capture-m64.md`. The
  product bytes are identical — `sha256(services/asdair/pipeline/runtime.js)` in the working tree and
  in the `e0667dc` export are both `656c56f1313a933095c09861349e72088c71938d2eb7d67ba28c38b93a2c85f6`,
  and `runPipeline.js` both `e2da098819df33fd6d200cca4363202ce8f6b4ad3a20c328f5aab6ea34de0902`. Suite
  runs were executed in the working tree; mutation runs only in the export.
- **Remote reachability, and it is load-bearing:** `git ls-remote origin` resolves
  `refs/heads/main` = `6eaf0dc`, `refs/heads/build-015/b15-08-answer-not-a-list` = `52fb566`,
  `refs/heads/backup/2026-08-10-local-main-safety` = `cd62dce`. **`e0667dc` is reachable from no ref
  on the canonical remote** (`git branch -a --contains e0667dc` → `main` only; `git rev-list --count
  6eaf0dc..e0667dc` = 138). Neither is `a2a7e3f`. Per §Method 1 this head cannot receive `PASS`.
- **Evidence NOT available to this review, declared by name:** the live durable production state.
  No `ASDAIR_DB_URL` is present in this context and this dispatch declares no `private_surface`, so
  GL-012 denies `C:\.fusion247\**` by default. Veritas could not re-measure the state Larry reported
  and does not repeat his figures as its own. Nothing in this Gate 1 verdict rests on them.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `cd services/asdair/pipeline && node --test` | 0 | 405 | 405 pass, 0 fail |
| `cd services/asdair/bot && node --test` | 0 | 170 | 170 pass, 0 fail |
| `cd services/asdair/shop && node --test` | 0 | 102 | 102 pass, 0 fail |
| `cd services/asdair/intake && node --test` | 0 | 34 | 34 pass, 0 fail |
| export, mutate `if (msg.reply_to_message) {` → `if (false && …) {`, `node --test --test-name-pattern="AC1 A TYPED REPLY TO A CARD CREATES NO SHOP"` | 1 | 17 | **`not ok 12` — RED as required.** Restored, digest identical |
| export, delete `readings = withoutTrailingPackSizes(readings);`, `node --test --test-name-pattern="AC5"` | 1 | 27 | **`not ok 19` — RED as required.** Restored, digest identical |
| `bash scripts/secret-scan.sh --surface <7 changed files>` | 0 | 26 detection classes, 7 files | 0 secret values found |
| `git ls-remote origin` | 0 | n/a | `e0667dc` on no remote ref |
| Raw capture `Deliverables/2026-08-10-warwick-telegram-capture-m64.md` | n/a | n/a | Inspected as interface evidence. **It is PRE-fix** and evidences the defects, not the repairs |
| Live durable production state | **UNAVAILABLE** | n/a | No declared credential surface. Named, not treated as passed |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | Four of the five things the WP's `outcome` sentence promises were attempted; the fifth and sixth (AC2 list inheritance, AC3 drop route) were withdrawn at read-back, and AC2 is written verbatim into the WP's single `acceptance_property`. The outcome as accepted is not delivered |
| Design fidelity | PASS | AC1 keeps the route-first design and closes the seam without inverting it; the claim is taken only after the answer is durably written, which preserves the B15-04 no-silent-drop rule. AC10 decides on the namespace, not on an action list — the axis that does not go stale. AC5 corrects at the one point both source kinds converge and never edits the raw reading |
| Functional proof | **HOLD** | Proven against the harness store through the real `runOnce` / `runPipeline` entry points. **Not proven through the real production event** for any user-facing row |
| Integration | PASS | The changed code sits on the production path: `runOnce` → `pollIntake(claim)` → `routeTaps`; `stepInterpret` inside `runPipeline`; `queueShopCards` → `renderQuestionCard` → outbox. No test-only hop was introduced. `questions` was hoisted above the claim so the correlation the reply branch needs actually exists |
| Durability | **HOLD** | The reviewed head exists only in Larry's local context. `origin/main` is 138 commits behind it and no remote ref contains it. §Method 1: a head not remotely reachable cannot receive PASS. (Recorded, not blamed: the main push is Warwick's `merge-decision`) |
| Test quality | PASS | Both mutations produced a RED in the *named* test, not a diffuse failure. The tests pin the dangerous directions as well as the happy one, and their assertion messages state the real-world consequence rather than the expected value |
| Git truth | PASS | The integration commit is labelled PARTIAL, names AC2 and AC3 as deliberately not started with the reason for each, and explicitly records "NOT PROVEN: the real production event." That is accurate. Provenance branch `a2a7e3f` resolves as stated |
| Documentation truth | PASS (this WP's scope) | `document_impact: []` verified independently, not audited against itself: no active document states the corrected behaviours. `SOP-021`'s intake step was already withdrawn at `1cade10`. Carried to Gate 3, non-blocking: the Wayfinder's ACTIVE SESSION WORK PACKAGE still names WP-B15-3 rows and does not carry WP-B15-08 |
| Residual risk | **HOLD** | The largest residual is not in this diff: AC2's contaminated list binding is still live on Warwick's shop and is one of his two open questions. Withdrawing it from the WP did not make it stop blocking him. The typed-path pack-size asymmetry is a second, money-consequence residual |
| Completed automation | **HOLD** | The WP declares itself INTENDED AUTOMATIC — "the production events are a real Telegram reply and a real inbound list at the live runtime." Root `CLAUDE.md` §"Nothing may live only in Larry's head" requires acceptance to exercise the real production event. It has not been exercised. A restarted runtime carrying the new bytes evidences deployment, not the event |

## Production caller and journey

- **AC1:** Telegram → `pollIntake` (`runtime.js:1378`) → per-update `claim(verdict, update)` → reply
  branch (`:1136`) → `questions.getQuestionByCard(replyTo)` → `bot.routeAsdairUpdate` →
  `intentToCommand` → `commands.dispatch(answerQuestion)` → `claimedUpdateIds.add` → `routeTaps` skips
  the claimed id (`:549`). Real entry point, no test-only hop.
- **AC4/AC10(a):** `queueShopCards` (`:866`) → `normaliseStoredCandidates` → note construction →
  `store.enqueueMessage` → `drainOutbox` → Telegram. `renderQuestionCard` is on that path.
- **AC10(b):** `routeTaps` (`:591`) → `log('inbound_refused')` → `refused.push(...)` → returned in the
  pass report at `:1416`. **The chain ends there.** Nothing on this path reaches Warwick — `acknowledge`
  is not called in this branch, and `intent.raw` is absent for a refused intent, so it structurally
  cannot be called with that intent object as written.
- **AC5:** `runPipeline` → `stepInterpret` (`:597`) → `withoutTrailingPackSizes` → `shop_line` and
  `buildGroundedIntents` → `add_list_item`. On the photographed path only, by design.

## Restart and durability

`n-a` for new durable state — this WP adds none. The durability finding that does apply is the
unpushed reviewed head (see Durability above). The runtime restart Larry reports (PID 6592,
17:56:06Z) was not independently observed by Veritas and is not relied on by any row here.

## Documentation contradiction scan

- Larry's declared DOCUMENT IMPACT: `[]`, with the note that `SOP-021`'s intake step was already
  withdrawn at `1cade10`.
- Verified independently: no active document asserts the pre-fix behaviours of AC1, AC4, AC5 or AC10.
- **What his list missed:** the Wayfinder's ACTIVE SESSION WORK PACKAGE (`Deliverables/2026-08-04-
  build-015-asdair-wayfinder-plan.md:1157`) still names WP-B15-3 as the active package. WP-B15-07 and
  WP-B15-08 do not appear in it. A fresh session orienting on that section would not learn that the
  live 2026-08-10 defects exist. **Non-blocking at Gate 1** (it does not invalidate this WP's
  functional evidence); carried to Gate 3.
- Active documents that would misdirect a fresh instance: none found within this WP's scope.
- Closure claims since the last receipt, and the receipt behind each: **none.** Larry made no
  completion claim — the integration commit says PARTIAL and names what is unproven. Recorded as
  correct conduct, not as an absence.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D-1 | HIGH | **No user-facing row has been observed through the real interface.** AC1, AC4 and AC10 are graded on component evidence only; the real production event (a Telegram reply, a rendered card) has not been exercised at the fixed bytes. Blocks: marking WP-B15-08 complete, and any statement that Warwick can now answer a card safely | **blocking** | Larry |
| D-2 | HIGH | **AC10 half (b) does not deliver its stated outcome.** A refused callback in our own namespace is added to the pass report; Warwick is still told nothing. `runtime.js:591-594` omits the `acknowledge` call that every other refusal branch makes (`:645`). The eight cards already in his Telegram still draw `Search ASDA`, so this is the live path, not a hypothetical one. Blocks: AC10 acceptance | **blocking** | Larry |
| D-3 | HIGH | **The WP's single `acceptance_property` is half-withdrawn.** AC2 ("a shop created for a new inbound list is bound to a list containing only that list's items") is written into the property that was declared to decide this WP, and was removed at read-back rather than satisfied. `SHOP-2026-08-10-M64` remains bound to the CANCELLED shop's list. Blocks: any claim that WP-B15-08's outcome is delivered | **blocking** | Larry / Warwick (scope) |
| D-4 | MEDIUM | **AC3's stated removal premise is engineering-true and user-false.** "A skip route already ships" is correct — `Skip this week` is rendered. The raw capture records that Warwick did not know it existed and was told by Larry that the junk line could not be cleared without a code fix. A control that ships and is undiscoverable does not discharge a requirement about dropping a line | non-blocking at Gate 1; **material at Gate 2** | Larry |
| D-5 | MEDIUM | **The typed path still reads a trailing bare number as a quantity.** `skill/listNormaliser.js` reaches the opposite default by design, so a typed list containing `"ARIEL 4in1 PODS 33"` still orders 33 packs. Keel named it; it was outside the granted surface. Money consequence, so it is reported once for Warwick's decision — never auto-converted into work | non-blocking | Warwick decides |
| D-6 | MEDIUM | **The reviewed head is on no remote ref.** `e0667dc` exists only locally; `origin/main` is 138 commits behind. Per §Method 1 this alone caps the verdict at HOLD. Recorded as a durability fact, not a fault — the push is Warwick's `merge-decision` | **blocking (verdict cap)** | Larry / Warwick |
| D-7 | LOW | The Wayfinder's ACTIVE SESSION WORK PACKAGE still names WP-B15-3 and omits WP-B15-07/08 | non-blocking, carried to Gate 3 | Larry |

**Recorded in the other direction, because a receipt that only lists faults is not a truthful one:**
the AC1 fix is the best piece of engineering in this WP. The naive repair — claim the reply and let
`routeTaps` answer it — would have converted a visible double effect into a silent drop, because
`routeTaps` skips claimed updates. Keel identified that trap and inverted the order so the claim is
taken only after the answer is durably written, and pinned it with a test whose failure message names
the worse outcome. That is the failure mode this estate keeps producing, caught before it shipped.

## No readiness claim is made

This receipt does **not** authorise, recommend or permit anyone to proceed with the live journey, and
must not be quoted as doing so. Veritas had no access to the current durable production state (no
declared credential surface) and therefore cannot answer *«given the state that exists right now, what
will the production system do when the user performs the exact next real action?»* That question is
`UNKNOWN` here by declaration, which under §"Current readiness is NOT capability" is `HOLD`, and it is
one of the reasons this verdict is HOLD rather than PASS.

## Verdict

**HOLD** — the engineering is sound and independently mutation-proven, but three user-facing rows are
graded on component evidence alone, AC10's second half does not reach Warwick at all, the Work Order's
single acceptance property is half-withdrawn, and the reviewed head is on no remote ref.

## Next review trigger

**ONE focused confirmation of D-1, D-2 and D-3 only** — when (a) a real Telegram reply and a real
rendered question card have traversed the fixed bytes at the live runtime with the artefacts durably
captured, (b) a refusal on a control this product drew produces something Warwick actually receives,
and (c) AC2 is either delivered or explicitly and durably reclassified by Warwick as out of this Work
Package's accepted outcome. **A moved HEAD is not a trigger. Writing, committing or repairing this
receipt is not a trigger. A push of `e0667dc` to the remote discharges D-6 alone and does not by itself
reopen this gate.**
