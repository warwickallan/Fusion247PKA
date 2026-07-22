## Fitness-for-purpose QA

Reviewer: OpenAI Codex, separate runtime from the implementation author.  
Independence level: genuinely independent based on the supplied staged diff.  
Scope limitation: review was limited to the inline curated diff; live wiring and tests not shown were not assumed to pass or fail.

### [BLOCKER] Email intake does not await durable storage

**File:** `services/hub/email/emailToStore.mjs`, ~line 24

**Failure scenario:** `OperationalStore.recordIntake()` is asynchronous, as indicated by the gateway’s existing awaited store calls. `emailToStore()` calls it synchronously:

```js
const { record, isNew } = store.recordIntake(...)
```

If it returns a Promise, destructuring yields `record` and `isNew` as `undefined`. The caller may report success before the write finishes, and a rejection becomes detached/unhandled. The promised durable email intake is therefore not established.

**Fix:** Make `emailToStore` async and await the call:

```js
export async function emailToStore(...) {
  ...
  const { record, isNew } = await store.recordIntake(...);
  return { record, isNew, route };
}
```

Ensure every caller awaits `emailToStore()`.

---

### [BLOCKER] Shopper’s default idempotency keys collide across messages

**File:** `services/hub/shopper/shopperRoute.mjs`, ~lines 26–47

**Failure scenario:** With the default `keyPrefix = 'shop'`, every invocation emits `shop-0`, `shop-1`, etc. A normal second Shopper message therefore collides with the first message’s unique command keys. New shopping items can be rejected or mistaken for earlier intents.

Example:

1. First message, “milk” → `shop-0`.
2. Later message, “bread” → `shop-0`.
3. The unique intent seam rejects or deduplicates “bread”; the item is silently not added.

**Fix:** Derive the prefix from a durable inbound message/update ID, voice/photo reference, or a hash of source identity plus payload. Prefer requiring the caller to provide a source-scoped idempotency key rather than retaining a global default.

---

### [BLOCKER] Shopper accepts `list_date` but ignores it when applying

**Files:**

- `services/hub/shopper/shopperRoute.mjs`, ~lines 26–41
- `services/control-plane/wp-d-proof/asdairCommands.mjs`, ~lines 32–39 and 68–95

**Failure scenario:** The route explicitly puts `list_date` into every intent, but `add_list_item` never reads it. `findOrCreateDraftList()` instead selects any latest `next_week_draft`, or creates one using `current_date + 7`.

Around a week boundary—or when an old draft remains open—an item intended for one list date can be added to a different week’s list. The receipt does not reveal that the requested date was disregarded.

**Fix:** Pass the requested `list_date` into list resolution, validate its format, and select/create by `(household_id, status, list_date)`. Alternatively remove `list_date` from the route contract and make “current next-week draft” the explicit semantics. The current mixed contract is incorrect.

---

### [BLOCKER] Existing YouTube rows manufacture evidence without checking RAW

**Files:**

- `services/hub/router/youtubeProcessor.mjs`, ~lines 35–43
- `services/hub/router/liveDeps.mjs`, ~line 55

**Failure scenario:** `sourceExists()` returns only a boolean. On any existing `youtube_source` row, the processor returns:

```js
content_hash: `existing:${videoId}`
```

That is not the preserved RAW hash and no RAW path or file is verified. A normal retry after a partial historic write, moved/missing RAW directory, or legacy row can pass the evidence gate and reach `completed` despite lacking the evidence claimed by the receipt.

This breaks the central “no false completion” guarantee.

**Fix:** Replace `sourceExists()` with something such as `getExistingSource(videoId)` returning `raw_path` and `raw_sha256`. Before short-circuit completion, require both fields and verify the referenced immutable RAW exists; ideally recompute/compare its hash. Otherwise repair/re-extract or fail without completing.

---

### [BLOCKER] Ambiguous voice cards are not fileable intents

**File:** `services/hub/voice/voiceIntake.mjs`, ~lines 33–37

**Failure scenario:** The returned `card.intent` lacks `idempotency_key`, but `cockpit.decision_card.idempotency_key` is `NOT NULL` and has no default. A normal ambiguous voice memo therefore produces a rendered preview that cannot be inserted into the decision seam.

**Fix:** Add a stable source-derived key, for example:

```js
idempotency_key: `voice-decision:${voice.voice_ref}`
```

Also include `dry_run: true` explicitly if this object is intended to be a complete, ready-to-file intent.

---

### [BLOCKER] Follow-on listing can fail on non-UUID correlation IDs

**File:** `services/control-plane/wp-d-proof/resume-followups.mjs`, ~line 20

**Failure scenario:** The join performs:

```sql
dc.id = f.correlation_id::uuid
```

`correlation_id` is unrestricted text and learning tasks copy it from `learning_candidate`. If an open learning task has a normal non-UUID correlation such as `youtube:abc123`, PostgreSQL can raise `invalid input syntax for type uuid`. The entire resumption queue then becomes unavailable because one row is unlistable.

The accompanying `origin = 'decision_response'` predicate is not a safe cast guard; SQL evaluation order must not be relied upon.

**Fix:** Avoid casting the unrestricted text:

```sql
left join cockpit.decision_card dc
  on dc.id::text = f.correlation_id
 and f.origin = 'decision_response'
```

A stronger schema fix is a nullable UUID `source_card_id` foreign key for decision-origin tasks.

---

### [FOLD-BEFORE-LIVE] Concurrent answers can create duplicate follow-on tasks

**Files:**

