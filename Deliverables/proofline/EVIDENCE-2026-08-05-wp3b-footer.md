# EVIDENCE — WO-2026-08-05-13 · WP-3B: fix the governor footer properly

**Author:** Keel (Implementation Engineer) · **Branch:** `build-020/wp-3b-footer` · **Worktree:** `C:\Fusion247PKA-wp3b-footer` · **Governance head:** `7bcfef70a3eea5763951019673120887544554d4` · **Amendment 1:** `899b0a7`

**Builder self-test evidence — NOT independent review.**

---

## 1. What was established before anything was designed

The Work Order supplied two findings and one open question and told me to test them rather than re-derive them. All three were executed.

| # | Claim as issued | What execution established |
|---|---|---|
| (a) | `footer.mjs` reads `context_window.used_tokens`; the producer writes `total_input_tokens` | **Confirmed, and the "one field name" fix would have been WRONG.** `sampler.mjs` has **two** writers. The statusLine writer (`sampler.mjs:94`) emits `total_input_tokens` and never `used_tokens`; the transcript writer (`sampler.mjs:498`) emits `used_tokens` and explicitly sets `total_input_tokens: null`. A rename blinds every transcript sample; a `??` union merges two different quantities behind one number |
| (b) | The model recommendation is caller-supplied; with no `--next` it renders `UNSET` | **Confirmed by execution** — `node tools/governor/footer.mjs --session <live>` returned `next: UNSET`; adding `--next Opus/high` rendered it verbatim |
| ❓ | `total_output_tokens: 1637` is implausibly low — establish what each field counts **before** showing any of them to Warwick | **Established, see §2.** It is not cumulative |

## 2. The open question — answered by measurement, not inference

Census of **every** health sample in the live store (68 files, read-only, `~/.mypka/governor/health/**`):

| Fact | Value |
|---|---|
| Samples on disk | **68** |
| By source | `statusLine`: **14** · `transcript`: **54** · unrecognised: **0** |
| statusLine samples carrying `total_input_tokens` | **14 of 14** |
| transcript samples carrying `used_tokens` | **54 of 54** |
| Samples carrying a percentage but **no** count | **0** |

Four independent `statusLine` samples, showing what the fields actually count:

| `sampled_at` | `total_input_tokens` | `total_output_tokens` | `used_percentage` | `tit / window` |
|---|---|---|---|---|
| 2026-08-05T20:32:40Z | 927,420 | 1,018 | 93 | 92.74% |
| 2026-08-05T10:27:16Z | 588,838 | 757 | 59 | 58.88% |
| 2026-08-05T21:34:42Z | 248,010 | 1,618 | 25 | 24.80% |
| 2026-08-04T21:49:16Z | 302,445 | 901 | 30 | 30.24% |

**`used_percentage` is `total_input_tokens / context_window_size` in all four cases**, to the rounding. **`total_output_tokens` stays in the 757–1,618 band regardless of how large the session is.**

**Conclusion, stated at the strength the evidence supports:** both fields are consistent with being the **most recent request's** counts — so `total_input_tokens` is current context occupancy (the quantity Warwick asked for) and `total_output_tokens` is **one turn's** output, which is why 1,637 looked impossible. It was never cumulative and nothing should present it as a session total.

**What this does NOT establish, and it matters:** I did not read the producer's source (`statusLine`, host version 2.1.221 — outside this repository), so this is a conclusion from four consistent observations plus a reproduced arithmetic identity, **not** a read of the definition. It is strong enough to select a field and to refuse to call `total_output_tokens` a session cost. It is **not** strong enough to publish `total_output_tokens` as any kind of cost figure, and this change publishes none.

**Consequence adopted from Amendment 1 A-3:** the footer was **not showing a wrong number — it was showing a coarse one.** The win is precision and an absolute. **(a) does not claim to have corrected an error.**

---

## 3. What was built

### (a) Source-aware measurement — `footer.mjs`

`selectContextCount(data)` selects the numerator by the sample's **own `source`** and returns a `CONTEXT_MEASUREMENT` label with it. **Each branch reads exactly one field**, which is what "never union the two" means mechanically:

| `source` | Field read | Label |
|---|---|---|
| `statusLine` | `total_input_tokens` | `statusLine.total_input_tokens` |
| `transcript` | `used_tokens` | `transcript.used_tokens` |
| absent / unrecognised | `used_tokens` | `unattributed.used_tokens` |

The ladder's rung 3 now blinds when there is **no count for the sample's own source**; a reported percentage no longer rescues it (A-3). The label rides on the `deriveFooterFields` **result**, deliberately not inside `fields` — `fields` is exactly the grammar's field set and D-M10 asserts it round-trips through `parseFooter`, so an extra key there would be one the line cannot carry back.

**Live proof, same session, before and after the change:**

```
before:  ⟦GOV⟧ ctx 26% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
after:   ⟦GOV⟧ ctx 33% (331.1k/1000k) · GREEN · KEEP GOING · next: Opus/high · CONTINUE
```

