---
name: PAX-01-wayfinder-adaptation
type: research-brief
build: BUILD-018
author: Pax
created: 2026-08-01
amended: 2026-08-01
status: recommendation-pending-warwick
private_surface: none
---

# PAX-01 — Should myPKA adopt a "Wayfinder" method?

**Research only. Nothing here is implemented. Nothing is implemented until Warwick accepts it.**

> **Amendment, 2026-08-01.** Pax's runtime has no Bash tool (Read/Write/WebFetch/WebSearch/Grep/Glob
> only), so the original brief could not sweep git history. Larry ran the sweep and supplied it: it is
> folded into §2.1 and the corresponding hedge in §8 is retired. The AD-9 finding was promoted out of
> the anti-pattern list into its own section (**§2a**) at Larry's direction. Confidence flags are
> unchanged — the `SKILL.md` verbatim-text confidence remains **MEDIUM**.

---

## Executive summary

Wayfinder is a real, published, primary-sourced planning skill by Matt Pocock, and BUILD-018 already
runs a partial adaptation of it — distilled from a *transcript of a video about the skill*, not from
the skill itself, which **has never existed in this repository's git history and is not installed on
this machine**. The adaptation's most load-bearing deviation from the original is also the one that
**failed in production** (the T-14 dual-write incident — §2a). My recommendation is **(c) combine
selected parts**: take the original's vocabulary and discipline, keep the repository's git-and-ledger
substrate, and explicitly discard four things. §5 restates it as a numbered accept/reject list.

---

## 1. The original Wayfinder — what it actually is

**Confidence: HIGH.** Four sources, one primary.

| # | Source | Type | What it establishes |
|---|---|---|---|
| S1 | `github.com/mattpocock/skills` → `skills/engineering/wayfinder/SKILL.md` | **PRIMARY** — fetched 2026-08-01, file exists and was read | Frontmatter, trigger, map sections, ticket types, both workflows, fog rules |
| S2 | `Team Knowledge/Sources/f3ll98pj90o-wayfinder-nothing-is-too-big-to-plan-anymore.md` | In-estate Cairn note over Pocock's own launch video (YouTube `F3lL98Pj90o`, published 2026-07-30) | Creator's stated intent, worked example, write-back loop, disposable spec |
| S3 | `claudeskills.info/skills/mattpocock/skills/wayfinder/` | Secondary aggregator | Map sections, ticket types, HITL/AFK split, frontier |
| S4 | `claudemarketplaces.com/skills/mattpocock/skills/wayfinder` | Independent secondary aggregator | Same, plus the graduate-fog test |

**⚠️ Name collision — flag this before anyone searches.** `github.com/glitchwerks/claude-wayfinder`
is a **different, unrelated project**: a deterministic agent/skill *dispatch router* with a
seven-decision scoring kernel. It has nothing to do with planning. It is the first result for
"wayfinder claude code". Anyone re-researching this will land on the wrong thing.

### The operating model

- **Destination first.** One or two lines at the top of the map: a spec to hand off, a decision to
  lock, or a change to make. It fixes scope. Every session orients to it before picking a ticket.
- **The map** is a single issue labelled `wayfinder:map` with exactly five headings: **Destination**,
  **Notes**, **Decisions so far**, **Not yet specified**, **Out of scope**.
- **Tickets are child issues, and they are typed** — and the type carries who must be present:
  - **Research** — AFK. Fired as parallel subagents.
  - **Prototype** — HITL. A rough artefact to sharpen discussion.
  - **Grilling** — HITL. A conversation to resolve a decision. *"The agent never stands in for the
    human's side of it."*
  - **Task** — AFK or HITL. Real-world work unblocking a decision.
- **Frontier** = the open, unblocked, unclaimed children. Rendered by the tracker's own blocking
  edges, so the human sees what is takeable without opening the map.
- **Fog of war** = what you can tell is coming but cannot yet phrase. Parked in *Not yet specified*.
- **The graduate-fog test:** ticket it *now* if you can state the question sharply, **even if it is
  blocked**; keep it in fog if you cannot. One foggy patch may graduate into several tickets or none.
- **Write-back:** resolve → comment on the ticket → close it → append a one-line gist + pointer to
  *Decisions so far*. The map stays current rather than becoming a stale plan.
- **One ticket per session**, research excepted. Claim by assigning yourself *before* working.
- **The spec is disposable.** Once its content is in the codebase, Pocock closes and deletes it; the
  **ticket history** is the durable primary source (S2, §"Mechanisms").
