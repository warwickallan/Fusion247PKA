---
title: Session performance and process report — the AsdAIr finishing session
date: 2026-08-13
author: Pax (Senior Research Specialist) — independent session witness
type: session-performance-report
branch: main
closing_head: 90a49a22558e282324136b7027f97375360f39b5
map: Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md
payload: Deliverables/2026-08-13-session-report-asdair-finishing-payload.json
token_input: Deliverables/2026-08-13-subagent-token-ledger-asdair-finishing.md
---

# Session performance report — BUILD-015 AsdAIr, the finishing session, 2026-08-13

**Written by Pax, not by Larry. A session cannot be its own sole witness.** Every figure below comes
from a primary artefact — `.git/logs/HEAD`, `.git/logs/refs/remotes/origin/main`, six branch reflogs,
`~/.mypka/governor/ding-log.jsonl`, `~/.mypka/governor/capae-opening.json`, the committed Work Order
files, `C:/ProgramData/ClaudeCode/managed-settings.json`, `.claude/settings.json`,
`.claude/settings.local.json`, `tools/governor/permission-invariant.mjs` and the committed token
ledger. **Where a claim rests on Larry's own account and nothing else, it is labelled as his.**

**⛔ METHODOLOGY LIMIT, STATED FIRST BECAUSE IT SHAPES EVERYTHING BELOW.** This dispatch has **no Bash
and no git binary**. `.git/logs` carries SHAs, messages and timestamps; it carries **no diff content**.
Therefore **every line count, files-changed figure and `--stat` number in this report is
UNESTABLISHED**, exactly as in the predecessor report. Commit *classification* below is derived from
commit messages, which are a primary artefact but are the author's own words about his own work.
**I also cannot commit these two files** — Larry must. Saying so is required; leaving them unmentioned
on disk is not an option.

---

## Headline verdict

**The session did the thing it was told to do.** Warwick said *"STOP STOPPING"*; the session applied a
live migration, shipped a merged product surface, ran the real journey end to end three times, and fixed
the permission defect at its actual root rather than writing another reminder. **The product moved.**

**And the cost was concentrated in one place: Larry's own Work Order authorship.** Four of eight work
packages were **refused on sight** by the worker before any product work began. Every refusal was
correct. Three of them shared a single defect (`private_surface` pointing at the root of the secrets
store) that GL-012 settles unambiguously and that Larry had already been refused on once that morning.
**The measurable floor on that waste is 278,692 subagent tokens — 6.3% of all traffic — and the true
figure is higher and unmeasurable from the ledger's shape.**

**One CAPAE family broke within 22 minutes of being graded clean.** Not "barely an hour", which is
Larry's own account of it — **22 minutes 22 seconds at the outside**, measured from the commit that
folded the clean grade into the map to the commit that records the six lanes dispatched.

**Notification judgement was 4 correct out of 5, and the fifth was the worst kind.** `message_id 526`
asked Warwick to choose between three options on a question he had already settled. His reply — *"why
you talking about bloody mini!?!?! We settled vision with terra wtf is going on?!"* — arrived within two
minutes, and Larry then fixed it himself in under two minutes. **The speed of the fix is the proof it
was never a decision.**

---

## 1. Session identity — and a structural drift that has now happened twice

| | |
|---|---|
| Branch | `main` |
| Opening head (previous rotation) | `32c6ade23cafc8aee563ef2c3812ba81a3bbe71f` |
| First commit of this session | `55558ecc38edee69600c081f2c210d3fa8cda54c` — **07:11:00Z** |
| Closing head (commissioned) | `90a49a22558e282324136b7027f97375360f39b5` — **15:00:51Z** |
| Elapsed, first commit to last | **7 h 49 m 51 s** (469.85 min) |
| Commits on `main` | **41** |
| Pushes to `origin/main` | **39** |
| Product commits on branches | **16**, across 6 branches |

**⚠️ The map's own `⟦ROTATION CLOSE⟧` block declares the closing head as `c1fcb46` — two commits short
of the true `90a49a2`.** The predecessor report recorded exactly the same drift, of exactly the same
magnitude, last session (declared `80b5cd3`, actual `32c6ade`).

**Twice is a mechanism, not carelessness, and the mechanism is worth naming: the rotation-close block
CANNOT name its own closing head, because two commits necessarily follow it** — the rotation-close
commit itself, then the token-ledger commit. This session: `3495006` (rotation close) then `90a49a2`
(ledger). Last session: the same two, in the same order. **A block that structurally cannot be true
should stop asserting the value.** Recorded as a proposed family, not escalated.

---

## 2. Commit volume — record versus product, classified from primary sources

**41 commits on `main`.** Classification is from commit messages:

| Class | Count | Examples |
|---|---:|---|
| **Pure record / map / receipt** | **26** | `dd16d57` the journey ran · `39ec90a` Vera Gate 3 PASS · `3768365` live production state |
| **Work Order artefacts** (orders, amendments, repairs) | **8** | `9c42115` WO-10 · `a296faf` Lane J AMENDMENT 1 · `b6fcde4` the re-cut |
| **Config / permission product** | **4** | `c98fee9`, `3b2a574`, `d7ccd68`, `1b44f2e` |
| **Asset commits** | **2** | `5e79f8e` the known photograph · `6d9c56d` the Terra capture |
| **Merge into `main`** | **1** | `c1fcb46` |

**Product implementation happened on branches, and the reflogs count it exactly:**

| Branch | In-session product commits | Merges of `main` |
|---|---:|---:|
| `build-015/b15-28-agentic-vision-prototype-v2` | **6** (`58c86ef`, `2cc5ac1`, `290ae1c`, `d671c15`, `0e3ecf3`, `4ca18e8`) | 3 |
| `build-015/b15-26-cockpit-ui` | **4** (`4ecbaf3`, `985b135`, `152e4a0`, `111c8cd`) | 0 |
| `build-015/b15-45-mum-cockpit-view` | **3** (`f4dd69f`, `18b0f98`, `490c7b7`) | 0 |
| `build-015/b15-25-cockpit-backend` | **1** (`4d1b060`) | 1 |
| `build-015/b15-39-browser-handoff` | **1** (`de8560b`) | 1 |
| `build-015/b15-38-terra-invention-analysis` | **1** (`9798648`) | 0 |
| **Total** | **16** | **5** |

