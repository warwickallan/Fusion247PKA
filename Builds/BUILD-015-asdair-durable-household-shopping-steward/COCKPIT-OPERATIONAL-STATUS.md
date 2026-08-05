# BUILD-015 — COCKPIT OPERATIONAL STATUS

**Required by:** Warwick's ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT` §5, 2026-08-04.
**Status of this file:** current as at 2026-08-04. **The Cockpit is NOT signed off.**

> Warwick's framing, and it is the right one: *"Treat that as an open operational defect, not
> as a previously completed UI task."* The Cockpit must not be **required** for the shop to
> proceed — but when it is presented as operational it must actually work.

---

## The two services, and why that matters

| | Process | Port | What it is |
|---|---|---|---|
| **Shell** | `services/cockpit/server.mjs` | 8090 | The Vue app Warwick opens on his phone, plus its API proxies |
| **Read API** | `services/asdair/cockpit-api/server.js` | 8710 | SELECT-only AsdAIr reader, loopback-bound |

**Both must be restarted for a backend change to take effect.** This was missed on
2026-08-04 and cost a false "it's fixed" — the shell was restarted, the read API was not, and
it kept advertising its old route surface. Static files under `services/cockpit/public/` need
no restart (served straight from the working tree) but **do** need the service-worker cache
version bumped or an already-visited session keeps serving the old shell.

---

## Ruling §5 checklist — honest state

| # | Requirement | State | Evidence |
|---|---|---|---|
| 1 | Overview loads the real current shop | **WORKING** | `/api/asdair/workspace` returns `SHOP-2026-08-03`, correct stage, verified live. Confirmed visually by Warwick 2026-08-03. |
| 2 | Details loads the retained photograph | **WORKING** | Was broken (`media_root_not_configured`, D-2026-08-03-02); `ASDAIR_MEDIA_ROOT` set durably, verified 200 / `image/jpeg` / 123,212 bytes through **both** the read API and the shell proxy. Confirmed visually by Warwick. |
| 3 | Interpreted lines show their catalogue identity | **BUILT-NOT-VERIFIED** | Rebuilt 2026-08-04 into real per-line rows (status, plan, basis, confidence, alternatives). **Never seen by Warwick.** The bug was worse than reported: the view referenced `raw_display`/`title`, **fields that do not exist**, so all 34 lines fell through to `JSON.stringify(ln)` — the raw JSON Warwick saw was a *fallback*, not a deliberate technical drawer. |
| 4 | Genuinely new items visibly distinct | **BUILT-NOT-VERIFIED** | Same rebuild. |
| 5 | Previous decisions visible | **BUILT-NOT-VERIFIED** | New **Rules** tab + `readRules.js` (SELECT-only) + `/api/asdair/rules`. API confirmed returning real grouped data after both restarts. **UI never seen by Warwick.** |
| 6 | The Brand-ordered Sonnet packet visible | **SURFACE BUILT — NO PRODUCER** | New **Basket** tab renders the packet in the producer's Brand A–Z order (never re-sorted here), with `quantity_rationale` and `applied_rules` per line. Reader `readPacket.js` + `GET /asdair/packet` + shell proxy, 26 tests. **The producer (WO-P, Keel) still does not exist**, so live it renders the honest "not produced" state. Contract published in `COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md`. **Never seen by Warwick.** |
| 7 | Basket reconciliation visible | **SURFACE BUILT — NO PRODUCER** | Same tab: expected vs actual distinct products and total units, per-line identity and quantity, held/unavailable visibly distinct, and the no-checkout confirmation as a tri-state. **Ruling §3 is encoded in tested code** — matching headline counts with a wrong line renders "The totals agree, but the basket does not", never a pass. **Producer (WO-S, Keel) does not exist.** Reconciliation shape defined by Felix in the interface note; **a proposal until Keel builds against it.** |
| 8 | Stale service-worker assets cannot serve a broken version | **CLOSED — MECHANICAL** | The hand-typed literal is gone. `sw.js` carries `__SHELL_HASH__`; `sw-version.mjs` substitutes a content hash of all 8 SHELL files at serve time, so the cache name moves by itself and there is **no bump to forget**. Trade documented loudly in-file: served `/sw.js` bytes ≠ disk bytes; it is the only transformed response. Mutation-tested 12/12 (version moves per shell file, is stable when nothing changes, returns on revert, ignores non-shell files, and the un-derivable case is refused). **Proved on this very change**: `2e0013ef8cf5 → 23fcfe05dbf4`, no human involved. |
| 9 | API and proxy report unhealthy rather than a reassuring placeholder | **BUILT-NOT-VERIFIED** (needs restart) | `/asdair/health` now does `connect + SELECT 1 + release` through the **same** `getPool()` that 500-ed, and answers **503** when it cannot. The shell's app-status reads the **body**, not just the status line — `ok:false` is down whatever the HTTP code, and an unreadable body is the new `unknown` state rather than a guessed "down". Mutation-tested both halves. **Requires both restarts to be live.** |

---

## Open defects

