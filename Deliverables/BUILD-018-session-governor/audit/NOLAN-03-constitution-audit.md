---
name: nolan-03-constitution-audit
type: audit
build: BUILD-018
auditor: Nolan (independent audit — fresh instance, NOT the author)
status: complete
created: 2026-08-01
audited_commit: f582611 (branch build-018/wp2-constitution, worktree C:/Fusion247PKA-wo-02)
audited_base: 3ec562a
recheck_commit: 1077a8b (same branch and worktree)
private_surface: none
verdict: pass 1 — NOT YET (merge-blocking defects at clause 4) · pass 2 (re-check of 1077a8b) — MERGEABLE, subject to one one-line fix and one precondition on the parallel work
---

# BUILD-018 WP-2 — Independent audit of the operating constitution

Read-only. Every verdict names the file+line or the command output that settles it.
I am a different runtime from the author. Where the author got something wrong I say so.

---

## 0. Read-back

**(a) OUTCOME.** Larry needs one independently-derived answer to two questions about
commit `f582611`: does the finished constitution durably carry all eight of Warwick's
clauses in a way that actually *binds*, and did placing it weaken anything that
previously bound. Plus rulings on four named items: the `AGENTS.md`-wins precedence
hole, the "a PR was opened" addition, the public-repo path exposure, and whether
clause 5's one-home claim is true today.

**(b) PLAN.** Diff `3ec562a..f582611`, then read all three changed files whole and in
surrounding context. Then — the part that decides most of it — check every factual
claim the constitution makes *about code* against the code: does `footer.mjs` exist,
is `managed[]` exported, does a live-verification mode exist, does an execution
controller exist, do the seven code names exist anywhere, are clause 5's two duplicate
copies real. Then check the constitution's clause 4 list against the *binding recorded
decision* it derives from (AD-26) and against the shipped `escalation-gate.mjs` enum,
because a closed list is only as good as its agreement with the code that consumes it.

**(c) WHAT THE ORDER FAILED TO SETTLE.** It gives me Warwick's eight clauses in
summary but does not enumerate the seven legitimate interruptions, so it could not tell
me whether the seven in the file are the right seven. I resolved that against
`02-MAP.md` AD-26 — Warwick's own binding wording, recorded 2026-07-31 — and that is
where the sharpest finding came from. The order also treats the forward-reference
question as being about `footer.mjs`; it is about five things, not one.

**(d) WHAT LOOKED WRONG.** Nothing material in the order. One framing I pushed back
on: the order asks whether the constitution "has been placed in the file that loses
ties," which presumes the hole is hypothetical. It is not entirely — root `AGENTS.md`
*points at* `Team/Larry - Orchestrator/AGENTS.md` §"Operating doctrine", and §9a of
that file now contradicts the constitution's closed list. The disagreement is already
live, reached through the winning file's own pointer.

No HOLD. Proceeded in the same run.

---

## 1. Clause-by-clause verdict

| # | Clause | Verdict |
|---|---|---|
| 1 | Startup and recovery — nine steps + banner | **PRESENT AND BINDS** (one defect) |
| 2 | The named build team + Larry must not silently replace it | **PRESENT AND BINDS** |
| 3 | Autonomous continuation — the non-boundaries | **PRESENT AND BINDS** |
| 4 | Legitimate human interruptions — the seven | **PRESENT BUT WEAK** — three defects, two merge-blocking |
| 5 | Git ownership | **PRESENT AND BINDS** as a rule; its "one home" claim is **false today** |
| 6 | Governor advice — live telemetry, visible, grounded-or-`UNSET` | **PRESENT BUT WEAK** — grammar target does not exist |
| 7 | Mechanical enforcement — coherent, reinstallable, hooks-enforce-never-carry | **PRESENT BUT WEAK** — four false present-tense claims about code |
| 8 | Wayfinder separation | **PRESENT AND BINDS** — the cleanest clause in the set |

### Clause 1 — PRESENT AND BINDS, with one defect

`CLAUDE.md:46-72`. Nine steps, in order, each a yes/no question. Banner spec is a
five-row table with the footer as the final line. It is in the one surface proven
auto-loaded (criterion 1 pass — I can confirm from inside this run that `CLAUDE.md` is
injected into a subagent system prompt verbatim, exactly as NOLAN-01 §4 established).
It disclaims dependence on hooks and on the branch surviving, in its own opening
sentence. Criterion 2 (decidable) passes: every step names an artefact and a
comparison.

**The defect is step 3.** `CLAUDE.md:52`:

> *"locate the `Deliverables/<build>/programme-state.json` that matches this repository,
> worktree and branch. **Exactly one match is the active build; zero or more than one
> means no active build is established**"*

That is a naive file-count scan, and `tools/governor/build-registry.mjs:48-57` — shipped
code in this same build — identifies precisely that algorithm as a known trap:

```
// `programme-state.json` is a tracked file on a branch, so every checkout holding
// that branch's content has a copy, and `main` gains one after the build merges.
// A naive scan therefore reports one build three times and every resolve becomes
// AMBIGUOUS on the real estate — the same trap that disarmed the guard during
// T-11. Copies are collapsed by programme id ...
```

WP-2 merging to `main` is itself the event that creates the extra copy. So the clause
is written to fail on the estate the moment this build lands.

*Smallest fix (one clause, no new artefact):* change "Exactly one match" to "Exactly one
**programme** — multiple copies of the same programme id are one build, not several."
Do not point the clause at `build-registry.mjs`; that store is machine-local and would
fail criterion 1.

### Clause 2 — PRESENT AND BINDS

Two halves, both landed.

*The named team*: `Team/agent-index.md:26-41`, §"The build team". All five roles match
Warwick's wording one-for-one — Larry orchestrates and integrates, Nolan independently
audits, Silas owns architecture/durable-state/integrity, Keel implements through the
Work Order process, Pax researches, everything else routed per the table above.

*The prohibition*: `Team/Larry - Orchestrator/AGENTS.md:314`, and it is genuinely
decidable, which is the hard part and the author got it right:

> *"before the second tool call of any implementation stretch, name in-channel the
> specialist and the Work Order carrying the work — or state that the work is retained,
> with the reason."*

That is the exact shape NOLAN-01 criterion 2 demanded, and the closing line —
*"The defect is the silence, not the retention"* — correctly reconciles it with root
`AGENTS.md` §3's delegation-first-not-delegation-only iron rule rather than
contradicting it. No breach of the root file.

*One reachability note, not a defect.* Clauses 2b and 3 live in
`Team/Larry - Orchestrator/AGENTS.md`, which the host does **not** auto-load; they are
reached only via `CLAUDE.md` startup step 2. That is one hop weaker than clauses 1, 4,
5, 6, 7 and 8. It is the placement the accepted design (E-1) chose and I agree with the
reasoning — the missing half of §9b belongs beside §9b — but it is worth Larry knowing
that the two clauses about *not stopping* and *not absorbing* are the two a hurried
Larry can skip by skipping step 2.

### Clause 3 — PRESENT AND BINDS

`Team/Larry - Orchestrator/AGENTS.md:295-316`, §9e. All seven of Warwick's events are
present (worker returned · read-back arrived · ticket closed or ticket boundary reached ·
review came back · tests ran/passed/failed · commit made · push landed), plus "a PR was
opened" — ruled on in §3 below. The composition paragraph at line 312 is the strongest
writing in the whole change:

> *"Doubt means 'one of the seven may apply and I cannot tell.' It never means
> 'something finished and I am unsure whether to keep going.'"*

That is a real distinction, decidable at the moment it binds, and it removes the
ambiguity without touching §9b's tiebreak.

### Clause 4 — PRESENT BUT WEAK. Three defects; (a) and (b) are merge-blocking.

`CLAUDE.md:74-90`. The list is present, closed, code-named, and paired with an explicit
NOT-Warwick-decisions line that correctly encodes the standing "never escalate what a
safe default resolves" rule. The *shape* is right. The *contents* are wrong in three
ways, and each one is invisible unless you check it against something outside the file.

**(a) `unsafe-state` contradicts shipped, frozen, tested code. MERGE-BLOCKING.**

`CLAUDE.md:82` declares the code name `unsafe-state`, and `CLAUDE.md:88` asserts *"The
code names above are the vocabulary the Governor's execution controller consumes; they
are defined here and derived from here."*

`tools/governor/escalation-gate.mjs:170` and `:287` already froze a different literal:

```js
export const ESCAPE_HATCH_REASONS = Object.freeze(['unsafe-repository-state']);
const ESCAPE_HATCH_MARKER = /\[AD-26:unsafe-repository-state\]/i;
```

That marker is a **regex applied to Larry's own text**. A Larry obeying the constitution
writes `unsafe-state`; it does not match, it is not in the frozen enum, and the escape
hatch does not clear. The gate is not activated today, so this is not yet live — which
is exactly why it will be missed. 60 tests and an adversarial probe pin
`unsafe-repository-state`; the constitution renames it in prose and claims derivation
authority over it.

*Smallest fix:* use `unsafe-repository-state` in `CLAUDE.md:82`. One token. The
constitution should match the literal that is already frozen, not the other way round —
changing the code means rewriting a frozen enum, a regex, and 60 tests to no benefit.

**(b) A binding Warwick decision was silently dropped, and the count hides it.
MERGE-BLOCKING.**

`02-MAP.md:171` records AD-26 — *"settled 2026-07-31 by Warwick, binding"* — and its
escalate-only list is:

> a genuine product decision · **a material scope change** · an unavoidable permission ·
> spend · an irreversible live action · an unsafe repository state · the final merge
> decision

The constitution's seven are: `product-decision` · `permission` · `spend` ·
`irreversible-live-action` · `unsafe-state` · **`rotation-required`** · `merge-decision`.

