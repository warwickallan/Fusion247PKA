---
name: build-018-map
type: build-map
build: BUILD-018
status: live
created: 2026-07-31
method: wayfinder-adapted
---

# BUILD-018 — THE MAP

**This file is live state, not a plan.** Wayfinder's load-bearing mechanic is the *write-back*: when a
ticket resolves, its resolution is summarised back into this map. A map without write-back degrades
into a stale plan, and a stale plan is exactly the failure this whole build exists to prevent.

**Terms of art** (from the Wayfinder source, distilled 2026-07-31):
- **Fog** — not yet knowing enough to decide. Resolved by research, prototype or asking Warwick.
  **Never guessed past.**
- **Frontier** — the tickets actionable *right now*, given what is already resolved. Computed, not set
  by hand.
- **Dependencies / blocking relationships** — a ticket reachable only once a prior one resolves.
  ("Blockers" in the commission = this concept, not a fifth artefact.)

---

## 1. Architecture — the seven components

```
                     ┌──────────────────────────────────────────┐
   statusLine ──────►│ SAMPLER   writes a health sample on every │
   (every msg)       │           assistant message               │
                     └──────────────┬───────────────────────────┘
   SessionStart ────► BASELINE      │
   PreCompact  ────► COMPACTION++   ▼
                     ┌──────────────────────────────────────────┐
                     │ SESSION HEALTH STORE  (ephemeral, /session│
                     │ id, machine-local, NOT git)               │
                     └──────────────┬───────────────────────────┘
                                    ▼
                     ┌──────────────────────────────────────────┐
                     │ EVALUATOR  pure: signals → verdict        │
                     │ GREEN / AMBER / RED / RECOVERY / BLIND    │
                     └────┬──────────────┬──────────────┬────────┘
                          ▼              ▼              ▼
                    status line   one-time advice   RED preflight
                    display       to Warwick        block (fails OPEN)
                                        │
                                        ▼
                     ┌──────────────────────────────────────────┐
                     │ /rotate-session  bank + VERIFY safety     │
                     └──────────────┬───────────────────────────┘
                                    ▼
                     ┌──────────────────────────────────────────┐
                     │ PROGRAMME STATE  (durable, git-versioned) │
                     └──────────────┬───────────────────────────┘
                                    ▼  Warwick types /clear
                     ┌──────────────────────────────────────────┐
                     │ SessionStart(source="clear") → REORIENT   │
                     │ additionalContext, ≤10,000 chars          │
                     └──────────────────────────────────────────┘
```

---

## 2. Telemetry — PROVEN field inventory

Local proof this machine, 2026-07-31: **`claude --version` = 2.1.220**, above every documented
version gate (`rate_limits` 2.1.132+, `prompt_id` 2.1.196+, boolean frontmatter 2.1.218+).

### statusLine stdin payload — the primary source

**PROVEN locally by T-01, 2026-07-31**: one real payload captured on this machine (see
`evidence/T-01-statusline-schema.md` for the full redacted schema and captured-value
verdicts). Every row below is now OBSERVED or ABSENT — no row is [DOC]-only.

| Field | Serves | Evidence |
|---|---|---|
| `context_window.used_percentage` | live context usage | **OBSERVED** — input-only; excludes output tokens |
| `context_window.total_input_tokens` | usage | **OBSERVED** — current context, not cumulative |
| `context_window.context_window_size` | 200k vs 1M denominator | **OBSERVED** — `1000000` on this account (**1M, not 200k** — thresholds must stay percentage-based, never hardcoded) |
| `context_window.current_usage.{input,output,cache_creation,cache_read}_tokens` | growth | **OBSERVED-nonnull** in this capture (mid-session, not pre-first-call); the documented pre-1st-call/post-`/compact` `null` state was not exercised — do not read that as "null never happens" |
| `rate_limits.five_hour.{used_percentage,resets_at}` | 5h plan delta | **OBSERVED** on this Pro/Max-tier machine |
| `rate_limits.seven_day.{used_percentage,resets_at}` | 7d plan delta | **OBSERVED** |
| `model.id`, `model.display_name` | model boundary | **OBSERVED** |
| `effort.level` | effort boundary | **OBSERVED** |
| `session_id`, `transcript_path`, `version` | identity | **OBSERVED** (session_id/transcript_path redacted per §5) |
| `workspace.git_worktree`, `workspace.repo.{host,owner,name}` | estate | `workspace.git_worktree` **ABSENT** (not observed — this capture's session was the main checkout, not a `--worktree` launch, so absence is expected per the ticket's caveats, not evidence it never appears); `workspace.repo.{host,owner,name}` **OBSERVED** (redacted) |
| `pr.{number,url,review_state}` | PR state | **ABSENT** — not observed in this capture (no open PR found for this session; expected, not evidence of non-existence) |
| `worktree.{name,path,branch}` | worktree | **ABSENT** — not observed in this capture (session was not a `--worktree` launch; expected) |
| `cost.{total_cost_usd,total_duration_ms,...}` | effort proxy | **OBSERVED** (`total_cost_usd`, `total_duration_ms`, `total_api_duration_ms`, `total_lines_added`, `total_lines_removed`; value redacted per §5) |

