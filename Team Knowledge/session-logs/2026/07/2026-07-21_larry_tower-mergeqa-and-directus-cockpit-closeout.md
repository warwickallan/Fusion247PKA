# Session closure record — Tower merge-QA + Directus live cockpit (2026-07-21)

_Larry session `f458a6bc`. Controlled closeout. This is the canonical Directus/merge-QA closure session-record._

## Merge candidates resolved
- **Tower merge-QA — PR #56: MERGED** (squash, merge commit `9250fba6`, exact READY head `61e4ab2f`).
  The bounded, Larry-triggered merge-check tool (`services/control-plane/tower/merge-check.mjs`): assembles a
  bounded packet, Codex reviews read-only, the Larry↔Codex exchange is recorded to Supabase
  (`tower.merge_check_*`) + mirrored to TowerBot, Codex's reply returns as the command's stdout. Max 3 rounds,
  Codex never merges, non-READY blocks. Codex QA now catches its own admin defects (closure-evidence gate,
  head-provenance gate, and the exact-head TOCTOU close — the last self-caught). 6/6 head-guard regression tests.
- **Directus live cockpit — PR #55: MERGED** (squash merge commit `074f40bf`, at the exact Codex-reviewed
  READY head `e63b0d3`, merged 2026-07-21 under `--match-head-commit`). Merged as **usable, reboot-recovery
  proof pending** under Warwick's explicit acceptance exception; Codex returned READY_TO_MERGE on round 3/3 at
  `e63b0d3` (no correctness/leak/availability/provenance/acceptance-evidence defect). Governing closure record:
  ClickUp `869e6fu9h` ("BUILD-014 — Fusion247 Control Plane") — lifecycle now MERGED for WP-D/#55.
  Private S21 tailnet access + login (proven 8/8), real 91 AsdAIr Regulars (least-priv `cp_directus`), the
  responsive Vue management cockpit **Warwick-verified on the S21 ("solid pass")**, write-back seam proven
  synthetic-first (11/11 + 4/4, real household untouched), MyPKA migrations 010–050 + tested teardown that
  fully reverses 050 (drops the `cockpit` schema) — apply/teardown proof **19/19**. The reboot-recovery
  launcher `ensure-directus-live.mjs` is committed (added in `795649f`) and named in `WP-D-LIVE-README`.
  Corrective commits before merge: `2e79da5` (050 teardown reversibility + 010–050 proof + README table +
  localhost wording), `795649f` (commit the launcher + README reference), `e63b0d3` (README prose 010–050/19-19).

## Acceptance exception (Warwick, explicit)
Warwick authorised merge of #55 as **"usable, reboot-recovery proof pending."** The cockpit is usable now;
it is **not** called fully LIVE until the reboot proof passes.

## Tracked follow-up — reboot-recovery proof (the sole pending item)
Acceptance points: (1) reboot the Yoga; (2) Directus starts without manual intervention; (3) the private tailnet
HTTPS route returns; (4) Directus login works; (5) the cockpit loads real data; (6) the trusted write-back worker
is available. A retry-until-bound Directus launcher is in place; the proof runs on the next reboot.

## Tower disposition
Continuous / post-hoc Tower supervision is **retired**. Tower now means **bounded merge-QA only**. The
turn-by-turn **watcher audit log is preserved** (Stop hook `bridge-ingest.mjs` → `tower.turn`; watcher runs
silent, `TOWER_NOTIFY_TRANSPORT=none`) as the Warwick↔Larry audit record + Codex QA review context.

## Builder Preflight (Warwick, standing — mandatory before every future Tower merge-check)
Before invoking Codex, Larry verifies (and fixes any failure first): (1) `git status --porcelain` has no
unexplained tracked/untracked deliverable files; (2) every artefact named in the completion claim exists and is
in the PR; (3) migrations, teardown and reproducibility tests cover the same migration range; (4) documentation
matches the current deployment state; (5) the PR diff contains all runtime dependencies the acceptance criteria
rely on; (6) closure records describe the current lifecycle state truthfully; (7) local HEAD = PR head = CI head
= review head. Classify every genuine new Codex finding as **repeatable → add a preflight check** or
**non-repeatable → fix only that specific defect**; do not turn one-off findings into more governance. This run
proved the rule: Codex caught (a) an untracked runtime dependency named in the claim but absent from the PR
(launcher), and (b) closure/doc records contradicting the authoritative head — both now preflight checks.

## Parked / next session
- PR #24 left draft and parked (untouched).
- Next session: Telegram → automatic categorisation → TubeAIR for YouTube links → combined gateway → canonical
  brain → Directus report visibility → Telegram completion/failure receipt. (Handoff produced separately.)

## Doc note
`WP-D-LIVE-README.md` previously carried slice-1 historical trust-boundary text ("localhost-only") from the
original 127.0.0.1 read-proof phase. Warwick authorised narrow corrective commits (`2e79da5`, `795649f`,
`e63b0d3`) that: completed migration-050 teardown reversibility (drop `cockpit` schema) + the 010–050 / 19/19
reproducibility proof; documented 050 in the migrations README (table + prose); corrected the stale localhost
wording to the actual private-tailnet deployment; and committed the reboot-recovery launcher
`ensure-directus-live.mjs` (added in `795649f`) named in `WP-D-LIVE-README`. Merged at head `e63b0d3` (squash
`074f40bf`).
