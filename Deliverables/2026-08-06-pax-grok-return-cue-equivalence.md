# Grok-native equivalents for Claude return-cue lifecycle hooks

**Commission:** BUILD-020 ACTIVE SESSION WORK PACKAGE §F  
**Author:** Pax · **Date:** 2026-08-06  
**private_surface:** none · **Research and verdict only — nothing implemented**  
**Governance head:** tip of `build-020/phase4-automation-law` (verify with `git rev-parse HEAD` at act time; this sandbox could not read `.git/HEAD`)  
**Host docs pin:** Grok Build **0.2.118** (`C:\Users\Buggly\.grok\version.json`) · official guide `C:\Users\Buggly\.grok\docs\user-guide\10-hooks.md` + `16-subagents.md` (+ web mirror `https://docs.x.ai/build/features/hooks`)

**Labels:** **[E]** official documented (verbatim or tight paraphrase from Grok user guide) · **[O]** observed live on this estate · **[I]** inferred · **[U]** unsupported / absent / unexecuted

---

## 1. Verdict

### **DO NOT BUILD on Grok**

Do **not** treat the Claude Option A path — `SubagentStop → marker → parent PreToolUse/UserPromptSubmit → hookSpecificOutput.additionalContext` — as a Grok-native completed automation.

| | |
|---|---|
| **Why** | Grok documents **no silent parent-context injection** on the events the Claude design uses for consume. Passive hooks **ignore stdout**. `additionalContext` is documented **only** under `Stop` / `SubagentStop` decision control, where it **keeps the agent working** (another model round), and `SubagentStop` runs **in the subagent**. |
| **What already exists** | Tracked dual-harness registration (`.grok/hooks/return-cue.json` → shared scripts) + unit/CLI dual-payload proof. That is **capability and registration**, not live completed automation on this host. |
| **Grok host stance** | **Option C (discipline)** for Rule 4a on Grok: Rule 4a remains Larry's judgement. Do not claim host-automatic return-time retrieval cue on Grok. |

**Not chosen:**

- **BUILD Grok-native path** — no documented zero-model parent injection equivalent to Claude's `additionalContext` on `PreToolUse` / `UserPromptSubmit`.
- **BUILD reduced fallback** (as product automation) — a write-only marker or a parent `Stop` gate can be built, but the first does not complete the outcome and the second **breaches zero-model-calls** and is a different product (Claude brief Option E, already rejected on cost).

---

## 2. Comparison matrix (Claude return-cue need → Grok)

