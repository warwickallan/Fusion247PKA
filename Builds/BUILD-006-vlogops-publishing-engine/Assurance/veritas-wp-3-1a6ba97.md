---
build: BUILD-006
scope: WP-3
gate: 1

boundary: >
  BUILD-006 Phase 3 / WP-3 (WO-2026-08-15-04) — "Scribe + Master Story Package. Versioned
  capability contract. Story question -> beats -> master narrative -> script + blog + titles +
  thumbnail direction + derivatives." The Wayfinder gate reads "A package a human recognises as
  Warwick's voice; siblings provably derived from one truth." ONLY THE SECOND HALF IS GRADED
  HERE — see §"What this PASS does NOT say".

reviewed_sha: 1a6ba978ba99a45423fc189101eb7053d39b2739
governance_sha: d63d613d0c4001e6476a750316fa3193bd6ee2d4
branch: build-006/b6-03-scribe
remotely_reachable: yes — `git branch -r --contains 1a6ba978…` returns origin/build-006/b6-03-scribe (branch tip) and origin/build-006/b6-04-verification

evidence_method: mixed — `git archive` export (source isolation, mutation testing), target worktree C:/Fusion247PKA-vlogops3 (the suite and the real journey, which need git history), an independently-provisioned disposable Postgres cluster (the adversarial writes), and GitHub Actions logs at the exact SHA
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/0deb55dc-12c0-4c50-b8fb-8756fb3f0ecc/scratchpad/veritas-wp3-export
worktree_head_at_start: f0b1a164eb10d42a51cfc0133dbfb8a7fd43ac1d
worktree_head_at_end: f0b1a164eb10d42a51cfc0133dbfb8a7fd43ac1d
worktree_status_clean: true

review_ceiling: ~50 minutes elapsed, set by the dispatch. Not extended.
verdict: PASS
receipt_sha256: f4a3cabbd0ce8306286a2e1745253db1972e2a58839656a99a83c3a6fe7a492d
reviewed_by: veritas
reviewed_date: 2026-08-15
next_review_trigger: >
  A material change to the promised outcome — the derivation rules, the citation constraints in
  db/003, the model seam's refusal behaviour, the contract identity scheme, or the CLI journey.
  ALSO: the first claim that any of this works in the MANAGED Supabase project, where migration
  003 has never been applied (D-1). NOT a moved HEAD, NOT this receipt, NOT documentation repair.
---

## Scope reviewed

The nine acceptance criteria of `WO-2026-08-15-04`, graded separately, plus the five items the
dispatch asked to be **tested rather than accepted**. Twenty changed paths in one commit
(`1a6ba97`) on top of Phase 2's branch.

**Deliberately NOT in scope:** Phase 1 and Phase 2's own acceptance — relied upon from
`Assurance/veritas-wp-1-c35e4f9.md` and `Assurance/veritas-wp-2-86e498d.md`, both PASS, and
re-executed here only as AC8 regression. Phase 4 (`build-006/b6-04-verification`, tip
`594d976a`) is a different boundary and was not reviewed.

**⛔ AND NOT IN SCOPE, EXPLICITLY: "a package a human recognises as Warwick's voice."** No
language model was called anywhere in this Work Package — the seam is stubbed, no gateway
credential exists and none was granted. Every artefact here was composed by
`deterministic-stub-v1`. **That half of the Wayfinder gate is UNGRADED, is not gradeable by any
reviewer, and is Warwick's creative judgement at Phase 5.** A Gate 1 PASS on this receipt must
never be read as covering it.

## Accepted requirements

