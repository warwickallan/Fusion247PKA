# Session performance and process report — BUILD-006 Phases 1–4 built, Phases 1 and 2 merged

**Author:** Pax, independent session witness. Commissioned at `/rotate` steps 5, 5b, 5c.
**⚠️ SAME-MODEL REVIEW — independent of the session and its context, not of the model. Not externally verified.**

| | |
|---|---|
| **Branch** | `main` |
| **Closing head** | `6dd40ba4391b45d04318def8e1119fb9e1ef66cf` |
| **Session subject** | BUILD-006 VlogOps Phases 1–4 built; Phases 1 and 2 merged; BUILD-015 corrective work; the BUILD-020 Tower route restored |
| **Active map** | `Deliverables/2026-08-03-build-006-vlogops-publishing-engine-wayfinder-plan.md` |
| **Host** | claude-code **2.1.227**, model `claude-opus-5[1m]`, effort `high` — read from the sampler, not asserted |
| **Mandatory inputs used** | `Deliverables/2026-08-17-subagent-token-ledger-phase2-close.md` · `~/.mypka/governor/capae-opening.json` · `Team Knowledge/SOPs/SOP-023-tower-codex-review-packet.md` |

⛔ **PAX COULD NOT COMMIT THIS FILE OR ITS PAYLOAD.** This dispatch's tool grant is `Read · Write · Grep · Glob · WebFetch · WebSearch` — **no Bash, no PowerShell, no git binary.** Larry must commit both, then run `populate.mjs` (7b) and `capae-sync.mjs` (7c). This is the second consecutive rotation in which the session witness has been dispatched without a shell; see §12.

---

## 1. Executive summary

Three sentences, then the evidence.

**The product half of this session was the best-run in the recorded series and the delivery half was the worst.** Four VlogOps phases were built in 3h45m, each consuming the real output of the one before; seven Work Orders were issued and **7 of 7** went through the generated-envelope route with **zero refusals** — against 5-of-11 and four refusals last session; and internal assurance ran the shape `CLAUDE.md` demands, one substantive review per boundary, nine verdicts, eight PASS, one HOLD that found a real HIGH-severity privacy misstatement and produced a real fix.

**Against that: measurement discipline collapsed.** Three separate figures were measured with instruments that could not measure the property and were reported to Warwick or to Codex as fact — and the family that names that exact failure had **left Larry's opening brief**, having been graded clean twice.

**The delivery tax, measured: 1.18 tokens of assurance and evidence-staging for every 1 token of product implementation, and that is a floor, not a figure** — Codex/Tower rounds and Larry's own packet authoring are in neither number. **My verdict: the Veritas half was proportionate and the Tower/Codex packet half was not, and the second is entirely composed of the cost of not measuring.**

---

## 2. EXECUTIVE CAPAE

> **4 active risks were loaded into Larry at session start. All 4 had qualified opportunities. 3 preventions held. 1 recurred despite being in the opening brief — and it recurred inside the same paragraph in which Larry himself named it. A FIFTH family, which was NOT in the brief, recurred three times in one working day. Work Order generation improved sharply, from 5-of-11 generated to 7-of-7. Activation discipline held for a second consecutive session, and held expensively — two merged phases still carry a withheld PASS. Record reconciliation did not improve and remains repeated. Measurement discipline degraded from two consecutive cleans to three recurrences, and the warning that would have caught it had already left the brief Larry is handed at session start.**

---

## 3. The measured window — and one discrepancy stated up front

**Every timestamp below is derived from `.git/logs/refs/heads/main`, `.git/logs/refs/remotes/origin/main` and eleven branch reflogs, read directly. Unix seconds converted to UTC; the reflogs carry `+0100`.**

| | |
|---|---|
| **Opening commit** | `4135fd3cbd1e695dede2f2fdd88b7520fa9721ac` — "BUILD-006: the store fog is settled — Supabase" — **2026-08-14T21:59:55Z**. The first commit of the declared subject, 39m21s after the previous session's `close-session` commit `81a77d10` (2026-08-14T21:20:34Z) and its log `Team Knowledge/session-logs/2026/08/2026-08-14-21-00_larry_asdair-shipped…md`. |
| **Closing head** | `6dd40ba` — "BUILD-006 Phase 2 COMPLETE on main - banking for rotation" — **2026-08-17T10:07:33Z** |
| **Head at the time of writing** | `b7242f0a94f82438e0a2c40c645092e26c91d0c0` — the token-ledger commit, **2026-08-17T10:11:00Z**, 3m27s above the declared closing head |
| **Wall-clock elapsed** | **216,458 s = 3,607.6 min = 60 h 07 m 38 s** |
| **Git-observable working span** | **534.2 min (8 h 54 m 12 s)** across three segments — see below |
| **Git-silent gaps** | **3,073.4 min (51 h 13 m 26 s)** in two blocks |

**The three working segments:**

| # | Window (UTC) | Minutes | What it contains |
|---|---|---|---|
| 1 | 2026-08-14T21:59:55 → 2026-08-15T02:39:07 | **279.20** | All four VlogOps phases built (branches `b6-01`…`b6-04`); five Veritas receipts; the BUILD-015 retrospective release scope and Codex's `request_changes`; the F-1 and F-3 corrective orders; 4 automated YouTube capture commits |
| 2 | 2026-08-15T08:40:07 → 11:21:37 | **161.50** | `/reconcile` correction; the BUILD-020 Tower route named and restored; `WO-2026-08-15-06` issued, built and Gate-1 PASSed; the working tree cleared for a merge-class review. **Zero VlogOps product commits.** |
| 3 | 2026-08-17T08:34:03 → 10:07:33 | **93.50** | SOP-023 written in two commits; Phase 2 re-cut twice; three PR merges arriving; Phase 2 banked. **Zero VlogOps product commits.** |

**⚠️ 255.0 of the 534.2 measured working minutes — 47.7% — contain no VlogOps product implementation at all.** Segments 2 and 3 are entirely assurance route, evidence staging, convergence and merge mechanics. Inside segment 1 product implementation and internal assurance ran **concurrently** (Keel branch commits 22:43:20→02:28:11 interleave with Veritas receipt commits 00:27:53→02:39:07), so wall-clock cannot be apportioned there; the token ledger is the only apportionment available for segment 1.

**The gaps, honestly labelled:** 2026-08-15T02:39:07→08:40:07 (**361.00 min**) and 2026-08-15T11:21:37→2026-08-17T08:34:03 (**2,712.43 min**). Neither is asserted idle — the first contains one delivered notification at 06:26:08Z, so it was not activity-silent. The second is corroborated as genuinely quiet by an independent instrument: the sampler read at 10:17:20Z on 08-17 shows the five-hour rate-limit bucket at **3% used** and the seven-day bucket at **1%**, which a 48-hour continuously-working session could not produce.

### The one discrepancy, and why it does not change any grading

`~/.mypka/governor/capae-opening.json` carries `snapshot_at: 2026-08-15T09:38:14.549Z`. `/rotate` §5c states that file is "snapshotted by the SessionStart hook BEFORE anything can overwrite it". **That marker sits 11 h 38 m 20 s AFTER the opening commit above, and 19 minutes after `WO-2026-08-15-06` was generated (`generated_at: 2026-08-15T09:19:06.338Z`).** A SessionStart event therefore fired mid-window — a clear, compaction or restart — and no `/rotate` ran at that boundary.

**Why it does not affect the CAPAE grading:** the brief's *content* is identical either way. `capae-active.json` and `capae-opening.json` both carry `written_at: 2026-08-13T15:21:52.339Z` and byte-identical `families` arrays. The same four families, with the same counters, were in force across the whole window. **The grading is unaffected by which marker you take as the session start.**

