"""End-to-end tests for the TubeAIR watcher/runner (IDEA-013 automation link).

Proves the missing automation link: a synthetic capture that contains a YouTube
link, dropped into a temp fixture inbox, is driven through the *watcher* (not a
hand-run of the core) and comes out the other side as a valid Karpathy packet —
YAML frontmatter + the eight sections + the §7 timestamped transcript.

Keyless and offline: the only egress the pipeline has is `tubeair.fetch_transcript`
(public YouTube captions) and `tubeair.fetch_metadata` (yt-dlp). Both are
monkeypatched to a deterministic fixture transcript, so the test needs no network,
no API key and no bot — it exercises the real capture→packet code path with fixture
input. `tubeair.py` and `test_tubeair.py` are untouched.

Run:  tools/tubeair/.venv/Scripts/python.exe -m pytest tools/tubeair/test_tubeair_watch.py -q
or:   python -m unittest tools.tubeair.test_tubeair_watch   (from repo root, tools/tubeair on path)
"""

import json
import tempfile
import unittest
from pathlib import Path

import tubeair
import tubeair_inbox
import tubeair_watch

VIDEO_ID = "dQw4w9WgXcQ"
VIDEO_ID2 = "abcdefghijk"  # a second healthy 11-char id (fixture resolves any non-stuck id)
STUCK_VIDEO_ID = "stuckVIDEO0"  # 11-char valid YouTube id whose captions never resolve
RAISE_VIDEO_ID = "raiseVIDEO0"  # 11-char valid id whose fetch RAISES (a crashing capture)

# The deterministic fixture transcript that stands in for a real YouTube fetch.
_FIXTURE_SNIPPETS = [
    {"text": "Welcome to the agentic OS build walkthrough.", "start": 0.0, "duration": 3.5},
    {"text": "First we wire the capture inbox to the transcript tool.", "start": 12.0, "duration": 4.0},
    {"text": "Then the packet is handed to the review agent.", "start": 30.0, "duration": 3.0},
]


def _fake_fetch_transcript(video_id, languages):
    return {
        "status": "extracted",
        "source": "manual_captions",
        "language": "English",
        "language_code": "en",
        "snippets": list(_FIXTURE_SNIPPETS),
        "error_category": None,
        "error_detail": None,
        "retry_recommendation": None,
    }


def _fake_fetch_metadata(video_id):
    return {
        "title": "Agentic OS Build Walkthrough",
        "channel": "Fixture Channel",
        "upload_date": "20260706",
        "duration_seconds": 40,
    }


def _synthetic_capture_text(capture_id="synthetic-0001", video_id=VIDEO_ID):
    return (
        f"# Capture {capture_id}\n\n"
        f"- capture_id: {capture_id}\n"
        f"- source_channel: telegram\n"
        f"- recorded_intent: SaveToBrain\n"
        f"- technical_source_type: text\n\n"
        f"Larry, grab the transcript for this one: "
        f"https://www.youtube.com/watch?v={video_id} — might be useful for the build\n"
    )


class _WatcherE2EBase(unittest.TestCase):
    """Shared temp-inbox harness with the transcript fetch stubbed to a fixture."""

    def setUp(self):
        # Stub the two network calls at their module-global home so build_capture
        # (which looks them up as module globals) uses the fixture.
        self._orig_fetch = tubeair.fetch_transcript
        self._orig_meta = tubeair.fetch_metadata
        tubeair.fetch_transcript = _fake_fetch_transcript
        tubeair.fetch_metadata = _fake_fetch_metadata

        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.inbox = self.root / "inbox"
        self.inbox.mkdir(parents=True)
        (self.inbox / "synthetic-0001.md").write_text(
            _synthetic_capture_text(), encoding="utf-8")
        self.out = self.root / "out"
        self.state = self.root / "state.json"

    def tearDown(self):
        tubeair.fetch_transcript = self._orig_fetch
        tubeair.fetch_metadata = self._orig_meta
        self._tmp.cleanup()

    def _base_argv(self, *extra):
        return [
            "--repo-root", str(self.root),
            "--inbox", "inbox",
            "--out", str(self.out),
            "--state", str(self.state),
            *extra,
        ]

    def _packet_reports(self):
        return sorted(self.out.glob("*/TubeAIR Report - *.md"))