| # | Requirement (abbreviated from WO-2026-08-15-04) | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | Consumes a REAL pack from a REAL seed | **PASS** | Veritas-executed, on a cluster Veritas provisioned itself. `bin/vlogops-intake.mjs records --from 2026-08-13 --to 2026-08-14 --privacy internal` → `seed_id=1ff6260e077bc47d…4c71, members=12`; `bin/vlogops-compile.mjs compile` → `pack_id=9ba2bf8bce54b93f…be6a`; `bin/vlogops-scribe.mjs draft --pack … --model stub` → `package_id=1e87ca1f17c7da82…1fa5`, claims=8, segments=14. Three real child processes, three real tables, no fixture and no hand-inserted row | none |
| AC2 | ONE canonical truth, siblings DERIVED — structurally, behaviourally, negatively | **PASS** | **Structurally:** `story_claim` is the only assertion table; a sibling is a row in `story_segment` that cannot exist without `story_claim_claim_fk`. **Behaviourally:** the package Veritas produced carries one story question, five beats, two narrative claims and all four siblings, each segment naming the master claim it adapts. **Negatively, executed by Veritas:** an insert naming a claim the master does not make is refused by `story_segment_claim_fk` (23503); suite subtests 79, 115, 116, 121 (`A SIBLING CANNOT SURVIVE ITS MASTER`) all executed and passed | none |
| AC3 | Every sibling claim cites a pack entry that resolves; uncited or wrongly-cited is refused | **PASS** | Veritas attempted the writes directly against the database, bypassing the application entirely. `source_ref=NULL` → `23502 not-null`. A fabricated ref → `23503 story_segment_entry_fk`. A ref belonging to a different pack → `23503 story_segment_entry_fk`. Resolution proven in the other direction too: every row of the sample's traceability index names a real repository file, and two spot-checked (`Deliverables/2026-08-13-session-report-asdair-finishing.md`, 54,618 bytes; `…felix_cockpit-ui-convergence.md`, 10,832 bytes) resolve on disk | none |
| AC4 | Siblings cannot drift from the master | **PASS** | **The load-bearing test, and it discriminates.** Veritas planted the exact drift case — a segment citing evidence that is genuinely in the pack but that its own master claim does not hold — and it was refused by `story_segment_cites_its_master` (23503). **Two POSITIVE CONTROLS of identical shape SUCCEEDED**: a segment citing what its master does hold, and a legal segment on a different master claim. A constraint set that refused everything would be indistinguishable from this one without those controls; it is not what is here | none |
| AC5 | Contract is VERSIONED; a package records the version that produced it; changing it does not retroactively alter existing packages | **PASS** | `contract_id` = sha256 of the contract text **that is actually sent to the model**, stored on the package row: `scribe-v1 / 7df7f453b8c3a651…1edc`, recorded on the package Veritas produced. Retroactivity is closed by immutability, tested as a write: `UPDATE` → `23000 vlogops: story_package is append-only; UPDATE refused`; `DELETE` → same. Subtest 103 (`CHANGING THE CONTRACT CHANGES THE PACKAGE IDENTITY, by one byte`) executed and passed | none |
| AC6 | The model seam refuses loudly when unconfigured and never silently substitutes | **PASS** | Veritas-executed through the real CLI, twice. Unset gateway → non-zero exit, `EVLOGOPSNOMODEL`, both missing variables named. Gateway URL set with no model name → refused through the same surface, naming `VLOGOPS_SCRIBE_MODEL` and the live 400 that produced the rule. **`story_package` rows after two refusals = 0** — a refusal writes nothing. The default client is the one that refuses; `stub` must be asked for by name; subtest 97 asserts the seam code carries no fallback path | none |
| AC7 | Determinism everywhere except the model's own output — and NOT claimed over prose | **PASS** | Independently reproduced: the same package_id `1e87ca1f…` was reached on a cluster Veritas provisioned from scratch, from Veritas's own invocation, on a different day from the builder's. Stronger still — **the committed sample `samples/master-story-package-sample.md` is BYTE-IDENTICAL to a fresh render Veritas produced** (`diff` exit 0), so the sample is genuine output and not a hand-edited artefact. Determinism is not overclaimed: `model_binding` records `{provider: stub, client: deterministic-stub-v1, configured: false, deterministic: true, warning: "MECHANICAL PLACEHOLDER TEXT…"}` on the row, and `samples/README.md` states exactly what is reproducible and what is not | none |
| AC8 | Phases 1 and 2 still pass; changed files of theirs called out | **PASS** | `node test/run-vlogops-tests.mjs` in the target worktree: **12 proof files, 122 executed subtests, 122 pass, 0 fail, 0 skipped, exit 0**. Phase 1/2 files touched, verified by diff: `src/config.mjs` (**additive constants only** — four new Scribe exports below the existing ones, no existing line changed), `package.json` (description + a `scribe` script), `.env.example` (additive Scribe block), `README.md`/`RUNBOOK.md` (extended). No Phase 1 or Phase 2 logic module was modified | none |
| AC9 | CI covers the new work and fails on zero executed tests | **PASS** | CI green at the **exact** reviewed SHA — runs `31855035563` (push) and `31855060895` (pull_request), both `success`, `# pass 122 / # fail 0`, on `1a6ba978…`. The path filter includes the workflow file itself. **Both zero-guards mutation-tested by Veritas inside the export:** removing every `*.test.mjs` → `GUARD FAILURE: no *.test.mjs files found`, exit 1; a suite whose only subtest is skipped → `EXECUTED SUBTESTS: 0 … Failing loudly`, exit 1. Neither guard is decorative | none |

