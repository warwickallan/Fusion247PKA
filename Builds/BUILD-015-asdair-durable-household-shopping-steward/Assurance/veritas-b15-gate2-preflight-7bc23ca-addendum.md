---
build: BUILD-015
scope: gate2-current-state-preflight — requirement 3 / Defect #2 disposition confirmation (successor errata, not a new review)
gate: 2
addendum_to: Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/veritas-b15-gate2-preflight-7bc23ca.md

boundary: >
  Same boundary as the original preflight. No product code changed since — this addendum answers a
  narrow question about one applied remedy (a scheduled-task restart), per the original contract's
  "no reviewer stands on its own receipt" / "a head differing only by receipts or documentation is
  the same scope, not a new one."

original_preflight_sha: 7bc23ca744762502c99731c23dffd1494f85c937
receipt_committed_at: d0b3ca92f8a1f71f619a7e50fe8ff372e60b53ab
governance_sha: 7bc23ca744762502c99731c23dffd1494f85c937
remedy_verified_against: live runtime only (PID 28128, MyPKA-AsdAIr-ReadService) — no git head change

verdict: PASS
receipt_sha256: 0595fe14f6bc7b10fdd7b2e9d0b64aa519a19d8b3b87054190d159591d14005a
reviewed_by: veritas
reviewed_date: 2026-08-11
next_review_trigger: >
  Any further code change to the files named in the original preflight's production-caller chain,
  or the Gate 2 live-journey review itself, once Warwick sends a real photograph. A receipt or
  documentation-only commit, or a further scheduled-task restart with no code change, is never a
  trigger.
---

## What was checked before answering

Confirmed this is a legitimate narrow question, not a request for a new preflight: Larry's message
names one specific remedy (restarting `MyPKA-AsdAIr-ReadService`) applied against one specific,
previously-named blocking finding (Defect #2 / requirement 3's cockpit-visibility half). Nothing
else in the original six requirements is asked to be re-opened, and nothing product-side changed —
`git diff --stat 7bc23ca..HEAD` shows only the original receipt itself was committed (`d0b3ca9`,
157 insertions, one file, `Assurance/` only), which per this contract's "no reviewer stands on its
own receipt" is not a new scope.

**None of the following was taken on Larry's word** — each was re-established independently:

- **Process identity and start time.** `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`
  filtered to the AsdAIr cockpit-api command line, independently: **PID 28128**,
  `CreationDate 11/08/2026 04:34:02` (local, `+01:00`) = `2026-08-11T03:34:02Z` — after both
  `9967f59` (`01:35:49Z`) and `08ec03c` (`02:00:18Z`), matching Larry's reported figures exactly, not
  merely copied from them.
- **Port ownership.** `Get-NetTCPConnection -State Listen -LocalPort 8710` independently shows the
  listener is now owned by PID 28128. The prior stale process, PID 39976, was independently confirmed
  no longer running (`Get-Process -Id 39976` returns nothing) — not lingering, not still holding the
  port under a different lease.
- **The live endpoint, fetched by Veritas, not read from Larry's paste.** `GET
  http://127.0.0.1:8710/asdair/health` → `{"ok":true,...}`. `GET
  http://127.0.0.1:8710/asdair/workspace?shop=SHOP-2026-08-10-M64` → HTTP 200, parsed directly:
  `questions.resolved_count_display: 6`, `questions.resolved` is a genuine array of 6 entries. One
  full entry read in full: `answer_text_display: "Ariel 4in1 PODS®, Washing Capsules 33"`,
  `answered_at_display: "10 Aug, 18:10"` — human-formatted, not a raw ISO instant. A regex sweep of
  the entire `resolved[]` array for the ISO pattern `\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}` returned
  **zero matches** — Felix's HIGH-finding date-formatting fix is genuinely live in the served
  response, not merely present on disk, matching Larry's claim and going one step further than his
  own spot-check by sweeping the whole array rather than one sample.
- One entry (`resolution_display: null`, `decision: null`) has no matching `asdair.shop_decision`
  row — checked against `assembleWorkspace.js`'s own documented fallback ("a MISSING decision row is
  never treated as 'nothing happened'... the fallback is the raw answer, not silence") and confirmed
  this is the honest, intended fallback rather than a defect: the raw `answer_text_display` is shown
  standing alone, exactly as designed.

## Requirement 3 / Defect #2 — disposition confirmed: HOLD → PASS

The original HOLD was never about the pipeline, the vision gateway, or shop-identity safety — all
of those were already `PASS` on their own merits. It was specifically that the live AsdAIr cockpit
read-service process had not been restarted since the WO-B15-23 backend commits landed, so Warwick
would not have seen the restored "Resolved vs still waiting on you" view through the real interface.

That gap is now closed, confirmed independently rather than by re-grading Larry's own restart:

1. **The process is genuinely new** — started after both relevant commits, not merely reported as
   such.
2. **The old process is genuinely gone** — not a second listener racing the first.
3. **The served response genuinely carries the new shape** — fetched directly by Veritas, the exact
   shape WO-B15-23 promised (`resolved` array, `resolved_count_display`, human-formatted dates), with
   no raw-ISO regression found anywhere in the array, not just the one entry Larry quoted.

**Requirement 3 changes from HOLD to PASS.** No new evidence needed to be gathered for the rest of
the requirement — rows 1, 2, 4, 5, 6 were already `PASS` in the original receipt and nothing in this
narrow re-check touches them.

## Corrected dimension verdicts

- **Functional proof**: HOLD → PASS (was held solely on requirement 3's cockpit hop).
- **Integration**: HOLD → PASS (the cockpit-api read-service now genuinely serves the integrated
  bytes it already had on disk; every other integration point was already `PASS`).
- **Residual risk**: HOLD → PASS (the one named open residual — Defect #2 — is resolved; the
  remaining non-blocking items — the tool-ordering race, the advisory schema drift, and the
  Wayfinder plan's stale "READ FIRST" block — were never residual **risk** to Warwick sending a
  photograph, and remain correctly parked, unchanged by this addendum).
- **Documentation truth**: unchanged, HOLD (non-blocking) — the Wayfinder plan staleness named in
  the original receipt is untouched by a process restart and remains parked for the next Gate 3
  pass, per the original receipt's own reasoning.
- All other dimensions unchanged from the original receipt.

## Corrected overall verdict

**PASS.** All six named readiness points are now `PASS`: the runtime is byte-current and healthy;
the vision gateway is reachable and serving the expected model; a fresh photo today lands on a
clean, uncontaminated shop identity; the Gate Zero mechanism is live and reachable; the AsdAIr
cockpit read-service is now genuinely serving the restored "resolved vs outstanding" view,
independently confirmed at the live endpoint; and the substitution toggle is honestly understood as
a manual step. The two non-blocking, previously-parked items (Wayfinder-plan staleness; advisory
schema drift) remain correctly parked and do not gate this preflight, per this contract's own rule
that a documentation defect gates only where it would misdirect the current frontier, and neither
does.

**On the evidence gathered across both receipts, BUILD-015 AsdAIr's live production system is ready
to receive Warwick's photograph.** This addendum does not reopen or re-run the original preflight —
it answers the one narrow question asked, on evidence Veritas gathered itself, per this contract's
"no reviewer stands on its own receipt."
