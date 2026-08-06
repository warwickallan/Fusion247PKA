---
build: BUILD-020
scope: phase-4-automation-law
gate: 2

reviewed_sha: 89602f3f471d135bd4ef1a2ceeb86565f85c5d27
governance_sha: 89602f3f471d135bd4ef1a2ceeb86565f85c5d27
branch: build-020/phase4-automation-law
remote_reachable: false                # git branch -r --contains -> empty; git ls-remote origin -> SHA absent

evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA-build-020-trial/13497969-3b0f-4345-b9b8-42de0cac3b65/scratchpad/export
worktree_head_at_start: 89602f3f471d135bd4ef1a2ceeb86565f85c5d27
worktree_head_at_end: 34d0cd0e6b84bd212627036b0c63508a43b2a5b8
worktree_head_matched: false           # Larry committed to the reviewed branch DURING the review - finding V4-10
worktree_status_clean: true            # git status --porcelain empty at start and at end

review_ceiling: 45 minutes elapsed, scope-bounded
verdict: HOLD
receipt_sha256: 0aa783d2d60ebb57227b08dfe2ce95e86b70ad8a75b50efd3e6ed3a3a1cb136e
reviewed_by: veritas
reviewed_date: 2026-08-06
next_review_trigger: a new exact head with the branch pushed, map lines 1035/2031/2035 reconciled, and claim (e) either evidenced by an observed hook firing or explicitly reclassified as manual
---

## Scope reviewed

Gate 2 (phase/vertical-slice) with Gate 3 (documentation and Git truth) folded in, on BUILD-020 Phase 4
"automation law", `4eb5368..89602f3`, 23 commits, 17 files.

**Scope as Veritas determined it** — the dispatch named five claims (a)–(e). I widened to the accepted phase
outcome recorded in the map's §17.3 (the canonical law and its five projections), §17.1 (JOB 1), §17.2/§17.7
(JOB 2), §17.5/§17.5a (the ordered closure sequence) and §17.8 (the attention correction), because §17.5 is
the phase-completion contract and step 4 of its table is this review. That widening added the operative
sequence table and `/rotate` to scope; both carry findings below.

**Deliberately NOT in scope:** release-level confidence, security review, the merged Phase 3 content below
`4eb5368`, Supabase reporting (explicitly deferred by Warwick), and Warwick's own confirmation that
`message_id 326` reached his phone — that is his, not mine, and I do not substitute for it.

## Evidence provenance

- Isolated export of `reviewed_sha` at
  `C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA-build-020-trial/13497969-3b0f-4345-b9b8-42de0cac3b65/scratchpad/export`,
  created with `git archive 89602f3f471d135bd4ef1a2ceeb86565f85c5d27 | tar -x -C <workspace>`. Outside the
  repository; never committed.
- Repository `git status --porcelain` — **empty at start and empty at end.** No file in the working tree was
  modified by this review. `envelope.test.mjs` writes only to `os.tmpdir()` (verified by source before running).
