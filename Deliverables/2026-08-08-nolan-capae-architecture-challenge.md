# CAPAE — ADVERSARIAL ARCHITECTURE AND OPERATING-METHOD CHALLENGE

**Nolan · 2026-08-08 · `main` @ `ecabfd2` · read-only throughout. No git write, no implementation, no file change outside this document. `private_surface: none` — honoured; `C:\.fusion247\**` was never touched.**

**Commission:** ONE pass, ≤ ~120k tokens, evaluate-not-redesign, independent conclusions. **Baseline for comparison: my own `Deliverables/2026-08-08-nolan-capae-governance-review.md`.**

> **⚠️ DISCLOSED CONTAMINATION.** A repo-wide grep for `exposures_required` late in this pass surfaced `Deliverables/2026-08-08-pax-capae-implementation-evaluation.md`, which I had not been shown and did not seek. **Every finding below had already been established by execution before that file appeared in my output** — the uncalled snapshot (reorient grep), the fixture row (live brief read), the dead `effectiveness` field (source comparison), and the absent `exposures_required` writer (a grep that returned no writers). I did not read Pax's document to form conclusions and I have not adopted any of it. **Where we agree, that is convergence, not copying — and it should raise rather than lower confidence.** Stating it because concealing it would be the same family this mechanism exists to count.

---

## 0. THE VERDICT, FIRST

> ### **The mechanism is sound. The record is empty.**
>
> **4D built the pipe carefully, correctly and small — and never poured anything durable into it.**

**The Anti-Star did NOT happen, and that is the most important result in this review.** CAPAE has not become a governance system Warwick must administer. Established by execution:

| Surface | CAPAE footprint |
|---|---|
| `CLAUDE.md` operating law | **ZERO** (one incidental mention at line 153, a parked security item) |
| Root `AGENTS.md` | **ZERO** |
| `Team/agent-index.md` | **ZERO** |
| Every `Team/**/AGENTS.md` | **ZERO** — no new specialist, no standing trigger, no contract clause |
| New slash commands | **ZERO** |
| New document classes / registers / trackers | **ZERO** |

**No new authority. No new role. No new command. No new law. Two steps appended to an existing command, one script, one 271-byte JSON file, two tables, one Cockpit page.** Measured against the Anti-Star, this is a pass and it is not a narrow one.

**But Warwick's Star has two halves and neither is met at `ecabfd2`:**

- **Half 1 — "getting the right prior learning into a fresh Larry's context": NOT MET.** The live brief that every session start receives contains one family: **slug `ff-01`, title `"Pilot family"`, `cause: null`, `must: null`** — verbatim the unit-test fixture from `tools/session-report/capae-sync.test.mjs:72`. The six real families exist only as prose in a Deliverable.
- **Half 2 — "later measuring whether that learning made any difference": STRUCTURALLY UNREACHABLE.** `exposures_required` has no writer anywhere in the estate, and with it `null` the state machine can never leave `MONITORING`.

**Two closure defects, one shared fix. Everything else in this document is hygiene, and I say so explicitly where I was tempted otherwise.**

---

## 1. HAS CAPAE REMAINED THE SMALLEST MECHANISM CAPABLE OF ACHIEVING THE STAR?

**No — but most of the excess is justified, and I was wrong about part of it.**

**Measured footprint:** `capae-sync.mjs` 338 lines · `capae-brief.mjs` 160 · `services/cockpit/capae.mjs` 364 · `schema.sql` +113 (2 tables, 24 columns, 5 check constraints, 4 indexes) · 2 rotate steps · 1 precomputed JSON file. Against my original recommendation of **"one `family` string inside the existing `findings` jsonb; effectiveness = the count; no new table."**

**Where the growth EARNED its place — and where my original recommendation was simply wrong:**

> **A count puts no learning into anyone's context.** My R-2/R-3 gave the cause and the required behaviour nowhere to live. `rotation.findings` is per-rotation; family-level text cannot live there. **`capae_family` is the carrier of Star half 1 and my recommendation had no equivalent. I withdraw that half of my own recommendation.**

Also earned, and better than what I proposed:

- **`deriveFamily` derives counters from occurrence rows rather than incrementing** (`capae-sync.mjs:104–141`). Replay safety becomes structural rather than defensive. Better than my design.
- **No default in the exposure vocabulary** (`capae-sync.mjs:53–58`, and the comment above it). A typo cannot become a `RECURRENCE`. The error runs in the safe direction.
- **The render is a MEASUREMENT INSTRUCTION, not an exhortation** (`capae-brief.mjs:126–134`, closing line 158). This is the single best design decision in the phase and it is the direct application of the estate's own finding that the textual-remedy class is exhausted.

**Where it did NOT stay smallest — roughly 150 of ~860 new lines are apparatus ahead of content:**

