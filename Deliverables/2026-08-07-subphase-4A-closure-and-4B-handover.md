# Sub-phase 4A — closure record and Sub-phase 4B handover

**Date:** 2026-08-07 · **Branch:** `build-020/phase4-automation-law` · **Map:** [[Deliverables/2026-08-04-proofline-wayfinder-plan]]
**Purpose:** nothing required for continuation may remain only in a 500k-token session or a specialist transcript. This file is that guarantee.

---

# PART 1 — Sub-phase 4A: what was delivered

| # | Outcome | State | Evidence |
|---|---|---|---|
| 1 | **Grok-host blocker withdrawn**; Zapier MCP Outlook verified present on Claude host | DONE | Amendment 3, `9171248` |
| 2 | **Return-cue F1 defect repaired** — `SessionStart` drops every cue unconditionally | DONE | `e1b0121`; 12/12 tests, mutation-proven |
| 3 | **CareerAIR MCP demonstration** on 4 real messages | DONE — **row 3 NOT LIVE** | [[Deliverables/2026-08-06-careerair-mcp-demonstration-evidence]] |
| 4 | **Cockpit row-4 truthfulness defect** found and repaired (twice) | DONE | same file §4 and §4a |
| 5 | **Veritas Gate 1** at `0cf70c9` | **FAIL** (row 3 alone) | [[Deliverables/2026-08-06-veritas-gate1-amended-wp-0cf70c9-receipt]] |
| 6 | **D-2 / D-4 corrections** | DONE | `6a804e4` |
| 7 | **Row 3 descoped** → BACKLOG C-10 | DONE | Amendment 4, `fb3a61c` |
| 8 | **Specialist-return hooks descoped and disabled** | DONE | Amendment 5, `664ea4c` |
| 9 | **CareerAIR alert muted**, both halves | DONE | proven through a real scheduled-task fire |
| 10 | **Flashing root cause proven** | DIAGNOSED, **not applied** | `cf94a54`, `aed2fdc` |
| 11 | **Wayfinder navigation repaired** | DONE | this session — enumeration below |
| 12 | **Eight research artefacts** *(corrected from "four" — Veritas)* | BANKED | branch `research/wayfinder-transferability` @ `619c548` |

## The active-map enumeration (Warwick's §3A requirement)

Every statement in the active map capable of directing a fresh Larry's next action, after repair:

| Line | Statement | Resolves to |
|---|---|---|
| 19 | `⟦ROTATION BLOCK⟧` **Frontier** row | **§ ACTIVE SESSION WORK PACKAGE** |
| 20 | `⟦ROTATION BLOCK⟧` **First safe action** row | **§ ACTIVE SESSION WORK PACKAGE → 🎯 THE EXACT NEXT ACTION** |
| 421 | §12 Phase 1 frontier | ⛔ historical, non-directive |
| 1423 | §14.19 Phase 2 frontier | ⛔ historical, non-directive **(retired today)** |
| 1661 | §16.8 Phase 3 frontier | ⛔ historical, non-directive **(retired today)** |
| 1782 | §17 Phase-completion contract | standing requirements, **not** a frontier statement **(corrected today)** |
| 2123 | Option-A-reduced next action | ⛔ superseded — delivered, then descoped **(retired today)** |
| 2339 | §17.4 Frontier | signpost → § ACTIVE SESSION WORK PACKAGE |
| 2440 | 🎯 THE EXACT NEXT ACTION | **the one current target** |

