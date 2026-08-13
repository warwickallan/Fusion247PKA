---
build: standalone
scope: keel-authority-boundary-amendment (WO-2026-08-12-03 + AMENDMENT 1)
gate: 1

boundary: The constitutional amendment to Keel's canonical contract authorised by WO-2026-08-12-03, and the outcome it promised — that Keel's contract no longer forbids what the estate's Work Order template, envelope generator and CLAUDE.md precedence permit (a bounded, declared, externally-authorised credential_scope/live_authority), WITHOUT loosening what it refused before. This is the independent review of the resulting patch required by root CLAUDE.md § "No silent constitutional self-modification".

reviewed_sha: 8d9b8c95227caf1e1175c62378eea7e9d37aa02e
governance_sha: 6fbc82be6815dc983c27160a0f329dd3f14790be
branch: main

evidence_method: target checkout (primary repository, read-only) — no export required; the artefact is committed document text, no mutation testing was applicable
evidence_workspace: C:/Fusion247PKA (read-only); receipt drafted in the session scratchpad outside the repository
worktree_head_at_start: 6fbc82be6815dc983c27160a0f329dd3f14790be
worktree_head_at_end: 6fbc82be6815dc983c27160a0f329dd3f14790be
worktree_status_clean: true
review_ceiling: 40 minutes (named in dispatch); observed within ceiling
remote_reachability: reviewed_sha IS reachable from origin/main — contrary to the dispatch's statement. See defect F2.

verdict: HOLD
receipt_sha256: 5d7163fe4e7d0069b43fb4e1cc16fee16331060e22f52bd17501b2f12570ffd3
reviewed_by: veritas
reviewed_date: 2026-08-12
next_review_trigger: ONE focused confirmation that Team/agent-index.md:25 no longer states "live_authority: none is the only value Keel may act under — any other value is itself a REFUSED condition". Nothing else — not this receipt, not the F2 correction, not any clerical repair.
---

## Scope reviewed

The Keel authority-boundary amendment authorised by `WO-2026-08-12-03` and its ⚑ AMENDMENT 1 — the
constitutional patch required by `CLAUDE.md` § "No silent constitutional self-modification" to carry an
independent review. Two commits: `260b68b` (redline, written first) and `8d9b8c9` (applied amendment).

**In scope:** `Team/Keel - Implementation Engineer/AGENTS.md`, `.claude/agents/keel.md`,
`Deliverables/2026-08-12-nolan-keel-credential-scope-contract-redline.md`,
`Deliverables/2026-08-12-wo-nolan-keel-contract-conflict.md`.

**Widened, and why** (contract §"Scope is Veritas's to widen"): the Work Order's stated `outcome` is that
*a correctly-formed order carrying such a deviation is actionable rather than refusable*. That outcome is a
property of the estate's active authority documents, not of one file. `Team/agent-index.md` and
`Team Knowledge/Templates/work-order.md` / `tools/wo/envelope.mjs` were therefore read as directly necessary
dependencies of the accepted outcome. **Not** widened into: BUILD-015, the envelope-generator table defect,
Nolan's own contract gap, GL-012 shape divergence — all correctly excluded by the dispatch.

## Accepted requirements

