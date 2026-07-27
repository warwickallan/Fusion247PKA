# NEXT SESSION MISSION — Repository + Worktree Hygiene

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

1. **The doctrine and the AsdAIr governance artefacts are committed on `idea-016/idea-engine`, not `main`.**
   This is the single most important thing to check first. A fresh Larry opening this folder gets them *because
   the working tree sits on that branch* — but they are absent from `main`, so any worktree branched from `main`
   cannot see them. That is exactly how the AsdAIr behavioural acceptance ran against a tree with no specialist
   contract and no `SOP-021`. **Getting these onto `main` is a merge decision for Warwick, not a cleanup action.**
2. **BUILD-015 / AsdAIr** — durability repair, verdict recorded as **NOT READY autonomous / READY supervised**.
   See `Builds/BUILD-015-.../ACCEPTANCE-AND-EVIDENCE.md`. Its branch carries real, reviewed, CI-green work and
   named unblocking items. **Class A. Do not tidy it away.**
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