| Excess | Lines | Verdict |
|---|---|---|
| The opening-brief comparison arm (`capae-brief.mjs:81–113` + `reorient.mjs:53`) | 35 | **Never called. Never installed. Delete.** (§9) |
| Cockpit executive layer (`capae.mjs:249–364`) | ~115 | Well-built presentation for a record holding one placeholder row |
| A 5-state machine of which **1 state is reachable** | — | `EFFECTIVE`, `CHALLENGED`, `INEFFECTIVE` are all unproducible (§ D-2) |
| `capae_occurrence` as a second home for data already in `rotation.findings` | 1 table | Duplicated state (§2) |

**Net:** smallest in *governance*, not smallest in *code*. Given the Anti-Star is about administration rather than lines, that is the right trade — but the dead arm and the unreachable states are not a trade, they are debt.

---

## 2. HAVE WE ACCIDENTALLY CREATED ANY OF THE SIX?

| Hazard | Verdict | Evidence |
|---|---|---|
| **Another authority system** | 🟢 **NO — emphatically** | Zero CAPAE in `CLAUDE.md` law, root `AGENTS.md`, `agent-index.md`, any `Team/**` contract. The render's own first line: *"Recall and measurement only, **ZERO authority**"* (`capae-brief.mjs:139`). `reorient.mjs:1096–1099` fails open — absent/unreadable/malformed yields `''`. **CAPAE is not among the seven `SAFE TO CLEAR` conditions** (`rotate.md:103–111`). Nothing anywhere blocks on it. |
| **Another reporting bureaucracy** | 🟡 **PARTIAL RISK, not realised** | No new report, no new command, no new specialist, no register anybody maintains. But `mapFamily` (`capae.mjs:131–164`) exposes 18 fields including `rca_status`, `rca_confidence`, `cause_detection_escape`, `preventive_action`, `latest_correction`, `evidence_refs` and full per-family `history`. **That is an audit console sitting under the attention layer.** Today it renders one placeholder row. |
| **A governance feedback loop** | 🟢 **NO** | CAPAE-about-CAPAE was explicitly **refused as a family** (decision brief line 139). The one candidate loop — the opening-brief comparison — was never wired (§9). |
| **Duplicated state** | 🔴 **YES** | See below. |
| **Token-heavy startup context** | 🟢 **NO — measured** | §6. |
| **Rules whose only purpose is maintaining other rules** | 🟢 **Borderline-clean** | `rotate.md` step 6b's family-identity rule (*"two events share a family iff the same prevention would have addressed both"*) is a rule about naming records — but it prevents the merge-unrelated-causes error and is three sentences. It earns its place. |

### 🔴 The duplicated state, and the sentence that is now false

**`rotate.md` step 6b states, of the mechanism it introduces:**

> *"The occurrence count is a QUERY over `session_report.rotation.findings` — **not a register anybody maintains, and not a new table**."*

**Step 7c, immediately below it, invokes a writer that maintains two new tables with cached derived aggregate columns.** Every occurrence is now stored twice: verbatim in `rotation.findings` (`populate.mjs`), and again as a `capae_occurrence` row with `occurrences` / `exposures_clean` / `state` cached onto `capae_family`.

**Nothing reconciles the two.** A finding whose slug is unknown, or whose exposure word is not vocabulary, stays in `rotation.findings` and never reaches `capae_*` (`capae-sync.mjs:247`, `252–255`). The Cockpit reads only `capae_*`, so it under-reports by construction. The divergence is *loud at rotation time* (exit 3, `capae-sync.mjs:325–335`) — which is good — but it is permanent thereafter.

**Family↔occurrence consistency is genuinely guaranteed** (derived, never incremented). **`rotation.findings`↔`capae_occurrence` consistency is not guaranteed by anything.** Step 6b's sentence should be re-cut to describe what was built, or the duplication removed. **Not a closure defect.**

---

## 3. DOES IT PRESERVE INDEPENDENT LARRY JUDGEMENT, OR OVER-PRESCRIBE?

🟢 **PRESERVED. This is the design's strongest property and it should be defended against any future "improvement".**

