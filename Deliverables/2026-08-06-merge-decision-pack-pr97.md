# PR #97 — merge decision pack for Warwick

**Date:** 2026-08-06 · **Branch:** `build-020/phase4-automation-law` · **Head:** `6a804e4`
**Gate 1 head reviewed:** `0cf70c9` · **Receipt:** `Deliverables/2026-08-06-veritas-gate1-amended-wp-0cf70c9-receipt.md`

## Larry's recommendation in one line

**Do not merge tonight.** Not because the code is bad — rows 1, 2 and 4 are close — but because
**row 3 needs a decision only you can make**, and merging first would ship a Work Package whose
headline promise (automatic CareerAIR Outlook intake) is not delivered.

## Status — the maximum permitted statement

> Integrated at **`6a804e4`** and submitted to Veritas for assurance. **Veritas Gate 1 returned FAIL
> at `0cf70c9`.** Nothing in this package is complete, operational, durable, ready, accepted or closed.

| Gate | Verdict |
|---|---|
| Veritas Gate 1 (functional rows 1–4) | **FAIL** — row 1 HOLD · row 2 HOLD · **row 3 FAIL** · row 4 HOLD |
| Veritas Gate 2 (phase journey) | **HOLD** @ `f0d2614` — not re-run at this head |
| CI | **NOT RUN** — 0 runs at `0cf70c9`; GitHub Actions major outage |
| Codex | **PROHIBITED** — requires Gate 1 PASS |

Scope was **not** narrowed. Veritas graded the complete amended package.

## ⚖️ THE ONE DECISION — row 3, and it is a `product-decision`

Row 3 is **FAIL rather than HOLD** because the **capability** is missing, not the evidence. The intake
half is genuinely proven on real mail; what does not exist is an **automatic trigger**, and the
authorised route cannot supply one — `config/outlook-scout.json` `_ARCHITECTURAL_BLOCKER` records
that a headless `claude -p` gets **NO-MCP-TOOLS**. **Re-running the same route at a new head returns
FAIL again.** No amount of implementation by me changes this.

| | Option | What changes | Cost |
|---|---|---|---|
| **A** ⭐ | **Reclassify row 3 as MANUAL for this package** | Root `CLAUDE.md` § *"Nothing may live only in Larry's head"* explicitly permits *"or the outcome is explicitly reclassified as manual"*. The proven intake path stands; the trigger becomes separate future work. Unblocks an honest merge. | You keep triggering collection manually until A→B or A→C. **No money, reverses no prior decision.** |
| **B** | **Authorise Microsoft Graph consent** (one-time OAuth) so a local scheduled task can poll | Real automation, and row 3 could genuinely PASS later. **Reverses your ruling that Graph is not the authorised path.** | One consent step by you; a stored credential to look after; new work to build and prove. |
| **C** | **Fund a paid automatic trigger** (e.g. Zapier paid tier) | Real automation without Graph. | Money, and it reintroduces the paid dependency you deliberately cancelled. |

**I recommend A.** It is the only option that is honest, costs nothing, and reverses no decision you
already made deliberately. **A is not softening row 3** — row 3 as written still cannot PASS, and I
have not claimed otherwise anywhere. A changes what the package *promises*, which is yours to decide.

**This is not a decision I may take.** Larry does not grade his own work and may not reclassify a
requirement to make a package passable.

## What is actually left after your decision — none of it is a re-plan

Veritas's own words: *"Rows 1, 2 and 4 are close."*

| Finding | Work | Status |
|---|---|---|
| **D-2** row 2 residuals V9-3/V9-4 undispositioned, and labels unauditable by name | Two table rows | ✅ **DONE** at `6a804e4` — all four now dispositioned by the source receipt's own V9-x labels |
| **D-4** Cockpit "exact failure" misdirected the operator to Graph | One message correction | ✅ **DONE** and verified live at `6a804e4` |
| **D-3** live Cockpit runs bytes matching no committed head; dirty clone on a BUILD-015 branch; `/api/health` reports a false SHA | Commit-and-align | ⚠️ **NOT ACTIONED — your call.** See below |
| **D-5** row 4 executable browser journey | One browser run | Outstanding |
| **D-6** hook survives restart / rotation | Report honestly after your next `/clear` | Outstanding — **only you can restart the host** |
| **CI green** | — | **Blocked** by the Actions outage |

### Why I did not fix D-3 myself

The live Cockpit clone is `C:\Fusion247PKA`, sitting **dirty** on
`build-015/live-acceptance-recovery-2026-08-03`. Aligning it means committing to **another build's
branch** and changing the bytes of **your live working environment**. The functional diff is
comment-only (4 lines), so nothing is behaving wrongly — but a `git clean` in that clone would
destroy the production surface, and `/api/health` currently reports a SHA that is **false about the
bytes it is executing**.

That is a cross-build live action, so it is yours to authorise, not mine to take unannounced.
**It does affect row 4:** the live evidence is not evidence about `reviewed_sha`.

## Merge readiness — plainly

**Not merge-ready.** Blocking: Gate 1 FAIL · Codex prohibited · CI not run · Gate 2 not re-verdicted
at this head.

**If you choose A**, the realistic path is: reclassify → close D-5 → re-run Gate 1 → CI when Actions
recovers → Codex → Gate 2 → your merge decision. **Gate 2 may still legitimately return HOLD**, and
per your own instruction I will not manufacture a Phase PASS to merge.

**No merge will happen without your explicit final authority.**
