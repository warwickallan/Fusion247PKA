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

## ⛔⛔ THE TERMINAL MODEL — **TWO CLASSES OF GIT STATE, AND NOTHING ELSE.** Warwick, 2026-08-14, final.

> ### 🔒 THE SAFETY INVARIANT — read this before anything else in this file
>
> **Reconciliation reduces COMPETING SOURCES OF TRUTH. It NEVER reduces RECOVERABILITY by destroying
> unique valuable evidence.**
>
> Operationally: **MERGE CURRENT TRUTH. PRESERVE DELIBERATE EVIDENCE. RETIRE EVERYTHING ELSE ONLY AFTER
> PROOF.**

**This command was ambiguous twice in one night — first permitting too much residue, then read as licence
to delete evidence. Both readings are now closed.** Warwick's own summary of the near-miss:
*"Good catch before we turned 'tidy' into 'where the fuck did the evidence go?'"*

**At completion the estate holds EXACTLY TWO CLASSES:**

### CLASS 1 — ACTIVE CANONICAL STATE. **There is exactly ONE: `main`.**

- primary working branch = **`main`** · **`main == origin/main`** · **clean primary checkout**
- **all current/intended implementation, documentation, Wayfinders, assurance and durable estate truth
  that belongs in the operating system is represented ON `main`**
- **no live runtime depends on another `Fusion247PKA` branch or worktree**
- no open PR carries forgotten required work
- **no ordinary feature/work branch carries current work missing from `main`**

### CLASS 2 — DELIBERATE REFERENCE / EVIDENCE STATE

**A non-`main` ref survives ONLY if EXECUTION proves ALL EIGHT:**

1. it contains **genuinely unique material**;
2. that material is **deliberately historical, experimental, frozen evidence, a recovery asset, or an
   executable harness** whose **exact historical form** has continuing evidential or recovery value;
3. it is **NOT the current production implementation**;
4. **no live runtime consumes it**;
5. **no current Wayfinder depends on development continuing on it**;
6. **merging it wholesale into `main` would incorrectly REACTIVATE, CONTAMINATE or MISREPRESENT**
   historical or experimental work;
7. **deleting it would destroy useful recoverability or exact evidence**;
8. **its reason for retention is written durably in the reconciliation record.**

**⛔ If ANY of the eight fails, it is NOT a reference branch.** Reconcile its useful content into `main`
and retire it.

### 🔒 THE PROTECTED-REFERENCE RULE

**A deliberately retained reference/evidence ref is NOT "unreconciled work". It is a CLASSIFIED
ARCHIVE/RECOVERY ARTEFACT**, and it does not count against convergence.

**The five named in `Deliverables/2026-08-14-reconciliation-record.md` are EXAMPLES of this class and MUST
NOT be deleted to hit a branch-count target** — the four BUILD-015 vision/prototype/harness refs and
`build-020/wo-readiness-validator`.

**⛔ But they are NOT permanent by naming.** Every future `/reconcile` **re-establishes their
classification BY EXECUTION against the eight tests.** They survive only while their value is neither
safely superseded nor preserved elsewhere.

### THE ORDINARY BRANCH RULE — everything else gets reconciled

For **every** local or remote non-`main` branch: **inspect ancestry AND content** · establish whether
`main` already contains it · **rescue any genuinely useful unique files, knowledge or implementation into
the correct canonical place on `main`** · **prove the preservation** · then retire it **locally AND
remotely**.

> **⛔ "Old", "merged-looking", "oddly named" or "previously ignored" is NEVER sufficient evidence for
> DELETION.**
> **⛔ "Useful someday" is NEVER sufficient evidence for RETENTION.**
> **There must be a SPECIFIC recoverability or evidence reason, established by execution.**

### WORKTREES — a reference branch does NOT justify a worktree

