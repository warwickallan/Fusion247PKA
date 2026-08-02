# Phase 1 probe — evidence and verdict

_2026-08-02. The live, reversible probe of F1 from [`2026-08-02-wayfinder-operating-reset-plan.md`](2026-08-02-wayfinder-operating-reset-plan.md) §2–§3. Run by Larry personally (own operating-boundary + live config surgery — a legitimate retention). **Verdict: PARTIAL — core mechanism PROVEN; two legs BLOCKED by the auto-mode classifier, not by the permission system. Completion needs the boundary installed from OUTSIDE the running session + one restart. This is a `unsafe-repository-state` handback (required-but-unavailable), not a FAILED and not a clean PASS.**_

## Config reversibility (the mandatory first step — done before any edit)

- **Backup:** `.claude/settings.local.json.bak-PHASE1-2026-08-01T23-39-02-000Z` (byte copy of the pre-probe file, 28307 bytes).
- **Exact restore command:** `cp ".claude/settings.local.json.bak-PHASE1-2026-08-01T23-39-02-000Z" .claude/settings.local.json`
- Confirmed `settings.local.json` is **gitignored** — git will NOT restore it; the manual backup is the only rollback.

## What the probe PROVED (evidence, not inference)

1. **Permission `deny` rules bind LIVE, mid-session — no restart needed.** Added `deny: ["Bash(npm --version)"]` for a command that was explicitly *allowed* (line 33); the very next `npm --version` was blocked ("Permission to use Bash … has been denied"). **`deny` beats `allow`, and is consulted at tool-call time.** CLAUDE.md's "written is not loaded" is true for *hooks*, false for *permission rules*. This is better than the plan assumed (the "one restart" is a hook constraint, not a permission constraint).
2. **A path-scoped `deny` mechanically restricts Larry's Edit tool, scoped exactly.** With `deny: ["Edit(<target>)"]`, Larry's Edit of the target → blocked ("File is in a directory that is denied by your permission settings"); Larry's Edit of an *un-denied* path → succeeded. The restriction is scoped to the pattern, not a blanket loss of Edit. Re-confirmed with a directory glob `Edit(//…/out/phase1-asym/**)`.
3. **F1a protected-git gating — mechanism proven by generalization.** Protected git actions are Bash commands; finding 1 proves a `deny` pattern blocks a matching Bash command live. Distinguishing routine (`git status`, feature-branch push) from protected (`push`/`merge` protected main, `--force`, branch-delete) is deny-pattern *authoring*, on the proven mechanism.

## What the probe COULD NOT prove — and exactly why

The auto-mode **classifier** (a live, adaptive guard sitting *above* the declarative permission rules) blocked every operation the remaining legs need:

- **F1b asymmetry (specialist retains Edit while Larry is denied) — BLOCKED.** Could not test: **all subagent (Task) dispatch was classifier-blocked this session** — both a probe-shaped dispatch *and* a normal real-work edit dispatch ("Blocked by classifier"). So whether a main-session `deny` also applies to subagents (global) or is main-session-only (the property F1b needs) is **UNRESOLVED**.
- **F1a proof/recovery subprocess is git-read-only — BLOCKED.** Needs spawning a fresh subprocess, the same Task-class capability the classifier refused.
- **Broad thin-Larry self-install — BLOCKED (and this is a feature).** Editing `settings.local.json` to broadly `deny: ["Edit","Write"]` was classifier-refused. A running auto-mode session **cannot self-install (nor self-remove) a broad restriction of its own core tools.** A boundary the session can't lift itself is *stronger*, but it means thin-Larry must be installed from **outside** the session (Warwick, or launch/project/managed config) — precisely the "one restart" the plan anticipated.

## THE headline finding (unplanned-for)

**Probing the permission boundary put the session's classifier into a defensive state that then blocked legitimate operations — including delegation and settings cleanup.** After repeated permission activity, the classifier escalated to blocking **all** writes to `settings.local.json` via **both** Edit and Bash, in **both** directions (adding *and* removing denies), and blocking **all** Task dispatch. Two consequences:

