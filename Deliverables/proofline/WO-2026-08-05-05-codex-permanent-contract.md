# WO-2026-08-05-05 — WP-2G: Codex's permanent operating law, in its durable home, provably delivered

> ## AMENDMENT 1 — 2026-08-05. Keel returned `REFUSE`. **Upheld in full.** Seven rulings below; the proposed contract design is **accepted as outlined**.
>
> ### R-1 · The `Builds/**` delete exception is WITHDRAWN — Keel was right to refuse it
> Three independent grounds, any one sufficient: **path** (critical rule 5 lists `Builds/` flatly; *a delete is the most complete edit available*), **function** (*"any document whose function is to define, govern or assess the work Keel is implementing"* — this is the contract by which a reviewer decides whether Keel's diffs may merge), and **precedent** (SOP-022 cites this exact shape as its founding example). **I made the same mistake this order was written to document.** **Larry deletes the old file** after Keel returns. Two-commit move; the SSOT duplication exists only across my integration seam.
>
> ### R-2 · 🔴 `supervisorCodex.mjs` ADDED to `file_surface` — this was a false green waiting to ship
> `invokeCodexJson` calls `detectCodexAuth({})` and `resolveCodexBin({})` with **no injection seam**, returning `blocked` **before any spawn** when either fails. On CI there is no `~/.codex/auth.json` — so **the injected `spawn` is never called, no bytes reach `stdin`, and the reach test captures nothing. It would pass here and fail in CI, or, written loosely, pass BY BLOCKING** — the precise false green this WP exists to kill. **Adopt Keel's fix:** optional `authProbe`/`resolveBin` params mirroring `createCodexAdapter({ resolveBin, authProbe })` at `codexAdapter.mjs:280`. **House pattern, ~4 lines, no mechanism.** **The `HOME`-rewriting alternative is REJECTED** — Keel's reasoning accepted: it manufactures a file named `auth.json`, leans on undocumented `os.homedir()` behaviour, and mutates process-wide state in a shared runner.
>
> ### R-3 · ⚖️ RATIFICATION — ship **DRAFT**. The flip is a human act, and it is Warwick's
> Keel is right that this is not a worker's call and right that it is not mine either. **Ratifying wording Keel authored would breach the estate's rule that AI-authored governing prompts need Warwick's approval before use** — with the worked precedent sitting in the same directory, where exactly that was flagged DRAFT and consequently does not govern.
> **Ruling:** the new file ships **`status: draft`, `governs_live: false`, `standing_use_ratified: false`.** **Warwick reads the finished wording and approves it; the frontmatter flip is then a one-line commit, and that flip is what makes it govern.** He authorised the *outcomes* (O-1..O-7) and said the **UAT certifies the wording** — so the wording must reach him before the UAT, not be self-certified into place.
> **Consequence for the acceptance property, stated so it is not discovered:** with the real file DRAFT, **the reach test proves the gate works BOTH WAYS** — a ratified fixture reaches `stdin`; the unratified real file is refused. **That is stronger evidence than a passing file would have been**, and it is not a workaround.
>
> ### R-4 · G-1 — **Keel's inversion is ACCEPTED, and it is the better answer**
> Do not wire the dead route to reach the law. **Move the law onto the route that is already live.** Fold the clauses that today exist only in `productQaPrompt.mjs`'s hardcoded trailer and the classification amendment into the permanent contract that `reviewDiff`/`mergeCheck`/`watcher` actually read. **Smaller, and it removes the incentive to keep a second law channel alive.** **Do put the header line recording that `towerReview.mjs` and `productQaPrompt.mjs` remain test-only** — Keel established there is **no production caller at all**, which goes further than §14.17.
>
> ### R-5 · G-2 — Keel's correction ADOPTED; my map was half wrong
> `control-plane-tests.yml` does fire on `services/control-plane/**` ✅ — **but `test:runtime` is not in CI at all, and `reviewTooling.test.mjs`/`classifyBuild.test.mjs` are executed by no npm script and no CI job.** **A reach test dropped beside them would be a green that proves nothing.** **Wire it into `run-tower-loop-tests.mjs`**, which CI does run, reports `executed=`/`failures=`, and exits 1 on zero executed. No workflow change — **for a different reason than the order gave.**
>
> ### R-6 · O-7 pin — **sentinel, as Keel recommends. Not a hash literal**
> The file↔bytes hash equality carries the *"which contract"* half by construction; the sentinel survives the *"evidence-led wording refinements"* Warwick reserved. **A pinned hash makes every wording edit a two-file edit, which is how pins go stale** — and this estate has a worked example in `tower-runtime.test.js:368`. **Also adopt the runtime half:** `reviewDiff.mjs`/`mergeCheck.mjs` compute the fingerprint from the bytes they loaded and fail closed on mismatch. **Two lines each. That is O-7 discharged — a hash compared against something.**
>
> ### R-7 · G-3 — **CLOSE it, and the validator must be reached by the LIVE loaders**
> One exported loader-and-validator, in an existing module Keel judges right. **Not a new file, so not regrowth.** **The test is not enough:** the live readers must validate frontmatter, because *unratified content running as law* is the real risk. **If the natural home is a module the live route does not import, say so — do not create a live dependency on a test-only module by stealth.**
>
> ### Also ruled
> - **`review/prompts/product-qa-runtime-orientation.md` ADDED to `file_surface` — pointer/`base_prompt` updates ONLY, no content change.** It is a live governing text that would otherwise point at a deleted file: the "worse than no move" case.
> - **Contradiction 2 upheld — my map §14.17 was factually wrong.** The two siblings do **not** match: the classification amendment is `approved`/`governs_live: true`; the orientation file is **DRAFT, not Warwick-approved**. **Match the KEY SHAPE, not the values.** Map corrected.
> - **`file_surface` purity:** evidence file is exactly `Deliverables/proofline/EVIDENCE-2026-08-05-wo-05-codex-contract-reach.md`. `worktree`: `C:\Fusion247PKA-build-020-trial`.
> - **Acceptance commands, named:** `npm run test:tower-loop` (`executed=`/`failures=`) · `node --test` in `services/tower-baton` (`# tests`/`# fail`) · `npm run test:tower-loop-unit`. **`test:runtime` is NOT required** — it needs `initdb`/`pg_ctl` absent from CI and is not run there.
>
> ### `contract_basis` — the field whose absence caused this round trip
> | Path / action | Permitting clause |
> |---|---|
> | `services/control-plane/**` | Implementation code and runtime assets — core Keel surface |
> | **Authoring `review/prompts/tower-qa-skill.md`** | **RULED IN, narrowly, on Larry's authority — not left to inference.** A runtime asset under `services/**`; Warwick owns it and specified its binding content himself; **its two siblings in that directory were specialist-authored under a Work Order**; and it ships **DRAFT** (R-3), so Keel authors but does not ratify. Independently assessed before it governs |
> | `services/tower-baton/test/qaSkill.test.js` | Test repointing inside `services/**` |
> | `Deliverables/proofline/EVIDENCE-…md` | *"`Deliverables/**` is NOT prohibited wholesale"* |
> | **NOT `Builds/**`** | **No carve-out exists. Larry's.** |
>
> **`contract_conflicts`:** one, now resolved — the `Builds/**` delete, withdrawn at R-1. **`capability_evidence`:** Keel exercised branch/worktree git and a fake-`spawn` capture pattern successfully on `WO-...-01` and `WO-...-02` this session.
>
> **Proceed on one fresh read-back.**

---

| Field | Value |
|---|---|
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | Keel |
| **governance_head** | *(set at dispatch — the head carrying this file)* |
| **authorised_by / date** | **Warwick, 2026-08-05** — map §14.15 (amendment) and **§14.18 (the rewrite clarification)** |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **§14.17 is the traced evidence, §14.18 is the binding outcome set. Read both before planning** |
| **branch** | `build-020/codex-permanent-contract`, cut from the governance head or later |
| **file_surface** | `services/control-plane/review/prompts/tower-qa-skill.md` (**new home**) · `Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md` (**delete after move — see below**) · `services/control-plane/tower-loop/reviewDiff.mjs` · `.../mergeCheck.mjs` · `.../watcher.mjs` · `.../demo-merge-review.mjs` · `services/control-plane/review/productQaPrompt.mjs` · `services/control-plane/review/codexAdapter.mjs` · `services/control-plane/tower-loop/test/**` · `services/control-plane/review/test/**` · `services/tower-baton/test/qaSkill.test.js` · `services/tower-baton/bin/tower-watch.js` (retired; path constant only) · a new evidence file under `Deliverables/proofline/` |
| **⚠️ `Builds/**` EXCEPTION** | **The old skill path is the ONE `Builds/**` path you may touch, and only to DELETE it as part of the move.** Your critical rule 5 otherwise stands in full. **`runtime-manifest.yaml` and every other `Builds/**` pointer is LARRY'S** — list them for me, do not edit them |
| **private_surface** | **`none`** |
| **credential_scope** | none |
| **network** | none |
| **live_authority** | **`none`.** 🔴 **DO NOT INVOKE CODEX.** No `codex.exe`, no live `reviewDiff`/`mergeCheck`/`towerReview` run. Warwick has gated it; a call costs money and burns one of three per gate |
| **acceptance_property** | **The exact bytes written to the Codex child process `stdin` contain the permanent contract, proven by a test that captures them via an injected `spawn` — and that test FAILS when the law is absent, unratified, or when any loader points elsewhere** |
| **veritas_gate** | Phase 2 gate (§14.0c) |
| **integration_owner** | Larry |
| **document_impact** | the new prompt file — **owner: keel** · `Builds/**` pointers and root `CLAUDE.md` — **owner: larry** |
| **out_of_scope_policy** | report-only |
| **operational_handoff** | none |
| **dependency_policy** | **no new runtime dependencies** |
| **blocking_dependencies** | none. **This BLOCKS WP-2D — no live Codex call until this is integrated and proved offline** |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ the governance head |
| **return_to** | Larry |

## Outcome owed

**Codex's authoritative operating law lives in `services/control-plane/review/prompts/`, states the permanent contract Warwick specified, and provably reaches the real external invocation — with no dependence on BUILD-010 archaeology, a session, or a temporary instruction.**

## This is a REWRITE, not a move — Warwick, 2026-08-05

> *"Do not merely rehome Codex's existing contract unchanged. We already know that several parts of the live wording are stale, contradictory or capable of causing exactly the churn this phase is intended to remove."*

**PRESERVE the valid core:** genuine external independence · read-only operation · exact-head and diff evidence · fail-closed behaviour · Veritas-receipt verification · bounded findings · the three-call ceiling.

**RESOLVE into the wording — the seven outcomes are in map §14.18 and are binding. Do not restate them from this order; read them there.** In summary: O-1 PR/release head by default, earlier review only on explicit commissioning · O-2 the durable control set, **ClickUp is not authority** · O-3 Codex verifies Veritas's assurance honestly applies, **does not routinely rerun the phase gate** · O-4 blocking requires **active, reachable, in-scope material effect** · O-5 a **technical verdict**; **an upcoming merge must not itself force `DECISION_REQUIRED`** · O-6 **GitHub durable, TowerBot outbound-only, Telegram no inbound authority** · O-7 provenance must **prove which contract was delivered**.

**Frontmatter must carry `status`/`governs_live`/`version` matching the two ratified sibling files.**

## What the tracing established — do not re-derive it, but DO verify it

Map §14.17 has the full trace. The four findings that shape this work:

- **G-1** — `towerReview.mjs`, the route carrying almost all the law, is **test-only** (`loadProductQaPrompt` has two call sites, both tests) and needs a Postgres schema WP-2F moved off. **The live routes carry the least law.** Decide and state whether your change closes this or leaves it; **do not silently leave the richer prompt unwired again** — that is the defect `productQaPrompt.mjs:3` was written about, recurring.
- **G-2** — **no CI job asserts anything about the skill when the skill changes.** The new home sits inside `control-plane-tests.yml`'s existing `services/control-plane/**` filter, so this closes **with no workflow change**. **Verify that rather than assuming it.**
- **G-3** — the three live readers do a bare `readFileSync` with **zero frontmatter validation**; the ratification check exists only in retired and test-only code. **Unratified content running as law is the real degradation risk, not an absent file.**
- **G-4 / O-7** — the fingerprint is asserted only as **shape** (`length === 64`), never against a known value, and **is not computed at all on `reviewDiff.mjs`/`mergeCheck.mjs`**. **O-7 requires provenance that proves WHICH contract was delivered.** *(How is yours. A recorded hash compared against the ratified file's own hash is the obvious minimum; a new registry is not.)*

## The reach proof — ZERO Codex spend, and it is the acceptance property

The seam exists: `buildCodexPrompt` is a pure export; `runMergeReview` already accepts an injected `spawn`.

1. **Resolve the path by importing each loader's own exported constant — NEVER by re-deriving it.** *A test that computes the path itself passes over a loader pointing elsewhere.* This needs `export` on the path constant in each live loader — **one keyword each, not a mechanism.**
2. Assert the file exists, parses, and **is ratified**.
3. Drive `runMergeReview` with a **fake `spawn` capturing the exact bytes written to `child.stdin`**, and assert a **sentinel sentence held as a literal in the test file** — never imported from the source it checks.
4. **MUTATION HALF — without it this is not evidence.** The same assertions must **FAIL** for `skillText: ''`, for an **unratified** frontmatter fixture, and for a loader pointing at a **stale path**.

**State honestly in your report: this proves reach up to and including the bytes handed to the child process. Only the UAT proves the live external process consumed them.**

## Stale pointers — the "worse than no move" case

A move leaving a stale pointer is worse than no move. §14.17 lists the known readers: six hardcoded default paths, two tests, and a set of docs/manifests. **`tower-runtime.test.js:368` already carries a stale pin** (`tower-qa-skill@1(approved` against a shipped `version: 2`) — **proof this hazard is live, not theoretical.** **Enumerate every pointer yourself; do not trust that list to be complete.** Repo-relative paths under `Builds/**` and session logs under `Team Knowledge/session-logs/` are **historical records — do NOT rewrite them.**

## Explicitly OUT of scope — regrowth cap

**No reviewer-governance layer, law registry, precedence engine, or shared loader framework.** **A shared constants module is also regrowth** — a seventh file to avoid six one-line edits. **Do not inject `CLAUDE.md` into the prompt**: it says *"You are Larry"*, and `--ignore-user-config`, the skill's role boundaries and both adapters exist to neutralise that persona — `fableAdapter.mjs:33` records a real past leak. **Do not make Codex read law off disk** — `--sandbox read-only` blocks its file reads on Windows.

## Acceptance evidence — executed, pasted

- **Baseline first, in your own worktree**, then after: `npm run test:tower-loop` (`executed=`/`failures=`), the review suites, and `services/tower-baton` (`# tests`/`# fail`). **Never the exit code.**
- The reach test **and its mutation half**, with the failing output from each mutation pasted.
- **A grep proving no stale pointer to the old path remains** in live code — with historical records explicitly excluded and named.
- `bash scripts/secret-scan.sh --surface <each declared path>` — **`--surface` mode only.**

## Read-back gate — MANDATORY

**Return a READ-BACK and HOLD.** Outcome in your own words · method · **your proposed contract wording, in outline, mapped to O-1..O-7** · what the order fails to settle · what looks wrong in it. **Preflight and `REFUSE` if under-specified.**

**Four orders in this phase have been refused, every one for a defect in the order rather than the work.** If the `Builds/**` delete exception, or anything else here, conflicts with your contract — **say so rather than building past it.**

`export MSYS_NO_PATHCONV=1` before any Windows command. Git for your branch is yours. You do not decide the merge.
