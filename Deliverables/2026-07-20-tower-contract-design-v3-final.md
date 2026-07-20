# Tower Product-Contract — Final Design v3 (access contract · cockpit IA · schema · proof)

**Status: final design for Warwick's approval. No prompts/schema/workflow changed — implementation only after sign-off.** Folds v2 + Warwick's final pass: (1) a first-class reviewer access contract, (2) cockpit + latest-news IA, (3) schema normalisation refinements, (4) an expanded TubeAIR proof.

Agreed principle behind the whole pass: **Codex and Fable must review the same canonical evidence packet, against the same exact code head and contract versions, with direct read-only access to the underlying evidence — never a Larry summary, local Yoga files, ClickUp discovery, Directus scraping, a partial pasted prompt, or leftover session context. Directus is the *human* cockpit, not the reviewer data source.**

---

## PART A — Reviewer access contract (the trust core)

### `review_packet` (first-class, versioned, hashed)
The precise object dispatched to either reviewer. Both reviewers get the **same** `review_packet_id`; only the *prompt* differs (Codex product-QA vs Fable adversarial), never the evidence.
```
review_packet
  id · build_id · wp_id · pr_id · checkpoint_id
  exact_head_sha · base_sha                     (frozen review target)
  prd_version_id · plan_version_id              (exact approved contract)
  assurance_profile                             (from checkpoint_assurance, Part B)
  acceptance_row_ids[] · open_finding_ids[]     (resolved snapshot, ids only)
  warwick_decision_ids[]
  github_evidence_refs (repo, PR, base..head diff, files, tests)
  ci_evidence_refs (Actions run ids + logs)
  packet_hash                                   (hash of the resolved canonical contents)
  created_at · state (building|ready|blocked|consumed|stale)
```
Reviewer access to the *content* is by **direct read-only** GitHub (source, diff, Actions) + **dedicated Supabase reviewer views/RPCs** (contract, acceptance, findings, decisions, prior reviews) — never Directus, never a prose summary.

### Fail-closed dispatch
Before dispatch, Tower must prove the reviewer runtime can resolve every required source: `Build · PRD version · Plan version · WP · acceptance rows · previous findings · Warwick decisions · repo · PR · exact head · base..head diff · tests · CI`. If **any** is unresolvable → packet `state=blocked`, outcome `BLOCKED — review evidence incomplete`. **Never "review the available bits and assume the rest."**

### `review_run` (proves what the model actually reviewed)
Every review records:
```
review_run
  id · review_packet_id · reviewer_principal · model_provider · model_id
  prompt_version · prompt_fingerprint · packet_hash
  reviewed_head_sha · prd_version_id · plan_version_id
  started_at · completed_at · outcome
  evidence_accessed[] · findings_opened[] · findings_closed[]
```
Bound to `packet_hash` + exact SHA + contract versions, so "Tower approved" is provably an approval of a *specific* evidence set, not a vibe.

---

## PART B — Assurance at checkpoint level (not just WP)
A WP may begin a harmless local formatter and later gain a public endpoint, live data, an autonomous command, credentials, or a persistent worker. So the WP is the **baseline**; the actual checkpoint/diff computes the **final** required reviewers.
```
checkpoint_assurance
  checkpoint_id
  codex_required · adversarial_review_required · security_review_required
  warwick_approval_required · auto_merge_eligible
  triggers[]                (which surfaces the diff actually touched)
  calculated_at · policy_version
```
Computed from the diff's touched surface against the risk-trigger policy. Prevents a low-risk WP classification being reused after the implementation touches a higher-risk surface. `auto_merge_eligible` stays **explicit** (never inferred from green gates).

---

## PART C — Schema normalisation refinements (Warwick's)
- **`acceptance_row` is immutable** (the requirement only): `id, build_id, prd_version_id, requirement_text, owning_wp_id, expected_proof, impl_path`. No mutable evidence/result fields.
- **`acceptance_evidence`** (append-only, builder claim): `acceptance_row_id, checkpoint_id, submitted_by, evidence_type, evidence_ref, exact_sha, created_at`.
- **`acceptance_verification`** (append-only, reviewer): `acceptance_row_id, checkpoint_id, reviewer, result ∈ {pass,fail,partial,blocked,not_applicable}, rationale, exact_sha, prd_version_id, plan_version_id, created_at`. **Only a reviewer principal writes these; the builder cannot.** Current acceptance state = the latest valid `acceptance_verification` bound to the *current* contract + head → automatic invalidation after head/contract movement.
- **`acceptance_finding`** join table replaces `open_finding_ids[]`: `(acceptance_row_id, finding_id)` — proper many-to-many, constrainable, no array drift.
- **`contract_stale`** is **system-derived / system-controlled** — never agent-editable (computed from version supersession).
- **`pr.current_head_sha`** is labelled a **cached GitHub value** (GitHub authoritative); the **checkpoint** stores the exact frozen review target.

---

