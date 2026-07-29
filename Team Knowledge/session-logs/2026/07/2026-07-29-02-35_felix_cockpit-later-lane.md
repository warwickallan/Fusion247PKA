---
agent_id: felix
session_id: cockpit-later-lane-and-nav-reachability
timestamp: 2026-07-29T02:35:00Z
type: end-of-session
linked_sops: ["SOP-003-felix-build-a-component", "SOP-022-work-order-preflight"]
linked_workstreams: []
linked_guidelines: ["GL-003-design-system"]
---

# Cockpit: the Later lane, two orphaned nav targets, and a gate that graded itself green over ground it never read

## Context

Larry dispatched a bounded build: give the cockpit's deferred items a home. `defer` had been a
first-class decision since the surface was written — `server.mjs` even comments *"deferred feeds the
Later section"* — but no Later section existed. Deferring an item removed it from Home and put it
nowhere. Archive had the same shape of problem from the other end: it existed, and nothing on any
screen linked to it.

The read-back gate ran first and was accepted; this log covers execution only.

## What we did

- **Built the `area==='later'` section** in `services/cockpit/public/app.js`, immediately before
  Archive. Header + count, back to Home, empty state, honesty sub-line. Items render as plain
  `.item.grey` on the neutral `--park` rail. Restore is `decide(it,'reopen')` labelled **"Bring
  back"** — byte-for-byte the same action and the same word as Archive.
- **Added two Home entry rows** with counts, directly under `.tiles` and above Latest.
- **Fixed both orphaned nav targets**: `go('attention')` → `go('ideas')` (Brain "Make better" tile)
  and → `go('home')` (Archive back). `attention` has not been a rendered area for months.
- **Bumped `sw.js` to `f247-cockpit-v22`.**
- **Wrote `services/cockpit/nav-check.mjs`** — a new gate, deliberately outside `public/` so it needs
  no service-worker shell entry.
- Verified with `render-check.mjs` on port 8099, headless screenshots at a true 360px and 1280px in
  both colour schemes, and trusted-key-event keyboard testing over CDP.

## Decisions made

- **Question:** Should the Later lane apply `.item.deferred`?
  **Decision:** No. The `opacity:.7` fade is how a deferred card is marked when it sits *among live
  ones*. In a lane where everything is deferred it signals nothing and only costs contrast — it
  composites `--ink2` body text down to 3.63:1 (GL-003 D-18). The lane is the signal. D-18 does not
  ship. `nav-check` asserts this, and I falsified the assertion to prove it bites.

- **Question:** Should the two Home entry rows render only when non-empty?
  **Decision:** No, render unconditionally. A destination that only exists while it is non-empty
  cannot be learned — which is precisely how Archive became unreachable.

- **Question:** `sw.js` v21 → v22 as briefed, or v20 → v21 as my base implied?
  **Decision:** **v22.** The brief said v21→v22; my stale base said v20. Bumping to v21 would have
  collided with the cache version already installed on Warwick's device and silently served him the
  old bundle. Take the number that invalidates *every* existing cache, not the arithmetic one.

- **Question:** Fix the small back-chevron target while I am in there?
  **Decision:** No. `.p-h .back` renders 5×19 CSS px and fails WCAG 2.2 SC 2.5.8 — `styles.css:90-93`
  already documents this and fixes it *only* inside `.apps-pane`. Later now replicates the defect
  deliberately, so it stays visually identical to Archive rather than becoming a fourth back-button
  variant. Routed to Iris as one defect covering three panes. Keyboard operability *was* added to the
  two new rows, because shipping a brand-new unreachable control is creating a defect, not
  inheriting one.

## Insights

**1. A parser's output must never be trusted without a second source that would disagree.**
`nav-check` printed a green tick while asserting **one of six** `AREAS` entries. My `blockAfter()`
helper balanced on `{`, so slicing `const AREAS = [ {...}, {...} ]` returned only the first object.
The gate written specifically to catch "a nav target that resolves somewhere nobody checked" had
exactly that bug inside it. The fix that generalises is not the brace fix — it is the cross-check now
beside it: **`rendered nav-btn count === AREAS parsed count`**. Static analysis and the DOM are two
independent sources; when a parser under-counts, they disagree loudly instead of agreeing quietly.

The same shape appeared a second time in the same file: the "entry rows sit above Latest" assertion
was passing while Latest was absent from the fixture. An ordering check against an element that isn't
there passes by saying nothing. The fixture now forces Latest to render, and a preceding assertion
proves it did.