**Undocumented fields also OBSERVED in the same capture — not previously in this table**:
`session_name` (string, auto-generated session title), `output_style.name`,
`exceeds_200k_tokens` (boolean), `fast_mode` (boolean), `thinking.enabled` (boolean),
`context_window.total_output_tokens`, `context_window.remaining_percentage` (ready-made
evaluator inputs), `workspace.current_dir`, `workspace.project_dir`, `cwd`, `prompt_id`. Full
detail in the evidence file.

**Refresh cadence** [DOC]: session start, each new assistant message, after `/compact`, on permission
or vim mode change, plus optional `refreshInterval` (min 1s). Debounced 300ms; in-flight scripts are
cancelled. **Design consequence: the sampler must be fast and idempotent, and must tolerate being
killed mid-write** — write to a temp file and rename.

### Transcript JSONL — corroboration only, never primary

**PROVEN locally** by direct probe of this session's transcript:
- usage keys: `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`,
  `output_tokens`, `server_tool_use`, `service_tier`, `cache_creation`, `inference_geo`,
  `iterations`, `speed`
- derived context = `input + cache_read + cache_creation` → **121,506 tokens measured live**
- per-message `model` present; a **mid-session model switch was observed**
  (`claude-sonnet-5` → `claude-opus-5`) — so model boundaries are computable
- top-level keys include `effort`, `gitBranch`, `cwd`, `isSidechain` (subagent messages),
  `hookAdditionalContext`, `hookCount`, `hookErrors`, `hookInfos`
- `type` histogram: `assistant`, `user`, `system`, `attachment`, `mode`, `queue-operation`,
  `file-history-snapshot`, `file-history-delta`, `last-prompt`, `ai-title`

**Two hard warnings:**
1. The transcript format is **explicitly internal and unsupported**; it changes between versions.
   Never make it primary. Use it only to corroborate, and guard every read.
2. **242 transcripts exist locally, several 30–40 MB.** Any transcript reader must **tail-read**, never
   whole-file read. A naive reader will be slow and will blow a worker's context.

`hookAdditionalContext` / `hookCount` being recorded is a gift: it gives us a way to *prove* the
SessionStart reorientation actually landed, rather than assuming it.

### Hooks

| Hook | Key fields | Use |
|---|---|---|
| `SessionStart` | `source` ∈ `startup\|resume\|clear\|compact\|fork` | baseline capture; **reorientation on `clear`** |
| `PreCompact` | `trigger` ∈ `manual\|auto` | **authoritative compaction counter** |
| `UserPromptSubmit` | `user_prompt`; can `decision:"block"` + `additionalContext` | RED preflight block |
| `SessionEnd` | `reason` ∈ `clear\|resume\|logout\|...` | close out the session record |
| `Stop` | `last_assistant_message` | optional sampling fallback |

All hooks carry `session_id`, `transcript_path`, `cwd`, `permission_mode`.
**`hookSpecificOutput.additionalContext` is capped at 10,000 characters** — a hard design constraint,
see AD-5.

---

## 3. Settled decisions

