# WO-2026-08-05-11 — WHY DID HONCHO REGRESS? Investigation and brief

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-11 |
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | **Pax** |
| **governance_head** | `65757c62e17901641d9bc3d31aaff146f720dcd2` |
| **authorised_by / date** | **Warwick, 2026-08-05, verbatim:** *"So after all that time and effort in the last phase honcho didn't work and yet it did in the phase 2 Respawn from phase 1. So why have we regressed. Dispatch Pax immediately to investigate failure. Phase 2 acceptance has just been invalidated. Do not reopen phase 2."* |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — §13.2 **N-2/N-3** (the acceptance properties in question) · §14.19 (Phase 2 CLOSED and MERGED) · §15.3c/§15.3d (the end-of-phase-collapse investigations this feeds) |
| **branch** | `build-020/honcho-regression-investigation` · **worktree:** `C:\Fusion247PKA-build-020-trial` |
| **file_surface** | **`Deliverables/2026-08-05-pax-honcho-regression-brief.md` — this ONE file. Nothing else.** You do **not** edit the map, the Work Orders, any code, or Mack's evidence file |
| **private_surface** | **`none`.** Nothing under `C:\.fusion247\**`. If the investigation appears to require it, **STOP and return `BLOCKED`** |
| **credential_scope** | none · **network:** **WebSearch/WebFetch permitted for Honcho product/API documentation ONLY.** **No call to Warwick's own Honcho instance, no authenticated request, no reproduction attempt** |
| **live_authority** | **`none`.** You change nothing on the machine and nothing in the running system. **You do not fix this** |
| **acceptance_property** | **A brief that answers Warwick's question — "why have we regressed" — with a cause supported by evidence, an explicit statement of what remains unestablished, and a recommendation of the SMALLEST change that restores the property. If the evidence does not support a single cause, the brief says so and ranks the candidates by the evidence for each** |
| **veritas_gate** | none — this is an investigation brief, not a phase boundary. **It asserts no capability and closes no gate** |
| **integration_owner** | Larry · **document_impact:** the map (Larry records it, not you) · **out_of_scope_policy:** report-only |
| **operational_handoff** | none |
| **blocking_dependencies** | ~~blocking~~ → **PARTIAL dependency, corrected by Amendment 1 (A-3).** `WO-2026-08-05-10` (Mack) supplies executable evidence you cannot gather. **It blocks Q-2 and the install-delta half of Q-3 ONLY. Everything else is unblocked now** |
| **worker_contract** | ~~`Team/Pax - Senior Researcher/AGENTS.md`~~ → **`Team/Pax - Researcher/AGENTS.md`** @ the governance head (Amendment 1, A-5) |
| **machine_surface** *(added by Amendment 1, A-2 — READ-ONLY)* | **`C:\Users\Buggly\.mypka\**`** — the installed governor copy and its siblings. **Read-only. You hold no `Bash`; `Read`/`Grep`/`Glob` is the whole grant here** |
| **contract_basis** | Warwick named you by name. Cross-source verification before action is your seam |
| **contract_conflicts** | **⚠️ DECLARED: you hold `Read, Write, WebFetch, WebSearch, Grep, Glob` and NO `Bash`.** You cannot run a command, list a process, or read `git log`. **This is why Mack is paired with you.** If you find you need executable evidence Mack did not supply, **name it precisely and return — do not approximate it** |
| **return_to** | Larry |

## The question — his, and it is the whole order

**Honcho oriented a fresh Larry correctly at the Phase 1 → Phase 2 respawn. It did not orient this session properly. Why did it regress?**

The nuance that makes it worth investigating rather than just fixing: **it did not fail cleanly.** The session was still oriented — by the *local cached* focus and a Deliverables sweep. So a degraded fallback masked a failed primary. **A failure that still looks like a success is the more dangerous of the two, and it is the exact failure class W-1 and N-2 exist to prevent.**

## What is NOT in scope — read this before planning