**And a third time, in the comment rather than the code — caught by Vera, not by me.** I wrote that
the DOM cross-check was "the standing guard on the nav's size". It is not, and could never have been:
the nav renders from `v-for="a in AREAS"`, so `navBtns` and `areasKeys.length` **derive from the same
array and move together**. Delete an entry and they still agree, at 5 == 5. Vera proved it by
mutation — the gate passed at 39 assertions with the nav silently down to five. Reading the code
would not have found this; only mutating it did.

The generalisation, which is the durable part: **a cross-check between two values derived from the
same source can verify the derivation, never the source.** Mine verified my parser against the DOM,
which is real and is what caught the under-count. It cannot verify AREAS itself. An invariant about
the source has to be pinned to something outside it — a literal. So `NAV_SIZE = 6` now sits beside
it, deliberately not computed from AREAS, with the failure message telling the next person to edit
the number and say so in the PR. Falsified with Vera's own mutation: the gate now exits 1 where it
previously passed.

Worth stating plainly because it is the more dangerous half: **a rule that overstates its reach is
worse than one that says less**, because the overstatement is exactly what stops anyone writing the
guard that is actually missing. "Is the nav still six entries?" was asked across three review rounds
and nothing ever held it — every confirmation was a human counting.

**2. `--window-size` cannot measure a narrow viewport on this machine, and every claim made with it
is wrong.** `msedge --headless --window-size=360,900` yields `innerWidth=492`. The window width
clamps at 492 and `--force-device-scale-factor=1` does not lower it (`--window-size=200` also gives
492). My first screenshots showed catastrophic horizontal overflow — the nav cut to four entries, the
tiles sliced in half — and I nearly reported it as a defect. It was a 360-**device**-pixel crop of a
540 **CSS**-pixel page. The baseline capture of the unmodified file looked identically broken, which
is what stopped me.

`Emulation.setDeviceMetricsOverride` over CDP is the only method that produces a real viewport, and
`Emulation.setEmulatedMedia` the only one that produces a real `prefers-color-scheme`. At a genuine
360px there is **no overflow at all** (`scrollWidth === clientWidth === 360`, zero overflowing
elements). **Consequence: any "verified at 360px" claim made on this box with `--window-size` was
really a 492px check**, including ones already accepted elsewhere in the estate.

**3. Keyboard claims need trusted events, not synthesised ones.** A `new KeyboardEvent('keydown')`
fires the Vue handler and tells you nothing about tab order or `:focus-visible`. Driving
`Input.dispatchKeyEvent` over CDP proved the real thing: the Later row is reachable at tab 17,
`:focus-visible` matches, Enter opens Later, Space opens Archive **and `scrollY === 0`** — which is
the only way to know the `.prevent` modifier actually suppressed page scroll.

**4. The brief was right and my reported diagnosis was half wrong — the correction is the useful
part.** I found my worktree carrying a 591-line `app.js`, a five-entry nav, no `apps.js`, and a
`styles.css` with all sixteen contrast defects open — while the running cockpit had 727 lines, six
entries, and every defect closed. I concluded the live tree held uncommitted work and the fixes lived
on unmerged agent branches. **That was wrong, and I withdraw it.** Verified after the fact:
`refs/heads/main` is `d67a5e6`, its *committed* cockpit is byte-identical (modulo line endings) to
what Warwick is running, and both merges are properly on main at Vera-passed heads (`a6e4e13` Apps,
`d67a5e6` contrast).

The real finding is sharper and is a tooling hazard, not a hygiene one: **my worktree HEAD was
`9256abf`, which is exactly `origin/main` — five commits and two merges behind local `main`.** The
isolation cut from the *remote-tracking ref*, not the local branch. That explains why a second worker
hit an identical stale base at an identical commit earlier the same day: `origin/main` is a fixed
point until someone pushes, so every worktree cut this way lands on the same stale SHA and will keep
doing so.

Two consequences worth carrying: building on that base would have shipped a five-entry nav, deleted
the Apps pane and re-opened sixteen measured contrast defects **while passing every gate**; and
`main` is currently **five commits ahead of `origin/main`, unpushed**, which sits badly against the
estate's standing "zero local-only commits" posture.

**5. A patch header is an instruction to write somewhere.** My first patch was produced with
`diff -u <live-absolute-path> <worktree-path>`, so its header carried
`C:/Fusion247PKA/services/cockpit/public/app.js`. Under `patch -p0` that would have written straight
into Warwick's live, no-build-step, instantly-served file — the one artefact in this estate we most
protect — from a reviewer merely trying to *check* whether the patch applies. Vera caught it, hashed
the live files first, rewrote the headers to relative, applied only inside a staged copy, and
confirmed the live md5s were identical before and after.

