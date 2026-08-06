---
build: BUILD-020
scope: active-session-work-package-rows-1-4 (amended, complete)
gate: 1

reviewed_sha: 0cf70c9c5cfbadeddfae13fdd4a4c5dbc6e3f34c
governance_sha: 0cf70c9c5cfbadeddfae13fdd4a4c5dbc6e3f34c
branch: build-020/phase4-automation-law

evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA-build-020-trial\d6b350fc-7935-4b6f-adca-e763bb88f56d\scratchpad\export-0cf70c9
worktree_head_at_start: 0cf70c9c5cfbadeddfae13fdd4a4c5dbc6e3f34c
worktree_head_at_end: 0cf70c9c5cfbadeddfae13fdd4a4c5dbc6e3f34c
worktree_status_clean: true
remote_reachable: true

review_ceiling: proportionate, ~45 minutes (named in dispatch; not extended)
private_surface: C:\.fusion247\private\careerair\**

verdict: FAIL
receipt_sha256: 934225726a0aa4b99348e350b02bf45b0137cb38d7c36afeea77b69b90a72ec8
reviewed_by: veritas
reviewed_date: 2026-08-06
next_review_trigger: a new exact integrated head at which row 3 has a genuinely automatic trigger exercised by the real production event, OR Warwick has explicitly reclassified row 3 as manual/deferred with the map updated — together with D-2, D-3, D-4, D-5 addressed and D-6 reported as an observed result
---

## Scope reviewed

**Gate 1 — the COMPLETE amended ACTIVE SESSION WORK PACKAGE, functional rows 1–4**, as carried by
`Deliverables/2026-08-04-proofline-wayfinder-plan.md` § ACTIVE SESSION WORK PACKAGE including **Amendment 3**,
at the exact integrated head `0cf70c9`. Scope was **not** narrowed to any earlier slice; no such narrower
release decision from Warwick exists.

