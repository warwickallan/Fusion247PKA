# PR #58 bounded closure — evidence (Codex F1 + F2 + watcher-path F3)

Bounded closure of the DRAFT Tower recovery PR #58 per Warwick's directive. No Tower
architecture/hardening beyond these three items. The 24 held turns were not touched; no
MyPKA-LIVE migration; supervisor prompt unchanged; Fable not invoked.

## Round 2 — three follow-up findings from the round-1 merge-check, all fixed

The round-1 merge-check (head `e88c0bf`) returned `request_changes` with three fair findings;
addressed here within the ≤3-round bound (commits made before READY):

- **QA-PR58-001 (HIGH) — merge-check accepted abbreviated SHAs.** `classifyMergeRun` now requires
  a **FULL 40-char** head SHA (`FULL_SHA_RE = /^[0-9a-f]{40}$/i`); an abbreviation is rejected.
  Locked by a unit assertion.
- **QA-PR58-002 (MED) — classifier accepted an unbracketed BUILD token as a leading tag.** The
  opening bracket is now **required** (`LEADING_TAG_RE = /^\s*\[\s*(BUILD-\d{3})\b/`); an
  unbracketed leading `BUILD-002 …` classifies to `UNCLASSIFIED`. Locked by a unit assertion.
- **QA-PR58-003 (MED) — the committed launcher contradicted the stable-worktree claim.** The
  committed `run-watcher.mjs` no longer hardcodes `cwd: C:/Fusion247PKA`; it derives `REPO_ROOT`
  from its own checkout (`…/tower-loop → up 3`), spawns the watcher with `cwd: REPO_ROOT`, and
  pins `TOWER_EVIDENCE_REPO_DIR` to it. Pointed at the stable Tower worktree, the launcher runs
  the watcher (and its git-evidence root) from that stable location **by construction** — now
  established by committed code, not a machine-local file.

Re-run after the round-2 changes: classifier passing (with the two new lock assertions),
**hold 9/9**; the 24 held turns remain intact (0 reviews, 0 notifications).

## Round 3 — clean history rebuild + last runtime defect (under Warwick's authorisation)

The round-2 merge-check surfaced a real security finding: the earlier
`Deliverables/2026-07-23-tower-backlog-snapshot.json` included an instruction excerpt that
exposed an email address + operational wording. Under Warwick's explicit authorisation, PR #58
was **rebuilt cleanly from `origin/main`** (bounded history rewrite + `--force-with-lease`),
preserving only the intended Tower recovery changes and **excluding**:

- `Deliverables/2026-07-23-tower-backlog-snapshot.json` — replaced by a **metadata-only**
  record (`2026-07-23-tower-backlog-metadata.json`): safe totals, seq range, states, no content,
  no IDs, no PII;
- `Deliverables/2026-07-23-tower-active-supervisor-prompt.txt` — raw prompt content is not kept
  in the public repo; its source of truth is the `tower.supervisor_prompt` DB row.

- **QA-PR58-004 (HIGH) — merge-run PR validation was fail-open for invalid numerics.**
  `classifyMergeRun` now requires a **positive integer** PR number and fails closed for `NaN`,
  non-integers, zero/negative, and non-numeric strings (`""`, `"58abc"`, `"-5"`, `"1.5"`).
  Locked by a dedicated unit test.

The Tower DEV Supabase records (`tower.merge_check_run` / `merge_check_message`,
`tower.supervisor_review`) retain the full historical review evidence, so no unsafe commit is
preserved for documentation.

## F1 (HIGH) — `classifyMergeRun` wired into the real merge-check entrypoint (was an unused helper)

`classifyMergeRun` (explicit build_ref + repo + PR + full head SHA, fail-closed) was previously
defined but never called in any runtime path. It is now the **first enforced gate** of a committed
merge-check entrypoint: `services/control-plane/tower-loop/mergeCheck.mjs` → `runMergeCheck()`.

- The check runs **before** any git evidence is gathered or any Codex is spent. If build_ref,
  repo, PR number, or a valid full head SHA is missing/malformed, the run is recorded
  `status='blocked'` with a `gpt_codex` fail-closed message and TowerBot is notified — no review
  proceeds. This is a runtime enforcement, not a definition.
- On success it creates the durable `tower.merge_check_run` at the exact head, records ordered
  `larry` → `gpt_codex` messages, gathers REAL git evidence over `base..head`, runs the REAL
  Codex merge review under the APPROVED Tower QA skill, stores the verdict AT THE EXACT HEAD, and
  delivers via TowerBot. Bounded by `maxRounds` (≤ 3). It makes no commits.
- Proven live: see the step-5 merge-check run recorded against PR #58's post-closure head
  (`tower.merge_check_run` / `merge_check_message`, real TowerBot delivery).

## F2 (MEDIUM) — existing classifier + hold tests run; exact commands, totals, output attached

No new tests invented — the existing suite was executed and captured.

```
$ node --test services/control-plane/tower-loop/test/classifyBuild.test.mjs
ok 1 - priority 1: explicit valid build_ref wins
ok 2 - priority 2: session/run env when no explicit
ok 3 - priority 3: strict LEADING [BUILD-NNN] BRACKETED tag (not prose, not unbracketed)
ok 4 - priority 4: unknown -> UNCLASSIFIED, never BUILD-014
ok 5 - invalid explicit ref falls through (not trusted)
ok 6 - classifyMergeRun demands fully explicit metadata incl. a FULL 40-char head SHA
ok 7 - classifyMergeRun rejects invalid PR numbers (QA-PR58-004, fail-closed)
# tests 7
# pass 7
# fail 0
```

```
$ CONTROL_PLANE_DEV_DATABASE_URL=<dev> node services/control-plane/tower-loop/test/prove-hold.mjs
1) held rows survive reclaimStale:            PASS (24->24)
2) held rows are skipped by the normal claim: PASS fixture held; claim did NOT pick it
3) an explicitly RELEASED row becomes claimable: PASS release->pending; idempotent; claimable
4) the 24 historical held rows remain unreviewed + unnotified: PASS 24 held, 0 reviews, 0 notifications
RESULT: PASS — 9 passed, 0 failed
```

Totals: **classifier 7/7, hold 9/9.** The 24 historical held turns are intact (24, 0 reviews, 0 notifications).

## F3 — watcher runs from a STABLE Tower path, not the mutable working checkout

The autostart launcher previously executed `watcher.mjs` from `C:\Fusion247PKA`, the working
checkout that switches between the BUILD-002 and Tower branches — so the running watcher's code
could change under it whenever the checkout switched branches.

Fix: a dedicated **stable Tower git worktree** pinned to the Tower branch, at
`C:\Fusion247PKA-tower` (shares the same `.git`, so all refs resolve for merge-check evidence).
The launcher (`C:\.fusion247\run-tower-cp-watcher.ps1`, machine-local, secrets outside Git) is
updated to run `C:\Fusion247PKA-tower\services\control-plane\tower-loop\watcher.mjs` and to set
`TOWER_EVIDENCE_REPO_DIR=C:\Fusion247PKA-tower` so `REPO_ROOT` is fixed regardless of what the main
checkout is doing. Secrets remain in `C:\.fusion247\*.env` (never in Git). After PR #58 merges,
the worktree is re-pointed at `main`.
