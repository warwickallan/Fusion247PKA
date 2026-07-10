# SOP-011 - Meeting Prep

- **Default owner:** Warden
- **Reusable by any agent.** Any specialist prepping a client/business meeting on an active engagement can run this.
- **Triggered by:** "prep me for [meeting]" / "what should I walk into [meeting] knowing" / a scheduled client or internal meeting on an active engagement.
- **Output:** a Meeting Prep note under `Reporting-QA-Comms/`.
- **References:** [[GL-006-client-delivery-frontmatter-conventions]] (Register Item schema, source-tier doctrine), [[SOP-010-warden-extract-source-to-evidence-pack]].

## Purpose

Assemble what to walk into a meeting already knowing — priorities, decisions needed, blockers, overdue items, questions to ask — entirely from the register, Work Package status, and existing Evidence Packs. Normally **zero** transcript rereads. This is only possible because [[SOP-010-warden-extract-source-to-evidence-pack]] has already turned prior sources into structured, trustworthy Register Items — Meeting Prep spends that investment rather than repeating the extraction work.

## When to call this

Before a scheduled client or internal meeting on an active engagement, when Larry routes a "prep me for X" request. Not a substitute for [[SOP-010-warden-extract-source-to-evidence-pack]] — if the engagement has no register yet, run that first.

## Steps

### 1. Read the inputs

- Register Items for the engagement with `status` in `open`, `monitoring`, or `in-review`.
- Work Package statuses for the engagement.
- The most recent Evidence Pack(s) touching this engagement (for context, not for rereading the source behind them).
- The Engagement note's `## Status update` and `## Stakeholders` sections, to confirm who's actually attending and their role.

### 2. Default to zero transcript rereads

The whole point of SOP-010 having already run is that Meeting Prep doesn't need to reopen anything. The one exception: a `reread_flag: mandatory` item directly relevant to this meeting's agenda that hasn't been resolved yet. If that happens, flag it explicitly at the top of the output — don't quietly skip it, and don't quietly resolve it by rereading and reinterpreting on the spot; that's SOP-010's job, done properly, not a shortcut inside meeting prep.

### 3. Rank by contractual impact first, then down

Adapted from GL-006's source-tier precedence doctrine — items that touch what the engagement is actually obligated to deliver get airtime before items that are merely urgent, because a tier-1 obligation is what nothing else in the register can override:

1. **Contractual impact** — items whose `source_ref` touches a tier-1 artifact, or that carry a "possible tier-1 conflict" flag from SOP-010.
2. **Safety/compliance impact.**
3. **Delivery-critical-path impact** — items blocking a Work Package's `done_state`, or a milestone.
4. **Operational impact** — day-to-day running, non-blocking.
5. **Urgency** — proximity of `target_resolution_date` / `target_date`.
6. **Effort** — genuinely low-effort items get a mention even if they rank lower elsewhere, so the meeting can bank quick closes.

### 4. Draft the output

- **Top priorities** — the ranked list above, trimmed to what's actually relevant to this meeting's attendees.
- **Decisions needed** — open `kind: decision` items, with what's specifically needed to move each one.
- **Blockers** — Work Packages at `status: blocked`, plus open `severity: critical`/`high` register items blocking a Work Package's `done_state`. (Register Item's own `status` enum has no `blocked` value — don't invent one; blockage is expressed through the Work Package or through severity + open status.)
- **Overdue items** — open register items whose `target_resolution_date` has passed, and Work Packages whose `target_date` has passed and aren't `done`. (myPKA has no discrete `action` entity — see SOP-010's note on this; overdue "actions" are read off these two fields.)
- **Questions to ask** — `evidence_type: unresolved-discussion` items, and any open item with no `owner` set.
- **Suggested meeting order** — sequence the agenda by the ranking in step 3, not by whichever item happens to be freshest.
- **Who owns what** — split owned-internally vs. owned-by-the-client: start from each item's `owner` field (a Person slug), then check whether that slug appears in the Engagement's `client_contacts` or `linked_stakeholders`, or whether the Person's own `company` matches the Engagement's `client_org` — if either holds, list as client-side; otherwise, list as internal. This is a best-effort cross-reference, not a guaranteed read: those Engagement fields are optional, and today's schema has no way to distinguish an internal team member from a third-party/subcontractor owner at all (see GL-006's §"Known gaps"). Unowned items are listed as **unowned**; an owner whose side can't be determined from the data above is listed as **side unknown** — never guessed.

### 5. QA checklist (Meeting Prep-specific)

- Every priority item traces to a live Register Item or Work Package field — not a recollection of "I think this was still open."
- No transcript reread happened unless a `reread_flag: mandatory` item forced it, and if it did, that's stated explicitly, not buried.
- The ranking actually follows the contractual-impact-first order above, not recency or whoever raised it loudest.
- Unowned items are labeled unowned, never quietly assigned to whoever's convenient to ask.

### 6. Save

`Client Delivery/<engagement-slug>/Reporting-QA-Comms/<engagement-slug>-meeting-prep-YYYY-MM-DD.md`. Plain markdown, no frontmatter — tier 5 (generated output) per GL-006's precedence doctrine.

## Worked example

Larry: "prep me for tomorrow's Bellrock steering call." Warden reads the register (18 open items), Work Packages (WP-003 at `blocked`), and the two most recent Evidence Packs. Ranks: a `change` item touching a Schedule clause (contractual impact, tier-1 `source_ref`) tops the list; a safety-flagged `risk` on site access is next; WP-003's blocker (waiting on a client-side environment) follows as delivery-critical-path. No transcript reopened. Output saved to `Reporting-QA-Comms/bellrock-npl-implementation-meeting-prep-2026-07-11.md`.

## Common mistakes to avoid

- Reopening a transcript "just to double-check" a high-confidence item — defeats the one-read design SOP-010 exists to protect.
- Ranking by urgency or recency first — inverts the contractual-impact-first rule and buries a real obligation behind a noisy-but-minor item.
- Treating "unowned" items as a formatting inconvenience and assigning them anyway to make the list look tidier.
- Silently resolving a `reread_flag: mandatory` item inside meeting prep instead of flagging it and routing the actual reread through SOP-010.