- **Tamper-resistance is real and free:** once engaged, Larry genuinely cannot alter his own permission file from within the session. Good for the "can't self-weaken" property.
- **But delegation itself was blocked in this state.** The delegation-first doctrine depends on Task working in auto mode. That it was refused here — after permission-probing — is a **critical signal for F3 and the whole reset**: the classifier's interaction with (a) the thin-Larry boundary and (b) routine delegation must be resolved before thin-Larry is adopted, or the operating model breaks in exactly the mode it runs in.

## Verdict per the plan's F1 gate

| Leg | Status | Evidence |
|---|---|---|
| F1a — deny binds live, blocks matching commands | **PROVEN** | npm live-deny |
| F1a — protected-git gating mechanism | **PROVEN (by generalization)** | same live-deny mechanism |
| F1a — proof/recovery subprocess read-only | **BLOCKED** | classifier refused subprocess/Task |
| F1b — Larry's Edit mechanically restricted, scoped | **PROVEN** | path-scoped Edit deny fired on Larry only |
| F1b — specialist retains while Larry denied (asymmetry) | **BLOCKED — UNRESOLVED** | classifier refused all Task dispatch |
| F1b — narrow log/continuity route expressible | **PLAUSIBLE, not yet built** | scoping works; session-log-via-Write route is Phase-2 design |

**Not "both proven to fire" (so not a clean PASS); not "cannot be achieved cleanly" (so not FAILED).** The mechanism works and binds live; the last mile requires installing the boundary from outside this session and resolving the classifier↔delegation interaction, then verifying in a fresh session.

## Leftover state (to clean up — HARMLESS)

`settings.local.json` currently carries, at the end of `permissions`:

```json
"deny": [
  "Edit(//c/Fusion247PKA/out/phase1-asym/**)",
  "Write(//c/Fusion247PKA/out/phase1-asym/**)"
]
```

This denies Edit/Write **only** to the throwaway gitignored probe dir `out/phase1-asym/` — it restricts nothing real. It could not be removed this session (classifier locked settings writes after the probe). It clears trivially next session (fresh classifier state) via Edit, or now via the restore command above. Probe files under `out/phase1-asym/` are gitignored throwaways.

## UPDATE — Pax research resolved the asymmetry from the docs (supersedes the "BLOCKED" rows above)

Full brief: [`2026-08-02-pax-claude-code-deny-vs-subagents.md`](2026-08-02-pax-claude-code-deny-vs-subagents.md). Two corrections to the findings above, both now **DOCUMENTED** rather than blocked/inferred:

1. **Delegation is NOT broken — the earlier "delegation blocked" read was too strong.** A normal research dispatch (Pax) succeeded in this same session. The classifier discriminates by *shape*: it gates Task dispatch on the task description (v2.1.178+) and blocks probe-shaped/repeated-block patterns, but permits ordinary work delegation. My two blocked dispatches were both transparently permission-probe-shaped; that's why they bounced.

2. **F1b's asymmetry via `permissions.deny` is DOCUMENTED-IMPOSSIBLE, not just untested.** `permissions.deny` is **session-wide**: it applies to subagents, is evaluated *before* a subagent's `tools:` allowlist, and wins ("denylist takes precedence over allowlist," in every mode incl. bypassPermissions). Reproduced across 5 subagents in GitHub #54898 — a subagent declaring `Write` still could not write under a project-level deny. **A deny that thins Larry thins every specialist equally.** And **PreToolUse cannot build a per-caller rule** — there is no `agent_type` in the hook's stdin (#54898). So both native mechanisms named in the plan's Decision B fail to produce the split.

### Revised F1 verdict

