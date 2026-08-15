---
build: BUILD-006
scope: WP-1
gate: 1

boundary: >
  BUILD-006 Phase 1, Work Package WP-1 (WO-2026-08-14-01) and the outcome it promised —
  "Seed intake + durable Content Seed store. All three routes. Stable content identity,
  versioning, immutable snapshots, provenance, privacy state." Graded against the ten
  acceptance criteria of the Work Order AS AMENDED BY AMENDMENT 1, which is the binding form.
  The SHAs below are provenance; they are not the identity of this gate.

reviewed_sha: c35e4f915d694e37bca131d1092962b682928fe6
governance_sha: 64e9656d115f2e0004423ba002ba71d9ca8e9d85
branch: build-006/b6-01-content-seed-store

evidence_method: mixed — git archive export (byte-exact reading, mutation-free execution of the real CLI against a disposable Postgres provisioned by Veritas), plus GitHub Actions evidence at the exact reviewed head, plus read-only inspection of the target worktree and the canonical repository
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/0deb55dc-12c0-4c50-b8fb-8756fb3f0ecc/scratchpad/veritas-b6wp1
worktree_head_at_start: 64e9656d115f2e0004423ba002ba71d9ca8e9d85
worktree_head_at_end: 64e9656d115f2e0004423ba002ba71d9ca8e9d85
worktree_status_clean: true

verdict: PASS
receipt_sha256: e36dda2099e376ceb1e42457514f577ffc57fe2d5ba83ca0104f97f4134e498a
reviewed_by: veritas
reviewed_date: 2026-08-15
next_review_trigger: >
  Application of db/001_vlogops_content_seed.sql to the live Supabase project, or any change to
  executable intake behaviour, the seed identity scheme, the schema, the selection rule or the CI
  gate. NOT a moved HEAD; NOT this receipt; NOT documentation or clerical repair.
---

## Scope reviewed

**In scope:** the ten acceptance criteria of `WO-2026-08-14-01` in their AMENDED form, graded
separately, plus the WP's own accepted outcome — three human-initiated intake routes landing a
durable Content Seed with content-derived identity, immutable provenance-bearing snapshots and a
declared privacy state, on Postgres, surviving an abrupt kill.

**Deliberately NOT in scope, and named so nobody reads this receipt as covering it:**

- **Gate 2.** The Phase 1 North Star journey — *«can Warwick now put a real source into VlogOps and
  trust what came back»* — is a separate receipt and is **NOT** graded here. See §Verdict.
- **The live Supabase project.** The Work Order set `live_authority: none` and assigned the live
  apply to Larry after review. Nothing here connected to it and nothing here authorises connecting.
- Codex's external PR/release gate, and estate convergence.

**No narrowing was attempted by the dispatch.** All ten functional requirements were named, and all
five declared residuals were named. Scope was not widened: the ten ACs are the accepted WP scope.

## Accepted requirements

