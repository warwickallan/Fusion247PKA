---
# --- identity and authority ---
name: T-17 git-lifecycle escalation gate
work_order_id: WO-2026-07-31-03
build: BUILD-018
wp_number: n/a
status: amended
authorised_by: Warwick
authorised_date: 2026-07-31
owner: keel
return_to: larry
blocking_dependencies: []
tags: [build-018, t-17]

# --- scope ---
outcome: >
  tools/governor/escalation-gate.mjs refuses an escalation that offers Warwick a decision AD-20 already
  assigns to Larry — specifically one whose proposed options proffer a git history/lifecycle operation
  (force-push, amend of a pushed ref, rebase/reset/filter of pushed commits). The refusal requires NO
  judgement about whether the underlying defect is cosmetic: under AD-20 the git lifecycle is not
  Warwick's to decide at all. A narrow declared-reason escape hatch covers the genuine
  unsafe-repository-state case. The gate FAILS OPEN on any error, any unrecognised shape, and every
  case its enumerable signals cannot decide.
file_surface:
  - tools/governor/escalation-gate.mjs
  - tools/governor/escalation-gate.test.mjs
  - Deliverables/BUILD-018-session-governor/evidence/T-17-escalation-gate.md
out_of_scope_policy: report-only

# --- authority (standing defaults) ---
credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none

# --- environment ---
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor

# --- inputs and handoffs ---
schema_decision: n/a
security_inputs: n/a
operational_handoff: none
runbook_path: n/a
---

## AMENDMENT (2026-07-31) — issued in response to Keel's CLARIFY read-back

**Keel's CLARIFY was correct on both counts and is the reason this order changed.** Recorded here rather
than silently rewritten, because the reasoning is the load-bearing part:

1. **"Is the underlying defect cosmetic" has no mechanical signal**, and a caller-supplied field
   asserting it would be self-attestation by the very actor who wants to escalate — a hope, not a
   control, in `delegation-gate.mjs`'s own words. **That determination is removed from the gate
   entirely.**
2. **The gate is re-grounded on AD-20, not on AD-26's cosmetic question.** AD-20 already settles that
   *"Warwick never manages branches, worktrees, commits, pushes or PR creation. Larry owns the complete
   Git lifecycle."* So an escalation that offers Warwick a **force-push / history-rewrite choice is
   categorically wrong whether or not the defect behind it is cosmetic** — Larry is handing over a
   decision that was never Warwick's. **No judgement step remains**: the question "is this cosmetic?"
   is never asked, because it does not change the answer.
3. **The narrowness is accepted knowingly**, per Keel's answer to (b). This gate is a point-fix for one
   mechanically-detectable shape. It does **not** enforce AD-26 generally, and must not be described as
   if it does — see AC6.

## Background

**D-4** (2026-07-31): a write-back commit landed and pushed **correctly**; Larry then noticed a stray
`@` in the commit *subject line* and raised an `AskUserQuestion` offering to **amend + force-push
already-pushed history**. Warwick ruled it an **acceptance failure**.

**AD-26** (the escalation rule) and **AD-20** (Larry owns the complete git lifecycle) are canonical in
`02-MAP.md` §3 — read both there. Warwick's reasoning for a mechanical control: *"A Stop hook alone is
insufficient if Larry can manufacture a pause by asking an unnecessary question."*

## Acceptance criteria

