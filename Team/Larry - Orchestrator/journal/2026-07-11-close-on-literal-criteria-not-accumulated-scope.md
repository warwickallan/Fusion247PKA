---
agent_id: larry
type: journal-entry
created: 2026-07-11T05:30:00Z
updated: 2026-07-11T05:30:00Z
topic: close-on-literal-criteria-not-accumulated-scope
tags: [task-discipline, sop-close-task, scope-creep]
linked_session_logs: []
linked_tasks: []
related_journal_entries: [2026-07-11-content-integrity-qa-three-way-split]
status: durable
---

# A task's closure question is answered by its own written `## Success criteria`, not by everything that later got logged inside it

## Context
`tsk-2026-07-10-001` was titled "fold Fusion247 Brain doctrine into Warden," but over several sessions became the running decisions log for the entire Fusion247 Brain migration — the Cairn hire, four Guidelines, a whole second specialist's meeting-intelligence SOPs, and eventually Task 006. By the time I looked at it again, it felt too big and too central to just close.

## What I learned
Scope accumulated inside a task's body (decisions, sub-tasks it spawned, things it became the log for) is not the same as scope written into its `## Success criteria`. When deciding whether a long-running task is done, check the literal criteria first — they were written when the task's actual, bounded job was still clear. If they're met, the task is done, even if it grew a large narrative around itself. Anything it spawned that's still open (here, `tsk-004`/`tsk-005`, both carrying `parent: tsk-2026-07-10-001`) continues as its own independent task — a closed parent doesn't require its still-open children to close too, and doesn't need to stay open just to keep them company.

## When this applies
Next time a long-running task feels "too big to close" because of everything that happened inside it: re-read its own `## Success criteria` verbatim before deciding. If met, close it, and explicitly note in the `## Outcome` which still-open children continue independently. Surfacing the closure question to the user rather than deciding unilaterally is still correct when the task's scope has visibly outgrown its title — the accumulated narrative is exactly the kind of thing that makes "just close it" feel presumptuous even when the criteria say it's fine.

## When this does NOT apply
If the success criteria themselves are stale (written for a narrower job the task no longer actually does), that's a reason to rewrite the criteria first, not a reason to keep the task open indefinitely on vibes. This entry is about not conflating "lots happened here" with "not actually done."

## Evidence
- [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]
