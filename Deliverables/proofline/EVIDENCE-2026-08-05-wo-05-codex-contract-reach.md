# EVIDENCE — WO-2026-08-05-05 (WP-2G): Codex's permanent contract, and proof it reaches the process

**Builder self-test evidence — NOT independent review.**

- **Work Order:** `Deliverables/proofline/WO-2026-08-05-05-codex-permanent-contract.md`, Amendment 1
- **Governance head:** `821d518789aab5734107d309a8df769f370b3bc8`
- **Branch:** `build-020/codex-permanent-contract`
- **Worktree:** `C:\Fusion247PKA-build-020-trial`
- **Codex invocations during this Work Order: ZERO.** No `codex.exe` was resolved, no credential
  was read, no `reviewDiff` / `mergeCheck` / `towerReview` was run against the real reviewer.
  Every reach assertion runs through an injected `spawn` and injected auth/binary probes.

---

## 1. The acceptance property, and what was actually proven

> *The exact bytes written to the Codex child process `stdin` contain the permanent contract,
> proven by a test that captures them via an injected `spawn` — and that test FAILS when the law
> is absent, unratified, or when any loader points elsewhere.*

**Proven, by execution:** `services/control-plane/tower-loop/test/codexContractReach.test.mjs`
loads the contract through the live loader's own exported constant, drives the real
`runMergeReview`, captures the exact bytes written to `child.stdin`, and asserts a sentinel
sentence held as a literal in the test file appears in them. **23,180 bytes reached `stdin`**,
carrying the contract, its O-5 clause, and the APPROVED classification amendment.

**Stated honestly and not implied away: this proves reach up to and including the bytes handed to
the child process. Only the live UAT proves the external Codex process consumed them.**

---

## 2. The gate proven BOTH ways — the consequence of shipping DRAFT

The contract ships `status: draft`, `governs_live: false`, `standing_use_ratified: false`. Warwick
reads the wording and flips those fields; that flip is what makes it govern. Because the real file
is unratified, the same loader was exercised in both directions:

| Case | Result |
|---|---|
| A **ratified fixture** (the real bytes, three frontmatter fields flipped) | reaches `stdin`, sentinel present, 23,180 bytes |
| The **real shipped file**, unratified | **REFUSED**, fail-closed, before any spawn |

```
# [contract] shipped state: status=draft governs_live=false standing_use_ratified=false → loadable=false
# [reach] 23180 bytes reached stdin; contract sha256=90e3fba89119aee2b82f48130b3c53387c26b8a41cf41e68f8d369c111b1ee4a
```

---

## 3. The mutation half — each failure caught and printed

A reach assertion that has never been made to fail is not evidence. Every mutation re-runs the
**same** assertion function under a broken input and requires it to throw. Verbatim run output:

```
# [mutation] skillText: '' (empty law delivered)
#            caught: the delivered stdin bytes must carry the contract sentinel "F247-CODEX-CONTRACT-SENTINEL-1"
# [mutation] substituted law (plausible text, no sentinel)
#            caught: the delivered stdin bytes must carry the contract sentinel "F247-CODEX-CONTRACT-SENTINEL-1"
# [mutation] unratified frontmatter (status: draft, governs_live: false)
#            caught: contract must load: fail-closed: Codex operating contract is NOT RATIFIED (status="draft", governs_live=false, standing_use_ratified=false) — an unauthorised governing prompt must never drive a review. Warwick ratifies it; nothing else does.
# [mutation] stale loader path (the old BUILD-010 home)
#            caught: contract must load: fail-closed: Codex operating contract at C:\Fusion247PKA-build-020-trial\Builds\BUILD-010-fusion-tower\baton-mvp\tower-qa-skill.md does not carry the delivery sentinel "F247-CODEX-CONTRACT-SENTINEL-1" — the loaded file is not this contract
# [mutation] stale loader path (a path that no longer exists)
#            caught: contract must load: fail-closed: Codex operating contract not found at …\no-such-contract.md
# [mutation] no frontmatter block
#            caught: contract must load: fail-closed: Codex operating contract has no frontmatter block at …\no-fm.md
# [mutation] classification amendment missing
#            caught: contract must load: fail-closed: reviewer-classification-amendment not found at …\nope.md
# [mutation] auth probe denied → 0 bytes captured (the reach assertion cannot pass by blocking)
```

