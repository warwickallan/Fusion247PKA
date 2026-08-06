# Specialist-return retrieval cue — research brief and verdict

**Commission:** WO-2026-08-06-21 · **Governance head:** `755536e5a949f7f583fc8226755f825d38e28795`
**Branch:** `build-020/phase4-automation-law` · **Author:** Pax · **Date:** 2026-08-06
**private_surface:** none · **credential_scope:** none · **Research and verdict only — nothing implemented.**

**Labels used throughout:** **[E]** ESTABLISHED (executed locally, or stated verbatim in official docs and corroborated) · **[I]** INFERRED (reasoned from documented semantics, not executed) · **[U]** UNESTABLISHED (docs do not settle it; execution named).

---

## 1. Verdict

**BUILD — Option A, reduced, and gated on one 10-minute probe. If that probe fails, fall back to Option C (discipline only) and do not build a workaround.**

The write half of the route is executed-proven and carries more identity than the design needs. The consume half is *documented but not executed*, and it has one real defect I could not design away on paper. The probe below settles it. I would not authorise the build without it.

**Kill condition, stated in advance:** if a `PreToolUse` hook firing *inside a subagent* does **not** carry `agent_id`, there is no reliable way to tell a parent tool call from a specialist's tool call, the cue can be injected into the wrong context, and **the verdict flips to DO NOT BUILD**. That is the whole gate.

---

## 2. What is already executed fact

From Larry's staged probe (`scratchpad/probe/EXECUTED-EVIDENCE.md`, three firings, this machine, today) — **[E]**:

- `SubagentStop` fires at the real completion moment for a **background** agent, and fires **before** the completion notification reaches the parent's context.
- Payload carries `session_id` (the **parent** session), `agent_id`, `agent_type`, `agent_transcript_path`, `transcript_path`, `cwd`, `prompt_id`, `permission_mode`, `stop_hook_active`, `last_assistant_message`, `background_tasks`.
- `agent_type` distinguished `general-purpose` from `Explore` — **specialist-specific cue text is feasible on real data.**
- Two concurrent returns each fired their own `SubagentStop` with distinct `agent_id`s.

