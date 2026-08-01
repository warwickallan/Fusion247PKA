---
name: T-01-prove-statusline-payload
type: work-order
build: BUILD-018
ticket: T-01
ticket_type: prototype
status: resolved
resolved: 2026-07-31
model: Sonnet
private_surface: none
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor
base_sha: ef96a3327f896e025731769c72157fd722daa02f
isolation: none (read-back gated — do NOT use worktree isolation, see §0)
---

# T-01 — Prove the live statusLine payload on this machine

## 0. READ-BACK GATE — do this before touching anything

Before any action, restate:
1. **the OUTCOME** in your own words (paraphrase — restating this order verbatim is not a read-back);
2. your **plan**;
3. what this order **failed to settle**;
4. anything here that **looks wrong**.

Then STOP and wait. Write no files at the read-back.

**This order is deliberately NOT worktree-isolated.** A read-back gate and `isolation: "worktree"`
collide: the worktree is auto-cleaned when a worker correctly writes nothing at read-back, so
accepting the read-back resumes into a deleted directory. Work in `C:/Fusion247PKA-governor` directly.

## 1. Why this ticket exists

Every field the Session Governor depends on is currently **[DOC]-level evidence only** — read from
documentation and inferred safe because `claude --version` is `2.1.220`, above every known version
gate. **Nothing has been observed on this machine.**

The whole build rests on these fields existing. If `context_window.*` or `rate_limits.*` are absent or
differently named here, the architecture changes. **We do not build on documentation we have not
verified.**

## 2. Outcome

**A single real statusLine payload, captured from this machine, with its key-set and value types
recorded in the repository — and every field in `02-MAP.md` §2 marked OBSERVED or ABSENT.**

## 3. The one hard rule

**If documented fields are ABSENT: STOP and report. Do NOT redesign the programme, do not invent a
fallback, do not "work around it".** Absence is a finding of the highest value and it is Larry's call
what follows. A worker that quietly routes around a missing field converts a known-unknown into a
silent wrong assumption baked into everything downstream.

Equally: **do not report a field as OBSERVED unless you have seen it in the captured payload.** Do not
infer presence from the docs. That inversion is the entire point of this ticket.

## 4. Method (free — bound to the outcome, not these steps)

Suggested shape; deviate if you find better, and say why:

1. Write a capture script — reads stdin to EOF, writes it verbatim to a file, prints a short harmless
   status string to stdout (statusLine renders stdout, so it must stay one short line).
2. Install it as `statusLine` in the **primary checkout's** `C:/Fusion247PKA/.claude/settings.local.json`.
   - **Back the file up first.** It is ~25KB, untracked, globally gitignored, and NOT recoverable from
     git if you corrupt it. That makes it the single most dangerous artefact this ticket touches.
   - Edit it by **parse → modify → write** (JSON-safe), never by string surgery.
   - `statusLine` is currently **ABSENT** from that file, so this is a pure addition — nothing to clobber.
   - Shape: `{"type":"command","command":"node <abs-path-to-capture-script>"}`
3. Trigger a refresh. statusLine fires on session start, on each new assistant message, and after
   `/compact`. **Warwick may need to send one message in a session for this to fire** — if you cannot
   trigger it yourself, say so and hand back rather than guessing at the payload.
4. **Restore `settings.local.json` to its exact prior state.** Verify by diffing against your backup.
   Leaving a statusLine installed is a defect, not a leftover.
5. Record the schema (below) and update `02-MAP.md` §2.

## 5. Redaction — mandatory

Commit the **schema, not the payload**. For every field record: full dotted path, JSON type, and
whether present. Redact all values. Specifically **never commit**: `transcript_path`, `session_id`,
`prompt_id`, absolute user paths, `cost.total_cost_usd`, or anything under `workspace.repo`.

Numeric *shape* may be described (`used_percentage: number 0-100`) — actual readings must not be
committed.

## 6. Acceptance criteria

- [x] A real payload was captured on this machine (not synthesised, not doc-derived).
- [x] `Deliverables/BUILD-018-session-governor/evidence/T-01-statusline-schema.md` exists, listing
      every observed dotted key path + type, values redacted.
