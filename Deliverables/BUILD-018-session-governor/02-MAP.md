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
| **AD-14** | **Durable programme state lives at `<programme.home>/programme-state.json`** — with the programme, on the programme's branch — and **`banked.head_sha` records the head the state DESCRIBES, i.e. the *parent* of the commit that carries the state file.** | A build's state describes commits that exist only on its branch; parking it estate-wide would make it lie the moment the branch advanced. And **a file cannot contain its own commit's SHA** — banking writes the state, *then* commits it, and no amend-and-restamp escapes that (the amend changes the SHA again). **T-10 must therefore compare against the banking commit's parent**; a naive `HEAD !== banked.head_sha` check reports every freshly banked state as stale, firing RECOVERY on every rotation and training Warwick to ignore it. Discovered by generating the live document, not by reasoning about it (T-09). |
| **AD-13** | **Rotate inherits `close-session` steps 1–3 only** (sweep open items, fix coverage window, write a log entry of `type: mid-session-insight`). It must NOT inherit steps 4–7: Librarian pass, graduation, ClickUp mirror, or the Larry self-improvement review. | Established by reading the actual command. Step 7 is by far the heaviest and is explicitly end-of-programme. A rotation that costs what a close costs will not get used, and an unused governor is worse than none. |
| **AD-15** | **T-13's collector never performs a `git fetch`**, so `branches.behind` is permanently `unknown` under it. | A trustworthy behind-count needs fresh remote-tracking refs, and a collector must not have side effects on the repository it is reporting on. Matches this build's own pre-existing `branches.behind` unknown declaration from T-09. |
| **AD-16** | **T-13 collects `repository`/`worktrees`/`branches`/`pull_requests` only — `workers` is never scanned or synthesised by the collector.** | Which subagent was dispatched, for which ticket, with what expected output, is programme knowledge the dispatching session holds, not something git/worktree-recon/gh can answer. F-7 already establishes live-worker *detection* is best-effort; inventing worker *records* from an OS process scan would manufacture false precision under a field whose schema purpose (T-09's D-2) is refusing to let a guessed collection read as ground truth. |
| **AD-17** | **THE ARTEFACT HIERARCHY — settled 2026-07-31, CORRECTED 2026-08-01 (T-14 dual-write incident), binding on every BUILD-018 artefact.** (1) The **Goal / Build Contract** (`01-GOAL-CONTRACT.md`) is the **product SSOT** — outcome, invariants, scope. (2) **`programme-state.json`'s `tickets[]` is the EXECUTION-STATE SSOT** — which tickets are resolved, what the frontier is, and what resumption points to are facts of *this* document alone; `resolveTicket`/`deriveResumption`/`resolveTicketAndAdvance`/`applyTicketResolution` in `tools/governor/programme-state.mjs` are the only sanctioned way to change them. (3) The **Wayfinder map** (`02-MAP.md`) is the **human-readable navigation / decision projection** — architecture, settled decisions, fog, the ticket-index narrative and the write-back log stay hand-authored, but it no longer asserts ticket *status* on its own authority: the GOVERNOR:STATUS block in §8 is machine-rendered from the ledger, and `/rotate-session` refuses with `STALE_EXECUTION_STATE` if the two ever disagree. (4) **The Implementation Plan is the initial route only** — context, never prescription; it is superseded by the map the moment execution diverges. (5) **`programme-state.json` as a whole and `session-handoff.md` are generated PROJECTIONS of the execution-state SSOT** — never hand-authored, never a rival source; a disagreement between a projection and its source is a defect in the projection. (6) **Before merge, enduring BUILD-018 records GRADUATE into `Builds/BUILD-018-session-governor/`**; evidence may remain under `Deliverables/`. | Resolves the "which file wins" question that a rotation makes acute: a fresh Larry reads several artefacts and must know their rank without asking. **Originally this AD named the map itself as an "execution SSOT" — the exact ambiguity that caused the incident**: T-14 was declared resolved in the map's narrative while `programme-state.json`'s `tickets[]` still called it `frontier`, and the next `/rotate-session` banked a resumption pointer telling the fresh session to redo finished work, because nothing enforced that the two agreed and nothing said which one would win if they didn't. Splitting "execution-state SSOT" (2) out from "navigation projection" (3) removes the ambiguity structurally rather than by convention: there is now exactly one place ticket status lives, one function that is allowed to change it, and one automated check that refuses to bank a disagreement. Refines AD-9 (map-over-tickets, which is about ticket *specs*, not ticket *status*, and is unaffected) and generalises AD-12 (the handoff is derived, never invented). |
| **AD-18** | **The wrong-worktree gate keys on cwd, repository root and branch ONLY. HEAD is compared and REPORTED, but never denies.** | The moment a session makes its first legitimate commit, its HEAD diverges from `banked.head_sha` — a gate keyed on HEAD would block the session for having succeeded, and would be switched off within the hour. Location is a *precondition*; head movement is *normal progress*, and staleness already has its own reporting channel (AD-14). |
| **AD-19** | **Two unknowns, two directions, deliberately.** (a) Cannot establish WHERE WE ARE while a canonical location IS known → **DENY** (unknown is never aligned). (b) No active programme found at all, or the guard itself throws → **ALLOW**. | Failing closed everywhere would let one guard bug become a total work stoppage on a machine running twenty-two worktrees; failing open everywhere would make the gate decorative. The split puts the strictness exactly where a canonical location exists to be violated. Threat model is first-party mistakes, not a malicious operator (`hobby-brain-threat-model-bar`). Both directions are proven by test — an untested fail-direction is an assumption, not a control. |
| **AD-20** | **Warwick never manages branches, worktrees, commits, pushes or PR creation. Larry owns the complete Git lifecycle.** Warwick's standing gate is merge-to-main, and decisions that are genuinely his. | Recorded as a *decision* rather than left as a habit because the failure it prevents is silent: a Larry that asks Warwick to "just run `git checkout`" has converted an orchestration failure into Warwick's problem, and the ask looks helpful in the moment. Printed in every reorientation brief and in every refusal, so a fresh session inherits it without being told. |
| **AD-21** | **The EnterWorktree recovery protocol.** Larry initiates it. Under Remote Control the approval may appear ONLY in the local terminal, so Larry must IMMEDIATELY say, verbatim: *"Approve the pending EnterWorktree request in the local Claude terminal"*, then wait. Larry must NOT spin silently, must NOT continue via absolute paths, and must NOT ask Warwick to run git commands. | Learned live on 2026-07-31: a pending approval invisible to the remote side reads as the assistant hanging, and five minutes vanished. The protocol is embedded **verbatim in the deny message and in the brief** rather than only in this map, because at the moment it is needed nobody is reading the map — the refusal is the only thing on screen. |
| **AD-22** | **The build registry is a machine-local, GENERATED INDEX — never a source.** It lives at `~/.mypka/governor/registry.json` (override `MYPKA_GOVERNOR_REGISTRY`), outside git. It maps a build *name* to **where to look**, and every `resolveBuild` then **re-reads the actual `programme-state.json` from disk** and derives the returned location from *that* document. | Machine-local because it holds absolute machine paths, which are meaningless in git and wrong on every other machine. Generated because AD-17 ranks it a projection. But the load-bearing half is the re-read: it makes a stale or rotten index **structurally incapable of sending a session to the wrong branch** — the worst it can do is *fail to find*. Reintroducing "trust the index" one layer above the T-11 gate would have undone the very thing T-11 shipped. Proven by mutation: the on-disk state was rewritten to name a different worktree while the index was left lying, and the resolver returned the **new** location. |
| **AD-23** | **A QA verdict is bound to the full canonical identity tuple `(repo, branch, commit SHA)`, canonicalised ONCE at the boundary.** `canonicaliseTuple` is the only place a SHA is resolved (`git rev-parse --verify <sha>^{commit}`) and the only place identity is normalised for storage; durable state is keyed on its output and **no other module may construct a head string**. A verdict is `current` only at the exact head — any head movement marks it **SUPERSEDED** and it does not carry forward. An unknown, malformed or abbreviated head is **never** the reviewed head. | This is the Tower head-binding defect made structurally impossible instead of remembered: that bug came from re-deriving and re-checking the SHA at each call site. `verdictStatus` is pure and therefore cannot force its caller through the boundary — its 40-hex guard is a **backstop, not the control**; the control is the convention above. Abbreviations are deliberately **not** prefix-matched: prefix matching is the same defect wearing a different hat. |
| **AD-24** | **Merge readiness is a five-check predicate that FAILS CLOSED**: tickets resolved *with evidence*, suite green, tree clean, head pushed, independent review complete. `ready` is true only when all five `pass`; any `unknown` blocks. **"Suite green" requires an EXECUTED run with a non-zero test count**, and **"independent review" requires `qa.checked > 0`** as well as approval. | `null` is never `0` and never `pass` — T-10's posture, applied one layer up. The two count conditions exist because both vacuous-green shapes have real precedent: a suite reporting zero failures over zero tests, and — found independently by **two** workers from opposite sides of the interface — an `allCurrentApproved: true` computed over an **empty** reviewer list and an empty ledger, which would have let a wholly unreviewed programme pass the review gate. That is INV-5's exact wording: a control reporting success over ground it never examined. It is now refused twice, at production *and* at consumption, deliberately not deduplicated — neither refusal depends on the other being correct. |
| **AD-25** | **Creating or updating a PR and merging it are DIFFERENT AUTHORITIES.** The programme-PR module can never merge, and that is proven by an **argv-shape control** — the accepted subcommand set is exported and enumerated, every built argument vector is asserted structurally by *position*, and any other action throws — **not** by a source-text substring ban. | T-10 already shipped a substring ban and it failed immediately, because the module legitimately *printed* the banned word in a sentence proving the invariant held: the control was scoped to the wrong artefact (source text) when the invariant is about behaviour. The positional control cannot repeat that, and it is proven rather than assumed — a test pushes a title `"ready to merge"`, a branch `feature/merge-the-thing` and a body containing a literal `--merge` through every action and asserts both that the control holds *and* that the hostile content genuinely travelled, so it cannot pass vacuously on an argv that silently dropped it. |

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
| ~~F-2~~ | ~~Where should the ephemeral session-health store live?~~ | RESEARCH | **RESOLVED 2026-07-31 — `~/.mypka/governor/health/<projectKey>/<sessionId>.json`, override via `MYPKA_GOVERNOR_HEALTH_DIR`. Outside GL-012's scope (secrets store + private-app session logs, neither of which this is) and outside any git working tree. See `tickets/T-02-session-health-store.md`.** |
| ~~F-3~~ | ~~What does `/close-session` actually do; what seams exist?~~ | RESEARCH | **RESOLVED 2026-07-31 — see §3 AD-12/AD-13 and §11.** |
| **F-4** | Are the proposed thresholds right? | **PROTOTYPE → dogfood** | T-08, then tune |
| **F-5** | How is "a new substantial item" detected from a prompt, well enough to block it without false positives? | **PROTOTYPE** | T-06 |
| **F-6** | What is the right bounded-override design (token? expiry? logged?) | **WARWICK** | Q-2 |
| **F-7** | How are active workers detected reliably? `isSidechain` exists in the transcript, but background-agent liveness may need the task/agent surface. | **RESEARCH — still open.** T-07 shipped a best-effort Windows process-command-line matcher (`tools/governor/worktree-recon.mjs`), not a resolution: it has a confirmed blind spot (a process whose command line embeds another worktree's path as literal text can self-match). A durable answer needs a session/task registry, not command-line text. | T-07 (partial), still fog for T-10 |
| **F-8** | Does Project ManagAIr impose any adapter shape we should honour now rather than retrofit? | **WARWICK** | Q-3 |
| **F-9** | Does the live statusLine payload ever literally distinguish "Auto mode engaged" from "an explicit model pin" (e.g. does `model.display_name` read something containing "Auto" when Auto is selected, or does it always resolve to the concrete underlying model regardless of mode)? Unconfirmed on this machine — T-01's capture did not record which mode was active during capture. | **RESEARCH — open, deliberately conservative in the meantime.** T-15 ships a best-effort detector (`/auto/i` match on the label) and fails closed to `UNKNOWN` whenever a fresh, session-matched sample cannot be read at all — the far more common case today, since T-03's sampler remains unwired from the live statusLine command. | T-15 (best-effort), still fog |

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
T-01 ✅──┬──► T-03 ✅ (sampler) ──► T-04 (evaluator, UNLOCKED, Opus) ──┬──► T-05 (status display)
        │                                                            ├──► T-06 (RED preflight)
T-02 ✅─┴──► T-03 ✅                                                   ├──► T-12 (portability)
                                                                     └──► T-08 (dogfood)
T-09 ✅──┬──► T-13 ✅ (state collector) ──► T-10 (/rotate-session, FULLY UNLOCKED, Opus)
T-07 ✅──┘                                                     │
         (F-7 live-worker detection still open)                └──► T-11 ──► T-08
T-09 ✅────────────────────────────────────────────────────────────► T-11
```

**T-13 is new, split out of T-10 by T-09.** Mapping live git / `worktree-recon` / `gh` output
onto a now-fixed, validated schema is mechanical; deciding whether the estate is *safe to
rotate* is judgement. Keeping both inside T-10 would have spent Opus on adapter plumbing.
T-10 may proceed without T-13 (it can collect inline), but should not — the split is what
keeps T-10 Opus-worthy.

**External dependency, live:** GL-012 §6a is **not in this worktree** — it exists only on
`recovery/...` at `95c265d`. Any ticket touching privacy or log placement must read it via
`git show 95c265d:"Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md"`.
See `00-ESTATE.md`.

**External constraint:** `.claude/settings.local.json` is globally gitignored. **Hook wiring cannot be
delivered by git.** Every ticket that "adds a hook" must also ship an idempotent activation step that
installs it into the primary checkout's untracked settings file — otherwise it ships nothing.

## 8. FRONTIER — takable right now

<!-- GOVERNOR:STATUS:BEGIN — generated from programme-state.json; do not hand-edit between the markers -->

**Phase:** Phase 2 — bounded implementation

**Completed (11):** T-01, T-02, T-03, T-04, T-07, T-09, T-10, T-11, T-13, T-14, T-15
**Frontier — takable now (5):** T-05 [Sonnet], T-06 [Opus], T-08 [Opus], T-12 [Sonnet], T-16 [Opus]
**Resumption:** T-05 — model Sonnet

_Machine-rendered from `programme-state.json` `tickets[]` — the execution-state SSOT (AD-17). Regenerated on every ticket resolution; the ticket-index table (§9) and the write-back log (§10) remain the human narrative record._

<!-- GOVERNOR:STATUS:END -->

**T-04 (Opus) landed 2026-07-31** (see §10 write-back). T-01, T-02, T-03, T-04, T-07, T-09,
T-10, T-11, T-13, **T-14** all resolved.

**T-04 unblocked T-05, T-06, T-12 and T-08 simultaneously** — T-08's other two dependencies
(T-10, T-11) were already resolved, so it is technically on the frontier too. The map's own
wave order (§9) still places T-08 in **Wave 5, after** T-05/T-06/T-12: dogfooding a real
rotation is more meaningful once the pieces that consume `evaluate()` actually exist, so
**T-05 is the chosen next action**, not a fake-automated pick — `deriveResumption` refuses to
auto-select among four frontier tickets, exactly as designed. The rotation half of this build
is complete; the **advice** half has now started with the pure evaluator core in place.

**Operating-model correction, mid-programme (new blocker D-3, ticket T-16 opened).** Nolan's
audit (dispatched over D-2) found this session's routing bypass was not an isolated lapse:
**T-01 through T-14 — the entire programme to date — were built without any Work Order or
Keel involvement**, despite `tools/governor/` being named explicitly in Keel's own contract as
in-scope. Root cause: Larry's routing cheatsheet (`Team/Larry - Orchestrator/AGENTS.md`) was
never updated for Keel or five other specialists hired since the original bundle — a real,
six-for-six SOP-001 process gap, not a one-off. **Warwick's explicit ruling: do not reopen or
rebuild T-01–T-14 over this.** Sound completed work is preserved; the existing merge-readiness
independent-review gate already requires QA current at the exact head for every ticket before
merge, regardless of build provenance. Going forward, T-16 (a mechanical delegation-enforcement
gate — ledger + threshold + specialist-match verification against `Team/agent-index.md`) is
being implemented under a proper accepted Keel Work Order, with Silas owning the ledger schema
and Nolan correcting the stale routing cheatsheet directly (Warwick's explicit approval,
2026-07-31, to edit that `AGENTS.md`).

**The rotation loop is now CLOSED.** T-10 banks, pushes and writes the canonical handoff;
T-11 gets it into the fresh session automatically via `SessionStart(source="clear")` →
`additionalContext` (≤10,000 chars), **and** makes the location a control rather than a
convention: the session's actual cwd, repository root, branch and HEAD are compared against
the banked state before any implementation, a mismatch produces a loud WRONG WORKTREE
result, and a committed `PreToolUse` gate refuses `Write`/`Edit`/`MultiEdit`/`NotebookEdit`
and mutating `Bash` until it is corrected. Both constraints are settled: **X-2** by shipping
a committed idempotent installer (the behaviour is in git; only the activation touches the
untracked file) and **Q-5** by *reconciling* the dangling `ensure-watcher` hook rather than
stacking beside it — see §12, now closed.

**T-14 landed 2026-07-31.** Warwick can now name a build and nothing else; readiness is a
computed five-check verdict rather than a judgement in prose; every review verdict is bound
to the exact commit it reviewed; and the PR is Larry's to create and update, never Warwick's
to request. **Three bounds stay open and are recorded honestly** rather than counted as
closed — see the T-14 write-back row in §10.

The frontier is no longer only a hand-maintained list: `frontierTickets()` in
`tools/governor/programme-state.mjs` computes it from `programme-state.json`, and the
validator **rejects** a ticket that claims `frontier` while a dependency is unresolved.

---

## 9. TICKET INDEX

Model column: Opus only where architectural judgement is materially valuable.

| ID | Ticket | Model | Depends | Acceptance | Mutation test |
|---|---|---|---|---|---|
| **T-01** | ~~**Prove the live statusLine payload.**~~ **RESOLVED 2026-07-31.** | **Sonnet** | — | ✅ met — `evidence/T-01-statusline-schema.md`; every §2 field marked | n/a (evidence-gathering ticket) |
| **T-02** | ~~Decide + implement the session-health store location and atomic write.~~ **RESOLVED 2026-07-31.** | Sonnet | — | ✅ met — `~/.mypka/governor/health/**`, GL-012 reasoning in `tickets/T-02-*.md`; 8/8 tests | ✅ passing — kill-mid-write + 12-real-process concurrent-write, both proven |
| **T-03** | ~~Sampler: statusLine script → health sample.~~ **RESOLVED 2026-07-31.** | Sonnet | T-01,T-02 | ✅ met — `tools/governor/sampler.mjs`, real health-store round trip proven, 25/25 tests | ✅ passing — malformed/empty stdin (real store + real child-process CLI), never corrupts, always exits 0 |
| **T-04** | ~~**Pure evaluator** — `evaluate(signals) → verdict`. All five states, distinct exit codes, missing-field semantics.~~ **RESOLVED 2026-07-31.** | **Opus** | T-03 ✅ | ✅ met — `tools/governor/evaluator.mjs`; 34/34 tests incl. a full 64-combination power-set sweep over the 6-signal vocabulary | ✅ passing — no signals (`{}`) → BLIND, never GREEN (INV-1); `examinedSignals` is always the full 6, never 0 (INV-5), even when every signal is missing |
| **T-05** | Status-line display: render verdict compactly. | Sonnet | T-04 | Renders all five states; degrades gracefully | Evaluator throws → line still renders, shows BLIND |
| **T-06** | RED preflight block via `UserPromptSubmit`. **Fails open.** Bounded override. | **Opus** | T-04, Q-2 | Blocks at RED with reason + override; rotation/read-only prompts always pass | **Hook throws / times out → prompt proceeds** (INV-2). Verify by forcing an exception. |
| **T-07** | ~~Worker + worktree reconciliation.~~ **RESOLVED 2026-07-31** (worktree side; F-7 live-worker detection remains open fog — best-effort only). | Sonnet | — | ✅ met — 22 worktrees reported (`evidence/T-07-*.md`); never-deletes enforced by source-scan test; 12/12 tests | ✅ passing — pure + **real-git** dirty-worktree mutation, both proven |
| **T-08** | **Live dogfood rotation** (M4). | **Opus** (judgement) | T-04,T-10,T-11 | A real rotation, then a fresh session completes a ticket with zero re-briefing | Remove the banked state → fresh session must *notice* and say so, not proceed blind |
| **T-09** | ~~Programme-state schema + writer (durable, git).~~ **RESOLVED 2026-07-31.** | **Opus** | — | ✅ met — schema, validator, writer, renderer; every required field asserted present **and required**; validated against the real estate (1,075 checks over BUILD-018's own live state) | ✅ passing — **real-git** move-HEAD stale detection with a positive control; plus all six rules individually disabled and proven to go red (`evidence/T-09-programme-state.md` §3) |
| **T-10** | ~~`/rotate-session` command: bank + **verify safety** + emit `/clear` instruction.~~ **RESOLVED 2026-07-31.** | **Opus** | T-07 ✅,T-09 ✅,T-13 ✅ | ✅ met — `tools/governor/rotate-session.mjs` + `.claude/commands/rotate-session.md`; refuses with the precise obstacle; AD-14 proven on real git; 31/31 tests | ✅ passing — **real-git** dirty tree / unpushed commit / live worker all refuse *and* commit nothing; plus BLIND paths and a failing push |
| **T-11** | ~~Reorientation: `SessionStart(source=clear)` → `additionalContext` pointer brief, ≤10,000 chars — **plus** canonical-location verification and the committed `PreToolUse` wrong-worktree deny gate.~~ **RESOLVED 2026-07-31.** | **Opus** | T-09 ✅,T-10 ✅ | ✅ met — `tools/governor/reorient.mjs`, `worktree-guard.mjs`, `install-hooks.mjs`; real-estate proof both ways (canonical → oriented at 6,928 chars; primary checkout → WRONG WORKTREE at 8,214); hooks live and idempotent; 84/84 ticket tests, 223/223 suite | ✅ passing — oversized state truncates *safely*, announces it, and never drops the next action **or** the refusal banner; **write aimed at the correct absolute path still DENIED** from the wrong worktree; unknown location denies, guard-throws defers |
| **T-12** | Portability: extract the estate adapter; run the core against a synthetic estate. | Sonnet | T-04 | Core has zero myPKA paths | Synthetic adapter with all-unknown signals → BLIND |
| **T-16** | **Mechanical delegation-enforcement gate** — delegation ledger (Silas-owned schema) + substantial-work threshold on direct Write/Edit/MultiEdit/mutating-Bash, composed additively onto `worktree-guard.mjs`'s PreToolUse pattern; a checkpoint must name a `governing_specialist` and record `specialist_match` against `Team/agent-index.md` — a generic dispatch cannot satisfy the gate where a named specialist fits. Added mid-programme after this session bypassed Keel/Silas for T-15's own design and implementation (see D-2, D-3). | **Opus** | — | Implemented under an accepted Keel Work Order (SOP-022); real test coverage incl. fail-open on internal error, threshold/reset behaviour, specialist-match logic | Ledger read/write forced to throw → ALLOW, never DENY (discipline gate, not a safety-critical one) |
| **T-15** | ~~**Post-clear model selection gate** — verify the selected model before releasing implementation, added mid-programme after a live defect (bank recommended Opus, session was Auto, implementation began unverified).~~ **RESOLVED 2026-07-31.** | **Opus** | T-11 ✅ | ✅ met — `tools/governor/model-gate.mjs` composed additively onto `reorient.mjs`'s `runHook`; 27/27 tests incl. a real CLI-subprocess acceptance test | ✅ passing — no session-matched sample → `UNKNOWN`, blocks (INV-1 applied to model verification); `applyModelGate` is a true no-op when the underlying `reorient()` result doesn't already permit implementation |
| **T-13** | ~~**Programme-state collector** — gather the live estate (git, `worktree-recon`, `gh`) into a document that passes `validateProgrammeState`.~~ **RESOLVED 2026-07-31.** | Sonnet | T-07,T-09 | ✅ met — `tools/governor/collect-state.mjs`; real-estate acceptance test (run against this repo, merged, validated) — 18/18 tests | ✅ passing — all three specified failures (no `gh`, unreadable worktree, git error) proven to land in `unknown`, never an empty list or a zero |
| **T-14** | ~~**Build-session registry/launcher by build NAME** + automatic programme-PR create/update at merge readiness + **exact-head QA binding** + present Warwick only the final merge decision.~~ **RESOLVED 2026-07-31.** | **Opus** | T-10 ✅,T-11 ✅ | ✅ met — `build-registry.mjs`, `qa-binding.mjs`, `merge-readiness.mjs`, `programme-pr.mjs`, `.claude/commands/build.md`; **proven live from `C:\` outside any repository**: `resolveBuild('governor')` returned the right worktree/branch/ticket, and every field was derived from a fresh re-read of the state file, not from the index. 133 new tests; **356/356** suite-wide | ✅ passing — head moved after review → verdict **SUPERSEDED**, does not carry forward (real git, 3 commits); unknown/abbreviated head → `UNKNOWN_HEAD`, never a prefix match; index made to lie → resolver returned the **re-read** location; `'merge'` injected into the allowed action set → 3 tests red. **16 deliberate mutations across the three modules, every one caught, all modules restored byte-identical** |

### Dependency order (waves)

1. **Wave 1 (parallel):** T-01 ✅, T-02 ✅, T-09 ✅, T-07 ✅
2. **Wave 2 (parallel, Sonnet):** T-03 ✅, T-13 ✅ — landed together 2026-07-31, different files
3. **Wave 3:** T-04 (needs T-03 ✅, still open) · T-10 ✅ (landed 2026-07-31)
4. **Wave 4 (current frontier):** **T-11** (needs T-09 ✅, T-10 ✅ — the next action) · T-04 · then T-05, T-06, T-12
5. **Wave 5:** **T-08 (dogfood)**

---

## 10. WRITE-BACK LOG

Append one line per resolved ticket. **A resolution not written back here did not happen.**

| Date | Ticket | Resolution | Newly unlocked |
|---|---|---|---|
| 2026-07-31 | Phase 1 | Map, contract, estate created. Telemetry surface proven to [DOC]+version level; live payload still unproven (F-1). | T-01, T-02, T-09, T-07 |
| 2026-07-31 | F-3 | **RESOLVED.** close-session steps 1–3 are the rotation subset; 4–7 are end-of-programme (AD-13). `fusion-brief/session-handoff.md` is the existing handoff contract to derive, not replace (AD-12). Eight reusable seams catalogued in §11. | Sharpens T-09, T-10, T-11 |
| 2026-07-31 | T-01 | **RESOLVED.** Real statusLine payload captured on this machine via a temporary capture command installed in the primary checkout's `settings.local.json` (backed up, installed, triggered, restored, diff-proven byte-identical). Both `context_window.*` and `rate_limits.*` present with documented names; `context_window_size` observed as `1000000` (1M, not 200k) — confirms thresholds must be percentage-based (already AD-4's design). `pr.*`, `worktree.*`, `workspace.git_worktree` all ABSENT in this capture, expected per the ticket's own caveats (no open PR; not a `--worktree` session). Several undocumented fields also observed and catalogued: `session_name`, `output_style.name`, `exceeds_200k_tokens`, `fast_mode`, `thinking.enabled`, `context_window.total_output_tokens`/`remaining_percentage`, `workspace.current_dir`/`project_dir`. Capture script kept at `tools/capture-statusline.mjs` for T-03 reuse. Full schema: `evidence/T-01-statusline-schema.md`. | T-02, T-07, T-09 remain frontier; T-03 still needs T-02 |
| 2026-07-31 | T-02 | **RESOLVED.** Session-health store decided and implemented: `~/.mypka/governor/health/<projectKey>/<sessionId>.json`, override via `MYPKA_GOVERNOR_HEALTH_DIR`. Confirmed out of GL-012's scope (secrets store + private-app session logs per §6a — this is neither) after reading the settled §6a text directly from `95c265d`. Atomic temp+rename write, per-writer-unique temp names. `tools/governor/health-store.mjs` + `health-store.test.mjs`, 8/8 passing including a 12-real-process concurrent-write mutation test and a kill-mid-write simulation. | T-03 (now unlocked jointly with T-01) |
| 2026-07-31 | T-09 | **RESOLVED.** Durable programme-state contract defined and implemented: `tools/governor/programme-state.schema.json` (18 required top-level fields) + `programme-state.mjs` (schema-interpreting validator, privacy guard, consistency checks, freshness, derived views, atomic write, handoff renderer) + 43 tests, all passing; 63/63 across the whole governor suite. **Location AD-14**: state lives with the programme on the programme's branch, and `banked.head_sha` is the head the state *describes* — a file cannot contain its own commit's SHA, so **T-10 must compare against the banking commit's parent** or RECOVERY fires on every rotation. Completed work and the frontier are **derived** from one `tickets[]` list, and the validator now rejects a ticket claiming `frontier` over an unresolved dependency — §8's "computed, not set by hand" is now literally enforced. An **empty collection is a positive assertion of "there are none"**; anything not gathered must be declared in `unknown` *with a reason*, which is what stops F-7's best-effort worker detection from reading as "nothing is running". AD-12 compatibility proven, not asserted: the renderer reproduces `session-handoff.md`'s frontmatter, H1 and five H2 sections in order (asserted), and the real file was **not** overwritten — the render is proven into `evidence/`. Privacy (INV-6/GL-012) enforced by three machine checks with a positive control proving a private build is still bankable. Validated against the **real** estate: BUILD-018's own live `programme-state.json`, 1,075 checks, 22 worktrees from T-07's `reconcile()`. All six controls individually disabled and proven to go red. | **T-13 (new, Sonnet)** — collector split out of T-10; **T-10** now unblocked (Opus); **T-11** partially unblocked (still needs T-10) |
| 2026-07-31 | T-03 | **RESOLVED.** `tools/governor/sampler.mjs`: `parseStdinPayload`/`extractHealthSample` (pure, never throw) + `sampleFromStdin` (the one impure step, still catches a throwing writer) + a CLI entrypoint that always exits 0. 25/25 tests, including the map-specified mutation (malformed/empty stdin after a good sample never corrupts the real health store — proven with `deepEqual` against the pre-corruption read) and a **real child-process** test of the actual `node sampler.mjs` invocation. Bug caught only by the real-process test, not the unit tests: the CLI's `isMain()` guard used naive `file://` string concatenation, which silently never matches on Windows (missing the third slash) — fixed with `pathToFileURL(...).href`. Not wired into the primary checkout's live `statusLine` setting — deliberately deferred (T-01's precedent required Warwick's explicit per-use authorisation under a read-back gate this dispatch does not carry, and this session's boundary is "do not audit the primary checkout"). | T-04 (evaluator) |
| 2026-07-31 | T-13 | **RESOLVED.** `tools/governor/collect-state.mjs`: `collectRepository`/`collectWorktrees`/`collectBranches`/`collectPullRequests` (each fails soft, independently) + `collectEstateState` (composes, dedupes `unknown`) + `mergeEstateIntoState`. Collects `repository`/`worktrees`/`branches`/`pull_requests` only — `workers` stays programme-tracked, not scanned (new **AD-16**: the dispatch record isn't git/gh-derivable, and inventing entries from an OS scan would manufacture false precision under a field whose whole point is refusing guessed data). `branches.behind` is **permanently** unknown by design (new **AD-15**: a trustworthy behind-count needs a fetch, and a collector must not mutate the repo it reports on) — matches this build's own `programme-state.json` precedent from T-09. 18/18 tests, including a **real-estate acceptance test** (no mocks: `collectEstateState` run against this actual repository — real git, real `gh pr list --repo warwickallan/Fusion247PKA`, real `worktree-recon.reconcile()` — merged onto the T-09 fixture, and asserted `validateProgrammeState(...).ok === true`) and all three map-specified source-failure mutations (no `gh`, unreadable worktree, git error), each proven to land its field in `unknown` rather than an empty list or a zero. | T-10 (**fully unlocked** — every dependency now resolved) |
| 2026-07-31 | T-10 | **RESOLVED.** `/rotate-session` shipped as `tools/governor/rotate-session.mjs` + `.claude/commands/rotate-session.md`. T-10 owns only the **judgement** (T-13 collects, T-09 validates/persists): `assessRotationSafety` is pure, returns schema-shaped obstacles, and **fails closed** — `clean === null` refuses ("unknown is not clean"), `unpushed_commits === null` refuses ("unknown is never zero"), and a safety-critical field the collector declared in `unknown` becomes an **obstacle**, never a check that quietly passed over unexamined ground. Live-worker detection is biased toward refusing but **excludes the rotation process and its parent**, or the command would always refuse against itself. **AD-14 implemented as an exported `isBankingCommit()`** and proven on real git (`bankedHeadSha === HEAD^`, `!== HEAD`) with a positive control — the naive comparison would fire RECOVERY on every rotation. Three distinct exit codes (0 rotated / 1 refused / 2 BLIND). 31/31 tests; **137/137** suite-wide. **Two findings:** (1) `--dry-run` initially still wrote+committed (only suppressing the push) — a dry run that mutates the repo is a trap; now returns before the first write. (2) The INV-4 control was originally a **substring ban** on `close-session`/`clickup`/`drive`, which failed instantly because the module legitimately *prints* "did NOT run /close-session" — a test that bans the string bans the sentence proving the invariant held. Replaced with invocation-shape controls: no import resolves to those surfaces, and **every `execFile` in the module shells out to `git` and nothing else**. **Proven live, not only in tests:** run against the real estate while this ticket's own work was uncommitted, it correctly REFUSED with `[dirty-tree]` and banked nothing. | **T-11 (the next action)** — reorientation now has both its dependencies (T-09, T-10) resolved |
| 2026-07-31 | T-11 | **RESOLVED — the rotation loop is closed, and the location is now a control.** `tools/governor/reorient.mjs` (SessionStart→`additionalContext`, ≤10,000 chars), `worktree-guard.mjs` (the shared location comparison **and** the `PreToolUse` deny gate) and `install-hooks.mjs` (committed, idempotent activation of both hooks + the Q-5 reconciliation). The brief and the gate read the **same comparison from the same module**, so the brief can never say "aligned" while the gate denies. New decisions: **AD-18** (the gate keys on cwd/repo-root/branch only — HEAD is reported but never denies, or the first legitimate commit would block the session for having succeeded), **AD-19** (unknown location + known canonical → DENY; no programme or guard-throws → ALLOW, both proven by test), **AD-20** (Larry owns the whole git lifecycle; Warwick never manages branches/worktrees/commits/pushes/PRs), **AD-21** (the verbatim EnterWorktree recovery protocol, embedded in the refusal itself because at the moment it is needed nobody is reading the map). **Proven on the real estate both ways**, not only in tests: from `C:/Fusion247PKA-governor` → oriented, 6,928 chars, carrying ticket/model/worktree/branch/pushed-head/blockers; from `C:/Fusion247PKA` → `WRONG WORKTREE` at 8,214 chars with the banner **above** the next action, and live `Write`/`git commit` both denied while `git status` still ran. **Two real defects caught by tests, not by reading:** (1) `git rev-parse --abbrev-ref` is *sticky*, so `--show-toplevel --abbrev-ref HEAD HEAD` prints the branch twice and the SHA never — the live HEAD would have been silently wrong everywhere; (2) a `programme-state.json` is a tracked file, so every worktree on the branch (and main, post-merge) holds a copy — counting *files* reported one build as several "active programmes" and the guard disarmed itself on the exact estate it was written for; identity is now the programme **ID**, preferring the self-consistent copy. 84/84 ticket tests, **223/223** suite-wide. Known bound recorded honestly: from a wholly unrelated repository the guard cannot discover the estate — mitigated by `--estate`, closed properly by T-14. | **T-14 (new, Opus)** — registry/launcher, automatic programme PR, exact-head QA binding, single merge decision; **T-08** now has 2 of its 3 dependencies (still needs T-04) |
| 2026-07-31 | T-14 | **RESOLVED — a build now runs itself, and the estate index cannot lie about where.** Four modules: `build-registry.mjs` (+ `.claude/commands/build.md`), `qa-binding.mjs`, `merge-readiness.mjs`, `programme-pr.mjs`, plus one bounded additive extraction — `discoverWorktreeRoots()` in `worktree-guard.mjs`, which `findCanonical` now calls, behaviour unchanged and proven so by running that module's own 27-test file unmodified before and after. New decisions **AD-22..AD-25**. **133 new tests; 356/356 suite-wide.** **Method note:** Larry designed the architecture and froze the interface contract (`T-14-CONTRACT.md`) *before* dispatching three parallel workers on disjoint files — disjoint ownership prevents collisions, not shared misunderstanding. Every dispatch was **read-back gated**, and the read-backs paid for themselves: they caught **three defects in the Work Order itself** — a contract mutation test that asked a *pure* function to observe a failure only git can see (split in two); a flat contradiction between "reuse the existing discovery" and "modify no existing file" (resolved by sanctioning the extraction, since duplicating it would put one fact in two files and a drift test only *reports* divergence); and the **vacuous-approval hole**, found **independently by two workers from opposite sides of the interface** — with no reviewers configured, `allCurrentApproved` is vacuously true over an *empty ledger*, so a wholly unreviewed programme would have passed the review gate green. Closed twice on purpose (producer *and* consumer, AD-24) and deliberately not deduplicated. **Two defects found only by running the code, not by reading it:** (1) `verdictStatus` compared repository paths as raw strings, so a caller holding a natural Windows backslash path never matched the boundary-normalised form — the module **could never return an approve**, a permanent false ABSENT indistinguishable from a genuine refusal; caught because the first run failed *every positive control while passing every negative*, which is exactly why the contract mandates positive controls beside negatives. (2) An alias-rule expectation was wrong, not the rule — the expectation was corrected. **Proven live, not only in tests:** the registry indexed the real 22-worktree estate (1 build, copies correctly collapsed), and from **`C:\`, outside any git repository**, `resolveBuild('governor')` returned the right worktree, branch and ticket — the T-11 foreign-cwd bound demonstrated rather than asserted. `assessMergeReadiness` run against the real banked state returns `ready: false`, `checked: 19`, naming the six unresolved tickets — correct, and it means **BUILD-018 cannot use its own PR machinery until every ticket lands** (a programme predicate is all-or-nothing by design). **THREE BOUNDS STAY OPEN — recorded, not counted as closed:** (a) the T-11 bound is only **half**-closed — *resolve* no longer needs the estate, but *building* the index still requires a session inside it or explicit roots, **and the PreToolUse gate still discovers by cwd probing and does not consult the registry**, so a foreign-repo session remains undiscoverable *to the gate*; (b) `head-pushed` compares a local ref against a remote-**tracking** ref that nothing in this estate refreshes (AD-15), so it can read green on stale data — the check's `detail` now says so in terms, and the honest fix belongs to the caller and is a read-only `git ls-remote`, which answers without mutating refs; (c) the registry can only see builds that have **banked** a `programme-state.json` — across 22 worktrees it found exactly **one**, so `/build` is useful for governor-era builds only until older programmes bank state. **Untested assumption, stated as scope:** that `gh pr create` prints the PR URL on stdout (the number parser depends on it) — unprovable without creating a PR. The other two `gh` surface assumptions (`--state all` returning `OPEN`/`MERGED`, and `isDraft` being a valid `--json` field) were **verified read-only against the real repository** at integration. **Nothing was fired**: no PR created, no `gh` write, no git write by any worker. | **T-04** is now the entire frontier, and the last dependency standing between here and **T-08**, the dogfood that is the real acceptance test (M4) |
| 2026-08-01 | Governor defect: T-14 dual-write staleness | **A REAL GOVERNOR DEFECT, CAUGHT BY THE GOVERNOR'S OWN OPERATOR, FIXED PERMANENTLY.** T-14 was written back into `02-MAP.md`'s narrative (this row's own §9 table, marking T-14 resolved) but the same fact was never written into `programme-state.json`'s `tickets[]` — a hand-edit-one-file-only slip. The very next `/rotate-session` banked exactly that stale document: `tickets[T-14].state` still `frontier`, `resumption.ticket` still `T-14`, `resumption.next_action` still the T-14 instruction — pushed to the remote before anyone read it back. Warwick caught it by inspecting the banked output before typing `/clear`, named it correctly as "not a documentation typo" but a **blocking Governor defect**, and required a structural fix, not a one-off correction. **Immediate correction applied**: T-14 resolved in the ledger with evidence (133 new tests, commit `c4febeaa9ebd3fa632035a906cc2d8a2143bedde`), frontier recomputed to the single ticket **T-04**, resumption re-pointed there — via the new canonical write-back, not a hand-edit, so the fix itself does not repeat the failure. **Architectural correction (AD-17 corrected — see its own row above):** `tickets[]` is now the **execution-state SSOT**; the map is demoted from co-equal SSOT to a **navigation projection** that no longer asserts ticket status on its own authority. Three new functions in `tools/governor/programme-state.mjs` — `resolveTicket` (resolves + attaches evidence; refuses empty evidence, one layer earlier than AD-24's own merge-gate check; **also promotes any sibling ticket from `blocked` to `frontier` when its dependencies are now all resolved**, a real second-order bug the validator itself caught mid-build), `deriveResumption` (auto-selects the sole frontier ticket; refuses to fake-automate a choice among *multiple* frontier tickets — a genuine judgement call — and refuses an explicit override that isn't actually on the computed frontier), `resolveTicketAndAdvance` (the pure atomic combination, validates before returning). Plus the impure entrypoint `applyTicketResolution` — computes BOTH the new ledger and the new map's generated status block (`renderMapStatusBlock`/`updateMapStatusBlock`, between the `GOVERNOR:STATUS` markers in §8) **before writing either file**, so a failure at any step leaves both untouched; proven by a mutation test that makes the computation fail and asserts neither file moved. **`/rotate-session` now refuses to bank at all if the two documents disagree**: `checkExecutionProjectionAgreement` parses §9's existing `~~title~~ **RESOLVED**` convention (the one already in use throughout this file — no new convention invented), compares it against `tickets[].state` in both directions (map-says-resolved-ledger-doesn't, AND ledger-says-resolved-map-doesn't), and a disagreement produces obstacle kind `stale-execution-state` with `STALE_EXECUTION_STATE` in its detail — a new, additive schema enum value, refusing exactly like every other obstacle in this module (nothing banked, nothing committed). Scope stated honestly: this check parses ONE specific, existing markdown convention: a ticket absent from §9's table is out of scope, not asserted either way, and the check does not verify the rest of the map's narrative (decisions, fog, prose) — those remain human-reviewed. **REGRESSION TEST reproduces the exact incident end-to-end against real git**: a scratch estate with the map hand-edited to claim a ticket resolved while the ledger still calls it frontier → rotation refuses, nothing banked, nothing committed (working tree still shows the uncommitted map edit) → `applyTicketResolution` resolves it canonically in both files atomically → committed and pushed → rotation now succeeds and names the correct sole next ticket. 386/386 suite-wide (30 new tests: `resolveTicket`/`deriveResumption`/`resolveTicketAndAdvance` unit + mutation coverage, the map-status-block renderer/updater, the projection-agreement parser in both directions, `applyTicketResolution`'s atomicity, and the full incident regression). | The dual-write class of defect is now structurally closed for every future ticket resolution, not just this one instance |
| 2026-07-31 | T-04 | **RESOLVED.** `tools/governor/evaluator.mjs`: `evaluate(signals) → verdict`, AD-11-pure (zero filesystem/git/myPKA imports — a plain object in, a plain object out). All five states with distinct exit codes 0-4 (`GREEN`/`AMBER`/`RED`/`RECOVERY`/`BLIND`), priority `BLIND > RECOVERY > RED > AMBER > GREEN`. Missing-field semantics implemented exactly as section 4 specifies: only `contextUsedPercentage` is required; every other absent signal (`rateLimitFiveHourUsedPercentage`, `growthProjectedRedBeforeCompletion`, `compactions`, `bankedStateStale`, `safeBoundary`) is `unknown`, logged, and skipped without escalating to BLIND on its own. **Judgement call, recorded rather than silently picked:** section 4's states table defines `RECOVERY` as authoritative-state-already-lost, placed OFF the main axis, while the adjacent threshold bullet describes compaction count as merely an AMBER/RED floor ON that axis — the two do not fully agree. This implementation took the states table as authoritative: any compaction (`>= 1`) this session, or a banked state known stale vs live git HEAD, resolves to `RECOVERY` outright (outranking even `RED`), because INV-3 says degraded in-context memory is not something a low context percentage should be able to mask. `safeBoundary` modulates the `advice` string only ("rotate now" / "reach a safe boundary urgently" / status-unknown), never the `state` itself, per section 4's explicit instruction. 34/34 ticket tests, including a full 64-combination power-set sweep over the 6-signal vocabulary (every present/unknown combination produces a structurally valid verdict, `examinedSignals` is always exactly 6, and `state === BLIND` iff `contextUsedPercentage` is absent — proven both directions, not just the positive case). 420/420 suite-wide, no regressions. | T-05, T-06, T-12 unlocked directly; **T-08** also technically unlocked (its other two dependencies, T-10/T-11, were already resolved) but deliberately not chosen as the next action — §9's own wave order places it after T-05/T-06/T-12 |
| 2026-07-31 | T-15 | **RESOLVED — added mid-programme over a live defect, not a pre-planned ticket.** A real `/clear` → continue cycle showed the banked state correctly recommending Opus while the visible session was Auto, and implementation reconnaissance began before the model was verified — T-04 was built under an unverified model as a direct result (see new blocker **D-1**). `tools/governor/model-gate.mjs`: pure core (`resolveCurrentModel`/`evaluateModelGate`/`renderCompactGate`/`isAutoLabel`/`normaliseModelFamily`) + one impure composition function (`applyModelGate`) + a CLI (`node model-gate.mjs check --state <path> --session <id>`) for the post-selection recheck — composed additively onto `reorient.mjs`'s `runHook` (a 3-line diff: one import, one wrapping call) **without touching the pure `reorient()` function itself**; `reorient.test.mjs`'s existing 34/34 tests pass byte-for-byte unmodified, proven by an empty `git diff` on that file. Fails closed to `UNKNOWN` per the commission's requirement 6 — the only real signal available (a health-store sample's `model.id`/`model.display_name`) reports the RESOLVED concrete model, not confirmed to distinguish "Auto resolved here" from "explicitly pinned" (new fog **F-9**); a label containing "auto" is a confirmed block, and the absence of any fresh session-matched sample — the common case today, since T-03's sampler is still unwired from the live statusLine command — is `UNKNOWN`, never a pass. 27/27 new tests, including a full live acceptance test against a REAL scratch git estate and REAL health-store temp dir, ending in an actual CLI subprocess run (not an in-process call). 447/447 suite-wide. **Process note, recorded rather than hidden (new blocker D-2):** this ticket's design and implementation were dispatched to generic ephemeral agents instead of being routed through the named specialist team (Keel/Silas per `Team/agent-index.md`) — Warwick corrected this mid-session; the code is preserved as landed and independently verified, but the ROUTING gap is recorded honestly and closes going forward, not retroactively rewritten here. | T-04 now carries D-1 (provenance-unknown, QA required before merge); this session also opened a separate, still-in-flight correction: a mechanical delegation-enforcement gate, being implemented under proper specialist routing per D-2's recommendation |
| 2026-07-31 | T-07 | **RESOLVED (worktree side).** `tools/governor/worktree-recon.mjs` enumerates all 22 worktrees (20 baseline + primary + this build's own) with disposition; never deletes (enforced by a source-scan test). Live-worker detection remains best-effort — F-7 stays open fog, not resolved. **Bug found by running against the real estate, not by unit tests**: naive substring matching let the primary checkout falsely claim sibling worktrees' (`-governor`/`-audit`/`-tower`/`-w01`) live workers because `"C:/Fusion247PKA"` is a literal prefix of their paths; fixed with a path-boundary check, regression test added, re-run to confirm the fix changed real output. 12/12 tests passing including a real-git dirty-worktree mutation. Full result: `evidence/T-07-worktree-reconciliation.md`. | T-10 partially de-risked (worktree recon available); F-7 still blocks a durable live-worker signal |

---

## 11. Reusable seams (inventoried 2026-07-31 — do not rebuild these)

| Seam | Path | Use |
|---|---|---|
| SessionStart hook array | `.claude/settings.local.json:194-207` | where the reorientation hook installs |
| **SessionStart stdout → context** | proven by `ensure-capture-gateway.mjs:52-58` printing plain text | a *second*, already-proven injection channel alongside `additionalContext`. Prefer the documented JSON field; this is the fallback if T-01 shows it unavailable. |
| Stop-hook stdin reader | `services/control-plane/tower-loop/bridge-ingest.mjs:120-137` | working, tested pattern for parsing hook stdin and locating `transcript_path` — copy this, don't reinvent |
| Stop hook slot | `.claude/settings.local.json:183-192` | post-turn health sampling |
| **Handoff contract** | `Team Knowledge/fusion-brief/session-handoff.md` | the file the Governor derives (AD-12) |
| **Programme-state contract** | `tools/governor/programme-state.schema.json` | the durable state schema. The validator *interprets this file* — it is the single source of the constraints, not a description of them, and it throws on any keyword it does not implement |
| **State validator / writer / renderer** | `tools/governor/programme-state.mjs` | `validateProgrammeState`, `writeProgrammeState` (fails closed), `readProgrammeState`, `evaluateFreshness`, `frontierTickets`, `renderSessionHandoff`. T-10, T-11 and T-13 all build on this — do not reimplement any of it |
| **State fixtures** | `tools/governor/fixtures/programme-state.*.json` | a valid base and a private-surface build. Break exactly one thing in the base for any new mutation test |
| **Sampler** | `tools/governor/sampler.mjs` | `sampleFromStdin(raw, opts)` — statusLine payload to a written health sample. Not yet wired as the live `statusLine` command (deliberately deferred, see T-03) |
| **Programme-state collector** | `tools/governor/collect-state.mjs` | `collectEstateState({repoPath, branchSpecs, ghRepo, ...})` → `{repository, worktrees, branches, pull_requests, unknown}`; `mergeEstateIntoState(base, estate)` folds it in. T-10 builds directly on this for the estate-derived fields |
| **Rotation + the AD-14 comparison** | `tools/governor/rotate-session.mjs` | `rotateSession({...})` banks/pushes/renders; `assessRotationSafety(estate, ...)` is the pure refuse-or-proceed judgement; **`isBankingCommit({headSha, bankedHeadSha, headParentSha})` is the comparison T-11 must use** — never a raw `HEAD !== banked.head_sha` |
| **Estate-root discovery** | `tools/governor/worktree-guard.mjs` | `discoverWorktreeRoots({probes, execFile})` — the **one** implementation of "what is the estate". `findCanonical` and `build-registry` both call it. Never write a second copy |
| **Build registry / launcher** | `tools/governor/build-registry.mjs` | `buildRegistry()` indexes, `resolveBuild(name, …)` resolves — and **always re-reads the state file**, so the index is never authoritative for a location (AD-22). `renderLaunch()` carries the AD-21 protocol verbatim. CLI exit codes 0 launchable / 1 cannot / 2 blind |
| **QA verdict ledger** | `tools/governor/qa-binding.mjs` | `canonicaliseTuple()` is **the boundary — the only place a SHA is resolved**; `verdictStatus()` binds verdicts to the exact head. Its 40-hex guard is a backstop, not the control: **no other module may construct a head string** (AD-23) |
| **Merge readiness** | `tools/governor/merge-readiness.mjs` | `assessMergeReadiness({state, git, suite, qa})` — pure, zero imports, five checks, fails closed (AD-24). `checked` scales with the ticket list, so it can never be a constant that proves nothing |
| **Programme PR + the merge decision** | `tools/governor/programme-pr.mjs` | `upsertProgrammePr()` is idempotent and **refuses unless ready**; `buildGhArgs()` is the argv-shape control that makes merging structurally impossible (AD-25). `renderMergeDecision()` is the **only** thing Warwick sees |
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

### ✅ CLOSED 2026-07-31 by T-11 — reconciled, not stacked beside

Warwick's ruling was to **reconcile** it. The file was confirmed missing at ruling time
(`services/control-plane/tower-loop/ensure-watcher.mjs` — absent from every worktree and
every branch's history; it was never committed, so there was nothing to "repair", and
repair would have belonged to PARKED Tower anyway).

The fix is deliberately **generic and self-limiting** rather than a one-off deletion of a
named file: *prune `SessionStart` command hooks whose target script does not exist on
disk.* That rule cannot over-reach (a hook whose script exists is never touched — proven by
a mutation test that makes the missing target exist and asserts nothing is pruned), it
fixes the class rather than the instance, and if Tower ever does ship `ensure-watcher.mjs`
the hook simply stops being prunable. Governor-managed hooks are exempt, so a fresh clone
can install before it builds. Everything pruned is **reported and backed up**, never
silently destroyed.

Applied live to `C:/Fusion247PKA/.claude/settings.local.json` on 2026-07-31 (backup
`settings.local.json.bak-2026-07-31T17-05-08-981Z`): the dangling `ensure-watcher` hook was
pruned, the working `ensure-capture-gateway` sibling was kept untouched, `Stop` was not
touched at all, and both Governor hooks were added. Re-running the installer twice more
reported "already correct. Nothing written." — idempotent, proven, not assumed.

**Q-5 is settled. X-2 is settled** (the installer is committed; only the activation touches
the untracked file).