### (b) A recommendation the module computes — on the on-demand path only

`frontierTextFromMap` locates the frontier mechanically: the last heading matching `/frontier/i` **and** the last matching `/phase\s*\d/i`, each excluded if its heading is marked superseded, historical or closed. Both are read because either alone is insufficient on the real map. `classifyFrontier` then applies **Larry's** five policy rows (Amendment 1 A-5) by closed-vocabulary membership; ambiguity resolves to the **higher** candidate.

Executed against the real map from this worktree:

```
mapPath  : Deliverables/2026-08-04-proofline-wayfinder-plan.md
headings : ["16.8 Frontier","16. PHASE 3 — THE ROUTE. **Scope FIXED by Warwick, 2026-08-05...**"]
reason   : matched:Opus/high+Sonnet/medium+Sonnet/low
next     : Opus/high
```

**The A-4 limitation, recorded plainly rather than hidden.** `resolveActiveMapPath` shells out to `git grep` and `git log`. `statusline-live.mjs` imports `footer.mjs` and runs on every statusline refresh, where `footer.mjs:49`'s A-7 invariant forbids a `git` invocation. So the resolver is **injected**, and the only injector is the direct-execution entrypoint — the `await import('./continuity.mjs')` sits **inside** the `if (process.argv[1] && …)` guard. **The statusline therefore still renders `next: UNSET`.** Only the on-demand render computes. A-7 stays structural, not argued, and a test asserts both halves.

`--next` always wins when supplied, **including `--next UNSET`** — a caller stating UNSET is not a silence to be filled.

### (c) The cheap route made discoverable — and nothing else built

The cheap route **already existed**. `--help` returned **exit 2, "unrecognised argument"**. It now returns **exit 0** and a 1,874-byte text that answers what a reader previously had to open 82 KB to learn: what the exit codes mean, which measurement the number is, what `~` means, where `next:` comes from, the seven handback codes, and three worked examples. Per A-2 this is the whole of (c). No wrapper, no script, no launcher.

---

## 4. (d) The benchmark — measured in bytes, with its ceiling stated

**Method.** The "after" is the cost of obtaining one rendered footer line by the cheap route: the bytes of the invocation plus the bytes of stdout. Measured exactly with `Buffer.byteLength`.

| Quantity | Value | How obtained |
|---|---|---|
| Module size the OLD route required reading | **102,530 bytes** | `fs.statSync` |
| Invocation string | **30 bytes** | measured |
| stdout of one render | **70 bytes** | measured |
| **Per-render round trip** | **100 bytes** | measured |
| `--help`, one-time discovery | **1,874 bytes** | measured |
| First-ever use (help + one render) | **2,004 bytes** | measured |

**The "before" figure is CITED, NOT RE-MEASURED, and this is a hard limit.** ~79,000 tokens per render is the recorded observation in map §16.5 E-L / §15.3a — the cost of dispatching a specialist that read the module to learn its CLI. **Critical rule 12 forbids me from spawning a subagent**, so I cannot reproduce it. It is one observed datapoint, not a controlled benchmark, and it must not be read as one.

**The conversion is an ESTIMATE and is labelled as one.** `network: none` and no new dependencies means **no tokeniser is available**, so I can measure bytes and nothing else. At a deliberately pessimistic **2 bytes/token**, 100 bytes ≈ **50 tokens**; at a conventional 4 bytes/token, ≈ **25 tokens**.

**The margin, which is what makes the claim survive the estimate:**

- Required: a reduction of **at least 10×** below ~79,000.
- Implied at 2 bytes/token: **~1,580×**. At 4 bytes/token: **~3,160×**.
- **Break-even:** the claim only fails if 100 bytes somehow exceeded 7,900 tokens — i.e. **79 tokens per byte**. No tokeniser behaves that way, in any encoding.

**So the order-of-magnitude claim holds under any sane assumption — but it is an inference from a measured byte count and a cited token count, not an end-to-end token measurement, and it is not to be quoted as one.** Neither number was produced by a tokeniser.

**A second limit, and it is the honest one.** These bytes measure what the cheap route **costs**. They do **not** show that it is **used** — root `CLAUDE.md` still says the footer "is rendered by a dispatched specialist running `footer.mjs`". Changing that is a permission boundary for Warwick, is **not** mine to author, and is explicitly not an acceptance criterion of this order (A-1). **Until he adopts it, the ~79k route remains the sanctioned one and the saving is available, not realised.**

---

## 5. Executed proofs

```
$ node --test tools/governor/footer.test.mjs
# tests 75
# pass 75
# fail 0
```

Baseline before any change was `# tests 65 / # pass 65 / # fail 0`, so **10 tests were added and none removed**. Exit code alone is not cited: the executed count and the failure count are both read out of the runner.

Neighbouring suites, run because `footer.mjs` is imported by one of them:

| Suite | Result |
|---|---|
| `sampler.test.mjs` | 43 / 43 pass |
| `health-store.test.mjs` | 14 / 14 pass |
| `evaluator.test.mjs` | 34 / 34 pass |
| `continuity-derive.test.mjs` | 23 / 23 pass |
| **`statusline-live.test.mjs`** | **33 pass, 1 FAIL — caused by this change. See §7** |

### Mutation results — every control made to fail

The harness copies the module set **out of the repository** into a temp directory before breaking it: a mutant written beside the original would be a write outside this Work Order's `file_surface`.

| # | Control | Mutation | Proven red by |
|---|---|---|---|
| M1 | source-aware selector | statusLine branch reverted to `used_tokens` — the original defect | the live field-set loses its count and goes BLIND |
| M2 | rung 3 | percentage fallback restored | a percentage-only sample renders `25%` again instead of BLIND |
| M3 | ambiguity direction | `matched[0]` → `matched[matched.length - 1]` | the ambiguous frontier returns `Sonnet/low` instead of `Opus/high` |
| M4 | `--help` | short-circuit deleted | `runCli(['--help'])` exits 2 again |
| M5 | A-4 / A-7 | structural | no static `continuity.mjs` import may exist, and the dynamic one must sit after the direct-execution guard |

**Byte-identical restoration is asserted, not described:** the harness records the SHA-256 of the real `footer.mjs` before the block and asserts it unchanged after. The harness also **refuses to run against a stale target** — it fired on the first run when a multi-line literal failed to match CRLF terminators, which is the guard working.

### The BLIND path, made to fail rather than assumed

Proven three ways: a store that does not exist, a sample whose count field is removed, and a sample carrying the *other* producer's field. All render `⟦GOV⟧ ctx -- · BLIND · NO ADVICE …`, exit 0, and are accepted by `parseFooter`.

### Secret scan

```
$ bash scripts/secret-scan.sh --surface tools/governor/footer.mjs tools/governor/footer.test.mjs \
    tools/governor/sampler.mjs tools/governor/sampler.test.mjs Deliverables/proofline
secret-scan: SCANNED 28 file(s) of the named surface, 0 secret value(s) found.
EXIT=0
```

**Coverage:** exit `0` = SCANNED and clean, over 28 files, 26 detection classes, and it covered the declared `file_surface`. The scanner names its own uncovered classes — an unshaped credential in an ordinarily-named variable, and anything **read** but never written. `private_surface` is `none`, so GL-012's private-surface asymmetry does not apply.

---

## 6. `HANDBACK_CODES` — pinned twice

The frozen literal is asserted one-for-one against a seven-name literal **typed in the test**, and every name is additionally asserted present in root `CLAUDE.md`, read from disk. Both pins live outside the source under test. No member was renamed, added or removed.

---

## 7. Not verified / known limitations

1. **`tools/governor/statusline-live.test.mjs` has one failing assertion that this change caused, and I may not fix it.** Its `realShapedPayload()` fixture is synthetic: `used_percentage: 50` with **no** `total_input_tokens`, a shape that **no live sample has** (0 of 68). Under A-3 that fixture is now BLIND, so `assert.equal(parsed.fields.percent, 50)` fails. The repair is one field in that fixture. **The path is outside my declared `file_surface`** and A-3 said to return rather than write it. Named, not fixed.
2. **The residual risk behind that fixture is real but unevidenced.** If any host version emits a statusLine payload **without** `total_input_tokens`, the terminal status line goes BLIND where it previously showed a percentage. On this machine, 14 of 14 statusLine samples (host 2.1.221) carry it and none lack it. I could not test another host version. This is the one place A-3's rule has a consequence that was not priced.
3. **The frontier vocabulary is where judgement enters.** The five policy rows are Larry's; the word lists implementing them are mine. They are a frozen, readable export precisely so a reviewer can disagree with a word. Classification is deterministic — same text, same answer — but a map phrased in unusual terms yields `UNSET` rather than a wrong recommendation.
4. **One gap in A-5 that I closed by the most conservative reading available, and it should be checked.** The policy does not say what to do when a frontier **is** found but matches no category. I render `UNSET` (`reason: frontier-unclassifiable`), because "never a guess" and "a banked literal presented as live advice is a defect" both point that way, and UNSET is the null rather than a choice among his rows. **I did not invent a sixth row.** If Larry intended otherwise it is a one-line change.
5. **No install, and the change is inert until there is one.** `~/.mypka/governor/` still carries the old copy; WP-3E (Mack) installs. I read that path read-only for measurement and wrote nothing to it.
6. **`sampler.mjs` and `sampler.test.mjs` were in surface and were NOT written.** The fix is entirely consumer-side. Reported so the unchanged surface is not mistaken for an oversight.
7. **Builder evidence only.** These are my own tests on my own change. Nothing here is independent review, acceptance, or merge-readiness.
