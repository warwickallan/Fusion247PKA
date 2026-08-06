---
build: BUILD-020
scope: ACTIVE SESSION WORK PACKAGE — functional rows 1–5 (Gate 1)
gate: 1

reviewed_sha: 95f8826c7924fbf61a1600485bae6b30e82cf377
governance_sha: 95f8826c7924fbf61a1600485bae6b30e82cf377
branch: build-020/phase4-automation-law

evidence_workspace: C:\tmp\veritas-gate1-95f8826
worktree_head_at_start: 95f8826c7924fbf61a1600485bae6b30e82cf377
worktree_head_at_end: 95f8826c7924fbf61a1600485bae6b30e82cf377
worktree_status_clean: true
# porcelain unchanged start→end: only untracked `.grok/hooks/probe-dump.json` (not in archive export)

verdict: HOLD
receipt_sha256: bd55c7c4f80c2e1d244fda3d5bb14def82129bd5b2b0c32f3d2df88006523b21
reviewed_by: veritas
reviewed_date: 2026-08-06
next_review_trigger: Successful Supabase populate of a real rotation payload via `tools/session-report/populate.mjs` (approved-runtime credentials + schema), then resubmit the new exact integrated head for Gate 1 rows 1–5 (or Gate 1 re-check of row 5 if product is otherwise unchanged).
review_ceiling: 40 minutes
remote_reachable: true
# origin/build-020/phase4-automation-law @ 95f8826c7924fbf61a1600485bae6b30e82cf377
---

## Scope reviewed

**Gate 1 — Integrated Work Package (functional only)** for the ACTIVE SESSION WORK PACKAGE on `Deliverables/2026-08-04-proofline-wayfinder-plan.md` at exact head `95f8826c7924fbf61a1600485bae6b30e82cf377`.

**In scope (functional rows 1–5):** Work Order route (G-1..G-6, hermetic suite, J1-1, AC-5 3/3); return-cue (Claude live + Grok Option C); FusionDevBot durable path + host-appropriate combined journey; Watcher/Tower durable restart via installed route; `/rotate` + successful Supabase populate.

