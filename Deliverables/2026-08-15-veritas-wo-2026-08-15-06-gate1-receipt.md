---
build: standalone
scope: WO-2026-08-15-06 — the two convergence fixes (Part A canonical ding callers · Part B runtime checker line-ending truth)
gate: 1

boundary: WO-2026-08-15-06 and the outcome it promised — (A) no repository code invokes the loose out-of-Git ding script; both live YouTube callers invoke the canonical installed governor, credentials still outside Git. (B) `tools/governor/convergence-runtime-check.ps1` distinguishes GENUINE installed-vs-canonical drift from mere line-ending representation, and still catches real drift.

# --- the two heads. PROVENANCE: which bytes were examined. ---
reviewed_sha: 58ddce383f3bea55c97499335149ef60e3aa63b2
governance_sha: b83f450ebdcfc790a54f2baf1289274c7b863ffe
branch: build-020/canonical-ding-and-crlf-check
remote_reachable: true — `git branch -r --contains 58ddce3` → `origin/build-020/canonical-ding-and-crlf-check`; PR #111 OPEN at headRefOid 58ddce383f3bea55c97499335149ef60e3aa63b2

# --- provenance of the evidence ---
evidence_method: mixed — git object reads at 58ddce3 (source) · live runtime (the installed governor, the live process table, the scheduled-task principal) · an ephemeral fixture install root built by Veritas outside the repository (AC5 made-to-fail)
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/0deb55dc-12c0-4c50-b8fb-8756fb3f0ecc/scratchpad/veritas-wo06
worktree_head_at_start: b83f450ebdcfc790a54f2baf1289274c7b863ffe
worktree_head_at_end: b83f450ebdcfc790a54f2baf1289274c7b863ffe
worktree_status_clean: true

verdict: PASS
receipt_sha256: 870d3a93ccedf44720fed7a30f867779b49952da04ede6150b15d517bd614b3b
reviewed_by: veritas
reviewed_date: 2026-08-15
next_review_trigger: a material change to either promised outcome — a further change to the send path in `watch-captures.mjs` / `ensure-youtube-watcher.mjs`, a change to the comparison logic in `convergence-runtime-check.ps1`, or repointing `apply-decision-card.mjs` off the loose script. Committing this receipt, committing the Work Order, or any clerical repair is NOT a trigger.
---

## Scope reviewed

The whole Work Package, both parts, all seven acceptance criteria in their **amended** form (AC3 exclusions widened, AC1 `--env-file` dropped, AC6 restated). No narrowing was applied and none was requested.

Deliberately not in scope: anything under `C:\.fusion247\**` (GL-012, `private_surface: none` — the loose script was never opened, listed or read; its behaviour is inferred only from repository callers) · `.claude/settings.local.json` (gitignored) · estate-wide convergence beyond the two named defects · CI/PR/release acceptance, which is Codex's.

