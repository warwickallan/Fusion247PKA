#!/usr/bin/env bash
# secret-scan.sh — tower-baton scanner.
#
# Two layers, so "local clean" is a SUPERSET of what CI would reject:
#   1. Run the canonical repo-root CI scanner UNCHANGED (whole tree, secret VALUE
#      patterns). This is the enforced control; it is neither weakened nor special-cased.
#   2. ADD token-SHAPE pattern detection over this service's tracked files. The repo-root
#      scanner catches a secret VALUE assigned to a SECRET/TOKEN-named variable, but a
#      bare token-shaped literal (e.g. `const x = 'pk_live_...'`) can slip past it. A
#      literal of a KNOWN TOKEN SHAPE is refused here regardless of the variable name.
#
# EXPLICIT-FILE MODE: `secret-scan.sh <file> [<file> ...]` scans exactly the given files
# for token SHAPES only (used by the unit test that proves a token-shaped literal fails).
#
# Portable: bash + git + grep only. No network, no external tools, no deps.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

# --- token-SHAPE patterns (POSIX ERE) ----------------------------------------
# These match a token by its SHAPE, not by a known value or a variable name.
declare -a SHAPE_PATTERNS=(
  'pk_[A-Za-z0-9]{20,}'            # Stripe-style publishable/live key body
  'sk_[A-Za-z0-9]{20,}'            # secret-key body
  'sk-[A-Za-z0-9]{20,}'           # OpenAI-style key
  '[0-9]{8,}:[A-Za-z0-9_-]{30,}'  # Telegram bot-token shape <id>:<secret>
)

# scan_files <file...> — grep the given files for any token SHAPE. Prints hits and
# returns 1 on a match; returns 0 when clean (or when no files were supplied).
scan_files() {
  if [ "$#" -eq 0 ]; then return 0; fi
  local args=()
  local pat
  for pat in "${SHAPE_PATTERNS[@]}"; do args+=(-e "$pat"); done
  local hits
  hits="$(grep -I -n -H -E "${args[@]}" -- "$@" || true)"
  if [ -n "$hits" ]; then
    echo "secret-scan(token-shape): FOUND token-shaped literal(s):"
    echo "-----------------------------------------------------------------"
    echo "$hits"
    echo "-----------------------------------------------------------------"
    return 1
  fi
  return 0
}

# --- explicit-file mode (for the unit test) ----------------------------------
if [ "$#" -gt 0 ]; then
  if scan_files "$@"; then
    echo "secret-scan(token-shape): clean — $# file(s), 0 token-shaped literal(s)."
    exit 0
  fi
  exit 1
fi

# --- default mode ------------------------------------------------------------
# 1. the canonical repo-root CI scanner (whole tree, VALUE patterns) — UNCHANGED.
bash "$ROOT/scripts/secret-scan.sh"

# 2. token-SHAPE detection over this service's tracked files.
cd "$ROOT"
FILES=()
while IFS= read -r -d '' f; do
  case "$f" in
    *.md) continue ;;
    services/tower-baton/scripts/secret-scan.sh) continue ;; # this file carries the patterns
  esac
  [ -f "$f" ] || continue
  FILES+=("$f")
done < <(git ls-files -z -- services/tower-baton)

if ! scan_files "${FILES[@]}"; then
  echo "secret-scan(token-shape): FAIL — token-shaped literal in tracked tower-baton text."
  exit 1
fi
echo "secret-scan(token-shape): clean — scanned ${#FILES[@]} tower-baton file(s), 0 token-shaped literal(s)."
exit 0
