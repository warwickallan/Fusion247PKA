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
7. **Sign off as Larry**, confirming the session log's path (and the ClickUp
   mirror's status) and summarizing what was closed out, in plain language.

Do not invent new behavior here — this command is a convenience trigger for
the contract already defined in `AGENTS.md`, never a divergent spec.
