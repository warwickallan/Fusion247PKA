---
build: BUILD-015
scope: gate3-governance-and-rotation-brief
gate: 3
reviewed_sha: ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040
governance_sha: 565351d5abad48d8cfd969e1616e0b81a827d8d1
branch: build-015/live-acceptance-recovery-2026-08-03
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/c--Fusion247PKA/37f8884d-5ae1-497f-83bf-e726ee33fb82/scratchpad/veritas-gate3-ecfb04b
worktree_head_at_start: 565351d5abad48d8cfd969e1616e0b81a827d8d1
worktree_head_at_end: 565351d5abad48d8cfd969e1616e0b81a827d8d1
worktree_status_clean: true
verdict: HOLD
receipt_sha256: 8fc9436e8be9710f6905689b7279e11ab958bdeb2824651c3f9a74e8e0a0cfd7
reviewed_by: veritas
reviewed_date: 2026-08-04
next_review_trigger: Resubmission of a new exact integrated head after D-G3-01 through D-G3-07 are corrected — specifically after NEXT-ASDAIR-SESSION-brief.md, .claude/agents/keel.md, CLAUDE.md:90/:117/:119 and the rotation brief's :35 and :60 are reconciled.
---

## The circularity, named rather than absorbed

`reviewed_sha` contains `7f83d4c`, part of the governance under review. `governance_sha` is the branch
tip, which additionally contains `565351d`, out of scope by Warwick's order.

**This is a real but bounded limitation, and it did not move any verdict.** My identity, gates,
dimensions and receipt shape were loaded from `Team/Veritas .../AGENTS.md` and
`Team Knowledge/Templates/veritas-receipt.md`, neither of which `7f83d4c` or `ecfb04b` touches — both
were last changed at `702ca28`, which precedes the reviewed scope. So the rules I judged by are not the
rules under review. What `7f83d4c` does change is the Work Order envelope and Keel's contract, which I
judge **as artefacts** and do not load as authority. Where circularity would genuinely bite — the
`veritas_findings` disposition rule, which is a rule about how my own findings are handled — I did not
take Larry's dispositions as given; I re-derived each from the receipt and the repository, and found one
wrong (D-G3-02).

**Residual limitation, stated so it is not read as discharged:** I cannot audit whether the reviewed
governance is the *right* governance, only whether it is internally true and consistent with the estate.
Warwick ratified it; that is not mine to re-open.

## Scope reviewed

**In scope, as dispatched:** `7f83d4c` (five files — `SOP-022-work-order-preflight.md`,
`Templates/work-order.md`, `Team/Keel - Implementation Engineer/AGENTS.md`,
`Team/Larry - Orchestrator/AGENTS.md`, `Team/agent-index.md`) and `ecfb04b`
(`Deliverables/2026-08-04-rotation-brief.md`).

**Scope I widened, and why.** Gate 3 fires on *every affected active source*, not the files Larry edited.
`7f83d4c` withdraws two facts — Keel's "never merges, pushes, opens PRs" and "Larry holds no `Bash`, so
he cannot execute". I searched the repository for both. They survive in `.claude/agents/keel.md` and in
root `CLAUDE.md` (D-G3-03, D-G3-04). I also widened to every active resumption document in
`Deliverables/`, because the dispatched scope contained one and a resumption document cannot be assessed
in isolation from its competitors (D-G3-01, D-G3-07).

**Deliberately out of scope:** `565351d` (Codex skill amendment — Warwick ordered separate integration) ·
`66d40d3` / `702ca28` (the Veritas hire — not mine to assure) · `services/hub/**` and the three untracked
drafts (pre-existing, not at this head) · Codex's PR and release gate · Pax's final BUILD-015 acceptance.

## Evidence provenance

- Isolated export of `reviewed_sha` created with
  `git archive ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040 | tar -x -C <workspace>` — exit 0. No `.git`
  directory present in the export, confirmed by listing.
- Gitignored `node_modules` copied in from the repository (read-only against it) for 9 of 14 suites; the
  other 5 have no dependencies. Third-party dependencies are not part of `reviewed_sha`.