- **The content class is right.** `capae-brief.mjs:126–134` states the reasoning explicitly: the estate has already ruled the exhortation class exhausted (a correction *"correct, present, canonical, already on main, and already duplicated into Larry's own contract — and the behaviour still regressed within the same session, minutes later"*). **So the brief tells Larry what would COUNT as a qualified exposure, not what to do.** That inversion is the difference between prior learning and another MUST-DO line.
- **The only prescriptive text is one `MUST:` line per family**, and it comes from the record, not from operating law — so it is evidence Warwick can change by editing a row, not a rule requiring a constitutional amendment.
- **Closing line 158 carries its own anti-bloat clause:** *"Do not manufacture work to create one."*
- **The two hooks classify nothing and send nothing.** `notify-reminder.mjs:9–16` and `idle-ding-check.mjs:15–19` both enumerate what they refuse to do; `shouldRemind` (`idle-ding-check.mjs:78–80`) is a two-term comparison over an observable event, and the mute is *"a fact, not a judgement"*. **No model is invoked; the cost is zero tokens.** Correct under Rule 4a's *"No classifier decides significance. No hook sends anything."*
- **`capae-sync.mjs` refuses to create a family** (`:11–13`, `:245–247`): *"naming a new family is a judgement about cause, and a judgement is not a script."* **Exactly the right boundary, and it is the reason for closure defect D-1 — which makes D-1 an omission, not a design error.**

**One honest smell, not a defect:** `idle-ding-check.mjs:36–41`'s `REMINDER` is 60 words of restated criteria injected at every idle moment where no ding has gone out. Rule 4a is canonical in `CLAUDE.md` and says *"this file MUST NOT restate the criteria, only point at the moment"* — which `notify-reminder.mjs:6` honours and `idle-ding-check.mjs` partially does not. **A duplicate that will drift. Record once; not blocking.**

---

## 4. IS THE BOUNDARY CORRECT — PRIOR LEARNING IN, NO COMPLIANCE FORCING?

🟢 **YES. Verified by execution, not by reading the intent.**

There is **no gate, no blocker, no verdict, no counter that stops anything**:
- not in the seven `SAFE TO CLEAR` conditions (`rotate.md:103–111`);
- not in `reorient.mjs` (fails open, and **silent when there is nothing actionable** — `:1092–1099`);
- not in any hook (neither hook can block; both exit 0 unconditionally);
- not in `CLAUDE.md`, which never mentions it.

**The one place compliance IS forced is `capae-sync.mjs` exit 3 on an unknown slug or unreadable exposure. That forces correctness of the RECORD, not of Larry's behaviour, and it fails loudly rather than silently.** Correct.

**The boundary is drawn where Warwick drew it.** No caveat.

---

## 5. IS SUPABASE OPERATIONAL MEMORY, OR A SECOND NARRATIVE SSOT?

🟡 **Operational memory in FORM. But it has become the SOLE home of the content, which is a different and more serious problem than the one the question anticipates.**

**Not a narrative SSOT — that boundary holds.** `schema.sql:3–4`: *"Markdown under `Deliverables/` remains the human-readable durable report. Supabase is a queryable mirror, not a second SSOT."* The columns carry counters, states, slugs and one-line strings, not narrative. The rotation report remains the human record. Good.

**But line 4's own claim is now false for `capae_family`.** A mirror has an upstream. **`capae_family` has none.**

`capae-sync.mjs` PATCHes exactly the four derived keys plus `updated_at` (`:286–289`). **No code anywhere writes `title`, `root_cause`, `required_larry_behaviour`, `preventive_action`, `cause_class`, `rca_status`, `exposures_required` or `is_pilot`.** Repo-wide grep returns no seed, no insert, no migration, no documented command.

> ### 🔴 And the file records the identical failure having already happened once, for these very tables.
>
> `schema.sql:127–129`: *"**BANKED 2026-08-08, Buzz defect 2.** These two tables were created directly against the live database and never written down, so the CAPAE datastore could not be reconstructed from Git."*
>
> **The DDL was banked. The ROWS were not. The same defect, one level down, in the same file, in the same session.** This is `FF-05 built-tested-never-activated` and `FF-04 control-cannot-reach-what-it-checks` recurring inside the mechanism built to count them.

Against the estate's DURABLE bar — *"works if Larry finds the right old checkout is NOT durable"* — **the entirety of CAPAE's learning content currently exists only in a live database, with no Git-durable source and no re-runnable way to restore it.**

---

## 6. IS THE ACTIVE BRIEF TINY ENOUGH FOR EVERY SESSION START?

🟢 **YES — comfortably. Measured by executing the real renderer against the real file, not estimated.**

| Case | Chars | ~Tokens |
|---|---|---|
| **Live today** (1 family) | 310 | **~78** |
| **Worst case** (4 families, full title + cause + MUST) | 1,448 | **~362** |

`selectActive` is hard-capped at `limit = 4` (`capae-brief.mjs:47`), so **362 tokens is a ceiling, not an average.** For scale, that is roughly 0.04 % of a 1M context and a small fraction of `MEMORY.md`, which is auto-injected on every dispatch anyway.