class TestWatcherOnceEndToEnd(_WatcherE2EBase):
    def setUp(self):
        super().setUp()
        self.code = tubeair_watch.main(self._base_argv("--once"))
        reports = self._packet_reports()
        self.assertEqual(len(reports), 1, f"expected exactly one packet, got {reports}")
        self.report = reports[0]
        self.md = self.report.read_text(encoding="utf-8")

    def test_exit_code_ok(self):
        self.assertEqual(self.code, 0)

    def test_frontmatter_is_karpathy_packet(self):
        # Frontmatter block + the packet_type marker + the routing fields.
        self.assertTrue(self.md.startswith("---\n"), "no YAML frontmatter block")
        self.assertIn("packet_type: tubeair_report", self.md)
        self.assertIn("source_type: youtube_transcript", self.md)
        self.assertIn(f"video_id: {VIDEO_ID}", self.md)
        self.assertIn("transcript_status: extracted", self.md)
        self.assertIn("fusion_review_status: pending_cairn", self.md)
        self.assertIn("\nnext_agent: cairn\n", self.md)

    def test_all_eight_sections_present_in_order(self):
        headings = [
            "## 1. Executive Summary",
            "## 2. Why This Is Relevant to Warwick",
            "## 3. Business / Monetisation Ideas",
            "## 4. Larry & Team Learning Points",
            "## 5. Recommendations / Possible Follow-ups",
            "## 6. Source Metadata",
            "## 7. Full Transcript",
            "## 8. Run / Processing Notes",
        ]
        positions = [self.md.find(h) for h in headings]
        for h, p in zip(headings, positions):
            self.assertNotEqual(p, -1, f"missing section: {h}")
        self.assertEqual(positions, sorted(positions), "sections out of order")

    def test_warwick_decision_block_present(self):
        self.assertIn("## Warwick Decision Block", self.md)
        self.assertIn("No automatic living-knowledge update", self.md)

    def test_section7_has_timestamped_fixture_transcript(self):
        # §7 must carry the fixture transcript verbatim, with timestamps.
        self.assertIn("[00:00] Welcome to the agentic OS build walkthrough.", self.md)
        self.assertIn("[00:12] First we wire the capture inbox to the transcript tool.", self.md)
        self.assertIn("[00:30] Then the packet is handed to the review agent.", self.md)

    def test_manifest_written_alongside(self):
        self.assertTrue((self.report.parent / "manifest.json").exists())


class TestWatcherPollLoopIdempotent(_WatcherE2EBase):
    """The poll loop must be safe to run repeatedly: cycle 1 produces the packet,
    cycle 2 finds nothing new (state file prevents a re-capture)."""

    def test_two_cycles_produce_one_packet(self):
        code = tubeair_watch.main(self._base_argv("--interval", "0", "--max-cycles", "2"))
        self.assertEqual(code, 0)
        reports = self._packet_reports()
        self.assertEqual(len(reports), 1, f"loop should not double-write: {reports}")
        # State recorded the processed (capture, video) pair.
        self.assertTrue(self.state.exists())
        self.assertIn(VIDEO_ID, self.state.read_text(encoding="utf-8"))


class TestWatcherDryRun(_WatcherE2EBase):
    def test_dry_run_writes_no_packet(self):
        code = tubeair_watch.main(self._base_argv("--once", "--dry-run"))
        self.assertEqual(code, 0)
        self.assertEqual(self._packet_reports(), [], "dry-run must not write a packet")


class TestBuildInboxArgv(unittest.TestCase):
    """The watcher must forward every inbox flag through the single code path."""

    def _args(self, **over):
        import argparse
        base = dict(repo_root=".", inbox="Team Inbox/captures", out="out/tubeair",
                    state="out/tubeair/_inbox_state.json", languages="en",
                    handoff=False, dry_run=False)
        base.update(over)
        return argparse.Namespace(**base)

    def test_passes_core_flags(self):
        argv = tubeair_watch.build_inbox_argv(self._args())
        for flag in ("--repo-root", "--inbox", "--out", "--state", "--languages"):
            self.assertIn(flag, argv)
        self.assertNotIn("--handoff", argv)
        self.assertNotIn("--dry-run", argv)

    def test_passes_handoff_and_dry_run_when_set(self):
        argv = tubeair_watch.build_inbox_argv(self._args(handoff=True, dry_run=True))
        self.assertIn("--handoff", argv)
        self.assertIn("--dry-run", argv)


