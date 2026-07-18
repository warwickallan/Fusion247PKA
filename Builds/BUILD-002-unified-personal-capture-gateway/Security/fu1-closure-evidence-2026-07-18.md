---
build: BUILD-002
wp: WP1
artifact: fu1-closure-evidence
author: mack
status: DONE / FU-1 L-1 CLOSED (authoritative cross-check MATCH 2026-07-18)
created: 2026-07-18
supersedes_row: "[[wp1-delta-review-2026-07-17]] FU-1 row + finding L-1"
---

# FU-1 Closure Evidence (2026-07-18)

Honest closure record for FU-1 (verify-full TLS to the Supabase session pooler
with a PINNED CA). It records what is genuinely DONE, what is now LOCKED by an
automated guard, and the ONE item that remains open pending a Warwick action.
Extends the FU-1 row and finding L-1 in [[wp1-delta-review-2026-07-17]] and the
morning actions in [[wp1-safe-cutover]] s7.

**No live configuration was changed and no live database was connected while
producing this evidence.** Everything below is either read-only file parsing of
the committed public CA bundle, an automated test run in no-DB mode, or a
citation of a probe already recorded in the delta review. No secret value was
read, echoed, or logged.

---

## 1. Code / wiring / live-switch: DONE

The FU-1 crypto and wiring are built and merged on `main`:

- `services/fusion-capture-gateway/src/store/pgSslConfig.js` -- strips every
  ssl-ish DSN param (the node-postgres replacement trap) and builds the
  explicit verify-full ssl object with the pinned CA.
- `services/fusion-capture-gateway/config.js` -- reads `DATABASE_SSL_CA_FILE`
  and feeds it into the ssl config.
- `services/fusion-capture-gateway/src/live/runtime.js` -- applies the pinned
  CA on the live runtime path.
- `services/fusion-capture-gateway/certs/supabase-pooler-ca.pem` -- the
  committed public CA bundle (two certs; PUBLIC, not a secret).
- **Live switch is set:** `DATABASE_SSL_CA_FILE` is set in the live env
  (`C:\.fusion247\fusion-capture-gateway.env`) per [[wp1-safe-cutover]] s7.2 --
  the machine-side switch, not this branch.

Enforcement (CI, no-DB): the TLS grep-gates in
`test/tlsTransportGuards.test.js` ban `rejectUnauthorized:false` from all
runtime source (single named exception: the TOFU extraction script) and ban a
bare require-mode `sslmode` DSN from runtime source + `.env.example`.

## 2. Pinned CA self-consistency: PASS -- and now LOCKED

The committed bundle parses cleanly and is internally authentic:

- Exactly 2 certificates.
- cert 1 subject CN "Supabase Intermediate 2021 CA",
  fingerprint256 `303b0a59bbc8d77e967fbed20b3fe68ec5d7d391c3081ece9936efceef0a55ea`.
- cert 2 subject CN "Supabase Root 2021 CA",
  fingerprint256 `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
- Chain CRYPTOGRAPHICALLY valid (not merely name-matched): the intermediate's
  signature verifies against the pinned root's public key
  (`intermediate.verify(root.publicKey) === true`), and the root's
  self-signature verifies against its own public key
  (`root.verify(root.publicKey) === true`). Both carry basicConstraints cA:TRUE.
  The issuer/subject CN equalities are kept only as complementary sanity -- they
  are NOT the trust basis, because a same-name forged cert would satisfy them.
- No PRIVATE KEY block anywhere in the file.

(fingerprint256 values are `X509Certificate.fingerprint256` over the DER
encoding, lowercased with colons stripped.)

**This is now LOCKED by `test/pinnedCaGuard.test.js`.** The trust basis is
CRYPTOGRAPHIC SIGNATURE verification (`X509Certificate.verify`): the intermediate
must be signed by the pinned root, and the root's self-signature must verify.
Complementary asserts pin cert count, subject CNs, both fingerprints, CA flags,
and no-private-key. Two negative tests prove the signature check is real: an
unrelated public key (RSA and EC) is rejected, and -- the exact TQA-001 forgery
class -- a same-CN "root" with a different key passes the name check but FAILS
signature verification. The pin is
deliberate: if Supabase rotates the CA, this test FAILS ON PURPOSE, and the new
fingerprints must be reviewed and updated in a deliberate reviewed change --
never silently. This closes the "no automated regression protecting the anchor"
gap; it does NOT by itself close L-1 (that needs the authoritative cross-check
below).

## 3. Prior live probe (cited, not re-run)

The delta review recorded a live TLS probe from this machine on 2026-07-17
(`scripts/tls-verify-probe.mjs`): `mode: explicit-pinned-ca`, TLSv1.3,
**`cert_verified_by_client: true`**, `authorization_error: null`, hostname-
verified leaf `*.pooler.supabase.com`, `query_ok: true`. See
[[wp1-delta-review-2026-07-17]] FU-1 row and [[wp1-safe-cutover]] s7.2. That
probe is cited here as prior evidence -- it was NOT re-run in this session, and
no live connection was made now.

## 4. L-1: CLOSED -- authoritative cross-check MATCH (2026-07-18)

The TOFU pin has been cross-checked against Supabase's AUTHORITATIVE published
CA and MATCHES. **L-1 is CLOSED.**

- **Date:** 2026-07-18.
- **Official CA source:** downloaded from Warwick's AUTHENTICATED Supabase
  dashboard (Database -> Settings -> SSL Configuration -> "Download
  certificate"), whose link resolves to the canonical public URL
  `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.
  Sourcing it via the authenticated dashboard is what makes it authoritative for
  this project. Saved to a temporary location OUTSIDE Git; **the downloaded
  certificate was NOT committed.** No authenticated session data was exposed,
  pasted, uploaded, or logged.
