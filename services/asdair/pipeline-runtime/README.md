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

## Required configuration

**The canonical contract is [`../CONFIGURATION.md`](../CONFIGURATION.md)** — every variable,
which process consumes it, what preflight checks and at what severity, what breaks without
it, and how to test it without printing it. `../.env.example` carries the same names with
placeholder values. This section is a pointer, not a copy.

**Standing rule (Warwick, 2026-08-03): AsdAIr's weekly operation must be completely
independent of any Claude Code / Larry session. Any model call this product needs is made
by the product's own code, through `FUSION_GATEWAY_URL`, to a real OpenAI-compatible API —
never by an interactive AI session standing in for it.** Larry's only legitimate role is
initial setup and fixing genuine defects — never routine weekly running. If a fresh
instance ever finds itself "driving" a step of a live weekly shop by hand, that is the
defect, not a normal state.

### What `--preflight` now proves (WO-B, 2026-08-03)

It used to check that four variables were **set**. A live shop then failed four times on
configuration it had just called fine, so it now asks the things themselves:

| | Check | Severity |
|---|---|---|
| AC1 | Bot credentials present — value never read; token *shape* reported separately | BLOCKING (+ ADVISORY shape) |
| AC2 | The sender allowlist **parses to ≥1 numeric id**, via the intake's own parser | BLOCKING |
| AC3 | Both databases **actually connect**, and each answers as the role it claims to be | BLOCKING |
| AC4 | The **grant matrix** committed in migrations 005/006/008/009/010, per role, per table, per privilege, via `has_table_privilege` / `has_any_column_privilege` — **including its deliberate negatives** | BLOCKING (missing) / ADVISORY (over-grant) |
| AC5 | `ASDAIR_MEDIA_ROOT` set and writable | ADVISORY — cockpit-api is a separate process |
| AC6 | `FUSION_GATEWAY_URL` reachable and `FUSION_GATEWAY_KEY` authenticates | BLOCKING |
| AC7 | **`FUSION_MODEL_VISION` appears in the gateway's own `/models` response** | BLOCKING |
| AC8 | Chrome executable and dedicated profile exist; a live CDP endpoint | BLOCKING / ADVISORY |
| AC9 | Exactly one runtime | BLOCKING |
| AC10 | `pg` resolves from **all seven** folders on the live path, not just `shop/` | BLOCKING |
| AC11 | The logon task points at **this** checkout | ADVISORY |

`--preflight` exits 1 on any BLOCKING problem. Advisories are reported in `warnings[]` and
never stop a start — `ok` still means "no blocking problem", exactly as before.

> **AC7 is the one Warwick named:** *"A default model name that the gateway does not provide
> must never survive preflight again."* An **unset** `FUSION_MODEL_VISION` is therefore a
> failure, not a default — the fallback `fusion.vision` is not served by this gateway.