- Repository `git rev-parse HEAD` at start / end — `565351d5abad…` / `565351d5abad…`, identical.
- Repository `git status --porcelain` at start / end — identical, 4 modified + 3 untracked, all
  pre-existing. **One entry was not in the dispatch's declared pre-existing list:**
  `services/asdair/skill/planner.js`. `git diff --numstat` on it is **empty** — a CRLF/LF line-ending
  artefact with no content change. Recorded, not a defect.
- Mutation testing applied **only inside the export**. `pipeline/test/fakePg.js` mutated
  (`57e1baaf…` → `78a46e2f…`) and restored to `57e1baaf5fe26b49ec0b41dc1134d7de7c1b6095d49a3cc1524eeff216123ae1`
  — byte-identical, suite re-run green afterwards.
- No `.git/index.lock` encountered at any point.
- No commit, stage, push or mutating git command was executed. `private_surface: none`,
  `credential_scope: none`, `live_authority: none` — all honoured.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `npm test` × 14 asdair suites, in the export | 0 (all 14) | **1609** | 1606 pass · 0 fail · **3 skipped** |
| — per suite | | | skill 281/279 · outcome 194/193 · pipeline 192/192 · bot 148/148 · cockpit-api 132/132 · pipeline-runtime 130/130 · reconcile 106/106 · packet 104/104 · shop 91/91 · handoff 81/81 · browser-runner 65/65 · transcribe 36/36 · interpret 25/25 · intake 24/24 |
| Mutation: reinstate D1 (fixed literal projection) in `fakePg.js` | — | 192 | **17 FAIL** — the protection is real and fails loudly |
| Restore + re-run `pipeline` | 0 | 192 | 192 pass, hash match |
| `grep -rl "Veritas" Builds/BUILD-015-…/` | 0 | — | only the 2 files in `Assurance/` — brief's claim TRUE |
| `grep -ril "VERITAS_PASS" Builds/BUILD-015-…/` | 1 | — | **no match anywhere** — stronger than the brief states |
| `git rev-parse` on dispatch `governance_sha` | 128 | — | `fatal: Needed a single revision` (D-G3-09) |
| `gh pr list --state open` | 0 | — | **5 open PRs**, incl. #91 `fix/thin-larry-mcp-grant` |
| `ls .claude/settings.json` (export + worktree) | 2 | — | **absent from both** — thin-larry genuinely UNBOUND |

**Suite numbers verified exactly.** Every per-suite figure in the brief matches; the totals sum to
1609/1606; the 3 skips are 2 in `skill` and 1 in `outcome`, exactly as stated. **All three skips are
`ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`-gated Postgres tests** — the brief's "at least one" understates its own
position. **"NOTHING IN THIS BUILD HAS RUN AGAINST A REAL DATABASE" is independently confirmed.**

**Evidence unavailable, declared by name:** no CI run exists at `ecfb04b`; no live capability probe of the
host tool grant was available to me, so the live-probe criterion remains **OPEN and unverified**, exactly
as the governance records it.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **PASS** | Warwick's ordered outcome is delivered: contract and capability checks land *before* dispatch, in exactly five files. `worker_contract` / `contract_basis` / `contract_conflicts` / `capability_evidence` are bound to the Work Order artefact, not to memory. Refusal conditions are untouched and SOP-022 states in terms that weakening them is invalid. |
| Design fidelity | **PASS** | No mechanism grown — the regrowth cap holds. SOP-022 is canonical and Larry's contract points at it rather than restating. `file_surface` remains **pure path data**, with justification split into `contract_basis`; verified in both the template and SOP-022, and no annotated entry exists. SOP-022 states honestly that the check "is not a control". |
| Functional proof | **n/a** | Documentation and governance scope; no runtime capability is claimed by it. The suite was executed as the brief's own evidence, not as proof of a production path. |
| Integration | **HOLD** | The change is carried through 3 of 4 layers. `.claude/agents/keel.md` — the host shim, one of the two canonical layers per `CLAUDE.md` §"Two layers max" — was not carried and still prohibits what the contract now authorises (D-G3-03). |
| Durability | **n/a** | Nothing durable is claimed by this scope. Veritas D6 remains open and is honestly carried in the brief; no database was reached, independently confirmed above. |
| Test quality | **PASS** | 1609/1606/0/3 verified by execution. D1's replacement protection **mutation-proved**: reinstating the defect produces 17 failures, so the test can genuinely turn red. Zero-executed-subtest risk absent — every suite reported a non-zero count. |
| Git truth | **HOLD** | "No PR open" is false estate-wide (D-G3-06). The dispatch's `governance_sha` does not resolve (D-G3-09). The brief's "HEAD — see the tip" no longer resolves to the commit it describes (D-G3-11). |
| Documentation truth | **FAIL** | D-G3-01 through D-G3-05. An active resumption document sends a fresh Larry to redo completed work; the withdrawn wording survives in two active documents including the one loaded every session; and the brief contains a false "both are now fixed". |
| Residual risk | **PASS** | The live-probe criterion is correctly recorded **OPEN** and is not claimed closed by corrected documentation, in `CLAUDE.md:56`, Keel's contract and the brief alike. D5 partial, D6 open, "no real database" and "not live-proven" are all stated rather than smoothed. This dimension is the strongest part of the submission. |

