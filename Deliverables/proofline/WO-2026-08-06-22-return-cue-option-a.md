---
# --- identity and authority ---
name: Implement subagent-return retrieval cue (Option A reduced)
work_order_id: WO-2026-08-06-22
build: BUILD-020
wp_number: WP-4D
status: draft
authorised_by: Warwick
authorised_date: 2026-08-06
owner: keel
return_to: larry
blocking_dependencies: []
tags: [build-020, wp-4d, phase-4, return-cue]

# --- scope ---
outcome: >-
  When a background specialist finishes, the next safe parent turn receives one specialist-specific
  retrieval cue (zero model calls) reminding Larry to apply Rule 4a before reporting — without
  injecting into the specialist, without auto-sending, and without a daemon.
acceptance_property: >-
  On host Claude Code 2.1.222 (or the version under test), a background Agent that makes at least
  one tool call produces (1) a SubagentStop marker write under .claude/state/return-cues/ and
  (2) on a subsequent PARENT PreToolUse (no agent_id), exactly one additionalContext cue naming
  the agent_type, after which the marker is claimed/removed; a PreToolUse that carries agent_id
  (subagent) never emits the cue.
integration_owner: larry
veritas_gate: 1
document_impact:
  - path: Deliverables/2026-08-04-proofline-wayfinder-plan.md
    owner: larry
  - path: Deliverables/2026-08-06-pax-subagent-return-cue-brief.md
    owner: larry

# --- surfaces ---
file_surface:
  - .claude/hooks/return-cue-write.mjs
  - .claude/hooks/return-cue-consume.mjs
  - .claude/hooks/return-cue-sweep.mjs
  - .claude/hooks/return-cue-text.json
  - .claude/hooks/return-cue.test.mjs
  - .claude/settings.json
  - .gitignore
  - Deliverables/proofline/EVIDENCE-2026-08-06-wo-22-return-cue.md
out_of_scope_policy: report-only

worker_contract:
  path: Team/Keel - Implementation Engineer/AGENTS.md
  governance_sha: a554c9b69076d117dcde4ff1a0a08da33d579398

