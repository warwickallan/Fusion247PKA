---
name: T-09-programme-state-schema
type: work-order
build: BUILD-018
ticket: T-09
ticket_type: implementation
status: resolved
resolved: 2026-07-31
model: Opus
private_surface: none
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor
---

# T-09 — Durable programme-state schema, validator, writer and handoff renderer

## Outcome

Define the durable, git-versioned programme-state contract that `/rotate-session` (T-10)
banks and fresh-session reorientation (T-11) reads — the record that lets one logical
Larry own a build across many conversations without re-briefing.

## Decisions taken (this ticket's architectural calls)

### D-1 — One list of tickets; completed work and the frontier are DERIVED

The commission asks for "completed work" and "remaining frontier" as separate coverage.
They are stored as **one** `tickets[]` list with a `state` and `depends_on`, and both views
are computed (`completedTickets()`, `frontierTickets()`). Two stored lists would let a
ticket appear as both complete and outstanding — the SSOT Golden Rule violated inside a
single file. The map already calls the frontier "computed, not set by hand"; this makes
that literally true, and the validator now **rejects** a ticket that claims `frontier`
while a dependency is unresolved, or sits `blocked` when every dependency is resolved.

### D-2 — `unknown` is a first-class, reasoned list, and an empty collection is an assertion

The map's missing-field rule ("any absent field is `unknown`, never `0`") could not survive
into a durable file without a mechanism, because an empty array reads identically whether it
means *there are none* or *nobody looked*. So: every collection is **required and always
present**, and any collection that was not gathered must be named in `unknown` **with a
reason**. The validator rejects an empty collection that is not declared, and the renderer
prints every declaration under "do NOT read these as 'none'".

This matters most for `workers`: F-7 is open, live-worker detection is best-effort, and a
silent empty list would be read by a fresh Larry as "nothing is running".

### D-3 — Location: with the programme, on the programme's branch

`<programme.home>/programme-state.json`. Not a single estate-wide file, because a build's
durable state describes commits that exist only on its branch; parking it on `main` would
make it lie the moment the branch advanced. The cost is that state on a feature branch is
invisible from another checkout — which is why every pointer carries its own `how_to_read`
retrieval instruction, the same `git show <sha>:<path>` form `00-ESTATE.md` already uses to
reach GL-012 §6a from this worktree.

### D-4 — AD-14: `banked.head_sha` is the head the state DESCRIBES

Found by building it: **a file cannot contain its own commit's SHA**. Banking always writes
the state, *then* commits it, so the state can never name the commit that carries it. Fixed
by definition rather than by machinery: `banked.head_sha` is the head the state describes —
the **parent** of the banking commit — and a consumer comparing against live HEAD must
exclude the banking commit itself. Recorded as **AD-14** in the map; **T-10 must honour it**,
because a naive `HEAD !== banked.head_sha` comparison would report every freshly banked
state as stale.

### D-5 — `session-handoff.md` is rendered, never composed twice

AD-12 says the Governor *derives* the existing handoff file. Compatibility is made
**structural**, not asserted: `locked_decisions[]` and `runtime_pointers[]` are first-class
schema fields that map 1:1 onto the existing file's sections, and `renderSessionHandoff()`
reproduces its three frontmatter keys, its H1 and its five H2 headings **in order** — with a
test asserting the order. `provenance` changes from `curated` to `derived (…) do not
hand-edit`; the existing file's own frontmatter already calls hand-curation a stopgap.

This also satisfies Warwick's document-mirroring rule (2026-07-31): one canonical source
(`programme-state.json`), the mirror generated mechanically from it, never independently
composed.

### D-6 — The writer fails CLOSED; that does not contradict INV-2

`writeProgrammeState` refuses to persist an invalid document. INV-2 ("never trap Warwick")
governs **blocking paths in his live session** — hooks and preflight, which must fail open.
Banking a durable artefact is not such a path: a corrupt banked state is silently wrong for
every future session, which is the failure this build exists to prevent. Session
availability is protected by keeping this writer **off** any blocking path, not by letting
it write rubbish.

### D-7 — The validator interprets the schema file; unimplemented keywords THROW

A second, hand-written copy of the constraints in code would be a second source of truth and
the two would drift. So the validator reads `programme-state.schema.json` and interprets it.
It supports exactly the draft 2020-12 subset the schema uses, and **throws** on any keyword
it does not implement — so a future schema edit reaching for an unsupported constraint fails
loudly instead of being silently unenforced. That is the "control that reported success over
ground it never examined" failure mode, closed at the source.