> ## ⛔ THE TABLE ABOVE IS THE FIRST, REFUTED ENUMERATION. Retained so the method failure is visible.
>
> **Veritas FAIL @ `2cf3673` refuted it on two grounds, both correct:**
>
> **① It verified where the arrows POINT, not whether the DESTINATION is true.** Every pointer was corrected to aim at § ACTIVE SESSION WORK PACKAGE — and that section's own `🎯 THE EXACT NEXT ACTION` was **itself stale**, still listing the Zapier demonstration (descoped by Amendment 4) and the hook install (descoped by Amendment 5), and still saying "rows 1–4" against its own heading's "rows 1, 2 and 4". **Fixing where an arrow points does not make the target true.**
>
> **② The control was bad method.** ~~*grep for "ONLY place in this map" or "THIS IS NOW THE LIVE FRONTIER" → zero*~~ — the live claim read *"THIS **SECTION** IS NOW THE LIVE FRONTIER"*, which that literal cannot match. **A string literal was used to discharge a semantic completeness claim.** Nine rows were enumerated where Veritas counted twenty-four.

### ✅ CORRECTED ENUMERATION — semantic, 2026-08-07

**Method changed.** Candidates are matched by **semantic class**, case-insensitively — *live/current frontier · first safe action · first safe continuation · next action · follow up after · must survive rotation · gate open · not started · read this first · do these in order* — and each is then checked for a **retirement marker**, rather than tested against one literal string.

**Result: 47 candidates · 13 already retirement-marked · 34 unmarked.** Of the 34, most are descriptive prose, acceptance criteria or method rules that direct nothing. **Nine were genuinely directive and false, and all nine are now retired:**

| Line | Statement | Repair |
|---|---|---|
| 19 / 20 | `⟦ROTATION BLOCK⟧` **Frontier** and **First safe action** — pointed at §14.19 (Phase 2 CLOSED) | → § ACTIVE SESSION WORK PACKAGE |
| 429 | *"THE CURRENT FRONTIER IS §14… §15 is Phase 3, recorded and NOT started"* — **both clauses false** | retired |
| 447 | *"The frontier has moved. **Go to §13.**"* | retired |
| 1569 | *"The frontier is now §14, not §13.6. Nothing has been implemented."* — inside §13.6 *"for the fresh session"* | retired |
| 1556 | §13.6 heading *"First safe continuation — for the fresh session"* | marked historical |
| 1576 | *"THIS **SECTION** IS NOW THE LIVE FRONTIER"* (§16 = Phase 3, **merged**) — the instance the bad grep missed | retired |
| 1031 / 1235 | §15 *"GATE OPEN — NOT STARTED"* — Phase 3 delivered and merged | banner added |
| 2059 / 2063 | §17.9 *"FOLLOW UP AFTER `/rotate`"* + *"must survive rotation"* — descoped by Amendment 5 | discharged |
| 2463+ | **The destination itself** — the spent seven-step route | replaced with the one current next action |

**Two lessons, not one.** ① Both earlier repairs named a section **NUMBER** and went stale when a later phase added a section — the target is now named by **section IDENTIFIER**. ② **An identifier does not make the section it names TRUE.** The pointer must be stable *and* the destination must be re-asserted current. Veritas's words: *"The identifier is not this repair's weakness; it is a real improvement. The weakness moved."*

### 🔴 THIRD LESSON — the second FAIL, and it is a method lesson (Veritas F5 @ `52427cd`)

**A tenth directive survived inside its own retirement banner.** §17.9's heading *quoted* `"This note must survive rotation"` as retired while **the sentence itself was never struck** — the contract's named Gate 3 failure verbatim: *"A supersession banner does not pass while the body still instructs the opposite."* It was blocking because the next action is **run `/rotate`**, and that sentence instructed descoped work **into the continuity packet — the first artefact a fresh Larry reads**.

**Why the sweep missed it, and this is the durable part.** The weakness was **granularity, not coverage** — Veritas added ten phrase families beyond mine and surfaced only two benign extras. The sweep matches **lines**; the repair retires the **matched phrase**; sibling sentences in the same block survive saying the same thing. **And a line-level post-check cannot catch it either**, because the survivor shares a line with struck text, so any *"ignore lines containing `~~`"* filter reads it as retired. Veritas's own first filter did exactly that and missed it; it found it by reading the block.

**The missing step — cheap, no new mechanism, the same grep once more:**

