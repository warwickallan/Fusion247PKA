---
build: BUILD-002
wp: WP0
artifact: wp0-security-gate-execution
author: vex
status: re-executed-round-2-pass-with-conditions
created: 2026-07-16
---

# WP0 Security Gate — Execution Report (2026-07-16)

Execution of the gate defined in [[wp0-security-gate]] against the implemented
fixtures baseline of [[BUILD-002-unified-personal-capture-gateway]], component
`services/fusion-capture-gateway/`. Method: [[SOP-004-vex-security-audit]].
Auditor: **Vex**. This is a live audit — evidence is grep output, test runs, and
a throwaway traversal probe, not a re-statement of the checklist.

---

## VERDICT: FAIL (RED — no override)

The **substantive security controls that exist are sound and were proven** (see
per-section evidence): single-user default-deny, traversal-proof scoped write,
evidence-gated completion with no false-completion, idempotent single-write
recovery, RLS enabled deny-by-default on every table, and a clean secret tree.
**Zero CRITICAL findings. No committed secret. No broken control.**

The gate nonetheless **cannot PASS** because three gate-mandated requirements are
absent from the baseline, and one of them is a §7 RED-no-override trigger:

1. **No `SECURITY.md` for the component** — [[wp0-security-gate]] §7 lists "a
   missing `SECURITY.md` for the component" explicitly in the RED / no-override
   set. A `SECURITY.md` exists for `Expansions/mypka-cockpit` but **not** for
   `services/fusion-capture-gateway`. This alone forces RED.
2. **Secret-scanning not wired** — §2 checkbox and the §6 exact pass-condition
   both require "secret-scanning live" (pre-commit and/or CI gitleaks-class). No
   hook or CI scanner exists in the component. §6 hard-stop unmet.
3. **No deletion / erasure path** — §4 and the §6 pass-condition require "a
   working deletion path" across both stores before real personal data. None
   exists. §6 hard-stop unmet.

Per the gate, YELLOW "never covers a §6 hard-stop," so these cannot be waived as
conditions — they are blockers. This is a **FAIL of required artifacts/controls,
not a vulnerability in what was built.** All three are non-exploit, quickly
remediable, and none require weakening any existing control.

**Severity counts:** CRITICAL 0 · HIGH 3 · MEDIUM 3 · LOW 2 · INFO 4.

---

## Findings

| ID | Severity | Location (file:line) | Finding | Recommended fix |
|----|----------|----------------------|---------|-----------------|
| F-01 | HIGH | `services/fusion-capture-gateway/` (absent) | No `SECURITY.md` for the component. §7 RED-no-override trigger. | Add `services/fusion-capture-gateway/SECURITY.md`: threat model, secret homes + masking, rotation runbook (bot token + Supabase keys), sender-allowlist policy, deletion/erasure procedure, reporting contact. Owner: component team; Vex reviews. |
| F-02 | HIGH | repo-wide (no hook / no CI) | Secret-scanning not wired. §2 + §6 hard-stop "secret-scanning live" unmet. Current tree is clean, so present exposure is nil, but nothing blocks a future token commit. | Wire a gitleaks/trufflehog pre-commit hook and a CI job that fails the build on token-shaped strings, before any real secret is introduced. |
| F-03 | HIGH | `migrations/0001_wp0_operational_baseline.sql`; `src/` (no delete op) | No deletion/erasure path for a captured item + raw object across Supabase row(s), storage object, and Markdown. §4 + §6 hard-stop unmet. | Implement a deletion path (row + storage object + Markdown note) with a documented backup/shadow-copy answer, and a test, before real personal data flows. Silas owns schema/RLS delete policy; Vex proposes policy text. |
| F-04 | MEDIUM | `src/adapters/telegramAdapter.js`; `src/intake.js` | No rate-limit / flood-control (§5 checkbox). N/A in fixtures (no network), but a burst path exists once real Telegram is wired. | Add bounded inbound handling (per-sender token bucket) at the adapter/intake seam before live wiring. |
| F-05 | MEDIUM | `src/worker.js:87-96`; `telegramAdapter.js:104` | Access logging is thin: rejections and post-complete card-edit failures are logged, but the successful capture-write / raw-object-read privileged ops are not logged who/what/when (§4). | Add structured, secret-free access logs for capture write and raw-object read before real data. |
| F-06 | MEDIUM | `src/config.js` (rotation undocumented) | Rotation posture (§2) is asserted by design (no hardcoded values) but not documented/tested. | Document + test the rotation runbook in F-01's `SECURITY.md`. |
| F-07 | LOW | `migrations/0001_wp0_operational_baseline.sql:196-213` | RLS is enabled deny-by-default with **no policies** — correct for now, but the restrictive single-authorised-user policy set is still to be authored. | Author restrictive policies (service_role server-side only; single authorised principal) as part of the pre-real-data step; keep deny-by-default until then. |
| F-08 | LOW | `src/receiptProjection.js:60-63`; `telegramAdapter.js:120` | `new Date(now).toISOString()` / injected-now everywhere is good; but retention/privacy-class tagging (§4) on raw objects is schema-present (`retained`) yet not enforced in code. | Enforce retention-class on raw-object creation when the storage path is implemented. |
| F-09 | INFO | `src/worker.js` (in-process pull) | "Worker trusts only the gateway" (§1) — worker pulls from the store in-process; there is no open local port today, so trivially satisfied. Re-audit when a real transport is introduced. | Re-check at transport wiring. |
| F-10 | INFO | `telegramAdapter.js` (no webhook) | Webhook/poll authenticity (§1) N/A in fixtures (no network, no webhook). | Verify secret-path token / `X-Telegram-Bot-Api-Secret-Token` at real wiring. |
| F-11 | INFO | `src/markdownWriter.js:7` | Writes land in a throwaway sandbox `inbox/`, not the canonical Brain — correct fixtures posture. | Governed PKM write is Silas/PKM territory at promotion. |
| F-12 | INFO | `migrations/...sql:50` | `technical_source_type` enum includes non-text types but WP0 handles text only; health data is not modelled — §3 health-exclusion honoured. | Keep health data out until a separate authority decision. |