- The skill is **human-invoked only** (`disable-model-invocation: true`). *Single-source — S1 only.*

### The original's own trigger test

Use it when the work exceeds one agent session **and** the path is unclear. **Do not** use it when the
way is already clear and small enough for one session, when execution rather than planning is the
need, or when the critical decisions are already locked.

---

## 2. What already exists in this repository

**Confidence: HIGH.** Absence is now established by git history, not inferred from a filesystem scan.

### 2.1 The git sweep — executed by Larry, 2026-08-01

Run in `C:/Fusion247PKA-governor` at HEAD `9a2a0f4`, across **all refs**:

| Command | Result |
|---|---|
| `git log --all -i --grep=wayfinder` | **2 commits** — `f7d3983` *"BUILD-018 Phase 1: isolated estate, Wayfinder map, goal contract, first ticket"*; `780a517` *"BUILD-018 T-01: prove live statusLine payload on this machine"* |
| `git log --all -i -S wayfinder` (content added/removed) | **8 commits**, all BUILD-018's own work plus `95c265d` on the recovery branch |
| `git log --all --diff-filter=A --name-only -- '*ayfinder*'` | **zero files** — no file with "wayfinder" in its name has ever been added, on any branch, at any point in history |

**Established, not hedged:** the original Wayfinder `SKILL.md` **has never existed in this
repository's git history on any branch**. **`f7d3983` is the genesis of the adaptation, and the
adaptation is the only implementation that has ever existed here.**

**The one hedge that remains** (git cannot speak to it): `~/.claude` and plugin space. I searched
`C:\Users\Buggly\.claude\**` and every `SKILL.md` under `.claude\plugins\**` — 43 skills across 4
marketplaces — and found no `wayfinder` skill. That is a point-in-time filesystem observation, not a
history claim.

**Consequence, and it matters:** BUILD-018's adaptation was distilled from **S2, a transcript note**,
which itself records the gap honestly — *"the referenced skills repo itself is not fetched or examined
here… it would need a separate, deliberate fetch-and-review pass, not inference from this video
alone."* That pass is this brief. It is why the adaptation carries the vocabulary (fog, frontier,
write-back, dependencies) but **not** the ticket typing, the HITL/AFK split, the claim rule, or the
five fixed map headings — none of which the video explains in enough detail to copy.

### 2.2 The artefacts, and where

| Artefact | Path | Role |
|---|---|---|
| **The map** | `Deliverables/BUILD-018-session-governor/02-MAP.md` — frontmatter `method: wayfinder-adapted`, genesis `f7d3983` | 454 lines: architecture, 26 settled decisions (AD-1…AD-26), fog table, Warwick questions, dependency graph, generated frontier block, 20-row ticket index, 20-row write-back log, reusable seams |
| Phase label | `00-ESTATE.md` — *"Phase 1 — Wayfinder / architecture (Opus)"* | Names the method as the phase |
| Ticket specs | `tickets/T-*.md` (9 present) | Later ones are full Work Orders |
| Execution ledger | `programme-state.json` → `tickets[]` | **Execution-state SSOT** per AD-17 |
| Machinery | `tools/governor/programme-state.mjs`, `rotate-session.mjs` | `frontierTickets()`, `resolveTicket`, `deriveResumption`, `applyTicketResolution`, `renderMapStatusBlock`, `checkExecutionProjectionAgreement` |
| Source note | `C:\Fusion247PKA\Team Knowledge\Sources\f3ll98pj90o-*.md` (+ `_raw/F3lL98Pj90o/`) | The distillation input |

### 2.3 What the adaptation changed, and why

| Original | BUILD-018 | Verdict |
|---|---|---|
| Map on the issue tracker | **Map in git markdown** (AD-8) — *"subagents get no MCP tools, so a tracker-hosted map is unreadable by the very workers who need it"* | **Correct, and better.** Keep. |
| Frontier rendered by tracker blocking edges | **Frontier computed** by `frontierTickets()`; the validator rejects a ticket claiming `frontier` over an unresolved dependency | **Better than the original.** Keep. |
| Ticket history primary, spec disposable | **AD-9: map is SSOT, tickets link to it** — an explicit, recorded inversion | **This is the one that broke.** See §2a. |
| Four typed tickets (research/prototype/grilling/task) | Not carried. Only *fog* is typed (`RESEARCH` / `PROTOTYPE` / `WARWICK` in §5) | Partial. The fog typing is good; the **ticket** typing is the loss. |
| One ticket per session; claim before working | Not carried — waves, and T-14 ran three parallel read-back-gated workers | **Right call.** Do not import. |
| Grilling as a first-class ticket | Not carried — Warwick's questions sit in §6 as prose (Q-1…Q-5) | The gap that matters most for VlogOps. |