# ---------------------------------------------------------------------------
# Fix 1 — backoff + watcher-owned retry ledger (the do-not-hammer-YouTube guard)
# Fix 5 — coverage for stuck-backs-off / healthy-still-processes / isolation
# ---------------------------------------------------------------------------

def _fail_fetch_transcript(video_id, languages):
    """A caption-less / unavailable video: an *honest* failure (not a crash).
    The core still writes a packet, but transcript_status != 'extracted', so the
    inbox returns exit code 2 and does NOT mark it processed → it stays pending."""
    return {
        "status": "unavailable",
        "source": None,
        "language": None,
        "language_code": None,
        "snippets": [],
        "error_category": "no_captions",
        "error_detail": "fixture: captionless / unavailable",
        "retry_recommendation": "manual",
    }


class _StuckHealthyBase(unittest.TestCase):
    """Temp inbox where the transcript fetch is dispatched per video_id: STUCK_VIDEO_ID
    always fails honestly; every other id resolves to the fixture. Every fetch is
    counted so tests can assert the watcher stops hammering YouTube."""

    def setUp(self):
        self.fetch_counts = {}
        self._orig_fetch = tubeair.fetch_transcript
        self._orig_meta = tubeair.fetch_metadata

        def _dispatch(video_id, languages):
            self.fetch_counts[video_id] = self.fetch_counts.get(video_id, 0) + 1
            if video_id == STUCK_VIDEO_ID:
                return _fail_fetch_transcript(video_id, languages)
            return _fake_fetch_transcript(video_id, languages)

        tubeair.fetch_transcript = _dispatch
        tubeair.fetch_metadata = _fake_fetch_metadata

        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.inbox = self.root / "inbox"
        self.inbox.mkdir(parents=True)
        self.out = self.root / "out"
        self.state = self.root / "state.json"

    def tearDown(self):
        tubeair.fetch_transcript = self._orig_fetch
        tubeair.fetch_metadata = self._orig_meta
        tubeair_watch._reset_stop()
        self._tmp.cleanup()

    def _add_capture(self, capture_id, video_id):
        (self.inbox / f"{capture_id}.md").write_text(
            _synthetic_capture_text(capture_id, video_id), encoding="utf-8")

    def _base_argv(self, *extra):
        return ["--repo-root", str(self.root), "--inbox", "inbox",
                "--out", str(self.out), "--state", str(self.state), *extra]

    def _reports_for(self, video_id):
        return sorted(self.out.glob(f"*/TubeAIR Report *{video_id}.md"))

    def _patch_sleep_recorder(self):
        """Replace the interruptible sleep with a no-wait recorder; return the list
        of requested sleep durations so backoff growth can be asserted directly."""
        recorded = []
        orig = tubeair_watch._interruptible_sleep
        tubeair_watch._interruptible_sleep = lambda s: recorded.append(s)
        self.addCleanup(setattr, tubeair_watch, "_interruptible_sleep", orig)
        return recorded


class TestStuckCaptureBacksOff(_StuckHealthyBase):
    def test_interval_grows_exponentially_while_failing(self):
        self._add_capture("stuck", STUCK_VIDEO_ID)
        recorded = self._patch_sleep_recorder()
        code = tubeair_watch.main(self._base_argv("--interval", "1", "--max-cycles", "4"))
        # 4 cycles all fail (attempts 1..4 < ceiling), sleeps after cycles 1..3.
        self.assertEqual(recorded, [2.0, 4.0, 8.0], "interval must back off base*2^n")
        self.assertEqual(code, 2, "a failing cycle propagates the inbox's exit code 2")
        # The stuck video was never marked processed.
        self.assertNotIn(STUCK_VIDEO_ID, self.state.read_text(encoding="utf-8"))


