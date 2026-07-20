# Tower Product-Contract — Revised Design v2 (schema · state machine · proof plan)

**Status: design for Warwick's approval. No prompts/schema/workflow changed.** Incorporates Warwick's nine contract-gap refinements (2026-07-20) on top of the v1 recommendation. Architecture approved in principle; this closes the gaps before implementation.

## How each refinement is closed
1. **acceptance_row is the canonical acceptance source.** Criteria live ONLY in `acceptance_row`. The PRD holds narrative (journey, non-goals, good-enough) and *references* rows by id — no editable criteria duplicated in PRD JSON.
2. **Full Implementation Plan authoritative in the Build/MyPKA layer, not Foundry.** Supabase stores only the plan's `version_no`, `content_hash`, a `plan_ref` (MyPKA/GitHub link), and the machine-checkable elements (WP list, risk triggers, live gates). The prose plan lives in MyPKA.
3. **Immutable draft/approved/superseded versioning; everything binds to exact versions.** PRD and Plan are append-only versioned rows; a checkpoint/verdict/merge-gate records the exact `prd_version_id` + `plan_version_id` it was evaluated against; a new approved version **supersedes** the prior and **stales** every approval/verdict/gate bound to the old version.
4. **Complete Foundry→Build promotion transaction + approval state** — the state machine below; the promotion commit is atomic.
5. **Explicit WP→PR→checkpoint→SHA→acceptance/finding relationships** — FKs specified below.
6. **Builder evidence ≠ Codex verification.** `acceptance_row` splits `claimed_evidence` (builder) from `verified_result` (Codex). A builder can attach claimed evidence but **cannot** set `verified_result=pass`; only a verifier principal can, and `verified_by <> claimed_by` is enforced.
7. **Codex review packet includes the approved Plan, exclusions, risk profile and Warwick decisions** — not only PRD/acceptance/findings.
8. **Assurance + auto-merge eligibility computed explicitly per WP/checkpoint** — an explicit `auto_merge_eligible` flag, never inferred from "gates are green."
9. **Normalised finding schema** with correction/verification/gate/defer authority on every finding; **PR status is a derived cockpit view, not stored in the ledger.**

---

## Revised minimum schema (extends the merged `ops` schema)
Reuse existing: `build`, `checkpoint`, `verdict`, `merge_gate`, `agent_event`, `command_request`, `git_sha` domain.

**`build`** (extend): `+ title, idea_ref, outcome, owner, status, risk_tier, authorised_scope, exclusions, data_boundaries, current_prd_version_id, current_plan_version_id, promotion_state`.

**`prd`** (immutable, versioned): `id, build_id, version_no, state ∈ {draft,approved,superseded}, narrative (journey/non-goals/good-enough/needs-warwick), content_hash, approved_by, approved_at, superseded_by_version_id, created_at`. *No acceptance criteria here.*

**`plan`** (immutable, versioned): `id, build_id, version_no, state ∈ {draft,approved,superseded}, plan_ref (MyPKA/GitHub authoritative), machine_elements jsonb {wp_list, risk_triggers, live_apply_gates, permitted_parallel}, content_hash, approved_by, approved_at, superseded_by_version_id`.

**`wp`**: `id, build_id, plan_version_id (FK), name, risk_tier, assurance_required ∈ {codex, codex+fable}, auto_merge_eligible bool, live_apply_gate bool`.

**`acceptance_row`** (canonical acceptance source): `id, build_id, prd_version_id (FK), requirement_text, owning_wp_id (FK), expected_proof, impl_path, claimed_evidence_ref, claimed_by, verified_result ∈ {pending,pass,fail}, verified_by, verified_sha, disposition, open_finding_ids[]`. Constraint: `verified_result` mutable only by a verifier principal AND `verified_by <> claimed_by`.

**`pr`**: `id, wp_id (FK), github_pr_number, current_head_sha, state`.

**`checkpoint`** (extend): `+ wp_id, pr_id, prd_version_id, plan_version_id` — bound to the exact head SHA (existing) AND the exact contract versions.

**`verdict`** (extend): `+ prd_version_id, plan_version_id, contract_stale bool` — a verdict is stale if its contract versions are superseded.

**`finding`** (normalised ledger): `id, build_id, wp_id, checkpoint_id, first_reported_sha, reviewer, description, impact, reachability, disposition, merge_blocker bool, correction_sha, correction_authority, verification_reviewer, verification_sha, verification_authority, gate_authority, defer_authority, state ∈ {open,fixed,deferred_to_gate,rejected,superseded}`. **PR/merge status is NOT stored here** — it is a derived cockpit view computed from checkpoint + verdict + acceptance_row + finding.