| ID | Defect |
|---|---|
| D-2026-08-03-11 | **`render-check.mjs` is broken on this machine.** Headless Edge self-relaunches into a detached process; the harness gets nothing back. Fails identically on untouched `HEAD`, so it is environmental. **STILL BROKEN** — but no longer means UI changes ship unverified: `template-check.mjs` and `render-vm-check.mjs` are landed, mutation-tested and now run in CI. See `services/cockpit/VERIFICATION.md`. |
| — | **`nav-check.mjs` is broken the same way** — confirmed pre-existing, identical 11/41 failure on untouched `HEAD` content. Unchanged. |
| ~~—~~ | ~~Health does not check dependencies~~ — **CLOSED**, pending restart (row 9). |
| ~~—~~ | ~~The cache-version bump is manual~~ — **CLOSED, mechanically** (row 8). |
| **D-2026-08-04-06** | **`whyDown()` shipped two unreachable branches and reported a running service as down.** The cockpit told Warwick *"AsdAIr's read service is not answering on 127.0.0.1:8710 — 23."* while it was answering. A `fetch` timeout throws a **DOMException**, whose *legacy numeric* `code` is 23 (`TIMEOUT_ERR`); being truthy it shadowed `e.name`, so the `TimeoutError`/`AbortError` entries were dead from the day they were written. **FIXED** (`down-reason.mjs`, extracted so it can be executed) and pinned by 17 assertions incl. a real DOMException. A **lying red** costs trust as fast as a lying green. |
| — | ~18 orphaned windowless `msedge.exe` processes from render-check diagnostics; cleanup was blocked by permission gating. Unchanged. |
| — | **`.i-why` is `nowrap` + ellipsis.** Found while building the packet view: it would have silently truncated `quantity_rationale`, the one field the surface exists to show. The new markup uses the house's wrapping `.as-sub` throughout. **Pre-existing rows elsewhere still use `.i-why` and may be truncating** — not swept, not fixed, flagged here. |

### Compensating control used in place of render-check

Because `render-check.mjs` could not run, the 2026-08-04 rebuild was verified by compiling the
edited template with the production Vue compiler in a Node `vm`, **mutation-tested first**
(7/7 deliberate breakages caught, control clean). That surfaced a real blind spot worth
recording: **the prod `Vue.compile()` does not report unclosed tags or unterminated
attributes**, so a second independent structural scan was added to cover exactly that. One
instrument alone would have shipped a false green.

The render harness then executed the compiled render function against the live payload across
7 scenarios (live · all-sections-empty · service-down · rulebook · read-failed · empty
rulebook) — all rendered with no missing bindings.

~~**These harnesses live in a session scratchpad, not the repository.**~~ **LANDED 2026-08-04 (WO-ZG)**
as `services/cockpit/template-check.mjs` and `services/cockpit/render-vm-check.mjs`, with
`services/cockpit/VERIFICATION.md` carrying the reasoning and `fixtures/` carrying **synthetic**
payloads (the real ones are household data and must never reach this public repo). Both now run in
`.github/workflows/cockpit-private-apps.yml`, `--self-test` first.

Two things improved on landing rather than being copied across:

- **`render-vm-check.mjs` had no mutation test.** Its Proxy `has` trap is the entire detection
  mechanism, and a detector that has silently stopped detecting is indistinguishable from a clean
  run. It now self-tests 4/4.
- **Its raw-JSON detector was a false positive.** It flagged the *sanctioned* collapsed "Raw payload"
  drawer as if it were the `JSON.stringify` fallback bug. Now discriminated by position, and
  mutation-tested in **both** directions — it must catch a reinstated fallback **and** must not flag
  the drawer. A detector that fires on the feature gets ignored, which ends the same way as one that
  misses the bug.

---

## Upstream data contradiction surfaced by the rebuild

Line 1 of `SHOP-2026-08-03` carries `matched_regular_id: null` **and**
`note_display: "matched by approximate alias"`, arriving as `unmatched_new_item`. The
interpret module's own README rule 3 says a claimed match with no catalogue id should
downgrade to `needs_confirmation`. **The UI displays both rather than resolving it** —
resolving it in a view would be inventing. Unresolved upstream.

---

## Verdict

**Updated 2026-08-04 after WO-ZG. The Cockpit is still NOT signed off.**

What genuinely closed: **cache invalidation** is now a mechanism rather than a habit, and
**automated render verification exists again** — landed, mutation-tested, and in CI, rather than
living in a session scratchpad one `/clear` from oblivion.

What is built but **unproven where it matters**: the dependency-aware health chain and the app-status
fix are **BUILT-NOT-VERIFIED until both services are restarted** — and until then the live cockpit is
still the old code, still capable of saying *"— 23."* Every claim in row 9 is about code that is not
yet running.

What has a surface but no substance: the **Basket** tab renders the packet and reconciliation
faithfully against fixtures, but **WO-P and WO-S do not exist**, so on the live system it will show
"not produced" and nothing more. A rendered empty state is not a feature; it is an honest placeholder
for one. The reconciliation *shape* is Felix's proposal and **is not agreed with Keel yet**.

And the standing one: **rows 3, 4, 5, 6 and 7 have never been seen by Warwick.** Harness evidence is
not the same as a human looking at a phone.

**Not signed off. Tracked as WO-U / WO-ZG.** Nothing here should be read as a claim that the Cockpit
is finished.