Patches now come from `git diff <base>` with `a/`…`b/` prefixes. Regenerated against `main`
(`d67a5e6`), dry-run then applied into a staged copy of main's blobs, and the result verified
byte-identical to my build; live md5s unchanged throughout. **The rule: never hand anyone a patch
whose header names a live path. A diff is a description, but a patch header is a destination.**

**6. Verify the base, not just the line numbers.** The brief warned that stale references had bitten
this work once and told me to re-verify line numbers. The line numbers turned out to be *correct*
(556/557/577 landed exactly). It was the file underneath them that was wrong. Checking the numbers
would have passed; checking the file is what caught it.

## Realignments

- Larry, on my report: *"Your mitigation was right. Your diagnosis was half wrong… `main` is not
  behind. Your worktree was."* Correct, verified independently, and recorded in Insight 4 above. The
  lesson I take: when I found a divergence I named the *symptom* (live ≠ my base) and then guessed at
  the *cause* (uncommitted work) instead of resolving `refs/heads/main` — which was one command away.
  State what was proven; resolve the ref before theorising about it.

## Design-system notes

**No `styles.css` change, and the claim is checkable by diff rather than by measurement.** Every
class reused is already measured PASS in GL-003 §2b on the current stylesheet: `.item.grey` rail
4.74/3.42, `.i-title` `--ink`, `.count` 6.64/8.23, `.empty` 6.59/8.34, `.grp h2`, `.back`, `.act`.
The one pairing not in the table is the bare `.i-eyebrow` (`--ink` at `opacity:.85` on `--panel`);
computed per §2d it is **10.30 light / 10.24 dark**, and it is the identical pairing the existing
Latest rows already use. Using `.empty` for the honesty sub-line follows the in-file precedent set by
the Brain pane's explanatory paragraph — not a new role for the class.

Parked for Iris (hers, not mine to decide):

1. **`.p-h .back` fails SC 2.5.8** at 5×19 CSS px. Already fixed inside `.apps-pane` via `.app-back`
   (44×44); promoting that rule to `.p-h .back` closes it for Archive, Settings and Later at once.
2. **`--focus` token.** GL-003 §2a parks it `<unset>`. `:focus-visible` is scoped to `.tile`,
   `.app-nav-btn`, `.crumb`, `.apps-pane .back|.act`, so the new rows fall back to the UA ring while
   tiles get the accent ring. Naming the token and extending the selector to `.item[role="button"]`
   closes both halves.
3. **D-17 / D-18** remain open and untouched, as briefed.

## Open threads

- [x] **Vera's quality gate: PASS.** No CRITICAL, no HIGH. She reproduced the 40 assertions and six
      areas, falsified the gate in four directions, and confirmed `styles.css` byte-identical to
      live — she tried to falsify the no-new-pairing claim by measurement and could not. One MEDIUM
      (the overstated cross-check comment, Insight 1) — **closed**, gate now 41 assertions and
      falsified against her exact mutation. She independently confirmed the `v22` call was necessary
      and said she would have flagged `v21` as a defect.
- [ ] Larry to integrate. The patch applies cleanly to `main` (`d67a5e6`) directly — my built
      `app.js` differs from main's *committed* `app.js` by exactly the three hunks of this change,
      dry-run and applied in a staged copy with the result verified byte-identical to my build.
      **Do not commit the worktree**: it is based on `9256abf` and would re-introduce the Apps pane
      and contrast fixes as if they were new work on this branch.
- [ ] Reported, not fixed, by instruction: the shared detail sheet (`app.js:740`) offers **"Later"**
      on an item that is already deferred, reachable by opening a card from the Later lane. Harmless;
      special-casing a shared sheet was scope I declined to take unasked.
- [ ] `main` is five commits ahead of `origin/main`, unpushed. Larry's call, flagged not touched.
- [ ] Estate-wide, not this build: the Latest rows and the Archive/Brain item rows are
      `<div @click>` with no `tabindex` — not keyboard-reachable. The two new rows are. I did not
      retrofit the others.

## Next steps

- Vera runs the gate; I fix whatever she returns and resubmit.
- If `nav-check.mjs` survives review, it wants a home in whatever runs before a cockpit change is
  called done, alongside `render-check.mjs`. It is cheap: it serves `public/` itself with a stubbed
  `/api/state`, and never touches `server.mjs` or `db.mjs` — which matters, because `db.mjs` resolves
  the `pg` module and its credentials by **absolute path**, so a worktree copy of the server would
  open a live `cp_worker` **write** pool. Worktree isolation does not protect you there; the code
  opts out of it.

## Cross-links

- `[[2026-07-29-00-30_iris_populate-gl-003-from-live-cockpit]]` — GL-003 §2b/§2c is the measured
  record this build's contrast claim rests on, and the source of the D-18 decision above.
