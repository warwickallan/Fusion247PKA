---
type: deliverable
created: 2026-07-15T16:30:00Z
agent_id: larry
linked_workstreams: [WS-004-team-retro-and-self-improvement-loop]
linked_sops: [SOP-close-task, SOP-004-vex-security-audit, SOP-019-fusion-delivery-tracking, SOP-018-independent-change-qa]
linked_guidelines: []
status: proposed
---

# Team Retro — Ranked Improvement Proposals (2026-07-15)

## Scope of this mining pass

Per [[WS-004-team-retro-and-self-improvement-loop]] Tier 2, Step 1: read both substantive `Team/Larry - Orchestrator/journal/` entries (all other specialist journals are still `_template.md` only — no entries yet to mine there), the full chain of close-session logs from 2026-07-10 through 2026-07-15 (session-logs for 07-10 through 07-15, plus the detailed 2026-07-12-23-00 close-session log covering that day end-to-end), Vex's PR2 audit session log, and the open/closed task record (`Team Knowledge/tasks/INDEX.md`). No prior retro document exists — this is the first Tier 2 run.

This document **proposes only**. Nothing below changes any file until Warwick approves a subset.

---

## Ranked proposals

### 1. Add a mandatory pre-send verification checklist to Larry's own contract
**Pattern (repeated anti-pattern):** Status/progress claims sent before the underlying fact was actually verified, caught by Warwick's direct correction, not self-caught — at least four separate instances across two sessions:
- Fusion Health PR2 session (2026-07-13): "your last visible response breached the standing reporting rule and there is no replacement APK yet... Do not report 'ready for device test' until the release exists" — twice in the same session, including a repeat of the same class of mistake (status before CI completion confirmed; ID omitted from line one while CI still running).
- Fusion Health unified-dashboard session (2026-07-15): "Do not state 'I'm watching CI / I'll follow up automatically'... unless an actual automation, scheduled job or continuing executable process has been created and identified" — a related but distinct instance of the same root cause (asserting a state as true without having verified it against something real).
- Earlier: the `NPL`→`BRK-001` anonymization mistake (2026-07-12) was a different flavor of the same root cause — acting on an assumption instead of checking, five rounds of rework resulted.

**Evidence:** [[2026-07-13-23-00_larry_fusion-health-pr2-merge-wp1-close]], [[2026-07-15-07-30_larry_fusion-health-unified-dashboard-park]], [[2026-07-12-23-00_larry_close-session]].

**Proposed change:** Add an explicit, standing pre-send checklist to `Team/Larry - Orchestrator/AGENTS.md` (alongside the existing Build Log ID response rule): before any reply that reports status, progress, or a monitoring claim, confirm (a) the specific claim was just verified against real tool/CI output in this turn, not carried forward or assumed, and (b) if a logged ID exists for this unit of work, it opens line one. This is the same rule already partially present (Build Log ID rule) but the recurrence — twice in one session, then a related variant two sessions later — shows the existing rule isn't catching the whole failure class. Generalize it from "always lead with the ID" to "always verify before asserting."

**Artifact touched:** `Team/Larry - Orchestrator/AGENTS.md`
**Named implementer:** Larry
**Rank rationale:** Highest recurrence (4 instances, 3 sessions), each one caught only by Warwick, none self-caught — the clearest case of a real, unresolved, expensive-to-repeat gap.

---

### 2. Consolidate known ClickUp tool quirks into one reference section
**Pattern (repeated friction / rediscovery cost):** The same category of "ClickUp tool doesn't behave as expected" surfaced three separate times, each rediscovered fresh rather than checked against a standing note:
- Native ClickUp connector unreliable for chat reads all session (2026-07-12, close-session log).
- `clickup_update_list`'s `status` field fails with a genuine server error while `content` updates work fine (2026-07-13, PR2 merge/close session) — "not something Larry can fix... flagging... but not currently blocking."
- Fetching ClickUp document pages in `text/plain` strips markdown tables to blank; `text/md` does not — a format artifact, not data loss (2026-07-15, Handbook close).

**Evidence:** [[2026-07-12-23-00_larry_close-session]], [[2026-07-13-23-00_larry_fusion-health-pr2-merge-wp1-close]], [[2026-07-15-16-00_larry_fusion247-handbook-population-close]].

