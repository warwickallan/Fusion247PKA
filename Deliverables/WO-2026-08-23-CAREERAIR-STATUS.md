# WO-2026-08-23-CAREERAIR-STATUS — per-opportunity status on the grid

**Governance head:** `67bede262c93b0e61ad68246972b34750284d357`
**Branch / worktree:** `wo/2026-08-23-cockpit-grid` in the PRIMARY checkout `C:/Fusion247PKA`.
**⛔ DO NOT cut a worktree.** Worktree isolation cuts from `origin/main`, which is 116 commits behind
and does not contain the CareerAIR grid at all. You would build against a tree without the feature.
**private_surface:** `none`. This work is database and public-repo code only. You do not read or write
`C:\.fusion247\**`. The CV files are not touched.

## The outcome

Warwick is triaging 354 opportunities on his phone and has no way to record what he has done with one.
He clicks into a listing, finds it is no longer accepting applications, and the next time he opens the
page it looks exactly the same. **Give every opportunity a status he can set with one thumb, that is
still there when he opens the page on a different device.**

His words: *"put a tick box on each card for status — Todo, reviewed, applied, no long accepting. make
Todo default."*

The four states are mutually exclusive, so this is a one-of-four control, not a checkbox. Everything
else about the interaction is yours.

## The four states — frozen, and the names are load-bearing in the schema

| Stored value | Shown to Warwick |
|---|---|
| `todo` | To do |
| `reviewed` | Reviewed |
| `applied` | Applied |
| `closed` | No longer accepting |

**`todo` is the default, and the way you make it the default is ABSENCE OF A ROW.** Do not backfill 354
rows. A row exists only once Warwick has moved an opportunity off `todo`. That makes the default a
property of the data model rather than of a migration, and it keeps the table small and honest.

## Where the state lives, and why

**Follow the precedent already in this service.** `services/cockpit/db.mjs` opens two pools:
`cp_directus` reads module data and can never mutate it, and `cp_worker` applies **the cockpit's own
surface lifecycle** — see `server.mjs:176`, `update cockpit.attention_item set status=$2 ...`, executed
through the `w()` helper.

This status is exactly that shape: **cockpit-owned lifecycle over a dataset the cockpit may only read.**
It does NOT belong in the CareerAIR module tables, and `cp_directus` could not write there anyway.

- New table in the **`cockpit`** schema. `cockpit.careerair_status` unless you find a better fit.
- Keyed by the opportunity id the grid already uses (text — the API emits `"1131"`, a string).
- Carries the status, an `updated_at`, and nothing else. No employer, title or URL — this table must
  never become a second copy of the opportunity.
- New migration in `services/control-plane/db/mypka/`, numbered **291**, forward-only, additive.
  Grants: `SELECT` to `cp_directus`, `SELECT/INSERT/UPDATE` to `cp_worker`. **Grant no more than that**
  — migration 290 is the read-grant precedent, read it before writing 291.
- **You are authorised to apply 291 to the live database.** It is additive, in the cockpit's own schema,
  and the feature cannot exist without it. You are NOT authorised to alter or drop anything existing.

## What to build

1. **The migration** (above), applied and proven applied.
2. **A write route.** `POST /api/careerair/status`, body `{id, status}`. Upsert through `w()` as
   `cp_worker`. **Validate the status against the frozen four** — an unknown value is a 400, never a
   write. **Validate the id against the real opportunity set**; do not write a status for an id that
   does not exist. Setting a status back to `todo` may either delete the row or store `todo`; pick one
   and say which.
3. **The list API carries the status.** Every row in `GET /api/careerair/opportunities` gains its
   status, defaulting to `todo` where no row exists. One query, joined — not 354 lookups.
4. **The control on each card.** Phone-first, thumb-sized, reachable without a zoom. A native `<select>`
   is the most reliable and accessible four-state control on a phone and needs no custom keyboard
   handling — take it unless you have a better reason not to. It must be obvious at a glance what an
   opportunity's current status is **without opening anything**.
5. **A status filter**, because the whole point is that dead rows stop costing him clicks.
   **Default: hide `closed`.** ⛔ **Never filter silently** — the page must always say how many rows are
   hidden and let him bring them back in one tap. A count that quietly disagrees with what is on screen
   is the defect this grid was built to avoid; `countsAgree` already exists in the list response for
   that reason, and your filtering must not falsify it.
6. **A failed write must be VISIBLE.** Optimistic update is fine, but reconcile against the response —
   if the write fails, put the control back where it was and say so on the card. A status that looks
   saved and is not is worse than no feature, because he will act on it.
7. **An executable check**, following the `*-check.mjs` convention already in `services/cockpit/`.
   **Make it fail on purpose before you trust it** — the containment canary in this same service passed
   with the defence removed entirely, which is why that rule is written here. Assert a non-zero
   executed count.

## Boundaries

- **Do not weaken anything the grid already guarantees.** No filesystem path, DSN, role name or private
  location may appear in any response, success or failure, including the 500 branch. That containment
  was fixed in `724f19f` after a leak — read it before touching the response shapes.
- **The public repository must contain nothing identifiable** — no employer, role, recruiter or
  opportunity name in code, comments, tests, fixtures or migration. Warwick's ruling, 2026-08-23:
  *"so long as there is nothing identifiable in the public repo, I don't give a shit."* CareerAIR's
  existence is fine; a company name is not. Use synthetic ids and titles in every fixture.
