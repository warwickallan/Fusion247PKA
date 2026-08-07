# Cockpit live migration and rollback plan — BUILD-020 Sub-phase 4B, step 8

> **Status: PLAN ONLY. Nothing here has been executed.** Written 2026-08-07 by Larry. It is the
> prepared route for 4B step 18 (*"after authorised merge: … align installed/runtime from canonical
> merged Git · move the live Cockpit safely"*). **No step below may run before Warwick's
> `merge-decision`.**

## 1. Why this exists

**The work does not reach Warwick until this runs.** Everything built in Sub-phase 4B — truthful
`/api/health` provenance, `/api/rotation-reports`, the Session / Rotation Reports System tab, the
durable YouTube capture mechanism — is on `build-020/phase4-automation-law`. **The Cockpit Warwick
actually opens serves from a different checkout**, and it serves `public/**` straight from its own
working tree with no build step, so nothing propagates by itself.

## 2. Live state, captured by execution 2026-08-07

| | |
|---|---|
| Path | `C:\Fusion247PKA` |
| Branch | `build-015/live-acceptance-recovery-2026-08-03` |
| HEAD | `c1ed02889405c5850d43d02eecb8f38e032bee57` |
| Behind `origin/main` | **183 commits** |
| Working tree | **12 entries** — 7 modified, 5 untracked |
| Port | 8090, served from this tree |

**🔴 The uncommitted working-tree bytes ARE the running Cockpit.** That is the whole hazard. Read
only. **Never** `checkout` · `stash` · `clean` · `restore` · `reset` · branch-switch **before the
preconditions below are satisfied** — a `git stash` here would destroy the running service.

### The 12 entries, dispositioned

| Entry | Disposition |
|---|---|
| `services/cockpit/server.mjs` | ⛔ **BLOB CONTAINMENT CLAIM NO LONGER HOLDS — RE-CUT 2026-08-07 (Veritas D-2).** ~~The governance head already contains its 86-line private-API bridge in a *superset* form (blob `95bb814c` ⊃ `16a6a851`, +90 lines).~~ **WO-31 EXTRACTED the bridge out of `server.mjs` into `services/cockpit/private-api.mjs`**, so the branch no longer contains the live clone's handler as a textual superset — it contains a **repaired replacement in a different file**. **The disposition is UNCHANGED and stronger: still Superseded, still do not port.** The live clone's copy carries the **defective** origin behaviour that WO-31 exists to remove; porting it would reintroduce the exposure. *(The old wording would have had someone verify containment, find it false, and hesitate at exactly the wrong moment.)* |
| `services/control-plane/package.json` · `package-lock.json` | **Ported and merged** (WO-24, byte-identical). |
| `services/hub/youtube/persistCapture.mjs` · `watch-captures.mjs` | **Ported and merged** (WO-24), then substantially rewritten by WO-27. **The merged version wins.** |
| `services/asdair/skill/planner.js` · `Team Knowledge/.obsidian/community-plugins.json` | **Line-ending noise.** ` M` with no diff hunk. Nothing to port. |
| `…session-logs/…felix_asdair-details-readable-and-rules-view.md` · `…felix_cockpit-truthful-health-and-the-basket-surface.md` | **Banked** at `b0c3b2b`, byte-identical. Will resolve to clean. |
| `Team Knowledge/Sources/sxg08hppkr8-….md` + `Sources/_raw/SXg08HPpKr8/` | **⚠️ NOT banked.** Real product output stranded by an `index.lock` race. **Must be preserved through the move** — see §4. |
| `Deliverables/2026-08-03-vlog-…-LARRY-FIRST-DRAFT-UNAPPROVED.md` | **Warwick's decision.** Not banked, not deleted, not edited. **Must survive the move regardless.** |

## 3. Preconditions — ALL must hold before any command in §4

1. **Warwick's explicit `merge-decision` has been given and the merge is complete.** This plan
   consumes a merged `main`; it does not anticipate one.
2. **Veritas Gate 1 PASS** at the frozen head, and the **Gate 2** phase verdict recorded.
3. **The bounded Vex review** (Amendment 8, route step 15a) has returned, and any `BLOCKS_CURRENT_MERGE`
   finding is resolved — this move puts the `/private-api` proxy in front of Warwick's browser.
4. **CI complete and green at the exact frozen head** — under estate doctrine an `in_progress`
   workflow is **NOT RUN**, never PASS.
5. **🔴 NO SCHEDULED TASK MAY BE ENABLED AGAINST THIS CLONE UNTIL IT CARRIES THE CODE THAT TASK
   ASSUMES.** See §6 — this is not theoretical, it happened.

## 4. The move — ordered, and each step reversible before the next

> **Nothing here is a `git` operation on the live clone until step 4.4.** The first three steps
> exist so that 4.4 cannot lose anything.

1. **Stop the Cockpit service and the YouTube watcher.** Record both PIDs first. A running process
   holding files is how a half-moved tree happens.
2. **Copy the whole clone to a dated sibling** — `C:\Fusion247PKA-premigration-YYYYMMDD`. **A full
   filesystem copy, not a git operation**, so it captures untracked and ignored files including
   runtime state and `node_modules`. **This is the rollback**, and it is why §5 is short.
3. **Preserve the two genuinely-unique untracked artefacts** — the `SXg08HPpKr8` note and its
   `_raw/` directory, and the unapproved vlog draft — to a location outside the clone. They exist
   nowhere else.
4. **Move the tree to canonical merged state.** `fetch`, then check out merged `main` at its exact
   SHA. **Record the before and after SHA.**
5. **Restore the preserved artefacts** into the moved tree. The two session logs need no restore —
   they are tracked at `b0c3b2b` and arrive with the merge.
6. **Reinstall dependencies if the lockfile moved. STILL MANDATORY.** `services/control-plane` holds the `pg` install
   that `services/cockpit/db.mjs` imports — **now clone-relative rather than by absolute path (WO-30), which
   changes nothing about this step**: an emptied `node_modules` still breaks the Cockpit, and after the repair
   it breaks **loudly at import** instead of silently borrowing another clone's tree. See §6(a).
7. **Start the Cockpit. Verify §7 before enabling anything scheduled.**
8. ⊕ **ADDED 2026-08-07 (Veritas D-2) — WO-31 consequences. These are BINDING post-merge acceptance items, not notes.**
   1. **🔴 CONFIRM THE CAREERAIR OVERLAY STILL REACHES `/private-api`.** WO-31 refuses a request whose `Origin` does not match the Cockpit's own `Host`. **There is NO caller of `/private-api` anywhere in the repository** — the overlay is served from outside it — so **this could not be proven pre-merge, and Keel correctly refused to claim it.** **This is the first thing to check after the Cockpit restarts.**
   2. **🔴 ESTABLISH WHETHER `tailscale serve` PRESERVES `Host`.** `--https=8443 → http://127.0.0.1:8090` fronts the Cockpit. **If the terminator rewrites `Host`, strict equality will 403 the legitimate overlay** — the exact breakage Warwick ruled against. **Unresolved pre-merge by construction; it needs the live path.**
   3. **`COCKPIT_ALLOWED_ORIGINS` is the escape hatch for 8.2** — optional, additive, **empty by default**, so the safe behaviour is the default. **Its value is set by nobody yet; setting it is Mack's, on evidence from 8.2, and it must not be set speculatively.**
   4. **R1 (Warwick, accepted):** cross-site **no-`Origin` GET remains permitted**, and **the security GREEN ASSUMES GET on the private upstream is NON-MUTATING.** **Verify that assumption against the real CareerAIR/live journey here. If a side-effecting GET exists, close it at this step** — that is where Warwick placed it.
   5. **Re-run `origin-boundary-check.mjs` against the moved tree** — it needs no database and no credentials, so it costs nothing to prove the boundary survived the move.

## 5. Rollback

**Stop the service, delete the moved tree, rename `C:\Fusion247PKA-premigration-YYYYMMDD` back, restart.**
That is the whole procedure, and it is why step 4.2 is a filesystem copy rather than a git stash —
**a git-based rollback cannot restore untracked runtime state, and this clone's untracked state is
load-bearing.**

## 6. 🔴 Known hazards, each proven rather than anticipated

**(a) ✅ REPAIRED 2026-08-07 (WO-30) — re-cut, because this section described the OLD behaviour as a live hazard.**

~~`db.mjs` imports `pg` by ABSOLUTE PATH into this clone. `services/cockpit/db.mjs:7` reads
`file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js`, and `:10` defaults
the credentials path into the same tree. **The Cockpit cannot run from any other checkout**.~~

**What was actually wrong, and it was worse than "cannot run elsewhere":** a Cockpit started from **any other checkout silently borrowed this clone's dependency tree AND its LIVE PRODUCTION CREDENTIALS**, because the absolute `COCKPIT_CREDS` default pointed every checkout at `C:/Fusion247PKA/.../.runtime-live/directus-live.env.json`. **It did not fail — it connected, with credentials it had never declared.** Row 1's *"survives worktree delete/recreate"* was passing only because a stray checkout quietly reached into the live clone.

**Now:** both the `pg` specifier and the credentials default resolve **relative to the module's own location** (`createRequire(import.meta.url)` and `new URL(..., import.meta.url)`). A checkout without its own dependencies **fails loudly at import**. **The loud failure is the repair, not a regression.**

**⚠️ Unchanged for THIS migration, and the reason step 4.6 still stands:** from `C:\Fusion247PKA` the new clone-relative forms resolve to **character-for-character the same two paths** as the old absolute ones, and `COCKPIT_CREDS` is set **nowhere in the repository**, so the live service runs on the default and its value is unchanged there. **A move that empties `node_modules` still breaks it — reinstall at step 4.6 remains mandatory.** Gated by `services/cockpit/clone-portability-check.mjs`, registered in CI. `BACKLOG` C-6 (*worktree isolation does not isolate the database*) is **narrowed, not closed** — the credentials-borrowing half is fixed; the module still opens two production pools at import, which is why nothing may import it to test it.

**(b) A task enabled against a stale clone runs stale code — this HAPPENED, 2026-08-07.** The
`MyPKA-YouTube-Watcher-Ensure` task was installed pointing at this clone while the fix that gives
`ensure-youtube-watcher.mjs` true ensure semantics sat unmerged on `build-020`. The clone's copy is
still the **old 23-line unconditional-kill** version, so the task **killed and restarted the watcher
every 5 minutes** — proven empirically by the PID moving `33024 → 28240` inside one cycle, with no
state file written. **A TubeAIR extraction is capped at 180s and a note generation can exceed that,
so a long transcript could be killed mid-flight on every cycle and never complete.** The task is
now **`Disabled`, deliberately not unregistered**, and the running watcher (PID 28240) was left
alive. **Re-enabling is a post-migration step and belongs in §7, not before.**
*Larry's error: an elevation step was sequenced ahead of the migration that makes it safe. The Work
Order reasoned about the code; the task points at a checkout. Recorded so the ordering is a
precondition rather than a memory.*

**(c) The running service serves `public/**` from the working tree.** No build step means the UI
changes the instant the tree moves — including mid-request. Step 4.1 stops it first for that reason.

**(d) `core.autocrlf` with no root `.gitattributes`** (BACKLOG C-2). Expect `sourceHash` to differ
across checkouts of identical tracked content — **that is C-2b and is not evidence of drift.**

## 7. Verification after the move — before anything scheduled is re-enabled

1. `GET /api/health` returns `sha`, `dirty`, `provenance`, `sourceHash`, and `sha` matches the
   merged head. **`provenance` must not read `git-unavailable`.**
2. `GET /api/rotation-reports` returns `ok: true` with the rotation set, most recent first.
3. **The System tab renders Session / Rotation Reports on Warwick's actual device** — the acceptance
   that motivated the whole surface, and the first time it is testable.
4. Core nav is not regressed; Apps → CareerAIR still opens.
5. The `SXg08HPpKr8` note and the vlog draft are present.
6. **Only then**: `Enable-ScheduledTask -TaskName 'MyPKA-YouTube-Watcher-Ensure'`, and confirm the
   watcher **ProcessId is UNCHANGED across two consecutive 5-minute ticks** and that
   `~/.mypka/youtube-watcher-state.json` now exists with `recovery_attempts: 0`. **A changing PID
   means ensure semantics are not holding — disable again immediately.**
7. **`CareerAIR-Graph-Collect` must still report `LastTaskResult = 2`.** If it turns `0`, the hidden
   runner is swallowing errors and all four task changes roll back.

## 8. Explicitly NOT in this plan

Replacement-machine disaster recovery · migrating the live clone's git history · resolving BACKLOG
C-2's `.gitattributes` decision · the `HUB_YOUTUBE_ROUTE=1` spine route (which requires the watcher
**stopped**, and is therefore incompatible with the task being enabled at all — `liveDeps.mjs:10`).
