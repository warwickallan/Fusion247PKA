# D-delegation-ledger-schema — the delegation ledger's final record schema (T-16)

**Owner:** Silas (Database Architect) — schema and data-integrity decision only, no implementation.
**Consumer:** Keel, under an accepted Work Order for T-16 (`tools/governor/delegation-gate.mjs`).
**Status:** DECIDED. Implement exactly this; if a decision here proves unworkable in practice, stop and
report back to Silas/Larry — do not silently redesign it (same boundary Keel already holds with Silas
on every other schema).

**Inputs read before deciding:** `tools/governor/health-store.mjs` (atomic temp-file+rename primitive),
`tools/governor/programme-state.schema.json` (house style: `additionalProperties:false`, closed `enum`s,
`const` version pins, "absent means unknown, never a default"), `tools/governor/qa-binding.mjs`
(the *other* existing ledger pattern — JSON array + full-document atomic rewrite, keyed/mutable, not
append-only), and the **already-drafted, uncommitted** `tools/governor/delegation-gate.mjs` (git status
`??` — untracked, no test file exists for it, not reviewed, not authorised). That draft is evaluated
below as prior art, not treated as already-decided. `02-MAP.md`'s D-3/T-16 entry, which names
`Team/agent-index.md` as the specialist-match verification source.

---

## 0. Scope boundary — read this first

This decision fixes the **ledger record schema**, the **file format**, the **write/read discipline**,
and the **validation rules**. It does **not** design the algorithm that decides whether a generic
dispatch's domain is actually covered by a named specialist in `Team/agent-index.md` — that is a
free-text/judgement matching problem (compare touched files or task intent against prose routing
criteria), not a schema question, and it is explicitly out of scope here. The schema is built to
**record the outcome** of that judgement, wherever/whenever it gets made, without requiring the
matching algorithm to exist yet. Where this creates a real limit on what v1 can *mechanically* populate,
that limit is stated plainly in §4 rather than papered over.

---

## 1. File format: JSONL, append-only — not a JSON-array ledger

**Decision: keep JSONL** (one JSON object per line), the format the uncommitted draft already uses.
Endorsed after weighing qa-binding.mjs's alternative (a single JSON document `{ schema_version, verdicts: [] }`,
rewritten whole on every write), not defaulted to.

**Why not qa-binding.mjs's JSON-array pattern:**

1. **Different semantics.** qa-binding.mjs's ledger is a *keyed, mutable* table: `recordVerdict` explicitly
   **replaces** a prior row sharing the same `(reviewer, repo, branch, sha)` identity — it stores *latest
   state per key*, which is the right shape for "what did each reviewer say about this exact commit."
   The delegation ledger is the opposite: a pure **append-only event log** where every `direct-call` and
   every checkpoint must be preserved, in order, because the threshold logic replays "how many direct
   calls since the last checkpoint" — deduplication would be a correctness bug here, not a feature.
2. **Write frequency.** qa-binding verdicts are rare (one per reviewer per review round). Delegation
   `direct-call` records are appended on **every** guarded tool call — potentially the majority of a
   session's mutating actions. A single-JSON-array document forces full-document parse+reserialize on
   every one of those; JSONL keeps that cost flat per write and leaves the door open to a future true
   line-append optimisation without a format change.
3. **Fault isolation on read (the decisive reason, tied to §3 below).** A JSON array is *one JSON value*:
   if the tail is truncated or a byte is corrupted, `JSON.parse` fails for the **entire document** and
   every prior, perfectly good entry becomes unrecoverable without a hand-rolled tolerant parser. JSONL
   is independently parseable **per line** — one bad line is quarantined, everything else survives. For
   a discipline-audit log that must never trap the session over its own corruption (see the module's
   INV-2 fail-open posture), "lose one line" is a categorically better failure mode than "lose the whole
   ledger," and it is close to free to get with JSONL.

**Verdict:** JSONL is the right choice for an append-only audit trail; the JSON-array pattern is the
right choice for a keyed/mutable table. Both are correct in this codebase — for different documents.

---

## 2. Write mechanism: full-content atomic rewrite (health-store.mjs's primitive) — NOT a raw OS append

The brief's framing ("no read-modify-write of the whole file needed for a new record") describes what
would be *nice*, not what is *safe here*. Decision: **keep the draft's read-current-content +
append-line-in-memory + atomic temp-file+rename-over-target** — i.e. a full-content rewrite on every
append, reusing `health-store.mjs`'s exact primitive (`${filePath}.tmp-${pid}-${randomHex}` →
`writeFileSync` → `renameSync`). Reject switching to a raw `fs.appendFileSync`/`O_APPEND`-style append.