| # | Requirement (abbreviated from the amended Work Order) | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | Schema forward-only, idempotent, isolated from `asdair`/`session_report`/`ops`/`tower` — proven by identifier-token scan **and** runtime stub-schema proof | **PASS** | CI subtests 40–45 at `c35e4f9`; `FORBIDDEN_NAMESPACES = ['asdair','session_report','ops','tower','public']` (`test/helpers/sql-identifiers.mjs:79`); the token control is **mutation-tested in both directions** (catches `asdair.regulars` and quoted `"session_report"`, and is *not* fooled by a `'public'` privacy value or a comment); AC1(ii) stands up stub `asdair`/`session_report` schemas with data, applies, asserts the only created namespace is `vlogops` and neighbours are byte-identical, then tears down and re-asserts. Veritas applied the migration itself: `psql -v ON_ERROR_STOP=1 -f db/001_*.sql` → `APPLY_EXIT_UNPIPED=0`; `teardown.sql` → exit 0, `pg_namespace` count 0 | none |
| AC2 | Content-derived, stable identity; same source twice yields one seed | **PASS** | Veritas-executed, two separate OS processes over the real repository: both returned `seed_id 0c19424e…`, second `"deduplicated":true`; store held **1** seed row. Identity **independently recomputed by Veritas from the stored manifest using a canonicaliser written for this review, not imported from the service** — `MATCH: YES`. Survives a crash-equivalent restart: `pg_ctl -m immediate stop` → cold start → re-run → same identity, `deduplicated:true`. CI 7–14, 31, 32 | none |
| AC3 | Immutable snapshot; a later source mutation or deletion cannot alter an existing seed | **PASS** | Veritas-executed against the live store, all **unpiped**: snapshot `UPDATE` → exit 1 `source_snapshot is append-only`; snapshot `DELETE` → exit 1; `content_seed` `DELETE` → exit 1; identity-column `UPDATE` (`angle`) → exit 1; `intake_run` `UPDATE` → exit 1. **Refused by the database trigger, not the application.** Postgres re-hashed the stored bytes itself: 0 rows where `content_sha256 <> encode(sha256(content),'hex')`. CI 15–19 adds the mutate-then-delete-the-source proof and a made-to-fail integrity check | none |
| AC4 | Route 1 "smallest sufficient" over a real window, `Deliverables/` and git history first-class, proven on a window with ZERO session logs | **PASS** | Veritas-executed over the **real repository at `64e9656`**, window `2026-08-05`: 12-member bundle, carried entirely by `build-record`, `deliverable` and `git-commit`. Stored `selection`: `candidates_considered 185 · selected 12 · rejected 173 · rule_version records-smallest-sufficient-v1`. The rule is explicit in `src/routes/records.mjs` (one from every non-empty class, then fill by rank); both budgets are module constants no env var can widen. CI 25–30 | See D-2 — `selection` records counts, not rejected identifiers |
| AC5 | Route 2's five-field promotion contract; missing any field is a rejection, not a partial seed | **PASS** | Veritas-executed: `promote` without `--angle` → `EXIT_UNPIPED=65`, `promotion rejected`, nothing written; without `--origin` → `EXIT_UNPIPED=65`. Enforced in three independent layers — the route, `validateSeedRequest`, and `content_seed_promotion_contract` CHECK. CI 33–35, including *"the SCHEMA refuses a partial promotion even when the application is bypassed"* | See D-1 — omitting `--privacy` is accepted and silently defaults to `unclassified` |
| AC6 | Route 3 requires the angle as input; it is never inferred | **PASS** | Veritas-executed: `supplied` without `--angle` → `EXIT_UNPIPED=65`, *"the angle or question is required INPUT and is never inferred from the text"*; with an angle → sealed. No default, fallback or best-guess path exists in `src/routes/supplied.mjs`; the angle participates in the identity, so the same text under a different question is honestly a different seed. CI 36–39 | none |
| AC7 | Recovery proven by killing a REAL process, with a non-zero executed kill count | **PASS** | **CI at the exact reviewed head `c35e4f9`, ubuntu-latest:** `[AC7] kill cases executed: 4 of 4, via POSIX SIGKILL`; each of the four in-transaction stages reports `exit=null, signal=SIGKILL`, `after kill -> seeds=0 snapshots=0 ledger=0`, `after cold restart -> seeds=1 snapshots=1 status=sealed identity=… (unchanged)`. Subtest 24 asserts the non-zero count. See §Restart and durability for the Windows caveat and why it does not survive as a residual | none |
| AC8 | CI exists, path-filtered to the service **and itself**, fails on zero executed tests | **PASS** | `.github/workflows/vlogops-tests.yml` filters `services/vlogops/**` **and** `.github/workflows/vlogops-tests.yml`; `fetch-depth: 0` is present and load-bearing for Route 1. The runner fails on zero executed subtests **and** on zero test files. It **actually ran at the reviewed head**: run `31852566925`, `headSha c35e4f9…`, conclusion `success`, `EXECUTED SUBTESTS: 45 (pass=45, fail=0, skipped=0)`. Not an absent run read as green | none |
| AC9 | Startup config validation, aggregated, naming every problem; no value read from a repo file | **PASS** | CI 1–6, including *"EVERY problem is reported in ONE error, not just the first"* and *"nothing in this service reads a value from a file inside the repository"*. `VLOGOPS_DB_URL` is the only database variable. `.env.example` read by Veritas: names only, every value empty | none |
| AC10 | Secret scan clean over the declared surface, reported as exit code **and** coverage | **PASS** | Veritas-executed, both arms, unpiped. Committed surface: `SCAN_COMMITTED_EXIT_UNPIPED=0`, `SCANNED 29 file(s), 0 secret value(s) found`, 26 detection classes. Same scan runs in CI **before** `npm ci`, exit 0 | With dependencies installed: `EXIT=1`, from exactly 3 lines of `node_modules/pg-connection-string/README.md` — third-party documentation, `node_modules` gitignored, never in the repository. Reproduced by Veritas; matches the builder's disclosure exactly. Not suppressed, and correctly not suppressed |

## Evidence provenance

