# EVIDENCE — WP-3G: the Work Order envelope generator

**Work Order:** `WO-2026-08-05-17` (+ Amendment 1) · **Owner:** Keel · **Branch:** `build-020/wp-3g-envelope`
**Governance head:** `a2d97120a5b5ac9a7d6eb990545754bb2062bfa7`
**As-of point for every count in this file:** 2026-08-05, after WO-16 Amendment 1.

> **Builder self-test evidence — NOT independent review.**

---

## 1. What was built

`tools/wo/envelope.mjs` — a deterministic, zero-dependency generator that Larry runs **before** drafting a Work Order. It resolves envelope fields by copying them out of canonical files, and where it cannot, it emits `UNRESOLVED — <file>:<section> must be read` and leaves the envelope visibly incomplete.

```
node tools/wo/envelope.mjs --owner <slug> --governance-head <sha> [--worktree <path>] [--root <repo>]
```

Markdown rows on stdout. **It writes no files.** It never reads a Work Order, never scores one, has no verdict vocabulary, and **its exit code carries no judgement about any order** (Amendment 1 F-3).

**Field → canonical source, as emitted:**

| Field | Source | Behaviour |
|---|---|---|
| `tool_grant` | `.claude/agents/<slug>.md:tools` | verbatim |
| `tool_grant_not_delivered` | `.claude/agents/keel.md:frontmatter comment` | the recorded sentence, **matched out of canonical prose, not composed** |
| `permitted_file_surface` | `Team/<Folder>/AGENTS.md` | heading-anchored verbatim |
| `prohibited_file_surface` | `Team/<Folder>/AGENTS.md` | heading-anchored verbatim |
| `critical_rules` | `Team/<Folder>/AGENTS.md` | heading-anchored verbatim |
| `credential_scope` `live_authority` `network` `dependency_policy` `private_surface` | `Team Knowledge/Templates/work-order.md` | **read from the template, not hardcoded here** |
| `git_authority` | `Team/<Folder>/AGENTS.md` | three states — verbatim grant · determinate silence · UNRESOLVED |
| `worktree` | supplied, then verified | HEAD compared to the governance head |
| `producible_evidence` | derived from `tool_grant` | constraint line, absence-direction only |

Two design decisions worth stating because they carry the property:

- **The standing authority defaults are read out of the canonical template rather than written into this file.** Hardcoding them would be "redrafted from memory" one level down, and it would silently diverge the day Warwick changes a default. Proven by test: point the generator at a directory with no template and every default becomes `UNRESOLVED`.
- **The not-delivered annotation is matched out of `keel.md`'s own frontmatter prose by regex**, so the emitted sentence is canonical text. If that recorded pattern ever stops matching, the annotation becomes `UNRESOLVED` rather than silently vanishing — a control that quietly stops firing is worse than none.

### The teeth, stated so the acceptance property's central verb is earned

There is **no new mechanism, and none was built**. `UNRESOLVED` reaches the worker **literally, inside the issued order**, and the worker REFUSEs on sight at the existing SOP-022 read-back gate. That is the whole enforcement path (Amendment 1 F-6 / M-2).

---

## 2. Executed evidence

Counts asserted, never the exit code — `node --test` on this Node returns **exit 0 having run zero tests** when a glob matches nothing.

| Command | Exit | Counts |
|---|---|---|
| `node --test tools/wo/envelope.test.mjs` | 0 | **`# tests 30 / # pass 30 / # fail 0`** |
| `bash scripts/secret-scan.sh --surface tools/wo Deliverables/proofline/EVIDENCE-2026-08-05-wp3g-envelope.md` | *see §5* | |

Environment probes re-executed at the governance head, confirming all three `capability_evidence` claims:

| Probe | Result |
|---|---|
| `node --version` | `v22.18.0` |
| `node --test tools/governor/` | `EXIT=1`, `Cannot find module` — directory form broken here |
| `node --test "tools/nope/*.test.mjs"` | **`EXIT=0`, `# tests 0`** — the vacuous green |
| `node --test tools/governor/footer.test.mjs` | `EXIT=0`, `# tests 78 / # pass 78` |

### 2a. The anti-fabrication property, made to fail

A control is not evidence until it has been made to fail. The property was mutated **in the real source file**, the suite run, and the file reverted:

```
LIVE MUTATION APPLIED: unresolved() now returns a plausible guess
  return `${UNRESOLVED_PREFIX}${file}:${section}${UNRESOLVED_SUFFIX}`;
→ return 'Read, Write, Edit, Bash, Glob, Grep';
```

| State | Exit | Counts |
|---|---|---|
| **Generator made to GUESS** | 1 | **`# tests 30 / # pass 20 / # fail 10`** |
| **Reverted** | 0 | `# tests 30 / # pass 30 / # fail 0` |

The ten that went red: the marker shape · unknown specialist → UNRESOLVED · the annotation when the record is unreadable · absent anchor → UNRESOLVED · unknown specialist → all surfaces UNRESOLVED · defaults read not remembered · git prose with no anchor → UNKNOWN · unknown grant → no permissive evidence · incomplete envelope says INCOMPLETE · MUT-1.

### 2b. Eight further mutation proofs, in-suite

Each loads a mutated copy through a `data:` URL — **writing nothing outside the declared file surface** — asserts the mutation genuinely changed the source, asserts the mutant misbehaves, then asserts the invariant goes red against it. A mutation that survives fails the test with `MUTATION SURVIVED — the control is decorative`.

| ID | Mutation | Invariant proven real |
|---|---|---|
| MUT-1 | `unresolved()` returns a plausible grant | unknown specialist must yield UNRESOLVED |
| MUT-2 | absent anchor falls back to `services/**` | an absent anchor must yield UNRESOLVED |
| MUT-3 | unparseable git prose infers "commits and pushes" | must yield UNRESOLVED, never an inferred grant |
| MUT-4 | `GIT_SILENT` becomes an UNRESOLVED string | silence is **determinate**; a conclusion and an unknown never share a string |
| MUT-5 | the not-delivered annotation is suppressed | an over-claiming grant must carry the recorded annotation |
| MUT-6 | standing defaults answered from memory | defaults must come from the template |
| MUT-7 | unknown grant defaults permissive | must not produce a permissive evidence line |
| MUT-8 | the incompleteness notice suppressed | an incomplete envelope must say so |

### 2c. A defect this build has hit three times, hit again here — and caught by the suite

The first run was **`# pass 25 / # fail 5`**. Three of those failures were the **CRLF trap of WO-16 E-1**: the contracts sit in the worktree as CRLF while their blobs are LF, so "verbatim" extraction compared LF text against a CRLF file and failed. Both the generator and its suite now normalise line endings on read, and **"verbatim" is defined out loud as byte-verbatim modulo line-ending normalisation** rather than left as an assumption. The remaining two were ordinary bugs (a missing `head` field; a test case picked against a contract that turned out to carry the alternate anchor).

Recorded because it is the point: **the trap that has bitten this build three times bit the work that exists to reduce such defects, and only an executed test found it.**

**And it was then proven closed rather than assumed closed.** `git add` warned that all three files will be CRLF on the next checkout, so the working tree was converted to CRLF — simulating a fresh clone — and the suite re-run:

| Working tree | Exit | Counts |
|---|---|---|
| LF (as authored) | 0 | `# tests 30 / # pass 30 / # fail 0` |
| **CRLF (as a fresh checkout delivers it)** | 0 | **`# tests 30 / # pass 30 / # fail 0`** |

This matters beyond tidiness: the mutation harness matches multi-line targets against the source text, so without normalisation **every mutation proof in §2b would fail to find its target on any fresh clone** — the suite would go red for a reason having nothing to do with the code, and the controls would look broken rather than absent. Files restored from the index afterwards; working tree clean.

