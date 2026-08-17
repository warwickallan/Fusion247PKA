# SOP-023 — Take a PR through the Tower/Codex review route

- **Status:** Active. Established by execution, 2026-08-15/17, across PR #105 and #107.
- **Owner:** Larry.
- **Applies to:** every PR that needs the external Codex gate.
- **Related:** `CLAUDE.md` § "THE TWO INVOCATIONS THAT DELIVER THAT GATE" (the route itself, canonical there
  and not restated here) · [[SOP-018-independent-change-qa]] · [[SOP-022-work-order-preflight]].

**This is a HOW, not new governance.** Six review rounds were spent learning it and **not one criticised a
line of product code.** Every rule below is a mistake already paid for.

---

## The procedure

**1. One PR at a time, per build.** Findings and dispositions are **build-scoped**, and the ledger holds
**one disposition per finding**. A second PR's round overwrites the first's and invalidates both. Serialise
in merge order.

**2. Retarget first.** After the parent phase merges, retarget the stacked PR to `main` before reviewing.
The staged diff **truncates at 60,000 bytes**; retargeting collapses the delta and usually removes the
problem. (#107: 180,555 truncated → 12 files complete.)

**3. Collect the open finding ids at the current head.**
```
gh pr view <n> --repo <repo> --json comments \
  -q '[.comments[]|select(.body|startswith("**Tower review"))]|last|.body' \
  | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | sort -u
```
Drop the **turn id**, which appears in that list and is not a finding.

**4. Write ONE comment that contains everything.** The checkpoint comment **is** the claim; nothing else is
read. It must carry, in this order:

- `@tower head: <the PR's EXACT current 40-char head>` — re-read it at the moment of posting; a mismatch is
  refused.
- `@tower checkpoint: <BUILD-REF>` — without it **no turn is created at all**.
- `@tower finding <id>: addressed|remains_open|unrelated — <why>` for **every open finding**. A disposition
  made at another head is **STALE**; `tower_findings_gate` then rejects the round **before Codex runs**.
- **The review itself** — see below.

**5. DELIVER the review; do not request one.** The watcher runs `delivery_supervisor` + `tower_qa_skill` and
judges **Larry's turn** against git evidence. Include:

- a **per-criterion table with stable IDs** (`WP2-AC1`…), one row per criterion, each with your **PASS/FAIL**
  and **where to verify it in the staged diff** — file, test, constraint;
- **the criteria that belong to THIS phase's Work Order**, and say which order defines them and how many.
  Carried findings keep the wording of the phase that raised them — #107 was blocked for showing nine while
  a WP-1 finding said ten;
- the **Veritas receipt's CONTENT** — `reviewed_sha`, `verdict`, `receipt_sha256`, its **assured scope**, and
  a verbatim row or two. A path is not content;
- **CI at the exact head** — run id, conclusion, executed test count;
- an **explicit verdict**: `APPROVE FOR MERGE at <sha>`, with any caveat stated rather than waived.

**6. Stage the §3b convergence evidence in round one.** `@tower checkpoint:` is required to create a turn and
`/\bcheckpoint\b/i` is itself in `COMPLETION_PATTERNS` (`tower-loop/mergeClass.mjs`), so **every review is
merge-class by construction.** It will be demanded; staging it late costs rounds. Include:

- clean working tree, stash count, `main` vs `origin/main`, worktrees, open PRs;
- retained non-contained refs with their Class-2 classification and `reconcile.md` § THE PROTECTED-REFERENCE
  RULE cited — `ancestor_of_merge_candidate=false` is **correct** for these;
- **check 6:** live `node` processes — executable paths, command lines, **loaded-module enumeration** — and
  **disclose that `Win32_Process` exposes no cwd**;
- **check 8:** **ENUMERATE** retained non-Git state (`C:\.fusion247\`, `~/.mypka/`). "This candidate has
  none" is rejected — the question is about the estate.

**7. Merge on approval.** When the verdict says *record as approved for merge*, **merge** — preserving any
caveat verbatim in the merge commit. **Do not wait for the findings ledger to reach zero** where Codex has
approved despite structural or carried findings (Warwick, 2026-08-17). Then retarget the next PR and repeat.

---

## Recorded structural defects — NOT to be fixed during BUILD-006

Warwick, 2026-08-17: record them, keep building, **do not turn any of these into a side quest.**

1. The **60,000-byte staged-diff cap**.
2. **One disposition per finding**, build-scoped — concurrent review of a stacked build is self-defeating.
3. The **estate-inventory demand is unbounded**; no packet closes check 8 permanently.
4. **`bridge-ingest.mjs` writes session turns to Postgres while the watcher reads SQLite**, so the
   session-side path is dark. Never part of the BUILD-020 proof.
