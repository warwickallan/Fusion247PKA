# EVIDENCE — WO-2026-08-05-16 / WP-3E: the fixed governor installed to the machine

| Field | Value |
|---|---|
| **work_order** | `WO-2026-08-05-16` (+ Amendment 1 at `1f19551`) |
| **owner** | Mack |
| **governance_head** | `696d44985b6e5b943df93daaccd52d133b7e8663` |
| **branch / worktree** | `build-020/wp-3e-install` · `C:\Fusion247PKA-wp3e-install` |
| **machine_surface written** | `C:\Users\Buggly\.mypka\governor\` — 8 `.mjs` files + `INSTALLED-FROM.txt` |
| **private_surface** | `none` — no path under `C:\.fusion247\**` was read, written or required |
| **credential_scope / network** | `none` / `none` — nothing fetched, nothing sent, no secret touched |
| **date** | 2026-08-05 |

**Result: INSTALLED AND VERIFIED.** All eight modules byte-identical to the governance head blob; the live governor renders `GREEN` with measured telemetry rather than `BLIND`; rollback executed and proven, not documented.

---

## 1. Before state — the rollback baseline, captured before the first write

```
$ ls -la C:/Users/Buggly/.mypka/governor
-rw-r--r--  2141  Aug  5 21:26  INSTALLED-FROM.txt
-rw-r--r--  9652  Aug  5 21:25  atomic-write.mjs
-rw-r--r--   103  Aug  5 21:45  continuity-last.json
-rw-r--r--    16  Aug  5 21:45  continuity-seq.json
-rw-r--r--  3449  Aug  5 10:54  continuity.json
-rw-r--r--  2110  Aug  2 01:30  continuity.json.phase3-bak
-rw-r--r-- 69370  Aug  5 21:25  continuity.mjs
drwxr-xr-x        Aug  1 03:37  delegation/
-rw-r--r-- 10170  Aug  5 21:25  evaluator.mjs
-rw-r--r-- 82747  Aug  5 21:25  footer.mjs
drwxr-xr-x        Aug  1 15:10  handbacks/
drwxr-xr-x        Aug  5 10:50  health/
-rw-r--r--  9053  Aug  5 21:25  health-store.mjs
-rw-r--r--  2027  Aug  1 03:05  registry.json
-rwxr-xr-x 59092  Aug  5 21:25  reorient.mjs
-rw-r--r-- 27431  Aug  5 21:25  sampler.mjs
-rwxr-xr-x  9793  Aug  5 21:25  statusline-live.mjs
```

Baseline SHA-256, taken **before any write**:

```
b822eb5e1a9389a9c1801a92fd3087fdb6a24eb9765db1d5e337f65a84f6c91d *atomic-write.mjs
cb569fc71bc733470cec786ef4d05447fde34b1bf7c37faf17bf4f8a116c743d *continuity.mjs
b26d6aaca55b8e6bb342b50be5f385986e39a104c4070011a98ef9de0d49379a *evaluator.mjs
694417ae5afd1e219e0d4b4f0080a72a0eea714375031e071216d90eaa418924 *footer.mjs
b67c6b49fc47b405d2c0a37672875ce29e5fa2b3a65cb3b22ebdc5436d659bdc *health-store.mjs
b9e767c0909d70de766346ea401d14542a514e73c93d9ffd6195eda8a223f4df *reorient.mjs
33d53793fdee89018d6d0395716bbcbcfa1e873a5065db87d2286d81e47fee02 *sampler.mjs
470bbb22d7e35731ebf5a2329a22ef1951c01c3dd10b06707ede77a1119e389c *statusline-live.mjs
8933261bd3b997fef5abc88adfafd83d82bcb29c1851b4e8bf211ff158be2912 *INSTALLED-FROM.txt
```

Byte copies of all nine files were held for the duration of the install.

## 2. Stale-cache check — confirmed clean, not assumed

```
$ find C:/Users/Buggly/.mypka/governor -name 'recommendation.json'
(no output)

$ find .../governor/health -mindepth 2 -maxdepth 2 -type f ! -name '*-*-*-*-*.json'
(no output)

$ find .../governor/health -mindepth 2 -maxdepth 2 -type d
(no output)
```

No `recommendation.json` anywhere in the tree, no non-UUID direct children of any store directory, no `state/` directories. Nothing to remove.

## 3. The comparison performed, and why

**Comparison: installed file bytes vs `git cat-file blob 696d4498:tools/governor/<f>.mjs`. NOT against the working tree.**

The Work Order's original rationale had the direction reversed; Amendment 1 §E-1 upheld the correction. Measured decisively on `atomic-write.mjs`:

```
blob@696d4498 : ... B U I L D - 0 1 8   T - 1 8 )  \n  / /      <- LF
worktree      : ... B U I L D - 0 1 8   T - 1 8 )  \r \n  /     <- CRLF