---

## Evidence by gate section

### §0 Baseline liveness
`cd services/fusion-capture-gateway && node --test` → **57 tests pass, 0 fail**
(`# pass 57 / # fail 0`). Zero runtime deps (`package.json`), Node >=22, ESM.

### §1 Identity & single-user default-deny — GREEN
- Allowlist compares a **numeric** sender id, not a username:
  `telegramAdapter.js:99` derives `senderId = String(from.id)`; `:103-106`
  rejects `senderId === undefined || senderId !== authorised` with
  `reason:'unauthorised_sender'` and **logs** `{sender_id, at_ms, reason}` into
  `rejections[]` — logged, never actioned. Default is **deny**: the guard rejects
  unless the id matches exactly.
- Constructor **requires** an authorised id: `telegramAdapter.js:72-74` throws if
  `authorisedUserId` is absent (no accidental allow-all).
- **No self-enrolment**: no `/start`, invite, or runtime add-user path exists in
  the adapter or intake. Adding a user is a config change (`AUTHORISED_TELEGRAM_USER_ID`).
- **Fail-closed** at intake: `intake.js:42-45` returns `{ok:false}` on any
  `!mapped.ok` (unauthorised or malformed) — no durable row, no card, no reply.

### §2 Secret handling & credential hygiene — clean tree, but §6 scanner unmet (F-02)
- Secret-shaped scan of tracked files
  (`git grep -nE 'service_role|sk-|sk_live_|pk_live_|Bearer |AIza…|xox[baprs]-|ghp_|-----BEGIN|[0-9]{6,}:AA…|eyJ…'`)
  returned **only documentation/name references** — `.env.example:12`,
  `migrations/…sql:25,201`, `config.js:11` — **no values**. Telegram-token
  pattern `[0-9]{6,}:AA` → **no matches**.
- `.env` is **not tracked**; only `.env.example` is (`git ls-files` →
  `.env.example` only). `.gitignore:1-4` ignores `.env` / `.env.*` and
  un-ignores `!.env.example`.
- `.env.example` carries **key names with empty values only** (lines 11-28).
- `service_role` / bot token are **never on a client/bot surface**: `config.js`
  reads env **by name** (`CONFIG_KEYS`), marks `SECRET_KEYS`
  (`SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`), and `describe()`
  (`config.js:101-112`) + `maskSecret()` (`:47-50`) emit `***set (masked)***` /
  `(unset)` — never the value. The adapter (bot-facing surface) never reads a
  secret. Fixtures mode is the absence of these secrets (`fixturesMode`).
- **Gap (F-02):** no pre-commit/CI secret scanner is wired — §6 names
  "secret-scanning live" as a hard-stop.

