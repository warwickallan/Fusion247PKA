---
build: BUILD-006
scope: WP-4
gate: 1

boundary: >-
  BUILD-006 Phase 4 / WO-2026-08-15-05 — "Verification. Independent fact, quotation, privacy,
  rights, cross-format consistency. Must be able to BLOCK. Reviews from SOURCE." Gate: "Made to
  fail: a planted factual error, a private detail and a rights gap are each caught and each block."

reviewed_sha: 594d976a23d4e4ee16ada5cfa1263a64aeb2ee6c
governance_sha: 594d976a23d4e4ee16ada5cfa1263a64aeb2ee6c
branch: build-006/b6-04-verification
remote_reachable: true

evidence_method: mixed — git archive export + a disposable PostgreSQL 17.4 cluster created by Veritas + one read of the branch worktree + gh for CI and PR facts
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/0deb55dc-12c0-4c50-b8fb-8756fb3f0ecc/scratchpad/veritas-wp4
worktree_head_at_start: f0b1a164eb10d42a51cfc0133dbfb8a7fd43ac1d
worktree_head_at_end: ed07d1d01927c2a01b524a46d022a9ede072e660
worktree_status_clean: false
worktree_note: >-
  THE TWO HEADS DIFFER AND IT IS RECORDED, NOT SMOOTHED. The delta is exactly one commit made by
  LARRY, concurrently, in the shared repository (ed07d1d "WP-3 Gate 1 PASS..."). Veritas wrote
  nothing into the repository: the only porcelain entries at the end are two untracked
  Team Knowledge/Sources files that were already present at the start. No mutation was applied
  anywhere except the disposable cluster and the ephemeral export.

review_ceiling: ~55 minutes elapsed, as dispatched. Not extended.
verdict: HOLD
receipt_sha256: 016a6a2c31b2e0f2d6d6c1412ed96212afc6c74202d29f96f8d8b2f4e7168e89
reviewed_by: veritas
reviewed_date: 2026-08-15
next_review_trigger: >-
  Correction of D-1 (the privacy-guarantee claim) and nothing else. A moved HEAD, this receipt, a
  Wayfinder row or any documentation commit that does not change the privacy claim is NOT a trigger.
---

## Scope reviewed

**In scope — the whole Work Package.** WO-2026-08-15-05, all ten acceptance criteria, graded
individually. No narrowing was requested and none was applied.

**The boundary:** Wayfinder §10 Phase 4 — *"Verification. Independent fact, quotation, privacy,
rights, cross-format consistency. Must be able to BLOCK. Reviews from SOURCE."* Gate, verbatim:
*"Made to fail: a planted factual error, a private detail and a rights gap are each caught and each
block."*

**The human question this gate answered:** if Warwick were about to publish one of these packages,
would this stage stop him publishing something false, private or not his to use — and could he see
WHICH objection was raised and why? **Yes to both**, on evidence I produced myself, from my own
chain, with the application removed from the path.

**Deliberately NOT in scope:** operational readiness against the managed Supabase project (Gate 1
is engineering assurance); Phase 5 approval surface; whether the drafts read as Warwick's voice
(no model exists in this build); Codex's PR/release gate.

