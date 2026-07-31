---
artefact: session-handoff
provenance: derived (2026-07-31, BUILD-018 Governor v1 — rendered from Deliverables/BUILD-018-session-governor/programme-state.json, NOT hand-curated)
owner_intent: consumed by the next Larry session. Regenerate on every rotation; do not hand-edit.
---

# Next-session handoff (resume here)

## Where we are

**BUILD-018 — Larry Session Governor and Context-Rotation Layer** (active). Phase: **Phase 2 — bounded implementation**.

Phase 1 (Opus architecture) is complete and settled. Phase 2 is implementing the seven components against it. T-01, T-02, T-07, T-09, T-03, T-13 and T-10 resolved earlier; this banking adds T-11, which CLOSES THE ROTATION LOOP and turns the canonical location into an enforced control. A cleared session now reorients itself automatically from banked state (pointer brief, hard 10,000-char cap), verifies its actual cwd, repository root, branch and HEAD against that state before any implementation, and is refused Write/Edit/MultiEdit/NotebookEdit and mutating Bash by a committed PreToolUse gate whenever it is in the wrong place - absolute-path luck is explicitly not a control. Both hooks are activated by a committed idempotent installer, which also reconciled the long-dangling ensure-watcher SessionStart hook. T-14 (build-session registry/launcher by name, automatic programme PR, exact-head QA binding, single merge decision) is now THE next action; T-04 (evaluator) remains independently takable.

Branch `build-018/session-governor` in worktree `C:/Fusion247PKA-governor`, HEAD `c4febeaa9ebd3fa632035a906cc2d8a2143bedde` (base `ef96a3327f896e025731769c72157fd722daa02f`). Banked by Opus at 2026-07-31.

**Completed (8):**
- **T-01** — Prove the live statusLine payload on this machine _(resolved 2026-07-31)_
- **T-02** — Session-health store location and atomic write _(resolved 2026-07-31)_
- **T-03** — Sampler: statusLine script to health sample _(resolved 2026-07-31)_
- **T-07** — Worker and worktree reconciliation _(resolved 2026-07-31)_
- **T-09** — Programme-state schema, validator and writer _(resolved 2026-07-31)_
- **T-10** — /rotate-session: bank, verify safety, emit the /clear instruction _(resolved 2026-07-31)_
- **T-11** — Reorientation on /clear, canonical-location verification, and the wrong-worktree deny gate _(resolved 2026-07-31)_
- **T-13** — Programme-state collector: gather the live estate into a valid state document _(resolved 2026-07-31)_

**Frontier — takable now (2):**
- **T-04** [Opus] — Pure evaluator: evaluate(signals) to verdict
- **T-14** [Opus] — Build-session registry/launcher by build name, automatic programme PR at merge readiness, exact-head QA binding, single merge decision

