#!/usr/bin/env python3
"""TubeAIR watcher/runner (IDEA-013 automation link) — the missing bridge.

`tubeair.py` captures a transcript and builds the Karpathy packet; `tubeair_inbox.py`
scans the FusionDevBot capture inbox (read-only) and drives that core once per run.
This watcher is the *automation* layer on top: it drives the existing
`tubeair_inbox.py` pipeline on a schedule so a pasted YouTube link that lands in the
capture inbox automatically becomes a Karpathy packet — no manual invocation.

Design (reuse, do NOT rebuild):
  - ONE code path. Every cycle calls `tubeair_inbox.main(argv)` — the exact same
    entry the operator would run by hand. This file adds scheduling, graceful
    shutdown, structured logging and cycle-error isolation; it re-implements no
    part of the capture/packet pipeline and does not touch `tubeair.py`.
  - Idempotency is inherited. `tubeair_inbox` keeps a state file of processed
    (capture_file, video_id) pairs, so the poll loop is always safe to re-run: a
    video already turned into a packet is skipped on every subsequent cycle.
  - READ-ONLY on the inbox. Same as `tubeair_inbox` — it never creates, edits,
    moves or deletes a capture. FusionDevBot / BUILD-002 is untouched.
  - Keyless. No API key, no bot token, no network auth. Transcript fetch is the
    only egress and it is public, read-only YouTube caption data.

Run modes:
  One-shot (drive the inbox once, then exit):
    python tools/tubeair/tubeair_watch.py --once --repo-root .

  Poll loop (drive the inbox every --interval seconds until Ctrl-C / SIGTERM):
    python tools/tubeair/tubeair_watch.py --interval 30 --repo-root .

  Bounded loop (e.g. tests / cron-style single sweep with a couple of retries):
    python tools/tubeair/tubeair_watch.py --interval 0 --max-cycles 2 --repo-root .

All inbox flags pass straight through: --inbox, --out, --state, --languages,
--handoff, --dry-run.
"""

from __future__ import annotations

import argparse
import json
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Make the sibling modules importable regardless of the caller's cwd. The inbox
# reader itself does `import tubeair`, so the tubeair dir must be on sys.path.
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

import tubeair          # noqa: E402  (core pipeline — reused, never modified here)
import tubeair_inbox    # noqa: E402  (the single pipeline entry we schedule)

SERVICE = "tubeair_watch"

# Set by the signal handlers; checked between cycles for a graceful stop.
_STOP = False