**Why it matters anyway:** `~/.mypka/governor/session-report-populate.jsonl` line 26 is the last populate, `2026-08-13T15:21:37.490Z`. `capae-active.json` has not been rewritten since `2026-08-13T15:21:52.339Z`. There is **no session report in `Deliverables/` for any session between 2026-08-13 and this one.** The brief Larry was handed at 09:38:14Z on 08-15 was **42 h 06 m 22 s stale by content**, and by the closing head it was **90 h 45 m 41 s** old. An eight-day unbroken run of populated rotations (08-06 → 08-13) broke here.

---

## 4. Token and context economics — every figure read from an instrument

### 4.1 Context readings

| Reading | Value | Source |
|---|---|---|
| **Closing context occupancy** | **987,789 input tokens of a 1,000,000 window — 99% used, 1% remaining.** `total_output_tokens: 493` is the last refresh's figure, not a session total | `~/.mypka/governor/health/C--Fusion247PKA/0deb55dc-12c0-4c50-b8fb-8756fb3f0ecc.json`, `sampled_at: 2026-08-17T10:17:20.009Z`, `source: statusLine`, host `2.1.227` |
| **Opening context reading** | **UNESTABLISHED — and structurally unavailable.** The sampler keeps exactly one JSON per session id and overwrites it on every statusline refresh. There is no opening row to read | verified by enumerating `~/.mypka/governor/health/**` — 145 files, one per `<session-id>`, none with a history suffix |
| **Total measured context movement** | **UNESTABLISHED.** With no opening reading there is no delta. I will not estimate one | — |
| **Rate limits at close** | five-hour bucket **3%** used (resets 2026-08-17T13:00:00Z); seven-day **1%** | same sampler file |

**The binding constraint on this session was the context window, not quota.** 99% occupancy at rotation with 3% of the five-hour bucket spent is the shape of a long-lived single context, and it is why my dispatch was correctly taken off the blocking path.

### 4.2 Subagent traffic — the ledger's three totals, kept separate

**Total A — deduplicated subagent token traffic: 4,189,557.** I re-added the ledger's 24 final readings independently: Keel 2,007,503 + Veritas 1,342,210 + Explore 839,844 = **4,189,557 exactly.** Total A cross-foots.

**Total B — peak footprint per persistent agent:** the four multi-dispatch Keel instances dominate — `a7d081aa` 437,992 · `a5e2d5b2` 349,205 · `afd9e08e` 349,205 · `a449a591` 267,978. **Eight of the nine Veritas dispatches were single-dispatch**, so no reviewer accumulated a large persistent context.

**Total C — dispatch and tool counts: the ledger states 37 across 24 agents. Its own rows sum to 38.** Keel 4+3+3+2+3+3+2 = **20**; Veritas 1+1+1+1+1+1+1+2 = **9**; Explore 9×1 = **9**. 20+9+9 = **38**, and the ledger's own prose says "7 Keel instances, 20 dispatches… 9 Veritas dispatches… 9 Explore". **Total C is wrong by one and contradicts the ledger's own narrative.** Agent count (24) is correct.

**A second defect in the ledger, and it is larger.** `a5e2d5b2` (Keel WP-1, 4 dispatches, 23 tool uses) and `afd9e08e` (Keel WP-3, 3 dispatches, **1** tool use) both report **exactly 349,205** cumulative tokens. Across 24 readings spanning 45,532–437,992 there is no other collision. **A byte-identical cumulative total from two independent agents with different dispatch counts and 23-versus-1 tool uses is not credible; the most likely cause is a transcribed duplication.** If `afd9e08e`'s true figure differs, Total A is wrong by that delta, and 349,205 is **8.34% of A**. Every percentage in §5 inherits that uncertainty.

**⛔ Larry's own context is NOT in Total A and must never be added to it.** The only honest joint statement is a ratio:

> **987,789 tokens of Larry's closing context occupancy (a LEVEL) against 4,189,557 tokens of delegated subagent traffic (a FLOW) — 1 : 4.24.**

### 4.3 Burn rate

| Basis | Rate | Comparison |
|---|---|---|
| Over the **534.2-min working span** | **7,842.7 tokens/min** | previous session 4,404,873 ÷ 469.85 = 9,375 — **down 16.3%** |
| Over **3,607.6 min wall clock** | 1,161.3 tokens/min | not comparable; this session carries 51 h of git-silent time |

**38 returns at 110,251 tokens each.** Codex/Tower executions emit no usage block and are in none of it — **unmeasured, not zero.**

---

## 5. THE HEADLINE ANSWER — the delivery tax, quantified

Larry asked the unflattering question. Here it is, from evidence.

### 5.1 The classification, and every token accounted for

I classified all 24 agents. The nine read-only Explore dispatches split three ways rather than being dumped wholesale on either side.

| Class | Agents | Disp. | Tokens | % of A |
|---|---|---|---|---|
| **Product implementation** — Keel WP-1…WP-4 (1,404,380) + Explore Phase-1 preflight census 91,767, render-gate diagnosis 65,286, gateway reality 45,532 | 7 | 15 | **1,606,965** | **38.36%** |
| **Assurance + evidence staging** — Veritas ×9 (1,342,210) + Explore Codex-contract integrity 153,883, excluded-surface adjudication 120,243, lost Tower route 116,078, BUILD-015 Codex coverage 88,584, B15 release scope 75,796 | 13 | 14 | **1,896,794** | **45.27%** |
| **Corrective rework** — Keel BUILD-015 F-1 236,396 + F-3 160,437 | 2 | 5 | **396,833** | **9.47%** |
| **Convergence / admin** — Keel convergence fixes 206,290 + Explore "why /reconcile missed" 82,675 | 2 | 4 | **288,965** | **6.90%** |
| | **24** | **38** | **4,189,557** | **100.00%** |

> ### **DELIVERY TAX: 1,896,794 : 1,606,965 = 1.18 : 1.**
> **For every token spent making the product, 1.18 tokens were spent proving it and shaping the evidence.**

**⛔ 1.18 : 1 IS A FLOOR, NOT A FIGURE.** Three cost centres sit entirely on the assurance side and are in none of these numbers:

1. **Codex/Tower rounds emit no usage block** — the ledger says so itself and calls it "a material omission given how many review rounds ran". Six-plus rounds are unmeasured.
2. **Larry's own packet authoring, Work Order authorship, all 30 main commits and every rework decision ran inside his own context**, which no instrument in this estate reads as a flow.
3. **The two closed-and-re-cut PRs' authoring cost** is inside Larry's context, not a subagent's.

**A narrower cut, for the reader who wants only reviewer-versus-builder:** Veritas 1,342,210 ÷ VlogOps implementation 1,404,380 = **0.956 : 1**. Near parity.

### 5.2 A wall-clock corroboration from a different instrument

**255.0 of 534.2 git-observable working minutes — 47.7% — contain zero VlogOps product implementation.** Two independent instruments, token traffic and reflog wall clock, put the delivery share at 45.27% and 47.7%. They agree.

### 5.3 What the tax bought — and what it did not

**It bought external coverage for half of what was built.** Phase 1 (`#105`, merged at `c35e4f9`) and Phase 2 (`#112` + `#114` + `#115`, all merged, Codex-approved individually) are through the full ladder. **Phases 3 (`#109`) and 4 (`#110`) hold Veritas Gate 1 PASS — `1a6ba97` and `6c6559d` — and no Codex gate and no merge.** Half the product built this session carries none of the assurance spend.

