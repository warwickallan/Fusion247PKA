---
title: STOP — NOT SAFE TONIGHT. Warwick shops manually. Read this first next session.
date: 2026-08-10
author: Larry
build: BUILD-015 AsdAIr
status: clean stop under a Warwick timebox — NOT a completion claim, NOT a rotation handover
supersedes_as_entry_point: Deliverables/2026-08-10-rotation-handover.md
---

# The stop, and exactly where to pick it up

**Warwick set a hard boundary at 22:44 on 2026-08-10: converge by ~23:44 or stop cleanly.** The
verdict was reached at **23:23 and sent immediately rather than held to the deadline**, because he
needed the time to go and buy food. Notification `message_id 491`.

> **NOT SAFE TONIGHT. Do the shop manually.** He was told plainly, with the two blockers named, and
> he was told his live system is unchanged and safe.

**Nothing here is a completion claim.** No Veritas gate ran tonight. No branch was integrated.

## The two blockers that stopped the photograph

**1. Cross-shop answer routing is not integrated.** Until it is, a reply can be recorded against the
wrong shop's question. `SHOP-2026-08-10-M64` is live with two open questions, so this is armed.

**2. The live write path is half complete.** Migration **019 is applied and verified**, but the code
that supplies `shop_id` is **not integrated**. Without it a fresh photo still lands on M64's list,
because `listDateOf` (`runPipeline.js:412`) strips the `-M<n>` suffix **by design** — so the date
cannot distinguish two shops of one day. Only `shop_id` can.

Warwick's own rule decided it: *do not ask for the photograph while the live schema/write-path
combination is knowingly incomplete.* It is.

## What is TRUE about the live system right now

| | |
|---|---|
| Local `main` HEAD | `cfea559` — documents only; **no product code changed on `main` tonight** |
| Working checkout | **CLEAN.** Larry's own `shop_id` edit was reverted out of it and banked to a branch, so a runtime restart cannot pick up a half-landed change |
| Runtime | **PID 12204, started 2026-08-10 21:40:57, still up on pre-change bytes.** Not restarted tonight. No cutover was performed |
| `origin/main` | still far behind local `main`. The push and the merge remain Warwick's (`merge-decision`) |
| Migration 019 | **APPLIED to the live database**, ledger `20260810215203`. Behaviourally neutral on its own |

**019 applied alone changed no behaviour**, which is why the live system is safe to leave overnight:
`findOrCreateDraftList` still takes its date-keyed lane because nothing passes `shop_id` yet, and the
unowned lane keeps the same guarantee under `uq_lists_household_date_unowned` that the dropped
constraint gave it.

### 019 verification, executed against the live store

Column `shop_id bigint` nullable ✓ · **contested list row 20 → shop_id 14 (M64, the LIVE shop), not
the cancelled shop 11** ✓ · list 18 → shop 6, list 19 → shop 7 ✓ · unowned lane (lists 1, 2, 3, 14)
NULL ✓ · `uq_lists_shop`, `uq_lists_household_date_unowned`, `idx_lists_household_date` all present ✓
· old auto-named unique constraint **dropped** ✓ · counts **7 lists / 170 items, unchanged** ✓

### 019 independently re-proven on real PostgreSQL

`bash services/control-plane/wp-d-proof/run-add-list-item-test.sh` (throwaway cluster) →
**32 passed, 0 failed**, all seven of Silas's assertions PASS, including **(d) the defect itself** —
two shops, same date, two independent rows, neither able to clobber the other — and **(g)** the live
shop winning the shared row with not one `shopping_list_items` row moved.

**This closes the Veritas Gate 1 HOLD on row 10**, which said those seven assertions could not be
re-executed because credentials were unavailable. They were re-executed, by Larry, on real
PostgreSQL 17.4, needing no credentials at all.

## Branches — every one pushed, none integrated

| Branch | State |
|---|---|
| `build-015/b15-18-cross-shop-answer-routing` | worker was still building at the stop |
| `build-015/b15-19-supervised-completion` | worker was still building at the stop |
| `build-015/b15-20-remembered-choice-lookup` | **COMPLETE**, `602caea`, pushed |
| `build-015/b15-21-shop-id-emission` | **complete but deliberately NOT integrable yet** — see below |

Worktrees live at `C:/Fusion247PKA-b1518`, `-b1519`, `-b1520`, `-b1521`, plus the pre-existing
`-b1513`. **Each carries REAL COPIES of `node_modules`, not junctions** — Larry verified each at
473/0 on the pipeline suite before dispatch, so a red in any of them is a real red. Do not `rm -rf` a
worktree carrying a junction without removing the junction non-recursively first; these do not carry
junctions, which is deliberate.

### WP-B15-20 — done, and it is good

Keel's read-back found a defect in the order: **the lookup is in TWO places**, so a SQL-only fix
fetches the row and still misses on the Map keyed by `row.choice_term`. The delivered design keys the
Map on the **requested** term, leaving `applyRememberedToPlan` byte-unchanged and pure. It also found
a **second gate** — `runPipeline.js:317` short-circuits on `memoriesByTerm.size === 0`, so today
`applyRememberedToPlan` was never reached at all.

Evidence: pipeline **482/0** (+9 on a 473 baseline), skill 341/0 and interpret 30/0 unchanged, AC2
proven RED before implementation, three mutation kills each asserting the source actually changed on
disk and restoring to a matching SHA-256.

