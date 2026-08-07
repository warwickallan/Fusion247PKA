# BUILD-020 §9 probe — agent_id discriminator — EXECUTED EVIDENCE

**Date:** 2026-08-06T09:16:13.740Z  
**Host version:** `2.1.222 (Claude Code)` — required by Pax §10; evidence has shelf life only with this pin  
**Branch / worktree:** `build-020/phase4-automation-law` · `C:\Fusion247PKA-build-020-trial`  
**Governance / method source:** `Deliverables/2026-08-06-pax-subagent-return-cue-brief.md` §9  
**Map:** `Deliverables/2026-08-04-proofline-wayfinder-plan.md` §17.9  

**Method:** temporary untracked hooks in `.claude/settings.local.json` (restored after to permissions-only; verified no hooks left). Dump script lived under gitignored `scratchpad/probe-s9/` (ephemeral). Orchestrated by `node scratchpad/probe-s9/run-probe.mjs` → one `claude -p` parent session that (1) ran parent Bash, (2) dispatched one background general-purpose Agent, (3) ran parent Bash after dispatch. Claude exit 0 · elapsed 44 879 ms · stdout `PROBE_DONE`.

**Tracked settings.json was NOT modified.** Probe hooks never entered the committed surface.

---

## Verdict (Pax §9 kill condition)

| | |
|---|---|
| **Kill condition** | If `PreToolUse` firing *inside* a subagent does **not** carry `agent_id` → **DO NOT BUILD** → Option C |
| **Observed** | Parent `PreToolUse` firings: **no** `agent_id` / `agent_type`. Subagent `PreToolUse` firings: **both** present (`agent_id` + `agent_type`) |
| **Verdict** | **`BUILD` — Option A, reduced, may proceed** |

| Metric | Value |
|---|---|
| Total payload files | 6 |
| PreToolUse firings | 5 |
| PreToolUse WITH `agent_id` | 2 (subagent Bash + Read) |
| PreToolUse WITHOUT `agent_id` | 3 (parent Bash, parent Agent dispatch, parent Bash after) |
| SubagentStop firings | 1 (with `agent_id` + `agent_type`) |
| Notification firings | **0** (fold-in; does not change verdict) |

**Session id (parent):** `202651cd-6543-4a5a-8304-e771b91bd289`  
**Subagent id:** `a515f57fcfad85cbd` · **agent_type:** `general-purpose`

---

## Chronological firings (summaries only)

| # | Event | tool | agent_id | agent_type | Role |
|---|---|---|---|---|---|
| 1 | PreToolUse | Bash `echo PARENT_PROBE_OK` | — | — | **PARENT** |
| 2 | PreToolUse | Agent (dispatch) | — | — | **PARENT** |
| 3 | PreToolUse | Bash `echo SUBAGENT_PROBE_OK` | `a515f57fcfad85cbd` | `general-purpose` | **SUBAGENT** |
| 4 | PreToolUse | Read (package.json — absent; tool still fired) | `a515f57fcfad85cbd` | `general-purpose` | **SUBAGENT** |
| 5 | PreToolUse | Bash `echo PARENT_AFTER_DISPATCH` | — | — | **PARENT** |
| 6 | SubagentStop | — | `a515f57fcfad85cbd` | `general-purpose` | **return** |

### Parent PreToolUse — top-level keys (no discriminator)

`cwd`, `effort`, `hook_event_name`, `permission_mode`, `prompt_id`, `session_id`, `tool_input`, `tool_name`, `tool_use_id`, `transcript_path`

### Subagent PreToolUse — top-level keys (discriminator present)

`agent_id`, `agent_type`, `cwd`, `effort`, `hook_event_name`, `permission_mode`, `prompt_id`, `session_id`, `tool_input`, `tool_name`, `tool_use_id`, `transcript_path`

### SubagentStop — top-level keys

`agent_id`, `agent_transcript_path`, `agent_type`, `background_tasks`, `cwd`, `effort`, `hook_event_name`, `last_assistant_message`, `permission_mode`, `prompt_id`, `session_crons`, `session_id`, `stop_hook_active`, `transcript_path`

---

## Fold-ins (do not change the kill-condition verdict)

### (a) Notification / `agent_completed`

**Zero Notification firings** in this `claude -p` run. Does not prove Notification never fires in an interactive session; it only proves it did not fire under this non-interactive probe. Pax already established from docs that Notification cannot inject into Claude context (`systemMessage` only). Design does not depend on it.

### (b) SubagentStop

Fired once with full identity (`agent_id` + `agent_type`), matching Larry's earlier S-1..S-4 write-half evidence, now reconfirmed on host `2.1.222` with the version pin Pax required.

---

## What this settles for Option A

1. **Parent vs subagent discriminator on `PreToolUse` is real on this host version** — consumer can exit immediately when `agent_id` is present (subagent) and only claim markers when absent (parent).
2. **`agent_type` is present on subagent PreToolUse and on SubagentStop** — specialist-specific cue text is feasible.
3. **CLI hooks reference omission of `agent_id` is incomplete relative to live behaviour on 2.1.222** — the Agent SDK page matches execution; the CLI field list does not. Re-run this probe after any host upgrade (Pax §7 residual risk #5).

## What this does NOT settle

- Whether a return-time cue **improves** Rule 4a compliance vs noise (still **[U]** — empirical after ship).
- Exactly-once consume under concurrent parent tool batches (atomic rename still untested).
- Whether Notification fires in interactive parent sessions (zero samples here).
- Phase 4 overall PASS (still Veritas `HOLD` on phase question for other reasons).

---

## Raw payloads

Ephemeral under gitignored `scratchpad/probe-s9/payloads/` on the machine that ran the probe. This Deliverable is the durable record. Machine summary also at `scratchpad/probe-s9/summary.json` (gitignored).