**It did not buy a single product correction from the external gate.** SOP-023, line 9: *"Six review rounds were spent learning it and **not one criticised a line of product code.**"* That is Larry's own word, so I corroborated it from evidence he did not author:

- `build-006/b6-02-source-compiler`'s last and only commit is `86e498d` at **2026-08-15T00:12:33Z**. Its reflog records nothing after that.
- The four re-cut branches contain no authored work. `b6-02c` was **created and committed in the same Unix second** (1786958820 → 1786958820); `b6-02d` likewise (1786958835 → 1786958835); `b6-02a` took 23 s and `b6-02b` 21 s. **A commit made in the same second as its branch creation cannot contain authored product change.** They are mechanical re-splits of bytes that already existed.
- The map's own merge proof agrees: `git diff 86e498d9 origin/main -- services/vlogops` = one addition (Phase 1's `DEMONSTRATION.md`), zero modifications, zero deletions.

**Five PR objects were consumed to land one phase.** `#107` (staged 110,903 bytes) → `#112` (merged 09:25:29Z) + `#113` (measured 60,859, **closed unmerged**) → `#114` (merged 10:01:48Z) + `#115` (merged 10:05:58Z). Three branch re-cuts. **Zero product defects found.**

### 5.4 My verdict, split because the evidence splits

**The internal assurance half was PROPORTIONATE. Say so plainly, because it is the first time the series can.**

- **Nine Veritas dispatches, eight distinct scopes, five receipts, four boundaries.** WP-1 PASS (`c35e4f9`), WP-2 PASS (`86e498d`), WP-3 PASS (`1a6ba97`), WP-4 **HOLD** (`594d976`) → one **focused confirmation of D-1 only** PASS (`6c6559d`), plus `WO-2026-08-15-06` Gate 1 PASS, and the BUILD-015 F-1 and F-3 gates.
- **ZERO re-reviews of a receipt. Zero reviews of a head whose delta was a previous verdict.** Contrast the 4B incident on disk: `Deliverables/2026-08-07-veritas-gate1-subphase-4b-*` is **ten receipts on one boundary**. Sub-phase 4B was 57.7% of a working phase, eleven verdicts, zero PASS, zero product change after verdict #1. This session: 32.04% of delegated traffic, nine verdicts, eight PASS, and the one HOLD produced product change.
- **The HOLD was real and HIGH.** D-1: `DEMONSTRATION-PHASE4.md:217` stated in bold *"The finding names the rule, the length and a masked shape — **never the value.**"* — three lines above its own counterexample, where the FACT dimension wrote the planted phone number verbatim into `verification_finding.detail`/`evidence` and into `verification_run.manifest`, in tables that **refuse DELETE and UPDATE**, in a public repository. The test that should have caught it scoped its assertion to `where rule like 'PRIV-4%'` — narrower than its own name. Veritas proportioned it correctly (the planted values are Ofcom drama-range fakes, so nothing for Warwick to act on), named the sufficient correction, and gated only the WP-4 completion claim and `#110`.
- The commit messages record reviewer quality independently: *"a reviewer that disbelieved the claim instead of ticking it"* (`f0b1a16`), *"a reviewer that reproduced the artefact rather than reading it"* (`ed07d1d`).
- **The external gate also earned its keep — on BUILD-015, not VlogOps.** `2fffcef`: *"Codex retrospective verdict on BUILD-015: request_changes, and it found a real defect."* That produced F-1 and F-3, 396,833 tokens of corrective work, and both landed before the real Tuesday shop.

**The Tower/Codex packet-staging half was NOT PROPORTIONATE, and it is the entire avoidable tax.** Six-plus rounds, five PR objects, three branch re-cuts, two PRs closed unmerged, zero product defects found — and **the proximate cause of both closures was a measurement, not a review.** #107 was reported clear on a file count. #113 was reported at 57,146 bytes by an instrument that undercounts; the true figure was 60,859, 859 over the cap, and **Codex approved a packet with ~1.4% invisible to it on Larry's assurance that it was complete.** That is not the cost of external review. It is the cost of not measuring, twice in one day, and it is why SOP-023 exists.

**One redeeming structural fact, and it is not small.** The six rounds bought a written procedure. SOP-023 is 101 lines, names the byte-accurate instruments, names the four recorded structural defects and Warwick's ruling not to fix them during BUILD-006, and is pointed at from the Wayfinder's status table with a ⛔ READ BEFORE ANY `@tower` COMMENT row. **A one-time learning cost that is now durable is a different thing from a recurring tax — provided the next PR proves it. That proof does not exist yet.**

---

## 6. CAPAE — the six questions, per family, by name

**Graded against `~/.mypka/governor/capae-opening.json` (`snapshot_at 2026-08-15T09:38:14.549Z`), never against `capae-active.json`. Vocabulary: `clean` · `recurrence` · `none-this-session` · `unmeasurable-at-this-frequency`. There is no fifth word.**

### 6.1 `work-order-not-generated` — occurrences 5, clean 0 of 5, MONITORING

1. **Told:** *"The generation route is treated as exempt for orders that feel small, amendment-shaped, or urgent. The control exists, is known, and is skipped at the moment of dispatch."* Must: *"Generate the envelope, read it back, then issue. No exemption for small or amendment-shaped orders."*
2. **Exposure: `clean`.**
3. **Evidence, not assertion.** Seven numbered Work Orders were issued in the window and **7 of 7 exist as committed files carrying `<!-- GENERATED by tools/wo/envelope.mjs — DO NOT HAND-AUTHOR THIS FILE.` at line 1** — `2026-08-14-wo-b6-01-content-seed-store.md`, `2026-08-15-wo-b15-f1-shop-household-ownership.md`, `-wo-b6-02-source-compiler.md`, `-wo-b15-f3-render-gate-anchor.md`, `-wo-b6-03-scribe.md`, `-wo-b6-04-verification.md`, `-wo-canonical-ding-and-crlf-check.md`. Each carries `generated_at`, a `governance_head` marked `(verified: commit exists)`, and blob SHAs of the four canonical sources read. **The ledger holds seven Keel agent IDs; there are seven committed generated orders. 1:1 — no Keel dispatch ran without one.** I looked for the previous session's tell (an order that exists as a dispatch but not as a file) and found none.
4. **Prevention held: yes** — including in the exact case the cause names. `WO-2026-08-15-06` is amendment-shaped and urgent, and it was generated (`generated_at: 2026-08-15T09:19:06.338Z`) and then amended *inside* the generated file rather than re-hand-authored.
5. **vs previous exposure: `improved`.** Previous: 5 of 11 generated, four refusals, and the family broke 22m22s after being graded clean. This: 7 of 7, zero refusals.
6. **Still repeating despite the brief: NO.** This is the clearest single improvement in the report.

### 6.2 `built-tested-never-activated` — occurrences 6, clean 1 of 5, MONITORING

