> **⚠️ SUPERSEDED 2026-08-02 by [2026-08-02-wayfinder-operating-reset-plan.md](2026-08-02-wayfinder-operating-reset-plan.md).**
> The keep/bin/reallocate bones here are sound, but GPT's review (2026-08-01) found corrections that the Wayfinder plan folds in: continuity is only PROVISIONAL (auto-write journey unproven); Decision B is rejected (native permissions, no homemade gate); Larry's git/session-log/continuity-update duties must be resolved under restricted permissions; deletion is conditional on the reversible journey passing first; MCP "untouched" means infra/data only (access is reassigned by role); memory splits into active vs preserved-historical. Read the Wayfinder plan as canonical; this remains for the detailed component list.

# Reset inventory — EXACTLY what is kept, binned, reallocated

_2026-08-01. THE map Warwick sanctions against. Verified against live disk + hook wiring this session, not reproduced from memory. **Nothing here is executed.** Anything uncertain is marked VERIFY-FIRST, not asserted. Conservative bias: if in doubt, KEEP._

---

## A. KEEP — untouched, out of scope, explicitly SAFE (nothing here is affected)

These are the "don't lose something that was running" list. **None of this is touched by the reset.**

**Running services / products:**
- AsdAir (household shopping) — untouched
- ObsidiWikAi (knowledge compiler) — untouched
- CareerAir, VlogOps assets — untouched
- Directus + the Cockpit — untouched
- Supabase (schemas, data) — untouched
- Neo4j / LightRAG / the Brain graph — untouched
- **Honcho** (memory) — KEPT and now actually read on boot
- fusion-capture-gateway — untouched (its SessionStart hook stays)
- Tower / `bridge-ingest` — untouched (its Stop hook stays; Tower stays *parked* until you decide C)
- All MCP connectors (ClickUp, Gmail, Drive, Calendar, Supabase, etc.) — untouched

**Knowledge / records / methods:**
- All of `PKM/`, `Team Knowledge/`, `Client Delivery/` — untouched
- **All session logs** — KEPT (durable history + VlogOps evidence; see §E note)
- **All `Deliverables/`** including every Wayfinder planning map — KEPT on git
- **Wayfinder** (the planning method + its markdown maps) — KEPT. Your visual stays on git. Survives for new builds.
- `close-session` command/skill — KEPT
- `update-scaffold` command/skill — KEPT
- The specialist contracts (`Team/*/AGENTS.md`) — KEPT, but loaded on dispatch, not read every boot (see §E)
- The `~/.claude` memory files — KEPT

---

## B. KEEP — the ONE survivor from BUILD-018

| Item | Why kept | Action needed |
|---|---|---|
| `tools/governor/continuity.mjs` | The Honcho read/write. The one asset that fixes the memory pain. Lived test already passed once this session. | Re-point the SessionStart hook to it (see §C step 1) |
| Stop hook → `continuity.mjs stop` | Writes continuity to Honcho at turn-end | KEEP as wired |

---

## C. BIN — BUILD-018 governor spine (0 of 4 rules enforced; inert now)

**Method: surgical deletion + hand-edit of the gitignored `.claude/settings.local.json`. NOT `git revert`.** Ordered so nothing breaks:

1. **FIRST, protect the memory read:** change SessionStart hook `reorient.mjs` → `continuity.mjs read`; prove a fresh session still gets the brief **before** deleting anything.
2. **Remove dead/inert hook entries** from `settings.local.json`: the `stop-controller` Stop entry, the `worktree-guard` PreToolUse entry. (Leave `bridge-ingest`, `ensure-capture-gateway`, and `continuity.mjs stop` alone.)
3. **Delete the code** (all serve only BUILD-*/rotation, enforce nothing):

