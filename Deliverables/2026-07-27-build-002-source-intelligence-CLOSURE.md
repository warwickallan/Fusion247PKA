# BUILD-002 Source Intelligence — CLOSURE REPORT

**Status: COMPLETED (live).** The missing BUILD-002 primary outcome — *drop a YouTube URL, get a standalone note
you can trust instead of watching* — is now automated, proven, independently reviewed, fixed, and live-applied.
**One item remains and it is your gate: merge-to-main.**

Branch `idea-016/idea-engine` · commits `181fae6` (build) + `88dd451` (QA folds).

---

## The 12 items

1. **A — Automated Cairn Source Intelligence (DONE, live).** `services/hub/youtube/generate-source-note.mjs`
   applies the approved `F247.template.youtube-transcript-knowledge-note` contract to the RAW transcript via
   headless Sonnet → a standalone note → governed write through the **one write authority** (`ingestYouTube`,
   RAW immutability preserved) → flips `youtube_source` pending→noted. No hand-authoring, no new agent (Cairn owns
   it). Wired into the live watcher (`watch-captures.mjs`): a bounded `generatePendingNotes()` pass generates the
   note after extraction. The stale "needs a session, not a headless API key" blocker is dissolved.

2. **B — Note is the PRIMARY cockpit output (DONE, render-checked, live).** New `/api/source-brief` endpoint +
   `noted` flag; the cockpit's old "Transcripts" lane is now **"📖 Source briefs"** — every source leads with a
   **📖 Read** button that opens the standalone "what this source says" note; transcript-copy/mine demoted to
   secondary. Understandable with zero reference to Arc or Mason. Headless render-check PASSED (Vue mounts); sw v19.

3. **C — Proven on the failure fixture `vJEy3nP2_C8`: 16/16 material veins.** In substance, not keyword-match —
   including the **mandatory X/public-reputation → Sahil Bloom argument** (fully reconstructed: public building
   compounds credibility; Sahil Bloom's COVID X-writing → 1M followers → NYT bestseller → fund) **and** the
   previously-missed **counterintuitive technical-reversal** ("engineering is going away" is wrong — you become
   *more* technical). A general prompt rule (preserve counterintuitive reversals + a coverage self-check) fixed
   the one miss; the note grew 25.5k→30.5k and now covers every vein.

4. **D — Standalone reader test: PASS.** A fresh model given ONLY the note answered all 6 questions — main claims,
   mechanisms, tools/people, vendor argument, cost/model-routing, attention cadence, **and the Sahil Bloom /
   reputation argument** — with zero "NOT IN NOTE". The note stands alone without the video.

5. **E — 2 additional sources: PASS.** *Audi 1988* (rich, entirely different domain — motorsport/history/comedy):
   full structural completeness, deep detail (turbo mechanism, anti-lag technique, ordered handicap sequence),
   **real timestamps** (provenance), and rigorous **fiction-vs-fact separation** (flags "(This actually happened)"
   as the only source-verified point; routes fact-checking to Pax). *Air-fryer cleaning* (thin): self-labels
   "thin source", enumerates five source gaps, **invents nothing**; the near-empty caption variant (379 chars) was
   correctly **refused** rather than hallucinated.

6. **F — Arc re-evaluated with the note available (observed, NOT tuned).** Finding: the note makes Arc *recognise*
   the manager-delegation, model-routing and watchdog veins — then its FIRST-THREE-DISCARD/self-kill **bins them
   as "already said"**, partly *because* the note's own "What this means for Fusion247" section pre-states them.
   Vendor-lock-in / attention / reputation are still structurally missed (Arc's mechanism→component lens can't see
   non-component themes). Conclusion (for a LATER tuning, not now): withhold the note's *interpretation* section
   from Arc, and accept that strategic/career veins belong to the Source-Intelligence note, not the transfer
   extractor. Arc also turned inward and flagged the pipeline's own (now-closed) "note pending" gap.

7. **G/QA — Independent Fable review (you authorised; Codex unavailable).** Verdict: **merge-ready-after-fixes,
   no blockers.** Confirmed sound: fail-closed completeness gate, RAW immutability on regeneration, retry
   soundness (no infinite loop, crash-safe counter), idempotency, endpoint leak-safety, audit provenance,
   migration safety.

8. **Fable F1 folded (silent-stuck regression).** A caption-less video whose *extraction* exhausted fell through
   the new nudge and sat silently labelled "generating…". Fixed: nudge now fires on extraction-exhausted OR
   note-exhausted; cockpit labels stuck rows "⚠ … failed — flagged"; `/api/state` exposes attempt counters.
   Restores the "nothing sits silently" guarantee.

9. **Fable F2 folded (frontmatter noise).** `brief_markdown` carried YAML frontmatter, so the flagship reading
   surface opened with ~20 lines of plumbing. `apiSourceBrief` now strips a leading frontmatter block (one place,
   covers every row incl. legacy). Verified live: the brief opens at "## Executive orientation".

10. **Fable F3 folded (cosmetic).** Removed the dead `--force` flag. F4 (read the durable vault RAW if the
    transient `out/` packet is cleaned) noted as a deferred hardening — not silent (retries exhaust → nudge).

11. **Live-apply DONE (reversible; non-personal public-source data).** Migration 280 applied (additive
    `note_attempts` column). Fixture note **persisted for real** → `Sources/vjey3np2-c8-...md` (27.4k chars, RAW
    sha matched — immutability held). Live cockpit **restarted healthy** (brief endpoint + frontmatter-strip +
    new fields live; Tailscale tunnel intact). Live watcher **restarted** and actively backfilling the ~11
    note-less sources at 5/pass. You can open the cockpit now → **📖 Read** "Most Valuable Skill of 2026".

12. **THE GATE — merge-to-main awaits your explicit yes.** Everything above is on `idea-016/idea-engine`
    (`181fae6` + `88dd451`), independently reviewed and live-verified. Per standing rule, code-merge to `main`
    is yours to authorise. Say the word and I'll reconcile onto current main and merge with the expected-head guard.

---

## Scope discipline
No new agent. Arc not tuned (only observed, per F). Mason untouched. No scope broadened. The correction was exactly
what the diagnosis prescribed: automate Cairn's already-specified note step with headless Sonnet and make it the
headline output, leaving Arc/Mason downstream.