Derived from the durable record (`Deliverables/2026-08-12-wo-nolan-keel-contract-conflict.md` §Acceptance
criteria + frontmatter `outcome` / `acceptance_property`), not from the dispatch message.

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| AC1 | Diagnose every site in Keel's contract deriving behaviour from `credential_scope`/`live_authority`; classify each (a) default / (b) refusal trigger / (c) safety behaviour | **PASS** | Redline §4–§5 enumerates 121–123, 301–302, 311–313, 401–402, 623–624. Independently re-enumerated by `grep -n "credential_scope\|live_authority"` on the applied file: hits at 130, 144, 343, 353, 459, 682 — the same set, none missed | none |
| AC2 | Exact redline written and committed **before** application | **PASS** | `git log`: `260b68b` (22:04:50) precedes `8d9b8c9` (22:08:42); `git show --stat 260b68b` = redline only, 395 insertions, no contract change | none |
| AC3 | Safety property — permits bounded/declared/externally-authorised deviation; still REFUSES self-assumed, unauthorised, unbounded, and other-session credentials | **PASS** | Applied text L134–160: four named limbs, each with an explicit refusal. Limb 1 closes inference-from-AC, prose, and mid-dispatch supply. Limb 2 closes self-grant. Limb 3 closes "as needed"/"full access". Limb 4 closes `~/.codex/*` and every read/open/parse verb. Walked as cases 1–4 below | none |
| AC4 | Internal consistency across the changed sites | **PASS** *(in-file)* | L121/L130–165 (intake), L427–441 (critical rule 3), L682–685 (REFUSED verdict) re-read in the applied file: rule 3 and REFUSED both point at the four limbs in their one canonical home; REFUSED no longer restates a value | See F5 — two unchanged sites now phrase an absolute where a deviable default exists. Safe-direction only |
| AC5 | Report, do not fix, Nolan's own missing contract-amendment authority | **PASS** | Redline §7.1 recommends, explicitly does not apply; `git show --stat 8d9b8c9` shows no change to `Team/Nolan - HR/AGENTS.md` | none |
| AC6 | Prove ACCEPT on the real deviating order and REFUSE on a counter-case | **PASS** | Redline §6 carries one ACCEPT + five REFUSE. All six re-walked against the **applied** text below; all six land where claimed. A seventh case constructed | none |
| — | `outcome`: "Keel's contract no longer forbids what the estate's own Work Order template, envelope generator and CLAUDE.md precedence all permit… so a correctly-formed order carrying such a deviation is **actionable rather than refusable**" | **HOLD** | The contract file achieves it. The estate does not: `Team/agent-index.md:25` still states, as an active **Envelope invariant** for composing Keel orders, *"`live_authority: none` is the only value Keel may act under — any other value is itself a REFUSED condition"* | **F1 — blocking** |
| — | `acceptance_property`: a fresh Keel reading **only** the amended contract reaches ACCEPT on `WO-2026-08-12-02`'s authority question, **and** an undeclared/self-assumed scope still reaches REFUSE | **PASS** | Both halves re-derived from the applied text — see cases ACCEPT and 1–5. The property is scoped to the contract alone, and holds there | none |

## Evidence provenance

- **Method:** target checkout — the primary repository at `C:/Fusion247PKA`, read-only. No `git archive`
  export taken: the reviewed artefact is committed document text, the repository worktree was clean and
  unmoving throughout, and byte-exact re-reading of committed blobs needs no isolation. No mutation testing
  was applicable, so the export's purpose did not arise.
- Repository `git rev-parse HEAD` at start / end — `6fbc82be6815dc983c27160a0f329dd3f14790be` /
  `6fbc82be6815dc983c27160a0f329dd3f14790be`, identical.
- Repository `git status --porcelain` — `0` lines at start and at end. Working tree never modified.
- **No later change to the reviewed files:** `git diff 8d9b8c9 HEAD --stat -- "Team/Keel - Implementation
  Engineer/AGENTS.md" ".claude/agents/keel.md"` → empty. The text reviewed at HEAD is the text applied at
  `8d9b8c9`.

## Evidence executed or inspected

| Command or artefact | Exit | Result |
|---|---|---|
| `git rev-parse 6fbc82b` | 0 | `6fbc82be6815dc983c27160a0f329dd3f14790be` |
| `git rev-parse 6fbc82b:"Team/Veritas…/AGENTS.md"` | 0 | blob `d63d613d0c4001e6476a750316fa3193bd6ee2d4` — governance contract bound |
| `git show 8d9b8c9 -- <both files>` | 0 | +67 / −6 across two files; **6 removed lines are exactly the two intended passages** (intake L121–123, REFUSED L623–625). Confirms Larry's stated finding |
| `git show 8d9b8c9` hunk @423 | 0 | Critical rule 4 (`4. **C:\.fusion247\**` …) appears **as context only** — no `+`/`−` line falls inside it. **Byte-unchanged, confirmed** |
| `git ls-remote origin refs/heads/main` | 0 | `6fbc82be…` — **contains both reviewed commits.** See F2 |
| `git branch -r --contains 8d9b8c9` | 0 | `origin/HEAD -> origin/main`, `origin/main`. See F2 |
| `git reflog show origin/main` | 0 | `6fbc82b … update by push` — the amendment reached the canonical remote as a passenger of the later `6fbc82b` push |
| `grep -n "credential_scope\|live_authority" tools/wo/envelope.mjs` | 0 | `--deviate field=value` with mandatory `--deviation-authority` (L1243, L1270); `validateMachineSurfaces` requires a non-`none` `live_authority` deviation **and** its authority (L954–958). **The tooling expresses exactly the four-limb shape the amendment now permits** |
| `grep -n "credential_scope" "Team Knowledge/Templates/work-order.md"` | 0 | L135–136 `credential_scope: none` / `live_authority: none` as template **defaults**, not prohibitions |
| `grep -rn "is itself a REFUSED condition" --include=*.md .` | 0 | 9 hits. 7 are historical records or the redline/WO quoting the removed text — correct. **1 is live and active: `Team/agent-index.md:25`.** See F1 |
| `grep -rln "agent-index" tools/ services/ .claude/` | 1 | No tool consumes it; readers are `.claude/agents/nolan.md`, `thin-larry.md`, `close-session.md`. F1 is agent-facing, not machine-enforced |
| `grep -n "credential_scope" "Team Knowledge/Guidelines/GL-012…md"` | 0 | L40 forbids *read, request, echo, copy, log, quote, write*. Limb 4 forbids *read, open, parse, echo, log, quote, copy, write* — a **superset**. Limb 4 does not widen GL-012 |

