#!/usr/bin/env bash
# secret-scan.sh — tower-baton wrapper that reuses the repo-root scanner.
#
# The canonical zero-dependency scanner lives at <repo-root>/scripts/secret-scan.sh
# and scans every TRACKED file for secret VALUE patterns (not NAMES). This wrapper
# just locates and runs it so `npm run scan` inside services/tower-baton works.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
exec bash "$ROOT/scripts/secret-scan.sh"