**The design decisions behind that number are right and worth naming:**
- **Precomputed and read from disk, never queried at hook time** (`capae-brief.mjs:7–15`) — no network on the orientation path, one failure mode, and the computation sits at `/rotate` where the evidence already is.
- **Returns `''` when nothing is actionable** — *"no actionable CAPAE state means no CAPAE noise."* No line saying there is no line.
- **A brief older than 14 days says its own age** (`:143–149`) rather than presenting stale content as current.

**Cost is emphatically not the problem. Content is.** 78 tokens of `"Pilot family / null / null"` is cheap and worthless; 362 tokens of real causes and required behaviours would be cheap and valuable. **The token budget is not what is stopping Star half 1.**

> **One cosmetic collision:** `renderActiveBrief:139` opens with `⟦GOV⟧`, retired 2026-08-05. This is `SessionStart` `additionalContext`, not the message stream, so it is **not** a breach of the retirement — but it reuses a marker the constitution retired, and a future reader will have to work that out. Rename or drop. **Trivial.**

---

## 7. DOES A RECURRENCE REOPEN LEARNING WITHOUT STOPPING UNRELATED WORK?

🟡 **The design is correct and proven by test. It is unreachable in production.**

**Correct by construction** (`capae-sync.mjs:116–140`): a failure disposition resets `streak = 0` and, if the family had reached `EFFECTIVE`, sets `challenged`. `selectActive:49` excludes only `EFFECTIVE`, so a reset family **re-enters Larry's brief automatically**. The schema comment states it exactly: *"A recurrence resets it to 0, which is how a family that was `EFFECTIVE` returns to Larry's active brief."* **No workflow, no reopen ceremony, no rule — arithmetic.** This is precisely what I recommended and it was implemented better than I specified.

**And it stops nothing.** A recurrence produces a row and a line in a JSON file. It creates no Work Order, blocks no route, gates no closure, and interrupts nobody. Correct.

**But it can never fire.** Reopening requires a family to have been `EFFECTIVE`; `EFFECTIVE` requires `exposures_required > 0`; **nothing writes `exposures_required`** (§ D-2). So `reachedEffective` is permanently `false`, `challenged` is permanently `false`, and every family sits in `MONITORING` for ever.

**Consequence beyond the state machine:** the brief's stated *"the list should naturally rotate"* property (`capae-brief.mjs:36–41`) is **false as built** — nothing ever leaves the list, so the 4-family cap becomes a permanent 4 oldest-by-weight rather than a rotating window.

---

## 8. IS THE COCKPIT AN ATTENTION SURFACE OR AN AUDIT CONSOLE?

🟡 **Attention surface on top; audit console underneath; one placeholder row inside.**

**Genuinely attention-shaped, and the instincts are right:**
- `capaeOverview` (`capae.mjs:313–354`) answers four at-a-glance questions without Warwick opening anything.
- **`STATE_PRESENTATION` carries a word AND a mark, never colour alone** (`:263–269`) — *"a red chip is invisible to a colourblind reader and meaningless in a screenshot."* That is real product thinking.
- `whyThisMatters` (`:277–280`) is one line from the record, in priority order, `null` when the record has none.
- `effectivenessLine` (`:117–128`) **refuses to render progress no exposure supports** — `0/5` reports *"NOT YET MEASURED"*, never *"on track"*. Exactly the epistemic bar Warwick set.
- Everything is **derived from data already mapped**, asserted by `capae-check.mjs` without a browser.

**Where it tips into audit console:** `mapFamily` returns 18 fields plus the complete occurrence `history` per family. `rca_status`, `rca_confidence`, `cause_detection_escape`, `latest_correction`, `evidence_refs` are audit fields. **None of them has a writer** (§5), so today every one renders `null` or `{}`.

**Two surfaces both labelled "Larry's Active Brief" render different content.** `capae.mjs:184–192` claims the divergence was closed by sharing `selectActive` — and the **selection** is shared. The **projection** is not: the Cockpit shows `effectivenessLine()` prose while Larry's actual brief shows the bare state (§ F-E). The file's own stated invariant — *"A surface that says it shows what Larry sees must not compute its own answer"* — is half-met. **Non-blocking.**

---

## 9. DOES THE PAX OPENING-BRIEF COMPARISON STRENGTHEN LEARNING, OR RISK RECURSIVE ADMINISTRATION?

🔴 **Neither, currently — it does not exist. It is 35 lines of code that have never executed, and my recommendation is to DELETE it rather than wire it.**

**Four independent proofs it has never run:**

1. **`snapshotOpeningBrief` is imported at `reorient.mjs:53` and called nowhere.** Repo-wide grep finds one definition and one import.
2. **`readOpeningBrief` has no caller anywhere in the estate.**
3. **`~/.mypka/governor/capae-opening.json` does not exist on disk.**
4. **The installed governor predates the block entirely** — `~/.mypka/governor/capae-brief.mjs` contains **zero** occurrences of `snapshotOpeningBrief`, and the installed `reorient.mjs:53` imports `{ readBrief, renderActiveBrief }` only.

