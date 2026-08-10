---
build: BUILD-015-asdair-durable-household-shopping-steward
scope: WP-B15-07 … WP-B15-16 plus Larry's three integration tasks (the integrated batch)
gate: 1

boundary: The eleven-item integrated batch on local `main` and the outcome each Work Order promised —
  a new list never dies in a terminal shop · a typed answer is never also a list · ONE question board ·
  dead-shop items excluded from a live plan · one canonical pack-size rule · no false BASKET_READY ·
  grounding that already exists is found · both supervised hops · a board that is never wrong about
  being blocked · migration 019 written and proven · and Larry's own three integration repairs.

reviewed_sha: fb588826e891ffd2944a29499ce77c400e0f2ea7
governance_sha: fb588826e891ffd2944a29499ce77c400e0f2ea7
branch: main (also reachable from origin/build-015/durable/2026-08-10-live-shop-fixes)

evidence_method: mixed — git archive export (suites and mutation testing) · primary checkout (source and
  git history, read-only) · live runtime and read-only cockpit-api (current durable state)
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/a8a4a211-d8c2-42c1-8bb3-d7d87ba2540f/scratchpad/exp
worktree_head_at_start: fb588826e891ffd2944a29499ce77c400e0f2ea7
worktree_head_at_end: 6eb815ea8745861b167ba8657cf062c863962b36
  # NOT equal to worktree_head_at_start, and recorded rather than smoothed over. Larry committed TWO
  # DOCUMENTATION-ONLY commits (d1bab9a rotation handover, 6eb815e wayfinder pointer) DURING this review.
  # `git diff --stat fb58882..HEAD` = 2 files, both Deliverables/*.md, ZERO product files. My evidence was
  # gathered against fb58882 bytes throughout, the running runtime bytes are unchanged, and per contract
  # a head differing only by documentation is the SAME SCOPE. Verdicts stand unaltered.
worktree_status_clean: true  # no tracked file modified by Veritas at any point; the only untracked additions are these two receipts

