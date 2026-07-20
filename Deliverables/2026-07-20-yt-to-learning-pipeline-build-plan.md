# YouTube → Learning → Implementation Pipeline — Build Plan

**Approved 2026-07-20:** Warwick's end-to-end pipeline; "build local first then host; sequence is Larry's call." Local = the WP-D Directus + local Supabase stack. Every code WP goes through Codex + Fable before merge-ready ([[merge-ready-means-independently-reviewed]]).

## The pipeline (Warwick's stages) → what exists / what's new
1-5 (paste → durable accept → validate → Karpathy report → immutable transcript): **largely built tonight**; the one gap is the live **gateway worker** (Telegram→capture) alongside the running watcher (capture→packet).
6-11 (Cairn learnings → Supabase state → Directus surface → Accept → governed command → agent implements via PR → receipt): **the new build.**

## Optimal sequence (dependency-ordered, local-first)

### WP-P0 — clear the review backlog FIRST (discipline, not new code)
Before stacking a new pipeline on unreviewed work (the mistake just corrected), take the in-flight PRs to genuine merge-ready: Codex+Fable on #44 (merged, retroactive), #45, #46, #47, `build-002/multimodal-intake`, + #33. Fixes applied, then Warwick's merges. **Only then build on top.**

### WP-P1 — the schema backbone (Supabase) [foundation; everything reads it]
Migration on the control-plane `ops`/a new `cockpit` schema:
- `report` (id, source_type, source_ref, title, packet_path, rendered_html?, status, created_at) — one row per TubeAIR packet.
- `recommendation` (id, report_id FK, section, text, rationale, status[proposed|accepted|rejected|implemented], decided_at, command_request_id?) — the §§1-5 learnings.
- `activity_event` (id, kind, ref, status[done|todo], occurred_at) — the "latest activity / outstanding work" feed (projection over `agent_event` + these tables).
- `command_request` — **already exists** (migration 001); Accept writes here.
Default-deny, append-where-appropriate, review-gated. **Reviewed → merge.**

### WP-P2 — three independent lanes (parallel, each reviewed)
- **P2a Cairn brain:** a `pending_cairn` runner + Cairn's YT-packet job — read the packet, author the §§1-5 learnings (model step), write `recommendation` rows (proposed). Raw transcript stays immutable.
- **P2b Directus cockpit surface:** reports list + **clickable formatted reading page** (markdown→styled HTML, not raw) + recommendations with **Accept/Reject** + the **latest-activity feed** (10 events, done/to-do filter, date picker). Reads WP-P1 schema. Extends the WP-D proof, local.
- **P2c Capture→state wiring:** start the **gateway worker** (Telegram→capture) + wire the watcher's packet output to write a `report` row. Makes 1-7 flow end-to-end locally.

### WP-P3 — the action loop [after the cockpit shows Accept]
Accept → `command_request` (governed intent) → **agent wakes** (Larry via the DevBot ping / a command runner) → implements the accepted learning on a **branch/PR** (itself Codex+Fable reviewed, Warwick-merged) → writes the **result + evidence receipt** back to the `recommendation`/`report` state → Directus shows it. High-impact actions (merge/live) keep the explicit gate — Accept fires the *intent*, never an auto-merge.

### WP-P4 — host it
Once the whole loop is clickable locally and you've seen the value: the hosting decision (persistent Supabase + a home for Directus so it's phone-reachable). A deployment step, not a rebuild.

## Discipline notes
- **No stacking on unreviewed work.** WP-P0 clears first.
- Each WP: build (isolated worktree) → Codex+Fable → fixes → merge-ready → Warwick's yes.
- Local-first throughout; no live apply, no real personal data (synthetic/dev), no new credential until the model steps (Cairn analysis, any OCR/STT) are wired — those stay isolated for Warwick.
- Two-branch engineering cap holds where practical.
