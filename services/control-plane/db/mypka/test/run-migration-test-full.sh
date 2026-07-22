#!/usr/bin/env bash
# Reproducibility + rollback proof driver for the MyPKA cockpit migrations.
# Provisions a throwaway local Postgres (repo-local dir — %TEMP% stalls initdb under this
# machine's file scanning), runs the connect-only node test, then tears the cluster down.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${POSTGRES_BIN:-C:/Users/Buggly/scoop/apps/postgresql/current/bin}"
CL="$HERE/.cluster-$$"
PORT="${PGPORT:-55433}"

cleanup() { "$BIN/pg_ctl.exe" -D "$CL" -m immediate stop >/dev/null 2>&1; rm -rf "$CL"; }
trap cleanup EXIT

echo "[driver] initdb ($CL)"
"$BIN/initdb.exe" -D "$CL" -U postgres --auth=trust -E UTF8 --no-sync >/dev/null 2>&1 || { echo "initdb failed"; exit 1; }
echo "[driver] start on port $PORT"
"$BIN/pg_ctl.exe" -D "$CL" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$CL/log" start >/dev/null 2>&1 || { echo "pg_ctl start failed"; cat "$CL/log" 2>/dev/null; exit 1; }
# wait for ready
for i in $(seq 1 30); do "$BIN/pg_isready.exe" -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1 && break; sleep 1; done

PGPORT="$PORT" node "$HERE/apply-teardown-full.test.mjs"
rc=$?
exit $rc
