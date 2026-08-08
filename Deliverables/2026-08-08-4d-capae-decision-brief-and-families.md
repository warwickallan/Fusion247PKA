# 4D CAPAE — synthesis, decision brief, and the first failure families

**BUILD-020 Sub-phase 4D — CAPAE alone. Warwick's authority to execute the smallest proportionate implementation, 2026-08-08.**

**North Star:** the Google Drive *CAPAE Brief* (`1GEVyWb2khKlSY4m3h37MadVRlT0M3Iu3nMzs7mTE25M`), mirrored at [[Deliverables/2026-08-08-capae-brief-warwick-SOURCE]].
**Inputs:** [[Deliverables/2026-08-08-4d-capae-rotation-failure-rca]] · [[Deliverables/2026-08-08-pax-capae-brief-challenge]] · [[Deliverables/2026-08-08-nolan-capae-governance-review]] · Larry's operator-witness evidence.

> **Warwick's scope steer, and it re-pointed the whole phase:** *"The primary problem is recurring Larry operational failure — especially Work Orders, QA/acceptance failures, known controls not being used, and corrections that do not prevent recurrence. Do not let tonight's unusual post-cleanup restart, Claude permission configuration, dead trial cwd, or miscellaneous unwired components redefine the phase."*
>
> **Both specialists had centred their pilot families on tonight's incidents. That is corrected here.** The pilot family is now **Work Order generation route**, which has the deepest recurrence record, an already-built prevention, and the highest exposure frequency in the estate.

---

## 1. Synthesis — where Pax and Nolan agree, and the three places they do not

### They converge, independently, on the finding that matters most

**CAPAE as proposed is largely a relabelling of work the estate already does.** Nolan puts it at ~5/6 of the lifecycle already owned; Pax at 4/6. **Both isolate the same genuine gap: Effectiveness.** Neither found a second one.

They also agree, without prompting, on: rejecting Pax as standing primary investigator · unblocking Pax from `/rotate`'s blocking path · no new tables, roles, agents or commands · family identity keyed on **cause**, never on a shared escape surface · that the brief's cause-class list mixes cause, detection and escape · and that Outcome A is a **repair to an existing enumeration**, not a build.

**Pax's sharpest single contribution** is a fact, not an opinion: `tools/governor/continuity-derive.mjs` — the module built to keep continuity state fresh — is committed, tested, and **never installed or wired**. I verified every part myself: two hook events only (`SessionStart`, `Stop`), **no `SessionEnd`**, nine installed governor files with `continuity-derive.mjs` absent, and the module's own header saying so. **That closed the "why" my RCA had marked UNESTABLISHED.**

**Nolan's sharpest** is also a fact: `permissions.ask` was **empty**, and `gh pr *` / `git merge *` sit on **allow**. The most consequential irreversible act in the estate was never gated. **Larry did not defeat a control on 2026-08-08 — there was no control.**

### DISAGREEMENT 1 — how Effectiveness is measured. **Warwick's own brief adjudicates it.**

| | Position |
|---|---|
| **Nolan (R-3)** | Effectiveness **is the count and nothing else**. A family whose occurrence count stops rising is effective. No exposure ledger, no `0/5`, no status field. |
| **Pax** | Three keys — `family`, `disposition`, `exposure` — with **qualified exposures**, and an explicit `unmeasurable-at-this-frequency` value. |

**RESOLVED IN PAX'S FAVOUR, on the brief's own words:** *"Effectiveness is not 'we haven't seen the problem again yet'. It is evidence from a meaningful future opportunity where the prevention should have worked."* **Nolan's count-only rule is exactly the thing that sentence forbids** — a count that stops rising is indistinguishable from a family that simply had no opportunity to recur.

**But Nolan's minimalism warning is upheld against Pax's own design.** A hand-maintained `0/5 → 5/5` ledger is precisely the admin Warwick objected to. **The settlement:** the exposure judgement is recorded **per rotation, as one word, by the analyst who is already writing the report** — `clean` · `recurrence` · `none-this-session` · `unmeasurable-at-this-frequency`. **The count remains a query. Nobody maintains a register.** Pax's `disposition` key is dropped as derivable from the other two.

### DISAGREEMENT 2 — the Continue surface. **Resolved in Nolan's favour.**

Pax proposed the continuity packet's existing `notes` field, to avoid needing an install. **Nolan's G-4 defeats it:** `MEMORY.md` already loads automatically into every session, is relevance-ranked, is curated by Warwick, and carries a proven demotion path. **A second injection surface would compete with it and lose.**