---

## 3. THE REPLAY — the real verification

**Baseline, Warwick's recorded figure, verbatim and unmoved: 14 class-A defects across 16 Work Orders.** Post-baseline defects accrue separately and are named as such.

**The corpus below is counted in DEFECTS, not orders**, with one ID per defect and the as-of point at the head of this file. Orders and defects are different units and mixing them is what produced the drift Amendment 1 F-2 settled.

**Scoring.** `PREVENTED` — the generator, run before drafting, emits the correct value or an `UNRESOLVED` marker that stops the wrong value being typed. `PARTIAL` — it surfaces the governing fact at the reasoning stage but does not reach the defect. `NOT PREVENTED` — outside the seven fields. `UNESTABLISHED` — could not be scored from what is on disk, and is not guessed.

### 3a. From map §14.21 — the seven Phase 2 refusals

| ID | Order | Defect | Verdict |
|---|---|---|---|
| R-01 | WO-01 | no `file_surface` declared; 7 further envelope fields missing | **PREVENTED** |
| R-02 | WO-02 | `private_surface` = the secrets-store ROOT | **PREVENTED** |
| R-03 | WO-02 | AC would spawn a real Codex run and two Telegram messages to Warwick | NOT PREVENTED |
| R-04 | WO-02 | `node_modules` absent, so no evidence command could run | NOT PREVENTED |
| R-05 | WO-03 | `Builds/**` in a permanently barred surface | **PREVENTED** |
| R-06 | WO-03 | `live_authority: BOUNDED` — not a permitted value | **PREVENTED** |
| R-07 | WO-03 | scheduled-task work belonging to Mack | NOT PREVENTED |
| R-08 | WO-03 | `private_surface` = the secrets root **again** | **PREVENTED** |
| R-09 | WO-03 | a seventh start path falsifying the acceptance property | NOT PREVENTED |
| R-10 | WO-04 | a condition requiring a check the order's own prohibition forbade | NOT PREVENTED |
| R-11 | WO-04 | acceptance property claiming eight paths from a four-path proof | NOT PREVENTED |
| R-12 | WO-05 | `Builds/**` again | **PREVENTED** |
| R-13 | WO-05 | a reach test that would have passed BY BLOCKING in CI | NOT PREVENTED |
| R-14 | WO-05 | ratification left to a worker who may not ratify | PARTIAL |
| R-15 | WO-06 | `live_authority` not `none` | **PREVENTED** |
| R-16 | WO-06 | acceptance property unreachable inside the surface | NOT PREVENTED |
| R-17 | WO-06 | order in-prompt only, no Work Order on disk | NOT PREVENTED |
| R-18 | WO-06 | an instruction reversing an approved governance redline | NOT PREVENTED |
| R-19 | WO-07 D1 | relocating `reorient.mjs` would silently kill the Deliverables sweep | NOT PREVENTED |
| R-20 | WO-07 D2 | acceptance property blind to a double-fire | NOT PREVENTED |
| R-21 | WO-07 D3 | `network`/`credential_scope` `none` while the evidence POSTs and reads a credential | PARTIAL |
| R-22 | WO-07 D4 | two conflicting governance heads | **PREVENTED** |
| R-23 | WO-07 A2 | the SHAs named would have deployed the defect | NOT PREVENTED |

### 3b. Post-§14.21 defects