contract_basis:
  - surface: .claude/hooks/**
    permitted_by: "Keel owns implementation of bounded tooling and hook scripts under Work Order file_surface; notify-reminder.mjs is the existing house template"
  - surface: .claude/settings.json
    permitted_by: "Tracked project hook registration surface; Keel may add ONLY the three events named in this order and must not remove or alter the existing PostToolUse notify-reminder entry"
  - surface: .gitignore
    permitted_by: "Required so .claude/state/ is never committed; pure ignore-line append"
  - action: execute live Claude Code probe for acceptance
    permitted_by: "Acceptance property requires real production events; temporary untracked settings.local.json edits for instrumentation ONLY if needed, restored after; preferred path is the permanent hooks under test"

contract_conflicts: none

capability_evidence:
  source: executed probe
  result: >-
    Deliverables/2026-08-06-s9-agent-id-probe-evidence.md — host 2.1.222; parent PreToolUse lacks
    agent_id; subagent PreToolUse carries agent_id + agent_type; SubagentStop fires with both.
    Kill condition NOT triggered. BUILD authorised by Pax §9 criterion.

# --- authority ---
credential_scope: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none
live_authority: none

# --- environment ---
worktree: C:\Fusion247PKA-build-020-trial
branch: build-020/phase4-automation-law
git_authority: >-
  Execute ordinary commits on the assigned branch for files inside file_surface only.
  Ordinary push of this branch is permitted after evidence is written.
  No force-push. No main. No PR. No merge.

schema_decision: n/a
security_inputs: n/a
operational_handoff: none
runbook_path: n/a — not a Mack-operated service; zero runtime process
---

# WO-2026-08-06-22 — WP-4D: subagent-return retrieval cue (Option A reduced)

## Why this exists

Dispatch-time `PostToolUse` on `Agent|Task` is stale by the time Larry must apply Rule 4a. Warwick's North Star: *when a background specialist finishes, the parent receives one fresh, specialist-specific retrieval cue at the next safe parent turn.* Pax researched (`Deliverables/2026-08-06-pax-subagent-return-cue-brief.md`) and returned **BUILD — Option A reduced, gated on §9**. §9 was executed post-rotation: **BUILD** (`Deliverables/2026-08-06-s9-agent-id-probe-evidence.md`, host `2.1.222`).

## Design (binding — do not redesign)

Canonical design is Pax brief §§7–8. Summary:

1. **`SubagentStop` (matcher `*`)** → write marker `.claude/state/return-cues/<agent_id>.json` with **only**: `session_id`, `agent_id`, `agent_type`, ISO timestamp. **No message content.**
2. **`UserPromptSubmit`** and **`PreToolUse` (matcher `*`)** → **same consumer**. Exit 0 immediately unless: **no `agent_id` in own payload** (parent-only), marker `session_id` matches, marker age < TTL (~30 min). Claim via **atomic rename** to `.claimed` (on Windows rename fails if target exists → natural mutex), emit **one** `additionalContext` from tracked text keyed on `agent_type`, delete claim.
3. **`SessionStart`** → delete markers whose `session_id` ≠ current, and markers past TTL.
4. **Canonical cue text** in **one tracked file** (`.claude/hooks/return-cue-text.json`), keyed by `agent_type`. Hook only looks up and prints. Unknown type → one generic line, never a guess.
5. **Always exit 0.** Template: `.claude/hooks/notify-reminder.mjs`.
6. **Never classify, never send Telegram, never spawn an agent, never create a daemon.**

### Cue content requirements

- Must name the **`agent_type`** (premature-fire mitigation — Pax failure mode #1).
- Must point at Rule 4a / FusionDevBot judgement — not restate the full criteria (same discipline as `notify-reminder.mjs`).
- Specialist-specific lines for known types used in this estate at minimum: `keel`, `mack`, `pax`, `veritas`, `nolan`, `general-purpose`, `Explore` / `explore` — and a single generic fallback. Prefer matching the host's actual `agent_type` strings from §9 evidence (`general-purpose`) and `.claude/agents/*.md` slugs.

### Settings registration

Add to **tracked** `.claude/settings.json` **without removing** the existing `PostToolUse` / `notify-reminder.mjs` entry:

| Event | Script |
|---|---|
| `SubagentStop` matcher `*` | `return-cue-write.mjs` |
| `PreToolUse` matcher `*` | `return-cue-consume.mjs` |
| `UserPromptSubmit` | `return-cue-consume.mjs` |
| `SessionStart` matcher `*` (or source-appropriate) | `return-cue-sweep.mjs` |

Use `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<file>"` form (the `$CLAUDE_PROJECT_DIR` fix already shipped).

### `.gitignore`

Append ignore for `.claude/state/` (runtime markers must never commit).

## Acceptance criteria

- **AC1 — unit / hermetic:** `node --test .claude/hooks/return-cue.test.mjs` exercises marker write shape, parent-vs-subagent gate (synthetic payloads with/without `agent_id`), atomic claim behaviour, TTL discard, session mismatch discard, unknown `agent_type` fallback. Suite runs in a clean export / temp dir without the live Claude host. Report pass count and that subtests **executed**.
- **AC2 — live write half:** with the **tracked** hooks registered (not a throwaway probe hook that replaces them), dispatch one background Agent that runs at least one tool; prove a marker file appeared under `.claude/state/return-cues/` with the four fields only. Capture host version.
- **AC3 — live consume half:** a subsequent **parent** tool call (no `agent_id`) causes the consumer to claim the marker and emit `additionalContext` containing the agent_type; marker is gone or claimed-and-removed after. Evidence: either hook dump of consumer stdout JSON, or a test double recording path — **executed**, not asserted.
- **AC4 — subagent isolation:** a `PreToolUse` **with** `agent_id` does **not** consume markers / does **not** inject the parent cue (prove with synthetic unit test at minimum; live if cheap).
- **AC5 — no regrowth:** no new service, daemon, watcher, registry, or control plane. One state directory, the scripts on `file_surface`, settings entries only.

## Required evidence

Write `Deliverables/proofline/EVIDENCE-2026-08-06-wo-22-return-cue.md` with:

- Host version (`claude --version`)
- Unit suite command + exit + counts
- Live AC2/AC3 commands and outputs (redact paths only if secret; none should be)
- Final `git diff --stat` of `file_surface`
- Explicit statement that `notify-reminder.mjs` PostToolUse registration is unchanged

## Explicitly out of scope — report, never fix

- Replacing or removing the dispatch-time `notify-reminder.mjs` (Warwick still owns A/B/C reminder-hook option)
- Auto-send / ding from the cue
- Building Option B/C/D/E
- Fixing `envelope.test.mjs` hermeticity (`V4-7`)
- Phase 4 Veritas re-review (Larry's after integration)
- Supabase performance reporting
- Any file outside `file_surface`

## READ-BACK GATE (MANDATORY)

Return the standard read-back block **before any implementation**. Restate outcome, plan, what the order failed to settle, and what looks wrong. **Stop until Larry accepts or amends.**

## Governance head

`a554c9b69076d117dcde4ff1a0a08da33d579398` — §9 probe evidence committed; map frontier points at this Work Order.