AC1 — A **pure** classifier returns an enumerable verdict distinguishing at least **REFUSED** (the
escalation offers a git-lifecycle decision that is Larry's under AD-20), **ALLOWED**, and
**UNCLASSIFIABLE** (no enumerable signal decided it → allowed, recorded as undecided, never silently
folded into either). Constants exported, following `evaluator.mjs`'s `STATE`/`EXIT_CODE` precedent.

AC2 — **Detection is by an exported, enumerable vocabulary of git history/lifecycle operations**, in the
style of `worktree-guard.mjs`'s existing `classifyBashCommand` — not free-text intent parsing. The
vocabulary must be a named export a reviewer can read in one place (the `SIGNAL_KEYS` precedent). It
must cover at least: `push --force` / `push -f` / `--force-with-lease`, `commit --amend` targeting a
pushed ref, `rebase`, `reset --hard`, `filter-branch`, `filter-repo`.

AC3 — **The D-4 scenario is a test case and classifies REFUSED**: an escalation whose options offer
"amend + force-push" to fix a commit subject on already-pushed history. **The test must NOT supply any
"is cosmetic" input** — proving the refusal stands on AD-20 alone.

AC4 — **Fails OPEN, proven by mutation in every direction.** A thrown error, malformed/absent input, an
unrecognised shape, and any UNCLASSIFIABLE case each **ALLOW**. Positive control required: a genuinely
warranted escalation (a merge decision, a spend, an irreversible live action) is **never** refused.
Over-blocking a legitimate escalation is the worse defect (AD-6/INV-2, T-16's posture).

AC5 — **A narrow, declared-reason escape hatch** for the genuine case where a history rewrite *is* the
legitimate subject of an escalation — e.g. a secret committed to pushed history, which is an
**unsafe repository state** and therefore explicitly *on* AD-26's escalate-only list. Follow
`delegation-gate.mjs`'s `justify` / closed-enum precedent. It must be a **closed enum, not free text**,
and its use must be recorded in the verdict so it is visible rather than silent.

AC6 — **The evidence document and the module header state the gate's ACTUAL coverage honestly**: that
it detects one mechanically-detectable shape (git-lifecycle decisions offered to Warwick), that AD-26's
other categories — typos, wording, formatting, naming, ticket boundaries, completed workers, ordinary
routing — have **no enumerable signal and remain unenforced**, and that those still depend on Larry
observing AD-26 unaided. No wording may imply general AD-26 enforcement.

## Required evidence

- `node --test "tools/governor/escalation-gate.test.mjs"` → **>0** executed subtests, verbatim output.
- `node --test "tools/governor/*.test.mjs"` → full suite green, before/after counts (baseline **528/528**).
- `bash scripts/secret-scan.sh --surface tools/governor/escalation-gate.mjs tools/governor/escalation-gate.test.mjs Deliverables/BUILD-018-session-governor/evidence/T-17-escalation-gate.md`
  → exit 0, reporting coverage as well as exit code.
- `worktree-guard.mjs` and `delegation-gate.mjs` **unmodified**: run both test files (27/27, 60/60) and
  show `git diff` empty for both, as T-16 evidenced.

## Inputs supplied

- **AD-20**, **AD-26**, **D-4** — `02-MAP.md` §3 and `programme-state.json`. AD-20 is now the primary
  grounding; read it first.
- `tools/governor/delegation-gate.mjs` (T-16) — precedent for a fail-open discipline gate and for the
  closed-enum `justify` escape hatch.
- `tools/governor/worktree-guard.mjs` — `classifyBashCommand` is the precedent for enumerable command
  classification. **Read it; do not modify it.**
- `tools/governor/evaluator.mjs`, `model-gate.mjs`, `status-line.mjs` — house patterns for enumerable
  verdicts and the pure-core + single-impure-wrapper split.

## Explicitly out of scope

- **Activation** into `.claude/settings.local.json` via `install-hooks.mjs`. Build and prove only; do
  not modify `install-hooks.mjs`.
- **Any modification to `worktree-guard.mjs` or `delegation-gate.mjs`.** Compose additively; if the
  outcome cannot be reached without touching them, STOP and return PARTIAL naming the file.
- Any attempt to classify "cosmetic vs material", or to enforce AD-26's non-git categories. Removed by
  this amendment — see AC6.
- Solving the unproven `AskUserQuestion` PreToolUse payload schema. Keel's preflight correctly found no
  local evidence of it. **Design the classifier against your own documented input shape**, state that
  shape in the evidence doc, and record the unproven-payload gap as fog for the separate activation
  step — exactly as T-03's sampler deferred live statusLine wiring.
- `programme-state.json`'s `tickets[]`, `02-MAP.md`'s `GOVERNOR:STATUS` block, the write-back log.