**`material scope change` is gone. `rotation-required` took its slot.** The count stays
at seven, so nothing looks changed. I traced the origin: this is not the author's error —
`decisions/D-governor-constitution-and-continuation.md:132` introduced these seven and
asserted *"These are constitution clause 4's seven legitimate interruptions, one-for-one"*
without ever reconciling them against AD-26. The author reproduced the accepted design
faithfully. The design is what is wrong, and it propagated.

This matters more than a bookkeeping slip. `rotation-required` is a *governor* concern
that the footer already surfaces continuously. `material scope change` is the single
member of AD-26's list that protects Warwick from Larry autonomously growing the work —
and the file that dropped it simultaneously declares itself **closed**, so under
`CLAUDE.md:76` a material scope change is now, by the literal text, *not a legitimate
interruption and the turn continues*. That directly reverses a binding ruling.

*Smallest fix:* restore `scope-change` as a member. If Warwick wants exactly seven,
that is his call to make explicitly — it must not be made by omission. Either way this
needs Warwick, because reversing AD-26 is not Larry's to do silently either.

**(c) §9a never got the cross-reference the accepted design specified, so two
authoritative lists now contradict each other with one declaring itself closed.**

`D-governor-constitution-and-continuation.md:760` (E-2, "Verbatim, so Keel does not
paraphrase") requires the pointer at **§9a and §9e**. The diff adds it at §9e
(`AGENTS.md:316`) and adds a different, longer paragraph at §9b (`:259`). **§9a is
untouched.**

§9a (`AGENTS.md:239-242`) still says escalate for: *minting credentials · anything
irreversible or outward-facing · merge-to-main · money and payment gates · consequential
external action · **material risk** · **genuine outcome ambiguity** · **a real collision
between two of the user's own instructions** (name it plainly; never quietly pick one) ·
**domain judgements belonging to whoever owns that domain***.

The four bolded members map to **nothing** in the closed seven. A real collision between
two of Warwick's own instructions is now, read literally, not a legitimate interruption.
That is a doctrine §9a calls out specifically because quietly picking one is the failure.

*Smallest fix:* add E-2's one-line pointer at §9a as the design already required, plus
the half-sentence that reconciles rather than contradicts — that §9a's members are
reasons that *resolve to* one of the codes, and one that resolves to none of them is
itself a `product-decision`. Two lines.

**One further consequence in §9b, which is the specific thing the order told me to hunt.**
§9b's *reflex* survives intact — I checked, and the insert at `:259` is scoped correctly
("governs how to reach the user once you genuinely need something. It does not decide
whether you do"), the notification duty is untouched, and §9e explicitly refuses to
narrow the tiebreak. **The reflex is safe.** But §9b's *enumeration* at `:256` — untouched,
and now contradicted — still reads *"Every handback qualifies: a decision, a 'your call',
a merge or live gate, **a deliverable for review**, **a blocker**."*

"A deliverable for review" is correctly removed by design (that is the fix Warwick
wanted). **"A blocker" is not, and it has no member in the closed seven.** A genuine
inability to proceed that is neither a permission nor spend nor unsafe state — the
"required-but-unavailable = BLOCKED" case the estate already recognises — has, under the
literal text of `CLAUDE.md:76`, no legitimate exit. That is a silent deadlock in the
opposite direction, and it is the failure class the order asked me to weigh as *worse*
than the one §9e fixes.

*Smallest fix, costing no new member:* clarify `unsafe-state`'s gloss (already *"state
that cannot be safely resolved"*) to say explicitly that a genuine inability to proceed
falls here. One clause. It also removes the §9b:256 contradiction.

### Clause 5 — PRESENT AND BINDS; the "one home" claim is FALSE today

`CLAUDE.md:92-98`. The rule itself is excellent and genuinely decidable — *"does this
reply ask Warwick to run a git command, choose a git route, or understand a git concept
in order to answer?"* — and the whether-vs-how split against `merge-decision` is exactly
right.

But `CLAUDE.md:98` asserts *"This rule has exactly one home."* It has three. Both live
duplicates confirmed, verbatim:

`tools/governor/reorient.mjs:454-456`:
```
'GIT LIFECYCLE IS LARRY\'S (AD-20): Warwick never manages branches, worktrees,',
'commits, pushes or PR creation. Do not ask him to run git. Do not ask him to',
'choose the route. Ask him only for decisions that are genuinely his.',
```

`tools/governor/worktree-guard.mjs:385,392`:
```
'RECOVERY — Larry performs this, Warwick does not:',
...
'     must NOT ask Warwick to run git commands. Larry owns the git lifecycle.',
```

**So the claim is aspirational, not true.** Worse than merely untrue: the very next
sentence (`CLAUDE.md:98`) declares any such hard-coded copy *"a defect in that script"* —
so the constitution ships already naming two known, unfixed defects in the estate it
governs. Design E-2 specified the exact replacement pointer text for both. Neither was
applied; both files are outside the author's file surface, so this is a scope gap, not
an author error.

*Not merge-blocking on its own*, provided Larry either (i) lands both pointer
replacements before or alongside merge, or (ii) does not claim clause 5 is satisfied
until they land. Silently merging a false claim about the estate is the thing to avoid.

### Clause 6 — PRESENT BUT WEAK

`CLAUDE.md:100-110`. The obligation binds and the three content rules are decidable and
correct — BLIND on unreadable telemetry with no numbers, `UNSET` rather than a banked
literal (which fixes NOLAN-01 D-N3 at the doctrine level), handback token drawn from the
seven. The rationale sentence is the right one: the footer exists because a terminal
status line is invisible on web and Android.

The weakness is the grammar pointer. `tools/governor/footer.mjs` does not exist —
confirmed not merely absent from this branch but absent from **all** history:
`git log --all --oneline -- tools/governor/footer.mjs` returns nothing. Meanwhile
`statusline-live.mjs:97,105` hand-composes a `⟦GOV⟧` line today, which `CLAUDE.md:110`
declares a defect. Larry has already ruled WP-2 must not merge before `footer.mjs`
lands; that ruling is correct and sufficient.

### Clause 7 — PRESENT BUT WEAK

`CLAUDE.md:112-120`. The load-bearing sentence is present and correct: **"Hooks enforce
this constitution. They never carry it. Every clause above is binding on its own, on any
machine, with no hook installed."** That is the clause the whole design turns on and it
is stated plainly. The honest-limit paragraph at `:120` is the most intellectually
honest thing in the file — it states rather than implies that nothing committed can
force an out-of-repo settings file into effect.

But four present-tense claims in this section are false today. See §5 below; they are
the forward references the order asked me to enumerate. In particular *"installed
together as one coherent set"* is not true of a set whose execution controller does not
exist, and `managed[]` contains no `Stop` spec (`install-hooks.mjs:183-212`).

### Clause 8 — PRESENT AND BINDS

`CLAUDE.md:122-124`. One line, exactly as E-5 recommended, exactly what Warwick asked
for: Wayfinder is distinct from rotation and from continuation, is research-only and
NOT in force, and nothing in the file depends on it. I verified the last part — no other
clause references it. It commits Warwick to nothing and prevents the conflation. Nothing
to fix.

---

## 2. Ruling — the `AGENTS.md`-wins precedence hole

**It needs fixing. It is real, it is cheap, and it is not purely hypothetical.**

The order's framing is that silence is not disagreement, which is correct as far as it
goes: root `AGENTS.md` says nothing about continuation, so today there is no tie to lose.
Two things make that insufficient.

1. **"AGENTS.md wins" is a standing rule and the constitution is a standing document.**
   The tie does not have to exist today; it has to be impossible for someone to create
   accidentally later. Anyone adding a sentence about stopping, escalation or delegation
   to root `AGENTS.md` — a perfectly ordinary act, since that file is declared the
   canonical contract for "all hard rules" — silently defeats the constitution with no
   one noticing. A constitution that can be overridden by an unrelated edit to another
   file is not durable.

2. **A disagreement already exists, reached through the winning file's own pointer.**
   Root `AGENTS.md:121` states that Larry's full operating method *"is distilled in
   `Team/Larry - Orchestrator/AGENTS.md` §'Operating doctrine'"*. §9a of that file is
   part of that doctrine and now contradicts the closed seven (clause 4 defect (c)).
   So the winning file delegates to a file that disagrees with the constitution.

**Smallest fix, and it does not touch root `AGENTS.md`.** One sentence appended to
`CLAUDE.md`'s existing § "Source of truth", scoping the tie-break:

> *Exception, narrow and by name: the constitution sections above — Startup and
> recovery · When Warwick may be interrupted · Git ownership · Governor advice ·
> Mechanical enforcement · Wayfinder — are defined here and are deliberately not
> restated in root `AGENTS.md`. On those subjects this file is the source. Root
> `AGENTS.md` does not contradict them; if it ever appears to, that is a defect to
> raise, not a tie to resolve.*

One sentence, in a file already being edited, no `AGENTS.md` touched, no new document,
no new rule type. Criterion 5 costs nothing.

**Two alternatives I considered and reject.** Moving the constitution into root
`AGENTS.md` — forbidden, and correctly so. Moving it anywhere else — every other
candidate fails criterion 1, because `CLAUDE.md` is the only surface proven auto-loaded.
The constitution is in the right file; the tie-break is what needs the carve-out.

---

## 3. Ruling — "a PR was opened"

**Faithful extension. Keep it.**

Opening a PR is Larry's own act inside a lifecycle clause 5 gives him wholly; it changes
nothing Warwick controls and reverses trivially. The part that *is* Warwick's — the merge
decision — is separately and explicitly protected as `merge-decision`, so the addition
cannot swallow it. It is the same ordinary texture of execution as "a commit was made"
and "a push landed", both of which Warwick did name, and omitting it would leave an
arbitrary gap between pushing and merging where Larry could legitimately stop for no
reason. It would be scope creep only if it reached the merge decision, and it does not.

---

## 4. Ruling — the public-repo path exposure

**Genuinely pre-existing, correctly out of this order's scope, not a merge blocker, and
not something Larry must act on now.** Three findings settle it.

1. **Pre-existing, established by execution.** `git log -S'C:\.fusion247' -- CLAUDE.md`
   returns one commit, `6bf7092` (2026-07-29, "Scanner rebuild, work-order preflight
   doctrine, and specialist contract updates"). The literal count is **2 at `3ec562a`
   and 2 at `3ec562a~1`** — identical. `f582611` neither added nor removed one.

2. **The exposure class is a path *shape*, not a secret.** What is published is
   `C:\.fusion247\**` and `C:\.fusion247\private\<project>\**` — no values, no project
   names, no credentials, no host. Anyone able to read that directory already has
   filesystem access, at which point the path is trivially discoverable. Against the
   estate's stated defect bar (correctness / accidental leak / availability / audit,
   not malicious-handler hardening) this does not clear the bar.

3. **Removing it from `CLAUDE.md` alone would be theatre.** `git grep -l "\.fusion247"`
   returns **122 tracked files**, including `.gitignore`, two `.claude/agents/` shims,
   and build records across BUILD-002/010/015. Two of 122 changes nothing.

**One thing Larry should know, separate from this WP.** Silas's own E-4 table
(`decisions/D-…:798-802`) puts `C:/.fusion247/…` in the **Forbidden** column for
committed instruction files in a public repo. So the estate has now written down a
standard that 122 tracked files violate. That gap is a Larry decision at estate level,
not a WP-2 defect, and I am naming it rather than filing anything — proposing a new
artefact for it would breach criterion 5.

---

## 5. Other forward references — four beyond `footer.mjs`

All same-class as `footer.mjs`: present-tense claims in `CLAUDE.md` about code that does
not exist on this branch. Each verified by execution.

| # | `CLAUDE.md` claim | Reality |
|---|---|---|
| F1 | `:110` "defined once in `tools/governor/footer.mjs`" | Does not exist on **any** branch — `git log --all -- tools/governor/footer.mjs` is empty. *(known to Larry)* |
| F2 | `:118` "the **exported** `managed[]` set in `install-hooks.mjs`" | `install-hooks.mjs:183` is `const managed = [` — **function-local, not exported.** The file's `export` list (lines 34-138) does not include it. Design E-1 said "as exported constants"; that export was never written. |
| F3 | `:120` "the installer's **live-verification mode** distinguishes 'all fired' / 'some did not fire' / 'could not determine'" | No `--verify-live`, `verifyLive` or equivalent anywhere in `tools/governor/**`. Design E-5 promised it; it does not exist. This is NOLAN-01 D-N1's fix, unbuilt. |
| F4 | `:120` "the reorientation brief states the execution controller's status inline" | `grep -i "execution controller" tools/` → **no matches in any file.** `reorient.mjs` reports no controller status. |
| F5 | `:88` "the vocabulary the Governor's **execution controller** consumes"; `:114` "the execution controller … installed together as one coherent set" | **No execution controller exists.** None of the seven code names appears anywhere in `tools/` (`grep -rn "product-decision\|irreversible-live-action\|rotation-required\|merge-decision" tools/ --include=*.mjs` → empty). `managed[]` has **no `Stop` spec** (`install-hooks.mjs:183-212`: one SessionStart, three PreToolUse). |

**What Larry should do with this:** his existing "WP-2 must not merge before `footer.mjs`
lands" ruling is correct but scoped to one of five. The actionable check is whether the
parallel WP's scope covers **F2 through F5 as well** — particularly F5, because clause 7
claiming a coherent installed set that includes a non-existent controller is the same
"written therefore live" error NOLAN-01 §2.4 documented, restated at the constitutional
level. If the parallel work does not cover them, the honest move is to soften those four
sentences to the future tense rather than merge a constitution that misdescribes its own
estate.

---

## 6. Clause 5's one-home claim — true or aspirational?

**Aspirational.** Both duplicates confirmed and quoted in §1 clause 5 above:
`reorient.mjs:454-456` and `worktree-guard.mjs:385,392`. Design E-2 specified the exact
pointer text to replace each. Neither was applied. `CLAUDE.md:98` therefore states as
fact something that is false about the estate at the moment of merge, and its next
sentence classifies both survivors as script defects — so the constitution ships naming
two unfixed defects as if they were fixed.

Nothing in this is the author's fault: `tools/governor/**` sat outside its file surface,
and the author flagged the surviving copies against itself. It is a sequencing gap for
Larry, and it is cheap — two string replacements, both already written out verbatim in
E-2.

---

## 7. Merge verdict

**Not yet.** Three defects must be settled first, all at clause 4, all small:

1. `unsafe-state` → `unsafe-repository-state`, to match the frozen enum and the live
   regex in `escalation-gate.mjs`. **One token. Larry decides.**
2. `material scope change`, dropped from AD-26's binding seven under cover of an
   unchanged count. **Warwick decides** — reversing his own binding ruling is not
   Larry's to do by omission, and it is not mine to do by recommendation.
3. E-2's cross-reference at §9a, plus the half-sentence reconciling §9a's members to
   the codes, so two authoritative lists stop contradicting each other. **Two lines.
   Larry decides.**

Then the pre-merge sequencing already partly ruled: `footer.mjs` (F1) and a decision on
F2-F5, plus the two clause-5 pointer replacements or an honest downgrade of the one-home
sentence.

**What should stand, and I want this on the record because most of this change is good.**
The boot ladder is the right resolution of a genuine three-way conflict and deletes
nothing. §9e is precisely the missing half NOLAN-01 asked for, its decidable test is real
rather than aspirational, and its "doubt means one of the seven may apply" paragraph is
the sharpest sentence in the change. The build-team table lands clause 2 exactly as
Warwick specified. Clause 8 is perfect. Clause 7's honest-limit paragraph states a
weakness instead of implying coverage, which is the behaviour this estate has been trying
to build for two weeks. The defects above are contents defects in one clause, not a
structural problem with the constitution — fix them and this is good to merge.

---

*Nolan — independent audit, 2026-08-01. Read-only: no repository file was modified except
this one, and nothing in `C:/Fusion247PKA-wo-02` was written. No mutating git command was
run. `private_surface: none` — no access to `C:\.fusion247\**` was required or taken; the
exposure ruling in §4 rests only on the two path literals already visible in `CLAUDE.md`
and on file-name-only `git grep -l` output.*

---
---

# PASS 2 — RE-CHECK of commit `1077a8b`

Same read-only posture, same prohibitions. `git diff f582611` first, then the clause-4,
§9a, banner and clause-6 regions read whole. Every verdict below is from execution, not
from the author's report or Larry's summary.

## R1. Are the five genuinely closed?

| # | Finding | Closed? |
|---|---|---|
| 1 | `unsafe-state` → `unsafe-repository-state` | **CLOSED in the constitution — but see N1: the same defect is now live in the `footer.mjs` build spec** |
| 2 | Material scope change restored | **CLOSED, and soundly** |
| 3 | §9a cross-reference | **CLOSED, substance untouched** |
| 4 | Clause 1 step 3 collapses by programme id | **CLOSED, and better than I asked for** |
| 5 | Member 5 gloss + precedence carve-out | **Carve-out CLOSED and stronger than proposed; gloss closed in meaning, see R2** |

**1 — `unsafe-repository-state`.** `CLAUDE.md:82` now carries the literal frozen at
`escalation-gate.mjs:170`. `git grep -n "unsafe-state"` returns **zero hits in `tools/`**
and zero in the three constitution files. Closed at the surface I audited.

**2 — material scope change.** `CLAUDE.md:78`: *"a genuine product decision, **including a
material change to agreed scope**"*. This is the right shape and not a fudge: a material
change to agreed scope **is** a product decision, so the gloss is a clarifying instance of
member 1, not a second idea smuggled in. Decidability survives — *"has the agreed scope
materially changed?"* is answerable yes/no. AD-26 is satisfied and the list stays at seven.

**3 — §9a.** The pointer is at `AGENTS.md:250`, placed after the Never list. I diffed §9a
itself: the Escalate, Decide-personally and Never lines are **byte-identical** to
`f582611`. Substance untouched, as claimed.

**4 — clause 1 step 3.** `CLAUDE.md:52` collapses by programme id first, then matches — and
it goes further than my fix by naming the sting in-line (*"merging your own work is what
creates the extra copies"*) and by distinguishing zero from *"copies that genuinely
disagree"*, which is `build-registry.mjs`'s actual refuse-rather-than-pick behaviour rather
than my cruder "exactly one programme". This is better than what I proposed. Closed.

**5 — the carve-out.** `CLAUDE.md:132` names all six sections; I verified each string
matches a real heading. It is also **stronger than what I proposed**: it extends to *"or
with any specialist contract"*, which closes the route I had flagged as the live half of
the hole (root `AGENTS.md:121` → Larry's §"Operating doctrine" → §9a). Root `AGENTS.md`
untouched, constitution not moved. Closed.

*One residual, low severity:* the carve-out protects the six **`CLAUDE.md`** sections. Clause
2b and clause 3 live in `Team/Larry - Orchestrator/AGENTS.md` §9e, which is not one of the
six, so a future root-`AGENTS.md` sentence contradicting §9e is not covered. Root
`AGENTS.md` §3 already carries the compatible iron rule, so nothing is broken today. Worth
one clause if it is ever cheap; not worth an edit now.

## R2. Does the closed list still bind? — member 1 sound, member 5's *name* is the defect

**Member 1 is not elastic.** Two ideas would mean two independent membership tests. There
is one: a material change to agreed scope is a proper subset of a product decision. Bind
intact.

**Member 5's meaning is not a catch-all either, and I want to be precise about why**, because
the obvious reading is that *"a blocker with no safe way through"* is exactly the kind of
phrase that swallows everything. It does not, and the reason is that it interlocks with
`CLAUDE.md:88`: *"anything a safe no-action default already resolves"* is explicitly NOT a
Warwick decision. So the boundary is decidable — **if a safe default exists, there is no
blocker and no member.** The two clauses constrain each other. Bind intact.

**But the code name no longer describes the member, and that is a real defect — one my own
two recommendations created between them.** Fix 1 made the name *narrower* and explicitly
repository-scoped (`unsafe-repository-state`). Fix 5 made the meaning *wider* and not
repository-scoped at all. They pull in opposite directions and landed in the same commit.
I should have seen the interaction and did not.

It bites concretely. The canonical blocker in this estate — *required-but-unavailable*, e.g.
an independent reviewer that cannot be reached when merge-readiness requires one — is not a
repository state in any sense. Both `CLAUDE.md:76` and §9e instruct membership checking
**"by name"**, and a Larry scanning the names for that situation will not stop at
`unsafe-repository-state`. `escalation-gate.mjs:422-424` reinforces the narrow reading with
a repository-scoped worked example (*"e.g. a secret committed to pushed…"*).

*Smallest fix — one parenthetical, no code, keeps the frozen literal:* on member 5, note
that the code name is inherited from the frozen enum in `escalation-gate.mjs` and is
**broader than the word *repository* suggests**. That reconciles the name to the meaning at
the only place a reader checks membership.

## R3. The §9a mapping — sound; it neither widens nor narrows, but `product-decision` is
now the residual member and the blockquote does not say so

`AGENTS.md:250`. Judged item by item against §9a's Escalate list:

| §9a item | Maps to | Sound? |
|---|---|---|
| merge-to-main | `merge-decision` | exact |
| money and payment gates | `spend` | exact |
| irreversible or outward-facing · consequential external action | `irreversible-live-action` | exact |
| minting credentials | `permission` / `irreversible-live-action` | fine — *"unless another member fits better"* carries it |
| genuine outcome ambiguity | `product-decision` | sound — ambiguity about the outcome is a product question by definition |
| a real collision between two of Warwick's own instructions | `product-decision` | sound — only Warwick resolves his own collision, and §9a's *"name it plainly; never quietly pick one"* survives intact |
| domain judgements | `product-decision` | acceptable — §9a's *"record both readings, encode neither, set a safe interim default"* still governs conduct |
| **material risk** | `product-decision` | **weakest fit.** A material risk is not a product decision; it is a risk. It reaches Warwick either way, so nothing is lost operationally — but this is the item that makes `product-decision` look like a bucket |

**Does it widen?** No, and this is the property that decides it: the mapping relates two
**closed** sets to each other. It adds no new escalation reason, so the escalation surface
is exactly §9a ∪ the seven, unchanged from before the pass. Only the vocabulary moved.

**Does it narrow?** Yes — deliberately and correctly. §9a is now read *through* the closed
list rather than beside it, which is the subordination I asked for and is consistent with
the new carve-out making `CLAUDE.md` the source for clause 4.

**What the blockquote leaves implicit.** `product-decision` is now the **residual member** —
four heterogeneous §9a items land there. That is structurally *right*; a closed list without
a residual is unusable, because the first unmapped case breaks it. But the blockquote does
not say so, leaving the reader to infer it from four worked examples.

**One circularity, low severity, worth naming.** The closing sentence — *"If an item here
appears to have no member, that is a defect to raise, not a licence to interrupt outside the
list"* — forbids the act it prescribes: raising a defect *with Warwick* is itself an
interruption. In practice it resolves through the residual, which is why **naming
`product-decision` as the residual would repair both this and the implicitness above in one
clause.** Optional; not a blocker.

## R4. The reconciliation note — provenance only, with one deletable sentence

`CLAUDE.md:86`. Deletion test applied to each of its three parts:

- *"AD-26's material scope change, and a genuine blocker"* — **provenance.** Naming what a
  provenance note is provenance *for* is a reference, not a second home. Passes.
- *"marked so the next reader sees each was settled into an existing member rather than
  dropped"* — **unique fact**, and a genuinely useful one: it is what stops the next reader
  repeating my pass-1 investigation. Passes.
- *"The list stays closed at seven."* — **duplicate.** `CLAUDE.md:76` already says *"This is
  a closed list… one of these seven."* Delete this sentence and nothing is lost.

So: **provenance only, with one restated sentence.** The author's first version was caught
by its own grep; this version is clean except for that one line, which no grep would catch
because it is a paraphrase, not a repeated string. Trivial severity, but it is the same
shape the author was watching for.

*Divergence risk, inherent to provenance notes:* if anyone later edits member 1 or 5's
gloss, `:86` will still assert the reconciliation happened. Acceptable.

## R5. My own deletion test — run independently, two failures found

I ran criterion 4 myself across the three files rather than reading any table. **Passing:**
the seven live only in `CLAUDE.md` (§9a, §9e and `:92` all point, none restates); the
non-boundaries only in §9e; the build team only in `agent-index.md`; *"hooks enforce, never
carry"* once; the honest limit once. Clause 5's rewording at `:100` genuinely passes — it is
now the rule plus the defect classification, true both before and after the two hard-coded
copies are retired, exactly as claimed.

**Two failures, both new. Neither was in my pass-1 report — I did not run the deletion test
then, and Larry was right to make me run it now.**

**DT-1 — footer field order has two homes.** `CLAUDE.md:106` states the order — *"context
health as a percentage · the state · the KEEP GOING / CLEAR NOW advice · the next-model
recommendation · the continue-or-handback control token"* — and `:112` declares that **field
order** belongs in `footer.mjs`. I checked `:106` against the grammar at
`D-governor-constitution-and-continuation.md:556`:

```
FOOTER := "⟦GOV⟧" SP CTX SEP STATE SEP ADVICE SEP NEXT SEP CTRL
```

Five fields, identical sequence. `:106` is a faithful duplicate of a fact the next line sends
elsewhere. *Smallest fix: `:106` → "The footer carries these fields:" — drop "in this
order". Two words.*

**DT-2 — the banner and the footer contradict each other on position. This is the one I
would fix before merge.** Three statements that cannot all hold on a first reply:

- `:58` — *"One banner, at the top of the first reply."*
- `:68` — banner **line 5** is *"The `⟦GOV⟧` footer line, verbatim"*.
- `:104` — *"Every reply **ends** with a `⟦GOV⟧` footer as its **final line**."*

Either the footer appears twice (once near the top inside the banner, once at the end), or
the banner is not at the top, or the footer is not final. It also fails the deletion test in
the same place: delete banner row 5 and no fact is lost, because `:104` already requires the
footer on every reply.

This is **pre-existing at `f582611` — I missed it** — and survives `1077a8b`. It matters more
than DT-1 because startup step 9 is executed literally on every fresh session, so a fresh
Larry hits the contradiction on its very first output. *Smallest fix: delete row 5, and
change `:60`'s parenthetical to "(four lines; the footer follows the banner as the reply's
final line, per § 'Governor advice')". One row plus one parenthetical.*

## R6. Anything newly broken by the fixes?

**Nothing broken.** Two things newly *exposed*, one of them important.

**N1 — the `footer.mjs` build spec still says `unsafe-state`. Highest priority in this
re-check, and it is not a `CLAUDE.md` edit at all.** `git grep -n "unsafe-state"` returns
exactly two tracked hits, both in the accepted design record:

- `decisions/D-governor-constitution-and-continuation.md:566` — inside the **formal grammar
  block**, the `CODE` production: `| "irreversible-live-action" | "unsafe-state"`
- `decisions/D-governor-constitution-and-continuation.md:132` — the same seven in prose

That grammar block is the build input for `footer.mjs` — the very module Larry is gating the
merge on, and the module `CLAUDE.md:112` names as the single renderer *and parser* of the
footer. A builder working from it will emit `HANDBACK_CODES` containing `unsafe-state`, which
matches neither the constitution (`:82`) nor the frozen `ESCAPE_HATCH_REASONS`. The pass-1
defect is closed where I audited it and open where it will be consumed.

*Action for Larry, before `footer.mjs` is written:* correct `D-…:566` and `:132`, **or** state
the literal explicitly in the `footer.mjs` Work Order. The second is sufficient and cheaper;
the first also stops the next reader building from a stale spec.

**N2 — member 5's name/meaning mismatch** (R2). An artefact of my own two recommendations
landing in one commit. I own it; the fix is one parenthetical.

## R7. Merge verdict — pass 2

**Mergeable now**, on two conditions, neither of which is a doctrine defect:

1. **Take DT-2** in this commit — one row plus one parenthetical. It is a live instruction
   contradiction that fires on the first reply of every fresh session, which is precisely the
   moment clause 1 exists to govern.
2. **Carry N1 into the `footer.mjs` work** as an explicit Work Order line. Larry already
   controls the merge order; this just makes sure the fix survives the handoff.

DT-1 and the member-5 name parenthetical are cheap and I would take them, but I would not
block on either.

**All three of my pass-1 merge-blockers are genuinely closed, not merely edited** — I checked
each against the code rather than the report: the frozen enum for fix 1, AD-26's wording for
fix 2, and a byte-level diff of §9a for fix 3. Two of the five fixes came back **better than
what I proposed** (step 3's disagreement case, and the carve-out's extension to specialist
contracts). The constitution is now internally coherent, honest about what is built versus
declared, and — the property that decides it — binding on its own with no hook installed.

---

*Nolan — independent re-check, 2026-08-01, commit `1077a8b`. Read-only: the only file
modified in either pass is this one; nothing in `C:/Fusion247PKA-wo-02` was written and no
mutating git command was run. `private_surface: none`.*
