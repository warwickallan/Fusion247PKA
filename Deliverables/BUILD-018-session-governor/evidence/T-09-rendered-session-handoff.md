---
artefact: session-handoff
provenance: derived (2026-07-31, BUILD-018 Governor v1 — rendered from Deliverables/BUILD-018-session-governor/programme-state.json, NOT hand-curated)
owner_intent: consumed by the next Larry session. Regenerate on every rotation; do not hand-edit.
---

# Next-session handoff (resume here)

## Where we are

**BUILD-018 — Larry Session Governor and Context-Rotation Layer** (active). Phase: **Phase 2 — bounded implementation**.

Phase 1 (Opus architecture) is complete and settled: 13 architecture decisions, the map, the goal contract and the estate record are written. Phase 2 is implementing the seven components against that architecture. T-01 (live statusLine payload proven on this machine), T-02 (session-health store, atomic write) and T-07 (worktree reconciliation) are resolved, tested and pushed. T-09 has now defined the durable programme-state schema this document is an instance of — the machine-readable SSOT that /rotate-session banks and fresh-session reorientation reads, rendering Team Knowledge/fusion-brief/session-handoff.md rather than competing with it.

Branch `build-018/session-governor` in worktree `C:/Fusion247PKA-governor`, HEAD `c9df07782b3de210b123e0b508c9c4ba234187ec` (base `ef96a3327f896e025731769c72157fd722daa02f`). Banked by Opus at 2026-07-31.

**Completed (4):**
- **T-01** — Prove the live statusLine payload on this machine _(resolved 2026-07-31)_
- **T-02** — Session-health store location and atomic write _(resolved 2026-07-31)_
- **T-07** — Worker and worktree reconciliation _(resolved 2026-07-31)_
- **T-09** — Programme-state schema, validator and writer _(resolved 2026-07-31)_

**Frontier — takable now (3):**
- **T-03** [Sonnet] — Sampler: statusLine script to health sample
- **T-10** [Opus] — /rotate-session: bank, verify safety, emit the /clear instruction
- **T-13** [Sonnet] — Programme-state collector: gather the live estate into a valid state document

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

**Safe boundary:** yes — T-09 completes as a whole: schema, validator, writer, renderer, fixtures and tests all land in one commit, and no ticket is split across the rotation. The build worktree is otherwise clean and pushed; every other worktree is either reconciled-clean or is the primary checkout carrying six untracked Cairn intake files that this build is forbidden to touch.
  - obstacle (live-worker): The primary checkout reports live node PIDs, but F-7 makes this best-effort only — process-command-line matching cannot distinguish a governor worker from any other node process. Treat as unknown, not as a confirmed live worker.
  - obstacle (dirty-tree): C:/Fusion247PKA is dirty with six untracked Team Knowledge/Sources Cairn intake files. Pre-existing, out of this build’s scope, and explicitly protected by the commission.

**Workers (1):**
- phase-1-research-x3 — subagent, **completed**

**Branches:**
- `build-018/session-governor` (build) @ c9df07782b3de210b123e0b508c9c4ba234187ec — This programme. The only branch this build may write to.
- `main` (protected) — Local main is at de92306, one commit ahead of origin/main and unpushed. MUST NOT be altered by this build.
- `recovery/2026-07-31-governor-abort-handoff` (recovery) @ 95c265de729e26114b1e1eb7dc7d8630502aca1d — Carries the settled GL-012 section 6a ruling. Read-only for this build; its PR must not be opened or merged.

**Pull requests:**
- (unnumbered) Recovery handoff (GL-012 section 6a + cockpit private-API proxy) — **none** — Not opened, and this build is explicitly forbidden to open or merge it.
- (unnumbered) BUILD-018 session governor — **none** — No PR opened for this build yet; opening one is out of scope for the current session.

**Worktrees (22):** 2 unreconciled, 0 unreadable.

**Not established at banking — do NOT read these as "none":**
- `workers` — Only completed Phase 1 research agents are recorded. Live worker detection is best-effort under F-7 and cannot confirm the ABSENCE of a running worker, so this list is not an enumeration.
- `pull_requests` — The GitHub PR surface was not queried during this banking. The two entries are locally known facts, not an enumeration of open PRs.
- `branches.behind` — No fetch was performed during this banking, so behind-counts against the remotes were not computed.

