# CAPAE as built — adversarial evaluation against Warwick's Star

**Commissioned by Warwick via Larry, 2026-08-08. Governance head `ecabfd2` on `main`. ONE pass, no second round. Evaluation only — nothing was implemented, no file outside this one was changed, no Work Order raised.**

**Instrument limit, stated first and it bounds several answers.** I hold **no `Bash` tool, no MCP tools and no network**. Everything below is established by reading files on disk — the repo, the installed runtime at `C:/Users/Buggly/.mypka/governor/`, and the live precomputed brief. **I could not query Supabase, so the "6 families, 12 occurrences" live record is UNESTABLISHED to me** and every claim about family *content* is inferred from schema, writers and the one runtime artefact I could read. Marked in place.

**Same-model review — not independently verified.** I am the same model that authored the challenge brief this evaluation grades itself against.

---

## VERDICT

**The state machine is better than I specified. The Cockpit surface is better than I feared. The loop is not closed — it is open at the evidence input and severed at the comparison output — and the brief a fresh Larry is handed today is unit-test fixture data.**

4D materially improved four of my five process objections, and did so mostly by *deleting* things. It also reproduced, inside itself, the exact failure family it named (`built-tested-never-activated`). **The Star is not met today.** It is closer than it was, and the remaining gap is roughly a dozen lines plus one data file — not another sub-phase.

---

## The three findings that decide the verdict

### ① The comparison arm — "what Larry was told vs what Larry did" — is DEAD CODE

`snapshotOpeningBrief` (`tools/governor/capae-brief.mjs:97`) carries a comment calling itself *"the whole of Warwick's comparison loop (2026-08-08)"*.

| Evidence | Value | Confidence |
|---|---|---|
| Repo-wide grep for `snapshotOpeningBrief` | **two hits: the definition, and one unused import at `reorient.mjs:53`. No call site.** | **High — enumerated** |
| Repo-wide grep for `readOpeningBrief` | **one hit: the definition at `capae-brief.mjs:108`. No caller, no test.** | **High** |
| `.claude/commands/rotate.md`, case-insensitive grep for `opening` | **one hit, line 46, about token readings. No step reads the snapshot.** | **High** |
| **Installed** `~/.mypka/governor/reorient.mjs:53` | imports **`readBrief, renderActiveBrief` only** — `snapshotOpeningBrief` is not even in the live import list | **High — read directly** |

**`capae-opening.json` is never written, never read, and no procedure asks for the comparison.** The Star's second half — *"later measuring whether that learning made any difference"* — has no implementation at all.

**This is `FF-05` committed by the phase that named `FF-05`.** My §3.1 recommendation was *"wire what is already built, and make activation part of done."* The response was to build a new thing and not wire it.

### ② The live CAPAE brief is unit-test output

`C:/Users/Buggly/.mypka/governor/capae-active.json`, read directly, in full:

```json
{ "schema": 1, "written_at": "2026-08-08T10:32:09.557Z",
  "families": [ { "slug": "ff-01", "title": "Pilot family", "occurrences": 2,
                  "state": "MONITORING", "cause": null, "must": null, "effectiveness": null } ] }
```

That is the test fixture. `capae-sync.test.mjs:72` defines `FAMILY = { slug: 'ff-01', title: 'Pilot family', … }`, and the **last test in the file** ("two DIFFERENT findings … in ONE rotation") ends at exactly `occurrences: 2`, `state: 'MONITORING'`.

**Why the isolation fails.** `BRIEF_PATH` is a **module-load constant** — `capae-brief.mjs:24`, `join(homedir(), …)`, evaluated when `capae-sync.mjs` imports it at line 27, i.e. at test-file import time. `isolatedHome` (`capae-sync.test.mjs:77–88`) sets `process.env.USERPROFILE` **inside each test, after that import**, so it cannot affect the already-frozen constant. The test comment at line 76 — *"redirect HOME so the suite never touches the live brief"* — is false.

**Two independent lines: the code structure, and the on-disk artefact matching the fixture exactly.** Confidence: **High**.

**Consequence for the Star.** A fresh Larry launching now is handed a family with **no cause, no MUST behaviour, and a title that names nothing**. It carries zero prior learning. And it says *"1 active"* against a record of six — from which a reader would reasonably infer the other five are proven or irrelevant.

### ③ Every field that carries the actual LEARNING is hand-written SQL with no Git home

`capae-sync.mjs` PATCHes exactly four derived keys plus `updated_at` (line 288). It **never** writes `title`, `root_cause`, `required_larry_behaviour`, `preventive_action`, `cause_class`, `rca_status`, `exposures_required` or `is_pilot`. Repo-wide grep finds **no seed script, no insert, no migration, no documented procedure** that creates a `capae_family` row — and `schema.sql:127–129` admits the tables themselves *"were created directly against the live database and never written down."*

