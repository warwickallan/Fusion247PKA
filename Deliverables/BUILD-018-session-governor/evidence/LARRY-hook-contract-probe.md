---
name: larry-hook-contract-probe
type: evidence
build: BUILD-018
author: Larry
created: 2026-08-01
status: executed
---

# EVIDENCE — live probe of the SessionStart and Stop hook contracts

**This was executed, not inferred.** Claude Code `2.1.220`, Windows 11, 2026-08-01.
Probe estate: an isolated scratch project with its own `.claude/settings.json`, a marker hook,
and a fresh headless `claude -p` process. Nothing in the myPKA estate was touched.

Larry's failure signature is asserting facts he has not executed. Every line below is a
recorded payload from a real run.

## 1. `SessionStart` fires `source: "startup"` on a genuinely fresh process

```json
{"session_id":"bf77138a-…","transcript_path":"…","cwd":"…","hook_event_name":"SessionStart","source":"startup"}
```

Payload keys: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `source`.

**Consequence.** The Governor's `reorient.mjs` is installed with matcher `clear`. A genuinely
fresh session emits `startup`, **not** `clear`. As installed, reorientation does **not** run on a
new session. This is a real defect against the durable-recovery outcome, and it is the reason the
"new session" half of BUILD-018 was never true.

## 2. The `Stop` hook CAN force continuation — proven by making it happen

Contract: write `{"decision":"block","reason":"<text>"}` to **stdout** and exit `0`.
The `reason` is delivered to the model, which then continues the turn.

Recorded run — the hook blocked twice, then allowed the third stop:

| # | `stop_hook_active` | `last_assistant_message` | hook action |
|---|---|---|---|
| 1 | `false` | `PROBE-OK` | block |
| 2 | `true`  | `CONTINUED-1` | block |
| 3 | `true`  | `CONTINUED-2` | allow |

The model obeyed the injected `reason` verbatim both times. **The execution controller is a real
mechanism on this host, not a hope.**

## 3. Full `Stop` payload keys

```
session_id, transcript_path, cwd, prompt_id, permission_mode,
hook_event_name, stop_hook_active, last_assistant_message,
background_tasks, session_crons
```

Three of these decide the whole design:

- **`stop_hook_active`** — `false` on the first stop of a turn, `true` on every stop that follows a
  block. It is the host's re-entrancy signal. It does **not** reset within a continued turn, so a
  controller wanting more than one block must carry its own counter *and* must still honour this
  flag as the anti-loop backstop. INV-2 (never trap Warwick) is enforceable here.
- **`last_assistant_message`** — the text Larry just emitted. A footer requirement can therefore be
  **mechanically verified** rather than merely instructed: the controller can see whether the reply
  actually ended with the Governor footer.
- **`background_tasks`** — an array; `[]` when nothing is running. A live worker is visible to the
  controller, so "a worker is still running" can be distinguished from "the work is finished"
  without guessing.

`permission_mode` is also present, which lets the controller behave differently under a restricted
mode instead of blocking blindly.

## 4. Multiple `Stop` hooks compose — the pre-existing Tower hook is not a blocker

The estate already carries a non-Governor `Stop` hook (Tower's `bridge-ingest.mjs`). Whether a
*blocking* Governor hook could coexist with it was the design's largest open question, so it was
executed rather than assumed.

Probe: two separate `Stop` matcher groups — a **sibling** that only writes a side-effect file and
prints stray non-JSON text to stdout (deliberately imitating a real ingest script), and the
**Governor** hook returning `{"decision":"block",…}`. One turn produced:

| hook | invocations |
|---|---|
| SessionStart marker | 1 |
| sibling `Stop` | **3** |
| Governor `Stop` | **3** |

Governor blocked twice, allowed the third; final assistant message `CONTINUED-2`.

Established:

1. Multiple `Stop` matcher groups are **additive** — all fire on every stop; none overrides another.
2. A sibling hook writing **stray non-JSON to stdout does not corrupt or suppress** another hook's
   `{"decision":"block"}`.
3. The block counter is the hook's own on-disk state; the host does not deduplicate or serialise
   decisions.

**Consequence:** the Governor `Stop` entry may simply be ADDED. The Tower hook does not need to be
removed, reordered, or repaired — which matters, because Tower is PARKED and out of scope.

## 5. `SessionStart` sources observed on this version

| source | how it was produced | observed |
|---|---|---|
| `startup` | fresh `claude -p` process | yes |
| `resume` | `claude -c -p` | yes |
| `clear` | `/clear` (documented; the currently-installed matcher) | not probed here |
| `compact` | post-compaction | not probed |

A matcher of `clear` alone therefore misses **at least** `startup` and `resume` — two of the three
ways Warwick actually re-enters a build.

## 6. What this evidence does NOT establish

- Whether `Stop` fires identically in the interactive TUI and in Remote Control web/Android. Every
  probe here ran headless (`claude -p`). **UNKNOWN** — settled only by a live interactive run.
  Design consequence: a `Stop` hook that never fires must degrade to *instruction-only
  continuation*, never to a broken session.
- Whether `SessionStart` emits `compact`, and whether reorientation is wanted on that source at all.

Absence of a probe is not evidence of a behaviour. These stay UNKNOWN until executed.