**Deliberately not in scope:** rows 5–7 (assurance and release sequence — not product requirements);
the Phase 4 North Star journey (**Gate 2**, a separate receipt); PR/release acceptance and CI acceptance
(Codex's); replacement-machine DR (excluded by the WP).

**Scope widened by Veritas:** none required — the dispatch named all four functional rows.

## Accepted requirements

| # | Requirement (abbreviated from the WP; full text is canonical on the map) | Verdict | Evidence | Residual |
|---|---|---|---|---|
| **1** | BUILD-020 durability / promotion readiness ⊕ Amendment 3 hook install and live proof, outcomes (a)–(g) | **HOLD** | Hooks registered in committed `.claude/settings.json` (4 events); installed bytes == committed blobs, 4/4 (`git hash-object` vs `git rev-parse <sha>:<path>`); `node --test .claude/hooks/return-cue.test.mjs` in the isolated export → exit 0, **12/12 executed**, 0 skipped; PR #97 carries `.claude/hooks/*` + `.claude/settings.json`, so the merge unit and post-merge alignment are real | **(e) survives restart / session rotation is UNPROVEN** — an unknown on a named acceptance outcome. Also: hooks are project-scoped, so `C:\Fusion247PKA` (main-line clone) has **no** `.claude/hooks` until #97 merges — correctly listed, not a defect |
| **2** | Every old Gate 2 residual at `95f8826` returns exactly one of DISCHARGED · STILL OPEN · RECLASSIFIED · NOT PART OF THE PHASE | **HOLD** | Source receipt read directly (`Deliverables/2026-08-06-veritas-gate2-phase4-receipt.md`, reviewing `95f8826`): its residuals are **V9-1, V9-2, V9-3, V9-4**. Larry's table in `2026-08-06-amended-wp-recon-evidence.md` dispositions V9-1 (in three pieces) and V9-2 | **V9-3 and V9-4 receive NO disposition.** The requirement says *every*. Also the table uses invented labels (`P-JOB1`, `P-CUE`, …) that appear nowhere in the source receipt, so coverage cannot be audited by name |
| **3** | CareerAIR **automatic** Outlook intake — retrieved durably and automatically, without Warwick starting a session or reminding Larry | **FAIL** | The intake half is genuinely proven on real mail (persist-before-ack, dedupe, no-dupe on restart, deny-by-default, no external consequential action). **The trigger half does not exist.** Live surface confirms it: `last_successful_collection: null`, `collector.state: "down"`. `config/outlook-scout.json` `_ARCHITECTURAL_BLOCKER` records that headless `claude -p` gets NO-MCP-TOOLS, so the authorised route **cannot** be automated as designed | The accepted outcome is not delivered and the submitted route cannot deliver it. **No document in the repo claims otherwise** — Larry's honesty here is confirmed, and it does not change the verdict |
| **4** | Live Cockpit production surface + truthful CareerAIR operational view | **HOLD** | Executed against the live surface Warwick uses: `GET /` → 200; `/private-apps.js` → CareerAIR present; `GET /private-api/careerair/api/email-ops` → 200 with `healthy:false`, `collector.state:"down"`, `ingress` reported separately as `up`, `consumer:"ok"`, `queue{pending,oldest_pending_age_seconds}`, `last_successful_collection:null`, `latest_safe_item`. The three-way separation the row demands genuinely holds. Overlay consumes the repaired shape (`.collector`, `.consumer`, `.healthy`, `.failure`, `last_successful_collection`, `no_messages`, `oldest_pending_age_seconds`, `latest_safe_item`) | Three residuals — see D-3, D-4, D-5. Browser render journey still not executed; the live surface runs **uncommitted** bytes in a foreign clone; the "exact failure" text points at a route the WP forbids |

## Evidence provenance

- Isolated export of `reviewed_sha` at
  `C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA-build-020-trial\d6b350fc-7935-4b6f-adca-e763bb88f56d\scratchpad\export-0cf70c9`,
  created with `git archive 0cf70c9c5cfbadeddfae13fdd4a4c5dbc6e3f34c | tar -x -C <workspace>` → `EXPORT_OK`.
- Repository `git rev-parse HEAD` at start / end — `0cf70c9c5cfbadeddfae13fdd4a4c5dbc6e3f34c` / `0cf70c9c5cfbadeddfae13fdd4a4c5dbc6e3f34c`, identical.
- Repository `git status --porcelain` — **empty at start and at end**. Working tree never modified.
- Remote reachability: `git branch -r --contains 0cf70c9…` → `origin/build-020/phase4-automation-law`. The head is pushed.
- No mutation testing was performed by Veritas; the mutation evidence in `2026-08-06-wo23-keel-refusal-and-findings.md` is **builder evidence**, recorded as such and not re-run.
- Suites were executed **inside the export**. Live HTTP and live-runtime provenance checks were necessarily executed against the **running machine**, read-only (`curl` GET, `git hash-object`) — this is stated rather than glossed, because it is the one place the evidence is not isolated, and see D-3.
- Private surface touched: `C:\.fusion247\private\careerair\**` only — `runtime/ops/state.json`, `config/source-providers.json`, `src/cockpit/server.mjs` (read/grep only). No credential material read. GL-012 honoured.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test .claude/hooks/return-cue.test.mjs` (in export) | 0 | **12 pass / 0 fail / 0 skipped** | Non-vacuous. Pins unconditional sweep and parent-only claim |
| `git hash-object` vs `git rev-parse 0cf70c9:<path>` for `return-cue-{sweep,consume,write}.mjs`, `.claude/settings.json` | 0 | 4 | **4/4 identical** — source-to-installed alignment holds (outcome (b)) |
| `curl http://127.0.0.1:8090/` | 0 | — | `200` |
| `curl http://127.0.0.1:8090/private-api/careerair/api/email-ops` | 0 | — | `200`, truthful payload (see row 4) |
| `curl http://127.0.0.1:8791/careerair/api/email-ops` | 0 | — | identical payload — Cockpit and service agree |
| `curl http://127.0.0.1:8090/api/health` | 0 | — | `{"status":"ok","build":{"sha":"c1ed028"…}}` — see D-3 |
| `git hash-object C:/Fusion247PKA/services/cockpit/server.mjs` | 0 | — | `f595505…` ≠ reviewed-head blob `95bb814…` ≠ its own commit's blob `16a6a85…`; clone reports ` M services/cockpit/server.mjs` |
| `diff` reviewed-head cockpit vs live cockpit | — | — | **comment-only, 4 lines** — functionally equivalent (recorded so D-3 is not overstated) |
| `gh run list --commit 0cf70c9…` | 0 | **0 runs** | **CI NOT RUN at this head.** All branch runs `queued` (GitHub Actions outage). NOT RUN is never PASS |
| `node --test services/control-plane/review/test/tower-runtime.test.js` (in export) | 0 | **22 tests, 22 SKIPPED, 0 executed** | Larry's residual 8 could **not** be reproduced here (needs `DATABASE_URL`). Recorded as unverified, parked — out of rows 1–4 |
| `Deliverables/2026-08-06-veritas-gate2-phase4-receipt.md` (source of the row-2 residual list) | — | — | Residuals are V9-1…V9-4 |
| Repo-wide scan for text claiming automatic collection is live | 0 | — | **none found** — Larry's residual 1 is discharged for the repo |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **FAIL** | Row 3's central promise — mail arrives without Warwick starting a session — is not delivered by any mechanism at this head |
| Design fidelity | **HOLD** | Hooks, intake and Cockpit hold the accepted design. But `config/source-providers.json` declares `active: "outlook_connector"` (Graph, **enabled/ACTIVE**) while the WP rules Graph unauthorised and `runtime/ops/state.json` says `provider_active: "zapier_webhook"` — the configuration asserts a route the accepted design forbids |
| Functional proof | **PASS** | Every mechanism that exists was exercised through its real path: hooks suite 12/12; email-ops through the same-origin Cockpit route; intake proven on real mail |
| Integration | **PASS** | Overlay consumes the repaired email-ops shape; Cockpit `/private-api` bridge and the service agree byte-for-byte on the payload; hooks are registered on the four real events |
| Durability | **HOLD** | Hook restart/rotation survival unproven (row 1(e)). The live Cockpit surface exists as an **uncommitted modification** in a foreign clone on an unrelated branch; the CareerAIR private surface carrying the row-4 repair is under **no version control at all** — no history, no rollback |
| Test quality | **PASS** | 12 executed subtests, non-zero, and the builder record shows the suite was made to fail (`# pass 10 / # fail 2`) before being restored. The self-defeating first mutation attempt was itself recorded — good practice |
| Git truth | **HOLD** | Branch, head and push state are accurately reported. But the running Cockpit self-reports `build.sha: c1ed028` while executing bytes that match no commit |
| Documentation truth | **HOLD** | No document claims row 3 is live — checked, not taken on trust. The provider contradiction (three sources, two disagreements) is recorded on the map but remains live in config, and it now leaks onto the **user-visible** surface as a misdirecting failure reason |
| Residual risk | **PASS** | Larry's residual disclosure was unusually complete and accurate. Every item I could test held, including the ones that count against him. Two he did not name are D-3 and D-2 |
| **Completed automation** | **FAIL** | Root `CLAUDE.md` § "Nothing may live only in Larry's head": for row 3 the real production event does not invoke collection, a fresh session cannot use it unprompted, and no stable approved runtime carries it. Every collection call was Larry-in-session through an MCP tool that exists only inside a session. The outcome has **not** been reclassified as manual by Warwick, so PASS is unavailable |

## Production caller and journey

**Row 1 (hooks) — on the journey.** `SubagentStop` → `return-cue-write.mjs` → marker in `.claude/state/return-cues/`
→ parent `PreToolUse` / `UserPromptSubmit` → `return-cue-consume.mjs` → `hookSpecificOutput.additionalContext`.
Registration is in the committed project `settings.json`, so `$CLAUDE_PROJECT_DIR/.claude/hooks/` **is** the
installed location and alignment is committed-blob-vs-invoked-bytes — verified 4/4. The **live** dispatch→cue
journey is Larry's executed record (Keel returned; cue injected before the summary); its raw dump is gitignored,
so it is **builder evidence from the only actor able to fire the event**, not independently re-checkable.
`SessionStart` → `return-cue-sweep.mjs` is bound to the real boundary event, but the boundary itself has not
been crossed since the repair.

**Row 3 — the journey stops at the front door.** Everything from `normaliseDelivery()` → `enqueue()` → processor
→ Cockpit is real, wired and proven on real messages. The hop *before* it — something that reaches the mailbox
without a human — **does not exist**. The Zapier Funnel is a dormant adapter with no Zaps; the Graph poller is
unauthorised and unconfigured; the MCP tool used for the demonstration is reachable only from inside an
interactive Larry session. A component reached only by Larry calling it is not on the production journey.

**Row 4 — on the journey.** Browser (not exercised) → Cockpit `:8090` → `/private-api/careerair/*` → CareerAIR
service `:8791` → durable ops state + Postgres. Executed from the Cockpit end of that chain inclusive; the
browser hop is the missing one.

## Restart and durability

- **Hook restart / session rotation (row 1(e))** — **NOT PROVEN.** Only Warwick restarts the host, and a restart
  cannot be observed from inside the session being restarted. The repaired sweep is bound to `SessionStart` and
  was driven with a real `source: "clear"` payload in the builder's test, which is **capability evidence**. It is
  not observed survival, and this receipt does not treat it as such.
- **Queue durability (row 3 intake half)** — proven: re-collection after processing returned
  `DUPLICATE … state=done deliveries=3` with queue depth unchanged at 0. A restart cannot resurrect processed mail.
- **Live Cockpit** — survives a *process* restart (the patched file is on disk), but not a `git checkout`,
  `git stash` or `git clean` in `C:\Fusion247PKA`, which are ordinary operations on that clone. See D-3.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT / residuals:** eleven items, listed in the dispatch.
- **Verified independently against the repository:** residual 1 (no document implies row 3 is live) — **holds**,
  scan returned nothing. Residual 3 (CI blocked) — **holds**, 0 runs at this head. Residual 5 (provider
  contradiction) — **holds**, reproduced from both files. Residual 6 (private surface unversioned) — **holds**.
  Residual 2 (restart unproven) — **holds**.
- **What his list missed:**
  1. **D-2** — the row-2 disposition table omits Gate 2 residuals **V9-3 and V9-4** entirely. Larry reported row 2
     as DONE; it is not, and the omission is invisible unless the source receipt is opened.
  2. **D-3** — the live Cockpit runs **uncommitted** bytes from a **different clone on an unrelated branch**, and
     reports a build SHA that is not what it is executing. Residual 6 named only the *private* surface.
  3. **D-4** — the provider contradiction is not merely internal any more; it now produces a **misdirecting
     operator instruction on the user-visible surface**.
- **Active documents that would misdirect a fresh instance:** `C:\.fusion247\private\careerair\config\source-providers.json`
  — `"active": "outlook_connector"`, `"enabled": true`, `"state": "ACTIVE"` for a route the Work Package rules
  **not authorised** and which is not running.
- **Closure claims since the last receipt, and the receipt behind each:** none. Larry made no completion claim at
  this head; his dispatch states "verify or refute, do not take on trust" and pre-declares row 3 as NOT LIVE.
  **No suppressed receipt found. No false completion claim found.**

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **D-1** | **high** | **Row 3 has no automatic trigger and the authorised route cannot supply one.** The intake half is real and proven; the collection half is Larry-in-session only. Fails the `Completed automation` acceptance test in root `CLAUDE.md`. **Blocks:** any Gate 1 PASS at this head; any Codex invocation (which requires Gate 1 PASS); any statement that automatic Outlook intake is delivered | **blocking** | Warwick — this needs a **route decision** (authorise Graph consent · fund an automatic Zapier trigger · reclassify row 3 as manual/deferred), not corrective implementation. **This is an observation, not a Work Order** |
| **D-2** | medium | **Row 2 is incomplete.** Gate 2 residuals **V9-3** (AC-5 accept notes thin) and **V9-4** (no full-package Gate 1 PASS receipt at tip) receive **no** disposition, though the row requires one for *every* residual. The table's `P-*` labels do not correspond to any label in the source receipt | **blocking** for row 2 PASS only | Larry — two rows to add; trivially correctable inside the current WP |
| **D-3** | medium | **The live Cockpit production surface is not any committed head.** `C:\Fusion247PKA\services\cockpit\server.mjs` hashes `f595505…`, matching neither the reviewed head (`95bb814…`) nor its own commit (`16a6a85…`); the clone is on `build-015/live-acceptance-recovery-2026-08-03` and dirty; `/api/health` reports `sha: c1ed028`, which is false about the running bytes. **The functional diff against the reviewed head is comment-only** — this is a provenance and durability defect, not a behavioural one. **Blocks:** treating row 4's live evidence as evidence about `reviewed_sha`, and any claim that the live surface is durable. An ordinary `git clean`/`git checkout` in that clone destroys it | **blocking** for row 4 PASS | Larry |
| **D-4** | medium | **The Cockpit's "exact failure" misdirects the operator.** `collector.detail` = `graph_auth_required: CAREERAIR_GRAPH_CLIENT_ID not set…` while the same payload reports `provider_active: "zapier_webhook"` and the WP rules Graph **not authorised**. The true reason there is no collection is that **no automatic trigger exists on the authorised route**. A payload that contradicts itself in one response, and points at a forbidden fix, is the same class of defect Larry repaired earlier today | **blocking** for row 4 PASS | Larry (surface) / Warwick (which provider is actually active) |
| **D-5** | medium | **Row 4's executable browser journey is still not executed at this head**, and it is a named acceptance property. Veritas cannot render a browser; the prior shoot in `2026-08-06-amended-wp-recon-evidence.md` predates the email-ops repair, so it is evidence about the old, untruthful strip. "Survives service restart + cache refresh" is likewise unproven at this head (Veritas is read-only against live state and did not restart the service) | **blocking** for row 4 PASS | Larry, or Warwick's explicit acceptance of the property |
| **D-6** | medium | **Row 1(e) — survives restart / session rotation — is UNPROVEN**, and is an outcome named by Amendment 3. Honestly declared by Larry; recorded here because an unknown on a mandatory property is a HOLD, never a qualified pass | **blocking** for row 1 PASS | Warwick (only he can restart the host); report the result either way at the next `/clear` |
| **D-7** | low | **CI is NOT RUN at this head** — 0 runs at `0cf70c9`, all branch runs `queued` behind a GitHub Actions outage. Local equivalents were correctly *not* offered as a CI pass. NOT RUN is never PASS. Independent of every finding above | **non-blocking** for this internal gate; **blocks** Codex and merge readiness, which are Codex's to hold | Larry — re-check when Actions recovers |
| **D-8** | low | **`.claude/**` has no contracted owner** (Keel refused WO-23 on its own critical rule 5). Recorded once for Warwick's decision. **Not a Work Order and must not become one automatically** | **non-blocking**, parked | Warwick |
| **D-9** | low | Larry's residual 8 (`review/test/tower-runtime.test.js:76` failing) could **not** be reproduced — the suite reports 22 tests, **22 skipped, 0 executed**, without `DATABASE_URL`. Neither confirmed nor refuted; a fully-skipped suite is itself worth noting. Outside rows 1–4 | **non-blocking**, parked to the scheduled reconciliation | Larry |
| **D-10** | low | WO-23 was hand-authored in breach of SOP-022's envelope requirement (Larry's own admission). Process defect, no product effect at this head | **non-blocking**, parked | Larry |

