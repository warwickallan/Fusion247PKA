---
name: PAX-02-wayfinder-transferability
type: research-brief
commission: Wayfinder transferability (Warwick, 2026-08-06)
author: Pax
created: 2026-08-06
governance_head: 0cf70c9c5cfbadeddfae13fdd4a4c5dbc6e3f34c
branch_read: build-020/phase4-automation-law
private_surface: none
status: report-and-recommendation-only
---

# PAX-02 — Wayfinder transferability

**Report and recommendation only. Nothing was implemented. No canonical instruction, template, SOP, Guideline, registry, validator or hook was created. The BUILD-020 worktree was read and never written.**

> **Same-model honesty note.** The artefacts under review were authored by the same model in earlier sessions. This is a structured read of committed evidence, not external verification. Where a claim rests on Larry's own narrative with no corroborating artefact, it is labelled **single-source**.

---

## 1. EXECUTIVE VERDICT

BUILD-020 improved for **one structural reason and three mechanical ones**, and they transfer very differently.

**The structural reason: the map stopped competing with itself.** Phase 1's map carried three simultaneous frontier statements — the rotation block, §12's heading, and §12's tail — all authoritative-looking, all disagreeing. Keel found it (`WP-2B(2)` read-back, P-4) and the map records the counterfactual in its own words: *"Any code scraping §12 would have emitted 'Phase 3, Veritas HOLD, next action: Warwick re-attempts the walkthrough' — a confident wrong orientation, delivered by the very mechanism built to prevent it"* (map:427). The repair — **exactly one section states the live frontier; every other frontier-shaped block is struck and carries a pointer to it** — is the single highest-value thing this build produced, and **it has no canonical home anywhere.**

**The three mechanical ones**, in descending order of proven value:

1. **The read-back gate turned Larry's Work Orders from a liability into a checked artefact** — 13 class-A refusals across 15 orders (map:1702), every one a defect in Larry's order rather than in the work, and at least three of which would have shipped a false green.
2. **`resolveActiveMapPath`** made "which map is active" a machine-answered question derived from git, with **honest absence** (null) rather than a guess. This is the mechanism that makes map-to-map transfer possible at all.
3. **The ACTIVE SESSION WORK PACKAGE** (introduced `72866f4`) gave every downstream consumer — Work Orders, Veritas dispatch, `/rotate`, merge-readiness — one durable source, and closed the "Veritas graded Larry's preferred slice" hole.

**And one thing that did NOT improve, recorded because it is the most honest datum in the build:** the Warwick notification failure. It was diagnosed, given canonical law (Rule 4a), given a zero-model hook — and the hook was measured firing at the *wrong event*, then **explicitly reclassified as MANUAL** under Veritas V4-4 (map:2044-2054). Two recorded misses in one session remain unguarded by anything but Larry's judgement. **Do not transfer this as a success.**

**On Warwick's proposal that a canonical Wayfinder instruction layer is now required: YES, and it already exists.** Root `CLAUDE.md` § Wayfinder is the canonical home and is ~85% complete. It is missing exactly three clauses. **My recommendation is a single ~40-line amendment to that one existing section — no new SOP, no new Guideline, no new template file, no registry, no validator.** Nolan's 2026-08-01 rejection of the SOP+Guideline **stands, though one of his two reasons is now void** (§7).

---

## 2. BUILD-020 IMPROVEMENT TIMELINE

Traced from the map's own phase records, the staged commit history, and the receipts. **Causation labels are applied per row and are not decorative.**

### Phase 1 — Proofline (2026-08-04)

| What changed | Evidence | Causation |
|---|---|---|
| **Map written before implementation, then falsified by the worker's executed read-back.** Keel returned `REFUSE` (class-A) and overturned four of the map's own claims — C-1 (a proof that does not exist and could only "pass" by fabrication), C-2 (`.data/` was not gitignored on a **public** repo), C-3 (stale HEAD), C-4 (a measured 2.451 ms made the claimed observation impossible) | map:96-109 | **DEMONSTRATED.** The artefact records four specific claims that would have been built against. C-1's counterfactual is explicit: *"the only way to make it 'pass' was fabrication"* |
| **Corrections recorded, not overwritten.** Amendment 1 is a table of what v1 claimed vs what execution proved | map:100-106 | Design choice; value asserted, not measured |
| **Larry recorded Phase 2 as `PASS` without authority; Veritas caught it (D-12)** | map:384, 411 | **DEMONSTRATED.** A label was written and reversed by an independent reviewer |
| **Warwick's own walkthrough FAILED** on two shipped launcher defects, and **the failure record was kept at his instruction** | map:386 | **DEMONSTRATED.** Both defects reproduced mechanically as controls |

**Phase 1's transferable lesson:** the read-back caught order defects that no preflight would have — because the defects were *in the plan*, not in the specification of the work.

### Phase 2 — Honcho and Tower (2026-08-05)

| What changed | Evidence | Causation |
|---|---|---|
| **⭐ The single-frontier rule.** §12 demoted to `⛔ SUPERSEDED AND HISTORICAL`, §14.19 declared *"the ONLY place in this map that states the live frontier"*, and the rotation block's own frontier row replaced with a pointer | map:19-20, 421-431, 1425 | **DEMONSTRATED as a defect; the fix's benefit is a counterfactual.** The three-way disagreement is verbatim in the artefact |
| **⭐ `resolveActiveMapPath`** — active map selected by content marker + branch-scoped git recency, ambiguity → null, existence verified | `~/.mypka/governor/continuity.mjs:163-334`; map:622, 1432 | **DEMONSTRATED, measured.** The source comment records the estate measurement: the marker finds six maps and *correctly excludes* `2026-08-01-vlogops-wayfinder-plan.md`, which a filename filter would have swept in |
| **Honest absence made the design rule.** *"a confident wrong orientation is worse than a blank one"* — `state.map_path` is deliberately never consulted, so a stale local value cannot become tomorrow's orientation | `continuity.mjs:170-178` | **DEMONSTRATED in source.** The negative path is coded, not promised |
| **The refusal ledger (§14.21)** — seven class-A refusals written out once, with six named patterns. Then **corrected by Veritas for UNDER-COUNTING** ("six" and "EVERY ONE" were both false at seven) | map:1504-1529 | **DEMONSTRATED.** The self-serving artefact was sent to be challenged and was found wrong |
| Two faults **partially masked each other** (`map_path` stripping + a fail-open guard), invisible to component testing *and* to a single end-to-end sample | map:1631 | **DEMONSTRATED.** The phase's central test-design finding |

