# CareerAir — what transfers from AsdAIr

**Written 2026-07-28 by Larry, at the close of BUILD-015, for whoever starts CareerAir.**
The *concept* is different. The **process, architecture and failure modes are the same**, and most of the
expensive lessons are already paid for. Read this before designing anything.

> Warwick's sketch: drop a **job-ad URL into Telegram**, or a **screenshot into Cockpit**, and the process runs.
> Later, stretch goal: CareerAir goes **hunting** on LinkedIn and elsewhere, and *possibly* submits applications.
> Same input/output shape as AsdAIr.

---

## 1. The shape is identical — reuse it, don't rediscover it

```
inbound (Telegram | Cockpit)
  → durable record + immediate receipt with buttons
  → grounded interpretation against the person's OWN durable context
  → human review where genuinely ambiguous
  → deterministic planning
  → question loop (Telegram cards + Cockpit, same commands)
  → durable request for a browser action
  → independent visible browser runner
  → truthful progress in BOTH surfaces
  → HUMAN does the consequential act
  → outcome recorded → permanent learning for next time
```

AsdAIr's shopping list is CareerAir's job ad. Its trolley is your application. Its checkout — the thing a human
must always do — is **submitting an application**.

## 2. THE most important transfer: ground against the person's own catalogue

**This is the lesson that changed AsdAIr's design, and it will change CareerAir's.**

I first tested vision by asking a model to read a handwritten list *open-ended*. It read "Gourmet **cat food**" as
"gourmet **coffee**", invented a line, and I concluded the model was unfit. **That was the wrong experiment.** The
product never asks "what does this say?" — it asks *"given this household's known products and aliases, which of
them does each mark refer to?"* Re-tested that way, same model, same photo: everything read correctly, nothing
invented, and end-to-end resolution went **52% → 90%**.

**For CareerAir the catalogue is Warwick himself:** skills, experience, the roles he wants and doesn't, salary
floor, location/remote constraints, sectors he'll refuse, companies already applied to, what got a reply, what
got rejected and why, CV variants, the phrasing he actually uses.

So the interpretation question is never *"what is this job ad?"* It is:

> **"Given what I know about Warwick, what does this ad mean FOR HIM — does it fit, what's missing, what's the
> risk, has he seen this company before?"**

**The authority boundary that follows** (copy it verbatim): the model **READS and RANKS** · the **catalogue
DETERMINES IDENTITY** · the **human resolves genuine ambiguity** · **confirmed outcomes enrich the catalogue**.
The model returns a **candidate id**, never free text that becomes canonical — so it cannot invent a skill,
a company or a role that doesn't exist in his record.

**And both arcs are one cycle.** Write the learning back every time (new company, new alias for a role title, a
rejection reason) *because that is what grounds the next interpretation*. Skip the write-back and the read
degrades against a stale catalogue. AsdAIr appeared to work for weeks only because a session's context was
holding the catalogue — which is not durability, it's a coincidence with a short half-life.

## 3. Directly reusable code — read these before writing anything

| Need | Take from |
|---|---|
| Telegram intake, single-poller, offset discipline | `services/asdair/intake/` |
| Durable state machine + status projection | `services/asdair/shop/` (`shopState`, `shopStore`, `shopStatus`) |
| Telegram cards, `asd:`-style callback protocol, **render contract** | `services/asdair/bot/` |
| Channel-neutral command surface + resumable advancer | `services/asdair/pipeline/` |
| Catalogue loading + grounded prompt + **deterministic identity resolver** | `services/asdair/interpret/` |
| **Independent browser runner (CDP)** | `services/asdair/browser-runner/` |
| Governed writers, `--dry-run` discipline, column-scoped grants | `services/asdair/outcome/` |
| Cockpit `Apps ▸ <App> ▸ Details` workspace | `cockpit-home/src/asdairWorkspace.vue` + `services/asdair/cockpit-api/` |
| Runtime launcher, exclusive lock, arming gate | `services/asdair/pipeline-runtime/` |

**The Cockpit pattern is settled:** a first-class **Apps** tile, then the App, then Details — never folded into an
unrelated view. Telegram and Cockpit are two **clients of one backend**; neither may hold shopping/career logic.
An answer in one must clear the question in the other *because both went through the same command*.

## 4. The browser runner transfers — but LinkedIn is a harder target than ASDA

**Proven and reusable:** a plain Node process driving **Chrome DevTools Protocol** against a **dedicated
persistent profile** (`--remote-debugging-port` + `--user-data-dir`). No Claude Code, no MCP, no extension, no
Playwright. It added a product by reference, searched and added another, used real +/− controls, read state back,
and restored the page exactly. **~30 lines of CDP client.**

