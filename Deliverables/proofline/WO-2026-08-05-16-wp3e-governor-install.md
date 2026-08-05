# WO-2026-08-05-16 — WP-3E: install the fixed governor to the machine

> ## ✅ CLASS-A PRE-DISPATCH CHECK — **PASS** (Nolan, 2026-08-05, Sonnet 5)
>
> **The first real exercise of the route Warwick approved on 2026-08-05.** Checked against the closed list only — the final envelope, Mack's contract and shim, and SOP-022's class-A taxonomy. **GL-012 was not opened**, because `private_surface: none` is consistent with a `machine_surface` outside `C:\.fusion247\**` and therefore needed no testing. **Corrections: none.**
>
> **One item flagged, explicitly NOT blocking.** `contract_basis` cites Warwick's verbatim *"Mack should own the live-machine side: installation…"* — **and that grant does not appear in Mack's `AGENTS.md` as written today.** The contract's Keel-boundary section assigns *"deployment or launcher hooks"* to Keel and scopes Mack's operational ownership to **released services**; the governor lives under `tools/governor/`, not `services/**`, so the Keel boundary does not technically reach it — **but the affirmative installation grant for a non-service tool copy is an unratified seam, not yet in the contract text.** Checked on approval-of-substance rather than ratified wording, so not a defect. **Recorded here so it reaches Warwick's ratification and is not lost.**
>
> **Cost, for AC-5:** Sonnet 5 · 7 tool calls · read-only · no repo audit, no implementation review, no writes.
>
> **Status: ISSUED. Dispatch decision was Larry's and is taken.**

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-16 |
| **status** | ISSUED — class-A check PASSED (Nolan, Sonnet 5) |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | **Mack** |
| **governance_head** | `696d44985b6e5b943df93daaccd52d133b7e8663` |
| **authorised_by / date** | **Warwick, 2026-08-05** — Phase 3 scope, items 1 and 2. The fixes are inert until installed; map §16.3 WP-3E |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` §16 · **§16.2 AC-1..AC-4** are what this makes reachable |
| **branch** | `build-020/wp-3e-install` · **worktree:** `C:\Fusion247PKA-wp3e-install` — **yours, cut from the governance head** |
| **file_surface** | **`Deliverables/proofline/EVIDENCE-2026-08-05-wp3e-install.md` — the evidence file ONLY. No repo code.** You install code you did not write and do not modify |
| **machine_surface** *(closed list)* | **`C:\Users\Buggly\.mypka\governor\**`** — the runtime copy. **WRITE permitted here, and only here** |
| **private_surface** | **`none`.** Nothing under `C:\.fusion247\**`. **If any step appears to need it, STOP and return `BLOCKED`** — a GL-012 boundary was crossed once in this build already and it will not be crossed twice |
| **credential_scope** | **`none`** · **network:** **`none`.** No Honcho call, no Telegram, no Codex, nothing sent to Warwick |
| **live_authority** | **BOUNDED — `~/.mypka/governor/**` only.** ⚠️ **Do NOT touch `~/.claude/settings.json` or any `.claude/**`** — hook registration is NOT in this order. ⚠️ **Do NOT restart the Tower watcher.** ⚠️ **Do NOT run `continuity.mjs write`** against the live store |
| **capability_evidence** | `source: executed probe` (Larry, at the governance head) — `node --test tools/governor/*.test.mjs` → **`# tests 438 / # pass 438 / # fail 0`**; live store `~/.mypka/governor/` exists with 8 installed `.mjs` files; **`ls ~/.mypka/governor/health/*/recommendation.json` → no such file**, so no stale cache is present as of now; subagent **reads** of `~/.mypka/**` are not refused by the host classifier (established WO-10); **subagent WRITES to that path were refused once — WO-07 Amendment 3.** See the blocker note below |
| **acceptance_property** | **The installed copy at `~/.mypka/governor/` is byte-identical to the governance head for every file it carries, the live governor still renders on a real session after install, and a documented rollback exists and has been shown to work** |
| **veritas_gate** | **2** — Phase 3 gate, on the exact integrated head |
| **integration_owner** | Larry · **document_impact:** the map — owner: Larry · **out_of_scope_policy:** report-only |
| **operational_handoff** | none — you are the operator |
| **dependency_policy** | no-new-runtime-deps |
| **blocking_dependencies** | none. WP-3A, WP-3B and WP-3F are integrated at the governance head |
| **worker_contract** | `Team/Mack - Automation Specialist/AGENTS.md` @ the governance head |
| **contract_basis** | **Installation and deployment of the live-machine side is Mack's declared seam** — Warwick, 2026-08-05: *"Mack should own the live-machine side: installation, deployment/process configuration, supervision, restart/recovery execution, monitoring and runtime evidence."* The evidence file is permitted under root `AGENTS.md` — `Deliverables/**` is not prohibited wholesale and an evidence file defines no governance |
| **contract_conflicts** | **DECLARED: WO-07 Amendment 3 recorded `BLOCKED — required-but-unavailable` because machine WRITES were refused by the host classifier when the actor was a subagent.** WO-10 later established **reads** are fine. **If writes are still refused, return `BLOCKED` with the exact refusal text — do not work around it.** Larry performs the write personally in that case |
| **return_to** | Larry |

## The outcome

**The fixes stop being theoretical.** WP-3A's frontier and pointer repairs and WP-3B's measured footer are inert code in a repository until the copy at `~/.mypka/governor/` carries them. **AC-1, AC-2 and AC-3 are not reachable until this lands.**

## What to install

**Every `.mjs` the governance head carries under `tools/governor/` that the live install already has a copy of.** The install currently holds eight: `atomic-write`, `continuity`, `evaluator`, `footer`, `health-store`, `reorient`, `sampler`, `statusline-live`.

**Do not add files the install does not already carry, and do not remove ones it does.** If the head has a module the install lacks, or the reverse, **report it — do not decide it.**

## The known trap, and it is the one that has already cost this build twice

**A byte diff against the working tree will produce a false positive.** `core.autocrlf=true` with no root `.gitattributes` means the working tree holds LF and git's checkout representation is CRLF — **eight for eight, the size delta was exactly the line count last time this was measured.**

**Compare against the git BLOB at the governance head, not the working tree**, or compare line-ending-normalised and say which you did. **Report both raw and normalised if in any doubt.** This is candidate C-2 in `Deliverables/BACKLOG.md` and it is unfixed.

## Required evidence

1. **Before state.** `ls -la` of `~/.mypka/governor/`, and the SHA-256 of each of the eight files **before** you touch anything. **This is the rollback baseline and it must exist before the first write.**
2. **Confirm no stale `recommendation.json` sits as a direct child of any store directory under `~/.mypka/governor/health/`.** WP-3B's earlier commit could have written one; the fixed code moves it to `state/`. **It is inert to fixed code but it poisons the sample scan while present.** Larry removed the one he created; **confirm, do not assume.**
3. **Install**, then prove **byte-identity against the governance head blob** for every file installed.
4. **Prove the live governor still works on a real session** — render the footer from the installed copy and paste the exact line. **A render that returns `BLIND` immediately after install is a FAILURE, not a quirk** — that is the defect fixed at `3b10c42` and it is what this step exists to catch.
5. **Rollback: document it and SHOW IT WORKING.** Restore one file from the baseline, prove it restored byte-exact, re-install. **A rollback that has never been executed is a claim, not a procedure.**
6. **`INSTALLED-FROM.txt`** — update it to name this governance head. **It currently misdescribes the machine** (candidate C-15: it claims a settings file was removed that still exists). **Correct only the part your install makes untrue; report the rest.**

## 🔴 Bars

- **No hook registration.** The `MessageDisplay` experiment is a separate item requiring Warwick's own device. **Not this order.**
- **No `.claude/**` edits of any kind.**
- **No new mechanism.** §16.4 binds: no checker, validator, control plane, registry or document family.
- **Report, do not fix, anything you find outside the eight files.**

## Read-back required before you act

Restate: the outcome, your plan, what this order failed to settle, and what looks wrong with it. **Then hold.** **14 class-A defects across 16 orders in this build, every one a defect in Larry's envelope.** This order has been through Nolan's class-A check — **that is not a reason to challenge it less.**

---

# AMENDMENT 1 — 2026-08-05, Larry. Four defects upheld. All four questions answered

## E-1 🔴 DEFECT 1 UPHELD — **Larry stated the CRLF trap BACKWARDS, and the direction is load-bearing**

**The order said the working tree holds LF and the blob holds CRLF. It is the reverse.** Mack measured it decisively on `atomic-write.mjs`: the **blob holds LF**, the **working tree holds CRLF**, `core.autocrlf=true`, no root `.gitattributes`. Byte counts agree — blob 9652, worktree 9844, delta 192 = exactly the line count.

**Why it matters and is not cosmetic:** as written, the rationale implies the worktree is the LF-clean source. **A `cp` from the worktree would install CRLF and fail byte-identity eight for eight** — the third time this trap would have bitten this build.

**The instruction was right for the wrong reason.** Install by writing **blob bytes** — `git cat-file blob <head>:tools/governor/<f>.mjs` — exactly as Mack planned. **Corrected here rather than silently, because the reasoning is what a later reader inherits.**

## E-2 DEFECT 2 UPHELD — the rollback file must have a REAL delta

**Six of eight files have baseline == installed == head, so restoring one of those and proving it byte-exact is true whether or not the restore did anything.** A tautology dressed as a procedure — precisely the *"claim, not a procedure"* failure step 5 exists to prevent.

**Step 5 is amended: the rollback MUST be executed on a file with a genuine delta. `footer.mjs` confirmed** — largest delta, and it carries the property under test.

## E-3 DEFECT 3 — ruled, and it is a non-issue for correctness

**The head carries ten governor modules; the install carries eight.** Larry has verified by execution: **no module among the installed eight imports either `continuity-derive.mjs` or `worktree-guard.mjs`.** The eight-file install is self-consistent.

**Do not add them.** `footer.mjs:50` records that WO-OR-05 **deliberately** removed the `worktree-guard.mjs` import to keep a shelling-out module off the statusline path, so that absence is intentional. **Install the eight; report the two; decide nothing.**

## E-4 DEFECT 4 — confirms candidate C-15, handled exactly as you propose

**Report and leave.** Your reasoning is right: the stale line describes a file that **overrides the statusline** — the exact surface step 4 depends on — so it is not clerical. It is already C-15 in `Deliverables/BACKLOG.md`.

## E-5 The write probe — ACKNOWLEDGED, and it was the right call

**Returning `BLOCKED` on hearsay would have been a defect in its own right.** A 38-byte reversible write inside a surface explicitly granted, disclosed in full and cleaned up, is proportionate. **It also produced a durable estate fact: subagent writes to `~/.mypka/**` now succeed, so WO-07 Amendment 3's constraint is superseded.**

**`INSTALLED-FROM.txt` handling approved as you propose** — correct the `RESYNCED`/`checkout:`/`code:` lines, and mark the write-refusal provenance line **superseded with the probe as evidence rather than deleting it.** History survives beside the correction.

## E-6 Step 4 render route — **(a) then (b). Approved, with the surface widened for it**

**You are right that step 4 as written cannot distinguish an honest `BLIND` (no telemetry for a worktree that never had a statusline refresh) from the `3b10c42` defect returning. That is a real defect in the order.**

**`machine_surface` is widened, READ-ONLY, by one path: `C:\Users\Buggly\.mypka\governor\health\C--Fusion247PKA-build-020-trial\**`.** Render with that cwd. **Read only — write nothing there.**

**(c) is correctly rejected and your reason is the right one:** manufacturing a sample to satisfy the test is fabricating the conditions of the measurement.

**(b) is Warwick's and is NOT a precondition of your return.** Close the order on (a); his own session is the confirmation, and it is the surface where the defect actually surfaced last time.

## E-7 Evidence file — **commit AND push `-u`**

Recorded is not visible. Push your branch; Larry integrates. Lifecycle stays Larry's.

## E-8 For the record — the pre-dispatch check MISSED all of this

**This envelope passed a bounded class-A check before it reached you, and you then found four defects in it.** That is the miss rate, on the first and only use, and it is being reported to Warwick as evidence rather than buried. **It independently supports the ruling he had already made: moving detection does not repair generation.**

**Proceed. No further read-back unless this amendment is itself defective.**
