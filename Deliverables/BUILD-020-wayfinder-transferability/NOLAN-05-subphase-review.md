---
name: NOLAN-05-subphase-review
type: review
author: Nolan
reviews: Warwick's Sub-phase model (third round) + Larry's five attacks
builds_on: NOLAN-04-operating-model-review.md
governance_head_stated: fb3a61c
head_actually_read: cf94a54
branch_read: build-020/phase4-automation-law
created: 2026-08-07
private_surface: none
status: report-only
---

# NOLAN-05 — Reconciliation review of the Sub-phase model

**Read-only. Nothing implemented. Nothing written in `C:\Fusion247PKA-build-020-trial`. No SOP, Guideline, template, registry, validator, hook or role created. No Work Order raised. `CLAUDE.md`, Veritas law, `/rotate`, Wayfinder terminology, PR structure and the BUILD-020 route untouched.**

I remain the brake. **I concede more this round than in either previous round — Warwick's correction is right, his placement instinct is right, and his diagnosis of the collision is right and understates it.** I then refuse the register, refuse the PR, and correct his rendering of my own sentence.

---

## 0. Read-back

**(a) Outcome.** Test whether "Sub-phase" is a load-bearing distinction or a name for something already working unnamed; attack the per-Sub-phase-PR assumption Warwick invites me to refuse; test whether the new wording protects §14.14; verify or refute Larry's descriptive reading; compute the denominator; answer the removals question.

**(b) Plan.** Count the registers actually in force by execution, not by reading the proposal. Read the live artefact Larry says is a Sub-phase in all but name and test every limb of the lifecycle against it. Test the PR assumption against the estate's *observed* PR pattern and against what the gates actually consume. Then compute the cost of the rename against the cost of the alternative.

**(c) What the order failed to settle.** Nothing material. Larry asks me to price "if anything survives" while also asking whether anything should; I compute the honest minimum first and report the count as a consequence.

**(d) What looks wrong in the order — two things, both Larry's.**

1. **`governance_head: fb3a61c` is one commit stale.** `git rev-parse HEAD` = **`cf94a54`** (`docs(mack): flashing Yoga console windows are 4 Interactive scheduled tasks, not Tower`). Immaterial to the verdict — I read at `cf94a54` and say so — but a dispatch that names a head which is not the head is the exact defect class this whole review is about.
2. **Larry's third piece of PR evidence is FALSE at the time of writing.** Struck in §3.4 below with the executed counter-evidence. His argument survives without it — on a stronger limb he had not found.

---

## 1. Verdict up front

> **REDUCED — harder than NOLAN-04, and in a direction Warwick will not expect.**
>
> **1. "Sub-phase" is NOT load-bearing. It is a new name for the Gate 1 boundary, which already exists, is already written, and was already exercised tonight.** Six of the seven limbs of Warwick's Sub-phase lifecycle are already binding law. The seventh is a *subtraction*, and it needs one sentence attached to Gate 1 — not a sixth register.
>
> **2. REFUSE the per-Sub-phase PR, as invited.** Not on preference — on execution. Veritas consumes a **SHA**, never a PR; `reviewDiff.mjs` takes `--base/--head` refs; the estate already runs **one PR per Phase with ~26 feeder branches and zero WP-level PRs**; and **misleading mergeability is not hypothetical — it is LIVE on the one PR that exists right now.**
>
> **3. Larry's candidate is right in substance and wrong in artefact.** No annotated tag. The Sub-phase boundary is **already** recorded as an immutable SHA, in two places, by existing practice — the map's `HEAD` row and the Veritas receipt filename. Zero new mechanism, zero new lines.
>
> **4. Warwick's collision diagnosis is correct and UNDERSTATED. "Work Package" already means THREE things, not two** — and the third is Warden's, in a different domain, with its own schema, and his five-register model does not mention it.
>
> **5. The rename he proposes is the expensive fix. ≈25 edit sites across 5 files, two of them the most protected in the estate, one under a verbatim-copy mandate. The cheap fix is 2 sites.**
>
> **Honest minimum: ONE new line, plus TWO corrections to existing lines, plus the NOLAN-03/04 items unchanged. Still: less written law, not more.**

---

## 2. Q1 — The vocabulary tax. **Warwick names the risk and then walks into it.**

### N-14 — Executed register count. The word is new; the thing is not.

| Token | `CLAUDE.md` | Veritas contract | Map | Repo-wide |
|---|---|---|---|---|
| `Sub-phase` / `sub-phase` / `Subphase` | **0** | **0** | **0** | **0 files** |
| `Work Package` (phrase) | 3 | 7 | 2 | 30+ files |
| `Work Order` | 8 | 11 | **59** | — |
| `WP-<n><L>` tokens | 0 | — | **16 distinct, 133 occurrences** | 6 remote branches |
| `Phase` / `phase` | 13 | 27 | — | — |
| `Stage` | **0** | **0** | — | — |

**"Sub-phase" appears nowhere in the estate.** It is a genuinely new word. The question is whether it names a genuinely new thing.