| ID | Decision | Why |
|---|---|---|
| **AD-1** | **statusLine is the primary telemetry source; transcript is corroboration only.** | statusLine is a documented, stable contract carrying *every* signal the north star names. Transcript is internal and version-fragile. |
| **AD-2** | **Two separate stores.** Session health = ephemeral, machine-local, keyed by `session_id`. Programme state = durable, git-versioned. | They have different lifetimes and different audiences. Fresh Larry reads the durable one; the ephemeral one dies with the conversation. Conflating them is how banked state gets lost. |
| **AD-3** | **`BLIND` is a first-class state with its own exit code.** Missing sampler file, stale sample, or absent required fields → `BLIND`, never `GREEN`. | INV-1. This is the direct lesson of the 2026-07-29 controls that reported success over ground they never examined. |
| **AD-4** | **Compaction counted by the `PreCompact` hook**, corroborated by `SessionStart source=compact`. | Deterministic and documented. Inferring compaction from transcript markers is guesswork — my probe found **zero** reliable markers. |
| **AD-5** | **Reorientation via `SessionStart(source="clear")` → `additionalContext`.** The brief is a **pointer document**, not the state itself. | The 10,000-char cap makes a full state dump impossible. Injecting pointers + the handful of facts that must not be re-derived (branch, base SHA, next action) is both sufficient and robust. |
| **AD-6** | **RED protection blocks via `UserPromptSubmit`, and fails OPEN.** | INV-2. A governor that locks Warwick out of his own session is a worse defect than one that misses a rotation. This deliberately inverts the usual default-deny posture because the threat here is **availability**, not privilege. |
| **AD-7** | **Rotation safety is an executable check that must be able to REFUSE.** | INV-5. Its shape is already proven: the 2026-07-31 recovery task was a manual instance of exactly this check. |
| **AD-8** | **The map lives in git as markdown — not in an issue tracker.** | Wayfinder uses GitHub issues. Rejected: **subagents get no MCP tools**, so a tracker-hosted map is unreadable by the very workers who need it; ClickUp is unreliable in this estate; git is diffable, reviewable and survives. |
| **AD-9** | **Deliberate inversion of Wayfinder's disposable spec.** Wayfinder treats the spec as throwaway with ticket history as primary source. Here the **map is SSOT** and tickets link to it. | myPKA SSOT doctrine. Recorded as a conscious reversal, not drift — the source itself flags this as a genuine fork in the road. |
| **AD-10** | **`/rotate-session` ≠ `/close-session`.** Rotate banks + verifies + emits the brief. It must not write a programme session log, run a Librarian pass, or sign off. | INV-4. Conflating them makes routine rotation expensive, and an expensive rotation will not get used. |
| **AD-11** | **Evaluator core is pure** — `evaluate(signals) → verdict`, zero filesystem/git/myPKA knowledge. Adapters gather signals. | Portability to Project ManagAIr, and it makes the state space unit-testable without an estate. |
| **AD-12** | **The Governor writes to the EXISTING `Team Knowledge/fusion-brief/session-handoff.md`, not a new location.** | It already exists, already declares `owner_intent: consumed by the next Larry session`, and already carries "Locked decisions (do NOT re-litigate)". Inventing a parallel handoff file would create two competing SSOTs — the exact defect this build exists to prevent. **Its being 4 days stale is the problem statement, not a reason to bypass it:** it is hand-curated, and its own frontmatter calls that a stopgap. The Governor's job is to *derive* it. |
| **AD-13** | **Rotate inherits `close-session` steps 1–3 only** (sweep open items, fix coverage window, write a log entry of `type: mid-session-insight`). It must NOT inherit steps 4–7: Librarian pass, graduation, ClickUp mirror, or the Larry self-improvement review. | Established by reading the actual command. Step 7 is by far the heaviest and is explicitly end-of-programme. A rotation that costs what a close costs will not get used, and an unused governor is worse than none. |

---

## 4. Proposed health model

**States:** `GREEN` → `AMBER` → `RED`, plus `RECOVERY` and `BLIND` off the main axis.

| State | Meaning | Behaviour |
|---|---|---|
| `GREEN` | headroom | continue |
| `AMBER` | rotation worthwhile at the next safe boundary | do not *start* a new substantial item; finish the current one |
| `RED` | rotate now | preflight blocks new substantial items (fails open); recommendation delivered |
| `RECOVERY` | authoritative state already partly lost (post-compaction, or banked state stale vs git HEAD) | **do not trust in-context memory** — re-read durable state before acting |
| `BLIND` | telemetry unreadable | treat as *at least* AMBER; say so loudly; never GREEN |

