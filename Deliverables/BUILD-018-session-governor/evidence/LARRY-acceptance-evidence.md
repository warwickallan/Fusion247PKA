---
name: larry-acceptance-evidence
type: evidence
build: BUILD-018
author: Larry
created: 2026-08-01
status: in-progress
---

# ACCEPTANCE EVIDENCE — the visible journey

Warwick's acceptance list for Outcome A, with the executed evidence beside each item and an honest
verdict. **This file is what Nolan inspects before Outcome A is called complete.** Items still
PENDING are named as such; an item with no evidence is never recorded as passing.

Every entry below was executed. Where something was *not* executed, it says so.

---

## A6 — wrong-worktree protection still operates — **SCRIPT PROVEN / WIRING PENDING**

Three payloads, three behaviours, one of them a deliberate break (INV-5):

| Input | Expected | Observed |
|---|---|---|
| `cwd: C:\Users\Buggly` (wrong worktree), `tool_name: Write` | deny | **deny**, exit 0, with an actionable reason naming the canonical worktree, the branch, the mismatch set (`cwd, repository root, branch`) and the recovery Larry performs |
| `cwd: C:\Fusion247PKA-governor` (canonical) | allow, silently | **no output**, exit 0 |
| `not json at all` (malformed) | **fail OPEN** | **no output**, exit 0 — the prompt is let through |

The third row is the one that matters. GOAL-CONTRACT **INV-2** says every blocking path fails open;
a guard that errors on a malformed payload and denies would trap Warwick in his own session. It does
not.

The deny message also correctly picked up the ticket banked minutes earlier (`next ticket T-22`),
so it is reading live programme state rather than a compiled-in constant.

**Why this is not yet a full pass.** Nolan's audit established that `PreToolUse` has fired **zero
times** across every governor transcript — the script is correct and its wiring is dead, because
hooks bind at Claude Code process launch. The script half is proven here; the wiring half cannot be
proven without a restart.

**Also confirmed in passing:** `worktree-guard.mjs:392` hard-codes *"Larry owns the git lifecycle"* —
one of the two live duplicates of constitution clause 5 that Nolan found. Visible in the deny output
above. Recorded, not fixed here: the file is being sequenced with the parallel work.

---

## A2 — GREEN / AMBER / RED / BLIND derived from live telemetry — **PROVEN** (Nolan, executed)

Nolan executed the evaluator across the state space: 13% → GREEN, 60/70% → AMBER, 75/92% → RED,
empty stdin → BLIND. **BLIND never renders as GREEN** (INV-1).

Recorded limitation, not smoothed over: `compactions` and `bankedStateStale` are always absent from
the status-line payload, so the `RECOVERY` state is unreachable from that surface.

---

## A3 — the next-model recommendation is grounded, or honestly UNSET — **PARTIAL**

Before: `next: Sonnet` rendered **byte-identically at GREEN, AMBER, RED and BLIND**, to an Opus
session, from a banked literal whose own rationale disclaimed it.

After grounding the banked state (`for_ticket` = the frontier ticket, `computed_at_head` =
`banked.head_sha`):

```
⟦GOV⟧ ctx 31% · GREEN · KEEP GOING · next: Opus
```

**State precisely what this proves and what it does not.** It proves the *value* changed because the
banked recommendation changed. It does **not** prove the `UNSET` predicate: `statusline-live.mjs`
still reads `model_recommendation.model` directly and applies no predicate. The predicate — six
conditions, driven by absence rather than text — lands with `footer.mjs`. Until then this field is
grounded by construction, not by check. The `CONTINUE` control token is likewise absent; it arrives
with the new grammar.

---

## Pre-integration check — what running the installer will switch ON — **VERIFIED SAFE**

Nolan's audit found that `install-hooks.mjs --check` reproduces a **superset** of the live state: it
silently activates T-16's delegation observer and gate, which have never fired. Silas ruled the
superset a *reporting* fix only — the managed set is not to be altered — so **wiring the hooks will
switch that gate on.** That had to be understood before integration rather than discovered during it.

Executed:

- A single `Write` with no delegation recorded → **allow** (no output, exit 0). It does not block on
  first contact.
- `DENY_THRESHOLD = 3` over `Write | Edit | MultiEdit | Bash`, counted per ticket since the last
  checkpoint.

**So integration work would have been blocked at the fourth write** — on T-23, which is
Larry-retained integration by design. That is the trap class this build exists to avoid, so the
escape matters more than the threshold.

The escape is reachable by Larry alone, needs nothing from Warwick, and is exactly right:
1. dispatching a subagent records a checkpoint and resets the count to zero; or
2. `delegation-gate.mjs justify --reason <architecture|integration|safety|judgement|git-lifecycle|emergency> --ticket <id> --note "…"`.