## The five items the dispatch asked to be tested rather than accepted

| # | The claim | Result |
|---|---|---|
| 1 | Traceability is enforced by FOREIGN KEYS, five failure modes UNWRITABLE, **and the constraints discriminate** | **CONFIRMED, by writing them.** All five refused, each by a named constraint (`23502 not-null`, `story_segment_entry_fk` ×2, `story_segment_cites_its_master`, `story_segment_claim_fk`), plus `23000` on UPDATE and DELETE. **Two positive controls of identical shape SUCCEEDED.** This was established against the database directly, with the application out of the path — the DDL was read only to design the attack, never as the evidence |
| 2 | The CRLF identity defect is fixed **at the identity layer**, `.gitattributes` being defence in depth | **CONFIRMED, and the mechanism is where it is claimed to be.** `normaliseContractText()` folds CRLF once in `src/scribe/contract.mjs`, and the **same normalised text is both hashed and sent to the model** — so the thing hashed and the thing used cannot diverge. Measured independently: raw sha256 of an LF checkout `7df7f453…` vs a CRLF copy `d76862c7…` (different, as expected), but the **identity-layer id is `7df7f453…` from both**. It survives a fresh clone under any `core.autocrlf` because no git setting is in the path. CI on **Linux** at this SHA logged `contract=scribe-v1/7df7f453b8c3a651…1edc` — byte-identical to the Windows value |
| 3 | The "THIS IS NOT WARWICK'S VOICE" banner is emitted by the RENDERER, not hand-written | **CONFIRMED.** Emitted at `src/scribe/package.mjs:161-180`, conditional on `modelBinding.configured === false`, and it appeared as line 1 of a package Veritas drafted freshly on its own cluster. The only other occurrence in the tree is the rendered sample itself |
| 4 | CI produces different ids because it checks out a PR merge ref; **no test asserts those ids** | **CONFIRMED.** `grep` for `1e87ca1f`, `9ba2bf8b`, `1ff6260e`, `7df7f453` across `test/`, `src/`, `bin/` and `.github/` returns **nothing**. CI's own log shows a different `derivation_id` (`6083ce93…`) from the local run (`f7b6eddb…`) with the suite still green — which is only possible because no golden-file assertion exists. `samples/README.md` states the rule explicitly: *"Do not treat this as a golden file"* |
| 5 | Migration 003 has NEVER been applied to the managed Supabase project | **CONFIRMED, and disposed of as at Phases 1 and 2** — see D-1. `RUNBOOK.md` and `README.md` both say so in their own words and name applying it as a live action owned by Larry |

## Evidence provenance

