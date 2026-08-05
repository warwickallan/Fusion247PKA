# WO-2026-08-05-10 — Honcho continuity regression: LIVE EVIDENCE COLLECTION (read-only)

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-10 |
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | **Mack** |
| **governance_head** | `65757c62e17901641d9bc3d31aaff146f720dcd2` |
| **authorised_by / date** | Warwick, 2026-08-05 — *"Dispatch Pax immediately to investigate failure. Phase 2 acceptance has just been invalidated. Do not reopen phase 2."* |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — §14.19 (Phase 2 CLOSED), §13.2 **N-2/N-3** (the properties that regressed) |
| **branch** | `build-020/honcho-regression-investigation` · **worktree:** `C:\Fusion247PKA-build-020-trial` (the shared tree — you write ONE file nobody else touches) |
| **file_surface** | **`Deliverables/proofline/EVIDENCE-2026-08-05-honcho-regression.md` — this ONE file. Nothing else.** No repo code, no map, no settings files |
| **machine_surface** *(closed list, READ-ONLY)* | `C:\Users\Buggly\.mypka\governor\**` · `C:\Users\Buggly\.claude\settings.json` · `C:\Fusion247PKA\.claude\settings.local.json` · `C:\Fusion247PKA-build-020-trial\.claude\**` · process list · `git log`/`git show` in any worktree |
| **private_surface** | **`none`.** Nothing under `C:\.fusion247\**`. If evidence appears to require it, **STOP and return `BLOCKED`** |
| **credential_scope** | none · **network:** none — **do NOT call the Honcho API, do not reproduce the abort by making a live request** |
| **live_authority** | **`none`. READ-ONLY.** Do not write, move, repair, restart, re-install or hand-edit anything. Do not restart the Tower watcher. Do not run `continuity.mjs write`. **You are collecting evidence of a failure, not fixing it** |
| **acceptance_property** | **A single evidence file that lets a researcher WITHOUT shell access establish why the continuity brief degraded between the Phase 1→2 respawn and the 2026-08-05 21:4x session — with every claim carried by pasted real command output, and every unknown named as unknown** |
| **veritas_gate** | none — this is evidence for an investigation, not a phase boundary |
| **integration_owner** | Larry · **document_impact:** none (Larry records the map) · **out_of_scope_policy:** report-only |
| **operational_handoff** | none |
| **blocking_dependencies** | none |
| **worker_contract** | `Team/Mack - Automation Specialist/AGENTS.md` @ the governance head |
| **contract_basis** | The governor machine install (`~/.mypka/governor/`, hook registration) is Mack's declared seam — established in WO-2026-08-05-07 and confirmed by Warwick's C-3 |
| **contract_conflicts** | none |
| **return_to** | Larry |

## Why this order exists

**Pax owns the investigation and holds no `Bash`.** A live-machine regression cannot be investigated from file reads alone. You collect the executable evidence; Pax reasons over it. **You do not draw the conclusion** — if you form one, record it as a labelled hypothesis, not a finding.

## The observed symptom — verbatim, from the 2026-08-05 ~21:4x session-start injection

```
⟦GOV⟧ HONCHO CONTINUITY: UNAVAILABLE this session (This operation was aborted).
  Cross-session recall via Honcho could not be read - say so, do not fake it.
  Local cached focus (last known, NOT confirmed against Honcho):
  BUILD-020 Phase 2 - Honcho and Tower as durable shared myPKA infrastructure. ...
```

**And the fallback list that followed was the non-directive loose-Deliverables sweep, not a map pointer.**

## What Larry has already observed — VERIFY EACH, do not inherit it

Larry's own instruments have been wrong twice in this build. Treat every line below as a claim to re-execute.

