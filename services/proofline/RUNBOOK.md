# Proofline — runbook

**Who this is for:** Warwick, as the operator of his own local service. Mack is not engaged; Proofline is a personal, single-user, loopback-only app. You should be able to start it, stop it, check it and recover it **without reading any source code**. If something here forces you into the source, that is a defect in this file — say so.

---

## What it is, in one line

A local service on your own machine that takes text you paste under a key you choose, records it durably before telling you it accepted it, analyses it on a background worker, and then **stops and waits for your approval**.

Nothing leaves the machine. There are no credentials, no accounts, no external services, and no npm packages.

---

## Starting it

**Paste this one line.** That is the whole command:

```
C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd
```

Then open **http://127.0.0.1:7317/**.

You do not need to `cd` anywhere first, and it does not matter which terminal you are in — **Command Prompt and PowerShell both run this exact same line**, unchanged. No `.\`, no `&`, no quotes, no execution policy, no administrator.

The terminal you paste it into then belongs to the service: it prints its log there, and `Ctrl+C` stops it. If you want your terminal back, use `--detached` below.

| What you want | Paste this |
|---|---|
| Normal start | `C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd` |
| A different port | `C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd --port 7400` |
| Run in the background | `C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd --detached` |
| A different journal folder | `C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd --data-dir D:\proofline-data` |
| The options, listed | `C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd --help` |

If you ever move the Proofline folder, the command is still just the full path to `start-proofline.cmd` in its new home — the launcher finds everything else relative to itself.

**It will refuse to start, loudly and in plain English, if:** Node is missing · Node is older than 22 · the program file is missing · the port is not a usable number · the port is already in use (it tells you which process has it, and how to stop that one) · the journal is corrupt mid-file (see *Recovery*). It always tells you what to do next, and it will not close the window on you before you have read it.

### Why there is a `.cmd`, and why you should not use the `.ps1`

This is worth reading once, because it cost a failed walkthrough.

**`scripts\start-proofline.ps1` cannot be started from a Command Prompt at all.** `.PS1` is not in `PATHEXT`, so `cmd.exe` does not treat it as something to run — it hands the file to Windows' file-association handler, which on this machine has no handler registered for `.ps1`. You get the **"Select an app to open this .ps1 file"** dialog, and no server.

**And a `.ps1` carries an encoding trap.** Windows PowerShell 5.1 reads a `.ps1` that has no byte-order mark as ANSI, not UTF-8. One em-dash in an earlier version of that script decoded into a curly quote, PowerShell read that as the end of a string, and the script failed to parse outright with *"The string is missing the terminator"* — on a line that looks perfectly normal in any editor.

`start-proofline.cmd` avoids both. It runs `node` directly, so PowerShell is never involved, and it is written in **plain ASCII** so no codepage can change what it means.

### The PowerShell script, if you specifically want it

`scripts\start-proofline.ps1` still works **from PowerShell only**, and has been repaired (ASCII plus a byte-order mark). It takes `-Port`, `-Detached`, `-DataDir` and `-OpenBrowser`:

```
cd C:\Fusion247PKA-build-020-trial\services\proofline
.\scripts\start-proofline.ps1
```

Both launchers and `node bin\proofline.mjs` are the same startup path; the launchers only check Node and the entrypoint first, then run that one entrypoint.

---

## Stopping it

**In the terminal you started it in:** `Ctrl+C`.

**Started with `--detached`:** the launcher prints the PID when it starts. Paste this, with that number:

```
taskkill /PID 12345 /F
```

That works from Command Prompt and PowerShell alike. It stops the service **and** closes the "Proofline" window that was holding it — you do not have to tidy up twice.

`--detached` runs the service in a **separate minimised window titled "Proofline"**. You can close the terminal you launched from and the service keeps running. Closing the "Proofline" window itself stops it, exactly like `Ctrl+C` would.

**If you have lost the PID**, ask Windows which process holds the port:

```
netstat -ano -p TCP | findstr 7317
```

The number at the end of the `LISTENING` line is the PID.

### Stop is ABRUPT on Windows, and that is safe by design

This is the one thing worth reading twice.

On Windows there is **no signal-delivered graceful shutdown path at all**. `SIGTERM`, `SIGINT` and `SIGKILL` sent to another process all become `TerminateProcess`; `process.on('SIGKILL')` registers without error and never fires. This was verified by execution during the build: an exit handler that demonstrably runs on a clean exit does **not** run when the process is killed.

So Proofline does not pretend to shut down gracefully. It doesn't need to:

- every record is written and **fsynced before you are told anything was accepted**, so an abrupt stop cannot lose something you were told was saved;
- a job that was mid-analysis when the process died is **re-queued on the next start** and finishes exactly once;
- an approval or rejection is a durable record, not an in-memory flag.

**You do not need to shut it down cleanly. Killing it is a supported way to stop it.**

What an abrupt stop *can* leave is a half-written final line in the journal. That is expected and handled: the next start discards the incomplete trailing line, says so in the log, and carries on.

**What is NOT claimed:** survival of a power cut or a hard reset. `fsync` returning is not a promise about the disk platter. If the machine loses power mid-write, the last record may not be there. This limit is deliberate and permanent.

---

## Checking it is healthy

Paste this in any terminal — Command Prompt or PowerShell, from any folder:

```
curl.exe http://127.0.0.1:7317/api/health
```

(The `.exe` matters in PowerShell, where plain `curl` means something else.)

```json
{"ok":true,"epoch":7,"uptimeMs":41233,
 "counts":{"queued":0,"processing":0,"awaiting_approval":2,
           "approved":5,"rejected":1,"failed":0,"total":8}}