class TestStuckCaptureExhaustsAndStopsFetching(_StuckHealthyBase):
    def test_fetch_count_caps_at_retry_ceiling(self):
        self._add_capture("stuck", STUCK_VIDEO_ID)
        self._patch_sleep_recorder()
        code = tubeair_watch.main(self._base_argv("--interval", "1", "--max-cycles", "8"))
        # After MAX_RETRIES_PER_VIDEO failed cycles the pair is exhausted and the
        # watcher SKIPS the inbox — so YouTube is hit exactly the ceiling, not once
        # per cycle. This is the anti-IP-block guarantee.
        self.assertEqual(self.fetch_counts.get(STUCK_VIDEO_ID),
                         tubeair_watch.MAX_RETRIES_PER_VIDEO,
                         "a permanently stuck video must stop being fetched after the ceiling")
        # Last cycles were skips → cadence reset → clean exit code.
        self.assertEqual(code, 0)


class TestHealthyProcessesAlongsideStuck(_StuckHealthyBase):
    def test_healthy_capture_not_starved_by_a_stuck_sibling(self):
        self._add_capture("stuck", STUCK_VIDEO_ID)
        self._add_capture("healthy", VIDEO_ID)
        self._patch_sleep_recorder()
        code = tubeair_watch.main(self._base_argv("--interval", "0", "--max-cycles", "1"))
        # Healthy capture produced its packet in the very first cycle...
        self.assertEqual(len(self._reports_for(VIDEO_ID)), 1,
                         "healthy capture must process promptly despite a stuck sibling")
        # ...and only the healthy one was marked processed; the stuck one stays pending.
        state_txt = self.state.read_text(encoding="utf-8")
        self.assertIn(VIDEO_ID, state_txt)
        self.assertNotIn(STUCK_VIDEO_ID, state_txt)
        self.assertEqual(code, 2, "the co-pending stuck failure still surfaces exit 2")


class TestFailedFetchContinues(_StuckHealthyBase):
    def test_loop_survives_consecutive_honest_failures(self):
        self._add_capture("stuck", STUCK_VIDEO_ID)
        self._patch_sleep_recorder()
        code = tubeair_watch.main(self._base_argv("--interval", "0", "--max-cycles", "3"))
        # All three cycles ran (attempts still under the ceiling) and none killed
        # the watcher — an exit-2 cycle is isolated and retried.
        self.assertEqual(self.fetch_counts.get(STUCK_VIDEO_ID), 3)
        self.assertEqual(code, 2)


class TestSignalAndErrorIsolation(_StuckHealthyBase):
    def test_keyboardinterrupt_during_cycle_stops_gracefully(self):
        self._add_capture("healthy", VIDEO_ID)
        orig = tubeair_inbox.main

        def _ki(argv):
            raise KeyboardInterrupt()

        tubeair_inbox.main = _ki
        self.addCleanup(setattr, tubeair_inbox, "main", orig)
        self._patch_sleep_recorder()
        # Offline: no real signal needed — a KeyboardInterrupt raised inside the
        # cycle is the same path SIGINT drives. The watcher must break, not hang.
        code = tubeair_watch.main(self._base_argv("--interval", "0", "--max-cycles", "5"))
        self.assertEqual(code, 0)

    def test_signal_stop_between_cycles_ends_loop(self):
        self._add_capture("healthy", VIDEO_ID)
        recorded = []

        def _sleep_then_stop(seconds):
            recorded.append(seconds)
            tubeair_watch._set_stop()  # simulate SIGINT arriving during the wait

        orig = tubeair_watch._interruptible_sleep
        tubeair_watch._interruptible_sleep = _sleep_then_stop
        self.addCleanup(setattr, tubeair_watch, "_interruptible_sleep", orig)

        code = tubeair_watch.main(self._base_argv("--interval", "1", "--max-cycles", "5"))
        self.assertEqual(len(recorded), 1, "a stop during the first sleep must end the loop")
        self.assertEqual(len(self._reports_for(VIDEO_ID)), 1, "the first cycle still processed")
        self.assertEqual(code, 0)

    def test_injected_exception_is_isolated_and_loop_continues(self):
        self._add_capture("healthy", VIDEO_ID)
        real = tubeair_inbox.main
        seq = {"n": 0}

        def _flaky(argv):
            seq["n"] += 1
            if seq["n"] == 1:
                raise RuntimeError("injected boom")
            return real(argv)

        tubeair_inbox.main = _flaky
        self.addCleanup(setattr, tubeair_inbox, "main", real)
        self._patch_sleep_recorder()

        code = tubeair_watch.main(self._base_argv("--interval", "0", "--max-cycles", "3"))
        # Cycle 1 crashed and was isolated; cycle 2 processed the healthy capture.
        self.assertGreaterEqual(seq["n"], 2)
        self.assertEqual(len(self._reports_for(VIDEO_ID)), 1,
                         "watcher must survive a cycle exception and process on a later sweep")
        self.assertEqual(code, 0)