**And `/rotate` never mentions it.** The consumer half — Pax comparing the opening brief against observed behaviour — is not in step 5, 6, 6b, 7b or 7c.

> **This is `FF-05 built-tested-never-activated` committed inside the mechanism built to count `FF-05`.** The file's own comment (`capae-brief.mjs:83–93`) is a careful, correct argument for why the snapshot must exist — *"Pax would have been comparing behaviour against a brief that did not exist when the behaviour happened"* — and the argument was written, committed, and never connected to anything.

**Why I would delete rather than wire it, on the merits:**

- **The recursion risk is real.** "Compare what Larry was told at hour zero against what Larry did" is a judgement about Larry's conduct in a session — which is *exactly* what Pax already performs at `rotate.md` step 5 (*"preventable-failure analysis"*). A second, mechanised comparison arm produces a second finding stream about the same session, and a finding about whether CAPAE's own brief worked is **CAPAE-about-CAPAE by another name** — the loop the decision brief explicitly refused (line 139).
- **The exposure word already carries the whole signal.** `clean` / `recurrence` / `none-this-session` / `unmeasurable-at-this-frequency` **is** the answer to "did the prevention hold?" A diff of two JSON files cannot produce a better answer than the human judgement the vocabulary already requires — it can only produce a second, weaker one that then needs reconciling.
- **The stated problem is real but has a cheaper fix.** The brief is rewritten at each rotation, so the opening content is lost. **The rotation report already records the findings; naming the families Larry was briefed on is one line in the report Pax already writes.** No snapshot file, no second store, no comparison code.

**Recommendation: delete `capae-brief.mjs:81–113` and the unused import at `reorient.mjs:53`. 35 lines. Nothing depends on them.** If Warwick wants the comparison, it belongs in Pax's prose, not in a file pair.

---

## 10. MY INITIAL POSITIONS, CLASSIFIED

| # | What I said on 2026-08-08 | Now | Evidence |
|---|---|---|---|
| **G-1** | Do not create CAPAE as a named process, role assignment or sub-phase-sized programme | 🟢 **IMPROVED — and I was partly wrong** | The governance footprint I predicted **did not materialise**: zero new roles, agents, shims, commands, contracts or operating law. It *did* become a sub-phase with two tables and a Cockpit page — more than I recommended — but the Anti-Star I was defending against was avoided. **My prediction of bureaucratic growth was not borne out and I record that against myself.** |
| **G-2** | Split OCCURRENCE / DETECTION / ESCAPE; adopt the null-remedy rule | 🟢 **IMPROVED — the best-implemented recommendation** | `cause_detection_escape jsonb` (`schema.sql:146`) carries the split as a first-class field. **FF-06 is recorded with "NO PREVENTION, DELIBERATELY" and exposure `unmeasurable-at-this-frequency`** — the null-remedy rule made *structural* via the vocabulary rather than stated as prose. `capae.mjs:118` refuses to open a counter that cannot advance. **This is the anti-bloat engine working as designed.** |
| **G-3** | `gh pr merge` → `ask`, mutation-tested | 🔴 **UNCHANGED / ENTRENCHED — but correctly handled** | `permissions.ask` gained **four** `git push …main` entries (real progress on the adjacent act; deny holds 12 force/delete variants). But `Bash(gh pr *)` and `Bash(git merge *)` remain on **ALLOW**, and **no deny or ask rule anywhere matches `merge`**. The exact act of the PR #98 breach is still ungated. Decision brief line 135 records this knowingly: *"NOT DONE: outside the authority Warwick granted, and he has closed the permission thread."* **That is the right governance answer. The risk stands; it is not 4D's to close.** |
| **G-4** | Build no second injection surface | 🟡 **NEW RISK CREATED — small, and cheaper than I feared** | A second surface exists (`capae-active.json` → SessionStart). At 78 tokens, silent-when-empty, fail-open, it costs almost nothing. **But it currently competes with `MEMORY.md` and loses badly:** `MEMORY.md` carries ~50 curated real lessons; `capae-active.json` carries `"Pilot family / null / null"`. **Two surfaces, one a placeholder — which is the confusion I warned about, arriving by a smaller door than I expected.** |
| **G-5** | Outcome A = one branch-set in one existing function | 🟢 **IMPROVED / DELIVERED** | Decision brief §3 records it implemented, tested (116/116), installed and byte-verified; three absences render distinctly. **Not independently re-verified by me this pass** — outside this commission's scope and ceiling. |
| **R-1** | One clause in `Team/Pax - Researcher/AGENTS.md` recording rotation standing | 🔴 **UNCHANGED** | **Zero CAPAE text in `Team/`.** Pax's standing for the rotation report — now expanded by steps 6b and 7c — still exists only in `rotate.md`, a surface that does not appear in the precedence order at all. **The drift I flagged is live and slightly wider than before. Non-blocking.** |
| **R-2 / R-3** | One `family` string in the existing `findings` jsonb; effectiveness = the count; **no new table** | 🟡 **ENTRENCHED AGAINST — and I withdraw half of it** | Two tables shipped. **`capae_family` is justified and my recommendation was wrong**: a count alone puts no *learning* into Larry's context, and I gave the cause and required-behaviour text nowhere to live. Star half 1 needs that table. **`capae_occurrence` is the half I would still question** — it duplicates `rotation.findings` (§2). |
| **R-6a** | Repair `/rotate` steps 6 and 12 (`SAFE TO CLEAR` coupling) | 🟢 **IMPROVED — done, and done well** | Step 6 re-cut verbatim (*"Pax is NOT on the blocking path"*), with the old wording quoted and the reasoning recorded. Step 12's second condition struck through and replaced with **named-and-outstanding**. Step 13 makes a missing report Larry's to fix, not a handback. **Exactly the C-4 repair, better argued than I argued it.** |
| **R-6b** | Repair `/close-session` step 7 — PROPOSE, not promote | 🔴 **UNCHANGED — and now self-contradictory** | Line 89 still reads ***"Promote each into the smallest correct canonical location"***, while line 152 now carries *"it may not promote a lesson into operating law."* **The same command now instructs and forbids the same act, on the same page.** Live conflict, unrepaired, and **CAPAE feeds exactly this surface.** Non-blocking for 4D; owed regardless. |
| **§3.4** | One doctrine sentence + the quote-vs-inference format rule | 🟢 **IMPROVED** | Both landed in `CLAUDE.md` § Wayfinder Amendments — the *"⛔ WHAT WARWICK SAID IS QUOTED"* block and the *"AN AMENDMENT THAT CHANGES A PHASE'S STATE…"* block — plus `close-session.md:152`. |
| **§2.2(iv)** | Delete the standing Nolan trigger | 🟢 **IMPROVED** | Zero CAPAE in `Team/`. No standing Nolan trigger was ever created. |