1. **Told:** *"Integration is treated as complete at the point the code is committed and green. The activation surface is a separate step nobody owns."* Must: *"Do not report an integration done until the thing it was built to do has actually happened once."*
2. **Exposure: `clean`.**
3. **Evidence.** The Wayfinder's own status row, at line 98: *"**001, 002 have never reached the managed Supabase project. Merging applied nothing. Phase PASS is withheld on that ground for both phases — this is capability proven on disposable clusters, not the human outcome.**"* Two phases merged and Codex-approved, and the phase-PASS claim refused. Corroborated by a source Larry did not author — Veritas WP-4 receipt N3: *"Migration 004 has never been applied to the managed Supabase project, exactly as 001–003 have not… **it is a hard bar on any phase-PASS or readiness claim**"* — and the same receipt's audit: *"the Wayfinder Phase 4 row reads 'IMPLEMENTED — awaiting assurance'… Phases 1–3 rows each name their receipt and each withholds phase PASS for the Supabase reason. **No unbacked completion claim found.**"*
   **The second instance, and it cuts the other way until you read the map.** `WO-2026-08-15-06` closed two live defects, Veritas Gate 1 PASSed at `6c5efba`, and **is not merged**. I verified by reading the working tree at the closing head that **both defects are still live on `main`**: `services/hub/youtube/watch-captures.mjs:78` and `services/hub/youtube/ensure-youtube-watcher.mjs:164` still spawn `['--env-file=…','C:/.fusion247/larry-ding.mjs',tmp]`, and `tools/governor/convergence-runtime-check.ps1:98-100` still compares raw `Get-FileHash` with no line-ending normalisation. **That is non-activation — but it is NAMED and PARKED**, on the map at line 97 (*"#111 convergence fixes likewise parked. Warwick ruled their non-containment does NOT block BUILD-006"*) and in the Veritas receipt (`PR #111 OPEN at headRefOid 58ddce38`). Named-and-parked is the bar; silence is not, and there is no silence here.
4. **Prevention held: yes**, and at cost to Larry's own claim.
5. **vs previous: `unchanged`** — the previous exposure was also clean. **Two consecutive cleans.**
6. **Still repeating: NO.**

### 6.3 `record-amended-body-not-recut` — occurrences 5, clean 0 of 5, MONITORING

1. **Told:** *"Amendment-by-append with no reconciliation step. Writing the amendment feels like completing the change, so the rows describing the phase are never revisited."* Must: *"Supersede the body, or do not append the amendment."*
2. **Exposure: `recurrence`.**
3. **Evidence — and it happened in the session's FIRST Work Order.** `bc0e5c5` (2026-08-14T22:30:40Z) "BUILD-006 WP-1 Amendment 1" amended the frontmatter's `network` field to `npm-registry-only + github.com`. **The generated envelope table at the foot of the same file continued to read `npm-registry-only`.** Keel hit the contradiction **mid-implementation**. Larry re-cut it at `915b15c` (23:02:47Z) — **32 m 07 s later** — in a commit whose message is the confession: *"WO-2026-08-14-01: re-cut the envelope row Amendment 1 left contradicting the frontmatter."* The repaired row now reads, in his words: *"**RE-CUT BY AMENDMENT 1, 2026-08-14 — this row previously read `npm-registry-only` and contradicted the amended frontmatter. Keel found it mid-implementation and proceeded on the frontmatter, which is what its contract requires. The defect was Larry's: the frontmatter was amended and the row it contradicted was left standing.**"*
   **⚠️ AGGRAVATING, and it is the sharpest instance this loop has produced.** In the *same* Amendment 1, adjudicating finding M1, Larry wrote: *"the Wayfinder's §6 F3 corrected by measurement in the same change — **an amendment that left the body standing would be the exact CAPAE family on watch.**"* He named the family, applied it correctly to the map, and shipped it in the envelope table of the document where he named it.
   **Counter-evidence, and it is real:** exactly ONE occurrence is evidenced in the window. Every map amendment in this session supersedes in place rather than appending — line 38 (*"superseded 2026-08-15. The reconciliation below is HISTORY, kept for provenance"*), line 90 (a next-action row struck through and marked *"SUPERSEDED 2026-08-15 by the row above"*), line 102 (*"This line read 'has not begun' until 2026-08-15; it was true when written and is superseded by execution"*). The discipline works on the map and failed on the generated envelope table, which is a *second rendering of the same fields* and is where nobody looks.
4. **Prevention held: no.**
5. **vs previous: `unchanged`.** Previous: one occurrence, **self**-detected, repaired in 6 m 13 s. This: one occurrence, **worker**-detected, repaired in 32 m 07 s. Detection moved off Larry and the repair took five times longer, which argues for `degraded`; on one data point each I will not claim a trend.
6. **⚠️ Still repeating despite being in Larry's starting context: YES — and beyond that, despite being in the same paragraph he wrote.** If any family justifies a change, it is this one, and the change is narrow: **an amendment to a generated Work Order must re-run `tools/wo/envelope.mjs` rather than hand-edit the frontmatter above a stale table.** That is a call on an existing route, not a new mechanism.

### 6.4 `acceptance-proves-mechanism-not-outcome` — occurrences 2, clean 0 of 5, MONITORING

1. **Told:** *"Acceptance is authored against the implementation that exists rather than against the outcome that was promised, so the easiest available evidence is the one collected."* Must: *"State what was PROVEN, not what it implies. Name the scope of the verdict beside it."*
2. **Exposure: `clean` — and this is the single most reversible grading in this report.**
3. **Evidence.** Four phase-PASS claims withheld in writing for the precise reason the family names (§6.2). The WP-4 receipt's ⛔ limit block is the `must` executed to an exemplary standard: *"**The planted defects and the detectors were designed by the same hand, and no language model was ever called.**… A PASS on the made-to-fail criteria therefore means: the verifier catches the classes it encodes, and has been made to fail on each of them. It does **NOT** mean the verifier would catch a real model's subtler falsehoods. Nothing in this receipt is evidence about real-world verification quality… **The builder states this limit himself, in the demonstration and in the README, and states it well.**"* And the Phase-2 merge claim is stated as a measured outcome rather than an implication: *"one addition, zero modifications, zero deletions — every Phase-2 byte is on `main` unaltered."*
   **⚠️ THE REVERSAL CASE, stated in full because Warwick may take it.** **D-1 is this family's failure mode in its purest form** — a bold sentence asserting a delivered privacy guarantee three lines above its own counterexample, with the guarding test scoped narrower than its own name. Acceptance proved the mechanism (the privacy dimension masks) and not the promised outcome (no dimension records the value). **I grade `clean` because the defect was authored by the builder, caught by the internal gate before merge, corrected at `6c6559d`, and the false claim never reached `main`** — the prevention working through the ladder rather than failing. **Warwick can reasonably reverse this to `recurrence` on D-1's grounds alone, and if he does, the report's headline changes from "3 held, 1 recurred" to "2 held, 2 recurred".**
4. **Prevention held: yes at Larry's layer; no at the authoring layer, and the gate caught it.**
5. **vs previous: `improved`.**
6. **Still repeating: partially, at the specialist authoring layer, and it was caught before merge.**

### 6.5 ⚠️ `control-cannot-reach-what-it-checks` — **NOT IN THE OPENING BRIEF**