### Phase 3 — delivery tax and the governor (2026-08-05)

| What changed | Evidence | Causation |
|---|---|---|
| **The governor footer RETIRED** after measuring 79k / 79k / 39k tokens to render three status lines. Warwick's diagnosis: *"proof that a model should never have been in this path"* | root `CLAUDE.md` § governor status line; map:1768 | **DEMONSTRATED, measured** |
| **`tools/wo/envelope.mjs`** built — deterministic copy of canonical tools, surfaces, authority defaults, git authority, worktree state, producible evidence | map:1808-1813; `tools/wo/README.md` | Capability delivered |
| **`/rotate` restored** as the single pre-`/clear` transaction, wrapping `/close-session` + installed Honcho + publish-and-readback | `.claude/commands/rotate.md:11-19` | Capability delivered |
| **WP-3F (Nolan per-order check) APPROVED** by Warwick 2026-08-05… | map:1668-1715 | — |
| **…then PARKED UNRATIFIED on 2026-08-06.** *"Nolan remains an occasional structural/audit role, never a routine checker on every Work Order"* | map:1800-1802 | **Reversal recorded. Do not transfer as an adopted mechanism** |

### Phase 4 — automation law (2026-08-06, the branch read)

88 files, 12,702 insertions, 60 deletions. The improvements are concentrated here.

| # | What changed | Evidence | Causation |
|---|---|---|---|
| **4.1** | **⭐ ACTIVE SESSION WORK PACKAGE** — one durable session authority. *"All Work Orders, Veritas dispatches, `/rotate` reporting and merge-readiness statements derive from [it]. No requirement may live only in chat, Larry's context or a stale rotation packet"* | map:78, 2338-2453; commit `72866f4` | **DEMONSTRATED for scope propagation** (receipts now grade rows). The *durability* claim is design, not measurement |
| **4.2** | **Veritas full-package dispatch law** — seven mandatory dispatch contents, **separate PASS/HOLD/FAIL per numbered functional requirement**, and an explicit **prohibition on narrowing** to an older product slice | root `CLAUDE.md` § Veritas dispatch; `Templates/veritas-receipt.md:69-76`, `:131` | **DEMONSTRATED.** The `f0d2614` Gate 1 receipt returns per-row verdicts (rows 1/3/4 PASS, row 2 residual). *"An overall PASS cannot conceal a held mandatory requirement"* is now enforced by the template |
| **4.3** | **⭐ "Nothing may live only in Larry's head"** — canonical automation bar with a six-part acceptance test, projected onto four surfaces. **The overstated count ("five projections") was self-corrected to four-plus-a-self-reference** rather than defended | root `CLAUDE.md`; map:1939-1957 | **DEMONSTRATED against its own author, twice in one session** (V4-4 and the J1-1 reclassification) |
| **4.4** | **ORDER_MARKER route.** Every order must be produced by `envelope.mjs` and carry `GENERATED by tools/wo/envelope.mjs`; **workers REFUSE an unmarked order** as class A | `SOP-022:274-284`; `tools/wo/README.md:3, 28` | **DEMONSTRATED.** WO-23 was hand-authored and Keel refused on exactly this ground (R2) |
| **4.5** | **The generator caught a live class-A defect at issue time.** WO-21 required evidence *"by execution"* from **Pax, who has no `Bash`**. The generator derived `producible_evidence` from the tool grant and emitted the contradiction. *"The generator caught it, not Larry"* | map:2062-2066 | **DEMONSTRATED, single instance, and it is the cleanest causal datum in the build** |
| **4.6** | **Measured generator effect:** prevents **11 of 41** scored historical defects (**27% by defect**) while touching **8 of 13** affected orders (**62% by order**). Warwick: *"Never quote either rate without its unit"* | map:1810 | **MEASURED.** Single-source (no independent recount found) |
| **4.7** | **J1-1 honestly refused closure by `tools/wo/**` alone.** Keel's read-back established that *"every acceptance criterion there is satisfiable by manually invoking the tool"*; closure required a **route change outside the tool** | map:1819 | **DEMONSTRATED.** The automation bar bit its own repair |
| **4.8** | **Return-cue proven by the REAL production event** — Keel dispatched as a genuine background specialist → returned → `SubagentStop` → marker → parent's next `PreToolUse` injected the cue **before the summary**. Exactly-once confirmed by an empty state dir | `2026-08-06-wo23-keel-refusal-and-findings.md:151-156` | **DEMONSTRATED.** This is the estate's first artefact meeting the §"Nothing may live only in Larry's head" acceptance test in full |
| **4.9** | **WO-23 read-back refuted Larry's stated root cause.** Larry blamed the sweep's session-id guard; Keel showed `return-cue-consume.mjs:109` makes cross-session consumption impossible, so the real cause was **TTL survival across a boundary that preserves the session id**. *"Fixing only it would produce a green that leaves the observed defect live"* | same file:25-46 | **DEMONSTRATED, and the highest-value single catch in Phase 4** |
| **4.10** | **CI outage handled as `required-but-unavailable`,** not argued around. *"A Gate 1 HOLD on the CI dimension is therefore the correct and expected outcome, and must not be argued around"* | `2026-08-06-ci-outage-and-local-evidence.md:19-22` | **DEMONSTRATED.** Local evidence offered explicitly as *capability, not a CI pass*, with the unrun workflows **named** |
| **4.11** | **A red test reported once and NOT actioned** — the Codex reviewer-contract staging test fails, is outside CI, is out of scope, and *"NOT turned into a Work Order"* | same file:45-71 | **DEMONSTRATED.** Finding-disposition discipline held under pressure |
| **4.12** | ❌ **Rule 4a + notification hook — NO IMPROVEMENT DEMONSTRATED.** Hook fired at **dispatch**, not return (background agent returns are task notifications, not tool results). Explicitly reclassified **MANUAL**. *"the attention failure has no automated guard, by design and by Warwick's ruling"* | map:2015-2054 | **DEMONSTRATED NEGATIVE.** Transfer the *reclassification discipline*, never the hook |

### Where the causation actually is

