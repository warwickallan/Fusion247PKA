---
name: Reconcile root CLAUDE.md's withdrawn no-Bash premise with its own Rule 4 (Veritas D-G3-04)
work_order_id: WO-2026-08-04-02
build: BUILD-015
wp_number: n/a
status: draft
authorised_by: Warwick
authorised_date: 2026-08-04
owner: general-purpose
return_to: larry
blocking_dependencies: []
tags: [build-015, veritas-gate3, governance]

outcome: Root `CLAUDE.md` states one consistent truth about Larry's capability boundary — the boundary is discipline, not enforced capability — with no surviving passage asserting the withdrawn "Larry holds no `Bash`" premise as operative fact, and with every unrelated clause preserved exactly.
acceptance_property: Read root `CLAUDE.md` end to end with no other context. It contains no statement, in any section, that asserts or depends on Larry currently lacking `Bash`, `Edit` or `Write`; and no statement that asserts Larry currently HAS them as a fixed fact. Every capability statement is either historical-and-dated, or conditional on the `thin-larry` grant actually being bound.
integration_owner: larry
veritas_gate: 3
document_impact:
  - path: CLAUDE.md
    owner: larry
  - path: .claude/agents/thin-larry.md
    owner: nolan

file_surface:
  - CLAUDE.md
out_of_scope_policy: report-only

worker_contract:
  path: AGENTS.md
  governance_sha: 66d40d38b867d76aeeb698ec89b13aff800552e5

contract_basis:
  - surface: CLAUDE.md
    permitted_by: "No permanent estate contract owns root `CLAUDE.md`; per `Team Knowledge/Templates/work-order.md` §'On document_impact' (line 188), 'Default owners: … integrated build records and cross-document reconciliation → **Larry**' (line 196), and Larry has delegated the mutation under Warwick's written instruction of 2026-08-04 carrying the ruling ID `BUILD-015-AUTONOMOUS-RECOVERY-RESTART` §3 (D-G3-04), which names `CLAUDE.md:90`, `:117` and `:119` as the surface to reconcile against `:56`. PROVENANCE, recorded 2026-08-04 per Veritas D-G3-13/D-G3-14: `BUILD-015-AUTONOMOUS-RECOVERY-RESTART` is a Warwick RULING ID, not a document — it exists in session and `grep -rn` across the estate finds it only in citations like this one. The authorisation is real and is attested by Larry; it is NOT verifiable from the repository. Recorded rather than deleted, because deleting a real authorisation to satisfy a grep would be a falsification."
  - action: "read-only git inspection (git diff, git log, git show)"
    permitted_by: "`Team Knowledge/SOPs/SOP-022-work-order-preflight.md` §'Phase 2 — the preflight' (line 121), which reads in terms: 'Verify the order against observable reality. Read-only; nothing here writes.' Every mutating git operation is withheld from this order by `Explicitly out of scope`. CORRECTED 2026-08-04 (Veritas D-G3-14): this entry previously cited root `AGENTS.md` for a clause that does not exist there — verified absent by grep for `reconnaissance`, `read-only` and `unrestricted`, each returning no match across its 336 lines."

contract_conflicts: none

capability_evidence:
  source: host agent roster listing delivered to Larry at session start, 2026-08-04
  result: "general-purpose advertised with the full tool set (`*`), which includes Read, Edit, Write, Bash, Glob and Grep. This order requires Read, Edit, Grep and read-only Bash — all advertised. No live probe of the delivered grant was available; if a required tool proves absent at read-back, REFUSE and name it rather than working around it."

credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none

worktree: C:/Fusion247PKA
branch: build-015/live-acceptance-recovery-2026-08-03

schema_decision: n/a
security_inputs: n/a
operational_handoff: none

veritas_source:
  receipt: Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-gate3-governance-ecfb04b.md
  reviewed_sha: ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040

veritas_findings:
  - id: D-G3-01
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-02
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-03
    disposition: assigned-to
    work_order: WO-2026-08-04-01
  - id: D-G3-04
    disposition: assigned-here
  - id: D-G3-05
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-06
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-07
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-08
    disposition: returned-for-Warwick-decision
    reason: "Requires editing `Team/Keel - Implementation Engineer/AGENTS.md`, reserved to Warwick by the root CLAUDE.md hard rule. Recommendation recorded in WO-2026-08-04-03."
  - id: D-G3-09
    disposition: already-resolved
    evidence: "Malformed dispatch-envelope SHA, not a repository artefact. True tip `565351d5abad48d8cfd969e1616e0b81a827d8d1`. Every SHA in this package resolved through git."
  - id: D-G3-10
    disposition: assigned-to
    work_order: WO-2026-08-04-03
  - id: D-G3-11
    disposition: assigned-to
    work_order: WO-2026-08-04-03
---

