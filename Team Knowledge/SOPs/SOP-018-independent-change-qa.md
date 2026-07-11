# SOP: Independent Change QA

- **Status:** Active (since 2026-07-11)
- **Default owner:** Pax, when Larry scopes the request. **This SOP does not create a new specialist.** It is a skill — the portable successor to Fusion247 Brain's old `/update QA` skill — not a permanent agent, and any specialist can run it when they need to independently verify what was claimed vs. what was actually built.
- **Reusable by any agent.** Larry scopes the request (the review window, the control set in scope, who authored the change under review); Pax is the default evidence/methodology owner because this is the same triangulation-over-trust discipline as his other work, applied to "did the build match the claim" instead of "is this claim true." Any agent can invoke this procedure directly when they need to check their own or another agent's work before it's treated as settled.
- **Triggered by:** "QA the recent changes," "independently verify what changed," "check this before I merge/accept it," "compare what was requested with what was actually built," "did the build match the claim," a migration or build PR that's about to be treated as complete, a task closure that depends on evidence rather than a clean task board.
- **References:** [[Deliverables/2026-07-11-independent-change-qa-doctrine-absorption]] (the full doctrine-absorption matrix this SOP implements — every rule below was re-derived from that evidence base, not copied), [[SOP-017-content-integrity-audit]] (the sibling skill this SOP cross-links but never merges with — see §What this SOP does not do), [[Team/Larry - Orchestrator/AGENTS]] Duty 2 (the automatic structural pass this SOP does not duplicate) and Larry's four durable routing principles (never self-certifying his own implementation, a clean task board is not completeness evidence, route through this SOP and record independence level, unknown evidence is declared not smoothed over), [[GL-009-public-private-knowledge-boundary]] (governs this SOP's own report the same way it governs SOP-017's), [[GL-011-immutable-source-retention]] (the register format this SOP's evidence-trail requirement points at), [[GL-001-file-naming-conventions]] (report naming/placement).

## Purpose

Catch the failure mode neither Larry's automatic Librarian pass nor SOP-017's content-integrity audit is built to catch: **the gap between what a change was claimed to do and what it actually did.** A migration can be structurally clean (no broken links, no orphaned files) and content-consistent (no fabricated citations, no stale drift) while still not having actually delivered what was requested, or having silently changed something the author didn't mention. This SOP exists to close that specific gap — by re-reading the literal edited output, comparing it against the literal request, in both directions, and saying honestly how independent the review actually was.

This SOP is Fusion247PKA's re-derivation of Fusion247 Brain's `F247.skill.update-qa-claude` (`/update QA`), absorbed per the accepted Fusion247 decision that this capability is a skill, not a permanent agent, and that it complements rather than replaces the structural checker — now split across Larry's Duty 2 and SOP-017. See the doctrine-absorption matrix above for the full source mapping; nothing in this SOP is transcribed from the original — it is re-derived in myPKA's own procedural voice, matching the shape of [[SOP-017-content-integrity-audit]] and [[SOP-007-audit-content-for-design-system-compliance]].

## What this SOP does not do

- **Does not create a new specialist or persona.** It is a callable procedure. Anyone can run it.
- **Does not detect fabricated references or content-level drift.** That's [[SOP-017-content-integrity-audit]]'s job. If, mid-review, this SOP's evidence check turns up a citation or claim that needs checking against an outside source, it names that as a follow-up for SOP-017 rather than re-implementing fabricated-reference detection here. The two are paired procedures — SOP-017 asks "is this claim true," this SOP asks "did the build match the claim" — and they stay separate files.
- **Does not detect unlogged canonical-file changes as a blanket, whole-repo sweep.** That's Larry's Duty 2, automatic, every session close. This SOP performs the same bidirectional discipline (claims against files, files against claims) but scoped narrowly to one specific reviewed change, on demand — not as a second automatic pass over everything.
- **Does not audit visual/design-system compliance.** That's [[SOP-007-audit-content-for-design-system-compliance]] (Iris).
- **Does not run a multi-role adversarial panel review.** That's the separate Critical Panel Review skill. This SOP may recommend invoking it for a high-risk artefact before a final ship decision, but never inlines its reviewer-panel logic.
- **Does not auto-fix, delete, archive, change schema, or rewrite a boundary.** Report-only by default. No destructive or structural-boundary action without Warwick's explicit approval — see §Step 8.
- **Does not make product decisions for Warwick.** It surfaces evidence, severity, and a verdict. Warwick decides what happens next.

