# GL-007 - Human-Facing Writing Conventions (Anti-AI-Tell Discipline)

> **This Guideline is a general rule every agent reads on every relevant action.** Any specialist drafting prose that a human being will read **outside the team's own working memory** — a cover letter, a client email, a report, a proposal, a piece of external correspondence — reads this file **before finalizing that draft**, not just once at hire time. SOPs, Workstreams, and specialist contracts `[[wikilink]]` here rather than restating the rules.

## Why this Guideline exists

A source incident (folded into myPKA via [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]], decision 14, item #2) is the reason this file exists, and it is worth stating plainly because the failure mode is the whole point: a prior system had a canonical, well-written anti-AI-writing source pack. The pack was not missing. It was not wrong. It still let an em dash slip into a submitted cover letter, because nothing in the actual drafting workflow pointed at it in the moment of writing. The guidance existed as a document; it did not exist as a step.

This Guideline is deliberately re-derived from that principle, not copied from any prior pack's text. The content below is myPKA's own synthesis of current, verified research on what reads as AI-written in 2026 — see §"Sources" — plus the one hard procedural rule the incident actually teaches (§"The rule that matters most").

## Scope: what this covers, and what it explicitly does not

**In scope — human-facing external prose:**
- Cover letters, CVs, application materials
- Client emails, client-facing reports, proposals, engagement communications
- Any Deliverable or Warden `Client Delivery/` artifact intended for a human recipient outside the team's own operating loop
- Any other prose a specialist drafts on the user's behalf for an external human reader

**Out of scope — internal team register:**
Session logs, task `## Updates` lines, journal entries, and specialist-to-specialist working notes have their own register and their own existing conventions (for example, [[SOP-write-session-log]] already carries a no-em-dash rule for session-log prose specifically). This Guideline does not replace those; it is the counterpart for writing a **human outside the team** will read. Internal prose is terse, first-person, and workflow-shaped by design — trying to make it "sound natural" the way external prose must is the wrong problem. Do not apply this Guideline's checklist to a task update or session log; that register is governed separately.

## What AI-tell prose actually looks like in 2026

Detection research from 2026 is explicit that **no single marker is decisive on its own** — the signal is a cluster of markers appearing together, not any one of them in isolation. Treat every item below as a data point, not a trigger.

### 1. Punctuation and cadence

