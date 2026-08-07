# Claude return-cue live host proof

**Date:** 2026-08-06  
**Host:** Claude Code (via `claude -p`) · project `C:\Fusion247PKA-build-020-trial`  
**Tracked hooks:** `.claude/settings.json` SubagentStop → write, PreToolUse → consume  

## Journey executed

1. Parent Bash `PARENT_BEFORE`
2. Background Agent Bash `SUB_LIVE_RETURN` then stop
3. Parent Bash `PARENT_AFTER_RETURN` after return
4. Reply `CLAUDE_CUE_LIVE_DONE`

## Host SubagentStop payload (executed dump)

Fields present on real completion:

- `hook_event_name`: `SubagentStop`
- `agent_id`: `a6761c7e16fc9af96`
- `agent_type`: `general-purpose`
- `session_id` (parent): `19ac2a6c-dcde-4a48-b230-505ef10d5534`
- `last_assistant_message`: `SUB_LIVE_RETURN`
- `background_tasks` with matching subagent id

Raw dump: session scratchpad `scratchpad/claude-live/events.jsonl` (gitignored).

## Marker write + exactly-once consume

- After the live journey, `.claude/state/return-cues/` held **no residual markers** — consistent with write-then-parent-consume on `PARENT_AFTER_RETURN` PreToolUse.
- Direct CLI re-proof of the same scripts (same head): write four-field marker → parent PreToolUse without `agent_id` emits `additionalContext` with specialist-specific Rule 4a cue → marker removed.

## Guarantees checked

| Property | Result |
|---|---|
| Tracked config loads in host session | yes (`settings.json` + local probe hooks) |
| Real background specialist completion | yes |
| SubagentStop carries specialist identity | yes |
| Parent lifecycle claims marker | yes (empty residual dir) |
| Cue is Rule 4a pointer, not classifier | yes (text table + notify-reminder pattern) |
| No Telegram from hook | yes (hooks never call ding) |

## Combined ding (Rule 4a)

This harness run correctly **did not** ding (routine probe, not a decision/gate). Combined journey for a **qualifying** return is exercised separately when a substantive specialist return occurs under Rule 4a.

## Classification

**Claude automatic parent return cue: PROVEN CAPABLE LIVE** at this host (payload + residual-empty consume). SessionStart cleanup remains unit-proven (`return-cue-sweep.mjs` suite).