## Reviewer independence — stated honestly

This is the single most important discipline in this SOP, and the reason it exists as a distinct procedure rather than folding into SOP-017.

Genuine independence means a **different model, runtime, or session** reviewing the work — not a persona switch inside the same authoring session. Whenever this SOP is run by the same model/session that authored the change under review (the normal case when Larry runs it himself, in the same conversation that built the thing), the report **must state, verbatim: "Same-model review — not independently verified."**

A same-model pass is still worth running. It can and does find real issues — most of the structural-damage and register-hygiene checks below don't require a different reviewer to catch. But it must never be represented as external or independent QA, because it isn't. A genuinely separate reviewer pass — an external Claude/ChatGPT instance, a different runtime, or Warwick himself — is what actually confers independence, and **is required before a material migration or build PR is treated as approved.** Declaring same-model findings "clean" is not equivalent to independent sign-off; the report must say which one happened.

## Inputs

- **Scope.** A single change, a PR, a task's completed work, or a date-bounded window of build activity. Larry (or whoever invokes this SOP) names the scope; if unclear, ask before starting.
- **The change under review.** What was requested, what the author claims changed, and where the actual artefact lives (files, diff, git range, or task record).
- **Reviewer identity and independence level.** Who is running this pass, and whether they authored the change under review. State this before starting — it determines the honesty-rule language required in the final report.

## Step-by-step procedure

### Step 0 — Classify scope against the Privacy gate

Before reading anything else, apply exactly the same classification [[SOP-017-content-integrity-audit]]'s §Privacy gate uses: does any file in scope fall under a [[GL-009-public-private-knowledge-boundary]] private/local root? One private file anywhere in scope makes the whole review private-or-mixed — there is no partial-credit classification. This decision governs the report's destination (Step 9) and the session-log entry's content (Step 10), so it happens first.

### Step 1 — Define the review window and the control set

Record explicitly, before checking anything:

- **What was requested** — the exact ask, in the requester's own words or the task file's stated brief.
- **What the author claims changed** — the author's own summary of what they did.
- **What the actual artefact is** — the specific files, diff, or git range the claim maps to. Do not accept "the recent work" as a scope; resolve it to concrete paths or a commit range before proceeding.
- **The relevant control set for this change** — the specific files a change of this kind should touch or be reflected in (the affected contract, the SOP/Guideline it implements, the task file, the relevant `INDEX.md`, recent session-log entries). Read that control set, not the whole repository by habit. If the change is large enough that the control set is unclear, ask rather than guessing.
- **Any blocked tool or inaccessible source.** If a connector, file, or evidence source is unavailable this pass, declare it immediately and by name in the report (see Step 9). Never silently treat an unreachable source as if it had passed.

### Step 2 — Reconstruct the three-way comparison

Lay out, side by side: requested → claimed → actual. A finding starts wherever any two of these three disagree. This is the spine of the whole review — everything after this step is checking each disagreement for severity and evidence.

### Step 3 — Check both directions

Two separate passes, not one blended read:

1. **Claims against files.** For everything the author says changed, confirm the file/diff actually reflects it.
2. **Files against claims.** For everything that actually changed in the artefact/diff, confirm the author's claim mentions it. An unmentioned change is itself a finding, even if the change turns out to be harmless — a silent, unclaimed edit is a register-hygiene and provenance problem regardless of whether its content is correct.

### Step 4 — Apply source-of-truth precedence where documents conflict