| # | Capability | Grok status | Evidence |
|---|---|---|---|
| **1** | SubagentStop / completion event for background subagents | **[E]** Event exists. Fires when subagent turn ends; **once, in the subagent**, with stop decision control. Alias `SubagentEnd`. Matcher tests **subagent type**. Background spawn is a separate tool param (`background: true` on `spawn_subagent`). | `10-hooks.md` events table + SubagentStop notes; `16-subagents.md` spawn params |
| **2** | Parent PreToolUse | **[E]** Exists; **blocking** (deny via `decision` / exit 2). Tool matchers + Claude name aliases (`Bash`→`run_terminal_command`, `Task`→`spawn_subagent`). | `10-hooks.md` |
| **3** | UserPromptSubmit | **[E]** Exists; **non-blocking**. Matcher ignored (always fires). | `10-hooks.md` |
| **4** | SessionStart | **[E]** Exists; **non-blocking**. Matcher on start source (`startup`, `resume`, …). Suitable for **side-effect** sweep only. | `10-hooks.md` |
| **5** | Parent-context / `additionalContext` injection into the **parent** (not specialist) | **[U]** for Claude consume path · **[E]** only as Stop-gate feedback | See §3. Passive: *stdout ignored*. PreToolUse stdout docs only `decision` allow/deny. `additionalContext` only under Stop/SubagentStop, and it **continues** the agent. SubagentStop targets the **subagent**. |
| **6** | Background specialist completion identity (`agent_id` / `agentType` / `sessionId`) | **[E]** partial · **[U]** for full Claude shape | Always on stdin: `sessionId`, `hookEventName`, … **[E]**. `Stop.backgroundTasks[]` has `id`, `type`, `agentType` for **in-flight** tasks **[E]**. SubagentStop matcher can select by type **[E]**. Top-level `agentId` / `agentType` on SubagentStop or PreToolUse **not listed** in the official stdin contract **[U]**. Session disk meta has `subagent_id`, `parent_session_id`, `subagent_type` **[O]** (not a hook field). Unit tests assume camelCase `agentId` — **JSON-shape invention, not [E]**. |
| **7** | Project hook loading + folder trust (esp. this worktree) | **[E]** + **[O]** | Project hooks under `<project>/.grok/hooks/*.json` require `/hooks-trust` or `--trust`; stored in `~/.grok/trusted_folders.toml`; silent skip until trusted. **[O]** file now has `C:\Fusion247PKA-build-020-trial` `trusted = true` **and** `C:\Fusion247PKA`. Phase-4 evidence recorded an earlier miss (trust only on main tree) and no live marker from host runner. Trust present ≠ live fire proven. |
| **8** | Session / worktree scoping of markers | **[E]** session id · **[I]** worktree | Every hook carries `sessionId` + `GROK_SESSION_ID` **[E]**. Sessions stored under `~/.grok/sessions/<encoded-cwd>/<session-id>/` **[E]** — cwd/worktree is part of storage layout. App-level markers under `.claude/state/return-cues/` are **not** host-scoped; scripts must filter on `sessionId` themselves. |
| **9** | Exactly-once consume | **[U]** host · **[E]** app design only | No host exactly-once primitive. Atomic rename claim is application logic (unit-tested); **not** live-proven on Grok. |
| **10** | Stale-state cleanup | **[E]** mechanism available | `SessionStart` can run side-effect scripts (stdout ignored). Sweep script design is fine as filesystem hygiene; does not inject context. |
| **11** | Hook runs in parent vs specialist context | **[E]** | *“Inside a subagent, the gate fires as `SubagentStop` … A `Stop` hook only gates the main agent.”* SubagentStop = subagent turn end. PreToolUse fires for tools wherever they run; **parent/subagent discriminator on PreToolUse is not documented**. |

---

## 3. Closest genuine Grok equivalent

### What Claude Option A needs (load-bearing)

1. Write at specialist completion (side effect OK).  
2. **Inject one specialist-specific reminder into Larry's parent context** at the next safe parent moment.  
3. Zero model classification / zero auto-send.  
4. Parent-only consume (never into the specialist).

### Closest **documented** Grok path (not recommended)