**Proposed thresholds — these are a starting hypothesis and are tuned by dogfood (see F-4):**

- context `used_percentage` < 55 → GREEN · 55–74 → AMBER · ≥ 75 → RED
- compactions ≥ 1 → AMBER floor · ≥ 2 → RED floor (each compaction is authoritative-state loss)
- `rate_limits.five_hour.used_percentage` ≥ 85 → AMBER floor (risk of being cut off mid-item)
- growth rate: if projected to hit RED before the current item can plausibly finish → AMBER
- **safe-boundary availability modulates the ADVICE, not the state**: RED + safe boundary → "rotate
  now"; RED + no safe boundary → "reach a boundary urgently, then rotate".

**Missing-field behaviour (explicit, per the commission):** any *absent* field is `unknown`, never `0`.
A threshold over an `unknown` input does not fire; it contributes a `BLIND` reason instead. Absence of
`rate_limits` alone is expected and is **not** BLIND — it is only BLIND if a *required* signal
(context usage) is unreadable.

---

## 5. FOG — what we do not yet know

| ID | Fog | Type | Resolution |
|---|---|---|---|
| ~~F-1~~ | ~~Does the live statusLine payload on **this** machine actually contain `context_window.*` and `rate_limits.*` with the documented names?~~ | PROTOTYPE | **RESOLVED 2026-07-31 — yes, both present with documented names; see §2 and `evidence/T-01-statusline-schema.md`. Bonus: several undocumented fields also observed (`exceeds_200k_tokens`, `remaining_percentage`, etc.) and `context_window_size` proven as 1M on this account.** |
| **F-2** | Where should the ephemeral session-health store live? `C:\.fusion247\**` is deny-by-default under GL-012 and would need a declared private surface. | **RESEARCH** → then Warwick if contested | T-02 |
| ~~F-3~~ | ~~What does `/close-session` actually do; what seams exist?~~ | RESEARCH | **RESOLVED 2026-07-31 — see §3 AD-12/AD-13 and §11.** |
| **F-4** | Are the proposed thresholds right? | **PROTOTYPE → dogfood** | T-08, then tune |
| **F-5** | How is "a new substantial item" detected from a prompt, well enough to block it without false positives? | **PROTOTYPE** | T-06 |
| **F-6** | What is the right bounded-override design (token? expiry? logged?) | **WARWICK** | Q-2 |
| **F-7** | How are active workers detected reliably? `isSidechain` exists in the transcript, but background-agent liveness may need the task/agent surface. | **RESEARCH** | T-07 |
| **F-8** | Does Project ManagAIr impose any adapter shape we should honour now rather than retrofit? | **WARWICK** | Q-3 |

## 6. Questions only Warwick can settle