core.autocrlf = true ; root .gitattributes ABSENT ; check-attr text/eol unspecified
blob 9652 bytes / worktree 9844 bytes / delta 192 = exactly the line count
```

The **blob holds LF**; the **working tree holds CRLF**. A `cp` from the working tree would have installed CRLF and failed byte-identity **eight for eight**. Install route was therefore `git cat-file blob <head>:tools/governor/<f>.mjs > <dest>` for every file.

## 4. The delta this install actually carried

Six of eight files were already at the head. The real change was two files:

| file | installed before | head blob | delta |
|---|---|---|---|
| `atomic-write.mjs` | `b822eb5e` | `b822eb5e` | none |
| **`continuity.mjs`** | `cb569fc7` | `52a12287` | **+205 lines** — WP-3A frontier + pointer repairs |
| `evaluator.mjs` | `b26d6aac` | `b26d6aac` | none |
| **`footer.mjs`** | `694417ae` | `71cbb5c2` | **+593 lines** — WP-3B measured footer, the `3b10c42` BLIND fix, C-2 resolver guard |
| `health-store.mjs` | `b67c6b49` | `b67c6b49` | none |
| `reorient.mjs` | `b9e767c0` | `b9e767c0` | none |
| `sampler.mjs` | `33d53793` | `33d53793` | none |
| `statusline-live.mjs` | `470bbb22` | `470bbb22` | none |

Independent confirmation the installed copies were genuinely pre-fix: `grep -c "argv.includes('--refresh')"` on the old `footer.mjs` returned **0**.

## 5. Byte-identity after install — all eight

```
FILE                 BLOB-SHA256                                                       INSTALLED-SHA256                                                  VERDICT
atomic-write.mjs     b822eb5e1a9389a9c1801a92fd3087fdb6a24eb9765db1d5e337f65a84f6c91d  b822eb5e1a9389a9c1801a92fd3087fdb6a24eb9765db1d5e337f65a84f6c91d  IDENTICAL
continuity.mjs       52a12287dcf37ed711940f202505edbb2f874faced6fcca62cd3d83e42a788fc  52a12287dcf37ed711940f202505edbb2f874faced6fcca62cd3d83e42a788fc  IDENTICAL
evaluator.mjs        b26d6aaca55b8e6bb342b50be5f385986e39a104c4070011a98ef9de0d49379a  b26d6aaca55b8e6bb342b50be5f385986e39a104c4070011a98ef9de0d49379a  IDENTICAL
footer.mjs           71cbb5c20de17d406ec2f5545647d4f282ef38cad20b2d17472da8507d25b155  71cbb5c20de17d406ec2f5545647d4f282ef38cad20b2d17472da8507d25b155  IDENTICAL
health-store.mjs     b67c6b49fc47b405d2c0a37672875ce29e5fa2b3a65cb3b22ebdc5436d659bdc  b67c6b49fc47b405d2c0a37672875ce29e5fa2b3a65cb3b22ebdc5436d659bdc  IDENTICAL
reorient.mjs         b9e767c0909d70de766346ea401d14542a514e73c93d9ffd6195eda8a223f4df  b9e767c0909d70de766346ea401d14542a514e73c93d9ffd6195eda8a223f4df  IDENTICAL
sampler.mjs          33d53793fdee89018d6d0395716bbcbcfa1e873a5065db87d2286d81e47fee02  33d53793fdee89018d6d0395716bbcbcfa1e873a5065db87d2286d81e47fee02  IDENTICAL
statusline-live.mjs  470bbb22d7e35731ebf5a2329a22ef1951c01c3dd10b06707ede77a1119e389c  470bbb22d7e35731ebf5a2329a22ef1951c01c3dd10b06707ede77a1119e389c  IDENTICAL

RESULT: ALL 8 BYTE-IDENTICAL TO GOVERNANCE HEAD BLOB
```

Executable bits preserved (`reorient.mjs` and `statusline-live.mjs` remain `-rwxr-xr-x`) because the install truncates in place rather than recreating.

## 6. The live render — GREEN, not BLIND

Amendment 1 §E-6 widened `machine_surface` **read-only** by one path so this step could distinguish an honest `BLIND` from the `3b10c42` defect returning. The worktree `C--Fusion247PKA-wp3e-install` has **no health sample** — it has never had a statusline refresh — so a render taken there would return `BLIND` correctly and prove nothing. The session running this order does have a live sample, recorded under the trial cwd where the session opened:

```
health/C--Fusion247PKA-build-020-trial/5a984703-5aed-4152-93eb-45dfc74cdae9.json
757 bytes, mtime 2026-08-05 23:47:45
```

Render from the **installed** copy, no `--refresh`:

```
$ cd C:/Fusion247PKA-build-020-trial
$ node C:/Users/Buggly/.mypka/governor/footer.mjs --session 5a984703-5aed-4152-93eb-45dfc74cdae9

