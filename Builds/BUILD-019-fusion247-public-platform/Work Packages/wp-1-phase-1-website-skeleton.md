---
work_order_id: WO-2026-08-03-01
wp_number: WP-1
title: BUILD-019 Phase 1 — website skeleton to the PR boundary
status: issued
owner: keel
return_to: larry
authorised_by: warwick
authorised_date: 2026-08-03
file_surface:
  - C:/fusion247-web/**
worktree: C:/fusion247-web
branch: build-019/phase-1-website-skeleton
private_surface: none
credential_scope: none
live_authority: none
network: npm-registry-and-github
dependency_policy: next + react + react-dom + tailwindcss + typescript + one test runner permitted; any other runtime dependency must be named and justified
out_of_scope_policy: report-only
operational_handoff: none
blocking_dependencies: none
tags: [build-019, phase-1, website, nextjs]
---

# WP-1 — BUILD-019 Phase 1: website skeleton to the PR boundary

**Supersedes the chat-only dispatch WO-019-01, which Keel refused at read-back on 2026-08-03. That refusal was correct.** This is the amended order. Under `CLAUDE.md` § Specialist dispatch, **one additional fresh read-back is allowed**; after that, proceed unless an ACTIVE, in-scope blocker remains.

**Authority:** Warwick unpaused BUILD-019 on 2026-08-03. The accepted Wayfinder map at `C:/Fusion247PKA/Deliverables/2026-08-02-build-019-public-platform-wayfinder-plan.md` is the contract — §2 brand/tone, §5 verified live assets, §7 security, §10 route, §11 authorities.

## What changed from the refused order — each defect, and its disposition

| Keel's finding | Disposition |
|---|---|
| **D1** — `curl` preview showing 200 is unachievable; Vercel SSO returns `302 → vercel.com/sso-api` | **ACCEPTED. The criterion was impossible and is withdrawn.** Replaced with the evidence list below, which is Keel's own proposal. Warwick will not be asked to weaken Vercel's deployment protection to satisfy a test — Keel's recommendation, and mine. |
| **D2** — the outcome contradicts the stop line; only a merge reaches the canonical domain | **ACCEPTED.** The deliverable is restated below as *Phase 1 built and evidenced to the PR boundary*. **The map's Phase 1 row will be recorded PARTIAL, not PASS, on this dispatch** — the canonical 200 is what Warwick's `merge-decision` buys. |
| **D3** — no `file_surface`; no path it was permitted to write | **ACCEPTED.** Declared in the frontmatter above. |
| **D4** — no `dependency_policy`, no `network` | **ACCEPTED.** Declared above. `node_modules/` and the npm cache under `%LOCALAPPDATA%` are expected write side-effects of `npm install` and are explicitly permitted. |
| **Process** — the order lived only in chat, and the id did not match the template pattern | **ACCEPTED.** This file is the durable order; the id is now `WO-2026-08-03-01`. |

## Larry's rulings on the assumptions Keel raised

These sit inside Larry's authority per map §11 and are settled here, not escalated.

- **A2 — branch:** `build-019/phase-1-website-skeleton`. Confirmed.
- **A3 — skeleton shape:** **one route, `/`.** No Services / About / Contact / ShAits-and-GAiggles pages, no MDX — those are Phase 2. **Navigation is in-page anchors only.** Keel is right that links to routes which 404 would be worse than no nav; a header that promises pages the site does not have is a lie in the markup.
- **A4 — `vercel.json` pinning `"framework": "nextjs"`:** **yes, commit it.** The project was imported against an empty repo so its preset is null, and an unset preset can serve a Next build as static output and 404. Pinning it in the repo is the only fix that touches no account, which is exactly why it is the right one.
- **A5 — meaningful CI:** typecheck + lint + `next build` + a real test that renders the homepage and asserts **specific literal copy strings**, so deleting the copy turns CI red. A test that cannot fail is not evidence.
- **A6 — copy:** Keel drafts it under map §11. **True, modest claims about Fusion247 only. No client names, no metrics, no testimonials, no case studies — none exist and none are to be invented.** Warwick approving wording is a separate gate, not this one.

## OUTCOME

**Phase 1 built and evidenced to the PR boundary.** A real, maintainable Next.js + TypeScript + Tailwind application in the already-existing `warwickallan/fusion247-web` repo, on the declared branch, with a homepage carrying genuine Fusion247 copy for owner-managed SMEs in the map §2 tone, and CI that can actually fail. Pushed, PR open, Vercel preview built, evidence gathered.

**This order does NOT deliver the map's Phase 1 gate.** That gate is the canonical domain at 200, and only a merge reaches it.

## HARD CONSTRAINTS

- **Repo and Vercel project already exist and are verified live. RECREATE NOTHING** — no repo, no Vercel project, no domain, no DNS record, no account. Map §5 / F0.
- **Nothing paid. No account touched.** No Vercel dashboard change, including disabling deployment protection.
- **No secrets** in git, CI logs or output.
- Stack is settled. Do not relitigate it.
- **Do not touch `C:/Fusion247PKA`** — it has an unrelated dirty working tree.

## STOP LINE

**Build on the branch, open the PR, stop.** `main` is unprotected and auto-deploys to the live canonical domain, so merging is the act of putting Fusion247 on the public internet for the first time. That is Warwick's `merge-decision`.

## EVIDENCE REQUIRED — pasted real output

Adopted from Keel's own proposal, because it is achievable and honest.

1. `gh api repos/warwickallan/fusion247-web/deployments` → the **Preview** deployment for the branch head, `state: success`, with `environment_url` pasted. Give the head SHA.
2. `curl -sSI <preview-url>` pasted **verbatim showing the `302 → vercel.com/sso-api`** — honest proof the preview exists and is SSO-protected, explicitly **not** proof that content rendered.
3. **Content rendering proven where it can be:** `next build`, production server locally, `curl -sS http://localhost:3000` with HTTP status and a `grep` for specific literal homepage copy.
4. CI run result on the exact branch head SHA, with **executed subtest counts**. **Zero executed is a FAILURE, not a pass.**
5. **An explicit statement of what was NOT proven** — at minimum, that no public unauthenticated 200 was obtained from any Vercel URL.

## Verdict labels

Rule 3 binds. Any consequential claim without external evidence is labelled BUILT-NOT-VERIFIED, PARTIAL or FAILED. Do not fabricate a status code. Do not merge.
