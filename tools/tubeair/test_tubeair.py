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


# ---------------------------------------------------------------------------
# Transcript readability / cleanup (dedupe + reflow) — pure text ops, no network
# ---------------------------------------------------------------------------

# Synthetic overlapping-caption fixture: a dozen-plus rolling auto-caption lines
# modelling the real YouTube ASR pattern (each line repeats the tail of the
# previous line and adds a few new words). Includes one EXACT duplicate line
# (s04 == s03), one fully-contained trailing line (s13), and a deliberate timing
# gap between the two spoken sentences (s09 ends at 12.5s; s10 starts at 16.0s)
# so reflow has a real boundary to break on. Deterministic; no network.
def _rolling_snippets():
    return [
        {"text": "so today we're going to", "start": 0.0, "duration": 2.0},
        {"text": "today we're going to build a small", "start": 1.5, "duration": 2.0},
        {"text": "going to build a small local agent", "start": 3.0, "duration": 2.0},
        {"text": "going to build a small local agent", "start": 3.0, "duration": 2.0},   # exact dup
        {"text": "build a small local agent that reads a", "start": 4.5, "duration": 2.0},
        {"text": "local agent that reads a youtube transcript", "start": 6.0, "duration": 2.0},
        {"text": "reads a youtube transcript and turns it into", "start": 7.5, "duration": 2.0},
        {"text": "transcript and turns it into a clean readable", "start": 9.0, "duration": 2.0},
        {"text": "turns it into a clean readable document", "start": 10.5, "duration": 2.0},
        # --- timing gap here (12.5 -> 16.0) : new spoken sentence ---
        {"text": "and later the team can review it and", "start": 16.0, "duration": 2.0},
        {"text": "later the team can review it and decide what", "start": 17.5, "duration": 2.0},
        {"text": "team can review it and decide what to keep", "start": 19.0, "duration": 2.0},
        {"text": "and decide what to keep", "start": 20.5, "duration": 2.0},                # contained
    ]

# The two sentences the rolling window is a noisy encoding of.
_SENTENCE_A = ("so today we're going to build a small local agent that reads a "
               "youtube transcript and turns it into a clean readable document")
_SENTENCE_B = "and later the team can review it and decide what to keep"


class TestDedupeRollingSnippets(unittest.TestCase):
    def setUp(self):
        self.raw = _rolling_snippets()
        self.cleaned = t.dedupe_rolling_snippets(self.raw)

    def test_removes_redundancy(self):
        # 13 rolling lines collapse: the exact dup (s04) and the fully-contained
        # trailing line (s13) are dropped; the rest keep only their new tail.
        self.assertLess(len(self.cleaned), len(self.raw))
        self.assertEqual(len(self.cleaned), 11)

    def test_reconstructs_full_unique_content_exactly(self):
        # Joining the kept tails must reproduce the two source sentences verbatim —
        # every unique word preserved, in order, none invented.
        joined = " ".join(s["text"] for s in self.cleaned)
        self.assertEqual(joined, f"{_SENTENCE_A} {_SENTENCE_B}")

    def test_no_word_is_invented(self):
        raw_words = set(" ".join(s["text"] for s in self.raw).split())
        for s in self.cleaned:
            for w in s["text"].split():
                self.assertIn(w, raw_words)

    def test_total_word_count_drops(self):
        raw_words = sum(len(s["text"].split()) for s in self.raw)
        clean_words = sum(len(s["text"].split()) for s in self.cleaned)
        self.assertLess(clean_words, raw_words)      # real redundancy removed
        self.assertEqual(clean_words, 35)            # 95 -> 35 on this fixture

    def test_timestamps_preserved_on_survivors(self):
        # Each surviving snippet keeps its own start time (paragraph anchoring).
        self.assertEqual(self.cleaned[0]["start"], 0.0)
        self.assertEqual(self.cleaned[-1]["start"], 19.0)

    def test_idempotent(self):
        once = t.dedupe_rolling_snippets(self.raw)
        twice = t.dedupe_rolling_snippets(once)
        self.assertEqual(once, twice)

    def test_does_not_mutate_input(self):
        before = [dict(s) for s in self.raw]
        t.dedupe_rolling_snippets(self.raw)
        self.assertEqual(self.raw, before)

    def test_empty_input(self):
        self.assertEqual(t.dedupe_rolling_snippets([]), [])


