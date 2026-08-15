---
build: BUILD-006
scope: WP-4 — FOCUSED CONFIRMATION OF FINDING D-1 ONLY
gate: 1

boundary: >-
  BUILD-006 Phase 4 / WO-2026-08-15-05, the single blocking finding D-1 from
  Builds/BUILD-006-vlogops-publishing-engine/Assurance/veritas-wp-4-594d976.md — "a privacy
  finding does not record the value, but the FACT dimension does, into the same append-only
  table, in the same run, and into the committed demonstration". The promised outcome of the
  correction, as Larry ruled it: not the wording alone, but that NO stored surface and NO output
  of a verification run records any fragment of a private value a privacy rule matched.

reviewed_sha: 6c6559d5d1dba49acae57d449e8f3c668f546b94
governance_sha: 6c6559d5d1dba49acae57d449e8f3c668f546b94
branch: build-006/b6-04-verification
remote_reachable: true

evidence_method: >-
  mixed — git archive export of 6c6559d5 + a disposable PostgreSQL 17.4 cluster created by
  Veritas + gh for CI and PR facts. No repository file was written by Veritas.
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/0deb55dc-12c0-4c50-b8fb-8756fb3f0ecc/scratchpad/vd1
worktree_head_at_start: ed07d1d01927c2a01b524a46d022a9ede072e660
worktree_head_at_end: 21bb0a0e68b54d73330b2acfc2591a8ef2b729ef
worktree_status_clean: false
worktree_note: >-
  THE TWO HEADS DIFFER AND IT IS RECORDED, NOT SMOOTHED — the same pattern as the prior receipt.
  The delta is exactly one commit made by LARRY, concurrently, in the shared repository:
  21bb0a0 "WP-4 Gate 1 HOLD receipt…", which is the previous Veritas receipt (230 lines, one
  file). Veritas wrote nothing into the repository; the only porcelain entries at start and end
  are the same two untracked Team Knowledge/Sources files, present throughout. All mutation was
  applied inside the export and reverted with a digest match.

review_ceiling: ~20 minutes elapsed, one finding, one property, as dispatched. Not extended.
verdict: PASS
receipt_sha256: febb0484bf4f73af6a2fe816f1ec470081fe93289daade84e8587959f5ecb8ea
reviewed_by: veritas
reviewed_date: 2026-08-15
next_review_trigger: >-
  Nothing. D-1 is discharged and WP-4 Gate 1 is PASS. A moved HEAD, a receipt, a Wayfinder row or
  any documentation commit is NOT a trigger. Re-open Gate 1 only if the executable verification
  behaviour, the ruleset contract bytes, the advance-gate schema or the accepted functional scope
  materially change. Phase PASS (Gate 2) remains a separate boundary and is not addressed here.
---

## Scope reviewed

**In scope: finding D-1 and nothing else.** This is the single focused confirmation the prior
receipt's HOLD permits. Everything graded PASS at `594d976a` — the ten acceptance criteria, the
advance gate, the schema, the four SQL attack routes, the override fix, the coverage objects, the
restart durability — **stands, was not re-reviewed, and is not re-graded here.** I did not reopen it.

**Deliberately NOT in scope:** the advance gate · the schema and migrations · the four dimensions
other than fact/privacy · the override path · coverage reporting · Phase 5 · operational readiness
against the managed Supabase project · Codex's PR/release gate.

**The scope of the correction I judged is Larry's ruling, not the wording option.** The prior
receipt offered (a) a wording correction as sufficient, with (b) masking as optional. Larry took
both. I therefore graded the **property** — that no stored surface and no output of a verification
run records any fragment of a private value — not the sentence.

**Change surface, verified:** `git diff --stat 594d976a 6c6559d5` — 7 files, 335 insertions,
43 deletions, **all under `services/vlogops`**, all in the verification surface:
`DEMONSTRATION-PHASE4.md`, `src/verify/contract/verification-v1.md`, `src/verify/rules.mjs`,
`src/verify/text.mjs`, `test/helpers/planted-drafts.mjs`,
`test/verification-made-to-fail.test.mjs`, `test/verification-rules.test.mjs`. **No migration, no
schema, no CLI binary, no Phase 1–3 file touched.** The correction did not widen.

**⛔ The limit the prior receipt recorded is unchanged and still binds this one.** The planted
defects and the detectors were designed by the same hand; no language model was ever called. A
PASS here means the run withholds the classes the privacy patterns encode, proven by me. It is
not evidence about a real model's subtler leaks.

## Accepted requirements

