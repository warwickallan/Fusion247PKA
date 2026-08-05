---
build: BUILD-020
scope: phase-3-D-1-corrective-recheck
gate: 2
reviewed_sha: f542de0c5cba9f2712eaf3dfa6c09b23204cee21
governance_sha: f542de0c5cba9f2712eaf3dfa6c09b23204cee21
branch: build-020/phase3
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA-build-020-trial/5a984703-5aed-4152-93eb-45dfc74cdae9/scratchpad/d1export (git archive) + .../d1clone (read-only clone, for the six real-git tests an archive cannot run)
worktree_head_at_start: f542de0c5cba9f2712eaf3dfa6c09b23204cee21
worktree_head_at_end: f542de0c5cba9f2712eaf3dfa6c09b23204cee21
worktree_status_clean: true
worktree_head_unchanged: true
verdict: D-1 DISCHARGED (addendum to the HOLD receipt at 6858327; that HOLD is NOT upgraded)
receipt_sha256: e1c766c1792dd1513fd334c36b6070d521a8c8bc952d71aeff0bccee0d8a983e
reviewed_by: veritas
reviewed_date: 2026-08-06
supersedes: none — addendum to Deliverables/2026-08-06-veritas-build020-phase3-gate-receipt.md
next_review_trigger: Larry submitting an exact integrated head for a Phase 3 gate verdict, with D-2 cleared
---

## Scope reviewed

**D-1 only.** The single blocking finding from the Phase 3 gate receipt at `6858327` — the write-authority guard withheld `map_path` on every `stop` packet for the life of a long-running session, because `priorWriteMs` advances on that session's own writes.

Three questions, and nothing else:

1. Is D-1 discharged at `f542de0`?
2. Does the cross-session protection survive the fix?
3. Did the three inherited fixture corrections weaken any proof?

**Deliberately NOT reviewed:** D-2..D-6 (parked, not reopened) · the Phase 3 journey as a whole · any other Work Package · installation state (`~/.mypka/**`). **This addendum does not upgrade the `6858327` HOLD verdict** — that receipt stands as written. It discharges one blocking finding at a new head.

## Evidence provenance

- `git archive f542de0…cee21 | tar -x` into `…/scratchpad/d1export`. Suite there: **106/112**, six failures, all git-dependent (`MAP POINTER CONTROL` ×2, `PRODUCT PATH` ×2, `D CONTROL`, `D: the DEFAULTS are real`). **An archive export is not a git repository**, so tests that deliberately read REAL git cannot run in one. Recorded rather than smoothed over.
- To execute those six, a **read-only `git clone --no-hardlinks` of the repository** into `…/scratchpad/d1clone`, detached at `f542de0…cee21`. A clone is not a `git worktree`: it registers nothing, creates no branch in the reviewed repository and mutates no `.git` state Larry owns. All mutation testing happened inside the clone.
- `sha256 tools/governor/continuity.mjs` = `714cd05b86496d7d96c6b72ffeb2a9b688ba8023c8439772ce3a6af1e8d73e36` in both export and clone — **matching the digest Keel published**, so the source under test is the source Keel claims.
- Repository `git rev-parse HEAD` at start and end — `f542de0c5cba9f2712eaf3dfa6c09b23204cee21`, identical. `git status --porcelain` — **0 lines**, start and end.
- `git ls-remote origin build-020/phase3` → `f542de0…cee21`. The head is remotely reachable.
- Mutations restored; digest re-verified `714cd05b…d73e36` after the last one.

