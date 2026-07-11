# Sources (Immutable) - Register

Rules: [[GL-011-immutable-source-retention]]

Raw payloads live locally under `Sources (Immutable)/YYYY/MM/` and are ignored by Git by default while this repository is public.

| source_id | captured_at | title | category | acquisition_channel | source_locator | hash | local_file | status | duplicate_of | supersedes | superseded_by | destinations | disposition | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-07-11-wanderloots-llm-wiki-transcript | 2026-07-11 | "the LLM Wiki" — Wanderloots (Callum) | Video/Audio Transcript | Direct Google Drive fetch (Drive ID `1Rr0dxWpyLE6xh-OhRMBJ7RN0mYUpqslMeJJAwIKiozY`) + user upload, manually captured by Larry — no TubeAIR adapter exists yet | `https://www.youtube.com/watch?v=QbjAQFJJyt0` (per the transcript's own embedded links) | sha256:`bdf3217e2e8b4e7c7c31ab3e0ad348db1ce30570f17ed24375f94d83d2f56a16` | `2026/07/2026-07-11-wanderloots-llm-wiki-transcript.txt` | active | — | — | — | none (no PKM note created or edited) | Surface for Warwick | tsk-2026-07-11-001 T013 pilot second-source — Cairn intake complete, see `Deliverables/2026-07-11-08-00-t013-wanderloots-intake-disposition.md`. Classified Video/Audio Transcript (GL-008); judged redundant with myPKA's own already-implemented raw/wiki/schema architecture, so no enrichment of `ai-tooling.md`; four tactical patterns (local-model draft/review/approve loop, vault-write firewall, scheduled heartbeat automation, web-clipper-style raw capture) surfaced for Warwick instead. Raw payload contains a large verbatim-repeated `[14:00]-[18:45]` block (~15x), flagged as an acquisition-side data-quality issue, not a content gap — transcript is otherwise complete. Awaiting independent (non-Cairn) review before T013 can close. |
