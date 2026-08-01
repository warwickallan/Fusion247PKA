---
name: nolan-01-visible-journey-and-config
type: audit
build: BUILD-018
auditor: Nolan (HR / independent audit)
status: complete
created: 2026-08-01
audited_head: 4d169a7fbc5614b93fa16d01080c6bf2e73b2424 (order) / a27b073 observed mid-run
private_surface: none
---

# BUILD-018 — Independent audit: the visible journey and the configuration set

Read-only audit. Every verdict below names the file+line or the command output that
settles it. Where I could not settle something I say UNKNOWN and name what would.

---

## 0. Read-back

**(a) The outcome this order is trying to reach.** Larry needs one honest,
independently-derived answer: as of right now, what does Warwick *actually and visibly
get* from BUILD-018 — durably, through Remote Control web and Android — and what is
claimed but is not true. Plus a complete map of the active hook/statusLine
configuration across all scopes, and a ruling on whether the hooks installed in the
primary checkout are live for a session running in the governor worktree.

**(b) My plan.** Establish the current truth by execution, not by reading the banked
prose (which the order already flags as stale). Specifically: read the four settings
files and the two governor entrypoints; run `statusline-live.mjs` and
`worktree-guard.mjs` against synthetic payloads with the health store redirected to
scratch; run `install-hooks.mjs --check` (read-only by its own contract); and — the
decisive step — read the Claude Code session transcripts under
`~/.claude/projects/**` for *hook execution records*, because a hook that is written
into a settings file is not the same fact as a hook that fired.

**(c) What the order failed to settle.** It asserts the banked "statusLine is NOT SET"
claim is stale and tells me to verify current truth myself — correct — but it frames
the question as *statusLine vs hooks*, and the real fault line turned out to be
*written vs loaded*. It also gave no acceptance bar for item 1 ("reaches web/Android"):
I have taken that to mean a surface Warwick sees in the claude.ai web/Android client
without Larry typing it by hand.

**(d) What looked wrong in it.** Nothing material. One thing was understated: the order
says "Larry has ALREADY verified this session that the statusLine IS now wired". That is
true and I re-confirmed it. But the same reasoning — "it is in the settings file,
therefore it is live" — is exactly what is false for the *hooks*, and the order did not
anticipate that. I found no ambiguity worth a HOLD, so I proceeded in the same run.

---

## 1. The headline

**BUILD-018 currently gives Warwick exactly one visible thing: a terminal status line.**
It works, it is genuinely live, and it is invisible on web and Android — which is where
Warwick actually is.

**Everything else that is "installed" is not running.** The reorientation hook and the
wrong-worktree guard are correctly written into
`C:/Fusion247PKA/.claude/settings.local.json`, and have **fired zero times, ever**. The
hook table the running Claude Code process is actually using is the *pre-installation*
one from 2026-07-31T17:05Z — it still fires a hook whose target script was deleted from
the settings four and a half hours earlier, and it does not contain the governor's hooks
at all.

This is a worse failure than the one the banked state records, because it is invisible
in both directions: reading the settings file says the wiring is done, and it is not.

---

## 2. Section 3a — the visible-user-journey audit

### Verdict table

| # | Claim | Verdict |
|---|---|---|
| 1 | Live context health reaches a surface Warwick can see on web/Android | **NOT TRUE** |
| 2 | GREEN/AMBER/RED/BLIND derived from live telemetry | **PROVEN** |
| 3 | "next model" advice is meaningful now, or honestly absent | **NOT TRUE** |
| 4 | `/clear` reorientation fires and injects the brief | **NOT TRUE** |
| 5 | A genuinely fresh session (`source=startup`) reorients | **NOT TRUE** |
| 6 | Wrong-worktree protection fires | **NOT TRUE** (script proven, wiring dead) |
| 7 | Anything stops a handback at a non-genuine boundary | **NONE** |

---

### 1. Live context health on web/Android — **NOT TRUE**

The status line is real. `C:/Users/Buggly/.claude/settings.json:14-17` and
`C:/Fusion247PKA-governor/.claude/settings.local.json:2-5` both set

```
"statusLine": { "type": "command",
                "command": "node C:/Fusion247PKA-governor/tools/governor/statusline-live.mjs" }
```

and it is executing right now: the health sample for the live parent session
`~/.mypka/governor/health/C--Fusion247PKA-governor/f944fae7-….json` was rewritten
during this audit (`sampled_at` advanced from `01:30:59.872Z` to `01:31:24.793Z` while I
worked). Samples also exist for `C--Fusion247PKA` (4 sessions) and `C--ClaudeJobs`.

But a `statusLine` is a **terminal chrome element**. It is not part of the assistant's
message stream, so it does not travel to the claude.ai web client or the Android app.
The estate has already recorded this as fact — Warwick's own auto-memory note
`larry-governor-footer-every-response.md`: *"Warwick is on claude.ai web + Android; a
terminal statusLine is INVISIBLE there."* The compensating mechanism named there is
Larry appending a `⟦GOV⟧` footer to every response.

**That footer requirement exists nowhere in this repository.** Searching the whole tree:

```
grep -rn "⟦GOV⟧" --include=*.mjs --include=*.md .
./tools/governor/statusline-live.mjs:97
./tools/governor/statusline-live.mjs:105
```

