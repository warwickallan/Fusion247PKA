# SUBAGENT TOKEN LEDGER — BUILD-020 Sub-phase 4C session, 2026-08-07/08

**Written to close the gap Pax named in two consecutive reports: *"All per-specialist token usage — UNESTABLISHED. No figures were supplied and no subagent ledger exists in any committed artefact."*** It exists now.

**Source:** every `Agent` tool return in this session carries a `<usage>` block with `subagent_tokens`,
`tool_uses` and `duration_ms`. This ledger is transcribed from those blocks. **It is Larry reading an
instrument he does not author** — the harness emits it — but it is transcription, so a mis-transcription
is possible and this file is the only copy. Treat it as Larry-sourced evidence, not independent measurement.

---

## ⚠️ THE INTERPRETATION PROBLEM, STATED BEFORE THE NUMBERS

**`subagent_tokens` appears to be CUMULATIVE per agent, not per return. `tool_uses` appears to be PER RETURN.**
Summing every return would therefore double-count badly — roughly 3.9M instead of ~2.2M.

**The evidence for that reading, rather than an assertion:**

Agent `a0192…` returned six times. Its `subagent_tokens` were **monotonically increasing** —
169,156 → 242,923 → 343,045 → 368,884 → 400,335 → 421,871 — which a per-run figure would not be.
Its `tool_uses` were **not** monotonic: 25 → 42 → 43 → 20 → 25 → 14.

The **deltas** between consecutive cumulative totals track the per-run `tool_uses`:

| Run | tool_uses | token delta |
|---|---|---|
| 2 | 42 | +73,767 |
| 3 | 43 | +100,122 |
| 4 | 20 | +25,839 |
| 5 | 25 | +31,451 |
| 6 | 14 | +21,536 |

The same monotonic pattern holds for every resumed agent. **So: take the FINAL value per agent; the deltas
are the per-run cost.** If that reading is wrong the totals below are wrong, and the raw per-return figures
are preserved so anyone can re-derive them.

---

## Per-agent totals (final cumulative value per agent)

| # | Agent | Role | Work | Final tokens |
|---|---|---|---|---|
| 1 | `a0192…` | **Keel** | Convergence inventory · path-defect fix · Codex terminology · ratification banking (**6 runs**) | **421,871** |
| 2 | `aba3f…` | **Pax** | Sub-phase 4B session performance report | **269,717** |
| 3 | `ab5df…` | **Keel** | Port stranded code (BUILD-002 gateway, w01, build-010 assessment) | **244,252** |
| 4 | `a2c9b…` | **Keel** | Codex merge-blocker corrections (fixtures, ancestry evidence) | **219,816** |
| 5 | `a8619…` | **Veritas** | 4C boundary assurance + focused confirmation (**2 runs**) | **215,490** |
| 6 | `a7645…` | **Keel** | Forensic re-audit of 40 recovered branch tips | **211,897** |
| 7 | `a7f45…` | **Keel** | 4C governance contracts (**3 runs**, incl. two correct REFUSALs) | **201,365** |
| 8 | `abeae…` | **Nolan** | MERGE canonicalisation + Veritas contract + outcome-bound rebase (**3 runs**) | **169,932** |
| 9 | `a8c21…` | **Nolan** | S-1 privacy reconciliation + provenance recut (**2 runs**) | **143,415** |
| 10 | `acea7…` | **Nolan** | RECONCILE/MERGE/CONVERGE/CLOSE terminology | **73,606** |
| 11 | `a99ea…` | **Veritas** | Estate re-audit — **stopped by Larry** as out-of-contract | *no usage block emitted* |
| | | | **TOTAL** | **≈ 2,171,361** |

## By specialist

| Specialist | Agents | Tokens | Share |
|---|---|---|---|
| **Keel** | 5 | **1,299,201** | **59.8 %** |
| **Nolan** | 3 | **386,953** | 17.8 % |
| **Pax** | 1 | **269,717** | 12.4 % |
| **Veritas** | 2 | **215,490** | 9.9 % |

## Observations that are figures, not opinions

- **Keel is ~60 % of subagent spend across 5 agents and 14 returns.** Implementation dominates, which is what an execution phase should look like.
- **Veritas is 9.9 %** across two runs — one substantive pass and one focused confirmation. Compare Sub-phase 4B, where Pax measured **eleven** Veritas verdicts consuming 5 h 27 m / 57.7 % of the session for zero product change. **The corrected model's cost profile is visible in this number.**
- **Two of Keel's three returns on `a7f45…` were REFUSALS** — it declined to write root `CLAUDE.md` and a `Team/**/AGENTS.md` because its contract forbids it. Those tokens bought a correction to Larry's Work Order, not implementation.
- **`a99ea…` cost nearly nothing because Larry stopped it** ~1 minute in, on Warwick's correction that Veritas does not perform repository archaeology.
- **Larry's own context at the time of writing: ~838k**, per Warwick. **Subagent spend is roughly 2.6× Larry's own.**

## Known limits

- **Transcribed by Larry from tool returns.** No independent instrument confirms it, and no store holds it — the figures live only in the session transcript and now in this file. **That is itself the finding Pax reported twice.**
- The cumulative-vs-per-run reading is **inferred from the monotonic pattern and the delta/tool-use correlation above**, not from documentation. It is the load-bearing assumption.
- **Larry's own token consumption is not included** — this counts subagents only.
- The stopped Veritas agent emitted no usage block, so its (small) cost is **unmeasured, not zero**.
