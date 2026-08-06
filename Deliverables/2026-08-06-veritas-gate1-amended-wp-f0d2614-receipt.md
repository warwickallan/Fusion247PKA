---
build: BUILD-020
scope: amended-ACTIVE-SESSION-WORK-PACKAGE-Gate-1
gate: 1

reviewed_sha: f0d2614da5b71186f6e335552ed6b166d1327127
governance_sha: f0d2614da5b71186f6e335552ed6b166d1327127
branch: build-020/phase4-automation-law

evidence_workspace: C:\Users\Buggly\.grok\sessions\veritas-evidence-f0d2614
worktree_head_at_start: f0d2614da5b71186f6e335552ed6b166d1327127
worktree_head_at_end: f0d2614da5b71186f6e335552ed6b166d1327127
worktree_status_clean: true

verdict: HOLD
receipt_sha256: ef6d454d336f2bb54f9395c52e7175d48d11b2261999b6acca38da8589af99fa
reviewed_by: veritas
reviewed_date: 2026-08-06
next_review_trigger: New integrated head after (a) Zapier Outlook→Funnel Zaps proven live or automatic Outlook explicitly reclassified to manual residual with Warwick authority, and (b) required GitHub Actions on that exact SHA conclude success (secret-scan, private-apps/unit/control-plane as applicable).
---

## Scope reviewed

**Gate 1 only** — amended ACTIVE SESSION WORK PACKAGE functional acceptance at exact integrated head `f0d2614da5b71186f6e335552ed6b166d1327127` on `build-020/phase4-automation-law`.

**In scope (product):**
1. BUILD-020 durability / promotion readiness classification and post-merge install list.
2. Gate 2 Phase 4 residuals disposition table (WP functional row 2 — widened from dispatch renumbering).
3. CareerAIR automatic Outlook intake + existing pipeline (dispatch row 2 / WP row 3).
4. Live Cockpit production + truthful CareerAIR ops view (dispatch row 3 / WP row 4).
5. Documentation / Git / private-boundary truth (Gate 1 dispatch-law row 4).

**Deliberately not in scope:** Gate 2 Phase 4 North Star; Codex; merge of PR #97; next-WP Claude host hooks; C-1..C-9, C-11..C-15; replacement-machine DR; inventing private email content.

**Scope determination:** Dispatch renumbered Gate 1 grades as durability · CareerAIR · Cockpit · Doc/Git. ACTIVE SESSION WORK PACKAGE still lists residuals disposition as functional row 2. Veritas **widened** to grade WP rows 1–4 plus Doc/Git; no narrowing to older product slices.

**Private surface used:** `C:\.fusion247\private\careerair\**` only. Digests only in public receipt.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | **BUILD-020 durability / promotion readiness.** Classify session-independent · machine-global · PR#97 generics · BUILD-020-specific; survives dead Larry session / worktree delete / pre-merge main / post-merge main / installed-runtime restart; DR not claimed; post-merge install list. | **PASS** | `Deliverables/2026-08-06-amended-wp-recon-evidence.md` Row 1 at head; classifications explicit; merge unit = PR #97 generics; post-merge install alignment listed (ding, cockpit private-api, Claude hooks next-WP). Live supervisor `MyPKA-Local-Services-Live` Ready (executed). | Replacement-machine DR out of scope (honest). Logon-trigger unproven non-blocking. Claude host install next-WP. |
| 2 | **Gate 2 Phase 4 residuals disposition** (WP functional row 2). Every old residual at `95f8826` → DISCHARGED · STILL OPEN · RECLASSIFIED · NOT PART OF THE PHASE. | **PASS** | Evidence pack disposition table: P-JOB1/2, P-LAW, P-TOWER(capability), P-ROTATE DISCHARGED; P-CUE RECLASSIFIED/STILL OPEN for phase (not this WP product row); P-CLOSE STILL OPEN; combined cue NOT PART OF amended WP. | Phase close still needs Gate 2 at final head — not this Gate 1 claim. |
| 3 | **CareerAIR automatic Outlook intake** through existing product without session/reminder. Journey: discover → creds → persist before ack → no-dupe → intake → governed state → no external consequential action → observable → resume → ops health. | **HOLD** | Funnel HTTPS health 200; unauth POST **401**; local webhook health secretConfigured; email-ops healthy; queue done=3 pending=0; processor recovery succeeded; private digests MATCH; providers 4/4; fail-loud ALERT/RECOVERED banked; `source-providers.json` zapier active / outlook_connector DISABLED_NOT_CONFIGURED. | **blocking for this requirement:** two Outlook folder Zaps (Opportunities + Application Updates) not evidenced as live — automatic folder delivery does not start without them (private `ZAPIER-ACTIVATION.md`; public residual in funnel evidence). Local+Funnel half is capability, not completed automatic Outlook. Scheduled Email-0800/1200/1700 Ready but lastResult `0x41303` (never run) — processor proven via recovery only. |
| 4 | **Live Cockpit production + truthful CareerAIR operational view.** Normal route; Apps→CareerAIR; collector/last success/pending/oldest/processing/latest safe item; no_messages ≠ unhealthy ≠ consumer down; survives restart; browser journey. | **PASS** | Live `GET /` 200; `/private-apps.js` 58900 B with CareerAIR + email-ops/collector/pending/no messages/unhealthy markers; `/private-api/careerair/health` ok; overview counts; **email-ops** healthy with collector.up, consumer.ok, queue, latest_safe_item; private-api proxy present in archive `services/cockpit/server.mjs`; `node services/cockpit/private-apps-check.mjs` **245/245**; browser shoot artefacts under private `runtime/proof/cockpit-home/` (10 PNGs + index). | Non-blocking: shoot was earlier same day; live API re-verified at review time. |
| 5 | **Documentation / Git / private-boundary truth** (dispatch Gate 1 row 4). No secrets/email bodies in public Git; status honest. | **PASS** | Public evidence files process-level only; no webhook secret values / email bodies in Deliverables scan; authorised mailbox named only; private surface digests not secret material. Map statuses MOSTLY DONE / residual explicit — **no false VERITAS_PASS / phase closed claim** for this amended package. Head remotely reachable on `origin/build-020/phase4-automation-law`. | **CI at exact SHA:** required Actions (`secret-scan`, `private-apps`, `unit`/`db-proofs` / governor & control-plane PR checks) remain **queued** — **NOT RUN ≠ PASS**. Does not fail this documentation row (docs do not claim CI green); recorded under Git truth / residual. Codex remains prohibited until CI green + Gate 1 PASS. |