- Repository `git rev-parse HEAD` at start — `89602f3f471d135bd4ef1a2ceeb86565f85c5d27`.
- Repository `git rev-parse HEAD` at end — **`34d0cd0e6b84bd212627036b0c63508a43b2a5b8`. THEY DO NOT MATCH.**
  The repository advanced during the review; Larry committed `34d0cd0` ("Map §17.8: the reminder hook FIRED —
  and at the wrong moment") to the reviewed branch while assurance was in flight. `git diff --stat 89602f3
  34d0cd0` shows one file, the Wayfinder map, +29 lines — a document **inside the reviewed scope**. Recorded
  as finding V4-10. It did not contaminate this evidence: every product artefact was read from the export or
  from `git cat-file` at `reviewed_sha`, and `tools/**` is byte-identical between the two heads.
- No mutation testing was performed by this review; the mutation evidence relied on is the suite's own
  MUT-1..MUT-7 tests, executed.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git rev-parse 89602f3:'Team/Veritas .../AGENTS.md'` | 0 | n/a | blob `6f3c111447b307c26e5ad06d39be5fe123acd4b3` — contract bound |
| `git branch -r --contains 89602f3` | 0 | n/a | **empty — head not on any remote branch** |
| `git ls-remote origin \| grep 89602f3` | 1 | n/a | **SHA NOT FOUND ON REMOTE**; `build-020/phase4-automation-law` absent from `refs/heads/*` |
| `node --test tools/governor/ding.test.mjs` (in export) | 0 | **56 / 56 pass** | complete run, `1..56` |
| `node --test tools/wo/envelope.test.mjs` (in export) | non-zero | **27 pass / 2 fail / run aborted at 29 of 60** | `fatal: not a git repository` — suite is not hermetic (V4-7) |
| `node --test tools/wo/envelope.test.mjs` (repository tree) | 0 | **60 / 60 pass**, `1..60` | includes MUT-1..MUT-7 anti-fabrication mutations |
| `git cat-file blob 89602f3:tools/governor/ding.mjs \| sha256sum` | 0 | n/a | `0f26ef1624dcb85e031a30a74e6421f5de12e9a7266fb452b727e9e7e17b5d4b` |
| `sha256sum ~/.mypka/governor/ding.mjs` | 0 | n/a | `0f26ef16…` — **byte-identical to the repo blob. Claim (d) holds.** |
| `cat ~/.mypka/governor/ding-log.jsonl` | 0 | n/a | 2 durable rows: `message_id 326` (01:30:20Z) and `327` (01:44:30Z), both `outcome:"sent"`, `exit:0` |
| `node .claude/hooks/notify-reminder.mjs` | 0 | n/a | valid JSON, `hookEventName:"PostToolUse"`, populated `additionalContext` |
| `git rev-parse main` / `git ls-remote origin refs/heads/main` | 0 | n/a | both `4eb5368e…` — **main untouched, local and remote agree** |
| `gh pr list --state all` | 0 | n/a | newest is #96 (Phase 3, MERGED). **No PR for this branch.** |
| `~/.mypka/governor/INSTALLED-FROM.txt` | n/a | n/a | records install from blob at `8b0528ba`, rollback **executed** (absent→install→delete→verify→reinstall→equal) |

**Evidence NOT obtained, named rather than smoothed:**

1. **The `PostToolUse` reminder hook was not observed to fire at `reviewed_sha`.** It cannot be: the hook is
   registered in `.claude/settings.json`, created for the first time in this diff, and a hook has no effect
   until the host restarts. I have no instrument that reports which hooks the running host loaded.
2. **31 of 60 `envelope.test.mjs` subtests were never executed under the mandated isolation method** (V4-7).
   The full 60/60 was obtained against the repository working tree, whose `tools/wo/**` is byte-identical to
   `reviewed_sha` (`git diff --stat 89602f3 34d0cd0` = one map file). That is a sound substitution and it is
   stated as a substitution, not as isolated evidence.
3. **Arrival of `message_id 326` on Warwick's phone.** Telegram `ok:true` evidences that the message left and
   was accepted. It is not the claim "he saw it", and no row here asserts it.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Warwick's exact text is canonical once in root `CLAUDE.md` §"Nothing may live only in Larry's head"; the envelope generator reads grants verbatim from the canonical contracts on disk; the send path delivered twice from the installed file. |
| Design fidelity | **PASS** | No control plane, no classifier, no daemon, no Nolan checker. The hook is zero-model and its source contains no network, no spawn, no agent launch — asserted by me from source, not from its own comments. `/rotate` was extended, not replaced. Regrowth cap respected. |
| Functional proof | **HOLD** | (a)(b)(c)(d) proven by execution. **(e) is unproven**: the reminder hook is executable but its production event has never been observed to invoke it at this head. |
| Integration | **HOLD** | The send path is fully wired end-to-end from the installed runtime. The envelope generator sits on no unavoidable path (**J1-1 OPEN**, Larry's own record). The hook's registration is written but not evidenced as loaded. |
| Durability | **HOLD** | Product-side durability is strong: `ding-log.jsonl` is append-only, a row is written on **every** exit path including usage errors, and tests 4/5/32/35–39 prove the failure rows and the redactor. **But `reviewed_sha` exists on no remote.** Contract, §Method 1: a head not remotely reachable cannot receive PASS. |
| Test quality | **PASS** | 56/56 ding + 60/60 envelope. Seven MUT-* tests prove the anti-fabrication property turns red when removed; ding tests pin the exit-code table, the credential-name-only logging, and the deliberate refusal of an inherited `TELEGRAM_BOT_TOKEN`. Zero-subtest runs did not occur. Non-hermeticity recorded as V4-7, non-blocking. |
| Git truth | **PASS, with one omitted material fact** | Every stated claim verified true: 23 commits, nothing merged, no PR, `main` = `4eb5368` locally and on origin. **The claim omits that the branch and head are local-only**, which is the fact that determines the verdict. Not a misstatement; an omission, recorded. |
| Documentation truth | **HOLD** | Two surviving statements contradict the operative one and would misdirect the next action (V4-2, V4-3). Three further defects recorded non-blocking. |
| Residual risk | **PASS** | Every non-claim Larry declared was checked and each is accurate: J1-1 open, AC-5 at 2 of 3, hook written-not-observed, arrival is Warwick's confirmation. §17.6's AC-5 accounting and §17.7's "what this does NOT prove" block are honest and, in the AC-5 case, *narrower* than the evidence would have permitted him to claim. |
| **Completed automation** | **HOLD** | See below — this is the dimension the dispatch asked me to press hardest on. |

### Completed automation — the finding Larry asked for, and the one he did not get

I looked specifically for capability described as completed automation. **I did not find it.** §17.7 draws
the boundary correctly and explicitly: *"the MECHANISM (the send path) is now complete; the JUDGEMENT is not
a mechanism"*, and Warwick's Rule 4a reclassifies the judgement as manual in terms — *"The judgement remains
Larry's; delivery is mechanical."* That is the root clause's own permitted resolution ("explicitly
reclassified as manual"), it is recorded canonically rather than in a caveat, and (c)/(d) therefore pass this
dimension on the mechanism.

The dimension nonetheless **HOLDs**, on two outcomes that are intended automatic and are neither exercised
through their real production event nor reclassified:

- **(e), the reminder hook.** Its production event is a specialist return. At `reviewed_sha` that event had
  never invoked it. Written and executable is capability; the clause is explicit that a callable script is
  not completed automation.
- **(b), envelope generation.** J1-1 is OPEN — nothing makes generation unavoidable, and `WO-2026-08-06-20`
  was hand-authored (§17.6 G-6: the generator has no MACHINE-INSTALL shape). "OPEN" is honest, but it is a
  third state: not exercised, and not reclassified to manual. The root clause offers only two.

Neither is a false claim. Both are unresolved mandatory properties, which is a HOLD and not a qualified pass.

## Production caller and journey

**Journey 1 — the notification path (claims c, d).** Larry's judgement → `node ~/.mypka/governor/ding.mjs
<message-file>` → `loadCredentials()` reads `C:/.fusion247/fusion-capture-gateway.env` at runtime, ignoring
any inherited `TELEGRAM_BOT_TOKEN` → `sendMessage()` POSTs plain text to FusionDevBot → `appendRecord()`
appends one JSONL line to `~/.mypka/governor/ding-log.jsonl` → exit code. **Every hop is on the real
journey**, executed from the installed file with no `--env-file` and no shell preparation, twice, leaving
rows `326` and `327` on disk. The credentials file itself was never opened by this review (`C:\.fusion247\**`
is denied by default; no surface was declared and none was needed).

**Journey 2 — the reminder hook (claim e).** Host loads `.claude/settings.json` at session start → a `Agent|Task`
tool completes → host runs `node .claude/hooks/notify-reminder.mjs` → JSON `additionalContext` injected into
the parent turn. **Hops 1 and 3 are unproven at this head.** I proved only that the program, invoked directly
by me, emits the right JSON and exits 0 — which is precisely a component reached by calling it directly, and
is therefore **not** evidence of the journey. Two further latent risks on hop 3, recorded because they cost
nothing to state: the command uses the **relative** path `node .claude/hooks/notify-reminder.mjs`, so it
fails silently if the host's working directory is ever not the repository root; and `.claude/settings.json`
is the exact file Warwick deliberately removed once before (root `CLAUDE.md` Rule 4), now re-created — with
different, harmless content, but re-created.

**Journey 3 — envelope generation (claim b).** `tools/wo/envelope.mjs` resolves each field by reading the
canonical `Team/<Name>/AGENTS.md` and the shims from disk, and emits `UNRESOLVED` naming what it sought
rather than a plausible default. MUT-1..MUT-7 each remove one such refusal and the suite turns red. The
property "refuses to fabricate a grant" is **proven**. The property "orders are generated rather than typed"
is **not** — that is J1-1, and `WO-2026-08-06-20` at `0cc2ffe` is the counter-example inside this very diff.

## Restart and durability

- **Kill-and-revive equivalent, executed by the installer and verified by me:** `INSTALLED-FROM.txt` records
  absent → install → **delete** → verify absent and directory back to 14 files → reinstall from the same blob
  → equal. The installed bytes were also imported and run under node v22.18.0.
- **State that survived:** `ding-log.jsonl` persisted across two separate process invocations 14 minutes
  apart and is present now, after both processes are long dead. Append-only, one line per invocation.
- **Not durable:** `reviewed_sha` itself. It exists in exactly one working clone on one machine. A phase that
  has not left Larry's context is not delivered — and this one has not.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** §17 of the map (heavily rewritten), root `CLAUDE.md`, the five
  projections, `/rotate`. He explicitly asked me to hunt for a surviving statement contradicting the
  operative one, naming the phase-close report, the Pax timing and the Google Drive → Git change.
- **Verified independently of his list:** all five projection surfaces exist and point rather than paraphrase
  (`grep -rn "Nothing may live only in Larry"` across the export). `/rotate`'s steps 5–8 and its Bars are
  internally consistent and consistent with §17.5a. The START/RESUME block correctly holds a pointer, not a
  copy, of Rule 4a.
- **What his list missed — he was right to be suspicious, and the defect is where he pointed:**
  - **`Deliverables/2026-08-04-proofline-wayfinder-plan.md:2035`** — *"**The Google Drive report** (originally
    step 4) **follows the Pax commission and is therefore also post-rotation.**"* Active text, not inside the
    `<details>` superseded block, directly contradicting `:1967` (*"⛔ The report is a GIT artefact. NOT
    Google Drive… this supersedes the earlier 'publish to Google Drive' step entirely."*).
  - **`:1035`** — §15.2, the section §17.5 explicitly **REACTIVATED**, still defines the deliverable as *"A
    durable phase-close report in **Google Drive**."* Reactivating a section reactivates its body.
  - **`:2031`** — *"The commission IS the investigation, and it belongs to the session after this one."*
    contradicting §17.5a and `/rotate` steps 5–6, which put the Pax commission **inside this rotation** and
    forbid `SAFE TO CLEAR` without it.
- **Active documents that would misdirect a fresh instance:** the three lines above. A fresh Larry reaching
  §17.5 step 5 gets contradictory instructions on both *what* the report is and *when* Pax is commissioned —
  and one branch of the contradiction points at an outward Google Drive write that `:1225` records Warwick
  has never authorised.
- **Closure claims since the last receipt, and the receipt behind each:** §17.5 marks steps 1, 2b and 3 DONE
  and §17.6 marks STEP 2 COMPLETED. **None claims a Work Package, phase or build complete**, none uses the
  reserved vocabulary, §17.4 states *"Nothing in §17 is complete on Larry's assertion"*, and §17.5 step 4
  lists this review as NEXT. **No suppressed receipt. No false completion claim.** This is the correct
  discipline and it is recorded so.
- **On Larry's own errors (his question 4):** the two notification misses are recorded verbatim with
  Warwick's words and marked *"Both correct"* (§17.7); the stale SHA is recorded at `:2082` as a class-A
  envelope defect; the "contract gap" error is recorded at §17.6 and in commit `08344dd` as *"Larry's
  error"*. **Three of four.** The eyeballed token figure that was ~2× wrong **is not recorded anywhere at
  this head** — §17.5a requires the *future* report to read figures "from the instrument, never estimated",
  which is the corrective, but the incident itself is absent while its three siblings are named. Recorded as
  V4-11, non-blocking, and owed to the rotation report rather than to another cycle.

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| **V4-1** | **blocking** | `89602f3` is on no remote ref; `build-020/phase4-automation-law` does not exist on origin. Contract §Method 1: a head not remotely reachable cannot receive PASS. **Blocks:** any PASS, any phase-complete record, and step 5 (`/rotate`), whose `SAFE TO CLEAR` bar requires Git state durable-or-classified. | Larry |
| **V4-2** | **blocking** | Map `:2035` and `:1035` still name **Google Drive** as the phase-close report target, contradicting the operative `:1967` and `/rotate`. `:1035` sits in §15.2, a section §17.5 explicitly reactivated. **Blocks:** step 5 — it points the next action at a superseded, unauthorised outward target. | Larry |
| **V4-3** | **blocking** | Map `:2031` — *"The commission IS the investigation, and it belongs to the session after this one"* — contradicts §17.5a and `/rotate` steps 5–6, which commission Pax inside this rotation. **Blocks:** step 5. | Larry |
| **V4-4** | **blocking (for the automation claim only)** | Claim (e)'s reminder hook is an intended-automatic outcome, never observed to fire at this head and not reclassified as manual. Root clause: capability, not completed automation. **Blocks:** any statement that the attention correction is delivered. Does **not** block the rest of the route. | Larry |
| **V4-5** | non-blocking | Root `CLAUDE.md` names its fifth projection as *"the Wayfinder template and start contract"*. **No Wayfinder template file exists**, and the map's START/RESUME contract does not carry the automation-frontier clause. It landed only in root `CLAUDE.md` §Wayfinder — the canonical file pointing at itself. Claim (a)'s "five projections" is four distinct surfaces plus a self-reference. | Larry |
| **V4-6** | non-blocking | §17.5 sequence table row 2 still reads **"IN FLIGHT"** for Mack's install while the adjacent row 2b reads **"✅ DONE"**. Same table, adjacent rows. | Larry |
| **V4-7** | non-blocking | `tools/wo/envelope.test.mjs` is not hermetic: in a clean `git archive` export it aborts at subtest 29 of 60 with `fatal: not a git repository`, leaving 31 subtests unexecutable under Veritas's mandated isolation method. | Keel / Larry |
| **V4-8** | non-blocking | `.claude/commands/rotate.md` renumbering left a stale cross-reference: the final Bar says *"that is a step 9 correction"*, but the correction step is now 13; step 9 is the continuity publish. | Larry |
| **V4-9** | non-blocking | `services/control-plane/review/prompts/tower-qa-skill.md` §3a **restates** the four-point operative test rather than pointing only. It justifies this in-text (root `CLAUDE.md` is never injected into Codex) and does not weaken the rule — but a restatement is a drift surface, and the canonical clause says projections must not paraphrase. Recorded, not resolved by me. | Larry / Warwick |
| **V4-10** | non-blocking | The repository HEAD advanced from `89602f3` to `34d0cd0` **during this review**, editing §17.8 — a document inside the reviewed scope. Evidence was unaffected (all product artefacts read from the export or `git cat-file`), but a receipt bound to `89602f3` no longer covers the branch tip. Committing to a branch under assurance costs the review its currency. | Larry |
| **V4-11** | non-blocking | Of the four errors Larry declared this session, three are recorded in the durable record (two notification misses §17.7; stale SHA `:2082`; "contract gap" §17.6 + `08344dd`). The **eyeballed token figure that was ~2× wrong is not recorded at this head.** Owed to the rotation report, not to another assurance cycle. | Larry |

**Nothing in this receipt is a Work Order.** A finding is an observation. What becomes work, what is parked
and what may interrupt Warwick is root `CLAUDE.md` §Finding disposition, and it is Larry's to apply.

## Verdict

**HOLD** — the phase's product claims (a)–(d) are real and evidenced, but the reviewed head exists on no
remote, two active statements in the map would send the next action at a superseded Google Drive target and
contradictory Pax timing, and the one intended-automatic outcome in claim (e) has never been invoked by its
production event.

**What this HOLD gates, exactly:** the PASS itself, any record that Phase 4 or any of its Work Packages is
complete, and step 5 of §17.5 (`/rotate`) until V4-1, V4-2 and V4-3 are corrected. **What it does not gate:**
anything else safe on the route. The frontier remains the Wayfinder's.

**What I was asked to find and did not:** capability described as completed automation. §17.7's
mechanism-versus-judgement boundary is drawn correctly, §17.6's AC-5 accounting is *narrower* than the
evidence would have allowed, and no closure claim in §17 lacks a receipt behind it. The honesty of the record
is the strongest property of this head.

## Next review trigger

Resubmission of a **new exact head** on which: (1) the branch is pushed to origin, (2) map `:1035`, `:2031`
and `:2035` are reconciled to the operative §17.5a, and (3) claim (e) is either evidenced by an observed hook
firing on a real specialist return or explicitly reclassified. V4-5 through V4-11 are parked to the scheduled
reconciliation and must not trigger a second documentation-only review of this scope without Warwick's
explicit authority.