## The three never-reachable items — the primary safety question

**Present in the contract text, in both required places, and I could not construct a reading that reaches
one of them.** The routes tested:

| Attempted route | Closed by | Result |
|---|---|---|
| A `live_authority` deviation naming a production migration | L440–441: *"An order purporting to grant one of those three is **REFUSED**, naming it."* | Closed |
| A `credential_scope` deviation used as a side door | L154 says *"Three things **NO deviation** ever reaches"* — not "no `live_authority` deviation" | Closed |
| A direct grant in the order **body** rather than a deviation on the field | L441: *"no authority written into an order can confer them"*, and L154's list is a property of the order, not of the field | Closed |
| Inferring authority from `file_surface` or the acceptance criteria | Limb 1: *"Never inferred from the outcome or the acceptance criteria"*; *"An authority that is not on the field does not exist"* | Closed |
| A deviation naming a live read, then writing | L429–431: *"A deviation naming a live **read** never permits a write; one naming a single system never reaches another; anything it does not name remains forbidden."* | Closed |
| A live DB relabelled "disposable" in the order | Item 1 is scoped to the **fact** (*non-disposable*), not to the order's label. A misdeclaration violates the text rather than satisfying it | Closed |

**Two boundary observations recorded honestly — neither reaches a listed item** (F3, F4 below): the
enumerations sit *under* governing phrases that are broader than they are, and the governing phrases are the
operative text in both cases.

## The six redline cases, re-walked against the APPLIED text

Each verdict below was derived from the file at HEAD, not from the redline's description of it.

| Case | Drives on (applied text) | Lands | As claimed |
|---|---|---|---|
| **ACCEPT** — real `WO-2026-08-12-02`, four bounded deviations with escalation | L134 (on field) · L137 (Warwick named, dated) · L141 (systems and operations enumerated, SELECT-only) · L144–149 (consumed via `--env-file`, carrier never opened) · L154–158 (nothing reached) | **ACCEPT** on authority; **whole-order CLARIFY** under L162–165 because the generated table still prints `none` | ✔ |
| **1** — deviation stripped, ACs still demand live execution | L134–136 *"never inferred from the outcome or the acceptance criteria"* | **REFUSED**, limb 1 | ✔ |
| **2** — escalation comment removed | L137–140 *"Nobody authorises their own deviation"* | **REFUSED**, limb 2 | ✔ |
| **3** — `live_authority: as needed for the experiment` | L141–143 *"'as needed' … is not a deviation — it is a missing field"* | **REFUSED**, limb 3 | ✔ |
| **4** — bounded read of `~/.codex/auth.json`, properly authorised | L144–149 *"never to touch another session's credentials … `~/.codex/*` included"*, plus byte-unchanged critical rule 4 L456–460 independently | **REFUSED**, limb 4, **twice over** | ✔ |
| **5** — authorised, bounded migration against production | L156 + L440–441 | **REFUSED**, never-reachable item 1 | ✔ |

**All six land where the redline claims.** Case 4 and case 5 are the load-bearing pair and both hold on two
independent clauses each.

### Case 7 — constructed here, not covered by the six

