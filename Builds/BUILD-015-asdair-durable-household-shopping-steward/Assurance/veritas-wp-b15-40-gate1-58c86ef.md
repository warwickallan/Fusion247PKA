---
build: BUILD-015
scope: WP-B15-40 (Lane AB) — AC1–AC7, the full accepted functional set
gate: 1

boundary: WP-B15-40 "Lane AB — provenance persisted, quantities proven, holds honest" (WO-2026-08-13-10), and the outcome it promised — "the reconciled 39-line list carries persisted four-way provenance and a per-line quantity derivation that reproduces its own totals, with every remaining hold honest."

reviewed_sha: 58c86ef9c1f723b70dfeb915fc79a198db4c51f0
governance_sha: 335e1d69046451e7fa660e689ddfdd1c9d0d8d47
branch: build-015/b15-28-agentic-vision-prototype-v2
remote_reachable: true (git ls-remote origin -> 58c86ef9c1f723b70dfeb915fc79a198db4c51f0 on refs/heads/build-015/b15-28-agentic-vision-prototype-v2)

evidence_method: mixed — target worktree C:/Fusion247PKA-visionloop2 (live suite + disposable Postgres), plus two clean exports outside the repository for mutation testing and for a pristine-checkout re-run
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/96ff5632-2f85-40ab-8e7a-53655ca0c7fd/scratchpad/{vx3,coidx}
worktree_head_at_start: 58c86ef9c1f723b70dfeb915fc79a198db4c51f0
worktree_head_at_end: 58c86ef9c1f723b70dfeb915fc79a198db4c51f0
worktree_status_clean: true
review_ceiling: "proportionate — bind, then the promised outcome and its named acceptance requirements; no general estate audit" (dispatch)

verdict: HOLD
receipt_sha256: 132de83a9a661cfbcd71fea0577de97629bccb8ed7409c1100e1bca5a9d6ff8d
reviewed_by: veritas
reviewed_date: 2026-08-13
next_review_trigger: a production caller for REGULARS / RULE / WARWICK provenance is wired, OR the durable record is corrected to state that only PHOTO provenance is persisted through the production path and AC1's four-kind claim is re-scoped accordingly. A receipt, map wording or clerical repair is NOT a trigger.
---

## Scope reviewed

The seven numbered functional acceptance requirements of WO-2026-08-13-10 (AC1–AC7), graded separately, plus the promised outcome sentence they serve. AC0 is a target description, not a requirement, and is not graded.

Deliberately **not** in scope: Lane C/D/E/F, the Cockpit, vision/OCR/prompts (parked by Warwick), migration `020`'s own text (`db/**` was outside the worker's surface), the three tables with no migration, and estate-wide reconciliation. Assurance/release sequencing is not graded as a product requirement.

