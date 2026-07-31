---
artefact: session-handoff
provenance: derived (2026-07-31, BUILD-018 Governor v1 — rendered from Deliverables/BUILD-018-session-governor/programme-state.json, NOT hand-curated)
owner_intent: consumed by the next Larry session. Regenerate on every rotation; do not hand-edit.
---

# Next-session handoff (resume here)

## Where we are

**BUILD-018 — Larry Session Governor and Context-Rotation Layer** (active). Phase: **Phase 2 — bounded implementation**.

Phase 1 (Opus architecture) is complete and settled. Phase 2 is implementing the seven components against it. T-01, T-02, T-07, T-09, T-03 and T-13 resolved earlier; this banking adds T-10 (/rotate-session) — the banking half of the rotation loop now works end to end: it collects and validates the live state, REFUSES with a precise obstacle when the estate is unsafe (proven on real git for dirty tree, unpushed commit and live worker, each also asserting nothing was committed), and when safe banks, pushes, writes the canonical derived handoff and prints the exact /clear command. It does not invoke /close-session, ClickUp or Drive — enforced by invocation-shape controls, not a substring ban. T-11 (reorientation) is now THE next action: until it lands, the fresh Larry must still be pointed at the handoff by hand, which is the re-briefing this build exists to remove.

Branch `build-018/session-governor` in worktree `C:/Fusion247PKA-governor`, HEAD `8cfe7d19ddf8fcf9b7d86930802f9655991b6d9f` (base `ef96a3327f896e025731769c72157fd722daa02f`). Banked by Opus at 2026-07-31.

**Completed (7):**
- **T-01** — Prove the live statusLine payload on this machine _(resolved 2026-07-31)_
- **T-02** — Session-health store location and atomic write _(resolved 2026-07-31)_
- **T-03** — Sampler: statusLine script to health sample _(resolved 2026-07-31)_
- **T-07** — Worker and worktree reconciliation _(resolved 2026-07-31)_
- **T-09** — Programme-state schema, validator and writer _(resolved 2026-07-31)_
- **T-10** — /rotate-session: bank, verify safety, emit the /clear instruction _(resolved 2026-07-31)_
- **T-13** — Programme-state collector: gather the live estate into a valid state document _(resolved 2026-07-31)_

**Frontier — takable now (2):**
- **T-04** [Opus] — Pure evaluator: evaluate(signals) to verdict
- **T-11** [Opus] — Reorientation: SessionStart(source=clear) pointer brief, 10k cap

**Blockers (10):**
- **F-4** (fog, owner: research) — Are the proposed health thresholds right? Resolvable only by dogfood. _Recommendation: Ship the hypothesis thresholds, tune from T-08._
- **F-5** (fog, owner: research) — How is "a new substantial item" detected from a prompt well enough to block it without false positives? _Recommendation: Prototype in T-06; fail open on any doubt (INV-2)._
- **F-7** (fog, owner: research) — Reliable live-worker detection. T-07 shipped a best-effort Windows command-line matcher with a confirmed blind spot; a durable answer needs a session/task registry, not command-line text. _Recommendation: T-10 must treat worker liveness as `unknown`-capable, never as a confident zero._
- **Q-2** (question, owner: warwick) — Bounded override design at RED: advisory only, one-word override, or an override that expires after N prompts? _Recommendation: Expires after N prompts — advisory will be ignored, one-word becomes a reflex._
- **Q-3** (question, owner: warwick) — Project ManagAIr portability: design the adapter boundary now or extract later? _Recommendation: Design the boundary now — it is nearly free under AD-11._
- **Q-4** (question, owner: warwick) — May rotation auto-commit banked state, or always use Larry’s standing push authority? _Recommendation: Use the standing authority; add no new mechanism._
- **Q-5** (defect, owner: warwick) — .claude/settings.local.json:199 fires a SessionStart hook at services/control-plane/tower-loop/ensure-watcher.mjs, which does not exist. Every session start runs a hook against a missing file. _Recommendation: Decide repair / remove / work around before adding a Governor SessionStart hook beside it. Repair itself is Tower’s, and Tower is PARKED._
- **Q-1** (question, owner: warwick) — Is BUILD-018 the right identifier, given it was commissioned directly and has no Foundry IDEA-018? _Recommendation: Larry’s call unless Warwick objects; recorded in 00-ESTATE.md._
- **X-1** (external, owner: larry) — GL-012 section 6a is NOT on this branch. Reading GL-012 from this worktree returns the PRE-ruling text and will cause a settled conflict to be re-escalated. _Recommendation: Read it with: git show 95c265d:"Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md"_
- **X-2** (external, owner: larry) — .claude/settings.local.json is globally gitignored, so hook wiring cannot be delivered by git. A ticket that "adds a hook" by editing a file in this worktree ships nothing. _Recommendation: Every hook ticket must also ship an idempotent activation step that installs into the primary checkout’s untracked settings file._