## Verdict

**FAIL** — the package's own row 3 promise (automatic Outlook intake) is materially undelivered and the
submitted route cannot deliver it, so Gate 1 cannot pass at `0cf70c9`; rows 1, 2 and 4 are HOLD on named,
correctable gaps.

**Why FAIL and not HOLD, stated precisely.** The FAIL is carried by **row 3 alone**. HOLD would mean the
evidence is missing; here the *capability* is missing — no automatic trigger exists, and the authorised
route (`config/outlook-scout.json` `_ARCHITECTURAL_BLOCKER`) cannot be made to supply one. Resubmitting the
same route at a new head would not change the verdict, which is exactly the distinction FAIL exists to draw.
This is **not** a finding against Larry's reporting: he declared row 3 NOT LIVE, refused to soften it, and
every residual he named that I could test held. Honest reporting of an undelivered outcome is still an
undelivered outcome.

**What this verdict gates, for the reviewed scope only:**
- Gate 1 PASS at `0cf70c9`, and therefore **Codex is prohibited** for this package (Gate 1 PASS is its precondition).
- Any statement that the amended Work Package, row 3, or row 4 is complete, delivered, operational, durable or accepted.
- Any merge presented as delivering automatic CareerAIR Outlook intake.

**What it does NOT gate:** unrelated safe work on the active route; rows 1, 2 and 4 correction; Warwick's own
route decision on row 3; and it does **not** transfer the work queue to Veritas. Queue effect is governed by
root `CLAUDE.md` §Finding disposition and is not restated here.

**Rows 1, 2 and 4 are close.** D-2 is two table rows. D-3 is a commit-and-align. D-5 is one browser run.
D-6 needs only the next `/clear` to be reported honestly either way. None of those is a re-plan.

## Next review trigger

A **fresh Gate 1 at a new exact head** when: (a) row 3 either has a genuinely automatic trigger exercised by the
real production event, **or** Warwick explicitly reclassifies row 3 as manual/deferred and the map records that
reclassification; (b) D-2, D-3, D-4 and D-5 are addressed; (c) D-6 is reported as an observed result rather than
an unknown. CI green and head stability remain preconditions for Codex, which stays prohibited until Gate 1 PASS
and Warwick's explicit authority. **Gate 2 is a separate receipt and is not answered here.**