- `public/*` is live on save; **`server.mjs` and `careerair.mjs` are loaded once at startup.** Restart
  through the `MyPKA-Local-Services-Live` scheduled task, not a shell, and **verify through
  `http://warwick-yoga/careerair.html`** — the real URL on the real host, not localhost.

## Done means

Warwick opens `http://warwick-yoga/careerair.html` on his phone, sets one opportunity to `applied` and
another to `closed`, reloads, and both are still right — and the closed one is out of his way. Prove it
by executing that journey, not by describing it.

Commit on the branch. Do not push, do not open a PR, do not merge.

---

# AMENDMENT 1 — Larry, 2026-08-23, after Keel's read-back REFUSE

**The refusal was correct and is accepted in full.** The order handed a worker three things no Work
Order can reach — a migration against the live database, operating a live service, and writes to live
data. Those are mine, on Warwick's authority. They are removed from Keel's scope below, not
re-authorised in different words.

## The id-stability question — SETTLED by live read, and the answer removes the risk

Keel was right to refuse to assume it. Established directly against the live database:

- **`careerair.opportunity.opportunity_id` is `bigint default nextval(...)`** — a plain surrogate
  sequence. Not derived from any external id, so it cannot collide with a re-used source id.
- **The collector updates in place; it does not delete and reinsert.** 688 rows, **688 distinct
  non-null `source_fingerprint`s**, `203` rows with `submission_count > 1` and one at **143**. A
  delete-and-reinsert cycle would have reset those counters to 1. It did not.

**Therefore an `opportunity_id` belongs to one advert for that advert's life, and the dangerous case —
a status silently attaching to a different job — cannot arise.**

**`schema_decision`: NO binding fingerprint column.** Option (b) from the read-back is declined
*because the risk it defends against has been measured away*, not because it was a bad idea. It was
the right thing to propose while the question was open.

**`schema_decision`: store `todo` EXPLICITLY.** Keel's recommendation is adopted, and his reasoning
carries it: no DELETE grant is needed, migration 290's minimal-grant discipline is preserved, and
`updated_at` then records when Warwick moved a row *back*, which the delete route would throw away.
Absence of a row still means `todo` for every row he never touches.

**F4 — the split-pool validation is ADOPTED AS A DECLARED DESIGN DECISION, not discovered.** Validate
the id on `q` (`cp_directus`), write on `w` (`cp_worker`), no shared transaction. The worst outcome of
the race is a stale status row, never corruption. **Do not grant `cp_worker` anything in the
`careerair` schema** — 290 argued that boundary in writing and it stands.

## `file_surface` — declared

`services/control-plane/db/mypka/291_careerair_status.sql` (new) ·
`services/cockpit/careerair.mjs` · `services/cockpit/server.mjs` ·
`services/cockpit/careerair-check.mjs` · `services/cockpit/public/careerair.{js,css,html}` ·
`services/cockpit/README.md`. **Not** `provenance.mjs` — keep the status code inside `careerair.mjs`,
per the read-back's own reasoning.

## F8 — public/** stays with Keel, and the basis is named

Critical rule 10, subject to `render-check.mjs`. Not split to Felix: the control is inseparable from
the route and the failed-write reconciliation behind it, and a handoff would put the two halves of one
interaction in two heads. **Vera's visual gate is unaffected and still applies to the rendered page.**

## Acceptance — replaced, because the original could not go green for the worker

Keel proves, on **disposable and offline targets only**:

1. **291 on `test/run-migration-test.sh`'s throwaway cluster** — applies, re-applies idempotently, and
   the grants are exactly right **on both halves** (`cp_directus` SELECT only; `cp_worker`
   SELECT/INSERT/UPDATE only; neither reaching further).
2. **The route as a pure function in `careerair.mjs`** returning `{status, body}`, so the check
   executes it with no credentials present. Thin wiring in `server.mjs`. Unknown status → 400, never a
   write. **Errors return a code, never `e.message`** — no path, DSN or role name in any branch.
3. The list join · the card control · the default-hide-`closed` filter with its visible count and
   one-tap restore · failed-write reconciliation · `render-check.mjs`.
4. **`careerair-check.mjs` offline assertions, each mutation-tested** — break every new defence on
   purpose, show the check goes red, assert a non-zero executed count.
5. Surface-scoped secret scan. Commit on the branch. No push, no PR, no merge.

**Larry then executes, on Warwick's authority:** apply 291 to live · restart via the scheduled task ·
run the live half of the check · put the journey in front of Warwick on his phone.

## Out-of-scope findings from the read-back — Warwick's to schedule, not work

- `/api/opportunity-decide` and `careerairListResponse` still return `e.message`, which can carry a
  role name. Same class as the leak fixed in `724f19f`, which only covered the CV route. **Recorded,
  not fixed here.** The new route must not repeat it.
- `cockpit.opportunity` already exists (migration 271, Mason's, unrelated dataset, and it already has a
  four-state human `disposition`). **`cockpit.careerair_status` is the right name;
  `cockpit.opportunity_status` would be a landmine.** Good catch — it stands.
- `sw.js` needs no change and adding one would be wrong. Checked and correctly left alone.