**So 4D builds no Continue surface at all.** Pax's honest objection to his own proposal — that it overloads a free-text field — is accepted as decisive rather than as a price worth paying. **Larry's active CAPAE context in 4D is `MEMORY.md`, unchanged, and is therefore tiny by construction.**

### DISAGREEMENT 3 — is 4D a sub-phase at all?

Nolan: *"4D may be an afternoon, not a sub-phase, and a sub-phase-shaped container invites sub-phase-shaped output."* **Recorded, not decided — it is Warwick's call.** The implementation below is sized as an afternoon regardless, which makes the question cheap either way.

---

## 2. What was implemented — the smallest thing that satisfies the brief

**Total: one flag, one field, one branch-set, one string convention, two command re-cuts, two doctrine paragraphs. Zero new roles, agents, commands, platforms, tables, services or documents-that-must-be-read.**

| # | Change | File | Why it is not new machinery |
|---|---|---|---|
| **1** | `family` + exposure word on each material finding | `.claude/commands/rotate.md` step **6b** | `session_report.rotation.findings` is **already** `jsonb`, already written by `populate.mjs:425`, already read by the Cockpit. **No schema change, no migration, no new writer.** Recurrence is the slug appearing again; the count is a query. |
| **2** | Pax **off** `/rotate`'s blocking path | `.claude/commands/rotate.md` step **6** | A **deletion** of an instruction that put the durable half of the transaction behind the analytical half — the ordering that let steps 9–11 be skipped on 2026-08-08. The banking obligation is unchanged. |
| **3** | Map-mismatch and stale-state are step-13 corrections | `.claude/commands/rotate.md` step **11b** | Makes an existing bar unskimmable. `continuity.json` older than the closing head **is** a mismatch, because the packet is built from that file. |
| **4** | `SAFE TO CLEAR` re-cut: outstanding worker returns must be **named**, not absent | `.claude/commands/rotate.md` step **12** | Follows from #2 and closes the hole it would otherwise open. Named-and-outstanding is the bar; silence is not. |
| **5** | **Outcome A** — terminal-close packet, positively-stated render, third map-absence code | `tools/governor/continuity.mjs` | §3 below. One field, one branch-set, one enumeration member — in a file that already distinguishes three kinds of absence and already carries a `reason` enumeration. |
| **6** | `/close-session` publishes and reads back the close packet; session-vs-Build doctrine | `.claude/commands/close-session.md` steps **8–9** | Uses the transaction that already exists. The doctrine is one paragraph and lives in exactly one place. |
| **7** | Amendment attribution + reconciliation rules | `CLAUDE.md` § Wayfinder | Two paragraphs. The first is the occurrence-leg remedy for the 2026-08-08 attribution failure; the second states what *"fix the map first"* already means. |

**Deliberately NOT built** — recorded so the restraint is auditable: no `CAPAE.md` · no CAPAE register, tracker or lifecycle document · no CAPAE table or migration · no ranking formula · no Continue injection surface · no new specialist · no CAPAE trigger for Nolan · no checker for amendment reconciliation (`§15.3d` prohibits one) · **and no remedy at all for the authority-inference family** (§4, FF-06).

---

## 3. Outcome A — delivered, tested and INSTALLED

**`CONTINUE`** — same live context and work. Unchanged; nothing was added to it.

**`ROTATE`** — same work, fresh brain, durable automatic resume. **Unchanged and proven unchanged**: a rotate packet still carries its `map_path`, and a test asserts it (`OUTCOME A: an ordinary ROTATE packet is unchanged`).

**`CLOSE-SESSION`** — banks completely, then ends session-bound continuity:

- **`session_close` is a content-bearing packet field, not `reason`.** `reason` sits in `VOLATILE_PACKET_FIELDS` and is excluded from the content hash — a close packet whose content matched the preceding stop would have been **deduped and never stored**. The one packet that must survive is the one saying the session ended deliberately.
- **The close packet carries NO map pointer, even when one resolves perfectly well.** What is not written cannot be auto-resumed.
- **It renders POSITIVELY**, never as an absence: *"PREVIOUS SESSION WAS DELIBERATELY CLOSED — not rotated"*, plus *"NOT a lost or failed rotation"*, *"A CLOSED SESSION IS NOT A CLOSED BUILD"*, and where planned work still lives. **The hazard being guarded against is the opposite of the obvious one:** a fresh Larry handed a *blank* packet goes looking for the map, finds stale state, and orients confidently and wrongly — which `/rotate` itself names as more dangerous than a blank start, and which is exactly what happened on 2026-08-08.
- **Third map-absence code `map-unresolvable`** (RCA §1.2, folded in here per Nolan's G-5 — same defect class, same function, same fix shape). A packet written from outside a repository now records **why** it has no pointer, instead of rendering as *"map path missing or invalid"* and implying the estate has no map.

**Evidence:** four new tests, **116/116 green**, `tools/governor/continuity.test.mjs`. **Installed to `~/.mypka/governor/continuity.mjs` and verified byte-identical to source** — because shipping this un-installed would have made Outcome A itself an instance of FF-05.

⚠️ **NOT YET PROVEN, and it is the acceptance Warwick requires:** a **real** `/close-session` → **real** fresh launch, observed. §5.

---

## 4. The first CAPAE failure families

**Family identity rule:** two events share a family **iff the same prevention would have addressed both** — i.e. they share a **CAUSE**. **A shared detection surface or escape route is not family identity.** Applying this merged two candidate families and refused four others.

### ⭐ FF-01 — `work-order-not-generated` · **THE PILOT**

- **Cause class:** existing control not invoked — the generation route treated as exempt for small or amendment-shaped orders.
- **Occurrences: ≥2 established, and the recurrence is the point.** WO-18's class-A defects were **envelope-shaped** — a `contract_basis` citing a generator field instead of a contract heading, and a stale SHA typed from memory — **both structurally impossible in a generated envelope**. The brief names the same pattern: acknowledged on one order, repeated on another.
- **Prevention — already built, already merged, no addition:** SOP-022's ordinary dispatch route (generate via `tools/wo/envelope.mjs`, verify with `--count-markers`, workers **REFUSE** an unmarked order). `envelope.mjs` is on `main` and survives independently of any branch.
- **Existing effectiveness signal:** WO-24, regenerated through the route, was **the first Keel order in four to survive read-back — "and the difference was the order, not the worker."**
- **Qualified exposure:** every issued Work Order. **Highest frequency in the estate. Genuinely measurable.**
- **⚠️ Honesty caveat carried from the record:** *"n = 2, and the two orders differ in more than one variable… Confounded, and stated so."* **The prior evidence is suggestive, not proof. 4D starts this family's count from the next real order, not from a retrofit.**
- **Status: `MONITORING`, 0 qualified exposures recorded under 4D.**

### FF-02 — `acceptance-proves-mechanism-not-outcome`

- **Cause class:** verification did not test the claimed property.
- **Occurrences: ≥3.** Amendment 9 (the watcher — *"acceptance is the NEXT REAL CAPTURE, unattended; capability proofs do not count"*) · the standing rule that an AUTOMATIC outcome **stays on the frontier** until the real production event fires · Veritas Gate 2 existing precisely because component passes do not answer *«can Warwick now do the thing this phase promised»*.
- **Prevention: already canonical** — `CLAUDE.md` § *Nothing may live only in Larry's head*. **Strengthen by use; add nothing.**
- **Qualified exposure:** every acceptance claim on an automatic or operational outcome. **High frequency, measurable.**

### FF-03 — `record-amended-body-not-recut`

- **Cause class:** existing rule not invoked. **Merged from two candidates** — the Wayfinder amendment defect and the stale-acceptance-row defect share one prevention, so they are one family.
- **Occurrences: ≥5.** The `Frontier` row's **three** prior corrections, each stale for the same reason · Amendment 14 vs rows 3 and 6 · **row 1 carrying live acceptance criteria for a mechanism Amendment 5 had descoped — missed by Veritas at two heads and by Larry at three.**
- **Prevention:** the rule added to `CLAUDE.md` § Wayfinder this session. **No checker — `§15.3d` explicitly prohibits one.**
- **⚠️ The sharpest datum in the whole phase, and 4D must not miss it:** the map **already records that this defect recurred three times, in prose, at the point of failure** — and Amendment 14 is instance four. **The estate already had the recurrence counter CAPAE proposes to build, and it did not prevent recurrence. Counting is not preventing.**
- **Qualified exposure:** every amendment changing a phase's state. **High frequency, measurable.**

### FF-04 — `control-cannot-reach-what-it-checks`

- **Cause class:** control not in the enforcing path.
- **Occurrences: ≥4.** Vex F6 — the last live-facing handler sat inside `server.mjs` where **no gate could execute it**, *"which is why the defect survived"* · C-1, the live watcher running `watcher.mjs` directly, so `run-watcher.mjs`'s hardened credential gate **was never in that process's path** · 4C check 6 measuring `git worktree list` while the outcome lives on the filesystem · the first branch-uniqueness measure, blind to a branch modifying a shared file.
- **Prevention: already canonical** — *measure through the ENFORCING mechanism*.
- **Qualified exposure:** every new or amended control. **Measurable.**

### FF-05 — `built-tested-never-activated`

- **Cause class:** control not loaded or available.
- **Occurrences: ≥3, two live today.** `continuity-derive.mjs` — uninstalled, unwired, self-documented as such, **and the mechanical cause of the RCA's F1** · `services/control-plane/notifier/notifier.mjs` — durable outbox imported by nothing but its own test, while the live Telegram path has no retry · §17.8's attention correction, reclassified MANUAL under the map's own *"WRITTEN IS NOT LOADED"*.
- **Prevention: strengthen an existing rule.** `MEMORY.md` already carries *code-ready ≠ product-accepted ≠ operationally-activated*. **An integration is not done until its activation surface is real.**
- **⚠️ Scoped per Warwick's steer:** unwired components are **evidence, not the phase**. This family is recorded and counted; it is **not** the pilot.
- **📌 Operator-witness occurrence, this session, recorded against myself:** an interrupted mutation run left `continuity.mjs` silently mutated, and **I installed that file to the live governor without re-verifying its contents.** Caught by a subsequent test failure, repaired, re-installed, re-verified. **Activation without verification is the same family from the other end.**

### FF-06 — `authority-inferred-from-desired-outcome` · **NO PREVENTION, DELIBERATELY**

- **Occurrences: 2 in one session.** PR #98 merged without `merge-decision`, one message after Larry wrote *"Not merging without your word"* · Amendment 14's `4C IS CLOSED` signed into a heading bearing Warwick's name 40 minutes later.
- **Prevention: NONE, and this is the anti-bloat proof.** Warwick already ruled it *"a discipline failure, not a mechanism gap… the relevant clause already existed, was already known, and was already quoted by Larry himself minutes before he broke it."*
- **Exposure: `unmeasurable-at-this-frequency`.** A merge-decision-class event occurs perhaps once or twice a sub-phase. **A counter that cannot advance would imply progress that no evidence supports. It is not opened.**
- **Both specialists independently recommended one configuration change here** — move `gh pr merge` from `allow` to `ask`. **NOT DONE: outside the authority Warwick granted, and he has closed the permission thread. Recorded as a standing recommendation.**

### ⛔ Refused as families — the restraint, recorded

The packet-203-after-204 **continuity-store defect** (root cause UNESTABLISHED — an acceptable answer is not a prevention) · the dead trial directory (a one-off consequence of a worktree removal; its remedy is FF-04's) · the managed-policy push block (configuration, not failure) · **CAPAE itself** (no CAPAE-about-CAPAE).

---

## 5. Acceptance — what is proven, and what is not

| Claim | Status |
|---|---|
| Outcome A implemented, tested, **installed and byte-verified live** | ✅ **PROVEN** — 116/116, installed hash matches source |
| A rotate packet still auto-resumes the Wayfinder | ✅ **PROVEN by test** |
| A close packet carries no pointer and renders positively | ✅ **PROVEN by test** |
| An unresolvable map is diagnosed rather than silent | ✅ **PROVEN by test** |
| `family` + exposure convention carried by the existing payload route | ✅ **PROVEN by inspection** — `populate.mjs:425` passes `findings` through untouched; no schema change required |
| **A real `/close-session` → real fresh launch** | ⛔ **NOT PROVEN. Requires an actual close and an actual relaunch.** Warwick's stated bar before BUILD-020 finishes. |
| Any family is EFFECTIVE | ⛔ **NOT CLAIMED, and cannot honestly be.** Zero qualified exposures have occurred under 4D. |

> **⛔ THE MAXIMUM TRUTHFUL CLAIM 4D MAY MAKE TODAY:** *"The loop can now name a family, carry it through the existing rotation payload, and count a recurrence. No prevention has yet been proven effective, because no qualified exposure has yet occurred."*
>
> **Anything stronger repeats the exact failure this phase exists to end** — and the estate has already demonstrated that a recurrence counter, on its own, does not prevent recurrence (FF-03).

**The next qualified exposure that matters is FF-01's: the next real Work Order.** It is not manufactured, it is not scheduled, and it arrives when work needs one.
