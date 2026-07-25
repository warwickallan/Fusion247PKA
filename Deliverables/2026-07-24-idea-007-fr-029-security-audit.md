# Security Audit: IDEA-007 FR-029 decision controls

**Inspector:** Vex
**Date:** 2026-07-24
**Verdict:** CONDITIONAL PASS — code clear; live deployment requires scoped action DSN verification

## Scope

Targeted pre-ship review of the new source-report candidate decision path, the existing BUILD-002 decision/apply boundary it reuses, and the candidate data added by FR-029. This did not re-audit the entire Fusion247 box.

## Phase 1 — Credential hygiene

**Result:** PASS.

Proof: a targeted secret-pattern search across `services/obsidiwikai`, the affected control-plane worker files, and migration 220 found no hard-coded OpenAI, GitHub, Slack, client-secret, or service-role patterns. Code reads secrets only from runtime environment/config outside Git.

## Phase 2 — Authorization and privileged paths

The browser can only POST an `accept` or `decline` intent into the existing `cockpit.learning_command` queue. The existing insert guard requires `status='requested'` and forbids caller-supplied receipt/claim/completion fields. Candidate state and `follow_on_task` creation remain worker-only. All candidate IDs and SQL values are parameterised; candidate IDs are UUID-validated before SQL.

### [MEDIUM] Verify least-privilege report action DSN before live deployment

**Where:** `services/obsidiwikai/ops/report-server.py` — `PG_ACTION`

**What:** The code supports `REPORT_ACTION_DATABASE_URL` for the request-only `cp_directus` role, but falls back to the report’s existing `DATABASE_URL` for compatibility. The current live environment could not be inspected from this workstation. If that fallback is an owner-scoped DSN, a compromise of the report process has a wider database blast radius than the action requires.

**Proof-of-exploit:** Not asserted as exploitable without live configuration evidence. This is an unverified deployment condition, not a fabricated vulnerability claim.

**Fix recommendation:** Set `REPORT_ACTION_DATABASE_URL` to the existing request-only `cp_directus` connection and retain `DATABASE_URL` only for the report’s read path until the existing source-feedback write is separately narrowed.

**Verification step:** From the live report container, confirm the action connection can insert a valid requested `learning_command`, cannot update `learning_candidate.status`, and cannot update/complete the command row.

## Phase 3 — Endpoint and integration hardening

**Result:** PASS for the code path.

Executed checks:

- valid HMAC action token accepted;
- token replayed against another action rejected;
- same-origin request accepted and foreign origin rejected;
- in-process request rate limit enforced;
- mutation endpoint is POST-only with a 4 KiB request-body cap;
- allowlist is only `accept | decline`;
- CSP restricts default sources, framing and form actions;
- `nosniff`, no-referrer and restrictive Permissions-Policy headers are present;
- error pages do not return stack traces or database messages.

The report remains a private Tailnet surface; this increment does not make it public.

## Phase 4 — Data handling

**Result:** PASS.

The new records contain public-source graph evidence, a system-improvement proposal, Warwick’s decision identity, and governed task state. No journal, health, employer, Bellrock, family, credential, or other raw private payload is introduced. Accept/Dismiss creates decision/task records only; no canonical MyPKA content is written.

## Verdict

**CONDITIONAL PASS.** No Critical or High security issue was found in the increment. Live deployment must verify the scoped `REPORT_ACTION_DATABASE_URL` condition; the box could not be reached from this runtime.
