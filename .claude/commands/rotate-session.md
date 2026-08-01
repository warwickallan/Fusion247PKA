---
name: rotate-session
description: "Bank the current programme state, verify it is safe to rotate, write the canonical handoff, and tell Warwick the exact /clear command to type."
user_invocable: true
---

# /rotate-session — bank state, verify safety, hand off to a fresh session

You are Larry. This rotates the **conversation**, not the programme. It banks
everything a fresh Larry needs, proves the estate is safe to leave, and then
tells Warwick what to type. It is **not** a close-out.

## THIS IS NOT /close-session (INV-4, AD-13)

**Do NOT run `/close-session`. Do NOT write a programme session log. Do NOT run a
Librarian pass, a graduation, a ClickUp mirror, a Google Drive mirror, or the
Larry self-improvement review.** Those are end-of-programme acts. A rotation that
costs what a close costs will not get used, and an unused governor is worse than
none.

**Do NOT run `/clear` yourself** (INV-7). It is native and human-invoked. Your
last act is telling Warwick the exact thing to type.

## What to do

1. **Run the rotation tool.** From the programme's worktree:

   ```
   node tools/governor/rotate-session.mjs --model <the model you are running as>
   ```

   Add `--gh-repo <owner/name>` to include pull-request state, and
   `--dry-run` to assess safety without writing anything.

2. **Read its exit code and do exactly what it says.**

   | Exit | Meaning | What you do |
   |---|---|---|
   | `0` | Rotated. State banked, handoff written, both pushed. | Relay the `/clear` block **verbatim** to Warwick. |
   | `1` | **Refused** — the estate is not safe to rotate. | Relay the obstacles. Do **not** bank, do **not** tell Warwick to `/clear`. Fix them, or hand back. |
   | `2` | **BLIND** — durable state missing, corrupt, or unbankable. | Say so loudly. This is never "probably fine": a governor that cannot read its own state must get louder, not quieter (INV-1). |

3. **Never paraphrase a refusal into a suggestion.** If it refused, the session
   has state that is not banked. Saying "you could probably clear anyway" is the
   exact failure this build exists to prevent.

4. **Do not hand-edit the handoff.** `Team Knowledge/fusion-brief/session-handoff.md`
   is **derived** from `programme-state.json` (AD-12) and regenerated on every
   rotation. Editing it creates a second source of truth that the next rotation
   silently overwrites. Fix the state document instead.

## What the tool checks before it will bank (it can, and does, say no)

- Working tree clean — uncommitted work is not in the banked state.
- No unpushed commits — banked state is not durable until it is on the remote (INV-3).
- No live worker in this worktree — rotating out from under a running worker splits it.
- HEAD readable, worktrees readable, and every safety-critical field actually gathered.

**Unknown is never treated as safe.** A field it could not read is an obstacle, not
a pass — the same rule that makes `BLIND` a first-class state (INV-1, AD-3).

## After a successful rotation

Relay to Warwick, verbatim, the block the tool printed. It contains the `/clear`
command, the exact next action, the worktree, the branch, the ticket and the model
recommendation. Then stop. **Warwick types `/clear`, not you.**