So: **`capae-sync.mjs` maintains the counters; a human maintains the learning, by ad-hoc SQL, outside version control.** The family definitions satisfy none of the estate's own storage law — root `AGENTS.md` hard rule 6 (markdown-only memory), `schema.sql:4` (*"a queryable mirror, not a second SSOT"*), `rotate.md` Bars (*"never the only store"*). **This is the anti-star arriving through the back door: not a governance system Warwick administers, but one Larry administers at a psql prompt.**

The fix is small and the pattern is already proven in this very file: `schema.sql` is re-runnable and applied on every rotation. A committed `capae-families.sql` alongside it would give the learning a Git home at no new machinery.

---

## The twelve answers

**1. Does it materially improve on the failure patterns I originally identified?** **Yes — four of five, and mostly by deletion.** Pax removed from `/rotate`'s blocking path (`rotate.md:71–77`, a deletion with the reasoning preserved) · the four-factor ranking formula replaced by a binary eligibility test plus a three-term weight (`capae-brief.mjs:47–55`) · no Supabase call on `SessionStart` — precomputed file, fails open, silent when empty (`reorient.mjs:1092–1099`) · no `CAPAE.md`, no lifecycle document, no register-to-be-read, and `§2`'s "Deliberately NOT built" list is a real audit trail. **Not improved:** my §3.1 (wire what exists) and §5.2 (prove against the *installed* runtime) — see ① and the install-ledger note below.

**2. Genuinely CLOSED loop, or better records?** **A correct state machine with an open input and a severed output.** Closed and real: recurrence detection, replay safety, and effectiveness derivation. `deriveFamily` (`capae-sync.mjs:104–141`) **derives from occurrence rows rather than incrementing** — that is a better answer than the one I proposed, and it makes replay-safety structural rather than defensive. Open: the exposure word is an unevidenced human judgement (below, 7); the comparison arm does not exist (①); `exposures_required` has no writer, and with it `null` `deriveFamily` can **never** return `EFFECTIVE`, so a family can only ever close if a human hand-sets a threshold in SQL.

**3. Right mistakes becoming durable FAMILIES rather than incident spam?** **Yes, and this is the best design decision in 4D.** `slug` is `UNIQUE` and *"an unknown slug is REPORTED and skipped, never created"* (`capae-sync.mjs:245–247`, exit 3). CAPAE-087-on-a-Tuesday is impossible **by construction**, not by discipline. The six families are cause-keyed, and the refused-family list is genuine restraint. **The cost nobody priced:** the anti-spam control and the manual-administration burden are the *same* decision (③). **And slug drift already exists on day one** — the decision brief names the pilot `work-order-not-generated`; the live brief carries `ff-01`. If Pax writes the descriptive slug, the sync reports UNKNOWN and **silently drops the occurrence** unless someone reads exit 3.

**4. Is the RCA meaningful enough to guide prevention?** **The model is right; nothing enforces it.** `cause_class` · `root_cause` · `rca_status` · `rca_confidence` · `cause_detection_escape jsonb` encode Warwick's cause/detection/escape correction as first-class data, and `rca_status` **defaults to `UNESTABLISHED`** (`schema.sql:144`) — exactly right. But nothing writes them except a human, and **nothing prevents a family reaching `EFFECTIVE` with `rca_status = UNESTABLISHED`**. A prevention proven effective against a cause nobody established is a coincidence, not a lesson.

**5. Does the active brief give useful, specific prior learning without overwhelming him?** **Shape: excellent. Content: currently useless, and structurally capped.** Bounded to 4, silent when there is nothing actionable, stale-warns at 14 days, fails open. **The inversion from exhortation to measurement instruction survived intact** (`capae-brief.mjs:126–134`, closing line 158) — that was my §3.4 and it is the right content class. But: the live file is fixture data (②), **and `buildBrief` can never render a fraction.** It maps `effectiveness: f.effectiveness` — a column that **does not exist** in `capae_family` (the real column is `effectiveness_note`; `effectivenessLine` is a Cockpit-only derivation) — while `selectActive`'s query *does* fetch `exposures_clean` and `exposures_required` and `buildBrief` **drops both**. So `renderActiveBrief:156` always falls back to the bare state. **Warwick's own example brief shows `effectiveness 2/5`. That is unrenderable as built.** *(Minor, flagged not blocking: `renderActiveBrief:139` opens with `⟦GOV⟧`, the marker retired 2026-08-05. This is `SessionStart` context, not the message stream, so it is a naming collision rather than a breach.)*

**6. Is "what Larry was told at start vs what Larry actually did" the right missing link?** **Yes — it is the sharpest idea in the whole phase, and it is unbuilt (①).** It is the only mechanism in the design that can distinguish *"the prevention worked"* from *"the situation never arose"*, because it is the only one that establishes Larry was actually told. The design is also correct and cheap — the brief is rewritten every rotation, so a snapshot is genuinely the minimum. **The code comment asserting it is "the whole of Warwick's comparison loop" is, today, false.**

