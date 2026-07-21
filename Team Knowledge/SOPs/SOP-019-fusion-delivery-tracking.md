# SOP: Fusion Delivery Tracking (ClickUp + GitHub)

- **Status:** Active (since 2026-07-12, per Warwick's explicit authorization: "Larry — from now on, you own the visual delivery management for all Fusion-related work across GitHub and ClickUp.").
- **Default owner:** Larry. **Fusion only.** Fable owns Foundry (Ideas/Work-Package ideation in Drive) separately — never configure or populate Foundry from this SOP, and never mix Foundry planning/records into the Fusion setup except where a clear dependency genuinely needs linking.
- **Triggered by:** any new or continuing Fusion delivery item — a new Idea, a new Work Package, a planned-but-not-yet-built delivery slice, an in-flight PR, or a merge that needs recording.
- **References:** [[GL-004-task-resource-linking]] (one-way linking discipline, applied loosely across systems here too), [[SOP-018-independent-change-qa]] (the review discipline PRs still go through — this SOP tracks visibility, it does not replace PR review), `Team/Larry - Orchestrator/AGENTS.md` §"Tool quirk log" (ClickUp/Zapier reliability notes, not duplicated here).

## Division of authority (do not blur these)

- **GitHub** owns branches, commits, PRs, reviews, and merged implementation. It is the factual record. **GitHub's actual merged state always wins if any other system disagrees about whether code shipped.**
- **ClickUp** owns current delivery status, priority, dependencies, sequencing, and portfolio visibility. Visual/operational layer only — concise, not a narrative store.
- **myPKA Markdown and Google Drive** own durable decisions, architecture, governance, and accepted outcomes. This is where reasoning lives. Never duplicate a full Markdown document into ClickUp — link to it and summarize only what's needed to manage delivery.
- **Claude session/chat history** is temporary working context. It is not a source of truth and must be refreshed against `main`, ClickUp, and the canonical myPKA task record on every resumption — never rely on compressed prior-session memory alone.
- **A ClickUp card, a GitHub issue, or a GitHub Project card is never itself implementation authorization.** Existing task/PR governance (Warwick's explicit sign-off) always applies on top, regardless of what the board shows.
- **Foundry vs build — the layer boundary (do not confuse these).** Foundry — both the *Fusion 247 Foundry* Space in ClickUp (IDEA Portfolio, per-idea lists/docs) **and** Fable's Foundry in Drive — is for **idea exploration, promotion readiness, source evidence, risks, options, and handoff pointers**: the idea, not its build. **Once an IDEA is promoted into build, production records — build/WP status, PR execution notes, closeouts, implementation logs — belong in MyPKA (Fusion 247 MyPKA ClickUp), the GitHub PR, the repo session log under `Team Knowledge/`, and the relevant MyPKA BUILD/WP task records — NEVER in Foundry.** Foundry may receive only a **lightweight promotion/status pointer**, e.g. *"IDEA-NNN promoted to BUILD/WP; implementation tracked in `<MyPKA task / PR / session log>`."* Do not write build closeouts, WP status, PR execution notes, or implementation logs into any Foundry list, task, or doc. Layer summary: **Foundry preserves the idea · MyPKA manages the build · GitHub records the code · session logs preserve execution evidence.** (Added 2026-07-18 after a breach: a TubeAIR WP0 closeout was wrongly posted into the Foundry `IDEA-013 — TubeAIR Build Notes` list; corrected to a pointer.)

## Tool capability facts (established by direct testing, 2026-07-12 — don't assume, verify if this ever seems wrong again)

**GitHub Projects (v2):** no direct read or write access exists via any tool available to Larry — confirmed by two separate capability checks. Do not keep re-testing this each session. Instead, Warwick has configured an **auto-add workflow** on `warwickallan/Fusion247PKA` filtered on `label:"fusion-build"` — adding or updating that label on an issue or PR is what feeds the Project. Larry cannot read the Project, set its custom fields, move cards, or visually confirm cards appeared — **Warwick confirms that visually.** Do not report this capability gap as "the Project can't be populated" — it can, through the label workflow; report instead that the label workflow was fed.

**GitHub labels:** no `create_label`/`update_label`/`delete_label` tool exists. Workaround (tested, works): GitHub's issue/PR label-write endpoint (`issue_write` with `labels: [...]`, on `create` or `update`, and this works identically on PRs since PRs are issues under the hood) **auto-creates** any label name that doesn't already exist. Use this instead of waiting for a dedicated label tool.

**ClickUp — direct MCP connector:** can be `connected: true` at the account level but `enabledInChat: false` for a given chat — a per-chat toggle, not a re-auth problem. When this happens, no `@`-mention picker necessarily appears in Claude Code either. **Working fallback: Zapier's `ClickUpCLIAPI` actions** (`list_enabled_zapier_actions` → `execute_zapier_read_action` / `execute_zapier_write_action`). Reads (`findTaskById`, etc.) were reliable every time. **Writes (`updateTask`) timed out 3 of 4 attempts in practice** — a timeout does not mean the write failed; it can land anyway. **Always re-read the task after a timeout before retrying**, to avoid a blind double-write.

**ClickUp — structural gaps:** no `create_space` tool (Spaces must be created manually in the ClickUp UI if a dedicated "Fusion247" Space is ever wanted — until then, use the existing default Space). No `create_custom_field` tool (only a read, `get_custom_fields`) — use the task's native `status`/`priority` fields plus a consistent markdown-description template instead of bespoke custom fields.

## Naming conventions

- Idea: `IDEA-NNN — <name>`
- Work Package: `WPn — <name>`
- PR title: `[IDEA-NNN][WPn] <delivery scope>`
- Branch: `idea-NNN/wpn/<scope>`
- **Never predict or reserve a PR number before the PR exists** — in ClickUp task names, GitHub issue titles, or anywhere else. Track planned work by its plain description (e.g. "Synthetic/redacted Client Delivery engagement proof"), not "PR #11." Add the real PR number/link only after GitHub actually creates it. (This SOP exists partly because that mistake was made and corrected once already — see the doctrine-absorption discipline in [[SOP-018-independent-change-qa]] §"Multi-round and repeated-review discipline" for the general version of "don't propagate an unconfirmed assumption as precedent.")
- Include the relevant ClickUp task ID in future branch names, commit messages, or PR descriptions once implementation is authorized — this is what lets ClickUp's native GitHub integration (once Warwick authorizes it in ClickUp's own UI) auto-link activity.
- Never rename historical branches or rewrite git history merely to achieve naming consistency.

## ClickUp structure model

```
Workspace (single)
└── Space (use the existing default Space unless Warwick creates a dedicated one — no create_space tool)
    ├── Folder: one per Idea — "IDEA-NNN — <name>"
    │   ├── List: one per Work Package — "WPn — <name>"
    │   │   └── Task: one per delivery slice, PR, or meaningful non-code deliverable
    │   └── (leave a WP's List empty until real work exists — do not invent placeholder tasks)
    └── Folder: "Fusion — Needs classification (historical, pre-<next Idea>)"
        └── List: historical items that don't map confidently to a named Idea/WP
```

**Do not create empty complexity to satisfy this hierarchy.** Collapse layers where the work is genuinely small; a Folder/List with nothing real in it yet is fine, a fabricated task is not.

**Task description template** (since no custom fields exist — use markdown_description, consistent every time):

```
GitHub PR: <link, or "not yet opened">
GitHub tracking issue: <link, if a thin tracking issue exists and no PR yet>
Branch: <name, or "not yet created">
Claude session: <reference, or "none yet">
Current status: <plain statement>
Next action: <plain statement>
Blocking dependencies: <plain statement>
Outcome: <concise, filled after merge>

myPKA: [[canonical record]]
```

Use ClickUp's real dependency links (`waiting_on`) to encode sequencing, not just prose — a reader should be able to see the chain, not have to infer it from text.

## GitHub label taxonomy (keep lean — no cosmetic variants, no duplicates)

`fusion-build` (applied to every Fusion-tracked issue/PR — this is what feeds the Project auto-add workflow), `idea-NNN` (one per Idea), `type-idea`, `type-work-package`, `type-delivery`, `wp-0n` (one per Work Package number), `needs-classification` (historical items not confidently mapped to an Idea/WP).

## Thin GitHub tracking-issue pattern

- **One parent Idea issue per Idea.** Title `[IDEA-NNN] <name>`. Labels: `fusion-build`, `idea-NNN`, `type-idea`. Body contains only: outcome, canonical myPKA/Drive links, ClickUp folder link, current active Work Package, related PRs, concise next action. No essay.
- **One issue per Work Package.** Title `[IDEA-NNN][WPn] <name>`. Labels: `fusion-build`, `idea-NNN`, `type-work-package`, `wp-0n`. Body links to the parent Idea issue, the relevant ClickUp List, the canonical myPKA record, current status, known dependencies, related PRs. **Do not invent implementation scope for a Work Package that hasn't started** — mark it planned/not started plainly.
- **One issue per planned delivery item with no PR yet.** Labels: `fusion-build`, `idea-NNN`, `wp-0n`, `type-delivery`. Body must state plainly: authorization status (not yet authorized, unless it genuinely is), what it depends on, that no branch/PR exists yet. **Creating this issue is never itself authorization to implement.**
- **Never create a duplicate GitHub issue to represent a PR that already exists.** The PR is the delivery card — label it (see below), don't shadow it with an issue.

## Retrospectively classifying historical work

- Classify confidently only where the evidence actually supports it (e.g. a PR whose content directly built or evaluated a specific Idea's subject matter).
- Where genuinely uncertain, mark `needs-classification` — in both the ClickUp list and the GitHub label — rather than inventing a plausible-sounding Idea/Work Package assignment merely to make the board look tidy.
- Do not create new GitHub issues to represent historical PRs. Apply labels to the PR itself.

## Ongoing per-delivery-item workflow

For every future Fusion delivery item, in order:

1. Confirm it belongs to a named Idea, or explicitly state that none applies.
2. Confirm it belongs to a Work Package, or explicitly state that no separate Work Package is needed.
3. Create or update the ClickUp task (using the description template above).
4. If work is planned but no PR exists yet, create the thin GitHub tracking issue with the right labels.
5. Link the relevant myPKA and Google Drive records from both ClickUp and GitHub — reciprocal links, concise, never a duplicated narrative.
6. When implementation is actually authorized (separately, explicitly — this workflow existing is not that authorization): create the branch and PR under the naming pattern, include the ClickUp task ID somewhere useful for native linking, and use `Closes #<issue>` in the PR body where a tracking issue exists.
7. Keep ClickUp's status and next action current during execution. GitHub stays authoritative for branch/PR/merge state.
8. After merge: record the merge result, a concise outcome, outstanding follow-up, and the next delivery slice — in ClickUp (concise) and myPKA (durable), with reciprocal links. The label state should already have fed the GitHub Project auto-add workflow; no separate Project action is needed or possible from here.
9. Close or park the working session cleanly when switching work.
10. On resumption, refresh from `main`, ClickUp, and the canonical myPKA task record before relying on compressed session/chat context.

## Guardrails

- Fusion only. Never configure or populate Foundry beyond a lightweight promotion/status pointer — build status, WP records, PR notes and closeouts go to MyPKA/GitHub/session-logs, never Foundry (see Division of authority §"Foundry vs build").
- Never alter application architecture, schema, or implementation scope as a side effect of an organisational/tracking pass.
- Never build a bespoke integration, connector, or dashboard for this — use the native ClickUp MCP when reachable, the Zapier `ClickUpCLIAPI` bridge as fallback, GitHub's native issue/label/PR primitives, and Warwick's already-configured Project auto-add workflow.
- Never expose private client content in GitHub or public ClickUp records.
- Never duplicate a full Markdown document into ClickUp. Link to the canonical record and summarize only what's needed to manage delivery.
- Don't block progress over naming, formatting, or harmless historical uncertainty (use `needs-classification` instead of stalling).
- Don't ask Warwick to make every setup choice before anything is created — use sensible defaults, test actions safely before trusting them, and improve the structure through actual use rather than up-front perfect design.

## Build Log ID response rule (added 2026-07-13, per Warwick's explicit directive)

Applies across every interface Larry runs in — Claude chat, Claude Code, Codex-mediated work, and any future coding interface. Governs Larry's visible chat response whenever a BUILD-*** ClickUp Doc's "Build Logs & Agent Handoffs" pages are touched — additive to, not a replacement for, the ClickUp task/description conventions above.

1. **Whenever Larry appends a new ClickUp Build Log entry** (a `[FROM: LARRY] [ID: LRY-####] ...` block on a BUILD Doc's PR log page), the visible chat response reporting that action must begin, on its first line, with exactly:
   ```text
   [ID: LRY-####]
   ```
   matching the ID just written to ClickUp, character for character.
2. **`[ID: LRY-####]` and `[RE: LRY-####]` are not interchangeable.** `[ID: ...]` marks a new builder entry Larry just wrote. `[RE: ...]` is reserved for a reviewer's routed reply referencing the builder entry it reviewed — Larry is the builder in this workflow, not the reviewer, so Larry's own visible responses use `[ID: ...]`, never `[RE: ...]`, even when acting on a reviewer's routed reply.
3. **When Larry acts on a reviewer's routed reply** (e.g. a `[RE: LRY-####]` block from Vex, GPT, or another reviewer), Larry creates a new, unique builder entry with its own `[ID: LRY-####]` and appends it to the ClickUp Build Log. He may reference the originating review by ID in that entry's body, but the reviewer's `[RE: ...]` is never reused as Larry's own external-response identifier.
4. The identifier:
   - appears on the first line, nothing before it;
   - is never abbreviated, renamed, or replaced with a separate chat-only identifier;
   - refers to the same BUILD, WP and PR as the ClickUp entry it corresponds to.
5. **If no ClickUp entry was actually created**, Larry states that plainly instead of opening with an ID or RE prefix — never claims one unless it genuinely was written.
6. The remainder of the visible response stays compact: a one-line status plus any decision required from Warwick. Full evidence, diffs, and detail stay in the ClickUp Build Log, never duplicated into chat.

## Common mistakes to avoid

- Predicting/reserving a PR number before the PR exists (already made and corrected once — see "Naming conventions" above).
- Treating a ClickUp connector `enabledInChat: false` as a broken/unauthenticated connector — check `ListConnectors` first; if `connected: true`, it's a per-chat toggle, not a re-auth issue, and Zapier's bridge is available as a same-session fallback regardless.
- Retrying a timed-out ClickUp write blindly. Re-read first.
- Creating a GitHub issue to shadow a PR that already exists.
- Inventing an Idea/Work Package assignment for a historical item just to avoid an untidy `needs-classification` label.
- Reporting "the GitHub Project can't be populated" instead of "the Project was fed through the label auto-add workflow; Warwick confirms visually."
