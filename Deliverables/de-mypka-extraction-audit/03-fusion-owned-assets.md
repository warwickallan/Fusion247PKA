# 03 — Fusion-Owned Assets

Independently developed Fusion assets, candidates for future extraction. An item appears here only where
evidence supports independent creation (confirmed absent at the import commit, or overwhelmingly rewritten
since with a documented Fusion origin story) — not merely a different filename on upstream structure.
**Provenance mixed with upstream/personal material is flagged explicitly, not hidden**, per instruction not to
describe anything as cleanly extractable where it isn't.

## 1. The delegation/orchestration doctrine (Larry — C007)

**Evidence of independent creation:** `Team/Larry - Orchestrator/AGENTS.md` grew from 186 to 487 lines
(+313/-12) since import. Every added section carries an explicit dated origin story tied to a real incident
(e.g. §8a "CI truth is exact-head evidence," added 2026-07-28, cites the specific `build-002-tests/gateway`
failure this session found and fixed; the Operating Doctrine §1–10, added 2026-07-27, cites
`Deliverables/2026-07-27-pax-delegation-failure-modes.md`).
**Current dependencies:** Cross-references dozens of Fusion SOPs by number; assumes a Claude-Code-style
subagent dispatch mechanism (`run_in_background`, worktree isolation) as its execution substrate.
**Can it move unchanged?** No. It is written in first person as "Larry," addressed to a specific host
runtime's tool surface, and references this repository's own paths throughout.
**Refactoring required:** Substantial — the *principles* (outcome ownership, tight-outcome/loose-method,
ephemeral worker commissioning, escalate-vs-decide split, exact-head CI evidence) are portable; the prose is
not. Rewrite as a neutral orchestration-doctrine document, not tied to any one persona name.
**Third-party licence dependencies:** None found in the doctrine content itself.
**Warwick-specific contamination:** Moderate — the doctrine references "Warwick" directly throughout as the
principal, and cites Fusion-specific incidents by date. A reusable version needs the principal genericised.
**Target location:** `CORE/orchestration` — this is the single richest, most battle-tested piece of design in
the whole repository.

## 2. Foundry-to-Build governance corpus (SOP-010–014, GL-006 — C011/C012 subset)

**Evidence:** All 5 SOPs + GL-006 confirmed absent at import; each cites a specific delivery-methodology
concern (evidence-pack chain of custody, meeting-summary anti-embellishment, consultant-summary/fact
separation) with worked examples.
**Current dependencies:** `Client Delivery/` folder structure, Warden specialist.
**Can it move unchanged?** No — cites `Client Delivery/` paths directly and assumes the Warden persona.
**Refactoring required:** Moderate. The schema (GL-006's frontmatter contract for Register Items/Work
Packages/Evidence Packs) is close to directly portable; the SOP prose needs genericising.
**Third-party licence dependencies:** None found.
**Warwick-specific contamination:** Low in the governance rules themselves; the one populated instance
(`Client Delivery/meridian-pos-modernisation/`) is confirmed synthetic proof data, not real client content —
but see the licensing caveat below before packaging this as a commercial capability.
**Target location:** `PACKS/business-operations`.

## 3. Idea Intelligence pipeline (Arc, Cairn, Mason + SOP-015/016, GL-008/011 — C008/C011/C012 subset)

