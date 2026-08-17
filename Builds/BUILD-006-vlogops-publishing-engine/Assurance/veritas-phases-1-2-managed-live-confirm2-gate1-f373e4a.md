---
build: BUILD-006-vlogops-publishing-engine
scope: phases-1-and-2-managed-supabase-live-acceptance — SECOND FOCUSED CONFIRMATION, F2-5 ONLY
gate: 1

boundary: >
  BUILD-006 Phase 1 (seed intake + durable Content Seed store) and Phase 2 (Source Compiler /
  evidence pack), at the managed-Supabase live-acceptance boundary — the same logical boundary
  graded at 5254f15 and 2877dfb. This is the ONE focused confirmation of the single surviving
  blocking finding, D-7 / requirement F2-5, that the predecessor receipt named as its own next
  trigger. It is not a re-review: no product code changed between 2877dfb and f373e4a, and the
  eight PASSed requirements are not re-derived.
  THE SHAs BELOW ARE PROVENANCE, NOT THE IDENTITY OF THIS GATE.

predecessor_receipt: veritas-phases-1-2-managed-live-confirm-gate1-2877dfb.md   # HOLD, eight of nine PASS
predecessor_receipt_sha256: ac7198b4ee551ae26ba9622e8b107eb4a031ed92e7775c0428b34a72ac604b48
companion_receipt: veritas-phases-1-2-managed-live-confirm2-gate2-f373e4a.md   # Gate 2 — PASS

reviewed_sha: f373e4a3e26a404ad49038248b017036fc8f9cc9
governance_sha: f373e4a3e26a404ad49038248b017036fc8f9cc9
branch: main
remote_reachable: true

evidence_method: >
  mixed — (a) the committed raw capture at f373e4a, read in place; (b) the target checkout at
  f373e4a for the compiler source and the CLI's test affordance; (c) LIVE EXECUTION by this
  reviewer of the compile CLI against a deliberately dead 127.0.0.1:1 URL in its own workspace,
  to MEASURE the boot-to-first-connect floor that decides this verdict. No credential, no
  connection to the managed project, nothing written to any store.
evidence_workspace: >
  C:/Fusion247PKA (repository, read in place) and
  C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/058cb015-e803-4b49-9e9b-0819935f9eca/scratchpad/veritas-g24
  (ephemeral, outside the repository; one dummy env file with an unreachable URL and no secret;
  never committed)
worktree_head_at_start: f373e4a3e26a404ad49038248b017036fc8f9cc9
worktree_head_at_end: f373e4a3e26a404ad49038248b017036fc8f9cc9
worktree_status_clean: true
worktree_state_disclosure: >
  `git status --porcelain` EMPTY at start; at end it shows only the two untracked receipts this
  review authored under Builds/BUILD-006-vlogops-publishing-engine/Assurance/. HEAD identical at
  start and end. No tracked file modified. The repository did not move under this review.

review_ceiling: 15 minutes elapsed / ~45k tokens — honoured, not extended
credential_surface_refused: >
  C:\.fusion247 root, refused again per GL-012 §4. No credential was read, requested, inferred
  or used; no connection to the managed project was attempted; Larry was not asked for one.

verdict: HOLD
receipt_sha256: 112b3b548a8eeb62f8485a447338d46fdbcbeaea2f30adb588bb9d09963e6223
reviewed_by: veritas
reviewed_date: 2026-08-17
next_review_trigger: >
  A mid-compile SIGKILL capture whose window is LOCATED INSIDE THE OPEN TRANSACTION — the
  product's own `--hold-at pack-inserted` or `--hold-at entry-written`, with VLOGOPS_HELD_AT
  printed before the kill — then ONE focused confirmation of F2-5 alone. NOTHING ELSE reopens
  this gate: not a moved head, not a receipt, not the map, not a clerical repair, and not the
  eight requirements this boundary has PASSed.
---
## Scope reviewed

**F2-5 alone.** This is the ONE focused confirmation of the single blocking finding (D-7) that my confirmation receipt at `2877dfb` named as its own next trigger. **The eight requirements already PASSed are not re-graded**, and I checked whether this delta damaged any of them: it did not — `git show --stat f373e4a` touches three evidence files, two of my own receipts, the map (one line), and `RUNBOOK.md`. **No product code, no SQL, no migration.**

**The commissioning question is satisfied, and narrowly.** *«What changed that could plausibly change my answer?»* — a capture that did not exist now exists (`## F2-5` in `live-proofs-raw.txt`). That is a material change to the evidence for the held requirement. Nothing else in this delta reopens anything.

**Deliberately not in scope:** the other eight rows · Phases 0 and 3–7 · the §9 programme criteria · the Tower/Codex gate · estate reconciliation · the RLS park. G2-4 and the Gate 2 journey are in the companion receipt.