1. **What Larry was told: NOTHING.** This slug is registered — it appears as a `family` in every rotation payload from `2026-08-08-session-report-payload-4d-close.json` through `2026-08-13-session-report-asdair-finishing-payload.json`, and was graded `clean` at each of the last two rotations. **It is absent from `capae-opening.json`.**
2. **Exposure: `recurrence` — three volunteered instances and a fourth I found.**
3. **Evidence. All four are measurements taken with an instrument that could not reach the property, reported to a third party as fact.**
   **(a) The CRLF hash boundary.** `WO-2026-08-15-06` §`capability_evidence`, Larry's own words: *"The installed governor at `~/.mypka/governor/` is CONTENT-IDENTICAL to canonical `tools/governor/` in ALL TEN .mjs modules — proven by normalising CRLF to LF on both sides. **Raw hashes lie in BOTH directions: installed vs working tree falsely differs on 7 of 10; installed vs git blob falsely differs on 2 of 10** (continuity, reorient — installed from the working tree)."* §PART B: *"**Larry hit this and reported a false convergence finding to Warwick on the strength of it.**"*
   **The prevention was already written down, in the directory he hashed.** `~/.mypka/governor/INSTALLED-FROM.txt` line 10: *"core.autocrlf=true with no root .gitattributes means the blob holds LF and the working tree holds CRLF, so a copy from the working tree differs by exactly the line count and **fails byte-identity 8 for 8**."* The 2026-08-06 install measured this hazard on this exact directory and recorded it in the file that sits beside the modules.
   **(b) `Measure-Object -Character` on PR #113.** SOP-023 §2: *"**⛔ USE A BYTE-ACCURATE INSTRUMENT. `wc -c` or `Buffer.byteLength` — NEVER PowerShell's `Measure-Object -Character`, which undercounts**… `Measure-Object -Character` reported #113 at 57,146. The true size was **60,859** — 859 over the cap. **Codex approved a packet with ~1.4% invisible to it, on Larry's assurance that it was complete.** The PR was closed unmerged and re-cut."*
   **(c) A file count read as a byte count on PR #107.** SOP-023 §2: *"#107 showed '12 files, +2,150' in the PR view and Larry reported the truncation solved. The real staged diff was **110,903 bytes** — still nearly double the cap. The claim was withdrawn mid-review. **A file count is not a byte count.**"* SOP-023's own summary of the day: *"**Two wrong instruments in one day, both reported as fact.**"*
   **(d) A FOURTH instance, at Larry's own layer, not volunteered — found by reading the source.** `tools/governor/permission-invariant.mjs` is registered as a `SessionStart` hook (`.claude/settings.json:114`). Its `MUST_NOT_PROMPT` probe list (lines 38–50) holds eleven entries and **every one is a bare single command**: `Bash(git status)`, `git diff`, `git log`, `git add`, `git commit`, `git push`, `git worktree`, `node`, `npm`, `python`, `bash`. **Neither shape that actually prompted Warwick three times this session is in it** — a command opening with `cd`, and a multi-line here-string. Corroborated: there is **no `ask` rule anywhere** (`C:/ProgramData/ClaudeCode/managed-settings.json` carries `deny` only, 19 entries; `.claude/settings.local.json` has `"ask": []`), so the cause was prefix-match failure on command **shape** — exactly the property the probe list does not test. **The invariant prints "PERMISSION INVARIANT: HOLDS" while the failure it exists to prevent is happening.** This is the second consecutive report to find a blind spot in this same file; the previous one was `permissions.ask` in `settings.local.json`.
4. **Prevention held: no, four times.**
5. **vs previous: `degraded`** — two consecutive cleans, then three-plus recurrences inside one working day.
6. **Still repeating despite being in Larry's starting context: NO — and that is the finding.** It was **not** in his starting context. **The brief handed to him named four families and omitted the one that recurred three times that day.** `capae-sync.mjs` will accept this slug and append a `RECURRENCE`, which by its own design *"reopens the family without needing a special case: the streak resets to zero, the family drops out of EFFECTIVE, and `selectActive` picks it back up for Larry's attention."* **That is the correct mechanical outcome and it should be allowed to happen.**

---

## 7. Findings

### F1 · `control-cannot-reach-what-it-checks` — RECURRENCE ×4, and the warning had left the brief

Fully evidenced at §6.5. Load-bearing consequences: a false convergence finding delivered to Warwick; an external reviewer approving a packet 1.4% of which it could not see; a PR closed unmerged; and an active `SessionStart` control that passes while its subject fails. **Prevention, and it is one line in three places rather than a mechanism: a figure that decides a gate is measured with the instrument that enforces the gate, and cross-checked against a second instrument before it is stated to Warwick or to Codex.** SOP-023 §2 already carries it for the byte cap; nothing carries it for hashes or for the permission probe list.

### F2 · `record-amended-body-not-recut` — RECURRENCE, named and then committed in the same document

Fully evidenced at §6.3. **The one narrow prevention worth Warwick's attention in this report:** an amendment to a generated Work Order re-runs `tools/wo/envelope.mjs`; it never hand-edits the frontmatter above a stale generated table. Existing route, existing script, no new mechanism.

### F3 · `built-tested-never-activated` — CLEAN, and it held expensively

Fully evidenced at §6.2. Two merged, Codex-approved phases still carry a withheld PASS because migrations 001–004 have never reached the managed Supabase project. **This is the family working, and it costs Larry the claim he would most like to make.** Record it as the second consecutive clean.

### F4 · `work-order-not-generated` — CLEAN, 7 of 7, zero refusals

Fully evidenced at §6.1. From 5-of-11 and four refusals to 7-of-7 and zero, in one session.

### F5 · `acceptance-proves-mechanism-not-outcome` — CLEAN, reversible on D-1

Fully evidenced at §6.4. **The reversal condition is stated so Warwick can take it without re-reading the receipt.**

### F6 · PROPOSED FAMILY — `mandated-outcome-names-no-invocation`

**No slug emitted.** The BUILD-020 Tower route was mandated by `CLAUDE.md` and idle for ten days because nothing named the lever. `CLAUDE.md:254`, established 2026-08-15: *"**The BUILD-020 Tower route was never broken. It was never called.**… the watcher runs from a byte-identical install (23 of 23 modules), polls every 60s with write-back on, and its Telegram credentials are provably loaded — yet **38,113 log lines contain zero review events**, because **nobody had posted the trigger since 2026-08-05.** The cause was documentary: `@tower head`, `@tower checkpoint` and `merge-check.mjs` appeared **nowhere** in this file, `AGENTS.md`, `.claude/` or `Team/`. **This clause mandated the gate and never named the lever.**"* And the consequence, `CLAUDE.md:274`: *"**no PR merged to `main` between 2026-08-09 and 2026-08-15, while 107 commits of executable change and four migrations reached it — and the estate was reported reconciled. Codex was working the whole time; nothing ever asked it.**"*
**Why this is not `built-tested-never-activated`:** that family's prevention — *do not report an integration done until the thing has happened once* — would not have prevented this. The route **had** happened, repeatedly, and then went dark across rotations because the invocation lived only in a context that got cleared. **Prevention: an instruction that mandates an outcome names, in the same file, the exact invocation that delivers it.** Fixed this session at `b83f450` and `dbb1c67`; the durable fix is `CLAUDE.md` §THE TWO INVOCATIONS plus SOP-023.

### F7 · PROPOSED FAMILY — `session-closed-without-rotation-so-no-evidence`

**No slug emitted.** `session-report-populate.jsonl`'s last entry is `2026-08-13T15:21:37.490Z`; `capae-active.json`'s `written_at` is `2026-08-13T15:21:52.339Z`; `Deliverables/` holds no session report between 2026-08-13 and this one, though a `close-session` log exists for 2026-08-14. **Two session boundaries passed without `/rotate` steps 5–8**, so the brief handed to Larry at 09:38:14Z on 08-15 was 42 h stale and an eight-day unbroken run of populated rotations broke. **Distinct from `capae-brief-snapshot-taken-before-sync`** (proposed 2026-08-13), whose cause is snapshot ordering *inside* `/rotate`; here `/rotate` did not run at all. ⚠️ **This may not be a Larry defect** — `/rotate` is Warwick-invoked, and a session closed by `/close-session` alone legitimately produces no report. **Reported for Warwick's decision on whether he wants the evidence stream to be unbroken; not recommended as a Work Order.**

### F8 · PROPOSED FAMILY — `brief-selection-hides-why-a-family-is-absent`

