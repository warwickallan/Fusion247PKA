"""Unit tests for TubeAIR — pure functions + Markdown generation, no network.

These satisfy the WP0/WP1 requirement to unit-test URL parsing, transcript-source
formatting, Markdown generation and the honest failure state independently of
YouTube access (the tests pass even where live YouTube egress is blocked).

Run:  tools/tubeair/.venv/Scripts/python.exe -m pytest tools/tubeair/test_tubeair.py -q
or:   tools/tubeair/.venv/Scripts/python.exe -m unittest tools.tubeair.test_tubeair
"""

import unittest

import tubeair as t


class TestParseVideoId(unittest.TestCase):
    def test_standard_watch(self):
        self.assertEqual(t.parse_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")

    def test_watch_with_extra_params(self):
        self.assertEqual(
            t.parse_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=RD"),
            "dQw4w9WgXcQ")

    def test_short_youtu_be(self):
        self.assertEqual(t.parse_video_id("https://youtu.be/dQw4w9WgXcQ?si=abc"), "dQw4w9WgXcQ")

    def test_shorts(self):
        self.assertEqual(t.parse_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ")

    def test_embed(self):
        self.assertEqual(t.parse_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ")

    def test_live(self):
        self.assertEqual(t.parse_video_id("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ")

    def test_mobile(self):
        self.assertEqual(t.parse_video_id("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")

    def test_bare_id(self):
        self.assertEqual(t.parse_video_id("dQw4w9WgXcQ"), "dQw4w9WgXcQ")

    def test_invalid_raises(self):
        for bad in ["https://example.com/watch?v=short", "not a url", "", "https://youtu.be/tooshort"]:
            with self.assertRaises(ValueError):
                t.parse_video_id(bad)


class TestUrlHostAllowlist(unittest.TestCase):
    """SECURITY: parse_video_id must ONLY accept URLs served from an allowlisted
    YouTube host. Covers the Codex-flagged bug (non-YouTube hosts were accepted)
    plus lookalike/suffix/userinfo/bad-scheme tricks. All hostile cases must
    fail CLOSED (raise ValueError); all valid YouTube forms must still resolve.
    """

    VALID_ID = "dQw4w9WgXcQ"

    HOSTILE = [
        # The core Codex bug: a real 11-char id but a non-YouTube host.
        "https://example.com/watch?v=dQw4w9WgXcQ",
        # Suffix / lookalike hosts.
        "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
        "https://evilyoutube.com/watch?v=dQw4w9WgXcQ",
        "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
        # Unlisted subdomain (default: reject).
        "https://sandbox.youtube.com/watch?v=dQw4w9WgXcQ",
        # Userinfo trick — real host is evil.com, not youtube.com.
        "https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com@evil.com/watch?v=dQw4w9WgXcQ",
        # Non-http(s) schemes.
        "javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "data:text/html,<script>youtube.com/watch?v=dQw4w9WgXcQ</script>",
        "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
        "mailto:attacker@youtube.com?v=dQw4w9WgXcQ",
        # Missing / malformed host.
        "https:///watch?v=dQw4w9WgXcQ",
        "//evil.com/watch?v=dQw4w9WgXcQ",
        "",
    ]

    VALID = {
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ": VALID_ID,
        "https://youtube.com/watch?v=dQw4w9WgXcQ": VALID_ID,
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ": VALID_ID,
        "https://music.youtube.com/watch?v=dQw4w9WgXcQ": VALID_ID,
        "https://youtu.be/dQw4w9WgXcQ": VALID_ID,
        "https://youtu.be/dQw4w9WgXcQ?si=abc123": VALID_ID,
        # Scheme-less host form must still work.
        "youtube.com/watch?v=dQw4w9WgXcQ": VALID_ID,
        "www.youtube.com/watch?v=dQw4w9WgXcQ": VALID_ID,
        # Case-insensitive host match (URL API lowercases the hostname).
        "https://WWW.YouTube.COM/watch?v=dQw4w9WgXcQ": VALID_ID,
        # Privacy-embed host (extractor supports /embed/).
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ": VALID_ID,
        # Bare id (no host) remains valid.
        "dQw4w9WgXcQ": VALID_ID,
    }

    def test_hostile_urls_are_rejected(self):
        for bad in self.HOSTILE:
            with self.subTest(url=bad):
                with self.assertRaises(ValueError):
                    t.parse_video_id(bad)

    def test_valid_youtube_urls_still_resolve(self):
        for good, expected in self.VALID.items():
            with self.subTest(url=good):
                self.assertEqual(t.parse_video_id(good), expected)

    def test_scanner_rejects_lookalike_suffix_host(self):
        # find_youtube_urls feeds the inbox path; it must not "launder" a hostile
        # suffix host (evilyoutube.com) into a valid-looking id.
        self.assertEqual(
            t.find_youtube_urls("see https://evilyoutube.com/watch?v=dQw4w9WgXcQ now"),
            [])

    def test_scanner_still_finds_real_youtube_url(self):
        hits = t.find_youtube_urls("watch https://www.youtube.com/watch?v=dQw4w9WgXcQ ok")
        self.assertEqual(hits, [("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ")])


class TestSlugify(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(t.slugify("Agentic OS Build Pattern!"), "agentic-os-build-pattern")

    def test_collapses_and_trims(self):
        self.assertEqual(t.slugify("  Hello   World -- Test  "), "hello-world-test")

    def test_empty(self):
        self.assertEqual(t.slugify(""), "untitled")
        self.assertEqual(t.slugify(None), "untitled")

    def test_truncates(self):
        self.assertLessEqual(len(t.slugify("x" * 200)), 60)


class TestTimestamp(unittest.TestCase):
    def test_minutes(self):
        self.assertEqual(t.format_timestamp(0), "00:00")
        self.assertEqual(t.format_timestamp(12), "00:12")
        self.assertEqual(t.format_timestamp(90), "01:30")

    def test_hours(self):
        self.assertEqual(t.format_timestamp(3661), "01:01:01")

    def test_published_date(self):
        self.assertEqual(t.format_published_date("20260706"), "2026-07-06")
        self.assertIsNone(t.format_published_date(None))


def _sample_capture(status="extracted"):
    cap = t.Capture(
        source_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        video_id="dQw4w9WgXcQ",
        captured_at="2026-07-17T09:00:00+00:00",
        title="Agentic OS Build Pattern",
        channel="Test Channel",
        published_date="2026-07-06",
        duration_seconds=95,
        user_note="possible agent workflow idea",
        transcript_status=status,
        transcript_source="manual_captions" if status == "extracted" else "none",
        language="English",
        language_code="en",
    )
    if status == "extracted":
        cap.snippets = [
            {"text": "Welcome to the build.", "start": 0.0, "duration": 3.0},
            {"text": "Today we cover agent workflows.", "start": 12.0, "duration": 4.0},
        ]
        cap.segment_count = 2
    else:
        cap.error_category = "transcript_unavailable"
        cap.error_detail = "TranscriptsDisabled: subtitles are disabled for this video"
        cap.retry_recommendation = "Video has no usable captions."
    return cap


class TestRawMarkdownSuccess(unittest.TestCase):
    def setUp(self):
        self.md = t.build_raw_markdown(_sample_capture("extracted"))

    def test_required_frontmatter_fields(self):
        for fld in ["source_type: youtube_transcript", "capture_method: local_terminal",
                    "video_id: dQw4w9WgXcQ", "transcript_status: extracted",
                    "transcript_source: manual_captions",
                    "fusion_review_status: pending_cairn",
                    "assigned_agent: youtubair", "next_agent: cairn"]:
            self.assertIn(fld, self.md)

    def test_cairn_is_primary_categorisair_is_legacy_alias(self):
        # Cairn must be the ACTIVE downstream; CategorisAIr only a demoted alias.
        self.assertIn("next_agent: cairn", self.md)
        self.assertIn("legacy_next_agent: categorisair", self.md)
        self.assertIn("legacy_review_status: pending_categorisair", self.md)
        # The active fields must NOT carry the legacy values (line-anchored so the
        # legacy_* alias lines don't false-match as active fields).
        self.assertIn("\nnext_agent: cairn\n", self.md)
        self.assertNotIn("\nnext_agent: categorisair\n", self.md)
        self.assertIn("\nfusion_review_status: pending_cairn\n", self.md)
        self.assertNotIn("\nfusion_review_status: pending_categorisair\n", self.md)

    def test_has_timestamped_transcript(self):
        self.assertIn("[00:00] Welcome to the build.", self.md)
        self.assertIn("[00:12] Today we cover agent workflows.", self.md)

    def test_has_review_options(self):
        self.assertIn("## Cairn Review Options", self.md)
        self.assertIn("Retain source only", self.md)
        self.assertIn("self-learning brief", self.md)  # team-improvement path noted

    def test_not_summarised(self):
        # The transcript body must be present verbatim, not replaced by a summary.
        self.assertIn("## Transcript", self.md)


class TestRawMarkdownFailure(unittest.TestCase):
    def setUp(self):
        self.md = t.build_raw_markdown(_sample_capture("extraction_failed"))

    def test_failure_frontmatter(self):
        self.assertIn("transcript_status: extraction_failed", self.md)
        self.assertIn("fusion_review_status: extraction_failed", self.md)

    def test_failure_record_fields(self):
        self.assertIn("## Failure Record", self.md)
        self.assertIn("Error category:", self.md)
        self.assertIn("transcript_unavailable", self.md)
        self.assertIn("Retry recommendation:", self.md)

    def test_no_false_success(self):
        self.assertNotIn("## Transcript\n", self.md)
        self.assertIn("NOT a successful capture", self.md)


class TestCombinedReportSuccess(unittest.TestCase):
    def setUp(self):
        self.md = t.build_report_markdown(_sample_capture("extracted"))

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

    def test_transcript_included_verbatim_in_same_file(self):
        self.assertIn("[00:00] Welcome to the build.", self.md)
        self.assertIn("[00:12] Today we cover agent workflows.", self.md)

    def test_governance_labels(self):
        self.assertIn("source evidence", self.md)
        self.assertIn("recommendations only", self.md.lower())
        self.assertIn("pending", self.md.lower())

    def test_frontmatter_routing(self):
        self.assertIn("fusion_review_status: pending_cairn", self.md)
        self.assertIn("\nnext_agent: cairn\n", self.md)
        self.assertIn("legacy_next_agent: categorisair", self.md)
        self.assertIn("recommendations_only: true", self.md)
        self.assertNotIn("\nnext_agent: categorisair\n", self.md)

    def test_analysis_sections_are_scaffolds(self):
        self.assertIn("TUBEAIR:ANALYSIS_PENDING", self.md)

    def test_decision_block_present_with_no_auto_update(self):
        self.assertIn("## Warwick Decision Block", self.md)
        self.assertIn("Recommended disposition:", self.md)
        self.assertIn("No automatic living-knowledge update", self.md)
        self.assertIn("Source-register entries may be created", self.md)
        # near the top: before section 1
        self.assertLess(self.md.find("## Warwick Decision Block"), self.md.find("## 1. Executive"))

    def test_untrusted_warning_immediately_before_transcript(self):
        warn = self.md.find("Untrusted source")
        sec7 = self.md.find("## 7. Full Transcript")
        self.assertNotEqual(warn, -1)
        self.assertNotEqual(sec7, -1)
        self.assertLess(warn, sec7)
        # nothing but the warning + blank line between it and the header
        self.assertLess(sec7 - warn, 600)

    def test_no_verbatim_wording(self):
        self.assertNotIn("verbatim", self.md.lower())
        self.assertIn("captured from YouTube captions/auto-captions", self.md)


class TestCombinedReportFailure(unittest.TestCase):
    def setUp(self):
        self.md = t.build_report_markdown(_sample_capture("extraction_failed"))

    def test_analysis_marked_not_applicable(self):
        self.assertIn("Not applicable — transcript extraction failed", self.md)

    def test_failure_record_and_no_false_success(self):
        self.assertIn("NOT a successful capture", self.md)
        self.assertIn("fusion_review_status: extraction_failed", self.md)
        self.assertIn("## 7. Full Transcript", self.md)  # section still present, holds the failure record


class TestReportFilename(unittest.TestCase):
    def test_shape(self):
        cap = _sample_capture("extracted")
        name = t.report_filename(cap)
        self.assertTrue(name.startswith("TubeAIR Report - "))
        self.assertTrue(name.endswith(" - dQw4w9WgXcQ.md"))


class TestFindYoutubeUrls(unittest.TestCase):
    def test_finds_url_in_capture_text(self):
        text = "# Capture x\n\n- capture_id: x\n\nCheck this https://youtu.be/dQw4w9WgXcQ?si=z great"
        hits = t.find_youtube_urls(text)
        self.assertEqual(hits, [("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ")])

    def test_dedupes_by_video_id(self):
        text = "watch?v=dQw4w9WgXcQ and https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1"
        hits = t.find_youtube_urls(text)
        self.assertEqual(len(hits), 1)

    def test_multiple_distinct(self):
        text = "https://youtu.be/dQw4w9WgXcQ then youtube.com/shorts/abcdefghijk end"
        vids = [v for _, v in t.find_youtube_urls(text)]
        self.assertEqual(vids, ["dQw4w9WgXcQ", "abcdefghijk"])

    def test_none_in_plain_text(self):
        self.assertEqual(t.find_youtube_urls("I love you Larry!"), [])
        self.assertEqual(t.find_youtube_urls(""), [])


class TestOutputDir(unittest.TestCase):
    def test_folder_name_shape(self):
        cap = _sample_capture("extracted")
        from pathlib import Path
        d = t.output_dir_for(cap, Path("out/tubeair"))
        self.assertTrue(d.name.endswith("__dQw4w9WgXcQ"))
        self.assertIn("2026-07-17__agentic-os-build-pattern__", d.name)


if __name__ == "__main__":
    unittest.main(verbosity=2)
