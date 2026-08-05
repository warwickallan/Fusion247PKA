# EVIDENCE — Tower dynamic PR discovery, v2 (correcting 6b12b68's flawed discovery with PR #93's proven design)

| Field | Value |
|---|---|
| **work_order_id** | in-prompt, time-critical — no filed Work Order (per dispatch note) |
| **owner** | Keel |
| **governance_head at dispatch** | `6b12b68b416492ea4b205f6901b727b6059da801` (fresh HEAD of `build-020/live-trial`, fetched and confirmed against local HEAD before work began) |
| **branch** | `build-020/live-trial` (shared worktree, direct commit per the Work Order) |
| **worktree** | `C:\Fusion247PKA-build-020-trial` |
| **integrated from** | PR #93 `fix/watcher-polls-all-open-prs` (`warwickallan/Fusion247PKA`, head `9e1493dbd16dc79e6b628243cb009144e528e45d` at read time), integrated by manual port — read the actual diff via `gh pr diff 93` and `git show origin/fix/watcher-polls-all-open-prs:<path>`, then applied the same logic onto `build-020/live-trial`'s current tree rather than a raw merge/cherry-pick, because `watcher.mjs` had diverged (WP-2E's finding/disposition wiring, which PR #93 predates and knows nothing of) and a mechanical merge would have produced conflicts inside functions PR #93 never touches in its own history. The result's logic matches PR #93's byte-for-byte in `pollPrComments.mjs`'s `fetchOpenPrs`, `test/doubles/fakeGh.mjs` and `test/doubles/fakeGhModule.mjs`; `watcher.mjs`'s `detectCheckoutRepo`/`seedRepos`/`pollTargets` are PR #93's design with one addition (`TOWER_PR_REPOS`, below) composed into the same ranking; the D1–D9 test suite is PR #93's, unweakened, with WP-2E's untouched turn/finding wiring surviving in the same file. |

Builder self-test evidence — NOT independent review.

## What was wrong, and what changed