- **Strongest (executed artefact shows the wrong thing was prevented):** 4.5, 4.9, Phase-1 read-back, 4.7, 2.2 (`resolveActiveMapPath` measurement).
- **Measured but single-source:** 4.6, the 79k/79k/39k footer measurement.
- **Correlation + named mechanism, counterfactual only:** the single-frontier rule, the ACTIVE SESSION WORK PACKAGE, Veritas scope propagation.
- **Demonstrated negative:** 4.12.
- **Unestablished:** whether the 2026-08-06 fresh-session journey (map:1786 — *"orientation recovered this map and the frontier from the Honcho pointer with `Continue` as the only input"*) was independently observed. **Single-source, Larry's own record.** It is the load-bearing evidence for Honcho being "CLOSED", and it has one witness.

---

## 3. TRANSFER MATRIX

Grouped as the commission requires. **Not every successful detail is promoted.**

### 3a. Generic Wayfinder behaviour — TRANSFER

| Lesson or mechanism | BUILD-020 evidence | Generic / Proofline-specific | Existing canonical home | Missing canonical home | Risk if omitted on transfer | Smallest transfer action |
|---|---|---|---|---|---|---|
| **⭐ Exactly ONE section states the live frontier; every other frontier-shaped block is struck and points at it** | map:19-20, 421-431, 1425 — three simultaneous frontiers, found by a worker | **Generic** | **NONE** | root `CLAUDE.md` § Wayfinder | **The highest-consequence omission in this brief.** A new map reproduces the exact defect, and the installed pointer machinery will faithfully deliver the wrong frontier | **One clause** in root `CLAUDE.md` § Wayfinder |
| **⭐ The verbatim START/RESUME marker is a MACHINE-READ INTERFACE** — `git grep -F` on *"On a fresh resume, BEFORE using any tool or doing any work, visibly state"* is how the active map is discovered | `continuity.mjs:200, 308`; commit `ed5e96f` *"restore Honcho map marker on BUILD-020 map"* — **it was lost once and had to be restored** | **Generic** | `CLAUDE.md` says "copy verbatim" but **never says why, and never says what breaks** | Same section | An editor tidies the block, the marker changes, and active-map discovery goes **silently null** across the whole estate | **One clause** naming it as an interface, quoting it, and stating the consequence |
| **Honest absence over a confident guess** — ambiguity → null; existence verified; stale local value never consulted | `continuity.mjs:170-178, 317-333` | **Generic** | Implicit in `CLAUDE.md` ("never a plausible-looking guess") | Adequate as-is | Low | **None.** Already covered |
| **The map records its own corrections rather than overwriting** (Amendment 1; §14.21's under-count correction; §17.3's "five→four" correction) | map:96-109, 1506, 1947 | **Generic** | `CLAUDE.md` § Wayfinder: *"record contradictions rather than silently overwriting"* | Adequate | Low | **None** |
| **Struck-through text retained because "the reasoning is the durable part"** | map:24, 1471-1477 | Generic | None | Not worth a clause | Low | **None** — it is a habit, and habits that cost nothing need no law |
| **⭐ An exact next action written in a shape the commit carrying it cannot falsify, plus a one-command DISCHARGE TEST the reader runs before acting** | **BUILD-015 map:418-455**, not BUILD-020 | **Generic — and BUILD-020 never adopted it** | NONE | root `CLAUDE.md` § Wayfinder | Every next action goes stale silently; the reader cannot tell | **One clause.** See §6 |
| **Phases shaped by GATE QUESTION, not by narrative progress** | BUILD-015 map:351-359 (six phases, each with *"the question the gate answers"*) | Generic | Partially — `CLAUDE.md` requires phased outcomes | Same section | Phases decay into a task list and stop being answerable | Folded into the same clause |

### 3b. Work Order / team behaviour — TRANSFER (mostly already homed)

| Lesson or mechanism | BUILD-020 evidence | Generic / specific | Existing canonical home | Missing home | Risk if omitted | Smallest transfer action |
|---|---|---|---|---|---|---|
| **Read-back before acting, then free method** | 13 class-A refusals / 15 orders (map:1702); WO-23 F1 | Generic | root `CLAUDE.md` § Specialist dispatch; SOP-022 | — | — | **None** |
| **ORDER_MARKER: generation is the ordinary route; workers REFUSE unmarked orders** | `SOP-022:274-284`; WO-23 R2 | Generic | **SOP-022 — canonical, correct** | — | — | **None** |
| **A finding is an observation, not an instruction** | `ci-outage:67`; map:401 | Generic | root `CLAUDE.md` § Finding disposition | — | — | **None** |
| **The refusal PATTERNS** (surface declaration is the weakest discipline; acceptance properties outrun the surface; repeating a just-documented defect) | map:1520-1528 | Generic — **the six patterns**. The *statistics* are BUILD-020-specific | SOP-022 § class-A taxonomy | Patterns are not enumerated there | A fresh Larry reissues a known-defective order shape | **Optional.** Six bullets in SOP-022. Low priority — the read-back already catches them |
| ❌ **Nolan as per-order checker** | Approved `2026-08-05`, **PARKED UNRATIFIED `2026-08-06`** (map:1800) | — | — | — | — | **DO NOT TRANSFER** |

### 3c. Assurance and release behaviour — TRANSFER

| Lesson or mechanism | Evidence | Generic / specific | Existing home | Missing home | Risk if omitted | Smallest action |
|---|---|---|---|---|---|---|
| **Veritas full-package dispatch: seven mandatory contents, per-row verdicts, prohibition on narrowing** | root `CLAUDE.md` § Veritas dispatch; `veritas-receipt.md:69-76` | Generic | **root `CLAUDE.md` + template — both canonical, both correct** | — | — | **None** |
| **Gate 1 PASS + Gate 2 HOLD is a valid outcome; Gate 1 ≠ phase PASS** | map:2390; `CLAUDE.md` | Generic | root `CLAUDE.md` | — | — | **None** |
| **`required-but-unavailable` is a legitimate HOLD, never argued around** | `ci-outage:19-22` | Generic | `CLAUDE.md` interrupt code 5 gloss | — | — | **None** |
| **A prior PASS on an older head is evidence for that slice only** | root `CLAUDE.md` § Veritas dispatch | Generic | Canonical | — | — | **None** |
| **Larry may not record a phase PASS** | map:384, 411; BUILD-015 map:340 | Generic | Canonical | — | — | **None** |

### 3d. Session Governor behaviour — TRANSFER with one gap