**Terminology binding, applied to this receipt itself.** Warwick's ruling — three readings by one model of one image are **correlated**; 2-of-3 is **CORROBORATION, never VERIFICATION** — binds this document. No result derived from run agreement is called verified anywhere below. Where this receipt says *verified*, it means *I executed the check myself against the artefact or the database*, never *the photograph was read correctly*.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | Provenance persists through the production path: real callers invoke the region and provenance writers in order; rows land for all four kinds (PHOTO, REGULARS, RULE, WARWICK); a row citing another shop's region is rejected **by the database** | **HOLD** | Seam proven for **PHOTO only** — `test/provenanceProductionSeam.dbtest.js`, 13 executed subtests against PostgreSQL 17.4 at 127.0.0.1:55432. Composite-FK mutation proof is committed, executable and self-asserting. Grant parity refused UPDATE/DELETE as `asdair_rw` | **The other three kinds have no production caller anywhere.** `pipeline/deps.js:46` imports exactly one writer — `insertPhotoProvenanceBatch`. REGULARS/RULE/WARWICK land only in `test/lineProvenance.dbtest.js`, which calls the writer directly, and which pre-dates this WP. Not on the journey. **This shortfall is not recorded in the durable record** |
| AC2 | A committed source-line → identity → purchase-quantity → item-count artefact, with a **test** that asserts the sum and names the line if it moves | **PASS** | `finalise/out/quantity-derivation.md` committed; `quantityDerivation.test.js` holds 39/53 as literals **in the test, outside the source it checks**; I re-derived the sum independently: 39 lines, quantity sum **53**. Mutation (one line 3→2) → RED, "no longer sums to 53. Derived 52" with per-line breakdown | Two non-blocking: the failure prints **all 39 lines** rather than isolating the moved one; and one sibling test in the same file is red on a fresh checkout (CRLF — F2 below) |
| AC3 | Investigation with a report; a clean negative is a complete answer | **PASS** | Clean negative independently confirmed: `008_shop_line_interpretation.sql` is a migration **filename**, and `grep -rn "needs_human" services/asdair/db/` returns nothing. The real finding (`reasonStillHolds` retains `leading_mark_disagreement` that a later stage settles) is durably recorded in `finalise/humanRouting.js`'s header | Reported only in a module header and on the map; there is no standalone return document. Adequate, but thin |
| AC4 | `human_state` is written by running code, proven against the disposable target | **PASS** | `test/humanState.dbtest.js`, 5 executed subtests, driving the **real** `applyTransition` from `shop/shopStore.js` — not `fakeClient.js` — and reading the row back out; invalid value refused `23514` | Live application is Larry's, correctly declared |
| AC5 | Corroborated, never verified: one test that fails if agreement is ever labelled "verified" in emitted output; one proving a 2-of-3 agreement with conflicting evidence still reaches HUMAN | **PASS** | `agreementIsNotCertainty.test.js`. **Both controls made to fail by me**: injecting `support_class: "verified"` → RED; removing the `vision_referral` cause → 3 tests RED. `SUPPORT` is a closed set {unanimous, corroborated, uncorroborated}. Allowlist is fail-safe by construction | I additionally scanned `out/browser-handoff.json`, which the test does **not** cover: all 6 "verify" occurrences are browser-agent instructions or the packet's own `sort_contract_verified` flag. **No emitted output calls photo evidence verified.** Clean |
| AC6 | 47/47 still closes in the artefact's own vocabulary | **PASS** | Re-executed `produce()` myself from the frozen runs: `observed 47, accounted 47, established 39, unsupported 8, resolved 30, skipped 8, routed 9, missing [], duplicated [], closes true`. 39 lines, 30 shoppable, 9 held, quantity sum 53 | none |
| AC7 | Correct the stale in-code claim that migration 020 is unapplied | **PASS** | `finalise/finalList.js` header now states 020 is applied, names the grant shape, and preserves the module's real invariant (it still depends on no table). Confirmed by diff and by reading the current file | none |

**Overall cannot be PASS while AC1 is HOLD.**

## The three things Larry asked to be tested rather than accepted — results

**1. The `resolved: 31 → 30`, `routed: 8 → 9` re-baseline — CONFIRMED CORRECT, both halves.** Re-executed from source, not read from the committed artefact: **39 products / 53 items is unchanged and the accounting still closes** (47 observed = 47 accounted; 39 established + 8 skipped; 39 established = 30 resolved + 9 routed; `missing: []`, `duplicated: []`). The moved line is `4 x 4pts. ARLA SEMI SKIMMED MILK`: `quantity 4`, `shoppable false`, `causes: ["vision_referral"]`, `unresolved: ["cross_region_duplicate_unresolved"]`, `support_class: "unanimous"`. **Unanimity is recorded as agreement and is nowhere promoted to truth.** This is a more honest list, not a worse one.

**2. Warwick's corroboration ruling — HELD, and enforced rather than asserted.** `corroborate.js` stated the rule in prose and nothing made it fail; `agreementIsNotCertainty.test.js` now does, and I made it fail. The one place the ruling could still leak — `browser-handoff.json`, which the test does not scan — is clean.

**3. The mutation proofs — REAL, and restoration confirmed.** I did not take Keel's four ad-hoc mutants on trust; I re-ran three equivalent mutations myself **inside an export outside the repository** (contract §"Evidence isolation"), asserting the source actually changed before each run and restoring by digest afterwards. All three went red. The fifth mutant — the migration re-applied with only `shop_line_provenance_region_fk` removed — is not an ad-hoc claim at all: it is **committed as a test**, it asserts that the mutation applied, it verifies schema-scoped constraint absence, and it executed. Restoration of Keel's own mutants is evidenced by `git status --porcelain` being empty on the target worktree at both start and end.

