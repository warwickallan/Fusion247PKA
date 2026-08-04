---
build: BUILD-015
scope: WP-red-suite-recovery
gate: 1
addendum_to: veritas-wp-red-suite-recovery-0f8a1bc.md
governance_sha: 66d40d38b867d76aeeb698ec89b13aff800552e5
reviewed_sha: 0f8a1bcd715ac04833534bf014a15563f3df9dff
branch: build-015/live-acceptance-recovery-2026-08-03
isolation: PROVEN
reviewed_by: veritas
addendum_date: 2026-08-04
issued_under: GOVERNANCE-VERITAS-CORRECTION-01
---

**Scope of this addendum: provenance only.** It records the two heads, the probes, and the isolation
determination. **No finding in the original receipt is revisited, softened or restated. The `HOLD` stands
on its own merits.**

## The two heads

| Field | Value |
|---|---|
| `governance_sha` | `66d40d38b867d76aeeb698ec89b13aff800552e5` |
| `reviewed_sha` | `0f8a1bcd715ac04833534bf014a15563f3df9dff` |

**They cannot be equal on this review, and this is verifiable rather than argued:**

```
$ git cat-file -e 0f8a1bc:"Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md"
fatal: path 'Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md' exists on disk, but not in '0f8a1bc'

$ git log --format='%H %s' --diff-filter=A -- "Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md"
66d40d38b867d76aeeb698ec89b13aff800552e5 GOVERNANCE: hire Veritas, and remove Larry's authority to grade his own work
```

**How `governance_sha` was determined — and one correction to the coordinator's account.** The dispatch
states the contract was read "from the working tree". **It was not.** Contract and receipt template were
both loaded as git objects, explicitly pinned to `66d40d3`:

- `git show 66d40d3:"Team/Veritas - Internal Quality and Truth Assurance/AGENTS.md"`
- `git show 66d40d3:"Team Knowledge/Templates/veritas-receipt.md"`

Both paths were **clean** in the working tree at review time (probe below), so object and worktree agreed
in any case — but the load was from the object, not the checkout. The governance binding is therefore
pinned by construction and not by the accident of a clean tree.

**Governance material NOT loaded from a pinned object, declared for completeness:** root `CLAUDE.md`
reached me as injected session context from the working tree, not via `git show`; I did not separately
read root `AGENTS.md` or `Team Knowledge/Templates/work-order.md` during the review. Those are named here
rather than implied to have been pinned.

## Probes, verbatim

**Captured at review start** (first tool call of the review):

```
$ git rev-parse HEAD
66d40d38b867d76aeeb698ec89b13aff800552e5

$ git rev-parse --abbrev-ref HEAD
build-015/live-acceptance-recovery-2026-08-03

$ git status --porcelain=v1
 M "Team Knowledge/.obsidian/community-plugins.json"
 M "Team Knowledge/Guidelines/GL-009-public-private-knowledge-boundary.md"
 M services/asdair/db/001_asdair_schema.sql
 M services/asdair/db/004_asdair_regulars.sql
 M services/asdair/skill/planner.js
 M services/hub/youtube/persistCapture.mjs
 M services/hub/youtube/watch-captures.mjs
?? Deliverables/2026-08-03-vlog-build-018-the-governor-episode-LARRY-FIRST-DRAFT-UNAPPROVED.md
?? "Team Knowledge/session-logs/2026/08/2026-08-03-23-48_felix_asdair-details-readable-and-rules-view.md"
?? "Team Knowledge/session-logs/2026/08/2026-08-04-02-15_felix_cockpit-truthful-health-and-the-basket-surface.md"
```

**Captured at review end** — byte-identical to the start probe, HEAD unchanged at
`66d40d38b867d76aeeb698ec89b13aff800552e5`.

**Working directory:** `/c/Fusion247PKA` (`C:\Fusion247PKA`). **Honest note: `pwd` was captured at
addendum time, not at review time.** During the review the directory is evidenced indirectly — every
repository command resolved against `C:\Fusion247PKA`, and every evidence command used an absolute
scratchpad path.

**Captured now, at addendum time — the repository has MOVED since the review:**

```
$ pwd
/c/Fusion247PKA

$ git rev-parse HEAD
37a97c5d44aff63ee1bbafccff889af23aba6c7d

$ git status --porcelain
 M "Team Knowledge/.obsidian/community-plugins.json"
 M services/asdair/skill/planner.js
 M services/hub/youtube/persistCapture.mjs
 M services/hub/youtube/watch-captures.mjs
?? Deliverables/2026-08-03-vlog-build-018-the-governor-episode-LARRY-FIRST-DRAFT-UNAPPROVED.md
?? "Team Knowledge/session-logs/2026/08/2026-08-03-23-48_felix_asdair-details-readable-and-rules-view.md"
?? "Team Knowledge/session-logs/2026/08/2026-08-04-02-15_felix_cockpit-truthful-health-and-the-basket-surface.md"
```