Two hits, both inside the status-line renderer itself. Nothing in `CLAUDE.md`, nothing in
`Team/Larry - Orchestrator/AGENTS.md`, nothing in the reorientation brief, nothing in any
hook tells Larry to emit it. So on web and Android the governor is visible **only when
Larry remembers a rule that is written down only in a machine-local memory file** — which
is precisely the "dependent solely on a memory file" failure Warwick has now ruled out.

**Verdict: NOT TRUE.** The surface Warwick uses gets nothing durable from BUILD-018.

---

### 2. GREEN/AMBER/RED/BLIND from live telemetry — **PROVEN**

`statusline-live.mjs:84-90` feeds the evaluator from the stdin payload only:

```js
const verdict = evaluate({
  contextUsedPercentage: used,
  rateLimitFiveHourUsedPercentage: num(payload?.rate_limits?.five_hour?.used_percentage),
});
```

Executed, with the health store redirected to scratch so nothing real was written
(`MYPKA_GOVERNOR_HEALTH_DIR`, the seam at `health-store.mjs:54`):

```
ctx 13% -> ⟦GOV⟧ ctx 13% · GREEN  · KEEP GOING  · next: Sonnet
ctx 60% -> ⟦GOV⟧ ctx 60% · AMBER  · KEEP GOING  · next: Sonnet
ctx 70% -> ⟦GOV⟧ ctx 70% · AMBER  · KEEP GOING  · next: Sonnet
ctx 75% -> ⟦GOV⟧ ctx 75% · RED    · CLEAR NOW   · next: Sonnet
ctx 92% -> ⟦GOV⟧ ctx 92% · RED    · CLEAR NOW   · next: Sonnet
(empty)  -> ⟦GOV⟧ ctx --  · BLIND  · KEEP GOING? · next: Sonnet
```

All four states reachable, each from the input and not from a stored literal; BLIND on
absent telemetry, never GREEN (INV-1 holds at this surface). Real samples in the live
store carry genuinely different values per session (13 / 39 / 44 %), so this is not a
constant dressed as a measurement.

**Bounded caveat, stated because the code states it (`statusline-live.mjs:87-89`):**
`compactions`, `bankedStateStale` and `safeBoundary` are always absent here. RECOVERY —
the state the evaluator reserves for *authoritative memory already lost*, which
`T-04`'s note says outranks RED — can therefore **never** be reached from the status
line. The one state that means "you have already lost context" is the one this surface
cannot report.

**Verdict: PROVEN**, with RECOVERY unreachable.

---

### 3. "next model" — **NOT TRUE**, and it is a banked literal wearing the costume of live advice

`statusline-live.mjs:47-62`:

```js
function recommendedModel(cwd) {
  const deliverables = join(cwd || process.cwd(), 'Deliverables');
  for (const entry of readdirSync(deliverables)) {
    const p = join(deliverables, entry, 'programme-state.json');
    const doc = JSON.parse(readFileSync(p, 'utf8'));
    const m = doc?.model_recommendation?.model;
    if (typeof m === 'string' && m.length) return m;
  }
}
```

It reads a field off disk. It takes no telemetry argument. The probe above settles it:
**`next: Sonnet` is byte-identical at GREEN 13%, at AMBER 70%, at RED 92%, and with
completely empty stdin (BLIND).** A field that does not change when every input changes is
not advice.

It is worse than merely stale. The banked value's own rationale disclaims itself:

```json
"model_recommendation": { "model": "Sonnet", "effort": null,
  "rationale": "T-12 is named only because deriveResumption requires a frontier ticket;
                it is NOT an instruction to start it." }
```

So the status line renders, as a recommendation, a value the bank explicitly says is not a
recommendation. And it says "Sonnet" while the live sample for the same session records
`"model":{"id":"claude-opus-5"}` at 13% context — there is no reading on which "next:
Sonnet" is useful there.

It *is* honestly absent outside this worktree — probes with `cwd` set to
`C:/Fusion247PKA` and `C:/ClaudeJobs` render no `next:` segment at all, because no
`Deliverables/*/programme-state.json` is found. But inside the worktree it is presented in
the same `·`-separated list as the two live fields, with nothing marking it as banked.

**Verdict: NOT TRUE.** Say it plainly: this is a stale banked literal masquerading as
intelligence. Under the new constitution clause 6 it should render `next: UNSET` unless it
can be grounded.

One further defect in the same function: it returns the **first** `programme-state.json`
found by `readdirSync` order, not the *active* build's. Today only
`Deliverables/BUILD-018-session-governor/` has one, so the bug is latent; the second
concurrent build makes the status line advertise an arbitrary build's model.

---

### 4. `/clear` reorientation fires — **NOT TRUE**

It is installed. `C:/Fusion247PKA/.claude/settings.local.json:203-211`:

```json
{ "matcher": "clear",
  "hooks": [ { "type": "command",
               "command": "node C:/Fusion247PKA-governor/tools/governor/reorient.mjs" } ] }
```

It has never run. I enumerated every hook-execution record in every session transcript for
this worktree (`~/.claude/projects/C--Fusion247PKA-governor/*.jsonl`, 5 sessions). Hook
attachments carry `hookEvent`, `command`, `exitCode`, `stdout`. Across all five sessions:

```
hookEvent counts: { SessionStart: 8, Stop: 29 }
```

Eight SessionStart records = exactly two per session across four sessions, and both are the
same pair every time:

| when (UTC) | type | command |
|---|---|---|
| 2026-07-31T16:19:47Z, 17:24:23Z, 19:20:14Z, 21:39:46Z | `hook_non_blocking_error` | `node --env-file=… …/tower-loop/ensure-watcher.mjs` → `MODULE_NOT_FOUND`, exit 1 |
| +2–5s later, each session | `hook_success` | `node …/fusion-capture-gateway/ensure-capture-gateway.mjs` |

`reorient.mjs` appears in **zero** hook records, in this worktree or in the primary
checkout. Searching every transcript for a hook whose command is
`node C:/Fusion247PKA-governor/tools/governor/reorient.mjs` returns nothing; the only
textual matches are prose and file contents I myself read into context.

The `ensure-watcher.mjs` hook is the tell. It was **removed** from the settings file at
17:05:08Z on 2026-07-31 (the installer's own backup is named
`settings.local.json.bak-2026-07-31T17-05-08-981Z`, and Q-5 in the banked state records
the prune as done and idempotent). It is not in the current file. It still fired at
21:39Z — four and a half hours later. I read the backup: its hook set is
**exactly** the set that fires (`ensure-watcher` + `ensure-capture-gateway` on
SessionStart, `bridge-ingest` on Stop) and it has no `PreToolUse` block and no
`statusLine`.

**The running Claude Code process is using the pre-installation hook table.** There is one
`claude.exe`, PID 22072, created 2026-07-31 10:51:08 local (09:51Z) — before the 17:05Z
install. Every governor session since, including this one, is a `/clear` *inside that same
process*, and `/clear` starts a new session id and transcript but does not re-read the hook
configuration.

> **Mechanism is INFERENCE, clearly labelled.** The observations are facts; "hooks are
> snapshotted at process launch" is my explanation of them. What would settle it: fully
> quit Claude Code, relaunch, `/clear`, and check for a `hook_success` attachment with
> `hookEvent: SessionStart` whose `command` is
> `node C:/Fusion247PKA-governor/tools/governor/reorient.mjs`. Note this cuts against a
> simple "settings are cached" story — `statusLine` was hand-written at 00:47Z/00:49Z on
> 2026-08-01, *after* the same process started, and is being honoured. So settings are not
> uniformly hot-reloaded: the statusLine command is resolved per render, the hook table is
> not.

**Verdict: NOT TRUE.** And note the operational consequence, which is bigger than this
ticket: **installing a hook has no effect until Claude Code is restarted, and nothing in
the installer or its report says so.** `install-hooks.mjs` prints "RESULT: written" and
Larry reasonably read that as "live". It was not.

---

### 5. A genuinely fresh session (`source=startup`) reorients — **NOT TRUE**

Independently confirmed from the installed artefacts, not from Larry's probe.

`tools/governor/install-hooks.mjs:183-185` — the entire SessionStart specification:

```js
const managed = [
  { event: HOOK_EVENT, matcher: 'clear', command, is: isGovernorHook, key: 'governor' },
];
```

`matcher: 'clear'` is the only SessionStart matcher the installer knows how to write.
There is no `startup`, `resume` or `compact` spec anywhere in the file. The live settings
agree: `settings.local.json:204` is `"matcher": "clear"`. The comment at
`install-hooks.mjs:279-281` states the intent explicitly — *"SessionStart fires only on
/clear"* — so this is a deliberate design choice, not an oversight, and the design choice
is wrong for the stated outcome.

A fresh `claude` launch is `source: "startup"`. Nothing matches it. **A brand-new session
in a fresh terminal reorients to nothing** — which is the single most common way Warwick
starts, and the one case where in-context memory is guaranteed empty.