**4. `1079 tests, 0 failed, ZERO SKIPPED` — TRUE in the authoring worktree, and "zero skipped" is genuinely load-bearing. NOT green on a fresh checkout.** I proved the gate rather than trusting the number: with the DB environment removed, `provenanceProductionSeam.dbtest.js` reports `# skipped 3` and `humanState.dbtest.js` `# skipped 1`; with `ASDAIR_DB_RW_URL` alone removed, `# skipped 1`. So `# skipped 0` on the full run does prove all five DB-gated files executed — 33 DB-gated subtests in total. **But see F2: on a pristine checkout of this exact commit the suite is 1078 pass / 1 fail / exit 1.**

**5. The two edited pre-existing tests — Larry's ruling is CORRECT, and the evidence is stronger than the argument for it.** Both were re-anchored from the resolved `product` name (now null, because the line is routed) to `raw_reading`, which is the convention that file already used for the held ASDA milk line. Every original claim survives (`quantity === 4`; the two milks stay distinct, asserted as `length === 1` each), and an assertion was **added** that ARLA is now held. The decisive evidence: when I removed the AC5 routing cause, **`AC4: the explicit multiplier cases survive` was one of the three tests that went red.** A relaxed assertion does not detect the removal of the control it was relaxed around. This is a re-anchor, and a load-bearing one. **No revert warranted.**

## Evidence provenance

- **Target worktree** `C:/Fusion247PKA-visionloop2` @ `58c86ef` — full suite, per-file DB-gating probes, `produce()` re-execution, secret scan. `git rev-parse HEAD` and `git status --porcelain` identical and clean at start and end; nothing I ran wrote into it.
- **Export 1** — `git archive 58c86ef | tar -x -C .../scratchpad/vx3`, outside the repository. All mutation testing happened here. No `git worktree` was created; no `.git` state was touched.
- **Export 2** — `git -c core.autocrlf=true checkout-index -a --prefix=.../scratchpad/coidx`, a pristine simulation of a fresh checkout on this machine, with `node_modules` copied in. Used only for F2.
- **Live runtime** — disposable PostgreSQL 17.4 at `127.0.0.1:55432/asdair_test`. **No live/production database was contacted by this review.**
- **Reviewer's own repository** `C:/Fusion247PKA` — clean throughout; HEAD moved `c45b487 → dd86ceb` during the review (Larry committing Lane F's map update on `main`, unrelated to this scope). The Veritas contract blob is byte-identical at `335e1d6`, `c45b487` and `dd86ceb` (`d63d613d…`), so the governance basis was stable.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test` in `services/asdair/pipeline`, full DB env, target worktree | 0 | **1079** | 1079 pass, 0 fail, **0 skipped** |
| same, from a pristine `core.autocrlf=true` checkout of `58c86ef` | **1** | **1079** | 1078 pass, **1 fail**, 0 skipped — `AC2: the committed derivation artefact is in step with the committed list` |
| `node --test test/provenanceProductionSeam.dbtest.js` (full env) | 0 | 13 | pass |
| `node --test test/humanState.dbtest.js` | 0 | 5 | pass |
| `node --test test/lineProvenance.dbtest.js` | 0 | 6 | pass — this is where all four provenance kinds land, by **direct** writer calls |
| `node --test test/provenanceConstraints.dbtest.js` | 0 | 4 | pass |
| `node --test test/interpretPhotoRealEndToEnd.dbtest.js` | 0 | 5 | pass |
| same two dbtest files, **DB env removed** | 0 | 0 | `# skipped 3` / `# skipped 1` — proves `skipped 0` is real evidence |
| MUTANT A — `vision_referral` cause removed from `humanRouting.js` (export) | — | 33 | **3 RED**, incl. one of the two edited pre-existing tests; source restored, digest match |
| MUTANT B — one emitted line `quantity 3 → 2` (export) | — | 8 | **RED**: "no longer sums to 53. Derived 52", with the per-line breakdown; restored |
| MUTANT C — `support_class: "verified"` injected on a line (export) | — | 8 | **RED**: "lines row describes photo evidence with the certainty word verified"; restored |
| `produce()` re-executed from the three frozen runs | — | — | 39 lines · 30 shoppable · 9 held · quantity sum **53** · accounting closes |
| `bash scripts/secret-scan.sh --surface services/asdair/pipeline services/asdair/shop` | **1** | — | 4 hits, **all four in `services/asdair/pipeline/node_modules/**`** (one `sharp` wasm binary, three example connection strings in `pg-connection-string/README.md`). **Zero first-party hits.** Exit 1, not 2 — the surface was genuinely scanned |
| `grep -rn "needs_human\|shop_line_interpretation" services/asdair/db/` | 1 | — | no output — AC3's clean negative independently confirmed |
| `git ls-remote origin refs/heads/build-015/b15-28-…-v2` | 0 | — | `58c86ef…` — the reviewed head is remotely reachable |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | The promised outcome says the list "carries **persisted four-way provenance**". Through the production path it carries persisted **PHOTO** provenance. Everything else in the outcome sentence — the per-line derivation reproducing its own totals, and holds being honest — is delivered |
| Design fidelity | PASS | Serial product truth preserved; the allowlist is fail-safe by construction and its one discharge (`leading_mark_disagreement`) is justified by Warwick's own pack-identity ruling; `dbSafeTarget.mjs` was not weakened |
| Functional proof | PASS | The real production path was executed against a real database for the PHOTO seam, and the artefact was regenerated from source by me rather than read |
| Integration | **HOLD** | `deps.js:46` wires exactly one provenance writer. Three of the four kinds are reachable only by a test calling them directly — by this contract's definition, not on the journey |
| Durability | PASS | Append-only enforced **by Postgres** for `asdair_rw` (UPDATE and DELETE refused, row survived); ordering enforced by the database, not by application code |
| Test quality | PASS (with F2) | The strongest evidence in this package. Controls were made to fail; expected values are held as literals in the test, outside the source they check; the FK mutant asserts its own application. F2 is portability, not proof strength |
| Git truth | PASS | Branch, head and scope reported accurately; 15 files, **zero outside the declared file surface**; head remotely reachable |
| Documentation truth | **HOLD** | AC7's correction is right, and the map's account of the re-baseline is accurate and unusually honest. But the AC1 shortfall exists **only in Larry's dispatch message to me**, not in the durable record — the map's AC1 row reads as satisfied |
| Residual risk | **HOLD** | Same cause: a residual named in a chat message is not a bounded, recorded residual |
| Completed automation | **n/a — correctly reclassified** | Live persistence is explicitly declared MANUAL in the Work Order, in Keel's return and on the map. **No completed-automation claim is made, and none is implied by this receipt.** The real production event has **not** been exercised. Larry's own live confirmation write (own-shop accepted; cross-shop refused `23503`; rolled back) is evidence about the live schema, not about automation — and his recorded correction of his own first false positive, which was refused by `photo_has_model` rather than by the FK, is exactly the discipline this dimension exists to require |

