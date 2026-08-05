---
build: BUILD-020 (proofline) — no `Builds/BUILD-020*` record exists at this head; the durable record is `Deliverables/2026-08-04-proofline-wayfinder-plan.md` and `Deliverables/proofline/`
scope: constitutional patch — the `CLAUDE.md` external-reviewer-contract-boundary paragraph, reviewed PRE-INTEGRATION on Warwick's explicit instruction of 2026-08-05
gate: 3

reviewed_sha: 673e846094b4f7356026da4faaea1a8711b895bd
governance_sha: 673e846094b4f7356026da4faaea1a8711b895bd
branch: build-020/claude-md-codex-boundary
remote_reachable: true (origin/build-020/claude-md-codex-boundary)

evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA-build-020-trial\f14be9d5-bddf-49ab-a05c-d6ffc4274be0\scratchpad\export-673e846
worktree_head_at_start: afbc81f415344239a923a96f8a91bcabaf028708
worktree_head_at_end: 821d518789aab5734107d309a8df769f370b3bc8
worktree_status_clean: true
worktree_head_moved: true

review_ceiling: 30 minutes elapsed, bounded to the single-file diff named in the dispatch
verdict: HOLD
receipt_sha256: 7d1031d1f80e8202e570e09e3308fd41a161527fb166c5cb69c9dfd517547986
reviewed_by: veritas
reviewed_date: 2026-08-05
next_review_trigger: a new exact head carrying the corrected paragraph, resubmitted for the blocking findings only
---
## Scope reviewed

**The single-commit diff `build-020/live-trial..build-020/claude-md-codex-boundary` — one file, `CLAUDE.md`, +2 lines (one added paragraph and its blank separator).** Assessed against Warwick's verbatim authorisation of 2026-08-05 (five bullets) on the six axes named in the dispatch: scope fidelity, completeness, over-reach, the fail-closed clause, internal consistency, placement.

**This is a Warwick-ordered PRE-INTEGRATION patch review** under root `CLAUDE.md` §"No silent constitutional self-modification", which makes *"independent review of the resulting patch"* a precondition of integration. It is recorded under `gate: 3` because the dimensions exercised are documentation truth and Git truth. **It is not a Gate 3 boundary review and it discharges no Veritas gate.** Veritas's contract bars reviewing a worker branch *"in place of"* the exact integrated head; this review does not stand in place of one, and Gate 3 at the integrated head remains owed if this paragraph's queue effect later matters.

**Deliberately NOT in scope:** BUILD-020 broadly · WO-2026-08-05-05 / WP-2G itself · any other file · any live Codex behaviour (no Codex was invoked; `live_authority: none` stands).

## Evidence provenance