**Proposed change:** Add a short "Known ClickUp quirks" subsection to [[SOP-019-fusion-delivery-tracking]] (its natural home, since it already owns the ClickUp/GitHub tracking mechanics) listing: chat-read unreliability (use Zapier bridge), List `status` field write failures (use `content` field as authoritative, don't retry indefinitely), and `text/plain` fetch stripping tables (re-fetch as `text/md` before concluding content is corrupted). Cheap to write, saves real rediscovery time.

**Artifact touched:** `Team Knowledge/SOPs/SOP-019-fusion-delivery-tracking.md`
**Named implementer:** Larry (SOP-019 owner)
**Rank rationale:** Three independent rediscoveries of tool-specific friction, no cost to fix, directly reusable next session.

---

### 3. Write down the structural-vs-substantive sorting heuristic for bundled QA/audit gaps
**Pattern (recipe that cleared the bar, not yet graduated):** When [[tsk-2026-07-10-006-verifiair-content-integrity-qa-gap-proposal]] bundled four failure modes under one label, the instinct to pick a single owner for the whole gap was wrong; splitting by "does this check require only on-disk graph information (structural, cheap, automatic) or verification against something external (substantive, expensive, on-demand)" was the approach that actually worked and was captured as a durable journal insight, but it hasn't graduated beyond Larry's own journal into anything another specialist or a future Larry-instance would automatically re-read.

**Evidence:** [[2026-07-11-content-integrity-qa-three-way-split]] (journal entry), [[tsk-2026-07-10-006-verifiair-content-integrity-qa-gap-proposal]], [[SOP-017-content-integrity-audit]].

**Proposed change:** Add a short "Handling a bundled QA/audit gap" note to `Team/Larry - Orchestrator/AGENTS.md` restating the heuristic (sort each named failure mode by structural-vs-substantive cost before asking "who owns this"; structural → automatic pass; substantive → on-demand with a periodic-nudge trigger contract; any implicit boundary/authorization rule → write it down immediately regardless). This is a general orchestration heuristic, not specific to SOP-017, so Larry's own contract is the right home.

**Artifact touched:** `Team/Larry - Orchestrator/AGENTS.md`
**Named implementer:** Larry
**Rank rationale:** One instance so far, but the insight is already validated and cheap to graduate; low risk, clear reusability the next time a gap bundles multiple failure modes.

---

### 4. Add "check literal success criteria, not accumulated scope" to SOP-close-task
**Pattern (recipe that cleared the bar, not yet graduated):** `tsk-2026-07-10-001` grew into the running decisions log for an entire migration arc, which made it feel too big to close — but its own written `## Success criteria` were met, and the right move was to close it and let its still-open children (`tsk-004`, `tsk-005`) continue independently. This is a general task-hygiene principle, not particular to that one task.

**Evidence:** [[2026-07-11-close-on-literal-criteria-not-accumulated-scope]] (journal entry), [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]].

**Proposed change:** Add one clarifying line to [[SOP-close-task]]: when a long-running task's closure feels ambiguous because of everything logged inside it, check its own written `## Success criteria` verbatim first — met criteria close the task even if it accumulated a large narrative, and a closed parent does not require its still-open children (tracked via `parent:`) to close too. Also note the boundary case already captured in the journal: stale criteria (written for a narrower job than the task grew into) should be rewritten, not used as an excuse to keep the task open indefinitely.

**Artifact touched:** `Team Knowledge/SOPs/SOP-close-task.md`
**Named implementer:** Larry
**Rank rationale:** One instance, cheap, clear — ranked below #3 only because it's slightly more narrowly scoped (task closure specifically vs. Larry's general orchestration judgment).

---

### 5. Formalize "budget for device-test correction rounds" into SOP-004
**Pattern (recipe that cleared the bar, evidenced repeatedly within one arc):** Fusion Health PR2 passed CI and a full Vex security review, then failed on a real device four separate times in sequence (permission-registration/activity-alias, pagination, empty-string page-token, steps-count semantics) — each requiring its own correction round and its own Vex delta review. Vex's own session log already recommends this "for next time" but only inside that one dated entry, not as a standing SOP expectation.

**Evidence:** [[2026-07-13-18-45_vex_fusion-health-pr2-health-connect-audit]], [[2026-07-13-23-00_larry_fusion-health-pr2-merge-wp1-close]] ("Device testing surfaces defects code review and CI cannot... proven, not theoretical").

**Proposed change:** Add a line to [[SOP-004-vex-security-audit]]: when a build depends on real hardware/OS integration (not just unit-testable logic), scope the review to expect multiple post-CI, device-test-driven correction rounds, each re-reviewed as a narrow delta against that round's diff — CI-green and a clean initial review are not sufficient signals of done for hardware-dependent work.

**Artifact touched:** `Team Knowledge/SOPs/SOP-004-vex-security-audit.md`
**Named implementer:** Vex (SOP-004 owner)
**Rank rationale:** Strongly evidenced (5 correction rounds, one arc) but scoped to hardware-dependent build work rather than the core myPKA framework — genuinely useful, ranked last because its applicability is narrower than the other four.

---

## Not proposed (validated patterns already working, no action needed)

- **Multi-round independent review discipline** ([[SOP-018-independent-change-qa]]) — already graduated and already being reapplied successfully (caught Larry's own stale Handbook drafts on 2026-07-15, the exact "same-model review is not independent review" case SOP-018 exists to prevent). No further action; noted here as evidence the graduation pathway (session learning → SOP) works as designed.
- **Handbook maintenance discipline** ([[SOP-020-keep-fusion247-handbook-current]]) — same graduation pathway, already landed this week. No further action.

## No dead/unfollowed SOPs found this cycle

Nothing in this mining pass showed a procedure being routinely worked around or ignored. Worth re-checking in the next retro once more session volume accumulates.

---

## Next steps

Present this ranked list to Warwick. Per WS-004 Tier 2 Step 4, approval is per-item, not all-or-nothing — any subset (including none) is a valid outcome. Approved items route to their named implementer (Steps 5–6); unapproved items stay here as backlog for the next retro (Step 4 edge case).