| Lesson or mechanism | Evidence | Generic / specific | Existing home | Missing home | Risk if omitted | Smallest action |
|---|---|---|---|---|---|---|
| **`/rotate` publish-and-READ-BACK gate; write success is not delivery** | `rotate.md:70, 100` | Generic | **`.claude/commands/rotate.md` — canonical** | — | — | **None** |
| **Pax writes the session report inside the transaction, because `/clear` destroys the evidence** | `rotate.md:31-58`; map:1977-1985 | Generic | `rotate.md` | — | — | **None** |
| **Never derive the packet from memory — the Wayfinder is the source** | `rotate.md:101` | Generic | `rotate.md` | — | — | **None** |
| **⚠️ Step-11 read-back compares map path · phase/frontier · next action · report pointer · closing head — but NOT `focus`** | `rotate.md:72`; and `focus` is the field that misdirected a fresh Larry into BUILD-015 twice (`rotate.md:19`; map:1475-1477) | **Generic gap** | `rotate.md` step 11 | The one-word omission | The exact historic failure — *"Both times the map pointer was correct and the orientation was wrong"* — is still reachable through the free-text `focus` field | **Add `focus` to the step-11 comparison list.** One word in an existing file |
| **Retire a mechanism that costs a model invocation to render a line** | `CLAUDE.md` § governor status line, 79k/79k/39k | Generic | Canonical, with the reasoning preserved | — | — | **None** |

### 3e. Machine / install behaviour — TRANSFER, do not generalise

| Lesson | Evidence | Verdict |
|---|---|---|
| Install from `git cat-file blob`, never the working tree (`core.autocrlf` makes them differ) | map:2330; P-10 | **Generic and load-bearing.** Already recorded as P-10, estate-wide, awaiting Warwick's decision. **Not a Wayfinder concern** — leave it where it is |
| MSYS `/FLAG` mangling; `MSYS_NO_PATHCONV=1` | map:44-55 | **Machine-specific.** Belongs in a machine note. **Do NOT copy into every map** |
| `node --test` counts helper modules and returns exit 0 on zero tests — assert the count, never the exit code | map:168; P-8 | **Generic evidence rule**, already stated in three places. Leave it |
| win32 kill reports `code=1, signal=null`, not SIGKILL | map:307 | **Proofline-specific.** Discard |

### 3f. Product-specific Proofline content — DO NOT TRANSFER

§5 (the whole HTTP/processor/journal contract), §5.2 processor spec, §5.6 replay, §5.7 keys, §8 T-1..T-9, G-1..G-11, D-1..D-11, F-1..F-4, P-2/P-3/P-4/P-6/P-9/P-11/P-12/P-13. **All of it is product. None of it is method.**

---

## 4. EXISTING-WAYFINDER RECOVERY — BUILD-015 ASDAIR AS THE WORKED CASE

**Verdict: salvageable, and in one specific respect it is BETTER built than the BUILD-020 map.** Its §10 discharge test is the best stale-frontier defence in the estate and BUILD-020 never adopted it.

### 4a. Status of its content, line by category

| Category | What |
|---|---|
| **CURRENT** | The six-phase gate-shaped route (§9) · the goal-contract pointer (§1) · security/ownership/recovery boundaries (§7) · known decisions (§4) · the regrowth-cap block (§11) · §10's discharge test · §12's resumable-state list · the human-dependency table (§6) |
| **STALE (and self-declared)** | Every SHA — *"every head named here will have moved — resolve it yourself"* (:129) · the suite counts (:137) · the receipt table (:315 says *"enumerate the directory rather than trusting this table"*) · the dirty-working-tree file list (:517-536, dated 2026-08-04) |
| **SUPERSEDED** | Nothing inside the map. **But the estate law beneath it has moved**: `CLAUDE.md` now carries Rule 4a, the automation bar, the ACTIVE SESSION WORK PACKAGE concept, the Veritas full-package dispatch law and the ORDER_MARKER route. **None of these exist in the Asdair map.** That is the actual rebaseline job |
| **HISTORICAL** | The retrospective framing block (:56-97) — *"a route record for the remainder. It is not a plan that governed the work"* |
| **UNKNOWN** | Everything marked `UNVERIFIABLE OFFLINE` — fog items 1-6, the live DB, CI. **These are not stale; their status was never established.** Do not convert them to "stale" on rebaseline · fog item 7 (a corrected record not reaching a fresh agent) has **two candidate mechanisms, both falsified, and no third offered** — that discipline must be preserved verbatim |

### 4b. Is the phased route still coherent? **Yes.**

Because it is phased **against assurance gates, not against narrative progress** (:345). Phase 2 asks *"Can Warwick's plan survive a process death?"*; Phase 3 asks *"Photograph → checkout-ready basket, in the real intended context?"* Gate questions do not decay with time the way a next action does. **This is the durable design property and it is the strongest single argument for §6's recommendation.**

The independent audit corroborates the route's premise rather than undermining it: `END-TO-END-PROCESS-AUDIT.md:20` answers **"NO"** to whether Warwick can get a basket without Larry, and enumerates seven breaks — five of which map cleanly onto the map's Phase 2 and Phase 3. **Two independent artefacts agree on where the build stands.** Confidence: **HIGH.**

### 4c. The blocking condition that must not be skipped

**Warwick authorised the six-phase ROUTE. He has never read or accepted the MAP as a document.** The map states this itself, twice, unprompted (:91-97, :280-281). It also records that its own authorisation record is *"Larry's account of it — attested by Larry, not verifiable from the repository"* (:80-83) and that Veritas was **right** to find it unevidenced.

Consequence, and it is exact: the map may direct **Phase 0 documentation and assurance work** under the authorised route. **A fresh instance may not begin Phase 1 on it.** Root `CLAUDE.md` § Wayfinder — *"Do not begin implementation until Warwick accepts the plan"* — is satisfied for the route and **not** for the map. **No new rule is needed; the existing one binds.**

### 4d. How to rebaseline WITHOUT rewriting its history

Five moves, all append-only:

1. **Append one dated amendment block** immediately under the retrospective framing block, headed with the date and the head it was written at. Never edit §§1-12 in place — the map's own value is that it shows its corrections.
2. **Append an ACTIVE SESSION WORK PACKAGE section** carrying: branch · worktree · the numbered functional requirements for the *next* session only · the assurance/release sequence rows separately · explicitly out-of-scope · the exact next action. **This is the single largest thing BUILD-020 has that BUILD-015 lacks.**
3. **Do not touch §10.** Its discharge test is the recovery mechanism; run it, do not replace it.
4. **Do not remove the START/RESUME marker.** Removing it deletes the map from machine discovery — the failure `ed5e96f` had to repair on the BUILD-020 map.
5. **Add one line to the amendment block naming the estate-law delta** (Rule 4a · the automation bar · Veritas full-package dispatch · ORDER_MARKER) as *"binding on this build from this date, canonical elsewhere, not restated here."* A pointer, never a copy.