`live_authority: BOUNDED — SELECT-only reads of the live `asdair` Postgres`, escalation
*"Larry, 2026-08-12, recording Warwick's instruction."* Limb 1 **PASS** (on the field). Limb 2 **PASS** —
L137–138 expressly admits *"Larry recording Warwick's explicit instruction."* Limb 3 **PASS**. Limb 4 n/a.
Never-reachable: none. → **ACCEPT.**

**So a live read of a production database is reachable on Larry's written assertion of Warwick's words, with
no second party able to check that assertion.** This is the same structural property the harness classifier
flagged. It is **not introduced by this amendment** — every Work Order in the estate is Larry-authored, and
limb 2 is the first text to require the authority be *named* at all, so the amendment tightens rather than
loosens it. Closing it further would require a mechanism, which `CLAUDE.md`'s regrowth cap forbids.
**Classified as residual risk, recorded, and deliberately NOT escalated** (F6): applying the HOBBY BRAIN
test, the worst case is a SELECT-only read of Warwick's own hobby database, which does not meaningfully
affect his real life.

## Documentation contradiction scan

- **Larry's declared impact:** the two changed files, the redline, the Work Order.
- **Verified independently:** critical rule 4 byte-unchanged ✔ · the 6 removed lines are exactly the two
  intended passages ✔ · the shim removed the asserted values rather than refreshing them ✔ · the three
  changed sites agree with each other ✔ · the amendment matches `work-order.md` defaults and
  `envelope.mjs --deviate`/`--deviation-authority` ✔.
- **What the list missed:** `Team/agent-index.md:25` (F1). The redline's §7.2 states *"The same drift does
  NOT exist in other contracts. Mack's contract (L98), `Team/agent-index.md` (L11) and GL-012 (L40) state
  the standing defaults but **none makes a non-`none` value a refusal trigger**. **No sweep is needed**."*
  **That statement is false.** Line 11 is Mack's row and is clean; the check was generalised from it to the
  file. **Line 25 is Keel's row and carries the removed proposition verbatim.**
- **Active documents that would misdirect a fresh instance:** `Team/agent-index.md:25`.
- **Closure claims since the last receipt:** none made. Larry's dispatch correctly submitted the boundary
  for assurance rather than declaring it closed.

## Defects