## PART D — Final minimum schema (consolidated)
Reuse: `build`, `agent_event`, `command_request`, `git_sha` domain, `merge_gate`.
New/extended: `prd` (immutable versioned), `plan` (immutable versioned, MyPKA-authoritative + machine elements), `wp` (baseline risk/assurance), `acceptance_row` (immutable requirement), `acceptance_evidence` (append-only), `acceptance_verification` (append-only), `acceptance_finding` (join), `pr` (cached head), `checkpoint` (bound to head + contract versions), `checkpoint_assurance` (computed profile), `verdict` (+ contract binding + derived stale), `finding` (normalised, authority fields), `review_packet`, `review_run`.
**First implementation slice (once approved):** `acceptance_row` + `acceptance_evidence` + `acceptance_verification` + `finding` + `acceptance_finding` + `review_packet` + `review_run` + `checkpoint_assurance` — the minimum that makes the fail-closed reviewer contract runnable for the proof.

---

## PART E — Cockpit + Latest-News IA (Directus, derived from the event ledger)
**No manually maintained `latest_news` table.** The program feed + Build timeline are **derived from the append-only `agent_event` ledger + domain events** — one source, many views.

### Program homepage
Top summary: **active builds · items needing Warwick · merge-ready PRs · blocked work · live-service warnings.**
**Latest News (default last 10)** — each item: `time · Build/WP · plain-English headline · state {to do|done|waiting|failed|decision needed} · importance · actor · deep-link to the exact object`.
Example: `09:40 · TubeAIR · PR #47 merged at f07873e · DONE · [Open PR][Open Build]`.
Filters: `to do / done / decision-needed / failed`, Build, date range, event type, importance.
Event types: build promoted · PR opened · checkpoint submitted · CI passed/failed · review started/completed · finding opened/fixed/deferred · acceptance passed/failed · Warwick decision requested/resolved · merge-ready · merged · live-ready · live activation · failure/recovery/rollback.

### Build page
1. Outcome + approved contract · 2. State badges (`built→review-ready→QA-approved→assurance-approved→merge-ready→merged→live-ready→live`) · 3. PRD + Implementation Plan · 4. WP dependency/status · 5. Acceptance/evidence matrix · 6. Open findings + dispositions · 7. PRs, exact heads, CI · 8. Codex/Fable review history (`review_run`s) · 9. Warwick decisions/live gates · 10. Detailed Build timeline (= the same event feed filtered by `build_id`). Every item deep-links to Build/WP/PR/checkpoint/review/finding/acceptance-row/decision/report.

### "Why isn't this ready?" — mandatory explainer
The cockpit must never show a bare `NOT MERGE-READY`. It must state the reasons, e.g.:
```
Not merge-ready because:
- AC-04 has no Codex verification at the current head
- Fable is required but has not reviewed checkpoint CP-019
- Finding F-046-A remains open
```
or the positive form:
```
Merge-ready: 8/8 acceptance rows passed · Codex approved exact head · Fable not required
· CI green · 0 open blockers · branch current with main
```
Computed from acceptance_verification + checkpoint_assurance + findings + merge_gate — so no one has to ask Larry or GPT to interpret the machinery.

---

## PART F — Expanded TubeAIR proof plan
Base (from v2): author Warwick-approved contract; stand up minimal schema; wire the fail-closed `review_packet`; run one round; prove approval = acceptance-verified-at-head. **Plus these explicit tests:**

**Reviewer-access proof**
- Codex and Fable receive the **same `packet_hash`**; both resolve source, PRD, plan, acceptance rows, findings.
- **Remove one required evidence pointer → review must return `BLOCKED`** (fail-closed).
- **Change the PR head after packet creation → the review/merge gate must stale.**
- **Supersede the PRD → the prior `acceptance_verification` must stale** (contract-bound invalidation).

**Product-QA proof**
- Deliberately leave one ordinary user-journey acceptance criterion unmet → **Codex identifies it before hunting exotic defects** (proves the QA-not-pentest orientation is wired, not just prompted).

**Risk-routing proof**
- A low-risk checkpoint computes `codex_required=true, fable_required=false`.
- Add a synthetic autonomous-command / permission touch to the diff → Tower **automatically** recomputes `codex + fable + Warwick gate required` at checkpoint level (Part B).

**Cockpit proof**
- Before declaring the proof passed, all of the following must be visible: the TubeAIR Build at program level · latest activity in Latest-News · the Build page · current PRD/Plan · acceptance matrix · findings · reviewer evidence (`review_run`) · the plain-English why-ready/why-not · the complete activity timeline.

---

## What this buys
One append-only event source feeds the 10-item news feed, the Build timeline, notifications, audit, and "what changed overnight?". The reviewers see the *same authoritative reality* (fail-closed, hashed, contract-bound) rather than a beautifully-written partial story. And you can see, at a glance and in plain English, exactly why anything is or isn't ready — without asking me or GPT to interpret it.