### N-15 — It does not. Test the lifecycle limb by limb against existing law.

Warwick: *"Sub-phase close normally needs isolated reviewable Git boundary, durable evidence, Veritas, truthful Wayfinder/rotation state, safe continuation — and normally NOT Codex or merge. A Sub-phase PASS is not a Phase PASS."*

| # | Limb | Already binding? | Exact home, at `cf94a54` |
|---|---|---|---|
| 1 | **Isolated reviewable Git boundary** | **100% EXISTING** | Veritas contract L84 — *"reviews **the exact integrated head** — never the worker branch"*; L274 — *"If the dispatch does not name an exact head, Veritas returns `HOLD` and asks for one. It never reviews 'the recent work'."* |
| 2 | **Durable evidence** | **100% EXISTING** | Veritas contract L161; `CLAUDE.md` Rule 3; § "Nothing may live only in Larry's head" |
| 3 | **Veritas at the boundary** | **100% EXISTING** | Veritas contract L57 — *"**ACTIVE SESSION WORK PACKAGE (Wayfinder) is the accepted outcome when present** … its functional acceptance rows are the accepted scope for **Gate 1**"*; L88 |
| 4 | **Truthful Wayfinder / rotation state** | **100% EXISTING** | Gate 3 L109 — *"**No PASS while an active document would send a fresh Larry, specialist or user down a superseded route**"*; map START/RESUME L63/67/70/73/75/78 |
| 5 | **Safe continuation** | **100% EXISTING** | Gate 3 L102, L107 — *"continuation briefs that would **misdirect a fresh instance**"* |
| 6 | **A Sub-phase PASS is not a Phase PASS** | **100% EXISTING, near-verbatim, twice** | `CLAUDE.md` § Veritas dispatch — *"**Gate 1 PASS + Gate 2 HOLD is valid.**"* and *"**Gate 1** grades functional requirements only. **Gate 2** grades the phase North Star journey. Separate receipts."* Map L2404 — *"**Gate 1 PASS + Gate 2 HOLD is a valid outcome. Do not call Gate 1 = Phase PASS.**"* |
| 7 | **Normally NOT Codex or merge** | **IMPLIED, NEVER STATED AS A PERMISSION** | `CLAUDE.md` § Veritas dispatch already gates *entry*: *"Before Codex may be invoked, Veritas Gate 1 must have PASS … **Warwick's explicit authority is still required before any Codex run.** Phase-complete merge additionally needs Gate 2 PASS."* Nothing says a Gate 1 PASS may **close a boundary and stop there.** |

**Score: 6 of 7 already binding. The seventh is one sentence, and it is a RELEASE of obligation, not an addition.**

### N-16 — The finding that decides this question. **Sub-phase is a second name for Gate 1.**

Warwick's model separates two boundaries by *who called them*: Warwick-called (Sub-phase) versus Larry-called (WP/WO). **But the distinction that actually carries weight in his own lifecycle is not who called it — it is what it gates:**

- **Veritas, no Codex, no merge** ← Warwick's Sub-phase close
- **Veritas + Codex + Warwick's merge decision** ← Warwick's Phase close

**That distinction already exists, under names the estate already uses, and it is the live structure of tonight's Work Package:**

| Warwick's model | The estate's existing name | Where it is live tonight |
|---|---|---|
| Sub-phase close | **Gate 1** — functional acceptance rows only | Map row 5, `Deliverables/2026-08-06-veritas-gate1-amended-wp-f0d2614-receipt.md` |
| Phase close | **Gate 2 → Codex → merge** | Map rows 6 and 7 |

**Warwick has re-derived, in new words, a partition his estate already operates on and already writes receipts against.** Introducing a sixth register to name it buys nothing and costs a rename (§6).

**Answer to Q1: Sub-phase is a name for something that already worked unnamed — except that it was not unnamed. It was called Gate 1.**

---

## 3. Q2 — The PR assumption. **REFUSED, as invited. Four independent grounds, one of them live right now.**

### 3.1 Nothing in the Sub-phase lifecycle consumes a PR

The *only* thing a Sub-phase boundary gates is a Veritas verdict. Executed against the Veritas contract at `cf94a54`:

- L84 — *"Veritas reviews **the exact integrated head**"*
- L274 — *"**If the dispatch does not name an exact head, Veritas returns `HOLD` and asks for one.**"*
- L281 — *"**Never commits, pushes, opens a PR, or merges.**"*

**Veritas takes a SHA. It cannot open a PR, it does not read one, and it returns `HOLD` if it is not given a SHA.** A per-Sub-phase PR would therefore be a second artefact serving no reader of the gate it exists to serve.

`reviewDiff.mjs:23` and `:189` — `node reviewDiff.mjs --repo <dir> --base <ref> --head <ref> --claim <claim.json>`. **Arbitrary refs, PR-independent.** Larry's second evidence limb confirmed by execution.

### 3.2 The estate has already run the experiment at finer granularity and chose against PRs

