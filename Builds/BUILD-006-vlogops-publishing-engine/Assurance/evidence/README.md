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

## What this evidence still does NOT establish

- **It is still single-actor.** Larry ran these captures. What changed is that the *store's own output* is now committed and re-checkable by anyone with access, rather than a summary being the only artefact. An independent reviewer without a credential still cannot re-execute — that limit is structural under GL-012 §4 and is named in both receipts.
- **The two earliest kill tests** (500 ms and 5,500 ms on genuinely new windows, both reporting `deduplicated:false` on completion) exist only in the session transcript. They are **not** re-captured here; the corrected 1,500 ms capture above supersedes them as the fresh pre-commit proof.
- **No Phase PASS.** These are inputs to Veritas, not a verdict.