- **Command:** `node scripts/fu1-ca-crosscheck.mjs --official <prod-ca-2021.crt>`
  (from `services/fusion-capture-gateway/`, on the FU-1 branch).
- **Official certificate:** the file contained one certificate, CN "Supabase
  Root 2021 CA", fingerprint256
  `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
- **Result:** the pinned ROOT fingerprint is present in the official file; all
  self-consistency + cryptographic signature checks PASS; the script printed
  **`VERDICT: MATCH - FU-1 L-1 CLOSED`** (exit 0).

The pinned root now has authoritative provenance (it matches Supabase's
published prod-ca-2021.crt), not merely TOFU. No live configuration was changed
and no live database was connected to produce this cross-check -- only a public
CA file was fetched and parsed offline.

**Exact closure procedure:**

1. Warwick downloads `prod-ca-2021.crt` from the Supabase dashboard
   (Database -> Settings -> SSL Configuration).
2. Run:
   `node scripts/fu1-ca-crosscheck.mjs --official <path-to-prod-ca-2021.crt>`
   (from `services/fusion-capture-gateway/`).
3. `VERDICT: MATCH - FU-1 L-1 CLOSED` (exit 0) -> L-1 closed; record the run
   here. `VERDICT: MISMATCH - STOP, treat as incident` (exit 2) -> stop
   everything, do NOT cut over, escalate -- the TOFU pin may have captured a
   hostile chain.

The cross-check script (`scripts/fu1-ca-crosscheck.mjs`) is offline and
read-only: it reads no env var or secret, opens no network or DB connection,
and only parses PEM files. Run with no `--official` argument it prints the
pinned bundle's fingerprints, verifies self-consistency + chain, and states
that L-1 is OPEN.

## 5. Verification run (this session)

- `test/pinnedCaGuard.test.js` alone: 8 tests, 8 pass, 0 fail;
  `test/fu1Crosscheck.test.js`: 10 pass, 0 fail (focused FU-1: 18/18).
- Full gateway suite (`node --test`, no-DB mode), re-run 2026-07-18 after the
  L-1 closure: **317 tests, 285 pass, 0 fail, 32 DB-gated skips.**
- Secret scan (`scripts/secret-scan.sh`), re-run 2026-07-18: **clean -- 452
  tracked files scanned, 0 secret values found.**
- **L-1 authoritative cross-check (2026-07-18): the script printed
  `VERDICT: MATCH - FU-1 L-1 CLOSED` (exit 0)** against the official
  prod-ca-2021.crt (root sha256 `807025ad...`); see section 4.
- Signature-verification negatives (proving the crypto check is real, not a
  tautology): an unrelated RSA public key and an unrelated EC public key are
  both REJECTED by `intermediate.verify(...)`; the intermediate does NOT verify
  against its own key; and a same-CN "root" bearing a different key passes the
  name check but FAILS `intermediate.verify(forgedRootKey)` -- the exact
  TQA-001 forgery class.
- Negative check (pin integrity): flipping a single hex digit in the expected
  root fingerprint makes the pin assertion FAIL -- confirming the guard would
  catch any silent change to the committed CA.
- Cross-check verdicts confirmed both ways offline: an official file containing
  the pinned root prints `VERDICT: MATCH` (exit 0); an official file missing
  the pinned root prints `VERDICT: MISMATCH` (exit 2). The self-consistency
  section now also fails closed (exit 2) if signature verification fails.

## Status summary

| Item | Status |
|------|--------|
| FU-1 code / wiring | DONE (merged on main) |
| Live switch `DATABASE_SSL_CA_FILE` | SET (machine-side env) |
| Pinned CA self-consistency + chain | PASS |
| Automated pin guard | DONE (`test/pinnedCaGuard.test.js`) |
| Prior live probe `cert_verified_by_client` | true (recorded 2026-07-17) |
| **L-1 authoritative dashboard cross-check** | **CLOSED -- MATCH 2026-07-18 (official root sha256 807025ad...)** |

## Links

- [[wp1-delta-review-2026-07-17]] -- FU-1 row + finding L-1 this note extends.
- [[wp1-safe-cutover]] -- s7 morning actions (cross-check + live switch).
- [[wp0-live-signoff-2026-07-17]] -- WP0 baseline whose FU-1 condition this tracks.