## Production caller and journey

**Governance scope — the "production journey" is the route by which a fresh instance is actually
directed.** Traced hop by hop:

1. Host session start → root `CLAUDE.md` (Step 1/2) → **carries three withdrawn-premise statements at
   `:90`, `:117`, `:119` that contradict its own Rule 4 at `:56`** (D-G3-04).
2. → `Deliverables/` sweep for the map → **four resumption-shaped documents, no recorded precedence**
   (D-G3-07); opening `NEXT-ASDAIR-SESSION-brief.md` yields a **stale exact-next-action** (D-G3-01).
3. → `Builds/BUILD-015-…/` build record → **no goal or acceptance document mentions Veritas or
   `VERITAS_PASS` at all** — verified; the brief records this correctly as open.
4. Dispatch route: Larry → `Team/agent-index.md` → `Team/Keel .../AGENTS.md` → **`.claude/agents/keel.md`,
   which is what the host loads and which still says the opposite** (D-G3-03).

**On the journey:** SOP-022's new section, the `work-order.md` fields and Larry's contract pointer are
genuinely reachable — Larry's contract §5-pre points at SOP-022, which carries the procedure, which the
template's frontmatter implements. That chain is sound and I traced it end to end.

**Not on the journey:** the reconciled Keel contract and `agent-index.md` are correct but are **not the
artefact the host consumes** when dispatching Keel. A contract reached only by a human reading it directly
is not on the dispatch path — the shim is, and it is stale.

## Restart and durability

**n/a** — no durability is claimed by the reviewed scope. Recorded for the record: the brief correctly
states that packet persistence is unbuilt, that the execution packet has **no production caller anywhere**,
and that nothing has run against a real database. I confirmed the last independently: all three skipped
tests are the destructive Postgres tests.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT / dispositions:** D1–D4 and D7 `already-resolved`; D5 `PARTIAL — one
  of eight classes discharged`, with `NEXT-ASDAIR-SESSION-brief.md` recorded resolved at `be6d1a5`; D6
  `assigned-to a future Work Order`.
- **Verified independently against the repository — what held:** D1 is genuinely resolved and
  **mutation-proved** (not merely asserted). D2–D4 corrections are present in `fa484bf`'s message. D7 is
  discharged by the brief, and its numbers are exact. D6 is correctly open. D5's *declaration* as PARTIAL
  rather than resolved is correct and creditable — Larry declared the weaker status voluntarily.
- **What his list missed:**
  1. **D5's one "resolved" item is not resolved.** `NEXT-ASDAIR-SESSION-brief.md` was reconciled at
     `be6d1a5` and then **regressed at `d30beb1`**, which fixed D1 without carrying the brief forward. Its
     exact-next-action now points at completed work — the identical defect D5 was raised for. Larry's
     disposition is **mis-stated**, and the rotation brief repeats the error at `:68`.
  2. **The Keel host shim.** `agent-index.md` and Keel's contract were reconciled; `.claude/agents/keel.md`
     was not. Larry's own test question scoped the check to two files, so the third layer was never asked
     about.
  3. **Root `CLAUDE.md`.** `7f83d4c`'s commit message asserts "**the one surviving quotation** of the old
     wording is marked 'stated as fact, and false' deliberately". **Three more survive**, unmarked and
     asserted as operative fact, in the file loaded at every session start.
  4. **Five PRs are open**, one of them the branch the brief itself flags as a hazard.