**Why, given this machine is win32:** POSIX guarantees that a `write()` to a file opened `O_APPEND` is
atomic (the kernel seeks-to-EOF-and-writes as one indivisible operation, so concurrent appenders never
interleave bytes) *for writes within the platform's atomic-write limit*. Windows has no equivalently
strong, uniformly documented guarantee for the analogous `FILE_APPEND_DATA` pattern across all
filesystems/drivers a user's machine might have in the write path (network/synced drives, antivirus
interception, buffering layers) — and this codebase runs on win32 as its primary target. Rename-based
atomicity (`MoveFileExW` with replace-existing, same as POSIX `rename(2)`) is the **one** atomicity
primitive this build already trusts, has already proven (health-store.mjs, qa-binding.mjs), and is
consistently guaranteed same-volume on both platforms. Introducing a second, less-provably-atomic I/O
pattern into a second ledger, on the strength of a single platform's spec, is not a trade worth making
for a discipline gate. "No read-modify-write" is satisfied at the *conceptual* level that matters — a
writer never has to know or touch the *content* of prior records, only append its own new line to
whatever the file currently holds — which is exactly what the existing draft already does.

**Concurrent-write safety — accepted, bounded risk, not "solved":**

- Two processes racing this cycle (both read the same "before" content, both rename, last rename wins)
  produces a **lost update**, never a torn/partial line — the atomic rename guarantees the file on disk
  is always exactly one writer's complete, well-formed output.
- A lost `direct-call` record undercounts, which biases toward **ALLOW** — safe, matches the module's
  own INV-2 fail-open direction.