> **After repairing, re-run the sweep on the REPAIRED file and require ZERO unstruck survivors — matching by SENTENCE, not by line.**

Implemented: every `~~…~~` span is stripped first, so only **unstruck residue** is tested, and each survivor is then resolved to its **enclosing section** to see whether that section itself carries a retirement banner.

**Result on the repaired file: 5 residual matches, ZERO of them directive.**

| Line | Enclosing section | Why it is not a directive |
|---|---|---|
| 20 | `⟦ROTATION BLOCK⟧` (live) | **This is the correct current target itself** — the answer, not a defect |
| 425 · 427 | §12 — `⛔ SUPERSEDED AND HISTORICAL` | narrative *about* a past defect, inside a retired section |
| 1597 | §16.2 Acceptance | **AC-1** — states a property that must hold; names no destination |
| 1786 | §17 (live) | Larry's own correction note, quoting what the heading *used* to say |

**This classification is offered for refutation, not asserted.** Twice now a self-graded "benign" has been wrong.

### ✅ VERITAS PASS @ `c50d8cb` — and the method's honest limit, written beside the result

Veritas ran its **own** independent sentence-level sweep — twelve classes, each survivor resolved to its enclosing heading: **80 matches · 16 in retired sections · 64 residual, all read. Not one points a fresh Larry at closed or superseded work.** All five of my classifications held — *"the first time your self-grading has survived my check."*

On **L1597**, which I asked it to attack hardest: **AC-1 is an acceptance property, not a navigation statement.** It names no section, phase, task or destination, and states something that must **still** hold — Amendment 6 ①.3 restates substantially the same requirement. **A property that must hold cannot misdirect; only an instruction can.**

> ### 🔴 THE LIMIT — stated, not left to be inferred
>
> **"Zero unstruck survivors" is a claim relative to the implemented class list, not an absolute one.**
>
> **Veritas proved it with D-11**: §16.10's *"A second packet is owed after merge… read back before `/clear`"* was a live directive my sweep **could not see**, because my list had no **`owed`** family. It was found by a wider net, not by mine. **`owed` has since been added as a twelfth class and D-11 is retired** — but the lesson is that the next gap will be a family nobody has thought of yet. **Whoever runs this check must state which classes they used.**

**Three further non-blocking findings, all repaired at this head rather than parked:**

- **D-11** §16.10 L1738 — the `owed` directive above. **Retired**; Phase 2 merged at PR #94 and its packet was delivered. Post-merge packet duties for BUILD-020 live in **4B step 18**.
- **D-12** §16's retirement banner sat in a **blockquote beneath** the heading while §15's sat **in** it — so a tool resolving by heading read §16 as **unmarked**, the exact scraper failure §12 documents. **Banner moved into the `# 16.` heading line.** Latent, not active — fixed because latent navigation defects are what this whole exercise is about.
- **D-10** the Grok-era `📌 NEXT WORK PACKAGE (… do not execute in this Grok session)` block — graded *"the weakest remaining point in the map"*. **Replaced by § 📌 SUB-PHASE 4B**, not merely annotated.

**D-13** (§15.3a/b *"RECORDED, NOT STARTED / Do not investigate now"*) is left as Veritas graded it — false but contained, and **a stale prohibition is materially different from a stale instruction: at worst it stops work nobody is asking for.**

Veritas also filed an **erratum against its own `52427cd` receipt** (it wrote "Residual risk — PASS (carried)"; it was HOLD at `2cf3673` and was *repaired*, not carried). Verdict unaffected. A committed receipt is never edited — corrected in the successor.

**Also repaired at Veritas F6:** `📌 ROTATION (this /rotate)` still described the **previous Grok rotation** (`6b48507`, Grok Pax report). `rotate.md` step 11 verifies the Honcho read-back against **that block's** pointer and closing head — so a stale block would have been checked against and **passed**. This rotation's rows now sit above the struck ones.
**And a parked contradiction fixed because it would have shaped 4B:** the Gate 1 dispatch law said **rows 1–4** while its own section heading said **rows 1, 2 and 4**.

