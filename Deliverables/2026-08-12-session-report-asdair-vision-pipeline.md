---
title: "Session performance/process report — BUILD-015 AsdAIr, Cockpit + six-round vision pipeline + agentic-loop prototype"
date: 2026-08-12
author: Pax
build: BUILD-015 AsdAIr
session_window: "2026-08-11T20:09Z (CAPAE opening) through 2026-08-12T16:24:42Z (last confirmed dispatch end)"
status: Commissioned per root CLAUDE.md Rule 4a and the /rotate skill (steps 5-6b). NOT on Larry's
  blocking path to rotation.
inputs_read:
  - "Deliverables/2026-08-12-subagent-token-ledger-asdair-vision-pipeline-session.md (Larry's ledger, input only — re-derived below, not trusted)"
  - "Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md (tail, this session's narrative)"
  - "~/.mypka/governor/capae-opening.json (this session's opening brief, snapshotted 2026-08-11T20:16:32Z)"
  - "~/.mypka/governor/ding-log.jsonl (real send log)"
  - "Raw per-dispatch task-output files under .../a2725267-efa8-4c85-911a-2e4ba4cdfeb1/tasks/ (authoritative source, partially re-derived — see limitations)"
tooling_limitation: >
  This dispatch's tool grant is Read/Write/WebFetch/WebSearch/Grep/Glob only — no Bash, no git.
  Every figure below that would normally come from `git log` is explicitly marked UNESTABLISHED
  rather than estimated. Every token/timing figure below was re-derived from the raw per-dispatch
  .output files, not copied from Larry's ledger.
---

# Session performance report — BUILD-015 AsdAIr, 2026-08-11/12

## Headline verdict

Real, evidenced product progress happened this session (Cockpit backend+UI shipped to their own
branches with a genuine Vera HOLD→PASS gate; six vision-pipeline rounds each with honestly-reported
regressions and fixes; a decisive architecture pivot that measurably cut omission from ~49% to ~18%).
Alongside that, this audit found a real, material integrity gap in Larry's own self-reported ledger
(roughly 40% of its named dispatch IDs do not exist at the authoritative path he pointed me to), a
confirmed recurrence of the exact CAPAE family flagged in his own starting context
(work-order-not-generated), and a notification pattern that is sparse relative to the number of
substantive outcomes produced. None of this is "the session failed" — it is "the session's own account
of itself needs correction before it is trusted as a record," which is precisely why this report exists
independent of Larry's own narrative.

## 1. Dispatch inventory — reconciled, not copied from the ledger

**Larry's ledger claims "18 top-level Agent calls."** That number does not survive scrutiny of either
of the two sources it should be checked against:

