# Product-QA Prompt — Bounded Approval Packet (BUILD-014 campaign review)

**For:** Warwick's one bounded approval. **Scope of the approval requested:** authorise the
composed product-QA prompt below to govern the **DEV/synthetic BUILD-014 campaign review only**.
`role_based_readiness` stays **OFF**; this approval does **NOT** enable auto-merge, live operation,
or standing/live use. (Live activation remains a separate Warwick gate.)

---

## 1. What the prompt is (composition)

The per-turn product-QA prompt = **`[ratified base skill]` + `[draft orientation layer]` + `[resolved
evidence: acceptance criteria, prior open findings, staged diff]`**. Only the **orientation layer**
needs your approval; the base is already your ratified skill (unchanged).

| Component | File | Version | SHA-256 fingerprint | Status |
|---|---|---|---|---|
| Base skill | `Builds/BUILD-010-fusion-tower/baton-mvp/tower-qa-skill.md` | 1 | `f2fc2f26…14b739a` | **APPROVED** — you ratified line-by-line 2026-07-18 (`standing_use_ratified:true`) |
| Orientation layer | `services/control-plane/review/prompts/product-qa-runtime-orientation.md` | 1 | `cd65539a…253135` | **DRAFT** — AI-authored (Mack), needs your OK |
| Composed template | (base `\n\n` orientation) | — | `c8bd763c…db3116` | bound onto every `review_run.prompt_fingerprint` |

Runtime provenance string recorded on every run:
`tower-qa-skill@1(approved)+orientation-draft@1(UNRATIFIED-draft)` — legible, never claims approval.

---

## 2. Exact diff from the ratified skill

The orientation is **purely additive** — it changes **no word** of your ratified skill. It reinforces
two behaviours already *implied* by the ratified checklist (step 2 brief+acceptance alignment; step 8
improvements-kept-separate; the finding-classes table) and makes them **explicit and testable**:
1. **Acceptance-first ordering** — verify ordinary user-journey acceptance criteria *before* exotic/
   perimeter probing.
2. **Explicit consumption of every prior open finding** — account for each, no silent carry-over.
On any conflict, **the ratified skill wins** and the reviewer must surface the conflict.

### Full orientation text (the thing you are approving)
```
You are performing PRODUCT QA, not a penetration test. Confirm the change actually does what the
approved contract says it should for an ordinary first-party user, and only THEN look for deeper
defects. Work in this order and do not skip ahead:

1. ACCEPTANCE FIRST (before any exotic or perimeter probing)
   - For EACH criterion under "ACCEPTANCE CRITERIA (verify these FIRST)": decide
     pass|fail|partial|blocked|not_applicable against the staged diff + evidence.
   - An unmet ordinary acceptance criterion is a MATERIAL finding, reported BEFORE any exotic/
     perimeter observation. A hardened perimeter over a feature that fails its plain acceptance
     criteria is still a failing change.
   - Do not down-rank a plain acceptance miss beneath an exotic edge-case you find more interesting.

2. CONSUME EVERY PRIOR OPEN FINDING (no silent carry-over)
   - For EACH under "PRIOR OPEN FINDINGS (you MUST account for each)": state whether the change
     addresses it, leaves it open, or is unrelated. Do not assume a re-explanation closed it —
     confirm the code/evidence actually did.

3. THEN the ratified checklist — everything else (evidence-fail-closed, source-of-truth, test
   adequacy, drift, record hygiene, improvements-kept-separate, escalation) is governed by the
   APPROVED tower-qa-skill.md, unchanged. Where this draft and the ratified skill could conflict,
   the ratified skill wins; surface the conflict as a note.
```
(A GOVERNANCE-FLAG header in the file itself marks it DRAFT / not-yet-approved / governs_live:false.)

---

## 3. Ordered acceptance-first review questions (as the runtime stages them)

Per turn the packet-builder appends, after the prompt, a resolved evidence block:
- `ACCEPTANCE CRITERIA (verify these FIRST)` — one line per acceptance row:
  `- [AC-01] <requirement text> (expected proof: <marker>)` …
