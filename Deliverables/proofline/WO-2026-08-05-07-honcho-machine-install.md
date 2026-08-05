# WO-2026-08-05-07 — WP-2B(2), INSTALL HALF: make Honcho reach a fresh Larry in ANY worktree

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-07 |
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | **Mack** |
| **governance_head** | `8d4f32e167ca270bbca32a69ea8299d714faa8b2` |
| **authorised_by / date** | Warwick, 2026-08-05 — map §14.0 **W-1** and **N-3**, gate **S-1** |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **§14.19** (the six-invocation correction), **§14.0b** (restart durability NOT claimed), **§14.0c S-1**, **§14.20** (this is a rotation precondition) |
| **branch** | `build-020/honcho-machine-install` · **worktree:** `C:\Fusion247PKA-wo-2b2-install` — yours, cut from the governance head. **NOT the shared tree** |
| **file_surface** | `Deliverables/proofline/EVIDENCE-2026-08-05-wo-07-honcho-install.md` — **the evidence file only.** No repo code |
| **machine_surface** *(closed list)* | `C:\Users\Buggly\.mypka\governor\` — the runtime copy · `C:\Users\Buggly\.claude\settings.json` — user-level registration · `C:\Fusion247PKA\.claude\settings.local.json` — **removal of the now-duplicate entries ONLY** |
| **private_surface** | **`none`.** Nothing under `C:\.fusion247\**` |
| **credential_scope** | none · **network:** none |
| **live_authority** | **BOUNDED — the three machine paths above.** ⚠️ **Do NOT restart or signal the live watcher PID 31268.** ⚠️ **Do NOT hand-edit `~/.mypka/governor/continuity.json`** — its content is a separate operational act of Larry's |
| **acceptance_property** | **A fresh session started in a worktree that is NOT `C:\Fusion247PKA` receives a continuity brief automatically, rendered by the INSTALLED copy, with no path typed by Warwick — and exactly ONE brief and ONE packet write per stop, not two** |
| **veritas_gate** | Phase 2 gate (§14.0c) — **this order is the primary evidence for S-1** |
| **integration_owner** | Larry · **document_impact:** the map — owner: larry · **out_of_scope_policy:** report-only |
| **operational_handoff** | none — installing existing code, not delivering a new service |
| **blocking_dependencies** | **none — WP-2B(2)'s code half is integrated at `8d4f32e`.** That is what you install |
| **worker_contract** | `Team/Mack - Automation Specialist/AGENTS.md` @ the governance head |
| **contract_basis** | supervisor/hook **registration** is Mack's seam — Keel's contract says *"Keel writes the hook; Mack registers it"*, and Warwick's C-3 confirmed it for this build · `Deliverables/**` not prohibited wholesale |
| **contract_conflicts** | none — this order exists **because** Keel refused this half on five grounds, all upheld |
| **return_to** | Larry |

## Why this is yours

**Keel refused this half and was right on all five grounds:** `.claude/` is on its permanent never-edit list · hook registration is your seam · copying into `C:/Fusion247PKA/` means writing another worktree on another branch · and that checkout is what the live Stop hook and PID 31268 execute from.

## The outcome

**A fresh Larry, started anywhere, is oriented automatically — and exactly once.**

Today: **no `SessionStart` hook is registered for any worktree but `C:\Fusion247PKA`**, so a fresh Larry opened elsewhere gets **nothing**. And the installed copy is stale: it still renders *"AUTHORITATIVE current focus"* closing *"This is the source of truth for what Warwick is doing"* — **a live contradiction of root `CLAUDE.md` #9, *"a pointer with zero authority"***.

## 🎯 SIX invocations, not four — the correction that decides this order

`C:\Fusion247PKA\.claude\settings.local.json` carries **six** `C:/Fusion247PKA/`-hardcoded entries: **`Stop` × 2** (`bridge-ingest.mjs`, **`continuity.mjs stop`**) · `SessionStart` × 2 (`ensure-capture-gateway.mjs`, `reorient.mjs`) · `PreToolUse` × 1 · `statusLine` × 1.

**My earlier reconnaissance said four and omitted both `Stop` hooks — one of which is `continuity.mjs stop`, THE WRITER this whole work package exists to deploy.** **Installing only the `SessionStart` render would leave the writer running from the stale checkout: S-1 would still fail while everything looked installed.** **Verify the count yourself before acting on it.**

## The route — Keel's, adopted wholesale. Verify each step; do not trust this list.

1. **Runtime location `C:\Users\Buggly\.mypka\governor\`.** **No new location** — `~/.mypka/governor/continuity.json` already lives there. Matches Decision A3: *a documented copy with a recorded source SHA — no scheduler, no watcher-of-the-watcher, no registry.*
2. **Copy `continuity.mjs`, `reorient.mjs` and their in-tree imports from the integrated head**, plus a one-line `INSTALLED-FROM.txt` recording the source SHA. **Nothing else.** Enumerate the imports rather than assuming two files suffice.
3. **Register in user-level `~/.claude/settings.json`:** `SessionStart` → `node C:/Users/Buggly/.mypka/governor/reorient.mjs`; `Stop` → `node C:/Users/Buggly/.mypka/governor/continuity.mjs stop`.
4. **THEN remove the now-duplicate `SessionStart` (reorient) and `Stop` (continuity) entries from `C:\Fusion247PKA\.claude\settings.local.json`.** **This step is the difference between an install and a DOUBLE-FIRE.** **Leave `bridge-ingest.mjs`, `ensure-capture-gateway.mjs`, `PreToolUse` and `statusLine` alone** — they are out of scope.

## 🚨 UNESTABLISHED and must be PROVEN, never assumed

**Whether user-level hooks MERGE with or OVERRIDE project-level hooks in this Claude Code build is unknown.** **If they merge, a fresh Larry in the main worktree gets TWO briefs and TWO packet writes per stop** — which is why step 4 exists and why the acceptance property says *exactly one*. **Establish this by execution before relying on either behaviour.** Also note: `~/.claude/settings.json` already carries a governor `statusLine` pointing at `C:/Fusion247PKA/` — **it is a live surface, not an empty one.**

## Acceptance evidence — executed, pasted

- **The real journey**: a session started in a worktree that is **not** `C:\Fusion247PKA` receives a brief, rendered by the **installed** copy. **Prove it is the installed copy** — the stale one says *"AUTHORITATIVE current focus"*; the correct one says *"recall only, ZERO authority"*. **That string difference is your discriminator.**
- **Exactly one brief and one packet write per stop** — measured, in the main worktree too.
- Before/after of both settings files, and `INSTALLED-FROM.txt` with the SHA.
- **PID 31268 alive on absolute path and `WATCHER_ID` at start and end.** Never a process-name match.
- `bash scripts/secret-scan.sh --surface <the evidence file>` — `--surface` mode only.

**Under §14.0b, restart durability is NOT claimed. Do not design a proof around a reboot and do not record its absence as a limitation of your work.**

## Read-back gate — MANDATORY

Return a READ-BACK and HOLD. Outcome in your own words · method · what this order fails to settle · what looks wrong in it. **Seven orders in this phase have been refused or held, every one for a defect in MY order rather than the work.** **Refuse this one if it is under-specified — a bad install is harder to see than a bad build, because it looks like nothing happened.**

`export MSYS_NO_PATHCONV=1` before any Windows command. Git for your branch is yours. You do not decide the merge.