**⛔ THE LIMIT THIS RECEIPT CANNOT GRADE, and it must not be read past.**
**The planted defects and the detectors were designed by the same hand, and no language model was
ever called.** Every draft in this build is `deterministic-stub-v1` or a planted variant of it. A
PASS on the made-to-fail criteria therefore means: **the verifier catches the classes it encodes,
and has been made to fail on each of them.** It does **NOT** mean the verifier would catch a real
model's subtler falsehoods. Nothing in this receipt is evidence about real-world verification
quality, and a later reader must not use it that way. The builder states this limit himself, in the
demonstration and in the README, and states it well.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | It verifies a REAL package — a package Phase 3 produced from a real pack from a real seed | **PASS** | I built my own chain from this repository, 2026-08-13→14 window: seed `ee35d89e…a7e4` (12 members) → pack `1e4b6857…d8bc` (8 entries, 138,265 bytes, bounded, 4 omitted) → package `903d6e15…c767` (8 claims, 14 segments). All three exits 0, unpiped. **My ids differ from the builder's, which is the content-addressing working, not a discrepancy** — my repository content differs from his | none |
| AC2 | Five dimensions, each independently reported, no aggregate boolean | **PASS** | `verify --json` returns a named verdict **and its own coverage object** for fact, quotation, privacy, rights, cross-format. On my clean package: fact examined 33 tokens over 6/8 claims and 13/14 segments and **names the 2 claims and 1 segment it did not examine**; quotation 0 spans found with the 40-char floor declared; privacy 6 cited sources, 22 publishable texts scanned; rights 6/6 derived-from-provenance, 0 declared; cross-format 4/4 siblings, 5/5 beats, 2 narrative claims exempt. **A dimension cannot report a pass over ground it never looked at, because the ground it looked at is a stored column** | Coverage is honest but is not itself asserted against an independent count |
| AC3 | Made to fail — factual error, private detail, rights gap; each CAUGHT and each BLOCKS | **PASS** | Three planted drafts on **my own real pack**, each verified through the shipped CLI, each `EXIT_UNPIPED=1`. Factual error → `FACT-1` ×2, only the fact dimension objects. Private detail → `PRIV-4/email` + `PRIV-4/phone`, privacy dimension blocks. Rights gap → `RIGHT-3` `surface` on real `warwick-supplied` material I intook myself. Every one `advanceable: false`, and the advance refused | Rights gap proven at the `surface` rung; the `RIGHT-2` declared-third-party rung is proven by the suite, not by me |
| AC4 | The positive control — a clean package passes | **PASS** | My clean package `903d6e15…c767` → `verdict: pass`, all five dimensions pass, `advanceable: true`, `EXIT_UNPIPED=0`; and it **advanced by raw SQL with the application entirely out of the path**: `INSERT 0 1`. **The gate discriminates; it is not a wall** | none |
| AC5 | Blocking is a DURABLE STATE; advancing a blocked package fails | **PASS** | See §Restart and durability. Four independent SQL attack routes refused, including `COPY`; block survived a `pg_ctl -m fast stop` / `start` cycle and a fresh process; re-verification returned `deduplicated: true` and cleared nothing | The gate binds `vlogops.package_advance` only — the builder's own stated limit, and it is stated in four places |
| AC6 | An override is possible, explicit, attributed and recorded; no silent path | **PASS** | Proven on a real surfaced finding: no `--reason` → exit 64, **0 dispositions**; `override` aimed at a `surface` finding → exit 64, **0 dispositions, `(no rows at all)`** — the defect the builder found in his own work is genuinely fixed, verified by me performing the same wrong act; correct `answer` → one row, attributed, reasoned; **only then** did the package advance | `--by` is attribution, not authentication — stated by the builder in the schema, the CLI and the demonstration |
| AC7 | Quotation verification is exact, proven with a near-miss | **PASS** | Planted near-miss on my own pack: `QUOT-1` — *"script[0] quotes 83 characters that do not appear in the evidence it cites. A near-quote is a finding, not a pass."* Blocked. The same package also correctly raised `PRIV-2` for quoting internal-classified material — a second true positive, not noise | The 40-character floor is a declared false negative, disclosed in the coverage object itself |
| AC8 | Cross-format uses Phase 3's structure, not string similarity | **PASS** | `checkCrossFormat` (`src/verify/rules.mjs:502-565`) is set membership over `claim_id` per sibling — `XF-1` missing sibling, `XF-2` beat no sibling tells, `XF-3` long-form asymmetry. **No comparator, no distance function, no threshold anywhere in the file.** It also deliberately declines to re-check what `db/003`'s foreign key already makes unwritable — *"a control that cannot fail"* — which is the right instinct | XF made-to-fail proven by the suite (`AC8 — a beat the blog drops…`, asserts `XF-3`), not by my own plant |
| AC9 | Phases 1–3 still pass, and any file of theirs that changed is called out | **PASS** | `git diff --stat 1a6ba978..594d976a` — 18 files, **all** under `services/vlogops`; of Phases 1–3 only `README.md`, `RUNBOOK.md` and `package.json` (description) touched. **No Phase 1–3 source, migration or test modified.** CI at the exact SHA: 178 executed, 178 pass, 0 fail | On my machine one **Phase 1** anti-vacuity guard fails against current repository content — see finding N2. Not Phase 4's, and green in CI at this SHA |
| AC10 | CI covers the new work and still fails on zero executed tests | **PASS** | `vlogops-tests` run `31857532066` at `594d976a` — `EXECUTED SUBTESTS: 178 (pass=178, fail=0, skipped=0)`, conclusion `success`, 15 proof files listed including all three verification suites. The zero-subtest guard is in `run-vlogops-tests.mjs` and is asserted by a test. `secret-scan` green at the same SHA | `cockpit-private-apps` red at this SHA — pre-existing, out of scope by the Work Order, confirmed unrelated |

