---
name: careerair
description: "The daily job-search round. Pull the email intake, sweep LinkedIn with the banked search terms, screen out everything already applied to or the wrong shape, and put a short honest list in front of Warwick."
user_invocable: true
---

# /careerair: the daily round

You are Larry.

**Run this at the start of a session, after a `/clear`, or whenever Warwick asks what is new.** It is a
READ-AND-REPORT routine. It sends nothing, applies to nothing and contacts nobody.

> **Built 2026-09-21 after an evening where the pipeline surfaced a role Warwick had already been
> rejected from, one he applied to the week before, an SAP procurement role, a payments contract and a
> high-voltage electrician's job, all scored 7 to 9 and all presented to him as "open".** The
> screening this file mandates is the whole point of it. Skipping to the list is how that happened.

**This is a WRAPPER over scripts that already exist. Do not build a service, a store, a register or a
new screen. If you find yourself writing one, you have misread this file.**

---

## ⚑ WHERE EVERYTHING LIVES. Read this before running anything.

**None of this is in the repository.** The whole CareerAIR runtime lives in the private tree:

```
ROOT:  C:/.fusion247/private/careerair/
```

**Every relative path below is relative to that root.** Declared private surface for this routine is
`C:/.fusion247/private/careerair/**` plus READ of the send folder; load `GL-012` before touching it.

| What | Path under ROOT |
|---|---|
| **The search terms** | `config/search-terms.json` |
| Job-board sender list | `config/job-alert-senders.json` |
| Gmail collector | `scripts/careerair-gmail-collect.mjs` |
| Email intake run | `scripts/careerair-email-run.mjs` |
| Guest-API sweep | `scripts/sweep-windowed.mjs` |
| Sweep triage screen | `scripts/triage-windowed.mjs` |
| Prior-work check | `src/gate/prior-work.mjs` |
| Role-shape screen | `src/gate/role-shape.mjs` |
| Published boards | `runtime/board/` |
| Sweep output | `runtime/sweeps/` |
| Application folders and ledgers | `runtime/applications/` |
| Standing form answers | `runtime/applications/_STANDING-FORM-VALUES.md` |
| CV masters | `runtime/masters/` |
| **The send folder (outside ROOT)** | `C:/Users/Buggly/Documents/CareerAIR CVs` |

Every script needs the env-file pair and reads its own credentials. Never prepare the shell, never
pass a connection string:

```
node --env-file=C:/.fusion247/careerair.env --env-file=C:/.fusion247/fusion-capture-gateway.env <script> [args]
```

---

## Step 1. Intake: What has arrived by email.

The Gmail collector and the email runs are **already on the Windows scheduler**. Check before you
invoke anything:

```
Get-ScheduledTask | Where-Object { $_.TaskName -match 'CareerAIR' } | ForEach-Object { $_ | Get-ScheduledTaskInfo }
```

- Collector: `scripts/careerair-gmail-collect.mjs` (`--dry-run` first, always)
- Intake run: `scripts/careerair-email-run.mjs --dry-run`, then `--kind manual` if something is queued

**The cursor is authoritative, not the clock**, so a manual run cannot duplicate and a missed slot
self-heals. If nothing is queued, say so and move on. **Do not run the pipeline to look busy.**

The run publishes a board under `runtime/board/`. Read it. Do not re-derive it.

⚠ **The collector only sees mail it is configured for.** Job-board senders that deliver to the bare
address need an entry in `config/job-alert-senders.json`. A healthy collector reporting `new=0` means
its channel found nothing, **not** that nothing arrived.

## Step 2. Sweep: What is live on LinkedIn.

Two routes, and they do not return the same thing:

**The guest API sweep.** `scripts/sweep-windowed.mjs [N]`, 24h and 7d windows, North West ring and
UK-wide. Fast, no login, writes `runtime/sweeps/<date>-windowed.tsv`. Its measured quirks are recorded
in `config/search-terms.json` under `_api_facts` and you should not re-derive them: page size is 10
not 25, the ceiling is ~100 per query, `f_TPR` barely filters, and the title must be parsed from the
href slug because the card markup returns empty strings silently.

**The logged-in browser.** For anything the guest API cannot see. A real row has been missed by the
API and found only in the browser, so where Warwick asks for the browser specifically, use it.

### Running a term in the browser

**The terms are in `config/search-terms.json` (73 of them). Read that file; do not carry terms in
your head and do not retype them from memory.** Each carries a `cluster`, a `state` and a measured
`yield`.

**Selection:** take `state: "core"`, sort by `yield` descending, and run the top eight to ten. Running
all 73 through a browser is not feasible and the yield figures exist so you do not have to.
`state: "search-but-expect-zero"` is exactly what it says. `state: "body-screen-only"` terms are too
broad to search and are applied when reading a body.

**One term, one URL:**

```
https://www.linkedin.com/jobs/search/?keywords=<term>&location=United%20Kingdom&f_TPR=r86400&sortBy=DD
```

`f_TPR=r86400` is the last 24 hours; `r604800` is 7 days. `sortBy=DD` puts newest first, so page one
is the useful page.

**Location is `United Kingdom`, deliberately.** The `geography` block in the same file explains why
and it is not negotiable: LinkedIn tags many remote roles to a city, `f_WT=2` is ignored by the guest
search, and killing on the city label once discarded 2,281 rows of which 692 passed the role screen.
**Geography is decided from the advert BODY, never from the card.** The file also holds the accept
lists and the note that 25 miles from Birkenhead excludes Manchester, which is why Manchester rows
only ever appear on a manual sweep.