**Blockers (10):**
- **F-4** (fog, owner: research) — Are the proposed health thresholds right? Resolvable only by dogfood. _Recommendation: Ship the hypothesis thresholds, tune from T-08._
- **F-5** (fog, owner: research) — How is "a new substantial item" detected from a prompt well enough to block it without false positives? _Recommendation: Prototype in T-06; fail open on any doubt (INV-2)._
- **F-7** (fog, owner: research) — Reliable live-worker detection. T-07 shipped a best-effort Windows command-line matcher with a confirmed blind spot; a durable answer needs a session/task registry, not command-line text. _Recommendation: T-10 must treat worker liveness as `unknown`-capable, never as a confident zero._
- **Q-2** (question, owner: warwick) — Bounded override design at RED: advisory only, one-word override, or an override that expires after N prompts? _Recommendation: Expires after N prompts — advisory will be ignored, one-word becomes a reflex._
- **Q-3** (question, owner: warwick) — Project ManagAIr portability: design the adapter boundary now or extract later? _Recommendation: Design the boundary now — it is nearly free under AD-11._
- **Q-4** (question, owner: warwick) — May rotation auto-commit banked state, or always use Larry’s standing push authority? _Recommendation: Use the standing authority; add no new mechanism._
- **Q-5** (defect, owner: larry) — RESOLVED 2026-07-31 by T-11. The dangling ensure-watcher.mjs SessionStart hook was RECONCILED, not stacked beside: install-hooks.mjs prunes SessionStart hooks whose target script does not exist, a rule that cannot over-reach (proven by mutation test), reports and backs up everything it removes, and exempts governor-managed hooks. Applied live to C:/Fusion247PKA/.claude/settings.local.json (backup .bak-2026-07-31T17-05-08-981Z); the working ensure-capture-gateway sibling was kept and Stop was untouched. Two further runs reported "already correct. Nothing written." - idempotent, proven. _Recommendation: Decide repair / remove / work around before adding a Governor SessionStart hook beside it. Repair itself is Tower’s, and Tower is PARKED._
- **Q-1** (question, owner: warwick) — Is BUILD-018 the right identifier, given it was commissioned directly and has no Foundry IDEA-018? _Recommendation: Larry’s call unless Warwick objects; recorded in 00-ESTATE.md._
- **X-1** (external, owner: larry) — GL-012 section 6a is NOT on this branch. Reading GL-012 from this worktree returns the PRE-ruling text and will cause a settled conflict to be re-escalated. _Recommendation: Read it with: git show 95c265d:"Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md"_
- **X-2** (external, owner: larry) — RESOLVED 2026-07-31 by T-11. settings.local.json remains gitignored, so hook wiring still cannot travel by git - the answer is that the BEHAVIOUR travels and only the ACTIVATION touches the untracked file. tools/governor/install-hooks.mjs is committed, idempotent, reviewable and re-runnable on any machine, and ships both hooks (SessionStart reorientation + PreToolUse deny gate) in one run. _Recommendation: Every hook ticket must also ship an idempotent activation step that installs into the primary checkout’s untracked settings file._

**Safe boundary:** yes — Verified by /rotate-session: 4 safety checks ran and found no obstacle. Tree clean, no unpushed commits, no live worker detected in this worktree.

**Workers (2):**
- phase-1-research-x3 — subagent, **completed**
- t-03-t-13-implementation — subagent, **completed** (T-03)

**Branches:**
- `build-018/session-governor` (build) @ c4febeaa9ebd3fa632035a906cc2d8a2143bedde — This programme. The only branch this build may write to.
- `main` (protected) @ de92306911e7cbe8828d5652ed9f7f21fd99593e — Local main is at de92306, one commit ahead of origin/main and unpushed. MUST NOT be altered by this build.
- `recovery/2026-07-31-governor-abort-handoff` (recovery) @ 95c265de729e26114b1e1eb7dc7d8630502aca1d — Carries the settled GL-012 section 6a ruling. Read-only for this build; its PR must not be opened or merged.

**Pull requests:**
- (unnumbered)  — **none** — No PR found for this branch
- (unnumbered)  — **none** — No PR found for this branch
- (unnumbered)  — **none** — No PR found for this branch

**Worktrees (22):** 2 unreconciled, 0 unreadable.

**Not established at banking — do NOT read these as "none":**
- `workers` — Only completed Phase 1 research agents are recorded. Live worker detection is best-effort under F-7 and cannot confirm the ABSENCE of a running worker, so this list is not an enumeration.
- `pull_requests` — The GitHub PR surface was not queried during this banking. The two entries are locally known facts, not an enumeration of open PRs.
- `branches.behind` — No fetch was performed during this banking, so behind-counts against the remotes were not computed.

## What the NEXT session is about

T-11 landed: the rotation loop is CLOSED and the canonical location is now enforced, not merely documented. /clear rotates context inside the same build session; SessionStart(source=clear) finds and validates the banked state and injects a bounded pointer brief; the session's real cwd/repo-root/branch/HEAD are compared against that state; a mismatch produces a loud WRONG WORKTREE result and a committed PreToolUse gate refuses every mutating tool until it is corrected. Proven on the real estate both ways, and 223/223 governor tests pass. What is NOT yet true: Warwick still cannot simply name a build and be put in the right place, the programme PR is not created automatically, and review verdicts are not yet bound to the exact reviewed head.

**Model recommendation: Opus** — T-14 is the next action and is Opus-tier: a registry that decides which build a session belongs to, a merge-readiness predicate that must be checkable rather than felt, and an exact-head QA binding that must fail closed are all judgement calls where a plausible-looking wrong answer is expensive and quiet. T-04 (evaluator state-space) is also Opus and independent.

