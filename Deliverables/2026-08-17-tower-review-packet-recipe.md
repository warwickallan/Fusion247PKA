# How to get a PR through the Tower/Codex route — the recipe, learned the expensive way

**Read this BEFORE composing any `@tower` comment.** It cost six wasted review rounds across PR #105 and
#107 to learn, none of which criticised a single line of product code. Every mistake below was Larry's.

**This is a HOW, not new governance.** The route itself is the proven BUILD-020 one, canonical in
`CLAUDE.md` § "THE TWO INVOCATIONS THAT DELIVER THAT GATE". Nothing here changes it.

---

## 1. ⛔ DELIVER THE REVIEW. DO NOT REQUEST ONE.

**The single most expensive mistake.** Three rounds on #105 came back *"did not actually deliver the
requested review against the diff or an explicit verdict."*

The watcher runs `delivery_supervisor` + `tower_qa_skill`, and **it judges LARRY'S TURN against real git
evidence.** Your comment IS the work being reviewed. So the comment must **be** the review:

- a **per-criterion table** with **stable IDs**, one row per AC, each with your **PASS/FAIL result**;
- for each row, **where to verify it in the staged diff** — file paths, test names, the constraint;
- an **explicit merge verdict** in your own voice: `APPROVE FOR MERGE at <sha>`, or not.

Codex then verifies or overturns it. "Please review this" produces a round that spends an execution and
returns nothing.

## 2. ⛔ THE CLAIM IS THE CHECKPOINT COMMENT. NOTHING ELSE IS READ.

Evidence in a *neighbouring* comment is evidence **nowhere**. Two rounds died on this. Criterion
definitions, receipt CONTENT (not its path), CI run ids, estate evidence — **all inline, in the same
comment that carries `@tower checkpoint:`.**

## 3. ⛔ EVERY REVIEW IS MERGE-CLASS. YOU CANNOT AVOID IT.

`@tower checkpoint:` is REQUIRED to create a turn — and `/\bcheckpoint\b/i` is itself in
`COMPLETION_PATTERNS` (`services/control-plane/tower-loop/mergeClass.mjs:27`). **So every watcher-triggered
review is merge-class by construction**, and merge-class demands §3b checks 6 and 8. Do not try to word
around it. **Stage the convergence evidence in round one** or you will spend rounds discovering it:

- working tree clean, stash count, `main` vs `origin/main`, worktrees, open PRs;
- retained non-contained refs, with the Class-2 classification and `reconcile.md` § THE PROTECTED-REFERENCE
  RULE cited — `ancestor_of_merge_candidate=false` is CORRECT for these;
- **check 6:** live `node` processes — executable paths, command lines, **loaded-module enumeration** —
  and **disclose that `Win32_Process` exposes no cwd**, which the reviewer asks for by name;
- **check 8:** ENUMERATE retained non-Git state (`C:\.fusion247\`, `~/.mypka/`). Saying "this candidate has
  none" is NOT sufficient and will be rejected — it asks about the estate, not the candidate.

## 4. ⛔ FINDINGS ARE BUILD-SCOPED, AND A DISPOSITION IS BOUND TO ITS HEAD.

Two hard consequences, both discovered by wasting rounds:

- **Dispose EVERY open finding, at THIS head, in THIS comment.** A disposition made at another head is
  **STALE and not carried forward** — `tower_findings_gate` rejects the round **before Codex runs**, so you
  spend a round and get no review. Valid values are exactly `addressed`, `remains_open`, `unrelated`
  (`tower-loop/findings.mjs:19`).
- **NEVER run two PRs of the same build concurrently.** The ledger holds **one disposition per finding**,
  so a second PR's round overwrites the first's and invalidates both. **Serialise, in merge order.**

Get the current ids with:
`gh pr view <n> --json comments -q '[.comments[]|select(.body|startswith("**Tower review"))]|last|.body' | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | sort -u`
— then **drop the turn id**, which appears in that list and is not a finding.

## 5. ⛔ THE STAGED DIFF TRUNCATES AT 60,000 BYTES.

A large PR is reviewed against a clipped diff and you get `F-PACKET-TRUNCATED`. **The fix is usually
merge order, not argument:** merge the parent, retarget the child to `main`, and its delta collapses.
PR #107 went from 180,555 bytes truncated to **12 files / +2,150 complete** the moment #105 merged.

## 6. ⛔ CARRIED FINDINGS CARRY THEIR ORIGINAL PHASE'S WORDING.

#107 was blocked for showing "only nine criteria despite repeatedly claiming ten" — because the *carried
findings* were raised against **WP-1, which has ten**, while **WP-2 has nine**. One shared ledger, several
Work Orders. **State the criterion count explicitly and name which Work Order defines it**, or the reviewer
reads a phantom omission.

## 7. What Codex has NEVER done, across every round

**It has never criticised a line of VlogOps implementation.** Every finding has been about packet
completeness, estate evidence, or transport limits. That is worth knowing before you assume a BLOCK means
the product is wrong.

## 8. Approval does not require the ledger to reach zero

Warwick, 2026-08-17: *"Do not wait for the findings ledger to reach zero where Codex has explicitly
approved the merge despite structural/carried findings."* When the verdict text says *record as approved
for merge*, that is the approval — merge it, preserve any caveat verbatim, and carry the structural
findings forward.

---

## Recorded defects — NOT to be fixed during BUILD-006 (Warwick, 2026-08-17)

1. **The 60,000-byte staged-diff cap** truncates large PRs.
2. **One disposition per finding**, build-scoped, makes concurrent review of a stacked build self-defeating.
3. **The estate-inventory demand is unbounded** — check 8 can always ask for more, and no packet closes it
   permanently.
4. **`bridge-ingest.mjs` writes session turns to Postgres while the watcher reads SQLite**, so the
   session-side path is dark. Never part of the BUILD-020 proof; a separate capability.

**Record them. Do not redesign Tower, the findings model, the transport or the assurance system while
BUILD-006 is in flight.**
