# RUNBOOK — the AsdAIr runtime

**For Mack.** Start it, stop it, check it, read it, recover it — without reading the source.

Written for `WO-2026-08-18-B15-RUNTIME`, which gave this runtime three new
responsibilities it did not have before: it now **acquires its own browser**,
**shops the trolley itself**, and **resumes a shop after a crash without anyone
noticing**. Those are the three things most likely to need an operator, so they
get their own sections below.

> **Scope note, stated plainly.** Everything here was proven against a
> disposable local target and fake stores. **The first live start on the real
> machine, with the real ASDA session, is not covered by this document and is
> not the implementer's to give.** It is a Warwick gate.

---

## What this process is

One supervised Node process. It owns:

- the **single** Telegram `getUpdates` consumer for ShopperBot;
- the deterministic command worker;
- pipeline resumption for incomplete shops;
- **(new)** claiming a queued `asdair.browser_build_request` and driving the
  real ASDA browser to build Mum's trolley;
- Windows logon/restart recovery.

**It never checks out, pays, books a delivery slot, enters a credential or
accepts a substitution.** Those are absent from the command surface, not
disabled — `services/asdair/browser-runner/forbidden.test.cjs` fails the build
if a path to any of them appears.

**Exactly one instance may run.** Telegram `getUpdates` is a single-consumer,
destructive-ack protocol: two pollers do not share the stream, they race it, and
the realistic loss is a week's shopping list consumed and gone with no error
anywhere. The launcher takes an exclusive lock and **refuses** to start a
second. If you think you need two, you do not — find and stop the first.

---

## Everyday commands

Run from the repository root. `<env>` is the credentials file pair Mack owns and
places; this runtime knows variable **names** only and opens no credentials file
itself.

| Intent | Command |
|---|---|
| **Start** | `node --env-file=<env> services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs` |
| **Health** | `node --env-file=<env> services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs --status` |
| **Stop** | `node --env-file=<env> services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs --stop` |
| **Restart** | `node --env-file=<env> services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs --restart` |
| **Can it start?** | `node --env-file=<env> services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs --preflight` |
| **Smoke test, no Telegram** | `node services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs --selftest` |

**Start does not merely spawn — it waits for evidence the thing is actually up,
and retries if it is not.** A start that returns success has seen the process
survive its settle window.

### The arming gate

The live poller consumes Telegram updates **destructively**, so it will not
start until it has been armed once, explicitly:

```
node services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs --arm
```

`--arm` persists across reboots. `--disarm` is the off switch.

This is not timidity. A logon task firing unattended on a machine nobody is
watching can eat a shopping list that was being kept, and no amount of later
care gets it back. **If the runtime will not start and `--status` says it is not
armed, that is the gate doing its job — arm it deliberately, do not work around
it.**

---

## Where things are

| | |
|---|---|
| **Log** | `<state dir>/runtime.log` — rotated at 8 MB |
| **State dir** | `ASDAIR_RUNTIME_STATE_DIR`, or the built-in default |
| **What it runs** | `services/asdair/pipeline/runtime.js` (`--watch`) |
| **Run artefacts** | `services/asdair/basket-executor/state/runs/<SHOP-REF>/<run-id>/` |
| **Scheduled task installer** | `services/asdair/pipeline-runtime/install-startup-task.ps1` |

**Run artefacts are per run and are never overwritten.** Each shop run writes
`basket-run-log.json`, `trolley-reconciliation.md` and `regulars-harvest.json`
into its own timestamped directory. If you are comparing two runs, you are
comparing two directories — there is no single "latest" file that silently
replaced the previous one. *(There used to be, and on 2026-08-17 it destroyed
the record of a real shop.)*

---

## Reading the log

Structured JSON lines, one object per event. The ones worth knowing:

| Event | Meaning |
|---|---|
| `pass` | a normal poll completed |
| `pass_failed` | that pass threw and the loop continued — one pass lost, never a shop |
| `browser_build_consumed` | a queued shop was claimed and driven; `basket_ready` says whether it may be announced |
| `browser_build_failed` | the shop errored; the request has been released and the **next pass retries it** |
| `basket_outcome` | the run's verdict, with any blockers by name |
| `late_answer_to_a_settled_question` | a typed answer was refused rather than written onto the wrong question |
| `checklist_base_url` | whether handover cards will carry a tappable link or a bare path |

**A `pass_failed` on its own is not an incident.** Every pass re-derives
everything from Postgres, so a failed one costs exactly one interval. Two things
make it an incident: it repeats every pass, or it is accompanied by
`browser_build_failed` with the same request id each time.

---

## The browser (new, and the most likely thing to need you)

The runtime now acquires its own Chrome. It **reuses** a debuggable Chrome
already answering on the configured port, and **launches** one against the
dedicated ASDA profile if none is. Nobody has to start a browser by hand.

Configuration — names only; Mack owns the values and their placement:

| Variable | What it is |
|---|---|
| `ASDAIR_CHROME_PATH` | the Chrome executable |
| `ASDAIR_CHROME_PROFILE_DIR` | the dedicated ASDA profile directory |
| `ASDAIR_CDP_PORT` | the debugging port |

**There are no defaults for these three, by design.** A missing one fails fast
and loudly with `LAUNCHER CONFIG ERROR` naming exactly which. That is a
configuration fix, not a code fix.

**The browser is always visible.** Headless is refused before spawn and refused
again after attach. If you cannot see it, something is wrong — do not try to
make it headless to "fix" a display problem.

### When ASDA needs signing in again

The log shows `reauth-required` and the run stops with the basket left exactly
as it was.

**This is the one thing the runtime deliberately cannot fix, and must not.** It
never enters a credential. **Warwick signs in, in the visible browser, and the
next pass picks the shop up where it stopped.** No restart, no re-queue, no
command — the request's lease simply expires and is re-claimed.

Escalate to Larry only if re-authentication does not clear it.

---

## Recovery

**The short version: stop it, start it, and check `--status`. Nothing else is
owed.**

Recovery is a property of the design rather than a procedure you perform:

- **The runtime** is restarted by the Windows scheduled task at logon, or by you.
- **A part-built trolley** is not lost and is not rebuilt from scratch. Progress
  is written into the `asdair.browser_build_request` row after every line, so a
  fresh process — on a different working directory or after a reboot — reads what
  the dead one had already done and continues from there. **Nothing depends on a
  file beside the source, on an open session, or on anyone remembering.**
- **An abandoned request** returns automatically. Its lease expires on the
  *database* clock and the next pass re-claims it. You do not need to reset a
  status by hand, and you should not.

### Things that look broken and are not

| Symptom | Reality |
|---|---|
| A shop sits at `WAITING_FOR_BROWSER` for one interval | Normal. It is claimed on the next pass. |
| `--status` reports not armed after a fresh machine | Correct and deliberate. Arm it. |
| The trolley has fewer items than the list | Read the run's `trolley-reconciliation.md`. Unavailable products are recorded, dropped and reported by design, and are **not** a fault. |
| No "basket is ready" message | Check the reconciliation's blockers. The announcement is **gated on a truthful reconciliation** — silence with blockers listed is the gate working, not a failure to send. |

### When to escalate

Escalate to **Larry** (never fix by editing code — that returns as a Work Order):

- the same `browser_build_failed` request id on three consecutive passes;
- the lock refusing a start with **no** live process behind it;
- a reconciliation that reports products in the trolley nobody can account for;
- anything that would need a credential, a checkout, a payment or a delivery slot.

---

## What is NOT covered here

- **First live start on the real machine.** A Warwick gate.
- **Registering the scheduled task.** The installer script is provided;
  registering it with the supervisor is Mack's step and was deliberately not
  performed by the implementer.
- **The live ASDA account.** No part of this runtime, and no part of this
  document, authorises operating it beyond building a trolley and stopping.