- Isolated export of `reviewed_sha` at `…/scratchpad/export-673e846`, created with `git archive 673e846… | tar -x -C <ws>`. Exported `CLAUDE.md` blob `8b056a1e72bb95c988cc4c9f717e38793a4b9f31` — identical to `git rev-parse 673e846:CLAUDE.md`.
- Governing contract verified byte-identical at the governance head: `Team/Veritas…/AGENTS.md` blob `8da3c81c…` from `git rev-parse HEAD:`, `git rev-parse 673e846:` and `git hash-object` on the loaded file — three routes, one blob.
- `reviewed_sha` is remotely reachable: `git ls-remote origin` → `673e846…  refs/heads/build-020/claude-md-codex-boundary`. No durability HOLD arises.
- **Repository `git rev-parse HEAD` at start / end — `afbc81f415344239a923a96f8a91bcabaf028708` / `821d518789aab5734107d309a8df769f370b3bc8`. THESE DO NOT MATCH.** `git status --porcelain` was empty at both. Veritas modified nothing; the shared worktree advanced concurrently on `build-020/live-trial` (commit `821d518` "WO-05 Amendment 1"). **This did not contaminate the evidence:** every byte assessed came from the immutable `git archive` export of `673e846` or from content-addressed `git rev-parse <sha>:<path>` reads, neither of which depends on worktree HEAD. `673e846` re-verified as the branch head after the move. Recorded as a fact, not smoothed over.
- No mutation testing was applicable (documentation change, no capability to remove).

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git diff --stat / --name-status build-020/live-trial..build-020/claude-md-codex-boundary` | 0 | n/a | `CLAUDE.md \| 2 ++`, `M CLAUDE.md` — one file, two insertions, no deletions, no rename |
| `git log --oneline <range>` | 0 | n/a | exactly one commit, `673e846` |
| `git diff -U8 <range>` | 0 | n/a | eight lines of context either side unchanged; no existing sentence reworded or removed |
| `git ls-tree -r 673e846 -- services/control-plane/review/prompts` | 0 | n/a | 3 files: `product-qa-runtime-orientation.md`, `prompt-approvals.json`, `reviewer-classification-amendment.md`. **`tower-qa-skill.md` is NOT there** |
| `head -25 …/prompts/product-qa-runtime-orientation.md` | 0 | n/a | frontmatter `status: DRAFT — NOT YET WARWICK-APPROVED`, `governs_live: false`, `needs: Warwick's explicit approval before it may govern a LIVE review` |
| `grep -n QA_SKILL …/tower-loop/reviewDiff.mjs` | 0 | n/a | line 54 default path = `Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md`; line 251 `runMergeReview({ qaSkillText: fs.readFileSync(QA_SKILL,'utf8'), … })`. **`prompts/` is never read** |
| `grep -rln "review/prompts\|'prompts'" services/ tools/` | 0 | n/a | only `productQaPrompt.mjs`, `seed.mjs`, `prompt-approvals.json`, `PR-2b-BUILD-NOTE.md` |
| `grep -rn runMergeReview services/ tools/` | 0 | n/a | the three Codex CLI routes — `reviewDiff.mjs`, `mergeCheck.mjs`, `demo-merge-review.mjs` — all pass `qaSkillText` from the `Builds/**` path; none touches `prompts/` |
| `sed -n '20,45p' …/review/fableAdapter.mjs` | 0 | n/a | line 33: *"Without `--tools \"\"` the child retained Read/Glob/Grep and **could read** the repo CLAUDE.md (persona leak)"* — a retained-capability record |
| `Deliverables/proofline/WO-2026-08-05-05-codex-permanent-contract.md` (durable record, read not executed) | n/a | n/a | `status: ISSUED`; outcome owed = *"Codex's authoritative operating law lives in `services/control-plane/review/prompts/`… and provably reaches the real external invocation"*; finding **G-1**: *"the route carrying almost all the law is test-only… **the live routes carry the least law**"* |
| Codex invocation | **not run** | — | `live_authority: none`; no Codex spend, correctly |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | HOLD | All five authorised bullets are present, but bullet 1 is weakened from "CLAUDE.md is canonical" to "**This section** is canonical" (D-2), and the truth defect D-1 sits inside bullets 2–3. |
| Design fidelity | PASS | No mechanism, registry, precedence engine, tracker or new surface. No new authority granted to Larry or anyone. Regrowth cap respected; the amendment is text only. |
| Functional proof | HOLD | The paragraph's two present-tense claims about the running system (contract location; byte-exact loading) are false at this head on the routes `CLAUDE.md` itself names. D-1. |
| Integration | HOLD | Correct file and a defensible position, but it lands adjacent to a section that already declares itself the single canonical home for queue effects, producing two competing canonicity claims. D-2. |
| Durability | PASS | `reviewed_sha` reachable at `origin/build-020/claude-md-codex-boundary`. Nothing else durable is claimed by a documentation change. |
| Test quality | n-a | No test in scope. The acceptance property for the mechanism this paragraph describes belongs to WO-2026-08-05-05, which specifies a mutation-tested reach proof; it is not owed by this diff. |
| Git truth | PASS | One commit, one file, +2/-0, nothing reworded or removed — exactly as the dispatch described. Verified independently by `--stat`, `--name-status` and `-U8`. Worktree HEAD movement recorded above. |
| Documentation truth | HOLD | D-1, D-2, D-3. |
| Residual risk | HOLD | The paragraph carries no marker that the boundary it describes is pending delivery of an ISSUED work order. A reader cannot tell from the text that it is aspirational at this head. |

