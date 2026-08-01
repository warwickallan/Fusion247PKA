---
name: build-018-closure-journey-proof
type: evidence
build: BUILD-018
date: 2026-08-01
status: proven
---

# BUILD-018 closure — the real user journey, proven by execution

Warwick's cut-and-close instruction required that, **before** BUILD-018 closes, the real
user journey be proven from his normal entry point. This is that proof.

**Result: 7 / 7 PROVEN.** Harness archived alongside this file as
[`prove-journey.mjs`](./prove-journey.mjs); re-runnable, and it fails loudly rather than
degrading to a pass.

## How this was run, and why it is worth anything

Every check spawns the **real module as a real subprocess** with a real hook payload.
Nothing is imported in-process. That distinction is the entire lesson of the diagnosis:
the estate had 767 tests proving the *libraries* worked, and Nolan still found the whole
installed hook set had fired **zero times, ever**. An in-process import would have
reproduced exactly that mistake.

Entry point: `C:/Fusion247PKA` — the primary checkout. Warwick launches Claude Code and
it opens there. He is never asked to `cd` into a build worktree; being asked to would
itself fail acceptance item 4.

## The seven items

| # | Item | Verdict |
|---|---|---|
| 1 | Fresh session + `continue`, no re-briefing | ✅ PROVEN |
| 2 | Authoritative instructions and agent roster recovered | ✅ PROVEN |
| 3 | Active build recovered and automatically routed | ✅ PROVEN |
| 4 | No Git, worktree, gate or model administration handed to Warwick | ✅ PROVEN |
| 5 | Goal / Done / Now / Next / Blocked / Safe visible in Cockpit | ✅ PROVEN |
| 6 | Task-aware context and model advice | ✅ PROVEN |
| 7 | Autonomous continuation through routine boundaries | ✅ PROVEN |

**1–3.** `reorient.mjs` run as a SessionStart subprocess from the primary checkout emits
an 8,902-character brief that names BUILD-018, resolves the canonical worktree, states the
next ticket, and points at `CLAUDE.md` / `AGENTS.md` and the specialist roster. Nothing
was typed by Warwick beyond `continue`.

**4.** 10,498 characters of Warwick-visible output — the reorientation brief plus the
wrong-worktree refusal — scanned against six admin-request patterns (asks-to-run-git,
model selection, gate justification, relaunch). **None matched.** The refusal carries
`RECOVERY — Larry performs this AUTOMATICALLY; Warwick does nothing`. The scan
deliberately distinguishes the guard's *prohibition* ("Larry must NOT ask Warwick to
relaunch") from an actual request, rather than counting the substring.

**5.** Fetched live from the running Cockpit on `127.0.0.1:8090` — not from disk. All six
headings present in the served document.

**6.** The claim is not "a footer renders". It is that the advice **changes** with whether
a next action is established, and that the safety signal survives when it is not:

```
task known          → ⟦GOV⟧ ctx 37% · GREEN · KEEP GOING   · next: Sonnet · CONTINUE
task unknown        → ⟦GOV⟧ ctx 37% · GREEN · TASK UNKNOWN · next: UNSET  · CONTINUE
task unknown + RED  → ⟦GOV⟧ ctx 94% · RED   · CLEAR NOW    · next: UNSET  · CONTINUE
```

**7.** Both directions, because a control proven only in the comfortable direction is not
proven. A routine `CONTINUE` boundary → the controller **blocks the stop** and the session
continues autonomously. `HANDBACK:merge-decision` → the controller **lets the session end**
so Warwick is actually asked.

## What this proof does NOT cover — stated, not buried

- **Items 1–3, 6 and 7 require an ACTIVE programme.** They were run against BUILD-018
  while it was still `active`, immediately before the closure state was banked. A closed
  programme correctly produces "nothing to resume", correctly renders `TASK UNKNOWN`, and
  correctly lets every stop through — so the closed state cannot exercise these branches
  at all. Running the harness *after* closure yields 5/7, and that is the harness
  measuring branches the state deliberately does not enter, not a regression.
- **Reorientation needs to start inside some checkout of the estate.** Run from `C:/`,
  which is not a git repository, it fails — loudly and honestly (`REORIENTATION FAILED …
  reorient by hand`), which is INV-1 working. This bound was previously mitigated by
  `build-registry.mjs`'s machine-wide index; that module was cut, so the bound is now
  real and is recorded here rather than hidden.
- **Hooks bind at process launch.** Any hook change is inert until Claude Code is fully
  restarted. That is a host limitation no committed code can remove. It is not git,
  worktree, gate or model administration, so it does not breach item 4 — but it is an
  action only Warwick can take, and pretending otherwise would be dishonest.
- **This is builder evidence, not independent review.** The pre-merge QA gate
  (`merge-readiness.mjs`) was itself removed by the cut. Warwick authorised the merge of
  the retained spine explicitly and in knowledge of that; the obligation is discharged by
  his decision, not by a control.

## Supporting state at the time of proof

- Governor test suite: **496 / 496 passing, 0 failing**.
- Retained spine: 14 modules. Removed: 8 modules + tests + one schema + the `/build`
  command whose entire mechanism was cut.
- The new advice rule was **mutation-tested**: reverting `adviceFor` to its first (wrong)
  draft turned 4 tests red, including its own; reverted clean afterwards.
- One leftover BUILD-018 worker worktree (`C:/Fusion247PKA-wo-07`, fully merged, clean)
  was removed during closure — it held a stale copy of the programme state that was
  injecting a dangling `delegation-gate.mjs` pointer into the live brief. That was found
  **by this harness**, not by inspection.