- **Against the Wayfinder's own prose narrative** (the fuller record of what actually happened), I
  count at least **24-26 distinct top-level dispatch events** this session: two hand-authored Work
  Orders (Cockpit-BE, Cockpit-01) that were REFUSED before any code was written; their two properly
  regenerated replacements; a background Silas schema-decision dispatch; the vision-pipeline WO issued
  once Silas's decision landed; Vera's initial QA dispatch and her re-inspection; the initial
  discriminating live test to Asdair; five further Keel-round + Asdair-live-test pairs (rounds 2-6, one
  round — 6 — with no separate live re-test because Warwick's redirect landed first); the gateway
  capability-audit dispatch; the CLARIFY-refused prototype v1; the properly re-cut prototype v2; the
  first (crashed) live run of the prototype; the bug-fix round; and the final decisive live test
  (refused once, then proceeded). This is a **narrative** count, not raw telemetry, but it is Larry's
  own account and it already exceeds his ledger's "18."
- **Against the raw per-dispatch output files** at the authoritative path Larry named, I could
  independently locate and open exactly **12 of the ~21 distinct agent IDs his ledger table names**
  (some ledger rows bundle multiple IDs). Those 12 are real, and their content matches the claimed task
  in every case checked (e.g. the file named for "ASDA catalogue cross-check" genuinely contains that
  conversation, complete with photo tool_results). The other **9 named IDs — the initial Asdair
  design-critique dispatch, the Silas schema-decision dispatch, all six per-round Asdair live-test
  dispatches, and the CLARIFY-refused prototype-v1 dispatch — do not correspond to any file at the
  authoritative path**, under a direct string match or under any of several content-based searches
  (`migration 020`, `omission`, `hallucinat`, `discriminating re-test`, `Silas`, `asdair`) run across
  the full 142-file directory. This is not proof those dispatches did not happen — the Wayfinder's own
  prose independently corroborates that Silas's decision doc landed and that each live test returned
  real, specific numbers — but **their per-dispatch token/tool/timing evidence cannot be independently
  verified from the source Larry declared authoritative.** That is a materially bigger gap than the
  ledger's own self-disclosed caveat ("numeric transcription risk") admitted to: it is not imprecision
  in a number, it is unverifiability of close to half the roster.

**Verified structural facts, from the 12 real files (all timestamps UTC, from each file's own
`"timestamp"` fields — not estimated):**

| Dispatch (specialist / task) | Turns (timestamp lines) | Tool calls | Start | End | Span |
|---|---:|---:|---|---|---|
| Asdair — ASDA cross-check | 159 | 51 | 20:35:10 (8/11) | 22:01:09 (8/11) | 1h26m |
| Keel — Cockpit-BE | 263 | 93 | 22:54:09 (8/11) | 23:15:29 (8/11) | 21m |
| Felix — Cockpit-UI | 501 | 181 | 22:54:14 (8/11) | 02:53:16 (8/12) | ~3h59m (interleaved, not continuous) |
| Vera — QA gate | 396 | 144 | 02:19:03 (8/12) | 03:03:31 (8/12) | 44m |
| Keel — vision round 1 | 627 | 222 | 23:10:43 (8/11) | 02:37:42 (8/12) | ~3h27m (interleaved) |
| Keel — vision round 2 | 604 | 210 | 03:25:29 (8/12) | 04:12:44 (8/12) | 47m |
| Keel — vision round 3 | 406 | 144 | 04:39:21 (8/12) | 05:11:03 (8/12) | 32m |
| Keel — vision round 4 | 317 | 112 | 05:27:28 (8/12) | 05:51:34 (8/12) | 24m |
| Keel — vision round 5 | 285 | 100 | 06:12:43 (8/12) | 06:29:27 (8/12) | 17m |
| Keel — vision round 6 | 360 | 128 | 06:53:53 (8/12) | 07:25:00 (8/12) | 31m |
| Keel — agentic prototype v2 | 282 | 101 | **15:14:01 (8/12)** | 15:37:29 (8/12) | 23m |
| Keel — prototype protocol fix | 167 | 60 | 15:53:38 (8/12) | 16:05:40 (8/12) | 12m |
| Asdair — decisive live test | 168 | 61 | 16:06:24 (8/12) | 16:24:42 (8/12) | 18m |

**A real, load-bearing finding sits inside this table, not just in the totals**: there is an
**~7h49m dead gap between vision round 6 ending (07:25:00, 8/12) and the prototype v2 dispatch
starting (15:14:01, 8/12)**, with no dispatch of any kind in between. That gap almost certainly
represents a genuine off-session pause (overnight), not active work — it means any "elapsed session
duration" computed as first-timestamp-to-last-timestamp (~19h49m) materially overstates active time.
**Active dispatch-window time, excluding that one gap, is closer to ~11h55m** (20:09 8/11 → 07:25 8/12,
plus 15:14 → 16:24 8/12). I flag both figures rather than picking one, since neither alone is honest
without the other.

Peak measured subagent context (last observed `cache_read_input_tokens`, a lower bound on context
depth reached, sampled near end-of-file for the largest dispatches): Felix Cockpit-UI ≥306,000 tokens;
Keel vision round 1 ≥383,000 tokens; Keel vision round 6 ≥305,000 tokens; the decisive live test (much
shorter, 168 turns) ≥126,000 tokens; the ASDA cross-check (afd91d45c67ecab3b, fully traced)
reached 223,898 tokens of cache-read context by its final turn plus 165,047-191,727-token cache-creation
spikes at two internal resets. **I did not sum every `output_tokens` field across every file — that
would require reading each multi-megabyte file in full, outside this dispatch's practical budget — so
a total-subagent-output-token figure is UNESTABLISHED as an exact number.** Order-of-magnitude, given
13 dispatches each reaching 100,000-400,000+ tokens of context, aggregate subagent-side token movement
this session is in the low-to-mid single-digit millions — consistent with, not more precise than,
Larry's own order-of-magnitude estimate.

## 2. The cumulative-vs-per-dispatch question — partially resolved, not fully

The skill's own standing question (does `subagent_tokens` carry over across `SendMessage` resumes) was
tested directly against the fully-traced ASDA cross-check file. Within that single per-agent-ID output
file — which appears to record the dispatch and every subsequent resume as one continuous append-only
stream — `cache_read_input_tokens` grows smoothly across most turns (consistent with cumulative
context) but **resets to zero at two points** within the 159-turn record, each followed by a large
fresh `cache_creation_input_tokens` spike (165,047 and 191,727 tokens respectively) instead of a
continued read. **This evidence alone cannot distinguish two different explanations**: (a) a genuine
resume boundary starting a fresh context, or (b) ordinary 5-minute prompt-cache TTL expiry from elapsed
real time between turns (both resets occur at points consistent with Larry having moved to other work
in between). **Verdict: PARTIALLY ESTABLISHED.** Cumulative-within-a-continuous-turn-sequence is
observed; whether a `SendMessage` resume specifically inherits or resets context could not be cleanly
isolated from ordinary cache-TTL behaviour with the evidence available in this dispatch. This should be
re-tested with a resume performed inside the 5-minute cache window to remove the confound.

## 3. Work Order evidence, rework and refusals

**Every REFUSE/CLARIFY event found, with class and preventability:**

1. **Two hand-authored Work Orders (Cockpit-BE-shaped, Cockpit-01) — both REFUSED**, caught by the
   workers' own SOP-022 preflight, not by Larry first. Root causes: (a) neither carried the mandatory
   `tools/wo/envelope.mjs` generation marker — the exact named, MONITORING CAPAE family in Larry's own
   starting context; (b) the Cockpit order gave Keel the whole `services/cockpit/**` surface undivided,
   conflicting with Keel's own contract routing UI to Felix; (c) `isolation:"worktree"` cut the
   vision-pipeline worktree from stale `origin/main` (243+ commits behind local main by design) instead
   of local HEAD. **Class: preventable, and specifically the class Larry had already been told to watch
   for.** Fix: three worktrees manually cut from verified local HEAD; two orders regenerated via
   `envelope.mjs` and reissued.
2. **Vision-pipeline WO — held, not refused**, pending a `schema_decision` citation Larry could not
   author himself; Silas commissioned in background, decision landed, WO then properly issued. In the
   same passage Larry is recorded correcting his **own** stale migration-number reference (018 → the
   real 020) after Silas's decision — a Larry-side data error caught by a specialist, not a Work Order
   rework in the REFUSE/CLARIFY sense, but the same underlying "unverified number asserted with
   confidence" shape.
3. **Cockpit-backend WO — returned PARTIAL** on first pass: AC4 blocked because the target test file
   pinned an exact message-key shape outside Keel's declared surface; Keel correctly declined to force
   its design-correct implementation to fit rather than game the test. Fixed by Amendment 2 (surface
   widened by exactly the one file). **Class: scope-definition gap in the order, not a worker error —
   correctly self-reported rather than silently worked around.**
4. **Agentic prototype v1 — CLARIFY-refused correctly**, no code written. The worktree had been cut
   from local `main`, which does not carry the pricing-constant/cost-estimation code AC4 needed to fix
   — that code exists only on the still-unmerged `build-015/b15-24-vision-pipeline` branch. A second,
   compounding gap found in the same pass: the real capability-probe evidence lived only in a
   session-scoped ephemeral scratchpad, invisible to a fresh Keel instance. Both fixed; v2 dispatched
   from the correct branch tip with the evidence committed durably first. **Class: preventable
   (wrong git base for a worktree cut) — this is the same defect shape ("do not trust
   `isolation:"worktree"` to cut from local HEAD while local main sits ahead of origin/main") that had
   already been found and named earlier the SAME session, in the Cockpit refusals. It recurred within
   one session after being named once.**
5. **Asdair — decisive live-test dispatch initially REFUSED on a role-boundary reading**
   ("running a diagnostic script is process start, forbidden by my own contract"), directly contradicting
   seven near-identical dispatches earlier in the same session (the original cross-check, all five
   vision-round re-tests, and the prototype's first crashed run — none of which were refused on this
   ground). Resolved by Larry citing the precedent directly rather than accepting or silently rerouting;
   Asdair then proceeded. **Class: not preventable by Larry in the way the envelope-route recurrences
   were — a fresh subagent instance reading the same contract text differently from a sibling minutes
   earlier, with no memory of the precedent. The Wayfinder itself correctly flags the underlying
   contract-wording inconsistency as unfixed and capable of recurring — this is a genuine open risk, not
   closed by citing precedent once.**

**Did the worker begin substantive work on first dispatch, order by order?** For the 12 independently
verified dispatches: yes for all except the two hand-authored orders (refused before code) and prototype
v1 (refused before code) — i.e., 3 of the roughly 15 orders identifiable with a clear verdict did not
proceed on first dispatch, all three for preventable process reasons (missing envelope generation ×2,
wrong git base ×1). Cockpit-backend proceeded but returned PARTIAL rather than COMPLETE on first pass.
That gives a **first-dispatch full-success rate of roughly 11/15 (~73%)** among orders with a clear
verdict in the narrative — not the "every round COMPLETED cleanly" impression a round-by-round skim
gives.

## 4. Notification discipline (Rule 4a)

**Real send log for this session's window** (`ding-log.jsonl`, entries 179-182 — the only sends between
the prior day's last entry at 16:34 8/11 and the end of this session's confirmed activity):

| # | Timestamp (UTC) | Bytes | What it most plausibly corresponds to (by adjacency to dispatch end-times above) |
|---|---|---:|---|
| 179 | 2026-08-12T02:38:56Z | 229 | ~1 min after Keel vision round 1 finished (02:37:42) |
| 180 | 2026-08-12T03:04:58Z | 248 | ~1.5 min after Vera's final PASS resume (03:03:31) |
| 181 | 2026-08-12T05:24:39Z | 273 | Between vision round 4 ending (05:11:03) and round 5 starting (05:27:28) |
| 182 | 2026-08-12T16:25:26Z | 326 | ~1 min after the decisive live test ended (16:24:42) |

**All four sends succeeded (`exit:0`) — the FusionDevBot channel was reachable throughout this
session's window; nothing queued or failed.** That much is clean.

**What is not clean: four dings against roughly 15 orders with a clear verdict and at least two
genuinely decisive moments (Cockpit BE/UI + Vera HOLD→PASS completing around 22:54-03:03 8/11-8/12, and
the six-round vision reconciliation Warwick himself called a process failure and redirected).** The
gap between the prior day's last ding (16:34, 8/11) and the first ding of this session's substantive
work (02:38, 8/12) is over 10 hours, and it silently spans: two Work Order refusals, Cockpit-backend
COMPLETING all 5 acceptance criteria, Cockpit-UI being implemented, and Vera's first HOLD verdict —
each independently the kind of "substantive outcome he would reasonably want to know immediately" the
rule names. Only vision round 1 finishing (unremarkable relative to what preceded it) triggered the
next ding. **I cannot read the actual message bodies (not retained at this path), so I cannot rule out
that one of these four sends was a batched summary covering more than one outcome — but the byte sizes
here (229-326 bytes) are far smaller than this same log's typical entries earlier in the week
(1,000-3,700+ bytes), which is more consistent with terse status-line pings than a real batched-outcome
summary.** I flag this as a probable miss rather than a certain one, given the content-blindness.

## 5. Documentation-versus-product change volume

**Exact commit-count reconciliation is UNESTABLISHED — this dispatch's tool grant has no Bash/git
access, so `git log` could not be run.** From the Wayfinder's own narrative text alone, **13 distinct
product-code commit SHAs are named for this session's work** (Cockpit-BE `82e7618`; Cockpit-UI
`f7bf71a` then `86cfc08`; a direct Larry fix `9dd980f`; vision-pipeline capstone `3eb0dc3`; a direct
Larry CI fix `6923ad6`; vision rounds 2-6 as `4f03d4d`, `e075440`, `f442b2f`, `f8d0e1e`, `ab89d1d`;
prototype v2 `b314221`; protocol fix `f9c45a0`) — plus one dead branch head (`a222540`, explicitly
carrying zero unique commits, correctly not counted as product work. Against that, the Wayfinder
document itself grew to at least 3,370 lines and records a distinct, substantial narrative update at
essentially every one of the ~24-26 dispatch returns this session — considerably more update points
than product commits, by the document's own text. **My assessment (opinion, distinguished from the
measured fact above): given the map's own rule is to update "only at meaningful phase boundaries: PASS,
PARTIAL or FAILED, with an evidence pointer," and this session genuinely produced roughly 15-18 such
boundaries (two refusals, Cockpit BE/UI complete, Vera HOLD then PASS, six round-completions each paired
with a live-test verdict, a capability-audit landing, prototype v1 refused, prototype v2 complete, the
protocol fix, the decisive test), a correspondingly high Wayfinder-update frequency is proportionate
discipline for this session's unusually high genuine event-density — not overhead by itself.** Whether
the *actual* commit count matches that boundary count, or exceeds it with extra narrative-only commits,
is exactly the kind of thing that needs `git log`, and I will not assert a ratio I cannot measure.

