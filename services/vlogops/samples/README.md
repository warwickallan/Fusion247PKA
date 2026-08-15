# Samples — what these are, and what they are not

## `master-story-package-sample.md`

One real Master Story Package, produced by the real chain, committed so a human can read what
Phase 3 actually emits without provisioning a database to see it.

**⛔ It is not written in Warwick's voice, and it is not evidence about writing.** It was drafted
by `deterministic-stub-v1`, a mechanical placeholder composer with no language model behind it.
The file says so in a banner at the top, and the package row in the database says so too, in
`model_binding`, permanently. Creative judgement of any Master Story Package is Warwick's alone
and it happens at Phase 5.

What it does evidence, and this is the whole point of committing it:

- **one canonical master** — a story question, five beats and two narrative claims, each resting
  on a named pack entry;
- **four siblings** — script, blog, titles and thumbnail direction, each segment naming the
  master claim it adapts and the evidence that master rests on;
- **a traceability index** at the foot of the file, from which any segment can be followed to a
  pack entry and from there to the immutable snapshot Phase 1 froze.

### Provenance — a SNAPSHOT, not a regenerable fixture

| | |
|---|---|
| seed | `1ff6260e077bc47d77286f9e84fbfc30d6cafc229471d1d130289c5316aa4c71` |
| pack | `9ba2bf8bce54b93fd564b828faf1b4f616161fec2d856249437a4636098abe6a` |
| package | `1e87ca1f17c7da826cddcc7d23bd8432ed5dbaf217ef7e2cc33fc7ea82801fa5` |
| contract | `scribe-v1` · `7df7f453b8c3a6512bd8b1da5d2bb31c8e498922f1da746220c288bd2c8d1edc` |
| window | Route 1 `records --from 2026-08-13 --to 2026-08-14` |
| drafted | 2026-08-15, on a disposable local cluster, BUILD-006 Phase 3 |

**Do not treat this as a golden file, and do not write a test that asserts a future run
reproduces it.** The seed is compiled from this repository's own git history and dated records, so
re-running the same command on a moved `HEAD` correctly produces a different seed, a different
pack and a different package. That is the intake working, not a regression.

What *is* reproducible, and what the proofs actually assert, is narrower and honest: **the same
pack under the same contract yields the same prompt bytes, the same `derivation_id`, and — under
the deterministic stub — the same `package_id`.** That was demonstrated across three independent
clusters while this Work Order was built, reaching `1e87ca1f…` every time.

### Reproducing it yourself

```
node bin/vlogops-intake.mjs records --from 2026-08-13 --to 2026-08-14 --privacy internal
node bin/vlogops-compile.mjs compile --seed <seed_id>
node bin/vlogops-scribe.mjs draft --pack <pack_id> --model stub --emit <path>
```

`--model stub` must be asked for by name. Without it the CLI defaults to the gateway and
**refuses** when none is configured — see `RUNBOOK.md` §"Scribe has no model".
