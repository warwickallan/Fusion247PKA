---
name: T-09-programme-state-evidence
type: evidence
build: BUILD-018
ticket: T-09
created: 2026-07-31
private_surface: none
---

# T-09 — evidence

## 1. Test result

```
$ node --test tools/governor/programme-state.test.mjs
# tests 43
# pass 43
# fail 0
```

Combined governor suite (T-02 + T-07 + T-09):

```
$ node --test "tools/governor/*.test.mjs"
# tests 63
# pass 63
# fail 0
```

(Use the glob, not the bare directory: `node --test tools/governor/` treats the directory
as a single test target and fails — a trap worth not rediscovering.)

## 2. Validation run against the REAL estate

BUILD-018's own live state document was generated from live `reconcile()` output over the
real 22-worktree estate and written **through** the validating writer:

```
WROTE C:\Fusion247PKA-governor\Deliverables\BUILD-018-session-governor\programme-state.json
      schema nodes + rules examined: 1075
RENDERED 13969 chars
```

`readProgrammeState()` re-validates it in the suite, so the live document going stale or
invalid breaks the build rather than being discovered at a rotation.

Live worktree reconciliation captured into the state document: **22 worktrees** —
19 `reconciled-clean`, 2 `unreconciled-dirty` (the primary checkout, carrying the six
protected Cairn intake files, and this build's own tree at generation time),
1 `in-progress-owned`.

## 3. Controls made to fail

INV-5: no control is trusted until it has been made to fail. Each rule was disabled in the
source in turn and the full suite re-run.

| # | Control disabled | Mutation applied | Tests that went red |
|---|---|---|---|
| M1 | Privacy path walk | `if (PRIVATE_PATH_RE.test(str) && …)` → `if (false && …)` | **2** — smuggled path in an ordinary field; smuggled path inside an array element |
| M2 | Empty-collection rule | condition → `if (false)` | **1** — empty collection not declared unknown |
| M3 | Frontier dependency check | `if (t.state === 'frontier' && !resolved)` → `if (false)` | **1** — ticket claiming frontier over an unresolved dependency |
| M4 | HEAD-moved stale detection | `} else if (banked !== headSha) {` → `} else if (false) {` | **1** — real-git move-HEAD test |
| M5 | Required-field enforcement | `if (!(req in value))` → `if (false)` | **3** — required-set sweep; unknown-without-reason; writer fail-closed |
| M6 | GL-012 subtree-shape check | `if (!PRIVATE_SURFACE_RE.test(surface))` → `if (false)` | **1** — over-wide private surface accepted |

Source restored after each; final state **43/43 green**.

Note M5: disabling one rule took down three *different* tests, including the writer's
fail-closed behaviour — the writer's refusal is genuinely downstream of validation, not a
separate string check that happens to agree.

## 4. The required mutation test (02-MAP.md §9, T-09 row)

*"Stale-vs-HEAD detection: move HEAD → state flagged stale."* Implemented against a **real
git repository**, not a mock:

1. `git init`, commit, read HEAD → bank state at that SHA.
2. **Positive control** — `evaluateFreshness` at the banked head with a clean, pushed tree
   returns `stale: false`. Without this the test could pass by always reporting stale.
3. Commit again; assert HEAD **actually moved** (the mutation is verified to have taken
   effect, not assumed).
4. `evaluateFreshness` at the moved head returns `stale: true` with reason `HEAD moved`.

Freshness additionally never reports fresh when it cannot tell — unknown HEAD, unknown
banked head, unknown dirty flag and unknown unpushed count each force `stale: true`. BLIND
is not GREEN, in this component too.

## 5. Privacy enforcement (INV-6 / GL-012)

| Rule | Proven by |
|---|---|
| No `.fusion247` path anywhere except the two declared privacy fields | Rejection tests at top level **and** deep inside an array; every string in the document is walked (`examined > 10` asserted) |
| A private surface must be exactly one `private/<project>/**` subtree | Four rejected shapes: `\.fusion247\**`, `\private\**`, a subtree with no `\**`, and a two-level project path |
| A non-`none` surface requires `private_record` | Rejection test |
| `private_surface` mandatory even when `none` | Rejection test on deletion |
| **Positive control** — a private build is still bankable | `programme-state.private-build.json` validates clean, with `.fusion247` paths in exactly the two permitted fields |
| A private state renders **no** private path into the public handoff | Render test asserts `/\.fusion247/i` does not match the rendered markdown |

The positive control matters: without it, a rule that rejected the path *everywhere* would
pass every negative test while making a private-surface build impossible to bank at all.

## 6. AD-12 compatibility, proven not asserted

`evidence/T-09-rendered-session-handoff.md` is the real render of the real live state.
Asserted by test: the three frontmatter keys (`artefact`, `provenance`, `owner_intent`), the
H1 `# Next-session handoff (resume here)`, and all five H2 sections **in the existing file's
order**. A further test asserts the target file still exists in the repository — if
`session-handoff.md` is ever moved or renamed, AD-12's "derive, do not replace" would
quietly become "create a rival file", and that is caught here rather than at rotation.

`Team Knowledge/fusion-brief/session-handoff.md` was deliberately **not** overwritten by this
ticket: it holds Warwick's curated 2026-07-27 content, and replacing it is T-10's act at a
real rotation.

## 7. Finding: a state file cannot name its own commit (→ AD-14)

Surfaced by generating the live document rather than by reasoning about it. Banking writes
the state and *then* commits it, so `banked.head_sha` can never be the SHA of the commit
carrying the file, and no amend-and-restamp scheme escapes it (the amend changes the SHA
again).

Resolved by definition, not machinery: `banked.head_sha` is the head the state **describes** —
the parent of the banking commit. **T-10 must compare against that parent**, or a naive
`HEAD !== banked.head_sha` check will report every freshly banked state as stale, which would
make the RECOVERY state fire on every single rotation and train Warwick to ignore it.

Recorded as **AD-14** in `02-MAP.md` §3.