| # | Claim | How Larry got it |
|---|---|---|
| L-1 | `~/.mypka/governor/continuity.json` last written `2026-08-05T09:54:14.545Z` — ~12 h stale | `cat` of its `updated_at` |
| L-2 | Its `focus` string is **byte-identical** to what the session injection rendered | eyeball comparison — **verify properly** |
| L-3 | `continuity-last.json` and `continuity-seq.json` have mtime **21:45 today**, while `continuity.json` has mtime **10:54** | `ls -la` |
| L-4 | The whole governor install (`continuity.mjs`, `reorient.mjs`, `footer.mjs`, …) has mtime **21:25 today** | `ls -la` |
| L-5 | The stale `focus` still names Phase 2 as live, and `blockers`/`completed` describe **BUILD-015 AsdAIr Gate 3 work**, not Phase 2 | reading the file |

**L-3 is the sharpest lead: the seq/last sidecars are moving while the store is not.** Establish whether that is by design or a fault.

## Required evidence — every item, with the command and its real output pasted

1. **`export MSYS_NO_PATHCONV=1` first.** The instrument warning in the map's rotation block is mandatory here — a mangled `/FLAG` produced a confident wrong negative in this very build.
2. **The store and its sidecars** — full `ls -la` with timestamps; full contents of `continuity.json`, `continuity-last.json`, `continuity-seq.json`, `INSTALLED-FROM.txt`.
3. **Who writes them.** Read `continuity.mjs` and establish, from the code, what `stop` writes, in what order, to which files, and **under what conditions it writes the sidecars but NOT `continuity.json`**. Quote the deciding lines with file:line.
4. **The write-authority race.** Phase 2 shipped a session-start-time comparison to stop stale concurrent writes. **Establish whether that guard is what is now suppressing the write** — and whether a session that never gets a valid start time can ever win. Quote the code.
5. **Hook registration, both levels.** Contents of `~/.claude/settings.json` and `C:\Fusion247PKA\.claude\settings.local.json`. Which `Stop` and `SessionStart` entries exist, which path each executes, and **whether the `Stop → continuity.mjs stop` writer is registered for a session started in `C:\Fusion247PKA-build-020-trial`.**
6. **The remote-read path.** Find the code that produces `"HONCHO CONTINUITY: UNAVAILABLE … (This operation was aborted)"`. Establish **what "aborted" means there** — a timeout, an abort signal, a missing credential, an unreachable host, a thrown error swallowed. Quote it. **Do not make a network call to test it.**
7. **Any log or error artefact** the governor writes — locate it, paste the relevant tail with timestamps, or state that no log exists.
8. **Process list** — `MSYS_NO_PATHCONV=1 tasklist /FI "IMAGENAME eq node.exe" /FO CSV`, plus command lines if obtainable read-only, so Pax can tell what is running and from which worktree.
9. **The regression window, from Git.** `git log` over `tools/governor/continuity.mjs`, `reorient.mjs` and their tests between the Phase 1→2 respawn (~2026-08-04) and `65757c6`. **Name the commits that could plausibly have changed this behaviour**, with one line each on what they changed. **This is the "why did it regress" spine — Pax cannot run git.**
10. **The installed-vs-repo delta.** Is `~/.mypka/governor/continuity.mjs` byte-identical to `tools/governor/continuity.mjs` at `65757c6`? Diff them. **A stale install has been the cause once already in this build.**

## Hard rules

- **Read-only. No repair.** If you find the cause and the fix looks like one line, **you still do not apply it.** Report it.
- **No network. No Honcho API call. No Codex. No Telegram.**
- **Unknown is a permitted answer and a required one.** An unestablished item written as established is the failure this build has paid for repeatedly.
- **Report `BLOCKED` rather than working around a host refusal.** WO-07 established that some machine paths are refused when the actor is a subagent; if that happens, name the exact refusal and stop.
- **Do not commit or push.** Larry integrates.

## Read-back required before you act

Restate: the outcome, your plan, what this order failed to settle, and what looks wrong with it. **Then hold.** Five of seven Work Order refusals in Phase 2 involved a surface or authority field in Larry's order — challenge this envelope properly.
