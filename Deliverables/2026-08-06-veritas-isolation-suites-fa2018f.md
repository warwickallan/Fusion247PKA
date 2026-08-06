# Isolation suite proof at fa2018f (Larry, for Veritas re-review)

**Date:** 2026-08-06  
**Method:** `git archive --format=zip fa2018f` → expand to `%TEMP%\vx-fa2018f-export` → run suites there (no live worktree `.git` for contract; hermetic fixture initialises).

| Suite | Result |
|---|---|
| `node --test tools/wo/envelope.test.mjs` | **64 pass / 0 fail** |
| `node --test .claude/hooks/return-cue.test.mjs` | **11 pass / 0 fail** |

This discharges Veritas **V6-0** (execution under clean export) for the next review of this or a successor head that includes this evidence file.
