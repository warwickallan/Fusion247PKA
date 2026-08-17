# BUILD-006 Phases 1–2 — RAW capture from the managed Supabase project

**Why this directory exists.** Veritas held all nine Gate 1 requirements and both Gate 2 dimensions on one ground (D-1 / G2-2): every managed-project figure existed **only as narrative written by the actor who performed the work**, with no raw capture anywhere in the repository and no second source available to the reviewer. That was a fair finding and this directory is its discharge. **Nothing here is prose about the store; it is output from the store.**

## What is here

| File | What it is |
|---|---|
| `managed-state-capture.txt` | Every verification query, its **exact SQL**, and its raw JSON result. Read-only — no statement in it writes. |
| `live-proofs-raw.txt` | Real command lines, unedited stdout/stderr and **real exit codes and signals** for the behavioural proofs, re-executed against the managed project. |
| `pack-45c7ad3d-a.json`, `-b.json`, `-c.json` | **Three independent emissions of the same pack**, from three separate compiles. F2-3 is checkable with one command. |
| `SHA256SUMS.txt` | Digests of every file above. |

## Check the determinism claim yourself, in one command

```
sha256sum pack-45c7ad3d-*.json
```

All three are `be3c23eca59662bb01010cf0291b3d764d2ff3ac879a2f5d97c981825ffc7cb3`, 3,851 bytes. Three compiles, one pack, identical bytes — and the third was run days-independent of the first two, in a fresh process.

The two migration digests are checkable the same way, against what the evidence document claims was applied:

```
b19508b5ccdc00997ee87d6183d733b7727fe94b70b217bb10a643e12bdcbfcd  services/vlogops/db/001_vlogops_content_seed.sql
b93e188da7dfc1cc02476236b94c30cc2b8ebad776442f5bd3bde3d16fa1935c  services/vlogops/db/002_vlogops_evidence_pack.sql
```

## How to reproduce it

Every command in `live-proofs-raw.txt` is a real `bin/` entry point with `VLOGOPS_DB_URL` set. `RUNBOOK.md` §2 now names where that value comes from — which was Veritas's other blocker (G2-1) and is why these two fixes belong in one commit. The read-only queries in `managed-state-capture.txt` can be pasted into any Postgres client attached to the project.

## ⚠️ Read this before reading the kill tests — one capture carries a WRONG ASSERTION LABEL

`live-proofs-raw.txt` contains **three** mid-intake kill captures, and they are kept in the order they ran, including one whose assertions read `FALSE`. It is kept deliberately: deleting an inconvenient capture would be exactly the cherry-picking this directory exists to prevent.

**The invariant under test is "nothing at all, or all of it" — NOT "the store is unchanged".** A kill can legitimately land either side of the commit, and `RUNBOOK.md` §8 documents both: killed pre-commit → nothing written, the re-run reports `deduplicated:false`; killed post-commit → the seed is stored and complete, the re-run reports `deduplicated:true`. **Both are passes. A partial row set is the only failure.**

| Capture | What happened | Reading |
|---|---|---|
| `## F1-4` (400 ms, window `2026-08-01..2026-08-16`) | Store unchanged, no partial state. But the window resolved to content **already seeded**, so the re-run said `deduplicated:true`. | **Weaker than it looks** — a dedupe-path kill. It does still show the killed run wrote *no* `intake_run` ledger row while the completing run wrote exactly one (8 → 9). |
| `## F1-4 (STRONGER)` (5,000 ms, window `2026-07-20..2026-08-16`) | The process **had already printed its result and committed** before the signal landed. Two asserts therefore read `FALSE`. | **A valid POST-commit outcome, mislabelled.** The harness asserted the pre-commit expectation unconditionally. **Wrong assertion, not a wrong outcome** — the row set is complete and consistent (12 snapshots, zero orphans, zero unsealed, zero stuck transactions). |
| `## F1-4 (CORRECTED ASSERTIONS)` (1,500 ms, window `2026-07-01..2026-08-16`) | Landed **PRE-commit**. Store completely unchanged including the attempt ledger; no partial state; re-run reported `deduplicated:false`, proving the killed work was genuinely absent rather than half-present. | **PASS on all three assertions**, with the branch detected rather than assumed. |

The third harness detects which branch occurred and asserts the correct expectation for it. That is the one to read; the first two are kept for provenance and because the second is an honest record of my own harness being wrong.

## The mid-COMPILE kill (F2-5) — added in the second pass, and it was MISSING from the first

