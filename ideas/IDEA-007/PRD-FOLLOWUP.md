PRD Follow Up

**It does not change the core PRD. It adds three important requirements and proposes one architectural shortcut that should remain uncommitted until tested.**

## What Larry adds

### 1. Human-assisted entity resolution

This is a meaningful addition.

The PRD already says uncertain merge decisions must be reviewable. Larry makes that much more concrete:

> Confident cases resolve automatically; ambiguous cases become one-tap questions in Directus.

Example:

> Is “AI conversational memory” the same as “Persistent Agent Memory”?

Warwick can choose:

* same concept;
* alias;
* broader;
* narrower;
* related;
* separate concept.

That answer should:

* update the canonical concept;
* preserve the original wording;
* become reusable resolution evidence;
* influence future matching;
* provide feedback to Honcho where it reveals an interest or preference.

This turns “perfect automatic deduplication” from a dependency into a combination of automation and occasional human judgement.

LightRAG’s documented `merge_entities()` operation does provide the mechanical merge: it redirects relationships, combines duplicate relationships, prevents self-loops and removes the source entities. It does **not** decide correctly when a merge is semantically justified—that remains ObsidiWikAi’s canonicalisation judgement. ([GitHub][1])

### 2. The deferred-knowledge reservoir

This is the strongest new product idea in Larry’s response, and it should be added explicitly.

The original PRD says the lens grows and old sources may be reanalysed. Larry gives that a proper product mechanism:

> Material not sufficiently relevant today is retained as low-confidence or deferred knowledge rather than discarded.

As Honcho’s model of Warwick expands, the system should periodically ask:

* Which old sources contain concepts relevant to newly developed interests?
* Which previously deferred candidates now deserve deeper analysis?
* Which earlier sources should be reprocessed through the new lens?
* Which old concepts can now be connected to newer encyclopedia knowledge?

That means the encyclopedia compounds in both directions:

```text
new sources → new knowledge

new understanding of Warwick → renewed value from old sources
```

That is not merely implementation detail. It is a significant product requirement:

> **Warwick’s historical source library must remain semantically renewable.**

### 3. The interest model must be visible and correctable

The PRD already required inspectability, but Larry sharpens it into a product surface:

> Directus must show “what the system thinks Warwick cares about.”

That view should include:

* enduring interests;
* active interests;
* emerging interests;
* goals;
* projects;
* unresolved questions;
* negative signals;
* confidence;
* evidence;
* last change;
* expiry or review date.

Warwick must be able to:

* confirm;
* correct;
* weaken;
* strengthen;
* expire;
* merge;
* reject;
* add an interest manually.

A canonical interest record should exist outside Honcho—probably in Supabase—with Honcho enriching and reasoning over it rather than becoming the only hidden copy.

That belongs in the PRD as a dedicated **Interest Lens Management** requirement, not merely as an operational safeguard.

## What is now technically better supported

Larry is right that LightRAG exposes two useful primitives.

### Entity merging exists

`merge_entities()` is a documented operation with configurable merge strategies and relationship redirection. ([GitHub][1])

This confirms the PRD is asking for orchestration and semantic judgement around an existing capability, rather than requiring us to invent graph merging from scratch.

### Runtime extraction guidance exists

LightRAG documents `addon_params` as a live configuration mapping. Its supported fields include `entity_types_guidance`, and top-level changes are refreshed when LightRAG next builds runtime extraction configuration. ([GitHub][1])

That supports the concept of changing extraction guidance as Honcho’s lens evolves.

But we should phrase the claim accurately:

> LightRAG can receive changing extraction guidance at runtime.

Not yet:

> Any arbitrary Honcho personality model can perfectly steer all LightRAG semantic attention through one field.

The exact Warwick lens will probably need a structured prompt profile, entity guidance, source-analysis instructions and possibly a separate second-pass query—not merely dumping the entire Honcho context into `addon_params`.

## What should **not** be accepted into the PRD as settled

Larry says:

> One Neo4j, candidate and canonical distinguished by a status flag, and LightRAG’s merge function promotes them.

That is plausible, but it is an implementation proposal—not yet a product requirement.

The risk remains that LightRAG may own, rewrite or delete graph entities according to its indexing lifecycle. Its documented merge operation removes source entities after redirecting their relationships. ([GitHub][1])

Therefore the PRD should continue to specify:

* one user-visible encyclopedia;
* candidate and canonical knowledge states;
* no competing “second brain” for Warwick;
* stable canonical identities;
* rebuildability and provenance;
* LightRAG working data must not silently overwrite accepted encyclopedia knowledge.

It should **not yet prescribe** whether those states live in:

* one Neo4j database with protected namespaces/labels;
* separate Neo4j databases;
* LightRAG storage plus a curated projection;
* another technically equivalent arrangement.

Larry is already right to test this on the pinned deployment before committing the architecture.

## Exact PRD additions

I would add these four requirements.

### FR — Human-assisted semantic resolution

When automatic canonicalisation confidence falls below the approved threshold, the product shall surface a concise resolution question in Directus. Warwick shall be able to classify candidates as the same concept, alias, broader, narrower, related, contradictory or distinct. The result shall update canonical knowledge, preserve evidence and inform future matching.

### FR — Deferred semantic reservoir

Knowledge that is valid but currently below the interest or confidence threshold shall be retained as deferred candidate material rather than discarded. It shall preserve source, evidence, concepts, confidence, processing lens and reason for deferral.

### FR — Historical re-analysis

When Warwick’s interest lens changes materially, the product shall identify relevant historical sources and deferred candidates for re-analysis. Re-analysis shall be selective, metered, idempotent and explain why the older material has become newly relevant.

### FR — Interest lens management

Directus shall provide an inspectable and correctable view of Warwick’s enduring, active, emerging and negative-interest signals, including evidence and confidence. Canonical interest state shall remain exportable outside Honcho, and Warwick’s corrections shall influence subsequent source analysis.

## Bottom line

Larry has not replaced the idea you and I articulated.

He has added two particularly valuable mechanics:

1. **Ask Warwick only about genuinely ambiguous concepts.**
2. **Keep overlooked knowledge and rediscover it as Warwick evolves.**

Those materially improve the PRD.

His claims about LightRAG merging and live extraction guidance are grounded in the official documentation, but they prove available primitives—not the entire finished personalised canonicaliser. ([GitHub][1])

And his “single Neo4j with a flag” design should remain a testable implementation option, not become a product-level commitment yet.

[1]: https://github.com/HKUDS/LightRAG/blob/main/docs/ProgramingWithCore.md?utm_source=chatgpt.com "LightRAG/docs/ProgramingWithCore.md at main · HKUDS/LightRAG · GitHub"