### §3 Authorization boundaries — GREEN (write path proven traversal-proof)
- **Traversal probe (throwaway, run then deleted).** Fed the writer malicious
  `capture_id`s: `../../../../../../tmp/EVIL_ESCAPE`, `/etc/passwd`,
  `foo/../../bar`, `a/../../etc/x`. **All were flattened** by `safeSegment`
  (`markdownWriter.js:23-25`, `[^a-zA-Z0-9_-]→_`) and landed **inside** the
  sandbox inbox (`inside sandbox: true` for every case); `/tmp/EVIL_ESCAPE` was
  **not** created (`EVIL_ESCAPE leaked to /tmp? false`). Second layer:
  `markdownWriter.js:88-91` resolves the path and throws unless it
  `startsWith(resolve(inboxDir)+sep)`. Defense in depth confirmed.
- **Confirmed Actions are inert**: `Approve`/`Reject` map only to the
  `recorded_intent` enum value `ConfirmedAction` (`telegramAdapter.js:23-35`);
  there is **no** actuation code path — the gateway records intent + typing and
  never executes an external/consequential action. No mail/post/delete/spend
  code exists.
- **Store separation**: `operationalStore.js:8-13` is operational-only; the only
  promotion to canonical is the governed worker write (`worker.js:64`).

### §4 Data protection — RLS deny-by-default GREEN; deletion path missing (F-03)
- Migration **enables RLS on every table**
  (`0001_…sql:205-210`: `channel_identity, raw_object, capture_envelope,
  idempotency_key, processing_state, evidence_pointer`) with **no permissive
  policies** (`:212-213`) → non-service roles default-**deny**. Header comment
  `:22-29,196-203` marks it a security gate "DO NOT WEAKEN".
- Least privilege / minimisation: raw bucket is `fcg-raw-private` (`:103`),
  `retained` defaults true, evidence rows hold **pointers** not content.
- **Gap (F-03):** no deletion/erasure path across stores — §6 hard-stop unmet.
  Retention-class enforcement (F-08) and access logging (F-05) also deferred.

### §5 Abuse / failure safety — idempotency & no-false-completion GREEN
- **Single-write recovery proven**: `test/recovery.test.js` — worker A writes
  the file then "crashes" before committing; lease expires; worker B reclaims
  and completes. Asserts `markdownWriter.writeCount() === 1` "no duplicate write
  on resume" (`:62`) and exactly **one** note file on disk (`:64-66`). The
  writer's idempotent branch (`markdownWriter.js:95-106`, `existed:true`,
  no rewrite) is what makes it hold. Store dedup: upsert-by-idempotency-key
  (`operationalStore.js:111-115`), unique constraint mirrored in SQL (`:152-156`).
- **No false completion**: `complete()` is gated on `state===EVIDENCED` **and**
  both destination + evidence pointers present (`operationalStore.js:253-269`);
  `completed` is reachable only `written→evidenced→completed`
  (`states.js:70-83`). `projectCard` sets `is_completed` **only** when state is
  exactly `completed` (`receiptProjection.js:111-119`).
- **Offline queue is safe**: `test/offline.test.js` — intake while worker down →
  `offline_queued`, `safe_and_waiting:true`, `is_completed:false` (`:39-43`);
  durable at the commit point (`intake.js:56`), never claims "saved to Brain"
  until the real write lands. A failed card edit is swallowed and does **not**
  reverse/duplicate the write (`worker.js:81-97`, `telegramAdapter.js:154-160`).
- **Untrusted inbound handled inertly**: message text is kept as data
  (`telegramAdapter.js:110`), never interpolated into a path/command/query.
  `git grep` for `eval(|child_process|execSync|exec(|new Function|require(` in
  `src` → **none**. Envelope is validated (`contracts.js:validateEnvelope`) and
  the file path is derived from the server-assigned `capture_id`, not raw text.
- **Gap:** rate-limit/flood-control not implemented (F-04) — no §6 hard-stop, but
  needed before live wiring.

### §6/§7 Fixtures-until-gate — honoured
- Nothing real is wired: no network calls anywhere, `fixturesMode` true when
  secrets absent (`config.js:79`), sandbox writer targets `os.tmpdir()` in tests,
  adapter/store are in-memory mocks. README §Hard boundary reaffirms it.

---

## Exact condition(s) that unlock real-secret provisioning + the live proof

Real secrets and the live phone-visible acceptance proof are authorised **only
after** ALL of the following, then Vex re-signs:

1. **F-01** — `services/fusion-capture-gateway/SECURITY.md` added (threat model,
   secret homes + masking, rotation runbook, sender-allowlist policy,
   deletion/erasure procedure, reporting contact). *(clears the §7 RED trigger)*
2. **F-02** — secret-scanning **live**: gitleaks-class pre-commit hook and/or CI
   job that blocks token-shaped strings. *(clears the §6 "secret-scanning live"
   hard-stop)*