| Hop | Grok event | Role | Honest limit |
|---|---|---|---|
| Write | `SubagentStop` command hook | Filesystem marker / log | Side effects work. Identity fields for marker keys are **under-specified** (see kill #2). Session id may be **child**, not parent (**[I]** kill risk). |
| Inject | Parent **`Stop`** with `hookSpecificOutput.additionalContext` or `decision: block` + reason | Feeds text back to the **main** agent | **[E]** injection — but **keeps the agent working** (extra model round). Cap 8 continuations/turn. Fires on every genuine parent completion unless gated. This is Claude brief **Option E**, rejected for zero-model-calls and loop risk. |
| Not inject | `UserPromptSubmit`, `SessionStart`, `PostToolUse` | Side effects only | **[E]** *“For passive hooks … stdout is ignored.”* |
| Not inject (documented) | `PreToolUse` | Allow/deny only | Official PreToolUse output is `decision` allow/deny. **No** documented `additionalContext` land on PreToolUse. |
| External only | `[[ui.notifications.hooks]]` (`turn_complete`, …) | OS/user notification | Not model context. Different product. |

### What is **not** a genuine equivalent

- Copying Claude event names into `.grok/hooks/return-cue.json` and assuming Claude `additionalContext` semantics on PreToolUse/UserPromptSubmit.  
- Unit tests that pipe synthetic camelCase JSON into the scripts and print `additionalContext` — proves **script I/O**, not host injection.  
- Comment in `return-cue-consume.mjs` that “Grok accepts the same … vocabulary” — **[I] from implementer, contradicted by official passive/Stop-only docs**.

---

## 4. Exact kill conditions (Grok)

State these in advance. Any one is enough to keep **DO NOT BUILD** for the Claude-shaped product:

1. **Parent injection kill (docs already fire).** If the product requires silent `additionalContext` into the parent on `PreToolUse` or `UserPromptSubmit` without a Stop continuation → **unsupported on Grok [E]**.  
2. **Identity kill.** If live `SubagentStop` stdin lacks a stable unique id **and** a type usable for specialist-specific text → cannot write a safe per-return marker → write half fails.  
3. **Session-scope kill.** If `SubagentStop.sessionId` is the **child** session and parent tool hooks carry the **parent** sessionId → markers never claim → consume is dead. (**[I]** from “fires … in the subagent” + dual session dirs; must be proven live.)  
4. **Wrong-context kill.** If parent `PreToolUse` cannot be distinguished from subagent `PreToolUse` and any future design tries to inject on PreToolUse anyway → cue can land in the specialist. (Today PreToolUse injection is undocumented anyway.)  
5. **Trust kill.** Project hooks silently skipped without folder trust. Trust for this worktree is **[O]** true now; still require `/hooks` list confirmation after reload.  
6. **Stop-gate cost kill.** Any design that uses parent `Stop` + `additionalContext`/`block` to inject **must not** be sold as zero-model-calls automation; it forces continuation and is a different acceptance bar.

---

## 5. What Larry must execute to prove live

Pax has no durable Bash for host probes. Larry stages:

### Probe G-1 — docs residual: payload dump (10–15 min)

1. Confirm `/hooks` shows project `return-cue` (or temporary dump hooks) **enabled** after trust.  
2. Untracked dump hook on `SubagentStop`, `PreToolUse`, `UserPromptSubmit`, `Stop` → append full stdin JSON + env (`GROK_SESSION_ID`, `GROK_HOOK_EVENT`) to gitignored `scratchpad/probe-grok-hooks/`.  
3. Parent tool call → background `spawn_subagent` that makes ≥1 tool call → parent tool call after return.  
4. Capture and classify:

| Question | Pass criterion |
|---|---|
| Does SubagentStop fire at background completion? | ≥1 dump file |
| `sessionId` parent vs child? | Compare to parent session + `subagents/*/meta.json` |
| Top-level `agentId` / `agentType` present? | Present or absent — record either way |
| Parent vs subagent PreToolUse differ? | Discriminator field or identical |
| Does PreToolUse/UserPromptSubmit stdout `additionalContext` appear in **parent** transcript / next model input? | Unique token must be visible in parent context — else inject fails |

### Probe G-2 — product outcome (only if G-1 shows undocumented inject)

Only if G-1 proves PreToolUse (or another non-Stop event) injects into parent: run full write→consume once. Until then, **do not** reclassify to BUILD.

### Do not

- Re-run Claude §9 probe and call it Grok proof.  
- Treat empty `.claude/state/return-cues/` after a Grok session as consume success without a write dump.  
- Implement a Stop-gate “reduced path” without Warwick `product-decision` (extra model turns).

---

## 6. Honest residual if Grok cannot inject into parent context

**Residual (primary):** On Grok, Larry may receive a UI/scrollback completion chip and the specialist return summary through normal host plumbing, but **there is no documented zero-model host hook that resurfaces Rule 4a inside the parent model context at return time.** Rule 4a remains **manual judgement** (already reclassed for ding). Return-cue on Grok is **not** completed automation.

**What remains valid:**

| Artefact | Status on Grok |
|---|---|
| Claude host Option A (proven fields on 2.1.222) | Separate host — not this brief's pass |
| Shared scripts + dual normalise | Useful if a future Grok version documents parent inject; not proof |
| `.grok/hooks/return-cue.json` | Registration only until G-1 passes inject |
| SessionStart sweep | Harmless hygiene if write ever works |
| Option C discipline | **Correct Grok operating answer** |

**Anti-pattern:** Shipping dual-harness green unit tests + trusted-folder row as “return-cue works on Grok.” That confuses **script capability** with **host injection**.

---

## 7. Matrix summary vs Claude (one line each)

| Claude load-bearing piece | Grok |
|---|---|
| SubagentStop fires at background return | **[E]** yes (in subagent) |
| Marker write as side effect | **[E]** possible · **[U]** live on this worktree |
| Parent PreToolUse `additionalContext` inject | **[U]** not documented; PreToolUse = deny only |
| UserPromptSubmit inject | **[U]** passive stdout ignored |
| agent_id parent/subagent discriminator | **[U]** not in official PreToolUse fields; Claude **[O]** only |
| SessionStart cleanup | **[E]** side effects OK |
| Zero-model return cue product | **Unsupported** on documented Grok surface |

---

## 8. Methodology and limitations

**Method (priority order as commissioned):**

1. Read fully: `C:\Users\Buggly\.grok\docs\user-guide\10-hooks.md`, `16-subagents.md`.  
2. Cross-read: `17-sessions.md`, `20-background-tasks.md`, `22-permissions-and-safety.md`, `05-configuration.md` (notification hooks).  
3. Corroborate public mirror: `https://docs.x.ai/build/features/hooks` (shorter; same passive-stdout rule).  
4. Estate observation: `trusted_folders.toml`, session `subagents/*/meta.json`, empty `return-cues/`, prior Deliverables (`2026-08-06-pax-subagent-return-cue-brief.md`, `s9-agent-id-probe-evidence.md` = **Claude** host, `phase4-closure-wp-evidence.md`, `.grok/hooks/return-cue.json`, shared scripts).  
5. **Did not** invent Claude equivalence from JSON shape alone; unit-test camelCase cases flagged as non-evidence for host behaviour.

**Limitations:**

- Pax did not run a live Grok hook dump this commission (limited Bash; Larry stages G-1).  
- Official docs never enumerate a full SubagentStop field list beyond common fields + `phase` + stop-gate fields; absence of `agentId` is **negative documentation**, not a live dump.  
- Trust row for this worktree may post-date the phase-4 “hooks skipped” observation; both facts stand.  
- Claude §9 evidence is host `2.1.222` only — orthogonal.

**Sources (load-bearing):**

| Source | Role |
|---|---|
| `~/.grok/docs/user-guide/10-hooks.md` | Primary: events, passive stdout, Stop `additionalContext`, trust, camelCase |
| `~/.grok/docs/user-guide/16-subagents.md` | Background spawn, completion to parent, depth limits |
| `https://docs.x.ai/build/features/hooks` | Independent public corroboration of passive stdout + event list |
| `Deliverables/2026-08-06-phase4-closure-wp-evidence.md` | Live Grok residual (no marker without trust) **[O]** |
| `Deliverables/2026-08-06-s9-agent-id-probe-evidence.md` | Claude-only payload proof — not Grok |
| `~/.grok/trusted_folders.toml` | Current trust state **[O]** |

---

## 9. Recommendations (for Larry / Warwick)

1. **Record Grok return-cue product as DO NOT BUILD** under documented host law; keep Option C on Grok.  
2. **Leave** dual-harness scripts in tree as Claude path + future-compat normalisers; do **not** claim Grok live automation.  
3. **Optional:** Larry runs Probe G-1 once; if docs are incomplete and inject is real, reopen with a new Pax brief — do not silently upgrade this verdict.  
4. **Do not** implement parent Stop-gate cue without an explicit Warwick product-decision (extra model turns).  
5. **Do not** grow a registry/daemon to paper over missing parent inject — regrowth cap applies.