Why a *dedicated* profile: the runner owns it, so automation never touches Warwick's daily browsing and the login
persists across restarts. Warwick signs in **once**; the runner has **no command capable of entering a password**
and detects/reports re-auth rather than resolving it.

**Where CareerAir is genuinely harder — plan for these, don't discover them:**

- **LinkedIn actively detects and blocks automation**, far more aggressively than ASDA. Expect challenges,
  throttling and account risk. **The account at risk is Warwick's professional identity** — a much higher cost
  than a spoiled shopping basket. Treat account safety as a first-class design constraint, not an afterthought.
- **ASDA signed us out mid-build from a burst of page loads alone.** Pace requests deliberately. And detect the
  signed-out **state**, not just a redirect — ASDA rendered normally when logged out and only bounced when the
  trolley was touched, so a redirect-only check would have hit the auth wall *halfway through*.
- **Scraping and automated applying may breach site terms.** That's a real constraint on the design, and it is
  Warwick's call to make knowingly — surface it, don't quietly build around it.
- **Submitting an application is CareerAir's checkout.** It is consequential, largely irreversible, and
  reputational. It gets the same absolute gate: the runner builds a *ready-to-submit* application and **stops**.
  A bad basket costs £4; a bad application costs a shot at a job.

## 5. Invariants to copy on day one — these are paid-for

- **Never acknowledge before durable persistence.** AsdAIr advanced the Telegram offset before writing the
  record; a crash in that window **silently lost a shopping list**. Persistence is a *precondition* of
  acknowledgement. Prefer duplicate-risk to loss-risk, then make the duplicate impossible with a unique index on
  the natural key.
- **Structural beats conventional.** Unique indexes, CHECK constraints and **column-scoped grants** held; care and
  comments didn't. AsdAIr's learning writer physically *cannot* retire, rename or re-home a record — the grant
  forbids it, whatever any model decides. Do that for CareerAir's CV/profile data.
- **Exactly one poller** on a destructive-ack stream (bind the lock to pid + OS creation time + command line, so a
  recycled pid can't masquerade as a live holder). **Exactly one writer** on a shared live session (atomic claim +
  bounded lease + **fencing on every write**, so a stale runner waking after a takeover stops rather than resumes).
- **Unknown is a first-class value.** Never fabricate a number. AsdAIr renders `null` as "unknown" while a real
  `0` stays `0`, and labels an inferred price as *derived, not quoted*. CareerAir will be full of unknowns —
  salary, seniority, whether it's really remote. Say "unknown".
- **Don't guess to fill a schema field.** Nothing fitting → `unmatched_new_item`, never the least-bad candidate.

## 6. Process lessons — how to build it faster than I built AsdAIr

- **Build the thin vertical path FIRST.** I built nine correct, well-tested modules before the keystone that
  joined them, and Warwick had to intervene. Integration is where the real defects live — the ack-ordering bug
  existed only at a seam, so no module's own tests could have caught it.
- **Author the schema first; it is the integration seam** for parallel workers. It worked well — but publish the
  *semantics* of ambiguous columns too. Two workers independently misread `product_alternatives.id` as a product
  id. Disjoint file ownership prevents collisions, **not shared misunderstanding**.
- **Relay any discovered false assumption to every in-flight worker immediately.** One message caught a second
  live instance of that same bug.
- **Delegate hard, keep one integration owner.** Fresh focused workers outperformed me late in a long session.
  Fatigue is a reason to delegate, not to stop. But contracts, migrations, merge and live actions stay with one
  person.
- **Run the smallest real experiment instead of reasoning further.** The CDP test settled in minutes a question
  that had survived several rounds of careful argument.
- **Pin a known defect as an assertion that FAILS when it's fixed.** AsdAIr's proof asserted the data loss; the
  day the ordering was fixed it went red, and we inverted it to assert survival. Best pattern in the build.
- **Declare every dependency.** Five modules `require`d `pg` without installing it — each a committed runtime
  caller that would crash on first real use.
- **Distinguish code-ready · product-accepted · operationally-activated.** Never let a merge imply the last one.

## 7. Start here

1. Define the **catalogue** (Warwick's durable career context) and its **write-back path** before anything else.
   That is the whole product; everything else is plumbing that already exists.
2. Build the **thin vertical**: URL/screenshot in Telegram → durable record → grounded interpretation → receipt
   with buttons → Cockpit shows the same thing. Nothing else until that works end to end.
3. Only then: hunting, ranking, and a *ready-to-submit* application that a human sends.

**Read:** `SOP-021` (the operating loop), `Team/Asdair - Household Shopping Steward/AGENTS.md` (specialist
boundaries), `services/asdair/interpret/README.md` (the grounding invariant and its measurement), and
`services/asdair/browser-runner/EXPERIMENT-RESULT.md` (why CDP, why a dedicated profile).