- [x] Every row of `02-MAP.md` §2 is marked **OBSERVED** or **ABSENT**. No row left at `[DOC]`.
- [x] These are called out explicitly, each OBSERVED or ABSENT:
      `context_window.used_percentage` · `context_window.context_window_size` ·
      `context_window.current_usage` · `rate_limits.five_hour.used_percentage` ·
      `rate_limits.five_hour.resets_at` · `rate_limits.seven_day.*` · `model.id` · `effort.level` ·
      `session_id` · `transcript_path` · `pr.*` · `worktree.*` · `workspace.git_worktree`
- [x] `settings.local.json` is byte-identical to its pre-ticket state (show the diff proving it).
- [x] The capture script is left in the worktree under `tools/` as a reusable probe — it becomes the
      basis for T-03's sampler.
- [x] Nothing outside `C:/Fusion247PKA-governor` is modified, except the temporary and fully-reverted
      `settings.local.json` change.

## 10. Resolution — 2026-07-31

**Outcome met — see `evidence/T-01-statusline-schema.md` for full detail.**

Explicitly authorised by Warwick (this order's §0 read-back surfaced a real conflict between
this ticket's method and the dispatching session's top-level "do not modify C:/Fusion247PKA"
boundary; Warwick approved the bounded backup→install→trigger→restore→diff-prove sequence
and nothing beyond it).

Both `context_window.*` and `rate_limits.*` observed present with documented names.
`context_window_size` observed as `1000000` (1M, not 200k) on this account — confirms
percentage-based thresholds (already the design) are the right call. `pr.*`, `worktree.*`,
`workspace.git_worktree` all ABSENT in this capture — expected per §7's own caveats (no open
PR; session was the main checkout, not a `--worktree` launch), not evidence they never appear.

Several fields not in `02-MAP.md` §2 at all were also observed: `session_name`,
`output_style.name`, `exceeds_200k_tokens`, `fast_mode`, `thinking.enabled`,
`context_window.total_output_tokens`/`remaining_percentage`, `workspace.current_dir`/
`project_dir`. Catalogued in the evidence file; map §2 updated to include them.

`settings.local.json` restoration proven byte-identical by both empty `diff` and matching
`md5sum` (`70032e2039a9a0c664a6b693fb9f2229`) against the pre-edit checksum.

Capture script retained at `tools/capture-statusline.mjs` (kill-tolerant, temp+rename) for
T-03 to build on.

## 7. Known caveats to expect (do not treat these as failures)

- `context_window.current_usage` is **`null`** before the first API call and after `/compact` until the
  next call. A `null` here is expected behaviour, not an absent field — record it as OBSERVED-nullable.
- `rate_limits` appears **only for Pro/Max plans, after the first API response**, and the two windows
  may be independently absent. If absent, record ABSENT and note the plan caveat — do **not** conclude
  the field does not exist in the payload format.
- `worktree.*` is present only in `--worktree` sessions; `workspace.git_worktree` is absent in the main
  worktree. Absence in the primary checkout is expected and is not evidence of anything.
- `pr.*` appears only while an open PR is found.

Per the estate's standing rule on negative claims: report **"not observed in this capture"**, never
"does not exist".

## 8. Do NOT

- Do not touch local `main`, the `recovery/2026-07-31-governor-abort-handoff` branch, the six Cairn
  intake files under `Team Knowledge/Sources/`, or **any** of the 20 pre-existing worktrees.
- Do not repair, remove or edit the broken `ensure-watcher.mjs` SessionStart hook entry
  (`settings.local.json:199`). It is a known live defect, recorded in `02-MAP.md` §12, and it is
  **out of scope** — it belongs to Tower and awaits Warwick's decision.
- Do not open or merge any PR.
- Do not run `/close-session`.

## 9. Handback

Return: the schema file path, the OBSERVED/ABSENT verdict per field, the `settings.local.json`
restoration proof, and **anything that surprised you**. If a documented field is ABSENT, lead with that
— it is the most important thing you can tell me.