**Stated limit, to be carried to the gate in these words:** AC2 exercises the real production entry
point (`runPipeline`) against a **modelled** Postgres. Its green is not a live proof.

### WP-B15-21 — proven on real Postgres, and NOT integrable tonight. Read before touching.

The `shop_id` emitters (`buildGroundedIntents`, `stepApplyCorrections`). The **receiving** side
already existed — `asdairCommands` `add_list_item` validates `args.shop_id` and fails closed on
garbage — so this was purely the missing caller.

**It reddens the offline pipeline suite 473/0 → 371/102.** Established by execution, not inferred:
those failures are **fake fidelity, not a real regression**. `pipeline/test/fakePg.js` does not model
the `where shop_id=$1` lane, errors on the unmodelled statement, and `failShop`s every shop that
reaches it. The same change passes 32/0 on real PostgreSQL.

**It was not fixed tonight because `pipeline/test/fakePg.js` belongs to the live WP-B15-18 worker**,
and Warwick's timebox explicitly forbade hacking across an active worker surface.

**Remaining work, small:** teach `fakePg.js` the `shop_id` select and the four-column insert, re-run,
then integrate. Blocked only on B15-18 landing.

## Governance and process notes worth keeping

- **All three read-backs returned CLARIFY and all three were correct.** Between them they found: the
  cross-shop defect is **five holes, not one** — and the worst carries no number in the message at
  all, so nothing survives for a reviewer to blame; `recordedAnswerMatches` has the same defect;
  `questionKeyFor` has no shop component; `pg` does not resolve from `handoff/`; the remembered-choice
  lookup is in two places; and three of Larry's cited line numbers were wrong.
  **The orders needed more scrutiny than the work. Again.**
- Two worker designs were **taken over Larry's own**: re-scoping the existing AC8 guard so the
  already-shipped `reply_not_taken` card becomes reachable rather than inventing a card; and fencing
  `updateBrowserProgress` rather than making it merge, because a merge would have stranded a
  deliberate statement-shape pin in a file held by another worker.
- **The migration permission gate fired twice and was not routed around.** The sibling Supabase
  connector and raw `execute_sql` were both available and both deliberately unused — that would have
  circumvented the intent of the denial, not substituted a tool. It was applied only after Warwick's
  explicit in-session authorisation.
- **A correction was sent to Warwick within minutes of a wrong instruction.** He had been told to
  approve a prompt; retrying proved the classifier **auto-denies without prompting**, so he would
  have sat waiting. Notification `490`.
- **The FusionDevBot path is PROVEN, not assumed** — `message_id` 489, 490, 491, each exit 0. Earlier
  in the session it was described as "available" on the strength of the file existing; that was
  stronger than the evidence at the time and was tightened.

## Larry's own error tonight, recorded plainly

At ~23:10, with 34 minutes left, Larry took the `shop_id` emitter on personally under the Rule 4
exception. The change is correct and is proven on real PostgreSQL — but the `fakePg` collision was
**foreseeable and was in fact foreseen**: it had already been the stated reason for not dispatching
that package to a fourth worker. Taking it on directly did not remove the blocker, it relocated it.
The cleaner call was to leave it entirely and spend the time banking.

No harm reached the live system — the edit was reverted out of the working checkout and the runtime
never restarted — and the work is preserved on a pushed branch. But it cost time that was owed to a
clean stop.

## THE RESUME POINT — exact, in order

1. **Collect the two outstanding worker returns** (`b15-18`, `b15-19`) and read their evidence.
   ⚠️ `/clear` does NOT kill background workers. **Sample `git status` twice in each worktree before
   touching it**, and never dispatch a "resumption" without proving the original finished.
2. **Integrate `b15-18`, `b15-19`, `b15-20`** into local `main`, re-running the full estate suite at
   the integrated head. Baseline to beat: **1,982 pass / 0 fail across 13 suites** at `7cc6040`.
3. **Teach `pipeline/test/fakePg.js` the `shop_id` lane**, then integrate `b15-21`. Only after
   `b15-18` has landed, since it owns that file.
4. **Cut the runtime over ONCE, via the scheduled task `MyPKA-AsdAIr-Runtime`.**
   `ASDAIR_COCKPIT_BASE_URL` comes from the Windows **user environment**, not the credentials files —
   a launcher restart from a shell silently drops the checklist URL. Verify identity, mode and bytes
   after restart.
5. **Veritas Gate 1** (engineering truth) and **Gate 2** (current-state preflight against the exact
   production state and the exact next Warwick action). **Declare the private surface this time** —
   last session's gate could not confirm the runtime was polling because none was declared.
   Read the amended contract first (`65f7375`, `62aa2e8`, `0658290`).
6. **Only on Gate 1 PASS + Gate 2 PASS: ask Warwick for the photograph.** If a known blocker remains,
   the verdict is HOLD or FAIL and he is **not** asked.

## What must NOT happen next session

- **Do not re-derive any of this.** It is all written down, with file:line.
- **Do not report the journey end-to-end proven before Warwick actually executes it.** An outcome
  intended to be automatic stays on the frontier until the real production event has run — see root
  `CLAUDE.md` § "Nothing may live only in Larry's head".
- **Do not treat `b15-21`'s 102 failures as a real regression.** They are fake fidelity and the
  real-Postgres proof is recorded above.
- **Do not open a second documentation-only Veritas review.** The commissioning question governs.