## What the NEXT session is about

Implement the two newly takable Sonnet tickets, then return to Opus for the rotation command. T-03 turns the proven statusLine payload into a written health sample; T-13 turns live git and worktree output into a valid programme-state document. Together they leave T-10 (/rotate-session) owning only judgement — whether the estate is safe to rotate — rather than also owning data collection.

**Model recommendation: Sonnet** — Both remaining Sonnet-tier frontier tickets are now takable and are mechanical: T-03 (sampler over an already-proven payload, with an existing capture script to reuse) and T-13 (collector mapping already-written git/worktree output onto an already-validated schema). Neither requires architectural judgement — the architecture is settled in 02-MAP.md section 3 and the schema is now fixed. Spend Opus on T-10 (refuse-or-proceed judgement) and T-04 (state-space design) once T-03 and T-13 land.

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

## Runtime pointers

- **The map (SSOT)** — `Deliverables/BUILD-018-session-governor/02-MAP.md` — On branch build-018/session-governor. From another checkout: git show build-018/session-governor:"Deliverables/BUILD-018-session-governor/02-MAP.md"
- **Durable programme state** — `Deliverables/BUILD-018-session-governor/programme-state.json` — Validate before trusting: node -e "import('./tools/governor/programme-state.mjs').then(m=>console.log(m.readProgrammeState('Deliverables/BUILD-018-session-governor/programme-state.json')))"
- **State schema** — `tools/governor/programme-state.schema.json` — Interpreted directly by the validator in tools/governor/programme-state.mjs — it is the single source of the constraints, not a description of them.
- **Session-health store** — `tools/governor/health-store.mjs` — Default root ~/.mypka/governor/health/<projectKey>/<sessionId>.json; override with MYPKA_GOVERNOR_HEALTH_DIR.
- **Worktree reconciliation** — `tools/governor/worktree-recon.mjs` — reconcile({repoPath, primaryPath, buildPaths}) returns every worktree with classification, disposition and best-effort live worker PIDs.
- **statusLine capture** — `tools/capture-statusline.mjs` — Kept from T-01 for T-03 to reuse.
- **GL-012 section 6a (settled ruling, NOT on this branch)** — `Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md` — git show 95c265d:"Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md"
- **Ding Warwick on handback** — `larry-ding.mjs (private surface, permission-allowlisted)` — Message is read from a FILE, not argv.
- **Tests** — `tools/governor/*.test.mjs` — node --test "tools/governor/*.test.mjs" — use the glob; the bare directory form fails.

## How to resume

**Work in `C:/Fusion247PKA-governor` on branch `build-018/session-governor`.**

**THE EXACT NEXT ACTION:** Dispatch T-03 (sampler) to a Sonnet worker with a read-back gate, using tools/capture-statusline.mjs from T-01 and writeHealthSample from T-02. T-13 (collector) may be dispatched in parallel: it touches different files (tools/governor/collect-state.mjs) and shares no file with T-03. (ticket T-03)

**Read first:**
- Deliverables/BUILD-018-session-governor/02-MAP.md — the SSOT: architecture, 13 settled decisions, fog, frontier, ticket index
- Deliverables/BUILD-018-session-governor/01-GOAL-CONTRACT.md — the outcome and the 7 invariants; it wins over any ticket
- Deliverables/BUILD-018-session-governor/00-ESTATE.md — isolation record and two live dependencies
- tools/governor/programme-state.schema.json — the durable state contract T-13 must satisfy

**Do NOT:**
- Do not open or merge the recovery PR (recovery/2026-07-31-governor-abort-handoff at 95c265d).
- Do not alter local main (de92306, one commit ahead of origin/main, unpushed).
- Do not modify, move or delete the six Cairn intake files under Team Knowledge/Sources/.
- Do not delete or clean any of the 20 pre-existing worktrees without first proving owner, branch, status and disposition.
- Do not run /close-session, and do not start the VlogOps product build.
- Do not re-litigate the 13 settled decisions in 02-MAP.md section 3.
- Do not read GL-012 from this working tree — it is the pre-ruling text. Use git show 95c265d.

_This handoff is derived. 3 field(s) were not established at banking — see above._