**Out of scope (not graded as product requirements):** assurance/release sequence (Codex withhold, Gate 2, merge decision, PR #97 merge). Prior narrow Gate 1 PASS at `a1e124a` treated as slice evidence only, not merge readiness.

**Accepted phase outcome (from map):** functional rows 1–5 complete and verified. **North Star (map §1):** browser submit → durable record/process/approval/survive-kill — Phase 4 automation-law WP serves that North Star by making issuer/return/notify/watcher/rotate paths real; Gate 2 remains the phase North Star journey.

**Dispatch completeness:** all five functional rows named; no narrowing to older product slice.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | Work Order route: G-1..G-6; hermetic 65/65 worktree+archive; J1-1 ordinary generated-envelope route (manual field authoring OK); AC-5 3/3 GENERATED first-dispatch accepts without class-A refuse | **PASS** | Archive export: `node --test tools/wo/envelope.test.mjs` → **65/65 pass**, exit 0 (~30s). Worktree at same SHA: **65/65**, exit 0 (~17s). G-1..G-6 covered by suite + `tools/wo/envelope.mjs`/`README.md`. J1-1: `ORDER_MARKER` + SOP-022 worker REFUSE of unmarked orders; README ordinary route. AC-5: three GENERATED orders `ac5-1-pax`, `ac5-2-keel`, `ac5-3-nolan` each `--count-markers` → `authorCount:0`, `unresolvedCount:0`, `ready:true`; accept notes Pax + Nolan; Keel journey line in `tools/wo/README.md` | Keel lacks a dedicated 1–2 line accept note file (Pax/Nolan have notes). Cost “materially lower” not re-proven in this review — not in the dispatch wording for row 1. Non-blocking for this row. |
| 2 | Return-cue: Claude automatic parent cue LIVE; Grok honest Option C (DO NOT BUILD inject) durable in `.grok/ORIENTATION.md` + empty inject hooks | **PASS** | Claude: tracked `.claude/settings.json` SubagentStop/PreToolUse/UserPromptSubmit/SessionStart → write/consume/sweep; unit suite **11/11** in archive; live host proof `Deliverables/2026-08-06-claude-return-cue-live-proof.md` (SubagentStop identity, residual-empty consume, Rule 4a cue text). Grok: `.grok/ORIENTATION.md` classifies MANUAL CONTEXTUAL DISCIPLINE; `.grok/hooks/return-cue.json` has `"hooks": {}` and explicit DO NOT BUILD inject comment; Pax Option C research cited | Live Claude proof banked at this product line; residual dir empty now (consume). Grok inject deliberately not built. |
| 3 | FusionDevBot durable path + host-appropriate combined journey (Claude with cue; Grok discipline) | **PASS** | Installed `~\.mypka\governor\ding.mjs` **byte-identical** to git blob `95f8826:tools/governor/ding.mjs` (sha256 `0f26ef16…`, 17454 bytes). `ding-log.jsonl` shows real sends (message_id 333–337, exit 0). No shell Telegram env required. Claude: automatic parent cue LIVE (row 2) + ding path for Rule 4a qualifying events (hook never auto-dings — by design). Grok: Option C discipline in ORIENTATION + Rule 4a | Combined **qualifying** return (cue + ding) not re-exercised as a single timed harness in this review; ding transport and Claude cue proven separately. Host-appropriate, not false Grok auto-inject. |
| 4 | Watcher/Tower durable across restart via installed route (`start-watcher.mjs` / `watcher.mjs` + durable SQLite) | **PASS** | Installed runtime `~\.mypka\tower-runtime\services\control-plane\tower-loop\start-watcher.mjs` with `TOWER_NOTIFY_TRANSPORT=none`: started PID **26140**, log `store_open` + `watcher_up` + `pr_poll_discovery` PR **#97** + `pr_poll_ok` head **`95f8826…`**. Durable store `~\.mypka\tower\tower.db` present. Repo `run-watcher.mjs` has Windows path-normalised `isMainModule()`; `start-watcher.mjs` always calls `main()`. Cold-start evidence file banked | First absolute-path invoke from wrong cwd returned empty/exit -1; success when launched from installed tower-loop directory (operator path discipline). Installed `start-watcher.mjs` hash ≠ reviewed export (453 vs 466 bytes) — behaviour proven live. TowerBot-enabled notify path not required under `TOWER_NOTIFY_TRANSPORT=none`. |
| 5 | `/rotate` + **successful** matching Supabase populate | **HOLD** | `/rotate` command present with steps 5–8/7b/12 requiring populate + visible fail. `tools/session-report/populate.mjs` + `schema.sql` present. Executed populate without credentials: exit **2**, `why:credentials-absent`, durable line in `~\.mypka\governor\session-report-populate.jsonl` (including this review’s probe at head `95f8826`). **No successful Supabase POST observed** | **blocking:** green populate still requires approved-runtime `SUPABASE_URL` + service-role key and applied schema. Credentials absent in this shell; private_surface none — Veritas did not open private credential stores. |

## Evidence provenance

- Isolated export of `reviewed_sha` at `C:\tmp\veritas-gate1-95f8826`, created with `git archive 95f8826c7924fbf61a1600485bae6b30e82cf377 | tar -x -C …`.
- Repository `git rev-parse HEAD` at start / end — `95f8826c7924fbf61a1600485bae6b30e82cf377` / `95f8826c7924fbf61a1600485bae6b30e82cf377`, identical.
- Repository `git status --porcelain` — unchanged start to end (`?? .grok/hooks/probe-dump.json` only; not in archive).
- Mutations only inside export (test runs); no implementation edits. Working tree not modified by Veritas (receipt write is the sole repo write surface).
- Remote: `origin/build-020/phase4-automation-law` contains `95f8826…` (`git ls-remote` + `git branch -r --contains`).

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git archive` → `C:\tmp\veritas-gate1-95f8826` | 0 | n/a | Clean export of exact head |
| `node --test tools/wo/envelope.test.mjs` (archive) | 0 | **65** | pass 65 / fail 0 |
| `node --test tools/wo/envelope.test.mjs` (worktree) | 0 | **65** | pass 65 / fail 0 |
| `node --test .claude/hooks/return-cue.test.mjs` (archive) | 0 | **11** | pass 11 / fail 0 |
| `node tools/wo/envelope.mjs --count-markers` ×3 AC-5 orders | 0 | n/a | each ready:true, authorCount:0 |
| `node tools/session-report/populate.mjs --file <probe>` (no creds) | **2** | n/a | credentials-absent, jsonl append |
| `node ~/.mypka/tower-runtime/.../start-watcher.mjs` (cwd=tower-loop, TOWER_NOTIFY_TRANSPORT=none) | 0 | n/a | PID 26140; log watcher_up + pr_poll_ok @ 95f8826 |
| ding installed vs `git cat-file blob 95f8826:tools/governor/ding.mjs` | 0 | n/a | byte-equal sha256 0f26ef16… |
| CI at exact head (PR checks) | n/a | n/a | governor-tests, control-plane-tests, secret-scan, cockpit-private-apps **success** on `95f8826` |
| Read: Claude live proof, Grok ORIENTATION, return-cue.json, SOP-022 ordinary route, watcher cold-start evidence, AC-5 notes, INSTALLED-FROM, ding-log | n/a | n/a | as cited in Accepted requirements |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | Rows 1–4 meet functional claims; row 5 (successful Supabase populate) is part of accepted WP and is not green |
| Design fidelity | **PASS** | G-1..G-6, J1-1, Option C (no false Grok inject), ding as pipe-not-trigger, start-watcher Windows entry match accepted design |
| Functional proof | **HOLD** | Primary production paths for 1–4 executed; populate success path not executed |
| Integration | **PASS** | Generator → SOP-022 refuse; hooks wired in settings; ding installed path; watcher installed launcher → durable SQLite → PR poll |
| Durability | **PASS** | Watcher kill/revive via installed route + durable DB/log; ding durable log; populate fail is durable (jsonl). Supabase success durability n/a until green |
| Test quality | **PASS** | Hermetic 65/65 under mandatory archive isolation; return-cue 11/11; mutations present in WO suite |
| Git truth | **PASS** | Reviewed tip matches dispatch; remotely reachable; CI green at exact head; status frozen |
| Documentation truth | **PASS** | Map residual language still says IN PROGRESS/PARTIAL on some rows while tip advances — recorded non-blocking; no active instruction that would misdirect Gate 1 corrective work on row 5 |
| Residual risk | **HOLD** | Credentials/schema for session_report remain the blocking residual; thin Keel AC-5 note; installed start-watcher drift from repo bytes |
| Completed automation | **PASS** (scoped) | Claude return-cue: real SubagentStop/PreToolUse production events (not manual script). Grok return-cue: **explicitly reclassified manual** (Option C). Ding: **not** intended automatic (Rule 4a). Watcher: installed start route proven (not OS service claim). Supabase populate: mechanism only until green — does not claim completed automation |

## Production caller and journey

1. **WO:** Larry runs `node tools/wo/envelope.mjs … --out <order>` → authors bare slots → `--count-markers` → dispatches; worker REFUSEs if marker absent (SOP-022).
2. **Return-cue (Claude):** host SubagentStop → `return-cue-write.mjs` marker → parent PreToolUse/UserPromptSubmit → `return-cue-consume.mjs` → `additionalContext` Rule 4a text.
3. **Return-cue (Grok):** no inject path; ORIENTATION + empty hooks; Larry applies Rule 4a manually.
4. **FusionDevBot:** `node ~/.mypka/governor/ding.mjs <message-file>` self-loads credentials, POSTs, appends ding-log.
5. **Watcher:** `node …/start-watcher.mjs` (or `watcher.mjs` + `TOWER_SQLITE_PATH`) → durable SQLite → PR poll.
6. **Rotate/populate:** `/rotate` step 7b → `populate.mjs --file <payload>` → PostgREST (blocked here on credentials).

## Restart and durability

- **Watcher:** process was down; revived via installed `start-watcher.mjs`; prior and new `watcher_up` + PR discovery on same durable DB path.
- **Ding:** multi-send log survives sessions.
- **Populate:** fail path durable; success path unproven.

## Documentation contradiction scan

- Larry’s DOCUMENT IMPACT: not separately listed in dispatch; Veritas searched ACTIVE WP, tools/wo README, ORIENTATION, rotate command, cold-start evidence.
- **What held:** Grok Option C honesty; hermetic claim now true at 65/65 under archive; Claude live proof present.
- **What map still says PARTIAL/IN PROGRESS** while tip claims readiness for Gate 1: rows 2–5 status labels on the map lag product evidence — **non-blocking** clerical lag for Gate 1 (does not misdirect the residual: green populate).
- Active misdirect of current frontier: none found for “fix populate then resubmit.”
- Closure claims: no new `closed`/phase PASS claim at this head requiring a receipt beyond this Gate 1 submission.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| V-G1-1 | high | Row 5: no successful Supabase populate; only credentials-absent fail path proven | **blocking** — gates Gate 1 overall PASS / WP complete claim | Larry (credentials via approved runtime; schema apply) |
| V-G1-2 | low | AC-5 Keel accept evidence is README journey line, not a sibling accept-note file | non-blocking | Larry — optional strengthen |
| V-G1-3 | low | Installed `start-watcher.mjs` bytes differ from reviewed export; live start works from installed tower-loop cwd | non-blocking | Mack/Larry — reinstall alignment optional |
| V-G1-4 | low | Map ACTIVE WP status cells still say IN PROGRESS/PARTIAL for rows now largely proven | non-blocking | Larry — scheduled reconciliation |

## Verdict

**HOLD** — mandatory row **5** is HOLD (successful Supabase populate missing). Rows **1–4 PASS**. Overall PASS cannot hide a mandatory HOLD.

## Next review trigger

Successful Supabase populate of a real rotation payload via `node tools/session-report/populate.mjs --file <payload.json>` with approved-runtime credentials (visible ok:true + durable log), on a frozen exact integrated head, then resubmit Gate 1 (full functional rows 1–5, or row-5 residual re-check if no product change).