---

# PART 2 — Context-sensitive evidence that would otherwise be lost

## 2.1 🔴 Keel's Cockpit preflight — WO-24 was REFUSED, and the preflight is the valuable part

**Keel refused on the ORDER, not the work.** Class A. Every defect was Larry's and preventable.

**Why refused:** no `file_surface` declared · **no `GENERATED by tools/wo/envelope.mjs` marker** (SOP-022 J1-1 — and Larry had *already acknowledged this same failure on WO-23 and repeated it*) · acceptance tests unexecutable · order invited writes under `Team Knowledge/`, which Keel's critical rule 5 forbids.

### Findings that must NOT be re-derived

- **🔴 `/api/health` cannot be tested by running the server.** `server.mjs` imports `db.mjs`, which at **module load** reads live credentials and constructs **two live `pg.Pool`s against production Postgres**. Any test that starts the server touches a live DB — forbidden. **The house pattern is already documented in that same file** (`server.mjs:13`, the `static.mjs` precedent): put the logic in **`services/cockpit/provenance.mjs`**, import one line from `server.mjs`, and prove it via **`services/cockpit/provenance-check.mjs`** in the existing check-script style. Clean / dirty / not-a-repo / git-unavailable all become directly executable with no DB anywhere near them.
- **`pg` is NOT a version upgrade.** Both lockfiles — **including build-020's committed one** — already resolve `node_modules/pg` to **`8.22.0`** with identical integrity, and `^8.11.0` already permits it. The live edit is a **floor-raise to match what is installed and locked**: zero install delta, no lockfile regeneration. It is load-bearing because `services/cockpit/db.mjs` imports pg by **absolute path** from `C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js`. **Disposition: PORT.**
- **`planner.js` and `community-plugins.json` are line-ending noise** — they show ` M` but produce **no diff hunk**. Nothing to port, nothing to disposition. Larry's original triage was wrong on both.
- **`server.mjs:32` is itself a fourth console flash** — `execSync('git rev-parse …')` goes through `cmd.exe` with `windowsHide` defaulted false, **in the very line the provenance fix rewrites**. Fixing provenance fixes a flash in the same change, inside the same surface.
- **The three untracked docs, classified:** two are genuine, well-formed Felix session logs from 2026-08-03/04 (`asdair-details-readable-and-rules-view` 7.3 KB; `cockpit-truthful-health-and-the-basket-surface` 6.6 KB — the **direct ancestor of this health work**, and should be banked). The third is a 17.8 KB `LARRY-FIRST-DRAFT-UNAPPROVED` vlog draft — **Warwick's to approve or bin**. **Keel may not write any of them** (critical rule 5); the writes are Larry's.

### The regenerated WO-24 must carry

`--owner keel` · `--governance-head <frozen 4A head>` · **surfaces:** `services/cockpit/provenance.mjs`, `services/cockpit/provenance-check.mjs`, `services/cockpit/server.mjs`, `services/hub/youtube/persistCapture.mjs`, `services/hub/youtube/watch-captures.mjs`, `services/control-plane/package.json`, `services/control-plane/package-lock.json` · worktree `C:/Fusion247PKA-wo-24` · branch `fix/cockpit-provenance-and-windowshide` cut from the frozen 4A head · acceptance rewritten against `provenance-check.mjs` **not** a live HTTP request · doc instruction reduced to **classify-and-recommend only** · health fields `sha` · `dirty` · `provenance` · **`sourceHash`** (a digest over the loaded `services/cockpit/*.mjs` bytes — structurally unable to repeat the original failure because it never consults git).

### 🔴 THE HARD PROHIBITION — carry verbatim into the regenerated order

