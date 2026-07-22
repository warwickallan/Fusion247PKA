---
build_id: BUILD-002
title: Unified Fusion Hub — Human-Readable Build Brief
pack_version: v1.0-draft
doc_role: brief
lifecycle_state: draft_pending_warwick_approval
owner: Warwick
implementation_owner: Larry
approval_required_before_substantial_build: Warwick
canonical_readable_record: GitHub (this file)
operational_and_approval_record: Supabase (cockpit.build_contract)
human_review_surface: Directus / Vue cockpit
approval_pack:
  - BUILD-BRIEF.md (this file)
  - BUILD-CONTRACT.md
  - IMPLEMENTATION-PLAN.md
provenance:
  source: ClickUp BUILD-002 Doc page "05 — WP2 Human-Readable Build Brief" (preserved verbatim below)
  clickup_doc: 2kxuxw3a-852
  clickup_page: 2kxuxw3a-5992
  clickup_url: https://app.clickup.com/90121891946/docs/2kxuxw3a-852/2kxuxw3a-5992
  retrieval_date: 2026-07-22
tags:
  - build-002
  - unified-fusion-hub
  - build-brief
---

> **Preserved from the approved ClickUp human-readable page (05).** This Brief is the canonical
> readable narrative of BUILD-002. The [[BUILD-CONTRACT]] carries the acceptance criteria and
> boundaries; the [[IMPLEMENTATION-PLAN]] carries Larry's concrete technical delivery approach.
> Approval binds the exact three-document pack (see each file's committed hash).

# BUILD-002 — Unified Fusion Hub

## Human-Readable Build Brief

**Status:** Draft for Larry review — not approved and does not authorise implementation
**Owner:** Warwick
**Implementation owner:** Larry
**Approval required before substantial build:** Warwick
**Canonical readable record:** GitHub
**Operational contract and approval state:** Supabase
**Human review surface:** Directus / Vue cockpit

## Executive Summary

BUILD-002 turns Fusion247's existing Telegram, TubeAIR, AsdAIr, Tower, Directus, Supabase and Markdown capabilities into one coherent operational hub. Warwick can submit information or instructions through the most natural interface; the hub preserves the source, identifies or asks for the intended route, sends the work to the correct specialist, records decisions and evidence, and returns a truthful result without manual copy-and-paste between systems.

The first complete proof is YouTube knowledge ingress: paste a YouTube URL into Telegram, extract and preserve the full available transcript, create the existing Karpathy packet, apply the canonical YouTube knowledge-note template, categorise it through Cairn, add the resulting Markdown note and justified backlinks to the Brain/Obsidian vault, present a standalone human-readable brief in Directus, and allow Warwick to accept or decline proposed learnings.

Before substantial implementation, BUILD-002 will have three approved artefacts: this Human-Readable Build Brief, a detailed Build Contract/PRD, and Larry's Implementation Plan. GitHub stores the canonical versioned Markdown; Supabase stores the approved versions, hashes and operational state; Directus provides the readable approval surface. Codex QA checks the final PR against the exact approved contract and PR head.

* * *

## 1. What this Build is about

Fusion247 already has several useful pieces:

*   Telegram capture through DevBot;
*   a dedicated ShopperBot;
*   TubeAIR for YouTube transcripts;
*   AsdAIr for shopping-list planning;
*   Tower and Larry for governed work;
*   Directus as a human control surface;
*   Supabase as the shared operational database;
*   GitHub and Markdown as the durable engineering and knowledge record.

The problem is that these capabilities still behave too much like separate tools.

This Build joins them through one central Fusion hub.

The hub becomes the shared route through which information, decisions and instructions enter Fusion247, are preserved, classified, sent to the correct specialist process and returned to Warwick through the most useful interface.

The visible interfaces may be different, but the backend must be one coherent system.

* * *

## 2. The simple idea

Warwick should be able to send something into Fusion247 through the most natural route:

*   a Telegram message;
*   a ShopperBot photo or voice note;
*   a YouTube link;
*   a forwarded email;
*   a Directus command;
*   later, a watch or native app.

Fusion should then:

1. preserve the original input and its provenance;
2. understand the likely purpose from the channel and content;
3. ask Warwick when the intent is unclear;
4. send it to the right specialist;
5. record the state and evidence;
6. return a truthful card, result or decision request;
7. continue the process without Warwick manually moving information between systems.

This is the "little octopus" between Fusion247's inputs, workers, knowledge and outputs.

* * *

## 3. Why this matters

At present, useful things can already be built and proven, but Warwick still has to remember:

*   which bot to use;
*   which process is running;
*   where the output went;
*   whether Larry has received a decision;
*   whether something has been added to the Brain;
*   whether ClickUp, GitHub or Supabase reflects the current state.

That manual relay is the problem this Build is intended to remove.

The hub should make Fusion247 feel like one product rather than a collection of clever demonstrations.

* * *

## 4. The main user experience

### DevBot

DevBot is the deliberate Brain-facing route.

A message, link, file or voice note sent there should normally become a preserved intake item ready for Cairn to categorise and route into the Brain.

DevBot should not silently turn general knowledge captures into shopping items or reminders unless Warwick explicitly chooses that route.

### ShopperBot

ShopperBot is operationally scoped to shopping.

It should accept:

*   typed shopping lists;
*   photos of handwritten lists;
*   spoken shopping items;
*   corrections;
*   product decisions.

Weekly shopping data belongs in AsdAIr and Supabase, not in the general Brain.

Only reusable rules, preferences and approved learnings should become durable knowledge.

### Email

Forwarded email becomes another input source.

The system should preserve sender, recipients, subject, message body, attachments and source message ID, then route the email to Cairn, a work process, CareerAIr or another specialist.

### Directus

Directus is Warwick's cockpit.

Warwick should be able to:

*   read Build contracts;
*   review knowledge briefs;
*   approve or reject suggested learnings;
*   answer decisions;
*   issue safe commands;
*   see the result and evidence.

Directus is a control surface, not the engine. Commands must go through the same validated hub as every other instruction.

* * *

## 5. The first complete proof

The first walking skeleton is a real YouTube knowledge-ingress journey.

Warwick pastes a YouTube URL into Telegram.

Fusion then:

1. records the URL as a durable input;
2. recognises it as a YouTube source;
3. sends it to TubeAIR;
4. extracts the complete available transcript;
5. preserves the raw transcript as immutable source evidence;
6. produces the existing Karpathy-format transcript packet;
7. applies the canonical YouTube knowledge-note template;
8. creates a standalone, human-readable knowledge brief;
9. categorises it through Cairn;
10. adds the governed Markdown note to the Brain and Obsidian vault;
11. adds useful and justified backlinks;
12. identifies possible learnings, actions, questions and improvements;
13. displays those suggestions in Directus;
14. lets Warwick Accept or Decline them;
15. returns a truthful completion card and links in Telegram.

The proof is complete only when the full journey works after a restart and does not create duplicates when the same link is delivered twice.

* * *

## 6. The knowledge output

The processed knowledge note must not be a transcript dump, a thin summary or a generic AI recap.

It must preserve useful source knowledge while removing filler and conversational repetition. It should include source and provenance, executive orientation, full structured reconstruction, mechanisms, implementation details, tools, people, products, examples, claims and confidence, caveats, source gaps, Fusion247 implications, key concepts, justified backlinks, proposed actions and open questions.

It must stand alone without the original video.

* * *

## 7. Suggested learnings

The Build should not silently rewrite Fusion247 because a video contained an interesting idea.

Instead, it should create reviewable learning candidates such as:

*   update an existing knowledge note;
*   create a new concept note;
*   revise a skill;
*   change an agent instruction;
*   add a standing rule;
*   create a Foundry Idea;
*   add an action;
*   verify a claim;
*   decline or defer a suggestion.

Each suggestion should explain what is proposed, why it matters, where it came from, what would change, confidence and risk.

Warwick can Accept or Decline each candidate in Directus. Accepted candidates become governed work for Larry, Cairn or the appropriate specialist.

* * *

## 8. Obsidian on the Yoga

Obsidian should be installed on the Yoga as the human-readable Markdown knowledge interface.

It must open the governed Brain/vault rather than creating a second copy of the knowledge base.

The local API route should allow the approved worker to read notes, search the vault, write a processed note, inspect metadata, open a note in Obsidian and return a stable note path or link.

The API must remain local, authenticated and secret-safe. If Obsidian is unavailable, the hub must keep the work queued rather than lose the source.

* * *

## 9. Build governance without the paperwork bonfire

Before implementation starts, the Build will have three concise artefacts:

1. **Human-Readable Build Brief** — what the Build is, why it matters and what Warwick must be able to do.
2. **Build Contract / PRD** — scope, non-goals, objectives, acceptance criteria, evidence and boundaries.
3. **Implementation Plan** — written by Larry after reviewing the first two artefacts.

These artefacts are stored in GitHub as versioned Markdown, projected into Supabase with exact hashes and approval state, shown clearly in Directus, and approved by Warwick before substantial implementation.

Larry should not manually rewrite the same material in three systems.

* * *

## 10. What success looks like

The Build succeeds when Warwick can:

*   submit information through the correct input;
*   see that Fusion received it safely;
*   have it routed without manual relay;
*   answer A/B/C decisions from Telegram;
*   have Larry or another specialist continue automatically;
*   issue a safe command from Directus;
*   receive truthful results and evidence;
*   open the resulting human-readable knowledge page;
*   approve or reject suggested learnings;
*   trust that duplicate delivery or a Yoga restart will not lose or repeat the work.

* * *

## 11. What this Build is not

This Build does not include Asda checkout/payment, automatic substitutions, autonomous permanent learning, autonomous merge, a full email client, a native Fusion app, full Health or CareerAIr integration, a second Brain, public Obsidian API exposure, uncontrolled plugin installation, low-value backlink spam, rebuilding TubeAIR/AsdAIr/Tower, or ClickUp retirement.

* * *

## 12. The deliberate stopping point

Stop when:

*   Build artefacts are approved;
*   Obsidian and its local API work;
*   YouTube knowledge ingress works end to end;
*   learning suggestions are reviewable in Directus;
*   Telegram decisions are durable and actionable;
*   one safe Directus command reaches Larry;
*   bounded Shopper, email and voice routes are proven;
*   restart and duplicate tests pass;
*   Codex QA confirms the implementation matches the approved Build contract.

* * *

## 13. Review sequence

1. Warwick approves this Human-Readable Build Brief.
2. Warwick approves the Build Contract / PRD.
3. Larry reviews both.
4. Larry writes `IMPLEMENTATION-PLAN.md`.
5. Warwick reviews and approves Larry's plan.
6. GitHub and Supabase record the exact approved versions and hashes.
7. Larry begins implementation.
8. Codex QA checks the final PR against the approved contract and evidence.
9. Warwick makes the merge decision.

## One-sentence outcome

**Warwick can send information or instructions through Telegram, email, voice or Directus, and the central Fusion hub safely preserves, routes, processes and returns the result without Warwick manually relaying work between systems.**