- **Do NOT reopen Phase 2.** Warwick was explicit. Phase 2 is CLOSED, PASSED and MERGED. Your brief records what its acceptance did and did not establish; **it does not re-litigate the gate, re-review the receipt, or propose re-running Veritas on it.**
- **Do NOT fix anything.** No patch, no config, no reinstall, no recommendation dressed as an instruction.
- **Do NOT propose a new mechanism.** The regrowth cap is at full force and has been applied four times in this build. **A new checker, validator, monitor, registry, control plane, role or document family is a rejected diagnosis.** Warwick's verbs are **remove, shorten, combine, change.**
- **Do NOT open a Work Order.** A finding is an observation, not an instruction.

## The four questions the brief must answer

| # | Question |
|---|---|
| **Q-1** | **What exactly failed?** Separate the two things that are being conflated: the **remote Honcho read** (which aborted) and the **local continuity store** (which is ~12 h stale and served the fallback). Establish whether these are one fault or two independent ones. |
| **Q-2** | **What was different at the Phase 1→2 respawn?** That respawn worked. Identify, from the Git history Mack supplies and from the documents, **what changed between then and now** — code, install, hook registration, store content, or the session's own conditions. **A regression has a delta; name it or say you could not find it.** |
| **Q-3** | **Did Phase 2's own work cause it?** The uncomfortable candidate, recorded now so it cannot be quietly dropped: Phase 2 shipped a **write-authority race guard** (session-start-time comparison) and a **machine-level install**. Either could suppress a write or execute stale code. **Test this first, precisely because it is the inconvenient answer.** |
| **Q-4** | **What did Phase 2's acceptance actually establish, and what did it miss?** Warwick's stated real acceptance was *"after merge, Warwick starts a fresh Larry and tests whether he can orient and carry on."* That test has now run and returned a degraded result. **Establish why the Veritas PASS at `abb9892` did not catch this** — whether the gate asked the wrong question, measured through the wrong instrument, or was correct and the fault arrived afterwards. **All three are acceptable answers. Fabricating a tidy one is not.** |

## Evidence sources

- **`Deliverables/proofline/EVIDENCE-2026-08-05-honcho-regression.md`** — Mack's live evidence. **Arrives after you start; do not wait to begin the documentary half.**
- `Deliverables/2026-08-05-veritas-phase2-gate-receipt.md` — what the gate actually proved.
- `Deliverables/2026-08-05-veritas-rotation-readiness-receipt.md` and `-discharge-receipt.md`.
- `Deliverables/proofline/EVIDENCE-2026-08-05-wo-07-honcho-install.md`, `-continuity-write-authority.md`, `-wp-2b2-honcho-render.md`, `-wo-08-reorient-root.md`.
- `Deliverables/proofline/WO-2026-08-05-01/-06/-07/-08` and their amendments.
- `tools/governor/continuity.mjs`, `continuity-derive.mjs`, `reorient.mjs` and their `.test.mjs` siblings — **read the tests as evidence of what was believed to be proven.**
- The map §14.16, §14.19, §14.21.

## Method notes — earned in this build, not generic advice

1. **A negative claim requires verification.** "No log exists", "nothing writes this file" — establish absence across the canonical location, the repo and the live state, or label it unestablished.
2. **Measure through the enforcing mechanism.** If a test asserts the brief renders, establish whether it asserted through the **installed** path or a fixture. **"Proven under a fixture" is never "proven"** — and this build has already shipped one pure install-delta defect where the code was right and the installed copy was wrong.
3. **State what was PROVEN, not what it implies.** Write the scope beside every verdict.
4. **Larry's account is a source, not a finding.** Everything in `WO-2026-08-05-10`'s "what Larry has observed" table is a claim to verify.

## Required output — one file, and keep it proportionate

`Deliverables/2026-08-05-pax-honcho-regression-brief.md`, containing:

1. **The answer to Warwick's question in the first three sentences.** He should not have to read to the end.
2. Q-1..Q-4, each with its evidence and its confidence.
3. **What remains UNESTABLISHED**, named explicitly.
4. **The smallest change that restores the property** — remove/shorten/combine/change. **A recommendation, not a Work Order, and Larry decides its fate, not you.**
5. **What this means for Phase 3** — this failure is direct input to §15.3c/§15.3d.

**Proportionate to a personal hobby brain.** Warwick's Phase 3 North Star binds you too: *"The process exists to ship trustworthy products quickly, not to produce immaculate paperwork about why they have not shipped."* **A brief longer than the fix is itself the defect under investigation.**