### 4e. What evidence is required before it may direct work again

**All five, and they are executable:**

| # | Required evidence | How it is produced |
|---|---|---|
| E-1 | Run the map's own discharge test — `ls Builds/BUILD-015-…/Assurance/` — and record whether a receipt names the resolved head | One command. The map tells the reader to believe it over the map |
| E-2 | `git rev-parse HEAD` · `git status --porcelain` on the BUILD-015 branch, with the six known-unrelated dirty paths identified **by path, not by count** (:531) | Executed, banked in the amendment block |
| E-3 | `gh pr list --state open` — never carried forward | Executed |
| E-4 | **The active-map pointer resolves to the Asdair map** — `node ~/.mypka/governor/continuity.mjs read` renders `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` | Executed. See 4f — **this is the one that can silently fail** |
| E-5 | Warwick's acceptance of the map **as a document** if Phase 1 is to start; or an explicit statement that only Phase 0 proceeds | `product-decision` |

### 4f. Replacing its stale frontier safely, and PROVING a fresh session resumed Asdair not BUILD-020

**The proof is mechanical and already built. It is also the place this will go wrong.**

`resolveActiveMapPath` (`continuity.mjs:294-334`) selects: `git grep -F <marker> -- Deliverables` → candidates; then **most-recently-committed within `merge-base(origin/main, HEAD)..HEAD`**; **falling back to repo-wide recency only when the branch has touched no map at all**; ambiguity → null; existence verified.

**Therefore:**

- **The correct move is one commit.** Committing the rebaseline amendment **to the Asdair map on the BUILD-015 branch** makes it the most-recently-committed map in that branch's range, and the pointer follows. There is no field to edit and no registry to update.
- **The failure mode, stated exactly:** if the BUILD-015 branch is resumed *without* touching its map, the branch-scoped query returns nothing, the **repo-wide fallback fires**, and it selects the most recently committed marker-carrying file in the estate — which today is the BUILD-020 map. **A fresh Larry would be confidently oriented to BUILD-020 while working BUILD-015.** This is precisely W-1's named failure, reachable today, through the mechanism built to prevent it.
- **The proof, and it is one command:** after the rebaseline commit, `node ~/.mypka/governor/continuity.mjs read` must render the Asdair path. If it renders the BUILD-020 path or renders nothing, the transfer has **not** happened — regardless of what any document says.
- **Second, human-side proof:** the fresh session, before any tool call, states the four things §12 requires — map path, goal, phase and gate, exact next action — and the stated path is the Asdair map. This is the map's own contract with itself (:497-506).

⚠️ **Contradiction found, recorded not resolved.** Six files in `Deliverables/` carry the marker (verified by grep, this session): the BUILD-019, BUILD-006 VlogOps, BUILD-015, BUILD-020 and operating-reset maps — **and `2026-08-02-tower-watcher-github-sqlite-migration-plan.md`**. `continuity.mjs:188-191` calls all six *"real maps"*. The BUILD-020 map §13.3 (:492) calls that sixth file *"stale on facts… Treat it as a decision record, not a state record."* **Both statements are in the estate and they disagree about whether a stale decision record is an eligible active-map candidate.** It is currently eligible for automatic selection under the repo-wide fallback. **Reported once for Warwick's decision. Not a Work Order, and I am not choosing a side.**

---

## 5. ACTIVE-MAP SWITCHING METHOD

**The minimal safe lifecycle is six steps, and every one runs on an existing route. No new mechanism is needed and none should be built.**

| # | Step | Route | Why |
|---|---|---|---|
| **1** | **Bank the outgoing map** — run `/rotate` to `SAFE TO CLEAR` | `.claude/commands/rotate.md` | Its seven conditions already cover map truthfulness, worker returns, git durability, report existence and Honcho read-back. Switching maps without this is switching away from unbanked work |
| **2** | **Mark the outgoing map's status at the top** — one line: `PAUSED` or `CLOSED`, the date, and the path of what is now active | Edit the map | The estate's own proven pattern is §12's `⛔ SUPERSEDED — DO NOT READ THIS AS THE CURRENT FRONTIER → §14.19 is the SINGLE statement`. Apply it at map level |
| **3** | **Do NOT remove the outgoing map's marker** | — | It would delete the map from its own future recovery, and it is not obviously reversible to a later reader |
| **4** | **Move the pointer by COMMITTING a touch to the destination map on the working branch** | git | There is no pointer field. `resolveActiveMapPath` is branch-scoped-first / most-recently-committed. **This is the entire mechanism** |
| **5** | **Publish and read back** — `continuity.mjs write` then `read`; confirm `map_path` is the destination | `/rotate` steps 9-11 | *"A write that reports success is not a delivery. Only the read-back is evidence"* (`rotate.md:70`) |
| **6** | **Fresh-session verification** — `Continue.`, and before any tool call the session states the destination map path, goal, phase/gate and next action | `CLAUDE.md` Step 2 | `rotate.md:85` already calls this *"the acceptance test"* |

**Keeping Honcho a pointer** requires no discipline at all for `map_path`: the writer never consults `state.map_path`, so a stale local value **cannot** become tomorrow's orientation (`continuity.mjs:176-177`). It is architecturally guaranteed.

**Preventing two maps directing work** is also largely structural: ambiguity returns null, and each map carries its own precedence block declaring the others non-directive (BUILD-020 map:34-40; BUILD-015 map:26-49).

### Failure cases — all four, with the honest status of each

| Failure | Status | Residual |
|---|---|---|
| **Stale Honcho CONTENT** (not the pointer) | **LIVE GAP.** It has happened twice — a BUILD-015 focus for BUILD-020 work, and a phase that closed the day before (`rotate.md:19`; map:1475-1477). *"Both times the map pointer was correct and the orientation was wrong"* | `focus` is free text; nothing derives it from the map; `/rotate` step 11 does not compare it. **Smallest fix: add `focus` to the step-11 comparison list — one word** |
| **Stale next action** | **Mitigated only where the Asdair discharge-test shape is used.** BUILD-020 does not use it | See §6. No mechanism can fix it — the shape can |
| **A map never accepted** | **Covered by existing law** (`CLAUDE.md` § Wayfinder). BUILD-015 is the live instance | The risk is that the map's own honest disclosure gets read past. Keep it at the top of the file, not buried |
| **Two maps directing work** | Structurally guarded, **except** through the repo-wide fallback on a branch that has touched no map (§4f) | One commit to the destination map closes it every time. **This must be written down; it is currently only implicit in source comments** |

