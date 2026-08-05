# EVIDENCE — WO-2026-08-05-13 · WP-3B: fix the governor footer properly

**Author:** Keel (Implementation Engineer) · **Branch:** `build-020/wp-3b-footer` · **Worktree:** `C:\Fusion247PKA-wp3b-footer` · **Governance head:** `7bcfef70a3eea5763951019673120887544554d4` · **Amendment 1:** `899b0a7` · **Amendments 2 + 3:** `71cb19e` · **Amendment 4:** `60f0e18`

**Builder self-test evidence — NOT independent review.**

> **§§1–5 below record the work as it stood under Amendment 1. Amendment 3 then superseded the ≥10× target and moved the recommendation off the render path entirely — see §8, which supersedes §3's placement of the classifier and §4's acceptance target. Nothing in §§1–5 is withdrawn as evidence; the measurements and the census still hold.**

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

---

# 8. AMENDMENTS 2 AND 3 — the subagent comes out of the footer path

Recorded separately because Amendment 3 is a **design ruling**, not feedback. Where it conflicts with sections 3–4 above, it wins.

## 8.1 Amendment 2 — the false-witness fixture (B-2)

`realShapedPayload()` in `tools/governor/statusline-live.test.mjs` carried `used_percentage: 50` and **no token count**, under a name asserting it was the real shape. The census settles that it was not:

| Measure | Value |
|---|---|
| Live samples on disk | **68** (`statusLine` 14 · `transcript` 54) |
| statusLine samples carrying `total_input_tokens` | **14 of 14** |
| transcript samples carrying `used_tokens` | **54 of 54** |
| Samples carrying a percentage and **no** count | **0 of 68** |

Corrected to a payload the host actually emits: `total_input_tokens: 500_000` against a `1_000_000` window (consistent with the 50% it already claimed) and `version` moved to `2.1.221`, the version observed on disk. **No assertion weakened, no tolerance widened, nothing special-cased** — the 50% assertion still has to be earned. `statusline-live.test.mjs`: **34 tests, 34 pass, 0 fail**.

### B-3 — why BLIND on a percentage-only sample is kept, recorded so it can be challenged

A reported percentage is not a **measured** context number, and WP-3B(a) asked for a measured one. Root `CLAUDE.md`: *"If it cannot be read, the footer says `BLIND` and reports no numbers. It never renders a healthy state it did not measure."*

**The trade, stated with its numbers so a later reader can argue with it rather than rediscover it:** this behaviour blinds a shape that **0 of 68** live samples have, on a host (**2.1.222** installed; samples written by **2.1.221**) where **14 of 14** statusLine samples carry the count. **The residual risk is a future or older host that emits a percentage without a count** — that terminal status line would go BLIND where it previously showed a percentage. It fails **safe**: BLIND is loud and self-describing, so the degradation is visible rather than a confident wrong number. I could not test another host version.

## 8.2 Amendment 3 (C-2) — the recommendation is now CACHED, and the render resolves nothing

The classifier and `FRONTIER_VOCABULARY` **moved from the render path to a refresh path**. Same code, run rarely.

| Path | What it does | Cost |
|---|---|---|
| `--refresh` | resolves the active map (git), classifies the frontier, writes the cache | ~0.30 s wall, run on one of Warwick's five events |
| render (default) | reads one small JSON; at most stats one path | **~0.08 s wall, 0 model contexts, 0 git** |

**Executed end to end, with the store redirected** (`live_authority: none` forbids writing under `~/.mypka/**`, so `MYPKA_GOVERNOR_HEALTH_DIR` pointed at a temp dir):

```
1. render before any refresh   ⟦GOV⟧ ctx 38% (376k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
2. --refresh                   footer: recommendation refreshed — next: Opus/high (matched:Opus/high+Sonnet/medium+Sonnet/low)
3. render after refresh        ⟦GOV⟧ ctx 38% (376k/1000k) · GREEN · KEEP GOING · next: Opus/high · CONTINUE
```

The refresh prints a plain summary, **not** a footer — a maintenance command that emitted a governor line would put a footer into the transcript nobody asked for, which is the staple N-4 exists to prevent. A test asserts `parseFooter(refresh.stdout).ok === false`.

### The decisive proof that the render invokes no git — run with git unreachable

```
$ git --version                                   # control: git is reachable normally
git version 2.51.0.windows.2

$ env -i MYPKA_GOVERNOR_HEALTH_DIR=... PATH=/nonexistent node tools/governor/footer.mjs --session <id>
⟦GOV⟧ ctx 38% (376k/1000k) · GREEN · KEEP GOING · next: Opus/high · CONTINUE
render exit=0

$ env -i ... PATH=/nonexistent node tools/governor/footer.mjs --refresh
footer: recommendation refreshed — next: UNSET (no-active-map-found)
refresh exit=0
```