## 6. Parent-channel availability

Reachable throughout this session's window per the ding log (section 4) — no queued or failed sends
recorded between 20:09 8/11 and 16:25 8/12. Two unrelated `usage-message-file-unreadable` errors appear
earlier in the week's log (08/07, 08/09) but none inside this session's window; they are a caller-side
"no message file supplied" condition, not a channel-availability defect.

## 7. CAPAE family comparisons — the six-question form, all four families named in the opening brief

**Family: `work-order-not-generated`** ("Work Order issued outside the generated envelope route")
- *What Larry was told* (opening brief, snapshotted 2026-08-11T20:16Z): 3 prior occurrences, 0 clean
  streak, 5 required to close, cause named as "the generation route is treated as exempt for orders
  that feel small... skipped at the moment of dispatch."
- *Did a qualified exposure occur this session*: **RECURRENCE.** Both hand-authored Cockpit orders
  skipped the route (section 3, item 1).
- *What Larry actually did* (evidence, not narrative): did not catch it himself; the workers' own
  SOP-022 preflight caught it first. Fixed by regenerating via `envelope.mjs` and reissuing.
- *Did the prevention hold afterward*: yes, for the remainder of the session — no further
  envelope-omission refusal appears across the subsequent ~8+ properly-issued orders (Cockpit-BE, UI,
  vision-pipeline, six vision rounds, both prototype orders).
