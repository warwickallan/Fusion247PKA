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

**5. Commission Pax to produce the performance/process report for the session being closed.** **Pax writes it, not Larry** — the session cannot be its own sole witness. Commission it through the normal Work Order route. **What the report must cover, at minimum** (keep every existing requirement below **and** every mandatory output in the following list — they are additive, not alternatives):

   - **Work Order evidence** — every order issued, its verdict, and whether the worker began substantive work on first dispatch;
   - **rework and refusals** — every `REFUSE`, `CLARIFY` and amendment round trip, with the class of each and whether it was preventable;
   - **notification misses** — every occasion a ding was owed and not sent, or sent for routine narration;
   - **parent-channel availability and queued messages** — whether the channel was reachable, and anything that queued rather than delivering;
   - **token and context economics** — measured figures read from the instrument, **never estimated**;
   - **any other recorded delivery-tax findings** from the session.

   **Mandatory outputs (Warwick, 2026-08-06 — additive; every row required; no estimates — never invent a number):**

   - **opening and closing context/token readings**;
   - **total measured context/token movement**;
   - **elapsed session time**;
   - **per-specialist dispatch counts and token usage** where exposed — **and Larry MUST supply the subagent ledger below rather than leaving Pax to report it UNESTABLISHED;**
   - **evidenced allocation** across product implementation, Work Order/admin, assurance/evidence, rework and waiting;
   - **parent-channel availability, response latency and queued Warwick messages** where measurable;
   - **Work Order first-dispatch success, amendments, refusals and preventable-failure analysis**;
   - **documentation-versus-product change volume** across the complete session range;
   - **explicit `UNESTABLISHED`** for every unavailable metric.

   **Same session identity for both artefacts.** The Git Markdown report and the Supabase payload (step 7 / 7b) **must describe the same session, branch and exact closing head** — no mismatched SHAs, no partial ranges, no second invented window.

**5b. BEFORE commissioning Pax, build the SUBAGENT LEDGER and hand it to him as an input.** **Warwick, 2026-08-08, after Pax reported per-specialist token usage `UNESTABLISHED` in TWO CONSECUTIVE reports.** Larry holds this data and Pax cannot see it — every `Agent` return emits a `<usage>` block. **Leaving Pax to report it unestablished when Larry could have supplied it is the failure this step closes.**

   Write it to `Deliverables/<date>-subagent-token-ledger-<session>.md`, commit it, and name it in the Pax dispatch. **Reconstruct EVERY return and group by agent ID** — do not simply sum a totals column. Per return record: **agent type · agent ID · fresh or resumed · dispatch number · reported usage fields · tool uses · duration · model if available.**

   **Then determine EMPIRICALLY whether repeated returns for one agent ID are per-dispatch or cumulative, and state which the evidence supports.** *(Observed 2026-08-08: `subagent_tokens` was CUMULATIVE per agent while `tool_uses` and `duration_ms` were PER-DISPATCH — proven by monotonicity across all resumed agents, by `tool_uses` NOT being monotonic, and by token deltas tracking per-dispatch tool counts. **Re-test it; do not assume it still holds.** Getting it wrong inflated the total by ~80 %.)*

   **Give Pax three totals, never one blended number:**
   - **A — deduplicated subagent token traffic** attributable to the session;
   - **B — peak/final context footprint per persistent agent**, so oversized background agents are visible;
   - **C — dispatch count and tool-use count per agent**, so cost can be related to actual work.

   ⛔ **Keep Larry's own context SEPARATE and never add it to A.** Context occupancy is a **level**; subagent traffic is a **flow**. Summing them produces a meaningless "total tokens". A ratio is the only honest joint statement. **State every uncertainty explicitly** — including that the ledger is Larry-transcribed rather than independently instrumented, and any agent that emitted no usage block is **unmeasured, not zero**.

**6. Pax is NOT on the blocking path. Bank first; read his return whenever it lands.** *(Re-cut 2026-08-08, Sub-phase 4D. This step read **"WAIT for Pax's return. Do not proceed to the continuity publish without it."**)*

> **⛔ WHY THE OLD WORDING WAS THE DEFECT, not a safeguard.** It made the **durable** part of the transaction (steps 9–11: publish continuity, read it back, verify it matches the Wayfinder) wait behind the **analytical** part. On 2026-08-08 the analysis ran, the session hit its closing hour, and **steps 9–11 were skipped entirely** — publishing a six-hour-stale packet with no map pointer into a fresh session. **Raw capture is time-critical; analysis is not.** Ordering them the other way round put the one irreversible thing last.
>
> **It also contradicted itself.** The map's `OUTSTANDING ON ARRIVAL` block is written for a Pax dispatch that *"may return AFTER the `/clear`"* — a return that outlives the clear cannot also be a precondition of it.
>
> **The banking obligation is UNCHANGED.** A commissioned worker whose return is never read is still unbanked work. **When his report arrives — this session or the next — write it to `Deliverables/`, commit it, and fold it into the record.** What changes is only the ORDER: durable state first, enrichment second.