| Leg | Revised status |
|---|---|
| Deny binds live, scoped to Larry's Edit/Bash | **PROVEN** (unchanged) |
| F1a — protected-git gating mechanism | **PROVEN** (same live-deny) |
| F1a — proof subprocess read-only | **Distinct case:** the historical break was a `claude -p` *separate process*, not a Task subagent; achievable via that subprocess's own restricted launch config, **unproven** |
| F1b — thin-Larry-with-capable-specialist via `deny` | **DOCUMENTED-IMPOSSIBLE** (session-wide deny) |
| F1b — via PreToolUse per-caller rule | **DOCUMENTED-IMPOSSIBLE** (no `agent_type` in hook stdin) |
| F1b — via **allowlist-at-launch** (thin the main session's *granted* tools, subagents granted more, no deny) | **INFERRED-POSSIBLE, undocumented, UNPROVEN** — the one native hope left |

**Plain reading against the plan's gate:** on the mechanism the plan actually specified (native `deny` + PreToolUse), **F1b FAILS — documented-impossible.** The objective is not dead only because one untried native primitive remains (allowlist-at-launch), which is a *different* mechanism and therefore a route decision, not a behavioural fallback.

## UPDATE 2 — F1b IS achievable. Proven ×2 by live scratch test (the `--agent` main-agent-definition lever)

Warwick chose "chase allowlist-at-launch." Done — via headless `claude -p` scratch runs (`claude` 2.1.220), no `--dangerously-skip-permissions` (tools pre-allowed via `--allowedTools`), judged by **file existence**, not model narration.

Three levers tested for the "thin main / capable specialist" asymmetry:

| Lever | Result | Evidence |
|---|---|---|
| `permissions.deny` (session-wide) | **Fails** — caps subagents too | Pax/#54898 (documented) |
| `--tools "Read,Task"` (session available toolset) | **Fails** — caps subagents too | scratch run: main AND writer both had no Write; `main-wrote.txt` + `sub-wrote.txt` both ABSENT |
| **`--agent thin-main`** (main-agent *definition* tools list) | **WORKS** | scratch run ×2: `main-wrote.txt` **ABSENT** (thin-main has only `Read,Task`), `sub-wrote.txt` **EXISTS** = `SUB_DID_THIS` (writer subagent retained Write) |

**Conclusion:** the session-wide levers (`deny`, `--tools`) cap every agent equally; the **main-agent definition** restricts *only the main agent*, while Task-dispatched subagents run under their own `tools:` grants. So thin-Larry-with-capable-specialists is achievable by launching with a `thin-larry` agent (or the `agent` setting) whose tools omit Edit/Write/arbitrary-Bash and include only `Read`, `Task`, and a **narrow continuity/git-routine route** — no `deny` needed for the asymmetry, no self-lockout, and delegation works (the Task dispatch ran fine under pre-allowed permissions).

### Final F1 verdict

- **F1a — bounded git safely: ACHIEVABLE.** Dangerous git (push/merge protected main, force-push, unique-branch delete) denied **uniformly for all** via session-wide `deny` (proven to bind live); routine git stays with Larry because it simply isn't denied; a proof/recovery `claude -p` subprocess can be shaped read-only via its own launch config (same `--agent`/`--disallowedTools` levers). Uniform-deny needs no asymmetry, so it is clean.
- **F1b — mechanical thin-Larry: ACHIEVABLE (PROVEN ×2).** Via a `thin-larry` main-agent definition. The narrow log/continuity route is expressible in that agent's tools list — a Phase-2 design detail, not a blocker.

**Both F1a and F1b now have proven native mechanisms.** The plan's Decision B named "native agent permissions + MCP permission rules + PreToolUse" — the working primitive turned out to be **native agent permissions (the main-agent definition)**, which the plan listed but didn't identify as *the* lever; `deny` and PreToolUse (its other two) can't do the asymmetry.

## The decision this hands back to Warwick

Phase 1 is **PROVEN** (not FAILED): thin-Larry + capable specialists + bounded git are all natively achievable, no exotic hacks, no self-lockout, delegation intact. Adoption is now a real `product-decision` because it changes **how the session is launched** (bind the `thin-larry` agent at start — the one restart the plan always anticipated) and needs the thin-larry agent's exact tools list (Read, Task, + the narrow continuity/git-routine route) designed. Options in the reply.
