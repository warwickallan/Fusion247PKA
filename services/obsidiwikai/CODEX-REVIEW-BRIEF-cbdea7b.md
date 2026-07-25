# Codex independent review — ObsidiWikAi (IDEA-007), PR #59 @ `cbdea7b`

**Your role:** independent, read-only QA. You inspect; you do **not** implement, touch controls, make product
decisions, or redesign. Find genuine defects, classify them, hand them back. Larry fixes the real ones and
re-confirms; Warwick holds the merge gate. **Max 3 rounds. Real defects only.**

## Frozen scope
- Head `cbdea7b`, base `origin/main` `7a9f981` — clean fast-forwardable descendant.
- Review the diff: `git diff origin/main...cbdea7b` (**125 files / ~17.3k insertions / 35 deletions**).
  If your sandbox is read-only and cannot read the tree, the full diff is staged at
  `scratchpad/CODEX-REVIEW-cbdea7b.diff` (path given to Warwick) — review from that.
- Canonical evidence record to check the code against: `ideas/IDEA-007/TRACEABILITY.md`
  (banner + FR/DoD tables have been reconciled to one truth — verify the code actually backs each ✅).

## Reviewer stance (READ THIS — it sets the bar)
This is a **personal, first-party, single-user hobby brain** for one person (Warwick), not a commercial or
multi-tenant adversarial product. Review for **fitness-for-purpose, goal-achievement, and design-soundness under
normal first-party use** — "does this reliably do what the PRD promises, without losing data, leaking Warwick's
private material, or silently corrupting the graph?"

- **Genuine-defect bar =** correctness · accidental data loss · accidental privacy leak (personal → graph/external) ·
  availability/reliability under normal use · broken audit/provenance · governance that fails *open* (candidate
  becomes canonical, or an action fires, without the human tap).
- **NOT the bar:** hardening against a malicious in-process handler, adversarial multi-tenant abuse, or
  crevice-hunting a threat model that doesn't exist for a single-user bedroom system. **Down-rank adversarial-only
  crevices hard.** If something is only exploitable by an attacker who already owns the box, note it as
  fold-before-live at most, not a blocker.
- "Proven" means **executed** evidence (a test that ran, a live call that returned), not a claim in a doc.

## Severity classification (label every finding)
- **BLOCKER** — real defect that breaks a PRD promise or risks data loss / privacy leak / governance-fails-open
  under normal first-party use. Must fix before merge.
- **FOLD-BEFORE-LIVE** — genuine but only matters at live cut-over or is adversarial-only; fix before the live
  apply, not necessarily before code-merge.
- **COSMETIC** — style/naming/doc nits. List briefly; do not spend rounds here.

## Where the genuine risk concentrates (spend your attention here)
1. **`src/core/brainAccess.mjs` + `src/bin/brain-mcp.mjs`** — read-only governed retrieval. Can it *ever* return
   file paths, execute Cypher, hit arbitrary routes, or write? Does `grounded-or-refuse` actually refuse on thin
   evidence (no fabricated answers)? Does the recent `nativeReference`/`referenceValues` change preserve those
   guarantees? Are the MCP `readOnlyHint`/`openWorldHint` annotations truthful?
2. **`src/core/contextOutbox.mjs`** — crash-safe exactly-once (atomic claim/lease + fail-safe reconcile). Can a
   crash mid-delivery drop a packet or double-deliver? Verbatim "Honch that" must not be truncated.
3. **`src/core/reanalyse.mjs` + `src/core/lensDelta.mjs`** — grounded compounding. Can the 2-run consensus +
   exact-concept validation be tricked into emitting a delta that isn't in the live graph? Does it fail conservative
   (no delta) rather than fabricate?
4. **FR-029 governance path (`ops/report-server.py`, migrations, `cp_directus` role)** — request-only role, HMAC
   action tokens, POST-only, rate/origin limits. Can a candidate become canonical, or an action fire, without the
   human tap? Does the request-only DSN fail closed?
5. **`src/sources/email.mjs` + `emailStore.mjs`** — retrieve / dedupe / receipt / hand `capture_id` to Cairn ONLY;
   no Honcho routing inside the adapter. Cursor must establish a delta without ingesting pre-existing mail. Replay
   must not double-capture; nothing lost on failure.
6. **Migrations (`migrations/0001`–`0008`, `220_*.sql`)** — idempotent apply; teardown/test-range parity; least
   privilege grants.
7. **Privacy separation (FR-030)** — no personal/entrusted (AsdAIr-class) data reaches the graph or any external
   surface. This branch is on a PUBLIC repo.

## Explicit non-goals
Do not propose new products or features. Do not redesign working code. Do not raise hobby-brain-acceptable
tradeoffs (e.g. "no rate-limit on a localhost single-user tool") as blockers. Do not flag the honest residuals
(email OAuth = human dep; sustained multi-source compounding = lived-use) as defects — they are documented as
non-code.

## Output
Per finding: `file:line` · severity · one-sentence defect · concrete failure scenario (inputs/state → wrong
outcome). End with a verdict: **clean**, or **N blockers / M fold-before-live**. If clean, say so plainly — do not
manufacture findings to look thorough.