class TestIntervalValidation(unittest.TestCase):
    """Fix 2 — interval==0 footgun, NaN interval, negative --max-cycles."""

    def _expect_error(self, argv):
        with self.assertRaises(SystemExit):
            tubeair_watch.main(argv)

    def test_zero_interval_unbounded_is_rejected(self):
        self._expect_error(["--interval", "0"])

    def test_zero_interval_ok_with_once(self):
        # Parses fine (routes to run_once) — no SystemExit at validation. We stub the
        # inbox so this is fully offline.
        orig = tubeair_inbox.main
        tubeair_inbox.main = lambda argv: 0
        self.addCleanup(setattr, tubeair_inbox, "main", orig)
        self.assertEqual(tubeair_watch.main(["--interval", "0", "--once"]), 0)

    def test_zero_interval_ok_with_max_cycles(self):
        orig = tubeair_inbox.main
        tubeair_inbox.main = lambda argv: 0
        self.addCleanup(setattr, tubeair_inbox, "main", orig)
        # Bounded loop with interval 0 is allowed; no real sleeping (max-cycles=1).
        self.assertIn(tubeair_watch.main(["--interval", "0", "--max-cycles", "1"]), (0, 2))

    def test_nan_interval_is_rejected(self):
        self._expect_error(["--interval", "nan", "--max-cycles", "1"])

    def test_inf_interval_is_rejected(self):
        self._expect_error(["--interval", "inf", "--max-cycles", "1"])

    def test_negative_interval_is_rejected(self):
        self._expect_error(["--interval", "-5", "--max-cycles", "1"])

    def test_negative_max_cycles_is_rejected(self):
        self._expect_error(["--interval", "1", "--max-cycles", "-1"])


# ---------------------------------------------------------------------------
# Fix 1 + Fix 2 — atomic writes + corrupt-state fails visibly/safely (never empty)
# ---------------------------------------------------------------------------

