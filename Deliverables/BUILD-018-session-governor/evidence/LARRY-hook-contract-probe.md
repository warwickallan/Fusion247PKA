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

## 4. What this evidence does NOT establish

- Whether `Stop` fires identically in the interactive TUI and in Remote Control web/Android. The
  probe ran headless (`claude -p`). **UNKNOWN** — settled only by a live interactive run.
- Whether a second, pre-existing `Stop` hook (the Tower `bridge-ingest.mjs` entry) composes safely
  with a blocking Governor `Stop` hook. **UNKNOWN** — Silas rules on composition; it needs its own
  live test before it is trusted.
- Whether `SessionStart` `source` takes values beyond `startup` and `clear` on this version
  (`resume`, `compact`). Not probed.

Absence of a probe is not evidence of a behaviour. These three stay UNKNOWN until executed.