**On the amendments.** The durable Work Order on disk still carries the *un-amended* AC1 (*"The env-file argument stays"*), which the delivered code contradicts. I did not accept the amended form on Larry's word: I established it from root `CLAUDE.md` § Rule 4a, which I loaded myself and which states *"it loads its own credentials; no `--env-file`, no shell preparation"* and names `node ~/.mypka/governor/ding.mjs <message-file>` as the delivery route. The amendment is authorised by higher-precedence operating law than the Work Order. See finding **F-1** for what is still owed.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | Both call sites invoke the canonical installed governor, credentials still outside Git | **PASS** | Both now spawn `path.join(os.homedir(),'.mypka','governor','ding.mjs')` with the message file as the sole argument. Resolved live: `C:\Users\Buggly\.mypka\governor\ding.mjs`, `exists: true`. Credentials unmoved — `ding.mjs:47` `CREDENTIALS_PATH = 'C:/.fusion247/fusion-capture-gateway.env'`, read at runtime, the **same file** the removed `--env-file` named. Nothing secret entered Git. | The `--env-file` removal is not recorded in the durable Work Order — **F-1** |
| AC2 | Interface proven by execution, not by reading | **PASS** | Executed the **real installed** `~/.mypka/governor/ding.mjs` via its exported `run()` with injected log/env/fetch (no live log write, no network): `argv=[msg.txt]` → the file's exact bytes became the posted `text`; `argv=[missing]` → `usage-message-file-unreadable` exit 4; `argv=[]` → `usage-no-message-file` exit 4. Source corroborates: `:344 const messageFile = argv[0]`, `:398 run({ argv: process.argv.slice(2) })`. Installed copy is **byte-identical** to canonical at 58ddce3 (sha256 `0f26ef16…5d4b` both sides). | none |
| AC3 | No repository caller remains, under the amended exclusions | **PASS** | I enumerated **every** reference myself (`git grep -I "larry-ding" 58ddce3 -- .`, 38 hits, classified by hand). Exactly **one executable caller** remains — `services/control-plane/wp-d-proof/apply-decision-card.mjs:42`, the declared deliberate non-fix. One **prose** mention in `.claude/agents/thin-larry.md:48` (a historical note in a shim root `CLAUDE.md` records as not to be bound — not a caller). All 36 others are `Deliverables/**`, `Builds/**`, `Team Knowledge/**` history. | the named residual, confirmed and strengthened below |
| AC4 | Content compared, not representation | **PASS** | Proven by execution, not by reading the new function: the same fixture that the **pre-fix** checker called `DERIVED-STALE` for a line-endings-only difference is called `DERIVED-CURRENT` by the **post-fix** checker. Arms 1 and 2 below. | CR-only *content* differences are normalised away — inherent to the approach, not a defect |
| AC5 | MADE TO FAIL | **PASS** | **Verified on my own fixture, not the builder's transcript.** Five arms, below. **Arm 3 is decisive**: with a one-character content change planted in one file *and an LF-only file still present in the same run*, the checker named **exactly** `capae-check.mjs` and did **not** name `a11y-probe.mjs`. Arm 3b is harder still and also passed: a one-character change **inside** the LF-only file was caught. A checker that had merely gone quiet fails both. | first-stage fail-open edge — **F-3** |
| AC6 | Real run reported, every reason proven non-artefactual | **PASS** | Full post-fix run against the live estate executed by me: 13 runtimes, `RESULT: FAIL`, `UNPLACED or STALE: 2`. Both reasons independently verified genuine: `~/.mypka/tower-runtime` is really stale (91 vs 380 and 114 vs 257 lines, content-different after CR normalisation); the scratchpad process root is really unplaceable. Neither is a line-ending artefact. | mis-labelling of the unplaceable root — **F-4**; the WO's own `acceptance_property` is not runnable as written — **F-2** |
| AC7 | No new mechanism | **PASS** | `git diff --name-status b83f450..58ddce3` → three `M` lines, **zero** `A`. One new function inside an existing file. No script, registry, inventory file, scheduled task or service. | none |

## Evidence provenance