---

## 2a. THE LOAD-BEARING FINDING — a map that asserts status will lie to a fresh session

**This is the most important finding in this brief, and it is not only a Wayfinder finding. It is
direct evidence about session-recovery correctness.**

### What happened

Pocock's original keeps ticket status in exactly one place — the tracker — and the map holds only
one-line gists pointing at it. **AD-9 deliberately inverted this**, making `02-MAP.md` the SSOT with
tickets linking to it. That put ticket status in **two** places: the map's hand-authored narrative,
and `programme-state.json`'s `tickets[]`.

On 2026-08-01 the two disagreed. T-14 was written back into the map's §9 narrative as resolved, but
the same fact was never written into `tickets[]` — an ordinary hand-edit-one-file-only slip. The very
next `/rotate-session` **banked exactly that stale document**: `tickets[T-14].state` still `frontier`,
`resumption.ticket` still `T-14`, `resumption.next_action` still the T-14 instruction — **and pushed
it to the remote before anyone read it back.**

**The failure mode in one sentence: the rotation banked a resumption pointer instructing a fresh
session to redo work that was already finished.** Warwick caught it by inspecting the banked output
before typing `/clear`, and correctly named it a blocking Governor defect rather than a documentation
typo.

### Why it is structural, not clerical

Nothing enforced that the two documents agreed, and **nothing said which one would win if they
didn't**. AD-17 originally called the map an "execution SSOT" — the exact ambiguity that produced the
incident. A fresh Larry reading several artefacts had no way to rank them without asking.

The correction (AD-17 as corrected, plus `resolveTicket` / `deriveResumption` /
`resolveTicketAndAdvance` / `applyTicketResolution` / `renderMapStatusBlock` /
`checkExecutionProjectionAgreement`) is sound machinery. But note what it is: **machinery built to
re-close a hole that the deviation from the original opened.** The original never had the hole.

### The rule

> **The map holds navigation — destination, fog, decisions, dependencies. It never holds status.**

Status lives in exactly one place, with exactly one sanctioned way to change it.

### What this implies for anything that derives a resumption pointer

**A resumption pointer must be derived from ticket state, never from a map.** A map is hand-authored
prose; prose drifts silently, and drift in a resumption pointer is invisible at the moment it is
created. It becomes visible one session later — to a session that has already started doing the wrong
work, and which by construction has no memory with which to doubt it. That is the specific reason this
defect class is more dangerous than its size suggests: **rotation deliberately removes the only
context that could have caught it.** Three consequences worth carrying into the Session Governor:

1. **A projection must never be a rival source.** `programme-state.json` as a whole, the rendered
   `session-handoff.md`, and the map's generated status block are all projections. A disagreement
   between a projection and its source is a defect **in the projection**, and the source wins.
2. **Refuse to bank a disagreement.** The strongest control here is not the corrected write path — it
   is `checkExecutionProjectionAgreement` making `/rotate-session` **refuse outright** when the two
   documents disagree. A recovery mechanism that transports an inconsistency faithfully has done the
   wrong job perfectly.
3. **The blast radius of a stale pointer is a whole fresh session**, not a line of text. It should not
   be triaged as cosmetic.