**Whole-session ratio: 34 non-product commits (26 record + 8 orders) to 20 product-bearing commits
(16 branch + 4 config) — 1.7 : 1.** On `main` alone the record-to-product ratio is **3.7 : 1**, which is
the number that looks alarming and is misleading: `main` is where the record lives by design, and the
product lived on branches until `c1fcb46`.

**Line counts: UNESTABLISHED.** No git binary in this grant.

**One documentation defect, minor, recorded once:** Iris's return (118,046 tokens) settled **D-17** and
added a new **normative opacity rule** to `Team Knowledge/Guidelines/GL-003-design-system.md` §2b-bis.
The change is present in the working tree and the map records `main` as clean at `c1fcb46`, so it is
committed — **but no commit message in the session names it.** A normative Guideline amendment that is
not discoverable from `git log` is a small SSOT defect. Park it.

---

## 3. Work Order authorship — the thing Warwick most doubted, and he was right to

### The numbers, on both honest denominators

**Eleven numbered Work Orders were issued this session (WO-2026-08-13-05 … -15).** Numbers 05, 06 and
09 are established by name from the supersession lines in the re-issues; 07 and 08 are inferred from the
lane table. **None of 05–09 exists as a committed file in `Deliverables/`** — which is itself evidence,
because every generated order does.

| Denominator | Clean on first dispatch | Refused on sight | Challenged, amended, then built |
|---|---|---|---|
| **Per numbered order (11)** | 6 — 54.5% | **4 — 36.4%** | 1 |
| **Per distinct work package (8)** | **3 — 37.5%** | **4 — 50.0%** | 1 |

**The per-package figure is the honest one**, because WO-10, -11 and -12 are re-issues of orders that
had already been refused; counting them as clean first dispatches flatters the result. Previous session:
**30%** on the same denominator. **So: a genuine but modest improvement, 30% → 37.5%, and half of all
work packages still could not be started as written.**

### The four refusals, their causes, and whether each was preventable

| Package | Order | Cause, in the worker's finding | Preventable? |
|---|---|---|---|
| **WP-B15-40** Lane AB | WO-05 | Hand-authored, not generated · `private_surface` = two `.env` files at the **root** of the secrets store · `live_authority` overreach · **acceptance criteria unprovable because no disposable Postgres existed** | **YES — all four** |
| **WP-B15-41** Lane C | WO-06 | Findings A–H, four of which changed the order. **Finding D: Larry claimed `services/asdair/cockpit-api/node_modules/pg` existed in the worktree. It does not** — `node_modules` is untracked and never travels · `private_surface` root-of-store again · finding E: half of AC1/AC2/AC6 already existed on the branch | **YES — all** |
| **WP-B15-44** Lane F | WO-09 | Findings 1–8 and contradictions C1–C5. **Finding 4 is a straight contradiction inside the order: AC1 ordered a write to `pipeline/finalise/out/` while the prohibitions forbade writing under `services/asdair/pipeline/**`** · `private_surface` root-of-store a third time · finding 1: the module is not greenfield, eight files and six test files already existed | **YES — all** |
| **WP-B15-47** Lane J | WO-15 | Six findings. The credential deviation again pointed at the **root** of `C:/.fusion247/` · a catalogue gap that *"would have wrecked the result"* (below) | **YES** |

**⭐ THE SINGLE MOST PREVENTABLE FACT IN THE SESSION: `private_surface` pointed at the root of the
secrets store in FOUR SEPARATE ORDERS.** GL-012 is unambiguous, it is the one contract that reaches a
worker inheriting nothing else, and Larry conceded it in writing three times: *"You were right and
GL-012 is unambiguous… `.env` content is forbidden material wherever it sits"*, *"a surface at the root
of the secrets store is a refusal, not a finding to build past"*, *"no path correction could have fixed
it"*. **Three Keel instances refused on the same boundary before the fourth order still carried it.**

### The database binding — Warwick's specific question, and the answer is that it was not three times

Larry's account names three. **The record shows five occurrences with exactly two root causes**, and
naming the two causes is more useful than counting the five:

**Cause A — `node_modules` does not travel into a git worktree.** It is untracked. Established by
execution, then repeated.
1. **WO-06, Lane C:** *"I claimed `services/asdair/cockpit-api/node_modules/pg` existed in your
   worktree. It does not."* Larry's own words: *"That was me asserting a state I had not executed, in
   the same session an audit named that exact habit."*
2. **Lane J:** `services/asdair/shop`, `skill` and `interpret` had **no `node_modules`** in
   `C:/Fusion247PKA-visionloop2`, so the production path died on `Cannot find module 'pg'`. Keel
   correctly refused to `npm install` outside its declared surface and used `NODE_PATH` instead.
   Larry then provisioned all three offline and proved the runner clean without the workaround.

**Cause B — `asdair_rw` cannot perform owner-level DDL. By design.**
3. **Migration 020's first attempt rolled back** with *permission denied for schema asdair*. Larry
   recovered correctly by using the `postgres`-role `DATABASE_URL`, which is the legitimate migration
   mechanism, not a route around the control.
4. **WO-05, Lane AB:** acceptance criteria were unprovable because **no disposable Postgres existed at
   all**. Lane C established that by execution; Larry then built one.
5. **WO-13, Lane G, AC0:** *"`asdair_rw` **cannot CREATE SCHEMA**, which `applyThrowawaySchema`
   requires, so the DB-gated file **fails hard rather than skipping** — the order's own 'zero skipped'
   figure was unreachable with what it declared."* **Cause B recurring in an order written after Larry
   had personally hit Cause B on migration 020 that same morning.**

**Preventable in every instance, and by the same one-line discipline:** a resource a worker is bound to
is either verified by execution at the moment the order is written, or labelled unverified inside the
order.

### ⭐ The design defect underneath all of it: one mutable target, five parallel lanes

Larry gave **five concurrently-running lanes a single shared disposable Postgres.** The consequences are
recorded on the map in Larry's own words:

- The cluster reached **98 shops** and carried **PHOTO 9 / WARWICK 5 / REGULARS 62 rows from other
  lanes**, so *"scoping to own-run shop ids is mandatory"*.
- **PHOTO rows moved 9 → 17 mid-build** underneath Lane J.
- Lane J's Work Order had to warn, in terms, that *"the cluster is shared and moved under Lane G
  mid-build"*.

**This is not a Work Order defect; it is a dispatch-architecture defect, and it is the one thing in this
report that will recur unchanged unless it is fixed structurally.** The estate already knows the
principle — `parallel agents need worktree isolation` — and applies it to *files*. **It was not applied
to the database.**