- **Repository working tree never modified.** `git rev-parse HEAD` start / end — `b83f450ebdcfc790a54f2baf1289274c7b863ffe` / `b83f450ebdcfc790a54f2baf1289274c7b863ffe`, identical. `git status --porcelain` identical start to end (the same four pre-existing untracked entries, including the uncommitted Work Order).
- **The reviewed work was inspected where it lives**, from my own stable home at `C:/Fusion247PKA` — git object reads at 58ddce3 and read-only inspection of the `C:/Fusion247PKA-conv` worktree (clean, at 58ddce3). I did not move into the reviewed checkout and created no branch, worktree or stash.
- **Mutation testing happened only inside an ephemeral fixture** at `…/scratchpad/veritas-wo06/fixture-runtime`, outside the repository, built by me from canonical bytes. Both planted changes were restored and the restore verified by sha256 against pre-mutation copies. The fixture probe process was stopped by its **own** recorded PID (27808, written by the probe itself), never `$!`.
- **No live state was mutated.** The `ding.mjs` execution used an injected `logPath` in the scratchpad and an injected `fetchImpl`; the live `~/.mypka/governor/ding-log.jsonl` was not written and **no Telegram message was sent**. No file under `C:\.fusion247\**` was opened, listed or read.
- **Nothing in this receipt rests on the builder's account.** Every row was executed or read from source by me.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node ac2.mjs msg.txt` — real installed `ding.mjs` `run()`, injected deps | 0 | 3 argv arms | `TEXT_POSTED` = the file's exact bytes; missing file → exit 4 `usage-message-file-unreadable`; no arg → exit 4 `usage-no-message-file` |
| sha256 of installed vs canonical `ding.mjs` @58ddce3 | 0 | 1 | **byte-identical**, raw and CR-normalised (`0f26ef16…5d4b`) |
| `node --env-file=C:/no/such/file.env canary.mjs` (unpiped) | **9** | 1 | `node.exe: C:/no/such/file.env: not found` — **the canary never printed `SCRIPT-RAN`**. The script does not run. Builder's measurement independently confirmed |
| `node canary.mjs` (no flag, unpiped) | 7 | 1 | script ran, its own exit code survives |
| `run({ envPath: 'C:/no/such/creds.env' })` — the same failure without the flag | 2 | 1 | `credentials-file-absent`, **and a durable accounting line was written**. The removal restores the accounting the flag was destroying |
| **Arm 1** — pre-fix checker (b83f450) on the fixture | 1 | 3 files compared | `[DERIVED-STALE] … 1 file(s) differ: services\cockpit\a11y-probe.mjs` — a file differing **only** by line endings. False positive reproduced |
| **Arm 2** — post-fix checker (58ddce3), same fixture untouched | — | 3 | `[DERIVED-CURRENT] … 3 source files content-identical to canonical main (line endings normalised)` |
| **Arm 3** — post-fix, ONE character inserted in `capae-check.mjs` (CR count unchanged), LF-only file still present | — | 3 | `[DERIVED-STALE] … 1 file(s) differ: services\cockpit\capae-check.mjs`. **Exactly the planted file. The LF-only file was NOT named.** |
| **Arm 3b** (added by Veritas) — ONE character inserted in the **LF-only** file itself | — | 3 | `[DERIVED-STALE] … 1 file(s) differ: services\cockpit\a11y-probe.mjs`. Normalisation does not blind it even where representation also differs |
| **Arm 4** — both restored (sha256 match verified), post-fix checker | — | 3 | `[DERIVED-CURRENT] … 3 source files content-identical` |
| **AC6** — full post-fix run, real estate, fixture probe dead | 1 | 13 runtimes | 3 CANONICAL · 0 DERIVED-CURRENT · 8 PRIVATE-RUNTIME · **2 UNPLACED or STALE** · `RESULT: FAIL` |
| tower-runtime drift, CR-normalised comparison | 0 | 2 files | `add-list-item.dbtest.mjs` 91 vs 380 lines · `asdairCommands.mjs` 114 vs 257 · content identical: **False** both. **Genuine drift** |
| `bash scripts/secret-scan.sh --surface <the three changed files>` | **0** | 26 detection classes | `SCANNED 3 file(s) of the named surface, 0 secret value(s) found` |
| `gh pr checks 111` | — | 19 checks | `hub` **pass**, `unit` pass, `secret-scan` pass, `gateway` pass, `cockpit-db` pass · `cockpit-private-apps` **fail** |
| `gh run list --branch main` filtered to `cockpit-private-apps` | 0 | 8 runs | **failure at `b83f450e` (this branch's exact base) and at seven earlier main heads.** Pre-existing, independently confirmed |
| `git diff --name-status b83f450..58ddce3` | 0 | 3 | three `M`, zero `A` |
| `Get-ScheduledTask` → `MyPKA-YouTube-Watcher-Ensure` | 0 | 1 | `State=Disabled`, **`RunAs=Buggly`** — the same principal whose homedir holds the installed governor |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Both defects Warwick named on 2026-08-15 are closed, and closed narrowly. Nothing was built. |
| Design fidelity | **PASS** | The send path is now the one root `CLAUDE.md` § Rule 4a names, sourced from `tools/governor/ding.mjs` in Git. The checker correction is a comparison change inside a file that already existed. |
| Functional proof | **PASS** | Every acceptance property executed by me, including the pre-fix/post-fix pair that proves the change is the thing that made the difference. |
| Integration | **PASS** | The invoked target exists, is byte-identical to canonical, and accepts exactly the invocation the callers pass — proven by executing it. The homedir-relative resolution is correct for the real launch principal (`RunAs=Buggly`). **Recorded, not a defect of this WP:** the ensure task is `Disabled`, so the changed call sites are not currently exercised by any live process — a pre-existing state carried in the 4B receipts, and this WP never promised to change it. |
| Durability | **n/a** | The scope creates and claims no durable state. The pre-existing `ding-log.jsonl` accounting is untouched — and is in fact *restored* to the missing-credentials case by the `--env-file` removal (measured: exit 2 **with** a record, versus exit 9 with none). |
| Test quality | **PASS** | The accepted evidence bar for this WP was made-to-fail, and it holds under a fixture I built myself, including an arm the Work Order did not ask for (3b). **Limitation recorded — F-6:** no automated test executes the two changed spawn lines, so the green `hub` job is not evidence for Part A. |
| Git truth | **PASS** | Branch, head, two-commit split, scope and status all as reported. `58ddce3` is reachable from `origin/`, PR #111 is OPEN at exactly that oid, `main` untouched, no force-push, no unrelated scope contamination in the diff. |
| Documentation truth | **PASS** | The code carries an unusually complete and accurate account of *why* — including an explicit "do not restore this" note on `--env-file` with its measured reason, which is what stops a later well-meaning editor undoing it. **F-1 is recorded against the Work Order document**, which is a reviewer-facing clerical defect: it does not misdirect any operator or executable journey, and the functional evidence for AC1 was established independently of it. |
| Residual risk | **PASS** | Every remaining limitation is explicit and bounded — F-1 to F-7 below. The one that matters most (F-2) was **not** stated by anyone before this review. |
| Completed automation | **n/a, with a stated reason** | The Work Order explicitly declines the automatic claim: *"NOT INTENDED TO BE AUTOMATIC in the sense of unattended — (A) is a call-site change and (B) is an operator-run checker."* Nothing in this scope is presented as automation, and I found no claim to the contrary. The checker remains operator-run; no repository code calls it, and this receipt records that plainly rather than letting a green run imply otherwise. |

## Production caller and journey

**Part A.** `watch-captures.mjs` → `nudgePending` / `generatePendingNotes` / `reconcileStranded` → `defaultSendDing(message, tag)` → writes `%TEMP%/<tag>-<ts>.txt` → `spawnSync(node, [~/.mypka/governor/ding.mjs, tmp])` → `run({argv:[tmp]})` → `argv[0]` opened → credentials read from `C:/.fusion247/fusion-capture-gateway.env` → Telegram POST → one durable line in `ding-log.jsonl` → exit code → caller's `r.status === 0`. `ensure-youtube-watcher.mjs` → `defaultNotify` is the identical shape. **Every hop up to the Telegram POST was executed by me** — the last hop deliberately was not, because exercising it means sending a real message to Warwick's phone, which is an acceptance event a reviewer must not manufacture.

**Part B.** The checker is **operator-run only**: no repository code calls it and no scheduled task invokes it. Its five arms are therefore its only executable proof, which is precisely why the builder asked for eyes that were not its own. Journey inside a run: live `node.exe` process table → `Resolve-CodeRoot` → `Get-RuntimeRoot` → classification → `Test-DerivedFromMain` → raw hash fast path → `Test-ContentIdentical` on mismatch → verdict + exit code. Entered at the real entry point (the script, unmodified, run as an operator would) in all five arms.

**The residual caller, confirmed and stronger than stated.** `apply-decision-card.mjs:42` must keep calling the loose script, and the analysis given to me is correct — canonical `ding.mjs` reads `argv[0]` and nothing else (the only `argv` references in the whole file are `:268`, `:344`, `:398`), and the strings `--reply-markup` / `--plain-text` / `reply_markup` appear nowhere in it. Repointing it would silently drop the inline keyboard, so decision-card buttons would vanish with no error. **It is worse than that:** canonical's stdout summary is `{ts, outcome, exit, message_id, bytes}` — it carries **no `chat_id`**, so `apply-decision-card`'s `chat_id = o.chat_id ?? o.result?.chat?.id ?? null` would silently become `null` and typed-reply correlation would break too. Two silent regressions, not one. **The loose file cannot yet be decommissioned, and this is the reason.**

## Restart and durability

`n/a` — no durable state is created or claimed by this scope. The fixture probe was killed and its absence confirmed before the clean AC6 run, which is restart evidence about my own method rather than about the product.

## Documentation contradiction scan

- **Declared DOCUMENT IMPACT:** `[]`, "checked by execution", with `.claude/settings.local.json` reported-not-edited.
- **Verified independently:** that list holds. `.claude/settings.local.json` is gitignored, was not edited, and its standing permission entries naming the loose script remain — correct, since one caller still needs it.
- **What the list missed:** the Work Order itself (**F-1**) — the one document that *did* need a change and is the one that got none.
- **Active documents that would misdirect a fresh instance:** none in the repository. `Deliverables/2026-08-04-proofline-wayfinder-plan.md:1954` (*"cannot be retired or edited… reported once, not fixed"*) is now partly superseded, but it is a dated historical record of a past decision, correctly frames itself as such, and does not instruct anyone to do anything today. Recorded, `non-blocking`, no action recommended.
- **Closure claims since the last receipt, and the receipt behind each:** none found. No document claims this Work Package complete, closed or accepted; the branch is unmerged and the PR is open. Nothing to detect.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **F-1** | medium | `Deliverables/2026-08-15-wo-canonical-ding-and-crlf-check.md` is **untracked** (`??`) and its AC1 still reads *"The env-file argument stays"* — the opposite of what was delivered. The read-back amendments to AC1, AC3 and AC6 exist in no durable artefact. A `git clean` erases the order outright. | **non-blocking** on the product — I established AC1's accepted form from root `CLAUDE.md` § Rule 4a rather than from the order. **But it should be committed in its amended form before Codex is invoked**, or Codex will be handed a claim document that contradicts the delivered code on AC1 and will have no record that the amendment was authorised. Committing it is clerical and does **not** reopen this gate. | Larry |
| **F-2** | medium | **The Work Order's own `acceptance_property` is not runnable as written, and nobody noticed.** It says *"Run the checker against the CURRENT installed governor… it must report NO drift."* The checker structurally cannot examine `~/.mypka/governor`: it enumerates the roots of **live node processes** (no process runs from there) and `Test-DerivedFromMain` returns `no services/ subtree` for any root lacking one (`~/.mypka/governor` has none). **Consequence worth knowing: drift of the installed `ding.mjs` — the exact file Part A now depends on — is invisible to the Part B checker. The two halves of this Work Package do not cover each other.** The equivalent property *was* proven, against a derived install root with a `services/` subtree (my fixture), and I measured installed vs canonical `ding.mjs` byte-identical today. | **non-blocking** — an observation for Warwick, not a Work Order, and explicitly **not** a recommendation to build coverage. Both halves work as promised. | Warwick decides |
| **F-3** | low | **First-stage fail-open.** With script-scope `$ErrorActionPreference = 'SilentlyContinue'`, if `Get-FileHash` fails on **both** files, `$a` and `$b` are both `$null`, `$a -ne $b` is `$false`, the `-and` short-circuits, and `Test-ContentIdentical` is never reached — the file is counted as checked and clean. The new function's own `FAILS CLOSED` comment is true of the second stage only. Pre-existing shape, not introduced here. The single-side case is handled correctly (unreadable install file → hashes differ → `Test-ContentIdentical` catches → `$false` → drift). **Established by source reading, not execution — labelled as such.** | **non-blocking** | Warwick decides |
| **F-4** | low | **Carried finding confirmed.** An unplaceable process root is mis-labelled. PID 31028, running from a scratchpad directory, is reported `DERIVED-STALE` with detail `1 file(s) differ from canonical main: no services/ subtree`. It is neither derived nor stale — the correct class is `UNKNOWN`. It still fails the run, so there is **no fail-open**; the defect is a wrong label. Confirmed it does **not** fall out of the AC4 change for free, exactly as reported. | **non-blocking** | Warwick decides |
| **F-5** | low | **Carried finding confirmed genuine.** `~/.mypka/tower-runtime` is really stale: `add-list-item.dbtest.mjs` 91 vs 380 lines, `asdairCommands.mjs` 114 vs 257, content-different after CR normalisation. Real drift, correctly reported, correctly not fixed here. Estate convergence is outside my boundary. | **non-blocking** | Larry (estate convergence) |
| **F-6** | low | No test executes `defaultSendDing` or `defaultNotify`. `capture-durability-check.mjs` injects stubs for both, so the two changed `spawnSync` lines have **zero executed coverage** in CI. The green `hub` job must not be read as evidence for Part A. Not a defect in the change — testing a real spawn means sending a real Telegram — but the limitation should not be quietly inherited. | **non-blocking** | Warwick decides |
| **F-7** | informational | `cockpit-private-apps` CI failure independently confirmed **pre-existing**: it fails on `main` at `b83f450e`, this branch's exact base, and at seven earlier main heads. Not caused by this work. Its fix is reported to be sitting in PR #108. | **non-blocking** | Larry |

## Verdict

**PASS** — both defects are genuinely closed: the repository's live notification callers now go through the versioned, reviewable path with credentials still outside Git and the accounting restored, and the runtime checker was made to fail on my own fixture, catching a one-character content change in the same run in which it correctly ignored a file differing only by line endings.

Answering the human question directly, in both directions: **(i)** yes — the two YouTube callers invoke a script whose source of truth is in Git and which I executed to confirm it accepts exactly what they pass; one caller remains on the loose script for a reason I verified independently and which is stronger than reported, so the loose file cannot yet be decommissioned. **(ii)** yes — the checker no longer invents drift and no longer goes blind to it, proven in four arms plus one I added; and the two things it still reports are both real, one of them being a genuinely stale runtime.

**The honest limit on that confidence, stated because it was not stated anywhere else: this checker cannot see the installed governor at all (F-2), so it is not the control that would catch the installed `ding.mjs` drifting from canonical.** They are byte-identical today; I measured it.

## Next review trigger

A material change to either promised outcome: a further change to the send path in `watch-captures.mjs` or `ensure-youtube-watcher.mjs`; a change to the comparison logic in `convergence-runtime-check.ps1`; or repointing `apply-decision-card.mjs` off the loose script. **Committing this receipt, committing the Work Order in its amended form, or any other clerical repair is NOT a trigger and does not reopen this gate.**