**Scope note, stated honestly:** `checkExecutionProjectionAgreement` parses one existing markdown
convention (§9's `~~title~~ **RESOLVED**`). A ticket absent from that table is out of scope and not
asserted either way, and the rest of the map's narrative — decisions, fog, prose — remains
human-reviewed and unchecked. That is a real residual bound, not a closed one.

---

## 3. The other anti-patterns — what the mediocre version looks like

**A-1 — A hand-authored map that asserts execution status.** Promoted to §2a; not repeated here.

**A-2 — The map becomes a build journal.** `02-MAP.md` is 454 lines; single write-back rows exceed
400 words. As a forensic record it is outstanding. As *the thing Warwick inspects to see where we
are*, it is unreadable — the only glanceable part is the 6-line generated `GOVERNOR:STATUS` block.
*Rule: cap the map. Narrative goes to `evidence/`, prose reasoning to the decision row, not the map body.*

**A-3 — Wayfindering work that was already clear.** The original names this as its own
counter-indication. Applying a map to a build Larry could already plan spends an Opus charting
session to produce a plan he had. *This is the failure mode most likely here*, because the method is
new and interesting.

**A-4 — Two vocabularies for one idea.** "Fog", "blockers", "open questions", "unknowns" and
"assumptions" already coexist in this estate. The map itself had to write a disambiguation note
(*"'Blockers' in the commission = this concept, not a fifth artefact"*). *Rule: one word each, fixed.*

**A-5 — Confusing Wayfinder with the Session Governor.** Both use the words "state", "frontier",
"resumption" and "next action". They are different jobs (see §4) and a fresh Larry meets both in the
same reorientation brief.

---

## 4. THE BOUNDARY TABLE

| Artefact | Owns (one line) | Must never do (one line) |
|---|---|---|
| **Wayfinder** | Mapping and resolving *uncertainty* — the destination, the fog, the decision tickets, their dependencies, and the write-back of each resolution. | Never execute implementation, never assert ticket/execution status (§2a), and never be started for work whose route is already clear. |
| **Build Contract** *(= `01-GOAL-CONTRACT.md`, `Builds/*/BUILD-CONTRACT.md`)* | The product outcome, the invariants, the acceptance shape and the scope boundary — the thing a ticket is a defect against if they disagree. | Never carry route, sequence, ticket status or open questions; never change quietly because execution found something inconvenient. |
| **Implementation Plan** | The *initial* delivery route — work-package breakdown and order, as of the day it was written. | Never be treated as prescription or as current state; it is superseded by the map the moment execution diverges (AD-17 §4). |
| **Execution tickets / Work Orders** | Bounded implementation under an accepted read-back: outcome, `file_surface`, authorities, acceptance criteria, required evidence. | Never resolve an open *decision* — a Work Order presumes the outcome is settled; an unsettled one belongs in a Wayfinder ticket. |
| **Session Governor** | Context health, banking, verified-safe rotation, reorientation, and the location/model gates. | Never own product content: it must not decide what to build, what the frontier *should* be, or when a decision is settled — it only projects and transports what the ledger already says. |
| **Execution controller** | Continuing work across items until a *genuine* human stop — and refusing the manufactured pause (AD-26, T-17). | Never continue past a real product decision, a material scope change, spend, an irreversible live action, or the merge decision. |

**The single sentence that separates the two most confusable:** *Wayfinder decides **what** is still
unknown; the Session Governor decides **whether this conversation can still be trusted to work on it**.*

---

## 5. Recommendation — **(c) combine selected parts**

**Each item below is independently acceptable or rejectable.** Cost is rough and assumes the machinery
in `tools/governor/programme-state.mjs` is reused, not rebuilt.

### ADOPT — from the original, not currently in the repo version

| # | Item | Why | Rough cost |
|---|---|---|---|
| **A1** | **The five fixed map headings** — Destination / Notes / Decisions so far / Not yet specified / Out of scope. Anything that is not one of these does not belong in the map. | The structural cap that fixes A-2. Turns a 454-line journal into a one-screen map. | Template only — part of one Work Order |
| **A2** | **Typed decision tickets with an explicit HITL/AFK flag** (research / prototype / grilling / task). | **Highest value.** myPKA has *no artefact for an unresolved question*: a Build Contract assumes the outcome is known, a Work Order assumes the decision is made. Makes Warwick's input a queueable batch, not an interruption. | Template + one field (`ticket.type`, `ticket.hitl`) — same Work Order |
| **A3** | **The graduate-fog test, verbatim** — ticket it if you can state the question sharply, even if blocked; otherwise it stays fog. | The only defence against a map full of vague gestures. | One paragraph in the SOP — free |
| **A4** | **Destination as a hard scope-fixer** — "a redrawn destination means a fresh map, not a resumption." | Names scope change as scope change instead of letting a map quietly become a different map. | One paragraph — free |
| **A5** | **`Awaiting Warwick (n)`** in the generated status block, listing HITL tickets. | Lets Warwick see whether the build is blocked *on him* without asking. Depends on A2. | **1 small ticket** — `renderMapStatusBlock` already exists |
| **A6** | **One short SOP** (`chart a map` / `work a ticket`) + the trigger test as a Guideline. | Without it the method is folklore. Must be *short*, or A-3 wins. | Same Work Order as A1 |

### KEEP — already built and tested; no action, just do not revisit

| # | Item | Why | Cost |
|---|---|---|---|
| **K1** | **Map in git markdown, not a tracker** (AD-8). | Subagents get no MCP tools; ClickUp is unreliable here; git is diffable and survives. Correct fork — should never be reopened. | none |
| **K2** | **Computed frontier + the validator that rejects a frontier claim over an unresolved dependency.** | Better than the original, which relies on a human wiring tracker edges correctly. | none |
| **K3** | **`programme-state.json` `tickets[]` as the single execution-state SSOT** (AD-17 corrected), with `resolveTicket`/`applyTicketResolution` the only sanctioned write path. | This is §2a's rule, already implemented. | none |
| **K4** | **`checkExecutionProjectionAgreement` — refuse to bank a disagreement.** | The control that actually bites. Generalise it to any future map rather than leaving it BUILD-018-specific. | folded into the portability work below |

### DISCARD — do not bring across

| # | Item | Why not |
|---|---|---|
| **D1** | **The issue tracker.** | Settled by AD-8. Workers cannot read it; ClickUp is unreliable; git is reviewable. |
| **D2** | **One ticket per session, and claim-by-assignment.** | Pocock's sessions *are* the human's sessions. Larry dispatches parallel workers on disjoint files, and BUILD-018's strongest stretch (T-14) was three parallel read-back-gated workers. *Keep the spirit — one **decision** per ticket — not the rule.* |
| **D3** | **The disposable spec.** | Direct conflict with the SSOT Golden Rule and with AD-17's graduation of build records into `Builds/`. Deleting the destination document would destroy the audit trail. |
| **D4** | **AD-9's map-as-SSOT inversion.** | Already corrected after the §2a incident. Carry the correction forward as the rule; do not repeat the experiment. |

### Cross-cutting

**Generalising the ledger beyond BUILD-018 is largely T-12's existing portability scope — 1–2 tickets,
and it should be done *there*, not as a parallel effort.**

**Explicitly NOT to be built:** no tracker integration, no bespoke "grilling skill", no map database,
no second status store.

**Per-build ongoing cost:** one charting conversation (Opus) plus one decision per ticket thereafter —
only paid on builds that pass the trigger test.

**Net: a template-and-vocabulary adoption riding on machinery that already exists and is already
tested — roughly one Work Order (A1–A4, A6) plus one small ticket (A5). It is not a build.** If it
starts looking like a build, that is A-3 and scope should be cut back to the template.

**Justified against Warwick's UX.** He reads git, on a phone, through a web client; he cannot read a
tracker and neither can the workers. His scarcest resource is his own decision-making attention, and
an unnecessary question is an acceptance failure (AD-26). A2 + A5 convert his input from
*interruptions he must field* into *a batch he can clear when he chooses* — that is the UX win, and
it is the only part of the original the repo version is actually missing.

### The explicit trigger test — when Wayfinder is NOT used

**Chart a map only when ALL THREE hold:**

1. **Span:** the work will not fit in one conversation *even with rotation* — it spans multiple
   rotations or multiple weeks.
2. **Fog:** there are **≥3 open questions whose answers change the shape of the build** (not its
   implementation detail), and at least one cannot be answered by Larry from context — it needs
   research, a prototype, or Warwick.
3. **Route:** Larry **cannot** name the first three work packages with confidence.

**If Larry can name the first three work packages with confidence, do not chart a map.** Write the
Build Contract, write the Implementation Plan, issue Work Orders. That is the whole test.

**Explicitly not triggers:** "it feels big"; a long ticket list with no unresolved decisions; a single
open question (resolve it with one research or prototype Work Order); anything already mid-execution
under an accepted plan. **A map is for fog, not for size.**

### Proposed visible workflow — what Warwick sees, where, when

1. **At commission** — Larry proposes a map and states the trigger test result explicitly ("3 of 3
   met, here is the fog"). If the test fails, Larry says so and goes straight to a Build Contract.
   *Warwick sees:* one short message, and a yes/no.
2. **After charting** — `Deliverables/BUILD-nnn-<slug>/02-MAP.md` exists with the five headings, a
   named Destination, and the fog sketched. *Warwick sees:* a **one-screen** map. He can read the
   Destination and *Not yet specified* in under a minute and correct the aim before any work happens.
3. **On every rotation and in the reorientation brief** — the generated `GOVERNOR:STATUS` block shows
   *Completed / Frontier / Resumption*, and — new — **`Awaiting Warwick (n)`** listing the HITL
   tickets that need him. *Warwick sees:* whether the build is blocked **on him**, without asking.
4. **When he has time** — he clears the HITL queue in one pass. Each answer is written back as a
   one-line gist in *Decisions so far*, with a pointer to the ticket holding the full reasoning.
   *Warwick sees:* his own decisions, batched, in one file, in git.
5. **At the end** — the map's *Decisions so far* is the decision record; it graduates to
   `Builds/BUILD-nnn/` alongside the Build Contract. Nothing is deleted. *Warwick sees:* one durable
   trail from "we didn't know" to "here is why we chose this."

---

## 6. How this serves a build such as VlogOps

*Not a design of VlogOps — only how the method would serve it.*

VlogOps is the case the method exists for: **large, foggy, and partly editorial**. It passes the
trigger test on all three counts, and it fails the *current* process at a specific, identifiable
point — **a Build Contract requires a known outcome, and VlogOps' outcome is a matter of editorial
taste that only Warwick holds.** Today that has nowhere to live.

- **The destination would be named first, and that alone is valuable** — "what does a publishable
  VlogOps artefact look like?" is the question the build has been circling.
- **Its fog is mostly `WARWICK`-typed, not `RESEARCH`-typed.** Editorial questions — what the show
  is, who it is for, what a good episode looks like, what may never be shown — are HITL grilling
  tickets by definition. The map turns them from a stalled build into a **queue Warwick can clear in
  one sitting**, with each answer written back as a durable one-line decision.
- **Its evidence streams already exist and are already named** — root `AGENTS.md` records
  close-session checkpoints, the Daily Flight Recorder, commits/PRs/CI and editorial context as
  VlogOps evidence streams. Those feed *research* and *task* tickets; they do not answer the
  editorial ones, which is exactly the split the ticket types make visible.
- **Prototype tickets are the anti-waterfall valve.** Pocock's own stated defence against heavy
  planning becoming waterfall is frequent prototypes; for an editorial build that means *make one
  rough episode-shaped artefact and react to it*, which resolves more fog than any amount of
  specification.
- **The out-of-scope section does real work here.** Editorial scope creep is the characteristic
  VlogOps risk; a permanent, written *Out of scope* is the cheapest control available.

---

## 7. Methodology

Web: searched for the skill, identified and separated the name collision, fetched the primary
`SKILL.md` from `main` (2026-08-01) and corroborated against two independent aggregators and the
in-estate transcript note. Filesystem: `wayfinder` (case-insensitive) grepped across both working
trees; globbed `C:\Users\Buggly\.claude\**` and every `SKILL.md` under `.claude\plugins\**`. Git
history: swept by **Larry**, 2026-08-01, at HEAD `9a2a0f4` across all refs — three commands,
reproduced in §2.1. Read `01-GOAL-CONTRACT.md`, `02-MAP.md` (all 454 lines), `00-ESTATE.md`,
`03-ROTATION-HANDOFF.md`, `T-05-status-line-work-order.md`, `Team Knowledge/Templates/work-order.md`,
`Builds/INDEX` listing, BUILD-002's `BUILD-CONTRACT.md` and `IMPLEMENTATION-PLAN.md` headers, and the
BUILD-015 continuation brief. No file was modified except this one; no git command was run by Pax.

## 8. Limitations — read these before acting

1. **~~No git history was searched.~~ RETIRED 2026-08-01** — swept by Larry and folded into §2.1.
   Absence from all branches is now **established**, and `f7d3983` is named as genesis. **The residual
   hedge is `~/.claude` and plugin space only**, which git cannot speak to: searched 2026-08-01, no
   `wayfinder` skill found, but that is a point-in-time filesystem observation, not a history claim.
2. **I hold no verbatim text of the original `SKILL.md`.** The fetch tool declined full
   reproduction. Structure is HIGH confidence (four sources agree); **exact wording is MEDIUM** and is
   deliberately not upgraded.
3. **`disable-model-invocation: true` is SINGLE-SOURCE (S1 only).** Flagged as required.
4. **The skill is a live upstream file.** I read `main` on 2026-08-01; it may have changed since the
   2026-07-30 video, and it will change again. Any adoption should record the date read, not treat
   the upstream as stable.
5. **`GL-012` was deliberately not read** (pre-ruling text in this worktree, per the Work Order).
   Nothing here depends on it; `private_surface: none`.
6. **Opinion vs fact.** §1, §2 and the incident narrative in §2a are sourced fact — the T-14 incident
   is recorded in the map's own write-back log, and the git sweep is reproducible. §2a's *rule and
   implications*, §3 (anti-patterns), §5 (recommendation) and §6 (VlogOps) are **my judgement**, built
   on that evidence.
