---
name: PAX-04-subphase-model
type: reconciliation-commission
commission: Warwick's Sub-phase model, round 3 (Larry, 2026-08-07)
author: Pax
created: 2026-08-07
governance_head: fb3a61c
branch_read: build-020/phase4-automation-law
private_surface: none
status: report-only
---

# PAX-04 — Warwick's Sub-phase model, tested against the record

**REPORT ONLY. Nothing implemented. No SOP, Guideline, template, registry, validator, hook or role created. `C:\Fusion247PKA-build-020-trial` was read and never written.**

> **Same-model honesty note.** Everything under review was authored by this model in earlier sessions. This is a structured read of committed evidence at `fb3a61c`, not external verification. **No `Bash`** — every claim is read from committed artefacts. Where I could not establish something, I say **unestablished**.

---

## 1. HEADLINE — three findings, in order of consequence

**1. Sub-phase is not a new register. It is a NAME for a thing that already exists, is already Warwick-called, and is currently referred to by two colliding names.** Larry's point 1 is correct and I can close it: verified, not asserted. **But the model only pays for itself if the rename is done rather than layered.** Adding "Sub-phase" *alongside* the existing "ACTIVE SESSION WORK PACKAGE" / "session Work Package" wording produces the sixth register and the mutiny Warwick warned about.

**2. Larry's PR conclusion is right and one of his three reasons is refuted by source.** One PR per Phase is correct — but *not* because stacked PRs "force Codex to review fragments rather than the assembled Phase." **Codex cannot review an assembled Phase.** `reviewDiff.mjs` truncates the diff at 60k bytes, and the estate has a *measured* false green from exactly that (`reviewDiff.mjs:210-214`). PR #97's real Codex claim was scoped to a **10-entry pathspec** (`2026-08-06-pr97-codex-claim.json:8-19`). Codex reviews scoped fragments either way. **The Sub-phase boundary makes that scoping honest instead of accidental — which is a better argument than the one Larry made, and it survives.**

**3. The one place existing canonical wording is genuinely WRONG, and the Sub-phase fixes it.** Root `CLAUDE.md:192` — *"Update a map only at a phase boundary."* On the branch read, the BUILD-020 map was updated **47 times inside four Phases**, nearly all mid-phase, including every Warwick amendment (`INPUT-build020-git-history.md:92-137`). That rule is dead in practice and has been for the whole build. **Sub-phase supplies the missing legitimate update boundary.** This is the strongest case for adopting the word at all, and neither Larry nor Warwick raised it.

---

## 2. CONTRADICTING EVIDENCE — explicitly requested, so it leads

### 2.1 🔴 Phase 1 closed with NO PR, NO merge, NO Codex — and it worked

The proposed Phase-close law requires *"Veritas on the complete Phase outcome, Codex when eligible, Warwick's merge decision, authorised merge."* **BUILD-020 Phase 1 satisfied none of the last three.**

- map:387 — Phase 4b **PASS**, *"recorded on Warwick's own authority… 'I have now completed the real Proofline walkthrough… I PASS and approve the Proofline product phase.'"*
- map:388 — `| 5 — Merge | NOT STARTED — and **not** the next step. Phase 2 lands first; Codex reviews the complete integrated change |`
- map:397 — *"**It is not a Veritas PASS.** The gate's last verdict on this scope was HOLD… no third pass was authorised."*
- map:1539 — Phase 1 and Phase 2 shared branch `build-020/live-trial` and **one PR, #94**.

**Phase 1 closed on: durable evidence · a truthful map status row · Warwick's own product PASS · continuation on the same branch.** That is Warwick's proposed *Sub-phase* lifecycle, executed at something he called a *Phase*, and it is the cleanest close in the build.

**Warwick must pick one:** either the Phase-close law is stricter than what actually worked, or Phase 1 was a Sub-phase misnamed. I recommend the second reading — it is coherent, it costs nothing, and it means the model *describes* BUILD-020 rather than condemning it. **Confidence: High** (primary, exact lines).

### 2.2 🔴 «A Sub-phase never adds scope» is already falsified — by Warwick

Map:2358, Amendment 3: *"The previously deferred Claude hook installation and live proof is **FOLDED INTO ROW 1**… **Unparked** from § Parked and from § Explicitly OUT OF SCOPE by this amendment."*

That is a parked item promoted into an active Sub-phase, mid-flight. The rule as drafted forbids it.