**Safe boundary:** yes — Verified by /rotate-session: 4 safety checks ran and found no obstacle. Tree clean, no unpushed commits, no live worker detected in this worktree.

**Workers (2):**
- phase-1-research-x3 — subagent, **completed**
- t-03-t-13-implementation — subagent, **completed** (T-03)

**Branches:**
- `build-018/session-governor` (build) @ 8cfe7d19ddf8fcf9b7d86930802f9655991b6d9f — This programme. The only branch this build may write to.
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

T-10 landed: the rotation banks, refuses when unsafe, writes the canonical handoff and prints the /clear instruction (137/137 governor tests). The loop is half closed — state gets OUT of a dying session reliably, but does not yet get INTO the fresh one automatically.

**Model recommendation: Opus** — T-11 (reorientation) is the next action and is Opus-tier: it must decide what survives a 10,000-character cap, and getting that wrong silently drops the next action — the single field the whole build exists to carry across a rotation. It also has to resolve two live constraints (X-2 hook-delivery, Q-5 the already-broken sibling SessionStart hook) that are judgement calls, not mechanics. T-04 (evaluator state-space) is also Opus and independent.

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

**THE EXACT NEXT ACTION:** Implement T-11 (reorientation) as Opus: SessionStart(source="clear") -> hookSpecificOutput.additionalContext, a POINTER brief under the hard 10,000-character cap (AD-5). Use isBankingCommit() from tools/governor/rotate-session.mjs for staleness — never a raw HEAD comparison (AD-14). Settle X-2 (settings.local.json is gitignored, so ship an idempotent activation step or the ticket ships nothing) and Q-5 (the already-broken ensure-watcher.mjs SessionStart hook fires every session; decide repair/remove/work-around before adding a Governor hook beside it). Mutation test: oversized state must truncate SAFELY and say it truncated, never silently drop the next action. (ticket T-11)

**Read first:**
- Deliverables/BUILD-018-session-governor/02-MAP.md — the SSOT: architecture, settled decisions, fog, frontier, ticket index
- Deliverables/BUILD-018-session-governor/01-GOAL-CONTRACT.md — the outcome and the 7 invariants; it wins over any ticket
- tools/governor/rotate-session.mjs — T-10: isBankingCommit() is the AD-14 comparison T-11 must use; renderClearInstruction shows what a handoff already carries
- tools/governor/programme-state.mjs — renderSessionHandoff() already derives the full handoff; T-11's brief is a POINTER to it, not a second copy
- Deliverables/BUILD-018-session-governor/02-MAP.md §12 — the broken ensure-watcher.mjs SessionStart hook T-11 must decide about (Q-5)

**Do NOT:**
- Do not open or merge the recovery PR (recovery/2026-07-31-governor-abort-handoff at 95c265d).
- Do not alter local main.
- Do not modify, move or delete the six Cairn intake files under Team Knowledge/Sources/.
- Do not delete or clean any pre-existing worktree without first proving owner, branch, status and disposition.
- Do not run /close-session, and do not start the VlogOps product build.
- Do not re-litigate the settled decisions in 02-MAP.md section 3.
- Do not read GL-012 from this working tree — it is the pre-ruling text. Use git show 95c265d.
- Do not naively compare banked.head_sha against live HEAD without excluding the banking commit itself (AD-14).

_This handoff is derived. 3 field(s) were not established at banking — see above._
