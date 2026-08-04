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
| 6 | The Brand-ordered Sonnet packet visible | **ABSENT** | The packet itself does not exist — WO-P. Nothing to display. |
| 7 | Basket reconciliation visible | **ABSENT** | Reconciliation against expected counts does not exist — WO-S. |
| 8 | Stale service-worker assets cannot serve a broken version | **PARTIAL** | Cache bumped v23→v24→v25 by hand each time. **There is no mechanism preventing a future change from shipping without a bump** — the control is a habit, not a mechanism. |
| 9 | API and proxy report unhealthy rather than a reassuring placeholder | **PARTIAL** | The shell proxy fails soft and the UI degrades to an honest offline state (verified). But `/asdair/health` returned `ok: true` on 2026-08-03 **while `/asdair/workspace` was 500-ing on a missing `pg` module** — health did not reflect its own dependency. Not fixed. |

---

## Open defects

| ID | Defect |
|---|---|
| D-2026-08-03-11 | **`render-check.mjs` is broken on this machine.** Headless Edge self-relaunches into a detached process; the harness gets nothing back. Fails identically on untouched `HEAD`, so it is environmental. **Cockpit UI changes currently ship without automated render verification.** |
| — | **`nav-check.mjs` is broken the same way** — confirmed pre-existing, identical 11/41 failure on untouched `HEAD` content. |
| — | **Health does not check dependencies** (row 9 above). |
| — | **The cache-version bump is manual** (row 8 above). |
| — | ~18 orphaned windowless `msedge.exe` processes from render-check diagnostics; cleanup was blocked by permission gating. |

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

**These harnesses live in a session scratchpad, not the repository.** With `render-check.mjs`
broken that is a real hole in the durable control set. Landing them is outstanding.

---

## Upstream data contradiction surfaced by the rebuild

Line 1 of `SHOP-2026-08-03` carries `matched_regular_id: null` **and**
`note_display: "matched by approximate alias"`, arriving as `unmatched_new_item`. The
interpret module's own README rule 3 says a claimed match with no catalogue id should
downgrade to `needs_confirmation`. **The UI displays both rather than resolving it** —
resolving it in a view would be inventing. Unresolved upstream.

---

## Verdict

**The Cockpit is NOT operational for its stated purpose.** Overview and the photograph work
and are confirmed by Warwick. The readable Details view and the Rules tab are built, verified
against live payloads by harness, and **not yet seen by Warwick**. Two of the nine
requirements (the Sonnet packet, reconciliation) have nothing to display because the
underlying features do not exist. Automated render verification is broken.

**Not signed off. Tracked as WO-U.** Nothing here should be read as a claim that the Cockpit
is finished.
