// BUILD-002 FU-1 -- reproducible, OFFLINE CA cross-check.
//
// PURPOSE: make FU-1 L-1 (the outstanding TOFU-vs-authoritative cross-check) a
// one-command action. The pinned bundle certs/supabase-pooler-ca.pem was
// extracted from a LIVE handshake (trust-on-first-use). L-1 stays OPEN until it
// is cross-checked against the AUTHORITATIVE dashboard download
// (Supabase Dashboard -> Database -> Settings -> SSL Configuration ->
// prod-ca-2021.crt). That download lives behind an authenticated dashboard, so
// closure is a Warwick action; this script performs the comparison for him.
//
// This script is READ-ONLY on the filesystem. It reads NO env var, NO secret,
// opens NO network connection, and touches NO database. It parses PEM files
// with node:crypto and prints a verdict.
//
// USAGE:
//   node scripts/fu1-ca-crosscheck.mjs [pathToPinnedPem] [--official <prod-ca-2021.crt>]
//
//   node scripts/fu1-ca-crosscheck.mjs
//     -> self-consistency + CRYPTOGRAPHIC chain check of the committed pin
//        (intermediate signature verified against the pinned root public key;
//        root self-signature verified), plus fingerprint/CN pin. Exit 0 on pass.
//
//   node scripts/fu1-ca-crosscheck.mjs --official ~/Downloads/prod-ca-2021.crt
//     -> the above PLUS: assert the pinned ROOT fingerprint appears in the
//        official download. VERDICT: MATCH (exit 0) closes L-1;
//        VERDICT: MISMATCH (exit 2) is a stop-everything incident.
//
// EXIT CODES:
//   0 = pass / MATCH. The ONLY two exit-0 paths are: (a) a well-formed run with
//       NO --official, which performs self-consistency + chain and prints
//       "L-1 status: OPEN"; and (b) a well-formed --official run whose
//       authoritative root-fingerprint comparison returned MATCH.
//   2 = self-consistency/chain failure, --official MISMATCH, a missing/unreadable
//       --official file, OR any malformed CLI (missing/duplicate/flag-shaped
//       --official value, unknown flag, extra positional).
//   1 = pinned-PEM IO/parse error only (the default bundle is committed, so a
//       failure here is an environment fault, not a user CLI mistake).
//
// FAIL-CLOSED INVARIANT: if --official appears on the command line in ANY form,
// this process CANNOT exit 0 unless the authoritative root comparison actually
// ran and returned MATCH. A missing value, a flag-shaped value, a duplicate
// --official, an unknown flag, an extra positional, or a missing/unreadable/
// non-matching official file all exit non-zero. A malformed authoritative-check
// invocation must NEVER fall through to the self-consistency-only "OPEN" path.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { X509Certificate } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PINNED = path.join(__dirname, '..', 'certs', 'supabase-pooler-ca.pem');

// The pin -- kept identical to test/pinnedCaGuard.test.js on purpose.
const EXPECTED_INTERMEDIATE_CN = 'Supabase Intermediate 2021 CA';
const EXPECTED_ROOT_CN = 'Supabase Root 2021 CA';
const EXPECTED_INTERMEDIATE_FP =
  '303b0a59bbc8d77e967fbed20b3fe68ec5d7d391c3081ece9936efceef0a55ea';
const EXPECTED_ROOT_FP =
  '807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa';

const cnOf = (dn) => {
  const line = dn.split('\n').find((l) => l.startsWith('CN='));
  return line ? line.slice(3) : null;
};
const normFp = (fp) => fp.replace(/:/g, '').toLowerCase();

const USAGE =
  'usage: node scripts/fu1-ca-crosscheck.mjs [pathToPinnedPem] [--official <prod-ca-2021.crt>]';

// Malformed CLI is fail-closed: exit 2, never 0. This is what stops
// `--official <typo>` from silently degrading to the self-consistency-only
// "OPEN" path and handing back a false all-clear.
function usageFail(msg) {
  console.error(`ERROR: ${msg}`);
  console.error(USAGE);
  process.exit(2);
}