**Overall cannot be PASS:** mandatory requirement #3 is HOLD.

## Evidence provenance

- Isolated export of `reviewed_sha` at `C:\Users\Buggly\.grok\sessions\veritas-evidence-f0d2614`, created with `git archive f0d2614…` (flat tree; `Deliverables/`, `services/`, `Team/` present). Outside the repository.
- Repository `git rev-parse HEAD` at start / end — `f0d2614da5b71186f6e335552ed6b166d1327127` / `f0d2614da5b71186f6e335552ed6b166d1327127`, identical.
- Repository `git status --porcelain` — empty start and end (unchanged).
- No mutations applied inside the export (read/execute only).
- Live production probes against Warwick's intended ports (`127.0.0.1:8090`, `:8787`, `:8791`, Funnel host) — operational state, not archive-only.
- Private digests verified by `Get-FileHash SHA256` prefix-16 match (all 7 MATCH).

### Private digests (sha256 prefix 16) — MATCH at review

| Path under `C:\.fusion247\private\careerair\` | Expected | Observed |
|---|---|---|
| `src/email/endpoint.mjs` | `6cdfa9f84a19859b` | MATCH |
| `src/email/ops-state.mjs` | `6f81459b1d570142` | MATCH |
| `src/email/providers.mjs` | `a200b455cc7c3d7d` | MATCH |
| `scripts/careerair-ops-liveness.mjs` | `1a6b0aca363236fd` | MATCH |
| `scripts/ensure-local-services.mjs` | `6bd9a62244f8c402` | MATCH |
| `config/source-providers.json` | `18fd97b7c06dcd14` | MATCH |
| `runtime/INSTALLED-FROM.txt` | `dea4555c15a028d7` | MATCH |

Install marker records `public_repo_sha=3e888ee…`; tip `f0d2614` is docs-only after that install SHA — no public CareerAIR product code delta required for this head.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git rev-parse HEAD` + `git status --porcelain` | 0 | n/a | HEAD=`f0d2614…`; clean |
| `git branch -r --contains f0d2614` / `git ls-remote` | 0 | n/a | On `origin/build-020/phase4-automation-law` — **remotely reachable** |
| `git archive f0d2614` → evidence workspace | 0 | n/a | Isolation workspace created |
| Private SHA256 digests ×7 | 0 | 7 | All MATCH |
| `node services/cockpit/private-apps-check.mjs` (worktree=head) | 0 | **245** | PASSED 0 failed |
| `node --test tests/email/providers.test.mjs` (private) | 0 | **4** | All pass; zapier active; outlook DISABLED refuses |
| `GET http://127.0.0.1:8090/` | 200 | n/a | Cockpit home |
| `GET …/private-apps.js` | 200 | n/a | 58900 B; CareerAIR overlay markers present |
| `GET …/private-api/careerair/health` | 200 | n/a | ok, database reachable |
| `GET …/private-api/careerair/api/overview` | 200 | n/a | counts only |
| `GET …/private-api/careerair/api/email-ops` | 200 | n/a | healthy; collector up; consumer ok; queue done=3 pending=0; latest_safe_item caught_up |
| `GET http://127.0.0.1:8787/careerair/health` | 200 | n/a | secretConfigured true (length only) |
| `GET https://warwick-yoga.tailbc1fe3.ts.net/careerair/health` | 200 | n/a | Funnel live |
| `POST Funnel /careerair/email-intake` unauthenticated | 401 | n/a | Fail-closed auth |
| Scheduled tasks CareerAIR-* / MyPKA-Local-Services-Live | n/a | n/a | All Ready; Email tasks lastResult 267011=`0x41303` never run; supervisor lastResult 0 |
| Browser shoot private `runtime/proof/cockpit-home/` | n/a | 10 shots | Artefacts present; overview note overlay rendered |
| `gh` check-runs @ `f0d2614` | 0 | n/a | **secret-scan / private-apps / unit / db-proofs: queued**; Vercel comments success; Supabase Preview skipped |
| Public secret/body scan (grep at head) | 0 | n/a | No webhook secret assignments / JWT-like blobs in Deliverables careerair evidence; bodyText hits only unrelated BUILD-002/tower code |
| Banked packs at head | n/a | n/a | `2026-08-06-amended-wp-recon-evidence.md`, `2026-08-06-careerair-funnel-zapier-evidence.md` present on `f0d2614` |