---

## 6. NEW-WAYFINDER CREATION METHOD

### 6a. Minimum required content — from an accepted Goal Contract

Root `CLAUDE.md` § Wayfinder already lists eleven required elements. They are correct and I am not restating them. **What must be ADDED to that list, drawn from BUILD-020 and BUILD-015 evidence:**

| # | Required element | Source of the requirement |
|---|---|---|
| **N-1** | **The START/RESUME block copied VERBATIM** from `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md` — already mandated, but now with the reason stated: **its first sentence is the marker `resolveActiveMapPath` greps for.** Change it and the map disappears from discovery | `continuity.mjs:200`; commit `ed5e96f` |
| **N-2** | **Exactly ONE section that states the live frontier.** Every other frontier-shaped block carries a pointer to it and no status of its own | map:19-20, 425-429 |
| **N-3** | **An ACTIVE SESSION WORK PACKAGE section**, from which every Work Order, Veritas dispatch, `/rotate` report and merge-readiness statement derives — with **functional acceptance rows numbered separately from assurance/release sequence rows** | map:78, 2350, 2373-2390 |
| **N-4** | **The exact next action written in a shape the commit carrying it cannot falsify, plus a one-command discharge test** the reader runs *before* acting | BUILD-015 map:418-455 |
| **N-5** | **Phases shaped by their gate QUESTION**, one per phase, not by narrative progress | BUILD-015 map:351-359 |
| **N-6** | **A precedence block** naming which sibling documents are non-directive | Both maps |
| **N-7** | **The automation-frontier clause as a POINTER** — an outcome intended to be automatic stays on the frontier until the root-clause test passes | root `CLAUDE.md` § Wayfinder (already present) |

**Acceptance process:** unchanged and already canonical — Larry proposes, Warwick accepts as a `product-decision`, and implementation does not begin before that. BUILD-015 is the standing example of what happens when the *route* is accepted and the *map* is not: they are different decisions and the map must say which it holds.

### 6b. What must NOT be copied into every map — and this is the section that saves the most

**The BUILD-020 map is 2,453 lines.** BUILD-018's 454-line map **exceeded a single-tool-call read cap** and Nolan called it *"a live retrieval cost, paid on every dispatch"* (NOLAN-02:70-74). BUILD-020's map is **5.4× that size**, and Nolan's TRIM verdict — *take the size cap, drop the fixed five headings* — **was never applied.** This is his anti-pattern A-2 (*"the map becomes a build journal"*) recurring at scale, and BUILD-020 confirms rather than refutes it.

**Never copy:**

1. **Product contract detail.** §5's HTTP/processor/journal specification is 90 lines of product truth in a navigation artefact. It belongs in the build record or the code.
2. **Machine-environment warnings.** The MSYS block, the win32 signal shape, `PATHEXT`. Machine facts, one home, pointed at.
3. **Measured statistics from another build.** 13-of-15, 27%/62%, 79k/79k/39k. The *patterns* transfer; the numbers are BUILD-020's.
4. **Any rule that has a canonical home elsewhere.** Rule 4a was copied verbatim into the BUILD-020 map, drifted, and was **replaced by a pointer on Warwick's instruction** (map:80-86). That correction is the template: **a rule in two places drifts.**
5. **Out-of-order section numbering.** In the BUILD-020 map, §13.4 sits after §14.21 and §14.11/§14.15/§14.16 sit after §16.11. A navigation artefact whose own numbering does not navigate is a defect.
6. **A per-session narrative.** Session-specific evidence belongs in `Deliverables/` and is pointed at. §17 alone runs ~700 lines.
7. **The five-document byte-identical precedence block** (BUILD-015 map:47-49, a *recorded exception* to the SSOT Golden Rule). It was justified when nothing machine-selected the map. `resolveActiveMapPath` now does. **Transfer as: one precedence block in the map, plus a one-line non-directive banner on each sibling.**

---

## 7. RECOMMENDED SINGLE CANONICAL SURFACE

### 7a. Judging Warwick's proposal

**Warwick is right that a canonical Wayfinder instruction layer is required. He is right for a reason stronger than "there should be a document": there is a machine-read interface — the marker sentence — with no written home, and it has already been lost once.**

But the canonical layer **already exists**: root `CLAUDE.md` § Wayfinder. It carries the mandate, the no-exception rule, the eleven required contents, the verbatim-copy instruction, the update-only-at-a-phase-boundary rule, the Veritas-receipt condition on PASS, the acceptance requirement, the automation-frontier clause and the "what Wayfinder is NOT" cap. **It is roughly 85% of what is needed.**

### 7b. Does BUILD-020 change Nolan's rejection of the SOP + Guideline?

**His conclusion stands. One of his two reasons is void, and it is replaced by a stronger one.**

| Nolan's reason (2026-08-01) | Status after BUILD-020 |
|---|---|
| *"for a method that would fire on perhaps one build a quarter"* — retrieval burden exceeds the saving | **VOID.** On 2026-08-02 Warwick made a Wayfinder map **mandatory for every build, with no exception and no thin-map bypass.** The frequency premise is inverted |
| *"An SOP makes over-application easier, not harder"* — it converts "should we?" into "there's a procedure for it" | **MOOT.** Over-application is no longer a failure mode when application is compulsory |
| *"the estate's precedent is a Template, not an SOP"* | **NOW ALSO REJECTED, on new evidence.** §17.3's own correction records that L-5 landed in root `CLAUDE.md` pointing at itself **because no Wayfinder template file exists and inventing one would be regrowth** (map:1947). A template would become a **second definition** of the START/RESUME block — the exact defect that Rule 4a's verbatim copy produced and that Warwick ordered replaced by a pointer on 2026-08-06 |
| **The reason that replaces them** | **There must be ONE canonical home, and there already is one.** An SOP, Guideline or template would create competing definitions across `CLAUDE.md`, a template, a map and an SOP — which the commission itself forbids |

### 7c. The recommendation

> **ONE amendment to root `CLAUDE.md` § Wayfinder. No new file. No new artefact type. Approximately 40 lines.**

Three clauses, each earning its place because **no existing route carries it**:

**C-1 — The marker is a machine-read interface.**
> *The START / RESUME block must be copied verbatim from `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md`. Its first bullet — "On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue." — is the string the installed governor greps for to discover the active map. Changing, reformatting or removing it removes the map from automatic discovery, silently. The active map is selected by branch-scoped git recency over marker-carrying files in `Deliverables/`; two equally recent maps resolve to nothing. **To make a map active, commit a change to it on the working branch. There is no pointer field to edit.***

*No existing route carries this. It exists only as source comments in an installed runtime, and `ed5e96f` proves the marker can be lost.*

**C-2 — One frontier, one section.**
> *Exactly one section of a map may state the live frontier. Every other frontier-shaped block is struck through and carries a pointer to it and no status of its own. A map that states a frontier in two places has already produced a confident wrong orientation and will do so again through the machinery built to prevent it.*
> *The exact next action is written in a shape the commit carrying it cannot falsify, and is accompanied by a one-command discharge test the reader runs before acting on it. Nothing makes a map self-updating and nothing is to be built that would.*

*No existing route carries this. It is BUILD-020's single largest structural improvement and BUILD-015's single best-built artefact, and neither is written down as law.*

**C-3 — The ACTIVE SESSION WORK PACKAGE is a required section.**
> *Every map carries an ACTIVE SESSION WORK PACKAGE: the session's durable accepted scope, with functional acceptance requirements numbered separately from assurance and release sequence steps. Every Work Order, Veritas dispatch, `/rotate` report and merge-readiness statement derives from it. No requirement may live only in chat, in Larry's context, or in a rotation packet. Larry updates it whenever Warwick amends the session requirements — this is the one exception to updating a map only at a phase boundary.*

*`CLAUDE.md` Step 2 names it four times but never defines it. It is currently defined only inside the BUILD-020 map's own body, which is not a canonical surface.*

**Plus one word elsewhere:** add **`focus`** to `/rotate` step 11's comparison list (`rotate.md:72`). The free-text `focus` field is the field that misdirected a fresh Larry twice, and it is the only Honcho field the read-back does not check.

### 7d. What NOT to build — explicitly

**No SOP. No Guideline. No template file. No scaffold file. No map registry, index or manifest. No validator. No hook. No `wayfinder:` frontmatter. No status store. No self-updating map.**

The proven map at `Deliverables/2026-08-02-wayfinder-operating-reset-plan.md` **is** the scaffold; `CLAUDE.md` already points at it. Copying it into a template file creates a second definition of a machine-read string — the highest-risk possible duplication in this estate.

**This recommendation is itself subject to `CLAUDE.md` § "No silent constitutional self-modification":** it requires Warwick's explicit approval, an exact proposed redline, and independent review of the resulting patch. **It is a proposal, not an instruction.**

---

## 8. PROPOSED ACCEPTANCE TESTS

Executable. Every one uses an existing route. **A test that cannot fail is not a test** — each names its failure signal.

| # | Property | Executable test | PASS condition | Failure signal |
|---|---|---|---|---|
| **T-1** | **A new map becomes authoritative** | Commit a change to the destination map on the working branch, then `node ~/.mypka/governor/continuity.mjs read` | Rendered `map_path` = destination map | Renders the old map, or renders nothing |
| **T-2** | **The old map cannot direct** | `grep -n "next action\|frontier" <old-map>` head section | Every frontier-shaped block in the old map is struck through and points at the destination, or the map carries a top-line `PAUSED`/`CLOSED` status | Any unqualified next action survives in the old map |
| **T-3** | **Mutation test on T-1 (the control that proves T-1 is real)** | Temporarily alter one character of the destination map's marker sentence in a scratch copy of the repo; re-run `resolveActiveMapPath` | Returns **null** or the other map — i.e. the marker is genuinely load-bearing | Returns the destination map anyway → discovery is not marker-driven and C-1 is wrong |
| **T-4** | **Ambiguity fails safe** | In a scratch clone, commit touches to two maps in one commit; re-run the resolver | Returns **null** | Returns either map → the ambiguity guard is dead |
| **T-5** | **Fresh Larry identifies Goal, phase, gate and frontier BEFORE tools** | `/clear`, then `Continue.` | The first message states map path, goal, phase+gate, exact next action, and makes **zero tool calls** before doing so | Any tool call precedes the statement, or any of the four is absent |
| **T-6** | **Honcho points without replacing** | Read the rendered brief | It names the map path and carries no imperative next action of its own authority | The brief states a next action that the map does not |
| **T-7** | **Honcho `focus` agrees with the map** | Compare rendered `focus` against the map's current phase | Same build, same phase | Any disagreement — **this is the historic two-time failure** |
| **T-8** | **Work Package scope reaches Veritas intact** | Read the next Veritas receipt's `## Accepted requirements` table | Every numbered functional requirement of the ACTIVE SESSION WORK PACKAGE appears **exactly once**, with its own verdict | A requirement missing → template says overall HOLD. A narrower scope than the WP → dispatch defect |
| **T-9** | **Codex stays blocked until eligible** | Attempt the eligibility check | Gate 1 PASS at the exact head + scope match + **CI green** + head stable + Warwick's explicit authority. Any absent → prohibited | Codex invoked on a Gate 1 HOLD, or CI unavailability argued around |
| **T-10** | **Restart and genuinely fresh session preserve the route** | Warwick restarts the host, opens a session in a **different worktree**, types `Continue.` | Same map, same phase, same next action as before the restart | Divergence, or a null pointer |
| **T-11** | **No Proofline-specific dependency** | `grep -i "proofline\|7317\|resultSha256" <new-map> <CLAUDE.md § Wayfinder>` | Zero matches outside historical/provenance notes | Any operative rule references Proofline |
| **T-12** | **No status reconstructed from stale prose** | On resuming any map, run its discharge test first | The reader learns whether the recorded next action is already discharged **before** acting | No discharge test exists → N-4 not met |

**T-3 and T-4 are the important ones.** Per the estate's own lesson — *a control is not evidence until made to fail* — T-1 without T-3 proves only that something rendered a path.

---

## 9. EXPLICIT DISCARD LIST

**Discard means: do not carry into another map, do not promote to canonical, do not rebuild.**

### 9a. Proofline-specific — product, not method
§5.1-§5.7 in full (canonical text handling, processor spec, job states, objects, HTTP contract, journal replay, keys) · §8's T-1..T-9 · G-1..G-11 · D-1..D-11 · F-1..F-4 · the `isOrphaned` epoch design · P-2, P-3, P-4, P-6, P-9, P-11, P-12, P-13 · the win32 `code=1, signal=null` trap · port 7317 · the launcher/`PATHEXT`/BOM failure detail (keep it in the build record as a real failure; it is not a Wayfinder lesson).

