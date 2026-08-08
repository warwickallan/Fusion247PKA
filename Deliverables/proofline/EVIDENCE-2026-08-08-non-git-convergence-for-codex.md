# NON-GIT CONVERGENCE EVIDENCE — hand-supplied for the BUILD-020 4C merge-class Codex review

**Why this exists:** the staged review packet carries **Git metadata only**. The Codex contract instructs
the reviewer to treat runtime, scheduled-task and off-repo state as **unestablished if absent**. This
document supplies it so the reviewer can challenge the non-Git half of Question 2. **Every figure below
was executed, not recalled.** Where something is not observable, it says so.

**Question 2 asks about the estate AS IT EXISTS NOW** — unresolved reconciliation/convergence debt from
**previous completed work**, and current pre-merge defects. It does **not** ask for the post-merge estate.

---

## 1. Scheduled tasks — 10 of 10, every target root named

| Task | State | Target root |
|---|---|---|
| `CareerAIR-Email-0800` / `-1200` / `-1700` | Ready | `C:\.fusion247\private\careerair\` — **approved private runtime** |
| `CareerAIR-Email-Ensure` | Ready | `C:\.fusion247\private\careerair\` |
| `CareerAIR-Graph-Collect` | Ready | `C:\.fusion247\private\careerair\` |
| `CareerAIR-Ops-Liveness` | **Disabled** | `C:\.fusion247\private\careerair\` — deliberately disabled; it alerted every 30 min about a descoped Zapier path |
| `MyPKA-AsdAIr-Runtime` | Ready | `C:\Fusion247PKA\services\asdair\pipeline-runtime` — **canonical** |
| `MyPKA-Directus-Live` | Ready | `C:\Fusion247PKA\services\control-plane\wp-d-proof` — **canonical** |
| `MyPKA-Local-Services-Live` | Ready | `C:\.fusion247\private\careerair` |
| `MyPKA-YouTube-Watcher-Ensure` | **Disabled** | `C:\Fusion247PKA` — canonical root; **disabled and blocked on ELEVATION** |

**Zero tasks target a branch, a worktree, or any superseded checkout.** Two are deliberately disabled and
both are recorded as carried items, not silently ignored.

## 2. Live processes — the corrected check

`tools/governor/convergence-runtime-check.ps1`, executed. **This check was widened during 4C after Veritas
proved the previous one narrower than its claim** (it enumerated `node.exe` only and read command lines
only, and so missed a stranded Proofline harness alive in the candidate worktree since 2026-08-04; that
tree was killed).

> **PASS: zero LIVE DEPENDENCIES on superseded checkout roots across executable path, command line and
> loaded-module paths.** One **dead** `--add-dir C:\Fusion247PKA-external-repair` reference was observed on
> an old Claude session; **that path no longer exists and cannot supply bytes.**

474 processes examined; 13 canonical references; 2 active-candidate references (the candidate worktree,
legitimate pre-merge state); **0 superseded-root references.**

> **KNOWN EVIDENCE LIMIT, disclosed rather than closed:** `Win32_Process` does not expose process working
> directory, **so a dependency existing solely through a process cwd is not directly observed by this
> probe.** Warwick's explicit instruction was not to expand 4C to eliminate this theoretical gap.
> **The reviewer should judge the evidence as a whole, knowing this.**

A second bound: the check matches an **enumerated** set of superseded roots (`c:\fusion247pka*`,
`c:\fable-external-repair`, `c:\audit-worktrees`, `.claude\worktrees\<agent>`). A superseded root outside
that pattern would not be seen. The claim in the script is bounded to the enumerated set.

## 3. Canonical private / non-Git stores

| Store | Status |
|---|---|
| `C:\.fusion247\private\**` | **The approved canonical private home.** GL-012 governs it; deny-by-default with one exact declared subtree per project. Untouched by 4C. |
| `~/.mypka/tower/tower.db` | Canonical Tower SQLite store. **SQLite is the current canonical architecture.** |
| `~/.mypka/governor/` | Installed governor runtime, incl. `ding.mjs`. |
| `~/.mypka/unpublished-drafts/` | **One unapproved VlogOps draft**, deliberately retained: not published (public repo, unreviewed draft from a pipeline whose only prior run scored 2/10 on privacy comprehension) and not deleted. Carries its own provenance README. |
| `PKM/Journal/**` | **Gitignored by doctrine.** Holds Warwick's 2026-07-21 position plus a preserved patch of two tracked-file pointers he ruled **local-only**. Deliberately NOT on the public repo. |

## 4. Preserved / decommissioned alternatives — and their explicit disposition

| Item | Disposition |
|---|---|
| `Builds/DECOMMISSIONED/postgres-head-authority-structural/` | **Reference-only design capital.** Warwick explicitly refused DISCARD. Outside every live discovery path — migration discovery is `readdirSync` on one specific directory and `Builds/` is referenced only in source comments. **Not renumbered, not applied to any database, no caller anywhere** (verified by repo-wide grep). Status on both the README and a header inside the SQL. **Reactivation requires a new explicit Warwick architecture decision.** |
| `~/.mypka/tower-backups/2026-08-07-pre-postmerge-realign/` (76 files) | **A live-runtime rollback, deliberately retained until the newly merged runtime proves healthy**, then cleared. Purpose, bounded lifetime and post-merge disposition are explicit. **Per the contract this is legitimate pre-merge state, not convergence debt** — the reviewer may challenge whether that claim is credible and evidenced. |
| `refs/recovery/4c/**` + `refs/recovery/4c-unreachable/**` (119 refs) | **Recovery pins**, created after an external review found Larry's first uniqueness measure invalid. `gc.auto=0`, `pruneExpire=never`, reflog expiry `never`. **All 119 accounted for**; they are preservation apparatus with a stated post-close disposition, **not working branches**. |

## 5. What 4C reconciled, and the KNOWN CARRIED / DEFERRED ITEMS

### 5a. Reconciled during 4C

The BUILD-015/IDEA-012 worktree family · the premigration and unique-artefacts clones · three empty C-root
leftovers · an orphaned repo copy invisible to `git worktree list` · 3 stashes · an asdair CI fix that
existed only as uncommitted work · a Warwick ruling that existed only in a stash.

### 5b. KNOWN CARRIED / DEFERRED ITEMS

> **⛔ THESE ARE STATED NEUTRALLY AND DELIBERATELY NOT PRE-CLASSIFIED.**
> **The reviewer decides independently** whether each is (a) unresolved convergence debt from previous
> completed work, (b) a current pre-merge defect, (c) a material technical blocker, or (d) a known
> routed/deferred item that does not block this merge. **Larry's or Warwick's routing of an item is
> recorded below as a FACT about what was decided — it is not an argument that the item is harmless, and
> the reviewer is not bound by it.**

| Item | Established facts | Existing disposition (a fact, not a verdict) |
|---|---|---|
| **F-001** | `services/control-plane/tower-loop/notify.mjs` claims its `(turn_id, reason)` dedup row at lines 86–98 but does not POST until line 121. A crash in that gap leaves `telegram_ok=0` and the next pass returns *"deduped — Telegram not re-sent"*. **No resend path exists anywhere in the subsystem** — established by reading the code. Pre-existing on `main`; the 4C diff does not touch that file. | Warwick ruled on 2026-08-07 that it is recorded and routed to subsequent work rather than expanding 4C. **Not fixed.** |
| **The unwired durable outbox** | `services/control-plane/notifier/notifier.mjs` — a complete watchdog-backed sender with bounded retry and dead-lettering — is **imported by nothing except its own test**. On `main` and byte-identical on 35 of the 40 recovery refs. The estate holds **three** notification-outbox designs; the path that actually sends Warwick's Telegram is the only one without retry. | Warwick asked that it be protected from accidental discard. **Confirmed safe. Not wired, and no production caller created.** |
| **`MyPKA-YouTube-Watcher-Ensure`** | Scheduled task exists and is **Disabled**. Blocked on elevation. Its ensure semantics were proven (two ticks, ProcessId unchanged, kill-loop gone) — that is capability, not automation. | Carried from 4B. **Amendment 9 remains AUTOMATIC as a product requirement and is NOT accepted.** |
| **R1 — non-mutating GET** | The assumption that the relevant GET is non-mutating is **unverified**, blocked by the GL-012 private-surface boundary. No side effect was observed; that is not proof none exists. | Carried from 4B. **Unverified.** |
| **4B assurance** | Sub-phase 4B merged with **no Gate 1 PASS, no Gate 2 PASS, no Codex review and no TowerBot production acceptance.** | Merged under Warwick's **explicit exception**, which is not evidence the skipped assurance passed. **Owed unless he disposes it.** |
| **Pre-redaction privacy residual** | Old branches carried a pre-redaction task file naming a private capability; those refs are deleted. **The same content remains reachable from `main`'s own history** — `7d16e66` is an ancestor of `main`, established by execution. No credentials, no secrets, no third-party personal data. | Classified by Warwick as obsolete/private-by-policy. **No history rewrite performed, and none proposed** — he forbade launching one without explicit authority. |

## 6. What is NOT claimed

- **The estate is not claimed post-merge CONVERGED.** That cannot be true before the merge.
- Row 6 of the 4C Work Package is explicitly `IN PROGRESS — not yet claimed`; check 14 requires the
  contracts **on `main`**, which only the merge achieves.
- Veritas returned **PASS on a bounded scope** — current 4C record truth and executed capability. It
  explicitly does **not** cover estate convergence, which is this review's question, nor its own contract.