**Relationships (5):** `build 1─* wp 1─* pr 1─* checkpoint(*head_sha, *contract versions)`; `wp 1─* acceptance_row`; `checkpoint 1─* verdict`; `checkpoint/wp 1─* finding`; `acceptance_row *─* finding` (open_finding_ids).

---

## Promotion state machine (Foundry → Build)
```
idea (Foundry)
  │  Larry drafts, in ONE atomic transaction:
  │    build(promotion_state=drafting) + prd(v1,draft) + plan(v1,draft) + acceptance_row(s)(pending)
  ▼
promotion_proposed
  │  Warwick reviews PRD narrative + acceptance rows + plan machine-elements + scope/exclusions/risk/gates
  ▼
awaiting_warwick_approval ──reject/amend──► back to drafting (new draft versions)
  │  Warwick approves
  │  atomic commit: prd v1→approved, plan v1→approved, build.current_*_version set, status=active
  ▼
active ──amendment──► new prd/plan draft → approve → supersede prior
  │                    (supersession STALES every verdict/gate bound to the old version;
  │                     affected checkpoints require re-verification at the new version)
  ▼
delivered → (live gates) → live | closed
```
The promotion **commit is atomic**: a build never exists half-promoted (approved PRD without approved Plan, or without seeded acceptance rows). Foundry keeps only a pointer: *"IDEA-N promoted → build record <id>."*

---

## Assurance + auto-merge eligibility (explicit, per WP)
- `wp.assurance_required` is computed at promotion from the WP's risk triggers: **`codex+fable`** if the WP touches any of {credentials, auth/permissions, private/health data, live DB writes, public endpoints, autonomous commands, merge authority, irreversible actions, exactly-once/concurrency, material availability, Warwick "stress-test"}; else **`codex`**.
- `wp.auto_merge_eligible` is an **explicit** boolean set at promotion (risk-tier permits + reversible + no standing Warwick gate). It is *never* inferred from green gates.
- **Auto-merge fires only when ALL are mechanically true:** `auto_merge_eligible=true` AND PR current with main AND `current_head == CI-tested head == Codex-verified head` AND every `acceptance_row` for the WP `verified_result=pass` (by a verifier, not the builder) AND no open `merge_blocker` finding AND no unresolved prior finding AND no pending Warwick decision/live gate AND the bound contract versions are current (not superseded).
- Higher-risk WPs: Fable and/or Warwick remain in the gate regardless.

---

## Bounded proof plan — TubeAIR YT→packet pipeline (one build, before rollout)
Chosen because the user journey is crisp and testable ("paste a YouTube link → get a Karpathy packet"), and its code already exists + is reviewed.

1. **Author the contract (Warwick approves):** a Build record + PRD (journey/non-goals/good-enough) + `acceptance_row`s (canonical criteria, e.g. "a pasted link yields an 8-section packet", "raw transcript preserved verbatim", "immutable source untouched", "cleaned view readable, no lost words") + Plan machine-elements (WPs, risk triggers — note: no live-DB/credential trigger for the local-capture WP, so `assurance_required=codex`).
2. **Stand up the minimal schema** (the tables above) for this one build only.
3. **Wire the Codex review packet** to consume PRD + acceptance_rows + open findings + approved-plan-elements + exclusions + risk-profile + Warwick decisions (refinement 7).
4. **Run one review round** at a real head: Codex verifies each `acceptance_row` (builder cannot self-pass); findings land in the normalised ledger with authority fields.
5. **Prove the two anti-drift properties:** (a) "approved" now means *every acceptance row verified-pass at the reviewed SHA + no open blocker + journey evidenced* — and a GPT pass on the same head finds nothing obvious; (b) **amend one acceptance row → confirm the prior verdict goes `contract_stale=true`** and the checkpoint requires re-verification.
6. **Only if both hold, roll the contract out** to other builds. Cockpit page (state badges + acceptance matrix + findings + verdicts + CI + decisions) is built after the proof passes.

**First implementation slice (once approved):** the `finding` + `acceptance_row` tables + the contract-versioning + the Codex packet wiring — the smallest set that makes the proof runnable. Everything else (cockpit, auto-merge executor) follows the passing proof.