**The render produced the full line — number and recommendation — with git absent from PATH.** The refresh, which genuinely needs git, **degraded to UNSET rather than lying**. The entrypoint now guards the `continuity.mjs` import by **argument** (`--refresh`), not merely by the direct-execution guard, so a render never loads a module that can shell out.

### The one place the render still touches the map, declared rather than buried

The render performs **one `statSync`** on the map path the cache itself recorded, and renders UNSET (`reason: cache-stale-map-changed`) if the map has moved. **Metadata, not content: no git, no resolution, no parse, O(1).** It can only **withdraw** a recommendation, never invent one.

**Why I added it rather than shipping without it:** a cache refreshed "only when an event changes the answer" is only as good as whatever notices the event. If nothing notices, the footer keeps recommending for a phase that closed — **exactly the banked-literal-as-live-advice defect** the constitution names, and the reason `nextModelFor` was deleted. **If Larry reads C-2 as forbidding even a stat, `statFn: () => null` disables it and the cache becomes trust-only.** I would rather be told to remove this than ship that defect silently.

### N-4 — implemented OPT-IN, and the default contract is untouched

`--if-changed` prints nothing when the line is identical to the last one, and exits with a **distinct code (3)**. It does **not** go silent ambiguously: B6 treats "no valid footer" as ALLOW, so a renderer that silently printed nothing would be indistinguishable from a governor that had stopped governing. Without the flag, every invocation still prints exactly one parseable line and exits 0. Warwick's trailing clause — *"unless he explicitly wants the deterministic status line on every reply"* — is **his open choice**, and this makes both available without a further code change rather than deciding it for him.

## 8.3 C-3 — the negative claim, TESTED. Neither branch is asserted, and here is why

Root `CLAUDE.md` states: *"No hook can render this footer, and none ever will… `MessageDisplay` is display-only and CLI-only, so it reaches nothing on web or Android."*

### What execution ESTABLISHED — the mechanism exists, so the claim is too strong as written

Read-only inspection of the installed host binary (`C:\Users\Buggly\.local\bin\claude.exe`, version **2.1.222**, 279 MB):

| Hook event string | Occurrences |
|---|---|
| `additionalContext` | 186 |
| `PostToolUse` / `PreToolUse` | 185 / 133 |
| `hookSpecificOutput` | 124 |
| `SubagentStop` / `UserPromptSubmit` | 73 / 71 |
| `systemMessage` | 63 |
| `SessionEnd` / `PreCompact` | 45 / 45 |
| **`MessageDisplay`** | **38** |

Strings recovered from the same binary, verbatim:

- `Text displayed in place of the delta. Omit (or return the delta unchanged) to display the original.`
- `MessageDisplay hook failed for completed message; emitting original text:`
- `MessageDisplay hook flush … failed; displaying original delta:`
- `UUID of the assistant message being displayed. Stable across every flush of the same message. Not the API msg_ id.`
- a dispatch branch: `case "MessageDisplay": u.displayContent = e.hookSpecificOutput.displayContent; break`
- a handler shape: `wth({getAppState, onStreamingDisplay, onMessageDisplay})`, and a call path tagged `"sdk"`

**So a hook CAN replace the displayed text of an assistant message, including a COMPLETED one.** The `CLAUDE.md` sentence *"No hook can render this footer, and none ever will"* is **falsified as to mechanism**. That much is established by execution, not inherited.

### What execution did NOT establish, and could not under this order's authorities

**Whether that display transformation reaches Warwick's web/Android client.** Deciding it requires **both**:

1. **Installing a hook** in `C:\Users\Buggly\.claude\settings.json` — machine-level configuration. That is `live_authority` I do not have (`none`), it is **Mack's declared seam (WP-3E)**, and `.claude/**` is categorically prohibited to me by critical rule 5.
2. **Observing Warwick's own web/Android client** while it runs — his device, not mine.

**I therefore assert neither branch, as instructed.** What is relevant and established: this machine currently runs `SessionStart -> reorient.mjs` and `Stop -> continuity.mjs stop`, the statusline is `node C:/Users/Buggly/.mypka/governor/statusline-live.mjs`, and **`remoteControlAtStartup: true`** — which is precisely why Warwick sees this machine's sessions on web/Android, and precisely why the question cannot be answered from this side alone.

