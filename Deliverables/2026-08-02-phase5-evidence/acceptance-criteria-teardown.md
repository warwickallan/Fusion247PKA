# Acceptance criteria — the governor teardown diff

Written **before** the diff was finished, derived from the amended Work Order rather than from the code, so the criteria cannot be back-fitted to whatever was built. These become the `brief_excerpt` of the Codex claim for the teardown range.

The `summary` (what the diff *claims*) is deliberately NOT written yet. It gets written from Keel's reported results, and any partial is stated as a partial. Claiming more than was built is the exact failure this whole phase is treating.

---

## B — deletion is complete and clean

- **B1.** These are gone, each with its `.test.mjs`: `stop-controller`, `install-hooks`, `rotate-session`, `collect-state`, `worktree-recon`, `programme-state` (plus `programme-state.schema.json`, `fixtures/programme-state.private-build.json`, `fixtures/programme-state.minimal.json`). Also gone: `.claude/commands/rotate-session.md`.
- **B2.** These SURVIVE and are not deleted: `continuity.mjs`, `continuity-derive.mjs`, `reorient.mjs`, `worktree-guard.mjs`, `footer.mjs`, `evaluator.mjs`, `health-store.mjs`, `atomic-write.mjs`, `sampler.mjs`, **`statusline-live.mjs`**. Ten survivors, not nine — `statusline-live.mjs` was moved from BIN to KEEP mid-order because it is the only authoritative source of the context-window denominator.
- **B3.** No surviving file under `tools/governor/**` imports or references a deleted module. Must be shown by grep output, not asserted.

## C — the two decouplings are surgical, not rewrites

- **C1.** `reorient.mjs` no longer imports `programme-state.mjs` or `rotate-session.mjs`.
- **C2.** `reorient.mjs` still performs all three preserved behaviours: the loose-`Deliverables/` sweep, the Honcho continuity brief passthrough, and repo/worktree/branch verification.
- **C3.** Only `normaliseSeparators` was inlined. `isBankingCommit` was NOT inlined — its sole consumer (`assessBankedFreshness`) is deleted, so inlining it would re-grow a corpse.
- **C4.** `footer.mjs` no longer imports `programme-state.mjs`.

## D — the footer repair is honest

- **D1.** `next:` is a caller-supplied input defaulting to `UNSET`. `nextModelFor` and the five programme-shaped `UNSET_REASON` members are deleted. This matches the constitution: a model renders only when grounded in a real, current next action.
- **D2.** Grammar is `MODEL "/" EFFORT` (e.g. `Opus/high`), `UNSET` still bare. Both vocabularies are frozen literals; the renderer and the anchored `FOOTER_RE` both derive from those literals so they cannot drift. Effort vocabulary is `low|medium|high|xhigh|max`.
- **D3.** `parseFooter(renderFooter(x))` round-trip identity still holds — the existing test must still pass against the new grammar.
- **D4.** **`HANDBACK_CODES` is unchanged** — seven members, exact spelling. The constitution names it as the frozen mirror of the interruption codes. Highest severity row.
- **D5.** The context sample carries a real `used_tokens` and a `context_window_size` that is `null` unless authoritatively known. **No hardcoded model→window table anywhere.**
- **D6.** The footer renders an absolute token count when only the numerator is known, and a percentage only when both are known. `BLIND` remains for when even the token count is unavailable. A fabricated percentage is a defect; a true absolute number is not.
- **D7.** The transcript sample is routed through the already-registered `continuity.mjs stop` hook and `sampler.mjs`'s existing `writeHealthSample`. **No new module, no settings edit** — the regrowth cap.

## E — the criteria have teeth

- **E1.** New executed tests exist for all three preserved `reorient.mjs` behaviours (C2). An acceptance criterion nothing can fail is not a criterion.
- **E2.** Mutation-tested, both: a corrupted health sample makes the `BLIND` rung fire, and a deliberate break of the sweep makes its new test fail. A control that was only read is not evidence.
- **E3.** Test counts are reported as measured, before and after, including `reorient.test.mjs` falling from 53 to roughly 20. Deleting tests for deleted behaviour is legitimate; hiding the drop is not.
- **E4.** `.github/workflows/governor-tests.yml` covers exactly the survivors. Its two existing invariants survive: the `windows-latest` runner, and failure when the executed-test count is not a positive integer. The stale `collect-state.test.mjs` exclusion is removed; `reorient.test.mjs` stays excluded.

## F — what must be REPORTED, not repaired

- **F1.** `worktree-guard.mjs` survives as a file but **not as a protection**: it reads `Deliverables/*/programme-state.json` off disk itself, so with no programme `decide()` returns `DEFER` on every guarded tool. The file stays because Warwick asked for it; the finding must be stated prominently. **Building a replacement guard is out of scope and would be exactly the regrowth being cut.**
- **F2.** `continuity.mjs` and `continuity-derive.mjs` have no test files at all. Two of the ten survivors are untested. Stated as a limitation, not fixed tonight.

---

## Out of scope — do not report as defects

- The policy question of *which* modules Warwick chose to keep. That is his decision, not a code question.
- `CLAUDE.md` and `.claude/settings.local.json` — both are Larry-owned, already handled (`dd5d8eb` and a hand edit), and outside the worker's declared surface.
- Prose, naming or formatting preference.
- The absence of malicious-handler hardening. This estate's defect bar is correctness, accidental leak, availability and audit — a first-party personal system, not a hostile-input service.