`HEAD` has advanced `66d40d3 → 37a97c5` and Silas's GL-009 and `db/*.sql` changes have been committed
**after** the review closed. Neither affects the evidence, for the reason proven below.

## Proof of the export's identity

**The checkout was dirty throughout the review, and at another head than the one reviewed. Under
`GOVERNANCE-VERITAS-CORRECTION-01` that is a `HOLD` — unless the evidence was isolated from the
checkout. It was, and here is the proof rather than the assertion.**

Export invocation, as executed:

```
$ mkdir -p <scratchpad>/head0f8a1bc
$ git archive 0f8a1bc | tar -x -C <scratchpad>/head0f8a1bc
```

**Independent re-derivation, executed now.** A fresh pristine export of the same head was taken into a
new directory and compared against the exact tree the evidence ran on:

```
$ git archive 0f8a1bc | tar -x -C <scratchpad>/verify0f8a1bc
$ diff -r -x node_modules <scratchpad>/head0f8a1bc <scratchpad>/verify0f8a1bc
diff exit=0        # zero lines of output
```

**Zero differences.** This single probe establishes three things at once:

1. the tree the evidence executed against is **byte-identical to `0f8a1bc`**, not to "some checkout";
2. **every mutation was fully reverted** — MUT-1 to MUT-7 left no residue whatsoever;
3. **no foreign file leaked in.** This mattered: the scratchpad root contained artefacts from a prior
   agent's session (`mutate.mjs`, `probe.mjs`, `joins.js`, `runPipeline.js.orig`, `services/`, `tests/`,
   several `*-baseline.txt`). None of them are inside `head0f8a1bc` — `diff -r` reports no `Only in …`.

Anchors, tying the digests recorded in the original receipt to the head:

```
$ git rev-parse 0f8a1bc^{tree}
0e945ee723a2da20283661fece55a0a67c22df41

$ sha256sum runPipeline.js store.js test/fakePg.js     # in the FRESH pristine 0f8a1bc export
32a905a3b9ee121f2b6f85a729852c4052b31594a2fa542eaae8fd1cb8856c94 *runPipeline.js
1e26dc639d3ce005866cddc6a2046a3e8fb02cee9b8be822735885beddb94541 *store.js
2b5da57bbf2f360d54eb7e0fdae48a0069c0a439c26819d03837500b85d6f0ec *test/fakePg.js
```

All three match the restore-digests recorded verbatim in the original receipt's evidence table.

**The dirty `skill/planner.js` was never executed.** The `skill` suite ran in
`<scratchpad>/head0f8a1bc/services/asdair/skill`, inside the tree proven byte-identical to `0f8a1bc`. I did
not verify the coordinator's finding that the working-tree difference is line-ending-only — that is his
corroboration, not mine, and it is not load-bearing here: the working-tree file was never read by any
evidence command.

**The one component not pinned by `0f8a1bc`: `node_modules`.** Dependencies are gitignored and were copied
from the working tree into the export. Top-level `pg` was verified as matching the version `0f8a1bc`'s own
lockfile pins:

```
installed pg: 8.22.0     0f8a1bc pipeline package-lock.json pins pg: 8.22.0     node: v22.18.0
```

**I did not hash the full transitive dependency tree against the lockfiles.** Named as a bounded residual,
not smoothed over.

## Isolation determination

**PROVEN, not asserted** — with the two bounded exceptions named above (`pwd` captured at addendum rather
than review time; `node_modules` verified at top-level `pg` only).

The determining fact is that **the evidence never touched the checkout.** Every suite run and every one of
the seven mutations executed inside `<scratchpad>/head0f8a1bc`, and that tree is now demonstrated
byte-identical to a pristine `git archive` of `0f8a1bc` by a probe any third party can re-run. The
checkout's dirtiness and its later movement from `66d40d3` to `37a97c5` are therefore irrelevant to the
evidence rather than merely argued to be.

**No evidence in the original receipt was executed against later uncommitted files.**

## The dispatch defect, named at the gate

Recorded because the corrected rule requires it, and because absorbing it silently the first time was the
wrong call: **the dispatch instructed me to read my own contract from a checkout of `0f8a1bc`, where that
contract does not exist.** The instruction was impossible to satisfy as written. I satisfied its intent by
pinning the load to `66d40d3` and did not name the contradiction in the original receipt. Under
`GOVERNANCE-VERITAS-CORRECTION-01` an impossible instruction in a Work Order is to be named at the gate,
not worked around silently. It is named here.

This addendum does not alter the original verdict. **`HOLD` stands, on the findings as originally written.**
