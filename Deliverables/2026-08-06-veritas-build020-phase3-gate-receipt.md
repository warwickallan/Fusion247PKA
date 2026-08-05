---
build: BUILD-020
scope: phase-3
gate: 2
reviewed_sha: 6858327aad727d0fcc8ec4d55cfb5933bc9c2b08
governance_sha: 6858327aad727d0fcc8ec4d55cfb5933bc9c2b08
branch: build-020/phase3
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA-build-020-trial/5a984703-5aed-4152-93eb-45dfc74cdae9/scratchpad/vx
worktree_head_at_start: 6858327aad727d0fcc8ec4d55cfb5933bc9c2b08
worktree_head_at_end: a78f62edb506a7e0fc41164584c781702fc56408
worktree_status_clean: true
worktree_head_unchanged: false
verdict: HOLD
receipt_sha256: 62834ff1a9ef8592250211d708543d89c88d4b2cdf0eb1a38e3a4243c263d88c
reviewed_by: veritas
reviewed_date: 2026-08-06
next_review_trigger: a new exact integrated head at which a fresh-session reorient.mjs execution returns a resolved map_path and a current Phase-3 frontier
---

## Scope reviewed

**Scope Veritas determined**, which is wider than the dispatch on one point and narrower on another.

**In scope:** the Phase 3 promise at `Deliverables/2026-08-04-proofline-wayfinder-plan.md` §16.2 (AC-1 to AC-4) · WP-3A `tools/governor/continuity.mjs` · WP-3B `tools/governor/footer.mjs` · WP-3E the machine install at `~/.mypka/governor/` · WP-3G `tools/wo/envelope.mjs` · WP-3D `Deliverables/BACKLOG.md` · the `CLAUDE.md` footer-retirement constitutional edit · map §16.

**Widened, and why.** The dispatch framed AC-1/AC-2/AC-4 as "provable only after rotation — assess reachability only". Reachability of AC-1 is testable *now* by executing the installed production read path, and Veritas executed it rather than inferring it. That execution produced the blocking finding below. **An acceptance property that can be tested is not deferred to Warwick's observation.**

**Not reviewed, deliberately:** Codex's external PR gate (waived by Warwick for this merge, this occasion only — recorded, not treated as a defect) · AC-5 (§16.9, forward-looking by construction, cannot accrue in this phase) · the `MessageDisplay` web/Android question (closed by Warwick) · anything under `C:\.fusion247\**` (no declared private surface) · **commit `a78f62e` and `.claude/commands/rotate.md`, which landed on the branch DURING this review and are outside `reviewed_sha` — see the provenance note below.**

## Evidence provenance

- Isolated export of `reviewed_sha` at `…/scratchpad/vx`, created with `git archive 6858327… | tar -x`. `EXPORT_OK`.
- Repository `git status --porcelain` — empty at start, empty at end. Unchanged. No repository file was modified by this review.
- `git branch -r --contains 6858327…` → `origin/build-020/phase3`. **The head is remotely reachable**, so `PASS` is not barred on durability grounds.
- The export was given its own `git init` (inside the export only) so that git-dependent control tests could run. No repository `.git` state was touched. No mutation was applied to the repository.
- **Live-state reads** (`~/.mypka/governor/**`, the Honcho store) are outside any export by nature. They are recorded as live observations and labelled as such.