**Score: 6 IMPROVED · 3 UNCHANGED/ENTRENCHED · 1 NEW RISK · 1 withdrawn by me.**

---

## 11. WHAT TO REMOVE OR SIMPLIFY BEFORE 4D CLOSES

**Ordered by confidence. Items 1–3 are pure deletions of code that cannot execute.**

1. **DELETE the opening-brief arm** — `capae-brief.mjs:81–113` (33 lines) + the unused import at `reorient.mjs:53`. Never called, never installed, never referenced by `/rotate`. §9.
2. **DELETE or fix the `effectiveness` field** — `capae-brief.mjs:69` maps `f.effectiveness`, a column that **does not exist** in `capae_family` (the real column is `effectiveness_note`) and which the sync's own SELECT (`:296`) does not fetch. **Always `null`, proven in the live file.** Meanwhile `selectActive`'s query *does* fetch `exposures_clean` and `exposures_required` and `buildBrief` **drops both** — so the `2/5` fraction Warwick's own example brief shows is **unrenderable as built**. Either drop the field or carry the two numbers it already has.
3. **DELETE `INEFFECTIVE` from the Cockpit, or make `deriveFamily` produce it.** `deriveFamily` emits only `MONITORING` / `EFFECTIVE` / `CHALLENGED` / `UNMEASURABLE`. `INEFFECTIVE` is consumed at `capae.mjs:122`, `:264` (rank 0 — *the top of the urgency ordering*) and `:322`, and produced by nothing. **A state no code can reach, sitting at the top of the attention ranking.**
4. **RE-CUT `rotate.md` step 6b's sentence** *"not a register anybody maintains, and not a new table"* — it describes a mechanism that was not built. §2.
5. **SIMPLIFY `idle-ding-check.mjs:36–41`** to point at Rule 4a rather than restate its criteria, matching `notify-reminder.mjs:6`. §3.
6. **CONSIDER, do not act:** whether `capae_occurrence` should be derived from `rotation.findings` rather than duplicated. **The dedupe/replay design is genuinely good and the change is not free. This is an enhancement, not a defect, and I would not spend 4D on it.**

**Not to be removed, and worth protecting explicitly:** the exposure vocabulary's no-default rule · `deriveFamily`'s derive-never-increment · the measurement-instruction render · the fail-open/silent-when-empty behaviour · the refusal to auto-create a family · `effectivenessLine`'s refusal to render unsupported progress.

---

## 12. CLOSURE DEFECTS — ONLY WHAT ACTUALLY PREVENTS THE STAR

