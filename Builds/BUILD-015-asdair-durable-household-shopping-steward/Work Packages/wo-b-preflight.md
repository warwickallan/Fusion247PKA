---
name: WO-B — preflight that proves the live configuration
work_order_id: WO-2026-08-03-DURABILITY-WO-B
build: BUILD-015 durability closeout
wp_number: WO-B
status: issued
authorised_by: Warwick
authorised_date: 2026-08-03
owner: keel
return_to: larry
blocking_dependencies: none
tags: [asdair, build-015, durability, preflight, configuration]
private_surface: none
credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
out_of_scope_policy: report-only
worktree: n/a
branch: n/a — Larry retains git, do not commit
schema_decision: n/a — the grant matrix is READ from committed migrations 005/006/008/009/010 as a decision already made. You are not making a schema decision. If you find the migrations ambiguous or self-contradictory, report it; do not resolve it.
security_inputs: n/a
operational_handoff: none — a change inside an already-released service. Runbooks are WO-K.
runbook_path: n/a
---

# WO-B — preflight that proves the live configuration

## Amendment note

This order supersedes the chat dispatch of 2026-08-03. **Keel refused that version at
read-back and was right to.** Three of its objections were substantive and are fixed here:

- **C2/C3 — the important one.** The original said "every table ... for BOTH roles". Applied
  literally that ships a preflight which **refuses to start a correctly-provisioned
  database**: migration 010 deliberately gives `asdair_rw` no grant on `budget_settings` or
  `product_alternatives`, and `asdair_rw` deliberately lacks UPDATE on `rules` (D-16). The
  deliberate negatives are the point of the matrix. Fixed in AC4 below.
- **M1** — two granted files had no declared path. Paths are now named.
- **M2** — the required secret-scan evidence exits 1 today on `node_modules/pg-connection-string/README.md`,
  before any new code exists. Evidence is now declared as an explicit file list.

Keel's A1–A4 assumptions are all **confirmed** — see "Settled decisions".

## Outcome

`ensure-asdair-runtime.mjs --preflight` must refuse to green-light a runtime whose live
configuration is broken in any of the ways `SHOP-2026-08-03` was broken, so that a shopping
request cannot be consumed into a pipeline that will die at TRANSCRIBING, at a grant, or at
a media path.

Warwick, 2026-08-03: *"A default model name that the gateway does not provide must never
survive preflight again."*

Four of tonight's defects (`DEFECT-LEDGER.md` D-02, D-04, D-05, and half of D-07) would have
been caught by a preflight that checked what it claims to check.

## file_surface

```
services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs
services/asdair/pipeline-runtime/ensure-asdair-runtime.test.mjs   (NEW)
services/asdair/pipeline-runtime/README.md                        (reduce §config to a pointer)
services/asdair/.env.example                                      (NEW)
services/asdair/CONFIGURATION.md                                  (NEW — canonical)
```

Count outside surface must be 0. Explicitly NOT yours: `services/asdair/pipeline/**`,
`browser-runner/**`, `cockpit-api/**`, `db/**`, `services/obsidiwikai/**`.

## Settled decisions (Keel's A1–A4, all confirmed)

- **A1 — confirmed.** The grant matrix is derived by READING migrations 005/006/008/009/010.
  You are not making a schema decision.
- **A2 — confirmed.** Add `ASDAIR_CHROME_EXE` and `ASDAIR_CHROME_PROFILE_DIR` as new
  documented vars with defaults. The profile path currently exists only as a comment in
  `browser-runner/cdp.js`, which is exactly why it is unverifiable today. Document them in
  `CONFIGURATION.md`; Mack owns the real values.
- **A3 — confirmed.** Add `warnings[]` and a per-check severity to `preflight()`'s return.
  You verified nothing outside `ensure-asdair-runtime.mjs` reads that shape — that
  verification is accepted. Keep the existing `checks[]`/`problems[]` keys intact so any
  future consumer is not broken.
- **A4 — confirmed.** `CONFIGURATION.md` becomes canonical; reduce README §"Required
  configuration" to a pointer. SSOT Golden Rule.

## Acceptance criteria

Each check must declare its severity: **BLOCKING** (cannot start) or **ADVISORY** (warn).

- **AC1** — Bot credentials present, never printed. Keep the existing
  `"set (value never read here)"` discipline everywhere. BLOCKING.
- **AC2** — Sender allowlist parses to **at least one valid id**, not merely "is set".
  BLOCKING. (A historical defect had these variable names mismatched — support every alias
  the intake actually reads, and say in `CONFIGURATION.md` which are aliases of which.)