- *Compared with the previous qualified exposure*: **UNCHANGED at best, arguably degraded** — this is
  the family's 4th recorded occurrence against the same named cause, and it happened on the FIRST
  Work Orders dispatched this session, immediately after the family was placed in Larry's own starting
  context as MONITORING.
- *Is the same error still repeating despite being in Larry's starting context*: **YES, this session,
  at the first opportunity.** The lesson held for the rest of the session only after being enforced
  externally by the worker, not by Larry's own foresight at dispatch time.

**Family: `built-tested-never-activated`** ("Built, tested, committed — and never activated")
- *What Larry was told*: 5 prior occurrences, 0 clean, 5 required, cause named as "integration is
  treated as complete at the point the code is committed and green."
- *Did a qualified exposure occur*: **CLEAN — no recurrence found.** Every completion claim this
  session is explicitly qualified: "builder self-test evidence, not independent review," "nothing here
  is merged to `main`," Cockpit BE/UI/vision/prototype all explicitly labelled "not integrated."
  Warwick's own mid-session correction ("vision pipeline: complete" was the wrong claim) was accepted
  and the record restated more precisely rather than defended.
- *What Larry actually did*: maintained the qualification consistently across every phase-boundary
  entry in the Wayfinder, including under pressure from Warwick's own correction.
