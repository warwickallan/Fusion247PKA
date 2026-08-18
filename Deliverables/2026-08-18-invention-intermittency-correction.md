# The invention was NOT proven intermittent — the two runs ran different code

**Correcting `ccd3372` forward, 2026-08-18.** That commit is on `main` and its central claim is
false. History is not rewritten; the record is corrected where it can be read beside the original.

## What `ccd3372` claimed

> *"NOTHING WAS CHANGED BETWEEN THE RUNS. No code, no prompt, no model, no config. So this is not a
> fix — it makes the fault intermittent, which is the harder finding."*

## What the dates say

| | |
|---|---|
| The failing run — `SHOP-2026-08-17`, shop 33 — transcribed at | **2026-08-17T17:59:12Z** |
| `prepareImage.js` **and** its `deps.js` wiring landed on `main` at | **2026-08-17T22:33:43Z** (`2ad1ad0`) |

**The invention happened four hours and thirty-four minutes BEFORE the image-preparation fix
existed.** Established by execution:

```
git log --format="%H %cI %s" -- services/asdair/transcribe/prepareImage.js
git log -S "realPrepareImage" --format="%H %cI %s" -- services/asdair/pipeline/deps.js
  → 2ad1ad0  2026-08-17T23:33:43+01:00   (both files, one commit)
```

Both files changed in **one** commit, so neither the preparer nor the call site existed at 17:59Z.
The process serving that run (pid 42548) had started at `17:21:45Z` with a `deps.js` that contained
no preparation step to lazily import.

Today's run carries the opposite evidence, in the production ledger rather than in a log:

```
asdair.pipeline_command id 277 · shop 37 · command groundingEvidence
  source_kind: photo · prompt_chars: 19895 · image_preparation: { floor: 1440, scale: 2 }
```

**The two runs differ in exactly the module whose absence was diagnosed as the root cause.** They are
not the controlled comparison an intermittency claim requires, so the claim has no basis.

## What is actually established, and what is not

**ESTABLISHED.** On the real photograph, through the real production path, with image preparation
present, the photo door read all 37 lines and produced the three corrections that matter: line 14
`2 sliced roast beef` where it had invented `2 skinny cow bars`; lines 15 and 16 as two distinct
Heinz products where one had been lost to a duplicated line; line 8 at the correct quantity.

**NOT ESTABLISHED.** That the defect can never recur. The vision step is probabilistic, and **one
clean run of a probabilistic component is corroboration, not proof** — the build's own rule, and it
binds in this direction too.

**Both errors are the same error in opposite directions.** *"The invention is gone"* (Larry, in a
notification to Warwick) overstated a single run. *"Intermittent, nothing changed"* asserted a
negative about the code without checking two commit timestamps. **Neither statement was measured
before it was made.**

## What would settle it

Repeated reads of the same photograph through the production path, counting inventions. Nothing else
does — and until that exists, the honest label for line 14 is **corrected on the run that was
measured**, never *fixed* and never *intermittent*.
