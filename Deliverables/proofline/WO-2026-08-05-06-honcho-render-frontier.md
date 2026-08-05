# WO-2026-08-05-06 — WP-2B(2), CODE HALF: the Honcho render, the frontier, and the existence check

> **AMENDMENT 1 at issue.** The first dispatch of this work was **in-prompt only, with no Work Order on disk** — itself a defect, since an order that lives only in Larry's context dies with the session (S-5). Keel returned `REFUSE` on five grounds; **all five upheld**, and its findings P-1..P-6 are folded in below. **The install half is REMOVED from this order and goes to Mack** (`WO-2026-08-05-07`).

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-06 |
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | Keel |
| **governance_head** | `2fc4d39dbed7bc52cbb707ac519fa69a23142a19` *(full SHA — a memory-truncated prefix caused a resolution wobble last dispatch)* |
| **authorised_by / date** | Warwick, 2026-08-05 — map §14.0 **W-1**, gate **S-1** |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **§14.19 is now the SINGLE statement of the live frontier. §12 is Phase 1 history and says so.** Also read §14.0b and §14.12 |
| **branch** | `build-020/honcho-render-frontier` |
| **worktree** | **`C:\Fusion247PKA-wo-2b2`** — yours, cut from the governance head. **NOT the shared tree.** My previous order named the shared tree and caused a concurrency event |
| **file_surface** | `tools/governor/continuity.mjs` · `tools/governor/continuity.test.mjs` · `tools/governor/reorient.mjs` · `tools/governor/reorient.test.mjs` · `Deliverables/proofline/EVIDENCE-2026-08-05-wp-2b2-honcho-render.md` |
| **private_surface** | `none` |
| **credential_scope** | none |
| **network** | none |
| **live_authority** | **`none`** — corrected. Refusal ground A upheld: `none` is the only value you may act under, and the install half that needed more is no longer here |
| **acceptance_property** | **`buildPacket` emits a verified `map_path` PLUS the frontier fields, and `readContinuityBrief` renders them or the honest-absent form — proven by executed test.** *(The automatic delivery to a fresh session is Mack's half and is NOT asserted here.)* |
| **veritas_gate** | Phase 2 gate (§14.0c) — contributes to **S-1** |
| **integration_owner** | Larry |
| **document_impact** | the map — **owner: larry.** §14.12, §13.3a R-3 and the rotation block all change meaning when this and Mack's half land |
| **out_of_scope_policy** | report-only |
| **operational_handoff** | none |
| **dependency_policy** | no new runtime dependencies |
| **blocking_dependencies** | none. **Mack's `WO-...-07` install half depends on this landing** |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ the governance head |
| **contract_basis** | `tools/governor/**` — implementation code, core Keel surface · `Deliverables/**` — *"NOT prohibited wholesale"* |
| **contract_conflicts** | **NOT `none` — one, and it is why this order shrank.** The install half conflicted with critical rule 5 (`.claude/`), the Mack supervisor-registration boundary, and critical rules 2 and 3 (writing into another worktree that the live Stop hook and PID 31268 execute from). **Resolved by removal, not by waiver** |
| **capability_evidence** | Keel delivered `WO-...-01` (this exact module), `-02`, `-03` and `-05` this session, including mutation-tested controls and injected-seam capture |
| **return_to** | Larry |

## Your five refusal grounds — all upheld

**A** — `live_authority` is `none`. **B** — the acceptance property is split at the code/install seam; yours is above. **C** — the frontier is defined below. **D** — the existence semantics are settled below. **E** — the envelope is filled, and `contract_conflicts` is an earned answer, not a placeholder.

> ## AMENDMENT 2 — 2026-08-05. **INSTRUCTION C IS WITHDRAWN.** Keel returned `CLARIFY` and was right.
>
> ### C reversed an approved governance redline — by writing code
>
> `continuity.mjs:404-413` and `:751-754` carry the **Section-5 pointer render contract**, landed by **`4a3b873`** — *"BUILD-020 external source repair: apply approved doc-017 redlines"* — **an ancestor of this order's own governance head.** Its message states the rule with no room in it:
>
> > *"pointer-only render — permitted fields only; stored `next_action`, `accepted_decisions`, `completed`, `blockers` and `notes` **never rendered on any branch**."*
>
> **`next_action` is named PROHIBITED. `immediate_objective` is in neither list.** That same commit also amended `CLAUDE.md`, root `AGENTS.md`, the shims and the Veritas contract — **so it is an approved governance change, not an implementation preference.** My order cited §14.0 W-1 and gate S-1, which authorise the **existence check**, not a reopening of the field allowlist. **I attempted to amend a governance boundary by instructing code that contradicts it.**
>
> ### And an executed fact that settles it independently
>
> The live store's fields **today**: `immediate_objective` = *"Obtain a Veritas Gate 3 verdict on head 94f135f…"*; `next_action` = a full imperative procedure ending *"…on HOLD or FAIL discharge every finding and resubmit a NEW exact head."*
>
> **Built as I ordered, the brief a fresh BUILD-020 Larry reads today would render a complete step-by-step BUILD-015 procedure under a "recall-only" label.** That is **P-4's failure reproduced through the field render instead of map scraping** — *a confident wrong orientation, produced by the mechanism built to prevent one.* **And unlike P-4 it is not hypothetical: it is what the store contains right now.** **The redline removed those fields precisely because labelling was judged insufficient.**
>
> ### How I got here — recorded, because it is the interesting part
>
> I adopted C as *"your recommendation"* from the previous Keel instance and **presented that provenance as authority**. This instance holds no state from that one, and correctly said so: *"a previous instance's standing buys this one nothing."* **The earlier instance could not have weighed either fact** — the redline sits in the same file it was editing, and the store contents needed executing. **A recommendation is evidence, never instruction (`CLAUDE.md` precedence #8), and I treated one as settled because it came back with a specialist's name on it.**
>
> ### RULING — Option 1, as recommended
>
> **Drop C. Deliver D + P-6, and let the frontier stay where the redline and `CLAUDE.md` put it: in the map.** The brief's contribution to S-1 is the **existence-verified map path** — the part that was actually broken — plus the existing content-age line that already exposes staleness. **No governance reversal, no round trip, and honest: a pointer points.**
>
> **Option 2 (reopening the allowlist) is NOT taken.** It is a `product-decision` for Warwick, and on today's data it would ship a BUILD-015 instruction to a fresh BUILD-020 Larry the moment it landed.
>
> ### P-6 corrected — my description was wrong, and it is THREE sites
>
> `:22` and `:756` are **not** in contradiction with each other — `:22` calls the *brief* authoritative, `:756` calls the *Deliverables sweep* a fallback. **The real defect is that three sites assert Honcho authority against `CLAUDE.md` #9:** `:22-23` *"the AUTHORITATIVE source of current focus"* · `:757` *"Honcho holds the explicit focus"* · **`:1039-1040` *"it is the authoritative focus"* — which my order missed AND the doc-017 sweep missed.** Doc-017 fixed only the rendered label at `:1004`; the comments were left. **Fix all three.**
>
> ### 🚨 Carried out of this order — S-1 fails TODAY on DATA, not code
>
> **`focus` is a permitted, already-rendered field, and it currently reads *"BUILD-015 AsdAIr live-acceptance recovery…"*, 30+ hours stale.** **So a fresh Larry gets a wrong orientation from the brief as it stands, before a line of this work exists.** The remedy is a `continuity.mjs write` with the current focus — **an operational act, Larry's, not a code change.** **Option 1 does not fix this and does not claim to.** Tracked separately; **S-1 cannot pass while the store says BUILD-015.**

## ~~C — what "the frontier" IS~~ — **WITHDRAWN, see Amendment 2**

**Render the packet's existing `next_action` and `immediate_objective` beside `focus`, every one labelled recall-only.** **No scraping, no marker convention, no map edit, no extraction mechanism.**

**Your reasoning is why:** a map-derived frontier needs a marker in a document you may not write, plus a new extractor — the regrowth cap. **And P-4 proves the scraping route was actively dangerous:** the map stated *three* frontiers, and §12 would have yielded *"Phase 3, Veritas HOLD, next action: Warwick re-attempts the walkthrough."* **A confident wrong orientation, produced by the mechanism built to prevent one.** *(The map is fixed at §14.19 — but the fix must not become the design's dependency.)*

**The pointer discipline binds every added field:** the brief carries **recall identity only**. Nothing may read as an instruction to execute. `CLAUDE.md` #9 — *"a pointer with zero authority"*.

## D — existence-check semantics. **Your recommendation adopted.**

**Verify the recorded path against the READER's own repo root. Where it is not found there, render the honest-absent form NAMING the path that was recorded but not present** — so Warwick sees *why* orientation is absent rather than a blank.

**You established the case that decides it:** the map does **not** exist in `C:\Fusion247PKA` (main, on `build-015/...`). So a fresh Larry there gets honest-absent — **correct under W-1**, and **S-1 remains unmet for that worktree until the branch carrying the map is what it reads.** That is a true limit; record it, do not engineer around it.

## Also in scope

- **P-6 — fold it in.** `reorient.mjs:22` calls the brief *"the AUTHORITATIVE source of current focus"* while `:756` says it *"is a FALLBACK and never the source of truth"*. **The same contradiction with `CLAUDE.md` #9 that the installed render carries.** Comments only, inside your surface.
- **P-1 acknowledged:** the render fix is already in this worktree; **only the frontier is owed on that part.** Your finding shrank part 1 and I have recorded it at §14.19.

## NOT in scope — Mack's, per your refusal

The machine-level install, the `~/.mypka/governor/` runtime copy, user-level registration, **and the removal of the now-duplicate project-level entries** — the point your route made and my order missed. **Your proposed route is adopted wholesale and goes to Mack.** Also carried to Mack: **R-3 undercounted — it is SIX hardcoded invocations, two of them `Stop` hooks, one being `continuity.mjs stop`, the writer itself.**

## Acceptance evidence

- Baseline **in your own worktree** before touching anything, then after. Per-file `node --test`, assert `# tests` and `# fail`, **never the exit code.** *(Baseline at the governance head, already measured by you: `continuity.test.mjs` 71/0, `reorient.test.mjs` 53/0.)*
- **A negative test for D:** a packet naming a non-existent map renders the honest-absent form **naming the recorded path**, and **never** presents it as the active map.
- **A mutation half, held to WP-2B(1)'s bar** — eight mutations, one survived, and you removed the dead guard rather than reporting eight green.
- `bash scripts/secret-scan.sh --surface <each declared path>` — `--surface` mode only.

**Proceed if sound; one further read-back only if a material defect remains.** `export MSYS_NO_PATHCONV=1` before any Windows command. Git for your branch is yours. You do not decide the merge.