**Unavailable / not executed:** Zapier UI Zap inventory (MCP has no Outlook Zap list tool; private activation doc states MCP cannot author Outlook Zaps). Live kill of webhook not re-run (fail-loud already banked; avoid production disturbance). Authenticated Funnel fixture POST not re-run this review (prior banked + queue done=3).

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | Package authorises automatic CareerAIR Outlook collection; automatic folder→pipeline not closed without Zaps. Durability classification + Cockpit ops goals met. |
| Design fidelity | **PASS** | Zapier transport (not Graph pull) matches accepted design; mutual-exclusion provider seam; private root outside PR; no CV/fit/submit redesign. |
| Functional proof | **HOLD** | Funnel→auth→persist→process path proven (banked + live health); **production Outlook discovery event not wired** until Zaps exist. |
| Integration | **PASS** | Cockpit→private-api→CareerAIR API; supervisor includes email; overlay email-ops; Funnel→:8787. Components on real journey, not test-only. |
| Durability | **PASS** | Private install marker + ops state + schtasks + supervisor Ready; queue durable (done=3). Residual: scheduled processor never auto-fired yet (recovery path proven). |
| Test quality | **PASS** | private-apps-check 245 executed assertions; provider suite 4/4 with mutual exclusion + disabled credential refuse. |
| Git truth | **HOLD** | Branch/head/remote accurate and clean; **required CI on exact SHA is QUEUED/NOT RUN — not PASS**. Do not claim green CI. |
| Documentation truth | **PASS** | Active WP statuses honest (MOSTLY DONE + residual); evidence packs match live probes; no false completion/closed claim for this amended Gate 1; no public secret/email-body leak found. |
| Residual risk | **PASS** | Residuals named, bounded, classified: Zaps (blocking for auto Outlook), CI queue (blocks Codex/merge readiness), scheduled processor never-run (non-blocking given recovery proof), next-WP Claude hooks, DR out of scope. |
| Completed automation | **HOLD** | **Mandatory.** Real production event for automatic Outlook is New Mail in Folder → Zap → Funnel → webhook. That chain is **not** complete without Zaps. Funnel + local receiver + fail-loud + ops liveness are **live capability** and fail-loud automation for the receiver — not completed automatic Outlook intake. Canonical bar: root `CLAUDE.md` § Nothing may live only in Larry's head. |

## Production caller and journey

**Intended automatic Outlook journey (accepted design):**
`Outlook rules → CareerAIR/Opportunities|Application Updates → Zapier New Message in Folder → HTTPS Funnel → POST /careerair/email-intake (shared secret) → durable queue (message.id idempotency) → scheduled processor 08:00/12:00/17:00 Europe/London → existing CareerAIR product path (no external submit).`