## The question Larry asked me to answer, answered first

> *«Does this capture evidence the REQUIREMENT, or only the mechanism?»*

**Neither, and I established it by measurement rather than by reading the capture.**

The capture kills the compile at **350 ms**. I measured what the compile CLI is still doing at 350 ms, on this machine, against a socket that refuses instantly — so the figure contains **zero** network latency and **zero** query time:

```
$ VLOGOPS_DB_URL="postgresql://u:p@127.0.0.1:1/postgres" node bin/vlogops-compile.mjs compile --seed fbe257f3…
run1 327 ms · run2 317 ms · run3 337 ms   (wall clock, spawn → process exit on ECONNREFUSED)
```

**317–337 ms is the floor for node boot + module load + config validation + reaching the first connection attempt.** The kill at 350 ms therefore leaves roughly **13–33 ms** for: the TLS handshake to a managed Supabase project, authentication, `BEGIN`, `select … content_seed`, `select … source_snapshot` over twelve snapshots (the completing run reports `entry_bytes 680128`), `planPack`, the `evidence_pack` insert, eight entry inserts and the `compile_run` row.

**On the measured timing the SIGKILL almost certainly landed before the transaction opened — plausibly before the connection was even established.** In that case the capture's three assertions are all trivially true of a process that had done nothing: the store is unchanged because nothing was attempted, and the re-run reports `deduplicated:false` because there was never anything to deduplicate against. **It is not evidence that an interrupted compile rolls back; it is evidence that a compile killed during startup writes nothing.**

**The harness cannot tell the difference, and says so without knowing it.** Its branch detection is `[branch] the kill landed PRE-commit (no pack was printed)` — a test that returns "PRE-commit" identically for *killed after inserting eight entries* and for *killed before connecting*. Branch **detection** was the improvement I praised at the last gate; here the detected branch is not the property the requirement is about.

**This is the fourth occurrence of `acceptance-proves-mechanism-not-outcome` in this evidence directory, and it moved one level down rather than being closed:** the first pass had no capture, this pass has a capture whose kill window is unlocated.

## The discharge route exists inside the product, and no capture in the directory uses it

`bin/vlogops-compile.mjs:109-121` implements `--hold-at <stage>`, and `src/compiler.mjs` emits four stages **inside the open transaction**: `transaction-open` (line 66), `pack-inserted` (129), `entry-written` (151), `pre-commit` (168). It prints a positive stdout marker, `VLOGOPS_HELD_AT <stage>`, and holds the process open with a deliberate keepalive. Its own comment states the purpose exactly:

> *"it parks a real process inside a real open transaction so an external kill lands in a known window. It injects no failure, fakes nothing, and changes no code path."*

`grep -n "HELD_AT\|hold-at" live-proofs-raw.txt managed-state-capture.txt README.md` → **no match, exit 1. Not one capture in the directory uses it.** A capture that runs `--hold-at pack-inserted` (or `entry-written`), shows `VLOGOPS_HELD_AT` on stdout, *then* kills, would prove the rollback of a pack row that demonstrably existed uncommitted — which is what F2-5 promises. That is the same cost as the capture already taken, and it removes the timing inference entirely.

## Does this damage the eight PASSes? No — and I checked the same way

F1-4's captures do not use `--hold-at` either, so I applied the same measurement to them rather than exempting them:

- the **1,500 ms** pre-commit intake kill sits **~1.17 s above** the boot floor, so it landed inside real work;
- the **5,000 ms** kill **printed its result line** (`{"seed_id":"fbe257f3…","deduplicated":false,"members":12}`) and moved the store `seeds 5→6, snapshots 38→50` — it demonstrably reached and passed commit.

**F1-4's PASS stands on evidence that F2-5's does not have.** The difference is not a change of standard; it is 1,150 ms.

## Accepted requirements

**Only the held row is graded here.** F1-1, F1-2, F1-3, F1-4, F2-1, F2-2, F2-3 and F2-4 remain **PASS** at `veritas-phases-1-2-managed-live-confirm-gate1-2877dfb.md` (`ac7198b4ee551ae26ba9622e8b107eb4a031ed92e7775c0428b34a72ac604b48`), unchanged and not re-derived, and nothing in this delta touches their evidence.

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| F2-5 | Killed mid-compile, nothing is written, and the compile completes on re-run | **HOLD** | **Second half: evidenced.** The re-run against the managed store completed `deduplicated:false`, exit 0, `packs 3→4`, `entries 24→32`, `compile_runs 5→6`, pack `6c5be03a…` with its eight entries — and the partial-pack invariant is checked in the discriminating form (`orphan_entries 0`, `packs_without_entries 0`, `packs_miscounting_entries 0`). **First half: not evidenced.** The kill at 350 ms is inside the measured 317–337 ms boot-to-first-connect floor, so "mid-compile" is not established; the harness's PRE-commit detection cannot separate *killed after inserting* from *killed before connecting* | **blocking — recording Phase 2 PASS, and nothing else.** Dischargeable by one capture using the product's own `--hold-at pack-inserted` (or `entry-written`), showing `VLOGOPS_HELD_AT` on stdout before the kill, then the same state lines and the same completing re-run |