- *Did the prevention hold*: yes, throughout.
- *Compared with the previous qualified exposure*: **improved / clean continuation** — this is a real
  positive finding, worth crediting explicitly rather than only reporting the negative ones.
- *Is the same error still repeating*: no evidence of it this session.

**Family: `control-cannot-reach-what-it-checks`** ("A control is measured through a surface merely
correlated with the outcome")
- *What Larry was told*: 3 prior occurrences, 3 clean already (closest of the four families to closing).
- *Did a qualified exposure occur*: **CLEAN, and the discipline actively caught a live instance of the
  underlying failure mode this session** — round 3's `wrongQuantity: 0` metric looked like an
  improvement but Asdair checked the mechanism behind it and found quantity was being asserted on only
  ~25% of lines (down from ~70-87%), i.e. the metric improved because the model stopped answering, not
  because it got better. The Wayfinder explicitly names this as "the measure-through-the-enforcing-
  mechanism discipline... working as intended."
- *What Larry actually did*: relayed Asdair's finding faithfully rather than accepting the flattering
  metric at face value; the same discipline shows in mutation-testing round 5's fix (`git stash`
  revert-and-confirm) and Asdair independently re-deriving ground truth rather than trusting a
  transcript claim.
- *Did the prevention hold*: yes.
- *Compared with the previous qualified exposure*: improved / clean continuation, now at 4 of 5 clean
  by this session's contribution if this counts as a fourth clean instance.