**The precision fix is one word and it is Warwick's own intent:** the constraint binds **Larry**, not Warwick. *"He may not use internal Work Packages or Work Orders to alter the Phase outcome, expand scope, promote parked ideas…"* is already correctly scoped in his new text. **The summary sentence «It does not change the Phase outcome or add scope» is the one that is wrong** — Warwick amended his own Sub-phase four times in one session (Amendments 3 and 4, map:2340, 2352) and that was correct behaviour. Delete that sentence or bind it to Larry.

### 2.3 🟡 The one mid-phase Codex run produced a real BLOCKS finding

`5135a24 Codex BLOCKS: validate machine_surface absolute paths + live_authority; honest J1-1 wording` — run at the `a1e124a` Gate 1 PASS, which was a **Sub-phase-shaped boundary inside Phase 4**, not the Phase close (~30 commits of further Phase 4 work followed).

Under the proposed default — *"a Sub-phase normally does NOT need Codex"* — that run would not have happened and that finding would not have been caught until Phase close.

**This does not make the default wrong. It makes the wording matter.** State it as **"not required"**, never **"not appropriate."** Warwick's escape hatch (*"or Warwick orders it"*) is doing real work and should be first in the list, not last.

### 2.4 🟡 Not even one PR per Phase is what happened

**Four Phases, three PRs.** #94 = Phases 1+2 (map:1539). #96 = Phase 3, merged `f242f3c8` with *"Codex waived on explicit Warwick authority, this occasion only"* (map:1765). #97 = Phase 4, still open (map:2368).

So the estate's real pattern is **one PR per merge event**, not per Phase and certainly not per boundary. That is a *weaker* rule than Larry's, and it is the one the evidence supports.

---

## 3. THE PR QUESTION — answered from mechanism, not preference

**Warwick's assumption does not survive. Larry's replacement is right; his tag proposal should be deleted.**

### 3.1 What the assurance machinery actually binds to

| Reviewer | Binds to | Evidence |
|---|---|---|
| **Veritas** | `reviewed_sha` · `governance_sha` · `worktree_head_at_start/end` · `worktree_status_clean` | `2026-08-06-veritas-gate1-amended-wp-f0d2614-receipt.md:6-13`. **PR #97 appears once, at `:33`, in "Deliberately not in scope"** |
| **Codex** | `--repo <dir> --base <ref> --head <ref> --claim <claim.json>`, optional `--paths` | `reviewDiff.mjs:23, 189, 200, 237` |
| **`/rotate`** | map path · phase/frontier · next action · report pointer · **closing head** | `rotate.md:72`. **`/rotate` has no PR step at all** |

**Nothing in the estate's assurance path takes a PR number.** The PR is where the change *lives*; the SHA is what is *reviewed*. **Larry's point 2 is confirmed by source, not by narrative. Confidence: High.**

### 3.2 The true requirement, in plain English

> **Every Sub-phase must end at a pushed commit whose exact SHA is recorded in the map and named in a Veritas receipt. That is the boundary. Nothing else is owed.**

No new branch. No new PR. No tag. No merge.

**Why a PR per Sub-phase is the wrong shape, in Warwick's terms:** a PR is a *proposal to merge*. A Sub-phase is explicitly **not** a proposal to merge. Opening one says something untrue about the work, and GitHub will then keep asking to close it, rebase it, or re-run its checks. Six Sub-phases in a Phase means six PRs whose bases all move every time the one below merges — that is the "unpaid apprentice" outcome, and it buys nothing the receipt SHA does not already give.

### 3.3 🔴 Attacking Larry's own candidate: **drop the annotated tag**

Larry proposes *"an annotated tag **or** a recorded immutable SHA."* Two ways to record one boundary is the duplication this estate keeps paying for.

A tag adds: a naming convention to invent · a push obligation · a cleanup obligation · a second place a boundary can be recorded, and therefore a second place it can disagree. **The estate already has an immutable, enumerable, content-addressed boundary record: the Veritas receipt.** It carries `reviewed_sha`, `receipt_sha256`, `branch`, `verdict` and `next_review_trigger` in frontmatter, it is committed, and it is enumerable by directory listing — which the BUILD-015 map already tells readers to trust *over* any table (`2026-08-04-build-015-asdair-wayfinder-plan.md:315`).

**Recommendation: recorded SHA in the map + the Veritas receipt. No tags. This is a deletion from Larry's proposal, not an addition.**

### 3.4 How stacked Sub-phase work assembles into ONE Phase review (Q5)

It already does, and the command exists:

```
node reviewDiff.mjs --repo <dir> --base <phase-base-sha> --head <phase-final-sha> --claim <claim.json> [--paths <pathspec>]
```

`--base` takes **any ref** — the previous Phase's merged SHA, or `merge-base(origin/main, HEAD)`. The claim is derived from the Wayfinder's recorded phase gate, which root `CLAUDE.md:94` already mandates.