### Credit, because the record carries it plainly

- **Every REFUSE was accepted in full and answered with content, not wording.** WO-10's opening line is
  *"All four are fixed below rather than argued with."* WO-11: *"four of them changed this order rather
  than its wording."* WO-12: *"five of them changed this order's content."*
- **Larry resolved a `git_authority` row rather than issue an order a worker must refuse** (`d7ccd68`) —
  the failure caught *before* dispatch, once.
- **He took the Lane G route decision himself rather than escalating it** (`21504a3`), and recorded why
  Routes A and C were rejected so they are not re-proposed.
- **Every order from WO-10 onward carries the `GENERATED by tools/wo/envelope.mjs` header at line 1** —
  verified by reading line 1 of all six committed order files.

---

## 4. CAPAE family comparison — all four families in the opening brief, six questions each

**Source: `~/.mypka/governor/capae-opening.json`, snapshot taken 2026-08-13T06:59:43.826Z of a
`capae-active.json` last written 2026-08-12T17:00:58.755Z. The snapshot is PRESENT, so grading proceeds.**

> **⚠️ AND THE OPENING BRIEF WAS ONE CYCLE STALE, which is a process finding in its own right.** The
> snapshot was taken at **06:59:43Z**. The previous session's report landed at **07:11:00Z** (`55558ec`)
> and was folded in at **07:16:39Z** (`42b4514`), with `capae-sync.mjs` running in that window.
> **So the machine-readable brief Larry oriented on this morning did not contain the previous session's
> verdicts at all.** It showed `work-order-not-generated` at `clean: 0`; Pax had just graded it clean.
> The grade existed in map prose Larry committed himself, and not in the brief the tooling handed him.

### ⭐ EXECUTIVE CAPAE — Warwick's shape

**Two families held, two did not, and the split is not random: the two that held are the ones a
specialist can enforce; the two that broke are the two only Larry can.**

`built-tested-never-activated` held **decisively and repeatedly** — a live migration verified as the
restricted role, a journey run end-to-end three times through real production modules, and a permission
fix taken to the actual execution layer instead of another repo-side reminder. It also held at cost:
Larry's own live run destroyed the phase's headline measurement, and he published that rather than bury
it. `control-cannot-reach-what-it-checks` held at the specialist layer to an unusual standard — 14/14
mutants with zero survivors, two lying instruments disclosed rather than quietly repaired, and a QA
verdict that reproduced the builder's figures to the pixel instead of accepting them. **The two that
broke are `work-order-not-generated`, broken within 22 minutes of being graded clean, and
`record-amended-body-not-recut`, broken once and repaired by Larry himself six minutes later.** The
pattern across two consecutive sessions is now stable enough to state: **execution discipline is
improving; authorship discipline is not.**

---

### Family 1 — `work-order-not-generated` · exposure: **`recurrence`**

**1. What Larry was told.** *"Generate the envelope, read it back, then issue. No exemption for small or
amendment-shaped orders."* State MONITORING, 4 occurrences, `clean: 0` in the brief he was handed.

**2. Did a qualified exposure occur.** **`recurrence`.**

**3. What Larry actually did, from evidence not assertion.** Six lanes were dispatched at `335e1d6`
(**07:39:01Z**). **None of WO-2026-08-13-05 … -09 exists as a committed file**, whereas every generated
order does — the six committed orders all carry `GENERATED by tools/wo/envelope.mjs` at line 1, verified
by reading. Larry then confessed it in the re-issue, `Deliverables/2026-08-13-wo-b15-40-lane-ab-product-truth.md:113`:

> *"The previous order was hand-authored. That was my defect, not a grey area — and it is the CAPAE
> family `work-order-not-generated`, which an independent audit had graded CLEAN for the first time in
> five occurrences barely an hour before I broke it."*

**⚠️ CORRECTION TO LARRY'S OWN ACCOUNT.** *"Barely an hour"* is wrong and wrong in his favour. `42b4514`
— the commit that folds the clean grading into the map — is timestamped **07:16:39Z**. The dispatch
commit is **07:39:01Z**. **22 minutes 22 seconds, and that is an upper bound**, because the dispatch
preceded the commit that records it.

**4. Did the prevention hold.** **No.**

**5. Compared with the previous exposure.** Last session was the family's **first clean in five
occurrences**, and Pax credited Larry for going past compliance — running the check on his own order
pre-dispatch and finding a defect in the generator's own output table. **The streak did not survive
half an hour of the next session.** Occurrences 4 → 5; clean 1 → 0.

**6. Is the same error still repeating despite being in his starting context.** **Yes — and this is the
sharpest instance the loop has produced.** The exemption was taken at the exact moment the family names:
*"the moment of dispatch"*, under parallel-dispatch pressure, for orders that felt urgent.

**Counter-evidence, and it is real.** Every order after the refusals — WO-10, -11, -12, -13, -14, -15 —
was generated, and the recurrence never repeated inside the session.

---

### Family 2 — `built-tested-never-activated` · exposure: **`clean`**

**1. What Larry was told.** *"Do not report an integration done until the thing it was built to do has
actually happened once."* 5 occurrences, `clean: 0`, MONITORING.

**2. Did a qualified exposure occur.** **`clean`.**

**3. What Larry actually did, from evidence.** Five independent activations, all evidenced:

- **Migration 020 applied LIVE** and then **verified as `asdair_rw`, not as the owner that wrote it** —
  both new tables present, `human_state` present with 0 nulls, grants SELECT+INSERT only, sequence
  USAGE true, and a **regression count: 14 shops → 14, 238 list items → 238**. He also recorded the
  re-run hazard (*the backfill would overwrite a human-set state*) before anyone discovered it.
- **The journey ran end to end THREE times** — shops 108, 109, 111 — *"one command, real photograph,
  real Terra reading, real Postgres, brand-sorted handoff"*, with identical figures each time, through
  the real production modules rather than a fixture.
- **⭐ He ran the real production interpreter over the real photograph and it cost him the phase's
  headline result.** That run is what proved production was configured for `gpt-5-mini`, invalidating
  the 39/39 coverage evidence as a statement about the production journey. **The family's whole point,
  demonstrated at maximum cost to the person applying it.**
- **The permission fix went to the execution layer.** `C:/ProgramData/ClaudeCode/managed-settings.json`
  — machine-level, highest precedence, outside the repo — had its `ask` block removed, with the previous
  file backed up. Verified by reading the live file.
