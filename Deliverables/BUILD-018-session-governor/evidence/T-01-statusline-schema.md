---
name: T-01-statusline-schema
type: evidence
build: BUILD-018
ticket: T-01
captured: 2026-07-31
machine: this machine (Warwick's), claude --version 2.1.220
---

# T-01 — Observed statusLine payload schema

**One real payload was captured on this machine** by installing a capture `statusLine`
command in the primary checkout's `C:/Fusion247PKA/.claude/settings.local.json`, sending
a session message to trigger a refresh, and reading the resulting file. The setting was
then restored and proven byte-identical to its pre-ticket state (see handback).

**All values below are redacted or type-only, per §5 of the ticket.** No `session_id`,
`transcript_path`, absolute paths, `cost.total_cost_usd`, or `workspace.repo` values are
reproduced. Where a numeric shape is useful it is described as a range, not a reading.

## Full observed key-set

| Dotted path | JSON type | Status | Note |
|---|---|---|---|
| `session_id` | string | OBSERVED | redacted — never commit |
| `transcript_path` | string | OBSERVED | redacted — never commit |
| `cwd` | string | OBSERVED | redacted — absolute user path |
| `prompt_id` | string | OBSERVED | redacted — never commit |
| `session_name` | string | **OBSERVED — not in 02-MAP.md §2** | free-text auto-generated session title |
| `effort.level` | string | OBSERVED | e.g. `"high"` |
| `model.id` | string | OBSERVED | e.g. `"claude-sonnet-5"` |
| `model.display_name` | string | OBSERVED | e.g. `"Sonnet 5"` |
| `workspace.current_dir` | string | **OBSERVED — not in 02-MAP.md §2** | redacted; absolute path |
| `workspace.project_dir` | string | **OBSERVED — not in 02-MAP.md §2** | redacted; absolute path |
| `workspace.added_dirs` | array | OBSERVED | empty in this capture |
| `workspace.git_worktree` | — | **ABSENT** (not observed in this capture) | see §"Called-out fields" below |
| `workspace.repo.host` | string | OBSERVED | redacted per §5 |
| `workspace.repo.owner` | string | OBSERVED | redacted per §5 |
| `workspace.repo.name` | string | OBSERVED | redacted per §5 |
| `version` | string | OBSERVED | `"2.1.220"` |
| `output_style.name` | string | **OBSERVED — not in 02-MAP.md §2** | e.g. `"default"` |
| `exceeds_200k_tokens` | boolean | **OBSERVED — not in 02-MAP.md §2** | |
| `fast_mode` | boolean | **OBSERVED — not in 02-MAP.md §2** | |
| `thinking.enabled` | boolean | **OBSERVED — not in 02-MAP.md §2** | |
| `cost.total_cost_usd` | number | OBSERVED | redacted — never commit |
| `cost.total_duration_ms` | number | OBSERVED | |
| `cost.total_api_duration_ms` | number | OBSERVED | |
| `cost.total_lines_added` | number | OBSERVED | |
| `cost.total_lines_removed` | number | OBSERVED | |
| `context_window.total_input_tokens` | number | OBSERVED | |
| `context_window.total_output_tokens` | number | **OBSERVED — not in 02-MAP.md §2** | |
| `context_window.context_window_size` | number | OBSERVED | observed `1000000` on this account — **1M, not 200k** |
| `context_window.current_usage.input_tokens` | number | OBSERVED-nonnull | non-null mid-session; ticket's `null` caveat is pre-first-call / post-`/compact` only |
| `context_window.current_usage.output_tokens` | number | OBSERVED-nonnull | |
| `context_window.current_usage.cache_creation_input_tokens` | number | OBSERVED-nonnull | |
| `context_window.current_usage.cache_read_input_tokens` | number | OBSERVED-nonnull | |
| `context_window.used_percentage` | number 0-100 | OBSERVED | |
| `context_window.remaining_percentage` | number 0-100 | **OBSERVED — not in 02-MAP.md §2** | `100 - used_percentage`; convenience field |
| `rate_limits.five_hour.used_percentage` | number 0-100 | OBSERVED | |
| `rate_limits.five_hour.resets_at` | number (unix seconds) | OBSERVED | |
| `rate_limits.seven_day.used_percentage` | number 0-100 | OBSERVED | |
| `rate_limits.seven_day.resets_at` | number (unix seconds) | OBSERVED | |
| `pr.*` | — | **ABSENT** (not observed in this capture) | no open PR found for this session — expected per ticket §7 |
| `worktree.*` | — | **ABSENT** (not observed in this capture) | this session was not a `--worktree` launch — expected per ticket §7 |

## Called-out fields (ticket §6 acceptance list) — explicit verdicts

| Field | Verdict |
|---|---|
| `context_window.used_percentage` | **OBSERVED** |
| `context_window.context_window_size` | **OBSERVED** (`1000000` — see finding below) |
| `context_window.current_usage` | **OBSERVED**, non-null in this capture |
| `rate_limits.five_hour.used_percentage` | **OBSERVED** |
| `rate_limits.five_hour.resets_at` | **OBSERVED** |
| `rate_limits.seven_day.*` | **OBSERVED** |
| `model.id` | **OBSERVED** |
| `effort.level` | **OBSERVED** |
| `session_id` | **OBSERVED** (redacted) |
| `transcript_path` | **OBSERVED** (redacted) |
| `pr.*` | **ABSENT** — not observed in this capture (no open PR; per ticket §7 this is expected, not evidence of non-existence) |
| `worktree.*` | **ABSENT** — not observed in this capture (not a `--worktree` session; expected per ticket §7) |
| `workspace.git_worktree` | **ABSENT** — not observed in this capture (main checkout session; expected per ticket §7) |

## Findings that surprised me

1. **Five fields have no row anywhere in `02-MAP.md` §2**: `session_name`, `output_style.name`,
   `exceeds_200k_tokens`, `fast_mode`, `thinking.enabled`, plus two sub-fields of documented
   parents (`context_window.total_output_tokens`, `context_window.remaining_percentage`) and
   two workspace fields (`workspace.current_dir`, `workspace.project_dir`) that sit alongside
   the documented-but-absent `workspace.git_worktree`. None of this is a problem for the
   architecture — it is pure upside (`exceeds_200k_tokens` and `remaining_percentage` in
   particular are ready-made evaluator inputs) — but the map's field inventory was not
   exhaustive and should be extended, not just resolved.
2. **`context_window.context_window_size` observed as `1000000`, not `200000`.** The map's
   framing ("200k vs 1M denominator") anticipated this as a real possibility, but seeing it
   land on 1M on this actual machine matters for T-04's evaluator: thresholds must stay
   **percentage-based** (already AD's design), never hardcoded against 200k.
3. **The statusLine refresh fired within the same turn**, faster than the ticket's caveat
   ("Warwick may need to send one message") anticipated — no separate message from Warwick
   was required once the hook was installed and a few tool calls executed.
4. **`context_window.current_usage.*` was non-null** on first capture — this session was
   already well into its context (not a fresh session), so the documented pre-first-call
   `null` state was not exercised here. Not a gap in this ticket's scope (§7 explicitly frames
   null as expected-but-not-required-to-observe), noting it so a future reader does not
   mistake "we didn't see null" for "null never happens."

## Restoration proof

`C:/Fusion247PKA/.claude/settings.local.json` was backed up before edit, modified to add a
`statusLine` key, left in place only long enough for one refresh to fire, then restored from
the backup. Verified identical by both `diff` (empty) and `md5sum` (both sides
`70032e2039a9a0c664a6b693fb9f2229`, matching the pre-edit checksum) after restoration — full
transcript in the T-01 handback.