**No slug emitted, and this is the cheapest item here to fix.** `tools/governor/capae-brief.mjs:47-50`: `selectActive` filters `f.state !== 'EFFECTIVE'` **and caps at `limit = 4`**. The opening brief carries exactly four families. `control-cannot-reach-what-it-checks` is absent, and **two structurally different mechanisms could explain it and the reader cannot tell which**:
- it reached `EFFECTIVE` — the 2026-08-13 report graded it a fifth consecutive clean against `required: 5` and flagged it as *"a threshold call for capae-sync and Warwick"* — and was filtered out; **or**
- it remained `MONITORING` and was **crowded out by the hard cap of 4**, since `weight` ranks primarily on `occurrences` and the fourth listed family (`acceptance-proves-mechanism-not-outcome`) sits at only 2.
**I cannot distinguish them: no database access in this grant.** The distinguishing query is one line — `select slug, state, occurrences, clean, required from session_report.capae_family order by state, occurrences desc;`. **Either way the consequence is the same and it is the finding.** If the cause is graduation, the graduation threshold is falsified by this session and the family reopens correctly. If the cause is the cap, the brief is silently truncating Larry's warnings and that is a defect in the brief. **Prevention: the brief states how many families exist and how many it is showing.** One line in `capae-brief.mjs`, not a mechanism.

### F9 · PROPOSED FAMILY — `rotation-close-cannot-name-its-own-closing-head`

**RE-PROPOSED UNCHANGED from the 2026-08-13 report, deliberately reusing the slug, because the same prevention addresses both.** It recurred: the declared closing head is `6dd40ba` (2026-08-17T10:07:33Z) and `main` already stood at `b7242f0` (10:11:00Z) when I began — **+1 commit**, and committing this report and its payload will make it **+2**, the identical drift the previous two rotations recorded. The mechanism is structural, not carelessness: commits necessarily follow the block. **Prevention: the block states the head it was written at and stops calling it "closing", or the final commit amends it.** A template change.

### F10 · The subagent ledger's own defects — reported, no family minted

Two independent defects in a mandatory input (§4.2): **Total C states 37 dispatches where the rows sum to 38 and the ledger's own prose says 20+9+9**; and **two different agent IDs report the byte-identical cumulative total 349,205, which is 8.34% of Total A and is most likely a transcribed duplication.** Total A itself cross-foots exactly. **I am deliberately not minting a family for this.** The regrowth cap applies to families as much as to mechanisms, and one honest sentence covers it: *cross-foot a hand-transcribed artefact against its own prose and look for repeated values before publishing it.* The 2026-08-13 ledger was cross-footed; this one was cross-footed on A and not on C.

### F11 · A duplicate Work Order ID — clerical, non-blocking, park

`work_order_id: WO-2026-08-14-01` appears in **two different order files**: `Deliverables/2026-08-14-wo-b15-52-display-name-ui.md` (`status: draft`, footer *"1 field(s) UNRESOLVED. This envelope is INCOMPLETE"*) and `Deliverables/2026-08-14-wo-b6-01-content-seed-store.md` (`status: issued`, BUILD-006 WP-1). Both were live on 2026-08-14. **A Work Order id that names two orders makes the receipt trail ambiguous.** Nothing turned on it this session. **Hobby-brain: record, park, no Work Order.**

### F12 · A methodology self-catch, recorded because it is the same lesson

While reading `permission-invariant.mjs` through `Grep`, the tool's rendering returned line 103 as `\ A rule…` and line 104 as `r.replace(:\*\)$/, …)` — a broken comment and a malformed regex literal, which would have produced a "the SessionStart hook cannot parse" finding. **Reading the file directly showed both lines are correct.** A rendering is not the source. I would have shipped a false HIGH finding on a proxy measurement, in the report whose headline finding is proxy measurement.

---

## 8. Work Order evidence

**Seven numbered orders, all generated, all committed.** Read-back outcome established from the committed order files.

| # | Order | Package | Generated | Read-back outcome | First dispatch substantive |
|---|---|---|---|---|---|
| 1 | `WO-2026-08-14-01` | BUILD-006 WP-1 Content Seed store | ✅ | **CLARIFY → AMENDMENT 1.** Six items raised; four UPHELD as real defects (C1 authority contradiction, C2 an AC fighting two others, M1 **a false fact in the order**, M2 a missing AC the map named), one acknowledged, one clerical and parked. Larry: *"All are Larry's, none are Keel's, and holding rather than guessing was the correct call on every one."* | **No** |
| 2 | `WO-2026-08-15-01` | BUILD-015 F-1 shop/household ownership | ✅ | no amendment recorded | **Yes** |
| 3 | `WO-2026-08-15-02` | BUILD-006 WP-2 Source Compiler | ✅ | no amendment recorded | **Yes** |
| 4 | `WO-2026-08-15-03` | BUILD-015 F-3 render-gate anchor | ✅ | no amendment recorded | **Yes** |
| 5 | `WO-2026-08-15-04` | BUILD-006 WP-3 Scribe | ✅ | no amendment recorded | **Yes** |
| 6 | `WO-2026-08-15-05` | BUILD-006 WP-4 Verification | ✅ | no amendment recorded | **Yes** |
| 7 | `WO-2026-08-15-06` | canonical ding callers + CRLF checker | ✅ | **AMENDED AT READ-BACK.** AC1 read *"The env-file argument stays"*; the read-back proved it contradicted `CLAUDE.md` Rule 4a and was actively harmful — *"`node --env-file=<missing> script.mjs` exits **9 before the script runs**, so a missing env file kills the child with no accounting line, defeating the load-bearing half of `ding.mjs`. Without the flag the same case exits **2 and writes a durable record**."* Measured twice independently, by the builder and by Veritas. | **No** |

**Totals: 7 orders · 5 first-dispatch substantive (71.4%) · 2 amended · 0 REFUSED ON SIGHT.**

**⚠️ This is a CEILING on first-dispatch success, not a measurement.** It is established from committed order files; a read-back finding resolved conversationally without amending the order is invisible to me. Larry's own instruction inside `WO-2026-08-15-04` says *"four of my last five orders had a real defect the worker caught here"*, which is consistent with the two recorded amendments plus prior-session orders, and does not contradict the table.

**Comparison, on the same denominator the previous report used (distinct work packages):** previous 3 of 8 clean (37.5%), 4 REFUSED. This session **5 of 7 (71.4%), 0 REFUSED.** Order quality roughly doubled.

**Preventable-failure analysis — both amendments were preventable, by the same act.**
- **#1's M1 was a false fact stated in an order** — a claim that August carried no session logs, falsified by Larry himself after the read-back (`git ls-tree` at `4135fd3` → 16 logs). It cost a CLARIFY round-trip and a Wayfinder §6 F3 correction. The prevention is the previously proposed family `order-premise-not-verified`: **a fact a worker is bound to is verified by execution at the moment the order is written, or labelled unverified inside it.**
- **#7's AC1 contradicted a higher authority quoted verbatim in `CLAUDE.md`.** Preventable by reading Rule 4a, which was already open in Larry's own constitution.
- **Both are the same act: check the premise before binding a worker to it.** Neither is a new mechanism.

**Not covered by any order: nine read-only Explore dispatches (839,844 tokens, 20.05% of A).** That is a legitimate route for read-only investigation, and it means **24% of dispatches carry no order artefact and therefore no read-back gate.** Non-blocking observation; the estate has never required orders for read-only work.

**Larry's volunteered claim that he stopped an authorised, in-flight Keel dispatch on a stale instruction: UNESTABLISHED.** I searched every `.md` in the repository for the incident and found only prior, dated occurrences (`2026-08-10-02-45_larry_the-night-shift…md:101` — *"I stopped a worker mid-run believing it had stalled"*, and `Deliverables/2026-08-10-wo-b15-06-…md:174`). **Nothing in Git records an in-session occurrence.** If it happened it exists only in the transcript, which I cannot read. **A self-reported failure with no durable record is exactly the evidence that dies at `/clear`** — Larry should record it before this rotation completes.