The five confirmation requirements as dispatched. The ten WP acceptance criteria are **not**
re-graded — they carry forward from `veritas-wp-4-594d976.md`, which stands.

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | **The property, not the dimension** — run the real chain, plant the private detail, sweep every stored column of the whole run plus all CLI stdout/stderr for every fragment including each digit group separately. Zero occurrences | **PASS** | I built the real chain in my own export against my own disposable cluster and swept **134 columns across every base table in the `vlogops` schema** with my own PL/pgSQL loop, for 6 fragments (`01632 960111`, `01632`, `960111`, the full address, its local part, its domain). **Zero hits in any `verification_*` table** — `verification_run.manifest`, `verification_run.dimensions` (the coverage object), `verification_finding.detail`, `.evidence`, `.rule`, and every locator column. CLI: 4,655 bytes of stdout, 0 bytes of stderr, **`grep -c -F` = 0 for all six fragments**. Non-vacuity: 4 findings were actually stored for that package, and the FACT rows carry `withheld: true`, `masked: "0**********1"`, `privacy_rule: "PRIV-4/phone"`, **and no `token` field at all** | The 12 hits the sweep did return are in `story_segment.text` and `story_package.manifest` — **the draft itself**, which is Phase 3's own artefact and the thing being examined. That is inherent, not D-1: the verifier's job is to block the package, not to erase the draft it was handed. Recorded as an observation, not a finding |
| 2 | **The test now asserts the property** — not scoped to a rule prefix; asserts a non-empty set of surfaces; plant and assertion share constants | **PASS** | Read myself at `test/verification-made-to-fail.test.mjs:238-310`. The query selects **by `package_id`** across every run and left-joins **every** finding with **no `rule` filter** — the `where rule like 'PRIV-4%'` scoping is gone. It aggregates `manifest`, `dimensions`, `detail`, `evidence`, `rule` and the locator columns, then appends `cli stdout` and `cli stderr`. Vacuity is closed **three** ways, not one: `assert.ok(stored.rowCount > 0, 'no verification run was stored, so this proof would be vacuous')`; `assert.ok(scanned.length >= 5)` over surfaces filtered to `v.length > 0`; and a **positive** assertion that the FACT dimension actually fired (`factWithheld.length > 0`) with `coverage.tokens_withheld_as_private === factWithheld.length` — so a green cannot be bought by FACT staying silent either. Constants: `PLANTED_PHONE` / `PLANTED_EMAIL` are defined once in `test/helpers/planted-drafts.mjs:87-88`, **consumed by the plant itself** (`:124-125`) and re-exported as the frozen `PLANTED_PRIVATE_FRAGMENTS`, which splits the phone on its space and the address on its `@`. Plant and assertion cannot drift | none |
| 3 | **Made-to-fail, independently** — disable masking myself, confirm RED and that it names the surface, restore, GREEN, hash returns | **PASS** | I did not read the builder's transcript. Pre-mutation `sha256(src/verify/text.mjs)` = `491b83b70e982a21a4210ec1afb12bc9971fef6ee4755f6cae5a09d98281929f`. I injected `return null;` as the first statement of `privacyCoverFor`, disabling cross-dimension masking (post-mutation hash `34395b3f…`). **RED:** `not ok 1 - AC3.2b…`, `error: 'verification_run/manifest contains the planted private fragment "01632". A value written to an append-only table cannot be removed afterwards.'` — **it names the surface and it fails on the bare digit group**, which is exactly the fragment a full-phone-number search would have missed. Restored from my own copy: hash back to `491b83b7…`, `grep -c "VERITAS MUTATION"` = 0, **GREEN** (`ok 1`, pass 1, fail 0) | Mutation applied only inside the export; the repository working tree was never touched |
| 4 | **An ordinary factual error is still readable** — masking did not buy privacy by destroying the dimension | **PASS** | Queried the stored findings of the factual-error package on my own cluster: `FACT-1 · master claim "claim-1" asserts currency "£8,241,660.75", which appears in none of the evidence cited` with `evidence->>'token' = £8,241,660.75` and `withheld = NULL`; likewise `"9,999,417"`. **The value is recorded in full and the finding is readable.** The unit test `FACT still records an ORDINARY ungrounded number as a value — masking is not blanket` asserts `tokens_withheld_as_private === 0` and matches the literal in the detail. The discrimination is real: masking fires only where a privacy pattern matched the same text | Correctly stated by the builder as an inherited limit: a private value **no pattern recognises** is not masked, because nothing identified it as private. That is `PRIV-4`'s pre-existing limit, not a new one |
| 5 | **The document** — every fragment gone; the text states what the code delivers; any residual named plainly | **PASS** | `git show 6c6559d5:services/vlogops/DEMONSTRATION-PHASE4.md` → **0 occurrences of all five fragments**. The false sentence (*"…never the value"* over a transcript printing the digits three lines above) is **removed, not softened**. What replaces it describes the delivered behaviour: the transcript now shows the masked `FACT-2` findings and `tokens_withheld_as_private=2`, and a boxed section records D-1 including the diagnosis *"The masking gap was the defect. The TEST SCOPING is what let it through."* Three residuals are named plainly and correctly: the closed pattern list, `QUOT-1`'s 60-character head, and that ordinary factual errors are still recorded as values. The `QUOT-1` residual is carried **twice** — in the D-1 box and in §"stated plainly" at `:480-483`. The ruleset contract `verification-v1.md` gained the matching clause, and since its **bytes are the `ruleset_id`**, the rule change is content-addressed rather than merely described | Repository-wide, `960111` now survives only in `test/helpers/planted-drafts.mjs` and `test/verification-rules.test.mjs` — the plant constant and the unit fixture, where it belongs. Both are reserved-fiction values (Ofcom drama range; reserved `.invalid` TLD) |