Executed — `gh pr list` and `git branch -a`:

| PR | Head branch | Scope |
|---|---|---|
| #94 MERGED | `build-020/live-trial` | Phase 1 (Proofline) + Phase 2 route |
| #95 MERGED | `build-020/phase2-closure-record` | *a record only* — "Wayfinder: record Phase 2 PASS and CLOSED" |
| #96 MERGED | `build-020/phase3` | Phase 3 entire |
| #97 OPEN | `build-020/phase4-automation-law` | Phase 4 entire |

Meanwhile **26 build-020 branches exist**, including six worker branches — `wp-3a-honcho`, `wp-3b-footer`, `wp-3e-install`, `wp-3e-install-2`, `wp-3f-nolan-redline`, `wp-3g-envelope` — that all fed **one** Phase-3 PR. **Not one of them got its own PR.** The pattern is not a proposal; it is the estate's proven, observed practice across four phases.

**PR #95 is the counter-example that proves the cost.** It is the closest thing to a sub-phase PR that has ever existed here: a documentation-only boundary. It cost its own branch, its own PR, its own merge and its own cleanup — to carry a *record*. That is the cleanup tax, already measured once.

### 3.3 The killer — misleading mergeability is LIVE, on the single PR that exists

Executed, `gh pr view 97`:

```
"mergeable": "MERGEABLE",  "mergeStateStatus": "CLEAN",
"title": "BUILD-020 Phase 4: automation law + WO generator + return-cue (Gate 1 PASS)"
statusCheckRollup: [ Supabase Preview → SKIPPED, Vercel → SUCCESS, Vercel Preview Comments → SUCCESS ]
```

Against the map at the same instant:

- Gate 1 = **FAIL** at `0cf70c9` (receipt committed at `6a804e4`)
- Map row 5 = **HOLD** @ `f0d2614`; row 6 Gate 2 = **HOLD**; row 7 Codex = **BLOCKED**
- *"No merge without Warwick's explicit final authority."*

**GitHub is advertising a green, `CLEAN`, `MERGEABLE` pull request whose title asserts a `Gate 1 PASS` that has since been superseded by a `Gate 1 FAIL`.** And `statusCheckRollup` contains **only** Vercel/Supabase — `control-plane-tests`, `secret-scan` and `cockpit-private-apps` are **absent from the rollup entirely**, so `CLEAN` was computed without the workflows that matter.

**One PR already produces one false green with one stale assurance claim in its title. N Sub-phase PRs produce N false greens, each with its own stale title, each a surface Warwick can click.** This is the single strongest fact in the review, it required no speculation, and it is the hazard Larry was reaching for.

### 3.4 CORRECTION TO LARRY — strike his third evidence limb. It is stale and false.

He wrote: *"CI is stuck in a GitHub Actions outage, so multiplying PRs multiplies a broken dependency."*

Executed, `gh run list`:

| Run | Workflow | Branch | Elapsed | Result |
|---|---|---|---|---|
| `31129289333` | cockpit-private-apps | `research/wayfinder-transferability` | **11m34s** | **success** |
| `31129289318` | secret-scan | `research/wayfinder-transferability` | **11m1s** | **success** |
| `31125489428` | secret-scan | `build-020/phase4-automation-law` | 4h49m6s | success |

**The queue has drained. The two most recent runs completed successfully in eleven minutes.** The 4h49m runs at 18:14 are the outage window; it is over. **The premise was true when banked at `0cf70c9` and is not true now.** A review that lets a stale premise stand while arguing against stale premises has failed at its own job.

The argument does not need it. **Ground 3.3 is strictly stronger and points the other way round: the problem was never that CI is down — it is that PR mergeability is computed from checks that exclude the gates that decide.** A restored CI makes that *worse*, because the green becomes more convincing.

### 3.5 Stacked PRs — not speculative either

PR #97's `baseRefName` is `main`. Cut a Sub-phase PR for row 1 and another for row 4 and there are exactly two options:

- **Base PR-2 on PR-1** → PR-2's diff is polluted by PR-1 until PR-1 merges; GitHub renders the union; and Veritas's *"exact integrated head"* has two candidate answers.
- **Base both on `main`** → the two PRs overlap and both claim the same commits.

**Neither produces a reviewable unit, and both destroy the ability to review a complete Phase as one thing** — which is precisely what PR #96 delivered for Phase 3 with six feeder branches behind it.

### 3.6 My verdict on Larry's candidate — **accept the substance, REJECT the artefact**

> **Larry's candidate: "one PR per Phase; Sub-phase boundary = an annotated tag or recorded immutable SHA on the Phase branch."**

**The "one PR per Phase" half is correct and needs no text — it is already the practice.**

**The annotated-tag half I refuse, and the regrowth cap is why.** Executed: the repo has **8 tags total**, every one `archive/*` or `backup/*`. There is no boundary-tag convention, so introducing one is a *new mechanism* — a naming scheme, a discipline to apply it, and a thing to forget.