verdict: HOLD
receipt_sha256: (stated in Veritas's return)
reviewed_by: veritas
reviewed_date: 2026-08-10
next_review_trigger: Rendered evidence of the NEW board as sent by the real Telegram Bot API (row 3 and
  row 11b), and executed evidence of migration 019's seven assertions plus a carried residual for the
  unowned-lane gap (row 10). A receipt, map wording or clerical commit is NOT a trigger.
---

## Scope reviewed

The eleven integrated items named in the dispatch, graded as integrated work at `fb58882` on local
`main`. I did not narrow the dispatch and the dispatch did not narrow the accepted scope.

**Deliberately NOT in scope:** the whole-journey user outcome (that is Gate 2, receipt
`veritas-phase-b15-user-journey-gate2-fb58882.md`, issued separately); estate-wide reconciliation and
convergence; CI, PR and release acceptance (Codex's).

**One scope note.** `Deliverables/2026-08-10-WO-B15-FIX1-clarification-card-loop.md` exists in the same
Work Order series and was not named in the dispatch. I did not grade it. Recorded so the omission is
visible rather than silently absorbed; `non-blocking`.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | **B15-07** a new list never dies in a terminal shop — fresh identity grounded in the inbound message | PASS | `shopStore.js:268-334` read in full. Insert-first; inbound key checked before ref (order is load-bearing and correct); terminal ref → `collisionShopRef(deadRef, msgId)` → fresh insert; exactly one retry, provably non-looping because the collision ref embeds the message id. Live state corroborates: `SHOP-2026-08-10-M64` exists as a collision ref born of this exact path | none |
| 2 | **B15-08** a typed answer is never also a shopping list | PASS | `runtime.js:1720-1844`. Claim is taken **only after** the answer is durably written; an uncorrelated reply falls through to intake (`typed_reply_not_claimed`); `verdict.kind !== 'text'` returns false, so a photo is always a list | none |
| 3 | **B15-09** the ONE question board — outstanding vs answered, and whether anything blocks the shop | **HOLD** | Backend path present and coherent (`loadBoardTargets`, `boardAt`, `parseBoardReply`). **But this requirement is stated in USER-FACING terms** — what Warwick can see and tell — so §"THE USER-OUTCOME RULE BINDS BY REQUIREMENT TYPE, NOT BY GATE" applies **at this gate**. `editMessageText` has never met the real Bot API and no rendered artefact of the new board exists | **Blocking for this row.** Unknown at the human surface; §Method 2a discharge required (raw capture, or Warwick's recorded acceptance) |
| 4 | **B15-10** dead-shop items excluded from a live plan | PASS | Mutation, by me, inside the export: inverting `shopLines.js:115` `shop_id <> $1` → `= $1` drives **6** tests red including `297/298/300` in `runPipeline.test.js` — the three that were previously 90/90 green under the same inversion. Restored, digest match | `lines_unresolved` deliberately retained (worker refused Larry's instruction with evidence and was right) |
| 5 | **B15-11** shared pack-size rule + intake CLI landmine | PASS | Mutation, by me: `skill/listNormaliser.js` `trailingPackSize` → `return null` drives exactly `282/283/284` red in the **pipeline** suite, which can only occur through a live cross-package import. Zero copies of the regex remain in `runPipeline.js`. Restored byte-identical, sha256 `34aca368…77aa` both sides | none |
| 6 | **B15-12** no false BASKET_READY + dry-run no longer moves shop state | PASS | Suite-level evidence only: pipeline 473/473 re-executed by me in the export. The suite is demonstrably non-vacuous — proven twice by independent mutation above | Evidence basis is the suite, not a separate targeted probe. Stated rather than implied |
| 7 | **B15-13** grounding (separator-blind matching) | PASS | **My own direct probe, not Larry's.** `matchTerms('VANISH PRETREAT GEL','Vanish Pre-Treat Gel')` → tier `exact`; `squashMatchText` collapses both to `vanishpretreatgel`. Negative controls hold: vs `Vanish Oxi Action Gel` → `shared_distinctive` (not exact); `ham`/`jam` → null; `12 pack eggs`/`6 pack eggs` → null | none — see §"The worker who never returned" |
| 8 | **B15-14** both supervised hops (`WAITING_FOR_BROWSER → SHOPPING → BASKET_READY`) | PASS | Pipeline 473/473; `dispatchStep`'s closed switch confirmed in source — a missing case throws into `failShop`, so the worker's correction of Larry's false hypothesis is sound | `network: none` breach — see Defects D3. Engineering-scoped row; the browser step's human outcome is Gate 2 |
| 9 | **B15-15** board truthfulness (tri-state blocked) + fakePg models the exclusion SQL | PASS | Same mutation as row 4: `404` (behavioural, answered by fakePg reading real SQL), `407` (fakePg **refuses** a predicate it cannot read), `431` all turn red. fakePg genuinely reads the operator out of the statement rather than modelling intent | none |
| 10 | **B15-16** migration 019 (WRITTEN AND PROVEN, NOT APPLIED) | **HOLD** | Migration file present and internally coherent (`019_shopping_list_shop_identity.sql`). **I could not re-execute the seven PostgreSQL assertions** — that needs a real PG connection whose credentials live under `C:\.fusion247\**`, denied by GL-012 with no `private_surface` declared in my dispatch. Larry's proof is therefore **UNVERIFIED by me**, not disproven | **Blocking for this row.** Unknown on a mandatory acceptance property. Plus the uncarried residual below |
| 11 | **Larry's three integration tasks** (self-authored, self-checked) | **HOLD** | **11a** delete `withForeignClaimStatement` — PASS, independently mutation-proven (row 4/9 evidence). **11c** re-point the pack-size rule — PASS, independently mutation-proven (row 5 evidence). **11b** correct the board's blocked wording — **HOLD**: it changes what Warwick reads on a surface that has never met the real Bot API | Two of three independently proven by me; the third is user-facing on an unproven surface |

## Evidence provenance

- Export taken with `git archive fb58882 | tar -x -C <scratchpad>/exp` — no worktree, no branch, no `.git` mutation.
- `node_modules` copied into the export for `pipeline/` and `shop/` only; no source file copied from the checkout.
- **All mutation testing happened inside the export.** Never in the repository.
- Repository `git rev-parse HEAD` at start / end — `fb58882…` / `fb58882…`, identical.
- Repository `git status --porcelain` — `0` lines at start, `0` lines after every mutation round.
- Live durable state read through the running read-only `asdair-cockpit-api` (`/asdair/health` reports `read_only:true`), never by writing to the store.

**Declared evidence limitation, named rather than smoothed over.** The live runtime's own log
(`C:/.fusion247/asdair/runtime.log`) and the intake offset file resolve inside `C:\.fusion247\**`.
GL-012 denies that by default and **my dispatch declared no `private_surface`**, so I did not read them.
Consequence: I established the runtime's **existence, bytes and start time** by process inspection, and
its **database reachability** through the read service — but **not** that it is completing polling
passes. Larry can close this by declaring the exact surface in a future dispatch.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test` in `<export>/services/asdair/pipeline` | 0 | **473** | 473 pass, 0 fail — matches the dispatch exactly |
| Mutation: `trailingPackSize` → `return null` in canonical `skill/listNormaliser.js`, pipeline suite re-run | 1 | 473 | **470 pass, 3 fail** — `282`, `283`, `284`, exactly as Larry recorded |
| `sha256sum` of `skill/listNormaliser.js` before and after restore | 0 | n/a | `34aca368…77aa` both sides — byte-identical restore corroborated |
| Mutation: `shopLines.js:115` `shop_id <> $1` → `= $1`, pipeline suite re-run | 1 | 473 | **467 pass, 6 fail** — `297`, `298`, `300`, `404`, `407`, `431` |
| Direct probe of `matchTerms` / `squashMatchText` (six cases, positive and negative) | 0 | 6 | Target case `exact`; three negative controls correctly do **not** match |
| `git branch -r --contains fb58882` | 0 | n/a | `origin/build-015/durable/2026-08-10-live-shop-fixes` — **remotely reachable**; durability property satisfied |
| `git rev-list --count origin/main..fb58882` | 0 | n/a | 189 — `origin/main` is far behind; the main push remains Warwick's `merge-decision` |
| Migration 019's seven PostgreSQL assertions | — | — | **UNVERIFIED** — credentials denied by GL-012, no declared surface |
| Rendered board as sent by the real Telegram Bot API | — | — | **UNAVAILABLE** — no such artefact exists |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | Every item traces to a real defect Warwick actually hit; nothing was built that nobody asked for |
| Design fidelity | PASS | The forced CJS→ESM direction was respected rather than worked around; insert-first discipline preserved in `createOrResumeShop`; no new mechanism grown |
| Functional proof | HOLD | Rows 1, 2, 4-9, 11a, 11c proven. Rows 3, 10, 11b not proven at the property each promises |
| Integration | PASS | Cross-package delegation proven live by mutation, not by reading an import statement |
| Durability | PASS | Head is remotely reachable; `createOrResumeShop` remains insert-first and idempotent on both natural keys |
| Test quality | PASS | The strongest result in this review. Two independent mutations turned green suites red on **named** tests, and `407` proves the fake **refuses** what it cannot read. This is the defect class that previously hid behind a blinding harness, and it is genuinely closed |
| Git truth | PASS | Branch, head and scope as reported. Commit messages describe what the diffs do; `fb58882`'s message matched the diff and my re-measured mutation result exactly |
| Documentation truth | HOLD | One stale active comment and one uncarried residual — D1 and D2 below |
| Residual risk | HOLD | The B15-16 post-application gap is real and is not carried on the map (D2) |
| Completed automation | n-a | No row in this batch claims a newly automatic outcome. The runtime's automatic invocation is graded at Gate 2 |

## Production caller and journey

Traced from the real entry point, not from a test: scheduled task `MyPKA-AsdAIr-Runtime`
(last run 2026-08-10 21:40:28 local, `LastTaskResult: 0`) → `ensure-asdair-runtime.mjs` →
`services/asdair/pipeline/runtime.js --watch` (PID 12204, started 21:40:57 local = **20:40:57Z**,
confirmed from `Win32_Process.CommandLine`) → `runOnce` → `loadOpenQuestions` / `loadBoardTargets` →
`pollIntake` → `receiveList` → `shopStore.createOrResumeShop`.

**Every component I graded PASS sits on that path.** `trailingPackSize` is reached from
`runPipeline.js` through a live `requireCjs` bridge — proven by mutation crossing the package
boundary, which a direct test call could not have shown.

## Restart and durability

The runtime was restarted via the scheduled task at 20:40:57Z and is executing `fb58882` bytes from the
primary checkout. It came back **without Larry**, from a stable approved runtime, which is the property
that matters here. `createOrResumeShop`'s idempotency across both unique indexes means a redelivery
after restart resumes rather than duplicating.

## Documentation contradiction scan

- **Larry's declared impact:** the Wayfinder ASWP block re-cut 2026-08-10 evening.
- **Verified independently:** the ASWP correctly records B15-16 as UNAPPLIED, correctly records that
  `lines_unresolved` was NOT retired and that the worker was right to refuse, and correctly carries the
  worktree-junction hazard.
- **What his list missed — D1 and D2 below.**
- **Closure claims since the last receipt:** the ASWP marks items "DONE AND ON `main`" / "ALSO LANDED",
  which is an integration statement, not a completion claim. **No item is marked complete, closed or
  accepted without a receipt.** Larry's maximum-permitted statement discipline held.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D1 | Low | `services/asdair/pipeline/runtime.test.js:2787` still asserts *"Every one of them still routes through `withForeignClaimStatement` … so those particular tests remain blind to the statement until that closure is deleted."* **The closure has since been deleted and those tests are no longer blind** — my inversion turned `297/298/300` red. The comment now misstates current test quality, in the safe direction | non-blocking | Larry — Gate 3 reconciliation |
| D2 | Medium | **Row 10's residual is only half carried.** The map records migration 019 as UNAPPLIED. It does **not** record that after 019 lands, **nothing supplies `shop_id`** — I searched every production insert into `asdair.shopping_lists` and found only test files; the production statement inserts `(household_id, status, list_date)` only. A fresh session reading the map would believe one gated action away from the identity fix being effective, when it is two pieces of work away | **blocking for row 10 only** — it materially misstates delivered capability | Larry |
| D3 | Low | **`network: none` breach.** WP-B15-14's worker ran `git fetch origin main` against a `network: none` order. **Larry's disposition is SOUND and I would not have it otherwise:** a fetch is read-only and adds objects to `.git` — unwinding it is meaningless, so not unwinding was correct; the real hazard is a baseline moving under the worker, and he required re-baselining, which addresses it; and he recorded it, which addresses contract erosion. Under the hobby-brain bar the consequence to Warwick is nil | non-blocking | recorded, no action |
| D4 | Medium | **Cross-shop ordinal collision.** `loadOpenQuestions` flattens open questions across **all** active shops while `ordinal` is computed **per shop** (`runtime.js:228`, `rows.forEach` index). `correlateTypedAnswer:464` then builds `new Map(open.map(q => [q.ordinal, q]))`, and duplicate keys silently keep the **last**. Graded here as engineering; **its live consequence is graded at Gate 2** | non-blocking **at this gate**; blocking at Gate 2 | Larry |

## The worker who never returned — Larry's scrutiny item 1, answered directly

**Integrating on the integrator's own evidence, with no worker self-report, is acceptable — and it is
acceptable for a reason that is not "Larry is trustworthy".**

My contract already forbids me to review a read-back: *"Veritas reviews the integrated work itself,
wherever it lives — never the specialist's read-back."* A missing self-report therefore removes
**nothing** from my evidence base, because a self-report was never in it. What the missing return does
change is that **no one had checked the work before me** — which converts my independent verification
from a confirmation into the *only* check.

So the honest answer is conditional, and the condition is satisfied: **I verified B15-13 by my own
direct probe**, including three negative controls, and did not rely on a single line of Larry's
account. Row 7 is PASS on my evidence.

**What I would have said had I been unable to probe it: HOLD.** The rule that makes this safe is not
"the integrator may self-certify"; it is "the gate must independently reproduce the property". Where
that is impossible — row 10 — I returned HOLD, and that is the same rule producing the opposite result.

## Larry's scrutiny item 2 — the self-graded integration tasks

He is right that this is the shape my role exists to distrust, and he was right to flag it. Two of the
three are now **independently mutation-proven by me, from a clean export, with named red tests and
digest-verified restores** — 11a and 11c. His recorded results matched mine exactly, including the
specific test numbers. That is the strongest evidence in this review.

**11b is held**, not because I doubt him, but because it changes what Warwick *reads* on a surface no
human has yet received.

## Verdict

**HOLD** — nine of eleven rows PASS on evidence I executed myself, including two independent mutation
proofs that confirm Larry's self-graded work exactly; but row 3 and row 11b are user-facing properties
with no evidence of the human outcome, and row 10's proof is unverifiable within my granted surface.

**What this HOLD gates, precisely:** marking B15-09, B15-16 and integration task 11b complete; and
Codex invocation for the batch. **What it does NOT gate:** the eight passing rows, safe continuation on
the active route, or any unrelated work. The frontier remains the Wayfinder's.

## Next review trigger

A raw capture of the NEW board as sent by the real Telegram Bot API (rows 3, 11b), and executed
evidence of migration 019's assertions with the unowned-lane residual carried on the map (row 10). One
focused confirmation of those findings only.
