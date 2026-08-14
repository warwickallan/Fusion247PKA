# CareerAIR BUILD-016 — Phase 1 census, 2026-08-14

**MEASUREMENT ONLY. Nothing was built, fixed or changed.** Two read-only probes were used and declared:
a `SELECT` against the live `careerair` schema, and one execution of the project's own `privacy-scan.mjs`
(read-only, exit code only). No credential file was opened.

## ⭐ THE HEADLINE — the map's central "unknown" is FALSIFIED

> **The North Star journey HAS completed, end to end, repeatedly — with durable receipts.**

Cleanest instance, `journey-2026-07-30T13-34-35-582Z`: a real public job-board URL in → **8 of 8 stages
ran** → fit 9/10 → `ready_to_send`, `sendable: true` → **DOCX 12,852 bytes (10 PASS checks) and PDF
252,817 bytes / 2 pages (7 PASS checks), both confirmed on disk with valid signatures matching the DB
byte-for-byte.** **Warwick has seen and approved one**: *"Yeah found that, look good. I'm happy with that."*

**Confidence: HIGH** — corroborated three ways: the run record, the database rows, and the bytes on disk.

**Four things that travel with that YES, and none may be dropped:**

1. **It was a human at a shell.** No production event invokes it. **Capability, never completed automation.**
2. **The independent QA reviewer FAILED that exact artefact** — `openai-codex-exec` reviewing
   `anthropic-claude`, verdict `fail`, 5 findings, 3 `must_fix`. A rewrite answered it and reached
   `ready_for_warwick` carrying one unfixed defect.
3. **"Downloadable" is the weak word** — the files exist and open, but delivery *through the Cockpit* is
   `UNPROVEN` (exit 3; both browsers cancel programmatic downloads on this machine).
4. **The results existed all along and nobody recorded them.** `careerair.acceptance_evidence` holds all 13
   AC rows — **every one `not_started`, `proved_at` null.** `work_package` last touched 2026-07-29.
   **Underneath: 158 journey runs, 92 CV artefacts, 178 verified exports, 170 fit assessments.**

## THE COUNT — 21 items, and ZERO unknown

**Outcomes A–H: 0 PASS · 8 PARTIAL · 0 FAIL.**
**AC-01…AC-13: 2 PASS · 4 PARTIAL · 7 FAIL.**
**Combined: 2 PASS · 12 PARTIAL · 7 FAIL · 0 UNKNOWN.**

> **Zero UNKNOWN is itself the finding.** The map recorded this as unmeasurable. **It was measurable
> throughout** — in the database and in 158 durable run records.

**The two PASSes are real:** **AC-04** (20 durable stops below the 7/10 gate; a 6 halted before the
expensive path, reproduced three times) and **AC-07** (a genuinely expired advert, HTTP 410, stopped
honestly with a non-empty route forward).

**The seven FAILs, briefly:** **AC-02** no authenticated route exists at all · **AC-03** no non-URL source
has *ever* reached a fit assessment · **AC-05** never attempted and currently unreachable · **AC-09**
`opportunity_link` holds **0 rows** — 196 opportunity rows for ~3 real vacancies · **AC-10** see below ·
**AC-12** 1 vacancy has ever reached `ready_to_send` · **AC-13** regressed from a genuine PASS.

## 🔴 THE ONE ITEM THAT UNBLOCKS THE MOST — and it needs no Warwick decision

**Wire a real production event to the journey runner.** `runJourney` has exactly **two callers, both
scripts a human types.** Every live intake surface — Cockpit, Telegram, the three scheduled email runs —
terminates at *"opportunity recorded"* and stops.

That single gap **is** `FR-23`, **is** AC-01's unmet clause, **is** why two thirds of the bot's
notification surface has nothing to fire from, and **is** why AC-03 and AC-05 cannot be exercised at all.

**Cheaper alternative if measurement stays the priority:** run the existing acceptance runner against 3–5
more real vacancies including one paste and one below-7-then-proceed. **Moves eight items, builds nothing.**

## Corrections the Wayfinder needs — recorded, frontier NOT advanced

- **`careerair.requirement_set` is NOT empty** — 45 rows, 1 adopted. The map's claim traces to a note
  written 2026-07-29; a real run adopted a version **the next day** and the note went stale.
- **The North Star journey HAS completed** — 2026-07-29 and 2026-07-30, with receipts.
- **The AC and Outcome ledgers EXIST in the live DB.** They were **abandoned, not absent.**
- **`config/source-providers.json` is not merely stale** — its own comment records a 2026-08-06 decision
  that paid Zapier webhooks were **cancelled** and Graph is active. **A genuine unreconciled contradiction
  with the authorised route, not a settled defect.**
- **`CareerAIR-Ops-Liveness` is DISABLED** — the only liveness reporter on the webhook receiver is off.
- The application engine has been **frozen since 2026-07-30**; the 2026-08-06 work touched only
  `src/email/` and `src/cockpit/`.