**`C:\Fusion247PKA` is a LIVE clone whose uncommitted working-tree bytes ARE the running Cockpit.** Read only. **Never** `git checkout` · `stash` · `clean` · `restore` · `reset` · `add` · `commit` · branch-switch · any write. A `git stash` there would destroy the very work being rescued. Verify `git -C C:/Fusion247PKA status --porcelain` returns the **same 10 entries** before and after. *(Keel verified this held throughout its preflight.)*

## 2.2 Scheduled-task flashing — built, proven, BLOCKED ON PERMISSION

**Root cause:** four **Interactive-logon** scheduled tasks; any console program launched under `LogonType = Interactive` allocates a console in the logged-on session. **Not the Tower watcher** — every tower-loop spawn site already carries `windowsHide: true`, mutation-tested by `WH3`/`WH4`. The `.cmd` wrapper is not the cause either (`MyPKA-Local-Services-Live` runs `node.exe` directly and flashes identically).

| Task | Interval |
|---|---|
| `CareerAIR-Email-Ensure` | **PT5M** ← "every few minutes" |
| `CareerAIR-Graph-Collect` | PT15M |
| `MyPKA-Local-Services-Live` | PT15M |
| `CareerAIR-Ops-Liveness` | PT30M |

**Runner built and self-proved:** `C:\Users\Buggly\.mypka\run-hidden.vbs`. Exit 2 → reported 2; exit 0 → reported 0; logs written; a malformed path made `cmd.exe` fail 1 and the runner **faithfully reported 1**. It propagates real failures.