**The last line is the control on the control.** `invokeCodexJson` used to resolve auth and the
binary from the HOST with no seam, returning `blocked` *before any spawn*. On CI there is no
`~/.codex/auth.json`, so the injected `spawn` would never have run, nothing would have reached
`stdin`, and this test would have passed here and failed in CI — or, written loosely, **passed BY
BLOCKING**. Forcing the auth probe to deny proves the capture is empty when the spawn does not
happen, so a passing reach assertion genuinely required the spawn.

### The source-sweep control was itself mutation-tested

`R6` (no module holds a private path to the contract) was proven to bite by temporarily
re-introducing a stale path expression into `mergeCheck.mjs`:

```
--- MUTATION APPLIED: a private stale path re-introduced into mergeCheck.mjs ---
not ok 6 - R6 — no module in the estate holds a private path to the governing contract
    a module still points at the old BUILD-010 contract home:
# tests 6
# pass 5
# fail 1
--- REVERTED ---
```

---

## 4. Executed commands — baseline first, then after

Baseline was taken in a **separate worktree cut at the governance head**
(`C:/Fusion247PKA-wp2g-baseline` @ `821d518`), then removed.

| # | Command | Baseline @ `821d518` | After |
|---|---|---|---|
| 1 | `cd services/tower-baton && node --test` | `# tests 158` `# pass 158` `# fail 0` | `# tests 158` `# pass 158` `# fail 0` |
| 2 | `cd services/control-plane && node --test tower-loop/test/reviewTooling.test.mjs tower-loop/test/classifyBuild.test.mjs tower-loop/test/notify.test.mjs` | `# tests 45` `# pass 45` `# fail 0` | `# tests 45` `# pass 45` `# fail 0` |
| 3 | `cd services/control-plane && node --test tower-loop/test/codexContractReach.test.mjs` | *(did not exist)* | `# tests 6` `# pass 6` `# fail 0` |
| 4 | `cd services/control-plane && npm run test:tower-loop` | **NOT RUNNABLE** — see §5 | **NOT RUNNABLE** — identical failure |
| 5 | `cd services/control-plane && npm run test:tower-loop-unit` | covered by row 2 (`notify.test.mjs`) | covered by row 2 |

Counts are read from the runner's own output (`# tests` / `# pass` / `# fail`), never from an exit
code.

---

## 5. 🔴 `npm run test:tower-loop` CANNOT EXECUTE ON THIS MACHINE — pre-existing, not caused here

The order names `npm run test:tower-loop` (`executed=` / `failures=`) as an acceptance command.
**It does not run on this machine, at the governance head, with no changes applied:**

```
> node tower-loop/test/run-tower-loop-tests.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'better-sqlite3' imported from
  C:\Fusion247PKA-wp2g-baseline\services\control-plane\tower-loop\db.mjs
```

`npm ci` cannot supply it:

```
npm error gyp ERR! find VS You need to install the latest version of Visual Studio
npm error gyp ERR! find VS including the "Desktop development with C++" workload.
npm error gyp ERR! stack Error: Could not find any Visual Studio installation to use
npm error gyp ERR! cwd C:\Fusion247PKA-build-020-trial\services\control-plane\node_modules\better-sqlite3
```

`better-sqlite3@13.0.2` runs `node-gyp rebuild` as its install script; there is no C++ toolchain on
this box (`Program Files\Microsoft Visual Studio` is absent) and **no built binding exists anywhere
on `C:`** — a full-disk search for `better_sqlite3.node` returned nothing, and the two worktrees
that do have `node_modules/better-sqlite3` have no `build/` directory. So this suite has not run
locally since WP-2F moved the Tower store to SQLite. **In CI it builds normally on `ubuntu-latest`.**

