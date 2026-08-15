# VlogOps verification ruleset — `verification-v1`

**This file is the ruleset.** Every rule the verifier can raise is named here, and nothing it
raises is absent from this list. The file's own bytes are hashed into `ruleset_id`, which
participates in the identity of every verification run — so changing a rule cannot retroactively
change an old verdict, and two runs that disagree can always be traced to the two texts that
produced them.

It is written to be read by a person, from source, before anything renders it — Wayfinder §9.1
rung 1. If you want to argue with a verdict, argue with the rule below that produced it.

---

## What this is, and the two things it is not

Verification stands between a drafted Master Story Package and everything downstream. It reads
**stored rows only** — the frozen snapshots, the compiled pack, the master claims, the citations
and the sibling segments. It never re-reads an original artefact, never calls a model, and never
asks the thing that wrote the package whether the package is good.

**It is not a fact-checker.** It cannot read a sentence and decide whether the world is like that.
What it can do is check the classes of assertion that are mechanically checkable against frozen
bytes — numbers, dates, quantities, money, percentages and quotations — and **say plainly how much
of the package that covered.** Every dimension reports its coverage beside its verdict, because a
dimension that answers `pass` having examined nothing is the exact failure this build keeps
meeting.

**It is not a taste gate.** Register, voice, pacing and whether a story is worth telling are
Warwick's, at Phase 5. Nothing here grades them.

---

## Severities — two labels, one mechanism

| Severity | What it means | How it is cleared |
|---|---|---|
| **`block`** | A rule below was broken. | A recorded, attributed **override** — or by fixing the draft, which produces a different package. |
| **`surface`** | A question was raised that this machinery is not entitled to answer. | A recorded, attributed **answer**. |

**Both stop the package.** A question nobody is forced to answer is not a gate, and Wayfinder §11
makes publishing private or rights-encumbered material Warwick's decision. The verifier's job at a
`surface` finding is to put the question in front of him with the evidence attached — never to
decide it, and never to guess in either direction.

**A block is not cleared by re-running the verifier.** The gate looks at every run of a package,
so a second run adds a verdict and clears nothing.

---

## Normalisation

Text is compared after **Phase 1's `normaliseSuppliedText`** — NFC, CRLF and CR folded to LF,
trimmed — applied to **both sides**. Phase 1 chose that set because line endings and Unicode
composition "vary for reasons that have nothing to do with what it says".

Quotation matching applies one further step, **symmetrically, on both sides**: every run of
whitespace is flattened to a single space. This is an extension beyond Phase 1 and it is declared
rather than hidden. The reason is narrow: a passage quoted into a script is re-wrapped, and a line
break where the source had a space is not a misquotation. **It tolerates whitespace and nothing
else** — a changed word, a changed number, a dropped clause or an added one all still fail.

---

## Dimension 1 — FACT

Checks that the checkable assertions in the package are actually present in the evidence they
cite. **A "checkable factual token" is one of:** an integer or decimal number · a currency amount ·
a percentage · a date in ISO or common written form · a time. Nothing else is examined, and the
dimension reports how many claims and segments carried one.

| Rule | Severity | What it checks |
|---|---|---|
| **FACT-1** | `block` | A checkable factual token asserted in a **master claim** appears in none of the entries that claim cites. |
| **FACT-2** | `block` | A checkable factual token asserted in a **sibling segment** appears in the entry that segment cites, or in any other entry its master claim rests on. |

**FACT-2 is deliberately the more generous of the two.** A segment adapts a master claim, and the
master claim may rest on several entries; requiring the segment's own single citation to carry
every number would fail correct drafts. It still cannot reach outside the master's evidence.

**A token is also grounded by the NAMES of the evidence.** The `source_ref` of a cited entry, and
the names of the entries in the package's own pack, count as grounding. Naming your source is a
citation, not an assertion about the world: a package that says *"from `2026-08-05-foo.md` to
`2026-08-11-bar.md`"* is describing the span of its own evidence, and requiring those dates to
appear inside the files' contents would report a factual error on every correct package that
mentions what it is citing. **The declared cost:** a number that appears in the *name* of a pack
entry is treated as grounded. In this estate those names are dated slugs, so what this whitelists
is dates that genuinely belong to the evidence set.

