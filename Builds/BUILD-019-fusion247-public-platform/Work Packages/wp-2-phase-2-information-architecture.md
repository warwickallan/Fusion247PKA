---
work_order_id: WO-2026-08-03-04
wp_number: WP-2
name: phase-2-information-architecture-and-content-model
build: BUILD-019
status: issued
owner: keel
return_to: larry
authorised_by: warwick
authorised_date: 2026-08-03
worktree: C:/fusion247-web
branch: build-019/phase-2-information-architecture
base_branch: build-019/phase-1-website-skeleton   # Phase 1 is NOT merged; build on top of it
file_surface:
  - C:/fusion247-web/**
private_surface: none
credential_scope: none
live_authority: none
network: npm-registry-and-github
dependency_policy: an MDX/content pipeline for Next may be added (e.g. next-mdx-remote or contentlayer-equivalent) plus any type/lint support it needs. Name every addition and justify it. No CMS, no database, no analytics, no auth.
out_of_scope_policy: report-only
operational_handoff: none
blocking_dependencies: none
tags: [build-019, phase-2, website, information-architecture, mdx]
schema_decision: n/a
security_inputs: n/a
outcome: Every top-level route in Wayfinder map §2 renders as a real page, the ShAits and GAiggles editorial area and the Human in the Poop landing/archive exist, and article content is authored as portable source that the site rebuilds from.
---

# WP-2 — BUILD-019 Phase 2: information architecture + content model

**Authority:** Warwick, 2026-08-03 — *"just get the website built."* The accepted Wayfinder map at `C:/Fusion247PKA/Deliverables/2026-08-02-build-019-public-platform-wayfinder-plan.md` is the contract. **Read §2 (product/brand architecture, site structure, tone, UX intent), §3 (product boundary), §7 (security), §10 (Phase 2 row) and §11 (Larry's authorities) before planning.**

Phase 1 (`WO-2026-08-03-01`) is complete to the PR boundary — PR #1, head `167d6c2`, **not merged**. Build on that branch.

## READ-BACK FIRST, then hold

Outcome in your words · plan · what this order failed to settle · what looks wrong. **One read-back. If it is clean, proceed straight to implementation without waiting for me.** Park non-blocking observations; only an ACTIVE in-scope blocker stops you.

## OUTCOME

The site grows from one page into the real structure, with content authored as portable source rather than hard-coded markup.

### The routes — from map §2, which is the authority

Top level: **Home · Services · Who We Help / For SMEs · What We Do · Case Studies / Our Work · Apps and Products · About · Contact · ShAits and GAiggles**

Inside ShAits and GAiggles: **Latest · Human in the Poop · Explainers · Build Stories / We Made a Thing · Articles · Videos**

Map §2 permits refining navigation and IA where UX genuinely improves, but the **business / editorial-family / video-channel distinction must be preserved**. If you believe a route should merge, split or be named differently, say so at read-back with your reasoning — that is inside your remit to argue, not to decide silently.

### The content model

Articles and editorial items are authored as **portable source files** (MDX or equivalent) that the site builds from. The test that matters: an article is a file a human can read, move, or rebuild the site from — not a string embedded in a component. **No CMS and no database** — map §13 forbids a custom CMS unless MDX/Git provably fails.

Stable URLs. A published article's path is a promise; design slugs so they do not churn.

## THE HONESTY CONSTRAINT — this is the one that will bite

**Fusion247 has no clients, no case studies, no testimonials and no metrics. Do not invent any.** Phase 1 set the register for this and it must hold: *"We're new, and we'd rather say so… we're not going to borrow somebody else's."*

So **Case Studies / Our Work exists as a route and tells the truth** — the work is being written up, here is what will appear. The same applies to Apps and Products: describe only what genuinely exists or is genuinely being built. **A page that promises nothing real is better than a page that invents something.** If a route cannot be filled honestly, build it, say so on it, and flag it to me.

**Tone:** business pages credible, plain-English, lightly humorous, *not generic AI consultancy sludge*. ShAits and GAiggles personality-led, irreverent, technically accurate. Two registers, one voice.

**Human in the Poop** gets a landing/archive surface. The channel does not publicly exist yet (YouTube identity review pending, map F1) — **do not link to a channel URL, do not embed a video, do not imply it is live.**

## OUT OF SCOPE — do not build these

No YouTube adapter · no X adapter or posting · no publication package or receipt contract (Phase 4) · no VlogOps · no analytics · no auth · no contact form that sends anything · no newsletter signup · nothing that costs money · no account touched.

## STOP LINE

**Build on the branch, open a PR, stop. DO NOT merge — not this branch, and not Phase 1's.** `main` auto-deploys to the live canonical domain. That is Warwick's decision.

## EVIDENCE REQUIRED — pasted real output

**Do not include a public unauthenticated 200 from any Vercel URL. It is impossible** — deployment protection returns `302 → vercel.com/sso-api`, proven in Phase 1. Do not attempt to get around it and do not ask for protection to be weakened.

1. `next build` output listing **every route generated**, and the head SHA.
2. Local production server: for **each** route, the HTTP status and a `grep` for literal copy proving that page rendered its own content. A route that 200s with an empty shell is not a rendered page.
3. CI result on the exact head SHA, with **executed subtest counts**. Zero executed is a FAILURE.
4. **Mutation test:** break one thing the suite claims to protect — a route, a piece of copy, a link — show it go RED, restore it, show GREEN. Paste both.
5. **An internal-link check that fails on a link to a route that does not exist.** Phase 1 has this; extend it, do not weaken it.
6. Preview deployment `state: success` with its `environment_url`, and the `302` pasted verbatim as honest proof it exists and is protected.
7. Secret scan over the authored files, and separately over the full surface, reporting **both** exit codes.
8. **What you did NOT prove** — at minimum that nothing has been observed rendering on Vercel, and that the copy is your draft and unapproved by Warwick.

## CONSTRAINTS

- The copy is yours to draft under map §11. Warwick approving public wording is a separate gate that has not happened — say so.
- No accessibility or visual sign-off is claimed here; that is Vera and Iris, not this order.
- **Regrowth cap:** if the answer to a content problem is to build a framework, the diagnosis was wrong. MDX files and Next routing, nothing more.
