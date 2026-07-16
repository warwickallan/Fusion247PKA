---
build: BUILD-002
component: Ingestion & Storage Foundation
wp: WP0
artifact: Capture Contract Pack v1
status: draft-for-wp0
author: silas
created: 2026-07-16
---

# Capture Contract Pack v1

Related build: [[BUILD-002-unified-personal-capture-gateway]]

The shared, versioned contract family for BUILD-002's two components — the
Capture & Conversation Gateway and the Ingestion & Storage Foundation. It is
**channel-agnostic**: Telegram is the first cockpit, but no field, enum, or
example may assume Telegram. The gateway performs deterministic *technical*
source typing only; semantic meaning and permanent destination remain with
Cairn, Penn, Larry, and existing specialists. This pack must not reintroduce
CategorisAIr-style semantic classification.

Four artifacts are defined: **Capture Envelope**, **Capture Action**,
**Capture Receipt**, plus the shared **Processing State machine** and
**Idempotency & retry** rules.

---

## 1. Capture Envelope v1

The neutral wrapper for any captured item as it enters the intake boundary
(Supabase operational store). It carries *what was captured* and *what the user
asked for* — never a semantic verdict.

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | Contract family version, e.g. `capture-envelope/v1`. |
| `capture_id` | string (uuid) | yes | Server-assigned canonical id for this capture. Stable for its lifetime. |
| `idempotency_key` | string | yes | Dedup key (see §5). One logical capture = one key, even if delivered twice. |
| `source_channel` | enum | yes | Origin cockpit: `telegram` \| `email-inbox` \| `web` \| `api` \| `other`. First cockpit is `telegram`; the field exists so it is never Telegram-only. |
| `sender_identity_ref` | string | yes | Opaque reference to the authorised sender in the identity table (not the raw handle/phone). WP0/WP1 = single authorised user. |
| `recorded_intent` | enum | yes | User-declared high-level intent: `LarryDirect` \| `SaveToBrain` \| `ConfirmedAction`. Recorded, not inferred. |
| `technical_source_type` | enum | yes | Deterministic technical typing only: `text` \| `voice` \| `image` \| `photo` \| `pdf_office` \| `url` \| `email` \| `youtube` \| `unknown`. |
| `raw_payload_ref` | object | yes | Pointer to the raw payload in the operational store (see sub-fields below). Never the semantic content itself. |
| `original_source_ref` | object | cond. | Retention pointer to the untouched original (file/object/message id). Required whenever an original artifact exists (voice/image/pdf/email/etc.); may be null for pure inline text captured verbatim in `raw_payload_ref`. |
| `channel_context` | object | no | Opaque per-channel routing hints needed to edit/reply to the originating card (e.g. card handle). Treated as operational metadata, not knowledge. |
| `text_preview` | string | no | Short human-readable preview for card rendering. Truncated; not authoritative content. |
| `captured_at` | string (RFC3339) | yes | When the user submitted at the cockpit. |
| `received_at` | string (RFC3339) | yes | When intake accepted it server-side. |
| `client_meta` | object | no | Non-authoritative client hints (locale, client version). |

`raw_payload_ref` sub-fields: `store` (e.g. `supabase-storage`), `object_key`,
`content_type`, `bytes` (int, optional), `sha256` (optional integrity digest).

`original_source_ref` sub-fields: `store`, `object_key` or external
`message_ref`, `retained` (bool — must be `true` throughout initial build).

### Synthetic example

```json
{
  "schema_version": "capture-envelope/v1",
  "capture_id": "9f1c2a4e-0000-4d11-a000-abc123synthetic",
  "idempotency_key": "telegram:88012345:msg:40771:sha256:3f9a...",
  "source_channel": "telegram",
  "sender_identity_ref": "identity:usr_wp0_primary",
  "recorded_intent": "SaveToBrain",
  "technical_source_type": "text",
  "raw_payload_ref": {
    "store": "supabase-storage",
    "object_key": "raw/2026/07/16/9f1c2a4e.txt",
    "content_type": "text/plain",
    "bytes": 214,
    "sha256": "3f9a1b7c...synthetic"
  },
  "original_source_ref": {
    "store": "supabase-storage",
    "message_ref": "telegram:chat:88012345:msg:40771",
    "retained": true
  },
  "channel_context": { "card_ref": "telegram:chat:88012345:card:40772" },
  "text_preview": "Reminder: the aquaponics pH buffer note from today's call",
  "captured_at": "2026-07-16T10:15:03Z",
  "received_at": "2026-07-16T10:15:04Z",
  "client_meta": { "client": "tg-gateway/0.1.0", "locale": "en-GB" }
}
```