## AMENDMENTS

**Amended 2026-08-04 by Larry at read-back acceptance. Recorded here because they were issued
verbally in the dispatch message and not written into this artefact.**

- **Contradiction ruling — strict minimum.** Removing the false premise from `:90` leaves *"Larry …
  performs no mutation himself"* standing as a free-standing absolute, which fights root `AGENTS.md`
  §3's carve-out that Larry retains authority to act personally on integration, merges and git
  surgery. **Option (a) taken:** delete only the causal clause; change nothing else; **report the
  contradiction upward rather than resolve it**, per root `CLAUDE.md` §"Source of truth", which
  makes an apparent contradiction in these sections a defect to raise with Warwick and never a tie
  to settle in the moment. Carried to Warwick's decision queue.
- **AC8 provenance line placed in Rule 4's Status cell at `:56`** — where the capability history
  already lives, adding no structure. It must carry Warwick's own point that **a corrected record is
  not proof that the host injected it**, so the correction is not read as closing the live-probe
  criterion.
- **`:119`'s bolded topic sentence removed as well as the quoted passage.** *"The handback ding
  cannot be made event-driven, and this is a real limit rather than a gap to paper over"* is the
  conclusion of the false argument; leaving it would preserve an absolute after deleting its only
  support. Replaced with: the ding stays a dispatch under Larry's unmechanised judgement, and
  whether an event-driven trigger is achievable is **open and unproven, claimed in neither
  direction.** No trigger is to be proposed, designed or sketched.
- **`:56` is otherwise off-limits** — it is the target state, not a target.
- **`:117` does not restate the hand-composed-footer rule.** `:115` already carries it; duplicating
  it would breach the SSOT Golden Rule.
- **`.claude/agents/thin-larry.md:35` and `:3` routed to WO-2026-08-04-01**, not to this order.

**Verdict at read-back: CLARIFY.** Reasons logged in `SHIT-TO-DO.md` §2.

## What this order is, in one paragraph

Root `CLAUDE.md` is loaded at every session start. Rule 4 at `:56` records the current, correct state: the `thin-larry` binding is **UNBOUND — deliberately, by Warwick**, and a fresh Larry holding `Bash`, `Edit` and `Write` is **expected**, not anomalous. Three passages later in the same file — `:90`, `:117`, `:119` — still assert the **withdrawn** premise as operative fact, two of them inside sections where the file declares *itself* the source of truth. Veritas Gate 3 held Documentation truth at **FAIL** partly for this (`D-G3-04`, HIGH): the file contradicts itself across 35 lines on the session's most contested fact. Warwick authorised this correction explicitly on 2026-08-04.

## The truthful state you are writing toward — Warwick's exact words, 2026-08-04

- Thin Larry is **UNBOUND**.
- `Bash` / `Edit` / `Write` **may be present**.
- The boundary is currently **discipline, not enforced capability**.
- **A corrected record is not proof that the host injected it.**

Two prohibitions Warwick attached, both binding:

- **Do not restore `.claude/settings.json`**, and do not write anything implying it exists or should.
- **Do not represent Thin Larry as mechanically enforced**, anywhere, in any wording.

And one Warwick recorded at `7f83d4c`: **the stale "no `Bash`" claim is not to be replaced by an equally stale "has `Bash`" claim.** Capability state is dynamic and needs current evidence. Write conditionally and dated; never assert a fixed present-tense capability in either direction.

## The three known passages, and what each must become

Line numbers are as read at `cd51ac066895985463e88d3933de4e0c1db7c0db`. **Resolve them yourself before editing; a line number in an order is the most perishable thing in it. Cite the surrounding sentence, not the number.**

**1. `:90`, §"Git ownership".** Currently opens: *"**Ownership is not execution.** Under the `thin-larry` grant Larry holds no `Bash`, so **the specialist implementing a change executes the Git operations…**"*

The false element is the causal clause only. **The rule itself survives and must survive** — Larry orchestrates and does not execute; the specialist performs the mutation; Larry owns the outcome, sequencing and decision; serialising concurrent writers is Larry's job. Rewrite so the rule rests on the **delegation and the discipline**, not on incapacity. This must read as binding on a Larry who *does* hold `Bash` — because that is the expected case today. Keep the section's own note that it is the only authoritative statement of the rule.

**2. `:117`, §"The ⟦GOV⟧ footer".** Currently: *"Under the `thin-larry` grant it is therefore rendered by a **dispatched specialist running `footer.mjs`**, and Larry pastes those exact bytes."*

The requirement that the footer is rendered by `footer.mjs` and never hand-composed is **unchanged and must survive** — it does not depend on Larry's grant, it depends on the byte grammar living in one module. What must go is the framing that the dispatch is *caused by* the grant. State the rule as it actually stands: the bytes come from `footer.mjs`; running it through a dispatched specialist is the standing route; a hand-composed footer is a defect regardless of who holds `Bash`.