## Evidence provenance

- **Reviewer home:** `C:/Fusion247PKA` (main). **I did not move into the reviewed checkout**, and I
  did not read `C:/Fusion247PKA-vlogops4` at all this time.
- **Export:** `git archive 6c6559d5 | tar -x` into `…/scratchpad/vd1` — no worktree registered, no
  `.git` state touched. All code reading, all execution and the mutation were inside the export.
  `npm ci --omit=dev` run inside the export only.
- **Live runtime:** a disposable PostgreSQL 17.4 cluster **created fresh by me** at
  `…/scratchpad/vpg2`, port 55443, `listen_addresses = '127.0.0.1'`, database `vlogops_v2`.
  **The managed Supabase project was never contacted.** Cluster stopped (`pg_ctl -m fast stop`,
  exit 0) at the end of the review.
- **Repository `git rev-parse HEAD`: start `ed07d1d0…`, end `21bb0a0e…`. THESE DIFFER, AND THAT IS
  RECORDED RATHER THAN SMOOTHED.** The delta is exactly one commit by **Larry**, concurrently:
  `21bb0a0 WP-4 Gate 1 HOLD receipt…` — the previous Veritas receipt, one file, 230 insertions.
  `git status --porcelain` at start and end contains the same two untracked
  `Team Knowledge/Sources/` files and nothing else. **Veritas wrote nothing into the repository.**