---

## 2. Capture Action v1

The action the user chose on the actionable card. Channel-neutral: the same
action set renders on any cockpit. An action always references the
`capture_id` it acts on.

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | e.g. `capture-action/v1`. |
| `capture_id` | string (uuid) | yes | The envelope this action targets. |
| `action` | enum | yes | See action set below. |
| `action_id` | string (uuid) | yes | Unique per user click; also a dedup unit (see §5). |
| `params` | object | no | Action-specific parameters (below). |
| `actor_identity_ref` | string | yes | Who invoked it (must match authorised sender for WP0/WP1). |
| `requested_at` | string (RFC3339) | yes | When the user chose the action. |

Action set (channel-neutral):

- `SaveToBrain` — authorise governed preservation + intake. `params`:
  optional `destination_hint` (a *hint* only; final destination is decided by
  Larry/specialists, not the gateway).
- `AskLarry` — LarryDirect discuss/draft; **no durable capture** is created.
- `KeepRaw` — retain the raw/original in the operational store only, no
  promotion to canonical knowledge.
- `Approve` / `Reject` — decision gate for a `ConfirmedAction` (external or
  consequential change). `params.decision_ref` links the pending action.
- `Retry` — re-attempt a failed/partial processing run for the same
  `capture_id`; must not create a second write (see §5).
- `Cancel` — abandon an item still in a non-terminal state; moves it to a
  terminal `cancelled` outcome without side effects.

The gateway records intent and action; it never upgrades `AskLarry`/`KeepRaw`
into a Save, and never fabricates an `Approve`.

---

## 3. Capture Receipt v1

The stateful receipt returned to (and used to edit) the originating card. It is
the single source of truth for what the user is told. Wording must be
**offline-safe**: when the worker is offline the card states the item is safe
and waiting, and NEVER reports false completion.

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | e.g. `capture-receipt/v1`. |
| `capture_id` | string (uuid) | yes | The envelope being reported on. |
| `state` | enum | yes | Current processing state (see §4). |
| `status_line` | string | yes | Human-readable line rendered on the card. Must be truthful for `state`. |
| `is_terminal` | bool | yes | Whether `state` is a final outcome. |
| `destination_ref` | object | cond. | Present once written: canonical destination pointer (e.g. Markdown file/anchor slug). |
| `evidence_ref` | object | cond. | Present once evidenced: pointer to the created evidence (e.g. Git commit / evidence note). |
| `safe_and_waiting` | bool | yes | `true` whenever the item is durably queued but not yet processed (incl. offline). Drives offline-safe wording. |
| `failure` | object | cond. | Present for `failed`/`partial`: `code`, `message`, `retryable` (bool), `partial_completed` (list of completed steps). |
| `clarification` | object | cond. | Present for `needs-clarification`: `question`, `options`. |
| `updated_at` | string (RFC3339) | yes | Receipt revision time. |

Wording rules (normative):

- `offline-queued` / any `safe_and_waiting=true` state → status_line asserts the
  item is **safely accepted and waiting**, e.g. "Saved and waiting — I'll
  process this as soon as the worker is back." Never "Done"/"Completed".
- `completed` → only after `written` AND `evidenced` are both true and their
  pointers are populated.
- `partial` → status_line names what succeeded and what remains; must not claim
  full completion.
- `failed` → honest failure with a `Retry` affordance when `retryable=true`.

---

## 4. Processing states (lifecycle state machine)

States:

- `received` — envelope accepted at intake boundary.
- `accepted` / `queued` — validated, durably enqueued (this is the point at
  which the card may say "safe and waiting").
- `offline-queued` — worker unavailable; durably held. `safe_and_waiting=true`.
- `processing` — a worker is actively handling the item.
- `needs-clarification` — blocked pending a user answer (does not fail).
- `written` — permanent write to the governed canonical destination succeeded.
- `evidenced` — evidence artifact created (e.g. Git commit / evidence note).
- `completed` — terminal success; card edited to "Completed".
- `partial` — some steps done, others outstanding; recoverable via `Retry`.
- `failed` — terminal-until-retry error.
- `cancelled` — terminal; user abandoned before a durable write.

Allowed transitions:

```
received ──► accepted/queued ──► processing ──► written ──► evidenced ──► completed
                    │                 │             │
                    ├──► offline-queued│             │
                    │        ▲   │     │             │
                    │        └───┘ (worker returns)  │
                    │                 │              │
                    │        ┌────────┼──────────────┤
                    ▼        ▼        ▼              ▼
             needs-clarification   partial ◄─────────┘  (partial write/evidence)
                    │                 │
                    │ (user answers)  │ Retry
                    ▼                 ▼
                 processing       processing
                    │
                    ▼
                 failed  ──Retry──► processing

any non-terminal ──Cancel──► cancelled
```

Rules:

- `offline-queued` ↔ `accepted/queued` are equivalent "safe and waiting"
  states; only a live worker moves either into `processing`.
- `completed` is reachable ONLY through `written` → `evidenced`. No shortcut.
- `failed`/`partial` never auto-report completion; they surface honestly.
- `LarryDirect` (`AskLarry`) items and `KeepRaw` items do not traverse
  `written`/`evidenced`; they terminate at their own non-canonical outcome and
  create no durable general-knowledge write.

---

## 5. Idempotency & retry rules

Goal: a retried cockpit delivery (e.g. Telegram re-sends the same update) never
double-writes to the canonical destination.

Idempotency key (design intent; exact construction is a delegated WP0
implementation detail):

- Derived deterministically from **stable channel-native identifiers +
  a content digest**, conceptually:
  `<source_channel>:<channel_native_message_id>:sha256(<normalised_raw_payload>)`.
- Same logical capture, re-delivered → same `idempotency_key` → same
  `capture_id`. It must not depend on wall-clock time or retry count.
- `action_id` provides a second dedup unit at the action layer, so a
  double-tapped "Save to Brain" resolves to one processing run.

Dedup / retry semantics:

1. Intake is **upsert-by-idempotency-key**: a second envelope with a known key
   returns the existing `capture_id` and current receipt — no new row, no new
   raw object beyond the retained original.
2. The permanent write step is **idempotent on `capture_id`**: re-running a
   completed write is a no-op that re-returns the existing `destination_ref`.
3. `Retry` resumes from the last durable state (`failed`/`partial`), never from
   scratch; already-written destinations and already-created evidence are not
   duplicated.
4. Evidence creation is keyed to `capture_id` so retries reuse or supersede,
   not multiply, evidence.

---

## 6. Versioning note

This is **Contract v1**. Per the approved plan it **freezes after the WP0
real-proof passes** (the full Telegram-text → Save to Brain → governed Markdown
write → evidence → card "Completed" flow). Until that gate, fields may still be
refined; after it, v1 is stable and changes go to `v1.1`/`v2` under the same
`schema_version` discipline. `schema_version` is mandatory on every artifact so
consumers can pin.

---

## 7. Deferred to Larry (routine WP0 implementation choices)

The following are explicitly **not** frozen here and are Larry's WP0 calls:

- Exact field encodings / serialisation details (e.g. concrete enum string
  casing, optional-field null vs absent, nested object shapes beyond those
  named above).
- Final `idempotency_key` construction algorithm and payload normalisation.
- Concrete `raw_payload_ref` / `original_source_ref` object-key layout and
  storage bucket naming.
- Test fixtures and the specific synthetic corpus for the acceptance run.
- Card-rendering copy beyond the normative offline-safe wording rules in §3.
