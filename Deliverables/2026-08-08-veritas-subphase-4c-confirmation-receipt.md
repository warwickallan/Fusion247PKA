---
build: BUILD-020
scope: sub-phase-4c-focused-confirmation
gate: 1
confirmation_of: Deliverables/2026-08-08-veritas-subphase-4c-estate-convergence-receipt.md (receipt_sha256 4e44a73d…, HOLD at b8ca6d4)

boundary: >-
  BUILD-020 Sub-phase 4C — the ONE focused confirmation permitted by contract, bounded to the three
  blocking findings of the receipt above and nothing else. Row 2 remains NOT GRADED; estate
  convergence remains uncertified by Veritas (Codex at merge class; Larry post-merge).
  The SHAs below are PROVENANCE, not the identity of the gate.

reviewed_sha: afe2b1af2907a162e337e8e13da8f39054000988
governance_sha: b8ca6d419d9f8104c74f1edf59d55e6555ffbf01
branch: build-020/4c-estate-convergence

evidence_method: mixed — target checkout diff at afe2b1a and live runtime (re-executed convergence check)
evidence_workspace: none — read-only inspection and non-mutating execution throughout
worktree_head_at_start: afe2b1af2907a162e337e8e13da8f39054000988
worktree_head_at_end: afe2b1af2907a162e337e8e13da8f39054000988
worktree_status_clean: false
worktree_status_note: >-
  DECLARED. At start the tree carried one pre-existing modification made by another writer to the
  prior receipt; at end it carries that plus this receipt. Veritas created, modified or deleted no
  other file, ref, branch or worktree. See body section "ERRATA against the confirmed receipt".

verdict: PASS
verdict_scope: >-
  Covers ONLY the three confirmed findings, current 4C record truth, and the current capability
  claims executed here. Does NOT cover row 2 (ungraded), row 6 (post-merge by construction), or
  estate convergence certification. Does not block the merge decision; does block reporting 4C
  CONVERGED or CLOSED.
receipt_sha256: 1f96399fa51299e28efbcc98003326faf7d7b2640088847476c342061a3e0c1c
digest_note: >-
  Computed over the body bytes below this closing marker, LF line endings, as written. Recompute on
  the file as committed; core.autocrlf=true with no root .gitattributes (estate item P-10) can alter
  bytes without altering content. Tamper-EVIDENT, not tamper-proof.
reviewed_by: veritas
reviewed_date: 2026-08-08
next_review_trigger: >-
  NONE from this boundary. The permitted focused confirmation is spent. A moved SHA, a committed
  receipt, further documentation repair or the merge event itself do NOT bring this back. Post-merge
  convergence proof is Larry's lifecycle obligation; the merge-class external challenge is Codex's.
---

## Scope

**The ONE focused confirmation my contract permits**, bounded to the three blocking findings in `Deliverables/2026-08-08-veritas-subphase-4c-estate-convergence-receipt.md` (`receipt_sha256 4e44a73d…`, HOLD at `b8ca6d4`). **Nothing else was re-reviewed. No estate re-audit. No new scope.**

Unchanged from that receipt and not revisited here: row 2 remains **`n-a — NOT GRADED`** (a reviewer does not certify its own contract), and **estate convergence is not certified by Veritas** — that is Codex's at merge class and Larry's to prove post-merge.

## Finding-by-finding

### Blocker 1 (HIGH) — the Wayfinder recorded convergence as never executed → **DISCHARGED**

The defect was that the rank-2 route document and the rank-8 evidence document disagreed about whether 4C's central action had happened. **They now agree, and the route document is the one that was corrected.**

Verified at `afe2b1a` by reading the diff, not the description:

- Rows **4**, **5** and **6** re-cut against executed reality. Row 4 carries the executed convergence **and** the uncomfortable half — that Larry's first uniqueness measure was wrong, that an external review caught it, the 119 pins, the four-test re-audit. **A correction that records its own cause is the durable kind.**
- **CARRIED items 4, 5 and 7** re-cut. Item 4 (*"20 non-BUILD-020 worktrees hold genuinely unique state … Untouched"*) and item 5 (*"deliberately retained"*) were the two most misleading sentences in the block; both now read DISCHARGED with the evidence. Item 7 correctly stays **partial** — `~/.mypka/tower-backups/` is still retained and says why.
- **Row 6 is `🟠 IN PROGRESS — not yet claimed`**, listing what remains. **That is the right answer and I want it recorded as such:** the easy repair would have been to mark it done. It was not taken.