- **Export:** `git archive 1a6ba978… | tar -x -C <scratchpad>` — used for source isolation and for **all** mutation testing. `node_modules` was copied in from the worktree (it is gitignored, so the archive cannot carry it); no source byte was altered.
- **Target worktree** `C:/Fusion247PKA-vlogops3` — clean, `git status --porcelain` empty, HEAD `1a6ba978…` at start and end. Used for the suite and the real journey, **because Route 1 treats git history as a first-class intake source and an archive export has no `.git`**.
- **A disposable Postgres cluster Veritas provisioned itself** on a free port, migrations 001+002+003 applied by Veritas, torn down afterwards. **The managed Supabase project was never contacted.**
- **GitHub Actions** logs at the exact reviewed SHA.
- Repository `git rev-parse HEAD` at start / end — `f0b1a164…` / `f0b1a164…`, identical. `git status --porcelain` unchanged start to end (two pre-existing untracked `Team Knowledge/Sources/` files, neither Veritas's).
- **Mutations applied only inside the export**, and reverted: the 12 `*.test.mjs` files were moved aside and restored (`ls test/*.test.mjs | wc -l` → 12).

**One honest note about method.** The first full-suite run, executed inside the export, returned **4 failures**. All four were Phase 2 **non-vacuity guards** — *"the real seed carries 6 members, which does not exceed the pack budget of 8; this proof would pass without the budget ever binding"* — firing because `git archive` strips `.git` and Route 1's git-history stream therefore found nothing. **That is the guards working correctly against a reviewer's own defective environment, and it is recorded as evidence of test quality rather than buried.** The suite was then re-executed in the target worktree, where the history exists: 122/122, exit 0.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node test/run-vlogops-tests.mjs` (target worktree, HEAD `1a6ba978`) | 0 | **122** | 122 pass, 0 fail, 0 skipped, 12 proof files |
| `node test/run-vlogops-tests.mjs` (export, no `.git`) | 1 | 122 | 4 non-vacuity guards fired — reviewer-environment artefact, diagnosed above |
| Veritas adversarial script: real journey + 7 illegal writes + 2 positive controls | 0 | 12 assertions | seed `1ff6260e…` → pack `9ba2bf8b…` → package `1e87ca1f…`; every illegal write refused by a named constraint; both positive controls succeeded |
| `diff <fresh render> samples/master-story-package-sample.md` | 0 | — | **byte-identical** |
| Contract identity under LF vs CRLF, via `normaliseContractText` + `sha256Hex` | 0 | 2 | both `7df7f453…`; raw bytes differ (`7df7f453…` vs `d76862c7…`) |
| MUTANT A — every `*.test.mjs` removed (export only) | **1** | 0 files | `GUARD FAILURE: no *.test.mjs files found in test/` |
| MUTANT B — sole subtest skipped (export only) | **1** | 0 executed | `GUARD FAILURE: 0 subtests EXECUTED … Failing loudly` |
| `gh run view 31855035563 --log` (push, SHA `1a6ba978`) | 0 | 122 | `# pass 122`; secret scan `SCANNED 51 file(s) … 0 secret value(s) found`; Linux contract id `7df7f453…` |
| `gh run list --workflow vlogops-tests.yml` | 0 | — | `1a6ba978…` → two runs, both `success` |
| `gh pr view 109` | 0 | — | OPEN, **draft**, head `build-006/b6-03-scribe`, base `build-006/b6-02-source-compiler` — as ordered |
| `bash scripts/secret-scan.sh --surface services/vlogops …` (local worktree) | **1** | 26 classes | 3 hits, **all in gitignored `node_modules/pg-connection-string/README.md`** — see D-3 |
| `git ls-files services/vlogops/node_modules \| wc -l` | 0 | — | **0** — nothing vendored is committed |

**Unavailable evidence, named rather than smoothed over:** no gateway credential exists, so the real model path (`gatewayModelClient.draft` past the refusal branch) has **never been executed against a live gateway** by anyone. Its refusal branch is proven; its success branch is not. This is the WP's declared design and not a defect, but it is not evidenced and is not claimed.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** — for the gradeable half only | "Siblings provably derived from one truth" is delivered and was proven adversarially. "A package a human recognises as Warwick's voice" is **ungraded** — see Scope |
| Design fidelity | **PASS** | Scribe is a versioned contract identified by the sha256 of its own bytes, not a drafting agent. The model seam copies `obsidiwikai/models.mjs`'s pattern **without importing it**, honouring the census's cross-service trap. No hooks built for Phases 4–7 |
| Functional proof | **PASS** | The real production journey was executed by Veritas end to end through the three real CLIs against a real Postgres |
| Integration | **PASS** | Phase 3 consumes Phase 2's own unique key `(pack_id, source_ref)` as a foreign key rather than re-deriving it, and Phase 2's `(pack_id, seed_id)` for the package's origin. Wired, not adjacent |
| Durability | **PASS** | Package, claims, citations and segments are append-only at the database (`23000` on UPDATE and DELETE, tested as writes). Re-drafting the same pack in a separate process dedupes to one row (subtests 90, 91). Phase 1's kill-and-revive proof re-executed green |
| Test quality | **PASS** | Both CI zero-guards mutation-proven to exit 1. Phase 2's non-vacuity guards demonstrably fire on a degraded environment. AC4's proof carries positive controls, so refusal is shown to discriminate rather than merely to refuse |
| Git truth | **PASS** | `origin/build-006/b6-03-scribe` tip **is** `1a6ba978…` — the reviewed head is the branch tip, remotely reachable. PR #109 is draft, based on Phase 2's branch as ordered. Main untouched. The Wayfinder row reads "IMPLEMENTED — awaiting assurance", which was true when written |
| Documentation truth | **PASS** | `README.md` and `RUNBOOK.md` state that 001/002/003 have **not** been applied to the managed project and that applying them is Larry's live action. `samples/README.md` states what the sample is not, forbids treating it as a golden file, and names the exact reproduction commands — which Veritas ran, reaching the same ids |
| Residual risk | **PASS** | Every limitation is explicit and bounded: no model has ever been called; the sample is stub output and says so in a rendered banner; determinism is claimed for structure and identity inputs, never for prose |
| Completed automation | **n/a, with reason** | The Work Order declares this outcome **NOT INTENDED TO BE AUTOMATIC** — drafting is invoked for a pack by a person. The one property it *does* claim as automatic is *"siblings cannot silently drift from the master or from the evidence"*, and that is not a scheduled job at all: it is enforced by the database on every write, against any client, and was proven so by attempting the writes. Nothing here depends on Larry remembering anything |

## Production caller and journey

`node bin/vlogops-scribe.mjs draft --pack <pack_id> --model stub --emit <path>` (real child
process, Veritas-executed)
→ `src/config.mjs` validates `VLOGOPS_DB_URL`
→ `src/scribe/contract.mjs::loadContract` reads `contract/scribe-v1.md`, folds CRLF **once**, and
  hashes exactly the text it will send
→ `src/scribe/prompt.mjs` assembles the prompt from the pack's frozen snapshots (`prompt_sha256`,
  44,798 bytes)