**This settles step 2 (marker write) and the WRITE half of concurrency. It settles nothing about step 3.** GitHub issue [#7881](https://github.com/anthropics/claude-code/issues/7881) — "SubagentStop cannot identify which subagent finished, shared session IDs", still open — describes a host version where these fields were absent. **The executed evidence supersedes it on this machine.** Do not design against the issue; do re-check after a host upgrade.

## 3. The consume half — what the docs do and do not settle

**Finding 1 — `additionalContext` is the correct and only documented injection field, and its landing point is event-specific. [E], two official pages.**
Hooks reference, verbatim: *"The `additionalContext` field passes a string from your hook into Claude's context window. Claude Code wraps the string in a system reminder and inserts it into the conversation at the point where the hook fired."* Landing points, verbatim: *"`UserPromptSubmit` and `UserPromptExpansion`: alongside the submitted prompt · `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, and `PostToolBatch`: next to the tool result · `Stop` and `SubagentStop`: at the end of the turn. The conversation continues so Claude can act on the feedback."*
Source: <https://code.claude.com/docs/en/hooks>, corroborated by <https://code.claude.com/docs/en/hooks-guide>.

**Finding 2 — `SubagentStop.additionalContext` almost certainly lands in the SPECIALIST, not the parent. [I], strong.**
Its documented landing point is "the end of the turn", and its exit-2 behaviour is *"prevents the subagent from stopping"*. Both point at the subagent's conversation. **Warwick's constraint "inject into Larry's parent context, not back into the specialist" therefore rules out the obvious one-line route.** Not executed. Cheap to settle: emit a unique token and see which transcript it lands in.

**Finding 3 — NO hook is documented to fire "after a background completion notification is processed". [E] as a negative about the docs.**
The relevant behaviour, verbatim from <https://code.claude.com/docs/en/sub-agents>: *"A background subagent's results reach Claude as a completion notification in a later turn. Claude waits for that notification before reporting the subagent's results."* There is a `Notification` event with matcher value `agent_completed` — but the reference states Notification has **"No blocking or decision control. Used for side effects like logging,"** and its only output is `systemMessage`, *"Warning message shown to the user"*, which **does not reach Claude's context**. So `Notification` can flag but cannot inject.
**Consequence: the relay cannot be bound to the notification. It is necessarily opportunistic — the next parent `PreToolUse` or `UserPromptSubmit`, whichever comes first.** This is the honest answer to the commission's central question.

**Finding 4 — the parent/subagent discriminator. [I] on a documentation conflict — flagged, not resolved.**
The Agent SDK hooks page states verbatim: *"`agent_id` and `agent_type` are populated when the hook fires inside a subagent. In TypeScript, these are on the base hook input and available to all hook types. In Python, they are optional fields on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, and `PermissionRequest`."* (<https://code.claude.com/docs/en/agent-sdk/hooks>)
**But the CLI hooks reference lists `PreToolUse` common input fields as `session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `effort`, `hook_event_name` — no `agent_id`.** Two official pages, one product, in tension. I am not picking a side. **This is the probe.** Note also that `PostToolBatch` is absent from the SDK's field list — treat it as having **no** discriminator **[U]** and do not use it.

**Finding 5 — `Stop` is a genuine but expensive Option E.** `Stop.additionalContext` fires at end of parent turn and *"the conversation continues so Claude can act on the feedback"* — semantically the best moment for a rule about notifying Warwick *before* handing back. **Cost: it forces an additional parent model turn on every consumption, which breaches Warwick's "zero model calls," and Stop-continuation is the classic loop surface (`stop_hook_active` exists precisely for it).** **[I]** Rejected on cost and risk, recorded so it is not rediscovered.

## 4. The four durability questions

| Question | Label | Answer |
|---|---|---|
| Exactly-once under concurrent returns | **[E]** write / **[I]** consume | Write: proven, distinct `agent_id`s, append-only queued naturally. Consume: parallel tool batches mean multiple hook processes can race one marker. Requires an atomic claim — `rename()` to a `.claimed` name, which **fails** on Windows if the target exists and so acts as a natural mutex. Not executed. |
| Compaction | **[I]** | Marker is a file; it survives. The injected system reminder may be dropped by compaction, which is harmless — it is consumed once, and re-injection is not wanted. |
| `/clear` | **[E]** mechanism | `SessionStart` fires with `source: "clear"` and supports matchers on source. A sweep that deletes every marker whose `session_id` ≠ the current one is documented-clean. Session-scoping is satisfied by comparing `session_id`, which **both** payloads carry. |
| Crash / abandoned session | **[I]** | `SessionEnd` does **not** fire on a crash. A TTL (discard markers older than ~30 min) plus the `session_id` mismatch discard is the only crash-safe sweep. Both are cheap. |
| Stale markers detectable and safely discardable | **[I], yes** | Two independent discriminators — `session_id` mismatch and age. A marker cannot survive into the wrong session undetected. |

## 5. Does it materially improve retrieval, or just add noise?

**[U] — and I will not dress this up.** There is one data point in favour (the launch-time hook did not prevent two misses) and zero data about return-time efficacy. Nobody can establish this in advance.

What I *can* establish is that **it is a change of kind, not a change of dose.** The existing `PostToolUse` hook on `Agent|Task` fires at dispatch — by the time the decision is due, that reminder is tens of minutes and many tool calls stale. Firing at return is a different intervention, not a louder one. **That distinction is the strongest argument for BUILD and it is the one to interrogate if this is challenged.**

**Anti-pattern, named:** the failure mode is not the build, it is the *text*. A generic "a specialist returned, remember the rule" on every return is a banner ad — Larry will skim it within a day, and a gate that is skimmed is a gate that has died while still appearing green. **Warwick's specialist-specific canonical text is what makes it survivable**, because it says something different each time and something Larry cannot supply from habit. If that text ever collapses back to one generic string, retire the hook.

**Cheaper and more reliable than Option C?** **Cheaper: [I] yes** — one script, one marker directory, three settings entries, zero model calls, no service, no daemon, no watcher. **More reliable: [U]** — unprovable in advance. Option C costs nothing and has a measured failure rate of 2-in-1-session.

## 6. Options A–E

| | Verdict |
|---|---|
| **A** SubagentStop → marker → next parent hook relay | **RECOMMENDED, reduced and gated.** The only route that satisfies every constraint. |
| **B** A native event that injects directly into the parent on return | **REJECTED [E].** No such event. `Notification/agent_completed` fires at the right moment but cannot reach Claude's context; `SubagentStop.additionalContext` reaches a context, but the wrong one. |
| **C** Keep dispatch-time hook, Rule 4a as discipline | **Viable fallback, not a straw man.** Zero cost, zero regrowth, and it is the correct answer if the probe fails. Its measured failure rate is the only reason not to stop here. |
| **D** Foreground specialists | **REJECTED.** Sacrifices Larry's availability — the thing background dispatch exists to protect — to fix a reminder problem. Disproportionate. |
| **E** Smaller existing route | **None found that is smaller and sound.** `Stop` (§Finding 5) is smaller but breaches zero-model-calls and adds loop risk. `PostToolBatch` is cheaper than `PreToolUse` but has no documented parent/subagent discriminator. |

## 7. Smallest viable design (design only — not built)

1. **`SubagentStop` (matcher `*`)** → append one marker file `.claude/state/return-cues/<agent_id>.json` containing **only**: `session_id`, `agent_id`, `agent_type`, ISO timestamp. **No message content** — the cue must not become a summary Larry might act on instead of the real return.
2. **`UserPromptSubmit`** and **`PreToolUse` (matcher `*`)** → the same consumer script. It **exits 0 immediately** unless: no `agent_id` in its own payload (parent-only), marker `session_id` matches, and marker age < TTL. Otherwise it claims each matching marker by atomic rename, emits one `additionalContext` string built from tracked canonical text keyed on `agent_type`, and deletes the claim.
3. **`SessionStart`** → delete every marker whose `session_id` ≠ current, and every marker past TTL.
4. **Canonical cue text lives in one tracked file**, keyed by `agent_type`, and the hook only looks up and prints. **The hook never classifies, never sends, never spawns.** An unknown `agent_type` gets a generic line — never a guess.
5. **Always exit 0.** A cue that can break the parent turn is worse than no cue. The existing `notify-reminder.mjs` already models this correctly and should be the template.

## 8. Named failure modes

1. **Premature fire — the worst one.** The relay can fire on a parent tool call that happens *before* the completion notification lands ("in a later turn"), so Larry is told to act on a return he cannot yet see, and the marker is then consumed. **Mitigation: the cue names the `agent_type`, so Larry knows *who* returned even before the notification body arrives.** Residual risk accepted; **[U]** how often it occurs.
2. **Wrong-context injection** if `PreToolUse` inside a subagent lacks `agent_id` (§Finding 4). This is the kill condition.
3. **Double injection** under parallel tool batches, if the atomic claim is not truly atomic.
4. **Habituation** (§5). Un-mitigable by engineering; mitigated only by specialist-specific text.
5. **Host upgrade silently changes payload fields** — this whole design rests on undocumented-in-the-CLI-reference fields. **Re-run the probe after any host upgrade.** An agent shim's YAML breaks silently; so will this.
6. **Regrowth.** The moment anyone proposes a registry, a state manager, or a second hook to police the first, the diagnosis was wrong. Cap it at one script and one directory.

## 9. The single probe that settles the verdict

Register a temporary `PreToolUse` hook (matcher `*`) in **untracked** `.claude/settings.local.json` that dumps its full stdin payload. Dispatch one background specialist that makes at least one tool call, while the parent also makes tool calls. Then compare the payloads.

- **Parent firings carry no `agent_id`; subagent firings carry `agent_id` + `agent_type`** → **BUILD proceeds.**
- **Both look identical** → **DO NOT BUILD. Fall back to Option C.**

Worth folding into the same run, at no extra cost: (a) does `Notification` fire with `notification_type: agent_completed` on a background subagent return? (b) does `SubagentStop.additionalContext` land in the subagent transcript or the parent's? Neither changes the verdict; both remove guesswork from the design.

---

## 10. Methodology and limitations

**Method:** read Larry's staged executed evidence first; then the official CLI hooks reference, the hooks guide, the subagents page and the Agent SDK hooks page; then one targeted search that surfaced GitHub issue #7881. Every load-bearing claim is either executed locally or quoted verbatim from an official page, and each is labelled.

**Limitations, stated plainly:**
- **Pax holds no `Bash` and executed nothing.** Every **[E]** in §2 is Larry's execution, not mine; every **[E]** elsewhere is a documentation fact, not a runtime fact. **I have not verified any hook behaviour myself.**
- **Finding 4 rests on a single official page** (the Agent SDK hooks reference) which the CLI hooks reference appears to contradict. Flagged as single-source and unresolved by design.
- **The host version was not captured in the evidence file.** The sub-agents page pins behaviour to versions (`v2.1.186`, `v2.1.198`, `v2.1.211`) — record the exact host version alongside any probe result, or the evidence has no shelf life.
- No source anywhere addresses whether a return-time reminder improves compliance. That question is empirical and only this estate can answer it, after the fact.

**Sources**
- <https://code.claude.com/docs/en/hooks> — official CLI hooks reference (events, payloads, `additionalContext`, `hookSpecificOutput`, matchers, exit codes)
- <https://code.claude.com/docs/en/hooks-guide> — official hooks guide
- <https://code.claude.com/docs/en/sub-agents> — official subagents page (background subagent behaviour, completion notification, version notes)
- <https://code.claude.com/docs/en/agent-sdk/hooks> — official Agent SDK hooks reference (`agent_id`/`agent_type` inside subagents)
- <https://github.com/anthropics/claude-code/issues/7881> — historical, superseded by executed evidence on this machine
- Larry's local probe, 2026-08-06, three `SubagentStop` firings — primary executed evidence