**Reading the results:** the list is virtualised, so scroll it to load rows before extracting, and
pull the cards out of the DOM. Do **not** use page-text extraction on the search page, because it returns the
detail pane of the selected job, not the list.

### ⛔ MEASURED BROWSER FACTS, 2026-09-22. Read before you re-derive any of this.

- **`javascript_tool` is BLOCKED on LinkedIn job pages.** Any script whose result touches `href`
  values or card data attributes returns `[BLOCKED: Cookie/query string data]`. It worked for two
  queries and the guard then held permanently. Do not build a sweep on it.
- **`get_page_text` on a SEARCH page is a coin toss**, which is what the warning above means in
  practice: it returns `Source element: <main>` (the list, usable) or `Source element: <article>`
  (the detail pane of whichever job auto-selected, useless). **Check which one you got before
  believing a single row.** On a JOB DETAIL page it is reliable and is the right tool.
- **ALWAYS WAIT 6 SECONDS BETWEEN `navigate` AND ANY READ.** LinkedIn is a client-side router: the
  URL changes instantly and the list re-renders seconds later. Reading immediately returns the
  PREVIOUS query's rows, silently and plausibly. On 2026-09-22 three consecutive terms returned
  identical irrelevant rows this way and it was very nearly written up as LinkedIn rate-limiting.
- **Reading one advert:** navigate → wait 6s → `find` the "more" button → click it → `get_page_text`.
  That sequence is proven and repeatable.

### ⭐ THE RELATED-JOBS RAIL BEATS THE TERM LIST. **Established 2026-09-22, and it is not close.**

Every job detail page carries a **"More jobs"** rail of roughly twelve recommendations. On
2026-09-22 the ten banked terms produced almost nothing usable, while the rails off two adverts
produced **La Fosse Lead Implementation Manager (Manchester, GBP 90-100k, 12 hours old)**, erg group
Software Implementation Lead (GBP 70k), Loftware Manager Implementation Services (GBP 85-110k),
Altum Systems Implementation Lead (GBP 85-95k), Marmion SaaS Professional Services Manager
(GBP 60-90k) and Pinpoint Enterprise Implementation Manager (GBP 70-90k) — **most of them carrying a
published salary, which the term search rarely surfaces.**

**So: open two or three well-matched adverts and harvest their rails.** LinkedIn's own recommender
is reading the whole advert; a keyword is reading the title. **This does not replace the terms** —
it is the step that was missing after them.

⚠ **LinkedIn is retiring classic job search** ("gradually retiring classic job search starting in
September", their own banner). The AI-search entry point was **not** present on this account's
`/jobs` page when looked for on 2026-09-22. Expect this whole route to change and re-measure rather
than assume.

## Step 3. Screen. **This is the step that earns the skill.**

Run every candidate through all three, in order. **A list that has not been through these is not a
shortlist, it is a dump.**

**a. Prior work, `src/gate/prior-work.mjs`.** Has anything already been done about this?
Matching is **employer → role → id, in that order**. Warwick's ruling, 2026-09-21:

> *"Company name should be first clue! Then job role, then an ID… IDs should be tie breakers and
> validators, not key search term."*

An absent id, or an id in a different scheme, **must never prevent a match**. Same advert blocks.
**Same employer, different role, WARNS and does not block.** Deliberate re-application to one
employer is normal and has happened.

**b. Role shape, `src/gate/role-shape.mjs`.** Nine hard gates and twenty-four shape patterns, lifted
from the sweep triage. It **ranks rather than bins**, per the 2026-08-29 amendment. Without it, a
non-software job scores 9 on delivery verbs alone.

**c. ⛔ READ THE ADVERT BODY before you recommend anything.** The fit score measures requirement
coverage. It does not know whether the job is a software job. Three roles scored 8 and survived both
automated screens on 2026-09-21; all three died on the first paragraph of their own advert.

**The platform-noun test** is the one that catches most of them: a stated requirement naming a product
Warwick has never worked in kills the role however well the delivery language matches. Integrating
**into** a platform is not implementing it.

## Step 4. Report.

**Short. Opinionated. Body-read.** For each row worth his time: employer, role, location, what it
actually is, why it fits or does not, and the one thing that would kill it.

- **Name the kills too**, with the reason, so the same advert does not come back next week.
- **Never present a score as a verdict.** It is a sort order.
- If nothing is worth his time, **say that**. A short honest list beats a long one.

---

## Hard rules

1. **⛔ Never submit, apply, or contact anyone.** This routine reads and reports. Applications are a
   separate, deliberate act with Warwick in the loop at the submit.
2. **⛔ Never recommend from a title and a score.** See step 3c. This is the failure the skill exists
   to prevent.
3. **Check the send folder, not just the database.** `C:/Users/Buggly/Documents/CareerAIR CVs` is the
   fullest record of real work done and was reconciled by nothing until 2026-09-21. Files there use
   three different key schemes; roughly a hundred carry no advert id at all.
4. **Outcomes live in the email store.** Rejections and interview invitations arrive by email and can
   only reach an application record once that application exists in the ledger. If something looks
   stranded, that is a real finding, not noise.
5. **Report what you measured.** Counts from the instrument, never an estimate, never a number carried
   over from a previous run.
6. **Proportionate.** This is a personal job search on a laptop. Working and honest beats complete.

## What this is not

Not a tracker, not a governance layer, not a scheduler. The scheduler already exists. The screens
already exist. **This file only puts them in the right order and refuses to skip step 3.**