## Production caller and journey

**On the journey (traced, executed):** `interpretPhotoWithDeps` → `pipeline/deps.js:45-46` → `insertRegionBatch` (`shopImageRegions.js`) → `insertPhotoProvenanceBatch` (`lineProvenance.js`) → real rows in `asdair.shop_image_region` and `asdair.shop_line_provenance`, each provenance row grounded in a region **of its own shop**, with the ordering refused by the database when inverted.

**Not on the journey:** REGULARS, RULE and WARWICK provenance. `grep` across `services/asdair` returns exactly one production import of the provenance writer, and it is the PHOTO one. `lineProvenance.js` validates all four kinds and `lineProvenance.dbtest.js` persists all four — **by calling the writer directly from a test.** No caller exists.

**Currently latent, not currently harmful:** the reconciled artefact is `{"PHOTO": 39}` with `additions: 0`, so for this shop there is no REGULARS/RULE/WARWICK row to lose. The gap bites the first time a regular, a rule or a Warwick decision has to be persisted with its origin.

**Also not on the journey (declared, not hidden):** the live database write. That is Larry's manual step and is correctly labelled everywhere I looked.

## Restart and durability

No process durability was claimed by this Work Package. What was claimed and proven: **append-only immutability at the database**, tested through the enforcing mechanism — connected as `asdair_rw`, `UPDATE` and `DELETE` refused by Postgres, and the row re-read afterwards to show it survived every attempt. That is the right shape of proof, and it is materially stronger than the sibling test that read the migration text.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** `finalise/finalList.js` — stale in-code claim that migration 020 is unapplied. **Verified corrected**, and the replacement preserves the module's real invariant rather than merely deleting the sentence.
- **What his list missed:** the AC1 four-kind shortfall. The active `ACTIVE SESSION WORK PACKAGE` block presents `AC1 provenance persists` with seam evidence and no qualification; a fresh Larry reading it would conclude four-way provenance persistence is delivered. `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:3220` and `:3315` still say four-way provenance persistence is incomplete — those older lines happen to be **more accurate than the current block**, which is the wrong way round.
- **Active documents that would misdirect a fresh instance:** the AC1 row of the current work-package block, on the above.
- **Minor, non-blocking:** `out/quantity-derivation.md` says the test "fails and names the line if this stops summing". It fails and prints **all** lines. True in substance, loose in wording.
- **Closure claims since the last receipt:** the map says of every lane "**NOT accepted**", and states the maximum permitted statement correctly. **No closure claim has been made without a receipt.** The recorded assurance gap for WP-B15-34→37 is honestly declared rather than papered over.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| F1 | **High** | AC1 requires rows to land for all four provenance kinds through the production path. Only **PHOTO** has a production caller (`deps.js:46`); REGULARS/RULE/WARWICK are reached only by a test calling the writer directly. The shortfall is stated in Larry's dispatch message and **nowhere in the durable record**, while the map's AC1 row reads as satisfied | **blocking** — it blocks marking WP-B15-40 complete, and blocks any statement that the list carries persisted four-way provenance. It does **not** block Lane C/D/F or any other safe work on the active route | Larry (record + scope decision); a wiring decision, if taken, is Warwick's |
| F2 | Medium | `AC2: the committed derivation artefact is in step with the committed list` compares byte-exact strings against a committed `.md`. With `core.autocrlf=true` — Warwick's global git setting — a fresh checkout of `58c86ef` converts that file to CRLF and the test fails. Measured: pristine checkout → **1078 pass, 1 fail, exit 1**. The `1079 / 0 failed` evidence is a property of the authoring worktree, in which the file was written by the generator and never re-checked-out | **non-blocking** — one guard test, no product effect; Linux CI would be green. But the acceptance-evidence claim must be restated as *"green in the authoring worktree; 1 CRLF-sensitive failure on a fresh Windows checkout"* | Larry to record; a one-line newline normalisation in the comparison is the obvious fix, inside the existing scope |
| F3 | Low | The AC2 failure message prints all 39 lines rather than isolating the moved one, while the artefact's own header claims it "names the line" | non-blocking | Larry, park |
| F4 | Low | AC3's investigation is reported only in a module header and on the map; there is no standalone return artefact for a requirement whose deliverable was defined as a report | non-blocking | Larry, park |
| F5 | Informational | `secret-scan.sh` on the declared surface exits **1** on four third-party `node_modules` files (a `sharp` wasm binary; three example connection strings in `pg-connection-string/README.md`), all untracked. **Zero first-party hits.** Larry's pre-declaration of this was exact | non-blocking | none |