## Production caller and journey

The "production journey" of a constitutional paragraph is the reader it directs. Traced:

1. Fresh session → `CLAUDE.md` Step 2 orientation → the finding-disposition run of paragraphs → **the new paragraph**.
2. It tells that reader: the Codex operating law *lives* in `services/control-plane/review/prompts/`, and Tower *loads* it byte-exact into the external invocation.
3. The reader then invokes Codex by the route `CLAUDE.md` itself prefers — *"Prefer the existing `reviewDiff.mjs` route"*.
4. `reviewDiff.mjs:54,251` reads **`Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md`** and hands those bytes to `runMergeReview`. **Nothing from `prompts/` is on this journey.** Same for `mergeCheck.mjs` and `demo-merge-review.mjs`.
5. The only consumer of `prompts/` is `productQaPrompt.mjs`, reached solely by `runTowerReview` — which WO-05 §G-1 records as **test-only**.

**Hop 4 is where the paragraph and the product part company.** A component reached only from a test is not on the journey, and `prompts/` is presently in exactly that position.

## Restart and durability

`n-a` — no durability is claimed by this change. Head reachability is recorded under Evidence provenance.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** none declared for this diff; the dispatch asserted "one file, +1 paragraph. Nothing existing was reworded or removed."
- **Verified independently:** that assertion holds exactly — `-U8` context is byte-identical either side.
- **What his list missed:** the paragraph's factual dependence on `services/control-plane/review/prompts/` and on Tower's loader behaviour. Both were verified against the code rather than against the claim, and both fail at this head (D-1). The estate's own durable record already names this: WO-05 §G-1, *"the live routes carry the least law."*
- **Active documents that would misdirect a fresh instance:** `CLAUDE.md` §"External reviewer contract boundary" as committed at `673e846` — the sentences *"lives in `services/control-plane/review/prompts/`"* and *"Tower loads that contract byte-exact into the external invocation."*
- **Closure claims since the last receipt, and the receipt behind each:** none made in the reviewed scope. The commit message is titled "CONSTITUTIONAL AMENDMENT", claims no completion, and the dispatch correctly submitted the change for review rather than declaring it landed.

## Defects

