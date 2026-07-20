# Findings Ledger (interim — precursor to the Supabase `finding` table)

**Durable record so open findings can't vanish between rounds** (the failure Warwick diagnosed). This is the manual stand-in for the proposed `finding` table until it's built. A new review round must consume + update this, never silently forget a row.

Columns: ID · first SHA · reviewer · description · impact · reachability · disposition · merge-blocker · correction SHA · verification · state.

## BUILD-014 / IDEA-013 — TubeAIR watcher (PR #47, verified head `f07873e`)
Requirement (persistent single-user local watcher) MET and Fable-executed-verified. Residuals below are tracked, non-blocking.

| ID | first SHA | reviewer | description | impact | reachability | merge-blocker | state |
|---|---|---|---|---|---|---|---|
| F-047-A | f07873e | Codex | `--dry-run` still charges retry attempts to pending pairs | LOW | edge (dev-only `--dry-run` mode) | no | **deferred** |
| F-047-B | f07873e | Codex | a healthy pair can be charged a retry attempt on a *watcher-local cycle* failure (not its own fetch) → could exhaust over repeated cycle errors | MED | needs repeated watcher-local errors (signals real breakage); fail-safe (errs to *less* egress) + self-heals | no | **deferred** — revisit if it manifests; cheap targeted fix available (charge only on actual fetch-and-fail) |
| F-047-C | f07873e | Codex | the `.bak` `copy2` is not itself fsync'd | LOW | second-order — only matters if the primary *also* corrupts in the same window | no | **deferred** |

Closed this round (verified-fixed by Fable execution): backup-clobber, ledger-failure-swallow, exhausted-capture-egress.

## IDEA-012 — AsdAIr normaliser (PR #48, verified head `87590e0`)
Requirement (household list parser: never silently mis-parse/drop; surface ambiguous) MET and Larry-executed-verified.

| ID | first SHA | reviewer | description | impact | reachability | merge-blocker | state |
|---|---|---|---|---|---|---|---|
| F-048-A | 87590e0 | Codex | multi-token leading word-number → `needs_review` may over-flag some common multi-word items ("two percent milk") | LOW | occasional | no | **deferred** — adjudicated: review > silent mis-parse (correct never-guess). Revisit only if real lists show over-flagging; extend the collision table then. |

## Tracked before-live (from earlier reviews — must land before live-apply, not before DEV merge)
| ID | build | description | disposition | state |
|---|---|---|---|---|
| F-MM-A | multimodal | sanitize transcriber error strings before logging | required-before-live | open |
| F-MM-B | multimodal | checkpoint transcription result so a write-retry doesn't re-invoke the paid model | required-before-live | open |
| F-MM-C | multimodal | dedup comment overstates re-send behaviour | cosmetic | open |
| F-014-BLH | BUILD-014 | authoritative-current-head DB-structural bundle (WP-D0/WP-C perimeter) | required-before-live | open |
| F-046-A | tubeair cleanup #46 (`d4a2020`) | §7.1 reading-view seam over-collapse (raw + immutable preserved verbatim) | adjudicated **acceptable bounded limitation, non-blocking** by Codex product-QA + Larry exec; fold-or-fix = Warwick's call at the gate (cheap timing-gap-aware fix available) | open |

## MERGED to main (Warwick-authorised, exact-head guarded, 2026-07-20)
- **#45** ranker `295eafc` → merge `90363b1` ✓
- **#48** normaliser `87590e0` → merge `fffcf64` ✓
- **#47** watcher `f07873e` → merge `7dbeea4` ✓ (code only — watcher NOT started against live inbox)
- **#46** tubeair cleanup `248e057` → merge `b6a1a43` ✓ (**F-046-A FIXED** — timing-gap-aware dedup; reading view loses nothing)

Their deferred residuals (F-047-A/B/C, F-048-A) remain open + tracked above — non-blocking, revisit only if they manifest.

## Merge-ready but HELD (per Warwick 2026-07-20)
- **multimodal** DEV opt-in increment (`573ae37`) — reviewed merge-ready; held (not in the authorised batch).
- **#46** — needs final exact-head TubeAIR evidence + Warwick's fix/fold on F-046-A.
- **#43** WP-D inc-1 · **#33** SOP-019 (Foundry-redesign hold) · **#49** docs (sanity pass) · **#24** stale.
