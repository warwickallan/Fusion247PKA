# The active-map repo-wide fallback — EXECUTED verification

**Date:** 2026-08-06 · **Executed by:** Larry (Pax has no `Bash`; this was its single most important unestablished claim)
**Subject:** `resolveActiveMapPath()` in `C:\Users\Buggly\.mypka\governor\continuity.mjs:294`
**Method:** read-only. The function only runs `git rev-parse` / `git grep` / `git log` / `git merge-base` and a `statSync`. **No state was written and the active map was not changed.**

## Verdict in one line

**The hazard is REAL and reachable — but Pax's worked example is REFUTED as stated, and the true
reachable case is more likely to occur than the one it described.**

## The mechanism, from source

```js
let picked = base ? mostRecentlyCommitted(io, repoRoot, candidates, `${base}..HEAD`) : …;
// The fallback fires ONLY on an empty branch scope.
if (!picked.path) picked = mostRecentlyCommitted(io, repoRoot, candidates, null);
```

Branch-scoped first; **repo-wide recency fires whenever the branch has touched no map at all.**

## What was executed

| Worktree | Branch | Maps touched in branch scope | Resolved active map |
|---|---|---|---|
| `C:\Fusion247PKA` | `build-015/live-acceptance-recovery-2026-08-03` | **9** | ✅ `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` |
| `C:\Fusion247PKA-build-020-trial` | `build-020/phase4-automation-law` | many | ✅ `Deliverables/2026-08-04-proofline-wayfinder-plan.md` |
| `C:\Fusion247PKA-research-wayfinder` | `research/wayfinder-transferability` (cut from `origin/main`) | **0** | 🔴 **`Deliverables/2026-08-04-proofline-wayfinder-plan.md`** |

## 🔴 The finding

**PAX-02's worked example is REFUTED for the branch it names.** Resuming BUILD-015 on
`build-015/live-acceptance-recovery-2026-08-03` resolves **correctly** to the Asdair map, because that
branch **has** touched maps (9 commits in branch scope), so the branch-scoped rule wins and the
fallback never fires. The claim that resuming BUILD-015 would select the BUILD-020 map is **not true
of that branch as it stands.**

**But the hazard Pax identified is real, and the reachable case is commoner than the one it described.**
**Any branch with zero map commits in branch scope** falls through to repo-wide recency, which
currently returns the BUILD-020 Proofline map because it is the most recently committed map in the
estate. Demonstrated live above on `research/wayfinder-transferability` — an ordinary, legitimate branch.

**The most likely real-world occurrence is not a resume at all — it is Warwick's question E: creating
a new Wayfinder for a new build.** A new build's branch has, by definition, **no map commits until its
map is first committed**. In that window a fresh Larry is oriented — confidently and silently — to
**Proofline**.

## Why this matters more than an ordinary bug

The module's own contract, quoted from its header:

> *"a confident wrong orientation is worse than a blank one (W-1, named by Warwick). Therefore: emit
> a path only when it is marker-identified, unambiguously selected, and VERIFIED TO EXIST."*

All three stated conditions **are satisfied** by the wrong answer: the Proofline map is
marker-identified, unambiguously selected by recency, and exists. **The function therefore returns a
confident wrong orientation while fully satisfying its own acceptance property.** The defect is not
in the implementation of the rule — it is in the rule. Repo-wide recency is not evidence about *this
branch's* build.

The blast radius scales the wrong way: **the more active the estate's newest build, the more certainly
every map-less branch is misdirected to it.**

## Scope and limits — stated honestly

- **Verified:** the resolution result for three real worktrees at this moment, by executing the real
  function against real git.
- **NOT verified:** that a fresh Larry actually *acts* on the wrong pointer. The Honcho brief is a
  pointer with zero authority and `CLAUDE.md` requires opening the map and verifying by execution. So
  the honest claim is **"the pointer misdirects"**, not "the session proceeds on the wrong build".
  Whether the constitution's own read-the-map discipline catches it is **unestablished** and should
  not be assumed in either direction.
- This note **adds evidence to** PAX-02; it does not replace its recommendations. It is Larry's
  executed verification of one claim, not an independent re-review.
- **No fix is proposed here and none was applied.** Recording a finding is not authority to act on it.
  Whether to change the fallback is Warwick's decision, and PAX-02 §10 already recommends
  prove-before-codify — this note is that proof for one claim.