- **Export:** `git archive c35e4f915d694e37bca131d1092962b682928fe6 | tar -x -C <scratchpad>/veritas-b6wp1`.
  No `git worktree` was created; no `.git` state was touched.
- **Execution:** a disposable PostgreSQL 17.4 cluster provisioned by Veritas on `127.0.0.1:54341`
  (`initdb`/`pg_ctl`/`createdb` exits all 0, trust auth on loopback, no credential), used, torn down
  (`TEARDOWN_EXIT_UNPIPED=0`, `pg_namespace` count 0) and stopped. **The live Supabase project was
  never contacted by this review.**
- **Route 1 read the REAL repository** — `VLOGOPS_REPO_ROOT=C:/Fusion247PKA` — read-only. Dependencies
  were staged by copying the already-installed `node_modules` from the target worktree; no install ran.
- **CI evidence** was read at the exact reviewed head, not inferred from the absence of a red run.
- Repository `git rev-parse HEAD` start / end — `64e9656d115f2e0004423ba002ba71d9ca8e9d85` / identical.
- Repository `git status --porcelain` — unchanged start to end (three pre-existing untracked files,
  none of them written by this review).
- **Every exit code quoted in this receipt was captured unpiped.** One early capture in this review
  was taken through a `| head -3` pipe and reported a false `0`; it was discarded and re-taken
  unpiped, which is how the exit-1 immutability figures above were obtained.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| GitHub Actions `vlogops-tests` run `31852566925`, `headSha c35e4f9…`, event `pull_request` | success | **45** (pass 45, fail 0, skipped 0) | 7 proof files; AC7 4/4 real POSIX SIGKILLs |