**Verdict: NOT TRUE.** (Larry's F1 confirmed.)

---

### 6. Wrong-worktree protection fires — **NOT TRUE** (the script is proven; the wiring is dead)

The script is genuinely good. Executed against the real estate, wrong location:

```
$ echo '{"cwd":"C:/Fusion247PKA","tool_name":"Write",…}' \
    | node tools/governor/worktree-guard.mjs --estate C:/Fusion247PKA
{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":
 "🚨 WRONG WORKTREE — … MISMATCH: cwd, repository root, branch … NO IMPLEMENTATION IS
  PERMITTED FROM HERE. Absolute paths are NOT a workaround. …
  RECOVERY — Larry performs this, Warwick does not: 1. Larry calls EnterWorktree …"}}
```

and correct location → empty output, exit 0 (silent allow). It reads live git, names the
real branch (`recovery/2026-07-31-governor-abort-handoff`) and the real HEAD. It writes
nothing (`grep writeFileSync tools/governor/worktree-guard.mjs` → no matches).

But it has never adjudicated a real tool call. There is **not one `PreToolUse` hook record
in any governor-worktree transcript** — the event histogram above is `SessionStart: 8,
Stop: 29` and nothing else. And the loaded hook table (§4) is the pre-17:05Z backup, which
contains **no `PreToolUse` key at all**, so the guard cannot have been consulted even
silently.

**Verdict: NOT TRUE.** A correct, well-tested control that is not connected to anything is
not a control. This one is load-bearing: T-11's evidence file records that it was proven
to deny live Write and live `git commit` — that proof was of the *script*, run by hand,
not of the *gate*.

---

### 7. Anything stopping a handback at a non-genuine boundary — **NONE**

No mechanism exists. Evidence:

- The only `Stop` hook anywhere in the active configuration is Tower's
  `bridge-ingest.mjs` (`settings.local.json:183-193`), which ingests the turn and returns
  nothing that could block. Its 29 firings in this worktree all report
  `preventedContinuation: false`.
- `install-hooks.mjs`'s `managed[]` array (lines 183-212) contains exactly four specs:
  one SessionStart, and three PreToolUse (guard, delegation observer, delegation gate).
  **No `Stop` spec. No `AskUserQuestion` spec.**
- `tools/governor/escalation-gate.mjs` exists and works, but its own header and T-17's
  banked note both say it is NOT ACTIVATED; and it governs `AskUserQuestion`
  (`escalation-gate.mjs:378` — every other tool DEFERs), i.e. *asking Warwick a question*,
  not *ending the turn*. Larry ending a turn silently after a worker returns is not an
  `AskUserQuestion` and would never reach it.
- On the doctrine side, `Team/Larry - Orchestrator/AGENTS.md` §9b is a reflex to **reach**
  Warwick ("Before ending any turn, ask: am I ending this needing anything from the user?
  … If in doubt, notify"). §9 immediately above it pushes the same way ("Keep the boss in
  the office"). §9a splits escalate-vs-decide for *decisions*. **There is no counterpart
  anywhere telling Larry not to hand back when a worker finished, a read-back arrived, a
  ticket closed, tests passed or a commit was pushed.** I checked all 584 lines; the
  nearest thing is §9a's "Decide personally" list, which is about authority, not about
  continuing.

**Verdict: NONE today — but mechanically achievable.** Larry's own executed probe
(`evidence/LARRY-hook-contract-probe.md`, F2) shows a `Stop` hook returning
`{"decision":"block","reason":"…"}` on stdout with exit 0 does force continuation, and F3
shows the payload carries `stop_hook_active`, `last_assistant_message` and
`background_tasks`. So the mechanism is available. See §5 for why I think it is also the
most dangerous thing in the design.

---

## 3. Section 3b — the complete active configuration set

### 3b.1 The four files

| # | File | Tracked in git? | Contents |
|---|---|---|---|
| 1 | `C:/Users/Buggly/.claude/settings.json` (user scope) | no (outside repo) | `statusLine` → `node C:/Fusion247PKA-governor/tools/governor/statusline-live.mjs`; plus theme/notifications/marketplaces. **No hooks.** |
| 2 | `C:/Fusion247PKA/.claude/settings.local.json` (project, primary) | **no** — gitignored | `permissions.allow` (~170 entries), `hooks` (below), `enableAllProjectMcpServers`, `enabledMcpjsonServers`. **No statusLine.** |
| 3 | `C:/Fusion247PKA-governor/.claude/settings.local.json` (project, worktree) | **no** — gitignored | `statusLine` only. **No hooks, no permissions.** 131 bytes, mtime 2026-08-01 01:47 local. |
| 4 | `.claude/settings.json` committed in either tree | — | **Does not exist.** `git ls-files .claude/` returns only `agents/*.md` (17) and `commands/*.md` (4). |

Also present and relevant: `C:/Fusion247PKA/.claude/settings.local.json.bak-2026-07-31T17-05-08-981Z`
— the installer's pre-prune backup, and (see §2.4) a byte-level match for the hook set
that is actually running.

### 3b.2 Every hook entry, classified

| Event | Matcher | Command | Target on disk? | Classification |
|---|---|---|---|---|
| `Stop` | `""` | `node --env-file=C:/.fusion247/control-plane-dev.env C:/Fusion247PKA/services/control-plane/tower-loop/bridge-ingest.mjs` | **yes** | **CURRENT** — fires, 29 records, non-blocking. Not BUILD-018's. |
| `SessionStart` | *(none)* | `node C:/Fusion247PKA/services/fusion-capture-gateway/ensure-capture-gateway.mjs` | **yes** | **CURRENT** — fires, succeeds. Not BUILD-018's. |
| `SessionStart` | `clear` | `node C:/Fusion247PKA-governor/tools/governor/reorient.mjs` | **yes** | **WRITTEN BUT NOT LOADED** — zero firings. Also SCRATCH-PATH: points into a worktree that disappears on merge. |
| `PreToolUse` | `Write\|Edit\|MultiEdit\|NotebookEdit\|Bash` | `node C:/Fusion247PKA-governor/tools/governor/worktree-guard.mjs --estate C:/Fusion247PKA` | **yes** | **WRITTEN BUT NOT LOADED** — zero firings; the loaded table has no `PreToolUse` key. Also SCRATCH-PATH. |
| `SessionStart` *(loaded-only, not in the file)* | *(none)* | `node --env-file=… --env-file=… C:/Fusion247PKA/services/control-plane/tower-loop/ensure-watcher.mjs` | **NO** | **OBSOLETE and STILL FIRING** — removed from the file at 17:05Z, still executed at 21:39Z, exits 1 with `MODULE_NOT_FOUND` every session. |
| `PreToolUse` | `Task` | `…/delegation-gate.mjs observe --estate …` | yes | **NOT INSTALLED** — `install-hooks.mjs --check` reports it would be ADDED. |
| `PreToolUse` | `Write\|Edit\|MultiEdit\|Bash` | `…/delegation-gate.mjs check --estate …` | yes | **NOT INSTALLED** — would be ADDED. |

No DUPLICATE and no CONFLICTING entries. The genuine pathologies are *loaded ≠ written*,
one OBSOLETE hook that survived its own deletion, and two SCRATCH-PATH commands.

### 3b.3 What `install-hooks.mjs` installs, where, and whether re-running reproduces the live state

**What it installs** (`managed[]`, lines 183-212): four hooks — SessionStart/`clear` →
`reorient.mjs`; PreToolUse/`Write|Edit|MultiEdit|NotebookEdit|Bash` → `worktree-guard.mjs
--estate <checkout>`; PreToolUse/`Task` → `delegation-gate.mjs observe`;
PreToolUse/`Write|Edit|MultiEdit|Bash` → `delegation-gate.mjs check`. It also prunes any
*non-governor* SessionStart/PreToolUse hook whose `.mjs/.js/.cjs` target does not exist
(lines 264-268), backing the file up first (line 363).

**Where**: `settingsPath(checkout)` = `<checkout>/.claude/settings.local.json`, with the
CLI default hard-coded to `C:/Fusion247PKA` (line 442) and `estate` defaulting to the same
(line 453). The script path defaults to `<repoRoot>/tools/governor/reorient.mjs` resolved
from wherever the installer itself lives (line 443) — which is how the current entries came
to carry `C:/Fusion247PKA-governor/...`.

**Does re-running reproduce the current live state? NO.** Executed, read-only:

```
$ node tools/governor/install-hooks.mjs --check --checkout C:/Fusion247PKA
  SessionStart (reorientation on /clear): already present, unchanged
  PreToolUse (wrong-worktree deny gate): already present, unchanged
  PreToolUse (delegation-dispatch observer): ADDED
  PreToolUse (substantial-work threshold gate): ADDED
  pruned   : none (every existing hook target exists)
  RESULT: settings are OUT OF DATE — re-run without --check to apply.
```

It reproduces a **superset**: re-running silently activates T-16's delegation gate, which
was built but deliberately not wired. Note also that it reports `pruned: none` while the
dead `ensure-watcher` hook is still executing — the pruner is correct about the *file* and
blind to what is *running*, which is the same file-vs-loaded gap as everything else here.

---

### SCOPE — are the primary checkout's hooks active for a session whose cwd is the governor worktree?

**YES. Project-scope hooks from `C:/Fusion247PKA/.claude/settings.local.json` are active
in sessions running in `C:/Fusion247PKA-governor`.** A git worktree inherits the main
checkout's project settings scope.

The evidence is an exclusion argument closed at both ends:

1. The governor worktree's own `.claude/settings.local.json` contains **only**
   `statusLine` — no `hooks` key at all (the whole file is 6 lines).
2. No `.claude/settings.json` is committed in either tree (`git ls-files .claude/`).
3. `~/.claude/settings.json` (user scope) has **no** `hooks` key.
4. Therefore the *only* file in the entire configuration set that defines hooks is the
   primary checkout's `settings.local.json`.
5. And hooks defined there **do** fire in the governor worktree: every one of the four
   governor-worktree sessions carries a `Stop` `hook_success` for
   `node --env-file=C:/.fusion247/control-plane-dev.env
   C:/Fusion247PKA/services/control-plane/tower-loop/bridge-ingest.mjs` (29 records) and a
   `SessionStart` `hook_success` for `ensure-capture-gateway.mjs`.

Corroborating: `~/.claude.json` has `projects` keyed by absolute path and contains
`C:/Fusion247PKA` but **no** `C:/Fusion247PKA-governor` entry — the worktree is not a
separate project to Claude Code.

**But the answer that matters is the second half, and it inverts the practical
conclusion:** being in scope did the governor's hooks no good, because the hook table the
process loaded is the one from *before* they were installed. Scope was never the blocker.
**Staleness was.** Fixing scope alone would change nothing.

---

### REINSTALLABILITY — could `install-hooks.mjs` reproduce the required wiring after a merge or on a fresh machine?

**Partially, and not for the one thing Warwick can actually see.**

- **statusLine: NO.** `install-hooks.mjs` contains zero occurrences of `statusLine`; it
  only ever touches `settings.hooks` (line 164). The statusLine exists solely in two
  hand-edited files, both outside git — `~/.claude/settings.json` (user scope, never in any
  repo) and the worktree's gitignored `settings.local.json`. **On a fresh machine, or after
  this branch merges and the worktree is removed, the single visible output of BUILD-018
  simply does not exist, and nothing detects or reports its absence.**
- **Hooks: yes, but to a superset** (§3b.3), and only after a Claude Code restart, which
  nothing tells the operator to do.
- **Paths: they break on merge.** Both governor commands are absolute into
  `C:/Fusion247PKA-governor/tools/governor/…`. Delete the worktree and they point at
  nothing. The installer *would* repoint them if re-run from the merged checkout (line
  443), and its own prune rule correctly refuses to delete governor-managed hooks even when
  their target is missing (line 258) — so the failure mode is *silently dead hooks*, not
  *deleted hooks*. Nobody is told to re-run it.
- **Verification: absent.** There is no `--verify-live` mode, nothing that compares the
  written config to what actually fired, and nothing that reads the health store to confirm
  the statusLine has produced a sample this session. Every existing check inspects the file
  it just wrote.

---

### PRECEDENCE — how do user-scope and project-scope combine?

| Key | What I established | Evidence |
|---|---|---|
| `statusLine` | User scope alone is **sufficient** where project scope is silent. | `C:/ClaudeJobs` has no project statusLine; a governor health sample exists at `~/.mypka/governor/health/C--ClaudeJobs/6b8c2fea….json` (2026-08-01T00:50Z, `source:"statusLine"`). |
| `statusLine` | Whether project **overrides** user: **UNKNOWN.** | Both scopes currently hold the *identical* command string, so the local install cannot distinguish override from merge from either-wins. Settled by: set the two to different commands and observe which renders. |
| `hooks` | Project-scope hooks are active in the worktree. | §SCOPE above. |
| `hooks` | Whether user-scope hooks **merge with** or are **overridden by** project hooks: **UNKNOWN.** | `~/.claude/settings.json` has no `hooks` key, so there is nothing to combine. Settled by: add one distinct no-op `Stop` hook to `~/.claude/settings.json`, restart, and check whether both it and `bridge-ingest` appear in the same `stop_hook_summary.hookInfos` array (that field enumerates every hook for the event, so it answers merge-vs-override in one observation). |
| both | **Loaded config ≠ written config, and the two keys behave differently.** | `statusLine` written 00:47Z/00:49Z is honoured by a process started 09:51Z the previous day; `hooks` written 17:05Z are not. |

I am not guessing at documented behaviour I cannot execute. Where the local install cannot
distinguish two possibilities I have said UNKNOWN and named the one experiment that settles
it.

---

## 4. Section 3c — the authoritative instruction files vs the startup invariant

### `CLAUDE.md` (repo root) — orients to identity, not to the build

**One important thing it has that no hook has: it is loaded automatically, by the host,
with no hook firing.** I can prove that from inside this run — the full text of
`C:/Fusion247PKA-governor/CLAUDE.md` is present verbatim in my own subagent system prompt
under "Codebase and user instructions". That makes it the **only startup surface in this
estate that is demonstrably reliable**, and the correct home for a startup invariant.

What it currently carries: first-run activation check, the Larry identity overlay, the
pointer to root `AGENTS.md` as SSOT, subagent dispatch mechanics, the GL-012 private-surface
pointer, and four hard rules. What it says about orientation is one line:

> *"Also read on activation: `Team/agent-index.md`, `Team Knowledge/INDEX.md`, `PKM/INDEX.md`."*

**Nothing in it survives `/clear` pointing at an active build.** No mention of banked
programme state, of `Deliverables/<build>/programme-state.json`, of a Goal Contract or
execution map, of verifying worktree/branch/HEAD, of `/rotate-session`, of choosing a
model, or of continuing autonomously. A fresh Larry reading only CLAUDE.md knows who he is
and who the team is, and has no idea a build is in flight.

**Gap: items 3, 4, 5, 7, 8 and 9 of the invariant are wholly absent; items 1, 2 and 6 are
present in weak "also read" form.**

### `Team/Larry - Orchestrator/AGENTS.md` — the handback reflex exists; **no continuation counterpart exists**

Answering the question plainly, as asked: **no, there is no counterpart.**

- §9b (lines 250-261) is the handback reflex, and it is one-directional and strongly
  worded: *"Before ending any turn, ask: am I ending this needing anything from the user?
  … Every handback qualifies … **If in doubt, notify.**"* Every tiebreak in it resolves
  toward interrupting Warwick.
- §9 (227-235) reinforces the same pull ("Keep the boss in the office", "Announce a worker
  when you commission it").
- §9a (237-248) splits escalate-vs-decide, but for *decisions*. "Decide personally:
  reversible implementation choices · which worker · scope splits · one-line corrections ·
  how to resource an already-authorised outcome · commit and push" is the closest thing in
  the file to a continuation duty — and it is about **authority**, not about **not
  stopping**. A worker returning, a read-back arriving, a ticket closing, a suite going
  green, a push landing: none of these is a decision, so §9a never engages, and §9b's "if
  in doubt, notify" is the only rule in scope.
- The one boot routine that does exist — §"Session boot — task-walk first" (26-36) —
  orients to `Team Knowledge/tasks/INDEX.md` (the folder exists: `INDEX.md`,
  `in-progress/`, `done/`, `cancelled/`). That is a *task-folder* recovery, not a *build*
  recovery. It would surface open `tsk-*` files and say nothing about BUILD-018.

**So today the doctrine actively biases toward the failure Warwick is trying to stop.**
Adding a continuation duty is not filling a blank; it is installing the missing half of a
rule that currently only points one way, and §9b will need an explicit cross-reference or
the two will be read as contradictory.

### `Team/agent-index.md` — **yes, a fresh Larry could re-establish the team from it unaided**

46 lines, 15 specialist rows, each with a substantive "Routes to them when" column
(Keel's row alone specifies the Work Order read-back gate, `file_surface`,
`credential_scope: none`, and the boundaries against Felix/Mack/Silas/Vex/Vera/Pax). §"The
Work Order gate" (34-46) states the `DRAFT → READ-BACK → ACCEPT/AMEND → ISSUED → RUNNING`
lifecycle and that work without an accepted read-back is `REFUSED` on process grounds.
That is enough to reconstitute routing from cold.

Two weaknesses, both small: the header still says *"Twelve specialists ship…"* above a
table of fifteen; and — the one that matters for clause 2 — **nothing in the file says
Larry may not simply do the work himself.** The index answers "who owns what"; it never
says "you must use them". The prohibition on Larry silently replacing the team has no home
in any file today.

### `tools/governor/reorient.mjs` — yes, it duplicates operating-model prose

The brief is mostly a legitimate build-state pointer (banked head, branch, ticket, next
action, artefact paths, frontier, blockers). But `reorient.mjs:450-456` embeds durable
policy that belongs in the authoritative files:

```
'ARTEFACT RANK (AD-17): goal contract > map > implementation plan > generated',
'projections (programme-state.json, session-handoff.md). A projection that',
'disagrees with its source is a defect in the projection.',
'',
'GIT LIFECYCLE IS LARRY\'S (AD-20): Warwick never manages branches, worktrees,',
'commits, pushes or PR creation. Do not ask him to run git. Do not ask him to',
'choose the route. Ask him only for decisions that are genuinely his.',
```

The second block is squarely constitution clause 5, hard-coded into a hook payload. The
same rule is restated a third time inside `worktree-guard.mjs`'s refusal text ("RECOVERY —
Larry performs this, Warwick does not… must NOT ask Warwick to run git commands. Larry owns
the git lifecycle."). Three copies, no single home — and the two copies that a session
actually sees are the two that have never executed.

Per Warwick's placement rule, both blocks should become a one-line pointer, e.g.
`Constitution: root CLAUDE.md §<n>. Artefact rank: 02-MAP.md AD-17.`

The banked `resumption.read_first` list does already name
`Team/Larry - Orchestrator/AGENTS.md` and `Team/agent-index.md` — so the *content* of the
reorientation is better than its reputation. It has simply never been delivered.

---

## 5. Adversarial review of the proposed `Stop`-hook continuation gate

Larry asked for this specifically, and he is right that it is the weakest point.

**The asymmetry is the whole argument.** A governor that misses a rotation costs Warwick a
re-brief. A governor that will not let go costs Warwick his session, and he cannot fix it
from the web or Android client — the settings file, the terminal and the process are all on
a machine he is not sitting at. INV-2 exists for exactly this, and the estate has already
proven (twice, in this very audit) that a control's *stated* behaviour and its *actual*
behaviour diverge silently. A `Stop` gate is the first BUILD-018 control whose failure mode
is not "a check didn't run" but "the user is trapped".

**What "fails open" has to mean here, concretely.** Every one of these must end with
Warwick getting his turn back, and each must be proven by a made-to-fail test (INV-5), not
asserted in a comment:

1. `stop_hook_active: true` in the payload → **allow, unconditionally, checked first,
   before any state is read.** This is the host telling you it already blocked once. Miss
   it and you have an infinite loop, not a bug.
2. Any throw, any unparseable stdin, any missing/corrupt programme state, any unreadable
   health sample, `node` missing, timeout → exit 0, empty stdout, allow. Same discipline as
   `statusline-live.mjs:100-108`, which already does this correctly.
3. A hard consecutive-block ceiling per session (2 is plenty), persisted, so a logic bug
   costs minutes and not the session.
4. An escape hatch Warwick can reach **from the chat surface he is actually on** — a
   phrase in his own message, not a file edit and not a terminal action. It must be checked
   before the block condition. If the only way out is on the machine he is away from, the
   gate is a trap by construction.
5. Blocking must be a **narrow allowlist** of situations ("a build is in flight, a
   frontier ticket is takable, and the last assistant message contains no
   legitimate-interruption marker"), never a denylist of reasons to stop. Under-blocking is
   a nuisance; over-blocking is the trap. Notably, the moment Warwick asks a direct
   question and Larry answers it, blocking means Warwick cannot receive the answer — the
   governor would be talking to itself.
6. The injected `reason` is model-visible text assembled from disk. It must be built from
   fixed strings plus whitelisted fields, never by interpolating free prose out of
   `programme-state.json`.

**One structural warning.** `background_tasks` (Larry's F3) makes "a worker is running, so
do not hand back" mechanically decidable — that is the *good* use. But note the tempting
inverse: a hook that blocks *because* a worker is running will block indefinitely if the
worker hangs. Bound it by wall-clock, not by worker state alone.

**And the precondition nobody can skip.** A `Stop` hook installed today would not run, for
exactly the reason `reorient.mjs` does not run (§2.4). Any plan that ends with "installed"
rather than "observed firing in a `stop_hook_summary` record" is not finished.

---

## 6. The five defects that must be fixed for the visible journey to work

Ranked by how much of the journey each unblocks per unit of change.

**D-N1 — Hook installation does not take effect, and nothing says so.**
The loaded hook table is the pre-17:05Z one; `reorient.mjs` and `worktree-guard.mjs` have
never fired; a hook deleted 4.5 hours earlier still fires and still errors.
*Smallest sufficient fix:* have `install-hooks.mjs` print, on any run that changed the
file, `RESTART CLAUDE CODE — hook changes do not take effect in a running process`, and add
a `--verify-live` mode that reads the newest transcript under
`~/.claude/projects/<slug>/` and reports which governor hooks have actually fired this
session. Then restart Claude Code once and re-check. Until that restart happens, **no other
hook fix in this build can be observed to work.**

**D-N2 — The only visible output is invisible where Warwick is, and is not reinstallable.**
statusLine is terminal-only; the `⟦GOV⟧` footer rule lives solely in a machine-local memory
file; the statusLine config lives solely in two gitignored/user files that no committed
code writes.
*Smallest sufficient fix:* put the footer requirement in root `CLAUDE.md` (proven
auto-loaded, §4) as one clause — *every response ends with a `⟦GOV⟧` footer read from the
current health sample* — and teach `install-hooks.mjs` to write `statusLine` alongside the
hooks so it is reproducible. Two edits, and the web/Android surface exists.

**D-N3 — `next: <model>` is a banked literal presented as live advice.**
Byte-identical at GREEN, AMBER, RED and BLIND; the bank's own rationale disclaims it; it
says Sonnet to an Opus session; and it picks the first `Deliverables/*` state file rather
than the active build's.
*Smallest sufficient fix:* in `recommendedModel()`, return the value only when the banked
state is fresh against live HEAD **and** names the current build, and render `next: UNSET`
otherwise. Roughly ten lines in `statusline-live.mjs`.

**D-N4 — A genuinely fresh session reorients to nothing.**
`install-hooks.mjs:184` writes `matcher: 'clear'` and nothing else; `startup` is the most
common entry path and the one with guaranteed-empty context.
*Smallest sufficient fix:* the `managed[]` SessionStart spec becomes `matcher:
'startup|clear|resume'` (or two entries if the host does not accept alternation — confirm
against F1's observed payload before writing). One line, plus a re-run and a restart.
**Belt-and-braces, and independent of any hook:** the startup invariant also goes in root
`CLAUDE.md`, which is loaded whether or not a hook fires. That is the durable half; the
hook is the convenience half.

**D-N5 — No continuation duty exists anywhere, and the doctrine currently biases the
other way.**
§9b says "if in doubt, notify" and has no counterpart; §9a covers decisions only; the
"Larry must not silently replace the team" rule has no home in any file.
*Smallest sufficient fix:* one new subsection in
`Team/Larry - Orchestrator/AGENTS.md` — §9e "Continuing — the non-boundaries" — listing
what is **not** a handback point (worker returned, read-back arrived, ticket closed, tests
green, commit pushed, review returned), cross-referenced from §9b so the pair reads as one
rule, with the seven legitimate interruptions living once in `CLAUDE.md`. No mechanical
enforcement in this fix; see §5 before adding any.

---

## 7. Asked but not settled

| Item | Status | What would settle it |
|---|---|---|
| Does project-scope `statusLine` override user-scope? | **UNKNOWN** | Both hold the identical command. Set them to different commands and observe which renders. |
| Do user-scope and project-scope `hooks` merge or override? | **UNKNOWN** | User scope has no `hooks`. Add one distinct no-op `Stop` hook to `~/.claude/settings.json`, restart, and check whether it appears alongside `bridge-ingest` in one `stop_hook_summary.hookInfos` array. |
| Is "hooks are snapshotted at process launch" the true mechanism? | **INFERENCE** (observations are fact) | Quit Claude Code fully, relaunch, `/clear`, look for a `SessionStart` `hook_success` whose command is `node …/tools/governor/reorient.mjs`. |
| Would a `PreToolUse` hook that ALLOWs leave a transcript record? | **UNKNOWN** | Not needed for the verdict — the loaded table has no `PreToolUse` key at all — but it would strengthen §2.6. Settled by the same restart test. |
| Does the Remote Control web/Android client render `statusLine` in any form? | **NOT INDEPENDENTLY VERIFIED** | I rely on the estate's own recorded finding (`larry-governor-footer-every-response.md`). Settled by Warwick looking at the Android client during an active session and saying whether he can see the `⟦GOV⟧` line. **This is worth 30 seconds of Warwick's time before anything is built on the assumption.** |

---

## 8. Criteria I will judge the written constitution by

Five, no more. Larry should draft against these rather than guess.

1. **Reachable at the moment it must bind.** Every clause sits on a surface the host loads
   with no hook firing. Root `CLAUDE.md` is proven auto-injected (§4); a hook is proven
   not to be (§2.4). Any clause whose only carrier is a hook, a memory file, programme-state
   prose, or this branch continuing to exist, **fails**.
2. **Written as a decidable test, not an aspiration.** Each clause must be answerable
   yes/no by a reader or a script at a named moment. *"Larry must not silently replace the
   team"* is not auditable. *"Before the second tool call of any implementation stretch,
   name the specialist and the Work Order, or state why the work is retained"* is.
3. **Every mechanical control has a proven release.** For each enforcement path: error,
   timeout, malformed payload, re-entrant fire, and an explicit human override must all end
   with Warwick in control — demonstrated by a made-to-fail test (INV-5), never by a comment
   claiming it fails open. **A control that can trap Warwick fails this criterion outright,
   whatever else it achieves.**
4. **One home per fact.** No clause restated in two files; cross-reference instead. Test:
   could I delete one copy without losing a fact? Today `AD-20` exists in three places
   (`reorient.mjs:454`, `worktree-guard.mjs`'s refusal text, and implicitly in the banked
   `do_not`) and in no authoritative file. That is the shape to eliminate, not replicate.
5. **Costs nothing new to run.** No new document type, no new ticket series, no new
   registry, no new folder. Reuses `CLAUDE.md`, `Team/Larry - Orchestrator/AGENTS.md`,
   `Team/agent-index.md` and the existing installer. Any new artefact must retire an
   existing one. I will flag accidental complexity aggressively — that is the job Warwick
   named me for.

---

*Nolan — independent audit, 2026-08-01. Read-only: no repository file was modified except
this one. `private_surface: none` — no access to `C:\.fusion247\**` was required or taken.
Probes wrote only to the session scratchpad via `MYPKA_GOVERNOR_HEALTH_DIR`; the real
health store was not touched.*
