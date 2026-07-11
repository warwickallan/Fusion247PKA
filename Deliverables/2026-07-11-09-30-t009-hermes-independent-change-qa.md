# Independent Change QA — 2026-07-11 09:30 — t009-hermes

## Reviewer independence

Reviewer: Pax (Claude, this session). Author of change under review: Cairn (same underlying model/session — the Hermes pilot was run earlier in this same engagement, under the umbrella of the now-closed `tsk-2026-07-10-001`).

**Independence level: Same-model review — not independently verified.** This is real, useful QA work, but it is not the genuinely independent gate T009 needs before it can close. That gate is a separate, later, non-author review (Fable/ChatGPT or Warwick) against this PR's pushed head SHA.

## Review window

- **Requested:** Per `SOP-015-cairn-process-external-source`'s own worked example (§Worked example) and decision 19 of `tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden` (the original "#1 fully validated end-to-end" claim, read directly in that task file): Cairn was to author its own pilot-processing procedure, then run it end-to-end against a real Hermes/NetworkChuck transcript — classify per GL-008, decide destination (new note vs. enrich existing), evidence-label every claim, test and reject candidate entity notes rather than reflexively creating them, flag transcription-quality ambiguities honestly, and surface any raw-source-provenance gap rather than silently patching it.
- **Claimed:** Cairn's own session log, `Team Knowledge/session-logs/2026/07/2026-07-11-04-30_cairn_hermes-transcript-pilot.md` (located directly, not assumed by filename guess) — authored `SOP-015` (ten steps), read the transcript once, classified Video/Audio Transcript, enriched the existing `ai-tooling.md` Topic (backfilling its missing GL-002 frontmatter opportunistically), tested and rejected five candidate entities with reasoning, applied evidence-origin labels including an on-the-fly sub-distinction for "directly present but the source's own claim is unverified," created zero backlinks, and flagged the raw-source-provenance gap to Silas via Larry as unresolved.
- **Actual:** Read directly, current state — `Team Knowledge/SOPs/SOP-015-cairn-process-external-source.md` (exists, 11 numbered steps + Step 3a, matches the described content), `Team Knowledge/SOPs/INDEX.md` (SOP-015 row present, next-free-slot correctly bumped to SOP-016), `PKM/My Life/Topics/ai-tooling.md` (frontmatter backfilled to GL-002 Topic spec — `name`, `key_element`, `parent_topic`, `lifecycle: exploring`, `promoted_to`, `tags` all present and schema-compliant; the `## External intake` section added, matching the claimed content), the session log itself (exists, matches).
- **Control set checked:** `SOP-015` (current), `SOP-016` (later addition — read to check for cross-references back to the Hermes pilot), `GL-002-frontmatter-conventions` (Topic schema), `GL-008-source-classification-registry`, `GL-011-immutable-source-retention`, `Sources (Immutable)/INDEX.md` (register), `Team/Cairn - Knowledge Intake Specialist/AGENTS.md`, `Team Inbox/` (confirmed only `README.md` — no stray leftover material), `tsk-2026-07-10-001` decisions 19–20 (the authoritative claim record).
- **Blocked tools / unreachable sources this pass:** none for the repo-side control set. The raw Hermes transcript itself is not blocked (confirmed present and complete in the session scratchpad — see the companion content-integrity report), but it is **not preserved anywhere durable** — see Major finding below.

## Findings

### Critical

None.

### Major