- A lost **checkpoint** record (`task` or `justify`) is the dangerous direction: the counter fails to
  reset and can accumulate past where it genuinely should have, which — **correcting the existing
  draft's file-header reasoning, which is wrong on this point** — *can* produce a positive,
  successfully-computed over-threshold reading and therefore a wrongful `DENY`. The draft's comment
  ("the fail-direction above already treats 'could not establish a positive over-threshold reading' as
  ALLOW regardless, so even that lost update cannot produce a wrongful DENY") conflates two different
  things: the gate's *error-handling* fail-open path (ledger read/write **throws**) with a *successfully
  read* ledger that is silently missing a checkpoint due to a race (nothing throws; the count is just
  wrong). Keel: fix this comment when touching the file — a wrong safety argument left in place is worse
  than no argument.
- **Accepted as residual risk, not mitigated with locking/CAS.** Likelihood is low (requires two
  PreToolUse hook invocations racing on the *same ticket's* ledger within the write window), and impact
  is bounded and self-correcting: the worst case is one avoidable `DENY`, which is immediately visible
  (it blocks Larry's very next tool call) and carries its own one-line recovery command printed directly
  in the denial message (`buildThresholdDenyMessage` already does this — run `justify`). This matches the
  project's hobby-brain threat bar (correctness/availability, not adversarial hardening) and Larry's own
  standing note that a control nobody can live with gets disabled within a day. **Do not add file
  locking, a CAS retry loop, or a lock file for this** — it is not proportionate to a bounded,
  self-healing, one-command-recovery failure mode.

---

## 3. Checkpoint ordering: trust physical line order, not a re-sort by `ts`

**Decision — a correction to the existing draft:** `countDirectCallsSinceCheckpoint` must **not** sort
records by their `ts` field. It must walk the array **in the order the reader returns it**, which is
required (§5) to be physical line order = append order.

**Why this is firmer than wall-clock time:** every successful write reads the full current content
(which, by construction, already contains everything from every rename that has landed so far) and
appends its own record as the new last line before renaming the whole thing back in. Line order in the
file is therefore a true causal/happens-before ordering of *applied writes to that file* — it does not
depend on trusting any individual process's system clock, and it cannot produce a same-millisecond tie
the way two rapid `Date.toISOString()` calls can. `ts` is retained on every record for human/audit
readability only (e.g. "when did this happen") and is explicitly **not** part of the checkpoint/count
algorithm. A `ts` that appears to run backwards relative to file position (e.g. an NTP clock step
mid-session) is *unusual* (§6) but never invalidates a record and never affects the count.

No `seq`/sequence-number field is added — physical line position already provides a total order for
free; a redundant sequence number would only create a second value that a hand-edited or merged file
could make disagree with position.

---

## 4. `governing_specialist` / `specialist_match` — adopted, refined, and bounded

Nolan's proposed extension is **adopted** for `task` records, with the exact field names and the
`specialist_match` enum as proposed (`declared | no-fit-declared | unchecked`) — it is a well-formed,
already-closed, stable three-way state that matches this build's "absent means unknown, never a default"
discipline precisely: the failure mode being closed (a generic dispatch counted as delegation with no
record of whether coverage was even checked) must never collapse into a missing key — it must always be
the explicit, present value `"unchecked"`.

### 4a. Population — what v1 can prove mechanically, and what it cannot

Two different roster artefacts exist and they do **different jobs**:

- **`.claude/agents/*.md`** — filename stems are the exact set of dispatchable `subagent_type` slugs.
  Cheap, mechanical, exact-match lookup: no markdown-table parsing required.
- **`Team/agent-index.md`** — free-text **domain** descriptions ("routes to them when…"). Judging
  whether a *generic* dispatch's actual work falls inside some named specialist's declared domain
  requires matching task intent/touched files against this prose. That is a judgement call, not a
  mechanical string comparison — it is exactly the kind of check Nolan's audit found *missing*, and a
  gate that fakes having made it (via a brittle heuristic) is worse than one that honestly says
  `"unchecked"`.

**Mechanical population rule for `task` records (what the PreToolUse Task-dispatch observer computes,
every time, no manual annotation channel required of Larry):**

1. Read `.claude/agents/` under the canonical worktree root (same directory resolution `findCanonical`
   already uses elsewhere in this file). Build the slug set from filename stems, lower-cased.
2. Lower-case and trim `subagent_type` from the Task tool's own input.
3. **Exact match** → `governing_specialist = subagent_type` (as dispatched), `specialist_match = "declared"`.
   Dispatching *by name* to a real specialist is self-evidently checked delegation — there is no
   coverage gap to separately record.
4. **No match** (`"general-purpose"`, a typo, anything not in the roster, or the roster directory could
   not be read) → `governing_specialist = null`, `specialist_match = "unchecked"`. **Any failure to read
   the roster must resolve to `"unchecked"`, never to `"declared"`** — an inability to check must never
   read as "checked and it matched," or the mechanism defeats its own purpose.

**`"no-fit-declared"` is reserved in the enum, not machine-populated by v1.** No code path in this
schema decision produces it, because doing so honestly requires the domain-matching judgement described
above, which is explicitly out of scope here (§0). Do **not** invent a parsing convention (e.g. a tag
embedded in the Task `description` field) to fake a channel for it — that adds a fragile, easy-to-forget
manual step that works against "mechanical, not dependent on discipline," which is the entire premise of
this build. If/when a future ticket builds real domain-coverage matching, it can populate
`"no-fit-declared"` without a schema change; that is exactly why the enum reserves the slot now.

### 4b. `justify` records

`governing_specialist` is added, fixed to the single value `"larry"` (a `const`, not a free-form enum —
`justify` is definitionally Larry working directly, so there is nothing else it could ever be).
`specialist_match` does **not** appear on `justify` records at all (not present, not null) — it answers
"was a dispatch target checked against roster coverage," which has no meaning when nothing was
dispatched. `reason` keeps the exact closed enum already implemented and matching the brief verbatim:
`architecture | integration | safety | judgement | git-lifecycle | emergency`.

### 4c. Cross-field rule (encode in the hand-written JS validator, not attempted via JSON-Schema `if/then`)

- `specialist_match: "unchecked"` ⇒ `governing_specialist` **must** be `null`.
- `specialist_match: "declared"` ⇒ `governing_specialist` **must** be a non-empty string equal to
  `subagent_type`.
- `specialist_match: "no-fit-declared"` ⇒ `governing_specialist` **must** be a non-empty string (naming
  who Larry believes *should* have governed this, even though dispatch went generic).

Keep this as explicit JS checks in `validateEntry`-style code (mirroring qa-binding.mjs's own hand-written
cross-field checks, which already go beyond what the shape-only JSON Schema below expresses) rather than
`if/then` composition in the schema file — consistent with this codebase's existing style, where
`programme-state.schema.json` has no `if/then` anywhere either.

---

## 5. The final record schema

Every ledger line is one JSON object matching exactly one of three shapes, discriminated by `kind`.
`additionalProperties: false` per shape — an unrecognised extra key makes the record **invalid** (§6),
never silently accepted, matching `programme-state.schema.json`'s discipline.

**New:** every record now carries `schema_version` (a `const`, incremented only on a breaking change to
this per-line shape). JSONL has no single document header the way `programme-state.json` or
`qa-verdicts.json` do, so the version pin has to travel with every line for a reader to correctly
interpret a file that may span a schema change over a ticket's lifetime. This is a **required field the
current uncommitted draft is missing entirely** — add it.

Save as `tools/governor/delegation-ledger-record.schema.json` (mirrors `programme-state.schema.json`'s
name/location convention; describes the shape of **one line**, applied per-line at read time, not the
file as a whole):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://mypka.local/schemas/governor/delegation-ledger-record/1",
  "title": "BUILD-018 Governor — delegation ledger record (v1)",
  "description": "One line of a per-ticket JSONL delegation ledger at ~/.mypka/governor/delegation/<projectKey>/<ticket>.jsonl (MYPKA_GOVERNOR_DELEGATION_DIR overrides the root). Every record is independently self-describing and independently valid or invalid — a ledger is a sequence of these, one per line, in file-append order (oldest first). A record failing this schema is INVALID: it must be skipped on read, and must never be trusted as a checkpoint or counted as a direct call.",
  "oneOf": [
    { "$ref": "#/$defs/task" },
    { "$ref": "#/$defs/justify" },
    { "$ref": "#/$defs/directCall" }
  ],
  "$defs": {
    "task": {
      "description": "A Task-tool dispatch was observed (mechanism 1 — pure observation, never denies). A checkpoint record: resets the direct-call count for this ticket to zero.",
      "type": "object",
      "additionalProperties": false,
      "required": [
        "schema_version", "ts", "session_id", "ticket", "kind",
        "subagent_type", "description", "governing_specialist", "specialist_match"
      ],
      "properties": {
        "schema_version": { "const": 1 },
        "ts": { "type": "string", "minLength": 1, "description": "ISO 8601. Audit/display only — never used for checkpoint ordering (see decision §3)." },
        "session_id": { "type": ["string", "null"] },
        "ticket": { "type": "string", "minLength": 1 },
        "kind": { "const": "task" },
        "subagent_type": { "type": ["string", "null"] },
        "description": { "type": ["string", "null"] },
        "governing_specialist": {
          "type": ["string", "null"],
          "description": "null iff specialist_match is \"unchecked\"; otherwise the specialist slug (see decision §4c)."
        },
        "specialist_match": {
          "type": "string",
          "enum": ["declared", "no-fit-declared", "unchecked"],
          "description": "declared = subagent_type exactly matches a .claude/agents/*.md slug. no-fit-declared = reserved; not machine-populated in v1 (see decision §4a). unchecked = no match, or the roster could not be read — never defaulted to \"declared\"."
        }
      }
    },
    "justify": {
      "description": "Larry asserted, via the `justify` CLI, that direct work is non-delegable (mechanism 3). A checkpoint record: resets the direct-call count for this ticket to zero.",
      "type": "object",
      "additionalProperties": false,
      "required": ["schema_version", "ts", "session_id", "ticket", "kind", "reason", "note", "governing_specialist"],
      "properties": {
        "schema_version": { "const": 1 },
        "ts": { "type": "string", "minLength": 1 },
        "session_id": { "type": ["string", "null"] },
        "ticket": { "type": "string", "minLength": 1 },
        "kind": { "const": "justify" },
        "reason": {
          "type": "string",
          "enum": ["architecture", "integration", "safety", "judgement", "git-lifecycle", "emergency"]
        },
        "note": { "type": ["string", "null"] },
        "governing_specialist": { "const": "larry" }
      }
    },
    "directCall": {
      "description": "A guarded tool call (Write/Edit/MultiEdit/mutating Bash) was allowed and counted toward the threshold (mechanism 2). Not a checkpoint — never resets the count.",
      "type": "object",
      "additionalProperties": false,
      "required": ["schema_version", "ts", "session_id", "ticket", "kind", "tool_name"],
      "properties": {
        "schema_version": { "const": 1 },
        "ts": { "type": "string", "minLength": 1 },
        "session_id": { "type": ["string", "null"] },
        "ticket": { "type": "string", "minLength": 1 },
        "kind": { "const": "direct-call" },
        "tool_name": { "type": "string", "enum": ["Write", "Edit", "MultiEdit", "Bash"] }
      }
    }
  }
}
```

---

## 6. Validation: invalid vs unusual, and the corrupt-line rule

**INVALID — the line does not exist for any purpose (never a checkpoint, never counted, treated exactly
as if absent from the file):**

- Not valid JSON (`JSON.parse` throws) — truncation, hand-editing, disk corruption, a future writer that
  bypasses the atomic-rewrite discipline.
- Parses to something other than a JSON object (bare string/number/array/`null`).
- `kind` missing or not one of the three closed values.
- Any field required for that specific `kind` (§5) missing or wrong-typed; any enum-constrained field
  (`kind`, `specialist_match`, `reason`, `tool_name`, `schema_version`) holding a value outside its
  closed set.
- An extra key not in that `kind`'s property list (`additionalProperties: false` violation).
- `ts`/`ticket` missing, non-string, or empty.
- A cross-field rule from §4c violated.

**UNUSUAL but valid — kept, trusted, counted normally:**

- `session_id`, `note`, `description` = `null` (legitimately absent content).
- `governing_specialist: null` with `specialist_match: "unchecked"` — this is the **expected**, common
  shape for a generic dispatch and is exactly the visibility this mechanism exists to produce, not an
  error.
- `ts` that appears out of order relative to file position (clock step) — informational only, per §3.

**Read behaviour on a malformed line — a required strengthening over the current draft:** the reader
skips **only** that single line and continues; it never refuses/aborts the whole file (the current
draft already does this much, via a bare `catch {}`). **Required addition:** the read must **surface**
that a skip happened rather than swallow it silently. Return shape:

```
readLedger(ticket, opts) -> { records: ValidRecord[], skipped: { line: number, raw: string, error: string }[], path: string }
```

`records` is ordered oldest-first = physical file order (§3's ordering contract). This is a breaking
interface change from the current draft's bare-array return — acceptable, since the draft is uncommitted
and untested. Reasoning: the gate's own DENY/ALLOW decision does **not** need `skipped` (a skip can only
ever reduce the visible record set, which per §2 already biases the safe direction) — but a human or a
future audit tool asking "why did the gate never fire on ticket X" must be able to tell "genuinely zero
direct calls" apart from "some direct-call lines were silently dropped as corrupt." This is the same
"absent ≠ zero" principle `programme-state.schema.json`'s `unknown[]` collection encodes at the document
level (§4, that schema's own description text), applied here at the line level.

**Migration note:** any ledger files already on disk under `~/.mypka/governor/delegation/**` from manual
testing of the current uncommitted draft predate `schema_version` and the two new fields, and will read
as entirely `skipped` under this schema. Delete them before this ships — there is no real production
history to preserve (no test file exists for `delegation-gate.mjs` yet, and it has never been wired into
`install-hooks.mjs`).

---

## 7. Checklist for Keel — required changes from the current uncommitted draft

1. Add `schema_version: 1` (const) to every record kind.
2. Add `governing_specialist` / `specialist_match` to `task` records; add `governing_specialist: "larry"`
   to `justify` records — per §4's exact population and cross-field rules.
3. Remove the `.sort()`-by-`ts` in `countDirectCallsSinceCheckpoint`; trust reader-returned order (§3).
   Correct the file-header comment about lost-checkpoint risk (§2) while touching this area — it
   currently asserts a wrongful `DENY` "cannot" happen from a lost checkpoint, which is wrong; state the
   corrected, accepted-residual-risk reasoning instead.
4. Change `readLedger`'s return shape to `{ records, skipped, path }` (§6); thread `skipped` through to
   any future audit/report surface, but it does not need to affect `evaluateDelegationGate`'s decision.
5. Add `additionalProperties: false`-equivalent hand-written validation per `kind` (mirroring
   `qa-binding.mjs`'s `validateEntry`) before a record is trusted on read, and before a record is written
   — a record failing validation must never be appended in the first place.
6. Add `tools/governor/delegation-ledger-record.schema.json` (§5) as the documented shape; the hand-written
   JS validator should agree with it exactly.
7. Do not implement any `description`-embedded tag-parsing convention for `specialist_match` — see §4a.
8. Add a test file (`delegation-gate.test.mjs`) — none currently exists for this module, which is itself
   a gap relative to every other file in `tools/governor/`.

Everything else in the current draft (ledger location/keying by canonical-worktree-resolved ticket,
`justify`'s fail-closed-on-ambiguous-programme posture, `observe`/`check`/`justify` CLI shape, INV-2
fail-open posture on gate errors) is sound and is not revisited here.
