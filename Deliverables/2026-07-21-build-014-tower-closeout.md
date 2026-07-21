# BUILD-014 Tower — Closeout & Branch Triage

_2026-07-21, ~02:20. The list that lets Tower finally close, so we move to the fun stuff. No Fable used anywhere._

## Where Tower actually is
The **entire Tower core, campaign (wp-1…wp-3b) AND foundation (wp-a…wp-d0) are already merged into `main`** (`84138e2`). The persistent supervisor/watcher loop runs, captures real Larry↔Warwick turns to the isolated DEV control-plane, has Codex review them, and auto-notifies via @Fusion247towerbot. Tower is functionally complete on main. What was left was the **notification layer** and **branch hygiene**.

## The one remaining feature — PR #53 (ready for your yes)
**`build-014/tower-larry-voice` @ `6c71f78` → PR #53.** Shows **Larry's side** of the Codex dialogue on TowerBot (your repeated ask). 
- Additive + **byte-identical back-compat** when there's no `larry_response`.
- **Independently Codex-reviewed** (no Fable): first pass caught a real regression (F-001: I'd relabelled the verdict line, breaking my own byte-identical claim) + F-002 (stray code-fence). **Both fixed**, with a byte-identical regression test; re-review on the fixed head [confirming as of this writing].
- `notify.test.mjs` 6/6 local; wired as CI step `test:tower-loop-unit`. CI on the fixed head completing.
- **Watcher restarted on this build (PID 29868)** — the next real turn it supervises will show 🗣 Larry: on TowerBot (your live proof).
- **Action: merge on your explicit yes** (exact head `6c71f78`).

## Triage — merge / close / delete
| Item | Recommendation |
|---|---|
| **PR #53** tower-larry-voice | **MERGE** on your yes (exact head `6c71f78`) |
| **PR #43** wp-d-cockpit-proof (disposable Directus proof) | **CLOSE** — superseded by tonight's AsdAIr finding: *no Directus; use a Cockpit tab*. It was explicitly disposable. |
| Merged branches: core-integration, tower-supervisor-loop, wp-1/2a/2b/3a/3b, wp-a/b/c/d0, build-010/* | **DELETE** (all merged into main — cleanup) |
| Old unmerged build-010/*: tower-reliability-hotfix, wp1-reliable-autonomous-governance-loop | **CLOSE/DELETE** — stale, superseded by BUILD-014 |

## Explicitly DEFERRED (parked, NOT blocking closeout)
Grok-vs-Fable reviewer comparison · role-based-readiness activation · autonomous merge · the 3 Codex `REQUIRED_BEFORE_LIVE` findings (CI+Warwick as mandatory packet evidence; a distinct approved adversarial prompt; calibrated security-assurance routing) · §6G ordinary-turn rendering polish (partly addressed) · watcher-as-a-Windows-service (needs your explicit authorisation — not built).

## Operating method (unchanged, honest)
Watcher = detached hidden process + a **SessionStart hook** (`ensure-watcher.mjs`) that brings it online each new session. Survives terminal/session close; **not** a reboot (auto-starts next session). No Windows service without your say-so.

## Bottom line
**Merge #53 + close #43 + delete the merged branches = Tower is closed.** The deferred list is genuine future scope, not unfinished business. Then: on to AsdAIr multi-device + the fun stuff. 🎉