class TestReflowParagraphs(unittest.TestCase):
    def setUp(self):
        self.cleaned = t.dedupe_rolling_snippets(_rolling_snippets())
        self.paras = t.reflow_paragraphs(self.cleaned, gap_seconds=2.0)

    def test_breaks_on_timing_gap(self):
        # The 3.5s gap between the two sentences yields exactly two paragraphs.
        self.assertEqual(len(self.paras), 2)

    def test_paragraph_start_timestamps_preserved(self):
        self.assertEqual(self.paras[0]["start"], 0.0)    # -> [00:00]
        self.assertEqual(self.paras[1]["start"], 16.0)   # -> [00:16]

    def test_paragraph_text_is_the_reflowed_sentences(self):
        self.assertEqual(self.paras[0]["text"], _SENTENCE_A)
        self.assertEqual(self.paras[1]["text"], _SENTENCE_B)

    def test_no_gap_means_single_paragraph(self):
        # With a huge gap threshold nothing breaks -> one paragraph.
        paras = t.reflow_paragraphs(self.cleaned, gap_seconds=9999)
        self.assertEqual(len(paras), 1)
        self.assertEqual(paras[0]["text"], f"{_SENTENCE_A} {_SENTENCE_B}")

    def test_idempotent_render(self):
        # Cleaning already-clean snippets a second time gives the same paragraphs.
        again = t.reflow_paragraphs(t.dedupe_rolling_snippets(self.cleaned), gap_seconds=2.0)
        self.assertEqual(self.paras, again)

    def test_empty_input(self):
        self.assertEqual(t.reflow_paragraphs([]), [])


class TestCleanedTranscriptInReport(unittest.TestCase):
    """The report must ADD a cleaned §7 view while leaving the raw evidence
    (and, separately, the immutable GL-011 source) unchanged."""

    def _cap_with_rolling(self):
        cap = _sample_capture("extracted")
        cap.snippets = _rolling_snippets()
        cap.segment_count = len(cap.snippets)
        return cap

    def setUp(self):
        self.cap = self._cap_with_rolling()
        self.md = t.build_report_markdown(self.cap)

    def test_cleaned_view_present(self):
        self.assertIn("### 7.1 Cleaned reading view", self.md)
        self.assertIn(f"[00:00] {_SENTENCE_A}", self.md)
        self.assertIn(f"[00:16] {_SENTENCE_B}", self.md)

    def test_raw_evidence_block_unchanged(self):
        # Every original rolling caption line is still present, unaltered, in the
        # raw evidence sub-block — the cleaned view is additive, not a replacement.
        self.assertIn("### 7.2 Raw captured transcript", self.md)
        for snip in _rolling_snippets():
            self.assertIn(f"[{t.format_timestamp(snip['start'])}] {snip['text']}", self.md)

    def test_cleaned_view_precedes_raw_block(self):
        self.assertLess(self.md.find("### 7.1 Cleaned reading view"),
                        self.md.find("### 7.2 Raw captured transcript"))

    def test_immutable_raw_source_is_untouched_by_cleanup(self):
        # build_raw_markdown is the GL-011 immutable source: it must contain the
        # raw overlapping lines and NONE of the cleaned-view scaffolding.
        raw_md = t.build_raw_markdown(self.cap)
        for snip in _rolling_snippets():
            self.assertIn(f"[{t.format_timestamp(snip['start'])}] {snip['text']}", raw_md)
        self.assertNotIn("Cleaned reading view", raw_md)

    def test_report_still_has_all_eight_sections(self):
        for h in ["## 6. Source Metadata", "## 7. Full Transcript", "## 8. Run / Processing Notes"]:
            self.assertIn(h, self.md)

    def test_no_verbatim_wording_regression(self):
        # The pre-existing governance rule: the word "verbatim" must not appear.
        self.assertNotIn("verbatim", self.md.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
