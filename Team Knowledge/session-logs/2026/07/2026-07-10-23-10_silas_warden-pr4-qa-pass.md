---
agent_id: silas
session_id: warden-pr4-preqa-2026-07-10
timestamp: 2026-07-10T23:10:00Z
type: end-of-session
linked_sops: [SOP-010-warden-extract-source-to-evidence-pack, SOP-011-warden-meeting-prep]
linked_workstreams: []
linked_guidelines: [GL-006-client-delivery-frontmatter-conventions]
---

# Pre-merge QA pass on PR #4 (Warden/Client Delivery), relayed from Fable

## What I did

The user relayed a pre-merge QA review from "Fable" — a manually-run Claude instance
used as external QA, not a myPKA agent, but treated as well-reasoned. Reviewer was
explicit this was a focused cross-file consistency pass, not scope expansion: fix
genuine contradictions, document the rest as blocking / non-blocking /
deliberately-deferred findings, do not build new schema speculatively. Ran all five
checks. Full account is decision 13 in
`Team Knowledge/tasks/in-progress/tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden.md`.

1. **"One combined register" wording — blocking, fixed.** Warden's contract had four
   places that read like the register was one document, worst of all a Deliverable-
   structure bullet that literally said "one combined, reviewed **document** per
   engagement." GL-006 §3 already had the correct model. Standardized Warden's contract
   (Core philosophy #2, routing table, Method step 3, Deliverable structure, Critical
   rule 8) on: "one canonical logical register per engagement, implemented as
   independently referenceable Register Item files within one governed register folder."
   Retired GL-006 §3's literal quote of Warden's old phrase so it doesn't cite text that
   no longer exists.
2. **Writer-never-self-verifies vs. machine-queryability — non-blocking, documented,
   not built.** Checked whether "which Register Items are unverified" is answerable
   today. It isn't: no `created_by`/`review_status`/`reviewed_by`/`reviewed_date`
   fields; git history is useless (every commit in this repo is authored by one generic
   identity, confirmed via `git log`, regardless of which specialist voice wrote the
   content); session logs have `agent_id` but link to a Register Item only by prose, not
   a structured FK. Wrote it up honestly in a new GL-006 §"Known gaps" section. Did not
   add the fields — the reviewer was explicit about this.
3. **Internal vs. client vs. third-party owner — non-blocking, documented + one SOP
   wording fix.** `owner` alone carries no side info. Client-side is partially
   derivable (cross-reference against `client_contacts`/`linked_stakeholders`/`company`
   vs `client_org`, all optional). Internal-vs-third-party isn't derivable at all —
   no such concept exists anywhere in the schema. Documented in the same GL-006 §"Known
   gaps" section. Tightened `SOP-011-warden-meeting-prep` §4's "Who owns what" bullet,
   which previously implied a clean read straight off `owner` — now states the actual
   best-effort method and adds a "side unknown" outcome.
4. **Standalone Action entity gap — deliberately deferred, flag tightened.** SOP-010
   and SOP-011 already agreed with each other on the workaround. The one real gap: GL-006's
   own "Future extension candidates" list never actually included it, despite GL-006
   being the file that owns that list. Added an `Action` bullet there. No new entity or
   field built.
5. **Evidence Pack under `Sources (Immutable)/` — blocking, fixed with a real
   relocation.** Judged this a genuine hazard, not cosmetic: the pack is
   documented-mutable (`## Reread log` gets appended) but lived inside a folder named
   "Immutable." Also found GL-006 itself never actually recorded this location decision
   — it lived only in SOP-010, an undocumented architecture call outside SOP-010's own
   lane. Relocated the Evidence Pack to its own top-level `Evidence Packs/` folder,
   sibling to `Sources (Immutable)/`, and made GL-006 the canonical source of the
   decision (not SOP-010). Updated consistently: GL-006 (folder map, new paragraph,
   v1.2 version history), SOP-010 (Output line, Location, Tier-reasoning paragraph,
   worked example, Common mistakes), `Client Delivery/INDEX.md` (new folder bullet).

## Files touched

- `Team/Warden - Delivery Manager/AGENTS.md` — "combined register" wording standardized
  in 5 places (Core philosophy #2, routing table, Method step 3, Deliverable structure,
  Critical rule 8).
- `Team Knowledge/Guidelines/GL-006-client-delivery-frontmatter-conventions.md` — v1.1 →
  v1.2. Evidence Pack relocated + explained (folder map + new paragraph), retired stale
  quote in §3, new §"Known gaps" (writer-verification + owner-side), `Action` /
  `owner_side` / verification-metadata added to "Future extension candidates",
  version-history entry.
- `Team Knowledge/SOPs/SOP-010-warden-extract-source-to-evidence-pack.md` — Output line,
  Location line, Tier-reasoning paragraph, worked example, Common-mistakes bullet, all
  updated for the Evidence Pack's new location.
- `Team Knowledge/SOPs/SOP-011-warden-meeting-prep.md` — §4 "Who owns what" bullet
  rewritten to state the actual owner-side derivation method and its limits.
- `Client Delivery/INDEX.md` — new "Evidence Packs" bullet in the intended per-engagement
  structure list.
- `Team Knowledge/tasks/in-progress/tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden.md`
  — decision 13 + Updates line.

**SOP-012, SOP-013, SOP-014 read in full, confirmed clean — no edits.**
`Team Knowledge/Templates/engagement.md` and `register-item.md` checked for stale
"combined register" or Evidence Pack path references — none found.

## What the next agent must know

- The Evidence Pack's canonical home is now `Client Delivery/<engagement-slug>/Evidence Packs/<source-slug>-evidence-pack.md`
  — GL-006 owns this decision going forward, not SOP-010. If SOP-010 is ever forked or a
  new meeting-intelligence SOP is added, point it at GL-006's folder map, don't
  re-derive the path locally.
- `owner_side` and verification metadata (`created_by`/`review_status`/`reviewed_by`/
  `reviewed_date`) are both real, documented gaps in GL-006 §"Known gaps" — do not build
  either speculatively. Wait for a second real engagement to make the case, same
  sequencing discipline as the rest of GL-006's future-extension candidates.
- No engagement exists yet (`Client Delivery/` is still a stub), so none of this pass
  touched real entity data — purely schema/doctrine/prose layer.
