# WO-2026-08-05-16 — WP-3E: install the fixed governor to the machine

> **⚠️ This order is submitted to NOLAN for a bounded class-A pre-dispatch check before it reaches Mack.** First real exercise of the route approved by Warwick on 2026-08-05. **It is NOT yet dispatched.**

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-16 |
| **status** | DRAFT — awaiting class-A check |
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
