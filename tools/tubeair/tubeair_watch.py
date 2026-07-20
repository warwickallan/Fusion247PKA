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

Do-not-hammer-YouTube guarantee (why this file needs its own state):
  A caption-less / unavailable video makes `tubeair_inbox.main` return exit code 2
  and — correctly — it is NOT marked processed in the inbox state, so a naive
  every-Nth-second poll would re-fetch it from YouTube forever (~2880 req/day per
  stuck video → a realistic IP block that would then kill *all* captures). This
  watcher prevents that with two cooperating mechanisms that stay READ-ONLY on the
  inbox and never fork the inbox's own state:
    1. A watcher-owned retry ledger keyed on (capture_file, video_id). The watcher
       re-derives, before and after each cycle, which pending pairs the inbox would
       fetch (using the inbox's own read-only `scan_inbox` + state), and counts how
       many cycles each pair has failed to become "processed". After
       MAX_RETRIES_PER_VIDEO consecutive failures a pair is "exhausted".
    2. When the ONLY pending work is exhausted (or there is no pending work at all),
       the watcher SKIPS calling the inbox entirely — so a permanently caption-less
       video stops being fetched, with ZERO YouTube egress, while a freshly-landed
       healthy capture (a brand-new pending pair) still triggers a prompt run on the
       very next sweep. One stuck video can neither block others nor hammer YouTube.
  A transient failure (a pair still under the retry ceiling) is retried, but the
  poll interval backs off exponentially (interval·2^n, capped at BACKOFF_CAP_SECONDS
  ≈ 15 min) while cycles keep failing, and resets to the base interval on the first
  clean/idle cycle. Net worst case for a permanently stuck video: at most
  MAX_RETRIES_PER_VIDEO backed-off fetches, then none until new work co-triggers a
  run — orders of magnitude under any IP-block threshold, and healthy captures are
  never starved.

Run modes:
  One-shot (drive the inbox once, then exit):
    python tools/tubeair/tubeair_watch.py --once --repo-root .

  Poll loop (drive the inbox every --interval seconds until Ctrl-C / SIGTERM):
    python tools/tubeair/tubeair_watch.py --interval 30 --repo-root .

  Bounded loop (e.g. tests / cron-style single sweep with a couple of retries):
    python tools/tubeair/tubeair_watch.py --interval 0 --max-cycles 2 --repo-root .

Stopping the poll loop:
  Stop with Ctrl-C (SIGINT) — the watcher finishes the current cycle, then exits
  cleanly. On Windows also send Ctrl-Break (SIGBREAK) if Ctrl-C is swallowed by a
  wrapper. Do NOT `taskkill` / `TerminateProcess` the watcher: Windows'
  TerminateProcess bypasses Python's signal handlers, so the graceful-shutdown path
  never runs. (There is nothing to corrupt — the inbox is read-only and the state
  files are written atomically by their owners — but a hard kill loses the clean
  `watch_stop` log line and any in-flight cycle's completion.)

All inbox flags pass straight through: --inbox, --out, --state, --languages,
--handoff, --dry-run.
"""

from __future__ import annotations

import argparse
import json
import math
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

# Give up auto-retrying a single (capture_file, video_id) after this many
# consecutive failed cycles. A stuck video then stops being fetched (see module
# docstring) instead of hammering YouTube forever.
MAX_RETRIES_PER_VIDEO = 5

# Exponential-backoff ceiling for the poll interval while cycles keep failing.
BACKOFF_CAP_SECONDS = 900.0  # 15 minutes

# Floor for the unbounded-loop sleep so an aggressive --interval can never turn the
# poll loop into a busy-spin against the inbox / YouTube.
MIN_SLEEP_SECONDS = 0.5

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


def _set_stop() -> None:
    global _STOP
    _STOP = True


def _reset_stop() -> None:
    """Clear the module-global stop flag so a second in-process `watch()` call in
    the same interpreter (e.g. back-to-back tests, or an embedding host) is not
    dead-on-arrival because a previous run left `_STOP` set."""
    global _STOP
    _STOP = False


def _install_signal_handlers() -> None:
    def _handler(signum, _frame):
        _set_stop()
        _log("signal_received", signal=signal.Signals(signum).name,
             note="finishing current cycle, then stopping")

    # SIGBREAK is Windows-only (Ctrl-Break); SIGTERM is not always present on
    # Windows. getattr-guard each so this stays cross-platform.
    for sig_name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        sig = getattr(signal, sig_name, None)
        if sig is None:
            continue
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


# ----------------------------------------------------------------------------
# Watcher-owned retry ledger + pending classification (all READ-ONLY on the inbox)
# ----------------------------------------------------------------------------

def _ledger_path(args: argparse.Namespace) -> Path:
    """Co-locate the watcher's retry ledger with the inbox state file. It is the
    watcher's own file — never the inbox's state — so the inbox's 'only mark real
    successes' invariant is never touched."""
    state_full = Path(args.repo_root) / args.state
    return state_full.with_name("_watch_retry.json")


def _validate_ledger(data) -> None:
    if not isinstance(data, dict) or not isinstance(data.get("attempts"), dict):
        raise ValueError("watcher ledger must be a JSON object with an 'attempts' object")


def _ledger_load(path: Path) -> dict:
    """Load the watcher's retry ledger. A corrupt/unreadable ledger fails LOUDLY (or
    recovers from ``.bak``) rather than silently resetting to empty: a silent reset
    would zero every stuck video's attempt count and let it be re-fetched
    MAX_RETRIES_PER_VIDEO more times — re-opening the exact YouTube-hammering hole the
    ledger exists to close. Shares the atomic/backup-aware store with the inbox state
    (SSOT for the durability logic)."""
    return tubeair_inbox.load_json_with_backup(
        path, _validate_ledger, lambda: {"attempts": {}},
        label="TubeAIR watcher retry ledger",
        on_recover=lambda msg: _log("ledger_recovered", note=msg))


def _ledger_save(path: Path, ledger: dict) -> None:
    try:
        # Atomic write + .bak rotation (no torn ledgers). Shared with the inbox state.
        tubeair_inbox.atomic_write_json(path, ledger)
    except OSError as exc:
        # A write failure must not kill the watcher; the next cycle re-persists.
        _log("ledger_save_failed", error=f"{type(exc).__name__}: {exc}")


def _pair_key(capture_name: str, video_id: str) -> str:
    # Windows filenames cannot contain ':', so '::' is a safe, unambiguous joiner.
    return f"{capture_name}::{video_id}"


def _scan_pending(args: argparse.Namespace) -> list[tuple[str, str]] | None:
    """Re-derive, READ-ONLY, the (capture_file, video_id) pairs the inbox would
    fetch this cycle — i.e. YouTube URLs found in captures that are not yet marked
    processed in the inbox's own state. Mirrors `tubeair_inbox.main`'s todo logic by
    reusing the inbox's own `scan_inbox` + `_load_state` (SSOT — no duplicated
    parsing). Returns None if the scan itself fails, meaning 'unknown → run anyway'
    so we never silently starve real work on a transient read error."""
    try:
        repo_root = Path(args.repo_root)
        inbox_dir = repo_root / args.inbox
        state_path = repo_root / args.state
        processed = tubeair_inbox._load_state(state_path).get("processed", {})
        pending: list[tuple[str, str]] = []
        for md, _url, vid in tubeair_inbox.scan_inbox(inbox_dir):
            if vid not in processed.get(md.name, []):
                pending.append((md.name, vid))
        return pending
    except Exception as exc:  # noqa: BLE001 — read-side must never break the loop
        _log("scan_pending_error", error=f"{type(exc).__name__}: {exc}",
             note="treating pending as unknown; will run the cycle")
        return None


def _processed_pairs(args: argparse.Namespace) -> set[tuple[str, str]]:
    """READ-ONLY snapshot of the inbox's processed (capture_file, video_id) pairs."""
    try:
        state_path = Path(args.repo_root) / args.state
        processed = tubeair_inbox._load_state(state_path).get("processed", {})
        return {(name, vid) for name, vids in processed.items() for vid in vids}
    except Exception:  # noqa: BLE001
        return set()


def _next_interval(base: float, consecutive_failures: int) -> float:
    """Exponential backoff: base·2^n while cycles keep failing, capped. n resets to
    0 on the first clean/idle cycle so healthy polling cadence is restored at once."""
    if consecutive_failures <= 0:
        return base
    # Cap the exponent too, so 2**n cannot overflow on a very long outage.
    exp = min(consecutive_failures, 20)
    return min(base * (2 ** exp), BACKOFF_CAP_SECONDS)


def _interruptible_sleep(seconds: float) -> None:
    """Sleep in <=0.5s steps so a signal during the wait stops the loop promptly.
    Extracted (and monkeypatchable) so tests can drive the loop without real waits."""
    slept = 0.0
    while slept < seconds and not _STOP:
        step = min(0.5, seconds - slept)
        try:
            time.sleep(step)
        except KeyboardInterrupt:
            _log("interrupted", note="KeyboardInterrupt during sleep")
            _set_stop()
            break
        slept += step


def watch(args: argparse.Namespace) -> int:
    """Poll loop. Each cycle: re-derive pending work (read-only), decide whether to
    drive the inbox, run it under error-isolation, update the retry ledger from the
    inbox's own post-cycle state, then sleep with failure-driven exponential backoff.

    Stopped by SIGINT/SIGTERM/SIGBREAK, --max-cycles, or KeyboardInterrupt. A failure
    inside one cycle is isolated and logged; the watcher keeps running so a transient
    blip self-heals on a later sweep (the inbox state guarantees no double-capture)."""
    _reset_stop()  # a prior in-process run must not leave us dead-on-arrival
    _install_signal_handlers()
    ledger_path = _ledger_path(args)
    ledger = _ledger_load(ledger_path)
    attempts: dict = ledger["attempts"]

    _log("watch_start", interval_seconds=args.interval,
         max_cycles=(args.max_cycles or "unlimited"),
         max_retries_per_video=MAX_RETRIES_PER_VIDEO,
         backoff_cap_seconds=BACKOFF_CAP_SECONDS,
         stop_hint="Ctrl-C (not taskkill on Windows)")

    cycles = 0
    last_code = 0
    consecutive_failures = 0

    while not _STOP:
        cycles += 1

        pending = _scan_pending(args)
        # Classify pending into fresh (still worth retrying) vs exhausted.
        if pending is None:
            fresh, exhausted = None, None
            run_inbox = True  # unknown → drive the inbox rather than starve work
        else:
            fresh = [p for p in pending
                     if attempts.get(_pair_key(*p), 0) < MAX_RETRIES_PER_VIDEO]
            exhausted = [p for p in pending
                         if attempts.get(_pair_key(*p), 0) >= MAX_RETRIES_PER_VIDEO]
            # Run only when there is fresh work. No pending, or only exhausted-stuck
            # pending → SKIP the inbox (zero YouTube egress) and just keep polling.
            run_inbox = bool(fresh)

        errored = False
        if run_inbox:
            try:
                last_code = run_once(args)
            except KeyboardInterrupt:
                _log("interrupted", note="KeyboardInterrupt during cycle")
                break
            except Exception as exc:  # cycle isolation — one bad sweep must not kill the watcher
                errored = True
                last_code = 2
                _log("cycle_error", error=f"{type(exc).__name__}: {exc}",
                     note="isolated; will retry next cycle")

            # Update the retry ledger from the inbox's own post-cycle state: any
            # pair we attempted that is now processed = success (clear); still
            # pending = one more failed attempt.
            if pending is not None:
                processed_after = _processed_pairs(args)
                for pair in pending:
                    key = _pair_key(*pair)
                    if pair in processed_after:
                        attempts.pop(key, None)
                    else:
                        attempts[key] = attempts.get(key, 0) + 1
                        if attempts[key] == MAX_RETRIES_PER_VIDEO:
                            _log("retry_exhausted", capture=pair[0], video_id=pair[1],
                                 attempts=attempts[key],
                                 note="giving up auto-retry; stops hammering YouTube")
                _ledger_save(ledger_path, ledger)
        else:
            # Nothing worth fetching — do not touch YouTube.
            last_code = 0
            _log("cycle_skipped",
                 pending=(0 if pending is None else len(pending)),
                 exhausted=(0 if not exhausted else len(exhausted)),
                 note="no fresh work; skipped inbox run (no YouTube egress)")

        # Cadence: a real failure this cycle backs the interval off exponentially;
        # a clean or skipped/idle cycle resets it so healthy captures poll promptly.
        cycle_failed = run_inbox and (errored or last_code == 2)
        consecutive_failures = consecutive_failures + 1 if cycle_failed else 0

        if args.max_cycles and cycles >= args.max_cycles:
            _log("max_cycles_reached", cycles=cycles)
            break
        if _STOP:
            break

        sleep_for = _next_interval(args.interval, consecutive_failures)
        if not args.max_cycles:  # unbounded loop — floor the sleep, never busy-spin
            sleep_for = max(sleep_for, MIN_SLEEP_SECONDS)
        if cycle_failed:
            _log("backoff", consecutive_failures=consecutive_failures,
                 next_interval_seconds=sleep_for)
        _interruptible_sleep(sleep_for)

    _log("watch_stop", cycles=cycles, last_exit_code=last_code)
    return last_code


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

    # --- Interval / cycle-count validation (fail fast and loud) ---
    if math.isnan(args.interval) or math.isinf(args.interval):
        parser.error("--interval must be a finite number (got NaN/inf)")
    if args.interval < 0:
        parser.error("--interval must be >= 0")
    if args.max_cycles < 0:
        parser.error("--max-cycles must be >= 0 (0 = run until interrupted)")
    # interval==0 in an unbounded poll loop would busy-spin against YouTube. Only
    # allow 0 for a single shot (--once) or a bounded run (--max-cycles).
    if args.interval == 0 and not (args.once or args.max_cycles):
        parser.error("--interval 0 requires --once or --max-cycles (an unbounded "
                     "zero-interval loop would hammer YouTube)")

    if args.once:
        return run_once(args)
    return watch(args)


if __name__ == "__main__":
    raise SystemExit(main())