**Proven hops at this head:**
1. Funnel public HTTPS → local `:8787` (health 200).
2. Auth gate (401 unauthenticated).
3. Webhook intake process up (health secretConfigured).
4. Queue + processor recovery path (email-ops consumer ok; done=3).
5. Fail-loud ops liveness + bot ALERT/RECOVERED (banked).
6. Cockpit same-origin private-api → email-ops / overview / health.

**Missing hop for automatic Outlook:** Zapier event triggers from the two Outlook folders (account UI). Without it, eligible mail in folders does not invoke the pipeline.

**Not on the journey:** `outlook_connector` (DISABLED_NOT_CONFIGURED by design). Direct Graph pull rejected.

## Restart and durability

- Private runtime root `C:\.fusion247\private\careerair` with `runtime/INSTALLED-FROM.txt` and `runtime/ops/state.json` (collector_state=up; last_recovery_at set; queue_depth 0).
- Supervisor task Ready; ports 8090/8787/8791 listening.
- Processor schedule tasks Ready for next calendar slots; **have not yet executed on schedule** (lastResult never-run) — durability of schedule registration yes; schedule fire unproven this review.
- Kill/restart fail-loud banked in public funnel evidence + install marker note — not re-killed this review.

## Documentation contradiction scan

- Larry's declared DOCUMENT IMPACT (dispatch pointers): amended recon evidence, funnel/zapier evidence, Wayfinder ACTIVE SESSION WORK PACKAGE, private digests.
- Verified independently: packs present on `f0d2614`; WP residual language matches live residual; provider seam matches private JSON.
- **What his list did not need to hide:** CI still queued — correctly not claimed green in the packs reviewed.
- Active documents that would misdirect a fresh instance on **this** package frontier: none found that assert automatic Outlook complete or Gate 1 PASS for this head.
- Closure claims since last receipt for **this amended WP:** map says Veritas Gate 1 **NOT STARTED** at package write — consistent with this being the first Gate 1 on the amended scope. Prior Gate 1 PASSes on older heads/rows are banked mechanism evidence only, not this package acceptance.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D-1 | high | Automatic Outlook folder delivery not closed: two Zapier Zaps (CareerAIR/Opportunities + Application Updates → Funnel intake) not evidenced as live. Production event does not yet invoke the pipeline. | **blocking** — blocks Gate 1 PASS / completion claim for CareerAIR auto-intake requirement #3; does **not** block unrelated safe implementation on other routes | Larry / Warwick account action for Zap UI |
| D-2 | medium | Required GitHub Actions on exact SHA `f0d2614` still **queued** (secret-scan, private-apps, unit, db-proofs; PR governor/control-plane also queued). NOT RUN ≠ PASS. | **blocking** for Codex invocation and merge-readiness statements that require CI green; **non-blocking** for continuing safe local product work | Larry (wait/recheck); runner capacity |
| D-3 | low | CareerAIR-Email-0800/1200/1700 lastResult `0x41303` (never run). Processor path proven via recovery only. | **non-blocking** given recovery success + tasks Ready | Larry — observe first scheduled fire or park |
| D-4 | low | Private install marker pins public SHA `3e888ee` not tip `f0d2614` (docs-only delta). | **non-blocking** | optional re-stamp after product private delta |

## Verdict

**HOLD** — amended Gate 1 Work Package is substantially integrated for durability classification, residuals disposition, Cockpit+email-ops visibility, Funnel/local receiver/fail-loud, and private-boundary documentation honesty, but **mandatory automatic Outlook intake is not complete** while Zapier Zaps remain residual, and **required CI has not passed on this exact SHA**.

**Not Phase 4 PASS. Not merge authority. Not Codex authorisation.**

### Per-row summary (dispatch numbering)

| Dispatch # | Topic | Verdict |
|---|---|---|
| 1 | Durability / promotion readiness | **PASS** |
| 2 | CareerAIR auto Outlook + pipeline | **HOLD** |
| 3 | Cockpit + CareerAIR ops view | **PASS** |
| 4 | Documentation / Git / private-boundary | **PASS** (CI NOT RUN recorded separately under Git truth HOLD) |

WP functional row 2 (residuals disposition): **PASS** (widened).

## Next review trigger

Resubmit **a new exact integrated head** (do not amend this receipt) when:

1. Evidence that both Outlook-folder Zaps deliver into Funnel intake **or** Warwick explicitly reclassifies automatic Outlook to a bounded manual residual for this package; **and**
2. Required workflows on that head show **success** (not queued/skipped-as-absent); **and**
3. Private digests / live email-ops re-verified if private surface changed.

Gate 2 remains a **separate** receipt and is not discharged by this Gate 1 HOLD or by any future Gate 1 PASS alone.
