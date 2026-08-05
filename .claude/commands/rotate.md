---
name: rotate
description: "The single pre-/clear transaction. Bank everything, publish continuity through the installed Honcho write path, read it back, and report SAFE TO CLEAR or NOT SAFE TO CLEAR."
user_invocable: true
---

# /rotate — the single generic pre-`/clear` transaction

You are Larry.

> **Restored by Warwick, 2026-08-06.** *"Restore `/rotate` as the single generic pre-`/clear` transaction… Do not create another service, agent, store, registry, footer or governance layer. Reuse the existing `/close-session`, Wayfinder and installed Honcho components."*

**This is a WRAPPER, not a new mechanism.** It reuses `/close-session`'s banking logic, the active Wayfinder, and the **installed** Honcho components at `~/.mypka/governor/`. **The only thing it adds is the publish-and-readback gate that was missing** — the step whose absence let a continuity packet sit 13 hours stale through an entire phase of work, with a correct map pointer and a wrong phase.

**Nothing here creates a service, agent, store, registry, footer or governance layer. If you find yourself building one, you have misread this file.**

## Why it exists — the failure it closes

**A `/clear` is irreversible with respect to context.** Everything not durable at that moment is gone. The estate has already paid for this twice: once when a fresh Larry was handed a confident BUILD-015 orientation for BUILD-020 work, and once when the stored focus named a phase that had closed the day before. **Both times the map pointer was correct and the orientation was wrong**, which is the more dangerous failure — a blank start announces itself, a confident wrong one does not.

## What to do, in order

**1. Finish or safely pause all in-flight work.** Collect **every** required worker result. A dispatched specialist whose return you never read is unbanked work. **If a worker is mid-flight and cannot finish, say what it was doing and where its branch is — do not silently drop it.**

**2. Update the active Wayfinder** with the truthful **phase, gate, frontier, exact next action, branch and head**, and the **deliberately parked residue**. Parked is a decision and must look like one; **silence reads as forgotten.**

**3. Complete the tests and assurance the active phase already requires.** Not new ones. If a gate is owed and unmet, that is a finding for step 9, not a reason to invent a substitute.

**4. Commit and push all intended work**, and **classify any deliberate dirty or unpushed state.** Unclassified dirt is indistinguishable from an accident.

**5. Publish continuity through the INSTALLED production Honcho write path** — `~/.mypka/governor/continuity.mjs write`, never a repo copy. **Derive every field from the updated Wayfinder, not from narrative memory.** Step 2 happens before step 5 for exactly this reason: the map is the source, the packet is a pointer to it.

**6. Read it back through the INSTALLED production Honcho reader** — `~/.mypka/governor/continuity.mjs read`. **A write that reports success is not a delivery. Only the read-back is evidence.**

**7. Verify the read-back MATCHES the Wayfinder** on three things: **map path · phase/frontier · exact next action.** Compare them; do not eyeball one and assume the rest.

**8. Return `SAFE TO CLEAR`** only when **all four** hold:
   - the work is recoverable from Git and the map alone;
   - **no required worker result is outstanding**;
   - Git state is durable — pushed, or deliberately not and classified as such;
   - **the Honcho read-back matches.**

**9. Otherwise own the correction and repeat the check.** **`NOT SAFE TO CLEAR` is only for a genuine unresolved blocker** — something you cannot fix from here. A stale packet, an unpushed commit or an unread worker return are **yours to fix and re-verify**, not reasons to hand Warwick a failure.

**10. The fresh side is the acceptance test.** After `/clear`, `Continue.` must orient through Honcho to the active Wayfinder and **resume the recorded next action autonomously** — without Warwick reconstructing or choosing the route.

## The report

**Tell Warwick the verdict and nothing decorative.** On `SAFE TO CLEAR`, state the merged or integrated SHA, the map path, and the exact next action the fresh session will resume — so he can check the read-back himself if he wants to.

**Say plainly what is parked and what is unproven.** A rotation that hides a loose end is worse than one that names it.

## Bars

- **No new mechanism.** This wraps what exists.
- **Never report `SAFE TO CLEAR` on a write result alone.** The read-back is the evidence, and this is the whole reason the command exists.
- **Never derive the packet from memory.** The Wayfinder is the source. If the map and your recollection disagree, **the map wins and your recollection is the defect.**
- **Do not fabricate a next action.** If the map does not ground one, that is a step 9 correction — fix the map first.