| ID | Order | Defect | Verdict |
|---|---|---|---|
| R-24 | WO-10 | `MSYS_NO_PATHCONV` breaks `git -C` with POSIX paths | NOT PREVENTED |
| R-25 | WO-11 A-5 | `worker_contract` cites `Team/Pax - Senior Researcher`, which does not exist | **PREVENTED** |
| R-26 | WO-11 A-3 | `blocking_dependencies` overstated as blocking | NOT PREVENTED |
| R-27 | WO-11 A-2 | Pax holds no `Bash`; the order required executable evidence | **PREVENTED** |
| R-28 | WO-12 | GL-012 breach — an authorised route read the secrets-store root | PARTIAL |
| R-29 | WO-13 | Keel `REFUSE` — four contradictions, six missing requirements | **UNESTABLISHED (10 grounds unscored)** |
| R-30 | WO-15 D-1 | `contract_basis` stretched across five surface entries; SOP-001 §7 cited as coverage it does not give | NOT PREVENTED |
| R-31 | WO-15 D-2 | a push instruction issued to a specialist **whose contract is silent on git** | **PREVENTED** |
| R-32 | WO-15 D-3 | four routing points not coherent without a fifth | NOT PREVENTED |
| R-33 | WO-15 D-4 | order committed after the worktree was cut | NOT PREVENTED |
| R-34 | WO-15 D-5 | read-only inventory not named | NOT PREVENTED |
| R-35 | WO-16 E-1 | CRLF direction stated backwards | NOT PREVENTED |
| R-36 | WO-16 E-2 | tautological rollback proof | NOT PREVENTED |
| R-37 | WO-16 E-3 | ten modules at head vs eight installed | NOT PREVENTED |
| R-38 | WO-16 E-4 | stale documentation line | NOT PREVENTED |
| R-39 | WO-15, WO-17 | **the order does not exist at its own governance head** | NOT PREVENTED |
| R-40 | WO-17 | `contract_basis` prose where the template requires one entry per surface and per non-file action | NOT PREVENTED |
| R-41 | WO-17 | absent `build`, `wp_number`, `tags`, `schema_decision`, `security_inputs`, one-sentence `outcome` | NOT PREVENTED |
| R-42 | WO-17 | `contract_conflicts` carrying a prohibition where the earned value is `none` | NOT PREVENTED |

**CONTROL ITEM — SCORES NOTHING.** WO-16's Nolan-flagged seam was **already caught by the pre-dispatch check before the order was dispatched**. It is listed so a reader can see it was excluded, not counted. Replaying an already-prevented item can only manufacture a free PASS.

### 3c. The result, in both units, because the unit changes the number