---

## 9. Parent channel — availability, latency, queued messages

**Instrument: `~/.mypka/governor/ding-log.jsonl`, entries 210–213. It records timestamp, outcome, exit code, `message_id` and byte count. It never records message bodies.**

| `message_id` | UTC | Bytes | Outcome | Nearest commit |
|---|---|---|---|---|
| 534 | 2026-08-14T18:10:58Z | 1,926 | sent, exit 0 | **before the window opened** |
| 538 | 2026-08-14T23:01:34Z | 1,814 | sent, exit 0 | `44be2c4` 22:59:19Z, +2 m 15 s ("BUILD-006 inherits the current assurance route") |
| 542 | 2026-08-14T23:33:26Z | 1,635 | sent, exit 0 | `7b9f242` 23:30:03Z, +3 m 23 s ("BUILD-015 retrospective release scope") |
| 549 | 2026-08-15T06:26:08Z | 1,289 | sent, exit 0 | no commit within 3 h 47 m before or 2 h 14 m after |

**Established:** channel **available** — three sends inside the window, all exit 0, zero `telegram-rejected`, zero transport failures. **Queued messages: 0** (`ding.mjs` has no queue; every invocation logs a terminal outcome). **Send rate 3 in 3,607.6 min = 0.05/hour**, against 0.64/hour last session and 1.29/hour the session before.

**⚠️ THE FINDING: ZERO NOTIFICATIONS IN THE FINAL 51 h 41 m 25 s OF THE SESSION**, from 2026-08-15T06:26:08Z to the closing head. Inside that silence, each of these matches a **written criterion** in Rule 4a by shape:

- **WP-4 Gate 1 HOLD** (`21bb0a0`, 2026-08-15T02:31:14Z) and its **PASS** (`5696166`, 02:39:07Z) — gate verdicts. *(These precede 549, so 549 may have carried them; its content is UNESTABLISHED.)*
- **The BUILD-020 Tower route restored** after ten days idle (`b83f450`, 08-15T08:42:28Z) — a recovery.
- **`WO-2026-08-15-06` Gate 1 PASS** (`6c5efba`, 10:21:25Z) — a gate verdict.
- **Four PR merges** — `#105`, `#112`, `#114`, `#115`, arriving on `origin/main` at 08-17T08:34:23Z, 09:25:29Z, 10:01:48Z and 10:05:58Z — **merges are named explicitly in the criteria.**
- **Three Codex approvals** on `#112`/`#114`/`#115` — gate verdicts.
- **PR #113 closed unmerged after Codex approved a packet it could not fully see** — a significant failure.

**Under a literal reading, at least four sends were owed and none was made.**

**THE QUALIFIER THAT WOULD REVERSE THIS GRADE, and it is strong.** Warwick was **demonstrably live**: he demanded three times that Larry stop asking permission for routine execution, and SOP-023 attributes two rulings to *"Warwick, 2026-08-17"* — the merge-on-approval ruling in §7 and *"record them, keep building, do not turn any of these into a side quest"* in §Recorded structural defects. If he was reading the chat at those moments, **the chat update was the delivery and no send was owed.** Supporting but not conclusive: `message_id` gaps 534→538, 538→542, 542→549 imply **12 intervening messages** in that Telegram chat from something other than `ding.mjs` — consistent with an active two-way conversation, but I cannot establish who sent them. **UNESTABLISHED.**

**A separate, unmitigated finding.** `CLAUDE.md` Rule 4a: *"At orientation, confirm the notification path is available. If it is unavailable, say so immediately."* **The path was last exercised at 2026-08-15T06:26:08Z and was never exercised again in the remaining 51 h 41 m — including the entire 08-17 stretch in which four merges landed.** Availability across that stretch is **UNESTABLISHED**, and an unexercised path cannot satisfy a confirmation requirement. **Response latency: UNESTABLISHED** — the ding log records deliveries, never replies.

**Credit where the record carries it: no send for routine progress narration was found.** Three sends in a sixty-hour window is not over-notification, and the previously recorded failure mode (*"NEVER ding just to check in"*) did not occur.

---

## 10. Documentation versus product change volume — the complete session range

**⛔ Every line count, files-changed and `--stat` figure in this section is UNESTABLISHED.** No Bash and no git binary in this grant. `.git/logs` carries SHAs, messages and timestamps and no diff content. **Commit classification below is derived from commit messages — a primary artefact, but the author's own words about his own work.**

### On `main` (reflog `refs/heads/main` lines 486–516, 31 ref updates)

| Class | Count |
|---|---|
| Record · map · governance · SOP | **14** — `4135fd3`, `44be2c4`, `cc00e6c`, `7b9f242`, `2fffcef`, `e590eec`, `528d3c3`, `b41aad2`, `dbb1c67`, `b83f450`, `8de0bfb`, `4546bd7`, `75cf00f`, `6dd40ba` |
| Assurance receipts | **6** — `9f67e84`, `f0b1a16`, `ed07d1d`, `21bb0a0`, `5696166`, `6c5efba` |
| Work Order artefacts | **4** — `143c1aa`, `bc0e5c5`, `915b15c`, `018f17a` |
| Automated YouTube capture commits | **4** — `aea6f64`, `174bbdc`, `dff6a71`, `64e9656` |
| Evidence staging / admin | **1** — `01262c8` "Clear the working tree so the estate inventory a merge-class review reads is empty" |
| Merge commit created by `git pull` | **1** — `dd9d573` |
| Fast-forward (not a new commit) | **1** — `1960af0` |

**Product-bearing commits on `main`: ZERO.** Not one of the 30 new commits names product code. All VlogOps product reached `main` through GitHub PR merges, visible in `refs/remotes/origin/main` as one `pull` fast-forward (entry 229, `a65a894`) and three `fetch -q` fast-forwards (entries 232–234, `c3732a9`, `2890901`, `1960af0`). **`01262c8` is the one commit whose content I cannot infer from its message; it may have carried arbitrary tracked changes. UNESTABLISHED.**

### On branches

| Branch | Content-bearing commits | Note |
|---|---|---|
| `build-006/b6-01-content-seed-store` | **4** (`d55965a`, `ae318a0`, `71d9627`, `640dde5`) + 2 merges of `origin/main` | Phase 1 |
| `build-006/b6-02-source-compiler` | **1** (`86e498d`) | Phase 2 |
| `build-006/b6-03-scribe` | **1** (`1a6ba97`) | Phase 3 |
| `build-006/b6-04-verification` | **2** (`594d976`, `6c6559d`) | Phase 4 + the D-1 fix |
| `build-015/f1-shop-household-ownership` | **2** (`f3e6ae4`, `ffefd19`) | Codex F-1 corrective |
| `build-015/f3-render-gate-anchor` | **1** (`fc40aad`) | Codex F-3 corrective |
| `build-020/canonical-ding-and-crlf-check` | **2** (`5e92b2d`, `58ddce3`) | PR #111, **unmerged and parked** |
| `build-006/b6-02a` · `b6-02b` · `b6-02c` · `b6-02d` | **0 content-bearing** (4 commits, all mechanical re-splits) | three of four committed in the same Unix second as their branch creation |

**Ratios.** Non-product commits on `main` **30 : 13** content-bearing product commits on branches = **2.31 : 1**. Excluding the four automated captures, Larry-authored record commits **26 : 13 = 2.00 : 1**. Previous session, whole-session basis: 1.7 : 1 — **modestly worse.** On `main` alone the ratio is 30 : 0, which is by design and should not be quoted as a defect: `main` is where the record lives and the product arrives by PR merge.