- **Em-dash density**, not em-dash presence. A single em dash is normal, correct punctuation. The tell is *frequency clustering* — multiple em dashes doing the work sentences or commas should be doing, repeated across a short piece ([searchatlas.com](https://searchatlas.com/blog/ai-patterns-in-writing/)). Note the nuance: by 2026, mainstream models increasingly suppress em dashes by default unless explicitly prompted for them, so em-dash presence alone is a weaker signal than it was in 2024-2025 and should never be the sole check ([duey.ai](https://www.duey.ai/post/em-dash-ai-writing)).
- **Cadence uniformity** — sentence after sentence landing in the same 18-24 word range, paragraph after paragraph, with no rhythm variation. Multiple 2026 sources independently flag this as the single strongest tell, stronger than any individual word choice ([searchatlas.com](https://searchatlas.com/blog/ai-patterns-in-writing/)).
- **Decorative quotation marks** — phrases wrapped in quotes with nothing actually being quoted ([aidetectors.io](https://www.aidetectors.io/blog/how-to-tell-if-text-is-ai-written)).

### 2. Vocabulary

A recurring, cross-source-verified vocabulary cluster shows up across independent 2026 word-list compilations: **delve, tapestry, landscape, realm, navigate the complexities, robust, seamless, crucial, pivotal, transformative, unleash, moreover, underscore, boundary-pushing, testament to, journey.** This list is corroborated across multiple independent sources ([oliviacal.com](https://www.oliviacal.com/post/ai-writing-tells), [useaiwriter.com](https://www.useaiwriter.com/articles/ai-words-to-avoid-2026), [grammarly.com](https://www.grammarly.com/blog/ai/common-ai-words/)) — none of these words is individually disqualifying in isolation, but density of this cluster in one piece is a strong signal.

### 3. Structural tics

- **Rule-of-three overuse** — AI models default to listing things in triads (three adjectives, three examples, three clauses) even where a natural human writer would use one, two, or four. This is well-documented as a training-data artifact, not a style choice ([gptzero.me](https://gptzero.me/news/the-rule-of-three/), corroborated independently at [medium.com/@lombardiph](https://medium.com/@lombardiph/gpt-guaranteed-three-times-or-your-query-back-why-ai-always-lists-things-in-threes-e9dd39d54b84)).
- **Contrastive "it's not just X, it's Y" framing**, and its variants ("not X. Y." / "most X don't… they…") — a specific rhetorical crutch flagged as an AI tell across the same rule-of-three research thread.
- **Qualifier stacking** — nearly every claim hedged ("can help," "may improve," "in many cases") until the prose says less with more words ([aidetectors.io](https://www.aidetectors.io/blog/how-to-tell-if-text-is-ai-written)).

### 4. Genericness (the tell that matters most for cover letters and client comms specifically)

For cover letters and outbound client communication in particular — the exact category the source incident involved — the strongest 2026 signal is not punctuation at all, it is **the absence of anything a competing draft couldn't also claim**: "strong communication skills," "passion for the industry," "I believe my skills and experience make me a strong candidate," with zero concrete, specific, checkable detail underneath. This is independently corroborated by multiple recruiter-facing 2026 sources ([cvpromaker.com](https://www.cvpromaker.com/blog/ai-generated-cover-letters), [aiapply.co](https://aiapply.co/blog/can-employers-tell-if-you-use-ai-for-a-cover-letter), [liftmycv.com](https://www.liftmycv.com/blog/using-ai-for-cover-letter/)). Flawless, overly-uniform formality that never varies in register is itself a tell — genuinely human prose has texture.

## The self-check (run this, don't just read this)

Before any specialist submits human-facing external prose, run this five-point pass on the actual draft, not from memory:

1. **Read it aloud (or have it read back).** Does any sentence sound like something a person would actually say?
2. **Count the em dashes.** More than one or two in a short piece (a cover letter, a one-page email) is worth a second look — not an automatic rewrite, but a look.
3. **Scan for the vocabulary cluster in §2.** Any hit is not disqualifying alone; three or more hits in one piece is.
4. **Check every claim for a concrete, specific, checkable detail underneath it.** If a sentence could be pasted into any other draft about any other subject unchanged, it fails.
5. **Vary the sentence length on purpose.** If every sentence in a paragraph is roughly the same length, break the pattern.

If a piece trips several of these at once, that is the actual signal — per the cluster-not-single-marker principle in §"What AI-tell prose actually looks like," one hit is not proof, several together is.

## The rule that matters most (the actual lesson from the incident)

**A Guideline that exists but is never re-read at the point of drafting is functionally the same as no Guideline.** The source incident did not happen because the anti-AI-writing pack was wrong or missing — it happened because drafting a cover letter and consulting the pack were two disconnected activities. The pack was canonical; the workflow simply never pointed at it.

This Guideline is only doing its job if:

1. **Every specialist contract or SOP whose output includes human-facing external prose carries an explicit `[[GL-007-human-facing-writing-conventions]]` wikilink at the drafting step itself** — not buried only in a bottom-of-file References list that gets read once at onboarding and never again. A reference in a "see also" section is not enough; the trigger has to sit at the moment of writing.
2. **The self-check above is a step in the drafting procedure, not background knowledge.** "I know about the em-dash rule" is exactly the failure state the incident demonstrated — knowing is not the same as checking, on this specific draft, at this specific moment.
3. **This applies to any current or future specialist who drafts human-facing external prose** — not just one role. Any specialist whose deliverable a human outside the team reads directly (client comms, cover letters, proposals, external reports) is in scope.

Wiring the actual wikilink into each relevant specialist's `AGENTS.md` and SOP is deliberately **not done by this Guideline itself** — that wiring is a separate, lightweight Librarian-style pass (see the task that birthed this file). Writing the rule here and stopping is exactly the anti-pattern this file exists to name; the wiring-in is what closes the loop the source incident showed being open.

## Sources

Search conducted 2026-07-10. Every load-bearing claim above cites at least two independent sources except where explicitly marked single-source below.

- [How to Detect AI Patterns in Writing? — Search Atlas](https://searchatlas.com/blog/ai-patterns-in-writing/)
- [9 Signs Text Is Written by AI (2026) — aidetectors.io](https://www.aidetectors.io/blog/how-to-tell-if-text-is-ai-written)
- [The Em-Dash Myth: What Actually Gives Away AI Writing — Duey AI](https://www.duey.ai/post/em-dash-ai-writing) *(single-source nuance: the specific claim that GPT-5.1-class models suppress em dashes by default is sourced here only — flagged low-confidence, included because it correctly tempers over-reliance on em-dash presence alone.)*
- [How to Spot AI Writing Tells: 17 Examples + AI Words Blacklist 2026 — Olivia Cal](https://www.oliviacal.com/post/ai-writing-tells)
- [300+ AI Words and Phrases to Avoid in 2026 — useaiwriter.com](https://www.useaiwriter.com/articles/ai-words-to-avoid-2026)
- [Decoding AI Language: Common Words and Phrases in AI-Generated Content — Grammarly](https://www.grammarly.com/blog/ai/common-ai-words/)
- [How to Break Free from GPT's Rule of Three in Writing — GPTZero](https://gptzero.me/news/the-rule-of-three/)
- [GPT: Guaranteed Three Times or Your Query Back — Philip Lombardi, Medium](https://medium.com/@lombardiph/gpt-guaranteed-three-times-or-your-query-back-why-ai-always-lists-things-in-threes-e9dd39d54b84)
- [How Recruiters Spot AI-Generated Cover Letters Easily — CV Pro Maker](https://www.cvpromaker.com/blog/ai-generated-cover-letters)
- [Can Employers Tell If You Use AI for a Cover Letter? (2026) — AiApply](https://aiapply.co/blog/can-employers-tell-if-you-use-ai-for-a-cover-letter)
- [Is It Bad to Use AI for Your Cover Letter? 2026 Lab Results — LiftMyCV](https://www.liftmycv.com/blog/using-ai-for-cover-letter/)

## Opinion vs. fact, flagged explicitly

Everything in §"What AI-tell prose actually looks like" is externally sourced and cited — treat as researched fact with the confidence caveats noted inline (the em-dash-suppression claim is explicitly single-source and flagged). §"The rule that matters most" is this Guideline's own procedural judgment, re-derived from the source incident described in [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] — it is myPKA's own opinion about what closes the gap, not an externally-sourced claim, and should be read as such.

## Cross-references

- [[GL-001-file-naming-conventions]] — general Guideline-authoring conventions.
- [[SOP-write-session-log]] — owns the separate, already-existing no-em-dash convention for internal session-log register. Not superseded by this file; different scope.
- [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] — the task that birthed this Guideline (decision 14, item #2) and the source incident this file re-derives from.

## Updates to this Guideline

If the researched AI-tell patterns go stale (they will — detection and generation co-evolve), re-run the research pass and update §"What AI-tell prose actually looks like" in place. Do not let this file's citations age past relevance silently; a stale anti-AI-tell list is its own kind of the same failure this file exists to prevent.

### Version history

- **v1.0 (2026-07-10)** — Initial version. Written by Pax per [[tsk-2026-07-10-001-fold-fusion247-brain-doctrine-into-warden]] decision 14, item #2. Re-derived from the Fusion247 Brain Anti-AI Writing Source Pack's underlying principle, not copied from its text (source text not held verbatim). Wikilinking this Guideline into specific specialist `AGENTS.md` files and SOPs is deliberately deferred to a separate Librarian-style pass, per the task's explicit scoping.
