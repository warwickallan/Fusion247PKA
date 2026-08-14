# Return — 4F item 8b: the dispatch guard must be DIAGNOSTIC and must NEVER prompt Warwick

**Keel · 2026-08-09 · branch `build-020/wo-readiness-validator` · worktree `C:/Fusion247PKA-wo-valid`**
**Work Order:** `Deliverables/2026-08-09-WO-4F-08b-guard-diagnostic-never-prompts.md` (`WO-2026-08-09-06`)
**Branch point `8990ea1` · governance head as dispatched `8990ea1` · order's `governance_sha` `6cc713f`**

**Status: PARTIAL.** AC1–AC6 are met with executed evidence. The verdict is PARTIAL and not
COMPLETED for one structural reason the order itself names: **this order cannot make the control
automatic**, and §8 states that in full.

**Builder self-test evidence — NOT independent review.**

---

## 1. READ-BACK

Returned here rather than held, on the order's own instruction (*"Do NOT hold for my acceptance;
state it at the top of your return and continue"*), which is Larry's pre-acceptance of the gate under
SOP-022 §"Larry's half of the gate". Recorded, not assumed.

```
WORK ORDER READ-BACK

Outcome understood:
  A guard already exists that refuses an unready Work Order at the dispatch event. Warwick has
  approved switching it on and has bounded HOW it may behave, and both bounds are about the
  human at the other end. First: it is Larry's quality control, not Warwick's approval queue —
  so a decision that asks a human is a defect of this control, not a cautious default, and
  "we never wrote the word ask" is not a guarantee, it is a hope. Second: a refusal has to be
  correctable in seconds, which means naming the offending field and saying whether it is
  ABSENT or the wrong SHAPE — those need different fixes, so merging them costs a hunt. The
  order also asks me to measure the known holes honestly rather than engineer them away.

Owned files/surfaces:
  Exactly the six paths in `file_surface`, all verified against the Keel contract:
    tools/wo/dispatch-guard.mjs · tools/wo/dispatch-guard.test.mjs · tools/wo/envelope.mjs ·
    tools/wo/envelope.test.mjs · tools/wo/README.md ·
    Deliverables/2026-08-09-return-4F-item8b-diagnostic-never-prompts.md
  `tools/**` is "Where Keel writes"; the return path is the `Deliverables/**` carve-out for an
  authorised implementation-adjacent document, and it IS in `file_surface`, which is what makes
  it writable — the order's `contract_basis` note on this is correct.
  NOT owned and not touched: `.claude/settings.json`, `tools/governor/worktree-guard.mjs`,
  anything on the BUILD-015 / B15-3 path.

Inputs and authorities:
  private_surface: NONE — stated back explicitly. The secrets store is denied by default and
  nothing here goes near `C:/.fusion247/`. credential_scope: none · live_authority: none ·
  network: none · dependency_policy: no-new-runtime-deps (honoured: zero new imports).
  operational_handoff: none, so the runbook gate does not apply and I do not refuse for it.
  Inputs read at source: the predecessor return on this branch; `worktree-guard.mjs` read-only
  for the decision vocabulary; `.claude/settings.json` read-only.

Acceptance evidence:
  ⚠️ The order's named evidence command DOES NOT RUN HERE, and I checked before trusting it.
  `node --test tools/wo/` fails with MODULE_NOT_FOUND on this machine's Node v22.18.0 — the
  exact live defect SOP-022 §2 records. Substituted with the explicit file list
  `node --test tools/wo/envelope.test.mjs tools/wo/dispatch-guard.test.mjs`, which executes
  strictly MORE than the directory form would have, and reports counts. Baseline before any
  change: 97 executed, 97 pass. Everything else in `## Required evidence` runs as written.

Assumptions:
  1. "The prompting value" is `ask`. NOT taken from the order — established by reading
     `tools/governor/worktree-guard.mjs` (`:63` the enum, `:895` the emission map, `:65`
     `PUSH_ASK_REASON = 'Warwick approval required for push to main.'`). The test corroborates
     this against that file so the guarantee is not measured against a straw man.
  2. `allow` is also out of bounds. The order names only `ask`. I read the constraint as
     "this control never speaks for the human", and `allow` suppresses the host's own permission
     layer, which is equally not this control's business. Stated because it is my inference,
     not Warwick's words.

Contradictions:
  1. ⚠️ THIS ORDER FAILS ITS OWN GATE. `--assess` returns NOT READY on
     `WO-2026-08-09-06`: AC3 cites `services/cockpit/db.mjs` and AC5 cites
     `.claude/settings.json`, both named in order to FORBID them, and the check cannot tell a
     prohibition from a write target. The dispatch message reported `ready:true`, which is the
     `--count-markers` figure (syntax), not `--assess` (semantics). Not a refusal ground: it is
     the known false-positive class the order tells me to report, and it is now measured at
     three instances rather than one. §6.
  2. The order's `governance_sha` is `6cc713f`; the dispatch named `8990ea1`. Both are
     ancestors of my HEAD and the Keel contract blob is identical at both
     (`500c6c5171074c2573f55810f93dc82a5e81508b`), so nothing turns on it. Noted, not resolved.

Missing requirements:
  None that block. `.claude/settings.json` is required for the outcome to become automatic and
  is categorically outside my surface — that is the order's design, not an omission, and it is
  why this return is PARTIAL.

Refusal conditions:
  None exercised. The order carries the generation marker, every mandatory field is present,
  authorities are all at their standing defaults, and the surface is a valid grant.

Verdict: ACCEPT (with contradiction 1 carried forward as a live finding, not a resolved one)
```

---

## 2. Preflight findings

| Checked | Result |
|---|---|
| Worktree `C:/Fusion247PKA-wo-valid`, branch `build-020/wo-readiness-validator`, HEAD `8990ea1`, clean at start | ✅ as declared; sole writer, no foreign commit observed |
| Governance head `8990ea1` and order's `6cc713f` both ancestors of HEAD | ✅ Keel contract blob identical at both |
| Every `file_surface` path exists and is inside "Where Keel writes" / the `Deliverables/**` carve-out | ✅ 6/6 |
| **Order's evidence command `node --test tools/wo/`** | ❌ **MODULE_NOT_FOUND — does not run here.** Substituted, §3 |
| Baseline suites before any edit | ✅ 97 executed, 97 pass, 0 fail |
| `private_surface: none` agrees with every declared path | ✅ no `C:/.fusion247/` path anywhere |
| Decision vocabulary established from source, not from the order | ✅ `allow` · `ask` · `deny`, §4 |
| **The order's own readiness under `--assess`** | ❌ **NOT READY** — contradiction 1, §6 |

---

## 3. The evidence command defect, and what replaced it

```
$ node --test tools/wo/
# Error: Cannot find module 'C:\Fusion247PKA-wo-valid\tools\wo'
#   code: 'MODULE_NOT_FOUND'
not ok 1 - tools\wo
# tests 1   # pass 0   # fail 1
```

This is SOP-022 §2's first named live defect on Node v22.18.0, reproduced. **The directory form
executes none of the work it claims to prove.** Substituted with the explicit file list, which the
same SOP names as the correct form. No assertion was relaxed and nothing was excluded — the
substitution runs strictly more.

---

## 4. AC1 — the decision vocabulary, established by reading the source

`tools/governor/worktree-guard.mjs`, read-only and unmodified:

```
:63   export const DECISION = { ALLOW: 'allow', DENY: 'deny', DEFER: 'defer', ASK: 'ask' };
:65   export const PUSH_ASK_REASON = 'Warwick approval required for push to main.';
:895  const HOOK_DECISION = { [DECISION.ALLOW]: 'allow', [DECISION.ASK]: 'ask', [DECISION.DENY]: 'deny' };
```

So the emitted `permissionDecision` vocabulary is **`allow` · `ask` · `deny`**, `DEFER` maps to
nothing and emits nothing, and **`ask` is the value that reaches Warwick** — that guard uses it
deliberately for a push to `main`.

**What changed in `dispatch-guard.mjs`:**

- `DECISION` is now frozen and contains **only** `DENY` and `DEFER`. No `ASK`. No `ALLOW`.
- `PERMITTED_HOOK_DECISIONS = Object.freeze(['deny'])` — the closed emission set.
- `HOOK_DECISION = Object.freeze({ [DECISION.DENY]: 'deny' })` — the emission map.
- `toHookOutput` resolves through the frozen map **and then** checks membership of the frozen
  permitted set. Two barriers, and the fail direction of both is **silence**: an unpermitted value
  costs Larry a missed refusal, never costs Warwick a click.
- `PROMPTING_HOOK_DECISION = 'ask'` is declared **so the test can pin it**, and the test asserts
  the constant is referenced exactly once — its own declaration — so it is unreachable by any
  emission path.

### The enumeration — every decision path, counted, not sampled

Seven decision-producing returns exist in the module. All seven are enumerated **statically** and
the count is pinned in the test file, so an eighth cannot be added without the suite going red:

```
$ grep -nE "decision: DECISION\." tools/wo/dispatch-guard.mjs
233:    return { decision: DECISION.DEFER, ... }   # tool is not the dispatch tool
243:        decision: DECISION.DENY,               # carried order is NOT READY
250:      decision: DECISION.DEFER,                # carried order(s) READY
259:      decision: DECISION.DENY,                 # Work-Order-shaped, no generated order
266:  return { decision: DECISION.DEFER, ... }     # not Work-Order-shaped at all
289:    return { decision: DECISION.DEFER, ... }   # hook input unreadable
302:    return { decision: DECISION.DEFER, ... }   # internal throw — fails open
```

**PATHS ENUMERATED: 7. PERMITTED EMISSION SET: `['deny']`. PATHS THAT CAN EMIT `ask`: 0.**

Each of the seven is then **exercised** through the real hook entry point (one scenario per path,
count asserted equal to the pinned 7), and `toHookOutput` is attacked directly with forged
decisions — `'ask'`, `'allow'`, `'ASK'`, `'Deny'`, `''`, `null`, `undefined`, `0`, `'defer'`, plus
the prototype keys `toString`, `constructor`, `__proto__`, `hasOwnProperty`. Every one emits
nothing; the one permitted emission still works.

### Exercised on real `PreToolUse` payloads over stdin, as the host sends them

```
==== A — dispatch naming THIS order (WO-4F-08b)
   permissionDecision: deny
   | ⛔ DISPATCH REFUSED — the Work Order this dispatch carries is NOT READY.
   | NOT READY — Deliverables/2026-08-09-WO-4F-08b-guard-diagnostic-never-prompts.md (WO-2026-08-09-06)
   |   ✗ ac-path-not-granted: acceptance criteria name 2 repository path(s) that file_surface does NOT
   |     grant: services/cockpit/db.mjs, .claude/settings.json — either (a) grant them in file_surface,
   |     or (b) move a read-only reference to "## Inputs supplied", or (c) if the AC names the path in
   |     order to FORBID it, state that under "## Explicitly out of scope" and drop the path

==== B — dispatch naming a malformed-document_impact order
   permissionDecision: deny
   | NOT READY — Deliverables/2026-08-09-WO-B15-R1-terra-prose-rulebook.md (WO-2026-08-09-03)
   |   ✗ malformed-field: mandatory envelope field(s) MALFORMED — present but the wrong shape:
   |     document_impact (expected list, found scalar) — … a list with prose glued after it parses as
   |     a scalar and every reader downstream silently sees nothing

==== C — dispatch naming a READY order            (no output — DEFER, dispatch proceeds untouched)
==== D — free-form Work-Order-shaped dispatch     permissionDecision: deny
   | ⛔ DISPATCH REFUSED — this dispatch is Work-Order-shaped but carries no GENERATED Work Order.
   | Envelope fields seen in the prompt: private_surface, credential_scope, live_authority
==== E — Veritas assurance dispatch               (no output — DEFER, dispatch proceeds untouched)
==== F — Pax research dispatch                    (no output — DEFER, dispatch proceeds untouched)

PROMPTS PUT IN FRONT OF WARWICK ACROSS ALL 6 DISPATCHES: 0
```

---

## 5. AC2 — refusal is diagnostic, and ABSENT ≠ EMPTY ≠ MALFORMED

**Three labels, because the three fixes differ.** Write the field · fill the field · reshape the
value. Merging them is what sends the reader hunting.

```
mandatory envelope field(s) — ABSENT (no such key in the envelope): private_surface;
                              EMPTY (key present, no value): veritas_gate

mandatory envelope field(s) MALFORMED — present but the wrong shape:
  document_impact (expected list, found scalar) — the canonical template
  (Team Knowledge/Templates/work-order.md) declares the shape; a list with prose glued after it
  parses as a scalar and every reader downstream silently sees nothing
```

**The malformed check is the new one, and it is the one Warwick's example needed.** A key that is
present *and* non-empty is invisible to `missing-mandatory-field` — which is exactly why the
`document_impact` defect got through. Expected shapes are **read out of the canonical template's own
YAML block**, never restated in code; a barren root returns `not-checked`, never a pass.

Four shapes are distinguished, and the fourth exists because "expected list, found scalar" would
have misdescribed the real case and pointed at the wrong correction:

| Found | Real example |
|---|---|
| `scalar` | `document_impact: services/asdair/skill/README.md (owner: keel) · Deliverables/x.md (owner: larry)` |
| `list-with-trailing-text` | `document_impact: [] — no active document is affected; this is test-harness repair…` |
| `mapping` / `mapping-with-trailing-text` | `worker_contract:` / `capability_evidence:` block shapes |
| `empty` | reported by `missing-mandatory-field` instead, never twice |

**An unauthored `AUTHOR REQUIRED` slot is reported once, as `blank-markers`, never a second time as
malformed** — proven by test. Reporting one defect under two names is the opaque noise this order
forbids.

**Every rejection cause names its specific offender — enumerated, not sampled.** The cause list is
closed and pinned in the test file; a new cause cannot ship without a diagnostic case, because the
pinned list goes red:

| Cause | The offender it names, asserted by test |
|---|---|
| `not-generated` | the missing `GENERATED by tools/wo/envelope.mjs` marker |
| `blank-markers` | the `AUTHOR REQUIRED` / `UNRESOLVED` count |
| `missing-mandatory-field` | each field, labelled ABSENT or EMPTY |
| `malformed-field` | each field, with expected shape and found shape |
| `no-writable-surface` | `file_surface` / `machine_surface` |
| `basis-surface-not-granted` | every ungranted surface path |
| `ac-path-not-granted` | every ungranted path, **plus three named corrections** |
| `no-acceptance-criteria` | the `## Acceptance criteria` section |
| `missing-runbook-path` | `runbook_path` |

The `ac-path-not-granted` message gained a third correction — *"if the AC names the path in order to
FORBID it, state that under `## Explicitly out of scope` and drop the path from the criterion"* —
because the two-option message pointed the reader at a fix that does not apply to this check's only
false-positive class. Message change only; the path heuristic was deliberately **not** touched (§6).

---

## 6. AC3 — the corpus, measured, with the false positives reported and not engineered away

**Corpus definition, stated so it is reproducible** (the predecessor's was not committed, so its
figure of 40 could not be reproduced exactly and I did not pretend otherwise): every tracked `.md`
file carrying `work_order_id:` in frontmatter, **union** every tracked `.md` whose filename contains
`WO-`. **63 orders.**

```
BEFORE (validator at 8990ea1)   CORPUS 63  ·  READY 19  ·  NOT READY 44
AFTER  (this change)            CORPUS 63  ·  READY 16  ·  NOT READY 47

failure distribution (after):
  39  not-generated              (pre-generator hand-authored — true positives, SOP-022 class A)
  30  missing-mandatory-field
  24  no-writable-surface
  24  no-acceptance-criteria
   7  malformed-field            ← new
   5  ac-path-not-granted
   5  blank-markers
   2  basis-surface-not-granted
```

**Three orders flipped READY → NOT READY. All three are TRUE POSITIVES of the exact defect this
order was written about, and I opened each to confirm rather than inferring it:**

| Order | `document_impact` as written | Parses as |
|---|---|---|
| `Deliverables/2026-08-09-WO-B15-R1-terra-prose-rulebook.md:38` | `services/asdair/skill/README.md (owner: keel, in surface) · Deliverables/…` | string |
| `Deliverables/2026-08-09-WO-B15-INT1-integrated-head-green.md:38` | `[] — no active document is affected; this is test-harness repair…` | string |
| `Deliverables/proofline/WO-2026-08-06-19-fusiondevbot-send-path.md:45` | `>-` folded block containing `[{path: …}] — §17.2 records…` | string |

The other four `malformed-field` hits are `blocking_dependencies: none` on pre-generator
hand-authored orders that were already NOT READY on several other grounds; they change no verdict.
The generator emits `blocking_dependencies: []`, so this cannot fire on the live route.

**NEW FALSE POSITIVES INTRODUCED BY THIS CHANGE: 0.**

### The measured false positive the order asked about — and it is now three, not one

`WO-2026-08-07-24` AC3 cites `services/cockpit/db.mjs` as a module the process must **not** load.
**It is still a false positive. It is not fixed, deliberately.**

And the order that commissioned this work has the same defect twice:
`WO-2026-08-09-06` AC3 cites `services/cockpit/db.mjs` (quoting the case) and AC5 cites
`.claude/settings.json` (naming it as categorically out of bounds). **The guard, live, would DENY
the dispatch of the order authorising it** — executed, §4 case A. `ac-path-not-granted` fires on 5
of 63 orders; on inspection every one of those 5 names a path it is prohibiting or citing, not
writing.

**Why I did not "fix" it.** The only mechanical narrowing available is a negation-keyword list
("outside your surface", "must not", "never", "read-only") applied to the AC line. That is a fuzzy
rule guarding a security-shaped boundary: it would silently exclude a genuine write target the
moment an AC said *"do not break `services/x.mjs`"*, converting a visible false deny into an
invisible false allow. Warwick ruled the known holes do not block activation and told me not to
gold-plate them, so I did the cheap half only: **the refusal now names the correction that actually
applies to this class** (option (c) above), which is one edit away from a green re-assess.

**Larry's decision, not mine, and I recommend option 1:**

1. **Amend the three affected orders** — move the prohibited path out of the AC into
   `## Explicitly out of scope`. One edit each, no code change, and it makes the orders read better.
2. Leave them; the guard denies those three dispatches until amended.
3. Narrow the check with a keyword rule — **not recommended**, for the reason above.

---

## 7. AC4 — mutation, both directions, on disk, restored in a `finally`

Six mutants applied to the real source files, sources restored in a `finally` and proven
byte-identical by SHA-256. Both directions the order demanded are present: **make a path emit the
prompting value** (M1, M2) and **make a refusal drop its field names** (M3, M4, M6).

```
=== BASELINE (unmutated) ===
    tools/wo/envelope.test.mjs        exit=0  # tests 90 | # pass 90 | # fail 0
    tools/wo/dispatch-guard.test.mjs  exit=0  # tests 26 | # pass 26 | # fail 0

=== M1 — dispatch-guard.mjs: a decision path made to PROMPT WARWICK (both barriers removed) ===
    tools/wo/dispatch-guard.test.mjs  exit=1  # tests 26 | # pass 16 | # fail 10
        AC1 — EVERY decision-producing path is enumerated, and none can emit the prompting value
        AC1 — every reachable path EXERCISED through the real hook entry point emits deny or nothing
        AC1 — the emission function cannot be COERCED into prompting, whatever it is handed
        MUT-D6 a decision path made to PROMPT WARWICK — both barriers removed
        (+6 more)

=== M2 — dispatch-guard.mjs: ONE barrier removed (emission map redirected to `ask`) ===
    tools/wo/dispatch-guard.test.mjs  exit=1  # tests 26 | # pass 13 | # fail 13
        AC1 — every reachable path EXERCISED through the real hook entry point emits deny or nothing
        the guard emits ONLY on deny — a permitted dispatch produces no output at all
        (+11 more)

=== M3 — dispatch-guard.mjs: the refusal message stripped of its diagnostic ===
    tools/wo/dispatch-guard.test.mjs  exit=1  # tests 26 | # pass 22 | # fail 4
        MUT-D7 the refusal message stripped of its diagnostic — an opaque dead end
        a denied dispatch names the ABSENT and MALFORMED fields, never a bare "not ready"

=== M4 — envelope.mjs: the absent-field name dropped from the refusal ===
    tools/wo/envelope.test.mjs        exit=1  # tests 90 | # pass 87 | # fail 3
        EVERY rejection cause names its specific offender — enumerated, not sampled
        ABSENT, EMPTY and MALFORMED are three DISTINCT labels, because the fixes differ
        MUT-19 absent and malformed merged into one opaque label
    tools/wo/dispatch-guard.test.mjs  exit=1  # tests 26 | # pass 25 | # fail 1

=== M5 — envelope.mjs: the malformed-shape check disabled ===
    tools/wo/envelope.test.mjs        exit=1  # tests 90 | # pass 85 | # fail 5
    tools/wo/dispatch-guard.test.mjs  exit=1  # tests 26 | # pass 25 | # fail 1

=== M6 — envelope.mjs: the malformed message drops expected/found ===
    tools/wo/envelope.test.mjs        exit=1  # tests 90 | # pass 86 | # fail 4
    tools/wo/dispatch-guard.test.mjs  exit=1  # tests 26 | # pass 25 | # fail 1

RESTORE dispatch-guard.mjs  sha256 IDENTICAL  9e0a169b6ddbd7ca1a5d0131cfeade7fa6932deb12630a59d1d842761c25ed52
RESTORE envelope.mjs        sha256 IDENTICAL  578a2bcc0435b73719084a9f495c4371013ee0cdb5b06522b85a333a641b4c8e

=== RESTORED ===
    tools/wo/envelope.test.mjs        exit=0  # tests 90 | # pass 90 | # fail 0
    tools/wo/dispatch-guard.test.mjs  exit=0  # tests 26 | # pass 26 | # fail 0
```

**M2 is the one worth reading twice.** With the emission map alone redirected to `ask`, the guard
emits **nothing** — the permitted-set check swallows it. Defence in depth executed rather than
asserted, and it is the fail direction stated in the module header: breaking this control costs a
refusal, never a prompt.

**In-suite mutants:** 9 pre-existing (MUT-15…18, MUT-D1…D5, targets updated where this change moved
the line) plus 5 new (MUT-D6, MUT-D6b, MUT-D7, MUT-19, MUT-20, MUT-21). Each asserts both that the
mutant genuinely stops refusing **and** that the invariant goes red against it.

**Suites (final, explicit file list):**

```
$ node --test tools/wo/envelope.test.mjs tools/wo/dispatch-guard.test.mjs
# tests 116   # pass 116   # fail 0        (97 at branch point; 19 added)
```

**Hermetic (V4-7):** re-run inside a clean `git archive` export with **no `.git` present** →
**116/116, exit 0.** Executed subtest counts are read from the runner's own output and are non-zero;
a suite reporting zero would be a failure, not a pass.

---

## 8. AC5 — the registration entry, stated and NOT applied

`.claude/settings.json` is categorically outside my surface and I did not open it for writing.
**Paste-ready, into the existing `hooks.PreToolUse` array:**

```json
{ "matcher": "Task",
  "hooks": [{ "type": "command",
              "command": "node C:/Fusion247PKA/tools/wo/dispatch-guard.mjs --root C:/Fusion247PKA" }] }
```

> ### ⛔ HOOKS LOAD ONCE AT HOST START. COMMITTING IS NOT ACTIVATING.
>
> An entry present in a settings file has **no effect** until the host restarts. No claim that this
> control is live may rest on the presence of that JSON — only on a dispatch that was actually
> refused in a real session.

**THE HONEST CEILING, as the order requires it stated:** *this order cannot make the control
automatic.* Registration is Larry's and the restart is Warwick's. Measured against root `CLAUDE.md`
§"Nothing may live only in Larry's head": the real production event does **not** yet invoke it, and
a fresh session gets **no** benefit without being reminded. **Two of six conditions fail. This is
capability, not automation, and CAPA items 1–7 remain advisory — which today means they do
nothing.** Larry records that he issued three dispatches this session that this guard would deny;
I did not verify that count and it is his, not mine.

**The acceptance test, when it is registered and the host has restarted:** dispatch a worker with a
deliberately unready order and observe the refusal in the real session. Not a manual run of
`dispatch-guard.mjs`. Not a green suite. The real event.

---

## 9. AC6 — no new mechanism

No registry, store, tracker, counter, service or control plane. **No new file was created.** No new
runtime dependency; `node:` builtins only. The whole change is 682 lines across five existing files,
**424 of them tests**:

```
$ git diff --stat 8990ea1
 tools/wo/README.md               |  19 ++-
 tools/wo/dispatch-guard.mjs      |  63 +++++++++-
 tools/wo/dispatch-guard.test.mjs | 247 +++++++++++++++++++++++++++++++++++++-
 tools/wo/envelope.mjs            | 128 +++++++++++++++++++-
 tools/wo/envelope.test.mjs       | 242 ++++++++++++++++++++++++++++++++++++++
 5 files changed, 682 insertions(+), 17 deletions(-)
```

Production code changed: 63 lines in the guard (a frozen vocabulary and a two-barrier emission
check) and 128 in the generator (shape inference read from the template, plus one new check and
three clearer messages).

---

## 10. Acceptance criteria

| AC | Met | Evidence |
|---|---|---|
| **AC1** — no path can prompt a human; count stated | ✅ | §4. **7 paths enumerated**, count pinned in the test; permitted set `['deny']`; 7/7 exercised through the real entry point; emission function attacked with 13 forged decisions; vocabulary established by reading `worktree-guard.mjs`; 0 prompts across 6 real payloads |
| **AC2** — every refusal names its fields; ABSENT vs MALFORMED distinguished | ✅ | §5. Closed, pinned cause list; all 9 causes proven to name their offender; three distinct labels; the measured `document_impact` case caught in all three of its real shapes |
| **AC3** — no legitimate order refused on a cheaply-avoidable technicality; FP reported | ✅ | §6. 63-order corpus before/after; **0 new false positives**; 3 flips, all true positives; the `db.mjs` case reported as **still a false positive**, now measured at 3 instances including this order; not gold-plated, not hidden |
| **AC4** — mutation-proved both directions, non-zero executed count | ✅ | §7. 6 on-disk mutants all RED; sources restored byte-identical; 116 executed, 116 pass |
| **AC5** — registration snippet stated, NOT applied | ✅ | §8. `.claude/settings.json` untouched; hooks-load-once stated plainly |
| **AC6** — no new mechanism | ✅ | §9. No new file, no new dependency, no registry/store/tracker/service |

---

## 11. Files touched — reconciled against `file_surface`

```
tools/wo/dispatch-guard.mjs        (modified)
tools/wo/dispatch-guard.test.mjs   (modified)
tools/wo/envelope.mjs              (modified)
tools/wo/envelope.test.mjs         (modified)
tools/wo/README.md                 (modified)
Deliverables/2026-08-09-return-4F-item8b-diagnostic-never-prompts.md   (this file)
```

**Paths outside `file_surface`: 0.** `.claude/settings.json`, `tools/governor/worktree-guard.mjs`
and everything on the BUILD-015 / B15-3 path were read-only or untouched. `main` not touched, no
push, no PR, no merge. The proof harnesses for the corpus sweep and the on-disk mutation live in the
session scratchpad **outside the repository** and are deliberately not committed — they are
evidence-gathering, not deliverables.

**Secret scan, surface-scoped:**

```
$ bash scripts/secret-scan.sh --surface tools/wo/dispatch-guard.mjs tools/wo/dispatch-guard.test.mjs \
      tools/wo/envelope.mjs tools/wo/envelope.test.mjs tools/wo/README.md
secret-scan: CHECKED 26 detection class(es) …
secret-scan: SCANNED 5 file(s) of the named surface, 0 secret value(s) found.
exit=0
```

**Coverage:** the five code/doc paths, in full. It did **not** examine this return document, which
was written after the scan, and it does not detect the content-shaped class its own banner
enumerates.

---

## 12. Two fixture defects found and corrected — stated, because they touched test files

Both suites' "correctly authorised order" fixtures authored **every** bare slot as a scalar,
including `blocking_dependencies`, `tags` and `document_impact`. The new malformed check found them:
**the fixtures were producing malformed orders**, so "a READY order passes" was a proof about a
broken order. Corrected to author those three as `[]`, with the list of list-shaped keys pinned in
each test file so it cannot drift back silently.

**No assertion was deleted, relaxed, skipped or widened** to make anything go green. The change makes
the fixture represent what it always claimed to represent.

---

## 13. Not verified / known limitations

1. **That the control fires in production. It does not.** §8. Registration and restart are
   outstanding and are not mine. This is the single most important gap and it is structural.
2. **`allow` being out of bounds is my inference**, not Warwick's words. If he intends the guard to
   auto-allow a ready dispatch, that is a one-line change and a different decision.
3. **The false-positive class is unchanged**, deliberately. §6. Five of 63 orders trip
   `ac-path-not-granted`, including this one, and all five name paths they cite or prohibit rather
   than write. Only the message improved.
4. **The known holes the predecessor named are untouched**, per the order: an AC naming its target
   as a bare filename or partial path is invisible to the path check; a free-form dispatch using
   none of the envelope vocabulary is not Work-Order-shaped and passes. **Semantic correctness of an
   outcome, a contradiction between two acceptance criteria, and a wrong `governance_head` are all
   outside what any of this examines. The worker read-back remains the reality gate.**
5. **The fail-open direction.** An internal error DEFERS. While the guard is broken it is also
   silent. Chosen, not overlooked — and now doubly so, since the prompt barrier also fails to
   silence rather than to a prompt.
6. **The shape check is heuristic over text, not a YAML parse.** A mandatory field written as a
   multi-line flow collection would be reported `list-with-trailing-text`. No such order exists in
   the 63-order corpus; if the generator ever emits one, this is where it shows up.
7. **The corpus figure is 63, not the predecessor's 40.** The earlier definition was not committed
   and I could not reproduce it. Mine is stated in §6 and is reproducible.
8. **Independent review: none.** Builder self-test evidence only.

---

## 14. Findings for the record

| # | Finding | Severity | Owner |
|---|---|---|---|
| R1 | **The order commissioning this work is NOT READY under its own gate** — AC3 and AC5 each name a path they are forbidding. Once registered, the guard DENIES this dispatch. Executed proof, §4 case A. | **HIGH** — it is the false-positive class made live | Larry |
| R2 | **Registration + host restart outstanding.** Item 8 is NOT closed and CAPA items 1–7 remain advisory. | **HIGH** | Larry / Warwick |
| R3 | **Three banked orders carry a malformed `document_impact`** and were previously reported READY: `WO-B15-R1`, `WO-B15-INT1`, `WO-2026-08-06-19`. Every downstream reader of that field on those orders silently saw nothing. Not fixed — out of surface, and they are banked. | **MEDIUM** | Larry |
| R4 | `WO-2026-08-07-24` AC3 (`services/cockpit/db.mjs` as a prohibition) is **still a false positive**, as reported by the predecessor. Now one of three instances of the same class. | LOW | Larry |
| R5 | The order's required-evidence command `node --test tools/wo/` does not run on this machine's Node. Substituted with the explicit file list (SOP-022 §2). Worth fixing in the next order's evidence block. | LOW | Larry |
| R6 | Both test suites' fixtures were producing malformed orders. Corrected here, §12. | INFO | — |
| R7 | The order's `governance_sha` (`6cc713f`) and the dispatch's governance head (`8990ea1`) differ. Both ancestors of HEAD, Keel contract blob identical at both, so nothing turned on it. | INFO | — |

---

**Builder self-test evidence — NOT independent review.** No acceptance, no merge-readiness, no
completion and no operational claim is made here. `main` untouched; no push, no PR, no merge.
