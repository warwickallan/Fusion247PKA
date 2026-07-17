---
build: BUILD-002
wp: WP0
artifact: wp0-live-credential-transport-signoff
author: vex
status: signed-off-green-with-conditions
created: 2026-07-17
reviewed_head: ecaec0c0ebf2fbe784f8bdc31e9b17b003ca0b2c
---

# WP0 Live Credential/Transport Sign-off (2026-07-17)

The final deferred gate item from [[wp0-security-gate-execution-2026-07-16]] and
[[wp0-security-gate-delta-2026-07-16]]: the LIVE credential/transport review
against the real wiring. Branch `build-002/wp0-live-integration`, reviewed head
**`ecaec0c`** (confirmed via `git rev-parse HEAD`, not trusted from the brief),
commits `6c5cbea` + `ecaec0c` on top of `b49f854`. Method:
[[SOP-004-vex-security-audit]] against [[wp0-security-gate]] sections 1-6.

**Review method: live re-execution, not trust.** Every load-bearing claim below is
backed by a command run in this session -- a masked `node --env-file` probe against
the real database, a TLS socket inspection, a git-history secret sweep, a file-ACL
read, or a source read at the reviewed head. Live-DB facts I could not or chose not
to re-derive are explicitly marked "verified by Larry via MCP". No secret value was
read, echoed, or logged at any point; the env file was inspected by key NAME only.

---

## VERDICT: GREEN-WITH-CONDITIONS

**The live wiring is signed off for WP0.** Zero CRITICAL, zero HIGH findings. The
identity, authorization, secret-hygiene, idempotency, and erasure controls that were
GREEN in fixtures are GREEN against the real project -- several now proven by my own
live probes rather than static reading. The live phone-visible acceptance proof
passed tonight on this exact build (reported by Larry; not re-run here -- re-running
would require touching the running worker, which was out of scope by instruction).

**The one substantive condition:** the runtime DSN currently gives TLS encryption
WITHOUT server-certificate verification (V-01, MEDIUM). Acceptable for WP0 on the
stated dev posture; **mandated follow-up** to pin the Supabase CA and move to
`verify-full` before the gateway runs as an unattended daily driver (WP1 boundary at
the latest). Details and the exact remediation below.

**Severity counts: CRITICAL 0 - HIGH 0 - MEDIUM 1 - LOW 3 - INFO 3.**

---

## Scope item 1 -- real DATABASE_URL credential/TLS

**What I verified (live, masked):**

- DSN posture parsed from the env-injected value (booleans only, value never
  printed): host ends in `.pooler.supabase.com` (Supabase session pooler), port
  5432, `uselibpqcompat=true`, `sslmode=require`, **no `sslrootcert`**, username in
  the pooler `postgres.<ref>` shape, no other query params. `pg` v8.22.0.
- **Client-socket TLS probe (the decisive evidence):** the actual socket
  node-postgres opened to the pooler is **encrypted -- TLSv1.3,
  TLS_AES_256_GCM_SHA384**. The server presented a certificate for
  `*.pooler.supabase.com` issued by **"Supabase Intermediate 2021 CA" (Supabase
  Inc)**, valid to 2030-03-11. The client did **not** verify it:
  `authorized=false`, `authorizationError=SELF_SIGNED_CERT_IN_CHAIN` -- exactly
  libpq `require` semantics under `uselibpqcompat=true`.
- Note for future auditors: `pg_stat_ssl` at the backend reports `ssl=false`
  through the session pooler -- that view shows the **pooler-to-database** hop
  (internal to Supabase infrastructure), not the client-to-pooler hop. Only the
  client-socket inspection answers the transport question; do not be misled by it.

**Assessment (V-01, MEDIUM -- my call: acceptable for WP0 with a mandated
follow-up, not a blocker):**

- What the posture defeats: all passive eavesdropping on the path (home LAN, ISP,
  transit) -- the wire is TLS 1.3 encrypted.
- What it does not defeat: an **active on-path attacker** (compromised home router,
  DNS poisoning, hostile Wi-Fi if the worker ever roams) can present any
  certificate and terminate the TLS themselves. SCRAM-SHA-256 does **not** rescue
  the credential in that scenario: a fake server can request cleartext-password
  authentication and node-postgres will comply -- the DB password is harvestable by
  an active MITM, not just the session data.
- Why this is not HIGH/blocking for WP0: exploitation requires an established
  active on-path position against one fixed residential path; the exposed asset is
  the operational/staging store of a single-user system whose canonical data is
  local Markdown; the phase is a supervised dev proof, not unattended operation;
  and the fix is config-only, minutes of work, no code change.
- Why it cannot stand: the moment this runs unattended as a daily capture path,
  "attacker needs to be on-path once" becomes an unbounded standing exposure of
  both credential and personal capture content.

