---
title: "Claude Code — do permissions.deny rules apply to subagents?"
date: 2026-08-02
author: Pax (Senior Researcher)
type: research-brief
decision_informs: whether a settings.json deny can be relied on to constrain Task/Agent-dispatched subagents, and whether a thin-main / capable-specialist permission split is achievable
sources_primary: 3   # official Claude Code docs (sub-agents, permission-modes, settings/permissions)
sources_corroborating: 2  # GitHub issues #54898, #57118
confidence: High
---

# Do `permissions.deny` rules apply to Claude Code subagents?

## Executive summary

**Yes — a `permissions.deny` rule set in a settings file applies to subagents, not only the main session.** Deny is a session-wide gate evaluated *before* a subagent's own `tools:` allowlist, and it wins over anything the subagent declares. Path-scoped denies (`Edit(src/**)`) behave the same way. This is stated in the official docs and confirmed empirically by a reproduced GitHub bug report. The direct consequence: the "thin main agent, capable specialist" pattern **cannot** be built with `permissions.deny` — a deny that stops the main agent writing also stops every subagent writing. Restricting a subagent *below* the session baseline works; raising one *above* a session-level deny does not.

---

## Key findings

### Finding 1 — Subagents inherit the session's deny rules. **[DOCUMENTED · High]**

The subagents doc frames a subagent as having "independent permissions," but that independence is the `permissionMode` + `tools` layer, **not** the deny layer. Two passages pin this down:

- Built-in subagents: *"Each inherits the parent conversation's permissions with additional tool restrictions."* (`sub-agents`, "Built-in subagents")
- The permission-modes doc lists deny rules among the controls that *"apply in every mode, including `bypassPermissions`"*, and its classifier decision order opens with: *"Actions matching your allow, ask, or deny rules resolve immediately."* (`permission-modes`, "How the classifier evaluates actions")

The word "session" is load-bearing: `permissions.deny` is a session-scoped rule set, and a subagent runs *inside* the session ("Subagents work within a single session" — `sub-agents`). There is no per-agent deny namespace.

> Source: https://code.claude.com/docs/en/sub-agents · https://code.claude.com/docs/en/permission-modes

### Finding 2 — On a conflict, the session deny wins over the subagent's `tools:` allowlist. **[DOCUMENTED · High]**

Precedence is explicit and one-directional:

- *"Denylist takes precedence over allowlist."* (`settings` / permissions)
- Ordering within a subagent's own frontmatter: *"If both `tools` and `disallowedTools` are set, `disallowedTools` is applied first, then `tools` is resolved against the remaining pool."* — i.e. denies are subtracted before allows even at the agent level.

