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
import sys
from pathlib import Path

import tubeair


def _load_state(state_path: Path) -> dict:
    if state_path.exists():
        try:
            return json.loads(state_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"processed": {}}


def _save_state(state_path: Path, state: dict) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


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


def main(argv: list[str] | None = None) -> int:
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

    print(f"[inbox] scanning {inbox_dir} (read-only)")
    print(f"[inbox] YouTube URLs found across captures: {len(hits)}")

    todo = []
    for md, url, vid in hits:
        key = md.name
        done_for_file = processed.get(key, [])
        if vid in done_for_file:
            print(f"[inbox] skip (already processed): {md.name} → {vid}")
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
        cap, out_dir, written, handoff_info = tubeair.process_capture(
            url, args.out, note=note, languages=languages, with_metadata=True,
            repo_root=repo_root, handoff=args.handoff, channel=f"FusionDevBot inbox ({md.name})")
        print(f"[inbox]   status={cap.transcript_status} segments={cap.segment_count} → {out_dir}")
        if cap.transcript_status == "extracted":
            processed.setdefault(md.name, []).append(vid)  # only mark real successes
        else:
            print(f"[inbox]   FAILED honestly [{cap.error_category}] — not marked processed, will retry",
                  file=sys.stderr)
            exit_code = 2

    _save_state(state_path, state)
    print(f"[inbox] state saved: {state_path}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
