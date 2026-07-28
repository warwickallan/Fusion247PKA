# 10 — Evidence Log

Chronological record of what was done to produce this audit. No secret values recorded anywhere below.

## Baseline establishment

```
git -C C:\Fusion247PKA rev-parse --show-toplevel        -> C:/Fusion247PKA
git -C C:\Fusion247PKA rev-parse --abbrev-ref HEAD       -> recovery/pr24-team-retro-proposals (at start)
git -C C:\Fusion247PKA rev-parse HEAD                    -> b7fec96cdd4fb365f4f459d63dfc7de88932d41c
git -C C:\Fusion247PKA status --porcelain                -> clean
git -C C:\Fusion247PKA remote -v                          -> origin only, github.com/warwickallan/Fusion247PKA
git -C C:\Fusion247PKA symbolic-ref refs/remotes/origin/HEAD -> refs/remotes/origin/main
git -C C:\Fusion247PKA log --oneline -20                  -> confirmed post-hygiene state (PR #75-#79 merged)
git -C C:\Fusion247PKA worktree list                      -> 3 worktrees pre-audit
```

Switched to `main`, pulled to `ae32ac92b3781d75d0e8e525ce4f153b2a4390c7` (post PR #79 merge), confirmed clean.
Created isolated worktree: `git worktree add -b audit/de-mypka-extraction-20260728 C:\Fusion247PKA-audit main`.
All subsequent work performed inside `C:\Fusion247PKA-audit` unless stated otherwise.

## Upstream comparison

- `gh api repos/myICOR/myPKA` — confirmed real repo, public, default branch `main`, 272 stars, licence
  classified by GitHub as `other`/`NOASSERTION`.
- `gh api repos/myICOR/mypka-scaffold` — confirmed this is a **version stub only**
  ("Version stub so pre-v5 myPKA update checks resolve. Real repo: myICOR/myPKA"), not a real second scaffold.
- `gh api repos/myICOR/myPKA/tags --paginate` — full tag list retrieved. **No `v3.x` or `v4.x` tag exists.**
  Tags jump `v2.4.0` (2026-06-18) → `v5.0.0` (2026-07-07).
- Attempted `gh api repos/myICOR/myPKA/git/refs/tags/v4.1.1` and `.../v3.0.0` — both 404, confirming absence.
- Downloaded `gh api repos/myICOR/myPKA/tarball/v5.0.0` to `/tmp/upstream-compare/v5.0.0.tar.gz` (10.8MB),
  extracted to `upstream-v5.0.0/` (399 files). This is a **temporary external location outside the Fusion
  repo**, per instructions — nothing was added to Fusion's git remotes.
- Extracted Fusion's own initial-import commit (`git -C C:\Fusion247PKA-audit archive 2eb9461 | tar -x`) to
  `/tmp/upstream-compare/fusion-import/` (453 files) for a clean apples-to-apples structural comparison.
- Diffed the two trees: all 399 upstream-v5.0.0 paths exist by name in fusion-import; of those, only 27 are
  byte-identical, 372 differ. **This comparison was discarded as unreliable evidence** — it conflates
  upstream's own evolution between the untagged 4.1.1 and the public 5.0.0 with anything Fusion did. Recorded
  as a limitation in `02-upstream-and-derived-map.md`, not used to classify any component.
- **Reliable signal used instead**: `git diff --name-status 2eb9461 HEAD` inside the Fusion repo itself,
  isolating exactly what Fusion touched regardless of upstream's parallel evolution. Full breakdown: 994
  added, 29 modified, 0 deleted. `comm -23` between the import file list and the changed-file list produced
  the list of 424/445 (root-level count differs slightly by directory scope used per query) untouched files.

## Direct repo investigation performed personally (not delegated)

- Read `LICENSE`, `NOTICE.md`, `LICENSE-MAP.md`, `manifest.json`, `README.md` (attribution section),
  `CLAUDE.md`, `WAY-FORWARD.md`, `CHANGELOG-MIGRATION.md` in full or in relevant part.
- `gh repo view warwickallan/Fusion247PKA --json visibility,isPrivate` — confirmed `visibility=PUBLIC`.
- `git ls-tree -r --name-only 2eb9461 -- .claude/agents/` vs `HEAD` — identified the 11 original vs 5
  Fusion-added specialist shims.
- `git diff --stat 2eb9461 HEAD -- "Team/Larry - Orchestrator/AGENTS.md"` — confirmed +313/-12 growth.
- `git diff --stat 2eb9461 HEAD -- AGENTS.md` and section-header diff (`grep "^## "` before/after) — confirmed
  which root governance trigger-contract sections are upstream vs Fusion-added.
- `comm -12/-13` on `.github/workflows/` file lists at import vs HEAD — confirmed 2 upstream, 8 Fusion-added
  CI workflows, matched against service names.
- Surveyed `Builds/`, `Client Delivery/`, `ideas/`, `supabase/`, `Sources (Immutable)/` top-level structure
  directly; confirmed `BUILD-014` records are NOT in a `Builds/BUILD-014-*` folder but scattered across dated
  `Deliverables/` files — a real organisational inconsistency, noted in `05-defunct-duplicate-and-superseded-candidates.md`.
- `find services/cockpit` + read its README — confirmed this (not `Expansions/mypka-cockpit/`) is Fusion's own
  "Cockpit lift-out of Directus" (IDEA-016) work; confirmed it has **no CI coverage** (grep for its path in
  `.github/workflows/` returned nothing).
- Read `.codex/agents/` git history (`git log --diff-filter=A`) — confirmed all 13 `.toml` shims were added
  2026-07-10, during Fusion's own activation session, as ports of the specialist identities into a second host
  tool — not upstream-shipped material itself, but not independently-authored specialist content either.

## Delegated research (background agents, Explore subagent, read-only, no file writes by the agents themselves)

Four agents dispatched in parallel from the audit worktree, each scoped to a distinct area, each instructed to
report findings as text (not write files) so this session retained sole synthesis/writing authority:

1. **services/ reachability and runtime evidence** — logical component inventory of `services/` (563 files),
   lifecycle classification per component, CI-workflow-to-service mapping, duplicate/supersession analysis,
   generated/vendored grouping, cloud-infra reference sweep.
2. **SOPs/Guidelines/Workstreams provenance** — full P0/P1/P2 split for every SOP/GL/WS, per-specialist
   `AGENTS.md` rewrite-intensity table for all 16 specialists, `Team Knowledge/tasks|session-logs`,
   `Builds/`, `Deliverables/` content characterization, trademark-in-Fusion-content sweep.
3. **Expansions/, PKM/, CI/deployment evidence** — exact diff of the 4 changed Expansions files (of 308),
   Cockpit-vs-Cockpit distinction (`Expansions/mypka-cockpit/` vs `services/cockpit/`), full PKM/ folder
   census with import-vs-added classification (no content read), full `.github/workflows/` census, cloud-infra
   reference sweep (Directus/Neo4j/LightRAG/Honcho/Coolify/Hetzner — confirmed zero Dockerfiles/docker-compose
   anywhere in-repo), `.gitignore` structural read.
4. **Third-party licensing** — package.json census across all 12 manifests, confirmed `node_modules/` not
   committed, nested LICENSE/NOTICE file discovery, AI-authorship-marker frontmatter census, Sources/
   transcript provenance-boundary characterization, Python dependency audit, trademark-in-Fusion-content sweep
   (repo-wide, cross-checked against agent 2's SOP-scoped sweep).

Each agent's full return is preserved verbatim in this session's transcript (task-notification results); this
log summarizes what was asked and confirms no agent was asked to modify, delete, or write any file.

## Validation / checks run

- `git status --porcelain` in the audit worktree, checked before and after every write, to confirm only
  the intended `Deliverables/de-mypka-extraction-audit/` files were ever touched.
- `git diff --stat` scoped to the audit branch before commit, to visually confirm no operational source file,
  licence file, or notice file was altered.
- Repeated `grep -c` spot-checks on Fusion-authored files to confirm licensing agent's raw findings.

## Limitations and unresolved evidence gaps

1. **Exact upstream version Fusion imported cannot be located in public tag history** (no v3.x/v4.x tag) —
   the closest available comparison (v5.0.0) is contaminated by upstream's own subsequent evolution and was
   not used for classification. If a private/membership-distributed copy of exactly v4.1.1 can be obtained
   later, a cleaner diff should be re-run.
2. **PKM/ content was deliberately not read** (per instruction not to expose personal content) — the
   provenance classification of the 4 new `CRM/People` entries and 1 organization added since import
   (genuine Warwick contacts vs further scaffold demo data) is unresolved and flagged, not guessed at.
3. **`services/cockpit/`'s self-declared "no external licence entanglement" claim was not independently
   verified line-by-line** — spot-checked only (README read, no `services/cockpit/`-scoped dependency audit
   beyond its own near-empty `package.json`).
4. Live/external runtime status (Directus, Neo4j, LightRAG, Honcho, the Hetzner/Coolify infrastructure) was
   assessed from repository evidence only — per the non-negotiable boundary, no live VPS service was probed or
   contacted. Classified L6 (external-runtime status unknown) wherever this applies, not asserted as active.
5. No `npm install`/`pip install` or any network dependency-resolution was performed — third-party licence
   findings are based solely on what's declared in committed manifests, which is itself an incomplete
   substitute for a full dependency-tree licence scan (transitive dependencies were not enumerated).

## Assumptions made

- Fusion's own initial-import commit (`2eb9461`) is treated as ground truth for "what the scaffold looked
  like at the moment Fusion received it" — reasonable given it is literally titled "Initial import of
  Fusion247PKA" and the very next commits are personalization/activation work.
- Where a file is byte-identical to import, it is classified P0 with high confidence regardless of what
  upstream may have since changed on its own side (Fusion never touched it, which is the relevant fact for
  this audit's purpose).