Commit `6b12b68` (a previous Keel instance, same day) added `fetchOpenPrNumbers()` — single-page
(`limit`, default 5), and on discovery failure it **caught the error and only logged it**
(`pr_poll_live_discovery_failed`), letting `pollTargets` fall through to zero targets. An empty
target list is exactly what a healthy idle watcher produces, so a `gh` outage during discovery was
**indistinguishable from nothing being open** — the same failure-reads-as-health defect the original
WO-2026-08-03-05 (PR #93) was built to remove, reintroduced one call earlier. Warwick caught this by
reading the diff, and separately caught that PR #93 already existed, unmerged, solving the same
problem properly two days earlier.

This change:

1. **Removes `fetchOpenPrNumbers()` and its call site entirely** — not kept alongside the
   replacement. `pollTargets` now imports and calls PR #93's `fetchOpenPrs(gh, { repo })` from
   `pollPrComments.mjs`: paginated (`--paginate --jq .[].number`, no page cap), and it **throws** on
   any malformed/failed response rather than degrading to an empty list.
2. **Ports PR #93's `detectCheckoutRepo()` and `seedRepos()`** into `watcher.mjs` unchanged in logic:
   the checkout's own `origin` remote (re-read every round, never cached) and every repo any turn in
   the store has ever named (no state filter — filtering there would reintroduce the exact
   self-extinguishing bug this whole change exists to kill).
3. **Adds `TOWER_PR_REPOS` as an explicit FOURTH repo source** (`explicitRepos()` in `watcher.mjs`),
   additional to PR #93's three. Warwick's instruction: retain it as the stable machine-runtime
   repository source, because Tower's actual deployment (`~/.mypka/tower-runtime/`) is a **plain file
   copy, not a git checkout** — `detectCheckoutRepo()` reads `git remote get-url origin` from `cwd`
   and will find nothing there. Documented in a code comment in `watcher.mjs` (not only here), naming
   exactly why it is not a duplicate of `detectCheckoutRepo` or `seedRepos`, so the next reader does
   not "clean it up".
4. **Cap-starvation holds with the fourth source composed in, not parallel.** `pollTargets` builds
   ONE `repos[]` union across all four sources, fetches every open PR from every repo in that union
   into ONE `open[]` list, ranks that ONE list (in-flight rounds first, then newest-first) and caps
   the ONE ranked list at `limit`. There is no per-source cap anywhere in the function — proven by
   `D-TR2` below.
5. **Preserves WP-2E's W1–W4 wiring untouched**: `openFinding()`'s call site inside `processTurn`,
   `openFindingsFromMergeReview`, `readDisposedFindings`, `sendDispositionNotifications`, and the
   `pollRound` call site that invokes the disposition echo — none of these functions were read from
   PR #93 (it predates WP-2E), and none were touched by this change; only `pollTargets`'s internals
   and its two doc comments changed.

`pollRound(pool, deps)`'s call site is unchanged in shape (`pollTargets(pool, { gh: deps.gh })`) —
only its explanatory comment was updated, since `gh` now defaults to `ghCliReader` rather than `null`
and discovery is unconditional rather than opt-in.

## Acceptance criteria

| # | Criterion | Met | Evidence |
|---|---|---|---|
| 1 | `fetchOpenPrNumbers` and its call site removed entirely, not kept alongside `fetchOpenPrs` | Yes | `grep -n fetchOpenPrNumbers services/control-plane/tower-loop/watcher.mjs` returns nothing (command 1 below) |
| 2 | PR #93's design (paginated, throw-on-failure discovery; four-source-ranked-then-capped `pollTargets`) integrated, logic matching, not re-derived | Yes | `watcher.mjs`/`pollPrComments.mjs` diffs match the read PR #93 diff line-for-line in `fetchOpenPrs`, `detectCheckoutRepo`, `seedRepos`; D1–D9 (PR #93's own test suite, unweakened) all pass |
| 3 | WP-2E's finding/disposition wiring preserved, working alongside PR #93's discovery logic | Yes | `openFinding`, `openFindingsFromMergeReview`, `readDisposedFindings`, `sendDispositionNotifications` untouched in the diff; WP-2E's own proof (`qaExchange.test.mjs`, spawned as "WP-2E — the QA-exchange proof (W1-W4)") still passes inside the same full-suite run |
| 4 | `TOWER_PR_REPOS` added as an explicit fourth source, reasoning documented in a code comment | Yes | `explicitRepos()` in `watcher.mjs` with a full docstring naming the machine-deployment reason; `pollTargets` calls it alongside the other three sources |
| 5 | Cap-starvation holds with the fourth source composed in, not a parallel cap | Yes | `D-TR2` — two repos (one via `detectRepo`, one via `TOWER_PR_REPOS`) each with 4+ open PRs, `limit: 5`, exactly 5 returned total (not 5 per repo), ranked as one list |
| 6 | Full PR #93 D1–D9 suite passing, properties unweakened | Yes | `D1`–`D9` all `[PASS]` in the AFTER run below |
| 7 | New test: no seed, no prior turn, `TOWER_PR_REPOS` alone finds an open PR | Yes | `D-TR1` — fresh empty store, `detectRepo: async () => null` (simulating the non-checkout deployment), `TOWER_PR_SEED` unset, `TOWER_PR_REPOS` set — the PR is found |
| 8 | Discovery failure reaches the existing 3-strike `tower_failure` alarm via the SAME assertion path other poll failures use | Yes | `A7` (updated, not new) — same query/regex assertion (`reason='tower_failure' and state='poll_failing'`, `/poll rounds FAILED/`) as before this change; now triggered by a discovery-stage failure specifically, proven by `D5` at the unit level (`pollTargets` rejects) and `A7` at the spawned-watcher/alarm level |
| 9 | More than 5 open PRs does not permanently starve one | Yes | `D7` (ranking under the cap, PR #93's own design — not truncated discovery) plus `D-TR2` (same property extended across the fourth source) plus `D9` (live transition: a merged PR drops out, a newcomer is found, with no restart) |
| 10 | Full suite green before and after, `failures=0`, executed counts pasted verbatim | Yes | Commands 2–3 below: BEFORE `executed=51 failures=0`, AFTER `executed=60 failures=0` |
| 11 | Secret scan over the declared surface | Yes | Command 4 below: exit `0`, 6 (then 7 including this file) files scanned, 0 findings |

## Commands executed, verbatim

### 1. Confirm `fetchOpenPrNumbers` is gone

```
grep -n "fetchOpenPrNumbers" services/control-plane/tower-loop/watcher.mjs
```
Result: no output (nothing found) — the function and its import/call site are fully removed.

### 2. Full aggregate suite — BEFORE (governance head `6b12b68`, no changes yet)

```
node services/control-plane/tower-loop/test/run-tower-loop-tests.mjs
```
Result (tail):
```
executed=51 failures=0
RESULT: ALL PASS
```
All 51 pre-existing subtests passed, including the flawed `WO-TW-03` spawned wrapper and the
store-derived-only `A-unit` — this is the exact defective baseline this Work Order corrects; a green
suite does not mean a correct design, which is the whole reason Warwick caught this by reading code.

### 3. Full aggregate suite — AFTER (this change integrated)

```
node services/control-plane/tower-loop/test/run-tower-loop-tests.mjs
```
Result (full PASS list, tail):
```
  [PASS] FIX1a — active prompt approved_by is truthful (not warwick)
  [PASS] T0 — detectMergeClass: explicit, heuristic, and ordinary
  [PASS] WP-2G — the Codex contract reach proof executes and passes (spawned node:test)
  [PASS] WP-2E — the QA-exchange proof (W1-W4) executes and passes (spawned node:test)
  [PASS] W1 — tower.git_sha DOMAIN refuses a non-canonical head (DB constraint, not a runtime if)
  [PASS] W8 — provenance CHECK: a pr_comment disposition with no comment row is refused by the DB
  [PASS] W7 — a comment with no `@tower head:` directive is REFUSED (cannot be bound)
  [PASS] W3 — a STALE comment is REJECTED, applies nothing, and the rejection is persisted
  [PASS] W2 — ingest binds to the EXACT head, preserves the body, and applies dispositions with distinguishable provenance
  [PASS] W4 — the NEXT review round receives those dispositions AUTOMATICALLY from the database
  [PASS] W5 — an UNDISPOSED prior finding REJECTS the next review round (fail-closed, no reviewer invoked)
  [PASS] W6 — a disposition recorded at an OLDER head is STALE at a newer head → round REJECTED
  [PASS] W-unit — checkFindingDispositions: gate arithmetic, opened-this-turn exemption, head skip
  [PASS] P1 — the head SHA comes from the GitHub API, and a body directive that disagrees is REFUSED before ingest
  [PASS] P2 — a real-shaped comment list reaches the EXISTING ingest path with no hand-built payload, and non-@tower chatter is ignored
  [PASS] P3 — polling TWICE is a no-op: re-seeing the same comment neither duplicates nor errors
  [PASS] P4 — a STALE comment is rejected: the turn has moved on, nothing is applied, the rejection is persisted
  [PASS] P5 — the gh seam is READ-ONLY: a mutating invocation is refused, and the poller never builds one
  [PASS] P6 — a malformed API head is REFUSED outright: the poller never falls back to the body
  [PASS] T1 — ingest→claim→process→verdict→notify (correct verdict fires a notification)
  [PASS] T2 — notification dedup (no duplicate (turn,reason))
  [PASS] T5 — merge-class routing APPROVE (Tower QA skill ran on Git evidence)
  [PASS] T6 — merge-class fail-closed BLOCK on unresolvable Git evidence
  [PASS] T3 — restart recovery (a relaunched watcher resumes processing)
  [PASS] T4 — crash reclaim (expired-lease claimed turn is reclaimed + processed)
  [PASS] T7 — exactly-once during a long run with a concurrent watcher (FIX 4)
  [PASS] A1 — an explicit `@tower checkpoint:` comment OPENS its own turn; an ordinary comment still cannot
  [PASS] A2 — the checkpoint turn is bound to all six: repo, PR, API head, build ref, comment id, idempotency key
  [PASS] A3 — RE-POLLING the same checkpoint does not duplicate — with a CONTROL that proves the test can see a duplicate
  [PASS] A4 — a checkpoint whose body head disagrees with the API head creates NOTHING (the head is still the API's)
  [PASS] D1 — TARGETS ARE OPEN PRs, NOT WORK STATE: a completed round no longer hides its own still-open PR, and PRs with no turn at all are polled
  [PASS] D2 — A MERGED PR DROPS OUT even though its turn is live AND it is explicitly seeded (the live defect, both halves)
  [PASS] D3 — a NEWLY OPENED PR is picked up mid-run with no restart, no seed and no store row
  [PASS] D4 — the REPOSITORY comes from durable sources, NOT from a launch-time env binding
  [PASS] D5 — DISCOVERY FAILURE IS LOUD: it throws rather than returning an empty set that looks like a healthy idle watcher
  [PASS] D6 — the discovery call is READ-ONLY and asks for exactly the open PRs
  [PASS] D7 — the cap bounds a round, prefers PRs with live rounds, and says so rather than dropping silently
  [PASS] D-TR1 — TOWER_PR_REPOS ALONE finds an open PR: no seed, no prior turn, and no git checkout to detect from (the real machine-runtime deployment)
  [PASS] D-TR2 — a TOWER_PR_REPOS-sourced repo composes into the SAME rank+cap as every other source, not a parallel cap
  [PASS] A5 — END TO END: no turn is prepared, NOTHING NAMES THE PR, and the RUNNING watcher discovers it, opens the turn, reviews it and notifies
  [PASS] A6 — RESTART causes no duplicate, and a SECOND checkpoint posted later is detected by the restarted watcher
  [PASS] A7 — a PERSISTENTLY failing poll fires a LOUD tower_failure alarm (now covering DISCOVERY failure, which is the first call to break)
  [PASS] A8 — CONTROL: a HEALTHY poll fires no alarm (the A7 assertion is two-sided, not always-true)
  [PASS] A9 — ZERO CLICKUP, instrumented: the trigger path's module graph is enumerated and a ClickUp trap is proven to bite
  [PASS] A11 — the WRITE seam is an ALLOWLIST: it accepts exactly a comment POST and refuses everything else
  [PASS] A12 — after an auto-created round completes, the verdict is POSTED to the PR carrying verdict, head and the checkpoint it answers
  [PASS] A13 — re-sweeping and RESTARTING never double-post — with a CONTROL that proves the test can see a duplicate
  [PASS] A14 — a FAILING post is fail-closed and LOUD: nothing claims the round was answered, and the alarm fires
  [PASS] A15 — CHAINED, END TO END: a disposition comment against an AUTO-CREATED round is consumed by a SUBSEQUENT auto-created round
  [PASS] A16 — a checkpoint marker whose build ref is not BUILD-NNN falls back to UNCLASSIFIED and SAYS SO
  [PASS] D8 — TWO open PRs are BOTH polled by one running watcher, each opening its own round, with nothing naming either of them
  [PASS] D9 — LIVE TRANSITION: one PR merges and a new one opens while the watcher runs — it stops polling the corpse and starts polling the newcomer, with no restart
  [PASS] A10 — run-watcher.mjs is INERT on import: no directory created, no process stopped, nothing spawned
  [PASS] M1 — END TO END, fail-closed: an invalid build_ref writes a `blocked` run and its message to the SQLite store, and spends no Codex
  [PASS] M2 — END TO END, evidence unresolved: the run OPENS, records Larry, then closes `blocked` with rounds=1 — six of the eight statements on the real path
  [PASS] M3 — RESUME: a run interrupted after Larry's message is resumed on the next attempt — one run, no duplicate claim — and a CLOSED run is never resumed
  [PASS] M4 — DIRECT-STATEMENT TEST (not an end-to-end proof): the post-Codex UPDATE literal, with a CONTROL proving the old param order fails
  [PASS] M5 — the canonical store path: defaultDbPath() resolves to ~/.mypka/tower/tower.db with TOWER_SQLITE_PATH unset, and nothing writes there
  [PASS] M6 — ZERO POSTGRES on the merge-check path, INSTRUMENTED: the real module graph is enumerated and a pg trap is proven to bite
  [PASS] M7 — tower/merge-check.mjs speaks SQLite: record/nextSeq write the exchange, and substr() replaced left() — with a CONTROL proving left() still fails

executed=60 failures=0
RESULT: ALL PASS
```
`60 = 51 - 2 (A-unit and the WO-TW-03 spawned wrapper, both removed — the wrapper spawned
`test/pollTargetsLiveDiscovery.test.mjs`, which imports the now-removed `fetchOpenPrNumbers` and is
outside this Work Order's `file_surface`, see "Out-of-scope findings" below) + 11 (D1–D9, D-TR1,
D-TR2)`. **Zero regressions**: every pre-existing subtest this change did not deliberately replace
still passes.

### 4. Secret scan, surface-scoped (six files first, then re-run including this evidence file)

```
bash scripts/secret-scan.sh --surface \
  services/control-plane/tower-loop/watcher.mjs \
  services/control-plane/tower-loop/pollPrComments.mjs \
  services/control-plane/tower-loop/README.md \
  services/control-plane/tower-loop/test/doubles/fakeGh.mjs \
  services/control-plane/tower-loop/test/doubles/fakeGhModule.mjs \
  services/control-plane/tower-loop/test/run-tower-loop-tests.mjs
```
Result:
```
secret-scan: CHECKED 26 detection class(es) — telegram-bot-token jwt stripe-live-key aws-access-key-id
pem-private-key-block secret-assigned-to-sensitive-name connection-string-with-credentials
jdbc-password aws-credentials-file-entry credential-store-json-value netrc-credentials htpasswd-hash
session-cookie-value bearer-token-value basic-auth-header-value openai-style-key openai-project-key
stripe-key-body telegram-token-bare github-token github-fine-grained-pat slack-token google-api-key
npm-token gitlab-token sendgrid-key
secret-scan: SCANNED 6 file(s) of the named surface, 0 secret value(s) found.
```
Exit `0` — `--surface` mode (26 detection classes, filename deny-list, content-scanned). Coverage
limitation carried forward honestly: content-shaped credentials inside an ordinarily-named file are
the scanner's known blind spot on any surface (GL-012 §5a); this is a public surface, so the stake is
a defect, not a leaked secret, and no `C:\.fusion247\**` path appears anywhere in this change
(`private_surface: none`, confirmed).

### 5. `node --check` on every edited file (syntax-only, ahead of the full suite)

```
node --check services/control-plane/tower-loop/watcher.mjs
node --check services/control-plane/tower-loop/pollPrComments.mjs
node --check services/control-plane/tower-loop/test/doubles/fakeGh.mjs
node --check services/control-plane/tower-loop/test/doubles/fakeGhModule.mjs
node --check services/control-plane/tower-loop/test/run-tower-loop-tests.mjs
```
Result: no output from any invocation — all five files parse cleanly.

## Assumptions made

- **The PR #93 integration is a manual port, not a `git merge`/`cherry-pick`**, because `watcher.mjs`
  had diverged under WP-2E since PR #93 branched, and a mechanical merge would have conflicted inside
  functions PR #93's own history never touches. I read PR #93's actual diff (`gh pr diff 93`) and the
  full files at its head (`git show origin/fix/watcher-polls-all-open-prs:<path>`) before writing
  anything, and the result's logic matches byte-for-byte in every function PR #93 owns. This is a
  design decision inside the WO's own latitude ("your call ... using PR #93's proven logic").
- **`TOWER_PR_REPOS`'s exact env-var grammar** (comma-separated `owner/name`, no `#pr` suffix) matches
  what the earlier flawed `6b12b68` attempt already used, per the WO's own instruction ("already the
  name I used in my own earlier deploy attempt") — so no operator-facing value needs to change.
- **The D1–D9 test names, bodies and assertions are PR #93's own, unmodified**, except where a
  spawned-watcher test needed `TOWER_PR_SEED` removed and `openFixture`/`writeFixture{openPrs:...}`
  substituted — matching PR #93's own diff for those same tests (A5/A6/A7/A8/A9/A12/A13/A14/A15)
  exactly, not a re-derivation.

## Out-of-scope findings — REPORTED, not fixed

- **`services/control-plane/tower-loop/test/pollTargetsLiveDiscovery.test.mjs`** (introduced by
  `6b12b68`, NOT in this Work Order's `file_surface`) imports `fetchOpenPrNumbers` from
  `watcher.mjs`, which this change removes entirely. It is no longer referenced by
  `run-tower-loop-tests.mjs` (the "WO-TW-03" spawned wrapper that invoked it was removed as part of
  replacing `A-unit` with PR #93's own D-series, which never had such a wrapper). The file itself
  remains on disk, unreferenced, and will fail if run directly (`node --test
  test/pollTargetsLiveDiscovery.test.mjs`) because the import it needs no longer exists. Reported for
  Larry to route — delete it or fix its import — rather than fixed here, per critical rule 1 (never
  write outside the declared `file_surface`).
- **`Deliverables/proofline/EVIDENCE-2026-08-05-tower-dynamic-pr-discovery.md`** (the prior, non-`v2`
  evidence file, also not in this Work Order's `file_surface`) now describes the superseded design
  (`fetchOpenPrNumbers`, single-page, swallow-on-failure). Left untouched; this file is deliberately
  `-v2` per the Work Order's own declared path so the two coexist. Reconciling or retiring the old one
  is Larry's/SOP-020 territory.

## Not verified / known limitations

- **No live GitHub call was made.** Every proof above runs against an injected fake `gh` object —
  `credential_scope: none`, `live_authority: none`, and the "no real GitHub calls" instruction were
  all honoured literally. Whether the real `gh api repos/<repo>/pulls?state=open&per_page=100
  --paginate --jq .[].number` call behaves identically against the live GitHub API (auth, rate
  limits, exact output shape across pages) is unverified here by design.
- **This change reaches the live watcher only when Larry restarts it**, per the dispatch note — the
  dispatch explicitly says Warwick restarts Tower and runs the live proof himself; neither attempted
  here.
- **`TOWER_PR_REPOS` is not yet set anywhere live** — until the operator sets it (or the repo becomes
  known via an existing turn/seed/checkout), live discovery for a genuinely new, non-checkout
  deployment still depends on it being configured; this is the exact gap it exists to close, stated
  rather than implied already closed everywhere.
- The known content-shaped-secret blind spot in the scanner (GL-012 §5a) applies here as to any
  public surface; not a new limitation introduced by this change.
- This is builder self-test evidence from the same session that wrote the code. No independent
  reviewer (Veritas, Codex, or otherwise) has examined this change.

**Builder self-test evidence — NOT independent review.**
