# WS-005 - Fusion247 Brain Migration Reconciliation

- **Status:** Active (since 2026-07-10)
- **Type:** Workstream — a multi-agent composition. Recurs each time a reconciliation pass is needed against the source system, not a one-shot task. Ships now (rather than waiting for a third repeat) because the buildout tracked in [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] is explicitly multi-session and more Fusion247 Brain content remains unreconciled after the first pass.
- **Owners:** **Pax (primary executor)** — reads the precedence-ordered source registers, cross-references against this repo's git history and current file tree, produces the Migration Coverage Matrix. **Larry** — provisions Pax with extracted source text and git history (Pax has no `Bash`), synthesizes the report for the user, never edits architecture based on findings without user approval. **Silas / Warden / other specialists** — consulted when a finding requires domain judgment before disposition (e.g. "does this map to an existing schema field") but do not independently expand scope.
- **References:** [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] (the buildout this reconciles against), [[GL-006-client-delivery-frontmatter-conventions]], [[SOP-001-how-to-add-a-new-specialist]]
- **Triggered by:** the user asking whether Fusion247 Brain content has been "fully absorbed," "reconciled," or asking for a coverage/gap audit against the live source system.

## Purpose

Fusion247 Brain (the user's prior ChatGPT/Google-Drive-based system) is being absorbed into myPKA incrementally, session by session, driven by whatever the user surfaces. That's appropriate for build velocity but creates a real risk: partial absorption that *looks* complete because the parts that got attention are polished, while whole capabilities never got looked at. This Workstream is the check against that risk — a structured, source-led audit that answers "what fraction of the canonical Fusion247 Brain has an equivalent home in myPKA, and what's the honest gap," without doing any migration itself.

**This Workstream produces a report. It does not migrate, modify, or implement anything.** Follow-up work it identifies becomes new tasks/PRs, gated on user approval, executed through the normal channels (Nolan for hires, Silas for schema, Warden for domain content, WS-002 if literal content import is ever warranted).

## What this Workstream does not do

- Does not write, edit, or delete anything in `Client Delivery/`, `Team/`, `Team Knowledge/`, or `PKM/` as part of producing the report. The only writes are the report itself (a Deliverable) and this Workstream's own tracking task.
- Does not treat "a file exists with a similar name" as evidence of absorption. A disposition of `absorbed` requires the *meaning* of the source capability to be traceable in myPKA's current structure, not just a superficial name match.
- Does not re-litigate decisions already logged in [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]'s Decisions log. Those are settled; this Workstream checks *coverage*, not whether past decisions were correct.
- Does not propose follow-up PRs and then implement them in the same pass. Reconciliation reports terminate in a proposal; implementation is a separate, explicitly-approved step.

## Precedence order for source material

When two Fusion247 Brain documents disagree about the state of the source system, resolve in this order (highest wins):

1. **F247 Drive Object Registry** — the machine-readable inventory (canonical_name, object_type, status, owner_agent per row). Ground truth for "does this object exist and what's its status."
2. **F247.master.index** — the authoritative human-readable register. Used when the Registry doesn't capture something interpretively (e.g. a capability spread across multiple objects).
3. **F247.decision-log** — approved doctrine. Used to confirm whether a capability was ever formally adopted vs. exploratory.
4. **F247 Work List** — unfinished and deferred work. Used to distinguish "never built" from "built and working" from "started, abandoned."
5. **Session Log** — late or orphaned changes not yet reflected in the registers above. Lowest precedence *as a source of truth*, but often the most current — flag conflicts between Session Log and the higher-precedence registers rather than silently preferring one.
6. **F247.implementation.plan** and **F247.proposal.mypka-gap-analysis** — architecture baselines. Used to understand *intended* scope (what Fusion247 Brain was building toward), distinguishing "not built yet, but never intended to migrate" from "not built yet, and was on the roadmap."

## Step-by-step procedure

### Step 1 — Provision (Larry)

Larry extracts the six precedence-ordered documents (and the gap-analysis) from the source Drive export to plain text, and gathers this repo's relevant git history (`git log --stat` since the buildout began) and current file tree (`git ls-files`). Pax does not have `Bash` or Drive access — Larry is the provisioning layer for every reconciliation run.

### Step 2 — Build the canonical inventory (Pax)

Walk the precedence-ordered sources and produce one row per **canonical Drive object or distinct capability** — not one row per file. A capability spanning several Drive objects (e.g. "CategorisAIr source-to-WIKI pipeline" spans an agent doc, a template, and a skill) is one row, with its constituent objects noted.

### Step 3 — Cross-reference against myPKA (Pax)

For each inventory row, search the provisioned git history and file tree for an equivalent. Assign exactly one disposition:

| Disposition | Meaning |
|---|---|
| `absorbed` | The capability's *meaning* — not just a file with a similar name — has a working equivalent in myPKA. Cite the file path and the commit/PR. |
| `mapped-to-existing` | The capability is intentionally realized by a myPKA mechanism that predates this migration (e.g. "provenance" maps to GL-002 + the new GL-006 fields), not a 1:1 port. Cite the mapping and the commit/PR. |
| `retained-as-source` | Deliberately left in the source system, not migrated, and not intended to be (e.g. live client data still being actively worked in Drive). Cite the decision if one exists. |
| `deferred` | Acknowledged as needing migration, explicitly not done yet — matches something in [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]]'s "Future extension candidates" or an open decision. |
| `rejected` | Considered and deliberately not carried forward (cite why, and by whom — the user or a documented QA finding). |
| `duplicate/superseded` | The source object itself is marked superseded/archived in the Drive Object Registry (already dead in the source, not a migration gap). |
| `unresolved` | No clear evidence either way. This is the honest default when Pax cannot confirm a disposition — never force a row into `absorbed` on a weak match. |