| # | Severity | Finding | Owner |
|---|---|---|---|
| D-1 | **blocking** | **The paragraph states, in the present indicative, two things that are not true at `673e846`.** (a) *"The canonical external Codex operating contract lives in `services/control-plane/review/prompts/`"* — it does not; `tower-qa-skill.md`, the ratified governing text, is at `Builds/BUILD-010-fusion-tower/baton-mvp/`, and the only `.md` in `prompts/` that reads like an operating contract is an **UNRATIFIED DRAFT** whose own frontmatter says `governs_live: false` and *"must not drive a live review until Warwick has read and approved it."* (b) *"Tower loads that contract byte-exact into the external invocation"* — the three Codex routes read only the `Builds/**` path; the sole `prompts/` consumer is test-only (WO-05 §G-1). **Both are the outcome owed by WO-2026-08-05-05, which is `status: ISSUED`.** Effect, against `CLAUDE.md` §Finding disposition: it *materially misstates delivered capability* and *misdirects the operator journey*. **Consequence for the fail-closed clause: the "MUST NOT be invoked" duty attaches to a directory whose contents never reach the child process, while the text that does reach it sits outside the named boundary and is therefore outside the protection entirely.** *Blocks: integrating this paragraph into `CLAUDE.md` at its current position in the sequence.* **Not a repair Veritas may propose past Warwick — the wording is faithful to his verbatim spec; what is wrong is the ordering, and that disposition is his or Larry's.** | Larry (disposition: Warwick) |
| D-2 | **blocking** | **Duplicate canonicity, and a weakening of the authorised text.** Warwick's bullet 1 says *"**CLAUDE.md** is canonical for Larry's orchestration and queue effects"*. The committed sentence says *"**This section** is canonical for Larry's orchestration and queue effects once a reviewer has returned findings"* — and it sits immediately beneath a paragraph that already declares *"**This section** is the single canonical home for what findings and verdicts do to the work queue."* Two adjacent paragraphs now claim canonicity over queue effects, which `CLAUDE.md` §Source of truth and precedence itself calls a defect: *"Every operating rule lives in exactly one home."* **Fix is three words** — restore Warwick's subject (`CLAUDE.md`, or "this file") in place of "This section". *Blocks: integrating the paragraph as worded.* | Larry |
| D-3 | non-blocking | **An evidentiary claim stronger and differently-mechanised than its source.** The rider *"injecting it has previously leaked that persona into a reviewer"* is not in Warwick's five bullets, and the cited record (`fableAdapter.mjs:33`) says the child *"retained Read/Glob/Grep and **could read** the repo CLAUDE.md (persona leak)"* — a retained capability closed pre-emptively by `--tools ""`, and by **auto-discovery/tool-read**, not by *injection*. WO-05 characterises the same line as "a real past leak"; the line itself does not evidence an observed leak into a review output. Recommend either dropping the rider (bullet 4's stated reason — *"it carries Larry's identity and instructions"* — already stands alone) or restating it as the mechanism actually recorded. Parked for the scheduled reconciliation; does not require another assurance cycle. | Larry |
| D-4 | non-blocking | **`"this file's constitutional boundaries"` is an undefined term** — the phrase appears nowhere else in `CLAUDE.md` or root `AGENTS.md`. It is Warwick's own wording and I do not propose overriding it; recorded once so the ambiguity is on the record rather than discovered later at a gate. | Larry |
| D-5 | non-blocking | **`"until the contract is reconciled"` does not name who may reconcile.** Read literally it permits editing the reviewer contract to remove a conflict and then invoking. The independent prompt-approval gate (`prompt-approvals.json`, `governs_live`, and the standing rule that governing prompts need human approval) already covers this, so no new mechanism is owed — recorded, not raised as work. | Larry |

**On the fail-closed clause specifically (the dispatch's question 4).** The wording *does* genuinely fail closed on the case Warwick named: a **known** conflict cannot run and be rationalised afterwards, and the second sentence forecloses the post-hoc-precedence escape explicitly. It creates no duty to *determine* conflict status before invoking — but that duty was not authorised and inventing it would be over-reach, so it is correctly absent. **The clause's real hole is not in its logic; it is in its referent.** Per D-1, at this head it fails closed over a directory that no live invocation loads. Fix D-1 and the clause is sound as written.

**On placement (question 6).** Defensible and I do not block on it. The paragraph is partly a precedence statement, so §"Source of truth and precedence" is the arguable alternative home; but its opening clause is about queue effects after findings, which makes the contrast with the preceding section local and readable. The "This section" ambiguity (D-2) is the symptom of that adjacency — correct D-2 and the placement carries.

**No over-reach found (question 3).** The paragraph builds nothing, registers nothing, engines nothing, and grants no new authority. Larry's identity, startup, delegation and the four rules are untouched in byte and in reading; the eight paragraphs of context either side are unchanged, and no existing clause reads differently for the insertion.

## Verdict

**HOLD** — the amendment is faithful to Warwick's authorised text and creates no mechanism or new authority, but at this head it asserts as present fact a contract location and a loader behaviour that are the undelivered outcome of an ISSUED work order (D-1), which also leaves the fail-closed clause attached to an artefact no live invocation loads; and it weakens Warwick's "CLAUDE.md is canonical" into a second competing "This section is canonical" beside the existing one (D-2).

## Next review trigger

A new exact head carrying the corrected paragraph — whether corrected by re-sequencing this amendment after WO-2026-08-05-05 integrates (at which point D-1's wording needs no change at all) or by qualifying the two present-tense sentences — resubmitted for review of the blocking findings only.