```

| Field | What it tells you |
|---|---|
| `ok` | The service is up and its journal replayed cleanly. |
| `epoch` | How many times it has ever started. It increments on every start — that is normal, not a warning. |
| `uptimeMs` | Time since this start. |
| `counts.awaiting_approval` | **Jobs waiting on you.** These will never move on their own. |
| `counts.processing` | Jobs being analysed right now. Normally 0 — analysis takes about 2.5 ms for a typical paste. |
| `counts.failed` | Jobs abandoned after 3 attempts. Investigate; see *Recovery*. |

If `curl` returns nothing, the service is not running. If it returns something that is not JSON, something else is on that port.

---

## Reading the logs

Proofline logs one JSON object per line to standard output.

- **Started normally:** they appear in the terminal you started it in.
- **Started with `--detached`:** they go to a file instead.

Paste this in any terminal, from any folder:

```
type C:\Fusion247PKA-build-020-trial\services\proofline\.data\proofline.log
```

Errors also land in `proofline.log.err` beside it. To see only the end of a long log, PowerShell has `Get-Content <path> -Tail 40`; Command Prompt has no equivalent, so open the file in Notepad instead:

```
notepad C:\Fusion247PKA-build-020-trial\services\proofline\.data\proofline.log
```

Lines you might see, and what to do:

| `event` | Meaning | Action |
|---|---|---|
| `starting` / `listening` | Normal start. `listening` carries the URL and the epoch. | None. |
| `journal.torn_tail_discarded` | The previous stop was abrupt and left a partial line. Discarded. | **None — this is the designed behaviour**, not damage. |
| `recovery.scan` | Jobs stranded by a previous crash were re-queued (`requeued`) or abandoned (`failed`). | None if `failed` is 0. |
| `job.processing_error` | The analysis threw. The job is marked `failed` with the reason. | Look at the job in the UI; the reason is on the record. |
| `config.invalid` | A bad `PROOFLINE_PORT` or similar. The service refuses to start. | Fix the value and start again. |
| `startup_failed` | Usually the port is in use, or the journal is corrupt mid-file. | See *Recovery*. |

---

## Where the data lives

```
services\proofline\.data\journal.jsonl
```

One append-only JSONL file. Every submission, lease, result and decision is a line in it, in order. Nothing is ever rewritten or deleted, so the file only grows.

**It contains the full text of everything you paste.** It is covered by `services\proofline\.gitignore` and is never committed to this public repository. If you ever move or copy it, that rule moves with the file, not with you — treat it as personal data.

**To read it:** open it in any text editor —

```
notepad C:\Fusion247PKA-build-020-trial\services\proofline\.data\journal.jsonl
```

**To back it up:** copy the file. That is the whole backup.

```
copy C:\Fusion247PKA-build-020-trial\services\proofline\.data\journal.jsonl C:\Fusion247PKA-build-020-trial\services\proofline\.data\journal.backup.jsonl
```

**To start completely fresh:** stop the service, delete (or rename) `.data\journal.jsonl`, start again. Everything is lost; nothing else is affected.

---

## Recovery

### A job is stuck in `processing`

It cannot be, across a restart: on every start, and every second while running, any job left `processing` by a previous run is re-queued automatically. **Stop and start the service** and it will finish.

### A job went to `failed`

A job is re-tried up to **3 leases**. If it is killed mid-analysis a third time, or the analysis throws, it becomes `failed` with the reason recorded on the job. It will not be retried again, deliberately — an unbounded retry of something that keeps dying is a worse failure than stopping.

There is no "retry" button. If you want it processed, submit the same text under a **new key**.

### It will not start: `EADDRINUSE`

Something is already on port 7317 — most likely a Proofline you forgot to stop.

**The launcher already tells you which process it is and how to stop it**, so you normally do not have to look anything up. It prints a `taskkill /PID <number> /F` line ready to paste.

Before you kill anything, try the page — it may already be running and waiting for you: **http://127.0.0.1:7317/**.

To find it yourself:

```
netstat -ano -p TCP | findstr 7317
```

The number at the end of the `LISTENING` line is the PID. Stop it with `taskkill /PID <number> /F`, or leave it alone and start this one elsewhere with `--port 7400`.

### It will not start: `JournalCorruptError`

The journal has a damaged line **in the middle** of the file. Proofline refuses to start rather than silently skipping it, because skipping it would turn data loss into a journal that merely looks fine.

This is not the same as a torn last line, which is handled automatically and never blocks a start.

The message names the exact line number. Options, in order of preference:

1. **Copy the file first.** Do this before anything else:

   ```
   copy C:\Fusion247PKA-build-020-trial\services\proofline\.data\journal.jsonl C:\Fusion247PKA-build-020-trial\services\proofline\.data\journal.broken.jsonl
   ```

2. Open the journal, look at the named line, and repair it if the damage is obvious (a truncated line, a stray character).
3. If it cannot be repaired, cut the file at the last good line into a new `journal.jsonl` and keep the broken copy. Everything after the cut is lost.

### The page loads but nothing appears

The UI polls once a second. If jobs never appear, check `/api/health` first — if that fails, the service is down and the browser is showing a cached page.

---

## What this service will never do

- Listen on anything but `127.0.0.1`. The bind address is a constant; no environment variable can widen it, and the running socket's address is checked at runtime (T-9).
- Advance a job past `awaiting_approval` on its own. That is the whole point of it.
- Ask you for a credential. It has none and never will.

---

## Limits, stated plainly

| Limit | Detail |
|---|---|
| Network egress | **Zero egress is NOT claimed** — it is a negative, and proving it needs a packet capture nobody ran. What *is* proven (T-9) is a source-level assertion — no HTTP client, no `fetch`, no DNS lookup, no outbound socket anywhere in the source, and no npm packages installed — plus the runtime bind check above. Treat it as a strong source assertion, not a measured absence. The README's *"What is deliberately NOT claimed"* table says the same thing. |
| Power loss | Not survivable, not claimed. `fsync` returned ≠ on the platter. |
| One process | Running two Prooflines against the same journal is not supported and was never tested. |
| No authentication | Loopback only, single user. Anyone with an account on this machine can reach it. |
| Text size | 1 MiB per submission; 2 MiB per request body. |
| Retries | 3 leases per job, then `failed`. |
| First live start | **Yours.** The launch itself has now been run on this machine from a real Command Prompt, and the submit/process/approve journey completed over HTTP. What has *not* happened is anyone using it **in your browser** — that page load is still your first. |
| Surviving a reboot | Not claimed. `--detached` survives the terminal that launched it; it does not survive a restart or a logout, and Proofline is not registered as a Windows service. |