def _log(event: str, **fields) -> None:
    """Structured JSON log line to stderr. Service name + event + UTC timestamp on
    every line. Keyless tool — there are no credentials to redact — but we still
    never echo capture *content*, only counts, paths and status."""
    record = {
        "service": SERVICE,
        "event": event,
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    record.update(fields)
    print(json.dumps(record, ensure_ascii=False), file=sys.stderr, flush=True)


def _install_signal_handlers() -> None:
    def _handler(signum, _frame):
        global _STOP
        _STOP = True
        _log("signal_received", signal=signal.Signals(signum).name,
             note="finishing current cycle, then stopping")

    for sig_name in ("SIGINT", "SIGTERM"):
        sig = getattr(signal, sig_name, None)
        if sig is None:
            continue  # SIGTERM is not always present on Windows
        try:
            signal.signal(sig, _handler)
        except (ValueError, OSError):
            # e.g. not in the main thread; loop still honors KeyboardInterrupt.
            pass


def build_inbox_argv(args: argparse.Namespace) -> list[str]:
    """Translate the watcher's parsed args into the argv `tubeair_inbox.main`
    expects. Pure and side-effect free so it can be asserted directly in tests."""
    argv = [
        "--repo-root", args.repo_root,
        "--inbox", args.inbox,
        "--out", args.out,
        "--state", args.state,
        "--languages", args.languages,
    ]
    if args.handoff:
        argv.append("--handoff")
    if args.dry_run:
        argv.append("--dry-run")
    return argv


def run_once(args: argparse.Namespace) -> int:
    """Drive the inbox pipeline exactly once. Returns the inbox reader's exit code
    (0 = nothing new / all good, 2 = an honest extraction failure to retry)."""
    argv = build_inbox_argv(args)
    _log("cycle_start", inbox=args.inbox, out=args.out, handoff=bool(args.handoff),
         dry_run=bool(args.dry_run))
    code = tubeair_inbox.main(argv)
    _log("cycle_end", exit_code=code)
    return code


def watch(args: argparse.Namespace) -> int:
    """Poll loop. Runs a cycle, sleeps --interval, repeats until stopped by signal,
    --max-cycles, or KeyboardInterrupt. A failure inside one cycle is isolated and
    logged; the watcher keeps running so a transient network blip self-heals on the
    next sweep (the state file guarantees no double-capture)."""
    _install_signal_handlers()
    _log("watch_start", interval_seconds=args.interval,
         max_cycles=(args.max_cycles or "unlimited"))

    cycles = 0
    last_code = 0
    while not _STOP:
        cycles += 1
        try:
            last_code = run_once(args)
        except KeyboardInterrupt:
            _log("interrupted", note="KeyboardInterrupt during cycle")
            break
        except Exception as exc:  # cycle isolation — never let one bad sweep kill the watcher
            last_code = 2
            _log("cycle_error", error=f"{type(exc).__name__}: {exc}",
                 note="isolated; will retry next cycle")

        if args.max_cycles and cycles >= args.max_cycles:
            _log("max_cycles_reached", cycles=cycles)
            break
        if _STOP:
            break

        # Interruptible sleep so a signal during the wait stops promptly.
        slept = 0.0
        while slept < args.interval and not _STOP:
            step = min(0.5, args.interval - slept)
            try:
                time.sleep(step)
            except KeyboardInterrupt:
                _log("interrupted", note="KeyboardInterrupt during sleep")
                _set_stop()
                break
            slept += step

    _log("watch_stop", cycles=cycles, last_exit_code=last_code)
    return last_code


def _set_stop() -> None:
    global _STOP
    _STOP = True


def main(argv: list[str] | None = None) -> int:
    tubeair._force_utf8_console()
    parser = argparse.ArgumentParser(
        prog="tubeair_watch",
        description="Automation link for IDEA-013: watch the capture inbox and drive the "
                    "TubeAIR inbox pipeline so a pasted YouTube link becomes a Karpathy packet.",
    )
    # Run mode.
    parser.add_argument("--once", action="store_true",
                        help="Drive the inbox a single time, then exit (default is a poll loop).")
    parser.add_argument("--interval", type=float, default=30.0,
                        help="Poll interval in seconds between sweeps (default: 30). Ignored with --once.")
    parser.add_argument("--max-cycles", type=int, default=0,
                        help="Stop after N sweeps (0 = run until interrupted). Ignored with --once.")
    # Pass-through inbox flags (mirror tubeair_inbox.py).
    parser.add_argument("--repo-root", default=".", help="Repo root (default: cwd).")
    parser.add_argument("--inbox", default="Team Inbox/captures",
                        help="Inbox dir relative to repo root (default: 'Team Inbox/captures').")
    parser.add_argument("--out", default="out/tubeair", help="Output root (default: out/tubeair).")
    parser.add_argument("--state", default="out/tubeair/_inbox_state.json",
                        help="Idempotency state file (default: out/tubeair/_inbox_state.json).")
    parser.add_argument("--languages", default="en,en-US,en-GB",
                        help="Preferred caption languages.")
    parser.add_argument("--handoff", action="store_true",
                        help="Preserve raw transcript in Sources (Immutable)/ + register for Cairn.")
    parser.add_argument("--dry-run", action="store_true",
                        help="List what would be processed; do not fetch or write packets.")
    args = parser.parse_args(argv)

    if args.interval < 0:
        parser.error("--interval must be >= 0")

    if args.once:
        return run_once(args)
    return watch(args)


if __name__ == "__main__":
    raise SystemExit(main())
