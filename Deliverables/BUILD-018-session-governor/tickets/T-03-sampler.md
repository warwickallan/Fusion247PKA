---
name: T-03-sampler
type: work-order
build: BUILD-018
ticket: T-03
ticket_type: implementation
status: resolved
resolved: 2026-07-31
model: Sonnet
private_surface: none
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor
---

# T-03 — Sampler: statusLine script to health sample

## Outcome

Turn one statusLine stdin payload into a written health sample: fast, idempotent,
kill-tolerant, exactly the "SAMPLER writes a health sample on every assistant
message" box in `02-MAP.md`'s architecture diagram (section 1).

## Implementation

`tools/governor/sampler.mjs`:

- `parseStdinPayload(raw)` — pure. Non-string, empty/whitespace-only, unparseable,
  or non-object JSON (array, primitive, `null`) all return `null`. Never throws.
- `extractHealthSample(payload, { sampledAt })` — pure. Maps the fields T-01 proved
  present (`context_window.*`, `rate_limits.*`, `model.id`, `effort.level`, `pr.*`,
  `worktree.*`, `workspace.git_worktree`) onto a flat sample object. Absent fields
  are `null`, never `0`/`false` (AD-3's rule applied to the ephemeral sample, not
  just the durable schema). No `session_id` → `null` (nothing safe to key the store
  on). A real `false` (e.g. `exceeds_200k_tokens`) survives — only genuinely
  undefined fields become `null`.
- `sampleFromStdin(raw, { sampledAt, writer, storeOpts })` — the one impure step,
  still never throws past its own boundary: a throwing `writer` is caught and
  reported as `{ written: false, reason: 'write-failed' }`, never propagated.
  Defaults to T-02's `writeHealthSample`.
- CLI entrypoint (`isMain()` guard via `pathToFileURL`, not string concatenation —
  the naive `file://` + path-replace form breaks on Windows, which needs the extra
  leading slash `pathToFileURL` supplies) — reads stdin to EOF, samples, always
  prints one short line and exits 0. A statusLine command that exits non-zero or
  throws can break the UI that invokes it.

Reuses `tools/capture-statusline.mjs` (T-01) as the proof that stdin-to-file via
temp+rename is safe under a debounced, cancellable statusLine refresh; reuses
`writeHealthSample` (T-02) rather than reimplementing atomic write.

## Acceptance criteria

- [x] Sample written on every assistant message — proven via a real `node
      tools/governor/sampler.mjs` child process piped valid stdin, then reading
      the resulting file back through `readHealthSample`.
- [x] Fast — measured extract+write path (excluding node process startup, a fixed
      host-runtime cost) completes in single-digit milliseconds, well under the
      100ms acceptance shape.
- [x] Idempotent — writing the same session twice just overwrites (health-store's
      own atomic write already guarantees this; nothing here adds accumulation).
- [x] `tools/governor/sampler.test.mjs` — 25/25 passing (`node --test`).

## Mutation tests (map-specified, all passing)

- **Malformed/empty stdin → writes nothing, exits 0, never corrupts the store.**
  Proven against the REAL health store, not a mock: bank one good sample, then
  feed six different garbage payloads (`{ not json`, empty, whitespace, a JSON
  array, `null`, a bare string) in sequence, then prove the original good sample
  is byte-for-byte unchanged (`deepEqual`) and the file on disk still parses as
  one complete document.
- **Real-process CLI**: `node sampler.mjs` invoked as an actual child process with
  malformed and empty stdin both exit 0; with valid stdin it exits 0 and the
  session's file exists with the right content.
- Additional: malformed stdin never even creates a store file for an unrelated
  session id (no partial/empty file left behind).

## Handback

No surprises. The one real bug caught during implementation: the CLI `isMain()`
guard's naive string-concatenation `file://` check silently never matched on
Windows (missing the third slash `file:///C:/...` needs), so the real-process
"valid stdin writes a sample" test failed even though every unit-level test
passed — caught by the **real subprocess** test, not the pure-function tests.
Fixed with `pathToFileURL(process.argv[1]).href`.

Not wired into the primary checkout's `statusLine` setting in this ticket. T-01
required Warwick's explicit per-use authorisation to touch
`C:/Fusion247PKA/.claude/settings.local.json`, under a read-back gate this
dispatch does not carry, and this session's own boundary is "do not audit the
primary checkout." Production activation is deliberately left as a follow-on
step, not silently skipped — recorded as a blocker in `programme-state.json`
(`unknown`/blockers), consistent with the map's own `X-2` finding that a hook
ticket which does not also ship its activation step "ships nothing."