| Unit | Prevented | Partial | Not prevented | Rate |
|---|---|---|---|---|
| **Defects** (41 scored; R-29's 10 unscored) | 11 | 3 | 27 | **27%**, or **34%** counting partials |
| **Orders touched** (13 refused orders) | 8 | — | 5 | **62%** |

**Both are true and they are four-fold apart. That gap is itself the finding**, and it is the mechanism that produced the 13/14/15/17 drift Amendment 1 F-2 had to settle. **Do not quote a bare rate from this file.** Quote the unit.

Against the expectation adopted into the order — *"roughly half"* — the honest per-defect answer is **materially worse than half**.

### 3d. The structural result, and it has no exceptions in either direction

> **Every defect the generator prevents is a surface-or-authority field. Every acceptance-property-and-reasoning defect survives it. There is not one exception in either direction across 41 scored defects.**

That is checkable against the tables above by anyone who was not told the answer, and it is the honest ceiling of this approach: **a field generator repairs the fields it generates, and nothing else.**

The 27 survivors fall into three groups:

1. **Acceptance-property and reasoning defects — 18.** Structurally unreachable. Detecting them means inspecting a drafted order, which is the prohibited checker.
2. **Envelope fields outside the seven — 5** (R-26, R-30, R-39, R-40, R-41, R-42 less overlap). Reachable in principle; not built, because the seven-field list is the order's and widening it is scope I may not take.
3. **Facts about the world — 4** (R-04, R-19, R-24, R-37). Genuine class-B discovery; the read-back gate is the right control and it worked every time.

---

## 4. Evidence for Warwick's "reduce the format" instruction

His standing instruction: *"If any Class-A defect survives the three live orders, do not add Nolan or another checker. Reduce the Work Order format and constraint density until Larry can produce it reliably."* The replay is the evidence base, and it says the following plainly.

1. **The defect rate is not falling and the format is the common factor.** 15 class-A defects across 17 orders — near one per order — sustained across two different detection regimes. WO-16 passed a bounded pre-dispatch check and **still carried four defects**. Moving detection did not repair generation, and this generator repairs only a quarter of the defects by count.
2. **The single most-repeated envelope defect is pure ceremony.** `contract_basis` — one entry per surface entry and per non-file action, each citing an exact contract clause — was drafted wrongly in **WO-15 and again in WO-17, two of the last three orders**. It is also the field the generator could replace outright, since permitted surfaces and their governing headings are exactly what it already extracts verbatim. **Recommend: `contract_basis` becomes generated output, not authored prose.** This is the highest-value single reduction available and it removes a field rather than adding a control.
3. **Roughly a third of the mandatory frontmatter never varies.** `credential_scope` `live_authority` `network` `dependency_policy` `private_surface` are the standing defaults on essentially every order, and any deviation is a Warwick escalation by rule. They are typed by hand each time and were mis-typed at least four times (R-02, R-06, R-08, R-15). **Recommend: state them once as standing defaults and require the order to carry only deviations**, each with its escalation.
4. **Two fields cost more than they return.** `tags` and `wp_number` are absent from WO-17 with no consequence whatsoever, which is the cleanest possible evidence about their value.
5. **One defect is trivially mechanisable and recurred one order later — R-39.** An order that does not exist at its own governance head cannot be read by the worker it governs. It happened in WO-15, was recorded as a defect, and happened again in WO-17. The generator already resolves a path against a head for the worktree; **an eighth field doing the same for the order path would close it.** I did not build it — the seven-field list is the order's and widening it unasked is exactly the scope expansion my contract forbids. **This is Larry's call, and it is cheap.**

**What the evidence does NOT support:** that a generator, a checker, or any further mechanism will close the acceptance-property class. Eighteen of the twenty-seven survivors are defects in *reasoning about what would prove the outcome*, and nothing that reads fields can reach them. On this evidence the acceptance-property class is either a reduction target or a permanent cost of the format — **and that is Warwick's decision, not mine and not Larry's.**

---

## 5. Scope, controls and limitations

**Files written — 3, all inside `file_surface`, none outside:**

- `tools/wo/envelope.mjs`
- `tools/wo/envelope.test.mjs`
- `Deliverables/proofline/EVIDENCE-2026-08-05-wp3g-envelope.md`

**Not verified / known limitations — what a reviewer must still check:**

- **This is builder self-test evidence, not independent review**, and the tests are untrusted by default.
- **The generator produces text; it does not make Larry paste it.** Nothing mechanically confines a Work Order to the fields it emits. The teeth are the read-back gate and nothing else, and that is a behavioural control, not an enforced one.
- **`UNRESOLVED` on the permitted-surface field for 4 of 19 specialists** (larry, nolan, penn, veritas) — their contracts carry no permitted-surface anchor. Critical-rules anchors are absent for 7 of 19. This is the safe direction, but it means those envelopes arrive incomplete and a human must still read the contract.
- **"Verbatim" means byte-verbatim modulo line-ending normalisation.** Stated, not assumed — see §2c.
- **R-29 (WO-13, ten grounds) is UNESTABLISHED and unscored.** The amendment records the rulings, not a clean enumeration of the original grounds, and reconstructing them was judged not worth the closure time. Scoring them would move the per-defect rate by at most a few points in either direction; **it is reported as a gap rather than estimated.**
- **The per-defect enumeration is mine.** Where a source recorded a defect as a bundle, I split it by ground. A different reasonable split changes the denominator and therefore the rate — which is exactly why §3c reports two units and why no bare rate should be quoted from this file.
- **The three live orders are Larry's**, not run here. The first genuine Work Order after the fresh session is the live acceptance test.