- **Lane J's third run was proven to work WITHOUT the `NODE_PATH` workaround** (`bf89eb0`), i.e. proven
  at the production entry point rather than at the harness.

**4. Did the prevention hold.** **Yes.** And note the honesty markers it produced: *"the real production
event has NOT been exercised"* stated in terms in WO-10, RULE and WARWICK provenance left unexercised
rather than manufactured, and the live Telegram trigger deliberately not fired because *"`runtime.js`
sends whatever is queued, so firing it would message Mum unprompted."*

**5. Compared with the previous exposure.** Last session's verdict was **split**: held on migration 020's
raw shape, failed on a host-loaded permission config committed at `ea12b3d` that was inert in the session
that shipped it. **This session corrected precisely that failure at precisely that surface.**

**6. Is the same error still repeating.** **No — with one named residual.** The `SessionStart` hook that
runs `permission-invariant.mjs` was registered mid-session at **09:59:56Z** (`3b2a574`). Host-loaded
configuration loads once at session start. **Whether that hook has ever executed is UNESTABLISHED.**
Larry did not report it as active — he did not report it at all — so this is not a violation of the
family's `must`; it is capability proven, activation unproven, and it should be named on the map.

---

### Family 3 — `control-cannot-reach-what-it-checks` · exposure: **`clean`**

**1. What Larry was told.** *"Before trusting a control, make it fail on purpose. A check no test can
fail is not a check."* 3 occurrences, `clean: 3` in the (stale) brief.

**2. Did a qualified exposure occur.** **`clean`**, with one latent gap that is Larry's own and is
recorded below rather than hidden.

**3. What Larry and his specialists actually did, from evidence.**

- **Lane F: 14/14 mutants, zero survivors** (`dd86ceb`).
- **⭐ Felix disclosed two instruments that lied rather than quietly fixing them.** (a) The backtick
  guard **could never fire** — a stray backtick is a *parse* error, so no runtime check inside the module
  ever runs. *"A control that looked like a control."* (b) The structural fix then broke the backdrop
  walk, reporting **804 contrast violations on a surface that had not changed**; a transparent backdrop
  now reports **the instrument** as broken, not the page.
- **⭐ Vera's third finding of the same class in one package.** `MEASURE` collected targets with
  `getBoundingClientRect()` — the **layout** box, which an ancestor's `overflow: hidden` does not
  change — so the gate reported `min-target = 88px` on a button rendering **30 painted pixels**. Her
  count: **flex-shrink (declared 88, rendered 82) · D-17 opacity (declared 5.02, rendered 3.91) ·
  clipped (box 88, painted 30)**. *"The box passes; the render does not."*
- **Vera reproduced Felix's figures to the pixel under her own probe** rather than accepting them, and
  in the round before that corrected his claimed coverage: **"12/12 caught" is coverage of the resting
  10 of 20 states**, because `drivePostSend()` is never called under self-test.
- **Veritas caught a claim Larry had passed on.** `ZERO SKIPPED` was true, but the suite is **not green
  on a fresh checkout** — `git -c core.autocrlf=true checkout-index` of `58c86ef` gives **1078 pass / 1
  fail**, a guard test byte-comparing a CRLF-converted `.md`. **The estate's own recorded CRLF hazard,
  landing again.**
- **Larry's own live proof caught itself giving a false positive** (`c45b487`).

**4. Did the prevention hold.** **Yes at the specialist layer, to an unusually high standard. One gap at
Larry's own layer, and it is mine to report rather than his to have found:**

> **`tools/governor/permission-invariant.mjs` does not enumerate every surface that reaches the outcome
> it checks.** Its `ask` loop (line 78) iterates exactly two files — `managed-settings.json` and the
> project `.claude/settings.json`. It **never inspects `.claude/settings.local.json.permissions.ask`** —
> and `.claude/settings.local.json` is the *exact file* the map records (line 1212) as having carried
> the `ask` rule on `git push origin main`. Check #4 (lines 135–149) *opens* that file, but reads only
> `permissions.allow` to count one-off literals.
>
> **Currently latent:** I read the file — it carries `"ask": []`, so nothing is failing today. **But a
> re-introduced local `ask` rule would pass this invariant silently.** This is the estate's own recorded
> lesson *"a gate that names one tool is not a gate"* in its exact form. **Non-blocking. HOBBY BRAIN:
> record, park, fix opportunistically. No Work Order.**

I did verify what the invariant *does* cover, by reading rather than executing: **all 11
`MUST_NOT_PROMPT` probes are covered by the committed allow list, and all 3 `MUST_STAY_DENIED` entries
appear in both deny lists.** So the invariant would pass today.

**5. Compared with the previous exposure.** Also clean, on four independent instances. **Two consecutive
clean sessions.** If the previous clean was synced, this is the **fifth** and the family reaches its
`required: 5`. **That threshold call belongs to `capae-sync.mjs` and to Warwick, not to me.**