## Evidence executed

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test tools/governor/continuity.test.mjs` (archive export) | 1 | 112 | 106 pass / 6 fail — **all six are real-git tests; an archive is not a repo.** Isolation artefact, not a defect. |
| `node --test tools/governor/continuity.test.mjs` (clone @ `f542de0`) | 0 | 112 | **112 / 112.** Keel's headline claim confirmed. |
| `node --test` × 9 neighbour governor modules (clone @ `f542de0`) | 0 | 331 | **331 / 331.** Keel reported 318/318 from his own worktree; at the integrated head the same command executes **331**. More tests, all green — a count difference from integration, not a discrepancy in kind. |
| **RED-FIRST REPLAY** — `git show bc1ada3:tools/governor/continuity.mjs` over the source, post-fix test file retained | 1 | 112 | **109 pass / 3 fail — exactly `not ok 108`, `109`, `111`.** |
| **VERITAS-M12′** (my own over-fix: `if (priorSession === null) return null;` → `return null;`, publishing unconditionally once authority is established) | 1 | 112 | **107 pass / 5 fail** — killed by `WRITE-AUTHORITY`, `MUTATION: the session-start comparison is REAL`, `WP-3A(c) MUTATION CONTROL`, `AMD2 CROSS-SESSION PROTECTION UNCHANGED`, `AMD2 THE DISCRIMINATOR IS IDENTITY, NOT TIME`. |
| **VERITAS-M13′** (my own: `if (!current.latestIsAuthoritative) return WITHHELD_AUTHORITY_UNESTABLISHED;` deleted) | 1 | 112 | **111 pass / 1 fail** — killed by `AMD2 THE FAIL-OPEN PATH STAYS CLOSED`. |
| `git diff eceabbe^ eceabbe -- tools/governor/continuity.test.mjs \| grep -E "^[+-].*assert"` | 0 | n/a | **Zero `-assert` lines.** Every `+assert` line traces to one of the five NEW tests. |

## The three questions

### 1. Is D-1 discharged? — YES

The red-first replay is the proof, and I executed it rather than reading Keel's transcript of it. Pre-fix source + post-fix tests fails **exactly** `108`, `109`, `111` — the three Keel named, no more and no fewer. Post-fix, 112/112. The regression at `108` asserts the observable AC-1 outcome I actually measured live at `6858327`: after the `stop`, `readContinuityBrief` renders `likely active map: …` and **not** `MAP POINTER WITHHELD`.

The fix reads `session_id`, which `buildPacket` already stamped and nobody consulted. No new field, no new call, no new mechanism — this is a correction inside the regrowth cap, not around it.

### 2. Does the cross-session protection survive? — YES, and the claim was worth testing rather than accepting

Keel's argument was that `AMD2 CROSS-SESSION PROTECTION UNCHANGED` and `AMD2 THE FAIL-OPEN PATH STAYS CLOSED` were green pre-fix and stayed green, so the protections rest on nothing the fix moved. **My replay confirms it directly**: both were green against `bc1ada3`'s source and are green at `f542de0`.

But "green in both directions" is also what a **vacuous** test looks like, and that is exactly the shape a weakened proof would take. So I did not stop there. I wrote my own over-fix — **M12′** — and it is killed by **five** tests including `CROSS-SESSION PROTECTION UNCHANGED` itself. A guard that publishes unconditionally does not survive this suite. The protection is live, not decorative.

**M13′** independently confirms the ordering claim: delete the authority gate and `THE FAIL-OPEN PATH STAYS CLOSED` goes red on its own. Identity sits **behind** authority, and a test holds it there. This is the property I was most concerned the fix would quietly invert, and it did not.

### 3. Did the fixture corrections weaken anything? — NO, and this is now proven rather than argued

`WRITE-AUTHORITY`, `MUTATION: the session-start comparison is REAL` and `WP-3A(c) MUTATION CONTROL` each gained one identity field. Keel's statement — *no assertion changed, removed, relaxed or inverted* — verifies on two independent axes:

- **Textually:** the test diff contains **zero removed or modified `assert` lines**. The eight deleted lines are option-object and fixture-literal lines only.
- **Behaviourally, which is the axis that matters:** all three still **kill M12′**. A fixture edited to hide a weakened proof would have gone quiet under an over-permissive guard. These three got louder. They also remain green under the *pre-fix* source with the new fixtures, so the edits changed no outcome in either the old or the new code — they described a shape (`session A` with no session identity) that the test names always claimed and the fixture never told the code.

This was the cheapest place to hide a regression and nothing is hidden there.

## The accepted limitation — I accept the trade

A genuinely stale session closing after a **manual** write can now displace that manual pointer, because an unattributed packet carries no fact distinguishing "typed this session" from "typed another". Weighed:

- **What is given up** is a protection that requires three coincidences at once: a manual pointer write, a genuinely older session still alive, and that session firing `stop` afterwards.
- **What is bought** is the ordinary case. The shipped behaviour withheld the pointer on **every `stop` of every ordinary session after its first** — not an edge case, the normal one. Packet 154 was not bad luck; it was the design working as written.
- **The worst case is bounded, and I verified the mechanism rather than taking it on trust.** `mapPathPresentHere` gates the render at read time (`continuity.mjs` ~L1132); a recorded path absent from the reader's checkout renders honest absence and states the path is *"NOT to be opened on trust"*. Where a displaced path does exist locally, root `CLAUDE.md` Step 2 already binds the brief as a **pointer with zero authority** that the map self-corrects.

**Trading a guaranteed failure of the normal path for a three-coincidence failure of a documented manual escape, with an honest-absence floor underneath it, is the right trade.** It is correctly classified as a limitation and not a defect, and it is disclosed in the source comment where a future editor will meet it.

## Assurance dimensions — D-1 scope only

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | D-1 as recorded at `6858327` is closed; the live sequence I measured is asserted in test 108. |
| Design fidelity | PASS | Authority checks first and unmoved, proven by M13′. One previously-unread field; no new mechanism. |
| Functional proof | PASS | Red-first replay reproduced exactly; 112/112 post-fix. |
| Integration | PASS | `sessionId` wired from the existing `writeContinuity` call site; 331/331 across the governor set at the integrated head. |
| Durability | n-a | No durability property changed by this corrective. Covered in the `6858327` receipt. |
| Test quality | PASS | Two independent Veritas-authored mutations both killed; three edited fixtures demonstrably still kill M12′; no assertion removed. |
| Git truth | PASS | `f542de0…cee21` on `build-020/phase3`, remotely reachable; digest matches Keel's published digest. |
| Documentation truth | n-a | Not re-reviewed; outside this narrow scope. **D-2 remains open and Larry owns it.** |
| Residual risk | PASS | The one limitation is named, bounded, and has an honest-absence floor I verified in code. |

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| A-1 | non-blocking | The published neighbour-set count (318) is the branch-worktree figure; the integrated head executes 331. Both green. Record once at the scheduled reconciliation. | Keel / evidence file |
| D-2 | **still open, unchanged** | Packet 154's `accepted_decisions`, `completed` and `blockers` carry stale BUILD-015 content, hidden only by the withheld pointer. **Discharging D-1 makes it visible.** Not re-reviewed here; Larry has stated he will clear it in the rotation packet. This addendum does not discharge it. | Larry |

## Verdict

**D-1 DISCHARGED at `f542de0c5cba9f2712eaf3dfa6c09b23204cee21`. The cross-session protection SURVIVES — proven by my own over-fix mutation, not by Keel's account of it.**

This discharges one blocking finding. It is **not** a Phase 3 PASS and must not be read as one: D-2..D-6 remain parked and the `6858327` HOLD receipt stands as written.

## Next review trigger

Larry submitting an exact integrated head for a Phase 3 gate verdict, with D-2 cleared.
