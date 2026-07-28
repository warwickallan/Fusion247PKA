# asdair/transcribe — the photographed list, read once

A photographed handwritten shopping list is AsdAIr's real front door. This module is the step that
turns that photo into a structured transcript the rest of the pipeline can use.

**It is a ONE-SHOT MODEL CALL.** One image in, one transcript out, process exits. There is no daemon,
no queue, no scheduler, no watcher, no long-running or persistent LLM agent anywhere in this folder —
by design, and that is a contract, not an implementation detail. It also touches **no database**.

| Module | What it is |
|---|---|
| `transcribeList.js` | The library. Validates the image, makes the single `vision` call, and defensively normalises the answer into a transcript. The model layer is **injectable**, so the whole thing tests offline against a fake. |
| `transcribe-list.js` | **The runtime caller.** `node --env-file=<env> transcribe-list.js --image <path> [--json] [--dry-run]` |

## How to run it

```
node --env-file=<env> transcribe-list.js --image list.jpg            # human-readable table
node --env-file=<env> transcribe-list.js --image list.jpg --json     # the transcript object
node                  transcribe-list.js --image list.jpg --dry-run  # validate only, NO model call
```

`--dry-run` checks the file exists, is a supported type (`.jpg .jpeg .png .webp .gif`) and is within the
20 MB limit, reports whether a gateway is configured, and stops. It makes no model call and opens no
connection.

Environment — **by variable NAME only; this code never reads, prints or logs a credential value**:

| Var | Purpose |
|---|---|
| `FUSION_GATEWAY_URL` | The gateway every household image is sent to. **No default, no hardcoded endpoint.** |
| `FUSION_GATEWAY_KEY` | Optional bearer. Consumed inside `models.mjs` only; never enters a transcript, an error or a log. |
| `FUSION_MODEL_VISION` | Optional role-alias override (default `fusion.vision`). |

## Where household images go

Only to a gateway **you explicitly configured by env var**. There is no hardcoded endpoint, no
fallback provider and no default host anywhere in this module. With `FUSION_GATEWAY_URL` unset, a
vision call **fails loudly**:

```
fusion-gateway: no vision-capable gateway configured (set FUSION_GATEWAY_URL).
Refusing to fall back to a text-only model for an image task.
```

That refusal is deliberate. The shared gateway's text roles fall back to the box (LightRAG), which is
**blind** — falling back would hand a text model a prompt about a photo it cannot see and invite it to
invent a shopping list. A household list is exactly the wrong place for that. No gateway means no
transcript, never a guessed one.

## The transcript

```js
{
  lines: [
    { raw: '2 milk', item_name: 'milk', requested_qty: 2,    uncertain: false, uncertainty_reason: null },
    { raw: 'bread',  item_name: 'bread', requested_qty: null, uncertain: false, uncertainty_reason: null },
    { raw: 'milk ?', item_name: 'milk',  requested_qty: null, uncertain: true,  uncertainty_reason: 'digit smudged, could be 2 or 3' }
  ],
  raw_transcript: '2 milk\nbread\nmilk ?',
  needs_review: true,
  provenance: { provider: 'fusion-gateway', model: 'fusion.vision' }
}
```

**An unreadable or ambiguous quantity is NEVER guessed as a fact.** It comes back
`requested_qty: null, uncertain: true` with a reason, and that line goes to the human question loop —
which is the entire point of this module. `needs_review` is true if any line is uncertain.

The guard is two-sided: the prompt instructs the model never to guess, **and** `transcribeList.js`
re-checks every value it gets back. A quantity is only accepted as a fact when it is unambiguously a
positive whole number within household range; `"two"`, `"?"`, `"2 or 3"`, `1.5`, `0`, `-2` and
`1e21` all become `null` + `uncertain` with a reason, whatever the model claimed. A quantity attached
to a line the model itself flagged uncertain is discarded too. No line is ever silently dropped.

`requested_qty: null` with `uncertain: false` means something different and safe: **no quantity was
written at all**. The deterministic normaliser applies its own default (1) to those, as it always has.

`provenance` records which provider and which role alias produced the transcript so it can be traced
later. `fusion.vision` is a *role name the gateway resolves*, not a secret — no key, URL, header or
credential of any kind enters the transcript.

## Downstream stays deterministic

This is the **only** probabilistic step. `../skill/listNormaliser.js` (pure: no DB, network, fs, clock
or randomness) and the planner behind it are **unchanged and unchanged-able by this module** — it does
not import, wrap or patch them. The handoff is plain list text:

```js
normaliseRawList(certainLinesText(transcript))   // the normaliser, exactly as it already ships
```

`certainLinesText()` returns the certain lines' `raw` values, newline-joined — precisely the input
`normaliseRawList` already takes. **Uncertain lines are deliberately held back**: they belong to the
human question loop first and only rejoin the list once a person has answered. The normaliser remains
authoritative for quantity parsing; the transcript's `requested_qty` is the vision model's reading,
used to decide what to ask a human about.

## Tests

```
node --test          # 36 tests, fully offline
```

Every model call in the suite goes to an injected fake; the CLI tests point at an unroutable address
so any accidental network call would fail the run. Covered: clean transcription; unreadable quantity →
`null` + `uncertain` + `needs_review`; malformed and structurally-wrong model JSON recovered via the
retry path rather than crashing; provenance recorded; no credential value can reach the transcript,
stdout or stderr; `--dry-run` makes no call; and the `vision` role failing safely with no gateway
while the existing text roles stay byte-identical on the wire.

## The one dependency worth knowing about

`transcribeList.js` reuses `extractJson` from `services/obsidiwikai/src/core/llm.mjs` — the same tested
fence-stripping/trailing-junk parser `generateJSON()` uses — and applies the same
retry-with-stricter-suffix policy. It cannot call `generateJSON()` itself because that function is
hard-wired to the `reason` (text) role; routing an image task through it would send a blind model a
prompt about a photo. Same parse behaviour, correct role.