**⚠️ THE WORKING-TREE HEAD MOVED DURING THIS REVIEW, and that is recorded rather than hidden.**
`git rev-parse HEAD` at start — `6858327aad727d0fcc8ec4d55cfb5933bc9c2b08`. At end — **`a78f62edb506a7e0fc41164584c781702fc56408`** ("Restore /rotate as the single pre-/clear transaction. Warwick, 2026-08-06"), adding `.claude/commands/rotate.md` and one line to the map. **They are NOT equal, and the template requires them to be.** Assessed rather than waved through: **all code and test evidence above was executed inside the `git archive` export of `6858327…`, which is immune to the move**, and all live-runtime evidence concerns `~/.mypka/**` and Honcho, which the commit does not touch. The single probe that used the repository as `cwd` (`resolveActiveMapPath`) is unaffected — the new commit changes no path this resolver reads. **This receipt's verdict is bound to `6858327…` and to nothing else.** The move is nonetheless a real breach of evidence isolation discipline: **Veritas holds no authority over the git lifecycle and cannot prevent a commit landing under it, so a clean read-back of this property depends on Larry not committing to the branch while a review is in flight.** Recorded as D-6.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git diff --stat origin/main..HEAD -- "Team/Nolan - HR/AGENTS.md" "Team Knowledge/SOPs/SOP-022*" "Team/agent-index.md" ".claude/agents/nolan.md"` | 0 | n/a | **Empty. ZERO change to all four paths — the Nolan revert is confirmed by execution, not by Larry's account.** |
| `git diff --name-only origin/main..HEAD \| grep -iE "nolan\|SOP-022\|agent-index"` | 0 | n/a | Four matches, all under `Deliverables/` (a Pax brief, a WP-3F evidence file, two Work Orders). **No governing contract, SOP, index or shim is modified.** |
| `node --test tools/governor/{footer,continuity}.test.mjs tools/wo/envelope.test.mjs` (export, no git) | 1 | 215 run, 207 pass, 8 fail | 8 failures |
| same, after `git init` inside the export | 1 | 215 run, **211 pass, 4 fail** | 4 remaining failures, all map-pointer resolution |
| `node probe.mjs` — the **exported** `continuity.mjs` invoked against the **real repository** | 0 | n/a | `resolveActiveMapPath` returns `Deliverables/2026-08-04-proofline-wayfinder-plan.md` **from the repo root AND from `tools/governor/`**; `buildPacket().map_path` carries it. **The 4 failures are artefacts of the synthetic export repo (`origin/main..HEAD` is empty there), NOT product defects.** |
| `sha256sum ~/.mypka/governor/<f>.mjs` vs `git show 6858327:tools/governor/<f>.mjs \| sha256sum`, all 8 installed modules | 0 | 8 | **8/8 MATCH.** The installed runtime is byte-identical to `reviewed_sha`. |
| `echo '{…}' \| node ~/.mypka/governor/statusline-live.mjs` (the host statusLine route) | 0 | n/a | `⟦GOV⟧ ctx -- · BLIND · NO ADVICE · next: UNSET · CONTINUE`. **BLIND is the correct, honest output for a synthetic session with no transcript** — it renders no number it did not measure. |
| `grep statusLine ~/.claude/settings.json` | 0 | n/a | `node C:/Users/Buggly/.mypka/governor/statusline-live.mjs` — the terminal route CLAUDE.md now names is really registered. |
| `echo '{…"source":"startup"}' \| node ~/.mypka/governor/reorient.mjs` — **the AC-1 primary journey** | 0 | n/a | **`MAP POINTER WITHHELD BY THE WRITER`. No map path, no focus, no frontier. See D-1.** |
| `node ~/.mypka/governor/continuity.mjs read --json` | 0 | n/a | Latest is `cont-…-154-kk2grt`, `reason: "stop"`, `2026-08-05T23:05:15Z`, no `map_path`. `focus` and `immediate_objective` are correct Phase-3 text; `accepted_decisions`, `completed` and `blockers` are **stale BUILD-015/AsdAIr content** (see D-2). |
| `cat ~/.mypka/governor/continuity-last.json` | 0 | n/a | **`154`.** Larry's `UNESTABLISHED` observation (map §16.10) is **RESOLVED by execution: the marker does advance, on the `stop` path.** Seq file reads `155`. |
| `node -e` arithmetic on the WP-3G replay | 0 | n/a | `11/41 = 26.8%` (~27%), `8/13 = 61.5%` (~62%). **The arithmetic and the two distinct units — defects prevented vs orders touched — are correct as reported.** |
| `grep -i asdair Deliverables/BACKLOG.md` | 0 | 3 | All three are in the **why-removed** table with a stated reason. WP-3D removed them *with a record* rather than silently. 15 candidates `C-1`…`C-15` retained. |
| `grep -rn "dispatched specialist running \`footer.mjs\`\|pastes those exact bytes\|⟦GOV⟧ footer" --include=*.md` | 0 | 12+ | Residual instructions survive the retirement in `.claude/agents/thin-larry.md:48,50` and `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md:144,182`. See D-3. |

