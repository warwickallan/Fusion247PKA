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

### The session report — steps 5 to 8. **Added by Warwick, 2026-08-06, and they are not optional.**

> **His reason, and it is the whole point: deferring the report to the fresh session LOSES session-specific evidence that has not yet become a durable artefact.** A rotation is the last moment that evidence exists. **After `/clear` it is gone, and no fresh Larry can reconstruct it.**

**5. Commission Pax to produce the performance/process report for the session being closed.** **Pax writes it, not Larry** — the session cannot be its own sole witness. Commission it through the normal Work Order route. **What the report must cover, at minimum:**

   - **Work Order evidence** — every order issued, its verdict, and whether the worker began substantive work on first dispatch;
   - **rework and refusals** — every `REFUSE`, `CLARIFY` and amendment round trip, with the class of each and whether it was preventable;
   - **notification misses** — every occasion a ding was owed and not sent, or sent for routine narration;
   - **parent-channel availability and queued messages** — whether the channel was reachable, and anything that queued rather than delivering;
   - **token and context economics** — measured figures read from the instrument, **never estimated**;
   - **any other recorded delivery-tax findings** from the session.

**6. WAIT for Pax's return.** **Do not proceed to the continuity publish without it.** A commissioned worker whose return you never read is unbanked work — step 1's rule applies to this dispatch as much as any other.

**7. Write and commit the report as a Git artefact under `Deliverables/`.** ⛔ **NOT Google Drive. NOT Google Sheets. NOT a Supabase row.** The repository is the durable store, and a report that lives anywhere else is not recoverable from Git and the map alone — which is step 9's first bar.

**8. Add the report POINTER to the active Wayfinder**, and commit it. The map must name the report by path, so the fresh session finds it without being told.

---

**9. Publish continuity through the INSTALLED production Honcho write path** — `~/.mypka/governor/continuity.mjs write`, never a repo copy. **Derive every field from the updated Wayfinder, not from narrative memory.** Step 2 happens before this for exactly that reason: the map is the source, the packet is a pointer to it. **The packet must carry the report pointer too.**

**10. Read it back through the INSTALLED production Honcho reader** — `~/.mypka/governor/continuity.mjs read`. **A write that reports success is not a delivery. Only the read-back is evidence.**

**11. Verify the read-back MATCHES the Wayfinder** on four things: **map path · phase/frontier · exact next action · the report pointer.** Compare them; do not eyeball one and assume the rest.

**12. Return `SAFE TO CLEAR`** only when **all six** hold:
   - the work is recoverable from Git and the map alone;
   - **no required worker result is outstanding**;
   - Git state is durable — pushed, or deliberately not and classified as such;
   - **the report Deliverable EXISTS on disk and is committed**;
   - **the report pointer is in the Wayfinder and in the packet**;
   - **the Honcho read-back matches.**

**13. Otherwise own the correction and repeat the check.** **`NOT SAFE TO CLEAR` is only for a genuine unresolved blocker** — something you cannot fix from here. A stale packet, an unpushed commit, an unread worker return or **a missing report** are **yours to fix and re-verify**, not reasons to hand Warwick a failure.

**14. The fresh side is the acceptance test.** After `/clear`, `Continue.` must orient through Honcho to the active Wayfinder and **resume the recorded next action autonomously** — without Warwick reconstructing or choosing the route.

## The report

**Tell Warwick the verdict and nothing decorative.** On `SAFE TO CLEAR`, state the merged or integrated SHA, the map path, and the exact next action the fresh session will resume — so he can check the read-back himself if he wants to.

**Say plainly what is parked and what is unproven.** A rotation that hides a loose end is worse than one that names it.

## Bars

- **No new mechanism.** This wraps what exists.
- **The session report is a GIT ARTEFACT under `Deliverables/`.** ⛔ **Never Google Drive, never Google Sheets, never a Supabase row** (Warwick, 2026-08-06). Anything outside the repository fails the first `SAFE TO CLEAR` bar — *recoverable from Git and the map alone.*
- **Do NOT build Supabase reporting inside `/rotate`.** Populating or querying these reports in Supabase is **a separate job for a fresh session**, explicitly deferred by Warwick. Adding it here is the regrowth cap firing.
- **Pax writes the report; Larry does not.** A session grading its own performance is the thing this step exists to avoid. **Larry commissions, waits, commits and points at it.**
- **Never report `SAFE TO CLEAR` with the report missing.** It is a hard bar, not a nice-to-have — **the evidence it captures ceases to exist at `/clear`**, which is the entire reason the step is inside the transaction rather than after it.
- **Never report `SAFE TO CLEAR` on a write result alone.** The read-back is the evidence, and this is the whole reason the command exists.
- **Never derive the packet from memory.** The Wayfinder is the source. If the map and your recollection disagree, **the map wins and your recollection is the defect.**
- **Do not fabricate a next action.** If the map does not ground one, that is a step 9 correction — fix the map first.
