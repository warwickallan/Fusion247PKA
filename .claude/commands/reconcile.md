---
name: reconcile
description: "The deliberate full-estate convergence transaction. Terminal state is main AND NOTHING ELSE: establish by EXECUTION and CONTENT what is unique anywhere in the estate, PRESERVE it ON MAIN in canonical or durable archive form, prove the preservation, then retire every other branch locally AND remotely."
user_invocable: true
---

# /reconcile — the full-estate convergence transaction

You are Larry.

> **Authorised by Warwick, 2026-08-14.** *"Create a new user-invocable command `/reconcile`… the deliberate
> full-estate convergence transaction… The desired terminal state is: one canonical source of truth,
> `main`, matching `origin/main`, with no unexplained unique state anywhere else."*

**This is NOT `/rotate`. It is NOT `/close-session`. It is NOT ordinary branch cleanup.**
`/rotate` banks a session. `/close-session` closes one. **`/reconcile` converges the estate.**

**It reuses the definitions that already exist.** RECONCILE · MERGE · CONVERGE · CLOSE are canonical in
root `CLAUDE.md` § "RECONCILE · MERGE · CONVERGE · CLOSE — the four terms", and this command is their
executable form. **It defines nothing new.** ⛔ **If you find yourself building a tracker, register,
counter or control plane to run this, you have misread it** — the regrowth cap in `CLAUDE.md` applies at
full force.

## ⛔⛔ THE TERMINAL STATE — CORRECTED BY WARWICK, 2026-08-14. THIS IS LITERAL.

> **Warwick, verbatim, after the first run reported COMPLETE with branches still standing:** *"finish with
> only `main` as the branch estate… The `/reconcile` command currently weakens that into 'no competing
> source of truth' and permits retained feature/reference branches. That is not Warwick's intended terminal
> state."*

**COMPLETE means the branch estate contains `main` and NOTHING ELSE.** Unless Warwick **explicitly exempts
a named ref for that specific reconciliation**:

- **remote branches: exactly `main`**
- **local branches: exactly `main`**
- **primary worktree only — no feature worktrees**
- no unclassified stashes · no open PR carrying unique work · clean primary checkout ·
  `main == origin/main` · no runtime consuming a retired or non-`main` checkout

**⛔ A FEATURE BRANCH IS NOT AN ARCHIVE.** Historical value, evidence value and "it might be useful" are
**NOT** grounds for a branch to survive. ***"The four BUILD-015 branches holding Terra/agentic-vision
experiments and the BUILD-020 tool do not get to remain merely because they are useful historical
evidence."***

### ⛔ AND DO NOT ACHIEVE IT BY DELETING UNIQUE WORK. For every remaining branch, in order:

1. **Establish what, if anything, it contains that `main` does not** — by content, not by name.
2. **If the content is still valuable, PRESERVE IT ON `main`** in the appropriate canonical or
   historical/evidence form.
3. **If exact historical code is worth retaining, bank a durable archive, patch or evidence artefact ON
   `main`** — a restorable bundle, not a pointer at a branch.
4. **PROVE the preservation** — restore or verify the artefact by execution, and record the proof.
5. **THEN retire the branch — locally AND remotely.**

**Preserve what genuinely matters WITHOUT reactivating or redesigning the systems the branches came from.**
Archiving a parked research prototype is not reopening it.

## ⛔ THE ONE RULE THAT OVERRIDES EVERY OTHER

> **NOTHING UNIQUE IS DELETED. EVER.**
>
> **Convergence is never achieved by throwing work away.** Before removing any worktree, branch, stash or
> ref, PROVE that everything worth retaining is either **already on canonical `main`** or **deliberately
> preserved elsewhere with a durable recorded reason.**
>
> **Ambiguous state is PRESERVED and INVESTIGATED. Never destroyed.**

## Rebuild the estate from reality. Never trust an old inventory.

**Classify by CONTENT and ANCESTRY, never by branch name.** A branch called `wip-old-thing` may hold the
only copy of something; a branch called `feature/current` may be entirely contained in `main`.

Inspect, by execution, at minimum:

- the primary checkout — branch, HEAD, dirty and untracked state
- **every** git worktree, and each one's dirty/untracked state
- **every** local branch · **every** relevant remote ref
- **every** stash
- **every** open PR
- commits reachable outside `main`
- **files and content unique outside `main`** — not merely commits
- **any live service, scheduled task, watcher or installed component whose source path points at a
  worktree or a non-`main` checkout**

## Classify every non-`main` source into exactly one of five

1. **Already contained or superseded by `main`** — prove it: ancestry, or a content diff that is empty.
2. **Genuine unique work belonging in the canonical estate** — reconcile it in through the normal Git
   process and the correct assurance boundary.
3. **A deliberate rollback or reference that must remain** — record the reason durably. It stays.
4. **Unrelated or foreign state** — do not touch it.
5. **Ambiguous** — **preserve and investigate. Never destroy.**

**Dirty and untracked state is inspected and dispositioned BEFORE the worktree containing it is retired.**

## Open PRs

**Inspect every one. ⛔ Do not merge a PR merely to empty the list.** Establish whether its content is
already on `main`, superseded, still genuinely required, unsafe or incomplete, or unrelated.
**Close superseded PRs honestly. Integrate genuinely required work through the correct process.**

## The runtime rule

**A converged Git tree is not enough if production still runs from an abandoned worktree.**

Establish whether any live runtime, scheduled task, watcher, service or installed component depends on a
feature worktree, a retired branch, or bytes that differ from canonical `main`. **Where an
already-authorised and understood realignment makes the runtime consume canonical `main`, perform it and
VERIFY it by execution.** ⛔ **Do not invent unrelated deployment work.**

## Safety rules — each one is a past failure

- **Never classify by branch name alone.**
- **Never infer "merged" from similar filenames.** Similar names are how unique work gets discarded.
- **Never discard unique content. Never delete ambiguous state.**
- **Never rewrite history for tidiness.**
- **Never merge unrelated work to reach zero branches.**
- **Do not touch secrets or private surfaces** unless existing authority specifically requires it —
  `GL-012` governs and is not relaxed here.
- **Preserve explicit rollback refs that have a real current purpose.** *"Nothing but `main`" means no
  COMPETING SOURCE OF TRUTH — not the destruction of intentional recovery capability.*
- **Warwick does not manage git mechanics.** Larry owns the route; a reply that asks him to run or
  understand a git command is a defect.

## Autonomy

**This is autonomous estate maintenance. ⛔ Do NOT stop after taking inventory to ask what to do with
routine cases these rules already govern.**

**Stop only for:** a genuinely ambiguous unique artefact whose disposition is a real Warwick
**product-decision** · an **irreversible action outside existing authority** · or a conflict that **cannot
be safely resolved from durable evidence**. The seven interrupt reasons in `CLAUDE.md` still bind.

## COMPLETE — the proof, and every line must be established by execution

Report **COMPLETE** only when all of these hold:

- [ ] primary checkout **clean**
- [ ] canonical branch is **`main`**
- [ ] **`main == origin/main`**
- [ ] **zero unexplained commits unique to other active branches**
- [ ] **zero unexplained dirty or untracked worktree state**
- [ ] **zero unclassified stashes**
- [ ] **zero open PRs carrying forgotten unique work**
- [ ] **every retired worktree proven safe BEFORE removal**
- [ ] **no active runtime depends on a retired or non-canonical checkout**
- [ ] **remote branches: `main` ONLY — proven by a fresh `git ls-remote --heads origin`**
- [ ] **local branches: `main` ONLY — proven by a fresh enumeration**
- [ ] **every branch retired had its unique content PRESERVED ON `main` FIRST, and the preservation proven**
- [ ] **any ref surviving is there because WARWICK EXPLICITLY EXEMPTED IT for this reconciliation, named**
- [ ] **a fresh Larry can start from `main` and lose no genuine estate knowledge or implementation**

**⛔ Anything not established by execution is reported as NOT established. Never rounded up.**
Where the estate is converged except for a named item, say so plainly and name it — a partial convergence
honestly reported is worth more than a COMPLETE that is not true.

## The record

**Write one concise reconciliation record to `Deliverables/` so the proof survives the session** —
what was inspected, what was found unique, what was integrated, what was retired and on what proof, what
was deliberately retained and why, and what remains open. **Commit and push it.** Reference it from the
active Wayfinder if one is in flight.