**Evidence:** All three specialist contracts confirmed absent at import (Arc 73 lines, Cairn 159 lines, Mason
71 lines); SOP-015/016 and GL-008/011 confirmed absent, each describing a specific pipeline stage
(classify-and-file external sources → chunk-map transcripts → govern source-classification vocabulary →
retain immutable raw evidence).
**Current dependencies:** `Team Knowledge/Sources/` folder structure, `tools/tubeair/*` (TubeAIR extractor,
outside this asset's own boundary but its documented upstream feeder).
**Can it move unchanged?** No — the specialist contracts reference this repo's specific folder paths and the
Fusion-specific "review_state" frontmatter convention.
**Refactoring required:** Moderate. The three-stage pipeline concept (recognise → analyse → transfer/propose,
per Arc's contract) is a clean, reusable pattern.
**Third-party licence dependencies:** **Real one to flag** — the pipeline's raw-evidence store currently
contains verbatim third-party YouTube transcripts (see `09`). A reusable version of this pipeline pattern is
clean; the *populated instance* in this repo carries a real, unresolved copyright question that must not be
copied forward without resolving it first.
**Warwick-specific contamination:** Low in the pipeline design; the actual `Team Knowledge/Sources/` content
is Warwick's captured material and should not travel with the pattern.
**Target location:** `PACKS/research` / `PACKS/knowledge`.

## 4. Exact-head merge-QA gate (`services/control-plane/tower/merge-check.mjs` + supporting migrations — C023 subset)

**Evidence:** No upstream equivalent exists at all; this is the fourth of four documented internal generations
(see `05` for the full supersession chain), the current canonical implementation, still receiving commits as
of today's own session (`db29c09`).
**Current dependencies:** Postgres schema (`ops.canonicalize_sha`, `ops.git_sha` domain,
`ops.advance_build_head`), `gh` CLI, a QA-reviewer adapter (currently Codex CLI-shaped).
**Can it move unchanged?** No — tightly coupled to this repo's specific Postgres schema and GitHub org.
**Refactoring required:** Moderate-to-substantial. The *design* (bind every verdict to a canonicalised exact
SHA, fail closed on missing build_ref/repo/PR/head, re-verify immediately before any merge action) is genuinely
novel and worth reimplementing provider-agnostically (the reviewer adapter is already an adapter pattern —
good sign for portability).
**Third-party licence dependencies:** `pg` (PostgreSQL client, MIT) — permissive, no concern.
**Warwick-specific contamination:** Low — the design is domain-neutral; only the deployment specifics
(Postgres connection, GitHub org) are instance-specific.
**Target location:** `CORE/audit-and-qa`. This is the strongest single piece of infrastructure-grade design in
the repository and should anchor the new core's QA/governance layer.

## 5. Worker-agent commissioning pattern (SOP-021/022, `services/control-plane/worker/*` — C011/C023 subset)

**Evidence:** SOP-022 ("Work Order Preflight") confirmed absent at import, explicitly cites a post-mortem on
two named defective Work Orders (W01/W02) as its origin. SOP-021 (weekly AsdAIr shop) is the concrete worked
example; `services/control-plane/worker/*` is the durable job/queue runtime that executes the pattern.
**Current dependencies:** Postgres-backed job queue; the AsdAIr domain as its proving ground.
**Can it move unchanged?** Partially — the queue/runtime code is fairly generic; the SOP text is not.
**Refactoring required:** Light for the runtime, moderate for the doctrine text.
**Third-party licence dependencies:** `pg` only.
**Warwick-specific contamination:** Low.
**Target location:** `CORE/agent-framework` (the commissioning discipline) + the runtime code itself is a
genuine `CORE` candidate too.

## 6. Channel-neutral capture intake pattern (`services/fusion-capture-gateway/`, `services/hub/` — C025/C028)

**Evidence:** Both confirmed wholly Fusion-built (no upstream equivalent), with dedicated CI, a documented
"channel-neutral" design goal (Telegram-first today, designed for other channels), and a durable operational
store separating intake from processing.
**Current dependencies:** Telegram Bot API, a Supabase edge function (`fcg-webhook-intake`), `services/hub`'s
governed vault writer.
**Can it move unchanged?** No — channel credentials and the vault-write target are instance-specific by
design, but the adapter boundary is already correctly drawn.
**Refactoring required:** Light. This is the best-isolated, most adapter-shaped code in the repository — the
channel/vault seam is already where a clean-room boundary should sit.
**Third-party licence dependencies:** `pg` only, per package.json census.
**Warwick-specific contamination:** None found in the code itself; Warwick-specific values live entirely in
gitignored env config, confirmed by the `.gitignore` sweep in `06`.
**Target location:** `CORE/adapters`.

## 7. Client Delivery capability, as a design (GL-006 + Warden — separate from the licensing question)

Covered under item 2 above for the governance corpus; called out again here specifically to flag: **do not
describe this as cleanly extractable without resolving Finding #1 in `09-licence-and-provenance-risk-register.md`
first.** The design itself (evidence packs, work packages, a decision register) is genuinely Fusion-owned and
well-formed. Whether it is safe to operate commercially inside material derived from a NonCommercial-licensed
base is a legal question this audit cannot resolve.

## Assets deliberately NOT listed here

- `services/cockpit/` and `services/obsidiwikai/` — genuinely Fusion-owned (confirmed via `01`), but both lack
  CI coverage and their "no external licence entanglement" self-declarations were only spot-checked, not
  independently verified line-by-line. Real candidates, listed in `01`/`04`, but held back from this "ready to
  extract" list until that verification gap closes.
- `services/fusion-tower/`, `services/tower-baton/` — Fusion-owned but superseded; see `05` for disposition.
