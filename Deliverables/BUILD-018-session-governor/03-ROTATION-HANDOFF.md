---
name: build-018-rotation-handoff-001
type: rotation-handoff
build: BUILD-018
rotation: 001
status: ready
created: 2026-07-31
supersedes: none
---

# ROTATION 001 — Opus architecture → fresh Sonnet implementation

**This file is a hand-built prototype of the artefact `/rotate-session` (T-10) will generate and the
SessionStart hook (T-11) will inject. Building it by hand first is deliberate: it proves the shape and
the 10,000-character constraint before any code is written.**

If you are a fresh Larry reading this after `/clear` — **read this file first, then `02-MAP.md`.**

---

## 1. Who you are and what you are building

You are **Larry**, orchestrator of myPKA. You are continuing **BUILD-018 — Larry Session Governor and
Context-Rotation Layer**, commissioned directly by Warwick on 2026-07-31.

**The outcome:** one logical Larry owns a substantial build across many fresh conversations without
losing product intent, decisions, worker outputs, source-control control or the exact next action —
and Warwick gets a reliable, one-time recommendation when the conversation should be rotated.

You are picking up **after Phase 1 (Opus architecture) completed**. Architecture is settled. **Your job
is bounded implementation, not redesign.**

## 2. Your estate — verified facts, do not re-derive

| | |
|---|---|
| Branch | `build-018/session-governor` |
| Worktree | **`C:/Fusion247PKA-governor`** — work here, not in `C:/Fusion247PKA` |
| Base SHA | `ef96a3327f896e025731769c72157fd722daa02f` (= `origin/main`) |
| Build home | `Deliverables/BUILD-018-session-governor/` |

## 3. Read these, in this order

1. **`02-MAP.md`** — the live map. Architecture, proven telemetry, 13 settled decisions, fog, frontier,
   dependencies, the full ticket index, reusable seams, and a collision warning. **This is the SSOT.**
2. **`01-GOAL-CONTRACT.md`** — the outcome and 7 invariants. If a ticket disagrees with it, the
   contract wins.
3. **`00-ESTATE.md`** — isolation record and two live dependencies you must respect.
4. **`tickets/T-01-prove-statusline-payload.md`** — your first ticket, fully specified.

## 4. The exact next action

**Dispatch T-01 to a Sonnet worker.** It is fully written, read-back-gated, and on the frontier.

`T-01` proves the live statusLine payload on this machine. Everything else depends on it, because
every telemetry field is currently documentation-level evidence only — **nothing has been observed
here yet.**

Also takable in parallel (no dependency between them): **T-02** (health-store location), **T-09**
(programme-state schema), **T-07** (worker/worktree reconciliation). All are specified in `02-MAP.md` §9
with acceptance and mutation tests. T-09 is Opus-flagged; T-02 and T-07 are Sonnet.

**T-01, T-02, T-07 are Sonnet. Do not spend Opus on them.**

## 5. Decisions that are LOCKED — do not re-litigate

Full rationale in `02-MAP.md` §3. The short form:

- statusLine is the primary telemetry source; the transcript is corroboration only and is
  version-fragile — **never** make it primary, and always tail-read (some local transcripts are 40 MB).
- Two separate stores: session health (ephemeral, machine-local) vs programme state (durable, git).
- **`BLIND` is never `GREEN`.** Unreadable telemetry gets its own state and its own exit code.
- Compaction is counted by the `PreCompact` hook, not inferred from the transcript.
- Reorientation rides `SessionStart(source="clear")` → `hookSpecificOutput.additionalContext`,
  **capped at 10,000 characters** — so the injected brief is a *pointer document*, not the state.
- The RED preflight block **fails OPEN**. A governor that traps Warwick in his own session is a worse
  defect than one that misses a rotation.
- The map lives in git, not an issue tracker — **subagents get no MCP tools**, so a tracker-hosted map
  is unreadable by the workers who need it.
- The Governor **derives** `Team Knowledge/fusion-brief/session-handoff.md`; it does not invent a rival
  handoff file.
- `/rotate-session` inherits `close-session` steps **1–3 only**. Steps 4–7 (Librarian pass, graduation,
  ClickUp mirror, self-improvement review) are end-of-programme and must never run on a rotation.

## 6. Two live dependencies you must respect

1. **GL-012 §6a is NOT in this worktree.** The settled private-surface session-log ruling exists only
   on `recovery/2026-07-31-governor-abort-handoff` at `95c265d`. Reading GL-012 from this working tree
   gives you the **pre-ruling** text and will make you re-escalate a settled conflict. Read it with:
   `git show 95c265d:"Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md"`
2. **Hook wiring cannot be delivered by git.** `.claude/settings.local.json` is globally gitignored. A
   ticket that "adds a hook" by editing a file in this worktree **ships nothing** — it also needs an
   idempotent activation step that installs into the primary checkout's untracked settings file.

## 7. ⚠️ Known live defect — not yours to fix

`.claude/settings.local.json:199` fires a SessionStart hook at
`services/control-plane/tower-loop/ensure-watcher.mjs`, **which does not exist**. Every session start
runs a hook against a missing file.

Out of scope (it is Tower's, and Tower is PARKED). **Awaiting Warwick — Q-5.** Do not add a Governor
SessionStart hook beside it until that is decided.

## 8. Hard boundaries — carried from Warwick's commission

- **Do not** open or merge the recovery PR (`recovery/2026-07-31-governor-abort-handoff`, `95c265d`).
- **Do not** alter local `main` (`de92306`, one commit ahead of `origin/main`, unpushed).
- **Do not** modify, move or delete the **six Cairn intake files** under `Team Knowledge/Sources/`.
- **Do not** delete or clean **any** of the 20 pre-existing worktrees (17 `.claude/worktrees/agent-*`
  plus `-audit`, `-tower`, `-w01`) without first proving owner, branch, status and disposition. They
  are baseline evidence, not cleanup permission.
- **Do not** run `/close-session`. **Do not** start the VlogOps product build.

## 9. Open questions for Warwick (do not guess these)

- **Q-2** — bounded override design at RED. Larry recommends: blocks, with an override that expires
  after N prompts.
- **Q-3** — Project ManagAIr portability: design the adapter boundary now (recommended, nearly free) or
  extract later.
- **Q-4** — may rotation auto-commit banked state, or always use Larry's standing push authority?
- **Q-5** — the broken `ensure-watcher.mjs` hook: repair, remove, or work around?
- **Q-1** — is `BUILD-018` the right identifier, given no Foundry `IDEA-018` exists?

## 10. Nothing is in flight

Three research agents ran during Phase 1 and **all completed**. No workers are running. No uncommitted
work exists in this worktree at rotation. Nothing is waiting on you except the tickets above.

## 11. Where the previous conversation ended

Phase 1 complete: isolated estate built and verified at the exact base; telemetry surface researched
and locally probed (version, transcript structure, derived context size); Wayfinder method distilled
and adapted; map, goal contract, estate record and T-01 written; findings written back into the map.

**Rotation was recommended by the very heuristics this build defines** — the Opus context reached
≈61% of its window before the map was written, with the largest research returns already absorbed.
That is the AMBER band in `02-MAP.md` §4, and the honest boundary: architecture was complete and
implementation had not begun, so no work is split across the rotation.