**The honest constraint, which Larry did not bring and which changes his reasoning:** `gatherGitEvidence` caps the diff at **60k bytes and truncates** (`reviewDiff.mjs:210`). Phase 4 is **88 files, 12,702 insertions**. The comment at `:212-214` records the incident: *"Observed 2026-08-02: the Phase 5 range returned `approve` with 20/20 rows over a TRUNCATED diff."* **A false green wearing a pass.**

So a Phase-level Codex review **must** be scoped. And that is where the Sub-phase earns its keep at review time:

- Each Sub-phase declares the pathspec its work touched.
- `--paths` scopes the range; `scoped_to` in the claim is **machine-checked against that pathspec** (`reviewDiff.mjs:223`).
- The union of Sub-phase pathspecs is the Phase's declared review surface, and anything outside it is an explicit, written promise to verify another way (`:220-221`).

**Reframed conclusion: Sub-phase boundaries do not fragment the Phase review. They are what makes an honest scoped Phase review possible at all.** That argument is stronger than Larry's and it is grounded in source rather than in preference.

### 3.5 The CI argument — half-right, and I am labelling the half

Larry cites duplicated CI and tonight's Actions outage. **The outage is real** (`2026-08-06-ci-outage-and-local-evidence.md:8-17` — Actions `major_outage`, zero runs at head `bd11f96`, oldest queued 2h39m, zero self-hosted runners). **But an outage is not a stacked-PR cost, and the multiplication cost is unestablished — I have no measurement of per-PR CI spend.**

What *is* established and does bear: CI here is **path-filtered**, and the estate's own doctrine is *"An absent CI run is not a passing CI run"* (root `AGENTS.md:268`). N stacked PRs means N per-PR required-check surfaces on a mechanism where **unrun looks like green**. That is a judgement, not a measurement, and I am marking it so.

---

## 4. THE TWELVE QUESTIONS

**Q1 — Clear, useful, genuinely distinct from Larry's WPs?** **Yes on all three, and the distinctness is verifiable.** Warwick-called: map:2362 *"Warwick 2026-08-06 (amended — scope change, confirmed): this section is the session's durable accepted scope"*, and a table headed **"Package composition (Warwick)"** at :2376. Larry-called: §14.14 (map:1011-1027), where Larry split WP-2A three ways on Keel's refusals with the safety-critical sequencing note at :1020. **The two levels are already visible in one document, and Larry's mapping holds.**