### 🔴 D-1 — The record contains no real learning, and there is no Git-durable way to put it there

**Star half 1 is not met.** Established by execution, from the derived output of the live table itself:

```json
{ "schema": 1, "written_at": "2026-08-08T10:32:09.557Z",
  "families": [ { "slug": "ff-01", "title": "Pilot family", "occurrences": 2,
                  "state": "MONITORING", "cause": null, "must": null,
                  "effectiveness": null } ] }
```

**`ff-01` / `"Pilot family"` is verbatim the unit-test fixture at `capae-sync.test.mjs:72`.** The documented pilot is `FF-01 work-order-not-generated` with a full cause and required behaviour (decision brief lines 90–98).

**This is not an inference from one file.** `selectActive` admits *every* non-`EFFECTIVE`, non-`unmeasurable` family up to 4. Five of the six documented families are measurable and `MONITORING`, and `EFFECTIVE` is unreachable (D-2). **Had the real families existed as rows, four of them would appear. One placeholder appears.**

**And nothing can fix it durably:** no seed, no insert, no migration, no documented command writes `title`, `root_cause`, `required_larry_behaviour`, `cause_class`, `is_pilot`. `capae-sync.mjs` refuses to create families — **correctly**, since naming a cause is a judgement — but the deliberate refusal was never paired with the deliberate route. **`schema.sql:127–129` records this exact failure already having happened once, for these same tables.**

**Second-order consequence, and it is worse than the empty brief:** when Pax next writes `family: "work-order-not-generated"` into a rotation report, `capae-sync.mjs:247` will report it **UNKNOWN and skip it**. The pilot's first real qualified exposure — *"the next real Work Order"*, the phase's own named acceptance event — **would not record.** Loudly (exit 3), but it would not record.