| `psql -v ON_ERROR_STOP=1 -f db/001_vlogops_content_seed.sql` | 0 | n/a | schema + 3 tables + 3 indexes + 4 triggers |
| `node bin/vlogops-intake.mjs records --from 2026-08-05 --to 2026-08-05 --privacy internal` (×2, separate processes) | 0, 0 | n/a | `0c19424e…` `deduplicated:false` then `true`; 1 seed row |
| `node bin/vlogops-intake.mjs promote --origin … --angle … --file … --privacy internal` | 0 | n/a | sealed, 1 snapshot |
| `node bin/vlogops-intake.mjs promote` without `--angle` / without `--origin` | 65 / 65 | n/a | rejected, nothing written |
| `node bin/vlogops-intake.mjs supplied --text …` without `--angle` | 65 | n/a | rejected, angle never inferred |
| `node bin/vlogops-intake.mjs supplied --text … --angle … --privacy private` | 0 | n/a | sealed, 1 snapshot |
| `psql -c "update/delete …"` × 5 (snapshot, seed, ledger, identity column) | 1 ×5 | n/a | all refused by `vlogops.deny_mutation()` |
| `pg_ctl -m immediate stop` → cold start → re-run Route 1 | 0 | n/a | 3 seeds / 14 snapshots survived; identity unchanged; `deduplicated:true` |
| Independent identity recomputation from the stored manifest (Veritas's own canonicaliser) | — | n/a | `MATCH: YES` |
| `bash scripts/secret-scan.sh --surface services/vlogops .github/workflows/vlogops-tests.yml` (committed surface) | 0 | 29 files | 0 findings, 26 classes checked |
| same scan with `node_modules` present | 1 | — | 3 hits, all `pg-connection-string/README.md` |
| Store reconciliation after the journey | — | — | 3 seeds · 14 snapshots · 4 ledger rows (1 `deduplicated`); 12+1+1 = 14 |

**Not executed, and named rather than smoothed over:** the full suite was not re-run locally. The CI
run at the exact reviewed head is bound to these bytes, supplies the *real* POSIX signal that a
Windows re-run cannot, and re-running it would have been regeneration rather than evidence.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Delivers the WP's accepted outcome: three human-initiated routes, durable seed, content identity, immutable snapshot, provenance, privacy state. Versioning is recorded (`selection_key`, `supersedes`) with no behaviour built on it, exactly as Amendment 1 M2 authorised and bounded |
| Design fidelity | **PASS** | One additive namespace, no grants, RLS untouched, `pg` only, no second job-queue framework grown. The map's "reuse the control-plane worker" is deferred to Phase 6 with the reason recorded, not silently dropped |
| Functional proof | **PASS** | All three routes and both refusal paths executed by Veritas through the real CLI, in real processes, over real repository content — not through the test harness |
| Integration | **PASS** | The CLI is the production entry point and every route converges on one `intake()` seal; no component graded here was reached only by a test calling it directly |
| Durability | **PASS** | Single-transaction seal removes the third state rather than handling it; proven by four real kills at four in-transaction stages, and by a crash-equivalent cluster restart executed by Veritas |
| Test quality | **PASS** | Controls are made to fail: the identifier scan is mutation-tested in both directions, the integrity check is made to fail on tampered bytes, the runner fails on zero executed subtests **and** zero test files, and AC7 asserts a non-zero executed kill count. This is the estate's `a-control-is-not-evidence-until-made-to-fail` standard, met |
| Git truth | **PASS** | Branch, head, draft status and PR all as reported: `c35e4f9` is the PR #105 head, `OPEN`, `isDraft: true`, unmerged, and **remotely reachable** on `origin/build-006/b6-01-content-seed-store` |
| Documentation truth | **PASS (one non-blocking defect)** | `README.md`, `RUNBOOK.md` and `.env.example` match behaviour. `DEMONSTRATION.md`'s "what this does NOT show" section is honest and complete. The Wayfinder's §6 F3 correction claimed by Amendment 1 M1 was **independently verified present** at lines 277–283, with the superseded text preserved. One stale row — see D-3 |
| Residual risk | **PASS** | Every limitation the builder disclosed was reproduced and is correctly bounded. Nothing was found that the builder had concealed; two findings below were found by Veritas and are new |
| Completed automation | **PASS / n-a by design** | The three routes are **explicitly and correctly classified as manual** — human-initiated is the product, stated in the Work Order and in `bin/vlogops-intake.mjs`. The one automatic behaviour, crash recovery, is invoked by the **real production event** (the intake process dying), is observable, and was proven by killing real processes, not by manual invocation |

## Production caller and journey

`node bin/vlogops-intake.mjs <records|promote|supplied>` → `loadConfig(process.env)` (aggregated
validation, throws before any I/O) → lazy route import → `compileRecordsBundle` /
`promotionBundle` / `suppliedBundle` (rejection happens **here**, before a pool is opened) →
`getPool(config.databaseUrl)` → `intake()` → `withTransaction`: `content_seed` insert
`ON CONFLICT DO NOTHING` → `source_snapshot` inserts → `intake_run` insert → `COMMIT` → JSON on
stdout. **Every hop was traversed by Veritas from the shell, in the documented way.** A refused
intake never reaches the database at all — confirmed by the store holding no trace of either refusal.

## Restart and durability

- **Kill:** four real child processes parked inside an open transaction at `transaction-open`,
  `seed-inserted`, `snapshot-written` and `pre-commit`, then destroyed from outside. Store held
  **nothing** at every stage; a cold restart landed exactly one sealed seed with the identity
  unchanged. Nobody re-ran anything by hand.
- **The declared Windows caveat does not survive as a residual.** The builder was right that
  `child.kill('SIGKILL')` on Windows is `TerminateProcess`, and right to refuse to let the word
  "SIGKILL" stand unqualified. But CI at **this exact head** runs on ubuntu, and the log reads
  `killed via POSIX SIGKILL (exit=null, signal=SIGKILL)` for all four stages. **The genuine signal
  has been delivered against these bytes.** The caveat is now a correct historical disclosure about
  one platform, not an open gap.
- **Store restart:** `pg_ctl -m immediate stop` (crash-equivalent, no clean shutdown) followed by a
  cold start left 3 seeds and 14 snapshots intact, and a fresh process recomputed the same identity
  and correctly deduplicated.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** `services/vlogops/README.md`, `RUNBOOK.md`, `.env.example`
  (Keel's); the Wayfinder plan and the preflight census (Larry's).
- **Verified independently:** all three service documents exist and match executed behaviour. The
  Wayfinder's §6 F3 correction — which Amendment 1 M1 claimed was made "in the same change" — is
  genuinely present, dated, and preserves the superseded 2026-08-03 text rather than overwriting it.
  §9.2 line 483's prohibition (*"WP-1 may not be reported complete, closed or merge-ready on a green
  suite"*) is intact and is being honoured.
- **What his list missed:** the map's own durable **Phase status table** — see D-3.
- **Active documents that would misdirect a fresh instance:** one, D-3, low-probability.
- **Closure claims since the last receipt, and the receipt behind each:** **none.** No document on
  `main` or on the branch records BUILD-006 Phase 1 or WP-1 as complete, closed or PASS. There is no
  suppressed receipt at this boundary.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1** | MEDIUM | **A promotion or supplied seed created without `--privacy` is accepted and silently stored as `privacy_state = 'unclassified'`.** Executed: `promote --origin … --angle … --text …` with no `--privacy` → exit 0, sealed, `unclassified`. AC5 is satisfied on its own terms — the field is present, NOT NULL, from a closed enum, and no partial seed exists — but privacy state is one of the five contract fields, and a human who forgets the flag gets a stored seed rather than a refusal. `unclassified` is the conservative value and nothing consumes it at Phase 1, so nothing is exposed. It becomes load-bearing at the publication phases. **This is a product decision the ACs did not settle, reported once for Warwick.** | **non-blocking** | Larry to report; Warwick to decide |
| **D-2** | LOW | **The stored `selection` record holds candidate COUNTS, not the rejected identifiers**, so "smallest sufficient" is auditable as arithmetic but not as a list. The builder disclosed this and correctly labelled the named rejected files in `DEMONSTRATION.md` §1b as re-derived from the same shipped module rather than read from the store. AC4 never required the identifiers. Recorded because the demonstration reads more auditable than the durable record actually is | **non-blocking** | Larry to park |
| **D-3** | LOW-MEDIUM | **The Wayfinder's durable Phase status table is stale against its own amended header.** Line 561 reads `1 — Seed intake + Content Seed store | ⬜ NOT STARTED — THE FRONTIER. Authorised; begin here.` while lines 38, 86 and 97 of the same document record Phase 1 as ACTIVE, under implementation, dispatched, at draft PR #105. A fresh Larry reading only the status table would be told to begin work that already exists. Mitigated — and only mitigated — by the three explicit, later-dated supersession banners above it. **This is the recurrence root `CLAUDE.md` §Amendments names: an amendment that changed a phase's state without re-cutting the rows describing that phase.** It does not invalidate any acceptance evidence and does not make continuation unsafe, so it does not gate this Work Package. **It must be re-cut before Phase 1 is recorded PASS**, and it belongs to the Gate 3 boundary | **non-blocking** at Gate 1 | Larry |
| **D-4** | LOW | `--hold-at <stage>` is a test affordance carried in the **production** CLI. It is honestly documented, injects no failure and changes no code path, but a mistyped invocation parks a real process holding an open transaction indefinitely. Noted, not a defect worth a change on its own | **non-blocking** | Larry to park |

## Verdict

**PASS** — all ten acceptance criteria of `WO-2026-08-14-01`, in their amended and binding form, are
evidenced by executed proof at the reviewed head; the three routes, the identity, the immutability
and the real-kill recovery were exercised by Veritas itself through the production CLI, and the two
platform and scanner residuals the builder disclosed were reproduced exactly and are correctly bounded.

**⛔ WHAT THIS RECEIPT DOES NOT SAY, and it is the load-bearing half.** This is a **Gate 1**
verdict on a Work Package. **It is not, and may not be quoted as, evidence that Warwick can now put
a real source into VlogOps.** Warwick's chosen store is **Supabase**, and
`db/001_vlogops_content_seed.sql` has **never been applied there** — everything above was proven
against a disposable local cluster, which is precisely what the Work Order instructed. The exact next
real action in the intended context is *Larry applies the migration to the live Supabase project*, and
this review neither examined nor authorises it. **This is capability, correctly and completely
proven; it is not yet the Phase 1 human outcome.** Gate 2 on the Phase 1 boundary cannot PASS on this
evidence, and Larry may not record Phase 1 complete, closed, operational or ready on the strength of
this receipt. His maximum permitted statement remains *«Integrated at `c35e4f9` and submitted to
Veritas for assurance»*, plus this Gate 1 PASS on WP-1.

**The builder's evidence was not taken on trust.** `DEMONSTRATION.md` is builder evidence and was
treated as such: every claim graded above was independently re-executed by Veritas from its own
workspace against its own database, and the Route 1 identity Veritas obtained (`0c19424e…`) correctly
differs from the builder's (`ee329d3c…`) because the repository state differs — which is itself a
confirmation of the content-derived property rather than a discrepancy.

**Internal assurance only.** Veritas is the same runtime and the same model as Larry, structurally
separated from his judgement. **This is not external verification.** Codex's external PR/release gate
is still owed, and Warwick's merge decision sits on top of that.

## Next review trigger

Application of `001_vlogops_content_seed.sql` to the live Supabase project (which opens the Gate 2
question), or a material change to executable intake behaviour, the identity scheme, the schema, the
selection rule or the CI gate. **Not a moved HEAD. Not this receipt. Not documentation repair —
including the D-3 re-cut, which is expected and does not reopen this gate.**