**One HOLD stands, so overall PASS remains unavailable.** Eight of nine requirements are discharged.

## Evidence provenance

- **Inspected:** the `## F2-5` section of `live-proofs-raw.txt`, the README delta and `SHA256SUMS.txt` at `f373e4a`, read in place; `bin/vlogops-compile.mjs` and `src/compiler.mjs` at this head; `git show --stat f373e4a`.
- **Executed by me against the product:** the compile CLI three times with a deliberately dead `127.0.0.1:1` URL from my own ephemeral workspace, to measure the boot-to-connect floor. **No credential, no connection to the managed project, no live state touched, nothing written to the store.**
- **NOT inspected:** the managed Supabase project. I refused the `C:\.fusion247` surface again per GL-012 §4 and asked Larry for no credential. **This limit is structural and permanent for this reviewer; it did not decide this verdict — a wall-clock measurement did.**
- `git rev-parse HEAD` start / end — `f373e4a3e26a404ad49038248b017036fc8f9cc9` / identical.
- `git status --porcelain` — empty at start; at end, only the two untracked receipts of this confirmation. **No tracked file modified.**
- `git branch -r --contains f373e4a` → `origin/main`. Remotely reachable.
- Ceiling: 15 minutes / ~45k tokens. **Honoured, not extended.**

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git rev-parse f373e4a:"Team/Veritas…/AGENTS.md"` | 0 | n/a | blob `d63d613d0c4001e6476a750316fa3193bd6ee2d4` |
| `sha256sum -c SHA256SUMS.txt` | 0 | **6** | `6/6 OK` — including the newly listed `README.md`, which was previously unhashed |
| `grep -n "^## " live-proofs-raw.txt` | 0 | 8 | eight sections; `## F2-5` now present at line 127 |
| `VLOGOPS_DB_URL=<dead> node bin/vlogops-compile.mjs compile --seed fbe257f3…` ×3 | 1 | 3 | **327 / 317 / 337 ms** to first connection attempt — the measurement this verdict rests on |
| `grep -n "HELD_AT\|hold-at" live-proofs-raw.txt managed-state-capture.txt README.md` | **1** | n/a | **no match.** The product's kill-window affordance is unused by every capture |
| `git show --stat f373e4a` | 0 | n/a | 7 files; no `.mjs`, no `.sql`, no migration |
| A capture locating the kill inside the open transaction | — | — | **DOES NOT EXIST.** The one surviving gap |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The corrective work targeted exactly the two named survivors and drifted nowhere else. |
| Design fidelity | **n-a** | Graded PASS at `2877dfb`; no schema, DDL or boundary changed in this delta. |
| Functional proof | **PASS** | Unchanged for the eight rows; the completing half of F2-5 is now genuinely evidenced against the managed store. |
| Integration | **PASS** | Unchanged, and the operator hop is now executable — graded in the companion Gate 2 receipt. |
| Durability | **HOLD** | The one dimension this confirmation exists for. Intake kill-and-revive is evidenced on both branches; **the mid-compile kill window is unlocated**, and durability is the dimension that must be observed rather than inferred. |
| Test quality | **HOLD** | Branch **detection** is good practice, but a detector that reports `PRE-commit` for both *after eight inserts* and *before connect* cannot fail in the way the requirement needs. The product ships the affordance that fixes this and the harness does not call it. |
| Git truth | **PASS** | `f373e4a` is on `origin/main`; the commit message describes the work accurately, states the miss it repairs, and claims **no** Phase PASS. |
| Documentation truth | **PASS — D-8 discharged** | The README now names the absent POST-commit compile branch, records the pattern the miss belongs to, and tells the reader *"the section headers are the index … do not infer one from a clean store."* **`SHA256SUMS.txt` now hashes `README.md` itself**, which it did not before — the limits page is now tamper-evident too. **What it still does not disclose is the kill window (D-10).** |
| Residual risk | **HOLD** | The capture is presented as *"landed PRE-commit — nothing written, including the `compile_run` attempt row"* without disclosing that a kill inside the boot window produces that same line. The limit is undisclosed rather than misstated. |
| Completed automation | **n-a** | Unchanged and still correctly reclassified as manual until Phase 6 by `RUNBOOK.md`. |

## Production caller and journey

Unchanged and not re-traced. The F2-5 capture runs the real entry point `node bin/vlogops-compile.mjs compile --seed …`, not a test harness calling `compileEvidencePack` directly — that part is correct, and is why the completing half counts as journey evidence.

