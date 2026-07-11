# SOP: Content-Integrity Audit

- **Status:** Active (since 2026-07-11)
- **Default owner:** Pax
- **Reusable by any agent.** This is a skill, not 1:1 ownership. Any specialist who wants to verify a deliverable's claims, or the user's own notes, against reality can run this procedure. Larry routes to Pax by default because the two checks below — fabricated-reference detection and content-level drift detection — are both cross-source-verification work, which is Pax's standing remit.
- **Triggered by:** "audit the wiki for fabricated references", "check my citations", "check for content drift", "is anything stale or contradicting itself", "run a content-integrity audit", "do a Brain QA pass", a Librarian-pass content-drift flag the user asks to be actually resolved, close-session's optional periodic nudge (see root `AGENTS.md` §Content-Integrity Audit Triggers). On-demand is the default; nothing in this SOP fires on its own.
- **References:** [[Team Knowledge/tasks/done/2026/07/tsk-2026-07-10-006-verifiair-content-integrity-qa-gap-proposal]] (the approved design decision this SOP implements), [[Team/Larry - Orchestrator/AGENTS]] Duty 2 (the automatic, lighter unlogged-change check this SOP does *not* duplicate), [[Team/Vera - QA Specialist/AGENTS]] (cited precedent for the boundary discipline below — evidence over opinion, never fixes, only finds), [[GL-007-human-facing-writing-conventions]] (the "a rule that's never re-read is no rule" discipline this SOP's on-demand-by-default nature has to guard against via the periodic nudge), [[GL-009-public-private-knowledge-boundary]] (governs the privacy gate below — this SOP may be asked to audit private PKM material, and its own output is subject to the same public/private rule as the material it audits).
- **Privacy (added 2026-07-11, blocking fix per external QA review):** an audit whose scope touches any private/local root (per GL-009) must never write its findings to a tracked location or describe them in a public session log. See §Privacy gate before running Step 5 or Step 7. Auditing a private source carefully and then publishing a report explaining what it said is not protection — it's the same leak GL-009/GL-011 exist to prevent, one step removed.

## Purpose

Catch two failure modes that Larry's automatic Librarian pass (Duty 2) structurally cannot: a claim or citation that was invented rather than verified against a real source, and content that has quietly drifted stale or self-contradictory even though every link still resolves and every edit was logged. Both require checking a piece of content against something *outside* its own file — a source it cites, or another statement of the same fact — which is why this is a separate, heavier, on-demand procedure rather than folded into every session close.

This SOP is the direct implementation of the hybrid direction approved in [[tsk-2026-07-10-006-verifiair-content-integrity-qa-gap-proposal]]: unlogged-change detection and the safe-corrective-boundary rule went to Larry's automatic pass; this SOP owns the two dimensions that are left — fabricated-reference detection and content-level drift — paired together per that task's own lean, since both are the same weight class of work.

## What this SOP does not do

- Does not detect unlogged canonical-file changes. That's Larry's Duty 2, automatic, every session close.
- Does not audit visual/design-system compliance. That's [[SOP-007-audit-content-for-design-system-compliance]] (Iris).
- Does not auto-fix anything it finds. Audit, classify severity, recommend. The user decides; the named owner of the affected file applies the fix.
- Does not go looking for new facts about the world. That's Pax's other hat — deep research. This SOP only checks what's already written against what it claims to be true or consistent with.

## Privacy gate (GL-009 compliance)

Classify the audit's scope **before doing anything else** — this governs both the report's destination (Step 5) and the session-log entry's content (Step 7), so it has to happen first, not as an afterthought once findings already exist.

- **Public-only scope.** No file in scope falls under any of [[GL-009-public-private-knowledge-boundary]]'s private/local roots — `PKM/Journal/`, `PKM/My Life/Current Context/`, `PKM/My Life/About Warwick/` (and, by the same principle, any future root GL-009 adds to that list). The report may go to the normal tracked location and the session-log entry may be a normal detailed one.
- **Private or mixed scope.** At least one file in scope falls under a private/local root. **The entire report — every finding, quote, path, and detail drawn from that private material — must not be written to a tracked, public location, and the public session-log entry must not describe what was found.** One private file in an otherwise-public scope makes the whole audit "private or mixed" — there is no partial-credit "mostly public" classification. Auditing a private source carefully (per SOP-015/GL-011) and then publishing a report that explains everything it said defeats the entire point of keeping it private in the first place.

Re-classify every time this SOP runs. Do not assume last audit's classification still holds.

## Inputs

- **Scope.** A single note, a folder, a whole `PKM/` or `Team Knowledge/` tree, or a date range of recent changes. The user names the scope; if unclear, ask. Default scope when triggered by a periodic nudge: everything touched since the last audit (or, if none yet, everything touched in the last 30 days).
- **Which of the two checks.** Fabricated-reference detection, content-drift detection, or both (default: both — they're paired for a reason, see §Purpose).

## Step-by-step procedure

### Step 0 — Classify scope against the Privacy gate

Before reading anything else, list every file the requested scope actually resolves to, and check each against GL-009's private/local roots. Record the classification (public-only / private-or-mixed) — this decision carries through the rest of the procedure and cannot be revised after Step 5/7 based on convenience.

### Step 1 — Inventory claims and citations in scope

Read every file in scope once. For each, list:

- Every citation or sourced claim (a `[[wikilink]]` to a source, a "per X", a quoted figure, a Drive object ID, a URL) — these are fabricated-reference candidates.
- Every claim that depends on something outside the file itself remaining true (a stated fact that another note also states, a number that should match its origin, a status that should match a linked task's actual status) — these are content-drift candidates.

Do not re-read files piecemeal across multiple passes. One inventory pass, then work from it — same discipline SOP-015 and SOP-010 already hold for their own single-read passes.

### Step 2 — Fabricated-reference check

For each citation/sourced claim from Step 1:

1. Does the cited source actually exist (file on disk, real Drive object ID, resolvable URL, real wikilink target)?
2. Does the cited source actually say what the citing note claims it says? A citation to a real file that doesn't support the specific claim attached to it is still a fabrication-adjacent problem, not a clean pass.
3. If the source cannot be checked (binary file with no extraction tool, external URL unreachable, access not available this pass), say so explicitly — "unconfirmed, not checked" is a valid, honest finding. Never silently treat an unconfirmed citation as verified.

This is exactly the discipline that caught Fusion247 Brain's own BCC/Bristol incident: a fictional worked example (a placeholder city/council name used during ontology design) leaked into live control documents as if it were real project state. The check that would have caught it early: does "Bristol City Council" actually resolve to a real client/engagement anywhere in the wiki? If not, and the document presents it as live state, that's a fabricated reference.

### Step 3 — Content-level drift check

For each content-drift candidate from Step 1:

1. If the claim states or implies it should match a source (a linked task's status, a linked note's stated fact, a Guideline's current version), re-check that source now. Does it still match?
2. If two notes state the same fact, do they still agree? Not just "do both links still resolve" (that's Larry's structural check) but "do both statements still say the same thing."
3. Flag drift even when every edit involved was properly logged — this check exists precisely because logging discipline (Larry's unlogged-change check) does not guarantee the *content* stayed correct after the edits.

### Step 4 — Severity classification

For each finding:

- **HIGH.** A fabricated reference presented as settled fact in a governance/decision-bearing document (a Guideline, a task's approved direction, a closed task's `## Outcome`); content drift where two canonical documents now actively contradict each other on a decision already acted on.
- **MEDIUM.** A citation that cannot be verified but is flagged honestly as unconfirmed rather than fabricated; content drift in a note that's read occasionally but isn't load-bearing for any active decision.
- **LOW.** A stale but harmless detail (an outdated "as of" date, a superseded example that's clearly labeled as illustrative, not asserted as current state).

A file can carry multiple findings; its overall severity is its highest single finding.

### Step 5 — Write the audit report

Destination depends on the Step 0 classification. Filename includes a time and scope segment (`HH-MM-<scope>`, added 2026-07-11) — a bare date collides and silently overwrites evidence whenever two audits run the same day, which is routine once this SOP is used more than once per session:

- **Public-only scope:** `Deliverables/YYYY-MM-DD-HH-MM-<scope>-content-integrity-audit.md` — tracked, as before.
- **Private or mixed scope:** `PKM/My Life/Current Context/audits/YYYY-MM-DD-HH-MM-<scope>-content-integrity-audit.md` — inside the same folder GL-009/GL-010 already keep local-only and gitignored (`PKM/My Life/Current Context/`), never committed. Because this destination never leaves the local machine, the report may quote and detail the private material in full — the privacy protection is the file's location, not a redacted version of its content.

`<scope>` is a short kebab-case label for what was audited (e.g. `hermes-pilot`, `wanderloots-intake`) — enough to tell two same-day reports apart at a glance, not a full description.

Structure (same shape regardless of destination):

```markdown
# Content-Integrity Audit — YYYY-MM-DD HH:MM — <scope>

## Scope
- <files/folders/date-range audited>
- Checks run: fabricated-reference / content-drift / both

## Summary
- N files audited
- M findings across L files
- Severity breakdown: H high, M medium, L low

## Findings

### <file-path>
| Severity | Check | Detail | Recommendation |
|---|---|---|---|
| HIGH | Fabricated reference | Claims "per F247.agent.foo" — no such file found anywhere in cited registry | Confirm source exists or remove the claim |
| MEDIUM | Content drift | States task X is "in progress"; tsk-X is actually `done` as of <date> | Update the stale status reference |
...

## Unconfirmed (not fabricated, not verified — say so honestly)
- <file> — citation to <source> could not be checked this pass (binary/unreachable/access unavailable). Not a finding of fabrication; a finding of "unchecked."

## Recommendation
<one-paragraph next-step recommendation, ordered by severity>
```

### Step 6 — Surface to user; never auto-fix

Present the report via Larry. Ask which findings the user wants corrected and in what order. The named owner of each affected file applies the approved fix — this SOP never edits the audited content itself, mirroring Vera's "never fixes, only finds" discipline and VerifiAIr's original R/U/suggest-D-never-autonomous-D boundary (here narrowed further: this SOP doesn't even auto-Update, only suggests, since unlike Larry's structural fixes, a content-substance correction always needs the user's judgment on which version is actually true).

### Step 7 — Session-log entry

Always write `Team Knowledge/session-logs/YYYY/MM/YYYY-MM-DD-HH-MM_<agent>_content-integrity-audit.md` (this file is tracked/public regardless of the audit's own classification) — but what it contains depends on the Step 0 classification:

- **Public-only scope:** a normal, detailed entry — scope, report path, finding counts by severity, which findings the user chose to act on, which were deferred.
- **Private or mixed scope:** an **abstract record only**. State the date, that a private-or-mixed-scope audit ran, and the finding count by severity band — e.g. "Private PKM audit completed — 3 findings (1 HIGH, 2 LOW). Full report retained locally, not committed." Do not include: which files were in scope beyond the folder-level fact that it touched private material, the actual claims/quotes/content of any finding, or any detail specific enough that a reader could reconstruct what the private source said. Do not `[[wikilink]]` the private report path — the target is gitignored and would be a dead link in the public repo, and linking it would itself name the private file's exact location. If any detail feels borderline, leave it out — the full detail already exists in the private report from Step 5.

Either way, capture the date so the next audit's default scope (§Inputs) can start from here.

## Common mistakes to avoid

- Treating an unconfirmed citation as either "verified" or "fabricated" — it's neither. Say "not checked this pass" plainly.
- Re-reading files piecemeal across the audit instead of one inventory pass (Step 1) followed by working from it.
- Auto-correcting a finding instead of recommending it. The user decides; the file's own owner applies the fix.
- Conflating this SOP's content-drift check with Larry's unlogged-change check — they catch different things (content going stale vs. edits going unrecorded) and this SOP does not need to re-check what Larry's automatic pass already covers.
- Skipping severity classification. An undifferentiated finding list is unactionable, same failure mode SOP-007 names for visual audits.
- Forgetting the session-log entry — the next audit's default scope depends on knowing when the last one ran.
- **Skipping Step 0, or writing the report before classifying scope.** Writing a private-or-mixed-scope report to tracked `Deliverables/`, or writing a detailed public session-log entry about a private audit, republishes exactly what GL-009/GL-011 were protecting — carefully guarding the private source, then narrating everything it said in public. Classify first; the destination and session-log shape both depend on it.
- Treating "the source is protected" (GL-011's raw-payload gitignore) as sufficient once this SOP is involved. This SOP's own *output* — the audit report and the session log describing it — is a second surface that can leak the same private content if its destination and detail level aren't governed by the same GL-009 rule.