class TestAtomicWriteAndCorruptInboxState(unittest.TestCase):
    """Fix 1 (atomic writes) + Fix 2 (corrupt state fails loud, never silently empty)
    for the INBOX state file. The store is shared with the watcher ledger, so proving
    it here covers the durability logic both depend on."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        # A nested path so we also prove atomic_write_json creates parent dirs.
        self.state = self.root / "sub" / "state.json"

    def tearDown(self):
        self._tmp.cleanup()

    def _bak(self):
        return self.state.with_name(self.state.name + ".bak")

    def test_atomic_write_creates_file_and_leaves_no_tempfile(self):
        tubeair_inbox.atomic_write_json(self.state, {"processed": {"a.md": ["dQw4w9WgXcQ"]}})
        self.assertTrue(self.state.exists())
        self.assertEqual(tubeair_inbox._load_state(self.state)["processed"]["a.md"],
                         ["dQw4w9WgXcQ"])
        leftovers = list(self.state.parent.glob("*.tmp*"))
        self.assertEqual(leftovers, [], f"atomic write must clean up its temp: {leftovers}")

    def test_second_write_rotates_last_known_good_backup(self):
        tubeair_inbox.atomic_write_json(self.state, {"processed": {"a": ["v1"]}})
        tubeair_inbox.atomic_write_json(self.state, {"processed": {"a": ["v1", "v2"]}})
        self.assertTrue(self._bak().exists(), "second write must leave a .bak of prior good state")
        # The .bak holds the FIRST write (last-known-good before the second landed).
        self.assertEqual(json.loads(self._bak().read_text("utf-8"))["processed"]["a"], ["v1"])
        # Primary holds the latest.
        self.assertEqual(tubeair_inbox._load_state(self.state)["processed"]["a"], ["v1", "v2"])

    def test_corrupt_state_raises_never_silent_empty(self):
        self.state.parent.mkdir(parents=True, exist_ok=True)
        self.state.write_text("{ this is not valid json ", encoding="utf-8")
        with self.assertRaises(tubeair_inbox.StateCorruptError):
            tubeair_inbox._load_state(self.state)

    def test_wrong_shape_state_is_treated_as_corrupt(self):
        self.state.parent.mkdir(parents=True, exist_ok=True)
        self.state.write_text('{"processed": [1, 2, 3]}', encoding="utf-8")  # list, not object
        with self.assertRaises(tubeair_inbox.StateCorruptError):
            tubeair_inbox._load_state(self.state)

    def test_corrupt_primary_recovers_from_backup(self):
        tubeair_inbox.atomic_write_json(self.state, {"processed": {"a": ["v1"]}})
        tubeair_inbox.atomic_write_json(self.state, {"processed": {"a": ["v1", "v2"]}})
        # Corrupt only the primary; the .bak still holds a valid last-known-good.
        self.state.write_text("GARBAGE", encoding="utf-8")
        recovered = tubeair_inbox._load_state(self.state)
        self.assertEqual(recovered["processed"]["a"], ["v1"],
                         "must recover the last-known-good set, not reset to empty")

    def test_missing_primary_with_valid_backup_recovers(self):
        tubeair_inbox.atomic_write_json(self.state, {"processed": {"a": ["v1"]}})
        tubeair_inbox.atomic_write_json(self.state, {"processed": {"a": ["v1", "v2"]}})
        self.state.unlink()  # accidental deletion of the live file
        recovered = tubeair_inbox._load_state(self.state)
        self.assertIn("a", recovered["processed"],
                      "a deleted primary with a good backup must recover, not start empty")

    def test_truly_fresh_returns_empty_not_error(self):
        # No primary, no backup → genuine first run → empty set (NOT an error).
        self.assertEqual(tubeair_inbox._load_state(self.state), {"processed": {}})


class TestWatcherLedgerDurability(unittest.TestCase):
    """Fix 1 + Fix 2 for the WATCHER retry ledger: atomic writes, and a corrupt ledger
    fails loud / recovers from .bak — never silently resets the anti-hammer counters."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.ledger = self.root / "out" / "_watch_retry.json"

    def tearDown(self):
        self._tmp.cleanup()

    def _bak(self):
        return self.ledger.with_name(self.ledger.name + ".bak")

    def test_ledger_save_is_atomic_and_rotates_backup(self):
        tubeair_watch._ledger_save(self.ledger, {"attempts": {"k": 1}})
        tubeair_watch._ledger_save(self.ledger, {"attempts": {"k": 2}})
        self.assertTrue(self._bak().exists(), "second ledger save must leave a .bak")
        self.assertEqual(list(self.ledger.parent.glob("*.tmp*")), [],
                         "atomic ledger write must clean up its temp")
        self.assertEqual(tubeair_watch._ledger_load(self.ledger)["attempts"]["k"], 2)

    def test_corrupt_ledger_raises_never_silent_empty(self):
        self.ledger.parent.mkdir(parents=True, exist_ok=True)
        self.ledger.write_text("not json at all", encoding="utf-8")
        with self.assertRaises(tubeair_inbox.StateCorruptError):
            tubeair_watch._ledger_load(self.ledger)

    def test_corrupt_ledger_recovers_from_backup(self):
        tubeair_watch._ledger_save(self.ledger, {"attempts": {"k": 1}})
        tubeair_watch._ledger_save(self.ledger, {"attempts": {"k": 2}})
        self.ledger.write_text("GARBAGE", encoding="utf-8")  # corrupt the primary only
        recovered = tubeair_watch._ledger_load(self.ledger)
        self.assertEqual(recovered["attempts"]["k"], 1,
                         "a corrupt ledger must recover prior counters, not zero them")

    def test_fresh_ledger_is_empty_not_error(self):
        self.assertEqual(tubeair_watch._ledger_load(self.ledger), {"attempts": {}})


