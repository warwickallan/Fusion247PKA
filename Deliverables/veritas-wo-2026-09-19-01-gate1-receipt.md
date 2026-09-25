---
build: BUILD-016
scope: WO-2026-09-19-01 — CareerAIR kgraph slice 1 (the scope Veritas determined; identical to the dispatched scope — all eight functional rows, no narrowing)
gate: 1
boundary: WO-2026-09-19-01 and the outcome it promised — every advert the scheduled email run acquires is harvested idempotently and claims-safely into the dedicated CareerAIR Neo4j graph (never the production Brain), failures visible and incapable of harming the run; and a report command produces a coverage table + claims-safe ATS keyword sheet for any harvested JD
reviewed_sha: n/a — the product lives at machine surface C:/.fusion247/private/careerair/** outside any git repository, per the WO's own frontmatter (worktree/branch n/a). Surface state pinned by 23 SHA-256 file digests over src/kgraph + tests/kgraph, identical at review start and end
governance_sha: 6c8f7e665c94ae0fccb6cfbea30dda332375e2c9
branch: n/a (machine surface); receipt written into the repository at HEAD e07a82750ffa9ddc4159dd9dba0e0015650adc5e, branch wo/2026-08-23-cockpit-grid
evidence_method: mixed — target machine surface (read + executed) for everything credential-free; dispatch-supplied verbatim captures (E1/E2/E3) for live-DB halves, per row
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/9244a5d0-74db-4bb3-818e-aa5d1d8f1013/scratchpad (digest files only; the mutation harness used its own tmpdir copies)
worktree_head_at_start: e07a82750ffa9ddc4159dd9dba0e0015650adc5e
worktree_head_at_end: e07a82750ffa9ddc4159dd9dba0e0015650adc5e
worktree_status_clean: unchanged — 6 pre-existing entries at start, same 6 at end; this receipt is the only addition
review_ceiling: 60 minutes / ~150k tokens (dispatch); review opened 2026-09-21T10:51:05Z, closed within both
verdict: HOLD
receipt_sha256: 44ab738a620a9758d9b8822739b7362107e8d79cb12bcc72476f73022ec35432
reviewed_by: veritas
reviewed_date: 2026-09-21
next_review_trigger: ONE focused confirmation of finding 2 (AC8's report-from-a-run-acquired-advert conjunct, evidenced by executed output); thereafter only a material change to the promised outcome
---
## Scope reviewed

WO-2026-09-19-01 (BUILD-016 CareerAIR kgraph slice 1), Gate 1, functional requirements AC1–AC8 as written in the Work Order including its read-back amendment. The boundary's promised outcome: every advert the scheduled email run acquires is harvested, idempotently and claims-safely, into the dedicated CareerAIR Neo4j graph (never the production Brain), failures visible and incapable of harming the run; and a report command produces a coverage table + claims-safe ATS keyword sheet for any harvested JD. The dispatch named all eight numbered rows — no narrowing detected, none performed. Deliberately not in scope: sentence embeddings, browser-sourced adverts (R4), the Amendment-8a parked credential-file finding (R6, noted only), the Wayfinder Amendment-4 ACTIVE SESSION WORK PACKAGE (a different logical boundary, 2026-08-25 session — not this gate's scope). Gate 2 is not attempted here.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | Harvest idempotent — MERGE of JD/Employer/Title/Requirement/Term over HTTP tx API; second run adds ZERO nodes and ZERO rels, counts before/after in the test | **PASS** | Structural MERGE (`ops.mjs` op:'MERGE'; `cypher.mjs` ON CREATE); `idempotency.test.mjs` asserts first-run nodes>0 then second-run 0/0 (executed, in 58/58); mutations AC7(a)×2 killed (6 and 4 tests red); live: E1 second pass 0 nodes / 0 rels over 304 adverts — supplied verbatim, arithmetically coherent with Amendment 8b | R1: fixture half labelled verbatim in `mutation.mjs:13,33`; live half supplied (E1), not re-executed by Veritas (no credentials, per dispatch) |
| AC2 | Master seed idempotent — 4 masters parse to EvidenceBullet/IN_MASTER/PROVEN_FOR{weight}; re-run adds zero duplicates | **PASS** | `seedMasters` content-derived bullet keys, weight ON CREATE only; `idempotency.test.mjs:98–108` re-seed 0/0 (executed); E1 `masters=4`, second pass 0/0 | none |
| AC3 | Report — coverage table (covered/adjacent/gap, PROVEN_FOR-ranked for the JD's title family) + ATS keyword sheet; never_claim=true and platform held=false terms NEVER appear | **PASS** | One structural exclusion predicate (`report.mjs:71`), nothing downstream re-admits; `report.test.mjs` in 58/58; mutation AC7(b) killed (3 red); live: E2 against real 48-requirement JD 1595, supplied | R3: cosmetic title-family display truncation, non-blocking (finding 3) |
| AC4 | Claims seed fail-closed — harvest init MERGEs PMP, PMQ, PRINCE2, APM, Scrum Master with never_claim=true; report REFUSES (non-zero, clear message) without it | **PASS** | Exact five terms in `terms.mjs:38–44`; `planClaimsSeed` first in every harvest and seed invocation, `always:{never_claim:true,claims_seed:true}` repairs drift; report exit 4 REFUSED path read at `careerair-kgraph-report.mjs:40–45`; seed-clobber mutation killed (4 red); NOT RUN exit 3 without creds proven by my own execution; E1 `claims seed: PRESENT` | none |
| AC5 | Pipeline hook failure-isolated — scheduled run invokes harvest additively; ANY graph failure leaves run and card untouched, failure visible in outcome detail; CAREERAIR_KGRAPH_DISABLED=1 bypasses | **PASS** | `hook.mjs` whole-body try/catch returns status enum, never throws; call in `process.mjs:396–398` deliberately bare and default-wired; `process-hook.test.mjs` asserts harvested/unwired/failed/disabled all visible in detail (executed); mutation AC7(c) killed (4 red — guard removal aborts the simulated run); real event exercised `harvested` and `no-new-adverts` paths (E3); summary card code untouched | Production has not yet exercised the `failed` path live — proven by test + mutation, which the AC accepts |
| AC6 | Containment — writes only to the dedicated instance; connection REFUSES port 7474, 7687, or no explicit port; both refused shapes test-proven | **PASS** | `assertSafeNeo4jUri` refuses both shapes at client CONSTRUCTION (`connection.mjs:38–62`); `containment.test.mjs` in 58/58; mutations AC7(d)×2 killed (3 and 2 red); live URI :7475 per Amendment 8b; no other write path exists in the modules read | none |
| AC7 | Mutation-proven — (a) idempotency, (b) never_claim filter, (c) hook guard, (d) URI refusal: each RED with non-zero executed count and provably changed source, restored GREEN; (a) carries the mandatory fixture label | **PASS** | Executed by Veritas: baseline 58/58 green, **7/7 killed** (failing counts 6/4/3/4/3/2/4, all non-zero); harness mutates COPIES in a tmpdir (real tree proven untouched — 23 file digests identical start/end); match and change digest-verified (`mutation.mjs:131–150`); label verbatim at lines 13 and 33 | none |
| AC8 | The real production event — a REAL scheduled run harvesting a REAL newly acquired advert, **and the report generating from it**; Larry executes and evidences | **HOLD** | First conjunct PROVEN: run 173 (`careerair-email:2026-09-20:17:00`) harvested 12 run-acquired adverts with no manual involvement; E3 arithmetic reconciles exactly (186+201=387 nodes, 633+622=1,255 rels, 2,814+387=3,201, 7,646+1,255=8,901, 304+12=316 JDs); independently corroborated: board file `runtime/board/careerair-email-2026-09-20-17-00.md` written 17:07 that day, header consistent with 12 new opportunities; task `CareerAIR-Email-1700` exists and Ready; launcher carries the env line. **Second conjunct UNEVIDENCED: no report has been generated from a run-acquired advert.** E2's report is dated 2026-09-19 against JD 1595, harvested manually BEFORE the production event | Blocking. An unknown on a named half of a mandatory acceptance row is HOLD, never a qualified pass |

## Evidence provenance

- Inspected: the target machine surface `C:/.fusion247/private/careerair/**` (read-only per GL-012, this exact subtree; no `C:/.fusion247/*.env` loaded, opened, parsed or echoed) — all 10 src/kgraph modules, all 13 tests/kgraph files, both scripts, the four process.mjs hunks, the launcher cmd, the design schema sketch, terms/ops/report internals. Executed: all four suites, the mutation harness, three no-credential NOT RUN probes, three scoped secret scans, `node --check`, `schtasks` query, board-file inspection (content read redacted; nothing quoted).
- Surface integrity: 23 SHA-256 digests of src/kgraph + tests/kgraph taken at review start and end — **identical** (the mutation harness provably mutated copies only).
- Repository (governance/receipt home only — the product does not live here): `git rev-parse HEAD` start/end `e07a82750ffa9ddc4159dd9dba0e0015650adc5e` / same; `git status --porcelain` 6 pre-existing entries, unchanged set start to end; this receipt is the only file Veritas adds.
- Live-DB evidence (E1, E2, E3): supplied verbatim in the dispatch, per its declared no-live-database boundary. Assessed for coherence, not re-executed; corroborated locally where a durable artefact exists (board file, scheduled task, launcher line, code path). Each such row is marked "supplied" above — none is presented as Veritas-executed.
- Governance contract verified byte-identical to the head blob: `git rev-parse 6c8f7e6...:Team/Veritas.../AGENTS.md` = `d63d613d0c4001e6476a750316fa3193bd6ee2d4` = `git hash-object` of the loaded file.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node tests/kgraph/run.mjs` | 0 | 58 | 58 pass, 0 fail, files=9 |
| `node tests/kgraph/mutation.mjs` | 0 | 58 baseline ×8 runs | baseline green; 7/7 mutants KILLED, failing counts 6/4/3/4/3/2/4 |
| `node tests/gate/run.mjs` | 0 | 97 | 97 pass, 0 fail — unchanged |
| `node --test tests/email/*.test.mjs` | 0 | 206 | 206 pass, 0 fail — unchanged |
| `node tests/kgraph/live-proof.mjs` (creds absent) | 3 | n/a | `NOT RUN — live credentials absent` — fail-closed proven |
| `node scripts/careerair-kgraph-harvest.mjs` (creds absent) | 3 | n/a | NOT RUN, names required vars, reads no env file |
| `node scripts/careerair-kgraph-report.mjs 1595` (creds absent) | 3 | n/a | NOT RUN — same pattern |
| `bash scripts/secret-scan.sh --surface .../src/kgraph/` | 0 | 10 files | 0 secret values |
| `bash scripts/secret-scan.sh --surface .../careerair-kgraph-harvest.mjs` and `...report.mjs` | 0 | 1 file each | 0 secret values |
| `node --check src/email/process.mjs` | 0 | n/a | syntax OK (settled a grep rendering artefact — raw bytes are proper `//` comments) |
| `schtasks /query /tn CareerAIR-Email-1700` | 0 | n/a | exists, Ready, next run 21/09/2026 17:00 |
| `runtime/board/careerair-email-2026-09-20-17-00.md` | n/a | n/a | exists, mtime 2026-09-20 17:07 — durable local corroboration of run 173 |
| E1 manual two-pass harvest · E2 report JD 1595 · E3 run-173 outcome rows + graph delta | n/a | n/a | **supplied verbatim by dispatch, not executed by Veritas**; E3 arithmetic reconciles exactly; E1/E2 consistent with Amendment 8b |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | The slice delivers the approved direction (Amendment 8: extract from CVs by title, reverse to build; lexical + title axis only; nothing working broken — gate/email suites unchanged-green at my execution) |
| Design fidelity | PASS | Schema sketch followed; MERGE-only additive writes; read-only Postgres (SELECT only, no DDL); kgraph naming per read-back amendment (d); journey.mjs untouched as permitted (e); no new runtime deps (native fetch) |
| Functional proof | HOLD | Harvest path proven end-to-end by the real production event; report path proven live only against a pre-run manually harvested JD — the run-acquired-advert report (AC8 second conjunct) has never been executed |
| Integration | PASS | Four additive hunks confirmed in process.mjs (import, default-wired dep, bare awaited call at the assessCreated seam, outcome-detail rows); launcher `--env-file-if-exists` line present; the real scheduled task consumed it |
| Durability | PASS | Graph state survives across runs (run after 173 processed 0 cleanly per 8c); idempotent re-harvest is the recovery property and is proven live (E1). Recorded honestly: the product lives off-repo on the accepted GL-012 machine surface — no git/remote durability, which is the WO's own accepted design, not a defect this gate can raise |
| Test quality | PASS | 58 executed subtests with zero-count guards; 7/7 mutants killed with digest-verified source changes and non-zero red counts; NOT RUN paths exit non-zero (proven by execution); fake graph carries MERGE-key semantics |
| Git truth | PASS | The WO, Amendments 8b/8c and the dispatch state where the work lives and its status truthfully; completion explicitly NOT claimed pending this gate ("integrated ... and submitted to Veritas for assurance") — the correct maximum statement |
| Documentation truth | PASS | Amendments 8–8c agree with the code and evidence read; no active document found misdirecting the frontier. Non-blocking: the R2 residual's mechanism is misdescribed (finding 1) — it lives in the dispatch/return record, not in an active instruction |
| Residual risk | HOLD | R1 declared with the mandatory label and its live half supplied; R2 mechanism corrected (finding 1, still LOW); R3 cosmetic; R4 explicit out-of-scope; R5 proven by execution; R6 noted only, parked at 8a. The one residual that moves a verdict is AC8's unexecuted report conjunct, and it does |
| Completed automation | PASS | For the intended-automatic outcome (scheduled-run harvest): the REAL production event invoked it (run 173, zero manual involvement), from the stable approved runtime (Windows task → cmd → env-file-if-exists), observably (outcome-detail status enums, never silent — `no-new-adverts`/`skipped`/`failed` all visible states with test proof), with no Larry step. The report command is manual by design and claimed as such |

## Production caller and journey

Windows scheduled task `CareerAIR-Email-0800/1200/1700` → `scripts/careerair-email-run.cmd` (line 2 carries `--env-file-if-exists=C:/.fusion247/careerair-neo4j.env`, missing-file-safe) → `careerair-email-run.mjs` → `createEmailProcessor` (`kgraphHook` DEFAULTS WIRED to `runKgraphHook` — no entry-script change needed) → per message, after `assessCreated` → `runKgraphHook` (kill-switch → ids → config-from-env → `harvestAdverts`) → `createHttpTxClient` (AC6 containment asserted at construction) → dedicated graph :7475 → status object into `detail.kgraph`/`kgraph_wired`. Every hop read in source; the chain end-to-end evidenced by run 173. The report (`careerair-kgraph-report.mjs`) is a manual command by design; its production consumption against a run-acquired advert is the unexecuted hop (AC8 HOLD).

## Restart and durability

No daemon in scope — the hook lives and dies with each scheduled run (fresh process per run). Durability is the graph's: additive MERGE means a re-run repairs rather than duplicates (proven under fixture and live, E1); a failed harvest is visible and re-harvestable by id. Kill-and-revive per se n/a with a reason: no long-lived process is claimed.

## Documentation contradiction scan

- Larry's declared DOCUMENT IMPACT (WO): Wayfinder plan (re-cut at integration — done, Amendments 8b/8c), the graph proposal, the schema sketch. Verified: all three exist; 8b/8c match the evidence and code read.
- What his list missed: nothing material found within this boundary's active documents.
- Active documents that would misdirect a fresh instance: none found. (The Amendment-4 ACTIVE SESSION WORK PACKAGE remains the map's most recent ASWP heading and belongs to the 2026-08-25 boundary; Amendments 8–8c supersede the frontier clearly enough that a fresh reader is not misdirected.)
- Closure claims since the last receipt: none for this boundary — 8c explicitly withholds completion pending this verdict, which is correct. WO-2026-08-29-01 `closed-already-satisfied` (8a) is a prior, separate boundary, parked by 8a for the next BUILD-016 reconciliation — noted, not re-reviewed.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| 1 | LOW | R2's mechanism is misdescribed: no delete op exists anywhere in the write path, so a superseded adopted requirement set leaves the old Requirement nodes ATTACHED via their HAS_REQ edges — the report would surface stale requirement rows and their (admissible-only) terms, not detached orphans off the traversal. Claims exclusion is unaffected (the sheet predicate governs every term regardless of which requirement mentions it). Correct the residual's wording at reconciliation | non-blocking | Larry |
| 2 | MEDIUM | AC8's second conjunct — "and the report generating from it" — has no evidence: no report has been executed against any of run 173's 12 run-acquired adverts. E2 predates the production event and used a manually harvested JD | **blocking** — it blocks marking WO-2026-09-19-01 complete and any closure of this boundary. It blocks nothing else on the active route | Larry |
| 3 | LOW | R3 cosmetic truncation in the report's title-family display string (dispatch-reported; `renderReport` also caps evidence text at 120 chars by design) | non-blocking | Larry (reconciliation) |
| 4 | n/a | R6 credential-shaped file in runtime/ — already found by Keel, already parked at Amendment 8a with Warwick's disposition owed. Noted per dispatch instruction; not reviewed further | non-blocking (parked) | Warwick |

## Verdict

**HOLD** — seven of eight functional requirements PASS on executed or corroborated evidence; AC8's report-from-a-run-acquired-advert conjunct has never been executed, and an unknown on a mandatory acceptance property is a HOLD, never a qualified pass.

**Discharge — ONE focused confirmation of finding 2 only.** The exact next event: Larry executes `node --env-file=C:/.fusion247/careerair-neo4j.env scripts/careerair-kgraph-report.mjs <id>` for one of run 173's twelve run-acquired opportunity ids (one WITH an adopted requirement set exercises the full table; the requirement-less one, if chosen, must show a visible empty state, not a crash). Measured state this rests on (supplied, E3): the graph holds those 12 JDs and the claims seed is present, so the production path will pass the exit-4 seed gate and the exit-5 existence gate and render. That event has NOT been executed — that is precisely what is owed. Verbatim output pasted to the resubmission discharges it; no re-review of AC1–AC7 is owed or permitted for this boundary.

## Next review trigger

The ONE focused confirmation above (AC8's report conjunct, evidenced). After that, nothing re-opens this gate except a material change to the promised outcome — executable behaviour, accepted functional scope, a load-bearing interface, or runtime wiring. A receipt, documentation or clerical commit is not a trigger.
