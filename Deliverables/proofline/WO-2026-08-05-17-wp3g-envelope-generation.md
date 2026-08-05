# WO-2026-08-05-17 — WP-3G: make the constrained envelope fields NON-GENERATIVE

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-17 |
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | **Keel** |
| **governance_head** | `a2d97120a5b5ac9a7d6eb990545754bb2062bfa7` |
| **authorised_by / date** | **Warwick, 2026-08-05, verbatim:** *"End the Work Order actor debate and fix generation at source… Implement the smallest coherent generation change so that these fields are non-generative."* Map §15.3d design targets 1 and 2 |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` §16 · §15.3d targets 1–2 · **§14.21 is the failure corpus you replay** |
| **branch** | `build-020/wp-3g-envelope` · **worktree:** `C:\Fusion247PKA-wp3g-envelope` — **yours, cut from the governance head** |
| **file_surface** | `tools/wo/**` (new directory — the generator and its tests) · `Deliverables/proofline/EVIDENCE-2026-08-05-wp3g-envelope.md` |
| **private_surface** | **`none`.** Nothing under `C:\.fusion247\**`. **STOP and return `BLOCKED` if any step appears to need it** — that boundary was crossed once in this build and will not be again |
| **credential_scope** | **`none`** · **network:** **`none`** |
| **live_authority** | **`none`.** No install, no machine write, no `.claude/**` edit, no restart |
| **capability_evidence** | `source: executed probe` (Larry, at the governance head) — Node **v22.18.0**, `node --test` reports counts and returns exit 0 on zero tests, so **assert counts never the exit code**; `node --test <directory>` is broken here, pass files or a glob; worktree `C:\Fusion247PKA-wp3g-envelope` cut from `a2d9712`, **no upstream, first push needs `-u`**; `.claude/agents/*.md` carry a machine-readable `tools:` frontmatter list; `Team/*/AGENTS.md` are prose |
| **acceptance_property** | **A deterministic generator that populates every constrained field verbatim from canonical source, emits an explicit UNRESOLVED marker rather than any guess when it cannot, and — replayed against all 14 historical BUILD-020 class-A defects — shows for each whether the defect would now be PREVENTED BEFORE DISPATCH, with the honest answer recorded where it would not** |
| **veritas_gate** | **2** — Phase 3 gate, on the exact integrated head |
| **integration_owner** | Larry · **document_impact:** SOP-022 — **owner: Larry, NOT you** (see the bar) · **out_of_scope_policy:** report-only |
| **operational_handoff** | none |
| **dependency_policy** | no-new-runtime-deps |
| **blocking_dependencies** | none |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ the governance head |
| **contract_basis** | Node tooling and executable test suites are Keel's core seam. `tools/**` is not a governing surface — **the generator is a mechanism, not law.** Evidence file under the `Deliverables/**` carve-out |
| **contract_conflicts** | **DECLARED: you may NOT author `Team Knowledge/SOPs/SOP-022-*.md`** — it governs the work you implement, and your contract bars documents whose function is to define or govern that work. **Larry drafts the procedure text; Warwick ratifies it. You build the mechanism only** |
| **return_to** | Larry |

## The outcome — Warwick's words, and they are the specification

> **"Standing authority defaults and specialist constraints are copied verbatim from their canonical source, never redrafted from memory or narrative context. Any proposed deviation is a Warwick escalation, not a drafting choice."**

**Larry stops typing the fields he gets wrong.** 14 class-A defects across 16 orders in this build; **five of seven earlier ones involved a surface or authority field**, `private_surface` was set to the secrets-store root twice, `Builds/**` appeared in a permanently barred surface twice, and `live_authority` carried a forbidden value twice. **Every one of those is a field this generator populates from a file.**

## The seven non-generative fields

| Field | Canonical source |
|---|---|
| **tool grant and missing tools** | `.claude/agents/<slug>.md` frontmatter `tools:` — **machine-readable, so no excuse for a guess** |
| **permitted and prohibited file surfaces** | `Team/<Name>/AGENTS.md` — prose. Extract what you can; **UNRESOLVED where you cannot** |
| **private / credential surface** | **Standing default `none`.** GL-012 is deny-by-default; any non-`none` value is a **Warwick escalation**, never a drafting choice |
| **live authority** | **Standing default `none`** unless the contract affirmatively grants it |
| **Git authority** | The contract. **Where it is SILENT, emit `SILENT — no git authority` — never infer one.** Nolan's silence on git was a real class-A defect in WO-15 |
| **worktree and executable path** | Larry supplies the path; **you verify it exists and sits at the named governance head** |
| **evidence the worker can actually produce** | **Derived from the tool grant.** If the grant lacks `Bash`, an acceptance property requiring command execution is **impossible and must be refused at generation.** This is the check that would have caught WO-11 |

## 🔴 The anti-fabrication property — this is the whole point

**When the generator cannot establish a field from canonical source, it emits `UNRESOLVED — <file>:<section> must be read` and the envelope is incomplete. It NEVER emits a plausible value.**

**A generator that guesses is worse than Larry guessing, because it launders the guess as machinery.** Make this the property you mutation-test hardest.

## Verification — Warwick's, and item 1 is the real one

1. **Replay every historical BUILD-020 class-A defect through the repaired path.** The corpus is **§14.21 of the map (seven), plus WO-10, WO-11, WO-12, WO-13, WO-15's five, and WO-16's flagged seam.** For each: **would the original defect now be PREVENTED BEFORE DISPATCH?** **Record the honest answer where it would not** — a replay that reports 100% is not credible and will be disbelieved.
2. Running the next three genuine Work Orders through it is **Larry's**, not yours.

**Acceptance also requires: no separate preflight agent, no additional model invocation, and no constrained field manually invented.** **A generator that needs a model to run has failed.**

## 🔴 Bars

- **No checker, validator, control plane, registry, role or document family.** Warwick has now rejected that diagnosis five times in this build. **This is a GENERATOR — it produces fields; it does not sit in judgement over them.** If your design starts inspecting a finished order and reporting on it, you have built the prohibited thing.
- **You may not author SOP-022 or any governing text.**
- **If the honest conclusion is that the format itself is too dense for reliable production, SAY SO.** Warwick's standing instruction: *"If any Class-A defect survives the three live orders, do not add Nolan or another checker. Reduce the Work Order format and constraint density until Larry can produce it reliably."* **Evidence for that reduction is a legitimate and valuable output of your replay.**

## Evidence bar

- `node --test` with **counts asserted, never the exit code**.
- **Mutation-test every control**, hardest on the UNRESOLVED path: make it emit a guess and prove the suite goes red.
- **Pin invariants to literals held in the test**, not re-derived from the source under test.
- **Name what you could not establish.**

## Git

Your branch and worktree only — commits and ordinary pushes, first push `-u`. **No merge, no force-push, no `main`.**

## Read-back required

Restate: the outcome, your plan, what this order failed to settle, and what looks wrong with it. **Then hold.** **This envelope was generated by hand, by the process it exists to replace — 15 class-A defects across 17 orders say it probably carries one. Find it.**

---

# AMENDMENT 1 — 2026-08-05, Larry. Both class-A defects upheld; five rulings

## F-1 🔴 C-2 UPHELD — **the corpus was selected backwards, and this is the defect Larry asked to be found**

**The order included "WO-16's flagged seam" — the one item the pre-dispatch check ALREADY CAUGHT, which can only return a free PASS — and excluded WO-16 Amendment 1's E-1..E-4, the four defects that SURVIVED the check and reached the worker.** The freshest and most probative evidence in the build, omitted; the pre-caught item, included. **That is the selection that produces a flattering replay, which this same order says will be disbelieved.**

**Corrected:**

- **E-1..E-4 are IN the corpus** — CRLF direction stated backwards · tautological rollback proof · ten-modules-vs-eight · stale documentation line.
- **The WO-16 seam is retained ONLY as a labelled control item that SCORES NOTHING**, so a reader can see it was already prevented and was not counted.
- **ADD: "the order does not exist at its own governance head."** WO-15 (A4) and WO-17 both did this — **a repeat, and mechanically preventable.**

**Keel's own prediction is adopted into the order as an EXPECTED FINDING, not a risk:** the seven fields cover the **surface-and-authority** class well and **none** of the **acceptance-property-and-reasoning** class — WO-04's eight-paths-from-four, WO-07's D2 measurement blindness, and all four of E-1..E-4. **Expect roughly half. Write the residue up as the evidence for Warwick's "reduce the format" instruction, not around it.**

## F-2 C-1 UPHELD — the count, with the UNIT named

**Larry stated it four ways and drifted it three times.** Settled:

- **The RECORDED BASELINE is Warwick's, verbatim, and does not move: 14 class-A defects across 16 Work Orders.** That is the figure the phase is measured against.
- **The REPLAY CORPUS is counted in DEFECTS, not orders**, is enumerated explicitly with an ID per defect, and carries an **as-of point**. Orders and defects are different units, and mixing them in one sentence is what produced the drift.
- **Post-baseline defects accrue separately and are named as such** — E-1..E-4, plus this read-back's own findings.

**Do not restate a bare number anywhere. Enumerate, or cite the baseline.**

## F-3 C-3 RULED — your reading is correct and is now the order's

**Judging an INPUT at generation time is inside the line. Inspecting a FINISHED ORDER is outside it.** **Field 7 emits a constraint line or `UNRESOLVED`. It has no "refuse" verb, no exit-code verdict, and no report output.** Confirmed exactly as you proposed.

## F-4 🔴 C-4 RULED — **verbatim PLUS a fixed not-delivered annotation**

**You found the hole the anti-fabrication property does not guard: it stops guesses, not faithfully-copied falsehoods.** Six shims declare `MultiEdit`, which `.claude/agents/keel.md`'s frontmatter comment and SOP-022 both record as **proven not delivered**.

**Ruling: copy the `tools:` list verbatim AND append the recorded not-delivered annotation.** Not `UNRESOLVED` — that blanks a field which is otherwise correct. Not verbatim-only — that launders a known falsehood through machinery.

**The annotation is itself copied from canonical source** (`keel.md` frontmatter / SOP-022), **not composed** — so Warwick's *"never redrafted from memory"* holds. **Pin its text to a literal in the test.**

## F-5 C-5 RULED — two states, two strings, and the distinction is real

- **Contract SILENT on git** → the standing default resolves it → **determinate**. Emit `none — contract silent, deny-by-default`.
- **Contract prose present but not parseable to a determinate value** → **unknown**. Emit `UNRESOLVED — <file>:<section> must be read`.

**A conclusion and an unknown must never share a string.** You were right to refuse to pick.

## F-6 M-1, M-2, M-4 — accepted as you proposed

- **M-1 invocation:** `node tools/wo/envelope.mjs --owner <slug> --governance-head <sha> [--worktree <path>]` → envelope rows on **stdout**, writing no files. **Confirmed.**
- **M-2 — the teeth, and it is the right answer:** the **existing read-back gate**. `UNRESOLVED` appears literally in the issued order and **the worker REFUSEs on sight.** No new mechanism, no new authority, and it costs nothing. **Now stated in the order, so the acceptance property's central verb is earned rather than assumed.**
- **M-4 heading-anchored verbatim extraction**, anchors pinned to a literal in the test, degrading to `UNRESOLVED` when an anchor is absent. **Confirmed — that is copying, not judgement, and it fails in the safe direction.**

## F-7 M-3 and the missing template fields — **UPHELD and COUNTED**

**`contract_basis` gave one prose sentence where the template requires one entry per surface entry and per non-file action.** **This is a class-A envelope defect, it is counted as one, and it goes in the corpus** — given what this work package is about, exempting it would be absurd.

Same for the absent `build`, `wp_number`, `tags`, `schema_decision`, `security_inputs` and one-sentence `outcome`, and for `contract_conflicts` carrying a prohibition where the earned value is `none`. **All recorded. All corpus entries.**

**And the order-not-at-its-own-governance-head defect is fixed by declaration: `C:\Fusion247PKA-build-020-trial\Deliverables\proofline\WO-2026-08-05-17-wp3g-envelope-generation.md` is a DECLARED READ-ONLY INPUT.** Read this amended file from there.

**A3 accepted — cite the WO files as primary evidence.** You are right that the map is stale against its own ledger: §14.21 still says seven and §16.9 still says 13/15. **The map is Larry's to reconcile, not yours.**

**Proceed. No further read-back unless this amendment is itself defective.**