**Not raised as defects, deliberately:** migration `020`'s unqualified `pg_constraint` guard (recorded on the map, verified intact in live, outside the worker's surface, and Silas's/Warwick's to decide) · `asdair.execution_packet` having no producer (Lane C's finding) · the three tables with no migration. All three are already recorded where they will be found, and re-raising them here would be the reviewer manufacturing work.

## Verdict

**HOLD** — six of the seven accepted functional requirements are evidenced to a standard that is, in places, better than the claims made for them; AC1 is met for PHOTO provenance only, three of its four required provenance kinds have no production caller, and that shortfall lives in a dispatch message rather than in the durable record.

**What this HOLD gates, precisely:** marking WP-B15-40 complete; any statement that the reconciled list carries persisted four-way provenance; and Codex on this boundary. **It gates nothing else.** Lanes C, D and F, and every other safe action on the active route, are untouched — the frontier remains the Wayfinder's.

**What it does not say:** it does not say the product is wrong. The 39-line list, its 53 items, its accounting, its quantity derivation and its nine honest holds are all independently reproduced above. Warwick's shopping list says what it actually knows.

**Answering the human question as asked:** on this evidence — no invented lines (47/47 accounted, `missing: []`, `duplicated: []`), no guessed quantities (every line carries a stated basis, and a refused quantity is routed rather than shopped), and no agreement dressed up as certainty (the unanimous ARLA line is held, and no emitted output calls photo evidence verified). The one thing the product cannot yet do is record **where a non-photo line came from** — and until F1 is discharged, no document may say it can.

## Next review trigger

A production caller for REGULARS / RULE / WARWICK provenance is wired, **or** the durable record is corrected so that AC1's claim matches what is delivered. One focused confirmation of F1 only. **Writing, committing or repairing this receipt is not a trigger, and neither is a moved head.**