**Not executed, and named rather than smoothed over:** a `GREEN` measured statusline render against a real live transcript. Mack's evidence records `ctx 44% (440.1k/1000k) · GREEN`; Veritas reproduced only the `BLIND` branch, because a synthetic session has no transcript to measure. **The measured-figure path is builder evidence, not Veritas evidence.**

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | AC-3 is met and AC-4's input is clean. **AC-1 fails when executed**: the installed production read path supplies neither the map nor the frontier (D-1). AC-2 depends on AC-1. |
| Design fidelity | **PASS** | The write-authority guard is deliberate, documented, and names its own limitations in-source (`continuity.mjs:560-590`). It is one extra call site on an existing `readLatest`, not a new mechanism — the regrowth cap holds. The `CLAUDE.md` edit is a faithful, in-scope discharge of Warwick's verbatim instruction: it retires the route, keeps the terminal display, preserves the three honesty rules and the frozen `HANDBACK_CODES`, and records *why* so it is not rebuilt. **It corrects a previously false claim ("no hook can render this footer, and none ever will") rather than quietly dropping it.** No authority was widened and no new mechanism was created. |
| Functional proof | **HOLD** | The statusline journey executes and degrades honestly. **The continuity journey executes and returns no map and no frontier** (D-1). The measured-figures branch is unreproduced by Veritas. |
| Integration | **PASS** | 8/8 installed modules byte-match `reviewed_sha`. `statusLine`, `SessionStart`→`reorient.mjs` and `Stop`→`continuity.mjs stop` are all registered at user level. The code is genuinely on the machine path, not merely in the repo. |
| Durability | **PASS** | Packets persist across process boundaries and are re-read from a separate process. `continuity-last.json` advanced 152→154, which **supersedes** the map's recorded `UNESTABLISHED`. Rollback was executed by WP-3E on a file with a real delta. |
| Test quality | **PASS** | 215 subtests, non-zero and real. Mutation tests present and passing (`MUT-1`…`MUT-8`), including the important ones — a suppressed incompleteness notice, a permissive default when the grant is unknown. The suite carries explicit anti-stub **CONTROL** tests asserting the default seams read real git; those controls are what failed in the synthetic export, which is the controls working correctly. |
| Git truth | **HOLD** | Branch, head and scope report accurately, the head is remotely reachable, and **the parked Nolan proposal is fully reverted — verified by execution against all four named paths, as requested.** Held only because **the branch head advanced under the review** (D-6), so the template's `worktree_head_at_start == worktree_head_at_end` property cannot be shown true. |
| Documentation truth | **PASS** *(with non-blocking findings)* | `CLAUDE.md` is internally consistent after the edit. The map §16.10 honestly records the design defect and the unestablished marker. **Larry's disclosed limitations were all true and one of them was pessimistic** — the marker does advance. Residual retired-footer instructions (D-3) and a self-declared-untrue paragraph (D-4) do not misdirect the current frontier and are parked. |
| Residual risk | **PASS** | Every limitation Larry disclosed in the dispatch was true and independently confirmed: builder-only self-test, the WP-3G score and its units, the `MessageDisplay` closure. **Disclosing the 27% replay result as an output rather than dressing it up is the correct behaviour and is recorded as such.** |