**5c. HAND PAX THE EXACT OPENING BRIEF, and require the comparison.** *(Warwick, 2026-08-08 — "the most important process correction". This is the arm that turns a record into a loop.)*

   **The file is `~/.mypka/governor/capae-opening.json`**, snapshotted by the SessionStart hook BEFORE anything can overwrite it. **`capae-active.json` is NOT a substitute**: `capae-sync.mjs` rewrites it at every rotation, so by the time Pax is asked whether these preventions held, that file describes the brief the NEXT session will get — comparing behaviour against it would judge Larry by a warning he never received. **If the snapshot is absent, say so and grade nothing** rather than reaching for the live brief.

   **For EVERY family in that opening brief, Pax must answer six questions, separately and by name:**

   1. **What Larry was told** — the family, and the cause / remedy / required behaviour as the opening brief carried them.
   2. **Did a qualified exposure occur?** — `clean` · `recurrence` · `none-this-session` · `unmeasurable-at-this-frequency`. **These four words are the whole vocabulary and there is no fifth**; anything else is rejected by `capae-sync.mjs` and written nowhere.
   3. **What did Larry actually do?** — **EVIDENCE, not Larry's own assertion.** Commits, diffs, tool calls, the transcript. Larry's summary of his own conduct is the thing this step exists to bypass.
   4. **Did the prevention hold?**
   5. **Compared with the PREVIOUS qualified exposure** — `improved` · `unchanged` · `degraded` · `no comparable prior exposure`.
   6. **Is the same error still repeating DESPITE being in Larry's starting context?** — the single most valuable line in the whole loop, because it distinguishes "he did not know" from "he knew and did it anyway", and only the second justifies changing anything.

   **The report carries an EXECUTIVE CAPAE paragraph in Warwick's shape**, e.g. *"4 active risks were loaded into Larry at session start. 3 had qualified opportunities. 1 prevention held. 2 recurred despite being in the opening brief. Work Order generation improved versus the previous exposure. Map reconciliation did not improve and remains repeated."*

   ⛔ **This is ANALYSIS, not enforcement.** Nothing here forces Larry to obey the brief, and nothing may grow into a compliance engine. **No new store, no new table, no register** — the answers ride in the findings Pax already writes, and `capae-sync.mjs` already consumes them.

