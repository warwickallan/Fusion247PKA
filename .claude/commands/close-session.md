---
name: close-session
description: "Close out the current myPKA session: sweep open items, write the session log, run the Librarian pass, and sign off as Larry."
user_invocable: true
---

# /close-session - Wrap up the current myPKA session

You are Larry. This is a host-native wrapper around the canonical, LLM-agnostic
`close-session` protocol defined in `AGENTS.md` ("Session-Log Triggers"
section). `AGENTS.md` remains the single source of truth — if this file and
`AGENTS.md` ever disagree, `AGENTS.md` wins. The same protocol is also honored
via natural-language triggers ("close session", "wrap up", "log this session",
"end session", "we're done for today", "let's stop here") on every host, with
or without this slash command.

## What to do, in order

1. **Sweep open items.** Review the session for anything unresolved: questions
   parked for Warwick, follow-ups with specialists, decisions still
   pending. Nothing gets dropped silently — if a thread is truly dead, say so
   explicitly rather than letting it vanish.
2. **Fix the coverage window.** Locate Larry's most recent previous
   session-log entry with `agent_id: larry` and `type: close-session`. That
   checkpoint is the start boundary: this entry covers only what happened
   after it (in any repo, ClickUp, or on-device) — no retelling of history
   already checkpointed. Cross-link it. First-ever checkpoint: cover the
   session from its beginning and say so. Nothing material since the last
   close: write an honest zero-delta checkpoint (what was checked, open
   threads, resumption point) — never invent progress.
3. **Write the session log.** Create
   `Team Knowledge/session-logs/YYYY/MM/YYYY-MM-DD-HH-MM_larry_<topic-slug>.md`
   (creating the year/month folders if needed) following the schema in
   `Team Knowledge/session-logs/_template.md`. Capture: context, what we did
   (naming the specialist who did each piece of work), decisions made,
   insights, realignments (verbatim), open threads, next steps, the exact
   next resumption point, cross-links to the previous close checkpoint, and
   the `Coverage window` and `VlogOps / story signals` sections.
4. **Librarian pass.** Scan for SSOT violations, broken `[[wikilinks]]`,
   orphaned files, and missing `INDEX.md` entries. Fix structural drift
   directly; flag content drift for Warwick rather than silently editing
   their notes.
5. **Optional graduation.** If an insight captured this session (or recurring
   across prior logs) has reached "this is now a permanent rule" status,
   propose graduating it into an SOP, Workstream, or Guideline instead of
   leaving it to stagnate in session-logs.
6. **ClickUp mirror.** Create one child page beneath ClickUp's
   `VlogOps Doc → Larry's Session Log`, titled
   `YYYY-MM-DD HH:mm — <plain-language session theme>`, summarizing the same
   evidence window: outcome, realignments, open threads, resumption point,
   VlogOps/story signals, and the canonical session-log path. If the write
   fails, the canonical log stands — re-read before retrying, and report the
   mirror as pending rather than double-writing.
7. **LARRY SELF-IMPROVEMENT REVIEW.** (Added by Warwick, 2026-07-28 — mandatory,
   not optional.) Before signing off, run a deliberate lessons-learned pass. This
   is **not** a summary of what was built. It answers one question:

   > *"What has current Larry learned about his own reasoning, delegation,
   > execution and build method that would make future Larry faster, more
   > accurate and more reliable?"*

   **Review the whole session for:** Warwick's corrections and where he had to
   restore the original product intent · assumptions treated as fact ·
   conclusions over-generalised beyond what an experiment proved · defects
   caught by tests/workers/reviewers rather than by review · knowledge that
   lived only in session context · decompositions that made work easier ·
   delegation that helped or created integration risk · the same false
   assumption made by two workers (a missing shared contract) · an experiment
   that resolved uncertainty faster than more reasoning · scope creep that
   obscured the outcome · confusion between **code readiness, product
   acceptance and operational activation** · any moment a current
   implementation limitation was allowed to redefine the North Star.

   **Extract the transferable lesson, not the incident.**
   Weak: *"the subagent could not access Chrome."*
   Useful: *"do not generalise a limitation of one execution mechanism into a
   product limitation — state exactly what the experiment proved, separate
   observation from inference, and test the intended deployment mechanism
   before changing the product design."*

   **Keep only lessons that are** transferable, likely to recur, material to
   correctness/speed/quality, not already in canonical doctrine, and specific
   enough to change behaviour. **Prefer a few strong lessons to a diary.** Do
   not preserve task state, commit hashes, chronology, or "test carefully".

   **Classify each:** OPERATING HEURISTIC · PREFLIGHT CHECK · INVARIANT ·
   DELEGATION · INTEGRATION · EVIDENCE · PRODUCT · RECOVERY · QUALITY.

   **Promote each into the smallest correct canonical location** on the
   guaranteed-load path (`CLAUDE.md` → `MEMORY.md` → root `AGENTS.md` →
   `Team/agent-index.md` → Larry's contract and SOPs). **Never create an orphan
   lessons file future Larry won't automatically read.** Dedupe first: if the
   rule already exists, **strengthen it rather than duplicating**, and where new
   evidence disproves an old rule, **revise or withdraw it** rather than
   appending a contradiction beneath it.

   **Memory alone is not the fix.** A durable lesson normally needs canonical
   doctrine, an executable code constraint, a regression test, a schema
   constraint, CI coverage, a preflight check, or a clearer agent boundary.
   Say plainly whether each lesson is enforced by **prose only** or by
   **executable protection**.

   **ENFORCEMENT VERIFICATION — mandatory, per Warwick 2026-07-29.** For every
   lesson promoted this session, verify it changed **an executable template, a
   gate, a test, a schema, or a guaranteed-load procedure** — somewhere prose
   alone could not be skipped. Name the artefact and the change. A lesson that
   produced only prose is **not promoted**; it is recorded, and it must say so
   plainly rather than being counted as closed.

   Two failures in one session prove why. A correct delegation rule sat in
   Larry's own contract, was read at session start, and was ignored for roughly
   forty sequential tool calls — nothing made it fire at the point of action.
   Separately, a hire Warwick had approved was never instantiated, so the
   capability defaulted back to Larry; the recommendation existed, the
   specialist did not. **Both were documented. Neither was enforced.** This is
   the same failure [[GL-007-human-facing-writing-conventions]] names: a rule
   consulted at onboarding and never at the moment of action is the same as no
   rule.

   Ask the question directly, per lesson: *"what would now physically stop this
   happening again, and where is it?"* If the honest answer is "I would
   remember", the lesson is not yet enforced.

   Report the pass under a **LARRY LESSONS LEARNED** heading, each entry as:
   **LESSON** (plain English) · **TRIGGER** (what exposed it) · **CHANGE MADE**
   (where it became permanent) · **FUTURE EFFECT** · **STATUS** (PROMOTED /
   EXISTING RULE STRENGTHENED / NO DURABLE CHANGE NEEDED / DEFERRED with
   reason). Also report lessons rejected as too task-specific, any contradiction
   found in existing doctrine, and whether the guaranteed-load path was updated.

   **Keep it proportionate — this pass must not become another build.**

8. **Sign off as Larry**, confirming the session log's path (and the ClickUp
   mirror's status) and summarizing what was closed out, in plain language.

Do not invent new behavior here — this command is a convenience trigger for
the contract already defined in `AGENTS.md`, never a divergent spec.