// Strict, explicit parse. Accepts at most one positional (the pinned PEM path;
// defaults to the committed bundle) and an optional `--official <file>`.
// `--official` MUST be immediately followed by exactly one NON-FLAG value; a
// missing value, a value that begins with '-', or a duplicate --official is a
// usageFail. Unknown flags and extra positionals are usageFails too. There is no
// path here by which a malformed --official can be dropped and the caller still
// reach an exit-0 branch.
function parseArgs(argv) {
  let officialPath = null;
  let officialSeen = false;
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--official') {
      if (officialSeen) {
        usageFail('--official was supplied more than once');
      }
      officialSeen = true;
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('-')) {
        usageFail(
          `--official requires exactly one file-path value, got ${value === undefined ? 'nothing (end of arguments)' : `"${value}" (looks like a flag)`}`,
        );
      }
      officialPath = value;
      i += 1; // consume the value so it is not re-read as a positional
    } else if (arg.startsWith('-')) {
      usageFail(`unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (positionals.length > 1) {
    usageFail(`expected at most one pinned-PEM path, got ${positionals.length}: ${positionals.join(', ')}`);
  }
  const pinnedPath = positionals.length === 1 ? positionals[0] : DEFAULT_PINNED;

  return { pinnedPath, officialPath, officialProvided: officialSeen };
}

function readCerts(file) {
  const pem = fs.readFileSync(file, 'utf8');
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(pem)) {
    throw new Error(`${file} contains a PRIVATE KEY block -- refusing to treat it as a CA bundle`);
  }
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
  return blocks.map((b) => new X509Certificate(b));
}

function fail(msg, code) {
  console.error(`ERROR: ${msg}`);
  process.exit(code);
}

const { pinnedPath, officialPath, officialProvided } = parseArgs(process.argv.slice(2));

// ---- 1. Parse + describe the pinned bundle -------------------------------
if (!fs.existsSync(pinnedPath)) fail(`pinned PEM not found: ${pinnedPath}`, 1);

let pinnedCerts;
try {
  pinnedCerts = readCerts(pinnedPath);
} catch (err) {
  fail(err.message, 1);
}

console.log(`Pinned bundle: ${pinnedPath}`);
console.log(`Certificates found: ${pinnedCerts.length}`);
for (const c of pinnedCerts) {
  console.log(`  - CN=${cnOf(c.subject)}  fingerprint256=${normFp(c.fingerprint256)}`);
}
console.log('');

// ---- 2. Self-consistency against the recorded pin ------------------------
if (pinnedCerts.length !== 2) {
  fail(`expected exactly 2 certificates in the pinned bundle, found ${pinnedCerts.length}`, 2);
}
const [intermediate, root] = pinnedCerts;
const checks = [
  // TRUST BASIS: cryptographic SIGNATURE verification. X509Certificate.verify(
  // publicKey) is true iff the cert was signed by the private key for that
  // public key. A same-name forged cert would pass the CN checks below and FAIL
  // these two -- so these are the load-bearing assertions, not the names.
  [intermediate.verify(root.publicKey) === true, 'intermediate is SIGNED BY the pinned root public key (cryptographic chain)'],
  [root.verify(root.publicKey) === true, "root self-signature verifies against its own public key (valid trust anchor)"],
  // Identity + fingerprint pin.
  [cnOf(intermediate.subject) === EXPECTED_INTERMEDIATE_CN, 'intermediate subject CN matches the pin'],
  [cnOf(root.subject) === EXPECTED_ROOT_CN, 'root subject CN matches the pin'],
  [normFp(intermediate.fingerprint256) === EXPECTED_INTERMEDIATE_FP, 'intermediate fingerprint256 matches the pin'],
  [normFp(root.fingerprint256) === EXPECTED_ROOT_FP, 'root fingerprint256 matches the pin'],
  // Complementary name / CA-flag sanity (NOT a trust basis -- cannot catch a
  // same-name forgery; kept for early detection of an accidentally reshaped bundle).
  [cnOf(intermediate.issuer) === EXPECTED_ROOT_CN, 'intermediate issuer CN matches the pinned root (name sanity)'],
  [cnOf(root.issuer) === cnOf(root.subject), 'root issuer CN == subject CN (self-signed by name)'],
  [intermediate.ca === true, 'intermediate is a CA cert'],
  [root.ca === true, 'root is a CA cert'],
];
let selfOk = true;
for (const [ok, label] of checks) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`);
  if (!ok) selfOk = false;
}
console.log('');
if (!selfOk) {
  fail('pinned bundle failed self-consistency / chain checks -- do not trust this bundle', 2);
}
console.log('Self-consistency + chain: PASS');
console.log('');

// ---- 3. Authoritative cross-check (only when --official is given) --------
if (!officialProvided) {
  console.log('L-1 status: OPEN (no --official file supplied).');
  console.log('To CLOSE L-1: download prod-ca-2021.crt from the Supabase dashboard');
  console.log('  (Database -> Settings -> SSL Configuration) and re-run:');
  console.log('  node scripts/fu1-ca-crosscheck.mjs --official <path-to-prod-ca-2021.crt>');
  process.exit(0);
}

// --official was supplied, so from here every failure is exit 2 (fail-closed):
// once the caller asked for the authoritative check, a missing/unreadable file
// must NOT masquerade as a clean run. Exit 0 is reachable below ONLY via MATCH.
if (!fs.existsSync(officialPath)) fail(`official PEM not found: ${officialPath}`, 2);

let officialCerts;
try {
  officialCerts = readCerts(officialPath);
} catch (err) {
  fail(err.message, 2);
}

const officialFps = officialCerts.map((c) => normFp(c.fingerprint256));
console.log(`Official download: ${officialPath}`);
console.log(`Certificates found: ${officialCerts.length}`);
for (const c of officialCerts) {
  console.log(`  - CN=${cnOf(c.subject)}  fingerprint256=${normFp(c.fingerprint256)}`);
}
console.log('');

// The authoritative test: the pinned ROOT (the trust anchor) must be present
// in the dashboard-issued file. If the official file also contains the
// intermediate, we note it, but the root match is the load-bearing assertion.
const rootMatch = officialFps.includes(EXPECTED_ROOT_FP);
const intermediateAlsoPresent = officialFps.includes(EXPECTED_INTERMEDIATE_FP);

console.log(`Pinned ROOT fingerprint present in official file: ${rootMatch ? 'YES' : 'NO'}`);
console.log(`Pinned INTERMEDIATE fingerprint present in official file: ${intermediateAlsoPresent ? 'YES' : 'no (root match is sufficient)'}`);
console.log('');

if (rootMatch) {
  console.log('VERDICT: MATCH - FU-1 L-1 CLOSED');
  process.exit(0);
} else {
  console.log('VERDICT: MISMATCH - STOP, treat as incident');
  console.log('The pinned root does NOT appear in the authoritative dashboard download.');
  console.log('Do NOT cut over. Escalate: the TOFU pin may have captured a hostile chain.');
  process.exit(2);
}
