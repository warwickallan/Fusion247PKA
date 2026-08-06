# CI at the frozen head — BLOCKED by a GitHub Actions outage, with local evidence

**Date:** 2026-08-06 · **Branch:** `build-020/phase4-automation-law`
**Authority:** [[Deliverables/2026-08-04-proofline-wayfinder-plan]] § ACTIVE SESSION WORK PACKAGE, step 4

## The blocker — external, established not assumed

**GitHub Actions is in a major outage.** `https://www.githubstatus.com` → `Actions → major_outage`,
overall `Partial System Outage`.

Established before concluding that:

- Every run on this branch is stuck **`queued`** — oldest **2h39m**, none `in_progress`, none completed.
- **Zero runs exist at the current head** `bd11f96`; pushes created no runs at all.
- Not a repo misconfiguration: `actions/permissions` → `{"enabled": true, "allowed_actions": "all"}`.
- Not a missing runner tier: all workflows use GitHub-hosted `ubuntu-latest` / `windows-latest`.
- **No self-hosted fallback exists** — `actions/runners` → `{"total_count": 0}`.

**Consequence, stated plainly:** `CI green` is a hard precondition for a Veritas **Gate 1 PASS** and,
through it, for **Codex**. While Actions is down, **CI green is required-but-unavailable**. Neither
Larry nor Warwick can clear it. **A Gate 1 HOLD on the CI dimension is therefore the correct and
expected outcome, and must not be argued around.**

## Local evidence at the exact head `bd11f96` — capability, not a CI pass

Run on this machine because CI could not run. **This is NOT a substitute for CI green** and is not
offered as one; it exists so the head is not entirely unevidenced.

| CI workflow | Local equivalent | Result |
|---|---|---|
| `governor-tests` | `node --test tools/governor/*.test.mjs` | **499 tests · 499 pass · 0 fail · 0 skipped** |
| `secret-scan` | `bash scripts/secret-scan.sh` | **clean — 1245 tracked files, 0 secret values**, exit 0 |
| `secret-scan` | `node --test scripts/secret-scan.test.mjs` | 58 tests · 57 pass · 0 fail · 1 skipped |
| `cockpit-private-apps` | `private-apps-check` · `sw-version-check` · `down-reason-check` | **3/3 exit 0** |
| `control-plane-tests` | `npm run test:db` | exit 0 |
| `control-plane-tests` | `npm run test:worker` | 23 pass · 0 fail |
| `control-plane-tests` | `npm run test:wpc` | 14 pass · 0 fail |
| *(not in CI)* | `npm run test:contract` | 11 pass · 0 fail |
| *(not in CI)* | `npm run test:runtime` | **21 pass · 1 FAIL** — see below |
| hooks | `node --test .claude/hooks/return-cue.test.mjs` | **12 pass · 0 fail**, mutation-proven |

Not run locally: `test:wpd0`, `test:tower-loop`, `test:tower-loop-unit`, and the eight workflows with
no runs on this branch. **Named so the gap is visible rather than implied green.**

## 🔴 Finding — the Codex reviewer-contract staging test FAILS

`services/control-plane/review/test/tower-runtime.test.js:76`

```
not ok 12 - 4b. the runtime stages the REAL versioned prompt
             (not the legacy thin/empty skill) + ALL prior open findings
     error: 'the APPROVED ratified skill body is staged'
     code: ERR_ASSERTION
```

**Why this matters beyond a red test:** this is the assertion that the **external Codex operating
contract** actually reaching the reviewer is the ratified one — the exact concern that produced
§14.17/§14.18 (*"the skill file is a hand-copied paraphrase, and it has ALREADY DRIFTED"*). A failure
here is evidence that what reaches Codex may not be the approved law.

**Scope, stated honestly:**

- `test:runtime` is **NOT** part of `control-plane-tests` CI (CI runs `test:db`, `test:worker`,
  `test:wpc`, `test:wpd0`, `test:tower-loop-unit`, `test:tower-loop`). So this is **not** a
  CI-gating failure and its redness would not have been caught by the pipeline.
- It is **WP-2G territory**, not a row 1–4 functional requirement of this Work Package.
- **Recorded once for Warwick's decision. NOT actioned, and NOT turned into a Work Order** — per the
  finding-disposition rule. It is not blocking the current route, because Codex is already blocked
  by the CI precondition.
- **Not investigated further.** Whether the staged body is merely stale or genuinely wrong is
  **unestablished**, and I am not guessing at it.

## Route effect

| Step | State |
|---|---|
| 4 · CI green at frozen head | **BLOCKED — external outage.** Local evidence above. |
| 5 · Veritas Gate 1 | **Proceeds**, with CI honestly declared unavailable. A CI-dimension HOLD is expected and correct. |
| 6 · Codex | **BLOCKED** — requires Gate 1 PASS, which requires CI green. |
| 7 · Merge decision pack | Assembled with the blocker named. **No merge without Warwick.** |