### D-8 — Privacy (INV-6 / GL-012) is enforced, not documented

Three machine-checked rules, none of them expressible in JSON Schema:

1. **No `.fusion247` path may appear anywhere in the document** except in
   `privacy.private_surface` and `privacy.private_record`. Every string in the document is
   walked, including deep inside arrays.
2. **A non-`none` surface must be exactly one `private/<project>/**` subtree** — GL-012 denies
   the root, siblings and parents, so `C:\.fusion247\**` and `C:\.fusion247\private\**` are
   both rejected.
3. **A non-`none` surface requires `private_record`** — the public repo carries a marker, the
   full record lives privately (INV-6).

`privacy.private_surface` is **mandatory even when `none`**, for the same reason the Work
Order gate makes it mandatory: an optional field is a gate that quietly fails to fire.

## Delivered

| Path | What |
|---|---|
| `tools/governor/programme-state.schema.json` | The contract. 18 required top-level fields; every design reason written into `description`s. |
| `tools/governor/programme-state.mjs` | Schema-interpreting validator, privacy guard, consistency checks, freshness/stale detection, derived views, atomic read/write, handoff renderer. |
| `tools/governor/programme-state.test.mjs` | 43 tests. |
| `tools/governor/fixtures/programme-state.minimal.json` | Valid base; every mutation test breaks exactly one thing in it. |
| `tools/governor/fixtures/programme-state.private-build.json` | Private-surface build — the positive control proving rule D-8.1 does not make a private build unbankable. |
| `Deliverables/BUILD-018-session-governor/programme-state.json` | **BUILD-018's own live state**, generated against the real 22-worktree estate via T-07's `reconcile()`. |
| `evidence/T-09-rendered-session-handoff.md` | The handoff rendered from that live state — proof of AD-12 compatibility against real data. |

## Acceptance criteria

- [x] Schema captures current phase, completed work, remaining frontier, blockers, model
      recommendation, workers, branches, PRs, worktrees, safe boundary and the exact
      resumption point. A test asserts each has a home in the schema **and is required**.
- [x] Compatible with the existing `fusion-brief/session-handoff.md` contract — rendered from
      it, with frontmatter keys, H1 and all five H2 sections asserted **in order**.
- [x] Private-build boundaries preserved and enforced (D-8), with a positive control.
- [x] Schema validation, fixtures and mutation-quality tests: **43/43 passing**.
- [x] Validated against the **real** estate, not only fixtures — 1,075 checks over
      BUILD-018's own live state document.

## Mutation tests

The map's required mutation test for T-09 — *"Stale-vs-HEAD detection: move HEAD → state
flagged stale"* — is implemented against a **real git repository** (init, commit, bank,
commit again), with a positive control asserting `stale: false` at the banked head first, so
the test cannot pass by always reporting stale.

Every control was then **made to fail**. Each rule was disabled in turn and the suite re-run:

| Control disabled | Tests that went red |
|---|---|
| Privacy path walk | 2 |
| Empty-collection rule | 1 |
| Frontier dependency check | 1 |
| HEAD-moved stale detection | 1 |
| Required-field enforcement | 3 |
| GL-012 subtree-shape check | 1 |

Restored, and 43/43 green again. A control nobody has seen fail is not evidence.

Also asserted: validation reports a **non-zero count of checks actually run** (INV-5), broken
down by schema / privacy / consistency, and the required-field mutation test asserts it
exercised the *entire* required set rather than a sample.

## Handback

**One thing the order did not settle, resolved as D-4 and recorded as AD-14:** a state file
cannot name its own commit. T-10 must compare against the banking commit's **parent**, or it
will report every freshly banked state as stale.

**Newly split out: T-13 (Sonnet).** Building the schema made the seam obvious — mapping live
git / `worktree-recon` / `gh` output onto a fixed, validated schema is mechanical, while
deciding *whether the estate is safe to rotate* is judgement. Keeping both in T-10 would have
spent Opus on adapter plumbing. T-13 takes the collection; T-10 keeps only the refusal
decision.

`Team Knowledge/fusion-brief/session-handoff.md` was **not** overwritten. It carries Warwick's
curated 2026-07-27 content, and replacing it is T-10's act at a real rotation, not this
ticket's. The render is proven into `evidence/` instead.
