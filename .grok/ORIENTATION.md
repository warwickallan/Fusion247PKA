# Grok session orientation — return-cue / Rule 4a

**Classification: MANUAL CONTEXTUAL DISCIPLINE — not automatic return injection.**

Pax established (`Deliverables/2026-08-06-pax-grok-return-cue-equivalence.md`) that Grok does **not** provide a parent-context inject equivalent to Claude Code’s return-cue (`additionalContext` on parent `PreToolUse` / `UserPromptSubmit`). Passiverok `SubagentStop` runs in the specialist; passive hooks ignore stdout for parent inject.

**When a background specialist finishes in this Grok session:**

1. Before summarising or starting further parent work, apply the **Warwick notification rule** — root `CLAUDE.md` § Rule 4a (canonical; do not paraphrase criteria here).
2. If it qualifies, send through FusionDevBot first (`node ~/.mypka/governor/ding.mjs <message-file>`), then report and yield.
3. Do not claim an automatic host cue fired.

This file is loaded with the project. Fresh Grok sessions that open this worktree must not need Warwick to restate it.