- *Is the same error still repeating*: no.

**Family: `record-amended-body-not-recut`** ("A record is amended and the rows it contradicts are left
standing")
- *What Larry was told*: 3 prior occurrences, 4 clean already (one clean instance from closing).
- *Did a qualified exposure occur*: **CLEAN.** Every amendment found in this session's Wayfinder tail
  properly supersedes the block it corrects with an explicit `⛔ SUPERSEDED` / `🟢 RE-CUT` marker and a
  same-place correction, exactly matching the rule quoted inside the document itself ("Supersede the
  body, or do not append the amendment").
- *What Larry actually did*: applied the pattern correctly at every correction point found (the "no
  shop pending" correction, the Cockpit-vs-vision priority correction, the migration-number correction).
- *Did the prevention hold*: yes.
- *Compared with the previous qualified exposure*: clean continuation.
- *Is the same error still repeating*: no.

**Net CAPAE picture**: 2 of 4 tracked families held clean this session (and one of those two actively
demonstrated its own value catching a live defect); 1 recurred at the first opportunity despite being
named in Larry's own starting context, with prevention only re-established externally; 1 is not
evaluable as "recurred/clean" in the same sense but shows the identical underlying defect shape
(unverified figure asserted with confidence, later corrected by a specialist) recurring in a form not
yet tracked as its own family.

## 8. Findings without an existing family

1. **Ledger ID unverifiability (this report's own finding, section 1)** — roughly 40% of the dispatch
   IDs in Larry's self-authored token ledger do not correspond to any file at the path he declared
   authoritative. This is a more serious defect than "numeric imprecision under time pressure" (the
   ledger's own stated caveat); it is closer to "the record cannot be checked" for a large minority of
   its rows. Worth a named CAPAE family of its own if it recurs: *a self-authored operational ledger
   citing IDs that do not resolve against the source declared authoritative for it.*
2. **The `isolation:"worktree"`-cuts-from-stale-origin defect recurred within one session** after being
   found and named once (Cockpit refusals → prototype v1 refusal, same root cause, same session). This
   is the pattern the `MEMORY.md` entry "Worktree isolation cuts from a STALE base" already names — it
   is not a new finding, but its *recurrence inside the very session that should have been primed
   against it* is worth flagging precisely for that reason.
3. **Asdair's contract-wording inconsistency on the role-boundary question is explicitly unfixed and
   named by the Wayfinder itself as capable of recurring** — a genuine open governance risk, correctly
   not touched this session per the hard rule against modifying any `AGENTS.md` without Warwick's
   explicit approval, but worth surfacing here rather than only in the build's own parked list.

## 9. Explicit UNESTABLISHED

- Exact total subagent-side token consumption this session (order-of-magnitude only; see section 1).
- Whether `subagent_tokens` is cumulative or per-dispatch across `SendMessage` resumes, cleanly isolated
  from ordinary cache-TTL expiry (section 2 — partially established, not fully).
- Exact documentation-commit-count vs. product-commit-count ratio (no git/Bash access this dispatch;
  section 5 gives the best available proxy from narrative text).
- The literal content of the four ding messages sent this session (section 4) — only byte sizes and
  timestamps are recoverable from the log; message bodies were not retained at the path available to
  this dispatch.
- Whether the 9 unverified ledger IDs correspond to real dispatches made via a synchronous/foreground
  mechanism that does not produce a background-task file, versus a ledger transcription error — the
  evidence available to this dispatch cannot distinguish the two explanations.
- Independent verification of the closing `main` HEAD SHA (`2d8c758`) — taken from Larry's own
  Wayfinder table, not independently confirmed via `git rev-parse` in this dispatch.