- **AC3** — **Both** DB connections actually connect. A real connection test, read role and
  write role separately — not a string-presence check. BLOCKING.
- **AC4** — **The grant matrix, per-role, per-table, per-privilege, exactly as committed in
  migrations 005/006/008/009/010 — including its deliberate negatives.** Use Postgres's own
  `has_table_privilege(role, table, privilege)`. A role that HAS a privilege the matrix says
  it should not is as much a finding as a missing one. Migration 010 covers only the five
  household/list tables it was written for; every other grant lives in 005/006/008/009 —
  read all five. BLOCKING.
- **AC5** — `ASDAIR_MEDIA_ROOT` set and writable. **ADVISORY only** — Keel's C7 is correct:
  this var is consumed by `cockpit-api`, a separate process with its own env-file pair, so
  the runtime's environment proves nothing about cockpit-api's. Say so in the check's own
  detail text.
- **AC6** — `FUSION_GATEWAY_URL` reachable **and** `FUSION_GATEWAY_KEY` authenticates. An
  unauthenticated GET returning 401 is a real, useful signal. BLOCKING.
- **AC7** — **`FUSION_MODEL_VISION` is present in the gateway's own `/models` response.**
  The one Warwick named. Tonight the default `fusion.vision` did not exist on the gateway
  at all and every photo list died at TRANSCRIBING with a 400. BLOCKING.
  *Note (Keel's C8, accepted):* the defective default lives at
  `services/obsidiwikai/src/core/models.mjs:20`, outside your surface. Catch it; do not fix
  it. Report it.
- **AC8** — Chrome executable exists; dedicated profile directory exists (via the A2 vars).
  If Chrome is not currently running, decide whether that is BLOCKING or ADVISORY, implement
  it, and **document your reasoning in the code comment** — the runner needs a live browser,
  but preflight may legitimately run before Chrome is opened.
- **AC9** — Exactly one runtime (existing single-poller lock check). BLOCKING.
- **AC10** — Dependencies resolve — extend beyond `pg` to whatever else the live path
  requires. Tonight this class hit three separate folders (D-01). BLOCKING.
- **AC11** — The scheduled task's registered command line points at the **current checkout
  path**, not a stale one. ADVISORY.

## Also deliver

`services/asdair/CONFIGURATION.md` — every variable, with: exact name, required/optional,
**which process consumes it**, permitted format, default, whether preflight checks it and at
what severity, what fails without it, whether it is secret, where the real value is
provisioned, how to test it without printing it.

Minimum coverage: `SHOPPER_BOT_TOKEN`; every sender-allowlist alias; `ASDAIR_DB_URL`;
`ASDAIR_WRITE_DB_URL`; `ASDAIR_MEDIA_ROOT`; `FUSION_GATEWAY_URL`; `FUSION_GATEWAY_KEY`;
`FUSION_MODEL_VISION`; `ASDAIR_HOUSEHOLD_ID`; `ASDAIR_CDP_ENDPOINT`; the two new Chrome vars;
runtime-state paths; and cockpit-api's `ASDAIR_COCKPIT_PORT`/`BIND`/`ALLOWED_ORIGIN`.

`services/asdair/.env.example` — matching, with placeholder values only.

**Never print, log or echo a secret value.** The existing "knows env var NAMES only"
discipline is a hard rule.

## Required evidence

- `cd services/asdair/pipeline-runtime && node --test` — baseline is **24/24, exit 0**
  (you measured it). Report before/after counts and assert a non-zero executed count.
- `bash scripts/secret-scan.sh --surface <explicit space-separated list of the exact files
  you wrote>` — the file-list form, which you verified exits 0. **Do not scan the folder**;
  it exits 1 today on `node_modules/pg-connection-string/README.md`, a pre-existing
  condition you correctly refused to accept as your gate.
- Every new check needs a test proving it **FAILS when the condition is genuinely absent** —
  a check that cannot fail is not a check. This is the standing lesson from
  `a-control-is-not-evidence-until-made-to-fail`.

## Known limitations you are expected to state, not solve

AC3, AC4, AC6, AC7, AC8's CDP probe and AC11 cannot be proven by you — they need a live DB,
a live gateway, a live Chrome and a live scheduled task, and your `live_authority` is `none`.
Build them behind **injected clients**, prove the decision logic offline in both directions
(pass and fail), and state plainly in your handback that the wire itself is unproven. That
is an honest limitation, not a failure.

Per C6: redirect all test roots into the session scratchpad. Never execute against the
`C:\.fusion247\**` defaults.