**Two-digit floor.** A bare integer of fewer than two digits is not treated as a factual assertion.
Single digits in prose are overwhelmingly ordinals and enumerations — *"the third beat"*, *"all 4
siblings"* — and admitting them would make this dimension fire on nearly every correct package. A
single digit still counts when it carries a unit: `£3`, `3%`, a date or a time. Another declared
false negative.

**What FACT does not catch, stated so nobody reads more into a pass than is there:** a false
statement containing no number or date. "This was the moment everything changed" is not checkable
against bytes and this dimension does not pretend otherwise. A `pass` from FACT means *the
checkable tokens were grounded*, over the coverage it reports — never *the package is true*.

---

## Dimension 2 — QUOTATION

A **quoted span** is a run of text enclosed in matched quotation marks — `"…"`, `'…'`, `“…”`,
`‘…’`, `«…»` — of at least **40 characters** after normalisation.

**A delimiter only counts at a word boundary** — an opener must begin a word and a closer must end
one. This is what stops an apostrophe being read as a quotation mark. Without it, *"it is not
written in anybody's voice, and it doesn't pretend to be"* has the text between its two
apostrophes extracted, checked against the evidence, and reported as a misquotation — a verifier
raising findings about English contractions, which is exactly how a checker earns the reputation
that gets it switched off.

The 40-character floor exists to keep scare quotes, single words and titles out of a rights and
accuracy check they do not belong in. It is a **false-negative by choice**: a short misquotation
passes this dimension. The alternative — treating every pair of quote marks as a quotation — would
produce findings on almost every package and teach everyone to override without reading, which is
how a gate dies.

| Rule | Severity | What it checks |
|---|---|---|
| **QUOT-1** | `block` | A quoted span does not appear in the frozen bytes of the entry its claim or segment cites. |
| **QUOT-2** | `surface` | The cited entry's bytes are **not stored inline** (`source_snapshot.content` is null, only a `content_url` was kept), so the quotation **could not be checked at all**. |

**QUOT-2 is the important one.** A quotation nobody could verify is an unanswered question, never
a pass. A control that reports on ground it did not examine is worse than no control.

---

## Dimension 3 — PRIVACY

Privacy is **provenance-derived first and text-derived second**, because Phase 1 already carries
`privacy_state` on every seed and every snapshot, and Wayfinder §7 says so directly: *"Privacy is
a first-class pipeline stage, not a review afterthought… the Source Compiler must carry privacy
state on every snapshot, and verification must be able to block a package."* A join beats a
heuristic.

**Effective privacy state** of a cited source is the stricter of its seed's and its snapshot's,
ranked `public` < `internal` < `private` < `restricted`. `unclassified` is not a rank — it is an
**unknown**, and it propagates.

| Rule | Severity | What it checks |
|---|---|---|
| **PRIV-1** | `block` | The package cites a source whose effective privacy state is `private` or `restricted`. |
| **PRIV-2** | `block` | A source whose effective state is `internal` is **quoted** into a sibling segment. Resting a claim on internal material is fine; publishing its words is the act. |
| **PRIV-3** | `surface` | A cited source is `unclassified`. Nobody has said what this material is, and the verifier will not decide. |
| **PRIV-4** | `block` | Publishable text — a sibling segment or a master claim — contains one of the named patterns below. |

**PRIV-4's pattern list is closed, and each pattern has its own rule id so a finding names what it
matched:** `PRIV-4/email` · `PRIV-4/phone` · `PRIV-4/uk-postcode` · `PRIV-4/iban` ·
`PRIV-4/card-number` (digit runs that pass a Luhn check, so long hashes and ids do not trip it) ·
`PRIV-4/credential` (a short list of well-known credential prefixes).