**The fresh-Larry test, which is what the finding was actually about.** `git grep` confirms the label `🎯 THE ONE CURRENT NEXT ACTION` still resolves to exactly one live heading (line 2856); the other six occurrences are pointers *to* it or struck historical text, unchanged. START/RESUME → "First safe action" → that heading → and **directly beneath it the new 📍 WHERE 4C ACTUALLY IS block**, stating executed reality, the precise outstanding list, and that nothing may be reported CONVERGED or CLOSED until they are true. **A fresh session orienting exactly as instructed now lands on the truth in one hop.** The heading rename to ESTATE RECONCILIATION & CONVERGENCE is consistent with the four-term correction and did not break the pointer.

**Residual, non-blocking:** row 3's own cell still reads *"⬜ Wording rebase onto the outcome-bound model IN FLIGHT"*, which landed at `7d739d2`. The block above it and row 6 both state the true outstanding item, so no reader is misdirected. Record it at the scheduled reconciliation; **it does not warrant another cycle.**

### Blocker 2 (MEDIUM) — the runtime evidence row over-reached → **DISCHARGED, and the correction is better than the finding asked for**

I asked for the claim to be bounded to its evidence. Warwick instead required the **check** to be widened to the claim, which is the stronger of the two available fixes.

**Executed by me at `afe2b1a`, not read about:**

| Command | Result |
|---|---|
| `powershell -File tools/governor/convergence-runtime-check.ps1` | **exit 0** · 471 processes examined · canonical refs 13 · active-candidate refs 4 · **SUPERSEDED-ROOT refs 0** · `RESULT: PASS` |
| `Get-CimInstance Win32_Process` filtered for `*build-020-trial*` and for `harness.mjs`/`crash.test.js` | **0 processes.** My counter-example — the tree alive since 2026-08-04 19:37 — is genuinely gone, proven by execution rather than by the commit message |

**The banked evidence reproduces.** My independent re-run matches `Deliverables/proofline/EVIDENCE-2026-08-08-convergence-runtime-check.txt` on every load-bearing figure; the small deltas (473→471 processes, 2→4 active-candidate refs) are ordinary churn, and the extra active-candidate refs are **my own review's processes**. A one-off screenshot would not have reproduced; this did.

**The widening is real, and it addresses the actual root cause.** Every process rather than `node.exe`; executable path, command line **and every loaded module path** rather than command lines alone; both separators. The original defect was *"the check was narrower than its claim"* — that specific narrowness is closed.

**The LIVE-dependency versus DEAD-REFERENCE distinction is correct, and I would have objected to the alternative.** PID 19748 `claude.exe` carries `--add-dir C:\Fusion247PKA-external-repair`, a path absent from disk. It names a superseded root but cannot consume bytes from it. **Reporting it, not counting it as failure, and not killing it is the right call on all three counts** — killing a 4-day-old session to make a check green would have been fabricating the evidence.

**Two residuals, both non-blocking, both recorded once:**

1. **The declared limit is honest and correctly bounded.** Process working directory is genuinely not exposed by `Win32_Process`; obtaining it needs handle enumeration this estate does not carry. Stating it in the script header **and** in the output line is the right shape, and *"a real gap, recorded, not argued away"* is the correct posture. **I accept it as declared.**
2. **One coverage gap that is NOT yet declared, and it is the same class the correction was made to fix.** The claim says *"any superseded MyPKA branch/worktree/checkout"*; the regex matches roots named `c:[\\/]fusion247pka…` or `.claude[\\/]worktrees[\\/]…`. **Superseded roots that do not carry the repository name are outside it.** Executed: `C:\tb`, `C:\audit-worktrees`, `C:\Fusion247PKA-wo-asdair-ci` and `C:\Fusion247PKA-premigration-20260807` are all absent from disk, but **`C:\Fable-External-Repair` still exists** — an emptied directory node the kill list records as pinned by an OS handle. A live process rooted there would return PASS. **Practical exposure is near nil** (zero entries, and no counter-example exists), which is why this is non-blocking — but the claim sentence is still marginally wider than the measurement. **Bound the sentence to the roots enumerated, or name the non-`Fusion247PKA` roots.** One line, at the scheduled reconciliation. **Not another cycle.**

### Blocker 3 (MEDIUM) — the Codex ratification window → **RECORD HALF DISCHARGED. The window is correctly still open, and that is the right outcome, not a failure to fix**

**Confirming the reading Larry asked me to confirm: yes, this was right to leave open, and it would have been a serious defect to "fix" it.**