**Four phases were built in 3 h 44 m 51 s** — `d55965a` 2026-08-14T22:43:20Z to `594d976` 2026-08-15T01:48:36Z, plus the D-1 fix at `6c6559d` 02:28:11Z. **The four branches are STACKED, each cut from the previous phase's head**, so each phase genuinely consumed the real output of the one before, which the map claims and the reflogs confirm: `b6-02` created from `850de13` (a `b6-01` commit), `b6-03` from `86e498d`, `b6-04` from `1a6ba97`.

---

## 11. UNESTABLISHED — the complete list

1. **Every line count, files-changed and `--stat` figure.** No Bash and no git binary in this grant.
2. **Opening context reading, and therefore total context movement.** The sampler keeps one overwritten JSON per session id; there is no opening row. **The `/rotate` mandate asks for a number the instrument architecturally cannot produce.**
3. **The bodies of all three delivered notifications.** The ding log records bytes and outcomes, never content — so whether `message_id` 549 carried the WP-4 verdicts cannot be established.
4. **Whether Warwick was live in the chat at each qualifying moment.** This is the single fact that would overturn §9's owed-and-not-sent finding. No transcript access.
5. **Channel availability across the final 51 h 41 m 25 s.** Never exercised, so never confirmed.
6. **Codex/Tower token cost.** No usage block. **Unmeasured, not zero**, and it is entirely on the assurance side of the delivery-tax ratio.
7. **The exact number of Tower review rounds.** "Six-plus" is Larry's figure in SOP-023 and the Wayfinder — both author-written. Independently corroborated only in its *consequence* (no product byte changed).
8. **Whether `control-cannot-reach-what-it-checks` is `EFFECTIVE` or was crowded out by `selectActive`'s `limit = 4`.** No database access. One SQL line settles it (§F8).
9. **The true value of `afd9e08e`'s cumulative tokens**, and therefore whether Total A is 4,189,557 or something up to 8.34% different.
10. **Whether Larry stopped an in-flight Keel dispatch on a stale instruction.** Volunteered, and no durable record of an in-session occurrence exists.
11. **Whether the two prompting shapes (`cd`-prefixed, multi-line here-string) are now genuinely covered.** `Bash(cd:*)` is present at `.claude/settings.json:66` and commit `528d3c3` records the here-string remedy, but whether the host's matcher covers a compound command is host behaviour I cannot exercise. **Capability recorded; activation UNESTABLISHED.**
12. **Which commit added `Bash(cd:*)`.** No diff capability.
13. **Independent verification of the ledger's per-agent figures.** Larry-transcribed; Total A cross-foots, Total C does not, and no tool reproduced any row.
14. **Whether a read-back raised findings on orders 2–6 that were resolved without amending the file.** §8's 71.4% is therefore a ceiling.
15. **`01262c8`'s content.**

---

## 12. Methodology, and its limits

**What I read, in order.** `Team/Pax - Researcher/AGENTS.md` and root `AGENTS.md` · the three mandatory inputs · `.claude/commands/rotate.md` for the grading contract · `tools/session-report/populate.mjs` and `capae-sync.mjs` and `tools/governor/capae-brief.mjs` for the payload shape and the brief's selection rule · `.git/logs/refs/heads/main` (lines 400–518) and `.git/logs/refs/remotes/origin/main` (lines 195–237) and eleven branch reflogs for the timeline · `~/.mypka/governor/{capae-opening,capae-active}.json`, `ding-log.jsonl`, `session-report-populate.jsonl`, `INSTALLED-FROM.txt`, `health/C--Fusion247PKA/0deb55dc….json` for instrument readings · the BUILD-006 Wayfinder · nine Work Order files · five Veritas receipts under `Builds/BUILD-006-…/Assurance/` · `tools/governor/convergence-runtime-check.ps1` and `permission-invariant.mjs` and `.claude/settings.json` and `C:/ProgramData/ClaudeCode/managed-settings.json` as sources, not as descriptions.

**Cross-source discipline.** Every load-bearing claim above rests on at least two independent sources, and the ones that do not are labelled. Specifically: I did **not** accept Larry's four volunteered self-criticisms on trust. The CRLF false positive is corroborated by his order *and* by `INSTALLED-FROM.txt`'s independent 2026-08-06 measurement of the same hazard on the same directory. His admission that the estate's checker *would not* have reproduced the 7-of-10 result is **confirmed by reading the checker**: `Test-DerivedFromMain` requires a `services/` subtree (line 88) which `~/.mypka/governor/` does not have; the classifier only reaches a directory via a live `node.exe` whose entry script resolves there (line 107); and `Resolve-CodeRoot`'s relative-path fallback searches `C:\Fusion247PKA`, `C:\.fusion247\private\careerair`, `C:\.fusion247` and `C:\.fusion247\private\*` — **never `~/.mypka`** (lines 52–62). His statement to Warwick that the checker would have reproduced the false positive was wrong, and it was wrong for a reason he did not state: the checker never examines that directory at all.

**Corrections to the commission, which is Larry's own account of himself.** Two, both small, and one in his favour:
- *"the BUILD-020 Tower route… idle since 2026-08-05"* — **supported.** `CLAUDE.md:254` records exactly that, with 38,113 log lines and zero review events. I had initially doubted it against the separate 2026-08-09→2026-08-15 no-PR-merged figure; both are true and they measure different things.
- *"Six-plus Tower review rounds… NOT ONE criticised a line of VlogOps implementation"* — **the round count is single-source and author-written; the substance is independently corroborated** by the branch reflogs (§5.3). State it as *"no Tower round changed a byte of Phase 2 product content, established from reflog timing"* rather than as a count.

**⚠️ The limit that bounds this whole report, and it is now recurrent.** This is the **second consecutive rotation** in which the session witness has been dispatched with **no shell and no git binary**. Everything in §10 that Warwick would most want — lines changed, files touched, real diff volume — is unavailable for the second time running, and the fix is one word in the dispatch's tool grant. **`Bash` in the Pax grant would convert five UNESTABLISHED rows into measurements.**

---

## 13. Recommendations — evidence and options, never a decision

1. **Run the one-line query** in §F8 and settle whether `control-cannot-reach-what-it-checks` graduated or was truncated out of the brief. If truncated, the brief has been silently withholding warnings; if graduated, the threshold is falsified by this session. **Either answer changes what the brief is for.**
2. **Add `Bash` to the Pax rotation dispatch.** Two consecutive reports have gone out with documentation-versus-product volume unmeasurable.
3. **The one narrow prevention worth adopting (§F2):** an amendment to a generated Work Order re-runs `tools/wo/envelope.mjs`. Existing script, existing route.
4. **Decide the reversal at §6.4.** If D-1 grades `acceptance-proves-mechanism-not-outcome` as a recurrence, the CAPAE headline changes. It is a judgement about whether a defect caught by the internal gate counts against the family, and it is Warwick's, not mine.
5. **Phases 3 and 4 are the open question the tax makes urgent.** `#109` and `#110` hold Veritas Gate 1 PASS and no external gate. SOP-023 exists precisely so the next two are cheap. **Whether the next PR is cheap is the only test of whether the six rounds were an investment or a loss, and it has not been run.**
6. **Record the stopped-Keel-dispatch incident in Git before this rotation completes** (§8). A self-reported failure with no durable record dies at `/clear`.
7. **Not recommended as Work Orders:** F7, F8, F9, F10, F11. All are records, template lines or parked items. **No finding in this report meets the `BLOCKS_CURRENT_MERGE` bar, and none of it justifies building anything.**

---

*Pax. Cross-source verified where possible; single-source claims flagged in place; nothing estimated.*
