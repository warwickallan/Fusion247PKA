# Subagent token ledger — 2026-08-13, the AsdAIr finishing session

**Larry-transcribed from the usage block of every `Agent` return. NOT independently instrumented** — no
tool reproduced these figures, and a transcription error would not be detectable from this file alone.
**An agent that emitted no usage block is unmeasured, NOT zero.**

## The measurement question — RE-TESTED, not assumed

**`subagent_tokens` is CUMULATIVE per agent id. `tool_uses` and `duration_ms` are PER-DISPATCH.**

**The evidence, and it is the reason this ledger is not ~80% too large:** across the **8** agents
with more than one return, `subagent_tokens` is monotonically increasing in **8 of 8**.
`tool_uses` is monotonic in only **5 of 8** — `cockpit-ui` 40→107→**61**,
`mum-cockpit` 28→81→139→**23**, `lane-J` 46→**10**→47→**36**. **A cumulative counter cannot decrease.
Three of them do.**

*(Same result as the 2026-08-08 finding. Warwick's step 5b requires re-testing rather than inheriting it, and
this is the re-test.)*

## Total A — deduplicated subagent token traffic

# 4,404,873 tokens

across **19 agent ids** and **32 returns**, taking each agent's final cumulative reading.

> ⛔ **Larry's own context is NOT in this figure and must never be added to it.** Context occupancy is a
> **level**; subagent traffic is a **flow**. Summing them produces a meaningless "total tokens" — a ratio is
> the only honest joint statement. **Larry's own occupancy is UNESTABLISHED: no instrument in this estate
> reads it.**

## Total B — peak footprint per persistent agent

| agent id | type | work | returns | peak tokens |
|---|---|---|---:|---:|
| `ad21bf6d7b2c54fa7` | felix | WP-B15-45 Mum Cockpit | 4 | **441,603** |
| `af8da5745a5c52267` | felix | WP-B15-42 Cockpit UI | 3 | **404,816** |
| `a796fafc08ec04322` | keel | WP-B15-41 Lane C re-issued | 2 | **370,312** |
| `a537ecde505c35ce1` | keel | WP-B15-46 Lane G | 2 | **323,644** |
| `ac08553fc19467dd5` | keel | WP-B15-47 Lane J | 4 | **294,738** |
| `a7e13df859d2c1755` | keel | WP-B15-40 Lane AB re-issued | 2 | **268,404** |
| `a26378b73d92a32e9` | keel | WP-B15-44 Lane F v1 — REFUSE | 2 | **260,735** |
| `aff55f48afd7ec623` | vera | gate WP-B15-45 — CONDITIONAL PASS | 1 | **239,664** |
| `a7ca34be24b194b55` | vera | gate WP-B15-42 — CONDITIONAL PASS | 1 | **209,583** |
| `a29cdac512fc9fc43` | pax | session-report (returned after the previous rotation) | 1 | **207,315** |
| `aca5950c3efdd0083` | vera | re-inspect WP-B15-42 — PASS | 1 | **192,004** |
| `acd5cf1f4f943b560` | veritas | Gate 1 WP-B15-40 — HOLD | 1 | **183,375** |
| `a4099772095fdcddb` | vera | re-inspect WP-B15-45 — FAIL | 1 | **182,516** |
| `a455abbefb2688402` | general-purpose | WP-B15-43 Lane E Terra analysis | 2 | **161,360** |
| `a9698057f5c6491ee` | keel | WP-B15-41 Lane C v1 — REFUSE | 1 | **156,558** |
| `a6cdda1349e9b939d` | keel | WP-B15-44 Lane F re-issued | 1 | **136,926** |
| `a24866669403aebe8` | vera | final re-inspect WP-B15-45 — PASS | 1 | **131,140** |
| `a793772d2533c3618` | keel | WP-B15-40 Lane AB v1 — REFUSE | 1 | **122,134** |
| `a1110cb06c03b4320` | iris | D-17 resolution + GL-003 §2b | 1 | **118,046** |

## Total C — dispatch and tool-use counts

**32 returns · 1,657 tool uses · 19 distinct agents.**

| agent id | returns | tool uses per return | seconds per return |
|---|---:|---|---|
| `ad21bf6d7b2c54fa7` | 4 | 28, 81, 139, 23 | 393, 2790, 5199, 615 |
| `af8da5745a5c52267` | 3 | 40, 107, 61 | 353, 1838, 950 |
| `a796fafc08ec04322` | 2 | 53, 133 | 640, 2219 |
| `a537ecde505c35ce1` | 2 | 36, 91 | 409, 1375 |
| `ac08553fc19467dd5` | 4 | 46, 10, 47, 36 | 531, 213, 747, 508 |
| `a7e13df859d2c1755` | 2 | 31, 74 | 449, 1230 |
| `a26378b73d92a32e9` | 2 | 17, 76 | 205, 1216 |
| `aff55f48afd7ec623` | 1 | 45 | 1054 |
| `a7ca34be24b194b55` | 1 | 81 | 1333 |
| `a29cdac512fc9fc43` | 1 | 29 | 849 |
| `aca5950c3efdd0083` | 1 | 91 | 2194 |
| `acd5cf1f4f943b560` | 1 | 64 | 945 |
| `a4099772095fdcddb` | 1 | 43 | 821 |
| `a455abbefb2688402` | 2 | 11, 27 | 142, 702 |
| `a9698057f5c6491ee` | 1 | 28 | 309 |
| `a6cdda1349e9b939d` | 1 | 33 | 553 |
| `a24866669403aebe8` | 1 | 20 | 501 |
| `a793772d2533c3618` | 1 | 31 | 313 |
| `a1110cb06c03b4320` | 1 | 25 | 482 |

## By specialist type (deduplicated)

| type | agents | peak tokens | share of A | tool uses |
|---|---:|---:|---:|---:|
| keel | 8 | 1,933,451 | 43.9% | 742 |
| vera | 5 | 954,907 | 21.7% | 280 |
| felix | 2 | 846,419 | 19.2% | 479 |
| pax | 1 | 207,315 | 4.7% | 29 |
| veritas | 1 | 183,375 | 4.2% | 64 |
| general-purpose | 1 | 161,360 | 3.7% | 38 |
| iris | 1 | 118,046 | 2.7% | 25 |

## Uncertainties, stated rather than implied

- **Larry-transcribed**, not instrumented. This is the single largest source of doubt in the file.
- **Larry's own context occupancy: UNESTABLISHED**, and correctly excluded from A.
- **Wall-clock CANNOT be summed.** Up to five agents ran concurrently and `duration_ms` overlaps heavily.
  Elapsed session time is the honest denominator; the sum of durations is not a real quantity.
- **Three REFUSE returns are counted in full.** They consumed real tokens and produced real findings — Lane C's
  refusal found a false premise of Larry's, Lane F's deleted an acceptance criterion, and Lane AB's proved two
  criteria mutually unsatisfiable. **Rework cost is not waste here, and this ledger does not net it out.**
- **Gateway spend is measured separately and is NOT a token figure:** the two vision captures cost
  **$0.418977** (gpt-5-mini — the run that exposed the model misconfiguration, superseded) and **$0.187308**
  (gpt-5.6-terra — the artefact actually used). **Lane J's three replay runs made ZERO gateway calls.**