- **Q-1** — Is `BUILD-018` the right identifier, given it was commissioned directly and has no
  Foundry `IDEA-018`? (Larry's call unless Warwick objects; recorded in `00-ESTATE.md`.)
- **Q-2** — Bounded override design: how much friction do you *want* at RED? Options: (a) advisory
  only, never blocks; (b) blocks with a one-word override; (c) blocks with an override that expires
  after N prompts. **Larry's recommendation: (c)**, because (a) will be ignored and (b) becomes a
  reflex.
- **Q-3** — Project ManagAIr portability: design the adapter boundary now, or ship myPKA-first and
  extract later? **Larry's recommendation: design the boundary now (it is nearly free — AD-11), defer
  the actual second adapter.**
- **Q-4** — Should rotation *ever* be allowed to auto-commit banked state, or always leave the commit
  to Larry's standing push authority? (Default: use the standing authority; no new mechanism.)

## 7. DEPENDENCIES (blocking relationships)

```
T-01 (prove payload) ──┬──► T-03 (sampler) ──► T-04 (evaluator) ──┬──► T-05 (status display)
                       │                                          ├──► T-06 (RED preflight)
T-02 (state location) ─┴──► T-03                                  └──► T-08 (dogfood)
T-09 (programme state schema) ──► T-10 (/rotate-session) ──► T-11 (reorientation hook) ──► T-08
T-07 (worker/worktree recon) ──► T-10
```

**External dependency, live:** GL-012 §6a is **not in this worktree** — it exists only on
`recovery/...` at `95c265d`. Any ticket touching privacy or log placement must read it via
`git show 95c265d:"Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md"`.
See `00-ESTATE.md`.

**External constraint:** `.claude/settings.local.json` is globally gitignored. **Hook wiring cannot be
delivered by git.** Every ticket that "adds a hook" must also ship an idempotent activation step that
installs it into the primary checkout's untracked settings file — otherwise it ships nothing.

## 8. FRONTIER — takable right now

**T-02, T-07, T-09.** T-01 resolved 2026-07-31 (see §5 write-back). Everything else remains
behind a dependency — T-03 needs both T-01 (done) and T-02 (open).

---

## 9. TICKET INDEX

Model column: Opus only where architectural judgement is materially valuable.

| ID | Ticket | Model | Depends | Acceptance | Mutation test |
|---|---|---|---|---|---|
| **T-01** | ~~**Prove the live statusLine payload.**~~ **RESOLVED 2026-07-31.** | **Sonnet** | — | ✅ met — `evidence/T-01-statusline-schema.md`; every §2 field marked | n/a (evidence-gathering ticket) |
| **T-02** | Decide + implement the session-health store location and atomic write (temp+rename). | Sonnet | — | Store path settled with GL-012 reasoning written down; concurrent writes never yield a torn file | Kill mid-write → reader still gets last good state, never a partial parse |
| **T-03** | Sampler: statusLine script → health sample. Fast, idempotent, kill-tolerant. | Sonnet | T-01,T-02 | Sample written on every assistant message; <100ms | Feed malformed/empty stdin → writes nothing, exits 0, never corrupts the store |
| **T-04** | **Pure evaluator** — `evaluate(signals) → verdict`. All five states, distinct exit codes, missing-field semantics. | **Opus** | T-03 | Full state-space unit tests incl. every `unknown` combination | **Delete the state file → asserts BLIND, not GREEN** (INV-1). Assert non-zero count of signals actually examined. |
| **T-05** | Status-line display: render verdict compactly. | Sonnet | T-04 | Renders all five states; degrades gracefully | Evaluator throws → line still renders, shows BLIND |
| **T-06** | RED preflight block via `UserPromptSubmit`. **Fails open.** Bounded override. | **Opus** | T-04, Q-2 | Blocks at RED with reason + override; rotation/read-only prompts always pass | **Hook throws / times out → prompt proceeds** (INV-2). Verify by forcing an exception. |
| **T-07** | Worker + worktree reconciliation: enumerate live workers, unintegrated outputs, all worktrees with owner/branch/status/disposition. | Sonnet | — | Reports the 20 known worktrees with disposition; never deletes anything | Inject a fake dirty worktree → appears as unreconciled |
| **T-08** | **Live dogfood rotation** (M4). | **Opus** (judgement) | T-04,T-10,T-11 | A real rotation, then a fresh session completes a ticket with zero re-briefing | Remove the banked state → fresh session must *notice* and say so, not proceed blind |
| **T-09** | Programme-state schema + writer (durable, git). | **Opus** | — | Schema captures intent, decisions, worker outputs, branches/PRs/worktrees, exact next action | Stale-vs-HEAD detection: move HEAD → state flagged stale |
| **T-10** | `/rotate-session` command: bank + **verify safety** + emit `/clear` instruction. Must not invoke close-session. | **Opus** | T-07,T-09 | Refuses with the precise obstacle when unsafe | **Dirty tree / unpushed commit / live worker → refuses.** Assert it can actually say no. |
| **T-11** | Reorientation: `SessionStart(source=clear)` → `additionalContext` pointer brief, ≤10,000 chars. | **Opus** | T-09,T-10 | Fresh session oriented; brief provably under cap | Oversized state → brief truncates *safely* and says it truncated, never silently drops the next action |
| **T-12** | Portability: extract the estate adapter; run the core against a synthetic estate. | Sonnet | T-04 | Core has zero myPKA paths | Synthetic adapter with all-unknown signals → BLIND |

### Dependency order (waves)

1. **Wave 1 (parallel):** T-01, T-02, T-09, T-07
2. **Wave 2:** T-03 → T-04
3. **Wave 3 (parallel):** T-05, T-06, T-10, T-12
4. **Wave 4:** T-11 → **T-08 (dogfood)**

---

## 10. WRITE-BACK LOG

Append one line per resolved ticket. **A resolution not written back here did not happen.**

| Date | Ticket | Resolution | Newly unlocked |
|---|---|---|---|
| 2026-07-31 | Phase 1 | Map, contract, estate created. Telemetry surface proven to [DOC]+version level; live payload still unproven (F-1). | T-01, T-02, T-09, T-07 |
| 2026-07-31 | F-3 | **RESOLVED.** close-session steps 1–3 are the rotation subset; 4–7 are end-of-programme (AD-13). `fusion-brief/session-handoff.md` is the existing handoff contract to derive, not replace (AD-12). Eight reusable seams catalogued in §11. | Sharpens T-09, T-10, T-11 |
| 2026-07-31 | T-01 | **RESOLVED.** Real statusLine payload captured on this machine via a temporary capture command installed in the primary checkout's `settings.local.json` (backed up, installed, triggered, restored, diff-proven byte-identical). Both `context_window.*` and `rate_limits.*` present with documented names; `context_window_size` observed as `1000000` (1M, not 200k) — confirms thresholds must be percentage-based (already AD-4's design). `pr.*`, `worktree.*`, `workspace.git_worktree` all ABSENT in this capture, expected per the ticket's own caveats (no open PR; not a `--worktree` session). Several undocumented fields also observed and catalogued: `session_name`, `output_style.name`, `exceeds_200k_tokens`, `fast_mode`, `thinking.enabled`, `context_window.total_output_tokens`/`remaining_percentage`, `workspace.current_dir`/`project_dir`. Capture script kept at `tools/capture-statusline.mjs` for T-03 reuse. Full schema: `evidence/T-01-statusline-schema.md`. | T-02, T-07, T-09 remain frontier; T-03 still needs T-02 |