- `services/control-plane/wp-d-proof/apply-decision-response.mjs`, ~lines 39–52
- `services/control-plane/db/mypka/140_follow_on_task.sql`, ~lines 25–28

**Failure scenario:** Two legitimate response intents for the same card can be processed concurrently. Both transactions see no matching follow-on and both insert one. There is no uniqueness constraint for `(origin, correlation_id)` when the origin is `decision_response`.

This contradicts the worker comment that deduplication is “by card.”

**Fix:** Add a partial unique index:

```sql
create unique index ...
on cockpit.follow_on_task (correlation_id, origin)
where origin = 'decision_response' and correlation_id is not null;
```

Use `INSERT ... ON CONFLICT ... DO NOTHING RETURNING id`, then select the existing row.

---

### [FOLD-BEFORE-LIVE] Later learning decisions can leave contradictory open work

**File:** `services/control-plane/wp-d-proof/apply-learning-command.mjs`, ~lines 28–51

**Failure scenario:**

1. Candidate is accepted, creating an open follow-on task.
2. A later normal correction declines or defers that candidate.
3. Candidate status changes, but the acceptance task remains open.

Larry’s resumption queue then instructs action on a candidate whose durable decision is now declined/deferred.

**Fix:** Define correction semantics. Either reject decisions once terminal, or when changing away from `accepted`, mark the corresponding open `learning_accept` task as `dropped` in the same transaction. Record the previous and new decision in the receipt.

---

### [FOLD-BEFORE-LIVE] Telegram card rendering does not escape Markdown

**File:** `services/hub/decision/renderCard.mjs`, ~lines 19–27

**Failure scenario:** Subject, body, labels, keys, and `related_ref` are interpolated into Telegram Markdown. Ordinary text containing `_`, `[`, `*`, or unmatched backticks can make a live send fail or render incorrectly. This is plausible in normal first-party notes and titles.

**Fix:** Either:

- escape every dynamic field for the exact Telegram parse mode;
- use plain text; or
- use a structured, properly escaped HTML renderer.

Test common punctuation-heavy subjects and labels against the actual send API.

---

### [FOLD-BEFORE-LIVE] Option keys can break response parsing

**File:** `services/hub/decision/parseChoice.mjs`, ~line 25

**Failure scenario:** An option key is inserted directly into a regular expression. The database and renderer do not restrict keys to A/B/C or escape regex characters. A card with key `(` causes `new RegExp(...)` to throw and the response becomes permanently `failed`.

**Fix:** For this architecture, constrain keys to the intended shape—such as `^[A-Z]$`—during card validation. Otherwise escape regex metacharacters before constructing the expression. Validate unique, non-empty keys and labels at the database or worker boundary.

---

### [FOLD-BEFORE-LIVE] YouTube output discovery can select a stale packet

**File:** `services/hub/router/liveDeps.mjs`, ~lines 38–48

**Failure scenario:** After TubeAIR exits, the code selects the first existing directory whose name contains the video ID. If an older packet remains in `out/spine`, a new run may ingest the stale directory rather than the output created by this execution. `find()` ordering is not a freshness guarantee.

**Fix:** Snapshot the directory set before execution and select the newly created/modified packet afterward, or have TubeAIR return/write the exact output path. Validate that the manifest’s video ID and source URL match the requested capture.

---

### [FOLD-BEFORE-LIVE] Shopper receipt under-reports note-only corrections

**File:** `services/control-plane/wp-d-proof/asdairCommands.mjs`, ~lines 84–91

**Failure scenario:** Repeating an item with the same quantity/status but a corrected note updates the row, while `corrected` remains false and `action` reports `unchanged`. The data changes but the receipt says it did not—an audit-integrity mismatch.

**Fix:** Select the existing note too and include note differences in `corrected`, or avoid issuing the update when all effective fields are unchanged.

---

### [COSMETIC] YouTube completion wording promises work not actually scheduled

**File:** `services/fusion-capture-gateway/src/receiptProjection.js`, ~lines 45–52

The message says the knowledge note “is being written and will appear for review,” while the comments say it is authored later, in-session, with no autonomous runtime. “Transcript preserved; knowledge note pending in-session authoring” would be more truthful.

## Sound seams

The following parts are sound within the reviewed scope:

- Worker claims use a conditional `requested → claimed` update before the apply transaction, preventing two workers from applying the same intent.
- The command route uses a fixed in-process allowlist and fails closed for unknown commands.
- Completed intent rows are protected from subsequent updates by their guards.
- Decision parsing is correlated to the referenced card’s own options and does not guess on no-match.
- Failed Telegram projection after durable completion does not appear to reverse the underlying work.
- The routing writer preserves the plain Markdown path when the feature flag is off or the capture is not YouTube.
- Shopper effects are bounded to draft-list additions/corrections; no checkout, payment, or substitution path appears in the diff.
- Household ambiguity fails closed, and advisory locking serializes draft-list creation per household.

## Verdict

**Not fit for merge as presented.**

The overall architecture is proportionate and appropriate for Warwick’s first-party personal hub; the core intent/worker/receipt and evidence-gated state-machine designs are sensible. However, six normal-use blockers remain:

1. async email persistence is not awaited;
2. Shopper keys collide between messages;
3. Shopper list dates are ignored;
4. existing YouTube rows can falsely satisfy the evidence gate;
5. ambiguous voice cards lack a required idempotency key;
6. one non-UUID correlation can break the entire follow-on queue.

Fix those before merge. The remaining items should be folded in before live cut-over, especially the decision-task uniqueness constraint and Telegram escaping.
