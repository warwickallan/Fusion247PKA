# Branch archive — created by `/reconcile`, 2026-08-14

**Warwick's terminal state is `main` AND NOTHING ELSE.** *"A feature branch is not an archive."*
These bundles hold the unique commits from branches that were retired so that estate could be reached
**without deleting unique work**.

## What is here, and how to get it back

Each `.bundle` holds the commits unique to that branch — `git bundle create <f> <branch> --not main`.
`main` is the prerequisite, which is why they are small.

```sh
git fetch Builds/BUILD-015-.../Archive/<name>.bundle '<branch-ref>:refs/heads/<branch-ref>'
```

| bundle | holds |
|---|---|
| `b15-28-agentic-vision-prototype-v2.bundle` | The agentic vision prototype, **62 prototype files including its frozen runs**, `pipeline/finalise`, and **`runLaneJ.mjs` — the runner that proved the end-to-end journey three consecutive times (shops 108, 109, 111)** |
| `b15-39-browser-handoff.bundle` | Same lineage plus the browser-handoff work |
| `b15-38-terra-invention-analysis.bundle` | Same lineage plus the terra in-enum false-positive analysis *(whose **document** is on `main` at `3e89d79`)* |
| `b15-24-vision-pipeline.bundle` | The earlier vision-pipeline line |
| `../../BUILD-020-proofline/Archive/wo-readiness-validator.bundle` | `tools/wo/dispatch-guard.mjs` + test — **unwired; nothing on `main` referenced it** |

## The restore was PROVEN before any branch was deleted

Not asserted — executed. `git fetch` from `b15-28-agentic-vision-prototype-v2.bundle` produced a ref
**identical to the branch tip `4ca18e8`**, containing `runLaneJ.mjs` and **62** `agenticVisionPrototype`
files. All five bundles pass `git bundle verify`.

## ⛔ What archiving does NOT mean

**Warwick parked the vision architecture and settled it on Terra.** Banking a bundle preserves the
evidence; **it does not reopen the research and must not be read as licence to.** The production path runs
through `cockpit-api` / `receiveList`.
