# SOP: Keep the Fusion 247 Handbook Current

- **Status:** Active (since 2026-07-15, per Warwick's explicit instruction after the initial Handbook population was accepted: "keep this updated whenever we add new features and functionality").
- **Default owner:** Larry. Reusable by any specialist who closes a delivery item, since the trigger is "a feature/capability changed," not a fixed owner's task.
- **Triggered by:** any of the following becoming true for Fusion 247 — functionality being **added**, **materially changed**, **replaced**, **retired**, or **newly accepted** all count as triggers, not just net-new features:
  - a capability page (ClickUp Handbook `08.xx`) gains new user-visible functionality, a new dependency, a new security/privacy posture, a status change (e.g. PARKED → active, PARTIAL → COMPLETE, PLANNED → IMPLEMENTED), or a version bump — **added/materially changed**;
  - an existing mechanism, tool, or dependency a Handbook page describes is **replaced** by another (e.g. one library, provider, or approach swapped for a different one) — the page must be updated to describe the replacement, not merely to append a note about the old one;
  - a feature, integration, or capability a Handbook page describes is **retired, deprecated, or removed** — the page must say so plainly (never leave a retired capability described as if still active) and the Tracker's status/gaps columns updated to match;
  - a shared operating page's subject matter changes (a new specialist hired, a new platform/integration added, a governance/delivery rule changes, a new decision/reversal/lesson worth recording);
  - a BUILD/PR merges that a Handbook capability page describes (e.g. Fusion Health, VlogOps) — **newly accepted functionality**;
  - a Foundry IDEA is promoted, parked, or rejected;
  - an open Tier-1 recommendation/direction-decision referenced from a Handbook page (e.g. AsdAIr, CareerAIr) is approved, amended, or declined by Warwick.
- **References:** ClickUp `Fusion 247 Handbook` doc (`2kxuxw3a-812`) — `01 — Handbook Maintenance Contract`, `01A — Initial Handbook Population Brief`, `99 — Capability Page Template`, `11 — Handbook Population Tracker`; [[SOP-018-independent-change-qa]] (the same-model-review honesty rule applies to any Handbook update claiming a page is now COMPLETE); [[SOP-019-fusion-delivery-tracking]] (the delivery-tracking discipline this SOP's evidence is drawn from).

## Why this exists

The Handbook's own Maintenance Contract (ClickUp `01`) already establishes that a standing rule recorded only in ClickUp is not yet an agent operating contract — it must be hard-wired into the repo so it survives session-to-session memory loss. Warwick's instruction to "keep this updated whenever we add new features and functionality" is exactly that kind of standing rule. This SOP is the hard-wiring: the procedure any agent runs so the Handbook does not silently go stale the way the original Fusion247 Brain migration did (see [[SOP-018-independent-change-qa]]'s own origin story — a self-certified "done" claim that an independent audit later found was not true).

## Procedure

1. **Notice the trigger.** At delivery closure (a PR merges, a Build Log entry records COMPLETE, a Foundry IDEA changes lifecycle status, Warwick approves/declines an open recommendation), check whether any Handbook page describes the thing that just changed. Do not wait for a dedicated "update the Handbook" request — this check is part of normal closure, the same way a session-log entry is.
1a. **If the check finds nothing to update**, record that explicitly rather than staying silent: note **"Handbook assessed — no change required"** (with the as-of date and what was checked) in the session's close-session entry, so a future reader can tell "checked, nothing changed" apart from "never checked." Do not skip this step merely because there's nothing to write into ClickUp.
2. **Read the current page before writing.** `clickup_get_document_pages` (or equivalent) on the affected `08.xx`/shared page. Never blind-overwrite — the update must be additive/corrective against what's there, preserving unaffected sections (per the Handbook Maintenance Contract's own review discipline, established during the first correction pass).
3. **Update only what changed**, in the page's existing structure: status line (with an as-of date, per the convention established during the first correction pass — "status verified as of `<date>` from the cited evidence"), the relevant section (functionality, dependencies, security posture, deferred items), and the Evidence list (new file paths, commit SHAs, ClickUp IDs).
4. **Verify volatile claims directly against source before writing them**, the same discipline used in the first correction pass — e.g. a permission count or version number should be checked against the actual manifest/repo, not carried forward from memory or an earlier draft.
5. **Never silently upgrade a page to COMPLETE.** A page becomes COMPLETE only when the Handbook's own completion standard is met (canonical template addressed, evidence linked, operation/recovery documented, hard-won knowledge captured, gaps explicit, another agent could independently operate the capability) — record PARTIAL with an updated as-of date otherwise.
6. **Update `11 — Handbook Population Tracker`** with the new status, evidence-links flag, hard-won-knowledge flag, and any new material gap — every time a page changes, not just at the end of a population batch.
7. **Log the update.** A one-line mention in the session's close-session entry (`Team Knowledge/session-logs/`) is sufficient for a routine Handbook update; it does not need its own dedicated session log unless the update itself surfaced a durable cross-session lesson.
8. **Never invent architecture, decisions, or status.** If the underlying feature's status is genuinely unclear, mark the Handbook page UNKNOWN/UNVERIFIED rather than guessing — this SOP exists to keep the Handbook accurate, not merely current.

## What this SOP does not do

- It does not authorize a new Handbook population batch, a new capability page, or work on any unresolved decision (e.g. AsdAIr, CareerAIr) — those still require their own Warwick-authorized process.
- It does not replace independent review — a Handbook page correction is still subject to the same PASS / PASS WITH CORRECTIONS review discipline used during the initial population.
- It does not touch code, Builds, Foundry ideas, or agent contracts — only the ClickUp Handbook and its own tracker.

## Common mistakes to avoid

- Treating "the feature works now" as sufficient evidence to mark a Handbook page COMPLETE — completeness requires the full template, not just a working feature.
- Forgetting the as-of date on a status claim that is likely to change again soon (a common Handbook convention established during the first correction pass).
- Overwriting a page wholesale instead of reading it first and updating only the affected section.
- Carrying forward a stale fact (a permission count, a version number, a role attribution) from an earlier Handbook draft without re-verifying it against current source, especially for anything flagged UNVERIFIED on a prior pass.