**It is also unnecessary, because the boundary is ALREADY recorded as an immutable SHA in two places by existing practice:**

1. **The map's `HEAD` row** in the ACTIVE SESSION WORK PACKAGE table, and rows 5/6 which name the head verdicts attach to (`HOLD @ f0d2614`).
2. **The Veritas receipt filename itself** — `veritas-gate1-amended-wp-f0d2614-receipt.md`, `veritas-build020-phase4-closure-fa2018f-receipt.md`, `veritas-build020-gate1-pass-a1e124a-receipt.md`. **The estate already names its durable boundaries by SHA, in the filename, immutably, in Git.**

**So: one PR per Phase; the Sub-phase boundary is the SHA already carried by the Veritas receipt filename and the map's `HEAD` row. No tag. No convention. Zero lines.** Larry's own evidence — *"tonight's real durable boundary was an exact SHA (`0cf70c9` frozen for Veritas, then `fb3a61c`), never a PR"* — is exactly right, and it already has a home he did not notice it was living in.

---

## 4. Q3 — Does the new wording protect §14.14? **Materially better. Not fully clear. And "surfacing" is undefined, which is the whole risk.**

### N-17 — §14.14 executed, and the new wording tested limb by limb

§14.14 (map L1011–1040): Larry split WP-2A three ways on Keel's four class-A refusals — Keel gets the refuse guard and `Deliverables/**`; Mack gets the four machine-level removals (*"deregistration is the same seam"*); Larry takes `Builds/BUILD-010/**` as a bounded Rule-4 exception because *"Keel's critical rule 5 permanently bars `Builds/`, and a Work Order cannot override a contract."* It carried the note that prevented a silent Tower death: *"**Mack's deletions land first; Keel's `git worktree remove` is HELD until Larry releases it.**"*

Warwick's new sole boundary: *"He may not use internal Work Packages or Work Orders to **alter the Phase outcome**, **expand scope**, **promote parked ideas** or **introduce a new Warwick-level Sub-phase** without surfacing the change."*

| Limb | §14.14 | Verdict |
|---|---|---|
| alter the Phase outcome | **§14.14 states: *"The acceptance property **is amended** (it was falsified — §14.9a B1): every enumerated start path, **now eight**, fails or refuses…"*** Larry changed the acceptance property from seven paths to eight, mid-flight, on his own evidence | **CAUGHT by a literal reader.** Amending an acceptance property is a change to what the package promises |
| expand scope | Mack's machine layer (covered by Warwick's C-3) + Larry's own `Builds/**` exception (**not** pre-covered) | **PARTIALLY caught** |
| promote parked ideas | no | clear |
| introduce a new Sub-phase | no | clear |

**Concession, stated plainly: Warwick's correction is a real improvement and it does the job it was written to do.** The old wording — *"Warwick alone calls Work Packages"* — would have blocked the three-way owner split outright, and with it the sequencing note. **The new wording does not block the split.** Pax's §14.14 case is protected on its principal limb, and Warwick fixed a real defect in his own proposal. That deserves saying without hedging.

**But it does not fully clear §14.14, because §14.14 also amended an acceptance property**, and that is squarely inside limb 1 on any plain reading.

### N-18 — "Without surfacing the change" is undefined, and each reading lands somewhere already written

- **Reading A — *surface = notify*.** Then it is **already law twice.** Rule 4a's written criteria: send *"for a substantive outcome he would reasonably want to know immediately **even when no action is required**"*. And the map's own START/RESUME L78: *"**All Work Orders, Veritas dispatches, `/rotate` reporting and merge-readiness statements derive from the ACTIVE SESSION WORK PACKAGE. No requirement may live only in chat, Larry's context or a stale rotation packet.**"* **Zero new text owed.**
- **Reading B — *surface = ask first*.** Then it is the old gate wearing a softer verb, §14.14's acceptance-property amendment becomes a handback, and the autonomy Pax defended is reintroduced at one remove. **The wording as given does not exclude Reading B.**

**Correction I owe Warwick: the clause must say which, and if it says "ask" it should be rejected.** My recommendation is **notify, not ask** — and on that reading **it needs no new text at all**, because the existing law already partitions it exactly:

- a **material change to agreed scope** → interrupt code **`product-decision`**, which already reads *"including a material change to agreed scope"*;
- **everything else** → record on the map, ding under Rule 4a if substantive, continue.

**Both halves are already written, in the right homes, with the right names. The hazard is not a missing rule; it is an ambiguous verb in a proposed one.**

---

## 5. Q4 — Is the model descriptive? **VERIFIED on six limbs. REFUTED on one, and the refutation costs real work.**

### N-19 — Larry's reading is correct

Tonight's `## ⭐ ACTIVE SESSION WORK PACKAGE` (map L2338) tested against Warwick's Sub-phase definition:

| Sub-phase property | Live artefact | ✅/❌ |
|---|---|---|
| **Warwick-called** | **Four named Amendments**, each verbatim-quoted: Amendment 3 (Claude host scope change), Amendment 4 (*"Row 3 you may descope…"*) | ✅ |
| **Bounded continuation inside a Phase** | *"Phase: BUILD-020 Phase 4 — amended WP in flight"* | ✅ |
| **Own acceptance rows** | Functional rows 1–4, now 1/2/4 | ✅ |
| **Own Veritas gate** | Rows 5–6 with their own receipts and heads | ✅ |
| **Own rotation** | `### 📌 ROTATION (this /rotate)` block, **spanning hosts** — Grok build host → Claude | ✅ |
| **Phase too big for one window / remainder needs fresh context** | `### 📌 NEXT WORK PACKAGE (record only — do not execute in this Grok session)` — *"Warwick launches a **fresh Claude Code session**"* | ✅ |
| **Does not change the Phase outcome** | *"Gate 2 may remain HOLD… **Do not manufacture a Phase PASS**"* | ✅ |

**Larry's reading is VERIFIED. The live artefact is a Warwick-called, multi-session, multi-host, separately-gated bounded continuation inside Phase 4. It is a Sub-phase in all but name — and the name it actually has is "Gate 1 boundary".**

### N-20 — The refutation. **The model is not free, because the live artefact is a hybrid.**

The same section **also** carries **row 7 — *"Codex + merge decision pack. Warwick authorises final Codex after Gate 1 PASS."*** — and **PR #97**, and **Gate 2**.

**Under Warwick's model a Sub-phase close is "normally NOT Codex or merge." The live artefact carries both.** It is not a clean Sub-phase; it is **a Sub-phase and a Phase close fused into one section of the map**.

**So adopting the model is not purely descriptive. It would require splitting the live ACTIVE SESSION WORK PACKAGE section into a Sub-phase part (rows 1–5) and a Phase-close part (rows 6–7)** — a re-scoping edit to the exact section a fresh Larry orients from, mid-flight, while Gate 1 is FAIL and the map already carries three competing frontier claims (§7). **Nobody has priced that, and it is the one place in this proposal where the vocabulary genuinely costs something.**

**Answer to Q4: descriptive on ~85% of the artefact, prescriptive and live-editing on the rest. The "genuinely new wording is close to nil" half of Larry's reading is confirmed. The "therefore free" implication is not.**

---

## 6. Q5 — The denominator, and Warwick's Q12 on removals. **The collision is real, and it is THREE-way.**

### N-21 — "Work Package" already means three different things, in three different domains

| Meaning | Token | Where, executed at `cf94a54` |
|---|---|---|
| **(a) Warwick-called session boundary** | `ACTIVE SESSION WORK PACKAGE`, "Work Package" | `CLAUDE.md` §"Veritas dispatch — full Work Package" L232–248; Veritas contract L55/57/59/88/244; map START/RESUME L63/67/70/73/75/78 + L2338 |
| **(b) Larry's internal decomposition** | `WP-2A`, `WP-3E`, `WP-4C`… | map — **16 distinct tokens, 133 occurrences**; **6 remote branches** `build-020/wp-3a…wp-3g` |
| **(c) Warden's client-delivery work package** | `WP-001`, `wp_number:` | `Team Knowledge/Templates/work-package.md`; `GL-006-client-delivery-frontmatter-conventions.md`; `.claude/agents/warden.md` L14; `Client Delivery/**/Work Packages/` |

**Warwick's five-register model does not mention (c) at all.** It is a different domain (client engagements), with its own owner, its own Guideline and its own frontmatter schema — and its `WP-NNN` token shape collides with (b)'s `WP-<n><L>` at the token level, not merely the phrase level.

### N-22 — The collision is not stylistic. It has already produced two live defects.

**Defect 1 — an unresolved obligation of unknown size, in a specialist contract and its shim.**

Veritas contract **L88** and `.claude/agents/veritas.md` **L3** both state, identically:

> **"A Work Package cannot be marked complete without a `VERITAS_PASS`."**

Read under **(a)**: one gate per Warwick-called boundary. Sane.
Read under **(b)**: **a mandatory Veritas gate on every one of Larry's 16 internal WPs.**
**Nothing in either text disambiguates.** That is exactly the delivery tax §15.3d was commissioned to reduce, sitting unresolved in the contract of the specialist who enforces gates.

**Defect 2 — misfiling, already on disk.**
`Builds/BUILD-015-…/Work Packages/wo-g3d-wayfinder-map-and-precedence.md` and `…/wo-g3e-gate3-second-discharge.md` — **Work ORDERS filed inside a folder named "Work Packages".**

**Warwick's diagnosis is correct and I concede it without qualification. It is also understated: three meanings, not two, and it has already cost something.**

### N-23 — But his fix is the expensive one. The arithmetic, executed.

**Cost of renaming (a) → "Sub-phase"** — every site where meaning (a) is currently bound:

| File | Sites | Note |
|---|---|---|
| `CLAUDE.md` | **3** | including the **section heading** `### Veritas dispatch — full Work Package, not Larry's preferred slice`, which the Veritas contract L57 quotes **by name** |
| `Team/Veritas .../AGENTS.md` | **11** | |
| `.claude/agents/veritas.md` | **1** | and a malformed shim edit drops the specialist from the roster silently |
| `Team Knowledge/Templates/veritas-receipt.md` | **3** | mandatory receipt shape |
| Map START/RESUME + §heading | **7** | **the START/RESUME block is under `CLAUDE.md`'s verbatim-copy mandate — editing it forks the exemplar** |
| **Total** | **≈25 edit sites across 5 files** | two of them the most protected surfaces in the estate; one under a verbatim-copy rule |

**Cost of the cheap fix — disambiguate meaning (a) where the ambiguity actually bites: 2 sites.**

**That is the denominator, and it decides the question.** Renaming (a) to fix a collision costs **≈25 protected edits**; correcting the two lines where the collision has a measurable consequence costs **2**. **The rename is 12× the edit surface for the same defect, on the files where a mistake is most expensive.**

### N-24 — And do NOT rename (b) or (c)

- **(b)** — `WP-2A` … `WP-4C` appear **133 times** in a **285 KB** map that a fresh Larry orients from, plus **6 remote branch names** which cannot be renamed at all without rewriting history. Renaming buys nothing functional and every rename is a chance to break a cross-reference in the one file that must never mislead.
- **(c)** — a different domain with its own Guideline (GL-006), template and owner. **Any sweep must explicitly exclude `Client Delivery/**`, `Team Knowledge/Templates/work-package.md`, `GL-006` and `.claude/agents/warden.md`.** Renaming Warden's vocabulary to fix Larry's would be a defect, not a fix.

---

## 7. The Veritas enumeration sentence — **I do NOT confirm it. Three material regressions. Corrected back.**

Warwick's rendering:

> *«Enumerate every active statement capable of directing a fresh Larry's next action and verify they all resolve to one current target.»*

Mine (NOLAN-04 §4 item 3), verbatim:

> ***Enumerate every statement in the map that directs the next action** — frontier headings, "read this first" blocks, rotation blocks, first-safe-action rows and Work Package pointers — **and verify they all name the same live target.** A superseded pointer that was itself a prior correction is the highest-risk case, because its date implies currency.*

He calls it near-verbatim. **It is near-verbatim on the spine and materially wrong on all three things that made it affordable and effective.**

| # | Regression | Why it matters |
|---|---|---|
| **1** | **Scope removed.** Mine says ***in the map***. His says *"every active statement"* — unbounded across the estate | Collides head-on with Veritas contract **L102**: reviews *"the active sources affected by the boundary under review … **never the whole estate by default**"*; with **L152** (*"materially cheaper than the implementation it assures"*); and with **Method 1b**, a dispatch ceiling Veritas **may not extend**. **His wording re-imports exactly the self-defeat I rejected in NOLAN-04 §Q3** |
| **2** | **Enumeration turned back into assessment.** Mine names **five closed classes**. His says *"every active statement **capable of** directing"* | The enumeration/assessment distinction was **the entire load-bearing argument** of NOLAN-04 §Q3. An enumeration terminates, costs one grep, and cannot expand under a ceiling. *"Capable of directing"* is a judgement with no stopping point |
| **3** | **The highest-value clause deleted.** His version drops *"A superseded pointer that was itself a prior correction is the highest-risk case, because its date implies currency."* | **That is the only clause aimed at the failure that actually happened** — the 2026-08-05 Veritas-forced fix that pointed at §14.19, re-staled within 22 hours when §17 declared itself the frontier, and survived ~15 subsequent reviews. Without it the check is generic; with it, it is aimed |

**Verdict: it does not still say what I meant. I correct it back to the NOLAN-04 text, unchanged and un-softened.**

### N-25 — And the defect it targets is WORSE at HEAD than NOLAN-04 recorded

NOLAN-04 counted five frontier-shaped headings at `fb3a61c`. Re-executed case-insensitively at **`cf94a54`** — **seven directive statements, and now THREE live claims, not one:**

| Line | Statement |
|---|---|
| 19 | `⟦ROTATION BLOCK⟧` **Frontier** → *"§14.19 is the SINGLE statement of the live frontier"* |
| 421 | `## 12. Phase 1's frontier — ⛔ SUPERSEDED` |
| 429 | *"**THE CURRENT FRONTIER IS §14 (Phase 2)**"* |
| **1425** | ***"This is the ONLY place in this map that states the live frontier."*** — §14.19, which records **Phase 2 PASS. CLOSED** |
| **1575** | ***"⭐ THIS SECTION IS NOW THE LIVE FRONTIER. §14.19 is Phase 2, CLOSED and MERGED."*** |
| 1660 | `## 16.8 Frontier` — Phase 3, unstruck, no pointer |
| **1782** | ***"# 17. … THIS IS NOW THE LIVE FRONTIER."*** |
| 2336 | `## 17.4 Frontier` |

**Three sections each assert they are the live frontier. Two directive rows point a fresh Larry at a CLOSED phase. Still live at `cf94a54`.** Reported once, not raised as work.