**All ten acceptance criteria PASS. The overall verdict is HOLD for one blocking finding recorded
below, which sits outside the numbered rows.**

## Evidence provenance

- **Reviewer home:** `C:/Fusion247PKA` (main). **I did not move into the reviewed checkout.**
- **Export:** `git archive 594d976a… | tar -x` into
  `…/scratchpad/veritas-wp4` — no worktree registered, no `.git` state touched. All code reading,
  all execution and all mutation-free attacks were performed **inside the export**.
- **Live runtime:** a disposable PostgreSQL 17.4 cluster created by me at
  `…/scratchpad/vpg`, port 55442, loopback only, database `vlogops_veritas`. **The managed Supabase
  project was never contacted.** `npm ci` was run inside the export only.
- **Branch worktree** `C:/Fusion247PKA-vlogops4` was read once, to re-run one failing Phase 1 test
  against the branch's own content. Nothing was written to it.
- **Repository `git rev-parse HEAD`: start `f0b1a164eb10d42a51cfc0133dbfb8a7fd43ac1d`, end
  `ed07d1d01927c2a01b524a46d022a9ede072e660`. THESE DIFFER, AND THAT IS RECORDED RATHER THAN
  SMOOTHED.** The delta is exactly one commit — `ed07d1d WP-3 Gate 1 PASS…` — made by **Larry**,
  concurrently, in the shared repository. **Veritas wrote nothing into the repository**: the only
  entries in `git status --porcelain` at the end are two untracked `Team Knowledge/Sources/` files
  that were already present at the start, and the Wayfinder modification present at the start was
  absorbed by Larry's commit. **No evidence in this receipt was gathered from `main`'s working
  tree except the intake window, whose effect is disclosed in AC1.**