**7. Are effectiveness states evidence-based enough?** **Well-DEFINED, not evidence-BOUND.** The four-word closed vocabulary with **no default** (`capae-sync.mjs:53–58, 84–88`) is right, and the removal of the old `return 'RECURRENCE'` default is **mutation-tested** (`capae-sync.test.mjs:106–111`) — the estate's own *"a control is not evidence until made to fail"* applied properly. `NONE-THIS-SESSION` and `UNMEASURABLE` moving no counter is exactly the "it did not happen" vs "no chance arose" distinction. Streak-since-last-failure rather than lifetime total (`schema.sql:233–234`) is better than what I specified. **But my §5.1 condition 3 — *"the outcome is observable from a durable artefact, not from Larry's recollection"* — appears in no file.** `evidence_ref` is optional at every layer. **`EFFECTIVE` is reachable on two unevidenced words typed by the analyst.** Separately: **`INEFFECTIVE` renders in three surfaces** (`schema.sql:192` CHECK, `capae.mjs:122`, `STATE_PRESENTATION:264`) **and `deriveFamily` can never emit it.**

**8. False confidence / false recurrence / duplicated families / meaningless effectiveness?**
- **FALSE CONFIDENCE — the highest risk, and it has a one-way door.** Two unevidenced `clean` words → `EFFECTIVE` → `selectActive:49` **excludes the family from Larry's brief entirely**. A wrong "clean" permanently removes a live risk from his attention, and nothing re-surfaces it until it recurs. Compounded by: an unconstrained `exposures_required` (the fixture uses 2); `EFFECTIVE` with `UNESTABLISHED` cause; and the live brief reading "1 active" against six families.
- **FALSE RECURRENCE — well defended.** No default, rejection before any write, whole-sync `ok:false`, exit 3, and a mutation test. Genuinely good.
- **DUPLICATED FAMILIES — structurally prevented.** The residual is slug drift (3), which fails as silent evidence *loss* rather than duplication.
- **MEANINGLESS EFFECTIVENESS —** the brief can never show progress (5); with `exposures_required` null nothing ever leaves the list, defeating the "list should naturally rotate" property Warwick named as desired; and `unDedupable` is returned while `ok` stays `true`, which is the exact "reported in a field the caller might not read" pattern the file's own comment at line 299 condemns for `rejected`.
- **NEW, and not in my original brief: the test suite writes the production brief** (②).

**9. Can Warwick see whether learning is occurring without reading every report?** **Yes. This is the strongest part of 4D and I would keep it unchanged.** `capaeOverview` (`capae.mjs:313–354`) answers four questions structurally — does this need me · what is the pilot and its next qualified exposure · what became effective · what most recently went wrong. `STATE_PRESENTATION` **never uses colour alone** (mark + label + tone). `familiesByUrgency` puts `INEFFECTIVE`/`CHALLENGED` first. It is derived server-side so `capae-check.mjs` asserts it without a browser. And `effectivenessLine:126` **refuses to render "0/5 — on track"**, saying `NOT YET MEASURED` instead — honest instrument design. **Two caveats:** `capae.mjs` is loaded once at startup and needs a **restart** (`services/cockpit/README.md:19`) — whether that happened is **UNESTABLISHED** (no process access); and the heading *"Larry's Active Brief"* is computed live while Larry received a file written at the last rotation — same function, different moment, so the claim is still marginally stronger than the code can honour.

**10. Classification of each concern I raised initially.**

| Initial concern | Verdict |
|---|---|
| §2.1 Pax on `/rotate`'s blocking path | **IMPROVED** — step 6 re-cut as a deletion; step 12 closes the hole it opened |
| §2.2 Pax as standing primary investigator | **IMPROVED** — no standing role created |
| §2.3 Supabase fetch on `SessionStart` | **IMPROVED** — precomputed, fails open, silent when empty |
| §2.4 the four-factor ranking formula | **IMPROVED** — binary eligibility + computable weight |
| §3.2 "no new table — the count is a query" | **PARTLY ENTRENCHED** — two tables. The *occurrence ledger* is defensible (`deriveFamily` needs rows). The *family table* is where the manual-admin surface was created |
| §3.3 no lifecycle document or register | **IMPROVED in Markdown / ENTRENCHED in Postgres** — no document to read, but a register that must be hand-maintained |
| §5.1 `INEFFECTIVE` must be reachable | **PARTIAL + NEW RISK** — `CHALLENGED` is correct and reachable; `INEFFECTIVE` renders in three places and is emitted by none |
| §5.1 must be able to say "unmeasurable" | **IMPROVED** — first-class, excluded from the brief, refuses a fraction |
| §5.1 cond. 3 — evidence from a durable artefact | **UNCHANGED** — in no file; `evidence_ref` optional everywhere |
| §5.2 prove against the **INSTALLED** runtime | **ENTRENCHED** — installed `reorient.mjs` ≠ source, and `INSTALLED-FROM.txt` carries **no 4D entry at all** despite `capae-brief.mjs` being newly installed and `reorient.mjs`/`continuity.mjs` overwritten |
| §3.1 wire what is already built (FF-05) | **NEW RISK CREATED** — `snapshotOpeningBrief` is a fresh instance of the named family |
| §5.4 the mediocre-4D anti-pattern | **PARTLY MATERIALISED** — the artefacts are markedly better than I feared; the activation gap is exactly as I feared |
| *(new)* test suite clobbers the production brief | **NEW RISK CREATED** |
| *(new)* family content has no Git SSOT | **NEW RISK CREATED** |