- **Mutation** applied to `…/scratchpad/vd1/services/vlogops/src/verify/text.mjs` only, and
  reverted with a **sha256 match** shown in the table below.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git diff --stat 594d976a 6c6559d5` | 0 | — | 7 files, all `services/vlogops`, verification surface only. No migration, no schema, no bin |
| `initdb` + `pg_ctl start` + `create database vlogops_v2` | 0,0,0 | — | PostgreSQL 17.4, loopback, port 55443, disposable |
| `node --test test/verification-made-to-fail.test.mjs` (export, my cluster) | 0 | **15** | 15 pass, 0 fail — the real chain, the real CLI, real rows |
| **MY OWN SWEEP** — PL/pgSQL loop over `information_schema.columns` for every base table in `vlogops`, 6 fragments | 0 | — | **`COLUMNS SWEPT=134 ; TOTAL HITS=12`** — all 12 in `story_segment.text` / `story_package.manifest` (the draft itself). **Zero in any `verification_*` column** |
| `select ordinal, rule, detail, evidence from verification_finding … order by ordinal` | 0 | — | 4 rows. Ordinals 0–1 `FACT-2`: `withheld: true`, `masked: "0**********1"`, `privacy_rule: "PRIV-4/phone"`, `matched_length: 12`, **no `token` key**. Ordinals 2–3 `PRIV-4/email`, `PRIV-4/phone`, masked as before |
| `node bin/vlogops-verify.mjs verify --package cf905b14… --json` | **1** | — | blocked. **stdout 4,655 bytes, stderr 0 bytes.** `grep -c -F` for each of 6 fragments = **0 / 0 / 0 / 0 / 0 / 0**. `"tokens_withheld_as_private": 2` |
| `sha256sum src/verify/text.mjs` (pre-mutation) | 0 | — | `491b83b70e982a21a4210ec1afb12bc9971fef6ee4755f6cae5a09d98281929f` |
| **MUTATION** — `return null;` injected as first statement of `privacyCoverFor` | 0 | — | applied at `:308`; hash `34395b3fe27c8993adf54e1498947dde0ba73654db30d74372e136fc49a12bb3` |
| `node --test --test-name-pattern="AC3.2b"` **under mutation** | **1** | 1 | **RED.** `not ok 1`; `error: 'verification_run/manifest contains the planted private fragment "01632"…'` — **names the surface and the bare digit group** |
| restore from my own copy; `sha256sum`; `grep -c "VERITAS MUTATION"` | 0 | — | `491b83b70e…929f` — **digest match**; 0 mutation markers |
| `node --test --test-name-pattern="AC3.2b"` **after restore** | 0 | 1 | **GREEN.** `ok 1`, pass 1, fail 0 |
| `select … from verification_finding where rule like 'FACT%'` (factual-error package) | 0 | — | `token = £8,241,660.75` and `9,999,417` recorded **in full**, `withheld` null — the dimension is intact |
| `git show 6c6559d5:services/vlogops/DEMONSTRATION-PHASE4.md \| grep -c -F <fragment>` ×5 | 0 | — | **0, 0, 0, 0, 0** |
| `git grep -c -F 960111 6c6559d5 -- services/vlogops` | 0 | — | only `test/helpers/planted-drafts.mjs` and `test/verification-rules.test.mjs` |
| CI `vlogops-tests` run `31859278330` @ `6c6559d5` | success | **180** | `EXECUTED SUBTESTS: 180 (pass=180, fail=0, skipped=0)` — 178 → 180, the two new unit tests. `secret-scan` green at the same SHA |
| `gh pr view 110` | 0 | — | OPEN, **draft**, base `build-006/b6-03-scribe`, head `6c6559d5…` |
| `git ls-remote origin` | 0 | — | `6c6559d5…` = `refs/heads/build-006/b6-04-verification` **and** `refs/pull/110/head` — remotely reachable |

## Assurance dimensions

Graded **for the D-1 scope only**. Every dimension the prior receipt marked PASS at `594d976a`
stands unaltered and is not re-graded; the three it held are the three that move.

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Larry's ruling was the stronger fix, not the wording. The stronger fix is what shipped, and the wording was corrected as well |
| Design fidelity | **PASS** | The fix is placed correctly: `privateMatchesRaw` is the internal raw view with an explicit prohibition on its escape, `scanPrivatePatterns` remains the safe public projection, and `privacyCoverFor` **never returns the raw value** — it returns rule, length and mask only. Additive, verification-surface only, no schema change |
| Functional proof | **PASS** | Proven on the real CLI against real stored rows from a real chain in my own export and cluster — not from the builder's transcript |
| Integration | **PASS** | The masking sits on the production path `verify → checkFact → finding → verification_finding/manifest`. Nothing was reached only by a test calling it directly; the sweep was over rows the shipped CLI wrote |
| Durability | **PASS** *(carried)* | Not re-tested — out of D-1 scope, and the append-only property is what makes D-1 matter rather than being affected by it |
| Test quality | **HOLD → PASS** | The prior HOLD's exact cause is gone: the assertion is no longer scoped to a rule prefix, it sweeps every stored column of the whole run plus CLI output, it is guarded against vacuity three ways, and its constants are shared with the plant. **I made it fail myself**, and it named the surface |
| Git truth | **PASS** | Branch, head, draft status, PR base, remote reachability and the 7-file surface are exactly as reported |
| Documentation truth | **HOLD → PASS** | The false bold sentence is removed, not re-worded around. The replacement describes delivered behaviour and shows a transcript that matches what the code now emits. The ruleset contract states the rule, and its bytes are the `ruleset_id` |
| Residual risk | **HOLD → PASS** | The residual that was mis-classified as *"noise worth knowing about rather than a defect"* is gone, and three real residuals are now named plainly — the closed pattern list, `QUOT-1`'s 60-character head, and deliberate non-masking of ordinary numbers. Each is bounded and correctly labelled |
| Completed automation | **n/a** | Unchanged: the Work Order explicitly declares this outcome not intended to be automatic |

## Production caller and journey

Unchanged from the prior receipt except for one hop, which is the whole correction:

`node bin/vlogops-verify.mjs verify --package <id>` → `verifyAndRecord` → `checkFact`
(`src/verify/rules.mjs`) → **`privateMatchesRaw(text)` once per claim and per segment** →
for each ungrounded token, **`privacyCoverFor(token.raw, privacyHits)`** → `factFinding` emits
either the ordinary value-bearing finding **or** the masked one → `verification_finding` +
`verification_run.manifest` in one transaction.

**The masking is on the write path, not on the render path.** That is the load-bearing placement:
the value is withheld *before* it reaches the append-only table, which is the only point at which
withholding it is still possible. I confirmed that by reading the stored rows, not the output.

## Restart and durability

`n/a` for this confirmation — durability was proven at `594d976a` (process restart, database
restart, four SQL attack routes) and is untouched by a change confined to what a finding records.

## Documentation contradiction scan

- **The one active document that would misdirect a fresh instance** — `DEMONSTRATION-PHASE4.md:217`
  — **is corrected.** A fresh reader now learns what is actually guaranteed and what is not.
- **Verified independently of the builder's account:** all five fragments absent from the document;
  the removed sentence does not survive anywhere in the reviewed tree; the residuals appear in both
  the D-1 box and the §"stated plainly" limits list, so a reader arriving from either direction
  finds them.
- **Revert-proofing** (the property this contract requires of a correction): the *why* is recorded
  at three levels — a boxed section in the demonstration, a header comment on `privacyCoverFor`
  naming D-1 in full, and a comment block inside the test explaining that the scoping was the
  mechanism. A later editor tidying any one of them still meets the other two.
- **Closure claims since the last receipt:** none. The Wayfinder Phase 4 row still reads
  *"IMPLEMENTED — awaiting assurance"*. No unbacked completion claim found.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1** | — | **DISCHARGED.** Confirmed by my own execution across all five dispatched properties, including an independent made-to-fail I performed rather than accepted | closed | — |
| **O-1** | LOW | **Recorded as instructed, NOT opened and NOT graded.** The builder reported that `QUOT-1` records a 60-character head of a mismatched quotation, so a quoted private passage could be stored that way — same class, different dimension. **He reported it rather than silently widening into it, which is the correct handling**, and it is disclosed in two places in the demonstration. LOW today: it needs a real private passage in a real package, and no language model has ever been called in this build | **non-blocking** — recorded once, parked | Larry — Warwick's decision if it ever becomes work |
| **O-2** | INFORMATIONAL | My sweep found the planted value in `story_segment.text` and `story_package.manifest` — **the draft itself**, Phase 3's artefact. That is inherent and is not D-1: the verifier's job is to block the package, not to erase the draft it was handed to examine. Noted so a later reader of my "134 columns, 12 hits" line does not misread it | **non-blocking** — observation only | — |
| **N1 · N2 · N3 · N4** | — | Carried forward from `veritas-wp-4-594d976.md` unchanged. **N3 in particular still stands: migration `004` has never been applied to the managed Supabase project**, and this receipt is engineering assurance against a disposable local cluster, not operational readiness | as recorded there | as recorded there |

## Verdict

**PASS — D-1 is discharged, and WP-4 Gate 1 is PASS.**

The privacy property is now a property of the **run** rather than of one dimension, and I proved it
myself: 134 stored columns swept for six fragments including each bare digit group, 4,655 bytes of
CLI output swept, **zero occurrences anywhere in the verification tables or the output**, with four
findings genuinely stored so the zero is not vacuous. The re-scoped `AC3.2b` asserts that property
rather than one rule prefix, cannot pass over an empty sweep or a silent FACT dimension, and shares
its constants with the plant. **I disabled the masking myself and the test went red naming
`verification_run/manifest` and the fragment `01632`** — the exact surface and the exact fragment
D-1 named — then restored to a matching digest and went green. An ordinary factual error still
records `£8,241,660.75` in full, so the fix bought privacy without costing the dimension. The
document no longer claims a guarantee the code does not deliver, and its three residuals are named
plainly rather than restated more carefully.

**What this PASS is, stated exactly.** Gate 1 engineering assurance for Work Package 4, on
`6c6559d5`, remotely reachable, CI green at that exact SHA with 180 executed subtests.

**What it is NOT, and none of this changes:** it is **internal** assurance, same runtime and same
model — **not external verification** and not Codex's PR or release gate. It is **not** release
readiness. **Phase 4's phase-PASS remains withheld on the same grounds as Phases 1–3: migration
`004` has never reached the managed Supabase project**, and nothing in this receipt is operational
readiness against it. Gate 2 is a separate boundary and is not addressed here.

## Next review trigger

**Nothing.** D-1 is closed and Gate 1 is PASS. A moved HEAD is not a trigger; neither is this
receipt, a Wayfinder row, a Codex finding elsewhere, or any documentation commit. Re-open Gate 1
only if the executable verification behaviour, the ruleset contract bytes, the advance-gate schema
or the accepted functional scope materially change.
