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

import tempfile
import unittest
from pathlib import Path

import tubeair
import tubeair_watch

VIDEO_ID = "dQw4w9WgXcQ"

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


if __name__ == "__main__":
    unittest.main(verbosity=2)