| Detail | Evidence | Recommendation |
|---|---|---|
| **The Hermes source's raw evidence still lives only in an ephemeral session scratchpad, not in a durable store, even though `GL-011`/`Sources (Immutable)/` now exists and could retroactively close this.** At the time of the pilot, no immutable-source mechanism existed for general PKM, and Cairn correctly flagged this as an open gap rather than silently treating a citation line as equivalent to raw retention. `GL-011` and `Sources (Immutable)/` landed afterward (decision 20), specifically to close this exact gap — and have since been used for the Wanderloots (T013) source. But nobody has gone back and captured the Hermes transcript into `Sources (Immutable)/` under the now-existing mechanism. If the scratchpad this session is ever cleared, **the raw evidence underlying this entire T009 QA pass (both this report and the companion content-integrity audit) disappears permanently**, and no future reviewer — including the genuinely independent one this task's closure rule requires — will be able to re-check either report's findings against the source. | Compared `Sources (Immutable)/INDEX.md` (one row, for Wanderloots only, no Hermes row) against `GL-011`'s capture rule and the Hermes session log's own explicit flag ("Flagging this to Silas via Larry as a real gap... Worth a real design decision at some point"). GL-011 now exists; the flag was never revisited against it. | Capture the scratchpad Hermes transcript into `Sources (Immutable)/2026/07/` per GL-011 before T009 is treated as closed on any basis — this is squarely inside the evidence-trail requirement the task file itself imposes on every T009/T013 report. Owner: Larry/Silas (GL-011 capture), not Cairn (who already did its job by flagging this at the time). |
| **`ai-tooling.md`'s own cross-reference to "SOP-015 §5" for the entity-rejection test is now stale relative to the live SOP.** At the time Cairn wrote this citation (during the Hermes pilot), "does this earn a note" genuinely was SOP-015 Step 5 (the SOP had 10 steps: ask-why, confirm-complete, read-once, classify, does-this-earn-a-note, evidence-label, backlink-test, file, raw-provenance, log — matching the session log's own "Step 5"/"Step 9" citations exactly). SOP-015 was later amended (when GL-010 landed) to insert a new Step 3a (Knowledge Value Profile/disposition) and a new Step 5 ("identify candidate destination entities"), pushing "does this earn a note" to **Step 6** and raw-source-provenance to **Step 10** in the current live SOP. `SOP-016` (written after this amendment) correctly cites "SOP-015 Step 6." `ai-tooling.md` was never updated and still says "§5." | Read `SOP-015` current numbering directly (Step 6 = does-this-earn-a-note, confirmed by its own heading), cross-checked against `SOP-016`'s explicit "SOP-015 Step 6" citations (correct, current) and the Hermes session log's "Step 5"/"Step 9" citations (correct *for the version that existed at the time*, now stale if read against the live SOP without that context). | Update `ai-tooling.md`'s citation from "(per SOP-015 §5)" to "(per SOP-015 §6)" — a one-line fix, owner Cairn or whoever next edits the note. This is not a defect in the Hermes pilot's own change; it is a downstream consequence of a later, unrelated SOP-015 amendment that nobody circled back to reconcile against dependent notes. Flagging as Major rather than Minor because it is exactly the kind of "stale instruction/reference left behind" this SOP's non-conformance checklist asks about, and because it currently misdirects a reader who checks the note's citation against the live SOP. |

### Minor

| Detail | Evidence | Recommendation |
|---|---|---|
| Cairn's current contract (`Team/Cairn - Knowledge Intake Specialist/AGENTS.md`) Critical rule 0a ("NEVER file before assigning a GL-010 disposition") and Method step 2 did not exist at the time of the Hermes pilot — GL-010 landed afterward (decision 20). Reading today's contract against the Hermes pilot's output, no disposition (Promote/Enrich/etc.) is recorded anywhere for Hermes, unlike the Wanderloots pass's explicit "Surface for Warwick." | Compared Cairn's current contract's Critical rule 0a and `SOP-015` Step 3a against the Hermes session log and `ai-tooling.md`, which contain no disposition vocabulary at all. Timeline confirmed via `tsk-2026-07-10-001` decisions 19 (Hermes, no GL-010 yet) vs. 20 (GL-010 lands) vs. the Wanderloots pass (decision-adjacent, post-GL-010). | No retroactive fix needed — the rule did not exist yet when Hermes ran, so this is not a compliance failure. Worth a one-line retroactive note in `ai-tooling.md` or the session log ("disposition vocabulary post-dates this pass") only if future readers are likely to be confused; otherwise no action. |

### Observations

