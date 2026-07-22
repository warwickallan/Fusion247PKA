#!/usr/bin/env bash
# TQA-006 regression driver — provisions a throwaway local Postgres, runs the retry dbtest, tears down.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="${POSTGRES_BIN:-C:/Users/Buggly/scoop/apps/postgresql/current/bin}"
CL="$HERE/.cluster-yr-$$"
PORT="${PGPORT:-55438}"
cleanup() { "$BIN/pg_ctl.exe" -D "$CL" -m immediate stop >/dev/null 2>&1; rm -rf "$CL"; }
trap cleanup EXIT
"$BIN/initdb.exe" -D "$CL" -U postgres --auth=trust -E UTF8 --no-sync >/dev/null 2>&1 || { echo "initdb failed"; exit 1; }
"$BIN/pg_ctl.exe" -D "$CL" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$CL/log" start >/dev/null 2>&1 || { echo "pg_ctl start failed"; cat "$CL/log" 2>/dev/null; exit 1; }
for i in $(seq 1 30); do "$BIN/pg_isready.exe" -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1 && break; sleep 1; done
PGPORT="$PORT" node "$HERE/youtube-retry.dbtest.mjs"
exit $?