- **Mutation/attack testing** was performed against the disposable cluster and the export only.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `psql -f db/001…004` on a fresh cluster | 0,0,0,0 | — | 15 tables; 004 re-applied a second time, exit 0, identical structure — **idempotent, proven not asserted** |
| `node bin/vlogops-intake.mjs records --from 2026-08-13 --to 2026-08-14 --privacy internal` | 0 | — | seed `ee35d89e…a7e4`, 12 members |
| `node bin/vlogops-compile.mjs compile --seed …` | 0 | — | pack `1e4b6857…d8bc`, 8 entries, bounded, 4 omitted |
| `node bin/vlogops-scribe.mjs draft --pack … --model stub` | 0 | — | package `903d6e15…c767`, `"MECHANICAL PLACEHOLDER TEXT — no language model was called"` |
| `node bin/vlogops-verify.mjs verify --package 903d6e15… --json` | **0** | — | `pass`, five dimensions with coverage, `advanceable: true` |
| `node bin/vlogops-verify.mjs verify --package a92ba9c9… ` (factual error) | **1** | — | `blocked`, `fact` only, `FACT-1` ×2 |
| `… --package b57e4b42…` (private detail) | **1** | — | `blocked`, `privacy` `PRIV-4/email` + `PRIV-4/phone`, plus `fact` `FACT-2` ×2 |
| `… --package 06be6b77…` (near-miss quotation) | **1** | — | `blocked`, `QUOT-1` (83 chars) + `PRIV-2` |
| `… --package c3256976…` (real `warwick-supplied` intake) | **1** | — | `rights: surfaced`, `RIGHT-3` |
| **ATTACK 1** raw `INSERT INTO vlogops.package_advance` on a blocked package | **1** | — | **REFUSED** by `package_advance_gate` trigger |
| **ATTACK 2** advance the blocked package citing the CLEAN package's passing verification | **1** | — | **REFUSED** — same trigger, before the FK is even reached |
| **ATTACK 3** forge a `verdict='pass'` `verification_run` for the blocked package, then advance | 0 then **1** | — | forged run inserted; **advance still REFUSED.** The gate reads *every* run, exactly as documented |
| **ATTACK 4** `COPY … FROM STDIN` into `package_advance` | **1** | — | **REFUSED** — the row trigger fires on `COPY` too |
| **ATTACK 5** `DELETE` / `UPDATE` the blocking findings | **1**,**1** | — | *"verification_finding is append-only; DELETE refused"* / *"UPDATE refused"* |
| **ATTACK 6** forge a disposition with empty reason / mismatched severity | **1**,**1** | — | `finding_disposition_reason_check`; `finding_disposition_finding_fk` on `(id, ordinal, severity)` |
| **POSITIVE CONTROL** raw `INSERT` advance on the CLEAN package | **0** | — | `INSERT 0 1` — **the gate admits as well as refuses, with the application out of the path** |
| `pg_ctl -m fast stop` → `start` → `state --package a92ba9c9…` | 0, 0, **1** | — | `undisposedBlocks: 2`, `advanceable: false`, both findings listed in full; raw-SQL advance still refused |
| `verify` re-run on the blocked package | **1** | — | `deduplicated: true`, same `verification_id`, cleared nothing |
| `override --verification 174ce442… --finding 0 --by Warwick --reason "…"` on a **surface** finding | **64** | — | refused; **`select count(*) from finding_disposition` = 0 before AND after; `(no rows at all)` for that verification.** The self-found defect is fixed |
| `answer … --by Warwick` with no `--reason` | **64** | — | refused; dispositions still 0 |
| `answer … --by Warwick --reason "…"` | **0** | — | one row: `surface / answered / Warwick / "I wrote this myself; it is estate material"` |
| raw SQL advance **after** the recorded answer | **0** | — | `INSERT 0 1` — the disposition, not the re-run, is what unblocks |
| `node test/run-vlogops-tests.mjs` (my cluster, `VLOGOPS_REPO_ROOT=C:/Fusion247PKA`) | 1 | **178** | 177 pass, 1 fail — `route1-records.test.mjs` anti-vacuity guard, Phase 1, environment-dependent (N2) |
| CI `vlogops-tests` run `31857532066` @ `594d976a` | success | **178** | 178 pass, 0 fail, 0 skipped |
| `bash scripts/secret-scan.sh --surface services/vlogops` (from the branch worktree) | **0** | — | 26 detection classes, **65 files scanned**, 0 secrets. *(Exit 2 `NOT SCANNED` when run from `main`, because the surface does not exist there — worth knowing)* |
| `gh pr view 110` | 0 | — | OPEN, **draft**, base `build-006/b6-03-scribe`, head `594d976a…` — exactly as ordered |
| `git ls-remote origin` | 0 | — | `594d976a…` = `refs/heads/build-006/b6-04-verification` **and** `refs/pull/110/head` — remotely reachable |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The map's gate sentence is satisfied literally and I reproduced it independently. Warwick can see which dimension objected and why, in one command |
| Design fidelity | **PASS** | Blocking is a schema property, not a return value — the pattern 002 and 003 established. Additive, `vlogops`-only, no grants, no RLS, no Phase 1–3 table altered |
| Functional proof | **PASS** | Every claim above was executed on the real CLI against real stored rows from a real chain I built |
| Integration | **PASS** | Real production path throughout: `intake → compile → scribe → verify → advance`. Nothing was reached only by a test calling it directly |
| Durability | **PASS** | Process restart, **database restart**, re-run, and four SQL routes with the application removed. This is the strongest evidence in the phase |
| Test quality | **HOLD** | 178 executed subtests, mapped 1:1 to the ACs, with anti-vacuity guards that genuinely fire. **But `AC3.2b — …and never recorded` asserts only `where rule like 'PRIV-4%'`, which is narrower than its own name and than the property the demonstration claims** — see D-1. Also N2 |
| Git truth | **PASS** | Branch, head, draft status, PR base and remote reachability all as reported. 18 files, all in the declared surface |
| Documentation truth | **HOLD** | README, RUNBOOK, the ruleset contract and the demonstration are unusually honest — the "does NOT claim" sections and the four-place unbypassability limit are exemplary. **One load-bearing sentence is materially wrong** — D-1 |
| Residual risk | **HOLD** | Every other limit is explicit, bounded and correctly classified. The privacy-value residual is not: it is disclosed as *"noise worth knowing about rather than a defect"*, which is the one classification it is not — D-1 |
| Completed automation | **n/a** | The Work Order explicitly declares this outcome **not intended to be automatic**, and the CLI header says so. The one property that *is* automatic — *a blocked package cannot be advanced by any client* — I proved at the database with the application entirely out of the path |

