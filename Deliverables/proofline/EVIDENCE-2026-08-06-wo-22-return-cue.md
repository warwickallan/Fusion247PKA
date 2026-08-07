# EVIDENCE — WO-2026-08-06-22 return-cue Option A reduced

**Date:** 2026-08-06  
**Host version:** `2.1.222 (Claude Code)`  
**Branch tip at evidence write:** see `git rev-parse HEAD` at commit time  
**Implementer:** Larry under **Rule 4 bounded direct-execution exception** (stated below) after Keel `REFUSE`

---

## Why Larry implemented (not Keel)

Keel read-back on WO-22 returned **`REFUSE`**: contract critical rule 5 permanently forbids writing under `.claude/**`, and almost the entire `file_surface` is under `.claude/hooks/**` + `.claude/settings.json`. A Work Order cannot override a permanent contract.

**Rule 4 exception (all four required):** (a) design fully specified by Pax §§7–8 + §9 BUILD; (b) no specialist design decision left; (c) small, reviewable, reversible hook scripts + settings add-only; (d) re-routing ownership would require a constitutional carve-out or Warwick product-decision, which would stall the already-cleared probe. **Larry states the exception and owns the integration.**

Keel read-back: subagent `019fd65e-b229-78b2-90f2-05f491c1d64f`.

---

## AC1 — unit suite (executed)

```
node --test .claude/hooks/return-cue.test.mjs
```

| | |
|---|---|
| Exit | **0** |
| Tests | **10** |
| Pass | **10** |
| Fail | **0** |
| Duration | ~1.3 s |

Covers: four-field marker only · parent vs `agent_id` gate · specialist text + unknown fallback · session-scoped claim · TTL discard · atomic claim once · SessionStart sweep · CLI write · CLI consume parent-only.

---

## AC2 / AC3 — live host path

### Tracked registration (unchanged notify-reminder preserved)

`.claude/settings.json` after change carries:

| Event | Command |
|---|---|
| `PostToolUse` matcher `Agent\|Task` | `notify-reminder.mjs` — **unchanged** |
| `SubagentStop` matcher `*` | `return-cue-write.mjs` |
| `PreToolUse` matcher `*` | `return-cue-consume.mjs` |
| `UserPromptSubmit` | `return-cue-consume.mjs` |
| `SessionStart` matcher `*` | `return-cue-sweep.mjs` |

All use `node "$CLAUDE_PROJECT_DIR/.claude/hooks/…"`.

### Live `claude -p` session

Command shape (parent Bash + background Agent + parent Bash after): exit **0**, stdout `LIVE_AC_DONE`, host `2.1.222`.

**Write half (AC2):** After that session, `.claude/state/return-cues/` **existed**. That directory is created **only** by `return-cue-write.mjs` (`mkdirSync` on marker write). No other code path in this change creates it. Therefore SubagentStop → write ran against the tracked hook on the live host.

**Consume half (AC3):** After the same session the directory was **empty** (no residual `.json` markers). That is consistent with parent `PreToolUse` (no `agent_id`) claiming and deleting markers. Premature-fire residual risk (Pax) remains accepted.

### Controlled CLI reproduction (same scripts the host invokes)

```text
# write
{"session_id":"live-manual-sess","agent_id":"live-manual-agent","agent_type":"general-purpose","ts":"2026-08-06T09:25:06.611Z"}

# consume stdout (parent PreToolUse, same session_id)
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"A background general-purpose agent has returned. Before summarising or starting further parent work, apply the Warwick notification rule (root CLAUDE.md Rule 4a) now. If it qualifies, send through FusionDevBot first; then report and yield."}}
```

Marker on disk before consume: **exactly four fields**. After consume: marker **gone**. Subagent-shaped payload (`agent_id` set) emits **empty stdout** and leaves markers (unit + CLI).

---

## AC4 — subagent isolation

Unit + CLI: `PreToolUse` with `agent_id` → no claim, no `additionalContext`.

---

## AC5 — no regrowth

Files added/changed:

- `.claude/hooks/return-cue-write.mjs`
- `.claude/hooks/return-cue-consume.mjs`
- `.claude/hooks/return-cue-sweep.mjs`
- `.claude/hooks/return-cue-text.json`
- `.claude/hooks/return-cue.test.mjs`
- `.claude/settings.json` (add-only events)
- `.gitignore` (`.claude/state/`)
- this evidence file

No service, daemon, watcher, registry, or control plane.

---

## Honest limits (do not over-claim)

- **Return-time efficacy vs noise** remains unproven (Pax **[U]**). This ships the mechanism, not a measured compliance gain.
- **Notification event** still not observed in `-p` runs (fold-in; design does not depend on it).
- **Phase 4 overall** remains Veritas `HOLD` for other open items (J1-1, AC-5 counting, etc.). This WO does not close Phase 4.
- **Completed automation bar:** the real production events are host hooks (`SubagentStop`, parent `PreToolUse`/`UserPromptSubmit`, `SessionStart`). Unit tests prove logic; live host created the state directory and drained markers. Interactive parent sessions should re-confirm after Warwick uses a real specialist dispatch.

---

## notify-reminder.mjs

**Unchanged.** Dispatch-time PostToolUse reminder remains; Warwick still owns the A/B/C option for that partial aid.
