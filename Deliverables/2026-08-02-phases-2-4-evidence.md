# Operating-reset Wayfinder — Phases 2–4 evidence

_2026-08-02. Autonomous execution of Phases 2–4 (Warwick's mandate: local + reversible only; stop before Phase 5/6 teardown/Tower/machine-wide; interrupt only for genuine product-decision / missing credential / irreversible action / material failure; report once). Acceptance conditions applied **exactly as sanctioned** — F2 not redefined; headless runs are **preflight only**, never a Phase-4 substitute. Continues [`2026-08-02-phase1-probe-evidence.md`](2026-08-02-phase1-probe-evidence.md) (Phase 1 PROVEN, main `bc607fb`)._

## Naming (Warwick, 2026-08-02)
There is **no "Thin Larry."** It is **Larry** running under a restricted toolset — identity unchanged, only the tool grant changes. The config artefact is filenamed `thin-larry` (a launch handle); the agent body states the identity rule explicitly and forbids announcing a separate persona.

---

## Phase 2 — duty ownership + the restricted-Larry config  ·  DONE (proposal, not adopted)

**Artefact:** [`.claude/agents/thin-larry.md`](../.claude/agents/thin-larry.md) — the restricted **main-agent** definition. **Inert until a session is launched with `--agent thin-larry`; it does not change the default session.** It is the *top-level* agent when launched — **never a restricted subagent under a full-capability Larry** (Warwick's condition; the proven `--agent` lever makes the *main* the restricted one).

- **Tools kept:** `Read, Glob, Grep` (inspect), `Task` (delegate — the primary verb), `TodoWrite` (plan), `Bash` (routine git, `continuity.mjs`, session-log writer, ding).
- **Tools removed:** `Edit, Write, MultiEdit, NotebookEdit` — file implementation is forced to specialists (proven ×2 in Phase 1, and again in Phase 4 preflight).
- **F1a dangerous-git safety** is a **uniform session-wide `deny`** (applies to everyone incl. Larry — no asymmetry needed): force-push, unique-branch delete, push/merge to protected `main`. **Proven to fire** in Phase 4 preflight.

**Duty ownership under restriction:**
- **Git** — stays with Larry via retained `Bash` (routine only; dangerous denied uniformly). Warwick gains zero git responsibility.
- **Continuity** — `continuity.mjs` (Bash) + the new `continuity-derive.mjs` (SessionEnd). No general Write needed.
- **Session-log authoring (Duty 3)** — the one duty that genuinely needed `Write`. Resolution: route through a narrow Bash-invoked writer (like `continuity.mjs`) **or** delegate to a specialist. Flagged for the Phase-2 review; not yet built (regrowth-capped — build the narrow route only when adopted).

**The honest limit (surfaced, not hidden):** because Larry keeps `Bash` (needed for git + continuity), the boundary removes the *natural* editing path (Edit/Write) but is **not** a cryptographic wall against `echo > file`. A harder wall needs git+continuity moved off Bash onto dedicated tools — deferred. This is a genuine design judgment for your review, not a defect.

---

## Phase 3 / F2 — automatic true-state capture  ·  MECHANISM PROVEN; live journey PENDING (honest PARTIAL)

**F2 applied exactly:** *a normal session automatically derives its true final state → persists at close → a fresh session recovers that.* Not weakened.

**What is PROVEN (on this session's real transcript, not a fixture):**
- **Automatic derivation, zero hand-authored fields, no manual `set`.** A capable model reads the transcript tail and emits the continuity state (focus, objective, latest request, decisions, completed, blockers, next_action, notes). Verified against ground truth: it correctly recovered the focus, the exact latest request, all accepted decisions, completed work **with the right commit SHAs**, blockers, and next action.
- **Persist → recover round trip:** persisted via the real `continuity.mjs` (Honcho packet, reason `auto-derive`); a fresh process read it back as the newest packet. This also exposed the live gap it fixes — the newest pre-existing packet was a stale `stop` one still saying "Continue… from Phase 1", because the Stop hook was auto-persisting **stale** local state (never re-derived).

**Trigger corrected (Warwick):** the derive runs on **SessionEnd** (fires once, at the boundary), **never on Stop** (every turn — an LLM pass there is unaffordable and A-7 forbids it).

**Reversible artefact:** [`tools/governor/continuity-derive.mjs`](../tools/governor/continuity-derive.mjs) — reads `transcript_path` from a SessionEnd payload (or `--transcript`), extracts, derives via `claude -p`, and (unless `--dry-run`) persists through `continuity.mjs`. **Fails safe:** any error (no transcript, empty/`non-JSON` derive, LLM failure) persists **nothing** and leaves existing state untouched — a boundary hook must never crash a session or clobber good continuity on a bad derive. Both the `--dry-run` and the **simulated SessionEnd stdin payload** paths were proven; the fail-safe path was proven too (bad path → "state untouched").

**Wired, not yet active:** a `SessionEnd` hook was added to `.claude/settings.local.json` (backed up first; restore route recorded). **Hooks bind at launch** — so it is *written but not loaded* in this process and **activates on the next Claude Code restart**.

**Why this is PARTIAL, not a pass (Warwick's bar):** the **one real SessionEnd → Honcho → fresh SessionStart journey has not run** — it can't, inside this session. It completes only after (a) a restart loads the hook and (b) a real session-cycle fires it. **Not declared complete.** (Belt-and-braces: the auto-derived packet was already persisted manually this session, so your *next* boot recovers accurate state regardless of the hook.)

---

## Phase 4 — acceptance test  ·  PREFLIGHT PASSED; real pass PENDING your live session

Headless `claude -p --agent thin-larry` in a scratch git project (real `thin-larry` def + a `writer` specialist + the F1a deny). **Objective outcomes:**

| Check | Result |
|---|---|
| Routine `git status` under restricted Larry | **worked** (Bash retained) |
| `git push --force origin main` (dangerous) | **BLOCKED** by the deny — F1a gate fires (mutation test) |
| Larry (no Write/Edit) creates `hello.txt` | **delegated to `writer`** → file objectively EXISTS = `HELLO` |

Side-finding: a scratch workspace's `permissions.allow` is **ignored until the workspace is trusted**, but **`deny` fires regardless of trust** — relevant to how the real config must be installed.

**This is preflight, not the pass.** Per your ruling, the real Phase-4 acceptance requires a **real fresh Auto session with the restricted Larry as your main conversation** — which only you can launch. Headless proves the mechanics; it does not substitute.

---

## Overall status (honest, against the exact criteria)

| Phase | Status |
|---|---|
| 1 | **PROVEN** (prior deliverable) |
| 2 | **DONE** — restricted-Larry config + F1a deny + duty ownership designed; **proposal, not adopted** |
| 3 / F2 | **PARTIAL** — automatic derivation PROVEN (the previously-unbuilt hard part); real SessionEnd→SessionStart journey **PENDING** (restart + one cycle); session-log narrow route not yet built |
| 4 | **PREFLIGHT PASSED**; real acceptance **PENDING** your live Auto session |

**What only you can do next (nothing blocks me; these are yours):**
1. **Restart Claude Code** to load the `SessionEnd` hook → the next full session cycle runs the real F2 journey (then it self-sustains).
2. **Launch `claude --agent thin-larry`** as your main conversation to run the real Phase-4 acceptance test.
3. Review the Phase-2 design (esp. the retained-`Bash` tradeoff and the session-log route) before adoption.

Stopped here per mandate — **no** Phase 5 teardown, **no** Tower/Codex, **no** machine-wide changes.

## Reversibility ledger
- `.claude/settings.local.json` backed up: `settings.local.json.bak-PHASE3-2026-08-02T00-49-52-000Z` (restore = `cp` it back). Also `…bak-PHASE1-2026-08-01T23-39-02-000Z`.
- Leftover Phase-1 probe `deny` (out/phase1-asym) and probe dirs: **removed**; settings `deny` now empty.
- New tracked artefacts (git-revertible): `.claude/agents/thin-larry.md`, `tools/governor/continuity-derive.mjs`.
- Real continuity state was updated to the accurate auto-derived picture (prior state backed up at `~/.mypka/governor/continuity.json.phase3-bak`).
