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
| **machine_surface** *(closed list, READ-ONLY)* | ~~`C:\Users\Buggly\.mypka\governor\**`~~ → **`C:\Users\Buggly\.mypka\**`** (widened by Amendment 1, M-2) · `C:\Users\Buggly\.claude\settings.json` · `C:\Fusion247PKA\.claude\settings.local.json` · `C:\Fusion247PKA-build-020-trial\.claude\**` · process list · `git log`/`git show` in any worktree |
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

---

# AMENDMENT 1 — 2026-08-05, Larry. Issued in response to Mack's `CLARIFY`

**All five points answered. Two of them (C-1 and M-1) were defects in the order's INSTRUMENT and EVIDENCE DESIGN — each would have put a confidently wrong statement into the evidence file. Both upheld. One further fresh read-back is permitted; after that, proceed unless an ACTIVE in-scope blocker remains.**

| # | Point | Settled |
|---|---|---|
| **M-4** ⛔ | **Harness forbids writing report `.md` files; this order requires exactly one** | ✅ **WRITE THE FILE. Explicitly authorised.** The harness rule targets *unsolicited* report artefacts. This is a **commissioned deliverable with a named cross-context consumer**: Pax runs in a separate context, holds no `Bash`, and the acceptance property is *expressly* about a reader with file access alone. **A return that exists only in your transcript is unreadable to the investigator it is for, and would defeat the entire reason you were paired with Pax.** You were right not to resolve this yourself |
| **C-1** | `MSYS_NO_PATHCONV=1` set globally breaks `git -C` with POSIX paths | ✅ **UPHELD, and your resolution is adopted verbatim: keep the flag set, and use Windows-form paths (`C:/...`) for every native-binary invocation (`git`, `tasklist`).** You proved both halves by execution. **The order's item 1 is amended to say exactly this.** This is precisely the confident-wrong-negative class item 1 existed to prevent, reproduced by item 1 itself |
| **M-1** | Item 10 will false-positive: uniform ~1 byte/line delta across all eight files | ✅ **UPHELD, and the diff protocol is now: run it BOTH raw and line-ending-normalised, and report both numbers side by side.** Your CRLF/LF hypothesis is almost certainly right — **`core.autocrlf=true` with no root `.gitattributes` is a known, recorded estate defect (map P-10), and Larry's own commit on this very branch emitted `LF will be replaced by CRLF` an hour ago.** Keep it labelled a hypothesis and let the two numbers settle it |
| **C-3 / M-3** | Which ref does item 10 turn on; window end for item 9 | ✅ **Acceptance turns on `c21c3f3`** — the ref `INSTALLED-FROM.txt` claims the install came from. That answers *"is the install what it says it is?"*. **Also diff against `65757c6`** to answer the separate question *"is the install behind the governance head?"* — label both, report both, conflate neither. `c39825c` is documentation-only and cannot affect the install; note it and move on. **Item 9: extend the window to `c39825c` and `origin/main`, label anything after `65757c6` as post-governance-head, and ADD `continuity-derive.mjs` to the file list.** All confirmed |
| **M-2** | Extend read-only surface to `~/.mypka/**` | ✅ **GRANTED** — envelope updated above. Your reasoning is the deciding one: *"no log found within `governor/`"* would be true and misleading if the log is one directory over. **`C:\.fusion247\**` remains barred** |
| **C-2** | `INSTALLED-FROM.txt` claims a file was "removed 2026-08-05" that exists now, 28,238 bytes, mtime 17:39 | ✅ **Report BOTH readings with the evidence for each — file-removed vs entries-removed-from-within — and do not assume the install record is right.** Treat this as a first-class finding: **an install record that misdescribes the live machine is itself a candidate cause**, and item 5 turns on it |
| — | Masking any credential found in `settings.local.json` | ✅ **Correct and required.** Mask it and say you masked it |
| — | Not trawling `services/obsidiwikai/**` | ✅ **Agreed.** Confirm the governor's Honcho path is self-contained and say so. That service is a separate product-side client and is out of scope |

## Item 1 — AMENDED TEXT, replacing the original

> **`export MSYS_NO_PATHCONV=1`, AND use Windows-form paths (`C:/...`) for every native-binary invocation — `git`, `tasklist`, `cmd.exe`.** The flag is required or `tasklist /FI` is mangled into `C:/Program Files/Git/FI`; Windows-form paths are required or `git -C /c/...` fails with `fatal: cannot change to`. **Both failure modes are real and both were proven by execution during the read-back. A worker who does only one half will produce a confident wrong negative.**

## One more finding your read-back produced, which Larry is adopting

**Reads into `~/.mypka/governor/` are NOT refused by the host classifier when the actor is a subagent** — you established this by doing it. WO-07 Amendment 3's `BLOCKED` was about **writes**. That narrows a recorded estate constraint from "machine paths" to "machine writes", which is worth more than this order. **Record it in the evidence file as a standalone observation.** Do not test a write to establish the other half — nothing here needs one.
