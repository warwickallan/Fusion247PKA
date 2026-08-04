# BUILD-015 AsdAIr Stage 1 — merged, with live operational activation DEFERRED BY OWNER

**Merged 2026-07-28. PR #82, squash `443cad4b4a806cf6d170fe409f91d1eef14f0501`, at reviewed head `981a054`.**

> **Read this before assuming AsdAIr is running.** The build is complete and merged. The **operational
> activation is deliberately not done**, by Warwick's decision. Nothing in this system is polling, shopping or
> touching the household database right now, and that is the intended state.

> **⚠️ SUPERSEDED IN PART, 2026-08-04 — Warwick's ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`.**
> **Read [`RUNTIME-DECISION.md`](./RUNTIME-DECISION.md) before using this file as an activation path.**
>
> This document describes activating the **CDP browser runtime** as the route to a live shop. **That is no longer
> the live route.** The Stage 1 live basket writer is **Sonnet in Claude for Chrome**; the runner at
> `services/asdair/browser-runner/` is experimental, deferred, not the live default, **not a blocker to Stage 1**,
> and **prohibited from further live-account testing without fresh authority from Warwick.**
>
> **Consequently:** deferred item **2** ("Live Telegram → browser → reconciliation acceptance") is no longer a
> runner acceptance — the equivalent proof now runs **without touching the live ASDA account** (WO-X in
> [`WORK-ORDERS-REALIGNMENT-ADDENDUM.md`](./WORK-ORDERS-REALIGNMENT-ADDENDUM.md)). The "Activating it" step 1
> (sign in once, in the dedicated profile) served the runner and is not a prerequisite for the Sonnet path.
>
> **What is NOT superseded and still governs:** the intake/runtime activation gating in general — items **1**,
> **3** and **4**, the `--arm` consume gate, the destructive single-consumer `getUpdates` hazard behind it, every
> "Known open item carried forward", and every line under "The permanent boundaries". Those are unchanged.
> Process: [`CANONICAL-WEEKLY-SHOP-PROCESS.md`](./CANONICAL-WEEKLY-SHOP-PROCESS.md).

---

## What IS complete and merged

- **Codex QA: READY_TO_MERGE** at exact head `981a054` (round 2/3), after its round-1 blocker was fixed and
  delta-reviewed. Its words: *"No merge-blocking fitness-for-purpose defect remains."*
- **CI green** at that head — 14 checks, 0 failures, secret-scan clean across 1,014 tracked files.
- **13 modules, 1,024+ tests passing, 0 failing**, all running in CI (nine AsdAIr steps).
- **Migrations 005–009 applied live**: the regulars learning grant, the shop control surface, the `rotate`
  directive, `shop_line` (the durable home of the grounded interpretation), and the machine-ledger /
  question-render-contract split.
- **Independent, visible browser operation PROVEN** — a plain Node/CDP process against a dedicated persistent
  Chrome profile added a Regular by product reference, search-added a non-Regular, used the real +/− stepper,
  read the basket back, and restored the trolley to its exact starting state. No Claude Code, no MCP, no
  extension, no Playwright. *(**2026-08-04:** the proof stands and is not withdrawn. It proved the runner
  **can** drive the browser; it never established that it **should** be the live route, and Warwick has now
  ruled that it is not — see the banner above and `RUNTIME-DECISION.md`.)*

## What is DEFERRED — accepted follow-on activation, NOT merge blockers

**These were not proven. Do not read the merge as evidence that they were.**

| # | Deferred item | State |
|---|---|---|
| 1 | **Full real weekly-shop replay** (the 2026-07-27 historical acceptance) | NOT RUN. The list photo expired off ShopperBot via Telegram's 24-hour retention for undelivered updates. The photo is retained on disk, so the replay remains possible — it needs re-sending to the bot. |
| 2 | **Live Telegram → browser → reconciliation acceptance** | NOT RUN. The dedicated Chrome profile was signed out of ASDA by a rate limit mid-build and Warwick was away from the machine. Larry declined to sign in on his behalf: entering account credentials and passing a CAPTCHA are hard limits regardless of authorisation. |
| 3 | **Arming `MyPKA-AsdAIr-Runtime`** | NOT ARMED. The scheduled task is registered **Disabled**, and the live poller sits behind a one-off `--arm` gate. Verified at merge: task Disabled, not armed, not running. |
| 4 | **Genuine reboot / logon-recovery proof** | NOT PROVEN. `Start-ScheduledTask` returned `0x0` and spawned a detached child that outlived its launcher, but the logon **trigger**, the `PT30S` delay and early-session credential availability are untested. No reboot was performed. |

## Activating it, when Warwick chooses to

Deliberate steps, in order — none of them happen by themselves:

1. Sign in to ASDA **once** in the dedicated profile (`C:\.fusion247\asdair\chrome-profile`). The runner never
   handles the password and has no command capable of entering one; it detects and *reports* re-auth.
2. `Enable-ScheduledTask -TaskName MyPKA-AsdAIr-Runtime`
3. `node ensure-asdair-runtime.mjs --arm` — the one-off consume gate. It exists because `getUpdates` is
   destructive: an unattended poller firing on a machine nobody is watching can eat a list being kept for
   acceptance, and no amount of later care gets it back.
4. Re-send a list to ShopperBot and run the acceptance.

## Known open items carried forward (documented, not hidden)

- **`promoteDecision` is deliberately not wired.** Turning an answer into a standing rule changes every future
  basket, and the command surface does not yet carry the provenance that decision deserves.
- **Rule 7 (the £120–150 budget band) is structurally inoperative** — no price column exists, so `budget_flag`
  is permanently `unknown`. Any budget observation in a shop report is a *human* one.
- **Alias matching is exact-string**, so word order alone defeats it. Catalogue grounding raised end-to-end
  resolution from a measured 52% to 90%, but the matching algorithm itself is unchanged.
- **Rules 23/24 fix the Sure variant while `rule_qa_log` #5 says rotate it.** Real, unresolved, and surfaced by
  the planner as `fixed_variant_conflict → needs_decision` rather than silently decided. Warwick's call.

## The permanent boundaries — unchanged by any of the above

Never auto-substitute · never book a slot · never check out · never pay · never enter a password ·
exactly one ShopperBot poller · exactly one writer on the live trolley · substitutions stay OFF.
**Warwick is the gate for every consequential action, and payment additionally requires his bank app.**
