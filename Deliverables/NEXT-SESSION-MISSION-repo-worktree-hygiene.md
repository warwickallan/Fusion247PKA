# NEXT SESSION MISSION — Repository + Worktree Hygiene

## RESUMPTION PRECEDENCE — recorded 2026-08-04, discharging Veritas `D-G3-07`

**Recorded by `WO-2026-08-04-03`, re-seated by `WO-2026-08-04-04` when this map was added. Exactly
one document may direct the next session. This is the order, and every resumption-shaped document
in `Deliverables/` carries this identical block.**

1. **`Builds/BUILD-015-asdair-durable-household-shopping-steward/`** — the build record is the
   **authority for every BUILD-015 fact, and it is not a route.** A document that disagrees with it
   is wrong.
2. **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`** — **THE Wayfinder map. The sole
   route, and the only document that may state the exact next action.**
3. **`Deliverables/NEXT-ASDAIR-SESSION-brief.md`** — **NON-DIRECTIVE.** Operational hazards and
   code-level do-not-rebuild warnings the map points at. It states no next action.
4. **`Deliverables/2026-08-04-rotation-brief.md`** — **NON-DIRECTIVE.** A dated snapshot of the
   2026-08-04 rotation, kept for its record of what changed and the traps it names. It states no
   next action.
5. **`Deliverables/BUILD-015-STAGE1-continuation-brief.md`** — **NON-DIRECTIVE. Superseded
   2026-07-28 snapshot**, kept as a historical record only.
6. **`Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md`** — **NOT a BUILD-015 resumption
   document.** A standing repository-hygiene mission; it never directs BUILD-015 work.

**This block is deliberately duplicated byte-identically across all five documents, as a recorded
exception to the SSOT Golden Rule** (root `AGENTS.md` §1), because a fresh instance may open any one
of them first and must learn from that one which document it is allowed to act on.

**The Honcho continuity brief is a POINTER, never the authority** (root `CLAUDE.md` Step 2).
**Verify by execution, not belief.**

> **This is a STANDING REPOSITORY-HYGIENE MISSION, not a BUILD-015 resumption document. It never directs BUILD-015 work and it states no BUILD-015 next action; for that, read `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`.**

**For a fresh Larry. Read this, then go and look.** Written 2026-07-28 at the close of the delegation/AsdAIr
session, by Warwick's instruction.

> **This is a MISSION and a set of SAFETY RULES. It is deliberately NOT a status snapshot.**
> Any repository state quoted anywhere in this file may already be wrong. **Reconstruct it live.**

---

## Before you start — orient properly

Read your operating doctrine first: `Team/Larry - Orchestrator/AGENTS.md` §"Operating doctrine" and root
`AGENTS.md` §3. The `how-larry-works` memory covers the same ground and should have auto-loaded.

**Then reconstruct the estate from live sources — in this order, trusting none of them from memory:**

```
git worktree list                 # what working trees exist
git -C <each> status --porcelain  # dirty / untracked state
git -C <each> log --oneline -3    # what is actually in each
git branch -a                     # local + remote branches
gh pr list --state all --limit 40 # PR state
git log --oneline origin/main -15 # what has actually landed
```

Plus the durable build records under `Builds/` for what each stream was *for*.

---

## The mission

**Audit the Fusion247 estate and leave it understandable, recoverable and online.**

For every relevant worktree, local branch, remote branch and PR, establish: purpose · current HEAD · dirty or
untracked state · **whether meaningful work exists only locally** · remote branch status · PR state ·
merged / superseded / active status.

Then classify each item:

| Class | Meaning |
|---|---|
| **A — ACTIVE** | retain, do not touch |
| **B — SAFE TO REMOVE** | no unique state anywhere |
| **C — DIRTY / STRANDED** | meaningful local state — **rescue before anything else** |
| **D — UNKNOWN** | investigate; **do not destroy** |

### Success criteria

- no meaningful work exists only on a disposable local worktree;
- anything worth retaining is represented safely on GitHub;
- obsolete **safe** worktrees are removed;
- stale branches and PRs are classified honestly;
- **active work remains untouched**;
- mysteries are preserved until understood;
- the final estate is documented clearly enough that another fresh Larry can understand it.

---

## SAFETY RULES — non-negotiable

- **Public repos stay public.** Do not change repository visibility.
- **Do not delete or force-reset anything ambiguous.** Ambiguous means class D. Class D is never destroyed.
- **Do not merge PRs merely to make the estate look tidy.** Merge-to-main is Warwick's gate and needs a real
  reason, not neatness.
- **Do not touch secrets.** The off-repo store at `C:\.fusion247\` is out of scope entirely.
- **Do not invoke Fable.**
- **Reconstruct from live sources rather than trusting stale handoff claims** — including every claim in this file.
- **Use workers where useful, but retain integration judgement.** Each file-mutating worker gets its own fresh
  worktree; parallelise only across genuinely different surfaces.
- **Apply Work Order Preflight** (`SOP-022`) — and preflight your *own* orders before issuing them.
- **Keep Warwick informed of meaningful discoveries, not every command.**

---

## Known live threads to be careful of — verify each, do not assume

**These are leads, not facts. Every one may have moved.**

1. **RESOLVED at session close — doctrine is now ON MAIN.** It was committed only on `idea-016/idea-engine`
   and, worse, **unpushed** until the final minutes; twelve commits existed on one machine and nowhere else.
   Merged to main via PR #74 (main `1cb73e8`). **Verify it rather than trust this line:** `SOP-021`, `SOP-022`,
   the Asdair contract and the reconciled iron rule should all be present on `origin/main`. If any is missing,
   that is your first and most important finding.
2. **BUILD-015 / AsdAIr — PR #73 is OPEN and deliberately UNMERGED.** Final exact-head Codex verdict was
   `request_changes`, so Warwick's merge condition (READY + green CI) was not met and the merge was withheld.
   Two HIGHs remain and they map onto Warwick's own supervised bar: unmatched items ship an EMPTY alternatives
   queue, and NO RUNTIME PATH invokes the outcome/learning writers. Full record in
   `Builds/BUILD-015-.../ACCEPTANCE-AND-EVIDENCE.md`. The branch carries real, reviewed, CI-green work.
   **Class A. Do not tidy it away, and do NOT merge it to make the estate look finished.**
3. **Several worktrees predate tonight** and may hold uncommitted work from earlier builds. Two sampled earlier in
   the session were dirty, one sitting on deleted CI workflow files. **Treat every dirty tree as class C until
   proven otherwise.**
4. **`main` was observed failing CI** on a Telegram card test unrelated to any of this work. Worth confirming and
   classifying; it is not caused by the AsdAIr or delegation streams.
5. **`.codex/agents/` holds 13 specialist shims** that predate a ruling narrowing Codex to a review host. Warwick
   ruled explicitly: **audit them later as their own deliberate pass — do not backfill and do not delete them as a
   side-effect of this cleanup.**

---

## What is NOT in scope

Merging anything to `main` without Warwick's word · resuming BUILD-015 engineering · content-verification work
(explicitly not authorised) · changing repository visibility · touching the secret store · any AsdAIr architecture.

---

## Report back

Warwick wants **meaningful discoveries, not narration**: what you found that was genuinely surprising, what was
stranded, what you rescued, what you removed, and what remains a mystery. Then the classified estate, and any
genuine decision only he can make.