Verified at `afe2b1a`: `git diff b8ca6d4..afe2b1a -- services/control-plane/review/prompts/ services/control-plane/review/codexAdapter.mjs` returns **empty**. `status: approved`, `governs_live: true`, `standing_use_ratified: true`, `proof_run_authorised: true` and `ratified_wording_at_head: 17738bf…` are all **byte-identical**. **Nothing was flipped. Nothing was self-ratified. No pin was fabricated forward.** Only Warwick ratifies wording, and nobody pretended otherwise.

**My finding was narrower than the window itself and it is discharged:** the defect was that *the record Warwick reads did not mention it*. It now does, twice — in the 📍 WHERE 4C ACTUALLY IS block (*"Warwick's ratification of the amended Codex prose"*, first item in the NOT YET DONE list) and in row 6.

**The `Completed automation` dimension therefore remains HOLD, and Larry's expectation is the correct reading.** The real production event — a merge-class Codex turn under the amended bytes — has never occurred and must not until Warwick signs. That is capability, correctly labelled, awaiting a human authority gate. **It is a sequencing state, not a build defect, and no further work is owed on it by anyone except Warwick.**

## The `git fsck` wording — agreed, non-defect

**I agree, and I said so in the original receipt before the ruling.** The committed record already carried the qualified, load-bearing claim — *"zero unreachable **commits**"* — which is the substantive property. The looseness was in chat narration, and narration is not the record. **Nothing is owed here.** *(For completeness: the unqualified form is false only in the trivial sense that unreachable blobs and trees always exist in any repository with disabled gc — which is the intended state, not a defect.)*

## Non-blocking items 4 and 5 — closed

Verified in the `afe2b1a` diff: the pin-count heading now reads *"115 at the time of Warwick's gate; 119 now"* **with the reason**, and the asdair worktree row now reads `✅ EXECUTED` with a dated note explaining that BLOCKED was true only of the first attempt. Both corrected in the same pass rather than parked — **which is the disposition the estate's own rules prefer, and it cost nothing.**

## ERRATA against the confirmed receipt — one row, named as my contract requires

**`Deliverables/2026-08-08-veritas-subphase-4c-estate-convergence-receipt.md`, frontmatter row `worktree_status_clean: true` and its `worktree_status_note`, are INACCURATE as committed at `3868578`.**

`git status --porcelain` returned 0 lines at the start of that review and did **not** match at the end: the tree carried two files modified by another writer — the Wayfinder and the 4C kill list — which Veritas did not write to. `git rev-parse HEAD` was unchanged at `b8ca6d4` throughout, so **every finding in that receipt is bound to committed bytes and re-derivable with `git show`, independently of the working tree.** Nothing in it was measured against the modified files.

**This errata is the correction. The committed receipt must not be edited** — that rule exists so a verdict cannot be quietly improved after the fact, and it binds me. A modified working-tree copy of that receipt currently exists; **it should be discarded so the committed bytes stand**, and this row is the durable record of what was wrong with them.

## Verdict for the boundary

**PASS — on the confirmed scope, and on that scope only.**

- **Blocker 1 — DISCHARGED.** **Blocker 2 — DISCHARGED**, with one non-blocking coverage residual named. **Blocker 3 — record half DISCHARGED**; the ratification window is correctly open and is Warwick's alone.
- **No blocking defect remains in what I was asked to confirm.** Holding this boundary further would mean manufacturing one, and that is the failure the 4C evidence block exists to prevent.

**What this PASS covers:** the truthfulness of the current 4C record, and the current capability claims I could reach and execute. **What it does NOT cover, and must never be quoted as covering:** row **2** (ungraded — my own contract); row **6**, which is **post-merge by construction** — check 14 requires the corrected contracts to be on `main`, which only the merge achieves — and which the map now correctly labels `IN PROGRESS — not yet claimed`; and **estate convergence itself**, which is **Codex's** merge-class challenge and **Larry's** post-merge proof, never mine.

**What it does not block:** the merge decision going to Warwick. **What it does block:** reporting 4C **CONVERGED** or **CLOSED**, and any completion claim against row 6, until the outstanding items the map now names are true.

**Recorded because it is the point of the exercise:** every repair in this pass was made to the *record* or to the *measurement*, and none to the verdict. The one thing that could have been quietly improved — row 6 — was left honestly incomplete.

## Next review trigger

**None from this boundary.** The focused confirmation my contract allows is now spent. A moved SHA, a committed receipt, further documentation repair or the merge event itself do **not** bring this back. **Post-merge convergence proof is Larry's lifecycle obligation and the merge-class external challenge is Codex's** — neither is a Veritas review. A new Veritas boundary opens only on a materially changed promised outcome, and 4D is a different boundary with its own.
