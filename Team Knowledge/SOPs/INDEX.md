# SOPs - Index

**SOPs are agent skills.** Each SOP is a canonical procedure — a step-by-step recipe for one job. They are LLM-agnostic and reusable across agents: an SOP has a **default owner** (the specialist who runs it most often), but any agent can invoke an SOP when they need its procedure. Think of SOPs the way Claude skills work — discrete, named, callable.

Filename pattern: `SOP-NNN-<title>.md`. See [[GL-001-file-naming-conventions]] for slug rules. Numbering follows authorship order, not topic — gaps are intentional and reserve slots for future agents.

## Active SOPs

| SOP | Title | Default owner | Description |
|---|---|---|---|
| SOP-001 | [[SOP-001-how-to-add-a-new-specialist]] | Nolan | Step-by-step procedure to draft and onboard a new team specialist. References [[GL-001-file-naming-conventions]]. |
| SOP-002 | [[SOP-002-convert-mypka-to-sqlite]] | Silas (run by the user via paste-into-LLM prompt) | Generate a SQLite mirror of your myPKA on demand. Markdown stays canonical; SQLite is a derived performance layer. Body is a paste-into-LLM prompt. |
| SOP-003 | [[SOP-003-felix-build-a-component]] | Felix | Build a UI component end-to-end on the team's design system. *(App Developer Pack — preinstalled in v3.0.0)* |
| SOP-004 | [[SOP-004-vex-security-audit]] | Vex | Run an application-layer security audit / "safe to ship" review. *(App Developer Pack — preinstalled in v3.0.0)* |
| SOP-005 | [[SOP-005-vera-quality-gate]] | Vera | Visual/UI QA quality gate — design-system + WCAG + responsive sign-off. *(App Developer Pack — preinstalled in v3.0.0)* |
| SOP-006 | [[SOP-006-author-a-design-system]] | Iris | Author or extend [[GL-003-design-system]], the brand/visual SSOT. *(Designer Pack — preinstalled in v3.0.0)* |
| SOP-007 | [[SOP-007-audit-content-for-design-system-compliance]] | Iris | Audit a deliverable against GL-003 and report violations. *(Designer Pack — preinstalled in v3.0.0)* |
| SOP-008 | [[SOP-008-build-an-infographic]] | Charta | Build an infographic / structured visual deliverable (HTML/CSS layout). *(Designer Pack — preinstalled in v3.0.0)* |
| SOP-009 | [[SOP-009-generate-a-styled-image]] | Pixel | Generate or stylize an image to the design system; Mack wires the connection half if needed. *(Designer Pack — preinstalled in v3.0.0)* |
| SOP-010 | [[SOP-010-warden-extract-source-to-evidence-pack]] | Warden | Read a captured source once; produce Register Items plus a reusable Evidence Pack. Foundational skill behind SOP-011–014. |
| SOP-011 | [[SOP-011-warden-meeting-prep]] | Warden | Meeting prep from the register/Work Packages/Evidence Packs — normally zero transcript rereads. |
| SOP-012 | [[SOP-012-warden-configuration-guide]] | Warden | Implementation & Configuration Guide from `change`/`decision` Register Items and linked Work Packages. |
| SOP-013 | [[SOP-013-warden-meeting-summary]] | Warden | Factual Meeting Summary from an Evidence Pack, targeted rereads only, anti-embellishment writing rule. |
| SOP-014 | [[SOP-014-warden-consultant-summary]] | Warden | Delivery/commercial interpretation, fact visibly separated from interpretation. Internal-only unless the user approves external circulation. |
| SOP-015 | [[SOP-015-cairn-process-external-source]] | Cairn | One canonical intake procedure — classify against GL-008, label evidence-origin per claim, test every backlink, file directly into `PKM/`. Self-authored, same pattern as Warden's SOP-010. |
| SOP-016 | [[SOP-016-cairn-process-youtube-transcript]] | Cairn | Subordinate procedure elaborating SOP-015 Step 2 for GL-008's Video/Audio Transcript category — single-read chunk mapping, timestamp anchors, auto-caption normalization flags, chunk-map coverage checking, metadata validation, sequential slicing for long transcripts. Re-derived from the superseded Fusion247 Brain skill `F247.skill.process-youtube-transcript`, not ported. |

*Reserved (genuinely open for future agents):* SOP-017 onward. SOP-003–009 were claimed by the v3.0.0 all-in-one bundle (App Developer Pack → 003–005, Designer Pack → 006–009); SOP-010–014 claimed by Warden's meeting-intelligence buildout (2026-07-10); SOP-015 claimed by Cairn's own pilot-processing buildout (2026-07-11); SOP-016 claimed by Cairn's transcript chunk-mapping buildout (2026-07-10, reconciled from the Fusion247 Brain precedent). Do not back-fill below SOP-017 without coordinating across the team.

## How to add a new SOP

1. Pick the next unused number (`SOP-NNN`) — by authorship order, not topic. Don't reuse reserved numbers.
2. Filename: `SOP-NNN-<kebab-case-title>.md`.
3. Header includes the default owner, status, triggers, references, and an explicit "Reusable by any agent" note — the SOP is a skill, not 1:1 ownership.
4. Reference [[GL-001-file-naming-conventions]] and any other Guideline instead of duplicating its content.
5. Add a row to this index.