**11. Still MISSING and REQUIRED to meet the Star.** Ranked; each is small, and none is a sub-phase.
1. **Call `snapshotOpeningBrief` at `SessionStart`; read it at `/rotate` step 6b.** One line plus one clause. Without it the Star's measurement half does not exist.
2. **Give family content a Git home** — a committed `capae-families.sql` applied the way `schema.sql` already is. Removes the ad-hoc-SQL administration surface and restores the SSOT rule.
3. **Make `buildBrief` carry the fraction** — it already fetches `exposures_clean`/`exposures_required` and drops them; `f.effectiveness` names a non-existent column.
4. **Require `evidence_ref` for `clean` and `recurrence`** (not for the other two). This is my §5.1 condition 3, and it is what stops `EFFECTIVE` being reachable on assertion.
5. **Fix the test isolation** (thread an explicit brief path through `syncCapae`) **and restore the live brief**, which is fixture data right now.
6. **One slug scheme.** `ff-01` or `work-order-not-generated`, not both.
7. **Record the 4D install in `INSTALLED-FROM.txt`** and re-install `reorient.mjs` from the head.
8. **Decide `INEFFECTIVE`** — emit it, or remove it from the three surfaces that render it.

**12. What should explicitly NOT be built.** Every one of these is a plausible-sounding improvement that converts CAPAE into the anti-star.
- **No CAPAE approval, review or sign-off workflow.** No Veritas or Codex gate on a family, no "family owner". `rca_status`/`rca_confidence` are the seductive hook for exactly this; the brief already forbids a CAPAE assurance loop.
- **No automatic family creation — ever.** No fuzzy slug matching, no LLM classifier assigning a family. The refuse-and-report behaviour is correct precisely because it is dumb.
- **No CAPAE checker, validator or linter** enforcing that a rotation names a family or that an amendment reconciles its rows. `§15.3d` prohibits one, and FF-03's own datum is that the estate already had a recurrence counter and it did not prevent recurrence.
- **No `CAPAE.md` and no automatic promotion of the brief into `MEMORY.md`.** (Item 11.2 is a *data* file applied by an existing runner, not a document anyone reads.)
- **No scheduled CAPAE digest, review or notification.** A `ding` on a state change turns CAPAE into a pager. The Cockpit overview is the surface, and it is already good.
- **No fifth exposure word.** Four is the budget. Every addition is a new judgement for the analyst and a new branch in `deriveFamily`.
- **No effectiveness dashboard, trend chart or "learning velocity" metric.** That is the precise point at which CAPAE becomes something Warwick administers.
- **No second reviewer for the exposure word.** The remedy for an unevidenced `clean` is a required `evidence_ref`, not a human check.
- **And do not respond to finding ① by building install verification.** The regrowth cap applies at full force. The fix is one line and one ledger entry.

---

## UNESTABLISHED

1. **The live record (6 families, 12 occurrences).** No Bash, no MCP, no network. Every claim about family *content* is inferred from schema, writers and one runtime file.
2. **Whether `exposures_required` / `is_pilot` / `root_cause` are populated on any live row.** Decisive for whether the loop can ever close (2).
3. **Whether the Cockpit was restarted after 4D**, and therefore whether `/api/capae` serves the new module.
4. **Whether `capae-sync.mjs` has ever run successfully against the real database.** Its `pgTransport` branch is untested — every test injects a transport.
5. **Whether the installed `capae-brief.mjs` is byte-identical to source.** Both exist; I cannot diff.
6. **The real frequency of qualified exposures per family** — still the assumption most likely to sink the effectiveness model, and still untested.

---

*Pax · 2026-08-08 · read-only, single pass, no `Bash`/MCP/network · repo, installed runtime and live brief read directly · same-model review, not independently verified · single-source claims flagged in place · nothing implemented, nothing changed outside this file.*
