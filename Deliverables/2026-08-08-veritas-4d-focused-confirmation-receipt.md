---
build: BUILD-020
scope: phase-4d-capae-focused-confirmation
gate: 2

boundary: >
  ONE focused confirmation of blocking findings D-1, D-2 and D-3 from
  Deliverables/2026-08-08-veritas-4d-phase-check-receipt.md. NOT a re-review of Sub-phase 4D:
  the 20 requirements that passed at 83bcdec were not re-graded and are not reopened.

reviewed_sha: 5b20dc20f6bb827f891fdcfb2fc910b90f2ac13d
governance_sha: 83bcdec6486df2d801d8df99177c3456e18bad84
branch: main
remote_reachable: true
supersedes: none — the prior receipt's bytes are unaltered; this is its focused confirmation

evidence_method: mixed — target checkout (read-only execution), the real GitHub Actions run via gh (read-only), and one ephemeral `git archive 5b20dc2` export used solely for mutation testing
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\a2725267-efa8-4c85-911a-2e4ba4cdfeb1\scratchpad (export deleted after use; never committed)
worktree_head_at_start: 5b20dc20f6bb827f891fdcfb2fc910b90f2ac13d
worktree_head_at_end: 5b20dc20f6bb827f891fdcfb2fc910b90f2ac13d
worktree_status_clean: true
ci_run_inspected: 31257641290 (cockpit-private-apps, head 5b20dc2, conclusion FAILURE)

d1_verdict: NOT CONFIRMED — still open, blocking
d2_verdict: CONFIRMED closed at source; its CI step has never executed (skipped behind D-1)
d3_verdict: CONFIRMED closed

verdict: HOLD
receipt_sha256: 9e59b28aa3ca0cce080e8609828a2b5bfc9130e839bff304960179347b2101d3
prior_receipt_digest_reconciled: >
  bdc6061bc49111c5b9fbc685a489a7ccc634095fa061e8a6cc9546dd1b5cf5ef is the WHOLE FILE;
  15e40c40d75a7ec6702711187ae82a5c9a2c2b4159a1f3c0f2793fc39a1c67e4 is the BODY from
  '## Scope reviewed' to EOF, which is the boundary Veritas hashed and stated. Both reproduce.
  No tampering. The boundary, not the bytes, was imprecise.
reviewed_by: veritas
reviewed_date: 2026-08-08
next_review_trigger: >
  cockpit-private-apps GREEN at the head carrying the corrected provenance-check.mjs copy loop,
  with the 'CAPAE read layer...' step showing success rather than skipped. Report the CI run id.
  A local exit 0 will not close this. A receipt, documentation or a moved HEAD is NOT a trigger.
---

# Veritas — focused confirmation of D-1, D-2, D-3 (Sub-phase 4D)

## Scope reviewed

**ONE focused confirmation of D-1, D-2 and D-3 only**, per the trigger recorded on `Deliverables/2026-08-08-veritas-4d-phase-check-receipt.md`. The 20 requirements that passed at `83bcdec` were not re-graded and are not re-opened. `git diff --stat 83bcdec..5b20dc2` = 8 files: 3 product/harness files, 1 workflow, 4 documents. No other product change entered the boundary.

## Findings confirmed

| Finding | Verdict | Basis |
|---|---|---|
| **D-1** | ❌ **NOT CONFIRMED — still open** | The module list is right; the harness repair is wrong, and CI is **red at `5b20dc2`**. |
| **D-2** | ✅ **CONFIRMED CLOSED at source** · ⚠️ **CI binding not yet executed** | The derivation is now genuinely asserted and survives three mutations. Its CI step has never run — it is skipped behind D-1. |
| **D-3** | ✅ **CONFIRMED CLOSED** | The false coverage claim is gone and replaced with a statement that is true today. |

## D-1 — NOT CONFIRMED

**What is right, and I verified each independently:**

- `SOURCE_MODULES` now carries `capae.mjs` and `../../tools/governor/capae-brief.mjs` (`services/cockpit/provenance.mjs`, 11 modules), with the cause recorded in-file.
- `node services/cockpit/provenance-check.mjs` on this host → **exit 0, 29 assertions, 0 failed**, `sourceHash 6350e1f960ff5099`.
- **The assertion was NOT weakened.** `git diff 83bcdec..5b20dc2 -- services/cockpit/provenance-check.mjs` is 1 hunk, +10/−1, entirely inside the copy loop. The guarded line is byte-identical: `ok('the same bytes OUTSIDE any repository hash identically', sourceHash({ dir: copy }) === baseline, …)`. Larry's specific question is answered: **he fixed the copier and did not touch the assertion.**

**Why it is still open — executed, not argued:**

`git rev-parse HEAD` = `5b20dc2`, and the `cockpit-private-apps` workflow at that exact head **FAILED** (run `31257641290`, 2026-08-08T12:36:52Z). The failing step is the one this repair was supposed to turn green:

```
Error: EACCES: permission denied, mkdir '/tools/governor'
    at Object.mkdirSync (node:fs:1370:26)
    at .../services/cockpit/provenance-check.mjs:161:8
  errno: -13, code: 'EACCES', syscall: 'mkdir', path: '/tools/governor'
```

Line 161 is the new `fs.mkdirSync(path.dirname(dest), { recursive: true })`.

**The cause, established by execution before I saw the log.** The loop computes `dest = path.join(copy, m)`. For a `../../` entry that **escapes the isolation directory by two levels**:

```
copy dir : C:\Users\Buggly\AppData\Local\Temp\prov-copy-XXXX
dest     : C:\Users\Buggly\AppData\Local\tools\governor\capae-brief.mjs
ESCAPES temp dir? true
```

On Linux the same arithmetic gives `/tmp/prov-copy-x/../../tools/governor` = **`/tools/governor`**, which the `runner` user cannot create — so the process dies mid-check.

**Two consequences, both proven:**

1. **CI is red at the repaired head.** CI green is a stated precondition for Codex, so D-1 still gates it.
2. **On Windows it does not fail — it succeeds wrongly, and leaves evidence.** `C:\Users\Buggly\AppData\Local\tools\governor\capae-brief.mjs` **exists on this machine**, written 2026-08-08 13:32 by my run of the check. The cleanup at line 200 removes only the registered `mkdtemp` directories, so the escaped file is never removed. Worse for the property under test: that module is hashed from a path **outside the isolated copy**, so the assertion *"the same bytes OUTSIDE any repository hash identically"* is, for that one module, no longer reading the isolated copy at all. The assertion text was not weakened; **what it actually exercises quietly was.**

This is the estate's own recorded lesson — *a green suite on YOUR machine is not green* — reproduced exactly: Windows `os.tmpdir()` is deep enough that `../..` lands somewhere writable, Linux's is not.

**The specific unmet claim:** *"`provenance-check.mjs` exits 0"* is true only on this host. At `5b20dc2` it exits 1 in CI, and the workflow it belongs to is failing.

## D-2 — CONFIRMED closed at source; CI binding not yet executed

**Confirmed by mutation, three ways, inside an ephemeral `git archive 5b20dc2` export:**

| Mutation | `capae-check.mjs` |
|---|---|
| `needsAttention = true` (my original) | **exit 1 — caught** |
| `needsAttention = false` | **exit 1 — caught** |
| `familiesByUrgency`: `return ra - rb` → `return rb - ra` | **exit 1 — caught** |

The second matters most: it proves the three MUTATION GUARDS cannot be satisfied by a function that always returns `false`, because the positive half (CHALLENGED and INEFFECTIVE ⇒ `true`) is asserted alongside them. **The guards are non-vacuous in both directions.** Baseline on the repaired head: `CAPAE-CHECK PASS — 40 assertions executed, 0 failed` (was 27). `capaeOverview` and `familiesByUrgency` are imported directly at line 9 and asserted at lines 110–166, including the five-key `counts` shape, CHALLENGED as the meaning of "reopened", the pilot's `nextQualifiedExposure` verbatim from the record, `latestRecurrence` not displaced by a later clean or no-op, and the worst-first order `[INEFFECTIVE, CHALLENGED, MONITORING, EFFECTIVE]`. The export was deleted.

**The residual, and it is D-1's fault rather than D-2's.** The second half of the original finding was *"`capae-check.mjs` is in no CI workflow"*. Two steps were added correctly. Their outcome in run `31257641290`:

```
failure   Build provenance is read from loaded bytes, never from git
skipped   CAPAE read layer and the attention derivation behind Home and System
skipped   Rotation reports — NULL never becomes zero
```

**The assertion is written but has never executed in CI.** It will bind the moment D-1 is genuinely fixed; nothing further is owed to D-2 itself. I record it because *written is not loaded* is the family this whole sub-phase is about, and a step that has only ever been skipped has not yet proven it can run.

## D-3 — CONFIRMED closed

`services/cockpit/public/app.js` 1823–1832: the bare claim *"so capae-check.mjs asserts it"* is gone. The replacement states what is now true, names the mutation that proved it false, and records that the previous wording asserted coverage before it existed. **The correction is revert-proof in the sense the contract asks for** — a future editor tidying the comment cannot innocently restore the false claim without also deleting the dated note explaining why it was false. No other occurrence of the old wording remains.

## Two things reported rather than quietly fixed — answered

**1. The receipt digest reconciles; nothing was tampered with.** Both numbers are correct and they answer different questions:

| Boundary hashed | sha256 |
|---|---|
| **whole file**, frontmatter included (Larry's) | `bdc6061bc49111c5b9fbc685a489a7ccc634095fa061e8a6cc9546dd1b5cf5ef` |
| **body only**, from `## Scope reviewed` to EOF (mine, as stated) | `15e40c40d75a7ec6702711187ae82a5c9a2c2b4159a1f3c0f2793fc39a1c67e4` |

The file contains no CRLF, so normalisation changes nothing. **The fault is mine and it is a precision fault, not an integrity one:** the template says *"everything below the closing `---`"*, which also includes the `# Veritas receipt — …` H1 and the blank lines around it; I hashed from `## Scope reviewed`. The stated digest reproduces exactly against that boundary. **Recording the digest he observed instead of asserting a match was the correct thing to do**, and it is what made this reconcilable in one command. No errata is owed to the committed receipt — its bytes are unaltered and its stated digest is reproducible now that the boundary is named.

**2. Accepting the pattern finding without softening it** is noted. It is not evidence of anything and I have graded nothing on it.

**Non-blocking, recorded once, not for action:** the workflow now runs `rotation-report-check.mjs` twice — the new *"Rotation reports — NULL never becomes zero"* step and the pre-existing *"Rotation reports map NULL and zero as different values"* step are the same command. Harmless duplication. My three earlier parked items stay parked, correctly not actioned.

## Evidence executed

| # | Command or artefact | Exit | Result |
|---|---|---|---|
| 1 | `git rev-parse HEAD` · `git status --porcelain` · `git branch -r --contains 5b20dc2` | 0 | `5b20dc2…`, clean, on `origin/main` |
| 2 | `git diff --stat 83bcdec..5b20dc2` | 0 | 8 files; no product change beyond the three repairs |
| 3 | `node services/cockpit/provenance-check.mjs` (this host) | **0** | 29 assertions, `sourceHash 6350e1f960ff5099` |
| 4 | `git diff 83bcdec..5b20dc2 -- services/cockpit/provenance-check.mjs` | 0 | 1 hunk, +10/−1, inside the copy loop; **guarded assertion byte-identical** |
| 5 | `node -e` path arithmetic on the cross-tree entry | 0 | `dest` escapes the temp dir → `C:\Users\Buggly\AppData\Local\tools\governor\capae-brief.mjs` |
| 6 | `ls -la "C:/Users/Buggly/AppData/Local/tools/governor/"` | 0 | **stray `capae-brief.mjs`, 9382 bytes, 2026-08-08 13:32** — created by the check, never cleaned up |
| 7 | `gh run list --workflow=cockpit-private-apps.yml` | 0 | `5b20dc2` → **conclusion: failure** |
| 8 | `gh run view 31257641290 --log-failed` | 0 | `EACCES: permission denied, mkdir '/tools/governor'` at `provenance-check.mjs:161` |
| 9 | `gh run view 31257641290 --json jobs` step outcomes | 0 | provenance **failure**; capae-check and rotation-report steps **skipped** |
| 10 | `node services/cockpit/capae-check.mjs` | **0** | **40 assertions**, 0 failed |
| 11 | MUTATION A/B/C in `git archive 5b20dc2` export | **1 / 1 / 1** | all three caught; export deleted |
| 12 | sha256 of receipt whole-file vs body-from-`## Scope` | 0 | `bdc6061b…` vs `15e40c40…`; no CRLF |

## Evidence provenance

- **Evidence method:** mixed — target checkout (read-only execution), GitHub Actions (the real CI event, via `gh`, read-only), and one ephemeral `git archive 5b20dc2` export in the session scratchpad for mutation testing. No `git worktree`.
- **Repository HEAD start / end:** `5b20dc20f6bb827f891fdcfb2fc910b90f2ac13d` / `5b20dc20f6bb827f891fdcfb2fc910b90f2ac13d` — identical.
- **`git status --porcelain` start / end:** empty / this receipt only. **Veritas modified no tracked file.**
- The export was deleted. One file outside the repository (`AppData\Local\tools\governor\capae-brief.mjs`) exists because `provenance-check.mjs` created it — that is finding D-1, not a Veritas write.

## Verdict

**HOLD stands.** D-2 and D-3 are closed. **D-1 is not**, and it is the one that gates CI, and through CI, Codex.

The repair was correct in substance and wrong in one line of its own harness. **`provenance-check.mjs` line 161 must resolve the destination INSIDE the isolation directory** — flatten the entry, or `path.join(copy, m.replace(/\.\.\//g, ''))`, or mirror only the basename — anything that keeps `path.resolve(dest)` under `path.resolve(copy)`, so the check tests an isolated copy on every platform and writes nothing outside its own temp directory. Then confirm against **the CI run**, not against this host.

## Next review trigger

**`cockpit-private-apps` green at the head carrying the corrected `provenance-check.mjs` copy loop, with the `CAPAE read layer…` step showing `success` rather than `skipped`.** Nothing else reopens this gate — not a receipt, not documentation, not a moved HEAD. Report the CI run id; a local exit 0 is what produced this second cycle and will not close it.