**There is deliberately no general "does this look private" heuristic.** That would be the machine
deciding for Warwick what his private life consists of, which Wayfinder §11 reserves to him.

> **PRIV-3 will fire often, and that is the point.** Phase 1's promote and supplied routes accept
> a seed with no `--privacy` and store it as `unclassified`. Packages built from those sources
> raise PRIV-3 every time. That is a real defect becoming visible through the dimension built to
> see it — **it must never be papered over by treating `unclassified` as `public`.**

---

## Dimension 4 — RIGHTS

Nothing in Phases 1–3 recorded a right, so before this ruleset the honest answer about every
source was "unknown" — and a dimension that answers unknown about everything is a wall, not a
control. `vlogops.source_rights` is where the answer lives, and **RIGHT-1 is what stops the wall.**

| Rule | Severity | What it checks |
|---|---|---|
| **RIGHT-1** | *(not a finding)* | A source whose `provenance.source_system` is `git`, `repository` or `fusion247` is Warwick's own estate. A basis of `estate-owned` is **derived**, and recorded as `basis_source: derived-from-provenance` so a reader can always tell an inference from a declaration. |
| **RIGHT-2** | `block` | A cited source's declared basis is `third-party-unlicensed`. |
| **RIGHT-3** | `surface` | A cited source has no declared basis and none is derivable. **`warwick-supplied` is never derivable** — pasted text is exactly the class that can carry someone else's words, and presuming it is his is the most expensive inference available here. |
| **RIGHT-4** | `block` | A quoted span longer than **300 characters** is taken from a source whose basis is not `estate-owned` or `public-domain`. Extent is the part of a quotation a rights holder cares about. |
| **RIGHT-5** | `surface` | A cited entry whose `media_type` is not text has no **declared** rights row. Wayfinder §7: *"Rights and provenance on every media asset."* Media production itself is Phase 6; this is the point at which the question can honestly be asked. |

---

## Dimension 5 — CROSS-FORMAT CONSISTENCY

**The spine is the MASTER NARRATIVE, not the script.** Wayfinder §5: *"The Master Story Package is
one canonical creative truth with sibling adaptations"*, and *"the blog is not a raw transcript;
the video and blog cannot drift into unrelated claims."* Treating the script as authoritative
would make the video's adaptation choices silently outrank the canonical truth, which inverts the
design.

**This dimension checks only what Phase 3's schema cannot.** `db/003` already makes "a sibling
asserts something its master does not" *unwritable* through the
`story_segment_cites_its_master` foreign key. Re-checking that here would be a control that cannot
fail — the precise defect this Work Package exists to answer. What remains, and is genuinely
FK-legal, is **omission and asymmetry**:

| Rule | Severity | What it checks |
|---|---|---|
| **XF-1** | `block` | A sibling is missing entirely. A package carries all four. |
| **XF-2** | `block` | A master **beat** is adapted by no sibling at all. The master asserts something no format tells. |
| **XF-3** | `block` | A master **beat** is carried by the script but not the blog, or the blog but not the script. These are the two long-form siblings and they must carry the same spine. |

**Titles and thumbnail direction are exempt from XF-3 by design.** They are selective by nature —
three titles do not cover twelve beats, and a thumbnail is one image. Requiring parity there would
make the rule fire on every correct package.

**Narrative claims are exempt from XF-2.** Beats are the spine; narrative claims are supporting
detail a sibling may legitimately leave out. Requiring every claim to appear in some sibling would
block correct drafts, and a rule that fires on correct work is one people learn to override
without reading.

---

## What a verdict means

- **`pass`** — no rule above raised a finding, over the coverage each dimension reports.
- **`blocked`** — at least one finding exists. The package cannot advance until every finding is
  disposed by a recorded, attributed decision.

**A `pass` is not an endorsement of the writing, the story, or the truth of anything the package
says beyond the checkable tokens named in FACT.** It means the package broke none of the rules on
this page.