## Restart and durability

- **Intake (F1-4)** — evidenced on both sides of the commit; both kills sit well clear of the boot floor. Unchanged, PASS.
- **Compile (F2-5)** — the re-run completes correctly from a store the kill left untouched. **What is not evidenced is that anything had been written to roll back.** The structural argument (one `withTransaction`, pack + entries + ledger row inside it) is sound and is exactly what the capture was supposed to stop being an argument.

## Documentation contradiction scan

- **Larry's declared changes:** the F2-5 capture · `SHA256SUMS.txt` recomputed · README describes the capture, records the pattern, names the absent POST-commit branch and states that the headers are the index · `RUNBOOK.md` §2 · one map line.
- **Verified independently:** all present and accurate as far as they speak. **D-8 is genuinely discharged**, and better than asked — the "does not establish" section now also carries the index rule, which is the generalisation rather than the one-off patch.
- **What his list missed:** **D-10** — the README and the capture both present the pre-commit branch as though the kill landed in flight. Neither discloses that at 350 ms the process was still inside a 317–337 ms startup path.
- **Active documents that would misdirect a fresh instance:** none in this Gate 1 scope. The map's one changed line records the HOLDs.
- **Closure claims since the last receipt, and the receipt behind each:** **none made.** The commit message states *"Still NO Phase PASS, and none is claimed"* and repeats Warwick's instruction that the gate not be waived; the README still ends *"No Phase PASS. These are inputs to Veritas, not a verdict."* **No false completion claim.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-7** | **MEDIUM** | **Superseded in place rather than discharged.** A mid-compile kill capture now exists, but its kill window is unlocated: 350 ms against a measured 317–337 ms boot-to-first-connect floor. The store being unchanged and the re-run reporting `deduplicated:false` are both trivially true of a process killed during startup. **Blocks: recording Phase 2 PASS. Nothing else** — no product code is implicated, no continuation is unsafe, Phase 1 is unaffected, and the Gate 2 human journey is unaffected. **Discharge:** one capture using the product's own `--hold-at pack-inserted` or `entry-written`, with `VLOGOPS_HELD_AT` visible on stdout before the SIGKILL. | **blocking** (Phase 2 PASS only) | Larry |
| **D-8** | — | **DISCHARGED.** The limits section names the absent POST-commit compile branch and states the index rule that generalises the miss. `SHA256SUMS.txt` now covers `README.md`. | closed | — |
| **D-10** | LOW | Neither the capture nor the README discloses that a 350 ms kill is inside this CLI's startup path. **Non-blocking as documentation** — it misstates nothing and misdirects no journey; it is carried inside D-7, which is where the effect lives. | non-blocking | Larry |
| **D-11** | LOW | `--hold-at` is a shipped, documented test affordance built for exactly this proof and **no capture in the evidence directory uses it**. Recorded once, as the cause behind D-7 rather than as separate work. | non-blocking | Larry |
| D-9 | LOW | Unchanged and still parked: the map states the exact next action by implication rather than in a dedicated row. | non-blocking | Larry |
| D-6 | LOW | Unchanged: runtime connects as `postgres`. Parked by Warwick, and not re-raised under the hobby-brain bar. | non-blocking | Warwick, at his leisure |

## Verdict

**HOLD** — the missing capture has arrived and half of F2-5 is now properly evidenced, but the kill it records landed inside the CLI's own 317–337 ms startup window, so *"killed mid-compile, nothing is written"* is still not observed; and the product already ships the `--hold-at` affordance that would have located the kill precisely.

**What this HOLD does and does not do.** It gates **recording Phase 2 PASS** and nothing else. **Phase 1's four requirements are all PASS and Phase 1 is functionally discharged at Gate 1.** It reopens no product code, transfers no frontier, and requires nothing already captured to be re-run.

**Said plainly, because Larry asked me to be right rather than accommodating.** No product defect has been found at any of the three passes on this boundary. This is a HOLD about a proof, not about the product: the atomicity is very probably correct — one transaction, and Postgres discards an uncommitted transaction when the client dies — and the store's live invariants show no partial pack has ever existed. **What I may not do is pass a durability requirement on "very probably", when the estate's own product hands me a one-flag route to observing it.** He asked whether the capture evidences the requirement or only the mechanism, and said he would rather I was right a third time. I was, and the answer is that this time it evidences neither.

## Next review trigger

A capture of a mid-compile SIGKILL whose window is **located inside the open transaction** — `--hold-at pack-inserted` or `--hold-at entry-written`, `VLOGOPS_HELD_AT` printed before the kill, then the state lines either side and the completing re-run — committed alongside the others. Then **ONE focused confirmation of F2-5 alone**. Nothing else reopens this gate: not a moved head, not a receipt, not the map, not a clerical repair, and not the eight requirements this boundary has PASSed.