`integration` and `git-lifecycle` are precisely T-23's legitimate reasons under the iron rule's
stated exceptions. **The gate is therefore safe to wire and is behaving as designed** — it does not
forbid Larry working, it forbids Larry working *silently*, which is the actual rule.

Recorded here so integration does not rediscover it, and so a fresh Larry meeting a deny message
recognises it as the system working rather than a fault.

## A1 — health visible where Warwick works (web / Android) — **PENDING**

The terminal status line is confirmed live and sampling correctly, but Warwick has stated plainly
that it does not satisfy acceptance — he works on claude.ai web and Android, where it is invisible.
The in-message footer is the surface that counts, and it is being built.

## A4 — `/clear` reorients — **CODE DONE / LIVE PENDING (blocked on a restart, not on code)**
## A5 — a genuinely fresh session recovers — **CODE DONE, AND ONE LAYER PROVEN LIVE**

WP-1 landed at `c9ebef4` (645 tests, 645 pass; baseline 607). Both layers of the defect are closed:
the `SessionStart` entry now carries **no `matcher` key at all** (Silas's B-1, probe-proven), and
`reorient.mjs` branches internally on `source` instead of refusing everything but `clear`.

Larry then ran the **real hook**, not its tests:

```
{"hook_event_name":"SessionStart","source":"startup", …}  →  node tools/governor/reorient.mjs
```

**It fired.** For the first time in this build's history, a `startup` payload produced output rather
than `SKIPPED`. That is A5's mechanism proven at the script layer.

**And running it immediately exposed a defect its tests could not.** The output was a refusal:
*"MORE THAN ONE ACTIVE PROGRAMME"*, listing **BUILD-018 four times** — once per checkout
(`-governor`, `-wo-01`, `-wo-02`, `-wo-03`). Those are not four programmes; they are one programme
in four working trees. The refusal is correct and the grouping is wrong, so reorientation is unusable
in precisely the situation the Governor exists for. `build-registry.mjs:172` already solves this with
`collapseCopies`; `reorient.mjs` groups by state-file path. Registered as **T-24** and dispatched.

Two things worth keeping from that:
- **Running the thing is not the same as running its tests.** 645 green did not catch it; one real
  invocation did.
- **Deleting the worker worktrees would have hidden it, not fixed it.** The constitution's own
  startup step 3 names why: merging this build to main is itself what creates the second copy.

The remaining blocker for both A4 and A5 is unchanged and is not code: **hooks bind at Claude Code
process launch.** Fresh *processes* do read current settings, so the fresh-session half stays provable
here; only Warwick's running session needs the restart.

Both are blocked by the same fact, and it is worth stating once: **hooks bind at Claude Code process
launch.** Nolan proved it — a hook deleted from settings at 17:05:08Z still fired at 21:39Z, and one
`claude.exe` started before the install has served every session since. So the reorientation hook has
fired **zero times, ever**, and no hook change can be *observed* in the running session without a
full restart.

Fresh **processes** do read current settings — Larry's probe confirmed that — so the fresh-session
half is provable without Warwick. Only his own running session needs the restart.

## The constitution is REACHABLE at the moment it must bind — **PROVEN**

Nolan's criterion 1 was the hardest to satisfy and the easiest to assert falsely: *no clause may
depend on a hook, a memory file, programme-state prose, or this branch surviving.* Hooks are proven
**not** reliably loaded (they bind at process launch). `CLAUDE.md` is proven loaded — so the test is
whether a session with **no conversation history at all** can answer from the constitution alone.

Executed after merging WP-2: a fresh `claude -p` process in the governor worktree, told to use **no
tools** and answer from its instructions only.

| Asked | Answered |
|---|---|
| How many lines does the reorientation banner have? | **Four** — identity + build + model · branch/worktree verification · next action · named specialists |
| List the seven legitimate interruption code names | `product-decision`, `permission`, `spend`, `irreversible-live-action`, **`unsafe-repository-state`**, `rotation-required`, `merge-decision` |
| Who owns the git lifecycle? | **Larry** — branches, worktrees, commits, pushes, PR lifecycle, cleanup. Warwick never operates Git |

Three things this establishes beyond "the file exists":

1. **The constitution binds with zero conversation history and no hook installed** — which is the
   whole claim, and the one that survives `/clear`, a fresh session, and this branch being deleted.
2. **It answered *four* lines**, not five. That is the DT-2 fix — the audit's live three-way
   contradiction, which would have fired on the first reply of every fresh session — landing in a
   real session's behaviour rather than only in the diff.
3. **It answered `unsafe-repository-state`**, not `unsafe-state`. The token now matches the literal
   frozen in `escalation-gate.mjs`, so the constitution and the gate that reads Larry's own text
   agree. That correction travelled from an audit finding, through the author, through Silas's build
   spec, into a live session's answer.

## A5 follow-up — the LIVE estate now reorients instead of refusing — **PROVEN**

Same command that refused earlier, re-run on the **live** estate (six copies of BUILD-018's state
across `-governor` and `wo-01`…`wo-05`) after WP-4 merged:

```
REORIENTED — BUILD-018
Location: verified
Next ticket: T-23
Recommended model: Opus
```

1036 characters against the 10,000 cap. The refusal is gone, the correct copy won, and the ticket
named is the one actually banked. This is the live estate, not a fixture.

**And it confirmed T-25 on the real path.** The collapse *happened* — six copies resolved to one —
but the brief carries no `COLLAPSED` section, because `applyModelGate` substitutes a compact render
when a model switch is owed. Keel reported this out-of-surface from a fixture run; here it is on the
live path. **Correctness is unaffected; visibility is.** Registered as T-25, `planned`, not started.

**One thing to know before the restart test.** The brief reported `Current model: UNKNOWN — no
health sample has been recorded for this session yet`, and gated implementation behind a model
selection. That is an artefact of the probe using a synthetic session id: in a real session the
status line writes a sample on its first render, so the gate should see the model and release. It is
worth watching for at the live proof, because a gate that stays `UNKNOWN` would ask Warwick for
something the constitution's closed list does not include.

## A7 — Larry continues rather than stopping at an internal boundary — **PENDING**

The mechanism is proven to exist (see `LARRY-hook-contract-probe.md` §2: a `Stop` hook returning
`{"decision":"block"}` genuinely forces continuation, and `background_tasks` makes a running worker
visible so it need never cause a handback). The controller implementing it is in build.

---

---

# T-23 — the integration sequence, written down so it need not be re-derived

Larry-retained (integration, merges, git surgery). Order matters in two places and both are recorded
with the reason, not just the instruction.

1. **Merge WP-3 (`build-018/wp3-footer-and-controller`) first.** It creates `footer.mjs`.
2. **Then WP-1 (`build-018/wp1-recovery-and-installer`).** Disjoint from WP-3 by construction: WP-3
   creates new files, WP-1 modifies `reorient.mjs` / `install-hooks.mjs` / `statusline-live.mjs`.
3. **Then WP-2 (`build-018/wp2-constitution`) — never before step 1.** `CLAUDE.md` § "Governor
   advice" points at `tools/governor/footer.mjs`, and the constitution's own startup step 4 requires
   every named path to exist. Merging it first would make the constitution fail its own test on day
   one. Its surface (`CLAUDE.md`, Larry's `AGENTS.md`, `agent-index.md`) touches neither of the
   others, so the ordering is a correctness constraint, not a conflict one.
4. **Wire, which is Larry's and was deliberately kept out of every Work Order:** `install-hooks.mjs`
   gains the `Stop` controller entry and `statusline-live.mjs` imports `footer.mjs`. Both files are
   WP-1's surface, so this happens *after* WP-1 lands, never in parallel with it.
5. **Run the installer.** Expect it to switch the delegation gate on (verified safe above). If it
   denies during integration, that is the system working: `justify --reason integration` or
   `--reason git-lifecycle`, both of which are T-23's legitimate reasons under the iron rule.
6. **Prove what can be proven without Warwick:** a fresh `claude -p` process reads current settings,
   so `SessionStart source=startup` producing a real brief is provable here.
7. **Then, and only then, the single human action:** a full Claude Code quit and relaunch. Hooks bind
   at process launch, so nothing installed can be observed firing in a running session. Prepare
   everything first and ask once.
8. **Nolan inspects this file** before Outcome A is called complete.

**Merge-order verification already executed:** the three branches' file sets are disjoint
(`CLAUDE.md` + two `Team/` files vs `tools/governor/*` modified vs `tools/governor/*` new), so no
textual conflict is expected. That is a prediction, not a result — run the merges and check.

## Standing caveat on everything above

The whole probe estate ran headless (`claude -p`). Whether `Stop` and `SessionStart` behave
identically in the interactive TUI and in Remote Control is **UNKNOWN** and is the residual risk of
this design. It is designed for either outcome: if `Stop` never fires, the controller degrades to
instruction-only continuation — the constitution still binds, the footer still renders, and no
session is trapped. That asymmetry is deliberate, not a gap.