**Veritas held F2-5 alone at the first confirmation, and it was right: there was no mid-compile kill capture in this directory at all.** Four `F1-4`-family captures and a controls run, and not one of them killed a *compile*. Worse, the section above — whose entire job is naming absent proofs — listed the two superseded intake kills and **did not mention the F2-5 capture that did not exist.** A clean store afterwards proves nothing damaged it; it does not prove a kill was survived. Recorded here because it is the third occurrence of the `acceptance-proves-mechanism-not-outcome` family and the pattern is the point, not the individual miss.

### ⛔ The FIRST F2-5 capture (350 ms) is SUPERSEDED AND WORTHLESS. Read `## F2-5 (SECOND ATTEMPT)` instead.

**Veritas measured what killed it, and the measurement is the lesson.** The compile CLI needs **~327 ms (measured 327 / 317 / 337) merely to reach its first connection attempt.** A kill at 350 ms therefore left 13–33 ms for a TLS handshake, auth, `BEGIN`, the seed select, twelve snapshot rows (~680 KB), the pack insert, eight entry inserts and the ledger row. **The signal almost certainly landed before the transaction opened — plausibly before the connection existed.** "Store unchanged" and `deduplicated:false` are then *trivially* true of a process killed during startup, and my harness printed the identical `PRE-commit` line for that as it would for a kill after eight inserts. **It proved neither the requirement nor the mechanism.** It is kept below for provenance only.

### `## F2-5 (SECOND ATTEMPT)` — killed INSIDE the open transaction, and proven so from the server

The product already contained the right facility and no capture had used it: `bin/vlogops-compile.mjs` implements `--hold-at`, and `src/compiler.mjs` emits `transaction-open`, `pack-inserted`, `entry-written` and `pre-commit` **inside the open transaction**, printing `VLOGOPS_HELD_AT <stage>` with a keepalive — its own comment saying it exists to park a real process inside a real open transaction so an external kill lands in a known window.

- held at **`entry-written`** — the marker appeared after **675 ms**, i.e. ~350 ms clear of the boot floor, so the window is measured rather than hoped;
- **the server confirmed it independently: `pg_stat_activity` reported 1 session `idle in transaction` at the moment of the kill.** That does not depend on my harness's interpretation of its own stdout;
- SIGKILL delivered only *after* both of those facts were established;
- the aborted transaction wrote **nothing** — packs 4, entries 32, compile_runs 6, all unchanged;
- **no partial pack** — zero orphan entries, zero packs without entries, zero packs whose `entry_count` disagrees with their stored entries;
- the re-run completed `deduplicated:false`, so the killed work was genuinely absent, and wrote exactly one pack with its eight entries (packs 4→5, entries 32→40).

**This is the capture that carries F2-5.** The 350 ms one does not, and saying otherwise was my third occurrence of `acceptance-proves-mechanism-not-outcome` in a single boundary.

The superseded first attempt, for provenance:

- seed `fbe257f3…`, never compiled before, SIGKILL at 350 ms;
- landed **PRE-commit** — nothing written, **including the `compile_run` attempt row** (packs 3, entries 24, compile_runs 5, unchanged);
- **no partial pack** — zero orphan entries, zero packs without entries, and zero packs whose `entry_count` disagrees with their stored entries, which is the check that would actually catch a half-written pack;
- the re-run completed with `deduplicated:false`, proving the killed work was genuinely absent, and wrote exactly one pack with its eight entries (packs 3→4, entries 24→32).

## What this evidence still does NOT establish

- **It is still single-actor.** Larry ran these captures. What changed is that the *store's own output* is now committed and re-checkable by anyone with access, rather than a summary being the only artefact. An independent reviewer without a credential still cannot re-execute — that limit is structural under GL-012 §4 and is named in both receipts.
- **The two earliest kill tests** (500 ms and 5,500 ms on genuinely new windows, both reporting `deduplicated:false` on completion) exist only in the session transcript. They are **not** re-captured here; the corrected 1,500 ms capture above supersedes them as the fresh pre-commit proof.
- **No capture of a POST-commit mid-compile kill.** The F2-5 capture landed pre-commit. The post-commit compile branch is therefore evidenced only by the structural argument that the pack, its entries and its ledger row commit in one transaction, plus the F1-4 post-commit intake capture showing that branch behaving correctly for intake. **Stated because the section above exists to name absent proofs and failed to do so once already.**
- **How to tell what is actually here:** the section headers in `live-proofs-raw.txt` are the index. If a requirement has no header naming it, there is no capture for it — do not infer one from a clean store.
- **No Phase PASS.** These are inputs to Veritas, not a verdict.