**Consequence for this WP, stated rather than papered over:** the reach proof was therefore written
as a standalone `node:test` file with **no native dependency**, executed directly here (row 3), and
**wired into `run-tower-loop-tests.mjs` as a spawned child whose `# pass` / `# fail` counts are
asserted** — so CI runs it under the suite the order names, while the evidence above could still be
produced on this machine. **The wiring itself is unexecuted here** and is verified only by
`node --check`; it is proven by the first CI run of `control-plane-tests.yml` on this branch.

---

## 6. Every pointer to the old home — enumerated, not assumed

Repo-wide grep for `BUILD-010-fusion-tower/baton-mvp/tower-qa-skill` and the equivalent
`path.join` form.

**Live code: ZERO remaining.** Six loaders repointed:

| Loader | Now |
|---|---|
| `tower-loop/reviewDiff.mjs` | `CODEX_CONTRACT_PATH`, loaded + validated |
| `tower-loop/mergeCheck.mjs` | `CODEX_CONTRACT_PATH`, loaded + validated |
| `tower-loop/watcher.mjs` | `CODEX_CONTRACT_PATH`, loaded + validated |
| `tower-loop/demo-merge-review.mjs` | `CODEX_CONTRACT_PATH`, loaded + validated |
| `review/productQaPrompt.mjs` (test-only) | `CODEX_CONTRACT_PATH` |
| `tower-baton/bin/tower-watch.js` (retired) | service-relative path constant |

**Historical records — deliberately NOT rewritten, and named:**

- `Team Knowledge/session-logs/2026/07/2026-07-18-02-30_mack_build-010-clickup-baton-mvp.md`
- `Team Knowledge/session-logs/2026/07/2026-07-18-02-50_larry_build-010-baton-live-proof.md`
- `Deliverables/2026-08-04-proofline-wayfinder-plan.md`
- `Deliverables/2026-08-05-veritas-claude-md-codex-boundary-receipt.md`
- `Deliverables/proofline/WO-2026-08-05-05-codex-permanent-contract.md`

**Deliberate, in-code references that are provenance rather than pointers:**

- `review/prompts/tower-qa-skill.md` — the `supersedes:` frontmatter field.
- `tower-loop/test/codexContractReach.test.mjs` — the stale-path mutation must name the old home
  in order to prove a loader pointing there is refused. The `R6` sweep excludes itself.

**Still stale, OUTSIDE the declared surface — reported, not fixed (see §8).**

---

## 7. Contract provenance — O-7 discharged

```
prompt_version = tower-qa-skill@3(approved;fp=bfc2bbeaa54f)
                +classification-amendment@1(APPROVED_LIVE;fp=5c2542588118)
                +orientation-draft@1(UNRATIFIED-draft);orientation_fp=15322f311f14
```

The fingerprint is now **compared against something**: `assertDeliveredContract()` recomputes
sha256 over the bytes about to be handed to the child and requires them to equal the bytes that
were loaded and validated, plus the sentinel. `reviewDiff.mjs`, `mergeCheck.mjs`, `watcher.mjs`
and `demo-merge-review.mjs` all fail closed on mismatch. Identity is carried by a **sentinel**, not
a pinned hash literal — a pin makes every wording edit a two-file edit, which is exactly how
`tower-runtime.test.js:368` came to assert `tower-qa-skill@1` against a shipped `version: 2`.

---

## 8. Out-of-scope findings — REPORTED, never fixed