When two documents in the control set disagree about the same fact, resolve using this order, re-derived for Fusion247PKA's own document types:

1. **Raw evidence** (a captured source in `Sources (Immutable)/`, a literal git diff, an actual file's current content) wins for facts.
2. **Root `AGENTS.md` / the relevant Guideline / the task's own stated acceptance criteria** win for intent — what the change was supposed to accomplish.
3. **A closed task's `## Outcome`, or any recorded acceptance/realignment** wins for what was actually decided and accepted.
4. **Current registers** (`INDEX.md` files, `agent-index.md`, `Sources (Immutable)/INDEX.md`) win for current state.
5. **Session logs and git history** win for what happened, in what order.

State the conflict and which document won, rather than silently picking one. If the conflict looks like it needs Warwick's judgment rather than mechanical precedence, say so instead of resolving it yourself.

### Step 5 — Re-read the literal edited output; do not validate against remembered intent

This is the step every worked failure this SOP is derived from (splice damage, duplicated numbering, stacked changelogs, silently unregistered documents, broken tables) was only caught by doing, and only missed by skipping. Open the actual current state of every file the change touched and read it as it stands — not as you remember writing it, not as it should read given the plan. An author reviewing their own remembered intention instead of the literal file is the single most common way real damage goes uncaught.

### Step 6 — Run the non-conformance checklist

Check the literal output (from Step 5) and the three-way comparison (from Step 2) against each of the following. Not every item applies to every change — note "not applicable" rather than skipping silently.

- **Acceptance criteria.** Does the actual artefact meet what was asked, not just what was claimed?
- **Source/provenance.** Does every load-bearing claim in the change trace to a real, checkable source?
- **Register/task/session hygiene.** Is the change reflected in the task file, the relevant `INDEX.md`, and a session-log entry, the way it should be?
- **Links/references.** Do wikilinks and cross-references the change touched still resolve? (Delegates to Larry's Duty 2 / SOP-017 mechanics — this checklist line flags the question for the reviewed change, it does not reimplement link-resolution.)
- **Fabricated projects/clients/folders/documents.** Does every named entity in the change actually exist? (Delegates to [[SOP-017-content-integrity-audit]] for the actual fabricated-reference check — flag it here, run it there.)
- **Stale or contradictory instructions.** Did the change leave behind an instruction, note, or reference that no longer matches current reality?
- **Duplicate active source-of-truth files.** Did the change create a second file claiming the same authority as an existing one?
- **Schema/ontology/folder-purpose drift.** Did the change alter what a folder or field is *for* without recording that decision anywhere?
- **Agent/skill/SOP/guideline/template boundary drift.** Did the change bury a procedure inside a contract, or a shared rule inside a single specialist's file, where it should live in a separate SOP/Guideline instead?
- **Structural damage after edits.** Are headings and numbering sequential? Are there sentence fragments stranded beside a heading? Have changelog blocks stacked up inside a control file instead of living in the session log? Are tables intact, with no rows merged or split across cell boundaries? Any duplicated blocks left over from a splice?

### Step 7 — Classify severity

- **Critical.** Risks corrupting a canonical file, contradicting an accepted decision or stated intent, losing provenance, silently changing a source-of-truth hierarchy, or causing major routing/index drift.
- **Major.** Material inconsistency, a missing register update, unclear ownership, a duplicated active document, or agent/skill/SOP boundary confusion.
- **Minor.** Low-risk cleanup — stale wording, a missing backlink, an unclear status label, a minor formatting issue.
- **Observation.** A useful note or pattern that needs no immediate action.
- **Improvement opportunity.** A suggestion for better structure, auditability, or maintainability — kept strictly separate from the four finding tiers above; this is advice, not a non-conformance.

A single reviewed change can carry findings across several tiers; report each at its own severity rather than averaging.

### Step 8 — Render the verdict

One of: **Pass** / **Pass with observations** / **Pass with remedials** / **Fail.** State it plainly, next to the reviewer-independence declaration from §Reviewer independence. Never render a Pass of any kind while a Critical or Major finding remains unresolved — that is the exact failure this SOP exists to prevent ("never declare the system clean while unresolved material findings remain"). Report-only by default: this SOP does not delete, archive, change schema, or rewrite a boundary itself, regardless of verdict — remedials are proposed, with an owner and a priority, for Warwick's explicit approval.

### Step 9 — Write the report

Destination depends on the Step 0 classification, mirroring SOP-017's exact pattern:

- **Public-only scope:** `Deliverables/YYYY-MM-DD-HH-MM-<scope>-independent-change-qa.md`.
- **Private or mixed scope:** `PKM/My Life/Current Context/audits/YYYY-MM-DD-HH-MM-<scope>-independent-change-qa.md` (gitignored, never committed — the report may then quote private material in full, since the protection is the file's location, not a redacted version of its content).

Structure:

```markdown
# Independent Change QA — YYYY-MM-DD HH:MM — <scope>

## Reviewer independence
Reviewer: <name/model/session>. Author of change under review: <name/model/session>.
Independence level: Same-model review — not independently verified. / Genuinely independent (different model/runtime/session — specify).

## Review window
- Requested: <what was asked>
- Claimed: <what the author says changed>
- Actual: <files/diff/git range actually reviewed>
- Control set checked: <list>
- Blocked tools / unreachable sources this pass: <name each, or "none">

## Findings

### Critical
| Detail | Evidence | Recommendation |
|---|---|---|
...

### Major
...

### Minor
...

### Observations
...

### Improvement opportunities
...

## Source-of-truth conflicts resolved
- <conflict> → resolved in favor of <document>, per precedence order.

## Verdict
Pass / Pass with observations / Pass with remedials / Fail.

## Evidence trail
For every material finding: source title, git path or Drive ID, the [[GL-011-immutable-source-retention]] register entry if one exists, hash where available, exact access method, any access limitation, timestamp anchor.

## Recommendation
<next steps, ordered by severity, remedials named with owner and priority>
```

### Step 10 — Surface to Warwick; never auto-fix

Present the report via Larry. Findings are proposed remedials with an owner and a priority, not autonomous fixes. The only exception to "report-only" is if Warwick explicitly authorizes a specific action in response to the report — this SOP never assumes standing authorization from a prior run.

### Step 11 — Session-log entry

Write `Team Knowledge/session-logs/YYYY/MM/YYYY-MM-DD-HH-MM_<agent>_independent-change-qa.md`, always tracked/public, following the same public-only vs. private-or-mixed content rules SOP-017's Step 7 already established: a normal detailed entry for public-only scope; an abstract record only (date, that a private-or-mixed review ran, finding counts by severity, independence level) for private-or-mixed scope, with no quoted content.

## Common mistakes to avoid

- **Overclaiming independence.** Running this SOP inside the same session that authored the change and reporting it as "independent QA" without the required verbatim disclosure. This is the single most damaging mistake this SOP exists to prevent.
- **Reimplementing SOP-017 inside this SOP.** If the question is "is this citation/claim actually true," that's SOP-017's job — flag it and hand off, don't re-run fabricated-reference detection here.
- **Reimplementing Duty 2's blanket sweep.** This SOP's bidirectional check is scoped to one reviewed change, not a second whole-repo pass.
- **Validating against remembered intent instead of the literal file.** Every worked failure behind this SOP's checklist happened this way. Re-read the actual current state of the artefact every time.
- **Treating a clean task board or closed-task count as completeness evidence.** It isn't. Source-grounded evidence for the specific claim is required.
- **Silently treating a blocked tool or unreachable source as if it passed.** Declare it by name, immediately, in the report.
- **Rendering any Pass variant while a Critical or Major finding is still open.**
- **Auto-fixing a finding.** Report, classify, recommend. Warwick decides; the file's own owner applies any approved fix.
- **Skipping the reviewer-independence declaration entirely.** Every report states it, even when the answer is "same-model."