**The experiment that would settle it, in one run:** register a `MessageDisplay` hook whose command appends a fixed marker to `displayContent`, send one message, and look at the web/Android client. If the marker appears, **N-1 and N-2 are met absolutely and the pasted footer disappears**. If it does not, the floor below stands. **Owner: Mack, under WP-3E, with Warwick observing the client.** It costs one message and no model tokens beyond that message.

### The floor, measured — per C-3's second branch, which is owed either way

```
wall clock, one render      : 76 ms
invocation bytes            : 77
stdout bytes                : 85
total bytes in Larry context: 162
new model contexts started  : 0
```

**Why it is not zero, stated exactly.** The render itself costs **zero LLM tokens** — it is a node process; no model is invoked, and the recommendation comes from a cache, so N-1 and N-3 are met on this route. The residual is **not** the footer: it is the **tool call**, which occupies ~162 bytes of Larry's *already-running* context. **No new model context is started, no contract is loaded, nothing is interpreted.** That residual cannot reach zero while a model is the thing deciding to ask — which is exactly why the hook question above is worth settling: only the hook route removes the **asking**, not merely the answering.

**Comparator, cited and not re-measured:** 79k, 79k, 39k tokens for three dispatched renders this session (Larry's record, Amendment 3 C-5). Critical rule 12 forbids me a subagent, so I did not and could not reproduce them.

## 8.4 Acceptance under the replaced criteria

| # | Criterion | Status |
|---|---|---|
| **N-1** | context number: zero LLM tokens | **met** — deterministic node render, proven working with git unreachable |
| **N-2** | normal render: zero LLM tokens | **met on the render itself.** The residual is the tool call in Larry's existing context (162 bytes), not a new model context |
| **N-3** | recommendation: no additional model invocation | **met** — cached; the render reads JSON and stats one path. Refresh runs on an event |
| **N-4** | no footer when nothing meaningful changed | **mechanism delivered opt-in** (`--if-changed`, exit 3). Whether it is used on every reply is Warwick's open choice |

**What no longer belongs to this Work Order:** the `CLAUDE.md` redline (Larry carries it; Warwick ratifies), the machine install (Mack, WP-3E), and the hook experiment above.

## 8.5 Proofs at this head

```
$ node --test tools/governor/footer.test.mjs
# tests 77 · # pass 77 · # fail 0

$ node --test tools/governor/statusline-live.test.mjs
# tests 34 · # pass 34 · # fail 0
```

Baseline was 65/65 on the footer suite and 34/34 on statusline-live. **12 tests added, none removed, none weakened.** Neighbouring suites re-run and unchanged: `sampler` 43/43, `health-store` 14/14, `evaluator` 34/34, `continuity-derive` 23/23.

---

# 9. AMENDMENT 4 — the cache/sample collision. Found in live use, not by this suite

## 9.1 The defect, reproduced before it was fixed

`--refresh` wrote `recommendation.json` as a **direct child of the health store directory**. `resolveHealthSample`'s no-session branch lists that directory, keeps every `*.json`, sorts by mtime, and **treats the newest basename as a session id** (`footer.mjs`, `candidates[0].name.replace(/\.json$/, '')`). So the freshly written cache was selected *as a health sample*, carried no context fields, and the footer rendered BLIND.

Reproduced by me against the pre-fix code, with the store redirected to a temp directory holding one real live sample:

```
1. render, no --session, BEFORE refresh:
   ⟦GOV⟧ ctx ~40% (395.6k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
2. --refresh
   footer: recommendation refreshed — next: Opus/high (matched:...)
3. render, no --session, AFTER refresh:
   ⟦GOV⟧ ctx -- · BLIND · NO ADVICE · next: Opus/high · CONTINUE      ← the number is gone
4. ls -t <store>:  recommendation.json   5a984703-….json
```

**Severity is not "transient".** Every render between a refresh and the next statusLine sample loses the measured number, and a refresh fires on exactly the five events Warwick named — so the number disappears at the five moments he is most likely to look, then returns on its own. It defeats WP-3B(a) precisely when the recommendation becomes useful, and it reads as a glitch rather than a defect.

## 9.2 Why the suite did not catch it — the lesson, recorded because it will recur

**Every test redirects the store with `MYPKA_GOVERNOR_HEALTH_DIR`, and every cache test passed `--session`** — which reads an *exact* file and never scans. So the cache and the samples were only ever exercised **apart**. They share a directory only in real use.

**This is E-F's lesson in a second costume: a fault that exists solely in the interaction between two things is invisible to every test that separates them.** E-F was two defects that partially masked each other; this is two artefacts that never met. The general form: *a green suite plus a redirected store is not a proven product.*

The honest scoreboard for this Work Order: **the suite proved every property I thought to state, and a human using the tool for ninety seconds found the one I did not.**

## 9.3 The fix — structural, not a filter

`recommendationPath` now returns `<store>/state/recommendation.json`. The resolver's scan is **one level deep and extension-filtered**, so nothing inside `state/` can ever be enumerated as a sample. **The cache is invisible to the resolver because of where it is, not because of a name the resolver has been taught to skip** — there is no rule left to keep in step with the file, so there is nothing that can silently decay.

**Why a subdirectory rather than a true sibling of the store, which the amendment preferred.** `healthStoreDir` returns `MYPKA_GOVERNOR_HEALTH_DIR` **verbatim** when set. Writing to `<store>/..` would write *outside the directory an operator explicitly pointed the governor at* — into the parent of a temp directory under test, and into whatever sits above the store in a redirected deployment. Staying inside the nominated root is the safer half of "not in the scanned path" and achieves the same separation. **If Larry wants a true sibling, it is one line** (`RECOMMENDATION_SUBDIR` and the `join`).

Verified live after the fix, same procedure:

```
1. render BEFORE refresh:  ⟦GOV⟧ ctx ~40% (395.6k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
2. --refresh:              footer: recommendation refreshed — next: Opus/high
3. render AFTER refresh:   ⟦GOV⟧ ctx ~40% (395.6k/1000k) · GREEN · KEEP GOING · next: Opus/high · CONTINUE
4. render again:           ⟦GOV⟧ ctx ~40% (395.6k/1000k) · GREEN · KEEP GOING · next: Opus/high · CONTINUE
5. scanned dir:            state/   5a984703-….json
6. cache:                  <store>/state/recommendation.json
```

## 9.4 The regression test — shown RED before green

Added to `footer.test.mjs`. Against the unfixed module:

```
not ok 78 - WP-3B / AMENDMENT 4: the recommendation cache is NEVER selected as a health sample
error: 'the cache must not be a direct child of the scanned store directory —
        got …\gov-footer-ZMOm7A\recommendation.json'
# tests 78 · # pass 77 · # fail 1
```

After the fix: **78 / 78 / 0.**

Two things it asserts, deliberately in this order:

1. **The structural invariant, on the path** — the cache is not a direct child of the scanned directory, and `readdirSync(store)` does not contain it. This is the property that makes the defect *impossible*, not merely absent today.
2. **The behaviour that invariant buys** — with **no `--session`** (the newest-file scan, the exact path the defect lived on), a real sample is still selected, `percent` is 25, the measured count 248,000 survives, and the cached `Opus/high` is still read.

**The mtimes are set explicitly** with `utimesSync` rather than left to write order: a regression test for a newest-file race that depends on filesystem timestamp granularity is flaky, and a flaky test for this defect is worse than none.

**Mutation M6** puts the cache back in the scanned directory and asserts the live defect returns — `state: BLIND`, `percent: null`. Six mutations now, all proven red, with the module's SHA-256 asserted byte-identical afterwards.

## 9.5 Reported, not fixed — the broader assumption behind this defect

**`resolveHealthSample` trusts every `*.json` child of the store directory to be a health sample.** My cache was the first artefact to violate that, but nothing prevents the next one. The class-closing fix is to validate a candidate's *shape* before accepting it — a sample without a `session_id` matching its filename, or without a `context_window`, is not a sample — which is a change *inside* `footer.mjs` and therefore inside my surface.

**I have not made it.** Amendment 4 asked for one fix, at source, and a second behavioural change to the resolver in the same commit would be scope I was not given and would blunt the regression test's meaning. **Severity: low while nothing else writes there; the moment something does, the symptom is a silent BLIND rather than an error.** Raising it or not is Larry's call.

**One operational note for WP-3E (Mack):** a `recommendation.json` written by the *previous* commit on this branch may still exist as a direct child of a real store directory. It is inert to the fixed code but will still poison the scan while it sits there. Larry has already removed the one he created; the install should confirm none remains. **It is under `~/.mypka/**`, which `live_authority: none` puts outside my reach.**

## 9.6 Counts at this head

```
footer            78 / 78 / 0        continuity          92 / 92 / 0
statusline-live   34 / 34 / 0        reorient            58 / 58 / 0
sampler           43 / 43 / 0        worktree-guard      28 / 28 / 0
health-store      14 / 14 / 0        atomic-write        19 / 19 / 0
evaluator         34 / 34 / 0        continuity-derive   23 / 23 / 0
```

**Full governor set: 10 suites, 423 tests, 423 pass, 0 fail.** Thirteen tests added by this Work Order since the 65-test baseline; none removed, none weakened.