| # | Path | Severity | Finding |
|---|---|---|---|
| F-1 | `Builds/BUILD-010-fusion-tower/Runtime/runtime-manifest.yaml:74` | MEDIUM | `qa_skill:` still names the old path. **Larry's, per the order.** |
| F-2 | `services/tower-baton/README.md:186` | LOW | Documents the old path as the governing prompt's home. Outside surface. |
| F-3 | `services/control-plane/PR-2b-BUILD-NOTE.md:33` | LOW | Same, plus an `approved / standing_use_ratified: true` claim that is no longer true of the shipped file. Outside surface. |
| F-4 | `services/tower-baton/src/qaSkill.js:4` | LOW | Header comment names the old path. Outside surface (`src/**` not declared). |
| F-5 | `services/control-plane/review/prompts/prompt-approvals.json` | **MEDIUM — needs a decision** | Warwick's campaign approval is bound to the orientation's exact hash `cd65539a…253135`. The order required repairing that file's `base_prompt` pointer, so its bytes moved to `15322f31…` and the approval **no longer applies**; the stamp correctly reverts to `UNRATIFIED-draft`. That is the binding working. Re-binding the hash is Warwick's act, not mine, and the file is outside my surface. |
| F-6 | `.github/workflows/tower-baton-tests.yml` | LOW | Path-filtered to `services/tower-baton/**`, so `qaSkill.test.js` — which now reads a file in `services/control-plane/**` — does not re-run when the contract changes. G-2 is closed by `control-plane-tests.yml` + the reach test instead; this is a residual asymmetry, not a hole. |
| F-7 | `services/control-plane/tower-loop/prompts/supervisor-prompt.md` | MEDIUM | Reaches Codex on **every** watcher supervisor turn, is labelled `approved_by='ai-authored-unapproved'`, and carries no reviewer or disposition law. A second governing text with its own home and its own unapproved status. Untouched by this WP; §14.18 already names it unestablished. |
| F-8 | `services/control-plane/review/codexAdapter.mjs::buildCodexPrompt` trailer | LOW | The 10-line hardcoded output-shape trailer was left **byte-for-byte unchanged**: `buildFablePrompt` wraps `buildCodexPrompt`, so trimming it would alter a second reviewer's prompt that this Work Order does not cover. The contract now carries the authoritative wording; the trailer is a restatement of output shape. |
| F-9 | `services/control-plane/package.json` | LOW | Outside surface, so the reach test could not be added to `test:tower-loop-unit` — which needs neither Postgres nor SQLite and would be the cheapest CI home for it. Wired into `run-tower-loop-tests.mjs` instead, per R-5. |

---

## 9. Not verified / known limitations

1. **The live UAT is not replaced.** Reach is proven to the bytes handed to the child process.
   Nothing here proves the external Codex process read them.
2. **`run-tower-loop-tests.mjs`'s new subtest is unexecuted on this machine** (§5). Syntax-checked
   only. First proof is CI.
3. **`review/test/tower-runtime.test.js` is DB-gated and ran 0 / 22 subtests here** (all skipped,
   no `DATABASE_URL`; `run-runtime-tests.mjs` needs `initdb`/`pg_ctl`, which the order excluded).
   Its edits are reasoned, and the `loadProductQaPrompt` semantics they depend on **were** executed
   directly: the real DRAFT file is refused, a ratified fixture loads, and the composed
   `prompt_version` matches the new version-agnostic assertions. The subtests themselves are
   unproven.
4. **The contract's WORDING is not certified by anything here.** It was authored by Keel against
   Warwick's O-1..O-7. It ships DRAFT precisely because ratifying AI-authored governing wording is
   a human act. Nothing in this evidence pack is an argument that the wording is right.
5. **A concurrency event occurred mid-build.** The shared worktree was switched back to
   `build-020/live-trial` and two Deliverables-only commits (`23d6842`, `2533cdf`) landed while
   this work was in progress. No file in the declared surface was touched by them; this branch was
   re-pointed onto `2533cdf`, which is a descendant of the governance head.
6. **No independent review has occurred.** This is builder evidence.

**Builder self-test evidence — NOT independent review.**