**Rollback captured BEFORE any attempt:** `C:\Users\Buggly\.mypka\task-rollback-2026-08-06\` — four `Export-ScheduledTask` XMLs. Restore:
```powershell
$n = 'CareerAIR-Email-Ensure'   # or CareerAIR-Graph-Collect / CareerAIR-Ops-Liveness / MyPKA-Local-Services-Live
Register-ScheduledTask -TaskName $n -Xml (Get-Content "C:\Users\Buggly\.mypka\task-rollback-2026-08-06\$n.xml" -Raw) -Force
```

**🔴 BLOCKED: `Set-ScheduledTask` is denied by the Claude Code auto-mode classifier** — for Mack (twice) **and for Larry in the main context** (once). It is the **command**, not the agent; re-dispatching cannot help. Neither worked around the denial. **All four tasks verified UNCHANGED. No partial application.**

**The four commands, ready to run:**
```powershell
$v = 'C:\Users\Buggly\.mypka\run-hidden.vbs'
Set-ScheduledTask -TaskName 'CareerAIR-Email-Ensure'    -Action (New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "//B //Nologo `"$v`" cmd.exe /c `"C:\.fusion247\private\careerair\scripts\ensure-email-only.cmd`"")
Set-ScheduledTask -TaskName 'CareerAIR-Graph-Collect'   -Action (New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "//B //Nologo `"$v`" cmd.exe /c `"C:\.fusion247\private\careerair\scripts\careerair-graph-collect.cmd`"")
Set-ScheduledTask -TaskName 'CareerAIR-Ops-Liveness'    -Action (New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "//B //Nologo `"$v`" cmd.exe /c `"C:\.fusion247\private\careerair\scripts\careerair-ops-liveness.cmd`"")
Set-ScheduledTask -TaskName 'MyPKA-Local-Services-Live' -Action (New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "//B //Nologo `"$v`" `"C:\Program Files\nodejs\node.exe`" scripts\ensure-local-services.mjs" -WorkingDirectory 'C:\.fusion247\private\careerair')
```
**The fourth carries `-WorkingDirectory` because that task has one and the other three do not. Dropping it changes behaviour.**

**🔑 THE NUMBER TO WATCH:** `CareerAIR-Graph-Collect` must still report **`LastTaskResult = 2`** afterwards. **If it turns to `0`, the runner is hiding errors and every task must be rolled back immediately.**

**Proof still owed** — natural fires only, no `Start-ScheduledTask`. Fire seconds: Email-Ensure `:01 :06 :11 :16 :21 :26…` · Local-Services `:02 :17 :32 :47` · Graph-Collect `:05 :20 :35 :50` · Ops-Liveness `:19 :49`.

**UNASSESSED, not softened:** whether any `.cmd` expects a console or waits for input. If one does it will hang **invisibly** rather than visibly — watch for a task stuck at `LastResult: 267009` and roll that task back.

## 2.3 Hooks — descoped; one confirmation still owed

Disabled: project `.claude/settings.json` → `{"hooks": {}}`; cue state directory deleted. **Untouched:** `~/.claude/settings.json` → `SessionStart → reorient.mjs` and `Stop → continuity.mjs stop`.

**⚠️ STILL OWED: prove they no longer load or fire after a genuinely fresh session.** "Written is not loaded" cuts both ways — already-loaded hooks may keep firing until restart. **Report the result either way.**

**Evidence base:** 8 false *"specialist has returned"* at **dispatch** · 3 false *"(type: unknown)"* with nothing running, **cause never established** · ~1 duplicate · vs ~6 true. **No notification was shown to have been caused by a hook.**

## 2.4 CareerAIR alert suppression

Muted **both** halves — the alert **and** the false *"CareerAIR intake RECOVERED"*. Root cause: two schedulers sharing one `active_incident` slot, ~4 messages/hour, half of them false. Proven through the **real scheduled task** firing at 23:20 under live credentials (`last_alert_at` unchanged; `suppressed_alert_count` incremented). Mutation-tested: `receiver_stopped` still alerts; deleting the suppression makes `graph_auth_required` alert again.
**Un-mute:** delete the `graph_auth_required` entry from `suppressed_incidents` in `C:\.fusion247\private\careerair\runtime\ops\state.json`.
**Side effect:** a muted kind cannot announce its own recovery. By design, recorded in the file.

## 2.5 Live Cockpit provenance

Runs on **port 8090** from `C:\Fusion247PKA`, branch `build-015/...`, HEAD `c1ed028`, **183 commits behind main**, 10 dirty entries. **No committed BUILD-015 Cockpit dependency exists** — the branch's `services/cockpit/` is byte-identical to `origin/main`. The 86-line `/private-api` bridge is an **uncommitted** edit and is **already committed on build-020 / PR #97** (differs by 4 comment lines). **Nothing valuable is stranded.** `/api/health` lies because it reports the **commit**, never the loaded bytes.

## 2.6 PR #97 — corrected, and a structural defect

Title corrected from a false *"(Gate 1 PASS)"* to *"(Veritas Gate 1 FAIL @0cf70c9 — NOT merge-ready)"*.
**⚠️ CORRECTED 2026-08-07 (Veritas @ `2cf3673`) — the text below was TRUE WHEN WRITTEN AND FALSE WITHIN MINUTES.** As committed it would have misdirected 4B step 13 and taught distrust of a genuine green. **Verified at the frozen head: all four workflows are `completed success`, and the rollup now carries the real checks — `private-apps`, `db-proofs`, `unit`, `secret-scan`, all SUCCESS. The Actions outage drained. CI IS GREEN at `2cf3673`. Do not go hunting an outage in 4B.** What survives: read CI from **run evidence at the exact frozen head**, never from PR colour. ~~**🔴 Structural:** the PR's `statusCheckRollup` contains **only Vercel previews** — none of `control-plane-tests`, `secret-scan`, `governor-tests`, `cockpit-private-apps`.~~ GitHub therefore reports `MERGEABLE` / `CLEAN` from preview builds while **every deciding gate is invisible to it**. **Do not read PR mergeability as assurance.**

## 2.7 Research — banked, no further rounds authorised

Branch `research/wayfinder-transferability` @ `619c548`: `PAX-02`, `NOLAN-03`, `PAX-03`, `NOLAN-04`, `PAX-04`, `NOLAN-05`, `LARRY-01`, plus the staged git-history input.
**Larry's executed verification (LARRY-01):** a branch with **zero map commits** resolves via repo-wide recency to the **Proofline** map — demonstrated live. Most likely occurrence is **creating a new Wayfinder**, whose branch has no map commits until its map is first committed. **Directly relevant to the Asdair transition.**
**Also established:** PR #94 **is merged** (map:1539 recording it open is **stale**).

---

# PART 3 — Sub-phase 4B: the final BUILD-020 closeout

Warwick's 18 steps, verbatim in intent. **Do not begin Asdair functional work inside 4B.**

1. Prove the descoped reminder hooks no longer load or fire after a genuinely fresh session.
2. Apply the four scheduled-task changes through Warwick's bounded action.
3. Prove natural fires preserve exit codes, logs, failure visibility and rollback.
4. Generate and issue the corrected Cockpit Work Order **through the envelope route**.
5. Rescue and bank the Cockpit changes **without mutating the live dirty clone**.
6. Implement truthful `/api/health` provenance **without importing the DB-opening server module in tests**.
7. Disposition `pg` and the untracked files.
8. Prepare the live Cockpit migration and rollback — **do not restart or move it** before merge authority.
9. Implement the reduced **Veritas Gate 3 enumeration check**.
10. Confirm `focus` is in `/rotate` read-back.
11. Reconcile all active Wayfinder navigation after the final work.
12. Freeze one final exact candidate head.
13. Obtain **complete** CI at that exact head.
14. Fresh Veritas over the complete remaining functional scope.
15. Separate Phase / North-Star closure verdict.
16. Codex **only** when the exact head is eligible.
17. Return the full merge decision pack to Warwick.
18. After authorised merge: verify remote and local merged state · align installed/runtime from canonical merged Git · move the live Cockpit safely · prove truthful provenance · prove no dependency on the feature branch, worktree or old session · clean and reconcile the estate.

## Before Asdair (not in 4B)

BUILD-020 merged, installed, durable, clean · its old map cannot emit a competing next action · Asdair's Wayfinder has a truthful starting point · North Star reaffirmed · stale/superseded/historical Asdair content classified · **a fresh session proves it lands on Asdair correctly** (see LARRY-01 — the repo-wide fallback makes this a real hazard).

## Standing constraints for 4B

Larry owns internal Work Packages and Work Orders; **Warwick calls Sub-phase boundaries**. `ACTIVE SESSION WORK PACKAGE` is retained as the durable map identifier — **no repository-wide rename is authorised.** SHIT TO DO stays non-directive. **No further Pax/Nolan research rounds.** Veritas returns **FAIL**, not HOLD, where an active map statement is demonstrably false or can misdirect a fresh session.
> Veritas verdict and before `/rotate`**, and mirror the one-line summary into the `/rotate` focus.

**Sub-phase 4B is NOT complete merely when the remaining Cockpit, scheduled-task, CI, assurance,
Codex and merge work is finished.** Its final Phase-level acceptance must answer, in Warwick's words:

> «**Is everything delivered across BUILD-020's previous Phases durable, correctly captured and
> independent of the old branch, worktree, installed accident and Larry's context — and is everything
> required to create a completely new Build Wayfinder now understood, durable and reproducible by a
> genuinely fresh Larry?**»

**Both parts must be answered by Larry AND by Veritas at final Phase close.** Neither part alone
closes the Phase.

---

## PART A — Durability

Prove that **every load-bearing BUILD-020 outcome**:

- exists in **canonical Git**;
- is included in the **correct merge unit**;
- is **installed from canonical merged source** where required;
- **survives `/clear`, restart, fresh session and worktree recreation**;
- depends on **no unmerged branch, dirty clone, temporary transcript or previous Larry context**;
- has **truthful evidence and provenance**;
- leaves **no valuable work stranded**.

### Known live threats to Part A — carried forward from 4A, each must be closed or honestly recorded

| Threat | Established | Closes when |
|---|---|---|
| Live Cockpit runs **uncommitted bytes** on a BUILD-015 branch, 183 commits behind main | 2026-08-06 | changes banked, Cockpit moved to canonical merged state, provenance truthful |
| `/api/health` reports the **commit, never the loaded bytes** | `server.mjs:32` | `provenance.mjs` ships with `sha` · `dirty` · `provenance` · `sourceHash` |
| **CareerAIR private surface is not under version control** — today's changes there have no history and no rollback | 2026-08-06 | recorded honestly, or brought under control by Warwick's decision |
| Scheduled-task fix **built but not applied**; runner and rollback live only under `~/.mypka/` | 2026-08-07 | applied and proven through natural fires, or explicitly reclassified |
| **Hooks disabled but not proven non-firing** after a genuinely fresh session | 2026-08-07 | confirmed either way at the next fresh session |
| PR #97 `statusCheckRollup` shows **only Vercel previews** — the deciding gates are invisible to it | 2026-08-07 | CI green demonstrated at the frozen exact head **by run evidence, not by PR colour** |

**The Part A test is adversarial, not declarative.** Pick the things a fresh Larry would actually need
and prove they are in Git — do not assert coverage.

---

## PART B — New-Build Wayfinder reproducibility

Prove that a genuinely fresh Larry, starting **only** with:

- an accepted **PRD or Goal Contract**;
- a **truthful starting position**;
- **scope and non-goals**;
- an accepted **North Star**;

can **reproducibly establish**:

- **one authoritative Wayfinder**;
- **logical, dependency-sensitive Phases**;
- **Phase outcomes and gate questions**;
- the **START / RESUME interface**;
- the **`ACTIVE SESSION WORK PACKAGE` anchor**;
- **`SHIT TO DO`** as durable but **non-directive**;
- **safe rotation and continuation**;
- **Warwick's Sub-phase boundary vocabulary**;
- **Larry's autonomous Work Package and Work Order decomposition**;
- correct **Veritas, Codex and merge boundaries**.

### 🔴 The acceptance bar that decides the shape of the proof

> **The proof must NOT require copying the full Proofline map, and must NOT require Warwick to
> reconstruct the method from chat.**

So the artefact cannot be the 2,400-line map, and it cannot be a transcript. It must be small enough
that a fresh Larry can act on it without inheriting Proofline's bulk — which is the same distinction
the banked research drew between **load-bearing behaviour** and **Proofline-specific history**.

### 🔴 A known trap Part B must clear — already proven, do not rediscover

`LARRY-01-fallback-misfire-EXECUTED.md` (branch `research/wayfinder-transferability`) established
**by execution**: `resolveActiveMapPath()` falls back to **repo-wide recency** whenever a branch has
touched no map, and today that returns the **Proofline** map.

**A brand-new Build's branch has zero map commits until its map is first committed.** In that window a
fresh Larry is confidently oriented to the **wrong build** — and the function satisfies all three of
its own stated safety conditions while doing it.

**Part B is not proven until a new Wayfinder can be created without falling into this.** Whether the
constitution's own read-the-map discipline catches it is **unestablished** and must not be assumed in
either direction.

### Why this ordering, in Warwick's words

> *"Asdair will subsequently test recovery of an existing stale Wayfinder. BUILD-020 must first prove
> that creating a brand-new one is reproducible."*

**Creating** is the simpler case and must be proven first. **Recovering a stale map** — Asdair — is the
harder one, and is explicitly **not** in scope for 4B.

---

## `/rotate` focus line — to carry into the packet

> **BUILD-020 Sub-phase 4B — final closeout. Phase closes only on BOTH: (A) every load-bearing
> BUILD-020 outcome durable in canonical Git, installed from merged source, surviving `/clear`,
> restart and worktree recreation, free of any unmerged-branch / dirty-clone / transcript / old-Larry
> dependency; and (B) a genuinely fresh Larry can reproducibly create a NEW Build Wayfinder from a
> Goal Contract alone — without copying the Proofline map or rebuilding the method from chat. Asdair
> follows and tests stale-map recovery, not this.**
