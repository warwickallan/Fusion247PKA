#!/usr/bin/env bash
#
# secret-scan.sh — zero-dependency tracked-file secret scanner.
#
# Security finding F-02 (wp0-security-gate.md §6 hard-stop): a secret-scanning
# control must actually run in CI and locally. This script is that control.
#
# Portable: bash + git + grep only. No network, no external tools, no deps.
#
# WHAT IT DOES
#   Scans every TRACKED file (git ls-files -z) for secret *value* patterns —
#   not variable NAMES — and fails (exit 1) printing each hit as file:line.
#   Exits 0 when the working tree is clean.
#
# EXCLUSIONS (deliberate, to avoid self-match / false positives on docs):
#   - .env.example        (names-only template, tracked on purpose)
#   - *.md                (docs reference secret NAMES / pattern shapes)
#   - scripts/secret-scan.sh  (this file — it literally contains the patterns)
#
# The patterns match VALUES: a token/JWT/key body, not "TELEGRAM_BOT_TOKEN".
#
set -euo pipefail

# Always operate from the repository root so paths are stable regardless of cwd.
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# --- secret VALUE patterns (POSIX ERE; [[:space:]] for portability) ----------
# Double-quoted where a pattern needs both ' and " in a character class.
declare -a PATTERNS=(
  # Telegram bot token: <digits>:AA<base64ish>
  '[0-9]{6,}:AA[A-Za-z0-9_-]{30,}'
  # JWT: header.payload.  (three dot-separated base64url segments)
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.'
  # Stripe live keys
  '(sk|pk)_live_[A-Za-z0-9]{10,}'
  # AWS access key id
  'AKIA[0-9A-Z]{16}'
  # PEM private key block header
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  # Generic assignment of a long quoted secret VALUE to a sensitive NAME.
  "(SERVICE_ROLE_KEY|SECRET|TOKEN|PASSWORD)[[:space:]]*[:=][[:space:]]*['\"][A-Za-z0-9/+_-]{20,}['\"]"
)

# --- build the scan file list (tracked files, minus exclusions) --------------
FILES=()
while IFS= read -r -d '' f; do
  case "$f" in
    *.md) continue ;;
    .env.example|*/.env.example) continue ;;
    scripts/secret-scan.sh) continue ;;
  esac
  # Skip anything not present on disk (e.g. a staged deletion).
  [ -f "$f" ] || continue
  FILES+=("$f")
done < <(git ls-files -z)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "secret-scan: no tracked files to scan — clean."
  exit 0
fi

# --- run grep once with every pattern (-I skips binary files) ----------------
GREP_ARGS=()
for pat in "${PATTERNS[@]}"; do
  GREP_ARGS+=(-e "$pat")
done

# grep exits 1 when there are no matches; capture without tripping set -e.
MATCHES="$(grep -I -n -H -E "${GREP_ARGS[@]}" -- "${FILES[@]}" || true)"

# Precise allowlist for the generic NAME[:=]VALUE rule: drop matches whose quoted
# VALUE is itself a bare SCREAMING_CASE identifier (e.g. config maps of env-var
# NAMES like  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY'). A real
# secret value always carries lowercase / digits / slashes, so this cannot hide
# one. The five strong value patterns above are NOT subject to this filter.
if [ -n "$MATCHES" ]; then
  MATCHES="$(printf '%s\n' "$MATCHES" \
    | grep -vE "(SERVICE_ROLE_KEY|SECRET|TOKEN|PASSWORD)[[:space:]]*[:=][[:space:]]*['\"][A-Z_]{20,}['\"]" \
    || true)"
fi

if [ -n "$MATCHES" ]; then
  echo "secret-scan: FOUND potential secret value(s):"
  echo "-----------------------------------------------------------------"
  echo "$MATCHES"
  echo "-----------------------------------------------------------------"
  COUNT="$(printf '%s\n' "$MATCHES" | grep -c '' || true)"
  echo "secret-scan: FOUND ${COUNT} hit(s) across ${#FILES[@]} scanned file(s). Failing."
  exit 1
fi

echo "secret-scan: clean — scanned ${#FILES[@]} tracked file(s), 0 secret value(s) found."
exit 0