## Read-back required before you act

Restate: the outcome, your plan, what this order failed to settle, and what looks wrong with it. **Then hold.** Five of seven Work Order refusals in Phase 2 were surface or authority defects in Larry's orders — challenge this envelope properly, including the tool-grant conflict declared above.

---

# AMENDMENT 1 — 2026-08-05, Larry. Issued in response to Pax's `CLARIFY`

**All four clarifications are answered. The read-back was correct on every point and produced a hypothesis better than either the order named. One further fresh read-back is permitted (root `CLAUDE.md`); after that, proceed unless an ACTIVE in-scope blocker remains.**

| # | Pax asked | Settled |
|---|---|---|
| **A-1** | Confirm the Q-4 reading — scope statement, not gate re-litigation | ✅ **Your reading is exactly right and is now the order.** Q-4 asks **what question the Phase 2 gate covered**, and therefore what its PASS did and did not establish. **You do NOT re-read the receipt for correctness, do NOT judge the verdict, and do NOT assess whether Veritas performed properly.** If answering Q-4 requires any of those, the answer is *"that would reopen Phase 2, which Warwick forbade"* — write that and move on |
| **A-2** | Grant or refuse read-only `machine_surface` | ✅ **GRANTED, read-only: `C:\Users\Buggly\.mypka\**`** — widened past `governor/` deliberately, because a log or artefact one directory over would otherwise produce a true-but-misleading "not found". Added to the envelope above. **`C:\.fusion247\**` remains barred; `private_surface` stays `none`** |
| **A-3** | Documentary-first, or hold for Mack | ✅ **Documentary-first. Start now.** Deliver the brief with Q-2 and the install-delta half of Q-3 **labelled UNESTABLISHED by name and reason** — never approximated. **You will then be resumed once with Mack's evidence to complete them.** Warwick said *immediately*; a partial honest answer now beats a complete one later |
| **A-4** | Are Honcho status/incident pages admissible | ✅ **YES.** Public status, incident and changelog pages are documentation of the service. **Still barred: any call to Warwick's own instance, any authenticated request, any reproduction attempt** |
| **A-5** | `worker_contract` cites a path that does not exist | ✅ **Class-A, upheld.** Verified: `Team/Pax - Researcher` exists, `Team/Pax - Senior Researcher` does not. Corrected in the envelope |
| **A-6** | `blocking_dependencies` says both "blocking" and "begin immediately" | ✅ **Upheld — the field misdescribed itself.** Corrected to a PARTIAL dependency naming exactly which questions it gates |
| **A-7** | `capability_evidence` absent | Noted, **non-blocking** as you assessed. `contract_conflicts` discharges it substantively |

## 🎯 A-8 — Your third hypothesis is ADOPTED into the order, and it outranks both of mine

**Q-3 now names THREE candidates, not two.** Yours is listed first because it is the only one that explains the exact observed string:

| | Candidate | Status |
|---|---|---|
| **Q-3a** ⭐ | **A fixed 9 s read timeout meeting a dataset that Phase 2's own pagination repair (§14.12) grew.** `READ_TIMEOUT_MS = 9000` at `continuity.mjs:45`; the sole `ctrl.abort()` at `:111`; `"This operation was aborted"` is Node/undici's `AbortError` text | **Larry independently verified lines 45 and 111 by execution.** Test this FIRST |
| Q-3b | The write-authority race guard (session-start-time comparison, `d49b1dd`) suppressing the write | Larry's original candidate |
| Q-3c | The machine-level install executing stale code | Larry's original candidate |

**Why A-8 changes the shape of the answer, and you should follow it wherever it leads:** if Q-3a holds, **this is not a correctness regression at all** — it is a fixed constant meeting a grown dataset, with no code defect anywhere. **The smallest change then concerns how loudly the fallback fails, not the read.** That is a materially different recommendation from "fix the bug", and it is allowed to be the answer. **Do not privilege a tidier story.**

Also carry forward, since you established it and it stands: **the degraded-fallback-masking-a-failure behaviour is by design in shipped code** (`continuity.mjs:931-933`), and **the missing-credential hypothesis is excluded by message discrimination** (`:109` throws a distinct string Warwick did not see). Both are load-bearing and both were produced under the un-amended order.