**Q2 — Does it preserve BUILD-020's autonomy?** **Yes, and it is the correction PAX-03 asked for.** PAX-03 §3 Q1-Q2 attacked «Warwick calls Work Packages» precisely because it would have blocked §14.14. Warwick's withdrawal removes that. The line is now drawn at **scope**, which is decidable, rather than at **package**, which is not — and that line is already law (`CLAUDE.md` interrupt #1, *"a material change to agreed scope"*). **The withdrawal is correct and complete. Nothing further is owed here.**

**Q3 — Can he call one without prescribing the route?** **Yes, and it was done.** Map:2376-2383 gives four *blocks* (A: durability · B: CareerAIR + Cockpit · C: Veritas Gate 1 · D: Codex + merge pack) and rows 1-4 as *outcomes*. **No Work Order, no sequencing, no specialist named.** His three example sentences are the same shape. **Demonstrated, not asserted.**

**Q4 — New PR, or isolated Git boundary?** **Isolated boundary. See §3.** One branch and one PR per merge event; Sub-phase boundary = pushed SHA in the map + Veritas receipt. **No tags.**

**Q5 — Assembly into one Phase review?** **§3.4.** `--base`/`--head` + declared pathspecs. Already built.

**Q6 — When must a Sub-phase exceptionally take Codex or merge?** Warwick's five conditions are sound and I would not add one. **Two wording corrections:** (a) put *"Warwick orders it"* **first**, since §2.3 shows it is the operative case; (b) say **"not required"**, never "not appropriate."

**Q7 — Is Veritas-only sufficient for a normal Sub-phase?** **Yes, and it needs zero new wording.** In practice the Sub-phase already took **both** gates — rows 5 and 6 at map:2400-2401 dispatch Gate 1 *and* Gate 2 at the same head, Gate 2 returning HOLD with *"PR#97 unmerged; not phase-complete."* Existing law already blesses that: *"Gate 1 PASS + Gate 2 HOLD is a valid outcome"* (`CLAUDE.md`, map:2404). **A Sub-phase PASS is not a Phase PASS is therefore already binding and already exercised. Do not restate it.**

**Q8 — Avoiding reopened banked evidence?** **Already solved twice over. Point at it.**
- Map:2412 — *"### Prior mechanism evidence (banked — do not reopen without regression)"*.
- Map:2346 — Amendment 4's descope discipline: *"Row 3 is NOT withdrawn, softened or reinterpreted… Descoping changes what this package promises… it does not change what was found."*

⚠️ **One unresolved tension, recorded not fixed.** `CLAUDE.md:246` — *"A prior Gate 1 PASS on an older head is evidence for that slice only. It is **not** merge readiness for a later complete package"* — pulls against *"banked — do not reopen."* In practice the conflict was resolved by **Veritas widening scope herself** (`f0d2614-receipt.md:35`: *"Veritas **widened** to grade WP rows 1-4… no narrowing"*). That worked, but it worked because a reviewer exercised judgement, not because a rule decided it. **Do not write a rule for it. Record that the escape valve is Veritas widening, and that it is manual.**

**Q9 — SHIT TO DO without a meeting tax?** **Already required, verbatim.** `rotate.md:25` — *"Update the active Wayfinder with the truthful phase, gate, frontier, exact next action, branch and head, **and the deliberately parked residue. Parked is a decision and must look like one; silence reads as forgotten.**"* Add nothing. If it is not happening, that is a step-2 execution failure, and adding a second instruction to obey the first is the regrowth pattern PAX-03 already named.

**Q10 — What minimum wording is genuinely NEW?** **One sentence, plus two words of collision repair. Everything else is already law.**

| Warwick's proposed Sub-phase close condition | Already covered? | Where |
|---|---|---|
| Durable evidence, recoverable from Git and the map alone | **Yes** | `rotate.md:75, 78` |
| Truthful Wayfinder and rotation state | **Yes** | `rotate.md:25, 72, 80-81` |
| Safe fresh-session continuation | **Yes** | `rotate.md:85` — *"The fresh side is the acceptance test"* |
| Veritas assurance | **Yes** | Gate 1 already *"fires when an implementer returns work and Larry has integrated it"* (`Veritas AGENTS.md:84`) |
| Isolated reviewable Git boundary + exact evidence head | **Partially** — `rotate.md:77` covers durability, **not** the recorded boundary SHA | **This is the only genuinely new half** |
| Normally no Codex, no merge | **Yes** | `CLAUDE.md:246` already gates Codex behind Gate 1 PASS + CI green + head stable + Warwick's authority |

**Five of six are `/rotate` step 12 almost verbatim. The Sub-phase close IS `/rotate`, plus a recorded boundary SHA.**

**The single new sentence, drafted:**

> *A Phase may be divided into **Sub-phases**. Warwick calls them; Larry does not. A Sub-phase closes at `/rotate` with its exact integrated head recorded in the map and named in a Veritas receipt. It does not take its own branch, PR, Codex run or merge unless Warwick orders one or later work cannot safely proceed without it. **A Sub-phase PASS is not a Phase PASS.***

*(Last clause included only because it is the sentence most likely to be quietly re-crossed; it restates `CLAUDE.md`'s Gate 1/Gate 2 rule and could be cut if Warwick prefers the shorter form.)*

**Q11 — Where should it live?** Root **`CLAUDE.md` § Wayfinder**, appended to the phase-boundary bullet at **`:192`** — because that is the bullet the concept corrects (§1 finding 3). **No new SOP, Guideline, template, registry, validator or hook.** PAX-02 §7c already established that root `CLAUDE.md` § Wayfinder is the only canonical home and that a template file would create a second definition of a machine-read string.

**Q12 — What must be removed or corrected to prevent collision?** **Three items. One is a real correction; two are two-word parentheticals; nothing needs deleting.**

| # | Surface | Problem | Smallest fix |
|---|---|---|---|
| **1** | `CLAUDE.md:192` — *"Update a map only at a phase boundary"* | **Already false.** 47 map-touching commits inside 4 Phases (`INPUT-build020-git-history.md:92-137`); every Warwick amendment was mid-phase | **Correct it: "at a Phase or Sub-phase boundary."** This is the change that pays for the whole concept |
| **2** | `CLAUDE.md:232` heading *"Veritas dispatch — full Work Package, not Larry's preferred slice"*; `:234` *"a session Work Package"* | Under the new model, bare **"Work Package" means Larry's private unit** — so this heading now reads as *"do not let Larry narrow to Larry's own unit,"* which is incoherent | **One parenthetical:** *"…a session Sub-phase (the ACTIVE SESSION WORK PACKAGE on the active Wayfinder)…"* |
| **3** | `Veritas AGENTS.md:82` *"Gate 1 — Integrated work-package completion"*; `:88` *"A Work Package cannot be marked complete without `VERITAS_PASS`"* | **Neither Larry nor Warwick raised this.** If WPs become Larry's private decomposition, `:88` reads as *"every unit Larry invents needs a Veritas PASS"* — which would let free decomposition silently multiply the most expensive dispatch in the estate | **Probably nothing** — Gate 1's trigger at `:84` is already *integration*, not *Warwick's package*, and ~10 receipts on this branch match per-integration firing. **But it is Warwick's call, and it should be made deliberately rather than discovered later** |

**🔴 What must NOT be renamed.** `ACTIVE SESSION WORK PACKAGE` is a **fixed canonical section name that committed Veritas receipts bind to by name** — four of them (PAX-03 §2.2). Renaming it breaks every one of those bindings and violates PAX-03's own A-1 (*the frontier lives in a section with a fixed canonical name*). **"Sub-phase" is the name of the boundary; "ACTIVE SESSION WORK PACKAGE" stays the name of the map section that holds the current one.** They are the thing and its container, not two names for one thing.

**Verified absent, so no collision exists:** `sub-phase` / `subphase` — **zero matches anywhere in the repository.** *(Established by grep across `C:\Fusion247PKA-build-020-trial` at `fb3a61c`.)*

---

## 5. WHERE I DISAGREE WITH LARRY

1. **His point 2's third reason is refuted by source.** *"Stacked PRs would force Codex to review fragments rather than the assembled Phase"* — Codex **cannot** review an assembled Phase. 60k truncation, a measured false green, and PR #97's own claim scoped to ten pathspecs. **His conclusion survives; that reason does not, and the replacement (§3.4) is stronger.**
2. **His annotated tag should be deleted.** Two ways to record one boundary. The Veritas receipt already is the immutable, enumerable record. §3.3.
3. **His point 4 ("introduce it by using it, not by defining it in law") is wrong here, and it is the one place I would spend text.** The concept's highest value is that it **corrects a false canonical sentence** (`CLAUDE.md:192`). You cannot correct law by usage. **One sentence in law, and the vocabulary tax is genuinely one sentence.**
4. **His point 1 is right and I can now close it as verified rather than plausible** — map:2362, 2376, and §14.14 are the two levels in one file.
5. **His point 3 is right and needs zero words.** Confirmed at `CLAUDE.md:246`.

## 6. WHERE I DISAGREE WITH WARWICK

1. **«It does not change the Phase outcome or add scope» is falsified by his own Amendment 3** (map:2358, unparking work into scope). The constraint binds Larry, not Warwick — which his own longer text already says correctly. **Delete the summary sentence; keep the long one.**
2. **The Phase-close law is stricter than BUILD-020's best-executed close.** Phase 1 closed with no PR, no merge, no Codex and no Veritas PASS, on Warwick's own walkthrough. §2.1. He should decide whether that was a Phase or a Sub-phase before the law makes it retroactively non-compliant.
3. **«Normally does NOT need Codex» would have lost a real catch.** The one mid-phase Codex run produced `5135a24`, a `BLOCKS` finding that was implemented. Wording: *"not required"*, and *"Warwick orders it"* first.
4. **His PR assumption does not survive, and he was right to say so.** Nothing in Veritas, Codex or `/rotate` binds to a PR number. §3.1.

## 7. WHAT I COULD NOT ESTABLISH

- **No `Bash`.** Every claim read from committed artefacts at `fb3a61c`. No command, test or resolver was run. The `sub-phase` absence claim rests on one `Grep` over the trial worktree — **it is not established across branches, `origin/main`, or `C:\.fusion247\**`** (out of surface).
- **Whether PR #94 was ever merged, and at what SHA.** Map:1539 records it open as a draft; map:1575 says Phase 2 is *"CLOSED and MERGED"*; **the two are not reconciled anywhere I read.** Unestablished.
- **Per-PR CI cost.** No measurement exists. §3.5's stacked-CI argument is judgement.
- **Whether the ~10 Veritas dispatches on this branch actually correspond one-to-one with integrations** rather than with re-reviews. I counted receipts, not integrations. The Q12 item 3 conclusion is therefore **probable, not established.**
- **Whether Warwick's felt problem ("the Phase is too large for one operating window") is the same problem the artefacts show.** He described an operating experience; I found a map-update rule that is false and a vocabulary collision. **They may not be the same thing.**
- **Fact vs judgement.** §2, §3.1, §3.4 and every quoted line are sourced fact with file and line. §1's framing, §3.2, §3.3, §3.5's second half, §4's recommendations, §5 and §6 are **my judgement** built on that evidence.
