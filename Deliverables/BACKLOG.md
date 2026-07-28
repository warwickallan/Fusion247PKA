# Fusion247 — Backlog (feature requests + bugs)

The single place we park things so they don't derail the current build. Larry logs here rather than
chasing a tangent mid-flow (see the "challenge context-diluting requests" rule). Newest first.

## 🫱 HELD BY LARRY — items with no other owner (created 2026-07-29)

**Why this exists.** Two rulings created gaps where an item could sit with nobody holding it, and Nolan
caught both while encoding them:

1. **Escalated service defects.** Mack escalates a defect; Larry must turn it into a Work Order; Warwick
   must authorise it. Nothing said what happens to a defect nobody picks up — so the service stays broken
   and everyone believes it is someone else's.
2. **First live start.** Keel is barred from touching anything live, so he can only prove restart and
   recovery against a throwaway target. That is *builder evidence, not operational acceptance*. Someone
   still has to perform the first live start, and it is neither Keel's nor Mack's. Left as "a Warwick gate
   performed by Larry", services would accumulate in a **built, evidenced, never started** state with no
   owner — structurally the same defect as (1).

**The rule: nothing sits between "raised" and "authorised" without a line here.** An item leaves this list
in exactly two ways — it becomes an authorised Work Order, or it is explicitly closed as won't-fix with a
reason. There is no third state, and "Larry is holding it in his head" is not holding it: a held item that
exists only in a session's context does not survive that context ending.

| # | Item | Type | Raised | Waiting on |
|---|---|---|---|---|
| 1 | **CI can go green having run zero tests.** `node --test "<glob-that-matches-nothing>"` **exits 0 with zero executed tests** — verified in an empty directory, 2026-07-29. Nine workflows run `node --test`; `control-plane-tests.yml` documents a fail-on-0-executed-subtests guard, but whether the other eight carry an equivalent is **unverified**. If they don't, a mis-wired suite reports success having proven nothing, which defeats every proof discipline we have. (Related, already known from W01 and in SOP-022: `node --test <directory>` is outright broken on Node v22.18.0 here — `MODULE_NOT_FOUND`.) | Defect — engineering | 2026-07-29 | Larry to raise as a Work Order (audit all 9 workflows for a zero-subtest guard) |

## 🐛 Bugs
- **[HIGH] Live YouTube capture still says "knowledge note pending — I'll write it next session" (manual).**
  Reported 2026-07-25 (Warwick sent a YT vid, no card/learn happened). The automatic Cairn → learn-worker →
  §7.1 → LightRAG → graph pipeline EXISTS (IDEA-007) but is NOT wired into the live capture bot / not running
  as a daemon, so a captured video sits un-learned until a session runs the worker by hand. This is a real
  gap, not by design. Fix: wire "Save to Brain" (or auto) → enqueue a Cairn LEARN job → run the learn-worker
  as a live daemon (with the enrich step). Separate from the cockpit build.
- **[LOW] `runtime.json` holds the OLD Directus admin password after Warwick changed it in the UI.** Harmless
  (Directus only uses ADMIN_PASSWORD to create the admin, which already exists), but stale — refresh it if any
  re-provisioning tooling ever needs the admin password again.

## 🚦 Warwick rulings recorded 2026-07-28 (decided, NOT to be implemented tonight)

- **[MED] `notify-snapshot-consumers.yml` must not remain permanently red by design.** Found during the
  estate-hygiene pass by applying the new CI doctrine (`Team/Larry - Orchestrator/AGENTS.md` §8a): its last
  result on `main` was `failure` at `76fcc7f8`, **2026-07-10** — eighteen days invisible, because the workflow
  only fires when `Expansions/` changes and so had dropped out of every recent run listing. The failure is
  *documented and intentional*: the workflow fail-fasts until the `MYPKA_SYNC_TOKEN` and `MYPKA_SOURCE_REPO`
  repo secrets exist, and it changes nothing in either repo meanwhile.
  **Warwick's ruling (2026-07-28):** a permanent red-by-design is not acceptable state. **Do not configure or
  invent secrets.** The next maintenance action is either (a) disable its automatic trigger, or (b) make missing
  configuration report an explicit **successful NOT-CONFIGURED / NOT-RUN** state — while **retaining manual
  dispatch** and the documented prerequisites in the workflow header. **Not to be implemented tonight.**
  Rationale: a red that is expected trains everyone to ignore red, which is the exact failure §8a exists to stop.

