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

## A1 — health visible where Warwick works (web / Android) — **PENDING**

The terminal status line is confirmed live and sampling correctly, but Warwick has stated plainly
that it does not satisfy acceptance — he works on claude.ai web and Android, where it is invisible.
The in-message footer is the surface that counts, and it is being built.

## A4 — `/clear` reorients — **PENDING (blocked on a restart, not on code)**
## A5 — a genuinely fresh session recovers — **PENDING**

Both are blocked by the same fact, and it is worth stating once: **hooks bind at Claude Code process
launch.** Nolan proved it — a hook deleted from settings at 17:05:08Z still fired at 21:39Z, and one
`claude.exe` started before the install has served every session since. So the reorientation hook has
fired **zero times, ever**, and no hook change can be *observed* in the running session without a
full restart.

Fresh **processes** do read current settings — Larry's probe confirmed that — so the fresh-session
half is provable without Warwick. Only his own running session needs the restart.

## A7 — Larry continues rather than stopping at an internal boundary — **PENDING**

The mechanism is proven to exist (see `LARRY-hook-contract-probe.md` §2: a `Stop` hook returning
`{"decision":"block"}` genuinely forces continuation, and `background_tasks` makes a running worker
visible so it need never cause a handback). The controller implementing it is in build.

---

## Standing caveat on everything above

The whole probe estate ran headless (`claude -p`). Whether `Stop` and `SessionStart` behave
identically in the interactive TUI and in Remote Control is **UNKNOWN** and is the residual risk of
this design. It is designed for either outcome: if `Stop` never fires, the controller degrades to
instruction-only continuation — the constitution still binds, the footer still renders, and no
session is trapped. That asymmetry is deliberate, not a gap.
