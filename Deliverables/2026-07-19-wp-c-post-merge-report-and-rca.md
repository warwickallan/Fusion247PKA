# WP-C Post-Merge Report + RCA — BUILD-014 "Tower on Supabase + git"

**Merged:** PR #40, merge commit `669b986`, guarded at exact head `a6b64dd`. CI green on real Postgres (`db-proofs` 46s) + `secret-scan` clean. DEV-only; no live apply.

## What landed
GitHub webhook **ingress** + Fusion **policy gate** + ported Codex/Fable **review adapters**, all on the WP-B Postgres baton. The multi-model review loop now runs off the control plane instead of a ClickUp thread. ClickUp transport not ported (as designed).

## Round economy — the headline
| WP | Rounds | Why |
|---|---|---|
| WP-A | 5 | core correct round 1; perimeter whack-a-mole (deny-list, test-not-running) |
| WP-B | 4 | exhaustive discovery, but round-2 *fixes* landed incomplete |
| **WP-C** | **1** | **RCA lessons baked into round 1** |

**WP-C converged in a single round.** The lessons banked from WP-A/WP-B — first-party threat model up front, robust-pattern-all-sites, default-deny, proven=executed-in-CI, per-finding severity+disposition — were written into the round-1 reviewer prompt. Result: no discovery-churn, no fix-incompleteness round. The build was *already* shaped by the checklist, so the reviewers found only perimeter items.

## The one split, and what it taught us
Codex rated the `policyGate` head-staleness **CRIT/REQUEST_CHANGES**; Fable rated it **LOW/APPROVE**. They agreed on the *facts* and split only on how severity maps to a merge verdict. Adjudicated on the code → LATENT / REQUIRED_BEFORE_LIVE (head-labelled gate, no runtime caller, live-apply deferred) → merged with a tracked precondition.

**This split is the direct cause of the reviewer three-axis classification amendment** (`2026-07-19-reviewer-classification-amendment-v1-DRAFT.md`). The process surfaced its own next improvement — a good sign the loop is self-correcting.

## RCA recommendations (added to the process)
1. **Keep baking prior-WP lessons into the round-1 prompt.** This is the single biggest round-count lever proven across A→B→C (5→4→1).
2. **Adopt the three-axis classifier** (pending Warwick approval) so severity stops driving merge verdicts and reviewer splits collapse onto shared, auditable judgements.
3. **Run `evaluatePolicyGate` cwd correctly for the read-only Codex pass.** Codex's file-probes were sandbox-blocked because it ran from the scratchpad cwd, not the repo — it reviewed from the staged diff only. Next time, stage the diff *and* give the read-only reviewer the repo root so it can cross-read the DB schema. (Fable, run as a repo-rooted agent, had full visibility and executed the suite — the stronger signal here.)
4. **Reachability is the load-bearing axis and the easiest to get wrong** — Codex mis-rated a LATENT path as ACTIVE. R2 of the amendment (state the deployment baseline) is the mitigation; the control plane can eventually *supply* that baseline as ground truth.

## Tracked follow-ups (before-live)
- **Authoritative current-head hardening** — REQUIRED before the WP-D gate consumer / any live-apply. Coupled to WP-D; build it there.
- Perimeter fold-before-live (both reviewers): delivery-dedup→payload_hash; namespaced ingress delivery keys; in-process envelope-signature verify when real adapters wired; strict signature-hex length check.

## Next
WP-D — the disposable Directus cockpit proof — **desktop-first** (S21 constraint lifted), folding in the current-head hardening as its gate-consumer foundation.