- `PRIOR OPEN FINDINGS (you MUST account for each)` — one line per **open** finding:
  `- [F-100] <title>` …
- the staged `base..head` diff.
The reviewer answers, in order: (1) each `[AC-nn]` → pass/fail/partial/blocked/NA, unmet-ordinary
reported first; (2) each `[F-nnn]` → addressed/open/unrelated; (3) the ratified checklist.

## 4. How every prior open finding is consumed + updated
The packet-builder resolves **all** open findings for the build into the immutable, hashed
`review_packet.resolved_payload` (so the reviewer cannot be handed a partial finding set), the prompt
forces an explicit per-finding disposition, and PR-1's `finding` table is **append-only + delete-
guarded** (a finding cannot be deleted or silently hidden). `review_run` records opened/closed links.

---

## 5. Fixture coverage vs your (a)/(b)/(c)/(d) — HONEST

| Req | Coverage | Direct dedicated fixture? |
|---|---|---|
| **(a)** unmet ordinary criterion identified before exotic probing | **Test 4a** — reviewer reports `AC-02` (unmet) as finding #1, `EXOTIC-1` after | ✅ **YES, direct** |
| **(b)** earlier findings cannot disappear between rounds | Test 1a (all open findings resolved into the immutable payload) + 4b (`[F-100]` staged every turn) + PR-1 `finding` append-only/delete-guarded (structural) | ⚠️ injection+structural, **no dedicated 2-round test** |
| **(c)** blockers and improvements separated | Your **ratified** base skill ("Improvement is never a blocker" + finding-classes table) + `auto_merge_eligible` hard-false | ⚠️ **ratified doctrine, no new runtime fixture** |
| **(d)** low-risk work not over-polished by default | Test 3a/3b (low-risk → product_qa-only, adversarial NOT invoked; auto_merge stays explicit-false) + ratified improvement-separation | ⚠️ low-risk-minimal proven, **no dedicated "improvement-only doesn't block" test** |

**Decision for you:** (a) is airtight. (b)/(c)/(d) are covered by existing fixtures + your ratified
base + structural guarantees, but **not** as three *dedicated* named tests. Either (1) approve on this
coverage, or (2) I add the three dedicated fixtures (2-round persistence; improvement-class-does-not-
block; low-risk-not-over-polished) via Mack before you approve — ~one build cycle.

---

## APPROVAL DECISION (Warwick, 2026-07-20)
**Orientation wording APPROVED** at sha256 `cd65539a…253135` for **DEV/synthetic BUILD-014 campaign
review only** (`governs_live=false`; no auto-merge, live, or standing use). Approval is subject to four
mechanical completion conditions closed in one pass — **no further wording approval required** if the
orientation body stays byte-for-byte unchanged and these pass:
1. **Embed the live classification governance** — the reviewer-classification amendment (three-axis
   impact/reachability/disposition, merge-on-disposition, R1 fail-closed split, R2 baseline,
   round-economy) is APPROVED+LIVE but **not** in the ratified base → add as an explicit versioned
   prompt component for Codex + every adversarial reviewer.
2. **Match the fail-closed output schema to the prompt** — `acceptance_results[]`,
   `prior_finding_results[]`, and three-axis `findings[]` as machine-readable fields (not free-text
   summary); Tower writes them to `acceptance_verification` + the `finding` ledger (append-only).
3. **Add three dedicated fixtures** — (A) two-round finding persistence + fail-closed on omitted
   disposition; (B) improvement-does-not-block; (C) low-risk-not-over-polished + no adversarial where
   assurance doesn't require it.
4. **Honest provenance** — without changing the approved bytes: runtime stamp becomes
   `orientation@1(APPROVED_FOR_BUILD_014_DEV_CAMPAIGN;approved_by=warwick;governs_live=false)` via a
   separate approval registry; recompute the composed fingerprint after adding the classifier component.

## 6. Approval scope (restated)
Approving this authorises the composed prompt for **DEV/synthetic BUILD-014 campaign review only**.
`role_based_readiness` stays OFF. No auto-merge, no live activation, no standing/live use. The
orientation stays flagged `UNRATIFIED-draft` in provenance until any future separate live ratification.