## Production caller and journey

`node bin/vlogops-verify.mjs verify --package <id>` → `loadConfig` (`VLOGOPS_DB_URL` from the
environment, never a file) → `getPool` → `verifyAndRecord` (`src/verify/store.mjs`) → reads the
package view from `story_package` / `story_claim` / `story_claim_citation` / `story_segment` /
`evidence_pack_entry` / `source_snapshot` / `source_rights` → the five `DIMENSIONS` in
`src/verify/rules.mjs` → canonical manifest → `verification_run` + `verification_finding` in one
transaction, with the deferred counts trigger → exit 0 or 1.

`advance` → `INSERT INTO vlogops.package_advance` → `package_advance_requires_clean_verification`
BEFORE INSERT → `assert_package_advanceable`, which joins **every** run of the package to its
findings and left-joins dispositions.

**The gate is not on this journey — it is underneath it.** I reached it with `psql` and with
`COPY`, having never loaded a line of the application, and it refused. That is the difference
between a control and a convention, and it is the single most important thing this phase delivers.

## Restart and durability

Blocked package `a92ba9c9…` (planted factual error, 2 undisposed `FACT-1` blocks):

1. Re-ran `verify` — `deduplicated: true`, same `verification_id`, **still blocked**.
2. `pg_ctl -m fast stop` (exit 0) → `pg_ctl start` (exit 0).
3. **New process, new server:** `state` → `verificationRuns: 2`, `undisposedBlocks: 2`,
   `advanceable: false`, both findings rendered in full with rule, detail and locator.
4. Raw-SQL advance after the restart — **refused, identical message.**

The block is rows. There is nothing in a process for a restart to lose, and I confirmed that rather
than reasoning about it.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** `services/vlogops/README.md` · `services/vlogops/RUNBOOK.md`
  (both extended) · the Wayfinder (Larry's).
- **Verified independently:** both extended substantially (+90 / +97 lines); RUNBOOK documents exit
  codes 0/1/64 including *"Nothing was written"*, the blocked-package procedure, and *"Do not edit
  rows to clear a finding"*. The ruleset contract `src/verify/contract/verification-v1.md` names
  every rule and its bytes are the `ruleset_id`.
- **The honest limit is present in all four required places** — migration header
  (`db/004…sql:60-67`), CLI header (`bin/vlogops-verify.mjs:13-17`), README (`:168-171`),
  demonstration (`:315-322`). **Nothing anywhere in the surface describes the gate as unbypassable**
  (`grep` for `unbypassable|cannot be bypassed|impossible to|foolproof` returns only the four
  disclaimers). This was the specific thing I was asked to confirm, and it holds.
- **What Larry's list missed:** `package.json`'s description was rewritten too — trivial, correct,
  non-blocking, recorded once.
- **Active documents that would misdirect a fresh instance:** one — see D-1.
- **Closure claims since the last receipt, and the receipt behind each:** the Wayfinder Phase 4 row
  reads *"IMPLEMENTED — awaiting assurance"*, which is the correct pre-receipt statement and claims
  no closure. Phases 1–3 rows each name their receipt and each **withholds** phase PASS for the
  Supabase reason. **No unbacked completion claim found.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1** | **HIGH** | **A privacy finding does not record the value — but the FACT dimension does, into the same immutable table, in the same run, and into the committed demonstration.** With the private detail planted, `verification_finding` ordinals 2–3 are correctly masked (`"n************d"`, `matched_length: 33`, *"The value is deliberately not recorded here"*). **Ordinals 0–1 record `detail: "…asserts number \"01632\"…"` and `evidence: {"token": "960111"}` verbatim** — the phone number, split across two `FACT-2` rows — and the `verification_run.manifest` carries them too (`select … ~ '960111' → t`). All Phase 4 tables **refuse DELETE and UPDATE**, so a value recorded there is unremovable short of dropping the schema. The digits are additionally committed at the reviewed head in `DEMONSTRATION-PHASE4.md:207,209`, in a **public** repository. **The blocking part is the claim, not the code:** `DEMONSTRATION-PHASE4.md:217` states in bold — *"The finding names the rule, the length and a masked shape — **never the value.** A privacy finding that copied the offending detail into the findings table, and from there into this document and into a public repository, would have spread the exact thing it exists to stop."* That is precisely what happened, by a different dimension, three lines above the sentence denying it. §4's parenthetical does disclose the two `FACT-2` findings and calls them *"noise worth knowing about rather than a defect"* — an honest disclosure with the wrong conclusion attached. The test that should have caught it, `AC3.2b — …and never recorded`, scopes its assertion to `where rule like 'PRIV-4%'`. **⚠️ Proportionality, stated plainly: the planted values are reserved fakes (`01632 960111` is Ofcom's drama range; `example.invalid` is reserved), so NO real personal data has leaked and there is nothing for Warwick to act on today.** What is wrong is the *statement of a delivered privacy guarantee* — a fresh reader, a Phase 5 builder or Warwick would reasonably conclude that verification never durably records a caught private value, and it does. **A sufficient correction is small and is Larry's to route:** either (a) correct the sentence and the test name to state exactly what is guaranteed — *the privacy finding never records the value; another dimension may* — or (b) suppress numeric tokens that fall inside a privacy match before they reach `detail`/`evidence`/`manifest`. **(a) alone discharges this finding.** | **blocking** — it gates the WP completion claim and the merge of PR #110, because it materially misstates a delivered privacy capability in the artefact Warwick reads and in a public repository | Larry to route; Keel |