**Mandated remediation (FU-1):** download the Supabase CA certificate from the
project dashboard (prod-ca-2021), store it beside the env file (e.g.
`C:\.fusion247\supabase-prod-ca-2021.crt`), change the DSN query to
`uselibpqcompat=true&sslmode=verify-full&sslrootcert=C:\.fusion247\supabase-prod-ca-2021.crt`,
restart the worker. **Verification step:** re-run the TLS probe pattern from this
session (`scratchpad/vex-tls-probe.mjs` shape) expecting
`cert_verified_by_client: true`, `authorization_error: null`. The presented chain
already is the Supabase CA, so pinning will pass against the current pooler.

**Doc drift (V-03, LOW):** `SECURITY.md` sections 2-3 ("keep `?sslmode=require`"),
`README.md`, and `.env.example` all describe a bare `?sslmode=require` DSN against
the direct `db.<ref>.supabase.co` host; the working posture is the session pooler +
`uselibpqcompat`. Update all three to the pinned `verify-full` form when FU-1 lands
so the runbook regenerates the correct DSN on rotation.

## Scope item 2 -- live token handling

- **Env file:** `C:\.fusion247\fusion-capture-gateway.env` (outside the repo tree)
  carries exactly the four required NAMES -- `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`,
  `AUTHORISED_TELEGRAM_USER_ID`, `WORKER_ID` -- inspected via masked pattern (names
  only, every value rendered `***masked***`). No stray keys, no reserved secrets
  provisioned. Matches `REQUIRED_AT_RUNTIME` exactly.
- **Git history sweep (mine, this session):** `git log --all -G` for the Telegram
  token shape (`[0-9]{6,}:AA...`) -> **zero commits ever**. Same sweep for
  credential-bearing DSN shapes -> three commits, all inspected: synthetic test
  fixtures (`sUpErSeCrEtDbPw@localhost`, placeholder `db.ref.supabase.co`) and the
  CI throwaway (`postgres:postgres@localhost`). **No real secret has ever been
  committed.**
- **Rotation:** the screenshot-exposed original token was rotated before the env
  file was saved, and rotated again tonight; the superseded token was observed
  REJECTED (401) live before replacement (Larry-observed). The `SECURITY.md`
  rotation runbook is therefore not just documented but exercised twice, with a
  negative test of the dead credential. Positive finding.
- **Masking:** `maskToken()` (bot-id prefix + `***masked***`), `maskedUrl()`,
  `config.describe()` (`***set (masked)***`), and `safeErr()` (whole-DSN plus the
  parsed password component) -- all present at the reviewed head; all observed live
  logs tonight masked correctly (Larry-observed).
- **V-02 (LOW) -- env-file ACL:** `icacls` shows inherited `BUILTIN\Users:(RX)` and
  `NT AUTHORITY\Authenticated Users:(M)` on the env file -- any local account or
  low-privilege service process can read (and modify) the two secrets. On this
  single-user machine every such account is Warwick, so LOW, not HIGH. Fix (FU-3):
  break inheritance on `C:\.fusion247` and grant only the user + SYSTEM +
  Administrators.
- **V-04 (LOW) -- unredacted fatal path:** in `liveRunner.js`, the catch inside
  `main()` logs raw `err.message`; `safeErr()` redaction is scoped inside
  `createLiveRunner`, so a failure during runner construction (e.g. pg pool/DSN
  errors) bypasses redaction. pg error messages do not normally embed the DSN, so
  this is hygiene, not an exposure -- route the fatal log through the same
  redaction (FU-4).

## Scope item 3 -- RLS against the real project

**Independently re-verified live by my own masked probe** (read-only queries via
`--env-file`, booleans/names/counts only) -- the MCP findings from Larry confirmed:

- **RLS enabled on all 7 `fcg` tables** (`capture_envelope`, `channel_identity`,
  `channel_poll_offset`, `evidence_pointer`, `idempotency_key`,
  `processing_state`, `raw_object`) -- `pg_class.relrowsecurity = true` for every
  one.
- **Exactly one permissive `FOR ALL` policy per table, scoped `TO service_role`**
  -- 7 policies total, names matching migrations 0003/0005, no policy names
  anon/authenticated.
- **anon and authenticated denied:** `has_table_privilege` SELECT = **false** on
  all 7 tables for both roles; `service_role` DML = true on all 7. Deny-by-default
  stands at both the grant gate and the policy gate.
- **Seed identity:** `telegram:user:8601328832` exists, `channel=telegram`,
  principal matches the allowlist id, `is_authorised=true`; it is the **only**
  `channel_identity` row (1 total / 1 authorised).
- Migrations 0001-0005 applied and advisors clean post-0003: **verified by Larry
  via MCP** (not re-queried -- advisor access needs MCP, which this session did not
  use).