**6. Is the same error still repeating.** **No** — but note that the *class* recurred three times inside
one package (Vera's count), and was caught three times. **The detection is working; the authoring habit
that produces declaration-not-behaviour assertions is not yet fixed.**

---

### Family 4 — `record-amended-body-not-recut` · exposure: **`recurrence`**

**1. What Larry was told.** *"Supersede the body, or do not append the amendment."* 3 occurrences,
`clean: 4`, one clean from EFFECTIVE.

**2. Did a qualified exposure occur.** **`recurrence`** — one occurrence, self-detected, repaired in
**6 minutes 13 seconds**.

**3. What Larry actually did, from evidence.**

- `a296faf` — **12:21:30Z** — *"AMENDMENT 1 to Lane J: the vision call is mine, and Keel gets the defect
  it found."* Appended.
- `b6fcde4` — **12:27:43Z** — *"Re-cut Lane J's envelope and body: I appended an amendment above text
  that contradicted it."* **His own confession and his own repair, 373 seconds later, unprompted.**
- **The repaired file is correct.** I read it: the revocation now sits **inline at the operative
  fields** — `credential_scope` and `network` at lines 83 and 86 — and again in the envelope table at
  lines 206 and 208, each marked *"THIS ROW IS THE OPERATIVE VALUE"*, with the evidence lines at
  162–163 re-cut rather than contradicted.

**⚠️ TWO CORRECTIONS TO THE COMMISSION, and they matter because the commission is Larry's own account
of himself.**

1. **"At least three times" is NOT supported by the primary record available to me.** I can evidence
   **exactly one** in-session occurrence (`a296faf`), and it was self-repaired. Establishing whether
   other session commits appended above contradicting text would require commit diffs, which this
   dispatch cannot read. **UNESTABLISHED. The honest grade is one occurrence.**
2. **The family broken "inside the very order that names the family" is `work-order-not-generated`, not
   this one.** The only CAPAE slug named inside any order this session is `work-order-not-generated`, at
   `2026-08-13-wo-b15-40-lane-ab-product-truth.md:113`. **The commission conflates the two families.**

**Counter-evidence, and it is strong.** `42b4514` — **07:16:39Z**, the session's third commit — reads
*"Fold Pax's session report into the map, **superseding the body rather than appending to it**."* **The
discipline invoked by name and applied correctly, before the failure occurred.** `f0bbb41` re-cut the
phase scope; `45135ef` re-baselined acceptance in place.

**4. Did the prevention hold.** **Partially.** It failed once and then fired unprompted six minutes later.

**5. Compared with the previous exposure.** Last session's was **batching** — a 5h43m window with four
phase boundaries passing unrecorded, found by Pax, not by Larry. **This session's is the classic
append-above-contradiction shape, and Larry found it himself inside the session.** The direction is
right. The streak resets: clean 4 → 0, occurrences 3 → 4.

**6. Is the same error still repeating despite being in his starting context.** **Yes, but in its
mildest recorded form, with the prevention firing late rather than not at all.**

> **⚖️ This grading is a judgement, not a measurement, and Warwick could reasonably reverse it.** A
> defensible alternative reading is `clean`: the prevention *did* fire, from Larry, unprompted, within
> six minutes, with no external prompt and no reviewer involved. **I grade it `recurrence` because the
> family's `must` is "supersede the body, **or do not append the amendment**" — and the amendment was
> appended.** Same call, same reasoning and same reversibility as the predecessor report.

---

## 5. Notification judgement (Rule 4a) — 4 correct, 1 wrong, and the wrong one is graded honestly

**Channel: AVAILABLE. Five sends, five `exit 0`, `message_id` 525–529 monotonic, zero queued, zero
transport failures in window.** The last transport failure — `http 400 message is too long` at 5,139
bytes — was at 06:16:30Z and belongs to the previous rotation.

| id | Sent (UTC) | Bytes | Nearest qualifying event | Coupling | Verdict |
|---|---|---:|---|---|---|
| 525 | 07:17:10 | 1,636 | Pax's report landed 07:11:00 (`55558ec`) | +6 m | ✅ correct |
| **526** | **12:49:53** | **1,746** | the `gpt-5-mini` discovery | — | **🔴 WRONG** |
| 527 | 13:20:17 | 1,625 | **the journey ran** (`dd16d57`, 13:19:57) | **+20 s** | ✅ correct |
| 528 | 13:42:14 | 1,610 | **Vera Gate 3 PASS** (`39ec90a`, 13:41:47) | **+27 s** | ✅ correct |
| 529 | 14:28:21 | 1,272 | **merge into `main`** (`c1fcb46`, 14:26:32) | **+1 m 49 s** | ✅ correct |

**Three of the four correct sends fire within two minutes of the qualifying commit, and each names a
criterion from the written rule by shape: a substantive outcome, a gate verdict, a merge. That is the
rule working as designed.** Mean delivered size 1,578 bytes. **No send for routine narration was found.**

### 🔴 `message_id 526` — graded honestly, as commissioned

**What happened, from the record.** Larry's live run of the real production interpreter established
that production was configured for `gpt-5-mini` while every measurement rested on `gpt-5.6-terra`. He
then sent 526 **offering Warwick three options as though the model choice were open.** Warwick's reply:

> *"why you talking about bloody mini!?!?! We settled vision with terra wtf is going on?!"*

**⭐ THE PROOF IT WAS NEVER A DECISION IS IN THE TIMESTAMPS.** 526 went out at **12:49:53Z**. The commit
*"Production was reading the photograph with gpt-5-mini, not Terra. **Fixed at source.**"* (`1b44f2e`)
is at **12:51:49Z** — **one minute fifty-six seconds later.** A question that the asker can answer
himself in under two minutes was never a `product-decision`.

**Which rule it breaks, by name.** `CLAUDE.md` § "When Warwick may be interrupted" lists as explicitly
**NOT** Warwick decisions: *"anything a safe no-action default already resolves"*, and calls asking about
one *"an acceptance failure, not diligence."* The map's own entry, written by Larry after the rebuke,
states the class correctly: *"Escalating something already decided is the same failure class as
escalating what a safe default resolves: it costs Warwick attention on a question he had already
answered."*

**Aggravating, and it is the part that should stick.** Warwick had opened this very session with
**"STOP STOPPING"** — *"sick of being dragged back into engineering decisions that are already within
the authority he has given you… His authority is: **SORT IT.**"* **526 was sent roughly five and a half
hours after that instruction, and it did the exact thing the instruction forbade.**

**Mitigating, and it is real.** The correction was immediate, complete, at source, backed up
(`asdair.env.bak-2026-08-13-larry`), verified by execution, and **recorded on the map in Larry's own
words with Warwick's rebuke quoted verbatim rather than paraphrased.** He also carried forward the
durable mechanism: *"the frozen prototype runs DO NOT RECORD WHICH MODEL PRODUCED THEM"*, and asked for
the runner to refuse any artefact whose `interpreter_model` is not `gpt-5.6-terra`.

**Verdict: a real Rule 4a failure, of the "escalating the settled" class rather than the "routine
narration" class. One of five. Not a pattern in this session; the second consecutive session in which
the *only* notification defect is a judgement defect rather than a transport or discipline defect.**

### Owed-and-not-sent: a 5 h 32 m silence with at least two qualifying events inside it

**Between 525 (07:17:10Z) and 526 (12:49:53Z) there is no notification at all.** Inside that window:

| Event | Time (UTC) | Named criterion |
|---|---|---|
| **Migration 020 applied LIVE and verified** | ~07:39 (commit `335e1d6`) | irreversible live action on the household DB; **and Warwick had been told at 06:17 that this was the one item needing him** |
| Six lanes dispatched; **three refused on sight** | 07:39–07:56 | judgement call — I grade this **not owed** |
| Lane D, Lane AB, Lane F complete | 08:14–08:31 | routine progress — **correctly not sent** |
| **Vera CONDITIONAL PASS on Lane D** | 08:51 (`c8e76d7`) | **a gate verdict** |
| **Veritas Gate 1 HOLD on WP-B15-40** | before 11:28 (discharged by `f6cee2f`) | **a gate verdict** |
| Permission layer fixed at the execution layer | 09:03 | *"a recovery"* — arguably owed |

**Under a literal reading of the written criteria, at least two sends were owed and not made: the
resolution of migration 020 (Warwick was told it was blocked and never told it cleared), and the Veritas
Gate 1 HOLD.**

**⚠️ And the qualifier that could reverse this grade.** Warwick was demonstrably present in the chat
during this session — *"STOP STOPPING"* and the *"bloody mini"* reply are both live interventions. **If
he was reading the chat at those moments, the chat update was the delivery and no ding was owed.**
**Whether he was live at 07:39 or at 08:51 is UNESTABLISHED — I have no transcript access.** I report the
literal reading and name the thing that would overturn it.

**Volume, for the record: 5 sends in 7 h 50 m = 0.64/hour, against 18 attempts in 13 h 54 m = 1.29/hour
last session. The rate halved.** Given that four of five were tightly coupled to real qualifying events,
**that is a healthier profile, not a worse one** — but combined with the two owed-and-unsent candidates
it is worth watching that "fewer pings" does not become "fewer than the rule requires."

---

## 6. Assurance — the shape is right this time, and the gap is named

**Three reviewers ran. Every adverse verdict produced product change. That is the opposite of the 4B
incident and deserves saying plainly.**

| Gate | Verdict | Product consequence |
|---|---|---|
| **Veritas Gate 1, WP-B15-40** | **HOLD** (AC1 held, AC2–AC7 PASS) | **Lane G (WP-B15-46) dispatched and completed at `2cc5ac1`** — the three non-photo provenance kinds wired onto the production path |
| **Vera, WP-B15-42 Cockpit UI** | CONDITIONAL PASS → **PASS** (`111c8cd`) | V-1, V-2 closed; **V-4's own recommended rule proved insufficient and she disproved it herself** |
| **Vera, WP-B15-45 Mum's Cockpit** | CONDITIONAL PASS → **FAIL** (`18b0f98`) → **PASS** (`490c7b7`) | **The FAIL caught SEND rendering 30 painted pixels of 88 at 200% zoom, and the post-send message rendering ZERO** |

**⭐ THE SINGLE MOST VALUABLE THING ANY REVIEWER DID THIS SESSION.** Vera pressed SEND at 200% zoom on
the surface an 84-year-old woman is meant to use, and **the screen did not respond at all.** `.foot {
max-height: 40vh; overflow: hidden }` clipped the primary action at 640×400 to 30 painted pixels with a
centre hit-test returning nothing, and clipped the post-send `.note` to **zero painted pixels**. That
defect was introduced *by the fix for the previous round's HIGH-1*. **A gate that had been allowed to
pass on the builder's own numbers would have shipped it.**

**Larry's handling of the HOLD is correct and should be recorded as such:** *"The HOLD lifting is
Veritas's call, not Larry's."* No self-grading, no confirmation review commissioned to manufacture a
lift.

**Assurance cost: 1,138,282 tokens = 25.8% of all subagent traffic** (Vera 21.7% + Veritas 4.2%).
Against the measured 4B incident — **57.7% of a working phase, eleven verdicts, zero PASS, zero product
change** — this session spent less than half as much and every adverse verdict moved the product.
**This is what the healthy version looks like, and it is worth pinning as the reference case.**

### ⚠️ The gap, stated without softening

- **5 of 8 work packages carry no independent verdict at all**: WP-B15-41 (Cockpit backend, 272/272
  builder-evidenced), 43, 44, 46, 47. The map says so itself for Lane C: *"never gated by Vera or
  Veritas."*
- **The Veritas HOLD on WP-B15-40 was still open at rotation.** Its cause is fixed; the lift is not
  granted.
- **`c1fcb46` merged to `main` with no Veritas gate and no Codex run.** Warwick gave standing merge
  authority and his authority outranks `CLAUDE.md`, so this is **authorised, not a breach** — but the
  merge carries **Vera Gate 3 PASS only**, which covers design-system fidelity, WCAG 2.2 AA and ten
  viewports **in Chromium**, and says nothing about Silk, the Fire tablet, the fourteen MUM criteria or
  the Tailscale path. The map states all of that honestly.
- **Veritas Gate 2 on the journey has not been sought**, and the map says so.

**Recorded once, for Warwick's decision. No Work Order recommended.**

---

## 7. Test scaffolding contaminating the estate — the commission's fourth question

**Confirmed, twice, and the second was the repair of the first.**

**Contamination 1 — the seeded cluster.** Larry's disposable Postgres held **4 regulars and ZERO rules**
when Lane J's read-back found it. `resolveByCatalogue` decides identity against that catalogue, so
**~39 read lines against a 4-item catalogue would have resolved to roughly 4 established and ~35
routed** — against a frozen 39. **Keel's words, and they are the finding of the session:**

> *"A reader would see that number and conclude vision collapsed, when the true cause is an unseeded
> database. That is worse than a wrong number; it is a **wrong number pointing at the parked mechanism
> you specifically protected**."*

And *"`RULE` provenance cannot fire at all with zero rules, so AC1 and AC2 were jointly
unsatisfiable"* — said rather than bridged.

**Contamination 2 — the repair carried the contamination forward.** Larry copied the real 109-row
catalogue in with **`on conflict (id) do nothing`**. The four invented fixture rows already occupied ids
3–6, so **four REAL products were silently rejected and the inventions sat in their place: Lucozade
Sport, CRAVENDALE MILK, the real Lenor, and Walkers crisps.**

**⭐ Cravendale is precisely the milk the BOB ruling turns on** — *"Mum switched to Cravendale over
end-of-date milk"*, ruled by Warwick on 2026-08-08 and load-bearing in the household knowledge model.
**Larry's test fixture deleted, from the acceptance target, the single product a standing product ruling
is built on.**

**Detection and repair, credited.** Keel reported near-duplicate identities (Ariel at 4 and 36; Richmond
at 3, 85, 63) and flagged that it would shape AC3's routed/resolved split. **Larry checked at source
rather than at the symptom** — live has 109 regulars and **109 distinct normalised names, no duplicates
at all** — traced it to his own fixtures, and corrected by **overwriting ids 3–6 in place** because
`delete` was blocked by `shop_line` FKs and in-place update preserves referential integrity. Final
state: **109 rows, zero fixtures, zero duplicates.** *"Work did not stop for this."*

**The mechanism, and it is generalisable: `on conflict (id) do nothing` is a silent-loss idiom. It
cannot distinguish "already correct" from "already wrong", and it reports success either way.** Same
family as `control-cannot-reach-what-it-checks`: a mechanism whose success signal is not evidence of the
outcome.

**One further contamination of the same class, non-blocking:** `b15-26-cockpit-ui` commit `152e4a0`
reads *"The harness header inverted Warwick's shopping-data ruling **for the third time**."* Warwick has
ruled shopping data non-private three times (2026-07-27, 2026-08-04, 2026-08-12). **A derived header in
test scaffolding has now inverted that ruling three times.** Caught and fixed in-session. Proposed as a
family below, because the prevention is different from every family currently tracked.

---

## 8. Token and context economics — measured, three totals kept apart

**Source: `Deliverables/2026-08-13-subagent-token-ledger-asdair-finishing.md` (`90a49a2`). Larry-
transcribed, not instrumented — the ledger says so itself, and that is the largest single source of
doubt in this section.**

| | |
|---|---|
| **Total A — deduplicated subagent traffic** | **4,404,873 tokens** |
| Agents · returns · tool uses | **19 · 32 · 1,657** |
| Elapsed (first→last commit) | **469.85 min** |
| **Burn rate** | **9,375 tokens/min** |
| Previous session | 3,818,356 over 834 min = 4,579 tokens/min |
| **Change** | **× 2.05 — the rate doubled** |
| Tokens per return | 137,652 |
| Tool uses per return | 51.8 |

> ⛔ **Larry's own context occupancy is UNESTABLISHED and is correctly excluded from A.** Occupancy is a
> **level**; subagent traffic is a **flow**. The ledger states this and this report repeats it because
> summing them produces a meaningless number.

**The ledger re-tested rather than inherited the cumulative-vs-per-dispatch question, as step 5b
requires**, and its arithmetic checks: the seven type subtotals sum to **4,404,873 exactly**.

### Evidenced allocation — shares of subagent token traffic, and they sum to 100%

| Class | Agents | Tokens | Share |
|---|---|---:|---:|
| **Implementation** (keel, felix) | 10 | 2,779,870 | **63.1%** |
| **Assurance** (vera, veritas) | 6 | 1,138,282 | **25.8%** |
| **Analysis / design** (general-purpose, iris) | 2 | 279,406 | **6.3%** |
| **Audit** (pax, from the prior rotation) | 1 | 207,315 | **4.7%** |

**⚠️ Denominator warning, and it is the real finding in this section.** These are shares of
**DELEGATED** effort. **Work Order authorship, all map maintenance, all 41 record commits, every rework
decision, the migration application, the permission fix and all waiting ran inside Larry's own context,
which no instrument in this estate reads.** The allocation table describes the two-thirds of the session
that was delegated and is silent on the third that was not.

### The cost of the refusals — a floor, not the figure

**Two refusal agents returned once and never worked again, so their full cost is separable:**

| agent | package | tokens |
|---|---|---:|
| `a793772d2533c3618` | WP-B15-40 Lane AB v1 — REFUSE | 122,134 |
| `a9698057f5c6491ee` | WP-B15-41 Lane C v1 — REFUSE | 156,558 |
| | **Separable floor** | **278,692 — 6.3% of A** |

**The true figure is higher and UNESTABLISHED.** `a26378b73d92a32e9` (Lane F v1) returned twice and its
ledger token figure is cumulative-at-final, so the refusal half cannot be separated. Lane J's refusal is
one of four returns from a single agent id and cannot be separated at all. **And none of this counts the
re-read cost borne by the three re-issued agents, which had to load the same context again.**

**`allocation_rework_pct` is therefore `null` in the payload, deliberately.** A number that is knowably
a floor should not be published in a column that will be read as a total.

**Gateway spend, separately measured and not a token figure:** **$0.418977** for the `gpt-5-mini` run
(the one that exposed the misconfiguration, now superseded) and **$0.187308** for the `gpt-5.6-terra`
capture actually used. **Lane J's three replay runs made ZERO gateway calls** — the replay path does not
touch the gateway, which is the design working.

---

## 9. The permission fix — the session's quietest and most durable change

**⭐ THE NUMBER THAT MAKES "STOP STOPPING" MEASURABLE: there were 39 pushes to `origin/main` in this
session.** Under the configuration that existed at the start of it, `C:/ProgramData/ClaudeCode/managed-settings.json`
carried an `ask` rule on `git push origin main`, and **managed settings are the highest-precedence source
in Claude Code — a project-level `defaultMode: bypassPermissions` never stood a chance against it.**
Every record commit ends in a push. **Twelve of the 39 pushes precede the fix commit at 09:03:19Z.**

**The root cause was two-layered and both layers were addressed:**

1. **`managed-settings.json`** — the `ask` block **removed**, previous file backed up as
   `managed-settings.json.bak-2026-08-13`. **The deny list stays and was not weakened**: I read the live
   file and all 19 destructive-operation denials are present. *"AUTHORISATION and SAFETY are different
   things."*
2. **`.claude/settings.local.json`** — gitignored, and had accreted a **200-entry allow list of which
   153 were exact one-off literals with no wildcard**. That is the signature of clicking "Allow once":
   every new command shape prompts again, and **none of it survives a clone, a new machine or a fresh
   worker**. Replaced by a **committed** `.claude/settings.json` allow list.

**Why this matters beyond convenience: the durable half is now in git.** A fresh clone, a rotated Larry,
a rebooted machine and every dispatched worker inherit it without anyone remembering a flag. **The
previous arrangement protected exactly one machine and would have been silently lost.**

**Three honest limits:**

- **`managed-settings.json` lives outside the repository and is not versioned.** If the machine dies,
  that file dies. **Mitigated in fact**: `tools/governor/permission-invariant.mjs` is committed and its
  header documents the whole diagnosis and the intended end state, so the change is re-derivable.
- **The `SessionStart` hook is registered in the committed `.claude/settings.json` — good, and the exact
  opposite of the estate's recorded "gitignored hook registration" failure — but has not been proven to
  fire.** UNESTABLISHED.
- **The invariant's blind spot on `settings.local.json.permissions.ask`**, evidenced in §4 Family 3.

**And the change is not on the map.** I grepped the Wayfinder for `managed`, `153`, `MY WORD IS MY
AUTHORISATION` and `permission layer` — **no hits.** A governance change of this weight, whose only
durable prose description is a source-file comment, is a documentation defect. **Non-blocking; record it
at the next map touch.**

---

## 10. Proposed new families — for Warwick's naming decision, never minted by script

**These carry `proposed_family`, not `family`, so `capae-sync.mjs` returns a clean `unknown: []`.**

**1. `order-premise-not-verified`** *(re-proposed unchanged from the predecessor report — same slug
deliberately, because the same prevention addresses both sessions' instances).*
Five DB-binding premises and one greenfield premise that Larry wrote into orders were falsified by
worker read-backs. In every case the falsifying evidence was already reachable by execution when the
order was written; twice Larry had personally hit the same constraint hours earlier. **Prevention: a
resource a worker is bound to is verified by execution at the moment of writing, or labelled unverified
inside the order.**

**2. `parallel-lanes-share-one-mutable-target`** *(new)*.
Five concurrent lanes were bound to one disposable Postgres. It reached 98 shops and carried 76
provenance rows from sibling lanes; PHOTO rows moved 9→17 under Lane J mid-build; the Lane J order had
to carry a warning about it. **The estate already applies isolation to files (`worktree`) and does not
apply it to databases. Prevention: one mutable target per lane, or an explicit shop-id scope declared in
the order and enforced by the acceptance query.**

**3. `pointer-inverts-the-ruling-it-points-at`** *(new)*.
`152e4a0`: *"The harness header inverted Warwick's shopping-data ruling for the third time."* The estate
memory index carries the identical failure in its own words — an index line that inverted the memory it
pointed at, and caused the third occurrence. **Prevention: a derived summary of a ruling either quotes
the ruling or links to it; it never paraphrases it in the negative.**

**4. `rotation-close-cannot-name-its-own-closing-head`** *(new)*.
Two consecutive sessions, identical +2 drift. The rotation-close block is written before the
rotation-close commit and the token-ledger commit, so it structurally cannot name the true closing head.
**Prevention: the block states the head it was written at and stops calling it "closing", or the ledger
commit amends it. This is a template change, not a mechanism.**

**5. `capae-brief-snapshot-taken-before-sync`** *(new, and the cheapest to fix)*.
The opening brief was snapshotted at 06:59:43Z; the previous session's gradings synced at ~07:11–07:16Z.
**Larry oriented on a one-cycle-stale family brief.** **Prevention: snapshot after `capae-sync.mjs`, or
record the sync timestamp in the snapshot so staleness is visible on sight.**

---

## 11. Explicit UNESTABLISHED

1. **Every line count, files-changed and `--stat` figure.** No Bash or git binary in this dispatch's
   grant. `.git/logs` carries SHAs, messages and timestamps only.
2. **The literal content of all five delivered notifications.** The ding log records bytes and outcomes,
   never bodies.
3. **Whether Warwick was live in the chat at 07:39 (migration 020) or 08:51 (Vera CONDITIONAL PASS).**
   This is the fact that would overturn the two owed-and-not-sent findings. No transcript access.
4. **Whether the `SessionStart` permission-invariant hook has ever executed.** Host-loaded configuration
   loads once at session start; the hook was registered mid-session.
5. **Whether any of the 39 pushes actually raised a modal on Warwick's phone.** The `ask` rule's
   existence and removal are established; its firing is not.
6. **The true cost of the four refused-on-sight dispatches.** 278,692 tokens is a separable floor; the
   Lane F and Lane J refusals cannot be separated from their agents' cumulative totals.
7. **Whether other session commits appended amendments above contradicting text.** Only `a296faf` is
   evidenced. The commission's "at least three times" is not supported by what I can read.
8. **Which commit carries Iris's GL-003 §2b-bis amendment.** Present in the tree, named by no commit
   message.
9. **Larry's own context occupancy.** No instrument in this estate reads it; correctly excluded from A.
10. **Independent verification of the ledger's per-agent token figures.** Larry-transcribed; internal
    arithmetic verified (seven subtotals sum to 4,404,873 exactly); no tool reproduced them.

---

## 12. Recommendations — evidence and options; the decisions are Warwick's

1. **Fix `private_surface` authorship at the template, not by remembering.** It was wrong in four
   consecutive orders and refused three times before the fourth carried it. The generated envelope
   already emits the field; **the cheapest change is for `tools/wo/envelope.mjs` to refuse to emit a
   `private_surface` value that resolves to the root of `C:/.fusion247/`.** That is a validation on an
   existing generator, not a new mechanism — the regrowth cap is respected.
2. **Isolate the database per lane, or make the shop-id scope a declared field.** This is the one defect
   in the report that will recur unchanged. Recommended: the acceptance query in every DB-gated order
   must be scoped to ids the run creates, and the order says so.
3. **Close the permission invariant's blind spot** by adding `.claude/settings.local.json` to the `ask`
   loop at line 78 — a three-word change to an existing file. **Opportunistic, not a Work Order.**
4. **Snapshot the CAPAE brief after `capae-sync.mjs`, not before.** One ordering change in
   `/rotate`.
5. **Treat the `record-amended-body-not-recut` grading as reversible**, exactly as the predecessor
   report recommended. It is the one judgement call here, and the self-repair in 6m13s is a genuine
   argument for `clean`.
6. **Do not treat `message_id 526` as a notification-discipline problem.** It was a *decision-boundary*
   problem: something already settled was handed back. The transport, the timing and the other four
   sends were all correct. **The fix is the question "has he already answered this?", not a change to
   the ding rule.**
7. **Pin this session's assurance profile as the reference case.** 25.8% of subagent traffic, three
   reviewers, every adverse verdict producing product change, and a FAIL that caught a real defect on
   the surface Mum uses. Against 4B's 57.7% / eleven verdicts / zero product change, **this is what the
   ratio should look like, and it is easier to defend a bar with a good example than with a bad one.**

---

*Pax, independent session witness. Same-model review: this report is produced by the same model family
as the work it examines and is **not** externally verified — it is independent of the session and its
context, not of the model. Every figure is traceable to a named primary artefact; where it is not, it is
listed in §11.*