## Locked decisions (durable — do NOT re-litigate)

- **AD-1** — statusLine is the primary telemetry source; the transcript is corroboration only, and must always be tail-read. _(statusLine is a documented, stable contract; the transcript format is explicitly internal and version-fragile, and several local transcripts are 30-40 MB.)_
- **AD-2** — Two separate stores: session health (ephemeral, machine-local) and programme state (durable, git-versioned). _(Different lifetimes and audiences. Conflating them is how banked state gets lost.)_
- **AD-3** — BLIND is a first-class state with its own exit code. Unreadable telemetry is never GREEN. _(INV-1, and the direct lesson of the 2026-07-29 controls that reported success over ground they never examined.)_
- **AD-4** — Compaction is counted by the PreCompact hook, never inferred from the transcript. _(A local probe found zero reliable transcript markers for compaction.)_
- **AD-5** — Reorientation rides SessionStart(source="clear") to additionalContext, capped at 10,000 characters, so the injected brief is a POINTER document and not the state itself. _(The cap makes a full state dump impossible.)_
- **AD-6** — The RED preflight block fails OPEN. _(INV-2. A governor that traps Warwick in his own session is a worse defect than one that misses a rotation.)_
- **AD-8** — The map lives in git as markdown, not in an issue tracker. _(Subagents get no MCP tools, so a tracker-hosted map is unreadable by the very workers who need it.)_
- **AD-11** — The evaluator core is pure: evaluate(signals) to verdict, with zero filesystem, git or myPKA knowledge. Adapters gather signals. _(Portability, and it makes the state space unit-testable without an estate.)_
- **AD-12** — The Governor DERIVES Team Knowledge/fusion-brief/session-handoff.md; it never invents a rival handoff file. _(That file already declares itself as consumed by the next Larry session. A parallel handoff would create two competing SSOTs — the exact defect this build exists to prevent.)_
- **AD-13** — /rotate-session inherits close-session steps 1-3 only. Steps 4-7 (Librarian pass, graduation, ClickUp mirror, self-improvement review) are end-of-programme and must never run on a rotation. _(INV-4. A rotation that costs what a close costs will not get used, and an unused governor is worse than none.)_
- **AD-14** — Durable programme state lives at <programme.home>/programme-state.json — with the programme, on the programme’s branch — and banked.head_sha records the head the state DESCRIBES, i.e. the parent of the commit that carries the state file. _(A file cannot contain its own commit’s SHA. State banked on a feature branch describes commits that exist only on that branch, so parking it on main would make it lie the moment the branch advanced. Consumers comparing against live HEAD must exclude the banking commit itself.)_
- **AD-15** — The programme-state collector (T-13) never performs a git fetch, so branches.behind is permanently unknown under it. _(A trustworthy behind-count needs fresh remote-tracking refs, and a collector must not have side effects on the repository it is reporting on. Matches this document's own pre-existing branches.behind unknown declaration from T-09.)_
- **AD-16** — T-13 collects repository, worktrees, branches and pull_requests only. workers is never scanned or synthesised by the collector. _(Which subagent was dispatched, for which ticket, with what expected output, is programme knowledge the dispatching session holds — not something git, worktree-recon or gh can answer. F-7 already establishes live-worker detection is best-effort; inventing worker entries from an OS process scan would manufacture false precision under a field whose entire schema purpose (T-09's D-2) is refusing to let a guessed collection read as ground truth.)_
- **AD-17** — THE ARTEFACT HIERARCHY (settled 2026-07-31, binding). (1) The Goal / Build Contract (01-GOAL-CONTRACT.md) is the PRODUCT SSOT — outcome, invariants, scope. (2) The Wayfinder map (02-MAP.md) is the LIVE EXECUTION / NAVIGATION SSOT — architecture, settled decisions, fog, frontier, write-back. (3) The Implementation Plan is the INITIAL ROUTE ONLY — context, never prescription, superseded by the map the moment execution diverges. (4) programme-state.json and Team Knowledge/fusion-brief/session-handoff.md are GENERATED PROJECTIONS — never hand-authored, never a rival source; a disagreement between a projection and its source is a defect in the projection. (5) Before merge, enduring BUILD-018 records GRADUATE into Builds/BUILD-018-session-governor/; evidence may remain under Deliverables/. _(Resolves the "which file wins" question that a rotation makes acute: a fresh Larry reads four artefacts and must know their rank without asking. Ranking product above execution stops the map quietly redefining the outcome; declaring the projections generated is what makes /rotate-session regenerating them safe rather than destructive; the graduation clause keeps the durable record with the build (the estate's own Builds/ convention) rather than stranding it in a working folder. Refines AD-9 (map-over-tickets) and generalises AD-12 (the handoff is derived, never invented).)_
- **AD-18** — The wrong-worktree gate keys on cwd, repository root and branch ONLY. HEAD is compared and REPORTED, but never denies. _(The moment a session makes its first legitimate commit, its HEAD diverges from banked.head_sha. A gate keyed on HEAD would block the session for having succeeded, and would be switched off within the hour. Location is a precondition; head movement is normal progress, and staleness already has its own channel (AD-14).)_
- **AD-19** — Two unknowns, two directions. (a) Cannot establish where we are while a canonical location IS known -> DENY (unknown is never aligned). (b) No active programme found at all, or the guard itself throws -> ALLOW. _(Failing closed everywhere would let one guard bug become a total work stoppage on a machine running 22 worktrees; failing open everywhere would make the gate decorative. The split puts the strictness exactly where a canonical location exists to be violated. Threat model is first-party mistakes, not a malicious operator. Both directions are proven by test - an untested fail-direction is an assumption, not a control.)_
- **AD-20** — Warwick never manages branches, worktrees, commits, pushes or PR creation. Larry owns the complete Git lifecycle. Warwick's standing gate is merge-to-main, plus decisions that are genuinely his. _(Recorded as a decision rather than left as a habit because the failure it prevents is silent: a Larry that asks Warwick to "just run git checkout" has converted an orchestration failure into Warwick's problem, and the ask looks helpful in the moment. Printed in every reorientation brief and every refusal, so a fresh session inherits it without being told.)_
- **AD-21** — The EnterWorktree recovery protocol. Larry initiates it. Under Remote Control the approval may appear ONLY in the local terminal, so Larry must IMMEDIATELY say, verbatim: "Approve the pending EnterWorktree request in the local Claude terminal", then wait. Larry must NOT spin silently, must NOT continue via absolute paths, and must NOT ask Warwick to run git commands. _(Learned live on 2026-07-31: a pending approval invisible to the remote side reads as the assistant hanging, and five minutes vanished. The protocol is embedded verbatim in the deny message and in the brief rather than only in the map, because at the moment it is needed nobody is reading the map - the refusal is the only thing on screen.)_

## Runtime pointers

- **The map (SSOT)** — `Deliverables/BUILD-018-session-governor/02-MAP.md` — On branch build-018/session-governor. From another checkout: git show build-018/session-governor:"Deliverables/BUILD-018-session-governor/02-MAP.md"
- **Durable programme state** — `Deliverables/BUILD-018-session-governor/programme-state.json` — Validate before trusting: node -e "import('./tools/governor/programme-state.mjs').then(m=>console.log(m.readProgrammeState('Deliverables/BUILD-018-session-governor/programme-state.json')))"
- **State schema** — `tools/governor/programme-state.schema.json` — Interpreted directly by the validator in tools/governor/programme-state.mjs — it is the single source of the constraints, not a description of them.
- **Session-health store** — `tools/governor/health-store.mjs` — Default root ~/.mypka/governor/health/<projectKey>/<sessionId>.json; override with MYPKA_GOVERNOR_HEALTH_DIR.
- **Worktree reconciliation** — `tools/governor/worktree-recon.mjs` — reconcile({repoPath, primaryPath, buildPaths}) returns every worktree with classification, disposition and best-effort live worker PIDs.
- **statusLine capture** — `tools/capture-statusline.mjs` — Kept from T-01 for T-03 to reuse.
- **Sampler** — `tools/governor/sampler.mjs` — sampleFromStdin(raw, opts) — pure parse/extract, one impure write via T-02's writeHealthSample. Not yet wired as the primary checkout's live statusLine command; production activation is deferred (see T-03 handback).
- **Rotation (/rotate-session)** — `tools/governor/rotate-session.mjs` — node tools/governor/rotate-session.mjs --model <model> [--gh-repo owner/name] [--dry-run]. Exit 0 rotated, 1 refused, 2 BLIND. isBankingCommit({headSha, bankedHeadSha, headParentSha}) is the AD-14 staleness comparison — never use a raw HEAD !== banked.head_sha.
- **Programme-state collector** — `tools/governor/collect-state.mjs` — collectEstateState({repoPath, branchSpecs, ghRepo, ...}) returns {repository, worktrees, branches, pull_requests, unknown}; mergeEstateIntoState(base, estate) folds it into a full document. T-10 builds directly on this for its estate-derived fields.
- **GL-012 section 6a (settled ruling, NOT on this branch)** — `Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md` — git show 95c265d:"Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md"
- **Ding Warwick on handback** — `larry-ding.mjs (private surface, permission-allowlisted)` — Message is read from a FILE, not argv.
- **Tests** — `tools/governor/*.test.mjs` — node --test "tools/governor/*.test.mjs" — use the glob; the bare directory form fails.

## How to resume

**Work in `C:/Fusion247PKA-governor` on branch `build-018/session-governor`.**

**THE EXACT NEXT ACTION:** Implement T-14 as Opus: (1) a human-friendly build-session registry/launcher keyed on the build NAME (a projection under AD-17, generated from banked state, never hand-authored) that puts a session in the right worktree/branch or reports precisely why it cannot - and which properly closes T-11's recorded bound that a session in a wholly unrelated repository cannot discover the estate; (2) automatic create/update of the programme PR at merge readiness, by Larry not Warwick (AD-20), idempotent, against a DEFINED checkable predicate (all in-scope tickets resolved with evidence, suite green, tree clean, local HEAD == remote head, independent review complete) - and it must never merge; (3) exact-head QA binding, keying every verdict on the full (repo, branch, canonical SHA) tuple, canonicalised once at the boundary, marking a verdict SUPERSEDED when the head moves and failing closed on an unknown head; (4) present Warwick only the final merge decision. Read tickets/T-14-build-session-registry-and-merge-flow.md for the full specification and the out-of-scope list. Do NOT change the T-11 gate semantics (AD-18/AD-19). T-04 (pure evaluator, Opus) is independently takable if T-14 is deferred. (ticket T-14)

**Read first:**
- Deliverables/BUILD-018-session-governor/02-MAP.md - the live execution SSOT: architecture, settled decisions (now AD-1..AD-21), fog, frontier, write-back log
- Deliverables/BUILD-018-session-governor/01-GOAL-CONTRACT.md - the product SSOT: the outcome and the 7 invariants; it wins over any ticket (AD-17)
- Deliverables/BUILD-018-session-governor/tickets/T-14-build-session-registry-and-merge-flow.md - the full T-14 specification, including what is deliberately out of scope
- tools/governor/worktree-guard.mjs - the shared location comparison AND the PreToolUse gate; AD-18/AD-19 live here, do not change their semantics
- tools/governor/reorient.mjs - the SessionStart brief; it consumes the same comparison, which is why the two can never disagree
- tools/governor/install-hooks.mjs - how both hooks are activated idempotently; re-run it from the primary checkout after BUILD-018 merges to re-point the commands

**Do NOT:**
- Do not open or merge the recovery PR (recovery/2026-07-31-governor-abort-handoff at 95c265d).
- Do not alter local main.
- Do not create the BUILD-018 PR yet - it was explicitly deferred by Warwick on 2026-07-31.
- Do not modify, move or delete the six Cairn intake files under Team Knowledge/Sources/.
- Do not delete or clean any pre-existing worktree without first proving owner, branch, status and disposition.
- Do not run /close-session, and do not start the VlogOps product build.
- Do not re-litigate the settled decisions in 02-MAP.md section 3.
- Do not read GL-012 from this working tree - it is the pre-ruling text. Use git show 95c265d.
- Do not naively compare banked.head_sha against live HEAD without excluding the banking commit itself (AD-14).
- Do not change the deny-gate semantics settled in AD-18 and AD-19 while implementing T-14.
- Do not ask Warwick to run git commands, choose a branch, or manage a worktree - Larry owns the whole git lifecycle (AD-20).

_This handoff is derived. 3 field(s) were not established at banking — see above._
