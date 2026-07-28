# `services/asdair/pipeline-runtime` — the supervised AsdAIr runtime

This folder is the **supervisor**, not the pipeline. It starts, stops, guards and reports
on `services/asdair/pipeline/runtime.js` — which it launches and never edits.

Warwick authorised exactly this and no more (2026-07-28): one ShopperBot `getUpdates`
consumer, the deterministic command worker, pipeline resumption for incomplete shops, and
Windows logon/restart recovery. **It is not an LLM daemon.** Nothing here can check out,
pay, book a delivery slot, or enter a password — there is no code path from this folder to
any of those.

## The one rule everything else serves

Telegram long-polling is **single-consumer and destructive**: fetching updates with an
offset acknowledges — and permanently deletes — everything below it. There is no lease and
no lock in the protocol. Two pollers therefore do not share the stream, they race it, and
the realistic failure is **the week's shopping list silently consumed and gone**, with no
error raised anywhere.

So: **exactly one runtime, enforced by an exclusive lock, and a launcher that refuses
rather than "starting anyway just in case".**

## Files

| File | What it is |
|---|---|
| `ensure-asdair-runtime.mjs` | The launcher. Preflight → exclusive lock → detached spawn → wait for it to settle → status. Also `--stop`, `--restart`, `--status`, `--preflight`, `--arm`, `--disarm`, `--selftest`. |
| `runtime-lock.mjs` | The lock. `O_EXCL` creation, holder bound to **pid + OS creation time + command-line fingerprint**, atomic stale reclaim, kill-confirming stop. |
| `asdair-status.mjs` | The health surface. One machine-readable document, each fact from whatever already owns it. Also a library (`collect()`) for the Cockpit and the ShopperBot status card. |
| `runtime-paths.mjs` | Where operational state lives — in one place, so nothing can disagree about which lock it means. |
| `probe-pending-updates.mjs` | "Is a list still waiting on the bot?", answered **without consuming it** (`getUpdates` with no offset confirms nothing). |
| `install-startup-task.ps1` | Idempotent register/uninstall/status for the `MyPKA-AsdAIr-Runtime` logon task, mirroring `MyPKA-Directus-Live`. |
| `selftest-entry.mjs` | A stand-in runtime used only by `--selftest`, so the spawn path can be proved without a Telegram poller. |
| `proof/` | The executed proofs. `node proof/run-proofs.mjs`. |
| `RUNTIME-PROOF.md` | **Read this.** What was proved, with evidence — and what was not. |

## Everyday use

```bash
cd services/asdair/pipeline-runtime
npm install --omit=dev

# credentials are CONSUMED from the environment; no file here ever opens one
ENV='--env-file="C:\.fusion247\.env keys\shopper.env.txt" --env-file=C:\.fusion247\asdair.env'

node $ENV ensure-asdair-runtime.mjs --preflight   # can it start? why not?
node $ENV ensure-asdair-runtime.mjs               # start (refuses if one is running)
node $ENV ensure-asdair-runtime.mjs --status      # health, as JSON
node      ensure-asdair-runtime.mjs --stop        # stop the one holder
node $ENV probe-pending-updates.mjs               # is a list waiting? (non-consuming)
```

State lives **outside this public repo**, at `C:\.fusion247\asdair\`:
`runtime.pid` (the lock), `runtime.log` (the JSONL event stream), `runtime.armed`,
`status.json` (a cache), and the intake's `shopper-intake-state.json` (the offset).

## The arming gate

The live poller consumes Telegram updates destructively, so it **will not start until it
has been armed once**:

```
node ensure-asdair-runtime.mjs --arm       # persists across reboots
node ensure-asdair-runtime.mjs --disarm
```

This is not timidity. A logon task firing unattended on a machine nobody is watching can
eat a list that was being kept for acceptance, and no amount of later care gets it back.
Arming is one command; losing the week's list is not recoverable.

`--disarm` does not stop a runtime that is already running — use `--stop` for that.

## Logon recovery

```powershell
powershell -ExecutionPolicy Bypass -File .\install-startup-task.ps1 -Action install
powershell -ExecutionPolicy Bypass -File .\install-startup-task.ps1 -Action status
powershell -ExecutionPolicy Bypass -File .\install-startup-task.ps1 -Action uninstall
```

Idempotent — re-running replaces the registration with the same definition. The task
registers under the user's own token and needs no elevation. `-Disabled` registers it
without letting it fire, which is what you want when the launcher path does not exist yet.

## Health

`asdair-status.mjs` assembles rather than stores, on purpose. Liveness comes from the
**OS process table** (a database heartbeat is a claim written by a process that may since
have died — believing one is how a second poller starts); the offset comes from the
**intake's own state file** (already its SSOT); activity and errors come from the
**runtime's own event log**; and **pending work comes from Postgres, read-only**. The full
reasoning is in `RUNTIME-PROOF.md` §9.

## Known blockers (not in this folder)

1. **`pg` is unresolvable from `services/asdair/shop/`**, so the live runtime would start
   and die on its first database read. `preflight` refuses until it is fixed.
   See `RUNTIME-PROOF.md` §11.
2. **A crash between the intake's offset write and the shop insert loses the list
   silently.** Reproduced on demand. See `RUNTIME-PROOF.md` §5.

## Credentials

Everything arrives through `node --env-file=`. No file in this folder opens, parses, prints
or inspects a credentials file; they know env var **names** only. Nothing operational or
personal is committed — `Fusion247PKA` is a public repo.
