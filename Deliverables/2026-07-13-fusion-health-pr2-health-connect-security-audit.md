---
type: audit-report
author: vex
date: 2026-07-13
subject: warwickallan/fusion-health PR #2 (branch build-005/wp1/health-connect-baseline)
verdict: PASS-WITH-NOTES
---

# Security audit — fusion-health PR #2 (Health Connect baseline)

**Scope:** `AndroidManifest.xml`, `MainActivity.kt`, `app/build.gradle.kts`, `.github/workflows/android-build.yml` on branch `build-005/wp1/health-connect-baseline`. First PR in this build touching real personal health data via Android Health Connect. Reviewed as a pre-ship gate ahead of Warwick installing the test APK.

**Verdict: PASS-WITH-NOTES.** No CRITICAL or HIGH findings. No committed secrets, no network capability, permissions are least-privilege and read-only, no durable storage, no sensitive logging, exported diagnostic text is metadata-only, denial/revocation paths are handled safely. Three LOW-severity/advisory notes below — none block install of the test APK.

## Findings

### [LOW] Alpha-quality Health Connect client dependency
**Where:** `app/build.gradle.kts:66` — `androidx.health.connect:connect-client:1.1.0-alpha07`
**What:** The only third-party runtime dependency that touches health data is a pre-release (alpha) artifact. Fine for an internal diagnostic test build; should be revisited (pinned to a stable release) before any wider distribution.
**Fix recommendation:** Track upstream stable releases; upgrade before WP1 leaves diagnostic-only scope.
**Verification step:** Confirm `connect-client` version at next PR touching this dependency.

### [LOW] Public repo / public prerelease APK (pre-existing, self-flagged)
**Where:** `.github/workflows/android-build.yml:83-97`, acknowledged in `docs/plan.md`
**What:** The repo is currently public, so the built APK is published as a public GitHub prerelease regardless of the `prerelease: true` label. This is a pre-existing, documented, deliberate decision from PR1 (not introduced by PR2) and does not expose any user health data — the diagnostic report text itself is never uploaded or embedded in the APK; only the binary and source are public. Flagging so it stays on the radar for when this moves beyond diagnostic-only scope.
**Fix recommendation:** Flip the repo to private before any build that could contain real device-identifying data or before production use, per the repo's own plan.md commitment.
**Verification step:** Confirm repo visibility at the point BUILD-005 moves past diagnostic scope.

### [LOW] Unverified source-app package-name heuristics
**Where:** `MainActivity.kt:52-59`, `MainActivity.kt:224-228`
**What:** `SourceApps` package names (Samsung Health, MyFitnessPal, Withings) are best-effort and self-flagged in code comments and in the diagnostic output itself as unverified against a real device. This is a functional-accuracy caveat, not a security exposure — no sensitive data hinges on the match being correct, and the code already discloses the uncertainty to the user.
**Fix recommendation:** None required for security; confirm against Warwick's real Health Connect source-app list during functional testing.
**Verification step:** N/A (functional, not security).

## Checks performed (per SOP-004, scoped to this PR's actual surface)

1. **Least-privilege permissions** — PASS. `AndroidManifest.xml:7-12` declares exactly six `android.permission.health.READ_*` permissions (steps, sleep, heart rate, nutrition, weight, body fat). No `WRITE_*` Health Connect permission, no `INTERNET`, no unrelated permission anywhere in the manifest. `MainActivity.kt:61-70` requests the same six read permissions and no more — manifest and code agree.
2. **No network capability** — PASS. No `INTERNET`/`ACCESS_NETWORK_STATE` permission declared; no `HttpURLConnection`/`OkHttp`/`Retrofit`/socket usage in `MainActivity.kt`. `build.gradle.kts:63-69` dependency list is core-ktx, appcompat, Health Connect client, lifecycle-runtime-ktx, and kotlinx-coroutines — none of these open network connections; Health Connect's `connect-client` talks to the on-device Health Connect provider via Android IPC/AIDL, not a remote endpoint.
3. **No durable storage** — PASS. Grepped for `SharedPreferences`, `openFileOutput`, `File(`, Room/SQLite imports, `getExternalFilesDir` — none present. `lastDiagnosticText` (`MainActivity.kt:73`) is an in-memory `var` scoped to the Activity instance; it dies with the process. `android:allowBackup="false"` (`AndroidManifest.xml:22`) additionally blocks ADB/cloud backup of app state. Copy/Export (`MainActivity.kt:234-250`) uses only `ClipboardManager.setPrimaryClip` and `Intent.ACTION_SEND` via `createChooser` — no file write anywhere in that path.
4. **No sensitive logging** — PASS. No `Log.d/e/w/i`, `println`, `System.out`, or `Timber` calls anywhere in `MainActivity.kt`. The single `println` in `build.gradle.kts:29` logs only the signing-config name (`"release"`/`"debug"`), confirmed no keystore path, password, alias, or health value is interpolated into that string.
5. **Exported diagnostics sanitised** — PASS. `buildDiagnosticText` (`MainActivity.kt:181-232`) emits only: state enum, record `count`, `earliest`/`latest` timestamps (minute precision), and `sourcePackages` (installed app package names). No raw record values — no step counts, no kg/heart-rate/bpm figures, no nutrition macros — are read out of any `Record` field into the report. This is metadata-only and appropriate for a self-export diagnostic tool.
6. **Denial/revocation handling** — PASS. `readType<T>` (`MainActivity.kt:132-166`) checks `readPermission !in granted` before calling `readRecords`, returning `PERMISSION_DENIED` state rather than assuming grant. It also catches `SecurityException` (mid-session revocation) and generic `Exception` (`READ_ERROR`) around the actual read call, so a denial or revocation surfaces as a normal UI state, not a crash. `onRunDiagnosticClicked` (`MainActivity.kt:96-110`) checks `HealthConnectClient.getSdkStatus` before touching the client at all, handling the "Health Connect not installed/unavailable" case without proceeding.

## Credential hygiene (Phase 1 spot-check)

No hardcoded secrets, no committed `.env`/keystore files in this PR or repo history (`git log --all --diff-filter=A --name-only` shows no keystore/env/secret additions). Release signing pulls exclusively from CI env vars sourced from GitHub Actions secrets (`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); the decoded keystore file is removed in an `if: always()` step (`android-build.yml:72-74`). No change from PR1's already-reviewed posture; nothing new to flag here.

## Definition of done

- [x] Relevant phases covered (credential spot-check, permission/authorization-equivalent review for a client-side app, no external integration surface to hardn since app has no network/backend, data-handling review for the health-data-specific asks).
- [x] Findings have severity, fix recommendation, and verification step.
- [x] Report filed at `Deliverables/2026-07-13-fusion-health-pr2-health-connect-security-audit.md`.
- [x] Session-log entry filed.
- [x] No CRITICAL/HIGH findings — none to surface urgently.