- **V-05 (INFO) -- worker role bypasses RLS by design:** `current_user = postgres`,
  `rolbypassrls = true`, and it owns all 7 tables. The RLS layer therefore
  constrains the Data-API surfaces (anon/authenticated via PostgREST), not the DSN
  role the worker uses. This is precisely the documented, accepted posture in
  `SECURITY.md` section 7 ("Runtime DB role vs RLS") for the single-user phase --
  re-audit mandatory before any multi-user or direct-client path. Optional
  hardening note: confirm the `fcg` schema is not in the PostgREST exposed-schemas
  list (it is not exposed by default).

## Scope item 4 -- getUpdates auth + allowlist

- **Allowlist before content, in the shared seam:** `telegramMapping.js` rejects
  `senderId !== authorised` (numeric, exact-match, default-deny) at line 90 --
  BEFORE the non-text check at line 103 -- so a photo from a stranger gets the same
  silent `unauthorised_sender` as text from a stranger: **no content-type oracle**.
  Same enforcement on the callback path (`mapTelegramCallbackQuery`). Strangers get
  silence + a masked structured rejection log; never a reply.
- **Env allowlist matches the intended principal:**
  `AUTHORISED_TELEGRAM_USER_ID === '8601328832'` -> true (boolean check; the id is
  not a secret and appears in the dispatch brief).
- **Transport:** long-poll only. No webhook registration, no HTTP listener, no
  inbound port anywhere in `src/` (network-sink grep re-confirmed clean in the
  prior delta; `verifyWebhook` remains dormant future infrastructure). Only the
  holder of the bot token can call `getUpdates` -- transport authenticity by
  construction (F-10 satisfied for the polling path).
- Constructor still throws without an authorised id; no self-enrolment path exists.

## Deltas reviewed tonight (commits 6c5cbea + ecaec0c)

| Delta | Security assessment |
|---|---|
| **Tap-gated capture** (`enqueue` fail-closed without `confirmedByTap:true`, enforced in BOTH stores; sole caller `intake.confirmSave()`) | **Positive control.** The human tap is now a store-level invariant, not a runner convention -- no startup sweep, drain, or future helper can silently promote a pending capture. `tap-gate-invariant.test.js` proves accepted rows survive restarts + idle cycles + lease-scale time jumps untouched. |
| **Non-text rejection** (`unsupported_content_type` in the shared mapping, after allowlist) | Closes the live false-completion defect (photo -> empty note marked completed). No envelope/row/card/markdown for non-text -- fail-closed at the seam shared by mock and live (no drift). Ordering preserves the no-oracle property for strangers. |
| **One-shot transient-network retry** (`callApi`) | Retries ONLY on fetch **rejections** classified as socket/transport errors via the undici cause chain; a parsed HTTP-level error (4xx/5xx, `ok:false`) is NEVER retried -- no replay of Telegram-rejected calls, no amplification (single retry, ~250ms, then a real throw). Worst duplicate is one extra `sendMessage` card if the first response was lost; data mutations stay behind idempotent intake, so no integrity effect. Sound. |
| **25s poll constant** (`POLL_WAIT_SECONDS`) | Operational only (NAT kill-window). No security surface change. |
| **Card recovery sweep** (bounded, 3/cycle) | Cards can only land in the authorised chat (`chatIdFor` falls back to the authorised id). Worst case one duplicate card whose orphaned tap answers "No capture found" -- a UX artifact, not an auth or integrity gap. Cannot enqueue anything (tap-gate holds). |
| **show_alert answers** | UX only; fixed strings, no untrusted interpolation. |
| **Receipt path as code span** | `parse_mode: Markdown` is set ONLY on the completed card, whose only variable content is the governed-writer path (safe charset by construction; backticks stripped defensively). Failed/pending cards -- which can embed error text -- deliberately stay parse-mode-free. Correctly conservative. |
| **`.gitignore` for `Team Inbox/captures/`** (ecaec0c) | Verified: `git check-ignore` matches; `git ls-files "Team Inbox/"` shows only `README.md` tracked; the 4 live capture files on disk are untracked. Personal capture content cannot reach the public repo via `git add -A`. Right call, found before it bit. |

## Regression + hygiene status at the reviewed head

- Unit suite: **185 tests, 171 pass, 14 env-gated skips, 0 fail** (run this
  session, no DB). The DB-gated integration suite was NOT run against the
  production project by me -- deliberately: those tests write rows, and the live
  store now holds real personal data. They remain proven against local Postgres in CI.