# ---------------------------------------------------------------------------
# Fix 3 + Fix 4 — per-capture isolation in the inbox loop, and PROOF that a
# raising capture cannot starve/exhaust a healthy sibling.
# ---------------------------------------------------------------------------

class _RaisingHealthyBase(unittest.TestCase):
    """Temp inbox where the transcript fetch RAISES for RAISE_VIDEO_ID (an actual
    exception mid-capture, not an honest 'no captions' failure) and resolves to the
    fixture for every other id. Every fetch is counted."""

    def setUp(self):
        self.fetch_counts = {}
        self._orig_fetch = tubeair.fetch_transcript
        self._orig_meta = tubeair.fetch_metadata

        def _dispatch(video_id, languages):
            self.fetch_counts[video_id] = self.fetch_counts.get(video_id, 0) + 1
            if video_id == RAISE_VIDEO_ID:
                raise RuntimeError("fixture: transcript fetch blew up mid-capture")
            return _fake_fetch_transcript(video_id, languages)

        tubeair.fetch_transcript = _dispatch
        tubeair.fetch_metadata = _fake_fetch_metadata

        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.inbox = self.root / "inbox"
        self.inbox.mkdir(parents=True)
        self.out = self.root / "out"
        self.state = self.root / "state.json"

    def tearDown(self):
        tubeair.fetch_transcript = self._orig_fetch
        tubeair.fetch_metadata = self._orig_meta
        tubeair_watch._reset_stop()
        self._tmp.cleanup()

    def _add_capture(self, capture_id, video_id):
        # capture_id is also the filename stem, so it controls scan_inbox sort order.
        (self.inbox / f"{capture_id}.md").write_text(
            _synthetic_capture_text(capture_id, video_id), encoding="utf-8")

    def _inbox_argv(self, *extra):
        return ["--repo-root", str(self.root), "--inbox", "inbox",
                "--out", str(self.out), "--state", str(self.state), *extra]

    def _reports_for(self, video_id):
        return sorted(self.out.glob(f"*/TubeAIR Report *{video_id}.md"))


class TestInboxPerCaptureIsolation(_RaisingHealthyBase):
    def test_raising_capture_isolated_healthy_after_it_still_persists(self):
        # The RAISING capture sorts BEFORE the healthy one ('aaa' < 'zzz'), so it is
        # processed FIRST. It must not abort the loop or block the healthy sibling.
        self._add_capture("aaa-raises", RAISE_VIDEO_ID)
        self._add_capture("zzz-healthy", VIDEO_ID)

        code = tubeair_inbox.main(self._inbox_argv())

        # The crashing capture surfaces as a retryable non-zero exit...
        self.assertEqual(code, 2)
        # ...but the healthy sibling queued AFTER it still produced its packet.
        self.assertEqual(len(self._reports_for(VIDEO_ID)), 1,
                         "healthy capture must process despite an earlier raising sibling")
        # Its success is PERSISTED; the raising one is NOT marked processed.
        state_txt = self.state.read_text(encoding="utf-8")
        self.assertIn(VIDEO_ID, state_txt)
        self.assertNotIn(RAISE_VIDEO_ID, state_txt)
        # Each was attempted exactly once — the raise neither short-circuited the loop
        # nor caused the healthy capture to be re-driven.
        self.assertEqual(self.fetch_counts.get(RAISE_VIDEO_ID), 1)
        self.assertEqual(self.fetch_counts.get(VIDEO_ID), 1)

    def test_state_is_flushed_after_each_success_not_only_at_end(self):
        # Two healthy captures with a RAISING capture wedged BETWEEN them. If state
        # were only saved once at the very end, a crash mid-loop would lose the first
        # success — so we assert the saver is invoked per-success (incrementally).
        self._add_capture("aaa-good", VIDEO_ID)
        self._add_capture("mmm-raises", RAISE_VIDEO_ID)
        self._add_capture("zzz-good", VIDEO_ID2)

        saves = {"n": 0}
        real_save = tubeair_inbox._save_state

        def _counting_save(sp, st):
            saves["n"] += 1
            return real_save(sp, st)

        tubeair_inbox._save_state = _counting_save
        self.addCleanup(setattr, tubeair_inbox, "_save_state", real_save)

        code = tubeair_inbox.main(self._inbox_argv())

        self.assertEqual(code, 2, "the wedged raising capture still surfaces exit 2")
        # Both healthy packets exist and both are persisted; the raise is not.
        self.assertEqual(len(self._reports_for(VIDEO_ID)), 1)
        self.assertEqual(len(self._reports_for(VIDEO_ID2)), 1)
        state_txt = self.state.read_text(encoding="utf-8")
        self.assertIn(VIDEO_ID, state_txt)
        self.assertIn(VIDEO_ID2, state_txt)
        self.assertNotIn(RAISE_VIDEO_ID, state_txt)
        # >= one save per success proves incremental persistence (2 successes here),
        # not a single end-of-loop write.
        self.assertGreaterEqual(saves["n"], 2,
                                "state must be flushed after each successful capture")