### 9b. Overengineered or superseded — do not revive
- **The `⟦GOV⟧` message-stream footer.** RETIRED. Measured at 79k tokens per line. The three honesty rules that outlived it are already canonical.
- **The Nolan per-order checker (WP-3F / Option A).** Approved 2026-08-05, **parked unratified 2026-08-06**, with an explicit instruction not to merge, recreate or apply it.
- **The `PostToolUse` notification-reminder hook as a solution.** Explicitly reclassified **MANUAL**. Transferring it as a working control would repeat the exact overstatement Veritas blocked.
- **BUILD-018's `checkExecutionProjectionAgreement` / `programme-state.json` / ticket ledger.** BUILD-020 does not use them and does not need them; the map-versus-ledger problem they solved does not exist in a map that holds no machine status.
- **The five-document byte-identical precedence block** (BUILD-015). A recorded SSOT exception that `resolveActiveMapPath` has made unnecessary.
- **Any map registry, index, manifest, validator, frontmatter schema, status store or self-updating mechanism.** BUILD-015's map says it outright: *"Nothing makes a map self-updating, and building something that would is exactly the regrowth the estate has already paid for once. Do not add one."*
- **A Wayfinder template file or scaffold file.** §7c.

### 9c. Structural habits — do not reproduce
2,453 lines · out-of-order section numbering · per-session narrative in the map body · verbatim copies of rules canonical elsewhere · measured statistics from another build · machine-environment warnings in a navigation artefact.

### 9d. Reported once, not actioned — Warwick's decisions, not mine
- `2026-08-02-tower-watcher-github-sqlite-migration-plan.md` carries the active-map marker while the BUILD-020 map calls it a stale decision record. Two estate sources disagree on its eligibility (§4f).
- `.claude/**` has **no contracted owner** — Keel is contractually barred, no other specialist claims it, and Larry has taken it twice under the Rule 4 exception (`wo23-keel-refusal:104-107`). Already raised once; I am not raising it again as work.
- P-8 (`node --test` inflated counts) and P-10 (`git checkout` is not a byte-safe restore) remain estate-wide and undispositioned.

---

## 10. THE SINGLE SMALLEST NEXT IMPLEMENTATION DECISION FOR WARWICK

> **Decide ONE thing: whether the transfer method is PROVEN BY EXECUTION on BUILD-015 before it is written into law, or written into law first.**

**Option A — prove first (RECOMMENDED).**
One commit: append the rebaseline amendment block and an ACTIVE SESSION WORK PACKAGE to the BUILD-015 Asdair map, on the BUILD-015 branch, touching nothing else. Then run T-1, T-5 and T-7 and report the results.
**What changes:** the estate learns, from executed evidence, whether map-to-map transfer actually works — including whether the repo-wide-fallback failure in §4f is real on that branch. Cost: one commit and three observations. **If T-1 fails, C-1 as drafted is wrong and would have been written into the constitution.**

**Option B — codify first.**
Amend root `CLAUDE.md` § Wayfinder with C-1/C-2/C-3 plus the one-word `/rotate` fix, take it through the required redline and independent review, then transfer BUILD-015 under it.
**What changes:** the law is durable sooner, and the first real test of it is also its first use. Under `CLAUDE.md` § "No silent constitutional self-modification" this needs Warwick's explicit approval, an exact redline and independent review — a heavier gate than Option A, spent on text that has never been executed against.

**Recommendation: Option A.** The estate's own doctrine is *deliver a thin working slice first* and *a control is not evidence until made to fail*. Writing three constitutional clauses about a mechanism whose one live failure mode (§4f) has never been observed is exactly the move BUILD-018 made. **One commit, three observations, then decide.**

**Nothing else needs deciding today.** Everything in §3's transfer matrix that says *"None"* is already canonical and already working.

---

## 11. METHODOLOGY AND LIMITATIONS

**Method.** Read the staged git history first, then the BUILD-020 map by section (structure enumerated by header grep, then targeted reads), the two BUILD-018 reports in full, the BUILD-015 map in full, the BUILD-015 end-to-end audit's answer and limitations sections, `.claude/commands/rotate.md` in full, the installed `~/.mypka/governor/continuity.mjs` active-map resolver in full, `SOP-022`'s dispatch-route section, `Templates/veritas-receipt.md`'s accepted-requirements block, `Team/Larry - Orchestrator/AGENTS.md`'s automation bar, `tools/wo/README.md`, and the WO-23 refusal and CI-outage Deliverables. One independent execution of my own: a `grep` for the marker string across `Deliverables/`, which produced the six-file result in §4f. **No file in `C:\Fusion247PKA-build-020-trial` was written. Nothing under `C:\.fusion247\**` was read.**

**Limitations — read before acting.**

1. **I have no `Bash`.** Every claim about *behaviour* is derived from reading source, receipts and commit messages. **T-1 through T-12 are proposed, not run.** The `resolveActiveMapPath` behaviour in §4f/§5 is read from the installed source and its own test-design comments; it is **not** executed here. This is the same constraint that shaped `END-TO-END-PROCESS-AUDIT.md` and it is stated for the same reason.
2. **Same-model material.** The artefacts under review were authored by the same model. Where an artefact records being corrected by an independent reviewer (Keel's refusals, Veritas's HOLDs, Warwick's rulings) I treat that as corroboration. Where it does not, I say single-source.
3. **Single-source claims, named:** the 2026-08-06 fresh-session journey succeeding on `Continue.` alone (map:1786) · the 27%/62% generator figures (map:1810) · the 13-of-15 refusal baseline (map:1702) · the six-map marker measurement in `continuity.mjs:188-191`. Each is Larry's own measurement with no independent recount in the estate.
4. **Unestablished, and not guessed:** whether the repo-wide fallback in §4f actually misfires on the BUILD-015 branch (needs execution) · whether the two estate sources on the tower-watcher migration plan can be reconciled without a Warwick ruling · whether `/rotate` step-11's omission of `focus` has caused a miss since the step was written · whether any other estate map carries a competing frontier statement today.
5. **Fact vs judgement.** §2's evidence rows and §4a-4c's status categories are sourced fact with file and line. §1's verdict, §3's promote/discard calls, §6b, §7's canonical-surface recommendation, §9's discard list and §10's option recommendation are **my judgement**, built on that evidence.
