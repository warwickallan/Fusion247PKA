# What a capable model does with this list — the benchmark AsdAIr must meet

**Warwick, 2026-08-18:** *"the whole point of what we are trying to achieve here is that Asdair does
all this and uses logic, reason and intelligence. I feel like we are still fucking around with the
same old deterministic crap that over the last 6 weeks we have proven doesn't work… whatever you can
do I want Asdair to be able to do. you have no trouble figuring out what's what from this list, I
expect the same from asdair."*

This document is Larry reading `services/asdair/pipeline/testdata/known-list/mum-list-2026-08-17.jpg`
directly and answering the seven questions AsdAIr put to Warwick on `SHOP-2026-08-18-M128`. **It is
not a proposal. It is the acceptance standard**: AsdAIr must reach these answers by reasoning, not be
handed them.

---

## First — a correction, because it proves the point twice

I told Warwick that lines 18 and 19 were misread. **They were not. I trusted a derived transcript over
the photograph.**

The handwriting reads:

```
17   2 PKS. TWIX ICE CREAS            → "2 pks. Twix ice creams"
18   1 x 4pk BEN & JERRY's COOKIE DOUGH
19   1 pk. ASDA FRUIT LOLLY ICES
```

`Deliverables/2026-08-17-asdair-corrected-transcript-from-photograph.md` records line 18 as *"2 pks
Ben & Jerry's cookie dough"* and line 19 as *"1 x 4pk ASDA fruit lolly ices"* — **it has slid the
`2 pks` up from line 17 and invented a `4pk` on 19.** Today's runtime read both correctly.

**The lesson is the one already in the memory: reconcile to the SOURCE, not the derived list.** A
document called "corrected transcript" is still derived. I used it as ground truth and reported a
false defect against a run that had got it right.

---

## The seven, answered by reading

| # | The line, as written | What it plainly is | Was a question warranted? |
|---|---|---|---|
| 1 | `2 SLICED ROAST BEEF` | Sliced cooked roast beef from the chilled meats aisle. `ASDA Sliced Topside of Beef 90g` — **already regular 80, already its own top candidate, already matched at 0.99** | **No** |
| 2 | `1 x 6pk. HEINZ BAKED BEANS` | A six-pack of Heinz baked beans. **Already matched at 0.99.** The question quoted the product's own full catalogue name back at Warwick | **No** |
| 3 | `1 x 4pk BEN & JERRY's COOKIE DOUGH` | Ben & Jerry's Cookie Dough ice cream, four-pack — the mini-cup/stick multipack | **Yes — but the right question.** *"I can't find a 4-pack of Ben & Jerry's Cookie Dough in your catalogue. Search ASDA?"* Not *"is it Beef Quarter Pounders?"* |
| 4 | `1 pk. ASDA FRUIT LOLLY ICES` | ASDA own-brand fruit ice lollies | **No** — recorded as present in his ASDA Favourites |
| 5 | `1 WET WIPES` | Wet wipes | **No** — a standing rule covers it. His own answer on 17 Aug: *"there is a rule about this"* |
| 6 | `2 SURE DEODERENT MALE` | Sure **men's** anti-perspirant | **Yes, genuinely ambiguous** — but see below |
| 7 | `2 PKTS ASDA PLAIN TOFFEES` | ASDA plain toffees | **No** — his answer on 17 Aug: *"n favourites FFS stupid question"* |

**Two of seven are real questions. Five are not.**

## The sharpest failure is inside the one question that WAS legitimate

Question 6 offered four candidates: *Bright Bouquet · Invisible Pure · Quantum Dry · Sport Cool*.

**The line says `MALE`.** At least one of those is plainly a women's fragrance and **not one of them is
identified as Sure Men.** So even the question that deserved to be asked ignored a word sitting in
plain sight in the line it was asking about. **That is not a candidate-ranking bug. That is nothing
reading the line.**

## Why the current architecture produces this

The model **is** used to read the photograph and match against the catalogue — and it did that well
today: 37 lines, `match_confidence` 0.94–0.99, the invention gone. **Then the leftovers are handed to
a deterministic scorer** (`skill/planner.js`, `regularCandidates`) which ranks by proportion of shared
words, with the only filter being `w.length > 2`.

So `asda` — a word on most of the catalogue — scores a match, and the tie-break is alphabetical. That
is why `2 pkts ASDA plain toffees` returned the alphabetical head of the ASDA list: ham, eggs, freezer
bags, quarter pounders, bananas. `wet` matched cat food. `4pk` matched Twix.

**The capable model reads the list and is then switched off at precisely the moment judgement is
required.** Everything downstream of the match — which lines need a human, what to offer, how to
phrase it — is string arithmetic.

## What "AsdAIr does this with logic, reason and intelligence" actually requires

The catalogue is **109 rows**. The rules are **28**. The Favourites list is bounded. All of it fits in
a prompt several times over — the grounded read already sends 19,895 characters. **There is no cost
argument for the deterministic path and no latency argument either.**

The change is not a better scorer. It is: **when a line does not match, the model resolves it — with
the catalogue, the rules and Favourites in front of it — and either answers it, or asks a question a
person would recognise as intelligent.** The deterministic path becomes the fallback for when the
model is unavailable, not the thing that decides.

Concretely, on this list that means:

- rows 1 and 2 never become questions, because they are already matched;
- rows 4, 5 and 7 are answered from Favourites and rules **before** anyone is asked;
- row 3 asks to search ASDA, naming what it could not find;
- row 6 offers **Sure Men** variants, because the line says male.

## Status

**This is the specification for the frontier item already on the map** — ⚑ WORK CLASSIFICATION,
FRONTIER, REMEDIATE: *"the capable model was engineered out of the loop and replaced by weak
deterministic components."* Every fix dispatched on 2026-08-18 — the corroboration gate, the answer
binding rule, the planner word filter now in flight as WP-B15-54 — sits **below** that line. They make
the deterministic layer less wrong. **None of them puts the model back in the loop, and the frontier
says that is the work.**