3. **F-03** — a **working, tested deletion path** for a captured item + its raw
   object across Supabase row(s) + storage object + Markdown, with a documented
   backup/shadow-copy answer. *(clears the §6 "working deletion path" hard-stop)*

On those three landing (and re-run of this gate confirming §1–§5 remain GREEN
with the traversal probe and single-write recovery still passing), the gate flips
to PASS and Vex signs off. The already-GREEN hard-stops — sender allowlist +
default-deny (proven), zero committed secrets + `.gitignore` (proven),
`service_role` isolated to the worker with RLS deny-by-default on every table
(proven), and a traversal-proof scoped write path (proven) — do not need rework.

*No fixes were applied by Vex. Silas/Mack own remediation; Larry routes. The
traversal probe was run in `os.tmpdir()` and deleted; no files under `services/`
were modified.*

---
---

## Re-execution — round 2 (2026-07-16)

Round-1 (above) is retained as history. This section re-executes the gate against
the **fixed baseline** after Silas/Mack remediated F-02 and F-03 and Vex authored
the F-01 `SECURITY.md`. Method unchanged: [[SOP-004-vex-security-audit]] against
[[wp0-security-gate]]. This is a **live re-run** — every claim below is backed by a
command re-executed now, not a re-statement of round 1.

### VERDICT: PASS-WITH-CONDITIONS (fixtures baseline safe to merge)

All three round-1 blockers are **resolved with evidence**. The §7 RED trigger
(missing component `SECURITY.md`) is cleared, and both §6 hard-stops
(secret-scanning live; working deletion path) are now satisfied. §1–§5 controls
re-verified GREEN, including a fresh traversal probe and the single-write recovery
and erasure tests. **Zero CRITICAL, zero open HIGH. No committed secret.**

The **fixtures baseline is safe to merge now** — nothing open blocks it. The
remaining items are **pre-live-wiring hardening conditions** (MEDIUM/LOW/INFO) that
gate only the transition to **real secrets + the live phone-visible proof**, not the
fixtures merge. They are carried explicitly into
`services/fusion-capture-gateway/SECURITY.md §7`.

**Updated severity counts:** CRITICAL 0 · HIGH 0 (was 3) · MEDIUM 3 · LOW 2 · INFO 4.
(F-06 also resolved: rotation runbook is now documented in `SECURITY.md §3`.)

### Per-finding status (round 2)

| ID | R1 sev | R2 status | Evidence (file:line) |
|----|--------|-----------|----------------------|
| F-01 | HIGH | **RESOLVED** | `services/fusion-capture-gateway/SECURITY.md` now exists (195 lines): threat model §1, secret homes + `config.describe()` masking §2, rotation runbook §3, sender-allowlist §4, erasure procedure §5, secret-scanning §6, pre-live-wiring conditions §7, security contact placeholder. Clears the §7 RED-no-override trigger. |
| F-02 | HIGH | **RESOLVED** | `scripts/secret-scan.sh` (zero-dep VALUE-pattern scan, excludes `.env.example`/`*.md`/itself) → **clean, exit 0, 308 tracked files**; enforced by `.github/workflows/secret-scan.yml:7-22` (`on: push,pull_request`, least-privilege `permissions: contents: read`, runs the scanner); local mirror `.githooks/pre-commit:20-23`; `package.json:12` `scan` script. Clears the §6 "secret-scanning live" hard-stop. |
| F-03 | HIGH | **RESOLVED** | Deletion path across all three homes: `src/store/operationalStore.js:291-302` `deleteCapture` (hard-delete + frees idempotency key); `migrations/0002_wp0_deletion_and_retention.sql:45-72` (FK cascades for state/evidence/idempotency; raw_object set-null for worker GC) + true-erasure/backup-purge note `:89-102`; `src/markdownWriter.js:139-159` `remove()` (sandbox-confined, refuses foreign pointer); `src/erasure.js:43-84` `erase()` orchestrator (idempotent). Tests `test/deletion.test.js` + `test/erasure.test.js` prove note file gone + record gone + key freed + re-capturable + double-erase safe. Clears the §6 "working deletion path" hard-stop. |
| F-06 | MEDIUM | **RESOLVED** | Rotation runbook documented + tied to no-hardcoded-values posture in `SECURITY.md §3` (bot token, `service_role`, anon key). |
| F-04 | MEDIUM | **CONDITION (pre-live-wiring)** | Per-sender rate-limit / flood control still not implemented (`src/adapters/telegramAdapter.js`, `src/intake.js`). No §6 hard-stop; required before live wiring. Carried to `SECURITY.md §7`. |
| F-05 | MEDIUM | **CONDITION (pre-live-wiring)** | Structured secret-free access logging of capture-write / raw-object-read not yet added (`src/worker.js`, `telegramAdapter.js`). Required before real data. Carried to `SECURITY.md §7`. |
| F-07 | LOW | **CONDITION (pre-live-wiring)** | Restrictive RLS policy set (service_role server-side only + single authorised principal) still to be authored on top of deny-by-default. 0002 explicitly does NOT relax RLS (`:24-28`). Carried to `SECURITY.md §7`. |
| F-08 | LOW | **CONDITION (pre-live-wiring)** | Retention-class enforcement on raw-object creation still code-deferred. Carried to `SECURITY.md §7`. |
| F-09 | INFO | **VERIFY AT WIRING** | Worker pulls in-process; re-audit trust boundary at real transport. `SECURITY.md §7`. |
| F-10 | INFO | **VERIFY AT WIRING** | Webhook/poll authenticity (secret-path token) to verify at real Telegram wiring. `SECURITY.md §7`. |
| F-11/F-12 | INFO | unchanged | Sandbox `inbox/` write posture correct; health data hard-excluded. |