---

## 11. Reusable seams (inventoried 2026-07-31 — do not rebuild these)

| Seam | Path | Use |
|---|---|---|
| SessionStart hook array | `.claude/settings.local.json:194-207` | where the reorientation hook installs |
| **SessionStart stdout → context** | proven by `ensure-capture-gateway.mjs:52-58` printing plain text | a *second*, already-proven injection channel alongside `additionalContext`. Prefer the documented JSON field; this is the fallback if T-01 shows it unavailable. |
| Stop-hook stdin reader | `services/control-plane/tower-loop/bridge-ingest.mjs:120-137` | working, tested pattern for parsing hook stdin and locating `transcript_path` — copy this, don't reinvent |
| Stop hook slot | `.claude/settings.local.json:183-192` | post-turn health sampling |
| **Handoff contract** | `Team Knowledge/fusion-brief/session-handoff.md` | the file the Governor derives (AD-12) |
| Notification | `C:\.fusion247\larry-ding.mjs` — message read from a **file**, not argv; already permission-allowlisted | ding Warwick when rotation is advised |
| Command frontmatter | `.claude/commands/*.md` — exactly `name` / `description` / `user_invocable: true` | `/rotate-session` must match this convention |
| Session-log schema | `Team Knowledge/session-logs/_template.md` — `type` enum already includes `mid-session-insight` | a rotation entry uses that type, **not** `close-session` |
| Problem statement, already written | `Deliverables/BACKLOG.md` — *"a held item that exists only in a session's context does not survive that context ending"* | quote it; it is this build's thesis in the estate's own words |

## 12. ⚠️ COLLISION WARNING — a broken hook is firing every session

`.claude/settings.local.json:199` invokes
`services/control-plane/tower-loop/ensure-watcher.mjs` — **and that file does not exist.** It was not
found anywhere under `C:\Fusion247PKA` (including all worktrees) or `C:\Fusion247PKA-tower`; the
directory holds `run-watcher.mjs` and `watcher.mjs` instead.

**Every session start currently fires a hook against a missing file.**

Two consequences for this build:
1. **Do not add a Governor SessionStart hook beside it without deciding what happens to it first.** The
   Governor's reorientation output would sit next to a failing sibling, and a fresh Larry debugging
   "why didn't reorientation work" would be looking at two hooks, one already broken.
2. **Repair is NOT in this build's scope.** It belongs to Tower, which `fusion-brief/current-state.md`
   records as PARKED. This is **Q-5 for Warwick**: repair, remove, or leave and work around.

Recorded as evidence, not actioned. Nothing was changed.
