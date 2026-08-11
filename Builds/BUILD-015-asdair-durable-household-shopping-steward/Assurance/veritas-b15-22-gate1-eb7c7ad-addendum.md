---
build: BUILD-015
scope: WP-B15-22 Gate 1 — requirement 7 disposition confirmation (successor errata, not a new review)
gate: 1
addendum_to: Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-b15-22-gate1-eb7c7ad.md

boundary: >
  Same boundary as the original receipt (b65c009..eb7c7ad). No product code changed since — this
  addendum answers a narrow question about a receipts-only follow-up commit, per the original
  contract's "no reviewer stands on its own receipt" / "a head differing only by receipts or
  documentation is the same scope, not a new one."

functional_review_sha: eb7c7ad0d6a243eec2719bf6b188cab5e776a32f
receipts_only_head_at_review: 1473ef74304a648f2b2442474e40eabd0a2c2dfe
governance_sha: eb7c7ad0d6a243eec2719bf6b188cab5e776a32f

verdict: PASS
receipt_sha256: f015da015c550dcd9b35892672de0d3bcbd657e5c4025930e4eac0887c9424a9
reviewed_by: veritas
reviewed_date: 2026-08-11
next_review_trigger: >
  Any further code change to the files named in the original receipt's Production caller and
  journey section, or a new Gate 2/3 boundary. A receipt or documentation-only commit is never a
  trigger.
---

## What was checked before answering

Confirmed this is a legitimate narrow question, not a request for a new Gate 1: `git diff --stat
eb7c7ad..1473ef7` touches exactly three files, all under `Assurance/`, zero product code, zero test
files, zero runtime wiring. `git log --oneline eb7c7ad..1473ef7` is one commit. Working tree at
`C:/Fusion247PKA` confirmed clean, `git rev-parse HEAD` = `1473ef7` at time of this check.

Read `b15-20-mutation-reproof-provenance-note.md` in full and checked it against my own original
findings rather than trusting Larry's summary of it:

- Its account of my M1/M2 mutation results (6/31 and 3/31 red, both restored byte-identical,
  sha256 `b95fc12ffbda...`) matches my own receipt's Accepted-requirements row 7 and Evidence-executed
  table exactly — no inflation, no new evidence invented, correctly attributed to Veritas rather than
  to the builder.
- Its account of the underlying defect that caused the HOLD ("a claim living only in an agent's chat
  transcript is not durable evidence") is an honest characterisation, not a minimisation — it does not
  claim the original HOLD was unwarranted, and does not claim git history says something it doesn't.
- It explicitly asks for narrow confirmation of one requirement rather than presenting itself as
  already having resolved the gate on its own authority.

Also read `vera-b15-23-asdair-app-restoration-08ec03c.md` (closes Defect #3 from the original receipt).
It is transparently labelled as Larry banking Vera's two prior review returns, not a fresh Vera pass
performed now — adequate to close that non-blocking observation; not independently re-verified in
depth, as it sits outside this Gate 1's numbered scope.

**One self-correction, unrelated to Larry's request, found while re-checking the original receipt's
own integrity:** the `receipt_sha256` recorded in `veritas-b15-22-gate1-eb7c7ad.md`'s frontmatter
(`e26ee1fc717b5a5eef9c076339f1d214f79e1c55e8b50d974ea1b7911dd3f098`) does not match a fresh recomputation
over the body as actually committed (`86c9e51f5afa7a5cc89ecde77d2802a6dcffc721f58f426cf07c48fed43bba33`
— the difference is a single leading blank line between the closing frontmatter fence and `## Scope
reviewed`, which the body legitimately includes but which my own pre-commit hash computation, taken
from a separate scratch file, did not). **This is Veritas's own computation error at authoring time, not
tampering, and not a change to the receipt's content** — the committed file is byte-for-byte what I
wrote. Recorded here because the tamper-evidence mechanism only has value if a mismatch is always
named rather than quietly left. It does not change any verdict.

## Requirement 7 — disposition confirmed: HOLD → PASS

The original HOLD was never about whether the WP-B15-20 fix works — it was that a promised, named,
tracked corrective action (re-running B15-20's mutation evidence in genuine isolation, because the
original evidence sat inside a window where a separate scratchpad-collision incident is reported to
have occurred) had left no durable trace, and that gap was undisclosed to this Gate 1's dispatch.

Both halves are now closed:

1. **The functional question** — does the fix genuinely work, proven by real, isolated, non-reused
   evidence — was already answered by Veritas's own mutation test during the original review (M1, M2,
   both genuine kills, sha256-verified restoration). That evidence was real at the time; what it
   lacked was a durable, committed home.
2. **The durability gap** is now closed: `b15-20-mutation-reproof-provenance-note.md` is committed,
   correctly attributed, and does not overclaim. The lesson it names — a re-proof commitment must
   leave a durable trace at the point it is performed, not only be asserted afterward — is exactly the
   right lesson and matches this contract's own operating principle (*"a document describing the right
   process is not proof that the product follows it"*, applied here to a **claim** rather than a
   process).

**Requirement 7 changes from HOLD to PASS.** No new evidence needed to be gathered to answer this —
the evidence already existed and was already genuine; what changed is that it now has a durable,
honestly-provenanced home, which is what the requirement was actually gating on.

## Corrected dimension verdicts

- **Test quality**: HOLD → PASS (was held solely on requirement 7).
- **Residual risk**: HOLD → PASS (the one named open residual is resolved; no other open residual
  from the original review remains unaddressed — the two non-blocking items, `rotation-handover.md`
  staleness and the pre-existing contrast findings, were never residual **risk** to this WP's
  functional correctness, and remain correctly parked for Gate 3, unchanged by this addendum).
- All other dimensions unchanged from the original receipt.

## Corrected overall verdict

**PASS.** All eight numbered functional requirements are now PASS. The two non-blocking findings
(rotation-handover staleness; pre-existing cockpit contrast findings) remain correctly parked for the
scheduled Gate 3 documentation reconciliation and do not gate this Gate 1 boundary, per this contract's
own rule that Gate 1 grades functional current-Work-Package truth only.

This addendum does not reopen or re-run the original Gate 1 review. It answers the one narrow question
asked, on the evidence already gathered plus the newly-committed provenance record, per this contract's
"no reviewer stands on its own receipt."