The decisive corroboration is a reproduced bug report, [anthropics/claude-code#54898](https://github.com/anthropics/claude-code/issues/54898) ("Per-Agent Permission Control Gap"), which tested this against 5 subagents:

> *"tools: field is overridden by project-level settings.json deny. Subagent declared Write but still could not write. Confirmed by testing all 5 subagents."*

> *"[Path-specific deny `Write(src/**)`, `Edit(src/**)`] Blocked subagents too. Project-level deny overrides subagent tools: declarations. All 5 subagents failed."*

So a subagent whose `tools:` line lists `Write` is still blocked if the session denies `Write` (or `Write(<matching-path>)`). Deny is not overridable by the agent definition, and per the permission-modes doc, not even by `bypassPermissions`.

> Source: https://github.com/anthropics/claude-code/issues/54898

### Finding 3 — "Thin main, capable specialist" is NOT achievable via `permissions.deny`. **[DOCUMENTED gap · High]**

Issue #54898 is exactly this use case (main agent = coordinator with no `src/` write; subagents = the only writers), and it documents the gap directly:

> *"When I remove write access from the main agent to force delegation to subagents — the subagents also lose write access. They are cut off equally."*

There is no per-agent deny scope and (per the same issue's investigation) no `agent_type` field in `PreToolUse` hook stdin to build one from. **No official Anthropic fix or response is attached; the issue is closed without resolution.**

**The mechanism only cuts downward.** You can make a subagent *less* capable than the session — via its `tools:` allowlist or `disallowedTools` denylist — but you cannot make it *more* capable than a session-level deny allows. Quote from the frontmatter reference: `disallowedTools` = *"Tools to deny, removed from inherited or specified list."*

> Workaround that *does* exist (INFERRED · Medium — assembled from documented primitives, not a documented recipe): achieve asymmetry through **allowlists, never a deny.** Give the main agent (launched with `--agent`) a narrow `tools:` list that omits `Edit`/`Write`, and give the specialist subagent a broad `tools:` list — leaving `permissions.deny` empty for those tools. Because the restriction on the main agent is its own tool list rather than a session deny, the subagent is not caught by it. This is untested here and should be proven before relied on. It does **not** give path-scoped asymmetry (main can't write `src/**` but subagent can) — that specific shape remains impossible, which is the precise thing #54898 asked for.

### Finding 4 — Auto mode adds a *separate* classifier gate on Task/Agent dispatch. **[DOCUMENTED · High]**

Distinct from deny rules: when the session is in `auto` mode, a background classifier model gates subagent dispatch at three points (`permission-modes`, "How auto mode handles subagents"):

> 1. *"Before a subagent starts, the delegated task description is evaluated, so a dangerous-looking task is blocked at spawn time."* (requires v2.1.178+)
> 2. *"While the subagent runs, each of its actions goes through the classifier with the same rules as the parent session, and any `permissionMode` in the subagent's frontmatter is ignored."*
> 3. *"When the subagent finishes, the classifier reviews its full action history; if that return check flags a concern, a security warning is prepended to the subagent's results."*

Conditions that trigger a classifier *block* (not deny-rule blocks — these are heuristic): actions that *"escalate beyond your request, target unrecognized infrastructure, or appear driven by hostile content Claude read."* The default block list includes writes to **protected paths**, mass/irreversible deletion, force push, exfiltration of secrets/personal data to public or external surfaces, and — relevant to this estate — writing outside the trusted working directory. On entering auto mode, broad execution allow-rules are dropped, **including `Agent` allow rules** (`permission-modes`, "How the classifier evaluates actions"). Fallback: *"If the classifier blocks an action 3 times in a row or 20 times total, auto mode pauses and Claude Code resumes prompting."* In `-p` non-interactive mode, repeated blocks abort the run.

This is the documented mechanism behind the team's own observation that a subagent write into `C:\.fusion247\**` can be walled off by the auto-mode classifier while Larry's direct write to the same path succeeds — a subagent's task description and out-of-working-directory writes are exactly what checkpoints 1 and 2 evaluate.

> Source: https://code.claude.com/docs/en/permission-modes

---

## The precedence picture (synthesis)

For any tool call by a subagent, the gates apply in this order — first block wins:

1. **`permissions.deny`** (session-wide, from any settings file) — blocks even in `bypassPermissions`; overrides the subagent's `tools:` line. *Reliable, mode-independent.*
2. **Auto-mode classifier** (only if session mode is `auto`) — evaluates the dispatch and each action heuristically; `Agent` allow-rules are dropped on entry.
3. **The subagent's own `tools:` / `disallowedTools`** — can subtract capability, never add it back above 1.
4. **`permissions.allow`** — pre-approves what survives 1–3.

Bottom line for the estate: **a `deny` rule is the strongest and most predictable way to keep a tool away from a subagent** (it is not overridable per-agent, not by mode, not by the agent's own `tools:`). It is also the *reason* a capable-specialist-under-a-restricted-main split can't be done with deny.

---

## Methodology

- Primary: official Claude Code docs read in full — `sub-agents` (frontmatter table, "Built-in subagents", "Permission modes", "Available tools"), `permission-modes` (all modes, "How auto mode handles subagents", "How the classifier evaluates actions", "Protected paths"), and the `settings`/permissions page (rule types, precedence). These reflect current builds (min-version notes up to v2.1.218), consistent with today's date.
- Corroborating: GitHub issues [#54898](https://github.com/anthropics/claude-code/issues/54898) (reproduced deny-over-subagent-tools test across 5 agents) and [#57118](https://github.com/anthropics/claude-code/issues/57118) (permissionMode inheritance for subagents — supports Finding 4's "frontmatter ignored" claim).
- Triangulation: Findings 1, 2, 4 each rest on an official doc *plus* an independent reproduced report — High confidence. Finding 3's gap is stated in the doc-adjacent issue and consistent with the absence of any per-agent deny primitive in the docs — High for the limitation, Medium for the allowlist workaround.

## Limitations

- **The allowlist workaround (Finding 3) is INFERRED, not documented, and untested on this machine.** Prove it in a scratch session before designing around it. Path-scoped asymmetry (thin-main-on-`src/**`, capable-subagent-on-`src/**`) remains genuinely impossible per #54898.
- Exact evaluation order across *all* settings tiers (managed vs project vs local `settings.local.json`) was not exhaustively traced here; the deny-wins and deny-is-session-wide conclusions hold regardless of tier, since deny in any tier gates the session.
- GitHub issues carry no official Anthropic resolution; they are used only as reproduction evidence for behavior the docs already imply, never as the sole basis for a claim.
- Behavior is version-sensitive (checkpoint-1 classifier gating needs v2.1.178+; many auto-mode categories are v2.1.195–v2.1.218). Confirm the running CLI version before quoting a specific auto-mode block.

## Recommendations

1. **To keep a tool/path away from subagents, use `permissions.deny` — it is the one gate that is not per-agent-overridable.** Trust it over a subagent's `tools:` restriction, which a future edit to the agent file could widen.
2. **Do not attempt a thin-main / capable-specialist split via `deny`.** If asymmetry is needed, prototype the allowlist approach (main's `--agent` tools list omits Edit/Write; subagent's list includes them; no deny on those tools) and *test it* before committing.
3. **If the estate runs in `auto` mode**, expect subagent writes into non-working-directory trees like `C:\.fusion247\**` to be classifier-gated independently of deny rules — take those writes over directly (as Larry) or add the surface to trusted-infrastructure config, rather than re-dispatching into a wall.