## Production caller and journey

**Journey A — the statusline (AC-3). Complete and real.**
`host statusLine refresh` → `~/.claude/settings.json` → `node ~/.mypka/governor/statusline-live.mjs` → `sampler` + `footer.mjs` + `evaluator` → one line on stdout. **No model is on this path.** AC-3's "substantially reduced measured cost" is satisfied structurally rather than by optimisation: the ~79k-token subagent render is not made cheaper, it is *removed*. That is the stronger answer, and the `CLAUDE.md` edit is what makes it legal.

**Journey B — fresh-session orientation (AC-1/AC-2). Executes end to end, and arrives empty.**
`host SessionStart` → `node ~/.mypka/governor/reorient.mjs` → `continuity.readContinuityBrief` → Honcho → packet 154 → render. Every hop is real and wired; the location probes are accurate (branch, HEAD, clean, upstream, 0 unpushed). **The journey completes and delivers no map path and no frontier**, falling back to a display-capped list of 98 loose deliverables explicitly labelled "NOT complete".

**Journey C — the Work Order envelope (WP-3G).** `tools/wo/envelope.mjs` is a new module with a passing suite. **Its production caller is Larry's own future dispatch discipline, not code.** Recorded as such: it is a tool on a human route, and no automated caller exists or was claimed.

## Restart and durability

Kill-and-revive satisfied by construction: every continuity observation above was made from a **separate process** from the one that wrote packet 154. The packet, the sequence file and the last-delivered marker all survived process death and were read back correctly. WP-3E's rollback was executed rather than documented, on `footer.mjs`, a file carrying a real delta — so the test is not a tautology.

## Documentation contradiction scan

- **Larry's declared impact:** `CLAUDE.md` footer retirement · map §16 · `BACKLOG.md` · the WP evidence files.
- **Verified independently:** the `CLAUDE.md` edit is faithful and self-consistent; `HANDBACK_CODES` survives; the map's §16.10 disclosures are accurate.
- **What his list missed:** (a) `.claude/agents/thin-larry.md:48,50` still instructs the retired specialist-rendered footer route, and Warwick's instruction was to remove *"any instruction requiring it"*; (b) `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md:144,182` still carries live footer obligations, and that file is *actively referenced* by `CLAUDE.md` §Wayfinder as the verbatim source of the startup block; (c) `~/.mypka/governor/INSTALLED-FROM.txt` contains a paragraph its own next line declares untrue.
- **Active documents that would misdirect a fresh instance:** none on the current frontier. `thin-larry.md` is not bound (Rule 4 records the binding as removed on purpose), so it is dormant.
- **Closure claims since the last receipt, and the receipt behind each:** Phase 2 PASS → `Deliverables/2026-08-05-veritas-phase2-gate-receipt.md` (present, at `abb9892`). **No Phase 3 completion, closure or PASS claim is asserted anywhere at this head.** Larry's language throughout is "integrated and submitted". **No false completion claim found.**

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| **D-1** | **BLOCKING** | **The map pointer is withheld on every `stop`-path write from a session that started before the last stored write — which is every remaining write from the current pre-rotation session.** Packet 153 (manual `write`, no `sessionStartedAt`, guard bypassed) carried the correct map path and Larry read it back. Packet 154 (`stop`, eight minutes later) withheld it. Latest-wins semantics mean the good pointer is now unreachable. **Executed just now, the fresh-session journey returns no map and no frontier.** The guard is behaving exactly as designed (`continuity.mjs:633-658`) — the defect is that its design makes AC-1 unreachable by the default route, because the Stop hook fires at the end of every turn and will supersede any manual packet whose semantic state differs. **Blocks: recording Phase 3 PASS, and rotating on the assumption that AC-1 will hold.** The escape is documented and real — a manual `node continuity.mjs write` publishes the pointer — but it is only durable if no differing `stop` packet lands after it. **`map_path_withheld` is part of `packetContentHash` by design, so a manual pointer-carrying packet and the Stop packet that follows it differ in content and the dedupe will NOT suppress the Stop write.** That is the trap, and it is unverified in either direction. | Larry |
| **D-2** | non-blocking | Packet 154's `focus` and `immediate_objective` are correct Phase-3 text, but `accepted_decisions`, `completed` and `blockers` are stale BUILD-015/AsdAIr content ("No Veritas verdict PASS exists", "Three Gate 3 reviews, three HOLDs", "the asdair suites", "Silas's migration-015"). Presented as current they would misdirect; **they are not currently surfaced by the withheld-pointer render**, which is the only reason this is not blocking. It becomes blocking the moment D-1 is fixed without also refreshing these fields. | Larry |
| **D-3** | non-blocking | Retired-footer instructions survive in `.claude/agents/thin-larry.md:48,50` and `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md:144,182`. Warwick's instruction included *"remove … any instruction requiring it"*. `thin-larry` is unbound and the reset plan is a superseded map, so neither misdirects the current frontier — parked to the scheduled reconciliation. | Larry |
| **D-4** | non-blocking | `~/.mypka/governor/INSTALLED-FROM.txt` `settings:` paragraph is false and is loudly self-declared false on the following line, with the correction assigned to candidate C-15. **This is the correct handling of a defect an install did not cause** — recorded so a successor review does not re-raise it as new. | Larry |
| **D-5** | non-blocking | `tools/wo/envelope.mjs` has no automated production caller; its route is Larry's dispatch discipline. Correctly *not* claimed otherwise anywhere at this head. Recorded so no future document upgrades it to "enforced". | Larry |
| **D-6** | non-blocking | The branch head advanced from `6858327…` to `a78f62e…` **during** this review, so the mandatory `worktree_head_at_start == worktree_head_at_end` property is false. Evidence integrity is unaffected (all code evidence ran inside the archive export; the new commit touches no path any probe reads), but the property cannot be shown true and is not claimed. **Committing to a branch while its assurance review is in flight defeats a control Veritas cannot itself enforce.** | Larry |