**6b. Name the FAMILY on every material finding.** *(Sub-phase 4D — this is the whole of CAPAE's mechanism, and it is one string.)* Each finding Pax records carries a stable `family` slug, reusing the slug a previous occurrence used rather than minting a new one for the same cause. **Two events share a family if and only if the SAME PREVENTION would have addressed both** — i.e. they share a **CAUSE**. ⚠️ **A shared detection surface or escape route is NOT family identity**; grouping by "the gate was skipped" merges unrelated causes and yields a remedy that fixes none of them. **Recurrence is that slug appearing again in a later rotation. The occurrence count is a QUERY over `session_report.rotation.findings` — not a register anybody maintains, and not a new table.**
>
> **Also record, per family, whether this session presented a QUALIFIED EXPOSURE** — a genuine opportunity where the stated prevention should have worked. `clean` · `recurrence` · `none-this-session` · or **`unmeasurable-at-this-frequency`**. ⛔ **A family whose exposures are too rare to accumulate must say so rather than carry a counter that cannot advance** — *"we haven't seen it lately"* is explicitly NOT effectiveness. **Do not manufacture work to create an exposure.**

**7. Write and commit the report as a Git artefact under `Deliverables/`.** ⛔ **NOT Google Drive. NOT Google Sheets as the only store.** The repository Markdown Deliverable is the human-readable durable report. **Also build a machine payload** (`Deliverables/YYYY-MM-DD-session-report-payload.json`) with the same session, branch and closing head fields for Supabase population (step 7b).

**7b. Populate Supabase from the same evidence** — `node tools/session-report/populate.mjs --file <payload.json>`. Schema: `tools/session-report/schema.sql`. Credentials self-load from the approved runtime. **Success and failure must both be visible** (stdout/stderr JSON + `~/.mypka/governor/session-report-populate.jsonl`). A credentials-absent or post failure is a **recorded FAIL**, never silent success. Do not invent a green outcome.

**7c. Update the CAPAE record from this rotation's findings.** `node tools/session-report/capae-sync.mjs <payload.json> [rotation_id]` — for every finding that names a `family`, it appends ONE occurrence and updates that family. ⛔ **An UNRECOGNISED slug is REPORTED and skipped, never created** (exit 3): naming a new family is a judgement about cause, and a judgement is not a script — name it deliberately or fix the slug. It also rewrites the tiny precomputed active brief a fresh Larry is handed at session start, so this rotation is reflected there without any query at hook time. **Visible success or visible failure only.**

**8. Add the report POINTER to the active Wayfinder**, and commit it. The map must name the report by path **and the closing head**, so the fresh session finds it without being told.

---

**9. Publish continuity through the INSTALLED production Honcho write path** — `~/.mypka/governor/continuity.mjs write`, never a repo copy. **Derive every field from the updated Wayfinder, not from narrative memory.** Step 2 happens before this for exactly that reason: the map is the source, the packet is a pointer to it. **The packet must carry the report pointer and exact closing head.**

**10. Read it back through the INSTALLED production Honcho reader** — `~/.mypka/governor/continuity.mjs read`. **A write that reports success is not a delivery. Only the read-back is evidence.**

**11. Verify the read-back MATCHES the Wayfinder** on: **map path · `focus` · phase/frontier · exact next action · the report pointer · closing head.** Compare them; do not eyeball one and assume the rest.

> **`focus` added 2026-08-07 (Warwick's approved single improvement).** It was the only unchecked field in the packet and `continuity.mjs` renders it **first** — so it is the most-read line in a fresh Larry's brief, and both recorded misorientations travelled through it. It is free text, which is exactly why an unchecked one can misdirect.

**11b. If the read-back does NOT match, the map is what gets fixed — before anything else.** *(Sub-phase 4D, making step 13's existing bar impossible to skim past.)* **A mismatch on `map path`, `focus`, phase or next action is a STEP-13 CORRECTION, not a note to carry forward.** ⛔ **And a `continuity.json` older than the closing head is itself a mismatch**: the packet is built from that file, so stale state cannot produce a fresh packet no matter how carefully the publish is performed. *(On 2026-08-08 it was six hours stale and none of steps 9–11 ran.)*

**12. Return `SAFE TO CLEAR`** only when **all seven** hold:
   - the work is recoverable from Git and the map alone;
   - ~~**no required worker result is outstanding**~~ → **every DURABLE artefact is banked, and any outstanding worker return is NAMED in the packet and on the map as outstanding.** *(Re-cut 2026-08-08 with step 6. An analytical return that may legitimately arrive after the `/clear` cannot be a precondition of it — but it must never become invisible either. Named-and-outstanding is the bar; silence is not.)*
   - Git state is durable — pushed, or deliberately not and classified as such;
   - **the report Deliverable EXISTS on disk and is committed**;
   - **Supabase population succeeded OR failed visibly with a durable log line** (never silent);
   - **the report pointer is in the Wayfinder and in the packet**;
   - **the Honcho read-back matches.**

**13. Otherwise own the correction and repeat the check.** **`NOT SAFE TO CLEAR` is only for a genuine unresolved blocker** — something you cannot fix from here. A stale packet, an unpushed commit, an unread worker return or **a missing report** are **yours to fix and re-verify**, not reasons to hand Warwick a failure.

**14. The fresh side is the acceptance test.** After `/clear`, `Continue.` must orient through Honcho to the active Wayfinder and **resume the recorded next action autonomously** — without Warwick reconstructing or choosing the route.

## The report

**Tell Warwick the verdict and nothing decorative.** On `SAFE TO CLEAR`, state the merged or integrated SHA, the map path, and the exact next action the fresh session will resume — so he can check the read-back himself if he wants to.

**Say plainly what is parked and what is unproven.** A rotation that hides a loose end is worse than one that names it.

## Bars

- **No new mechanism.** This wraps what exists.
- **The session report is a GIT ARTEFACT under `Deliverables/`.** That remains the human-readable SSOT. Supabase is a **mirror populated from the same payload** (Warwick WP, 2026-08-06) — never the only store, never a second inventing source of truth.
- **Supabase population runs at `/rotate` step 7b** via `tools/session-report/populate.mjs`. Visible success or visible failure only.
- **Pax writes the report; Larry does not.** A session grading its own performance is the thing this step exists to avoid. **Larry commissions, commits and points at it — he does NOT wait for it.** *(Re-cut 2026-08-08, Sub-phase 4D, IN THE SAME COMMIT as the steps it contradicted. This line said "commissions, **waits**, commits" and the line below made the report a hard precondition of `SAFE TO CLEAR` — both were left standing when steps 6 and 12 took Pax off the blocking path. An amendment whose contradicted rows are not re-cut is the family `record-amended-body-not-recut`, and leaving it in the document that DEFINES that family is the sharpest possible version of the defect.)*
- ~~**Never report `SAFE TO CLEAR` with the report missing.**~~ ⛔ **SUPERSEDED — see step 6 and step 12.** `SAFE TO CLEAR` means *sufficient truthful continuity exists for a fresh session to resume safely*. **An outstanding Pax return is NAMED in the packet and on the map, never silently absent — but it does not hold the door shut.** A slow or unavailable Pax must never stop Larry preserving state, rotating, or remaining available.
- **Never report `SAFE TO CLEAR` on a write result alone.** The read-back is the evidence, and this is the whole reason the command exists.
- **Never derive the packet from memory.** The Wayfinder is the source. If the map and your recollection disagree, **the map wins and your recollection is the defect.**
- **Do not fabricate a next action.** If the map does not ground one, that is a **step 13** correction — fix the map first. *(Was "step 9" before the report steps were inserted; corrected 2026-08-06, Veritas V4-8.)*