| # | Sev | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| **F1** | **High** | `Team/agent-index.md:25` (Keel row) still carries the removed rule as an **active operating summary**: *"**Envelope invariants** (summary — the contract governs): `live_authority: none` is the only value Keel may act under — **any other value is itself a REFUSED condition**"*, and in the same row *"Never touches live services or credentials"*. This is the third live projection of the proposition the amendment removed, and it is the document Larry and Nolan read when composing a Keel envelope. It is exactly the duplication-drift the amendment's own commit message says it is closing. **Mitigation that keeps this out of FAIL:** the block is self-labelled *"summary — the contract governs"*, and no tooling consumes it. | **blocking** — blocks (a) any statement that the Keel authority conflict is closed, and (b) composing the next deviating Keel order from the agent-index envelope summary | Larry |
| **F2** | **High** | The dispatch states both commits are *"local only, deliberately not pushed, and will not be pushed until you return."* **Both are on the canonical remote.** `git ls-remote origin refs/heads/main` → `6fbc82be…`, which contains `8d9b8c9` and `260b68b`; `git reflog show origin/main` shows `6fbc82b … update by push`. The constitutional patch was published to canonical `main` **before** independent review returned, as a passenger of a later unrelated push. The ordering control the dispatch relied on did not hold. | **blocking** — blocks any statement that the amendment is unpublished pending review, and any plan that depends on being able to withhold it. Does **not** make continuation unsafe and does **not** block unrelated BUILD-015 work | Larry |
| **F3** | Medium | Never-reachable item 3 enumerates *"start, stop, restart, **deregister**"* but not **register / create / enable / schedule**. Base critical rule 3 covers *"scheduled task"*, which **is** displaceable by a deviation, so the four-verb list does not itself catch a deviation naming *"register the scheduled task for service X, do not start it"* — an effective first live start by proxy. Closed in practice by the governing phrase *"operating or supervising a live service"* and by the Mack boundary (L334–336). **Asymmetric with Warwick's own 2026-08-05 ruling**, recorded at `Team/agent-index.md:11`, which puts registration and deregistration on the **same** seam. Recommended: add *register* beside *deregister*. | **non-blocking** | Larry (disposition), Nolan (text) |
| **F4** | Low | Never-reachable item 2 reads *"**any write to live data** — INSERT, UPDATE, DELETE"*. `MERGE`, `COPY … FROM`, `TRUNCATE` and side-effecting function calls are unnamed. Closed by the bolded governing phrase *"any write"* and by L429's *"a deviation naming a live read never permits a write"*. Recorded for wording only; **not reachable**. | **non-blocking** | Larry |
| **F5** | Low | Two unchanged sites now phrase an absolute where a deviable default exists: L352–355 (*"Two standing rules survive this boundary unchanged … critical rule 3 … and `live_authority: none`"*) and L459 (*"`credential_scope: none` is absolute"*, inside byte-unchanged critical rule 4). Both resolve **safe-side** — the only misreading they produce is over-refusal — and limb 4's *"Critical rule 4 is unchanged by any deviation"* settles L459 explicitly. The redline reasoned about both deliberately (§5). | **non-blocking** | Larry |
| **F6** | Low | Limb 2 admits an authority chain terminating in *"Larry recording Warwick's explicit instruction"* — unverifiable by the worker (case 7). Not introduced here; tightened here. **PARKED under the HOBBY BRAIN rule; deliberately not escalated to Warwick.** | **non-blocking** | Larry (park) |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | The stated conflict is resolved in the contract and the safety property is not loosened. Both halves of `acceptance_property` hold against the applied text |
| Design fidelity | **PASS** | Matches `work-order.md` L135–136 defaults and `envelope.mjs`'s `--deviate` / mandatory `--deviation-authority`. Critical rule 4 byte-unchanged and re-asserted twice. Two-layers-max preserved: the shim was de-duplicated, not refreshed |
| Functional proof | **PASS** | All six redline cases re-derived from the applied text land as claimed; six attack routes to the never-reachable items all closed; a seventh case constructed and characterised |
| Integration | **HOLD** | F1 — the estate is half-reconciled. One active operating document still carries the removed refusal trigger for the very specialist whose contract was amended |
| Durability | **PASS** | Committed and remotely reachable on `origin/main`. (That it is reachable *earlier than stated* is F2, a truth defect, not a durability one) |
| Test quality | **n-a** | No executable test exists or is owed. The Work Order declares the acceptance a reading test and the outcome explicitly MANUAL |
| Git truth | **FAIL** | F2 — the branch/push status was materially misreported in the dispatch, and the misstatement concerns the exact control (review before publication) this review exists to serve |
| Documentation truth | **HOLD** | F1, plus the redline §7.2 statement *"No sweep is needed"* is falsified. The check ran against line 11 and was generalised to the file |
| Residual risk | **HOLD** | F3 is a real boundary of the safety property and is recorded nowhere. F6 is unrecorded. F4/F5 are honest low-severity residue |
| Completed automation | **n-a** | The Work Order states: *"MANUAL outcome, not automation"*. Correctly and explicitly reclassified, per root `CLAUDE.md` § "Nothing may live only in Larry's head" |

## Verdict

**HOLD** — the amendment itself is sound and I could not find a reading that reaches any of the three
never-reachable items; the gate is held on one unreconciled active document (F1) and one misreported
publication status (F2), not on the patch.

**Said plainly, because a careful patch deserves it:** the four-limb test is well constructed, the
never-reachable list is stated twice and closes every route I could build against it, critical rule 4 is
genuinely untouched and independently re-asserted, self-authorisation is closed on all three vectors Larry
named, the three changed sites agree, and the shim was correctly de-duplicated rather than re-copied. The
redline is honest about what it did not do. **Nothing in the amendment widened Keel's authority beyond what
a declared, externally-authorised, bounded deviation should permit.** The HOLD is a reconciliation gap and a
reporting gap around a good patch.

**To clear this HOLD:** re-cut `Team/agent-index.md:25` so the Keel row's envelope-invariant summary points
at the contract rather than restating the removed refusal trigger, and correct the record on F2. Neither is
a Work Order — F1 is a one-line clerical repair inside the current scope; F2 is a statement to correct.

## Next review trigger

**One focused confirmation of F1 only** — that `Team/agent-index.md:25` no longer asserts a refusal trigger
the contract has removed. Nothing else reopens this boundary: a receipt commit, the F2 correction, or any
clerical repair is **not** a trigger, and F3–F6 are parked for Warwick's disposition, not for another cycle.