**3. `:119`, §"The ⟦GOV⟧ footer".** Currently: *"A Stop-hook detector must key off something Larry emits, and the only sanctioned marker is the footer's control token — **which, without `Bash`, Larry cannot render. The trigger can never appear.**"*

This is the strongest false claim in the file: an absolute impossibility derived from a premise that no longer holds. **Do not simply invert it into "the trigger can now appear" — that would be the equally stale opposite claim Warwick forbade, and nobody has proven a Stop-hook detector works here.** Write what is actually established: the ding remains a dispatch and the pre-turn-end reflex that decides to send it remains Larry's unmechanised judgement; whether an event-driven trigger is achievable is **open and unproven**, and it is not claimed either way. Do not add a plan, a mechanism, or a proposal — the regrowth cap applies.

## Enumeration is the deliverable, not those three edits

`7f83d4c`'s commit message asserted that exactly **one** quotation of the withdrawn wording survived. **Three** did. Do not repeat that failure.

Read root `CLAUDE.md` **in full** and independently derive the complete set of passages that assert, imply, or depend on a claim about Larry's current tool capability — including Rule 4 itself, which you must check is internally consistent with your rewrites. Report the complete set with a disposition for each: changed / unchanged-and-correct / unchanged-and-flagged.

Also run a read-only sweep of the primary checkout for the same defect class outside your surface, and **report without fixing.** Larry's own sweep found `.claude/agents/thin-larry.md:17` (a conditional statement about how the grant works when bound, plus a dated historical proof — Larry's assessment is that this is correct as written, but verify it and say if you disagree) and `Deliverables/2026-07-27-nolan-engineering-hire-recommendation.md` (an explicitly historical reasoning document, already superseded by `Team Knowledge/Templates/work-order.md`). Exclude `.claude/worktrees/**` — those are other branches and are not this head.

## Acceptance criteria

AC1 — No passage in root `CLAUDE.md` asserts or depends on Larry currently lacking `Bash`, `Edit` or `Write`.

AC2 — No passage asserts Larry currently HAS them as a fixed present-tense fact. Capability statements are conditional, dated, or explicitly recorded as needing current evidence.

AC3 — Rule 4 at `:56` and every rewritten passage state one consistent position, and a reader moving between them finds no contradiction.

AC4 — Every operative rule that previously rode on the false premise **still binds**: Larry orchestrates and does not execute; a dispatched specialist performs mutations; Larry serialises writers; the ⟦GOV⟧ footer is rendered by `footer.mjs` and never hand-composed; the handback ding stays a dispatch under Larry's judgement.

AC5 — Nothing in the file represents `thin-larry` as mechanically enforced, and nothing suggests restoring `.claude/settings.json`.

AC6 — **No new mechanism, control, checklist, validator or process is added.** The regrowth cap is explicit in this file and applies to edits to this file. Net structural additions should be zero; you are correcting statements, not adding governance.

AC7 — Every unrelated section is preserved: Step 0 / Step 1 / Step 2, Rules 1-3, the Veritas paragraph, the Codex budget, the Work-Order-from-a-finding rule, the seven interruption codes **verbatim and in order** (they are mirrored in a frozen literal in `tools/governor/footer.mjs` — renaming one is a code change), the Wayfinder section, Source of truth, Specialist dispatch, Private surfaces, and the hard rules.

AC8 — A dated provenance line records the correction, cites `7f83d4c` and the Gate 3 receipt, and states plainly that a corrected record is not proof the host injected it — so a fresh instance does not read the fix as closing the live-probe criterion. **The live-probe criterion stays OPEN.**

## Required evidence

- The complete enumerated set of capability-bearing passages you derived, with a disposition for each.
- `git diff -- CLAUDE.md` pasted verbatim.
- A read-only sweep for the withdrawn wording across the primary checkout, excluding `.claude/worktrees/**`, with the command and its full output, and your disposition of each hit.
- The seven interruption code names quoted back from your edited file, to prove AC7 held.
- `bash scripts/secret-scan.sh --surface CLAUDE.md` — exit code AND what it covered. Exit 2 is NOT SCANNED.

## Explicitly out of scope

- Every file except root `CLAUDE.md`. In particular: any `AGENTS.md`, `.claude/agents/keel.md` (WO-2026-08-04-01), `.claude/agents/thin-larry.md`, anything under `Deliverables/` (WO-2026-08-04-03), and anything under `Team/`.
- All mutating git operations. Read-only git only.
- Creating, restoring or referencing `.claude/settings.json` as a live control.
- Proposing, designing or building any enforcement mechanism for Rule 4. Warwick has ruled repeatedly that responding to this rule by building something is the rejected diagnosis.