**Do not equate copying a file with preserving its meaning.** A myPKA file that shares a name or topic with a Fusion247 Brain object is not automatically `absorbed` — check that the actual doctrine, boundary, or procedure is present, not just a title.

### Step 4 — Synthesize the report (Larry)

Larry takes Pax's matrix and produces the return format below, and presents it to the user. No implementation happens in this step.

## Deliverable: Migration Coverage Matrix

One markdown table, one row per canonical object/capability, columns: `Source object/capability | Disposition | myPKA equivalent (path) | Commit/PR | Notes`. Saved to `Deliverables/YYYY-MM-DD-fusion247-brain-migration-coverage-matrix.md`.

## Required return format

Every run of this Workstream returns, in this order:

1. **Overall coverage** — rough proportion by disposition (not a false-precision percentage; a named-band estimate, e.g. "roughly half absorbed or mapped, a third retained-as-source by design, the rest split across deferred/unresolved").
2. **Unresolved items** — every row that couldn't be confidently dispositioned, with what would resolve it.
3. **Suspected omissions** — capabilities the source registers imply exist but that Pax couldn't find direct evidence for in the sources actually read (flag for a deeper pass, don't guess).
4. **Conflicting decisions** — anywhere Session Log (lowest precedence) contradicts a higher-precedence register, or the gap-analysis/implementation-plan implies a scope the decision-log never confirms.
5. **Active Drive-only governance** — capabilities still genuinely live and load-bearing in Fusion247 Brain that myPKA has no equivalent for yet, and that aren't simply `retained-as-source` by deliberate choice.
6. **Proposed bounded follow-up PRs** — a short list, each scoped to one disposition category or one capability, **not implemented**, awaiting the user's explicit approval per PR.

## Definition of done

1. Every row in the Drive Object Registry (and every capability named in the master index that doesn't reduce to a single registry row) has exactly one disposition.
2. Every `absorbed` / `mapped-to-existing` row cites a real file path and commit/PR — no disposition without a citation.
3. The report exists in `Deliverables/` and is linked from the run's task.
4. No file outside `Deliverables/` and the tracking task was modified during this Workstream.
5. The user has the report and has not yet been asked to approve any specific follow-up PR — that's a separate, later step.
