# The known list — Mum's handwritten shopping list, 2026-08-11

`mum-list-2026-08-11.jpg` · **sha256 `89f33073296b4808f544b1f6111f10c723e532106f339d94cdae90633de80a16`** · 103,670 bytes

**This is the photograph that live production shop 26 actually ingested.** Not a copy of something like
it, not a re-photograph — the same bytes. Verified against `asdair.shop_source_image`, which records
`fingerprint = 89f33073…`, `byte_length = 103670`, `captured_at = 2026-08-11 18:32:06`. The staged copy's
hash was recomputed and matched before it was committed. **A matching byte length is not a matching
photograph; the hash is what settles it.**

## Why it is committed, since it will look surprising in a public repository

**Warwick has ruled three times — 2026-07-27, 2026-08-04 and 2026-08-12 — that shopping data is not
private:** *"nothing private about my shopping as I have told you a million times and is meant to be
written down!"* Product names, regulars, quantities, run outputs and itemised lists are committed on
purpose. **Only secrets stay out.** The scanner was run over this directory before the commit: `SCANNED 1
file(s), 0 secret value(s) found`, exit 0.

## What committing it actually unblocked

It previously lived only under `C:/.fusion247/asdair/shopper-media/`, which is the secrets store.
**`GL-012` denies that surface by default, so no dispatched worker could ever reach it** — every Work Order
that needed the real photograph either faked the input or stopped at the boundary. Lane E recorded "what P1
actually read" as UNESTABLISHED for exactly this reason: the source photograph was an argv path nobody
downstream could open.

So this file is the difference between a journey that can be re-run by anyone and one only Larry can run.

## What it is used for, and what it is not

**Used for:** exercising the real vision → reconciliation → provenance → final-list → browser-handoff
journey against a disposable database, without a live gateway secret or a private-surface grant.

**Not used for:** reopening vision. **Warwick parked the eyesight architecture** — *"the known photograph
has already demonstrated stable visual coverage at 39/39 with zero omissions. Do not reopen the eyesight
architecture or start another vision research cycle unless genuinely new evidence disproves that result."*
This file exists so the rest of the journey can be proven over a real input, **not so the reading of it can
be re-litigated.**

## The established result over this image

39 page lines · 47 observations · 47 accounted · none missing, none doubled · **39 products / 53 items** ·
30 shoppable · 9 held. Support from 2-of-3 frozen readings selected all 39 real lines and excluded all three
measured inventions. **2-of-3 agreement is CORROBORATION, never VERIFICATION** — three readings by one model
of one photograph are correlated, and a phantom has been measured reaching 3-of-3 in another run family.
