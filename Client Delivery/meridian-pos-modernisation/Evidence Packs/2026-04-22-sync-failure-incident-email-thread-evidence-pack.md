# Evidence Pack — Sync Failure Incident Email Thread (2026-04-22 to 2026-05-06)

> **SYNTHETIC.** Companion pack to a synthetic source, GL-006 schema-validation proof ([[tsk-2026-07-12-002-synthetic-client-delivery-engagement-proof]]).

## Source metadata

- Title: Meridian POS Modernisation — Sync Failure Incident Email Thread
- Capture date: 2026-04-22 (thread runs through 2026-05-06)
- Source tier: 3 (Project evidence)
- Participants: Marcus Webb (client), Priya Shah (internal), Daniel Osei (internal), Elena Vasquez (client)
- Approximate length: 7 messages over 15 days
- Raw file: [[Client Delivery/meridian-pos-modernisation/Sources (Immutable)/2026-04-22-sync-failure-incident-email-thread]]
- Index row: [[Client Delivery/meridian-pos-modernisation/Sources (Immutable)/INDEX]]

## Structured summary

Marcus reported repeated transaction sync failures at the pilot store during lunch-rush peak load. Priya confirmed the defect from terminal logs (no offline queue in firmware v3.1) and arranged a vendor firmware fix (v3.2, adding offline queuing). Daniel authorized the firmware update and a validation week. Priya deployed the fix on 2026-05-02 and reported zero failures over the following two days. Elena then agreed, by email, to extend the pilot's stability window by two weeks to absorb the lost diagnosis-and-fix time before the pilot is called stable.

## Speaker / topic index

| Speaker/topic | Anchor | Covered |
|---|---|---|
| Marcus | 2026-04-22 13:12 | Initial incident report |
| Priya | 2026-04-23 09:40 | Root-cause confirmation from logs |
| Priya | 2026-04-24 16:05 | Proposed firmware fix (v3.2) |
| Daniel | 2026-04-24 17:20 | Authorization to proceed |
| Priya | 2026-05-04 11:00 | Fix deployed, zero failures reported |
| Elena | 2026-05-06 10:15 | Agreement to extend pilot stability window by two weeks |
| Daniel | 2026-05-06 11:02 | Confirmation, commits to keeping client posted |

## Key extracts

- Priya, 2026-04-23: "I can confirm the sync failures are real and are happening exactly when the store's network utilization spikes... This is a demonstrated defect, not a one-off glitch."
- Elena, 2026-05-06: "I'm comfortable agreeing to push the pilot's stability window out by two weeks. Daniel, please make sure the flagship store team and I are kept posted on the revised date."

## Register items produced

| Register item | kind | evidence_type | confidence | reread_flag |
|---|---|---|---|---|
| [[meridian-pos-modernisation-reg-002]] | issue | demonstrated | high | not-required |
| [[meridian-pos-modernisation-reg-003]] | change | agreed-decision | high | not-required |
| [[meridian-pos-modernisation-reg-004]] | decision | agreed-decision | high | not-required |

## Contradictions

None noted in this pass.

## Low-confidence items

None from this source.

## Unresolved items

None from this source — this thread runs to a clean resolution (issue found, fixed, timeline agreed).

## Reread log

_(none yet — first pass only.)_
