---
agent_id: mack
session_id: wo-2026-08-06-tower-watcher-flashing-windows
timestamp: 2026-08-06T23:35:00Z
type: end-of-session
linked_sops: []
linked_workstreams: []
linked_guidelines: [GL-012-secrets-store-access-boundary]
---

# The flashing console windows on Yoga are NOT the Tower watcher

## What I was asked

Stop console windows flashing open every few minutes on Warwick's Yoga machine, attributed to
the Tower watcher, without breaking the watcher. Warwick's recollection was `show children = true`
"when they should be false", and that it had been fixed once before.

## What it actually is

**Any console program launched by a Windows Scheduled Task whose principal is `LogonType =
Interactive` allocates a console in the user's session, which materialises as a visible window and
closes when the program exits.** That is the flash. On this machine the default terminal
application is Windows Terminal, so the console materialises as a full `WindowsTerminal.exe`
window rather than a small `conhost` box, which is why it is so noticeable.

**Four repeating Interactive tasks do this. None of them is Tower.** Measured live, by sampling
visible top-level windows at ~3 Hz alongside process creation:

| Flash observed | Task that fired ~1s earlier | Interval |
|---|---|---|
| 23:19:03 | `\CareerAIR-Ops-Liveness` | PT30M |
| 23:20:03 | `\CareerAIR-Graph-Collect` | PT15M |
| 23:21:05, 23:26:04, 23:31:02 | `\CareerAIR-Email-Ensure` | **PT5M** |
| 23:32:03 | `\MyPKA-Local-Services-Live` | PT15M |

`CareerAIR-Email-Ensure` at **five minutes** is the one that matches "every few minutes".

The `.cmd` extension is not the cause — `MyPKA-Local-Services-Live` runs `node.exe` directly and
flashes identically. The cause is the interactive session, not the wrapper.

## What the Tower watcher actually does — measured, not assumed

Zero visible windows in ~12 minutes covering a cold start, a kill/revive, two detached watcher
spawns and **11 `gh.exe` child processes**. Every one of the 25 `child_process` call sites under
`tower-loop/` already carries `windowsHide: true`, and test `WH3` enumerates that with `WH4` as a
mutation control proving the scanner is not always-green.

**So Warwick's `show children` recollection does not map onto any flag currently wrong in that
tree.** The estate's windowless idiom — `~/.mypka/tower-runtime/start-tower-hidden.vbs`, launched
from `HKCU\...\Run` — is intact and demonstrably silent.

## The two things worth remembering

1. **A window flash is a session/principal property, not a code property.** I went looking for a
   missing `windowsHide` for the first twenty minutes because that is the estate's idiom and the
   Work Order pointed there. The code was already correct. The discriminator that settled it was
   sampling *visible windows* (EnumWindows + IsWindowVisible) rather than processes — `conhost.exe`
   is created for hidden consoles too, so counting `conhost` would have produced a confident wrong
   answer.
2. **The Task Scheduler Operational log is DISABLED on this machine**
   (`Get-WinEvent -ListLog ... IsEnabled: False`), so which task fired when cannot be reconstructed
   after the fact. Causation here has to be observed live. Worth knowing before the next person
   tries to diagnose a scheduled-task problem from history.

## Left undone, deliberately

The fix was withheld from execution by Larry: the flashing tasks are CareerAIR's, inside
`C:\.fusion247\private\careerair\**`, and my `private_surface` was `none`. I delivered the named
cause and the exact fix for Warwick to authorise. I changed no scheduled task and read nothing
under the private surface — the task *metadata* I read is machine configuration, not the surface.