- Pre-live conditions from `SECURITY.md` section 7: F-04 rate limiter (token
  bucket, wired in runtime) -- closed. F-05 access logging (auth rejections +
  worker write path) -- closed. F-07 restrictive RLS -- closed and live-verified
  above. F-08 retention-class enforcement -- still open but **not applicable to
  WP0 data** (text is inline; the `raw_object` bucket path is not exercised);
  carries to the WP that first stores raw objects. F-09/F-10 -- verified at
  wiring, above.
- `SECURITY.md` security contact is still `<SECURITY-CONTACT-PLACEHOLDER>` --
  the policy itself said set-before-live-wiring; set it (FU-5, INFO).
- Secret scan: run LAST after this report was staged -- result recorded in the
  gate pointer and in the return to Larry.

---

## Findings table

| ID | Severity | Where | Finding | Fix / follow-up |
|----|----------|-------|---------|-----------------|
| V-01 | **MEDIUM** | runtime DSN (env; posture probed live) | TLS encryption without server-cert verification (`uselibpqcompat=true&sslmode=require`; probe: TLSv1.3 encrypted, `authorized=false`, `SELF_SIGNED_CERT_IN_CHAIN`). An active on-path MITM could impersonate the pooler and can harvest the DB password via cleartext-auth downgrade, plus read/write operational capture data. Accepted for supervised WP0 dev; not acceptable unattended. | **FU-1 (mandated):** pin Supabase CA (`sslrootcert`) + `sslmode=verify-full`; verify with the TLS probe (`cert_verified_by_client: true`). Deadline: before unattended daily-driver operation, at latest WP1 entry. |
| V-02 | LOW | `C:\.fusion247\fusion-capture-gateway.env` (icacls) | Inherited ACL grants `BUILTIN\Users` read and `Authenticated Users` modify on the secret store. Single-user machine -> LOW. | **FU-3:** break inheritance on `C:\.fusion247`, grant only the owner + SYSTEM + Administrators. |
| V-03 | LOW | `SECURITY.md` sections 2-3, `README.md`, `.env.example` | DSN documentation drift: docs prescribe bare `?sslmode=require` on the direct host; reality is pooler + `uselibpqcompat`. The rotation runbook would regenerate the wrong (and post-FU-1, weaker) DSN. | **FU-2:** update all three to the pinned `verify-full` + pooler form when FU-1 lands. |
| V-04 | LOW | `src/live/liveRunner.js` (catch inside `main`) | Fatal-path log emits raw `err.message` outside the `safeErr()` redaction scope (construction-time failures). No demonstrated leak -- hygiene only. | **FU-4:** route the fatal log through the same secret-value redaction. |
| V-05 | INFO | live DB (probe: `rolbypassrls=true`, owner) | The DSN role bypasses RLS (documented, accepted single-user posture per `SECURITY.md` section 7). RLS meaningfully protects the Data-API surfaces only. | Re-audit before any multi-user or direct-client path. Optionally confirm `fcg` is not PostgREST-exposed. |
| V-06 | INFO | `SECURITY.md` header | Security contact still a placeholder; the policy said set-before-live-wiring. | **FU-5:** set it. |
| V-07 | INFO | running worker process | The proof passed tonight on this build per Larry; the 01:28 Mack log notes an earlier worker predated the gate/timestamp fixes. | Confirm the resident worker process was (re)started on `ecaec0c`; restart with the same command if in doubt. |

Final tally: **CRITICAL 0 - HIGH 0 - MEDIUM 1 - LOW 3 - INFO 3**.

## Mandated follow-ups (the conditions in GREEN-WITH-CONDITIONS)

1. **FU-1 -- pin Supabase CA + `sslmode=verify-full`** (V-01). Mandated; config-only;
   verify with the TLS probe. Before unattended operation / WP1 entry.
2. **FU-2 -- align SECURITY.md/README/.env.example DSN guidance** with the pinned
   form (V-03), same change window as FU-1.
3. **FU-3 -- restrict the `C:\.fusion247` ACL** to owner + SYSTEM + Administrators (V-02).
4. **FU-4 -- redact the fatal-path log in the runner** (V-04).
5. **FU-5 -- set the SECURITY.md security contact** (V-06).
6. Carried unchanged: F-08 retention-class enforcement when raw objects first flow;
   V-05 re-audit at any multi-user/direct-client step.

None of these block the WP0 sign-off; FU-1 is the only one with a hard deadline
attached to the lifecycle of this build.

*No implementation code, tests, migrations, or the running worker were touched by
this review. Probes were masked, read-only, and left no artifacts outside the
session scratchpad. No secret value was read or emitted.*

## Links

- [[wp0-security-gate]] -- gate definition (section 6 hard boundary this sign-off closes).
- [[wp0-security-gate-execution-2026-07-16]] -- rounds 1-2 (fixtures) history.
- [[wp0-security-gate-delta-2026-07-16]] -- PR #28 delta review.