**Shape of the fix (Larry's to design, not mine):** the six families' content already exists in prose at `Deliverables/2026-08-08-4d-capae-decision-brief-and-families.md` §4. **It needs to become the Git-durable source with a re-runnable applying route, and the `ff-01` fixture row removed or replaced.** Judgement stays with the human writing the file; only the application is mechanical.

### 🔴 D-2 — `exposures_required` has no writer, so effectiveness can never be established

**Star half 2 is structurally unreachable.** `capae-sync.mjs:109`: `required = Number(exposuresRequired) > 0 ? … : null`. With `null`, `:128` never sets `reachedEffective`, `:134` never sets `effectiveNow`, `:122` never sets `challenged`. **`EFFECTIVE`, `CHALLENGED` and `INEFFECTIVE` are all unproducible. Every family is permanently `MONITORING`.**

**Repo-wide grep: `exposures_required` appears only in `schema.sql:151` (the column), in test and check fixtures, and in Cockpit read paths. Nothing writes it.** The only route is a hand-typed SQL `UPDATE` against the live database — which is the same non-durable, undocumented, Larry's-head-only step as D-1.

**Consequences:** effectiveness can never be proven (Star half 2) · the reopening mechanism can never fire (§7) · *"the list should naturally rotate"* is false · the Cockpit's entire urgency ordering has one reachable band.

**D-1 and D-2 share one fix.** A family definition that carries its cause, its required behaviour and its exposure threshold, in Git, applied by a re-runnable route, closes both.

---

### ⛔ EXPLICITLY NOT CLOSURE DEFECTS — recorded because I was tempted by every one

| Finding | Why it is not a closure defect |
|---|---|
| **`gh pr merge` still on ALLOW** | A real standing risk and my own sharpest prior recommendation. **But Warwick closed the permission thread, the decision brief records the omission deliberately, and it is not a CAPAE defect.** It does not prevent the Star. **Enhancement pending Warwick's decision — not 4D's to close.** |
| **The dead opening-brief arm** | Dead code is hygiene, not a Star failure. Delete it; do not gate closure on it. |
| **`effectiveness` always `null` / fraction unrenderable** | Falls back to the bare state; Larry still sees the family and the count. **Degraded display, not a broken loop.** |
| **`INEFFECTIVE` unreachable in the Cockpit** | Decoration in a surface that today renders one row. |
| **Two "Active Brief" surfaces projecting differently** | Same selection, same underlying state, different words. Cosmetic. |
| **`capae_occurrence` duplicating `rotation.findings`** | Internally consistent, loudly divergent at write time. **An architectural preference of mine, not a defect.** |
| **`rotate.md` step 6b's now-false sentence** | Documentation defect that misdescribes a mechanism without misdirecting the journey. Park to reconciliation. |
| **`unDedupable` returned while `ok` stays `true`** | The exact pattern `capae-sync.mjs:299` condemns for `rejected` — reported in a field the caller may not read. **Real, small, and it only bites on a sync run without a rotation id.** |
| **Pax's contract still silent on rotation standing (R-1)** | Live drift, unchanged, non-blocking, owed regardless of 4D. |
| **`/close-session` step 7 self-contradiction (R-6b)** | Live conflict, owed regardless. **CAPAE feeds this surface but does not depend on it.** |
| **`⟦GOV⟧` marker reused after retirement** | `SessionStart` context is not the message stream. Naming collision. Trivial. |
| **Governor install drift** | **Investigated and it dissolves.** Raw MD5s differ; normalised, `continuity.mjs` **MATCHES**, `reorient.mjs` differs by **exactly one line** (the unused import), `capae-brief.mjs` differs by 33 lines that are **entirely the never-called opening-brief block**. **Functionally zero drift. The SessionStart hook is registered at user level (`~/.claude/settings.json` → `node C:/Users/Buggly/.mypka/governor/reorient.mjs`) and does render the CAPAE brief (installed `:1098`).** Recording it because "governor drift" is the kind of headline that survives being wrong — and my own baseline's method note is what stopped me filing it. |

---

## 13. METHOD AND LIMITS

**Executed, read-only:** `git log / rev-parse / show` · `wc`, `diff`, `md5sum` on blob-vs-installed for three governor files (normalised for CRLF per my baseline's method note) · full reads of `capae-sync.mjs`, `capae-brief.mjs`, `services/cockpit/capae.mjs`, `schema.sql`, both hooks · targeted reads of `reorient.mjs`, `rotate.md`, `close-session.md`, the 4D decision brief · repo-wide greps for CAPAE footprint, family slugs, `exposures_required` writers and `INEFFECTIVE` producers · JSON parse of both project settings files and the user-level settings · **execution of the real `renderActiveBrief` against the real live brief file** to measure token cost.

**No git write. No commit. No implementation. No permission change. No `AGENTS.md` touched. `C:\.fusion247\**` never accessed.**

**Limits, stated rather than glossed:**

- **🔴 LIVE SUPABASE STATE IS UNESTABLISHED.** I hold no MCP tools and `private_surface: none` correctly bars me from the credential path. **My claims about the record rest on `~/.mypka/governor/capae-active.json` — which is the derived output of the live table via `writeBrief(families)` at the last sync (10:32:09Z today, ~26 minutes before HEAD).** That is strong evidence for *what Larry actually receives*, which is the Star's own question, and it is weaker evidence for *what rows exist*. **D-1's headline claim — the brief delivers a placeholder — is proven. Its secondary claim — that the six real families do not exist as rows — is a well-supported inference from `selectActive`'s inclusion rules, not a direct observation. Warwick should have someone with database access confirm it before acting.**
- **Outcome A was not independently re-verified.** Outside this commission's scope and ceiling; I report the decision brief's claim as its claim.
- **I did not execute any permission prompt.** The `ask` path in this estate remains unproven by observation, exactly as I flagged in my baseline; four entries now exist where zero did.
- **Contamination disclosed at the head of this document.**

---

## 14. THE ONE-PARAGRAPH ANSWER

> **The Anti-Star was avoided — decisively, and that deserves saying before the defects.** CAPAE added no authority, no role, no command, no operating law and no document class; it costs 78 tokens at session start and 362 at its measured ceiling; it blocks nothing, gates nothing and classifies nothing; its render instructs measurement rather than exhorting behaviour; and its state derives from rows rather than incrementing, so a replay is a no-op and a recurrence reopens a family arithmetically rather than by workflow. **Several parts are better than what I recommended, and one of my own recommendations was simply wrong — a count alone puts no learning into anyone's context, which is why `capae_family` earns the table I told Warwick not to build.** **But the pipe was built and never filled.** The only family reaching a fresh Larry is the unit-test fixture, `"Pilot family"`, with a null cause and a null required behaviour; no code, seed or documented procedure creates a family or sets the `exposures_required` threshold, so the learning content exists nowhere durable and the state machine can never leave `MONITORING`. **Both halves of Warwick's Star therefore fail on the same omission: the content has no Git-durable source and no re-runnable route into the record — which is the identical defect `schema.sql` itself records having already committed once this session, for these same two tables.** Fix that one thing, delete the 35 lines of never-executed comparison code, and the mechanism is genuinely what it claims to be. **Everything else I found is hygiene, and I have said so beside each item rather than letting it accumulate into a case against a phase that mostly got this right.**

---

*Nolan · 2026-08-08 · read-only dispatch at `main` @ `ecabfd2` · one pass, within ceiling · no git write, no implementation, no hire, no permission change. Token costs measured by executing the shipped renderer. Install drift investigated and dismissed with evidence. Live database state UNESTABLISHED — no MCP tools held, private surface correctly not accessed.*
