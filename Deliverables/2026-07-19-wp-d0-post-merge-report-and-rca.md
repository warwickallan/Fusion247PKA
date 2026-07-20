# WP-D0 Post-Merge Report + RCA — Authoritative current-head hardening

**Merged:** PR #41, merge commit `6eeca43`, guarded at exact head `4ec9777`. CI green (`db-proofs` 45s, `secret-scan`). DEV-only; no live apply.

## What landed
`ops.build_head` (authoritative current head per build, build_id PK), advanced transactionally at ingress with stale-gate supersession, and `evaluatePolicyGate` refusing any non-current head fail-closed. Closes both WP-C head-binding gaps (stale-window + revive-old-head) for every runtime path. 71/71 real Postgres (+9 WP-D0 proofs incl. the 4 the WP-C e2e hid).

## Round economy
**1 round** (like WP-C). The RCA-lesson-baked prompt held: reviewers found only fold-before-live residuals against a correct, execution-proven core.

## The recurring pattern — two splits, same shape
| WP | Codex | Fable | Adjudication |
|---|---|---|---|
| WP-C | REQUEST_CHANGES (CRIT) | APPROVE (executed) | Fable — LATENT/before-live |
| WP-D0 | REQUEST_CHANGES (2 MAJOR) | APPROVE (executed + probes) | Fable — wrinkle + LATENT |

**Both splits were Codex-over-rates-severity vs Fable-calibrated-by-execution, and both resolved by adjudicating on the code + Fable's execution.** This is now a *repeated* pattern across two consecutive WPs. It is the exact failure mode the reviewer three-axis classification amendment removes (severity stops driving the verdict; disposition does). **Recommendation: approve + wire the amendment** — it would have made both these merges mechanical instead of hand-adjudicated.

## RCA recommendations (added to process)
1. **For executed proof, rely on Fable (repo-rooted agent, can provision disposable Postgres) + CI — not Codex.** The WP-C RCA fix (run Codex repo-rooted) let Codex *read* the schema this round (better findings) but its read-only sandbox still blocks process/DB creation, so it cannot execute the suite. Codex's role is completeness-hunting on the code; its severity ratings need Larry's adjudication (it over-rated both MAJORs here).
2. **Fable's adversarial probe scripts (P1–P4) are high value** — it didn't just read, it *demonstrated* the boundary-vs-DB-structural gap with raw-SQL bypass probes. Keep asking Fable to probe, not just trace.
3. **Codex remains worth running** — it independently surfaced the same-SHA and created_at concerns; even over-rated, they became real (if lower-severity) tracked items. Two models, complementary.

## Tracked follow-ups (before-live hardening WP)
- DB-structural revive-bind trigger (`merge_gate` → `build_head`)
- Default-deny `build_head` monotonicity (strict-newer in table guard)
- Per-build monotonic sequence order key (replace wall-clock `created_at`)
- Correct the over-optimistic code comment
- (+ the WP-C perimeter items: delivery-dedup→hash, namespaced keys, envelope-verify, strict-hex)

## Next
WP-D — the real cockpit build on this foundation. Approach decision pending (Directus-local proof vs bespoke desktop cockpit wired to real control-plane data).