⟦GOV⟧ ctx 44% (440.1k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
(exit=0)
```

**`GREEN` with real measured figures — not `BLIND`.** The defect fixed at `3b10c42` has not returned.

`next: UNSET` is the correct value here, not a degraded one: no `--next` was supplied, and C-2 loads the map resolver only for `--refresh`, so there is no grounded next action for the render to report. Reporting `UNSET` rather than a banked literal is the constitutional requirement.

**The render wrote nothing.** Full directory listing with nanosecond mtimes, hashed before and after:

```
before: 423dfcdd48accf0ffa171938d0ddbfba6e9ef9ddfeb949cf628cdf103d827345
after : 423dfcdd48accf0ffa171938d0ddbfba6e9ef9ddfeb949cf628cdf103d827345
```

No `recommendation.json` and no `state/` directory was created anywhere by the render.

## 7. Rollback — EXECUTED, not documented

Amendment 1 §E-2 required the rollback be exercised on a file with a **real delta**, because restoring one of the six unchanged files would be true whether or not the restore did anything. `footer.mjs` used.

```
R1. before rollback        71cbb5c2...  (head)
R2. restore from baseline  694417ae...  == baseline sha  -> ROLLED BACK BYTE-EXACT
    size 82747 bytes (pre-fix copy)
R4. re-install from blob   71cbb5c2...  == head blob sha -> RE-INSTALLED BYTE-EXACT
    size 113077 bytes
```

**The rolled-back copy was also proven to still function**, so the rollback yields a working governor rather than merely matching bytes:

```
R3. render from the ROLLED-BACK copy:
⟦GOV⟧ ctx 44% · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE

R5. render after RE-INSTALL:
⟦GOV⟧ ctx 44% (440.1k/1000k) · GREEN · TASK UNKNOWN · next: UNSET · CONTINUE
```

**Note the difference, which is the strongest single piece of evidence here.** The pre-fix copy renders `ctx 44%` with no figures. The installed copy renders `ctx 44% (440.1k/1000k)`. WP-3B's measured footer is observable in the product's actual output, not merely in a hash.

**Documented procedure:** restore the baseline copy over the file, then re-install with `git cat-file blob <head>:tools/governor/<f>.mjs > ~/.mypka/governor/<f>.mjs`. Baseline SHA-256 for every file is in §1 above.

Final re-verification after the rollback cycle: **all 8 identical to the governance head.**

## 8. `INSTALLED-FROM.txt`

Rewritten to name governance head `696d4498`, the two-file delta, the blob-not-worktree comparison, the render evidence and the executed rollback. File remains pure LF (CR count 0, verified with `tr -cd '\r'`; the earlier `od | grep` instrument gave a false reading and was discarded — control test on a known-CRLF file returned its exact line count).

Two things were deliberately **not** silently corrected:

- **The write-refusal provenance line is marked SUPERSEDED, not deleted.** History kept beside the correction.
- **The `settings:` paragraph is left byte-unchanged and flagged.** It claims `C:\Fusion247PKA\.claude\settings.local.json` was removed on 2026-08-05. It still exists (28238 bytes, mtime `2026-08-05T16:39:49Z`, existence check only — contents not read, nothing under `.claude/**` edited). This install did not make that untrue, so per the order's bar it is reported, not fixed. Candidate **C-15**.

## 9. Reported, not decided

**The head carries ten modules under `tools/governor/`; the install carries eight.** `continuity-derive.mjs` and `worktree-guard.mjs` were **not** installed, per Amendment 1 §E-3. No installed module imports either, so the eight-file install is self-consistent, and `footer.mjs:50` records that WO-OR-05 removed the `worktree-guard` import deliberately to keep a shelling-out module off the statusline path.

## 10. Bars observed

- No hook registration. No `.claude/**` edit of any kind (one existence check, no content read).
- No new mechanism — no checker, validator, registry or document family. Verification was ad-hoc shell against existing tools.
- No repo code touched: `git diff 696d4498..HEAD -- tools/governor/` is empty; this branch's only content change is this evidence file.
- Tower watcher not restarted. `continuity.mjs write` not run.
- `private_surface: none` held throughout — no step needed `C:\.fusion247\**`.

## 11. What this makes reachable

Map §16.2 **AC-1, AC-2 and AC-3** were unreachable while the runtime copy carried pre-WP-3A/3B code. The runtime now carries the governance head, so they are testable. **This evidence does not itself claim those acceptance criteria pass** — it claims only that the code under test is now the code on the machine, and that the governor renders correctly from it.

**Warwick's own session remains the confirming observation** (Amendment 1 §E-6 route (b)), and is explicitly not a precondition of this return.