- **Active documents that would misdirect a fresh instance:**
  - `Deliverables/NEXT-ASDAIR-SESSION-brief.md:32-34` and `:134-141` — "**D1 is open and is yours**".
  - `CLAUDE.md:90` — "Under the `thin-larry` grant Larry holds no `Bash`, so … Larry … performs no
    mutation himself."
  - `CLAUDE.md:117` / `:119` — "…without `Bash`, Larry cannot render. **The trigger can never appear.**"
  - `.claude/agents/keel.md:3` — "**Never merges, pushes, opens PRs**…"
  - `Deliverables/2026-08-04-rotation-brief.md:35` — "Both are now fixed."
  - `Deliverables/2026-08-04-rotation-brief.md:60` — "No PR open."
- **Closure claims since the last receipt, and the receipt behind each:** seven commits
  (`37a97c5`, `1752917`, `702ca28`, `be6d1a5`, `d30beb1`, `7f83d4c`, `ecfb04b`) enumerated in full.
  **None records a Work Package, phase, build, service or journey as complete, closed, accepted,
  operational, durable or production-safe.** `ACCEPTANCE-AND-EVIDENCE.md` and `DEFECT-LEDGER.md` carry only
  pre-existing `ACCEPTED-RESIDUAL` / `ACCEPTED-DEFERRED` dispositions, all predating the last receipt.
  **No closure claim lacks a receipt. No suppressed receipt detected.** The brief's `:17-18` "BUILD-015
  holds a VERITAS HOLD" and `:151` "Do not declare anything complete" are both accurate.

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| D-G3-01 | **HIGH** | `Deliverables/NEXT-ASDAIR-SESSION-brief.md` at this head gives its "Exact next action" (`:32-34`) and FRONTIER item 0 (`:134-141`) as *"discharge the open Veritas HOLD, defect **D1** … **D1 is open and is yours**"*. D1 was fixed at `d30beb1`, one commit after the brief's last edit (`be6d1a5`). The text is unstruck, unmarked and presented as live. **A fresh Larry acting on it redoes completed work** — the exact defect D5 was raised for, in the file whose correction banner claims to have closed it. | Larry |
| D-G3-02 | **HIGH** | The declared disposition *"D5 resolved: `be6d1a5` — NEXT-ASDAIR-SESSION-brief.md reconciled"* is **wrong**, per D-G3-01. The error propagates: `2026-08-04-rotation-brief.md:68` states *"Only `NEXT-ASDAIR-SESSION-brief.md` was reconciled"*, actively telling a fresh Larry that file is clean. **D5 is not 1-of-8 discharged; it is 0-of-8.** | Larry |
| D-G3-03 | **HIGH** | `.claude/agents/keel.md:3` still carries the withdrawn wording *"**Never merges, pushes, opens PRs**, touches live services or credentials…"*. `Team/agent-index.md` and `Team/Keel .../AGENTS.md` were both reconciled at `7f83d4c`; the shim — **the layer the host actually loads**, and one of the two canonical layers per `CLAUDE.md` — was not. The estate now contradicts itself on the exact question the commit set out to settle. | Larry |
| D-G3-04 | **HIGH** | Root `CLAUDE.md` asserts the withdrawn causal claim as operative fact in **three** places, in two of the four sections where that file declares *itself* the source of truth: `:90` (Git ownership), `:117` and `:119` (⟦GOV⟧ footer). Rule 4 at `:56` of the same file says UNBOUND and that a Larry holding `Bash`/`Edit`/`Write` is EXPECTED. **The file contradicts itself across 35 lines on the session's most contested fact**, and `7f83d4c`'s claim that only one quotation survives is false. | Larry |
| D-G3-05 | **HIGH** | `Deliverables/2026-08-04-rotation-brief.md:34-35`: *"finding two HIGH defects … **Both are now fixed.**"* **False.** The two HIGH defects are D1 and D5; D5 is open (and per D-G3-02, entirely open). Contradicted by the same document at `:68`. A false completion claim in the summary section a fresh Larry reads before the frontier. | Larry |
| D-G3-06 | MEDIUM | `…rotation-brief.md:60`: *"**No PR open.**"* Unqualified and false estate-wide — **five** PRs are open (#93, #92, #91, #81, #80), including **#91 `fix/thin-larry-mcp-grant`**, the branch the same brief names at `:119-120` as a hazard that "must not be merged or rebound blindly". A fresh Larry told there is no PR open will not go looking. | Larry |
| D-G3-07 | MEDIUM | Four active resumption documents in `Deliverables/` with **no recorded precedence**: `2026-08-04-rotation-brief.md`, `NEXT-ASDAIR-SESSION-brief.md`, `BUILD-015-STAGE1-continuation-brief.md`, `NEXT-SESSION-MISSION-repo-worktree-hygiene.md`. The first two **both** open with the same orientation block and **both** declare *"Map / focus — **this brief**"*, and give contradictory exact-next-actions. Neither points at the other. | Larry |
| D-G3-08 | LOW | `7f83d4c`'s message describes *"a **four**-condition carve-out"* for `Deliverables/**`; Keel's contract enumerates **three** after "when **all** of these hold". The fourth ("explicitly authorised") appears only adjectivally in the lead-in. A checkable count that does not match. | Larry |
| D-G3-09 | LOW | The dispatch's `governance_sha` was given as `565351dc0e5e5a5e0e9e1f6a0e5e9e1f` — 32 characters, not a valid SHA-1, and unresolvable (`git rev-parse` exit 128). The true tip is `565351d5abad48d8cfd969e1616e0b81a827d8d1`; they diverge after 7 characters. Resolved independently per contract. **A fabricated-looking head in a dispatch is the failure the two-head rule exists to prevent.** | Larry |
| D-G3-10 | LOW | **Observation, not a repository defect.** The `CLAUDE.md` injected into this reviewer's context at session start carried the **superseded** Rule 4 ("**BOUND, pending real-startup proof**"), while the file on disk carries the corrected "**UNBOUND**" text — blob `8d865ed1…`, identical in the worktree, at `ecfb04b` and at `565351d`. The repository is correct; the delivered copy was not. **Direct evidence that a corrected record does not necessarily reach a fresh agent** — which is the open live-probe risk, observed rather than theorised. | Larry to investigate; Warwick to note |
| D-G3-11 | LOW | `…rotation-brief.md:49-50` records HEAD as *"see the tip"*. The tip has since advanced to `565351d`, so the brief no longer resolves to the commit it describes and offers a fresh Larry no way to detect the drift. Mitigated by its own "verify by execution" instruction. | Larry |

**Creditable, and recorded so the corrections are not over-read:** the suite numbers are exact and the
self-caught "1,606 all green" draft error was fully caught — including the per-suite split and the skip
locations. The staleness-by-omission finding is true and is *understated* rather than overclaimed. D1's
fix is real and provable. `file_surface` purity holds. The live-probe criterion is correctly left OPEN.
No closure claim lacks a receipt.

## Verdict

**HOLD** — the governance change itself is sound, honest about its own limits and free of manufactured
enforcement, but **documentation truth fails**: an active resumption document sends a fresh Larry to redo
completed work, the withdrawn wording survives in the shim the host loads and in the file loaded every
session, and the brief states that both HIGH defects are fixed when neither of D5's classes is.

**Why this is HOLD and not FAIL, stated so the calibration is auditable.** D-G3-05 is a false completion
claim, which my contract lists as FAIL grounds. It is not FAIL because **no Work Package, phase or build
has been *recorded* complete on the strength of it** — the closure enumeration is clean, the brief itself
says "Do not declare anything complete", and Larry declared D5 PARTIAL in his own dispatch. This is
inconsistency and stale carry-forward, not concealment. **HOLD is also the operative outcome:** it stops
rotation onto a brief that would misdirect the instance receiving it, which is the whole reason Warwick
put the resumption document inside this gate.

**On the request not to pass this in order to permit rotation:** it does not deserve a PASS, and the
single most consequential finding — D-G3-01 — is precisely a rotation hazard.

## Next review trigger

Resubmission of a **new exact integrated head** after D-G3-01 through D-G3-07 are corrected:
`NEXT-ASDAIR-SESSION-brief.md` carried forward past `d30beb1`, `.claude/agents/keel.md` reconciled to the
contract, `CLAUDE.md:90/:117/:119` reconciled to `CLAUDE.md:56`, the rotation brief's `:35` and `:60`
corrected, and precedence recorded across the four resumption documents. D-G3-08 through D-G3-11 are
recorded for disposition and do not by themselves require a new head.