- `Team Inbox/` contains only its `README.md` — confirmed, matching the session log's claim that no inbox cleanup was needed (the source was handed to Cairn directly).
- No structural damage found in `ai-tooling.md` after the edit: headings sequential, no duplicated blocks, no stranded fragments, no broken tables (there are none).
- The Hermes session log's own frontmatter is complete and correctly formed (`agent_id`, `session_id`, `timestamp`, `type`, `linked_sops`, `linked_workstreams`, `linked_guidelines`) — no session-log hygiene issue.
- No boundary drift: Cairn stayed inside classify → evidence-label → test-backlinks → file → log the whole pass; it did not build or wire an adapter, did not invent an entity type, and did not attempt any self-QA of its own work (the session log explicitly separates "what I did" from any judgment about whether it was done correctly).

### Improvement opportunities

- Since `SOP-015` numbering has now shifted once (and may shift again as more Steps are added), consider whether notes that cite a specific SOP step number (like `ai-tooling.md`'s "§5") should instead cite the step's *name* ("per SOP-015's entity test") rather than its ordinal — this would make such citations resilient to future SOP amendments without requiring a reconciliation sweep every time a step is inserted. This is a suggestion, not a finding; no non-conformance is claimed by leaving it unfixed.

## Source-of-truth conflicts resolved

- `ai-tooling.md`'s "§5" citation vs. `SOP-015`'s live "§6" — resolved in favor of the current `SOP-015` document (per this SOP's own precedence order: raw evidence/current file state wins for facts about what the SOP currently says), with the note's citation flagged stale rather than the SOP treated as wrong.
- No other conflicts found between the control-set documents.

## Verdict

**Pass with remedials.** No Critical findings. Two Major findings (both concrete, both with a named owner and a clear fix) must be actioned — or at minimum explicitly acknowledged and scheduled — before T009 is treated as closed on any basis, per the task file's own closure rule. Neither Major finding invalidates the substance of what Cairn actually did; both are provenance/hygiene gaps that postdate the pilot itself.

## Evidence trail

- **Session log (claimed):** `Team Knowledge/session-logs/2026/07/2026-07-11-04-30_cairn_hermes-transcript-pilot.md` — git path, read in full this pass.
- **Destination note (actual):** `PKM/My Life/Topics/ai-tooling.md` — git path, read in full this pass, current state as of this audit.
- **SOP (actual):** `Team Knowledge/SOPs/SOP-015-cairn-process-external-source.md` (current, 11 steps + 3a) and `Team Knowledge/SOPs/SOP-016-cairn-process-youtube-transcript.md` (current, cites SOP-015 §6 correctly) — both read in full.
- **Register (actual, negative finding):** `Sources (Immutable)/INDEX.md` — one row, for the Wanderloots source only; no Hermes row exists. Confirmed by reading the whole register table.
- **Raw source (Hermes transcript):** no `Sources (Immutable)/` register entry exists. Located and read in full at `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/pilot-hermes-transcript.txt` (session-scratchpad only, not committed, not hashed, not durable — this is itself the Major finding above, not a limitation of this report alone).
- **Task/claim record:** `Team Knowledge/tasks/done/2026/07/tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden.md`, decisions 19 and 20, read directly (not summarized secondhand).
- **Access method:** direct file reads via the local filesystem for every item above; no external/Drive access needed or used this pass.
- **Access limitation:** no content-hash tool available to independently verify any file's integrity this pass (none was needed here since no register hash exists for the Hermes source to check against).
- **Timestamp anchors for material findings:** the Major findings above are timeless structural/register facts (a missing register row; a stale ordinal citation), not time-anchored claims within a transcript — no `[mm:ss]` anchor applies.

## Recommendation

1. **(Major, before T009 can close)** Capture the Hermes transcript into `Sources (Immutable)/2026/07/` per GL-011, with a proper register row, so the evidence this and the companion content-integrity report rely on survives past this session. Owner: Larry/Silas.
2. **(Major, low-effort)** Fix `ai-tooling.md`'s "(per SOP-015 §5)" citation to "§6." Owner: Cairn or the user, whenever the note is next opened.
3. **(Minor, no action required)** No retroactive disposition-tagging needed for the Hermes pass; the rule requiring it postdates the pass.
4. Neither finding blocks a future independent reviewer from doing their job today, but both should be resolved (or explicitly deferred with a reason) before this report's "Pass with remedials" is upgraded to anything stronger by a later independent pass.