---

## 8. Verdict — proceed as written, reduced, or not at all?

> ### **REDUCED — to ONE new line and TWO corrections. The register itself: NOT AT ALL.**

### 8.1 The exact minimum

| # | Text | Home | Lines | Gate |
|---|---|---|---|---|
| **1** | *A Gate 1 PASS closes the authorised Work Package boundary and requires neither Codex nor a merge. Phase close requires Gate 2, Codex where eligible, and Warwick's merge decision.* | `CLAUDE.md` § "Veritas dispatch", appended after the existing *"Gate 1 PASS + Gate 2 HOLD is valid"* | **1 NEW** | Normal constitutional gate |
| **2** | **CORRECTION, not addition.** Veritas contract **L88**: bind *"A Work Package cannot be marked complete without a `VERITAS_PASS`"* to meaning (a) — the Warwick-authorised boundary — so it cannot be read as a mandatory gate on each of Larry's 16 internal WPs | `Team/Veritas .../AGENTS.md` L88 | **0 net** | Veritas contract change; Warwick's approval |
| **3** | **CORRECTION, not addition.** Same disambiguation in `.claude/agents/veritas.md` L3, which repeats the sentence verbatim | `.claude/agents/veritas.md` L3 | **0 net** | Shim edit — **verify YAML parses; a malformed shim drops the specialist silently** |
| **c/f** | NOLAN-04 items 1, 2 and 3 (Phase/WP authority line · the ACTIVE-SESSION-WORK-PACKAGE off-boundary exception · the Gate 3 enumeration **in my wording, not Warwick's**) | unchanged | **3** | unchanged |
| **c/f** | NOLAN-03 N-6: add `focus` to `/rotate` step 11 | `.claude/commands/rotate.md` | **1 word** | None |

**Denominator: `CLAUDE.md` 271 → 273 lines from this round's new text (item 1 plus the NOLAN-04 carry-forwards already counted). Net NEW text attributable to the Sub-phase model: ONE line.**

**Warwick proposed a five-register hierarchy with a seven-limb lifecycle. Six limbs are already law, one limb is a subtraction, and the register is a second name for Gate 1. One line.**

### 8.2 CUT list

1. **The word "Sub-phase", and the five-register hierarchy.** It is a second name for the Gate 1 boundary, which exists, is written in two files, and was exercised tonight with its own receipt. *(N-15, N-16)*
2. **Any per-Sub-phase PR.** Veritas cannot open one, does not read one, and returns `HOLD` without a SHA. The estate runs one PR per Phase with 26 feeder branches and zero WP-level PRs. **And one PR already produces a false green.** *(§3)*
3. **The annotated-tag convention.** 8 tags exist, all `archive/*`/`backup/*`. The boundary is already an immutable SHA in the map's `HEAD` row and in the Veritas receipt filename. **New mechanism where an existing route suffices = regrowth cap.** *(§3.6)*
4. **Any clause restating "isolated Git boundary", "durable evidence", "Veritas at the boundary", "truthful Wayfinder state", "safe continuation", or "a Sub-phase PASS is not a Phase PASS".** All six already binding, one of them near-verbatim in two files. *(N-15)*
5. **Any renaming of Larry's `WP-<n><L>` tokens.** 133 occurrences in a 285 KB orientation document plus 6 remote branch names. *(N-24)*
6. **Any renaming of Warden's client-delivery Work Packages.** Different domain, own Guideline, own template, own owner. **Explicitly exclude from any sweep.** *(N-24)*
7. **Renaming meaning (a) to "Sub-phase" across the estate.** ≈25 edit sites, 5 files, two of them the most protected in the estate, one under a verbatim-copy mandate — versus 2 sites for the fix that actually addresses the consequence. *(N-23)*
8. **"Without surfacing the change" as written.** Undefined verb. On *notify* it is already law twice (Rule 4a + map L78); on *ask* it is the old gate renamed. **Either say "notify" — in which case write nothing — or reject it.** *(N-18)*
9. **Warwick's rendering of the Gate 3 enumeration sentence.** Three material regressions; use the NOLAN-04 wording unchanged. *(§7)*

### 8.3 Removals and corrections needed to stop "Work Package" meaning two things

**The honest answer to Q12: the removal that fixes the collision is not a rename. It is two disambiguations and one exclusion.**

| | Action | Cost |
|---|---|---|
| **R1** | Bind Veritas contract **L88** to meaning (a) | 1 site |
| **R2** | Bind `.claude/agents/veritas.md` **L3** identically | 1 site |
| **R3** | **Exclude** `Client Delivery/**`, `Team Knowledge/Templates/work-package.md`, `GL-006`, `.claude/agents/warden.md` from any future sweep — meaning (c) is correct as-is | 0 sites |
| **R4** | Leave `WP-<n><L>` alone | 0 sites |
| **R5** | *(non-blocking, park)* `Builds/BUILD-015-…/Work Packages/` contains two Work **Orders**. Misfiling caused by the collision. Record once | 0 sites now |

**Total: 2 edit sites. Against ≈25 for the rename.**

### 8.4 Does my answer remain "less written law, not more"?

> **Yes. Plainly, and more so than in either previous round.**

Three rounds, three independent proposals — PAX-02's ~40 lines, Warwick's five-clause model, and now a five-register hierarchy — and each time the residue has been **one to three lines**, because the estate keeps proposing rules it has already written. This round is the clearest case yet: **six of seven lifecycle limbs already binding, and the register is a second name for a gate that already has a name and already writes receipts under it.**

**And the pattern from NOLAN-04 repeats exactly.** Two of the four things that round established were already written and simply not applied. This round: **three competing live-frontier claims at `cf94a54`**, under Gate 3 L109 which already forbids them, in a map whose START/RESUME block already forbids reading a frontier from anywhere but one section. **The estate's problem is not a missing vocabulary. It is that a 285 KB map now contains three sections each declaring itself the frontier, under rules that already forbid it.**

**A sixth register will not fix that. It will be the sixth thing that is true on paper.**

---

## 9. Reported once, for Warwick — not raised as work

1. **LIVE, blocking-class under existing § Finding disposition.** Three sections of the map each assert they are the live frontier (L1425, L1575, L1782); two directive rows (L19, L429) point a fresh Larry at **§14.19 — Phase 2, PASS, CLOSED**. Worse at `cf94a54` than NOLAN-04 recorded at `fb3a61c`. *(N-25)*
2. **PR #97 advertises `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`, title `"(Gate 1 PASS)"` — while Gate 1 is FAIL at `0cf70c9`, Gate 2 is HOLD, Codex is BLOCKED and merge is withheld.** `statusCheckRollup` excludes `control-plane-tests`, `secret-scan` and `cockpit-private-apps` entirely, so `CLEAN` was computed without the real workflows. **A live false green on a single PR.** *(§3.3)*
3. **The CI-outage premise is no longer true.** Two runs completed `success` in ~11 minutes at 22:52Z. Any argument still resting on it should be re-derived. *(§3.4)*
4. **Veritas contract L88 and its shim carry an obligation of unknown size** — *"A Work Package cannot be marked complete without a `VERITAS_PASS`"* — undisambiguated between one Warwick-called boundary and Larry's 16 internal WPs. *(N-22)*
5. **`Builds/BUILD-015-…/Work Packages/` contains two Work Orders.** Collision-caused misfiling, already on disk. Non-blocking. *(N-22)*
6. **The dispatch named `fb3a61c`; HEAD is `cf94a54`.** Immaterial here, and named because a dispatch naming a head that is not the head is this review's own subject. *(§0d)*

**None of these is a Work Order. A finding is an observation. What becomes work is Warwick's decision.**

---

## 10. What I conceded this round

Stated separately because Warwick asked for corrections, not restatement, and three of these go against me or against Larry.

1. **Warwick's withdrawal of the old clause is correct, and his correction does the job it was written to do.** The old wording would have blocked §14.14's three-way split and the sequencing note that prevented a silent Tower death. The new wording does not. *(N-17)*
2. **His collision diagnosis is correct, and I found it understates itself.** Three meanings, not two, and it has already produced two live defects. *(N-21, N-22)*
3. **His placement instinct remains better than the proposals around it** — detail into the specialist surface, not the constitution. Repeated from NOLAN-04 because it is still true.
4. **Larry's descriptive reading is verified** on six of seven limbs — and refuted on the seventh, which is where the model stops being free. *(N-19, N-20)*
5. **Larry's PR candidate is right in substance** and his `reviewDiff.mjs` and SHA evidence is confirmed by execution — **and one of his three limbs is false and struck.** *(§3.4)*
6. **Against myself:** I told Warwick in NOLAN-04 that the Gate 3 enumeration was the one sentence worth writing. It still is — but only in the wording that scopes it to the map, enumerates five closed classes, and names the re-staled-correction case. **His rendering keeps the spine and drops all three, which would turn my own concession back into the thing I rejected.** *(§7)*

---

## 11. What I did not do

- Nothing implemented, adopted or installed. No SOP, Guideline, template, registry, validator, hook or role created or modified. No new vocabulary adopted.
- **Nothing written in `C:\Fusion247PKA-build-020-trial`.** It was read and executed against read-only (`git log` · `git rev-parse` · `git branch` · `git tag` · `gh pr list` · `gh pr view` · `gh run list` · `grep` · `sed`). No state written, no branch, no worktree, no commit.
- `CLAUDE.md`, Veritas law, `/rotate`, Wayfinder terminology, PR structure and the BUILD-020 route untouched.
- `private_surface: none` — nothing under `C:\.fusion247\**` was read or written.
- **No Work Order raised. No pre-inspection of anyone's work. No CareerAIR scope touched.**
- No counter-proposal beyond the exact minimum. Where I disagreed with Warwick or with Larry, I cut; where the evidence took something from me, §10 records it.