**At completion there is NO dormant feature worktree merely because its branch is retained as evidence.**
**Reference branches do not require live worktrees.** Retire every safe non-primary worktree **unless there
is a current OPERATIONAL reason for that worktree itself to exist.**

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
- **every EXECUTABLE file this estate operates from OUTSIDE the repository** — the approved private store
  ROOT `C:\.fusion247\` (root level, not its declared project subtrees), `~/.mypka/`, and **every off-repo
  script named in `.claude/settings*.json` hooks or permissions**. **Enumerate and name them; open
  nothing.** `GL-012` is NOT relaxed — this is a listing, not an inspection, and no secret is read.
  *(Added 2026-08-15. Three executable `.mjs` files sat loose at the private-store root through two
  convergence exercises that both reported CONVERGED. The pointers to them were inside the repository the
  whole time, in `.claude/settings.local.json`, as standing permission entries — unread, because a
  permission entry is not a Git object and not a bad source path.)*

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

## ⛔ THE ASSURANCE RULE — **Git convergence is not automatically assurance convergence.** Warwick, 2026-08-15.

**Canonical in root `CLAUDE.md` § "CONVERGE / CONVERGENCE" → "GIT CONVERGENCE IS NOT AUTOMATICALLY
ASSURANCE CONVERGENCE". Read it there. This is its executable form and defines nothing new.**

**Before reporting ANY of `reconciled` · `converged` · `closed` · `release-ready` or equivalent, establish
BY EXECUTION whether material executable/release state exists beyond the last applicable Veritas/Codex
boundary.**

How to establish it — cheaply, with what already exists:

1. Find the **last applicable external assurance boundary** for the affected build: the most recent SHA a
   Codex review actually covered, and its verdict. **A negative verdict is not a boundary.**
2. Diff `that SHA..HEAD` **restricted to the consequential surface** — executable code, migrations,
   runtime wiring, and any materially changed shared dependency the live journey relies on.
3. **If that restricted diff is empty, there is no assurance debt. Say so and continue.** This is the
   ordinary case and it must stay cheap.
4. **If it is non-empty, that is ASSURANCE DEBT.** Name it explicitly in the report and in the record.
   The estate is **NOT** reconciled while it stands, however clean the Git tree is.
5. **Establish BY EXECUTION that the route which PRODUCES that boundary is still the route in use — name
   the last review it actually produced, and when.** A proven review route that has silently stopped is
   assurance debt, not convergence. *(Added 2026-08-15: the BUILD-020 TowerBot review journey stopped
   being the observed route and no convergence exercise noticed, because a route that has quietly stopped
   creates no branch, no worktree, no stash, no PR and no bad source path — it creates NOTHING, and
   nothing is exactly what an enumeration-based scoreboard cannot count.)*

⛔ **This does NOT make Codex run on every `/reconcile`.** Documentation-only, pointer-only, receipt-only
and other non-consequential reconciliation **manufactures no gate at all** — do not open one.

⛔ **Build nothing to administer this.** No tracker, register, counter, watcher or control plane. The check
above is two git commands and a judgement. **If you find yourself building, you have misread it.**

**It binds regardless of how the work arrived** — direct integration to main, a local merge and push,
standing merge authority, `/reconcile` itself, or any path that created no PR/Tower trigger. **A missing PR
trigger must never again mean a missing external gate.**

## The runtime rule

**A converged Git tree is not enough if production still runs from an abandoned worktree.**

Establish whether any live runtime, scheduled task, watcher, service or installed component depends on a
feature worktree, a retired branch, or bytes that differ from canonical `main`. **Where an
already-authorised and understood realignment makes the runtime consume canonical `main`, perform it and
VERIFY it by execution.** ⛔ **Do not invent unrelated deployment work.**

> **⛔ COMPARE CONTENT, NOT RAW BYTES — the obvious method LIES.** `core.autocrlf=true` with no root
> `.gitattributes` means the working tree holds CRLF and git blobs hold LF. A raw `Get-FileHash` of an
> install against the **working tree** falsely reports a difference; against the **blob** it falsely
> reports a difference for anything installed from the working tree. **Normalise line endings and compare
> content**, or compare against the exact blob the install was made from — the install's own
> `INSTALLED-FROM.txt` records which. *(2026-08-15: Larry hit this and reported 7 of 10 governor modules
> stale. All ten were content-identical. `tools/governor/convergence-runtime-check.ps1` compares raw
> hashes against the working tree and reproduces the same false positive — a recorded defect in that
> script, not in the runtime.)*

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

## COMPLETE — and the report MUST distinguish these numbers. "N branches remain" is not a report.

```
ACTIVE branches                              : 1 — main
DELIBERATE REFERENCE/EVIDENCE refs           : <names and reasons, or none>
UNRECONCILED feature/work branches           : 0
active feature worktrees                     : 0
unexplained stashes                          : 0
forgotten-work PRs                           : 0
runtime dependencies on noncanonical checkouts: 0
main == origin/main                          : YES
ASSURANCE DEBT (executable state beyond the
  last applicable Veritas/Codex boundary)    : NONE — or the exact base..head and what it contains
executable code OUTSIDE the repository       : <n> — each path named and dispositioned
proven review/assurance routes NOT observed  : NONE — or each named with its last actual output
```

**⛔ THE TWO LINES ABOVE EXIST BECAUSE AN INSTRUCTION WITH NO REPORT LINE IS INERT, AND THAT IS DEMONSTRATED
HERE RATHER THAN ASSERTED.** The runtime rule below has carried the words *"or bytes that differ from
canonical `main`"* since this command's FIRST commit, and produced an answer **zero times** across three
report blocks — because no line ever asked for it. Every other line in this block is a **count over an
enumerated set**, so no line can be non-zero for something that was never enumerated: *"converged" gets
computed from what was inspected rather than from what exists.* **That is the failure these two lines
close, and adding an instruction without its line would repeat it.**

**⛔ The assurance line is NOT optional and NOT roundable.** `NONE` is earned by running the restricted
diff above, never assumed from a clean tree. **If it is anything other than `NONE`, the estate is NOT
reconciled** — report it as partial, name the debt, and name the owed route.

**That is Warwick's definition of a reconciled estate.** Every line established by execution.
**⛔ Anything not established by execution is reported as NOT established. Never rounded up.**
A partial convergence honestly reported, with the blocker named, is worth more than a false COMPLETE.

## The record

**Write one concise reconciliation record to `Deliverables/`** — what was inspected, what was unique, what
was integrated, what was retired and on what proof, **every Class-2 ref with the reason it passed all
eight tests**, and what remains open. **Commit and push it.**
