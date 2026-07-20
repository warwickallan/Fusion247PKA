#!/usr/bin/env python3
"""TubeAIR inbox reader (WP-A) — the FusionDevBot → TubeAIR bridge.

Scans the FusionDevBot capture inbox (`Team Inbox/captures/*.md`, written by the
live BUILD-002 fusion-capture-gateway), finds any YouTube URLs in captures it has
not processed before, and runs the existing TubeAIR core on each.

Hard boundaries:
  - READ-ONLY on the inbox. This never creates, edits, moves, or deletes a
    capture file. FusionDevBot / BUILD-002 is not touched in any way.
  - ONE code path with the CLI: it calls tubeair.process_capture, the same
    pipeline `tubeair.py --url` uses.
  - Idempotent: a small state file records which (capture_file, video_id) pairs
    were already processed, so re-running never re-captures the same video.

Usage:
  tools/tubeair/.venv/Scripts/python.exe tools/tubeair/tubeair_inbox.py \
      --repo-root . [--inbox "Team Inbox/captures"] [--handoff] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import tubeair


# ----------------------------------------------------------------------------
# Durable, corruption-safe JSON state (shared by the watcher's retry ledger too)
# ----------------------------------------------------------------------------

class StateCorruptError(RuntimeError):
    """The persisted state (and its `.bak`) could not be read/validated.

    We raise instead of silently starting from an empty set: an empty processed-set
    would make the pipeline re-process — and re-FETCH from YouTube — every video it
    had already captured. A corrupt state must fail LOUDLY (or recover from the
    backup), never degrade to 'process everything again'.
    """


def _backup_path(path: Path) -> Path:
    return path.with_name(path.name + ".bak")


def _is_rotatable(path: Path, validate) -> bool:
    """Decide whether the current primary at ``path`` may be rotated into ``.bak``.

    With no validator (``validate is None``), any existing primary rotates — the
    historical, back-compatible behaviour. With a validator, ONLY a primary that
    parses and passes ``validate`` rotates. A corrupt/invalid primary is refused so it
    can never overwrite a good ``.bak``: after a ``.bak`` recovery the on-disk primary
    is still the corrupt copy, and copying THAT over the good backup would destroy the
    only remaining known-good state (Fix 1 — 'backup rotation destroys the only good
    copy').
    """
    if validate is None:
        return True
    try:
        _read_validated(path, validate)
        return True
    except (OSError, ValueError, json.JSONDecodeError):
        return False


def atomic_write_json(path: Path, data, *, validate=None) -> None:
    """Durably and atomically persist ``data`` as JSON — no torn/partial writes.

    Writes to a sibling ``<name>.tmp.<pid>`` in the SAME directory (so the target
    filesystem matches and ``os.replace`` is atomic on NTFS and POSIX), fsyncs it,
    rotates the current good file to ``<name>.bak`` (copy, not move, so the live file
    is never momentarily absent), then ``os.replace()`` the temp over the target. A
    crash at any point leaves either the intact previous file or a recoverable
    ``.bak`` — the reader never sees a half-written file.

    When ``validate`` is supplied, the current primary is parsed + validated BEFORE it
    is rotated into ``.bak``. A corrupt/invalid primary is NOT copied over the backup,
    so a ``.bak`` that a prior recovery restored from is never clobbered by the very
    corruption it rescued us from. With no validator every existing primary rotates,
    matching the original behaviour.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.tmp.{os.getpid()}")
    text = json.dumps(data, indent=2, ensure_ascii=False)
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        # Keep a last-known-good backup before swapping the new file in — but ONLY if
        # the current primary is itself valid. A corrupt primary must never overwrite a
        # good .bak (that would throw away the last-known-good copy).
        if path.exists() and _is_rotatable(path, validate):
            try:
                shutil.copy2(path, _backup_path(path))
            except OSError:
                pass  # a missing .bak is not fatal; the primary write still lands
        os.replace(tmp, path)  # atomic swap
    finally:
        # Never leave a stray temp behind if os.replace didn't consume it.
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def _read_validated(path: Path, validate) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    validate(data)  # must raise ValueError on a wrong shape
    return data


def load_json_with_backup(path: Path, validate, empty, *, label: str,
                          on_recover=None) -> dict:
    """Fail-loud, backup-aware JSON state loader.

    - Nothing on disk (no primary, no ``.bak``) → genuine first run → ``empty()``.
    - Primary present but corrupt/unreadable/wrong-shape → recover from a valid
      ``.bak`` if one exists, else raise :class:`StateCorruptError`. It NEVER silently
      returns ``empty()`` for a corrupt primary.
    - Primary missing but a valid ``.bak`` exists → recover from ``.bak`` (guards
      against an accidental deletion of the live file).
    """
    bak = _backup_path(path)
    if not path.exists():
        if bak.exists():
            try:
                data = _read_validated(bak, validate)
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                raise StateCorruptError(
                    f"{label}: primary {path} is missing and backup {bak} is corrupt "
                    f"({type(exc).__name__}: {exc}); refusing to start from an empty "
                    f"set.") from exc
            if on_recover:
                on_recover(f"{label}: primary {path} missing; recovered from {bak}")
            return data
        return empty()
    try:
        return _read_validated(path, validate)
    except (OSError, ValueError, json.JSONDecodeError) as primary_exc:
        if bak.exists():
            try:
                data = _read_validated(bak, validate)
            except (OSError, ValueError, json.JSONDecodeError):
                data = None
            if data is not None:
                if on_recover:
                    on_recover(f"{label}: primary {path} corrupt "
                               f"({type(primary_exc).__name__}); recovered from {bak}")
                return data
        raise StateCorruptError(
            f"{label}: {path} is corrupt/unreadable and no valid backup exists "
            f"({type(primary_exc).__name__}: {primary_exc}); refusing to proceed with "
            f"an empty set (that would re-process/re-fetch every video)."
        ) from primary_exc


def _validate_inbox_state(data) -> None:
    if not isinstance(data, dict) or not isinstance(data.get("processed"), dict):
        raise ValueError("inbox state must be a JSON object with a 'processed' object")


def _load_state(state_path: Path) -> dict:
    """Load the idempotency state. Corrupt/unreadable state fails LOUDLY (or recovers
    from ``.bak``) — it is never silently reset to an empty processed-set, which would
    re-fetch every already-captured video from YouTube."""
    return load_json_with_backup(
        state_path, _validate_inbox_state, lambda: {"processed": {}},
        label="TubeAIR inbox state",
        on_recover=lambda msg: print(f"[inbox] WARNING {msg}", file=sys.stderr))


def _save_state(state_path: Path, state: dict) -> None:
    # Pass the inbox-state validator so a corrupt on-disk primary is never rotated over
    # a good .bak (Fix 1). The state saver is the only runtime writer of this file.
    atomic_write_json(state_path, state, validate=_validate_inbox_state)


def scan_inbox(inbox_dir: Path) -> list[tuple[Path, str, str]]:
    """Return [(capture_file, matched_url, video_id), ...] for every YouTube URL
    found across the inbox. READ-ONLY: only reads the capture files."""
    found: list[tuple[Path, str, str]] = []
    if not inbox_dir.exists():
        return found
    for md in sorted(inbox_dir.glob("*.md")):
        if md.name.lower() == "readme.md":
            continue
        try:
            text = md.read_text(encoding="utf-8")
        except OSError:
            continue
        for url, vid in tubeair.find_youtube_urls(text):
            found.append((md, url, vid))
    return found


def main(argv: list[str] | None = None, *, skip_pairs=None) -> int:
    """Scan the inbox and drive TubeAIR on any unprocessed YouTube URL.

    ``skip_pairs`` (watcher-only, optional): an iterable of ``(capture_name, video_id)``
    pairs to treat as 'do not fetch' this run — in ADDITION to the already-processed
    set. The watcher passes the retry-ceiling-EXHAUSTED pairs here so a permanently
    stuck video gets ZERO further egress even when a fresh healthy capture triggers a
    run (Fix 3 — exhausted-capture isolation). A hand-run operator never sets this, so
    CLI behaviour is unchanged.
    """
    tubeair._force_utf8_console()
    parser = argparse.ArgumentParser(
        prog="tubeair_inbox",
        description="Scan the FusionDevBot capture inbox for YouTube URLs and run TubeAIR (read-only on the inbox).",
    )
    parser.add_argument("--repo-root", default=".", help="Repo root (default: cwd).")
    parser.add_argument("--inbox", default="Team Inbox/captures",
                        help="Inbox dir relative to repo root (default: 'Team Inbox/captures').")
    parser.add_argument("--out", default="out/tubeair", help="Output root (default: out/tubeair).")
    parser.add_argument("--state", default="out/tubeair/_inbox_state.json",
                        help="Idempotency state file (default: out/tubeair/_inbox_state.json).")
    parser.add_argument("--languages", default="en,en-US,en-GB",
                        help="Preferred caption languages.")
    parser.add_argument("--handoff", action="store_true",
                        help="WP-D: preserve raw transcript in Sources (Immutable)/ + register for Cairn.")
    parser.add_argument("--dry-run", action="store_true",
                        help="List what would be processed; do not fetch or write packets.")
    args = parser.parse_args(argv)

    repo_root = Path(args.repo_root)
    inbox_dir = repo_root / args.inbox
    state_path = repo_root / args.state
    languages = [x.strip() for x in args.languages.split(",") if x.strip()]

    hits = scan_inbox(inbox_dir)
    state = _load_state(state_path)
    processed = state.setdefault("processed", {})
    skip = {(str(name), str(vid)) for name, vid in (skip_pairs or ())}

    print(f"[inbox] scanning {inbox_dir} (read-only)")
    print(f"[inbox] YouTube URLs found across captures: {len(hits)}")
    if skip:
        print(f"[inbox] watcher-flagged exhausted pairs to skip (zero egress): {len(skip)}")

    todo = []
    for md, url, vid in hits:
        key = md.name
        done_for_file = processed.get(key, [])
        if vid in done_for_file:
            print(f"[inbox] skip (already processed): {md.name} → {vid}")
            continue
        if (md.name, vid) in skip:
            # Retry-ceiling-exhausted per the watcher: do not fetch it even though we
            # are running for a healthy sibling. Cannot exhaust/hammer YouTube.
            print(f"[inbox] skip (retry ceiling exhausted; watcher-flagged): {md.name} → {vid}")
            continue
        todo.append((md, url, vid))

    if not todo:
        print("[inbox] nothing new to process.")
        return 0

    if args.dry_run:
        print(f"[inbox] DRY RUN — would process {len(todo)}:")
        for md, url, vid in todo:
            print(f"           - {md.name} → {url} ({vid})")
        return 0

    exit_code = 0
    for md, url, vid in todo:
        print(f"[inbox] processing {md.name} → {url}")
        note = f"captured via FusionDevBot inbox ({md.name})"
        # Per-capture exception isolation: a single capture that RAISES (network
        # blow-up, extractor crash, disk error mid-write) must not abort the cycle
        # or block the captures queued after it. Its progress-so-far is already
        # durable because we persist state after EACH success below.
        try:
            cap, out_dir, written, handoff_info = tubeair.process_capture(
                url, args.out, note=note, languages=languages, with_metadata=True,
                repo_root=repo_root, handoff=args.handoff,
                channel=f"FusionDevBot inbox ({md.name})")
        except Exception as exc:  # noqa: BLE001 — isolate one bad capture, keep going
            print(f"[inbox]   ERROR processing {md.name} → {vid}: "
                  f"{type(exc).__name__}: {exc} — isolated; remaining captures continue, "
                  f"this one is not marked processed and will retry",
                  file=sys.stderr)
            exit_code = 2
            continue

        print(f"[inbox]   status={cap.transcript_status} segments={cap.segment_count} → {out_dir}")
        if cap.transcript_status == "extracted":
            processed.setdefault(md.name, []).append(vid)  # only mark real successes
            # Persist after EACH successful item so a later raising capture (or a hard
            # process kill) can never lose the progress this cycle already made.
            _save_state(state_path, state)
        else:
            print(f"[inbox]   FAILED honestly [{cap.error_category}] — not marked processed, will retry",
                  file=sys.stderr)
            exit_code = 2

    _save_state(state_path, state)
    print(f"[inbox] state saved: {state_path}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
