---
title: FINDING — a remembered choice is keyed on a different normaliser, so the memory misses when the shop hits
date: 2026-08-10
author: Larry, from WP-B15-13's read-back, then verified against the live store
status: OPEN — sequenced behind WP-B15-13, not deferred indefinitely
severity: Warwick is asked again next week for something he already answered
---

# The shop will resolve. The memory still will not.

**Found by WP-B15-13's worker while establishing the blast radius of its own change, reported at the
boundary of its surface, and written down here because it existed nowhere durable — only in an agent
transcript and my head, which is the exact failure this estate keeps paying for.**

## The mechanism

WP-B15-13 makes product matching **separator-blind**, so Warwick writing `VANISH PRETREAT GEL`
resolves to the household regular `Vanish Pre-Treat Gel`. That fixes **this week's shop**.

**It does not fix his memory.** A remembered choice is keyed on `pipeline/keys.js` `normaliseTerm`
— a **different** normaliser — and the key is persisted as
`asdair.remembered_choice.choice_term`, stamped `keys.normaliseTerm@1`. The lookup is **SQL exact
equality** (`choice_term = ANY($2::text[])`).

So after B15-13 lands: the two spellings resolve to the same product, and still produce **two
different memory keys**. The answer he gives against one spelling is not found when he writes the
other, and he is asked again.

## Why the obvious fix is wrong

**Do NOT "just" make `keys.normaliseTerm` separator-blind.** It is deliberately separate, and it is
**data-shaped**: it mints idempotency keys as well as `choice_term`. Changing it changes the identity
of persisted keys, which is a different and much worse class of defect than the one being fixed.
`skill/planner.js` keeps its own `normaliseTerm` for the same reason — dedupe keys and exact
equality — and B15-13 established that **nothing data-shaped is built on the function it IS
changing**, which is precisely why its change is safe and this one would not be.

The shape of a correct fix is to apply B15-13's separator-blind rule **at the lookup**, or to store
an additional squashed form beside the exact one — not to redefine the key.

## What is NOT the blocker

**Data migration is not the obstacle.** Verified read-only against the live store:
`select count(*) from asdair.remembered_choice` → **1 row.** Whatever is chosen, at most one memory
is affected, and it can be re-earned in a single shop. I had assumed a migration burden here and
there is none.

## The real blocker, and the sequencing

**The fix should reuse the rule WP-B15-13 is exporting, and that rule does not exist yet.** Building
a second separator-blind implementation beside it — in a file whose whole problem is that it holds a
second normaliser — would be the same defect wearing a third hat.

**So: sequenced behind WP-B15-13, then applied at the memory lookup.** Not deferred on the vaguer
grounds I first gave ("judge from real rows"); that reasoning is right for the *learning* question
and wrong here, because this mechanism is established by reading rather than inferred from a symptom.

## Why it matters more than it looks

This is the defect Warwick was angriest about tonight in its purest form: **being asked a question he
has already answered.** Fixing the resolver without fixing the memory means the shop gets it right
once and forgets — which looks, from his side, exactly like nothing was fixed.