| File | What it did | What you DON'T lose |
|---|---|---|
| `reorient.mjs` (+test) | BUILD-* recovery brief | Honcho read survives — re-hosted to `continuity.mjs` in step 1 |
| `stop-controller.mjs` (+test) | Blocked turn-*end* (the "won't let go" trap) | Nothing — it enforces no rule |
| `worktree-guard.mjs` (+test) | Location gate, inert | Nothing — **but harvest its Bash-classifier first IF you approve decision B** |
| `programme-state.*` (+test) | BUILD-* state schema/writer | Nothing — no active programmes |
| `rotate-session.mjs` (+test) + `.claude/commands/rotate-session.md` | Context-rotation banking | **VERIFY-FIRST:** cross-session handoff is now done by the Honcho continuity read. Confirm a /clear→fresh session recovers via Honcho before deleting the command. |
| `collect-state.mjs`, `worktree-recon.mjs`, `install-hooks.mjs`, `atomic-write.mjs` (+tests), `fixtures/` | Governor plumbing | Nothing |
| `.github/workflows/governor-tests.yml` | CI for the above | Retire/narrow in the same pass so CI doesn't go red |

4. **Already gone** (removed at BUILD-018 closure, nothing to do): model-gate, delegation-gate, escalation-gate, build-registry, qa-binding, merge-readiness, programme-pr, status-line.

---

## D. DECISION-PENDING — the phone footer set (keep or bin together, no half-deletes)

`statusline-live.mjs` + `footer.mjs` + `sampler.mjs` + `evaluator.mjs` + `health-store.mjs` (+ tests). Renders the `⟦GOV⟧` line. `footer.mjs` also holds the `HANDBACK_CODES` literal the constitution references. **Your call (decision D): keep the footer or bin the set.**

---

## E. REALLOCATE — Larry's recurring duties (Nolan's map, corrected & conservative)

| Duty | Disposition | New owner / how |
|---|---|---|
| Talk to Warwick, route, orchestrate | **KEEP with Larry** | Core residual role |
| Integrate/synthesize specialist output | **KEEP with Larry** | Core residual role |
| Git lifecycle | **KEEP with Larry** (decision stays Warwick) | Labour automated; outward actions gated (rule 2) |
| **Session-log authoring (Duty 3)** | **KEEP — CORRECTED from "automate/delete"** | Stays Larry's; lighter, but the practice + history stay. This is durable history + VlogOps evidence. |
| Continuity write to Honcho at boundaries | **KEEP** | Now wired (Stop hook) |
| Librarian / SSOT structural sweep (Duty 2) | **KEEP, reduced** | Cheap structural checks only; heavy content-audit stays on-demand |
| **Devbot / "finished" pings to Warwick** | **REALLOCATE** | Wire to the event (deterministic notifier), not Larry-remembered. Mack maintains if a human owner is wanted. |
| **Tower/Codex pre-merge invocation** | **REALLOCATE** | Becomes a merge-blocking external gate (needs decision C proof) |
| Handbook currency, ClickUp delivery tracking | **REDUCE to on-demand** | Not a standing chore; runs when Warwick asks (rule 1: outcome > maintenance). Not deleted. |
| Programme-state banking / rotation | **BIN** (see §C, VERIFY-FIRST) | Replaced by Honcho continuity |

**Acceptance bar:** every *substantive* recurring task ends with a non-Larry owner OR is automated; the only things left on Larry are talk/route/integrate/git-decision — which are the orchestrator role itself, not offloadable "tasks." **No new hire. Silas does NOT absorb Larry's duties.**

---

## F. CONSTITUTION — needs your explicit sanction (edits core docs)

- Thin `CLAUDE.md` to a pointer core: the four rules + the current-focus record + a compact routing index. The long governor/ladder/footer prose goes.
- Remove dangling references to deleted modules (`CLAUDE.md`/`AGENTS.md` name `stop-controller.mjs`, `footer.mjs`).
- **This edits the constitution, so it does not happen without your explicit yes** — separate from approving the code deletions.

---

## The four decisions (unchanged)

- **A.** Bin the §C spine + thin the constitution (§F)?
- **B.** Build the one small Rule-2 outward-action gate (new, tiny, leaks on MCP)?
- **C.** Un-park Tower + prove Codex can be evoked (gives Rule 3 teeth)?
- **D.** Keep or bin the §D footer set?

**Nothing in this document is executed until you sanction it.** Every brief feeding it is same-model as Larry, so by Rule 3 it is BUILT, NOT VERIFIED until a different model (Codex) confirms — which is decision C.
