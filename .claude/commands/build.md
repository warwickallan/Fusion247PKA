---
name: build
description: "Resume a build by name. Resolves the build's canonical worktree, branch and next ticket from its own banked state, and moves the session there — or says precisely why it cannot."
user_invocable: true
---

# /build &lt;name&gt; — put this session on the named build

You are Larry. Warwick names a build and nothing else — `governor`, `018`,
`BUILD-018`, `session-governor`. Your job is to be in the right place, or to say
exactly what is wrong. **Warwick is not asked to operate anything** (AD-20).

## What to do

1. **Resolve the name.** From anywhere on this machine:

   ```
   node tools/governor/build-registry.mjs --refresh <name>
   ```

   `--refresh` re-indexes the estate first and needs a session inside it (or
   `--estate <path>`). Without `--refresh` it resolves from the existing index,
   which works from any directory — that is the point of the index.

2. **Read the exit code and do what it says.**

   | Exit | Meaning | What you do |
   |---|---|---|
   | `0` | Resolved. The block printed is the location. | If it says a move is required, do step 3. If it says you are already there, start work. |
   | `1` | **Cannot launch.** One named, specific fault. | Relay the refusal and its `WHAT HAPPENS NEXT` line. Fix the fault. Never guess a location. |
   | `2` | **BLIND** — no readable index. | Say so plainly, then re-index from inside the estate. A governor that cannot read its own state must get louder, not quieter (INV-1). |

3. **If a move is required, you perform it — AD-21, verbatim:**

   1. Call `EnterWorktree` with the worktree path the tool printed.
   2. Under Remote Control the approval prompt may appear **only in the local
      Claude terminal**. Tell Warwick IMMEDIATELY, in these words:
      **"Approve the pending EnterWorktree request in the local Claude terminal"**
   3. Wait for the approval. Do not spin silently. Do not carry on via absolute
      paths — writing the right files from the wrong repository state is exactly
      what the T-11 gate exists to stop.
   4. After entry, re-verify cwd, repository root and branch before writing.

4. **Then read the build's own state before acting.** The tool prints the state
   file path, the next ticket and the next action. `02-MAP.md` is the live
   execution SSOT (AD-17); the state document is a projection of it.

## Hard rules

- **Never ask Warwick to type a command into a shell.** Branches, worktrees,
  commits, pushes and PRs are yours end to end (AD-20). His standing gate is
  merge-to-main.
- **Never choose between candidates.** `AMBIGUOUS` and `CONTESTED WORKTREE` are
  refusals on purpose: two builds cannot own one worktree, and a launcher that
  picks one silently recreates the misfiling this build exists to prevent.
- **Never treat the index as the answer.** It only says which state file to open.
  Every location comes from re-reading that file — so a stale index can fail to
  find a build, but can never send you to the wrong one. Do not "helpfully" fall
  back to the indexed path when the state file is unreadable.
- **A refusal is not a suggestion.** Do not paraphrase `WORKTREE MISSING` into
  "it's probably fine, let's work from here".