→ `src/scribe/model.mjs::resolveModelClient` — **defaults to the client that refuses**; `stub`
  returned only because it was named
→ `src/scribe/proposal.mjs` validates the proposal and refuses uncited, fabricated-cite, drifted
  and masterless segments **by name, before a transaction opens**
→ `src/scribe/store.mjs` writes package, claims, citations and segments in ONE transaction, where
  the same four refusals are re-imposed by foreign keys and two deferred constraint triggers
→ `src/scribe/package.mjs::renderPackage` emits the human artefact, **including the
  not-Warwick's-voice banner whenever the recorded binding says no real model wrote it.**

Every hop above was reached by the CLI, not by a test calling a module directly. **The one hop
never traversed by anybody is `gatewayModelClient.draft()` past its refusal branch**, because no
credential exists.

## Restart and durability

`n/a as new work` for process durability — Phase 3 adds no long-running process, no daemon, no
schedule and no consumer. What it does claim durably is **immutability**, and that was tested as
a write rather than reasoned about: `UPDATE` and `DELETE` against a live `story_package` row both
returned `23000 vlogops: story_package is append-only`. Cross-process identity stability was
established by drafting the same pack from a separate process and reaching one row. Phase 1's
kill-mid-transaction recovery proof was re-executed as part of the 122 and is green.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** `services/vlogops/README.md`, `services/vlogops/RUNBOOK.md`, and the Wayfinder (his, not the builder's).
- **Verified independently:** both service documents were extended and are truthful about the model seam, the refusal behaviour, the unapplied migrations and the stub's status.
- **What his list missed:** `services/vlogops/.env.example`, `package.json`'s description, `src/config.mjs`'s comment block and the new `services/vlogops/.gitattributes` are all documentation-bearing surfaces changed in this commit and absent from the declared impact. All four are accurate; **the omission is clerical and non-blocking**, recorded once.
- **Active documents that would misdirect a fresh instance:** none found. The Wayfinder Phase 3 row says "IMPLEMENTED — awaiting assurance", which is the truthful state at the time of writing.
- **Closure claims since the last receipt, and the receipt behind each:** Phase 1 → `Assurance/veritas-wp-1-c35e4f9.md`. Phase 2 → `Assurance/veritas-wp-2-86e498d.md`. Phase 3 → **no completion claim has been made**; the map row is honest and the PR is draft. No claim was found without a receipt behind it.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D-1 | Low | **`db/003_vlogops_story_package.sql` has never been applied to the managed Supabase project**, and the promised outcome is reached without it: the Work Order sets `live_authority: none`, puts the live project explicitly out of scope, and ships no service that needs it. Identical disposition to `001` at Phase 1 and `002` at Phase 2, and carried into this receipt's `next_review_trigger`. **It becomes blocking the instant anything is claimed to work in the managed project**; nothing is | **non-blocking** | Larry (disposition) |
| D-2 | — | **The voice half of the Wayfinder Phase 3 gate is UNGRADED and ungradeable at this gate.** No model was called; every word in the sample is `deterministic-stub-v1`. Recorded as a defect row purely so it cannot be lost: a Gate 1 PASS here says nothing whatsoever about whether Scribe writes in Warwick's voice, which is his judgement at Phase 5 | **non-blocking — but it gates any claim that the Phase 3 gate is met in full** | Warwick (Phase 5) |
| D-3 | Low | **`npm run scan` fails locally once dependencies are installed.** Veritas measured exit 1 with 3 hits, all in `node_modules/pg-connection-string/README.md` — third-party documentation, gitignored, `git ls-files` returns 0 tracked files under `node_modules/`. CI avoids this by scanning **before** `npm ci` and reports `51 file(s) … 0 secret value(s)`. The committed surface is clean; the trap is that a developer running the documented `npm run scan` after an install sees a red that means nothing. The workflow comment already explains why, and suppressing the hits would be the wrong fix | **non-blocking** | Larry (record only) |
| D-4 | Low | **`.gitattributes` does not renormalise files already present in an existing working tree.** Measured: `services/vlogops/.env.example` is CRLF in the target worktree and LF in a fresh export of the same commit, because it predates the new `.gitattributes`. This does **not** touch contract identity — the fold in `contract.mjs` is the mechanism and was proven independently — which is exactly the reason the builder's own header gives for not relying on `.gitattributes`. Recorded so nobody later mistakes an existing checkout's mixed endings for a regression | **non-blocking** | Larry (record only) |
| D-5 | Info | `src/config.mjs`, `package.json`, `.env.example` and the new `.gitattributes` are Phase 1/2-owned or new surfaces changed by this WP but absent from the declared `document_impact`. All changes are additive and accurate | **non-blocking** | Larry (scheduled reconciliation) |

## Verdict

**PASS** — all nine acceptance criteria are evidenced by execution, the five disclosed items were
tested rather than accepted, and the traceability claim survives adversarial writes with positive
controls proving the constraints discriminate rather than merely refuse.

### What this PASS does NOT say

- **It says nothing about Warwick's voice.** No language model has ever been called by this code.
  The gate sentence *"a package a human recognises as Warwick's voice"* is **ungraded here, by
  anyone**, and remains entirely open at Phase 5. Anyone reading this PASS as covering it is
  reading it wrongly.
- It is **internal** assurance of a Work Package — not external verification, not CI acceptance,
  and not release readiness. Codex's PR gate and Warwick's merge decision sit on top of it.
- It says nothing about the **managed Supabase project**, where migration `003` has never been
  applied (D-1).
- It certifies that a sibling **cannot be stored** uncited, wrongly-cited, drifted or masterless.
  It does not certify that the *words* a future real model produces will be good, true or
  publishable — only that whatever is stored is anchored to evidence the pack actually holds.

## Next review trigger

A material change to the derivation rules, the `db/003` citation constraints, the model seam's
refusal behaviour, the contract identity scheme, or the CLI journey — **or** the first claim that
any of this works in the managed Supabase project. A moved HEAD, this receipt, and documentation
repair are none of those.