### Evidence re-gathered (round 2)

- **§0 liveness — GREEN.** `cd services/fusion-capture-gateway && node --test` →
  **`# tests 65 / # pass 65 / # fail 0`** (was 57; +8 deletion/erasure tests). Zero
  runtime deps, Node >=22, ESM.
- **§1 identity & default-deny — GREEN (unchanged).** Numeric sender allowlist,
  constructor requires an authorised id, no self-enrolment, fail-closed intake — all
  re-confirmed in source; no regression from the deletion work.
- **§2 secret hygiene — GREEN.** Scanner clean (exit 0, 308 files); `config.js:47-50`
  `maskSecret()` + `:101-112` `describe()` emit `***set (masked)***` / `(unset)`,
  never a value. F-02 scanner now live (see table).
- **§3 authorization / scoped write — GREEN.** **Fresh throwaway traversal probe
  re-run now** against `markdownWriter`: ids `../../../../../../tmp/EVIL_ESCAPE`,
  `/etc/passwd`, `foo/../../bar`, `a/../../etc/x` all flattened by `safeSegment`
  (`markdownWriter.js:23-25`) and landed **inside** the sandbox
  (`inside sandbox: true` for every case); `/tmp/EVIL_ESCAPE` **not** created. The new
  `remove()` path was probed too: it **refused** a foreign `/etc/passwd` pointer
  (`markdownWriter.js:150-152`), left `/etc/passwd` untouched, and deleted a real
  in-sandbox note idempotently. Probe run in `os.tmpdir()` and **deleted**.
- **§4 data protection — GREEN (deletion path now present).** RLS enabled
  deny-by-default on every table (0001); 0002 adds cascades + true-erasure/backup-purge
  note and explicitly does not weaken RLS. Erasure test confirms the note file is
  removed, the operational record is removed, and the idempotency key is freed so the
  same key is re-accepted as `isNew:true`.
- **§5 abuse/failure safety — GREEN (unchanged).** Single-write recovery
  (`test/recovery.test.js`) and no-false-completion still green within the 65-test run.
- **`SECURITY.md` — PRESENT.** `services/fusion-capture-gateway/SECURITY.md` exists
  (authored this round).

### Exact remaining condition(s) before real-secret provisioning + live proof

The fixtures baseline merges with no open blocker. **Before** real secrets are
provisioned and the live phone-visible acceptance proof runs, complete the
pre-live-wiring hardening now recorded in `SECURITY.md §7`:

1. **F-04** — per-sender rate-limit / flood control at the adapter/intake seam.
2. **F-05** — structured, secret-free access logging of capture-write + raw-object-read.
3. **F-07** — author restrictive RLS policies (service_role server-side only + single
   authorised principal) on top of deny-by-default. *(Silas owns schema; Vex proposes.)*
4. **F-08** — enforce retention-class on raw-object creation.
5. **F-09 / F-10** — at real wiring, verify the worker trust boundary and the
   webhook/poll authenticity token; confirm TLS on all hops and Supabase at-rest
   encryption.

On those landing, Vex re-runs §1–§5 (traversal probe + single-write recovery +
erasure still green) and signs off; only then are real secrets + the live proof
authorised. None of the five gate the fixtures baseline.

*No `services/` code was modified this round; `SECURITY.md` is a new required doc, as
expected. The traversal/remove probe ran in `os.tmpdir()` and was deleted.*