## Verdict

**HOLD** — the build is substantially correct, honestly evidenced and cleanly integrated, and the Nolan revert, the machine install and the constitutional edit all verify; but **AC-1 was tested rather than assumed, and the installed production path currently supplies a fresh session with neither the active map nor the frontier**, which is an unresolved mandatory acceptance property and therefore a HOLD, never a qualified pass.

**What this HOLD gates, and only this:** recording Phase 3 as PASS or complete, and closing the phase. It does **not** invalidate the work, does not block the merge decision if Warwick wants the code on `main`, and does not transfer the frontier to Veritas. **One blocking finding, D-1. Corrective scope is narrow — publish a pointer-carrying packet that survives the final Stop, and refresh the stale fields in D-2 at the same time. Everything else here is parked.**

**One forward-looking note, offered because it is directly on the blocking finding and would be dishonest to omit.** `.claude/commands/rotate.md`, added at `a78f62e` **after** `reviewed_sha` and therefore **not reviewed here**, prescribes exactly the manual `~/.mypka/governor/continuity.mjs write` route plus a mandatory read-back matching map path, frontier and next action. **That addresses D-1's publication half.** It does not, on its face, address the last-writer problem — the Stop packet that lands after `SAFE TO CLEAR` — and this receipt makes no claim in either direction about whether it does.

**Said plainly, because it is the fairest summary available:** the phase built the right things and reported them honestly, including a result that made itself look bad. What it has not yet done is put the map in Warwick's fresh session, and that is the one thing Phase 3 promised.

## Next review trigger

A new exact integrated head at which a fresh-session `reorient.mjs` execution returns a resolved `map_path` and a current Phase-3 frontier, **with the branch quiescent for the duration of the review**. **A read-back by the writing session is not that evidence** — the check is the `stop`-path packet that lands last.