| **N1** | LOW | Anyone with INSERT rights can write an arbitrary forged `verification_run` (I inserted `verdict='pass'`, `manifest='{}'`) for any package. It buys nothing — the gate reads every run and refused my advance regardless — but it pollutes the audit trail with a row nobody can delete, and `state` counted it (`verificationRuns: 2`). **Hobby-brain: PARK.** Anyone who can INSERT can also DROP; there is no consequence to Warwick | **non-blocking** | Larry — record and park |
| **N2** | MEDIUM | `route1-records.test.mjs` *"AC4 — the range demonstrably contains MORE than the bundle"* **fails on this machine** against both `C:/Fusion247PKA` and `C:/Fusion247PKA-vlogops4`: *"the rule selected everything in range (6 of 6) — 'smallest sufficient' proves nothing here."* It is **green in CI at the exact SHA** (178/178). This is a **Phase 1** anti-vacuity guard whose result depends on repository content at run time, so it can flip red with no code change — and it now has. Correct behaviour by the guard; a durability problem for the proof. **Out of Phase 4's accepted scope and not Phase 4's to fix** | **non-blocking** | Larry — record for the scheduled reconciliation |
| **N3** | MEDIUM | **Migration `004` has never been applied to the managed Supabase project**, exactly as `001`–`003` have not. This receipt is Gate 1 engineering assurance against a disposable local cluster and is **not** operational readiness; the Wayfinder already withholds phase PASS from Phases 1–3 for this reason and must do the same here. I could not inspect the live project (no MCP tools in this context), so I establish this by the record and by `live_authority: none`, not by measurement | **non-blocking** for Gate 1; **it is a hard bar on any phase-PASS or readiness claim** | Larry / Warwick |
| **N4** | LOW | Larry's DOCUMENT IMPACT omitted `services/vlogops/package.json` (description rewritten). Correct content, trivial | **non-blocking** | Larry |

## Verdict

**HOLD** — all ten acceptance criteria pass on evidence I produced myself, the gate refuses a
blocked package through four SQL routes with the application out of the path and admits a clean one,
and the block survives a database restart; but the demonstration states a privacy guarantee in bold
that the code does not deliver, three lines above its own disclosure of the counterexample, and that
sentence is committed to a public repository.

**What this HOLD gates:** the WP-4 completion claim and the merge of PR #110. **It does not block
safe continuation of the active route**, and it transfers nothing to me. One narrow corrective
dispatch on D-1, then **one focused confirmation of D-1 only** — nothing else here needs re-review.

## Next review trigger

Correction of **D-1** and nothing else. **A moved HEAD is not a trigger**; neither is this receipt,
a Wayfinder row, a Codex finding elsewhere, or any documentation commit that does not change the
privacy claim. Re-open the full gate only if the executable verification behaviour, the ruleset
contract bytes, the advance-gate schema or the accepted functional scope materially change.