class TestRaisingCaptureDoesNotStarveHealthySibling(_RaisingHealthyBase):
    """Fix 4 — the starvation/exhaustion proof at the WATCHER level. A capture whose
    fetch RAISES, sorted BEFORE a healthy one, is driven through the watcher across
    several cycles. The healthy pair must process on the first sweep, persist, and be
    CLEARED from the retry ledger; the raising pair accrues attempts and eventually
    exhausts and stops being fetched — it must never starve or exhaust the healthy
    pair, nor keep the watcher hammering YouTube."""

    def _watch_argv(self, *extra):
        return ["--repo-root", str(self.root), "--inbox", "inbox",
                "--out", str(self.out), "--state", str(self.state), *extra]

    def _patch_sleep(self):
        orig = tubeair_watch._interruptible_sleep
        tubeair_watch._interruptible_sleep = lambda s: None
        self.addCleanup(setattr, tubeair_watch, "_interruptible_sleep", orig)

    def test_healthy_processes_and_raiser_exhausts_without_starving_it(self):
        self._add_capture("aaa-raises", RAISE_VIDEO_ID)  # sorts first → driven first
        self._add_capture("zzz-healthy", VIDEO_ID)
        self._patch_sleep()

        # Run enough cycles for the raising pair to hit the retry ceiling and exhaust.
        code = tubeair_watch.main(self._watch_argv(
            "--interval", "1", "--max-cycles", str(tubeair_watch.MAX_RETRIES_PER_VIDEO + 3)))

        # Healthy pair: processed on the very first sweep, exactly once, and persisted.
        self.assertEqual(len(self._reports_for(VIDEO_ID)), 1,
                         "healthy capture must not be starved by a raising sibling")
        self.assertEqual(self.fetch_counts.get(VIDEO_ID), 1,
                         "healthy capture processed once then skipped (already done)")
        state_txt = self.state.read_text(encoding="utf-8")
        self.assertIn(VIDEO_ID, state_txt)
        self.assertNotIn(RAISE_VIDEO_ID, state_txt)

        # Raising pair: fetched at most the retry ceiling, then exhausted → the watcher
        # stops fetching it (anti-hammer). It never consumed the healthy pair's slot.
        self.assertEqual(self.fetch_counts.get(RAISE_VIDEO_ID),
                         tubeair_watch.MAX_RETRIES_PER_VIDEO,
                         "a permanently raising capture must stop being fetched at the ceiling")

        # The retry ledger cleared the healthy pair (success) and exhausted the raiser.
        # The ledger is co-located with the inbox state file (sibling _watch_retry.json).
        ledger = tubeair_watch._ledger_load(
            self.state.with_name("_watch_retry.json"))["attempts"]
        healthy_key = tubeair_watch._pair_key("zzz-healthy.md", VIDEO_ID)
        raiser_key = tubeair_watch._pair_key("aaa-raises.md", RAISE_VIDEO_ID)
        self.assertNotIn(healthy_key, ledger, "healthy pair must be cleared, never exhausted")
        self.assertEqual(ledger.get(raiser_key), tubeair_watch.MAX_RETRIES_PER_VIDEO)


if __name__ == "__main__":
    unittest.main(verbosity=2)