- **[MED] Dedicated off-machine capture persistence — a future deliberate design decision.** `persistCapture.mjs`
  (landed 2026-07-28, PR #77) makes generated captures durable by **committing** the note and its immutable `_raw`
  evidence, which removes the loose-untracked failure mode that stranded two captures. **Warwick's ruling
  (2026-07-28): persistence remains COMMIT-ONLY for now — do NOT auto-push the currently checked-out branch.**
  Pushing would mean choosing a branch and a moment on the caller's behalf, mid-work, which is uncertain
  repository semantics. Off-machine durability therefore still relies on the branch's normal push/PR flow.
  The open design question, to be taken deliberately rather than inferred: **which ref, and when** — e.g. a
  dedicated captures ref, a scheduled sync, or a non-git store. Note `pending-warwick-review` stays the human
  acceptance gate regardless: **stored/durable != approved/canonical.**

## 🔧 Operational-truth debt (recorded separately — NOT idea-engine scope)
- **[MED] Stale Fusion self-model tables.** `cockpit.build` (last updated 2026-07-22) + `cockpit.overall_state`
  (2026-07-21) are **hand-maintained and days stale** — they don't reflect the cockpit lift-out or the
  idea-engine. The dynamic self-model (what's live / being-built / parked / broken) should progressively be
  **DERIVED from authoritative live sources** (git activity, running processes, migrations) rather than
  hand-updated. Longer-term direction (Warwick): Fusion reconstructs **A** (self-model) from live sources;
  Larry's session memory is useful now but **must not** become the permanent operational truth; **Honcho**
  progressively takes over **B** (autobiographical); **C** (governance) stays in deterministic files.
  Deliberately OUT of scope for the Transfer-Intelligence experiment — that slice uses the smallest
  *trustworthy* context (git-derived "happening now" + backlog + rule files + a hand-distilled Warwick seed),
  and Larry's reconciliation layer backstops the lean packet.

## 🧠 Session continuity / durable context (separate problem — do NOT build now)
- **[HIGH-ish] Larry's rich context must not evaporate on compaction/restart.** Identified 2026-07-26 during the
  idea-engine B-context design. Larry's session memory is useful *today* but must NOT be the permanent home of
  operational truth (A) or Warwick context (B). Direction: **A** reconstructed from live sources (git/processes/DB);
  **B** = a durable `curated_seed` file (maintained by a future **/close-session** ritual or **CuratAir**), progressively
  replaced/enriched by **Honcho** as it proves mature; **C** stays in deterministic files. **Do NOT turn this into a
  CuratAir/memory-system build now** — for the idea-engine experiment, the smallest durable B artefact
  (`Team Knowledge/fusion-brief/warwick-context.curated_seed.md`, provenance `curated_seed`) is sufficient.

## 💡 Feature requests / ideas
- **Backlog surface in the cockpit.** Once the cockpit's mature, surface this backlog as a cockpit area (or an
  Attention/Output feed) so feature-requests/bugs are captured + triaged from the phone, not a markdown file.
- **A "Save to Brain" tap that genuinely triggers the auto-learn** (ties to the bug above) — the button exists
  on the capture card; make it drive the live learn pipeline end-to-end.

## 🔨 Cockpit (IDEA-016) — remaining after the Brain slice
- Shopping projector → Attention (mum's shopping: alternatives-awaiting-choice, budget flags) — DONE-criterion #3.
- Builds/System live projections (replace the hand-curated Home/overall_state tables) — DONE-criterion #1 (full).
- Telegram notification loop: durable outbox → consequential notification → deep-link into the exact cockpit
  item → act → receipt — DONE-criterion #5.
- CareerAIr plug-in proof (sidebar route + one projector) — DONE-criterion #7.

## 🔨 Shopping actions (next focused pass — mutates live household data)
- Wire the governed choose/approve buttons for shopping decisions (choose_alternative, accept needs-decision
  item, approve over-budget) via the asdair command_request seam + a new allowlisted command in the asdair
  worker. Deliberately NOT done at the tail of a long session because it MUTATES live household shopping data —
  do it in a focused pass with proof-first. Shopping is already VISIBLE in the cockpit (read-only projection).

## 💡 Cockpit UX (from Grok's cold-read of the screenshots, 2026-07-25)
- **Outputs cards read passive.** The "so what" cards state an observation but don't carry a clear next
  action or a strong "this matters because…". Give each output a recommended next step or a sharper stakes line.
- **A "parked / later" state for Build-lane questions** so architectural decisions never sit in the same
  urgency lane as "we're about to run out of toothpaste". (Life/Build lanes are the first cut of this; a real
  defer state is the next.) Ties to notify_policy.
- DONE in this pass: killed duplicate shopping cards (one decisive card per item, swap folded in); split
  Attention into Life vs Build lanes (blockers stay loud on top).
- The metric that matters (Grok): "how often do you clear the Attention list in under two minutes?" — worth
  instrumenting once actions are wired.
